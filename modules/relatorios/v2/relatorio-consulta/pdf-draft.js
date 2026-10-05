// Preview PDFs are held in memory only. Persistence belongs to the caller.
export function createPdfDraft({ buildHtml, generate }) {
  let revision = 0;
  let cached = null;
  let pending = null;
  return {
    invalidate() { revision++; cached = null; pending = null; },
    current() { return cached; },
    async preview() {
      if (cached) return cached;
      if (pending) return pending;
      const expected = revision;
      const job = (async () => {
        const html = await buildHtml();
        if (revision !== expected) throw new Error('O relatório mudou. Volte a selecionar Ver PDF.');
        const blob = await generate(html);
        if (revision !== expected) throw new Error('O relatório mudou. Volte a selecionar Ver PDF.');
        cached = Object.freeze({ html, blob });
        return cached;
      })();
      pending = job;
      try { return await job; }
      finally { if (pending === job) pending = null; }
    },
  };
}
