// =================================================================
// intake-viewer.js  ·  Leitura de respostas de Questionário (intake) + PDF
// =================================================================
// Modal só de leitura (sem formulário): mostra as respostas de um
// intake_token concluído, agrupadas por secção conforme a config do
// questionnaire_type (mesmo import dinâmico que intake-motor.js usa).
// Gera PDF via Cloudflare Worker, guarda em documents/ — mesmo padrão
// de relatorio-consulta.js.
// =================================================================

import { buildShellV2, loadClinicById, loadCurrentDoctor, getVinhetaDataUrl, buildFriendlyFileName, openAndDownloadPdf } from '../_shell/shell-v2.js';
import { buildPatientCard } from '../_components/patient-card.js';

const escAttr = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));
const escHtml = escAttr;

// -----------------------------------------------------------------
// Helpers de CSS (padrão atestado.js / prp.js)
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
  // system v2, mesmo padrão que prp.js já usa. Mesmo atributo data-gcv2-atestado
  // que atestado.js/prp.js já usam — se vários módulos carregarem na mesma
  // página, só injecta uma vez.
  if (document.querySelector('link[data-gcv2-atestado]')) return;
  const lnk = document.createElement('link');
  lnk.rel = 'stylesheet';
  lnk.href = new URL('../atestados/atestado.css', import.meta.url).href;
  lnk.dataset.gcv2Atestado = '1';
  document.head.appendChild(lnk);
}

function ensureIntakeViewerCss() {
  if (document.querySelector('link[data-gcv2-iv]')) return;
  const lnk = document.createElement('link');
  lnk.rel = 'stylesheet';
  lnk.href = new URL('./intake-viewer.css', import.meta.url).href;
  lnk.dataset.gcv2Iv = '1';
  document.head.appendChild(lnk);
}

// -----------------------------------------------------------------
// Dados
// -----------------------------------------------------------------
async function loadPatient(patientId) {
  const { data, error } = await window.sb
    .from('patients')
    .select('id, full_name, dob, sex, nif, sns, cc_number, passport_id, address_line1, postal_code, city')
    .eq('id', patientId)
    .single();
  if (error) { console.error('[intake-viewer] erro a obter doente:', error); return null; }
  return data;
}

async function loadRespostas(tokenId) {
  const { data, error } = await window.sb
    .from('intake_responses')
    .select('question_id, answer')
    .eq('token_id', tokenId);
  if (error) { console.error('[intake-viewer] erro a obter respostas:', error); return []; }
  return data || [];
}

function fmtDataHora(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch (e) { return iso; }
}

