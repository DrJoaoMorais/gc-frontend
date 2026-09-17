// A cópia só lê a origem. A gravação continua a pertencer ao formulário.
export function juntarSemDuplicar(atuais, origem) {
  const resultado = atuais.map(item => ({ ...item }));
  const ids = new Set(resultado.map(item => String(item.id)));
  for (const item of origem) {
    if (!item.id || ids.has(String(item.id))) continue;
    ids.add(String(item.id));
    resultado.push({ ...item });
  }
  return resultado;
}

export async function carregarCopiaAnterior(sb, patientId, destinoId) {
  const vazio = { dx: [], tx: [] };
  const { data: destino, error: erroDestino } = await sb.from('consultations')
    .select('id, patient_id, report_date, created_at')
    .eq('id', destinoId).eq('patient_id', patientId).single();
  if (erroDestino) throw erroDestino;
  if (!destino || destino.patient_id !== patientId) throw new Error('Consulta de destino inválida.');

  // A data clínica prevalece; a criação desempata consultas no mesmo dia.
  const { data: anterior, error: erroAnterior } = await sb.from('consultations')
    .select('id, plan_text')
    .eq('patient_id', patientId).neq('id', destinoId)
    .or(`report_date.lt.${destino.report_date},and(report_date.eq.${destino.report_date},created_at.lt.${destino.created_at})`)
    .order('report_date', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false }).limit(1).maybeSingle();
  if (erroAnterior) throw erroAnterior;
  if (!anterior) return vazio;

  const [dx, tx] = await Promise.all([
    sb.from('consultation_diagnoses')
      .select('diagnosis_id, diagnoses_catalog(system, code, label)')
      .eq('consultation_id', anterior.id),
    sb.from('consultation_treatments')
      .select('treatment_id, qty, treatments_catalog(code, label)')
      .eq('consultation_id', anterior.id),
  ]);
  if (dx.error) throw dx.error;
  if (tx.error) throw tx.error;
  // Não apresentar uma cópia parcial quando um catálogo não é acessível.
  if ((dx.data || []).some(r => !r.diagnoses_catalog) || (tx.data || []).some(r => !r.treatments_catalog)) {
    throw new Error('Catálogo indisponível.');
  }
  const tratamentos = (tx.data || []).map(r => ({ id: r.treatment_id, qty: r.qty, ...r.treatments_catalog }));
  if (tratamentos.some(t => !Number.isInteger(t.qty) || t.qty < 1)) throw new Error('Quantidade anterior inválida.');
  let plano = {};
  try { plano = JSON.parse(anterior.plan_text || '{}') || {}; } catch (_) { /* registos antigos em texto livre */ }
  const ordem = Array.isArray(plano.treat_order) ? plano.treat_order.map(String) : [];
  const posicao = id => { const i = ordem.indexOf(String(id)); return i < 0 ? ordem.length : i; };
  tratamentos.sort((a, b) => posicao(a.id) - posicao(b.id));
  return {
    dx: (dx.data || []).map(r => ({ id: r.diagnosis_id, ...r.diagnoses_catalog })),
    tx: tratamentos,
  };
}
