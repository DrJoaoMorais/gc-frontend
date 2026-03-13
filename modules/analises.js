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
    id: "geral",
    label: "Análises Gerais",
    icon: "🔬",
    items: [
      "Hemograma completo",
      "Velocidade de sedimentação",
      "Proteína C reativa",
      "Glicose em jejum",
      "Hemoglobina glicada",
      "Ureia",
      "Creatinina",
      "Ionograma (Sódio, Potássio, Cloro)",
      "Aspartato aminotransferase",
      "Alanina aminotransferase",
      "Fosfatase alcalina",
      "Gama-glutamiltransferase",
      "Bilirrubina total",
      "Colesterol total",
      "Colesterol LDL",
      "Colesterol HDL",
      "Triglicerídeos",
      "Ferritina",
      "Vitamina D (25-hidroxivitamina D)",
      "Hormona tiroestimulante",
      "Ácido úrico",
      "Exame sumário de urina"
    ]
  },
  {
    id: "endocrinologia",
    label: "Endocrinologia",
    icon: "⚗️",
    items: [
      "Hormona tiroestimulante",
      "Triiodotironina total",
      "Tiroxina total",
      "Tiroxina livre",
      "Calcitonina",
      "Hormona paratiroideia"
    ]
  },
  {
    id: "hematologia",
    label: "Hematologia / Coagulação",
    icon: "🩸",
    items: [
      "Hemograma completo",
      "Tempo de protrombina — INR",
      "Tempo de tromboplastina parcial ativado",
      "Fibrinogénio",
      "Dímeros-D",
      "Grupo sanguíneo (ABO)",
      "Tipagem ABO e Rh (D)",
      "Velocidade de sedimentação"
    ]
  },
  {
    id: "quimica",
    label: "Química Clínica",
    icon: "🧪",
    items: [
      "Glicose em jejum",
      "Aspartato aminotransferase",
      "Alanina aminotransferase",
      "Fosfatase alcalina",
      "Gama-glutamiltransferase",
      "Bilirrubina total e frações",
      "Ionograma (Sódio, Potássio, Cloro)",
      "Desidrogenase láctica",
      "Magnésio",
      "Potássio",
      "Sódio",
      "Ureia",
      "Creatinina",
      "Ácido úrico",
      "Ferritina",
      "Proteínas totais",
      "Proteinograma — eletroforese de proteínas",
      "Mioglobina",
      "Creatinacinase",
      "Hemoglobina glicada",
      "Insulina em jejum"
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
      "Lipoproteína (a)",
      "Homocisteína"
    ]
  },
  {
    id: "reumatologia",
    label: "Reumatologia / Autoimunidade",
    icon: "🦴",
    items: [
      "Anticorpos antinucleares",
      "Anticorpos anti-DNA de cadeia dupla",
      "Anticorpos anti-Sm",
      "Anticorpos anti-RNP",
      "Anticorpos anti-SSA / Ro",
      "Anticorpos anti-SSB / La",
      "Fator reumatoide",
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
      "VIH — Antigénio p24",
      "VIH — Antigénio p24 + Anticorpos VIH-1/2",
      "Hepatite A — Anticorpos IgM",
      "Hepatite A — Anticorpos totais",
      "Hepatite B — Antigénio HBs",
      "Hepatite B — Anticorpos anti-HBc",
      "Hepatite C — Anticorpos anti-VHC",
      "Hepatite C — Pesquisa de RNA",
      "VDRL",
      "TPHA — Anticorpos anti-Treponema pallidum",
      "Paul-Bunnell / Monospot",
      "Proteína C reativa",
      "Proteína C reativa ultra-sensível"
    ]
  },
  {
    id: "urina",
    label: "Urina",
    icon: "💧",
    items: [
      "Exame sumário de urina",
      "Proteína de Bence-Jones — urina de 24 horas",
      "Hidroxiprolina total — urina de 24 horas",
      "Microalbuminúria"
    ]
  },
  {
    id: "longevidade",
    label: "Longevidade",
    icon: "⏳",
    items: [
      "Hemograma completo",
      "Ferritina",
      "Ureia",
      "Creatinina",
      "Cistatina-C",
      "Glicose em jejum",
      "Insulina em jejum",
      "Hemoglobina glicada",
      "Aspartato aminotransferase",
      "Alanina aminotransferase",
      "Fosfatase alcalina",
      "Gama-glutamiltransferase",
      "Bilirrubina total e frações",
      "Creatinacinase",
      "Colesterol total e frações",
      "Triglicerídeos",
      "Apolipoproteína B",
      "Homocisteína",
      "Ácido úrico",
      "Proteína C reativa ultra-sensível",
      "Hormona tiroestimulante",
      "Tiroxina livre",
      "Vitamina D (25-hidroxivitamina D)",
      "Antigénio específico da próstata — total e livre",
      "Microalbuminúria",
      "Exame sumário de urina"
    ]
  },
  {
    id: "desportivo_inicio",
    label: "Medicina Desportiva — Início de Época",
    icon: "🏃",
    items: [
      "Hemograma completo",
      "Ferritina",
      "Ferro sérico",
      "Transferrina",
      "Vitamina D (25-hidroxivitamina D)",
      "Vitamina B12",
      "Folato",
      "Glicose em jejum",
      "Hemoglobina glicada",
      "Ionograma (Sódio, Potássio, Magnésio)",
      "Creatinacinase",
      "Desidrogenase láctica",
      "Proteína C reativa ultra-sensível",
      "Hormona tiroestimulante",
      "Tiroxina livre",
      "Testosterona total",
      "Cortisol basal",
      "DHEA-S (dehidroepiandrosterona sulfato)",
      "Ureia",
      "Creatinina",
      "Colesterol total",
      "Colesterol LDL",
      "Colesterol HDL",
      "Triglicerídeos",
      "Ácido úrico",
      "Aspartato aminotransferase",
      "Alanina aminotransferase"
    ]
  },
  {
    id: "desportivo_overtraining",
    label: "Medicina Desportiva — Overtraining",
    icon: "⚠️",
    items: [
      "Hemograma com fórmula leucocitária",
      "Ferritina",
      "Creatinacinase",
      "Desidrogenase láctica",
      "Mioglobina",
      "Proteína C reativa ultra-sensível",
      "Velocidade de sedimentação",
      "Cortisol basal (manhã)",
      "Testosterona total",
      "Rácio testosterona / cortisol",
      "DHEA-S (dehidroepiandrosterona sulfato)",
      "Hormona tiroestimulante",
      "Triiodotironina total",
      "Tiroxina livre",
      "Glicose em jejum",
      "Insulina em jejum",
      "Ionograma (Sódio, Potássio, Magnésio)",
      "Ureia",
      "Creatinina",
      "Vitamina D (25-hidroxivitamina D)",
      "Vitamina B12"
    ]
  }
];

