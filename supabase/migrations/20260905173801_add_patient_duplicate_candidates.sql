create or replace function public.find_patient_duplicate_candidates(
  p_clinic_id uuid,
  p_full_name text,
  p_dob date default null,
  p_phone text default null,
  p_email text default null,
  p_sns text default null,
  p_nif text default null,
  p_passport_id text default null,
  p_cc_number text default null,
  p_limit integer default 8
)
returns table (
  id uuid,
  full_name text,
  dob date,
  phone text,
  email text,
  sns text,
  nif text,
  passport_id text,
  cc_number text,
  active_clinic_id uuid,
  in_target_clinic boolean,
  same_name boolean,
  same_dob boolean,
  same_phone boolean,
  same_email boolean,
  same_sns boolean,
  same_nif boolean,
  same_passport boolean,
  same_cc boolean
)
language sql
stable
security invoker
set search_path = public
as $function$
  with input as (
    select
      unaccent(lower(trim(regexp_replace(coalesce(p_full_name, ''), '\s+', ' ', 'g')))) as full_name_norm,
      p_dob as dob_value,
      nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), '') as phone_norm,
      nullif(lower(trim(p_email)), '') as email_norm,
      nullif(regexp_replace(coalesce(p_sns, ''), '[^0-9]', '', 'g'), '') as sns_norm,
      nullif(regexp_replace(coalesce(p_nif, ''), '[^0-9]', '', 'g'), '') as nif_norm,
      nullif(upper(regexp_replace(coalesce(p_passport_id, ''), '\s+', '', 'g')), '') as passport_norm,
      nullif(upper(regexp_replace(coalesce(p_cc_number, ''), '\s+', '', 'g')), '') as cc_norm
  ),
  candidates as (
    select
      pat.id,
      pat.full_name,
      pat.dob,
      pat.phone,
      pat.email,
      pat.sns,
      pat.nif,
      pat.passport_id,
      pat.cc_number,
      pc.clinic_id as active_clinic_id,
      pc.clinic_id = p_clinic_id as in_target_clinic,
      i.full_name_norm <> ''
        and unaccent(lower(trim(regexp_replace(pat.full_name, '\s+', ' ', 'g')))) = i.full_name_norm as same_name,
      i.dob_value is not null and pat.dob = i.dob_value as same_dob,
      i.phone_norm is not null
        and (
          regexp_replace(coalesce(pat.phone, ''), '[^0-9]', '', 'g') = i.phone_norm
          or (
            length(i.phone_norm) >= 9
            and length(regexp_replace(coalesce(pat.phone, ''), '[^0-9]', '', 'g')) >= 9
            and right(regexp_replace(coalesce(pat.phone, ''), '[^0-9]', '', 'g'), 9) = right(i.phone_norm, 9)
          )
        ) as same_phone,
      i.email_norm is not null and lower(trim(coalesce(pat.email, ''))) = i.email_norm as same_email,
      i.sns_norm is not null and pat.sns = i.sns_norm as same_sns,
      i.nif_norm is not null and pat.nif = i.nif_norm as same_nif,
      i.passport_norm is not null
        and upper(regexp_replace(coalesce(pat.passport_id, ''), '\s+', '', 'g')) = i.passport_norm as same_passport,
      i.cc_norm is not null
        and upper(regexp_replace(coalesce(pat.cc_number, ''), '\s+', '', 'g')) = i.cc_norm as same_cc
    from public.patients pat
    cross join input i
    join lateral (
      select pcl.clinic_id
      from public.patient_clinic pcl
      where pcl.patient_id = pat.id and pcl.is_active = true
      order by pcl.created_at desc
      limit 1
    ) pc on true
    where pat.is_active = true
      and exists (
        select 1
        from public.clinic_members cm
        where cm.clinic_id = p_clinic_id
          and cm.user_id = auth.uid()
          and cm.is_active = true
      )
  )
  select *
  from candidates c
  where c.same_name
     or c.same_dob and (c.same_phone or c.same_email)
     or c.same_phone
     or c.same_email
     or c.same_sns
     or c.same_nif
     or c.same_passport
     or c.same_cc
  order by
    (c.same_sns or c.same_nif or c.same_passport or c.same_cc) desc,
    (
      c.same_name::integer
      + c.same_dob::integer
      + c.same_phone::integer
      + c.same_email::integer
    ) desc,
    c.in_target_clinic desc,
    c.full_name
  limit least(greatest(coalesce(p_limit, 8), 1), 20);
$function$;

revoke all on function public.find_patient_duplicate_candidates(
  uuid, text, date, text, text, text, text, text, text, integer
) from public, anon;

grant execute on function public.find_patient_duplicate_candidates(
  uuid, text, date, text, text, text, text, text, text, integer
) to authenticated;

comment on function public.find_patient_duplicate_candidates(
  uuid, text, date, text, text, text, text, text, text, integer
) is 'Procura possíveis fichas duplicadas antes da criação manual ou proveniente de pedido online.';
