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
await page.goto('http://clinical.test/');await page.waitForSelector('.gc-cc-table');
assert.equal(await page.locator('.gc-cc-row').count(),3);
assert.match(await page.locator('[data-list]').innerText(),/Mal-estar antes do treino · 2 dias consecutivos/);
assert.match(await page.locator('[data-list]').innerText(),/Fim da medicação/);
await page.locator('[data-clinical-view=patients]').click();assert.equal(await page.locator('.gc-cc-row').count(),5);
await page.screenshot({path:root+'/validation/compacto-lista-desktop.png',fullPage:true});
await page.locator('[data-clinical-profile="ana:a:legacy"]').first().click();
assert.equal(await page.locator('.gc-cc-layout').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),2);
assert.match(await page.locator('[data-editor]').innerText(),/Transição de fase por confirmar/);
await page.screenshot({path:root+'/validation/compacto-painel-desktop.png',fullPage:true});
await page.locator('[data-review="ana:a:legacy"]').first().click();assert.match(await page.locator('[data-source]').innerText(),/Dias civis consecutivos/);
await page.locator('[name=reason]').fill('Nota fictícia por guardar');page.once('dialog',d=>d.dismiss());await page.locator('[data-clinical-clinic]').selectOption('b');assert.equal(await page.locator('[name=reason]').inputValue(),'Nota fictícia por guardar');
page.once('dialog',d=>d.accept());await page.locator('[data-refresh]').click();await page.waitForSelector('.gc-cc-table');
await page.locator('[data-clinical-view=patients]').click();
await page.locator('[data-clinical-profile="rita:a:legacy"]').first().click();
assert.match(await page.locator('[data-editor]').innerText(),/Medicação de demonstração/);
await page.locator('[data-clinical-clinic]').selectOption('b');assert.doesNotMatch(await page.locator('[data-list]').innerText(),/Rita Santos|Ana Martins/);assert.equal(await page.locator('[data-editor]').innerText(),'');
await page.locator('[data-clinical-clinic]').selectOption('');
for(const width of [1024,768,375,320]){
 await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'overflow at '+width);
 await page.locator('[data-clinical-profile="ana:a:legacy"]').first().click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'drawer overflow at '+width);
 if(width===375)await page.screenshot({path:root+'/validation/compacto-mobile.png',fullPage:true});
 await page.locator('[data-close-editor]').click();
}
// Divergent sources are excluded before creating summaries or clinical alerts.
await page.evaluate(async()=>{previewTables.wo_session_readiness.push({...previewTables.wo_session_readiness[0],id:'bad',clinic_id:'b',feeling:1});await reloadPreview();});
assert.match(await page.locator('.gc-cc-warning').innerText(),/1 registo/);
assert.deepEqual(errors,[]);
console.log('Lista compacta: alertas, medicação, painel lateral, notas, clínicas, associações divergentes e larguras 1440/1024/768/375/320 verificados.');
await browser.close();
