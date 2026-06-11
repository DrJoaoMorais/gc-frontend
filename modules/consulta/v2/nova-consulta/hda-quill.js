// hda-quill.js
// Monta o editor HDA (Quill 2.0) com guião de anamnese colapsável.
// Grava com debounce 2 s + tentativa em beforeunload.
// Exporta: montarEditorHDA(el, consulta, sb)

import { buildGuiaoHTML, initGuiao } from '../consulta-completa/guiao-anamnese.js';

export function montarEditorHDA(el, consulta, sb) {
  el.innerHTML = `
    <div id="nc-hda-guiao">${buildGuiaoHTML()}</div>
    <div id="nc-hda-editor"></div>
    <div id="nc-hda-estado" style="text-align:right;font-size:12px;color:#94a3b8;min-height:18px;padding:2px 8px 4px;"></div>`;

  const quill = new window.Quill(el.querySelector('#nc-hda-editor'), {
    theme: 'snow',
    placeholder: 'Descreve a história da doença actual…',
    modules: {
      toolbar: [
        [{ header: [2, 3, false] }],
        ['bold', 'italic', 'underline'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['clean']
      ]
    }
  });

  const initial = String(consulta?.hda || '').trim();
  if (initial) {
    try { quill.clipboard.dangerouslyPasteHTML(initial); }
    catch (_) { quill.setText(initial); }
  }

  // initGuiao depois do load: avalia consulta.hda, não quill.getText()
  initGuiao(quill, initial);

  const estadoEl = el.querySelector('#nc-hda-estado');
  const diz = txt => { if (estadoEl) estadoEl.textContent = txt; };

  let _timer = null;

  const guardar = async () => {
    if (!consulta?.id || !sb) return;
    diz('A guardar…');
    try {
      const { data, error } = await sb
        .from('consultations')
        .update({ hda: quill.root.innerHTML })
        .eq('id', consulta.id)
        .select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('RLS');
      diz('Guardado ✓');
      setTimeout(() => diz(''), 3000);
    } catch (_) {
      diz('Erro ao guardar');
    }
  };

  quill.on('text-change', () => {
    clearTimeout(_timer);
    _timer = setTimeout(guardar, 2000);
  });

  window.addEventListener('beforeunload', () => {
    clearTimeout(_timer);
    guardar();
  });
}
