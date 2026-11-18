create schema gc_booking_private;
revoke all on schema gc_booking_private from public, anon;
grant usage on schema gc_booking_private to authenticated;

create table gc_booking_private.access (
  user_id uuid not null references auth.users(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id),
  provider_id uuid not null references public.profiles(id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (user_id, clinic_id)
);
alter table gc_booking_private.access enable row level security;

create table gc_booking_private.audit (
  id bigint generated always as identity primary key,
  appointment_id uuid not null,
  actor_id uuid,
  changed_at timestamptz not null default clock_timestamp(),
  action text not null,
  notes_changed boolean not null default false,
  before_values jsonb,
  after_values jsonb
);
alter table gc_booking_private.audit enable row level security;
create index on gc_booking_private.audit (appointment_id, changed_at);

-- Keep the original author and creation time even when an existing caller edits a booking.
create function gc_booking_private.stamp_author()
returns trigger language plpgsql set search_path = '' as $$
declare
  parent_author uuid;
begin
  if tg_op = 'UPDATE' then
    -- Allow the foreign key to clear authorship when the auth account is deleted.
    if not (old.created_by is not null and new.created_by is null and pg_trigger_depth() > 1) then
      new.created_by := old.created_by;
    end if;
    new.created_at := old.created_at;
  elsif auth.uid() is not null then
    if new.rescheduled_from_id is null then
      new.created_by := auth.uid();
    else
      select a.created_by into parent_author from public.appointments a
      where a.id = new.rescheduled_from_id and a.patient_id = new.patient_id;
      if not found then raise exception 'Marcação de origem indisponível.' using errcode = '42501'; end if;
      new.created_by := parent_author;
    end if;
    new.created_at := clock_timestamp();
  end if;
  return new;
end;
$$;
create trigger gc_booking_stamp_author before insert or update on public.appointments
for each row execute function gc_booking_private.stamp_author();

create function gc_booking_private.audit_values(a public.appointments)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'clinic_id', a.clinic_id, 'patient_id', a.patient_id, 'provider_id', a.provider_id,
    'start_at', a.start_at, 'end_at', a.end_at, 'status', a.status, 'mode', a.mode,
    'procedure_type', a.procedure_type, 'created_by', a.created_by,
    'created_at', a.created_at, 'rescheduled_from_id', a.rescheduled_from_id,
    'reschedule_count', a.reschedule_count
  );
$$;

create function gc_booking_private.log_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  previous jsonb;
  current_values jsonb;
  changed_notes boolean := false;
begin
  if tg_op <> 'INSERT' then previous := gc_booking_private.audit_values(old); end if;
  if tg_op <> 'DELETE' then current_values := gc_booking_private.audit_values(new); end if;
  if tg_op = 'UPDATE' then changed_notes := old.notes is distinct from new.notes; end if;
  if previous is distinct from current_values or changed_notes then
    insert into gc_booking_private.audit (appointment_id, actor_id, action, notes_changed, before_values, after_values)
    values (coalesce(new.id, old.id), auth.uid(), lower(tg_op), changed_notes, previous, current_values);
  end if;
  return null;
end;
$$;
create trigger gc_booking_audit after insert or update or delete on public.appointments
for each row execute function gc_booking_private.log_change();

create index if not exists gc_booking_rescheduled_from_idx
  on public.appointments (rescheduled_from_id) where rescheduled_from_id is not null;

create index if not exists gc_booking_report_roots_idx
  on public.appointments (clinic_id, created_at) where rescheduled_from_id is null;

