/**
 * analises.js — Passo 7
 * BLOCO 12H: Módulo Análises Laboratoriais
 *   — catálogo ANALISES_CATALOG
 *   — openAnalisesModal (UI com grupos + checkboxes)
 *   — gerarAnalisePdf
 *   — buildAnalisesHtml
 *
 * Extraído de app.js bloco 12H
 *
 * Globals consumidas (expostas via window.__gc_* / app.js):
 *   window.__gc_fetchClinicForPdf  — carrega clínica ativa para PDF
 *   window.__gc_storageSignedUrl   — URL assinado do Storage
 *   window.__gc_urlToDataUrl       — converte URL em base64 data-URL
 *   window.__gc_VINHETA_BUCKET     — bucket do Storage
 *   window.__gc_VINHETA_PATH       — caminho da vinheta
 *   window.__gc_SIGNATURE_PATH     — caminho da assinatura
 *   window.openDocumentEditor      — abre editor Quill/PDF (de pdf.js)
 */

/* ====================================================================
   DADOS 12H.1 — Catálogo de grupos e análises
   ==================================================================== */

export const ANALISES_CATALOG = [
  {
    id: "hematologia",
    label: "Hematologia / Coagulação",
    icon: "🩸",
    items: [
      { name: "Hemograma completo", info: "Anemia, infecção, trombocitopenia — avaliação global série vermelha, branca e plaquetas" },
      { name: "Hemograma com fórmula leucocitária", info: "Idem + diferencial leucocitário — infecção, leucemia, eosinofilia" },
      { name: "Velocidade de sedimentação (VS)", info: "Marcador inflamação inespecífico — útil em AR, PMR, arterite temporal" },
      { name: "Tempo de protrombina — INR", info: "Coagulação via extrínseca — anticoagulação com varfarina, função hepática" },
      { name: "Tempo de tromboplastina parcial ativado (APTT)", info: "Coagulação via intrínseca — hemofilias, lúpus anticoagulante" },
      { name: "Fibrinogénio", info: "Inflamação, coagulação — elevado em fase aguda, baixo em CID" },
      { name: "Dímeros-D", info: "Exclusão TEP e TVP — muito sensível, pouco específico" },
      { name: "Grupo sanguíneo (ABO)", info: "Tipagem pré-transfusional ou pré-operatória" },
      { name: "Tipagem ABO e Rh (D)", info: "Tipagem completa pré-operatória ou gravidez" }
    ]
  },
  {
    id: "bioquimica",
    label: "Bioquímica / Função Orgânica",
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
      { name: "Magnésio", info: "Cãibras, arritmias, síndrome de sobreetreino" },
      { name: "Cálcio total", info: "Hiperparatiroidismo, osteoporose, sarcoidose, neoplasia" },
      { name: "Fósforo", info: "Metabolismo ósseo, insuficiência renal" },
      { name: "Aspartato aminotransferase (AST / TGO)", info: "Lesão hepática e muscular" },
      { name: "Alanina aminotransferase (ALT / TGP)", info: "Lesão hepática — mais específico que AST" },
      { name: "Fosfatase alcalina (FA)", info: "Fígado, osso — elevada em doença hepática e óssea" },
      { name: "Gama-glutamiltransferase (GGT)", info: "Lesão hepática, consumo álcool, indutor enzimático" },
      { name: "Bilirrubina total e frações", info: "Icterícia, hemólise, função hepática" },
      { name: "Proteínas totais e albumina", info: "Estado nutricional, função hepática, síndrome nefrótico" },
      { name: "Proteinograma — eletroforese de proteínas", info: "Mieloma, inflamação crónica, imunodeficiência" },
      { name: "Desidrogenase láctica (LDH)", info: "Hemólise, linfoma, enfarte, lesão muscular — marcador inespecífico" },
      { name: "Creatinacinase (CK)", info: "Lesão muscular — miopatia, rabdomiólise, sobreetreino" },
      { name: "Mioglobina", info: "Lesão muscular aguda — rabdomiólise, enfarte do miocárdio" },
      { name: "Proteína C reativa (PCR)", info: "Inflamação, infecção — resposta rápida em horas" },
      { name: "Proteína C reativa ultra-sensível (PCR-us)", info: "Risco cardiovascular, inflamação de baixo grau" },
      { name: "Ferritina", info: "Reservas de ferro, inflamação — baixa na anemia ferropénica, alta na inflamação" },
      { name: "Ferro sérico", info: "Transporte de ferro — avaliar em conjunto com ferritina e transferrina" },
      { name: "Transferrina", info: "Proteína transportadora de ferro — inversamente proporcional à sobrecarga" },
      { name: "Saturação de transferrina", info: "Percentagem ferro ligado — hemocromatose se >45%" },
      { name: "Vitamina D (25-hidroxivitamina D)", info: "Saúde óssea, imunidade, músculo — deficiência muito prevalente em Portugal" },
      { name: "Vitamina B12", info: "Neuropatia, anemia megaloblástica, défice cognitivo" },
      { name: "Folato", info: "Anemia megaloblástica, gravidez, neuropatia" }
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
      { name: "Homocisteína", info: "Risco CV e cerebrovascular, défice B12/folato" }
    ]
  },
  {
    id: "endocrinologia",
    label: "Endocrinologia / Tiróide",
    icon: "⚗️",
    items: [
      { name: "Hormona tiroestimulante (TSH)", info: "Screening tiróide — primeiro exame a pedir" },
      { name: "Triiodotironina livre (T3 livre)", info: "Forma activa hormona tiroideia — hipertiroidismo, monitorização" },
      { name: "Tiroxina livre (T4 livre)", info: "Reserva tiroideia — hipotiroidismo, monitorização levotiroxina" },
      { name: "Triiodotironina total (T3 total)", info: "Menos usado — útil em hipertiroidismo T3-tóxico" },
      { name: "Tiroxina total (T4 total)", info: "Menos usado na prática clínica actual" },
      { name: "Calcitonina", info: "Carcinoma medular tiróide — screening nódulos tiroideus" },
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
    label: "Hormonal Feminino / Ginecologia",
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
      { name: "Complemento C4", info: "Consumo em lúpus activo, défice hereditário" }
    ]
  },
  {
    id: "serologias",
    label: "Serologias / Doenças Infecciosas",
    icon: "🦠",
    items: [
      { name: "VIH — Antigénio p24 + Anticorpos VIH-1/2", info: "Infecção VIH — 4ª geração, detecta infecção aguda e crónica" },
      { name: "Hepatite A — Anticorpos IgM", info: "Hepatite A aguda" },
      { name: "Hepatite A — Anticorpos totais", info: "Imunidade pós-infecção ou vacinação" },
      { name: "Hepatite B — Antigénio HBs (AgHBs)", info: "Infecção activa ou portador crónico VHB" },
      { name: "Hepatite B — Anticorpos anti-HBs", info: "Imunidade por vacinação ou cura" },
      { name: "Hepatite B — Anticorpos anti-HBc", info: "Contacto prévio VHB — distingue vacinado de infectado" },
      { name: "Hepatite C — Anticorpos anti-VHC", info: "Infecção VHC — screening" },
      { name: "Hepatite C — Pesquisa de RNA (PCR)", info: "Confirmação infecção activa VHC após anti-VHC positivo" },
      { name: "VDRL", info: "Sífilis — screening; falsos positivos em lúpus" },
      { name: "TPHA — Anticorpos anti-Treponema pallidum", info: "Sífilis — confirmatório, mais específico que VDRL" },
      { name: "Paul-Bunnell / Monospot", info: "Mononucleose infecciosa (EBV)" }
    ]
  },
  {
    id: "urina",
    label: "Urina",
    icon: "💧",
    items: [
      { name: "Exame sumário de urina", info: "Infecção urinária, hematúria, proteinúria — rastreio geral" },
      { name: "Microalbuminúria", info: "Lesão renal precoce — diabetes, hipertensão, risco cardiovascular" },
      { name: "Proteína de Bence-Jones — urina de 24 horas", info: "Mieloma múltiplo — proteínas de cadeias leves" },
      { name: "Hidroxiprolina total — urina de 24 horas", info: "Metabolismo ósseo — reabsorção óssea aumentada" },
      { name: "Cortisol urinário livre — urina de 24 horas", info: "Síndrome de Cushing — melhor que cortisol sérico basal" }
    ]
  },
  {
    id: "oncologia",
    label: "Oncologia / Marcadores Tumorais",
    icon: "🎗️",
    items: [
      { name: "PSA total", info: "Próstata — rastreio e monitorização carcinoma" },
      { name: "PSA livre", info: "Próstata — rácio PSA livre/total distingue HBP de carcinoma" },
      { name: "CEA", info: "Cólon, recto, pulmão, mama, estômago — monitorização pós-tratamento" },
      { name: "CA 19-9", info: "Pâncreas, vias biliares — diagnóstico e monitorização" },
      { name: "CA 125", info: "Ovário — diagnóstico e monitorização" },
      { name: "CA 15-3", info: "Mama — monitorização tratamento e recidiva" },
      { name: "AFP (alfafetoproteína)", info: "Hepatocarcinoma, tumores células germinativas" },
      { name: "Beta-HCG", info: "Coriocarcinoma, tumores testiculares células germinativas" },
      { name: "LDH", info: "Linfoma, melanoma, tumores sólidos — marcador inespecífico de massa tumoral" },
      { name: "Beta-2 microglobulina", info: "Mieloma múltiplo, linfoma B — estadiamento e prognóstico" },
      { name: "Calcitonina", info: "Carcinoma medular da tiróide" },
      { name: "Cromogranina A", info: "Tumores neuroendócrinos — carcinoide, feocromocitoma" }
    ]
  },
  {
    id: "neurologia",
    label: "Neurologia",
    icon: "🧠",
    items: [
      { name: "Vitamina B12", info: "Neuropatia periférica, défice cognitivo, subaguda combinada medular" },
      { name: "Folato", info: "Neuropatia, alterações cognitivas, prevenção defeitos tubo neural" },
      { name: "Homocisteína", info: "Risco vascular cerebral, neuropatia, défice B12/folato" },
      { name: "Hormona tiroestimulante (TSH)", info: "Hipotiroidismo — causa reversível de demência e neuropatia" },
      { name: "Tiroxina livre (T4 livre)", info: "Avaliação tiroideia completa em contexto neurológico" },
      { name: "Glicose em jejum", info: "Neuropatia diabética — causa mais frequente de neuropatia periférica" },
      { name: "Hemoglobina glicada (HbA1c)", info: "Controlo glicémico — neuropatia diabética" },
      { name: "Proteína C reativa ultra-sensível (PCR-us)", info: "Vasculite, neuroinflamação" },
      { name: "Velocidade de sedimentação (VS)", info: "Vasculite, polimialgia reumática" },
      { name: "Anticorpos antinucleares (ANA)", info: "Lúpus neuropsiquiátrico" },
      { name: "Anticorpos anti-DNA de cadeia dupla (anti-dsDNA)", info: "Lúpus neuropsiquiátrico — específico" },
      { name: "VDRL", info: "Neurossífilis — sempre excluir em neuropatia ou demência atípica" },
      { name: "TPHA — Anticorpos anti-Treponema pallidum", info: "Neurossífilis — confirmatório" },
      { name: "VIH — Antigénio p24 + Anticorpos VIH-1/2", info: "Neuropatia VIH, demência associada" },
      { name: "Cobre sérico", info: "Doença de Wilson, mielopatia por défice de cobre" },
      { name: "Ceruloplasmina", info: "Doença de Wilson — baixa na doença, alta em inflamação" },
      { name: "Amónia", info: "Encefalopatia hepática" },
      { name: "Proteinograma — eletroforese de proteínas", info: "Neuropatia paraproteinémica, mieloma, POEMS" }
    ]
  },
  {
    id: "preop",
    label: "Pré-operatório",
    icon: "🏥",
    items: [
      { name: "Hemograma completo", info: "Anemia pré-op, trombocitopenia, infecção" },
      { name: "Tempo de protrombina — INR", info: "Coagulação — risco hemorrágico cirúrgico" },
      { name: "Tempo de tromboplastina parcial ativado (APTT)", info: "Coagulação via intrínseca" },
      { name: "Tipagem ABO e Rh (D)", info: "Tipagem para eventual transfusão intraoperatória" },
      { name: "Glicose em jejum", info: "Controlo glicémico pré-operatório" },
      { name: "Ureia", info: "Função renal pré-anestesia" },
      { name: "Creatinina", info: "Função renal pré-anestesia" },
      { name: "Ionograma (Sódio, Potássio, Cloro)", info: "Hipocaliemia aumenta risco arrítmico perioperatório" },
      { name: "ECG", info: "Avaliação cardíaca pré-anestesia" },
      { name: "Rx tórax", info: "Avaliação pulmonar e cardíaca pré-operatória" }
    ]
  },
  {
    id: "longevidade",
    label: "Longevidade",
    icon: "⏳",
    items: [
      { name: "Hemograma completo", info: "Anemia, infecção, trombocitopenia — avaliação global" },
      { name: "Ferritina", info: "Reservas de ferro — baixa na anemia ferropénica, alta na inflamação crónica" },
      { name: "Ferro sérico", info: "Transporte de ferro" },
      { name: "Saturação de transferrina", info: "Hemocromatose se >45%" },
      { name: "Ureia", info: "Função renal, catabolismo proteico" },
      { name: "Creatinina", info: "Função renal" },
      { name: "Cistatina-C", info: "Função renal precoce — melhor marcador em idosos" },
      { name: "Glicose em jejum", info: "Diabetes, resistência insulínica" },
      { name: "Insulina em jejum", info: "Resistência insulínica — calcular HOMA-IR" },
      { name: "Hemoglobina glicada (HbA1c)", info: "Controlo glicémico últimos 3 meses" },
      { name: "Aspartato aminotransferase (AST / TGO)", info: "Lesão hepática e muscular" },
      { name: "Alanina aminotransferase (ALT / TGP)", info: "Lesão hepática" },
      { name: "Fosfatase alcalina (FA)", info: "Fígado e osso" },
      { name: "Gama-glutamiltransferase (GGT)", info: "Lesão hepática, álcool" },
      { name: "Bilirrubina total e frações", info: "Função hepática, hemólise" },
      { name: "Creatinacinase (CK)", info: "Lesão muscular, sobreetreino" },
      { name: "Colesterol total", info: "Risco cardiovascular" },
      { name: "Colesterol LDL", info: "Principal alvo terapêutico risco CV" },
      { name: "Colesterol HDL", info: "Protector cardiovascular" },
      { name: "Triglicerídeos", info: "Risco CV, síndrome metabólico" },
      { name: "Apolipoproteína B", info: "Melhor marcador risco CV que LDL" },
      { name: "Lipoproteína (a) — Lp(a)", info: "Risco CV independente — geneticamente determinado" },
      { name: "Homocisteína", info: "Risco vascular cerebral e CV, défice B12/folato" },
      { name: "Proteína C reativa ultra-sensível (PCR-us)", info: "Inflamação de baixo grau — risco CV e longevidade" },
      { name: "Ácido úrico", info: "Gota, síndrome metabólico, risco cardiovascular" },
      { name: "Vitamina D (25-hidroxivitamina D)", info: "Saúde óssea, imunidade, músculo, longevidade" },
      { name: "Vitamina B12", info: "Neuropatia, défice cognitivo, longevidade" },
      { name: "Hormona tiroestimulante (TSH)", info: "Tiróide — causa reversível de múltiplas doenças crónicas" },
      { name: "Tiroxina livre (T4 livre)", info: "Avaliação tiroideia completa" },
      { name: "IGF-1 (fator de crescimento insulínico tipo 1)", info: "Eixo GH — longevidade, massa muscular, performance" },
      { name: "PSA total", info: "Próstata — rastreio carcinoma (homens >45 anos)" },
      { name: "PSA livre", info: "Próstata — rácio distingue HBP de carcinoma" },
      { name: "Microalbuminúria", info: "Lesão renal precoce, risco cardiovascular" },
      { name: "Exame sumário de urina", info: "Rastreio infecção, hematúria, proteinúria" }
    ]
  },
  {
    id: "desportivo_inicio",
    label: "Med. Desportiva — Início de Época",
    icon: "🏃",
    items: [
      { name: "Hemograma completo", info: "Anemia do desportista, infecção, recuperação" },
      { name: "Ferritina", info: "Reservas de ferro — deficiência frequente em atletas de endurance" },
      { name: "Ferro sérico", info: "Transporte de ferro" },
      { name: "Transferrina", info: "Proteína transportadora de ferro" },
      { name: "Saturação de transferrina", info: "Avaliação sobrecarga ou défice de ferro" },
      { name: "Vitamina D (25-hidroxivitamina D)", info: "Saúde óssea, imunidade, força muscular — défice frequente em atletas" },
      { name: "Vitamina B12", info: "Energia, neuropatia, performance" },
      { name: "Folato", info: "Eritropoiese, recuperação muscular" },
      { name: "Glicose em jejum", info: "Metabolismo glucídico basal" },
      { name: "Hemoglobina glicada (HbA1c)", info: "Controlo glicémico últimos 3 meses" },
      { name: "Ionograma (Sódio, Potássio, Magnésio)", info: "Electrólitos — cãibras, arritmias, performance" },
      { name: "Creatinacinase (CK)", info: "Lesão muscular basal — referência pré-época" },
      { name: "Desidrogenase láctica (LDH)", info: "Lesão muscular e hemólise" },
      { name: "Proteína C reativa ultra-sensível (PCR-us)", info: "Inflamação de baixo grau, sobreetreino" },
      { name: "Hormona tiroestimulante (TSH)", info: "Tiróide — causa de fadiga e performance reduzida" },
      { name: "Tiroxina livre (T4 livre)", info: "Avaliação tiroideia completa" },
      { name: "Triiodotironina livre (T3 livre)", info: "Forma activa — suprimida em REDs e overtraining" },
      { name: "Ureia", info: "Catabolismo proteico — marcador overtraining" },
      { name: "Creatinina", info: "Função renal" },
      { name: "Aspartato aminotransferase (AST / TGO)", info: "Lesão muscular e hepática" },
      { name: "Alanina aminotransferase (ALT / TGP)", info: "Lesão hepática" },
      { name: "Colesterol total", info: "Risco cardiovascular" },
      { name: "Colesterol LDL", info: "Risco cardiovascular" },
      { name: "Colesterol HDL", info: "Protector cardiovascular — frequentemente elevado em atletas" },
      { name: "Triglicerídeos", info: "Risco metabólico" },
      { name: "Ácido úrico", info: "Gota, síndrome metabólico" },
      { name: "Testosterona total", info: "Eixo androgénico — performance, recuperação, sobreetreino" },
      { name: "Cortisol basal (manhã)", info: "Eixo HPA — sobreetreino, rácio testosterona/cortisol" },
      { name: "DHEA-S (dehidroepiandrosterona sulfato)", info: "Eixo suprarrenal androgénico — fadiga, sobreetreino" },
      { name: "SHBG (globulina ligadora de hormonas sexuais)", info: "Fracção livre testosterona — performance" }
    ]
  },
  {
    id: "desportivo_master",
    label: "Med. Desportiva — Atleta >40 anos",
    icon: "🏅",
    items: [
      { name: "Hemograma completo", info: "Anemia, infecção, recuperação" },
      { name: "Ferritina", info: "Reservas de ferro" },
      { name: "Ferro sérico", info: "Transporte de ferro" },
      { name: "Saturação de transferrina", info: "Sobrecarga ou défice de ferro" },
      { name: "Vitamina D (25-hidroxivitamina D)", info: "Saúde óssea, imunidade, músculo — défice aumenta com idade" },
      { name: "Vitamina B12", info: "Neuropatia, energia, cognição" },
      { name: "Folato", info: "Eritropoiese, homocisteína" },
      { name: "Glicose em jejum", info: "Diabetes, resistência insulínica" },
      { name: "Hemoglobina glicada (HbA1c)", info: "Controlo glicémico" },
      { name: "Insulina em jejum", info: "Resistência insulínica" },
      { name: "Ionograma (Sódio, Potássio, Magnésio)", info: "Electrólitos — cãibras, arritmias" },
      { name: "Creatinacinase (CK)", info: "Lesão muscular basal" },
      { name: "Desidrogenase láctica (LDH)", info: "Lesão muscular e hemólise" },
      { name: "Proteína C reativa ultra-sensível (PCR-us)", info: "Inflamação crónica de baixo grau — risco CV e longevidade" },
      { name: "Homocisteína", info: "Risco vascular cerebral e CV" },
      { name: "Hormona tiroestimulante (TSH)", info: "Tiróide — rastreio obrigatório >40 anos" },
      { name: "Tiroxina livre (T4 livre)", info: "Avaliação tiroideia completa" },
      { name: "Triiodotironina livre (T3 livre)", info: "Forma activa — overtraining e REDs" },
      { name: "Ureia", info: "Catabolismo proteico, função renal" },
      { name: "Creatinina", info: "Função renal" },
      { name: "Cistatina-C", info: "Função renal precoce — melhor que creatinina em atletas master" },
      { name: "Aspartato aminotransferase (AST / TGO)", info: "Lesão muscular e hepática" },
      { name: "Alanina aminotransferase (ALT / TGP)", info: "Lesão hepática" },
      { name: "Fosfatase alcalina (FA)", info: "Osso e fígado" },
      { name: "Gama-glutamiltransferase (GGT)", info: "Lesão hepática" },
      { name: "Colesterol total", info: "Risco CV — aumenta com idade" },
      { name: "Colesterol LDL", info: "Principal alvo terapêutico" },
      { name: "Colesterol HDL", info: "Protector cardiovascular" },
      { name: "Triglicerídeos", info: "Risco metabólico" },
      { name: "Apolipoproteína B", info: "Melhor marcador risco CV que LDL" },
      { name: "Lipoproteína (a) — Lp(a)", info: "Risco CV independente — rastreio recomendado >40 anos" },
      { name: "Ácido úrico", info: "Gota, síndrome metabólico" },
      { name: "Testosterona total", info: "Hipogonadismo do atleta master — declínio fisiológico com idade" },
      { name: "Testosterona livre", info: "Fracção activa — mais relevante que total" },
      { name: "SHBG (globulina ligadora de hormonas sexuais)", info: "Aumenta com idade — reduz testosterona livre" },
      { name: "Cortisol basal (manhã)", info: "Eixo HPA — sobreetreino, rácio testosterona/cortisol" },
      { name: "DHEA-S (dehidroepiandrosterona sulfato)", info: "Declina com idade — fadiga, sarcopenia" },
      { name: "IGF-1 (fator de crescimento insulínico tipo 1)", info: "Eixo GH — massa muscular, recuperação, longevidade" },
      { name: "PSA total", info: "Próstata — rastreio obrigatório em homens >45 anos" },
      { name: "PSA livre", info: "Próstata — rácio distingue HBP de carcinoma" },
      { name: "Microalbuminúria", info: "Lesão renal precoce, risco CV" },
      { name: "Exame sumário de urina", info: "Rastreio infecção, hematúria, proteinúria" }
    ]
  },
  {
    id: "desportivo_mulher",
    label: "Med. Desportiva — Atleta Mulher",
    icon: "🚺",
    items: [
      { name: "Hemograma completo", info: "Anemia ferropénica — muito frequente em atletas mulher" },
      { name: "Ferritina", info: "Reservas de ferro — défice frequente, impacta performance" },
      { name: "Ferro sérico", info: "Transporte de ferro" },
      { name: "Transferrina", info: "Proteína transportadora de ferro" },
      { name: "Saturação de transferrina", info: "Avaliação estado do ferro" },
      { name: "Vitamina D (25-hidroxivitamina D)", info: "Saúde óssea crítica — fracturas de stress, tríade da atleta" },
      { name: "Vitamina B12", info: "Energia, neuropatia, performance" },
      { name: "Folato", info: "Eritropoiese, saúde reprodutiva" },
      { name: "Glicose em jejum", info: "Metabolismo glucídico" },
      { name: "Hemoglobina glicada (HbA1c)", info: "Controlo glicémico" },
      { name: "Insulina em jejum", info: "Resistência insulínica — SOP" },
      { name: "Ionograma (Sódio, Potássio, Magnésio)", info: "Electrólitos — cãibras, arritmias, performance" },
      { name: "Creatinacinase (CK)", info: "Lesão muscular basal" },
      { name: "Desidrogenase láctica (LDH)", info: "Lesão muscular e hemólise" },
      { name: "Proteína C reativa ultra-sensível (PCR-us)", info: "Inflamação, sobreetreino, REDs" },
      { name: "Hormona tiroestimulante (TSH)", info: "Tiróide — hipotiroidismo frequente em mulher atleta" },
      { name: "Triiodotironina livre (T3 livre)", info: "Suprimida em REDs e baixa disponibilidade energética" },
      { name: "Tiroxina livre (T4 livre)", info: "Avaliação tiroideia completa" },
      { name: "FSH (hormona folículo-estimulante)", info: "Ciclo menstrual, amenorreia, tríade da atleta" },
      { name: "LH (hormona luteinizante)", info: "Suprimida em amenorreia hipotalâmica — REDs" },
      { name: "Estradiol (E2)", info: "Saúde óssea, ciclo menstrual — baixo em amenorreia atlética" },
      { name: "Progesterona", info: "Confirmação ovulação" },
      { name: "Prolactina", info: "Amenorreia — excluir adenoma hipofisário" },
      { name: "Testosterona total", info: "SOP, performance, eixo androgénico" },
      { name: "SHBG (globulina ligadora de hormonas sexuais)", info: "Fracção livre testosterona" },
      { name: "DHEA-S (dehidroepiandrosterona sulfato)", info: "Eixo suprarrenal androgénico" },
      { name: "Cortisol basal (manhã)", info: "Sobreetreino, REDs, eixo HPA" },
      { name: "IGF-1 (fator de crescimento insulínico tipo 1)", info: "Crescimento, massa muscular, saúde óssea" },
      { name: "Ureia", info: "Catabolismo proteico, função renal" },
      { name: "Creatinina", info: "Função renal" },
      { name: "Aspartato aminotransferase (AST / TGO)", info: "Lesão muscular e hepática" },
      { name: "Alanina aminotransferase (ALT / TGP)", info: "Lesão hepática" },
      { name: "Colesterol total", info: "Risco cardiovascular" },
      { name: "Colesterol LDL", info: "Risco cardiovascular" },
      { name: "Colesterol HDL", info: "Protector cardiovascular" },
      { name: "Triglicerídeos", info: "Risco metabólico" },
      { name: "Ácido úrico", info: "Gota, síndrome metabólico" }
    ]
  },
  {
    id: "desportivo_overtraining",
    label: "Med. Desportiva — Overtraining / REDs",
    icon: "⚠️",
    items: [
      { name: "Hemograma com fórmula leucocitária", info: "Imunossupressão, anemia, infecção — frequentes em overtraining" },
      { name: "Ferritina", info: "Reservas de ferro — défice agrava fadiga e performance" },
      { name: "Ferro sérico", info: "Transporte de ferro" },
      { name: "Saturação de transferrina", info: "Estado do ferro" },
      { name: "Creatinacinase (CK)", info: "Lesão muscular crónica — marcador sobrecarga de treino" },
      { name: "Desidrogenase láctica (LDH)", info: "Lesão muscular e hemólise" },
      { name: "Mioglobina", info: "Lesão muscular aguda — rabdomiólise" },
      { name: "Proteína C reativa ultra-sensível (PCR-us)", info: "Inflamação sistémica de baixo grau — sobreetreino" },
      { name: "Velocidade de sedimentação (VS)", info: "Inflamação crónica" },
      { name: "Cortisol basal (manhã)", info: "Eixo HPA — elevado em overtraining agudo, baixo em crónico" },
      { name: "Testosterona total", info: "Suprimida em overtraining — rácio testosterona/cortisol baixo" },
      { name: "DHEA-S (dehidroepiandrosterona sulfato)", info: "Eixo suprarrenal — fadiga suprarrenal em overtraining crónico" },
      { name: "Hormona tiroestimulante (TSH)", info: "Tiróide — supressão em REDs e baixa disponibilidade energética" },
      { name: "Triiodotironina livre (T3 livre)", info: "Primeiro a suprimir em REDs — sinal precoce de baixa disponibilidade energética" },
      { name: "Tiroxina livre (T4 livre)", info: "Avaliação tiroideia completa" },
      { name: "IGF-1 (fator de crescimento insulínico tipo 1)", info: "Suprimido em overtraining — défice anabólico" },
      { name: "Estradiol (E2)", info: "Amenorreia atlética — baixo em REDs" },
      { name: "LH (hormona luteinizante)", info: "Amenorreia hipotalâmica — suprimida em REDs" },
      { name: "FSH (hormona folículo-estimulante)", info: "Disfunção eixo hipotálamo-hipófise-gonadal" },
      { name: "Prolactina", info: "Stress fisiológico intenso — pode elevar" },
      { name: "Hormona antimülleriana (AMH)", info: "Reserva ovárica — impacto REDs na fertilidade" },
      { name: "Glicose em jejum", info: "Hipoglicemia em baixa disponibilidade energética" },
      { name: "Insulina em jejum", info: "Resistência insulínica ou hipoinsulinemia em REDs" },
      { name: "Ionograma (Sódio, Potássio, Magnésio)", info: "Electrólitos — défices frequentes em overtraining" },
      { name: "Zinco", info: "Défice associado a imunossupressão e overtraining" },
      { name: "Ureia", info: "Catabolismo proteico elevado — marcador sobreetreino" },
      { name: "Creatinina", info: "Função renal" },
      { name: "Vitamina D (25-hidroxivitamina D)", info: "Saúde óssea e imunidade — défice agrava overtraining" },
      { name: "Vitamina B12", info: "Energia, neuropatia, performance" },
      { name: "Folato", info: "Eritropoiese, recuperação" },
      { name: "SHBG (globulina ligadora de hormonas sexuais)", info: "Fracção livre testosterona — performance e recuperação" }
    ]
  }
];

