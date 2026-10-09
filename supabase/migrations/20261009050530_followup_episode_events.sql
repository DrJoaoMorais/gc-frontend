-- Preparação local. Não modifica planos, respostas, alertas ou ligações.
-- A revisão de uma pendência histórica continua ligada ao episódio original.
alter table public.wo_followup_events add column episode_id uuid;
alter table public.wo_followup_events add constraint wo_followup_review_episode_kind check (episode_id is null or kind='review');
-- Decisões append-only: cada episódio conserva todos os seus estados.
create table public.wo_followup_episode_events (
 id uuid primary key default gen_random_uuid(),
 episode_id uuid not null,
 patient_id uuid not null references public.patients(id),
 clinic_id uuid not null references public.clinics(id),
 state text not null check (state in ('active','completed','interrupted','archived')),
 interruption_kind text check (interruption_kind in ('abandonment','suspension')),
 is_test boolean not null default false,
 reason text not null check (length(trim(reason))>0),
 started_at timestamptz,
 closed_at timestamptz,
 prescription_ids uuid[] not null default '{}',
 questionnaire_ids uuid[] not null default '{}',
 created_at timestamptz not null default clock_timestamp(),
 created_by uuid not null default auth.uid() references auth.users(id),
 check ((state='active' and closed_at is null) or (state<>'active' and closed_at is not null)),
 check (started_at is null or closed_at is null or closed_at>=started_at),
 check ((state='interrupted' and interruption_kind is not null) or state<>'interrupted'),
 check (not is_test or state='archived')
);
create index wo_followup_episode_events_scope on public.wo_followup_episode_events(patient_id,clinic_id,created_at desc,id desc);
create index wo_followup_episode_events_episode on public.wo_followup_episode_events(episode_id,created_at desc,id desc);
alter table public.wo_followup_episode_events enable row level security;
revoke all on public.wo_followup_episode_events from public,anon,authenticated;
grant select,insert on public.wo_followup_episode_events to authenticated;
create policy followup_episode_owner_read on public.wo_followup_episode_events for select to authenticated
using ((select auth.uid())='32a24abe-cd69-42d9-bf3a-3355f4f6e28c'::uuid);
create policy followup_episode_owner_insert on public.wo_followup_episode_events for insert to authenticated
with check ((select auth.uid())='32a24abe-cd69-42d9-bf3a-3355f4f6e28c'::uuid and created_by=(select auth.uid())
 and exists(select 1 from public.patient_clinic pc where pc.patient_id=wo_followup_episode_events.patient_id and pc.clinic_id=wo_followup_episode_events.clinic_id));

create function public.record_followup_episode_decision(
 p_patient_id uuid,p_clinic_id uuid,p_episode_id uuid,p_expected_event_id uuid,
 p_action text,p_reason text,p_interruption_kind text default null,
 p_is_test boolean default false,p_closed_date date default null
) returns uuid language plpgsql security invoker set search_path='' as $$
declare
 previous public.wo_followup_episode_events%rowtype;
 legacy public.wo_followup_events%rowtype;
 new_id uuid; target_episode uuid; cut timestamptz; decision_time timestamptz:=clock_timestamp();
 rx_ids uuid[]; qs_ids uuid[]; next_state text;
