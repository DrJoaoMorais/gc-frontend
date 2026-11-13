import intakeV2 from '../intake/configs/pre_consulta_v2.js';
import intakeV1 from '../intake/configs/pre_consulta.js';
import { resultHtml, resultSummaryHtml } from '../terapeuta/forms.js';
import { buildTimelineSessions, resolveSessionDate, classifySession } from './acompanhamento/acompanhamento.js?v=20261110-clinico';
import { lisbonDate } from './followup-model.js?v=20261112-compacto';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=v=>v?(String(v).length===10?String(v):lisbonDate(v)).split('-').reverse().join('/'):'Sem data';
const arr=v=>Array.isArray(v)?v:[];
const answer=v=>v&&typeof v==='object'&&!Array.isArray(v)&&'v' in v?[answer(v.v),v.outro_texto].filter(Boolean).join(' · '):v==null?'—':typeof v==='boolean'?(v?'Sim':'Não'):Array.isArray(v)?v.map(answer).join(' · '):typeof v==='object'?Object.entries(v).map(([k,x])=>`${k}: ${answer(x)}`).join(' · '):String(v);
const configs={pre_consulta:intakeV1,pre_consulta_v2:intakeV2};
const empty=label=>`<p class="ca-muted">${label}</p>`;
const disclosure=(label,body)=>`<details class="ca-disclosure"><summary>${label}</summary>${body}</details>`;
const table=(heads,rows)=>`<div class="ca-table"><table><thead><tr>${heads.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
const stateLabels={HOJE:'Prevista para hoje',PREVISTA:'Programada',INDETERMINADO:'Estado por confirmar',REMOVIDA_ANTES:'Removida antes de iniciar',REMOVIDA_DEPOIS:'Removida após início',as_prescribed:'Conforme prescrito',adjusted:'Adaptado',modified:'Alterado',skipped:'Não realizado',not_done:'Não realizado',alteracao_dose:'Alteração de dose',suspensao:'Suspensão',REALIZADA:'Com registo final',NAO_REALIZADA:'Sem registo final',INICIADA_SEM_REGISTO:'Iniciada, sem conclusão',PLANEADA:'Programada',REMOVIDA:'Removida',completed:'Concluído',in_progress:'Em preenchimento',pending_rgpd:'Por iniciar',expired:'Prazo terminado',pending:'Pendente',planned:'Programado',done:'Registado',cancelled:'Cancelado',active:'Ativo',revoked:'Desativado'};
const label=v=>stateLabels[v]||v||'—';
// Every parent read is scoped by both patient and clinic. Child reads use only
// IDs returned by those parent reads. No tokens, writes or privileged RPCs.
export async function loadAnalysisData(sb,patientId,clinicId) {
 const failures=[];
 const read=async(name,table,cols,filters,order='id')=>{
  try {const rows=[];for(let offset=0;;offset+=500){let q=sb.from(table).select(cols);for(const [key,ids] of filters)q=q.in(key,ids);for(const key of arr(order).length?order:[order])q=q.order(key);const r=await q.range(offset,offset+499);if(r.error)throw r.error;rows.push(...(r.data||[]));if((r.data||[]).length<500)return rows;}}
  catch {failures.push(name);return [];}
 };
 const scope=[['patient_id',[patientId]],['clinic_id',[clinicId]]];
 const children=async(name,table,cols,key,ids,extra=[],order='id')=>{const out=[];for(let i=0;i<ids.length;i+=100)out.push(...await read(name,table,cols,[[key,ids.slice(i,i+100)],...extra],order));return out;};
 const [rx,questions,scales,therapist,diary,protocols,links]=await Promise.all([
  read('Planos','wo_prescriptions','id,patient_id,clinic_id,status,created_at,data',scope),
  read('Questionários','intake_tokens','id,patient_id,clinic_id,questionnaire_type,status,created_at,completed_at',scope),
  // Separate clinical-scale foundation has no staff read API. Keep its unavailable state explicit.
  Promise.resolve([]),
  (async()=>{const consultations=await read('Consultas das avaliações','consultations','id,patient_id,clinic_id',scope);const out=[];for(const c of consultations){try{const r=await sb.rpc('therapist_scale_list',{p_consultation:c.id});if(r.error)throw r.error;out.push(...arr(r.data).map(x=>({...x,patient_id:patientId,clinic_id:clinicId})));}catch{failures.push('Avaliações funcionais');}}return out;})(),
  read('Diário','patient_diary_entries','id,patient_id,clinic_id,entered_at,raw_text,images',scope),
  read('Protocolos','consultation_protocols','id,patient_id,clinic_id,protocol_id,phase_id,protocol_date,created_at,data',scope),
  read('Ligações de medicação','patient_portal_links','id,patient_id,created_clinic_id',[['patient_id',[patientId]],['created_clinic_id',[clinicId]]])
 ]);
 const [logs,readiness,snapshots,responses,validations,scaleResponses,medications,phases,catalog]=await Promise.all([
  children('Registos de exercício','wo_session_logs','id,prescription_id,patient_id,clinic_id,session_id,logged_at,rpe,feel,sets,note','prescription_id',rx.map(x=>x.id),scope),
  children('Pré-treino','wo_session_readiness','id,prescription_id,patient_id,clinic_id,session_id,session_date,feeling,has_symptoms,symptom_note,answered_at','prescription_id',rx.map(x=>x.id),scope),
  children('Prescrição histórica','wo_session_prescription_snapshots','id,prescription_id,patient_id,clinic_id,session_id,session_date,snapshot,frozen_at,removed_at','prescription_id',rx.map(x=>x.id),scope),
  children('Respostas dos questionários','intake_responses','id,token_id,question_id,answer,updated_at','token_id',questions.map(x=>x.id)),
  children('Resultados validados','clinical_scale_validations','id,request_id,supersedes_validation_id,patient_score,clinician_score,total_score,result_snapshot,validated_at','request_id',scales.map(x=>x.id)),
  children('Respostas das escalas','clinical_scale_responses','request_id,question_id,answer,answered_at','request_id',scales.map(x=>x.id),[],['request_id','question_id']),
  children('Medicação','patient_medication','id,link_id,clinic_id,nome,dose,freq,principio_ativo,data_inicio,data_fim,enabled','link_id',links.map(x=>x.id),[['clinic_id',[clinicId]]]),
  children('Nomes das fases','protocol_phases','id,protocol_id,name,phase_order,anchor_kind,anchor_from,anchor_to','id',[...new Set(protocols.map(x=>x.phase_id).filter(Boolean))]),
  children('Nomes dos protocolos','protocols_catalog','id,name','id',[...new Set(protocols.map(x=>x.protocol_id).filter(Boolean))])
 ]);
 const medicationEvents=await children('Alterações da medicação','patient_medication_events','id,medication_id,clinic_id,event_date,event_type,dose,instructions,status','medication_id',medications.map(x=>x.id),[['clinic_id',[clinicId]]]);
 return {rx,questions,scales,therapist,diary,protocols,logs,readiness,snapshots,responses,validations,scaleResponses,medications,medicationEvents,phases,catalog,failures:[...new Set(failures)]};
}
export function analysisSessions(data,today=lisbonDate(new Date())) {
 return data.rx.filter(rx=>rx.status!=='draft').flatMap(rx=>{
  const belongs=r=>r.prescription_id===rx.id&&r.patient_id===rx.patient_id&&r.clinic_id===rx.clinic_id;
  return buildTimelineSessions(rx,data.snapshots.filter(belongs),data.readiness.filter(belongs),data.logs.filter(belongs)).map(entry=>({
   ...entry,rx,date:resolveSessionDate(entry)||entry.readiness?.session_date||null,state:classifySession(entry,today),
   prescribed:entry.snapshot?.snapshot||null,
   planned:arr(rx.data?.sessions).find(s=>s.session_id===entry.sessionId)||null
  }));
 }).sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
}
export function pairedSummary(sessions) {
 const pairs=sessions.filter(s=>Number.isFinite(s.readiness?.feeling)&&Number.isFinite(s.log?.feel));
 return {n:pairs.length,pre:pairs.length?pairs.reduce((n,s)=>n+s.readiness.feeling,0)/pairs.length:null,post:pairs.length?pairs.reduce((n,s)=>n+s.log.feel,0)/pairs.length:null};
}
function chart(sessions,start,end,metric='wellbeing') {
 const points=sessions.filter(s=>s.date&&s.date>=start&&s.date<=end),width=900,height=190,pad=30;
 const min=metric==='effort'?0:1,max=metric==='effort'?10:5,series=metric==='effort'?[['rpe', 'log','#b17529',0]]:[['feeling','readiness','#2670c5',-3],['feel','log','#149281',3]];
 const span=Math.max(86400000,new Date(end)-new Date(start));
 const x=d=>pad+(new Date(d)-new Date(start))/span*(width-pad*2),y=n=>height-pad-(n-min)/(max-min)*(height-pad*2);
 return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${metric==='effort'?'Esforço percebido por sessão, de 0 a 10':'Bem-estar antes e depois, de 1 a 5'}. Valores em falta não são ligados.">${(max===10?[0,2,4,6,8,10]:[1,2,3,4,5]).map(n=>`<line x1="${pad}" x2="${width-pad}" y1="${y(n)}" y2="${y(n)}" stroke="#e5ebf3"/><text x="8" y="${y(n)+4}" fill="#67788d" font-size="12">${n}</text>`).join('')}${points.map(s=>series.map(([k,source,color,dx])=>{const r=s[source];return Number.isFinite(r?.[k])?`<circle cx="${x(s.date)+dx}" cy="${y(r[k])}" r="5" fill="${color}"><title>${date(s.date)} · ${k==='rpe'?'Esforço':k==='feel'?'Depois':'Antes'}: ${r[k]}/${max}</title></circle>`:'';}).join('')).join('')}</svg>`;
}
function questionnaireHTML(data) {
 const groups=new Map();for(const q of data.questions){if(!groups.has(q.questionnaire_type))groups.set(q.questionnaire_type,[]);groups.get(q.questionnaire_type).push(q);}
 return [...groups].map(([type,qs])=>{
  qs.sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at)));const config=configs[type];
  const sections=config?.seccoes||[{titulo:type,perguntas:[...new Set(data.responses.filter(r=>qs.some(q=>q.id===r.token_id)).map(r=>r.question_id))].map(id=>({id,label:id}))}];
  return `<h3>${esc(config?.titulo||type)}</h3><p class="ca-muted">Cada coluna é um preenchimento. Respostas incompletas estão identificadas.</p>${sections.map(section=>{
   const questions=section.perguntas.filter(p=>data.responses.some(r=>r.question_id===p.id&&qs.some(q=>q.id===r.token_id)));if(!questions.length)return '';
   return disclosure(esc(section.titulo),table(['Pergunta',...qs.map(q=>`${date(q.completed_at||q.created_at)}<small>${esc(label(q.status))}</small>`)],questions.map(p=>`<tr><th>${esc(p.label)}</th>${qs.map(q=>`<td>${esc(answer(data.responses.find(r=>r.token_id===q.id&&r.question_id===p.id)?.answer))}</td>`).join('')}</tr>`)));
  }).join('')}`;
 }).join('')||empty('Sem questionários disponíveis.');
}
export function comparableOutcomes(data){
 const points=[];
 for(const r of data.therapist)if(r.status==='completed')for(const def of arr(r.definitions)){
  const a=r.answers?.[def.id],score=r.results?.[def.id]?.total;
  if(a?.status==='done'&&typeof score==='number')points.push({key:'functional:'+JSON.stringify(def),title:def.title,date:r.respondent?.date||r.completed_at,value:score,unit:def.maxScore!=null?'/'+def.maxScore:''});
 }
 for(const r of data.scales){const v=data.validations.filter(v=>v.request_id===r.id).sort((a,b)=>String(b.validated_at).localeCompare(String(a.validated_at)))[0];
  if(v?.total_score!=null&&Number.isFinite(Number(v.total_score)))points.push({key:JSON.stringify([r.scale_type,r.side,r.config_hash,r.formula_hash,r.config_version,r.formula_version]),title:r.scale_type+(r.side?' · '+r.side:''),date:r.patient_completed_at||v.validated_at,value:Number(v.total_score),unit:''});
 }
 const groups=new Map();for(const p of points){if(!groups.has(p.key))groups.set(p.key,[]);groups.get(p.key).push(p);}
 return [...groups.values()].map(points=>points.sort((a,b)=>String(a.date).localeCompare(String(b.date))));
}
function outcomeComparison(data){const groups=comparableOutcomes(data);if(!groups.length)return '';
 return table(['Medida','Primeiro resultado','Mais recente','Variação'],groups.map(points=>{const first=points[0],last=points.at(-1),delta=last.value-first.value;return `<tr><td><b>${esc(first.title)}</b><small>${points.length} avaliação(ões) comparáveis</small></td><td>${esc(first.value)}${esc(first.unit)}<small>${date(first.date)}</small></td><td>${esc(last.value)}${esc(last.unit)}<small>${date(last.date)}</small></td><td>${points.length>1?(delta>0?'+':'')+delta.toLocaleString('pt-PT'):'—'}</td></tr>`;}))+`<p class="ca-muted">Comparação apenas da mesma escala e versão. A variação numérica não determina, por si só, relevância clínica.</p>`;
}
function scalesHTML(data) {
 const clinical=data.scales.map(s=>{
  const versions=data.validations.filter(v=>v.request_id===s.id).sort((a,b)=>String(b.validated_at).localeCompare(String(a.validated_at)));
  const v=versions[0];return disclosure(`${esc(s.scale_type)} · ${esc(s.side||'sem lateralidade')} · ${date(s.patient_completed_at||s.requested_at)}${v?` · ${esc(v.total_score??'—')}`:' · por validar'}`,`<p>Versão ${esc(s.config_version)} · Fórmula ${esc(s.formula_version)}</p>${v?`<p>Resultado validado: <b>${esc(v.total_score??'—')}</b> · ${date(v.validated_at)}</p>${disclosure('Resultado original',`<p>${esc(answer(v.result_snapshot))}</p>`)}`:empty('Sem resultado validado.')}${table(['Item','Resposta'],data.scaleResponses.filter(r=>r.request_id===s.id).map(r=>`<tr><td>${esc(r.question_id)}</td><td>${esc(answer(r.answer))}</td></tr>`))}`);
 });
 const functional=data.therapist.map(r=>disclosure(`Avaliação funcional · ${date(r.completed_at||r.created_at)} · ${esc(label(r.status))}`,resultSummaryHtml(r)+disclosure('Respostas e interpretação da escala',resultHtml(r,{heading:false}))));
 return [...clinical,...functional].join('')||empty('Sem avaliações funcionais disponíveis.');
}
export function shiftDay(day,n){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
export function monday(day){const d=new Date(day+'T12:00:00Z');return shiftDay(day,-((d.getUTCDay()+6)%7));}
export function validRange(from,to,today){return /^\d{4}-\d{2}-\d{2}$/.test(from)&&/^\d{4}-\d{2}-\d{2}$/.test(to)&&Number.isFinite(Date.parse(from))&&Number.isFinite(Date.parse(to))&&new Date(from).toISOString().slice(0,10)===from&&new Date(to).toISOString().slice(0,10)===to&&from<=to&&to<=today;}
function dose(item){
 const durations=arr(item.duration_series).map(x=>x.duration_sec).filter(v=>v!=null);
 const series=arr(item.series),reps=series.map(x=>x.reps).filter(v=>v!=null);
 const count=item.sets??series.length;
 const compact=(values,unit)=>values.every(v=>v===values[0])?values.length+' × '+values[0]+' '+unit:values.join(' / ')+' '+unit;
 const main=durations.length?compact(durations,'s'):reps.length?compact(reps,'rep.'):[count?count+' séries':null,item.reps_fixed!=null?item.reps_fixed+' rep.':item.reps_min!=null?[item.reps_min,item.reps_max].filter(v=>v!=null).join('–')+' rep.':null,item.duration_sec!=null?item.duration_sec+' s':null].filter(Boolean).join(' × ');
 const loads=series.map(x=>x.load).filter(v=>v!=null&&v!=='');
 return [main,item.load!=null&&item.load!==''?item.load+' kg':loads.length?(loads.every(v=>String(v)===String(loads[0]))?loads[0]:loads.join(' / '))+' kg':null].filter(Boolean).join(' · ')||'Dose não registada';
}
function execution(actual){return actual?`${esc(label(actual.status))}${(arr(actual.series).length||arr(actual.duration_series).length||actual.duration_sec!=null)?` · ${esc(dose(actual))}`:''}${actual.note?`<small>${esc(actual.note)}</small>`:''}`:'Sem registo';}
export function exerciseHTML(s) {
 const snapshot=s.prescribed,items=arr(snapshot?.items);
 const cards=items.map(item=>{
  const actual=item.exercise_id?arr(s.log?.sets).find(x=>x.exercise_id===item.exercise_id):null;
  const photo=typeof item.photo_url==='string'&&/^https:\/\//i.test(item.photo_url)?item.photo_url:null;
  return `<article class="ca-exercise">${photo?`<img src="${esc(photo)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:'<span class="ca-exercise-placeholder" aria-hidden="true">—</span>'}<div><b>${esc(item.name||item.exercise_name||item.title||'Exercício')}</b><small>Prescrito · ${esc(dose(item))}</small><small class="ca-execution">${execution(actual)}</small>${item.prescription_note?`<small>${esc(item.prescription_note)}</small>`:''}</div></article>`;
 }).join('');
 const intensity=b=>[b?.zone,b?.rpe!=null?'RPE '+b.rpe:null,b?.pace_sec_per_km!=null?b.pace_sec_per_km+' s/km':null].filter(Boolean).join(' · ');
 const blocks=arr(snapshot?.blocks).map((b,i)=>`<article class="ca-exercise ca-block"><div><b>${esc(b.name||b.title||(b.type==='series'?'Intervalos':b.type==='continuous'?'Contínuo':'Bloco '+(i+1)))}</b><small>${esc([b.duration_min!=null?b.duration_min+' min':null,b.duration_sec!=null?b.duration_sec+' s':null,intensity(b.intensity),b.type==='series'?[b.count!=null?b.count+' ×':null,b.work?.duration_sec!=null?b.work.duration_sec+' s':null,intensity(b.work?.intensity),b.recovery?.duration_sec!=null?'Recuperação '+b.recovery.duration_sec+' s':null,intensity(b.recovery?.intensity)].filter(Boolean).join(' · '):null,b.notes].filter(Boolean).join(' · '))}</small></div></article>`).join('');
 const orphan=arr(s.log?.sets).filter(r=>!items.some(it=>it.exercise_id&&it.exercise_id===r.exercise_id));
 return `<div class="ca-session-heading"><b>${esc(snapshot?.modality||s.planned?.modality||'Exercício')}</b><small>${esc(label(s.state))}</small></div>${!snapshot?empty('Detalhe histórico da prescrição não disponível.'):''}<div class="ca-exercise-grid">${cards||blocks}</div>${orphan.length?disclosure('Execução sem exercício identificado',orphan.map(r=>`<p>${execution(r)}</p>`).join('')):''}${s.readiness?.symptom_note?`<p class="ca-session-note"><b>Sintomas:</b> ${esc(s.readiness.symptom_note)}</p>`:''}${s.log?.note?`<p class="ca-session-note"><b>Após exercício:</b> ${esc(s.log.note)}</p>`:''}`;
}
export function mountAnalysisPage({root,c,clinicName,onBack,onOpen}) {
 const returnFocus=document.activeElement,returnScroll=window.scrollY;
 const previous=root.querySelector('.gc-cc');if(previous)previous.hidden=true;
 const host=document.createElement('section');host.className='gc-analysis';host.setAttribute('aria-label','Análise clínica individual');root.append(host);
 let data=null,tab='overview',period=30,selectedDay=null,metric='wellbeing',customFrom='',customTo='',weekStart=null;
 const today=lisbonDate(new Date());
 const close=()=>{host.remove();if(previous)previous.hidden=false;returnFocus?.focus({preventScroll:true});window.scrollTo(0,returnScroll);onBack?.();};
 host.innerHTML='<p role="status">A reunir os dados deste doente…</p><button type="button" data-ca-back>← Voltar à lista</button>';
 host.onclick=e=>{if(e.target.closest('[data-ca-back]'))close();};
 host.scrollIntoView({block:'start'});
 host.addEventListener('error',e=>{if(e.target.matches('.ca-exercise img'))e.target.hidden=true;},true);
 const end=()=>period==='custom'?customTo:today;
 const start=()=>{if(period==='custom')return customFrom;if(!period)return '0001-01-01';const d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-period+1);return d.toISOString().slice(0,10);};
 function render() {
  if(!host.isConnected)return;
  const all=analysisSessions(data,today),from=start(),to=end(),sessions=all.filter(s=>s.date&&s.date>=from&&s.date<=to),paired=pairedSummary(sessions);
  const recorded=sessions.filter(s=>s.log).length,pre=sessions.filter(s=>s.readiness),symptomDays=new Set(pre.filter(s=>s.readiness.has_symptoms===true).map(s=>s.date)).size;
  const notes=data.diary.filter(d=>lisbonDate(d.entered_at)>=from&&lisbonDate(d.entered_at)<=to);
  host.innerHTML=`<style>${analysisCSS}</style><header class="ca-header"><button type="button" data-ca-back>← Doentes</button><div><p class="ca-eyebrow">ANÁLISE CLÍNICA</p><h2>${esc(c.name)}</h2><p class="ca-muted">${esc(clinicName)} · Histórico do doente nesta clínica</p></div><button type="button" data-ca-open>Abrir ficha</button></header><nav class="ca-nav" aria-label="Análise do doente">${[['overview','Visão geral'],['exercise','Exercício e tratamento'],['questions','Questionários e escalas'],['diary','Diário']].map(([key,title])=>`<button type="button" data-ca-tab="${key}" aria-pressed="${tab===key}">${title}</button>`).join('')}</nav>${data.failures.length?`<p class="ca-warning" role="alert">Análise incompleta. Não foi possível carregar: ${data.failures.map(esc).join(', ')}. <button type="button" data-ca-retry>Tentar novamente</button></p>`:''}<div class="ca-period"><span>${tab==='questions'?'Todos os preenchimentos · comparação por pergunta':'Período de observação'}</span>${tab!=='questions'?`<div class="ca-segments" role="group" aria-label="Período">${[[14,'14 dias'],[30,'30 dias'],[90,'90 dias'],[0,'Tudo'],['custom','Escolher datas']].map(([n,l])=>`<button type="button" data-ca-period="${n}" aria-pressed="${n===period}">${l}</button>`).join('')}</div>`:''}</div>${tab!=='questions'&&period==='custom'?`<form class="ca-range"><label>De<input type="date" name="from" value="${customFrom}" max="${today}" required></label><label>Até<input type="date" name="to" value="${customTo}" max="${today}" required></label><button type="submit">Aplicar</button><span role="alert" data-range-error></span></form>`:''}<div data-ca-content></div>`;
  const body=host.querySelector('[data-ca-content]');
  if(tab==='overview'){
   const clinicalMissing=data.failures.some(x=>['Planos','Registos de exercício','Pré-treino','Prescrição histórica'].includes(x));
   const stat=(title,value,detail)=>`<article class="ca-stat"><span>${title}</span><strong>${clinicalMissing?'—':value}</strong><small>${clinicalMissing?'Fonte incompleta':detail}</small></article>`;
   const plotStart=period?from:sessions[0]?.date||today;
   body.innerHTML=`<div class="ca-stats">${stat('Exercício registado',recorded,`${sessions.length} sessões datadas no período`)}${stat('Dias com sintomas',symptomDays,`${new Set(pre.map(s=>s.date)).size} dias com resposta pré-treino`)}${stat('Bem-estar antes → depois',paired.n?`${paired.pre.toLocaleString('pt-PT',{minimumFractionDigits:1,maximumFractionDigits:1})} → ${paired.post.toLocaleString('pt-PT',{minimumFractionDigits:1,maximumFractionDigits:1})}`:'—',paired.n?`Média /5 · ${paired.n} sessões com ambas as respostas`:'Sem pares de respostas')}</div><section class="ca-card"><div class="ca-title"><div><h3>Como responde ao exercício?</h3><p class="ca-muted">${metric==='effort'?'Esforço percebido · RPE /10':'<i class="ca-dot before"></i> Antes <i class="ca-dot after"></i> Depois · bem-estar /5'}</p></div><div class="ca-segments" role="group" aria-label="Medida no gráfico">${[['wellbeing','Bem-estar'],['effort','Esforço']].map(([v,l])=>`<button type="button" data-ca-metric="${v}" aria-pressed="${metric===v}">${l}</button>`).join('')}</div></div>${sessions.some(s=>metric==='effort'?s.log?.rpe!=null:s.readiness?.feeling!=null||s.log?.feel!=null)?chart(sessions,plotStart,to,metric):empty('Sem medidas neste período. Experimenta «Todo o histórico».')}<div class="ca-axis"><span>${date(plotStart)}</span><span>${date(to)}</span></div><p class="ca-muted">${metric==='effort'?'RPE: esforço percebido registado após o exercício.':'1 = muito mal · 5 = muito bem. Bem-estar não é uma escala de dor.'}</p></section><section class="ca-card"><h3>O que aconteceu em cada dia?</h3><p class="ca-muted">Seleciona uma data para relacionar exercício, sintomas e tratamento.</p>${timeline(sessions,notes,from,to)}<div data-ca-day></div></section>`;
   if(selectedDay)renderDay(body,sessions,notes,selectedDay);
  }
  if(tab==='exercise')body.innerHTML=`${baseline(data)}<section class="ca-card"><h3>Protocolos e fases registados</h3>${data.protocols.map(p=>`<p><b>${esc(data.catalog.find(x=>x.id===p.protocol_id)?.name||'Protocolo sem nome disponível')}</b> · ${esc(data.phases.find(x=>x.id===p.phase_id)?.name||'Fase não identificada')}<small>${date(p.protocol_date||p.created_at)} · associação registada, não confirma a fase atual</small></p>`).join('')||empty('Sem associação estruturada a protocolo/fase.')}${disclosure('Origem indicada nos planos',data.rx.map(r=>`<p>${date(r.created_at)} · ${esc(label(r.status))}</p>${[...new Set(arr(r.data?.sessions).map(s=>String(s.notes||'').split('\n')[0]).filter(n=>n.startsWith('Origem:')))].map(n=>`<p>${esc(n)}</p>`).join('')}`).join(''))}</section><section class="ca-card"><h3>Medicação prescrita</h3>${medicationHTML(data.medications,from,to)}${disclosure('Alterações registadas',data.medicationEvents.map(e=>`<p>${date(e.event_date)} · ${esc(data.medications.find(m=>m.id===e.medication_id)?.nome)} · ${esc(label(e.event_type))} · ${esc(label(e.status))}<small>${esc([e.dose,e.instructions].filter(Boolean).join(' · '))}</small></p>`).join('')||empty('Sem alterações registadas.'))}<p class="ca-muted">Dose guardada atualmente; alterações anteriores disponíveis abaixo. Prescrição não confirma toma.</p></section><section class="ca-card"><h3>Sessões e exercícios</h3>${timeline(sessions,notes,from,to)}<div data-ca-day></div>${all.some(s=>!s.date)?disclosure('Sessões sem data confirmada',all.filter(s=>!s.date).map(exerciseHTML).join('')):''}</section>`;
  if(tab==='exercise'&&selectedDay)renderDay(body,sessions,notes,selectedDay);
  if(tab==='questions')body.innerHTML=`<section class="ca-card"><h3>Avaliações funcionais</h3><p class="ca-muted">Escalas clínicas do módulo separado ainda sem integração de consulta disponível.</p>${outcomeComparison(data)}${scalesHTML(data)}</section><section class="ca-card">${questionnaireHTML(data)}</section>`;
  if(tab==='diary')body.innerHTML=`<section class="ca-card"><h3>O que o doente relatou</h3>${notes.slice().sort((a,b)=>b.entered_at.localeCompare(a.entered_at)).map(d=>disclosure(date(lisbonDate(d.entered_at)),`<p class="ca-original">${esc(d.raw_text)}</p>${arr(d.images).length?`<p>${d.images.length} anexo(s) disponíveis na ficha.</p>`:''}`)).join('')||empty('Sem entradas neste período.')}</section>`;
  host.onclick=e=>{const b=e.target.closest('button');if(!b)return;e.stopPropagation();if(b.hasAttribute('data-ca-back'))return close();if(b.hasAttribute('data-ca-open'))return onOpen?.();if(b.hasAttribute('data-ca-retry'))return load();if(b.hasAttribute('data-ca-period')){const value=b.dataset.caPeriod;if(value==='custom'){customFrom=period?start():shiftDay(today,-29);customTo=end();period='custom';}else period=Number(value);selectedDay=null;weekStart=null;return render();}if(b.dataset.caMetric){metric=b.dataset.caMetric;return render();}if(b.dataset.caWeek){weekStart=shiftDay(weekStart,Number(b.dataset.caWeek)*7);selectedDay=null;return render();}if(b.dataset.caTab){tab=b.dataset.caTab;render();}if(b.dataset.caDay){selectedDay=b.dataset.caDay;renderDay(body,sessions,notes,selectedDay);}};
  host.querySelector('.ca-range')?.addEventListener('submit',e=>{e.preventDefault();const f=e.target.elements.from.value,t=e.target.elements.to.value;if(!validRange(f,t,today)){host.querySelector('[data-range-error]').textContent='Escolhe datas válidas: início até fim, sem datas futuras.';return;}customFrom=f;customTo=t;selectedDay=null;weekStart=null;render();});
  host.querySelectorAll('.ca-exercise img').forEach(img=>img.addEventListener('error',()=>{img.hidden=true;},{once:true}));
 }
 function timeline(sessions,notes,from,to){
  const days=[...new Set([...sessions.map(s=>s.date),...notes.map(n=>lisbonDate(n.entered_at)),...data.medicationEvents.map(e=>e.event_date),...data.protocols.map(p=>p.protocol_date),...data.questions.filter(q=>q.completed_at).map(q=>lisbonDate(q.completed_at)),...data.therapist.filter(q=>q.completed_at).map(q=>lisbonDate(q.completed_at)),...data.medications.flatMap(m=>[m.data_inicio,m.data_fim])])].filter(d=>d&&d>=from&&d<=to).sort();
  if(!days.length)return empty('Sem registos datados neste período.');
  const lower=monday(from==='0001-01-01'?days[0]:from),upper=monday(to);
  if(!weekStart||weekStart<lower||weekStart>upper)weekStart=monday(days.at(-1));
  const weekEnd=shiftDay(weekStart,6);
  return `<div class="ca-week"><button type="button" data-ca-week="-1" ${weekStart<=lower?'disabled':''} aria-label="Semana anterior">←</button><b>${date(weekStart)} — ${date(weekEnd)}</b><button type="button" data-ca-week="1" ${weekStart>=upper?'disabled':''} aria-label="Semana seguinte">→</button></div><div class="ca-days">${Array.from({length:7},(_,i)=>{const d=shiftDay(weekStart,i),ss=sessions.filter(s=>s.date===d),has=days.includes(d);return `<button type="button" data-ca-day="${d}" ${d<from||d>to?'disabled':''} aria-pressed="${d===selectedDay}"><small>${['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'][i]}</small><b>${date(d).slice(0,5)}</b><span>${ss.length?ss.length+(ss.length===1?' sessão':' sessões'):has?'Registos':'Sem registo'}${ss.some(s=>s.readiness?.has_symptoms)?' · sintomas':''}</span></button>`;}).join('')}</div>`;
 }
 function renderDay(body,sessions,notes,d){const node=body.querySelector('div[data-ca-day]');if(!node)return;body.querySelectorAll('button[data-ca-day]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.caDay===d)));
  const ss=sessions.filter(s=>s.date===d);
  node.innerHTML=`<div class="ca-day-detail"><h3>${date(d)}</h3>${table(['Sessão','Antes /5','Depois /5','Esforço /10','Sintomas'],ss.map((s,i)=>`<tr><td>${i+1} · ${esc(label(s.state))}</td><td>${esc(s.readiness?.feeling??'—')}</td><td>${esc(s.log?.feel??'—')}</td><td>${esc(s.log?.rpe??'—')}</td><td>${s.readiness?.has_symptoms==null?'—':s.readiness.has_symptoms?'Sim':'Não'}</td></tr>`))}${ss.map((s,i)=>disclosure('Exercícios e notas'+(ss.length>1?' · sessão '+(i+1):''),exerciseHTML(s))).join('')}${data.medications.some(m=>(!m.data_inicio||m.data_inicio<=d)&&(!m.data_fim||m.data_fim>=d))?disclosure('Medicação neste dia',medicationHTML(data.medications,d,d)):''}${data.medicationEvents.filter(e=>e.event_date===d).map(e=>`<p>${esc(label(e.event_type))} · ${esc(label(e.status))} · ${esc(e.instructions)}</p>`).join('')}${data.protocols.filter(p=>p.protocol_date===d).map(p=>`<p><b>Protocolo:</b> ${esc(data.catalog.find(x=>x.id===p.protocol_id)?.name||'Sem nome')} · ${esc(data.phases.find(x=>x.id===p.phase_id)?.name||'Fase por confirmar')}</p>`).join('')}${data.questions.filter(q=>q.completed_at&&lisbonDate(q.completed_at)===d).map(q=>`<p><b>Questionário concluído:</b> ${esc(configs[q.questionnaire_type]?.titulo||q.questionnaire_type)} · consultar separador Questionários e escalas</p>`).join('')}${data.therapist.filter(q=>q.completed_at&&lisbonDate(q.completed_at)===d).map(q=>resultSummaryHtml(q)).join('')}${notes.filter(n=>lisbonDate(n.entered_at)===d).map(n=>`<p class="ca-original"><b>Diário:</b> ${esc(n.raw_text)}</p>`).join('')}</div>`;
 }
 async function load(){data=await loadAnalysisData(window.sb,c.patientId,c.clinicId);if(host.isConnected)render();}
 load();return {close};
}
function baseline(data){
 const q=data.questions.filter(q=>q.status==='completed'&&q.questionnaire_type==='pre_consulta_v2').sort((a,b)=>String(b.completed_at).localeCompare(String(a.completed_at)))[0];if(!q)return '';
 const wanted=['s1_6meses','s4_dias_exercicio','s4_dor_lesao','s4_dor_lesao_texto'];
 const defs=intakeV2.seccoes.flatMap(s=>s.perguntas);
 const rows=wanted.map(id=>{const r=data.responses.find(r=>r.token_id===q.id&&r.question_id===id);return r?`<p><b>${esc(defs.find(x=>x.id===id)?.label)}</b><br>${esc(answer(r.answer))}</p>`:'';}).join('');
 return rows?`<section class="ca-card"><h3>Objetivos e limitações referidos</h3><small>Questionário de ${date(q.completed_at)} · descrição nessa data</small>${rows}</section>`:'';
}
function medicationHTML(meds,from,to){const relevant=meds.filter(m=>(!m.data_inicio||m.data_inicio<=to)&&(!m.data_fim||m.data_fim>=from));return relevant.length?table(['Medicação','Dose guardada / frequência','Datas','Estado'],relevant.map(m=>`<tr><td><b>${esc(m.nome)}</b><small>${esc(m.principio_ativo)}</small></td><td>${esc([m.dose,m.freq].filter(Boolean).join(' · '))}</td><td>${date(m.data_inicio)} → ${m.data_fim?date(m.data_fim):'sem fim definido'}</td><td>${m.enabled?'Ativada':'Desativada'}${!m.data_inicio?' · início por confirmar':''}</td></tr>`)):empty('Sem medicação com datas compatíveis.');}
export const analysisCSS=`
.gc-analysis{color:#172e49;font:14px/1.5 system-ui,sans-serif;background:#f3f6fa;padding:28px;border-radius:16px}.gc-analysis *{box-sizing:border-box}.gc-analysis button,.gc-analysis select{font:inherit;color:inherit;background:white;border:1px solid #dce4ee;border-radius:8px;padding:9px 14px;cursor:pointer}.gc-analysis h2{font-size:25px;letter-spacing:-.5px;margin:0}.gc-analysis h3{font-size:17px;margin:0 0 10px}.gc-analysis p{margin:8px 0}.gc-analysis small{display:block;font-size:12px;color:#65768b}.ca-header{display:flex;align-items:center;gap:20px;margin-bottom:26px}.ca-header>div{flex:1;min-width:0}.ca-eyebrow{font-size:10px;font-weight:700;letter-spacing:2px;color:#47719d}.gc-analysis .ca-muted{color:#65768b;font-size:12px}.ca-nav{display:flex;gap:6px;border-bottom:1px solid #dce4ee;padding-bottom:14px;flex-wrap:wrap}.ca-nav button[aria-pressed=true]{background:#173c62;color:white;border-color:#173c62}.ca-period{display:flex;justify-content:space-between;align-items:center;margin:20px 0;color:#65768b;font-size:12px}.ca-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-bottom:18px}.ca-stat,.ca-card{background:white;border:1px solid #e0e7f0;border-radius:12px;padding:22px}.ca-stat>span{display:block;font-size:12px;color:#65768b}.ca-stat>strong{display:block;font-size:32px;font-weight:600;letter-spacing:-1px;margin:8px 0}.ca-card{margin-bottom:18px}.ca-title{display:flex;justify-content:space-between;gap:12px;align-items:start;flex-wrap:wrap}.ca-card svg{width:100%;display:block;max-height:210px}.ca-dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin:0 4px 0 10px}.ca-dot.before{background:#2670c5}.ca-dot.after{background:#149281}.ca-axis{display:flex;justify-content:space-between;font-size:11px;color:#65768b}.ca-days{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;padding:12px 0}.ca-days button{min-width:0;padding:10px 6px;text-align:left;flex-shrink:0}.ca-days span{display:block;color:#65768b;font-size:11px}.ca-days button[aria-pressed=true]{border-color:#2670c5;background:#edf4fc}.ca-table{overflow:auto;max-width:100%;margin:10px 0}.ca-table table{width:100%;border-collapse:collapse;font-size:13px}.ca-table th,.ca-table td{text-align:left;padding:12px;border-bottom:1px solid #e7ecf3;vertical-align:top;min-width:100px;max-width:380px;overflow-wrap:anywhere}.ca-table th{font-weight:500;color:#65768b}.ca-disclosure{border-bottom:1px solid #e7ecf3;padding:13px 0}.ca-disclosure>summary{cursor:pointer;font-weight:500}.ca-disclosure[open]>summary{margin-bottom:15px;color:#2465a5}.ca-day-detail{margin-top:18px;border-top:1px solid #e0e7f0;padding-top:20px}.ca-original{white-space:pre-wrap}.ca-exercise-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.ca-exercise{display:flex;align-items:center;gap:12px;padding:10px;background:#f5f8fc;border:1px solid #e4ebf3;border-radius:8px;min-width:0}.ca-exercise>div{min-width:0}.ca-exercise b{font-size:13px}.ca-exercise img,.ca-exercise-placeholder{width:70px;height:70px;object-fit:contain;flex:none;border-radius:6px;background:white}.ca-exercise-placeholder{display:grid;place-items:center;color:#91a0af}.ca-execution{color:#235f88!important}.ca-session-heading{display:flex;justify-content:space-between;gap:10px;margin:10px 0}.ca-session-note{font-size:13px}.ca-segments{display:flex;gap:4px;flex-wrap:wrap}.ca-segments button[aria-pressed=true]{background:#173c62;color:white;border-color:#173c62}.ca-period{flex-wrap:wrap;gap:12px}.ca-range{display:flex;flex-wrap:wrap;align-items:end;gap:10px;margin-bottom:18px}.ca-range label{display:grid;gap:4px;font-size:12px}.ca-range input{font:inherit;padding:9px;border:1px solid #dce4ee;border-radius:7px;background:white;color:#173c62}.ca-week{display:flex;justify-content:space-between;align-items:center;margin-top:12px;gap:8px}.ca-week b{font-size:13px}.gc-analysis button:disabled{opacity:.45;cursor:default}.ca-warning{padding:14px;background:#fff5df;border-radius:8px}.gc-analysis [hidden]{display:none!important}@media(max-width:700px){.ca-exercise-grid{grid-template-columns:1fr}.ca-days{grid-template-columns:repeat(4,minmax(0,1fr))}.ca-days span{font-size:10px}.ca-segments button{padding:8px;font-size:12px}.gc-analysis{padding:14px}.ca-header{flex-wrap:wrap;gap:12px}.ca-header>div{order:3;flex-basis:100%}.ca-stats{grid-template-columns:1fr}.ca-stat{padding:16px}.ca-stat>strong{font-size:26px}.ca-card{padding:15px}.ca-nav button{flex:1 1 40%;font-size:12px}.gc-analysis h2{font-size:22px;overflow-wrap:anywhere}}
`;
