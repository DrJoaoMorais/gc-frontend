import { canAccessExercise } from './permissoes.js';
import { buildFollowup, FOLLOWUP_STATES } from './followup-model.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=v=>v?new Date(v.length===10?v+'T12:00:00Z':v).toLocaleDateString('pt-PT',{timeZone:'Europe/Lisbon'}):'—';
let revision=0, filter='current', search='', page=0;
export async function loadExerciseHome({clinics=[],clinicIds=[],onOpen}={}) {
 const root=document.getElementById('gcExerciseHome'), request=++revision;
 if(!root)return;
 root.hidden=!canAccessExercise();if(root.hidden)return;
 const current=()=>request===revision&&root.isConnected;
 root.innerHTML='<div class="gc-home-empty">A carregar acompanhamento de exercício…</div>';
 const all=async factory=>{const out=[];for(let offset=0;;offset+=500){if(!current())return [];const r=await factory().range(offset,offset+499);if(r.error)throw r.error;out.push(...(r.data||[]));if((r.data||[]).length<500)return out;}};
 const scoped=(table,columns)=>()=>window.sb.from(table).select(columns).in('clinic_id',clinicIds).order('id');
 const chunked=async(table,columns,key,ids)=>{const out=[];for(let i=0;i<ids.length;i+=100)out.push(...await all(()=>window.sb.from(table).select(columns).in(key,ids.slice(i,i+100)).in('clinic_id',clinicIds).order('id')));return out;};
 try{
  if(!clinicIds.length){root.innerHTML='<div class="gc-home-empty">Selecione uma clínica para ver o acompanhamento.</div>';return;}
  const [prescriptions,questionnaires,events]=await Promise.all([
   all(scoped('wo_prescriptions','id,patient_id,clinic_id,status,created_at,expires_at,content_version,data,patients(full_name)')),
   all(()=>scoped('intake_tokens','id,patient_id,clinic_id,questionnaire_type,status,created_at,expires_at,completed_at,patients(full_name)')().like('questionnaire_type','pre_consulta_v%')),
   all(scoped('wo_followup_events','id,patient_id,clinic_id,kind,state,reason,source_key,source_version,created_at,patients(full_name)'))
  ]);
  const rxIds=prescriptions.map(r=>r.id),patientIds=[...new Set([...prescriptions,...questionnaires,...events].map(r=>r.patient_id))];
  const [logs,readiness,diary,alerts]=await Promise.all([
   chunked('wo_session_logs','id,prescription_id,session_id,clinic_id,logged_at,rpe,feel,sets,note','prescription_id',rxIds),
   chunked('wo_session_readiness','id,prescription_id,patient_id,clinic_id,feeling,has_symptoms,symptom_note,answered_at','prescription_id',rxIds),
   chunked('patient_diary_entries','id,patient_id,clinic_id,entered_at,raw_text,images','patient_id',patientIds),
   chunked('alerts','id,patient_id,clinic_id,source,title,created_at,resolved_at','patient_id',patientIds)
  ]);
  if(!current())return;
  const rows=buildFollowup({prescriptions,questionnaires,logs,readiness,diary,alerts,events});
  const clinicName=id=>clinics.find(c=>c.id===id)?.name||'Clínica';
  const ended=p=>['paused','completed','abandoned'].includes(p.state);
  const choices=[['current','Em seguimento'],['active','Em acompanhamento'],['waiting','A aguardar questionário'],['contact','Sem resposta'],['review','Plano terminado / rever'],['prepare','Preparar plano'],['paused','Pausados'],['completed','Concluídos'],['abandoned','Abandono confirmado']];
  const match=p=>filter==='all'||(filter==='current'?!ended(p):p.state===filter);
  const reload=()=>loadExerciseHome({clinics,clinicIds,onOpen});
  const save=async payload=>{if(!current())return;const r=await window.sb.from('wo_followup_events').insert(payload).select('id').single();if(r.error||!r.data?.id)throw r.error||new Error('A gravação não foi confirmada.');};
  root.innerHTML=`<div class="gc-fh-heading"><div><h2>Acompanhamento de exercício</h2><p>${clinicIds.length===clinics.length?'Todas as clínicas visíveis':clinicIds.map(clinicName).map(esc).join(' · ')} · Uma linha por doente</p></div><button type="button" data-refresh>Atualizar</button></div><div class="gc-fh-stats"><button type="button" data-filter="current"><strong>${rows.filter(p=>!ended(p)).length}</strong>Em seguimento</button><button type="button" data-filter="active"><strong>${rows.filter(p=>p.state==='active').length}</strong>Em acompanhamento</button><button type="button" data-filter="contact"><strong>${rows.filter(p=>p.state==='contact').length}</strong>Sem resposta / contactar</button></div><div class="gc-fh-controls"><label>Estado<select data-state-filter>${[['all','Todos, incluindo histórico'],...choices].map(([v,l])=>`<option value="${v}" ${filter===v?'selected':''}>${l}</option>`).join('')}</select></label><label>Pesquisar doente<input type="search" data-search value="${esc(search)}" placeholder="Nome do doente" /></label></div><div data-list></div><div class="gc-fh-pages" data-pages></div><div data-editor></div><p class="gc-fh-foot">Pausar ou encerrar organiza o seguimento. As ligações do doente mantêm-se; a sua validade é gerida no acompanhamento.</p>`;
  const list=root.querySelector('[data-list]'), pages=root.querySelector('[data-pages]'), editor=root.querySelector('[data-editor]');
  const render=()=>{
   const selected=rows.filter(match).filter(p=>p.name.toLocaleLowerCase('pt').includes(search.toLocaleLowerCase('pt'))), max=Math.max(1,Math.ceil(selected.length/10));page=Math.min(page,max-1);
   list.innerHTML=selected.slice(page*10,page*10+10).map(p=>`<article class="gc-fh-row"><div class="gc-fh-patient"><strong>${esc(p.name)}</strong><span class="gc-fh-status ${p.state==='contact'?'attention':''}">${esc(FOLLOWUP_STATES[p.state])}</span></div><div class="gc-fh-contexts">${p.contexts.map(c=>`<div class="gc-fh-context"><small>${esc(clinicName(c.clinicId))}${p.contexts.length>1?' · '+esc(FOLLOWUP_STATES[c.state]):''}</small><div>${c.endDate?'Treinos até '+date(c.endDate):c.valid.length?'Plano sem sessões datadas':c.rx.length?'Sem plano atual':'Sem plano prescrito'}</div><small>${c.latestActivity?'Último registo: '+date(c.latestActivity):'Sem atividade registada'}${c.nextDate?' · Próximo treino: '+date(c.nextDate):''}</small>${c.reason?`<small>Motivo: ${esc(c.reason)}</small>`:''}<div class="gc-fh-signals">${c.signals.length?`<details><summary>${c.signals.length} pendência(s) · ${esc(c.signals[0].label)}</summary>${c.signals.map((s,i)=>`<div class="gc-fh-signal"><span>${esc(s.label)}<small>${date(s.at)}</small></span><button type="button" data-review="${esc(c.key)}" data-index="${i}">Tratar</button></div>`).join('')}</details>`:'<span class="gc-fh-clear">Sem pendências por tratar</span>'}</div><div class="gc-fh-actions"><button type="button" class="gc-fh-open" data-open="${esc(c.key)}">Abrir acompanhamento →</button><button type="button" data-manage="${esc(c.key)}">Gerir estado</button></div></div>`).join('')}</div></article>`).join('')||'<div class="gc-home-empty">Nenhum doente neste estado e nas clínicas selecionadas.</div>';
   pages.innerHTML=`<button type="button" data-prev ${page===0?'disabled':''}>Anterior</button><span>${selected.length} doente(s) · ${page+1} / ${max}</span><button type="button" data-next ${page===max-1?'disabled':''}>Seguinte</button>`;
   root.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(filter===b.dataset.filter)));
  };
  const context=key=>rows.flatMap(p=>p.contexts).find(c=>c.key===key);
  root.querySelector('[data-search]').addEventListener('input',e=>{search=e.target.value;page=0;render()});
  root.querySelector('[data-state-filter]').addEventListener('change',e=>{filter=e.target.value;page=0;render()});
  root.onclick=async e=>{
   const b=e.target.closest('button');if(!b||!root.contains(b))return;
   if(b.hasAttribute('data-refresh'))return reload();
   if(b.dataset.filter){filter=b.dataset.filter;page=0;root.querySelector('[data-state-filter]').value=filter;render();return;}
   if(b.hasAttribute('data-prev')){page--;render();return;}if(b.hasAttribute('data-next')){page++;render();return;}
   const c=context(b.dataset.open||b.dataset.manage||b.dataset.review);
   if(b.dataset.open){onOpen?.({patientId:c.patientId,clinicId:c.clinicId});return;}
   if(!c)return;
   const signal=b.dataset.review?c.signals[Number(b.dataset.index)]:null;
   editor.innerHTML=`<form class="gc-fh-editor"><h3>${signal?'Tratar pendência':'Gerir estado'} · ${esc(c.name)}</h3><p>${signal?esc(signal.label):esc(clinicName(c.clinicId))}</p>${signal?'<p>Abra o acompanhamento para consultar o registo. Marcar como tratado mantém o histórico.</p>':`<label>Novo estado<select name="state"><option value="auto">Retomar seguimento</option><option value="paused">Pausado</option><option value="completed">Concluído</option><option value="abandoned">Encerrado por abandono confirmado</option></select></label>`}<label>${signal?'Nota da decisão (opcional)':'Motivo da decisão'}<textarea name="reason" rows="2" ${signal?'':'required'}></textarea></label><div class="gc-fh-actions"><button type="button" data-inspect>Abrir acompanhamento</button><button type="submit">${signal?'Marcar como tratado':'Guardar estado'}</button><button type="button" data-cancel>Cancelar</button></div><p role="alert" data-error></p></form>`;
   editor.querySelector('[data-cancel]').onclick=()=>{editor.innerHTML=''};
   editor.querySelector('[data-inspect]').onclick=()=>onOpen?.({patientId:c.patientId,clinicId:c.clinicId});
   editor.querySelector('form').onsubmit=async ev=>{ev.preventDefault();const form=ev.currentTarget,submit=form.querySelector('[type="submit"]');submit.disabled=true;try{const reason=form.elements.reason.value.trim();const payload={patient_id:c.patientId,clinic_id:c.clinicId,kind:signal?'review':'state',reason,...(signal?{source_key:signal.key,source_version:signal.version}:{state:form.elements.state.value})};await save(payload);if(current())await reload();}catch(error){form.querySelector('[data-error]').textContent='Não foi possível guardar. A decisão não foi confirmada. Tente novamente.';submit.disabled=false;}};
   editor.scrollIntoView({block:'nearest',behavior:'smooth'});editor.querySelector('select,textarea')?.focus();
  };
  render();
 }catch(error){if(!current())return;console.warn('Acompanhamento de exercício:',error);root.innerHTML='<div class="gc-home-empty"><div><b>Não foi possível carregar o acompanhamento.</b><p>Os dados não devem ser interpretados como uma lista vazia.</p><button type="button" data-retry>Tentar novamente</button></div></div>';root.querySelector('[data-retry]').onclick=()=>loadExerciseHome({clinics,clinicIds,onOpen});}
}
