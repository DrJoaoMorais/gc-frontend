// DOM-only regression tests. No authentication, network calls or clinical writes.
// Development dependency: linkedom 0.18.14 (not a production dependency).
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const {parseHTML}=require('linkedom');
async function setup(){
 const catalog=await import('../modules/exercicio/prescricao/catalogo-organizacao.js');const helpers=await import('../modules/exercicio/prescricao/disponibilidade-treino.js');const recommendations=await import('../modules/exercicio/prescricao/recomendacoes.js');const doses=await import('../modules/exercicio/prescricao/dose-protocolo.js');const pace=await import('../modules/exercicio/shared/pace.js');
 const {window}=parseHTML('<html><body><div id="gcwoPrescricaoRoot"></div></body></html>');const document=window.document;
 window.HTMLElement.prototype.scrollIntoView=function(){};window.HTMLElement.prototype.focus=function(){};
 const ctx={window,document,console,CSS:{escape:value=>String(value)},structuredClone,URL,Intl,Date,setTimeout,clearTimeout,crypto:require('node:crypto').webcrypto,G:{clinics:[],sessionUser:{id:'medico-demo'}},...catalog,...helpers,...recommendations,...doses,...pace,confirm:()=>true};
 window.sb=new Proxy({}, {get(){throw Error('Unexpected database access during local editing')}});
 const c=vm.createContext(ctx);
 const source=fs.readFileSync(path.join(__dirname,'../modules/exercicio/prescricao/prescricao.js'),'utf8').replace(/^import .*;\s*$/gm,'').replace(/^export /gm,'').replaceAll('import.meta.url',JSON.stringify('file:///prescricao.js'));
 vm.runInContext(source,c);
 vm.runInContext(`_state.patient={id:'demo',full_name:'Demonstração'};_state.clinicId='demo-clinic';_state.startDate='2026-11-02';_state.endDate='2026-11-15';_state.activePrescriptionId='demo-plan';_state.catalogLoaded=true;
 const caminhada=(id,date,min)=>({session_id:id,date,order:0,kind:'walk',modality:'Caminhada',local:'Casa',walks:[{walk_id:'walk-'+id,label:'',duration_sec:min*60,pace:'lento',rpe_local:null}],stairs_flights:null,notes:''});
 _state.sessions=[caminhada('monday','2026-11-02',60),caminhada('wednesday','2026-11-04',20),caminhada('sunday','2026-11-08',60)];abrirCriarTreino();_criarTreino.tipo='caminhada';_criarTreino.atual={nome:'Caminhada',sessao:caminhada('template','2026-11-01',60)};_criarTreino.treinosPorTipo.caminhada=_criarTreino.atual;ctRender();`,c);
 return {window,document,run:code=>vm.runInContext(code,c),get:selector=>document.querySelector(selector),click(selector){const el=document.querySelector(selector);assert.ok(el,selector);el.click()}};
}
test('the first action on a scheduled walk edits that day instead of the reusable template',async()=>{
 const x=await setup();x.click('.gcwo-ct-slot-acoes button');assert.equal(x.run('_criarTreino.editar?.alvo'),'slot');assert.equal(x.run('_panelDraft.date'),'2026-11-02');
});
test('editing Monday from 60 to 20 minutes updates that card and weekly total, preserving the template and other days',async()=>{
 const x=await setup(),before=x.run('JSON.stringify(_state.sessions)');x.click('.gcwo-ct-slot-acoes button');
 assert.match(x.get('.gcwo-ct-det-titulo').textContent,/Segunda-feira.*2 Nov/);assert.equal(x.get('[data-ct-view]').dataset.ctView,'editor');assert.ok(x.get('.gcwo-ct-sidebar .gcwo-ct-semana'));assert.ok(x.get('[data-ct="adicionar"]'));
 x.click('[data-walk-minutes="20"]');assert.match(x.get('#gcwoCtDuracaoEdicao').textContent,/≈ 20 min/);assert.equal(x.get('#gcwoPGuardar').textContent,'Atualizar treino deste dia');
 x.click('#gcwoPGuardar');assert.equal(x.get('[data-ct-view]').dataset.ctView,'calendario');assert.match(x.get('.gcwo-ct-slot-main').textContent,/≈ 20 min/);assert.match(x.get('.gcwo-ct-semana-tit').textContent,/100 min/);
 assert.equal(x.run('_criarTreino.semanas[0].dias[0][0].sessao.walks[0].duration_sec'),1200);assert.equal(x.run('_criarTreino.semanas[0].dias[2][0].sessao.walks[0].duration_sec'),1200);assert.equal(x.run('_criarTreino.semanas[0].dias[6][0].sessao.walks[0].duration_sec'),3600);assert.equal(x.run('_criarTreino.atual.sessao.walks[0].duration_sec'),3600);assert.equal(x.run('JSON.stringify(_state.sessions)'),before);
});
test('cancel discards only the session draft and returns to the same calendar week',async()=>{
 const x=await setup();x.click('.gcwo-ct-slot-acoes button');x.click('[data-walk-minutes="20"]');x.click('#gcwoPCancelar');assert.equal(x.run('_criarTreino.semanas[0].dias[0][0].sessao.walks[0].duration_sec'),3600);assert.equal(x.get('[data-ct-view]').dataset.ctView,'calendario');assert.equal(x.run('_panelDraft'),null);
});
test('adding a walk starts with an explicit day and the editor uses that date',async()=>{
 const x=await setup();x.click('[data-ct-add="0:1"]');assert.equal(x.get('[data-ct-view]').dataset.ctView,'biblioteca');assert.match(x.get('.gcwo-ct-main .gcwo-ct-bloco-head').textContent,/Terça-feira.*3 Nov/);assert.ok(x.get('.gcwo-ct-sidebar .gcwo-ct-semana'));
 x.click('[data-ct-tipo="caminhada"]');x.click('[data-ct="cardio"]');assert.equal(x.run('_panelDraft.date'),'2026-11-03');x.click('[data-walk-minutes="30"]');x.click('#gcwoPGuardar');assert.equal(x.run('_criarTreino.semanas[0].dias[1].length'),1);assert.equal(x.run('_criarTreino.semanas[0].dias[1][0].sessao.walks[0].duration_sec'),1800);
});
test('Substituir is a separate explicit selection; no replacement happens before confirmation',async()=>{
 const x=await setup(),id=x.run('_criarTreino.semanas[0].dias[0][0].origemSessionId');x.click('[data-ct-slot-trocar]');assert.equal(x.run('_criarTreino.semanas[0].dias[0][0].sessao.walks[0].duration_sec'),3600);
 x.click('[data-ct-tipo="caminhada"]');x.click('[data-ct="cardio"]');x.click('[data-walk-minutes="10"]');x.click('#gcwoPGuardar');assert.equal(x.run('_criarTreino.semanas[0].dias[0].length'),1);assert.equal(x.run('_criarTreino.semanas[0].dias[0][0].origemSessionId'),id);assert.equal(x.run('_criarTreino.semanas[0].dias[0][0].sessao.walks[0].duration_sec'),600);
});
test('only one calendar week is rendered, and navigating weeks does not drop its sessions',async()=>{
 const x=await setup();assert.equal(x.document.querySelectorAll('.gcwo-ct-semana-bloco').length,1);assert.equal(x.get('#gcwoCtPeriodo').hasAttribute('open'),false);
 x.click('[data-ct="semana-seguinte"]');assert.equal(x.run('_criarTreino.semanaFoco'),1);assert.equal(x.document.querySelectorAll('.gcwo-ct-semana-bloco').length,1);x.click('[data-ct="semana-anterior"]');assert.equal(x.document.querySelectorAll('.gcwo-ct-slot').length,3);
});
test('applying the edited draft preserves scheduled session IDs, dates and all other sessions',async()=>{
 const x=await setup();x.run('globalThis.savedPayload=null;globalThis.saveCalls=0;handleGerar=async()=>{savedPayload=buildFinalData();saveCalls++}');const others=x.run('JSON.stringify(_state.sessions.slice(1))');x.click('.gcwo-ct-slot-acoes button');x.click('[data-walk-minutes="20"]');x.click('#gcwoPGuardar');x.click('[data-ct="adicionar"]');assert.equal(x.run('_criarTreino'),null);assert.equal(x.run('_state.sessions.length'),3);assert.equal(x.run('_state.sessions[0].session_id'),'monday');assert.equal(x.run('_state.sessions[0].date'),'2026-11-02');assert.equal(x.run('_state.sessions[0].walks[0].duration_sec'),1200);assert.equal(x.run('JSON.stringify(_state.sessions.slice(1))'),others);assert.equal(x.run('buildFinalData().sessions[0].walks[0].duration_sec'),1200);assert.equal(x.run('saveCalls'),1);assert.equal(x.run('savedPayload.sessions[0].walks[0].duration_sec'),1200);
});
test('the real walk rhythm control updates the selected session rather than other calendar copies',async()=>{
 const x=await setup();x.click('.gcwo-ct-slot-acoes button');const pace=x.get('.gcwo-walk-pace');pace.querySelectorAll('option').forEach(o=>{o.selected=o.value==='rapido'});pace.dispatchEvent(new x.window.Event('change',{bubbles:true}));x.click('#gcwoPGuardar');assert.equal(x.run('_criarTreino.semanas[0].dias[0][0].sessao.walks[0].pace'),'rapido');assert.equal(x.run('_criarTreino.semanas[0].dias[6][0].sessao.walks[0].pace'),'lento');
});
test('bulk repeat uses the last confirmed session, not the stale reusable template',async()=>{
 const x=await setup();x.click('.gcwo-ct-slot-acoes button');x.click('[data-walk-minutes="20"]');x.click('#gcwoPGuardar');x.click('[data-ct-aplicar-semana="0"]');assert.equal(x.run('_criarTreino.semanas[0].dias[1][0].sessao.walks[0].duration_sec'),1200);assert.equal(x.run('_criarTreino.atual.sessao.walks[0].duration_sec'),3600);
});
test('running, cycling and swimming keep their existing block editors in the day-specific flow',async()=>{
 for(const [tipo,modality] of [['corrida','Corrida'],['ciclismo','Ciclismo'],['natacao','Natação']]){
  const x=await setup();x.click('[data-ct-add="0:1"]');x.click(`[data-ct-tipo="${tipo}"]`);x.click('[data-ct="cardio"]');assert.equal(x.get('[data-ct-view]').dataset.ctView,'editor');assert.equal(x.run('_panelDraft.modality'),modality);assert.equal(x.run('_panelDraft.date'),'2026-11-03');assert.ok(x.get('#gcwoPanel'));x.click('#gcwoPCancelar');assert.equal(x.run('_criarTreino.semanas[0].dias[1].length'),0);
 }
});
test('exercise templates still use catalogue exercises and open the correct day editor',async()=>{
 const x=await setup();x.run(`_state.exercisesCatalog=[{id:'exercise-demo',name:'Exercício de demonstração',categoria:['Membro Inferior'],objetivos_exercicio:['Fortalecimento'],equipamento:['Peso Corporal'],locais:['Casa'],is_active:true}];`);
 x.click('[data-ct-add="0:1"]');x.click('[data-ct-tipo="exercicios"]');x.click('[data-ct-p-ex]');x.click('[data-ct="usar-pers"]');assert.equal(x.run('_panelDraft.kind'),'list');assert.equal(x.run('_panelDraft.date'),'2026-11-03');assert.ok(x.run('_panelDraft.items.length')>0);x.run('_panelDraft.items.forEach(it=>{it.series=[{reps:10,load:null}];it.rest_set=30;it.rest_next=30})');x.click('#gcwoPGuardar');assert.equal(x.run('_criarTreino.semanas[0].dias[1].length'),1);
});
test('week copying and removal keep unrelated weeks and the existing sessions intact',async()=>{
 const x=await setup();x.click('[data-ct-copiar-semana="0"]');assert.equal(x.run('_criarTreino.semanaFoco'),1);assert.equal(x.run('_criarTreino.semanas[1].dias[0][0].sessao.walks[0].duration_sec'),3600);x.click('[data-ct="semana-anterior"]');const id=x.get('[data-ct-slot-remover]').dataset.ctSlotRemover;x.click(`[data-ct-slot-remover="${id}"]`);assert.equal(x.run('_criarTreino.semanas[0].dias[0].length'),0);assert.equal(x.run('_criarTreino.semanas[1].dias[0].length'),1);assert.equal(x.run('_state.sessions.length'),3);
});
test('Guardar plano uses the existing save once even if the former button is clicked twice',async()=>{
 const x=await setup();x.run('globalThis.saveCalls=0;handleGerar=async()=>{saveCalls++}');const button=x.get('[data-ct="adicionar"]');assert.equal(button.textContent,'Guardar plano');button.click();button.click();assert.equal(x.run('saveCalls'),1);
});
test('an invalid empty draft is not sent to the existing save',async()=>{
 const x=await setup();x.run('_criarTreino.semanas.forEach(s=>s.dias=s.dias.map(()=>[]));globalThis.saveCalls=0;handleGerar=async()=>{saveCalls++};ctRender()');x.click('[data-ct="adicionar"]');assert.equal(x.run('saveCalls'),0);assert.ok(x.get('[role="alert"]'));assert.equal(x.run('_state.sessions.length'),3);
});
test('saved questionnaire availability remains editable and is visible when choosing and editing a day',async()=>{
 const x=await setup();x.run(`_state.disponibilidadeTreino=disponibilidadeDasRespostas([{question_id:'exercicio_minutos_dias_uteis',answer:20},{question_id:'exercicio_minutos_fim_semana',answer:60}],{id:'q-demo'}).disponibilidade;abrirCriarTreino()`);assert.equal(x.get('[data-ct-col-min="0:0"]').value,'20');assert.equal(x.get('[data-ct-col-min="0:5"]').value,'60');x.click('[data-ct-add="0:1"]');assert.match(x.get('.gcwo-ct-main .gcwo-ct-bloco-head').textContent,/Disponível: 20 min/);x.click('[data-ct-tipo="caminhada"]');x.click('[data-ct="cardio"]');assert.match(x.get('#gcwoCtDuracaoEdicao').textContent,/20 min disponíveis/);
});

