-- Suporte a vários seguros; conserva os campos legados.
-- NULL conserva compatibilidade com criação de doentes por RPCs antigas.
-- [] é uma escolha explícita; nunca recuperar automaticamente o seguro antigo.
begin;
alter table public.patients add column if not exists insurances jsonb;
alter table public.patients add constraint patients_insurances_array
  check (insurances is null or jsonb_typeof(insurances) = 'array');

-- Copiar exactamente os valores originais, incluindo zeros iniciais de apólices.
-- Não alterar nem eliminar as colunas antigas.
update public.patients
set insurances = case
  when coalesce(insurance_provider, '') <> '' or coalesce(insurance_policy_number, '') <> ''
  then jsonb_build_array(jsonb_build_object(
    'provider', coalesce(insurance_provider, ''),
    'policy_number', coalesce(insurance_policy_number, ''),
    'in_header', true))
  else '[]'::jsonb end
where insurances is null;
comment on column public.patients.insurances is
  'Seguros do doente: provider, policy_number, in_header. NULL: usar campos legados; []: nenhum seguro. Os campos legados são conservados.';
notify pgrst, 'reload schema';
commit;
