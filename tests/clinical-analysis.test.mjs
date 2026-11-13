import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.window={};
const {loadAnalysisData,analysisSessions,pairedSummary,comparableOutcomes,monday,shiftDay,validRange,exerciseHTML}=await import('../modules/exercicio/clinical-analysis.js');

test('Resumo pré/pós só compara respostas da mesma sessão; sem resposta não é zero',()=>{
 assert.deepEqual(pairedSummary([{readiness:{feeling:1},log:{feel:3}},{readiness:{feeling:5},log:null},{log:{feel:1}}]),{n:1,pre:1,post:3});
 assert.deepEqual(pairedSummary([]),{n:0,pre:null,post:null});
});
test('Dia histórico vem da cópia; associações divergentes e rascunhos ficam excluídos',()=>{
 const rx={id:'r',patient_id:'p',clinic_id:'c',status:'active',data:{sessions:[{session_id:'s',date:'2026-11-12'}]}};
 const base={prescription_id:'r',patient_id:'p',clinic_id:'c',session_id:'s'};
 const sessions=analysisSessions({rx:[rx,{...rx,id:'draft',status:'draft'}],snapshots:[{...base,session_date:'2026-11-01',snapshot:{items:[]}}],readiness:[],logs:[{...base,clinic_id:'other',logged_at:'2026-11-12',feel:1}]});
 assert.equal(sessions.length,1);assert.equal(sessions[0].date,'2026-11-01');assert.equal(sessions[0].log,null);
});
test('Leitura paginada e filhos limitados aos pais do doente e clínica; sem mutações',async()=>{
 const records={intake_tokens:[{id:'q',patient_id:'p',clinic_id:'c'},{id:'foreign',patient_id:'p',clinic_id:'other'}],intake_responses:Array.from({length:1002},(_,id)=>({id,token_id:'q'})).concat([{id:'secret',token_id:'foreign'}])};
 const sb={from(table){const filters=[];return {select(){return this},in(k,ids){filters.push(r=>ids.includes(r[k]));return this},order(){return this},async range(a,b){return {data:(records[table]||[]).filter(r=>filters.every(f=>f(r))).slice(a,b+1)}}};}};
 const data=await loadAnalysisData(sb,'p','c');assert.equal(data.responses.length,1002);assert.equal(data.questions.length,1);assert.deepEqual(data.failures,[]);
});

test('Resultados de versões ou lateralidades diferentes nunca são combinados',()=>{
 const base={id:'a',scale_type:'example',side:'left',config_version:'1',formula_version:'1',config_hash:'a',formula_hash:'x',patient_completed_at:'2026-10-01'};
 const data={therapist:[],scales:[base,{...base,id:'b',side:'right'},{...base,id:'c',formula_hash:'y'},{...base,id:'d',patient_completed_at:'2026-11-01'}],validations:['a','b','c','d'].map((request_id,i)=>({request_id,total_score:i+1,validated_at:'2026-11-01'}))};
 const groups=comparableOutcomes(data);assert.deepEqual(groups.map(g=>g.length),[2,1,1]);
});

test('Semanas atravessam ano e intervalos rejeitam datas invertidas ou inexistentes',()=>{
 assert.equal(monday('2027-01-01'),'2026-12-28');assert.equal(shiftDay('2026-12-28',7),'2027-01-04');
 assert.equal(validRange('2026-11-01','2026-11-13','2026-11-13'),true);
 for(const [a,b] of [['2026-11-13','2026-11-01'],['2026-02-31','2026-11-01'],['2026-11-01','2026-11-14']])assert.equal(validRange(a,b,'2026-11-13'),false);
});
test('Cartões mostram foto e dose histórica, sem despejar identificadores ou técnica',()=>{
 const html=exerciseHTML({prescribed:{items:[{exercise_id:'internal-id',name:'Teste',photo_url:'https://example.com/photo.jpg',duration_series:[{duration_sec:30},{duration_sec:30},{duration_sec:30}],tecnica_notas:'TECHNICAL-DUMP'}]},log:{sets:[]}});
 assert.match(html,/3 × 30 s/);assert.match(html,/<img/);assert.doesNotMatch(html,/internal-id|TECHNICAL-DUMP|Prescrição original/);
});
test('Avaliações usam exclusivamente as consultas autorizadas e o acesso existente',async()=>{
 const calls=[];const sb={from(table){assert.notEqual(table,'therapist_scale_requests');assert.notEqual(table,'clinical_scale_requests');const filters=[];return {select(){return this},in(k,ids){filters.push(r=>ids.includes(r[k]));return this},order(){return this},async range(){return {data:(table==='consultations'?[{id:'allowed',patient_id:'p',clinic_id:'c'},{id:'foreign',patient_id:'p',clinic_id:'other'}]:[]).filter(r=>filters.every(f=>f(r)))}}}},async rpc(name,args){calls.push([name,args]);return {data:[{id:'assessment',status:'completed'}]}}};
 const d=await loadAnalysisData(sb,'p','c');assert.equal(d.therapist.length,1);assert.deepEqual(calls,[['therapist_scale_list',{p_consultation:'allowed'}]]);assert.deepEqual(d.failures,[]);
});
