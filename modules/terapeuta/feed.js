import {escapeHtml as e,resultSummaryHtml} from './forms.js';
// Read only: the authenticated RPC restricts requests to their author and clinic.
export function mountFunctionalResults(root,sb,{intervalMs=60000}={}) {
 root._functionalCleanup?.();
 let stopped=false,loading=false;
 const nodes=[...root.querySelectorAll('[data-functional-results]')];
 for(const node of nodes){node.innerHTML='<h4>Avaliações realizadas</h4><div data-results aria-live="polite"></div>';node.hidden=true;}
 async function refresh(){
  if(stopped||loading||!root.isConnected||document.hidden)return;
  loading=true;
  try{await Promise.all(nodes.map(async node=>{
   const target=node.querySelector('[data-results]');
   try{
    const {data,error}=await sb.rpc('therapist_scale_list',{p_consultation:node.dataset.functionalResults});
    if(stopped||!node.isConnected)return;
    if(error)throw error;
    const rows=(data||[]).filter(r=>r.status==='completed');
    const html=rows.map(resultSummaryHtml).join('');
    node.hidden=!html;
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
