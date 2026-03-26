/* ========================================================
   AGENDA.JS — Agenda, Marcações, Calendário e Google Calendar
   --------------------------------------------------------
   04A — Helpers UI da agenda
      04A.1  setAgendaSubtitleForSelectedDay()
      04A.2  setAgendaStatus(kind, text)
      04A.3  renderClinicsSelect(clinics)
      04A.4  getPatientForAppointmentRow(apptRow)
      04A.5  apptStatusMeta(apptRow)

   04B — Abertura de doente
      04B.1  openPatientFeedFromAny(patientLike)

   04C — Atualização de estado de marcação
      04C.1  updateAppointmentStatus(apptId, newStatus)

   04D — Impressão da agenda do dia
      04D.1  __gcGetSelectedDayLabelForPrint()
      04D.2  __gcBuildAgendaPrintHtml(rows)
      04D.3  __gcPrintAgendaDay()

   04E — Render da lista da agenda
      04E.1  renderAgendaList()

   05A — Mensagens e seleção da pesquisa rápida
      05A.1  setQuickPatientMsg(kind, text)
      05A.2  renderQuickPatientSelected()

   05B — Render dos resultados da pesquisa rápida
      05B.1  renderQuickPatientResults(results)

   05C — Utilitários do modal
      05C.1  closeModalRoot()

   05D — Validação de edição do doente
      05D.1  validatePatientEdit(values)

   08A — Wiring da pesquisa rápida
      08A.1  wireQuickPatientSearch()

   03A — Paleta de cores por clínica (visual — não afecta BD nem GCAL)
      03A.1  CLINIC_PALETTE
      03A.2  getClinicPalette(clinicId)
      03A.3  __gcWeekStartISO / __gcAddDaysToISO

   08B — Helpers do calendário mensal
      08B.1  monthLabel(d)
      08B.2  buildMonthGrid(monthDate)

   08C — Interface do calendário mensal (com dots reais por clínica)
      08C.1  openCalendarOverlay()

   08D — Vista semanal
      08D.1  openWeekView()

   09A — Helpers GCAL + datas/horas
      09A.1  closeModal()
      09A.2  calcEndFromStartAndDuration(startLocalStr, durMin)
      09A.3  makeAutoTitle(patientName, procType)
      09A.4  __gcGetGcalSyncDayUrl()
      09A.5  __gcNormalizeDayISO(v)
      09A.6  __gcUniqueDays(days)
      09A.7  __gcFireSyncDay(dayISO)
      09A.8  __gcFireSyncDays(dayISOs)
      09A.9  __gcPad2(n)
      09A.10 __gcToDateInput(d)
      09A.11 __gcToTimeInput(d)
      09A.12 __gcLocalDateTimeToIso(dateYYYYMMDD, timeHHMM)
      09A.13 __gcAddDaysYYYYMMDD(dateYYYYMMDD, add)
      09A.14 __gcCmpYYYYMMDD(a, b)

   09B — Transferência automática de doente entre clínicas
      09B.1  fetchPatientIdentifiers(patientId)
      09B.2  fetchActiveClinicForPatient(patientId)
      09B.3  buildTransferConfirmText({ patient, fromClinicName, toClinicName })
      09B.4  ensurePatientActiveInClinic({ patientId, targetClinicId })
      09B.5  maybeTransferPatientToClinic({ patientId, targetClinicId })

   09C/D/E — Modal marcação
      openApptModal({ mode, row })

   10C — Refresh agenda
      10C.1  refreshAgenda()
   ======================================================== */

import { G } from "./state.js";
import { UI, GCAL_WORKER_URL } from "./config.js";
import {
  escapeHtml, clipOneLine, normalizeDigits,
  fmtTime, fmtDatePt, fmtDateISO,
  parseISODateToLocalStart, isoLocalDayRangeFromISODate,
  toLocalInputValue, fromLocalInputValue
} from "./helpers.js";
import {
  PROCEDURE_OPTIONS, STATUS_OPTIONS, DURATION_OPTIONS, statusMeta
} from "./state.js";
import {
  loadAppointmentsForRange, fetchPatientsByIds, fetchPatientById,
  searchPatientsScoped, rpcCreatePatientForClinic,
  APPT_TIME_COL_CANDIDATES, APPT_END_COL_CANDIDATES, pickFirstExisting
} from "./db.js";
import { __gcIsAuthError, __gcForceSessionLock } from "./auth.js";

/* referência circular — openPatientViewModal vem de doente.js, injectado em runtime */
function openPatientViewModal(p) { return window.__gc_openPatientViewModal(p); }

/* flag de sessão bloqueada (partilhada com auth.js via window) */
function isSessionLocked() { return !!window.__gcSessionLockActive; }


/* ==== 03A — Paleta de cores por clínica ==== */

/* ---- 03A.1 — CLINIC_PALETTE ---- */
/* Cores atribuídas ciclicamente por índice de clínica.
   Não afectam a BD nem a sincronização Google Calendar — são apenas CSS. */
const CLINIC_PALETTE = [
  { color: "#1a56db", light: "#dbeafe" },  /* azul   */
  { color: "#0e9f6e", light: "#d1fae5" },  /* verde   */
  { color: "#e3a008", light: "#fef3c7" },  /* âmbar   */
  { color: "#7c3aed", light: "#ede9fe" },  /* violeta */
  { color: "#e02424", light: "#fee2e2" },  /* vermelho */
  { color: "#0694a2", light: "#d0f0f3" },  /* ciano   */
];
const BLOCK_DOT_COLOR = "#e02424";

/* ---- 03A.2 — getClinicPalette(clinicId) ---- */
function getClinicPalette(clinicId) {
  if (!clinicId) return { color: "#888", light: "#f3f4f6" };
  const idx = (G.clinics || []).findIndex((c) => String(c.id) === String(clinicId));
  return CLINIC_PALETTE[Math.max(0, idx) % CLINIC_PALETTE.length];
}

/* ---- 03A.3 — helpers de semana ---- */
function __gcWeekStartISO(iso) {
  /* Devolve o ISO da segunda-feira da semana que contém iso */
  const d = parseISODateToLocalStart(iso) || new Date();
  const dow = (d.getDay() + 6) % 7; /* 0=Seg … 6=Dom */
  const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow, 0, 0, 0, 0);
  return fmtDateISO(mon);
}
function __gcAddDaysToISO(iso, n) {
  const d = parseISODateToLocalStart(iso);
  if (!d) return iso;
  d.setDate(d.getDate() + n);
  return fmtDateISO(d);
}


/* ==== 04A — Helpers UI da agenda ==== */

/* ---- 04A.1 — setAgendaSubtitleForSelectedDay ---- */
export function setAgendaSubtitleForSelectedDay() {
  const r   = isoLocalDayRangeFromISODate(G.selectedDayISO);
  const sub = document.getElementById("agendaSubtitle");
  if (!sub || !r) return;
  sub.textContent = `${fmtDatePt(r.start)} (00:00–24:00)`;
}

/* ---- 04A.2 — setAgendaStatus ---- */
export function setAgendaStatus(kind, text) {
  const el = document.getElementById("agendaStatus");
  if (!el) return;
  const color = kind === "loading" ? "#666" : kind === "error" ? "#b00020" : "#111";
  el.innerHTML = `<div style="font-size:${UI.fs12}px; color:${color};">${escapeHtml(text)}</div>`;
}

/* ---- 04A.3 — renderClinicsSelect ---- */
export function renderClinicsSelect(clinics) {
  const sel = document.getElementById("selClinic");
  if (!sel) return;

  const opts = [`<option value="">Todas</option>`];
  for (const c of clinics) {
    const label = c.name || c.slug || c.id;
    opts.push(`<option value="${escapeHtml(c.id)}">${escapeHtml(label)}</option>`);
  }
  sel.innerHTML = opts.join("");
  if (clinics.length === 1) sel.value = clinics[0].id;
}

/* ---- 04A.4 — getPatientForAppointmentRow ---- */
function getPatientForAppointmentRow(apptRow) {
  const pid = apptRow?.patient_id ?? null;
  if (!pid) return null;
  return G.patientsById?.[pid] ?? null;
}

/* ---- 04A.5 — apptStatusMeta ---- */
function apptStatusMeta(apptRow) {
  try {
    if (String(apptRow?.mode || "").toLowerCase() === "bloqueio") {
      return { icon: "⛔", label: "Bloqueio", bg: "#f3f4f6", fg: "#111827", br: "#d1d5db" };
    }
  } catch (_) {}
  return statusMeta(apptRow?.status ?? "scheduled");
}


/* ==== 04B — Abertura de doente ==== */

/* ---- 04B.1 — openPatientFeedFromAny ---- */
export async function openPatientFeedFromAny(patientLike) {
  try {
    const pid = patientLike?.id ?? null;
    if (!pid) { alert("Doente inválido."); return; }
    const full = await fetchPatientById(pid);
    if (!full) { alert("Não consegui carregar o doente (RLS ou não existe)."); return; }
    openPatientViewModal(full);
  } catch (e) {
    console.error("openPatientFeed falhou:", e);
    alert("Erro ao abrir doente. Vê a consola para detalhe.");
  }
}


/* ==== 04C — Atualização de estado de marcação ==== */

/* ---- 04C.1 — updateAppointmentStatus ---- */
export async function updateAppointmentStatus(apptId, newStatus) {
  if (!apptId) return;
  const raw = String(newStatus || "").trim().toLowerCase();
  if (!raw) return;

  const idx = (G.agenda.rows || []).findIndex((x) => x?.id === apptId);
  if (idx >= 0) {
    const row = G.agenda.rows[idx];
    if (String(row?.mode || "").toLowerCase() === "bloqueio") {
      alert("Este registo é um bloqueio. Não é permitido alterar o estado.");
      renderAgendaList();
      return;
    }
  }

  const s = (raw === "cancelled") ? "no_show" : raw;

  if (idx >= 0) {
    G.agenda.rows[idx].status = s;
    renderAgendaList();
  }

  try {
    const { error } = await window.sb.from("appointments").update({ status: s }).eq("id", apptId);
    if (error) throw error;
  } catch (e) {
    console.error("Update status falhou:", e);
    await refreshAgenda();
    alert("Não foi possível atualizar o estado. Vê a consola para detalhe.");
  }
}


/* ==== 04D — Impressão da agenda do dia ==== */

/* ---- 04D.1 — __gcGetSelectedDayLabelForPrint ---- */
function __gcGetSelectedDayLabelForPrint() {
  try {
    const iso = String(G.selectedDayISO || "").trim();
    if (!iso) return "";
    const d = new Date(`${iso}T00:00:00`);
    if (isNaN(d.getTime())) return iso;
    return fmtDatePt(d);
  } catch (_) {
    return String(G.selectedDayISO || "");
  }
}

/* ---- 04D.2 — __gcBuildAgendaPrintHtml ---- */
function __gcBuildAgendaPrintHtml(rows) {
  const dayLabel = __gcGetSelectedDayLabelForPrint();
  const clinicFilter = (() => {
    try {
      const cid = document.getElementById("selClinic")?.value || "";
      if (!cid) return "Todas as clínicas";
      const c = G.clinicsById?.[cid] ?? null;
      return (c && (c.name || c.slug)) ? (c.name || c.slug) : cid;
    } catch (_) { return ""; }
  })();

  const timeColUsed = G.agenda.timeColUsed || "start_at";

  const rowsHtml = (rows || []).map((r) => {
    const startVal = r[timeColUsed] ?? r[pickFirstExisting(r, APPT_TIME_COL_CANDIDATES)];
    const endVal   = r[pickFirstExisting(r, APPT_END_COL_CANDIDATES)];
    const start    = startVal ? new Date(startVal) : null;
    const end      = endVal   ? new Date(endVal)   : null;
    const timeTxt  = `${fmtTime(start)}${end ? `–${fmtTime(end)}` : ""}`;

    const clinicId      = r.clinic_id ?? null;
    const isGlobalBlock = String(r?.mode || "").toLowerCase() === "bloqueio" && !clinicId;
    const clinicName    = isGlobalBlock ? "GLOBAL"
      : (clinicId && G.clinicsById[clinicId]
          ? G.clinicsById[clinicId].name || G.clinicsById[clinicId].slug || clinicId
          : clinicId || "—");

    const meta      = apptStatusMeta(r);
    const p         = getPatientForAppointmentRow(r);
    const patName   = p?.full_name ?? (r.patient_id ? `Doente (ID): ${r.patient_id}` : "—");
    const patPhone  = p?.phone ?? "—";

    const addrLine = (() => {
      const a  = String(p?.address_line1 || "").trim();
      const pc = String(p?.postal_code   || "").trim();
      const c  = String(p?.city         || "").trim();
      const tail = `${pc}${pc && c ? " " : ""}${c}`.trim();
      return `${a}${a && tail ? ", " : ""}${tail}`.trim();
    })();

    const insLine = (() => {
      const i   = String(p?.insurance_provider       || "").trim();
      const pol = String(p?.insurance_policy_number  || "").trim();
      if (!i && !pol) return "";
      return `${i}${i && pol ? " - " : ""}${pol}`.trim();
    })();

    return `
      <tr>
        <td class="c-time">${escapeHtml(timeTxt)}</td>
        <td class="c-name">${escapeHtml(patName)}</td>
        <td class="c-type">${escapeHtml(r.procedure_type ?? "—")}</td>
        <td class="c-status">${escapeHtml(`${meta.icon} ${meta.label}`)}</td>
        <td class="c-phone">${escapeHtml(patPhone)}</td>
        <td class="c-clinic">${escapeHtml(clinicName)}</td>
        <td class="c-nif">${escapeHtml(p?.nif || "—")}</td>
        <td class="c-addr">${escapeHtml(addrLine || "—")}</td>
        <td class="c-sns">${escapeHtml(p?.sns || "—")}</td>
        <td class="c-ins">${escapeHtml(insLine || "—")}</td>
      </tr>
    `;
  }).join("");

  return `
<!doctype html>
<html lang="pt-PT">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(`Agenda — ${dayLabel || "Dia"} — ${clinicFilter || ""}`.trim())}</title>
  <style>
    body{ font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif; margin:24px; color:#111; }
    h1{ font-size:18px; margin:0 0 6px 0; font-weight:900; }
    .sub{ color:#555; font-size:12px; margin:0 0 14px 0; }
    table{ width:100%; border-collapse:collapse; table-layout:fixed; }
    th, td{ border:1px solid #e5e5e5; padding:7px 8px; font-size:12px; vertical-align:top; line-height:1.25; }
    th{ background:#f6f6f6; text-align:left; font-weight:800; }
    .c-time{ width:70px; white-space:nowrap; font-weight:800; }
    .c-type{ width:95px; }
    .c-status{ width:110px; white-space:nowrap; }
    .c-phone{ width:95px; white-space:nowrap; }
    .c-clinic{ width:80px; }
    .c-nif{ width:90px; white-space:nowrap; }
    .c-sns{ width:95px; white-space:nowrap; }
    .c-ins{ width:160px; }
    .c-name{ width:240px; font-weight:800; white-space:normal; word-break:break-word; overflow-wrap:anywhere; }
    .c-addr{ width:320px; white-space:normal; word-break:break-word; overflow-wrap:anywhere; }
    @media print{ body{ margin:10mm; } }
  </style>
</head>
<body>
  <h1>Agenda do dia — ${escapeHtml(dayLabel || "—")}</h1>
  <div class="sub">${escapeHtml(clinicFilter || "")}</div>
  <table>
    <thead>
      <tr>
        <th>Horário</th><th>Nome</th><th>Tipo</th><th>Estado</th>
        <th>Telefone</th><th>Clínica</th><th>NIF</th>
        <th>Morada (CP Localidade)</th><th>SNS</th><th>Seguro</th>
      </tr>
    </thead>
    <tbody>${rowsHtml || ""}</tbody>
  </table>
</body>
</html>`;
}

/* ---- 04D.3 — __gcPrintAgendaDay ---- */
function __gcPrintAgendaDay() {
  try {
    const rows = G.agenda.rows || [];
    if (!rows.length) { alert("Sem marcações para imprimir."); return; }
    const html = __gcBuildAgendaPrintHtml(rows);
    const w = window.open("", "_blank");
    if (!w) { alert("Pop-up bloqueado. Permite pop-ups para imprimir."); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { try { w.print(); } catch (_) {} }, 250);
  } catch (e) {
    console.error(e);
    alert("Erro ao preparar impressão. Vê a consola para detalhe.");
  }
}


/* ==== 04E — Render da lista da agenda ==== */

