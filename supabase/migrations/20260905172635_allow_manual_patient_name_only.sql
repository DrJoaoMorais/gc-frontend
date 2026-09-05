-- Permite a criacao manual rapida apenas com o nome.
-- A distincao entre criacao manual e pedido online permanece no frontend:
-- os pedidos online continuam a recolher nascimento, telefone e email.
-- A prevencao de duplicados por identificadores oficiais mantem-se atraves
-- dos indices UNIQUE ja existentes para SNS, NIF e passaporte.

alter table public.patients
  drop constraint if exists patients_identity_or_contact_check;

comment on table public.patients is
  'Doentes da Gestao Clinica. Na criacao manual apenas o nome e obrigatorio; os restantes dados sao opcionais e devem ser confirmados posteriormente. Os pedidos online mantêm validacao propria.';
