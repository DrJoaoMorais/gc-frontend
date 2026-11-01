import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PLANOS_CASA, configuracaoPlanoCasa, preverPlanoCasa, tempoPlanoCasa } from '../modules/exercicio/prescricao/planos-casa.js';
const catalogo=JSON.parse(fs.readFileSync(new URL('./fixtures/catalogo-173.json',import.meta.url),'utf8'));
const antes=JSON.stringify(PLANOS_CASA);
assert.equal(PLANOS_CASA.length,6);
assert.equal(new Set(PLANOS_CASA.map(p=>p.id)).size,6);
for(const p of PLANOS_CASA){
 assert(Object.isFrozen(p));
 const modelo=preverPlanoCasa(p,catalogo);assert.deepEqual(modelo.erros,[]);assert.equal(modelo.sessoes.length,p.frequencia*4);
 for(const r of modelo.sessoes){assert(r.sessao.blocks.length>=3);assert.equal(r.minutos,p.minutos);assert.equal(r.sessao.training_program.name,p.nome);assert.equal(r.sessao.training_program.source_id,p.id);assert.equal(r.forca+r.cardio+r.aquecimento+r.retorno,p.minutos*60);}
 const a=preverPlanoCasa(p,catalogo),b=preverPlanoCasa(p,catalogo);a.sessoes[0].sessao.blocks[0].name='Alterado no doente';assert.notEqual(b.sessoes[0].sessao.blocks[0].name,'Alterado no doente');
 const c=configuracaoPlanoCasa(p,catalogo,'2026-11-02');assert(c.variantes.A.every(Boolean));assert(c.variantes.B.every(Boolean));assert.equal(c.inicio,'2026-11-02');
}
assert.equal(JSON.stringify(PLANOS_CASA),antes);
assert(preverPlanoCasa(PLANOS_CASA[0],[]).erros.length>0);
assert.equal(tempoPlanoCasa(83),'1 min 23 s');assert.equal(tempoPlanoCasa(20),'20 s');
console.log('PASS: seis planos completos, fichas e doses preenchidas, 20/30/45 min, frequência, identificação do modelo e cópias independentes.');
