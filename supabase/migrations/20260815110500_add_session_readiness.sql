-- Avaliação breve imediatamente antes do treino.
-- Fica separada do registo final porque pode existir mesmo quando a sessão não é concluída.

create table if not exists public.wo_session_readiness (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references public.wo_prescriptions(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  session_id text not null,
  session_date date not null,
  feeling smallint not null check (feeling between 1 and 5),
  has_symptoms boolean not null,
  symptom_note text,
  answered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint wo_session_readiness_session_unique unique (prescription_id, session_id),
  constraint wo_session_readiness_symptom_note_check check (
    (has_symptoms and nullif(btrim(coalesce(symptom_note, '')), '') is not null)
    or
    (not has_symptoms and symptom_note is null)
  )
);

comment on table public.wo_session_readiness is
  'Duas respostas dadas pelo doente imediatamente antes da sessão; não autorizam, adaptam ou impedem automaticamente o treino.';
comment on column public.wo_session_readiness.feeling is
  '1 Muito mal, 2 Mal, 3 Razoável, 4 Bem, 5 Muito bem.';

create index if not exists wo_session_readiness_prescription_date_idx
  on public.wo_session_readiness (prescription_id, session_date desc);

alter table public.wo_session_readiness enable row level security;

revoke all on table public.wo_session_readiness from anon, authenticated;
grant select on table public.wo_session_readiness to authenticated;

drop policy if exists wo_session_readiness_select on public.wo_session_readiness;
create policy wo_session_readiness_select
  on public.wo_session_readiness
  for select
  to authenticated
  using (public.is_clinic_member(clinic_id));

create or replace function public.wo_log_readiness(
  p_token text,
  p_session_id text,
  p_feeling smallint,
  p_has_symptoms boolean,
  p_symptom_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_presc record;
  v_session_date date;
  v_id uuid;
begin
  if p_token is null or length(btrim(p_token)) < 8 then
    return jsonb_build_object('ok', false, 'reason', 'token_invalido');
  end if;

  select id, patient_id, clinic_id, expires_at, status, data
    into v_presc
    from public.wo_prescriptions
   where token = p_token;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'nao_encontrado');
  end if;

  if v_presc.status <> 'active' or v_presc.expires_at <= now() then
    return jsonb_build_object('ok', false, 'reason', 'expirado');
  end if;

  if p_session_id is null or btrim(p_session_id) = '' then
    return jsonb_build_object('ok', false, 'reason', 'sessao_invalida');
  end if;

  if p_feeling is null or p_feeling < 1 or p_feeling > 5 then
    return jsonb_build_object('ok', false, 'reason', 'estado_invalido');
  end if;

  if p_has_symptoms is null then
    return jsonb_build_object('ok', false, 'reason', 'sintomas_em_falta');
  end if;

  if p_has_symptoms and nullif(btrim(coalesce(p_symptom_note, '')), '') is null then
    return jsonb_build_object('ok', false, 'reason', 'descricao_em_falta');
  end if;

  select (s.value ->> 'date')::date
    into v_session_date
    from jsonb_array_elements(coalesce(v_presc.data -> 'sessions', '[]'::jsonb)) as s(value)
   where s.value ->> 'session_id' = btrim(p_session_id)
   limit 1;

  if v_session_date is null then
    return jsonb_build_object('ok', false, 'reason', 'sessao_nao_encontrada');
  end if;

  if v_session_date <> (now() at time zone 'Europe/Lisbon')::date then
    return jsonb_build_object('ok', false, 'reason', 'fora_do_dia_da_sessao');
  end if;

  insert into public.wo_session_readiness
    (prescription_id, patient_id, clinic_id, session_id, session_date,
     feeling, has_symptoms, symptom_note)
  values
    (v_presc.id, v_presc.patient_id, v_presc.clinic_id, btrim(p_session_id),
     v_session_date, p_feeling, p_has_symptoms,
     case when p_has_symptoms then btrim(p_symptom_note) else null end)
  on conflict (prescription_id, session_id) do update
    set session_date = excluded.session_date,
        feeling = excluded.feeling,
        has_symptoms = excluded.has_symptoms,
        symptom_note = excluded.symptom_note,
        answered_at = now()
  returning id into v_id;

  return jsonb_build_object(
    'ok', true,
    'id', v_id,
    'answered_at', now()
  );
end;
$function$;

revoke all on function public.wo_log_readiness(text, text, smallint, boolean, text) from public;
grant execute on function public.wo_log_readiness(text, text, smallint, boolean, text) to anon, authenticated;

create or replace function public.wo_get_plan(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_presc record;
  v_logs jsonb;
  v_readiness jsonb;
begin
  if p_token is null or length(btrim(p_token)) < 8 then
    return jsonb_build_object('ok', false, 'reason', 'token_invalido');
  end if;

  select id, data, expires_at, status, created_at
    into v_presc
    from public.wo_prescriptions
   where token = p_token;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'nao_encontrado');
  end if;

  if v_presc.status <> 'active' then
    return jsonb_build_object('ok', false, 'reason', 'revogado');
  end if;

  if v_presc.expires_at <= now() then
    return jsonb_build_object('ok', false, 'reason', 'expirado',
                              'expires_at', v_presc.expires_at);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'session_id', l.session_id,
           'logged_at', l.logged_at,
           'rpe', l.rpe,
           'feel', l.feel,
           'sets', l.sets,
           'note', l.note
         ) order by l.logged_at), '[]'::jsonb)
    into v_logs
    from public.wo_session_logs l
   where l.prescription_id = v_presc.id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'session_id', r.session_id,
           'session_date', r.session_date,
           'feeling', r.feeling,
           'has_symptoms', r.has_symptoms,
           'symptom_note', r.symptom_note,
           'answered_at', r.answered_at
         ) order by r.answered_at), '[]'::jsonb)
    into v_readiness
    from public.wo_session_readiness r
   where r.prescription_id = v_presc.id;

  return jsonb_build_object(
    'ok', true,
    'plan', v_presc.data,
    'starts_at', v_presc.created_at,
    'expires_at', v_presc.expires_at,
    'logs', v_logs,
    'readiness', v_readiness
  );
end;
$function$;

revoke all on function public.wo_get_plan(text) from public;
grant execute on function public.wo_get_plan(text) to anon, authenticated;
