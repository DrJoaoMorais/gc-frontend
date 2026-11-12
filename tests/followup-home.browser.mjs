import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';import {readFile,mkdir} from 'node:fs/promises';import {resolve,extname} from 'node:path';import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require('/Users/joaomorais/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=fileURLToPath(new URL('..',import.meta.url)),browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1360,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('http://followup.test/**',async route=>{const path=new URL(route.request().url()).pathname;if(path==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="pt"><head></head><body style="background:#eff4f9;font-family:Arial;padding:24px"></body></html>'});try{await route.fulfill({contentType:extname(path)==='.css'?'text/css':'text/javascript',body:await readFile(resolve(root,'.'+path),'utf8')})}catch{await route.fulfill({status:404,body:''})}});await page.goto('http://followup.test/');
await page.evaluate(async()=>{
 const {G}=await import('/modules/state.js');window.G=G;G.sessionUser={id:'32a24abe-cd69-42d9-bf3a-3355f4f6e28c'};window.calls=[];window.writes=[];window.fail=false;window.delay=0;
 const patient=(id,name)=>({patient_id:id,clinic_id:'c1',patients:{full_name:name}}),future=new Date(Date.now()+3*86400000).toISOString().slice(0,10);
 window.tables={wo_prescriptions:[{...patient('l','Luís Portela'),id:'rx1',status:'active',created_at:'2026-09-15',expires_at:'2030-01-01',data:{sessions:[{session_id:'1',date:future}]}},{...patient('t','Tomás Morais'),id:'rx2',status:'active',created_at:'2026-09-15',expires_at:'2030-01-01',data:{sessions:[{session_id:'2',date:future}]}},{...patient('t','Tomás Morais'),id:'rx3',status:'active',created_at:'2026-08-15',expires_at:'2026-08-20',data:{sessions:[]}}],intake_tokens:[{...patient('m','Manuel Trindade'),id:'q1',questionnaire_type:'pre_consulta_v2',status:'pending_rgpd',created_at:'2026-08-23',expires_at:'2026-09-06'},{...patient('t','Tomás Morais'),id:'q2',questionnaire_type:'pre_consulta_v2',status:'pending_rgpd',created_at:'2026-09-15',expires_at:'2030-01-01'}],wo_followup_events:[],wo_followup_episode_events:[],wo_session_logs:[{id:'log',prescription_id:'rx1',clinic_id:'c1',session_id:'s0',logged_at:'2026-09-12',rpe:9,note:'Nota de teste'}],wo_session_readiness:[],patient_diary_entries:[],alerts:[]};
 window.sb={async rpc(name,p){if(name==='record_followup_task_decision'){if(window.fail)return {error:{message:'Falha'},data:null};const row={id:'review-'+writes.length,patient_id:p.p_patient_id,clinic_id:p.p_clinic_id,episode_id:p.p_episode_id,kind:'review',decision:p.p_decision,reason:p.p_reason,source_key:p.p_source_key,source_version:p.p_source_version,created_at:new Date().toISOString()};writes.push(row);tables.wo_followup_events.push(row);return {data:row.id,error:null}}if(window.fail)return {data:null,error:{message:'Falha simulada'}};const previous=tables.wo_followup_episode_events.filter(e=>e.episode_id===p.p_episode_id).at(-1);const isStart=p.p_action==='start';const row={id:'episode-event-'+writes.length,episode_id:isStart?'episode-'+writes.length:previous?.episode_id||'episode-'+writes.length,patient_id:p.p_patient_id,clinic_id:p.p_clinic_id,state:isStart?'active':p.p_action,interruption_kind:p.p_interruption_kind,is_test:p.p_is_test,reason:p.p_reason,started_at:isStart?new Date().toISOString():previous?.started_at||null,closed_at:isStart?null:previous?.closed_at||new Date().toISOString(),prescription_ids:isStart?[]:tables.wo_prescriptions.filter(r=>r.patient_id===p.p_patient_id&&r.clinic_id===p.p_clinic_id).map(r=>r.id),questionnaire_ids:isStart?[]:tables.intake_tokens.filter(r=>r.patient_id===p.p_patient_id&&r.clinic_id===p.p_clinic_id).map(r=>r.id),created_at:new Date().toISOString()};writes.push({...row,rpc:name});tables.wo_followup_episode_events.push(row);return {data:row.id,error:null}},from(table){let conditions=[],range=null,payload=null;const q={select(){return q},in(k,vs){conditions.push(r=>vs.includes(r[k]));return q},like(k,v){conditions.push(r=>String(r[k]).startsWith(v.replace('%','')));return q},order(){return q},range(a,b){range=[a,b];return q},insert(v){payload=v;return q},single(){return q},async then(ok,no){calls.push(table);const d=window.delay;if(d)await new Promise(r=>setTimeout(r,d));if(window.fail)return ok({data:null,error:{message:'Falha simulada'}});if(payload){const row={...payload,id:'e'+writes.length,created_at:new Date().toISOString()};writes.push(row);tables[table].push(row);return ok({data:{id:row.id},error:null})}let rows=(tables[table]||[]).filter(r=>conditions.every(c=>c(r)));if(range)rows=rows.slice(range[0],range[1]+1);return ok({data:rows,error:null})}};return q}};
 const ui=await import('/modules/home-dashboard.js');document.body.innerHTML='<style>'+ui.homeDashboardStyles()+'</style>'+ui.homeDashboardHtml();window.m=await import('/modules/exercicio/followup-home.js');window.options={clinics:[{id:'c1',name:'Clínica A'},{id:'c2',name:'Clínica B'}],clinicIds:['c1'],onOpen:item=>window.opened=item};await m.loadExerciseHome(options);
});
await mkdir(root+'/validation',{recursive:true});
assert.equal(await page.locator('[data-clinical-view]').count(),5);
assert.equal(await page.locator('[data-list] .gc-fh-row, [data-list] .gc-cc-row').count(),3);
assert.equal(await page.evaluate(()=>writes.length),0);
await page.locator('[data-clinical-profile="l:c1:legacy"]').first().click();
await page.locator('[data-clinical-tab=plan]').click();
await page.locator('[data-open="l:c1:legacy"]').click();
assert.deepEqual(await page.evaluate(()=>opened),{patientId:'l',clinicId:'c1'});
assert.equal(await page.evaluate(()=>writes.length),0);
// A draft cannot be lost through a list filter or global navigation.
await page.locator('.gc-cc-more').evaluate(el=>el.open=true);await page.locator('[data-clinical-view=tasks]').click();
await page.locator('[data-review="l:c1:legacy"]').first().click();
assert.match(await page.locator('[data-source]').innerText(),/Nota de teste/);
await page.locator('[name=decision]').selectOption('contact');
await page.locator('[name=reason]').fill('Confirmar contacto.');
page.once('dialog',d=>d.dismiss());await page.locator('[data-clinical-clinic]').selectOption('c1');
assert.equal(await page.locator('[data-clinical-clinic]').inputValue(),'');
assert.equal(await page.locator('[name=reason]').inputValue(),'Confirmar contacto.');
page.once('dialog',d=>d.dismiss());assert.equal(await page.evaluate(async()=>{const m=await import('/modules/mobile.js');return m.canLeaveClinicalPanel()}),false);
await page.locator('form [type=submit]').click();await page.waitForFunction(()=>writes.length===1);
await page.waitForSelector('[data-review="l:c1:legacy"]');
assert.match(await page.locator('[data-list]').innerText(),/Contacto por realizar/);
await page.locator('[data-review="l:c1:legacy"]').first().click();
await page.locator('[name=decision]').selectOption('defer');
const due=new Date(Date.now()+5*86400000).toISOString().slice(0,10);
await page.locator('[name=review_date]').fill(due);await page.locator('[name=reason]').fill('Rever após contacto.');
await page.locator('form [type=submit]').click();await page.waitForFunction(()=>writes.length===2);await page.waitForSelector('[data-list] .gc-fh-row, [data-list] .gc-cc-row');
assert.match(await page.locator('[data-list]').innerText(),/Rever em/);assert.match(await page.evaluate(()=>writes[1].reason),new RegExp(due));
// Episode decisions preserve every original prescription and response.
const sources=await page.evaluate(()=>JSON.stringify([tables.wo_prescriptions,tables.intake_tokens,tables.wo_session_logs]));
await page.locator('[data-clinical-view=patients]').click();await page.locator('[data-clinical-profile="l:c1:legacy"]').first().click();
await page.locator('[data-manage="l:c1:legacy"]').click();await page.locator('[data-episode-action=completed]').click();await page.locator('[name=reason]').fill('Conclusão clínica confirmada.');
await page.locator('form [type=submit]').click();await page.waitForFunction(()=>writes.length===3);await page.waitForSelector('[data-list] .gc-fh-row, [data-list] .gc-cc-row');
assert.equal(await page.evaluate(()=>JSON.stringify([tables.wo_prescriptions,tables.intake_tokens,tables.wo_session_logs])),sources);
await page.locator('[data-clinical-episode]').selectOption('all');await page.locator('.gc-cc-more').evaluate(el=>el.open=true);await page.locator('[data-clinical-view=tasks]').click();
assert.match(await page.locator('[data-list]').innerText(),/Origem histórica/);
// Same patient in two clinics, plus a diary-only patient and measured sessions.
await page.evaluate(async()=>{
 const today=new Date().toISOString().slice(0,10),day=new Date(Date.now()-86400000).toISOString().slice(0,10);
 tables.wo_prescriptions.push({...tables.wo_prescriptions[1],id:'rx-b',clinic_id:'c2',patients:{full_name:'Tomás Morais'},data:{sessions:[{session_id:'b-session',date:day}]}});
 tables.wo_session_logs.push({id:'b-log',clinic_id:'c2',prescription_id:'rx-b',session_id:'b-session',logged_at:today,rpe:6,feel:4,note:'Nota exclusiva da clínica B'});
 tables.patient_diary_tokens=[{id:'diary-only',patient_id:'d',clinic_id:'c1',created_at:today,status:'active',patients:{full_name:'Doente só com diário'}}];
 tables.patient_diary_entries=[{id:'entry',patient_id:'d',clinic_id:'c1',entered_at:today,raw_text:'Nota original do diário'}];
 options.clinicIds=['c1','c2'];await m.loadExerciseHome(options);
});
await page.locator('[data-clinical-view=patients]').click();await page.locator('[data-clinical-episode]').selectOption('active');
assert.match(await page.locator('[data-list]').innerText(),/Doente só com diário/);
await page.locator('[data-clinical-profile="t:c1:legacy"]').first().click();await page.locator('[data-clinical-context]').selectOption('t:c2:legacy');await page.locator('[data-clinical-tab=evolution]').click();
assert.match(await page.locator('[data-clinical-profile-body]').innerText(),/Nota exclusiva da clínica B/);
await page.locator('.gc-cc-more').evaluate(el=>el.open=true);await page.locator('[data-clinical-view=evolution]').click();assert.equal(await page.locator('[data-list] table').count()>0,true);await page.locator('[data-clinical-view=patients]').click();
await page.locator('[data-clinical-clinic]').selectOption('c1');assert.equal(await page.locator('[data-editor]').innerText(),'');
await page.locator('[data-clinical-profile="t:c1:legacy"]').first().click();await page.locator('[data-clinical-tab=evolution]').click();
assert.doesNotMatch(await page.locator('[data-clinical-profile-body]').innerText(),/Nota exclusiva/);
assert.equal(await page.locator('[data-clinical-context] option').count(),1);
await page.locator('[data-clinical-profile="d:c1:legacy"]').first().click();await page.locator('[data-clinical-tab=sources]').click();assert.match(await page.locator('[data-editor]').innerText(),/Nota original do diário/);
await page.evaluate(async()=>{const shell=await import('/modules/shell.js');G.currentView='exercicio-clinico';G.clinics=options.clinics;G.role='super_admin';document.body.removeAttribute('style');shell.renderAppShell();await m.loadExerciseHome(options)});
assert.equal(await page.locator('[data-nav=exercicio-clinico]').count(),2);
assert.equal(await page.locator('[data-clinical-view]').count(),5);
await page.screenshot({path:root+'/validation/acompanhamento-clinico-desktop.png'});
await page.setViewportSize({width:375,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
await page.evaluate(()=>document.querySelector('.gc-content').scrollTop=0);await page.screenshot({path:root+'/validation/acompanhamento-clinico-mobile.png'});
await page.setViewportSize({width:320,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
// Pagination and search remain bounded with a larger population.
await page.evaluate(async()=>{window.savedTables=structuredClone(tables);for(let i=0;i<1000;i++)tables.patient_diary_tokens.push({id:'volume-'+i,patient_id:'volume-'+i,clinic_id:'c1',created_at:'2026-11-01',status:'active',patients:{full_name:'Volume '+String(i).padStart(4,'0')}});await m.loadExerciseHome(options)});
await page.locator('[data-clinical-view=patients]').click();await page.locator('[data-clinical-search]').fill('Volume');assert.equal(await page.locator('[data-list] .gc-fh-row, [data-list] .gc-cc-row').count(),10);assert.match(await page.locator('[data-pages]').innerText(),/1000 doentes · 1 \/ 100/);await page.locator('[data-clinical-next]').click();assert.match(await page.locator('[data-list]').innerText(),/Volume 0010/);
await page.evaluate(()=>tables=window.savedTables);await page.locator('[data-clinical-search]').fill('');
// Failures are explicit, not interpreted as an empty list; retry recovers.
await page.evaluate(async()=>{window.fail=true;await m.loadExerciseHome(options)});assert.match(await page.locator('#gcExerciseHome').innerText(),/Não foi possível carregar/);
await page.evaluate(()=>window.fail=false);await page.locator('[data-retry]').click();await page.waitForSelector('[data-clinical-view]');
// Summary and access restriction use the same authenticated scope.
await page.evaluate(async()=>{options.summary=true;options.onNavigate=()=>window.navigated=true;await m.loadExerciseHome(options)});
assert.equal(await page.locator('[data-clinical-view]').count(),0);await page.locator('[data-clinical-navigate]').click();assert.equal(await page.evaluate(()=>navigated),true);
await page.evaluate(async()=>{G.sessionUser={id:'other'};await m.loadExerciseHome(options)});assert.equal(await page.locator('#gcExerciseHome').isVisible(),false);
await page.evaluate(async()=>{const shell=await import('/modules/shell.js');G.currentView='exercicio-clinico';shell.renderAppShell()});assert.equal(await page.evaluate(()=>G.currentView),'agenda');assert.equal(await page.locator('[data-nav=exercicio-clinico]').count(),0);
assert.deepEqual(errors,[]);console.log('Acompanhamento Clínico: percursos, fontes, decisões, adiamento, clínicas, diários, erros, resumo e móvel verificados.');
await browser.close();
