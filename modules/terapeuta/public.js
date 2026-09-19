import {catalog,escapeHtml as e,renderFields,readFields,validateFields,total,interpretation} from './forms.js';
const root=document.getElementById('app');
const params=new URLSearchParams(location.search);
const preview=params.get('preview');
const direct=params.get('direct')==='1';
const token=new URLSearchParams(location.hash.slice(1)).get('t')||'';
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
let context, index=-1, answers={}, respondent={}, revision=0, dirty=false, busy=false;
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
const message=text=>{root.innerHTML='<section class="panel"><h1>'+e(text)+'</h1></section>';};
async function rpc(name,args){const result=await window.sb.rpc(name,args);if(result.error)throw new Error(result.error.message||'Erro de ligação');return result.data;}
async function init(){
  try {
    if(preview){ const definitions=(await catalog()).filter(s=>preview.split(',').includes(s.id));if(!definitions.length)throw new Error('Escala desconhecida');context={definitions,instructions:'Pré-visualização. Podes experimentar; não serão enviados dados.'};index=0; }
    else {
      if(!/^[a-f0-9]{64}$/.test(token)){message('Este link não é válido.');return;}
      context=await rpc('therapist_scale_context',{p_token:token});
      if(context.status!=='pending'){message(context.status==='completed'?'Avaliação já enviada. Obrigado.':'Este link expirou, foi cancelado ou não é válido.');return;}
      answers=context.answers||{};respondent=context.respondent||{};respondent.date ||= today();revision=context.revision;
    }
    render();
  }catch{message('Não foi possível abrir a avaliação. Verifica a ligação e volta a abrir o link.');}
}
function capture(){
 if(index<0){respondent.name=root.querySelector('#meta_name').value;respondent.date=root.querySelector('#meta_date').value;const role=root.querySelector('[name=profession]:checked')?.value;respondent.profession=role==='Outro'?'Outro: '+root.querySelector('#meta_other').value.trim():(role||'');respondent.attested=root.querySelector('#attested').checked;return;}

 const scale=context.definitions[index];
 const status=root.querySelector('[name=status]:checked')?.value;
 answers[scale.id]={status,reason:root.querySelector('#reason').value,notes:root.querySelector('#notes').value,values:readFields(root.querySelector('#fields'),scale.fields)};
 if(status==='not_done')answers[scale.id].values={};
}
function validateCurrent(){
 if(index<0){if(!respondent.name?.trim()||!respondent.profession?.trim()||!respondent.date||!respondent.attested)return 'Preenche nome, função, data e confirmação.';if(respondent.profession==='Outro: ')return 'Indica a função de quem preenche.';if(respondent.date>today())return 'A data da avaliação não pode ser futura.';return '';}
 const a=answers[context.definitions[index].id];
 if(!a.status)return 'Indica se a avaliação foi realizada.';
 if(a.status==='not_done')return a.reason.trim()?'':'Indica o motivo de não realização.';
 return validateFields(context.definitions[index].fields,a.values,true);
}
async function save(complete=false){
 if(preview){dirty=false;return;}
 const result=await rpc('therapist_scale_save',{p_token:token,p_revision:revision,p_answers:answers,p_respondent:respondent,p_complete:complete});revision=result.revision;dirty=false;
}
window.saveDirectDraft=async()=>{if(!root.querySelector('#next'))return true;if(busy)return false;try{capture();await save();return true;}catch{root.querySelector('#error').textContent='Não foi possível guardar. Tenta novamente antes de fechar.';return false;}};
function render(){
 const scale=context.definitions[index];
 root.innerHTML=`<header><strong>Gestão Clínica</strong><span>${preview?'Pré-visualização':e(context.reference)}</span></header><section class="panel"><p>${e(context.instructions||'')}</p>${index<0?`<h1>Quem preenche</h1><div class="identity-grid"><label class="field">Nome<input id="meta_name" maxlength="160" value="${e(respondent.name||'')}"></label><label class="field">Data<input id="meta_date" type="date" max="${today()}" value="${e(respondent.date||today())}"></label></div><fieldset class="choices"><legend>Função</legend>${['Médico','Fisioterapeuta','Outro'].map(role=>`<label><input type="radio" name="profession" value="${role}" ${(role==='Outro'?respondent.profession&&!['Médico','Fisioterapeuta'].includes(respondent.profession):respondent.profession===role)?'checked':''}>${role}</label>`).join('')}</fieldset><label class="field" id="other-wrap">Qual? <input id="meta_other" maxlength="150" placeholder="Cuidador, filha…" value="${e((respondent.profession||'').replace(/^Outro: /,''))}"></label><label class="attest"><input type="checkbox" id="attested" ${respondent.attested?'checked':''}> Confirmo a identificação e os dados registados.</label>`:`<p>Avaliação ${index+1} de ${context.definitions.length}</p><h1>${e(scale.title)}</h1><p class="scale-domain">${e(scale.domain||'')} · ${e(scale.direction||'')}</p><details class="protocol"><summary>Instruções e protocolo</summary><p>${e(scale.description)}</p><a href="${e(scale.source)}" target="_blank" rel="noopener noreferrer">Consultar protocolo e critérios de pontuação ↗</a></details><fieldset class="choices status"><legend>Realização</legend><label><input type="radio" name="status" value="done" ${answers[scale.id]?.status==='done'?'checked':''}><span>Realizado</span></label><label><input type="radio" name="status" value="not_done" ${answers[scale.id]?.status==='not_done'?'checked':''}><span>Não realizado</span></label></fieldset><label class="field" id="reason-wrap">Motivo<input id="reason" maxlength="500" value="${e(answers[scale.id]?.reason||'')}"></label><div id="fields"></div><p id="total" aria-live="polite"></p><label class="field">Observações<textarea id="notes" maxlength="1000">${e(answers[scale.id]?.notes||'')}</textarea></label>`}<p id="error" role="alert"></p><nav><button id="back" ${index<=(preview?0:-1)?'disabled':''}>Anterior</button><button id="save">${preview?'Pré-visualização — sem envio':'Guardar e continuar depois'}</button><button class="primary" id="next">${index===context.definitions.length-1?(preview?'Terminar pré-visualização':(direct?'Guardar avaliações na consulta':'Enviar avaliações')):(index<0?'Guardar e seguir':'Continuar')}</button></nav><p id="saved" aria-live="polite"></p></section>`;
 if(scale)renderFields(root.querySelector('#fields'),scale.fields,answers[scale.id]?.values||{});
 function update(){if(!scale){root.querySelector('#other-wrap').hidden=root.querySelector('[name=profession]:checked')?.value!=='Outro';return;} const notDone=root.querySelector('[name=status]:checked')?.value==='not_done';root.querySelector('#fields').hidden=notDone;root.querySelector('#reason-wrap').hidden=!notDone;const a={status:root.querySelector('[name=status]:checked')?.value,values:readFields(root.querySelector('#fields'),scale.fields)};const score=total(scale,a);root.querySelector('#total').textContent=interpretation(scale,a);}
 update();root.querySelector('.panel').addEventListener('input',()=>{dirty=true;update();});
 async function action(kind){if(busy)return;busy=true;root.querySelectorAll('nav button').forEach(b=>b.disabled=true);root.querySelector('#error').textContent='';
 try{capture();if(kind==='next'){const error=validateCurrent();if(error)throw new Error(error);}
 const finish=kind==='next'&&index===context.definitions.length-1;
 if(finish&&!preview){for(const s of context.definitions){const a=answers[s.id];if(!a||!['done','not_done'].includes(a.status)||a.status==='done'&&validateFields(s.fields,a.values,true)||a.status==='not_done'&&!a.reason?.trim())throw new Error('Existem avaliações incompletas. Volta atrás para as concluir.');}}
 await save(finish);
 if(finish){message(preview?'Fim da pré-visualização — nenhum dado enviado.':(direct?'Avaliações guardadas na consulta. Podes fechar este formulário.':'Avaliações enviadas ao médico. Obrigado.'));return;}
 if(kind==='save'){root.querySelector('#saved').textContent=preview?'Pré-visualização: nenhum dado enviado.':'Respostas guardadas. Podes voltar a abrir este link.';return;}
 index+=kind==='back'?-1:1;render();window.scrollTo(0,0);
 }catch(error){root.querySelector('#error').textContent=/revision_conflict/.test(error.message)?'Este pedido foi alterado noutro dispositivo. Copia as tuas observações e reabre o link para recuperar a versão guardada.':'Não foi possível avançar: '+error.message;}
 finally{busy=false;root.querySelectorAll('nav button').forEach(b=>b.disabled=false);if(root.querySelector('#back'))root.querySelector('#back').disabled=index<=(preview?0:-1);}}
 root.querySelector('#next').onclick=()=>action('next');root.querySelector('#back').onclick=()=>action('back');root.querySelector('#save').onclick=()=>action('save');
}
init();
