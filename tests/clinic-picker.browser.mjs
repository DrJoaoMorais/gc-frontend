import {createRequire} from 'node:module';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'/Users/joaomorais/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=resolve(new URL('..',import.meta.url).pathname);
const browser=await chromium.launch({channel:'chrome',headless:true});
await mkdir('/private/tmp/gc-clinicas-validation',{recursive:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('http://clinics.test/**',async route=>{
 const path=new URL(route.request().url()).pathname;
 if(path==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="pt"><head></head><body></body></html>'});
 try{let body=await readFile(resolve(root,'.'+path),'utf8');
 if(path==='/modules/exercicio/prescricao/prescricao.js')body+='\nexport {renderLanding};';
 if(path==='/modules/boot.js')body+='\nexport {loadHomeConsultasHoje, loadHomePedidosOnlinePendentes, loadHomePedidosOnlineList, loadHomeAcompanhamentoAtivo, loadHomeAlerts}; export function testHomeIds(ids){homeClinicIds=ids;homeClinicRevision++;}';
 await route.fulfill({contentType:extname(path)==='.css'?'text/css':'text/javascript',body});}catch(e){await route.fulfill({status:404,body:''});}
});
await page.goto('http://clinics.test/');
await page.evaluate(async()=>{
 const {G}=await import('/modules/state.js');window.G=G;
 G.role='super_admin';G.sessionUser={id:'test-user'};G.selectedDayISO='2026-09-14';
 G.clinics=['AlfraClinic','Athletix','Novo Cuidar'].map((name,i)=>({id:'c'+i,name}));G.clinicsById=Object.fromEntries(G.clinics.map(c=>[c.id,c]));

 window.calls=[];window.tables={};window.delay=0;
 window.sb={from(table){let filters=[];const q=new Proxy({}, {get(_,key){if(key==='then')return async done=>{const ms=window.delay;const data=(window.tables[table]||[]).filter(row=>filters.every(([kind,col,val])=>kind==='in'?val.includes(row[col]):kind==='eq'?row[col]===val:true));window.calls.push({table,filters:structuredClone(filters)});if(ms)await new Promise(r=>setTimeout(r,ms));done({data,error:null,count:data.length});};return (...args)=>{filters.push([key,...args]);return q;};}});return q;},auth:{onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),getSession:async()=>({data:{session:{user:{id:'test-user'}}}}),getUser:async()=>({data:{user:{id:'test-user'}}})}};
});
await page.evaluate(async()=>{const shell=await import('/modules/shell.js');window.testShell=view=>{G.currentView=view;shell.renderAppShell();};});
async function exercisePicker(host,expected){
 const picker=page.locator(host+' .gc-clinic-picker');
 await picker.locator('summary').click();await picker.locator('[data-clinic="c1"]').click();
 assert.equal(await picker.getAttribute('open'),null);assert.match(await picker.locator('summary').innerText(),/1 clínica selecionada/);
 await picker.locator('summary').click();assert.equal(await picker.locator('[data-clinic]:checked').count(),1);
 await picker.locator('[data-clinic="c2"]').click();assert.equal(await picker.getAttribute('open'),null);
 assert.match(await picker.locator('summary').innerText(),/2 clínicas selecionadas/);
 if(expected)await expected();
 await page.screenshot({path:'/private/tmp/gc-clinicas-validation/'+host.slice(1)+'-closed.png'});
 await picker.locator('summary').click();
 await page.screenshot({path:'/private/tmp/gc-clinicas-validation/'+host.slice(1)+'-open.png'});
 const menuBox=await picker.locator('.gc-clinic-menu').boundingBox();assert(menuBox.x>=0&&menuBox.x+menuBox.width<=1440);
 await page.keyboard.press('Escape');
 await picker.locator('summary').click();await picker.locator('[data-clinic="c1"]').click();
 assert.match(await picker.locator('summary').innerText(),/1 clínica selecionada/);
 await picker.locator('summary').click();await picker.locator('[data-all]').click();
 assert.equal(await picker.getAttribute('open'),null);assert.match(await picker.locator('summary').innerText(),/Todas as clínicas/);
}
// Home uses the common compact UI.
await page.evaluate(async()=>{const m=await import('/modules/home-dashboard.js');testShell('home');m.renderHomeClinicSelect(G.clinics,null,ids=>window.homeIds=ids);});
await exercisePicker('#gcHomeClinicSelect',async()=>assert.deepEqual(await page.evaluate(()=>homeIds),['c1','c2']));
// Agenda uses the real refresh path and hidden single-clinic context.
await page.evaluate(async()=>{const w=await import('/modules/agenda-workspace.js');testShell('agenda');const a=await import('/modules/agenda.js');G.agendaClinicIds=null;G.activeClinicId=null;sessionStorage.clear();a.renderClinicsSelect(G.clinics);});
await exercisePicker('#awClinicPicker',async()=>assert.deepEqual(await page.evaluate(()=>G.agendaClinicIds),['c1','c2']));
// Management uses the real day/week/sidebar queries.
await page.evaluate(async()=>{window.__gc_onApptSaved=null;testShell('gestaoagenda');const m=await import('/modules/gestaoagenda.js');await m.initGestaoAgenda();});
await exercisePicker('#gaClinicPicker',async()=>{await page.waitForFunction(()=>calls.some(c=>c.table==='v_reavaliacoes_pendentes'&&c.filters.some(f=>f[0]==='in'&&f[1]==='clinic_id'&&JSON.stringify(f[2])==='["c1","c2"]')));});
// Exercise uses real landing queries and renders without clinic cards.
await page.evaluate(async()=>{testShell('exercicio');document.head.insertAdjacentHTML('beforeend','<link rel="stylesheet" href="/modules/exercicio/prescricao/prescricao.css">');const m=await import('/modules/exercicio/prescricao/prescricao.js');m.renderLanding();});
await exercisePicker('#gcwoLandingClinicPicker',async()=>{await page.waitForFunction(()=>calls.some(c=>c.table==='wo_prescriptions'&&c.filters.some(f=>f[0]==='in'&&f[1]==='clinic_id'&&JSON.stringify(f[2])==='["c1","c2"]')));});
assert.equal(await page.locator('.gcwo-landing-clinicoption').count(),0);
// Verify actual Home query scope, and reject a delayed response for the old filter.
await page.evaluate(async()=>{
 const ui=await import('/modules/home-dashboard.js');document.body.innerHTML='<style>'+ui.homeDashboardStyles()+'</style>'+ui.homeDashboardHtml();
 const home=await import('/modules/boot.js');window.homeModule=home;
 window.tables.patient_uploads=[{id:'a',clinic_id:'c0',status:'pendente'},{id:'b',clinic_id:'c1',status:'pendente'},{id:'c',clinic_id:'c2',status:'pendente'}];
 home.testHomeIds(['c1','c2']);await home.loadHomePedidosOnlinePendentes();
 await Promise.all([home.loadHomeConsultasHoje(),home.loadHomePedidosOnlineList(),home.loadHomeAcompanhamentoAtivo(),home.loadHomeAlerts()]);
 window.scopeCount=document.getElementById('gcHomeStatPedidosOnline')?.textContent;
 window.delay=180;const stale=home.loadHomePedidosOnlinePendentes();window.delay=0;
 home.testHomeIds(['c0']);await home.loadHomePedidosOnlinePendentes();await stale;
});
assert.equal(await page.evaluate(()=>scopeCount),'2');
assert.equal(await page.locator('#gcHomeStatPedidosOnline').innerText(),'1');
// Query filter evidence across all four integrations.
const calls=await page.evaluate(()=>window.calls);
assert(calls.some(c=>c.table==='patient_uploads'&&c.filters.some(f=>f[0]==='in'&&f[2].length===2)));
assert(calls.some(c=>c.table==='horarios_recorrentes'&&c.filters.some(f=>f[0]==='in'&&f[2].length===2)));
assert(calls.some(c=>c.table==='alerts'&&c.filters.some(f=>f[0]==='in'&&JSON.stringify(f[2])==='["c1","c2"]')));
assert(calls.some(c=>c.table==='appointments'&&c.filters.some(f=>f[0]==='or'&&f[1].includes('clinic_id.in.("c1","c2")'))));
assert.deepEqual(errors,[]);
await mkdir('/private/tmp/gc-clinicas-validation',{recursive:true});
await page.screenshot({path:'/private/tmp/gc-clinicas-validation/home.png'});
await browser.close();console.log('Quatro seletores, fecho automático e filtros de consultas/horários/alertas verificados.');
