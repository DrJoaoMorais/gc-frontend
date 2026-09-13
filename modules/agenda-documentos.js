import { icon } from './agenda-icons.js';
import { G, statusMeta } from './state.js';
import { escapeHtml as e } from './helpers.js';
import { emailURL, whatsappURL } from './agenda-contactos.js';

let generation = 0;
export function closePatientDocuments() { generation++; }
const labels = { rgpd: 'RGPD', prp: 'Consentimento PRP', ah: 'Consentimento Ácido Hialurónico', acido_hialuronico: 'Consentimento Ácido Hialurónico', corticoide: 'Consentimento Corticosteróide' };
const date = value => value ? new Date(value).toLocaleDateString('pt-PT') : 'Sem data';
function safeURL(value) {
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : null; } catch { return null; }
}
// Paginação explícita: não limitar o histórico ao máximo de linhas de uma resposta.
async function allRows(query) {
  const rows = [];
  for (let offset = 0; ; offset += 200) {
    const { data, error } = await query().range(offset, offset + 199);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 200) return rows;
  }
}
export async function loadPatientResources(sb, patientId) {
  const sources = [
    ['Documentos', () => sb.from('documents').select('id,title,category,storage_path,created_at,clinic_id,consultation_id,status').eq('patient_id', patientId).order('created_at', { ascending: false }).order('id')],
    ['Consentimentos em papel', () => sb.from('consents').select('id,type,status,created_at,signed_at,storage_path,clinic_id').eq('patient_id', patientId).order('created_at', { ascending: false }).order('id')],
    ['Consentimentos digitais', () => sb.from('consent_tokens').select('id,document_type,status,created_at,signed_at,clinic_id').eq('patient_id', patientId).order('created_at', { ascending: false }).order('id')],
    ['Planos de exercício', () => sb.from('wo_prescriptions').select('id,token,status,expires_at,created_at,data,clinic_id').eq('patient_id', patientId).eq('status', 'active').order('created_at', { ascending: false }).order('id')],
    ['Consultas', () => sb.from('consultations').select('id,report_date,clinic_id,appointment_id').eq('patient_id', patientId).order('id')],
    ['Acompanhamento digital', () => sb.from('patient_portal_links').select('id,token,created_at,revoked_at,created_clinic_id').eq('patient_id', patientId).order('created_at', { ascending: false }).order('id')]
  ];
  const results = await Promise.allSettled(sources.map(([, query]) => allRows(query)));
  const warnings = [], items = [], consultations = new Map(), portals = [];
  results.forEach((result, i) => {
    if (result.status === 'rejected') { warnings.push(`${sources[i][0]}: não foi possível carregar. Verifique as permissões no processo do doente.`); return; }
    for (const row of result.value) {
      if (i === 4) { consultations.set(row.id, row); continue; }
      if (i === 5) {
        if (!row.revoked_at && row.token) portals.push(row);
        continue;
      }
      if (i === 3) {
        if (!row.token || (row.expires_at && new Date(row.expires_at) <= new Date())) continue;
        const sessions = row.data?.sessions || [];
        for (const [scope, title, predicate] of [
          ['activity', 'Exercício — atividade física', s => !String(s?.notes || '').startsWith('Origem:')],
          ['pathology', 'Exercício — por patologia', s => String(s?.notes || '').startsWith('Origem:')]
        ]) {
          if (sessions.some(predicate)) items.push({ ...row, key: `plan:${row.id}:${scope}`, title, scope, kind: 'link', url: `https://treino.joaomorais.pt/t/${encodeURIComponent(row.token)}?scope=${scope}` });
        }
      } else {
        const title = i === 0 ? row.title || row.category || 'Documento' : labels[row.type || row.document_type] || row.type || row.document_type || 'Consentimento';
        items.push({ ...row, key: `${i}:${row.id}`, title, kind: i === 2 ? 'digital' : 'file' });
      }
    }
  });
  // Mesmas condições de disponibilidade que o portal existente.
  await Promise.all(portals.map(async portal => {
    try {
      const { data: home, error } = await sb.rpc('get_acompanhamento_home', { p_token: portal.token });
      if (error || !home?.valid) return;
      const base = { clinic_id: portal.created_clinic_id, created_at: portal.created_at, kind: 'link' };
      if (home.diario?.enabled && home.diario.episode_token) items.push({...base, key: `diary:${portal.id}`, scope: 'diary', title: '📓 Diário', url: `https://gc.joaomorais.pt/diario?t=${encodeURIComponent(home.diario.episode_token)}&return=${encodeURIComponent(portal.token)}`});
      if (home.medicacao?.length) items.push({...base, key: `med:${portal.id}`, scope: 'med', title: '💊 Medicação', url: `https://gc.joaomorais.pt/acompanhamento?t=${encodeURIComponent(portal.token)}`});
      if (home.questionario?.pending && home.questionario.token) items.push({...base, key: `question:${portal.id}`, scope: 'question', title: '📋 Questionários', url: `https://gc.joaomorais.pt/intake.html?t=${encodeURIComponent(home.questionario.token)}`});
    } catch { warnings.push('Não foi possível confirmar os módulos do acompanhamento. Permanecem indisponíveis.'); }
  }));
  items.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  return { items, warnings, consultations };
}
export async function resourceURL(sb, item) {
  if (item.kind === 'link') return safeURL(item.url);
  if (item.kind === 'digital') {
    const { data, error } = await sb.from('consent_signatures').select('pdf_url').eq('token_id', item.id).not('pdf_url', 'is', null).limit(1);
    if (error) throw error;
    return safeURL(data?.[0]?.pdf_url);
  }
  if (!item.storage_path) return null;
  const { data, error } = await sb.storage.from('documents').createSignedUrl(item.storage_path, 3600);
  if (error) throw error;
  return safeURL(data?.signedUrl);
}

