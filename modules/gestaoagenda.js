/* ========================================================
   GESTAOAGENDA.JS — Timeline clínica com slots, bloqueios
   e horários recorrentes
   ======================================================== */

import { G } from "./state.js";
import { escapeHtml } from "./helpers.js";
import { openApptModal } from "./agenda.js";

const GCAL_WORKER_URL = window.__GC_GCAL_WORKER_URL__ || "";

function pad2(n) { return String(n).padStart(2, "0"); }
function fmtHM(date) { return pad2(date.getHours()) + ":" + pad2(date.getMinutes()); }
function todayISO() { const d = new Date(); return d.getFullYear() + "-" + pad2(d.getMonth()+1) + "-" + pad2(d.getDate()); }
function isoToDisplay(iso) {
  const d = new Date(iso + "T00:00:00");
  const DAYS = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return DAYS[d.getDay()] + ", " + d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
}
function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.getFullYear() + "-" + pad2(d.getMonth()+1) + "-" + pad2(d.getDate());
}
function gerarSlots(horaInicio, horaFim, durMin) {
  const [h1,m1] = horaInicio.split(":").map(Number);
  const [h2,m2] = horaFim.split(":").map(Number);
  let cur = h1*60+m1;
  const end = h2*60+m2;
  const slots = [];
  while (cur < end) { slots.push(pad2(Math.floor(cur/60))+":"+pad2(cur%60)); cur += durMin; }
  return slots;
}

/* ── Estado local ─────────────────────────────────────── */
let _state = {
  selectedDayISO: todayISO(),
  selectedClinicId: null,
  rows: [],
  horarios: [],
  loading: false,
};

/* ── Entry point ──────────────────────────────────────── */
export function initGestaoAgenda() {
  const root = document.getElementById("gcGestaoAgendaRoot");
  if (!root) return;

  _state.selectedDayISO = G.selectedDayISO || todayISO();
  _state.selectedClinicId = (G.clinics||[])[0]?.id || null;

  root.innerHTML = _buildShell();
  _wireShell();
  _loadAndRender();
}

/* ── HTML shell ───────────────────────────────────────── */
function _buildShell() {
  const clinicas = G.clinics || [];
  const clinicOpts = clinicas.map(c =>
    `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name||c.slug||c.id)}</option>`
  ).join("");

  return `
<div style="padding:0 0 2rem;">

  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:1rem;">
    <div style="display:flex;align-items:center;gap:2px;background:#f1f5f9;border-radius:10px;padding:2px;">
      <button id="gaBtnPrev" style="border:none;background:transparent;cursor:pointer;width:28px;height:28px;border-radius:7px;display:flex;align-items:center;justify-content:center;color:#475569;font-size:16px;">‹</button>
      <span id="gaDayLabel" style="font-size:13px;font-weight:600;color:#0f2d52;padding:0 8px;white-space:nowrap;"></span>
      <button id="gaBtnNext" style="border:none;background:transparent;cursor:pointer;width:28px;height:28px;border-radius:7px;display:flex;align-items:center;justify-content:center;color:#475569;font-size:16px;">›</button>
    </div>
    <button id="gaBtnHoje" class="gcBtnGhost" style="font-size:12px;padding:5px 12px;">Hoje</button>
    <div style="width:1px;height:20px;background:#e2e8f0;"></div>
    <button id="gaBtnRec" class="gcBtnGhost" style="font-size:12px;padding:5px 14px;">Disponibilidade</button>
    <button id="gaBtnBloq" class="gcBtnDanger" style="font-size:12px;padding:5px 14px;">Bloquear</button>
    <div style="width:1px;height:20px;background:#e2e8f0;"></div>
    <button id="gaBtnSemana" class="gcBtnGhost" style="font-size:12px;padding:5px 12px;">Vista semanal</button>
    <select id="gaSelClinica" class="gcSelect" style="font-size:12px;padding:5px 10px;">${clinicOpts}</select>
  </div>

  <div id="gaSemanaBanner" style="display:none;margin-bottom:1rem;"></div>
  <div id="gaRecBanner" style="margin-bottom:1rem;"></div>
  <div id="gaStats" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:1rem;"></div>

  <div style="display:flex;gap:12px;">
    <div style="flex:1;background:#fff;border:0.5px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="display:grid;grid-template-columns:60px 1fr 140px 110px;padding:8px 12px;background:#f8fafc;border-bottom:0.5px solid #e2e8f0;gap:8px;">
        <div style="font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Hora</div>
        <div style="font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Doente</div>
        <div style="font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Tipo</div>
        <div style="font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Estado</div>
      </div>
      <div id="gaTimeline"></div>
    </div>
    <div id="gaPanel" style="width:220px;background:#fff;border:0.5px solid #e2e8f0;border-radius:12px;padding:1rem;flex-shrink:0;">
      <div style="font-size:12px;color:#94a3b8;text-align:center;padding:1rem 0;">Clica num slot para ver detalhes e acções.</div>
    </div>
  </div>

</div>

<div id="gaModalOverlay" style="display:none;position:fixed;inset:0;background:rgba(15,45,82,0.3);display:none;align-items:center;justify-content:center;z-index:1000;padding:16px;">
  <div id="gaModalBox" style="background:#fff;border-radius:14px;border:1px solid #e2e8f0;box-shadow:0 4px 24px rgba(15,45,82,0.1);width:min(420px,100%);padding:1.25rem;max-height:90vh;overflow-y:auto;"></div>
</div>`;
}

