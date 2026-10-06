-- Messages belong to one clinic. No global channel and no administrator bypass.
create table public.agenda_messages (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  author_id uuid not null default auth.uid() references auth.users(id),
  recipient_id uuid not null references auth.users(id),
  patient_id uuid references public.patients(id),
  body text not null check (length(btrim(body)) between 1 and 5000),
  is_task boolean not null default false,
  status text not null default 'pending' check (status in ('pending','resolved')),
  hidden_from_home boolean not null default false,
  constraint agenda_messages_hide_only_resolved check (not hidden_from_home or status='resolved'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index agenda_messages_clinic_created on public.agenda_messages(clinic_id, created_at desc, id desc);
alter table public.agenda_messages enable row level security;
revoke all on public.agenda_messages from anon, authenticated;
grant select on public.agenda_messages to authenticated;
grant insert (clinic_id, recipient_id, patient_id, body, is_task) on public.agenda_messages to authenticated;
grant update (status, hidden_from_home) on public.agenda_messages to authenticated;
create policy agenda_messages_read on public.agenda_messages for select to authenticated
using (exists (select 1 from public.clinic_members cm where cm.clinic_id=agenda_messages.clinic_id and cm.user_id=(select auth.uid()) and cm.is_active));
create policy agenda_messages_create on public.agenda_messages for insert to authenticated
with check (
  author_id=(select auth.uid()) and status='pending'
  and exists (select 1 from public.clinic_members cm where cm.clinic_id=agenda_messages.clinic_id and cm.user_id=(select auth.uid()) and cm.is_active)
  and exists (select 1 from public.clinic_members cm where cm.clinic_id=agenda_messages.clinic_id and cm.user_id=agenda_messages.recipient_id and cm.is_active)
  and (patient_id is null or exists (select 1 from public.patient_clinic pc where pc.clinic_id=agenda_messages.clinic_id and pc.patient_id=agenda_messages.patient_id))
);
create policy agenda_messages_update on public.agenda_messages for update to authenticated
using (exists (select 1 from public.clinic_members cm where cm.clinic_id=agenda_messages.clinic_id and cm.user_id=(select auth.uid()) and cm.is_active))
with check (exists (select 1 from public.clinic_members cm where cm.clinic_id=agenda_messages.clinic_id and cm.user_id=(select auth.uid()) and cm.is_active));
create function public.agenda_message_updated_at() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.agenda_message_updated_at() from public, anon, authenticated;
create trigger agenda_message_updated_at before update on public.agenda_messages
for each row execute function public.agenda_message_updated_at();

-- profiles only permits own-profile reads. Expose names only for active colleagues
-- in an explicitly authorised clinic, without widening the existing profile RLS.
create schema if not exists agenda_private;
revoke all on schema agenda_private from public, anon;
grant usage on schema agenda_private to authenticated;
create function agenda_private.message_members(p_clinic_id uuid)
returns table(user_id uuid, display_name text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.clinic_members cm
    where cm.clinic_id=p_clinic_id and cm.user_id=auth.uid() and cm.is_active
  ) then raise exception 'Sem acesso à clínica' using errcode='42501'; end if;
  return query select cm.user_id, coalesce(nullif(btrim(cm.display_name),''),nullif(btrim(p.nome_completo),''),'Utilizador da clínica')
  from public.clinic_members cm left join public.profiles p on p.id=cm.user_id
  where cm.clinic_id=p_clinic_id and cm.is_active order by 2,1;
end;
$$;
revoke all on function agenda_private.message_members(uuid) from public, anon;
grant execute on function agenda_private.message_members(uuid) to authenticated;
create function public.agenda_message_members(p_clinic_id uuid)
returns table(user_id uuid, display_name text)
language sql stable security invoker set search_path = '' as $$
  select * from agenda_private.message_members(p_clinic_id);
$$;
revoke all on function public.agenda_message_members(uuid) from public, anon;
grant execute on function public.agenda_message_members(uuid) to authenticated;
