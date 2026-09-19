const {PGlite}=require('@electric-sql/pglite');
const fs=require('fs'),assert=require('assert/strict');
const root=require('path').resolve(__dirname,'../../..');
(async()=>{
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
const token='a'.repeat(64);
await role('authenticated',ids.u2);await rejected(()=>rpc('therapist_scale_create',[ids.a,['barthel'],'','Teste',token,ids.r]),'wrong author');
await role('authenticated',ids.u);const args=[ids.a,cat.map(s=>s.id),'Instrução <teste>','Teste',token,ids.r];
const request=await rpc('therapist_scale_create',args);assert.equal(request.id,ids.r);assert.equal((await rpc('therapist_scale_create',args)).id,ids.r);
await rejected(()=>rpc('therapist_scale_create',[...args.slice(0,3),'changed',token,ids.r]),'idempotency mismatch');
await role('anon');await rejected(()=>db.query('select * from public.therapist_scale_requests'),'no public table');await rejected(()=>rpc('therapist_scale_list',[ids.v]),'no anon list');
assert.equal((await rpc('therapist_scale_context',['b'.repeat(64)])).status,'invalid');
let ctx=await rpc('therapist_scale_context',[token]);assert.equal(ctx.definitions.length,8);assert.ok(!ctx.patient_id&&!ctx.clinic_id&&!ctx.token_hash);
const meta={name:'Terapeuta teste',profession:'Fisioterapeuta',date:new Date().toISOString().slice(0,10),registration:'teste',attested:true};
await rejected(()=>rpc('therapist_scale_save',[token,0,{},meta,true]),'incomplete submission');
let saved=await rpc('therapist_scale_save',[token,0,{},meta,false]);assert.equal(saved.revision,1);
await rejected(()=>rpc('therapist_scale_save',[token,0,{},meta,false]),'stale revision');
await rejected(()=>rpc('therapist_scale_save',[token,1,{extra:{status:'done',values:{}}},meta,false]),'unrequested');
const answers={};
for(const s of cat){const vals={};for(const f of s.fields){if(f.type==='number')vals[f.id]=f.max;else if(f.type==='choice')vals[f.id]=f.values.at(-1);else if(f.type==='text')vals[f.id]='Condições teste';else if(f.type==='repeat')vals[f.id]=[{musculo:'Extensores joelho',lado:'Direito',grau:f.fields[2].values.at(-1)}];}answers[s.id]={status:'done',values:vals,notes:'',reason:''};}
let invalid=structuredClone(answers);invalid.berg.values.item_1=5;await rejected(()=>rpc('therapist_scale_save',[token,1,invalid,meta,true]),'bad score');
invalid=structuredClone(answers);invalid.mrc.values.grupos[0].grau=7;await rejected(()=>rpc('therapist_scale_save',[token,1,invalid,meta,true]),'bad MRC');
invalid=structuredClone(answers);invalid.tug.total=1;await rejected(()=>rpc('therapist_scale_save',[token,1,invalid,meta,true]),'injected total');
saved=await rpc('therapist_scale_save',[token,1,answers,meta,true]);assert.equal(saved.status,'completed');assert.equal((await rpc('therapist_scale_save',[token,1,answers,meta,true])).revision,2);
assert.deepEqual(await rpc('therapist_scale_context',[token]),{status:'completed'});
await rejected(()=>rpc('therapist_scale_save',[token,2,{},meta,false]),'immutable completed');
await role('authenticated',ids.u2);assert.equal((await rpc('therapist_scale_list',[ids.v])).length,0);
await role('authenticated',ids.u);const rows=await rpc('therapist_scale_list',[ids.v]);assert.equal(rows[0].results.barthel.total,100);assert.equal(rows[0].results.berg.total,56);assert.equal(rows[0].results.tinetti.total,28);assert.equal(rows[0].results.tinetti.groups['Equilíbrio'],16);assert.equal(rows[0].results.tinetti.groups.Marcha,12);assert.equal(rows[0].results.sppb.total,12);assert.equal(rows[0].results.mrc.total,undefined);assert.equal(rows[0].results.ashworth.total,undefined);
await rejected(()=>rpc('therapist_scale_revoke',[ids.r]),'completed cannot revoke');
const r2='00000000-0000-4000-8000-000000000008',token2='c'.repeat(64);
await rpc('therapist_scale_create',[ids.a,['tug'],'','Teste 2',token2,r2]);await rpc('therapist_scale_revoke',[r2]);await role('anon');assert.equal((await rpc('therapist_scale_context',[token2])).status,'invalid');await rejected(()=>rpc('therapist_scale_save',[token2,0,{},meta,false]),'revoked cannot save');
await role('authenticated',ids.u);const r3='00000000-0000-4000-8000-000000000009',token3='d'.repeat(64);await rpc('therapist_scale_create',[ids.a,['tug'],'','Teste 3',token3,r3]);await role('anon');await rejected(()=>rpc('therapist_scale_save',[token3,0,{tug:{status:'not_done',values:{},reason:''}},meta,true]),'reason required');await rpc('therapist_scale_save',[token3,0,{tug:{status:'not_done',values:{},reason:'Não aplicável'}},meta,true]);
await db.exec('reset role');await db.query('update public.therapist_scale_requests set expires_at=now()-interval \'1 day\' where id=$1',[r3]);await role('anon');assert.equal((await rpc('therapist_scale_context',[token3])).status,'invalid');
console.log('PASS: SQL local, permissões, 8 escalas, máximos, validação, token, revogação, expiração, concorrência, idempotência, resultados imutáveis e não realizado.');
await db.close();
})();
