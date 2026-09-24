import { clinicalHTML, editorHTML } from './content.js';
import { calcAgeYears } from '../helpers.js';

export function enhanceClinicalEditor(quill, { ai = false, sb = () => window.sb, patient = () => null } = {}) {
  if (quill.__clinicalEnhanced) return;
  quill.__clinicalEnhanced = true;
  quill.root.lang = 'pt-PT';
  quill.root.spellcheck = true;
  // Quill only indents with Tab at the start of a line by default.
  // Clinical editing expects Tab/Shift+Tab to change level anywhere in a list.
  quill.root.addEventListener('keydown', event => {
    if (event.key !== 'Tab' || event.ctrlKey || event.metaKey || event.altKey) return;
    const range = quill.getSelection();
    if (!range || !quill.getFormat(range).list) return;
    event.preventDefault(); event.stopImmediatePropagation();
    quill.formatLine(range.index, range.length, 'indent', event.shiftKey ? '-1' : '+1', 'user');
  }, true);
  const toolbar = quill.getModule('toolbar')?.container;
  if (toolbar) {
    const group = document.createElement('span');
    group.className = 'ql-formats';
    const add = (label, text, action) => {
      const button = document.createElement('button');
      button.type = 'button'; button.title = label; button.setAttribute('aria-label', label);
      button.textContent = text;
      button.style.fontSize = '18px';
      button.addEventListener('mousedown', e => e.preventDefault());
      button.addEventListener('click', action);
      group.appendChild(button);
    };
    add('Diminuir nível (Shift+Tab)', '⇤', () => quill.format('indent', '-1', 'user'));
    add('Aumentar nível (Tab)', '⇥', () => quill.format('indent', '+1', 'user'));
    add('Desfazer', '↶', () => quill.history.undo());
    add('Refazer', '↷', () => quill.history.redo());
    toolbar.appendChild(group);
    const labels = { bold:'Negrito', italic:'Itálico', underline:'Sublinhado', clean:'Limpar formatação' };
    Object.entries(labels).forEach(([name,label]) => toolbar.querySelectorAll(`.ql-${name}`).forEach(b => { b.title=label; b.setAttribute('aria-label',label); }));
    toolbar.querySelectorAll('.ql-list').forEach(b => { b.title=b.value==='bullet'?'Lista com bolas':'Lista numerada'; b.setAttribute('aria-label',b.title); });
    if (ai) {
      let button = toolbar.querySelector('#btnHdaAi');
      if (!button) {
        const aiGroup = document.createElement('span');
        aiGroup.className = 'ql-formats';
        button=document.createElement('button'); button.type='button';
        aiGroup.appendChild(button); toolbar.appendChild(aiGroup);
      }
      button.textContent = 'Assistente IA';
      button.title = 'Assistente IA'; button.setAttribute('aria-label', 'Assistente IA');
      button.style.cssText = 'width:auto;font:inherit;font-size:12px;color:#1a56db;padding:0 8px;';
      button.onclick = () => openAiAssistant(quill, sb(), patient());
    }
  }
  // Capture before Quill's clipboard listener: normalize legacy lists and remove
  // external styling/active content, retaining clinical text and list hierarchy.
  quill.root.addEventListener('paste', event => {
    const html = event.clipboardData?.getData('text/html');
    if (!html || !quill.isEnabled()) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const range = quill.getSelection(true);
    const delta = quill.clipboard.convert({html:clinicalHTML(html),text:event.clipboardData.getData('text/plain')});
    const Delta = window.Quill.import('delta');
    quill.history.cutoff();
    quill.updateContents(new Delta().retain(range.index).delete(range.length).concat(delta), 'user');
    quill.setSelection(range.index + delta.length(), 0, 'silent');
    quill.history.cutoff();
  }, true);
}

