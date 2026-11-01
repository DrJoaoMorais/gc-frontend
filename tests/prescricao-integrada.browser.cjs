// QA da página real com dados sintéticos e rede externa bloqueada.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/Users/joaomorais/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
(async () => {
 const browser = await chromium.launch({channel:'chrome',headless:true});
 try {
  const page = await browser.newPage({viewport:{width:1280,height:1000}}), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.hostname!=='gc-integrada.test') return route.abort();
   if(u.pathname==='/') return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="pt"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font:14px system-ui;background:#f1f5fa;color:#172f51}main{max-width:1440px;margin:auto;padding:20px}button,input,select{font:inherit;max-width:100%}*{box-sizing:border-box}</style><link rel="stylesheet" href="/modules/exercicio/prescricao/prescricao.css"></head><body><main><div id="gcwoPrescricaoRoot"></div></main></body></html>'});
   try {
    let source=await fs.readFile(path.join(root,u.pathname),'utf8');
    if(u.pathname==='/modules/exercicio/prescricao/prescricao.js') source+=`\nexport function seed(catalog){G.sessionUser={id:'demo-owner'};G.clinics=[{id:'demo-clinic',name:'Clínica de demonstração'}];_state=freshState();_state.patient={id:'demo-patient',full_name:'Doente de demonstração'};_state.clinicId='demo-clinic';_state.startDate='2026-11-02';_state.endDate='2026-11-29';_state.linkExpiryDate='2026-11-16';_state.catalogLoaded=true;_state.exercisesCatalog=catalog;_calendarFirstMonday='2026-11-02';renderStep2();}\n`;
    return route.fulfill({contentType:u.pathname.endsWith('.css')?'text/css':'text/javascript',body:source});
   }catch{return route.fulfill({status:404,body:''});}
  });
  await page.goto('http://gc-integrada.test/');
  const catalog=JSON.parse(await fs.readFile(path.join(root,'tests/fixtures/catalogo-173.json'),'utf8'));
  await page.evaluate(async catalog=>{
   window.sb={from(){const q={select(){return q},eq(){return q},in(){return q},order(){return q},limit(){return q},maybeSingle:async()=>({data:null,error:null}),then(resolve){resolve({data:[],error:null});}};return q;}};
   const m=await import('/modules/exercicio/prescricao/prescricao.js');m.seed(catalog);
  },catalog);
  assert.equal(await page.locator('.gcwo-calday').count(),7);
  await page.locator('[data-bib-bloco="inferiores"]').click();
  assert.equal(await page.locator('[data-bib-exercicio]:checked').count(),4);
  await page.locator('[data-colocar-bloco="2026-11-03"]').click();
  await page.locator('#gcwoPGuardar').click();
  const row=page.locator('.gcwo-calsession-row').first();
  await row.locator('summary').click();
  assert.match(await row.innerText(),/Sentar e levantar/);
  const expiry=await page.locator('#gcwoDataValidadeLink').inputValue();
  await page.locator('#gcwoCopiarSemana').click();
  assert.equal(await page.locator('#gcwoDataValidadeLink').inputValue(),expiry);
  await fs.mkdir('/tmp/gc-integrada-qa',{recursive:true});
  for(const width of [1280,768,390]){
   await page.setViewportSize({width,height:1000});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Page overflow at '+width);
   await page.screenshot({path:'/tmp/gc-integrada-qa/prescricao-'+width+'.png',fullPage:true});
  }
  assert.deepEqual(errors,[]);
  console.log('Browser: catálogo real, atribuição, exercícios por dia, cópia e validade independente; 1280/768/390 px: OK.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
