import { escapeHtml as escape } from './helpers.js';
import { DURATION_OPTIONS, PROCEDURE_OPTIONS, statusMeta } from './state.js';
import { wireLogout } from './session.js';

const timeZone = 'Europe/Lisbon';
const dateParts = new Intl.DateTimeFormat('sv-SE', {
  timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit'
});
const time = new Intl.DateTimeFormat('pt-PT', { timeZone, hour: '2-digit', minute: '2-digit' });
const today = () => dateParts.format(new Date()).slice(0, 10);
const states = ['scheduled', 'confirmed', 'arrived', 'no_show', 'cancelled'];
const label = value => ({
  confirmed: 'Confirmada', no_show: 'Faltou', cancelled: 'Cancelada', rescheduled: 'Reagendada'
})[value] || statusMeta(value).label;
const option = (value, text) => `<option value="${escape(value)}">${escape(text)}</option>`;
const clinicOptions = clinics => clinics.map(clinic => option(clinic.id, clinic.name)).join('');
const editable = row => row.mode !== 'bloqueio' && row.patient_name && states.includes(row.status);

function lisbonInstant(day, hour) {
  const wanted = `${day} ${hour}`;
  const utc = Date.parse(`${day}T${hour}:00Z`);
  const matches = [utc, utc - 3600000].filter(ms => dateParts.format(new Date(ms)) === wanted);
  if (matches.length !== 1) throw new Error('Escolhe outra hora. Esta hora é ambígua ou não existe em Lisboa.');
  return new Date(matches[0]).toISOString();
}

async function request(action, args = {}) {
  const { data, error } = await window.sb.rpc('gc_secretariat_booking', { p_action: action, p_args: args });
  if (error) throw error;
  return data;
}

export async function bookingAccess() {
  try {
    return await request('scope');
  } catch (error) {
    // The local front end can also run against a database awaiting this migration.
    if (error.code === 'PGRST202') return { clinics: [], report_clinics: [] };
    throw error;
  }
}

