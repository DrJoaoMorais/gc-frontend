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
      "Hemograma completo",
      "Hemograma com fórmula leucocitária",
      "Velocidade de sedimentação (VS)",
      "Tempo de protrombina — INR",
      "Tempo de tromboplastina parcial ativado (APTT)",
      "Fibrinogénio",
      "Dímeros-D",
      "Grupo sanguíneo (ABO)",
      "Tipagem ABO e Rh (D)"
    ]
  },
  {
    id: "bioquimica",
    label: "Bioquímica / Função Orgânica",
    icon: "🧪",
    items: [
      "Glicose em jejum",
      "Hemoglobina glicada (HbA1c)",
      "Insulina em jejum",
      "Ureia",
      "Creatinina",
      "Cistatina-C",
      "Ácido úrico",
      "Ionograma (Sódio, Potássio, Cloro)",
      "Magnésio",
      "Cálcio total",
      "Fósforo",
      "Aspartato aminotransferase (AST / TGO)",
      "Alanina aminotransferase (ALT / TGP)",
      "Fosfatase alcalina (FA)",
      "Gama-glutamiltransferase (GGT)",
      "Bilirrubina total e frações",
      "Proteínas totais e albumina",
      "Proteinograma — eletroforese de proteínas",
      "Desidrogenase láctica (LDH)",
      "Creatinacinase (CK)",
      "Mioglobina",
      "Proteína C reativa (PCR)",
      "Proteína C reativa ultra-sensível (PCR-us)",
      "Ferritina",
      "Ferro sérico",
      "Transferrina",
      "Saturação de transferrina",
      "Vitamina D (25-hidroxivitamina D)",
      "Vitamina B12",
      "Folato"
    ]
  },
  {
    id: "lipidico",
    label: "Perfil Lipídico",
    icon: "💛",
    items: [
      "Colesterol total",
      "Colesterol LDL",
      "Colesterol HDL",
      "Triglicerídeos",
      "Apolipoproteína B",
      "Apolipoproteína A1",
      "Lipoproteína (a) — Lp(a)",
      "Homocisteína"
    ]
  },
  {
    id: "endocrinologia",
    label: "Endocrinologia / Tiróide",
    icon: "⚗️",
    items: [
      "Hormona tiroestimulante (TSH)",
      "Triiodotironina livre (T3 livre)",
      "Tiroxina livre (T4 livre)",
      "Triiodotironina total (T3 total)",
      "Tiroxina total (T4 total)",
      "Calcitonina",
      "Hormona paratiroideia (PTH)",
      "IGF-1 (fator de crescimento insulínico tipo 1)",
      "Cortisol basal (manhã)",
      "ACTH",
      "Prolactina",
      "DHEA-S (dehidroepiandrosterona sulfato)",
      "Testosterona total",
      "Testosterona livre",
      "SHBG (globulina ligadora de hormonas sexuais)"
    ]
  },
  {
    id: "ginecologia",
    label: "Hormonal Feminino / Ginecologia",
    icon: "♀️",
    items: [
      "FSH (hormona folículo-estimulante)",
      "LH (hormona luteinizante)",
      "Estradiol (E2)",
      "Progesterona",
      "Prolactina",
      "Testosterona total",
      "SHBG (globulina ligadora de hormonas sexuais)",
      "DHEA-S",
      "Hormona antimülleriana (AMH)",
      "17-OH-Progesterona"
    ]
  },
  {
    id: "reumatologia",
    label: "Reumatologia / Autoimunidade",
    icon: "🦴",
    items: [
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
      "Complemento C4"
    ]
  },
  {
    id: "serologias",
    label: "Serologias / Doenças Infecciosas",
    icon: "🦠",
    items: [
      "VIH — Antigénio p24 + Anticorpos VIH-1/2",
      "Hepatite A — Anticorpos IgM",
      "Hepatite A — Anticorpos totais",
      "Hepatite B — Antigénio HBs (AgHBs)",
      "Hepatite B — Anticorpos anti-HBs",
      "Hepatite B — Anticorpos anti-HBc",
      "Hepatite C — Anticorpos anti-VHC",
      "Hepatite C — Pesquisa de RNA (PCR)",
      "VDRL",
      "TPHA — Anticorpos anti-Treponema pallidum",
      "Paul-Bunnell / Monospot"
    ]
  },
  {
    id: "urina",
    label: "Urina",
    icon: "💧",
    items: [
      "Exame sumário de urina",
      "Microalbuminúria",
      "Proteína de Bence-Jones — urina de 24 horas",
      "Hidroxiprolina total — urina de 24 horas",
      "Cortisol urinário livre — urina de 24 horas"
    ]
  },
  {
    id: "longevidade",
    label: "Longevidade",
    icon: "⏳",
    items: [
      "Hemograma completo",
      "Ferritina",
      "Ferro sérico",
      "Saturação de transferrina",
      "Ureia",
      "Creatinina",
      "Cistatina-C",
      "Glicose em jejum",
      "Insulina em jejum",
      "Hemoglobina glicada (HbA1c)",
      "Aspartato aminotransferase (AST / TGO)",
      "Alanina aminotransferase (ALT / TGP)",
      "Fosfatase alcalina (FA)",
      "Gama-glutamiltransferase (GGT)",
      "Bilirrubina total e frações",
      "Creatinacinase (CK)",
      "Colesterol total",
      "Colesterol LDL",
      "Colesterol HDL",
      "Triglicerídeos",
      "Apolipoproteína B",
      "Lipoproteína (a) — Lp(a)",
      "Homocisteína",
      "Proteína C reativa ultra-sensível (PCR-us)",
      "Ácido úrico",
      "Vitamina D (25-hidroxivitamina D)",
      "Vitamina B12",
      "Hormona tiroestimulante (TSH)",
      "Tiroxina livre (T4 livre)",
      "IGF-1 (fator de crescimento insulínico tipo 1)",
      "Antigénio específico da próstata total (PSA total)",
      "Antigénio específico da próstata livre (PSA livre)",
      "Microalbuminúria",
      "Exame sumário de urina",
      "HOMA-IR (índice de resistência à insulina)"
    ]
  },
  {
    id: "desportivo_inicio",
    label: "Med. Desportiva — Início de Época",
    icon: "🏃",
    items: [
      "Hemograma completo",
      "Ferritina",
      "Ferro sérico",
      "Transferrina",
      "Saturação de transferrina",
      "Vitamina D (25-hidroxivitamina D)",
      "Vitamina B12",
      "Folato",
      "Glicose em jejum",
      "Hemoglobina glicada (HbA1c)",
      "Ionograma (Sódio, Potássio, Magnésio)",
      "Creatinacinase (CK)",
      "Desidrogenase láctica (LDH)",
      "Proteína C reativa ultra-sensível (PCR-us)",
      "Hormona tiroestimulante (TSH)",
      "Tiroxina livre (T4 livre)",
      "Triiodotironina livre (T3 livre)",
      "Ureia",
      "Creatinina",
      "Aspartato aminotransferase (AST / TGO)",
      "Alanina aminotransferase (ALT / TGP)",
      "Colesterol total",
      "Colesterol LDL",
      "Colesterol HDL",
      "Triglicerídeos",
      "Ácido úrico",
      "Testosterona total",
      "Cortisol basal (manhã)",
      "DHEA-S (dehidroepiandrosterona sulfato)",
      "SHBG (globulina ligadora de hormonas sexuais)"
    ]
  },
  {
    id: "desportivo_master",
    label: "Med. Desportiva — Atleta >40 anos",
    icon: "🏅",
    items: [
      "Hemograma completo",
      "Ferritina",
      "Ferro sérico",
      "Saturação de transferrina",
      "Vitamina D (25-hidroxivitamina D)",
      "Vitamina B12",
      "Folato",
      "Glicose em jejum",
      "Hemoglobina glicada (HbA1c)",
      "Insulina em jejum",
      "Ionograma (Sódio, Potássio, Magnésio)",
      "Creatinacinase (CK)",
      "Desidrogenase láctica (LDH)",
      "Proteína C reativa ultra-sensível (PCR-us)",
      "Homocisteína",
      "Hormona tiroestimulante (TSH)",
      "Tiroxina livre (T4 livre)",
      "Triiodotironina livre (T3 livre)",
      "Ureia",
      "Creatinina",
      "Cistatina-C",
      "Aspartato aminotransferase (AST / TGO)",
      "Alanina aminotransferase (ALT / TGP)",
      "Fosfatase alcalina (FA)",
      "Gama-glutamiltransferase (GGT)",
      "Colesterol total",
      "Colesterol LDL",
      "Colesterol HDL",
      "Triglicerídeos",
      "Apolipoproteína B",
      "Lipoproteína (a) — Lp(a)",
      "Ácido úrico",
      "Testosterona total",
      "Testosterona livre",
      "SHBG (globulina ligadora de hormonas sexuais)",
      "Cortisol basal (manhã)",
      "DHEA-S (dehidroepiandrosterona sulfato)",
      "IGF-1 (fator de crescimento insulínico tipo 1)",
      "Antigénio específico da próstata total (PSA total)",
      "Antigénio específico da próstata livre (PSA livre)",
      "Microalbuminúria",
      "Exame sumário de urina"
    ]
  },
  {
    id: "desportivo_mulher",
    label: "Med. Desportiva — Atleta Mulher",
    icon: "🚺",
    items: [
      "Hemograma completo",
      "Ferritina",
      "Ferro sérico",
      "Transferrina",
      "Saturação de transferrina",
      "Vitamina D (25-hidroxivitamina D)",
      "Vitamina B12",
      "Folato",
      "Glicose em jejum",
      "Hemoglobina glicada (HbA1c)",
      "Insulina em jejum",
      "Ionograma (Sódio, Potássio, Magnésio)",
      "Creatinacinase (CK)",
      "Desidrogenase láctica (LDH)",
      "Proteína C reativa ultra-sensível (PCR-us)",
      "Hormona tiroestimulante (TSH)",
      "Triiodotironina livre (T3 livre)",
      "Tiroxina livre (T4 livre)",
      "FSH (hormona folículo-estimulante)",
      "LH (hormona luteinizante)",
      "Estradiol (E2)",
      "Progesterona",
      "Prolactina",
      "Testosterona total",
      "SHBG (globulina ligadora de hormonas sexuais)",
      "DHEA-S (dehidroepiandrosterona sulfato)",
      "Cortisol basal (manhã)",
      "IGF-1 (fator de crescimento insulínico tipo 1)",
      "Ureia",
      "Creatinina",
      "Aspartato aminotransferase (AST / TGO)",
      "Alanina aminotransferase (ALT / TGP)",
      "Colesterol total",
      "Colesterol LDL",
      "Colesterol HDL",
      "Triglicerídeos",
      "Ácido úrico"
    ]
  },
  {
    id: "desportivo_overtraining",
    label: "Med. Desportiva — Overtraining / REDs",
    icon: "⚠️",
    items: [
      "Hemograma com fórmula leucocitária",
      "Ferritina",
      "Ferro sérico",
      "Saturação de transferrina",
      "Creatinacinase (CK)",
      "Desidrogenase láctica (LDH)",
      "Mioglobina",
      "Proteína C reativa ultra-sensível (PCR-us)",
      "Velocidade de sedimentação (VS)",
      "Cortisol basal (manhã)",
      "Testosterona total",
      "Rácio testosterona / cortisol",
      "DHEA-S (dehidroepiandrosterona sulfato)",
      "Hormona tiroestimulante (TSH)",
      "Triiodotironina livre (T3 livre)",
      "Tiroxina livre (T4 livre)",
      "IGF-1 (fator de crescimento insulínico tipo 1)",
      "Estradiol (E2)",
      "LH (hormona luteinizante)",
      "FSH (hormona folículo-estimulante)",
      "Prolactina",
      "Anti-Mülleriano (AMH) — atleta mulher",
      "Glicose em jejum",
      "Insulina em jejum",
      "HOMA-IR (índice de resistência à insulina)",
      "Ionograma (Sódio, Potássio, Magnésio)",
      "Zinco",
      "Ureia",
      "Creatinina",
      "Vitamina D (25-hidroxivitamina D)",
      "Vitamina B12",
      "Folato",
      "SHBG (globulina ligadora de hormonas sexuais)",
      "NOTA: Solicitar densitometria óssea (DEXA) — via painel de Exames"
    ]
  },
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

    const groupsHtml = ANALISES_CATALOG.map(grp => {
      const isOpen   = !!state.selected[grp.id];
      const selCount = isOpen ? state.selected[grp.id].size : 0;

      const itemsHtml = isOpen
        ? grp.items.map((item, idx) => {
            const checked = state.selected[grp.id]?.has(idx);
            return `
              <label class="gcAnal-item ${checked ? "gcAnal-item--checked" : ""}">
                <input type="checkbox" data-gid="${grp.id}" data-idx="${idx}"
                  ${checked ? "checked" : ""}
                  style="width:14px;height:14px;accent-color:#1d9e75;flex-shrink:0;cursor:pointer;margin-top:1px;">
                <span>${item}</span>
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

      <div style="padding:8px 14px;border-bottom:1px solid #f1f5f9;">
        <div style="font-size:11px;color:#64748b;">Expanda um grupo · desselecione itens individuais se necessário</div>
      </div>

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

    const html = buildAnalisesHtml({ clinic, state, vinhetaUrl, logoUrl, signatureUrl });
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
export function buildAnalisesHtml({ clinic, state, vinhetaUrl, logoUrl, signatureUrl }) {
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
    items.forEach(item => todasAnalises.push({ tipo: "item", label: item }));
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
