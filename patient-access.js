/* Device credential travels in a request header, never in a query string. */
(()=>{
 const cookie='__Host-gc_portal_device',storageKey='gc_patient_device';
 const fragment=new URLSearchParams(location.hash.slice(1)),incoming=fragment.get('gc-device');
 if(incoming&&/^[a-f0-9]{64}$/.test(incoming)){try{sessionStorage.setItem(storageKey,incoming)}catch(_){}fragment.delete('gc-device');history.replaceState(null,'',location.pathname+location.search+(fragment.toString()?'#'+fragment:''));}
 function secret(){const raw=document.cookie.split('; ').find(v=>v.startsWith(cookie+'='))?.slice(cookie.length+1);if(raw){try{return decodeURIComponent(raw)}catch(_){return ''}}try{return sessionStorage.getItem(storageKey)||''}catch(_){return ''}}
 window.gcPatientAccess={secret,exerciseUrl(url){const parsed=new URL(url,location.href);if(parsed.origin==='https://treino.joaomorais.pt'&&secret())parsed.hash=new URLSearchParams({'gc-device':secret()}).toString();return parsed.href}};
 const create=window.supabase.createClient.bind(window.supabase);
 window.supabase.createClient=function(url,key,options={}){
  const nativeFetch=options.global?.fetch||window.fetch.bind(window);
  const securedFetch=async(input,init={})=>{
   const headers=new Headers(init.headers||{});const credential=secret();if(credential)headers.set('x-gc-device-secret',credential);
   const response=await nativeFetch(input,{...init,headers});
   const address=String(input instanceof Request?input.url:input);
   // Only content reads trigger routing to the portal. Mutations are never retried.
   if(response.status===403&&/\/rpc\/(wo_get_plan|intake_get_context|get_diary_episode)(?:\?|$)/.test(address)){
    try{const body=JSON.parse(init.body||'{}'),kind=address.includes('wo_get_plan')?'exercise':address.includes('intake_get_context')?'question':'diary';const resolution=await nativeFetch(url+'/rest/v1/rpc/gc_patient_entry',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({p_kind:kind,p_token:body.p_token})});const data=await resolution.json();if(data.available&&data.portal_token){const target=new URL('https://gc.joaomorais.pt/acompanhamento');target.searchParams.set('t',data.portal_token);target.searchParams.set('open',data.open);location.replace(target.href)}}catch(_){}
   }
   return response;
  };
  return create(url,key,{...options,global:{...options.global,fetch:securedFetch}});
 };
})();