/* ── Wiring principal ─────────────────────────────────── */
function _wireShell() {
  document.getElementById("gaBtnPrev")?.addEventListener("click", () => { _state.selectedDayISO = addDays(_state.selectedDayISO, -1); _loadAndRender(); });
  document.getElementById("gaBtnNext")?.addEventListener("click", () => { _state.selectedDayISO = addDays(_state.selectedDayISO, 1); _loadAndRender(); });
  document.getElementById("gaBtnHoje")?.addEventListener("click", () => { _state.selectedDayISO = todayISO(); _loadAndRender(); });
  document.getElementById("gaSelClinica")?.addEventListener("change", e => { _state.selectedClinicId = e.target.value; _loadAndRender(); });
  document.getElementById("gaBtnRec")?.addEventListener("click", () => _openModalRecorrente());
  document.getElementById("gaBtnBloq")?.addEventListener("click", () => _openModalBloqueio());
  document.getElementById("gaBtnSemana")?.addEventListener("click", () => _toggleSemana());

  if (_state.selectedClinicId) {
    const sel = document.getElementById("gaSelClinica");
    if (sel) sel.value = _state.selectedClinicId;
  }
}

/* ── Load & render ────────────────────────────────────── */
async function _loadAndRender() {
  _renderDayLabel();
  _renderTimeline([]);
  _renderStats([]);

  const clinicId = _state.selectedClinicId || document.getElementById("gaSelClinica")?.value;
  if (!clinicId) return;
  _state.selectedClinicId = clinicId;

  const dayISO = _state.selectedDayISO;
  const startISO = dayISO + "T00:00:00.000Z";
  const endISO   = dayISO + "T23:59:59.999Z";

  try {
    const { data, error } = await window.sb
      .from("appointments")
      .select("id, start_at, end_at, status, mode, procedure_type, title, notes, patient_id, meet_link")
      .eq("clinic_id", clinicId)
      .gte("start_at", startISO)
      .lte("start_at", endISO)
      .order("start_at", { ascending: true });

    if (error) throw error;
    _state.rows = data || [];
  } catch(e) {
    console.error("gestaoagenda load:", e);
    _state.rows = [];
  }

  const patientIds = _state.rows.map(r => r.patient_id).filter(Boolean);
  let patientsById = {};
  if (patientIds.length) {
    try {
      const { data } = await window.sb.from("patients").select("id, full_name, sns").in("id", patientIds);
      (data||[]).forEach(p => { patientsById[p.id] = p; });
    } catch(_) {}
  }

  await _loadHorarios(clinicId);
  _renderRecBanner(clinicId);
  _renderStats(_state.rows);
  _renderTimeline(_state.rows, patientsById);
}

function _renderDayLabel() {
  const el = document.getElementById("gaDayLabel");
  if (el) el.textContent = isoToDisplay(_state.selectedDayISO);
}

/* ── Horários recorrentes ─────────────────────────────── */
async function _loadHorarios(clinicId) {
  try {
    const { data } = await window.sb
      .from("horarios_recorrentes")
      .select("*")
      .eq("clinic_id", clinicId)
      .eq("is_active", true);
    _state.horarios = data || [];
  } catch(_) { _state.horarios = []; }
}

function _renderRecBanner(clinicId) {
  const el = document.getElementById("gaRecBanner");
  if (!el) return;
  if (!_state.horarios.length) { el.innerHTML = ""; return; }

  const DOW = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  const items = _state.horarios.map(h =>
    `${DOW[h.day_of_week]} ${h.hora_inicio}–${h.hora_fim} · ${h.duracao_min} min`
  ).join(" | ");

  el.innerHTML = `<div style="background:#eff6ff;border:0.5px solid #93c5fd;border-radius:8px;padding:8px 12px;font-size:12px;color:#1e40af;display:flex;align-items:center;justify-content:space-between;gap:8px;">
    <span>Disponibilidade activa: ${escapeHtml(items)}</span>
    <button id="gaBtnEditRec" style="font-size:11px;padding:3px 8px;border-radius:6px;border:0.5px solid #93c5fd;background:#fff;color:#1e40af;cursor:pointer;">Editar</button>
  </div>`;
  document.getElementById("gaBtnEditRec")?.addEventListener("click", _openModalRecorrente);
}

/* ── Stats ────────────────────────────────────────────── */
function _renderStats(rows) {
  const el = document.getElementById("gaStats");
  if (!el) return;
  const livres   = rows.filter(r => r.mode === "slot" && r.status === "available").length;
  const ocupados = rows.filter(r => r.mode !== "bloqueio" && r.mode !== "slot" && r.patient_id).length;
  const bloq     = rows.filter(r => r.mode === "bloqueio").length;
  const total    = livres + ocupados;
  const taxa     = total > 0 ? Math.round((ocupados/total)*100) : 0;

  el.innerHTML = `
    <div style="background:#f8fafc;border-radius:8px;padding:10px 12px;"><div style="font-size:20px;font-weight:700;color:#0f172a;">${livres}</div><div style="font-size:11px;color:#94a3b8;margin-top:2px;">Slots livres</div></div>
    <div style="background:#f8fafc;border-radius:8px;padding:10px 12px;"><div style="font-size:20px;font-weight:700;color:#0f172a;">${ocupados}</div><div style="font-size:11px;color:#94a3b8;margin-top:2px;">Ocupados</div></div>
    <div style="background:#f8fafc;border-radius:8px;padding:10px 12px;"><div style="font-size:20px;font-weight:700;color:#0f172a;">${bloq}</div><div style="font-size:11px;color:#94a3b8;margin-top:2px;">Bloqueados</div></div>
    <div style="background:#f8fafc;border-radius:8px;padding:10px 12px;">
      <div style="font-size:20px;font-weight:700;color:#0f172a;">${taxa}%</div>
      <div style="font-size:11px;color:#94a3b8;margin-top:2px;">Ocupação</div>
      <div style="height:4px;border-radius:2px;background:#e2e8f0;margin-top:6px;"><div style="height:100%;border-radius:2px;background:#1a56db;width:${taxa}%;"></div></div>
    </div>`;
}