/* ====================================================================
   FUNÇÃO 12H.2 — openAnalisesPanel / closeAnalisesPanel / analisesUiState
   ==================================================================== */

/**
 * Estado global do painel de análises — exportado para doente.js
 * saber se o painel está aberto (para o estado do botão).
 */
export const analisesUiState = {
  isOpen: false
};

/**
 * closeAnalisesPanel
 * Remove o painel do DOM e actualiza o estado.
 * @param {Function} [onClose] — callback opcional chamado após fechar
 */
export function closeAnalisesPanel(onClose) {
  analisesUiState.isOpen = false;
  document.getElementById("gcAnalisesPanel")?.remove();
  if (typeof onClose === "function") onClose();
}

/**
 * openAnalisesPanel
 * Abre o painel lateral de pedido de análises dentro do feed do doente.
 * Substituiu openAnalisesModal (position:fixed) por painel lateral
 * idêntico ao openExamsPanel, sem tapar a timeline.
 * @param {{ patientId: string, consultationId: string|null, onClose?: Function }} opts
 */
export function openAnalisesPanel({ patientId, consultationId, onClose } = {}) {
  analisesUiState.isOpen = true;

  /* Reutilizar estado se o painel já existia (preserva selecções) */
  if (!openAnalisesPanel.__state) {
    openAnalisesPanel.__state = { selected: {}, clinicalInfo: "" };
  }
  const state = openAnalisesPanel.__state;

  /* Limpar selecções ao abrir de novo para um doente diferente */
  if (openAnalisesPanel.__lastPatient !== patientId) {
    state.selected     = {};
    state.clinicalInfo = "";
    openAnalisesPanel.__lastPatient = patientId;
  }

  /* ---- helpers de estado ---- */
  function toggleGroup(gid) {
    if (state.selected[gid]) {
      delete state.selected[gid];
    } else {
      /* Ponto 6: ao expandir, selecciona todos por defeito */
      const grp = ANALISES_CATALOG.find(g => g.id === gid);
      state.selected[gid] = new Set(grp.items.map((_, i) => i));
    }
    renderPanel();
  }

  function toggleItem(gid, idx) {
    if (!state.selected[gid]) return;
    if (state.selected[gid].has(idx)) {
      state.selected[gid].delete(idx);
      if (state.selected[gid].size === 0) delete state.selected[gid];
    } else {
      state.selected[gid].add(idx);
    }
    renderPanel();
  }

  function totalSelected() {
    return Object.values(state.selected).reduce((acc, s) => acc + s.size, 0);
  }

  /* ---- construção do host (igual ao exames.js) ---- */
  function getHost() {
    const btnClose = document.getElementById("btnClosePView");
    if (!btnClose) return null;
    let host = btnClose.parentElement;
    while (host && host.parentElement) {
      const style         = window.getComputedStyle(host);
      const hasWhiteBg    = style.backgroundColor === "rgb(255, 255, 255)";
      const hasLargeBox   = host.clientWidth >= 900 && host.clientHeight >= 500;
      const hasScrollable = style.overflow === "auto" || style.overflowY === "auto";
      if (hasWhiteBg && hasLargeBox && hasScrollable) break;
      host = host.parentElement;
    }
    return host || null;
  }

  /* ---- HTML do painel ---- */
  function buildPanelInnerHtml() {
    const hasSelected = totalSelected() > 0;

    const searchQ = (state.searchQuery || "").toLowerCase().trim();

    const groupsHtml = ANALISES_CATALOG.map(grp => {
      const filteredItems = searchQ
        ? grp.items.filter(item => (item.name || item).toLowerCase().includes(searchQ) || (item.info || "").toLowerCase().includes(searchQ))
        : grp.items;
      if (searchQ && filteredItems.length === 0) return "";

      const isOpen   = searchQ ? true : !!state.selected[grp.id];
      const selCount = state.selected[grp.id] ? state.selected[grp.id].size : 0;

      const itemsHtml = isOpen
        ? filteredItems.map((item) => {
            const idx = grp.items.indexOf(item);
            const checked = state.selected[grp.id]?.has(idx);
            return `
              <label class="gcAnal-item ${checked ? "gcAnal-item--checked" : ""}">
                <input type="checkbox" data-gid="${grp.id}" data-idx="${idx}"
                  ${checked ? "checked" : ""}
                  style="width:14px;height:14px;accent-color:#1d9e75;flex-shrink:0;cursor:pointer;margin-top:1px;">
                <span>
                  <span style="display:block;line-height:1.3;">${item.name}</span>
                  ${item.info ? `<span style="display:block;font-size:10px;color:#64748b;line-height:1.3;margin-top:1px;">${item.info}</span>` : ""}
                </span>
              </label>`;
          }).join("")
        : "";

      return `
        <div class="gcAnal-group ${isOpen ? "gcAnal-group--open" : ""}">
          <div class="gcAnal-group-header" data-gid="${grp.id}">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:16px;line-height:1">${grp.icon}</span>
              <span class="gcAnal-group-label">${grp.label}</span>
              ${isOpen ? `<span class="gcAnal-badge">${selCount} sel.</span>` : ""}
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
              ${isOpen ? `<button class="gcAnal-deselect-all" data-gid="${grp.id}">Limpar</button>` : ""}
              <span class="gcAnal-chevron">${isOpen ? "▲" : "▼"}</span>
            </div>
          </div>
          ${isOpen ? `<div class="gcAnal-items">${itemsHtml}</div>` : ""}
        </div>`;
    }).join("");

    return `
      <style>
        .gcAnal-group{border:1px solid #e2e8f0;border-radius:10px;margin-bottom:7px;overflow:hidden;}
        .gcAnal-group--open{border-color:#1d9e75;}
        .gcAnal-group-header{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;cursor:pointer;background:#f8fafc;user-select:none;}
        .gcAnal-group--open .gcAnal-group-header{background:#e8f8f3;}
        .gcAnal-group-header:hover{background:#f1f5f9;}
        .gcAnal-group--open .gcAnal-group-header:hover{background:#d4f1e7;}
        .gcAnal-group-label{font-size:13px;font-weight:600;color:#0f172a;}
        .gcAnal-badge{font-size:10px;font-weight:700;background:#1d9e75;color:#fff;padding:2px 7px;border-radius:100px;}
        .gcAnal-chevron{font-size:11px;color:#94a3b8;}
        .gcAnal-deselect-all{font-size:11px;color:#64748b;background:none;border:1px solid #cbd5e1;border-radius:5px;padding:2px 7px;cursor:pointer;font-family:inherit;}
        .gcAnal-deselect-all:hover{background:#f1f5f9;}
        .gcAnal-items{display:grid;grid-template-columns:1fr 1fr;gap:3px;padding:8px 12px 10px;border-top:1px solid #e2e8f0;background:#fff;}
        .gcAnal-item{display:flex;align-items:flex-start;gap:6px;font-size:12px;color:#374151;padding:4px 6px;border-radius:6px;cursor:pointer;border:1px solid transparent;line-height:1.35;}
        .gcAnal-item:hover{background:#f8fafc;border-color:#e2e8f0;}
        .gcAnal-item--checked{color:#0f172a;}
      </style>

      <div style="padding:12px 14px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between;">
        <div style="font-weight:800;font-size:15px;color:#111827;">Pedido de Análises</div>
        <button id="gcAnalisesClose" class="gcBtn"
          style="background:#ffffff;border:1px solid #d1d5db;color:#111827;font-weight:700;">
          Fechar
        </button>
      </div>

      <div style="padding:8px 14px;border-bottom:1px solid #e5e7eb;">
        <input id="gcAnalisesSearch" type="text" placeholder="Pesquisar análise…"
          value="${state.searchQuery || ''}"
          style="width:100%;padding:6px 10px;font-size:12px;border:1px solid #cbd5e1;border-radius:8px;
                 background:#f8fafc;color:#0f172a;box-sizing:border-box;font-family:inherit;outline:none;">
      </div>
      ${totalSelected() > 0 ? `
      <div style="padding:7px 14px;border-bottom:1px solid #e5e7eb;background:#f8fafc;">
        <div style="font-size:10px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:5px;">Seleccionadas</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;">
          ${ANALISES_CATALOG.flatMap(g => {
            if (!state.selected[g.id]) return [];
            return [...state.selected[g.id]].map(idx => {
              const itemName = g.items[idx]?.name || g.items[idx];
              return `<span class="gcAnal-pill" data-gid="${g.id}" data-idx="${idx}"
                style="font-size:11px;background:#fff;border:1px solid #cbd5e1;border-radius:100px;
                       padding:2px 8px;display:inline-flex;align-items:center;gap:4px;cursor:pointer;color:#0f172a;">
                ${itemName}
                <span style="color:#94a3b8;font-size:12px;line-height:1;">×</span>
              </span>`;
            });
          }).join("")}
        </div>
      </div>` : ""}

      <div id="gcAnalisesBody" style="flex:1;overflow-y:auto;padding:12px 14px;">
        ${groupsHtml}

        <div style="margin-top:12px;">
          <div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:5px;">Informação clínica</div>
          <textarea id="gcAnalisesCliInfo"
            placeholder="Ex: Suspeita espondiloartrite, dor lombar crónica…"
            style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;
                   font-size:13px;resize:vertical;min-height:60px;font-family:inherit;
                   color:#0f172a;outline:none;box-sizing:border-box;"
          >${state.clinicalInfo}</textarea>
        </div>
      </div>

      <div style="padding:10px 14px;border-top:1px solid #e2e8f0;
                  display:flex;align-items:center;justify-content:space-between;
                  background:#f8fafc;flex-shrink:0;">
        <div style="font-size:12px;color:#64748b;">
          ${hasSelected
            ? `<span style="color:#1d9e75;font-weight:700;">${totalSelected()} análise${totalSelected()!==1?"s":""} sel.</span>`
            : `<span>Nenhum grupo seleccionado</span>`}
        </div>
        <button id="gcAnalisesGenPdf"
          ${hasSelected ? "" : "disabled"}
          style="padding:7px 18px;border:none;border-radius:8px;
                 background:${hasSelected?"#1d9e75":"#cbd5e1"};
                 color:${hasSelected?"#fff":"#94a3b8"};
                 font-size:13px;font-weight:700;
                 cursor:${hasSelected?"pointer":"not-allowed"};
                 font-family:inherit;">
          Gerar PDF
        </button>
      </div>`;
  }

  /* ---- render do painel no DOM ---- */
  function renderPanel() {
    /* Guardar clinicalInfo antes de re-renderizar */
    const existingTa = document.getElementById("gcAnalisesCliInfo");
    if (existingTa) state.clinicalInfo = existingTa.value;

    let panel = document.getElementById("gcAnalisesPanel");
    if (!panel) {
      const host = getHost();
      if (!host) { console.error("gcAnalisesPanel: host não encontrado"); return; }
      host.style.position = "relative";

      panel     = document.createElement("div");
      panel.id  = "gcAnalisesPanel";
      Object.assign(panel.style, {
        position:                "absolute",
        top:                     "0",
        right:                   "0",
        width:                   "380px",
        height:                  "100%",
        background:              "#ffffff",
        borderLeft:              "1px solid #e5e7eb",
        boxShadow:               "-8px 0 24px rgba(0,0,0,0.08)",
        zIndex:                  "50",
        display:                 "flex",
        flexDirection:           "column",
        borderTopRightRadius:    "14px",
        borderBottomRightRadius: "14px"
      });
      host.appendChild(panel);
    }

    panel.innerHTML = buildPanelInnerHtml();
    bindPanelEvents();
  }

  /* ---- eventos ---- */
  function bindPanelEvents() {
    document.getElementById("gcAnalisesClose")?.addEventListener("click", () => {
      closeAnalisesPanel(onClose);
    });

    document.querySelectorAll(".gcAnal-group-header").forEach(el => {
      el.addEventListener("click", e => {
        if (e.target.classList.contains("gcAnal-deselect-all")) return;
        const ta = document.getElementById("gcAnalisesCliInfo");
        if (ta) state.clinicalInfo = ta.value;
        toggleGroup(el.dataset.gid);
      });
    });

    document.querySelectorAll(".gcAnal-deselect-all").forEach(btn => {
      btn.addEventListener("click", e => {
        e.stopPropagation();
        const ta = document.getElementById("gcAnalisesCliInfo");
        if (ta) state.clinicalInfo = ta.value;
        delete state.selected[btn.dataset.gid];
        renderPanel();
      });
    });

    document.querySelectorAll(".gcAnal-item input[type=checkbox]").forEach(cb => {
      cb.addEventListener("change", e => {
        e.stopPropagation();
        const ta = document.getElementById("gcAnalisesCliInfo");
        if (ta) state.clinicalInfo = ta.value;
        toggleItem(cb.dataset.gid, parseInt(cb.dataset.idx));
      });
    });

    document.getElementById("gcAnalisesCliInfo")?.addEventListener("input", e => {
      state.clinicalInfo = e.target.value;
    });

    document.getElementById("gcAnalisesSearch")?.addEventListener("input", e => {
      state.searchQuery = e.target.value;
      renderPanel();
    });

    document.querySelectorAll(".gcAnal-pill").forEach(pill => {
      pill.addEventListener("click", e => {
        e.stopPropagation();
        const gid = pill.dataset.gid;
        const idx = parseInt(pill.dataset.idx);
        if (state.selected[gid]) {
          state.selected[gid].delete(idx);
          if (state.selected[gid].size === 0) delete state.selected[gid];
        }
        renderPanel();
      });
    });

    document.getElementById("gcAnalisesGenPdf")?.addEventListener("click", async () => {
      if (totalSelected() === 0) return;
      const ta = document.getElementById("gcAnalisesCliInfo");
      if (ta) state.clinicalInfo = ta.value;
      await gerarAnalisePdf(state, openAnalisesPanel.__lastPatient);
    });
  }

  renderPanel();
}

