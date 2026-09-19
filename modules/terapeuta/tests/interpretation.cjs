const assert=require('node:assert/strict');
(async()=>{
const {interpretation}=await import('../forms.js');const cat=require('../catalogo.json');const tug=cat.find(s=>s.id==='tug');
const a={status:'done',values:{tempo:12,auxiliar:'Sem auxiliar',ajuda:'Sem ajuda',contexto:'Idoso (≥65 anos)',protocolo:'Protocolo habitual — 3 m'}};
assert.match(interpretation(tug,a),/Atinge o limiar/);a.values.tempo=11.99;assert.match(interpretation(tug,a),/não exclui/);a.values.ajuda='Ajuda física ligeira';assert.match(interpretation(tug,a),/Sem classificação automática/);delete a.values.tempo;assert.match(interpretation(tug,a),/incompleta/);a.status='not_done';assert.equal(interpretation(tug,a),'');
console.log('PASS: conclusões, limiar TUG, ajuda física, incompleto e não realizado.');
})();