// -----------------------------------------------------------------
// Formatação de resposta por tipo de pergunta
// (formato de answer por tipo: ver cabeçalho de intake-motor.js)
// -----------------------------------------------------------------
function formatAnswer(p, val) {
  if (val == null) return '<span class="gcv2-iv-empty">— sem resposta —</span>';

  switch (p.tipo) {
    case 'texto_curto': {
      const txt = typeof val === 'string' ? val.trim() : '';
      if (!txt) return '<span class="gcv2-iv-empty">— sem resposta —</span>';
      return escHtml(txt).replace(/\n/g, '<br>');
    }

    case 'numero': {
      if (val === '' || val == null) return '<span class="gcv2-iv-empty">— sem resposta —</span>';
      return escHtml(String(val)) + (p.apoio ? ' ' + escHtml(p.apoio) : '');
    }

    case 'escala': {
      if (val === '' || val == null) return '<span class="gcv2-iv-empty">— sem resposta —</span>';
      return `${escHtml(String(val))} / ${escHtml(String(p.max))}`;
    }

    case 'dropdown': {
      return val ? escHtml(String(val)) : '<span class="gcv2-iv-empty">— sem resposta —</span>';
    }

    case 'escolha_unica': {
      if (p.outro && val && typeof val === 'object') {
        const base = val.v ? escHtml(val.v) : '';
        const outro = val.outro_texto ? ` (${escHtml(val.outro_texto)})` : '';
        const junto = (base + outro).trim();
        return junto || '<span class="gcv2-iv-empty">— sem resposta —</span>';
      }
      return val ? escHtml(String(val)) : '<span class="gcv2-iv-empty">— sem resposta —</span>';
    }

    case 'escolha_multipla': {
      let arr = [];
      let outroTexto = '';
      if (p.outro && val && typeof val === 'object') {
        arr = Array.isArray(val.v) ? val.v : [];
        outroTexto = val.outro_texto || '';
      } else if (Array.isArray(val)) {
        arr = val;
      }
      if (!arr.length && !outroTexto) return '<span class="gcv2-iv-empty">— sem resposta —</span>';
      const itens = arr.map(v => `<li>${escHtml(v)}</li>`);
      if (outroTexto) itens.push(`<li>Outro: ${escHtml(outroTexto)}</li>`);
      return `<ul class="gcv2-iv-list">${itens.join('')}</ul>`;
    }

    case 'grelha': {
      if (!val || typeof val !== 'object' || !Object.keys(val).length) return '<span class="gcv2-iv-empty">— sem resposta —</span>';
      const linhas = (p.linhas || []).map(l =>
        `<tr><td>${escHtml(l.label)}</td><td>${escHtml(val[l.id] || '—')}</td></tr>`
      ).join('');
      return `<table class="gcv2-iv-grelha">${linhas}</table>`;
    }

    default:
      return escHtml(String(val));
  }
}

// -----------------------------------------------------------------
// Corpo do documento (preview + PDF)
// -----------------------------------------------------------------
function buildIntakeBody({ patient, tokenRow, cfg, answersByQid }) {
  const patientCard = buildPatientCard({ patient, mode: 'full', hideInsurance: true });

  const metaHtml = `
    <div class="gcv2-iv-meta">
      <div><span class="gcv2-iv-meta-k">Consentimento RGPD aceite em</span> ${escHtml(fmtDataHora(tokenRow.rgpd_accepted_at))}</div>
      <div><span class="gcv2-iv-meta-k">Questionário concluído em</span> ${escHtml(fmtDataHora(tokenRow.completed_at))}</div>
    </div>`;

  const seccoesHtml = (cfg.seccoes || []).map(sec => {
    const perguntasHtml = (sec.perguntas || []).map(p => {
      const val = answersByQid.has(p.id) ? answersByQid.get(p.id) : null;
      const label = p.label || p.titulo || '';
      return `
        <div class="gcv2-iv-q">
          <div class="gcv2-iv-qlabel">${escHtml(label)}</div>
          <div class="gcv2-iv-qval">${formatAnswer(p, val)}</div>
        </div>`;
    }).join('');
    return `
      <div class="gcv2-iv-sec">
        <div class="gcv2-iv-slabel">${escHtml(sec.titulo)}</div>
        ${perguntasHtml}
      </div>`;
  }).join('');

  return `${patientCard}${metaHtml}${seccoesHtml}`;
}

