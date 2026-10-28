# Trocanterite — revisão científica e adaptação ao GC

Revisão: 28 de outubro de 2026. Programa conservador para adultos com dor lateral da anca clinicamente compatível com tendinopatia glútea. Não é um protocolo pós-operatório ou de rotura aguda.

## O que mudou

- Nome clínico alargado para síndrome de dor do grande trocânter/tendinopatia glútea. “Trocanterite” mantém-se como termo de pesquisa.
- Três fases por resposta clínica, sem calendário obrigatório: carga inicial tolerada; carga progressiva; capacidade funcional e regresso à atividade exigente.
- Seis opções em cada fase. Habitualmente selecionam-se 2–3 inicialmente e 3–4 depois. São escolhas de organização clínica, não números ótimos demonstrados. Os dois isométricos são alternativas.
- Retirada a obrigação de realizar 5 × 45 segundos, caminhar 20 minutos ou manter apoio unipodal 30 segundos antes de progredir.
- Retirados ajustes automáticos do selim, acessórios obrigatórios na natação, aumento semanal percentual fixo e instabilidade/olhos fechados como progressão automática.
- Mantida atividade tolerada. A carga do exercício é somada à do trabalho, caminhada e desporto.
- Retirados alongamentos em adução e exercícios do tronco como componentes obrigatórios da fase irritável. Podem existir indicações individuais, mas não justificam preencher a biblioteca por rotina.
- Ecografia/RM deixam de ser requisito universal ou consequência automática de completar 6–8 semanas.
- Recomendações para o doente separadas das notas clínicas. Sem rótulos de confiança, hipóteses diagnósticas ou bibliografia técnica no texto enviado ao doente.

## O que a evidência permite afirmar

**[Certo]** O ensaio LEAP apoia educação sobre carga associada a exercício na tendinopatia glútea persistente. Às 52 semanas, houve vantagem na melhoria global relativamente à infiltração, sem diferença significativa na intensidade da dor. Não permite afirmar que este catálogo de 18 opções foi ensaiado, nem generalizar diretamente a doentes com traumatismo ou dor aguda muito irritável. [Mellor et al., BMJ 2018](https://www.bmj.com/content/361/bmj.k1662).

**[Certo]** O protocolo do ensaio inclui gestão da compressão, reforço dos abdutores e tarefas funcionais com progressão supervisionada. A monitorização não usava um único limite de dor igual em todas as tarefas. O limite inicial de 3/10 aqui adotado é uma referência conservadora ajustável, e não um limiar de segurança validado. [Mellor et al., BMC 2016](https://pmc.ncbi.nlm.nih.gov/articles/PMC4852446/).

**[Certo]** O consenso ISHA recomenda avaliação dos défices, educação postural e exercício adaptado. É um consenso de especialistas; não demonstra uma dose ótima ou critérios universais de retorno ao desporto. A síndrome inclui diferentes causas de dor lateral da anca e exige diagnóstico diferencial. [ISHA, publicado em 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10234389/).

**[Certo]** Um pequeno ensaio piloto encontrou melhorias com programas isométricos e isotónicos. A dimensão e o desenho não permitem prometer superioridade dos isométricos ou analgesia imediata. [Clifford et al., 2019](https://pubmed.ncbi.nlm.nih.gov/31673402/).

**[Provável]** Selecionar poucas opções, ajustar a carga e acompanhar sono, função e resposta no dia seguinte é uma aplicação clínica coerente com estas fontes. As séries, repetições, pausas e a divisão em três fases são adaptações práticas; não constituem um novo protocolo experimentalmente validado.

## Aplicação individual

Antes de prescrever, confirmar lado, duração, irritabilidade, marcha, força abdutora, tarefas-alvo, traumatismo, infiltrações recentes e restrições relevantes. Dor inguinal, fraqueza marcada, perda de capacidade de apoio ou evolução atípica exigem reavaliação. O programa não deve atrasar o esclarecimento de uma suspeita de fratura ou rotura relevante.

Reavaliar a dose após as primeiras sessões e perante agravamento. Na melhoria, progredir uma variável de cada vez. Para corrida, saltos ou mudanças de direção, acrescentar preparação específica individual; entrar na terceira fase não equivale a autorização automática para competição.

## Imagens e verificação

Oito ilustrações novas com o modelo masculino de referência enviado pelo utilizador, geradas com a ferramenta incorporada image_gen, e seis imagens do catálogo existente. Isométricos com elástico em laço, sem cinta. Série inicial rejeitada e substituída após inspeção individual. Prompts guardados em `prompts-imagens.json`. Inspeção visual de membros, mãos/pés visíveis, apoios e correspondência com a técnica. Nas imagens existentes com maior amplitude ou plataforma alta, a instrução explicita a adaptação individual. Esta inspeção não é uma certificação anatómica independente.

O ficheiro `protocolo.json` contém o conteúdo para integrar no GC. `aplicar.sql` insere apenas novos registos. Não modifica prescrições, sessões, respostas, mensagens ou versões anteriores. A integração visual do cartão foi preparada no código local.

**Estado:** preparado localmente. A publicação das imagens, atualização do cartão e ativação definitiva na base de dados devem ser coordenadas para evitar imagens em falta. A confirmação da interface autenticada e de um link real de doente não é substituída pelos testes de estrutura.
