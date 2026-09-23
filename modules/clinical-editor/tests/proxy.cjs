const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 const {createHandler}=await import('data:text/javascript;base64,'+fs.readFileSync('supabase/functions/ai-proxy/handler.js').toString('base64'));
 let calls=[],loggedIn=true,doctor=true,key=true,upstreamStatus=200,incomplete=false;
 const handler=createHandler({env:n=>n==='OPENAI_API_KEY'?(key?'test-key':''):n==='SUPABASE_URL'?'https://test.supabase.co':'test-anon',fetchImpl:async(url,opts)=>{
 calls.push({url,opts});
 if(url.endsWith('/auth/v1/user'))return Response.json(loggedIn?{id:'test-doctor'}:{},{status:loggedIn?200:401});
 if(url.includes('/rest/v1/clinic_members'))return Response.json(doctor?[{clinic_id:'test-clinic'}]:[]);
 return Response.json({status:incomplete?'incomplete':'completed',output:[{type:'message',content:[{type:'output_text',text:'Proposta fictícia.'}]}]},{status:upstreamStatus});
 }});
 const request=(body={mode:'estruturar',prompt:'Texto fictício.'},auth=true)=>new Request('https://test/functions/v1/ai-proxy',{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer test'}:{})},body:JSON.stringify(body)});
 assert.equal((await handler(request(undefined,false))).status,401);assert.equal(calls.length,0);
 loggedIn=false;assert.equal((await handler(request())).status,401);loggedIn=true;
 doctor=false;assert.equal((await handler(request())).status,403);doctor=true;
 key=false;assert.equal((await handler(request())).status,503);key=true;
 assert.equal((await handler(request({prompt:'x'.repeat(24001)}))).status,400);
 assert.equal((await handler(request({prompt:'x',mode:'unexpected'}))).status,400);
 assert.ok(!calls.some(x=>x.url.includes('api.openai')));
 let result=await handler(request());assert.equal(result.status,200);assert.equal((await result.json()).text,'Proposta fictícia.');
 const upstream=calls.at(-1);assert.equal(upstream.url,'https://api.openai.com/v1/responses');
 const payload=JSON.parse(upstream.opts.body);assert.equal(payload.store,false);assert.equal(payload.model,'gpt-4.1-mini-2025-04-14');assert.match(payload.instructions,/Não omitas/);
 incomplete=true;assert.equal((await handler(request())).status,502);incomplete=false;
 upstreamStatus=429;assert.equal((await handler(request())).status,429);
 assert.ok(!calls.some(x=>x.url.includes('anthropic')));
 console.log('PASS: authentication, doctor authorization, missing key, limits, OpenAI only, no storage, incomplete response and quota failures.');
})();
