/* ============================================================
   Consulta Completa (V2) — cc-queries.js (ficheiro 2)
   Lê as tabelas reais em modo LEITURA. Não escreve nada.
   Usa window.sb (Supabase inline, herdado do Relatório V2).
   ============================================================ */

export async function carregarConsulta({ consultationId, patientId }) {
  const sb = window.sb;
  if (!sb) throw new Error('Supabase (window.sb) não inicializado.');

  /* As 5 queries abaixo são independentes entre si (nenhuma usa o resultado
     de outra) — correm em paralelo num único Promise.all em vez de em série,
     para cortar 5 latências de rede em fila para 1. A ordem dos resultados
     do Promise.all é a ordem do array; a desestruturação abaixo tem de bater
     certo com essa ordem (1 consulta, 2 diagnósticos, 3 tratamentos,
     4 exames, 5 protocolo), senão troca os dados entre si. */
  const [
    /* --- 1. Consulta + HDA --- */
    { data: consulta, error: eC },
    /* --- 2. Diagnósticos (com system, code, label do catálogo) --- */
    { data: diagRows, error: eD },
    /* --- 3. Tratamentos (com qty) --- */
    { data: tratRows, error: eT },
    /* --- 4. Exames objectivos (jsonb), mais recente primeiro --- */
    { data: examRows, error: eE },
    /* --- 5. Protocolo da consulta (cabeçalho + fase pré-escrita) --- */
    { data: protRows, error: eP },
  ] = await Promise.all([
    sb
      .from('consultations')
      .select('id, report_date, hda, plan_text, objectives, author_display_name')
      .eq('id', consultationId)
      .single(),

    sb
      .from('consultation_diagnoses')
      .select('diagnosis_id, diagnoses_catalog ( system, code, label )')
      .eq('consultation_id', consultationId),

    sb
      .from('consultation_treatments')
      .select('qty, treatments_catalog ( code, label )')
      .eq('consultation_id', consultationId),

    sb
      .from('consultation_assessments')
      .select('id, consultation_id, patient_id, clinic_id, assessment_type, assessment_side, assessment_date, data, created_at')
      .eq('consultation_id', consultationId)
      .order('assessment_date', { ascending: false })
      .order('created_at', { ascending: false }),

    sb
      .from('consultation_protocols')
      .select('id, protocol_id, phase_id, data, protocols_catalog ( region, name, kind ), protocol_phases ( phase_order, name, anchor_from, anchor_to, data )')
      .eq('consultation_id', consultationId),
  ]);

  if (eC) throw eC;
  if (eD) throw eD;
  if (eT) throw eT;
  if (eE) throw eE;
  if (eP) throw eP;

  const diagnosticos = (diagRows || []).map(r => ({
    system: r.diagnoses_catalog?.system || 'ICD-9',
    code: r.diagnoses_catalog?.code || '',
    label: r.diagnoses_catalog?.label || '(sem descrição)',
  }));

  const tratamentos = (tratRows || []).map(r => ({
    code: r.treatments_catalog?.code || '',
    label: r.treatments_catalog?.label || '(sem descrição)',
    qty: r.qty ?? 1,
  }));

  const exames = examRows || [];

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
