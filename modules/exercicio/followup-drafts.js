export function canLeaveFollowup(root=document.getElementById('gcExerciseHome')) {
  const form=root?.querySelector('form:not([data-saved])');
  const note=form?.querySelector('[name=reason]');
  if(!note?.value.trim())return true;
  if(!window.confirm('Há uma nota de acompanhamento por guardar. Descartar essa nota?'))return false;
  form.dataset.saved='discarded';return true;
}
export function installFollowupDraftGuard(root) {
  root._followupGuard?.abort();
  const controller=new AbortController();root._followupGuard=controller;
  const values=new WeakMap();
  root.onfocusin=e=>{if(e.target.matches('input,select'))values.set(e.target,e.target.value);};
  root.addEventListener('click',e=>{
    const button=e.target.closest('button');if(!button||button.type==='submit'||button.closest('form')&&!button.hasAttribute('data-close-editor')&&!button.hasAttribute('data-inspect'))return;
    if(!canLeaveFollowup(root)){e.preventDefault();e.stopImmediatePropagation();}
  },{capture:true,signal:controller.signal});
  for(const event of ['change','input'])root.addEventListener(event,e=>{
    if(!e.target.matches('[data-clinical-search],[data-clinical-clinic],[data-clinical-episode],[data-clinical-days],[data-clinical-need],[data-clinical-context]'))return;
    if(!canLeaveFollowup(root)){e.target.value=values.get(e.target)||'';e.stopImmediatePropagation();}
    else values.set(e.target,e.target.value);
  },{capture:true,signal:controller.signal});
}
