import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require('/Users/joaomorais/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];
const root=fileURLToPath(new URL('..',import.meta.url));
page.on('pageerror',e=>errors.push(e.message));
await mkdir(root+'/validation',{recursive:true});
await page.route('http://clinical.test/**',async route=>{
 const path=new URL(route.request().url()).pathname;
 const file=path==='/'?resolve(root,'tests/fixtures/clinical-compact.html'):resolve(root,'.'+path);
 try {await route.fulfill({contentType:path==='/'?'text/html':extname(path)==='.css'?'text/css':'text/javascript',body:await readFile(file,'utf8')});}
 catch {await route.fulfill({status:404,body:''});}
});
await page.route('https://exercise.test/**',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="90" height="90"><rect width="90" height="90" fill="#e8f1f8"/><circle cx="45" cy="20" r="8" fill="#537da3"/><path d="M45 30L45 53L25 75M45 53L65 75M25 42L65 42" stroke="#537da3" stroke-width="6" fill="none"/></svg>'}));
await page.goto('http://clinical.test/');await page.waitForSelector('.gc-cc-table');

await page.evaluate(async()=>{
 const base=previewTables.wo_session_readiness[0],rx=previewTables.wo_prescriptions[0];
 const day=n=>{const d=new Date();d.setDate(d.getDate()-n);return d.toLocaleDateString('en-CA');};
 rx.data.sessions=[];previewTables.wo_session_logs=[];previewTables.wo_session_readiness=[];
 for(let i=0;i<8;i++){
  const session_id='demo-'+i,date=day(i*3);rx.data.sessions.push({session_id,date,modality:'Força'});
  previewTables.wo_session_readiness.push({...base,id:'pre-'+i,session_id,session_date:date,answered_at:date+'T10:00:00Z',feeling:2+i%3,has_symptoms:i%3===0,symptom_note:i%3===0?'Sintoma fictício':'',prescription_id:rx.id});
  previewTables.wo_session_logs.push({...base,id:'post-'+i,session_id,prescription_id:rx.id,logged_at:date+'T11:00:00Z',feel:3+i%2,rpe:4+i%5,sets:[],note:'Registo de teste'});
 }
 const person={patient_id:base.patient_id,clinic_id:base.clinic_id};
 previewTables.wo_session_prescription_snapshots=[{...person,id:'snapshot-demo',prescription_id:rx.id,session_id:'demo-0',session_date:day(0),snapshot:{kind:'list',modality:'Força',items:Array.from({length:6},(_,i)=>({exercise_id:'ex-'+i,name:['Exercício de agachamento','Elevação da bacia','Passada atrás','Subida de degrau','Elevação dos braços','Prancha'][i],photo_url:'https://exercise.test/photo.svg',series:[{reps:12,load:5},{reps:12,load:5},{reps:12,load:5}],tecnica_notas:'DUMP-TECNICO'}))}}];
 previewTables.intake_tokens.push({...person,id:'qa',questionnaire_type:'pre_consulta_v2',status:'completed',created_at:day(20),completed_at:day(19)});
 previewTables.intake_responses=[{id:'answer1',token_id:'qa',question_id:'s1_6meses',answer:'Voltar a caminhar confortavelmente'},{id:'answer2',token_id:'qa',question_id:'s4_dor_lesao',answer:'Sim, ligeiramente'}];
 previewTables.patient_diary_entries.push({...person,id:'diary-a',entered_at:day(0)+'T14:00:00Z',raw_text:'Registo fictício <img src=x onerror=alert(1)>'});
 previewTables.patient_portal_links.push({id:'link-a',patient_id:base.patient_id,created_clinic_id:base.clinic_id});
 previewTables.patient_medication.push({id:'ma',link_id:'link-a',clinic_id:base.clinic_id,nome:'Medicação exemplo',dose:'Dose registada',enabled:true,data_inicio:day(10)});
 previewTables.patient_medication.push({id:'foreign',link_id:'link-a',clinic_id:'b',nome:'NUNCA MOSTRAR',enabled:true});
 await reloadPreview();
});
await page.locator('[data-analysis="ana:a:legacy"]').first().click();
await page.waitForSelector('.ca-stats');
assert.equal(await page.locator('.gc-cc').isVisible(),false);
assert.equal(await page.locator('dialog:modal').count(),0);
assert.equal(await page.locator('.ca-stat').count(),3);
assert.match(await page.locator('.ca-stats').innerText(),/8 sessões/);
await page.screenshot({path:root+'/validation/analise-clinica-desktop.png',fullPage:true});
await page.locator('[data-ca-metric=effort]').click();assert.match(await page.locator('svg').getAttribute('aria-label'),/Esforço/);await page.locator('[data-ca-metric=wellbeing]').click();
const latestDay=await page.evaluate(()=>new Date().toLocaleDateString('en-CA'));
await page.locator(`button[data-ca-day="${latestDay}"]`).click();
await page.locator('.ca-day-detail').getByText('Medicação neste dia',{exact:true}).click();
assert.match(await page.locator('.ca-day-detail').innerText(),/Medicação exemplo/);
assert.doesNotMatch(await page.locator('.gc-analysis').innerText(),/NUNCA MOSTRAR/);
assert.equal(await page.locator('.ca-patient-notes').isVisible(),true);
assert.match(await page.locator('.ca-patient-notes').innerText(),/Sintoma fictício|Registo de teste/);
assert.equal(await page.locator('.ca-exercise img').first().isVisible(),true);
assert.equal(await page.locator('.ca-exercise img').count(),6);assert.equal(await page.locator('.ca-patient-notes img').count(),0);
assert.doesNotMatch(await page.locator('.ca-day-detail').innerText(),/DUMP-TECNICO|Prescrição original/);
await page.screenshot({path:root+'/validation/analise-semanal-exercicios.png',fullPage:true});
assert.equal(await page.locator('button[data-ca-day]').count(),7);
const weekBefore=await page.locator('.ca-week b').innerText();await page.locator('[data-ca-week="-1"]').click();assert.notEqual(await page.locator('.ca-week b').innerText(),weekBefore);assert.equal(await page.locator('button[data-ca-day]').count(),7);await page.locator('[data-ca-week="1"]').click();
await page.locator('[data-ca-period=custom]').click();
await page.locator('[name=from]').fill(latestDay);await page.locator('[name=to]').fill(latestDay);await page.getByRole('button',{name:'Aplicar',exact:true}).click();
assert.match(await page.locator('.ca-stats').innerText(),/1 sessões datadas/);
await page.locator('[data-ca-period="30"]').click();
await page.locator('[data-ca-tab=questions]').click();
await page.getByText('Objetivos e Expectativas',{exact:true}).click();
assert.match(await page.locator('.gc-analysis').innerText(),/Voltar a caminhar confortavelmente/);
await page.locator('[data-ca-tab=exercise]').click();
assert.match(await page.locator('.gc-analysis').innerText(),/Objetivos e limitações referidos/);
await page.locator('[data-ca-tab=overview]').click();
for(const width of [1440,768,375,320]){
 await page.setViewportSize({width,height:1000});
 await page.locator(`button[data-ca-day="${latestDay}"]`).click();
 assert.equal(await page.locator('.ca-patient-notes').isVisible(),true);
 assert.match(await page.locator('.ca-patient-notes').innerText(),/Registo de teste/);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'overflow '+width);
 assert.equal(await page.locator('.gc-analysis').count(),1);
 if(width===375)await page.screenshot({path:root+'/validation/analise-clinica-mobile.png',fullPage:false});
}
// Failed source must not masquerade as a normal zero or complete analysis.
await page.evaluate(()=>{const from=sb.from;sb.from=t=>t==='wo_session_logs'?{select(){return this},in(){return this},order(){return this},range(){return Promise.resolve({error:{message:'test'}})}}:from(t);});
await page.locator('[data-ca-back]').click();
assert.equal(await page.locator('.gc-cc').isVisible(),true);
await page.locator('[data-analysis="ana:a:legacy"]').first().click();
await page.waitForSelector('.ca-warning');
assert.match(await page.locator('.ca-warning').innerText(),/Análise incompleta/);
assert.match(await page.locator('.ca-stats').innerText(),/Fonte incompleta/);
assert.deepEqual(errors,[]);
await browser.close();
console.log('Análise: página completa, diário escapado, questionários reais, isolamento por clínica, falha visível e 1440/768/375/320 verificados.');
