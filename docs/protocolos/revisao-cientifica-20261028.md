# Auditoria científica dos nove protocolos do GC
**Data da consulta: 28 de outubro de 2026. Destinatário: médico prescritor.**

## Conclusão
Os nove protocolos não podem ser certificados, em bloco, como «cientificamente validados» ou «sem erros». A estrutura de exercício progressivo é em geral defensável, mas há contradições, lacunas de prescrição e recomendações locais apresentadas com aparência de regra universal. TSA e RSA precisam de revisão prioritária. Nos restantes, manter a estrutura com as condições e correções deste relatório.

Esta é uma auditoria documental e bibliográfica do conteúdo atual do catálogo: não é um ensaio clínico do conjunto, uma revisão sistemática registada, uma avaliação formal GRADE/RoB 2 independente, nem uma autorização para cada doente. Os graus de evidência descritos pertencem às fontes quando assim identificado. «Manter condicionado» significa compatibilidade do princípio terapêutico, não validação experimental da ficha ou dose.

## 1. Âmbito e método
Consulta apenas de leitura ao catálogo Supabase; nenhuma ficha de doente ou token de acesso individual foi aberto. Inventário completo guardado em `inventario.json`: 9 protocolos ativos, 33 fases, 95 exercícios distintos e 226 associações fase–exercício. Revistos os textos das fases, objetivos, critérios, recomendações para o doente e médico, técnica dos exercícios, notas das associações e doses estruturadas. As 95 fichas têm imagem referenciada e descrição técnica. Não foi efetuada inspeção anatómica visual das 95 imagens nem teste da execução real pelo doente; isso não fica certificado por este relatório.

Pesquisa dirigida em PubMed/PMC, publicações originais, entidades profissionais e hospitais emissores. Prioridade: normas clínicas, revisões sistemáticas, ensaios comparativos e consensos. Protocolos hospitalares usados apenas como exemplos de prática, sem lhes atribuir força de norma universal. Pesquisa atualizada nesta data, sem garantia de exaustividade bibliográfica. Algumas páginas bloquearam o texto integral; nesses casos foram usados o resumo indexado, excertos verificáveis ou a publicação original disponível noutra entidade, sem presumir acesso a suplementos não consultados.

Perguntas aplicadas a todas as fases: população correta; indicação do exercício; proteção pós-operatória; modalidade ativa/passiva/resistida; dose e coerência interna; progressão; alternativas versus acumulação; sintomas e reavaliação; afirmações de eficácia; correspondência entre fontes e conteúdo.

O ficheiro público do editor servido pelo GC foi consultado nesta data. A função `criarItemPatologia` usa valores genéricos quando não há dose específica. Isto foi confirmado no código servido, sem executar uma prescrição real.

## 2. Inventário e parecer por protocolo

| Protocolo | Fases | Associações | Exercícios distintos no protocolo | Associações sem dose específica | Parecer |
|---|---:|---:|---:|---:|---|
| Tendinopatia lateral do cotovelo | 3 | 18 | 16 | 0 | Manter condicionado; exercício principal e complementos individualizados; Powerball com evidência limitada |
| Sutura da coifa | 5 | 39 | 32 | 39 | Estrutura plausível; definir doses e proteção individual antes de prescrever |
| De Quervain | 2 | 12 | 12 | 0 | Manter como complemento; não apresentar exercício como tratamento principal comprovado |
| Prótese anatómica do ombro — TSA | 5 | 13 | 13 | 13 | Corrigir contradições e completar manutenção/regresso ao desporto |
| Dedo em gatilho | 2 | 12 | 9 | 0 | Manter condicionado, sem ressalto; não prometer efeito adicional dos deslizamentos |
| Prótese invertida do ombro — RSA | 4 | 0 | 0 | 0 | Incompleto enquanto programa de exercício; rever restrições e critérios |
| Capsulite adesiva | 3 | 69 | 48 | 0 | Estrutura individualizada aceitável; corrigir fichas partilhadas e acrescentar enquadramento terapêutico |
| Tendinopatia da coifa | 3 | 16 | 16 | 0 | Princípio alinhado com norma; doses e fases são opções clínicas, não combinação validada |
| Bankart com remplissage | 6 | 47 | 32 | 18 | Manter condicionado; completar doses e vincular limites à reparação e ao cirurgião |

As contagens de exercícios distintos por protocolo sobrepõem-se; não devem ser somadas para obter os 95 globais. «Sem dose específica» significa `prescription_defaults = {}`, não significa que nenhum texto da fase contenha sugestões. Ter dose preenchida também não significa que essa dose tenha sido validada num ensaio.

## 3. Correções prioritárias, com localização exata

