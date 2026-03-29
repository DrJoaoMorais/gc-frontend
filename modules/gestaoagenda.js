/* ========================================================
   GESTAOAGENDA.JS — Timeline clínica com slots, bloqueios
   e horários recorrentes
   ======================================================== */

import { G } from "./state.js";
import { escapeHtml } from "./helpers.js";
import { openApptModal } from "./agenda.js";

const GCAL_WORKER_URL = window.__GC_GCAL_WORKER_URL__ || "";

function pad2(n) { return String(n).padStart(2, "0"); }
function fmtHM(date) { return date.toLocaleString("pt-PT",{timeZone:"Europe/Lisbon",hour:"2-digit",minute:"2-digit"}); }
function todayISO() { return new Date().toLocaleDateString("pt-PT",{timeZone:"Europe/Lisbon",year:"numeric",month:"2-digit",day:"2-digit"}).split("/").reverse().join("-"); }
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
export async function initGestaoAgenda() {
  const root = document.getElementById("gcGestaoAgendaRoot");
  if (!root) return;

  _state.selectedDayISO = G.selectedDayISO || todayISO();
  _state.selectedClinicId = null;

  root.innerHTML = _buildShell();
  _wireShell();
  // Refresh automático quando o modal de consulta guarda
  window.__gc_onApptSaved = async () => {
    await _loadAndRender();
    if (_semanaVisible) _renderSemana();
  };
  await _loadAndRender();

  // Vista semanal activa por defeito
  _semanaVisible = true;
  const btn = document.getElementById("gaBtnSemana");
  if (btn) { btn.style.background = "#1a56db"; btn.style.color = "#fff"; }
  const banner = document.getElementById("gaSemanaBanner");
  if (banner) { banner.style.display = "block"; banner.innerHTML = `<div style="background:#fff;border:0.5px solid #e2e8f0;border-radius:12px;padding:10px;"><div style="font-size:12px;color:#94a3b8;text-align:center;padding:8px 0;">A carregar semana…</div></div>`; }
  _renderSemana();
}

/* ── HTML shell ───────────────────────────────────────── */
function _buildShell() {
  const clinicas = G.clinics || [];
  const clinicOpts = `<option value="">Todas as clínicas</option>` + clinicas.map(c =>
    `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name||c.slug||c.id)}</option>`
  ).join("");

  return `
<div style="padding:0 0 2rem;">

  <div style="position:sticky;top:0;z-index:20;background:#f8fafc;padding:8px 0 8px;margin-bottom:0.5rem;border-bottom:0.5px solid #e2e8f0;">
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
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
      <select id="gaSelClinica" class="gcSelect" style="font-size:12px;padding:5px 8px;max-width:140px;">${clinicOpts}</select>
      <div id="gaRecBanner"></div>
    </div>
  </div>

  <div style="display:flex;gap:12px;">
    <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:8px;">
      <div id="gaSemanaBanner" style="display:none;"></div>
      <div style="background:#fff;border:0.5px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <div style="display:grid;grid-template-columns:60px 1fr 140px 110px;padding:8px 12px;background:#f8fafc;border-bottom:0.5px solid #e2e8f0;gap:8px;">
          <div style="font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Hora</div>
          <div style="font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Doente</div>
          <div style="font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Tipo</div>
          <div style="font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Estado</div>
        </div>
        <div id="gaTimeline"></div>
      </div>
    </div>
    <div style="width:220px;flex-shrink:0;display:flex;flex-direction:column;gap:8px;position:sticky;top:57px;align-self:flex-start;">
      <div id="gaStats" style="background:#fff;border:0.5px solid #e2e8f0;border-radius:12px;padding:10px 12px;"></div>
      <div id="gaPanel" style="background:#fff;border:0.5px solid #e2e8f0;border-radius:12px;padding:1rem;">
        <div style="font-size:12px;color:#94a3b8;text-align:center;padding:1rem 0;">Clica num slot para ver detalhes e acções.</div>
      </div>
    </div>
  </div>

</div>

<div id="gaModalOverlay" style="display:none;position:fixed;inset:0;background:rgba(15,45,82,0.3);display:none;align-items:center;justify-content:center;z-index:1000;padding:16px;">
  <div id="gaModalBox" style="background:#fff;border-radius:14px;border:1px solid #e2e8f0;box-shadow:0 4px 24px rgba(15,45,82,0.1);width:min(420px,100%);padding:1.25rem;max-height:90vh;overflow-y:auto;"></div>
</div>`;
}

