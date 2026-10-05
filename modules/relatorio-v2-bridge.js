/* expõe abertura do relatório v2 para janelas filhas (feed-doente) */
window.__gcv2_openRelatorioConsultaModal = async function (opts) {
  const { openRelatorioConsultaModal } = await import('./relatorios/v2/relatorio-consulta/relatorio-consulta.js?v=2026-10-05-pdf-paginas');
  await openRelatorioConsultaModal(opts);
};
