import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tempoForca,tempoExercicioForca,compilarForca} from '../modules/exercicio/prescricao/forca-blocos.js';
import {textoTempoForca,renderItemsForca} from '../modules/exercicio/prescricao/forca-editor.js';
const timed=()=>({item_id:'time',exercise_id:'time',name:'Agachamento por tempo',dose_unit:'time',strength_series:[{value:30,reps_min:8,reps_max:12},{value:30,reps_min:8,reps_max:12}],rest_set:45,rest_next:null});
const reps=()=>({item_id:'reps',exercise_id:'reps',name:'Chest Press',dose_unit:'reps',strength_series:[{value:10},{value:10}],rest_set:45,rest_next:30,tempo_concentrico_s:2,tempo_excentrico_s:2});
const mixed=()=>({block_id:'mixed',type:'circuit',name:'Misto',rounds:3,rest_between_rounds_s:60,items:[reps(),timed()]});
test('segundos ignoram intervalos antigos de repetições e dispensam cadência',()=>{
 const block={type:'series',items:[timed()]};const total=tempoForca([block]);
 assert.equal(total.seconds,105);assert.equal(total.incomplete,false);assert.deepEqual(total.pending,[]);
 assert.ok(compilarForca([block])[0].intervals.every(i=>i.prescribed_reps_min==null&&i.prescribed_reps_max==null));
});
test('circuito misto soma séries, transições e apenas os descansos devidos',()=>{
 const block=mixed(),total=tempoForca([block]);assert.equal(total.seconds,900);assert.equal(total.incomplete,false);
 assert.equal(tempoExercicioForca(block.items[0]).seconds,125);assert.equal(tempoExercicioForca(block.items[1]).seconds,105);
 assert.equal(compilarForca([block])[0].intervals.at(-1).type,'trabalho');
});
test('cadência em falta num exercício não esconde os segundos dos restantes',()=>{
 const block=mixed();delete block.items[0].tempo_concentrico_s;delete block.items[0].tempo_excentrico_s;
 const total=tempoForca([block]);assert.equal(total.seconds,660);assert.equal(total.incomplete,true);
 assert.deepEqual(total.pending,[{name:'Chest Press',reason:'cadência por repetição'}]);
 assert.match(textoTempoForca(total),/11 min 0 s/);assert.match(textoTempoForca(total),/Chest Press/);
 assert.equal(tempoExercicioForca(block.items[1]).incomplete,false);
});
test('a falta de segundos ou descanso é identificada sem pedir cadência a exercícios por tempo',()=>{
 const item=timed();item.strength_series[0].value=null;item.rest_set=null;
 const total=tempoForca([{type:'series',items:[item]}]);assert.equal(total.seconds,30);assert.equal(total.incomplete,true);
 assert.ok(total.pending.some(p=>p.reason==='segundos por série'));assert.ok(total.pending.some(p=>p.reason==='descanso entre séries'));
 assert.ok(!total.pending.some(p=>p.reason.includes('cadência')));
});
test('intervalos de repetições continuam aproximados, mas não contaminam outra unidade',()=>{
 const item=reps();item.strength_series=[{value:null,reps_min:8,reps_max:12}];
 assert.equal(tempoExercicioForca(item).incomplete,true);
 item.strength_series[0].value=10;assert.equal(tempoExercicioForca(item).incomplete,false);
 const block=mixed(),html=renderItemsForca(block,0,[block]);assert.match(html,/Por volta: 1 min 45 s/);
});
