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
 // The editor now saves through the existing plan action; isolate persistence in DOM tests.
 vm.runInContext("globalThis.planSaves=0;handleGerar=async()=>{planSaves++;globalThis.savedPlan=buildFinalData()}",c);
 vm.runInContext(`_state.patient={id:'demo',full_name:'Demonstração'};_state.clinicId='demo-clinic';_state.startDate='2026-11-02';_state.endDate='2026-11-15';_state.activePrescriptionId='demo-plan';_state.catalogLoaded=true;
 const caminhada=(id,date,min)=>({session_id:id,date,order:0,kind:'walk',modality:'Caminhada',local:'Casa',walks:[{walk_id:'walk-'+id,label:'',duration_sec:min*60,pace:'lento',rpe_local:null}],stairs_flights:null,notes:''});
 _state.sessions=[caminhada('monday','2026-11-02',60),caminhada('wednesday','2026-11-04',20),caminhada('sunday','2026-11-08',60)];abrirCriarTreino();_criarTreino.tipo='caminhada';_criarTreino.atual={nome:'Caminhada',sessao:caminhada('template','2026-11-01',60)};_criarTreino.treinosPorTipo.caminhada=_criarTreino.atual;ctRender();`,c);
 return {window,document,run:code=>vm.runInContext(code,c),get:selector=>document.querySelector(selector),click(selector){const el=document.querySelector(selector);assert.ok(el,selector);el.click()}};
}



test('the unified dose has one table, visible rests and preserves instructions when changing sets',async()=>{
 const x=await setup();
 x.run(`_criarTreino=null;_embeddedCare={onChange(){}};
 _panelDraft=novaSessaoSkeleton('Ginásio','list','2026-11-06');
 const item=novoItemDeExercicio({id:'demo-ex',name:'Agachamento',photo_url:null});
 item.series=[{reps:10,load:5}];item.prescription_note='Instrução de demonstração';item.rest_next=0;
 _panelDraft.items=[item];_panelIsNovo=true;
 document.getElementById('gcwoPrescricaoRoot').innerHTML='<div id="gcwoPanel"></div>';renderPanel();`);
 assert.equal(x.document.querySelectorAll('[data-set-field="value"]').length,1);
 assert.equal(x.document.querySelectorAll('[data-set-field="load"]').length,1);
 assert.equal(x.document.querySelectorAll('.gcwo-serie-reps,.gcwo-serie-load').length,0);
 x.click('[data-add-set]');
 assert.equal(x.run('_panelDraft.strength_blocks[0].items[0].strength_series.length'),2);
 assert.equal(x.get('[data-field="prescription_note"]').value,'Instrução de demonstração');
 const rest=x.get('[data-field="rest_set"]');rest.value='30';rest.dispatchEvent(new x.window.Event('input'));
 const load=x.document.querySelectorAll('[data-set-field="load"]')[1];load.value='12.5';load.dispatchEvent(new x.window.Event('input'));
 assert.equal(x.run('_panelDraft.strength_blocks[0].items[0].strength_series[1].load'),12.5);
 x.click('#gcwoPGuardar');
 assert.equal(x.run('_panelDraft'),null);
 const session=x.run('_state.sessions.find(s=>s.strength_version===1)');
 assert.equal(session.blocks[0].intervals.filter(i=>i.type==='trabalho')[1].load,12.5);
 assert.equal(session.kind,'circuit');
 x.run('openPanelEditar('+JSON.stringify(session.session_id)+')');
 assert.equal(x.document.querySelectorAll('[data-set-field="value"]').length,2);
 assert.equal(x.get('[data-field="prescription_note"]').value,'Instrução de demonstração');
});
test('editing a new session validates the visible inputs and saves the same cadence and load for the patient',async()=>{
 const x=await setup();
 x.run(`_criarTreino=null;_embeddedCare={onChange(){}};
 _state.exercisesCatalog=[{id:'demo-ex',name:'Agachamento',categoria:['Membro Inferior'],equipamento:['Peso Corporal']}];
 _panelCatalogFiltro='todos';_panelCatalogBusca='';_panelEquipFiltro=new Set();
 _panelDraft=novaSessaoSkeleton('Ginásio','list','2026-11-06');_panelIsNovo=true;
 document.getElementById('gcwoPrescricaoRoot').innerHTML='<div id="gcwoPanel"></div>';renderPanel();`);
 x.click('#gcwoPCatGrid [data-exid]');
 x.click('#gcwoPGuardar');assert.ok(x.get('#gcwoPErro').textContent);assert.equal(x.run('planSaves'),0);
 const edit=(selector,value)=>{const input=x.get(selector);input.value=value;input.dispatchEvent(new x.window.Event('input'))};
 edit('[data-set-field="value"]','10');edit('[data-set-field="load"]','7.5');
 edit('[data-field="tempo_concentrico_s"]','2');edit('[data-field="tempo_excentrico_s"]','3');
 assert.match(x.get('#gcwoStrengthTime').textContent,/50/);
 x.click('#gcwoPGuardar');assert.equal(x.run('_panelDraft'),null);
 const payload=x.run('buildFinalData().sessions.find(s=>s.strength_version===1)');
 assert.equal(x.run('planSaves'),1);assert.equal(x.run('savedPlan.sessions.find(s=>s.strength_version===1).blocks[0].intervals[0].duration_sec'),50);
 assert.equal(payload.blocks[0].intervals[0].duration_sec,50);
 assert.equal(payload.blocks[0].intervals[0].load,7.5);
 assert.equal(payload.blocks[0].intervals[0].cadence.tempo_concentrico_s,2);
 assert.equal(payload.blocks[0].intervals.at(-1).type,'trabalho');
});

