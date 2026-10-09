-- Leitura, contacto e preparação são decisões distintas. Histórico append-only.
alter table public.wo_followup_events add column decision text
 check (decision in ('closed','contact','prepare','defer'));
alter table public.wo_followup_events add constraint followup_task_decision_kind
 check (decision is null or (kind='review' and length(trim(reason))>0));
create index wo_followup_events_task on public.wo_followup_events(patient_id,clinic_id,source_key,created_at desc,id desc) where kind='review';
create function public.record_followup_task_decision(
 p_patient_id uuid,p_clinic_id uuid,p_episode_id uuid,p_source_key text,p_source_version text,
 p_expected_event_id uuid,p_decision text,p_reason text
) returns uuid language plpgsql security invoker set search_path='' as $$
declare previous_id uuid; result_id uuid;
begin
 if auth.uid() is distinct from '32a24abe-cd69-42d9-bf3a-3355f4f6e28c'::uuid
 or not exists(select 1 from public.patient_clinic where patient_id=p_patient_id and clinic_id=p_clinic_id) then
  raise exception 'Acesso recusado' using errcode='42501';
 end if;
 if p_decision is null or p_decision not in ('closed','contact','prepare','defer')
 or length(trim(coalesce(p_reason,'')))=0 or length(trim(coalesce(p_source_key,'')))=0 or p_source_version is null then
  raise exception 'Decisão, origem e nota são obrigatórias';
 end if;
 if p_episode_id is not null and not exists(select 1 from public.wo_followup_episode_events where episode_id=p_episode_id and patient_id=p_patient_id and clinic_id=p_clinic_id) then
  raise exception 'Episódio inválido';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_patient_id::text||':'||p_clinic_id::text||':'||p_source_key,0));
 select id into previous_id from public.wo_followup_events where patient_id=p_patient_id and clinic_id=p_clinic_id
 and kind='review' and source_key=p_source_key and source_version=p_source_version
 order by created_at desc,id desc limit 1;
 if previous_id is distinct from p_expected_event_id then raise exception 'A tarefa foi alterada. Atualize a lista.'; end if;
 insert into public.wo_followup_events(patient_id,clinic_id,kind,episode_id,source_key,source_version,decision,reason)
 values(p_patient_id,p_clinic_id,'review',p_episode_id,p_source_key,p_source_version,p_decision,trim(p_reason)) returning id into result_id;
 return result_id;
end;
$$;
revoke all on function public.record_followup_task_decision(uuid,uuid,uuid,text,text,uuid,text,text) from public,anon;
grant execute on function public.record_followup_task_decision(uuid,uuid,uuid,text,text,uuid,text,text) to authenticated;
