import { escapeHtml as escape } from './helpers.js';
import { statusMeta } from './state.js';
import { openApptModal } from './agenda.js?v=20261119-pesquisa-agenda';
import { appointmentCard } from './agenda-workspace.js?v=2026-10-06-agenda-messages-v1';
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
  const root = document.getElementById('gcAgendaWorkspace');
  const defaultClinic = clinics.find(clinic => clinic.name.trim().toLocaleLowerCase('pt-PT') === 'novo cuidar');
  if (defaultClinic) clinics = [defaultClinic, ...clinics.filter(clinic => clinic !== defaultClinic)];

  const viewClinic = root.querySelector('#selClinic');
  viewClinic.hidden = false;
  viewClinic.className = 'gc-select';
  viewClinic.setAttribute('aria-label', 'Clínica da agenda');
  viewClinic.innerHTML = clinicOptions(clinics);
  root.querySelector('#awClinicPicker').append(viewClinic);
  for (const selector of ['#btnNewPatientMain', '#awFinance', '.aw-schedule-actions',
    '.aw-pending', '#awDocuments', '.aw-messages']) {
    root.querySelector(selector)?.remove();
  }
  const viewDay = root.querySelector('#awDate');
  viewDay.value = today();
  const message = root.querySelector('#agendaStatus');
  const list = root.querySelector('#agendaList');
  const subtitle = root.querySelector('#agendaSubtitle');
  root.classList.add('aw-booking-only');
  const buttons = { day: '#awDay', week: '#btnWeek', month: '#btnCal' };
  const calendar = document.createElement('div');
  calendar.className = 'aw-booking-calendar';
  list.parentElement.before(calendar);
  let view = 'day';
  let rendering = 0;

  async function renderPeriod(revision) {
    const selected = new Date(viewDay.value + 'T12:00:00Z');
    const first = new Date(selected);
    const month = view === 'month';
    if (month) first.setUTCDate(1);
    else first.setUTCDate(first.getUTCDate() - (first.getUTCDay() + 6) % 7);
    const length = month ? new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate() : 7;
    const days = Array.from({ length }, (_, offset) => {
      const date = new Date(first);
      date.setUTCDate(date.getUTCDate() + offset);
      return date.toISOString().slice(0, 10);
    });
    const clinicId = viewClinic.value;
    const captions = new Intl.DateTimeFormat('pt-PT', { weekday: 'short', day: 'numeric', month: 'short', timeZone });
    calendar.style.setProperty('--first-day', String(month ? (first.getUTCDay() + 6) % 7 + 1 : 1));
    const cells = days.map(day => {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.dataset.agendaDate = day;
      cell.setAttribute('aria-current', day === viewDay.value ? 'date' : 'false');
      const label = document.createElement('strong');
      label.textContent = captions.format(new Date(day + 'T12:00:00Z'));
      cell.append(label);
      cell.onclick = () => { viewDay.value = day; return show('day'); };
      return cell;
    });
    calendar.replaceChildren(...cells);
    for (let offset = 0; offset < days.length; offset += 5) {
      if (revision !== rendering) return;
      const batch = await Promise.all(days.slice(offset, offset + 5).map(day =>
        request('day', { clinic_id: clinicId, from: day })));
      if (revision !== rendering) return;
      batch.forEach((rows, index) => {
        const cell = cells[offset + index];
        const summary = document.createElement('span');
        const bookings = rows.filter(row => row.mode !== 'bloqueio');
        summary.textContent = bookings.length === 1 ? '1 marcação' : `${bookings.length} marcações`;
        cell.append(summary);
        if (!month) {
          for (const row of rows) {
            const detail = document.createElement('span');
            detail.textContent = `${time.format(new Date(row.start_at))} · ${row.mode === 'bloqueio' ? 'Bloqueio' : row.patient_name || 'Doente'}`;
            cell.append(detail);
          }
        }
      });
    }
    if (revision === rendering) message.textContent = '';
  }

  function show(nextView) {
    view = nextView;
    for (const [mode, selector] of Object.entries(buttons)) {
      const button = root.querySelector(selector);
      button.classList.toggle('is-active', mode === view);
      button.setAttribute('aria-pressed', String(mode === view));
    }
    return loadDay();
  }

  async function loadDay() {
    const revision = ++rendering;
    list.replaceChildren();
    list.parentElement.hidden = view !== 'day';
    calendar.hidden = view === 'day';
    calendar.replaceChildren();
    if (!viewDay.value) { message.textContent = 'Escolhe um dia.'; return; }
    subtitle.textContent = new Date(viewDay.value + 'T12:00:00').toLocaleDateString('pt-PT', { dateStyle: 'full' });
    message.textContent = 'A carregar marcações…';
    try {
      if (view !== 'day') {
        await renderPeriod(revision);
        return;
      }
      const rows = await request('day', { clinic_id: viewClinic.value, from: viewDay.value });
      if (revision !== rendering) return;
      if (rows.length) {
        const headings = document.createElement('li');
        headings.className = 'aw-table-head';
        headings.innerHTML = '<span>Hora</span><span>Doente</span><span>Clínica</span><span>Estado</span><span></span>';
        list.append(headings);
      }
      const clinic = clinics.find(clinic => clinic.id === viewClinic.value);
      for (const row of rows) {
        const period = `${time.format(new Date(row.start_at))}–${time.format(new Date(row.end_at))}`;
        const card = document.createElement('template');
        card.innerHTML = appointmentCard(row, {
          patient: { full_name: row.patient_name },
          time: period,
          clinic: clinic?.name,
          procedure: row.procedure_type,
          statusHTML: `<span class="aw-status">${escape(label(row.status))}</span>`
        });
        const item = card.content.firstElementChild;
        const patient = item.querySelector('[data-patient-open]');
        if (patient) {
          const name = document.createElement('strong');
          name.textContent = patient.textContent;
          patient.replaceWith(name);
        }
        item.querySelectorAll('[data-aw-rgpd], [data-aw-ft], [data-aw-docs]').forEach(button => button.remove());
        const edit = item.querySelector('[data-aw-edit]');
        if (editable(row)) edit.onclick = () => openEditor(row);
        else edit.remove();
        list.append(item);
      }
      message.textContent = rows.length ? `${rows.length} marcação(ões).` : 'Sem marcações para este dia.';
    } catch (error) {
      if (revision === rendering) message.textContent = error.message;
    }
  }

  const query = root.querySelector('#pQuickQuery');
  const results = root.querySelector('#pQuickResults');
  query.placeholder = 'Pesquisar doente por nome…';
  query.setAttribute('aria-label', 'Pesquisar doente por nome');
  results.setAttribute('aria-live', 'polite');
  let searchRevision = 0;
  let searchTimer;

  function clearResults() {
    ++searchRevision;
    clearTimeout(searchTimer);
    results.replaceChildren();
    results.style.display = 'none';
  }

  function searchPatients(clinic, term) {
    return request('patients', { clinic_id: clinic, query: term });
  }

  query.onkeydown = event => {
    if (event.key === 'Escape') clearResults();
  };
  query.oninput = () => {
    clearResults();
    const term = query.value.trim();
    if (term.length < 3) return;
    const revision = searchRevision;
    const clinic = viewClinic.value;
    searchTimer = setTimeout(async () => {
      try {
        const matches = await searchPatients(clinic, term);
        if (revision !== searchRevision || !root.isConnected) return;
        results.style.display = 'block';
        if (!matches.length) results.textContent = 'Sem resultados nesta clínica.';
        for (const patient of matches) {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = [patient.full_name, patient.dob?.split('-').reverse().join('/')].filter(Boolean).join(' · ');
          button.onclick = () => {
            query.value = '';
            clearResults();
            openEditor(null, patient);
          };
          results.append(button);
        }
      } catch {
        if (revision !== searchRevision || !root.isConnected) return;
        results.style.display = 'block';
        results.textContent = 'Não foi possível pesquisar. Tenta novamente.';
      }
    }, 250);
  };

  function openEditor(row = null, patient = null) {
    const clinicId = row || patient ? viewClinic.value : defaultClinic?.id || viewClinic.value;
    let creationRequest;
    openApptModal({
      mode: row ? 'edit' : 'new',
      row: row ? { ...row, clinic_id: clinicId } : undefined,
      prefillClinicId: clinicId,
      prefillPatientId: patient?.id,
      prefillPatientName: patient?.full_name,
      bookingOnly: {
        clinics,
        start: (row ? dateParts.format(new Date(row.start_at)) : `${viewDay.value || today()} 09:00`).replace(' ', 'T'),
        duration: row ? Math.round((Date.parse(row.end_at) - Date.parse(row.start_at)) / 60000) :
          clinics.find(clinic => clinic.id === clinicId)?.duration || 20,
        states: states.filter(state => state !== 'confirmed' || row?.status === state)
          .map(state => ({ value: state, label: label(state) })),
        search: searchPatients,
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
    if (view === 'month') {
      day.setUTCDate(1);
      day.setUTCMonth(day.getUTCMonth() + offset);
    } else day.setUTCDate(day.getUTCDate() + offset * (view === 'week' ? 7 : 1));
    viewDay.value = day.toISOString().slice(0, 10);
    return loadDay();
  }
  viewDay.onchange = loadDay;
  viewClinic.onchange = () => {
    query.value = '';
    clearResults();
    return loadDay();
  };
  root.querySelector('#btnPrevDay').onclick = () => changeDay(-1);
  root.querySelector('#btnNextDay').onclick = () => changeDay(1);
  root.querySelector('#btnToday').onclick = () => { viewDay.value = today(); return loadDay(); };
  root.querySelector('#btnNewAppt').onclick = () => openEditor();
  await wireLogout({ checkPending: false });
  for (const [mode, selector] of Object.entries(buttons)) {
    root.querySelector(selector).onclick = () => show(mode);
  }
  await show('day');
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
