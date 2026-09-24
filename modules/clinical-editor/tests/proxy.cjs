const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 const {createHandler}=await import('data:text/javascript;base64,'+fs.readFileSync('supabase/functions/ai-proxy/handler.js').toString('base64'));
 let calls=[],loggedIn=true,doctor=true,key=true,upstreamStatus=200,incomplete=false;

 // Minimal valid analysis: clinical_note is mandatory, the 7 support sections may be empty.
 const baseAnalysis=()=>({
   clinical_note:{blocks:[{type:'paragraph',text:'Texto fictício.',level:0}]},
   alerts:[],missing_information:[],diagnostic_hypotheses:[],
   suggested_exams:[],treatment_options:[],objectives:[],hep_suggestions:[]
 });
 let outputText=JSON.stringify(baseAnalysis());

 const handler=createHandler({env:n=>n==='OPENAI_API_KEY'?(key?'test-key':''):n==='SUPABASE_URL'?'https://test.supabase.co':'test-anon',fetchImpl:async(url,opts)=>{
 calls.push({url,opts});
 if(url.endsWith('/auth/v1/user'))return Response.json(loggedIn?{id:'test-doctor'}:{},{status:loggedIn?200:401});
 if(url.includes('/rest/v1/clinic_members'))return Response.json(doctor?[{clinic_id:'test-clinic'}]:[]);
 return Response.json({status:incomplete?'incomplete':'completed',output:[{type:'message',content:[{type:'output_text',text:outputText}]}]},{status:upstreamStatus});
 }});
 const request=(body={mode:'estruturar',prompt:'Texto fictício.'},auth=true)=>new Request('https://test/functions/v1/ai-proxy',{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer test'}:{})},body:JSON.stringify(body)});

 assert.equal((await handler(request(undefined,false))).status,401);assert.equal(calls.length,0);
 loggedIn=false;assert.equal((await handler(request())).status,401);loggedIn=true;
 doctor=false;assert.equal((await handler(request())).status,403);doctor=true;
 key=false;assert.equal((await handler(request())).status,503);key=true;
 assert.equal((await handler(request({prompt:'x'.repeat(24001)}))).status,400);
 assert.equal((await handler(request({prompt:'x',mode:'unexpected'}))).status,400);
 assert.ok(!calls.some(x=>x.url.includes('api.openai')));

 // Happy path: 'estruturar' asks OpenAI for a strict json_schema and returns the full analysis validated.
 let result=await handler(request());assert.equal(result.status,200);
 let body=await result.json();
 assert.deepEqual(body.clinical_note,{blocks:[{type:'paragraph',text:'Texto fictício.',level:0}]},'clinical_note válido');
 assert.deepEqual(body.alerts,[]);assert.deepEqual(body.missing_information,[]);
 assert.deepEqual(body.diagnostic_hypotheses,[]);assert.deepEqual(body.suggested_exams,[]);
 assert.deepEqual(body.treatment_options,[]);assert.deepEqual(body.objectives,[]);assert.deepEqual(body.hep_suggestions,[],'arrays vazias válidas');
 const upstream=calls.at(-1);assert.equal(upstream.url,'https://api.openai.com/v1/responses');
 const payload=JSON.parse(upstream.opts.body);
 assert.equal(payload.store,false);assert.equal(payload.model,'gpt-4.1-mini-2025-04-14');
 assert.match(payload.instructions,/omitas informação/);
 assert.match(payload.instructions,/hep_suggestions/);
 assert.match(payload.instructions,/CONTEXTO CONHECIDO/,'instructions explain the HDA/CONTEXTO CONHECIDO split');
 assert.match(payload.instructions,/EXCLUSIVAMENTE a informação da secção "HDA:"/,'clinical_note is scoped to HDA only');
 assert.match(payload.instructions,/Nunca perguntes algo que já esteja respondido/,'missing_information must not ask about known context');
 assert.equal(payload.text.format.type,'json_schema');assert.equal(payload.text.format.strict,true);

 incomplete=true;assert.equal((await handler(request())).status,502);incomplete=false;
 upstreamStatus=429;assert.equal((await handler(request())).status,429);upstreamStatus=200;
 assert.ok(!calls.some(x=>x.url.includes('anthropic')));

 // Each of the 7 support sections, filled, round-trips correctly.
 outputText=JSON.stringify({...baseAnalysis(),alerts:[{type:'inconsistency',title:'Lateralidade inconsistente',text:'HDA refere esquerdo; exame refere direito.'}]});
 body=await (await handler(request())).json();
 assert.deepEqual(body.alerts,[{type:'inconsistency',title:'Lateralidade inconsistente',text:'HDA refere esquerdo; exame refere direito.'}],'alerts preenchido');

 outputText=JSON.stringify({...baseAnalysis(),missing_information:[{question:'Profissão?',reason:'Relevante para carga funcional.'}]});
 body=await (await handler(request())).json();
 assert.deepEqual(body.missing_information,[{question:'Profissão?',reason:'Relevante para carga funcional.'}],'missing_information');

 outputText=JSON.stringify({...baseAnalysis(),diagnostic_hypotheses:[{label:'Síndrome subacromial',reason:'Testes de conflito positivos.',confidence:'moderate'}]});
 body=await (await handler(request())).json();
 assert.deepEqual(body.diagnostic_hypotheses,[{label:'Síndrome subacromial',reason:'Testes de conflito positivos.',confidence:'moderate'}],'diagnostic_hypotheses');

 outputText=JSON.stringify({...baseAnalysis(),suggested_exams:[{exam:'Ecografia do ombro',reason:'Caracterizar manguito rotador.'}]});
 body=await (await handler(request())).json();
 assert.deepEqual(body.suggested_exams,[{exam:'Ecografia do ombro',reason:'Caracterizar manguito rotador.'}],'suggested_exams');

 outputText=JSON.stringify({...baseAnalysis(),treatment_options:[{item:'Fisioterapia orientada ao manguito rotador',reason:'Padrão compatível com conflito subacromial.'}]});
 body=await (await handler(request())).json();
 assert.deepEqual(body.treatment_options,[{item:'Fisioterapia orientada ao manguito rotador',reason:'Padrão compatível com conflito subacromial.'}],'treatment_options');

 outputText=JSON.stringify({...baseAnalysis(),objectives:[{item:'Reduzir dor noturna'}]});
 body=await (await handler(request())).json();
 assert.deepEqual(body.objectives,[{item:'Reduzir dor noturna'}],'objectives');

 outputText=JSON.stringify({...baseAnalysis(),hep_suggestions:[{exercise:'Pendulares de Codman',reason:'Mobilização suave inicial.',caution:'Suspender se agravar a dor noturna.'}]});
 body=await (await handler(request())).json();
 assert.deepEqual(body.hep_suggestions,[{exercise:'Pendulares de Codman',reason:'Mobilização suave inicial.',caution:'Suspender se agravar a dor noturna.'}],'hep_suggestions');

 // Structural rejection: never a partial/silent fallback — the whole response is rejected.
 outputText='isto não é JSON válido {';
 assert.equal((await handler(request())).status,502,'resposta estrutural inválida (JSON malformado) rejeitada');
 outputText=JSON.stringify({...baseAnalysis(),clinical_note:{blocks:[{type:'heading',text:'x',level:0}]}});
 assert.equal((await handler(request())).status,502,'block inválido (type não permitido)');
 outputText=JSON.stringify({...baseAnalysis(),clinical_note:{blocks:[]}});
 assert.equal((await handler(request())).status,502,'clinical_note.blocks vazio é rejeitado (nunca pode ficar vazio)');
 outputText=JSON.stringify({...baseAnalysis(),diagnostic_hypotheses:[{label:'X',reason:'Y',confidence:'certain'}]});
 assert.equal((await handler(request())).status,502,'confidence inválida');
 outputText=JSON.stringify({...baseAnalysis(),alerts:[{type:'critical',title:'X',text:'Y'}]});
 assert.equal((await handler(request())).status,502,'alert type inválido');
 outputText=JSON.stringify({...baseAnalysis(),extra_top_level_field:'não devia estar aqui'});
 assert.equal((await handler(request())).status,502,'campo extra inválido no topo é rejeitado');
 outputText=JSON.stringify({...baseAnalysis(),objectives:[{item:'X',extra:'não devia estar aqui'}]});
 assert.equal((await handler(request())).status,502,'campo extra inválido num item é rejeitado');
 outputText=JSON.stringify({clinical_note:baseAnalysis().clinical_note});
 assert.equal((await handler(request())).status,502,'secções em falta são rejeitadas (todas as 8 chaves são obrigatórias)');

 // Full example from the shoulder case: clinical_note + both expected alerts + a missing-information gap,
 // never inventing exams that weren't mentioned in the source text.
 const shoulderPrompt=`Dor no ombro esquerdo com 3 meses de evolução, sem história traumática ou de esforço.
Evolução progressiva.
Fez AINE com alívio parcial.
Períodos de dor nocturna.
Máximo de dor 7.

OMBRO DIREITO — EXAME OBJECTIVO

EVA: Repouso 3 | Actividade 5 | Pico 7
Dor noturna: Não
Bursa subacromial: Dor
Supra-espinhoso: Dor
Força MRC global 4/5 por dor.
Amplitude articular completa.
Neer ++
Hawkins ++
Jobe ++`;
 outputText=JSON.stringify({
   clinical_note:{blocks:[
     {type:'paragraph',text:'Dor no ombro esquerdo com 3 meses de evolução, sem história traumática ou de esforço. Evolução progressiva.',level:0},
     {type:'paragraph',text:'Fez AINE com alívio parcial. Períodos de dor nocturna. Máximo de dor 7.',level:0},
     {type:'paragraph',text:'Exame objectivo do ombro direito: EVA repouso 3, actividade 5, pico 7. Dor nocturna: não. Dor à palpação da bursa subacromial e do supra-espinhoso. Força MRC global 4/5 por dor. Amplitude articular completa. Neer, Hawkins e Jobe positivos.',level:0}
   ]},
   alerts:[
     {type:'inconsistency',title:'Lateralidade inconsistente',text:'A HDA refere ombro esquerdo; o exame objectivo refere ombro direito.'},
     {type:'inconsistency',title:'Dor nocturna contraditória',text:'A HDA refere períodos de dor nocturna; o exame objectivo regista dor nocturna como "Não".'}
   ],
   missing_information:[
     {question:'Profissão?',reason:'Não referida; relevante para exigência funcional do ombro.'},
     {question:'Exames já realizados?',reason:'Não referidos no texto.'}
   ],
   diagnostic_hypotheses:[{label:'Síndrome subacromial / conflito',reason:'Neer, Hawkins e Jobe positivos com dor à bursa subacromial e ao supra-espinhoso.',confidence:'moderate'}],
   suggested_exams:[{exam:'Ecografia do ombro',reason:'Caracterizar estruturas do manguito rotador dado o padrão de conflito.'}],
   treatment_options:[{item:'Fisioterapia orientada ao manguito rotador',reason:'Padrão clínico compatível com síndrome subacromial.'}],
   objectives:[{item:'Reduzir dor nocturna'},{item:'Recuperar força do supra-espinhoso'}],
   hep_suggestions:[]
 });
 result=await handler(request({mode:'estruturar',prompt:shoulderPrompt}));
 assert.equal(result.status,200);
 body=await result.json();
 assert.ok(body.alerts.some(a=>/[Ll]ateralidade/.test(a.title)),'alerta de lateralidade esquerda/direita');
 assert.ok(body.alerts.some(a=>/noturn|nocturn/i.test(a.title)),'alerta de dor noturna contraditória');
 assert.ok(body.missing_information.length>0,'alguma informação clínica em falta');
 assert.ok(body.clinical_note.blocks.length>0,'clinical_note estruturado');
 assert.deepEqual(body.suggested_exams.map(e=>e.exam),['Ecografia do ombro'],'nunca inventa exames como já realizados — só sugestões explícitas do modelo, nada inferido pelo código');

 // Legacy free-text modes stay unaffected: plain {text}, no json_schema on the OpenAI request.
 outputText='Texto livre optimizado.';
 result=await handler(request({mode:'optimizar',prompt:'Texto.'}));
 assert.equal(result.status,200);
 assert.equal((await result.json()).text,'Texto livre optimizado.');
 let legacyPayload=JSON.parse(calls.at(-1).opts.body);
 assert.equal(legacyPayload.text,undefined,'optimizar não pede saída estruturada');
 result=await handler(request({mode:'junta',prompt:'Texto.'}));
 assert.equal(result.status,200);
 assert.equal((await result.json()).text,'Texto livre optimizado.');
 legacyPayload=JSON.parse(calls.at(-1).opts.body);
 assert.equal(legacyPayload.text,undefined,'junta não pede saída estruturada');
 result=await handler(request({mode:'tribunal',prompt:'Texto.'}));
 assert.equal(result.status,200);
 assert.equal((await result.json()).text,'Texto livre optimizado.');
 legacyPayload=JSON.parse(calls.at(-1).opts.body);
 assert.equal(legacyPayload.text,undefined,'tribunal não pede saída estruturada');

 console.log('PASS: auth/authz/limits/quota (unchanged); estruturar → clinical_note + 7 secções validadas (preenchidas e vazias), rejeição de JSON inválido/block inválido/confidence inválida/alert type inválido/campo extra (topo e item)/secções em falta/nota vazia; instruções explicam a separação HDA/CONTEXTO CONHECIDO; caso do ombro (lateralidade, dor noturna, lacunas, nota, sem exames inventados); optimizar/junta/tribunal inalterados.');
})();