/* ---- 04E.1 — renderAgendaList ---- */
export function renderAgendaList() {
  const ul = document.getElementById("agendaList");
  if (!ul) return;

  const rows        = G.agenda.rows || [];
  const timeColUsed = G.agenda.timeColUsed || "start_at";

  if (rows.length === 0) {
    ul.innerHTML = `<li style="padding:10px 0; font-size:${UI.fs12}px; color:#666;">Sem marcações para este dia.</li>`;
    return;
  }

  const header = `
    <li style="padding:8px 0 10px 0; border-bottom:1px solid #ededed;">
      <div class="gcAgendaGrid gcAgendaHeader">
        <div class="gcAgendaH">Horário</div>
        <div class="gcAgendaH">Nome</div>
        <div class="gcAgendaH">Tipo</div>
        <div class="gcAgendaH">Estado</div>
        <div class="gcAgendaH">Telefone</div>
        <div class="gcAgendaH">Clínica</div>
      </div>
      <style>
        .gcAgendaGrid{ display:grid; grid-template-columns: 110px 2.4fr 0.9fr 160px 120px 140px; column-gap:16px; align-items:center; width:100%; }
        .gcAgendaHeader .gcAgendaH{ font-size:${UI.fs12}px; color:#666; font-weight:700; letter-spacing:.2px; }
        .gcAgendaRow{ padding:10px 0; border-bottom:1px solid #f2f2f2; }
        .gcAgendaRow:hover{ background:#f8f8f8; border-radius:10px; }
        .gcAgendaTime{ font-size:${UI.fs14}px; font-weight:800; color:#111; white-space:nowrap; }
        .gcAgendaNameWrap{ min-width:0; }
        .gcAgendaNameText{ display:block; min-width:0; font-size:${UI.fs14}px; font-weight:800; color:#111; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .gcAgendaNotesBelow{ display:block; margin-top:4px; min-width:0; font-size:${UI.fs12}px; color:#666; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .gcAgendaCell{ min-width:0; font-size:${UI.fs12}px; color:#111; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .gcAgendaCellType{ padding-left:8px; }
        .gcAgendaStatusWrap{ min-width:0; }
        .gcStatusSelect{ width:100%; max-width:100%; min-width:0; font-size:${UI.fs12}px; font-weight:800; padding:6px 10px; border-radius:999px; border:1px solid #ddd; outline:none; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .gcStatusSelect:disabled{ opacity:0.75; cursor:not-allowed; }
        .gcAgendaFooter{ margin-top:12px; padding-top:12px; border-top:1px dashed #e5e5e5; display:flex; justify-content:flex-end; }
      </style>
    </li>`;

  const body = rows.map((r) => {
    const startVal  = r[timeColUsed] ?? r[pickFirstExisting(r, APPT_TIME_COL_CANDIDATES)];
    const endVal    = r[pickFirstExisting(r, APPT_END_COL_CANDIDATES)];
    const start     = startVal ? new Date(startVal) : null;
    const end       = endVal   ? new Date(endVal)   : null;
    const timeTxt   = `${fmtTime(start)}${end ? `–${fmtTime(end)}` : ""}`;

    const clinicId   = r.clinic_id ?? null;
    const clinicName = clinicId && G.clinicsById[clinicId]
      ? G.clinicsById[clinicId].name || G.clinicsById[clinicId].slug || clinicId
      : clinicId || "—";

    const meta       = apptStatusMeta(r);
    const proc       = r.procedure_type ?? "—";
    const notes      = r.notes ? clipOneLine(r.notes, 140) : "";
    const p          = getPatientForAppointmentRow(r);
    const patName    = p?.full_name ?? (r.patient_id ? `Doente (ID): ${r.patient_id}` : "—");
    const patPhone   = p?.phone ?? "—";
    const isBlock    = String(r?.mode || "").toLowerCase() === "bloqueio";

    function optLabel(s) { const m = statusMeta(s); return `${m.icon} ${m.label}`; }

    const statusSelectHtml = isBlock
      ? `<select data-status-select="1" class="gcStatusSelect" disabled style="background:${escapeHtml(meta.bg)};color:${escapeHtml(meta.fg)};border-color:${escapeHtml(meta.br)};" title="Bloqueio (não editável)">
           <option value="bloqueio" selected>${escapeHtml(`${meta.icon} ${meta.label}`)}</option>
         </select>`
      : `<select data-status-select="1" class="gcStatusSelect" style="background:${escapeHtml(meta.bg)};color:${escapeHtml(meta.fg)};border-color:${escapeHtml(meta.br)};" title="Clique para alterar estado">
           ${STATUS_OPTIONS.map((s) => {
             const val = (s === "cancelled") ? "no_show" : s;
             const sel = (val === String(r.status ?? "scheduled").toLowerCase()) ? " selected" : "";
             return `<option value="${escapeHtml(val)}"${sel}>${escapeHtml(optLabel(val))}</option>`;
           }).join("")}
         </select>`;

    return `
      <li data-appt-id="${escapeHtml(r.id)}" class="gcAgendaRow">
        <div class="gcAgendaGrid">
          <div class="gcAgendaTime">${escapeHtml(timeTxt)}</div>
          <div class="gcAgendaNameWrap">
            ${isBlock
              ? `<span class="gcAgendaNameText">${escapeHtml("—")}</span>`
              : `<span data-patient-open="1" class="gcPatientLink gcAgendaNameText">${escapeHtml(patName)}</span>`
            }
            ${notes ? `<span class="gcAgendaNotesBelow">Notas: ${escapeHtml(notes)}</span>` : ""}
          </div>
          <div class="gcAgendaCell gcAgendaCellType" title="${escapeHtml(proc)}">${escapeHtml(proc)}</div>
          <div class="gcAgendaStatusWrap">${statusSelectHtml}</div>
          <div class="gcAgendaCell" title="${escapeHtml(patPhone)}">${escapeHtml(patPhone)}</div>
          <div class="gcAgendaCell" title="${escapeHtml(clinicName)}">${escapeHtml(clinicName)}</div>
        </div>
      </li>`;
  }).join("");

  const footer = `
    <li style="padding:10px 0 0 0;">
      <div class="gcAgendaFooter">
        <button id="btnPrintAgendaDay" class="gcBtnOutline" type="button">Imprimir lista do dia</button>
      </div>
    </li>`;

  ul.innerHTML = header + body + footer;

  ul.querySelectorAll("li[data-appt-id]").forEach((li) => {
    li.addEventListener("click", (ev) => {
      const t = ev.target;
      if (t?.closest?.("[data-status-select='1']")) return;
      if (t?.closest?.("[data-patient-open='1']")) return;
      const id  = li.getAttribute("data-appt-id");
      const row = rows.find((x) => x.id === id);
      if (row) openApptModal({ mode: "edit", row });
    });

    const pLink = li.querySelector("[data-patient-open='1']");
    if (pLink) {
      pLink.addEventListener("click", (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        const apptId = li.getAttribute("data-appt-id");
        const row    = rows.find((x) => x.id === apptId);
        if (!row) return;
        if (!row.patient_id) { alert("Marcação sem patient_id."); return; }
        openPatientFeedFromAny({ id: row.patient_id });
      });
    }

    const sel = li.querySelector("select[data-status-select='1']");
    if (sel) {
      sel.addEventListener("click", (ev) => ev.stopPropagation());
      sel.addEventListener("change", async (ev) => {
        ev.stopPropagation();
        await updateAppointmentStatus(li.getAttribute("data-appt-id"), sel.value);
      });
    }
  });

  const btn = document.getElementById("btnPrintAgendaDay");
  if (btn) btn.addEventListener("click", (ev) => { ev.preventDefault(); ev.stopPropagation(); __gcPrintAgendaDay(); });
}


/* ==== 05A — Mensagens e seleção da pesquisa rápida ==== */

/* ---- 05A.1 — setQuickPatientMsg ---- */
function setQuickPatientMsg(kind, text) {
  const el = document.getElementById("pQuickMsg");
  if (!el) return;
  el.style.color = kind === "error" ? "#b00020" : kind === "ok" ? "#111" : "#666";
  el.textContent = text || "";
}

/* ---- 05A.2 — renderQuickPatientSelected ---- */
function renderQuickPatientSelected() {
  const box = document.getElementById("pQuickSelected");
  if (!box) return;
  const p = G.patientQuick.selected;
  if (!p) { box.textContent = "—"; return; }
  const idBits = [];
  if (p.sns)         idBits.push(`SNS:${p.sns}`);
  if (p.nif)         idBits.push(`NIF:${p.nif}`);
  if (p.passport_id) idBits.push(`ID:${p.passport_id}`);
  box.textContent = `${p.full_name}${idBits.length ? ` • ${idBits.join(" / ")}` : ""}${p.phone ? ` • Tel:${p.phone}` : ""}`;
}


/* ==== 05B — Render dos resultados da pesquisa rápida ==== */

/* ---- 05B.1 — renderQuickPatientResults ---- */
export function renderQuickPatientResults(results) {
  const host = document.getElementById("pQuickResults");
  if (!host) return;

  if (!results || results.length === 0) {
    host.innerHTML = `<div style="font-size:${UI.fs12}px; color:#666;">Sem resultados.</div>`;
    return;
  }

  const selectedId = G.patientQuick?.selected?.id ?? null;

  const currentClinicId = G.activeClinicId || G.clinics?.[0]?.id || null;

  host.innerHTML = results.map((p) => {
    const idBits = [];
    if (p.sns)         idBits.push(`SNS:${p.sns}`);
    if (p.nif)         idBits.push(`NIF:${p.nif}`);
    if (p.passport_id) idBits.push(`ID:${p.passport_id}`);
    const line2 = [idBits.join(" / "), p.phone ? `Tel:${p.phone}` : ""].filter(Boolean).join(" • ");

    const isSel      = selectedId && p.id === selectedId;
    const isOther    = p.active_clinic_id && currentClinicId && p.active_clinic_id !== currentClinicId;
    const otherName  = isOther ? (G.clinicsById?.[p.active_clinic_id]?.name || G.clinicsById?.[p.active_clinic_id]?.display_name || "Outra clínica") : null;

    const bg = isSel    ? "background:#f2f2f2;" : isOther ? "background:#fffbeb;" : "background:#fff;";
    const br = isSel    ? "border:1px solid #cbd5e1;" : isOther ? "border:1px solid #fcd34d;" : "border:1px solid #f0f0f0;";

    const clinicBadge = isOther
      ? `<span style="font-size:10px;font-weight:700;background:#fef3c7;color:#92400e;border-radius:4px;padding:1px 6px;margin-left:6px;">↗ ${escapeHtml(otherName)}</span>`
      : "";

    return `
      <div data-pid="${escapeHtml(p.id)}" data-other-clinic="${isOther ? escapeHtml(p.active_clinic_id) : ""}"
           style="padding:8px; ${br} border-radius:10px; margin-bottom:8px; cursor:pointer; ${bg}">
        <div style="font-size:${UI.fs13}px; color:#111; font-weight:700; white-space:normal; overflow-wrap:anywhere; word-break:break-word;">
          ${escapeHtml(p.full_name)}${clinicBadge}
        </div>
        <div style="font-size:${UI.fs12}px; color:#666;">${escapeHtml(line2 || "—")}</div>
      </div>`;
  }).join("");

  if (host._gcQuickDelegate) {
    host.removeEventListener("mousedown", host._gcQuickDelegate);
    host.removeEventListener("click",     host._gcQuickDelegate);
    host._gcQuickDelegate = null;
  }

  const delegate = async (ev) => {
    const card = ev.target?.closest?.("[data-pid]");
    if (!card) return;
    ev.preventDefault(); ev.stopPropagation();
    const pid = card.getAttribute("data-pid");
    if (!pid) return;
    const p = (results || []).find((x) => x.id === pid);
    if (!p) return;

    // Se o doente está noutro clínica, oferecer transferência
    const otherClinicId = card.getAttribute("data-other-clinic");
    if (otherClinicId && currentClinicId) {
      const fromName = G.clinicsById?.[otherClinicId]?.name || G.clinicsById?.[otherClinicId]?.display_name || otherClinicId;
      const toName   = G.clinicsById?.[currentClinicId]?.name || G.clinicsById?.[currentClinicId]?.display_name || currentClinicId;
      const ok = confirm(`"${p.full_name}" está activo em: ${fromName}\n\nTransferir para: ${toName}?`);
      if (!ok) return;
      try {
        await ensurePatientActiveInClinic({ patientId: pid, targetClinicId: currentClinicId });
      } catch (e) {
        alert("Erro ao transferir doente: " + (e?.message || e));
        return;
      }
    }

    G.patientQuick.selected = p;
    const input = document.getElementById("pQuickQuery");
    if (input) input.value = p.full_name || "";
    renderQuickPatientSelected();
    setQuickPatientMsg("ok", "Doente selecionado.");

    const hostNow = document.getElementById("pQuickResults");
    if (hostNow) hostNow.style.display = "none";

    try {
      await openPatientFeedFromAny({ id: pid });
    } catch (e) {
      console.error("Abrir FEED a partir da pesquisa falhou:", e);
      alert("Não consegui abrir o Feed a partir da pesquisa. Vê a consola para detalhe.");
    }
  };

  host._gcQuickDelegate = delegate;
  host.addEventListener("mousedown", delegate);
  host.addEventListener("click",     delegate);
}


/* ==== 05C — Utilitários do modal ==== */

/* ---- 05C.1 — closeModalRoot ---- */
export function closeModalRoot() {
  const root = document.getElementById("modalRoot");
  if (root) root.innerHTML = "";
}


/* ==== 05D — Validação de edição do doente ==== */

/* ---- 05D.1 — validatePatientEdit ---- */
export function validatePatientEdit(values) {
  const fullName = (values.full_name || "").trim();
  if (!fullName) return { ok: false, msg: "Nome completo é obrigatório." };

  const sns  = normalizeDigits(values.sns);
  const nif  = normalizeDigits(values.nif);
  const pass = (values.passport_id || "").trim();

  if (sns  && !/^[0-9]{9}$/.test(sns))             return { ok: false, msg: "SNS inválido: tem de ter 9 dígitos." };
  if (nif  && !/^[0-9]{9}$/.test(nif))             return { ok: false, msg: "NIF inválido: tem de ter 9 dígitos." };
  if (pass && !/^[A-Za-z0-9]{4,20}$/.test(pass))   return { ok: false, msg: "Passaporte/ID inválido: 4–20 alfanum." };
  if (!sns && !nif && !pass)                        return { ok: false, msg: "Identificação obrigatória: SNS ou NIF ou Passaporte/ID." };

  return {
    ok: true,
    cleaned: {
      full_name:                fullName,
      dob:                      values.dob || null,
      phone:                    values.phone?.trim()                    || null,
      email:                    values.email?.trim()                    || null,
      sns:                      sns  || null,
      nif:                      nif  || null,
      passport_id:              pass || null,
      insurance_provider:       values.insurance_provider?.trim()       || null,
      insurance_policy_number:  values.insurance_policy_number?.trim()  || null,
      address_line1:            values.address_line1?.trim()            || null,
      postal_code:              values.postal_code?.trim()              || null,
      city:                     values.city?.trim()                     || null,
      country:                  values.country?.trim()                  || "PT",
      notes:                    values.notes?.trim()                    || null,
    },
  };
}


/* ==== 08A — Wiring da pesquisa rápida ==== */

/* ---- 08A.1 — wireQuickPatientSearch ---- */
export async function wireQuickPatientSearch() {
  const input   = document.getElementById("pQuickQuery");
  const resHost = document.getElementById("pQuickResults");
  if (!input || !resHost) return;

  resHost.innerHTML  = "";
  resHost.style.display = "none";

  let timer = null;

  async function run() {
    const term = (input.value || "").trim();
    if (!term || term.length < 2) {
      resHost.innerHTML = ""; resHost.style.display = "none"; return;
    }

    const selClinic = document.getElementById("selClinic");
    const clinicId  = selClinic?.value || null;

    resHost.style.display = "block";
    resHost.innerHTML = `<div style="font-size:${UI.fs12}px; color:#666;">A pesquisar…</div>`;

    try {
      const pts = await searchPatientsScoped({ clinicId, q: term, limit: 30 });
      G.patientQuick.lastResults = pts;

      if (!pts || pts.length === 0) {
        resHost.style.display = "block";
        resHost.innerHTML = `<div style="font-size:${UI.fs12}px; color:#666;">Sem resultados.</div>`;
        return;
      }
      renderQuickPatientResults(pts);
    } catch (e) {
      console.error("Pesquisa rápida de doente falhou:", e);
      resHost.style.display = "block";
      resHost.innerHTML = `<div style="font-size:${UI.fs12}px; color:#b00020;">Erro na pesquisa. Vê a consola.</div>`;
    }
  }

  input.addEventListener("input", () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(run, 250);
  });
}


