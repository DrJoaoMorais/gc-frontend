// =================================================================
// atestado.js  ·  Atestado de Doença + Atestado de Educação Física
// =================================================================
// Modal com formulário (esquerda) + preview live (direita).
// Gera PDF via Cloudflare Worker, guarda em documents/.
// =================================================================

import { buildShellV2, loadClinicById, loadCurrentDoctor, getVinhetaDataUrl } from '../_shell/shell-v2.js';
import { buildPatientCard } from '../_components/patient-card.js';
import { buildPeriodEditor, bindPeriodEditor, readPeriodState, formatPeriodPt, defaultPeriodState } from '../_components/period.js';

const escAttr = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));
const escHtml = escAttr;

// -----------------------------------------------------------------
// Configuração por tipo de atestado
// -----------------------------------------------------------------
const TIPOS = {
  doenca: {
    titulo: 'Atestado de Doença',
    categoria: 'atestado_doenca',
    impossOptions: [
      { label: 'actividade laboral',     prep: 'da' },
      { label: 'frequência das aulas',   prep: 'da' },
      { label: 'prática desportiva',     prep: 'da' },
      { label: 'condução de veículos',   prep: 'da' },
    ],
    impossDefault: 'actividade laboral',
  },
  edfisica: {
    titulo: 'Atestado de Educação Física',
    categoria: 'atestado_edfisica',
    impossOptions: [
      { label: 'aulas práticas de educação física',            prep: 'das' },
      { label: 'aulas de educação física e desporto escolar',  prep: 'das' },
      { label: 'exercício físico em geral',                    prep: 'do' },
    ],
    impossDefault: 'aulas práticas de educação física',
  },
};

const PREP_OUTRO = 'de';

// -----------------------------------------------------------------
// Helpers
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
  lnk.href = new URL('./atestado.css', import.meta.url).href;
  lnk.dataset.gcv2Atestado = '1';
  document.head.appendChild(lnk);
}

