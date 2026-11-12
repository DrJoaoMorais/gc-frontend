import test from 'node:test';
import assert from 'node:assert/strict';
import {consecutiveSignals,enrichClinicalContexts,clinicalItems} from '../modules/exercicio/clinical-context.js';
import {buildFollowup} from '../modules/exercicio/followup-model.js';
const now=new Date('2026-11-12T12:00:00Z');
const rx={id:'rx',patient_id:'p',clinic_id:'a',status:'active',created_at:'2026-11-01',expires_at:'2027-01-01',data:{endDate:'2026-11-18',dataRevisao:'2026-11-12',sessions:[{session_id:'one',date:'2026-11-10',notes:'Origem: Capsulite — Fase 1.'},{session_id:'two',date:'2026-11-11'},{session_id:'three',date:'2026-11-12'}]}};
const context=()=>({patientId:'p',clinicId:'a',rx:[structuredClone(rx)],qs:[],episodeState:'active',episode:{is_test:false},signals:[]});
const readiness=(id,date,feeling=2,clinic_id='a')=>({id,prescription_id:'rx',patient_id:'p',clinic_id,session_id:id,session_date:date,answered_at:date+'T08:00:00Z',feeling,has_symptoms:true});
test('Duas sessões no mesmo dia não criam dois dias consecutivos; lacunas interrompem a sequência',()=>{
 const c=context();assert.equal(consecutiveSignals(c,{readiness:[readiness('x','2026-11-10'),readiness('y','2026-11-10')]},now).length,0);
 assert.equal(consecutiveSignals(c,{readiness:[readiness('x','2026-11-10'),readiness('y','2026-11-12')]},now).length,0);
});
test('A sequência é por clínica e escala; não transforma bem-estar em dor',()=>{
 const c=context(),rs=[readiness('x','2026-11-11'),readiness('y','2026-11-12')];
 const signals=consecutiveSignals(c,{readiness:rs},now);assert.equal(signals.length,2);assert(signals.every(s=>s.label.includes('2 dias consecutivos')));assert(!signals.some(s=>s.label.includes('Dor')));
 assert.equal(consecutiveSignals(c,{readiness:[rs[0],{...rs[1],clinic_id:'b'}]},now).length,0);
 assert.equal(consecutiveSignals(c,{readiness:[rs[0]],logs:[{prescription_id:'rx',clinic_id:'a',session_id:'three',logged_at:'2026-11-12',feel:1}]},now).length,0);
});
test('Snapshot conserva o dia do treino após alteração do calendário; envio tardio não muda o dia',()=>{
 const c=context();c.rx[0].data.sessions=[];
 const data={logs:[{id:'l1',prescription_id:'rx',clinic_id:'a',session_id:'one',logged_at:'2026-11-12',feel:1},{id:'l2',prescription_id:'rx',clinic_id:'a',session_id:'two',logged_at:'2026-11-12',feel:2}],snapshots:[{prescription_id:'rx',clinic_id:'a',session_id:'one',session_date:'2026-11-10'},{prescription_id:'rx',clinic_id:'a',session_id:'two',session_date:'2026-11-11'}]};
 assert.equal(consecutiveSignals(c,data,now).length,1);assert.match(consecutiveSignals(c,data,now)[0].source.note,/2026-11-10/);
 assert.equal(consecutiveSignals(c,{logs:data.logs},now).length,0);
});
test('Fim do plano, última sessão e validade de acesso mantêm datas diferentes; questionário conta como atividade',()=>{
 const rows=[{contexts:[context()]}];rows[0].contexts[0].qs=[{id:'q',status:'completed',completed_at:'2026-11-12T10:00:00Z'}];
 enrichClinicalContexts(rows,{},now);const c=rows[0].contexts[0];assert.equal(c.clinical.dates.find(d=>d.key==='end:rx').date,'2026-11-18');assert.equal(c.clinical.dates.find(d=>d.key==='activity').date,'2026-11-12');assert(!c.clinical.dates.some(d=>d.date==='2027-01-01'));assert.equal(c.clinical.latest.type,'Questionário concluído');assert.match(c.clinical.phaseStatus,/por confirmar/);
});
test('Medicação isolada pode alimentar contexto; exige correspondência da clínica com a ligação',()=>{
 const seeds=[{patient_id:'p',clinic_id:'a'}],portalLinks=[{id:'link',patient_id:'p',created_clinic_id:'a'}],medications=[{id:'med',link_id:'link',clinic_id:'a',enabled:true,nome:'Exemplo',data_fim:'2026-11-13'},{id:'other',link_id:'link',clinic_id:'b',enabled:true,nome:'Outra clínica',data_fim:'2026-11-13'}];
 const rows=enrichClinicalContexts(buildFollowup({seed:seeds},now),{portalLinks,medications},now);const c=rows[0].contexts[0];assert.deepEqual(c.clinical.components,['Medicação']);assert.equal(c.clinical.medications.length,1);assert(clinicalItems(c,[]).some(i=>i.label==='Fim da medicação'));
});
test('Rever um prazo resolve só a versão dessa fonte; nova data volta a pedir revisão',()=>{
 const rows=[{contexts:[context()]}];enrichClinicalContexts(rows,{},now);const s=rows[0].contexts[0].signals.find(s=>s.key==='deadline:review:rx');
 const events=[{id:'decision',patient_id:'p',clinic_id:'a',kind:'review',decision:'closed',source_key:s.key,source_version:s.version,created_at:'2026-11-12'}];
 const next=[{contexts:[context()]}];enrichClinicalContexts(next,{events},now);assert(!next[0].contexts[0].signals.some(x=>x.key===s.key));assert(!clinicalItems(next[0].contexts[0],[]).some(x=>x.key==='review:rx'));
 const changed=[{contexts:[context()]}];changed[0].contexts[0].rx[0].data.dataRevisao='2026-11-13';enrichClinicalContexts(changed,{events},now);assert(changed[0].contexts[0].signals.some(x=>x.key===s.key));
});
test('Retoma sem plano não recupera medicação como pertencente ao episódio encerrado',()=>{
 const c=context();c.episodeState='completed';const rows=[{contexts:[c]}];enrichClinicalContexts(rows,{portalLinks:[{id:'link',patient_id:'p',created_clinic_id:'a'}],medications:[{id:'m',link_id:'link',clinic_id:'a',enabled:true,data_fim:'2026-11-13'}]},now);assert.equal(c.clinical.medications.length,0);assert.equal(c.clinical.dates.length,0);
});
