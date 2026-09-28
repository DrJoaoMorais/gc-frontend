-- Link availability is independent of clinical prescriptions and their history.
alter table public.patient_portal_links add column if not exists access_expires_at timestamptz;
alter table public.patient_portal_links add column if not exists access_modules jsonb not null default '{}'::jsonb;
create or replace function public.set_patient_portal_access(p_patient_id uuid,p_clinic_id uuid,p_expires_at timestamptz,p_modules jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb;
begin
 if auth.uid() is null or not public.has_clinic_role(p_clinic_id,array['super_admin','admin','medico']::text[]) then raise exception 'Sem permissão'; end if;
 if not exists(select 1 from public.patient_clinic where patient_id=p_patient_id and clinic_id=p_clinic_id and is_active) then raise exception 'Doente fora da clínica'; end if;
 if p_modules is null or jsonb_typeof(p_modules)<>'object' then raise exception 'Módulos inválidos'; end if;
 if exists(select 1 from jsonb_each(p_modules) where key not in ('diary','activity','pathology','med','question') or jsonb_typeof(value)<>'boolean') then raise exception 'Módulos inválidos'; end if;
 update public.patient_portal_links set access_expires_at=p_expires_at,access_modules=access_modules||p_modules
 where patient_id=p_patient_id and created_clinic_id=p_clinic_id and revoked_at is null
 returning jsonb_build_object('access_expires_at',access_expires_at,'access_modules',access_modules) into v_result;
 if v_result is null then raise exception 'Ligação indisponível'; end if;
 return v_result;
end $$;
revoke all on function public.set_patient_portal_access(uuid,uuid,timestamptz,jsonb) from public,anon;
grant execute on function public.set_patient_portal_access(uuid,uuid,timestamptz,jsonb) to authenticated;
create or replace function public.patient_portal_allows(p_token text,p_module text default null)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.patient_portal_links pl where
 (pl.token=p_token or exists(select 1 from public.patient_portal_link_aliases a where a.link_id=pl.id and a.old_token=p_token))
 and pl.revoked_at is null and (pl.access_expires_at is null or pl.access_expires_at>now())
 and (p_module is null or coalesce((pl.access_modules->>p_module)::boolean,true)));
$$;
revoke all on function public.patient_portal_allows(text,text) from public,anon,authenticated;

