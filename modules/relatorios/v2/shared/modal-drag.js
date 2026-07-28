export function makeModalDraggable(overlayEl, modalEl, handleEl) {
  let dragging = false, offsetX = 0, offsetY = 0, positioned = false;
  handleEl.addEventListener('mousedown', (e) => {
    if (e.target.closest('button, input, select, a')) return;
    dragging = true;
    const rect = modalEl.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    if (!positioned) {
      overlayEl.style.alignItems = 'flex-start';
      overlayEl.style.justifyContent = 'flex-start';
      modalEl.style.position = 'absolute';
      modalEl.style.left = rect.left + 'px';
      modalEl.style.top = rect.top + 'px';
      modalEl.style.margin = '0';
      positioned = true;
    }
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    modalEl.style.left = (e.clientX - offsetX) + 'px';
    modalEl.style.top = (e.clientY - offsetY) + 'px';
  });
  document.addEventListener('mouseup', () => { dragging = false; });
}
