import test from 'node:test';
import assert from 'node:assert/strict';
import {buildFollowup} from '../modules/exercicio/followup-model.js';
import {selectFollowupRows} from '../modules/exercicio/followup-episodes.js';
const now=new Date('2026-10-09T12:00:00Z');
const rx={id:'rx-old',patient_id:'p',clinic_id:'c',patients:{full_name:'Luís Portela'},created_at:'2026-09-01',status:'active',expires_at:'2030-01-01',data:{sessions:[{session_id:'s',date:'2026-10-20'}]}};
const old={id:'close',episode_id:'old',patient_id:'p',clinic_id:'c',state:'interrupted',interruption_kind:'abandonment',reason:'Abandono confirmado',started_at:null,closed_at:'2026-10-02T12:00:00Z',prescription_ids:['rx-old'],questionnaire_ids:[],created_at:'2026-10-02T12:00:00Z'};
const fresh={id:'start',episode_id:'new',patient_id:'p',clinic_id:'c',state:'active',reason:'Retoma',started_at:'2026-10-08T12:00:00Z',closed_at:null,prescription_ids:[],questionnaire_ids:[],created_at:'2026-10-08T12:00:00Z'};
const log={id:'log',prescription_id:'rx-old',session_id:'s',logged_at:'2026-10-01T12:00:00Z',note:'Nota anterior',rpe:9};
test('Retoma cria contexto próprio; plano e alerta antigos permanecem só no histórico',()=>{
 const rows=buildFollowup({prescriptions:[rx],logs:[log],episodeEvents:[old,fresh]},now);
 assert.equal(rows.length,1);assert.equal(rows[0].contexts.length,2);
 const current=selectFollowupRows(rows,'current')[0].contexts[0],past=selectFollowupRows(rows,'interrupted')[0].contexts[0];
 assert.equal(current.rx.length,0);assert.equal(current.latestActivity,null);assert(!current.signals.some(s=>s.key.startsWith('log:')));
 assert.equal(past.rx.length,1);assert(past.signals.some(s=>s.key.startsWith('log:')));assert.equal(past.episode.interruption_kind,'abandonment');
});
test('Nova prescrição pertence ao novo episódio e não ao anterior',()=>{
 const recent={...rx,id:'rx-new',created_at:'2026-10-09T10:00:00Z'};
 const rows=buildFollowup({prescriptions:[rx,recent],episodeEvents:[old,fresh]},now);
 assert.deepEqual(selectFollowupRows(rows,'current')[0].contexts[0].rx.map(r=>r.id),['rx-new']);
 assert.deepEqual(selectFollowupRows(rows,'interrupted')[0].contexts[0].rx.map(r=>r.id),['rx-old']);
});
test('Respostas clínicas encerradas continuam na atenção; testes não entram',()=>{
 const testEpisode={...old,id:'test',episode_id:'test',patient_id:'test-p',state:'archived',is_test:true};
 const rows=buildFollowup({prescriptions:[rx],logs:[log],episodeEvents:[old,testEpisode]},now);
 assert.equal(selectFollowupRows(rows,'current').length,0);assert.equal(selectFollowupRows(rows,'attention').length,1);assert.equal(selectFollowupRows(rows,'archived').length,1);
});
test('Filtra por contexto: mesmo doente pode ter episódio concluído e um atual em outra clínica',()=>{
 const completed={...old,state:'completed'},other={...rx,id:'other',clinic_id:'c2'};
 const rows=buildFollowup({prescriptions:[rx,other],episodeEvents:[completed]},now);
 assert.equal(rows.length,1);assert.equal(selectFollowupRows(rows,'current')[0].contexts[0].clinicId,'c2');assert.equal(selectFollowupRows(rows,'completed')[0].contexts[0].clinicId,'c');
});
test('Arquivar acrescenta decisão ao mesmo episódio, preservando a retoma ativa',()=>{
 const archived={...old,id:'archive',state:'archived',created_at:'2026-10-09T10:00:00Z'};
 const rows=buildFollowup({prescriptions:[rx],episodeEvents:[old,fresh,archived]},now);
 assert.equal(rows[0].contexts.length,2);assert.equal(selectFollowupRows(rows,'archived').length,1);assert.equal(selectFollowupRows(rows,'current').length,1);
});
test('Fim de plano e ausência de atividade não concluem nem confirmam abandono',()=>{
 const rows=buildFollowup({prescriptions:[{...rx,expires_at:'2026-10-01'}]},now);
 assert.equal(selectFollowupRows(rows,'current').length,1);assert.equal(selectFollowupRows(rows,'completed').length,0);assert.equal(selectFollowupRows(rows,'interrupted').length,0);
});
test('A revisão anterior não oculta um sinal do novo episódio',()=>{
 const recent={...rx,id:'rx-new',created_at:'2026-10-09T10:00:00Z'},newLog={...log,id:'new-log',prescription_id:'rx-new',logged_at:'2026-10-09T11:00:00Z'};
 const rows=buildFollowup({prescriptions:[rx,recent],logs:[log,newLog],episodeEvents:[old,fresh],events:[{kind:'review',patient_id:'p',clinic_id:'c',created_at:'2026-10-01T13:00:00Z',source_key:'log:rx-new:s',source_version:JSON.stringify([newLog.logged_at,newLog.note,newLog.sets,newLog.rpe,newLog.feel])}]},now);
 assert(selectFollowupRows(rows,'attention')[0].contexts[0].signals.some(s=>s.key==='log:rx-new:s'));
});
test('Registo tardio de um plano antigo permanece no episódio antigo e não desaparece',()=>{
 const late={...log,id:'late',logged_at:'2026-10-09T11:00:00Z'};
 const rows=buildFollowup({prescriptions:[rx],logs:[late],episodeEvents:[old,fresh]},now);
 assert(selectFollowupRows(rows,'interrupted')[0].contexts[0].signals.some(s=>s.key.startsWith('log:')));
 assert(!selectFollowupRows(rows,'current')[0].contexts[0].signals.some(s=>s.key.startsWith('log:')));
});
test('Tratar uma pendência antiga depois da retoma regista a revisão no episódio antigo',()=>{
 const data={prescriptions:[rx],logs:[log],episodeEvents:[old,fresh]};
 const signal=selectFollowupRows(buildFollowup(data,now),'interrupted')[0].contexts[0].signals.find(s=>s.key.startsWith('log:'));
 data.events=[{id:'review',kind:'review',patient_id:'p',clinic_id:'c',episode_id:'old',source_key:signal.key,source_version:signal.version,created_at:'2026-10-09T11:00:00Z'}];
 assert(!selectFollowupRows(buildFollowup(data,now),'interrupted')[0].contexts[0].signals.some(s=>s.key===signal.key));
});

