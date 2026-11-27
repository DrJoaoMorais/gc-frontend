import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const {PGlite} = await import(process.env.PGLITE_PATH || '@electric-sql/pglite');
const id = n => '00000000-0000-0000-0000-' + String(n).padStart(12,'0');
const [web,novo,ath,entity,novEnt,athEnt,author,staff,other,patient] = Array.from({length:10}, (_,i)=>id(i+1));
const migration = name => readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');

test('circuito Web em PostgreSQL isolado', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role; create schema auth;
      create function auth.uid() returns uuid language sql stable as
        'select nullif(current_setting(''test.user'',true),'''')::uuid';
      create function set_updated_at() returns trigger language plpgsql as
        'begin new.updated_at=clock_timestamp();return new;end;';
      create table auth.users(id uuid primary key);
      create table clinics(id uuid primary key,slug text,is_active boolean,extra_fields jsonb,billing_email text);
      create table clinic_members(user_id uuid,clinic_id uuid,role text,is_active boolean);
      create table entidades_financeiras(id uuid primary key,clinic_id uuid,nome text,tipo text);
      create table patients(id uuid primary key,full_name text,nif text,address_line1 text,postal_code text,
        city text,insurance_provider text,insurance_policy_number text);
      create table appointments(id uuid primary key,clinic_id uuid,patient_id uuid,start_at timestamptz,
        status text,financial_status text,mode text,procedure_type text);
      create table registos_financeiros(id uuid primary key,entidade_id uuid,appointment_id uuid unique,
        patient_id uuid,data date,periodo text,tipo_acto text,valor numeric,valor_manual numeric,valor_faturado numeric,
        appt_status text,financial_status text,created_at timestamptz default now(),updated_at timestamptz default now());
      create trigger trg_registos_fin_updated_at before update on registos_financeiros
        for each row execute function set_updated_at();
      grant usage on schema auth to authenticated,anon;
      grant select on clinics,entidades_financeiras,clinic_members,patients to authenticated;
      grant select,update on appointments,registos_financeiros to authenticated;
      alter table registos_financeiros enable row level security;
      create policy registos_clinica on registos_financeiros to authenticated using (exists (
        select 1 from entidades_financeiras e join clinic_members m on m.clinic_id=e.clinic_id
        where e.id=entidade_id and m.user_id=auth.uid() and m.is_active));
      alter table appointments enable row level security;
      create policy agenda_clinica on appointments to authenticated using (exists (
        select 1 from clinic_members m where m.clinic_id=appointments.clinic_id and m.user_id=auth.uid() and m.is_active));
      insert into auth.users values ('${author}'),('${staff}'),('${other}');
      insert into clinics values ('${web}','joao-morais-web',true,'{}',null),
        ('${novo}','novo-cuidar',true,'{}',null), ('${ath}','athletix',true,'{}',null);
      insert into clinic_members values ('${author}','${web}','medico',true), ('${staff}','${web}','admin',true),
        ('${other}','${novo}','medico',true);
      insert into entidades_financeiras values ('${entity}','${web}','João Morais Web','acto'),
        ('${novEnt}','${novo}','Novo Cuidar','acto'), ('${athEnt}','${ath}','Athletix','acto');
      insert into patients values ('${patient}','Doente Fictício','123456789','Rua Exemplo','1234-567','Lisboa',null,null);
    `);
    const seed = (n,clinic,ent,day,bookStatus='done',finStatus='normal',fee=70,billed=null) => db.exec(`
      insert into appointments values ('${id(n+100)}','${clinic}','${patient}','${day}',
        '${bookStatus}','${finStatus}','clinica','Consulta');
      insert into registos_financeiros(id,entidade_id,appointment_id,patient_id,data,periodo,tipo_acto,
        valor,valor_faturado,appt_status,financial_status)
      values ('${id(n)}','${ent}','${id(n+100)}','${patient}',left('${day}',10)::date,left('${day}',7),
        'Consulta',${fee},${billed ?? 'null'},'done','${finStatus}');
    `);
    await seed(20,web,entity,'2026-01-05T12:00Z');
    await seed(21,novo,novEnt,'2026-06-01T12:00Z','done','normal',40,52);
    await seed(22,ath,athEnt,'2026-06-01T12:00Z','done','normal',65,65);
    const totals = async () => (await db.query(`select entidade_id,periodo,count(*),sum(valor),sum(valor_faturado)
      from registos_financeiros where appt_status='done' and financial_status<>'honorarios_dispensados'
      group by 1,2 order by 1,2`)).rows;
    const baseline = await totals();
    for (const name of ['20260824150000_add_controlo_faturacao.sql','20260914131129_agenda_fecho_contabilidade.sql',
      '20261125212621_faturacao_web.sql']) await db.exec(await migration(name));
    assert.deepEqual(await totals(),baseline,'nenhuma alteração de totais ao aplicar a migração');
    await db.exec(`update clinics set extra_fields='{"faturacao_web_desde":"2026-06-01"}' where id='${web}';`);
    await seed(23,web,entity,'2026-05-31T23:15Z'); // 1 de junho em Lisboa
    await seed(24,web,entity,'2026-06-02T12:00Z','done','honorarios_dispensados',0);
    await seed(25,web,entity,'2026-06-03T12:00Z','scheduled');
    await seed(26,web,entity,'2026-06-04T12:00Z');
    const row = async n => (await db.query('select * from registos_financeiros where id=$1',[id(n)])).rows[0];
    assert.equal((await row(23)).data.toISOString().slice(0,10),'2026-06-01');
    assert.equal((await row(23)).valor,'0');
    assert.equal((await row(23)).web_preco_pendente,true);
    await db.exec(`update registos_financeiros set valor=70 where id='${id(23)}';`);
    assert.equal((await row(23)).valor,'0','o preço antigo não reaparece numa sincronização');
    const session = async user => db.exec(`reset role;select set_config('test.user','${user}',false);set role authenticated;`);
    // Preserva os microssegundos apresentados pelo PostgREST.
    const exact = async (...ns) => Promise.all(ns.map(async n => ({id:id(n),versao:
      (await db.query('select updated_at::text from registos_financeiros where id=$1',[id(n)])).rows[0].updated_at})));
    const call = (action, rows, email='faturacao@example.invalid', preview=null) =>
      db.query('select faturacao_web_registar($1,$2::jsonb,$3,$4) as result',[action,JSON.stringify(rows),email,preview])
        .then(result=>result.rows[0].result);
    await session(staff);
    await assert.rejects(call('preco',[{...(await exact(23))[0],preco:65}]),/Sem permissão/);
    await session(other);
    assert.equal(await row(23),undefined);
    await assert.rejects(call('preco',[{id:id(23),preco:65}]),/Sem permissão/);
    const legacy = n => db.query(`insert into controlo_faturacao(entidade_id,granularidade,chave,data_referencia,
      registo_financeiro_id,estado,enviado_contabilista_at) values ($1,'registo',$2,'2026-06-01',$3,'enviado_contabilista',now())`,
      [entity,id(n),id(n)]);
    await assert.rejects(legacy(23),/Sem permissão/);
    await session(author);
    await assert.rejects(legacy(23),/Use Financeiro/);
    for (const [number,amount] of [[20,65],[23,0],[23,65.123],[24,65],[25,65]]) {
      await assert.rejects(call('preco',[{...(await exact(number))[0],preco:amount}]),/elegível|preço positivo/);
    }
    const stale = (await exact(23))[0];
    await assert.rejects(call('preco',[{...stale,preco:65},{...(await exact(26))[0],preco:0}]),/preço positivo/);
    assert.equal((await row(23)).valor,'0','o lote inválido não altera o primeiro preço');
    await call('preco',[{...stale,preco:65}]);
    await assert.rejects(call('preco',[{...stale,preco:50}]),/mudou/);
    const confirmed = await row(23);
    for (const field of ['valor','valor_manual','valor_faturado']) assert.equal(confirmed[field],'65');
    assert.equal(confirmed.web_recebido_doente_at,null);
    await assert.rejects(call('prever',await exact(23)),/email/);
    await db.exec(`reset role;update clinics set billing_email='faturacao@example.invalid' where id='${novo}';set role authenticated;`);
    await assert.rejects(call('prever',await exact(23),'outro@example.invalid'),/email/);
    const pair = 'primeiro@example.invalid,segundo@example.invalid';
    await db.query("reset role");
    await db.query("update clinics set extra_fields=jsonb_build_object('faturacao_destinatarios',$1::text) where id=$2",[pair,novo]);
    await db.query("set role authenticated");
    await assert.rejects(call('prever',await exact(23)),/email/);
    const preview = await call('prever',await exact(23),pair);
    assert.equal(preview.recipient,pair);
    assert.equal(preview.subject,'Pedido de faturação');
    assert.match(preview.body,/Valor da consulta: 65,00 €/);
    assert.doesNotMatch(preview.body,/Athletix|João Morais Web|Novo Cuidar|Seguro:|Total da fatura|2026-/);
    assert.equal((await db.query('select count(*)::int as n from agenda_envios_faturacao')).rows[0].n,0);
    await assert.rejects(call('pedido',await exact(23),preview.recipient,'Texto alterado'),/pré-visualizar/);
    const {id:request} = await call('pedido',await exact(23),preview.recipient,preview.body);
    const stored = (await db.query('select snapshot from agenda_envios_faturacao where id=$1',[request])).rows[0].snapshot;
    assert.equal(stored.body,preview.body);
    assert.equal(stored.billing_clinic_id,novo);
    assert.equal(stored.items[0].valor_faturado,65);
    await assert.rejects(call('pedido',await exact(23),preview.recipient,preview.body),/histórico/);
    await assert.rejects(db.query('update registos_financeiros set valor=80 where id=$1',[id(23)]),/pedido/);
    await assert.rejects(db.query("update appointments set status='no_show' where id=$1",[id(123)]),/faturação/);
    await assert.rejects(call('transferencia',await exact(23)),/anterior/);
    await call('envio',await exact(23));
    await assert.rejects(call('envio',await exact(23)),/já foi registado/);
    assert.equal((await row(23)).web_honorarios_recebidos_at,null);
    for (const action of ['doente','transferencia','honorarios']) await call(action,await exact(23));
    assert.ok((await row(23)).web_honorarios_recebidos_at);
    await session(other);
    assert.equal((await db.query('select id from agenda_envios_faturacao where id=$1',[request])).rows.length,0);
    assert.equal((await db.query('select id from controlo_faturacao where envio_id=$1',[request])).rows.length,0);
    await db.exec('reset role');
    assert.equal((await row(21)).valor,'40');
    assert.equal((await row(22)).valor,'65');
    assert.equal((await row(20)).valor,'70');
    const after = await totals();
    assert.deepEqual(after.filter(r=>r.entidade_id !== entity),baseline.filter(r=>r.entidade_id !== entity));
    assert.equal(after.find(r=>r.entidade_id === entity && r.periodo === '2026-06').sum,'65');
    await session(author);
    await call('preco',[{...(await exact(26))[0],preco:50}]);
    await db.query("update registos_financeiros set financial_status='honorarios_dispensados' where id=$1",[id(26)]);
    assert.equal((await row(26)).valor,'0','dispensa antes de pedido ou pagamento anula os honorários');
    assert.equal((await row(26)).valor_faturado,null);
    await db.exec('reset role');
    await seed(31,web,entity,'2026-06-01T14:00Z');
    await db.exec(`insert into patients select '${id(41)}', 'Segundo Doente', '999999990', 'Rua de Teste', '1000-000', 'Lisboa',null,null;
      update appointments set patient_id='${id(41)}' where id='${id(122)}';
      update registos_financeiros set patient_id='${id(41)}' where id='${id(22)}';
      insert into clinic_members values ('${author}','${ath}','medico',true);`);
    await session(author);
    await call('preco',[{...(await exact(31))[0],preco:50}]);
    const mixed = await call('prever',await exact(31,22),pair);
    assert.match(mixed.body,/Doente Fictício/);
    assert.match(mixed.body,/Segundo Doente/);
    assert.match(mixed.body,/50,00 €/);
    assert.match(mixed.body,/65,00 €/);
    assert.doesNotMatch(mixed.body,/Athletix|João Morais Web|Novo Cuidar/);
    const batch = await call('pedido',await exact(31,22),pair,mixed.body);
    assert.equal((await row(22)).valor_manual,null);
    assert.equal((await row(22)).valor,'65');
    assert.equal((await row(22)).web_pedido_id,batch.id);
    assert.equal((await row(31)).web_pedido_id,batch.id);
    await assert.rejects(call('envio',await exact(31)),/simultâneo/);
    await call('envio',await exact(22,31));
    await call('emitida',await exact(22));
    await assert.rejects(call('corrigir_envio',await exact(22,31)));
    await call('corrigir_emissao',await exact(22));
    await call('corrigir_envio',await exact(22,31));
    await call('envio',await exact(22,31));
    const corrected = (await db.query('select * from controlo_faturacao where registo_financeiro_id=$1',[id(22)])).rows[0];
    assert.equal(corrected.web_historico_estados.length,5);
    assert.equal(corrected.pago_at,null);
    assert.equal(corrected.recibo_emitido_at,null);
    await assert.rejects(call('pedido',await exact(22),pair,mixed.body),/histórico/);
    await db.exec(`reset role; update clinic_members set is_active=false where clinic_id='${ath}' and user_id='${author}';`);
    await session(author);
    assert.equal((await db.query('select id from agenda_envios_faturacao where id=$1',[batch.id])).rows.length,0);
    await db.exec('reset role');
    if (process.env.GC_FINANCE_TRIGGER_SQL) {
      await db.exec(`create table clinic_prices(clinic_id uuid,procedure_type text,price numeric,preco_doente numeric);
        alter table entidades_financeiras add column ativa boolean default true;
        alter table entidades_financeiras add column valor_faturado numeric;
        alter table registos_financeiros add column notas text;
        alter table registos_financeiros alter column id set default gen_random_uuid();
        insert into clinic_prices values ('${web}','Consulta',70,91), ('${novo}','Consulta',40,52), ('${ath}','Consulta',65,65);`);
      await db.exec((await readFile(process.env.GC_FINANCE_TRIGGER_SQL,'utf8'))+';');
      await db.exec(`
        create trigger trg_auto_registo_financeiro after update on appointments for each row execute function fn_auto_registo_financeiro();
        create trigger trg_sync_appointment_financeiro after insert or update of status,financial_status,procedure_type on appointments
          for each row execute function sync_appointment_to_financeiro();
        create trigger trg_snapshot_athletix_valor_faturado before insert on registos_financeiros
          for each row execute function snapshot_athletix_valor_faturado();
        insert into appointments values ('${id(199)}','${web}','${patient}','2026-05-31T23:20Z','scheduled','normal','clinica','Consulta'),
          ('${id(198)}','${ath}','${patient}','2026-06-01T12:00Z','done','normal','clinica','Consulta'),
          ('${id(197)}','${novo}','${patient}','2026-06-01T12:00Z','done','normal','clinica','Consulta');
        update appointments set status='done' where id='${id(199)}';`);
      const getByAppointment = async n => (await db.query(`select id,updated_at::text as versao,valor,valor_manual,valor_faturado,data::text,web_preco_pendente
        from registos_financeiros where appointment_id=$1`,[id(n)])).rows[0];
      const pending = await getByAppointment(199);
      assert.equal(pending.valor,'0');
      assert.equal(pending.valor_faturado,null);
      assert.equal(pending.data,'2026-06-01');
      await session(author);
      await call('preco',[{...pending,preco:53.25}]);
      await db.exec(`reset role; update appointments set status='done' where id='${id(199)}';`);
      const finalized = await getByAppointment(199);
      assert.equal(finalized.valor,'53.25');
      assert.equal(finalized.valor_manual,'53.25');
      assert.equal(finalized.valor_faturado,'53.25');
      assert.equal(finalized.data,'2026-06-01');
      assert.equal((await getByAppointment(198)).valor,'65');
      assert.equal((await getByAppointment(198)).valor_faturado,'65');
      assert.equal((await getByAppointment(197)).valor,'40');
      assert.equal((await getByAppointment(197)).web_preco_pendente,false);
    }
    await db.exec('reset role; set role anon');
    await assert.rejects(call('preco',[]),/permission denied/);
  } finally {
    await db.close();
  }
});
