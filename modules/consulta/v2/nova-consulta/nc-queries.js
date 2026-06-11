/* ============================================================
   Nova Consulta — nc-queries.js
   Carrega todas as consultas de um doente em 2 rounds de
   Promise.all (6 queries, ~2 RTTs), prontas para cc-feed.js.
   Não escreve nada. Não toca em cc-queries.js.
   ============================================================ */

export async function carregarFeedDoente(patientId) {
  const sb = window.sb;
  if (!sb) throw new Error('Supabase (window.sb) não inicializado.');

  /* ── Round 1: queries independentes do lista de IDs ─────────
     a) lista de consultas   d) exames do doente   e) protocolos do doente
     ─────────────────────────────────────────────────────────── */
  const [
    { data: consultRows,  error: eC },
    { data: assessRows,   error: eA },
    { data: protRows,     error: eP },
  ] = await Promise.all([

    /* a. Consultas */
    sb.from('consultations')
      .select('id, report_date, issued_date, hda, plan_text, author_display_name, treatment_sessions, objectives')
      .eq('patient_id', patientId)
      .order('report_date', { ascending: false })
      .order('created_at',  { ascending: false }),

    /* d. Exames objectivos — por doente (apanha retroactivos com consultation_id NULL) */
    sb.from('consultation_assessments')
      .select('id, consultation_id, assessment_type, assessment_side, assessment_date, data, created_at')
      .eq('patient_id', patientId)
      .order('assessment_date', { ascending: false }),

    /* e. Protocolos — por doente */
    sb.from('consultation_protocols')
      .select('id, consultation_id, protocol_id, phase_id, data, protocol_date, protocols_catalog ( region, name, kind ), protocol_phases ( phase_order, name, anchor_from, anchor_to, data )')
      .eq('patient_id', patientId)
      .order('protocol_date', { ascending: false }),

  ]);

  if (eC) throw eC;
  if (eA) throw eA;
  if (eP) throw eP;

  const consultas = consultRows || [];
  const ids = consultas.map(c => c.id);

  if (!ids.length) return { consultas: [], examesAvulsos: new Map() };

  /* ── Round 2: filhos indexados por consultation_id ───────────
     b) diagnósticos   c) tratamentos
     ─────────────────────────────────────────────────────────── */
  const [
    { data: diagRows, error: eD },
    { data: tratRows, error: eT },
  ] = await Promise.all([

    /* b. Diagnósticos */
    sb.from('consultation_diagnoses')
      .select('consultation_id, diagnosis_id, diagnoses_catalog ( system, code, label )')
      .in('consultation_id', ids),

    /* c. Tratamentos */
    sb.from('consultation_treatments')
      .select('consultation_id, qty, treatments_catalog ( code, label )')
      .in('consultation_id', ids),

  ]);

  if (eD) throw eD;
  if (eT) throw eT;

  /* ── Agrupamento por consultation_id (Maps) ─────────────── */
  const diagMap        = new Map();
  const tratMap        = new Map();
  const assessMap      = new Map();
  const protMap        = new Map();
  const examesAvulsos  = new Map(); /* assessment_date → [] para cid NULL */

  for (const r of (diagRows || [])) {
    const cid = r.consultation_id;
    if (!diagMap.has(cid)) diagMap.set(cid, []);
    diagMap.get(cid).push({
      system: r.diagnoses_catalog?.system || 'local',
      code:   r.diagnoses_catalog?.code   || '',
      label:  r.diagnoses_catalog?.label  || '(sem descrição)',
    });
  }

  for (const r of (tratRows || [])) {
    const cid = r.consultation_id;
    if (!tratMap.has(cid)) tratMap.set(cid, []);
    tratMap.get(cid).push({
      code:  r.treatments_catalog?.code  || '',
      label: r.treatments_catalog?.label || '(sem descrição)',
      qty:   r.qty ?? 1,
    });
  }

  for (const r of (assessRows || [])) {
    const cid = r.consultation_id;
    if (cid) {
      if (!assessMap.has(cid)) assessMap.set(cid, []);
      assessMap.get(cid).push(r);
    } else {
      /* retroactivo sem consulta — agrupa por assessment_date */
      const dt = r.assessment_date || 'sem-data';
      if (!examesAvulsos.has(dt)) examesAvulsos.set(dt, []);
      examesAvulsos.get(dt).push(r);
    }
  }

  for (const r of (protRows || [])) {
    const cid = r.consultation_id;
    if (!cid) continue;
    if (!protMap.has(cid)) protMap.set(cid, []); /* guarda todos; render usa [0] */
    protMap.get(cid).push(r);
  }

  /* ── Monta resultado final ─────────────────────────────────── */
  const consultasOut = consultas.map(c => {
    const pr = (protMap.get(c.id) || [])[0] || null;

    return {
      consulta:    c,
      diagnosticos: diagMap.get(c.id)   || [],
      tratamentos:  tratMap.get(c.id)   || [],
      exames:       assessMap.get(c.id) || [],
      protocolo: pr ? {
        id:     pr.id,
        nome:   pr.protocols_catalog?.name   || '',
        regiao: pr.protocols_catalog?.region || '',
        tipo:   pr.protocols_catalog?.kind   || '',
        fase:   pr.protocol_phases ? {
          ordem:      pr.protocol_phases.phase_order,
          nome:       pr.protocol_phases.name,
          ancora_de:  pr.protocol_phases.anchor_from,
          ancora_ate: pr.protocol_phases.anchor_to,
          dados: { ...(pr.protocol_phases.data || {}), ...(pr.data || {}) },
        } : null,
      } : null,
    };
  });

  return { consultas: consultasOut, examesAvulsos };
}
