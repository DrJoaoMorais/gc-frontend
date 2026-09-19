const {chromium}=require('playwright');
const {createFixture}=require('./fixture.cjs');
const assert=require('node:assert/strict');
(async()=>{
 const {db,ids,role,rpc}=await createFixture();
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1280,height:1000}});
 const failures=[];context.on('page',p=>p.on('pageerror',e=>failures.push(e.message)));
 try {
 await context.route('https://**/*',r=>r.abort());
 let calls=[];
 await context.route('**/__test_rpc',async route=>{
   const {name,args}=route.request().postDataJSON();calls.push(name);
   const params={therapist_scale_create:['p_assessment','p_ids','p_instructions','p_reference','p_token','p_request_id'],therapist_scale_list:['p_consultation'],therapist_scale_context:['p_token'],therapist_scale_save:['p_token','p_revision','p_answers','p_respondent','p_complete'],therapist_scale_revoke:['p_id']}[name];
   try {await role(['therapist_scale_context','therapist_scale_save'].includes(name)?'anon':'authenticated',ids.u);const data=await rpc(name,params.map(k=>args[k]));await route.fulfill({json:{data,error:null}});}catch(e){await route.fulfill({json:{data:null,error:{message:e.message}}});}
 });
 await context.addInitScript(({ids})=>{
   window.supabase={createClient:()=>({rpc:async(name,args)=>{const res=await fetch('/__test_rpc',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name,args})});return res.json();},auth:{getUser:async()=>({data:{user:{id:ids.u}}})},from:()=>{const q={op:'read',select(){return this},eq(){return this},update(){this.op='write';return this},insert(){this.op='write';return this},async single(){return {data:this.op==='read'?{data:{},assessment_side:null,assessment_date:new Date().toISOString().slice(0,10)}:{id:ids.a}}}};return q;}})};
 },{ids});
 const base=process.env.BASE_URL||'http://127.0.0.1:8766';
 const staff=await context.newPage();
 await staff.goto(`${base}/modules/obj/regiao.html?r=teleconsulta&p=${ids.p}&c=${ids.c}&s=${ids.v}&a=${ids.a}`);
 await staff.locator('[data-tab="pedidos"]').click();
 await staff.locator('[data-ver-escala="barthel"]').click();
 const preview=staff.frameLocator('dialog iframe');await preview.locator('h1').filter({hasText:'Barthel'}).waitFor();assert.equal(await preview.locator('input[type=radio]:checked').count(),0);
 assert.equal(await staff.locator('[data-pedido="barthel"]').isChecked(),false);
 await staff.locator('dialog button').filter({hasText:'Fechar'}).click();
 await staff.locator('[data-pedido="barthel"]').check();await staff.locator('[data-pedido="tug"]').check();
 await staff.locator('#therapist-reference').fill('Caso de teste');
 await staff.locator('#therapist-create').click();await staff.locator('#therapist-link:not([hidden])').waitFor();
 const link=await staff.locator('#therapist-url').inputValue();assert.ok(/#t=[a-f0-9]{64}$/.test(link));assert.ok(!link.includes(ids.p));
 const phone=await context.newPage();await phone.setViewportSize({width:390,height:844});await phone.goto(link);
 await phone.locator('#meta_name').fill('Terapeuta teste');await phone.locator('#meta_profession').fill('Fisioterapeuta');await phone.locator('#meta_date').fill(new Date().toISOString().slice(0,10));await phone.locator('#attested').check();await phone.locator('#next').click();
 await phone.locator('h1').filter({hasText:'Barthel'}).waitFor();
 await phone.locator('input[name=status][value=done]').check();
 await phone.locator('#next').click();await phone.locator('#error').filter({hasText:'Preenche'}).waitFor();
 assert.match(await phone.locator('#total').textContent(),/incompleta/);
 for(const group of await phone.locator('#fields [data-field]').all()) await group.locator('input').last().check();
 assert.match(await phone.locator('#total').textContent(),/100\/100/);
 await phone.locator('#next').click();await phone.locator('h1').filter({hasText:'TUG'}).waitFor();
 await phone.locator('input[name=status][value=done]').check();await phone.locator('[data-field=tempo]').fill('14.25');await phone.locator('[data-field=auxiliar] input').nth(3).check();await phone.locator('[data-field=ajuda] input').nth(1).check();await phone.locator('[data-field=contexto] input').nth(0).check();await phone.locator('[data-field=protocolo] input').nth(0).check();
 assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await phone.locator('#save').click();await phone.locator('#saved').filter({hasText:'Respostas guardadas'}).waitFor();
 await phone.reload();await phone.locator('#meta_name').waitFor();assert.equal(await phone.locator('#meta_name').inputValue(),'Terapeuta teste');await phone.locator('#next').click();await phone.locator('h1').filter({hasText:'Barthel'}).waitFor();assert.match(await phone.locator('#total').textContent(),/100\/100/);await phone.locator('#next').click();await phone.locator('[data-field=tempo]').waitFor();assert.equal(await phone.locator('[data-field=tempo]').inputValue(),'14.25');
 if(process.env.SCREENSHOT_PATH)await phone.screenshot({path:process.env.SCREENSHOT_PATH,fullPage:true});
 await phone.locator('#next').click();await phone.locator('h1').filter({hasText:'Avaliações enviadas'}).waitFor();
 await phone.reload();await phone.locator('h1').filter({hasText:'já enviada'}).waitFor();
 await staff.locator('#therapist-refresh').click();await staff.locator('summary').filter({hasText:'Ver respostas'}).click();await staff.locator('.therapist-result').waitFor();assert.ok((await staff.locator('.therapist-result').textContent()).includes('100/100'));assert.ok((await staff.locator('.therapist-result').textContent()).includes('14.25'));
 // Direct completion uses the same persisted, attributed evaluation.
 await staff.locator('#therapist-direct').click();
 const direct=staff.frameLocator('dialog iframe');
 await direct.locator('#meta_name').fill('Médico teste');await direct.locator('#meta_profession').fill('Médico');await direct.locator('#meta_date').fill(new Date().toISOString().slice(0,10));await direct.locator('#attested').check();await direct.locator('#next').click();
 await direct.locator('input[name=status][value=done]').check();
 for(const group of await direct.locator('#fields [data-field]').all())await group.locator('input').last().check();
 await direct.locator('#next').click();
 await direct.locator('input[name=status][value=not_done]').check();await direct.locator('#reason').fill('Não indicado nesta avaliação');
 assert.equal(await direct.locator('#next').textContent(),'Guardar avaliações na consulta');
 await direct.locator('#next').click();await direct.locator('h1').filter({hasText:'guardadas na consulta'}).waitFor();
 await staff.locator('dialog button').filter({hasText:'Guardar e fechar'}).click();
 await staff.locator('summary').filter({hasText:'Ver respostas'}).first().click();
 await staff.locator('.therapist-result').filter({hasText:'Médico teste'}).waitFor();
 assert.ok((await staff.locator('.therapist-result').filter({hasText:'Médico teste'}).textContent()).includes('100/100'));
 // All other previews open without selected scores and repeated muscle rows remain independent.
 for(const id of ['sppb','tinetti','berg','dor','mrc','ashworth']){
   await phone.goto(base+'/avaliacao-terapeuta.html?preview='+id);await phone.locator('#fields').waitFor();assert.equal(await phone.locator('#fields input:checked').count(),0);
   if(id==='mrc'||id==='ashworth'){
     await phone.locator('input[name=status][value=done]').check();await phone.locator('[data-muscle]').first().click();const picked=await phone.locator('[data-muscle]').first().textContent();assert.equal(await phone.locator('[data-field=musculo]').inputValue(),picked);assert.equal(await phone.locator('[data-muscle]').first().getAttribute('aria-pressed'),'true');await phone.locator('[data-field=musculo]').fill('Extensão joelho');assert.equal(await phone.locator('[data-muscle][aria-pressed=true]').count(),0);await phone.locator('[data-field=lado] input').first().check();await phone.locator('[data-field=grau] input').last().check();await phone.locator('[data-add]').click();assert.equal(await phone.locator('[data-row]').count(),2);assert.equal(await phone.locator('[data-row]').first().locator('[data-field=musculo]').inputValue(),'Extensão joelho');
     await phone.locator('[data-row]').last().locator('[data-remove]').click();assert.equal(await phone.locator('[data-row]').count(),1);
     await phone.locator('#save').click();
   }
 }
 assert.deepEqual(failures,[]);assert.ok(calls.includes('therapist_scale_save'));
 console.log('PASS: browser → SQL local → browser; seleção múltipla, pré-visualização, telemóvel, rascunho, retoma, conclusão, totais e respostas na consulta.');
 }finally{await context.close();await browser.close();await db.close();}
})();