/**
 * openAnalisesModal
 * @deprecated Mantido por compatibilidade com chamadas antigas via window.openAnalisesModal.
 * Redireciona para openAnalisesPanel.
 */
export function openAnalisesModal(opts = {}) {
  openAnalisesPanel(opts);
}

/* ====================================================================
   FUNÇÃO 12H.3 — gerarAnalisePdf
   ==================================================================== */

/**
 * gerarAnalisePdf
 * Recolhe assets (vinheta, logo, assinatura), constrói HTML e abre o editor.
 */
export async function gerarAnalisePdf(state, patientId) {
  const btn = document.getElementById("gcAnalisesGenPdf");
  if (btn) { btn.textContent = "A gerar…"; btn.disabled = true; }

  try {
    const signedUrl    = window.__gc_storageSignedUrl;
    const toDataUrl    = window.__gc_urlToDataUrl;
    const bucket       = window.__gc_VINHETA_BUCKET;
    const vinhetaPath  = window.__gc_VINHETA_PATH;
    const sigPath      = window.__gc_SIGNATURE_PATH;

    const { data: patientClinicRow, error: pcErr } = await window.sb
      .from("patient_clinic").select("clinic_id")
      .eq("patient_id", patientId).eq("is_active", true).single();
    if (pcErr || !patientClinicRow?.clinic_id) {
      throw new Error("Não consegui determinar a clínica ativa do doente.");
    }
    const { data: clinic, error: clinicErr } = await window.sb
      .from("clinics")
      .select("id, name, address_line1, address_line2, postal_code, city, phone, email, website, logo_url")
      .eq("id", patientClinicRow.clinic_id).single();
    if (clinicErr || !clinic) throw new Error("Não consegui carregar os dados da clínica.");

    const [vinhetaUrl, logoUrl, signatureUrl] = await Promise.all([
      (async () => { try { const u = await signedUrl(bucket, vinhetaPath, 3600); return u ? await toDataUrl(u, "image/png") : ""; } catch { return ""; } })(),
      (async () => {
        try {
          const rawLogo = String(clinic?.logo_url || "").trim();
          if (!rawLogo) return "";
          if (rawLogo.startsWith("data:")) return rawLogo;
          if (rawLogo.startsWith("http://") || rawLogo.startsWith("https://"))
            return await toDataUrl(rawLogo, "image/png");
          const u = await signedUrl(bucket, rawLogo, 3600);
          return u ? await toDataUrl(u, "image/png") : "";
        } catch { return ""; }
      })(),
      (async () => { try { const u = await signedUrl(bucket, sigPath, 3600); return u ? await toDataUrl(u, "image/png") : ""; } catch { return ""; } })()
    ]);

    const { data: patientProfile } = await window.sb.from("profiles").select("full_name").eq("id", patientId).single();
    const patientName = patientProfile?.full_name || "";
    const html = buildAnalisesHtml({ clinic, state, vinhetaUrl, logoUrl, signatureUrl, patientName });
    window.openDocumentEditor(html, "Pedido de Análises");
    closeAnalisesPanel();

  } catch (err) {
    console.error("gerarAnalisePdf falhou:", err);
    alert("Erro ao gerar pedido de análises.");
    if (btn) { btn.textContent = "Gerar PDF"; btn.disabled = false; }
  }
}

