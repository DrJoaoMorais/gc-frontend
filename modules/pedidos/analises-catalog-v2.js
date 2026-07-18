/**
 * analises-catalog-v2.js
 * Catálogo v2 de Análises Laboratoriais — 11 grupos + perfis (chips).
 *
 * Ficheiro autónomo. Zero imports de analises.js ou doente.js.
 * Conteúdo copiado/derivado de modules/analises.js (ANALISES_CATALOG v1),
 * reorganizado e revisto clinicamente pelo Dr. João Morais.
 *
 * NÃO liga a nenhum modal nem botão — só dados. UI fica para sessão seguinte.
 *
 * Notas de integridade (decisões confirmadas pelo Dr. João Morais):
 *   - Grupo 1 (Hematologia/Coagulação): "Hemograma com fórmula leucocitária"
 *     acrescentado como item novo (distinto de "Hemograma completo" — dados
 *     clinicamente diferentes, não sinónimos). Usado só pelo perfil
 *     Overtraining.
 *   - Grupo 3 (Músculo e Inflamação): "Ionograma (Sódio, Potássio, Magnésio)"
 *     acrescentado — usado por todos os perfis de Med. Desportiva no v1,
 *     distinto do "Ionograma (Sódio, Potássio, Cloro)" do grupo 2.
 *   - Grupo 4 (Ferro e Vitaminas): "Zinco" acrescentado — usado só pelo
 *     perfil Overtraining.
 *   - Cobre sérico, Ceruloplasmina e Amónia NÃO entram em nenhum grupo de
 *     ANALISES_GRUPOS — ficam isolados, acessíveis só via perfil
 *     "Mais → Neurológico", exactamente como estavam isolados no grupo
 *     "neurologia" do v1. Consequência aceite: estes 3 nomes no perfil
 *     "neurologico" não resolvem contra ANALISES_GRUPOS (ver verificação de
 *     integridade no fim do ficheiro/relatório da sessão) — intencional,
 *     não é omissão.
 *   - "PSA total (Homem)" / "PSA livre (Homem)" (usados em desportivo_master
 *     e longevidade no v1) e "Exame sumário de urina" (idem) — nomes
 *     reconciliados com os nomes exactos existentes em Oncologia
 *     ("PSA total/livre (Homem — próstata)") e no grupo 10
 *     ("Exame sumário de urina (EAU)").
 *   - Proteinograma (grupo 9): info copiado da versão em "bioquimica" do v1
 *     ("Mieloma, inflamação crónica, imunodeficiência"), não da versão em
 *     "neurologia" ("Neuropatia paraproteinémica, mieloma, POEMS").
 */

/* ====================================================================
   ANALISES_GRUPOS — catálogo de 11 grupos
   ==================================================================== */

