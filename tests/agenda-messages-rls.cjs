const { PGlite } = require('@electric-sql/pglite');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
(async () => {
 const db = new PGlite(); let checks=0;
 await db.exec(`
 create role authenticated; create role anon;
 create schema auth; create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated,anon;
 create table public.clinics(id uuid primary key);
 create table public.patients(id uuid primary key);
 create table public.profiles(id uuid primary key,nome_completo text);
 alter table public.profiles enable row level security;
 grant select on public.profiles to authenticated;
 create policy own_profile on public.profiles for select to authenticated using(id=auth.uid());
 create table public.clinic_members(clinic_id uuid,user_id uuid,is_active boolean default true,role text,display_name text);
 create table public.patient_clinic(clinic_id uuid,patient_id uuid,is_active boolean default true);
 grant select on public.clinic_members,public.patient_clinic to authenticated;
 create function public.get_my_clinic_ids() returns table(clinic_id uuid) language sql stable security definer as $$select clinic_id from public.clinic_members where user_id=auth.uid() and is_active$$;
 alter table public.clinic_members enable row level security;
 create policy cm_select on public.clinic_members for select to authenticated using(user_id=auth.uid() or clinic_id in(select clinic_id from public.get_my_clinic_ids()));
 alter table public.patient_clinic enable row level security;
 create policy pc_select on public.patient_clinic for select to authenticated using(exists(select 1 from public.clinic_members cm where cm.clinic_id=patient_clinic.clinic_id and cm.user_id=auth.uid() and cm.is_active));
 insert into auth.users values('${id(1)}'),('${id(2)}'),('${id(3)}'),('${id(4)}'),('${id(5)}');
 insert into profiles values('${id(1)}','Ana Teste'),('${id(2)}','Bruno Teste'),('${id(3)}','João Teste'),('${id(4)}','Inativo');
 insert into clinics values('${id(11)}'),('${id(12)}');
 insert into patients values('${id(21)}'),('${id(22)}'),('${id(23)}');
 insert into clinic_members(clinic_id,user_id,is_active,role) values('${id(11)}','${id(1)}',true,'medico'),('${id(12)}','${id(2)}',true,'medico'),('${id(11)}','${id(3)}',true,'super_admin'),('${id(12)}','${id(3)}',true,'super_admin'),('${id(11)}','${id(4)}',false,'medico');
 insert into patient_clinic values('${id(11)}','${id(21)}',true),('${id(12)}','${id(22)}',true),('${id(11)}','${id(23)}',false);
 `);
 const migration = fs.readdirSync(path.join(__dirname,'../supabase/migrations')).find(n=>n.endsWith('_agenda_clinic_messages.sql'));
 await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations',migration),'utf8'));
 async function asUser(n,role='authenticated') { await db.exec(`reset role; set request.jwt.claim.sub='${n?id(n):''}'; set role ${role}`); }
 async function denied(sql) { let rejected=false; try{await db.exec(sql)}catch{rejected=true} assert(rejected,`Expected rejection: ${sql}`);checks++; }
 async function count(n) {const r=await db.query('select count(*)::int as n from agenda_messages');assert.equal(r.rows[0].n,n);checks++;}
 const insert=(clinic,recipient,patient,body='Teste')=>`insert into agenda_messages(clinic_id,recipient_id,patient_id,body,is_task) values(${clinic?`'${id(clinic)}'`:'null'},'${id(recipient)}',${patient?`'${id(patient)}'`:'null'},'${body}',true)`;
 await asUser(1);await denied(`select * from public.agenda_message_members('${id(12)}')`);
 const names=await db.query(`select * from public.agenda_message_members('${id(11)}')`);assert.equal(names.rows.length,2);checks++;assert.deepEqual(names.rows.map(r=>r.display_name),['Ana Teste','João Teste']);checks++;
 await db.exec(insert(11,1,21));await count(1);
 await db.exec(insert(11,3,null));await count(2);
 await db.exec(insert(11,1,23));await count(3); // historical association remains a valid clinic association
 await denied(insert(12,2,22));await denied(insert(null,1,21));
 await denied(insert(11,2,21));await denied(insert(11,4,21));await denied(insert(11,1,22));
 await denied(insert(11,1,null,'   '));await denied(insert(11,1,null,'x'.repeat(5001)));
 await denied(`insert into agenda_messages(clinic_id,recipient_id,body,author_id) values('${id(11)}','${id(1)}','Forged','${id(3)}')`);
 await denied(`insert into agenda_messages(clinic_id,recipient_id,body,status) values('${id(11)}','${id(1)}','Forged','resolved')`);
 await denied("update agenda_messages set hidden_from_home=true");
 await db.exec("update agenda_messages set status='resolved'");checks++;
 await db.exec("update agenda_messages set hidden_from_home=true");
 const home=await db.query('select id from agenda_messages where hidden_from_home=false');assert.equal(home.rows.length,0);checks++;
 await count(3); // retiring preserves the full clinic history
 await denied("update agenda_messages set status='pending'");
 await db.exec("update agenda_messages set status='pending',hidden_from_home=false");
 const reopened=await db.query('select id from agenda_messages where hidden_from_home=false');assert.equal(reopened.rows.length,3);checks++;
 await db.exec("update agenda_messages set status='resolved'");
 await denied("update agenda_messages set status='invalid'");
 await denied(`update agenda_messages set clinic_id='${id(12)}'`);
 await denied("update agenda_messages set body='Changed'");
 await denied('delete from agenda_messages');
 await asUser(2);await count(0);await db.exec(insert(12,2,22));await count(1);
 const hiddenOther=await db.query(`update agenda_messages set hidden_from_home=true where clinic_id='${id(11)}' returning id`);assert.equal(hiddenOther.rows.length,0);checks++;
 const changed = await db.query(`update agenda_messages set status='resolved' where clinic_id='${id(11)}' returning id`);assert.equal(changed.rows.length,0);checks++;
 await asUser(3);await count(4);await denied(`update agenda_messages set clinic_id='${id(12)}' where clinic_id='${id(11)}'`);
 await asUser(4);await denied(`select * from public.agenda_message_members('${id(11)}')`);await count(0);await denied(insert(11,1,null));
 await asUser(5);await count(0);await denied(insert(11,1,null));
 await asUser(null,'anon');await denied(`select * from public.agenda_message_members('${id(11)}')`);await denied('select * from agenda_messages');await denied(insert(11,1,null));await denied("update agenda_messages set status='resolved'");
 await asUser(1);await denied(`update agenda_messages set author_id='${id(3)}'`);
 await db.exec('reset role');await db.exec(`update clinic_members set is_active=false where user_id='${id(1)}'`);await asUser(1);await count(0);await denied(insert(11,3,null));
 console.log(`${checks} database checks passed: two clinics, cross-clinic reads/writes, inactive and non-members, anonymous access, null clinic, forged author, immutable clinic, patient and recipient scope, revocation.`);
 await db.close();
})().catch(err=>{console.error(err);process.exit(1)});
