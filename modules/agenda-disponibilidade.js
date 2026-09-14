import { G } from './state.js';
import { escapeHtml } from './helpers.js';
import { icon } from './agenda-icons.js';
import { modalStyles } from './marcacao-visual.js';

const inactive = new Set(['cancelled','rescheduled','no_show']);
export function overlaps(a,b) { return new Date(a.start_at)<new Date(b.end_at) && new Date(a.end_at)>new Date(b.start_at); }
export function localDayEnd(day) { const d=new Date(day+'T00:00:00');d.setDate(d.getDate()+1);return d.toISOString(); }
export function blockRows({from,to,start,end,allDay,untilEnd,clinicIds,notes}) {
  if(!from||!to||to<from) throw new Error('Confirma as datas: o fim não pode ser anterior ao início.');
  if(!clinicIds.length) throw new Error('Seleciona pelo menos uma clínica.');
  if(!allDay && (!start || (!untilEnd && (!end || end<=start)))) throw new Error('A hora de fim deve ser posterior à hora de início.');
  const rows=[];const day=new Date(from+'T00:00:00'),last=new Date(to+'T00:00:00');
  if(!Number.isFinite(+day)||!Number.isFinite(+last))throw new Error('Data inválida.');
  while(day<=last){
    const iso=[day.getFullYear(),String(day.getMonth()+1).padStart(2,'0'),String(day.getDate()).padStart(2,'0')].join('-');
    const start_at=new Date(iso+'T'+(allDay?'00:00':start)+':00').toISOString();
    const end_at=allDay||untilEnd?localDayEnd(iso):new Date(iso+'T'+end+':00').toISOString();
    for(const clinic_id of clinicIds)rows.push({clinic_id,patient_id:null,start_at,end_at,status:'confirmed',procedure_type:null,title:'BLOQUEIO',notes,mode:'bloqueio'});
    day.setDate(day.getDate()+1);
  }
  return rows;
}
export async function findBlockingAppointments(client,{clinicId,startAt,endAt,excludeId}) {
  const {data,error}=await client.from('appointments').select('id,clinic_id,start_at,end_at,mode,status,notes')
    .eq('mode','bloqueio').lt('start_at',endAt).gt('end_at',startAt)
    .or('clinic_id.eq.'+clinicId+',clinic_id.is.null');
  if(error)throw new Error('Não foi possível verificar os bloqueios. Tenta novamente antes de gravar.');
  return (data||[]).filter(r=>r.id!==excludeId&&!inactive.has(r.status)&&overlaps(r,{start_at:startAt,end_at:endAt}));
}
export async function assertNoBlock(client,args) {
  if((await findBlockingAppointments(client,args)).length)throw new Error('Este período está bloqueado. Escolhe outra hora ou gere o bloqueio na Agenda.');
}
function field(id,label,type,value=''){return `<div><label for="${id}">${label}</label><input id="${id}" type="${type}" value="${escapeHtml(value)}"></div>`;}
function section(title,symbol,body){return `<section class="gm-section"><h2 class="gm-heading">${icon(symbol)}${title}</h2>${body}</section>`;}
export async function openScheduleModal({kind='availability',clinicId,day,onSaved=()=>{},onRecurring=null,start='09:00',end='18:00'}={}) {
  const clinics=G.clinics||[];
  const clinic=clinics.find(c=>c.id===clinicId);
  if(!clinics.length){alert('Não há clínicas disponíveis.');return;}
  if(document.getElementById('gcScheduleOverlay'))return;
  const block=kind==='block';
  const durations=Object.fromEntries(clinics.map(c=>[c.id,Number(c.duracao_default_min)||(/alfra/i.test(c.name||'')?20:15)]));
  if(!block&&clinics.some(c=>!c.duracao_default_min)){
    try{const r=await window.sb.from('clinics').select('id,duracao_default_min').in('id',clinics.map(c=>c.id));if(!r.error)for(const c of r.data||[])if(Number(c.duracao_default_min)>0)durations[c.id]=Number(c.duracao_default_min);}catch(_){}
  }
  if(document.getElementById('gcScheduleOverlay'))return;
  modalStyles();
  const ov=document.createElement('div');ov.id='gcScheduleOverlay';ov.className='gm-overlay gs-overlay';
  const title=block?'Bloquear agenda':'Disponibilidade';
  const today=new Date();day=day||[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
  ov.innerHTML=`<div class="gm-panel" role="dialog" aria-modal="true" aria-labelledby="gsTitle">
    <div class="gm-header"><div><div id="gsTitle" class="gm-title">${icon(block?'shield':'calendar')}${title}</div><div><span id="gsClinicNames">${escapeHtml(clinic?.name||clinic?.slug||'Todas as clínicas')}</span> · ${block?'Impedir novas marcações':'Abrir um dia de consultas'}</div></div><button id="gsClose" aria-label="Fechar">×</button></div>
    <div class="gm-body">
      <p class="gs-explanation">${block?'O bloqueio prevalece sobre a disponibilidade. As consultas existentes não são apagadas.':'Define a data em que vais dar consultas e o período de atendimento. Aplica-se apenas a esse dia.'}</p>
      ${block?section('1. Quando','clock',`<div class="gs-options"><button id="gsAllDay" type="button" aria-pressed="true">Dia inteiro</button><button id="gsHours" type="button" aria-pressed="false">Período de horas</button></div><div class="gm-grid gm-two">${field('gsFrom','Data de início','date',day)}${field('gsTo','Data de fim','date',day)}</div><div id="gsTimeFields" hidden><div class="gm-grid gm-two">${field('gsStart','A partir das','time','18:00')}${field('gsEnd','Até às','time','19:00')}</div><label class="gs-check"><input id="gsUntilEnd" type="checkbox"> Até ao fim do dia</label></div>`):section('1. Quando','clock',`${field('gsDate','Data das consultas','date',day)}<div class="gm-grid gm-two">${field('gsStart','Início das consultas','time',start)}${field('gsEnd','Fim das consultas','time',end)}</div><p id="gsDuration" class="gs-hint"></p><div id="gsPreview" class="gs-summary"></div>`)}
      ${section('2. Clínicas','clinic',`<label class="gs-check"><input id="gsAllClinics" type="checkbox" ${!clinicId?'checked':''}> Todas as clínicas</label><div class="gs-clinics">${clinics.map(c=>`<label class="gs-check"><input type="checkbox" data-clinic="${escapeHtml(c.id)}" ${!clinicId||c.id===clinicId?'checked':''}>${escapeHtml(c.name||c.slug)}</label>`).join('')}</div><p class="gs-hint">A mesma data e período aplicam-se apenas às clínicas selecionadas.</p>`)}
      ${block?section('3. Motivo e nota','file',`<label for="gsReason">Motivo</label><select id="gsReason"><option>Reunião</option><option>Terminar consultas mais cedo</option><option>Férias</option><option>FPF</option><option>Congresso</option><option>Outro</option></select><label for="gsNote">Nota (opcional)</label><textarea id="gsNote" rows="2" placeholder="Informação sobre este bloqueio…"></textarea>`):''}
      <div id="gsExisting" class="gs-summary" role="status"></div>
      ${!block&&onRecurring?'<button id="gsRecurring" type="button" class="gs-secondary">Gerir disponibilidade semanal…</button>':''}
    </div><div class="gm-footer"><div id="gsMessage" role="status"></div><button id="gsCancel">Cancelar</button><button id="gsSave" class="gm-primary">${block?'Criar bloqueio':'Guardar disponibilidade'}</button></div>
  </div>`;
  document.body.append(ov);const $=id=>ov.querySelector('#'+id);let busy=false,allDay=true,epoch=0;
  const close=()=>{if(!busy){++epoch;ov.remove();}};$('gsClose').onclick=close;$('gsCancel').onclick=close;
  const selectedIds=()=>[...ov.querySelectorAll('[data-clinic]:checked')].map(el=>el.dataset.clinic);
  $('gsRecurring')?.addEventListener('click',()=>{const ids=selectedIds();if(ids.length!==1){fail(new Error('Seleciona uma clínica para gerir o respetivo horário semanal.'));return;}close();onRecurring(ids[0]);});
  const fail=err=>{$('gsMessage').textContent=err.message||String(err);$('gsMessage').style.color='#b91c1c';};
  const setBusy=value=>{busy=value;ov.querySelectorAll('button,input,select,textarea').forEach(el=>el.disabled=value);if(block&&!value)$('gsEnd').disabled=$('gsUntilEnd').checked;};
  if(block){
    const mode=value=>{allDay=value;$('gsTimeFields').hidden=value;$('gsAllDay').setAttribute('aria-pressed',String(value));$('gsHours').setAttribute('aria-pressed',String(!value));};
    $('gsAllDay').onclick=()=>mode(true);$('gsHours').onclick=()=>mode(false);
    $('gsUntilEnd').onchange=()=>{$('gsEnd').disabled=$('gsUntilEnd').checked;$('gsEnd').parentElement.hidden=$('gsUntilEnd').checked;};
    $('gsFrom').onchange=()=>{if($('gsTo').value<$('gsFrom').value)$('gsTo').value=$('gsFrom').value;loadExisting();};$('gsTo').onchange=loadExisting;
  }else{
    const preview=()=>{
      const a=$('gsStart').value,b=$('gsEnd').value,ids=selectedIds();
      const mins=t=>{const [h,m]=t.split(':').map(Number);return h*60+m;};
      $('gsDuration').textContent=ids.map(id=>(clinics.find(c=>c.id===id)?.name||'Clínica')+': '+durations[id]+' minutos').join(' · ');
      $('gsPreview').textContent=ids.map(id=>{const count=a&&b?Math.floor((mins(b)-mins(a))/durations[id]):0;return (clinics.find(c=>c.id===id)?.name||'Clínica')+': '+Math.max(0,count)+' horários';}).join(' · ')+(ids.length?' — antes de descontar consultas e bloqueios.':'Seleciona as clínicas.');
    };
    for(const id of ['gsStart','gsEnd'])$(id).addEventListener('input',preview);preview();$('gsDate').onchange=loadExisting;
    ov.querySelectorAll('[data-clinic],#gsAllClinics').forEach(el=>el.addEventListener('change',()=>queueMicrotask(preview)));
  }
  const updateClinicNames=()=>{const ids=selectedIds();$('gsClinicNames').textContent=ids.length===clinics.length?'Todas as clínicas':ids.length?ids.map(id=>clinics.find(c=>c.id===id)?.name||'Clínica').join(' · '):'Seleciona as clínicas';$('gsAllClinics').indeterminate=ids.length>0&&ids.length<clinics.length;};
  ov.querySelectorAll('[data-clinic],#gsAllClinics').forEach(el=>el.addEventListener('change',()=>queueMicrotask(updateClinicNames)));updateClinicNames();
  $('gsAllClinics').addEventListener('change',()=>{ov.querySelectorAll('[data-clinic]').forEach(el=>el.checked=$('gsAllClinics').checked);loadExisting();});
  ov.querySelectorAll('[data-clinic]').forEach(el=>el.addEventListener('change',()=>{const n=selectedIds().length;$('gsAllClinics').checked=n===clinics.length;$('gsAllClinics').indeterminate=n>0&&n<clinics.length;loadExisting();}));
  async function loadExisting(){
    const token=++epoch,d=block?$('gsFrom').value:$('gsDate').value;const host=$('gsExisting');
    if(!d||!selectedIds().length){host.textContent='';return;}
    host.textContent='A consultar períodos existentes…';
    try{
      if(block){
        const allRows=await Promise.all(selectedIds().map(id=>findBlockingAppointments(window.sb,{clinicId:id,startAt:new Date(d+'T00:00:00').toISOString(),endAt:localDayEnd($('gsTo').value||d)})));
        const rows=[...new Map(allRows.flat().map(r=>[r.id,r])).values()];
        if(token!==epoch)return;
        host.replaceChildren();
        if(!rows.length){host.textContent='Sem bloqueios neste período nas clínicas selecionadas.';return;}
        for(const row of rows){const line=document.createElement('div');line.className='gs-existing-row';const label=document.createElement('span');label.textContent=(clinics.find(c=>c.id===row.clinic_id)?.name||'Todas as clínicas')+' · '+(row.notes||'Bloqueio')+' · '+new Date(row.start_at).toLocaleString('pt-PT')+' — '+new Date(row.end_at).toLocaleString('pt-PT');const remove=document.createElement('button');remove.type='button';remove.textContent='Remover';remove.onclick=async()=>{if(!confirm('Remover este bloqueio? As consultas existentes serão mantidas.'))return;setBusy(true);try{const {error}=await window.sb.from('appointments').delete().eq('id',row.id).eq('mode','bloqueio');if(error)throw error;await onSaved();await loadExisting();}catch(e){fail(e);}finally{setBusy(false);}};line.append(label,remove);host.append(line);}
      }else{
        const {data,error}=await window.sb.from('dias_consulta_avulsos').select('clinic_id,hora_inicio,hora_fim').in('clinic_id',selectedIds()).eq('data',d);if(error)throw error;if(token!==epoch)return;
        host.textContent=data?.length?'Disponibilidade já criada neste dia: '+data.map(r=>(clinics.find(c=>c.id===r.clinic_id)?.name||'Clínica')+' '+r.hora_inicio.slice(0,5)+'–'+r.hora_fim.slice(0,5)).join(' · '):'Sem disponibilidade pontual criada neste dia.';
      }
    }catch(e){if(token===epoch)host.textContent='Não foi possível consultar os períodos existentes.';}
  }
  loadExisting();
  $('gsSave').onclick=async()=>{
    if(busy)return;$('gsMessage').textContent='';setBusy(true);
    try{
      if(block){
        const clinicIds=selectedIds();
        const rows=blockRows({from:$('gsFrom').value,to:$('gsTo').value,start:$('gsStart').value,end:$('gsEnd').value,allDay,untilEnd:$('gsUntilEnd').checked,clinicIds,notes:[$('gsReason').value,$('gsNote').value.trim()].filter(Boolean).join(' — ')});
        const {data,error}=await window.sb.from('appointments').select('id,clinic_id,start_at,end_at,status,mode,patient_id').in('clinic_id',clinicIds).lt('start_at',rows.at(-1).end_at).gt('end_at',rows[0].start_at);if(error)throw error;
        const existing=(data||[]).filter(a=>a.mode!=='bloqueio'&&a.mode!=='slot'&&a.patient_id&&!inactive.has(a.status)&&rows.some(b=>a.clinic_id===b.clinic_id&&overlaps(a,b)));
        if(existing.length&&!confirm(`Existem ${existing.length} consultas neste período. Serão mantidas e precisarão de revisão. Criar o bloqueio para impedir novas marcações?`))return;
        const result=await window.sb.from('appointments').insert(rows);if(result.error)throw result.error;
      }else{
        const d=$('gsDate').value,a=$('gsStart').value,b=$('gsEnd').value;
        if(!d||!a||!b||a>=b)throw new Error('Preenche a data e um período com fim posterior ao início.');
        const ids=selectedIds();if(!ids.length)throw new Error('Seleciona pelo menos uma clínica.');
        if(ids.some(id=>(new Date(d+'T'+b)-new Date(d+'T'+a))/60000<durations[id]))throw new Error('O período deve permitir pelo menos uma consulta.');
        const existing=await window.sb.from('dias_consulta_avulsos').select('id,clinic_id,hora_inicio,hora_fim').in('clinic_id',ids).eq('data',d);if(existing.error)throw existing.error;
        if((existing.data||[]).some(r=>r.hora_inicio.slice(0,5)<b&&r.hora_fim.slice(0,5)>a))throw new Error('Já existe disponibilidade sobreposta neste dia. Consulta os períodos existentes.');
        const user=await window.sb.auth.getUser();if(user.error)throw user.error;
        const result=await window.sb.from('dias_consulta_avulsos').insert(ids.map(id=>({clinic_id:id,data:d,hora_inicio:a,hora_fim:b,duracao_min:durations[id],criado_por:user.data?.user?.id||null})));if(result.error)throw result.error;
      }
      const savedDay=block?$('gsFrom').value:$('gsDate').value;
      busy=false;close();await onSaved({day:savedDay,clinicId,clinicIds:selectedIds(),kind});
    }catch(e){if(ov.isConnected)fail(e);else alert('Guardado, mas não foi possível atualizar a Agenda. Atualiza a página.');}
    finally{if(ov.isConnected)setBusy(false);}
  };
  ov.addEventListener('keydown',e=>{if(e.key!=='Tab')return;const els=[...ov.querySelectorAll('button,input,select,textarea')].filter(el=>!el.disabled&&el.getClientRects().length);if(e.shiftKey&&document.activeElement===els[0]){e.preventDefault();els.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===els.at(-1)){e.preventDefault();els[0]?.focus();}});
  $('gsFrom')?.focus();$('gsDate')?.focus();
}
