alter table public.entidades_financeiras
  add column if not exists faturacao_granularidade text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'entidades_financeiras_faturacao_granularidade_check'
      and conrelid = 'public.entidades_financeiras'::regclass
  ) then
    alter table public.entidades_financeiras
      add constraint entidades_financeiras_faturacao_granularidade_check
      check (faturacao_granularidade is null or faturacao_granularidade = any (array['mensal'::text,'dia'::text,'registo'::text]));
  end if;
end $$;

update public.entidades_financeiras
set faturacao_granularidade = case
  when tipo = 'avenca' then 'mensal'
  when nome = 'Athletix' then 'dia'
  when nome = 'João Morais Web' then 'registo'
  else faturacao_granularidade
end
where tipo = 'avenca' or nome in ('Athletix','João Morais Web');

create table if not exists public.controlo_faturacao (
  id uuid primary key default gen_random_uuid(),
  entidade_id uuid not null references public.entidades_financeiras(id) on delete restrict,
  granularidade text not null check (granularidade = any (array['mensal'::text,'dia'::text,'registo'::text])),
  chave text not null,
  data_referencia date not null,
  registo_financeiro_id uuid references public.registos_financeiros(id) on delete set null,
  estado text not null default 'por_enviar' check (estado = any (array['por_enviar'::text,'enviado_contabilista'::text,'recibo_emitido'::text,'pago'::text])),
  enviado_contabilista_at timestamptz,
  recibo_emitido_at timestamptz,
  pago_at timestamptz,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint controlo_faturacao_entidade_chave_unique unique (entidade_id, granularidade, chave)
);

create index if not exists controlo_faturacao_entidade_id_idx on public.controlo_faturacao(entidade_id);
create index if not exists controlo_faturacao_registo_id_idx on public.controlo_faturacao(registo_financeiro_id);
create index if not exists controlo_faturacao_periodo_estado_idx on public.controlo_faturacao(data_referencia, estado);

drop trigger if exists trg_controlo_faturacao_updated_at on public.controlo_faturacao;
create trigger trg_controlo_faturacao_updated_at
before update on public.controlo_faturacao
for each row execute function public.set_updated_at();

alter table public.controlo_faturacao enable row level security;

drop policy if exists controlo_faturacao_select on public.controlo_faturacao;
create policy controlo_faturacao_select on public.controlo_faturacao
for select to authenticated
using (exists (
  select 1 from public.clinic_members cm
  where cm.user_id = (select auth.uid()) and cm.is_active = true
    and cm.role = any (array['super_admin'::text,'medico'::text])
));

drop policy if exists controlo_faturacao_insert on public.controlo_faturacao;
create policy controlo_faturacao_insert on public.controlo_faturacao
for insert to authenticated
with check (exists (
  select 1 from public.clinic_members cm
  where cm.user_id = (select auth.uid()) and cm.is_active = true
    and cm.role = any (array['super_admin'::text,'medico'::text])
));

drop policy if exists controlo_faturacao_update on public.controlo_faturacao;
create policy controlo_faturacao_update on public.controlo_faturacao
for update to authenticated
using (exists (
  select 1 from public.clinic_members cm
  where cm.user_id = (select auth.uid()) and cm.is_active = true
    and cm.role = any (array['super_admin'::text,'medico'::text])
))
with check (exists (
  select 1 from public.clinic_members cm
  where cm.user_id = (select auth.uid()) and cm.is_active = true
    and cm.role = any (array['super_admin'::text,'medico'::text])
));

revoke all on public.controlo_faturacao from anon;
revoke all on public.controlo_faturacao from authenticated;
grant select, insert, update on public.controlo_faturacao to authenticated;
grant all on public.controlo_faturacao to service_role;