export const ANALISES_GRUPOS = [
  {
    id: "hematologia",
    label: "Hematologia / Coagulação",
    icon: "🩸",
    items: [
      { name: "Hemograma completo", info: "Anemia, infecção, trombocitopenia — avaliação global série vermelha, branca e plaquetas" },
      { name: "Velocidade de sedimentação (VS)", info: "Marcador inflamação inespecífico — útil em AR, PMR, arterite temporal" },
      { name: "Tempo de protrombina — INR", info: "Coagulação via extrínseca — anticoagulação com varfarina, função hepática" },
      { name: "Tempo de tromboplastina parcial ativado (APTT)", info: "Coagulação via intrínseca — hemofilias, lúpus anticoagulante" },
      { name: "Fibrinogénio", info: "Inflamação, coagulação — elevado em fase aguda, baixo em CID" },
      { name: "Dímeros-D", info: "Exclusão TEP e TVP — muito sensível, pouco específico" },
      { name: "Tipagem ABO e Rh (D)", info: "Tipagem completa pré-operatória, transfusão ou gravidez" },
      { name: "Hemograma com fórmula leucocitária", info: "Imunossupressão, anemia, infecção — frequentes em overtraining" }
    ]
  },
  {
    id: "bioquimica",
    label: "Bioquímica — Renal / Hepática / Glicémica",
    icon: "🧪",
    items: [
      { name: "Glicose em jejum", info: "Diabetes, pré-diabetes" },
      { name: "Hemoglobina glicada (HbA1c)", info: "Controlo glicémico últimos 3 meses — diagnóstico e monitorização diabetes" },
      { name: "Insulina em jejum", info: "Resistência insulínica — calcular HOMA-IR com glicose" },
      { name: "Ureia", info: "Função renal, catabolismo proteico — sobe com desidratação e dieta hiperproteica" },
      { name: "Creatinina", info: "Função renal — menos sensível que cistatina-C em fases precoces" },
      { name: "Cistatina-C", info: "Função renal precoce — melhor que creatinina em atletas e idosos" },
      { name: "Ácido úrico", info: "Gota, síndrome metabólico, risco cardiovascular" },
      { name: "Ionograma (Sódio, Potássio, Cloro)", info: "Equilíbrio electrolítico — hipertensão, insuficiência renal, diuréticos" },
      { name: "Aspartato aminotransferase (AST / TGO)", info: "Lesão hepática e muscular" },
      { name: "Alanina aminotransferase (ALT / TGP)", info: "Lesão hepática — mais específico que AST" },
      { name: "Fosfatase alcalina (FA)", info: "Fígado, osso — elevada em doença hepática e óssea" },
      { name: "Gama-glutamiltransferase (GGT)", info: "Lesão hepática, consumo álcool, indutor enzimático" },
      { name: "Bilirrubina total e frações", info: "Icterícia, hemólise, função hepática" },
      { name: "Proteínas totais e albumina", info: "Estado nutricional, função hepática, síndrome nefrótico" }
    ]
  },
  {
    id: "musculo_inflamacao",
    label: "Músculo e Inflamação",
    icon: "💪",
    items: [
      { name: "Creatinacinase (CK)", info: "Lesão muscular — miopatia, rabdomiólise, sobreetreino" },
      { name: "Mioglobina", info: "Lesão muscular aguda — rabdomiólise, enfarte do miocárdio" },
      { name: "Desidrogenase láctica (LDH)", info: "Hemólise, linfoma, enfarte, lesão muscular — marcador inespecífico" },
      { name: "Proteína C reativa (PCR)", info: "Inflamação, infecção — resposta rápida em horas" },
      { name: "Proteína C reativa ultra-sensível (PCR-us)", info: "Risco cardiovascular, inflamação de baixo grau" },
      { name: "Velocidade de sedimentação (VS)", info: "Marcador inflamação inespecífico — útil em AR, PMR, arterite temporal" },
      { name: "Ionograma (Sódio, Potássio, Magnésio)", info: "Electrólitos — cãibras, arritmias, performance" }
    ]
  },
  {
    id: "ferro_vitaminas",
    label: "Ferro e Vitaminas",
    icon: "🔋",
    items: [
      { name: "Ferritina", info: "Reservas de ferro, inflamação — baixa na anemia ferropénica, alta na inflamação" },
      { name: "Ferro sérico", info: "Transporte de ferro — avaliar em conjunto com ferritina e transferrina" },
      { name: "Transferrina", info: "Proteína transportadora de ferro — inversamente proporcional à sobrecarga" },
      { name: "Saturação de transferrina", info: "Percentagem ferro ligado — hemocromatose se >45%" },
      { name: "Vitamina D (25-hidroxivitamina D)", info: "Saúde óssea, imunidade, músculo — deficiência muito prevalente em Portugal" },
      { name: "Vitamina B12", info: "Neuropatia, anemia megaloblástica, défice cognitivo" },
      { name: "Folato", info: "Anemia megaloblástica, gravidez, neuropatia" },
      { name: "Magnésio", info: "Cãibras, arritmias, síndrome de sobreetreino" },
      { name: "Zinco", info: "Défice associado a imunossupressão e overtraining" }
    ]
  },
  {
    id: "metabolismo_osseo",
    label: "Metabolismo Ósseo",
    icon: "🦵",
    items: [
      { name: "Cálcio total", info: "Hiperparatiroidismo, osteoporose, sarcoidose, neoplasia" },
      { name: "Fósforo", info: "Metabolismo ósseo, insuficiência renal" },
      { name: "Hormona paratiroideia (PTH)", info: "Hiperparatiroidismo, hipercalcemia, metabolismo ósseo" },
      { name: "Vitamina D (25-hidroxivitamina D)", info: "Saúde óssea, imunidade, músculo — deficiência muito prevalente em Portugal" },
      { name: "CTX (telopéptido C-terminal do colagénio tipo I)", info: "Marcador de remodelação óssea — seguimento de osteoporose e resposta a tratamento" },
      { name: "P1NP (propéptido N-terminal do procolagénio tipo I)", info: "Marcador de remodelação óssea — seguimento de osteoporose e resposta a tratamento" }
    ]
  },
  {
    id: "lipidico",
    label: "Perfil Lipídico",
    icon: "💛",
    items: [
      { name: "Colesterol total", info: "Risco cardiovascular global" },
      { name: "Colesterol LDL", info: "Principal alvo terapêutico risco CV — colesterol mau" },
      { name: "Colesterol HDL", info: "Protector cardiovascular — colesterol bom" },
      { name: "Triglicerídeos", info: "Risco CV, síndrome metabólico, pancreatite" },
      { name: "Apolipoproteína B", info: "Melhor marcador risco CV que LDL — reflecte partículas aterogénicas" },
      { name: "Apolipoproteína A1", info: "Equivalente HDL funcional" },
      { name: "Lipoproteína (a) — Lp(a)", info: "Risco CV independente — geneticamente determinado, não modificável por dieta" },
      { name: "Homocisteína", info: "Risco CV e cerebrovascular, défice B12/folato" },
      { name: "NT-proBNP", info: "Péptido natriurético — rastreio de insuficiência cardíaca" }
    ]
  },
  {
    id: "endocrinologia",
    label: "Endócrino / Tiróide",
    icon: "⚗️",
    items: [
      { name: "Hormona tiroestimulante (TSH)", info: "Screening tiróide — primeiro exame a pedir" },
      { name: "Triiodotironina livre (T3 livre)", info: "Forma activa hormona tiroideia — hipertiroidismo, monitorização" },
      { name: "Tiroxina livre (T4 livre)", info: "Reserva tiroideia — hipotiroidismo, monitorização levotiroxina" },
      { name: "Hormona paratiroideia (PTH)", info: "Hiperparatiroidismo, hipercalcemia, metabolismo ósseo" },
      { name: "IGF-1 (fator de crescimento insulínico tipo 1)", info: "Eixo GH — acromegalia, défice GH, longevidade, performance atlética" },
      { name: "Cortisol basal (manhã)", info: "Eixo HPA — insuficiência suprarrenal, síndrome de Cushing, sobreetreino" },
      { name: "ACTH", info: "Diferenciação insuficiência suprarrenal primária vs central" },
      { name: "Prolactina", info: "Hiperprolactinemia — amenorreia, galactorreia, adenoma hipofisário" },
      { name: "DHEA-S (dehidroepiandrosterona sulfato)", info: "Eixo suprarrenal androgénico — envelhecimento, sobreetreino, fadiga crónica" },
      { name: "Testosterona total", info: "Hipogonadismo, síndrome metabólico, performance atlética" },
      { name: "Testosterona livre", info: "Fracção biologicamente activa — mais relevante que total em obesos e idosos" },
      { name: "SHBG (globulina ligadora de hormonas sexuais)", info: "Alta em hipertiroidismo, baixa em obesidade e resistência insulínica" }
    ]
  },
  {
    id: "ginecologia",
    label: "Hormonal Feminino",
    icon: "♀️",
    items: [
      { name: "FSH (hormona folículo-estimulante)", info: "Reserva ovárica, menopausa, hipogonadismo" },
      { name: "LH (hormona luteinizante)", info: "Ovulação, hipogonadismo, síndrome ovário poliquístico" },
      { name: "Estradiol (E2)", info: "Ciclo menstrual, menopausa, fertilidade" },
      { name: "Progesterona", info: "Confirmação ovulação, fase lútea" },
      { name: "Hormona antimülleriana (AMH)", info: "Reserva ovárica — melhor marcador fertilidade" },
      { name: "17-OH-Progesterona", info: "Hiperplasia suprarrenal congénita" }
    ]
  },
  {
    id: "reumatologia",
    label: "Reumatologia / Autoimunidade",
    icon: "🦴",
    items: [
      { name: "Anticorpos antinucleares (ANA)", info: "Screening autoimunidade sistémica — lúpus, esclerodermia, Sjögren, miosite" },
      { name: "Anticorpos anti-DNA de cadeia dupla (anti-dsDNA)", info: "Lúpus eritematoso sistémico — específico, correlaciona com actividade" },
      { name: "Anticorpos anti-Sm", info: "Lúpus — muito específico, menos sensível" },
      { name: "Anticorpos anti-RNP", info: "Doença mista tecido conjuntivo (DMTC)" },
      { name: "Anticorpos anti-SSA / Ro", info: "Síndrome de Sjögren, lúpus neonatal" },
      { name: "Anticorpos anti-SSB / La", info: "Síndrome de Sjögren — mais específico que SSA" },
      { name: "Fator reumatoide (FR)", info: "Artrite reumatoide — screening; também positivo em Sjögren e infecções crónicas" },
      { name: "Anticorpos anti-peptídeo citrulinado (anti-CCP)", info: "Artrite reumatoide — mais específico que FR, positivo anos antes dos sintomas" },
      { name: "Genotipagem HLA-B27", info: "Espondiloartrites — espondilite anquilosante, artrite psoriática, artrite reactiva" },
      { name: "Complemento C3", info: "Consumo em lúpus activo, glomerulonefrite" },
      { name: "Complemento C4", info: "Consumo em lúpus activo, défice hereditário" },
      { name: "Proteinograma — eletroforese de proteínas", info: "Mieloma, inflamação crónica, imunodeficiência" },
      { name: "Cadeias leves livres séricas kappa/lambda", info: "Estudo de gamapatia monoclonal — lombalgia do idoso, alternativa mais moderna à proteína de Bence-Jones urinária" }
    ]
  },
  {
    id: "serologias_urina",
    label: "Serologias / Infecciologia + Urina",
    icon: "🦠",
    items: [
      { name: "VIH — Antigénio p24 + Anticorpos VIH-1/2", info: "Infecção VIH — 4ª geração, detecta infecção aguda e crónica" },
      { name: "Hepatite A — Anticorpos IgM (HAV IgM)", info: "Hepatite A aguda — positivo nas primeiras semanas de infecção" },
      { name: "Hepatite A — Anticorpos totais (HAV total)", info: "Imunidade pós-infecção ou vacinação — negativo indica susceptibilidade" },
      { name: "Hepatite B — Antigénio HBs (AgHBs)", info: "Infecção activa VHB ou portador crónico — pedir sempre com anti-HBs e anti-HBc" },
      { name: "Hepatite B — Anticorpos anti-HBs", info: "Imunidade por vacinação (isolado) ou cura (com anti-HBc positivo)" },
      { name: "Hepatite B — Anticorpos anti-HBc total", info: "Contacto prévio VHB — distingue vacinado (negativo) de infectado (positivo)" },
      { name: "Hepatite C — Anticorpos anti-VHC", info: "Screening infecção VHC — se positivo confirmar com RNA PCR" },
      { name: "Hepatite C — RNA VHC (PCR)", info: "Confirma infecção activa VHC após anti-VHC positivo — quantifica carga viral" },
      { name: "VDRL", info: "Sífilis — screening; falsos positivos em lúpus e gravidez" },
      { name: "TPHA — Anticorpos anti-Treponema pallidum", info: "Sífilis — confirmatório, mais específico que VDRL, permanece positivo após tratamento" },
      { name: "Paul-Bunnell / Monospot", info: "Mononucleose infecciosa (EBV) — faringite, adenopatias, esplenomegalia" },
      { name: "Exame sumário de urina (EAU)", info: "Infecção urinária, hematúria, proteinúria — rastreio geral" },
      { name: "Microalbuminúria", info: "Lesão renal precoce — diabetes, hipertensão, risco cardiovascular" },
      { name: "Proteína de Bence-Jones — urina de 24 horas", info: "Mieloma múltiplo — proteínas de cadeias leves" },
      { name: "Cortisol urinário livre — urina de 24 horas", info: "Síndrome de Cushing — melhor que cortisol sérico basal" },
      { name: "Urocultura + TSA (eventual)", info: "Infecção urinária — identificação agente e sensibilidade a antibióticos" },
      { name: "IGRA / Quantiferon-TB", info: "Rastreio de tuberculose latente — pré-biológico, pré-imunossupressor" }
    ]
  },
  {
    id: "oncologia",
    label: "Oncologia / Marcadores Tumorais",
    icon: "🎗️",
    items: [
      { name: "PSA total (Homem — próstata)", info: "Rastreio e monitorização carcinoma da próstata — pedir com PSA livre", subcategoria: "Próstata" },
      { name: "PSA livre (Homem — próstata)", info: "Rácio PSA livre/total — distingue hiperplasia benigna de carcinoma", subcategoria: "Próstata" },
      { name: "CEA", info: "Cólon, recto, pulmão, mama, estômago — monitorização pós-tratamento", subcategoria: "Digestivo" },
      { name: "CA 19-9", info: "Pâncreas, vias biliares — diagnóstico e monitorização", subcategoria: "Digestivo" },
      { name: "CA 15-3 (Mulher — mama)", info: "Monitorização tratamento e recidiva carcinoma da mama", subcategoria: "Mama" },
      { name: "CA 125 (Mulher — ovário)", info: "Diagnóstico e monitorização carcinoma do ovário", subcategoria: "Ovário" },
      { name: "AFP (alfafetoproteína)", info: "Hepatocarcinoma, tumores células germinativas testiculares e ováricos", subcategoria: "Ovário" },
      { name: "Beta-HCG", info: "Coriocarcinoma, tumores testiculares e ováricos de células germinativas", subcategoria: "Ovário" },
      { name: "AFP (alfafetoproteína)", info: "Hepatocarcinoma, tumores células germinativas testiculares e ováricos", subcategoria: "Fígado" },
      { name: "AFP (alfafetoproteína)", info: "Hepatocarcinoma, tumores células germinativas testiculares e ováricos", subcategoria: "Testículo" },
      { name: "Beta-HCG", info: "Coriocarcinoma, tumores testiculares e ováricos de células germinativas", subcategoria: "Testículo" },
      { name: "Calcitonina", info: "Carcinoma medular da tiróide — screening nódulos tiroideus", subcategoria: "Tiróide" },
      { name: "Cromogranina A", info: "Tumores neuroendócrinos — carcinoide, feocromocitoma, paraganglioma", subcategoria: "Neuroendócrino" },
      { name: "LDH", info: "Linfoma, melanoma, tumores sólidos — marcador inespecífico de massa tumoral", subcategoria: "Hematológico/Sistémico" },
      { name: "Beta-2 microglobulina", info: "Mieloma múltiplo, linfoma B — estadiamento e prognóstico", subcategoria: "Hematológico/Sistémico" }
    ]
  }
];

