-- Módulo Objetivos redesenhado (modules/obj/objetivos/).
-- Aditivo e reversível: 3 colunas novas em consultation_diagnoses, todas
-- com default, sem tocar em linhas existentes nem noutras tabelas.
-- Rollback: git tag rollback-objetivos-obj-20260917 (antes desta migração)
-- + `ALTER TABLE consultation_diagnoses DROP COLUMN generates_objectives,
-- DROP COLUMN is_new_episode, DROP COLUMN objectives;` se necessário.
--
-- generates_objectives: "gera objetivos" — ligado por omissão para
--   qualquer diagnóstico (decisão do Morais: sem faixa de códigos ICD-9;
--   o médico desliga manualmente quando não se aplica).
-- is_new_episode: quando true, o motor não mostra "anterior" para nenhuma
--   categoria (recidiva anos depois, não continuação do que já vinha).
-- objectives: estrutura por categoria (dor/forca/adm/equilibrio/avd/
--   retorno/tonus/livre) + estados + dependencia — ver cabeçalho de
--   modules/obj/objetivos/motor.js para o formato exacto.

ALTER TABLE consultation_diagnoses
  ADD COLUMN generates_objectives boolean NOT NULL DEFAULT true,
  ADD COLUMN is_new_episode        boolean NOT NULL DEFAULT false,
  ADD COLUMN objectives            jsonb   NOT NULL DEFAULT '{}'::jsonb;
