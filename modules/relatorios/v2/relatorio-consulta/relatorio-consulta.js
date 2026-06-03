// =================================================================
// relatorio-consulta.js  ·  Relatório de Consulta v2
// =================================================================
// Modal split form/preview. Carrega dados de uma consulta específica.
// Renderiza preview live com shell v2 + patient-card + secções.
// PDF e exame objectivo entram nos sub-passos seguintes (3.5.b/c).
// =================================================================

import { buildShellV2, loadClinicById, loadCurrentDoctor, getVinhetaDataUrl } from '../_shell/shell-v2.js';
import { buildPatientCard } from '../_components/patient-card.js';

const escAttr = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));
const escHtml = escAttr;

// Sanitiza HTML do editor Quill (HDA): mantém tags de formatação seguras,
// remove scripts, handlers de eventos e atributos perigosos.
function gcv2SanitizeHTML(html) {
  if (!html) return '';
  const allowed = ['P','BR','UL','OL','LI','STRONG','B','EM','I','U','SPAN','DIV','H1','H2','H3','H4','BLOCKQUOTE','A'];
  const tmp = document.createElement('div');
  tmp.innerHTML = String(html);
  const walk = (node) => {
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (child.nodeType === 1) { // elemento
        if (!allowed.includes(child.tagName)) {
          // substitui tag não permitida pelo seu texto
          child.replaceWith(document.createTextNode(child.textContent || ''));
          continue;
        }
        // remove atributos perigosos (onclick, onerror, style com expr, etc.)
        for (const attr of Array.from(child.attributes)) {
          const n = attr.name.toLowerCase();
          if (n.startsWith('on') || n === 'style' || (n === 'href' && /javascript:/i.test(attr.value))) {
            child.removeAttribute(attr.name);
          }
        }
        walk(child);
      } else if (child.nodeType === 8) { // comentário
        child.remove();
      }
    }
  };
  walk(tmp);
  return tmp.innerHTML;
}
if (typeof window !== 'undefined') {
  window.gcv2SanitizeHTML = gcv2SanitizeHTML;
}

// -----------------------------------------------------------------
// CSS loaders
// -----------------------------------------------------------------
function ensureShellCss() {
  if (document.querySelector('link[data-gcv2-shell]')) return;
  const lnk = document.createElement('link');
  lnk.rel = 'stylesheet';
  lnk.href = new URL('../_shell/shell-v2.css', import.meta.url).href;
  lnk.dataset.gcv2Shell = '1';
  document.head.appendChild(lnk);
}

function ensureAtestadoCss() {
  if (document.querySelector('link[data-gcv2-atestado]')) return;
  const lnk = document.createElement('link');
  lnk.rel = 'stylesheet';
  lnk.href = new URL('../atestados/atestado.css', import.meta.url).href;
  lnk.dataset.gcv2Atestado = '1';
  document.head.appendChild(lnk);
}

function ensureRelConsultaCss() {
  if (document.querySelector('link[data-gcv2-rc]')) return;
  const lnk = document.createElement('link');
  lnk.rel = 'stylesheet';
  lnk.href = new URL('./relatorio-consulta.css', import.meta.url).href;
  lnk.dataset.gcv2Rc = '1';
  document.head.appendChild(lnk);
}

// -----------------------------------------------------------------
// Carregamento de dados
// -----------------------------------------------------------------
async function loadConsultation(consultationId) {
  if (!consultationId) return null;
  const { data, error } = await window.sb
    .from('consultations')
    .select('id, clinic_id, patient_id, report_date, hda, created_at, updated_at')
    .eq('id', consultationId)
    .single();
  if (error) { console.error('[rc] erro a obter consulta:', error); return null; }
  return data;
}

async function loadPatient(patientId) {
  if (!patientId) return null;
  const { data, error } = await window.sb
    .from('patients')
    .select('id, full_name, dob, sex, nif, sns, cc_number, passport_id, address_line1, postal_code, city')
    .eq('id', patientId)
    .single();
  if (error) { console.error('[rc] erro a obter doente:', error); return null; }
  return data;
}

async function loadDiagnoses(consultationId) {
  const { data: links, error } = await window.sb
    .from("consultation_diagnoses")
    .select("diagnosis_id")
    .eq("consultation_id", consultationId);
  if (error || !links?.length) return [];

  const ids = [...new Set(links.map(l => l.diagnosis_id).filter(Boolean))];
  if (!ids.length) return [];

  const { data: cat } = await window.sb
    .from("diagnoses_catalog")
    .select("id, code, label")
    .in("id", ids);

  return (cat || []).map(d => ({ id: d.id, code: d.code || "", label: d.label || "" }));
}

