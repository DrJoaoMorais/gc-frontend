import * as blocks from '../modules/exercicio/prescricao/forca-blocos.js';
import * as models from '../modules/exercicio/prescricao/forca-modelos.js';
import * as editor from '../modules/exercicio/prescricao/forca-editor.js';

// Synthetic records only. Run: node tests/forca-modelos-ajustes.test.mjs
async function verify(){
const passed=[];
const check=(value,message)=>{if(!value)throw new Error(message);};
const equal=(a,b,message)=>check(JSON.stringify(a)===JSON.stringify(b),message+' ('+JSON.stringify(a)+')');
const throws=fn=>{let error=false;try{fn()}catch{error=true;}check(error,'Expected an error');};
let counter=0;const id=()=>'synthetic-'+(++counter);
const catalog=[{id:'ex-1',name:'Máquina A',is_active:true,tempo_concentrico_s:99,load:999,machine_seat_height:'DO NOT COPY'},{id:'ex-2',name:'Máquina B',is_active:true}];
const source={block_id:'old',type:'series',name:'Força A',patient_id:'DO NOT COPY',items:[
 blocks.itemForca({exercise_id:'ex-2',name:'Máquina B',sets:3,reps_fixed:12,load:40,rest_set:60,rest_next:45,tempo_concentrico_s:2,tempo_excentrico_s:2,machine_position:'B2',machine_seat_height:'4',machine_other:'Encosto 3',prescription_note:'INDIVIDUAL'},id),
 blocks.itemForca({exercise_id:'ex-1',name:'Máquina A',sets:2,reps_fixed:10,load:20,rest_set:45},id)
]};
const template=models.estruturaModeloForca(source,'Modelo sintético');
equal(template,{version:1,name:'Modelo sintético',type:'series',items:[{exercise_id:'ex-2',sets:3},{exercise_id:'ex-1',sets:2}]},'Model must whitelist structure only');
passed.push('template strips patient data, doses, loads, rest and machine settings');
const applied=models.aplicarModeloForca(template,catalog,id,blocks.itemForca);
equal(applied.items.map(i=>[i.exercise_id,i.strength_series.length]),[['ex-2',3],['ex-1',2]],'Exercise order and series count');
check(applied.items.every(i=>i.strength_series.every(set=>set.value==null&&set.load==null)),'Doses must be empty');
check(applied.items.every(i=>!i.machine_seat_height&&!i.prescription_note&&!i.tempo_concentrico_s),'No catalogue doses or patient adjustments copied');
check(!!blocks.erroForca([applied]),'Unfilled template must not be prescribable');
check(applied.block_id!==source.block_id&&applied.items[0].item_id!==source.items[0].item_id,'Fresh IDs');
throws(()=>models.aplicarModeloForca(template,catalog.slice(0,1),id,blocks.itemForca));
throws(()=>models.aplicarModeloForca({...template,items:[{exercise_id:'ex-1',sets:0}]},catalog,id,blocks.itemForca));
passed.push('reuse preserves order and series, creates fresh IDs and requires dose');
const single={...source,items:[source.items[0]]};
equal(blocks.erroForca([single]),'','Old scalar rest remains valid');
equal(blocks.compilarForca([single])[0].intervals.filter(i=>i.rest_kind==='set').map(i=>i.duration_sec),[60,60],'Legacy scalar rests');
single.items[0].strength_series[0].rest_after_s=30;
single.items[0].strength_series[1].rest_after_s=45;
let queue=blocks.compilarForca([single])[0].intervals;
equal(queue.filter(i=>i.rest_kind==='set').map(i=>i.duration_sec),[30,45],'Per-set rests');
equal(blocks.tempoForca([single]).seconds,219,'Duration includes per-set rests and 3x12x4');
equal(queue.at(-1).type,'trabalho','No final rest');
equal(queue[0].machine_position,'B2','Machine position propagates');
equal(queue[0].machine_seat_height,'4','Seat height propagates');
equal(queue[0].machine_other,'Encosto 3','Other adjustments propagate');
single.items[0].strength_series[0].rest_after_s=null;
check(!!blocks.erroForca([single]),'Cleared rest cannot silently fall back on old rest');
single.items[0].strength_series[0].rest_after_s=0;
check(!blocks.erroForca([single]),'Explicit zero rest accepted');
passed.push('rest presets, zero and cleared rest, duration, legacy scalar rest and no final rest');
const html=editor.renderItemsForca(single,0,[single]);
check(html.includes('data-quick-value="8"')&&html.includes('data-quick-value="15"'),'Rep shortcuts');
check(html.includes('data-quick-value="30"')&&html.includes('data-quick-value="45"')&&html.includes('data-quick-value="60"'),'Rest shortcuts');
check(html.includes('data-field="machine_position"')&&html.includes('data-field="machine_seat_height"')&&html.includes('data-field="machine_other"'),'Machine fields render');
single.items[0].machine_position='<img src=x onerror=alert(1)>';
check(!editor.renderItemsForca(single,0,[single]).includes('<img src=x'),'Machine field HTML escaping');
passed.push('rendered compact fields, editable shortcuts and HTML escaping');
const saved=[];
const client={
 auth:{getUser:async()=>({data:{user:{id:'owner'}},error:null})},
 from(table){
  check(table==='wo_strength_templates','Table');
  return {
   insert(payload){
    saved.push({...payload,id:'stored-1'});
    return {select:()=>({single:async()=>({data:saved.at(-1),error:null})})};
   },
   select(){
    return {eq:(key,value)=>{
     equal([key,value],['user_id','owner'],'Owner filter');
     return {order:async()=>({data:saved,error:null})};
    }};
   }
  };
 }
};
await models.guardarModeloForca(client,source,'Persistente');
const reloaded=await models.listarModelosForca(client);
equal(reloaded.models[0].data.items,template.items,'Saved model reloads from database client');
check(!JSON.stringify(saved).includes('DO NOT COPY'),'No patient data saved');
const denied={auth:{getUser:async()=>({data:{user:null},error:new Error('expired')})}};
let deniedSave=false;try{await models.guardarModeloForca(denied,source,'Blocked')}catch{deniedSave=true;}check(deniedSave,'Expired session must fail');
const failing={...client,from:()=>({insert:()=>({select:()=>({single:async()=>({data:null,error:new Error('offline')})})})})};
let failedSave=false;try{await models.guardarModeloForca(failing,source,'Failed')}catch{failedSave=true;}check(failedSave,'Save error must not report success');
passed.push('persistent save/reload contract and expired-session/save-failure handling');
return passed;
}
const passed = await verify();
for (const name of passed) console.log('PASS',name);
