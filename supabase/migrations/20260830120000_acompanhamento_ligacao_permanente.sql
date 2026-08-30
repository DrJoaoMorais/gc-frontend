-- ============================================================================
-- Ligação permanente de acompanhamento do doente
-- ----------------------------------------------------------------------------
-- 100% aditivo: nenhuma tabela, coluna, função ou token existente é apagado,
-- alterado ou revogado. As funções já existentes (generate_diary_token,
-- get_diary_episode, end_diary_episode, submit_diary_entry, get_diary_recent,
-- wo_get_plan, get_workout_context) ficam intocadas — continuam a funcionar
-- exactamente como hoje para quem já as chame. Todo o código novo do
-- front-end passa a chamar as funções NOVAS abaixo; as antigas ficam como
-- estavam, sem risco.
--
-- Rollback correspondente (não aplicado por omissão, fora da pasta de
-- migrations para nunca ser apanhado por engano):
--   docs/GC-acompanhamento-ligacao-permanente-rollback.sql
-- ============================================================================

-- ── 1. Ligação permanente (uma por doente e clínica, nunca muda) ───────────
create table if not exists public.patient_portal_links (
  id                 uuid primary key default gen_random_uuid(),
  patient_id         uuid not null references public.patients(id),
  token              text not null unique,
  created_by         uuid not null,
  created_clinic_id  uuid not null references public.clinics(id),
  created_at         timestamptz not null default now(),
  revoked_at         timestamptz,
  revoked_by         uuid
);

-- Uma ligação permanente ACTIVA por doente e clínica. Esta fronteira impede
-- que um token de uma clínica revele dados clínicos criados noutra.
create unique index if not exists patient_portal_links_patient_clinic_active_uk
  on public.patient_portal_links (patient_id, created_clinic_id) where revoked_at is null;

-- ── 2. Aliases: todos os tokens antigos continuam a abrir a mesma ligação ──
create table if not exists public.patient_portal_link_aliases (
  id          uuid primary key default gen_random_uuid(),
  old_token   text not null unique,
  link_id     uuid not null references public.patient_portal_links(id) on delete cascade,
  source      text not null default 'patient_diary_tokens',
  created_at  timestamptz not null default now()
);

-- ── 3. Diário deixa de SER a ligação — passa a ser um episódio dela ────────
alter table public.patient_diary_tokens
  add column if not exists link_id uuid references public.patient_portal_links(id);
-- (token, status, expires_at, duration_days, med_nome, med_dose, med_freq
--  mantêm-se tal e qual — med_* ficam como campos legados, ver secção 4)

-- ── 4. Medicação — várias por ligação, cada uma com o seu próprio ciclo ────
create table if not exists public.patient_medication (
  id             uuid primary key default gen_random_uuid(),
  link_id        uuid not null references public.patient_portal_links(id),
  clinic_id      uuid not null references public.clinics(id),
  nome           text not null,
  dose           text,
  freq           text,
  periodicidade  text,
  data_inicio    date,
  data_fim       date,
  enabled        boolean not null default true,
  created_at     timestamptz not null default now(),
  created_by     uuid not null,
  updated_at     timestamptz not null default now(),
  updated_by     uuid
);

-- ── 5. Versão do plano de exercício: publicada vs. vista pelo doente ──────
alter table public.wo_prescriptions add column if not exists content_version      integer not null default 1;
alter table public.wo_prescriptions add column if not exists published_at        timestamptz not null default now();
alter table public.wo_prescriptions add column if not exists last_opened_version integer;
alter table public.wo_prescriptions add column if not exists last_opened_at      timestamptz;

-- content_version/published_at só mudam quando o CONTEÚDO (coluna `data`)
-- muda de facto — nunca por causa de last_opened_version/last_opened_at,
-- porque essas duas colunas nem são tocadas por este trigger.
create or replace function public.wo_prescriptions_bump_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if TG_OP = 'INSERT' then
    new.content_version := 1;
    new.published_at := now();
    return new;
  end if;
  if new.data is distinct from old.data then
    new.content_version := old.content_version + 1;
    new.published_at := now();
  else
    new.content_version := old.content_version;
    new.published_at := old.published_at;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_wo_prescriptions_bump_version on public.wo_prescriptions;
