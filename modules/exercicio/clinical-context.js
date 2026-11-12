import { lisbonDate } from './followup-model.js?v=20261112-compacto';
import { newest, withinEpisode } from './followup-episodes.js?v=20261009-listas';

const day = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value : null;
const nextDay = value => { const d=new Date(value+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10); };
const sameContext = (r,c) => r.patient_id===c.patientId && r.clinic_id===c.clinicId;
const phaseNote = s => String(s.notes||'').split('\n')[0].match(/^Origem:\s*(.+)/)?.[1] || null;
export const isPathologySession = s => Boolean(phaseNote(s));

// A sequência conta dias civis, nunca sessões. As escalas pré/pós ficam separadas.
// Sem data da sessão não se infere o dia clínico a partir da hora do envio.
export function consecutiveSignals(c,{logs=[],readiness=[],snapshots=[]},now=new Date()) {
  const today=lisbonDate(now),records=[];
  for(const rx of c.rx) {
    const allowed=r=>r.prescription_id===rx.id&&r.clinic_id===c.clinicId&&(!r.patient_id||r.patient_id===c.patientId);
    const dates=new Map((rx.data?.sessions||[]).map(s=>[s.session_id,day(s.date)]));
    snapshots.filter(allowed).forEach(s=>{if(day(s.session_date))dates.set(s.session_id,s.session_date);});
    for(const r of readiness.filter(allowed)) {
      const date=day(r.session_date)||dates.get(r.session_id);if(!date||date>today)continue;
      records.push({date,type:'pre',bad:r.feeling!=null&&r.feeling<=2,value:r.feeling,id:r.id||rx.id+':'+r.session_id,at:r.answered_at});
      records.push({date,type:'symptoms',bad:r.has_symptoms===true,value:r.has_symptoms===true?'Sim':'Não',id:r.id||rx.id+':'+r.session_id,at:r.answered_at});
    }
    for(const r of logs.filter(allowed)) {
      const date=dates.get(r.session_id);if(!date||date>today)continue;
      records.push({date,type:'post',bad:r.feel!=null&&r.feel<=2,value:r.feel,id:r.id||rx.id+':'+r.session_id,at:r.logged_at});
    }
  }
  const signals=[];
  for(const [type,label] of [['pre','Mal-estar antes do treino'],['post','Mal-estar após treino'],['symptoms','Sintomas antes do treino']]) {
    const days=new Map();for(const r of records.filter(r=>r.type===type)){if(!days.has(r.date))days.set(r.date,[]);days.get(r.date).push(r);}
    let run=[];
    const emit=()=>{if(run.length<2)return;const source=run.flatMap(d=>days.get(d)).filter(r=>r.bad).sort((a,b)=>a.date.localeCompare(b.date)||String(a.id).localeCompare(String(b.id)));
      signals.push({key:'consecutive:'+type+':'+run[0],version:JSON.stringify(source.map(r=>[r.id,r.date,r.value,r.at])),label:label+' · '+run.length+' dias consecutivos',kind:'clinical',at:source.map(r=>r.at).filter(Boolean).sort().at(-1),source:{note:source.map(r=>r.date+' · '+(type==='symptoms'?'Sintomas presentes':'Bem-estar '+r.value+'/5')).join('\n')+'\nDias civis consecutivos; duas sessões no mesmo dia contam como um dia.'}});
    };
    for(const date of [...days.keys()].sort()) {
      const bad=days.get(date).some(r=>r.bad);
      if(!bad || run.length&&nextDay(run.at(-1))!==date){emit();run=[];}
      if(bad)run.push(date);
    }
    emit();
  }
  return signals;
}

