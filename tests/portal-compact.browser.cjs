const {chromium}=require('/Users/joaomorais/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs'),assert=require('node:assert/strict'),path=require('path');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const original=fs.readFileSync(path.join(__dirname,'../acompanhamento.html'),'utf8');
 for(const width of [320,390])for(const mode of ['all','shoulder','empty']){
 const page=await browser.newPage({viewport:{width,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.install({time:new Date('2026-11-13T12:00:00Z')});
 const home={valid:true,first_name:'Exemplo fictício',diario:{enabled:mode==='all',episode_token:'fake',started_at:'2026-11-12T12:00:00Z',duration_days:15},exercicio:{enabled:mode!=='empty'},medicacao:mode==='all'?[{nome:'Fármaco <teste>',dose:'Dose prescrita',freq:'Semanal',periodicidade:'Indicação completa'}]:[],questionario:{pending:mode==='all',token:'fake',status:'pending_rgpd'}};
 const sessions=mode==='empty'?[]:[{date:'2026-11-13',notes:'Origem: Ombro',title:'Reabilitação do ombro',local:'casa',items:[]},...(mode==='all'?[{date:'2026-11-13',notes:'',title:'Fortalecimento',items:[]}]:[])];
 const results={authorize_patient_portal_device:{authorized:true,patient_name:'Pessoa fictícia'},get_acompanhamento_home:home,get_acompanhamento_exercise:{ok:true,plan_token:'fake',plan:{sessions}},get_acompanhamento_medication_events:[{date:'2026-11-13',type:'toma',medication:'Fármaco <teste>',dose:'Dose prescrita',instructions:'Indicação completa'}],wo_get_session_messages:{messages:[{id:'m',body:'Mensagem clínica preservada',read_at:null}]}};
 const stub=`<script>window.sb={rpc:async name=>({data:(${JSON.stringify(results)})[name]})};document.cookie='__Host-gc_portal_device=fake; Secure; Path=/';</script>`;
 const html=original.replace(/<script src=.*?<\/script>/s,'').replace(/<script>.*?<\/script>/s,stub);
 await page.route('**/*',r=>r.request().isNavigationRequest()?r.fulfill({contentType:'text/html',body:html}):r.abort());await page.goto('https://portal.test/acompanhamento?t=fake');await page.waitForSelector('#app',{state:'visible'});
 assert.equal(await page.locator('.home-day').count(),14);assert.equal(await page.locator('.cards .card:visible').count(),mode==='all'?5:mode==='shoulder'?1:0);assert.equal(await page.locator('#nextActions').isVisible(),false);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 if(mode==='all'){
 assert.equal(await page.locator('.cards .state.on:visible').count(),4);assert.match(await page.locator('#questionState').innerText(),/Por responder/);await page.locator('#medCard').click();assert.match(await page.locator('#compactDetails').innerText(),/Fármaco <teste>/);assert.match(await page.locator('#compactDetails').innerText(),/Indicação completa/);assert.equal(await page.locator('#compactDetails teste').count(),0);await page.locator('#compactDetails button').click();assert.equal(await page.locator('#compactDetails').isVisible(),false);
 }
 assert.equal(await page.locator('#compactDiscover').isVisible(),mode==='shoulder');
 const range=await page.locator('#homeRange').innerText();await page.locator('#homeNext').click();assert.notEqual(await page.locator('#homeRange').innerText(),range);await page.locator('#homePrev').click();assert.equal(await page.locator('#homeRange').innerText(),range);
 if(mode!=='empty')assert.match(await page.locator('#planUpdates').innerText(),/Mensagem clínica preservada/);
 if(width===390)await page.screenshot({path:`/tmp/portal-compact-${mode}.png`,fullPage:true});
 assert.deepEqual(errors,[]);console.log(width,mode,'OK');await page.close();
 }
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
