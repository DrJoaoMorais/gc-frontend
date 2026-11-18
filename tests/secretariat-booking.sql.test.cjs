const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const uuid = number => `00000000-0000-0000-0000-${String(number).padStart(12, '0')}`;
const [secretary, doctor, outsider, novo, web, third, patient, otherPatient, booking, otherBooking] =
  Array.from({ length: 10 }, (_, index) => uuid(index + 1));
const root = resolve(__dirname, '..');
const migration = readFileSync(resolve(root, 'supabase/migrations/20261118144913_secretariado_agenda.sql'), 'utf8');
const activation = readFileSync(resolve(root, 'scripts/activate-secretariat-booking.sql'), 'utf8');

async function main() {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
      create function auth.jwt() returns jsonb language sql stable as
        $$ select jsonb_build_object('aal',current_setting('request.jwt.claim.aal', true)) $$;
      grant usage on schema auth to authenticated;
      create table auth.users (id uuid primary key);
      create table public.profiles (id uuid primary key, nome_completo text);
      create table public.clinics (id uuid primary key, slug text, name text, is_active bool default true, duracao_default_min int default 20);
      create table public.clinic_members (
        clinic_id uuid, user_id uuid, role text, is_active bool default true,
        display_name text, created_at timestamptz default now()
      );
      create table public.patients (id uuid primary key, full_name text, dob date, is_active bool, notes text);
      create table public.patient_clinic (patient_id uuid, clinic_id uuid, is_active bool);
      create table public.consultations (clinic_id uuid, clinical_note text);
      create type appointment_mode as enum ('bloqueio', 'presencial', 'video');
      create table public.appointments (
        id uuid primary key default gen_random_uuid(), clinic_id uuid, patient_id uuid, provider_id uuid,
        procedure_type text, title text, notes text, start_at timestamptz, end_at timestamptz,
        status text not null default 'scheduled', mode appointment_mode not null default 'presencial',
        created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
        rescheduled_from_id uuid references public.appointments(id), reschedule_count int not null default 0
      );
      create function touch() returns trigger language plpgsql as
        $$ begin new.updated_at := clock_timestamp(); return new; end; $$;
      create trigger trg_appointments_updated_at before update on public.appointments
      for each row execute function touch();
      grant select on clinic_members, patients, appointments, consultations to authenticated;
      alter table public.appointments enable row level security;
      alter table public.patients enable row level security;
      alter table public.consultations enable row level security;
      create policy appointments_select on appointments for select to authenticated using (
        exists (select 1 from clinic_members m where m.clinic_id=appointments.clinic_id
          and m.user_id=auth.uid() and m.is_active)
      );
      create policy patients_select on patients for select to authenticated using (
        exists (select 1 from patient_clinic pc join clinic_members m on m.clinic_id=pc.clinic_id
          where pc.patient_id=patients.id and m.user_id=auth.uid() and m.is_active)
      );
      grant select on patient_clinic to authenticated;
      create policy consultations_select on consultations for select to authenticated using (
        exists (select 1 from clinic_members m where m.clinic_id=consultations.clinic_id
          and m.user_id=auth.uid() and m.is_active and m.role in ('medico','admin','super_admin','fisioterapeuta'))
      );
      insert into auth.users values ('${secretary}'), ('${doctor}'), ('${outsider}');
      insert into profiles values ('${secretary}','Secretária Teste'), ('${doctor}','Médico Teste');
      insert into clinics (id,slug,name) values ('${novo}','novo-cuidar','Novo Cuidar'),
        ('${web}','joao-morais-web','João Morais Web'), ('${third}','outra','Outra Clínica');
      insert into clinic_members (clinic_id,user_id,role) values
        ('${novo}','${secretary}','administrativo'), ('${novo}','${doctor}','medico'),
        ('${web}','${doctor}','super_admin'), ('${third}','${outsider}','administrativo');
      insert into patients values ('${patient}','Doente Teste','1980-01-01',true,'nota reservada'),
        ('${otherPatient}','Doente de Outra Clínica',null,true,'outra nota');
      insert into patient_clinic values ('${patient}','${novo}',true), ('${patient}','${web}',true),
        ('${otherPatient}','${third}',true);
      insert into consultations values ('${novo}','observação clínica reservada');
    `);
    await db.exec(migration);

    async function role(user, aal = 'aal2') {
      await db.exec("reset role; set role authenticated");
      await db.query("select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claim.aal', $2, false)", [user, aal]);
    }
    async function owner() {
      await db.exec("reset role; reset request.jwt.claim.sub; reset request.jwt.claim.aal");
    }
    async function rpc(action, args = {}) {
      const { rows } = await db.query('select public.gc_secretariat_booking($1,$2) as result', [action, args]);
      return rows[0].result;
    }
    const denied = async action => assert.rejects(action, { code: '42501' });

    await db.exec('set role anon');
    await denied(() => rpc('scope'));
    await role(secretary);
    assert.deepEqual((await rpc('scope')).clinics, []);
    await owner();
    await db.exec(activation);
    await role(secretary, 'aal1');
    await denied(() => rpc('scope'));
    await role(secretary);
    assert.deepEqual((await rpc('scope')).clinics.map(c => c.id).sort(), [novo, web]);
    for (const table of ['patients', 'appointments', 'consultations']) {
      assert.deepEqual((await db.query(`select * from ${table}`)).rows, []);
    }
    await denied(() => db.query('select * from gc_booking_private.audit'));
    await denied(() => rpc('day', { clinic_id: third, from: '2026-11-18' }));
    await denied(() => rpc('patients', { clinic_id: third, query: 'Doente' }));
    const matches = await rpc('patients', { clinic_id: web, query: 'Doente' });
    assert.deepEqual(matches, [{ id: patient, full_name: 'Doente Teste', dob: '1980-01-01' }]);

    const create = { clinic_id: web, patient_id: patient, request_id: booking,
      duration: 20, start_at: '2026-07-15T23:30:00Z', procedure_type: 'Primeira Consulta' };
    await denied(() => rpc('save', { ...create, patient_id: otherPatient }));
    await denied(() => rpc('save', { ...create, clinic_id: third }));
    assert.deepEqual(await rpc('save', create), { id: booking });
    assert.deepEqual(await rpc('save', create), { id: booking });
    assert.deepEqual(await rpc('save', { ...create, clinic_id: novo, request_id: otherBooking }), { id: otherBooking });
    assert.deepEqual(await rpc('day', { clinic_id: web, from: '2026-07-15' }), []);
    const [row] = await rpc('day', { clinic_id: web, from: '2026-07-16' });
    assert.equal(row.id, booking);
    assert.equal(row.patient_name, 'Doente Teste');
    assert.equal(Object.hasOwn(row, 'notes'), false);
    const edit = { ...create, id: booking, duration: 30, status: 'cancelled',
      start_at: '2026-07-17T09:00:00Z', updated_at: row.updated_at };
    await denied(() => rpc('save', { ...edit, clinic_id: novo }));
    assert.deepEqual(await rpc('save', edit), { id: booking });
    await assert.rejects(() => rpc('save', edit), /foi alterada/);
    await denied(() => rpc('report', { clinic_id: web, from: '2026-01-01', to: '2026-12-31' }));
    await denied(() => db.query('update appointments set status = \'done\''));

    await owner();
    const { rows: [saved] } = await db.query('select * from appointments where id=$1', [booking]);
    assert.equal(saved.created_by, secretary);
    assert.equal(saved.status, 'cancelled');
    assert.equal(saved.reschedule_count, 1);
    const { rows: audit } = await db.query(
      'select actor_id, action, before_values, after_values from gc_booking_private.audit where appointment_id=$1 order by id', [booking]);
    assert.deepEqual(audit.map(e => [e.actor_id, e.action]), [[secretary, 'insert'], [secretary, 'update']]);
    assert.equal(audit[0].after_values.created_at, audit[1].after_values.created_at);
    assert.equal(audit[1].before_values.status, 'scheduled');
    assert.equal(audit[1].after_values.status, 'cancelled');

    // A historical remarcation uses an inserted child with a different operator.
    await db.query(`insert into appointments (clinic_id, patient_id, created_by, status, rescheduled_from_id)
      values ($1,$2,$3,'done',$4)`, [web, patient, doctor, booking]);
    const { rows: [{ day }] } = await db.query("select (clock_timestamp() at time zone 'Europe/Lisbon')::date::text as day");
    await role(doctor);
    const report = await rpc('report', { from: day, to: day });
    assert.deepEqual(report.map(row => [row.clinic_id, row.user_id, row.status, row.total]).sort(),
      [[novo, secretary, 'scheduled', 1], [web, secretary, 'done', 1]]);
    assert.deepEqual((await rpc('report', { clinic_id: web, from: day, to: day, status: 'done' })).map(row => row.total), [1]);
    assert.deepEqual(await rpc('report', { clinic_id: web, from: day, to: day, status: 'cancelled' }), []);
    await denied(() => rpc('report', { clinic_id: third, from: day, to: day }));

    await owner();
    await db.query('update gc_booking_private.access set revoked_at=now() where user_id=$1 and clinic_id=$2', [secretary, web]);
    await role(secretary);
    await denied(() => rpc('day', { clinic_id: web, from: '2026-07-17' }));
    console.log('Secretariado SQL: âmbito, RLS, MFA, criação/repetição, reagendamento, autoria, auditoria e estatísticas validados.');
  } finally {
    await db.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
