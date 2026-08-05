/* =================================================================
   OBJETIVOS-FRASE.JS — gerador de frase a partir de objectives_data
   -----------------------------------------------------------------
   Função pura, sem DOM, sem Supabase. Recebe o array {chave, valor,
   unidade}[] que sai de objetivos-catalogo.js (o mesmo que o Passo 3
   vai gravar em consultations.objectives_data) e devolve uma frase
   de texto — uma linha por objetivo — para gravar em
   consultations.objectives (o texto que o relatório em PDF já lê).

   Usa as mesmas tabelas de objetivos-catalogo-dados.js que o
   componente usa para desenhar as pills, para a frase nunca poder
   dessincronizar da UI (ex: se "4 · Treino completo" mudar de nome,
   muda nos dois sítios de uma vez só).

   Ainda NÃO está ligada a nenhum ecrã — isso é o Passo 4.
   ================================================================= */

import { RETORNO_FASES, FORCA_ESCALAS, EQUILIBRIO_ESCALAS, caminhoAdmPorChave } from './objetivos-catalogo-dados.js';

/* ── ADM ativa: chave "adm.<articulacao>.[<subregiao>.]<movimento>"
   não guarda o texto original (só o slug) — caminhoAdmPorChave (em
   objetivos-catalogo-dados.js) percorre a ADM_TREE e devolve os
   rótulos originais com acentos. Essa função é partilhada com
   objetivos-catalogo.js (repovoar o catálogo a partir de
   objectives_data), por isso a travessia da árvore só existe uma vez. ── */
function linhaAdm(o) {
  const caminho = caminhoAdmPorChave(o.chave);
  const texto = caminho
    ? [caminho.articulacao, caminho.subregiao, caminho.movimento].filter(Boolean).join(' · ')
    : o.chave; // chave não reconhecida — cai no fallback, não falha silenciosamente
  return `ADM ativa — ${texto}: ${o.valor}${o.unidade === 'cm' ? ' cm' : '°'}`;
}

function linhaForca(o) {
  const escala = FORCA_ESCALAS.find((e) => e.unidade === o.unidade);
  if (escala?.v === 'grau') return `Força: grau ${o.valor}/5`;
  if (escala?.v === 'kg') return `Força: ${o.valor} kg (dinamómetro)`;
  return `Força: ${o.valor} ${o.unidade}`; // escala não reconhecida — não falha silenciosamente
}

function linhaEquilibrio(o) {
  const escala = EQUILIBRIO_ESCALAS.find((e) => e.unidade === o.unidade);
  if (escala?.v === 'tug') return `Equilíbrio: ${o.valor} s (TUG)`;
  if (escala?.v === 'berg') return `Equilíbrio: ${o.valor} pontos (Berg)`;
  return `Equilíbrio: ${o.valor} ${o.unidade}`; // escala não reconhecida — não falha silenciosamente
}

function linhaRetornoDesporto(o) {
  const fase = RETORNO_FASES.find((f) => f.v === o.valor);
  return `Retorno ao desporto: Fase ${fase ? fase.lbl : o.valor}`;
}

/* Controlo motor funde duas entradas de objectivesData (nível + foco)
   numa só linha de frase — por isso não entra no dicionário chave→linha
   de baixo, é tratado à parte em gerarFraseObjectivos(). */
function linhaControloMotor(nivelEntry, focoEntry) {
  const nivel = nivelEntry ? nivelEntry.valor : null;
  const foco = focoEntry?.valor?.length ? focoEntry.valor.join(', ') : null;
  if (nivel && foco) return `Controlo motor: ${nivel} · foco em ${foco}`;
  if (nivel) return `Controlo motor: ${nivel}`;
  if (foco) return `Controlo motor: foco em ${foco}`;
  return null;
}

const LINHA_POR_CHAVE = {
  dor: (o) => `Dor: EVA ${o.valor}/10`,
  forca: linhaForca,
  equilibrio: linhaEquilibrio,
  avd: (o) => `Autonomia nas AVD's: ${o.valor}`,
  retorno_desporto: linhaRetornoDesporto,
  hipertrofia: (o) => `Hipertrofia: ${o.valor} cm de perímetro`,
};

function linhaObjetivo(o) {
  if (o.chave.startsWith('adm.')) return linhaAdm(o);
  const fn = LINHA_POR_CHAVE[o.chave];
  if (fn) return fn(o);
  // chave desconhecida — não falha silenciosamente, escreve o que tem
  return `${o.chave}: ${o.valor}${o.unidade ? ' ' + o.unidade : ''}`;
}

/* ── API pública ──────────────────────────────────────────────── */
export function gerarFraseObjectivos(objectivesData) {
  if (!Array.isArray(objectivesData) || !objectivesData.length) return '';

  const nivelEntry = objectivesData.find((o) => o.chave === 'controlo_motor_nivel');
  const focoEntry = objectivesData.find((o) => o.chave === 'controlo_motor_foco');
  let motorEmitido = false;

  const linhas = [];
  objectivesData.forEach((o) => {
    if (o.chave === 'controlo_motor_nivel' || o.chave === 'controlo_motor_foco') {
      if (motorEmitido) return;
      motorEmitido = true;
      const linha = linhaControloMotor(nivelEntry, focoEntry);
      if (linha) linhas.push(linha);
      return;
    }
    if (o.chave === 'equilibrio' && o.unidade === 'sem escala') return; // "sem escala" não entra na frase
    linhas.push(linhaObjetivo(o));
  });

  return linhas.join('\n');
}
