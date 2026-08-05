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
  return `Força: ${o.valor} (${escala ? escala.lbl : o.unidade})`;
}

function linhaEquilibrio(o) {
  if (o.valor == null) return 'Equilíbrio: sem escala definida';
  const escala = EQUILIBRIO_ESCALAS.find((e) => e.unidade === o.unidade);
  return `Equilíbrio: ${o.valor} (${escala ? escala.lbl : o.unidade})`;
}

function linhaRetornoDesporto(o) {
  const fase = RETORNO_FASES.find((f) => f.v === o.valor);
  return `Retorno ao desporto: Fase ${fase ? fase.lbl : o.valor}`;
}

const LINHA_POR_CHAVE = {
  dor: (o) => `Dor: EVA ${o.valor}/10`,
  forca: linhaForca,
  equilibrio: linhaEquilibrio,
  avd: (o) => `Autonomia nas AVD's: ${o.valor}`,
  retorno_desporto: linhaRetornoDesporto,
  controlo_motor_nivel: (o) => `Controlo motor: nível ${o.valor}`,
  controlo_motor_foco: (o) => `Controlo motor — foco: ${(o.valor || []).join(', ')}`,
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
  return objectivesData.map(linhaObjetivo).join('\n');
}