create function gc_booking_private.dispatch(p_action text, p_args jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  clinic uuid := (p_args->>'clinic_id')::uuid;
  booking uuid := (p_args->>'id')::uuid;
  request_id uuid := (p_args->>'request_id')::uuid;
  patient uuid := (p_args->>'patient_id')::uuid;
  day_from date := (p_args->>'from')::date;
  day_to date := (p_args->>'to')::date;
  starts timestamptz := (p_args->>'start_at')::timestamptz;
  minutes integer := (p_args->>'duration')::integer;
  state text := p_args->>'status';
  procedure text := btrim(p_args->>'procedure_type');
  term text := btrim(p_args->>'query');
  allowed public.clinics%rowtype;
  grant_row gc_booking_private.access%rowtype;
  existing public.appointments%rowtype;
  patient_name text;
  result jsonb;
begin
  if actor is null or coalesce(auth.jwt()->>'aal', '') <> 'aal2' then
    raise exception 'Dupla autenticação necessária.' using errcode = '42501';
  end if;

  if p_action = 'scope' then
    return jsonb_build_object(
      'clinics', coalesce((
        select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'duration', c.duracao_default_min) order by c.name)
        from gc_booking_private.access g join public.clinics c on c.id = g.clinic_id
        where g.user_id = actor and g.revoked_at is null and c.is_active
      ), '[]'::jsonb),
      'report_clinics', coalesce((
        select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) order by c.name)
        from public.clinics c join public.clinic_members m on m.clinic_id = c.id
        where m.user_id = actor and m.is_active and m.role in ('admin', 'super_admin', 'medico')
          and c.is_active
      ), '[]'::jsonb)
    );
  end if;

  if p_action = 'report' then
    if not exists (
      select 1 from public.clinic_members m join public.clinics c on c.id = m.clinic_id
      where m.user_id = actor and m.is_active and c.is_active
        and m.role in ('admin', 'super_admin', 'medico')
        and (clinic is null or m.clinic_id = clinic)
    ) then raise exception 'Sem acesso às estatísticas desta clínica.' using errcode = '42501'; end if;
    if day_from is null or day_to is null or day_to < day_from or day_to - day_from > 366 then
      raise exception 'Escolhe um período até 367 dias.';
    end if;
    with recursive authorised as (
      select m.clinic_id from public.clinic_members m
      join public.clinics c on c.id = m.clinic_id
      where m.user_id = actor and m.is_active and c.is_active
        and m.role in ('admin', 'super_admin', 'medico')
    ), chains as (
      select a.id as root_id, a.id, a.clinic_id as original_clinic, a.created_by,
             a.status, a.created_at, array[a.id] as path
      from public.appointments a
      join authorised s on s.clinic_id = a.clinic_id
      where a.rescheduled_from_id is null and a.patient_id is not null and a.mode <> 'bloqueio'
        and upper(coalesce(a.title, '')) <> 'SLOT'
        and (clinic is null or a.clinic_id = clinic)
        and a.created_at >= (day_from::timestamp at time zone 'Europe/Lisbon')
        and a.created_at < ((day_to + 1)::timestamp at time zone 'Europe/Lisbon')
        and (
          exists (select 1 from gc_booking_private.access g
            where g.user_id = a.created_by and g.clinic_id = a.clinic_id)
          or exists (select 1 from public.clinic_members m
            where m.user_id = a.created_by and m.clinic_id = a.clinic_id and m.role = 'administrativo')
        )
      union all
      select chain.root_id, a.id, chain.original_clinic, chain.created_by,
             a.status, a.created_at, chain.path || a.id
      from chains chain join public.appointments a on a.rescheduled_from_id = chain.id
      join authorised s on s.clinic_id = a.clinic_id
      where not a.id = any(chain.path)
    ), latest as (
      select distinct on (root_id) original_clinic, created_by, status from chains
      order by root_id, cardinality(path) desc, created_at desc, id desc
    ), totals as (
      select original_clinic, created_by, status, count(*) as total
      from latest where state is null or status = state
      group by original_clinic, created_by, status
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'clinic_id', t.original_clinic, 'clinic_name', c.name, 'user_id', t.created_by,
      'secretary', coalesce(nullif(btrim(m.display_name), ''), p.nome_completo, 'Utilizador'),
      'status', t.status, 'total', t.total
    ) order by c.name, p.nome_completo, t.status), '[]'::jsonb) into result
    from totals t join public.clinics c on c.id = t.original_clinic
    left join public.profiles p on p.id = t.created_by
    left join lateral (
      select display_name from public.clinic_members m
      where m.user_id = t.created_by and m.clinic_id = t.original_clinic
      order by m.is_active desc, m.created_at desc limit 1
    ) m on true;
    return result;
  end if;

  select c.* into allowed from public.clinics c where c.id = clinic and c.is_active;
  select g.* into grant_row from gc_booking_private.access g
  where g.clinic_id = clinic and g.user_id = actor and g.revoked_at is null;
  if allowed.id is null or grant_row.user_id is null then
    raise exception 'Sem acesso à agenda desta clínica.' using errcode = '42501';
  end if;

  if p_action = 'day' then
    if day_from is null then raise exception 'Escolhe um dia.'; end if;
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', a.id, 'updated_at', a.updated_at, 'start_at', a.start_at, 'end_at', a.end_at, 'status', a.status,
      'mode', a.mode, 'procedure_type', case when a.mode <> 'bloqueio' then a.procedure_type end,
      'patient_name', case when a.mode <> 'bloqueio' then p.full_name end
    ) order by a.start_at, a.id), '[]'::jsonb) into result
    from public.appointments a left join public.patients p on p.id = a.patient_id
    where (a.clinic_id = clinic or (a.clinic_id is null and a.mode = 'bloqueio'))
      and a.start_at < ((day_from + 1)::timestamp at time zone 'Europe/Lisbon')
      and a.end_at > (day_from::timestamp at time zone 'Europe/Lisbon')
      and upper(coalesce(a.title, '')) <> 'SLOT';
    return result;
  end if;

  if p_action = 'patients' then
    if coalesce(length(term), 0) not between 3 and 100 then return '[]'::jsonb; end if;
    select coalesce(jsonb_agg(to_jsonb(matches)), '[]'::jsonb) into result from (
      select p.id, p.full_name, p.dob from public.patients p
      where p.is_active and strpos(lower(p.full_name), lower(term)) > 0
        and exists (select 1 from public.patient_clinic pc
          where pc.patient_id = p.id and pc.clinic_id = clinic and pc.is_active)
      order by p.full_name, p.id limit 20
    ) matches;
    return result;
  end if;

  if p_action <> 'save' or p_action is null then raise exception 'Operação inválida.'; end if;
  if starts is null or not isfinite(starts) or minutes is null or minutes not between 5 and 480 then
    raise exception 'Data, hora ou duração inválida.';
  end if;

  if booking is null then
    if procedure is null or length(procedure) not between 1 and 100 then
      raise exception 'Indica o tipo de consulta.';
    end if;
    select p.full_name into patient_name from public.patients p
    where p.id = patient and p.is_active and exists (
      select 1 from public.patient_clinic pc
      where pc.patient_id = p.id and pc.clinic_id = clinic and pc.is_active
    );
    if patient_name is null then raise exception 'Doente indisponível nesta clínica.' using errcode = '42501'; end if;
    if not exists (select 1 from public.clinic_members m where m.clinic_id = clinic
      and m.user_id = grant_row.provider_id and m.is_active and m.role in ('medico', 'super_admin')
    ) then raise exception 'O médico configurado deixou de estar disponível nesta clínica.'; end if;

    if request_id is null then raise exception 'Pedido de marcação inválido.'; end if;
    -- Serialize a retried request before INSERT, including before any existing INSERT trigger.
    perform pg_advisory_xact_lock(hashtextextended(request_id::text, 0));
    select a.* into existing from public.appointments a where a.id = request_id;
    if found then
      if existing.created_by is distinct from actor or existing.clinic_id is distinct from clinic
        or existing.patient_id is distinct from patient or existing.procedure_type is distinct from procedure
        or existing.start_at is distinct from starts
        or existing.end_at is distinct from starts + make_interval(mins => minutes)
      then raise exception 'Pedido de marcação indisponível.' using errcode = '42501'; end if;
      return jsonb_build_object('id', request_id);
    end if;
    insert into public.appointments (id, clinic_id, patient_id, provider_id, procedure_type, title, start_at, end_at)
    values (request_id, clinic, patient, grant_row.provider_id, procedure, patient_name || ' · ' || procedure,
      starts, starts + make_interval(mins => minutes))
    returning id into booking;
  else
    select a.* into existing from public.appointments a
    where a.id = booking and a.clinic_id = clinic and a.mode <> 'bloqueio' and a.patient_id is not null
      and upper(coalesce(a.title, '')) <> 'SLOT' for update;
    if existing.id is null then raise exception 'Marcação indisponível nesta clínica.' using errcode = '42501'; end if;
    if existing.updated_at is distinct from (p_args->>'updated_at')::timestamptz then
      raise exception 'A marcação foi alterada. Atualiza a agenda e tenta novamente.';
    end if;
    if not (existing.status in ('scheduled', 'confirmed', 'arrived', 'no_show', 'cancelled'))
      or state is null or state not in ('scheduled', 'confirmed', 'arrived', 'no_show', 'cancelled')
      or (state = 'confirmed' and existing.status <> 'confirmed')
    then raise exception 'Estado indisponível para edição no secretariado.'; end if;
    update public.appointments a
    set start_at = starts, end_at = starts + make_interval(mins => minutes), status = state,
        reschedule_count = a.reschedule_count + case when a.start_at <> starts then 1 else 0 end
    where a.id = existing.id;
  end if;
  return jsonb_build_object('id', booking);
end;
$$;

create function public.gc_secretariat_booking(p_action text, p_args jsonb default '{}'::jsonb)
returns jsonb language sql security invoker set search_path = '' as $$
  select gc_booking_private.dispatch(p_action, p_args);
$$;

revoke all on all tables in schema gc_booking_private from public, anon, authenticated;
revoke all on all functions in schema gc_booking_private from public, anon, authenticated;
revoke all on function public.gc_secretariat_booking(text, jsonb) from public, anon, authenticated;
grant execute on function gc_booking_private.dispatch(text, jsonb) to authenticated;
grant execute on function public.gc_secretariat_booking(text, jsonb) to authenticated;
