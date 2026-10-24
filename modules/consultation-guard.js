// Never persist clinical drafts in browser storage.
export function installConsultationGuard(snapshot, active) {
  let baseline = snapshot();
  const dirty = () => active() && snapshot() !== baseline;
  const reset = () => { baseline = snapshot(); };
  const canLeave = () => !dirty() || window.confirm('Existem alterações por guardar nesta consulta. Sair e perder essas alterações?');
  window.__gc_canLeaveConsultation = canLeave;
  window.addEventListener('beforeunload', event => {
    if (!dirty()) return;
    event.preventDefault();
    event.returnValue = '';
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('#fd-btn-cancelar, #fd-nova-fechar, .fd-btn-nova-trigger, [data-action="feed-consulta"]')) return;
    if (!canLeave()) {
      event.preventDefault();
      event.stopImmediatePropagation();
    } else if (event.target.closest('#fd-btn-cancelar, #fd-nova-fechar')) reset();
  }, true);
  return { reset, dirty };
}
