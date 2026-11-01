// Apoio aritmético ao prescritor. Não seleciona exercícios nem determina intensidade.
export function disponibilidadeCircuito(answer) {
  const value = answer && typeof answer === 'object' && !Array.isArray(answer) ? answer.v : answer;
  const texto = Array.isArray(value) ? value[0] : value;
  if (typeof texto !== 'string') return null;
  const normalizado = texto.trim().replace(/[–—]/g, '-');
  const intervalo = normalizado.match(/^(\d+)\s*-\s*(\d+)\s*min$/i);
  if (intervalo) {
    const min = Number(intervalo[1]), max = Number(intervalo[2]);
    return min > 0 && max >= min ? { texto, min, max } : null;
  }
  // Mais de 60 permite usar conservadoramente 60; menos de 15 não fornece mínimo.
  if (/^Mais de 60\s*min$/i.test(normalizado)) return { texto, min: 60, max: null };
  if (/^Menos de 15\s*min$/i.test(normalizado)) return { texto, min: null, max: 15 };
  return null;
}

export function proporComposicaoCircuito(config, numeroExercicios, disponibilidade = null) {
  const positivo = v => Number.isFinite(Number(v)) && Number(v) > 0;
  const naoNegativo = v => v !== '' && v != null && Number.isFinite(Number(v)) && Number(v) >= 0;
  if (!positivo(config.minutos) || !positivo(config.trabalho) || !positivo(config.voltas)
      || !Number.isInteger(Number(config.voltas)) || !Number.isInteger(numeroExercicios) || numeroExercicios < 1
      || !['transicao', 'pausa', 'aquecimento', 'retorno'].every(k => naoNegativo(config[k]))) {
    return { erro: 'Escolha exercícios e preencha os tempos e as voltas com valores válidos.' };
  }
  const limiteMin = disponibilidade?.min > 0 ? Math.min(Number(config.minutos), disponibilidade.min) : Number(config.minutos);
  const limite = Math.floor(limiteMin * 60);
  const aquecimento = Math.round(Number(config.aquecimento) * 60);
  const retorno = Math.round(Number(config.retorno) * 60);
  const trabalho = Math.round(Number(config.trabalho));
  const transicao = Math.round(Number(config.transicao));
  const pausa = Math.round(Number(config.pausa));
  if (trabalho < 1) return { erro: 'O trabalho deve ter pelo menos 1 segundo.' };
  // Inclui a transição após cada estação, incluindo a última, como no mockup.
  const volta = numeroExercicios * (trabalho + transicao);
  const cabem = Math.floor((limite - aquecimento - retorno + pausa) / (volta + pausa));
  const voltas = Math.min(Number(config.voltas), cabem);
  if (voltas < 1) return { erro: 'Não cabe uma volta completa com estes tempos. Reveja a composição; os exercícios e as pausas foram preservados.' };
  const circuito = voltas * volta;
  const recuperacao = (voltas - 1) * pausa;
  const marcha = limite - aquecimento - retorno - circuito - recuperacao;
  return { limiteMin, total: limite, aquecimento, retorno, trabalho, transicao, pausa, voltas,
    circuito, recuperacao, marcha, reduzido: voltas < Number(config.voltas),
    ajustado: limiteMin < Number(config.minutos) };
}

// Blocos antigos com intervalos são preservados integralmente ao voltar a gravar.
export function tempoCircuitoGuardado(bloco) {
  return (bloco.intervals || []).reduce((total, i) => total + Math.max(0, Number(i.duration_sec) || 0), 0);
}

export function assinaturaBlocoCircuito(b) {
  const { _originalBlock, _originalSignature, ...editor } = b;
  return JSON.stringify(editor);
}

// Recupera apenas o formato que o editor conhece. Qualquer outra sequência fica intacta.
export function editarBlocosCircuito(blocks, criarId) {
  return (blocks || []).map(original => {
    if (!Array.isArray(original.intervals)) return original;
    const lista = original.intervals;
    let b;
    if (lista.length === 1 && lista[0].type === 'mobilizacao') {
      b = { block_id: original.block_id, tipo: 'fixed', name: original.name, duration_sec: lista[0].duration_sec };
    } else {
      const trabalhos = lista.filter(i => i.type === 'trabalho');
      const primeira = trabalhos.filter(i => i.round_index === 1);
      const rounds = trabalhos[0]?.round_total;
      if (!primeira.length || !Number.isInteger(rounds) || rounds < 1 || rounds > 1000) return original;
      const exercicios = primeira.map(i => ({ id: criarId(), exercise_id: i.exercise_id, name: i.exercise_name || i.label, measure: i.prescribed_measure === 'reps' ? 'reps' : 'time', value: i.prescribed_measure === 'reps' ? i.prescribed_value : i.duration_sec, rest_after_s: 0 }));
      let cursor = 0, pausa = null;
      for (let r = 1; r <= rounds; r++) {
        for (let ei = 0; ei < exercicios.length; ei++) {
          const ex = exercicios[ei], i = lista[cursor++];
          if (!i || i.type !== 'trabalho' || i.exercise_id !== ex.exercise_id || i.duration_sec !== primeira[ei].duration_sec || (i.prescribed_measure || 'time') !== ex.measure || (ex.measure === 'reps' && i.prescribed_value !== ex.value)
              || i.round_index !== r || i.exercise_index !== ei + 1 || i.round_total !== rounds
              || i.exercise_total !== exercicios.length || (i.exercise_name || i.label) !== ex.name) return original;
          const seguinte = lista[cursor];
          let descanso = 0;
          if (seguinte?.type === 'descanso' && seguinte.round_index === r && seguinte.exercise_index === ei + 1) {
            if (seguinte.exercise_id !== ex.exercise_id || !Number.isFinite(seguinte.duration_sec) || seguinte.duration_sec < 0) return original;
            descanso = seguinte.duration_sec;
            cursor++;
          }
          if (r === 1) ex.rest_after_s = descanso;
          else if (ex.rest_after_s !== descanso) return original;
        }
        if (r < rounds) {
          const seguinte = lista[cursor];
          let descanso = 0;
          if (seguinte?.type === 'descanso' && seguinte.round_index === r + 1 && seguinte.exercise_index === 1) {
            if (seguinte.exercise_id !== exercicios[0].exercise_id || !Number.isFinite(seguinte.duration_sec) || seguinte.duration_sec < 0) return original;
            descanso = seguinte.duration_sec;
            cursor++;
          }
          if (pausa == null) pausa = descanso;
          else if (pausa !== descanso) return original;
        }
      }
      if (cursor !== lista.length) return original;
      b = { block_id: original.block_id, tipo: 'voltas', name: original.name, rounds, rest_between_rounds_s: pausa || 0, exercicios };
    }
    b._originalSignature = assinaturaBlocoCircuito(b);
    b._originalBlock = structuredClone(original);
    return b;
  });
}
