// Run with node --test tests/acompanhamento-navigation.test.cjs.
// Isolated navigation checks. No browser session, network, or clinical records.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../modules/acompanhamento-clinico.html'),'utf8');
function setup(){
 const node=(id)=>({id,hidden:false,dataset:{},textContent:'',value:'',attrs:{},classList:{toggle(){}},setAttribute(k,v){this.attrs[k]=v}});
 const ids=Object.fromEntries(['accessDomains','returnAccess','carePlan','careAreaTitle','careAreaContent'].map(id=>[id,node(id)]));
 const modules=['activity','pathology','med','diary','question'].map(key=>node(key+'Module'));modules.forEach(n=>ids[n.id]=n);
 const tabs=['summary','activity','pathology','med','diary','question','calendar'].map(key=>{const n=node(key);n.dataset.careArea=key;return n});
 const layout=node('layout'),actions=node('actions'),breadcrumb=node('breadcrumb'),history=[node('evolution'),node('results')];
 const form=node('medName');form.value='Rascunho clínico';
 const context={document:{body:{dataset:{},classList:{toggle(){}}},querySelectorAll(s){return s==='.config .module'?modules:s==='.care-area-tabs [data-care-area]'?tabs:history},querySelector(s){return s==='.layout'?layout:s==='.config-actions'?actions:breadcrumb}},$:id=>ids[id],alert:()=>{context.alerts++},alerts:0};
 vm.createContext(context);
 const start=html.indexOf('function showAccessEditor(key){'),end=html.indexOf('async function persistAccess(',start);
 vm.runInContext(`let careArea='summary',careExerciseArea=null,careAreaRequest=0;let pending=false,editing=false,closed=0,opened=0;let careExercise={hasUnsavedChanges:()=>pending,hasActiveEditor:()=>editing,closePathology:()=>closed++,open:()=>opened++};let initCareCalendar=async()=>{};${html.slice(start,end)};globalThis.api={selectCareArea,showAccessEditor,get area(){return careArea},get closed(){return closed},get opened(){return opened},draft(value){pending=value},edit(value){editing=value},wait(fn){initCareCalendar=fn}}`,context);
 return {...context,api:context.api,ids,modules,tabs,layout,actions,history,form,context};
}
test('all inline scripts parse',()=>{
 const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).filter(Boolean);
 assert.ok(scripts.length>=2);scripts.forEach(code=>new vm.Script(code));
});
test('each clinical tab isolates its editor and hides the exercise calendar',async()=>{
 for(const area of ['med','diary','question']){
  const x=setup();await x.api.selectCareArea(area);
  assert.deepEqual(x.modules.filter(n=>!n.hidden).map(n=>n.id),[area+'Module']);
  assert.equal(x.ids.carePlan.hidden,true);assert.equal(x.layout.hidden,false);
  assert.equal(x.tabs.filter(n=>n.attrs['aria-selected']==='true')[0].dataset.careArea,area);
 }
});
test('tab changes preserve mounted form values',async()=>{
 const x=setup();await x.api.selectCareArea('med');const before=x.form;
 await x.api.selectCareArea('diary');await x.api.selectCareArea('summary');await x.api.selectCareArea('med');
 assert.equal(x.form,before);assert.equal(x.form.value,'Rascunho clínico');
});
test('calendar hides medication, diary and save controls',async()=>{
 const x=setup();await x.api.selectCareArea('calendar');assert.ok(x.modules.every(n=>n.hidden));assert.equal(x.layout.hidden,true);assert.equal(x.actions.hidden,true);assert.equal(x.ids.carePlan.hidden,false);
});
test('an exercise draft cannot be discarded by switching exercise subviews',async()=>{
 const x=setup();await x.api.selectCareArea('activity');x.api.draft(true);const closed=x.api.closed;
 await x.api.selectCareArea('pathology');assert.equal(x.api.area,'activity');assert.equal(x.api.closed,closed);assert.equal(x.context.alerts,1);
 await x.api.selectCareArea('med');assert.equal(x.api.area,'med');await x.api.selectCareArea('activity');assert.equal(x.api.closed,closed);
});
test('a new workout editor is protected even before a session enters the plan',async()=>{
 const x=setup();await x.api.selectCareArea('activity');x.api.edit(true);const closed=x.api.closed;
 await x.api.selectCareArea('calendar');assert.equal(x.api.area,'activity');assert.equal(x.api.closed,closed);
});
test('late exercise loading does not reopen an editor after another tab was chosen',async()=>{
 const x=setup();let finish;x.api.wait(()=>new Promise(resolve=>finish=resolve));
 const loading=x.api.selectCareArea('pathology');await x.api.selectCareArea('med');finish();await loading;
 assert.equal(x.api.area,'med');assert.equal(x.api.opened,0);
});
test('history has an explicit summary destination',()=>{
 const x=setup();x.api.showAccessEditor('history');assert.ok(x.history.every(n=>!n.hidden));x.api.showAccessEditor('summary');assert.ok(x.history.every(n=>n.hidden));assert.equal(x.ids.accessDomains.hidden,false);
});
