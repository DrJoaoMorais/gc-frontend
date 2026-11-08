import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { disponibilidadeDasRespostas, disponibilidadeInicial, normalizarDisponibilidade, capturarDisponibilidade, lerDisponibilidadeQuestionario, minutosDisponiveis } from '../modules/exercicio/prescricao/disponibilidade-treino.js';

const token={id:'questionario-1',patient_id:'doente-1',clinic_id:'clinica-1',completed_at:'2026-10-31T14:00:00Z',questionnaire_type:'pre_consulta_v2'};
const rows=(weekday,weekend)=>[{question_id:'exercicio_minutos_dias_uteis',answer:weekday},{question_id:'exercicio_minutos_fim_semana',answer:weekend}];
const report=(a=20,b=60)=>disponibilidadeDasRespostas(rows(a,b),token);
test('20 min on each weekday and 60 on each weekend day; no sessions are created',()=>{
 const r=report();assert.deepEqual(r.disponibilidade.semanal.map(d=>d.min),[20,20,20,20,20,60,60]);assert.equal(r.disponibilidade.sessions,undefined);assert.equal(r.disponibilidade.origem.id,token.id);
});
test('zero is explicitly unavailable and blank is unknown, never assumed to be 30',()=>{
 const r=report(0,null);assert.equal(r.disponibilidade.semanal[0].ativo,false);assert.equal(r.disponibilidade.semanal[0].min,0);assert.equal(r.disponibilidade.semanal[5].min,null);assert.equal(r.disponibilidade.semanal[5].ativo,true);
});
test('old ranges are shown as reported, never converted to precise minutes',()=>{
 const r=disponibilidadeDasRespostas([{question_id:'s4_tempo_realista_sessao',answer:'15–30 min'}],token);assert.equal(r.disponibilidade,null);assert.equal(r.intervaloAnterior,'15–30 min');
});
test('saved physician adjustments take precedence over a newer questionnaire without mutating either',()=>{
 const old=report().disponibilidade;old.semanal[0].min=25;const before=JSON.stringify(old),next=report(45,90);const selected=disponibilidadeInicial(old,next);assert.equal(selected.semanal[0].min,25);selected.semanal[1].min=35;assert.equal(JSON.stringify(old),before);assert.equal(next.disponibilidade.semanal[1].min,45);
});
test('untrusted, negative, fractional and out-of-range answers are not accepted',()=>{
 for(const v of ['20','',{},[],NaN,Infinity,-1,20.5,1441])assert.equal(minutosDisponiveis(v),null);
 assert.equal(minutosDisponiveis(1440),1440);assert.equal(minutosDisponiveis(0),0);assert.equal(report('20',{}).disponibilidade,null);
});
test('weekly edits and dated exceptions survive capture and normalization',()=>{
 const base=report().disponibilidade;const ct={inicio:'2026-11-02',fim:'2026-11-15',origemDisponibilidade:base.origem,semanas:[{disp:base.semanal.map(d=>({...d}))},{disp:Array(7).fill(null)}]};ct.semanas[0].disp[0].min=25;ct.semanas[1].disp[5]={ativo:true,min:90,local:'Ginásio'};
 const get=(w,d)=>ct.semanas[w].disp[d]||ct.semanas[0].disp[d];const date=(d,w)=>'2026-11-'+String(2+d+7*w).padStart(2,'0');const snap=capturarDisponibilidade(ct,get,date);const read=normalizarDisponibilidade(JSON.parse(JSON.stringify(snap)));assert.equal(read.semanal[0].min,25);assert.equal(read.porData['2026-11-14'].min,90);assert.equal(read.porData['2026-11-14'].local,'Ginásio');assert.equal(read.origem.uteis,20);
});
function mockSb({row=token,answers=rows(20,60),error=null}={}){
 const calls=[];return {calls,from(table){calls.push(['from',table]);const result={data:table==='intake_tokens'?row:answers,error};const q={then(resolve){return Promise.resolve(result).then(resolve)}};for(const method of ['select','eq','in','order','limit'])q[method]=(...args)=>{calls.push([method,...args]);return q};q.maybeSingle=async()=>result;return q}};
}
test('reader uses the same patient and clinic, completed questionnaires, newest first and only relevant answers',async()=>{
 const sb=mockSb();const r=await lerDisponibilidadeQuestionario(sb,'doente-1','clinica-1');assert.equal(r.status,'ok');for(const pair of [['eq','patient_id','doente-1'],['eq','clinic_id','clinica-1'],['eq','status','completed'],['eq','token_id',token.id]])assert.ok(sb.calls.some(call=>JSON.stringify(call)===JSON.stringify(pair)));assert.ok(sb.calls.some(c=>c[0]==='limit'&&c[1]===1));assert.ok(sb.calls.some(c=>c[0]==='order'&&c[1]==='completed_at'&&c[2].ascending===false));assert.ok(!sb.calls.some(c=>['insert','update','rpc','delete'].includes(c[0])));
});
test('missing, inaccessible or mismatched questionnaires do not prevent manual prescribing or leak another patient',async()=>{
 assert.equal((await lerDisponibilidadeQuestionario(mockSb({row:null}),'doente-1','clinica-1')).status,'sem_questionario');
 const mismatch=mockSb({row:{...token,patient_id:'outro'}});assert.equal((await lerDisponibilidadeQuestionario(mismatch,'doente-1','clinica-1')).status,'indisponivel');assert.ok(!mismatch.calls.some(c=>c[0]==='from'&&c[1]==='intake_responses'));
 assert.equal((await lerDisponibilidadeQuestionario(mockSb({error:{message:'denied'}}),'doente-1','clinica-1')).status,'indisponivel');
});
test('both questionnaire versions include weekly planning and V2 removes redundant future questions',()=>{
 for(const name of ['pre_consulta','pre_consulta_v2']){
  const path=`modules/intake/configs/${name}.js`;
  const parse=code=>JSON.parse(JSON.stringify(vm.runInNewContext(code.replace('export default','globalThis.config =')+'; config')));
  const after=parse(fs.readFileSync(new URL('../'+path,import.meta.url),'utf8'));
  const all=after.seccoes.flatMap(s=>s.perguntas);
  const newIds=['exercicio_semana_habitual'];
  const legacy=all.filter(q=>!newIds.includes(q.id));
  const originalHashes={"pre_consulta":"26824c2d69c4a39a1b7dc59da9885f0eec706f6668da00001f34f9d8e9117d83","pre_consulta_v2":"4473ccce37f9985b6d0b24216bbd8bf2ee9c7e5a354301df70cc67befe101f26"};
  assert.equal(createHash('sha256').update(JSON.stringify(legacy)).digest('hex'),originalHashes[name]);
  const added=all.filter(q=>newIds.includes(q.id));assert.equal(added.length,1);assert.equal(added[0].tipo,'semana_treino');
 }
});

