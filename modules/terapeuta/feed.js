import {escapeHtml as e,resultHtml} from './forms.js';
// Read only: the authenticated RPC restricts requests to their author and clinic.
export function mountFunctionalResults(root,sb,{intervalMs=60000}={}) {
 root._functionalCleanup?.();
 let stopped=false,loading=false;
 const nodes=[...root.querySelectorAll('[data-functional-results]')];
 for(const node of nodes){node.innerHTML='<h4>Avaliações funcionais</h4><button type="button" data-refresh>Atualizar resultados</button><div data-results aria-live="polite">A consultar avaliações…</div>';node.querySelector('button').onclick=()=>refresh();}
 async function refresh(){
  if(stopped||loading||!root.isConnected||document.hidden)return;
  loading=true;
  try{await Promise.all(nodes.map(async node=>{
   const target=node.querySelector('[data-results]');
   try{
    const {data,error}=await sb.rpc('therapist_scale_list',{p_consultation:node.dataset.functionalResults});
    if(stopped||!node.isConnected)return;
    if(error)throw error;
    const rows=data||[];
    const html=rows.map(r=>{
     const titles=(r.definitions||[]).map(s=>s.title).join(' · ');
     if(r.status!=='completed')return `<p>${e(titles)} — ${e(({pending:'Aguarda preenchimento',expired:'Pedido expirado',revoked:'Pedido cancelado'})[r.status]||r.status)}</p>`;
     const totals=(r.definitions||[]).map(s=>{const a=r.answers?.[s.id];if(a?.status==='not_done')return s.title+': não realizado';const t=r.results?.[s.id]?.total;return s.title+(t!=null?': '+t+'/'+s.maxScore:s.id==='tug'&&a?.values?.tempo!=null?': '+a.values.tempo+' s':'');}).join(' · ');
     return `<article style="border-top:1px solid #dce5ee;padding:10px 0"><strong>${e(totals)}</strong><p>${e(r.respondent?.name)} · ${e(r.respondent?.profession)} · Avaliação: ${e(r.respondent?.date)}<br>Recebido: ${e(r.completed_at?new Date(r.completed_at).toLocaleString('pt-PT'):'')} — por rever</p><details data-response="${e(r.id)}"><summary>Ver respostas e interpretação</summary>${resultHtml(r)}</details></article>`;
    }).join('')||'<p>Sem pedidos de avaliação nesta consulta.</p>';
    if(target.dataset.content!==html){const open=new Set([...target.querySelectorAll('details[open]')].map(d=>d.dataset.response));target.innerHTML=html;target.dataset.content=html;target.querySelectorAll('details').forEach(d=>{d.open=open.has(d.dataset.response);});}
   }catch{if(!stopped&&node.isConnected)target.textContent='Não foi possível atualizar os resultados. Tenta novamente.';}
  }));}finally{loading=false;}
 }
 const onFocus=()=>refresh();
 window.addEventListener('focus',onFocus);document.addEventListener('visibilitychange',onFocus);
 const timer=setInterval(()=>{if(!root.isConnected){cleanup();return;}refresh();},intervalMs);
 function cleanup(){stopped=true;clearInterval(timer);window.removeEventListener('focus',onFocus);document.removeEventListener('visibilitychange',onFocus);}
 root._functionalCleanup=cleanup;refresh();return cleanup;
}
