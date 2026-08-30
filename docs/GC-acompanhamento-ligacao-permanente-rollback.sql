-- ============================================================================
-- Rollback de supabase/migrations/20260830120000_acompanhamento_ligacao_permanente.sql
-- ----------------------------------------------------------------------------
-- Seguro porque a migration nunca alterou nada pré-existente — só acrescentou.
-- Reverter isto NÃO apaga nenhum token, prescrição, entrada de diário ou
-- medicação que já existisse antes da migration (essas continuam nas tabelas
-- originais, intocadas). O que se perde ao reverter é só o que passou a
-- existir GRAÇAS à migration: as ligações permanentes, os aliases, as
-- medicações estruturadas e o histórico de versão do plano.
--
-- Não correr isto com dados reais em uso sem confirmar primeiro que nenhum
-- link novo (patient_portal_links) já foi enviado a um doente depois da
-- migration — nesse caso o link deixaria de resolver.
-- ============================================================================

drop function if exists public.get_acompanhamento_questionario(text);
drop function if exists public.get_acompanhamento_exercise(text);
drop function if exists public.get_acompanhamento_home(text);
drop function if exists public.set_medication(uuid, uuid, uuid, text, text, text, text, date, date, boolean);
drop function if exists public.set_diary_enabled(uuid, uuid, boolean);
drop function if exists public.set_diary_episode(uuid, uuid, integer);
drop function if exists public.ensure_patient_link(uuid, uuid);

drop trigger if exists trg_wo_prescriptions_bump_version on public.wo_prescriptions;
drop function if exists public.wo_prescriptions_bump_version();

alter table public.wo_prescriptions drop column if exists last_opened_at;
alter table public.wo_prescriptions drop column if exists last_opened_version;
alter table public.wo_prescriptions drop column if exists published_at;
alter table public.wo_prescriptions drop column if exists content_version;

drop table if exists public.patient_medication;
drop table if exists public.patient_portal_link_aliases;
drop table if exists public.patient_portal_links;

alter table public.patient_diary_tokens drop column if exists link_id;

-- patient_diary_tokens.med_nome/med_dose/med_freq nunca foram tocados —
-- nada a reverter aí.
