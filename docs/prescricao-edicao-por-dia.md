# Reformulação do percurso de edição de treinos — preparação local

## Falha reproduzida

No calendário, «Alterar» substituía a sessão pelo treino-base escolhido; não abria a edição desse dia. «Editar sessão» na biblioteca alterava o treino-base e não as cópias já colocadas. Era possível alterar a caminhada de 60 para 20 minutos nesse editor e continuar a ver 60 minutos no dia agendado.

O teste inicial executado sobre a versão anterior falhou: a primeira ação do cartão não definia uma sessão concreta como destino da edição.

## Percurso novo

1. Calendário como vista inicial, uma semana de cada vez. Datas e ações da semana recolhidas.
2. «Editar» abre apenas a sessão desse dia, com a data e a duração estimada face ao tempo disponível.
3. «Atualizar treino deste dia» atualiza o cartão e o total semanal; os outros dias e o treino-base não são alterados.
4. «Adicionar treino» começa no dia escolhido, abre a biblioteca e depois o editor desse novo treino.
5. «Substituir» é uma ação separada e exige escolher/configurar o treino antes de confirmar.
6. «Guardar plano» transfere o rascunho para a prescrição e chama a gravação autenticada existente num único comando.

Durante a edição, as outras vistas não são renderizadas. Cancelar repõe o calendário sem aplicar o rascunho da sessão. Ao guardar um treino, mantém-se a semana em que estava a ser editado.

O mesmo editor continua a ser usado para exercícios do catálogo, caminhada, corrida, ciclismo e natação. Não foram inventados modelos HIIT ou circuito. As ações de copiar, limpar/remover semana, repetir treino e remover sessão permanecem acessíveis em «Ações da semana» ou no cartão.

## Preservação de dados

A edição de um cartão mantém o identificador da sessão, a data e a ligação aos registos já existentes. Não altera as outras sessões. Só o comando «Guardar plano» usa a gravação existente, com as validações e controlos de acesso anteriores. Não foram alteradas consultas, respostas, mensagens, resultados, tabelas ou funções de servidor durante a preparação/testes.

## Verificação

32 testes passaram: 15 testes do percurso novo, 9 da disponibilidade do questionário e 8 da navegação. Incluem a reprodução 60 → 20, ritmo, cancelamento, criação, substituição, total semanal, preservação de IDs/datas, abertura das modalidades, cópia/remoção, chamada única da gravação e validação de um rascunho vazio.

Os testes executam o código real com DOM e dados fictícios. A gravação remota é substituída nos testes para verificar a chamada e o conteúdo sem alterar dados clínicos. Não equivalem a validação visual ou a uma gravação numa sessão autenticada.

Teste do percurso: requer a dependência de desenvolvimento `linkedom` versão 0.18.14, fora dos ficheiros da aplicação. Executar `node --test tests/prescricao-edicao-dia.test.cjs` num ambiente que a disponibilize. Os testes de disponibilidade e navegação usam apenas o runtime Node.

Publicação autorizada pelo utilizador em 31/10/2026. A verificação dos ficheiros publicados é separada da validação numa sessão autenticada, que permanece pendente.
