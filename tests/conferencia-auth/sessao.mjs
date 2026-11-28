import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const {API_URL, ANON_KEY, SERVICE_ROLE_KEY, DB_URL} = process.env;
assert.equal(new URL(API_URL).hostname,'127.0.0.1');
assert.equal(new URL(DB_URL).hostname,'127.0.0.1');
async function request(path, payload, key, token=key) {
  const res = await fetch(API_URL+path,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const json=await res.json();
  assert.ok(res.ok,json.message || json.msg || res.status);
  return json;
}
async function login(){
  const email=randomUUID()+'@example.invalid',password=randomUUID();
  await request('/auth/v1/admin/users',{email,password,email_confirm:true},SERVICE_ROLE_KEY);
  return request('/auth/v1/token?grant_type=password',{email,password},ANON_KEY);
}
const doctor=await login(), outsider=await login();
const sql=q=>execFileSync('psql',[DB_URL,'-XAtq','-v','ON_ERROR_STOP=1','-c',q],{encoding:'utf8'}).trim();
const [web,ath,novo,webEnt,athEnt,p1,p2,a1,a2,r1,r2]=Array.from({length:11},()=>randomUUID());
const recipients='um@example.invalid,dois@example.invalid';
sql(`insert into clinics values ('${web}','joao-morais-web',true,jsonb_build_object('faturacao_web_desde',current_date-1),null),('${ath}','athletix',true,'{}',null),('${novo}','novo-cuidar',true,'{}','${recipients}');
insert into entidades_financeiras(id,clinic_id,nome,tipo) values ('${webEnt}','${web}','Web','acto'),('${athEnt}','${ath}','Athletix','acto');
insert into clinic_members values ('${doctor.user.id}','${web}','medico',true),('${doctor.user.id}','${ath}','medico',true);
insert into patients values ('${p1}','Exemplo A','000000000','Rua fictícia','1000-000','Lisboa',null,null),('${p2}','Exemplo B','000000000','Rua fictícia','1000-000','Lisboa',null,null);
insert into appointments values ('${a1}','${web}','${p1}',now(),'done','normal','presencial','Consulta'),('${a2}','${ath}','${p2}',now(),'done','normal','presencial','Consulta');
insert into registos_financeiros(id,entidade_id,appointment_id,patient_id,data,tipo_acto,valor,valor_faturado,appt_status,financial_status)
values ('${r1}','${webEnt}','${a1}','${p1}',(now() at time zone 'Europe/Lisbon')::date,'Consulta',0,null,'done','normal'),('${r2}','${athEnt}','${a2}','${p2}',(now() at time zone 'Europe/Lisbon')::date,'Consulta',65,65,'done','normal');`);
const items=(...ids)=>ids.map(id=>({id,versao:sql(`select updated_at from registos_financeiros where id='${id}'`)}));
const rpc=(action,rows,preview=null,session=doctor)=>request('/rest/v1/rpc/faturacao_web_registar',{p_acao:action,p_itens:rows,p_destinatario:recipients,p_previa:preview},ANON_KEY,session.access_token);
await assert.rejects(rpc('prever',items(r1),null,outsider),/Sem permissão/);
await rpc('preco',[{...items(r1)[0],preco:50}]);
const preview=await rpc('prever',items(r1,r2));
assert.match(preview.body,/Exemplo A/);assert.match(preview.body,/Exemplo B/);
assert.doesNotMatch(preview.body,/Athletix|Novo Cuidar|João Morais Web/);
assert.equal(preview.recipient,recipients);
await rpc('pedido',items(r1,r2),preview.body);
await rpc('envio',items(r1,r2));
await rpc('emitida',items(r1));
assert.equal(sql('select sum(valor) from registos_financeiros')*1,115);
assert.equal(sql('select count(*) from agenda_envios_faturacao'),'1');
await assert.rejects(rpc('pedido',items(r1,r2),preview.body),/histórico/);
console.log('Sessões autenticadas verificadas. Pedido misto, emissão, totais, duplicação e acesso confirmados.');
