import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {organizarExercicio,pertenceFinalidade,doseInicialDoCatalogo,doseCatalogoDefinida} from '../modules/exercicio/prescricao/catalogo-organizacao.js';
const rows=JSON.parse(fs.readFileSync(new URL('./fixtures/catalogo-173.json',import.meta.url))),byName=name=>rows.find(e=>e.name===name);
test('all 173 IDs remain available with overlapping views and no mutation',()=>{
 const before=JSON.stringify(rows),organized=rows.map(organizarExercicio);assert.equal(new Set(organized.map(e=>e.id)).size,173);
 assert.equal(organized.filter(e=>pertenceFinalidade(e,'todos')).length,173);assert.equal(organized.filter(e=>pertenceFinalidade(e,'terapeutico')).length,150);assert.equal(organized.filter(e=>pertenceFinalidade(e,'treino')).length,51);assert.equal(organized.filter(e=>pertenceFinalidade(e,'treino')&&pertenceFinalidade(e,'terapeutico')).length,28);
 assert.equal(JSON.stringify(rows),before);organized.forEach(e=>{assert.ok(e.regioes_catalogo.length);assert.ok(e.objetivos_catalogo.length);assert.ok(e.equipamento.length);assert.ok(['tempo','repeticoes'].includes(e.modo_catalogo))});
});
test('all new selections require explicit dose and rest without fabricating repetitions or seconds',()=>{
 rows.forEach(ex=>{const d=doseInicialDoCatalogo(ex);assert.equal(doseCatalogoDefinida(d),false,ex.name);assert.equal(d.rest_set,null);assert.equal(d.rest_next,null);assert.equal(d.series?.[0]?.reps??null,null);assert.equal(d.duration_series?.[0]?.duration_sec??null,null)});
});
test('walking, carrying and static exercises use time; dynamic bridge and step-down use repetitions',()=>{
 for(const name of ['Caminhada em plano','Marcha com duas canadianas — após PTA','Transporte de carga leve com punho alinhado','Torção controlada de toalha com resistência leve','Isométrico de abdução do ombro','Controlo do punho com bola giroscópica (Powerball)'])assert.equal(organizarExercicio(byName(name)).modo_catalogo,'tempo',name);
 for(const name of ['Ponte unipodal','Reverse Lunge','Step-down frontal','Step-down lateral','Push-up plus com apoio nos joelhos','Controlo escapular com movimento ativo do ombro'])assert.equal(organizarExercicio(byName(name)).modo_catalogo,'repeticoes',name);
});
test('material and anatomy corrections do not confuse support or accessory words with target region',()=>{
 assert.deepEqual(organizarExercicio(byName('Hip Thrust com Halteres')).equipamento,['Halteres']);assert.deepEqual(organizarExercicio(byName('Wall slide com rolo de espuma')).equipamento,['Rolo de espuma']);
 assert.deepEqual(organizarExercicio(byName('Desvio radial do punho com carga leve e alavanca curta')).regioes_catalogo,['Punho / mão']);
 assert.deepEqual(organizarExercicio(byName('Leg press horizontal')).regioes_catalogo,['Anca','Joelho']);
 assert.ok(!organizarExercicio(byName('Flexão de braços inclinada com apoio numa bancada')).regioes_catalogo.includes('Anca'));
 assert.deepEqual(organizarExercicio(byName('Estabilização rítmica do ombro em apoio na parede')).locais,['Clínica']);
});
test('valid manual doses pass, incomplete or nonfinite doses fail; legacy plans are not reinterpreted',()=>{
 const legacy={name:'Plano guardado',series:[{reps:12,load:8}],rest_set:60};const before=JSON.stringify(legacy);assert.equal(doseCatalogoDefinida(legacy),true);assert.equal(JSON.stringify(legacy),before);
 const it=doseInicialDoCatalogo(byName('Agachamento'));it.series[0].reps=10;it.rest_set=30;assert.equal(doseCatalogoDefinida(it),false);it.rest_next=0;assert.equal(doseCatalogoDefinida(it),true);it.series[0].reps=Infinity;assert.equal(doseCatalogoDefinida(it),false);
 const timed=doseInicialDoCatalogo(byName('Caminhada em plano'));timed.duration_series[0].duration_sec=1200;timed.rest_set=0;timed.rest_next=0;assert.equal(doseCatalogoDefinida(timed),true);
});
test('new catalogue records remain visible, and edits to existing context tags are respected',()=>{
 const added={id:'new',name:'Novo',contextos_exercicio:['Treino'],categoria:['Core'],objetivos_exercicio:['Fortalecimento'],equipamento:['Halteres'],locais:['Ginásio']};assert.equal(pertenceFinalidade(added,'treino'),true);assert.equal(pertenceFinalidade(added,'todos'),true);
 const changed={...byName('Agachamento'),contextos_exercicio:['Treino','Reabilitação']};assert.equal(pertenceFinalidade(changed,'terapeutico'),true);
});
