// =================================================================
// patient-card.js  ·  Componente universal v2
// Bloco de identificação do doente para relatórios e atestados
// =================================================================
// Função pura: recebe { patient, mode }, devolve HTML.
// Não faz fetch. Não tem listeners. Não escreve na BD.
//
// Modos:
//   - 'inline' : devolve só o nome (para inserir no meio de uma frase)
//   - 'full'   : devolve bloco HTML completo (para relatórios formais)
//
// Mostra apenas campos preenchidos — vazios são omitidos.
// =================================================================

const escAttr = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));

function fmtDobPt(iso) {
  if (!iso) return '';
  if (typeof window !== 'undefined' && typeof window.__gc_fmtDobPt === 'function') {
    return window.__gc_fmtDobPt(iso);
  }
  // Fallback simples
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-PT');
}

function calcAge(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
}

function buildAddress(patient) {
  const parts = [];
  if (patient?.address_line1) parts.push(patient.address_line1);
  const cityLine = [patient?.postal_code, patient?.city].filter(Boolean).join(' ');
  if (cityLine) parts.push(cityLine);
  return parts.join(', ');
}

/**
 * @param {object} opts
 * @param {object} opts.patient - registo da tabela patients
 * @param {'inline'|'full'} [opts.mode='full']
 * @returns {string} HTML
 */
export function buildPatientCard({ patient, mode = 'full' } = {}) {
  if (!patient) return '';

  const name = escAttr(patient.full_name || '—');

  if (mode === 'inline') {
    return `<strong class="gcv2-patient-name">${name}</strong>`;
  }

  // Modo 'full': bloco HTML completo
  const rows = [];

  // Linha 1 — sempre: nome + (idade se houver DOB)
  const age = calcAge(patient.dob);
  const dobStr = fmtDobPt(patient.dob);
  let line1 = `<strong>${name}</strong>`;
  if (dobStr) {
    line1 += ` · ${escAttr(dobStr)}`;
    if (age !== null) line1 += ` (${age} anos)`;
  }
  rows.push(`<div class="gcv2-pc-line gcv2-pc-line-main">${line1}</div>`);

  // Linha 2 — identificadores legais (só os preenchidos)
  const ids = [];
  if (patient.nif)          ids.push(`<span>NIF <strong>${escAttr(patient.nif)}</strong></span>`);
  if (patient.sns)          ids.push(`<span>Utente SNS <strong>${escAttr(patient.sns)}</strong></span>`);
  if (patient.cc_number)    ids.push(`<span>CC <strong>${escAttr(patient.cc_number)}</strong></span>`);
  if (patient.passport_id)  ids.push(`<span>Passaporte <strong>${escAttr(patient.passport_id)}</strong></span>`);
  if (ids.length) {
    rows.push(`<div class="gcv2-pc-line gcv2-pc-ids">${ids.join(' &nbsp;·&nbsp; ')}</div>`);
  }

  // Linha 3 — morada (só se houver)
  const addr = buildAddress(patient);
  if (addr) {
    rows.push(`<div class="gcv2-pc-line gcv2-pc-addr">${escAttr(addr)}</div>`);
  }

  return `<div class="gcv2-patient-card">${rows.join('')}</div>`;
}

// Expor globalmente (consistente com o padrão do shell-v2)
if (typeof window !== 'undefined') {
  window.__gcv2_buildPatientCard = buildPatientCard;
}
