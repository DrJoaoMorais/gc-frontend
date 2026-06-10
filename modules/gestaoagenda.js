/* ========================================================
   GESTAOAGENDA.JS — Timeline clínica com slots, bloqueios
   e horários recorrentes
   ======================================================== */

import { G, STATUS_OPTIONS, statusMeta } from "./state.js";
import { escapeHtml } from "./helpers.js";
import { openApptModal, renderQuickPatientResults } from "./agenda.js";
import { searchPatientsScoped } from "./db.js";

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
  avulsos: [],
  loading: false,
};

/* ── Entry point ──────────────────────────────────────── */
export async function initGestaoAgenda() {
  const root = document.getElementById("gcGestaoAgendaRoot");
  if (!root) return;

  _state.selectedDayISO = G.selectedDayISO || todayISO();
  const _isAdm = String(G.role||"").toLowerCase() === "administrativo";
  const _clinicsList = G.clinics || [];
  _state.selectedClinicId = (_isAdm || _clinicsList.length === 1) && _clinicsList.length > 0
    ? _clinicsList[0].id
    : null;

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
  if (btn) { btn.style.background = "#e6f1fb"; btn.style.color = "#1a56db"; }
  const banner = document.getElementById("gaSemanaBanner");
  if (banner) { banner.style.display = "block"; banner.innerHTML = `<div style="background:#fff;border:0.5px solid #e2e8f0;border-radius:12px;padding:10px;"><div style="font-size:12px;color:#94a3b8;text-align:center;padding:8px 0;">A carregar semana…</div></div>`; }
  _renderSemana();
}

/* ── HTML shell ───────────────────────────────────────── */
function _buildShell() {
  const clinicas = G.clinics || [];
  const _showTodas = clinicas.length > 1 && String(G.role||"").toLowerCase() !== "administrativo";
  const clinicOpts = (_showTodas ? `<option value="">Todas as clínicas</option>` : "") + clinicas.map(c =>
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
      <input id="gaJumpDate" type="date" title="Ir para uma semana" class="gcSelect" style="font-size:12px;padding:4px 8px;color:#0f2d52;cursor:pointer;" />
      <button id="gaBtnSemana" class="gcBtnGhost" style="font-size:12px;padding:5px 12px;">Vista semanal</button>
      <div style="width:1px;height:20px;background:#e2e8f0;margin:0 4px;"></div>
      <button id="gaBtnAgendar" class="gcBtnPrimary" style="font-size:12px;padding:5px 14px;">Agendar consulta</button>
      <button id="gaBtnNovoDoente" class="gcBtnOutline" style="font-size:12px;padding:5px 14px;">Novo doente</button>
      <button id="gaBtnCriarSlots" class="gcBtnSuccess" style="font-size:12px;padding:5px 14px;">+ Disponibilidade</button>
      <button id="gaBtnBloq" class="gcBtnDanger" style="font-size:12px;padding:5px 14px;">Bloquear</button>
      <div style="flex:1;min-width:180px;position:relative;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);pointer-events:none;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <input id="pQuickQuery" type="search" placeholder="Pesquisar doente — Nome, SNS, NIF…" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" inputmode="search" style="width:100%;box-sizing:border-box;padding:6px 10px 6px 30px;border-radius:8px;border:1px solid #e2e8f0;font-size:12px;font-family:inherit;color:#1e293b;background:#fff;" />
        <div id="pQuickResults" style="display:none;position:absolute;top:calc(100% + 6px);left:0;right:0;background:#fff;border:0.5px solid #e2e8f0;border-radius:10px;box-shadow:0 6px 24px rgba(15,45,82,0.12);padding:8px;max-height:340px;overflow-y:auto;z-index:50;"></div>
      </div>
      <select id="gaSelClinica" class="gcSelect" style="font-size:12px;padding:5px 8px;max-width:140px;">${clinicOpts}</select>
      <div id="gaRecBanner" style="display:flex;flex-wrap:wrap;gap:5px;align-items:center;"></div>
    </div>
  </div>

  <div style="display:flex;gap:12px;">
    <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:8px;">
      <div id="gaSemanaBanner" style="display:none;"></div>
      <div style="background:#fff;border:0.5px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <div style="display:grid;grid-template-columns:60px 1fr 200px 110px;padding:8px 12px;background:#f8fafc;border-bottom:0.5px solid #e2e8f0;gap:8px;">
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
      <div id="gaPadroesFixos" style="display:none;background:#fff;border:0.5px solid #e2e8f0;border-radius:12px;padding:10px 12px;"></div>
      <div id="gaReavaliacoes"></div>
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
  document.getElementById("gaBtnPrev")?.addEventListener("click", async () => { _state.selectedDayISO = addDays(_state.selectedDayISO, _semanaVisible ? -7 : -1); await _loadAndRender(); if (_semanaVisible) _renderSemana(); });
  document.getElementById("gaBtnNext")?.addEventListener("click", async () => { _state.selectedDayISO = addDays(_state.selectedDayISO, _semanaVisible ? 7 : 1); await _loadAndRender(); if (_semanaVisible) _renderSemana(); });
  document.getElementById("gaBtnHoje")?.addEventListener("click", async () => { _state.selectedDayISO = todayISO(); await _loadAndRender(); if (_semanaVisible) _renderSemana(); });
  // mini-calendário: saltar para qualquer semana
  document.getElementById("gaJumpDate")?.addEventListener("change", async (e) => { if (!e.target.value) return; _state.selectedDayISO = e.target.value; await _loadAndRender(); if (_semanaVisible) _renderSemana(); });
  document.getElementById("gaSelClinica")?.addEventListener("change", async e => {
    _state.selectedClinicId = e.target.value || null;
    await _loadAndRender();
    if (_semanaVisible) _renderSemana();
  });
  document.getElementById("gaBtnBloq")?.addEventListener("click", () => {
    if (!_state.selectedClinicId) { alert("Selecciona uma clínica primeiro."); return; }
    _openModalBloqueio();
  });
  document.getElementById("gaBtnSemana")?.addEventListener("click", () => _toggleSemana());
  document.getElementById("gaBtnAgendar")?.addEventListener("click", () => {
    openApptModal({ mode: "new", row: null, prefillClinicId: _state.selectedClinicId });
  });
  document.getElementById("gaBtnNovoDoente")?.addEventListener("click", () => {
    window.openNewPatientMainModal({ clinicId: _state.selectedClinicId });
  });
  document.getElementById("gaBtnCriarSlots")?.addEventListener("click", () => {
    if (!_state.selectedClinicId) { alert("Selecciona uma clínica primeiro."); return; }
    _openModalCriarSlots();
  });

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

  // Pesquisa rápida de doente (lê a clínica seleccionada na Gestão de Agenda)
  _wireQuickSearchGA();
}

/* ── Pesquisa rápida de doente (Gestão de Agenda) ─────── */
function _wireQuickSearchGA() {
  const input   = document.getElementById("pQuickQuery");
  const resHost = document.getElementById("pQuickResults");
  if (!input || !resHost) return;
  if (!G.patientQuick) G.patientQuick = {};

  resHost.innerHTML = "";
  resHost.style.display = "none";

  let timer = null;

  async function run() {
    const term = (input.value || "").trim();
    if (!term || term.length < 2) { resHost.innerHTML = ""; resHost.style.display = "none"; return; }

    const clinicId = _state.selectedClinicId || null;
    resHost.style.display = "block";

    if (!clinicId) {
      resHost.innerHTML = '<div style="font-size:12px;color:#666;">Selecciona uma clínica para pesquisar.</div>';
      return;
    }

    resHost.innerHTML = '<div style="font-size:12px;color:#666;">A pesquisar…</div>';
    try {
      const pts = await searchPatientsScoped({ clinicId, q: term, limit: 30 });
      if (!pts || pts.length === 0) {
        resHost.innerHTML = '<div style="font-size:12px;color:#666;">Sem resultados.</div>';
        return;
      }
      renderQuickPatientResults(pts);
    } catch (e) {
      console.error("Pesquisa rápida de doente (GA) falhou:", e);
      resHost.innerHTML = '<div style="font-size:12px;color:#b00020;">Erro na pesquisa. Vê a consola.</div>';
    }
  }

  input.addEventListener("input", () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(run, 250);
  });
}

