# Mensagens e tarefas — implementação local

Base: `65a35505b2fe6579e8524979768e791fb6cda66d` (main consultado em 6 de outubro de 2026).
Preparação de publicação autorizada pelo utilizador em 6 de outubro de 2026. A confirmação do estado servido e da migração é registada separadamente após a publicação.

## Comportamento

O bloco mostra três mensagens recentes, não retiradas, da única clínica ativa. As mensagens não são filtradas pelo dia da Agenda: permanecem ao avançar para amanhã ou para outro dia. Com várias clínicas selecionadas, fica desativado e pede uma única clínica. A seleção múltipla da Agenda mantém-se para as marcações.

Nova mensagem abre um formulário no próprio bloco amarelo, acima das mensagens recentes. Enviar e Cancelar recolhem o formulário. Não abre uma janela para escrever. Clínica automática, destinatários ativos da clinic_members, doente opcional pesquisado por nome em patient_clinic, mensagem, opção de tarefa, Cancelar/Enviar. Associações históricas em patient_clinic são admitidas; is_active nessa tabela representa a clínica principal do doente, não a ausência de associação.

Por tratar/Resolvido são botões que permitem resolver e reabrir. As mensagens resolvidas têm «Retirar», que as remove do bloco inicial para todos os membros da clínica e mantém o histórico em «Ver todas». Reabrir uma mensagem retirada volta a disponibilizá-la no bloco inicial, sujeito à ordem das três mais recentes. Todos os membros ativos da respetiva clínica podem tratar as mensagens. Abrir vai ao Feed do doente quando associado; sem doente, mostra o texto completo. Ver todas pagina apenas a atividade dessa clínica.

Mudanças de clínica limpam imediatamente o conteúdo anterior e recolhem o formulário de mensagem. Respostas atrasadas da clínica anterior não aparecem na atual. As mensagens mantêm a autoria e o histórico mesmo se um destinatário deixar de estar ativo.

## Proteção preparada

Tabela nova agenda_messages com clinic_id obrigatório e RLS por pertença ativa à clinic_members, sem exceção global de super_admin. Inserção exige autor autenticado, destinatário da clínica e doente associado à mesma clínica. O cliente só pode inserir os campos do formulário e alterar status e hidden_from_home; não pode mudar clínica, autoria, texto ou eliminar mensagens.

Os perfis existentes só permitem leitura do próprio perfil. Uma consulta limitada devolve apenas identificador e nome dos colegas ativos na clínica autorizada. A função privilegiada está em agenda_private, exige pertença ativa e não aceita acesso anónimo. A função pública é SECURITY INVOKER. As regras gerais de profiles não são alteradas.

## Verificação

43 verificações numa base PostgreSQL local (PGlite 0.3.14), com a migração real e dados fictícios de duas clínicas. Incluem RLS para leitura, inserção e alteração; acesso anónimo; ausência de pertença; pertença inativa; destinatário/doente de outra clínica; clínica nula; autoria forjada; impossibilidade de mudar clínica mesmo pertencendo a ambas; retirada apenas de mensagens resolvidas; histórico preservado; reabertura; nomes dos destinatários; revogação de pertença.

Teste em Chrome com os módulos reais da interface e respostas de dados simuladas: enviar com/sem doente, tarefa, estado, Feed a partir do bloco e da lista completa, pesquisa e destinatários por clínica, paginação, formulário dentro do bloco, recolher ao enviar/cancelar, mensagens recentes visíveis durante a escrita, retirar uma mensagem resolvida, mudar para o dia seguinte com mensagens pendentes visíveis e retiradas ausentes, histórico com mensagens retiradas, troca de clínica, respostas atrasadas, seleção múltipla, conteúdo HTML tratado como texto e disposição a 1440/760 píxeis.

Verificação de sintaxe e git diff --check. Sem alterações no módulo de exercício.

Limite: não foi feita uma criação autenticada no Supabase real, porque exigiria aplicar a migração. A preparação e os testes locais não equivalem a uma validação em produção.

## Repetir testes locais

A partir da raiz desta cópia:

```sh
npm install --prefix work/messages-test-runtime --no-audit --no-fund @electric-sql/pglite@0.3.14 playwright-core@1.55.0
NODE_PATH="$PWD/work/messages-test-runtime/node_modules" node tests/agenda-messages-rls.cjs
NODE_PATH="$PWD/work/messages-test-runtime/node_modules" node tests/agenda-messages-ui.cjs
node --check modules/agenda-messages.js
node --check modules/agenda-workspace.js
node --check modules/agenda.js
git diff --check
```

O teste visual usa Google Chrome em /Applications/Google Chrome.app. Só usa dados fictícios e intercepta pedidos para gc.test.

## Antes de uma futura publicação autorizada

Rever o diff contra a main atual. Aplicar a migração e verificar permissões e consulta de nomes num ambiente de teste antes de ativar a interface. Atualizar as versões de carregamento dos ficheiros alterados segundo o processo de publicação da aplicação. Publicação apenas depois de o utilizador dizer «publica».