### P1 — Corrigir antes de uma nova prescrição baseada nestes elementos
**F01 — TSA, fase 2: rotação interna isométrica em conflito com a própria fase.**
A associação `b51f1ab1-5518-48ad-b203-9fe8ef3dc06d` oferece o isométrico de rotação interna em casa desde a fase de 6–12 semanas. O texto diz «Isométricos (exceto rotação interna)» e a recomendação repete a exclusão; outra restrição refere apenas a 8.ª semana. A ficha global avisa que é necessária autorização, mas não resolve a contradição do catálogo. O consenso ASSET protege o subescapular e não sustenta introduzir carga só porque o doente entrou nessa fase [S01].
**Proposta:** retirar esta opção da seleção inicial da fase 2, ou criar uma condição explícita de autorização cirúrgica individual com data e dose. Harmonizar a restrição da 8.ª semana com o plano operatório; não inventar uma nova semana universal.

**F02 — Setenta associações sem dose específica.**
São 39 da sutura da coifa, 13 da TSA e 18 de Bankart/remplissage. No editor servido, a ausência permite herdar séries, repetições, duração e cadência genéricas. Uma nota «definir antes de prescrever» não impede tecnicamente a gravação. Esses valores são convenções de software, não doses retiradas de uma fonte.
**Proposta:** exigir definição ou confirmação explícita da dose quando esteja ausente. Mobilização passiva por profissional, alongamento, isométrico e exercício resistido precisam de campos adequados, não de uma substituição automática indiferenciada. Sem alterar os planos antigos.

**F03 — RSA: limites gerais apresentados como vitalícios.**
Fase 3: carga «tipicamente acima de ~1–3 kg». Fase 4: «precauções anti-luxação vitalícias» e «~9 kg» acima da cabeça/afastado do corpo. São números e regras que variam entre programas; não há fundamento para os transformar num padrão obrigatório para todas as técnicas e indicações. A orientação AAOS aconselha evitar esforço excessivo e carga repetitiva pesada, respeitando o cirurgião; a investigação comparativa não estabelece esse conjunto de limites vitalícios [S03, S04, S28].
**Proposta:** conservar proteção precoce e progressão orientada; substituir os limites gerais por limites individuais do cirurgião, incluindo tarefas, plano de movimento, carga e duração da restrição. Não interpretar isto como autorização para eliminar restrições já prescritas a um doente.

**F04 — Limites protetores confundidos com metas mínimas.**
TSA fase 1: flexão passiva «≥120°» e rotação externa «≥30°», com notas de teto protetor. RSA fase 1: «≥90°» e «≥20°», também com referência a teto. Um limite máximo e uma meta mínima não são a mesma coisa. O código apresenta a desigualdade; não foi demonstrada progressão automática baseada nela.
**Proposta:** separar «amplitude máxima autorizada» de «critério de evolução». Não basta inverter todos os sinais para ≤: isso poderia fazer uma amplitude mínima cumprir indevidamente um critério de progressão. A decisão deve incluir evolução funcional, sintomas, proteção e autorização individual.

**F05 — Fichas globais contradizem doses e regras das fases.**
A abdução autoassistida em pé com bastão, exercício `934c3aca-a45b-4553-b6fc-92f540e4b7aa`, contém «3 séries de 10, 2–3 vezes/dia», enquanto a associação da capsulite fase 2 configura 1×8. Nessa ficha e nas fichas de rotação externa em pé `f00afd03-51ed-46d8-b2f3-d08028b98a03` e rotação interna atrás das costas `b929675a-b7dc-45ba-a132-bf8f3ef1783b`, aparece a regra fixa «3/10» e «30 minutos». Não foi encontrada validação dessa regra como limite universal para essas populações.
**Proposta:** retirar doses fixas e regras universais da técnica global; apresentar apenas a dose individual da sessão e a monitorização acordada. A dose estruturada deve prevalecer sem coexistir com outra dose no texto.

**F06 — Amplitude, lateralidade e proteção nas fichas antigas.**
A flexão em pé com bastão `d3b9bea4-2f78-4da4-8301-6091b831ba19` manda subir acima da cabeça e sugere aumento com as repetições; é usada na TSA fase 2 e capsulite fase 2. A abdução e rotações em pé descrevem sobretudo o lado direito, e uma frase afirma que uma orientação da palma «protege o ombro». Isso não estabelece segurança para qualquer reparação.
**Proposta:** «suba apenas até à amplitude prescrita»; identificar exemplo de lado e adaptar ao lado tratado; eliminar promessa de proteção e progressão automática. Corrigir a descrição do movimento da mão atrás das costas: é um movimento combinado, não uma medição isolada de rotação interna.

