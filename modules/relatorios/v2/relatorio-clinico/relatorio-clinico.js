// =================================================================
// relatorio-clinico.js  ·  Relatório Clínico v2
// =================================================================
// Modal com formulário (esquerda) + preview live (direita).
// Gera PDF via Cloudflare Worker, guarda em documents/.
// Construído de raiz na linha v2 (padrão de atestado.js / prp.js):
//   · overlay próprio (createElement + appendChild(body))
//   · CSS escopado .gcv2-rcl- (evita colisão com .gcv2-rc- de
//     relatorio-consulta.js, que já usa esse prefixo)
//   · SEM Quill, SEM iframe — corpo é contenteditable com execCommand
//   · modelo "escrever → gerar PDF", sem persistência do texto-fonte
// =================================================================

import { buildShellV2, loadClinicById, loadCurrentDoctor, getVinhetaDataUrl } from '../_shell/shell-v2.js';
import { buildPatientCard } from '../_components/patient-card.js';

const escAttr = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));
const escHtml = escAttr;

const MIN_PDF_BYTES = 5000; // mesmo limiar de "provável em branco" que pedidos-v2.js/prp.js usam

const TITULO_DEFAULT = 'Relatório Clínico';
const TITULO_CHIPS = ['Clínico', 'Médico', 'de Avaliação'];

const CREDENCIAIS_TEXT = 'Eu, <strong>João Morais</strong>, Médico Licenciado pela Faculdade de Medicina da Universidade de Coimbra, Especialista em Medicina Física e Reabilitação, Fisiatra, com Pós-Graduação em Medicina Desportiva, Cédula Profissional nº 44380';

/**
 * generateDocNumber
 * Mesma fórmula que pedidos-v2.js/relatorio-consulta.js/prp.js já usam.
 * JM-{ano 2 díg.}-{5 díg. de segundos}-A.
 */
function generateDocNumber() {
  const y = new Date().getFullYear().toString().slice(-2);
  const s = String(Math.floor(Date.now() / 1000) % 100000).padStart(5, "0");
  return `JM-${y}-${s}-A`;
}

// -----------------------------------------------------------------
// Sanitização do corpo (mesmo padrão de relatorio-consulta.js
// gcv2SanitizeHTML — cópia local para não depender de ordem de carga).
// -----------------------------------------------------------------
function sanitizeBodyHtml(html) {
  if (!html) return '';
  const allowed = ['P','BR','UL','OL','LI','STRONG','B','EM','I','U','SPAN','DIV'];
  const tmp = document.createElement('div');
  tmp.innerHTML = String(html);
  const walk = (node) => {
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (child.nodeType === 1) {
        if (!allowed.includes(child.tagName)) {
          child.replaceWith(document.createTextNode(child.textContent || ''));
          continue;
        }
        for (const attr of Array.from(child.attributes)) {
          const n = attr.name.toLowerCase();
          if (n.startsWith('on') || n === 'style') child.removeAttribute(attr.name);
        }
        walk(child);
      } else if (child.nodeType === 8) {
        child.remove();
      }
    }
  };
  walk(tmp);
  return tmp.innerHTML;
}

// -----------------------------------------------------------------
// Helpers de CSS (padrão atestado.js)
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
  // .gcv2-btn/.gcv2-btn-primary/.gcv2-btn-secondary e .gcv2-patient-card/.gcv2-pc-*
  // só têm estilo em atestado.css — reutilizado como CSS partilhado do design
  // system v2, mesmo padrão que prp.js e relatorio-consulta.js já usam.
  if (document.querySelector('link[data-gcv2-atestado]')) return;
  const lnk = document.createElement('link');
  lnk.rel = 'stylesheet';
  lnk.href = new URL('../atestados/atestado.css', import.meta.url).href;
  lnk.dataset.gcv2Atestado = '1';
  document.head.appendChild(lnk);
}

function ensureRelClinicoCss() {
  if (document.querySelector('link[data-gcv2-rcl]')) return;
  const lnk = document.createElement('link');
  lnk.rel = 'stylesheet';
  lnk.href = new URL('./relatorio-clinico.css', import.meta.url).href;
  lnk.dataset.gcv2Rcl = '1';
  document.head.appendChild(lnk);
}

