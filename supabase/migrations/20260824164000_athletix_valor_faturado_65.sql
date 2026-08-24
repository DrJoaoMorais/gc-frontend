alter table public.registos_financeiros
  add column if not exists valor_faturado numeric;

comment on column public.registos_financeiros.valor_faturado is
  'Snapshot do valor cobrado ao doente; independente do honorário médico guardado em valor.';

update public.entidades_financeiras
set valor_faturado = 65
where nome = 'Athletix';

update public.clinic_prices cp
set preco_doente = 65
from public.entidades_financeiras e
where e.nome = 'Athletix'
  and cp.clinic_id = e.clinic_id
  and cp.procedure_type in (
    '🎥 Teleconsulta',
    '💉 Viscossuplementação',
    '🔁 Consulta de Reavaliação',
    '🆕 Primeira Consulta'
  );

create or replace function public.snapshot_athletix_valor_faturado()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_valor numeric;
begin
  if new.valor_faturado is not null then return new; end if;
  select coalesce(
    (
      select cp.preco_doente
      from public.clinic_prices cp
      where cp.clinic_id = e.clinic_id
        and cp.preco_doente is not null
        and lower(trim(regexp_replace(cp.procedure_type, '[^[:alnum:][:space:]/À-ɏ]', '', 'g')))
            = lower(trim(regexp_replace(new.tipo_acto, '[^[:alnum:][:space:]/À-ɏ]', '', 'g')))
      limit 1
    ),
    e.valor_faturado
  ) into v_valor
  from public.entidades_financeiras e
  where e.id = new.entidade_id and e.nome = 'Athletix';
  if v_valor is not null then new.valor_faturado := v_valor; end if;
  return new;
end;
$$;

drop trigger if exists trg_snapshot_athletix_valor_faturado on public.registos_financeiros;
create trigger trg_snapshot_athletix_valor_faturado
before insert on public.registos_financeiros
for each row execute function public.snapshot_athletix_valor_faturado();
