alter table public.documents
  add column if not exists status text not null default 'ativo';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'documents_status_check'
      and conrelid = 'public.documents'::regclass
  ) then
    alter table public.documents
      add constraint documents_status_check
      check (status = any (array['ativo'::text,'arquivado'::text]));
  end if;
end $$;

create index if not exists documents_patient_status_idx on public.documents(patient_id, status);
