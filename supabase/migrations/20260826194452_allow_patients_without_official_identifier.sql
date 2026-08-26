alter table public.patients
  drop constraint if exists patients_sns_or_nif_or_passport_check;

alter table public.patients
  add constraint patients_identity_or_contact_check
  check (
    sns is not null
    or nif is not null
    or passport_id is not null
    or (
      dob is not null
      and nullif(btrim(phone), '') is not null
      and nullif(btrim(email), '') is not null
    )
  ) not valid;

comment on table public.patients is
  'Doentes da Gestão Clínica. Os identificadores oficiais são opcionais na criação e devem ser confirmados posteriormente quando necessários.';
