/**
 * pesquisa.js — Passo 7
 * BLOCO 08: Pesquisa rápida (wiring) + Calendário mensal overlay
 * Extraído de app.js blocos 08A, 08B, 08C
 *
 * Imports necessários de outros módulos:
 *   config.js  → G, UI
 *   helpers.js → fmtDateISO, parseISODateToLocalStart, escapeHtml
 *   agenda.js  → setAgendaSubtitleForSelectedDay, refreshAgenda
 *   db.js      → searchPatientsScoped
 *   doente.js  → renderQuickPatientResults  (função já exportada em doente.js)
 */

import { UI } from "./config.js";
import { G } from "./state.js";
import {
  fmtDateISO,
  parseISODateToLocalStart,
  escapeHtml
} from "./helpers.js";
import { setAgendaSubtitleForSelectedDay, refreshAgenda } from "./agenda.js";
import { searchPatientsScoped } from "./db.js";
import { renderQuickPatientResults } from "./agenda.js";

/* ====================================================================
   BLOCO 08A — Wiring da pesquisa rápida
   ==================================================================== */

/**
 * wireQuickPatientSearch
 * Liga o input #pQuickQuery à pesquisa de doentes com debounce de 250 ms.
 */
export async function wireQuickPatientSearch() {
  const input    = document.getElementById("pQuickQuery");
  const resHost  = document.getElementById("pQuickResults");
  if (!input || !resHost) return;

  resHost.innerHTML    = "";
  resHost.style.display = "none";

  let timer = null;

  async function run() {
    const term = (input.value || "").trim();

    if (!term || term.length < 2) {
      resHost.innerHTML    = "";
      resHost.style.display = "none";
      return;
    }

    const selClinic = document.getElementById("selClinic");
    const clinicId  = selClinic && selClinic.value ? selClinic.value : null;

    resHost.style.display = "block";
    resHost.innerHTML     = `<div style="font-size:${UI.fs12}px; color:#666;">A pesquisar…</div>`;

    try {
      const pts = await searchPatientsScoped({ clinicId, q: term, limit: 30 });
      G.patientQuick.lastResults = pts;

      renderQuickPatientResults(pts);

      if (!pts || pts.length === 0) {
        resHost.style.display = "block";
        resHost.innerHTML     = `<div style="font-size:${UI.fs12}px; color:#666;">Sem resultados.</div>`;
      }
    } catch (e) {
      console.error("Pesquisa rápida de doente falhou:", e);
      resHost.style.display = "block";
      resHost.innerHTML     = `<div style="font-size:${UI.fs12}px; color:#b00020;">Erro na pesquisa. Vê a consola.</div>`;
    }
  }

  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(run, 250);
  }

  input.addEventListener("input", schedule);
}

/* ====================================================================
   BLOCO 08B — Helpers do calendário mensal
   ==================================================================== */

/** monthLabel — devolve "Janeiro 2026" para uma Data */
function monthLabel(d) {
  const months = [
    "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
    "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
  ];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

/** buildMonthGrid — devolve array de 42 células (Date | null) para o mês */
function buildMonthGrid(monthDate) {
  const y = monthDate.getFullYear();
  const m = monthDate.getMonth();

  const first       = new Date(y, m, 1, 0, 0, 0, 0);
  const last        = new Date(y, m + 1, 0, 0, 0, 0, 0);
  const daysInMonth = last.getDate();

  const jsDowFirst  = first.getDay();
  const dowFirstMon0 = (jsDowFirst + 6) % 7;   // Seg = 0

  const cells = [];
  for (let i = 0; i < dowFirstMon0; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, m, d, 0, 0, 0, 0));
  while (cells.length % 7 !== 0) cells.push(null);
  while (cells.length < 42)      cells.push(null);

  return cells;
}

/* ====================================================================
   BLOCO 08C — Interface do calendário mensal (overlay)
   ==================================================================== */

/**
 * openCalendarOverlay
 * Abre o overlay do calendário mensal em #modalRoot.
 */
