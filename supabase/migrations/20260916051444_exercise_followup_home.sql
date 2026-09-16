-- Histórico append-only: não altera prescrições, questionários ou acesso do doente.
create table public.wo_followup_events (
 id uuid primary key default gen_random_uuid(),
 patient_id uuid not null references public.patients(id),
 clinic_id uuid not null references public.clinics(id),
 kind text not null check (kind in ('state','review')),
 state text check (state in ('auto','paused','completed','abandoned')),
 reason text not null default '',
 source_key text,
 source_version text,
 created_at timestamptz not null default clock_timestamp(),
 created_by uuid not null default auth.uid() references auth.users(id),
 check ((kind='state' and state is not null and source_key is null and source_version is null and (state='auto' or length(trim(reason))>0)) or
        (kind='review' and state is null and source_key is not null and source_version is not null))
);
create index wo_followup_events_patient_clinic_date on public.wo_followup_events(patient_id,clinic_id,created_at desc);
alter table public.wo_followup_events enable row level security;
revoke all on public.wo_followup_events from public,anon,authenticated;
grant select,insert on public.wo_followup_events to authenticated;
create policy followup_owner_read on public.wo_followup_events for select to authenticated
using ((select auth.uid())='32a24abe-cd69-42d9-bf3a-3355f4f6e28c'::uuid);
create policy followup_owner_insert on public.wo_followup_events for insert to authenticated
with check ((select auth.uid())='32a24abe-cd69-42d9-bf3a-3355f4f6e28c'::uuid and created_by=(select auth.uid())
 and exists(select 1 from public.patient_clinic pc where pc.patient_id=wo_followup_events.patient_id and pc.clinic_id=wo_followup_events.clinic_id));
