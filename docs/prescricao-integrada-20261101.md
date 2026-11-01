# Prescrição integrada — 01-11-2026

Base: commit `3c320a3` (versão de 01-11-2026). Implementação numa cópia isolada; as restantes pastas locais não foram alteradas.

## Funcionamento

- Calendário principal com uma semana de cada vez; navegação mantém as restantes sessões em memória e no programa guardado.
- Biblioteca integrada: Circuitos, HIIT, Força e Mobilidade, com nomes e IDs explícitos de exercícios existentes no catálogo. Modelos incompletos ficam indisponíveis.
- Exercícios e distribuição regional consultáveis nos cartões e nos treinos do calendário. As contagens por região não representam percentagens de carga muscular.
- Selecionar/retirar exercícios de um bloco afeta apenas a proposta. Colocar num dia cria um rascunho independente, aberto no editor existente.
- Força e mobilidade exigem dose individual no editor. Nos circuitos, a proposta distingue o tempo-alvo principal do aquecimento e retorno à calma; o prescritor deve rever execução, pausas, voltas e intensidade antes de confirmar.
- Cópia da semana cria novos IDs de sessões, preserva a origem e não ajusta a validade do link. Quando há treinos no destino, pede confirmação para juntar cópias.
- Validade do link independente do período do programa, incluindo uma validade anterior ao último treino. O fim do programa já não prolonga o acesso automaticamente.
- Abertura de um plano não revogado com acesso expirado mantém o programa disponível ao prescritor.
- Renovar apenas o acesso preserva o token e o conteúdo guardado, verifica doente/clínica/estado e confirma a linha atualizada. Não reativa planos revogados; alterações pendentes do programa precisam de ser guardadas primeiro.
- Gravação completa confirma a linha devolvida, evita duas gravações simultâneas e preserva a identidade do plano e das sessões existentes.
- Mantidos os editores de corrida, ciclismo, natação, caminhada, circuitos, protocolos, catálogo e planos pré-feitos de casa, bem como a decoração do calendário do acompanhamento.

## Verificação executada

- 34 testes DOM de prescrição: edição por dia, modalidades existentes, catálogo, dose individual, cópia, validade independente, renovação, falhas de escrita e programa completo após expiração.
- 26 testes de regressão: circuitos, planos de casa, programa de casa, organização do catálogo, disponibilidade e navegação do acompanhamento.
- Sintaxe JavaScript e `git diff --check` sem erros.
- Pedidos à base de dados simulados nos testes; nenhum teste escreveu dados clínicos reais.

Comandos (Node 20; testes DOM usam linkedom 0.18.14 já disponível no ambiente):

```sh
NODE_PATH=/private/tmp/gc-care-dom/node_modules node --test tests/prescricao-edicao-dia.test.cjs
NODE_PATH=/private/tmp/gc-care-dom/node_modules node --test tests/circuito-tempo.test.mjs tests/planos-casa.test.mjs tests/programa-casa.test.mjs tests/catalogo-organizacao.test.mjs tests/disponibilidade-questionario.test.mjs tests/acompanhamento-navigation.test.cjs
```

## Verificação pendente

- O teste de navegador `tests/prescricao-integrada.browser.cjs` foi preparado, mas não executou: Chrome terminou durante o arranque neste ambiente. Layout real e comportamento visual a 1280/768/390 px continuam por verificar.
- Não foi efetuada publicação, alteração de tabelas/políticas, nem gravação de teste na Supabase real. A integração real com o portal e permissões deverá ser verificada antes da publicação.
- Os modelos iniciais usam o catálogo revisto, não uma transcrição confirmada dos vídeos do utilizador.
- A validade aqui tratada é a da prescrição de exercício (`wo_prescriptions.expires_at`). A ligação geral do acompanhamento tem configuração própria que não foi alterada.