const ALLOWED_BLOCK_TYPES = new Set(['paragraph', 'bullet', 'ordered']);
const ALLOWED_ALERT_TYPES = new Set(['inconsistency', 'warning']);
const ALLOWED_CONFIDENCE = new Set(['low', 'moderate', 'high']);
const CONFIDENCE_LABEL = { low: 'confiança baixa', moderate: 'confiança moderada', high: 'confiança alta' };

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasOnlyKeys(obj, allowed) {
  return obj != null && typeof obj === 'object' && Object.keys(obj).every(k => allowed.includes(k));
}

// Mirrors the server-side validation (defense in depth): rejects the whole
// response on any invalid block. Never trusts shape/content from the network.
function validateBlocks(blocks) {
  if (!Array.isArray(blocks)) return null;
  const out = [];
  for (const raw of blocks) {
    if (!raw || typeof raw !== 'object' || !hasOnlyKeys(raw, ['type', 'text', 'level'])) return null;
    const { type, text, level } = raw;
    if (!ALLOWED_BLOCK_TYPES.has(type)) return null;
    if (!isNonEmptyString(text)) return null;
    if (!Number.isInteger(level) || level < 0 || level > 2) return null;
    if (type === 'paragraph' && level !== 0) return null;
    out.push({ type, text: text.trim(), level });
  }
  return out;
}

function validateItemList(list, validateItem) {
  if (!Array.isArray(list)) return null;
  const out = [];
  for (const raw of list) {
    const item = validateItem(raw);
    if (!item) return null;
    out.push(item);
  }
  return out;
}

const validateAlert = raw => {
  if (!raw || typeof raw !== 'object' || !hasOnlyKeys(raw, ['type', 'title', 'text'])) return null;
  const { type, title, text } = raw;
  if (!ALLOWED_ALERT_TYPES.has(type) || !isNonEmptyString(title) || !isNonEmptyString(text)) return null;
  return { type, title: title.trim(), text: text.trim() };
};
const validateMissingInfo = raw => {
  if (!raw || typeof raw !== 'object' || !hasOnlyKeys(raw, ['question', 'reason'])) return null;
  const { question, reason } = raw;
  if (!isNonEmptyString(question) || !isNonEmptyString(reason)) return null;
  return { question: question.trim(), reason: reason.trim() };
};
const validateHypothesis = raw => {
  if (!raw || typeof raw !== 'object' || !hasOnlyKeys(raw, ['label', 'reason', 'confidence'])) return null;
  const { label, reason, confidence } = raw;
  if (!ALLOWED_CONFIDENCE.has(confidence) || !isNonEmptyString(label) || !isNonEmptyString(reason)) return null;
  return { label: label.trim(), reason: reason.trim(), confidence };
};
const validateExam = raw => {
  if (!raw || typeof raw !== 'object' || !hasOnlyKeys(raw, ['exam', 'reason'])) return null;
  const { exam, reason } = raw;
  if (!isNonEmptyString(exam) || !isNonEmptyString(reason)) return null;
  return { exam: exam.trim(), reason: reason.trim() };
};
const validateTreatment = raw => {
  if (!raw || typeof raw !== 'object' || !hasOnlyKeys(raw, ['item', 'reason'])) return null;
  const { item, reason } = raw;
  if (!isNonEmptyString(item) || !isNonEmptyString(reason)) return null;
  return { item: item.trim(), reason: reason.trim() };
};
const validateObjective = raw => {
  if (!raw || typeof raw !== 'object' || !hasOnlyKeys(raw, ['item'])) return null;
  const { item } = raw;
  if (!isNonEmptyString(item)) return null;
  return { item: item.trim() };
};
const validateHep = raw => {
  if (!raw || typeof raw !== 'object' || !hasOnlyKeys(raw, ['exercise', 'reason', 'caution'])) return null;
  const { exercise, reason, caution } = raw;
  if (!isNonEmptyString(exercise) || !isNonEmptyString(reason) || !isNonEmptyString(caution)) return null;
  return { exercise: exercise.trim(), reason: reason.trim(), caution: caution.trim() };
};

