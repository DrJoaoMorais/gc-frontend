const assert=require('node:assert/strict');
(async()=>{
 const {clinicalResultHtml}=await import('../forms.js');const cat=require('../catalogo.json');
 const barthel=cat.find(s=>s.id==='barthel'),tug=cat.find(s=>s.id==='tug');
 const values=Object.fromEntries(barthel.fields.map(f=>[f.id,f.values.at(-1)]));
 const req={status:'completed',respondent:{name:'Autor <teste>',profession:'Médico',date:'2026-09-19'},definitions:[barthel,tug],answers:{barthel:{status:'done',values},tug:{status:'not_done',reason:'não indicado'}},results:{barthel:{total:100}}};
 const html=clinicalResultHtml(req);assert.match(html,/100\/100/);assert.match(html,/autonomia/);assert.match(html,/Alimentação: 10 — Independente/);assert.match(html,/Escadas: 10 — Independente/);assert.match(html,/Autor &lt;teste&gt;/);assert.doesNotMatch(html,/por rever|a pedir|TUG/);
 req.answers.tug={status:'done',values:{tempo:20,auxiliar:'Bengala',ajuda:'Supervisão',contexto:'Idoso (≥65 anos)',protocolo:'Protocolo habitual — 3 m'}};
 const full=clinicalResultHtml(req);assert.match(full,/20 s/);assert.match(full,/Atinge o limiar/);assert.match(full,/Auxiliar: Bengala/);assert.match(full,/Ajuda durante o teste: Supervisão/);
 console.log('PASS: autor, pontuação, interpretação, itens, condições TUG e exclusão dos pedidos não realizados.');
})();