### P2 — Completar e clarificar
**F07 — RSA sem exercícios associados em qualquer das quatro fases.** Há HEP em texto, mas não há quatro programas digitais compostos por fichas. Não apresentar como protocolo digital completo.

**F08 — TSA fases 4 e 5 sem exercícios associados.** A fase 5 tem apenas recomendações gerais; não contém critérios desportivos nem programa detalhado. As fases 4/5 sobrepõem-se conceptualmente. Completar manutenção e retorno em função das tarefas; sem prometer amplitude «completa» ou função «plena» para todos.

**F09 — RSA: regra automática de elevação <90° às 12 semanas.** A nota sugere mudar para uma progressão tipo Levy/lawn-chair. A posição reclinada pode ser uma adaptação, mas não substitui avaliar dor, integridade do deltóide/nervo axilar, rigidez, complicações ou fratura de stress. Reformular como indicação de reavaliação e escolha clínica, não algoritmo obrigatório.

**F10 — Capsulite: referências locais não identificam evidência.** «Capsulite Adesiva.docx» e «PREHAB program-SD5HRFHH-2.pdf» podem ser materiais de trabalho, mas não comprovam eficácia sem autoria, versão e bibliografia rastreáveis. Retirar da lista de evidência científica ou classificar como material educativo/local. As referências Kelley, Lee, Griggs e Diercks são identificáveis [S08–S11].

**F11 — Notas de trabalho ainda em texto transferível.** A ficha de rotação interna em supino a 45° `52272d9d-48ca-412a-ad63-0dcaeec6e0e4` menciona «não usar a ficha do PDF com título e instrução discordantes». É uma nota para revisão interna, não uma instrução útil ao doente. Remover do texto partilhado e manter apenas o movimento ensinado e a amplitude prescrita.

**F12 — Exercícios gerais de ginásio após sutura da coifa.** Chest press, shoulder press, supino, TRX e prancha podem ter utilidade selecionada, mas as associações finais não definem dose e várias notas são apenas «{}». Acrescentar autorização para apoio/carga/posição, dose, adaptação à tarefa e ensino. Não são obrigatórios para todos nem um teste de cicatrização.

**F13 — Critérios de regresso.** Os 80%/90% de simetria de força e o calendário de Bankart são critérios orientadores, não provas de risco zero. Especificar método, posição, lado dominante, força absoluta e tarefa; considerar apreensão e prontidão psicológica. Manter que 20 semanas não autorizam competição [S06, S07].

**F14 — Número de exercícios.** Seis opções por fase é uma escolha de catálogo, não um mínimo terapêutico. Em De Quervain e dedo em gatilho, não acrescentar mobilidade de cotovelo/punho só para atingir seis. A fase inicial da tendinopatia da coifa ainda descreve seis exercícios; permitir uma seleção menor se a carga total o exigir.

**F15 — Tratamentos adicionais e sinais de alarme.** Acrescentar ao enquadramento clínico da capsulite a possibilidade de infiltração intra-articular quando indicada. Nas fases cirúrgicas, incluir instrução clara para contactar a equipa perante ferida a drenar, febre, agravamento súbito, perda nova de função ou sintomas neurológicos; não usar um limiar de dor como autorização para continuar. A decisão terapêutica não pertence ao link de autogestão [S08, S25].

**F16 — Linguagem de controlo escapular nos exercícios de ginásio.** «Ombros baixos» ou «não elevar os ombros» não deve levar a fixar/deprimir as omoplatas durante toda a elevação. Distinguir compensação excessiva do movimento escapular fisiológico. Não tratar uma aparência escapular como diagnóstico ou causa única da dor [S12].

## 4. Revisão científica por protocolo

### 4.1 Prótese anatómica do ombro — TSA
**Base:** proteger o subescapular e os tecidos envolvidos na via de acesso; recuperar mobilidade e depois capacidade. ASSET é um consenso de especialistas, nível IV, e não um ensaio que valide todas as semanas, ângulos e exercícios [S01].

- Fase 1 (0–6): mobilidade passiva protegida e pendulares são compatíveis como opções. O movimento passivo por profissional está corretamente associado à clínica. Individualizar os limites segundo técnica do subescapular e achados operatórios. Corrigir F04.
- Fase 2 (6–12): mobilidade assistida/ativa conforme autorização. Corrigir F01 e F06; não introduzir isométricos de rotação interna por calendário.
- Fase 3 (12–24): reforço gradual pode ser mantido. Os 0,5–1,5 kg e 3–4 sessões/semana são exemplos do modelo, não dose ótima comprovada. Definir recuperação e carga individual.
- Fases 4/5: manter apenas como enquadramento até completar fichas, doses e objetivos funcionais.