// 'data' is the full ai-proxy response: the 8 analysis keys plus our own
// 'provider'/'model' metadata (added server-side, not authored by the model).
const ANALYSIS_KEYS = ['clinical_note', 'alerts', 'missing_information', 'diagnostic_hypotheses', 'suggested_exams', 'treatment_options', 'objectives', 'hep_suggestions', 'provider', 'model'];

// Rejects the whole analysis on any invalid section — never a partial/silent fallback.
function validateAnalysis(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || !hasOnlyKeys(data, ANALYSIS_KEYS)) return null;
  if (!data.clinical_note || typeof data.clinical_note !== 'object' || !hasOnlyKeys(data.clinical_note, ['blocks'])) return null;
  const blocks = validateBlocks(data.clinical_note.blocks);
  if (!blocks) return null;
  const alerts = validateItemList(data.alerts, validateAlert);
  const missing_information = validateItemList(data.missing_information, validateMissingInfo);
  const diagnostic_hypotheses = validateItemList(data.diagnostic_hypotheses, validateHypothesis);
  const suggested_exams = validateItemList(data.suggested_exams, validateExam);
  const treatment_options = validateItemList(data.treatment_options, validateTreatment);
  const objectives = validateItemList(data.objectives, validateObjective);
  const hep_suggestions = validateItemList(data.hep_suggestions, validateHep);
  if (!alerts || !missing_information || !diagnostic_hypotheses || !suggested_exams || !treatment_options || !objectives || !hep_suggestions) return null;
  return {
    clinical_note: { blocks },
    alerts, missing_information, diagnostic_hypotheses,
    suggested_exams, treatment_options, objectives, hep_suggestions
  };
}

// Read-only visual preview built only from validated blocks. Every node is
// created locally and filled with textContent — no AI text is ever parsed as markup.
function renderBlocksPreview(container, blocks) {
  container.replaceChildren();
  const levels = [];
  for (const block of blocks) {
    if (block.type === 'paragraph') {
      levels.length = 0;
      const p = document.createElement('p');
      p.textContent = block.text;
      container.append(p);
      continue;
    }
    const tag = block.type === 'bullet' ? 'ul' : 'ol';
    const depth = Math.min(block.level, levels.length);
    levels.length = depth;
    if (!levels[depth] || levels[depth].tag !== tag) {
      const listEl = document.createElement(tag);
      const parent = depth === 0 ? container : levels[depth - 1].lastLi;
      parent.append(listEl);
      levels[depth] = { tag, el: listEl, lastLi: null };
    }
    const li = document.createElement('li');
    li.textContent = block.text;
    levels[depth].el.append(li);
    levels[depth].lastLi = li;
    levels.length = depth + 1;
  }
}

// Converts validated blocks into a Quill Delta. All formatting comes from our
// own block types/levels — never from AI-supplied HTML or markup.
function blocksToDelta(blocks) {
  const Delta = window.Quill.import('delta');
  const delta = new Delta();
  for (const block of blocks) {
    delta.insert(block.text);
    const attrs = {};
    if (block.type === 'bullet' || block.type === 'ordered') {
      attrs.list = block.type;
      if (block.level > 0) attrs.indent = block.level;
    }
    delta.insert('\n', Object.keys(attrs).length ? attrs : undefined);
  }
  return delta;
}