/* ==== 08B — Helpers do calendário mensal ==== */

/* ---- 08B.1 — monthLabel ---- */
function monthLabel(d) {
  const months = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

/* ---- 08B.2 — buildMonthGrid ---- */
function buildMonthGrid(monthDate) {
  const y = monthDate.getFullYear();
  const m = monthDate.getMonth();

  const first       = new Date(y, m, 1,     0, 0, 0, 0);
  const last        = new Date(y, m + 1, 0, 0, 0, 0, 0);
  const daysInMonth = last.getDate();
  const dowFirstMon0 = (first.getDay() + 6) % 7;

  const cells = [];
  for (let i = 0; i < dowFirstMon0; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, m, d, 0, 0, 0, 0));
  while (cells.length % 7 !== 0) cells.push(null);
  while (cells.length < 42)      cells.push(null);
  return cells;
}


/* ==== 08C — Interface do calendário mensal ==== */

/* ---- 08C.1 — openCalendarOverlay ---- */
export async function openCalendarOverlay() {
  const root = document.getElementById("modalRoot");
  if (!root) return;

  const todayISO    = fmtDateISO(new Date());
  const selectedISO = G.selectedDayISO;

  if (!G.calMonth) {
    const selD = parseISODateToLocalStart(selectedISO) || new Date();
    G.calMonth = new Date(selD.getFullYear(), selD.getMonth(), 1, 0, 0, 0, 0);
  }

  /* Carregar marcações do mês para os dots */
  const y = G.calMonth.getFullYear();
  const m = G.calMonth.getMonth();
  const startISO = `${y}-${String(m + 1).padStart(2, "0")}-01T00:00:00.000Z`;
  const endISO   = `${y}-${String(m + 2).padStart(2, "0")}-01T00:00:00.000Z`;
  /* dots: { "2026-03-14": [{clinic_id, isBlock}, ...] } */
  const dots = {};
  try {
    const selClinic = document.getElementById("selClinic");
    const clinicId  = selClinic?.value || null;
    const { data: appts } = await loadAppointmentsForRange({ clinicId, startISO, endISO });
    for (const a of (appts || [])) {
      const col = a.start_at || a.starts_at || a.start_time || a.start_datetime || a.start;
      if (!col) continue;
      const dayISO = String(col).slice(0, 10);
      if (!dots[dayISO]) dots[dayISO] = [];
      dots[dayISO].push({ clinic_id: a.clinic_id, isBlock: String(a.mode || "").toLowerCase() === "bloqueio" });
    }
  } catch (_) { /* dots ficam vazios — não bloqueia abertura */ }

  const cells    = buildMonthGrid(G.calMonth);
  const weekDays = ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];

  /* Legenda: clínicas com pelo menos 1 marcação no mês */
  const clinicsInMonth = new Set();
  let hasBlockInMonth  = false;
  for (const dayDots of Object.values(dots)) {
    for (const dot of dayDots) {
      if (dot.isBlock) hasBlockInMonth = true;
      else if (dot.clinic_id) clinicsInMonth.add(String(dot.clinic_id));
    }
  }
  const legendItems = (G.clinics || [])
    .filter((c) => clinicsInMonth.has(String(c.id)))
    .map((c) => {
      const pal = getClinicPalette(c.id);
      return `<div style="display:flex;align-items:center;gap:5px;font-size:${UI.fs12}px;color:#555;">
        <div style="width:9px;height:9px;border-radius:50%;background:${pal.color};flex-shrink:0;"></div>
        ${escapeHtml(c.name || c.slug || c.id)}
      </div>`;
    });
  if (hasBlockInMonth) legendItems.push(`<div style="display:flex;align-items:center;gap:5px;font-size:${UI.fs12}px;color:#555;"><div style="width:9px;height:9px;border-radius:50%;background:${BLOCK_DOT_COLOR};flex-shrink:0;"></div>Bloqueio</div>`);

  root.innerHTML = `
    <div id="calOverlay" style="position:fixed;inset:0;background:rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;padding:18px;z-index:1000;">
      <div style="background:#fff;width:min(560px,100%);border-radius:14px;border:1px solid #e5e5e5;padding:16px;">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
          <button id="calPrev" class="gcBtn gcBtnIcon">◀</button>
          <div style="font-size:${UI.fs14}px;font-weight:800;color:#111;" id="calTitle">${escapeHtml(monthLabel(G.calMonth))}</div>
          <button id="calNext" class="gcBtn gcBtnIcon">▶</button>
        </div>
        <div style="margin-top:10px;display:grid;grid-template-columns:repeat(7,1fr);gap:4px;">
          ${weekDays.map((w) => `<div style="font-size:${UI.fs12}px;color:#666;text-align:center;padding:6px 0;">${w}</div>`).join("")}
          ${cells.map((d) => {
            if (!d) return `<div></div>`;
            const iso        = fmtDateISO(d);
            const isToday    = iso === todayISO;
            const isSelected = iso === selectedISO;
            const dayDots    = dots[iso] || [];
            /* máximo 5 dots visíveis */
            const dotsHtml = dayDots.slice(0, 5).map((dot) => {
              const bg = dot.isBlock ? BLOCK_DOT_COLOR : getClinicPalette(dot.clinic_id).color;
              return `<div style="width:6px;height:6px;border-radius:50%;background:${bg};flex-shrink:0;"></div>`;
            }).join("") + (dayDots.length > 5 ? `<div style="font-size:9px;color:#888;">+${dayDots.length - 5}</div>` : "");
            const cellBg = isSelected
              ? "background:#0f2d52;color:#fff;border-color:#0f2d52;"
              : isToday
                ? "background:#f0f4ff;color:#111;border-color:#1a56db;"
                : "background:#fff;color:#111;border-color:#eee;";
            return `<div data-iso="${iso}" style="padding:6px 4px 4px;border-radius:8px;border:1px solid #eee;cursor:pointer;user-select:none;${cellBg}min-height:52px;">
              <div style="font-size:${UI.fs13}px;font-weight:${isSelected || isToday ? "800" : "600"};text-align:center;">${d.getDate()}</div>
              <div style="display:flex;flex-wrap:wrap;gap:2px;justify-content:center;margin-top:4px;">${dotsHtml}</div>
            </div>`;
          }).join("")}
        </div>
        ${legendItems.length ? `<div style="margin-top:12px;padding-top:10px;border-top:1px solid #f0f0f0;display:flex;flex-wrap:wrap;gap:10px;">${legendItems.join("")}</div>` : ""}
        <div style="margin-top:12px;display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;">
          <div style="font-size:${UI.fs12}px;color:#666;">Clique num dia para abrir a agenda desse dia.</div>
          <div style="display:flex;gap:8px;">
            <button id="calOpenWeek" class="gcBtn">Vista semanal</button>
            <button id="calClose" class="gcBtnGhost">Fechar</button>
          </div>
        </div>
      </div>
    </div>`;

  function close() { root.innerHTML = ""; }

  document.getElementById("calClose")?.addEventListener("click", close);
  document.getElementById("calOpenWeek")?.addEventListener("click", () => { close(); openWeekView(); });
  document.getElementById("calOverlay")?.addEventListener("click", (ev) => { if (ev.target.id === "calOverlay") close(); });
  document.getElementById("calPrev")?.addEventListener("click", () => {
    G.calMonth = new Date(G.calMonth.getFullYear(), G.calMonth.getMonth() - 1, 1, 0, 0, 0, 0);
    openCalendarOverlay();
  });
  document.getElementById("calNext")?.addEventListener("click", () => {
    G.calMonth = new Date(G.calMonth.getFullYear(), G.calMonth.getMonth() + 1, 1, 0, 0, 0, 0);
    openCalendarOverlay();
  });

  root.querySelectorAll("[data-iso]").forEach((el) => {
    el.addEventListener("click", () => {
      const iso = el.getAttribute("data-iso");
      if (!iso) return;
      G.selectedDayISO = iso;
      const d = parseISODateToLocalStart(iso);
      if (d) G.calMonth = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
      close();
      G.weekStartISO = __gcWeekStartISO(iso);
      openWeekView();
    });
  });
}


/* ==== 08D — Vista semanal ==== */