/* ── Wiring principal ─────────────────────────────────── */
function _wireShell() {
  document.getElementById("gaBtnPrev")?.addEventListener("click", async () => { _state.selectedDayISO = addDays(_state.selectedDayISO, -1); await _loadAndRender(); if (_semanaVisible) _renderSemana(); });
  document.getElementById("gaBtnNext")?.addEventListener("click", async () => { _state.selectedDayISO = addDays(_state.selectedDayISO, 1); await _loadAndRender(); if (_semanaVisible) _renderSemana(); });
  document.getElementById("gaBtnHoje")?.addEventListener("click", async () => { _state.selectedDayISO = todayISO(); await _loadAndRender(); if (_semanaVisible) _renderSemana(); });
  document.getElementById("gaSelClinica")?.addEventListener("change", async e => {
    _state.selectedClinicId = e.target.value || null;
    await _loadAndRender();
    if (_semanaVisible) _renderSemana();
  });
  document.getElementById("gaBtnRec")?.addEventListener("click", () => {
    if (!_state.selectedClinicId) { alert("Selecciona uma clínica primeiro."); return; }
    _openModalRecorrente();
  });
  document.getElementById("gaBtnBloq")?.addEventListener("click", () => {
    if (!_state.selectedClinicId) { alert("Selecciona uma clínica primeiro."); return; }
    _openModalBloqueio();
  });
  document.getElementById("gaBtnSemana")?.addEventListener("click", () => _toggleSemana());

  if (_state.selectedClinicId) {
    const sel = document.getElementById("gaSelClinica");
    if (sel) sel.value = _state.selectedClinicId;
  }

  // Clique fora dos slots — limpa o painel
  document.getElementById("gaTimeline")?.addEventListener("click", e => {
    if (!e.target.closest(".ga-tl-row")) {
      const panel = document.getElementById("gaPanel");
      if (panel) panel.innerHTML = '<div style="font-size:12px;color:#94a3b8;text-align:center;padding:1rem 0;">Clica num slot para ver detalhes e acções.</div>';
    }
  });
}

/* ── Load & render ────────────────────────────────────── */
async function _loadAndRender() {
  _renderDayLabel();
  _renderTimeline([]);
  _renderStats([]);

  const clinicId = _state.selectedClinicId;

  const dayISO = _state.selectedDayISO;
  const _lisbonOffset = (() => {
    const off = new Intl.DateTimeFormat("pt-PT", { timeZone: "Europe/Lisbon", timeZoneName: "shortOffset" })
      .formatToParts(new Date(`${dayISO}T12:00:00Z`)).find(p => p.type === "timeZoneName").value;
    return off.replace("GMT", "") || "+00:00";
  })();
  const startISO = dayISO + "T00:00:00" + _lisbonOffset;
  const endISO   = dayISO + "T23:59:59" + _lisbonOffset;

  try {
    let _q = window.sb
      .from("appointments")
      .select("id, start_at, end_at, status, mode, procedure_type, title, notes, patient_id, meet_link, clinic_id")
      .gte("start_at", startISO)
      .lte("start_at", endISO)
      .order("start_at", { ascending: true });
    if (clinicId) _q = _q.eq("clinic_id", clinicId);
    const { data, error } = await _q;

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

  if (clinicId) {
    await _loadHorarios(clinicId);
    _renderRecBanner(clinicId);
  } else {
    _state.horarios = [];
    const recBanner = document.getElementById("gaRecBanner");
    if (recBanner) recBanner.innerHTML = "";
  }
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
    `${DOW[h.day_of_week]} ${h.hora_inicio.slice(0,5)}–${h.hora_fim.slice(0,5)}`
  ).join(" · ");

  el.innerHTML = `<div id="gaBtnEditRec" style="display:flex;align-items:center;gap:5px;padding:4px 10px;background:#eff6ff;border:0.5px solid #93c5fd;border-radius:8px;font-size:11px;color:#1e40af;cursor:pointer;white-space:nowrap;" title="Clica para editar a disponibilidade">
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
    ${escapeHtml(items)}
  </div>`;
  document.getElementById("gaBtnEditRec")?.addEventListener("click", _openModalRecorrente);
}

