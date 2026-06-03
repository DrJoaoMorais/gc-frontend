/* ============================================================
   Consulta Completa (V2) — cc-queries.js (ficheiro 2)
   Lê as tabelas reais em modo LEITURA. Não escreve nada.
   Usa window.sb (Supabase inline, herdado do Relatório V2).
   ============================================================ */

export async function carregarConsulta({ consultationId, patientId }) {
  const sb = window.sb;
  if (!sb) throw new Error('Supabase (window.sb) não inicializado.');

  /* --- 1. Consulta + HDA --- */
  const { data: consulta, error: eC } = await sb
    .from('consultations')
    .select('id, report_date, hda, plan_text, author_display_name')
    .eq('id', consultationId)
    .single();
  if (eC) throw eC;

  /* --- 2. Diagnósticos (com system, code, label do catálogo) --- */
  const { data: diagRows, error: eD } = await sb
    .from('consultation_diagnoses')
    .select('diagnosis_id, diagnoses_catalog ( system, code, label )')
    .eq('consultation_id', consultationId);
  if (eD) throw eD;
  const diagnosticos = (diagRows || []).map(r => ({
    system: r.diagnoses_catalog?.system || 'ICD-9',
    code: r.diagnoses_catalog?.code || '',
    label: r.diagnoses_catalog?.label || '(sem descrição)',
  }));

  /* --- 3. Tratamentos (com qty) --- */
  const { data: tratRows, error: eT } = await sb
    .from('consultation_treatments')
    .select('qty, treatments_catalog ( code, label )')
    .eq('consultation_id', consultationId);
  if (eT) throw eT;
  const tratamentos = (tratRows || []).map(r => ({
    code: r.treatments_catalog?.code || '',
    label: r.treatments_catalog?.label || '(sem descrição)',
    qty: r.qty ?? 1,
  }));

  /* --- 4. Exames objectivos (jsonb), mais recente primeiro --- */
  const { data: examRows, error: eE } = await sb
    .from('consultation_assessments')
    .select('id, assessment_type, assessment_side, assessment_date, data, created_at')
    .eq('consultation_id', consultationId)
    .order('assessment_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (eE) throw eE;
  const exames = examRows || [];

  /* --- 5. Protocolo da consulta (cabeçalho + fase pré-escrita) --- */
  const { data: protRows, error: eP } = await sb
    .from('consultation_protocols')
    .select('id, protocol_id, phase_id, data, protocols_catalog ( region, name, kind ), protocol_phases ( phase_order, name, anchor_from, anchor_to, data )')
    .eq('consultation_id', consultationId);
  if (eP) throw eP;
  const pr = (protRows || [])[0] || null;
  const protocolo = pr ? {
    id:     pr.id,
    nome:   pr.protocols_catalog?.name   || '',
    regiao: pr.protocols_catalog?.region || '',
    tipo:   pr.protocols_catalog?.kind   || '',
    fase: pr.protocol_phases ? {
      ordem:      pr.protocol_phases.phase_order,
      nome:       pr.protocol_phases.name,
      ancora_de:  pr.protocol_phases.anchor_from,
      ancora_ate: pr.protocol_phases.anchor_to,
      // base = pré-escrito da fase; o confirmado na consulta sobrepõe-se (mesma chave)
      dados: { ...(pr.protocol_phases.data || {}), ...(pr.data || {}) },
    } : null,
  } : null;

  return { consulta, diagnosticos, tratamentos, exames, protocolo };
}
