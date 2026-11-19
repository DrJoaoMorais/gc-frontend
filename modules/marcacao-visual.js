import { icon } from './agenda-icons.js';

// Apresentação partilhada. Os campos originais conservam valores e eventos.
export function modalStyles() {
  if (document.getElementById('gcBookingStyles')) return;
  const font = document.createElement('link');
  font.rel = 'stylesheet';
  font.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600&display=swap';
  document.head.append(font);
  const css = document.createElement('link');
  css.id = 'gcBookingStyles'; css.rel = 'stylesheet';
  css.href = new URL('./marcacao-visual.css', import.meta.url).href;
  document.head.append(css);
}
function heading(text, symbol) {
  const h = document.createElement('h2'); h.className = 'gm-heading';
  h.innerHTML = icon(symbol); h.append(document.createTextNode(text)); return h;
}
function section(text, symbol, ...nodes) {
  const el = document.createElement('section'); el.className = 'gm-section';
  el.append(heading(text, symbol), ...nodes.filter(Boolean)); return el;
}
function grid(...nodes) {
  const el = document.createElement('div'); el.className = 'gm-grid';
  el.append(...nodes.filter(Boolean)); return el;
}
function prepare(overlay, title) {
  modalStyles(); overlay.classList.add('gm-overlay');
  const panel = overlay.firstElementChild; panel.classList.add('gm-panel');
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', title);
  panel.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const controls = [...panel.querySelectorAll('button,input,select,textarea,a[href]')]
      .filter(el => !el.disabled && !el.hidden && el.getClientRects().length);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  return panel;
}
function labelFields(panel) {
  panel.querySelectorAll('input,select,textarea').forEach(input => {
    const label = input.parentElement.querySelector('label');
    if (label && input.id) label.htmlFor = input.id;
  });
}
export function styleAppointment(overlay, clinicName) {
  const panel = prepare(overlay, 'Nova marcação');
  const [header, body, footer] = panel.children;
  header.classList.add('gm-header'); body.classList.add('gm-body'); footer.classList.add('gm-footer');
  header.firstElementChild.firstElementChild.classList.add('gm-title');
  header.firstElementChild.firstElementChild.insertAdjacentHTML('afterbegin', icon('calendar'));
  const $ = id => panel.querySelector('#'+id);
  $('btnCloseModal').setAttribute('aria-label','Fechar marcação');
  const patient = $('mPatientWrap');
  patient.querySelector('label').remove();
  const newPatientButton = $('btnNewPatient');
  const patientSection = section('1. Doente','user',patient);
  patientSection.firstElementChild.append(newPatientButton);
  patient.firstElementChild.style.gridTemplateColumns = '1fr';
  const proc = $('mProc');
  const cards = document.createElement('div'); cards.className = 'gm-procedures';
  for (const option of proc.options) {
    if (!option.value) continue;
    const name = option.textContent.replace(/^[^\p{L}\p{N}]+/u,'').trim();
    const symbol = /reavalia|revalida/i.test(name) ? 'refresh' : /plasma/i.test(name) ? 'drop' : /visco/i.test(name) ? 'syringe' : /tele/i.test(name) ? 'video' : /primeira/i.test(name) ? 'calendar' : 'file';
    const button = document.createElement('button'); button.type = 'button';
    button.className = 'gm-procedure'; button.dataset.value = option.value;
    button.innerHTML = icon(symbol); button.append(document.createTextNode(name));
    button.addEventListener('click', () => { proc.value = option.value; proc.dispatchEvent(new Event('change',{bubbles:true})); });
    cards.append(button);
  }
  const refresh = () => cards.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed',String(b.dataset.value === proc.value)));
  proc.addEventListener('change',refresh); refresh(); proc.hidden = true;
  const procedureSection = section('2. Tipo de consulta / procedimento','file',proc,cards,$('mProcOtherWrap'),$('mMeetWrap'));
  const start = $('mStart'); start.hidden = true;
  const dateField = document.createElement('div');
  dateField.innerHTML = '<label for="gmDate">Data</label><input id="gmDate" type="date">';
  const timeField = document.createElement('div');
  timeField.innerHTML = '<label for="gmTime">Hora de início</label><input id="gmTime" type="time">';
  const date = dateField.lastElementChild, time = timeField.lastElementChild;
  const subtitle = header.firstElementChild.lastElementChild;
  let editingDateTime = false;
  function updateSubtitle() {
    const d = date.value ? new Date(date.value+'T12:00:00') : null;
    subtitle.textContent = [d?.toLocaleDateString('pt-PT',{weekday:'short',day:'numeric',month:'short',year:'numeric'}),time.value,clinicName].filter(Boolean).join(' · ');
  }
  function fromStart() {
    // Não reescrever campos durante uma edição parcial: apagar a hora
    // não pode apagar a data nem interromper a escrita dos minutos.
    if (!editingDateTime) {
      const [day = '', hour = ''] = (start.value || '').split('T');
      date.value = day;
      time.value = hour;
    }
    updateSubtitle();
  }
  function toStart() {
    const value = date.value && time.value ? date.value+'T'+time.value : '';
    if (start.value !== value) {
      start.value = value;
      editingDateTime = true;
      try { start.dispatchEvent(new Event('change',{bubbles:true})); }
      finally { editingDateTime = false; }
    }
    updateSubtitle();
  }
  for (const input of [date,time]) {
    input.addEventListener('input',toStart);
    input.addEventListener('change',toStart);
  }
  start.addEventListener('change',fromStart); fromStart();
  const duration = $('mDuration').parentElement;
  const provider = $('mProvider').parentElement;
  const when = section('3. Quando','clock',grid(dateField,timeField,duration),start,provider,$('mAvisoTurno'));
  const notes = $('mNotes'); notes.rows = 3; notes.placeholder = 'Adicionar nota para esta marcação…';
  const noteSection = section('4. Nota','file',notes);
  noteSection.firstElementChild.id = 'gmNoteTitle'; notes.setAttribute('aria-labelledby','gmNoteTitle');
  const clinic = $('mClinic'), status = $('mStatus'); clinic.hidden = true; status.hidden = true;
  body.replaceChildren(patientSection,procedureSection,when,noteSection,clinic,status);
  $('btnSave').textContent = 'Agendar consulta'; $('btnSave').classList.add('gm-primary');
  labelFields(panel);
  queueMicrotask(() => { if (panel.isConnected) panel.querySelector('input:not([hidden])')?.focus(); });
}
export function stylePatient(overlay, appointmentContext) {
  const panel = prepare(overlay,'Novo doente');
  const [header,body] = panel.children; header.classList.add('gm-header'); body.classList.add('gm-body');
  header.firstElementChild.firstElementChild.classList.add('gm-title');
  header.firstElementChild.firstElementChild.insertAdjacentHTML('afterbegin',icon('user'));
  const $ = id => panel.querySelector('#'+id);
  const personal = section('1. Dados pessoais','user',$('npFullName').parentElement,$('npDob').parentElement.parentElement);
  personal.lastElementChild.className = 'gm-grid';
  const identification = $('npSNS').parentElement.parentElement.parentElement;
  identification.firstElementChild.replaceWith(heading('2. Identificação','file'));
  identification.className = 'gm-section'; identification.lastElementChild.className = 'gm-grid gm-four';
  const insurance = $('npInsuranceProvider').parentElement.parentElement.parentElement;
  insurance.firstElementChild.replaceWith(heading('Seguro','shield'));
  insurance.className = 'gm-insurance'; insurance.lastElementChild.className = 'gm-grid gm-two';
  identification.append(insurance);
  const address = $('npAddress1').parentElement.parentElement;
  address.firstElementChild.replaceWith(heading('3. Morada','pin')); address.className = 'gm-section';
  address.lastElementChild.className = 'gm-grid';
  const patientNotes = $('npNotes'); patientNotes.placeholder = 'Notas sobre o doente…';
  const notes = section('4. Notas','file',patientNotes);
  notes.firstElementChild.id = 'gmPatientNotesTitle'; patientNotes.setAttribute('aria-labelledby','gmPatientNotesTitle');
  const duplicates = $('npDuplicateBox');
  body.replaceChildren(personal,identification,address,notes,duplicates);
  const actions = header.lastElementChild;
  const footer = document.createElement('div'); footer.className = 'gm-footer';
  const message = $('npMsg'), cancel = $('npCancel'), create = $('npCreate');
  message.setAttribute('role','status'); create.classList.add('gm-primary');
  create.textContent = appointmentContext ? 'Criar e selecionar' : 'Gravar'; cancel.textContent = 'Cancelar';
  footer.append(message,cancel,create); actions.remove(); panel.append(footer);
  const close = document.createElement('button'); close.id = 'npMainClose'; close.type = 'button'; close.textContent = '×'; close.setAttribute('aria-label','Fechar novo doente'); header.append(close);
  for (const id of ['npDob', 'npPhone']) {
    const input = $(id);
    const label = input.previousElementSibling;
    // Pedidos online mantêm a indicação obrigatória já existente.
    if (label.textContent.includes('*')) continue;
    const hint = document.createElement('small');
    hint.className = 'gm-recommendation';
    hint.id = id + 'Recommendation';
    hint.textContent = id === 'npDob'
      ? 'Recomenda-se preencher a data de nascimento.'
      : 'Recomenda-se preencher o número de telefone.';
    input.after(hint);
    input.setAttribute('aria-describedby', hint.id);
    const updateHint = () => { hint.hidden = Boolean(input.value.trim()); };
    input.addEventListener('input', updateHint);
    input.addEventListener('change', updateHint);
    queueMicrotask(updateHint);
  }
  labelFields(panel);
  queueMicrotask(() => { if (panel.isConnected) panel.querySelector('input:not([hidden])')?.focus(); });
}
