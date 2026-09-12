import { G } from './state.js';
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
    ['Consultas', () => sb.from('consultations').select('id,report_date,clinic_id').eq('patient_id', patientId).order('id')],
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

export function renderResourceGroups(items, consultations) {
  const itemHTML = item => {
    const i = items.indexOf(item);
    return `<div class="aw-document"><label><input type="checkbox" data-resource="${i}"> ${e(item.title)}</label><small>${e(date(item.created_at))} · ${e(G.clinicsById[item.clinic_id]?.name || 'Clínica não identificada')}${item.status === 'arquivado' ? ' · Arquivado' : ''}${item.signed_at ? ' · Assinado' : ''}</small><button data-open="${i}">Abrir</button></div>`;
  };
  const group = (label, rows) => `<div class="aw-doc-category"><h4>${label}</h4>${rows.length ? rows.map(itemHTML).join('') : '<small>Sem documentos disponíveis.</small>'}</div>`;
  const documents = items.filter(x => x.key.startsWith('0:'));
  const byConsult = new Map();
  documents.forEach(item => { const key = item.consultation_id || ''; if (!byConsult.has(key)) byConsult.set(key, []); byConsult.get(key).push(item); });
  const groups = [...byConsult].sort(([a], [b]) => String(consultations.get(b)?.report_date || '').localeCompare(String(consultations.get(a)?.report_date || '')));
  let html = groups.map(([id, rows]) => {
    const consult = consultations.get(id);
    const heading = !id ? 'Documentos sem consulta associada' : consult?.report_date ? 'Consulta · '+date(consult.report_date) : 'Consulta associada · data indisponível';
    const known = ['relatorio_consulta','exames','analises','relatorio-clinico','simples','atestado_doenca','atestado_edfisica','PRP','prp_visco'];
    return `<details open><summary>${e(heading)} · ${rows.length}</summary>${group('Relatório da consulta', rows.filter(x => x.category === 'relatorio_consulta'))}${group('Meios Complementares', rows.filter(x => ['exames','analises'].includes(x.category)))}${group('Relatórios / Atestados', rows.filter(x => ['relatorio-clinico','simples','atestado_doenca','atestado_edfisica','PRP','prp_visco'].includes(x.category)))}${rows.some(x => !known.includes(x.category)) ? group('Outros documentos', rows.filter(x => !known.includes(x.category))) : ''}</details>`;
  }).join('');
  if (!groups.length) html += '<p>Sem documentos de consultas disponíveis.</p>';
  html += `<details open><summary>RGPD e consentimentos</summary>${items.filter(x => x.key.startsWith('1:') || x.key.startsWith('2:')).map(itemHTML).join('') || '<p>Sem consentimentos disponíveis.</p>'}</details>`;
  html += `<details open><summary>Acompanhamento digital</summary>${[['diary','📓 Diário'],['activity','🏃 Atividade física e desportiva'],['pathology','🏠 Exercícios por patologia'],['med','💊 Medicação'],['question','📋 Questionários']].map(([scope,label]) => {
    const available = items.filter(x => x.scope === scope);
    return available.length ? group(label, available) : `<div class="aw-doc-category"><h4>${label}</h4><button disabled>Indisponível</button></div>`;
  }).join('')}</details>`;
  return html;
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
  host.innerHTML = `<div class="aw-heading"><h2>${e(patient?.full_name || 'Documentação do doente')}</h2><button data-close aria-label="Fechar documentação">×</button></div>
    <p>${e(clinic)} · ${e(date(row.start_at))}</p><p>${e(patient?.phone || 'Sem telefone')}<br>${e(patient?.email || 'Sem email')}</p><div class="aw-actions">${whatsappURL(patient?.phone) ? `<a class="aw-contact" href="${e(whatsappURL(patient.phone))}" target="_blank" rel="noopener noreferrer">WhatsApp</a>` : ''}${emailURL(patient?.email) ? `<a class="aw-contact" href="${e(emailURL(patient.email))}">Email</a>` : ''}</div>
    <p>Documentos de todas as consultas disponíveis para este doente.</p>
    ${warnings.map(w => `<p role="alert">${e(w)}</p>`).join('')}
    <div class="aw-actions"><button data-prepare>Preparar partilha</button><span data-count>0 selecionados</span></div>
    <div data-resources>${renderResourceGroups(items, consultations)}</div>
    <div data-draft hidden></div><p data-feedback role="status"></p>`;
  const feedback = host.querySelector('[data-feedback]');
  host.querySelector('[data-close]').onclick = () => { closePatientDocuments(); host.hidden = true; document.querySelectorAll('.aw-selected').forEach(el => el.classList.remove('aw-selected')); };
  host.querySelectorAll('[data-resource]').forEach(input => input.onchange = () => {
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
