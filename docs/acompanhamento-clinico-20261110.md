# Acompanhamento Clínico

## Comportamento

Entrada própria no menu, reservada ao titular, com Doentes, Evolução e Intervenções. O Início apresenta um resumo e abre a nova entrada. Os filtros de clínica, estado, observações e intervenção são comuns às vistas. Uma linha por doente conserva os contextos de cada clínica e episódio.

A ficha integra resumo, observações por sessão, planos, questionários/diário e histórico. Os formulários e anexos completos continuam acessíveis pela ficha atual; o editor de prescrição e o portal do doente mantêm-se. Diários podem alimentar a lista sem prescrição ou questionário. Episódios implícitos mantêm início por confirmar, sem escrita automática nem tarefa de preparação artificial.

As observações reutilizam `buildTimelineSessions`, `classifySession` e `resolveSessionDate` da ficha existente. Não se altera o classificador. Na lista, o estado técnico `NAO_REALIZADA` é apresentado como «sem registo», sem inferir incumprimento. Não se cria pontuação clínica nem se infere dor/função. Snapshots preservam sessões removidas e a identidade da sessão; duas sessões no mesmo dia continuam distintas.

Intervenções explicitamente pendentes de episódios encerrados permanecem consultáveis. A vista Intervenções abre inicialmente todos os estados clínicos quando se vem da seleção Em curso; o filtro pode ser alterado. Registos históricos sem decisão pendente ficam no Histórico por rever, paginado. Testes são separados explicitamente.

Revisão, contacto, preparação e encerramento usam as funções existentes, com a versão da fonte e o evento anterior esperado. Abrir não resolve; contacto/preparação permanecem pendentes até confirmação. O adiamento exige data e guarda `Rever em: AAAA-MM-DD` numa linha da nota da decisão `defer`, usando o contrato existente sem migração. A tarefa continua visível, com a data; não há envio automático ou agendamento externo.

Notas por guardar são protegidas na navegação interna, filtros, fecho e acesso ao painel clínico. O isolamento de apresentação é pelo contexto de clínica; ao trocar de clínica, a ficha anterior fecha. Pedidos cancelados por mudança de vista/clínica não substituem resultados atuais. Uma falha de carregamento é apresentada como erro, nunca como lista clínica vazia.

## Limites

- Não há migração, alteração de políticas RLS, permissões profissionais, doses, prescrições publicadas ou classificação de episódios reais.
- A reserva à conta titular e as regras de servidor anteriores mantêm-se. Os testes com duas clínicas usam dados fictícios; não demonstram isolamento RLS com duas contas reais. As limitações de autorização identificadas na auditoria continuam a exigir trabalho próprio.
- O carregamento inicial ainda usa as fontes existentes paginadas em lotes. A apresentação é paginada e as observações têm cache por contexto/período. Resumos paginados no servidor e carregamento de fontes apenas ao abrir a ficha ficam para otimização posterior.
- A ficha mostra as últimas 20 entradas de diário e remete para a ficha atual para consulta completa/anexos. Questionários completos continuam nos formulários atuais e na revisão de respostas.

## Verificação

- 30 testes de modelo: episódios/decisões anteriores, períodos, snapshots, sessões no mesmo dia, fontes sem data, contexto de clínica, pendência histórica e entrada por diário.
- Navegador com dados fictícios: três vistas, ficha, fonte original, nota por guardar, autorização do menu, contacto e adiamento persistidos pelo comando existente, encerramento sem alterar fontes, duas clínicas, diário sem prescrição, erros/repetição, resumo inicial e 1000 doentes com pesquisa/paginação.
- Aspeto inspecionado em computador e telemóvel; verificações de transbordo a 375 e 320 px. Sintaxe dos módulos alterados e `git diff --check`.
- Nenhuma decisão ou prescrição real foi usada nos testes de escrita.

Comandos:

```sh
node --test tests/clinical-workspace.test.mjs tests/followup-model.test.mjs tests/followup-episodes.test.mjs
node tests/followup-home.browser.mjs
```

O teste de navegador usa o Playwright do runtime local do Codex. As imagens em `validation/` são locais e não integram a publicação.
