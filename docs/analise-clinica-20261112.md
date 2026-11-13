# Página de análise clínica individual — 12/11/2026

## Problema e resultado
A lista anterior organiza pendências, mas não relaciona as respostas do doente com o exercício e o tratamento. «Analisar evolução» abre agora uma página inteira, substituindo visualmente a lista enquanto é consultada. A lista, os filtros e os percursos de decisão anteriores são preservados ao voltar.

A página tem quatro áreas: Visão geral; Exercício e tratamento; Questionários e escalas; Diário. A visão geral apresenta três indicadores, um gráfico alternável de bem-estar/esforço e datas selecionáveis. Os restantes dados são apresentados progressivamente.

## Fontes verificadas
Inspeção em leitura do esquema de produção e dos módulos de recolha:

| Área | Fontes reais | Utilização |
| --- | --- | --- |
| Pré-consulta | intake_tokens, intake_responses; modules/intake/configs/pre_consulta*.js | Todas as respostas por secção, lado a lado por preenchimento; objetivos e limitações identificados por pergunta. |
| Pré/pós exercício | wo_session_readiness, wo_session_logs | Bem-estar pré/pós 1–5, presença de sintomas, notas, RPE 0–10, execução registada. |
| Prescrição | wo_prescriptions, wo_session_prescription_snapshots | Sessões, estado e data; detalhe histórico apenas a partir da cópia congelada. |
| Avaliações funcionais | therapist_scale_requests; modules/terapeuta/forms.js | Resultados e respostas com a apresentação existente; comparação só de definições iguais. |
| Escalas clínicas | clinical_scale_requests, clinical_scale_responses, clinical_scale_validations | Resultado validado mais recente por pedido; versões, fórmula e lateralidade separadas. |
| Medicação | patient_portal_links, patient_medication, patient_medication_events | Medicamentos, datas, dose atualmente guardada e alterações programadas/registadas. |
| Protocolos | consultation_protocols, protocols_catalog, protocol_phases | Associação datada com nomes do protocolo/fase; origem textual dos planos preservada à parte. |
| Diário | patient_diary_entries | Texto original por data; contagem de anexos com acesso pela ficha existente. |

Na inspeção agregada existiam 7 pré-consultas concluídas e 4 pedidos de avaliação funcional concluídos. Não existiam pedidos em clinical_scale_requests. Estes números descrevem a inspeção; não estão codificados na aplicação.

## Regras de interpretação
- Histórico completo do doente **na clínica selecionada**, explicitamente indicado no cabeçalho; não se atribuem todos os registos a um único episódio.
- Filtro temporal para sessões, diário e compatibilidade das datas da medicação. Questionários/escalas comparam todos os preenchimentos. Protocolos e alterações de medicação mantêm o histórico disponível.
- Média pré/pós apenas das sessões com ambas as respostas; número de pares visível. Ausência não é zero.
- Dias com sintomas contam dias distintos, não número de sessões.
- Data da sessão: cópia histórica, calendário da sessão, depois data explícita da resposta pré. Nunca se usa envio tardio como dia de exercício.
- Rascunhos de prescrição excluídos da análise de sessões. Uma sessão sem registo final não é apresentada como incumprimento.
- RPE usa 0–10, confirmado pela constraint real; bem-estar usa 1–5. Não se calcula dor a partir de bem-estar.
- Não há diagnóstico automático, inferência de causalidade, recomendação de alteração de tratamento nem transição automática de fase.
- Medicação com datas compatíveis não comprova toma; dose guardada atualmente não reconstrói doses anteriores.
- Resultados funcionais com definições diferentes ficam separados. Escalas clínicas agrupadas por tipo, lateralidade, versões e hashes de definição/fórmula. Variação é descritiva, sem atribuição de relevância clínica.

## Segurança e integridade
`modules/exercicio/clinical-analysis.js` carrega dados apenas ao abrir o doente, com o cliente autenticado existente. Pais são filtrados por doente **e** clínica; filhos por IDs dos pais autorizados. Registos de treino exigem ainda correspondência com a prescrição. Catálogos são lidos apenas para os IDs associados. Leituras paginadas e ordenadas, sem limite silencioso de 1000 registos. Falhas identificam a análise como incompleta e suprimem indicadores que dependam dessas fontes.

