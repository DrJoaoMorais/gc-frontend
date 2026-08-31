-- Eventos datados de medicação no calendário único do acompanhamento.
-- Alteração aditiva: preserva integralmente a medicação já existente.

create table if not exists public.patient_medication_events (
  id              uuid primary key default gen_random_uuid(),
  medication_id   uuid not null references public.patient_medication(id) on delete cascade,
  clinic_id       uuid not null references public.clinics(id),
  event_date      date not null,
  event_type      text not null check (event_type in ('toma','alteracao_dose','suspensao','nota')),
  dose            text,
  instructions    text,
  status          text not null default 'planned' check (status in ('planned','cancelled')),
  created_at      timestamptz not null default now(),
  created_by      uuid not null default auth.uid(),
  updated_at      timestamptz not null default now(),
  updated_by      uuid
);

create index if not exists patient_medication_events_medication_date_idx
  on public.patient_medication_events (medication_id, event_date)
  where status = 'planned';

alter table public.patient_medication_events enable row level security;

create policy patient_medication_events_select on public.patient_medication_events
  for select to authenticated
  using (public.is_clinic_member(clinic_id));

create policy patient_medication_events_insert on public.patient_medication_events
  for insert to authenticated
  with check (
    public.has_clinic_role(clinic_id, array['super_admin','admin','medico','administrativo']::text[])
    and created_by = auth.uid()
    and exists (
      select 1 from public.patient_medication m
      where m.id = medication_id and m.clinic_id = clinic_id
    )
  );

create policy patient_medication_events_update on public.patient_medication_events
  for update to authenticated
  using (public.has_clinic_role(clinic_id, array['super_admin','admin','medico','administrativo']::text[]))
  with check (
    public.has_clinic_role(clinic_id, array['super_admin','admin','medico','administrativo']::text[])
    and exists (
      select 1 from public.patient_medication m
      where m.id = medication_id and m.clinic_id = clinic_id
    )
  );

revoke all on table public.patient_medication_events from anon;
grant select, insert, update on table public.patient_medication_events to authenticated;

create or replace function public.get_acompanhamento_medication_events(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link_id uuid;
begin
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
$$;

revoke execute on function public.get_acompanhamento_medication_events(text) from public, authenticated;
grant execute on function public.get_acompanhamento_medication_events(text) to anon;