**Texto proposto para o doente:** «Cumpra a amplitude e a carga autorizadas para a sua cirurgia. Não acrescente exercícios de força nem leve a mão atrás das costas sem indicação. A equipa ajustará o plano à sua recuperação.»

### 4.2 Prótese invertida do ombro — RSA
**Base:** recuperação funcional do deltóide e musculatura remanescente, proteção da estabilidade e dos tecidos reparados. Um ensaio comparou mobilização ativa precoce e diferida; uma revisão encontrou heterogeneidade e evidência insuficiente para um regime único [S03, S04]. Não extrapolar casos eletivos para fratura, revisão, reconstrução óssea ou procedimentos associados.

- Fase 1: manter proteção e ortótese individualmente prescritas. Os 90°/20° não são objetivos mínimos obrigatórios; corrigir F04.
- Fase 2: progressão ativa adaptada, sem regra universal de amplitude obrigatória.
- Fase 3: reforço adaptado, corrigindo limites genéricos e F09.
- Fase 4: retirar formulações vitalícias universais; manter limites individuais e orientação a longo prazo.
- Todas as fases: completar as associações de exercícios, atualmente inexistentes.

**Texto proposto:** «Siga as restrições do seu cirurgião quanto a posições, apoio e carga. Aumente as atividades gradualmente. Não use um valor geral de quilogramas ou o tempo desde a cirurgia como autorização para progredir.»

### 4.3 Sutura da coifa
**Base:** aplicação gradual de carga à reparação. ASSET 2016 descreve um quadro conservador com fortalecimento progressivo a partir de cerca de 12 semanas, considerando dimensão da rotura, qualidade dos tecidos e características do doente [S02]. AAOS 2025 refere resultados semelhantes entre mobilização precoce e diferida em roturas pequenas/médias; não autoriza generalizar a reparações extensas ou do subescapular [S05].

- Fase 1 (0–6): manter proteção, mobilidade distal e passiva quando autorizadas. A data de início não está automaticamente definida pela existência da ficha.
- Fase 2 (6–12): mobilidade assistida e ativa selecionada; polia não equivale necessariamente a mobilização passiva.
- Fase 3 (12–16): baixa resistência e apoio leve apenas quando autorizados.
- Fase 4 (16–26): maior exigência conforme capacidade, sem obrigatoriedade de TRX ou rotação externa a 90°.
- Fase 5: tarefa específica e retorno condicionado; ginásio geral não substitui avaliação funcional.
- Em todas: resolver as 39 doses ausentes e preservar modificadores do subescapular, rotura extensa/revisão e tenodese.

**Texto proposto:** «Respeite os limites da sua reparação. Só passe do movimento assistido para o ativo, e depois para a força ou o apoio do peso, quando autorizado. Se os sintomas piorarem de forma persistente, peça ajuste do plano.»

### 4.4 Bankart com remplissage
**Base:** a literatura descreve elevada variabilidade. A revisão de 2024 propõe precauções específicas para a rotação interna e a carga de rotação externa, mas reconhece que o esquema sugerido necessita de avaliação prospetiva [S06]. Stony Brook refere Bankart anterior; não valida por si só a combinação com remplissage [S07]. South Bend apresenta um regime combinado, mas é um protocolo local [S26].

- Fases 1/2: proteção e mobilidade progressiva compatíveis; confirmar limites e dose da mobilização clínica.
- Fase 3: a rotação externa resistida no final de 8–12 semanas já contém condição de autorização. Não remover essa condição nem transformar em início obrigatório.
- Fase 4: resistência baixa e progressão de apoio selecionadas.
- Fase 5: posições elevadas e tarefas dinâmicas individualizadas.
- Fase 6: preparação não equivale a competição. Simetria ≥90%, ausência de apreensão, tarefa e autorização são elementos combinados; não limiares isolados validados universalmente. O consenso internacional recente também favorece critérios funcionais em vez de um calendário único [S27].
- Resolver as 18 doses ausentes. Não inferir ângulos que não constam da informação operatória.

**Texto proposto:** «O plano protege duas zonas reparadas. Não force rotações nem aumente o apoio ou a resistência por iniciativa própria. A preparação para o desporto não significa autorização para competir.»

### 4.5 Capsulite adesiva
**Base:** educação e mobilidade adaptadas à irritabilidade; os estádios não impõem calendários fixos. A norma de 2025 admite mobilização, considera autoalongamento como complemento e classifica a evidência do reforço como muito baixa; recomenda considerar infiltração intra-articular [S08]. As recomendações não validam cada variante ou dose do catálogo.

