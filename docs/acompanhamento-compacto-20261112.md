# Acompanhamento compacto — 12 novembro 2026

Publicação autorizada pelo utilizador em 12/11/2026. A implementação não exige migrações nem alterações de permissões. Referência visual aprovada: lista com cinco colunas e painel lateral. A validação clínica autenticada em dados reais continua pendente.

## Apresentação

- Entrada diária em «A rever», com «Prazos» e «Todos». Pesquisa, clínica e episódio visíveis; evolução, intervenções e filtros adicionais recolhidos.
- Uma linha por contexto do doente/clínica/episódio. A paginação continua a agrupar dez doentes, preservando todos os respetivos contextos visíveis.
- Componentes e última atividade identificados. A origem do protocolo vem da sessão prescrita; não se confirma automaticamente uma fase ou data de transição.
- O painel usa os mesmos comandos anteriores de decisão e episódio. Alertas ordenados como na lista; registos secundários recolhidos. Abrir não resolve pendências. Mantém a proteção das notas por guardar.
- Tabela e painel lado a lado a partir de 1180 px; painel abaixo da lista nas larguras intermédias; linhas convertidas em blocos legíveis até 320 px.

## Dados e regras

- `clinical-context.js` complementa o modelo existente sem reescrever fontes. `followup-home.js` acrescenta leitura profissional de ligações do portal, medicação e eventos, sempre por clínica. A relação `patient_portal_links.patient_id → patients.id` foi confirmada em metadados Supabase.
- Medicação ligada ao doente apenas quando a clínica do medicamento coincide com a clínica da ligação. Uma prescrição de medicação isolada pode originar um contexto implícito, sem escrever um episódio.
- Fontes de treino com clínica/doente divergentes da prescrição são excluídas do resumo, com aviso de contagem. Os originais não são corrigidos automaticamente.
- Fim do plano (`data.endDate`), revisão (`dataRevisao`), última sessão de cada componente e expiração do acesso são conceitos separados. Corrigido o rótulo que apresentava expiração da ligação como fim clínico do plano.
- O resumo do programa usa a prescrição mais recente não revogada/não rascunho do episódio. O histórico e as observações conservam todas as fontes desse episódio.
- Revisão, fim de plano/medicação, alterações de dose/suspensão e prazo do questionário geram fontes versionadas até cinco dias antes. A última sessão permanece informação de calendário quando já existe data explícita de fim do plano. Prazo revisto pode ser resolvido ou adiado usando o comando anterior; uma mudança de data produz nova versão.
- Última atividade: registo final, avaliação pré-treino, diário ou conclusão de questionário. Não se infere execução por abertura do portal nem confirmação de toma por evento programado.
- Sequências de pelo menos dois dias civis de Lisboa, separadas para bem-estar pré, bem-estar pós e presença de sintomas. Bem-estar desfavorável reutiliza o limiar existente ≤2/5. Duas sessões no mesmo dia contam como um dia; usa o dia da sessão/snapshot, sem o substituir pelo envio tardio. Um dia sem medida não prova consecutividade. Não se mede intensidade de dor nem se infere dor a partir do bem-estar.
- As sequências têm origem/versionamento próprios; decisões sobre o resumo não encerram automaticamente decisões sobre registos individuais. Os restantes registos continuam disponíveis no painel.
- A ordem de atenção distingue sequências, decisões pendentes, ocorrências clínicas, prazos e registos por rever. O vermelho não é atribuído apenas porque um diário foi enviado.

## Limites preservados

- Questionários da lista continuam limitados à família `pre_consulta_v…`; esta alteração não alarga o circuito a questionários de outras áreas.
- Não há novas tabelas, RLS, mudança de autorizações, classificação de episódios antigos nem alterações a planos/doses reais.
- Permissões e inconsistências identificadas na auditoria anterior continuam por resolver no servidor. Filtrar fontes no frontend não certifica isolamento RLS.
- Medicação não tem associação explícita ao episódio; é apresentada como indicação atual do contexto ativo. Episódios encerrados não recebem uma cópia da medicação atual.
- Não são inferidas datas de cirurgia, fim clínico de fase nem progressões automáticas.

## Verificação

- 37 testes de modelo: suites `clinical-context`, `clinical-workspace`, `followup-model` e `followup-episodes`.
- Teste de navegador anterior atualizado para as novas vistas: fontes, decisões, contacto, adiamento, episódios, notas por guardar, clínicas, diário isolado, erros, acesso reservado e paginação de 1000 exemplos.
- Teste `clinical-compact.browser.mjs`: interface real com fontes fictícias; alertas, medicação, painel lateral, notas, clínica, associações divergentes e larguras 1440/1024/768/375/320.
- Imagens em `validation/compacto-lista-desktop.png`, `compacto-painel-desktop.png` e `compacto-mobile.png`; inspecionadas visualmente. A pasta `validation/` já existia sem controlo de versão.
- `tests/fixtures/clinical-compact.html` é uma demonstração fictícia para os testes de navegador com os módulos reais, sem credenciais nem acesso à base de dados real. As gravações estão desativadas.
- Nenhuma escrita Supabase realizada na validação. A consulta remota desta implementação limitou-se aos metadados de chaves estrangeiras.
