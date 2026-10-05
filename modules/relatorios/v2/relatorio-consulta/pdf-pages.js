let library;
export function createPdfPages(host) {
  let revision = 0;
  let loading;
  let document;
  function clear() {
    revision++;
    if (loading) loading.destroy().catch(() => {});
    loading = null;
    document = null;
    host.replaceChildren();
    host.hidden = true;
  }
  return {
    clear,
    async show(blob) {
      clear();
      const expected = revision;
      library ||= import('https://cdn.jsdelivr.net/npm/pdfjs-dist@6.4.299/build/pdf.mjs').catch(error => { library = null; throw error; });
      const pdfjs = await library;
      pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.4.299/build/pdf.worker.mjs';
      if (expected !== revision) return null;
      loading = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), isEvalSupported: false });
      document = await loading.promise;
      if (expected !== revision) return null;
      host.hidden = false;
      const count = document.numPages;
      const total = window.document.createElement('div');
      total.className = 'gcv2-rc-pdf-count';
      total.setAttribute('role', 'status');
      total.textContent = `PDF real · ${count} ${count === 1 ? 'página' : 'páginas'}`;
      host.append(total);
      for (let number = 1; number <= count; number++) {
        if (expected !== revision) return null;
        const page = await document.getPage(number);
        if (expected !== revision) return null;
        const figure = window.document.createElement('figure');
        figure.className = 'gcv2-rc-pdf-page';
        const label = window.document.createElement('figcaption');
        label.textContent = `Página ${number} de ${count}`;
        const canvas = window.document.createElement('canvas');
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', label.textContent);
        figure.append(label, canvas);
        host.append(figure);
        const natural = page.getViewport({ scale: 1 });
        const width = Math.max(250, Math.min(900, host.clientWidth - 24));
        const viewport = page.getViewport({ scale: width / natural.width });
        const pixels = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * pixels);
        canvas.height = Math.floor(viewport.height * pixels);
        await page.render({ canvasContext: canvas.getContext('2d'), viewport,
          transform: pixels === 1 ? null : [pixels, 0, 0, pixels, 0, 0] }).promise;
        page.cleanup();
      }
      return count;
    },
  };
}
