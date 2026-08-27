alter table public.appointments
  add column if not exists online_request_id uuid;

comment on column public.appointments.online_request_id is
  'Pedido online de patient_uploads que originou esta consulta.';

alter table public.appointments
  add constraint appointments_online_request_id_fkey
  foreign key (online_request_id)
  references public.patient_uploads(id)
  on delete set null;

create unique index appointments_online_request_id_unique
  on public.appointments (online_request_id)
  where online_request_id is not null;