let stylesInjected = false;
function ensureAssistantStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    .clinical-ai-layout{display:flex;gap:14px;align-items:flex-start;}
    .clinical-ai-layout>.ql-container{flex:1 1 auto;min-width:0;}
    .clinical-ai-panel{flex:0 0 340px;max-width:340px;box-sizing:border-box;padding:12px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;max-height:520px;overflow:auto;}
    @media (max-width:860px){
      .clinical-ai-layout{flex-direction:column;}
      .clinical-ai-panel{flex:1 1 auto;max-width:none;width:100%;}
    }
    .clinical-ai-header{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:6px;}
    .clinical-ai-header strong{margin-right:auto;}
    .clinical-ai-counter{font-size:12px;color:#64748b;}
    .clinical-ai-section{margin-top:12px;padding-top:10px;border-top:1px solid #e2e8f0;}
    .clinical-ai-section:first-of-type{margin-top:0;padding-top:0;border-top:0;}
    .clinical-ai-section h4{margin:0 0 6px;font-size:13px;}
    .clinical-ai-section ul{margin:0;padding-left:18px;}
    .clinical-ai-section li{margin-bottom:8px;}
    .clinical-ai-section li p{margin:2px 0 0;font-size:12px;color:#475569;}
    .clinical-ai-alert-inconsistency strong{color:#b45309;}
    .clinical-ai-caution{font-style:italic;}
    .clinical-ai-note-preview{background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:4px 12px;margin:4px 0 8px;}
    .clinical-ai-note-actions button{margin-right:8px;}
    .clinical-ai-note-status{min-height:1.2em;font-size:12px;}
  `;
  document.head.appendChild(style);
}

// Builds a heading + <ul> section only when there is at least one item to show.
function renderListSection(container, heading, items, fillItem) {
  if (!items.length) return;
  const section = document.createElement('section');
  section.className = 'clinical-ai-section';
  const h = document.createElement('h4');
  h.textContent = heading;
  section.append(h);
  const list = document.createElement('ul');
  for (const item of items) {
    const li = document.createElement('li');
    fillItem(li, item);
    list.append(li);
  }
  section.append(list);
  container.append(section);
}

function renderClinicalNoteSection(container, state, blocks, snapshot) {
  const section = document.createElement('section');
  section.className = 'clinical-ai-section';
  const h = document.createElement('h4');
  h.textContent = 'Texto estruturado';
  section.append(h);
  const preview = document.createElement('div');
  preview.className = 'clinical-ai-note-preview';
  renderBlocksPreview(preview, blocks);
  section.append(preview);

  const actions = document.createElement('div');
  actions.className = 'clinical-ai-note-actions';
  const applyBtn = document.createElement('button');
  applyBtn.type = 'button'; applyBtn.textContent = 'Aplicar à HDA';
  const keepBtn = document.createElement('button');
  keepBtn.type = 'button'; keepBtn.textContent = 'Manter original';
  const noteStatus = document.createElement('p');
  noteStatus.className = 'clinical-ai-note-status';
  noteStatus.setAttribute('role', 'status');

  applyBtn.onclick = () => {
    const { quill } = state;
    if (editorHTML(quill) !== snapshot) {
      noteStatus.textContent = 'O original foi alterado entretanto. Mantém o original e pede uma nova análise.';
      applyBtn.disabled = true;
      return;
    }
    quill.history.cutoff();
    quill.setContents(blocksToDelta(blocks), 'user');
    quill.history.cutoff();
    applyBtn.disabled = true; keepBtn.disabled = true;
    noteStatus.textContent = 'Aplicado à HDA. Podes desfazer no editor.';
  };
  keepBtn.onclick = () => {
    applyBtn.disabled = true; keepBtn.disabled = true;
    noteStatus.textContent = 'Original mantido.';
  };

  actions.append(applyBtn, keepBtn);
  section.append(actions, noteStatus);
  container.append(section);
}

function fillAlert(li, alert) {
  li.className = 'clinical-ai-alert-' + alert.type;
  const strong = document.createElement('strong');
  strong.textContent = (alert.type === 'inconsistency' ? '⚠ ' : 'ℹ ') + alert.title;
  const p = document.createElement('p');
  p.textContent = alert.text;
  li.append(strong, p);
}
function fillMissingInfo(li, info) {
  li.textContent = info.question;
}
function fillHypothesis(li, hypothesis) {
  const strong = document.createElement('strong');
  strong.textContent = `${hypothesis.label} (${CONFIDENCE_LABEL[hypothesis.confidence]})`;
  const p = document.createElement('p');
  p.textContent = hypothesis.reason;
  li.append(strong, p);
}
function fillExam(li, exam) {
  const strong = document.createElement('strong');
  strong.textContent = exam.exam;
  const p = document.createElement('p');
  p.textContent = exam.reason;
  li.append(strong, p);
}
function fillTreatment(li, treatment) {
  const strong = document.createElement('strong');
  strong.textContent = treatment.item;
  const p = document.createElement('p');
  p.textContent = treatment.reason;
  li.append(strong, p);
}
function fillObjective(li, objective) {
  li.textContent = objective.item;
}
function fillHep(li, hep) {
  const strong = document.createElement('strong');
  strong.textContent = hep.exercise;
  const p = document.createElement('p');
  p.textContent = hep.reason;
  const caution = document.createElement('p');
  caution.className = 'clinical-ai-caution';
  caution.textContent = 'Cautela: ' + hep.caution;
  li.append(strong, p, caution);
}

function renderAnalysis(state, analysis, snapshot) {
  const { bodyEl, counterEl } = state;
  bodyEl.replaceChildren();
  renderListSection(bodyEl, 'Alertas', analysis.alerts, fillAlert);
  renderListSection(bodyEl, 'Informação em falta', analysis.missing_information, fillMissingInfo);
  renderClinicalNoteSection(bodyEl, state, analysis.clinical_note.blocks, snapshot);
  renderListSection(bodyEl, 'Hipóteses a considerar', analysis.diagnostic_hypotheses, fillHypothesis);
  renderListSection(bodyEl, 'Exames a ponderar', analysis.suggested_exams, fillExam);
  renderListSection(bodyEl, 'Tratamento', analysis.treatment_options, fillTreatment);
  renderListSection(bodyEl, 'Objetivos', analysis.objectives, fillObjective);
  renderListSection(bodyEl, 'HEP', analysis.hep_suggestions, fillHep);
  counterEl.textContent = `IA · ${state.callCount} ${state.callCount === 1 ? 'análise' : 'análises'}`;
}

// Builds "CONTEXTO CONHECIDO:" from already-known, non-identifying clinical
// fields only — never name/SNS/NIF/phone/email/address. Empty fields are
// simply omitted; the whole block is omitted when there is nothing to say.
function formatAlertas(alertas) {
  if (!alertas || typeof alertas !== 'object') return '';
  const parts = [];
  if (alertas.pacemaker) parts.push('Pacemaker');
  if (isNonEmptyString(alertas.alergias)) parts.push(`Alergias: ${alertas.alergias.trim()}`);
  if (isNonEmptyString(alertas.outros)) parts.push(`Outros: ${alertas.outros.trim()}`);
  return parts.join('; ');
}

function buildClinicalContext(patient) {
  if (!patient) return '';
  const lines = [];
  const age = patient.dob ? calcAgeYears(patient.dob) : null;
  if (Number.isFinite(age)) lines.push(`Idade: ${age} anos`);
  if (isNonEmptyString(patient.profissao)) lines.push(`Profissão: ${patient.profissao.trim()}`);
  if (isNonEmptyString(patient.atividade_desportiva)) lines.push(`Atividade desportiva: ${patient.atividade_desportiva.trim()}`);
  if (isNonEmptyString(patient.antecedentes_pessoais)) lines.push(`Antecedentes pessoais: ${patient.antecedentes_pessoais.trim()}`);
  if (isNonEmptyString(patient.antecedentes_medicamentosos)) lines.push(`Antecedentes medicamentosos: ${patient.antecedentes_medicamentosos.trim()}`);
  if (isNonEmptyString(patient.antecedentes_cirurgicos)) lines.push(`Antecedentes cirúrgicos: ${patient.antecedentes_cirurgicos.trim()}`);
  const alertasText = formatAlertas(patient.alertas);
  if (alertasText) lines.push(`Alertas clínicos: ${alertasText}`);
  return lines.join('\n');
}

function buildPrompt(hdaText, patient) {
  const context = buildClinicalContext(patient);
  return context ? `HDA:\n${hdaText}\n\nCONTEXTO CONHECIDO:\n${context}` : `HDA:\n${hdaText}`;
}

// One call per click — no per-section calls, no automatic call on load.
let sessionAnalysisCount = 0;

async function runAnalysis(state) {
  const { quill, sb, patient, panel, statusEl, bodyEl, counterEl, refreshBtn } = state;
  if (!quill.getText().trim()) { statusEl.textContent = 'Escreve primeiro o texto clínico.'; return; }
  const snapshot = editorHTML(quill);
  statusEl.textContent = 'A analisar…';
  refreshBtn.disabled = true;
  try {
    if (!sb?.functions?.invoke) throw new Error('A ligação de IA não está disponível.');
    const { data: session, error: sessionError } = await sb.auth.getSession();
    if (sessionError || !session?.session) throw new Error('Inicia sessão para utilizar a IA.');
    const prompt = buildPrompt(quill.getText().trim(), patient);
    const { data, error } = await sb.functions.invoke('ai-proxy', { body: { mode: 'estruturar', prompt } });
    if (!panel.isConnected || !quill.container.isConnected) return;
    sessionAnalysisCount += 1;
    state.callCount = sessionAnalysisCount;
    counterEl.textContent = `IA · ${state.callCount} ${state.callCount === 1 ? 'análise' : 'análises'}`;
    if (error || data?.error) throw new Error('Não foi possível obter a análise. O original foi mantido.');
    const analysis = validateAnalysis(data);
    if (!analysis) throw new Error('A IA devolveu uma resposta em formato inesperado.');
    bodyEl.replaceChildren();
    renderAnalysis(state, analysis, snapshot);
    statusEl.textContent = '';
  } catch (err) {
    if (panel.isConnected) statusEl.textContent = err.message;
  } finally {
    if (panel.isConnected) refreshBtn.disabled = false;
  }
}

export async function openAiAssistant(quill, sb, patient = null) {
  if (quill.__aiPanel?.isConnected) { quill.__aiPanel.focus(); return; }
  if (!quill.getText().trim()) { window.alert('Escreve primeiro o texto clínico.'); return; }
  ensureAssistantStyles();

  let layout = quill.__aiLayout;
  if (!layout) {
    layout = document.createElement('div');
    layout.className = 'clinical-ai-layout';
    quill.container.replaceWith(layout);
    layout.append(quill.container);
    quill.__aiLayout = layout;
  }

  const panel = document.createElement('section');
  panel.tabIndex = -1;
  panel.className = 'clinical-ai-panel';
  panel.setAttribute('aria-label', 'Assistente IA');
  panel.innerHTML = '<header class="clinical-ai-header"><strong>Assistente IA</strong><span data-counter class="clinical-ai-counter"></span><button type="button" data-refresh>Atualizar análise</button><button type="button" data-close aria-label="Fechar">✕</button></header><p data-status role="status"></p><div data-body></div>';
  layout.append(panel);
  quill.__aiPanel = panel;

  const state = {
    quill, sb, patient, panel,
    statusEl: panel.querySelector('[data-status]'),
    bodyEl: panel.querySelector('[data-body]'),
    counterEl: panel.querySelector('[data-counter]'),
    refreshBtn: panel.querySelector('[data-refresh]'),
    callCount: sessionAnalysisCount
  };
  state.counterEl.textContent = `IA · ${state.callCount} ${state.callCount === 1 ? 'análise' : 'análises'}`;
  panel.querySelector('[data-close]').onclick = () => { panel.remove(); quill.__aiPanel = null; quill.focus(); };
  state.refreshBtn.onclick = () => runAnalysis(state);

  await runAnalysis(state);
  if (panel.isConnected) panel.focus();
}