export function enrichClinicalContexts(rows,{medications=[],medicationEvents=[],portalLinks=[],diaryTokens=[],diary=[],logs=[],readiness=[],snapshots=[],events=[]}={},now=new Date()) {
  const today=lisbonDate(now),future=new Date(today+'T12:00:00Z');future.setUTCDate(future.getUTCDate()+5);const soon=future.toISOString().slice(0,10);
  for(const p of rows)for(const c of p.contexts) {
    const current=c.episodeState==='active',rx=c.rx.filter(r=>r.status!=='revoked'&&r.status!=='draft').slice().sort(newest).slice(0,1);
    const links=portalLinks.filter(l=>l.patient_id===c.patientId&&l.created_clinic_id===c.clinicId&&!l.revoked_at);
    const linkIds=new Set(links.map(l=>l.id));
    const meds=current?medications.filter(m=>m.clinic_id===c.clinicId&&linkIds.has(m.link_id)&&m.enabled):[];
    const medIds=new Set(meds.map(m=>m.id)),medEvents=medicationEvents.filter(e=>medIds.has(e.medication_id)&&e.clinic_id===c.clinicId&&e.status==='planned');
    const sessions=rx.flatMap(r=>(r.data?.sessions||[]).map(s=>({...s,prescriptionId:r.id}))),pathology=sessions.filter(isPathologySession),activity=sessions.filter(s=>!isPathologySession(s));
    const tokens=diaryTokens.filter(t=>sameContext(t,c)&&withinEpisode(t.created_at,c.episode));
    const components=[];
    if(pathology.length)components.push('Patologia');if(activity.length)components.push('Atividade');
    if(meds.some(m=>(!m.data_inicio||m.data_inicio<=today)&&(!m.data_fim||m.data_fim>=today)))components.push('Medicação');
    if(c.qs.some(q=>['pending_rgpd','in_progress'].includes(q.status)&&(!q.expires_at||q.expires_at>now.toISOString())))components.push('Questionário');if(tokens.some(t=>t.status==='active'&&(!t.starts_at||t.starts_at<=now.toISOString())&&(!t.expires_at||t.expires_at>now.toISOString())))components.push('Diário');
    const dates=[];
    const add=(key,label,date,detail)=>{if(day(date))dates.push({key,label,date,detail,urgent:date<=soon});};
    for(const r of rx){add('review:'+r.id,'Revisão do plano',r.data?.dataRevisao,'Data definida na prescrição');add('end:'+r.id,'Fim do plano',r.data?.endDate,'Fim definido do plano; não é a validade da ligação');}
    for(const [key,label,ss] of [['pathology','Última sessão de patologia',pathology],['activity','Última sessão de atividade',activity]])add(key,label,ss.map(s=>day(s.date)).filter(Boolean).sort().at(-1),'Última sessão programada deste componente');
    for(const m of meds)add('med:'+m.id,'Fim da medicação',m.data_fim,[m.nome,m.dose].filter(Boolean).join(' · '));
    for(const e of medEvents.filter(e=>['alteracao_dose','suspensao'].includes(e.event_type)))add('med-event:'+e.id,e.event_type==='suspensao'?'Suspensão programada':'Alteração de dose',e.event_date,e.instructions||'Indicação já registada na medicação');
    for(const q of c.qs.filter(q=>q.status!=='completed'))add('question:'+q.id,'Prazo do questionário',q.expires_at?lisbonDate(q.expires_at):null,'Prazo para resposta');
    const rxIds=new Set(c.rx.map(r=>r.id)),activityRows=[];
    const push=(at,type)=>{if(at&&Number.isFinite(+new Date(at)))activityRows.push({at,type});};
    logs.filter(r=>rxIds.has(r.prescription_id)&&r.clinic_id===c.clinicId&&(!r.patient_id||r.patient_id===c.patientId)).forEach(r=>push(r.logged_at,'Treino concluído'));
    readiness.filter(r=>rxIds.has(r.prescription_id)&&r.clinic_id===c.clinicId&&r.patient_id===c.patientId).forEach(r=>push(r.answered_at,'Avaliação pré-treino'));
    diary.filter(r=>sameContext(r,c)&&withinEpisode(r.entered_at,c.episode)).forEach(r=>push(r.entered_at,'Entrada no diário'));
    c.qs.filter(q=>q.status==='completed').forEach(q=>push(q.completed_at,'Questionário concluído'));
    activityRows.sort((a,b)=>new Date(b.at)-new Date(a.at));
    const origin=[...new Set(pathology.map(phaseNote))];
    const decisions=events.filter(e=>sameContext(e,c)&&e.kind==='review'&&(e.episode_id?e.episode_id===c.episode.episode_id:withinEpisode(e.created_at,c.episode))).sort(newest);
    for(const s of consecutiveSignals(c,{logs,readiness,snapshots},now)) {
      const d=decisions.find(e=>e.source_key===s.key&&e.source_version===s.version);
      if(d&&!['contact','prepare','defer'].includes(d.decision))continue;
      const existing=c.signals.find(x=>x.key===s.key&&x.version===s.version);
      if(existing){Object.assign(existing,s);continue;}
      c.signals.push({...s,expectedEventId:d?.id||null,pendingDecision:d?.decision,decisionNote:d?.reason});
    }
    // A última sessão é informação de calendário quando já existe um fim de plano explícito.
    if(rx.some(r=>day(r.data?.endDate)))dates.filter(d=>['pathology','activity'].includes(d.key)).forEach(d=>d.urgent=false);
    for(const date of dates.filter(d=>d.urgent)) {
      const key='deadline:'+date.key,version=JSON.stringify([date.date,date.detail]);
      const decision=decisions.find(e=>e.source_key===key&&e.source_version===version);
      date.reviewed=Boolean(decision&&!['contact','prepare','defer'].includes(decision.decision));
      if(date.reviewed)continue;
      const signal={key,version,label:date.label,kind:'plan',at:date.date,source:{note:date.label+' · '+date.date+'\n'+date.detail},expectedEventId:decision?.id||null,pendingDecision:decision?.decision,decisionNote:decision?.reason};
      const existing=c.signals.find(s=>s.key===key&&s.version===version);if(existing)Object.assign(existing,signal);else if(current)c.signals.push(signal);
    }
    dates.sort((a,b)=>a.date.localeCompare(b.date)||a.key.localeCompare(b.key));
    c.clinical={components,origins:origin,medications:meds,medicationEvents:medEvents,dates:current?dates:[],latest:activityRows[0]||null,phaseStatus:origin.length?'Fase conforme origem prescrita · transição por confirmar':'Sem protocolo prescrito',today,soon};
  }
  return rows;
}