/* ── Timeline ─────────────────────────────────────────── */
const ESTADO_META = {
  scheduled: { label:"Marcado",  bg:"#dbeafe", color:"#1e40af", dot:"#3b82f6" },
  arrived:   { label:"Chegou",   bg:"#fef3c7", color:"#92400e", dot:"#f59e0b" },
  done:      { label:"Realizada",bg:"#d1fae5", color:"#065f46", dot:"#10b981" },
  no_show:   { label:"Falta",    bg:"#fee2e2", color:"#991b1b", dot:"#ef4444" },
  available: { label:"Livre",    bg:"#f1f5f9", color:"#64748b", dot:"#cbd5e1" },
  bloqueio:  { label:"Bloqueado",bg:"#fee2e2", color:"#991b1b", dot:"#ef4444" },
  extra:     { label:"Extra",    bg:"#fef3c7", color:"#92400e", dot:"#f59e0b" },
};

function _renderTimeline(rows, patientsById = {}) {
  const el = document.getElementById("gaTimeline");
  if (!el) return;

  if (!rows.length) {
    el.innerHTML = `
      <div style="padding:32px;text-align:center;color:#94a3b8;font-size:13px;">Sem slots para este dia.</div>
      <div style="padding:0 12px 16px;text-align:center;">
        <button id="gaBtnCriarExtra" style="font-size:12px;padding:6px 16px;border-radius:8px;border:0.5px solid #fcd34d;background:#fef3c7;color:#92400e;cursor:pointer;">+ Consulta extra</button>
      </div>`;
    document.getElementById("gaBtnCriarExtra")?.addEventListener("click", () => _criarExtra());
    return;
  }

  const html = rows.map((r, i) => {
    const isBlocked = r.mode === "bloqueio";
    const isSlot    = r.mode === "slot" && r.status === "available";
    const isExtra   = r.mode === "extra";
    const patient   = patientsById[r.patient_id];
    const nome      = patient?.full_name || r.title || "—";
    const sns       = patient?.sns ? "SNS: " + patient.sns : "";
    const hora      = fmtHM(new Date(r.start_at));
    const tipo      = r.procedure_type || "—";

    let meta;
    if (isBlocked) meta = ESTADO_META.bloqueio;
    else if (isSlot) meta = ESTADO_META.available;
    else if (isExtra) meta = ESTADO_META.extra;
    else meta = ESTADO_META[r.status] || ESTADO_META.scheduled;

    const borderLeft = isExtra ? "border-left:3px solid #f59e0b;" : isBlocked ? "border-left:3px solid #ef4444;" : "";

    return `<div class="ga-tl-row" data-idx="${i}" style="display:grid;grid-template-columns:60px 1fr 140px 110px;padding:8px 12px;border-bottom:0.5px solid #f1f5f9;gap:8px;align-items:center;cursor:pointer;${borderLeft}">
      <div style="font-size:12px;font-weight:600;color:${isBlocked?"#ef4444":isExtra?"#92400e":"#475569"};white-space:nowrap;">${hora}</div>
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="width:8px;height:8px;border-radius:50%;background:${meta.dot};flex-shrink:0;"></div>
        <div>
          <div style="font-size:13px;font-weight:${isSlot?"400":"600"};color:${isSlot?"#94a3b8":"#0f172a"};">${isSlot?"Livre":escapeHtml(nome)}</div>
          ${sns&&!isSlot?`<div style="font-size:11px;color:#94a3b8;">${escapeHtml(sns)}</div>`:""}
          ${isExtra?`<div style="font-size:11px;color:#92400e;">Consulta extra</div>`:""}
        </div>
      </div>
      <div style="font-size:12px;color:#64748b;">${isSlot||isBlocked?"":escapeHtml(tipo)}</div>
      <div style="display:flex;align-items:center;gap:6px;">
        <span style="padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;background:${meta.bg};color:${meta.color};">${meta.label}</span>
        ${isSlot?`<button class="ga-btn-marcar" data-idx="${i}" style="font-size:11px;color:#1a56db;border:0.5px solid #93c5fd;background:#eff6ff;border-radius:6px;padding:2px 8px;cursor:pointer;">+ Marcar</button>`:""}
      </div>
    </div>`;
  }).join("");

  el.innerHTML = html + `<div style="padding:10px 12px;border-top:0.5px solid #f1f5f9;text-align:right;">
    <button id="gaBtnCriarExtra" style="font-size:12px;padding:5px 14px;border-radius:8px;border:0.5px solid #fcd34d;background:#fef3c7;color:#92400e;cursor:pointer;">+ Consulta extra</button>
  </div>`;

  el.querySelectorAll(".ga-tl-row").forEach(row => {
    row.addEventListener("mouseenter", () => { if (!row.classList.contains("ga-selected")) row.style.background = "#f8faff"; });
    row.addEventListener("mouseleave", () => { if (!row.classList.contains("ga-selected")) row.style.background = ""; });
    row.addEventListener("click", () => {
      el.querySelectorAll(".ga-tl-row").forEach(r => { r.classList.remove("ga-selected"); r.style.background = ""; });
      row.classList.add("ga-selected");
      row.style.background = "#eff6ff";
      const idx = parseInt(row.getAttribute("data-idx"));
      _renderPanel(rows[idx], patientsById);
    });
  });

  el.querySelectorAll(".ga-btn-marcar").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const idx = parseInt(btn.getAttribute("data-idx"));
      const r = rows[idx];
      openApptModal({ mode: "new", row: null, prefillDatetime: r.start_at, prefillClinicId: _state.selectedClinicId });
    });
  });

  document.getElementById("gaBtnCriarExtra")?.addEventListener("click", () => _criarExtra());
}

