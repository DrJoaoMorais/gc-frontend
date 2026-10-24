import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../modules/pedidos/pedidos-v2.js', import.meta.url), 'utf8');
const start = source.indexOf('  function groupExamRows()');
const end = source.indexOf('  /* ---- PDF: Exames', start);
const rows = [
  {id:'right',category:'Ressonância Magnética',exam_name:'RM do Joelho Direito',body_region:'joelho'},
  {id:'left',category:'Ressonância Magnética',exam_name:'RM do Joelho Esquerdo',body_region:'joelho'},
  {id:'rx',category:'Radiografia',exam_name:'Radiografia do Joelho Direito em carga',body_region:'joelho'},
  {id:'eco',category:'Ecografia',subcategory:'Osteoarticular',exam_name:'Ecografia do Ombro Esquerdo',body_region:'ombro'}
];
const context = vm.createContext({rows});
vm.runInContext(`
  const state={exames:{rows,selected:new Set(['right','left','rx']),clinicalInfoByExam:new Map([['right','Suspeita de lesão meniscal direita.'],['left','Gonalgia esquerda <script>alert(1)</script>']]),customExam:{name:'Outro exame <teste>',info:'Rastreio & vigilância'}}};
  const escHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalizeTxt=s=>String(s??'').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'');
  const examGroupLabel=e=>[e.category,e.subcategory].filter(Boolean).join(' ');
  ${source.slice(start,end)}
  globalThis.entries=examEntries;
  globalThis.matches=(row,query)=>matchesExamSearch(row,normalizeTxt(query));
  globalThis.remove=id=>state.exames.selected.delete(id);
`,context);
assert.ok(context.matches(rows[0],'RM joelho direito'));
assert.ok(!context.matches(rows[1],'RM joelho direito'));
assert.ok(context.matches(rows[2],'RX joelho'));
assert.ok(context.matches(rows[3],'eco ombro esquerdo'));
assert.ok(!context.matches(rows[2],'RM joelho'));
let entries=context.entries();
assert.equal(entries.length,3,'1 PDF por modalidade, mais o exame livre');
assert.equal(entries[0].label,'Ressonância Magnética');
assert.ok(entries[0].contentHtml.includes('Joelho Direito'));
assert.ok(entries[0].contentHtml.includes('Joelho Esquerdo'));
assert.ok(entries[0].contentHtml.includes('lesão meniscal direita'));
assert.ok(entries[0].contentHtml.includes('&lt;script&gt;'));
assert.ok(!entries[0].contentHtml.includes('<script>'));
assert.ok(!entries[1].contentHtml.includes('lesão meniscal'));
assert.equal(entries[2].custom,true);
assert.ok(entries[2].contentHtml.includes('Outro exame &lt;teste&gt;'));
assert.ok(entries[2].contentHtml.includes('Rastreio &amp; vigilância'));
context.remove('left');
entries=context.entries();
assert.ok(!entries[0].contentHtml.includes('Joelho Esquerdo'));
assert.ok(!entries[0].contentHtml.includes('Gonalgia esquerda'));
console.log('PASS: lados explícitos, pesquisa RM/RX/eco, modalidade, informação clínica por exame, remoção e texto livre escapado.');

// A emissão deve usar os PDFs revistos e parar perante uma falha de gravação.
const emitStart=source.indexOf('  async function onGerarExamesPdf()');
const emitEnd=source.indexOf('  function renderExamesResultsSummary()',emitStart);
const emitContext=vm.createContext({console:{error(){}}});
vm.runInContext(`
  const state={exames:{generating:false,customExam:{name:'Livre',info:'Motivo'}},patient:{clinicId:'clinic'},patientId:'ficticio'};
  const docs=[{label:'RM',html:'html-rm',blob:{id:'pdf-rm'}},{label:'RX',html:'html-rx',blob:{id:'pdf-rx'}},{label:'Livre',custom:true,html:'html-livre',blob:{id:'pdf-livre'}}];
  const examPreview={key:'revisto',documents:docs};
  const examPreviewKey=()=>'revisto';
  const renderExamesPanel=()=>{};
  const slugifyLabel=s=>s;
  const generateDocNumber=()=>'teste';
  const URL={createObjectURL:()=> 'blob:teste'};
  let uploads=[],failAt=2;
  async function uploadAndRegisterDocument(args){uploads.push(args);if(uploads.length===failAt)throw Error('Falha simulada');}
  ${source.slice(emitStart,emitEnd)}
  globalThis.emit=onGerarExamesPdf;
  globalThis.snapshot=()=>({uploads,results:state.exames.lastRun.results,custom:state.exames.customExam,generating:state.exames.generating});
  globalThis.reset=()=>{uploads=[];failAt=0;};
`,emitContext);
await emitContext.emit();
let snapshot=emitContext.snapshot();
assert.equal(snapshot.uploads.length,2,'Parar antes do terceiro PDF');
assert.equal(snapshot.results[0].ok,true);
assert.equal(snapshot.results[1].ok,false);
assert.equal(snapshot.custom.name,'Livre','Não apagar o exame livre que não foi emitido');
assert.equal(snapshot.generating,false);
assert.equal(snapshot.uploads[0].blob.id,'pdf-rm');
assert.equal(snapshot.uploads[1].html,'html-rx');
emitContext.reset();
await emitContext.emit();
snapshot=emitContext.snapshot();
assert.equal(snapshot.results.length,3);
assert.ok(snapshot.results.every(r=>r.ok));
assert.equal(snapshot.custom.name,'','Limpar o exame livre só depois de emitido');
console.log('PASS: emissão usa os PDFs revistos, pára na falha e preserva o exame livre não emitido.');
