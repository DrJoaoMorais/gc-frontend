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

import { ADM_TREE, RETORNO_FASES, FORCA_ESCALAS, EQUILIBRIO_ESCALAS, slug } from './objetivos-catalogo-dados.js';

/* ── ADM ativa: chave "adm.<articulacao>.[<subregiao>.]<movimento>"
   não guarda o texto original (só o slug), por isso para escrever a
   frase é preciso o caminho inverso: percorrer ADM_TREE e comparar
   slugs até encontrar o rótulo original. ── */
function caminhoAdmLegivel(chave) {
  const partes = chave.split('.').slice(1); // remove o prefixo "adm"
  for (const [articulacao, no] of Object.entries(ADM_TREE)) {
    if (slug(articulacao) !== partes[0]) continue;

    if (no.subregioes) {
      const subSlug = partes[1];
      for (const [subregiao, movimentos] of Object.entries(no.subregioes)) {
        if (slug(subregiao) !== subSlug) continue;
        const movimento = movimentos.find((m) => slug(m) === partes[2]);
        if (movimento) return `${articulacao} · ${subregiao} · ${movimento}`;
      }
    } else {
      const movimento = no.movimentos.find((m) => slug(m) === partes[1]);
      if (movimento) return `${articulacao} · ${movimento}`;
    }
  }
  return null; // chave não reconhecida — cai no fallback do chamador
}

function linhaAdm(o) {
  const caminho = caminhoAdmLegivel(o.chave) || o.chave;
  return `ADM ativa — ${caminho}: ${o.valor}${o.unidade === 'cm' ? ' cm' : '°'}`;
}

function linhaForca(o) {
  const escala = FORCA_ESCALAS.find((e) => e.unidade === o.unidade);
  if (escala?.v === 'grau') return `Força: grau ${o.valor}/5`;
  if (escala?.v === 'kg') return `Força: ${o.valor} kg (dinamómetro)`;
  return `Força: ${o.valor} ${o.unidade}`; // escala não reconhecida — não falha silenciosamente
}

function linhaEquilibrio(o) {
  const escala = EQUILIBRIO_ESCALAS.find((e) => e.unidade === o.unidade);
  return `Equilíbrio: ${o.valor} (${escala ? escala.lbl : o.unidade})`;
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