/* ---- 08D.1 — openWeekView ---- */
export async function openWeekView() {
  const root = document.getElementById("modalRoot");
  if (!root) return;

  /* Semana actual baseada no dia seleccionado */
  if (!G.weekStartISO) G.weekStartISO = __gcWeekStartISO(G.selectedDayISO);

  const todayISO = fmtDateISO(new Date());

  /* Gerar os 7 dias da semana (Seg → Dom) */
  const weekDays = [];
  const WDAY_NAMES = ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];
  for (let i = 0; i < 7; i++) {
    const iso = __gcAddDaysToISO(G.weekStartISO, i);
    weekDays.push({ iso, label: WDAY_NAMES[i] });
  }

  /* Label da semana ex.: "10–16 Mar 2026" */
  const d0 = parseISODateToLocalStart(weekDays[0].iso);
  const d6 = parseISODateToLocalStart(weekDays[6].iso);
  const MONTHS_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const weekLabel = d0 && d6
    ? `${d0.getDate()}–${d6.getDate()} ${MONTHS_PT[d6.getMonth()]} ${d6.getFullYear()}`
    : "";

  /* Carregar marcações da semana inteira de uma vez.
     Usar isoLocalDayRangeFromISODate (mesmo mecanismo do refreshAgenda) para
     garantir que o range respeita o fuso horário local. */
  const rStart = isoLocalDayRangeFromISODate(weekDays[0].iso);
  const rEnd   = isoLocalDayRangeFromISODate(weekDays[6].iso);
  const weekRangeStart = rStart?.startISO || `${weekDays[0].iso}T00:00:00.000Z`;
  const weekRangeEnd   = rEnd?.endISO     || `${__gcAddDaysToISO(weekDays[6].iso, 1)}T00:00:00.000Z`;

  let appts = [];
  try {
    const selClinic = document.getElementById("selClinic");
    const clinicId  = selClinic?.value || null;
    const { data } = await loadAppointmentsForRange({ clinicId, startISO: weekRangeStart, endISO: weekRangeEnd });
    appts = data || [];
  } catch (_) {}

  /* Carregar nomes dos doentes — completa G.patientsById com os que faltam */
  try {
    const missingIds = [...new Set(appts.map(a => a.patient_id).filter(pid => pid && !G.patientsById?.[pid]))];
    if (missingIds.length > 0) {
      const extra = await fetchPatientsByIds(missingIds);
      G.patientsById = { ...(G.patientsById || {}), ...extra };
    }
  } catch (_) {}

  /* Agrupar marcações por dia */
  const byDay = {};
  for (const a of appts) {
    const col = a.start_at || a.starts_at || a.start_time || a.start_datetime || a.start;
    if (!col) continue;
    const dayISO = String(col).slice(0, 10);
    if (!byDay[dayISO]) byDay[dayISO] = [];
    byDay[dayISO].push(a);
  }

  /* Horas presentes na semana — construir lista dinâmica de linhas.
     Em vez de slots fixos de 20 em 20 min (que perdem marcações às :15, :30, etc.),
     geramos uma linha por HORA inteira que tenha pelo menos uma marcação,
     mais as horas-âncora para contexto visual. */
  const hoursWithAppts = new Set();
  for (const a of appts) {
    const col = a.start_at || a.starts_at || a.start_time || a.start_datetime || a.start;
    if (!col) continue;
    hoursWithAppts.add(new Date(col).getHours());
  }
  /* Garantir pelo menos 08:00–19:00 como estrutura visual */
  const minH = hoursWithAppts.size ? Math.min(...hoursWithAppts, 8)  : 8;
  const maxH = hoursWithAppts.size ? Math.max(...hoursWithAppts, 19) : 19;
  const HOUR_ROWS = [];
  for (let h = minH; h <= maxH; h++) HOUR_ROWS.push(h);

  /* Obter hora local de uma marcação */
  function apptHour(a) {
    const col = a.start_at || a.starts_at || a.start_time || a.start_datetime || a.start;
    if (!col) return -1;
    return new Date(col).getHours();
  }
  function apptTimeLabel(a) {
    const col = a.start_at || a.starts_at || a.start_time || a.start_datetime || a.start;
    if (!col) return "";
    const d = new Date(col);
    return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  }

  /* Legenda de clínicas */
  const clinicsPresent = new Set(appts.filter(a => a.clinic_id && String(a.mode||"") !== "bloqueio").map(a => String(a.clinic_id)));
  const legendHtml = (G.clinics || [])
    .filter(c => clinicsPresent.has(String(c.id)))
    .map(c => {
      const pal = getClinicPalette(c.id);
      return `<div style="display:flex;align-items:center;gap:5px;font-size:${UI.fs12}px;color:#555;">
        <div style="width:9px;height:9px;border-radius:50%;background:${pal.color};flex-shrink:0;"></div>
        ${escapeHtml(c.name || c.slug || c.id)}</div>`;
    }).join("");

  /* Construir grelha semanal */
  const theadCells = weekDays.map(({ iso, label }) => {
    const d = parseISODateToLocalStart(iso);
    const isToday = iso === todayISO;
    const isSelDay = iso === G.selectedDayISO;
    const numStyle = isToday
      ? "color:#1a56db;font-weight:900;"
      : isSelDay
        ? "color:#0f2d52;font-weight:900;"
        : "color:#111;font-weight:700;";
    return `<th style="padding:6px 4px;text-align:center;border-right:1px solid #eee;background:#fafafa;position:sticky;top:0;z-index:2;">
      <div style="font-size:${UI.fs12}px;color:#888;">${label}</div>
      <div style="font-size:${UI.fs14}px;${numStyle}">${d ? d.getDate() : ""}</div>
    </th>`;
  }).join("");

  const tbodyRows = HOUR_ROWS.map((h) => {
    const hourLabel = `${String(h).padStart(2,"0")}:00`;
    const cells = weekDays.map(({ iso }) => {
      /* Todas as marcações desta hora neste dia */
      const dayAppts = (byDay[iso] || []).filter(a => apptHour(a) === h);
      if (!dayAppts.length) return `<td data-slot-iso="${escapeHtml(iso)}" data-slot-hour="${h}" style="border-right:1px solid #eee;border-bottom:1px solid #f5f5f5;height:52px;padding:2px;vertical-align:top;cursor:pointer;" title="Agendar às ${String(h).padStart(2,'0')}h de ${iso}"></td>`;
      const inner = dayAppts.map(a => {
        const isBlock = String(a.mode || "").toLowerCase() === "bloqueio";
        if (isBlock) {
          return `<div style="background:#f3f4f6;border-radius:5px;padding:3px 5px;font-size:10px;color:#9ca3af;display:flex;align-items:center;gap:4px;">⛔ Bloqueio</div>`;
        }
        const pal  = getClinicPalette(a.clinic_id);
        const p    = G.patientsById?.[a.patient_id];
        const name = p?.full_name
          ? clipOneLine(p.full_name, 18)
          : (a.title ? clipOneLine(a.title, 18) : "—");
        const proc  = clipOneLine(a.procedure_type || "", 16);
        const tLbl  = apptTimeLabel(a);
        return `<div data-week-appt-id="${escapeHtml(a.id)}" data-week-pid="${escapeHtml(a.patient_id || "")}"
          style="background:${pal.light};border-left:3px solid ${pal.color};border-radius:4px;padding:3px 5px;cursor:pointer;margin-bottom:2px;"
          title="${escapeHtml((p?.full_name || a.title || "") + (proc ? " — " + proc : "") + (tLbl ? " (" + tLbl + ")" : ""))}">
          <div style="font-size:9px;color:${pal.color};opacity:0.75;margin-bottom:1px;">${escapeHtml(tLbl)}</div>
          <div style="font-size:10px;font-weight:700;color:${pal.color};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(name)}</div>
          ${proc ? `<div style="font-size:9px;color:#555;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(proc)}</div>` : ""}
        </div>`;
      }).join("");
      return `<td style="border-right:1px solid #eee;border-bottom:1px solid #f5f5f5;height:52px;padding:2px;vertical-align:top;overflow:hidden;">${inner}</td>`;
    }).join("");

    return `<tr>
      <td style="width:48px;padding:4px 4px 0;border-right:1px solid #eee;border-bottom:1px solid #f5f5f5;font-size:10px;font-weight:700;color:#888;white-space:nowrap;text-align:right;vertical-align:top;">${hourLabel}</td>
      ${cells}
    </tr>`;
  }).join("");

  root.innerHTML = `
    <div id="weekOverlay" style="position:fixed;inset:0;background:rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;padding:12px;z-index:1000;">
      <div style="background:#fff;width:min(1100px,100%);border-radius:14px;border:1px solid #e5e5e5;padding:14px;max-height:92vh;display:flex;flex-direction:column;">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-shrink:0;">
          <div style="display:flex;align-items:center;gap:8px;">
            <button id="weekPrev" class="gcBtn gcBtnIcon">◀</button>
            <div style="font-size:${UI.fs14}px;font-weight:800;color:#111;">${escapeHtml(weekLabel)}</div>
            <button id="weekNext" class="gcBtn gcBtnIcon">▶</button>
            <button id="weekToday" class="gcBtnOutline" style="margin-left:4px;">Hoje</button>
          </div>
          <div style="display:flex;gap:8px;">
            <button id="weekOpenCal" class="gcBtnOutline">Mensal</button>
            <button id="weekClose" class="gcBtnGhost">Fechar</button>
          </div>
        </div>
        <div style="margin-top:10px;overflow:auto;flex:1;">
          <table style="border-collapse:collapse;width:100%;table-layout:fixed;">
            <thead>
              <tr>
                <th style="width:44px;background:#fafafa;border-right:1px solid #eee;position:sticky;top:0;z-index:2;"></th>
                ${theadCells}
              </tr>
            </thead>
            <tbody>${tbodyRows}</tbody>
          </table>
        </div>
        ${legendHtml ? `<div style="margin-top:10px;padding-top:8px;border-top:1px solid #f0f0f0;display:flex;flex-wrap:wrap;gap:10px;flex-shrink:0;">${legendHtml}</div>` : ""}
        <div style="margin-top:8px;font-size:${UI.fs12}px;color:#888;flex-shrink:0;">Clique numa marcação para abrir o doente · Clique numa célula vazia para agendar.</div>
      </div>
    </div>`;

  function close() { root.innerHTML = ""; }

  document.getElementById("weekClose")?.addEventListener("click", close);
  document.getElementById("weekOpenCal")?.addEventListener("click", () => { close(); openCalendarOverlay(); });
  document.getElementById("weekOverlay")?.addEventListener("click", (ev) => { if (ev.target.id === "weekOverlay") close(); });

  document.getElementById("weekPrev")?.addEventListener("click", () => {
    G.weekStartISO = __gcAddDaysToISO(G.weekStartISO, -7);
    openWeekView();
  });
  document.getElementById("weekNext")?.addEventListener("click", () => {
    G.weekStartISO = __gcAddDaysToISO(G.weekStartISO, 7);
    openWeekView();
  });
  document.getElementById("weekToday")?.addEventListener("click", () => {
    G.weekStartISO = __gcWeekStartISO(fmtDateISO(new Date()));
    openWeekView();
  });

  /* Clique em célula vazia → abrir modal de nova marcação */
  root.querySelectorAll("[data-slot-iso]").forEach((el) => {
    el.addEventListener("click", (ev) => {
      const iso  = el.getAttribute("data-slot-iso");
      const hour = parseInt(el.getAttribute("data-slot-hour"), 10);
      if (!iso || isNaN(hour)) return;
      /* Granularidade de 15 min com base na posição Y dentro da célula */
      const rect    = el.getBoundingClientRect();
      const relY    = Math.max(0, ev.clientY - rect.top);
      const minutes = Math.min(45, Math.round((relY / rect.height) * 60 / 15) * 15);
      const d = parseISODateToLocalStart(iso);
      if (!d) return;
      const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, minutes, 0, 0);
      G.selectedDayISO = iso;
      setAgendaSubtitleForSelectedDay();
      close();
      openApptModal({ mode: "new", row: null, prefillDatetime: dt.toISOString() });
    });
  });

  /* Clique numa marcação → abre feed do doente */
  root.querySelectorAll("[data-week-appt-id]").forEach((el) => {
    el.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      const pid = el.getAttribute("data-week-pid");
      const aid = el.getAttribute("data-week-appt-id");
      if (pid) {
        /* Actualizar dia seleccionado para o dia da marcação */
        const appt = appts.find(a => String(a.id) === String(aid));
        if (appt) {
          const col = appt.start_at || appt.starts_at || appt.start_time || appt.start_datetime || appt.start;
          if (col) {
            G.selectedDayISO = String(col).slice(0, 10);
            setAgendaSubtitleForSelectedDay();
            await refreshAgenda();
          }
        }
        close();
        await openPatientFeedFromAny({ id: pid });
      } else if (aid) {
        const appt = appts.find(a => String(a.id) === String(aid));
        if (appt) { close(); openApptModal({ mode: "edit", row: appt }); }
      }
    });
  });
}


/* ==== 09A — Helpers GCAL + datas/horas ==== */

/* ---- 09A.1 — closeModal ---- */
export function closeModal() { closeModalRoot(); }

/* ---- 09A.2 — calcEndFromStartAndDuration ---- */
function calcEndFromStartAndDuration(startLocalStr, durMin) {
  const s = fromLocalInputValue(startLocalStr);
  if (!s || isNaN(s.getTime())) return null;
  const e = new Date(s.getTime() + durMin * 60000);
  return { startAt: s.toISOString(), endAt: e.toISOString() };
}

/* ---- 09A.3 — makeAutoTitle ---- */
function makeAutoTitle(patientName, procType) {
  const n = (patientName || "").trim();
  const p = (procType    || "").trim();
  if (!n) return null;
  if (!p || p === "—") return n;
  return `${n} — ${p}`;
}

/* ---- 09A.4 — __gcGetGcalSyncDayUrl ---- */
function __gcGetGcalSyncDayUrl() {
  return `${GCAL_WORKER_URL}/sync-day`;
}

/* ---- 09A.5/6/7/8 — GCAL sync ---- */
function __gcNormalizeDayISO(v) {
  const d = String(v || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : "";
}
function __gcUniqueDays(days) {
  return Array.from(new Set((days || []).map(__gcNormalizeDayISO).filter(Boolean)));
}
export function __gcFireSyncDay(dayISO) { __gcFireSyncDays([dayISO]); }
export function __gcFireSyncDays(dayISOs) {
  try {
    const url  = __gcGetGcalSyncDayUrl();
    const days = __gcUniqueDays(dayISOs);
    if (!url || !days.length || !window.sb?.auth) return;

    window.sb.auth.getSession().then(({ data, error }) => {
      if (error || !data?.session?.access_token) return;
      const token = data.session.access_token;
      days.forEach((d) => {
        fetch(url, {
          method: "POST", keepalive: true,
          headers: { "content-type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({ dayISO: d }),
        })
          .then(async (r) => {
            if (!r.ok) { const txt = await r.text().catch(() => ""); console.warn("[GCAL] sync-day falhou:", d, r.status, txt); return; }
            console.log("[GCAL] sync ok dayISO=", d);
          })
          .catch((e) => console.warn("[GCAL] sync-day erro:", d, e?.message || e));
      });
    });
  } catch (e) { console.warn("[GCAL] sync-day exceção:", e?.message || e); }
}

/* ---- 09A.9–14 — Helpers de data/hora para bloqueios ---- */
function __gcPad2(n) { return String(n).padStart(2, "0"); }
function __gcToDateInput(d) {
  try { const x = (d instanceof Date) ? d : new Date(d); if (!x || isNaN(x.getTime())) return ""; return `${x.getFullYear()}-${__gcPad2(x.getMonth()+1)}-${__gcPad2(x.getDate())}`; } catch (_) { return ""; }
}
function __gcToTimeInput(d) {
  try { const x = (d instanceof Date) ? d : new Date(d); if (!x || isNaN(x.getTime())) return ""; return `${__gcPad2(x.getHours())}:${__gcPad2(x.getMinutes())}`; } catch (_) { return ""; }
}
function __gcLocalDateTimeToIso(dateYYYYMMDD, timeHHMM) {
  if (!dateYYYYMMDD) return null;
  const d = new Date(`${dateYYYYMMDD}T${timeHHMM || "00:00"}:00`);
  return isNaN(d.getTime()) ? null : d.toISOString();
}
function __gcAddDaysYYYYMMDD(dateYYYYMMDD, add) {
  try { const d = new Date(`${dateYYYYMMDD}T00:00:00`); if (isNaN(d.getTime())) return dateYYYYMMDD; d.setDate(d.getDate() + Number(add || 0)); return __gcToDateInput(d); } catch (_) { return dateYYYYMMDD; }
}
function __gcCmpYYYYMMDD(a, b) {
  if (!a || !b) return 0; if (a < b) return -1; if (a > b) return 1; return 0;
}


/* ==== 09B — Transferência automática de doente entre clínicas ==== */

async function fetchPatientIdentifiers(patientId) {
  try {
    const { data, error } = await window.sb.from("patients").select("full_name,sns,nif,passport_id,phone,dob").eq("id", patientId).limit(1);
    if (error) throw error;
    return (data?.length) ? data[0] : null;
  } catch (e) { console.warn("fetchPatientIdentifiers falhou:", e); return null; }
}

async function fetchActiveClinicForPatient(patientId) {
  try {
    const { data, error } = await window.sb.from("patient_clinic").select("clinic_id,is_active").eq("patient_id", patientId).eq("is_active", true).limit(1);
    if (error) throw error;
    return (data?.length) ? (data[0].clinic_id || null) : null;
  } catch (e) { console.warn("fetchActiveClinicForPatient falhou:", e); return null; }
}

function buildTransferConfirmText({ patient, fromClinicName, toClinicName }) {
  const name   = (patient?.full_name || "").trim() || "—";
  const idLine = [
    patient?.sns          ? `SNS: ${patient.sns}`          : "",
    patient?.nif          ? `NIF: ${patient.nif}`          : "",
    patient?.phone        ? `Tel: ${patient.phone}`        : "",
    patient?.passport_id  ? `ID: ${patient.passport_id}`   : "",
    patient?.dob          ? `DN: ${patient.dob}`           : "",
  ].filter(Boolean).join("  |  ");

  return [
    "Confirme que é o doente correto:",
    name,
    idLine,
    "",
    `Este doente está ativo em: ${fromClinicName || "—"}`,
    `Pretende transferir para: ${toClinicName || "—"} ?`,
    "",
    "(Isto atualiza automaticamente a clínica ativa do doente.)",
  ].join("\n");
}

export async function ensurePatientActiveInClinic({ patientId, targetClinicId }) {
  const pid = String(patientId || "");
  const cid = String(targetClinicId || "");
  if (!pid || !cid) throw new Error("ensurePatientActiveInClinic: patientId/targetClinicId em falta.");

  const prevActiveClinicId = await fetchActiveClinicForPatient(pid);
  if (prevActiveClinicId && String(prevActiveClinicId) === cid) return true;

  async function ensureRowExistsInactive(pId, cId) {
    const { data: exist, error: e0 } = await window.sb.from("patient_clinic").select("clinic_id").eq("patient_id", pId).eq("clinic_id", cId).limit(1);
    if (e0) throw e0;
    if (exist?.length) return true;
    const { error: eIns } = await window.sb.from("patient_clinic").insert({ patient_id: pId, clinic_id: cId, is_active: false });
    if (eIns) throw eIns;
    return true;
  }

  async function setActiveClinic(pId, cId) {
    await ensureRowExistsInactive(pId, cId);
    const { error: eOff } = await window.sb.from("patient_clinic").update({ is_active: false }).eq("patient_id", pId).eq("is_active", true);
    if (eOff) throw eOff;
    const { error: eOn } = await window.sb.from("patient_clinic").update({ is_active: true }).eq("patient_id", pId).eq("clinic_id", cId);
    if (eOn) throw eOn;
    const nowActive = await fetchActiveClinicForPatient(pId);
    if (!nowActive || String(nowActive) !== String(cId)) throw new Error("Falha ao ativar clínica destino (validação falhou).");
    return true;
  }

  try {
    await setActiveClinic(pid, cid);
    return true;
  } catch (e) {
    try { if (prevActiveClinicId) await setActiveClinic(pid, String(prevActiveClinicId)); } catch (_) {}
    throw e;
  }
}

async function maybeTransferPatientToClinic({ patientId, targetClinicId }) {
  const activeClinicId = await fetchActiveClinicForPatient(patientId);
  if (!activeClinicId) return { changed: false, noActive: true };
  if (String(activeClinicId) === String(targetClinicId)) return { changed: false };

  const fromClinicName = G.clinicsById?.[activeClinicId]
    ? (G.clinicsById[activeClinicId].name || G.clinicsById[activeClinicId].slug || activeClinicId)
    : activeClinicId;
  const toClinicName = G.clinicsById?.[targetClinicId]
    ? (G.clinicsById[targetClinicId].name || G.clinicsById[targetClinicId].slug || targetClinicId)
    : targetClinicId;

  const patient = await fetchPatientIdentifiers(patientId);
  const ok = confirm(buildTransferConfirmText({ patient, fromClinicName, toClinicName }));
  if (!ok) return { changed: false, cancelled: true };

  await ensurePatientActiveInClinic({ patientId, targetClinicId });
  return { changed: true };
}


/* ==== 09C/D/E — Modal marcação ==== */

/* ---- openApptModal ---- */
export function openApptModal({ mode, row, prefillDatetime }) {
  const root = document.getElementById("modalRoot");
  if (!root) return;

  const isEdit          = mode === "edit";
  const selClinic       = document.getElementById("selClinic");
  const defaultClinicId = isEdit && row?.clinic_id
    ? row.clinic_id
    : selClinic?.value || (G.clinics.length === 1 ? G.clinics[0].id : "");

  const selectedDayStart = parseISODateToLocalStart(G.selectedDayISO) || new Date();
  const startBase = prefillDatetime
    ? new Date(prefillDatetime)
    : new Date(selectedDayStart.getFullYear(), selectedDayStart.getMonth(), selectedDayStart.getDate(), 9, 0, 0, 0);
  const startInit  = isEdit && row?.start_at ? new Date(row.start_at) : startBase;
  const endInit    = isEdit && row?.end_at   ? new Date(row.end_at)   : new Date(startInit.getTime() + 20 * 60000);
  const durInit    = Math.max(5, Math.round((endInit.getTime() - startInit.getTime()) / 60000));
  const durationBest = DURATION_OPTIONS.includes(durInit) ? durInit : 20;

  const procInit      = isEdit ? (row.procedure_type ?? "") : "";
  const statusRaw     = isEdit ? (row.status ?? "scheduled") : "scheduled";
  const statusNorm    = String(statusRaw).toLowerCase() === "cancelled" ? "no_show" : String(statusRaw || "scheduled").toLowerCase();
  const statusInit    = STATUS_OPTIONS.map((x) => String(x).toLowerCase()).includes(statusNorm) ? statusNorm : "scheduled";
  const patientIdInit = isEdit ? (row.patient_id ?? "") : "";
  const titleInit     = isEdit ? (row.title  ?? "") : "";
  const notesInit     = isEdit ? (row.notes  ?? "") : "";
  const _procList   = (G.procedureTypes?.length ? G.procedureTypes : PROCEDURE_OPTIONS);
  const procIsOther   = procInit && !_procList.includes(procInit);
  const procSelectValue  = procIsOther ? "Outro" : (procInit || "");
  const apptModeInit     = isEdit ? String(row?.mode || "presencial").toLowerCase() : "presencial";
  const isSuperadmin     = !!window.__GC_IS_SUPERADMIN__;
  const isDoctor         = ["medico","super_admin","admin"].includes(String(G.role || "").toLowerCase());
  const canCreateBlocks  = isSuperadmin || isDoctor;
  const isBlockEdit      = isEdit && String(row?.mode || "").toLowerCase() === "bloqueio";
  const canDeleteAppt    = !!(isEdit && row?.id && !isBlockEdit);

  function optLabel(s) { const m = statusMeta(s); return `${m.icon} ${m.label}`; }

  const bDateFromInit = __gcToDateInput(startInit);
  const bDateToInit   = __gcToDateInput(startInit);
  const bTimeFromInit = __gcToTimeInput(startInit);
  const bTimeToInit   = __gcToTimeInput(endInit);

  /* ── label de data formatada para o subtítulo do modal ── */
  const __modalDayLabel = (() => {
    try {
      const d = parseISODateToLocalStart(G.selectedDayISO);
      if (!d) return G.selectedDayISO || "";
      const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
      const WDAYS  = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
      return `${WDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    } catch (_) { return G.selectedDayISO || ""; }
  })();
  const __modalClinicLabel = (() => {
    try {
      const cid = defaultClinicId;
      if (!cid) return "";
      const c = G.clinicsById?.[cid];
      return c ? (c.name || c.slug || "") : "";
    } catch (_) { return ""; }
  })();

  root.innerHTML = `
    <div id="modalOverlay" style="position:fixed;inset:0;background:rgba(15,45,82,0.3);display:flex;align-items:center;justify-content:center;padding:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
      <div style="background:#fff;width:min(680px,100%);border-radius:14px;border:1px solid #e2e8f0;box-shadow:0 4px 24px rgba(15,45,82,0.1);max-height:92vh;display:flex;flex-direction:column;overflow:hidden;">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:14px 18px 12px;border-bottom:1px solid #f1f5f9;">
          <div>
            <div style="font-size:16px;font-weight:700;color:#0f2d52;letter-spacing:-0.01em;">
              ${isBlockEdit ? "Editar bloqueio" : (isEdit ? "Editar marcação" : "Nova marcação")}
            </div>
            <div style="font-size:11px;color:#64748b;margin-top:3px;">${escapeHtml(__modalDayLabel)}${__modalClinicLabel ? ` · ${escapeHtml(__modalClinicLabel)}` : ""}</div>
          </div>
          <button id="btnCloseModal" class="gcBtnGhost" style="flex-shrink:0;">✕</button>
        </div>
        <div style="padding:14px 18px 0;display:flex;flex-direction:column;gap:12px;flex:1;overflow-y:auto;">

          <div style="display:flex;flex-direction:column;gap:4px;">
            <label style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;">Ação</label>
            <select id="mMode" class="gcSelect" style="padding:7px 10px;border-radius:8px;border:1px solid #e2e8f0;font-size:13px;font-family:inherit;color:#1e293b;">
              <option value="presencial">Agendar consulta</option>
              ${canCreateBlocks ? `<option value="bloqueio">Realizar bloqueio</option>` : ""}
            </select>
            ${!canCreateBlocks ? `<div style="font-size:11px;color:#94a3b8;margin-top:2px;">Bloqueios: apenas médico/superadmin.</div>` : ""}
          </div>

        <div id="mBlockOnlyWrap" style="display:none;margin-top:14px;border:1px solid #eee;border-radius:14px;padding:14px;background:#fafafa;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
            <div style="font-weight:900;font-size:${UI.fs13}px;">Bloqueio</div>
            ${isBlockEdit ? `<button id="btnDeleteBlock" class="gcBtnDanger" type="button">Apagar bloqueio</button>` : ""}
          </div>
          <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;">
            <button id="btnBlockDay" class="gcBtnOutline" type="button">Bloquear dia</button>
            <button id="btnBlockPeriod" class="gcBtnOutline" type="button">Bloquear período</button>
          </div>
          <div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;align-items:end;">
            <div style="display:flex;flex-direction:column;gap:4px;"><label style="font-size:${UI.fs12}px;color:#666;">Datas De</label><input id="bDateFrom" type="date" style="padding:10px 12px;border-radius:10px;border:1px solid #ddd;font-size:${UI.fs13}px;" /></div>
            <div style="display:flex;flex-direction:column;gap:4px;"><label style="font-size:${UI.fs12}px;color:#666;">Até</label><input id="bDateTo" type="date" style="padding:10px 12px;border-radius:10px;border:1px solid #ddd;font-size:${UI.fs13}px;" /></div>
            <div style="display:flex;flex-direction:column;gap:4px;"><label style="font-size:${UI.fs12}px;color:#666;">Das</label><input id="bTimeFrom" type="time" step="60" style="padding:10px 12px;border-radius:10px;border:1px solid #ddd;font-size:${UI.fs13}px;" /></div>
            <div style="display:flex;flex-direction:column;gap:4px;"><label style="font-size:${UI.fs12}px;color:#666;">Às</label><input id="bTimeTo" type="time" step="60" style="padding:10px 12px;border-radius:10px;border:1px solid #ddd;font-size:${UI.fs13}px;" /></div>
          </div>
          <div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:start;">
            <div style="display:flex;flex-direction:column;gap:4px;">
              <label style="font-size:${UI.fs12}px;color:#666;">Aplicar a</label>
              <select id="bApplyTo" class="gcSelect">
                <option value="selected">Selecionar clínicas</option>
                ${isSuperadmin ? `<option value="global">Todas as clínicas (global)</option>` : ""}
              </select>
              ${!isSuperadmin ? `<div style="font-size:${UI.fs12}px;color:#666;margin-top:4px;">Global: apenas superadmin.</div>` : ""}
            </div>
            <div id="bClinicsWrap" style="display:flex;flex-direction:column;gap:6px;">
              <label style="font-size:${UI.fs12}px;color:#666;">Clínicas</label>
              <div id="bClinicsList" style="border:1px solid #e5e5e5;border-radius:12px;background:#fff;max-height:240px;overflow:auto;padding:8px;"></div>
              <div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;">
                <button id="bSelectAll" class="gcBtn" type="button">Selecionar todas</button>
                <button id="bClearAll" class="gcBtn" type="button">Limpar</button>
              </div>
            </div>
          </div>
        </div>

        <div id="mConsultOnlyWrap" style="display:contents;">
          <div id="mPatientWrap" style="display:flex;flex-direction:column;gap:5px;">
            <label style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;">Doente *</label>
            <div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;">
              <input id="mPatientQuery" type="search" placeholder="Nome, SNS, NIF, telefone…" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" inputmode="search" data-form-type="other" style="padding:7px 10px;border-radius:8px;border:1px solid #e2e8f0;width:100%;font-size:13px;font-family:inherit;color:#1e293b;" />
              <button id="btnNewPatient" class="gcBtnPrimary" style="white-space:nowrap;padding:7px 12px;font-size:12px;font-weight:600;border-radius:8px;">+ Novo doente</button>
            </div>
            <div id="mPatientResults" style="display:none;margin-top:4px;border:1px solid #e2e8f0;border-radius:8px;padding:6px;background:#fff;max-height:200px;overflow:auto;"></div>
            <input type="hidden" id="mPatientId" value="" />
            <input type="hidden" id="mPatientName" value="" />
            <div id="newPatientHost"></div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:2px;">
            <div id="mProcWrap" style="display:flex;flex-direction:column;gap:4px;">
              <label style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;">Tipo de Consulta/Procedimento *</label>
              <select id="mProc" class="gcSelect" style="padding:7px 10px;border-radius:8px;border:1px solid #e2e8f0;font-size:13px;font-family:inherit;color:#1e293b;">
                <option value="">— seleccionar —</option>
                ${_procList.map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("")}
              </select>
            </div>
            <div id="mStatusWrap" style="display:flex;flex-direction:column;gap:4px;">
              <label style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;">Estado</label>
              <select id="mStatus" class="gcSelect" style="padding:7px 10px;border-radius:8px;border:1px solid #e2e8f0;font-size:13px;font-family:inherit;color:#1e293b;">
                ${STATUS_OPTIONS.map((s) => { const val = (s === "cancelled") ? "no_show" : String(s).toLowerCase(); return `<option value="${escapeHtml(val)}">${escapeHtml(optLabel(val))}</option>`; }).join("")}
              </select>
            </div>
            <div style="display:flex;flex-direction:column;gap:4px;">
              <label style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;">Duração (min)</label>
              <select id="mDuration" class="gcSelect" style="padding:7px 10px;border-radius:8px;border:1px solid #e2e8f0;font-size:13px;font-family:inherit;color:#1e293b;">${DURATION_OPTIONS.map((n) => `<option value="${n}">${n}</option>`).join("")}</select>
            </div>
            <div id="mProcOtherWrap" style="display:none;flex-direction:column;gap:4px;grid-column:1 / -1;">
              <label style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;">Outro (texto) *</label>
              <input id="mProcOther" type="text" placeholder="ex.: Ondas de choque" autocomplete="off" autocapitalize="off" spellcheck="false" style="padding:7px 10px;border-radius:8px;border:1px solid #e2e8f0;font-size:13px;font-family:inherit;" />
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:2px;">
            <div style="display:flex;flex-direction:column;gap:4px;">
              <label style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;">Início</label>
              <input id="mStart" type="datetime-local" style="padding:7px 10px;border-radius:8px;border:1px solid #e2e8f0;font-size:13px;font-family:inherit;color:#1e293b;" />
            </div>
            <div style="display:flex;flex-direction:column;gap:4px;">
              <label style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;">Clínica</label>
              <select id="mClinic" class="gcSelect" style="padding:7px 10px;border-radius:8px;border:1px solid #e2e8f0;font-size:13px;font-family:inherit;color:#1e293b;"></select>
            </div>
          </div>
        </div>

          <div style="display:flex;flex-direction:column;gap:4px;">
            <label id="mNotesLabel" style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;">Notas</label>
            <textarea id="mNotes" rows="2" style="padding:7px 10px;border-radius:8px;border:1px solid #e2e8f0;resize:none;font-size:13px;font-family:inherit;color:#1e293b;"></textarea>
          </div>

          <div style="height:14px;flex-shrink:0;"></div>
        </div>
        <div style="padding:10px 18px 12px;border-top:1px solid #f1f5f9;display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;flex-shrink:0;background:#fff;border-radius:0 0 14px 14px;">
          <div id="mMsg" style="font-size:11px;color:#64748b;"></div>
          <div style="display:flex;gap:8px;">
            ${canDeleteAppt ? `<button id="btnDeleteAppt" class="gcBtnDanger" type="button" style="font-size:12px;padding:7px 14px;border-radius:8px;">Registar falta</button>` : ""}
            <button id="btnCancel" class="gcBtnGhost" style="font-size:12px;padding:7px 14px;border-radius:8px;">Cancelar</button>
            <button id="btnSave" class="gcBtnSuccess" style="font-size:12px;padding:7px 18px;border-radius:8px;font-weight:600;">Guardar</button>
          </div>
        </div>
      </div>
    </div>`;

  /* --- refs DOM --- */
  const overlay          = document.getElementById("modalOverlay");
  const btnClose         = document.getElementById("btnCloseModal");
  const btnCancel        = document.getElementById("btnCancel");
  const btnSave          = document.getElementById("btnSave");
  const btnNewPatient    = document.getElementById("btnNewPatient");
  const btnDeleteAppt    = document.getElementById("btnDeleteAppt");
  const mMode            = document.getElementById("mMode");
  const mBlockOnlyWrap   = document.getElementById("mBlockOnlyWrap");
  const btnDeleteBlock   = document.getElementById("btnDeleteBlock");
  const btnBlockDay      = document.getElementById("btnBlockDay");
  const btnBlockPeriod   = document.getElementById("btnBlockPeriod");
  const bDateFrom        = document.getElementById("bDateFrom");
  const bDateTo          = document.getElementById("bDateTo");
  const bTimeFrom        = document.getElementById("bTimeFrom");
  const bTimeTo          = document.getElementById("bTimeTo");
  const bApplyTo         = document.getElementById("bApplyTo");
  const bClinicsWrap     = document.getElementById("bClinicsWrap");
  const bClinicsList     = document.getElementById("bClinicsList");
  const bSelectAll       = document.getElementById("bSelectAll");
  const bClearAll        = document.getElementById("bClearAll");
  const mConsultOnlyWrap = document.getElementById("mConsultOnlyWrap");
  const mClinic          = document.getElementById("mClinic");
  const mStatus          = document.getElementById("mStatus");
  const mStart           = document.getElementById("mStart");
  const mDuration        = document.getElementById("mDuration");
  const mProc            = document.getElementById("mProc");
  const mProcOtherWrap   = document.getElementById("mProcOtherWrap");
  const mProcOther       = document.getElementById("mProcOther");
  const mNotes           = document.getElementById("mNotes");
  const mNotesLabel      = document.getElementById("mNotesLabel");
  const mMsg             = document.getElementById("mMsg");
  const mPatientQuery    = document.getElementById("mPatientQuery");
  const mPatientResults  = document.getElementById("mPatientResults");
  const mPatientId       = document.getElementById("mPatientId");
  const mPatientName     = document.getElementById("mPatientName");

  let _cleanupFns = [];
  function addCleanup(fn) { if (typeof fn === "function") _cleanupFns.push(fn); }
  function runCleanup() { const fns = _cleanupFns; _cleanupFns = []; fns.forEach((fn) => { try { fn(); } catch (_) {} }); }
  function safeCloseModal() { runCleanup(); closeModal(); }

  /* preencher select clínica */
  if (mClinic) {
    mClinic.innerHTML = G.clinics.map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name || c.slug || c.id)}</option>`).join("");
    if (defaultClinicId) mClinic.value = defaultClinicId;
    if (G.clinics.length === 1) mClinic.disabled = true;
  }

  if (mStatus)   mStatus.value   = statusInit;
  if (mStart)    mStart.value    = toLocalInputValue(startInit);
  if (mDuration) mDuration.value = String(durationBest);
  if (mProc)     mProc.value     = procSelectValue;
  if (mNotes)    mNotes.value    = notesInit;

  let __blockMode = "period";
  const __selectedClinicIds = new Set();
  if (defaultClinicId) __selectedClinicIds.add(String(defaultClinicId));

  function __renderClinicsChecklist() {
    if (!bClinicsList) return;
    bClinicsList.innerHTML = (G.clinics || []).map((c) => {
      const cid     = String(c.id);
      const label   = c.name || c.slug || c.id;
      const checked = __selectedClinicIds.has(cid) ? "checked" : "";
      return `<label style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;cursor:pointer;"><input type="checkbox" data-b-cid="${escapeHtml(cid)}" ${checked} /><span style="font-weight:800;color:#111;">${escapeHtml(label)}</span></label>`;
    }).join("");
    bClinicsList.querySelectorAll("input[type='checkbox'][data-b-cid]").forEach((cb) => {
      cb.addEventListener("change", () => {
        const cid = cb.getAttribute("data-b-cid");
        if (!cid) return;
        if (cb.checked) __selectedClinicIds.add(String(cid));
        else __selectedClinicIds.delete(String(cid));
      });
    });
  }

  function __applyBlockModeUi() {
    if (!bDateFrom || !bDateTo || !bTimeFrom || !bTimeTo) return;
    if (__blockMode === "day") {
      bTimeFrom.value = "00:00"; bTimeTo.value = "23:59";
      if (btnBlockDay)    btnBlockDay.style.fontWeight    = "900";
      if (btnBlockPeriod) btnBlockPeriod.style.fontWeight = "700";
    } else {
      if (btnBlockDay)    btnBlockDay.style.fontWeight    = "700";
      if (btnBlockPeriod) btnBlockPeriod.style.fontWeight = "900";
    }
  }

  if (bDateFrom) bDateFrom.value = bDateFromInit;
  if (bDateTo)   bDateTo.value   = bDateToInit;
  if (bTimeFrom) bTimeFrom.value = bTimeFromInit || "09:00";
  if (bTimeTo)   bTimeTo.value   = bTimeToInit   || "09:20";

  __renderClinicsChecklist();
  __applyBlockModeUi();

  bSelectAll?.addEventListener("click",  (ev) => { ev.preventDefault(); (G.clinics || []).forEach((c) => __selectedClinicIds.add(String(c.id))); __renderClinicsChecklist(); });
  bClearAll?.addEventListener("click",   (ev) => { ev.preventDefault(); __selectedClinicIds.clear(); __renderClinicsChecklist(); });
  btnBlockDay?.addEventListener("click", (ev) => { ev.preventDefault(); __blockMode = "day";    __applyBlockModeUi(); });
  btnBlockPeriod?.addEventListener("click", (ev) => { ev.preventDefault(); __blockMode = "period"; __applyBlockModeUi(); });

  bApplyTo?.addEventListener("change", () => {
    const v = String(bApplyTo.value || "selected").toLowerCase();
    if (bClinicsWrap) bClinicsWrap.style.display = (v === "global") ? "none" : "flex";
  });
  if (bClinicsWrap) bClinicsWrap.style.display = String(bApplyTo?.value || "selected").toLowerCase() === "global" ? "none" : "flex";

  btnDeleteBlock?.addEventListener("click", async (ev) => {
    ev.preventDefault();
    if (!isBlockEdit || !row?.id) return;
    if (!confirm("Apagar este bloqueio?")) return;
    try {
      const { error } = await window.sb.from("appointments").update({ appt_status: "no_show" }).eq("id", row.id);
      if (error) throw error;
      safeCloseModal();
      await refreshAgenda();
      __gcFireSyncDay(String(row.start_at || G.selectedDayISO || "").slice(0, 10));
    } catch (e) { console.error(e); alert("Erro ao apagar bloqueio. Vê a consola para detalhe."); }
  });

  if (mMode) {
    mMode.value = apptModeInit;
    if (isEdit && apptModeInit === "bloqueio" && !canCreateBlocks) mMode.disabled = true;
  }

  /* --- pesquisa doente (modal) --- */
  function setSelectedPatient({ id, name }) {
    if (mPatientId)   mPatientId.value   = id   || "";
    if (mPatientName) mPatientName.value = name || "";
  }
  function closeResults() { if (!mPatientResults) return; mPatientResults.style.display = "none"; mPatientResults.innerHTML = ""; }
  function showResultsLoading() { if (!mPatientResults) return; mPatientResults.style.display = "block"; mPatientResults.innerHTML = `<div style="font-size:${UI.fs12}px;color:#666;">A pesquisar…</div>`; }
  function showResultsEmpty()   { if (!mPatientResults) return; mPatientResults.style.display = "block"; mPatientResults.innerHTML = `<div style="font-size:${UI.fs12}px;color:#666;">Sem resultados.</div>`; }
  function showResultsError()   { if (!mPatientResults) return; mPatientResults.style.display = "block"; mPatientResults.innerHTML = `<div style="font-size:${UI.fs12}px;color:#b00020;">Erro na pesquisa. Vê a consola.</div>`; }

  function showResultsList(pts) {
    if (!mPatientResults) return;
    const modalClinicId = mClinic?.value || null;
    mPatientResults.style.display = "block";
    mPatientResults.innerHTML = (pts || []).map((p) => {
      const idBits = [];
      if (p.sns)         idBits.push(`SNS:${p.sns}`);
      if (p.nif)         idBits.push(`NIF:${p.nif}`);
      if (p.passport_id) idBits.push(`ID:${p.passport_id}`);
      const line2 = [idBits.join(" / "), p.phone ? `Tel:${p.phone}` : ""].filter(Boolean).join(" • ");

      const isOther   = p.active_clinic_id && modalClinicId && p.active_clinic_id !== modalClinicId;
      const otherName = isOther ? (G.clinicsById?.[p.active_clinic_id]?.name || G.clinicsById?.[p.active_clinic_id]?.display_name || "Outra clínica") : null;
      const badge     = isOther ? `<span style="font-size:10px;font-weight:700;background:#fef3c7;color:#92400e;border-radius:4px;padding:1px 6px;margin-left:6px;">↗ ${escapeHtml(otherName)}</span>` : "";
      const bg        = isOther ? "background:#fffbeb;border:1px solid #fcd34d;" : "border:1px solid #f0f0f0;";

      return `
        <div data-pid="${escapeHtml(p.id)}" data-pname="${escapeHtml(p.full_name)}"
             data-other-clinic="${isOther ? escapeHtml(p.active_clinic_id) : ""}"
             style="padding:8px;${bg}border-radius:10px;margin-bottom:8px;cursor:pointer;">
          <div style="font-size:${UI.fs13}px;color:#111;font-weight:800;white-space:normal;overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(p.full_name)}${badge}</div>
          <div style="font-size:${UI.fs12}px;color:#666;">${escapeHtml(line2 || "—")}</div>
        </div>`;
    }).join("");
    mPatientResults.querySelectorAll("[data-pid]").forEach((el) => {
      el.addEventListener("click", async () => {
        const pid          = el.getAttribute("data-pid");
        const pname        = el.getAttribute("data-pname");
        const otherClinic  = el.getAttribute("data-other-clinic");
        if (otherClinic && modalClinicId) {
          const fromName = G.clinicsById?.[otherClinic]?.name || G.clinicsById?.[otherClinic]?.display_name || otherClinic;
          const toName   = G.clinicsById?.[modalClinicId]?.name || G.clinicsById?.[modalClinicId]?.display_name || modalClinicId;
          const ok = confirm(`"${pname}" está activo em: ${fromName}\n\nTransferir para: ${toName}?`);
          if (!ok) return;
          try {
            await ensurePatientActiveInClinic({ patientId: pid, targetClinicId: modalClinicId });
          } catch (e) {
            alert("Erro ao transferir doente: " + (e?.message || e));
            return;
          }
        }
        setSelectedPatient({ id: pid, name: pname });
        if (mPatientQuery) mPatientQuery.value = pname || "";
        closeResults();
      });
    });
  }

  if (patientIdInit) {
    const displayName = titleInit ? String(titleInit).split(" — ")[0] : "";
    setSelectedPatient({ id: patientIdInit, name: displayName || `ID: ${patientIdInit}` });
    if (mPatientQuery) mPatientQuery.value = displayName || "";
  } else {
    setSelectedPatient({ id: "", name: "" });
  }

  function updateProcOtherVisibility() {
    const show = mProc?.value === "Outro";
    if (mProcOtherWrap) mProcOtherWrap.style.display = show ? "flex" : "none";
    if (!show && mProcOther) mProcOther.value = "";
  }
  mProc?.addEventListener("change", updateProcOtherVisibility);
  updateProcOtherVisibility();
  if (procIsOther && mProcOther) {
    mProcOther.value = procInit === "Outro" ? "" : procInit;
    if (mProcOtherWrap) mProcOtherWrap.style.display = "flex";
  }

  function applyModeUi() {
    const isBlock = String(mMode?.value || "presencial").toLowerCase() === "bloqueio";
    if (mBlockOnlyWrap)   mBlockOnlyWrap.style.display   = isBlock ? "block" : "none";
    if (mConsultOnlyWrap) mConsultOnlyWrap.style.display = isBlock ? "none"  : "block";
    if (mNotesLabel) mNotesLabel.textContent = isBlock ? "Motivo do bloqueio (opcional)" : "Notas";
    if (isBlock) {
      setSelectedPatient({ id: "", name: "" });
      if (mPatientQuery) mPatientQuery.value = "";
      closeResults();
      const host = document.getElementById("newPatientHost");
      if (host) host.innerHTML = "";
    }
  }
  applyModeUi();
  mMode?.addEventListener("change", applyModeUi);

  let searchTimer = null;
  async function runSearch() {
    const vMode    = String(mMode?.value || "presencial").toLowerCase();
    if (vMode === "bloqueio") return;
    const clinicId = mClinic?.value || "";
    const term     = (mPatientQuery?.value || "").trim();
    if (!term || term.length < 2 || !clinicId) { closeResults(); return; }
    showResultsLoading();
    try {
      const pts = await searchPatientsScoped({ clinicId, q: term, limit: 30 });
      if (!pts || pts.length === 0) { showResultsEmpty(); return; }
      showResultsList(pts);
    } catch (e) { console.error("Pesquisa doente (modal) falhou:", e); showResultsError(); }
  }
  function scheduleSearch() { if (searchTimer) clearTimeout(searchTimer); searchTimer = setTimeout(runSearch, 250); }

  function onDocMouseDown(ev) {
    const t = ev.target;
    const inInput   = mPatientQuery   && (t === mPatientQuery   || t?.closest?.("#mPatientQuery"));
    const inResults = mPatientResults && (t === mPatientResults || t?.closest?.("#mPatientResults"));
    if (!inInput && !inResults) closeResults();
  }
  document.addEventListener("mousedown", onDocMouseDown);
  addCleanup(() => document.removeEventListener("mousedown", onDocMouseDown));

  function openNewPatientForm() {
    const clinicId = mClinic?.value || "";
    if (!clinicId) { mMsg.style.color = "#b00020"; mMsg.textContent = "Seleciona a clínica antes de criar doente."; return; }
    const host = document.getElementById("newPatientHost");
    if (!host) { mMsg.style.color = "#b00020"; mMsg.textContent = "Falha UI: newPatientHost não encontrado."; return; }

    host.innerHTML = `
      <div id="subNewPatient" style="border:1px solid #eee;border-radius:12px;padding:12px;background:#fafafa;">
        <div style="font-size:${UI.fs13}px;font-weight:900;color:#111;">Novo doente</div>
        <div style="font-size:${UI.fs12}px;color:#666;margin-top:4px;">Nome obrigatório. Identificação: SNS (9 dígitos) ou NIF (9 dígitos) ou Passaporte/ID (4–20 alfanum).</div>
        <div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div style="display:flex;flex-direction:column;gap:4px;"><label style="font-size:${UI.fs12}px;color:#666;">Nome completo *</label><input id="npFullName" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" style="padding:10px 12px;border-radius:10px;border:1px solid #ddd;font-size:${UI.fs13}px;" /></div>
          <div style="display:flex;flex-direction:column;gap:4px;"><label style="font-size:${UI.fs12}px;color:#666;">Data nascimento</label><input id="npDob" type="date" style="padding:10px 12px;border-radius:10px;border:1px solid #ddd;font-size:${UI.fs13}px;" /></div>
          <div style="display:flex;flex-direction:column;gap:4px;"><label style="font-size:${UI.fs12}px;color:#666;">Telefone</label><input id="npPhone" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" style="padding:10px 12px;border-radius:10px;border:1px solid #ddd;font-size:${UI.fs13}px;" /></div>
          <div style="display:flex;flex-direction:column;gap:4px;"><label style="font-size:${UI.fs12}px;color:#666;">Email</label><input id="npEmail" type="email" autocomplete="off" autocapitalize="off" spellcheck="false" style="padding:10px 12px;border-radius:10px;border:1px solid #ddd;font-size:${UI.fs13}px;" /></div>
          <div style="display:flex;flex-direction:column;gap:4px;"><label style="font-size:${UI.fs12}px;color:#666;">SNS (9 dígitos)</label><input id="npSNS" type="text" inputmode="numeric" placeholder="#########" autocomplete="off" style="padding:10px 12px;border-radius:10px;border:1px solid #ddd;font-size:${UI.fs13}px;" /></div>
          <div style="display:flex;flex-direction:column;gap:4px;"><label style="font-size:${UI.fs12}px;color:#666;">NIF (9 dígitos)</label><input id="npNIF" type="text" inputmode="numeric" placeholder="#########" autocomplete="off" style="padding:10px 12px;border-radius:10px;border:1px solid #ddd;font-size:${UI.fs13}px;" /></div>
          <div style="display:flex;flex-direction:column;gap:4px;"><label style="font-size:${UI.fs12}px;color:#666;">Passaporte/ID (4–20)</label><input id="npPassport" type="text" placeholder="AB123456" autocomplete="off" autocapitalize="off" spellcheck="false" style="padding:10px 12px;border-radius:10px;border:1px solid #ddd;font-size:${UI.fs13}px;" /></div>
          <div style="display:flex;flex-direction:column;gap:4px;"><label style="font-size:${UI.fs12}px;color:#666;">Seguro</label><input id="npInsuranceProvider" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" style="padding:10px 12px;border-radius:10px;border:1px solid #ddd;font-size:${UI.fs13}px;" /></div>
          <div style="display:flex;flex-direction:column;gap:4px;"><label style="font-size:${UI.fs12}px;color:#666;">Apólice</label><input id="npInsurancePolicy" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" style="padding:10px 12px;border-radius:10px;border:1px solid #ddd;font-size:${UI.fs13}px;" /></div>
          <div style="grid-column:1 / -1;display:flex;flex-direction:column;gap:4px;"><label style="font-size:${UI.fs12}px;color:#666;">Morada</label><input id="npAddress1" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" style="padding:10px 12px;border-radius:10px;border:1px solid #ddd;font-size:${UI.fs13}px;" /></div>
          <div style="display:flex;flex-direction:column;gap:4px;"><label style="font-size:${UI.fs12}px;color:#666;">Código-postal</label><input id="npPostal" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" style="padding:10px 12px;border-radius:10px;border:1px solid #ddd;font-size:${UI.fs13}px;" /></div>
          <div style="display:flex;flex-direction:column;gap:4px;"><label style="font-size:${UI.fs12}px;color:#666;">Cidade</label><input id="npCity" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" style="padding:10px 12px;border-radius:10px;border:1px solid #ddd;font-size:${UI.fs13}px;" /></div>
          <div style="display:flex;flex-direction:column;gap:4px;"><label style="font-size:${UI.fs12}px;color:#666;">País</label><input id="npCountry" type="text" value="PT" autocomplete="off" autocapitalize="off" spellcheck="false" style="padding:10px 12px;border-radius:10px;border:1px solid #ddd;font-size:${UI.fs13}px;" /></div>
          <div style="grid-column:1 / -1;display:flex;flex-direction:column;gap:4px;"><label style="font-size:${UI.fs12}px;color:#666;">Notas</label><textarea id="npNotes" rows="2" style="padding:10px 12px;border-radius:10px;border:1px solid #ddd;resize:vertical;font-size:${UI.fs13}px;"></textarea></div>
        </div>
        <div style="margin-top:10px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
          <div id="npMsg" style="font-size:${UI.fs12}px;color:#666;"></div>
          <div style="display:flex;gap:10px;">
            <button id="npCancel" class="gcBtn">Fechar</button>
            <button id="npCreate" class="gcBtn" style="font-weight:900;">Criar doente</button>
          </div>
        </div>
      </div>`;

    const npFullName          = document.getElementById("npFullName");
    const npDob               = document.getElementById("npDob");
    const npPhone             = document.getElementById("npPhone");
    const npEmail             = document.getElementById("npEmail");
    const npSNS               = document.getElementById("npSNS");
    const npNIF               = document.getElementById("npNIF");
    const npPassport          = document.getElementById("npPassport");
    const npInsuranceProvider = document.getElementById("npInsuranceProvider");
    const npInsurancePolicy   = document.getElementById("npInsurancePolicy");
    const npAddress1          = document.getElementById("npAddress1");
    const npPostal            = document.getElementById("npPostal");
    const npCity              = document.getElementById("npCity");
    const npCountry           = document.getElementById("npCountry");
    const npNotes             = document.getElementById("npNotes");
    const npMsg               = document.getElementById("npMsg");
    const npCancel            = document.getElementById("npCancel");
    const npCreate            = document.getElementById("npCreate");

    function setErr(msg)  { npMsg.style.color = "#b00020"; npMsg.textContent = msg; }
    function setInfo(msg) { npMsg.style.color = "#666";    npMsg.textContent = msg; }

    function validate() {
      const fullName = (npFullName.value || "").trim();
      if (!fullName) return { ok: false, msg: "Nome completo é obrigatório." };
      const sns  = normalizeDigits(npSNS.value);
      const nif  = normalizeDigits(npNIF.value);
      const pass = (npPassport.value || "").trim();
      if (sns  && !/^[0-9]{9}$/.test(sns))           return { ok: false, msg: "SNS inválido: tem de ter 9 dígitos." };
      if (nif  && !/^[0-9]{9}$/.test(nif))           return { ok: false, msg: "NIF inválido: tem de ter 9 dígitos." };
      if (pass && !/^[A-Za-z0-9]{4,20}$/.test(pass)) return { ok: false, msg: "Passaporte/ID inválido: 4–20 alfanum." };
      if (!sns && !nif && !pass)                      return { ok: false, msg: "Identificação obrigatória: SNS ou NIF ou Passaporte/ID." };
      return {
        ok: true, full_name: fullName,
        dob:                    npDob.value               || null,
        phone:                  npPhone.value?.trim()     || null,
        email:                  npEmail.value?.trim()     || null,
        sns: sns || null, nif: nif || null, passport_id: pass || null,
        insurance_provider:      npInsuranceProvider.value?.trim() || null,
        insurance_policy_number: npInsurancePolicy.value?.trim()   || null,
        address_line1:           npAddress1.value?.trim() || null,
        postal_code:             npPostal.value?.trim()   || null,
        city:                    npCity.value?.trim()     || null,
        country:                 npCountry.value?.trim()  || "PT",
        notes:                   npNotes.value?.trim()    || null,
      };
    }

    function refreshButtonState() {
      if (npSNS) { const d = normalizeDigits(npSNS.value); if (npSNS.value !== d) npSNS.value = d; }
      if (npNIF) { const d = normalizeDigits(npNIF.value); if (npNIF.value !== d) npNIF.value = d; }
      const v = validate();
      if (!v.ok) { npCreate.disabled = true;  setErr(v.msg); }
      else       { npCreate.disabled = false; setInfo("OK para criar."); }
    }

    [npFullName, npDob, npPhone, npEmail, npSNS, npNIF, npPassport, npInsuranceProvider, npInsurancePolicy, npAddress1, npPostal, npCity, npCountry, npNotes]
      .forEach((el) => { if (!el) return; el.addEventListener("input", refreshButtonState); el.addEventListener("change", refreshButtonState); });

    npCancel.addEventListener("click", () => { host.innerHTML = ""; });

    npCreate.addEventListener("click", async () => {
      const v = validate();
      if (!v.ok) { setErr(v.msg); return; }
      npCreate.disabled = true;
      setInfo("A criar…");
      try {
        const newPatientId = await rpcCreatePatientForClinic({
          p_clinic_id: clinicId, p_full_name: v.full_name, p_dob: v.dob, p_sex: null,
          p_phone: v.phone, p_email: v.email, p_external_id: null, p_notes: v.notes,
          p_sns: v.sns, p_nif: v.nif, p_passport_id: v.passport_id,
          p_address_line1: v.address_line1, p_postal_code: v.postal_code,
          p_city: v.city, p_country: v.country,
          p_insurance_provider: v.insurance_provider, p_insurance_policy_number: v.insurance_policy_number,
        });
        if (!newPatientId) { setErr("Criado, mas não consegui obter o ID. Pesquisa pelo nome e seleciona."); npCreate.disabled = false; return; }
        setSelectedPatient({ id: newPatientId, name: v.full_name });
        if (mPatientQuery) mPatientQuery.value = v.full_name;
        closeResults();
        host.innerHTML = "";
      } catch (e) {
        console.error("Criar doente falhou:", e);
        const msg = String(e?.message || e?.details || e?.hint || e);
        if (msg.includes("patients_sns_unique_not_null"))           setErr("SNS já existe noutro doente.");
        else if (msg.includes("patients_nif_unique_not_null"))      setErr("NIF já existe noutro doente.");
        else if (msg.includes("patients_passport_unique_not_null")) setErr("Passaporte/ID já existe noutro doente.");
        else if (msg.includes("patients_sns_format_check"))         setErr("SNS inválido (9 dígitos).");
        else if (msg.includes("patients_nif_format_check"))         setErr("NIF inválido (9 dígitos).");
        else if (msg.includes("patients_passport_format_check"))    setErr("Passaporte/ID inválido (4–20 alfanum).");
        else if (msg.includes("patients_sns_or_nif_or_passport_check")) setErr("Identificação obrigatória: SNS/NIF/Passaporte.");
        else setErr("Erro ao criar doente. Vê a consola.");
        npCreate.disabled = false;
      }
    });

    npCreate.disabled = true;
    setInfo("Preenche o Nome e um identificador (SNS/NIF/Passaporte).");
    refreshButtonState();
  }

  mClinic?.addEventListener("change", () => {
    if (String(mMode?.value || "presencial").toLowerCase() === "bloqueio") return;
    setSelectedPatient({ id: "", name: "" });
    if (mPatientQuery) mPatientQuery.value = "";
    closeResults();
    const host = document.getElementById("newPatientHost");
    if (host) host.innerHTML = "";
  });

  mPatientQuery?.addEventListener("input", () => {
    if (String(mMode?.value || "presencial").toLowerCase() === "bloqueio") return;
    setSelectedPatient({ id: "", name: "" });
    scheduleSearch();
  });
  mPatientQuery?.addEventListener("focus", scheduleSearch);
  btnNewPatient?.addEventListener("click", openNewPatientForm);

  /* --- guardar / eliminar --- */
  async function onDeleteAppt() {
    if (!canDeleteAppt || !row?.id) return;
    if (!confirm("Registar esta marcação como falta (Faltou)?")) return;
    try {
      if (btnDeleteAppt) btnDeleteAppt.disabled = true;
      if (btnSave) btnSave.disabled = true;
      mMsg.style.color = "#666"; mMsg.textContent = "A registar falta…";
      const dayISO = String(row.start_at || G.selectedDayISO || "").slice(0, 10);
      const { error } = await window.sb.from("appointments").update({ appt_status: "no_show" }).eq("id", row.id);
      if (error) throw error;
      safeCloseModal();
      await refreshAgenda();
      __gcFireSyncDay(dayISO);
    } catch (e) {
      console.error("Registar falta falhou:", e);
      mMsg.style.color = "#b00020"; mMsg.textContent = String(e?.message || e?.details || e?.hint || e) || "Erro ao registar falta.";
      if (btnDeleteAppt) btnDeleteAppt.disabled = false;
      if (btnSave) btnSave.disabled = false;
    }
  }
  btnDeleteAppt?.addEventListener("click", onDeleteAppt);

  async function onSave() {
    const isBlock = String(mMode?.value || "presencial").toLowerCase() === "bloqueio";
    btnSave.disabled = true;
    mMsg.style.color = "#666"; mMsg.textContent = "A guardar…";

    try {
      if (isBlock) {
        if (!canCreateBlocks) throw new Error("Sem permissões para criar bloqueios.");
        const dateFrom  = bDateFrom?.value || "";
        const dateTo    = bDateTo?.value   || "";
        const timeFrom  = bTimeFrom?.value || "00:00";
        const timeTo    = bTimeTo?.value   || "23:59";
        if (!dateFrom) throw new Error("Datas De em falta.");
        if (!dateTo)   throw new Error("Até em falta.");
        if (__gcCmpYYYYMMDD(dateFrom, dateTo) > 0) throw new Error("Intervalo de datas inválido.");

        const applyToRaw    = String(bApplyTo?.value || "selected").toLowerCase();
        const idsSelected   = Array.from(__selectedClinicIds).map(String);
        const allClinicsCount = Array.isArray(G.clinics) ? G.clinics.length : 0;
        const allSelected   = allClinicsCount > 0 && idsSelected.length === allClinicsCount;
        let applyTo = (applyToRaw === "selected" && allSelected && isSuperadmin) ? "global" : applyToRaw;

        let targetClinicIds = [];
        if (applyTo === "global") {
          if (!isSuperadmin) throw new Error("Global: apenas superadmin.");
          targetClinicIds = [null];
        } else {
          if (!idsSelected.length) throw new Error("Seleciona pelo menos uma clínica.");
          targetClinicIds = idsSelected;
        }

        const rowsToInsert = [];
        let d = dateFrom;
        while (__gcCmpYYYYMMDD(d, dateTo) <= 0) {
          const sIso = __gcLocalDateTimeToIso(d, timeFrom);
          const eIso = __gcLocalDateTimeToIso(d, timeTo);
          if (!sIso || !eIso) throw new Error("Data/hora inválida no bloqueio.");
          if (new Date(eIso).getTime() <= new Date(sIso).getTime()) throw new Error("Hora 'Às' tem de ser depois de 'Das'.");
          for (const t of targetClinicIds) {
            rowsToInsert.push({ clinic_id: (t === null) ? null : String(t), patient_id: null, start_at: sIso, end_at: eIso, status: "confirmed", procedure_type: null, title: "BLOQUEIO", notes: mNotes?.value?.trim() || null, mode: "bloqueio" });
          }
          d = __gcAddDaysYYYYMMDD(d, 1);
        }

        if (isEdit && row?.id) {
          const first = rowsToInsert[0];
          if (!first) throw new Error("Sem dados para guardar.");
          const { error } = await window.sb.from("appointments").update(first).eq("id", row.id);
          if (error) throw error;
        } else {
          const { error } = await window.sb.from("appointments").insert(rowsToInsert);
          if (error) throw error;
        }

        safeCloseModal();
        await refreshAgenda();
        const syncDays = [String(dateFrom).slice(0, 10)];
        if (isEdit && row?.start_at) syncDays.push(String(row.start_at).slice(0, 10));
        __gcFireSyncDays(syncDays);
        return;
      }

      /* --- consulta normal --- */
      if (!mClinic?.value) throw new Error("Seleciona a clínica.");
      const pid   = mPatientId?.value   || "";
      const pname = mPatientName?.value || "";
      if (!pid) throw new Error("Seleciona um doente.");

      const proc = (() => {
        const sel = mProc?.value || "";
        if (!sel) return "";
        if (sel !== "Outro") return sel;
        return mProcOther?.value?.trim() || "";
      })();
      if (!proc) throw new Error("Seleciona o Tipo de consulta (e se for 'Outro', preenche o texto).");
      if (!mStart?.value) throw new Error("Define o início.");

      const dur   = mDuration ? parseInt(mDuration.value, 10) : 20;
      const times = calcEndFromStartAndDuration(mStart.value, dur);
      if (!times) throw new Error("Data/hora inválida.");

      const tRes = await maybeTransferPatientToClinic({ patientId: pid, targetClinicId: mClinic.value });
      if (tRes?.cancelled) { mMsg.style.color = "#b00020"; mMsg.textContent = "Operação cancelada (transferência não confirmada)."; btnSave.disabled = false; return; }

      const payload = {
        clinic_id: mClinic.value, patient_id: pid,
        start_at: times.startAt, end_at: times.endAt,
        status: mStatus?.value || "scheduled",
        procedure_type: proc,
        title: makeAutoTitle(pname, proc),
        notes: mNotes?.value?.trim() || null,
        mode: "presencial",
      };
      if (payload.notes === "") payload.notes = null;

      const oldDayISO = isEdit && row?.start_at ? String(row.start_at).slice(0, 10) : "";
      const newDayISO = String(times.startAt || G.selectedDayISO || "").slice(0, 10);

      if (isEdit) {
        const { error } = await window.sb.from("appointments").update(payload).eq("id", row.id);
        if (error) throw error;
      } else {
        const { data, error } = await window.sb.from("appointments").insert(payload).select("id").limit(1);
        if (error) throw error;
        console.log("[APPT] insert ok id=", data?.[0]?.id);
      }

      safeCloseModal();
      await refreshAgenda();
      __gcFireSyncDays([oldDayISO, newDayISO]);

    } catch (e) {
      console.error("Guardar falhou:", e);
      const msg = String(e?.message || e?.details || e?.hint || e);
      mMsg.style.color = "#b00020";
      mMsg.textContent = msg.toLowerCase().includes("bloqueio") ? "Não permitido: conflito com bloqueio existente." : (msg || "Erro ao guardar. Vê a consola.");
      btnSave.disabled = false;
    }
  }

  btnSave?.addEventListener("click", onSave);
  btnCancel?.addEventListener("click", safeCloseModal);
  btnClose?.addEventListener("click", safeCloseModal);
  overlay?.addEventListener("click", (ev) => { if (ev.target === overlay) safeCloseModal(); });
}


