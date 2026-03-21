/* ========================================================
   STATE.JS — Constantes e estado global da aplicação
   --------------------------------------------------------
   03A — Constantes de procedimentos
      03A.1  PROCEDURE_OPTIONS
   03B — Constantes de estados/status
      03B.1  STATUS_OPTIONS
   03C — Constantes de duração
      03C.1  DURATION_OPTIONS
   03D — Metadata de estado
      03D.1  statusMeta(statusRaw)
   03E — Estado global
      03E.1  G  (objecto de estado partilhado)
   ======================================================== */
import { fmtDateISO } from "./helpers.js";

/* ==== 03A — Constantes de procedimentos ==== */

/* ---- 03A.1 — PROCEDURE_OPTIONS ---- */
export const PROCEDURE_OPTIONS = [
  "🆕 Primeira Consulta",
  "🔁 Consulta de Reavaliação",
  "🩸 Plasma Rico em Plaquetas",
  "💉 Viscossuplementação",
  "🎥 Teleconsulta",
  "📑 Revalidação de tratamentos",
  "🖋️ Relatórios",
  "📌Outro",
];

/* ==== 03B — Constantes de estados/status ==== */

/* ---- 03B.1 — STATUS_OPTIONS ---- */
/* "confirmed" removido — usado apenas internamente em bloqueios */
export const STATUS_OPTIONS = ["scheduled", "arrived", "done", "no_show", "honorarios_dispensados"];

/* ==== 03C — Constantes de duração ==== */

/* ---- 03C.1 — DURATION_OPTIONS ---- */
export const DURATION_OPTIONS = [15, 20, 30, 45, 60];

/* ==== 03D — Metadata de estado ==== */

/* ---- 03D.1 — statusMeta ---- */
export function statusMeta(statusRaw) {
  const s = String(statusRaw || "scheduled").toLowerCase();
  const map = {
    scheduled:              { icon: "👤", label: "Marcada",                  bg: "#eff6ff", fg: "#1d4ed8", br: "#bfdbfe" },
    arrived:                { icon: "⏳", label: "Chegou",                   bg: "#fffbeb", fg: "#92400e", br: "#fde68a" },
    done:                   { icon: "✅", label: "Realizada",                 bg: "#ecfdf5", fg: "#065f46", br: "#a7f3d0" },
    no_show:                { icon: "❌", label: "Faltou/Cancelada",          bg: "#fef2f2", fg: "#991b1b", br: "#fecaca" },
    confirmed:              { icon: "✅", label: "Realizada",                 bg: "#ecfdf5", fg: "#065f46", br: "#a7f3d0" },
    honorarios_dispensados: { icon: "🎁", label: "Dispensa de honorários",   bg: "#f3f4f6", fg: "#374151", br: "#d1d5db" },
  };
  return map[s] || map.scheduled;
}

/* ==== 03E — Estado global da app ==== */

/* ---- 03E.1 — G (estado partilhado entre módulos) ---- */
export const G = {
  sessionUser:    null,
  role:           null,
  clinics:        [],
  clinicsById:    {},
  agenda:         { rows: [], timeColUsed: "start_at" },
  selectedDayISO: fmtDateISO(new Date()),
  calMonth:       null,
  patientsById:   {},
  patientQuick:   { lastResults: [], selected: null },
  currentView:    "agenda",
};

// Expor globalmente para compatibilidade com código legado (app.js)
window.G = G;