create trigger trg_wo_prescriptions_bump_version
before insert or update on public.wo_prescriptions
for each row execute function public.wo_prescriptions_bump_version();

-- ── 6. RLS ──────────────────────────────────────────────────────────────
alter table public.patient_portal_links enable row level security;
create policy patient_portal_links_select on public.patient_portal_links
  for select to authenticated
  using (public.is_clinic_member(created_clinic_id) and exists (
    select 1 from public.patient_clinic pc where pc.patient_id = patient_portal_links.patient_id
      and pc.clinic_id = patient_portal_links.created_clinic_id and pc.is_active = true
  ));

alter table public.patient_portal_link_aliases enable row level security;
create policy patient_portal_link_aliases_select on public.patient_portal_link_aliases
  for select to authenticated
  using (exists (
    select 1 from public.patient_portal_links pl
    join public.patient_clinic pc on pc.patient_id = pl.patient_id
      and pc.clinic_id = pl.created_clinic_id and pc.is_active = true
    where pl.id = patient_portal_link_aliases.link_id
      and public.is_clinic_member(pc.clinic_id)
  ));

alter table public.patient_medication enable row level security;
create policy patient_medication_select on public.patient_medication
  for select to authenticated using (public.is_clinic_member(clinic_id));
create policy patient_medication_insert on public.patient_medication
  for insert to authenticated
  with check (public.has_clinic_role(clinic_id, array['super_admin','admin','medico','administrativo']::text[]));
create policy patient_medication_update on public.patient_medication
  for update to authenticated
  using (public.has_clinic_role(clinic_id, array['super_admin','admin','medico','administrativo']::text[]))
  with check (public.has_clinic_role(clinic_id, array['super_admin','admin','medico','administrativo']::text[]));

-- ── 7. Backfill — preserva TODOS os dados e TODOS os tokens já emitidos ────

-- 7a. uma ligação permanente por doente/clínica; reaproveita o token mais recente
--     desse par como token permanente (é o que tem mais probabilidade
--     de já estar guardado no telemóvel dele).
insert into public.patient_portal_links (patient_id, token, created_by, created_clinic_id, created_at)
select distinct on (t.patient_id, t.clinic_id)
  t.patient_id, t.token, t.created_by, t.clinic_id, t.created_at
from public.patient_diary_tokens t
order by t.patient_id, t.clinic_id, t.created_at desc
on conflict do nothing;

-- 7b. TODOS os outros tokens que esse doente já teve (activos, expirados ou
--     revogados) tornam-se aliases — continuam a abrir a mesma ligação.
insert into public.patient_portal_link_aliases (old_token, link_id, source)
select t.token, pl.id, 'patient_diary_tokens'
from public.patient_diary_tokens t
join public.patient_portal_links pl on pl.patient_id = t.patient_id and pl.created_clinic_id = t.clinic_id
where t.token <> pl.token
on conflict (old_token) do nothing;

-- 7c. liga cada episódio de Diário já existente à sua ligação permanente.
update public.patient_diary_tokens t
set link_id = pl.id
from public.patient_portal_links pl
where pl.patient_id = t.patient_id and pl.created_clinic_id = t.clinic_id and t.link_id is null;

-- 7d. medicação hoje activa (token válido, med_nome preenchido) migra para
--     a tabela nova, já ligada; os campos antigos em patient_diary_tokens
--     não são tocados nem apagados.
insert into public.patient_medication (link_id, clinic_id, nome, dose, freq, enabled, created_by, created_at)
select pl.id, t.clinic_id, t.med_nome, t.med_dose, t.med_freq, true, t.created_by, t.created_at
from public.patient_diary_tokens t
join public.patient_portal_links pl on pl.patient_id = t.patient_id and pl.created_clinic_id = t.clinic_id
where t.med_nome is not null
  and t.status = 'active' and t.expires_at > now();

-- ── 8. Funções novas (nada do que já existe é substituído) ────────────────