- Fase dolorosa: poucas opções confortáveis; isométricos facultativos após ensaio, sem promessa de analgesia.
- Fase de rigidez: alongamento suave e variantes alternativas; não forçar amplitude ou duplicar sessões.
- Fase de resolução: mobilidade residual e recuperação funcional podem coexistir.
- Corrigir F05/F06/F11 nas fichas globais, apesar das notas de fase mais prudentes.
- Os estudos históricos de Griggs e Diercks são suporte contextual, não prova de superioridade deste programa nem fundamento para prometer recuperação completa [S10, S11].
- Mobilidade cervical, punho e cotovelo apenas se necessária; não são tratamento específico obrigatório da cápsula.

**Texto proposto:** «Procure movimento tolerável, sem forçar o fim da amplitude. Faça apenas as variantes escolhidas para si. Se a dor noturna ou a limitação piorarem, contacte a equipa para rever o plano e as opções de tratamento.»

### 4.6 Tendinopatia da coifa
**Base:** a norma JOSPT 2025 recomenda reabilitação ativa, incluindo resistência e/ou controlo motor; não identifica dose ótima ou superioridade universal de uma combinação específica. Abrange tendinopatia com/sem calcificação e roturas parciais, não a reabilitação de uma sutura nem todas as roturas completas [S12].

- Fase 1: os seis exercícios são opções clinicamente plausíveis. Não é obrigatório fazer todos em todas as situações.
- Fase 2: alternativas à remada, rotação externa, elevação e apoio. Substituir antes de acumular.
- Fase 3: elevação, D2, pressões/apoios e rotação externa a 90° apenas se úteis à função e tolerados.
- Duas/três séries, 2–3 repetições em reserva, cadência 2/3 s e controlo até à manhã seguinte são parâmetros operacionais individualizáveis, não regras validadas como ideais.
- Não atribuir eficácia à «descompressão» ou correção obrigatória da escápula; não afirmar isolamento diagnóstico do supraespinhoso a partir de um teste ou da escolha do exercício.

**Texto proposto:** «Faça os exercícios selecionados com a carga ajustada à sua capacidade. As variantes avançadas substituem ou complementam o plano conforme indicação. Reduza a exigência se piorarem de forma persistente a dor, o sono ou a função.»

### 4.7 Tendinopatia lateral do cotovelo
**Base:** a norma de 2022 admite carga isométrica, concêntrica e/ou excêntrica dos extensores; trabalho proximal quando há défices relevantes [S13]. A Cochrane 2024 encontrou benefícios médios pequenos/incertos de exercício/terapia manual face a intervenção mínima, com baixa certeza; não concluir cura rápida ou superioridade de um regime [S14].

- Fase 1: um isométrico principal se tolerado; pronação/neutro como alternativas. Não há demonstração de superioridade universal da posição neutra.
- Fase 2: extensão do punho com halter OU elástico. A variante excêntrica substitui, não acrescenta volume automaticamente.
- Fase 3: extensão em maior exigência e tarefa funcional relevante. Powerball, transporte e torção são opções; não três obrigações.
- A Powerball tem um ensaio de 50 participantes e três semanas, com intervenções associadas [S15]. O estudo não valida a dose local 2×15 s/duas vezes por semana, nem a sua superioridade geral.
- Não usar suspensão, cargas máximas, rolo pesado ou gestos balísticos como exigências universais.
- PRTEE, tarefa-alvo e preensão são úteis para reavaliação; parestesias e fraqueza progressiva pedem outro enquadramento.

**Texto proposto:** «Conte também o esforço do trabalho e das tarefas domésticas. Faça a variante indicada, sem somar todas as opções. A Powerball é facultativa e deve ser aprendida com o profissional, sem procurar velocidade máxima.»

### 4.8 De Quervain
**Base:** a síntese de 2023 apoia considerar infiltração e ortótese durante um período curto; o benefício funcional adicional médio da ortótese foi inferior ao limiar clínico definido [S16]. A revisão de 2026 existe e conclui favoravelmente sobre algumas combinações, com incerteza relevante [S17]. Nenhuma valida esta sequência de seis exercícios por fase.

- Fase 1: proteção relativa, mobilidade confortável; isométrico apenas se tolerado e não obrigatório.
- Fase 2: carga leve e tarefa gradual; abdução/extensão como alternativas iniciais, sem exigir todos os exercícios.
- O ensaio de McBain é de viabilidade, com 28 participantes, dentro de intervenção multimodal. Não estabelece uma dose ótima nem eficácia isolada dos isométricos [S18].
- O corte de 3/10 é corretamente apresentado como referência prática individual, não garantia de segurança.
- Manter não repetir Finkelstein como exercício, sem confundir ausência de provocação com necessidade de imobilidade completa.
- Não exigir semanas de exercício falhado antes de discutir outras opções.
- Mobilidade do cotovelo é complemento facultativo; apoio no cuidado ao bebé deve ser ensinado, sem pressupor que a figura de uma caixa ensina esse gesto.

