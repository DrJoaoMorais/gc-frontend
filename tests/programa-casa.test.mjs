import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
const root=new URL('../modules/exercicio/prescricao/',import.meta.url);
const mod=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(new URL('programa-casa.js',root),'utf8')).toString('base64'));
const catalogo=JSON.parse(fs.readFileSync(new URL('./fixtures/catalogo-173.json',import.meta.url),'utf8'));
const original=JSON.stringify(catalogo),variantes=mod.sugerirVariantesCasa(catalogo);
assert.equal(variantes.A.filter(Boolean).length,5);assert.equal(variantes.B.filter(Boolean).length,5);
const base={inicio:'2026-11-02',frequencia:3,minutos:20,nivel:'leve',voltas:2,reps:8,pausa:45,entreVoltas:60,variantes};
const contexto={catalogo,criarId:randomUUID,disponibilidade:()=>({ativo:true,min:45}),ocupado:()=>false,tempoRepeticao:()=>4};
const totalBlocos=s=>s.blocks.reduce((t,b)=>t+(b.tipo==='fixed'?b.duration_sec:b.rounds*b.exercicios.reduce((v,e)=>v+(e.measure==='time'?e.value:e.value*4)+e.rest_after_s,0)+(b.rounds-1)*b.rest_between_rounds_s),0);
for(const frequencia of [3,4,5])for(const minutos of [20,30,45]){
 const p=mod.proporProgramaCasa({...base,frequencia,minutos},contexto);
 assert.deepEqual(p.erros,[]);assert.equal(p.sessoes.length,frequencia*4);assert.equal(p.review,'2026-11-15');assert.equal(p.fim,'2026-11-29');
 assert.equal(new Set(p.sessoes.map(r=>r.sessao.session_id)).size,frequencia*4);
 for(const r of p.sessoes){assert.equal(totalBlocos(r.sessao),minutos*60);assert.equal(r.forca+r.cardio+r.aquecimento+r.retorno,minutos*60);assert(r.date>=base.inicio&&r.date<=p.fim);assert.equal(r.sessao.local,'Casa');assert.equal(r.sessao.training_program.frequency,frequencia);assert.equal(r.sessao.training_program.progression,'rever_antes_de_aumentar');}
 const forcas=p.sessoes.filter(r=>r.sessao.training_focus!=='cardio');
 for(let i=1;i<forcas.length;i++)assert((new Date(forcas[i].date)-new Date(forcas[i-1].date))/86400000>=2);
 assert(p.sessoes.filter(r=>r.sessao.training_focus==='cardio').every(r=>r.forca===0));
 assert(p.sessoes.some(r=>r.sessao.blocks.some(b=>b.name.includes('Passos laterais'))));
}
const p=mod.proporProgramaCasa(base,contexto);assert.equal(p.sessoes[0].nome,'Força A');assert.equal(p.sessoes[3].nome,'Força B');
assert.equal(p.sessoes[0].sessao.blocks.find(b=>b.tipo==='voltas').rounds,p.sessoes[6].sessao.blocks.find(b=>b.tipo==='voltas').rounds);
assert(mod.proporProgramaCasa(base,{...contexto,disponibilidade:()=>null}).erros.length);
assert(mod.proporProgramaCasa(base,{...contexto,disponibilidade:()=>({ativo:false,min:0})}).erros.length);
assert(mod.proporProgramaCasa(base,{...contexto,ocupado:date=>date==='2026-11-02'}).erros.some(e=>e.includes('já existe')));
assert(mod.proporProgramaCasa({...base,variantes:{A:['inexistente'],B:variantes.B}},contexto).erros.length);
assert(mod.proporProgramaCasa({...base,inicio:'2026-02-30'},contexto).erros.length);
assert(mod.proporProgramaCasa({...base,semana:[{dia:0,tipo:'forca',variante:'A'},{dia:1,tipo:'forca',variante:'B'},{dia:5,tipo:'cardio',variante:'A'}]},contexto).erros.some(e=>e.includes('pelo menos')));
assert(mod.proporProgramaCasa(base,{...contexto,tempoRepeticao:()=>NaN}).erros.length);
const curto=mod.proporProgramaCasa({...base,minutos:45},{...contexto,disponibilidade:()=>({ativo:true,min:15})});assert.equal(curto.erros.length,0);assert(curto.sessoes.every(r=>r.minutos===15&&r.ajustado));
assert.equal(JSON.stringify(catalogo),original);assert(!mod.catalogoCasa(catalogo).some(e=>e.equipamento.includes('Máquina')));
console.log('PASS: programas 3/4/5 sessões, 20/30/45 min, recuperação, catálogo real, dose sem progressão automática, limites diários, conflitos e preservação de dados.');
