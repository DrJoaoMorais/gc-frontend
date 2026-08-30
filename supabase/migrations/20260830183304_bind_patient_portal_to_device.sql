-- Associa a ligação permanente ao primeiro navegador autorizado.
-- A chave do navegador nunca é guardada: apenas o respetivo hash SHA-256.

alter table public.patient_portal_links
  add column if not exists device_key_hash text,
  add column if not exists device_bound_at timestamptz,
  add column if not exists last_opened_at timestamptz;

create or replace function public.authorize_patient_portal_device(
  p_token text,
  p_device_secret text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link_id uuid;
  v_patient_id uuid;
  v_hash text;
  v_bound_at timestamptz;
  v_patient_name text;
begin
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
$$;

revoke execute on function public.authorize_patient_portal_device(text, text)
  from public, authenticated;
grant execute on function public.authorize_patient_portal_device(text, text) to anon;

create or replace function public.reset_patient_portal_device(
  p_patient_id uuid,
  p_clinic_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.has_clinic_role(
    p_clinic_id, array['super_admin','admin','medico','administrativo']::text[]
  ) then
    raise exception 'Sem permissão para autorizar outro dispositivo';
  end if;

  update public.patient_portal_links
  set device_key_hash = null,
      device_bound_at = null,
      last_opened_at = null
  where patient_id = p_patient_id
    and created_clinic_id = p_clinic_id
    and revoked_at is null;

  return found;
end;
$$;

revoke execute on function public.reset_patient_portal_device(uuid, uuid)
  from public, anon;
grant execute on function public.reset_patient_portal_device(uuid, uuid) to authenticated;

create or replace function public.rotate_patient_portal_link(
  p_patient_id uuid,
  p_clinic_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  if auth.uid() is null or not public.has_clinic_role(
    p_clinic_id, array['super_admin','admin','medico']::text[]
  ) then
    raise exception 'Sem permissão para substituir esta ligação';
  end if;

  if not exists (
    select 1 from public.patient_clinic pc
    where pc.patient_id = p_patient_id
      and pc.clinic_id = p_clinic_id
      and pc.is_active = true
  ) then
    raise exception 'O doente não está associado a esta clínica';
  end if;

  update public.patient_portal_links
  set revoked_at = now(), revoked_by = auth.uid()
  where patient_id = p_patient_id
    and created_clinic_id = p_clinic_id
    and revoked_at is null;

  v_token := encode(extensions.gen_random_bytes(18), 'hex');
  insert into public.patient_portal_links (
    patient_id, token, created_by, created_clinic_id
  ) values (
    p_patient_id, v_token, auth.uid(), p_clinic_id
  );

  return v_token;
end;
$$;

revoke execute on function public.rotate_patient_portal_link(uuid, uuid)
  from public, anon;
grant execute on function public.rotate_patient_portal_link(uuid, uuid) to authenticated;