/* ── Painel lateral ───────────────────────────────────── */
function _renderPanel(row, patientsById = {}) {
  const el = document.getElementById("gaPanel");
  if (!el) return;

  const isBlocked = row.mode === "bloqueio";
  const isSlot    = row.mode === "slot" && row.status === "available";
  const isExtra   = row.mode === "extra";
  const patient   = patientsById[row.patient_id];
  const nome      = patient?.full_name || row.title || "—";
  const hora      = fmtHM(new Date(row.start_at));
  const meta      = isBlocked ? ESTADO_META.bloqueio : isSlot ? ESTADO_META.available : isExtra ? ESTADO_META.extra : (ESTADO_META[row.status] || ESTADO_META.scheduled);

  let warn = "";
  if (isBlocked) warn = `<div style="padding:8px 10px;background:#fef3c7;border:0.5px solid #fcd34d;border-radius:8px;font-size:11px;color:#92400e;margin-bottom:8px;">Slot indisponível — para marcar contacte o Dr. João Morais.</div>`;
  if (isExtra)   warn = `<div style="padding:8px 10px;background:#fef3c7;border:0.5px solid #fcd34d;border-radius:8px;font-size:11px;color:#92400e;margin-bottom:8px;">Consulta extra — fora de slot recorrente.</div>`;

  let actions = "";
  if (isSlot) {
    actions = `<button class="ga-pa-btn ga-pa-blue" data-action="marcar">Marcar este slot</button>`;
  } else if (isBlocked) {
    actions = `
      <button class="ga-pa-btn ga-pa-red" data-action="remover-bloq">Remover bloqueio</button>
      <button class="ga-pa-btn ga-pa-amber" data-action="forcar">Forçar mesmo assim</button>`;
  } else {
    actions = `
      <button class="ga-pa-btn ga-pa-amber" data-action="chegou">Chegou</button>
      <button class="ga-pa-btn ga-pa-green" data-action="realizada">Realizada</button>
      <button class="ga-pa-btn ga-pa-red" data-action="falta">Registar falta</button>
      <div style="height:0.5px;background:#e2e8f0;"></div>
      <button class="ga-pa-btn" data-action="editar">Editar marcação</button>
      <button class="ga-pa-btn ga-pa-blue" data-action="ficha">Ver ficha do doente</button>
      ${row.meet_link ? `<a href="${escapeHtml(row.meet_link)}" target="_blank" style="display:flex;align-items:center;justify-content:center;gap:6px;padding:7px 10px;border-radius:8px;font-size:12px;font-weight:500;background:#d1fae5;color:#065f46;border:0.5px solid #6ee7b7;text-decoration:none;margin-top:2px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.361a1 1 0 01-1.447.894L15 14"/><rect x="3" y="6" width="12" height="12" rx="2"/></svg>Abrir Google Meet</a>` : ""}`;
  }

  el.innerHTML = `
    <div style="font-size:11px;color:#94a3b8;margin-bottom:4px;">${hora}</div>
    <div style="font-size:14px;font-weight:700;color:#0f172a;margin-bottom:2px;">${escapeHtml(nome)}</div>
    ${row.procedure_type&&!isSlot&&!isBlocked?`<div style="font-size:12px;color:#64748b;margin-bottom:8px;">${escapeHtml(row.procedure_type)}</div>`:""}
    <span style="padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;background:${meta.bg};color:${meta.color};">${meta.label}</span>
    <div style="height:0.5px;background:#e2e8f0;margin:12px 0;"></div>
    ${warn}
    <div style="display:flex;flex-direction:column;gap:6px;">${actions}</div>`;

  el.querySelectorAll(".ga-pa-btn").forEach(btn => {
    btn.style.cssText = "padding:7px 10px;border-radius:8px;font-size:12px;font-weight:500;cursor:pointer;text-align:center;border:0.5px solid #e2e8f0;background:#fff;color:#0f172a;width:100%;";
    const a = btn.getAttribute("data-action");
    if (a==="marcar"||a==="ficha"||a==="editar"||a==="forcar") { btn.style.background="#eff6ff"; btn.style.color="#1a56db"; btn.style.borderColor="#93c5fd"; }
    if (a==="chegou") { btn.style.background="#fef3c7"; btn.style.color="#92400e"; btn.style.borderColor="#fcd34d"; }
    if (a==="realizada") { btn.style.background="#d1fae5"; btn.style.color="#065f46"; btn.style.borderColor="#6ee7b7"; }
    if (a==="falta"||a==="remover-bloq") { btn.style.background="#fee2e2"; btn.style.color="#991b1b"; btn.style.borderColor="#fca5a5"; }
    if (a==="forcar") { btn.style.background="#fef3c7"; btn.style.color="#92400e"; btn.style.borderColor="#fcd34d"; }
  });

  el.querySelector("[data-action='marcar']")?.addEventListener("click", () => {
    openApptModal({ mode:"new", row:null, prefillDatetime: row.start_at, prefillClinicId: _state.selectedClinicId });
  });
  el.querySelector("[data-action='editar']")?.addEventListener("click", () => {
    openApptModal({ mode:"edit", row });
  });
  el.querySelector("[data-action='ficha']")?.addEventListener("click", () => {
    if (row.patient_id && window.__gc_openPatientViewModal) {
      const p = { id: row.patient_id };
      window.__gc_openPatientViewModal(p);
    }
  });
  el.querySelector("[data-action='chegou']")?.addEventListener("click", () => _updateStatus(row.id, "arrived"));
  el.querySelector("[data-action='realizada']")?.addEventListener("click", () => _updateStatus(row.id, "done"));
  el.querySelector("[data-action='falta']")?.addEventListener("click", () => _updateStatus(row.id, "no_show"));
  el.querySelector("[data-action='remover-bloq']")?.addEventListener("click", async () => {
    if (!confirm("Remover este bloqueio?")) return;
    await window.sb.from("appointments").delete().eq("id", row.id);
    el.innerHTML = '<div style="font-size:12px;color:#94a3b8;text-align:center;padding:1rem 0;">Clica num slot para ver detalhes e acções.</div>';
    _loadAndRender();
  });
  el.querySelector("[data-action='forcar']")?.addEventListener("click", () => {
    if (confirm("Este horário está indisponível.\n\nContacte o Dr. João Morais para confirmação antes de avançar.\n\nForçar mesmo assim?")) {
      openApptModal({ mode:"new", row:null, prefillDatetime: row.start_at, prefillClinicId: _state.selectedClinicId });
    }
  });
}

