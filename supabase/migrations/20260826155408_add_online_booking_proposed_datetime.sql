alter table public.patient_uploads
  add column if not exists proposed_date date,
  add column if not exists proposed_time time without time zone;

comment on column public.patient_uploads.proposed_date is
  'Data proposta pelo doente no pedido online; não confirma a consulta.';

comment on column public.patient_uploads.proposed_time is
  'Hora Europe/Lisbon proposta pelo doente; não confirma a consulta.';