async function loadPlano(consultationId) {
  const { data: links, error } = await window.sb
    .from("consultation_treatments")
    .select("treatment_id, qty")
    .eq("consultation_id", consultationId);
  if (error || !links?.length) return [];

  const ids = [...new Set(links.map(l => l.treatment_id).filter(Boolean))];
  if (!ids.length) return [];

  const { data: cat } = await window.sb
    .from("treatments_catalog")
    .select("id, code, label, sort_order")
    .in("id", ids);

  const byId = Object.fromEntries((cat || []).map(t => [t.id, t]));
  return links
    .map(l => ({
      id: l.treatment_id,
      code: byId[l.treatment_id]?.code || "",
      label: byId[l.treatment_id]?.label || "",
      qty: l.qty || null,
      sort_order: byId[l.treatment_id]?.sort_order ?? 999
    }))
    .sort((a, b) => a.sort_order - b.sort_order);
}

// -----------------------------------------------------------------
// Modal principal
// -----------------------------------------------------------------
export async function openRelatorioConsultaModal({ patientId, consultationId, onClose } = {}) {
  if (!patientId || !consultationId) {
    console.warn('[rc] precisa de patientId E consultationId');
    return;
  }

  ensureShellCss();
  ensureAtestadoCss();
  ensureRelConsultaCss();

  const consultation = await loadConsultation(consultationId);
  if (!consultation) { alert('Consulta não encontrada'); return; }

  const clinicId = consultation.clinic_id;

  const [patient, clinic, doctor, vinhetaUrl, diagnoses, plano] = await Promise.all([
    loadPatient(consultation.patient_id),
    loadClinicById(clinicId),
    loadCurrentDoctor(),
    getVinhetaDataUrl(),
    loadDiagnoses(consultationId),
    loadPlano(consultationId),
  ]);

  // Estado local — campos editáveis
  const state = {
    date: consultation.report_date || new Date().toISOString().slice(0, 10),
    hda: consultation.hda || '',
    conclusao: '',
    sessoes: 20,
  };

  // Construir overlay
  const overlay = document.createElement('div');
  overlay.className = 'gcv2-atestado-overlay';
  overlay.innerHTML = `
    <div class="gcv2-atestado-modal gcv2-rc-modal">
      <header class="gcv2-atestado-head">
        <h2>Relatório de Consulta</h2>
        <button class="gcv2-at-close" aria-label="Fechar">×</button>
      </header>

      <div class="gcv2-atestado-split">
        <aside class="gcv2-atestado-form">

          <label class="gcv2-at-field">
            <span>Data do relatório</span>
            <input type="date" id="gcv2-rc-date" value="${escAttr(state.date)}">
          </label>

          <label class="gcv2-at-field">
            <span>Anamnese / HDA <small>(editável)</small></span>
            <textarea id="gcv2-rc-hda" rows="8" placeholder="História da doença actual…">${escHtml(state.hda)}</textarea>
          </label>

          <div class="gcv2-rc-readonly-block">
            <span class="gcv2-at-field-label">Diagnósticos <small>(só leitura · da consulta)</small></span>
            <div class="gcv2-rc-list" id="gcv2-rc-dx-list">
              ${diagnoses.length === 0
                ? '<em>(sem diagnósticos registados nesta consulta)</em>'
                : diagnoses.map(d => `<div>• ${escHtml(d.label || '—')}</div>`).join('')}
            </div>
          </div>

          <div class="gcv2-rc-readonly-block">
            <span class="gcv2-at-field-label">Plano terapêutico <small>(só leitura · da consulta)</small></span>
            <div class="gcv2-rc-list" id="gcv2-rc-plano-list">
              ${plano.length === 0
                ? '<em>(sem plano registado nesta consulta)</em>'
                : plano.map(p => `<div>• ${escHtml(p.label || '—')}</div>`).join('')}
            </div>
          </div>

          <label class="gcv2-at-field">
            <span>Nº de sessões <small>(prescrição do plano)</small></span>
            <input type="number" id="gcv2-rc-sessoes" min="1" max="60" step="1" value="20">
          </label>

          <label class="gcv2-at-field">
            <span>Conclusão <small>(opcional · só aparece no PDF se preenchida)</small></span>
            <textarea id="gcv2-rc-conclusao" rows="4" placeholder="Síntese clínica / parecer (opcional)…"></textarea>
          </label>

          <div class="gcv2-at-actions">
            <button class="gcv2-btn gcv2-btn-secondary" id="gcv2-rc-cancel">Fechar</button>
            <button class="gcv2-btn gcv2-btn-primary" id="gcv2-rc-gen">Gerar PDF</button>
          </div>

        </aside>

        <main class="gcv2-atestado-preview">
          <div id="gcv2-rc-preview-host"></div>
        </main>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // -------- Conteúdo do relatório --------
  function buildReportContent() {
    const cardHtml = buildPatientCard({ patient, mode: 'full' });

    const hdaHtml = state.hda && state.hda.trim()
      ? `<section class="gcv2-rc-section gcv2-rc-flow">
           <h3 class="gcv2-rc-h3">Anamnese / História da Doença Actual</h3>
           <div class="gcv2-rc-prose">${window.gcv2SanitizeHTML(state.hda)}</div>
         </section>`
      : '';

    const dxHtml = diagnoses.length
      ? `<section class="gcv2-rc-section">
           <h3 class="gcv2-rc-h3">Diagnósticos</h3>
           <ul class="gcv2-rc-list-ul">${diagnoses.map(d => `<li>${d.code ? 'ICD 9- ' + escHtml(d.code) + ' - ' : ''}${escHtml(d.label || '—')}</li>`).join('')}</ul>
         </section>`
      : '';

    // Placeholder para exame objectivo (entra no 3.5.b)
    const examHtml = '';

    const planoHtml = plano.length
      ? `<section class="gcv2-rc-section">
           <h3 class="gcv2-rc-h3">Plano Terapêutico</h3>
           <p class="gcv2-rc-prescricao">R/ ${state.sessoes} Sessões de Tratamentos de Medicina Física e de Reabilitação com:</p>
           <ul class="gcv2-rc-list-ul">${plano.map(p => `<li>${p.code ? escHtml(p.code) + ' - ' : ''}${escHtml(p.label || '—')}</li>`).join('')}</ul>
         </section>`
      : '';

    const conclusaoHtml = state.conclusao && state.conclusao.trim()
      ? `<section class="gcv2-rc-section">
           <h3 class="gcv2-rc-h3">Conclusão</h3>
           <div class="gcv2-rc-prose">${escHtml(state.conclusao).replace(/\n/g, '<br>')}</div>
         </section>`
      : '';

    return `
      <div class="gcv2-rc-content">
        ${cardHtml}
        ${hdaHtml}
        ${dxHtml}
        ${examHtml}
        ${planoHtml}
        ${conclusaoHtml}
      </div>
    `;
  }

  // -------- Render do preview --------
  function renderPreview() {
    const contentHtml = buildReportContent();
    const shellHtml = buildShellV2({
      clinic, doctor,
      config: {
        kicker: 'Medicina Física & Reabilitação',
        title: 'Relatório de Consulta',
        date: state.date,
        vinhetaUrl,
      },
      contentHtml,
    });
    const host = overlay.querySelector('#gcv2-rc-preview-host');
    if (host) host.innerHTML = shellHtml;
  }

  renderPreview();

  // -------- Bindings (live preview) --------
  overlay.querySelector('#gcv2-rc-date').addEventListener('change', (e) => {
    state.date = e.target.value;
    renderPreview();
  });

  overlay.querySelector('#gcv2-rc-hda').addEventListener('input', (e) => {
    state.hda = e.target.value;
    renderPreview();
  });

  overlay.querySelector('#gcv2-rc-conclusao').addEventListener('input', (e) => {
    state.conclusao = e.target.value;
    renderPreview();
  });

  overlay.querySelector('#gcv2-rc-sessoes').addEventListener('input', (e) => {
    const n = parseInt(e.target.value, 10);
    state.sessoes = (Number.isFinite(n) && n > 0) ? n : 20;
    renderPreview();
  });

  // -------- Gerar PDF --------
  overlay.querySelector('#gcv2-rc-gen').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = 'A gerar PDF…';

    try {
      const html = overlay.querySelector('#gcv2-rc-preview-host').innerHTML;
      const styles = Array.from(document.querySelectorAll('link[data-gcv2-shell], link[data-gcv2-atestado], link[data-gcv2-rc]'))
        .map(l => `<link rel="stylesheet" href="${l.href}">`).join('\n');

      // Passo 1: gerar o doc_number via INSERT temporário não — fazemos INSERT no fim com html completo
      // A vinheta é injectada depois de obtermos o doc_number do Supabase
      const { data: docInserted, error: insErrPre } = await window.sb.from('documents').insert({
        patient_id: patientId,
        clinic_id: clinicId || null,
        consultation_id: consultationId,
        category: 'relatorio-clinico',
        title,
        html: '',
        storage_path: '',
        version: 1,
      }).select('doc_number').single();
      if (insErrPre) throw new Error('Erro ao gerar código do documento: ' + insErrPre.message);

      const docNumber = docInserted?.doc_number || 'JM-XX-0000-A';

      const vinheta = `
        <div style="margin-top:48px; border-top: 1px solid #1a56db; padding-top:16px; display:flex; align-items:flex-start; justify-content:space-between; gap:16px; font-family:Arial,sans-serif; page-break-inside:avoid;">
          <div style="flex:1;">
            <p style="margin:0 0 2px; font-size:14px; font-weight:600; color:#0f2d52;">Dr. João Morais</p>
            <p style="margin:0 0 4px; font-size:11px; color:#1a56db;">Medicina Física e de Reabilitação · Medicina Desportiva</p>
            <p style="margin:0 0 8px; font-size:10px; color:#555;">Cédula OM 44380 · www.joaomorais.pt</p>
            <p style="margin:0 0 4px; font-size:9px; color:#333; font-family:monospace; letter-spacing:0.05em;">Código do documento: <strong>${docNumber}</strong></p>
            <p style="margin:0; font-size:9px; color:#555; line-height:1.5;">Assinado digitalmente com Cartão de Cidadão.<br>Verificar integridade no Adobe Acrobat ou leitor PDF compatível.</p>
          </div>
          <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
              <rect width="64" height="64" fill="white"/>
              <text x="32" y="38" text-anchor="middle" font-size="7" fill="#0f2d52" font-family="monospace">${docNumber}</text>
              <rect x="2" y="2" width="20" height="20" rx="2" fill="none" stroke="#0f2d52" stroke-width="2"/>
              <rect x="7" y="7" width="10" height="10" fill="#0f2d52"/>
              <rect x="42" y="2" width="20" height="20" rx="2" fill="none" stroke="#0f2d52" stroke-width="2"/>
              <rect x="47" y="7" width="10" height="10" fill="#0f2d52"/>
              <rect x="2" y="42" width="20" height="20" rx="2" fill="none" stroke="#0f2d52" stroke-width="2"/>
              <rect x="7" y="47" width="10" height="10" fill="#0f2d52"/>
            </svg>
            <span style="font-size:7px; color:#888;">verificar autenticidade</span>
          </div>
        </div>`;

      const fullHtml = \`<!doctype html><html lang="pt-PT"><head><meta charset="utf-8">${styles}</head><body>${html}${vinheta}</body></html>\`;


      const resp = await fetch('https://gc-pdf-proxy.dr-joao-morais.workers.dev/pdf', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ html: fullHtml }),
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        throw new Error(`PDF worker erro ${resp.status}: ${errText.slice(0, 200)}`);
      }
      const buf = await resp.arrayBuffer();
      const blob = new Blob([buf], { type: 'application/pdf' });

      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');

      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const title = `Relatório clínico — ${patient?.full_name || 'desconhecido'} — ${state.date}`;
      const fileName = `relatorio-clinico_${state.date}_${ts}.pdf`;
      const path = `clinic_${clinicId || 'unknown'}/patient_${patientId}/relatorios-clinicos/${fileName}`;

      const { error: upErr } = await window.sb.storage.from('documents').upload(path, blob, {
        contentType: 'application/pdf',
        upsert: true,
      });
      if (upErr) console.warn('[rc] upload storage falhou:', upErr);

      // Actualizar o documento já inserido com o html completo (com vinheta) e o storage_path
      const { error: insErr } = await window.sb.from('documents')
        .update({ html: fullHtml, storage_path: path })
        .eq('doc_number', docNumber);
      if (insErr) console.warn('[rc] update documents falhou:', insErr);

      closeModal();
    } catch (err) {
      console.error('[rc] erro a gerar PDF:', err);
      alert('Erro a gerar PDF: ' + (err?.message || err));
      btn.disabled = false;
      btn.textContent = 'Gerar PDF';
    }
  });

  // -------- Fechar --------
  function closeModal() {
    overlay.remove();
    if (typeof onClose === 'function') onClose();
  }
  overlay.querySelector('.gcv2-at-close').addEventListener('click', closeModal);
  overlay.querySelector('#gcv2-rc-cancel').addEventListener('click', closeModal);
}

// Expor globalmente
if (typeof window !== 'undefined') {
  window.__gcv2_openRelatorioConsultaModal = openRelatorioConsultaModal;
}
