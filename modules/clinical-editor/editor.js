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
      ensureAssistantStyles();
      let button = toolbar.querySelector('#btnHdaAi');
      if (!button) {
        const aiGroup = document.createElement('span');
        aiGroup.className = 'ql-formats';
        button=document.createElement('button'); button.type='button';
        aiGroup.appendChild(button); toolbar.appendChild(aiGroup);
      }
      button.className = 'clinical-ai-trigger';
      button.title = 'Assistente clínico IA'; button.setAttribute('aria-label', 'Assistente clínico IA');
      button.onclick = () => openAiAssistant(quill, sb(), patient());
      quill.__aiTriggerButton = button;
      updateAiTriggerLabel(quill);
      // Subtle indicator: label switches to "Actualizar" once the HDA changes after the last analysis.
      quill.on('text-change', (_delta, _oldDelta, source) => {
        if (source !== 'user') return;
        updateAiTriggerLabel(quill);
      });
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
    /* Toolbar trigger — deliberately separated from the Quill B/I/U/list commands. */
    .ql-toolbar .clinical-ai-trigger{display:inline-flex;align-items:center;height:28px;padding:0 11px;margin-left:9px;font:inherit;font-size:12.5px;font-weight:700;color:#1a56db;background:#eaf1ff !important;border:1px solid #a9c8f5 !important;border-radius:7px;cursor:pointer;white-space:nowrap;}
    .ql-toolbar .clinical-ai-trigger:hover{background:#dbe9ff !important;}
    .ql-toolbar .clinical-ai-trigger:focus-visible{outline:2px solid #1a56db;outline-offset:1px;}

    /* Layout: HDA stays comfortably wide, panel is a real clinical sidebar. */
    .clinical-ai-layout{display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start;}
    .clinical-ai-layout>.ql-container{flex:1 1 520px;min-width:520px;}
    .clinical-ai-panel{flex:0 0 clamp(440px,34vw,540px);max-width:540px;box-sizing:border-box;padding:0;border:1px solid #dbe3ee;border-radius:10px;background:#fff;box-shadow:0 4px 16px rgba(15,23,42,.07);max-height:min(680px,calc(100vh - 180px));overflow-y:auto;outline:none;}
    @media (max-width:1080px){
      .clinical-ai-layout>.ql-container{min-width:0;flex-basis:auto;}
      .clinical-ai-panel{flex:1 1 auto;max-width:none;width:100%;}
    }

    /* Header — sticky, one clear title, no visual duplication. flex-wrap is a
       safety net so the extra "Copiar tudo" button never forces overflow. */
    .clinical-ai-header{position:sticky;top:0;z-index:2;display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px;padding:13px 14px;background:#fff;border-bottom:1px solid #eef2f7;border-radius:10px 10px 0 0;}
    .clinical-ai-title{font-size:14px;font-weight:800;color:#0f172a;}
    .clinical-ai-counter{font-size:11.5px;color:#8b96a8;margin-right:auto;}
    .clinical-ai-status{padding:8px 14px 0;font-size:12.5px;color:#8b96a8;min-height:1.2em;}

    /* Shared button system — every Assistant button has its own CSS, never native. */
    .clinical-ai-btn{font:inherit;font-size:12.5px;font-weight:600;border-radius:6px;cursor:pointer;padding:6px 12px;border:1px solid #dbe3ee;background:#fff;color:#334155;line-height:1.3;}
    .clinical-ai-btn:hover{background:#f1f5f9;}
    .clinical-ai-btn:focus-visible{outline:2px solid #1a56db;outline-offset:1px;}
    .clinical-ai-btn:disabled{opacity:.5;cursor:not-allowed;}
    .clinical-ai-btn-primary{background:#1a56db;border-color:#1a56db;color:#fff;}
    .clinical-ai-btn-primary:hover:not(:disabled){background:#1547b8;}
    .clinical-ai-btn-ghost{background:transparent;border-color:#dbe3ee;color:#475569;}
    .clinical-ai-btn-ghost:hover:not(:disabled){background:#f8fafc;}
    .clinical-ai-btn-sm{padding:4px 10px;font-size:11.5px;}
    .clinical-ai-btn-icon{width:28px;height:28px;padding:0;display:inline-flex;align-items:center;justify-content:center;border-radius:7px;font-size:14px;line-height:1;color:#64748b;background:transparent;border-color:transparent;}
    .clinical-ai-btn-icon:hover{background:#f1f5f9;color:#0f172a;}

    /* Sections — thin unit, no boxed-in look. */
    .clinical-ai-body{padding:2px 0 6px;}
    .clinical-ai-section{padding:12px 14px;border-bottom:1px solid #eef2f7;}
    .clinical-ai-section:last-child{border-bottom:0;}
    .clinical-ai-section-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;}
    .clinical-ai-section h4{margin:0;font-size:13.5px;font-weight:700;color:#0f172a;}
    .clinical-ai-section ul{margin:0;padding-left:16px;list-style:disc;}
    .clinical-ai-section li{margin-bottom:8px;font-size:13px;line-height:1.5;color:#1e293b;}
    .clinical-ai-section li:last-child{margin-bottom:0;}
    .clinical-ai-section li strong{font-weight:700;color:#0f172a;}
    .clinical-ai-section li p{margin:2px 0 0;font-size:12.5px;line-height:1.5;color:#64748b;font-weight:400;}
    .clinical-ai-alert-inconsistency strong{color:#b45309;}
    .clinical-ai-confidence{display:inline-block;font-size:11px;font-weight:600;color:#64748b;background:#f1f5f9;border-radius:99px;padding:1px 8px;margin-left:6px;vertical-align:middle;}
    .clinical-ai-caution{font-style:italic;color:#94a3b8 !important;}

    /* Inline answers to "Informação em falta" — local-only, own compact look. */
    .clinical-ai-answer-wrap{display:flex;align-items:flex-start;gap:6px;margin-top:6px;}
    .clinical-ai-answer{flex:1;min-width:0;font:inherit;font-size:12.5px;line-height:1.4;padding:6px 8px;border:1px solid #dbe3ee;border-radius:6px;background:#fbfcfe;color:#1e293b;resize:vertical;min-height:30px;}
    .clinical-ai-answer:focus{outline:2px solid #1a56db;outline-offset:1px;border-color:#1a56db;}
    .clinical-ai-answer-check{flex:0 0 auto;color:#16a34a;font-weight:700;font-size:13px;line-height:1.8;}

    /* HDA enriquecida */
    .clinical-ai-note-preview{background:#f8fafc;border:1px solid #e7ecf3;border-radius:8px;padding:11px 12px;margin-bottom:10px;font-size:13px;line-height:1.55;color:#1e293b;}
    .clinical-ai-note-preview p{margin:0 0 6px;}
    .clinical-ai-note-preview p:last-child{margin-bottom:0;}
    .clinical-ai-note-actions{display:flex;align-items:center;flex-wrap:wrap;gap:8px;}
    .clinical-ai-note-status{min-height:1.2em;font-size:12px;color:#64748b;margin:6px 0 0;}

    /* Copiar — small, ghost, inline with the status message. */
    .clinical-ai-copy-row{display:inline-flex;align-items:center;gap:6px;}
    .clinical-ai-copy-status{font-size:11px;color:#64748b;}
  `;
  document.head.appendChild(style);
}

// Toggles the toolbar trigger label as a subtle "content changed since last
// analysis" indicator — no extra state beyond the last analyzed snapshot.
function updateAiTriggerLabel(quill) {
  const button = quill.__aiTriggerButton;
  if (!button) return;
  const changed = quill.__aiLastAnalyzedHTML != null && editorHTML(quill) !== quill.__aiLastAnalyzedHTML;
  button.textContent = changed ? '✦ Actualizar Assistente IA' : '✦ Assistente clínico IA';
}

// Small "Copiar" control appended to any section. Never calls the API, never
// touches the HDA/BD — just navigator.clipboard.writeText of plain PT-PT text.
function addCopyButton(container, getText) {
  const row = document.createElement('div');
  row.className = 'clinical-ai-copy-row';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'clinical-ai-btn clinical-ai-btn-ghost clinical-ai-btn-sm';
  button.textContent = 'Copiar';
  const status = document.createElement('span');
  status.className = 'clinical-ai-copy-status';
  status.setAttribute('role', 'status');
  button.onclick = async () => {
    try {
      await navigator.clipboard.writeText(getText());
      status.textContent = 'Copiado.';
    } catch {
      status.textContent = 'Não foi possível copiar.';
    }
    setTimeout(() => { status.textContent = ''; }, 2000);
  };
  row.append(button, status);
  container.append(row);
  return row;
}

const alertsText = items => items.map(a => `${a.type === 'inconsistency' ? 'Inconsistência' : 'Aviso'}: ${a.title} — ${a.text}`).join('\n');
const missingInfoText = items => items.map(i => `${i.question} (${i.reason})`).join('\n');
const hypothesesText = items => items.map(h => `${h.label} [${CONFIDENCE_LABEL[h.confidence]}]: ${h.reason}`).join('\n');
const examsText = items => items.map(e => `${e.exam}: ${e.reason}`).join('\n');
const treatmentText = items => items.map(t => `${t.item}: ${t.reason}`).join('\n');
const objectivesText = items => items.map(o => `- ${o.item}`).join('\n');
const hepText = items => items.map(h => `${h.exercise} — ${h.reason} (Cautela: ${h.caution})`).join('\n');

// Plain-text rendering of clinical_note.blocks for the "Copiar" button —
// same nesting rules as the visual preview, no HTML.
function blocksToPlainText(blocks) {
  const counters = [];
  const lines = [];
  for (const block of blocks) {
    if (block.type === 'paragraph') { counters.length = 0; lines.push(block.text); continue; }
    const indent = '  '.repeat(block.level);
    if (block.type === 'ordered') {
      counters[block.level] = (counters[block.level] || 0) + 1;
      counters.length = block.level + 1;
      lines.push(`${indent}${counters[block.level]}. ${block.text}`);
    } else {
      counters.length = 0;
      lines.push(`${indent}- ${block.text}`);
    }
  }
  return lines.join('\n');
}

// Heuristic-only split of the SAME missing_information array (schema/API unchanged)
// into history questions vs physical-exam items still to complete, for display only.
const EXAM_ITEM_PATTERN = /\b(LCA|LCP|LLI|LLE|Lachman|gaveta|arco doloroso|ritmo escapulo|for[çc]a (comparativa|contralateral)|compara[çc][ãa]o de for[çc]a|exame neurol[oó]gic|teste (de|especial)|manobra|sinal de|Adams|gibosidade|dismetria|amplitude (articular|de movimento)|ADM\b|reflexos?|sensibilidade|palpa[çc][ãa]o|contralateral|neurol[oó]gica dirigida)\b/i;
function classifyMissingInformation(items) {
  const history = [];
  const exam = [];
  for (const item of items) {
    (EXAM_ITEM_PATTERN.test(`${item.question} ${item.reason}`) ? exam : history).push(item);
  }
  return { history, exam };
}

// Builds a heading + <ul> section only when there is at least one item to show.
// Copiar sits on the same row as the heading, at the right.
function renderListSection(container, heading, items, fillItem, copyText) {
  if (!items.length) return;
  const section = document.createElement('section');
  section.className = 'clinical-ai-section';
  const head = document.createElement('div');
  head.className = 'clinical-ai-section-head';
  const h = document.createElement('h4');
  h.textContent = heading;
  head.append(h);
  if (copyText) addCopyButton(head, () => copyText(items));
  section.append(head);
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
  h.textContent = 'HDA enriquecida';
  section.append(h);
  const preview = document.createElement('div');
  preview.className = 'clinical-ai-note-preview';
  renderBlocksPreview(preview, blocks);
  section.append(preview);

  const actions = document.createElement('div');
  actions.className = 'clinical-ai-note-actions';
  const applyBtn = document.createElement('button');
  applyBtn.type = 'button'; applyBtn.className = 'clinical-ai-btn clinical-ai-btn-primary'; applyBtn.textContent = 'Aplicar à HDA';
  const keepBtn = document.createElement('button');
  keepBtn.type = 'button'; keepBtn.className = 'clinical-ai-btn clinical-ai-btn-ghost'; keepBtn.textContent = 'Manter original';
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
  addCopyButton(actions, () => blocksToPlainText(blocks));
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
// 'state' is null when building a read-only copy (e.g. "Copiar tudo"), in
// which case no answer textarea is added — only the question text itself.
function fillMissingInfo(li, info, state) {
  li.textContent = info.question;
  if (!state) return;
  const wrap = document.createElement('div');
  wrap.className = 'clinical-ai-answer-wrap';
  const textarea = document.createElement('textarea');
  textarea.className = 'clinical-ai-answer';
  textarea.placeholder = 'Responder…';
  textarea.rows = 1;
  textarea.value = state.answers.get(info.question) || '';
  const check = document.createElement('span');
  check.className = 'clinical-ai-answer-check';
  check.textContent = '✓';
  check.hidden = !textarea.value.trim();
  check.setAttribute('aria-hidden', 'true');
  textarea.addEventListener('input', () => {
    const value = textarea.value;
    if (value.trim()) state.answers.set(info.question, value);
    else state.answers.delete(info.question);
    check.hidden = !value.trim();
  });
  wrap.append(textarea, check);
  li.append(wrap);
}
function fillHypothesis(li, hypothesis) {
  const strong = document.createElement('strong');
  strong.textContent = hypothesis.label;
  const badge = document.createElement('span');
  badge.className = 'clinical-ai-confidence';
  badge.textContent = CONFIDENCE_LABEL[hypothesis.confidence];
  const p = document.createElement('p');
  p.textContent = hypothesis.reason;
  li.append(strong, badge, p);
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
  const em = document.createElement('em');
  em.textContent = 'Cautela: ' + hep.caution;
  caution.append(em);
  li.append(strong, p, caution);
}

function renderAnalysis(state, analysis, snapshot) {
  const { bodyEl, counterEl } = state;
  bodyEl.replaceChildren();
  renderListSection(bodyEl, 'Alertas', analysis.alerts, fillAlert, alertsText);
  const { history, exam } = classifyMissingInformation(analysis.missing_information);
  renderListSection(bodyEl, 'Informação em falta', history, (li, item) => fillMissingInfo(li, item, state), missingInfoText);
  renderListSection(bodyEl, 'Exame objectivo a completar', exam, (li, item) => fillMissingInfo(li, item, state), missingInfoText);
  renderClinicalNoteSection(bodyEl, state, analysis.clinical_note.blocks, snapshot);
  renderListSection(bodyEl, 'Hipóteses a considerar', analysis.diagnostic_hypotheses, fillHypothesis, hypothesesText);
  renderListSection(bodyEl, 'Exames a ponderar', analysis.suggested_exams, fillExam, examsText);
  renderListSection(bodyEl, 'Tratamento / Programa de reabilitação', analysis.treatment_options, fillTreatment, treatmentText);
  renderListSection(bodyEl, 'Objetivos', analysis.objectives, fillObjective, objectivesText);
  renderListSection(bodyEl, 'HEP', analysis.hep_suggestions, fillHep, hepText);
  counterEl.textContent = `IA · ${state.callCount} ${state.callCount === 1 ? 'análise' : 'análises'}`;
}

// Read-only heading + <ul> section for "Copiar tudo" — no buttons/inputs,
// same fill functions as the panel (never raw HTML from the AI).
function appendListSection(container, heading, items, fillItem) {
  if (!items.length) return;
  const section = document.createElement('section');
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

// Detached container with the full visible analysis, section order preserved,
// built the same safe way as the panel (textContent-first, no buttons/inputs/
// empty fields). Returns null when there is nothing analyzed yet.
function buildAnalysisContainer(state) {
  const analysis = state.lastAnalysis;
  if (!analysis) return null;
  const container = document.createElement('div');
  appendListSection(container, 'Alertas', analysis.alerts, fillAlert);
  const { history, exam } = classifyMissingInformation(analysis.missing_information);
  appendListSection(container, 'Informação em falta', history, (li, item) => fillMissingInfo(li, item, null));
  appendListSection(container, 'Exame objectivo a completar', exam, (li, item) => fillMissingInfo(li, item, null));
  if (analysis.clinical_note.blocks.length) {
    const section = document.createElement('section');
    const h = document.createElement('h4');
    h.textContent = 'HDA enriquecida';
    section.append(h);
    const preview = document.createElement('div');
    renderBlocksPreview(preview, analysis.clinical_note.blocks);
    section.append(preview);
    container.append(section);
  }
  appendListSection(container, 'Hipóteses a considerar', analysis.diagnostic_hypotheses, fillHypothesis);
  appendListSection(container, 'Exames a ponderar', analysis.suggested_exams, fillExam);
  appendListSection(container, 'Tratamento / Programa de reabilitação', analysis.treatment_options, fillTreatment);
  appendListSection(container, 'Objetivos', analysis.objectives, fillObjective);
  appendListSection(container, 'HEP', analysis.hep_suggestions, fillHep);
  return container.childElementCount ? container : null;
}

// Same section order/content as buildAnalysisContainer, as plain PT-PT text —
// reuses the same builders already used by the per-section "Copiar" buttons.
function buildFullAnalysisPlainText(state) {
  const analysis = state.lastAnalysis;
  if (!analysis) return '';
  const parts = [];
  const add = (heading, items, textFn) => { if (items.length) parts.push(`${heading}\n${textFn(items)}`); };
  add('Alertas', analysis.alerts, alertsText);
  const { history, exam } = classifyMissingInformation(analysis.missing_information);
  add('Informação em falta', history, missingInfoText);
  add('Exame objectivo a completar', exam, missingInfoText);
  if (analysis.clinical_note.blocks.length) parts.push(`HDA enriquecida\n${blocksToPlainText(analysis.clinical_note.blocks)}`);
  add('Hipóteses a considerar', analysis.diagnostic_hypotheses, hypothesesText);
  add('Exames a ponderar', analysis.suggested_exams, examsText);
  add('Tratamento / Programa de reabilitação', analysis.treatment_options, treatmentText);
  add('Objetivos', analysis.objectives, objectivesText);
  add('HEP', analysis.hep_suggestions, hepText);
  return parts.join('\n\n');
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

// Answers typed by the doctor in the panel — local-only state (never saved to
// the HDA/BD) — bundled as opaque prompt text only when "Atualizar análise" runs.
function buildAnswersBlock(answers) {
  if (!answers || !answers.size) return '';
  const lines = [];
  for (const [question, answer] of answers) {
    if (!isNonEmptyString(answer)) continue;
    lines.push(`- Pergunta: ${question}\n  Resposta: ${answer.trim()}`);
  }
  return lines.length ? `RESPOSTAS ÀS PERGUNTAS DO ASSISTENTE:\n${lines.join('\n')}` : '';
}

function buildPrompt(hdaText, patient, answers) {
  const context = buildClinicalContext(patient);
  const answersBlock = buildAnswersBlock(answers);
  let prompt = `HDA:\n${hdaText}`;
  if (context) prompt += `\n\nCONTEXTO CONHECIDO:\n${context}`;
  if (answersBlock) prompt += `\n\n${answersBlock}`;
  return prompt;
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
    const prompt = buildPrompt(quill.getText().trim(), patient, state.answers);
    const { data, error } = await sb.functions.invoke('ai-proxy', { body: { mode: 'estruturar', prompt } });
    if (!panel.isConnected || !quill.container.isConnected) return;
    sessionAnalysisCount += 1;
    state.callCount = sessionAnalysisCount;
    counterEl.textContent = `IA · ${state.callCount} ${state.callCount === 1 ? 'análise' : 'análises'}`;
    if (error || data?.error) throw new Error('Não foi possível obter a análise. O original foi mantido.');
    const analysis = validateAnalysis(data);
    if (!analysis) throw new Error('A IA devolveu uma resposta em formato inesperado.');
    state.lastAnalysis = analysis;
    state.answers.clear();
    bodyEl.replaceChildren();
    renderAnalysis(state, analysis, snapshot);
    quill.__aiLastAnalyzedHTML = snapshot;
    updateAiTriggerLabel(quill);
    statusEl.textContent = '';
  } catch (err) {
    if (panel.isConnected) statusEl.textContent = err.message;
  } finally {
    if (panel.isConnected) refreshBtn.disabled = false;
  }
}

// "Copiar tudo" — never calls the API, never touches the HDA/BD. Copies the
// whole visible analysis (section order preserved) as text/html + text/plain,
// falling back to writeText when ClipboardItem/write isn't supported.
async function copyFullAnalysis(state) {
  const { copyAllStatusEl } = state;
  const show = message => {
    copyAllStatusEl.textContent = message;
    setTimeout(() => { copyAllStatusEl.textContent = ''; }, 2000);
  };
  const container = buildAnalysisContainer(state);
  const text = buildFullAnalysisPlainText(state);
  if (!container || !text) { show('Sem análise para copiar.'); return; }
  try {
    if (window.ClipboardItem && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([container.innerHTML], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' })
        })
      ]);
    } else {
      await navigator.clipboard.writeText(text);
    }
    show('Tudo copiado.');
  } catch {
    show('Não foi possível copiar.');
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
  panel.setAttribute('aria-label', 'Assistente clínico IA');
  panel.innerHTML = '<header class="clinical-ai-header"><span class="clinical-ai-title">Assistente clínico</span><span data-counter class="clinical-ai-counter"></span><span data-copy-all-status role="status" class="clinical-ai-copy-status"></span><button type="button" data-copy-all class="clinical-ai-btn clinical-ai-btn-ghost clinical-ai-btn-sm">Copiar tudo</button><button type="button" data-refresh class="clinical-ai-btn clinical-ai-btn-ghost clinical-ai-btn-sm">Atualizar análise</button><button type="button" data-close class="clinical-ai-btn clinical-ai-btn-icon" aria-label="Fechar">✕</button></header><p data-status role="status" class="clinical-ai-status"></p><div data-body class="clinical-ai-body"></div>';
  layout.append(panel);
  quill.__aiPanel = panel;

  const state = {
    quill, sb, patient, panel,
    statusEl: panel.querySelector('[data-status]'),
    bodyEl: panel.querySelector('[data-body]'),
    counterEl: panel.querySelector('[data-counter]'),
    refreshBtn: panel.querySelector('[data-refresh]'),
    copyAllBtn: panel.querySelector('[data-copy-all]'),
    copyAllStatusEl: panel.querySelector('[data-copy-all-status]'),
    callCount: sessionAnalysisCount,
    answers: new Map(),
    lastAnalysis: null
  };
  state.counterEl.textContent = `IA · ${state.callCount} ${state.callCount === 1 ? 'análise' : 'análises'}`;
  panel.querySelector('[data-close]').onclick = () => { panel.remove(); quill.__aiPanel = null; quill.focus(); };
  state.refreshBtn.onclick = () => runAnalysis(state);
  state.copyAllBtn.onclick = () => copyFullAnalysis(state);

  await runAnalysis(state);
  if (panel.isConnected) panel.focus();
}