/* ==== 10C — Refresh agenda ==== */

/* ---- 10C.1 — refreshAgenda ---- */
export async function refreshAgenda() {
  if (isSessionLocked()) return;

  const sel      = document.getElementById("selClinic");
  const clinicId = sel?.value || null;
  const r        = isoLocalDayRangeFromISODate(G.selectedDayISO);

  if (!r) { setAgendaStatus("error", "Dia inválido."); return; }

  setAgendaStatus("loading", "A carregar marcações…");

  try {
    const { data, timeColUsed } = await loadAppointmentsForRange({ clinicId, startISO: r.startISO, endISO: r.endISO });

    const patientIds = (data || []).map((x) => x?.patient_id).filter(Boolean);
    try {
      G.patientsById = await fetchPatientsByIds(patientIds);
    } catch (e) {
      if (__gcIsAuthError(e)) { await __gcForceSessionLock("Sessão expirada ou inválida. Volte a iniciar sessão."); return; }
      console.error("Falha ao carregar pacientes para agenda:", e);
      G.patientsById = {};
    }

    G.agenda.rows       = data;
    G.agenda.timeColUsed = timeColUsed || "start_at";
    setAgendaStatus("ok", `OK: ${data.length} marcação(ões).`);
    renderAgendaList();
    loadAndRenderPendentes(clinicId).catch(() => {});
  } catch (e) {
    if (__gcIsAuthError(e)) { await __gcForceSessionLock("Sessão expirada ou inválida. Volte a iniciar sessão."); return; }
    console.error("Agenda load falhou:", e);
    setAgendaStatus("error", "Erro ao carregar agenda. Vê a consola.");
    G.agenda.rows = [];
    G.patientsById = {};
    renderAgendaList();
  }
}

