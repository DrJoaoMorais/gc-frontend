import { installMobileStyles } from './mobile.js';

// Files stay in memory. The caller obtains them through the existing authenticated route.
export async function openMobilePdf({ name = 'Consulta.pdf', load }) {
  installMobileStyles();
  document.querySelector('.gc-pdf-viewer')?.close();
  const previousFocus = document.activeElement;
  const dialog = document.createElement('dialog');
  dialog.className = 'gc-pdf-viewer';
  dialog.setAttribute('aria-label', 'Pré-visualização do PDF');
  dialog.innerHTML = '<header><strong></strong><button type="button" data-pdf-close>Fechar</button></header><p role="status" aria-live="polite">A obter PDF…</p><div data-preview></div><footer><button type="button" data-pdf-share disabled>Partilhar PDF</button><a data-pdf-download hidden>Descarregar PDF</a></footer>';
  dialog.querySelector('strong').textContent = name;
  const status = dialog.querySelector('[role=status]');
  const share = dialog.querySelector('[data-pdf-share]');
  const download = dialog.querySelector('[data-pdf-download]');
  let objectURL, closed = false;
  dialog.addEventListener('close', () => {
    closed = true;
    if (objectURL) URL.revokeObjectURL(objectURL);
    dialog.remove();
    if (previousFocus?.isConnected) previousFocus.focus();
  }, { once: true });
  dialog.querySelector('[data-pdf-close]').onclick = () => dialog.close();
  document.body.append(dialog);
  dialog.showModal();
  try {
    const blob = await load();
    if (closed) return;
    if (!(blob instanceof Blob) || !blob.size || !(await blob.slice(0, 1024).text()).includes('%PDF-')) throw new Error('invalid-pdf');
    if (closed) return;
    const fileName = String(name).replace(/[\/\\\u0000-\u001f]/g, '_').replace(/\.pdf$/i, '') + '.pdf';
    const file = new File([blob], fileName, { type: 'application/pdf' });
    objectURL = URL.createObjectURL(file);
    const preview = document.createElement('iframe');
    preview.title = 'PDF — ' + name;
    preview.src = objectURL;
    dialog.querySelector('[data-preview]').append(preview);
    download.href = objectURL;
    download.download = fileName;
    download.hidden = false;
    const canShare = typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] });
    share.disabled = !canShare;
    status.textContent = canShare
      ? 'Confirme o documento. Em Partilhar PDF, escolha a aplicação e o destinatário.'
      : 'Partilha de ficheiros indisponível neste navegador. Descarregue o PDF e partilhe-o a partir de Ficheiros.';
    share.onclick = async () => {
      share.disabled = true;
      try {
        // A second, direct user gesture preserves iOS transient activation.
        await navigator.share({ files: [file] });
        if (!closed) status.textContent = 'Partilha entregue à aplicação escolhida. Confirme o envio nessa aplicação.';
      } catch (error) {
        if (!closed) status.textContent = error?.name === 'AbortError'
          ? 'Partilha cancelada. Pode tentar novamente.'
          : 'Não foi possível partilhar. Tente novamente ou descarregue o PDF.';
      } finally { if (!closed) share.disabled = false; }
    };
  } catch {
    if (!closed) status.textContent = 'Não foi possível obter o PDF. Confirme a sessão e o acesso ao documento.';
  }
}
