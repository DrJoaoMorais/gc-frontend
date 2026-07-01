// =================================================================
// richtext.js  ·  Componente universal v2
// Editor de texto livre para notas médico-legais e observações
// =================================================================
// Versão minimalista: contenteditable + helpers de leitura/escrita.
// Não usa Quill (pesado, mantemos o do doente.js intocável).
// Para já: texto simples com quebras de linha preservadas.
//
// Uso típico:
//   const html = buildRichTextEditor({ value: '', placeholder: '...', idPrefix: 'gcv2nota' });
//   // ... inserir no DOM ...
//   const texto = readRichTextValue('gcv2nota');
// =================================================================

const escAttr = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));

const escHtml = escAttr;

/**
 * Renderiza um editor de texto livre.
 * @param {object} opts
 * @param {string} [opts.value=''] - texto inicial
 * @param {string} [opts.placeholder=''] - texto-fantasma quando vazio
 * @param {string} [opts.idPrefix='gcv2rt'] - prefixo para IDs (permite vários)
 * @param {number} [opts.minHeight=120] - altura mínima em pixels
 */
export function buildRichTextEditor({
  value = '',
  placeholder = 'Escreva aqui…',
  idPrefix = 'gcv2rt',
  minHeight = 120,
} = {}) {
  const p = escAttr(idPrefix);
  const ph = escAttr(placeholder);
  const initial = escHtml(value).replace(/\n/g, '<br>');

  return `
    <div class="gcv2-richtext" data-gcv2-rt="${p}">
      <div
        id="${p}-area"
        class="gcv2-richtext-area"
        contenteditable="true"
        role="textbox"
        aria-multiline="true"
        data-placeholder="${ph}"
        style="min-height:${minHeight}px;"
      >${initial}</div>
    </div>
  `.trim();
}

/**
 * Liga listeners de mudança e gestão de placeholder.
 */
export function bindRichTextEditor({ idPrefix = 'gcv2rt', onChange } = {}) {
  const area = document.getElementById(`${idPrefix}-area`);
  if (!area) return;

  const updatePlaceholderState = () => {
    const empty = !area.textContent.trim();
    area.classList.toggle('gcv2-rt-empty', empty);
  };

  updatePlaceholderState();

  area.addEventListener('input', () => {
    updatePlaceholderState();
    if (typeof onChange === 'function') onChange(readRichTextValue(idPrefix));
  });

  // Cola sempre como texto simples (sem cores/fonts do clipboard)
  area.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData)?.getData('text') || '';
    document.execCommand('insertText', false, text);
  });
}

/**
 * Lê o conteúdo como texto plano (preservando \n).
 */
export function readRichTextValue(idPrefix = 'gcv2rt') {
  const area = document.getElementById(`${idPrefix}-area`);
  if (!area) return '';

  // Substituir <br> e <div>/<p> por \n; resto como texto
  const html = area.innerHTML
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p)>/gi, '\n')
    .replace(/<[^>]+>/g, '');

  // Decode HTML entities básicas
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return (tmp.textContent || '').replace(/ /g, ' ').trim();
}

/**
 * Substitui o conteúdo do editor.
 */
export function writeRichTextValue(idPrefix, value) {
  const area = document.getElementById(`${idPrefix}-area`);
  if (!area) return;
  area.innerHTML = escHtml(value || '').replace(/\n/g, '<br>');
  area.classList.toggle('gcv2-rt-empty', !value || !value.trim());
}

// Expor globalmente
if (typeof window !== 'undefined') {
  window.__gcv2_buildRichTextEditor = buildRichTextEditor;
  window.__gcv2_bindRichTextEditor  = bindRichTextEditor;
  window.__gcv2_readRichTextValue   = readRichTextValue;
  window.__gcv2_writeRichTextValue  = writeRichTextValue;
}
