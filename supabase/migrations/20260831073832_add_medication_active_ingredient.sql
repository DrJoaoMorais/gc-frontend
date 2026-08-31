-- Guarda separadamente o princípio ativo sem alterar os registos existentes.
alter table public.patient_medication
  add column if not exists principio_ativo text;

comment on column public.patient_medication.principio_ativo is
  'Princípio ativo confirmado pelo profissional; pode vir do catálogo ou ser introduzido manualmente.';
