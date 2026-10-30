import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const src=readFileSync(new URL('../../modules/exercicio/prescricao/dose-protocolo.js',import.meta.url),'utf8');
const {doseInicialGenerica,doseProtocoloCompleta}=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
const casos=[
  [{name:'Remada com elástico'},3,12,false],
  [{name:'Mobilização ativa-assistida do ombro'},1,10,false],
  [{name:'Rotação ativa',objetivos_exercicio:['Mobilidade / Alongamento']},1,10,false],
  [{name:'Isométrico de extensão'},5,10,true],
  [{name:'Prancha abdominal'},5,10,true],
  [{name:'Alongamento dos gémeos',objetivos_exercicio:['Mobilidade / Alongamento']},3,20,true],
  [{name:'Equilíbrio numa perna'},3,20,true],
  [{name:'Apoio unipodal',objetivos_exercicio:['Propriocepção / Equilíbrio']},3,20,true],
  [{name:'Passos laterais',objetivos_exercicio:['Propriocepção / Equilíbrio']},3,12,false],
  [{name:'Abdução com elástico',objetivos_exercicio:['Fortalecimento','Mobilidade / Alongamento']},3,12,false],
  [{name:'Bicicleta estática'},1,600,true],
];
for(const [ex,sets,amount,timed] of casos){
  const before=JSON.stringify(ex),d=doseInicialGenerica(ex);
  assert(doseProtocoloCompleta(d));assert.equal(d.sets,sets);
  assert.equal(timed ? d.duration_series[0].duration_sec : d.reps_fixed,amount);
  assert.equal(timed ? d.series : d.duration_series,null);
  assert.equal(JSON.stringify(ex),before);
}
const one=doseInicialGenerica({name:'Remada'});one.series[0].reps=99;
assert.equal(doseInicialGenerica({name:'Remada'}).series[0].reps,12);
// Exercícios novos na sessão e acrescentados a um protocolo usam a mesma regra.
const source=readFileSync(new URL('../../modules/exercicio/prescricao/prescricao.js',import.meta.url),'utf8');
const extract=(start,end)=>source.slice(source.indexOf('function '+start),source.indexOf('function '+end,source.indexOf('function '+start)));
const ex={id:'e1',name:'Isométrico de extensão'};
const state={exercisesCatalog:[ex]},patologia={selecionados:new Map(),adicionadosCatalogo:[]};
const ctx=vm.createContext({doseInicialGenerica,textoParaDoente:x=>x,conteudoParaDoente:x=>x,_state:state,_patologia:patologia,renderPatologiaBody:()=>{}});
vm.runInContext(extract('novoItemDeExercicio(ex)','toggleExercicioNaSessao'),ctx);
vm.runInContext(extract('adicionarExercicioCatalogoPatologia(exId)','removerAdicionadoPatologia'),ctx);
const item=ctx.novoItemDeExercicio(ex);assert.equal(item.sets,5);assert.equal(item.duration_series[0].duration_sec,10);
ctx.adicionarExercicioCatalogoPatologia('e1');const meta=patologia.selecionados.get('e1');assert.equal(meta.prescription_defaults.sets,5);
meta.prescription_defaults.duration_series[0].duration_sec=25;
ctx.adicionarExercicioCatalogoPatologia('e1');assert.equal(meta.prescription_defaults.duration_series[0].duration_sec,25);
console.log('Doses generalistas: cinco tipos, modos, criação, seleção e edição preservada: OK');
