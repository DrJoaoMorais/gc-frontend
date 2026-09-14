// Seletor compacto comum: todas → uma; seleção parcial → alternar.
export function normalizeClinicIds(clinics, selected) {
  const ids = [...new Set((clinics || []).map(c => String(c.id)))];
  const valid = Array.isArray(selected) ? ids.filter(id => selected.map(String).includes(id)) : ids;
  return valid.length ? valid : ids;
}
export function toggleClinicSelection(clinics, selected, clicked) {
  const all = normalizeClinicIds(clinics, null);
  const current = normalizeClinicIds(clinics, selected);
  if (clicked === null) return all;
  const id = String(clicked);
  if (!all.includes(id)) return current;
  if (current.length === all.length) return [id];
  if (!current.includes(id)) return [...current, id];
  return current.length > 1 ? current.filter(value => value !== id) : current;
}
export function clinicSelectionLabel(clinics, selected) {
  const ids = normalizeClinicIds(clinics, selected);
  if (!ids.length) return 'Sem clínicas';
  return ids.length === (clinics || []).length ? 'Todas as clínicas' : `${ids.length} clínica${ids.length === 1 ? '' : 's'} selecionada${ids.length === 1 ? '' : 's'}`;
}
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let outsideWired = false;
export function mountClinicPicker(host, { clinics = [], selected, onChange } = {}) {
  if (!host) return;
  if (!document.getElementById('gc-clinic-picker-css')) {
    const link = document.createElement('link');
    link.id = 'gc-clinic-picker-css'; link.rel = 'stylesheet'; link.href = '/modules/clinic-picker.css?v=20260914';
    document.head.append(link);
  }
  let ids = normalizeClinicIds(clinics, selected);
  host.innerHTML = `<details class="gc-clinic-picker"><summary aria-label="Selecionar clínicas"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M4 21V5h16v16M2 21h20M9 21v-5h6v5M12 7v6M9 10h6"/></svg><span class="gc-clinic-count" aria-live="polite"></span><span aria-hidden="true">⌄</span></summary><div class="gc-clinic-menu"><input type="search" placeholder="Pesquisar clínica…" aria-label="Pesquisar clínica"><div class="gc-clinic-options"></div></div></details>`;
  const picker = host.querySelector('details');
  const summary = picker.querySelector('summary');
  const menu = picker.querySelector('.gc-clinic-menu');
  picker.addEventListener('toggle', () => {
    if (!picker.open) return;
    const alignRight = picker.getBoundingClientRect().left + menu.offsetWidth > window.innerWidth - 8;
    menu.style.left = alignRight ? 'auto' : '0';
    menu.style.right = alignRight ? '0' : 'auto';
  });
  const search = picker.querySelector('input');
  const options = picker.querySelector('.gc-clinic-options');
  const paint = () => {
    picker.querySelector('.gc-clinic-count').textContent = clinicSelectionLabel(clinics, ids);
    options.innerHTML = `<label><input type="checkbox" data-all ${ids.length === clinics.length ? 'checked' : ''}>Todas as clínicas</label>` + clinics.map(c => `<label><input type="checkbox" data-clinic="${escape(c.id)}" ${ids.includes(String(c.id)) ? 'checked' : ''}>${escape(c.name || c.slug || c.id)}</label>`).join('');
  };
  paint();
  options.onchange = event => {
    const input = event.target;
    if (!input.matches('[data-all],[data-clinic]')) return;
    ids = toggleClinicSelection(clinics, ids, input.hasAttribute('data-all') ? null : input.dataset.clinic);
    paint(); search.value = ''; picker.open = false; summary.focus();
    onChange?.([...ids]);
  };
  search.oninput = () => options.querySelectorAll('label').forEach(label => {
    label.hidden = !label.textContent.toLocaleLowerCase('pt-PT').includes(search.value.toLocaleLowerCase('pt-PT'));
  });
  picker.onkeydown = event => { if (event.key === 'Escape') { picker.open = false; summary.focus(); } };
  if (!outsideWired) {
    outsideWired = true;
    document.addEventListener('click', event => document.querySelectorAll('.gc-clinic-picker[open]').forEach(el => { if (!el.contains(event.target)) el.open = false; }));
  }
}