/* ── Load & render ────────────────────────────────────── */
async function _loadAndRender() {
  _renderDayLabel();
  _renderTimeline([]);
  _renderStatsCards();

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
    await _loadAvulsos(clinicId);
    _renderRecBanner(clinicId);
  } else {
    _state.horarios = [];
    _state.avulsos = [];
    const recBanner = document.getElementById("gaRecBanner");
    if (recBanner) recBanner.innerHTML = "";
  }
  _renderStatsCards();
  _renderTimeline(_state.rows, patientsById);
  _renderReavaliacoes();
}

function _renderDayLabel() {
  const el = document.getElementById("gaDayLabel");
  if (el) el.textContent = isoToDisplay(_state.selectedDayISO);
  const jd = document.getElementById("gaJumpDate");
  if (jd) jd.value = _state.selectedDayISO;
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

async function _loadAvulsos(clinicId) {
  try {
    const d = new Date(_state.selectedDayISO + "T00:00:00");
    const dow = (d.getDay()+6)%7;
    const seg = new Date(d); seg.setDate(d.getDate()-dow);
    const dom = new Date(seg); dom.setDate(seg.getDate()+6);
    const isoOf = x => x.getFullYear()+"-"+pad2(x.getMonth()+1)+"-"+pad2(x.getDate());
    const { data } = await window.sb
      .from("dias_consulta_avulsos")
      .select("*")
      .eq("clinic_id", clinicId)
      .gte("data", isoOf(seg))
      .lte("data", isoOf(dom))
      .order("data");
    _state.avulsos = data || [];
  } catch(_) { _state.avulsos = []; }
}

function _renderRecBanner(clinicId) {
  const el = document.getElementById("gaRecBanner");
  if (!el) return;
  if (!_state.horarios.length && !_state.avulsos.length) { el.innerHTML = ""; return; }

  const DOW = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  const DOW_AV = ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];
  const recHtml = _state.horarios.map(h => {
    const slots = gerarSlots(h.hora_inicio.slice(0,5), h.hora_fim.slice(0,5), h.duracao_min).join(" · ");
    return `<div data-hid="${h.id}" style="display:flex;align-items:center;gap:6px;padding:4px 6px 4px 10px;background:#eff6ff;border:0.5px solid #93c5fd;border-radius:8px;font-size:11px;color:#1e40af;white-space:nowrap;">
      <b style="font-weight:600;">${DOW[h.day_of_week]} ${h.hora_inicio.slice(0,5)}–${h.hora_fim.slice(0,5)}</b>
      <span style="color:#60a5fa;">${slots}</span>
      <button class="gaBtnDelRec" data-hid="${h.id}"
        style="padding:2px 8px;border-radius:5px;border:0.5px solid #fca5a5;background:#fee2e2;color:#991b1b;font-size:11px;cursor:pointer;font-family:inherit;">
        Eliminar
      </button>
    </div>`;
  }).join("");

  const avHtml = _state.avulsos.map(a => {
    const slots = gerarSlots(a.hora_inicio.slice(0,5), a.hora_fim.slice(0,5), a.duracao_min).join(" · ");
    const dt = new Date(a.data+"T00:00:00");
    const lbl = DOW_AV[(dt.getDay()+6)%7] + " " + pad2(dt.getDate()) + "/" + pad2(dt.getMonth()+1);
    return `<div data-aid="${a.id}" style="display:flex;align-items:center;gap:6px;padding:4px 6px 4px 10px;background:#fff1f2;border:0.5px solid #fda4af;border-radius:8px;font-size:11px;color:#9f1239;white-space:nowrap;">
      <span style="font-size:9px;font-weight:600;background:#ffe4e6;color:#be123c;padding:1px 5px;border-radius:4px;">PONTUAL</span>
      <b style="font-weight:600;">${lbl} ${a.hora_inicio.slice(0,5)}–${a.hora_fim.slice(0,5)}</b>
      <span style="color:#fb7185;">${slots}</span>
      <button class="gaBtnDelAvulso" data-aid="${a.id}"
        style="padding:2px 8px;border-radius:5px;border:0.5px solid #fca5a5;background:#fee2e2;color:#991b1b;font-size:11px;cursor:pointer;font-family:inherit;">
        Eliminar
      </button>
    </div>`;
  }).join("");

  el.innerHTML = recHtml + avHtml;

  el.querySelectorAll(".gaBtnDelAvulso").forEach(btn => {
    btn.addEventListener("click", async () => {
      const aid = btn.dataset.aid;
      const a = _state.avulsos.find(x => x.id === aid);
      if (!a) return;
      const dt = new Date(a.data+"T00:00:00");
      const lbl = pad2(dt.getDate())+"/"+pad2(dt.getMonth()+1);
      if (!confirm(`Eliminar slots pontuais de ${lbl} (${a.hora_inicio.slice(0,5)}–${a.hora_fim.slice(0,5)})?\n\nConsultas já marcadas não são afectadas.`)) return;
      try {
        await window.sb.from("dias_consulta_avulsos").delete().eq("id", aid);
        await _loadAndRender();
        if (_semanaVisible) _renderSemana();
      } catch(e) { alert("Erro: " + (e.message||e)); }
    });
  });

  el.querySelectorAll(".gaBtnDelRec").forEach(btn => {
    btn.addEventListener("click", async () => {
      const hid = btn.dataset.hid;
      const h   = _state.horarios.find(x => x.id === hid);
      if (!h) return;

      const hoje = new Date().toISOString();
      const { data: futuras } = await window.sb
        .from("appointments")
        .select("start_at")
        .eq("clinic_id", h.clinic_id)
        .gt("start_at", hoje)
        .not("patient_id", "is", null);

      const DOW_FULL = ["domingo","segunda","terça","quarta","quinta","sexta","sábado"];
      const comDoentes = (futuras||[]).filter(a => new Date(a.start_at).getDay() === h.day_of_week);

      if (comDoentes.length) {
        const datas = [...new Set(comDoentes.map(a =>
          new Date(a.start_at).toLocaleDateString("pt-PT",{day:"2-digit",month:"2-digit",year:"numeric"})
        ))].join(", ");
        if (!confirm(`Atenção: há ${comDoentes.length} marcação(ões) em ${DOW_FULL[h.day_of_week]} futuras:\n\n${datas}\n\nEliminar mesmo assim?`)) return;
      } else {
        if (!confirm(`Eliminar disponibilidade de ${DOW[h.day_of_week]} ${h.hora_inicio.slice(0,5)}–${h.hora_fim.slice(0,5)}?`)) return;
      }

      await window.sb.from("horarios_recorrentes").update({ is_active: false }).eq("id", hid);
      await _loadAndRender();
      if (_semanaVisible) _renderSemana();
    });
  });
}