test('Contacto mantém pendência até confirmação; decisão fica no histórico',()=>{
 const data={prescriptions:[rx],logs:[log],episodeEvents:[old,fresh]};
 const signal=buildFollowup(data,now)[0].contexts.find(c=>c.episodeState==='interrupted').signals[0];
 const event={id:'contact',kind:'review',patient_id:'p',clinic_id:'c',episode_id:'old',source_key:signal.key,source_version:signal.version,decision:'contact',reason:'Telefonar',created_at:'2026-10-09T11:00:00Z'};
 data.events=[event];const pending=buildFollowup(data,now)[0].contexts.find(c=>c.episodeState==='interrupted').signals[0];assert.equal(pending.pendingDecision,'contact');assert.equal(pending.source.note,'Nota anterior');
 data.events.push({...event,id:'closed',decision:'closed',created_at:'2026-10-09T11:01:00Z'});assert.equal(buildFollowup(data,now)[0].contexts.find(c=>c.episodeState==='interrupted').signals.length,0);
});
test('Questionário dentro do prazo é espera, não tarefa; alerta e resposta têm um só lugar',()=>{
 const q={id:'q',patient_id:'p',clinic_id:'c',questionnaire_type:'pre_consulta_v2',status:'in_progress',created_at:'2026-10-01',expires_at:'2026-10-20'};
 assert.equal(selectFollowupRows(buildFollowup({questionnaires:[q]},now),'attention').length,0);
 const completed={...q,status:'completed',completed_at:'2026-10-08'};
 const c=buildFollowup({questionnaires:[completed],alerts:[{id:'a',patient_id:'p',clinic_id:'c',source:'questionnaire',metadata:{token_id:'q'},created_at:'2026-10-08'}]},now)[0].contexts[0];assert(!c.signals.some(s=>s.key==='alert:a'));assert(c.signals.some(s=>s.key==='response:q'));
});

test('Novo episódio sem plano mostra mensagens; preparação pendente não duplica',()=>{
 const data={episodeEvents:[fresh],diary:[{id:'d',patient_id:'p',clinic_id:'c',entered_at:'2026-10-09T10:00:00Z',raw_text:'Mensagem nova'}]};
 assert(buildFollowup(data,now)[0].signals.some(s=>s.key==='diary:d'));
 data.events=[{id:'prepare',kind:'review',patient_id:'p',clinic_id:'c',episode_id:'new',source_key:'episode:prepare',source_version:'new',decision:'prepare',created_at:'2026-10-09T10:01:00Z'}];
 assert.equal(buildFollowup(data,now)[0].signals.filter(s=>s.key==='episode:prepare').length,1);
 data.events.push({...data.events[0],id:'closed',decision:'closed',created_at:'2026-10-09T10:02:00Z'});
 assert(!buildFollowup(data,now)[0].signals.some(s=>s.key==='episode:prepare'));
});
