// Teste local com Playwright e servidor estático; todas as chamadas externas são bloqueadas.
// BASE_URL opcional; não utiliza doentes nem grava na base de dados real.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');

(async()=>{
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
const page=await browser.newPage({viewport:{width:1280,height:950}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('https://**/*',r=>r.abort());
await page.addInitScript(()=>{
window.mockDB={row:null,calls:[],fail:false};
window.supabase={createClient:()=>({auth:{getUser:async()=>({data:{user:{id:'test-author'}}})},from:()=>{
const db=window.mockDB;const q={op:'read',payload:null,filters:[],select(){return this},eq(k,v){this.filters.push([k,v]);return this},insert(v){this.op='insert';this.payload=v;return this},update(v){this.op='update';this.payload=v;return this},async single(){
if(this.op==='read')return {data:JSON.parse(sessionStorage.getItem('testRow')||'null')};
db.calls.push({op:this.op,payload:this.payload,filters:this.filters});if(db.fail)return {error:{message:'Falha simulada'}};
db.row={...db.row,...this.payload,id:'test-exam'};sessionStorage.setItem('testRow',JSON.stringify(db.row));return {data:{id:'test-exam'}};
}};return q;}})};
});
const base=process.env.BASE_URL || 'http://127.0.0.1:8766';
await page.goto(base+'/modules/obj/regiao.html?r=teleconsulta&p=test-p&c=test-c&s=test-s');
await page.waitForSelector('#acompanhante');
assert.equal(await page.locator('.opt.sel').count(),0);
assert.equal(await page.locator('.exam-details').count(),10);
assert.equal(await page.locator('.exam-details[open]').count(),1);
assert.ok(await page.locator('#examDate').inputValue());
await page.locator('#acompanhante .opt[data-v="Fisioterapeuta"]').click();
await page.locator('#nivel .opt[data-v="Acamado"]').click();
await page.locator('summary').filter({hasText:'Transferências'}).click();
await page.locator('#sentado_pe .opt[data-v="Ajuda moderada"]').click();
await page.locator('summary').filter({hasText:'Marcha e escadas'}).click();
await page.locator('#marcha_auxiliar .opt[data-v="Andarilho"]').click();
await page.locator('#marcha_ajuda .opt[data-v="Ajuda de uma pessoa"]').click();
await page.locator('#notas_marcha').fill('Percorre 15 metros.');
await page.locator('summary').filter({hasText:'Outras observações'}).click();
await page.locator('#notas_livre').fill('Observação livre <teste>.');
await page.locator('[data-tab="pedidos"]').click();
assert.equal(await page.locator('[data-pedido]').count(),8);
assert.equal(await page.locator('[data-pedido]:checked').count(),0);
await page.locator('[data-pedido="barthel"]').check();
await page.locator('[data-pedido="tug"]').check();
await page.locator('#pedidos_notas').fill('Reavaliar antes da consulta <nota>.');
await page.locator('#btnCopy').click();
await page.waitForFunction(()=>document.querySelector('#btnCopy').textContent==='Guardado ✓');
let db=await page.evaluate(()=>window.mockDB);assert.equal(db.calls[0].op,'insert');assert.equal(db.row.assessment_type,'teleconsulta');assert.equal(db.row.data.transferencias.sentado_pe,'Ajuda moderada');assert.ok(!db.row.data.resumo.includes('SEDESTAÇÃO'));assert.ok(page.url().includes('a=test-exam'));
await page.locator('[data-pedido="tug"]').uncheck();
assert.equal(await page.locator('#btnCopy').isEnabled(),true);
await page.locator('[data-tab="exame"]').click();
await page.locator('#notas_marcha').fill('Percorre 20 metros.');
await page.locator('#btnCopy').click();await page.waitForFunction(()=>window.mockDB.calls.length===2);
db=await page.evaluate(()=>window.mockDB);assert.equal(db.calls[1].op,'update');assert.ok(db.calls[1].filters.some(([k,v])=>k==='consultation_id'&&v==='test-s'));
await page.reload();await page.waitForFunction(()=>document.querySelector('#notas_marcha')?.value==='Percorre 20 metros.');
assert.equal(await page.locator('#sentado_pe .sel').getAttribute('data-v'),'Ajuda moderada');
assert.equal(await page.locator('[data-pedido="barthel"]').isChecked(),true);
assert.equal(await page.locator('[data-pedido="tug"]').isChecked(),false);
assert.equal(await page.locator('#pedidos_notas').inputValue(),'Reavaliar antes da consulta <nota>.');
await page.addScriptTag({url:base+'/modules/relatorios/v2/_renderers/exame-render-v2.js'});
const html=await page.evaluate(async()=>{const cfg=(await import('/modules/obj/configs/teleconsulta.js')).default;return window.gcv2RenderExameObjectivoV2(cfg,window._gerarData());});
assert.ok(!html.includes('Avaliações a pedir ao terapeuta'));
assert.ok(!html.includes('Índice de Barthel'));
assert.ok(!html.includes('TUG — devolver'));
assert.ok(!html.includes('&lt;nota&gt;'));
assert.ok(html.includes('Ajuda moderada'));assert.ok(html.includes('20 metros'));assert.ok(html.includes('Observação livre &lt;teste&gt;'));assert.ok(!html.includes('Equilíbrio sentado'));
await page.evaluate(()=>{window.mockDB.fail=true;document.querySelectorAll('details').forEach(d=>d.open=true)});
await page.locator('#notas_marcha').fill('Dados a preservar');await page.locator('#btnCopy').click();await page.waitForSelector('#toast-err.show');assert.equal(await page.locator('#btnCopy').isEnabled(),true);assert.equal(await page.locator('#notas_marcha').inputValue(),'Dados a preservar');
await page.evaluate(()=>{window.mockDB.fail=false});await page.locator('#btnCopy').click();await page.waitForFunction(()=>document.querySelector('#btnCopy').textContent==='Guardado ✓');
await page.evaluate(()=>document.querySelectorAll('details').forEach((d,i)=>d.open=i===0));
if (process.env.SCREENSHOT_PATH) await page.screenshot({path:process.env.SCREENSHOT_PATH,fullPage:true});
await page.locator('[data-tab="pedidos"]').click();
if (process.env.SCREENSHOT_PATH) await page.screenshot({path:process.env.SCREENSHOT_PATH,fullPage:true});
await page.locator('[data-pedido="barthel"]').uncheck();
await page.locator('#pedidos_notas').fill('');
const empty=await page.evaluate(async()=>window.gcv2RenderExameObjectivoV2((await import('/modules/obj/configs/teleconsulta.js')).default,window._gerarData()));
assert.ok(!empty.includes('Avaliações a pedir ao terapeuta'));
assert.ok(!await page.evaluate(()=>window._gerarResumo().includes('AVALIAÇÕES A PEDIR')));
await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
await page.goto(base+'/modules/obj/regiao.html?r=ombro');await page.waitForSelector('#lado .opt');assert.equal(await page.locator('[data-tab="pedidos"]').count(),0);assert.equal(await page.locator('.exam-details').count(),0);assert.equal(await page.locator('#lado .opt').count(),2);
assert.deepEqual(errors,[]);

console.log('PASS: formulário sem valores por defeito, gravação simulada, edição sem duplicação, reabertura, falha e repetição, relatório incluindo notas livres, ecrã móvel e ombro.');
}finally{await browser.close()}
})();