/* Expor globalmente para compatibilidade durante a migração */
window.__gc_setAgendaSubtitleForSelectedDay = setAgendaSubtitleForSelectedDay;
window.__gc_renderClinicsSelect             = renderClinicsSelect;
window.__gc_wireQuickPatientSearch          = wireQuickPatientSearch;
window.__gc_refreshAgenda                   = refreshAgenda;
window.__gc_openApptModal                   = openApptModal;
window.__gc_openCalendarOverlay             = openCalendarOverlay;
window.__gc_openWeekView                    = openWeekView;


/* ==== 10D — Wire botões topbar da agenda ==== */

/* ---- 10C.2 — openPresencaModal ---- */
export function openPresencaModal({ selectedDayISO } = {}) {
  document.getElementById("gcPresAgendaModal")?.remove();

  const hoje = selectedDayISO || new Date().toISOString().slice(0, 10);

  // Carregar entidades externas (FPF, UC)
  window.sb
    .from("entidades_financeiras")
    .select("id, nome, tipo, valor_dia")
    .in("tipo", ["diaria", "modulo"])
    .eq("ativa", true)
    .order("nome")
    .then(({ data: entidades }) => {
      const opts = (entidades || []).map(e =>
        `<option value="${e.id}" data-valor="${e.tipo === "diaria" ? (e.valor_dia || 200) : 0}" data-tipo="${e.tipo}">${e.nome}</option>`
      ).join("");

      const overlay = document.createElement("div");
      overlay.id = "gcPresAgendaModal";
      Object.assign(overlay.style, {
        position: "fixed", inset: "0", background: "rgba(0,0,0,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px", zIndex: "2000",
        fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif"
      });

      overlay.innerHTML = `
        <div style="background:#fff;width:min(460px,100%);border-radius:14px;border:1px solid #e2e8f0;padding:22px;max-height:90vh;overflow-y:auto;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
            <div>
              <div style="font-size:15px;font-weight:800;color:#064e3b;">Nova Presença</div>
              <div style="font-size:12px;color:#64748b;margin-top:2px;">FPF · Universidade Católica · outras actividades</div>
            </div>
            <button id="gcPresAgClose" class="gcBtnGhost">Fechar</button>
          </div>

          <div style="display:flex;flex-direction:column;gap:12px;">
            <div>
              <label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px;">Entidade *</label>
              <select id="gcPresEntidade" style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;">
                <option value="">— seleccionar —</option>
                ${opts}
              </select>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
              <div>
                <label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px;">Data início *</label>
                <input id="gcPresIni" type="date" value="${hoje}"
                  style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;" />
              </div>
              <div>
                <label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px;">Data fim</label>
                <input id="gcPresFim" type="date" value="${hoje}"
                  style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;" />
              </div>
            </div>
            <div id="gcPresDiasInfo" style="background:#f0fdf4;border-radius:8px;padding:9px 12px;font-size:13px;color:#064e3b;font-weight:600;text-align:center;">1 dia</div>
            <div>
              <label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px;">Descrição</label>
              <input id="gcPresDesc" type="text" placeholder="ex: Jogo Sub-21 · Estágio · Aula Medicina Desportiva"
                style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;" />
            </div>
            <div>
              <label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px;">Valor por dia (€)</label>
              <input id="gcPresValor" type="number" min="0" step="0.01" value="200"
                style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;" />
            </div>
            <div id="gcPresTotalInfo" style="background:#E6F1FB;border-radius:8px;padding:9px 12px;font-size:14px;color:#0C447C;font-weight:700;text-align:right;">
              Total: 200,00 €
            </div>
            <div id="gcPresMsg" style="font-size:12px;color:#b00020;min-height:16px;"></div>
            <button id="gcPresBtnGuardar" class="gcBtnSuccess" style="width:100%;">Guardar presença</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      const inpIni   = overlay.querySelector("#gcPresIni");
      const inpFim   = overlay.querySelector("#gcPresFim");
      const inpVal   = overlay.querySelector("#gcPresValor");
      const selEnt   = overlay.querySelector("#gcPresEntidade");
      const divDias  = overlay.querySelector("#gcPresDiasInfo");
      const divTot   = overlay.querySelector("#gcPresTotalInfo");
      const msg      = overlay.querySelector("#gcPresMsg");

      function calc() {
        const d1 = inpIni.value, d2 = inpFim.value;
        if (!d1 || !d2) return;
        const dias  = Math.max(1, Math.round((new Date(d2) - new Date(d1)) / 86400000) + 1);
        const valor = parseFloat(inpVal.value || 0);
        divDias.textContent = `${dias} dia(s)`;
        divTot.textContent  = `Total: ${(dias * valor).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}`;
      }

      selEnt.addEventListener("change", () => {
        const opt = selEnt.selectedOptions[0];
        if (opt?.dataset.valor) inpVal.value = opt.dataset.valor;
        calc();
      });
      inpIni.addEventListener("change", calc);
      inpFim.addEventListener("change", calc);
      inpVal.addEventListener("input",  calc);
      calc();

      const close = () => overlay.remove();
      overlay.querySelector("#gcPresAgClose").addEventListener("click", close);
      overlay.addEventListener("click", ev => { if (ev.target === overlay) close(); });

      overlay.querySelector("#gcPresBtnGuardar").addEventListener("click", async () => {
        const entId = selEnt.value;
        const ini   = inpIni.value;
        const fim   = inpFim.value || ini;
        const vdia  = parseFloat(inpVal.value || 0);
        const desc  = overlay.querySelector("#gcPresDesc").value.trim();

        if (!entId) { msg.textContent = "Seleccione a entidade."; return; }
        if (!ini)   { msg.textContent = "Indique a data de início."; return; }
        if (fim < ini) { msg.textContent = "Data fim tem de ser igual ou posterior ao início."; return; }

        try {
          overlay.querySelector("#gcPresBtnGuardar").disabled = true;
          await window.sb.from("presencas").insert({
            entidade_id: entId,
            data_inicio: ini,
            data_fim:    fim,
            tipo:        ini === fim ? "dia" : "intervalo",
            descricao:   desc || null,
            valor_dia:   vdia,
          });
          close();
          // Refresh agenda se estiver no dia da presença
          if (typeof refreshAgenda === "function") await refreshAgenda();
        } catch (e) {
          console.error("Presença guardar falhou:", e);
          msg.textContent = "Erro ao guardar. Vê a consola.";
          overlay.querySelector("#gcPresBtnGuardar").disabled = false;
        }
      });
    })
    .catch(e => {
      console.error("openPresencaModal: erro a carregar entidades:", e);
      alert("Erro ao carregar entidades. Vê a consola.");
    });
}

/* ---- 10D.1 — wireAgendaTopbar ---- */
/* Chamada pelo boot.js após renderAppShell() para ligar btnCal, btnWeek, btnToday, btnNewAppt */
export function wireAgendaTopbar() {
  document.getElementById("btnCal")?.addEventListener("click", () => {
    if (typeof openCalendarOverlay === "function") openCalendarOverlay();
  });

  document.getElementById("btnWeek")?.addEventListener("click", () => {
    G.weekStartISO = __gcWeekStartISO(G.selectedDayISO);
    openWeekView();
  });

  document.getElementById("btnToday")?.addEventListener("click", async () => {
    G.selectedDayISO = fmtDateISO(new Date());
    setAgendaSubtitleForSelectedDay();
    await refreshAgenda();
  });

  document.getElementById("btnNewAppt")?.addEventListener("click", () => {
    openApptModal({ mode: "new", row: null });
  });

  /* btnNewPresenca removido da topbar — openPresencaModal mantida para uso interno */
}

window.__gc_wireAgendaTopbar = wireAgendaTopbar;


/* ========================================================
   PENDENTES ONLINE — pedidos recebidos de www.joaomorais.pt
   ======================================================== */

const _WEB_CLINIC_ID     = "951ad0da-7114-43de-ac6b-da64f17c6bb1";
const _UPLOADS_WORKER    = "https://uploads-worker.dr-joao-morais.workers.dev";
const _TIPO_LABEL        = { videoconsulta: "Videoconsulta", exame_desportivo: "Exame Médico Desportivo" };

/* ---- Carregar e renderizar pendentes ---- */
export async function loadAndRenderPendentes(clinicId) {
  const section = document.getElementById("pendentesSection");
  if (!section) return;
  try {
    let q = window.sb
      .from("patient_uploads")
      .select("id, created_at, tipo, clinic_id, atleta_nome, atleta_email, atleta_tel, atleta_dob, atleta_sns, atleta_cc, atleta_nif, atleta_passport, disponibilidade, pdf_url, status, patient_id")
      .eq("status", "pendente")
      .order("created_at", { ascending: true });
    if (clinicId) q = q.eq("clinic_id", clinicId);
    const { data, error } = await q;
    if (error) throw error;
    _renderPendentes(data || []);
    _updatePendentesBadge((data || []).length);
  } catch (e) {
    console.warn("loadAndRenderPendentes:", e);
    section.innerHTML = "";
  }
}

function _updatePendentesBadge(count) {
  document.getElementById("gcPendentesAgendaBadge")?.remove();
  const btn = document.querySelector('[data-nav="agenda"]');
  if (!btn || count === 0) return;
  const b = document.createElement("span");
  b.id = "gcPendentesAgendaBadge";
  Object.assign(b.style, { position:"absolute", top:"6px", right:"6px", background:"#e02424", color:"#fff", fontSize:"10px", fontWeight:"700", width:"16px", height:"16px", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", pointerEvents:"none" });
  b.textContent = count > 9 ? "9+" : String(count);
  btn.style.position = "relative";
  btn.appendChild(b);
}

function _renderPendentes(rows) {
  const section = document.getElementById("pendentesSection");
  if (!section) return;
  if (!rows.length) { section.innerHTML = ""; return; }

  const cards = rows.map(r => {
    const tipo = _TIPO_LABEL[r.tipo] || r.tipo || "—";
    const date = new Date(r.created_at).toLocaleDateString("pt-PT", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" });
    const disp = r.disponibilidade ? `<div style="font-size:11px;color:#374151;margin-top:3px;"><span style="color:#9CA3AF;">Disponível: </span>${escapeHtml(r.disponibilidade)}</div>` : "";
    return `<div class="gc-pend-card" data-id="${r.id}" style="background:#fff;border:1px solid #FCD34D;border-left:3px solid #F59E0B;border-radius:10px;padding:11px 13px;cursor:pointer;transition:box-shadow 0.15s;" onmouseover="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.10)'" onmouseout="this.style.boxShadow=''">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:700;color:#111827;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(r.atleta_nome || "—")}</div>
          <div style="font-size:11px;color:#D97706;font-weight:600;margin-top:1px;">${tipo}</div>
          ${disp}
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div style="font-size:10px;color:#9CA3AF;">${date}</div>
          <div style="margin-top:5px;background:#FEF3C7;color:#92400E;font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;">Pendente</div>
        </div>
      </div>
    </div>`;
  }).join("");

  section.innerHTML = `
    <div style="background:#FFFBEB;border:1px solid #FCD34D;border-radius:12px;padding:14px;margin-bottom:4px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <div style="width:8px;height:8px;background:#F59E0B;border-radius:50%;flex-shrink:0;animation:gcPendPulse 1.5s ease-in-out infinite;"></div>
        <span style="font-size:13px;font-weight:700;color:#92400E;">${rows.length} pedido${rows.length > 1 ? "s" : ""} pendente${rows.length > 1 ? "s" : ""}</span>
        <span style="font-size:11px;color:#B45309;">— clica para tratar</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:7px;">${cards}</div>
    </div>
    <style>@keyframes gcPendPulse{0%,100%{opacity:1}50%{opacity:0.4}}</style>`;

  section.querySelectorAll(".gc-pend-card").forEach(card => {
    card.addEventListener("click", () => {
      const row = rows.find(r => r.id === card.dataset.id);
      if (row) _openPendenteModal(row);
    });
  });
}

/* ---- Modal de confirmação ---- */
function _openPendenteModal(row) {
  document.getElementById("gcPendModal")?.remove();

  const isWebClinic = row.clinic_id === _WEB_CLINIC_ID;
  const tipo        = _TIPO_LABEL[row.tipo] || row.tipo || "—";

  const ids = [
    row.atleta_sns      && `SNS: ${row.atleta_sns}`,
    row.atleta_cc       && `CC: ${row.atleta_cc}`,
    row.atleta_nif      && `NIF: ${row.atleta_nif}`,
    row.atleta_passport && `Passaporte: ${row.atleta_passport}`,
  ].filter(Boolean).join(" · ") || "—";

  const overlay = document.createElement("div");
  overlay.id = "gcPendModal";
  Object.assign(overlay.style, { position:"fixed", inset:"0", background:"rgba(15,45,82,0.45)", zIndex:"9000", display:"flex", alignItems:"center", justifyContent:"center", padding:"16px" });

  overlay.innerHTML = `
    <div style="background:#fff;border-radius:16px;width:100%;max-width:520px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.25);display:flex;flex-direction:column;">

      <!-- Cabeçalho -->
      <div style="padding:18px 20px 14px;border-bottom:1px solid #E5E7EB;display:flex;justify-content:space-between;align-items:flex-start;flex-shrink:0;">
        <div>
          <div style="font-size:16px;font-weight:800;color:#111827;">Pedido pendente</div>
          <div style="font-size:12px;color:#D97706;font-weight:600;margin-top:2px;">${tipo}</div>
        </div>
        <button id="gcPendClose" style="background:none;border:1px solid #E5E7EB;border-radius:8px;padding:5px 10px;cursor:pointer;font-size:18px;color:#6B7280;line-height:1;">×</button>
      </div>

      <!-- Dados do doente -->
      <div style="padding:16px 20px;border-bottom:1px solid #F3F4F6;background:#F9FAFB;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#9CA3AF;letter-spacing:0.06em;margin-bottom:10px;">Dados do doente</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px;">
          <div><div style="font-size:10px;color:#9CA3AF;font-weight:600;text-transform:uppercase;margin-bottom:2px;">Nome</div><div style="font-weight:700;color:#111827;">${escapeHtml(row.atleta_nome || "—")}</div></div>
          <div><div style="font-size:10px;color:#9CA3AF;font-weight:600;text-transform:uppercase;margin-bottom:2px;">Email</div><div style="color:#1a56db;">${escapeHtml(row.atleta_email || "—")}</div></div>
          <div><div style="font-size:10px;color:#9CA3AF;font-weight:600;text-transform:uppercase;margin-bottom:2px;">Telemóvel</div><div style="color:#374151;">${escapeHtml(row.atleta_tel || "—")}</div></div>
          <div><div style="font-size:10px;color:#9CA3AF;font-weight:600;text-transform:uppercase;margin-bottom:2px;">Nasc.</div><div style="color:#374151;">${row.atleta_dob || "—"}</div></div>
          <div style="grid-column:1/-1;"><div style="font-size:10px;color:#9CA3AF;font-weight:600;text-transform:uppercase;margin-bottom:2px;">Identificação</div><div style="color:#374151;">${escapeHtml(ids)}</div></div>
          ${row.disponibilidade ? `<div style="grid-column:1/-1;"><div style="font-size:10px;color:#9CA3AF;font-weight:600;text-transform:uppercase;margin-bottom:2px;">Disponibilidade pedida</div><div style="color:#374151;line-height:1.5;">${escapeHtml(row.disponibilidade)}</div></div>` : ""}
        </div>
        ${row.pdf_url ? `<a href="${row.pdf_url}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:5px;margin-top:10px;font-size:12px;font-weight:600;color:#1a56db;text-decoration:none;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>Ver PDF enviado</a>` : ""}
      </div>

      <!-- Formulário de resposta -->
      <div style="padding:16px 20px;display:flex;flex-direction:column;gap:14px;">
        <div>
          <label style="display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:5px;">Data e hora confirmada <span style="color:#EF4444;">*</span></label>
          <input id="gcPendDT" type="datetime-local" style="width:100%;border:1px solid #D1D5DB;border-radius:8px;padding:8px 12px;font-size:14px;color:#111827;font-family:inherit;box-sizing:border-box;">
        </div>

        ${isWebClinic ? `
        <div>
          <label style="display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:5px;">Link de pagamento <span style="font-size:11px;font-weight:400;color:#9CA3AF;">(Stripe ou outro)</span></label>
          <input id="gcPendPay" type="url" placeholder="https://buy.stripe.com/..." style="width:100%;border:1px solid #D1D5DB;border-radius:8px;padding:8px 12px;font-size:14px;color:#111827;font-family:inherit;box-sizing:border-box;">
          <div style="font-size:11px;color:#6B7280;margin-top:4px;">O email com o link do Google Meet só será enviado após pagamento confirmado.</div>
        </div>` : ""}

        <div>
          <label style="display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:5px;">Link Google Meet ${isWebClinic ? "" : "<span style='color:#EF4444;'>*</span>"}</label>
          <div style="display:flex;gap:8px;">
            <input id="gcPendMeet" type="url" placeholder="https://meet.google.com/..." style="flex:1;border:1px solid #D1D5DB;border-radius:8px;padding:8px 12px;font-size:14px;color:#111827;font-family:inherit;min-width:0;">
            <button id="gcPendGenMeet" style="background:#1a56db;color:#fff;border:none;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;font-family:inherit;">Gerar Meet</button>
          </div>
          <div id="gcPendMeetStatus" style="font-size:11px;color:#6B7280;margin-top:4px;"></div>
        </div>
      </div>

      <!-- Botões -->
      <div style="padding:14px 20px 18px;border-top:1px solid #F3F4F6;display:flex;flex-direction:column;gap:8px;flex-shrink:0;">
        <button id="gcPendBtnConfirm" style="background:#1a56db;color:#fff;border:none;border-radius:10px;padding:11px 16px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;width:100%;">
          ${isWebClinic ? "Enviar data e link de pagamento ao doente" : "Enviar confirmação com link Google Meet"}
        </button>
        <div style="display:flex;gap:8px;">
          <button id="gcPendBtnAgendar" style="flex:1;background:#F3F4F6;color:#374151;border:none;border-radius:10px;padding:9px 12px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">Agendar na Agenda</button>
          <button id="gcPendBtnCancel" style="flex:1;background:#FEE2E2;color:#991B1B;border:none;border-radius:10px;padding:9px 12px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">Cancelar pedido</button>
        </div>
        <div id="gcPendMsg" style="font-size:12px;color:#EF4444;min-height:14px;text-align:center;"></div>
      </div>

    </div>`;

  document.body.appendChild(overlay);

  const close    = () => overlay.remove();
  const msgEl    = overlay.querySelector("#gcPendMsg");
  const meetInp  = overlay.querySelector("#gcPendMeet");
  const meetStat = overlay.querySelector("#gcPendMeetStatus");

  overlay.querySelector("#gcPendClose").addEventListener("click", close);
  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });

  /* Gerar Meet automaticamente via gc-gcal (SA já configurada) */
  overlay.querySelector("#gcPendGenMeet").addEventListener("click", async () => {
    const btn = overlay.querySelector("#gcPendGenMeet");
    const dt  = overlay.querySelector("#gcPendDT").value;
    btn.disabled = true;
    btn.textContent = "A gerar…";
    meetStat.textContent = "";
    try {
      if (!dt) throw new Error("Selecciona primeiro a data e hora da consulta.");
      const { data: sessionData } = await window.sb.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("Sessão expirada. Volta a iniciar sessão.");

      const res  = await fetch(`${GCAL_WORKER_URL}/meet`, {
        method:  "POST",
        headers: { "content-type": "application/json", "Authorization": `Bearer ${token}` },
        body:    JSON.stringify({ patient_name: row.atleta_nome, datetime_start: dt, duration_min: 20 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "Erro");
      meetInp.value        = data.meet_url;
      meetStat.style.color = "#059669";
      meetStat.textContent = "✓ Evento criado no teu calendário Google.";
    } catch (e) {
      meetStat.style.color = "#EF4444";
      meetStat.textContent = `Erro: ${e.message}`;
    } finally {
      btn.disabled    = false;
      btn.textContent = "Gerar Meet";
    }
  });

  /* Enviar confirmação */
  overlay.querySelector("#gcPendBtnConfirm").addEventListener("click", async () => {
    const dt       = overlay.querySelector("#gcPendDT").value;
    const payUrl   = overlay.querySelector("#gcPendPay")?.value.trim() || null;
    const meetUrl  = meetInp.value.trim();
    const btn      = overlay.querySelector("#gcPendBtnConfirm");

    msgEl.textContent = "";
    if (!dt)      { msgEl.textContent = "Indica a data e hora."; return; }
    if (!isWebClinic && !meetUrl) { msgEl.textContent = "Indica ou gera o link Google Meet."; return; }

    btn.disabled    = true;
    btn.textContent = "A enviar…";

    try {
      const res  = await fetch(`${_UPLOADS_WORKER}/confirm`, {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body:    JSON.stringify({ upload_id: row.id, confirmed_datetime: dt, payment_url: payUrl, meet_url: meetUrl || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "Erro");
      close();
      const sel = document.getElementById("selClinic");
      await loadAndRenderPendentes(sel?.value || null);
    } catch (e) {
      msgEl.textContent = `Erro: ${e.message}`;
      btn.disabled    = false;
      btn.textContent = isWebClinic ? "Enviar data e link de pagamento ao doente" : "Enviar confirmação com link Google Meet";
    }
  });

  /* Agendar na agenda */
  overlay.querySelector("#gcPendBtnAgendar").addEventListener("click", () => {
    close();
    openApptModal({ mode: "new", row: null });
  });

  /* Cancelar pedido */
  overlay.querySelector("#gcPendBtnCancel").addEventListener("click", async () => {
    if (!confirm(`Cancelar o pedido de ${row.atleta_nome || "este doente"}?`)) return;
    try {
      await window.sb.from("patient_uploads").update({ status: "cancelado" }).eq("id", row.id);
      close();
      const sel = document.getElementById("selClinic");
      await loadAndRenderPendentes(sel?.value || null);
    } catch (e) {
      alert("Erro ao cancelar: " + e.message);
    }
  });
}

window.__gc_loadAndRenderPendentes = loadAndRenderPendentes;
