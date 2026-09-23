# Editor clínico — 23/09/2026

## Alteração

O Quill 2 representa internamente ambas as listas com OL, distinguindo-as por `li[data-list]`. A gravação anterior persistia `root.innerHTML`, e alguns leitores removiam esse atributo. O módulo `modules/clinical-editor/content.js` converte essas listas em UL/OL aninhados antes da sanitização, tanto na gravação como na leitura de conteúdo histórico. Não há migração nem reescrita de consultas anteriores.

A mesma conversão serve o formulário principal, o editor HDA V2, o FEED e os corpos dos relatórios clínico e de consulta. Substitui-se a atribuição directa de HTML ao Quill por carregamento através do clipboard. O histórico e as propostas pendentes são limpos quando se muda de consulta. Textos com listas e exame objectivo conservam a estrutura integral em vez de passar pelo antigo resumo textual colapsável.

O editor mantém Quill 2.0.3 e a apresentação existente, acrescentando níveis, desfazer/refazer, títulos acessíveis e colagem saneada. Tab/Shift+Tab funcionam em qualquer posição do item; Enter usa o comportamento nativo do Quill. As operações locais não invocam IA.

## IA

O botão chama a função existente `ai-proxy` através do cliente Supabase autenticado. A proposta é editável; Aceitar é explícito e pode ser desfeito. Manter original, erros e respostas tardias conservam o texto. Se o original mudar durante o pedido, a aceitação é bloqueada.

A função passa a usar exclusivamente OpenAI Responses, modelo `gpt-4.1-mini-2025-04-14`, chave `OPENAI_API_KEY` apenas no servidor, `store:false`, limite de 24 000 caracteres e de 8192 tokens de saída. Respostas incompletas são rejeitadas. Não são registados textos ou chaves nos logs. O utilizador tem de estar autenticado e ter vínculo `medico` ou `super_admin` numa clínica; os nomes destes papéis foram confirmados na BD. O prompt exige português europeu, preservação dos factos e das negações e proíbe inferências clínicas novas.

Referências: https://developers.openai.com/api/docs/models/gpt-4.1-mini e https://developers.openai.com/api/docs/guides/text

## Validação executada

- UL, OL, listas mistas, sublistas e HTML legado Quill: igualdade da estrutura após serializar, gravar/reabrir em armazenamento simulado, FEED e sanitizador real do relatório.
- Módulo real `montarEditorHDA`: captura dos payloads enviados a `.update()` através de um adaptador de BD fictício, primeiro UL e depois OL.
- Teclas Enter/Enter, Tab/Shift+Tab, colagem HTML, limpeza de formatação, desfazer/refazer.
- IA simulada: zero chamadas por formatação, clique explícito, proposta editável, aceitar, manter original, desfazer aceitação, falha e conflito com edição posterior.
- Servidor com respostas simuladas: autenticação, autorização, chave em falta, limites, OpenAI como único destino, `store:false`, falha de quota e rejeição de resposta incompleta.
- Sintaxe de todos os módulos alterados e scripts do FEED; `git diff --check`.
- Captura visual e PDF Chromium de teste inspecionados: bolas, números e níveis preservados.
- Leitura da BD real: `consultations.hda` e `objectives` são texto; o único trigger não interno encontrado actualiza `updated_at`. Nenhuma consulta real foi escrita.

## Limites da validação e activação

Não houve publicação, consumo da API real nem teste numa consulta real autenticada. O PDF de teste foi produzido por Chromium local, não pelo serviço de PDF de produção. A existência/validade de `OPENAI_API_KEY` ainda não foi confirmada: a CLI não tem sessão e o dashboard pede login.

Antes de activar: confirmar a chave nos segredos do Supabase; publicar a função `ai-proxy` com `verify_jwt=true` **antes** do frontend; publicar apenas este diff; verificar uma chamada com texto fictício e o fluxo completo em ambiente autorizado. Não colocar chaves em ficheiros públicos nem em mensagens. Nenhuma alteração ao esquema da BD é necessária.

## Reproduzir testes

Servidor estático na raiz do frontend, porta 8766. Dependências de teste: Playwright 1.55.0, Quill 2.0.3 e Chrome. O teste intercepta os recursos Quill para usar o pacote local e bloqueia chamadas HTTPS.

```
NODE_PATH=/caminho/para/node_modules node modules/clinical-editor/tests/browser.cjs
node modules/clinical-editor/tests/proxy.cjs
```

`OUTPUT_DIR` opcional guarda a captura e o PDF de teste. O ficheiro `fixture.html` é apenas um suporte de testes, com dados fictícios.
