# Acompanhamento de exercício no Início

## Âmbito aprovado
Painel completo no Início. Remoção das duas listas do menu Exercício, mantendo prescrição, catálogo e o acompanhamento individual. Incluem-se todos os questionários pré-consulta antigos, conforme decisão do utilizador. Nenhum doente é marcado automaticamente como abandonado.

## Comportamento
- Uma linha por doente; contextos e ações de clínicas distintas conservados.
- Estado derivado de planos válidos e questionário mais recente. Prescrições antigas não duplicam linhas.
- Filtros para acompanhamento, questionário, contacto, plano terminado, preparação, pausa, conclusão e abandono confirmado.
- Pendências de sintomas, bem-estar baixo, notas de treino, diário, esforço, alterações de execução, sessões sem registo, questionários e continuidade.
- Limite de aviso de continuidade: cinco dias até ao último treino previsto. Sem próximos treinos é uma pendência distinta da expiração do link.
- Sem registo não é interpretado como falta de execução nem abandono.
- Registo de decisões e revisão por versão da informação. Um registo alterado reaparece como pendente. Abrir não marca como tratado.
- Pausar/encerrar exige motivo; não invalida links do doente. Histórico append-only, reservado ao titular, sem UPDATE/DELETE no cliente.
- Voltar da ficha leva ao Início e mantém a proteção de rascunhos existente. Pesquisa, filtro e página da lista conservados na sessão.
- Diários ativos permanecem acessíveis no cartão original. Outros perfis mantêm o Home anterior.

## Validação
- Testes de modelo (node --test tests/followup-model.test.mjs).
- Testes Playwright com dados fictícios (node tests/followup-home.browser.mjs): filtros, deduplicação, contexto de clínica, abertura sem escrita, guardar estado, tratar pendência, falha de leitura, resposta antiga de outra clínica, acesso recusado, largura móvel e regresso ao Início com rascunho protegido.
- Verificação de sintaxe dos módulos alterados e git diff --check.
- Migração testada em transação com ROLLBACK: leitura/inserção pelo titular, leitura vazia por outro utilizador, anon sem SELECT e cliente sem UPDATE/DELETE. Sem erro no retorno dessa transação.
- Consulta adicional para reconfirmar inexistência da tabela foi bloqueada pela revisão automática por limite de utilização. Não houve tentativa de contornar o bloqueio.

## Publicação ainda pendente
Esta cópia contém a implementação, não uma publicação. A migração 20260916051444_exercise_followup_home.sql tem de ser aplicada antes do frontend. Não publicar o frontend sem a tabela: nesse caso o painel apresenta erro explícito, nunca uma lista vazia falsa.

Antes de publicar: reconfirmar o estado da base de dados e do remoto, validar recusa de INSERT para outro utilizador e a migração aplicada, publicar só os ficheiros desta alteração e verificar os ficheiros públicos. Não incluir validation/ nem supabase/.temp/ no commit.

## Limites
O tipo pre_consulta_vN é a entrada disponível para questionários antes da primeira prescrição. Não existe uma classificação adicional de intenção de exercício. A inclusão de todos estes questionários foi confirmada pelo utilizador.
Não são enviados lembretes nem mensagens automaticamente. O botão abre o acompanhamento existente para contacto e gestão do questionário.
