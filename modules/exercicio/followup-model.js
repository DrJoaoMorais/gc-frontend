// Estado do acompanhamento separado da validade das prescrições e dos links.
export const FOLLOWUP_STATES = {active:'Em acompanhamento',waiting:'A aguardar questionário',contact:'Sem resposta / contactar',review:'Plano terminado / rever',prepare:'Preparar plano',paused:'Pausado',completed:'Concluído',abandoned:'Encerrado por abandono'};
const stamp = value => new Date(value || 0).getTime() || 0;
const latest = rows => [...rows].sort((a,b)=>stamp(b.created_at)-stamp(a.created_at)||String(b.id).localeCompare(String(a.id)))[0];
export function lisbonDate(value) { return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Lisbon',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value)); }
export function buildFollowup({prescriptions=[],questionnaires=[],logs=[],readiness=[],diary=[],alerts=[],events=[]}, now=new Date()) {
 const groups=new Map(), today=lisbonDate(now), nowMs=+now;
 const ensure=r=>{if(!r.patient_id||!r.clinic_id)return null;const key=r.patient_id+':'+r.clinic_id;if(!groups.has(key))groups.set(key,{key,patientId:r.patient_id,clinicId:r.clinic_id,name:r.patients?.full_name||'Doente',rx:[],qs:[],events:[]});const g=groups.get(key);if(r.patients?.full_name)g.name=r.patients.full_name;return g;};
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
  const reviewed=new Set(events.filter(e=>e.kind==='review'&&e.patient_id===g.patientId&&e.clinic_id===g.clinicId).map(e=>e.source_key+'|'+e.source_version));
  const add=(key,version,label,at,kind='clinical')=>{if(!reviewed.has(key+'|'+version))record.signals.push({key,version:String(version||''),label,at,kind});};
  const rxIds=new Set(g.rx.map(r=>r.id)), validIds=new Set(valid.map(r=>r.id));
  const allLogs=logs.filter(l=>rxIds.has(l.prescription_id));
  const activity=[...allLogs.map(l=>l.logged_at),...readiness.filter(r=>rxIds.has(r.prescription_id)).map(r=>r.answered_at),...diary.filter(d=>d.patient_id===g.patientId&&d.clinic_id===g.clinicId).map(d=>d.entered_at)].filter(Boolean).sort((a,b)=>stamp(b)-stamp(a));
  record.latestActivity=activity[0]||null;
  for(const l of allLogs){const notes=String(l.note||'').trim(), changed=(l.sets||[]).some(s=>s.status&&s.status!=='as_prescribed');const parts=[notes?'Mensagem após treino':'',changed?'Treino alterado / não realizado':'',Number(l.rpe)>=8?'Esforço elevado':'',l.feel!=null&&Number(l.feel)<=2?'Mal-estar após treino':''].filter(Boolean);if(parts.length)add('log:'+l.prescription_id+':'+l.session_id,JSON.stringify([l.logged_at,l.note,l.sets,l.rpe,l.feel]),parts.join(' · '),l.logged_at);}
  for(const r of readiness.filter(r=>rxIds.has(r.prescription_id))){if(r.has_symptoms||(r.feeling!=null&&Number(r.feeling)<=2))add('readiness:'+r.id,JSON.stringify([r.answered_at,r.feeling,r.has_symptoms,r.symptom_note]),r.has_symptoms?'Dor / sintomas antes do treino':'Cansaço / mal-estar antes do treino',r.answered_at);}
  for(const d of diary.filter(d=>d.patient_id===g.patientId&&d.clinic_id===g.clinicId))add('diary:'+d.id,JSON.stringify([d.entered_at,d.raw_text,d.images]),'Mensagem no diário',d.entered_at);
  for(const a of alerts.filter(a=>a.patient_id===g.patientId&&a.clinic_id===g.clinicId&&!a.resolved_at&&['exercise','diary','questionnaire'].includes(a.source))){if(a.source==='questionnaire'&&q?.status!=='completed')continue;add('alert:'+a.id,a.created_at,a.title||'Registo por analisar',a.created_at);}
  if(q&&q.status!=='completed')add('questionnaire:'+q.id,JSON.stringify([q.status,q.expires_at,Boolean(q.expires_at&&stamp(q.expires_at)<=nowMs)]),q.status==='expired'||(q.expires_at&&stamp(q.expires_at)<=nowMs)?'Questionário fora de prazo · contactar':q.status==='in_progress'?'Questionário em preenchimento':'A aguardar questionário',q.expires_at,'questionnaire');
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