**Texto proposto:** «Reduza temporariamente as tarefas que agravam e use a ortótese no horário indicado. Os exercícios são um complemento. Não force o polegar nem repita testes dolorosos; peça revisão se não melhorar ou se surgirem sintomas novos.»

### 4.9 Dedo em gatilho
**Base:** ortótese e infiltração são opções sustentadas. Num ensaio de 120 adultos selecionados, não houve diferenças clinicamente importantes em dor/função entre as opções até um ano; não extrapolar indiscriminadamente para todos os graus, múltiplos dedos ou comorbilidades [S19]. A revisão recente das ortóteses é real, mas a heterogeneidade não justifica impor um modelo/ângulo/horário a todos [S21].

- Âmbito atual adequado: adultos, dedos II–V; não generalizar ao polegar pediátrico.
- Fase 1: mobilidade suave sem ressalto. Punho completo repetido e exercício que provoque bloqueio não são requisitos.
- Fase 2: reforço leve e tarefa apenas sem desencadear ressalto; retirar se reaparecer.
- O ensaio de 76 participantes não mostrou benefício adicional dos deslizamentos após infiltração nos principais resultados às 24 semanas [S20]. Isto não prova inutilidade para rigidez individual, mas impede prometer prevenção de recidiva.
- Preensão com bola é opcional, posterior; não existe validação direta de 2×5 s como dose ótima.
- Manter orientação de vigilância da glicemia após infiltração e sinais de infeção urgente; não esperar por febre [S23, S24].
- Evitar «infiltração resolve 60–90% em todos» e cirurgia obrigatória após exatamente duas infiltrações. O texto atual já evita esses automatismos.

**Texto proposto:** «Movimente o dedo sem provocar estalido ou bloqueio. Não o force quando prende. Use a ortótese e faça apenas as opções indicadas. Se ficar preso, perder extensão ou surgir inchaço e dor intensos, peça avaliação.»

## 5. O que é evidência e o que é escolha do modelo
**Com suporte para o princípio geral:** exercício ativo na tendinopatia da coifa; opções de carga dos extensores no cotovelo; proteção e progressão da carga após reparação; ortótese/infiltração nas tenossinovites, com seleção clínica.

**Com suporte limitado, indireto ou por consenso:** calendário exato das fases; progressões específicas pós-operatórias; muitas variantes funcionais; regimes de autoalongamento na capsulite; carga na fase avançada de De Quervain; reforço depois do ressalto resolvido.

**Sem demonstração de superioridade ou dose ótima para este catálogo:** seis exercícios em todas as fases; regra universal de dor/24 h; cadência 2/3 s; 2–3 repetições em reserva; tempo exato de Powerball; número exato de séries de mobilidade dos dedos; percentagem semanal fixa; limites universais vitalícios em quilogramas.

Não encontrar prova de superioridade não equivale a demonstrar que a opção é ineficaz ou proibida. A prescrição individual pode usá-la como escolha prática, identificada assim nas notas do médico e sem alegações excessivas no texto do doente.

## 6. Resultado da verificação de fontes
- Referências com DOI/PMID verificável: Desmeules 2025; Lucado 2022; Wallis 2024; Powerball 2024; Challoumas 2023; Cuenca-Zaldívar 2026; McBain 2023; Atthakomol 2023; Choi 2025; Nadar 2024; McKenna 2026; Stepan 2014; Kelley 2013; Lee 2025; Griggs 2000; Diercks 2004; Villarreal-Espinosa 2024.
- Não foram encontradas referências inventadas entre esses identificadores. A data 2026 não é, por si, um erro: Cuenca-Zaldívar foi disponibilizado eletronicamente em 2025 e publicado no volume de 2026; o mesmo tipo de distinção aplica-se a McKenna.
- TSA e RSA não têm bibliografia registada no respetivo `data`; as fontes desta auditoria devem ser acrescentadas quando o conteúdo for revisto.
- «Protocolo fornecido pelo médico» é uma origem legítima de um plano local, mas não é prova independente de eficácia.
- Stony Brook: fonte institucional autêntica, mas de Bankart anterior; exige ressalva de âmbito ao usá-la em remplissage.
- South Bend: exemplo de protocolo combinado; não evidência de superioridade.
- Materiais locais da capsulite não foram autenticados como publicações científicas. Não os usar como fundamento principal.

