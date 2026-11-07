import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepararForca, itemForca, novoBlocoForca, erroForca, compilarForca, tempoForca, sessaoForcaGuardada } from '../modules/exercicio/prescricao/forca-blocos.js';
let n=0;const id=()=>String(++n);
const exercise=(name,value,load,sets=1,timed=false)=>itemForca({
  exercise_id:name,name,photo_url:'https://example.org/'+name+'.png',rest_set:30,rest_next:20,
  tempo_concentrico_s:2,tempo_excentrico_s:2,
  ...(timed?{duration_series:Array.from({length:sets},()=>({duration_sec:value,load}))}:{series:Array.from({length:sets},()=>({reps:value,load}))}),
},id);
function mixed(){
 const first=novoBlocoForca(id);first.items=[exercise('Agachamento',10,10,3)];
 const second=novoBlocoForca(id,'circuit');second.rounds=3;second.rest_between_rounds_s=60;
 second.items=[exercise('Cadeira',10,0),exercise('Ponte',30,0,1,true),exercise('Calcanhares',12,5)];
 return [first,second];
}
test('mixed session compiles one consistent queue with loads and three separate rest types',()=>{
 const blocks=mixed();assert.equal(erroForca(blocks),'');
 const intervals=compilarForca(blocks).flatMap(b=>b.intervals);
 assert.equal(tempoForca(blocks).seconds,794);
 assert.equal(intervals.filter(i=>i.type==='trabalho').length,12);
 assert.equal(intervals.filter(i=>i.rest_kind==='set').length,2);
 assert.equal(intervals.filter(i=>i.rest_kind==='round').length,2);
 assert.equal(intervals.filter(i=>i.rest_kind==='block').length,1);
 assert.equal(intervals.filter(i=>i.rest_kind==='exercise').length,6);
 assert.equal(intervals.at(-1).type,'trabalho');
 assert.equal(intervals[0].load,10);assert.equal(intervals[0].duration_sec,40);
 assert.equal(intervals[0].set_total,3);assert.ok(intervals[0].photo_url);
 blocks[0].items[0].strength_series[1].value=8;
 blocks[0].items[0].strength_series[1].load=12.5;
 assert.equal(tempoForca(blocks).seconds,786);
 assert.equal(compilarForca(blocks)[0].intervals.filter(i=>i.type==='trabalho')[1].load,12.5);
 const session={kind:'list',session_id:'keep-id',date:'2026-11-07',strength_blocks:blocks};
 const saved=sessaoForcaGuardada(session);
 assert.equal(saved.session_id,session.session_id);assert.equal(saved.kind,'circuit');
 const reopened=JSON.parse(JSON.stringify(saved));
 prepararForca(reopened,[],id);
 assert.deepEqual(compilarForca(reopened.strength_blocks),saved.blocks);
 assert.equal(session.kind,'list');
});
test('old list doses, ranges, timed sets and notes are preserved when converted',()=>{
 const original={kind:'list',items:[
  {exercise_id:'a',name:'A',sets:2,reps_min:8,reps_max:12,load:5,rest_set:30,rest_next:20,prescription_note:'Instrução',tempo_concentrico_s:2,tempo_excentrico_s:3},
  {exercise_id:'b',name:'B',duration_series:[{duration_sec:20},{duration_sec:30}],load:0,rest_set:10,rest_next:null}
 ]};
 const snapshot=structuredClone(original.items);
 const blocks=prepararForca(original,[],id);
 assert.equal(erroForca(blocks),'');
 assert.deepEqual(original.items,snapshot);
 const intervals=compilarForca(blocks)[0].intervals;
 assert.equal(intervals[0].prescription_note,'Instrução');
 assert.equal(intervals[0].prescribed_reps_min,8);assert.equal(intervals[0].load,5);
 assert.equal(intervals[0].manual_reps,true);
 assert.equal(tempoForca(blocks).incomplete,true);
 assert.deepEqual(intervals.filter(i=>i.exercise_id==='b'&&i.type==='trabalho').map(i=>i.duration_sec),[20,30]);
});
test('saved circuit intervals round-trip exactly, including unknown sequences',()=>{
 const s={kind:'circuit',blocks:[
  {block_id:'x',name:'Variação antiga',intervals:[{type:'trabalho',duration_sec:7,label:'Original',exercise_id:'a',custom:{keep:true}}]},
  {block_id:'y',name:'Aquecimento',intervals:[{type:'mobilizacao',label:'Mobilizar',duration_sec:30,custom:'keep'}]}
 ]};
 const original=structuredClone(s.blocks),blocks=prepararForca(s,[],id);
 assert.deepEqual(compilarForca(blocks),original);
});
test('missing cadence permits manual repetitions without inventing execution time',()=>{
 const block=novoBlocoForca(id);
 block.items=[itemForca({exercise_id:'a',name:'A',series:[{reps:10,load:null}],rest_next:null},id)];
 assert.equal(erroForca([block]),'');
 assert.equal(compilarForca([block])[0].intervals[0].manual_reps,true);
 assert.equal(tempoForca([block]).incomplete,true);
 block.items[0].tempo_concentrico_s=2;block.items[0].tempo_excentrico_s=3;
 assert.equal(compilarForca([block])[0].intervals[0].duration_sec,50);
 assert.equal(tempoForca([block]).incomplete,false);
});
test('validation rejects incomplete doses but does not require an unused final rest or weight',()=>{
 const blocks=mixed();
 blocks.at(-1).items.at(-1).rest_next=null;
 assert.equal(erroForca(blocks),'');
 blocks[0].items[0].rest_set=null;assert.match(erroForca(blocks),/entre séries/);
 blocks[0].items[0].rest_set=0;blocks[0].items[0].strength_series[1].value=null;
 assert.match(erroForca(blocks),/dose/);
});
