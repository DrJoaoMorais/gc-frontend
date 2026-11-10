import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.window={};
const {observationSummary,interventionSignals,reviewDate}=await import('../modules/exercicio/clinical-workspace.js');
const {buildFollowup}=await import('../modules/exercicio/followup-model.js');
const now=new Date('2026-11-10T12:00:00Z');
test('Sessões removidas, futuras e de hoje sem registo não contam como falta de registo passado',()=>{
 const c={clinicId:'a',rx:[{id:'rx',data:{sessions:[{session_id:'past',date:'2026-11-08'},{session_id:'done',date:'2026-11-08'},{session_id:'today',date:'2026-11-10'},{session_id:'future',date:'2026-11-12'},{session_id:'removed',date:'2026-11-07'},{session_id:'started',date:'2026-11-08'}]}}]};
 const data={logs:[{prescription_id:'rx',clinic_id:'a',session_id:'done',logged_at:'2026-11-08',rpe:6,feel:4},{prescription_id:'rx',clinic_id:'b',session_id:'past',logged_at:'2026-11-08',rpe:9}],snapshots:[{prescription_id:'rx',clinic_id:'a',session_id:'removed',session_date:'2026-11-07',removed_at:'2026-11-06'}],readiness:[{prescription_id:'rx',clinic_id:'a',session_id:'started',answered_at:'2026-11-08',feeling:3}]};
 const s=observationSummary(c,data,14,now);assert.equal(s.recorded,1);assert.equal(s.unreported,1);assert.equal(s.started,1);assert.equal(s.removed,1);assert.equal(s.observations.length,2);
});
test('Snapshot de sessão removida com registo final mantém execução; duas sessões no mesmo dia contam separadamente',()=>{
 const c={clinicId:'a',rx:[{id:'rx',data:{sessions:[{session_id:'one',date:'2026-11-08'},{session_id:'two',date:'2026-11-08'}]}}]};
 const logs=['one','two'].map(session_id=>({prescription_id:'rx',clinic_id:'a',session_id,logged_at:'2026-11-08',rpe:5,feel:4}));
 const s=observationSummary(c,{logs,snapshots:[{prescription_id:'rx',session_id:'one',session_date:'2026-11-08',removed_at:'2026-11-09',frozen_at:'2026-11-08'}]},14,now);assert.equal(s.recorded,2);assert.equal(s.removed,0);
});
test('Observações fora do período e sem data de sessão não inventam medições no período',()=>{
 const c={clinicId:'a',rx:[{id:'rx',data:{sessions:[{session_id:'old',date:'2026-10-20'}]}}]},logs=[{prescription_id:'rx',session_id:'old',logged_at:'2026-11-08',feel:3},{prescription_id:'rx',session_id:'undated',logged_at:'2026-11-09',feel:4}];
 assert.equal(observationSummary(c,{logs},14,now).observations.length,0);assert.equal(observationSummary(c,{logs},30,now).observations.length,1);
});
test('Contacto explícito em episódio concluído permanece na fila; histórico não decidido não é inflacionado',()=>{
 const c={episodeState:'completed',episode:{is_test:false},signals:[{key:'a',version:'1',kind:'clinical',pendingDecision:'contact'},{key:'b',version:'1',kind:'clinical'}]};
 assert.equal(interventionSignals(c).length,1);assert.equal(interventionSignals(c)[0].historical,true);
 assert.equal(interventionSignals({...c,episode:{is_test:true}}).length,0);
});
test('Diário pode originar contexto sem prescrição; nenhuma classificação é gravada',()=>{
 const seed=[{patient_id:'p',clinic_id:'a',patients:{full_name:'Exemplo'}}],diary=[{id:'d',patient_id:'p',clinic_id:'a',entered_at:'2026-11-09',raw_text:'Nota'}];const original=JSON.stringify({seed,diary});
 const rows=buildFollowup({seed,diary},now);assert.equal(rows.length,1);assert.equal(rows[0].contexts[0].episode.started_at,null);assert(rows[0].contexts[0].signals.some(s=>s.key==='diary:d'));assert.equal(rows[0].contexts[0].signals.length,1);assert.equal(JSON.stringify({seed,diary}),original);
});
test('Data de adiamento é recuperada da linha explícita sem interpretar a prosa clínica',()=>{
 assert.equal(reviewDate('Rever em: 2026-11-17\nConfirmar contacto.'),'2026-11-17');assert.equal(reviewDate('Considerar rever em novembro.'),null);
});
