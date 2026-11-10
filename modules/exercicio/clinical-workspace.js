import { currentSignals, historicalSignals } from './followup-episodes.js?v=20261009-listas';
import { buildTimelineSessions, classifySession, resolveSessionDate } from './acompanhamento/acompanhamento.js?v=20261110-clinico';
import { lisbonDate } from './followup-model.js?v=20261110-clinico';

export const escapeClinical = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const esc = escapeClinical;
const date = v => v ? String(v).slice(0,10).split('-').reverse().join('/') : 'Por confirmar';
const states = {active:'Em curso',completed:'Concluído',interrupted:'Interrompido',archived:'Arquivado'};
export function interventionSignals(c) {
  if (c.episode.is_test) return [];
  const current = currentSignals(c), keys = new Set(current.map(s => s.key+'|'+s.version));
  return [...current, ...historicalSignals(c).filter(s => s.pendingDecision && !keys.has(s.key+'|'+s.version)).map(s => ({...s,historical:true}))];
}
export function reviewDate(note) { return String(note || '').match(/^Rever em: (\d{4}-\d{2}-\d{2})$/m)?.[1] || null; }
export function observationSummary(c, {logs=[],readiness=[],snapshots=[]}, days=14, now=new Date()) {
  const today=lisbonDate(now), start=new Date(today+'T12:00:00Z');start.setUTCDate(start.getUTCDate()-days+1);
  const since=start.toISOString().slice(0,10), counts={recorded:0,unreported:0,started:0,removed:0}, observations=[];
  for(const rx of c.rx) {
    const same=r=>r.prescription_id===rx.id && (!r.clinic_id||r.clinic_id===c.clinicId);
    const entries=buildTimelineSessions(rx,snapshots.filter(same),readiness.filter(same),logs.filter(same));
    for(const entry of entries) {
      const day=resolveSessionDate(entry);if(!day||day<since||day>today)continue;
      const state=classifySession(entry,today);
      if(state==='REALIZADA')counts.recorded++;
      else if(state==='NAO_REALIZADA')counts.unreported++;
      else if(state==='INICIADA_SEM_REGISTO')counts.started++;
      else if(state.startsWith('REMOVIDA'))counts.removed++;
      if(entry.log||entry.readiness)observations.push({date:day,at:entry.log?.logged_at||entry.readiness?.answered_at,well:entry.log?.feel??null,pre:entry.readiness?.feeling??null,rpe:entry.log?.rpe??null,symptoms:entry.readiness?.symptom_note||'',note:entry.log?.note||'',state});
    }
  }
  observations.sort((a,b)=>a.date.localeCompare(b.date)||String(a.at).localeCompare(String(b.at)));
  return {...counts,observations,latest:observations.at(-1),since,today};
}