Sem novos RPCs, políticas, migrações, chaves, alterações de dados ou inferência de permissões. Não representa uma nova auditoria completa de RLS. Separação real entre duas contas autenticadas continua por validar.

## Verificação
- Testes unitários: pares pré/pós; origem da data; rascunhos/associações divergentes; paginação acima de 1000; separação de versões/lateralidades.
- Navegador com dados fictícios: página inteira, retorno, questionários, diário escapado, fontes de outra clínica excluídas, gráfico de esforço, falhas explícitas e larguras 1440/768/375/320.
- Regressão dos detalhes, histórico, decisões e filtros existentes.
- Capturas de revisão em validation/analise-clinica-desktop.png e analise-clinica-mobile.png usam exclusivamente dados fictícios; não integram a publicação.

## Ajustes de leitura — 13/11/2026

- Período em botões: 14, 30, 90 dias, tudo e intervalo personalizado inclusivo, validado até à data atual. O gráfico, os indicadores, o diário e o calendário respeitam ambas as datas.
- Bem-estar/esforço em botões visíveis.
- Calendário de sete dias, segunda a domingo, com semana anterior/seguinte; começa na semana do registo mais recente do período. Dias fora do período ficam desativados. A mesma navegação substitui a lista longa de sessões no separador do tratamento.
- Exercícios em grelha compacta, duas colunas no computador e uma no telemóvel. Foto exclusivamente do snapshot histórico, nunca substituída pelo catálogo atual. Doses por séries, repetições, duração e carga; estado da execução e notas mantidos. Blocos de atividade contínua/intervalada apresentados com campos legíveis.
- Removida a serialização integral da prescrição/execução na interface. Dados originais intactos.

### Correção do acesso às avaliações
A captura real revelou um erro que os testes anteriores com tabelas simuladas não detetaram. `authenticated` não tem SELECT direto em `therapist_scale_requests` nem `clinical_scale_requests`.

As avaliações funcionais passam pelo acesso existente `therapist_scale_list(p_consultation)`, depois de carregar consultas filtradas por doente e clínica. O corpo atual desta função foi inspecionado: exige autenticação, verifica `gc_scale_private.allowed` e apenas lê resultados. Não se alteraram permissões/RLS nem se criaram funções. O teste impede novas leituras diretas às duas tabelas protegidas e verifica que só se consulta a consulta autorizada.

A fundação separada `clinical_scale_*` não tem API de leitura de equipa disponível. Deixa de gerar uma tentativa falhada em cada abertura; a limitação é indicada no separador das avaliações. **Esta parte permanece sem integração**, não é apresentada como ausência confirmada de respostas. Os questionários de pré-consulta e avaliações funcionais mantêm a integração.

Verificação: testes de limites/viragem do ano, datas inválidas, consultas autorizadas, dose/foto histórica, seleção de medida, intervalo de um dia, semana anterior/seguinte, ausência de texto técnico e apresentação 1440/768/375/320. Validação na sessão autenticada do utilizador continua necessária; não se declarou testada.

## Prioridade ao texto do doente — 13/11/2026

- Selecionar o dia mostra diretamente os exercícios e solicita logo as imagens históricas disponíveis, sem abrir um acordeão. Uma imagem em falta/falhada não é substituída por outra de um treino diferente.
- Resumo de bem-estar/esforço em linha; grelha de três exercícios por linha em espaço suficiente.
- Área «O que o doente escreveu» sempre aberta: sintomas pré-treino, comentário pós-treino, notas individuais de execução/série e diário. Conteúdo original integral, escapado e com quebras de linha preservadas. Sessões múltiplas identificadas.
- Texto ao lado dos exercícios em contentores largos; primeiro, acima dos exercícios, em contentores estreitos. Sem altura limitada, texto cortado ou scroll interno. Notas extensas podem requerer scroll da página.
- Teste de visibilidade em 1440/768/375/320, imagens sem clique adicional, texto longo e caracteres HTML. Capturas com dados e imagens fictícios.