/* ====================================================================
   FUNÇÃO 12H.4 — buildAnalisesHtml
   ==================================================================== */

/**
 * buildAnalisesHtml
 * Constrói o HTML A4 para o pedido de análises.
 */
export function buildAnalisesHtml({ clinic, state, vinhetaUrl, logoUrl, signatureUrl, patientName }) {
  function escHtml(v) { return String(v||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
  function escUrl(u)  { return String(u||"").replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  function nl2br(v)   { return escHtml(v).replace(/\n/g,"<br>"); }
  function fmtDate()  { const dt = new Date(); return `${String(dt.getDate()).padStart(2,"0")}-${String(dt.getMonth()+1).padStart(2,"0")}-${dt.getFullYear()}`; }

  const gruposAtivos = ANALISES_CATALOG.filter(g => state.selected[g.id] && state.selected[g.id].size > 0);
  const multiGrupo   = gruposAtivos.length > 1;

  let todasAnalises = [];
  gruposAtivos.forEach(grp => {
    const sel   = state.selected[grp.id];
    const items = grp.items.filter((_, i) => sel.has(i));
    if (multiGrupo) todasAnalises.push({ tipo: "grupo", label: grp.label });
    items.forEach(item => todasAnalises.push({ tipo: "item", label: item.name }));
  });

  const metade = Math.ceil(todasAnalises.length / 2);
  const col1   = todasAnalises.slice(0, metade);
  const col2   = todasAnalises.slice(metade);

  function renderColuna(items) {
    return items.map(e =>
      e.tipo === "grupo"
        ? `<div class="grp-header">${escHtml(e.label)}</div>`
        : `<div class="item-row"><span class="bullet">—</span>${escHtml(e.label)}</div>`
    ).join("");
  }

  const localityDate = [String(clinic?.city || "").trim(), fmtDate()].filter(Boolean).join(", ");
  const logoSrc      = String(logoUrl || clinic?.logo_url || "").trim();
  const clinicalInfo = String(state.clinicalInfo || "").trim();

  return `<!doctype html>
<html><head><meta charset="utf-8"/><title>Pedido de Análises</title>
<style>
  body{margin:0;background:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;color:#111;}
  *{box-sizing:border-box;}
  @page{size:A4;margin:16mm;}
  .a4{width:210mm;background:#fff;}
  .top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;}
  .topLeft{font-size:13.5px;line-height:1.4;}
  .logo{width:120px;height:auto;max-height:60px;object-fit:contain;display:block;}
  .hr{height:1px;background:#111;margin:10px 0 14px;}
  .title{text-align:center;font-weight:900;font-size:22px;margin:2px 0 18px;}
  .rx{font-weight:800;font-size:17px;margin-bottom:14px;}
  .cols{display:grid;grid-template-columns:1fr 1fr;gap:0 28px;}
  .grp-header{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#444;margin:14px 0 6px;padding-bottom:3px;border-bottom:1px solid #ccc;}
  .item-row{display:flex;align-items:baseline;gap:6px;font-size:14px;line-height:1.6;color:#111;}
  .bullet{color:#888;flex-shrink:0;font-size:13px;}
  .cli-label{font-weight:800;font-size:14px;margin-top:22px;margin-bottom:4px;}
  .cli-text{font-size:14px;line-height:1.5;min-height:36px;}
  .footerBlock{margin-top:28px;page-break-inside:avoid;break-inside:avoid;}
  .hr2{height:1px;background:#111;margin:16px 0 10px;}
  .footRow{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;}
  .web{font-size:14px;font-weight:700;}
  .vinheta{margin-top:8px;width:4cm;height:2.5cm;object-fit:contain;display:block;}
  .locDate{text-align:right;font-size:14px;margin-top:14px;}
  .sig{margin-top:40px;display:flex;justify-content:flex-end;}
  .sigBox{width:360px;text-align:center;}
  .sigLine{border-top:1px solid #111;padding-top:10px;}
  .sigName{font-weight:900;font-size:18px;margin-top:6px;}
  .sigRole{font-size:14px;margin-top:2px;}
</style>
</head><body>
<div class="a4">
  <div class="top">
    <div class="topLeft">
      <div>${escHtml(clinic?.website || "www.JoaoMorais.pt")}</div>
      <div>${escHtml(clinic?.phone   || "")}</div>
    </div>
    ${logoSrc ? `<img class="logo" src="${escUrl(logoSrc)}"/>` : ""}
  </div>
  <div class="hr"></div>
  <div class="title">Pedido de Análises</div>
  ${patientName ? `<div class="patient-name">Doente: <strong>${escHtml(patientName)}</strong></div>` : ""}
  <div class="rx">R/</div>
  <div class="cols">
    <div>${renderColuna(col1)}</div>
    <div>${renderColuna(col2)}</div>
  </div>
  ${clinicalInfo ? `<div class="cli-label">Informação clínica</div><div class="cli-text">${nl2br(clinicalInfo)}</div>` : ""}
  <div class="footerBlock">
    <div class="hr2"></div>
    <div class="footRow">
      <div>
        <div class="web">www.JoaoMorais.pt</div>
        ${vinhetaUrl ? `<img class="vinheta" src="${escUrl(vinhetaUrl)}"/>` : ""}
      </div>
      <div style="flex:1;">
        ${localityDate ? `<div class="locDate">${escHtml(localityDate)}</div>` : ""}
        <div class="sig">
          <div class="sigBox">

            <div class="sigLine"></div>
            <div class="sigName">Dr. João Morais</div>
            <div class="sigRole">Médico Fisiatra</div>
            <div class="sigRole">Sports Medicine &amp; Rehabilitation</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
</body></html>`;
}