async function _renderPadroesFixos() {
  const el = document.getElementById("gaPadroesFixos");
  if (!el) return;
  const isSuperAdmin = String(G.role||"").toLowerCase() === "super_admin";
  if (!isSuperAdmin) { el.style.display = "none"; return; }
  const clinicId = _state.selectedClinicId;
  const horarios = (_state.horarios||[]).filter(h => !clinicId || h.clinic_id === clinicId);

  const today = new Date(); today.setHours(0,0,0,0);
  const todayISO = today.getFullYear()+"-"+pad2(today.getMonth()+1)+"-"+pad2(today.getDate());
  const DOW_LABEL = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

  function nextOccurrence(dayOfWeek) {
    const todayDow = today.getDay();
    const daysUntil = (dayOfWeek - todayDow + 7) % 7;
    const next = new Date(today);
    next.setDate(today.getDate() + daysUntil);
    return next;
  }

  let futureAvulsos = [];
  try {
    let q = window.sb.from("dias_consulta_avulsos").select("*").gte("data", todayISO).order("data");
    if (clinicId) q = q.eq("clinic_id", clinicId);
    const { data } = await q;
    futureAvulsos = data || [];
  } catch(_) {}

  const items = [];
  horarios.forEach(h => {
    const next = nextOccurrence(h.day_of_week);
    const clinic = (G.clinics||[]).find(c => c.id === h.clinic_id);
    items.push({ date: next, clinicName: clinic?.name||clinic?.slug||"—", horaInicio: h.hora_inicio.slice(0,5), horaFim: h.hora_fim.slice(0,5), duracaoMin: h.duracao_min, tipo: "recorrente" });
  });
  futureAvulsos.forEach(a => {
    const dt = new Date(a.data+"T00:00:00");
    const clinic = (G.clinics||[]).find(c => c.id === a.clinic_id);
    items.push({ date: dt, clinicName: clinic?.name||clinic?.slug||"—", horaInicio: a.hora_inicio.slice(0,5), horaFim: a.hora_fim.slice(0,5), duracaoMin: a.duracao_min, tipo: "pontual" });
  });
  items.sort((a, b) => a.date - b.date);

  el.style.display = "block";
  const itemsHtml = items.map(item => {
    const dow = DOW_LABEL[item.date.getDay()];
    const d = item.date.getDate();
    const m = MESES[item.date.getMonth()];
    const badge = item.tipo === "recorrente"
      ? `<span style="font-size:10px;background:#e6f1fb;color:#0c447c;padding:1px 6px;border-radius:5px;">recorrente</span>`
      : `<span style="font-size:10px;background:#fff1f2;color:#9f1239;padding:1px 6px;border-radius:5px;">pontual</span>`;
    return `<div style="padding:7px 0;border-bottom:0.5px solid #f1f5f9;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
        <div><span style="font-size:12px;font-weight:600;color:#0f2d52;">${dow}, ${d} ${m}</span>
        <span style="font-size:11px;color:#64748b;margin-left:5px;">${escapeHtml(item.clinicName)}</span></div>
        ${badge}
      </div>
      <div style="font-size:11px;color:#94a3b8;margin-top:2px;">${item.horaInicio}–${item.horaFim} · ${item.duracaoMin} min</div>
    </div>`;
  }).join("");

  el.innerHTML = `
    <div style="font-size:13px;font-weight:600;color:#0f2d52;margin-bottom:8px;">Próxima consulta</div>
    ${items.length ? itemsHtml : `<div style="font-size:12px;color:#94a3b8;margin-bottom:8px;">Sem disponibilidade configurada${clinicId ? " nesta clínica" : ""}.</div>`}
    <button id="gaBtnNovoPadrao" style="margin-top:8px;width:100%;border:0.5px dashed #cbd5e1;background:transparent;color:#64748b;padding:7px;border-radius:8px;font-size:12px;cursor:pointer;font-family:inherit;">+ Próxima Disponibilidade</button>`;

  el.querySelector("#gaBtnNovoPadrao")?.addEventListener("click", () => {
    if (!_state.selectedClinicId) { alert("Selecciona uma clínica primeiro."); return; }
    _openModalCriarSlots();
  });
}