export function clinicalItems(c,signals) {
  const items=signals.map(s=>{
    const deadline=(c.clinical?.dates||[]).find(d=>'deadline:'+d.key===s.key);
    const deferred=s.pendingDecision==='defer'?String(s.decisionNote||'').match(/^Rever em: (\d{4}-\d{2}-\d{2})$/m)?.[1]:null;
    const clinicalAlert=s.key.startsWith('consecutive:')||s.source?.has_symptoms===true||s.source?.feel!=null&&s.source.feel<=2||s.source?.feeling!=null&&s.source.feeling<=2||s.source?.rpe>=8;
    return {key:s.key,label:s.label,date:deferred||deadline?.date||(s.at?lisbonDate(s.at):null),detail:deadline?.detail||(s.pendingDecision==='defer'?s.decisionNote||'Revisão adiada':s.historical?'Origem histórica':'Registo por rever'),signal:s,clinicalAlert,priority:deferred?(deferred<=c.clinical?.today?1:5):s.key.startsWith('consecutive:')?0:s.pendingDecision?1:clinicalAlert?2:s.key.startsWith('deadline:review:')&&s.at<=c.clinical?.today?1:s.key.startsWith('deadline:')?3:s.kind==='clinical'?4:s.kind==='plan'?5:6};
  });
  for(const d of c.clinical?.dates||[])if(d.urgent&&!d.reviewed&&!items.some(i=>i.key==='deadline:'+d.key))items.push({...d,priority:d.key.startsWith('review:')&&d.date<=c.clinical.today?1:3});
  return items.sort((a,b)=>a.priority-b.priority||String(a.date||'').localeCompare(String(b.date||''))||a.key.localeCompare(b.key));
}
