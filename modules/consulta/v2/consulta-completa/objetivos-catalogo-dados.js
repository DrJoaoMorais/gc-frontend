/* =================================================================
   OBJETIVOS-CATALOGO-DADOS.JS — tabelas de etiquetas partilhadas
   -----------------------------------------------------------------
   Fonte única para os valores fixos do catálogo de objetivos.
   Usado por objetivos-catalogo.js (pills + resumo do acordeão) e
   por objetivos-frase.js (gerador de frase). Não duplicar estas
   listas noutro sítio — se um valor mudar aqui, muda nos dois.
   ================================================================= */

export const ADM_TREE = {
  'Ombro':        { movimentos: ['Flexão', 'Extensão', 'Abdução', 'Rotação externa', 'Rotação interna'] },
  'Cotovelo':     { movimentos: ['Flexão', 'Extensão', 'Pronação', 'Supinação'] },
  'Punho-mão':    { subregioes: {
                      'Punho':      ['Flexão palmar', 'Extensão', 'Desvio radial', 'Desvio cubital', 'Pronação', 'Supinação'],
                      'Mão global': ['Ponta-palma (cm)'],
                    } },
  'Anca':         { movimentos: ['Flexão', 'Extensão', 'Abdução', 'Adução', 'Rotação interna', 'Rotação externa'] },
  'Joelho':       { movimentos: ['Flexão', 'Extensão'] },
  'Tibiotársica': { movimentos: ['Dorsiflexão', 'Flexão plantar', 'Inversão', 'Eversão'] },
  'Cervical':     { movimentos: ['Flexão', 'Extensão', 'Inclinação lateral D', 'Inclinação lateral E', 'Rotação D', 'Rotação E'] },
  'Lombar':       { movimentos: ['Flexão anterior tronco', 'Extensão', 'Inclinação lateral D', 'Inclinação lateral E', 'Rotação D', 'Rotação E'] },
};
export const ADM_ARTICULACOES = Object.keys(ADM_TREE);

export const RETORNO_FASES = [
  { v: 1, lbl: '1 · Repouso' },
  { v: 2, lbl: '2 · Treino leve' },
  { v: 3, lbl: '3 · Treino específico' },
  { v: 4, lbl: '4 · Treino completo' },
  { v: 5, lbl: '5 · Competição' },
];

export const MOTOR_NIVEIS = ['Ausente', 'Inicial', 'Parcial', 'Funcional'];

/* unidade: exactamente o texto gravado no campo `unidade` da saída
   {chave,valor,unidade} — usado tanto para desenhar as pills como
   para o gerador de frase reconstruir a leitura a partir da saída. */
export const FORCA_ESCALAS = [
  { v: 'grau', lbl: 'Grau (1–5)', unidade: 'grau (1-5)' },
  { v: 'kg',   lbl: 'Dinamómetro (kg)', unidade: 'kg' },
];

export const EQUILIBRIO_ESCALAS = [
  { v: 'sem',  lbl: 'Sem escala', unidade: 'sem escala' },
  { v: 'tug',  lbl: 'TUG (segundos)', unidade: 'segundos (TUG)' },
  { v: 'berg', lbl: 'Berg (pontos)', unidade: 'pontos (Berg)' },
];

const DIACRITICOS_RE = new RegExp('[̀-ͯ]', 'g');
export const slug = (s) => String(s).toLowerCase()
  .normalize('NFD').replace(DIACRITICOS_RE, '')
  .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
