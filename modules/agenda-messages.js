import { G } from './state.js';
import { escapeHtml as e } from './helpers.js';

export function messagesHTML() {
  return `<section class="aw-messages" aria-label="Mensagens e tarefas"><div><strong id="awMessageTitle">Mensagens e tarefas</strong><div><button id="awMessagesAll" disabled>Ver todas</button><button id="awMessageNew" aria-expanded="false" aria-controls="awMessageComposer" disabled>+ Nova mensagem</button></div></div><div id="awMessageComposer"></div><div id="awMessageList" aria-live="polite"></div></section>`;
}
export function activeMessageClinic() {
  // Multi-clinic appointment views never become message channels.
  const ids = G.agendaClinicIds;
  if (Array.isArray(ids) && (ids.length !== 1 || String(ids[0]) !== String(G.activeClinicId))) return null;
  return G.activeClinicId || null;
}
const queryOK = async query => { const { data, error } = await query; if (error) throw error; return data || []; };
export async function messageMembers(clinicId) {
  return queryOK(window.sb.rpc('agenda_message_members', {p_clinic_id: clinicId}));
}
export async function messagePatients(clinicId, term) {
  if (term.trim().length < 2) return [];
  const text = term.trim().replace(/[\\%_]/g, '\\$&');
  return queryOK(window.sb.from('patient_clinic').select('patient_id,patients!inner(id,full_name)').eq('clinic_id', clinicId).ilike('patients.full_name', `%${text}%`).order('patient_id').limit(20));
}
export async function messageRows(clinicId, offset = 0, count = 3, includeHidden = false) {
  let query = window.sb.from('agenda_messages').select('id,clinic_id,author_id,recipient_id,patient_id,body,is_task,status,hidden_from_home,created_at,patients(full_name)').eq('clinic_id', clinicId);
  if (!includeHidden) query = query.eq('hidden_from_home', false);
  return queryOK(query.order('created_at', {ascending:false}).order('id', {ascending:false}).range(offset, offset + count - 1));
}
export async function sendMessage(clinicId, input) {
  if (!clinicId || activeMessageClinic() !== clinicId) throw new Error('A clínica mudou. Abra novamente a mensagem.');
  const body = input.body.trim();
  if (!input.recipient_id || !body || body.length > 5000) throw new Error('Selecione o destinatário e escreva a mensagem (até 5000 caracteres).');
  return queryOK(window.sb.from('agenda_messages').insert({clinic_id:clinicId,recipient_id:input.recipient_id,patient_id:input.patient_id || null,body,is_task:!!input.is_task}).select('id'));
}
let request = 0;
let currentDialog = null;
let currentComposer = null;
function clinicName(id) { const c = G.clinicsById?.[id] || G.clinics?.find(c => c.id === id); return c?.display_name || c?.name || 'Clínica'; }
function dialog(title, content) {
  currentDialog?.remove();
  const d = document.createElement('dialog');
  d.className = 'aw-message-dialog';
  d.innerHTML = `<header><strong>${e(title)}</strong><button type="button" data-close aria-label="Fechar">×</button></header>${content}`;
  document.body.append(d); currentDialog = d;
  const close = () => { d.close(); d.remove(); if (currentDialog === d) currentDialog = null; };
  d.querySelector('[data-close]').onclick = close;
  d.addEventListener('cancel', ev => { ev.preventDefault(); close(); });
  d.querySelector('[data-cancel]')?.addEventListener('click', close);
  d.showModal();
  return {d, close};
}
function openRow(row, clinicId) {
  if (activeMessageClinic() !== clinicId) return;
  if (row.patient_id) {
    if (currentDialog) { currentDialog.close(); currentDialog.remove(); currentDialog = null; }
    if (typeof window.__gc_openFeedPanel === 'function') window.__gc_openFeedPanel(row.patient_id, clinicId);
    else window.open(`/modules/consulta/v2/consulta-completa/feed-doente.html?patientId=${encodeURIComponent(row.patient_id)}&sessionClinicId=${encodeURIComponent(clinicId)}`, '_blank', 'noopener');
  } else dialog('Mensagem · ' + clinicName(clinicId), `<p class="aw-message-body">${e(row.body)}</p>`);
}
function renderRows(host, rows, members, clinicId, home = false) {
  host.replaceChildren();
  if (!rows.length) { host.textContent = 'Sem mensagens nesta clínica.'; return; }
  const names = new Map(members.map(m => [m.user_id, m.display_name || 'Utilizador da clínica']));
  for (const row of rows) {
    const el = document.createElement('div'); el.className = 'aw-message-row';
    const stamp = new Intl.DateTimeFormat('pt-PT', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(row.created_at));
    el.innerHTML = `<time>${e(stamp)}</time><div class="aw-message-text"><strong>${e(names.get(row.author_id) || 'Utilizador da clínica')}</strong><small>Para ${e(names.get(row.recipient_id) || 'Utilizador da clínica')}${row.is_task?' · Tarefa':''}</small>${row.patient_id?`<strong>${e(row.patients?.full_name || 'Doente associado')}</strong>`:''}<p>${e(row.body)}</p></div><button data-status aria-label="${row.status==='resolved'?'Reabrir':'Resolver'} mensagem">${row.status==='resolved'?'✓ Resolvido':'Por tratar'}</button><button data-open>Abrir</button>${home ? `<button data-retire ${row.status==='resolved'?'':'hidden'} title="Retirar da página inicial">Retirar</button>` : ''}`;
    el.querySelector('[data-open]').onclick = () => openRow(row, clinicId);
    el.querySelector('[data-status]').onclick = async ev => {
      if (activeMessageClinic() !== clinicId) return;
      const button = ev.currentTarget; button.disabled = true;
      try {
        const status = row.status === 'resolved' ? 'pending' : 'resolved';
        const updated = await queryOK(window.sb.from('agenda_messages').update({status, hidden_from_home:false}).eq('clinic_id', clinicId).eq('id',row.id).select('id'));
        if (!updated.length) throw new Error('Sem permissão para alterar esta mensagem.');
        if (activeMessageClinic() !== clinicId || !host.isConnected) return;
        row.status = status; row.hidden_from_home = false;
        if (home) el.querySelector('[data-retire]').hidden = status !== 'resolved';
        else void refreshAgendaMessages();
        button.textContent = status==='resolved'?'✓ Resolvido':'Por tratar';
        button.setAttribute('aria-label',status==='resolved'?'Reabrir mensagem':'Resolver mensagem');
      } catch { alert('Não foi possível alterar o estado da mensagem.'); }
      finally { button.disabled = false; }
    };
    el.querySelector('[data-retire]')?.addEventListener('click', async ev => {
      if (activeMessageClinic() !== clinicId || row.status !== 'resolved') return;
      const button = ev.currentTarget; button.disabled = true;
      el.querySelector('[data-status]').disabled = true;
      try {
        const updated = await queryOK(window.sb.from('agenda_messages').update({hidden_from_home:true}).eq('clinic_id',clinicId).eq('id',row.id).eq('status','resolved').select('id'));
        if (!updated.length) throw new Error('Mensagem não resolvida ou sem permissão.');
        if (activeMessageClinic() === clinicId) await refreshAgendaMessages();
      } catch { alert('Não foi possível retirar a mensagem da página inicial.'); }
      finally { button.disabled = false; el.querySelector('[data-status]').disabled = false; }
    });
    host.append(el);
  }
}
export async function refreshAgendaMessages() {
  const ticket = ++request;
  const clinicId = activeMessageClinic();
  // Remove old clinic content and any draft before waiting for new requests.
  if (currentDialog && currentDialog.dataset.clinic !== (clinicId || '')) { currentDialog.close(); currentDialog.remove(); currentDialog = null; }
  if (currentComposer && (!currentComposer.isConnected || currentComposer.dataset.clinic !== (clinicId || ''))) { currentComposer.remove(); currentComposer = null; }
  const host = document.getElementById('awMessageList'); if (!host) return;
  const title = document.getElementById('awMessageTitle');
  title.textContent = 'Mensagens e tarefas · ' + (clinicId ? clinicName(clinicId) : 'Selecione uma clínica');
  const create = document.getElementById('awMessageNew'), all = document.getElementById('awMessagesAll');
  create.disabled = all.disabled = true;
  create.setAttribute('aria-expanded', String(!!currentComposer?.isConnected));
  host.textContent = clinicId ? 'A carregar mensagens…' : 'Selecione uma única clínica para ver ou enviar mensagens.';
  if (!clinicId) return;
  try {
    const [rows, members] = await Promise.all([messageRows(clinicId), messageMembers(clinicId)]);
    if (ticket !== request || !host.isConnected || activeMessageClinic() !== clinicId) return;
    renderRows(host, rows, members, clinicId, true);
    all.disabled = false;
    create.disabled = !!currentComposer?.isConnected;
    create.onclick = () => newMessage(clinicId, members);
    all.onclick = () => allMessages(clinicId, members);
  } catch {
    if (ticket === request && host.isConnected) host.textContent = 'Não foi possível carregar as mensagens desta clínica.';
  }
}
async function allMessages(clinicId, members) {
  if (activeMessageClinic() !== clinicId) return;
  const {d} = dialog('Mensagens e tarefas · ' + clinicName(clinicId), '<div data-rows></div><p data-error role="status"></p><button data-more>Ver mais</button>');
  d.dataset.clinic = clinicId;
  let offset = 0; const rows = []; const more = d.querySelector('[data-more]');
  const load = async () => {
    more.disabled = true;
    try {
      const batch = await messageRows(clinicId, offset, 30, true);
      if (!d.isConnected || activeMessageClinic() !== clinicId) return;
      rows.push(...batch); offset += batch.length;
      renderRows(d.querySelector('[data-rows]'), rows, members, clinicId);
      more.hidden = batch.length < 30; d.querySelector('[data-error]').textContent = '';
    } catch { if(d.isConnected) d.querySelector('[data-error]').textContent = 'Não foi possível carregar as mensagens.'; }
    finally { more.disabled = false; }
  };
  more.onclick = load; await load();
}
function newMessage(clinicId, members) {
  if (activeMessageClinic() !== clinicId) return;
  const host = document.getElementById('awMessageComposer');
  if (!host) return;
  if (currentComposer?.isConnected) { currentComposer.querySelector('select')?.focus(); return; }
  const d = document.createElement('div');
  d.className = 'aw-message-composer';
  d.innerHTML = `<form aria-label="Nova mensagem"><label>Para<select name="recipient" required><option value="">Selecionar pessoa</option>${members.map(m=>`<option value="${e(m.user_id)}">${e(m.display_name || 'Utilizador da clínica')}</option>`).join('')}</select></label><label>Doente <small>(opcional)</small><input name="patientSearch" type="search" placeholder="Procurar doente…" autocomplete="off"></label><div data-patients></div><p data-selected></p><label>Mensagem<textarea name="body" required maxlength="5000" rows="4"></textarea></label><label class="aw-message-task"><input name="task" type="checkbox"> Marcar como tarefa</label><p data-error role="alert"></p><footer><button type="button" data-cancel>Cancelar</button><button type="submit">Enviar</button></footer></form>`;
  host.append(d); currentComposer = d;
  const create = document.getElementById('awMessageNew');
  create.disabled = true; create.setAttribute('aria-expanded', 'true');
  const close = () => {
    d.remove();
    if (currentComposer !== d) return;
    currentComposer = null;
    if (create.isConnected && activeMessageClinic() === clinicId) { create.disabled = false; create.setAttribute('aria-expanded', 'false'); }
  };
  d.querySelector('[data-cancel]').onclick = () => { close(); create.focus(); };
  d.dataset.clinic = clinicId;
  const form = d.querySelector('form'); form.elements.recipient.focus();
  let patientId = null, searchTicket = 0, timer;
  form.elements.patientSearch.oninput = () => {
    patientId = null; d.querySelector('[data-selected]').textContent = '';
    const ticket = ++searchTicket; clearTimeout(timer);
    const results = d.querySelector('[data-patients]'); results.replaceChildren();
    timer = setTimeout(async () => {
      try {
        const matches = await messagePatients(clinicId, form.elements.patientSearch.value);
        if (ticket !== searchTicket || !d.isConnected || activeMessageClinic() !== clinicId) return;
        if (!matches.length && form.elements.patientSearch.value.trim().length >= 2) results.textContent = 'Sem doentes encontrados nesta clínica.';
        for (const match of matches) {
          const b = document.createElement('button'); b.type='button'; b.textContent=match.patients.full_name;
          b.onclick=()=>{patientId=match.patient_id; ++searchTicket; form.elements.patientSearch.value=match.patients.full_name; results.replaceChildren(); d.querySelector('[data-selected]').textContent='Doente selecionado: '+match.patients.full_name;}; results.append(b);
        }
      } catch { if(ticket===searchTicket && d.isConnected) results.textContent='Não foi possível pesquisar doentes.'; }
    }, 250);
  };
  form.onsubmit = async ev => {
    ev.preventDefault(); const button = form.querySelector('[type=submit]'); button.disabled = true;
    try {
      if(form.elements.patientSearch.value.trim() && !patientId) throw new Error('Selecione um doente da lista ou deixe a pesquisa vazia.');
      await sendMessage(clinicId,{recipient_id:form.elements.recipient.value,patient_id:patientId,body:form.elements.body.value,is_task:form.elements.task.checked});
      close(); await refreshAgendaMessages();
    } catch (err) { if(d.isConnected) d.querySelector('[data-error]').textContent = err.message || 'Não foi possível enviar a mensagem.'; }
    finally { button.disabled = false; }
  };
}
