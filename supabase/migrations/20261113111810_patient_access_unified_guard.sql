create or replace function public.gc_content_parent(p_kind text,p_token text)
returns uuid language plpgsql stable security definer set search_path='' as $$
declare pid uuid; cid uuid; lid uuid;
begin
 if p_kind='portal' then
  select pl.id into lid from public.patient_portal_links pl where pl.token=p_token or exists(select 1 from public.patient_portal_link_aliases a where a.link_id=pl.id and a.old_token=p_token) order by pl.created_at desc limit 1;return lid;
 elsif p_kind='exercise' then select portal_link_id into lid from public.wo_prescriptions where token=p_token;return lid;
 elsif p_kind='question' then select portal_link_id into lid from public.intake_tokens where token=p_token;return lid;
 elsif p_kind='diary' then select patient_id,clinic_id,link_id into pid,cid,lid from public.patient_diary_tokens where token=p_token;
 end if;
 if lid is not null then return lid;end if;
 select pl.id into lid from public.patient_portal_links pl where pl.patient_id=pid and pl.created_clinic_id=cid order by pl.created_at desc limit 1;
 return lid;
end $$;
revoke all on function public.gc_content_parent(text,text) from public,anon,authenticated;

create or replace function public.gc_assert_content_access(p_kind text,p_token text,p_module text default null,p_session text default null)
returns void language plpgsql stable security definer set search_path='' as $$
declare lid uuid; pl public.patient_portal_links; headers jsonb; secret text; module_key text:=p_module; sess jsonb;
begin
 lid:=public.gc_content_parent(p_kind,p_token);
 -- Standalone historical requests with no portal retain their independent expiry.
 if lid is null then return;end if;
 select * into pl from public.patient_portal_links where id=lid;
 if auth.uid() is not null and public.has_clinic_role(pl.created_clinic_id,array['super_admin','admin','medico','administrativo']::text[]) then return;end if;
 if coalesce(auth.role(),'')='service_role' then return;end if;
 if pl.revoked_at is not null or (pl.access_expires_at is not null and pl.access_expires_at<=now()) then raise exception 'Acesso ao acompanhamento indisponível' using errcode='42501';end if;
 if p_kind='exercise' then
  if p_session is not null then
   select s into sess from public.wo_prescriptions pr cross join lateral jsonb_array_elements(coalesce(pr.data->'sessions','[]'::jsonb)) s where pr.token=p_token and s->>'session_id'=p_session limit 1;
   if sess is null then
    select snap.snapshot into sess from public.wo_session_prescription_snapshots snap join public.wo_prescriptions pr on pr.id=snap.prescription_id where pr.token=p_token and snap.session_id=p_session and snap.frozen_at is not null limit 1;
   end if;
   if sess is null then raise exception 'Sessão indisponível' using errcode='42501';end if;
   module_key:=case when coalesce(sess->>'notes','') like 'Origem:%' then 'pathology' else 'activity' end;
  elsif not coalesce((pl.access_modules->>'activity')::boolean,true) and not coalesce((pl.access_modules->>'pathology')::boolean,true) then raise exception 'Exercício não incluído' using errcode='42501';end if;
 end if;
 if module_key is not null and not coalesce((pl.access_modules->>module_key)::boolean,true) then raise exception 'Área não incluída no acesso' using errcode='42501';end if;
 headers:=coalesce(nullif(current_setting('request.headers',true),'')::jsonb,'{}'::jsonb);secret:=headers->>'x-gc-device-secret';
 if secret is null or length(secret)<32 or pl.device_key_hash is null or encode(extensions.digest(secret,'sha256'),'hex')<>pl.device_key_hash then raise exception 'Activação do navegador necessária' using errcode='42501';end if;
end $$;
revoke all on function public.gc_assert_content_access(text,text,text,text) from public,anon,authenticated;

