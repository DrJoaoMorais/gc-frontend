import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH || '/Users/joaomorais/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(new URL('..',import.meta.url).pathname);
const fixture='<!doctype html><html lang="pt-PT"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/modules/agenda-visual.css"><body><script type="module">import {G} from "/modules/state.js";import {renderAppShell} from "/modules/shell.js";G.role="medico";G.clinics=[{id:"clinic-test",name:"Clínica de teste"}];G.clinicsById={"clinic-test":G.clinics[0]};G.activeClinicId="clinic-test";window.__gc_renderCurrentView=async()=>renderAppShell();renderAppShell();window.ready=true;</script></body></html>';
const server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname;let content;if(pathname==='/fixture')content=fixture;else content=await readFile(path.join(root,pathname));res.setHeader('Content-Type',/\.m?js$/.test(pathname)?'text/javascript':pathname.endsWith('.css')?'text/css':'text/html');res.end(content);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
let queries=[];let errors=[];
await context.route('**/*',async route=>{const url=route.request().url();if(url.startsWith(base))return route.continue();if(url.includes('/quill@2.0.3/dist/quill.js'))return route.fulfill({path:'/tmp/gc-iphone-quill.js',contentType:'text/javascript'});if(url.includes('/quill@2.0.3/dist/quill.snow.css'))return route.fulfill({path:'/tmp/gc-iphone-quill.css',contentType:'text/css'});return route.abort();});
await context.addInitScript(()=>{
 window.writes=[];window.testShares=[];
 const makePdf=()=>{let text='%PDF-1.4\n';const offsets=[0];const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>','<< /Length 46 >>\nstream\nBT /F1 16 Tf 30 350 Td (PDF de teste GC) Tj ET\nendstream','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];objects.forEach((o,i)=>{offsets.push(text.length);text+=(i+1)+' 0 obj\n'+o+'\nendobj\n';});const xref=text.length;text+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF';return new Blob([text],{type:'application/pdf'});};
 const patient={id:'patient-test',full_name:'Maria Exemplo',dob:'1968-03-14',phone:'910000000',alertas:{pacemaker:true},antecedentes_pessoais:'Antecedentes de teste'};
 function query(table){let single=false,operation='select',payload,selection='';const q=new Proxy({}, {get(_,prop){if(prop==='then')return (resolve)=>{let data=[];if(operation!=='select'){window.writes.push({table,operation,payload});data={id:'draft-test'};}else if(table==='patients')data=single?patient:[patient];else if(table==='clinic_members')data=[{role:'medico',clinic_id:'clinic-test',is_active:true}];else if(table==='patient_clinic')data=single?{clinic_id:'clinic-test',clinics:{display_name:'Clínica de teste'}}:[];else if(table==='clinics')data=[{id:'clinic-test',name:'Clínica de teste'}];else if(table==='documents')data=[{id:'00000000-0000-0000-0000-000000000123',consultation_id:null,title:'Relatório fictício',category:'relatorio',storage_path:'test/document.pdf',created_at:'2026-10-24'}];else if(table==='consultations')data=single?null:[];else if(single)data=null;return Promise.resolve({data,error:null}).then(resolve);};return (...args)=>{if(prop==='single'||prop==='maybeSingle')single=true;if(prop==='select')selection=args[0];if(['insert','update'].includes(prop)){operation=prop;payload=args[0];}return q;};}});return q;}
 const sb={from:query,rpc:async(name,args)=>{window.writes.push({rpc:name,args});return {data:name.includes('duplicate')?[]:name==='search_patients_v2'?[patient]:{patient_id:'patient-created',action:'created'},error:null};},auth:{getUser:async()=>({data:{user:{id:'user-test'}},error:null}),getSession:async()=>({data:{session:{user:{id:'user-test'},access_token:'fake-test-token'}},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},storage:{from:()=>({download:async()=>({data:makePdf(),error:null})})}};
 window.sb=sb;window.supabase={createClient:()=>sb};
 Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});
 Object.defineProperty(navigator,'share',{configurable:true,value:async x=>{window.testShares.push({names:x.files.map(f=>f.name),types:x.files.map(f=>f.type)});}});
});
const page=await context.newPage();page.setDefaultTimeout(12000);page.on('console',m=>{if(m.type()==='error')console.error('CONSOLE:',m.text())});page.on('response',r=>{if(r.status()>=400)console.error(r.status(),r.url())});page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE:',e.message)});
try{
console.log('Testing shell');await page.goto(base+'/fixture');await page.waitForFunction(()=>window.ready);
await page.evaluate(async()=>{const {renderAgendaList}=await import('/modules/agenda.js');const {G}=await import('/modules/state.js');G.patientsById={'patient-test':{id:'patient-test',full_name:'Maria Exemplo Nome Comprido'}};G.agenda.rows=[{id:'a-test',patient_id:'patient-test',clinic_id:'clinic-test',start_at:'2026-10-24T09:00:00',end_at:'2026-10-24T09:30:00',status:'scheduled',notes:'Nota de teste'}];renderAgendaList();});
assert.equal(await page.locator('[data-patient-open]').first().textContent(),'Maria Exemplo Nome Comprido');
for(const width of [320,375,390,430,767]){await page.setViewportSize({width,height:844});await page.waitForTimeout(60);const overflow=await page.evaluate(()=>[document.documentElement.scrollWidth,document.querySelector('.gc-content').scrollWidth,document.querySelector('.gc-content').clientWidth]);assert.ok(overflow[0]<=width,`page overflow at ${width}: ${overflow}`);assert.ok(overflow[1]<=overflow[2]+1,`agenda overflow at ${width}: ${overflow}`);}
await page.setViewportSize({width:844,height:390});assert.equal(await page.locator('.gc-mobile-nav').isVisible(),true);
await page.setViewportSize({width:390,height:844});
await page.screenshot({path:root+'/tests/artifacts/iphone-agenda.png',fullPage:true});
await page.getByRole('button',{name:'Mais',exact:true}).click();assert.ok(await page.locator('#gcMobileMore').evaluate(d=>d.open));assert.equal(await page.locator('#gcMobileMore [data-nav=management]').count(),0);await page.getByRole('button',{name:'Fechar opções'}).click();
await page.locator('.gc-mobile-nav [data-nav=doentes]').click();assert.ok(await page.locator('#selClinic').count());
await page.evaluate(async()=>{const {openNewPatientMainModal}=await import('/modules/novo-doente.js');openNewPatientMainModal({clinicId:'clinic-test'});});
await page.locator('#npFullName').fill('Doente fictício');assert.equal(await page.locator('#npCreate').isEnabled(),true);
for(const width of [320,390]){await page.setViewportSize({width,height:844});assert.ok(await page.locator('#npMainOverlay').evaluate(e=>e.scrollWidth<=e.clientWidth));}
await page.screenshot({path:root+'/tests/artifacts/iphone-novo-doente.png',fullPage:true});
await page.evaluate(()=>{window.__gc_openFeedPanel=(patientId,clinicId)=>{window.createdProcess={patientId,clinicId};};});
await page.locator('#npCreate').click();await page.waitForFunction(()=>window.createdProcess?.patientId==='patient-created');
assert.equal(await page.evaluate(()=>window.createdProcess.clinicId),'clinic-test');
assert.ok(await page.evaluate(()=>window.writes.some(w=>w.rpc==='create_patient_for_clinic_v2'&&w.args.p_clinic_id==='clinic-test')));
await page.evaluate(async()=>{const {wireQuickPatientSearch}=await import('/modules/pesquisa.js');const select=document.getElementById('selClinic');select.innerHTML='<option value="clinic-test">Teste</option>';await wireQuickPatientSearch();});
await page.locator('#pQuickQuery').fill('Maria');await page.waitForSelector('#pQuickResults [data-pid]');
await page.locator('#pQuickResults [data-pid]').first().click();assert.equal(await page.evaluate(()=>window.createdProcess.patientId),'patient-test');
// The real consultation page, with all backend calls replaced by in-memory fixtures.
console.log('Testing consultation');await page.goto(base+'/modules/consulta/v2/consulta-completa/feed-doente.html?patientId=patient-test&sessionClinicId=clinic-test');
await page.waitForFunction(()=>document.getElementById('fd-nome').textContent==='Maria Exemplo');
await page.getByRole('button',{name:'Opções',exact:true}).click();assert.ok(await page.locator('#fd-mobile-sidebar').isVisible());await page.getByRole('button',{name:'Opções',exact:true}).click();
await page.locator('#fd-btn-nova').click();await page.waitForFunction(()=>document.querySelector('#fd-quill-editor .ql-editor'));
await page.waitForTimeout(300);
await page.locator('#fd-quill-editor .ql-editor').fill('História clínica fictícia para teste.');
assert.equal(await page.evaluate(()=>{window.confirm=()=>false;return window.__gc_canLeaveConsultation();}),false);
await page.locator('#fd-btn-cancelar').click();assert.ok(await page.locator('#fd-nova-wrap').evaluate(e=>e.classList.contains('visivel')));
for(const width of [320,390,430]){await page.setViewportSize({width,height:844});await page.waitForTimeout(60);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`consultation overflow at ${width}`);}
await page.screenshot({path:root+'/tests/artifacts/iphone-consulta.png',fullPage:true});
await page.locator('#fd-btn-gravar').click();await page.waitForFunction(()=>window.writes.some(w=>w.table==='consultations'&&w.operation==='update'));
assert.ok(await page.evaluate(()=>window.writes.find(w=>w.table==='consultations'&&w.operation==='update').payload.hda.includes('História clínica fictícia')));
await page.waitForFunction(()=>!document.getElementById('fd-nova-wrap').classList.contains('visivel'));
assert.equal(await page.evaluate(()=>window.__gc_canLeaveConsultation()),true);
await page.locator('a[data-private-pdf]').first().click();await page.waitForSelector('.gc-pdf-viewer [data-pdf-share]:enabled');assert.equal(await page.evaluate(()=>window.testShares.length),0);await page.locator('[data-pdf-share]').click();assert.equal(await page.evaluate(()=>window.testShares.length),1);await page.screenshot({path:root+'/tests/artifacts/iphone-pdf.png',fullPage:true});await page.locator('[data-pdf-close]').click();
// Failure and fallback must never offer an unauthorized or non-PDF file.
await page.evaluate(async()=>{const {openMobilePdf}=await import('/modules/mobile-pdf.js');await openMobilePdf({name:'Recusado',load:async()=>{throw new Error('denied')}});});assert.equal(await page.locator('[data-pdf-share]').isDisabled(),true);assert.equal(await page.locator('[data-pdf-download]').isHidden(),true);await page.locator('[data-pdf-close]').click();
await page.evaluate(async()=>{Object.defineProperty(navigator,'canShare',{value:()=>false,configurable:true});const {openMobilePdf}=await import('/modules/mobile-pdf.js');await openMobilePdf({name:'Exemplo',load:async()=>new Blob(['%PDF-1.4\n%%EOF'])});});assert.equal(await page.locator('[data-pdf-share]').isDisabled(),true);assert.equal(await page.locator('[data-pdf-download]').isVisible(),true);await page.locator('[data-pdf-close]').click();
await page.goto(base+'/fixture');await page.waitForFunction(()=>window.ready);
await page.evaluate(async()=>{const frame=document.createElement('iframe');frame.id='gcFeedPanelIframe';frame.srcdoc='<script>window.__gc_canLeaveConsultation=()=>false;<\/script>';document.querySelector('.gc-content').replaceChildren(frame);await new Promise(r=>frame.onload=r);});
await page.locator('.gc-mobile-nav [data-nav=doentes]').click();assert.equal(await page.locator('#gcFeedPanelIframe').count(),1);assert.equal(await page.evaluate(()=>window.G.currentView),'agenda');
await page.setViewportSize({width:1440,height:900});await page.goto(base+'/fixture');await page.waitForFunction(()=>window.ready);assert.equal(await page.locator('.gc-sidebar').isVisible(),true);assert.equal(await page.locator('.gc-mobile-nav').isVisible(),false);
assert.deepEqual(errors,[]);console.log('PASS: agenda 320–767px, Mais/permissões, novo doente, consulta real/gravação/saída, PDF/partilha/falha/fallback e desktop. Backend inteiramente simulado.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
