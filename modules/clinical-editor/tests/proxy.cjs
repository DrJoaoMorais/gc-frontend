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
 assert.match(payload.instructions,/Não sugiras ecografia do joelho de forma rotineira/,'knee: ultrasound is not suggested routinely');
 assert.match(payload.instructions,/"condromalácia patelar" não deve aparecer como hipótese clínica provável sem suporte/,'knee: condromalácia not used without adequate support');
 assert.equal(payload.text.format.type,'json_schema');assert.equal(payload.text.format.strict,true);

 // A. PAPEL / ÂMBITO — dominant problem + associated domains + consultation context;
 // never assume PRM is musculoskeletal-only.
 assert.match(payload.instructions,/não apenas musculoesquelético, mas também neurológico, pavimento pélvico, pediátrico, geriátrico/,'assistant scope is explicitly not limited to musculoskeletal PRM');
 assert.match(payload.instructions,/problema clínico dominante \+ domínios associados justificados \+ contexto da consulta \+ pergunta clínica/,'core reasoning framework: dominant problem + associated domains + consultation context + clinical question');
 assert.match(payload.instructions,/nunca assumas por defeito que é musculoesquelético/,'never default to musculoskeletal when identifying the dominant problem');
 assert.match(payload.instructions,/cervicobraquialgia → cervical \+ neurológico\/membro superior/,'multi-domain example: cervicobraquialgia (cervical + neuro/upper limb)');
 assert.match(payload.instructions,/lombociatalgia → lombar \+ neurológico\/membro inferior/,'multi-domain example: lombociatalgia (lombar + neuro/lower limb)');
 assert.match(payload.instructions,/Nunca actives um domínio só por proximidade anatómica ou hábito/,'no opening a clinical domain merely by anatomical proximity or habit');
 assert.match(payload.instructions,/Esta coerência aplica-se a missing_information, diagnostic_hypotheses, suggested_exams, treatment_options, objectives e hep_suggestions/,'domain coherence explicitly covers all 6 reasoning sections, including missing_information');

 // B. FIDELIDADE — absence of information is never converted into normality;
 // ambiguity is never resolved silently.
 assert.match(payload.instructions,/Nunca preenchas uma lacuna como "normal" para parecer mais completo/,'never fill a gap as "normal" just to look more complete');
 assert.match(payload.instructions,/nunca corrijas silenciosamente informação contraditória/,'never silently correct contradictory information');
 assert.match(payload.instructions,/Perante dúvida real, alerta, pergunta, ou mantém a incerteza — nunca assumas em silêncio/,'genuine doubt must be flagged, asked, or left uncertain — never silently assumed');

 // C. ANAMNESE VS. EXAME OBJECTIVO — negated symptoms never become objective findings;
 // objective exam only from what was explicitly observed/tested.
 assert.match(payload.instructions,/"sem fraqueza referida" não é "força preservada"/,'anamnesis negation (weakness) must not become an objective finding');
 assert.match(payload.instructions,/"sem parestesias" não é "sensibilidade normal"/,'anamnesis negation (parestesias) must not become an objective finding');
 assert.match(payload.instructions,/Só escreve no exame objectivo o que foi explicitamente observado ou testado pelo médico; a ausência de descrição não significa normalidade/,'objective exam only from what was explicitly observed/tested — absence of description is not normality');

 // D. CONTEXTO — teleconsultation/home context never implies impossible maneuvers;
 // "not assessed" is never the same as "normal".
 assert.match(payload.instructions,/teleconsulta domiciliária de doente acamado não deve gerar testes ortopédicos presenciais/,'teleconsultation/home context must not generate impossible in-person manoeuvres');
 assert.match(payload.instructions,/Não confundas limitação do contexto com ausência de achados/,'context limitation must never be confused with absence of findings');
 assert.match(payload.instructions,/não o escrevas como normal — identifica-o como não avaliado, e sugere avaliação presencial se clinicamente necessária/,'"not evaluated" due to context must never be written as "normal"');

 // E. EXAMES — modality chosen by the clinical question, not limited to X-ray/echo/MRI;
 // explicit possibility of requesting no exam at this stage.
 assert.match(payload.instructions,/escolhendo a modalidade pela pergunta clínica que precisa de resposta, nunca por hábito ou por ser comum numa região/,'exam modality is chosen by the clinical question, never by habit/regional custom');
 assert.match(payload.instructions,/Não te limites a radiografia\/ecografia\/RM/,'not limited to X-ray/ultrasound/MRI');
 assert.match(payload.instructions,/TC, EMG\/estudos de condução nervosa, densitometria, estudos urodinâmicos, avaliação biomecânica\/da marcha, análises laboratoriais/,'broader exam spectrum explicitly referenced (CT, EMG/nerve conduction, densitometry, urodynamics, gait/biomechanics, lab work)');
 assert.match(payload.instructions,/quando não houver indicação, diz explicitamente que não são necessários de imediato/,'explicit possibility of stating no exams are needed at this stage');

 // F. HDA / clinical_note — anamnesis only; never objective exam, AI hypotheses,
 // suggested exams, treatment, objectives or HEP.
 assert.match(payload.instructions,/clinical_note só pode conter: informação de anamnese fornecida na HDA original/,'clinical_note is restricted to anamnesis-only content');
 assert.match(payload.instructions,/Nunca incluas no clinical_note: achados de exame objectivo \(referidos pelo médico ou nas respostas às perguntas\); hipóteses diagnósticas geradas pela IA; exames sugeridos; tratamento sugerido; objectivos sugeridos; HEP sugerido/,'clinical_note must never contain objective exam findings, AI hypotheses, suggested exams, treatment, objectives or HEP');

 // G. RESPOSTAS DO MÉDICO — anamnesis-type answers may enrich clinical_note;
 // objective-exam-type answers never do, but both update reasoning; no repeated questions.
 assert.match(payload.instructions,/Classifica semanticamente cada resposta antes de decidir onde a usar; estar escrita numa resposta não a torna automaticamente anamnese/,'each doctor answer must be semantically classified before use — being an "answer" does not make it anamnesis');
 assert.match(payload.instructions,/Se for informação de anamnese \(ex\.: "dor há 8 meses"; "sem bloqueios"; "piora nas escadas"\), podes usá-la para enriquecer o clinical_note\/HDA/,'anamnesis-type answer may enrich clinical_note');
 assert.match(payload.instructions,/Se for informação de exame objectivo \(ex\.: "Spurling negativo"; "Lachman negativo"; "força C6 4\/5"; "reflexo tricipital diminuído"\), nunca a incluas no clinical_note\/HDA — usa-a apenas para actualizar hipóteses, exames, tratamento, alertas e o raciocínio clínico/,'objective-exam-type answer never enters clinical_note but updates hypotheses/exams/treatment/alerts/reasoning');
 assert.match(payload.instructions,/não repitas em missing_information nenhuma pergunta já respondida/,'an already-answered question must not reappear in missing_information');

 // H. ACTUALIZAÇÕES — unambiguous later correction prevails; anamnesis corrections may
 // update clinical_note, objective-exam corrections update reasoning but never clinical_note;
 // ambiguity generates an alert instead of a silent choice.
 assert.match(payload.instructions,/quando uma frase posterior corrigir claramente uma afirmação anterior, considera a informação mais recente como o estado actual/,'an unambiguous later correction prevails over the earlier statement');
 assert.match(payload.instructions,/correcções ou complementos de ANAMNESE \(ex\.: "sem traumatismo" seguido de "trauma há 3 semanas, em queda de bicicleta"\) podem e devem actualizar o clinical_note\/HDA/,'anamnesis-type corrections may and should update clinical_note/HDA');
 assert.match(payload.instructions,/Resultados ou correcções de EXAME OBJECTIVO \(ex\.: "não foram realizados testes ligamentares" seguido de "LCA, LCP e LLI negativos"\) devem actualizar hipóteses, exames, tratamento, alertas e todo o raciocínio clínico, mas nunca ser inseridos no clinical_note\/HDA/,'objective-exam-type corrections update reasoning but must never be inserted into clinical_note/HDA');
 assert.match(payload.instructions,/não escolhas silenciosamente uma versão: cria um alert de inconsistência/,'ambiguous correction generates an alert instead of a silent choice');

 // I. BASE DE CONHECIMENTO — no active RAG/external search yet; never fabricate
 // guidelines/DOIs/URLs/evidence levels.
 assert.match(payload.instructions,/nesta fase não existe pesquisa externa\/RAG activo/,'no active RAG/external search at this stage');
 assert.match(payload.instructions,/não afirmes que uma recomendação é suportada por uma guideline, sociedade científica ou nível de evidência específico se essa fonte não tiver sido fornecida no contexto/,'never claim guideline/society/evidence-level support unless that source was actually provided in context');
 assert.match(payload.instructions,/Nunca inventes referências, citações, DOIs, URLs, guidelines ou consensos/,'never invent references, citations, DOIs, URLs, guidelines or consensus statements');

 assert.match(payload.instructions,/RESPOSTAS DO MÉDICO ÀS PERGUNTAS DO ASSISTENTE/,'instructions explain how to treat doctor answers bundled in the prompt');

 // A prompt carrying a "RESPOSTAS ÀS PERGUNTAS DO ASSISTENTE:" block (built client-side from
 // in-panel answers) is opaque to the backend — passed straight through as 'input', unaffected.
 const promptWithAnswers='HDA:\nTexto fictício.\n\nRESPOSTAS ÀS PERGUNTAS DO ASSISTENTE:\n- Pergunta: Profissão?\n  Resposta: Enfermeira.';
 result=await handler(request({mode:'estruturar',prompt:promptWithAnswers}));assert.equal(result.status,200);
 const upstreamAnswers=calls.at(-1);
 assert.equal(JSON.parse(upstreamAnswers.opts.body).input,promptWithAnswers,'prompt with RESPOSTAS section passed through unchanged as input');

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