async function _renderStatsCards() {
  const el = document.getElementById("gaStats");
  if (!el) return;
  const clinicId = _state.selectedClinicId;

  const _tz = (() => {
    try {
      const off = new Intl.DateTimeFormat("pt-PT",{timeZone:"Europe/Lisbon",timeZoneName:"shortOffset"})
        .formatToParts(new Date()).find(p=>p.type==="timeZoneName").value;
      return off.replace("GMT","") || "+00:00";
    } catch(_) { return "+00:00"; }
  })();

  const d = new Date(_state.selectedDayISO+"T00:00:00");
  const isoOf = x => x.getFullYear()+"-"+pad2(x.getMonth()+1)+"-"+pad2(x.getDate());
  const dow = (d.getDay()+6)%7;
  const seg = new Date(d); seg.setDate(d.getDate()-dow);
  const dom = new Date(seg); dom.setDate(seg.getDate()+6);
  const segISO = isoOf(seg), domISO = isoOf(dom);
  const mesIni = d.getFullYear()+"-"+pad2(d.getMonth()+1)+"-01";
  const mesFim = isoOf(new Date(d.getFullYear(), d.getMonth()+1, 0));
  const fim14  = isoOf(new Date(d.getFullYear(), d.getMonth(), d.getDate()+14));
  const lo = [segISO, mesIni].sort()[0];
  const hi = [domISO, mesFim, fim14].sort()[2];

  const isoLocal = s => new Date(s).toLocaleDateString("pt-PT",{timeZone:"Europe/Lisbon",year:"numeric",month:"2-digit",day:"2-digit"}).split("/").reverse().join("-");
  const minLocal = s => { const t=new Date(s).toLocaleString("pt-PT",{timeZone:"Europe/Lisbon",hour:"2-digit",minute:"2-digit"}); const [h,m]=t.split(":").map(Number); return h*60+m; };

  let semana=0, mes=0, temHorario=false, appts=[], blocks=[], horarios=[], avulsos=[];
  try {
    let q = window.sb.from("appointments")
      .select("start_at,end_at,patient_id,mode,clinic_id")
      .gte("start_at", lo+"T00:00:00"+_tz)
      .lte("start_at", hi+"T23:59:59"+_tz);
    if (clinicId) q = q.eq("clinic_id", clinicId);
    const { data } = await q;
    (data||[]).forEach(r => {
      if (r.mode === "bloqueio") { blocks.push(r); return; }
      if (r.mode === "slot" || !r.patient_id) return;
      appts.push(r);
      const iso = isoLocal(r.start_at);
      if (iso >= segISO && iso <= domISO) semana++;
      if (iso >= mesIni && iso <= mesFim) mes++;
    });
    let hq = window.sb.from("horarios_recorrentes").select("day_of_week,hora_inicio,hora_fim,duracao_min").eq("is_active",true);
    if (clinicId) hq = hq.eq("clinic_id", clinicId);
    const { data: hd } = await hq;
    horarios = hd || [];

    // turnos avulsos no intervalo lo–hi
    let avq = window.sb.from("dias_consulta_avulsos")
      .select("clinic_id,data,hora_inicio,hora_fim,duracao_min")
      .gte("data", lo).lte("data", hi);
    if (clinicId) avq = avq.eq("clinic_id", clinicId);
    const { data: avd } = await avq;
    avulsos = avd || [];

    temHorario = horarios.length > 0 || avulsos.length > 0;
  } catch(_) {}

  // ocupação de um dia (desconta bloqueios). devolve null se não há horário nesse dia
  function ocupacaoDia(diaISO, filtroClinicId){
    const dDow = new Date(diaISO+"T00:00:00").getDay();
    const slots=[];
    // padrão recorrente
    horarios.filter(h=>h.day_of_week===dDow && (!filtroClinicId || h.clinic_id===filtroClinicId)).forEach(h=>{
      gerarSlots(h.hora_inicio.slice(0,5), h.hora_fim.slice(0,5), h.duracao_min).forEach(s=>{
        const [hh,mm]=s.split(":").map(Number); slots.push(hh*60+mm);
      });
    });
    // turnos avulsos
    avulsos.filter(a=>a.data===diaISO && (!filtroClinicId || a.clinic_id===filtroClinicId)).forEach(a=>{
      gerarSlots(a.hora_inicio.slice(0,5), a.hora_fim.slice(0,5), a.duracao_min).forEach(s=>{
        const [hh,mm]=s.split(":").map(Number); slots.push(hh*60+mm);
      });
    });
    if(!slots.length) return null;
    const blocosDia = blocks.filter(b=>isoLocal(b.start_at)===diaISO)
      .map(b=>({ini:minLocal(b.start_at), fim:b.end_at?minLocal(b.end_at):minLocal(b.start_at)+1}));
    const capLiq = slots.filter(m=>!blocosDia.some(b=>m>=b.ini && m<b.fim)).length;
    const ok = appts.filter(a=>isoLocal(a.start_at)===diaISO).length;
    return { ok, capLiq, bloq:slots.length-capLiq };
  }

  // semana actual (Seg–Dom): soma de todos os dias com horário
  let semTem=false, oSem={ok:0,capLiq:0,bloq:0};
  { const cur=new Date(seg); for(let i=0;i<7;i++){ const o=ocupacaoDia(isoOf(cur)); if(o){semTem=true;oSem.ok+=o.ok;oSem.capLiq+=o.capLiq;oSem.bloq+=o.bloq;} cur.setDate(cur.getDate()+1); } }

  // próximo dia com horário (a partir de amanhã)
  let alvoISO=null, oAlvo=null;
  for(let i=1;i<=14;i++){ const cand=isoOf(new Date(d.getFullYear(),d.getMonth(),d.getDate()+i)); const o=ocupacaoDia(cand); if(o){alvoISO=cand;oAlvo=o;break;} }
  const alvoLabel = alvoISO ? new Date(alvoISO+"T00:00:00").toLocaleDateString("pt-PT",{weekday:"short",day:"numeric",month:"short"}) : "";

  function blocoOcup(titulo, o){
    if(!o) return "";
    const taxa = o.capLiq>0 ? Math.round(o.ok/o.capLiq*100) : null;
    let cor="#0f2d52", bar="#94a3b8";
    if(taxa!==null){ if(taxa<50){cor="#A32D2D";bar="#E24B4A";} else if(taxa<90){cor="#854F0B";bar="#E0A23D";} else {cor="#3B6D11";bar="#6FA73D";} }
    return `<div style="margin-bottom:8px;">
      <div style="font-size:11px;color:#64748b;margin-bottom:4px;">${titulo}</div>
      ${ taxa!==null ? `
        <div style="display:flex;align-items:baseline;gap:6px;"><span style="font-size:20px;font-weight:600;color:${cor};">${taxa}%</span><span style="font-size:11px;color:${cor};">ocupação · ${o.ok}/${o.capLiq}${o.bloq?` · ${o.bloq} bloq.`:""}</span></div>
        <div style="height:6px;background:#f1f5f9;border-radius:4px;margin-top:6px;overflow:hidden;"><div style="width:${Math.min(taxa,100)}%;height:100%;background:${bar};"></div></div>
      ` : `<div style="font-size:12px;color:#94a3b8;">Dia todo bloqueado</div>` }
    </div>`;
  }

  const mostrarOcupacao = !!clinicId && temHorario;
  el.innerHTML = `
    ${ mostrarOcupacao ? blocoOcup("Esta semana", semTem ? oSem : null) : "" }
    ${ mostrarOcupacao && alvoISO ? blocoOcup("Próximo dia · "+alvoLabel, oAlvo) : "" }
    <div style="${mostrarOcupacao ? 'border-top:0.5px solid #f1f5f9;padding-top:8px;' : ''}">
      <div style="font-size:11px;color:#64748b;margin-bottom:4px;">Consultas marcadas</div>
      <div style="display:flex;align-items:baseline;gap:14px;">
        <span><span style="font-size:20px;font-weight:600;color:#0f2d52;">${semana}</span><span style="font-size:10px;color:#94a3b8;"> /semana</span></span>
        <span><span style="font-size:20px;font-weight:600;color:#0f2d52;">${mes}</span><span style="font-size:10px;color:#94a3b8;"> /mês</span></span>
      </div>
    </div>`;
  await _renderPadroesFixos();
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

/* ── Reavaliações pendentes ───────────────────────── */
function _fmtDataCurta(iso) {
  const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return d + ' ' + meses[m - 1];
}

async function _renderReavaliacoes() {
  const el = document.getElementById('gaReavaliacoes');
  if (!el) return;
  try {
    let q = window.sb
      .from('v_reavaliacoes_pendentes')
      .select('consultation_id, patient_id, patient_name, clinic_id, total, semana, sessoes_decorridas, data_reavaliacao, estado')
      .order('data_reavaliacao', { ascending: true });
    if (_state.selectedClinicId) q = q.eq('clinic_id', _state.selectedClinicId);
    const { data, error } = await q;
    if (error) throw error;

    const rows = data || [];
    if (!rows.length) { el.innerHTML = ''; return; }

    const cards = rows.map(r => {
      const atraso = r.estado === 'em atraso';
      const cor = atraso ? '#b45309' : '#1a56db';
      return `
        <div style="border:0.5px solid #e2e8f0;border-left:3px solid ${cor};border-radius:0 8px 8px 0;padding:8px;margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px;">
            <div style="font-size:13px;font-weight:600;color:#0f2d52;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(r.patient_name || '—')}</div>
            <button data-rav-del="${r.consultation_id}" data-pid="${r.patient_id}" data-clin="${r.clinic_id || ''}" aria-label="Remover" title="Remover da lista" style="border:none;background:none;color:#94a3b8;cursor:pointer;font-size:16px;line-height:1;padding:0 2px;">&times;</button>
          </div>
          <div style="font-size:11px;color:#64748b;margin-top:2px;">≈ ${r.sessoes_decorridas}/${r.total} sessões · ${r.semana}×/sem</div>
          <div style="font-size:11px;color:${cor};margin-top:3px;">Reavaliar: ${_fmtDataCurta(r.data_reavaliacao)} · ${r.estado}</div>
          <button data-rav-agendar="${r.patient_id}" data-pname="${escapeHtml(r.patient_name || '')}" data-aclin="${r.clinic_id || ''}" style="margin-top:8px;width:100%;background:#1a56db;color:#fff;border:none;border-radius:8px;padding:6px;font-size:12px;font-weight:600;cursor:pointer;">Agendar consulta</button>
        </div>`;
    }).join('');

    el.innerHTML = `
      <div style="background:#fff;border:0.5px solid #e2e8f0;border-radius:12px;padding:10px;margin-top:8px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <div style="font-size:13px;font-weight:600;color:#0f2d52;">Reavaliações</div>
          <div style="font-size:11px;font-weight:600;color:#1a56db;background:#e6f1fb;border-radius:8px;padding:1px 7px;">${rows.length}</div>
        </div>
        ${cards}
      </div>`;

    el.querySelectorAll('[data-rav-del]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Remover este doente da lista de reavaliações?')) return;
      try {
        const { error } = await window.sb.from('reavaliacoes_resolvidas').insert({
          consultation_id: b.getAttribute('data-rav-del'),
          patient_id: b.getAttribute('data-pid'),
          clinic_id: b.getAttribute('data-clin') || null,
          resultado: 'eliminada'
        });
        if (error) throw error;
        await _renderReavaliacoes();
      } catch (e) { alert('Erro ao remover: ' + (e.message || e)); }
    }));

    el.querySelectorAll('[data-rav-agendar]').forEach(b => b.addEventListener('click', () => {
      _agendarReavaliacao(
        b.getAttribute('data-rav-agendar'),
        b.getAttribute('data-pname'),
        b.getAttribute('data-aclin')
      );
    }));
  } catch (e) {
    el.innerHTML = '';
    console.error('reavaliacoes', e);
  }
}

function _agendarReavaliacao(patientId, patientName, clinicId) {
  openApptModal({
    mode: 'new',
    prefillPatientId: patientId,
    prefillPatientName: patientName || '',
    prefillClinicId: clinicId || _state.selectedClinicId || null
  });
}

