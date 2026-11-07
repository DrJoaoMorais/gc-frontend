// DOM-only regression tests. No authentication, network calls or clinical writes.
// Development dependency: linkedom 0.18.14 (not a production dependency).
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const {parseHTML}=require('linkedom');
async function setup(){
 const forca=await import('../modules/exercicio/prescricao/forca-blocos.js');const forcaEditor=await import('../modules/exercicio/prescricao/forca-editor.js');
 const planos=await import('../modules/exercicio/prescricao/planos-casa.js');const circuito=await import('../modules/exercicio/prescricao/circuito-tempo.js');const biblioteca=await import('../modules/exercicio/prescricao/biblioteca-blocos.js');const catalog=await import('../modules/exercicio/prescricao/catalogo-organizacao.js');const helpers=await import('../modules/exercicio/prescricao/disponibilidade-treino.js');const recommendations=await import('../modules/exercicio/prescricao/recomendacoes.js');const doses=await import('../modules/exercicio/prescricao/dose-protocolo.js');const pace=await import('../modules/exercicio/shared/pace.js');
 const {window}=parseHTML('<html><body><div id="gcwoPrescricaoRoot"></div></body></html>');const document=window.document;
 window.HTMLElement.prototype.scrollIntoView=function(){};window.HTMLElement.prototype.focus=function(){};
 const ctx={window,document,console,CSS:{escape:value=>String(value)},structuredClone,URL,Intl,Date,setTimeout,clearTimeout,crypto:require('node:crypto').webcrypto,G:{clinics:[],sessionUser:{id:'medico-demo'}},...forca,...forcaEditor,...planos,...circuito,...biblioteca,...catalog,validarDoseCatalogo:catalog.doseCatalogoDefinida,...helpers,...recommendations,...doses,...pace,confirm:()=>true};
 window.sb=new Proxy({}, {get(){throw Error('Unexpected database access during local editing')}});
 const c=vm.createContext(ctx);
 const source=fs.readFileSync(path.join(__dirname,'../modules/exercicio/prescricao/prescricao.js'),'utf8').replace(/^import .*;\s*$/gm,'').replace(/^export /gm,'').replaceAll('import.meta.url',JSON.stringify('file:///prescricao.js'));
 vm.runInContext(source,c);
 vm.runInContext(`_state.patient={id:'demo',full_name:'Demonstração'};_state.clinicId='demo-clinic';_state.startDate='2026-11-02';_state.endDate='2026-11-15';_state.activePrescriptionId='demo-plan';_state.catalogLoaded=true;
 const caminhada=(id,date,min)=>({session_id:id,date,order:0,kind:'walk',modality:'Caminhada',local:'Casa',walks:[{walk_id:'walk-'+id,label:'',duration_sec:min*60,pace:'lento',rpe_local:null}],stairs_flights:null,notes:''});
 _state.sessions=[caminhada('monday','2026-11-02',60),caminhada('wednesday','2026-11-04',20),caminhada('sunday','2026-11-08',60)];abrirCriarTreino();_criarTreino.tipo='caminhada';_criarTreino.atual={nome:'Caminhada',sessao:caminhada('template','2026-11-01',60)};_criarTreino.treinosPorTipo.caminhada=_criarTreino.atual;ctRender();`,c);
 return {window,document,run:code=>vm.runInContext(code,c),get:selector=>document.querySelector(selector),click(selector){const el=document.querySelector(selector);assert.ok(el,selector);el.click()}};
}

