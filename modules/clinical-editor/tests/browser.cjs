const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1200,height:1000}});
  const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE',e.message)});page.on('requestfailed',r=>console.error('FAILED',r.url(),r.failure()));
  await page.route('https://**/*',r=>r.abort());
  const quillDir=path.dirname(require.resolve('quill/package.json'));
  await page.route('**/__quill.js',r=>r.fulfill({path:path.join(quillDir,'dist/quill.js'),contentType:'text/javascript'}));
  await page.route('**/__quill.css',r=>r.fulfill({path:path.join(quillDir,'dist/quill.snow.css'),contentType:'text/css'}));
  await page.goto((process.env.BASE_URL||'http://127.0.0.1:8766')+'/modules/clinical-editor/tests/fixture.html');
  await page.waitForFunction(()=>window.ready);
  const verify=async(html)=>page.evaluate(html=>{content.loadClinicalHTML(q,html);document.querySelector('#save').click();return {saved:JSON.parse(localStorage.getItem('fictional-consultation')).hda,reopened:content.editorHTML(q),feed:document.querySelector('#feed .cc-hda').innerHTML,report:document.querySelector('#report').innerHTML}},html);
  for(const [label,html] of [
   ['UL','<ul><li>Melhorar mobilidade</li><li>Preservar autonomia</li></ul>'],
   ['OL','<ol><li>Primeiro</li><li>Segundo</li></ol>'],
   ['mixed','<ul><li>Bola<ul><li>Sublista</li></ul><ol><li>Passo</li></ol></li><li>Outra bola</li></ul><ol><li>Número</li></ol>'],
   ['format','<p><strong>Negrito</strong> <em>Itálico</em> <u>Sublinhado</u></p>']
  ]){const result=await verify(html);assert.equal(result.saved,html,label);assert.equal(result.reopened,html,label+' reopen');assert.equal(result.feed,html,label+' feed');assert.equal(result.report,html,label+' report');}
  const legacy=await verify('<ol><li data-list="bullet"><span class="ql-ui"></span>Bola</li><li data-list="bullet" class="ql-indent-1">Filho</li><li data-list="ordered">Número</li></ol>');
  assert.equal(legacy.saved,'<ul><li>Bola<ul><li>Filho</li></ul></li></ul><ol><li>Número</li></ol>');
  assert.equal(legacy.saved,legacy.reopened);
  // Real keyboard: Enter twice exits; Tab and Shift+Tab change hierarchy.
  await page.evaluate(()=>{content.loadClinicalHTML(q,'<ul><li>Um</li></ul>');q.setSelection(2,0)});
  await page.keyboard.press('Enter');await page.keyboard.type('Dois');
  await page.keyboard.press('Tab');
  assert.match(await page.evaluate(()=>content.editorHTML(q)),/<ul><li>Um<ul><li>Dois/);
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(()=>content.editorHTML(q)),'<ul><li>Um</li><li>Dois</li></ul>');
  await page.keyboard.press('Enter');await page.keyboard.press('Enter');await page.keyboard.type('Fora');
  assert.match(await page.evaluate(()=>content.editorHTML(q)),/<\/ul><p>Fora<\/p>/);
  // Paste mixed lists from HTML, rejecting executable content and style.
  await page.evaluate(()=>{content.loadClinicalHTML(q,'');q.setSelection(0);const d=new DataTransfer();d.setData('text/html','<ul><li><b>Bola</b><ul><li>Filho</li></ul></li></ul><ol><li>Número</li></ol><script>alert(1)</script><p onclick="alert(1)" style="color:red">Seguro</p>');q.root.dispatchEvent(new ClipboardEvent('paste',{clipboardData:d,bubbles:true,cancelable:true}));});
  let pasted=await page.evaluate(()=>content.editorHTML(q));assert.match(pasted,/<ul>/);assert.match(pasted,/<ol>/);assert.ok(!/script|onclick|color/.test(pasted));
  await page.getByRole('button',{name:'Desfazer',exact:true}).click();assert.equal(await page.evaluate(()=>q.getText()),'\n');
  await page.getByRole('button',{name:'Refazer',exact:true}).click();assert.equal(await page.evaluate(()=>content.editorHTML(q)),pasted);
  await page.evaluate(()=>{content.loadClinicalHTML(q,'<p><strong>Forte</strong> <em>Itálico</em></p>');q.setSelection(0,q.getLength()-1)});
  await page.getByRole('button',{name:'Limpar formatação',exact:true}).click();
  assert.equal(await page.evaluate(()=>content.editorHTML(q)),'<p>Forte Itálico</p>');
  await page.evaluate(html=>content.loadClinicalHTML(q,html),pasted);
  assert.equal(await page.evaluate(()=>calls.length),0,'formatting never calls AI');
  // Proposal preview is a read-only visual render built only from validated blocks
  // (paragraph/bullet/ordered/indented — never AI HTML). Accept is explicit,
  // cancel preserves original, and undo reverts the structured acceptance.
  const expectedStructured='<p>História actual</p><ul><li>Sem queixas<ul><li>Mantém autonomia</li></ul></li></ul><ol><li>Reavaliar em 4 semanas</li></ol>';
  await page.getByRole('button',{name:'Estruturar com IA',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('[data-accept]').disabled);
  assert.equal(await page.evaluate(()=>content.editorHTML(q)),pasted);
  const preview=await page.evaluate(()=>document.querySelector('[data-preview]').innerHTML);
  assert.match(preview,/<p>História actual<\/p>/,'preview: paragraph');
  assert.match(preview,/<ul><li>Sem queixas<ul><li>Mantém autonomia<\/li><\/ul><\/li><\/ul>/,'preview: bullet + indented bullet');
  assert.match(preview,/<ol><li>Reavaliar em 4 semanas<\/li><\/ol>/,'preview: ordered');
  assert.ok(!/<script|onerror=|onclick=/i.test(preview),'preview never contains executable markup');
  await page.getByRole('button',{name:'Manter original'}).click();assert.equal(await page.evaluate(()=>content.editorHTML(q)),pasted);
  await page.getByRole('button',{name:'Estruturar com IA',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('[data-accept]').disabled);
  await page.getByRole('button',{name:'Aceitar',exact:true}).click();
  assert.equal(await page.evaluate(()=>content.editorHTML(q)),expectedStructured,'accept builds Quill content from validated blocks');
  await page.getByRole('button',{name:'Desfazer',exact:true}).click();assert.equal(await page.evaluate(()=>content.editorHTML(q)),pasted,'undo after accept restores original');
  await page.evaluate(()=>window.delayAI=true);
  await page.getByRole('button',{name:'Estruturar com IA',exact:true}).click();
  await page.waitForFunction(()=>window.resolveAI);
  await page.evaluate(()=>{q.insertText(0,'Alterado entretanto. ','user');resolveAI();});
  await page.waitForFunction(()=>!document.querySelector('[data-accept]').disabled);
  await page.getByRole('button',{name:'Aceitar',exact:true}).click();assert.match(await page.locator('[data-status]').innerText(),/alterado entretanto/);
  await page.getByRole('button',{name:'Manter original'}).click();
  await page.evaluate(()=>{window.delayAI=false;window.aiFailure=true});
  await page.getByRole('button',{name:'Estruturar com IA',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-status]').textContent.includes('Não foi possível'));
  assert.equal(await page.locator('[data-accept]').isDisabled(),true);
  assert.equal(await page.evaluate(()=>content.editorHTML(q)),pasted,'original preserved when the API call fails');
  await page.getByRole('button',{name:'Manter original'}).click();
  // Malformed/disallowed blocks are rejected client-side too and never reach the editor.
  await page.evaluate(()=>{window.aiFailure=false;window.aiResult={blocks:[{type:'heading',text:'x',level:0}]}});
  await page.getByRole('button',{name:'Estruturar com IA',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[data-status]').textContent.includes('formato inesperado'));
  assert.equal(await page.locator('[data-accept]').isDisabled(),true);
  assert.equal(await page.evaluate(()=>content.editorHTML(q)),pasted,'invalid blocks never modify the editor');
  await page.getByRole('button',{name:'Manter original'}).click();
  await verify('<p><strong>Objectivos</strong></p><ul><li>Melhorar mobilidade<ul><li>Treino funcional</li></ul></li><li>Preservar autonomia</li></ul><ol><li>Reavaliar</li><li>Ajustar plano</li></ol>');
  if(process.env.OUTPUT_DIR){await page.screenshot({path:path.join(process.env.OUTPUT_DIR,'editor-validado.png'),fullPage:true});await page.pdf({path:path.join(process.env.OUTPUT_DIR,'listas-validacao.pdf'),format:'A4',printBackground:true});}
  // Actual HDA save module, with a fake database adapter (no patient data).
  await page.evaluate(async()=>{
    const {montarEditorHDA}=await import('/modules/consulta/v2/nova-consulta/hda-quill.js');
    const host=document.createElement('div');host.id='actual-hda';document.body.appendChild(host);
    window.savedPayload=null;
    const fakeDB={from:table=>({update:payload=>({eq:(key,id)=>({select:async()=>{window.savedPayload={table,key,id,payload};return {data:[{id}]}}})})})};
    montarEditorHDA(host,{id:'fictional-id',hda:''},fakeDB);
    window.realQ=Quill.find(host.querySelector('#nc-hda-editor'));
    realQ.setText('Bola A\nBola B\n','user');realQ.formatLine(0,realQ.getLength(),'list','bullet','user');
  });
  await page.waitForFunction(()=>window.savedPayload?.payload.hda.includes('<ul>'));
  assert.equal(await page.evaluate(()=>savedPayload.payload.hda),'<ul><li>Bola A</li><li>Bola B</li></ul>');
  await page.evaluate(()=>realQ.formatLine(0,realQ.getLength(),'list','ordered','user'));
  await page.waitForFunction(()=>window.savedPayload?.payload.hda.includes('<ol>'));
  assert.equal(await page.evaluate(()=>savedPayload.payload.hda),'<ol><li>Bola A</li><li>Bola B</li></ol>');
  await page.evaluate(()=>document.querySelector('#actual-hda').remove());
  // Reopening a consultation with existing HDA must not autosave; a real user edit must still trigger it.
  await page.evaluate(async()=>{
    const {montarEditorHDA}=await import('/modules/consulta/v2/nova-consulta/hda-quill.js');
    const host=document.createElement('div');host.id='reopen-hda';document.body.appendChild(host);
    window.reopenSaved=null;
    const fakeDB={from:table=>({update:payload=>({eq:(key,id)=>({select:async()=>{window.reopenSaved={table,key,id,payload};return {data:[{id}]}}})})})};
    montarEditorHDA(host,{id:'reopen-id',hda:'<p>Texto antigo</p>'},fakeDB);
    window.reopenQ=Quill.find(host.querySelector('#nc-hda-editor'));
  });
  await page.waitForTimeout(2300);
  assert.equal(await page.evaluate(()=>window.reopenSaved),null,'opening an existing HDA must not autosave');
  await page.evaluate(()=>reopenQ.insertText(reopenQ.getLength()-1,' Nota nova.','user'));
  await page.waitForFunction(()=>window.reopenSaved!==null);
  assert.match(await page.evaluate(()=>reopenSaved.payload.hda),/Nota nova\./,'a real user edit must still autosave');
  await page.evaluate(()=>document.querySelector('#reopen-hda').remove());
  assert.deepEqual(errors,[]);
  console.log('PASS: UL, OL, mixed/nested and legacy lists; serialization/reopen/feed/report; Enter/Tab; paste; undo/redo; AI structured blocks preview/accept/undo/cancel/conflict/failure/invalid-blocks; no AI for formatting; no HDA autosave on load.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