export async function openSecretariatAgenda(clinics) {
  const root = document.getElementById('appRoot');
  root.innerHTML = `
    <main style="max-width:900px;margin:auto;padding:1rem">
      <header><h1>Agenda do secretariado</h1><button type="button" id="btnLogout">Sair</button></header>
      <p>
        <label>Clínica <select id="secretariatClinic">${clinicOptions(clinics)}</select></label>
        <label>Dia <input id="secretariatDay" type="date" value="${today()}"></label>
        <button type="button" id="secretariatNew">Nova marcação</button>
      </p>
      <p id="secretariatMessage" role="status"></p>
      <ul id="secretariatBookings"></ul>
      <dialog id="secretariatEditor" aria-labelledby="secretariatTitle" style="max-width:min(92vw,36rem)">
        <form>
          <h2 id="secretariatTitle"></h2>
          <p><label>Clínica <select name="clinic" required>${clinicOptions(clinics)}</select></label></p>
          <div id="secretariatPatient">
            <label>Pesquisar doente pelo nome <input type="search" name="query" minlength="3" autocomplete="off"></label>
            <button type="button" id="secretariatSearch">Pesquisar</button>
            <p><label>Doente <select name="patient" required></select></label></p>
            <p><label>Tipo de consulta <select name="procedure" required>${option('', 'Seleciona o tipo')}${PROCEDURE_OPTIONS.map(item => {
              const name = item.replace(/^[^\p{L}]+/u, '');
              return option(name, name);
            }).join('')}</select></label></p>
          </div>
          <p><label>Dia <input type="date" name="day" required></label>
          <label>Hora de Lisboa <input type="time" name="hour" required></label></p>
          <p><label>Duração em minutos <input type="number" name="duration" list="secretariatDurations" min="5" max="480" required></label>
          <datalist id="secretariatDurations">${DURATION_OPTIONS.map(value => option(value, value)).join('')}</datalist></p>
          <p id="secretariatState"><label>Estado <select name="status"></select></label></p>
          <p id="secretariatEditorMessage" role="status"></p>
          <button type="button" id="secretariatClose">Fechar</button>
          <button type="submit">Guardar</button>
        </form>
      </dialog>
    </main>`;

  const viewClinic = root.querySelector('#secretariatClinic');
  const viewDay = root.querySelector('#secretariatDay');
  const message = root.querySelector('#secretariatMessage');
  const list = root.querySelector('#secretariatBookings');
  const dialog = root.querySelector('#secretariatEditor');
  const form = dialog.querySelector('form');
  const fields = form.elements;
  const save = form.querySelector('[type=submit]');
  const search = root.querySelector('#secretariatSearch');
  const close = root.querySelector('#secretariatClose');
  const editorMessage = root.querySelector('#secretariatEditorMessage');
  let rendering = 0;
  let searching = 0;
  let editing = null;
  let creationRequest = null;
  let saving = false;
  const defaultDuration = clinicId => clinics.find(clinic => clinic.id === clinicId)?.duration || 20;

  async function loadDay() {
    const revision = ++rendering;
    list.replaceChildren();
    if (!viewDay.value) { message.textContent = 'Escolhe um dia.'; return; }
    message.textContent = 'A carregar marcações…';
    try {
      const rows = await request('day', { clinic_id: viewClinic.value, from: viewDay.value });
      if (revision !== rendering) return;
      for (const row of rows) {
        const item = document.createElement('li');
        const period = `${time.format(new Date(row.start_at))}–${time.format(new Date(row.end_at))}`;
        item.textContent = row.mode === 'bloqueio' ? `${period} · Bloqueio` :
          [period, row.patient_name || 'Doente', row.procedure_type, label(row.status)].filter(Boolean).join(' · ');
        if (editable(row)) {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = 'Editar';
          button.onclick = () => openEditor(row);
          item.append(' ', button);
        }
        list.append(item);
      }
      message.textContent = rows.length ? '' : 'Sem marcações para este dia.';
    } catch (error) {
      if (revision === rendering) message.textContent = error.message;
    }
  }

  function clearSearch() {
    ++searching;
    fields.patient.innerHTML = option('', 'Seleciona um doente');
    editorMessage.textContent = '';
    search.disabled = false;
  }

  function openEditor(row = null) {
    editing = row;
    creationRequest = null;
    form.reset();
    clearSearch();
    const localStart = row ? dateParts.format(new Date(row.start_at)) : `${viewDay.value || today()} 09:00`;
    fields.clinic.disabled = Boolean(row);
    fields.clinic.value = viewClinic.value;
    fields.day.value = localStart.slice(0, 10);
    fields.hour.value = localStart.slice(11, 16);
    fields.duration.value = row ? Math.round((Date.parse(row.end_at) - Date.parse(row.start_at)) / 60000) : defaultDuration(fields.clinic.value);
    fields.query.disabled = Boolean(row);
    fields.patient.disabled = Boolean(row);
    fields.procedure.disabled = Boolean(row);
    fields.status.disabled = !row;
    fields.status.innerHTML = states.filter(state => state !== 'confirmed' || row?.status === state)
      .map(state => option(state, label(state))).join('');
    fields.status.value = row?.status || 'scheduled';
    root.querySelector('#secretariatPatient').hidden = Boolean(row);
    root.querySelector('#secretariatState').hidden = !row;
    root.querySelector('#secretariatTitle').textContent = row ? `Editar marcação de ${row.patient_name}` : 'Nova marcação';
    dialog.showModal();
  }

  dialog.onclose = () => { ++searching; };
  dialog.oncancel = event => { if (saving) event.preventDefault(); };
  close.onclick = () => dialog.close();
  fields.clinic.onchange = () => {
    fields.query.value = '';
    fields.duration.value = defaultDuration(fields.clinic.value);
    clearSearch();
  };
  fields.query.oninput = clearSearch;
  fields.query.onkeydown = event => {
    if (event.key === 'Enter') { event.preventDefault(); search.click(); }
  };
  search.onclick = async () => {
    clearSearch();
    const query = fields.query.value.trim();
    if (query.length < 3) { editorMessage.textContent = 'Escreve pelo menos três caracteres.'; return; }
    const revision = searching;
    search.disabled = true;
    try {
      const patients = await request('patients', { clinic_id: fields.clinic.value, query });
      if (revision !== searching) return;
      for (const patient of patients) {
        const dob = patient.dob ? ` · ${patient.dob.split('-').reverse().join('/')}` : '';
        fields.patient.add(new Option(patient.full_name + dob, patient.id));
      }
      if (patients.length === 1) fields.patient.value = patients[0].id;
      editorMessage.textContent = patients.length ? '' : 'Nenhum doente ativo com esse nome nesta clínica.';
    } catch (error) {
      if (revision === searching) editorMessage.textContent = error.message;
    } finally {
      if (revision === searching) search.disabled = false;
    }
  };

  form.onsubmit = async event => {
    event.preventDefault();
    if (saving) return;
    saving = save.disabled = close.disabled = true;
    editorMessage.textContent = 'A guardar…';
    const clinic = fields.clinic.value;
    const day = fields.day.value;
    try {
      const args = { clinic_id: clinic, start_at: lisbonInstant(day, fields.hour.value), duration: Number(fields.duration.value) };
      if (editing) Object.assign(args, { id: editing.id, updated_at: editing.updated_at, status: fields.status.value });
      else {
        Object.assign(args, { patient_id: fields.patient.value, procedure_type: fields.procedure.value });
        const signature = JSON.stringify(args);
        if (creationRequest?.signature !== signature) creationRequest = { signature, id: crypto.randomUUID() };
        args.request_id = creationRequest.id;
      }
      await request('save', args);
      dialog.close();
      viewClinic.value = clinic;
      viewDay.value = day;
      await loadDay();
    } catch (error) {
      editorMessage.textContent = error.message;
    } finally {
      saving = save.disabled = close.disabled = false;
    }
  };
  viewClinic.onchange = viewDay.onchange = loadDay;
  root.querySelector('#secretariatNew').onclick = () => openEditor();
  await wireLogout({ checkPending: false });
  await loadDay();
}