/* ── Timeline ─────────────────────────────────────────── */
const ESTADO_META = {
  scheduled:              { label:"Marcada",              bg:"#eff6ff", color:"#1d4ed8", dot:"#3b82f6" },
  arrived:                { label:"Chegou",               bg:"#fffbeb", color:"#92400e", dot:"#f59e0b" },
  done:                   { label:"Realizada",            bg:"#ecfdf5", color:"#065f46", dot:"#10b981" },
  no_show:                { label:"Faltou/Cancelada",     bg:"#fef2f2", color:"#991b1b", dot:"#ef4444" },
  honorarios_dispensados: { label:"Dispensa honorários",  bg:"#f3f4f6", color:"#374151", dot:"#9ca3af" },
  available:              { label:"Livre",                bg:"#f1f5f9", color:"#64748b", dot:"#cbd5e1" },
  bloqueio:               { label:"Bloqueado",            bg:"#fee2e2", color:"#991b1b", dot:"#ef4444" },
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

    return `<div class="ga-tl-row" data-idx="${i}" style="display:grid;grid-template-columns:60px 1fr 200px 110px;padding:10px 12px;border-bottom:0.5px solid #f1f5f9;gap:8px;align-items:center;cursor:pointer;${borderLeft}">
      <div style="font-size:14px;font-weight:600;color:${isBlocked?"#ef4444":isExtra?"#92400e":"#475569"};white-space:nowrap;">${hora}</div>
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="width:8px;height:8px;border-radius:50%;background:${meta.dot};flex-shrink:0;"></div>
        <div>
          <div style="font-size:15px;font-weight:${isSlot?"400":"600"};color:${isSlot?"#94a3b8":"#0f172a"};">${isSlot?"Livre":escapeHtml(nome)}</div>
          ${isBlocked&&r.notes?`<div style="font-size:12px;color:#991b1b;">${escapeHtml(r.notes)}</div>`:""}
          ${isExtra?`<div style="font-size:12px;color:#92400e;">Consulta extra</div>`:""}
        </div>
      </div>
      <div style="font-size:14px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${isSlot||isBlocked?"":escapeHtml(tipo)}</div>
      <div style="display:flex;align-items:center;gap:6px;">
        <span style="padding:2px 8px;border-radius:999px;font-size:13px;font-weight:600;background:${meta.bg};color:${meta.color};">${meta.label}</span>
        ${isSlot?`<button class="ga-btn-marcar" data-idx="${i}" style="font-size:12px;color:#1a56db;border:0.5px solid #93c5fd;background:#eff6ff;border-radius:6px;padding:2px 8px;cursor:pointer;">+ Marcar</button>`:""}
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
  if (isBlocked) {
    const notaHtml = row.notes ? `<div style="font-weight:600;margin-bottom:2px;">${escapeHtml(row.notes)}</div>` : "";
    warn = `<div style="padding:8px 10px;background:#fef3c7;border:0.5px solid #fcd34d;border-radius:8px;font-size:11px;color:#92400e;margin-bottom:8px;">${notaHtml}Slot indisponível — para marcar contacte o Dr. João Morais.</div>`;
  }
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
    await _loadAndRender();
    if (_semanaVisible) _renderSemana();
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
  if (btn) { btn.style.background = _semanaVisible ? "#e6f1fb" : ""; btn.style.color = _semanaVisible ? "#1a56db" : ""; }
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

    // Dias avulsos (consultas pontuais) — merge no slotsDispMap
    let _avulsosDurs = [];
    try {
      let _aq = window.sb.from("dias_consulta_avulsos").select("clinic_id,data,hora_inicio,hora_fim,duracao_min")
        .gte("data", dias[0]).lte("data", dias[6]);
      if (clinicId) _aq = _aq.eq("clinic_id", clinicId);
      const { data: _avd } = await _aq;
      (_avd || []).forEach(a => {
        _avulsosDurs.push(a.duracao_min);
        gerarSlots(a.hora_inicio.slice(0,5), a.hora_fim.slice(0,5), a.duracao_min)
          .forEach(s => slotsDispMap.set(a.data+"T"+s, a.clinic_id));
      });
    } catch(_) {}

    // Gerar linhas: union das horas de disponibilidade + horas reais dos appointments
    const horasSet = new Set();
    slotsDispMap.forEach((_, key) => horasSet.add(key.slice(-5)));
    appts.forEach(r => {
      const tDate = new Date(r.start_at);
      horasSet.add(tDate.toLocaleString("pt-PT",{timeZone:"Europe/Lisbon",hour:"2-digit",minute:"2-digit"}));
    });
    // Passo do padding: menor duração entre recorrentes + avulsos (fallback 15)
    const _todasDurs = [...horariosDisp.map(h => h.duracao_min), ..._avulsosDurs];
    const _minDur = _todasDurs.length ? Math.min(..._todasDurs) : 15;
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
    const linhas = horas.map((hora, _ri) => {
      const cells = dias.map(iso => {
        const key         = iso+"T"+hora;
        const rList       = bySlot[key];
        const slotClinicId = slotsDispMap.get(key);
        const isDisp      = slotClinicId !== undefined;
        const slotCC      = isDisp ? (CLINIC_COLORS[slotClinicId] || DEFAULT_COLOR) : null;

        if (!rList || !rList.length) {
          const bg = slotCC ? slotCC.light : "";
          return `<div onclick="window.__gaSlotClick('${iso}','${hora}')" style="border-right:0.5px solid #f1f5f9;padding:2px;height:24px;display:flex;align-items:center;justify-content:center;cursor:pointer;background:${bg};" onmouseover="this.style.background='#f0f9ff'" onmouseout="this.style.background='${bg}'"></div>`;
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
        return `<div onclick="window.__gaSlotClickAppt('${r.id}')" style="border-right:0.5px solid #f1f5f9;padding:2px;height:24px;display:flex;align-items:center;justify-content:center;cursor:pointer;">
          <div style="width:100%;height:20px;border-radius:4px;background:${bg};color:${color};font-size:10px;font-weight:500;display:flex;align-items:center;justify-content:center;padding:0 3px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;" title="${escapeHtml(nome)}">${escapeHtml(nomeCurto)}${extrasBadge}</div>
        </div>`;
      }).join("");

      return `<div style="display:grid;grid-template-columns:38px 1fr 1fr 1fr 1fr 1fr 0.5fr 0.5fr;border-bottom:0.5px solid #f1f5f9;background:${_ri % 2 ? '#f7f9fb' : '#ffffff'};">
        <div style="font-size:10px;color:#94a3b8;padding:0 4px;height:24px;display:flex;align-items:center;justify-content:flex-end;border-right:0.5px solid #e2e8f0;flex-shrink:0;">${hora}</div>
        ${cells}
      </div>`;
    }).join("");

    banner.innerHTML = `<div style="background:#fff;border:0.5px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:10px;">
      <div style="display:grid;grid-template-columns:38px 1fr 1fr 1fr 1fr 1fr 0.5fr 0.5fr;background:#f8fafc;border-bottom:0.5px solid #e2e8f0;position:sticky;top:0;z-index:5;">
        <div style="border-right:0.5px solid #e2e8f0;"></div>
        ${headerCols}
      </div>
      <div id="gaSemanScroll" style="max-height:360px;overflow-y:auto;">
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
          if (sc) sc.scrollTop = _idx * 24;
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

/* ── Modal criar slots (tabs: Recorrente + Pontual) ───── */
async function _openModalCriarSlots(defaultTab = "pontual") {
  const clinicas = G.clinics || [];
  const selClinic = clinicas.find(c => c.id === _state.selectedClinicId);
  const clinicName = escapeHtml(selClinic?.name || selClinic?.slug || "");

  /* Obter duração da clínica — tenta G.clinics, fallback à BD */
  let durDefault = selClinic?.duracao_default_min || 15;
  if (!selClinic?.duracao_default_min) {
    try {
      const { data: cd } = await window.sb.from("clinics").select("duracao_default_min").eq("id", _state.selectedClinicId).single();
      if (cd?.duracao_default_min) durDefault = cd.duracao_default_min;
    } catch(_) {}
  }

  if (_state.selectedClinicId) await _loadHorarios(_state.selectedClinicId);

  const DOW_OPTS = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"]
    .map((d,i) => `<option value="${i}">${d}</option>`).join("");
  const DOW_LABEL = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

  const existingList = _state.horarios.length ? `
    <div style="margin-bottom:12px;padding:8px 10px;background:#f8fafc;border-radius:8px;border:0.5px solid #e2e8f0;">
      <div style="font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Horários activos — ${clinicName}</div>
      ${_state.horarios.map(h => {
        const sl = gerarSlots(h.hora_inicio.slice(0,5), h.hora_fim.slice(0,5), h.duracao_min).join(" · ");
        return `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:4px 0;border-bottom:0.5px solid #f1f5f9;font-size:11px;">
          <span style="color:#1e40af;"><b>${DOW_LABEL[h.day_of_week]} ${h.hora_inicio.slice(0,5)}–${h.hora_fim.slice(0,5)}</b> <span style="color:#60a5fa;">${sl}</span></span>
          <button class="gaCSDelRec" data-hid="${h.id}" style="padding:2px 8px;border-radius:5px;border:0.5px solid #fca5a5;background:#fee2e2;color:#991b1b;font-size:11px;cursor:pointer;font-family:inherit;">Eliminar</button>
        </div>`;
      }).join("")}
    </div>` : "";

  const isRec = defaultTab === "recorrente";

  _showModal(`
    <div style="font-size:16px;font-weight:700;color:#0f2d52;margin-bottom:2px;">Criar slots</div>
    <div style="font-size:12px;color:#64748b;margin-bottom:10px;">${clinicName} · consultas de ${durDefault} min</div>

    <div style="display:flex;gap:4px;background:#f1f5f9;border-radius:10px;padding:3px;margin-bottom:14px;">
      <button id="gaCSTabPont" type="button" style="flex:1;text-align:center;font-size:12px;padding:7px;border-radius:8px;border:none;cursor:pointer;font-family:inherit;font-weight:${isRec?'400':'600'};background:${isRec?'transparent':'#fff'};color:${isRec?'#64748b':'#1a56db'};${isRec?'':'box-shadow:0 1px 2px rgba(15,45,82,.08);'}">Pontual</button>
      <button id="gaCSTabRec" type="button" style="flex:1;text-align:center;font-size:12px;padding:7px;border-radius:8px;border:none;cursor:pointer;font-family:inherit;font-weight:${isRec?'600':'400'};background:${isRec?'#fff':'transparent'};color:${isRec?'#1a56db':'#64748b'};${isRec?'box-shadow:0 1px 2px rgba(15,45,82,.08);':''}">Recorrente</button>
    </div>

    <div id="gaCSTRec" style="display:${isRec?'block':'none'};">
      ${existingList}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
        <div style="display:flex;flex-direction:column;gap:4px;"><label style="font-size:11px;color:#64748b;">Dia da semana</label>
          <select id="gaCSRecDow" class="gcSelect" style="font-size:12px;">${DOW_OPTS}</select></div>
        <div style="display:flex;flex-direction:column;gap:4px;"><label style="font-size:11px;color:#64748b;">Duração</label>
          <select id="gaCSRecDur" class="gcSelect" style="font-size:12px;">
            <option value="15" ${durDefault===15?"selected":""}>15 min</option>
            <option value="20" ${durDefault===20?"selected":""}>20 min</option>
          </select></div>
        <div style="display:flex;flex-direction:column;gap:4px;"><label style="font-size:11px;color:#64748b;">Início</label>
          <input id="gaCSRecInicio" type="time" value="14:00" style="padding:6px 8px;border-radius:8px;border:1px solid #e2e8f0;font-size:12px;"/></div>
        <div style="display:flex;flex-direction:column;gap:4px;"><label style="font-size:11px;color:#64748b;">Fim</label>
          <input id="gaCSRecFim" type="time" value="17:00" style="padding:6px 8px;border-radius:8px;border:1px solid #e2e8f0;font-size:12px;"/></div>
      </div>
      <div style="margin-bottom:10px;">
        <label style="font-size:11px;color:#64748b;display:block;margin-bottom:6px;">Âmbito</label>
        <div style="display:flex;gap:6px;">
          <button type="button" class="gaCSRecScope" data-val="1" style="flex:1;padding:7px 0;font-size:12px;border-radius:8px;border:1.5px solid #e2e8f0;background:#fff;color:#64748b;cursor:pointer;font-family:inherit;">Esta semana</button>
          <button type="button" class="gaCSRecScope" data-val="4" style="flex:1;padding:7px 0;font-size:12px;border-radius:8px;border:1.5px solid #e2e8f0;background:#fff;color:#64748b;cursor:pointer;font-family:inherit;">4 semanas</button>
          <button type="button" class="gaCSRecScope" data-val="0" style="flex:1;padding:7px 0;font-size:12px;border-radius:8px;border:1.5px solid #1a56db;background:#eff6ff;color:#1a56db;cursor:pointer;font-weight:600;font-family:inherit;">Para sempre</button>
        </div>
        <input type="hidden" id="gaCSRecSemanas" value="0"/>
      </div>
      <div id="gaCSRecPreview" style="padding:8px 10px;background:#eff6ff;border-radius:8px;font-size:12px;color:#1e40af;margin-bottom:1rem;"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button onclick="document.getElementById('gaModalOverlay').style.display='none'" class="gcBtnGhost" style="font-size:12px;padding:6px 14px;">Cancelar</button>
        <button id="gaCSRecSave" class="gcBtnSuccess" style="font-size:12px;padding:6px 18px;font-weight:600;">Guardar horário</button>
      </div>
    </div>

    <div id="gaCSTPoint" style="display:${isRec?'none':'block'};">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
        <div style="display:flex;flex-direction:column;gap:4px;grid-column:span 2;"><label style="font-size:11px;color:#64748b;">Data</label>
          <input id="gaCSPontData" type="date" style="padding:6px 8px;border-radius:8px;border:1px solid #e2e8f0;font-size:12px;"/></div>
        <div style="display:flex;flex-direction:column;gap:4px;"><label style="font-size:11px;color:#64748b;">Início</label>
          <input id="gaCSPontInicio" type="time" value="17:30" style="padding:6px 8px;border-radius:8px;border:1px solid #e2e8f0;font-size:12px;"/></div>
        <div style="display:flex;flex-direction:column;gap:4px;"><label style="font-size:11px;color:#64748b;">Fim</label>
          <input id="gaCSPontFim" type="time" value="19:00" style="padding:6px 8px;border-radius:8px;border:1px solid #e2e8f0;font-size:12px;"/></div>
      </div>
      <div style="padding:8px 10px;background:#f0fdf4;border-radius:8px;font-size:12px;color:#166534;margin-bottom:6px;display:flex;align-items:center;justify-content:space-between;">
        <span>Duração: <b>${durDefault} min</b></span>
        <span style="font-size:10px;color:#059669;">automático — ${clinicName}</span>
      </div>
      <div id="gaCSPontPreview" style="padding:8px 10px;background:#eff6ff;border-radius:8px;font-size:12px;color:#1e40af;margin-bottom:1rem;"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button onclick="document.getElementById('gaModalOverlay').style.display='none'" class="gcBtnGhost" style="font-size:12px;padding:6px 14px;">Cancelar</button>
        <button id="gaCSPontSave" class="gcBtnSuccess" style="font-size:12px;padding:6px 18px;font-weight:600;">Criar slots</button>
      </div>
    </div>
  `);

  const modalBox = document.getElementById("gaModalBox");

  /* ── Tabs ── */
  function switchTab(tab) {
    const r = tab === "recorrente";
    document.getElementById("gaCSTRec").style.display = r ? "block" : "none";
    document.getElementById("gaCSTPoint").style.display = r ? "none" : "block";
    const tR = document.getElementById("gaCSTabRec"), tP = document.getElementById("gaCSTabPont");
    tR.style.fontWeight = r?"600":"400"; tR.style.background = r?"#fff":"transparent";
    tR.style.color = r?"#1a56db":"#64748b"; tR.style.boxShadow = r?"0 1px 2px rgba(15,45,82,.08)":"none";
    tP.style.fontWeight = r?"400":"600"; tP.style.background = r?"transparent":"#fff";
    tP.style.color = r?"#64748b":"#1a56db"; tP.style.boxShadow = r?"none":"0 1px 2px rgba(15,45,82,.08)";
  }
  document.getElementById("gaCSTabRec")?.addEventListener("click", () => switchTab("recorrente"));
  document.getElementById("gaCSTabPont")?.addEventListener("click", () => switchTab("pontual"));

  /* ── Eliminar padrão existente (lista no tab Recorrente) ── */
  modalBox.querySelectorAll(".gaCSDelRec").forEach(btn => {
    btn.addEventListener("click", async () => {
      const hid = btn.dataset.hid;
      const h = _state.horarios.find(x => x.id === hid);
      if (!h || !confirm(`Eliminar ${DOW_LABEL[h.day_of_week]} ${h.hora_inicio.slice(0,5)}–${h.hora_fim.slice(0,5)}?`)) return;
      await window.sb.from("horarios_recorrentes").update({ is_active: false }).eq("id", hid);
      document.getElementById("gaModalOverlay").style.display = "none";
      await _loadAndRender();
      if (_semanaVisible) _renderSemana();
    });
  });

  /* ── Recorrente — preview + scope pills + save ── */
  function updateRecPreview() {
    const ini = document.getElementById("gaCSRecInicio")?.value || "14:00";
    const fim = document.getElementById("gaCSRecFim")?.value || "17:00";
    const dur = parseInt(document.getElementById("gaCSRecDur")?.value || String(durDefault));
    const sl = gerarSlots(ini, fim, dur);
    const el = document.getElementById("gaCSRecPreview");
    if (el) el.textContent = sl.length ? "Slots: " + sl.join(" · ") : "Nenhum slot — verifica o intervalo.";
  }
  ["gaCSRecInicio","gaCSRecFim","gaCSRecDur"].forEach(id =>
    document.getElementById(id)?.addEventListener("change", updateRecPreview));
  updateRecPreview();

  modalBox.querySelectorAll(".gaCSRecScope").forEach(btn => {
    btn.addEventListener("click", () => {
      modalBox.querySelectorAll(".gaCSRecScope").forEach(b => {
        b.style.border = "1.5px solid #e2e8f0"; b.style.background = "#fff";
        b.style.color = "#64748b"; b.style.fontWeight = "400";
      });
      btn.style.border = "1.5px solid #1a56db"; btn.style.background = "#eff6ff";
      btn.style.color = "#1a56db"; btn.style.fontWeight = "600";
      document.getElementById("gaCSRecSemanas").value = btn.dataset.val;
    });
  });

  document.getElementById("gaCSRecSave")?.addEventListener("click", async () => {
    const dow = parseInt(document.getElementById("gaCSRecDow")?.value || "2");
    const ini = document.getElementById("gaCSRecInicio")?.value || "14:00";
    const fim = document.getElementById("gaCSRecFim")?.value || "17:00";
    const dur = parseInt(document.getElementById("gaCSRecDur")?.value || String(durDefault));
    const sems = parseInt(document.getElementById("gaCSRecSemanas")?.value || "0");
    try {
      await window.sb.from("horarios_recorrentes").insert({
        clinic_id: _state.selectedClinicId, day_of_week: dow,
        hora_inicio: ini, hora_fim: fim, duracao_min: dur, semanas: sems, is_active: true
      });
      document.getElementById("gaModalOverlay").style.display = "none";
      alert("Disponibilidade guardada.");
      await _loadAndRender();
      if (_semanaVisible) _renderSemana();
    } catch(e) { alert("Erro: " + (e.message || e)); }
  });

  /* ── Pontual — preview + save ── */
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomISO = tomorrow.getFullYear() + "-" + pad2(tomorrow.getMonth()+1) + "-" + pad2(tomorrow.getDate());
  const dateIn = document.getElementById("gaCSPontData");
  if (dateIn) dateIn.value = tomISO;

  function updatePontPreview() {
    const ini = document.getElementById("gaCSPontInicio")?.value || "17:30";
    const fim = document.getElementById("gaCSPontFim")?.value || "19:00";
    const sl = gerarSlots(ini, fim, durDefault);
    const el = document.getElementById("gaCSPontPreview");
    if (el) el.textContent = sl.length
      ? (sl.length === 1 ? "1 slot: " + sl[0] : sl.length + " slots: " + sl.join(" · "))
      : "Nenhum slot — verifica o intervalo.";
  }
  ["gaCSPontInicio","gaCSPontFim"].forEach(id =>
    document.getElementById(id)?.addEventListener("change", updatePontPreview));
  updatePontPreview();

  document.getElementById("gaCSPontSave")?.addEventListener("click", async () => {
    const data = document.getElementById("gaCSPontData")?.value;
    const ini = document.getElementById("gaCSPontInicio")?.value;
    const fim = document.getElementById("gaCSPontFim")?.value;
    if (!data || !ini || !fim) { alert("Preenche a data e os horários."); return; }
    if (ini >= fim) { alert("A hora de início deve ser anterior ao fim."); return; }
    try {
      const userId = (await window.sb.auth.getUser()).data?.user?.id || null;
      await window.sb.from("dias_consulta_avulsos").insert({
        clinic_id: _state.selectedClinicId, data, hora_inicio: ini,
        hora_fim: fim, duracao_min: durDefault, criado_por: userId
      });
      document.getElementById("gaModalOverlay").style.display = "none";
      const sl = gerarSlots(ini, fim, durDefault);
      alert(sl.length + " slot" + (sl.length > 1 ? "s" : "") + " criado" + (sl.length > 1 ? "s" : "") + ".");
      await _loadAndRender();
      if (_semanaVisible) _renderSemana();
    } catch(e) { alert("Erro: " + (e.message || e)); }
  });
}

/* ── Modal horário recorrente ─────────────────────────── */
async function _openModalRecorrente(existing = null) {
  if (_state.selectedClinicId) await _loadHorarios(_state.selectedClinicId);
  const clinicas = G.clinics||[];
  const DOW_OPTS = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"]
    .map((d,i) => `<option value="${i}">${d}</option>`).join("");
  const clinicOpts = clinicas.map(c =>
    `<option value="${escapeHtml(c.id)}"${c.id===_state.selectedClinicId?" selected":""}>${escapeHtml(c.name||c.slug||c.id)}</option>`
  ).join("");

  const selClinicRec = clinicas.find(x => x.id === (existing?.clinic_id || _state.selectedClinicId));
  const defaultDur = existing?.duracao_min || (selClinicRec?.duracao_default_min || 15);

  const DOW_LABEL = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  const existingList = _state.horarios.length ? `
    <div style="margin-bottom:12px;padding:8px 10px;background:#f8fafc;border-radius:8px;border:0.5px solid #e2e8f0;">
      <div style="font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Horários activos nesta clínica</div>
      ${_state.horarios.map(h => {
        const slots = gerarSlots(h.hora_inicio.slice(0,5), h.hora_fim.slice(0,5), h.duracao_min).join(" · ");
        return `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:4px 0;border-bottom:0.5px solid #f1f5f9;font-size:11px;">
          <span style="color:#1e40af;"><b>${DOW_LABEL[h.day_of_week]} ${h.hora_inicio.slice(0,5)}–${h.hora_fim.slice(0,5)}</b> <span style="color:#60a5fa;">${slots}</span></span>
          <button class="gaModalDelRec" data-hid="${h.id}" style="padding:2px 8px;border-radius:5px;border:0.5px solid #fca5a5;background:#fee2e2;color:#991b1b;font-size:11px;cursor:pointer;font-family:inherit;">Eliminar</button>
        </div>`;
      }).join("")}
    </div>` : "";

  _showModal(`
    <div style="font-size:16px;font-weight:700;color:#0f2d52;margin-bottom:4px;">Disponibilidade</div>
    <div style="font-size:12px;color:#64748b;margin-bottom:${existingList ? "8px" : "1rem"};">Define uma vez — slots gerados automaticamente.</div>
    ${existingList}
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
          <option value="15" ${defaultDur===15?"selected":""}>15 min</option>
          <option value="20" ${defaultDur===20?"selected":""}>20 min</option>
        </select></div>
      <div></div>
    </div>
    <div style="margin-bottom:10px;">
      <label style="font-size:11px;color:#64748b;display:block;margin-bottom:6px;">Âmbito</label>
      <div style="display:flex;gap:6px;">
        <button type="button" class="gaRecScope" data-val="1"
          style="flex:1;padding:7px 0;font-size:12px;border-radius:8px;border:1.5px solid #e2e8f0;background:#fff;color:#64748b;cursor:pointer;font-family:inherit;">
          Esta semana
        </button>
        <button type="button" class="gaRecScope" data-val="4"
          style="flex:1;padding:7px 0;font-size:12px;border-radius:8px;border:1.5px solid #e2e8f0;background:#fff;color:#64748b;cursor:pointer;font-family:inherit;">
          4 semanas
        </button>
        <button type="button" class="gaRecScope" data-val="0"
          style="flex:1;padding:7px 0;font-size:12px;border-radius:8px;border:1.5px solid #1a56db;background:#eff6ff;color:#1a56db;cursor:pointer;font-weight:600;font-family:inherit;">
          Para sempre
        </button>
      </div>
      <input type="hidden" id="gaRecSemanas" value="0"/>
    </div>
    <div id="gaRecPreview" style="padding:8px 10px;background:#eff6ff;border-radius:8px;font-size:12px;color:#1e40af;margin-bottom:1rem;"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;align-items:center;">
      ${existing ? `<button id="gaRecDeleteBtn" style="font-size:12px;padding:6px 14px;border-radius:8px;border:0.5px solid #fca5a5;background:#fee2e2;color:#991b1b;cursor:pointer;font-weight:500;">Eliminar</button><div style="flex:1;"></div>` : '<div style="flex:1;"></div>'}
      <button onclick="document.getElementById('gaModalOverlay').style.display='none'" class="gcBtnGhost" style="font-size:12px;padding:6px 14px;">Cancelar</button>
      <button id="gaRecSaveBtn" class="gcBtnSuccess" style="font-size:12px;padding:6px 18px;font-weight:600;">Guardar horário</button>
    </div>`);

  const modalBox = document.getElementById("gaModalBox");

  /* Eliminar directamente a partir do modal */
  modalBox.querySelectorAll(".gaModalDelRec").forEach(btn => {
    btn.addEventListener("click", async () => {
      const hid = btn.dataset.hid;
      const h   = _state.horarios.find(x => x.id === hid);
      if (!h || !confirm(`Eliminar ${DOW_LABEL[h.day_of_week]} ${h.hora_inicio.slice(0,5)}–${h.hora_fim.slice(0,5)}?`)) return;
      await window.sb.from("horarios_recorrentes").update({ is_active: false }).eq("id", hid);
      document.getElementById("gaModalOverlay").style.display = "none";
      await _loadAndRender();
      if (_semanaVisible) _renderSemana();
    });
  });

  if (existing) {
    document.getElementById("gaRecDow").value = existing.day_of_week;
    const existSems = String(existing.semanas ?? 0);
    document.getElementById("gaRecSemanas").value = existSems;
    modalBox.querySelectorAll(".gaRecScope").forEach(b => {
      const active = b.dataset.val === existSems;
      b.style.border     = active ? "1.5px solid #1a56db" : "1.5px solid #e2e8f0";
      b.style.background = active ? "#eff6ff" : "#fff";
      b.style.color      = active ? "#1a56db" : "#64748b";
      b.style.fontWeight = active ? "600" : "400";
    });
  }

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

  /* Âmbito — pills */
  modalBox.querySelectorAll(".gaRecScope").forEach(btn => {
    btn.addEventListener("click", () => {
      modalBox.querySelectorAll(".gaRecScope").forEach(b => {
        b.style.border = "1.5px solid #e2e8f0";
        b.style.background = "#fff";
        b.style.color = "#64748b";
        b.style.fontWeight = "400";
      });
      btn.style.border = "1.5px solid #1a56db";
      btn.style.background = "#eff6ff";
      btn.style.color = "#1a56db";
      btn.style.fontWeight = "600";
      document.getElementById("gaRecSemanas").value = btn.dataset.val;
    });
  });

  document.getElementById("gaRecDeleteBtn")?.addEventListener("click", async () => {
    if (!existing) return;
    if (!confirm("Eliminar esta disponibilidade recorrente?\n\nOs slots já gerados nas consultas não são afectados.")) return;
    try {
      await window.sb.from("horarios_recorrentes").update({ is_active: false }).eq("id", existing.id);
      document.getElementById("gaModalOverlay").style.display = "none";
      await _loadAndRender();
      if (_semanaVisible) _renderSemana();
    } catch(e) { alert("Erro: " + (e.message||e)); }
  });

  document.getElementById("gaRecSaveBtn")?.addEventListener("click", async () => {
    const dow    = parseInt(document.getElementById("gaRecDow")?.value||"2");
    const clinId = document.getElementById("gaRecClinica")?.value||_state.selectedClinicId;
    const ini    = document.getElementById("gaRecInicio")?.value||"15:00";
    const fim    = document.getElementById("gaRecFim")?.value||"16:40";
    const dur    = parseInt(document.getElementById("gaRecDur")?.value||"20");
    const sems   = parseInt(document.getElementById("gaRecSemanas")?.value||"0");

    try {
      const payload = { clinic_id: clinId, day_of_week: dow, hora_inicio: ini, hora_fim: fim, duracao_min: dur, semanas: sems, is_active: true };
      if (existing?.id) {
        await window.sb.from("horarios_recorrentes").update(payload).eq("id", existing.id);
      } else {
        await window.sb.from("horarios_recorrentes").insert(payload);
      }

      document.getElementById("gaModalOverlay").style.display = "none";
      alert("Disponibilidade guardada.");
      await _loadAndRender();
      if (_semanaVisible) _renderSemana();
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
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <label style="font-size:11px;color:#64748b;">Clínicas</label>
          <button id="gaBloqSelTodas" type="button" style="font-size:11px;color:#1a56db;background:none;border:none;cursor:pointer;padding:0;text-decoration:underline;">Seleccionar todas</button>
        </div>
        <div id="gaBloqChecks" style="display:flex;flex-direction:column;gap:4px;">${checks}</div>
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

  document.getElementById("gaBloqSelTodas")?.addEventListener("click", () => {
    document.querySelectorAll("#gaBloqChecks input[type=checkbox][data-cid]").forEach(cb => { cb.checked = true; });
  });

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
      await _loadAndRender();
      if (_semanaVisible) _renderSemana();
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
            ${STATUS_OPTIONS.map(s => { const m = statusMeta(s); const curNorm = (a.status === "cancelled") ? "no_show" : (a.status || "scheduled"); return `<option value="${s}" ${curNorm===s?"selected":""}>${m.icon} ${m.label}</option>`; }).join("")}
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