/* ====================================================================
   ANALISES_PERFIS — chips (composições rápidas sobre ANALISES_GRUPOS)
   ==================================================================== */

export const ANALISES_PERFIS = [
  {
    id: "reumatologico",
    label: "Reumatológico",
    submenu: null,
    analises: [
      "Anticorpos antinucleares (ANA)",
      "Anticorpos anti-DNA de cadeia dupla (anti-dsDNA)",
      "Anticorpos anti-Sm",
      "Anticorpos anti-RNP",
      "Anticorpos anti-SSA / Ro",
      "Anticorpos anti-SSB / La",
      "Fator reumatoide (FR)",
      "Anticorpos anti-peptídeo citrulinado (anti-CCP)",
      "Genotipagem HLA-B27",
      "Complemento C3",
      "Complemento C4",
      "Proteinograma — eletroforese de proteínas",
      "Cadeias leves livres séricas kappa/lambda"
    ]
  },
  {
    id: "med_desportiva",
    label: "Med. Desportiva",
    submenu: [
      {
        id: "pre_epoca",
        label: "Pré-época",
        analises: [
          "Hemograma completo", "Ferritina", "Ferro sérico", "Transferrina", "Saturação de transferrina",
          "Vitamina D (25-hidroxivitamina D)", "Vitamina B12", "Folato", "Glicose em jejum",
          "Hemoglobina glicada (HbA1c)", "Ionograma (Sódio, Potássio, Magnésio)", "Creatinacinase (CK)",
          "Desidrogenase láctica (LDH)", "Proteína C reativa ultra-sensível (PCR-us)",
          "Hormona tiroestimulante (TSH)", "Tiroxina livre (T4 livre)", "Triiodotironina livre (T3 livre)",
          "Ureia", "Creatinina", "Aspartato aminotransferase (AST / TGO)", "Alanina aminotransferase (ALT / TGP)",
          "Colesterol total", "Colesterol LDL", "Colesterol HDL", "Triglicerídeos", "Ácido úrico",
          "Testosterona total", "Cortisol basal (manhã)", "DHEA-S (dehidroepiandrosterona sulfato)",
          "SHBG (globulina ligadora de hormonas sexuais)"
        ]
      },
      {
        id: "atleta_40",
        label: "Atleta > 40 anos",
        analises: [
          "Hemograma completo", "Ferritina", "Ferro sérico", "Saturação de transferrina",
          "Vitamina D (25-hidroxivitamina D)", "Vitamina B12", "Folato", "Glicose em jejum",
          "Hemoglobina glicada (HbA1c)", "Insulina em jejum", "Ionograma (Sódio, Potássio, Magnésio)",
          "Creatinacinase (CK)", "Desidrogenase láctica (LDH)", "Proteína C reativa ultra-sensível (PCR-us)",
          "Homocisteína", "Hormona tiroestimulante (TSH)", "Tiroxina livre (T4 livre)",
          "Triiodotironina livre (T3 livre)", "Ureia", "Creatinina", "Cistatina-C",
          "Aspartato aminotransferase (AST / TGO)", "Alanina aminotransferase (ALT / TGP)",
          "Fosfatase alcalina (FA)", "Gama-glutamiltransferase (GGT)", "Colesterol total", "Colesterol LDL",
          "Colesterol HDL", "Triglicerídeos", "Apolipoproteína B", "Lipoproteína (a) — Lp(a)", "Ácido úrico",
          "Testosterona total", "Testosterona livre", "SHBG (globulina ligadora de hormonas sexuais)",
          "Cortisol basal (manhã)", "DHEA-S (dehidroepiandrosterona sulfato)",
          "IGF-1 (fator de crescimento insulínico tipo 1)", "PSA total (Homem — próstata)",
          "PSA livre (Homem — próstata)", "Microalbuminúria", "Exame sumário de urina (EAU)"
        ]
      },
      {
        id: "atleta_mulher",
        label: "Atleta mulher",
        analises: [
          "Hemograma completo", "Ferritina", "Ferro sérico", "Transferrina", "Saturação de transferrina",
          "Vitamina D (25-hidroxivitamina D)", "Vitamina B12", "Folato", "Glicose em jejum",
          "Hemoglobina glicada (HbA1c)", "Insulina em jejum", "Ionograma (Sódio, Potássio, Magnésio)",
          "Creatinacinase (CK)", "Desidrogenase láctica (LDH)", "Proteína C reativa ultra-sensível (PCR-us)",
          "Hormona tiroestimulante (TSH)", "Triiodotironina livre (T3 livre)", "Tiroxina livre (T4 livre)",
          "FSH (hormona folículo-estimulante)", "LH (hormona luteinizante)", "Estradiol (E2)", "Progesterona",
          "Prolactina", "Testosterona total", "SHBG (globulina ligadora de hormonas sexuais)",
          "DHEA-S (dehidroepiandrosterona sulfato)", "Cortisol basal (manhã)",
          "IGF-1 (fator de crescimento insulínico tipo 1)", "Ureia", "Creatinina",
          "Aspartato aminotransferase (AST / TGO)", "Alanina aminotransferase (ALT / TGP)",
          "Colesterol total", "Colesterol LDL", "Colesterol HDL"
        ]
      },
      {
        id: "fractura_stress",
        label: "Fractura de stress / RED-S",
        analises: [
          "Hemograma completo", "Ferritina", "Ferro sérico", "Transferrina", "Saturação de transferrina",
          "Vitamina D (25-hidroxivitamina D)", "Cálcio total", "Fósforo", "Hormona paratiroideia (PTH)",
          "Fosfatase alcalina (FA)", "CTX (telopéptido C-terminal do colagénio tipo I)",
          "P1NP (propéptido N-terminal do procolagénio tipo I)", "Hormona tiroestimulante (TSH)",
          "Tiroxina livre (T4 livre)", "Estradiol (E2)", "FSH (hormona folículo-estimulante)",
          "LH (hormona luteinizante)", "Testosterona total"
        ]
      },
      {
        id: "overtraining",
        label: "Overtraining",
        analises: [
          "Hemograma com fórmula leucocitária", "Ferritina", "Ferro sérico", "Saturação de transferrina",
          "Creatinacinase (CK)", "Desidrogenase láctica (LDH)", "Mioglobina",
          "Proteína C reativa ultra-sensível (PCR-us)", "Velocidade de sedimentação (VS)",
          "Cortisol basal (manhã)", "Testosterona total", "DHEA-S (dehidroepiandrosterona sulfato)",
          "Hormona tiroestimulante (TSH)", "Triiodotironina livre (T3 livre)", "Tiroxina livre (T4 livre)",
          "IGF-1 (fator de crescimento insulínico tipo 1)", "Estradiol (E2)", "LH (hormona luteinizante)",
          "FSH (hormona folículo-estimulante)", "Prolactina", "Hormona antimülleriana (AMH)",
          "Glicose em jejum", "Insulina em jejum", "Ionograma (Sódio, Potássio, Magnésio)", "Zinco",
          "Ureia", "Creatinina", "Vitamina D (25-hidroxivitamina D)", "Vitamina B12", "Folato",
          "SHBG (globulina ligadora de hormonas sexuais)"
        ]
      }
    ]
  },
  {
    id: "mais",
    label: "Mais",
    submenu: [
      {
        id: "infecciologia",
        label: "Infecciologia / Pré-biológico",
        analises: [
          "VIH — Antigénio p24 + Anticorpos VIH-1/2",
          "Hepatite A — Anticorpos IgM (HAV IgM)",
          "Hepatite A — Anticorpos totais (HAV total)",
          "Hepatite B — Antigénio HBs (AgHBs)",
          "Hepatite B — Anticorpos anti-HBs",
          "Hepatite B — Anticorpos anti-HBc total",
          "Hepatite C — Anticorpos anti-VHC",
          "Hepatite C — RNA VHC (PCR)",
          "VDRL",
          "TPHA — Anticorpos anti-Treponema pallidum",
          "Paul-Bunnell / Monospot",
          "Exame sumário de urina (EAU)",
          "Microalbuminúria",
          "Proteína de Bence-Jones — urina de 24 horas",
          "Cortisol urinário livre — urina de 24 horas",
          "Urocultura + TSA (eventual)",
          "IGRA / Quantiferon-TB"
        ]
      },
      {
        id: "neurologico",
        label: "Neurológico",
        analises: [
          "Vitamina B12", "Folato", "Homocisteína", "Hormona tiroestimulante (TSH)",
          "Tiroxina livre (T4 livre)", "Glicose em jejum", "Hemoglobina glicada (HbA1c)",
          "Proteína C reativa ultra-sensível (PCR-us)", "Velocidade de sedimentação (VS)",
          "Anticorpos antinucleares (ANA)", "Anticorpos anti-DNA de cadeia dupla (anti-dsDNA)",
          "VDRL", "TPHA — Anticorpos anti-Treponema pallidum", "VIH — Antigénio p24 + Anticorpos VIH-1/2",
          "Cobre sérico", "Ceruloplasmina", "Amónia", "Proteinograma — eletroforese de proteínas"
        ]
      },
      {
        id: "longevidade",
        label: "Longevidade",
        analises: [
          "Hemograma completo", "Ferritina", "Ferro sérico", "Saturação de transferrina", "Ureia",
          "Creatinina", "Cistatina-C", "Glicose em jejum", "Insulina em jejum", "Hemoglobina glicada (HbA1c)",
          "Aspartato aminotransferase (AST / TGO)", "Alanina aminotransferase (ALT / TGP)",
          "Fosfatase alcalina (FA)", "Gama-glutamiltransferase (GGT)", "Bilirrubina total e frações",
          "Creatinacinase (CK)", "Colesterol total", "Colesterol LDL", "Colesterol HDL", "Triglicerídeos",
          "Apolipoproteína B", "Lipoproteína (a) — Lp(a)", "Homocisteína",
          "Proteína C reativa ultra-sensível (PCR-us)", "Ácido úrico", "Vitamina D (25-hidroxivitamina D)",
          "Vitamina B12", "Hormona tiroestimulante (TSH)", "Tiroxina livre (T4 livre)",
          "IGF-1 (fator de crescimento insulínico tipo 1)", "PSA total (Homem — próstata)",
          "PSA livre (Homem — próstata)", "Microalbuminúria", "Exame sumário de urina (EAU)"
        ]
      }
    ]
  }
];
