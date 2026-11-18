-- Run explicitly after release approval, against the intended database.
-- The migration alone changes no user's permissions. This script switches the
-- single active Novo Cuidar administrative account to booking-only permissions.
begin;

lock table public.clinic_members in share row exclusive mode;
do $$
declare
  novo uuid;
  web uuid;
  staff uuid;
  novo_provider uuid;
  web_provider uuid;
begin
  select id into strict novo from public.clinics where slug = 'novo-cuidar' and is_active;
  select id into strict web from public.clinics where slug = 'joao-morais-web' and is_active;
  select user_id into strict staff from public.clinic_members
  where clinic_id = novo and role = 'administrativo' and is_active;
  if exists (
    select 1 from public.clinic_members where user_id = staff and is_active
      and (clinic_id is distinct from novo or role is distinct from 'administrativo')
  ) then raise exception 'A conta tem outras permissões ativas. Confirma a configuração antes de ativar.'; end if;

  select m.user_id into strict novo_provider from public.clinic_members m
  join public.profiles p on p.id = m.user_id
  where m.clinic_id = novo and m.role = 'medico' and m.is_active;
  select m.user_id into strict web_provider from public.clinic_members m
  join public.profiles p on p.id = m.user_id
  where m.clinic_id = web and m.role in ('medico', 'super_admin') and m.is_active;
  if novo_provider is distinct from web_provider then
    raise exception 'Os médicos configurados para as duas agendas são diferentes. Confirma a configuração.';
  end if;

  insert into gc_booking_private.access (user_id, clinic_id, provider_id)
  values (staff, novo, novo_provider), (staff, web, web_provider);
  update public.clinic_members set is_active = false
  where user_id = staff and clinic_id = novo and role = 'administrativo' and is_active;
end;
$$;

commit;
