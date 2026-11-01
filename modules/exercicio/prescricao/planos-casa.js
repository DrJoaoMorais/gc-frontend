import { sugerirVariantesCasa, semanaCasa, proporProgramaCasa } from './programa-casa.js?v=2026-11-01-1';
// Modelos de proposta: exercícios e doses já definidos. A atribuição cria cópias independentes.
export const PLANOS_CASA = Object.freeze([
 {id:'casa-iniciacao-20',nome:'Perda de peso · Iniciação',resumo:'Começar com duas sessões de força e uma de cardio.',minutos:20,frequencia:3,nivel:'leve'},
 {id:'casa-rotina-30',nome:'Rotina equilibrada',resumo:'Mais tempo de atividade, mantendo três dias de treino.',minutos:30,frequencia:3,nivel:'leve'},
 {id:'casa-completo-45',nome:'Corpo inteiro · 45 minutos',resumo:'Força A/B e blocos de cardio mais longos.',minutos:45,frequencia:3,nivel:'moderado'},
 {id:'casa-regular-20',nome:'Sessões curtas · 4 dias',resumo:'Duas sessões de força e duas de cardio sem saltos.',minutos:20,frequencia:4,nivel:'leve'},
 {id:'casa-forca-cardio-30',nome:'Força e cardio',resumo:'Quatro sessões com alternância entre força e cardio.',minutos:30,frequencia:4,nivel:'moderado'},
 {id:'casa-variado-30',nome:'Semana variada',resumo:'Duas de força, duas de cardio e uma sessão mista.',minutos:30,frequencia:5,nivel:'moderado'},
].map(p=>Object.freeze(p)));
export function configuracaoPlanoCasa(plano,catalogo,inicio) {
 return {inicio,frequencia:plano.frequencia,minutos:plano.minutos,nivel:plano.nivel,voltas:2,reps:8,pausa:45,entreVoltas:60,variantes:sugerirVariantesCasa(catalogo),semana:semanaCasa(plano.frequencia),programName:plano.nome,programSource:plano.id};
}
export function preverPlanoCasa(plano,catalogo,tempoRepeticao=()=>4) {
 let id=0;
 return proporProgramaCasa(configuracaoPlanoCasa(plano,catalogo,'2026-01-05'),{catalogo,criarId:()=>`${plano.id}-modelo-${++id}`,disponibilidade:()=>({ativo:true,min:plano.minutos}),ocupado:()=>false,tempoRepeticao});
}
export function tempoPlanoCasa(sec){sec=Math.max(0,Math.round(Number(sec)||0));const m=Math.floor(sec/60),s=sec%60;return m?(s?`${m} min ${s} s`:`${m} min`):`${s} s`;}