export function openCalendarOverlay() {
  const root = document.getElementById("modalRoot");
  if (!root) return;

  const todayISO    = fmtDateISO(new Date());
  const selectedISO = G.selectedDayISO;

  if (!G.calMonth) {
    const selD  = parseISODateToLocalStart(selectedISO) || new Date();
    G.calMonth  = new Date(selD.getFullYear(), selD.getMonth(), 1, 0, 0, 0, 0);
  }

  const cells    = buildMonthGrid(G.calMonth);
  const weekDays = ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];

  root.innerHTML = `
    <div id="calOverlay" style="position:fixed; inset:0; background:rgba(0,0,0,0.35); display:flex; align-items:center; justify-content:center; padding:18px;">
      <div style="background:#fff; width:min(520px, 100%); border-radius:14px; border:1px solid #e5e5e5; padding:14px;">
        <div style="display:flex; justify-content:space-between; gap:10px; align-items:center;">
          <button id="calPrev" class="gcBtn">◀</button>
          <div style="font-size:${UI.fs14}px; font-weight:800; color:#111;" id="calTitle">${escapeHtml(monthLabel(G.calMonth))}</div>
          <button id="calNext" class="gcBtn">▶</button>
        </div>

        <div style="margin-top:10px; display:grid; grid-template-columns: repeat(7, 1fr); gap:6px;">
          ${weekDays.map(w => `<div style="font-size:${UI.fs12}px; color:#666; text-align:center; padding:6px 0;">${w}</div>`).join("")}
          ${cells.map(d => {
            if (!d) return `<div></div>`;
            const iso        = fmtDateISO(d);
            const isToday    = iso === todayISO;
            const isSelected = iso === selectedISO;
            const base = "padding:10px 0; border-radius:10px; border:1px solid #eee; text-align:center; cursor:pointer; user-select:none;";
            const bg   = isSelected
              ? "background:#111; color:#fff; border-color:#111;"
              : isToday
                ? "background:#f2f2f2; color:#111;"
                : "background:#fff; color:#111;";
            return `<div data-iso="${iso}" style="${base}${bg} font-size:${UI.fs13}px;">${d.getDate()}</div>`;
          }).join("")}
        </div>

        <div style="margin-top:12px; display:flex; justify-content:space-between; gap:10px; align-items:center; flex-wrap:wrap;">
          <div style="font-size:${UI.fs12}px; color:#666;">Clique num dia para abrir a agenda desse dia.</div>
          <button id="calClose" class="gcBtn">Fechar</button>
        </div>
      </div>
    </div>
  `;

  const overlay = document.getElementById("calOverlay");
  const calClose = document.getElementById("calClose");
  const calPrev  = document.getElementById("calPrev");
  const calNext  = document.getElementById("calNext");

  function close() { root.innerHTML = ""; }

  if (calClose) calClose.addEventListener("click", close);
  if (overlay)  overlay.addEventListener("click", ev => { if (ev.target?.id === "calOverlay") close(); });

  if (calPrev) calPrev.addEventListener("click", () => {
    G.calMonth = new Date(G.calMonth.getFullYear(), G.calMonth.getMonth() - 1, 1, 0, 0, 0, 0);
    openCalendarOverlay();
  });

  if (calNext) calNext.addEventListener("click", () => {
    G.calMonth = new Date(G.calMonth.getFullYear(), G.calMonth.getMonth() + 1, 1, 0, 0, 0, 0);
    openCalendarOverlay();
  });

  root.querySelectorAll("[data-iso]").forEach(el => {
    el.addEventListener("click", async () => {
      const iso = el.getAttribute("data-iso");
      if (!iso) return;
      G.selectedDayISO = iso;

      const d = parseISODateToLocalStart(iso);
      if (d) G.calMonth = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);

      close();
      setAgendaSubtitleForSelectedDay();
      await refreshAgenda();
    });
  });
}


/* Expor via window */
window.__gc_wireQuickPatientSearch = wireQuickPatientSearch;
window.__gc_openCalendarOverlay = openCalendarOverlay;
