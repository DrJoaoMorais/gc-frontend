const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 const {createHandler}=await import('data:text/javascript;base64,'+fs.readFileSync('supabase/functions/ai-proxy/handler.js').toString('base64'));
 let calls=[],loggedIn=true,doctor=true,key=true,upstreamStatus=200,incomplete=false;
 let outputText=JSON.stringify({blocks:[{type:'paragraph',text:'Texto fictício.',level:0}]});
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

 // Happy path: 'estruturar' asks OpenAI for a strict json_schema of blocks and returns them validated.
 let result=await handler(request());assert.equal(result.status,200);
 assert.deepEqual((await result.json()).blocks,[{type:'paragraph',text:'Texto fictício.',level:0}]);
 const upstream=calls.at(-1);assert.equal(upstream.url,'https://api.openai.com/v1/responses');
 const payload=JSON.parse(upstream.opts.body);
 assert.equal(payload.store,false);assert.equal(payload.model,'gpt-4.1-mini-2025-04-14');
 assert.match(payload.instructions,/Não omitas/);
 assert.match(payload.instructions,/nunca incluas HTML, Markdown/);
 assert.equal(payload.text.format.type,'json_schema');assert.equal(payload.text.format.strict,true);

 incomplete=true;assert.equal((await handler(request())).status,502);incomplete=false;
 upstreamStatus=429;assert.equal((await handler(request())).status,429);upstreamStatus=200;
 assert.ok(!calls.some(x=>x.url.includes('anthropic')));

 // Structured validation: reject invalid JSON, disallowed type, invalid level, empty/missing blocks —
 // never a silent fallback to free text.
 outputText='isto não é JSON válido {';
 assert.equal((await handler(request())).status,502);
 outputText=JSON.stringify({blocks:[{type:'heading',text:'x',level:0}]});
 assert.equal((await handler(request())).status,502,'disallowed block type must be rejected');
 outputText=JSON.stringify({blocks:[{type:'bullet',text:'x',level:3}]});
 assert.equal((await handler(request())).status,502,'level out of range must be rejected');
 outputText=JSON.stringify({blocks:[{type:'bullet',text:'x',level:1.5}]});
 assert.equal((await handler(request())).status,502,'non-integer level must be rejected');
 outputText=JSON.stringify({blocks:[{type:'paragraph',text:'x',level:1}]});
 assert.equal((await handler(request())).status,502,'paragraph with non-zero level must be rejected');
 outputText=JSON.stringify({blocks:[]});
 assert.equal((await handler(request())).status,502,'empty blocks must be rejected as an empty proposal');
 outputText=JSON.stringify({not_blocks:[]});
 assert.equal((await handler(request())).status,502,'missing blocks key must be rejected');

 // Mixed + indented blocks round-trip correctly when valid.
 outputText=JSON.stringify({blocks:[
   {type:'paragraph',text:'Intro.',level:0},
   {type:'bullet',text:'Item 1',level:0},
   {type:'bullet',text:'Sub item',level:1},
   {type:'ordered',text:'Passo 1',level:0}
 ]});
 result=await handler(request());assert.equal(result.status,200);
 assert.equal((await result.json()).blocks.length,4);

 // Legacy free-text modes stay unaffected: plain {text}, no json_schema on the OpenAI request.
 outputText='Texto livre optimizado.';
 result=await handler(request({mode:'optimizar',prompt:'Texto.'}));
 assert.equal(result.status,200);
 assert.equal((await result.json()).text,'Texto livre optimizado.');
 const legacyPayload=JSON.parse(calls.at(-1).opts.body);
 assert.equal(legacyPayload.text,undefined,'legacy modes must not request structured output');

 console.log('PASS: authentication, doctor authorization, missing key, limits, OpenAI only, no storage, incomplete response, quota failures, structured block validation (invalid JSON/type/level/empty/missing), mixed/indented blocks, and unaffected legacy free-text modes.');
})();
