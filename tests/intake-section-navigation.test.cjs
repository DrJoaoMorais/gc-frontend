// Synthetic questionnaire DOM tests; no authentication, network or clinical records.
// Run with NODE_PATH pointing to linkedom 0.18.12.
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');const {parseHTML}=require('linkedom');
const motor=fs.readFileSync(path.join(__dirname,'../modules/intake/intake-motor.js'),'utf8');
async function setup(){
 const {default:config}=await import('../modules/intake/configs/pre_consulta_v2.js');
 const {window}=parseHTML('<html><body></body></html>');const document=window.document;
 const writes=[],alerts=[];let reject=false;
 window.scrollTo=()=>{};window.HTMLElement.prototype.focus=function(){};
 window.sb={rpc:async(name,args)=>{writes.push({name,args});return {data:!reject,error:null}}};
 const context=vm.createContext({window,document,console,URLSearchParams,structuredClone,setTimeout:()=>0,clearTimeout(){},alert:message=>alerts.push(message),config});
 vm.runInContext(motor,context); // No root at bootstrap: never calls authentication.
 document.body.innerHTML='<div id="intake-root"></div>';
 const run=code=>vm.runInContext(code,context);
 run("_cfg=config;_root=document.getElementById('intake-root');_token='synthetic';_respostas={s4_dias_exercicio:'2–3 dias'};_secaoIdx=3;_maxSecaoAlcancada=3;_render()");
 return {document,run,writes,alerts,reject(value){reject=value},click(id){const el=document.getElementById(id);assert.ok(el,id);el.click()},async settle(){await new Promise(setImmediate)}};
}
test('section 4 advances to standalone section 5, preserves answers and saves the same weekly ID before sleep',async()=>{
 const x=await setup();
 assert.match(x.document.querySelector('h2').textContent,/Atividade física/);
 assert.equal(x.document.querySelector('[data-id="exercicio_semana_habitual"]'),null);
 x.click('btnSeguinte');await x.settle();
 assert.equal(x.run('_secaoIdx'),4);assert.match(x.document.querySelector('h2').textContent,/disponibilidade/);
 assert.match(x.document.querySelector('.progress-label').textContent,/5 de 11/);
 assert.ok(x.document.querySelector('.secao-intro'));assert.ok(x.document.querySelector('.secao-nota'));
 x.click('btnSeguinte');await x.settle();assert.equal(x.run('_secaoIdx'),4);assert.equal(x.writes.length,0);assert.equal(x.alerts.length,1);
 x.run("_respostas.exercicio_semana_habitual=Array.from({length:7},(_,i)=>i===0?{estado:'treino',tempo:'30',modalidades:['Corrida']}:{estado:'descanso'})");
 x.click('btnAnterior');assert.equal(x.run('_secaoIdx'),3);assert.equal(x.run('_respostas.s4_dias_exercicio'),'2–3 dias');
 x.click('btnSeguinte');await x.settle();assert.equal(x.run('_respostas.exercicio_semana_habitual[0].tempo'),'30');
 x.click('btnSeguinte');await x.settle();
 assert.equal(x.run('_secaoIdx'),5);assert.equal(x.document.querySelector('h2').textContent,'Sono');
 assert.equal(x.writes.length,1);assert.equal(x.writes[0].name,'intake_gravar_resposta');
 assert.equal(x.writes[0].args.p_question_id,'exercicio_semana_habitual');assert.equal(x.writes[0].args.p_answer[0].tempo,'30');
 assert.ok(x.document.querySelector('[data-id="s5_hora_deitar"]'));
});
test('weekly save failure keeps section 5 open and retains all supplied days',async()=>{
 const x=await setup();x.click('btnSeguinte');await x.settle();
 x.run("_respostas.exercicio_semana_habitual=Array.from({length:7},()=>({estado:'indisponivel'}))");x.reject(true);
 x.click('btnSeguinte');await x.settle();
 assert.equal(x.run('_secaoIdx'),4);assert.equal(x.run('_respostas.exercicio_semana_habitual.length'),7);
 assert.equal(x.document.getElementById('btnSeguinte').disabled,false);
});
