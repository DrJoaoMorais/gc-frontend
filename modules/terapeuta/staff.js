import {escapeHtml as e,resultHtml} from './forms.js';
export function wireTherapistRequests(root) {
  let pending=null;
  const controls=document.createElement('section');
  controls.className='sec';
  controls.innerHTML=`<h3>Preencher ou pedir avaliações</h3><p>Um único link inclui todas as escalas selecionadas. Válido durante 7 dias; pode ser cancelado abaixo.</p><label for="therapist-reference">Médico responsável / referência</label><input id="therapist-reference" maxlength="120" type="text"><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button type="button" id="therapist-direct" class="btn-copy">Preencher agora</button><button type="button" id="therapist-create" class="btn-copy">Criar link das escalas selecionadas</button><button type="button" id="therapist-refresh" class="btn-pdf">Atualizar respostas</button></div><p id="therapist-message" role="status"></p><div id="therapist-link" hidden><label for="therapist-url">Link criado</label><input id="therapist-url" readonly><button type="button" id="therapist-copy" class="btn-pdf">Copiar link</button><a id="therapist-open" target="_blank" rel="noopener noreferrer">Abrir formulário ↗</a></div><div id="therapist-requests"></div>`;
  root.appendChild(controls);
  const byId=id=>controls.querySelector('#'+id);
  byId('therapist-reference').value='João Morais';
  const status=text=>{byId('therapist-message').textContent=text;};
  const sb=()=>window.sb||(window.opener&&window.opener.sb);
  async function rpc(name,args){const client=sb();if(!client?.rpc)throw new Error('Ligação indisponível.');const result=await client.rpc(name,args);if(result.error){if(result.error.code==='PGRST202')throw new Error('A criação e receção de links ainda precisam de ser publicadas. Já podes consultar as escalas em «Ver escala».');throw new Error('Não foi possível concluir. Os dados continuam disponíveis; tenta novamente.');}return result.data;}
  root.querySelectorAll('[data-ver-escala]').forEach(button=>button.onclick=()=>{
    const dialog=document.createElement('dialog');dialog.style.cssText='width:min(900px,96vw);height:90vh;border:1px solid #cbd5e1;border-radius:12px;padding:12px';
    const close=document.createElement('button');close.textContent='Fechar';close.className='btn-pdf';close.onclick=()=>dialog.close();
    const frame=document.createElement('iframe');frame.title='Pré-visualização da escala';frame.style.cssText='display:block;width:100%;height:calc(100% - 48px);border:0;margin-top:8px';
    frame.src='/avaliacao-terapeuta.html?preview='+encodeURIComponent(button.dataset.verEscala);
    dialog.append(close,frame);document.body.appendChild(dialog);dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();
  });
  async function refresh(){
    if(!window._examCtx?.consultationId)return;
    const requests=await rpc('therapist_scale_list',{p_consultation:window._examCtx.consultationId});
    byId('therapist-requests').innerHTML=(requests||[]).map(r=>`<article style="border-top:1px solid #e2e8f0;margin-top:16px;padding-top:12px"><strong>${e(r.reference)}</strong> — ${e(({pending:'Aguarda resposta',completed:'Recebido — por rever',revoked:'Cancelado',expired:'Expirado'})[r.status]||r.status)}<p>${(r.definitions||[]).map(s=>e(s.title)).join(' · ')} · Limite: ${e(new Date(r.expires_at).toLocaleDateString('pt-PT'))}</p>${r.status==='pending'?`<button type="button" class="btn-pdf" data-revoke="${e(r.id)}">Cancelar este link</button>`:''}${r.status==='completed'?`<details><summary>Ver respostas da avaliação</summary>${resultHtml(r)}</details>`:''}</article>`).join('');
    controls.querySelectorAll('[data-revoke]').forEach(button=>button.onclick=async()=>{button.disabled=true;try{await rpc('therapist_scale_revoke',{p_id:button.dataset.revoke});status('Link cancelado.');await refresh();}catch(error){status(error.message);button.disabled=false;}});
  }
  async function createRequest(direct=false){
    const button=byId(direct?'therapist-direct':'therapist-create');byId('therapist-direct').disabled=true;byId('therapist-create').disabled=true;
    try{
      const ctx=window._examCtx;
      if(!ctx?.consultationId)throw new Error('Abre o exame a partir de uma consulta gravada para criar um link.');
      const data=window._gerarData();const selected=data.pedidos_avaliacao?.ids||[];
      if(!selected.length)throw new Error('Seleciona pelo menos uma escala.');
      const reference=byId('therapist-reference').value.trim();if(!reference)throw new Error('Preenche a referência para o terapeuta.');
      status('A guardar o exame e a criar o link…');
      if(await window._saveExamToSupabase(window._gerarResumo(),data)!==true)throw new Error('Não foi possível guardar o exame. Nenhum link foi criado.');
      const signature=JSON.stringify([ctx.assessmentId,selected,data.pedidos_avaliacao.notas,reference,direct]);
      if(!pending||pending.signature!==signature)pending={signature,id:crypto.randomUUID(),token:Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('')};
      await rpc('therapist_scale_create',{p_assessment:ctx.assessmentId,p_ids:selected,p_instructions:data.pedidos_avaliacao.notas||'',p_reference:reference,p_token:pending.token,p_request_id:pending.id});
      const link=new URL('/avaliacao-terapeuta.html',location.origin);if(direct)link.searchParams.set('direct','1');link.hash=new URLSearchParams({t:pending.token}).toString();
      byId('therapist-url').value=link.href;byId('therapist-open').href=link.href;byId('therapist-link').hidden=false;
      pending=null;status(direct?'Avaliação criada. Preenche e guarda; as respostas ficam nesta consulta. O link permite retomar o preenchimento.':'Link criado. Copia-o para enviar ao terapeuta.');
      if(direct){
        const dialog=document.createElement('dialog');dialog.style.cssText='width:min(1000px,96vw);height:94vh;border:1px solid #cbd5e1;border-radius:12px;padding:12px';
        const close=document.createElement('button');close.textContent='Guardar e fechar';close.className='btn-pdf';
        const frame=document.createElement('iframe');frame.title='Preencher avaliações agora';frame.style.cssText='display:block;width:100%;height:calc(100% - 48px);border:0;margin-top:8px';frame.src=link.href;
        close.onclick=async()=>{close.disabled=true;try{if(await frame.contentWindow.saveDirectDraft?.()===false)return;dialog.close();}catch{status('Não foi possível guardar. Mantém o formulário aberto e tenta novamente.');}finally{close.disabled=false;}};
        dialog.addEventListener('cancel',event=>{event.preventDefault();close.click();});
        dialog.addEventListener('close',()=>{dialog.remove();refresh().catch(error=>status(error.message));});dialog.append(close,frame);document.body.appendChild(dialog);dialog.showModal();
      }
      await refresh();
    }catch(error){status(error.message);}finally{byId('therapist-direct').disabled=false;byId('therapist-create').disabled=false;}
  }
  byId('therapist-create').onclick=()=>createRequest(false);
  byId('therapist-direct').onclick=()=>createRequest(true);
  byId('therapist-copy').onclick=async()=>{try{await navigator.clipboard.writeText(byId('therapist-url').value);status('Link copiado.');}catch{byId('therapist-url').select();status('Seleciona e copia o link apresentado.');}};
  byId('therapist-refresh').onclick=()=>refresh().catch(error=>status(error.message));
  refresh().catch(error=>status(error.message));
}