export function renderResourceGroups(items, consultations, row = {}) {
  const docs = items.filter(x => x.kind !== 'link');
  const todayIds = new Set([...consultations.values()].filter(c => c.appointment_id === row.id).map(c => c.id));
  const todayDocs = docs.filter(x => todayIds.has(x.consultation_id));
  const category = item => ['relatorio_consulta','relatorio-clinico','simples'].includes(item.category) ? 'Relatórios' : ['exames','analises'].includes(item.category) ? 'Exames' : ['atestado_doenca','atestado_edfisica','PRP','prp_visco'].includes(item.category) ? 'Atestados' : 'Outros';
  const meta = statusMeta(row.status);
  const time = iso => iso ? new Date(iso).toLocaleTimeString('pt-PT',{timeZone:'Europe/Lisbon',hour:'2-digit',minute:'2-digit'}) : '';
  return `<section class="aw-panel-card" data-panel-section="today"><div class="aw-card-title"><strong>Consulta do dia — ${e(date(row.start_at))}</strong><span class="aw-state" style="background:${meta.bg};color:${meta.fg}">${e(meta.label)}</span></div><p>${e(time(row.start_at))}${row.end_at?' – '+e(time(row.end_at)):''} · ${e(G.clinicsById[row.clinic_id]?.name || '')}</p>${row.notes?`<p class="aw-panel-note"><b>Notas:</b> ${e(row.notes)}</p>`:''}<div class="aw-actions">${todayDocs.map(item=>`<button data-open="${items.indexOf(item)}">${icon('file')}${e(item.title)}</button>`).join('')}<button data-process>＋ Abrir processo</button></div>${!todayDocs.length?'<small>Sem documentos associados a esta marcação.</small>':''}</section>
  <section class="aw-panel-card" data-panel-section="digital"><div class="aw-card-title"><strong>Acompanhamento digital</strong></div>${[['diary','Diário'],['activity','Atividade física e desportiva'],['pathology','Exercícios por patologia'],['med','Medicação'],['question','Questionários']].map(([scope,label])=>{
    const available = items.filter(x=>x.scope===scope);
    return `<div class="aw-digital"><b>${icon(scope==='diary'?'file':'calendar')}${label}</b>${available.length?available.map(item=>`<div class="aw-link-actions"><span class="aw-valid">✓ Link ativo</span><button data-open="${items.indexOf(item)}">Abrir</button><button data-link-copy="${items.indexOf(item)}" aria-label="Copiar link de ${label}">${icon('copy')}</button></div>`).join(''):'<span class="aw-unavailable">Indisponível</span>'}</div>`;
  }).join('')}</section>
  <section class="aw-panel-card" data-panel-section="documents"><div class="aw-card-title"><strong>Documentos</strong><button data-all-documents>Ver todos (${docs.length})</button></div><div class="aw-doc-filters">${['Todos','Relatórios','Exames','Atestados','Outros'].map((label,i)=>`<button data-doc-filter="${label}" class="${i?'':'is-active'}">${label}</button>`).join('')}</div><div data-doc-list>${docs.map((item,i)=>`<div class="aw-document" data-doc-category="${category(item)}" data-doc-history="${!todayIds.has(item.consultation_id)}" ${i>=5?'hidden':''}><input type="checkbox" aria-label="Selecionar ${e(item.title)}" data-resource="${items.indexOf(item)}">${icon('file')}<div><b>${e(item.title)}</b><small>${e(date(item.created_at))} · ${e(G.clinicsById[item.clinic_id]?.name||'')}${item.status==='arquivado'?' · Arquivado':''}${todayIds.has(item.consultation_id)?' · Consulta selecionada':' · Histórico'}</small></div><button data-open="${items.indexOf(item)}">Abrir</button></div>`).join('')||'<p>Sem documentos disponíveis.</p>'}</div></section>`;
}