create or replace function public.ensure_patient_link(p_patient_id uuid, p_clinic_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  if auth.uid() is null or not public.has_clinic_role(
    p_clinic_id, array['super_admin','admin','medico','administrativo']::text[]
  ) then
    raise exception 'Sem permissão para criar esta ligação';
  end if;
  if not exists (
    select 1 from public.patient_clinic pc
    where pc.patient_id = p_patient_id and pc.clinic_id = p_clinic_id and pc.is_active = true
  ) then
    raise exception 'O doente não está associado a esta clínica';
  end if;

  select token into v_token from public.patient_portal_links
    where patient_id = p_patient_id and created_clinic_id = p_clinic_id and revoked_at is null;
  if v_token is not null then return v_token; end if;

  v_token := encode(extensions.gen_random_bytes(18), 'hex');
  insert into public.patient_portal_links (patient_id, token, created_by, created_clinic_id)
    values (p_patient_id, v_token, auth.uid(), p_clinic_id);
  return v_token;
end;
$$;
revoke execute on function public.ensure_patient_link(uuid, uuid) from public, anon;
grant execute on function public.ensure_patient_link(uuid, uuid) to authenticated;


create or replace function public.set_diary_episode(p_patient_id uuid, p_clinic_id uuid, p_duration_days integer default 15)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link_id uuid;
  v_link_token text;
  v_diary_token text;
  v_duration integer := greatest(1, least(coalesce(p_duration_days, 15), 365));
begin
  if auth.uid() is null or not public.has_clinic_role(
    p_clinic_id, array['super_admin','admin','medico','administrativo']::text[]
  ) then
    raise exception 'Sem permissão para iniciar o Diário';
  end if;
  if not exists (
    select 1 from public.patient_clinic pc
    where pc.patient_id = p_patient_id and pc.clinic_id = p_clinic_id and pc.is_active = true
  ) then
    raise exception 'O doente não está associado a esta clínica';
  end if;

  select id, token into v_link_id, v_link_token from public.patient_portal_links
    where patient_id = p_patient_id and created_clinic_id = p_clinic_id and revoked_at is null;
  if v_link_id is null then
    v_link_token := encode(extensions.gen_random_bytes(18), 'hex');
    insert into public.patient_portal_links (patient_id, token, created_by, created_clinic_id)
      values (p_patient_id, v_link_token, auth.uid(), p_clinic_id)
      returning id into v_link_id;
  end if;

  v_diary_token := encode(extensions.gen_random_bytes(18), 'hex');
  insert into public.patient_diary_tokens (
    token, patient_id, clinic_id, created_by, created_at, expires_at,
    duration_days, status, link_id
  ) values (
    v_diary_token, p_patient_id, p_clinic_id, auth.uid(), now(),
    now() + make_interval(days => v_duration), v_duration, 'active', v_link_id
  );

  -- só um episódio de Diário ativo dentro desta ligação clínica.
  update public.patient_diary_tokens
    set status = 'revoked'
    where patient_id = p_patient_id and clinic_id = p_clinic_id
      and token <> v_diary_token and status = 'active';

  return v_link_token;
end;
$$;
revoke execute on function public.set_diary_episode(uuid, uuid, integer) from public, anon;
grant execute on function public.set_diary_episode(uuid, uuid, integer) to authenticated;


create or replace function public.set_diary_enabled(p_patient_id uuid, p_clinic_id uuid, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.has_clinic_role(
    p_clinic_id, array['super_admin','admin','medico','administrativo']::text[]
  ) then
    raise exception 'Sem permissão para gerir o Diário';
  end if;

  if p_enabled then
    perform public.set_diary_episode(p_patient_id, p_clinic_id, 15);
  else
    -- termina o episódio; a ligação permanente (patient_portal_links) nunca é tocada aqui.
    update public.patient_diary_tokens
      set status = 'revoked', expires_at = least(expires_at, now())
      where patient_id = p_patient_id and clinic_id = p_clinic_id and status = 'active';
  end if;
end;
$$;
revoke execute on function public.set_diary_enabled(uuid, uuid, boolean) from public, anon;
grant execute on function public.set_diary_enabled(uuid, uuid, boolean) to authenticated;


create or replace function public.set_medication(
  p_patient_id uuid, p_clinic_id uuid, p_medication_id uuid default null,
  p_nome text default null, p_dose text default null, p_freq text default null,
  p_periodicidade text default null, p_data_inicio date default null, p_data_fim date default null,
  p_enabled boolean default true
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link_id uuid;
  v_id uuid;
begin
  if auth.uid() is null or not public.has_clinic_role(
    p_clinic_id, array['super_admin','admin','medico','administrativo']::text[]
  ) then
    raise exception 'Sem permissão para gerir medicação';
  end if;
  if not exists (
    select 1 from public.patient_clinic pc
    where pc.patient_id = p_patient_id and pc.clinic_id = p_clinic_id and pc.is_active = true
  ) then
    raise exception 'O doente não está associado a esta clínica';
  end if;

  select id into v_link_id from public.patient_portal_links
    where patient_id = p_patient_id and created_clinic_id = p_clinic_id and revoked_at is null;
  if v_link_id is null then
    raise exception 'Doente sem ligação de acompanhamento ainda criada — usar ensure_patient_link primeiro';
  end if;

  if p_medication_id is not null then
    update public.patient_medication set
      nome = coalesce(p_nome, nome), dose = p_dose, freq = p_freq,
      periodicidade = p_periodicidade, data_inicio = p_data_inicio, data_fim = p_data_fim,
      enabled = p_enabled, updated_at = now(), updated_by = auth.uid()
    where id = p_medication_id and link_id = v_link_id
    returning id into v_id;
  else
    insert into public.patient_medication (
      link_id, clinic_id, nome, dose, freq, periodicidade, data_inicio, data_fim, enabled, created_by
    ) values (
      v_link_id, p_clinic_id, p_nome, p_dose, p_freq, p_periodicidade, p_data_inicio, p_data_fim, p_enabled, auth.uid()
    ) returning id into v_id;
  end if;
  return v_id;
end;
$$;
revoke execute on function public.set_medication(uuid, uuid, uuid, text, text, text, text, date, date, boolean) from public, anon;
grant execute on function public.set_medication(uuid, uuid, uuid, text, text, text, text, date, date, boolean) to authenticated;


-- ── 9. Funções novas para o doente (anon) ──────────────────────────────────

create or replace function public.get_acompanhamento_home(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link record;
  v_diary record;
  v_result jsonb;
begin
  select pl.id, pl.patient_id, pl.created_clinic_id, pl.revoked_at into v_link
    from public.patient_portal_links pl where pl.token = p_token;
  if not found then
    select pl.id, pl.patient_id, pl.created_clinic_id, pl.revoked_at into v_link
      from public.patient_portal_link_aliases a
      join public.patient_portal_links pl on pl.id = a.link_id
      where a.old_token = p_token;
  end if;
  if not found or v_link.revoked_at is not null then
    return jsonb_build_object('valid', false);
  end if;

  select t.token, t.status, t.expires_at, t.created_at, t.duration_days into v_diary
    from public.patient_diary_tokens t
    where t.patient_id = v_link.patient_id and t.clinic_id = v_link.created_clinic_id
      and t.status = 'active' and t.expires_at > now()
    order by t.created_at desc limit 1;

  select jsonb_build_object(
    'valid', true,
    'first_name', split_part(p.full_name, ' ', 1),
    'diario', case when v_diary.expires_at is not null then jsonb_build_object(
        'enabled', true, 'episode_token', v_diary.token,
        'started_at', v_diary.created_at, 'expires_at', v_diary.expires_at,
        'duration_days', v_diary.duration_days
      ) else jsonb_build_object('enabled', false) end,
    'exercicio', coalesce((
      select jsonb_build_object('enabled', true, 'expires_at', pr.expires_at)
      from public.wo_prescriptions pr
      where pr.patient_id = v_link.patient_id and pr.clinic_id = v_link.created_clinic_id
        and pr.status = 'active' and pr.expires_at > now()
      order by pr.created_at desc limit 1
    ), jsonb_build_object('enabled', false)),
    'medicacao', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', m.id, 'nome', m.nome, 'dose', m.dose, 'freq', m.freq, 'periodicidade', m.periodicidade
      )), '[]'::jsonb)
      from public.patient_medication m
      where m.link_id = v_link.id and m.enabled = true
        and (m.data_fim is null or m.data_fim >= current_date)
    ),
    'questionario', coalesce((
      select jsonb_build_object('pending', true, 'status', it.status,
        'questionnaire_type', it.questionnaire_type, 'token', it.token)
      from public.intake_tokens it
      where it.patient_id = v_link.patient_id
        and it.clinic_id = v_link.created_clinic_id
        and it.status in ('pending_rgpd','in_progress')
        and it.expires_at > now()
      order by it.created_at desc limit 1
    ), jsonb_build_object('pending', false))
  ) into v_result
  from public.patients p where p.id = v_link.patient_id;

  return coalesce(v_result, jsonb_build_object('valid', false));
