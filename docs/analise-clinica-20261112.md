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