// -----------------------------------------------------------------
// Modal principal
// -----------------------------------------------------------------
export async function openIntakeResponseModal({ patientId, clinicId, tokenRow, onClose } = {}) {
  if (!patientId || !tokenRow?.id) { console.warn('[intake-viewer] parâmetros em falta'); return; }

  ensureShellCss();
  ensureAtestadoCss();
  ensureIntakeViewerCss();

  const tipo = tokenRow.questionnaire_type;
  let cfgMod;
  try {
    cfgMod = await import('../../../intake/configs/' + tipo + '.js');
  } catch (e) {
    alert('Tipo de questionário desconhecido: ' + tipo);
    return;
  }
  const cfg = cfgMod.default;

  const [patient, clinic, doctor, vinhetaUrl, respostas] = await Promise.all([
    loadPatient(patientId),
    clinicId ? loadClinicById(clinicId) : Promise.resolve(null),
    loadCurrentDoctor(),
    getVinhetaDataUrl(),
    loadRespostas(tokenRow.id),
  ]);

  const answersByQid = new Map((respostas || []).map(r => [r.question_id, r.answer]));
  const dataRef = (tokenRow.completed_at || tokenRow.created_at || '').slice(0, 10);

  const overlay = document.createElement('div');
  overlay.className = 'gcv2-iv-overlay';
  overlay.innerHTML = `
    <div class="gcv2-iv-modal">
      <header class="gcv2-iv-head">
        <h2>${escHtml(cfg.titulo || 'Questionário')}</h2>
        <button class="gcv2-iv-close" aria-label="Fechar">×</button>
      </header>

      <main class="gcv2-iv-preview">
        <div id="gcv2-iv-preview-host"></div>
      </main>

      <div class="gcv2-iv-actions">
        <button class="gcv2-btn gcv2-btn-secondary" id="gcv2-iv-fechar">Fechar</button>
        <button class="gcv2-btn gcv2-btn-primary" id="gcv2-iv-pdf">Gerar PDF</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  function renderPreview() {
    const body = buildIntakeBody({ patient, tokenRow, cfg, answersByQid });
    const shellHtml = buildShellV2({
      clinic, doctor,
      config: {
        kicker: 'Medicina Física & Reabilitação',
        title: cfg.titulo || 'Questionário',
        date: dataRef,
        vinhetaUrl,
      },
      contentHtml: body,
    });
    const host = overlay.querySelector('#gcv2-iv-preview-host');
    if (host) host.innerHTML = shellHtml;
  }
  renderPreview();

  function closeModal() {
    overlay.remove();
    if (typeof onClose === 'function') onClose();
  }
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  overlay.querySelector('.gcv2-iv-close').addEventListener('click', closeModal);
  overlay.querySelector('#gcv2-iv-fechar').addEventListener('click', closeModal);

  // -------- Gerar PDF + guardar --------
  overlay.querySelector('#gcv2-iv-pdf').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = 'A gerar PDF…';

    try {
      const html = overlay.querySelector('#gcv2-iv-preview-host').innerHTML;
      const styles = Array.from(document.querySelectorAll('link[data-gcv2-shell], link[data-gcv2-atestado], link[data-gcv2-iv]'))
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

      const friendlyFileName = buildFriendlyFileName('Questionario', patient?.full_name, dataRef);
      openAndDownloadPdf(blob, friendlyFileName);

      // Guardar em documents/
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `questionario_${dataRef}_${ts}.pdf`;
      const path = `clinic_${clinic?.id || 'unknown'}/patient_${patientId}/questionarios/${fileName}`;
      const { error: upErr } = await window.sb.storage.from('documents').upload(path, blob, {
        contentType: 'application/pdf',
        upsert: true,
      });
      if (upErr) throw new Error(`Falha no upload para Storage: ${upErr.message || upErr}`);

      const { error: insErr } = await window.sb.from('documents').insert({
        clinic_id: clinic?.id || null,
        patient_id: patientId,
        consultation_id: null,
        title: `${cfg.titulo || 'Questionário'} — ${patient?.full_name || 'desconhecido'} — ${dataRef}`,
        html: fullHtml,
        storage_path: path,
        category: 'questionario',
      });
      if (insErr) throw new Error(`Falha ao registar em documents: ${insErr.message || insErr}`);

      btn.disabled = false;
      btn.textContent = 'Gerar PDF';
    } catch (err) {
      console.error('[intake-viewer] erro a gerar PDF:', err);
      alert('Erro a gerar PDF: ' + (err?.message || err));
      btn.disabled = false;
      btn.textContent = 'Gerar PDF';
    }
  });
}

// Expor globalmente (padrão dos outros geradores v2)
if (typeof window !== 'undefined') {
  window.__gcv2_openIntakeResponseModal = openIntakeResponseModal;
}
