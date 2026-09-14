-- Restrição temporária do acesso profissional. Preserva políticas existentes
-- e RPCs do portal do doente, que continuam a validar os respetivos tokens.
DO $migration$
DECLARE t text; definition text;
BEGIN
  FOREACH t IN ARRAY ARRAY['wo_prescriptions','wo_exercises','wo_session_logs',
    'wo_session_readiness','wo_session_prescription_snapshots','wo_session_doctor_messages',
    'wo_session_images','wo_zone_profiles','wo_zone_ranges',
    'protocols_catalog','protocol_phases','protocol_phase_exercises'] LOOP
    EXECUTE format('CREATE POLICY exercise_owner_only ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((select auth.uid()) = %L::uuid) WITH CHECK ((select auth.uid()) = %L::uuid)',
      t, '32a24abe-cd69-42d9-bf3a-3355f4f6e28c', '32a24abe-cd69-42d9-bf3a-3355f4f6e28c');
  END LOOP;
  SELECT pg_get_functiondef('public.wo_send_session_message(uuid,text,text)'::regprocedure) INTO definition;
  IF strpos(definition, 'if auth.uid() is null then') = 0 THEN
    RAISE EXCEPTION 'wo_send_session_message mudou: rever antes de aplicar';
  END IF;
  definition := replace(definition, 'if auth.uid() is null then',
    'if auth.uid() is distinct from ''32a24abe-cd69-42d9-bf3a-3355f4f6e28c''::uuid then');
  EXECUTE definition;
END
$migration$;

CREATE POLICY exercise_owner_only ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
USING (bucket_id <> 'wo-exercises' OR (select auth.uid()) = '32a24abe-cd69-42d9-bf3a-3355f4f6e28c'::uuid)
WITH CHECK (bucket_id <> 'wo-exercises' OR (select auth.uid()) = '32a24abe-cd69-42d9-bf3a-3355f4f6e28c'::uuid);
