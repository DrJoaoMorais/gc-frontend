import { clinicalHTML, editorHTML } from './content.js';

export function enhanceClinicalEditor(quill, { ai = false, sb = () => window.sb } = {}) {
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
      button.textContent = 'Estruturar com IA';
      button.style.cssText = 'width:auto;font:inherit;font-size:12px;color:#1a56db;padding:0 8px;';
      button.onclick = () => openStructureProposal(quill, sb());
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

// Mirrors the server-side validation (defense in depth): rejects the whole
// response on any invalid block. Never trusts shape/content from the network.
function validateBlocks(blocks) {
  if (!Array.isArray(blocks)) return null;
  const out = [];
  for (const raw of blocks) {
    if (!raw || typeof raw !== 'object') return null;
    const { type, text, level } = raw;
    if (!ALLOWED_BLOCK_TYPES.has(type)) return null;
    if (typeof text !== 'string' || !text.trim()) return null;
    if (!Number.isInteger(level) || level < 0 || level > 2) return null;
    if (type === 'paragraph' && level !== 0) return null;
    out.push({ type, text: text.trim(), level });
  }
  return out;
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

export async function openStructureProposal(quill, sb) {
  if (quill.__proposal?.isConnected) { quill.__proposal.focus(); return; }
  const original = editorHTML(quill);
  if (!quill.getText().trim()) { window.alert('Escreve primeiro o texto clínico.'); return; }
  const panel = document.createElement('section');
  panel.tabIndex = -1;
  panel.setAttribute('aria-label','Proposta de estruturação com IA');
  panel.style.cssText='padding:12px;margin:8px 0;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;';
  panel.innerHTML='<strong>Estruturar com IA</strong><p data-status role="status">A preparar proposta…</p><div data-preview hidden style="background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:4px 12px;margin:8px 0;max-height:320px;overflow:auto;"></div><button type="button" data-accept disabled>Aceitar</button> <button type="button" data-cancel>Manter original</button>';
  quill.container.after(panel);
  quill.__proposal = panel;
  const status = panel.querySelector('[data-status]');
  const preview = panel.querySelector('[data-preview]');
  const accept = panel.querySelector('[data-accept]');
  const cancel = panel.querySelector('[data-cancel]');
  let blocks = null;
  cancel.onclick = () => { panel.remove(); quill.focus(); };
  accept.onclick = () => {
    if (editorHTML(quill) !== original) { status.textContent='O original foi alterado entretanto. Mantém o original e volta a pedir uma proposta.'; accept.disabled=true; return; }
    if (!blocks?.length) { status.textContent='A proposta está vazia.'; return; }
    quill.history.cutoff();
    quill.setContents(blocksToDelta(blocks), 'user');
    quill.history.cutoff();
    panel.remove(); quill.focus();
  };
  try {
    if (!sb?.functions?.invoke) throw new Error('A ligação de IA não está disponível.');
    const { data: session, error: sessionError } = await sb.auth.getSession();
    if (sessionError || !session?.session) throw new Error('Inicia sessão para utilizar a IA.');
    const {data,error} = await sb.functions.invoke('ai-proxy', { body: {mode:'estruturar',prompt:quill.getText().trim()} });
    if (!panel.isConnected || !quill.container.isConnected) return;
    if (error || data?.error) throw new Error('Não foi possível obter a proposta. O original foi mantido.');
    const validated = validateBlocks(data?.blocks);
    if (!validated) throw new Error('A IA devolveu uma resposta em formato inesperado.');
    if (!validated.length) throw new Error('A IA devolveu uma resposta vazia.');
    blocks = validated;
    renderBlocksPreview(preview, blocks);
    preview.hidden = false;
    accept.disabled = false;
    status.textContent='Revê os parágrafos e listas antes de aceitar. Podes desfazer a substituição.';
  } catch (error) {
    if (panel.isConnected) status.textContent=error.message;
  }
}
