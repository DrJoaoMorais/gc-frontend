alter table public.wo_exercises
  add column if not exists tecnica_info jsonb;

alter table public.wo_exercises
  add constraint wo_exercises_tecnica_info_object
  check (tecnica_info is null or jsonb_typeof(tecnica_info) = 'object');

comment on column public.wo_exercises.tecnica_info is
  'Instruções estruturadas: posicao_inicial, execucao, pontos_chave, erros_comuns e dicas; cada valor é uma lista de textos.';
