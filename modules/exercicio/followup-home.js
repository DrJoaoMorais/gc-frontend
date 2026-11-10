import { createClinicalWorkspace, clinicalWorkspaceHTML, clinicalWorkspaceCSS } from './clinical-workspace.js?v=20261110-clinico';
import { canLeaveFollowup, installFollowupDraftGuard } from './followup-drafts.js?v=20261110-clinico';
import { canAccessExercise } from './permissoes.js';
import { buildFollowup } from './followup-model.js?v=20261110-clinico';
import { EPISODE_STATES, currentSignals, historicalSignals, withinEpisode } from './followup-episodes.js?v=20261009-listas';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=v=>v?new Date(v.length===10?v+'T12:00:00Z':v).toLocaleDateString('pt-PT',{timeZone:'Europe/Lisbon'}):'Por confirmar';
const stateLabel=c=>c.episodeState==='interrupted'?`Interrompido — ${c.episode.interruption_kind==='abandonment'?'abandono':'suspensão'}`:c.episode.is_test?'Teste':EPISODE_STATES[c.episodeState];
const workspaceState={};
let revision=0;
export async function loadExerciseHome({clinics=[],clinicIds=[],onOpen,onOwnership,summary=false,onNavigate}={}) {
 const root=document.getElementById('gcExerciseHome');
 if(!root)return;
 root.hidden=!canAccessExercise();if(root.hidden){revision++;root.innerHTML='';return;}
 if(!canLeaveFollowup(root))return;
 const request=++revision;
 const current=()=>request===revision&&root.isConnected;
 root.innerHTML='<div class="gc-home-empty">A carregar acompanhamento de exercício…</div>';
 const all=async factory=>{const out=[];for(let offset=0;;offset+=500){if(!current())return [];const r=await factory().range(offset,offset+499);if(r.error)throw r.error;out.push(...(r.data||[]));if((r.data||[]).length<500)return out;}};
 const scoped=(table,columns)=>()=>window.sb.from(table).select(columns).in('clinic_id',clinicIds).order('id');
 const chunked=async(table,columns,key,ids)=>{const out=[];for(let i=0;i<ids.length;i+=100)out.push(...await all(()=>window.sb.from(table).select(columns).in(key,ids.slice(i,i+100)).in('clinic_id',clinicIds).order('id')));return out;};
 try {
  if(!clinicIds.length){root.innerHTML='<div class="gc-home-empty">Selecione uma clínica para ver o acompanhamento.</div>';return;}
  const [prescriptions,questionnaires,events,episodeEvents,diaryTokens]=await Promise.all([
   all(scoped('wo_prescriptions','id,patient_id,clinic_id,status,created_at,expires_at,content_version,data,patients(full_name)')),
   all(()=>scoped('intake_tokens','id,patient_id,clinic_id,questionnaire_type,status,created_at,expires_at,completed_at,patients(full_name)')().like('questionnaire_type','pre_consulta_v%')),
   all(scoped('wo_followup_events','id,patient_id,clinic_id,kind,state,reason,decision,source_key,source_version,episode_id,created_at,patients(full_name)')),
   all(scoped('wo_followup_episode_events','id,episode_id,patient_id,clinic_id,state,interruption_kind,is_test,reason,started_at,closed_at,prescription_ids,questionnaire_ids,created_at,patients(full_name)')),
   all(scoped('patient_diary_tokens','id,patient_id,clinic_id,status,created_at,expires_at,patients(full_name)'))
  ]);
  const rxIds=prescriptions.map(r=>r.id),patientIds=[...new Set([...prescriptions,...questionnaires,...events,...episodeEvents,...diaryTokens].map(r=>r.patient_id))];
  const [logs,readiness,diary,alerts,snapshots]=await Promise.all([
   chunked('wo_session_logs','id,prescription_id,session_id,clinic_id,logged_at,rpe,feel,sets,note','prescription_id',rxIds),
   chunked('wo_session_readiness','id,prescription_id,session_id,patient_id,clinic_id,feeling,has_symptoms,symptom_note,answered_at','prescription_id',rxIds),
   chunked('patient_diary_entries','id,patient_id,clinic_id,entered_at,raw_text,images','patient_id',patientIds),
   chunked('alerts','id,patient_id,clinic_id,source,title,message,metadata,event_type,created_at,resolved_at','patient_id',patientIds),
   summary?Promise.resolve([]):chunked('wo_session_prescription_snapshots','id,prescription_id,clinic_id,session_id,session_date,frozen_at,removed_at','prescription_id',rxIds)
  ]);
  if(!current())return;
  const rows=buildFollowup({prescriptions,questionnaires,events,episodeEvents,logs,readiness,diary,alerts,seed:diaryTokens});
  const clinicName=id=>clinics.find(c=>c.id===id)?.name||'Clínica';
  const owned=alerts.filter(a=>['exercise','diary','questionnaire'].includes(a.source)&&rows.some(p=>p.contexts.some(c=>c.patientId===a.patient_id&&c.clinicId===a.clinic_id&&withinEpisode(a.created_at,c.episode))));
  onOwnership?.(owned.map(a=>a.id));
  const reload=()=>loadExerciseHome({clinics,clinicIds,onOpen,onOwnership,summary,onNavigate});
  root.innerHTML='<style>'+clinicalWorkspaceCSS+'</style>'+clinicalWorkspaceHTML({clinics,clinicIds,summary});
  const list=root.querySelector('[data-list]'),pages=root.querySelector('[data-pages]'),editor=root.querySelector('[data-editor]');
  const context=key=>rows.flatMap(p=>p.contexts).find(c=>c.key===key);
  const signalHtml=c=>c.signals.length?`<details><summary>${c.signals.length} situação(ões) por rever · ${esc(c.signals[0].label)}</summary>${c.signals.map((s,i)=>`<div class="gc-fh-signal"><span>${esc(s.label)}<small>${date(s.at)}</small></span>${s.informational?'':`<button type="button" data-review="${esc(c.key)}" data-index="${s.reviewIndex??i}">${s.pendingDecision==='contact'?'Registar contacto':s.pendingDecision==='prepare'?'Preparar continuidade':'Rever'}</button>`}</div>`).join('')}</details>`:'<span class="gc-fh-clear">Sem pendências por tratar</span>';
  const workspace=createClinicalWorkspace({root,rows,clinics,clinicIds,logs,readiness,snapshots,diary,editor,onHistory:showHistory,summary,onNavigate,state:workspaceState});
  const render=()=>workspace.render();
  installFollowupDraftGuard(root);
  function showHistory(patientId){
   root.appendChild(editor);
   const original=rows.find(p=>p.patientId===patientId);if(!original)return;const patient={...original,contexts:workspace.visibleContexts(original)};
   editor.innerHTML=`<section class="gc-fh-editor"><div class="gc-fh-heading"><h3>Histórico de episódios · ${esc(patient.name)}</h3><button type="button" data-clinical-profile="${esc(patient.contexts[0]?.key||'')}">Voltar à ficha</button><button type="button" data-close-editor>Fechar</button></div>${patient.contexts.map(c=>{
    const ids=new Set(c.rx.map(r=>r.id)),episodeLogs=logs.filter(l=>ids.has(l.prescription_id));
    const decisions=[...events.filter(e=>e.patient_id===c.patientId&&e.clinic_id===c.clinicId&&(e.episode_id?e.episode_id===c.episode.episode_id:withinEpisode(e.created_at,c.episode))),...episodeEvents.filter(e=>e.episode_id===c.episode.episode_id)];
    return `<details class="gc-fh-history" ${c.episodeState==='active'?'open':''}><summary>${esc(stateLabel(c))} · ${esc(clinicName(c.clinicId))} · ${c.episode.started_at?date(c.episode.started_at):'Início por confirmar'}${c.episode.closed_at?' → '+date(c.episode.closed_at):''}</summary><p>${esc(c.reason)}</p><div class="gc-fh-history-data"><strong>Planos (${c.rx.length})</strong>${c.rx.map(r=>`<p>Criado: ${date(r.created_at)} · ${esc(({active:'Prescrição ativa',revoked:'Prescrição desativada',expired:'Prescrição expirada',draft:'Rascunho'})[r.status]||'Plano guardado')} · ${(r.data?.sessions||[]).length} sessões · Validade: ${date(r.expires_at)}</p><details><summary>Consultar sessões do plano</summary>${(r.data?.sessions||[]).map(s=>`<p>${s.date?date(s.date):'Sem data'} · ${esc(s.label||s.name||s.title||'Sessão')} · ${(s.exercises||[]).length} exercícios</p>`).join('')}</details>`).join('')}<strong>Treinos registados (${episodeLogs.length})</strong>${episodeLogs.map(l=>`<p>${date(l.logged_at)} · Esforço: ${esc(l.rpe??'—')} · Bem-estar: ${esc(l.feel??'—')}${l.note?'<br>'+esc(l.note):''}</p>`).join('')}<strong>Questionários (${c.qs.length})</strong>${c.qs.map(q=>`<p>${date(q.created_at)} · ${esc(({pending_rgpd:'Por iniciar',in_progress:'Em preenchimento',completed:'Concluído',expired:'Fora de prazo'})[q.status]||'Questionário guardado')}${q.completed_at?' · Concluído: '+date(q.completed_at):''}</p>`).join('')}<strong>Situações por rever (${[...currentSignals(c),...historicalSignals(c)].length})</strong><div class="gc-fh-signals">${signalHtml({...c,signals:[...currentSignals(c),...historicalSignals(c)]})}</div><strong>Decisões registadas (${decisions.length})</strong>${decisions.map(d=>`<p>${date(d.created_at)} · ${esc(d.reason||'Revisão registada')}</p>`).join('')}</div><div class="gc-fh-actions"><button type="button" data-open="${esc(c.key)}">Abrir ficha do acompanhamento</button><button type="button" data-manage="${esc(c.key)}">Alterar situação</button>${c.episodeState!=='active'&&!patient.contexts.some(other=>other.clinicId===c.clinicId&&other.episodeState==='active')?`<button type="button" data-reactivate="${esc(c.key)}">Reativar — novo episódio</button>`:''}</div></details>`;
   }).join('')}</section>`;
   editor.scrollIntoView({block:'nearest'});
  }
  async function showReview(c,signal){
   root.appendChild(editor);
   const source=signal.source||{}, text=source.note||source.symptom_note||source.raw_text||source.message||'';
   const clinical=signal.kind==='clinical', contact=signal.pendingDecision==='contact', prepare=signal.pendingDecision==='prepare';
   let choices=contact?[['closed','Contacto realizado e registado'],['contact','Contacto ainda por realizar']]:prepare?[['closed','Continuidade preparada e registada na ficha'],['prepare','Ainda por preparar']]:clinical?[['closed','Revisto — sem alteração'],['contact','É necessário contactar o doente'],['closed','Orientação / alteração registada na ficha']]:signal.kind==='plan'?[['prepare','Continuar — preparar acompanhamento'],['complete_episode','Terminar por decisão médica'],['defer','Decidir mais tarde']]:[['contact','Contactar o doente'],['closed','Situação revista e resolvida'],['defer','Manter por resolver']];
   if(!choices.some(([key])=>key==='defer'))choices.push(['defer','Adiar para uma data']);
   editor.innerHTML=`<form class="gc-fh-editor"><h3>${contact?'Registar contacto':prepare?'Preparar continuidade':'Rever situação'} · ${esc(c.name)}</h3><p>${esc(clinicName(c.clinicId))} · ${esc(stateLabel(c))}</p><p><b>1. Consultar registo → 2. Decidir → 3. Registar</b></p><div data-source class="gc-fh-source"><strong>${esc(signal.label)}</strong><small>${date(signal.at)}</small>${text?`<p style="white-space:pre-wrap">${esc(text)}</p>`:''}${source.rpe!=null?`<p>Esforço: ${esc(source.rpe)} / 10</p>`:''}${source.feel!=null||source.feeling!=null?`<p>Bem-estar: ${esc(source.feel??source.feeling)}</p>`:''}${source.sets?.length?`<details><summary>Execução registada</summary>${source.sets.map((set,i)=>`<p>Série ${i+1} · ${esc(({as_prescribed:'Conforme prescrito',modified:'Alterada',skipped:'Não realizada',not_done:'Não realizada'})[set.status]||set.status||'Registada')}${set.note?' · '+esc(set.note):''}</p>`).join('')}</details>`:''}${signal.kind==='plan'?`<p>${c.endDate?'Treinos previstos até '+date(c.endDate):'Sem próximos treinos previstos'} · ${c.valid.length} prescrição(ões) ativa(s).</p>`:''}${signal.kind==='questionnaire'?`<p>Estado: ${esc(c.q?.status==='expired'?'Expirado':'Prazo ultrapassado')} · Prazo: ${date(c.q?.expires_at)}</p>`:''}${source.images?.length?`<p>${source.images.length} imagem(ns) no registo. Consulte-as na ficha do acompanhamento.</p>`:''}${signal.decisionNote?`<p>Decisão anterior: ${esc(signal.decisionNote)}</p>`:''}</div><p>Consulte a ficha para ver respostas completas, imagens e planos. Abrir a ficha mantém esta tarefa pendente.</p><label>Decisão<select name="decision" required><option value="">Escolher decisão…</option>${choices.map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select></label><label data-defer-date hidden>Rever em<input type="date" name="review_date" min="${new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Lisbon'})}"></label><label>Nota da decisão<textarea name="reason" required rows="3"></textarea></label><div class="gc-fh-actions"><button type="button" data-inspect>Abrir ficha do acompanhamento</button><button type="submit">Registar decisão</button><button type="button" data-close-editor>Cancelar</button></div><p role="alert" data-error></p></form>`;
   const form=editor.querySelector('form');
   form.elements.decision.onchange=()=>{const deferred=form.elements.decision.value==='defer';form.querySelector('[data-defer-date]').hidden=!deferred;form.elements.review_date.required=deferred;};
   const host=form.querySelector('[data-source]');
   const question=c.qs.find(q=>'response:'+q.id===signal.key);
   if(question){
    const submit=form.querySelector('[type=submit]');submit.disabled=true;
    const body=document.createElement('div');host.appendChild(body);body.textContent='A carregar respostas originais…';
    try{
     const [r,module]=await Promise.all([window.sb.from('intake_responses').select('id,question_id,answer,updated_at').eq('token_id',question.id),import(`../intake/configs/${question.questionnaire_type}.js`)]);
     if(r.error)throw r.error;if(!current()||!form.isConnected)return;
     const questions=new Map((module.default.seccoes||[]).flatMap(section=>section.perguntas||[]).map(q=>[q.id,q.label]));
     const answer=value=>{if(value==null)return 'Sem resposta';if(Array.isArray(value))return value.join(', ');if(typeof value==='object'){if('v' in value)return [answer(value.v),value.outro_texto].filter(Boolean).join(' · ');return Object.entries(value).map(([k,v])=>k+': '+answer(v)).join(' · ');}return String(value);};
     body.innerHTML=(r.data||[]).map(row=>`<p><b>${esc(questions.get(row.question_id)||row.question_id)}</b><br>${esc(answer(row.answer))}</p>`).join('')||'<p>Não existem respostas guardadas.</p>';submit.disabled=false;
    }catch{if(form.isConnected)body.textContent='Não foi possível carregar as respostas. Atualize a lista antes de registar uma decisão.';}
   }
   if(source.images?.length){
    const body=document.createElement('div');host.appendChild(body);
    for(const path of source.images){const r=await window.sb.storage.from('patient-diary').createSignedUrl(path,300);if(!current()||!form.isConnected)return;const image=document.createElement('img');if(r.data?.signedUrl){image.src=r.data.signedUrl;image.alt='Imagem enviada pelo doente';image.style.maxWidth='100%';body.appendChild(image);}else body.appendChild(document.createTextNode('Imagem indisponível. Consulte a ficha.'));}
   }
   form.querySelector('[data-inspect]').onclick=()=>onOpen?.({patientId:c.patientId,clinicId:c.clinicId});
   form.onsubmit=async ev=>{ev.preventDefault();if(!current())return;const submit=form.querySelector('[type=submit]');submit.disabled=true;
    try{const decision=form.elements.decision.value,note=form.elements.reason.value.trim(),due=form.elements.review_date.value;
     if(!note)throw new Error('Nota obrigatória');
     if(decision==='defer'&&(!due||due<new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Lisbon'})))throw new Error('Data inválida');
     const reason=decision==='defer'?'Rever em: '+due+'\n'+note:note;
     if(decision==='complete_episode'){showDecision(c);editor.querySelector('[data-episode-action=completed]').click();editor.querySelector('[name=reason]').value=reason;return;}
     const r=await window.sb.rpc('record_followup_task_decision',{p_patient_id:c.patientId,p_clinic_id:c.clinicId,p_episode_id:c.episode.episode_id||null,p_source_key:signal.key,p_source_version:signal.version,p_expected_event_id:signal.expectedEventId||null,p_decision:decision,p_reason:reason});
     if(r.error||!r.data)throw r.error||new Error('Gravação não confirmada');if(current()){form.dataset.saved='true';await reload();}
    }catch{if(current()){form.querySelector('[data-error]').textContent='Não foi possível guardar. Atualize a lista antes de tentar novamente.';submit.disabled=false;}}
   };editor.scrollIntoView({block:'nearest'});form.elements.decision.focus();
  }
  function showDecision(c,{start=false}={}){
   const anchor=[...list.querySelectorAll('[data-manage],[data-reactivate]')].find(b=>(b.dataset.manage||b.dataset.reactivate)===c.key)?.closest('.gc-fh-context');
   if(anchor)anchor.appendChild(editor);
   const today=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Lisbon'});
   editor.innerHTML=`<form class="gc-fh-editor gc-fh-compact"><h3>${start?'Reativar — novo episódio':'Alterar situação'} · ${esc(c.name)}</h3>${start?'<p>O novo episódio começa hoje. O anterior permanece no histórico, sem copiar o plano.</p>':`<p>Como terminou este episódio?</p><div class="gc-fh-actions" aria-label="Situação do episódio"><button type="button" data-episode-action="completed" aria-pressed="false">Terminado por decisão médica</button><button type="button" data-episode-action="interrupted" aria-pressed="false">Interrompido antes do previsto</button><button type="button" data-episode-action="archived" aria-pressed="false">Registo de teste</button></div>`}<input type="hidden" name="action" value=""><input type="hidden" name="interruption" value=""><div data-fields ${start?'':'hidden'}><p data-explanation aria-live="polite"></p><div class="gc-fh-actions" data-interruption hidden aria-label="Razão da interrupção"><button type="button" data-interruption-choice="abandonment" aria-pressed="false">Doente desistiu</button><button type="button" data-interruption-choice="medical" aria-pressed="false">Suspensão médica</button><button type="button" data-interruption-choice="agreed" aria-pressed="false">Pausa acordada</button></div><div class="gc-fh-compact-fields">${!start&&!c.episode.closed_at?`<label data-closed-date>Data de fim<input type="date" name="closed_date" max="${today}" value="${today}"></label>`:''}<label>${start?'Motivo da retoma':'Nota curta'}<input type="text" name="reason" placeholder="Registar o motivo" ${start?'required':''}></label></div><div class="gc-fh-actions"><button type="submit" class="gc-fh-open">${start?'Iniciar novo episódio':'Guardar'}</button><button type="button" data-close-editor>Cancelar</button></div></div>${start?'':'<div data-initial-cancel><button type="button" data-close-editor>Cancelar</button></div>'}<p role="alert" data-error></p></form>`;
   const form=editor.querySelector('form');let interruptionLabel='';
   const explanations={completed:'Decidiste terminar o seguimento deste episódio. O doente e o histórico ficam guardados.',interrupted:'O seguimento parou antes do previsto. Indica quem tomou a decisão ou se a pausa foi acordada.',archived:'Não corresponde a acompanhamento clínico real. Fica apenas na área de testes.'};
   form.querySelectorAll('[data-episode-action]').forEach(button=>button.onclick=()=>{
    const action=button.dataset.episodeAction;form.elements.action.value=action;form.elements.interruption.value='';interruptionLabel='';
    form.querySelectorAll('[data-episode-action]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    form.querySelectorAll('[data-interruption-choice]').forEach(b=>b.setAttribute('aria-pressed','false'));
    form.querySelector('[data-fields]').hidden=false;form.querySelector('[data-initial-cancel]').hidden=true;
    form.querySelector('[data-interruption]').hidden=action!=='interrupted';form.querySelector('[data-explanation]').textContent=explanations[action];
    form.querySelector('[data-closed-date]')?.toggleAttribute('hidden',action==='archived');if(form.elements.closed_date)form.elements.closed_date.required=action!=='archived';form.elements.reason.required=true;form.querySelector('[data-error]').textContent='';
   });
   form.querySelectorAll('[data-interruption-choice]').forEach(button=>button.onclick=()=>{
    form.elements.interruption.value=button.dataset.interruptionChoice==='abandonment'?'abandonment':'suspension';interruptionLabel=button.textContent;
    form.querySelectorAll('[data-interruption-choice]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
   });
   form.onsubmit=async ev=>{
    ev.preventDefault();if(!current())return;const action=start?'start':form.elements.action.value;
    if(!action)return;
    if(action==='interrupted'&&!form.elements.interruption.value){form.querySelector('[data-error]').textContent='Escolhe a razão da interrupção.';return;}
    const reason=form.elements.reason.value.trim();if(!reason){form.querySelector('[data-error]').textContent='Regista uma nota curta.';return;}
    const submit=form.querySelector('[type=submit]');submit.disabled=true;
    try{
     const r=await window.sb.rpc('record_followup_episode_decision',{p_patient_id:c.patientId,p_clinic_id:c.clinicId,p_episode_id:c.episode.episode_id||null,p_expected_event_id:c.episode.id||null,p_action:action,p_reason:interruptionLabel?interruptionLabel+' · '+reason:reason,p_interruption_kind:action==='interrupted'?form.elements.interruption.value:null,p_is_test:action==='archived',p_closed_date:start||action==='archived'?null:form.elements.closed_date?.value||null});
     if(r.error||!r.data)throw r.error||new Error('Gravação não confirmada');if(current()){form.dataset.saved='true';if(start)workspaceState.episode='active';await reload();}
    }catch{if(current()){form.querySelector('[data-error]').textContent='Não foi possível guardar a decisão. Atualize a lista e tente novamente.';submit.disabled=false;}}
   };
   editor.scrollIntoView({block:'nearest',behavior:'smooth'});editor.querySelector('button,input[type=text]')?.focus();
  }
  root.onclick=e=>{
   const b=e.target.closest('button');if(!b||!root.contains(b))return;
   if(workspace.handle(b))return;
   if(b.hasAttribute('data-refresh'))return reload();
   if(b.hasAttribute('data-close-editor')){editor.innerHTML='';return;}
   if(b.dataset.history)return showHistory(b.dataset.history);
   const c=context(b.dataset.open||b.dataset.manage||b.dataset.review||b.dataset.reactivate||b.dataset.archive);if(!c||!workspace.visibleContexts({contexts:[c]}).length)return;
   if(b.dataset.open)return onOpen?.({patientId:c.patientId,clinicId:c.clinicId});
   if(b.dataset.review){const signal=c.signals[Number(b.dataset.index)];if(signal&&!signal.informational)showReview(c,signal);return;}
   showDecision(c,{start:Boolean(b.dataset.reactivate),archive:Boolean(b.dataset.archive)});
  };
  render();
 }catch(error){if(!current())return;onOwnership?.([]);console.warn('Acompanhamento de exercício:',error);root.innerHTML='<div class="gc-home-empty"><div><b>Não foi possível carregar o acompanhamento.</b><p>Os dados não devem ser interpretados como uma lista vazia.</p><button type="button" data-retry>Tentar novamente</button></div></div>';root.querySelector('[data-retry]').onclick=()=>loadExerciseHome({clinics,clinicIds,onOpen,onOwnership,summary,onNavigate});}
}