begin
 if auth.uid() is distinct from '32a24abe-cd69-42d9-bf3a-3355f4f6e28c'::uuid
 or not exists(select 1 from public.patient_clinic where patient_id=p_patient_id and clinic_id=p_clinic_id) then
  raise exception 'Acesso recusado' using errcode='42501';
 end if;
 if p_action not in ('start','completed','interrupted','archived') or p_action is null or length(trim(coalesce(p_reason,'')))=0 then
  raise exception 'A decisão e o motivo são obrigatórios';
 end if;
 -- Serializa decisões do mesmo doente/clínica, incluindo a primeira importação.
 perform pg_advisory_xact_lock(hashtextextended(p_patient_id::text||':'||p_clinic_id::text,0));
 decision_time:=clock_timestamp();
 if p_episode_id is not null then
  select * into previous from public.wo_followup_episode_events
   where episode_id=p_episode_id and patient_id=p_patient_id and clinic_id=p_clinic_id
   order by created_at desc,id desc limit 1;
  if previous.id is null or previous.id is distinct from p_expected_event_id then
   raise exception 'O episódio foi alterado. Atualize a lista.';
  end if;
 elsif p_expected_event_id is not null or exists(select 1 from public.wo_followup_episode_events where patient_id=p_patient_id and clinic_id=p_clinic_id) then
  raise exception 'O episódio foi alterado. Atualize a lista.';
 else
  select * into legacy from public.wo_followup_events where patient_id=p_patient_id and clinic_id=p_clinic_id and kind='state' order by created_at desc,id desc limit 1;
 end if;
 if p_action='start' then
  if exists(select 1 from (select distinct on(episode_id) state from public.wo_followup_episode_events where patient_id=p_patient_id and clinic_id=p_clinic_id order by episode_id,created_at desc,id desc) e where state='active')
   or (previous.id is null and coalesce(legacy.state,'auto')='auto') then
   raise exception 'Já existe um episódio em curso';
  end if;
  -- Converte apenas o estado legado confirmado, sem inventar data de início.
  if previous.id is null then
   select coalesce(array_agg(id),'{}'::uuid[]) into rx_ids from public.wo_prescriptions where patient_id=p_patient_id and clinic_id=p_clinic_id and created_at<=legacy.created_at;
   select coalesce(array_agg(id),'{}'::uuid[]) into qs_ids from public.intake_tokens where patient_id=p_patient_id and clinic_id=p_clinic_id and created_at<=legacy.created_at and questionnaire_type ~ '^pre_consulta_v[0-9]+$';
   insert into public.wo_followup_episode_events(episode_id,patient_id,clinic_id,state,interruption_kind,reason,closed_at,prescription_ids,questionnaire_ids)
   values(gen_random_uuid(),p_patient_id,p_clinic_id,case when legacy.state='completed' then 'completed' else 'interrupted' end,case when legacy.state='abandoned' then 'abandonment' when legacy.state='paused' then 'suspension' end,coalesce(nullif(legacy.reason,''),'Estado anterior confirmado'),legacy.created_at,rx_ids,qs_ids);
  end if;
  target_episode:=gen_random_uuid();
  insert into public.wo_followup_episode_events(episode_id,patient_id,clinic_id,state,reason,started_at,created_at)
  values(target_episode,p_patient_id,p_clinic_id,'active',trim(p_reason),decision_time,decision_time) returning id into new_id;
  return new_id;
 end if;
 next_state:=p_action;
 if next_state='interrupted' and (p_interruption_kind is null or p_interruption_kind not in ('abandonment','suspension')) then
  raise exception 'Indique abandono ou suspensão';
 end if;
 if p_is_test and next_state<>'archived' then raise exception 'Um teste deve ficar no arquivo'; end if;
 target_episode:=coalesce(previous.episode_id,gen_random_uuid());
 cut:=coalesce(previous.closed_at,case when p_closed_date is not null then least(decision_time,((p_closed_date+1)::timestamp at time zone 'Europe/Lisbon')-interval '1 microsecond') end,case when legacy.state in ('paused','completed','abandoned') then legacy.created_at end,decision_time);
 if (p_closed_date is not null and p_closed_date>(decision_time at time zone 'Europe/Lisbon')::date) or cut>decision_time or (previous.started_at is not null and cut<previous.started_at) then raise exception 'Data de encerramento inválida'; end if;
 select coalesce(array_agg(id),'{}'::uuid[]) into rx_ids from public.wo_prescriptions
 where patient_id=p_patient_id and clinic_id=p_clinic_id
 and (id=any(coalesce(previous.prescription_ids,'{}'::uuid[])) or ((previous.started_at is null or created_at>=previous.started_at) and created_at<=cut));
 select coalesce(array_agg(id),'{}'::uuid[]) into qs_ids from public.intake_tokens
 where patient_id=p_patient_id and clinic_id=p_clinic_id and questionnaire_type ~ '^pre_consulta_v[0-9]+$'
 and (id=any(coalesce(previous.questionnaire_ids,'{}'::uuid[])) or ((previous.started_at is null or created_at>=previous.started_at) and created_at<=cut));
 insert into public.wo_followup_episode_events(episode_id,patient_id,clinic_id,state,interruption_kind,is_test,reason,started_at,closed_at,prescription_ids,questionnaire_ids,created_at)
 values(target_episode,p_patient_id,p_clinic_id,next_state,case when next_state='interrupted' then p_interruption_kind else previous.interruption_kind end,p_is_test,trim(p_reason),previous.started_at,cut,rx_ids,qs_ids,decision_time) returning id into new_id;
 return new_id;
end;
$$;
revoke all on function public.record_followup_episode_decision(uuid,uuid,uuid,uuid,text,text,text,boolean,date) from public,anon;
grant execute on function public.record_followup_episode_decision(uuid,uuid,uuid,uuid,text,text,text,boolean,date) to authenticated;
