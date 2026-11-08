create table public.wo_strength_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  data jsonb not null check (jsonb_typeof(data) = 'object' and jsonb_typeof(data->'items') = 'array' and jsonb_array_length(data->'items') between 1 and 1000),
  created_at timestamptz not null default now()
);
create index wo_strength_templates_owner_created_idx on public.wo_strength_templates(user_id, created_at desc);
alter table public.wo_strength_templates enable row level security;
revoke all on public.wo_strength_templates from anon, authenticated;
grant select, insert on public.wo_strength_templates to authenticated;
create policy strength_templates_select_own on public.wo_strength_templates
  for select to authenticated using ((select auth.uid()) = user_id);
create policy strength_templates_insert_own on public.wo_strength_templates
  for insert to authenticated with check ((select auth.uid()) = user_id);
comment on table public.wo_strength_templates is 'Modelos pessoais de blocos: ordem dos exercícios e número de séries, sem dados do doente ou doses.';
