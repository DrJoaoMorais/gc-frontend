// Origem comum dos seguros: [] significa escolha explícita de nenhum seguro.
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const FREQUENT_INSURERS = ['Multicare', 'AdvanceCare', 'Médis', 'Future Healthcare', 'Allianz', 'Fidelidade', 'Generali Tranquilidade', 'Zurich', 'Bupa', 'MGEN', 'ADSE'];
export function patientInsurances(patient = {}) {
  patient = patient || {};
  if (Array.isArray(patient.insurances)) return patient.insurances.map(s => ({ provider: String(s.provider ?? ''), policy_number: String(s.policy_number ?? ''), in_header: s.in_header === true }));
  const provider = patient.insurance_provider ?? patient.seguradora ?? '';
  const policy_number = patient.insurance_policy_number ?? patient.n_apolice ?? '';
  return provider || policy_number ? [{ provider: String(provider), policy_number: String(policy_number), in_header: true }] : [];
}
export function insurancePayload(draft) {
  return { insurances: patientInsurances(draft).map(s => ({ ...s, provider: s.provider.trim(), policy_number: s.policy_number.trim() })).filter(s => s.provider || s.policy_number) };
}
export function insuranceHeaderHtml(patient, { tag = 'div' } = {}) {
  return patientInsurances(patient).filter(s => s.in_header && (s.provider || s.policy_number)).map(s => `<${tag} class="gc-insurance-header" style="overflow-wrap:anywhere"><b>Seguradora:</b> ${esc(s.provider)}${s.policy_number ? ` — Apólice: ${esc(s.policy_number)}` : ''}</${tag}>`).join('');
}
export function insuranceEditorHtml(draft, id, editable) {
  const disabled = editable ? '' : 'disabled';
  const rows = patientInsurances(draft);
  return `<div id="${id}" style="grid-column:1/-1"><label>Seguros</label><div data-insurance-rows>${rows.map((s, i) => `<div data-insurance-row="${i}" style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:8px 0"><label style="flex:1;min-width:160px">Seguradora<input data-field="provider" aria-label="Seguradora" list="${id}-names" value="${esc(s.provider)}" ${disabled} style="display:block;width:100%;box-sizing:border-box;padding:10px;border:1px solid #ddd;border-radius:10px"></label><label style="flex:1;min-width:140px">N.º apólice<input data-field="policy_number" aria-label="N.º apólice" value="${esc(s.policy_number)}" ${disabled} style="display:block;width:100%;box-sizing:border-box;padding:10px;border:1px solid #ddd;border-radius:10px"></label><label><input type="checkbox" data-field="in_header" ${s.in_header ? 'checked' : ''} ${disabled}> Cabeçalho</label></div>`).join('')}</div><datalist id="${id}-names">${FREQUENT_INSURERS.map(n => `<option value="${esc(n)}"></option>`).join('')}</datalist>${editable ? '<button type="button" data-add-insurance>+ Adicionar seguro</button>' : ''}</div>`;
}
// Os nomes novos ficam persistidos com o doente. Só consulta nomes de registos
// que o utilizador já pode ler; não altera permissões nem guarda dados no browser.
export async function loadInsurerNames(sb) {
  const names = new Map(FREQUENT_INSURERS.map(n => [n.toLocaleLowerCase('pt-PT'), n]));
  for (let from = 0; ; from += 500) {
    const { data, error } = await sb.from('patients').select('insurance_provider, insurances').order('id').range(from, from + 499);
    if (error) throw error;
    for (const p of data || []) for (const s of patientInsurances(p)) {
      const n = s.provider.trim();
      if (n) names.set(n.toLocaleLowerCase('pt-PT'), n);
    }
    if (!data || data.length < 500) break;
  }
  return [...names.values()].sort((a, b) => a.localeCompare(b, 'pt-PT'));
}
export function bindInsuranceEditor(root, draft, { editable, sb } = {}) {
  if (!root) return;
  root.oninput = e => {
    if (!editable) return;
    const row = e.target.closest('[data-insurance-row]');
    const field = e.target.dataset.field;
    if (!row || !field) return;
    draft.insurances[Number(row.dataset.insuranceRow)][field] = field === 'in_header' ? e.target.checked : e.target.value;
  };
  root.querySelector('[data-add-insurance]')?.addEventListener('click', () => {
    draft.insurances.push({ provider: '', policy_number: '', in_header: true });
    const id = root.id;
    root.outerHTML = insuranceEditorHtml(draft, id, editable);
    const replacement = document.getElementById(id);
    bindInsuranceEditor(replacement, draft, { editable, sb });
    replacement.querySelector('[data-insurance-row]:last-child input')?.focus();
  });
  if (sb) loadInsurerNames(sb).then(names => {
    if (root.isConnected) root.querySelector('datalist').innerHTML = names.map(n => `<option value="${esc(n)}"></option>`).join('');
  }).catch(() => { /* Sugestões frequentes continuam disponíveis. */ });
}
