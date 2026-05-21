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
    .select("id, label, sort_order")
    .in("id", ids);

  const byId = Object.fromEntries((cat || []).map(t => [t.id, t]));
  return links
    .map(l => ({
      id: l.treatment_id,
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
            <span>Conclusão <small>(opcional · só aparece no PDF se preenchida)</small></span>
            <textarea id="gcv2-rc-conclusao" rows="4" placeholder="Síntese clínica / parecer (opcional)…"></textarea>
          </label>

          <div class="gcv2-at-actions">
            <button class="gcv2-btn gcv2-btn-secondary" id="gcv2-rc-cancel">Fechar</button>
            <button class="gcv2-btn gcv2-btn-primary" id="gcv2-rc-gen" disabled title="PDF disponível no próximo sub-passo">Gerar PDF (em breve)</button>
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
      ? `<section class="gcv2-rc-section">
           <h3 class="gcv2-rc-h3">Anamnese / História da Doença Actual</h3>
           <div class="gcv2-rc-prose">${window.gcv2SanitizeHTML(state.hda)}</div>
         </section>`
      : '';

    const dxHtml = diagnoses.length
      ? `<section class="gcv2-rc-section">
           <h3 class="gcv2-rc-h3">Diagnósticos</h3>
           <ul class="gcv2-rc-list-ul">${diagnoses.map(d => `<li>${escHtml(d.label || '—')}</li>`).join('')}</ul>
         </section>`
      : '';

    // Placeholder para exame objectivo (entra no 3.5.b)
    const examHtml = '';

    const planoHtml = plano.length
      ? `<section class="gcv2-rc-section">
           <h3 class="gcv2-rc-h3">Plano Terapêutico</h3>
           <ul class="gcv2-rc-list-ul">${plano.map(p => `<li>${escHtml(p.label || '—')}</li>`).join('')}</ul>
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