export function mountBookingReport(host, clinics) {
  if (!host || !clinics.length || host.querySelector('#secretariatReport')) return;
  const details = document.createElement('details');
  details.id = 'secretariatReport';
  details.innerHTML = `
    <summary>Estatísticas de marcações</summary>
    <form>
      <p>Período pela data de criação. O estado corresponde à marcação mais recente.</p>
      <label>De <input type="date" name="from" value="${today().slice(0, 7)}-01" required></label>
      <label>Até <input type="date" name="to" value="${today()}" required></label>
      <label>Clínica <select name="clinic">${option('', 'Todas')}${clinicOptions(clinics)}</select></label>
      <label>Estado <select name="status">${option('', 'Todos')}${[...states, 'done', 'honorarios_dispensados', 'rescheduled'].map(state => option(state, label(state))).join('')}</select></label>
      <button type="submit">Consultar</button>
      <label>Secretária <select name="secretary">${option('', 'Todas')}</select></label>
    </form>
    <p role="status"></p>
    <ul></ul>`;
  const form = details.querySelector('form');
  const list = details.querySelector('ul');
  const message = details.querySelector('[role=status]');
  const fields = form.elements;
  const submit = form.querySelector('button');
  let rows = [];
  function render() {
    list.replaceChildren();
    for (const row of rows.filter(item => !fields.secretary.value || item.user_id === fields.secretary.value)) {
      const item = document.createElement('li');
      item.textContent = `${row.secretary} · ${row.clinic_name} · ${label(row.status)} · ${row.total}`;
      list.append(item);
    }
  }
  fields.secretary.onchange = render;
  form.onsubmit = async event => {
    event.preventDefault();
    if (submit.disabled) return;
    submit.disabled = true;
    message.textContent = 'A calcular…';
    list.replaceChildren();
    fields.secretary.disabled = true;
    try {
      rows = await request('report', {
        from: fields.from.value, to: fields.to.value, clinic_id: fields.clinic.value || null,
        status: fields.status.value || null
      });
      const secretaries = new Map(rows.map(row => [row.user_id, row.secretary]));
      const selected = fields.secretary.value;
      fields.secretary.innerHTML = option('', 'Todas');
      for (const [id, name] of secretaries) fields.secretary.add(new Option(name, id));
      fields.secretary.value = secretaries.has(selected) ? selected : '';
      render();
      message.textContent = rows.length ? '' : 'Sem marcações neste período.';
    } catch (error) {
      rows = [];
      message.textContent = error.message;
    } finally {
      submit.disabled = fields.secretary.disabled = false;
    }
  };
  host.append(details);
}
