alter table public.patient_diary_tokens
  add column if not exists duration_days integer not null default 15;

alter table public.patient_diary_tokens
  drop constraint if exists patient_diary_tokens_duration_days_check;

alter table public.patient_diary_tokens
  add constraint patient_diary_tokens_duration_days_check
  check (duration_days between 1 and 365);

drop function if exists public.generate_diary_token(uuid, uuid, text, text, text);

create function public.generate_diary_token(
  p_patient_id uuid,
  p_clinic_id uuid,
  p_med_nome text default null,
  p_med_dose text default null,
  p_med_freq text default null,
  p_duration_days integer default 15
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
  v_duration integer := greatest(1, least(coalesce(p_duration_days, 15), 365));
begin
  if auth.uid() is null or not public.has_clinic_role(
    p_clinic_id,
    array['super_admin', 'admin', 'medico', 'administrativo']::text[]
  ) then
    raise exception 'Sem permissão para criar este acompanhamento';
  end if;

  select t.token into v_token
  from public.patient_diary_tokens t
  where t.patient_id = p_patient_id
    and t.clinic_id = p_clinic_id
  order by t.created_at desc
  limit 1;

  if v_token is null then
    v_token := encode(extensions.gen_random_bytes(18), 'hex');
    insert into public.patient_diary_tokens (
      token, patient_id, clinic_id, created_by, created_at, expires_at,
      duration_days, status, med_nome, med_dose, med_freq
    ) values (
      v_token, p_patient_id, p_clinic_id, auth.uid(), now(),
      now() + make_interval(days => v_duration), v_duration, 'active',
      p_med_nome, p_med_dose, p_med_freq
    );
  else
    update public.patient_diary_tokens
    set created_by = auth.uid(),
        created_at = now(),
        expires_at = now() + make_interval(days => v_duration),
        duration_days = v_duration,
        status = 'active',
        med_nome = p_med_nome,
        med_dose = p_med_dose,
        med_freq = p_med_freq
    where token = v_token;
  end if;

  update public.patient_diary_tokens
  set status = 'revoked'
  where patient_id = p_patient_id
    and clinic_id = p_clinic_id
    and token <> v_token
    and status = 'active';

  return v_token;
end;
$$;

create or replace function public.get_diary_episode(p_token text)
returns table(
  valid boolean,
  first_name text,
  started_at timestamptz,
  expires_at timestamptz,
  duration_days integer,
  med_nome text,
  med_dose text,
  med_freq text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  select true, split_part(p.full_name, ' ', 1), t.created_at, t.expires_at,
         t.duration_days, t.med_nome, t.med_dose, t.med_freq
  from public.patient_diary_tokens t
  join public.patients p on p.id = t.patient_id
  where t.token = p_token and t.status = 'active' and t.expires_at > now();

  if not found then
    return query select false, null::text, null::timestamptz, null::timestamptz,
      null::integer, null::text, null::text, null::text;
  end if;
end;
$$;

create or replace function public.end_diary_episode(p_patient_id uuid, p_clinic_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.has_clinic_role(
    p_clinic_id,
    array['super_admin', 'admin', 'medico', 'administrativo']::text[]
  ) then
    raise exception 'Sem permissão para terminar este acompanhamento';
  end if;

  update public.patient_diary_tokens
  set status = 'revoked', expires_at = least(expires_at, now())
  where patient_id = p_patient_id and clinic_id = p_clinic_id and status = 'active';
end;
$$;

revoke execute on function public.generate_diary_token(uuid, uuid, text, text, text, integer) from public, anon;
grant execute on function public.generate_diary_token(uuid, uuid, text, text, text, integer) to authenticated;
revoke execute on function public.get_diary_episode(text) from public, authenticated;
grant execute on function public.get_diary_episode(text) to anon;
revoke execute on function public.end_diary_episode(uuid, uuid) from public, anon;
grant execute on function public.end_diary_episode(uuid, uuid) to authenticated;