// -----------------------------------------------------------------
// Carregamento de dados
// -----------------------------------------------------------------
async function loadLastConsult(patientId) {
  const { data, error } = await window.sb
    .from('consultations')
    .select('id, clinic_id, report_date, created_at')
    .eq('patient_id', patientId)
    .order('report_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) { console.error('[relatorio-clinico] erro a obter última consulta:', error); return null; }
  return data || null;
}

async function loadPatient(patientId) {
  // Query idêntica a relatorio-consulta.js/prp.js — mesma fonte da verdade
  // para a identificação do doente em todos os documentos v2.
  const { data, error } = await window.sb
    .from('patients')
    .select('id, full_name, dob, sex, nif, sns, cc_number, passport_id, address_line1, postal_code, city, insurance_provider, insurance_policy_number')
    .eq('id', patientId)
    .single();
  if (error) { console.error('[relatorio-clinico] erro a obter doente:', error); return null; }
  return data;
}

// -----------------------------------------------------------------
// Corpo do relatório (preview + PDF)
// -----------------------------------------------------------------
function buildRelatorioClinicoBody({ patient, state }) {
  const patientCard = buildPatientCard({ patient, mode: 'full' }); // sem hideInsurance — pode ir a seguradora

  const dateStr = state.date ? new Date(`${state.date}T00:00:00`).toLocaleDateString('pt-PT') : '';
  const dateLine = dateStr
    ? `<p class="gcv2-rcl-date"><strong>Data do relatório:</strong> ${escHtml(dateStr)}</p>`
    : '';

  const creditosHtml = state.incluirCredenciais
    ? `<p class="gcv2-rcl-creditos">${CREDENCIAIS_TEXT}</p>`
    : '';

  const corpoLimpo = sanitizeBodyHtml(state.corpoHtml);
  const corpoHtml = corpoLimpo && corpoLimpo.trim()
    ? `<div class="gcv2-rcl-body">${corpoLimpo}</div>`
    : '<div class="gcv2-rcl-body"><em>(sem conteúdo)</em></div>';

  return `
    <div class="gcv2-rcl-content">
      ${patientCard}
      ${dateLine}
      ${creditosHtml}
      ${corpoHtml}
    </div>
  `;
}

// -----------------------------------------------------------------
// Modal principal
// -----------------------------------------------------------------
export async function openRelatorioClinicoModal({ patientId, onClose } = {}) {
  if (!patientId) { console.warn('[relatorio-clinico] sem patientId'); return; }

  ensureShellCss();
  ensureAtestadoCss();
  ensureRelClinicoCss();

  const lastConsult = await loadLastConsult(patientId);
  const clinicId = lastConsult?.clinic_id || null;
  const consultationId = lastConsult?.id || null;

  const [patient, clinic, doctor, vinhetaUrl] = await Promise.all([
    loadPatient(patientId),
    clinicId ? loadClinicById(clinicId) : Promise.resolve(null),
    loadCurrentDoctor(),
    getVinhetaDataUrl(),
  ]);

  const state = {
    titulo: TITULO_DEFAULT,
    incluirCredenciais: true,
    date: new Date().toISOString().slice(0, 10),
    corpoHtml: '',
  };

  // Construir overlay
  const overlay = document.createElement('div');
  overlay.className = 'gcv2-atestado-overlay';
  overlay.innerHTML = `
    <div class="gcv2-atestado-modal">
      <header class="gcv2-atestado-head">
        <h2>Relatório Clínico</h2>
        <button class="gcv2-at-close" aria-label="Fechar">×</button>
      </header>

      <div class="gcv2-atestado-split">
        <aside class="gcv2-atestado-form">
          <label class="gcv2-at-field">
            <span>Título</span>
            <input type="text" id="gcv2-rcl-titulo" value="${escAttr(state.titulo)}">
            <div class="gcv2-rcl-title-chips">
              ${TITULO_CHIPS.map(c => `<button type="button" class="gcv2-rcl-chip" data-val="${escAttr(c)}">${escHtml(c)}</button>`).join('')}
            </div>
          </label>

          <div class="gcv2-at-field">
            <span>Credenciais</span>
            <label class="gcv2-rcl-switch-row">
              <span class="gcv2-rcl-switch">
                <input type="checkbox" id="gcv2-rcl-credenciais" ${state.incluirCredenciais ? 'checked' : ''}>
                <span class="gcv2-rcl-switch-track"></span>
              </span>
              Incluir credenciais no relatório
            </label>
          </div>

          <label class="gcv2-at-field">
            <span>Data do relatório</span>
            <input type="date" id="gcv2-rcl-date" value="${state.date}">
          </label>

          <div class="gcv2-at-field">
            <span>Corpo do relatório</span>
            <div class="gcv2-rcl-toolbar">
              <button type="button" class="gcv2-rcl-tbtn" data-cmd="bold" title="Negrito"><strong>B</strong></button>
              <button type="button" class="gcv2-rcl-tbtn" data-cmd="italic" title="Itálico"><em>I</em></button>
              <button type="button" class="gcv2-rcl-tbtn" data-cmd="insertUnorderedList" title="Lista de pontos">•≡</button>
              <button type="button" class="gcv2-rcl-tbtn" data-cmd="insertOrderedList" title="Lista numerada">1.≡</button>
            </div>
            <div class="gcv2-rcl-body-edit" id="gcv2-rcl-corpo" contenteditable="true" data-placeholder="Escreva o corpo do relatório…"></div>
          </div>

          <div class="gcv2-at-actions">
            <button class="gcv2-btn gcv2-btn-secondary" id="gcv2-rcl-cancel">Cancelar</button>
            <button class="gcv2-btn gcv2-btn-primary" id="gcv2-rcl-gen">Gerar PDF</button>
          </div>
        </aside>

        <main class="gcv2-atestado-preview">
          <div id="gcv2-rcl-preview-host"></div>
        </main>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const inTitulo = overlay.querySelector('#gcv2-rcl-titulo');
  const cbCredenciais = overlay.querySelector('#gcv2-rcl-credenciais');
  const inDate = overlay.querySelector('#gcv2-rcl-date');
  const corpoEl = overlay.querySelector('#gcv2-rcl-corpo');

  // -------- Render do preview --------
  function renderPreview() {
    const tituloEfectivo = (state.titulo && state.titulo.trim()) ? state.titulo.trim() : TITULO_DEFAULT;
    const body = buildRelatorioClinicoBody({ patient, state });
    const shellHtml = buildShellV2({
      clinic, doctor,
      config: {
        kicker: 'Medicina Física & Reabilitação',
        title: tituloEfectivo,
        date: state.date,
        vinhetaUrl,
      },
      contentHtml: body,
    });
    const host = overlay.querySelector('#gcv2-rcl-preview-host');
    if (host) host.innerHTML = shellHtml;
  }

  renderPreview();

  // -------- Bindings --------
  inTitulo.addEventListener('input', () => {
    state.titulo = inTitulo.value;
    renderPreview();
  });

  overlay.querySelectorAll('.gcv2-rcl-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const novoTitulo = `Relatório ${btn.dataset.val}`;
      state.titulo = novoTitulo;
      inTitulo.value = novoTitulo;
      renderPreview();
    });
  });

  cbCredenciais.addEventListener('change', () => {
    state.incluirCredenciais = cbCredenciais.checked;
    renderPreview();
  });

  inDate.addEventListener('change', () => {
    state.date = inDate.value;
    renderPreview();
  });

  corpoEl.addEventListener('input', () => {
    state.corpoHtml = corpoEl.innerHTML;
    renderPreview();
  });

  overlay.querySelectorAll('.gcv2-rcl-tbtn').forEach(btn => {
    btn.addEventListener('mousedown', (e) => e.preventDefault());
    btn.addEventListener('click', () => {
      corpoEl.focus();
      document.execCommand(btn.dataset.cmd, false, null);
      state.corpoHtml = corpoEl.innerHTML;
      renderPreview();
    });
  });

  // -------- Fechar --------
  function closeModal() {
    overlay.remove();
    if (typeof onClose === 'function') onClose();
  }
  overlay.querySelector('.gcv2-at-close').addEventListener('click', closeModal);
  overlay.querySelector('#gcv2-rcl-cancel').addEventListener('click', closeModal);

  // -------- Gerar PDF + guardar --------
  overlay.querySelector('#gcv2-rcl-gen').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = 'A gerar PDF…';

    try {
      const tituloFinal = (state.titulo && state.titulo.trim()) ? state.titulo.trim() : TITULO_DEFAULT;

      const html = overlay.querySelector('#gcv2-rcl-preview-host').innerHTML;
      const styles = Array.from(document.querySelectorAll('link[data-gcv2-shell], link[data-gcv2-atestado], link[data-gcv2-rcl]'))
        .map(l => `<link rel="stylesheet" href="${l.href}">`).join('\n');
      const fullHtml = `<!doctype html><html lang="pt-PT"><head><meta charset="utf-8">${styles}</head><body>${html}</body></html>`;

      const resp = await fetch('https://gc-pdf-proxy.dr-joao-morais.workers.dev/pdf', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ html: fullHtml, media: 'print' }),
      });
      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        throw new Error(`PDF worker erro ${resp.status}: ${errText.slice(0, 200)}`);
      }
      const buf = await resp.arrayBuffer();
      const blob = new Blob([buf], { type: 'application/pdf' });
      if (!blob || blob.size < MIN_PDF_BYTES) {
        throw new Error('PDF inválido ou demasiado pequeno (provável em branco).');
      }

      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');

      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `relatorio-clinico_${state.date}_${ts}.pdf`;
      const path = `clinic_${clinic?.id || 'unknown'}/patient_${patientId}/relatorios-clinicos/${fileName}`;

      const { error: upErr } = await window.sb.storage.from('documents').upload(path, blob, {
        contentType: 'application/pdf',
        upsert: true,
      });
      if (upErr) throw new Error(`Falha no upload para Storage: ${upErr.message || upErr}`);

      const { error: insErr } = await window.sb.from('documents').insert({
        patient_id: patientId,
        clinic_id: clinic?.id || null,
        consultation_id: consultationId,
        category: 'relatorio-clinico',
        title: tituloFinal,
        html: sanitizeBodyHtml(state.corpoHtml),
        storage_path: path,
        doc_number: generateDocNumber(),
        version: 1,
      });
      if (insErr) throw new Error(`Falha ao registar em documents: ${insErr.message || insErr}`);

      closeModal();
    } catch (err) {
      console.error('[relatorio-clinico] erro a gerar PDF:', err);
      alert('Erro a gerar PDF: ' + (err?.message || err));
      btn.disabled = false;
      btn.textContent = 'Gerar PDF';
    }
  });
}

// Expor globalmente (padrão dos outros geradores v2)
if (typeof window !== 'undefined') {
  window.__gcv2_openRelatorioClinicoModal = openRelatorioClinicoModal;
}