create or replace function public.gc_filter_exercise_plan(p_token text,p_data jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare pl public.patient_portal_links; ss jsonb;
begin
 select * into pl from public.patient_portal_links where id=public.gc_content_parent('exercise',p_token);
 if pl.id is null or (auth.uid() is not null and public.has_clinic_role(pl.created_clinic_id,array['super_admin','admin','medico','administrativo']::text[])) or coalesce(auth.role(),'')='service_role' then return p_data;end if;
 select coalesce(jsonb_agg(s order by ord),'[]'::jsonb) into ss from jsonb_array_elements(coalesce(p_data->'sessions','[]'::jsonb)) with ordinality as entries(s,ord)
 where coalesce((pl.access_modules->>(case when coalesce(s->>'notes','') like 'Origem:%' then 'pathology' else 'activity' end))::boolean,true);
 return jsonb_set(p_data,'{sessions}',ss);
end $$;
revoke all on function public.gc_filter_exercise_plan(text,jsonb) from public,anon,authenticated;

create or replace function public.gc_patient_entry(p_kind text,p_token text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare pl public.patient_portal_links; module_key text;
begin
 if p_kind not in ('exercise','question','diary') or length(coalesce(p_token,''))<8 then return jsonb_build_object('available',false);end if;
 select * into pl from public.patient_portal_links where id=public.gc_content_parent(p_kind,p_token);
 if pl.id is null then return jsonb_build_object('standalone',true);end if;
 if pl.revoked_at is not null or (pl.access_expires_at is not null and pl.access_expires_at<=now()) then return jsonb_build_object('available',false);end if;
 module_key:=case p_kind when 'exercise' then null else p_kind end;
 if module_key is not null and not coalesce((pl.access_modules->>module_key)::boolean,true) then return jsonb_build_object('available',false);end if;
 if p_kind='exercise' and not coalesce((pl.access_modules->>'activity')::boolean,true) and not coalesce((pl.access_modules->>'pathology')::boolean,true) then return jsonb_build_object('available',false);end if;
 return jsonb_build_object('available',true,'portal_token',pl.token,'open',case when p_kind='exercise' then 'activity' else p_kind end);
end $$;
revoke all on function public.gc_patient_entry(text,text) from public,authenticated;
grant execute on function public.gc_patient_entry(text,text) to anon;

-- Prepend checks to the owning functions, retaining signatures, existing expiry/status checks and grants.
do $migration$
declare r record; definition text; guard text; kind text; module_key text; session_arg text;
begin
 for r in select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in
 ('get_acompanhamento_home','get_acompanhamento_exercise','get_acompanhamento_medication_events','get_acompanhamento_questionario','get_diary_context','get_diary_episode','get_diary_recent','submit_diary_entry','intake_get_context','intake_aceitar_rgpd','intake_gravar_resposta','intake_concluir','wo_get_plan','wo_get_session_messages','wo_log_readiness','wo_log_session','wo_mark_session_message_read','get_workout_context','submit_workout_log','wo_reserve_session_image')
 loop
 definition:=pg_get_functiondef(r.oid);
 if position('gc_assert_content_access' in definition)>0 then continue;end if;
 kind:=case when r.proname like 'get_acompanhamento_%' then 'portal' when r.proname like 'intake_%' then 'question' when r.proname like '%diary%' then 'diary' else 'exercise' end;
 module_key:=case when r.proname='get_acompanhamento_medication_events' then 'med' when r.proname='get_acompanhamento_questionario' or kind='question' then 'question' when kind='diary' then 'diary' else null end;
 session_arg:=case when r.proname in ('wo_log_readiness','wo_log_session','submit_workout_log','wo_reserve_session_image') then 'p_session_id::text' else 'null' end;
 guard:=format(E'begin\n perform public.gc_assert_content_access(%L,p_token::text,%L,%s);',kind,module_key,session_arg);
 definition:=regexp_replace(definition,'\mbegin\M',guard,'i');
 if r.proname='wo_get_plan' then
  definition:=replace(definition,$before$  return jsonb_build_object(
    'ok', true,$before$,$after$  v_presc.data := public.gc_filter_exercise_plan(p_token,v_presc.data);
  select coalesce(jsonb_agg(x),'[]'::jsonb) into v_logs from jsonb_array_elements(v_logs) x where exists(select 1 from jsonb_array_elements(v_presc.data->'sessions') s where s->>'session_id'=x->>'session_id');
  select coalesce(jsonb_agg(x),'[]'::jsonb) into v_readiness from jsonb_array_elements(v_readiness) x where exists(select 1 from jsonb_array_elements(v_presc.data->'sessions') s where s->>'session_id'=x->>'session_id');
  return jsonb_build_object(
    'ok', true,$after$);
 elsif r.proname='wo_get_session_messages' then
  definition:=replace(definition,$before$  return jsonb_build_object('ok', true, 'messages', v_messages);$before$,$after$  select coalesce(jsonb_agg(x),'[]'::jsonb) into v_messages from jsonb_array_elements(v_messages) x where x->>'session_id' is null or exists(select 1 from public.wo_prescriptions pr cross join lateral jsonb_array_elements(public.gc_filter_exercise_plan(p_token,pr.data)->'sessions') s where pr.token=p_token and s->>'session_id'=x->>'session_id');
  return jsonb_build_object('ok', true, 'messages', v_messages);$after$);
 elsif r.proname='get_workout_context' then definition:=replace(definition,'pr.id, pr.data','pr.id, public.gc_filter_exercise_plan(p_token,pr.data)');
 elsif r.proname='get_acompanhamento_home' then definition:=replace(definition,'''questionnaire_type'', it.questionnaire_type, ''token'', it.token','''questionnaire_type'', it.questionnaire_type, ''expires_at'', it.expires_at, ''token'', it.token');
 elsif r.proname='get_diary_recent' then definition:=replace(definition,'where e.patient_id = v_token_row.patient_id','where e.patient_id = v_token_row.patient_id and e.clinic_id = v_token_row.clinic_id');
 end if;
 execute definition;
 end loop;
end $migration$;

-- Portal reads show only the content associated with that accompaniment.
do $mapping$
declare r record; definition text;
begin
 for r in select oid,proname from pg_proc where oid in ('public.get_acompanhamento_home(text)'::regprocedure,'public.get_acompanhamento_exercise(text)'::regprocedure,'public.get_acompanhamento_questionario(text)'::regprocedure) loop
 definition:=pg_get_functiondef(r.oid);
 if r.proname='get_acompanhamento_home' then
  definition:=replace(definition,'t.patient_id = v_link.patient_id and t.clinic_id = v_link.created_clinic_id','t.patient_id = v_link.patient_id and t.clinic_id = v_link.created_clinic_id and t.link_id = v_link.id');
  definition:=replace(definition,'pr.patient_id = v_link.patient_id and pr.clinic_id = v_link.created_clinic_id','pr.patient_id = v_link.patient_id and pr.clinic_id = v_link.created_clinic_id and pr.portal_link_id = v_link.id');
  definition:=replace(definition,'it.patient_id = v_link.patient_id and it.clinic_id = v_link.created_clinic_id','it.patient_id = v_link.patient_id and it.clinic_id = v_link.created_clinic_id and it.portal_link_id = v_link.id');
 elsif r.proname='get_acompanhamento_exercise' then definition:=replace(definition,'where patient_id = v_patient_id','where portal_link_id = public.gc_content_parent(''portal'',p_token) and patient_id = v_patient_id');
 else definition:=replace(definition,'where patient_id = v_patient_id','where portal_link_id = public.gc_content_parent(''portal'',p_token) and patient_id = v_patient_id');
 end if;
 execute definition;
 end loop;
 -- A replacement link also replaces child credentials, without changing clinical records.
 definition:=pg_get_functiondef('public.rotate_patient_portal_link(uuid,uuid)'::regprocedure);
 definition:=replace(definition,'  return v_token;', $rotation$
  update public.wo_prescriptions set token=extensions.gen_random_uuid()::text,portal_link_id=v_new_link_id where portal_link_id=v_old_link_id;
  update public.intake_tokens set token=encode(extensions.gen_random_bytes(18),'hex'),portal_link_id=v_new_link_id where portal_link_id=v_old_link_id;
  update public.patient_diary_tokens set token=encode(extensions.gen_random_bytes(18),'hex') where link_id=v_new_link_id;
  return v_token;$rotation$);
 execute definition;
end $mapping$;