test('live sidebar shows the draft duration and weekly total before applying; cancel restores original',async()=>{
 const x=await setup();x.click('.gcwo-ct-slot-main');x.click('[data-walk-minutes="20"]');
 assert.match(x.get('.gcwo-ct-sidebar .gcwo-ct-slot-main').textContent,/≈ 20 min/);assert.match(x.get('.gcwo-ct-semana-tit').textContent,/100 min/);
 assert.equal(x.run('_criarTreino.semanas[0].dias[0][0].sessao.walks[0].duration_sec'),3600);
 x.click('#gcwoPCancelar');assert.match(x.get('.gcwo-ct-slot-main').textContent,/≈ 60 min/);assert.match(x.get('.gcwo-ct-semana-tit').textContent,/140 min/);
});
test('single Guardar plano applies the open day draft and sends its value through existing save',async()=>{
 const x=await setup();x.run('globalThis.saveCalls=0;globalThis.savedPayload=null;handleGerar=async()=>{saveCalls++;savedPayload=buildFinalData()}');
 x.click('.gcwo-ct-slot-main');x.click('[data-walk-minutes="20"]');x.click('[data-ct="adicionar"]');
 assert.equal(x.run('saveCalls'),1);assert.equal(x.run('savedPayload.sessions[0].walks[0].duration_sec'),1200);assert.equal(x.run('savedPayload.sessions[0].session_id'),'monday');
});
test('switching day applies the valid draft without losing it',async()=>{
 const x=await setup();x.click('.gcwo-ct-slot-main');x.click('[data-walk-minutes="20"]');const ref=x.run("'0:2:'+_criarTreino.semanas[0].dias[2][0].id");x.click('[data-ct-slot-editar="'+ref+'"]');
 assert.equal(x.run('_panelDraft.date'),'2026-11-04');assert.equal(x.run('_criarTreino.semanas[0].dias[0][0].sessao.walks[0].duration_sec'),1200);
});
test('empty open session blocks global save and retains the current editor',async()=>{
 const x=await setup();x.run('globalThis.saveCalls=0;handleGerar=async()=>saveCalls++');x.click('[data-ct-add="0:1"]');x.click('[data-ct-tipo="corrida"]');x.click('[data-ct="cardio"]');x.click('[data-ct="adicionar"]');assert.equal(x.run('saveCalls'),0);assert.ok(x.get('#gcwoPanel'));assert.match(x.get('#gcwoPErro').textContent,/bloco/);
});
test('catalogue with 200 exercises paginates and filters without dropping chosen series and notes',async()=>{
 const x=await setup();x.run(`_state.exercisesCatalog=Array.from({length:200},(_,i)=>({id:'e'+i,name:'Exercício '+String(i).padStart(3,'0'),categoria:['Membro Inferior'],equipamento:['Peso Corporal'],objetivos_exercicio:['Fortalecimento'],locais:['Casa'],is_active:true}));`);
 x.click('[data-ct-add="0:1"]');x.click('[data-ct-tipo="exercicios"]');x.click('[data-ct-p-ex]');x.click('[data-ct="usar-pers"]');
 assert.equal(x.document.querySelectorAll('#gcwoPCatGrid .gcwo-catpick-card').length,12);assert.match(x.get('.gcwo-catalog-pages').textContent,/200 exercícios/);assert.equal(x.get('.gcwo-gym-catalog').hasAttribute('open'),false);
 const before=x.run('JSON.stringify(_panelDraft.items)');x.click('[data-catalog-page="1"]');assert.match(x.get('.gcwo-catalog-pages').textContent,/2\/17/);assert.equal(x.run('JSON.stringify(_panelDraft.items)'),before);
 const input=x.get('#gcwoPCatBusca');input.value='199';input.dispatchEvent(new x.window.Event('input',{bubbles:true}));assert.equal(x.document.querySelectorAll('#gcwoPCatGrid .gcwo-catpick-card').length,1);assert.match(x.get('#gcwoPCatGrid').textContent,/199/);assert.equal(x.run('JSON.stringify(_panelDraft.items)'),before);
 assert.ok(x.get('details.gcwo-exercicio-expand'));assert.ok(x.get('.gcwo-serie-reps'));assert.ok(x.get('.gcwo-serie-load'));assert.ok(x.get('.gcwo-it-restset'));
});
test('real cardio controls remain editable inside the broad editor and calendar context stays mounted',async()=>{
 for(const [tipo,modality] of [['corrida','Corrida'],['ciclismo','Ciclismo'],['natacao','Natação']]){
  const x=await setup();x.click('[data-ct-add="0:1"]');x.click(`[data-ct-tipo="${tipo}"]`);x.click('[data-ct="cardio"]');x.click(tipo==='natacao'?'[data-add-zone="A2"]':'[data-add-zone="Z2"]');
  assert.equal(x.run('_panelDraft.blocks.length'),1);assert.ok(x.get('.gcwo-ct-sidebar'));assert.ok(x.get('.gcwo-ct-main #gcwoPCardioOverview'));
  const input=x.get('.gcwo-int-fc');input.value='123';input.dispatchEvent(new x.window.Event('input',{bubbles:true}));assert.equal(x.run('_panelDraft.blocks[0].intensity.heart_rate_bpm'),123);
  if(tipo==='ciclismo')assert.ok(x.get('.gcwo-int-power'));
  if(tipo==='natacao'){assert.ok(x.get('#gcwoPPiscina'));assert.ok(x.get('#gcwoPEstilo'));assert.ok(x.get('.gcwo-int-pace100'));assert.match(x.get('#gcwoCtDuracaoEdicao').textContent,/por calcular/)}
  x.click('#gcwoPGuardar');assert.equal(x.run('_criarTreino.semanas[0].dias[1][0].sessao.modality'),modality);
 }
});
test('custom workout search ignores accents and case, preserves filters, selection and focused input',async()=>{
 const x=await setup();x.run(`_state.exercisesCatalog=[{id:'a',name:'Elevação de gémeos',categoria:['Membro Inferior'],objetivos_exercicio:['Fortalecimento'],equipamento:['Peso Corporal'],locais:['Casa'],is_active:true},{id:'b',name:'Agachamento',categoria:['Membro Inferior'],objetivos_exercicio:['Fortalecimento'],equipamento:['Peso Corporal'],locais:['Casa'],is_active:true},{id:'c',name:'Elevação com halteres',categoria:['Membro Superior'],objetivos_exercicio:['Fortalecimento'],equipamento:['Halteres'],locais:['Ginásio'],is_active:true}];`);
 x.click('[data-ct-add="0:1"]');x.click('[data-ct-tipo="exercicios"]');x.click('[data-ct-p-local="Casa"]');x.click('[data-ct-p-ex="b"]');
 const input=x.get('[data-ct-p-busca]');input.value='ELEVACAO';input.dispatchEvent(new x.window.Event('input',{bubbles:true}));assert.equal(x.get('[data-ct-p-busca]'),input);assert.equal(x.document.querySelectorAll('[data-ct-p-ex]').length,1);assert.equal(x.get('[data-ct-p-ex]').getAttribute('data-ct-p-ex'),'a');assert.equal(x.run('_criarTreino.personalizado.escolhidos[0]'),'b');assert.match(x.get('#gcwoCtPersResultados').textContent,/1 escolhido/);
 input.value='sem correspondência';input.dispatchEvent(new x.window.Event('input',{bubbles:true}));assert.equal(x.document.querySelectorAll('[data-ct-p-ex]').length,0);assert.match(x.get('#gcwoCtPersResultados').textContent,/Nenhum exercício/);
 input.value='';input.dispatchEvent(new x.window.Event('input',{bubbles:true}));assert.equal(x.document.querySelectorAll('[data-ct-p-ex]').length,2);assert.ok(x.get('[data-ct-p-ex="b"]').classList.contains('on'));x.click('[data-ct="usar-pers"]');assert.equal(x.run('_panelDraft.items[0].exercise_id'),'b');
});
test('new exercise selection opens searchable catalogue directly without the six automatic models',async()=>{
 const x=await setup();x.click('[data-ct-add="0:1"]');x.click('[data-ct-tipo="exercicios"]');assert.ok(x.get('[data-ct-p-busca]'));assert.equal(x.get('[data-ct-modelo]'),null);assert.equal(x.get('.gcwo-ct-modelo'),null);assert.equal(x.document.querySelectorAll('[data-ct-finalidade]').length,3);
});
test('manual dose is enforced, uses real input controls and preserves other days on save',async()=>{
 const x=await setup();x.run(`_state.exercisesCatalog=[{id:'new-item',name:'Agachamento',contextos_exercicio:['Treino'],categoria:['Membro Inferior'],objetivos_exercicio:['Fortalecimento'],equipamento:['Peso Corporal'],locais:['Casa']}];`);
 x.click('[data-ct-add="0:1"]');x.click('[data-ct-tipo="exercicios"]');x.click('[data-ct-p-ex="new-item"]');x.click('[data-ct="usar-pers"]');assert.equal(x.get('.gcwo-serie-reps').value,'');assert.equal(x.get('.gcwo-it-restset').value,'');x.click('#gcwoPGuardar');assert.ok(x.get('#gcwoPanel'));assert.match(x.get('#gcwoPErro').textContent,/Agachamento/);
 for(const [selector,value] of [['.gcwo-serie-reps','10'],['.gcwo-it-restset','30'],['.gcwo-it-restnext','30']]){const el=x.get(selector);el.value=value;el.dispatchEvent(new x.window.Event('input',{bubbles:true}))}
 x.click('#gcwoPGuardar');assert.equal(x.run('_criarTreino.semanas[0].dias[1][0].sessao.items[0].series[0].reps'),10);assert.equal(x.run('_criarTreino.semanas[0].dias[1][0].sessao.items[0]._dosePorDefinir'),undefined);assert.equal(x.run('_criarTreino.semanas[0].dias[0][0].sessao.walks[0].duration_sec'),3600);
});
test('context filters overlap and retain selected items when hidden by another context',async()=>{
 const x=await setup();x.run(`_state.exercisesCatalog=[{id:'both',name:'Remada',contextos_exercicio:['Treino','Reabilitação'],categoria:['Core'],objetivos_exercicio:['Fortalecimento'],equipamento:['Elásticos'],locais:['Casa']},{id:'therapy',name:'Mobilidade',contextos_exercicio:['Reabilitação'],categoria:['Core'],objetivos_exercicio:['Mobilidade / Alongamento'],equipamento:['Sem equipamento'],locais:['Casa']},{id:'train',name:'Agachamento',contextos_exercicio:['Treino'],categoria:['Membro Inferior'],objetivos_exercicio:['Fortalecimento'],equipamento:['Peso Corporal'],locais:['Ginásio']}];`);
 x.click('[data-ct-add="0:1"]');x.click('[data-ct-tipo="exercicios"]');assert.equal(x.document.querySelectorAll('[data-ct-p-ex]').length,3);x.click('[data-ct-p-ex="therapy"]');x.click('[data-ct-finalidade="treino"]');assert.equal(x.document.querySelectorAll('[data-ct-p-ex]').length,2);assert.equal(x.run('_criarTreino.personalizado.escolhidos[0]'),'therapy');x.click('[data-ct-finalidade="terapeutico"]');assert.equal(x.document.querySelectorAll('[data-ct-p-ex]').length,2);assert.ok(x.get('[data-ct-p-ex="therapy"]').classList.contains('on'));
});