async function _updateStatus(id, status) {
  try {
    await window.sb.from("appointments").update({ status }).eq("id", id);
    _loadAndRender();
  } catch(e) { alert("Erro ao actualizar estado: " + (e.message||e)); }
}

/* ── Consulta extra ───────────────────────────────────── */
function _criarExtra() {
  const dt = _state.selectedDayISO + "T09:00:00";
  openApptModal({ mode:"new", row:null, prefillDatetime: dt, prefillClinicId: _state.selectedClinicId });
}

/* ── Vista semanal ────────────────────────────────────── */
let _semanaVisible = false;
async function _toggleSemana() {
  _semanaVisible = !_semanaVisible;
  const btn = document.getElementById("gaBtnSemana");
  if (btn) { btn.style.background = _semanaVisible ? "#1a56db" : ""; btn.style.color = _semanaVisible ? "#fff" : ""; }
  const banner = document.getElementById("gaSemanaBanner");
  if (!banner) return;
  if (!_semanaVisible) { banner.style.display = "none"; banner.innerHTML = ""; return; }
  banner.style.display = "block";
  banner.innerHTML = `<div style="background:#fff;border:0.5px solid #e2e8f0;border-radius:12px;padding:10px;"><div style="font-size:12px;color:#94a3b8;text-align:center;padding:8px 0;">A carregar semana…</div></div>`;
  await _renderSemana();
}

async function _renderSemana() {
  const banner = document.getElementById("gaSemanaBanner");
  if (!banner) return;
  const clinicId = _state.selectedClinicId;
  const d = new Date(_state.selectedDayISO + "T00:00:00");
  const dow = (d.getDay()+6)%7;
  const seg = new Date(d); seg.setDate(d.getDate()-dow);

  const dias = [];
  for (let i=0; i<7; i++) {
    const dt = new Date(seg); dt.setDate(seg.getDate()+i);
    dias.push(dt.getFullYear()+"-"+pad2(dt.getMonth()+1)+"-"+pad2(dt.getDate()));
  }

  const DAYS = ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];
  const hoje = todayISO();

  try {
    const { data } = await window.sb
      .from("appointments")
      .select("start_at, status, mode, patient_id")
      .eq("clinic_id", clinicId)
      .gte("start_at", dias[0]+"T00:00:00.000Z")
      .lte("start_at", dias[6]+"T23:59:59.999Z");

    const byDay = {};
    dias.forEach(d => { byDay[d] = []; });
    (data||[]).forEach(r => { const d = r.start_at.slice(0,10); if (byDay[d]) byDay[d].push(r); });

    const cols = dias.map((iso, i) => {
      const rows = byDay[iso]||[];
      const isHoje = iso === hoje;
      const isSelected = iso === _state.selectedDayISO;
      const dt = new Date(iso+"T00:00:00");
      const dots = rows.slice(0,6).map(r => {
        const isB = r.mode==="bloqueio";
        const isL = r.mode==="slot"&&r.status==="available";
        const bg  = isB?"#ef4444":isL?"#e2e8f0":r.status==="done"?"#10b981":r.status==="arrived"?"#f59e0b":"#3b82f6";
        return `<div style="width:8px;height:8px;border-radius:2px;background:${bg};"></div>`;
      }).join("");

      return `<div onclick="window.__gaGoDay('${iso}')" style="cursor:pointer;display:flex;flex-direction:column;gap:4px;padding:6px 4px;border-radius:8px;background:${isSelected?"#eff6ff":""};border:0.5px solid ${isSelected?"#93c5fd":"transparent"};">
        <div style="font-size:10px;font-weight:600;text-align:center;color:${isHoje?"#1a56db":isSelected?"#1a56db":"#64748b"};">${DAYS[i]} ${dt.getDate()}</div>
        <div style="display:flex;flex-wrap:wrap;gap:2px;justify-content:center;">${dots||'<div style="height:8px;"></div>'}</div>
        <div style="font-size:10px;text-align:center;color:#94a3b8;">${rows.length||""}</div>
      </div>`;
    }).join("");

    banner.innerHTML = `<div style="background:#fff;border:0.5px solid #e2e8f0;border-radius:12px;padding:10px;">
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;">${cols}</div>
      <div style="display:flex;gap:12px;margin-top:10px;padding-top:8px;border-top:0.5px solid #e2e8f0;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:4px;font-size:11px;color:#64748b;"><div style="width:8px;height:8px;border-radius:2px;background:#3b82f6;"></div>Marcado</div>
        <div style="display:flex;align-items:center;gap:4px;font-size:11px;color:#64748b;"><div style="width:8px;height:8px;border-radius:2px;background:#10b981;"></div>Realizado</div>
        <div style="display:flex;align-items:center;gap:4px;font-size:11px;color:#64748b;"><div style="width:8px;height:8px;border-radius:2px;background:#ef4444;"></div>Bloqueado</div>
        <div style="display:flex;align-items:center;gap:4px;font-size:11px;color:#64748b;"><div style="width:8px;height:8px;border-radius:2px;background:#e2e8f0;"></div>Livre</div>
      </div>
    </div>`;
  } catch(e) {
    banner.innerHTML = `<div style="color:#b00020;font-size:13px;padding:12px;">Erro ao carregar semana.</div>`;
  }

  window.__gaGoDay = (iso) => { _state.selectedDayISO = iso; _loadAndRender(); if (_semanaVisible) _renderSemana(); };
}

