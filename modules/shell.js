/* ========================================================
   SHELL.JS — Render HTML + CSS principal da aplicação
   --------------------------------------------------------
   03F — Render shell
      03F.1  renderAppShell()

   03G — Header shell
      03G.1  hydrateShellHeader()
   ======================================================== */

import { G } from "./state.js";
import { UI } from "./config.js";

/* ==== 03F — Render shell (HTML + CSS) ==== */

/* ---- 03F.1 — renderAppShell ---- */
export function renderAppShell() {
  const canSeeManagement = ["doctor", "superadmin"].includes(String(G.role || "").toLowerCase());
  const isManagementView = String(G.currentView || "agenda").toLowerCase() === "management";

  const mainHtml = isManagementView
    ? `
      <section class="gcCard">
        <div style="display:flex; align-items:flex-end; justify-content:space-between; gap:12px; flex-wrap:wrap;">
          <div>
            <div style="font-size:${UI.fs16}px; color:#111; font-weight:800;">Gestão</div>
            <div style="font-size:${UI.fs12}px; color:#666; margin-top:4px;">
              Área de gestão em preparação.
            </div>
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button id="btnBackToAgenda" class="gcBtn">Voltar à Agenda</button>
          </div>
        </div>

        <div style="margin-top:14px; display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px;">
          <div class="gcMutedCard">
            <div style="font-size:${UI.fs12}px; color:#666;">Produção</div>
            <div style="margin-top:6px; font-size:${UI.fs14}px; font-weight:800; color:#111;">Em construção</div>
          </div>
          <div class="gcMutedCard">
            <div style="font-size:${UI.fs12}px; color:#666;">Receita</div>
            <div style="margin-top:6px; font-size:${UI.fs14}px; font-weight:800; color:#111;">Em construção</div>
          </div>
          <div class="gcMutedCard">
            <div style="font-size:${UI.fs12}px; color:#666;">Preços</div>
            <div style="margin-top:6px; font-size:${UI.fs14}px; font-weight:800; color:#111;">Em construção</div>
          </div>
        </div>

        <div style="margin-top:14px; border-top:1px solid #f0f0f0; padding-top:12px;">
          <div style="font-size:${UI.fs12}px; color:#666;">
            Nesta fase vamos preparar a estrutura para:
            Produção clínica, Receita por ato e Tabela de preços.
          </div>
        </div>
      </section>
    `
    : `
      <section class="gcCard">
        <div style="display:flex; align-items:flex-end; justify-content:space-between; gap:12px; flex-wrap:wrap;">
          <div>
            <div style="font-size:${UI.fs16}px; color:#111; font-weight:800;">Agenda</div>
            <div style="font-size:${UI.fs12}px; color:#666; margin-top:4px;" id="agendaSubtitle">—</div>
          </div>
        </div>

        <div style="margin-top:12px;" class="gcToolbar">
          <div class="gcToolbarBlock" style="flex-direction:row; gap:10px; align-items:flex-end;">
            <button id="btnCal" class="gcBtn">Calendário</button>
            <button id="btnToday" class="gcBtn">Hoje</button>
            <button id="btnNewAppt" class="gcBtnPrimary">Agendar Consulta 📅</button>
            <button id="btnNewPatientMain" class="gcBtn">＋ Novo doente</button>
          </div>

          <div class="gcToolbarBlock gcSearchWrap">
            <div class="gcLabel">Pesquisa de doente (Nome / SNS / NIF / Telefone / Passaporte-ID)</div>
            <input
              id="pQuickQuery"
              type="search"
              placeholder="ex.: Man… | 916… | 123456789"
              autocomplete="off"
              spellcheck="false"
              style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; width:100%; font-size:${UI.fs13}px;"
            />
            <div id="pQuickResults" style="margin-top:8px; border:1px solid #eee; border-radius:10px; padding:8px; background:#fff; max-height:180px; overflow:auto;">
              <div style="font-size:${UI.fs12}px; color:#666;">Escreve para pesquisar.</div>
            </div>
          </div>

          <div class="gcToolbarBlock" style="min-width:240px;">
            <label for="selClinic" class="gcLabel">Clínica</label>
            <select id="selClinic" class="gcSelect" style="min-width:240px;"></select>
          </div>
        </div>

        <div style="margin-top:12px;" id="agendaStatus"></div>

        <div style="margin-top:10px; border-top:1px solid #f0f0f0; padding-top:10px;">
          <ul id="agendaList" style="list-style:none; padding:0; margin:0;"></ul>
        </div>
      </section>
    `;

  document.body.innerHTML = `
    <style>
      .gcBtn {
        padding:10px 12px;
        border-radius:10px;
        border:1px solid #ddd;
        background:#fff;
        cursor:pointer;
        font-size:${UI.fs13}px;
      }
      .gcBtn:disabled { opacity:0.6; cursor:not-allowed; }

      .gcBtnPrimary {
        padding:10px 13px;
        border-radius:11px;
        border:1px solid #475569;
        background:#475569;
        color:#fff;
        cursor:pointer;
        font-size:${UI.fs13}px;
        font-weight:700;
      }
      .gcBtnPrimary:hover { filter: brightness(0.96); }
      .gcBtnPrimary:disabled { opacity:0.6; cursor:not-allowed; }

      .gcSelect {
        padding:10px 12px;
        border-radius:10px;
        border:1px solid #ddd;
        background:#fff;
        font-size:${UI.fs13}px;
      }

      .gcLabel { font-size:${UI.fs12}px; color:#666; }

      .gcCard {
        padding:12px 14px;
        border:1px solid #eee;
        border-radius:12px;
        background:#fff;
      }

      .gcMutedCard {
        padding:10px 12px;
        border-radius:10px;
        border:1px solid #ddd;
        background:#fafafa;
      }

      .gcStatusSelect {
        appearance:none;
        border-radius:999px;
        border:1px solid transparent;
        padding:8px 36px 8px 12px;
        font-size:${UI.fs13}px;
        font-weight:900;
        cursor:pointer;
        background-image: linear-gradient(45deg, transparent 50%, currentColor 50%),
                          linear-gradient(135deg, currentColor 50%, transparent 50%);
        background-position: calc(100% - 18px) 55%, calc(100% - 12px) 55%;
        background-size: 6px 6px, 6px 6px;
        background-repeat:no-repeat;
      }

      .gcToolbar {
        display:flex;
        align-items:flex-end;
        gap:10px;
        flex-wrap:wrap;
      }

      .gcToolbarBlock {
        display:flex;
        flex-direction:column;
        gap:4px;
      }

      .gcSearchWrap {
        min-width: 360px;
        max-width: 520px;
        flex: 1 1 420px;
      }

      .gcHeaderActions {
        display:flex;
        align-items:center;
        gap:10px;
        flex-wrap:wrap;
      }

      @media (max-width: 980px) {
        .gcSearchWrap {
          flex: 1 1 100%;
          min-width: 280px;
        }
      }
    </style>

    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 16px; font-size:${UI.fs14}px;">
      <header style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding:12px 14px; border:1px solid #e5e5e5; border-radius:12px;">
        <div style="display:flex; flex-direction:column; gap:6px; min-width: 260px;">
          <div style="font-size:${UI.fs14}px; color:#111; font-weight:700;">Sessão ativa</div>
          <div style="font-size:${UI.fs12}px; color:#444;"><span style="color:#666;">Email:</span> <span id="hdrEmail">—</span></div>
          <div style="font-size:${UI.fs12}px; color:#444;"><span style="color:#666;">Role:</span> <span id="hdrRole">—</span></div>
          <div style="font-size:${UI.fs12}px; color:#444;"><span style="color:#666;">Clínicas:</span> <span id="hdrClinicCount">0</span></div>
        </div>

        <div class="gcHeaderActions">
          <button id="btnManagement" class="gcBtn">Gestão</button>
          <button id="btnLogout" class="gcBtn">Logout</button>
        </div>
      </header>

      <main style="margin-top:14px;">
        ${mainHtml}
      </main>

      <div id="modalRoot"></div>
    </div>
  `;

  // Expor globalmente para compatibilidade com app.js durante a migração
  window.__gc_renderAppShell = renderAppShell;
}


/* ==== 03G — Header shell ==== */

/* ---- 03G.1 — hydrateShellHeader ---- */
export function hydrateShellHeader() {
  const hdrEmail = document.getElementById("hdrEmail");
  if (hdrEmail) hdrEmail.textContent = G.sessionUser?.email || "—";

  const hdrRole = document.getElementById("hdrRole");
  if (hdrRole) hdrRole.textContent = G.role || "—";

  const hdrClinicCount = document.getElementById("hdrClinicCount");
  if (hdrClinicCount) hdrClinicCount.textContent = String(Array.isArray(G.clinics) ? G.clinics.length : 0);
}

// Expor globalmente para compatibilidade com app.js durante a migração
window.__gc_hydrateShellHeader = hydrateShellHeader;