## 7. Critérios de aceitação da versão corrigida
1. Resolver F01–F06 antes de usar automaticamente os elementos afetados numa nova prescrição.
2. Completar RSA e manutenção/retorno TSA, ou assinalar claramente os segmentos sem programa digital.
3. Prescrever doses específicas nas 70 associações incompletas, ou manter seleção dependente de confirmação individual obrigatória; sem inventar «dose científica» onde ela não existe.
4. Sincronizar dose estruturada, nota da fase e ficha global. A ficha técnica descreve o movimento; não contém outro programa fixo.
5. Registar fonte, ano, população e força da recomendação nas notas do médico. As fichas do doente mantêm linguagem clara, sem os rótulos da discussão profissional.
6. Validar separadamente imagens/anatomia, lado, amplitude e equipamento. Uma imagem ilustrativa não autoriza aquela amplitude.
7. Testar a nova prescrição e o link com dados fictícios. Preservar planos antigos, registos e fotografias de prescrição.
8. Reavaliar a evidência quando houver alterações relevantes. Uma revisão datada não é garantia permanente.

## 8. Fontes consultadas
Os identificadores abaixo permitem distinguir publicações, consensos e programas locais. As conclusões deste relatório são sínteses críticas, não transcrições.

- **S01. ASSET, TSA, 2020.** Consenso, nível IV. DOI 10.1016/j.jse.2020.05.019. [Texto](https://pmc.ncbi.nlm.nih.gov/articles/PMC8262512/).
- **S02. Thigpen et al., sutura da coifa, 2016.** Consenso, nível V. DOI 10.1016/j.jse.2015.12.018. [Registo institucional dos autores](https://scholars.duke.edu/publication/1488364).
- **S03. Edwards et al., RSA, 2021.** Ensaio aleatorizado de dois regimes. DOI 10.1177/1758573220937394. [PubMed](https://pubmed.ncbi.nlm.nih.gov/34659491/).
- **S04. Sachinis et al., RSA, 2024.** Revisão sistemática, DOI 10.1177/17585732221144007: Can we accelerate rehabilitation following reverse shoulder arthroplasty? [Texto](https://pmc.ncbi.nlm.nih.gov/articles/PMC11034463/).
- **S05. AAOS, coifa, 2025.** Norma clínica; consultar secções de mobilização pós-operatória e utilização da suspensão. [Documento](https://www.aaos.org/globalassets/quality-and-practice-resources/rotator-cuff/rotator-cuff-2025/rotator-cuff-cpg.pdf).
- **S06. Villarreal-Espinosa et al., 2024.** Revisão sistemática de Bankart/remplissage. DOI 10.26603/001c.123481. [PubMed](https://pubmed.ncbi.nlm.nih.gov/39371186/), [publicação original](https://ijspt.org/wp-content/uploads/2024/10/V19N10_Final.pdf).
- **S07. Stony Brook Medicine.** Protocolo institucional de Bankart anterior. [Documento](https://www.stonybrookmedicine.edu/northforkorthopedics/bankart-repair).
- **S08. Lee et al., 2025.** Norma de capsulite primária. DOI 10.5535/arm.250057. [Texto](https://pmc.ncbi.nlm.nih.gov/articles/PMC12231400/).
- **S09. Kelley et al., 2013.** Norma de capsulite. DOI 10.2519/jospt.2013.0302. [PubMed](https://pubmed.ncbi.nlm.nih.gov/23636125/).
- **S10. Griggs et al., 2000.** Estudo prospetivo não aleatorizado. [PubMed](https://pubmed.ncbi.nlm.nih.gov/11057467/).
- **S11. Diercks e Stevens, 2004.** Comparação prospetiva com desenho quase-experimental; não classificar como ensaio aleatorizado robusto. DOI 10.1016/j.jse.2004.03.002. [Instituição dos autores](https://research.rug.nl/nl/publications/gentle-thawing-of-the-frozen-shoulder-a-prospective-study-of-supe/).
- **S12. Desmeules et al., 2025.** Norma da tendinopatia da coifa. DOI 10.2519/jospt.2025.13182. [Publicação](https://doi.org/10.2519/jospt.2025.13182).
- **S13. Lucado et al., 2022.** Norma da tendinopatia lateral do cotovelo. DOI 10.2519/jospt.2022.0302. [PubMed](https://pubmed.ncbi.nlm.nih.gov/36453071/).
- **S14. Wallis et al., Cochrane, 2024.** Revisão sistemática. DOI 10.1002/14651858.CD013042.pub2. [Cochrane](https://www.cochrane.org/evidence/CD013042_manual-therapy-and-exercise-treating-tennis-elbow).
- **S15. Uttamchandani e Phansopkar, 2024.** Ensaio pequeno de Powerball, Cureus. DOI 10.7759/cureus.56444. [PubMed](https://pubmed.ncbi.nlm.nih.gov/38638770/).
- **S16. Challoumas et al., 2023.** Revisão sistemática/metanálise em rede, De Quervain. DOI 10.1001/jamanetworkopen.2023.37001. [PubMed](https://pubmed.ncbi.nlm.nih.gov/37889490/).
- **S17. Cuenca-Zaldívar et al., 2026.** Revisão sistemática/metanálise em rede, publicação eletrónica em 2025. DOI 10.1016/j.jht.2025.09.001. [PubMed](https://pubmed.ncbi.nlm.nih.gov/41298159/).
- **S18. McBain et al., 2023.** Ensaio de viabilidade, não de eficácia definitiva. DOI 10.1177/17589983231158499. [PubMed](https://pubmed.ncbi.nlm.nih.gov/37904860/).
- **S19. Atthakomol et al., 2023.** Ensaio aleatorizado de ortótese/infiltração. DOI 10.1097/CORR.0000000000002662. [PubMed](https://pubmed.ncbi.nlm.nih.gov/37083487/).
- **S20. Choi et al., 2025.** Ensaio aleatorizado de deslizamentos após infiltração. [Texto](https://www.nature.com/articles/s41598-025-89436-9).
- **S21. McKenna et al., 2026.** Revisão sistemática de ortóteses; eletrónica em 2025. DOI 10.1016/j.jhsg.2025.100881. [PubMed](https://pubmed.ncbi.nlm.nih.gov/41362294/).
- **S22. Nadar, 2024.** Ensaio aleatorizado de ortótese associada a terapia versus terapia. DOI 10.1097/PXR.0000000000000294. [Texto](https://pmc.ncbi.nlm.nih.gov/articles/PMC11623375/).
- **S23. Stepan et al., 2014.** Estudo de glicemia após infiltração da mão/punho. DOI 10.1016/j.jhsa.2014.01.014. [PubMed](https://pubmed.ncbi.nlm.nih.gov/24679910/).
- **S24. BSSH.** Norma para infeção da bainha flexora. [Normas oficiais](https://www.bssh.ac.uk/_userfiles/pages/files/professionals/Trauma%20standards/10%20Flexor%20sheath%20infection.pdf).
- **S25. Massachusetts General Hospital.** Protocolo institucional de Bankart anterior; sinais pós-operatórios de contacto com a equipa. [Documento](https://www.massgeneral.org/assets/MGH/pdf/orthopaedics/sports-medicine/physical-therapy/rehabilitation-protocol-for-anterior-bankart.pdf).
- **S26. South Bend Orthopaedics.** Protocolo local de Bankart com remplissage. [Documento](https://sbortho.com/wp-content/uploads/2023/09/br-pt-shoulder-arthroscopic-anterior-stabilization-bankart-repair-with-remplissage.pdf).
- **S27. Hurley et al., 2026.** Consenso internacional recente, nível V; resumo consultado, não substitui análise integral das declarações. Não existe calendário único de retorno. DOI 10.1002/arj.70367. [PubMed](https://pubmed.ncbi.nlm.nih.gov/42742935/).
- **S28. AAOS OrthoInfo.** Informação oficial sobre prótese invertida, usada como apoio à comunicação das precauções, não como programa individual. [Página](https://www.orthoinfo.org/treatment/reverse-total-shoulder-replacement/).

## 9. Implementação desta revisão
As correções F01–F16 são implementadas em novas versões dos nove protocolos. As versões anteriores e as suas fases/associações são preservadas. As 12 fichas corrigidas têm novas identidades, reutilizando as imagens existentes. Não existe certificação anatómica integral das imagens.

Foram acrescentadas 23 opções conservadoras às fases vazias de TSA/RSA e retirada a associação contraditória de rotação interna da TSA. As opções cirúrgicas e as variantes da tendinopatia da coifa exigem seleção manual. O novo catálogo tem 248 associações; 92 estão sem dose específica e outras 29 não definem o repouso. As 121 opções exigem completar a dose individual antes de criar a sessão, aproveitando os parâmetros já preenchidos. Não se inventam valores científicos para preencher a ausência de dose.

O ficheiro SQL de dados contém verificações otimistas dos originais e impressões digitais das prescrições e snapshots antes/depois. Nenhum plano individual é reescrito. O código do editor impede transferência de doses ausentes ou estruturalmente incompletas e recolhe dose, repouso, carga e amplitude individuais. O link apresenta as recomendações e permite dispensar leitura repetida sem retirar instruções de cada exercício.

Os registos completos da auditoria e backups desta aplicação são artefactos locais da tarefa; não pertencem ao conteúdo público do doente.