test('visual circuit uses the real material filters and edits rounds and rests without dropdowns',async()=>{
 const x=await setup();
 x.run(`_state.exercisesCatalog=${fs.readFileSync(path.join(__dirname,'fixtures/catalogo-173.json'),'utf8')};
 _state.exercisesCatalog[0].photo_url='https://example.org/exercicio.png';
 _panelCatalogFiltro='todos';_panelCatalogBusca='';_panelEquipFiltro=new Set();
 _panelDraft=novaSessaoSkeleton('Circuito','circuit','2026-11-06');
 document.getElementById('gcwoPrescricaoRoot').innerHTML='<div id="gcwoPErro"></div>'+renderPanelCircuito(_panelDraft);
 wirePanelCircuito(_panelDraft);`);
 assert.equal(x.document.querySelectorAll('.gcwo-circuit-workspace select').length,0);
 assert.deepEqual([...x.document.querySelectorAll('[data-circ-equipment]')].map(b=>b.textContent),['Máquina','TRX','Elásticos','Halteres','Peso Corporal','Outros']);
 x.click('[data-circ-add]');
 const first=x.run('_panelDraft.blocks[0].exercicios[0].exercise_id');
 assert.ok(first);
 const second=x.document.querySelectorAll('[data-circ-add]')[1];second.click();
 assert.equal(x.run('_panelDraft.blocks[0].exercicios.length'),2);
 x.click('.gcwo-circ-rounds');
 const input=x.get('.gcwo-circ-rounds');input.value='7';input.dispatchEvent(new x.window.Event('input'));
 assert.equal(x.run('_panelDraft.blocks[0].rounds'),7);
 x.click('.gcwo-circ-default-rest');
 x.get('.gcwo-circ-default-rest').value='45';x.get('.gcwo-circ-default-rest').dispatchEvent(new x.window.Event('input'));
 assert.equal(x.run('_panelDraft.blocks[0].exercicios.every(ex=>ex.rest_after_s===45)'),true);
 x.click('[data-circ-measure="reps"]');
 x.get('.gcwo-circ-ex-value').value='10';x.get('.gcwo-circ-ex-value').dispatchEvent(new x.window.Event('input'));
 assert.equal(x.run('_panelDraft.blocks[0].exercicios[0].measure'),'reps');
 const frames=x.run('flattenBlocosCircuitoParaGravar(_panelDraft.blocks)[0].intervals');
 assert.equal(frames.find(i=>i.type==='trabalho').prescribed_value,10);
 assert.equal(frames.filter(i=>i.type==='trabalho').length,14);
 assert.ok(frames.find(i=>i.type==='trabalho').photo_url);
 assert.equal(x.run('erroDoseCircuito(_panelDraft)'),'');
 x.click('[data-circ-move="1"]');
 assert.notEqual(x.run('_panelDraft.blocks[0].exercicios[0].exercise_id'),first);
 x.get('.gcwo-circ-ex-value').value='';x.get('.gcwo-circ-ex-value').dispatchEvent(new x.window.Event('input'));
 assert.ok(x.run('erroDoseCircuito(_panelDraft)'));
});
test('equipment and region filters preserve circuit selection and model editing stays inline',async()=>{
 const x=await setup();
 x.run(`_state.exercisesCatalog=${fs.readFileSync(path.join(__dirname,'fixtures/catalogo-173.json'),'utf8')};
 _state.exercisesCatalog[0].photo_url='https://example.org/exercicio.png';
 _panelCatalogFiltro='todos';_panelCatalogBusca='';_panelEquipFiltro=new Set();
 _panelDraft=novaSessaoSkeleton('Circuito','circuit','2026-11-06');
 document.getElementById('gcwoPrescricaoRoot').innerHTML='<div id="gcwoPErro"></div>'+renderPanelCircuito(_panelDraft);
 wirePanelCircuito(_panelDraft);`);
 x.click('[data-circ-add]');const id=x.run('_panelDraft.blocks[0].exercicios[0].exercise_id');
 x.click('[data-circ-equipment="TRX"]');
 assert.equal(x.run('_panelDraft.blocks[0].exercicios[0].exercise_id'),id);
 assert.equal(x.run('_panelEquipFiltro.has("TRX")'),true);
 x.click('[data-circ-equipment="TRX"]');
 x.click('[data-circ-region="Core"]');
 assert.equal(x.run('_panelDraft.blocks[0].exercicios.length'),1);
 x.run("document.getElementById('gcwoPrescricaoRoot').insertAdjacentHTML('beforeend','<div id=gcwoStep2Body></div>');renderStep2Body=()=>{};editarModeloCircuito(modeloCircuito('inteiro'));");
 assert.equal(x.document.querySelectorAll('dialog').length,0);
 assert.ok(x.run('_panelDraft.blocks.some(b=>b.exercicios?.length)'));
});
test('normal strength and legacy circuit entries use the unified catalogue',async()=>{
 for(const kind of ['list','circuit']){
  const x=await setup();
  x.run(`_criarTreino=null;_embeddedCare={onChange(){}};
  _panelIsNovo=true;_panelDraft=novaSessaoSkeleton('${kind==='list'?'Ginásio':'Circuito'}','${kind}','2026-11-06');
  document.getElementById('gcwoPrescricaoRoot').innerHTML='<div id="gcwoPanel"></div>';renderPanel();`);
  assert.ok(x.get('.gcwo-strength-editor'));
  assert.ok(x.get('#gcwoPCatGrid'));
  assert.equal(x.document.querySelectorAll('.gcwo-strength-editor select').length,0);
  assert.equal(x.document.querySelectorAll('[data-modalidade-editor="Circuito"]').length,0);
 }
});
test('strength and circuit share visual filters and favorites combine with region and equipment',async()=>{
 for(const kind of ['list','circuit']){
  const x=await setup();
  x.run(`_criarTreino=null;_embeddedCare={onChange(){}};
  _state.exercisesCatalog=[
   {id:'favorite',name:'Core favorito',categoria:['Core'],equipamento:['Halteres'],is_favorite:true},
   {id:'other',name:'Core com halteres',categoria:['Core'],equipamento:['Halteres'],is_favorite:false},
   {id:'leg',name:'Membro inferior',categoria:['Membro Inferior'],equipamento:['Máquina'],is_favorite:true}
  ];
  _panelCatalogFiltro='todos';_panelCatalogFavoritos=false;_panelEquipFiltro=new Set();_panelCatalogBusca='';_panelFinalidade='todos';
  _panelDraft=novaSessaoSkeleton('${kind==='list'?'Ginásio':'Circuito'}','${kind}','2026-11-06');_panelIsNovo=true;
  document.getElementById('gcwoPrescricaoRoot').innerHTML='<div id="gcwoPanel"></div>';renderPanel();`);
  assert.ok(x.get('.gcwo-catalog-search input'));
  assert.equal(x.document.querySelectorAll('.gcwo-catalog-filter-panels>section').length,2);
  assert.equal(x.document.querySelectorAll('[data-filtro="favoritos"],[data-circ-region="favoritos"]').length,0);
  x.click('[data-filtro="Core"]');
  x.click('[data-equip="Halteres"]');
  x.click('[data-catalog-favorites]');
  assert.equal(x.run('_panelCatalogFiltro'),'Core');
  assert.equal(x.run('_panelEquipFiltro.has("Halteres")'),true);
  assert.equal(x.run('filteredCatalogForPanel().length'),1);
  assert.equal(x.run('filteredCatalogForPanel()[0].id'),'favorite');
  x.click('[data-catalog-favorites]');
  assert.equal(x.run('filteredCatalogForPanel().length'),2);
 }
});
