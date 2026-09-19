const {PGlite}=require('@electric-sql/pglite');
const fs=require('fs'),assert=require('assert/strict');
const root=require('path').resolve(__dirname,'../../..');
module.exports.createFixture=async()=>{
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
create table public.clinic_members(clinic_id uuid,user_id uuid,role text,is_active boolean);
create table public.consultations(id uuid primary key,patient_id uuid,clinic_id uuid);
create table public.consultation_assessments(id uuid primary key,consultation_id uuid,patient_id uuid,clinic_id uuid,author_user_id uuid,assessment_type text);`);
const ids={u:'00000000-0000-4000-8000-000000000001',u2:'00000000-0000-4000-8000-000000000002',c:'00000000-0000-4000-8000-000000000003',p:'00000000-0000-4000-8000-000000000004',v:'00000000-0000-4000-8000-000000000005',a:'00000000-0000-4000-8000-000000000006',r:'00000000-0000-4000-8000-000000000007'};
await db.exec(`insert into auth.users values('${ids.u}'),('${ids.u2}');insert into public.clinic_members values('${ids.c}','${ids.u}','medico',true),('${ids.c}','${ids.u2}','medico',true);insert into public.consultations values('${ids.v}','${ids.p}','${ids.c}');insert into public.consultation_assessments values('${ids.a}','${ids.v}','${ids.p}','${ids.c}','${ids.u}','teleconsulta');`);
const migration=fs.readdirSync(root+'/supabase/migrations').find(x=>x.endsWith('_therapist_scale_links.sql'));
await db.exec(fs.readFileSync(root+'/supabase/migrations/'+migration,'utf8'));
const cat=JSON.parse(fs.readFileSync(root+'/modules/terapeuta/catalogo.json','utf8'));
async function role(name,user=''){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);await db.exec('set role '+name)}
async function rpc(name,args){const q='select public.'+name+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') result';return (await db.query(q,args)).rows[0].result;}
async function rejected(fn,label){let rejected=false;try{await fn()}catch{rejected=true}assert.ok(rejected,label)}
return {db,ids,cat,role,rpc,rejected};
};
