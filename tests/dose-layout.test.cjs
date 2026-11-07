// DOM-only regression tests. No authentication, network calls or clinical writes.
// Development dependency: linkedom 0.18.14 (not a production dependency).
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const {parseHTML}=require('linkedom');
async function setup(){
 const planos=await import('../modules/exercicio/prescricao/planos-casa.js');const circuito=await import('../modules/exercicio/prescricao/circuito-tempo.js');const biblioteca=await import('../modules/exercicio/prescricao/biblioteca-blocos.js');const catalog=await import('../modules/exercicio/prescricao/catalogo-organizacao.js');const helpers=await import('../modules/exercicio/prescricao/disponibilidade-treino.js');const recommendations=await import('../modules/exercicio/prescricao/recomendacoes.js');const doses=await import('../modules/exercicio/prescricao/dose-protocolo.js');const pace=await import('../modules/exercicio/shared/pace.js');
 const {window}=parseHTML('<html><body><div id="gcwoPrescricaoRoot"></div></body></html>');const document=window.document;
 window.HTMLElement.prototype.scrollIntoView=function(){};window.HTMLElement.prototype.focus=function(){};
 const ctx={window,document,console,CSS:{escape:value=>String(value)},structuredClone,URL,Intl,Date,setTimeout,clearTimeout,crypto:require('node:crypto').webcrypto,G:{clinics:[],sessionUser:{id:'medico-demo'}},...planos,...circuito,...biblioteca,...catalog,validarDoseCatalogo:catalog.doseCatalogoDefinida,...helpers,...recommendations,...doses,...pace,confirm:()=>true};
 window.sb=new Proxy({}, {get(){throw Error('Unexpected database access during local editing')}});
 const c=vm.createContext(ctx);
 const source=fs.readFileSync(path.join(__dirname,'../modules/exercicio/prescricao/prescricao.js'),'utf8').replace(/^import .*;\s*$/gm,'').replace(/^export /gm,'').replaceAll('import.meta.url',JSON.stringify('file:///prescricao.js'));
 vm.runInContext(source,c);
 vm.runInContext(`_state.patient={id:'demo',full_name:'Demonstração'};_state.clinicId='demo-clinic';_state.startDate='2026-11-02';_state.endDate='2026-11-15';_state.activePrescriptionId='demo-plan';_state.catalogLoaded=true;
 const caminhada=(id,date,min)=>({session_id:id,date,order:0,kind:'walk',modality:'Caminhada',local:'Casa',walks:[{walk_id:'walk-'+id,label:'',duration_sec:min*60,pace:'lento',rpe_local:null}],stairs_flights:null,notes:''});
 _state.sessions=[caminhada('monday','2026-11-02',60),caminhada('wednesday','2026-11-04',20),caminhada('sunday','2026-11-08',60)];abrirCriarTreino();_criarTreino.tipo='caminhada';_criarTreino.atual={nome:'Caminhada',sessao:caminhada('template','2026-11-01',60)};_criarTreino.treinosPorTipo.caminhada=_criarTreino.atual;ctRender();`,c);
 return {window,document,run:code=>vm.runInContext(code,c),get:selector=>document.querySelector(selector),click(selector){const el=document.querySelector(selector);assert.ok(el,selector);el.click()}};
}


test('compact exercise header keeps add-series, instructions and mode controls functional',async()=>{
 const x=await setup();
 x.run(`_criarTreino=null;_embeddedCare={onChange(){}};
 _panelDraft=novaSessaoSkeleton('Ginásio','list','2026-11-06');
 const item=novoItemDeExercicio({id:'demo-ex',name:'Agachamento',photo_url:null});
 item.series=[{reps:10,load:5}];item.prescription_note='Instrução de demonstração';
 _panelDraft.items=[item];_panelIsNovo=true;
 document.getElementById('gcwoPrescricaoRoot').innerHTML='<div id="gcwoPanel"></div>';renderPanel();`);
 assert.ok(x.get('.gcwo-dose-topline .gcwo-modo'));
 assert.ok(x.get('.gcwo-dose-topline .gcwo-it-prescription-note'));
 assert.ok(x.get('.gcwo-series-head .gcwo-add-serie'));
 x.click('.gcwo-add-serie');
 assert.equal(x.run('_panelDraft.items[0].series.length'),2);
 assert.equal(x.get('.gcwo-it-prescription-note').value,'Instrução de demonstração');
 const duration=x.get('input[value="duracao"]');duration.checked=true;
 duration.dispatchEvent(new x.window.Event('change',{bubbles:true}));
 assert.ok(x.get('.gcwo-duration-head .gcwo-add-duration-serie'));
 x.click('.gcwo-add-duration-serie');
 assert.equal(x.document.querySelectorAll('[data-duration-series-index]').length,2);
 assert.equal(x.get('.gcwo-it-prescription-note').value,'Instrução de demonstração');
});
