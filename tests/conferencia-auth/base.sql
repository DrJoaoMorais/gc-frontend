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
      create function set_updated_at() returns trigger language plpgsql as $$begin new.updated_at=clock_timestamp();return new;end;$$;
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
