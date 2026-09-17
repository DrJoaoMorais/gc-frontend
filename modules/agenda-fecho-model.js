export const ACCOUNTANT = 'mariasantosp.pt@gmail.com';
export const euro = value => value == null || !Number.isFinite(Number(value)) ? 'Por confirmar' : Number(value).toLocaleString('pt-PT', {style:'currency', currency:'EUR'});
export function clinicPolicy(name) {
  const n = String(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return /athletix|\bweb\b|webjoaomorais/.test(n) ? 'individual' : /\bliga\b/.test(n) ? 'avenca' : 'actos';
}
export const monthlyClinic = name => /alfra|novo\s*cuidar/i.test(name);
export function monthBounds(day) {
  const [y,m] = day.split('-').map(Number);
  return {start: `${day.slice(0,7)}-01`, end: `${day.slice(0,7)}-${new Date(Date.UTC(y,m,0)).getUTCDate()}`};
}
export function lisbonDay(value) {
  const parts = new Intl.DateTimeFormat('en-GB', {timeZone:'Europe/Lisbon',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));
  return ['year','month','day'].map(k => parts.find(p => p.type === k).value).join('-');
}
export const dateLabel = day => new Date(day+'T12:00:00Z').toLocaleDateString('pt-PT');
export const periodLabel = (start,end) => start === end ? dateLabel(start) : `${dateLabel(start)} a ${dateLabel(end)}`;
export const isSent = item => !!item?.enviado_contabilista_at || item?.estado === 'enviado_contabilista';
export function sentForRecord(record, history) {
  return history.find(h => {
    if (h.entidade_id !== record.entidade_id || !isSent(h)) return false;
    if (h.granularidade === 'registo') return h.chave === record.id;
    const matches = h.granularidade === 'dia' ? h.chave === String(record.data).slice(0,10) : h.chave === String(record.data).slice(0,7);
    // Legacy aggregate closures cover only records already present when sent.
    return matches && (!record.created_at || !h.enviado_contabilista_at || record.created_at <= h.enviado_contabilista_at);
  });
}
export function billableRows(records, appointments, history) {
  const appts = new Map(appointments.map(a => [a.id,a]));
  return records.filter(r => r.agendaCounts && (!r.appointment_id || appts.get(r.appointment_id)?.status === 'done') && !sentForRecord(r,history));
}
export function buildRequest({name, start, end, records, policy = clinicPolicy(name)}) {
  const issues = [];
  const individual = policy === 'individual';
  const groups = new Map();
  let total = 0;
  let completeTotal = true;
  records.forEach(r => {
    const value = individual ? r.agendaBilled : r.agendaFee;
    if (value == null || !Number.isFinite(Number(value)) || Number(value) < 0) {issues.push('Existem valores por confirmar.');completeTotal=false;}
    else total += Number(value);
    if (!r.tipo_acto) issues.push('Existem atos sem identificação.');
    const key = individual ? r.patient_id : r.tipo_acto;
    if (individual && !key) issues.push('Existe um ato sem doente associado.');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  });
  const lines = [`Olá Maria,`, '', `Peço a emissão ${individual ? 'de uma fatura por doente' : 'de uma fatura'} referente a ${name}.`, `Período: ${periodLabel(start,end)}.`, ''];
  for (const rows of groups.values()) {
    if (individual) {
      const p = rows[0].patients || {};
      if (![p.full_name,p.nif,p.address_line1,p.postal_code,p.city].every(v => String(v||'').trim())) issues.push('Faltam nome, NIF ou morada completa de um ou mais doentes.');
      lines.push(`Doente: ${p.full_name || 'Por confirmar'}`, `NIF: ${p.nif || 'Por confirmar'}`, `Morada: ${[p.address_line1,p.postal_code,p.city].filter(Boolean).join(', ') || 'Por confirmar'}`);
      const insurance = String(p.insurance_provider || '').trim();
      const policyNumber = String(p.insurance_policy_number || '').trim();
      if (insurance) lines.push(`Seguro: ${insurance}`);
      if (policyNumber) lines.push(`N.º do seguro/apólice: ${policyNumber}`);
      rows.forEach(r => lines.push(`${dateLabel(String(r.data).slice(0,10))} — ${r.tipo_acto || 'Ato por identificar'}: ${euro(r.agendaBilled)}`));
      lines.push(`Total da fatura: ${euro(rows.reduce((s,r) => s+Number(r.agendaBilled||0),0))}`, '');
    } else lines.push(`${rows[0].tipo_acto || 'Ato por identificar'}: ${rows.length} — ${euro(rows.reduce((s,r)=>s+Number(r.agendaFee||0),0))}`);
  }
  lines.push('',`Total: ${euro(total)}.`, '', 'Obrigado,', 'João Morais');
  return {body:lines.join('\n'), total:completeTotal?total:null, issues:[...new Set(issues)], invoiceCount:individual ? groups.size : 1};
}
