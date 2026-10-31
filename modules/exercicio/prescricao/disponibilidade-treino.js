// Limites de tempo referidos pelo doente. Não criam sessões nem definem doses.
export const PERGUNTAS_DISPONIBILIDADE = Object.freeze({ uteis: 'exercicio_minutos_dias_uteis', fimSemana: 'exercicio_minutos_fim_semana' });
const TIPOS = ['pre_consulta', 'pre_consulta_v2'];
export function minutosDisponiveis(value) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 1440 ? value : null;
}
function diaValido(value) {
  if (!value || !Object.hasOwn(value, 'min')) return null;
  const min = minutosDisponiveis(value.min);
  if (value.min !== null && min === null) return null;
  return { ativo: value.ativo !== false, min, local: typeof value.local === 'string' ? value.local : 'Casa' };
}
export function normalizarDisponibilidade(value) {
  if (value?.versao !== 1 || !Array.isArray(value.semanal) || value.semanal.length !== 7) return null;
  const semanal = value.semanal.map(diaValido);
  if (semanal.some(d => !d)) return null;
  const porData = {};
  for (const [date, dia] of Object.entries(value.porData || {})) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const parsed = diaValido(dia);
    if (parsed) porData[date] = parsed;
  }
  const o = value.origem;
  const origem = o && typeof o.id === 'string' ? { id: o.id, concluidoEm: o.concluidoEm || null, tipo: o.tipo || null, uteis: minutosDisponiveis(o.uteis), fimSemana: minutosDisponiveis(o.fimSemana) } : null;
  return { versao: 1, semanal, porData, origem };
}
export function disponibilidadeDasRespostas(rows, token) {
  const respostas = new Map((rows || []).map(row => [row.question_id, row.answer]));
  const uteis = minutosDisponiveis(respostas.get(PERGUNTAS_DISPONIBILIDADE.uteis));
  const fimSemana = minutosDisponiveis(respostas.get(PERGUNTAS_DISPONIBILIDADE.fimSemana));
  const legado = respostas.get(token?.questionnaire_type === 'pre_consulta' ? 's6_duracao_sessao' : 's4_tempo_realista_sessao');
  const intervaloAnterior = typeof legado === 'string' ? legado : null;
  if (uteis === null && fimSemana === null) return { status: 'sem_valores_diarios', intervaloAnterior, disponibilidade: null, concluidoEm: token?.completed_at || null };
  return { status: 'ok', intervaloAnterior, concluidoEm: token?.completed_at || null, disponibilidade: {
    versao: 1, semanal: Array.from({ length: 7 }, (_, d) => { const min = d < 5 ? uteis : fimSemana; return { ativo: min !== 0, min, local: 'Casa' }; }), porData: {},
    origem: { id: token.id, concluidoEm: token.completed_at || null, tipo: token.questionnaire_type, uteis, fimSemana },
  } };
}
export async function lerDisponibilidadeQuestionario(sb, patientId, clinicId) {
  if (!sb || !patientId || !clinicId) return { status: 'indisponivel', disponibilidade: null };
  try {
    const { data: token, error } = await sb.from('intake_tokens')
      .select('id,patient_id,clinic_id,questionnaire_type,completed_at')
      .eq('patient_id', patientId).eq('clinic_id', clinicId).eq('status', 'completed')
      .in('questionnaire_type', TIPOS).order('completed_at', { ascending: false }).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    if (!token) return { status: 'sem_questionario', disponibilidade: null };
    if (token.patient_id !== patientId || token.clinic_id !== clinicId) throw new Error('Contexto de questionário diferente.');
    const { data: rows, error: responseError } = await sb.from('intake_responses')
      .select('question_id,answer').eq('token_id', token.id)
      .in('question_id', [...Object.values(PERGUNTAS_DISPONIBILIDADE), 's4_tempo_realista_sessao', 's6_duracao_sessao']);
    if (responseError) throw responseError;
    return disponibilidadeDasRespostas(rows, token);
  } catch (error) {
    console.warn('[prescricao] Disponibilidade do questionário indisponível.');
    return { status: 'indisponivel', disponibilidade: null };
  }
}
export function disponibilidadeInicial(guardada, questionario) {
  return normalizarDisponibilidade(guardada) || normalizarDisponibilidade(questionario?.disponibilidade);
}
export function capturarDisponibilidade(ct, diaDaSemana, dataDoDia, anterior = null) {
  const porData = { ...(normalizarDisponibilidade(anterior)?.porData || {}) };
  for (const date of Object.keys(porData)) if (date >= ct.inicio && date <= ct.fim) delete porData[date];
  ct.semanas.forEach((semana, w) => semana.disp.forEach((dia, d) => {
    const date = dataDoDia(d, w);
    if (w > 0 && dia && date >= ct.inicio && date <= ct.fim) porData[date] = { ...dia };
  }));
  return normalizarDisponibilidade({ versao: 1, semanal: Array.from({ length: 7 }, (_, d) => ({ ...diaDaSemana(0, d) })), porData, origem: ct.origemDisponibilidade || null });
}
