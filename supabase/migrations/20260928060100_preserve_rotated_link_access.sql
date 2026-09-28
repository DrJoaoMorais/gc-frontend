CREATE OR REPLACE FUNCTION public.rotate_patient_portal_link(p_patient_id uuid, p_clinic_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_old_link_id uuid;
  v_new_link_id uuid;
  v_token text;
begin
  if auth.uid() is null or not public.has_clinic_role(
    p_clinic_id, array['super_admin','admin','medico']::text[]
  ) then
    raise exception 'Sem permissão para substituir esta ligação';
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

  select pl.id into v_old_link_id
  from public.patient_portal_links pl
  where pl.patient_id = p_patient_id
    and pl.created_clinic_id = p_clinic_id
    and pl.revoked_at is null
  for update;

  if v_old_link_id is null then
    raise exception 'Não existe uma ligação ativa para substituir';
  end if;

  update public.patient_portal_links
  set revoked_at = now(), revoked_by = auth.uid()
  where id = v_old_link_id;

  v_token := encode(extensions.gen_random_bytes(18), 'hex');
  insert into public.patient_portal_links (
    patient_id, token, created_by, created_clinic_id
  ) values (
    p_patient_id, v_token, auth.uid(), p_clinic_id
  )
  returning id into v_new_link_id;

  update public.patient_portal_links target
  set access_expires_at=source.access_expires_at, access_modules=source.access_modules
  from public.patient_portal_links source
  where target.id=v_new_link_id and source.id=v_old_link_id;

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

  return v_token;
end;
$function$;