test('embedded workspace has one settings form and saves an edited day through one action',async()=>{
 const x=await setup();
 x.run("_criarTreino=null;_embeddedCare={onChange(){}};_calendarFirstMonday='2026-11-02';renderStep2()");
 assert.equal(x.document.querySelectorAll('#gcwoDataInicio').length,1);
 assert.ok(x.get('#gcwoPlanSettings'));assert.equal(x.get('#gcwoCriarTreino'),null);
 assert.ok(x.get('#gcwoPlanSaveState'));
 const before=x.run('JSON.stringify(_state.sessions)');
 x.click('[data-edit-session="monday"]');
 assert.ok(x.get('.gcwo-care-editor').classList.contains('gcwo-workout-editing'));
 assert.equal(x.get('#gcwoPGuardar').textContent,'Guardar treino e plano');
 x.click('#gcwoPCancelar');
 assert.equal(x.run('JSON.stringify(_state.sessions)'),before);assert.equal(x.run('planSaves'),0);
 assert.equal(x.get('.gcwo-care-editor').classList.contains('gcwo-workout-editing'),false);
 x.click('[data-edit-session="monday"]');
 await x.run('guardarTreinoEPlano()');
 assert.equal(x.run('planSaves'),1);
 assert.equal(x.run('savedPlan.sessions.find(s=>s.session_id==="monday").session_id'),'monday');
 assert.equal(x.document.querySelectorAll('#gcwoGerar').length,1);
});

test('empty block opens its catalogue and selection goes only into that block without losing rounds or rests',async()=>{
 const x=await setup();
 x.run(`_criarTreino=null;_embeddedCare={onChange(){}};
 _state.exercisesCatalog=[{id:'new-ex',name:'Exercício de demonstração',categoria:['Membro Inferior'],equipamento:['Peso Corporal']}];
 _panelCatalogFiltro='todos';_panelCatalogBusca='';_panelEquipFiltro=new Set();
 _panelDraft=novaSessaoSkeleton('Ginásio','list','2026-11-09');_panelIsNovo=true;
 const a=novoBlocoForca(uuid),b=novoBlocoForca(uuid,'circuit');b.rounds=5;b.rest_between_rounds_s=45;
 _panelDraft.strength_blocks=[a,b];
 document.getElementById('gcwoPrescricaoRoot').innerHTML='<div id="gcwoPanel"></div>';renderPanel();
 globalThis.scrolled=[];window.HTMLElement.prototype.scrollIntoView=function(){scrolled.push(this.className)};`);
 const cards=x.document.querySelectorAll('[data-strength-block]');
 cards[1].querySelector('.gcwo-strength-empty-add').click();
 assert.match(x.run('scrolled.at(-1)'),/gcwo-strength-catalog/);
 assert.equal(x.run('alvoForca(_panelDraft).block_id'),x.run('_panelDraft.strength_blocks[1].block_id'));
 x.click('#gcwoPCatGrid [data-exid="new-ex"]');
 assert.equal(x.run('_panelDraft.strength_blocks[0].items.length'),0);
 assert.equal(x.run('_panelDraft.strength_blocks[1].items.length'),1);
 assert.equal(x.run('_panelDraft.strength_blocks[1].rounds'),5);
 assert.equal(x.run('_panelDraft.strength_blocks[1].rest_between_rounds_s'),45);
 assert.match(x.get('#gcwoStrengthSelection').textContent,/1 exercício/);
 x.click('#gcwoStrengthBackToBlock');
 assert.match(x.run('scrolled.at(-1)'),/gcwo-strength-block/);
});
