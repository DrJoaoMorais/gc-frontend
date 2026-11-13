-- Run after the migration within BEGIN/ROLLBACK. Synthetic rows never persist.
create temporary table gc_access_test_results(result text);
do $test$
declare pid uuid:=extensions.gen_random_uuid();cid uuid:=extensions.gen_random_uuid();lid uuid:=extensions.gen_random_uuid();uid uuid;pt text:=encode(extensions.gen_random_bytes(18),'hex');wt text:=encode(extensions.gen_random_bytes(18),'hex');qt text:=encode(extensions.gen_random_bytes(18),'hex');secret text:=repeat('a',64);json_result jsonb;denied boolean;f text;kind text;arg text;rotated text;new_workout text;new_lid uuid;
begin
 select id into uid from auth.users limit 1;
 insert into public.clinics(id,name,slug,tipo) values(cid,'GC teste transitório',cid::text,'gc');
 insert into public.patients(id,full_name) values(pid,'Pessoa fictícia · teste transitório');
 insert into public.patient_portal_links(id,patient_id,created_clinic_id,created_by,token,access_expires_at,device_key_hash) values(lid,pid,cid,uid,pt,now()+interval '5 days',encode(extensions.digest(secret,'sha256'),'hex'));
 insert into public.wo_prescriptions(patient_id,clinic_id,created_by,token,expires_at,data) values(pid,cid,uid,wt,now()+interval '5 days','{"sessions":[{"session_id":"visible","date":"2026-11-13","notes":"Origem: Ombro"},{"session_id":"hidden","date":"2026-11-13","notes":""}]}'::jsonb);
 insert into public.intake_tokens(patient_id,clinic_id,created_by,token,questionnaire_type,expires_at) values(pid,cid,uid,qt,'pre_consulta_v2',now()+interval '2 days');
 perform set_config('request.jwt.claims','{"role":"anon"}',true);perform set_config('request.jwt.claim.role','anon',true);perform set_config('request.headers','{}',true);
 denied:=false;begin perform public.get_acompanhamento_home(pt);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Portal must reject missing device';end if;
 denied:=false;begin perform public.wo_get_plan(wt);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Direct exercise must reject missing device';end if;
 perform set_config('request.headers',jsonb_build_object('x-gc-device-secret',secret)::text,true);
 json_result:=public.wo_get_plan(wt);if not(json_result->>'ok')::boolean then raise exception 'Authorized device cannot open plan';end if;
 update public.patient_portal_links set access_modules='{"activity":false,"pathology":true}' where id=lid;
 json_result:=public.wo_get_plan(wt);if jsonb_array_length(json_result->'plan'->'sessions')<>1 then raise exception 'Server must filter disabled activity';end if;
 denied:=false;begin perform public.gc_assert_content_access('exercise',wt,null,'hidden');exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Disabled session writes must fail';end if;
 update public.patient_portal_links set device_key_hash=null where id=lid;
 denied:=false;begin perform public.wo_get_plan(wt);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Old device must fail after reset';end if;
 update public.patient_portal_links set device_key_hash=encode(extensions.digest(secret,'sha256'),'hex'),access_expires_at=now()-interval '1 day' where id=lid;
 denied:=false;begin perform public.intake_get_context(qt);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Direct question must follow general expiry';end if;
 update public.patient_portal_links set access_expires_at=now()+interval '1 day',revoked_at=now() where id=lid;
 denied:=false;begin perform public.wo_get_plan(wt);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Revoked portal must block direct exercise';end if;
 denied:=false;begin perform public.intake_get_context(qt);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Revoked portal must block direct questionnaire';end if;
 json_result:=public.gc_patient_entry('exercise',wt);if coalesce((json_result->>'available')::boolean,false) then raise exception 'Entry resolver must reject revoked access';end if;
 -- A new episode must not resurrect child credentials from a revoked one.
 insert into public.patient_portal_links(patient_id,created_clinic_id,created_by,token,access_expires_at,device_key_hash) values(pid,cid,uid,encode(extensions.gen_random_bytes(18),'hex'),now()+interval '5 days',encode(extensions.digest(secret,'sha256'),'hex')) returning id into new_lid;
 denied:=false;begin perform public.wo_get_plan(wt);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'New episode resurrected old exercise';end if;
 select public.get_acompanhamento_home(token) into json_result from public.patient_portal_links where id=new_lid;
 if (json_result->'exercicio'->>'enabled')::boolean or (json_result->'questionario'->>'pending')::boolean then raise exception 'New episode exposes old content';end if;
 -- Restore only the synthetic fixture to exercise the real link replacement command.
 update public.patient_portal_links set revoked_at=now() where id=new_lid;
 update public.patient_portal_links set revoked_at=null where id=lid;
 insert into public.patient_clinic(patient_id,clinic_id) values(pid,cid);
 insert into public.clinic_members(clinic_id,user_id,role,is_active) values(cid,uid,'medico',true);
 perform set_config('request.jwt.claim.sub',uid::text,true);perform set_config('request.jwt.claim.role','authenticated',true);perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',uid)::text,true);
 rotated:=public.rotate_patient_portal_link(pid,cid);
 select token into new_workout from public.wo_prescriptions where patient_id=pid and clinic_id=cid;
 if new_workout=wt then raise exception 'Replacement must rotate exercise credential';end if;
 if exists(select 1 from public.intake_tokens where token=qt) then raise exception 'Replacement must rotate questionnaire credential';end if;
 perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claim.role','anon',true);perform set_config('request.jwt.claims','{"role":"anon"}',true);
 json_result:=public.wo_get_plan(wt);if coalesce((json_result->>'ok')::boolean,false) then raise exception 'Old exercise token survived replacement';end if;
 json_result:=public.authorize_patient_portal_device(rotated,secret);if not (json_result->>'authorized')::boolean then raise exception 'New link cannot be activated';end if;
 json_result:=public.wo_get_plan(new_workout);if not (json_result->>'ok')::boolean then raise exception 'New exercise token cannot open preserved content';end if;
 insert into gc_access_test_results values('15 verificações: segredo, âmbito, prazos, revogação, novo episódio e substituição real de credenciais');
end $test$;
select * from gc_access_test_results;
