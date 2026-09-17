-- Pré-requisito para ligar modules/obj/objetivos/ a feed-doente.html.
-- save_consultation_diagnoses fazia sempre DELETE de tudo + INSERT de novo
-- sempre que a lista de diagnósticos da consulta era regravada — isso
-- limpava generates_objectives/is_new_episode/objectives (colunas da
-- migração 20260917140511) de qualquer diagnóstico já trabalhado, mesmo
-- que continuasse selecionado. Passa a só remover os diagnósticos
-- deselecionados e só inserir os que ainda não existem, preservando as
-- linhas que já lá estavam.
CREATE OR REPLACE FUNCTION public.save_consultation_diagnoses(p_consultation_id uuid, p_diagnosis_ids text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  BEGIN
    DELETE FROM consultation_diagnoses
    WHERE consultation_id = p_consultation_id
      AND diagnosis_id NOT IN (
        SELECT id::uuid FROM unnest(p_diagnosis_ids) AS id WHERE id IS NOT NULL AND id != ''
      );

    IF p_diagnosis_ids IS NOT NULL AND cardinality(p_diagnosis_ids) > 0 THEN
      INSERT INTO consultation_diagnoses (consultation_id, diagnosis_id)
      SELECT p_consultation_id, id::uuid
      FROM unnest(p_diagnosis_ids) AS id
      WHERE id IS NOT NULL AND id != ''
      ON CONFLICT (consultation_id, diagnosis_id) DO NOTHING;
    END IF;
  END;
  $function$;