test('V2 separates weekly availability into section 5 without renaming stored questions',async()=>{
 const {default:cfg}=await import('../modules/intake/configs/pre_consulta_v2.js');
 assert.equal(cfg.seccoes.length,11);
 assert.equal(cfg.seccoes[3].id,'atividade_fisica');
 assert.equal(cfg.seccoes[3].perguntas.some(p=>p.tipo==='semana_treino'),false);
 assert.equal(cfg.seccoes[4].id,'disponibilidade_treino');
 assert.equal(cfg.seccoes[4].perguntas.length,1);
 assert.equal(cfg.seccoes[4].perguntas[0].id,'exercicio_semana_habitual');
 assert.equal(cfg.seccoes[5].id,'sono');
 assert.equal(cfg.seccoes[5].perguntas[0].id,'s5_hora_deitar');
 const ids=cfg.seccoes.flatMap(s=>s.perguntas.map(p=>p.id));assert.equal(new Set(ids).size,ids.length);
 const source=fs.readFileSync(new URL('../modules/intake/intake-motor.js',import.meta.url),'utf8');
 const scope=vm.createContext({_cfg:cfg,_respostas:{exercicio_semana_habitual:[{estado:'treino',tempo:'30',modalidades:['Corrida']}],s5_hora_deitar:'22h00–23h00'},_perguntaTemAlgumaResposta:p=>['exercicio_semana_habitual','s5_hora_deitar'].includes(p.id)});
 const body=source.slice(source.indexOf('function _calcularMaxAlcancada()'),source.indexOf('/* progresso parcial'));
 vm.runInContext(body,scope);assert.equal(vm.runInContext('_calcularMaxAlcancada()',scope),5);
});