/* ── Modal horário recorrente ─────────────────────────── */
function _openModalRecorrente() {
  const clinicas = G.clinics||[];
  const DOW_OPTS = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"]
    .map((d,i) => `<option value="${i}">${d}</option>`).join("");
  const clinicOpts = clinicas.map(c =>
    `<option value="${escapeHtml(c.id)}"${c.id===_state.selectedClinicId?" selected":""}>${escapeHtml(c.name||c.slug||c.id)}</option>`
  ).join("");

  const existing = _state.horarios[0];

  _showModal(`
    <div style="font-size:16px;font-weight:700;color:#0f2d52;margin-bottom:4px;">Disponibilidade</div>
    <div style="font-size:12px;color:#64748b;margin-bottom:1rem;">Define uma vez — slots gerados automaticamente.</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
      <div style="display:flex;flex-direction:column;gap:4px;"><label style="font-size:11px;color:#64748b;">Dia da semana</label>
        <select id="gaRecDow" class="gcSelect" style="font-size:12px;">${DOW_OPTS}</select></div>
      <div style="display:flex;flex-direction:column;gap:4px;"><label style="font-size:11px;color:#64748b;">Clínica</label>
        <select id="gaRecClinica" class="gcSelect" style="font-size:12px;">${clinicOpts}</select></div>
      <div style="display:flex;flex-direction:column;gap:4px;"><label style="font-size:11px;color:#64748b;">Início</label>
        <input id="gaRecInicio" type="time" value="${existing?.hora_inicio||'15:00'}" style="padding:6px 8px;border-radius:8px;border:1px solid #e2e8f0;font-size:12px;"/></div>
      <div style="display:flex;flex-direction:column;gap:4px;"><label style="font-size:11px;color:#64748b;">Fim</label>
        <input id="gaRecFim" type="time" value="${existing?.hora_fim||'16:40'}" style="padding:6px 8px;border-radius:8px;border:1px solid #e2e8f0;font-size:12px;"/></div>
      <div style="display:flex;flex-direction:column;gap:4px;"><label style="font-size:11px;color:#64748b;">Duração</label>
        <select id="gaRecDur" class="gcSelect" style="font-size:12px;">
          <option value="15">15 min</option>
          <option value="20" ${(!existing||existing.duracao_min===20)?"selected":""}>20 min</option>
        </select></div>
      <div style="display:flex;flex-direction:column;gap:4px;"><label style="font-size:11px;color:#64748b;">Gerar até</label>
        <select id="gaRecSemanas" class="gcSelect" style="font-size:12px;">
          <option value="520" selected>Sempre</option>
          <option value="4">4 semanas</option>
          <option value="8">1 mês</option>
        </select></div>
    </div>
    <div id="gaRecPreview" style="padding:8px 10px;background:#eff6ff;border-radius:8px;font-size:12px;color:#1e40af;margin-bottom:1rem;"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;align-items:center;">
      ${existing ? `<button id="gaRecDeleteBtn" style="font-size:12px;padding:6px 14px;border-radius:8px;border:0.5px solid #fca5a5;background:#fee2e2;color:#991b1b;cursor:pointer;font-weight:500;">Eliminar</button><div style="flex:1;"></div>` : '<div style="flex:1;"></div>'}
      <button onclick="document.getElementById('gaModalOverlay').style.display='none'" class="gcBtnGhost" style="font-size:12px;padding:6px 14px;">Cancelar</button>
      <button id="gaRecSaveBtn" class="gcBtnSuccess" style="font-size:12px;padding:6px 18px;font-weight:600;">Guardar horário</button>
    </div>`);

  if (existing) document.getElementById("gaRecDow").value = existing.day_of_week;

  function updatePreview() {
    const ini = document.getElementById("gaRecInicio")?.value||"15:00";
    const fim = document.getElementById("gaRecFim")?.value||"16:40";
    const dur = parseInt(document.getElementById("gaRecDur")?.value||"20");
    const slots = gerarSlots(ini, fim, dur);
    const el = document.getElementById("gaRecPreview");
    if (el) el.textContent = "Slots: " + slots.join(" · ");
  }
  ["gaRecInicio","gaRecFim","gaRecDur"].forEach(id => document.getElementById(id)?.addEventListener("change", updatePreview));
  updatePreview();

  document.getElementById("gaRecDeleteBtn")?.addEventListener("click", async () => {
    if (!existing) return;
    if (!confirm("Eliminar esta disponibilidade recorrente?\n\nOs slots já gerados nas consultas não são afectados.")) return;
    try {
      await window.sb.from("horarios_recorrentes").update({ is_active: false }).eq("id", existing.id);
      document.getElementById("gaModalOverlay").style.display = "none";
      _loadAndRender();
    } catch(e) { alert("Erro: " + (e.message||e)); }
  });

  document.getElementById("gaRecSaveBtn")?.addEventListener("click", async () => {
    const dow    = parseInt(document.getElementById("gaRecDow")?.value||"2");
    const clinId = document.getElementById("gaRecClinica")?.value||_state.selectedClinicId;
    const ini    = document.getElementById("gaRecInicio")?.value||"15:00";
    const fim    = document.getElementById("gaRecFim")?.value||"16:40";
    const dur    = parseInt(document.getElementById("gaRecDur")?.value||"20");
    const sems   = parseInt(document.getElementById("gaRecSemanas")?.value||"8");

    try {
      await window.sb.from("horarios_recorrentes").upsert({
        id: existing?.id || undefined,
        clinic_id: clinId, day_of_week: dow,
        hora_inicio: ini, hora_fim: fim,
        duracao_min: dur, is_active: true
      }, { onConflict: "id" });

      const slots = gerarSlots(ini, fim, dur);
      const rows = [];
      for (let w=0; w<sems; w++) {
        const base = new Date();
        const baseDow = (base.getDay()+6)%7;
        const diff = ((dow===0?7:dow) - (baseDow===0?7:baseDow) + 7) % 7 || 7;
        const first = new Date(base); first.setDate(base.getDate() + diff + w*7);
        const isoDate = first.getFullYear()+"-"+pad2(first.getMonth()+1)+"-"+pad2(first.getDate());
        for (const slot of slots) {
          const [sh,sm] = slot.split(":").map(Number);
          const startD = new Date(isoDate+"T"+pad2(sh)+":"+pad2(sm)+":00");
          const endD   = new Date(startD.getTime()+dur*60000);
          rows.push({ clinic_id: clinId, patient_id: null, start_at: startD.toISOString(), end_at: endD.toISOString(), status: "available", procedure_type: null, title: "SLOT", notes: null, mode: "presencial" });
        }
      }

      const { error } = await window.sb.from("appointments").insert(rows);
      if (error) throw error;

      document.getElementById("gaModalOverlay").style.display = "none";
      alert(`Horário guardado. ${rows.length} slots criados para ${sems} semanas.`);
      _loadAndRender();
    } catch(e) { alert("Erro: " + (e.message||e)); }
  });
}

