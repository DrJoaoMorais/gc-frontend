export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function catalog() {
  const response = await fetch(new URL('./catalogo.json', import.meta.url));
  if (!response.ok) throw new Error('Não foi possível abrir as escalas.');
  return response.json();
}
export function validateFields(fields, values = {}, complete = false) {
  for (const field of fields) {
    const value = values[field.id];
    if (value == null || value === '') { if (complete && field.required) return 'Preenche: ' + field.label; continue; }
    if (field.type === 'repeat') {
      if (!Array.isArray(value) || value.length > field.maxItems || (complete && !value.length)) return 'Verifica: ' + field.label;
      for (const row of value) { const error = validateFields(field.fields, row, complete); if (error) return error; }
    } else if (field.type === 'text') {
      if (typeof value !== 'string' || value.length > field.maxLength || (complete && field.required && !value.trim())) return 'Verifica: ' + field.label;
    } else if (field.type === 'choice') {
      if (!field.values.includes(value)) return 'Verifica: ' + field.label;
    } else if (field.type === 'number') {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < field.min || value > field.max || (field.step === 1 && !Number.isInteger(value))) return 'Verifica: ' + field.label;
    }
  }
  return '';
}
export function total(scale, answer) {
  if (!scale.maxScore || answer?.status !== 'done' || validateFields(scale.fields, answer.values, true)) return null;
  return scale.fields.filter(f => f.score).reduce((sum, f) => sum + Number(answer.values[f.id]), 0);
}
function fieldHtml(field, value, prefix) {
  const key = prefix + field.id;
  const label = escapeHtml(field.label);
  if (field.type === 'repeat') {
    const rows = Array.isArray(value) && value.length ? value : [{}];
    return `<fieldset data-repeat="${field.id}"><legend>${label}</legend>${rows.map((row, i) => `<div class="repeat-row" data-row>${field.fields.map(f => fieldHtml(f, row[f.id], key + i + '_')).join('')}<button type="button" data-remove>Remover grupo</button></div>`).join('')}<button type="button" data-add>Adicionar grupo muscular</button></fieldset>`;
  }
  if (field.type === 'choice' || (field.type === 'number' && (field.score || field.buttons))) {
    const values = field.values || Array.from({length:field.max-field.min+1}, (_,i) => i+field.min);
    return `<fieldset class="field ${field.compactLabels?'with-criteria':''}" data-field="${field.id}"><legend>${label}</legend><div class="choices">${values.map((v,i) => `<label><input type="radio" name="${key}" value="${i}" data-criterion="${escapeHtml(field.labels?.[v]||'')}" ${v===value?'checked':''}><span><b>${escapeHtml(field.displayValues?.[v] ?? v)}</b>${field.labels&&!field.compactLabels?` · ${escapeHtml(field.labels[v])}`:''}</span></label>`).join('')}</div>${field.labels&&field.compactLabels?`<p class="selected-criterion">${escapeHtml(field.labels[value]||'Escolhe a pontuação')}</p><div class="criteria" aria-label="Critérios">${values.map(v=>`<div>${escapeHtml(v)} — ${escapeHtml(field.labels[v])}</div>`).join('')}</div>`:''}</fieldset>`;
  }
  if(field.type==='text'&&field.suggestions?.length) return `<div class="field muscle-picker"><div>${label}</div><div class="choices muscle-options">${field.suggestions.map(v=>`<button type="button" data-muscle="${escapeHtml(v)}" aria-pressed="${v===value}">${escapeHtml(v)}</button>`).join('')}</div><label class="custom-muscle">Movimento escolhido / outro<input data-field="${field.id}" maxlength="${field.maxLength}" value="${escapeHtml(value)}"></label></div>`;
  return `<label class="field">${label}<input data-field="${field.id}" type="${field.type==='number'?'number':'text'}" ${field.type==='number'?`min="${field.min}" max="${field.max}" step="${field.step}" inputmode="decimal"`:`maxlength="${field.maxLength}"`} value="${escapeHtml(value)}"></label>`;
}
export function renderFields(root, fields, values = {}, prefix='f_') {
  const groups=[...new Set(fields.map(f=>f.optionalGroup).filter(Boolean))];
  root.innerHTML = fields.filter(f=>!f.optionalGroup).map(f => fieldHtml(f,values[f.id],prefix)).join('')+groups.map(g=>`<details><summary>${escapeHtml(g)} (opcional)</summary>${fields.filter(f=>f.optionalGroup===g).map(f=>fieldHtml(f,values[f.id],prefix)).join('')}</details>`).join('');
  // Presentation only: retain the original field IDs and all stored answers.
  if(['equilibrio','marcha','cadeira','percurso'].every(id=>fields.some(f=>f.id===id))) {
    const used=new Set();
    const field=(id,overrides={})=>{const f=fields.find(f=>f.id===id);if(!f)return '';used.add(id);return fieldHtml({...f,...overrides},values[id],prefix);};
    root.innerHTML=`<section class="sppb-component" data-component="equilibrio"><h2>1. Equilíbrio</h2>${field('equilibrio')}<p class="measurement-note">Os tempos de manutenção de cada posição estão indicados nos critérios ao lado.</p></section>
    <section class="sppb-component" data-component="marcha"><h2>2. Marcha</h2><div class="measurement-row">${field('percurso',{label:'Percurso',displayValues:{3:'3 metros',4:'4 metros'}})}${field('tempo_marcha_1',{label:'Tentativa 1 — segundos'})}${field('tempo_marcha_2',{label:'Tentativa 2 — segundos'})}</div><p class="measurement-note">Regista os tempos; usa a tentativa mais rápida para escolher a pontuação do percurso realizado.</p>${field('marcha')}</section>
    <section class="sppb-component" data-component="cadeira"><h2>3. Levantar da cadeira</h2>${field('tempo_cadeira',{label:'Tempo dos 5 levantamentos — segundos'})}${field('cadeira')}</section>
    ${fields.filter(f=>!used.has(f.id)).map(f=>f.id==='medicoes'?`<details ${values[f.id]?'open':''}><summary>Outras condições do teste (opcional)</summary>${fieldHtml({...f,label:'Ex.: auxiliar de marcha utilizado ou motivo de interrupção'},values[f.id],prefix)}</details>`:fieldHtml(f,values[f.id],prefix)).join('')}`;
  }
  root.onclick=event=>{const button=event.target.closest('[data-muscle]');if(!button)return;const wrap=button.closest('.muscle-picker');const input=wrap.querySelector('input');input.value=button.dataset.muscle;input.dispatchEvent(new Event('input',{bubbles:true}));};
  root.oninput=event=>{const wrap=event.target.closest('.muscle-picker');if(!wrap)return;const value=wrap.querySelector('input').value;wrap.querySelectorAll('[data-muscle]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.muscle===value)));};
  root.onchange=event=>{const wrap=event.target.closest('[data-field]');const text=wrap?.querySelector('.selected-criterion');if(text)text.textContent=event.target.dataset.criterion||'Escolhe a pontuação';};
  for (const field of fields.filter(f=>f.type==='repeat')) {
    const wrap=root.querySelector(`[data-repeat="${field.id}"]`);
    wrap.addEventListener('click', event => {
      if (!event.target.matches('[data-add], [data-remove]')) return;
      const current=readFields(root,fields);
      const rows=current[field.id];
      if(event.target.matches('[data-add]') && rows.length<field.maxItems) rows.push({});
      if(event.target.matches('[data-remove]')) rows.splice(Array.from(wrap.querySelectorAll('[data-row]')).indexOf(event.target.closest('[data-row]')),1);
      renderFields(root,fields,current,prefix);
      root.dispatchEvent(new Event('input',{bubbles:true}));
    });
  }
}
export function readFields(root,fields) {
  const values={};
  for(const field of fields) {
    if(field.type==='repeat') { values[field.id]=Array.from(root.querySelector(`[data-repeat="${field.id}"]`).querySelectorAll('[data-row]')).map(row=>readFields(row,field.fields)); continue; }
    const el=root.querySelector(`[data-field="${field.id}"]`);
    if(field.type==='choice'||(field.type==='number'&&(field.score||field.buttons))) {
      const selected=el.querySelector('input:checked');
      const options=field.values||Array.from({length:field.max-field.min+1},(_,i)=>i+field.min);
      if(selected) values[field.id]=options[Number(selected.value)];
    } else if(el.value!=='') values[field.id]=field.type==='number'?Number(el.value):el.value;
  }
  return values;
}
export function interpretation(scale, answer) {
 if(answer?.status!=='done')return '';
 if(validateFields(scale.fields,answer.values,true))return 'Avaliação incompleta — sem conclusão.';
 const v=answer.values, score=total(scale,answer);
 if(scale.id==='barthel')return `${score}/100 — autonomia nas atividades básicas da vida diária. ${score===100?'Pontuação máxima nas atividades avaliadas; não exclui outras limitações.':'Os itens abaixo da pontuação máxima identificam as atividades com dependência.'} Não é uma medida de risco de queda.`;
 if(scale.id==='tug') {const standard=v.contexto==='Idoso (≥65 anos)'&&v.protocolo==='Protocolo habitual — 3 m'&&['Sem ajuda','Supervisão'].includes(v.ajuda)&&v.paredes!=='Sim';return `${v.tempo} s — mobilidade funcional. ${standard?(v.tempo>=12?'Atinge o limiar CDC de 12 s para sinalizar risco de queda aumentado em idosos.':'Abaixo do limiar CDC de 12 s; este resultado isolado não exclui risco de queda.'):'Sem classificação automática de risco: considerar idade, protocolo, auxiliar e ajuda física.'}`;}
 if(scale.id==='sppb')return `${score}/12 — desempenho físico dos membros inferiores. Maior pontuação corresponde a melhor desempenho; interpretar os componentes de equilíbrio, marcha e levantar da cadeira.`;
 if(scale.id==='tinetti')return `${score}/28 — desempenho no equilíbrio e na marcha. Maior pontuação corresponde a melhor desempenho. A classificação de risco de queda depende da população e do contexto clínico.`;
 if(scale.id==='berg')return `${score}/56 — equilíbrio durante tarefas funcionais. Maior pontuação corresponde a melhor desempenho; a pontuação máxima não exclui risco de queda.`;
 return scale.direction||'Resultados por item; sem pontuação global.';
}
export function resultHtml(request) {
  const e=escapeHtml, meta=request.respondent || {}, responses=request.answers || {};
  return `<article class="therapist-result"><h3>Avaliações realizadas</h3><p>${e(meta.name)} · ${e(meta.profession)} · ${e(meta.date)}</p>${(request.definitions||[]).map(scale=>{
    const a=responses[scale.id]; if(!a)return '';
    if(a.status==='not_done')return `<h4>${e(scale.title)}</h4><p>Não realizado: ${e(a.reason)}</p>`;
    function lines(fields,vals) { return fields.map(f=>{
      const v=vals?.[f.id]; if(v==null||v==='')return '';
      if(f.type==='repeat') return (Array.isArray(v)?v:[]).map(row=>'<li>'+f.fields.map(sf=>e(sf.label)+': '+e(row[sf.id])).join(' · ')+'</li>').join('');
      return '<li>'+e(f.label)+': '+e(v)+(f.labels?.[v]?' — '+e(f.labels[v]):'')+'</li>';
    }).join(''); }
    const score=request.results?.[scale.id]?.total;
    const groups=request.results?.[scale.id]?.groups||{};
    const groupText=Object.keys(groups).map(k=>e(k)+': '+e(groups[k])).join(' · ');
    return `<h4>${e(scale.title)}${score!=null?' — '+e(score)+'/'+e(scale.maxScore):''}</h4>${groupText?'<p>'+groupText+'</p>':''}<p>${e(interpretation(scale,a))}</p><ul>${lines(scale.fields,a.values)}</ul>${a.notes?'<p>'+e(a.notes)+'</p>':''}`;
  }).join('')}</article>`;
}

export function resultSummaryHtml(request) {
 const e=escapeHtml,meta=request.respondent||{};
 const rows=(request.definitions||[]).filter(s=>request.answers?.[s.id]?.status==='done').map(s=>{
  const a=request.answers[s.id],score=request.results?.[s.id]?.total;
  let value=score!=null?`${score}/${s.maxScore}`:s.id==='tug'?`${a.values?.tempo} s`:s.fields.map(f=>{
   const v=a.values?.[f.id];if(v==null||v==='')return '';
   if(f.type==='repeat')return v.map(row=>f.fields.map(sf=>row[sf.id]).filter(x=>x!=null).join(' · ')).join('; ');
   return `${f.label}: ${v}`;
  }).filter(Boolean).join('; ');
  return `<li>${e(s.title.replace(/ — 0[–-]\d+/,''))}: <strong>${e(value)}</strong></li>`;
 });
 return rows.length?`<article class="evaluation-summary"><p>${e(meta.name)} · ${e(meta.profession)} · ${e(meta.date)}</p><ul>${rows.join('')}</ul></article>`:'';
}