/* ====================================================================
   FUNÇÃO 12H.2 — openAnalisesModal
   ==================================================================== */

/**
 * openAnalisesModal
 * Abre o modal de pedido de análises laboratoriais.
 * @param {{ patientId: string, consultationId: string|null }} opts
 */
export function openAnalisesModal({ patientId, consultationId }) {
  const state = {
    selected:     {},
    clinicalInfo: ""
  };

  function toggleGroup(gid) {
    if (state.selected[gid]) {
      delete state.selected[gid];
    } else {
      const grp = ANALISES_CATALOG.find(g => g.id === gid);
      state.selected[gid] = new Set(grp.items.map((_, i) => i));
    }
    renderModal();
  }

  function toggleItem(gid, idx) {
    if (!state.selected[gid]) return;
    if (state.selected[gid].has(idx)) {
      state.selected[gid].delete(idx);
      if (state.selected[gid].size === 0) delete state.selected[gid];
    } else {
      state.selected[gid].add(idx);
    }
    renderModal();
  }

  function totalSelected() {
    return Object.values(state.selected).reduce((acc, s) => acc + s.size, 0);
  }

  function buildModalHtml() {
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
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="font-size:18px;line-height:1">${grp.icon}</span>
              <span class="gcAnal-group-label">${grp.label}</span>
              ${isOpen ? `<span class="gcAnal-badge">${selCount} selecionadas</span>` : ""}
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              ${isOpen ? `<button class="gcAnal-deselect-all" data-gid="${grp.id}">Desselecionar todas</button>` : ""}
              <span class="gcAnal-chevron">${isOpen ? "▲" : "▼"}</span>
            </div>
          </div>
          ${isOpen ? `<div class="gcAnal-items">${itemsHtml}</div>` : ""}
        </div>`;
    }).join("");

    return `
      <div id="gcAnalisesModal" style="
        position:fixed;inset:0;z-index:9999;
        background:rgba(0,0,0,0.45);
        display:flex;align-items:center;justify-content:center;
        padding:16px;">
        <div style="
          background:#fff;border-radius:14px;
          width:100%;max-width:640px;
          max-height:90vh;display:flex;flex-direction:column;
          box-shadow:0 20px 60px rgba(0,0,0,0.25);
          overflow:hidden;">

          <div style="
            padding:18px 22px 14px;
            border-bottom:1px solid #e2e8f0;
            display:flex;align-items:center;justify-content:space-between;
            flex-shrink:0;">
            <div>
              <div style="font-size:17px;font-weight:700;color:#0f172a;">Pedido de Análises</div>
              <div style="font-size:12px;color:#64748b;margin-top:2px;">
                Selecione grupos · desselecione análises individuais se necessário
              </div>
            </div>
            <button id="gcAnalisesClose"
              style="background:none;border:none;font-size:20px;cursor:pointer;
                     color:#94a3b8;padding:4px 8px;border-radius:6px;line-height:1;">✕</button>
          </div>

          <div id="gcAnalisesBody" style="overflow-y:auto;padding:16px 20px;flex:1;">
            <style>
              .gcAnal-group{border:1px solid #e2e8f0;border-radius:10px;margin-bottom:8px;overflow:hidden;}
              .gcAnal-group--open{border-color:#1d9e75;}
              .gcAnal-group-header{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;cursor:pointer;background:#f8fafc;user-select:none;}
              .gcAnal-group--open .gcAnal-group-header{background:#e8f8f3;}
              .gcAnal-group-header:hover{background:#f1f5f9;}
              .gcAnal-group--open .gcAnal-group-header:hover{background:#d4f1e7;}
              .gcAnal-group-label{font-size:14px;font-weight:600;color:#0f172a;}
              .gcAnal-badge{font-size:11px;font-weight:600;background:#1d9e75;color:#fff;padding:2px 8px;border-radius:100px;}
              .gcAnal-chevron{font-size:11px;color:#94a3b8;}
              .gcAnal-deselect-all{font-size:11px;color:#64748b;background:none;border:1px solid #cbd5e1;border-radius:6px;padding:3px 8px;cursor:pointer;font-family:inherit;}
              .gcAnal-deselect-all:hover{background:#f1f5f9;}
              .gcAnal-items{display:grid;grid-template-columns:1fr 1fr;gap:3px;padding:10px 14px 12px;border-top:1px solid #e2e8f0;background:#fff;}
              .gcAnal-item{display:flex;align-items:flex-start;gap:7px;font-size:12.5px;color:#374151;padding:5px 8px;border-radius:6px;cursor:pointer;border:1px solid transparent;line-height:1.35;}
              .gcAnal-item:hover{background:#f8fafc;border-color:#e2e8f0;}
              .gcAnal-item--checked{color:#0f172a;}
            </style>
            ${groupsHtml}
          </div>

          <div style="padding:12px 20px;border-top:1px solid #e2e8f0;flex-shrink:0;">
            <div style="font-size:12px;font-weight:600;color:#374151;margin-bottom:6px;">Informação clínica</div>
            <textarea id="gcAnalisesCliInfo"
              placeholder="Ex: Suspeita espondiloartrite, dor lombar crónica…"
              style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 12px;
                     font-size:13px;resize:vertical;min-height:60px;font-family:inherit;
                     color:#0f172a;outline:none;"
            >${state.clinicalInfo}</textarea>
          </div>

          <div style="
            padding:12px 20px 16px;border-top:1px solid #e2e8f0;
            display:flex;align-items:center;justify-content:space-between;
            flex-shrink:0;background:#f8fafc;">
            <div style="font-size:13px;color:#64748b;">
              ${hasSelected
                ? `<span style="color:#1d9e75;font-weight:600;">${totalSelected()} análise${totalSelected()!==1?"s":""} selecionada${totalSelected()!==1?"s":""}</span>`
                : `<span>Nenhum grupo selecionado</span>`}
            </div>
            <button id="gcAnalisesGenPdf"
              ${hasSelected ? "" : "disabled"}
              style="padding:9px 22px;border:none;border-radius:8px;
                     background:${hasSelected?"#1d9e75":"#cbd5e1"};
                     color:${hasSelected?"#fff":"#94a3b8"};
                     font-size:13px;font-weight:700;
                     cursor:${hasSelected?"pointer":"not-allowed"};
                     font-family:inherit;">
              Gerar PDF
            </button>
          </div>
        </div>
      </div>`;
  }

  function renderModal() {
    document.getElementById("gcAnalisesModal")?.remove();
    document.body.insertAdjacentHTML("beforeend", buildModalHtml());
    bindModalEvents();
  }

  function bindModalEvents() {
    document.getElementById("gcAnalisesClose")?.addEventListener("click", () => {
      document.getElementById("gcAnalisesModal")?.remove();
    });

    document.getElementById("gcAnalisesModal")?.addEventListener("click", e => {
      if (e.target.id === "gcAnalisesModal") document.getElementById("gcAnalisesModal")?.remove();
    });

    document.querySelectorAll(".gcAnal-group-header").forEach(el => {
      el.addEventListener("click", e => {
        if (e.target.classList.contains("gcAnal-deselect-all")) return;
        state.clinicalInfo = document.getElementById("gcAnalisesCliInfo")?.value || state.clinicalInfo;
        toggleGroup(el.dataset.gid);
      });
    });

    document.querySelectorAll(".gcAnal-deselect-all").forEach(btn => {
      btn.addEventListener("click", e => {
        e.stopPropagation();
        state.clinicalInfo = document.getElementById("gcAnalisesCliInfo")?.value || state.clinicalInfo;
        delete state.selected[btn.dataset.gid];
        renderModal();
      });
    });

    document.querySelectorAll(".gcAnal-item input[type=checkbox]").forEach(cb => {
      cb.addEventListener("change", e => {
        e.stopPropagation();
        state.clinicalInfo = document.getElementById("gcAnalisesCliInfo")?.value || state.clinicalInfo;
        toggleItem(cb.dataset.gid, parseInt(cb.dataset.idx));
      });
    });

    document.getElementById("gcAnalisesCliInfo")?.addEventListener("input", e => {
      state.clinicalInfo = e.target.value;
    });

    document.getElementById("gcAnalisesGenPdf")?.addEventListener("click", async () => {
      if (totalSelected() === 0) return;
      state.clinicalInfo = document.getElementById("gcAnalisesCliInfo")?.value || "";
      await gerarAnalisePdf(state);
    });
  }

  renderModal();
}

/* ====================================================================
   FUNÇÃO 12H.3 — gerarAnalisePdf
   ==================================================================== */

/**
 * gerarAnalisePdf
 * Recolhe assets (vinheta, logo, assinatura), constrói HTML e abre o editor.
 */
export async function gerarAnalisePdf(state) {
  const btn = document.getElementById("gcAnalisesGenPdf");
  if (btn) { btn.textContent = "A gerar…"; btn.disabled = true; }

  try {
    const fetchClinic  = window.__gc_fetchClinicForPdf || window.fetchClinicForPdf;
    const signedUrl    = window.__gc_storageSignedUrl;
    const toDataUrl    = window.__gc_urlToDataUrl;
    const bucket       = window.__gc_VINHETA_BUCKET;
    const vinhetaPath  = window.__gc_VINHETA_PATH;
    const sigPath      = window.__gc_SIGNATURE_PATH;

    const clinic = await fetchClinic();

    const [vinhetaUrl, logoUrl, signatureUrl] = await Promise.all([
      (async () => { try { const u = await signedUrl(bucket, vinhetaPath, 3600); return u ? await toDataUrl(u, "image/png") : ""; } catch { return ""; } })(),
      (async () => { try { const lp = clinic?.logo_url; if (!lp) return ""; const u = await signedUrl(bucket, lp, 3600); return u ? await toDataUrl(u, "image/png") : ""; } catch { return ""; } })(),
      (async () => { try { const u = await signedUrl(bucket, sigPath, 3600); return u ? await toDataUrl(u, "image/png") : ""; } catch { return ""; } })()
    ]);

    const html = buildAnalisesHtml({ clinic, state, vinhetaUrl, logoUrl, signatureUrl });
    window.openDocumentEditor(html, "Pedido de Análises");
    document.getElementById("gcAnalisesModal")?.remove();

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
  .sig{margin-top:60px;display:flex;justify-content:flex-end;}
  .sigBox{width:360px;text-align:center;}
  .sigImgWrap{height:80px;display:flex;align-items:flex-end;justify-content:center;margin-bottom:-1px;}
  .sigImg{max-height:80px;max-width:280px;object-fit:contain;display:block;}
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
            ${signatureUrl ? `<div class="sigImgWrap"><img class="sigImg" src="${escUrl(signatureUrl)}"/></div>` : ""}
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
