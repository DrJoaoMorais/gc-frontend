import { episodeState, latestEpisodeEvents, withinEpisode, newest } from './followup-episodes.js?v=20261009-episodios';
// Estado do acompanhamento separado da validade das prescrições e dos links.
export const FOLLOWUP_STATES = {active:'Em acompanhamento',waiting:'A aguardar questionário',contact:'Sem resposta / contactar',review:'Plano terminado / rever',prepare:'Preparar plano',paused:'Pausado',completed:'Concluído',abandoned:'Encerrado por abandono'};
const stamp = value => new Date(value || 0).getTime() || 0;
const latest = rows => [...rows].sort((a,b)=>stamp(b.created_at)-stamp(a.created_at)||String(b.id).localeCompare(String(a.id)))[0];
export function lisbonDate(value) { return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Lisbon',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value)); }
function buildLegacyFollowup({prescriptions=[],questionnaires=[],logs=[],readiness=[],diary=[],alerts=[],events=[],seed=[]}, now=new Date()) {
 const groups=new Map(), today=lisbonDate(now), nowMs=+now;
 const ensure=r=>{if(!r.patient_id||!r.clinic_id)return null;const key=r.patient_id+':'+r.clinic_id;if(!groups.has(key))groups.set(key,{key,patientId:r.patient_id,clinicId:r.clinic_id,name:r.patients?.full_name||'Doente',rx:[],qs:[],events:[]});const g=groups.get(key);if(r.patients?.full_name)g.name=r.patients.full_name;return g;};
 seed.forEach(ensure);
 prescriptions.forEach(r=>ensure(r)?.rx.push(r));
 // Os questionários pré-consulta são a entrada antes da primeira prescrição.
 questionnaires.filter(q=>/^pre_consulta_v\d+$/.test(q.questionnaire_type||'')).forEach(q=>ensure(q)?.qs.push(q));
 events.filter(e=>e.kind==='state').forEach(e=>ensure(e)?.events.push(e));
 const result=[];
 for(const g of groups.values()){
  const q=latest(g.qs), valid=g.rx.filter(r=>r.status==='active'&&(!r.expires_at||stamp(r.expires_at)>nowMs)), lastRx=latest(g.rx), explicit=latest(g.events);
  let state=valid.length?'active':q&&q.status!=='completed'?(q.status==='expired'||(q.expires_at&&stamp(q.expires_at)<=nowMs)?'contact':'waiting'):lastRx?'review':q?'prepare':'review';
  if(explicit&&explicit.state!=='auto')state=explicit.state;
  const record={...g,state,reason:explicit?.reason||'',signals:[],q,valid,latestActivity:null};
  const reviewed=new Set(events.filter(e=>e.kind==='review'&&!['contact','prepare','defer'].includes(e.decision)&&e.patient_id===g.patientId&&e.clinic_id===g.clinicId).map(e=>e.source_key+'|'+e.source_version));
  const add=(key,version,label,at,kind='clinical')=>{if(!reviewed.has(key+'|'+version))record.signals.push({key,version:String(version||''),label,at,kind});};
  const rxIds=new Set(g.rx.map(r=>r.id)), validIds=new Set(valid.map(r=>r.id));
  const allLogs=logs.filter(l=>rxIds.has(l.prescription_id));
  const activity=[...allLogs.map(l=>l.logged_at),...readiness.filter(r=>rxIds.has(r.prescription_id)).map(r=>r.answered_at),...diary.filter(d=>d.patient_id===g.patientId&&d.clinic_id===g.clinicId).map(d=>d.entered_at)].filter(Boolean).sort((a,b)=>stamp(b)-stamp(a));
  record.latestActivity=activity[0]||null;
  for(const l of allLogs){const notes=String(l.note||'').trim(), changed=(l.sets||[]).some(s=>s.status&&s.status!=='as_prescribed');const parts=[notes?'Mensagem após treino':'',changed?'Treino alterado / não realizado':'',Number(l.rpe)>=8?'Esforço elevado':'',l.feel!=null&&Number(l.feel)<=2?'Mal-estar após treino':''].filter(Boolean);if(parts.length)add('log:'+l.prescription_id+':'+l.session_id,JSON.stringify([l.logged_at,l.note,l.sets,l.rpe,l.feel]),parts.join(' · '),l.logged_at);}
  for(const r of readiness.filter(r=>rxIds.has(r.prescription_id))){if(r.has_symptoms||(r.feeling!=null&&Number(r.feeling)<=2))add('readiness:'+r.id,JSON.stringify([r.answered_at,r.feeling,r.has_symptoms,r.symptom_note]),r.has_symptoms?'Dor / sintomas antes do treino':'Cansaço / mal-estar antes do treino',r.answered_at);}
  for(const d of diary.filter(d=>d.patient_id===g.patientId&&d.clinic_id===g.clinicId))add('diary:'+d.id,JSON.stringify([d.entered_at,d.raw_text,d.images]),'Mensagem no diário',d.entered_at);
  for(const a of alerts.filter(a=>a.patient_id===g.patientId&&a.clinic_id===g.clinicId&&!a.resolved_at&&['exercise','diary','questionnaire'].includes(a.source)&&!(a.source==='questionnaire'&&a.metadata?.token_id&&g.qs.some(q=>q.id===a.metadata.token_id)))){add('alert:'+a.id,a.created_at,a.title||'Registo por analisar',a.created_at);}
  if(q&&q.status!=='completed'&&(q.status==='expired'||(q.expires_at&&stamp(q.expires_at)<=nowMs)))add('questionnaire:'+q.id,JSON.stringify([q.status,q.expires_at,Boolean(q.expires_at&&stamp(q.expires_at)<=nowMs)]),q.status==='expired'||(q.expires_at&&stamp(q.expires_at)<=nowMs)?'Questionário fora de prazo · contactar':q.status==='in_progress'?'Questionário em preenchimento':'A aguardar questionário',q.expires_at,'questionnaire');
  for(const response of g.qs.filter(q=>q.status==='completed'))add('response:'+response.id,response.completed_at||response.created_at,'Questionário concluído · rever respostas',response.completed_at,'clinical');
  if(q?.status==='completed'&&!valid.length)add('prepare:'+q.id,q.completed_at||q.created_at,'Questionário concluído · preparar plano',q.completed_at,'plan');
  // O fim dos treinos é calculado pelas sessões, não pela validade do link.
  const sessions=valid.flatMap(r=>(r.data?.sessions||[]).map(s=>({...s,prescriptionId:r.id}))), future=sessions.filter(s=>s.date>=today);
  record.endDate=sessions.map(s=>s.date).filter(Boolean).sort().at(-1)||null;
  record.nextDate=future.map(s=>s.date).sort()[0]||null;
  record.logCount=allLogs.filter(l=>validIds.has(l.prescription_id)).length;
  if(valid.length){if(!future.length)add('plan:none',valid.map(r=>r.id+':'+(r.content_version||r.created_at)).sort().join(','),'Sem próximos treinos · rever plano',now.toISOString(),'plan');else if(record.endDate&&stamp(record.endDate+'T12:00:00Z')-stamp(today+'T12:00:00Z')<=5*86400000)add('plan:ending',record.endDate,'Treinos a terminar · preparar continuidade',record.endDate,'plan');
   const logged=new Set(allLogs.map(l=>l.prescription_id+':'+l.session_id));const missed=sessions.filter(s=>s.date&&s.date<today&&!logged.has(s.prescriptionId+':'+s.session_id));if(missed.length)add('missed',missed.map(s=>s.prescriptionId+':'+s.session_id).sort().join(','),`${missed.length} sessão(ões) prevista(s) sem registo`,missed.map(s=>s.date).sort().at(-1),'adherence');
  }else if(lastRx)add('plan:expired',lastRx.id+':'+lastRx.expires_at,'Plano terminado · decidir continuidade',lastRx.expires_at,'plan');
  const signalOrder={clinical:0,plan:1,adherence:2,questionnaire:3};
  record.signals.sort((a,b)=>signalOrder[a.kind]-signalOrder[b.kind]||stamp(b.at)-stamp(a.at));
  result.push(record);
 }
 // Uma linha por doente, mantendo o contexto de cada clínica nas ações.
 const patients=new Map();for(const r of result){if(!patients.has(r.patientId))patients.set(r.patientId,{patientId:r.patientId,name:r.name,contexts:[]});patients.get(r.patientId).contexts.push(r);}
 const order={active:0,contact:1,waiting:2,prepare:3,review:4,paused:5,completed:6,abandoned:7};
 return [...patients.values()].map(p=>{p.contexts.sort((a,b)=>order[a.state]-order[b.state]);return {...p,state:p.contexts[0].state,signals:p.contexts.flatMap(c=>c.signals.map(s=>({...s,clinicId:c.clinicId})))}}).sort((a,b)=>order[a.state]-order[b.state]||a.name.localeCompare(b.name,'pt'));
}

// Cada contexto representa um episódio; as fontes nunca são reescritas.
export function buildFollowup(input, now=new Date()) {
 const {episodeEvents=[],prescriptions=[],questionnaires=[],events=[],logs=[],readiness=[],diary=[],alerts=[]}=input;
 const latest=latestEpisodeEvents(episodeEvents), pairs=new Map();
 for(const r of [...prescriptions,...questionnaires.filter(q=>/^pre_consulta_v\d+$/.test(q.questionnaire_type||'')),...events.filter(e=>e.kind==='state'),...latest]) {
  if(!r.patient_id||!r.clinic_id)continue;
  const key=r.patient_id+':'+r.clinic_id;
  if(!pairs.has(key))pairs.set(key,{patientId:r.patient_id,clinicId:r.clinic_id,name:r.patients?.full_name||'Doente'});
  if(r.patients?.full_name)pairs.get(key).name=r.patients.full_name;
 }
 const contexts=[];
 for(const [pair,g] of pairs){
  const same=r=>r.patient_id===g.patientId&&r.clinic_id===g.clinicId;
  let episodes=latest.filter(same);
  if(!episodes.length){
   const lastState=events.filter(e=>same(e)&&e.kind==='state').sort(newest)[0];
   episodes=[{id:null,episode_id:null,patient_id:g.patientId,clinic_id:g.clinicId,state:episodeState(lastState?.state),interruption_kind:lastState?.state==='abandoned'?'abandonment':lastState?.state==='paused'?'suspension':null,reason:lastState?.reason||'',started_at:null,closed_at:lastState&&['completed','paused','abandoned'].includes(lastState.state)?lastState.created_at:null,legacy:true}];
  }
  for(const savedEpisode of episodes){
   // As ligações continuam válidas. Um registo tardio do plano anterior
   // permanece no seu episódio, mesmo depois de encerrado.
   const nextStart=episodes.filter(e=>e.episode_id!==savedEpisode.episode_id&&e.started_at&&new Date(e.started_at)>new Date(savedEpisode.started_at||savedEpisode.closed_at||0)).map(e=>e.started_at).sort()[0]||null;
   const episode={...savedEpisode,data_until:nextStart};
   // A ligação explícita conserva o plano do primeiro episódio. Uma retoma
   // não recupera silenciosamente as prescrições do anterior.
   const scoped=(rows,ids)=>rows.filter(r=>same(r)&&(ids?.includes(r.id)||withinEpisode(r.created_at,episode)));
   const rx=scoped(prescriptions,episode.prescription_ids), qs=scoped(questionnaires.filter(q=>/^pre_consulta_v\d+$/.test(q.questionnaire_type||'')),episode.questionnaire_ids);
   const rxIds=new Set(rx.map(r=>r.id));
   const dataset={prescriptions:rx,questionnaires:qs,seed:[{patient_id:g.patientId,clinic_id:g.clinicId,patients:{full_name:g.name}}],
    logs:logs.filter(r=>rxIds.has(r.prescription_id)),
    readiness:readiness.filter(r=>rxIds.has(r.prescription_id)),
    diary:diary.filter(r=>same(r)&&withinEpisode(r.entered_at,episode)),
    alerts:alerts.filter(r=>same(r)&&withinEpisode(r.created_at,episode)),
    events:events.filter(r=>same(r)&&r.kind==='review'&&(r.episode_id?r.episode_id===episode.episode_id:withinEpisode(r.created_at,episode)))};
   const legacy=buildLegacyFollowup(dataset,episode.closed_at?new Date(episode.closed_at):now).flatMap(p=>p.contexts)[0]||{rx:[],qs:[],valid:[],signals:[],state:'prepare',latestActivity:null};
   const reviews=dataset.events.slice().sort(newest), pending=new Map();
   for(const e of reviews){const k=e.source_key+'|'+e.source_version;if(!pending.has(k))pending.set(k,e);}
   for(const e of pending.values())if(['contact','prepare','defer'].includes(e.decision)){
    let signal=legacy.signals.find(s=>s.key===e.source_key&&s.version===e.source_version);
    if(!signal){signal={key:e.source_key,version:e.source_version,label:'Decisão pendente',kind:e.decision==='prepare'?'plan':'clinical',at:e.created_at};legacy.signals.push(signal);}
    signal.pendingDecision=e.decision;signal.decisionNote=e.reason;signal.expectedEventId=e.id;
    signal.label=e.decision==='contact'?'Contacto por realizar':e.decision==='prepare'?'Preparar continuidade':signal.label;
   }
   for(const signal of legacy.signals){
    signal.expectedEventId=signal.expectedEventId||reviews.find(e=>e.source_key===signal.key&&e.source_version===signal.version)?.id||null;
    const source=signal.key.startsWith('log:')?dataset.logs.find(r=>'log:'+r.prescription_id+':'+r.session_id===signal.key):signal.key.startsWith('readiness:')?dataset.readiness.find(r=>'readiness:'+r.id===signal.key):signal.key.startsWith('diary:')?dataset.diary.find(r=>'diary:'+r.id===signal.key):signal.key.startsWith('alert:')?dataset.alerts.find(r=>'alert:'+r.id===signal.key):null;
    signal.source=source||null;
   }
   // Encerrar um episódio não elimina respostas clínicas por rever.
   if(episode.state!=='active')legacy.signals=legacy.signals.filter(s=>s.kind==='clinical'||s.pendingDecision);
   const c={...legacy,...g,key:pair+':'+(episode.episode_id||'legacy'),pairKey:pair,name:g.name,episode,episodeState:episode.state,reason:episode.reason||'',state:episode.state==='active'?legacy.state:episode.interruption_kind==='abandonment'?'abandoned':episode.state==='interrupted'?'paused':episode.state};
   if(episode.state==='active'&&!rx.length&&!qs.length&&!c.signals.some(s=>s.key==='episode:prepare')&&!reviews.some(e=>e.source_key==='episode:prepare'&&e.source_version===episode.episode_id&&e.decision==='closed'))c.signals.push({key:'episode:prepare',version:episode.episode_id,label:'Novo episódio · preparar acompanhamento',at:episode.started_at,kind:'plan'});
   contexts.push(c);
  }
 }
 const patients=new Map();
 for(const c of contexts){if(!patients.has(c.patientId))patients.set(c.patientId,{patientId:c.patientId,name:c.name,contexts:[]});patients.get(c.patientId).contexts.push(c);}
 return [...patients.values()].map(p=>{p.contexts.sort((a,b)=>(a.episodeState==='active'?0:1)-(b.episodeState==='active'?0:1)||newest(a.episode,b.episode));return {...p,state:p.contexts[0].state,signals:p.contexts.flatMap(c=>c.signals)}}).sort((a,b)=>a.name.localeCompare(b.name,'pt'));
}