/* ── Stats ────────────────────────────────────────────── */
function _renderStats(rows) {
  const el = document.getElementById("gaStats");
  if (!el) return;
  const livres   = rows.filter(r => r.status === "available" && !r.patient_id).length;
  const ocupados = rows.filter(r => r.mode !== "bloqueio" && r.patient_id).length;
  const bloq     = rows.filter(r => r.mode === "bloqueio").length;
  const total    = livres + ocupados;
  const taxa     = total > 0 ? Math.round((ocupados/total)*100) : (ocupados > 0 ? 100 : 0);

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px;">
      <div style="background:#f8fafc;border-radius:8px;padding:8px 10px;">
        <div style="font-size:18px;font-weight:600;color:#0f172a;">${livres}</div>
        <div style="font-size:10px;color:#94a3b8;margin-top:1px;">Livres</div>
      </div>
      <div style="background:#f8fafc;border-radius:8px;padding:8px 10px;">
        <div style="font-size:18px;font-weight:600;color:#0f172a;">${ocupados}</div>
        <div style="font-size:10px;color:#94a3b8;margin-top:1px;">Ocupados</div>
      </div>
      <div style="background:#f8fafc;border-radius:8px;padding:8px 10px;">
        <div style="font-size:18px;font-weight:600;color:#0f172a;">${bloq}</div>
        <div style="font-size:10px;color:#94a3b8;margin-top:1px;">Bloqueados</div>
      </div>
      <div style="background:#f8fafc;border-radius:8px;padding:8px 10px;">
        <div style="font-size:18px;font-weight:600;color:#0f172a;">${taxa}%</div>
        <div style="font-size:10px;color:#94a3b8;margin-top:1px;">Ocupação</div>
        <div style="height:3px;border-radius:2px;background:#e2e8f0;margin-top:5px;"><div style="height:100%;border-radius:2px;background:#1a56db;width:${taxa}%;"></div></div>
      </div>
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
  el.querySelector("[data-action='forcar']")?.addEventListener("click", async () => {
    if (!confirm("Este horário está bloqueado.\n\nO bloqueio será removido e a marcação criada.\n\nConfirmar?")) return;
    try {
      await window.sb.from("appointments").delete().eq("id", row.id);
      el.innerHTML = '<div style="font-size:12px;color:#94a3b8;text-align:center;padding:1rem 0;">Clica num slot para ver detalhes e acções.</div>';
      _loadAndRender();
      openApptModal({ mode:"new", row:null, prefillDatetime: row.start_at, prefillClinicId: _state.selectedClinicId });
    } catch(e) { alert("Erro: " + (e.message||e)); }
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
let _semanaVisible = true;
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
  const CLINIC_COLORS = {
    "692c518d-a9e2-4eba-96a7-e13a08809b5b": { solid:"#1a56db", light:"#dbeafe", text:"#1e40af" },
    "1c18862e-0ab1-4488-8f52-1112b7e77405": { solid:"#0891b2", light:"#cffafe", text:"#155e75" },
    "cf417ff7-4c7d-4afe-842e-403cf314dbf3": { solid:"#d97706", light:"#fef3c7", text:"#92400e" },
    "951ad0da-7114-43de-ac6b-da64f17c6bb1": { solid:"#7c3aed", light:"#ede9fe", text:"#4c1d95" },
    "f244a0dd-cbf7-4c34-ad0f-a8daef7b96d9": { solid:"#dc2626", light:"#fee2e2", text:"#7f1d1d" },
    "f0e45cda-3c0f-412f-8420-cf9e26185bc5": { solid:"#059669", light:"#d1fae5", text:"#064e3b" },
  };
  const DEFAULT_COLOR = { solid:"#64748b", light:"#f1f5f9", text:"#334155" };

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
    const _tzOff = (() => {
      const off = new Intl.DateTimeFormat("pt-PT", { timeZone: "Europe/Lisbon", timeZoneName: "shortOffset" })
        .formatToParts(new Date(`${dias[0]}T12:00:00Z`)).find(p => p.type === "timeZoneName").value;
      return off.replace("GMT", "") || "+00:00";
    })();
    let _sq = window.sb
      .from("appointments")
      .select("id, start_at, end_at, status, mode, patient_id, procedure_type, title, clinic_id")
      .gte("start_at", dias[0]+"T00:00:00"+_tzOff)
      .lte("start_at", dias[6]+"T23:59:59"+_tzOff);
    if (clinicId) _sq = _sq.eq("clinic_id", clinicId);
    const { data } = await _sq;

    // Excluir slots de disponibilidade (mode="slot") — a fonte de verdade são os horarios_recorrentes
    const appts = (data || []).filter(r => r.mode !== "slot");

    const patientIds = appts.map(r => r.patient_id).filter(Boolean);
    let patientsById = {};
    if (patientIds.length) {
      const { data: pts } = await window.sb.from("patients").select("id, full_name").in("id", patientIds);
      (pts||[]).forEach(p => { patientsById[p.id] = p; });
    }

    window.__gaSemanaAppts    = appts;
    window.__gaSemanaPatients = patientsById;

    // Indexar consultas por hora exata (com arrays para vários no mesmo minuto)
    const bySlot = {};
    appts.forEach(r => {
      const tDate = new Date(r.start_at);
      const tStr  = tDate.toLocaleString("pt-PT",{timeZone:"Europe/Lisbon",hour:"2-digit",minute:"2-digit"});
      const iso   = tDate.toLocaleDateString("pt-PT",{timeZone:"Europe/Lisbon",year:"numeric",month:"2-digit",day:"2-digit"}).split("/").reverse().join("-");
      const key   = iso+"T"+tStr;
      if (!bySlot[key]) bySlot[key] = [];
      bySlot[key].push(r);
    });

    // Carregar horarios activos (todas as clínicas ou só a seleccionada)
    let horariosDisp = [];
    try {
      let hq = window.sb.from("horarios_recorrentes").select("*").eq("is_active", true);
      if (clinicId) hq = hq.eq("clinic_id", clinicId);
      const { data: hd } = await hq;
      horariosDisp = hd || [];
    } catch(_) {}

    // Calcular slots de disponibilidade: Map key -> clinicId (para cor correcta por clínica)
    const slotsDispMap = new Map();
    dias.forEach(iso => {
      const diaSemana = new Date(iso+"T00:00:00").getDay();
      horariosDisp.forEach(h => {
        if (h.day_of_week === diaSemana) {
          gerarSlots(h.hora_inicio.slice(0,5), h.hora_fim.slice(0,5), h.duracao_min)
            .forEach(s => slotsDispMap.set(iso+"T"+s, h.clinic_id));
        }
      });
    });

    // Gerar linhas: union das horas de disponibilidade + horas reais dos appointments
    const horasSet = new Set();
    slotsDispMap.forEach((_, key) => horasSet.add(key.slice(-5)));
    appts.forEach(r => {
      const tDate = new Date(r.start_at);
      horasSet.add(tDate.toLocaleString("pt-PT",{timeZone:"Europe/Lisbon",hour:"2-digit",minute:"2-digit"}));
    });
    // Passo do padding: usar a menor duração dos horários activos
    const _minDur = horariosDisp.length ? Math.min(...horariosDisp.map(h => h.duracao_min)) : 20;
    // Fallback: se não há nada, mostrar 8:00–20:00 no passo correcto
    if (!horasSet.size) {
      for (let m = 8*60; m < 20*60; m += _minDur) horasSet.add(pad2(Math.floor(m/60))+":"+pad2(m%60));
    }
    // Âncora do padding: usar APENAS os tempos dos horários (slotsDispMap), NÃO os appointments forçados fora de grid
    // Isto evita que consultas às 15:10 (entre slots de 15:00 e 15:20) criem linhas fantasma brancas
    const _slotMinutos = [...slotsDispMap.keys()].map(k => { const [hh,mm] = k.slice(-5).split(":").map(Number); return hh*60+mm; });
    if (_slotMinutos.length) {
      const _minH = Math.max(0,     Math.floor((Math.min(..._slotMinutos) - 60) / _minDur) * _minDur);
      const _maxH = Math.min(23*60, Math.ceil( (Math.max(..._slotMinutos) + 60) / _minDur) * _minDur);
      for (let m = _minH; m <= _maxH; m += _minDur) horasSet.add(pad2(Math.floor(m/60))+":"+pad2(m%60));
    } else if (appts.length) {
      // Sem horários definidos mas com consultas (ex: só extras) — usar tempos dos appointments
      const _apptMin = appts.map(r => { const t = new Date(r.start_at).toLocaleString("pt-PT",{timeZone:"Europe/Lisbon",hour:"2-digit",minute:"2-digit"}); const [hh,mm]=t.split(":").map(Number); return hh*60+mm; });
      const _minH = Math.max(0,     Math.floor((Math.min(..._apptMin) - 60) / _minDur) * _minDur);
      const _maxH = Math.min(23*60, Math.ceil( (Math.max(..._apptMin) + 60) / _minDur) * _minDur);
      for (let m = _minH; m <= _maxH; m += _minDur) horasSet.add(pad2(Math.floor(m/60))+":"+pad2(m%60));
    }
    const horas = [...horasSet].sort();

    // Header
    const headerCols = dias.map((iso, i) => {
      const isHoje     = iso === hoje;
      const isSelected = iso === _state.selectedDayISO;
      const dt = new Date(iso+"T00:00:00");
      return `<div onclick="window.__gaGoDay('${iso}')" style="font-size:10px;font-weight:600;text-align:center;padding:6px 2px;border-right:0.5px solid #e2e8f0;color:${isHoje||isSelected?"#1a56db":"#94a3b8"};background:${isSelected?"#eff6ff":""};cursor:pointer;">${DAYS[i]}<br>${dt.getDate()}</div>`;
    }).join("");

    // Linhas
    const linhas = horas.map(hora => {
      const cells = dias.map(iso => {
        const key         = iso+"T"+hora;
        const rList       = bySlot[key];
        const slotClinicId = slotsDispMap.get(key);
        const isDisp      = slotClinicId !== undefined;
        const slotCC      = isDisp ? (CLINIC_COLORS[slotClinicId] || DEFAULT_COLOR) : null;

        if (!rList || !rList.length) {
          const bg = slotCC ? slotCC.light : "";
          return `<div onclick="window.__gaSlotClick('${iso}','${hora}')" style="border-right:0.5px solid #f1f5f9;padding:2px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;background:${bg};" onmouseover="this.style.background='#f0f9ff'" onmouseout="this.style.background='${bg}'"></div>`;
        }

        const r = rList[0];
        const extras = rList.length - 1;
        const isBlocked = r.mode === "bloqueio";
        const nome = patientsById[r.patient_id]?.full_name || "";
        const nomeCurto = nome
          ? (nome.split(" ")[0]+" "+nome.split(" ").slice(-1)[0])
          : (isBlocked ? "Bloq." : r.title || "");

        const apptClr = CLINIC_COLORS[r.clinic_id] || DEFAULT_COLOR;
        let bg, color;
        if (isBlocked) { bg="#fee2e2"; color="#991b1b"; }
        else           { bg=apptClr.solid; color="#fff"; }

        const extrasBadge = extras > 0 ? ` <span style="font-size:9px;opacity:0.85;">+${extras}</span>` : "";
        return `<div onclick="window.__gaSlotClickAppt('${r.id}')" style="border-right:0.5px solid #f1f5f9;padding:2px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;">
          <div style="width:100%;height:26px;border-radius:4px;background:${bg};color:${color};font-size:10px;font-weight:500;display:flex;align-items:center;justify-content:center;padding:0 3px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;" title="${escapeHtml(nome)}">${escapeHtml(nomeCurto)}${extrasBadge}</div>
        </div>`;
      }).join("");

      return `<div style="display:grid;grid-template-columns:38px 1fr 1fr 1fr 1fr 1fr 0.5fr 0.5fr;border-bottom:0.5px solid #f1f5f9;">
        <div style="font-size:10px;color:#94a3b8;padding:0 4px;height:32px;display:flex;align-items:center;justify-content:flex-end;border-right:0.5px solid #e2e8f0;flex-shrink:0;">${hora}</div>
        ${cells}
      </div>`;
    }).join("");

    banner.innerHTML = `<div style="background:#fff;border:0.5px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:10px;">
      <div style="display:grid;grid-template-columns:38px 1fr 1fr 1fr 1fr 1fr 0.5fr 0.5fr;background:#f8fafc;border-bottom:0.5px solid #e2e8f0;position:sticky;top:0;z-index:5;">
        <div style="border-right:0.5px solid #e2e8f0;"></div>
        ${headerCols}
      </div>
      <div id="gaSemanScroll" style="max-height:480px;overflow-y:auto;">
        ${linhas}
      </div>
    </div>`;

    // Scroll automático para a primeira hora de disponibilidade (ou primeiro appointment)
    const _primeiraDisp = [...slotsDispMap.keys()].map(k => k.slice(-5)).sort()[0];
    const _primeiroAppt = appts.length
      ? new Date(appts.slice().sort((a,b) => new Date(a.start_at)-new Date(b.start_at))[0].start_at)
          .toLocaleString("pt-PT",{timeZone:"Europe/Lisbon",hour:"2-digit",minute:"2-digit"})
      : null;
    const _alvoHora = _primeiraDisp || _primeiroAppt;
    if (_alvoHora) {
      const [_ah, _am] = _alvoHora.split(":").map(Number);
      const _alvoMenos1h = Math.max(0, _ah*60 + _am - 60);
      const _alvoStr = pad2(Math.floor(_alvoMenos1h/60))+":"+pad2(_alvoMenos1h%60);
      // encontrar o índice mais próximo na grelha
      const _idx = horas.findIndex(h => h >= _alvoStr);
      if (_idx > 0) {
        requestAnimationFrame(() => {
          const sc = document.getElementById("gaSemanScroll");
          if (sc) sc.scrollTop = _idx * 32;
        });
      }
    }

  } catch(e) {
    banner.innerHTML = `<div style="color:#b00020;font-size:13px;padding:12px;">Erro ao carregar semana.</div>`;
  }

  window.__gaGoDay = (iso) => {
    _state.selectedDayISO = iso;
    _loadAndRender();
    if (_semanaVisible) _renderSemana();
  };

  window.__gaSlotClick = (iso, hora) => {
    const [h, m] = hora.split(":").map(Number);
    const dt = new Date(iso+"T"+pad2(h)+":"+pad2(m)+":00");
    openApptModal({ mode:"new", row:null, prefillDatetime: dt.toISOString(), prefillClinicId: _state.selectedClinicId });
  };

  window.__gaSlotClickAppt = (apptId) => {
    const r = (window.__gaSemanaAppts||[]).find(a => a.id === apptId);
    if (r) _renderPanel(r, window.__gaSemanaPatients||{});
  };
}

/* ── Modal criar slot ─────────────────────────────────── */
function _openModalCriarSlot(iso, hora) {
  const clinicas = G.clinics || [];
  if (!clinicas.length) { alert("Sem clínicas disponíveis."); return; }

  const clinicOpts = clinicas.map(c =>
    `<option value="${escapeHtml(c.id)}"${c.id===_state.selectedClinicId?" selected":""}>${escapeHtml(c.name||c.slug||c.id)}</option>`
  ).join("");

  const dt = new Date(iso+"T"+hora+":00");
  const DAYS = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const label = `${DAYS[dt.getDay()]}, ${dt.getDate()} ${MONTHS[dt.getMonth()]} às ${hora}`;

  _showModal(`
    <div style="font-size:16px;font-weight:700;color:#0f2d52;margin-bottom:4px;">Criar slot disponível</div>
    <div style="font-size:12px;color:#64748b;margin-bottom:1rem;">${escapeHtml(label)}</div>

    <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px;">
      <div style="display:flex;flex-direction:column;gap:4px;">
        <label style="font-size:11px;color:#64748b;">Clínica</label>
        <select id="gaSlotClinica" class="gcSelect" style="font-size:12px;">${clinicOpts}</select>
      </div>
      <div style="display:flex;flex-direction:column;gap:4px;">
        <label style="font-size:11px;color:#64748b;">Duração do slot</label>
        <select id="gaSlotDur" class="gcSelect" style="font-size:12px;">
          <option value="15">15 min</option>
          <option value="20" selected>20 min</option>
          <option value="30">30 min</option>
          <option value="45">45 min</option>
          <option value="60">1 hora</option>
        </select>
      </div>
      <div style="display:flex;flex-direction:column;gap:4px;">
        <label style="font-size:11px;color:#64748b;">Repetir semanalmente</label>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <label style="display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;border:0.5px solid #e2e8f0;cursor:pointer;font-size:12px;"><input type="radio" name="gaSlotRep" value="1" checked style="accent-color:#1a56db;"/> Só esta vez</label>
          <label style="display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;border:0.5px solid #e2e8f0;cursor:pointer;font-size:12px;"><input type="radio" name="gaSlotRep" value="4" style="accent-color:#1a56db;"/> 4 semanas</label>
          <label style="display:flex;align-items:center;gap=6px;padding:6px 12px;border-radius:8px;border:0.5px solid #e2e8f0;cursor:pointer;font-size:12px;"><input type="radio" name="gaSlotRep" value="1560" style="accent-color:#1a56db;"/> Sempre</label>
        </div>
      </div>
    </div>

    <div style="display:flex;gap:8px;justify-content:flex-end;">
      <button onclick="document.getElementById('gaModalOverlay').style.display='none'" class="gcBtnGhost" style="font-size:12px;padding:6px 14px;">Cancelar</button>
      <button id="gaSlotSaveBtn" class="gcBtnSuccess" style="font-size:12px;padding:6px 18px;font-weight:600;">Criar slot</button>
    </div>`);

  document.getElementById("gaSlotSaveBtn")?.addEventListener("click", async () => {
    const clinId = document.getElementById("gaSlotClinica")?.value;
    const dur    = parseInt(document.getElementById("gaSlotDur")?.value || "20");
    const rep    = parseInt(document.querySelector("input[name='gaSlotRep']:checked")?.value || "1");
    if (!clinId) { alert("Selecciona uma clínica."); return; }

    const rows = [];
    for (let i = 0; i < rep; i++) {
      const start = new Date(iso+"T"+hora+":00");
      start.setDate(start.getDate() + i * 7);
      const end = new Date(start.getTime() + dur * 60000);
      rows.push({ clinic_id: clinId, patient_id: null, start_at: start.toISOString(), end_at: end.toISOString(), status: "available", mode: "slot", title: null, notes: null, procedure_type: null });
    }

    // Inserir em lotes de 200 para não sobrecarregar
    try {
      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await window.sb.from("appointments").insert(rows.slice(i, i + 200));
        if (error) throw error;
      }
      document.getElementById("gaModalOverlay").style.display = "none";
      _loadAndRender();
      if (_semanaVisible) _renderSemana();
    } catch(e) { alert("Erro: " + (e.message||e)); }
  });
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
      <div></div>
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

      document.getElementById("gaModalOverlay").style.display = "none";
      alert("Disponibilidade guardada.");
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

/* ── Fecho do mês ─────────────────────────────────────── */
function _openFechoMes() {
  const hoje = new Date();
  const defMes = hoje.getMonth() + 1;
  const defAno = hoje.getFullYear();
  const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const clinicas = G.clinics || [];
  const clinicOpts = `<option value="">Todas as clínicas</option>` + clinicas.map(c =>
    `<option value="${escapeHtml(c.id)}"${c.id===_state.selectedClinicId?" selected":""}>${escapeHtml(c.name||c.slug||c.id)}</option>`
  ).join("");
  const mesOpts  = MESES.map((m,i) => `<option value="${i+1}"${i+1===defMes?" selected":""}>${m}</option>`).join("");
  const anoOpts  = [defAno-1, defAno, defAno+1].map(y => `<option value="${y}"${y===defAno?" selected":""}>${y}</option>`).join("");

  _showModal(`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
      <div style="font-size:17px;font-weight:700;color:#0f2d52;">Fecho do mês</div>
      <button onclick="document.getElementById('gaModalOverlay').style.display='none'" style="border:none;background:none;font-size:18px;color:#94a3b8;cursor:pointer;">×</button>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center;">
      <select id="gaFMes" class="gcSelect" style="font-size:12px;">${mesOpts}</select>
      <select id="gaFAno" class="gcSelect" style="font-size:12px;">${anoOpts}</select>
      <select id="gaFClinica" class="gcSelect" style="font-size:12px;min-width:140px;">${clinicOpts}</select>
    </div>
    <div id="gaFechoBody" style="font-size:12px;color:#94a3b8;text-align:center;padding:2rem 0;">A carregar…</div>
  `, { wide: true });

  const _load = () => _gaFechoLoad(
    parseInt(document.getElementById("gaFMes")?.value),
    parseInt(document.getElementById("gaFAno")?.value),
    document.getElementById("gaFClinica")?.value || null
  );

  document.getElementById("gaFMes")?.addEventListener("change", _load);
  document.getElementById("gaFAno")?.addEventListener("change", _load);
  document.getElementById("gaFClinica")?.addEventListener("change", _load);
  _load();
}

async function _gaFechoLoad(mes, ano, clinicId) {
  const body = document.getElementById("gaFechoBody");
  if (!body) return;
  body.innerHTML = `<div style="color:#94a3b8;text-align:center;padding:1.5rem;">A carregar…</div>`;

  const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  try {
    const lastDay = new Date(ano, mes, 0).getDate();
    const tzOff = (() => {
      const off = new Intl.DateTimeFormat("pt-PT",{timeZone:"Europe/Lisbon",timeZoneName:"shortOffset"})
        .formatToParts(new Date(`${ano}-${pad2(mes)}-01T12:00:00Z`)).find(p=>p.type==="timeZoneName").value;
      return off.replace("GMT","") || "+00:00";
    })();
    const startISO = `${ano}-${pad2(mes)}-01T00:00:00${tzOff}`;
    const endISO   = `${ano}-${pad2(mes)}-${pad2(lastDay)}T23:59:59${tzOff}`;

    let q = window.sb.from("appointments")
      .select("id, start_at, status, mode, procedure_type, patient_id, clinic_id")
      .gte("start_at", startISO).lte("start_at", endISO)
      .not("mode", "in", '("slot","bloqueio")')
      .order("start_at", { ascending: true });
    if (clinicId) q = q.eq("clinic_id", clinicId);
    const { data, error } = await q;
    if (error) throw error;
    const appts = data || [];

    const patientIds = [...new Set(appts.map(a=>a.patient_id).filter(Boolean))];
    let patientsById = {};
    if (patientIds.length) {
      const { data: pts } = await window.sb.from("patients").select("id, full_name").in("id", patientIds);
      (pts||[]).forEach(p => { patientsById[p.id] = p; });
    }

    const realizadas  = appts.filter(a=>a.status==="done").length;
    const faltas      = appts.filter(a=>a.status==="no_show").length;
    const dispensadas = appts.filter(a=>a.status==="honorarios_dispensados").length;
    const pendentes   = appts.filter(a=>["scheduled","arrived"].includes(a.status)).length;

    const alertBanner = pendentes > 0
      ? `<div style="padding:8px 12px;background:#fef3c7;border:0.5px solid #fcd34d;border-radius:8px;font-size:12px;color:#92400e;margin-bottom:12px;">⚠ ${pendentes} consulta(s) ainda sem estado final — confirma antes de fechar o mês.</div>`
      : `<div style="padding:8px 12px;background:#d1fae5;border:0.5px solid #6ee7b7;border-radius:8px;font-size:12px;color:#065f46;margin-bottom:12px;">✓ Todas as consultas de ${MESES[mes-1]} ${ano} têm estado confirmado.</div>`;

    const rowsHtml = appts.map(a => {
      const dt    = new Date(a.start_at);
      const data  = dt.toLocaleDateString("pt-PT",{timeZone:"Europe/Lisbon",day:"2-digit",month:"2-digit"});
      const hora  = dt.toLocaleString("pt-PT",{timeZone:"Europe/Lisbon",hour:"2-digit",minute:"2-digit"});
      const nome  = escapeHtml(patientsById[a.patient_id]?.full_name || "—");
      const cName = escapeHtml((G.clinics||[]).find(c=>c.id===a.clinic_id)?.name || "—");
      const meta  = ESTADO_META[a.status] || ESTADO_META.scheduled;
      return `<tr style="border-bottom:0.5px solid #f1f5f9;" data-id="${a.id}">
        <td style="padding:5px 8px;font-size:11px;color:#64748b;white-space:nowrap;">${data}</td>
        <td style="padding:5px 8px;font-size:11px;color:#475569;">${hora}</td>
        <td style="padding:5px 8px;font-size:12px;font-weight:500;color:#0f172a;">${nome}</td>
        <td style="padding:5px 8px;font-size:11px;color:#64748b;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(a.procedure_type||"")}">${escapeHtml(a.procedure_type||"—")}</td>
        <td style="padding:5px 8px;font-size:11px;color:#64748b;">${cName}</td>
        <td style="padding:5px 8px;">
          <select class="gaFSel" data-id="${a.id}" style="font-size:11px;padding:2px 6px;border-radius:6px;border:0.5px solid #e2e8f0;background:${meta.bg};color:${meta.color};cursor:pointer;">
            <option value="scheduled" ${a.status==="scheduled"?"selected":""}>Marcado</option>
            <option value="arrived"   ${a.status==="arrived"?"selected":""}>Chegou</option>
            <option value="done"      ${a.status==="done"?"selected":""}>Realizada</option>
            <option value="no_show"   ${a.status==="no_show"?"selected":""}>Falta</option>
            <option value="honorarios_dispensados" ${a.status==="honorarios_dispensados"?"selected":""}>Dispensado</option>
            <option value="cancelled" ${a.status==="cancelled"?"selected":""}>Cancelado</option>
          </select>
        </td>
      </tr>`;
    }).join("");

    body.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px;">
        <div style="background:#d1fae5;border-radius:10px;padding:10px;text-align:center;">
          <div style="font-size:26px;font-weight:700;color:#065f46;">${realizadas}</div>
          <div style="font-size:10px;color:#065f46;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Realizadas</div>
        </div>
        <div style="background:#fee2e2;border-radius:10px;padding:10px;text-align:center;">
          <div style="font-size:26px;font-weight:700;color:#991b1b;">${faltas}</div>
          <div style="font-size:10px;color:#991b1b;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Faltas</div>
        </div>
        <div style="background:#ede9fe;border-radius:10px;padding:10px;text-align:center;">
          <div style="font-size:26px;font-weight:700;color:#4c1d95;">${dispensadas}</div>
          <div style="font-size:10px;color:#4c1d95;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Dispensados</div>
        </div>
        <div style="background:#fef3c7;border-radius:10px;padding:10px;text-align:center;">
          <div style="font-size:26px;font-weight:700;color:#92400e;">${pendentes}</div>
          <div style="font-size:10px;color:#92400e;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Por Confirmar</div>
        </div>
      </div>
      ${alertBanner}
      <div style="max-height:380px;overflow-y:auto;border:0.5px solid #e2e8f0;border-radius:8px;">
        <table style="width:100%;border-collapse:collapse;">
          <thead style="background:#f8fafc;position:sticky;top:0;z-index:2;">
            <tr>
              ${["Data","Hora","Doente","Tipo","Clínica","Estado"].map(h=>`<th style="padding:6px 8px;font-size:10px;font-weight:600;color:#94a3b8;text-align:left;text-transform:uppercase;white-space:nowrap;">${h}</th>`).join("")}
            </tr>
          </thead>
          <tbody id="gaFechoTbody">${rowsHtml || `<tr><td colspan="6" style="padding:24px;text-align:center;color:#94a3b8;">Sem consultas neste período.</td></tr>`}</tbody>
        </table>
      </div>`;

    // Wire status dropdowns — actualiza BD e refresca stats inline
    body.querySelectorAll(".gaFSel").forEach(sel => {
      sel.addEventListener("change", async () => {
        const id  = sel.getAttribute("data-id");
        const val = sel.value;
        const meta = ESTADO_META[val] || ESTADO_META.scheduled;
        sel.style.background = meta.bg;
        sel.style.color = meta.color;
        try {
          const { error } = await window.sb.from("appointments").update({ status: val }).eq("id", id);
          if (error) throw error;
          if (typeof window.__gc_onApptSaved === "function") window.__gc_onApptSaved();
          // Recarregar stats sem fechar o modal
          _gaFechoLoad(mes, ano, clinicId);
        } catch(e) { alert("Erro: " + (e.message||e)); }
      });
    });

  } catch(e) {
    if (body) body.innerHTML = `<div style="color:#b00020;font-size:13px;padding:12px;">Erro: ${e.message||e}</div>`;
  }
}

/* ── Helper modal ─────────────────────────────────────── */
function _showModal(html, opts = {}) {
  const ov  = document.getElementById("gaModalOverlay");
  const box = document.getElementById("gaModalBox");
  if (!ov||!box) return;
  box.style.width = opts.wide ? "min(860px,96vw)" : "min(420px,100%)";
  box.innerHTML = html;
  ov.style.display = "flex";
  ov.addEventListener("click", e => { if (e.target===ov) ov.style.display="none"; }, { once: true });
}
