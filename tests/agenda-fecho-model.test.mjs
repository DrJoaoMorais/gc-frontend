import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {test} from 'node:test';
const source=await readFile(new URL('../modules/agenda-fecho-model.js',import.meta.url),'utf8');
const m=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const patient={full_name:'Doente fictício',nif:'123456789',address_line1:'Rua de teste 1',postal_code:'2000-001',city:'Santarém'};
const row={id:'r1',entidade_id:'e1',patient_id:'p1',data:'2026-09-14',tipo_acto:'Consulta',patients:patient,agendaCounts:true,agendaFee:40,agendaBilled:80,created_at:'2026-09-14T10:00:00Z'};
test('uma fatura por doente reúne consulta e PRP, sem usar honorários como preço ao doente',()=>{
 const request=m.buildRequest({name:'Athletix',start:row.data,end:row.data,records:[row,{...row,id:'r2',tipo_acto:'PRP',agendaBilled:150}]});
 assert.equal(request.invoiceCount,1);assert.equal(request.total,230);assert.deepEqual(request.issues,[]);assert.match(request.body,/NIF: 123456789/);assert.match(request.body,/PRP/);
});
test('Cachopas e períodos mensais usam os honorários e não incluem dados pessoais',()=>{
 const request=m.buildRequest({name:'Novo Cuidar',start:'2026-08-01',end:'2026-09-14',records:[row]});
 assert.equal(request.total,40);assert.doesNotMatch(request.body,/123456789|Doente fictício/);
});
test('falta de morada ou valor bloqueia um pedido individual',()=>{
 const request=m.buildRequest({name:'João Morais Web',start:row.data,end:row.data,records:[{...row,agendaBilled:null,patients:{...patient,city:''}}]});
 assert.equal(request.issues.length,2);
});
test('pago sem data de envio não é considerado enviado',()=>assert.equal(m.isSent({estado:'pago'}),false));
test('novos atos posteriores a um fecho legado continuam por enviar',()=>{
 const history=[{entidade_id:'e1',granularidade:'dia',chave:row.data,estado:'enviado_contabilista',enviado_contabilista_at:'2026-09-14T11:00:00Z'}];
 assert.ok(m.sentForRecord(row,history));assert.equal(m.sentForRecord({...row,created_at:'2026-09-14T12:00:00Z'},history),undefined);
});
test('falta na agenda prevalece sobre financeiro ainda desatualizado',()=>{
 assert.deepEqual(m.billableRows([{...row,appointment_id:'a1'}],[{id:'a1',status:'no_show'}],[]),[]);
});
test('limites mensais e data de Lisboa respeitam verão e ano bissexto',()=>{
 assert.deepEqual(m.monthBounds('2024-02-12'),{start:'2024-02-01',end:'2024-02-29'});
 assert.equal(m.lisbonDay('2026-09-13T23:30:00Z'),'2026-09-14');
});
