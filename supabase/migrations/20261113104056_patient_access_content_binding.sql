-- Unified authorization for public content. Existing clinical data and expiry dates are not rewritten.
-- Bind public content to its original accompaniment, including across restarts.
alter table public.wo_prescriptions add column if not exists portal_link_id uuid references public.patient_portal_links(id);
alter table public.intake_tokens add column if not exists portal_link_id uuid references public.patient_portal_links(id);
-- Historical correspondence: creation interval, first portal for pre-portal records,
-- then ONLY replacements created at precisely the predecessor revocation timestamp.
-- A later restart separated in time is never treated as a replacement.
create temporary table gc_binding_candidates on commit drop as
with content as (
 select 'exercise'::text kind,id,patient_id,clinic_id,created_at from public.wo_prescriptions
 union all select 'question',id,patient_id,clinic_id,created_at from public.intake_tokens
)
select c.*,p.id lid,p.revoked_at from content c join public.patient_portal_links p
 on p.patient_id=c.patient_id and p.created_clinic_id=c.clinic_id
 and ((p.created_at<=c.created_at and (p.revoked_at is null or c.created_at<p.revoked_at))
 or (c.created_at<(select min(x.created_at) from public.patient_portal_links x where x.patient_id=c.patient_id and x.created_clinic_id=c.clinic_id)
 and p.created_at=(select min(x.created_at) from public.patient_portal_links x where x.patient_id=c.patient_id and x.created_clinic_id=c.clinic_id)));
do $$begin
 if exists(select 1 from gc_binding_candidates group by kind,id having count(*)<>1) then raise exception 'Ambiguous historical portal interval';end if;
 if exists(select 1 from (select 'exercise' kind,id,patient_id,clinic_id from public.wo_prescriptions union all select 'question',id,patient_id,clinic_id from public.intake_tokens)c where exists(select 1 from public.patient_portal_links p where p.patient_id=c.patient_id and p.created_clinic_id=c.clinic_id) and not exists(select 1 from gc_binding_candidates x where x.kind=c.kind and x.id=c.id)) then raise exception 'Historical content has no verified interval';end if;
end $$;
create temporary table gc_verified_binding on commit drop as
with recursive chain as (
 select kind,id,patient_id,clinic_id,lid,revoked_at,0 depth from gc_binding_candidates
 union all select c.kind,c.id,c.patient_id,c.clinic_id,p.id,p.revoked_at,c.depth+1
 from chain c join public.patient_portal_links p on p.patient_id=c.patient_id and p.created_clinic_id=c.clinic_id and p.created_at=c.revoked_at where c.depth<30
)
select distinct on(kind,id) kind,id,lid,depth from chain order by kind,id,depth desc;
do $$begin if exists(select 1 from gc_verified_binding where depth=30) then raise exception 'Historical replacement chain requires review';end if;end $$;
update public.wo_prescriptions pr set portal_link_id=m.lid from gc_verified_binding m where m.kind='exercise' and m.id=pr.id and pr.portal_link_id is null;
update public.intake_tokens it set portal_link_id=m.lid from gc_verified_binding m where m.kind='question' and m.id=it.id and it.portal_link_id is null;
create or replace function public.gc_bind_content_portal() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.portal_link_id is null then select id into new.portal_link_id from public.patient_portal_links where patient_id=new.patient_id and created_clinic_id=new.clinic_id order by created_at desc limit 1;end if;
 if new.portal_link_id is not null and not exists(select 1 from public.patient_portal_links where id=new.portal_link_id and patient_id=new.patient_id and created_clinic_id=new.clinic_id) then raise exception 'Ligação fora do contexto clínico' using errcode='42501';end if;
 return new;
end $$;
revoke all on function public.gc_bind_content_portal() from public,anon,authenticated;
create trigger gc_bind_prescription_portal before insert or update of portal_link_id,patient_id,clinic_id on public.wo_prescriptions for each row execute function public.gc_bind_content_portal();
create trigger gc_bind_intake_portal before insert or update of portal_link_id,patient_id,clinic_id on public.intake_tokens for each row execute function public.gc_bind_content_portal();
create or replace function public.gc_bind_new_portal() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.wo_prescriptions set portal_link_id=new.id where patient_id=new.patient_id and clinic_id=new.created_clinic_id and portal_link_id is null;
 update public.intake_tokens set portal_link_id=new.id where patient_id=new.patient_id and clinic_id=new.created_clinic_id and portal_link_id is null;
 return new;
end $$;
revoke all on function public.gc_bind_new_portal() from public,anon,authenticated;
create trigger gc_bind_new_portal after insert on public.patient_portal_links for each row execute function public.gc_bind_new_portal();

