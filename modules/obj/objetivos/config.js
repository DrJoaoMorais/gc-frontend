/* modules/obj/objetivos/config.js
   Só dados, zero lógica — lido por ./motor.js.
   Reaproveita as tabelas partilhadas de objetivos-catalogo-dados.js
   (ADM_TREE, RETORNO_FASES, FORCA_ESCALAS, EQUILIBRIO_ESCALAS) em vez de
   as duplicar — ver aviso no topo desse ficheiro. */
import { ADM_TREE, ADM_ARTICULACOES, RETORNO_FASES, FORCA_ESCALAS, EQUILIBRIO_ESCALAS }
  from '../../consulta/v2/consulta-completa/objetivos-catalogo-dados.js';

export { ADM_TREE, ADM_ARTICULACOES, RETORNO_FASES, FORCA_ESCALAS, EQUILIBRIO_ESCALAS };

/* Diagnósticos (código ICD-9 em diagnoses_catalog.code) para os quais o
   bloco "Nível de dependência" aparece. Hoje só "Síndrome de imobilidade".
   Lista curada — estender aqui quando houver outro diagnóstico de
   fragilidade no catálogo. Não é uma faixa de códigos automática. */
export const DEPENDENCIA_DIAGNOSIS_CODES = ['728.2'];

export const DEPENDENCIA_NIVEIS = [
  { key: 0, label: 'Acamado / sem transferências' },
  { key: 1, label: 'Transferências com ajuda, sem marcha' },
  { key: 2, label: 'Marcha com apoio (barras/andarilho)' },
  { key: 3, label: 'Marcha independente' },
];

export const DEPENDENCIA_SEDESTACAO_OPCOES = ['<10 s', '10–30 s', '30–60 s', '>60 s'];
export const DEPENDENCIA_REACOES_OPCOES = ['Adequadas', 'Diminuídas', 'Ausentes'];
export const DEPENDENCIA_MARCHA_AUXILIAR_OPCOES = ['Nenhum', 'Bengala', 'Canadianas', 'Andarilho'];
export const DEPENDENCIA_MARCHA_ASSIST_OPCOES = ['Supervisão', 'Aj. mínima', 'Independente'];

export const FORCA_GRAU_OPCOES = [1, 2, 3, 4, 5];

export const ASHWORTH_OPCOES = ['0', '1', '1+', '2', '3', '4'];

export const ESTADO_OPCOES = [
  { key: 'cumprido', label: 'Cumprido' },
  { key: 'parcial', label: 'Parcial' },
  { key: 'nao', label: 'Não cumprido' },
];

/* As 8 categorias de objetivo. `tipo` diz ao motor que campos desenhar:
   - 'dor'      → EVA atual (chip 0-10) + meta EVA (chip 0-10)
   - 'forca'    → articulação (ADM_TREE) + movimento + escala (grau|kg) + valor + meta
   - 'adm'      → articulação (ADM_TREE) + movimento + graus atuais (sem meta — só regista)
   - 'ashworth' → escala Ashworth modificada atual (chip) + meta (chip)
   - 'texto'    → basal (texto livre) + meta (texto livre), com escala opcional
   - 'livre'    → só meta (texto livre) */
export const CATEGORIAS = [
  { id: 'dor', n: 1, nome: 'Dor', tipo: 'dor' },
  { id: 'forca', n: 2, nome: 'Força', tipo: 'forca' },
  { id: 'adm', n: 3, nome: 'ADM ativa', tipo: 'adm' },
  { id: 'equilibrio', n: 4, nome: 'Equilíbrio', tipo: 'texto', basalLabel: 'Basal', metaLabel: 'Meta próxima consulta', escalas: EQUILIBRIO_ESCALAS },
  { id: 'avd', n: 5, nome: "Autonomia AVD's", tipo: 'texto', basalLabel: 'Basal', metaLabel: 'Meta próxima consulta' },
  { id: 'retorno', n: 6, nome: 'Retorno ao desporto', tipo: 'texto', basalLabel: 'Fase atual', metaLabel: 'Meta próxima consulta', fases: RETORNO_FASES },
  { id: 'tonus', n: 7, nome: 'Tónus / Espasticidade', tipo: 'ashworth', metaLabel: 'Meta (Ashworth modificada)' },
  { id: 'livre', n: 8, nome: 'Livre', tipo: 'livre', metaLabel: 'Objetivo (texto livre)' },
];
