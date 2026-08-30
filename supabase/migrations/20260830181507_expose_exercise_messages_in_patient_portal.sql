-- Permite à ligação única reutilizar o sistema de mensagens que já existe
-- no portal de treino. Não cria tabelas nem duplica mensagens.

create or replace function public.get_acompanhamento_exercise(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_patient_id uuid;
  v_clinic_id uuid;
  v_presc record;
begin
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
$$;

revoke execute on function public.get_acompanhamento_exercise(text) from public, authenticated;
grant execute on function public.get_acompanhamento_exercise(text) to anon;