export async function openPatientDocuments(row) {
  const host = document.getElementById('awDocuments');
  if (!host || !row) return;
  const request = ++generation;
  const context = { patientId: row.patient_id, appointmentId: row.id, clinicId: row.clinic_id };
  const current = () => request === generation && host.isConnected;
  host.hidden = false;
  host.innerHTML = '<p>A carregar documentação do doente…</p>';
  if (!context.patientId) { host.innerHTML = '<p>Esta marcação não tem doente associado.</p>'; return; }
  const patientPromise = window.sb.from('patients').select('id,full_name,phone,email').eq('id', context.patientId).maybeSingle();
  const [resources, patientResult] = await Promise.allSettled([loadPatientResources(window.sb, context.patientId), patientPromise]);
  if (!current()) return;
  const patient = patientResult.status === 'fulfilled' && !patientResult.value.error ? patientResult.value.data : null;
  const { items, warnings, consultations = new Map() } = resources.status === 'fulfilled' ? resources.value : { items: [], warnings: ['Não foi possível carregar a documentação.'] };
  if (!patient) warnings.push('Contactos indisponíveis. Não é possível preparar envio para o doente.');
  const clinic = G.clinicsById[context.clinicId]?.name || 'Clínica não identificada';
  host.innerHTML = `<div class="aw-patient-heading"><h2>${e(patient?.full_name || 'Documentação do doente')}</h2><button data-close aria-label="Fechar documentação">×</button></div><div class="aw-contact-lines"><span>${icon('clinic')}${e(clinic)}</span><span>${icon('phone')}${e(patient?.phone || 'Sem telefone')}</span><span>${icon('mail')}${e(patient?.email || 'Sem email')}</span></div><div class="aw-actions aw-contact-buttons">${whatsappURL(patient?.phone)?`<a class="aw-contact aw-whatsapp" href="${e(whatsappURL(patient.phone))}" target="_blank" rel="noopener noreferrer">${icon('whatsapp')} WhatsApp</a>`:''}${emailURL(patient?.email)?`<a class="aw-contact aw-email" href="${e(emailURL(patient.email))}">${icon('mail')} Email</a>`:''}<button data-process title="Abrir processo clínico">•••</button></div><nav class="aw-panel-tabs">${[['summary','Resumo'],['documents','Documentos'],['today','Consulta do dia'],['history','Histórico']].map(([key,label],i)=>`<button data-tab="${key}" class="${i?'':'is-active'}">${label}</button>`).join('')}</nav>${warnings.map(w=>`<p role="alert">${e(w)}</p>`).join('')}<div data-resources>${renderResourceGroups(items,consultations,row)}</div><div data-draft hidden></div><p data-feedback role="status"></p><div class="aw-share-bar"><span data-count>0 selecionados</span><button class="aw-primary" data-prepare disabled>${icon('send')} Partilhar selecionados ${icon('chevron')}</button></div>`;
  const feedback = host.querySelector('[data-feedback]');
  host.querySelector('[data-close]').onclick = () => { closePatientDocuments(); G.agendaSelectedId=null; host.hidden = true; document.querySelectorAll('.aw-selected').forEach(el => el.classList.remove('aw-selected')); };
  host.querySelectorAll('[data-process]').forEach(button=>button.onclick=()=>window.__gc_openFeedPanel(context.patientId,context.clinicId));
  let filter='Todos', all=false, tab='summary';
  const filterDocs=()=>{
    let count=0;
    host.querySelectorAll('[data-doc-category]').forEach(el=>{
      const match=(filter==='Todos'||el.dataset.docCategory===filter)&&(tab!=='history'||el.dataset.docHistory==='true');
      el.hidden=!match||(!all&&count>=5);if(match)count++;
    });
  };
  host.querySelector('[data-all-documents]').onclick=()=>{all=!all;filterDocs();host.querySelector('[data-all-documents]').textContent=all?'Mostrar menos':`Ver todos (${items.filter(x=>x.kind!=='link').length})`};
  host.querySelectorAll('[data-doc-filter]').forEach(button=>button.onclick=()=>{filter=button.dataset.docFilter;host.querySelectorAll('[data-doc-filter]').forEach(b=>b.classList.toggle('is-active',b===button));filterDocs()});
  host.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>{
    tab=button.dataset.tab;host.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('is-active',b===button));
    host.querySelectorAll('[data-panel-section]').forEach(el=>el.hidden=tab!=='summary'&&el.dataset.panelSection!==(tab==='history'?'documents':tab));filterDocs();
  });
  host.querySelectorAll('[data-link-copy]').forEach(button=>button.onclick=async()=>{
    try {const url=await resourceURL(window.sb,items[Number(button.dataset.linkCopy)]);if(!current()||!url)return;await navigator.clipboard.writeText(url);if(current())feedback.textContent='Link copiado.'}catch{if(current())feedback.textContent='Não foi possível copiar o link.'}
  });
  host.querySelectorAll('[data-resource]').forEach(input => input.onchange = () => {
    host.querySelector('[data-prepare]').disabled = !host.querySelector('[data-resource]:checked');
    host.querySelector('[data-count]').textContent = `${host.querySelectorAll('[data-resource]:checked').length} selecionados`;
    host.querySelector('[data-draft]').hidden = true;
  });
  host.querySelectorAll('[data-open]').forEach(button => button.onclick = async () => {
    const popup = window.open('about:blank', '_blank');
    if (popup) popup.opener = null;
    try {
      const url = await resourceURL(window.sb, items[Number(button.dataset.open)]);
      if (!current()) { popup?.close(); return; }
      if (!url) { popup?.close(); feedback.textContent = 'Não existe um ficheiro disponível para este registo.'; return; }
      if (popup) popup.location.href = url;
      else { feedback.innerHTML = `<a href="${e(url)}" target="_blank" rel="noopener noreferrer">Abrir documento</a>`; }
    } catch { popup?.close(); if (current()) feedback.textContent = 'Não foi possível abrir. Confirme o acesso ao documento no processo do doente.'; }
  });
  host.querySelector('[data-prepare]').onclick = async ev => {
    const selected = [...host.querySelectorAll('[data-resource]:checked')].map(input => items[Number(input.dataset.resource)]);
    if (!selected.length) { feedback.textContent = 'Selecione os documentos ou links que pretende partilhar.'; return; }
    const button = ev.currentTarget; button.disabled = true;
    try {
      const links = await Promise.all(selected.map(async item => {
        const url = await resourceURL(window.sb, item);
        if (!url) throw new Error('unavailable');
        return `${item.title}\n${url}`;
      }));
      if (!current()) return;
      const body = `Bom dia,\n\nSegue a documentação selecionada:\n\n${links.join('\n\n')}\n\nOs links temporários dos documentos são válidos durante 1 hora.\n\nCom os melhores cumprimentos.`;
      const draft = host.querySelector('[data-draft]'); draft.hidden = false;
      draft.innerHTML = '<h3>Rever antes de enviar</h3><p>Os documentos seguem como links, não como anexos. Links temporários: 1 hora.</p><textarea aria-label="Mensagem a enviar"></textarea><div class="aw-actions" data-share></div>';
      draft.querySelector('textarea').value = body;
      const actions = draft.querySelector('[data-share]');
      const update = () => {
        const text = draft.querySelector('textarea').value;
        const email = emailURL(patient?.email, 'Documentação', text), wa = whatsappURL(patient?.phone);
        actions.innerHTML = `${email && email.length <= 1800 ? `<a class="aw-contact" href="${e(email)}">Preparar email</a>` : '<small>Para email: copie o texto para a aplicação de email.</small>'}${wa ? `<a class="aw-contact" target="_blank" rel="noopener noreferrer" href="${e(wa+'?text='+encodeURIComponent(text))}">Preparar WhatsApp</a>` : '<small>WhatsApp: telefone indisponível ou inválido.</small>'}<button data-copy>Copiar texto</button>`;
        actions.querySelector('[data-copy]').onclick = async () => { try { await navigator.clipboard.writeText(text); if (current()) feedback.textContent = 'Texto copiado. O envio é confirmado na aplicação de email ou WhatsApp.'; } catch { if (current()) feedback.textContent = 'Selecione e copie o texto manualmente.'; } };
      };
      update(); draft.querySelector('textarea').oninput = update;
      feedback.textContent = 'Partilha preparada. Nenhuma mensagem foi enviada.';
    } catch { if (current()) feedback.textContent = 'Não foi possível preparar todos os documentos selecionados. Confirme os ficheiros e permissões no processo do doente.'; }
    finally { if (current()) button.disabled = false; }
  };
}
