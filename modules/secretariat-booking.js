import { escapeHtml as escape } from './helpers.js';
import { statusMeta } from './state.js';
import { openApptModal } from './agenda.js?v=20261118-clinica-marcacao';
import { agendaWorkspaceHTML } from './agenda-workspace.js?v=2026-10-06-agenda-messages-v1';
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
  const root = document.getElementById('appRoot') || document.body;
  const defaultClinic = clinics.find(clinic => clinic.name.trim().toLocaleLowerCase('pt-PT') === 'novo cuidar');
  if (defaultClinic) clinics = [defaultClinic, ...clinics.filter(clinic => clinic !== defaultClinic)];
  root.innerHTML = `<main class="gc-secretariat-agenda" style="padding:16px">
    <button type="button" id="btnLogout" class="gcBtnGhost">Sair</button>
    ${agendaWorkspaceHTML()}
  </main><div id="modalRoot"></div>`;

  const viewClinic = root.querySelector('#selClinic');
  viewClinic.hidden = false;
  viewClinic.className = 'gcSelect';
  viewClinic.setAttribute('aria-label', 'Clínica');
  viewClinic.innerHTML = clinicOptions(clinics);
  root.querySelector('#awClinicPicker').replaceWith(viewClinic);
  for (const selector of ['.aw-search-group', '#btnNewPatientMain', '#awFinance', '.aw-schedule-actions',
    '#btnWeek', '#btnCal', '#awDay', '.aw-pending', '#awDocuments', '.aw-messages']) {
    root.querySelector(selector)?.remove();
  }
  const viewDay = root.querySelector('#awDate');
  viewDay.value = today();
  const message = root.querySelector('#agendaStatus');
  const list = root.querySelector('#agendaList');
  const subtitle = root.querySelector('#agendaSubtitle');
  let rendering = 0;

  async function loadDay() {
    const revision = ++rendering;
    list.replaceChildren();
    if (!viewDay.value) { message.textContent = 'Escolhe um dia.'; return; }
    subtitle.textContent = new Date(viewDay.value + 'T12:00:00').toLocaleDateString('pt-PT', { dateStyle: 'full' });
    message.textContent = 'A carregar marcações…';
    try {
      const rows = await request('day', { clinic_id: viewClinic.value, from: viewDay.value });
      if (revision !== rendering) return;
      for (const row of rows) {
        const item = document.createElement('li');
        item.className = 'aw-row';
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

  function openEditor(row = null) {
    const clinicId = row ? viewClinic.value : defaultClinic?.id || viewClinic.value;
    let creationRequest;
    openApptModal({
      mode: row ? 'edit' : 'new',
      row: row ? { ...row, clinic_id: clinicId } : undefined,
      prefillClinicId: clinicId,
      bookingOnly: {
        clinics,
        start: (row ? dateParts.format(new Date(row.start_at)) : `${viewDay.value || today()} 09:00`).replace(' ', 'T'),
        duration: row ? Math.round((Date.parse(row.end_at) - Date.parse(row.start_at)) / 60000) :
          clinics.find(clinic => clinic.id === clinicId)?.duration || 20,
        states: states.filter(state => state !== 'confirmed' || row?.status === state)
          .map(state => ({ value: state, label: label(state) })),
        search: (clinic, query) => request('patients', { clinic_id: clinic, query }),
        async save({ clinic, start, duration, patient, procedure, status }) {
          const [day, hour] = start.split('T');
          if (!day || !hour) throw new Error('Indica a data e a hora.');
          const args = { clinic_id: clinic, start_at: lisbonInstant(day, hour), duration };
          if (row) Object.assign(args, { id: row.id, updated_at: row.updated_at, status });
          else {
            Object.assign(args, { patient_id: patient, procedure_type: procedure.replace(/^[^\p{L}]+/u, '').trim() });
            const signature = JSON.stringify(args);
            if (creationRequest?.signature !== signature) creationRequest = { signature, id: crypto.randomUUID() };
            args.request_id = creationRequest.id;
          }
          await request('save', args);
          viewClinic.value = clinic;
          viewDay.value = day;
          await loadDay();
        }
      }
    });
  }
  function changeDay(offset) {
    const day = new Date((viewDay.value || today()) + 'T12:00:00Z');
    day.setUTCDate(day.getUTCDate() + offset);
    viewDay.value = day.toISOString().slice(0, 10);
    return loadDay();
  }
  viewClinic.onchange = viewDay.onchange = loadDay;
  root.querySelector('#btnPrevDay').onclick = () => changeDay(-1);
  root.querySelector('#btnNextDay').onclick = () => changeDay(1);
  root.querySelector('#btnToday').onclick = () => { viewDay.value = today(); return loadDay(); };
  root.querySelector('#btnNewAppt').onclick = () => openEditor();
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
