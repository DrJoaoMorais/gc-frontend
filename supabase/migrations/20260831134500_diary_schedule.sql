-- Data clínica do episódio, separada da data técnica em que foi criado.
alter table public.patient_diary_tokens
  add column if not exists starts_at timestamptz;

update public.patient_diary_tokens
set starts_at = created_at
where starts_at is null;

alter table public.patient_diary_tokens
  alter column starts_at set default now(),
  alter column starts_at set not null;

-- Mantém o mesmo episódio e os registos existentes quando apenas se muda o período.
create or replace function public.set_diary_episode_period(
  p_patient_id uuid,
  p_clinic_id uuid,
  p_start_date date,
  p_duration_days integer default 15
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link_id uuid;
  v_link_token text;
  v_diary_id uuid;
  v_diary_token text;
  v_duration integer := greatest(1, least(coalesce(p_duration_days, 15), 365));
  v_starts_at timestamptz := (coalesce(p_start_date, current_date)::timestamp at time zone 'Europe/Lisbon');
begin
  if auth.uid() is null or not public.has_clinic_role(
    p_clinic_id, array['super_admin','admin','medico','administrativo']::text[]
  ) then
    raise exception 'Sem permissão para iniciar o Diário';
  end if;
  if not exists (
    select 1 from public.patient_clinic pc
    where pc.patient_id = p_patient_id and pc.clinic_id = p_clinic_id and pc.is_active = true
  ) then
    raise exception 'O doente não está associado a esta clínica';
  end if;

  select id, token into v_link_id, v_link_token
  from public.patient_portal_links
  where patient_id = p_patient_id and created_clinic_id = p_clinic_id and revoked_at is null;

  if v_link_id is null then
    v_link_token := encode(extensions.gen_random_bytes(18), 'hex');
    insert into public.patient_portal_links (patient_id, token, created_by, created_clinic_id)
    values (p_patient_id, v_link_token, auth.uid(), p_clinic_id)
    returning id into v_link_id;
  end if;

  select id, token into v_diary_id, v_diary_token
  from public.patient_diary_tokens
  where patient_id = p_patient_id and clinic_id = p_clinic_id and status = 'active'
  order by created_at desc limit 1;

  if v_diary_id is not null then
    update public.patient_diary_tokens
    set starts_at = v_starts_at,
        expires_at = v_starts_at + make_interval(days => v_duration),
        duration_days = v_duration
    where id = v_diary_id;
  else
    v_diary_token := encode(extensions.gen_random_bytes(18), 'hex');
    insert into public.patient_diary_tokens (
      token, patient_id, clinic_id, created_by, created_at, starts_at, expires_at,
      duration_days, status, link_id
    ) values (
      v_diary_token, p_patient_id, p_clinic_id, auth.uid(), now(), v_starts_at,
      v_starts_at + make_interval(days => v_duration), v_duration, 'active', v_link_id
    );
  end if;

  return v_link_token;
end;
$$;

revoke execute on function public.set_diary_episode_period(uuid, uuid, date, integer) from public, anon;
grant execute on function public.set_diary_episode_period(uuid, uuid, date, integer) to authenticated;

create or replace function public.get_diary_episode(p_token text)
returns table(
  valid boolean, first_name text, started_at timestamptz, expires_at timestamptz,
  duration_days integer, med_nome text, med_dose text, med_freq text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  select true, split_part(p.full_name, ' ', 1), t.starts_at, t.expires_at,
         t.duration_days, t.med_nome, t.med_dose, t.med_freq
  from public.patient_diary_tokens t
  join public.patients p on p.id = t.patient_id
  where t.token = p_token and t.status = 'active'
    and t.starts_at <= now() and t.expires_at > now();

  if not found then
    return query select false, null::text, null::timestamptz, null::timestamptz,
      null::integer, null::text, null::text, null::text;
  end if;
end;
$$;

revoke execute on function public.get_diary_episode(text) from public, authenticated;
grant execute on function public.get_diary_episode(text) to anon;

create or replace function public.get_acompanhamento_home(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link record;
  v_diary record;
  v_result jsonb;
begin
  select pl.id, pl.patient_id, pl.created_clinic_id, pl.revoked_at into v_link
  from public.patient_portal_links pl where pl.token = p_token;
  if not found then
    select pl.id, pl.patient_id, pl.created_clinic_id, pl.revoked_at into v_link
    from public.patient_portal_link_aliases a
    join public.patient_portal_links pl on pl.id = a.link_id
    where a.old_token = p_token;
  end if;
  if not found or v_link.revoked_at is not null then
    return jsonb_build_object('valid', false);
  end if;

  select t.token, t.expires_at, t.starts_at, t.duration_days into v_diary
  from public.patient_diary_tokens t
  where t.patient_id = v_link.patient_id and t.clinic_id = v_link.created_clinic_id
    and t.status = 'active' and t.starts_at <= now() and t.expires_at > now()
  order by t.starts_at desc limit 1;

  select jsonb_build_object(
    'valid', true,
    'first_name', split_part(p.full_name, ' ', 1),
    'diario', case when v_diary.expires_at is not null then jsonb_build_object(
      'enabled', true, 'episode_token', v_diary.token,
      'started_at', v_diary.starts_at, 'expires_at', v_diary.expires_at,
      'duration_days', v_diary.duration_days
    ) else jsonb_build_object('enabled', false) end,
    'exercicio', coalesce((
      select jsonb_build_object('enabled', true, 'expires_at', pr.expires_at)
      from public.wo_prescriptions pr
      where pr.patient_id = v_link.patient_id and pr.clinic_id = v_link.created_clinic_id
        and pr.status = 'active' and pr.expires_at > now()
      order by pr.created_at desc limit 1
    ), jsonb_build_object('enabled', false)),
    'medicacao', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', m.id, 'nome', m.nome, 'dose', m.dose, 'freq', m.freq, 'periodicidade', m.periodicidade
      )), '[]'::jsonb)
      from public.patient_medication m
      where m.link_id = v_link.id and m.enabled = true
        and (m.data_fim is null or m.data_fim >= current_date)
    ),
    'questionario', coalesce((
      select jsonb_build_object('pending', true, 'status', it.status,
        'questionnaire_type', it.questionnaire_type, 'token', it.token)
      from public.intake_tokens it
      where it.patient_id = v_link.patient_id and it.clinic_id = v_link.created_clinic_id
        and it.status in ('pending_rgpd','in_progress') and it.expires_at > now()
      order by it.created_at desc limit 1
    ), jsonb_build_object('pending', false))
  ) into v_result
  from public.patients p where p.id = v_link.patient_id;

  return coalesce(v_result, jsonb_build_object('valid', false));
end;
$$;

revoke execute on function public.get_acompanhamento_home(text) from public, authenticated;
grant execute on function public.get_acompanhamento_home(text) to anon;
