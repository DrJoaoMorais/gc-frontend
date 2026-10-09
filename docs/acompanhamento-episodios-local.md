# Acompanhamento por episódios e decisões

## Estado
Implementação local baseada em origin/main 18136ea. Preparada para publicação autorizada em 09/10/2026. Luís Portela nas imagens e na pré-visualização é um exemplo fictício; nenhum doente real foi classificado.

## Âmbito
- Cinco separadores: Em curso (inicial), Precisam de atenção, Concluídos, Interrompidos e Arquivo/testes.
- Atenção inclui tarefas atuais e respostas clínicas pendentes de episódios encerrados. Testes ficam fora desta fila. Os números contam doentes distintos, não pendências. O mesmo doente pode ter um episódio atual e outro visível no histórico.
- Preserva pesquisa, paginação, seleção de clínicas, a abertura da ficha e a proteção de rascunhos.
- Concluir, interromper (abandono ou suspensão) e arquivar exigem decisão com motivo. O encerramento tem data confirmada pelo médico.
- Testes são identificados explicitamente. Não se inferem pelo nome.
- Reativar cria um novo episódio, com início hoje, sem copiar prescrições anteriores. O botão não aparece se a mesma clínica já tiver outro episódio ativo.
- Cada decisão acrescenta um evento; não atualiza nem elimina eventos anteriores.
- Os episódios antigos têm início desconhecido; a interface apresenta «por confirmar». A primeira decisão conserva o contexto anterior. Não se reconstrói retroativamente uma cronologia clínica que não esteja registada.
- Uma prescrição antiga continua no seu episódio. Um treino registado depois do encerramento nesse plano permanece consultável no histórico; não é transferido para o novo episódio.
- Uma revisão feita agora sobre uma pendência histórica fica associada ao episódio original.
- Gerir episódio também permite corrigir a classificação de um episódio fechado, registando nova decisão e preservando a anterior.

## Fora do âmbito
Sem alterações a prescricao.js, prescricao.css, acompanhamento individual, calendário do exercício, portal, planos, respostas, sessões, mensagens, validade das ligações ou envio de contactos. A reorganização não expira links nem resolve alertas clínicos automaticamente.

A preparação não inclui classificar os doentes reais nem iniciar episódios reais. Na adoção, os episódios antigos sem decisão confirmada continuam em curso até revisão; um plano terminado ou ausência de resposta não confirma conclusão nem abandono.

## Base de dados
Migrações: 20261009050530_followup_episode_events.sql e 20261009054631_followup_task_decisions.sql.
- Nova tabela de eventos por episódio, reservada ao titular; SELECT/INSERT, sem UPDATE/DELETE pelo cliente.
- Coluna opcional episode_id nas revisões existentes para permitir rever pendências de episódios anteriores após retoma.
- Função record_followup_episode_decision SECURITY INVOKER: valida titular/clínica, motivo, datas, decisão e versão anterior. Bloqueio por doente/clínica impede retomas simultâneas; uma retoma não pode coexistir com outro episódio ativo na mesma clínica.
- Só lê prescrições e questionários para associar IDs; não os altera.
- Para publicar, aplicar a migração antes do frontend. Sem a migração, o carregamento falha explicitamente; nunca apresenta falsamente uma lista vazia.
- Não aplicar à base real sem ordem explícita de publicação.

## Verificação realizada
- 22 testes de modelo, incluindo os testes existentes.
- Migração executada num Postgres local em memória (PGlite 0.3.14), com dados fictícios: importação, encerramento, retoma, histórico, recusa de decisão desatualizada, datas inválidas, permissões de leitura/inserção e recusa de UPDATE/DELETE/anon. Prescrições preservadas.
- Navegador com dados fictícios: cinco separadores, pesquisa, interrupção, reativação, histórico, arquivo/testes, revisão por versão, contexto de clínica, abrir sem escrever, carregamento em erro, resposta antiga, acesso recusado e largura móvel.
- Imports dos módulos alterados versionados para evitar cópias antigas no navegador.
- Sintaxe dos cinco módulos e git diff --check.
- As políticas atuais foram consultadas em modo apenas de leitura. A migração NÃO foi validada contra dados reais nem aplicada à base publicada.

Comandos de repetição:
- node --test tests/followup-model.test.mjs tests/followup-episodes.test.mjs
- node tests/followup-home.browser.mjs (Playwright do runtime do Codex)
- node tests/followup-episodes.sql.test.mjs (depende de ../sql-check/node_modules/@electric-sql/pglite, versão 0.3.14, instalado apenas no espaço de trabalho)

Imagens e pré-visualização usam nomes/dados fictícios. validation/ e supabase/.temp/ são ficheiros locais; não integrar na publicação.

## Percursos aprovados
Rever mostra o registo original antes da decisão. Questionários carregam as respostas com os rótulos das perguntas; mensagens e sintomas conservam o texto original. Contactar e preparar mantêm uma tarefa aberta até confirmação expressa, com nota obrigatória. Abrir não resolve. Decisões concorrentes são recusadas em vez de sobrescritas.

Avisos clínicos associados a episódios são apresentados no acompanhamento; Outros avisos do GC conserva os avisos independentes. Se o acompanhamento falhar, os avisos centrais mantêm-se visíveis. Os filtros Informativos e Resolvidos hoje descrevem os critérios reais. Diários ativos permite consultar evolução e Terminar diário; o histórico e as mensagens pendentes permanecem.
