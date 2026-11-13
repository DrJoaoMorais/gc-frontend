-- Unified authorization for public content. Existing clinical data and expiry dates are not rewritten.
-- Bind public content to its original accompaniment, including across restarts.
alter table public.wo_prescriptions add column if not exists portal_link_id uuid references public.patient_portal_links(id);
alter table public.intake_tokens add column if not exists portal_link_id uuid references public.patient_portal_links(id);
update public.wo_prescriptions pr set portal_link_id=(select pl.id from public.patient_portal_links pl where pl.patient_id=pr.patient_id and pl.created_clinic_id=pr.clinic_id order by pl.created_at desc limit 1) where portal_link_id is null;
update public.intake_tokens it set portal_link_id=(select pl.id from public.patient_portal_links pl where pl.patient_id=it.patient_id and pl.created_clinic_id=it.clinic_id order by pl.created_at desc limit 1) where portal_link_id is null;
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