/* ── Modal bloqueio ───────────────────────────────────── */
function _openModalBloqueio() {
  const clinicas = G.clinics||[];
  const checks = clinicas.map(c =>
    `<label style="display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:8px;cursor:pointer;border:0.5px solid #e2e8f0;font-size:13px;">
      <input type="checkbox" data-cid="${escapeHtml(c.id)}" style="accent-color:#1a56db;" ${c.id===_state.selectedClinicId?"checked":""}/>
      ${escapeHtml(c.name||c.slug||c.id)}
    </label>`).join("");

  _showModal(`
    <div style="font-size:16px;font-weight:700;color:#0f2d52;margin-bottom:4px;">Bloquear disponibilidade</div>
    <div style="font-size:12px;color:#64748b;margin-bottom:1rem;">O slot fica indisponível mas pode ser forçado com aviso.</div>

    <div style="display:flex;gap:6px;margin-bottom:12px;">
      <button id="gaBTDia" onclick="setBloqTipo('dia')" style="padding:5px 12px;font-size:12px;border-radius:999px;border:0.5px solid #1a56db;background:#eff6ff;color:#1a56db;cursor:pointer;">Dia inteiro</button>
      <button id="gaBTHoras" onclick="setBloqTipo('horas')" style="padding:5px 12px;font-size:12px;border-radius:999px;border:0.5px solid #e2e8f0;background:transparent;color:#64748b;cursor:pointer;">Período de horas</button>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
      <div style="display:flex;flex-direction:column;gap:4px;"><label style="font-size:11px;color:#64748b;">De</label><input id="gaBloqDe" type="date" style="padding:6px 8px;border-radius:8px;border:1px solid #e2e8f0;font-size:12px;"/></div>
      <div style="display:flex;flex-direction:column;gap:4px;"><label style="font-size:11px;color:#64748b;">Até</label><input id="gaBloqAte" type="date" style="padding:6px 8px;border-radius:8px;border:1px solid #e2e8f0;font-size:12px;"/></div>
    </div>
    <div id="gaBloqHorasRow" style="display:none;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
      <div style="display:flex;flex-direction:column;gap:4px;"><label style="font-size:11px;color:#64748b;">Das</label><input id="gaBloqHoraIni" type="time" value="16:40" style="padding:6px 8px;border-radius:8px;border:1px solid #e2e8f0;font-size:12px;"/></div>
      <div style="display:flex;flex-direction:column;gap:4px;"><label style="font-size:11px;color:#64748b;">Às</label><input id="gaBloqHoraFim" type="time" value="17:00" style="padding:6px 8px;border-radius:8px;border:1px solid #e2e8f0;font-size:12px;"/></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
      <div style="display:flex;flex-direction:column;gap:4px;">
        <label style="font-size:11px;color:#64748b;">Clínicas</label>
        <div style="display:flex;flex-direction:column;gap:4px;">${checks}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <div style="display:flex;flex-direction:column;gap:4px;"><label style="font-size:11px;color:#64748b;">Motivo</label>
          <select id="gaBloqMotivo" class="gcSelect" style="font-size:12px;">
            <option>Férias</option><option>FPF</option><option>Congresso</option><option>Outro</option>
          </select></div>
        <div style="display:flex;flex-direction:column;gap:4px;"><label style="font-size:11px;color:#64748b;">Nota (opcional)</label>
          <input id="gaBloqNota" type="text" placeholder="Ex: FPF — estágio" style="padding:6px 8px;border-radius:8px;border:1px solid #e2e8f0;font-size:12px;font-family:inherit;"/></div>
      </div>
    </div>

    <div style="padding:8px 10px;background:#fef3c7;border:0.5px solid #fcd34d;border-radius:8px;font-size:11px;color:#92400e;margin-bottom:12px;">
      Não apaga marcações existentes. Pode ser forçado com aviso "Contactar Dr. João Morais".
    </div>

    <div style="display:flex;gap:8px;justify-content:flex-end;">
      <button onclick="document.getElementById('gaModalOverlay').style.display='none'" class="gcBtnGhost" style="font-size:12px;padding:6px 14px;">Cancelar</button>
      <button id="gaBloqSaveBtn" class="gcBtnDanger" style="font-size:12px;padding:6px 18px;font-weight:600;">Bloquear</button>
    </div>`);

  window.setBloqTipo = (t) => {
    document.getElementById("gaBloqHorasRow").style.display = t==="horas" ? "grid" : "none";
    document.getElementById("gaBTDia").style.background  = t==="dia"   ? "#eff6ff" : "transparent";
    document.getElementById("gaBTDia").style.color       = t==="dia"   ? "#1a56db" : "#64748b";
    document.getElementById("gaBTDia").style.borderColor = t==="dia"   ? "#1a56db" : "#e2e8f0";
    document.getElementById("gaBTHoras").style.background  = t==="horas" ? "#eff6ff" : "transparent";
    document.getElementById("gaBTHoras").style.color       = t==="horas" ? "#1a56db" : "#64748b";
    document.getElementById("gaBTHoras").style.borderColor = t==="horas" ? "#1a56db" : "#e2e8f0";
  };

  const today = todayISO();
  document.getElementById("gaBloqDe").value  = today;
  document.getElementById("gaBloqAte").value = today;

  document.getElementById("gaBloqSaveBtn")?.addEventListener("click", async () => {
    const de     = document.getElementById("gaBloqDe")?.value;
    const ate    = document.getElementById("gaBloqAte")?.value;
    const hi     = document.getElementById("gaBloqHoraIni")?.value || "00:00";
    const hf     = document.getElementById("gaBloqHoraFim")?.value || "23:59";
    const motivo = document.getElementById("gaBloqMotivo")?.value || "Bloqueio";
    const nota   = document.getElementById("gaBloqNota")?.value?.trim() || "";
    const isHoras = document.getElementById("gaBloqHorasRow")?.style.display !== "none";

    if (!de||!ate) { alert("Preenche as datas."); return; }

    const targetIds = [];
    document.querySelectorAll("#gaModalBox input[type=checkbox][data-cid]").forEach(cb => {
      if (cb.checked) targetIds.push(cb.getAttribute("data-cid"));
    });
    if (!targetIds.length) { alert("Selecciona pelo menos uma clínica."); return; }

    const rows = [];
    let cur = new Date(de+"T00:00:00");
    const end = new Date(ate+"T00:00:00");
    while (cur <= end) {
      const isoDate = cur.getFullYear()+"-"+pad2(cur.getMonth()+1)+"-"+pad2(cur.getDate());
      const startStr = isHoras ? isoDate+"T"+hi+":00" : isoDate+"T00:00:00";
      const endStr   = isHoras ? isoDate+"T"+hf+":00" : isoDate+"T23:59:59";
      for (const cid of targetIds) {
        rows.push({ clinic_id: cid, patient_id: null, start_at: new Date(startStr).toISOString(), end_at: new Date(endStr).toISOString(), status: "confirmed", procedure_type: null, title: "BLOQUEIO", notes: nota||motivo, mode: "bloqueio" // ← manter como estava
        });
      }
      cur.setDate(cur.getDate()+1);
    }

    try {
      const { error } = await window.sb.from("appointments").insert(rows);
      if (error) throw error;
      document.getElementById("gaModalOverlay").style.display = "none";
      alert("Bloqueio criado com sucesso.");
      _loadAndRender();
    } catch(e) { alert("Erro: " + (e.message||e)); }
  });
}

/* ── Helper modal ─────────────────────────────────────── */
function _showModal(html) {
  const ov  = document.getElementById("gaModalOverlay");
  const box = document.getElementById("gaModalBox");
  if (!ov||!box) return;
  box.innerHTML = html;
  ov.style.display = "flex";
  ov.addEventListener("click", e => { if (e.target===ov) ov.style.display="none"; }, { once: true });
}
