import {G} from './state.js';
import {escapeHtml as e} from './helpers.js';
import {emailURL} from './agenda-contactos.js';
import {loadFinanceForAgenda} from './financas.js';
import {canViewAgendaFinance} from './agenda-permissoes.js';
import {ACCOUNTANT,euro,clinicPolicy,monthlyClinic,monthBounds,lisbonDay,dateLabel,periodLabel,isSent,sentForRecord,billableRows,buildRequest} from './agenda-fecho-model.js';

let generation = 0;
async function allRows(query) {
  const rows = [];
  for (let offset=0;;offset+=500) {
    const {data,error} = await query().range(offset,offset+499);
    if (error) throw error;
    rows.push(...(data||[]));
    if ((data||[]).length < 500) return rows;
  }
}
async function appointmentsFor(start,end,clinicIds) {
  if (!clinicIds.length) return [];
  const lower = new Date(start+'T00:00:00Z'); lower.setUTCDate(lower.getUTCDate()-1);
  const upper = new Date(end+'T00:00:00Z'); upper.setUTCDate(upper.getUTCDate()+1);
  const rows = await allRows(()=>window.sb.from('appointments').select('id,clinic_id,patient_id,start_at,status,mode,procedure_type').in('clinic_id',clinicIds).gte('start_at',lower.toISOString()).lt('start_at',upper.toISOString()).order('start_at').order('id'));
  return rows.filter(a=>a.mode!=='bloqueio' && lisbonDay(a.start_at)>=start && lisbonDay(a.start_at)<=end);
}
async function historyFor(entities) {
  if (!entities.length) return [];
  const rows=await allRows(()=>window.sb.from('controlo_faturacao').select('*, envio:agenda_envios_faturacao(snapshot)').in('entidade_id',entities.map(x=>x.id)).order('id'));
  return rows.map(r=>({...r,envio_snapshot:r.envio?.snapshot||null}));
}
function chooseMonth(name,callback) {
  const dialog = document.createElement('dialog');
  dialog.className='aw-fecho-dialog';
  dialog.innerHTML=`<h2>Fechar a contabilidade do mês?</h2><p>Esta é a última data com consultas marcadas em <strong>${e(name)}</strong> este mês.</p><p>Quer aproveitar para incluir os atos realizados ainda por enviar deste mês?</p><div class="aw-actions"><button data-choice="month">Fechar o mês</button><button data-choice="day">Só fechar o dia</button><button data-choice="cancel">Agora não</button></div>`;
  document.body.append(dialog);
  dialog.querySelectorAll('button').forEach(b=>b.onclick=()=>{dialog.close();dialog.remove();if(b.dataset.choice!=='cancel')callback(b.dataset.choice)});
  dialog.oncancel=()=>dialog.remove();dialog.showModal();
}

