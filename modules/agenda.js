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

   08B — Helpers do calendário mensal
      08B.1  monthLabel(d)
      08B.2  buildMonthGrid(monthDate)

   08C — Interface do calendário mensal
      08C.1  openCalendarOverlay()

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
        <button id="btnPrintAgendaDay" class="gcBtn" type="button" style="font-weight:900;">Imprimir lista do dia</button>
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
function renderQuickPatientResults(results) {
  const host = document.getElementById("pQuickResults");
  if (!host) return;

  if (!results || results.length === 0) {
    host.innerHTML = `<div style="font-size:${UI.fs12}px; color:#666;">Sem resultados.</div>`;
    return;
  }

  const selectedId = G.patientQuick?.selected?.id ?? null;

  host.innerHTML = results.map((p) => {
    const idBits = [];
    if (p.sns)         idBits.push(`SNS:${p.sns}`);
    if (p.nif)         idBits.push(`NIF:${p.nif}`);
    if (p.passport_id) idBits.push(`ID:${p.passport_id}`);
    const line2 = [idBits.join(" / "), p.phone ? `Tel:${p.phone}` : ""].filter(Boolean).join(" • ");

    const isSel = selectedId && p.id === selectedId;
    const bg    = isSel ? "background:#f2f2f2;" : "background:#fff;";
    const br    = isSel ? "border:1px solid #cbd5e1;" : "border:1px solid #f0f0f0;";

    return `
      <div data-pid="${escapeHtml(p.id)}"
           style="padding:8px; ${br} border-radius:10px; margin-bottom:8px; cursor:pointer; ${bg}">
        <div style="font-size:${UI.fs13}px; color:#111; font-weight:700; white-space:normal; overflow-wrap:anywhere; word-break:break-word;">${escapeHtml(p.full_name)}</div>
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
export function openCalendarOverlay() {
  const root = document.getElementById("modalRoot");
  if (!root) return;

  const todayISO    = fmtDateISO(new Date());
  const selectedISO = G.selectedDayISO;

  if (!G.calMonth) {
    const selD = parseISODateToLocalStart(selectedISO) || new Date();
    G.calMonth = new Date(selD.getFullYear(), selD.getMonth(), 1, 0, 0, 0, 0);
  }

  const cells    = buildMonthGrid(G.calMonth);
  const weekDays = ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];

  root.innerHTML = `
    <div id="calOverlay" style="position:fixed;inset:0;background:rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;padding:18px;">
      <div style="background:#fff;width:min(520px,100%);border-radius:14px;border:1px solid #e5e5e5;padding:14px;">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
          <button id="calPrev" class="gcBtn">◀</button>
          <div style="font-size:${UI.fs14}px;font-weight:800;color:#111;" id="calTitle">${escapeHtml(monthLabel(G.calMonth))}</div>
          <button id="calNext" class="gcBtn">▶</button>
        </div>
        <div style="margin-top:10px;display:grid;grid-template-columns:repeat(7,1fr);gap:6px;">
          ${weekDays.map((w) => `<div style="font-size:${UI.fs12}px;color:#666;text-align:center;padding:6px 0;">${w}</div>`).join("")}
          ${cells.map((d) => {
            if (!d) return `<div></div>`;
            const iso        = fmtDateISO(d);
            const isToday    = iso === todayISO;
            const isSelected = iso === selectedISO;
            const bg = isSelected
              ? "background:#111;color:#fff;border-color:#111;"
              : isToday
                ? "background:#f2f2f2;color:#111;"
                : "background:#fff;color:#111;";
            return `<div data-iso="${iso}" style="padding:10px 0;border-radius:10px;border:1px solid #eee;text-align:center;cursor:pointer;user-select:none;${bg}font-size:${UI.fs13}px;">${d.getDate()}</div>`;
          }).join("")}
        </div>
        <div style="margin-top:12px;display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;">
          <div style="font-size:${UI.fs12}px;color:#666;">Clique num dia para abrir a agenda desse dia.</div>
          <button id="calClose" class="gcBtn">Fechar</button>
        </div>
      </div>
    </div>`;

  function close() { root.innerHTML = ""; }

  document.getElementById("calClose")?.addEventListener("click", close);
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

async function ensurePatientActiveInClinic({ patientId, targetClinicId }) {
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
export function openApptModal({ mode, row }) {
  const root = document.getElementById("modalRoot");
  if (!root) return;

  const isEdit          = mode === "edit";
  const selClinic       = document.getElementById("selClinic");
  const defaultClinicId = isEdit && row?.clinic_id
    ? row.clinic_id
    : selClinic?.value || (G.clinics.length === 1 ? G.clinics[0].id : "");

  const selectedDayStart = parseISODateToLocalStart(G.selectedDayISO) || new Date();
  const startBase = new Date(selectedDayStart.getFullYear(), selectedDayStart.getMonth(), selectedDayStart.getDate(), 9, 0, 0, 0);
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
  const procIsOther   = procInit && !PROCEDURE_OPTIONS.includes(procInit);
  const procSelectValue  = procIsOther ? "Outro" : (procInit || "");
  const apptModeInit     = isEdit ? String(row?.mode || "presencial").toLowerCase() : "presencial";
  const isSuperadmin     = !!window.__GC_IS_SUPERADMIN__;
  const isDoctor         = String(G.role || "").toLowerCase() === "doctor";
  const canCreateBlocks  = isSuperadmin || isDoctor;
  const isBlockEdit      = isEdit && String(row?.mode || "").toLowerCase() === "bloqueio";
  const canDeleteAppt    = !!(isEdit && row?.id && !isBlockEdit);

  function optLabel(s) { const m = statusMeta(s); return `${m.icon} ${m.label}`; }

  const bDateFromInit = __gcToDateInput(startInit);
  const bDateToInit   = __gcToDateInput(startInit);
  const bTimeFromInit = __gcToTimeInput(startInit);
  const bTimeToInit   = __gcToTimeInput(endInit);

  root.innerHTML = `
    <div id="modalOverlay" style="position:fixed;inset:0;background:rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;padding:18px;">
      <div style="background:#fff;width:min(1040px,100%);border-radius:14px;border:1px solid #e5e5e5;padding:14px;max-height:90vh;overflow:auto;">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
          <div>
            <div style="font-size:${UI.fs14}px;font-weight:900;color:#111;">
              ${isBlockEdit ? "Editar bloqueio" : (isEdit ? "Editar marcação" : "Nova marcação")}
            </div>
            <div style="font-size:${UI.fs12}px;color:#666;margin-top:4px;">Dia selecionado: ${escapeHtml(G.selectedDayISO)}.</div>
          </div>
          <button id="btnCloseModal" class="gcBtn">Fechar</button>
        </div>

        <div style="margin-top:12px;display:flex;flex-direction:column;gap:4px;">
          <label style="font-size:${UI.fs12}px;color:#666;">Ação</label>
          <select id="mMode" class="gcSelect">
            <option value="presencial">Agendar consulta</option>
            ${canCreateBlocks ? `<option value="bloqueio">Realizar bloqueio</option>` : ""}
          </select>
          ${!canCreateBlocks ? `<div style="font-size:${UI.fs12}px;color:#666;margin-top:4px;">Bloqueios: apenas médico/superadmin.</div>` : ""}
        </div>

        <div id="mBlockOnlyWrap" style="display:none;margin-top:14px;border:1px solid #eee;border-radius:14px;padding:14px;background:#fafafa;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
            <div style="font-weight:900;font-size:${UI.fs13}px;">Bloqueio</div>
            ${isBlockEdit ? `<button id="btnDeleteBlock" class="gcBtn" type="button" style="font-weight:900;">Apagar bloqueio</button>` : ""}
          </div>
          <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;">
            <button id="btnBlockDay" class="gcBtn" type="button" style="font-weight:900;">Bloquear dia</button>
            <button id="btnBlockPeriod" class="gcBtn" type="button">Bloquear período</button>
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

        <div id="mConsultOnlyWrap" style="display:block;">
          <div id="mPatientWrap" style="margin-top:12px;display:flex;flex-direction:column;gap:6px;">
            <label style="font-size:${UI.fs12}px;color:#666;">Doente (obrigatório)</label>
            <div style="display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;">
              <input id="mPatientQuery" type="search" placeholder="ex.: Man… | 916… | 123456789" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" inputmode="search" data-form-type="other" style="padding:10px 12px;border-radius:10px;border:1px solid #ddd;width:100%;font-size:${UI.fs13}px;" />
              <button id="btnNewPatient" class="gcBtn" style="white-space:nowrap;">＋ 👤 Novo doente</button>
            </div>
            <div id="mPatientResults" style="display:none;margin-top:8px;border:1px solid #eee;border-radius:10px;padding:8px;background:#fff;max-height:220px;overflow:auto;"></div>
            <input type="hidden" id="mPatientId" value="" />
            <input type="hidden" id="mPatientName" value="" />
            <div id="newPatientHost" style="margin-top:8px;"></div>
          </div>

          <div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
            <div style="display:flex;flex-direction:column;gap:4px;"><label style="font-size:${UI.fs12}px;color:#666;">Clínica</label><select id="mClinic" class="gcSelect"></select></div>
            <div id="mProcWrap" style="display:flex;flex-direction:column;gap:4px;">
              <label style="font-size:${UI.fs12}px;color:#666;">Tipo (obrigatório)</label>
              <select id="mProc" class="gcSelect">
                <option value="">—</option>
                ${PROCEDURE_OPTIONS.map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("")}
              </select>
            </div>
            <div id="mStatusWrap" style="display:flex;flex-direction:column;gap:4px;">
              <label style="font-size:${UI.fs12}px;color:#666;">Estado</label>
              <select id="mStatus" class="gcSelect">
                ${STATUS_OPTIONS.map((s) => { const val = (s === "cancelled") ? "no_show" : String(s).toLowerCase(); return `<option value="${escapeHtml(val)}">${escapeHtml(optLabel(val))}</option>`; }).join("")}
              </select>
            </div>
            <div id="mProcOtherWrap" style="display:none;flex-direction:column;gap:4px;grid-column:1 / -1;">
              <label style="font-size:${UI.fs12}px;color:#666;">Outro (texto) *</label>
              <input id="mProcOther" type="text" placeholder="ex.: Ondas de choque" autocomplete="off" autocapitalize="off" spellcheck="false" style="padding:10px 12px;border-radius:10px;border:1px solid #ddd;font-size:${UI.fs13}px;" />
            </div>
          </div>

          <div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div style="display:flex;flex-direction:column;gap:4px;"><label style="font-size:${UI.fs12}px;color:#666;">Início</label><input id="mStart" type="datetime-local" style="padding:10px 12px;border-radius:10px;border:1px solid #ddd;font-size:${UI.fs13}px;" /></div>
            <div style="display:flex;flex-direction:column;gap:4px;"><label style="font-size:${UI.fs12}px;color:#666;">Duração (min)</label><select id="mDuration" class="gcSelect">${DURATION_OPTIONS.map((n) => `<option value="${n}">${n}</option>`).join("")}</select></div>
          </div>
        </div>

        <div style="margin-top:12px;display:flex;flex-direction:column;gap:4px;">
          <label id="mNotesLabel" style="font-size:${UI.fs12}px;color:#666;">Notas</label>
          <textarea id="mNotes" rows="3" style="padding:10px 12px;border-radius:10px;border:1px solid #ddd;resize:vertical;font-size:${UI.fs13}px;"></textarea>
        </div>

        <div style="margin-top:12px;display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;">
          <div id="mMsg" style="font-size:${UI.fs12}px;color:#666;"></div>
          <div style="display:flex;gap:10px;">
            ${canDeleteAppt ? `<button id="btnDeleteAppt" class="gcBtn" type="button" style="font-weight:900;">Eliminar marcação</button>` : ""}
            <button id="btnCancel" class="gcBtn">Cancelar</button>
            <button id="btnSave" class="gcBtn" style="font-weight:900;">Guardar</button>
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
      const { error } = await window.sb.from("appointments").delete().eq("id", row.id);
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
    mPatientResults.style.display = "block";
    mPatientResults.innerHTML = (pts || []).map((p) => {
      const idBits = [];
      if (p.sns)         idBits.push(`SNS:${p.sns}`);
      if (p.nif)         idBits.push(`NIF:${p.nif}`);
      if (p.passport_id) idBits.push(`ID:${p.passport_id}`);
      const line2 = [idBits.join(" / "), p.phone ? `Tel:${p.phone}` : ""].filter(Boolean).join(" • ");
      return `
        <div data-pid="${escapeHtml(p.id)}" data-pname="${escapeHtml(p.full_name)}"
             style="padding:8px;border:1px solid #f0f0f0;border-radius:10px;margin-bottom:8px;cursor:pointer;">
          <div style="font-size:${UI.fs13}px;color:#111;font-weight:800;white-space:normal;overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(p.full_name)}</div>
          <div style="font-size:${UI.fs12}px;color:#666;">${escapeHtml(line2 || "—")}</div>
        </div>`;
    }).join("");
    mPatientResults.querySelectorAll("[data-pid]").forEach((el) => {
      el.addEventListener("click", () => {
        setSelectedPatient({ id: el.getAttribute("data-pid"), name: el.getAttribute("data-pname") });
        if (mPatientQuery) mPatientQuery.value = el.getAttribute("data-pname") || "";
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
    if (!confirm("Eliminar esta marcação?")) return;
    try {
      if (btnDeleteAppt) btnDeleteAppt.disabled = true;
      if (btnSave) btnSave.disabled = true;
      mMsg.style.color = "#666"; mMsg.textContent = "A eliminar…";
      const dayISO = String(row.start_at || G.selectedDayISO || "").slice(0, 10);
      const { error } = await window.sb.from("appointments").delete().eq("id", row.id);
      if (error) throw error;
      safeCloseModal();
      await refreshAgenda();
      __gcFireSyncDay(dayISO);
    } catch (e) {
      console.error("Eliminar falhou:", e);
      mMsg.style.color = "#b00020"; mMsg.textContent = String(e?.message || e?.details || e?.hint || e) || "Erro ao eliminar.";
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
