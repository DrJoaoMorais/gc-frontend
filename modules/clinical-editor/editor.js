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

export async function openStructureProposal(quill, sb) {
  if (quill.__proposal?.isConnected) { quill.__proposal.focus(); return; }
  const original = editorHTML(quill);
  if (!quill.getText().trim()) { window.alert('Escreve primeiro o texto clínico.'); return; }
  const panel = document.createElement('section');
  panel.tabIndex = -1;
  panel.setAttribute('aria-label','Proposta de estruturação com IA');
  panel.style.cssText='padding:12px;margin:8px 0;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;';
  panel.innerHTML='<strong>Estruturar com IA</strong><p data-status role="status">A preparar proposta…</p><label>Proposta editável<textarea rows="10" style="display:block;width:100%;box-sizing:border-box;font:inherit;margin:8px 0" hidden></textarea></label><button type="button" data-accept disabled>Aceitar</button> <button type="button" data-cancel>Manter original</button>';
  quill.container.after(panel);
  quill.__proposal = panel;
  const status = panel.querySelector('[data-status]');
  const proposal = panel.querySelector('textarea');
  const accept = panel.querySelector('[data-accept]');
  const cancel = panel.querySelector('[data-cancel]');
  cancel.onclick = () => { panel.remove(); quill.focus(); };
  accept.onclick = () => {
    if (editorHTML(quill) !== original) { status.textContent='O original foi alterado entretanto. Mantém o original e volta a pedir uma proposta.'; accept.disabled=true; return; }
    if (!proposal.value.trim()) { status.textContent='A proposta está vazia.'; return; }
    quill.history.cutoff();
    quill.setText(proposal.value, 'user');
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
    if (typeof data?.text !== 'string' || !data.text.trim()) throw new Error('A IA devolveu uma resposta vazia.');
    proposal.value=data.text; proposal.hidden=false; accept.disabled=false;
    status.textContent='Revê os factos e edita a proposta antes de aceitar. Podes desfazer a substituição.';
  } catch (error) {
    if (panel.isConnected) status.textContent=error.message;
  }
}
