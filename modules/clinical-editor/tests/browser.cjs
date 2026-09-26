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
  // Stub the clipboard instead of relying on OS/browser permissions: captures
  // exactly what "Copiar" writes, with no dependency on clipboard grants.
  await page.addInitScript(()=>{
    window.__copies=[];
    window.__copyAllWrites=[];
    Object.defineProperty(navigator,'clipboard',{value:{
      writeText:async text=>{window.__copies.push(text);},
      write:async items=>{
        const item=items[0];
        const html=await(await item.getType('text/html')).text();
        const plain=await(await item.getType('text/plain')).text();
        window.__copyAllWrites.push({html,plain});
      }
    },configurable:true});
  });
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
  // "Assistente IA": side panel, one call per click, only clinical_note can be
  // applied to the HDA, everything else (alerts/hypotheses/exams/...) is read-only.
  const expectedStructured='<p>História actual</p><ul><li>Sem queixas<ul><li>Mantém autonomia</li></ul></li></ul><ol><li>Reavaliar em 4 semanas</li></ol>';
  let callsBefore=await page.evaluate(()=>calls.length);
  await page.getByRole('button',{name:'✦ Assistente clínico IA',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[data-counter]')?.textContent.includes('1 análise'));
  assert.equal(await page.evaluate(()=>calls.length)-callsBefore,1,'opening the assistant makes exactly one call');
  assert.equal(await page.evaluate(()=>content.editorHTML(q)),pasted,'HDA untouched merely by opening the assistant');

  // The prompt combines HDA + non-identifying context only — never name/SNS/NIF/phone/email/address.
  const sentPrompt=await page.evaluate(()=>calls.at(-1).args.body.prompt);
  assert.match(sentPrompt,/^HDA:\n/,'prompt starts with the HDA section');
  assert.match(sentPrompt,/\n\nCONTEXTO CONHECIDO:\n/,'prompt includes CONTEXTO CONHECIDO when patient context exists');
  assert.match(sentPrompt,/Idade: \d+ anos/,'context includes age computed from dob');
  assert.match(sentPrompt,/Profissão: Enfermeira/,'context includes profissão');
  assert.match(sentPrompt,/Atividade desportiva: Corrida recreativa/,'context includes atividade desportiva');
  assert.match(sentPrompt,/Antecedentes pessoais: Hipertensão arterial controlada/,'context includes antecedentes pessoais');
  assert.match(sentPrompt,/Antecedentes medicamentosos: Losartan 50mg/,'context includes antecedentes medicamentosos (not renamed)');
  assert.ok(!/Antecedentes cirúrgicos:/.test(sentPrompt),'empty antecedentes_cirurgicos is omitted, not sent as an empty field');
  assert.match(sentPrompt,/Alertas clínicos: Alergias: Penicilina/,'alertas only includes its non-empty sub-fields');
  assert.ok(!/Doente Fictício|123456789|987654321|910000000|doente@example\.com|Rua Fictícia/.test(sentPrompt),'never sends nome/SNS/NIF/telefone/email/morada');

  assert.ok(await page.evaluate(()=>!!document.querySelector('.clinical-ai-layout')),'side panel layout created');
  assert.ok(await page.evaluate(()=>!!document.querySelector('.clinical-ai-panel')),'side panel present');

  const sectionHeadings=await page.evaluate(()=>[...document.querySelectorAll('.clinical-ai-section h4')].map(h=>h.textContent));
  for (const heading of ['Alertas','Informação em falta','Exame objectivo a completar','HDA enriquecida','Hipóteses a considerar','Exames a ponderar','Tratamento / Programa de reabilitação','Objetivos','HEP']) {
    assert.ok(sectionHeadings.includes(heading), `section rendered: ${heading}`);
  }
  const panelHtml=await page.evaluate(()=>document.querySelector('[data-body]').innerHTML);
  assert.match(panelHtml,/Lateralidade inconsistente/,'alert title rendered');
  assert.match(panelHtml,/HDA refere ombro esquerdo/,'alert text rendered');
  assert.match(panelHtml,/Profissão\?/,'missing information question rendered');
  assert.match(panelHtml,/Síndrome subacromial/,'hypothesis rendered');
  assert.match(panelHtml,/Ecografia do ombro/,'suggested exam rendered');
  assert.match(panelHtml,/Fisioterapia orientada/,'treatment option rendered');
  assert.match(panelHtml,/Reduzir dor noturna/,'objective rendered');
  assert.match(panelHtml,/Pendulares de Codman/,'HEP suggestion rendered');
  const notePreview=await page.evaluate(()=>document.querySelector('.clinical-ai-note-preview').innerHTML);
  assert.match(notePreview,/<p>História actual<\/p>/,'clinical_note preview: paragraph');
  assert.match(notePreview,/<ul><li>Sem queixas<ul><li>Mantém autonomia<\/li><\/ul><\/li><\/ul>/,'clinical_note preview: bullet + indented bullet');
  assert.match(notePreview,/<ol><li>Reavaliar em 4 semanas<\/li><\/ol>/,'clinical_note preview: ordered');

  // "Exame objectivo a completar" is a heuristic client-side split of the SAME
  // missing_information array — history questions stay in "Informação em falta".
  const missingSplit=await page.evaluate(()=>{
    const headers=[...document.querySelectorAll('[data-body] .clinical-ai-section h4')];
    const infoSection=headers.find(h=>h.textContent==='Informação em falta')?.closest('.clinical-ai-section');
    const examSection=headers.find(h=>h.textContent==='Exame objectivo a completar')?.closest('.clinical-ai-section');
    return {
      info:[...(infoSection?.querySelectorAll('li')||[])].map(li=>li.textContent),
      exam:[...(examSection?.querySelectorAll('li')||[])].map(li=>li.textContent)
    };
  });
  assert.ok(missingSplit.info.includes('Profissão?'),'history question stays in Informação em falta');
  assert.ok(missingSplit.info.includes('Exames já realizados?'),'history question stays in Informação em falta');
  assert.ok(!missingSplit.info.some(t=>t.includes('LCA')),'exam item not duplicated in Informação em falta');
  assert.ok(missingSplit.exam.some(t=>t.includes('LCA')),'exam item (LCA/LCP/LLI) classified into Exame objectivo a completar');

  // Answering "missing_information" questions inline in the panel: local-only state
  // (never saved, never calls the API while typing, never touches the HDA).
  const answerTextareaCount=await page.evaluate(()=>document.querySelectorAll('[data-body] .clinical-ai-answer').length);
  assert.equal(answerTextareaCount,3,'one answer textarea per missing_information item (history + exam)');
  callsBefore=await page.evaluate(()=>calls.length);
  await page.evaluate(()=>{
    const li=[...document.querySelectorAll('[data-body] li')].find(li=>li.firstChild?.textContent==='Profissão?');
    const textarea=li.querySelector('.clinical-ai-answer');
    textarea.value='Enfermeira.';
    textarea.dispatchEvent(new Event('input',{bubbles:true}));
  });
  assert.equal(await page.evaluate(()=>calls.length),callsBefore,'typing an answer never calls the API');
  assert.equal(await page.evaluate(()=>content.editorHTML(q)),pasted,'typing an answer never touches the HDA');
  assert.equal(await page.evaluate(()=>{const li=[...document.querySelectorAll('[data-body] li')].find(li=>li.firstChild?.textContent==='Profissão?');return li.querySelector('.clinical-ai-answer-check').hidden}),false,'✓ indicator shown once answered');

  // Next analysis: the answer is bundled as a RESPOSTAS block; a resolved question
  // disappears from the new response and a fresh one raised by the answer can appear.
  await page.evaluate(()=>{window.aiResult={
    ...window.aiResult,
    missing_information:[
      {question:'Exames já realizados?',reason:'Não referidos no texto.'},
      {question:'Testes ligamentares (LCA/LCP/LLI)?',reason:'Não descritos no exame objectivo.'},
      {question:'Antecedentes familiares de patologia do ombro?',reason:'Nova dúvida levantada pela resposta dada.'}
    ]
  }});
  callsBefore=await page.evaluate(()=>calls.length);
  await page.getByRole('button',{name:'Atualizar análise',exact:true}).click();
  await page.waitForFunction(()=>[...document.querySelectorAll('[data-body] li')].some(li=>li.firstChild?.textContent==='Antecedentes familiares de patologia do ombro?'));
  assert.equal(await page.evaluate(()=>calls.length)-callsBefore,1,'"Atualizar análise" with an answer makes exactly one more call');
  const promptWithAnswer=await page.evaluate(()=>calls.at(-1).args.body.prompt);
  assert.match(promptWithAnswer,/RESPOSTAS ÀS PERGUNTAS DO ASSISTENTE:\n- Pergunta: Profissão\?\n {2}Resposta: Enfermeira\./,'prompt bundles the answer under RESPOSTAS ÀS PERGUNTAS DO ASSISTENTE');
  const questionsAfter=await page.evaluate(()=>[...document.querySelectorAll('[data-body] li')].map(li=>li.firstChild?.textContent));
  assert.ok(!questionsAfter.includes('Profissão?'),'resolved question disappears from the new analysis');
  assert.ok(questionsAfter.includes('Antecedentes familiares de patologia do ombro?'),'a new question raised by the answer can appear');
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('[data-body] .clinical-ai-answer')].every(t=>t.value==='')),true,'answers are cleared after a successful analysis');

  // Copy buttons: one per rendered section, read data only, never call the API or touch the HDA.
  const copyButtonCount=await page.evaluate(()=>document.querySelectorAll('[data-body] .clinical-ai-copy-row button').length);
  assert.equal(copyButtonCount,9,'one Copiar button per rendered section');
  callsBefore=await page.evaluate(()=>calls.length);
  const hdaBeforeCopy=await page.evaluate(()=>content.editorHTML(q));
  await page.evaluate(()=>{
    const heading=[...document.querySelectorAll('[data-body] h4')].find(h=>h.textContent==='HDA enriquecida');
    heading.closest('.clinical-ai-section').querySelector('.clinical-ai-copy-row button').click();
  });
  await page.waitForFunction(()=>window.__copies.length>0);
  assert.equal(await page.evaluate(()=>calls.length),callsBefore,'Copiar (HDA enriquecida) never calls the API');
  assert.equal(await page.evaluate(()=>content.editorHTML(q)),hdaBeforeCopy,'Copiar never touches the HDA');
  let copiedText=await page.evaluate(()=>window.__copies.at(-1));
  assert.ok(!/[<>]/.test(copiedText),'copied HDA text contains no HTML');
  assert.match(copiedText,/História actual/,'copied HDA text is readable PT-PT content');
  callsBefore=await page.evaluate(()=>calls.length);
  await page.evaluate(()=>{
    const heading=[...document.querySelectorAll('[data-body] h4')].find(h=>h.textContent==='Hipóteses a considerar');
    heading.closest('.clinical-ai-section').querySelector('.clinical-ai-copy-row button').click();
  });
  await page.waitForFunction(()=>window.__copies.length>1);
  assert.equal(await page.evaluate(()=>calls.length),callsBefore,'Copiar (hipóteses) never calls the API');
  copiedText=await page.evaluate(()=>window.__copies.at(-1));
  assert.ok(!/[<>]/.test(copiedText),'copied hypotheses text contains no HTML');
  assert.match(copiedText,/Síndrome subacromial/,'copied hypotheses text is readable');

  // "Copiar tudo": copies the whole visible analysis (section order preserved) as
  // text/html + text/plain, never calls the API, never touches the HDA, and never
  // includes buttons/inputs/textareas.
  callsBefore=await page.evaluate(()=>calls.length);
  await page.getByRole('button',{name:'Copiar tudo',exact:true}).click();
  await page.waitForFunction(()=>window.__copyAllWrites.length>0);
  assert.equal(await page.evaluate(()=>calls.length),callsBefore,'"Copiar tudo" never calls the API');
  assert.equal(await page.evaluate(()=>content.editorHTML(q)),pasted,'"Copiar tudo" never touches the HDA');
  let copyAll=await page.evaluate(()=>window.__copyAllWrites.at(-1));
  assert.ok(!/<button|<input|<textarea/i.test(copyAll.html),'copied HTML contains no buttons/inputs/textareas');
  assert.match(copyAll.html,/<h4>Alertas<\/h4>/,'copied HTML preserves section headings');
  assert.match(copyAll.html,/<strong>[^<]*Lateralidade inconsistente<\/strong>/,'copied HTML preserves bold');
  assert.match(copyAll.html,/<ul>|<ol>/,'copied HTML preserves lists');
  assert.match(copyAll.html,/<em>Cautela: /,'copied HTML preserves italics (Cautela)');
  assert.match(copyAll.plain,/^Alertas\n/,'copied plain text preserves section order/structure');
  assert.match(copyAll.plain,/Síndrome subacromial/,'copied plain text includes other sections');

  // Fallback: when ClipboardItem/write aren't available, "Copiar tudo" uses writeText.
  callsBefore=await page.evaluate(()=>calls.length);
  await page.evaluate(()=>{window.__savedClipboardItem=window.ClipboardItem;delete window.ClipboardItem;});
  const copiesBefore=await page.evaluate(()=>window.__copies.length);
  await page.getByRole('button',{name:'Copiar tudo',exact:true}).click();
  await page.waitForFunction(n=>window.__copies.length>n,copiesBefore);
  assert.equal(await page.evaluate(()=>calls.length),callsBefore,'"Copiar tudo" fallback never calls the API');
  assert.match(await page.evaluate(()=>window.__copies.at(-1)),/^Alertas\n/,'fallback writeText receives the plain-text version');
  await page.evaluate(()=>{window.ClipboardItem=window.__savedClipboardItem;});

  // Clicking a plain list item (e.g. a missing-information question) never calls the API.
  callsBefore=await page.evaluate(()=>calls.length);
  await page.evaluate(()=>document.querySelector('[data-body] li')?.click());
  assert.equal(await page.evaluate(()=>calls.length),callsBefore,'clicking a list item never calls the API');

  // "Manter original" on the clinical_note section preserves the HDA untouched.
  await page.getByRole('button',{name:'Manter original',exact:true}).click();
  assert.equal(await page.evaluate(()=>content.editorHTML(q)),pasted);

  // "Atualizar análise" makes exactly one more call and only replaces the panel content.
  callsBefore=await page.evaluate(()=>calls.length);
  await page.getByRole('button',{name:'Atualizar análise',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[data-counter]')?.textContent.includes('3 análises'));
  assert.equal(await page.evaluate(()=>calls.length)-callsBefore,1,'"Atualizar análise" makes exactly one more call');
  assert.equal(await page.evaluate(()=>content.editorHTML(q)),pasted,'HDA still untouched after a refresh alone');

  // "Aplicar à HDA" applies only clinical_note.blocks, nothing else, and can be undone.
  await page.getByRole('button',{name:'Aplicar à HDA',exact:true}).click();
  assert.equal(await page.evaluate(()=>content.editorHTML(q)),expectedStructured,'apply builds Quill content from clinical_note.blocks only');
  await page.getByRole('button',{name:'Desfazer',exact:true}).click();
  assert.equal(await page.evaluate(()=>content.editorHTML(q)),pasted,'undo after apply restores original');

  // Conflict: editing the HDA while a new analysis is in flight blocks "Aplicar à HDA".
  await page.evaluate(()=>window.delayAI=true);
  await page.getByRole('button',{name:'Atualizar análise',exact:true}).click();
  await page.waitForFunction(()=>window.resolveAI);
  await page.evaluate(()=>{q.insertText(0,'Alterado entretanto. ','user');resolveAI();});
  await page.waitForFunction(()=>document.querySelector('[data-counter]')?.textContent.includes('4 análises'));
  await page.getByRole('button',{name:'Aplicar à HDA',exact:true}).click();
  assert.match(await page.locator('.clinical-ai-note-status').innerText(),/alterado entretanto/);
  await page.getByRole('button',{name:'Manter original',exact:true}).click();
  await page.evaluate(()=>window.delayAI=false);

  // Adversarial: HTML/script-looking text in any AI field renders as literal text, never as markup.
  await page.evaluate(()=>{window.aiResult={
    clinical_note:{blocks:[{type:'paragraph',text:'Nota segura.',level:0}]},
    alerts:[{type:'warning',title:'<img src=x onerror="window.__xss=true">',text:'<script>window.__xss2=true<\/script>'}],
    missing_information:[],diagnostic_hypotheses:[],suggested_exams:[],treatment_options:[],objectives:[],hep_suggestions:[]
  }});
  await page.getByRole('button',{name:'Atualizar análise',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[data-body] h4')?.textContent==='Alertas');
  assert.equal(await page.evaluate(()=>window.__xss),undefined,'no script/handler from AI text ever executes');
  assert.equal(await page.evaluate(()=>document.querySelectorAll('[data-body] img,[data-body] script').length),0,'AI text never becomes real HTML elements');
  const alertOuterHtml=await page.evaluate(()=>document.querySelector('[data-body] .clinical-ai-alert-warning').outerHTML);
  assert.match(alertOuterHtml,/&lt;img/,'AI text is escaped (textContent), not parsed, when rendered');

  // API failure preserves the original HDA and shows an error in the panel.
  await page.evaluate(()=>window.aiFailure=true);
  await page.getByRole('button',{name:'Atualizar análise',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[data-status]').textContent.includes('Não foi possível'));
  assert.equal(await page.evaluate(()=>content.editorHTML(q)),pasted,'original preserved when the API call fails');
  await page.evaluate(()=>window.aiFailure=false);

  // Structurally invalid analysis (disallowed field) is rejected client-side too, never reaching the editor.
  await page.evaluate(()=>{window.aiResult={clinical_note:{blocks:[{type:'heading',text:'x',level:0}]}}});
  await page.getByRole('button',{name:'Atualizar análise',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[data-status]').textContent.includes('formato inesperado'));
  assert.equal(await page.evaluate(()=>content.editorHTML(q)),pasted,'invalid analysis never modifies the editor');

  await page.getByRole('button',{name:'Fechar',exact:true}).click();
  assert.equal(await page.evaluate(()=>!!document.querySelector('.clinical-ai-panel')),false,'panel closes');

  // Without a patient (e.g. no context available), the prompt is HDA-only — no empty CONTEXTO CONHECIDO section.
  await page.evaluate(async()=>{
    window.aiResult={clinical_note:{blocks:[{type:'paragraph',text:'Nota.',level:0}]},alerts:[],missing_information:[],diagnostic_hypotheses:[],suggested_exams:[],treatment_options:[],objectives:[],hep_suggestions:[]};
    const host=document.createElement('div');host.id='no-context-host';document.body.appendChild(host);
    const noContextQuill=new Quill(host,{theme:'snow',modules:{toolbar:[['bold'],[{list:'bullet'}]]}});
    noContextQuill.setText('Texto sem doente associado.','user');
    window.editor.enhanceClinicalEditor(noContextQuill,{ai:true,sb:()=>window.sb});
    await window.editor.openAiAssistant(noContextQuill,window.sb);
  });
  const noContextPrompt=await page.evaluate(()=>calls.at(-1).args.body.prompt);
  assert.equal(noContextPrompt,'HDA:\nTexto sem doente associado.','no patient ⇒ HDA-only prompt, no CONTEXTO CONHECIDO section at all');
  await page.evaluate(()=>{
    const host=document.querySelector('#no-context-host');
    host.previousElementSibling?.remove();
    host.remove();
  });

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
  console.log('PASS: UL, OL, mixed/nested and legacy lists; serialization/reopen/feed/report; Enter/Tab; paste; undo/redo; more visible "✦ Assistente clínico IA" trigger; side panel (one call per click, all 9 sections incl. Exame objectivo a completar split from Informação em falta, apply/keep/undo/conflict/failure/invalid-analysis/no-HTML-execution/close); inline answers to missing_information (no API call/no HDA change while typing, bundled as RESPOSTAS ÀS PERGUNTAS DO ASSISTENTE on the next call, resolved questions disappear/new ones can appear, cleared after a successful analysis); Copiar buttons (no API call, no HDA change, no HTML in copied text); Copiar tudo (ClipboardItem text/html+text/plain with writeText fallback, no API call, no HDA change, no buttons/inputs in copied HTML); prompt = HDA + non-identifying CONTEXTO CONHECIDO only (age/profissão/desporto/antecedentes/alertas, never nome/SNS/NIF/telefone/email/morada), omitted entirely without a patient; no AI for formatting; no HDA autosave on load.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