export function createClinicalWorkspace({root,rows,clinics,clinicIds,logs,readiness,snapshots,diary,editor,onHistory,summary=false,onNavigate,state={}}) {
  let view=state.view||'patients', search=state.search||'', clinic=clinicIds.includes(state.clinic)?state.clinic:'', episode=state.episode||'active', need=state.need||'all', days=state.days||14, page=0, historyPage=0, selected=null, section='summary';
  const clinicName=id=>clinics.find(c=>c.id===id)?.name||'Clínica';
  const visibleContexts=p=>p.contexts.filter(c=>clinicIds.includes(c.clinicId)&&(!clinic||c.clinicId===clinic));
  const body=root.querySelector('[data-list]'),pages=root.querySelector('[data-pages]');
  const clearEditor=()=>{editor.innerHTML='';selected=null;};
  const remember=()=>Object.assign(state,{view,search,clinic,episode,need,days});
  const tasks=c=>interventionSignals(c);
  const data={logs,readiness,snapshots};
  const observations=new Map();
  const observation=c=>{const key=c.key+':'+days;if(!observations.has(key))observations.set(key,observationSummary(c,data,days));return observations.get(key);};
  const plan=c=>c.endDate?'Sessões até '+date(c.endDate):c.valid.length?'Plano sem sessões datadas':c.rx.length?'Sem plano atual':'Sem plano prescrito';
  const status=c=>c.episode.is_test?'Teste':states[c.episodeState];
  function matching() {
    return rows.filter(p=>p.name.toLocaleLowerCase('pt').includes(search.toLocaleLowerCase('pt'))).map(p=>({...p,contexts:visibleContexts(p).filter(c=>(episode==='test'?c.episode.is_test:!c.episode.is_test&&(episode==='all'||c.episodeState===episode))&&(need==='all'||(need==='pending'?tasks(c).length>0:tasks(c).length===0)))})).filter(p=>p.contexts.length).sort((a,b)=>Number(b.contexts.some(c=>tasks(c).length))-Number(a.contexts.some(c=>tasks(c).length))||a.name.localeCompare(b.name,'pt'));
  }
  function render() {
    remember();clearEditor();const patients=matching(),contexts=patients.flatMap(p=>p.contexts),pending=contexts.flatMap(c=>tasks(c).map(s=>({c,s}))),items=view==='tasks'?pending:patients;
    if(summary){
      const all=rows.flatMap(visibleContexts).filter(c=>!c.episode.is_test),active=new Set(all.filter(c=>c.episodeState==='active').map(c=>c.patientId)),pendingAll=all.flatMap(tasks);
      body.innerHTML=`<div class="gc-clinical-summary"><div><b>${active.size} doente(s) em curso</b><small>${pendingAll.length} intervenção(ões) pendente(s) · inclui decisões históricas abertas</small></div><button type="button" data-clinical-navigate class="gc-fh-open">Abrir Acompanhamento Clínico →</button></div>`;pages.innerHTML='';return;
    }
    const max=Math.max(1,Math.ceil(items.length/10));page=Math.min(page,max-1);
    root.querySelector('[data-clinical-count]').textContent=`${patients.length} doente(s) · ${contexts.length} contexto(s) · ${pending.length} intervenção(ões)`;
    root.querySelectorAll('[data-clinical-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.clinicalView===view)));
    body.innerHTML=items.slice(page*10,page*10+10).map(item=>{
      if(view==='tasks'){const {c,s}=item,due=reviewDate(s.decisionNote);return `<article class="gc-fh-row gc-clinical-task"><div><strong>${esc(c.name)}</strong><small>${esc(clinicName(c.clinicId))} · ${esc(status(c))}</small></div><div><b>${esc(s.label)}</b><small>${date(s.at)}${due?' · Rever em '+date(due):''}${s.historical?' · Origem histórica':''}</small><button type="button" data-review="${esc(c.key)}" data-index="${s.reviewIndex}">Rever fonte e decidir</button></div></article>`;}
      return `<article class="gc-fh-row"><div class="gc-fh-patient"><strong>${esc(item.name)}</strong><small>${item.contexts.length} contexto(s)</small><button type="button" data-clinical-profile="${esc(item.contexts[0].key)}">Abrir ficha</button></div><div>${item.contexts.map(c=>{const o=observation(c),last=o.latest,signals=tasks(c);if(view==='evolution')return `<div class="gc-clinical-context"><div class="gc-fh-context-heading"><b>${esc(clinicName(c.clinicId))}</b><span>${esc(status(c))}</span></div><p>${o.recorded} sessões com registo final · ${o.unreported} sem registo · ${o.started} iniciadas sem conclusão</p><div class="gc-clinical-table"><table><thead><tr><th>Últimas sessões</th><th>Bem-estar pré /5</th><th>Bem-estar pós /5</th><th>RPE /10</th></tr></thead><tbody>${o.observations.slice(-5).map(r=>`<tr><td>${date(r.date)}</td><td>${esc(r.pre??'—')}</td><td>${esc(r.well??'—')}</td><td>${esc(r.rpe??'—')}</td></tr>`).join('')||'<tr><td colspan="4">Sem medidas neste período.</td></tr>'}</tbody></table></div><button type="button" data-clinical-profile="${esc(c.key)}" data-profile-tab="evolution">Consultar evolução e notas originais</button></div>`;return `<div class="gc-clinical-context"><div class="gc-fh-context-heading"><b>${esc(clinicName(c.clinicId))}</b><span>${esc(status(c))}</span></div><div class="gc-clinical-grid"><div><strong>${o.recorded} sessão(ões) com registo final</strong><small>${o.unreported} sem registo · ${o.started} iniciada(s) sem conclusão</small><small>${esc(plan(c))}</small></div><div>${last?`Bem-estar pós-treino: ${esc(last.well??'—')}/5<small>RPE: ${esc(last.rpe??'—')}/10 · ${date(last.date)}</small>`:'Sem medidas neste período'}<small>${c.latestActivity?'Última atividade: '+date(c.latestActivity):'Sem atividade registada'}</small></div><div>${signals.length?`<b>${esc(signals[0].label)}</b><small>${signals.length} intervenção(ões)</small>`:'Sem intervenção pendente'}</div></div></div>`;}).join('')}</div></article>`;
    }).join('')||'<div class="gc-home-empty">Sem resultados para os filtros selecionados.</div>';
    pages.innerHTML=`<button type="button" data-clinical-prev ${page===0?'disabled':''}>Anterior</button><span>${view==='tasks'?items.length+' intervenções':patients.length+' doentes'} · ${page+1} / ${max}</span><button type="button" data-clinical-next ${page===max-1?'disabled':''}>Seguinte</button>`;
    const history=rows.map(p=>({...p,contexts:visibleContexts(p).filter(c=>!c.episode.is_test&&historicalSignals(c).length)})).filter(p=>p.contexts.length&&p.name.toLocaleLowerCase('pt').includes(search.toLocaleLowerCase('pt')));
    root.querySelector('[data-pending-history]').hidden=!history.length;
    root.querySelector('[data-history-count]').textContent=`Histórico por rever · ${history.length} doente(s)`;
    const historyMax=Math.max(1,Math.ceil(history.length/10));historyPage=Math.min(historyPage,historyMax-1);
    root.querySelector('[data-history-list]').innerHTML=history.slice(historyPage*10,historyPage*10+10).map(p=>`<p><button type="button" data-history="${esc(p.patientId)}">${esc(p.name)} · consultar registos anteriores</button></p>`).join('');
    root.querySelector('[data-history-pages]').innerHTML=history.length>10?`<div class="gc-fh-pages"><button type="button" data-clinical-history-prev ${historyPage===0?'disabled':''}>Anterior</button><span>${historyPage+1} / ${historyMax}</span><button type="button" data-clinical-history-next ${historyPage===historyMax-1?'disabled':''}>Seguinte</button></div>`:'';
  }
  function profile(key,tab='summary') {
    const c=rows.flatMap(visibleContexts).find(c=>c.key===key);if(!c)return;
    selected=key;section=tab;const patient=rows.find(p=>p.patientId===c.patientId),all=visibleContexts(patient),o=observation(c);
    root.appendChild(editor);
    editor.innerHTML=`<section class="gc-fh-editor"><div class="gc-fh-heading"><h3>${esc(c.name)}</h3><button type="button" data-close-editor>Fechar ficha</button></div><label>Clínica e episódio<select data-clinical-context>${all.map(x=>`<option value="${esc(x.key)}" ${x.key===key?'selected':''}>${esc(clinicName(x.clinicId))} · ${esc(status(x))} · ${x.episode.started_at?date(x.episode.started_at):'Início por confirmar'}</option>`).join('')}</select></label><nav class="gc-fh-tabs" aria-label="Ficha individual">${[['summary','Resumo'],['evolution','Evolução'],['plan','Plano'],['sources','Questionários e diário'],['history','Histórico']].map(([v,l])=>`<button type="button" data-clinical-tab="${v}" aria-pressed="${section===v}">${l}</button>`).join('')}</nav><div data-clinical-profile-body></div></section>`;
    const host=editor.querySelector('[data-clinical-profile-body]');
    if(tab==='summary')host.innerHTML=`<div class="gc-clinical-grid"><div><h3>Situação atual</h3><p>${esc(status(c))} · ${esc(plan(c))}</p><p>Início: ${date(c.episode.started_at)}</p><p>${esc(c.reason)}</p><button type="button" data-manage="${esc(c.key)}">Gerir episódio</button>${c.episodeState!=='active'&&!all.some(x=>x.clinicId===c.clinicId&&x.episodeState==='active')?`<button type="button" data-reactivate="${esc(c.key)}">Retomar — novo episódio</button>`:''}</div><div><h3>Intervenções</h3>${tasks(c).map(s=>`<div class="gc-fh-signal"><div>${esc(s.label)}<small>${date(s.at)}${s.historical?' · Origem histórica':''}</small></div><button type="button" data-review="${esc(c.key)}" data-index="${s.reviewIndex}">Rever e decidir</button></div>`).join('')||'<p>Sem intervenções pendentes.</p>'}</div></div>`;
    if(tab==='evolution')host.innerHTML=`<p>Últimos ${days} dias · ${o.recorded} sessões com registo final · ${o.unreported} sem registo · ${o.started} iniciadas sem conclusão · ${o.removed} removidas.</p><p>Sem registo não confirma que o exercício não foi realizado. Dor e função não são inferidas do bem-estar.</p><div class="gc-clinical-table"><table><thead><tr><th>Data</th><th>Bem-estar pré /5</th><th>Bem-estar pós /5</th><th>RPE /10</th><th>Registos originais</th></tr></thead><tbody>${o.observations.map(r=>`<tr><td>${date(r.date)}</td><td>${esc(r.pre??'—')}</td><td>${esc(r.well??'—')}</td><td>${esc(r.rpe??'—')}</td><td>${esc(r.symptoms)}${r.symptoms&&r.note?'<br>':''}${esc(r.note)}</td></tr>`).join('')||'<tr><td colspan="5">Sem medidas neste período.</td></tr>'}</tbody></table></div>`;
    if(tab==='plan')host.innerHTML=`<h3>Prescrições deste episódio</h3>${c.rx.map(rx=>`<p>Criada em ${date(rx.created_at)} · ${esc(({active:'Ativa',revoked:'Desativada',expired:'Expirada'})[rx.status]||rx.status)} · ${(rx.data?.sessions||[]).length} sessões</p>`).join('')||'<p>Sem plano prescrito neste episódio.</p>'}<button type="button" data-open="${esc(c.key)}">Abrir prescrição e calendário na ficha atual</button>`;
    if(tab==='sources') {
      const diaries=diary.filter(d=>d.patient_id===c.patientId&&d.clinic_id===c.clinicId&&(!c.episode.started_at||d.entered_at>=c.episode.started_at)&&(!c.episode.data_until||d.entered_at<c.episode.data_until));
      host.innerHTML=`<h3>Questionários</h3>${c.qs.map(q=>`<p>${date(q.created_at)} · ${esc(({completed:'Concluído',expired:'Fora de prazo',in_progress:'Em preenchimento',pending_rgpd:'Por iniciar'})[q.status]||q.status)} · Prazo: ${date(q.expires_at)}</p>`).join('')||'<p>Sem questionários associados.</p>'}<h3>Diário</h3>${diaries.slice().sort((a,b)=>b.entered_at.localeCompare(a.entered_at)).slice(0,20).map(d=>`<div class="gc-fh-source"><small>${date(d.entered_at)}</small><p style="white-space:pre-wrap">${esc(d.raw_text)}</p>${d.images?.length?`<small>${d.images.length} imagem(ns) · abrir ficha para consultar</small>`:''}</div>`).join('')||'<p>Sem entradas de diário neste episódio.</p>'}<button type="button" data-open="${esc(c.key)}">Abrir questionários, diário e anexos na ficha atual</button>`;
    }
    if(tab==='history'){onHistory(c.patientId);return;}
    editor.scrollIntoView({block:'nearest'});
  }
  function handle(button) {
    if(button.hasAttribute('data-clinical-navigate')){onNavigate?.();return true;}
    if(button.dataset.clinicalView){view=button.dataset.clinicalView;if(view==='tasks'&&episode==='active'){episode='all';root.querySelector('[data-clinical-episode]').value='all';}page=0;render();return true;}
    if(button.hasAttribute('data-clinical-history-prev')||button.hasAttribute('data-clinical-history-next')){historyPage+=button.hasAttribute('data-clinical-history-next')?1:-1;render();return true;}
    if(button.dataset.clinicalProfile){profile(button.dataset.clinicalProfile,button.dataset.profileTab||'summary');return true;}
    if(button.dataset.clinicalTab){profile(selected,button.dataset.clinicalTab);return true;}
    if(button.hasAttribute('data-clinical-prev')||button.hasAttribute('data-clinical-next')){page+=button.hasAttribute('data-clinical-next')?1:-1;render();return true;}
    return false;
  }
  for(const [key,apply] of [['search',v=>search=v],['clinic',v=>clinic=v],['episode',v=>episode=v],['need',v=>need=v],['days',v=>days=Number(v)]]) {
    const control=root.querySelector('[data-clinical-'+key+']');if(!control)continue;control.value=String({search,clinic,episode,need,days}[key]);
    control.addEventListener(key==='search'?'input':'change',()=>{apply(control.value);page=0;historyPage=0;render();});
  }
  root.addEventListener('change',e=>{if(e.target.matches('[data-clinical-context]'))profile(e.target.value,section);});
  return {render,handle,visibleContexts};
}

export function clinicalWorkspaceHTML({clinics,clinicIds,summary=false}) {
  return `<div class="gc-fh-heading"><div><h2>Acompanhamento Clínico</h2><p>Doentes, evolução e intervenções pendentes</p></div><button type="button" data-refresh>Atualizar</button></div>${summary?'':`<div class="gc-fh-controls gc-clinical-filters"><label>Pesquisar doente<input type="search" data-clinical-search placeholder="Nome do doente"></label><label>Clínica<select data-clinical-clinic><option value="">Todas as selecionadas</option>${clinics.filter(c=>clinicIds.includes(c.id)).map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></label><label>Estado do episódio<select data-clinical-episode><option value="active">Em curso</option><option value="all">Todos, exceto testes</option><option value="completed">Concluídos</option><option value="interrupted">Interrompidos</option><option value="archived">Arquivo</option><option value="test">Registos de teste</option></select></label><label>Observações<select data-clinical-days><option value="14">Últimos 14 dias</option><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option></select></label><label>Intervenção<select data-clinical-need><option value="all">Com ou sem intervenção</option><option value="pending">Com intervenção pendente</option><option value="clear">Sem intervenção pendente</option></select></label></div><nav class="gc-fh-tabs" aria-label="Vistas clínicas"><button type="button" data-clinical-view="patients">Doentes</button><button type="button" data-clinical-view="evolution">Evolução</button><button type="button" data-clinical-view="tasks">Intervenções</button></nav><p>O período filtra observações. As intervenções abertas mantêm-se; selecione «Todos, exceto testes» para incluir episódios terminados.</p><p data-clinical-count role="status" aria-live="polite"></p>`}<div data-list></div><div class="gc-fh-pages" data-pages></div><div data-editor></div><details data-pending-history hidden><summary data-history-count></summary><div data-history-list></div><div data-history-pages></div></details><p class="gc-fh-foot">Cada decisão mantém a clínica e o episódio de origem. Abrir a ficha não resolve intervenções.</p>`;
}

export const clinicalWorkspaceCSS=`
.gc-clinical-summary{display:flex;justify-content:space-between;align-items:center;gap:14px;background:#fff;padding:18px;border:1px solid #dbe3ed;border-radius:10px;margin:12px 0}.gc-clinical-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.gc-clinical-context{padding:8px 0}.gc-clinical-context+.gc-clinical-context{border-top:1px solid #e2e8f0}.gc-clinical-context strong{font-size:13px}.gc-clinical-filters>label{flex:1 1 150px;min-width:0}.gc-clinical-table{overflow:auto}.gc-clinical-table table{width:100%;border-collapse:collapse;font-size:12px}.gc-clinical-table th,.gc-clinical-table td{padding:9px;text-align:left;border-bottom:1px solid #e2e8f0;overflow-wrap:anywhere}.gc-fh-source{padding:12px;background:#f1f5f9;margin:10px 0;overflow-wrap:anywhere}.gc-fh-editor .gc-clinical-grid{grid-template-columns:1fr 1fr}.gc-fh-patient button{margin-top:8px}.gc-fh [data-pending-history]{margin-top:18px}.gc-fh [data-pending-history]>summary{cursor:pointer;color:#456892;font-size:13px}.gc-fh-editor select{width:100%}.gc-fh{overflow-wrap:anywhere}.gc-clinical-task button{margin-top:8px}.gc-fh-heading>button{flex-shrink:0;white-space:nowrap}
@media(max-width:680px){.gc-clinical-filters>label{flex:initial}}
@media(max-width:800px){.gc-clinical-grid{grid-template-columns:1fr}.gc-fh-editor .gc-clinical-grid{grid-template-columns:1fr}.gc-clinical-summary{align-items:stretch;flex-direction:column}}
`;