end;
$$;
revoke execute on function public.get_acompanhamento_home(text) from public, authenticated;
grant execute on function public.get_acompanhamento_home(text) to anon;


create or replace function public.get_acompanhamento_exercise(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_patient_id uuid;
  v_clinic_id uuid;
  v_presc record;
begin
  select pl.patient_id, pl.created_clinic_id into v_patient_id, v_clinic_id from public.patient_portal_links pl
    where pl.token = p_token and pl.revoked_at is null;
  if not found then
    select pl.patient_id, pl.created_clinic_id into v_patient_id, v_clinic_id
      from public.patient_portal_link_aliases a
      join public.patient_portal_links pl on pl.id = a.link_id
      where a.old_token = p_token and pl.revoked_at is null;
  end if;
  if not found then return jsonb_build_object('ok', false, 'reason', 'token_invalido'); end if;

  select id, data, expires_at, content_version, published_at, clinic_id
    into v_presc
    from public.wo_prescriptions
    where patient_id = v_patient_id and clinic_id = v_clinic_id
      and status = 'active' and expires_at > now()
    order by created_at desc limit 1;
  if not found then return jsonb_build_object('ok', false, 'reason', 'sem_plano'); end if;

  -- Marca "aberto pelo doente" nesta versão. Não toca em `data`, por isso o
  -- trigger de versão não incrementa content_version nem mexe em published_at.
  update public.wo_prescriptions
    set last_opened_version = content_version, last_opened_at = now()
    where id = v_presc.id;

  return jsonb_build_object(
    'ok', true, 'plan', v_presc.data, 'expires_at', v_presc.expires_at,
    'content_version', v_presc.content_version, 'published_at', v_presc.published_at,
    'clinic_name', (select c.name from public.clinics c where c.id = v_presc.clinic_id)
  );
end;
$$;
revoke execute on function public.get_acompanhamento_exercise(text) from public, authenticated;
grant execute on function public.get_acompanhamento_exercise(text) to anon;


create or replace function public.get_acompanhamento_questionario(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_patient_id uuid;
  v_clinic_id uuid;
  v_it record;
begin
  select pl.patient_id, pl.created_clinic_id into v_patient_id, v_clinic_id from public.patient_portal_links pl
    where pl.token = p_token and pl.revoked_at is null;
  if not found then
    select pl.patient_id, pl.created_clinic_id into v_patient_id, v_clinic_id
      from public.patient_portal_link_aliases a
      join public.patient_portal_links pl on pl.id = a.link_id
      where a.old_token = p_token and pl.revoked_at is null;
  end if;
  if not found then return jsonb_build_object('ok', false); end if;

  select token, status, questionnaire_type into v_it
    from public.intake_tokens
    where patient_id = v_patient_id
      and clinic_id = v_clinic_id
      and status in ('pending_rgpd','in_progress')
      and expires_at > now()
    order by created_at desc limit 1;
  if not found then return jsonb_build_object('ok', true, 'pending', false); end if;

  return jsonb_build_object('ok', true, 'pending', true, 'status', v_it.status,
    'questionnaire_type', v_it.questionnaire_type, 'token', v_it.token);
end;
$$;
revoke execute on function public.get_acompanhamento_questionario(text) from public, authenticated;
grant execute on function public.get_acompanhamento_questionario(text) to anon;

-- ── 10. Verificação (correr a seguir, antes de tocar no front-end) ────────
-- select count(*) from public.patient_portal_links;
-- select count(*) from public.patient_portal_link_aliases;
-- select count(*) from public.patient_diary_tokens where link_id is null;               -- tem de dar 0
-- select count(*) from public.patient_diary_tokens t
--   where not exists (select 1 from public.patient_portal_links pl where pl.token = t.token)
--     and not exists (select 1 from public.patient_portal_link_aliases a where a.old_token = t.token);
--                                                                                        -- tem de dar 0 (nenhum token antigo ficou órfão)
