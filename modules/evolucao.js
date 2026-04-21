/**
 * evolucao.js
 * Painel lateral — Evolução / Histórico de Avaliações Funcionais
 *
 * Exporta:
 *   evolucaoUiState          — { isOpen: boolean }
 *   openEvolucaoPanel(opts)  — abre o painel
 *   closeEvolucaoPanel(cb)   — fecha o painel
 */

/* ====================================================================
   ESTADO
   ==================================================================== */

export const evolucaoUiState = { isOpen: false };

/* ====================================================================
   FECHAR
   ==================================================================== */

export function closeEvolucaoPanel(onClose) {
  evolucaoUiState.isOpen = false;
  document.getElementById("gcEvolucaoPanel")?.remove();
  document.getElementById("gcEvolucaoModal")?.remove();
  if (typeof onClose === "function") onClose();
}

/* ====================================================================
   ABRIR
   ==================================================================== */

export function openEvolucaoPanel({ patientId, consultationId, onClose } = {}) {
  evolucaoUiState.isOpen = true;

  const state = {
    rows:      [],
    loading:   true,
    error:     null,
    activeTab: null,
  };

  /* ---- getHost: idêntico ao analises.js ---- */
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

  /* ---- helpers ---- */
  function escHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function trunc(str, n) {
    if (!str) return "—";
    return str.length > n ? str.slice(0, n) + "…" : str;
  }

  function fmtDate(d) {
    if (!d) return "—";
    return String(d).split("T")[0].split("-").reverse().join("/");
  }

  function typeLabel(t) {
    const labels = {
      ombro:    "Ombro",          cotovelo: "Cotovelo",
      punho:    "Punho / Mão",    anca:     "Anca",
      joelho:   "Joelho",         tibio:    "Tibiotársica / Pé",
      cervical: "Coluna Cervical", lombar:  "Coluna Lombar",
      atleta:   "Atleta",         pfp:      "Paresia Facial",
      incont:   "Pavimento Pélvico",
    };
    return labels[t] || (t ? t.charAt(0).toUpperCase() + t.slice(1) : "Outro");
  }

  function groupByType(rows) {
    const map = {};
    for (const row of rows) {
      const t = row.assessment_type || "outro";
      if (!map[t]) map[t] = [];
      map[t].push(row);
    }
    return map;
  }

  /* ---- buildPanelBodyHtml ---- */
  function buildPanelBodyHtml() {
    if (state.loading) {
      return `<div style="flex:1;display:flex;align-items:center;justify-content:center;
                color:#64748b;font-size:14px;">A carregar…</div>`;
    }

    if (state.error) {
      return `<div style="flex:1;display:flex;align-items:center;justify-content:center;
                color:#dc2626;font-size:13px;padding:20px;text-align:center;">
                Erro ao carregar avaliações.<br><small>${escHtml(state.error)}</small>
              </div>`;
    }

    if (!state.rows.length) {
      return `<div style="flex:1;display:flex;align-items:center;justify-content:center;
                color:#64748b;font-size:14px;padding:24px;text-align:center;">
                Sem avaliações funcionais registadas.
              </div>`;
    }

    const grouped = groupByType(state.rows);
    const types   = Object.keys(grouped);
    if (!state.activeTab || !grouped[state.activeTab]) state.activeTab = types[0];

    const tabsHtml = types.map(t => {
      const active = t === state.activeTab;
      return `<button class="gcEvol-tab${active ? " gcEvol-tab--active" : ""}" data-tab="${t}">
        ${escHtml(typeLabel(t))}
        <span class="gcEvol-tab-count">${grouped[t].length}</span>
      </button>`;
    }).join("");

    const rowsHtml = (grouped[state.activeTab] || []).map(row => `
      <tr>
        <td class="gcEvol-td" style="white-space:nowrap;color:#475569;font-size:12px;">${fmtDate(row.assessment_date)}</td>
        <td class="gcEvol-td" style="font-size:12px;color:#0f172a;line-height:1.4;">${escHtml(trunc(row.data?.resumo, 120))}</td>
        <td class="gcEvol-td" style="white-space:nowrap;">
          <button class="gcEvol-ver" data-id="${row.id}"
            style="font-size:11px;font-weight:700;padding:3px 10px;
                   border:1px solid #1a56db;border-radius:6px;
                   color:#1a56db;background:#fff;cursor:pointer;font-family:inherit;">
            Ver
          </button>
        </td>
      </tr>`).join("");

    return `
      <div style="padding:0 14px 8px;border-bottom:1px solid #e5e7eb;overflow-x:auto;flex-shrink:0;">
        <div style="display:flex;gap:6px;min-width:max-content;padding-top:10px;">
          ${tabsHtml}
        </div>
      </div>
      <div id="gcEvolucaoBody" style="flex:1;overflow-y:auto;padding:12px 14px;">
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              <th class="gcEvol-th">Data</th>
              <th class="gcEvol-th">Resumo</th>
              <th class="gcEvol-th"></th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>`;
  }

  /* ---- renderPanel ---- */
  function renderPanel() {
    let panel = document.getElementById("gcEvolucaoPanel");
    if (!panel) {
      const host = getHost();
      if (!host) { console.error("gcEvolucaoPanel: host não encontrado"); return; }
      host.style.position = "relative";

      panel    = document.createElement("div");
      panel.id = "gcEvolucaoPanel";
      Object.assign(panel.style, {
        position:                "absolute",
        top:                     "0",
        right:                   "0",
        width:                   "520px",
        height:                  "100%",
        background:              "#ffffff",
        borderLeft:              "1px solid #e5e7eb",
        boxShadow:               "-8px 0 24px rgba(0,0,0,0.08)",
        zIndex:                  "50",
        display:                 "flex",
        flexDirection:           "column",
        borderTopRightRadius:    "14px",
        borderBottomRightRadius: "14px",
        fontFamily:              "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif",
      });
      host.appendChild(panel);
    }

    panel.innerHTML = `
      <style>
        .gcEvol-tab {
          padding:6px 12px;border:1px solid #e2e8f0;border-radius:8px;
          background:#f8fafc;color:#475569;font-size:12px;font-weight:600;
          cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:5px;
          white-space:nowrap;
        }
        .gcEvol-tab:hover { background:#f1f5f9; }
        .gcEvol-tab--active { background:#0f2d52;color:#fff;border-color:#0f2d52; }
        .gcEvol-tab-count {
          font-size:10px;font-weight:800;padding:1px 5px;border-radius:100px;
        }
        .gcEvol-tab--active .gcEvol-tab-count { background:rgba(255,255,255,0.25); }
        .gcEvol-tab:not(.gcEvol-tab--active) .gcEvol-tab-count { background:#e2e8f0;color:#64748b; }
        .gcEvol-th {
          text-align:left;font-size:11px;font-weight:700;color:#64748b;
          text-transform:uppercase;letter-spacing:.05em;
          padding:0 10px 8px;border-bottom:2px solid #e2e8f0;
        }
        .gcEvol-td { padding:9px 10px;vertical-align:top;border-bottom:1px solid #f1f5f9; }
      </style>

      <div style="padding:12px 16px;border-bottom:1px solid #0a2240;
                  display:flex;align-items:center;justify-content:space-between;
                  background:#0f2d52;border-radius:14px 14px 0 0;flex-shrink:0;">
        <div style="font-weight:800;font-size:15px;color:#fff;">Evolução Funcional</div>
        <button id="gcEvolucaoClose" style="
          background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.25);
          color:#fff;font-weight:700;font-size:12px;padding:5px 12px;
          border-radius:7px;cursor:pointer;font-family:inherit;">
          Fechar
        </button>
      </div>

      <div style="display:flex;flex-direction:column;flex:1;min-height:0;">
        ${buildPanelBodyHtml()}
      </div>`;

    bindPanelEvents();
  }

  /* ---- bindPanelEvents ---- */
  function bindPanelEvents() {
    document.getElementById("gcEvolucaoClose")?.addEventListener("click", () => {
      closeEvolucaoPanel(onClose);
    });

    document.querySelectorAll(".gcEvol-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        state.activeTab = btn.dataset.tab;
        renderPanel();
      });
    });

    document.querySelectorAll(".gcEvol-ver").forEach(btn => {
      btn.addEventListener("click", () => {
        const row = state.rows.find(r => String(r.id) === String(btn.dataset.id));
        if (row) openResumoModal(row);
      });
    });
  }

  /* ---- openResumoModal ---- */
  function openResumoModal(row) {
    document.getElementById("gcEvolucaoModal")?.remove();

    const overlay = document.createElement("div");
    overlay.id    = "gcEvolucaoModal";
    Object.assign(overlay.style, {
      position:       "fixed",
      inset:          "0",
      background:     "rgba(15,45,82,0.45)",
      zIndex:         "9000",
      display:        "flex",
      alignItems:     "center",
      justifyContent: "center",
      padding:        "24px",
    });

    overlay.innerHTML = `
      <div style="background:#fff;border-radius:14px;max-width:600px;width:100%;
                  box-shadow:0 20px 60px rgba(0,0,0,0.2);
                  display:flex;flex-direction:column;max-height:80vh;
                  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
        <div style="padding:14px 18px;border-bottom:1px solid #e5e7eb;
                    display:flex;align-items:center;justify-content:space-between;">
          <div>
            <div style="font-weight:800;font-size:15px;color:#0f2d52;">
              ${escHtml(typeLabel(row.assessment_type))}
            </div>
            <div style="font-size:12px;color:#64748b;margin-top:2px;">${fmtDate(row.assessment_date)}</div>
          </div>
          <button id="gcEvolucaoModalClose" style="
            background:#f1f5f9;border:1px solid #e2e8f0;color:#475569;
            font-weight:700;font-size:12px;padding:5px 12px;
            border-radius:7px;cursor:pointer;font-family:inherit;">
            Fechar
          </button>
        </div>
        <div style="padding:16px 18px;overflow-y:auto;flex:1;">
          <pre style="white-space:pre-wrap;word-break:break-word;margin:0;
                      font-family:inherit;font-size:13px;line-height:1.6;color:#0f172a;">
${escHtml(row.data?.resumo || "(sem conteúdo)")}</pre>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    document.getElementById("gcEvolucaoModalClose")?.addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
  }

  /* ---- fetch & boot ---- */
  async function fetchData() {
    try {
      const { data, error } = await window.sb
        .from("consultation_assessments")
        .select("id, assessment_type, assessment_date, data, consultation_id, author_user_id")
        .eq("patient_id", patientId)
        .order("assessment_date", { ascending: false });

      if (error) throw error;
      state.rows = data || [];
    } catch (e) {
      state.error = e.message || "Erro desconhecido";
    } finally {
      state.loading = false;
      renderPanel();
    }
  }

  renderPanel();  // mostra loading imediatamente
  fetchData();
}
