const {readFileSync} = require('node:fs');
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const html = readFileSync('modules/consulta/v2/consulta-completa/feed-doente.html','utf8');
const pedidos = readFileSync('modules/pedidos/pedidos-v2.js','utf8');
const section = html.slice(html.indexOf('    // Atualiza apenas as zonas'), html.indexOf('    /* ── render do feed completo ── */',html.indexOf('    // Atualiza apenas as zonas')));
const renderer = html.slice(html.indexOf('    function renderDocumentos(docs)'), html.indexOf('    function fdOpenDocumentosModal()'));
const upload = pedidos.slice(pedidos.indexOf('async function uploadAndRegisterDocument('),pedidos.indexOf('\n/**\n * loadExamsCatalog'));
(async()=>{
 const browser=await chromium.launch({headless:true, channel:'chrome'});
 try {
 const page=await browser.newPage();
 await page.setContent(`<button id="fd-docs-refresh">Atualizar</button><span id="fd-docs-status"></span><div id="fd-feed"><div id="fd-docs-sem-consulta"></div><div class="fd-card aberto" data-consult-id="consulta-ficticia"><div class="fd-card-head"><div class="fd-card-acoes"></div></div><div class="fd-card-body"><textarea id="editor">Texto por guardar</textarea><details open><summary>Exame</summary></details></div></div></div><div id="separador" data-active="consulta"></div>`);
 await page.addScriptTag({content:`
 const PATIENT_ID='doente-ficticio'; let fdAllDocs=[];
 const DOC_TIPOS={}, DOC_TIPO_SLUG={}; let fdPatientData={};
 const esc = s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
 const fmtDataHora=s=>s; const buildFriendlyFileName=()=> 'documento.pdf';
 const fdConfirmArquivarDocumento=()=>{};
 window.rows=[]; window.reads=0; window.fail=false; window.delay=0;
 window.sb={from:()=>({select(){return this},eq(){return this},neq(){return this},async order(){window.reads++;await new Promise(r=>setTimeout(r,window.delay));return window.fail?{error:{message:'erro'}}:{data:structuredClone(window.rows)}}})};
 ${renderer}\n${section}
 window.refresh=fdAtualizarDocumentos;
 `});
 const doc=(id,consultation_id=null)=>({id,consultation_id,title:'Pedido fictício',category:'exames',storage_path:'private/test.pdf',created_at:'2026-10-21T18:20:00Z'});
 await page.evaluate(rows=>window.rows=rows,[doc('a'),doc('b')]);
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('gc:documents-changed',{detail:{patientId:'outro'}})));
 assert.equal(await page.evaluate(()=>window.reads),0);
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('gc:documents-changed',{detail:{patientId:'doente-ficticio'}})));
 await page.waitForFunction(()=>document.querySelectorAll('#fd-docs-sem-consulta .fd-doc-chip').length===2);
 await page.evaluate(rows=>window.rows=rows,[doc('a'),doc('b'),doc('c','consulta-ficticia')]);
 await page.click('#fd-docs-refresh');
 await page.waitForFunction(()=>document.querySelectorAll('.fd-card .fd-doc-chip').length===1);
 assert.equal(await page.locator('#editor').inputValue(),'Texto por guardar');
 assert.equal(await page.locator('.fd-card').getAttribute('class'),'fd-card aberto');
 assert.equal(await page.locator('details').getAttribute('open'),'');
 assert.equal(await page.locator('#separador').getAttribute('data-active'),'consulta');
 await page.evaluate(()=>{window.fail=true;return window.refresh()});
 assert.equal(await page.locator('.fd-doc-chip').count(),3);
 assert.match(await page.locator('#fd-docs-status').innerText(),/Não foi possível/);
 const readsBefore=await page.evaluate(()=>window.reads);
 await page.evaluate(()=>{window.fail=false;window.delay=30;window.refresh();window.refresh();return window.refresh()});
 assert.equal(await page.evaluate(()=>window.reads),readsBefore+2,'Repetir a leitura se houver nova gravação durante o pedido');
 assert.equal(await page.locator('#fd-docs-refresh').isDisabled(),false);
 // Registo real do emissor, com respostas simuladas e sem acesso a dados clínicos.
 const result=await page.evaluate(async source=>{
  let events=0;window.addEventListener('gc:documents-changed',()=>events++);
  window.sb={storage:{from:()=>({upload:async()=>({})})},from:()=>({insert:()=>({select:()=>({single:async()=>({data:{id:'novo'}})})})})};
  const save=new Function(source+';return uploadAndRegisterDocument')();
  const args={blob:new Blob(['test']),clinicId:'clinica-ficticia',patientId:'outro',title:'Teste',category:'exames',folder:'exames'};
  await save(args);
  window.sb.storage.from=()=>({upload:async()=>({error:{message:'falha'}})});
  try{await save(args)}catch{}
  return events;
 },upload);
 assert.equal(result,1,'Notifica apenas depois de guardar com sucesso');
 console.log('PASS: atualização automática/manual; com/sem consulta; isolamento por doente; contexto/editor preservados; falha sem apagar documentos; pedidos concorrentes; emissão só após gravação.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