export async function renderAgendaFinance(host,{day,clinicId}) {
  const gen=++generation;
  const alive=()=>gen===generation && host.isConnected && canViewAgendaFinance(G.role);
  if (!canViewAgendaFinance(G.role)) {host.replaceChildren();return;}
  const initial=await loadFinanceForAgenda({day,clinicId});
  if (!alive()) return;
  const entities=initial.entities.filter(x=>x.clinic_id && (!Array.isArray(G.agendaClinicIds)||G.agendaClinicIds.includes(String(x.clinic_id))));
  const ids=[...new Set(entities.map(x=>x.clinic_id))];
  const today=await appointmentsFor(day,day,ids);
  if (!alive()) return;
  const activeIds=[...new Set(today.filter(a=>!['cancelled','no_show'].includes(a.status)).map(a=>a.clinic_id))];
  const nameFor=id=>G.clinicsById?.[id]?.name||entities.find(x=>x.clinic_id===id)?.nome||'Clínica';
  host.innerHTML=`<div class="aw-fecho-heading"><strong>Fecho de ${e(dateLabel(day))}</strong><span>Para ${e(ACCOUNTANT)}</span></div><div data-day-clinics></div><details class="aw-fecho-other"><summary>Fechar outro período / pendentes anteriores</summary><p>Escolha uma clínica e as datas. Pode juntar dois ou mais meses.</p><label>Clínica <select data-other-clinic>${ids.map(id=>`<option value="${e(id)}">${e(nameFor(id))}</option>`).join('')}</select></label><div class="aw-fecho-dates"><label>De <input data-other-start type="date" value="${e(monthBounds(day).start)}"></label><label>Até <input data-other-end type="date" value="${e(day)}"></label><button data-other-load>Ver atos por enviar</button></div><div data-other-result></div></details>`;
  if (!activeIds.length) host.querySelector('[data-day-clinics]').textContent='Sem consultas ou outros atos nesta data nas clínicas selecionadas.';

  async function renderClinic(target,id,start,end,{offerMonth=false}={}) {
    const name=nameFor(id),policy=clinicPolicy(name),month=monthBounds(day);
    const local=Symbol();target._request=local;
    const current=()=>alive()&&target.isConnected&&target._request===local;
    target.innerHTML='<p>A verificar os atos e os envios anteriores…</p>';
    try {
      if (!start||!end||start>end||end>lisbonDay(new Date())) throw new Error('Escolha um período válido, até hoje.');
      if (policy==='avenca') {
        if (start.slice(0,7)!==end.slice(0,7)) throw new Error('Na Liga, escolha um mês de cada vez para a avença.');
        ({start,end}=monthBounds(start));
      }
      const ownEntities=entities.filter(x=>x.clinic_id===id);
      const [finance,appointments,history]=await Promise.all([loadFinanceForAgenda({day,start,end,clinicId:id}),appointmentsFor(start,end,[id]),historyFor(ownEntities)]);
      if (!current()) return;
      let rows=billableRows(finance.records,appointments,history).filter(r=>ownEntities.some(ent=>ent.id===r.entidade_id&&ent.tipo!=='avenca'));
      let sentCount=finance.records.filter(r=>sentForRecord(r,history)).length;
      let items=[];
      const issues=[];
      if (policy==='avenca') {
        const aven=ownEntities.filter(x=>x.tipo==='avenca');
        if (aven.length!==1) throw new Error('Confirme a configuração da avença desta clínica em Finanças.');
        const entity=aven[0],key=start.slice(0,7);
        const sent=history.find(h=>h.entidade_id===entity.id&&h.granularidade==='mensal'&&h.chave===key&&isSent(h));
        const recorded=finance.records.filter(r=>r.entidade_id===entity.id&&r.agendaCounts);
        if(recorded.length>1) throw new Error('Existe mais de um registo de avença neste mês. Confirme o valor em Finanças.');
        const amount=recorded.length ? recorded.reduce((s,r)=>s+Number(r.valor),0) : entity.avenca_valor;
        rows=sent?[]:[{entidade_id:entity.id,data:start,tipo_acto:'Avença mensal',agendaFee:amount,agendaBilled:amount}];
        sentCount=sent?1:0;
        items=sent?[]:[{entidade_id:entity.id,granularidade:'mensal',chave:key,data_referencia:start,registo_financeiro_id:null}];
      } else {
        const covered=new Set(finance.records.map(r=>r.appointment_id).filter(Boolean));
        const missing=appointments.filter(a=>a.status==='done'&&!covered.has(a.id));
        if (missing.length) issues.push(`${missing.length} atos realizados sem registo financeiro. Regularize-os antes do envio.`);
        const unsettled=appointments.filter(a=>['scheduled','arrived'].includes(a.status)&&lisbonDay(a.start_at)<=lisbonDay(new Date()));
        if (unsettled.length) issues.push(`${unsettled.length} marcações ainda sem estado final. Confirme quais foram realizadas.`);
        const inconsistent=finance.records.filter(r=>r.appointment_id&&appointments.some(a=>a.id===r.appointment_id&&a.status==='done')&&!r.agendaCounts&&r.financial_status!=='honorarios_dispensados');
        if (inconsistent.length) issues.push('Existem estados da agenda e de Finanças por conciliar.');
        items=rows.map(r=>({entidade_id:r.entidade_id,granularidade:'registo',chave:r.id,data_referencia:String(r.data).slice(0,10),registo_financeiro_id:r.id}));
      }
      const request=buildRequest({name,start,end,records:rows,policy});
      issues.push(...request.issues);
      let lastDate=false;
      if (offerMonth && monthlyClinic(name) && today.some(a=>a.clinic_id===id&&a.status==='done')) {
        const monthAppointments=await appointmentsFor(day,month.end,[id]);
        if (!current()) return;
        lastDate=!monthAppointments.some(a=>lisbonDay(a.start_at)>day&&!['cancelled','no_show'].includes(a.status));
      }
      const sentHistory=history.filter(isSent).filter(h=>h.data_referencia>=start&&h.data_referencia<=end);
      const historyCount=new Set(sentHistory.map(h=>h.envio_snapshot?.batch_id||h.id)).size;
      target.innerHTML=`<section class="aw-fecho-card"><div class="aw-fecho-heading"><h2>${e(name)}</h2><span>${e(periodLabel(start,end))}</span></div>${lastDate?'<p class="aw-fecho-notice">Última data com consultas marcadas este mês. Pode aproveitar para fechar o mês.</p>':''}<div class="aw-fin-grid"><div><strong>${policy==='avenca'?(rows.length?'Avença por enviar':'Avença enviada'):`${rows.length} ${rows.length===1?'ato':'atos'} por enviar`}</strong>${policy==='individual'?` · ${request.invoiceCount} ${request.invoiceCount===1?'fatura':'faturas'}`:''}</div><div>Total a pedir: <strong>${e(euro(request.total))}</strong></div>${sentCount?`<div>${sentCount} registo(s) já enviados, excluídos deste pedido.</div>`:''}</div>${issues.length?`<div class="aw-fecho-warning" role="status">${[...new Set(issues)].map(t=>`<p>${e(t)}</p>`).join('')}</div>`:''}<div class="aw-actions"><button data-day>${policy==='avenca'?'Rever pedido da avença':'Fechar o dia'}</button>${policy!=='avenca'?'<button data-month>Fechar o mês</button><button data-period>Escolher período</button>':''}</div><div data-period-form hidden><div class="aw-fecho-dates"><label>De <input type="date" data-start value="${e(start)}"></label><label>Até <input type="date" data-end value="${e(end)}"></label><button data-load>Ver período</button></div></div><div data-draft hidden></div><details data-history><summary>Histórico de envios deste período · ${historyCount}</summary><div data-history-body></div></details></section>`;
      const draft=target.querySelector('[data-draft]');
      const saveStatus=message=>{const status=draft.querySelector('[data-status]');if(status)status.textContent=message;};
      const prepare=()=>{
        if (!current()) return;
        draft.hidden=false;
        if (issues.length||!rows.length) {draft.textContent=issues.length?'Resolva os dados assinalados antes de preparar o email.':'Não há atos ou avença por enviar neste período.';return;}
        const subject=`Pedido de faturação · ${name} · ${periodLabel(start,end)}`;
        draft.innerHTML=`<p><strong>Para:</strong> ${e(ACCOUNTANT)}</p><label>Assunto <input data-subject></label><label>Texto do email <textarea data-body rows="12"></textarea></label><div class="aw-actions"><button data-mail>Abrir email</button><button data-copy>Copiar texto</button><button data-download>Guardar email</button></div><label class="aw-fecho-confirm"><input type="checkbox" data-confirm> Já enviei este email à contabilista.</label><button data-save disabled>Registar envio</button><p data-status role="status">O pedido continua por enviar até confirmar o envio.</p>`;
        draft.querySelector('[data-subject]').value=subject;draft.querySelector('[data-body]').value=request.body;
        const reset=()=>{draft.querySelector('[data-confirm]').checked=false;draft.querySelector('[data-save]').disabled=true;};
        draft.querySelector('[data-body]').oninput=reset;draft.querySelector('[data-subject]').oninput=reset;
        draft.querySelector('[data-confirm]').onchange=ev=>{draft.querySelector('[data-save]').disabled=!ev.target.checked;};
        draft.querySelector('[data-copy]').onclick=async()=>{try{await navigator.clipboard.writeText(draft.querySelector('[data-body]').value);saveStatus('Texto copiado.')}catch(_){saveStatus('Não foi possível copiar. Selecione o texto e copie manualmente.')}};
        draft.querySelector('[data-mail]').onclick=()=>{
          const url=emailURL(ACCOUNTANT,draft.querySelector('[data-subject]').value,draft.querySelector('[data-body]').value);
          if (!url||url.length>1800) {saveStatus('Este email é extenso. Use «Guardar email» para abrir o ficheiro na aplicação de email, ou copie o texto.');return;}
          window.location.href=url;saveStatus('Email preparado. Confirme abaixo apenas depois de o enviar.');
        };
        draft.querySelector('[data-download]').onclick=()=>{
          const encoded=btoa(unescape(encodeURIComponent(draft.querySelector('[data-subject]').value.replace(/[\r\n]/g,' '))));
          const body=draft.querySelector('[data-body]').value.replace(/\r?\n/g,'\r\n');
          const content=`To: ${ACCOUNTANT}\r\nSubject: =?UTF-8?B?${encoded}?=\r\nX-Unsent: 1\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${body}`;
          const url=URL.createObjectURL(new Blob([content],{type:'message/rfc822'})),a=document.createElement('a');a.href=url;a.download=`pedido-faturacao-${start}.eml`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);saveStatus('Email guardado. Abra o ficheiro, reveja e envie.');
        };
        draft.querySelector('[data-save]').onclick=async()=>{
          const button=draft.querySelector('[data-save]');if(!draft.querySelector('[data-confirm]').checked||!current())return;button.disabled=true;
          const snapshot={recipient:ACCOUNTANT,subject:draft.querySelector('[data-subject]').value,body:draft.querySelector('[data-body]').value,start,end,clinic_id:id,total:request.total,record_ids:rows.map(r=>r.id).filter(Boolean),record_versions:Object.fromEntries(rows.filter(r=>r.id).map(r=>[r.id,r.updated_at])),confirmation:'manual'};
          try {
            const {error}=await window.sb.rpc('agenda_confirmar_envio',{p_items:items,p_snapshot:snapshot});if(error)throw error;
            if(current())await renderClinic(target,id,start,end);
          } catch(error) {if(current()){saveStatus('O envio não ficou registado: '+error.message);button.disabled=false;}}
        };
      };
      const dayButton=target.querySelector('[data-day]');
      if (start!==end&&policy!=='avenca') dayButton.textContent='Rever pedido deste período';
      dayButton.onclick=()=>lastDate?chooseMonth(name,choice=>choice==='month'?renderClinic(target,id,month.start,day):prepare()):prepare();
      target.querySelector('[data-month]')?.addEventListener('click',()=>{const bounds=monthBounds(start);renderClinic(target,id,bounds.start,bounds.end<lisbonDay(new Date())?bounds.end:lisbonDay(new Date()));});
      target.querySelector('[data-period]')?.addEventListener('click',()=>{target.querySelector('[data-period-form]').hidden=false;});
      target.querySelector('[data-load]')?.addEventListener('click',()=>renderClinic(target,id,target.querySelector('[data-start]').value,target.querySelector('[data-end]').value));
      const historyHost=target.querySelector('[data-history-body]');
      const seen=new Set();
      for(const h of sentHistory){
        const snapshot=h.envio_snapshot,key=snapshot?.batch_id||h.id;
        if(seen.has(key))continue;seen.add(key);
        const detail=document.createElement('details');
        detail.innerHTML=`<summary>Enviado · ${e(h.enviado_contabilista_at?new Date(h.enviado_contabilista_at).toLocaleString('pt-PT',{timeZone:'Europe/Lisbon'}):'data não registada')}</summary><pre></pre>`;
        detail.querySelector('pre').textContent=snapshot?`Para: ${snapshot.recipient}\nAssunto: ${snapshot.subject}\n\n${snapshot.body}`:'Registo anterior: o conteúdo do email não foi guardado.';
        historyHost.append(detail);
      }
    }catch(error){if(current())target.innerHTML=`<p role="alert">Não foi possível preparar o fecho: ${e(error.message)}</p>`;}
  }
  for(const id of activeIds){const target=document.createElement('div');host.querySelector('[data-day-clinics]').append(target);await renderClinic(target,id,day,day,{offerMonth:true});if(!alive())return;}
  host.querySelector('[data-other-load]').onclick=()=>renderClinic(host.querySelector('[data-other-result]'),host.querySelector('[data-other-clinic]').value,host.querySelector('[data-other-start]').value,host.querySelector('[data-other-end]').value);
}