CREATE OR REPLACE FUNCTION public.get_acompanhamento_home(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_link record;
  v_diary record;
  v_result jsonb;
begin
  if not public.patient_portal_allows(p_token,null) then return jsonb_build_object('valid',false,'ok',false,'authorized',false,'reason','ligacao_indisponivel'); end if;
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

  if not public.patient_portal_allows(p_token,'diary') then v_result=jsonb_set(v_result,'{diario}','{"enabled":false}'::jsonb); end if;
  if not public.patient_portal_allows(p_token,'med') then v_result=jsonb_set(v_result,'{medicacao}','[]'::jsonb); end if;
  if not public.patient_portal_allows(p_token,'question') then v_result=jsonb_set(v_result,'{questionario}','{"pending":false}'::jsonb); end if;
  if not public.patient_portal_allows(p_token,'activity') and not public.patient_portal_allows(p_token,'pathology') then v_result=jsonb_set(v_result,'{exercicio}','{"enabled":false}'::jsonb); end if;
  return coalesce(v_result, jsonb_build_object('valid', false));
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_acompanhamento_questionario(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_patient_id uuid;
  v_clinic_id uuid;
  v_it record;
begin
  if not public.patient_portal_allows(p_token,'question') then return jsonb_build_object('valid',false,'ok',false,'authorized',false,'reason','ligacao_indisponivel'); end if;
  select pl.patient_id, pl.created_clinic_id into v_patient_id, v_clinic_id from public.patient_portal_links pl
    where pl.token = p_token and pl.revoked_at is null;
  if not found then
    select pl.patient_id, pl.created_clinic_id into v_patient_id, v_clinic_id
      from public.patient_portal_link_aliases a
      join public.patient_portal_links pl on pl.id = a.link_id
      where a.old_token = p_token and pl.revoked_at is null;
  end if;
  if not found then return jsonb_build_object('ok', false); end if;

  select token, status, questionnaire_type into v_it
    from public.intake_tokens
    where patient_id = v_patient_id
      and clinic_id = v_clinic_id
      and status in ('pending_rgpd','in_progress')
      and expires_at > now()
    order by created_at desc limit 1;
  if not found then return jsonb_build_object('ok', true, 'pending', false); end if;

  return jsonb_build_object('ok', true, 'pending', true, 'status', v_it.status,
    'questionnaire_type', v_it.questionnaire_type, 'token', v_it.token);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_acompanhamento_exercise(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_patient_id uuid;
  v_clinic_id uuid;
  v_presc record;
begin
  if not public.patient_portal_allows(p_token,null) then return jsonb_build_object('valid',false,'ok',false,'authorized',false,'reason','ligacao_indisponivel'); end if;
  select pl.patient_id, pl.created_clinic_id
  into v_patient_id, v_clinic_id
  from public.patient_portal_links pl
  where pl.token = p_token and pl.revoked_at is null;

  if not found then
    select pl.patient_id, pl.created_clinic_id
    into v_patient_id, v_clinic_id
    from public.patient_portal_link_aliases a
    join public.patient_portal_links pl on pl.id = a.link_id
    where a.old_token = p_token and pl.revoked_at is null;
  end if;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'token_invalido');
  end if;

  select id, token, data, expires_at, content_version, published_at, clinic_id
  into v_presc
  from public.wo_prescriptions
  where patient_id = v_patient_id
    and clinic_id = v_clinic_id
    and status = 'active'
    and expires_at > now()
  order by created_at desc
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'sem_plano');
  end if;

  v_presc.data := jsonb_set(v_presc.data,'{sessions}',coalesce((select jsonb_agg(s order by ord) from jsonb_array_elements(coalesce(v_presc.data->'sessions','[]'::jsonb)) with ordinality as entries(s,ord)
  where public.patient_portal_allows(p_token,case when coalesce(s->>'notes','') like 'Origem:%' then 'pathology' else 'activity' end)),'[]'::jsonb));
  if jsonb_array_length(v_presc.data->'sessions')=0 then return jsonb_build_object('ok',false,'reason','sem_plano'); end if;
  update public.wo_prescriptions
  set last_opened_version = content_version,
      last_opened_at = now()
  where id = v_presc.id;

  return jsonb_build_object(
    'ok', true,
    'plan', v_presc.data,
    'plan_token', v_presc.token,
    'expires_at', v_presc.expires_at,
    'content_version', v_presc.content_version,
    'published_at', v_presc.published_at,
    'clinic_name', (
      select c.name from public.clinics c where c.id = v_presc.clinic_id
    )
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.authorize_patient_portal_device(p_token text, p_device_secret text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_link_id uuid;
  v_patient_id uuid;
  v_hash text;
  v_bound_at timestamptz;
  v_patient_name text;
begin
  if not public.patient_portal_allows(p_token,null) then return jsonb_build_object('valid',false,'ok',false,'authorized',false,'reason','ligacao_indisponivel'); end if;
  if p_token is null or length(p_token) < 20
     or p_device_secret is null or length(p_device_secret) < 32 then
    return jsonb_build_object('authorized', false, 'reason', 'dados_invalidos');
  end if;

  select pl.id, pl.patient_id
    into v_link_id, v_patient_id
  from public.patient_portal_links pl
  where pl.token = p_token and pl.revoked_at is null;

  if not found then
    select pl.id, pl.patient_id
      into v_link_id, v_patient_id
    from public.patient_portal_link_aliases a
    join public.patient_portal_links pl on pl.id = a.link_id
    where a.old_token = p_token and pl.revoked_at is null;
  end if;

  if not found then
    return jsonb_build_object('authorized', false, 'reason', 'ligacao_invalida');
  end if;

  v_hash := encode(extensions.digest(p_device_secret, 'sha256'), 'hex');

  update public.patient_portal_links
  set device_key_hash = coalesce(device_key_hash, v_hash),
      device_bound_at = coalesce(device_bound_at, now()),
      last_opened_at = now()
  where id = v_link_id
    and (device_key_hash is null or device_key_hash = v_hash)
  returning device_bound_at into v_bound_at;

  if not found then
    return jsonb_build_object('authorized', false, 'reason', 'outro_dispositivo');
  end if;

  select p.full_name into v_patient_name
  from public.patients p where p.id = v_patient_id;

  return jsonb_build_object(
    'authorized', true,
    'patient_name', v_patient_name,
    'device_bound_at', v_bound_at
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_acompanhamento_medication_events(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_link_id uuid;
begin
  if not public.patient_portal_allows(p_token,'med') then return '[]'::jsonb; end if;
  select pl.id into v_link_id
  from public.patient_portal_links pl
  where pl.token = p_token and pl.revoked_at is null;

  if v_link_id is null then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', e.id,
      'date', e.event_date,
      'type', e.event_type,
      'medication', m.nome,
      'dose', coalesce(e.dose, m.dose),
      'instructions', e.instructions
    ) order by e.event_date, e.created_at)
    from public.patient_medication_events e
    join public.patient_medication m on m.id = e.medication_id
    where m.link_id = v_link_id
      and m.enabled = true
      and e.status = 'planned'
      and e.event_date >= current_date - 14
  ), '[]'::jsonb);
end;
$function$
;
