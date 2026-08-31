-- Termina o acesso público sem apagar o acompanhamento clínico.
create or replace function public.terminate_patient_portal_link(
  p_patient_id uuid,
  p_clinic_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link_id uuid;
begin
  if auth.uid() is null or not public.has_clinic_role(
    p_clinic_id, array['super_admin','admin','medico']::text[]
  ) then
    raise exception 'Sem permissão para terminar este acompanhamento';
  end if;

  if not exists (
    select 1
    from public.patient_clinic pc
    where pc.patient_id = p_patient_id
      and pc.clinic_id = p_clinic_id
      and pc.is_active = true
  ) then
    raise exception 'O doente não está associado a esta clínica';
  end if;

  select pl.id into v_link_id
  from public.patient_portal_links pl
  where pl.patient_id = p_patient_id
    and pl.created_clinic_id = p_clinic_id
    and pl.revoked_at is null
  for update;

  if v_link_id is null then
    return false;
  end if;

  update public.patient_portal_links
  set revoked_at = now(), revoked_by = auth.uid()
  where id = v_link_id;

  return true;
end;
$$;

revoke execute on function public.terminate_patient_portal_link(uuid, uuid)
  from public, anon;
grant execute on function public.terminate_patient_portal_link(uuid, uuid)
  to authenticated;

-- Inicia deliberadamente um novo acesso depois de um acompanhamento terminado.
-- Diário, Medicação e respetivos eventos mantêm-se associados ao novo acesso;
-- Exercício e Questionários já pertencem ao doente e à clínica.
create or replace function public.start_patient_portal_link(
  p_patient_id uuid,
  p_clinic_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_active_token text;
  v_old_link_id uuid;
  v_new_link_id uuid;
  v_token text;
begin
  if auth.uid() is null or not public.has_clinic_role(
    p_clinic_id, array['super_admin','admin','medico']::text[]
  ) then
    raise exception 'Sem permissão para iniciar este acompanhamento';
  end if;

  if not exists (
    select 1
    from public.patient_clinic pc
    where pc.patient_id = p_patient_id
      and pc.clinic_id = p_clinic_id
      and pc.is_active = true
  ) then
    raise exception 'O doente não está associado a esta clínica';
  end if;

  select pl.token into v_active_token
  from public.patient_portal_links pl
  where pl.patient_id = p_patient_id
    and pl.created_clinic_id = p_clinic_id
    and pl.revoked_at is null;

  if v_active_token is not null then
    return v_active_token;
  end if;

  select pl.id into v_old_link_id
  from public.patient_portal_links pl
  where pl.patient_id = p_patient_id
    and pl.created_clinic_id = p_clinic_id
  order by pl.created_at desc
  limit 1
  for update;

  v_token := encode(extensions.gen_random_bytes(18), 'hex');
  insert into public.patient_portal_links (
    patient_id, token, created_by, created_clinic_id
  ) values (
    p_patient_id, v_token, auth.uid(), p_clinic_id
  )
  returning id into v_new_link_id;

  if v_old_link_id is not null then
    update public.patient_diary_tokens
    set link_id = v_new_link_id
    where link_id = v_old_link_id
      and patient_id = p_patient_id
      and clinic_id = p_clinic_id;

    update public.patient_medication
    set link_id = v_new_link_id,
        updated_at = now(),
        updated_by = auth.uid()
    where link_id = v_old_link_id
      and clinic_id = p_clinic_id;
  end if;

  return v_token;
end;
$$;

revoke execute on function public.start_patient_portal_link(uuid, uuid)
  from public, anon;
grant execute on function public.start_patient_portal_link(uuid, uuid)
  to authenticated;
