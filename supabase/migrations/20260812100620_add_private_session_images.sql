-- Metadados das imagens enviadas pelo doente. Os ficheiros ficam no bucket privado
-- `wo-session-images`; esta tabela nunca é exposta directamente ao portal do doente.
create table if not exists public.wo_session_images (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references public.wo_prescriptions(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  session_id uuid not null,
  storage_path text not null unique,
  byte_size bigint not null check (byte_size > 0 and byte_size <= 2097152),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  status text not null default 'pending' check (status in ('pending', 'ready')),
  created_at timestamptz not null default now()
);

create index if not exists wo_session_images_prescription_idx
  on public.wo_session_images (prescription_id, created_at);
create index if not exists wo_session_images_session_idx
  on public.wo_session_images (prescription_id, session_id, created_at);

alter table public.wo_session_images enable row level security;
revoke all on public.wo_session_images from anon, authenticated;

-- Reserva atómica: valida plano, token, sessão e os dois limites antes do upload.
create or replace function public.wo_reserve_session_image(
  p_token uuid,
  p_session_id uuid,
  p_byte_size bigint,
  p_mime_type text
) returns table(image_id uuid, storage_path text, prescription_id uuid, patient_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rx public.wo_prescriptions%rowtype;
  v_image_id uuid := gen_random_uuid();
  v_path text;
begin
  if p_byte_size <= 0 or p_byte_size > 2097152 then
    raise exception 'invalid_image_size';
  end if;
  if p_mime_type not in ('image/jpeg', 'image/png', 'image/webp') then
    raise exception 'invalid_image_type';
  end if;

  select * into v_rx
  from public.wo_prescriptions
  where token = p_token and status = 'active' and expires_at > now()
  for update;
  if not found then raise exception 'invalid_plan'; end if;

  if not exists (
    select 1 from jsonb_array_elements(coalesce(v_rx.data->'sessions', '[]'::jsonb)) s
    where s->>'session_id' = p_session_id::text
  ) then raise exception 'invalid_session'; end if;

  -- Uma interrupção entre a reserva e o upload não pode consumir espaço para sempre.
  delete from public.wo_session_images
  where prescription_id = v_rx.id and status = 'pending' and created_at < now() - interval '15 minutes';

  if (select count(*) from public.wo_session_images
      where prescription_id = v_rx.id and session_id = p_session_id) >= 3 then
    raise exception 'session_image_limit';
  end if;
  if coalesce((select sum(byte_size) from public.wo_session_images
      where prescription_id = v_rx.id), 0) + p_byte_size > 52428800 then
    raise exception 'plan_storage_limit';
  end if;

  v_path := v_rx.id::text || '/' || v_rx.patient_id::text || '/' || p_session_id::text || '/' || v_image_id::text || '.webp';
  insert into public.wo_session_images(id, prescription_id, patient_id, session_id, storage_path, byte_size, mime_type)
  values (v_image_id, v_rx.id, v_rx.patient_id, p_session_id, v_path, p_byte_size, p_mime_type);
  return query select v_image_id, v_path, v_rx.id, v_rx.patient_id;
end;
$$;

create or replace function public.wo_mark_session_image_ready(p_image_id uuid)
returns void language sql security definer set search_path = ''
as $$ update public.wo_session_images set status = 'ready' where id = p_image_id $$;

create or replace function public.wo_cancel_session_image(p_image_id uuid)
returns void language sql security definer set search_path = ''
as $$ delete from public.wo_session_images where id = p_image_id and status = 'pending' $$;

revoke all on function public.wo_reserve_session_image(uuid, uuid, bigint, text) from public, anon, authenticated;
revoke all on function public.wo_mark_session_image_ready(uuid) from public, anon, authenticated;
revoke all on function public.wo_cancel_session_image(uuid) from public, anon, authenticated;
grant execute on function public.wo_reserve_session_image(uuid, uuid, bigint, text) to service_role;
grant execute on function public.wo_mark_session_image_ready(uuid) to service_role;
grant execute on function public.wo_cancel_session_image(uuid) to service_role;
