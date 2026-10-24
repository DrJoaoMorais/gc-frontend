const {chromium}=require('playwright');
const fs=require('fs'),assert=require('assert/strict');
const base=require('node:path').resolve(__dirname,'..');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();
await page.route('http://gc.local/**',async route=>{const path=new URL(route.request().url()).pathname; if(path==='/')return route.fulfill({contentType:'text/html',body:'<div id="editor"></div><div id="goals"></div>'});try{await route.fulfill({contentType:'text/javascript',body:fs.readFileSync(base+path,'utf8')})}catch{await route.fulfill({status:404,body:''})}});
await page.goto('http://gc.local');await page.addScriptTag({path:require.resolve('quill/dist/quill.js')});
const result=await page.evaluate(async()=>{const {enhanceClinicalEditor}=await import('/modules/clinical-editor/editor.js');const {editorHTML,loadClinicalHTML,clinicalHTML}=await import('/modules/clinical-editor/content.js');const {initObjetivosCatalogo}=await import('/modules/consulta/v2/consulta-completa/objetivos-catalogo.js'); const q=new Quill('#editor',{theme:'snow',modules:{toolbar:[['bold','italic','underline'],[{list:'bullet'}]]}});enhanceClinicalEditor(q,{integratedToolbar:true});q.setText('Primeiro parágrafo\nSegundo parágrafo\n');q.setSelection(0,0); const line=document.querySelector('[aria-label="Entrelinha"]');line.value='2';line.dispatchEvent(new Event('change')); const space=document.querySelector('[aria-label="Após parágrafo"]');space.value='12px';space.dispatchEvent(new Event('change'));const saved=editorHTML(q);loadClinicalHTML(q,saved);const loaded=editorHTML(q);q.history.undo();const root=document.querySelector('#goals');const g=initObjetivosCatalogo({root});const closed=!root.querySelector('details').open;g.setObjetivos([{chave:'dor',valor:3,unidade:'EVA 0-10'}]);return {saved,loaded,closed,goals:g.getObjetivos(),label:root.querySelector('summary').textContent,safe:clinicalHTML('<p style="line-height:99;margin-bottom:999px;color:red" onclick="evil()">Teste</p>')};});
const css=fs.readFileSync(base+'/modules/consulta/v2/consulta-completa/feed-doente.html','utf8').split('<style>')[1].split('</style>')[0];
await page.addStyleTag({content:css});
await page.locator('#goals summary').click();
await page.locator('#goals [data-toggle="dor"]').click();
await page.locator('#goals [data-grupo="dor"][data-v="4"]').click();
assert.equal(await page.locator('#goals [data-toggle="dor"] .goc-resumo').textContent(),'EVA 4');
assert.equal(await page.locator('#goals .goc-edit-panel').count(),1);
await page.locator('#goals [data-toggle="forca"]').click();
assert.equal(await page.locator('#goals .goc-panel-head span').textContent(),'Força');
assert.equal(await page.locator('#goals .goc-edit-panel').count(),1);
await page.locator('#goals [data-concluir]').click();
assert.equal(await page.locator('#goals .goc-edit-panel').count(),0);
for(const id of ['dor','forca','adm','equilibrio','avd','desporto','motor','hipertrofia']) {
 await page.locator('#goals [data-toggle="'+id+'"]').click();
 assert.equal(await page.locator('#goals .goc-edit-panel').count(),1);
}
await page.setViewportSize({width:1000,height:900});
assert.equal(await page.locator('#goals .goc-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),4);
await page.setViewportSize({width:390,height:900});
assert.equal(await page.locator('#goals .goc-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),2);
await page.setViewportSize({width:1000,height:900});
await page.locator('#goals [data-toggle="dor"]').click();

console.log('Oito cartões, painel único, edição e adaptação ao ecrã: OK');
await page.addStyleTag({content:fs.readFileSync(base+'/modules/consulta/v2/consulta-completa/feed-doente.html','utf8').split('<style>#fd-quill-editor')[1].split('</style>')[0].replace(/^/, '#fd-quill-editor')});
await page.evaluate(()=>{document.body.id='fd-nova-wrap';const q=Quill.find(document.querySelector('#editor'));q.container.id='fd-quill-editor';q.setText(Array.from({length:90},(_,i)=>'Linha fictícia '+i).join('\n'));});
const geometry=await page.evaluate(()=>{const root=document.querySelector('.ql-editor'),toolbar=document.querySelector('.ql-toolbar');const before=toolbar.getBoundingClientRect().top;root.scrollTop=root.scrollHeight;return {scroll:root.scrollTop,max:root.clientHeight,viewport:innerHeight,toolbarMoved:toolbar.getBoundingClientRect().top-before};});
assert.ok(geometry.scroll>0);assert.ok(geometry.max<=geometry.viewport*.55+1);assert.equal(geometry.toolbarMoved,0);console.log('Barra estável durante deslocação:',geometry);
assert.match(result.saved,/line-height:2/);assert.match(result.saved,/margin-bottom:12px/);assert.equal(result.loaded,result.saved);assert.equal(result.closed,true);assert.equal(result.goals[0].valor,3);assert.match(result.label,/registados/);assert.equal(result.safe,'<p>Teste</p>');console.log('Preservação de HTML e objectivos: OK');await browser.close();})();