async function loadLastConsult(patientId) {
  const { data, error } = await window.sb
    .from('consultations')
    .select('id, clinic_id, report_date, created_at')
    .eq('patient_id', patientId)
    .order('report_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) { console.error('[atestado] erro a obter última consulta:', error); return null; }
  return data || null;
}

async function loadPatient(patientId) {
  const { data, error } = await window.sb
    .from('patients')
    .select('id, full_name, dob, sex, nif, sns, cc_number, passport_id, address_line1, postal_code, city')
    .eq('id', patientId)
    .single();
  if (error) { console.error('[atestado] erro a obter doente:', error); return null; }
  return data;
}

// -----------------------------------------------------------------
// Corpo do atestado (texto formal)
// -----------------------------------------------------------------
function buildAtestadoBody({ doctor, patient, tipoImpossibilidade, prepImpossibilidade = 'de', motivo, periodoTexto }) {
  const doutor   = escHtml(doctor?.nome_completo || '—');
  const om       = escHtml(doctor?.numero_ordem || '—');
  const esp      = escHtml(doctor?.especialidade || '');
  const espDet   = escHtml(doctor?.especialidade_detail || '');
  const paciente = escHtml(patient?.full_name || '—');
  const sexo     = (patient?.sex || '').toLowerCase();
  const artigo   = sexo === 'f' ? 'a' : 'o';
  const impos    = escHtml(tipoImpossibilidade || '—');
  const prep     = escHtml(prepImpossibilidade || 'de');
  const mot      = motivo && motivo.trim() ? ` por ${escHtml(motivo.trim())}` : '';
  const periodo  = escHtml(periodoTexto || '');

  const creditos = [
    `Eu, <strong>${doutor}</strong>`,
    `Licenciado pela Faculdade de Medicina da Universidade de Coimbra`,
    esp ? `Médico Especialista em ${esp}` : '',
    espDet ? `Pós-graduado em ${espDet}` : '',
    `Cédula Profissional nº ${om}`,
  ].filter(Boolean).join(', ');

  return `
    <div class="gcv2-atestado-body">
      <p class="gcv2-at-creditos">${creditos},</p>

      <p class="gcv2-at-frase">
        atesto por minha honra que ${artigo} <strong>${paciente}</strong>
        se encontra impossibilitad${artigo} ${prep} <strong>${impos}</strong>${mot}
        <strong>${periodo}</strong>.
      </p>

      <p class="gcv2-at-final">
        Por ser verdade e me ter sido pedido, dato e assino o presente atestado.
      </p>
    </div>
  `;
}

// -----------------------------------------------------------------
// Modal principal
// -----------------------------------------------------------------
export async function openAtestadoModal({ tipo = 'doenca', patientId, onClose } = {}) {
  if (!patientId) { console.warn('[atestado] sem patientId'); return; }
  const cfg = TIPOS[tipo];
  if (!cfg) { console.warn('[atestado] tipo inválido:', tipo); return; }

  ensureShellCss();
  ensureAtestadoCss();

  // Carregar contexto em paralelo
  const lastConsult = await loadLastConsult(patientId);
  const clinicId = lastConsult?.clinic_id || null;
  const consultationId = lastConsult?.id || null;
  const [patient, clinic, doctor, vinhetaUrl] = await Promise.all([
    loadPatient(patientId),
    clinicId ? loadClinicById(clinicId) : Promise.resolve(null),
    loadCurrentDoctor(),
    getVinhetaDataUrl(),
  ]);

  // Estado local
  const state = {
    tipo,
    tipoImpossibilidade: cfg.impossDefault,
    tipoImpossibilidadeOutro: '',
    motivo: '',
    period: defaultPeriodState(),
    signDate: new Date().toISOString().slice(0, 10),
  };

  // Construir overlay
  const overlay = document.createElement('div');
  overlay.className = 'gcv2-atestado-overlay';
  overlay.innerHTML = `
    <div class="gcv2-atestado-modal">
      <header class="gcv2-atestado-head">
        <h2>${escHtml(cfg.titulo)}</h2>
        <button class="gcv2-at-close" aria-label="Fechar">×</button>
      </header>

      <div class="gcv2-atestado-split">
        <aside class="gcv2-atestado-form">
          <label class="gcv2-at-field">
            <span>Tipo de impossibilidade</span>
            <select id="gcv2-at-impos">
              ${cfg.impossOptions.map(o => `<option value="${escAttr(o.label)}" data-prep="${escAttr(o.prep)}" ${o.label === state.tipoImpossibilidade ? 'selected' : ''}>${escHtml(o.label)}</option>`).join('')}
              <option value="__outro__">outro…</option>
            </select>
          </label>

          <label class="gcv2-at-field" id="gcv2-at-outro-wrap" hidden>
            <span>Especificar</span>
            <input type="text" id="gcv2-at-outro" placeholder="Descreva o tipo de impossibilidade">
          </label>

          <label class="gcv2-at-field">
            <span>Motivo <small>(opcional — ex: lesão músculo-esquelética)</small></span>
            <input type="text" id="gcv2-at-motivo" placeholder="por …">
          </label>

          <div class="gcv2-at-field">
            <span>Período</span>
            ${buildPeriodEditor({ state: state.period, idPrefix: 'gcv2at-per' })}
          </div>

          <label class="gcv2-at-field">
            <span>Data de assinatura</span>
            <input type="date" id="gcv2-at-signdate" value="${state.signDate}">
          </label>

          <div class="gcv2-at-actions">
            <button class="gcv2-btn gcv2-btn-secondary" id="gcv2-at-cancel">Cancelar</button>
            <button class="gcv2-btn gcv2-btn-primary" id="gcv2-at-gen">Gerar PDF</button>
          </div>
        </aside>

        <main class="gcv2-atestado-preview">
          <div id="gcv2-at-preview-host"></div>
        </main>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // -------- Render do preview --------
  function getEffectiveImpos() {
    return state.tipoImpossibilidade === '__outro__'
      ? (state.tipoImpossibilidadeOutro || '—')
      : state.tipoImpossibilidade;
  }

  function getEffectivePrep() {
    if (state.tipoImpossibilidade === '__outro__') return PREP_OUTRO;
    const opt = cfg.impossOptions.find(o => o.label === state.tipoImpossibilidade);
    return opt?.prep || 'de';
  }

  function renderPreview() {
    const body = buildAtestadoBody({
      doctor,
      patient,
      tipoImpossibilidade: getEffectiveImpos(),
      prepImpossibilidade: getEffectivePrep(),
      motivo: state.motivo,
      periodoTexto: formatPeriodPt(state.period),
    });

    const shellHtml = buildShellV2({
      clinic, doctor,
      config: {
        kicker: 'Medicina Física & Reabilitação',
        title: cfg.titulo,
        date: state.signDate,
        vinhetaUrl,
      },
      contentHtml: body,
    });

    const host = overlay.querySelector('#gcv2-at-preview-host');
    if (host) host.innerHTML = shellHtml;
  }

  renderPreview();

  // -------- Bindings --------
  const sel = overlay.querySelector('#gcv2-at-impos');
  const outroWrap = overlay.querySelector('#gcv2-at-outro-wrap');
  const outroIn = overlay.querySelector('#gcv2-at-outro');
  sel.addEventListener('change', () => {
    state.tipoImpossibilidade = sel.value;
    outroWrap.hidden = sel.value !== '__outro__';
    renderPreview();
  });
  outroIn.addEventListener('input', () => {
    state.tipoImpossibilidadeOutro = outroIn.value;
    renderPreview();
  });

  overlay.querySelector('#gcv2-at-motivo').addEventListener('input', (e) => {
    state.motivo = e.target.value;
    renderPreview();
  });

  bindPeriodEditor({
    idPrefix: 'gcv2at-per',
    onChange: (newState) => { state.period = newState; renderPreview(); },
  });

  overlay.querySelector('#gcv2-at-signdate').addEventListener('change', (e) => {
    state.signDate = e.target.value;
    renderPreview();
  });

  // -------- Fechar --------
  function closeModal() {
    overlay.remove();
    if (typeof onClose === 'function') onClose();
  }
  overlay.querySelector('.gcv2-at-close').addEventListener('click', closeModal);
  overlay.querySelector('#gcv2-at-cancel').addEventListener('click', closeModal);

  // -------- Gerar PDF + guardar --------
  overlay.querySelector('#gcv2-at-gen').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = 'A gerar PDF…';

    try {
      const html = overlay.querySelector('#gcv2-at-preview-host').innerHTML;
      const styles = Array.from(document.querySelectorAll('link[data-gcv2-shell], link[data-gcv2-atestado]'))
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

      // Abrir numa nova aba
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');

      // Guardar em documents/
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `${cfg.categoria}_${state.signDate}_${ts}.pdf`;
      const path = `clinic_${clinic?.id || 'unknown'}/patient_${patientId}/atestados/${fileName}`;
      const { error: upErr } = await window.sb.storage.from('documents').upload(path, blob, {
        contentType: 'application/pdf',
        upsert: true,
      });
      if (upErr) console.warn('[atestado] upload storage falhou:', upErr);

      const { error: insErr } = await window.sb.from('documents').insert({
        patient_id: patientId,
        clinic_id: clinic?.id || null,
        consultation_id: consultationId,
        category: cfg.categoria,
        title: cfg.titulo,
        storage_path: path,
        version: 1,
      });
      if (insErr) console.warn('[atestado] insert documents falhou:', insErr);

      closeModal();
    } catch (err) {
      console.error('[atestado] erro a gerar PDF:', err);
      alert('Erro a gerar PDF: ' + (err?.message || err));
      btn.disabled = false;
      btn.textContent = 'Gerar PDF';
    }
  });
}

// Expor globalmente
if (typeof window !== 'undefined') {
  window.__gcv2_openAtestadoModal = openAtestadoModal;
}
