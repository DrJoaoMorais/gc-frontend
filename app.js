/* ==== INÍCIO BLOCO 01/12 — Cabeçalho + utilitários base + helpers ==== */
/* =========================================================
   Gestão Clínica V2 — app.js (ficheiro completo)
   - Auth bootstrap + header + logout
   - Agenda por dia selecionado (default = hoje) + filtro por clínica (RLS)
   - Calendário mensal (overlay) para escolher dia
   - Modal marcação: doente obrigatório (pesquisa + novo doente via RPC)
   - ✅ Pesquisa rápida de doentes (Nome/SNS/NIF/Telefone/Passaporte)
   - ✅ Pesquisa no modal também por SNS/NIF/Telefone/Passaporte
   - ✅ Mostrar notas (appointments.notes) na lista da agenda
   - ✅ Agenda mostra Nome do doente + Telefone (patients)
   - ✅ Linha agenda: Hora | Doente | Tipo | Estado | Clínica | Telefone (alinhado em grelha)
   - ✅ Estado: pílula com cor + clique para selecionar (o próprio select é o “modelo”)
   - ✅ UI topo (AJUSTE): + botão "Novo doente" na página inicial
     + Pesquisa na mesma linha dos botões, seguido de Ver doente/Atualizar e Clínica
   ========================================================= */

(function () {
  "use strict";

  // ===== UI SCALE (apenas agenda + shell) =====
  const UI = {
    fs12: 13,
    fs13: 14,
    fs14: 15,
    fs16: 17,
    fs18: 19, // nome do doente
  };

  function hardRedirect(path) {
    window.location.replace(path);
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function fmtTime(d) {
    if (!(d instanceof Date) || isNaN(d.getTime())) return "—";
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  function fmtDatePt(d) {
    if (!(d instanceof Date) || isNaN(d.getTime())) return "—";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = String(d.getFullYear());
    return `${dd}-${mm}-${yyyy}`;
  }

  function fmtDateISO(d) {
    if (!(d instanceof Date) || isNaN(d.getTime())) return "";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function parseISODateToLocalStart(dateISO) {
    const [y, m, d] = (dateISO || "").split("-").map((n) => parseInt(n, 10));
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }

  function isoLocalDayRangeFromISODate(dateStr) {
    const start = parseISODateToLocalStart(dateStr);
    if (!start) return null;
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1, 0, 0, 0, 0);
    return { startISO: start.toISOString(), endISO: end.toISOString(), start, end };
  }

  function toLocalInputValue(dateObj) {
    const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  }

  function fromLocalInputValue(v) {
    return new Date(v);
  }

  function normalizeDigits(v) {
    return String(v || "").replace(/\D+/g, "");
  }

  function clipOneLine(s, max = 110) {
    const t = String(s || "").replace(/\s+/g, " ").trim();
    if (!t) return "";
    if (t.length <= max) return t;
    return t.slice(0, max - 1) + "…";
  }

  // ---- DOB helpers: idade + aniversário ----
  function parseISODateOnly(isoDate) {
    // isoDate: "YYYY-MM-DD" (dob vindo do Postgres date)
    if (!isoDate) return null;
    const [y, m, d] = String(isoDate).split("-").map(Number);
    if (!y || !m || !d) return null;
    return { y, m, d };
  }

  function calcAgeYears(dobISO, refDate = new Date()) {
    const dob = parseISODateOnly(dobISO);
    if (!dob) return null;

    const ry = refDate.getFullYear();
    const rm = refDate.getMonth() + 1; // 1-12
    const rd = refDate.getDate(); // 1-31

    let age = ry - dob.y;
    const hadBirthdayThisYear = rm > dob.m || (rm === dob.m && rd >= dob.d);
    if (!hadBirthdayThisYear) age -= 1;
    return age >= 0 ? age : null;
  }

  function isBirthdayOnDate(dobISO, refDate = new Date()) {
    const dob = parseISODateOnly(dobISO);
    if (!dob) return false;

    const rm = refDate.getMonth() + 1;
    const rd = refDate.getDate();

    // Caso especial: 29/02 — considera 28/02 nos anos não bissextos
    if (dob.m === 2 && dob.d === 29) {
      const y = refDate.getFullYear();
      const isLeap = (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
      if (!isLeap) return rm === 2 && rd === 28;
    }

    return rm === dob.m && rd === dob.d;
  }

  async function fetchMyRole(userId) {
    const { data, error } = await window.sb
      .from("clinic_members")
      .select("role, clinic_id, is_active")
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(1);

    if (error) throw error;
    if (!data || data.length === 0) return null;
    return data[0].role || null;
  }

  async function fetchVisibleClinics() {
    const { data, error } = await window.sb
      .from("clinics")
      .select("id, name, slug")
      .order("name", { ascending: true });

    if (error) throw error;
    return Array.isArray(data) ? data : [];
  }
/* ==== FIM BLOCO 01/12 — Cabeçalho + utilitários base + helpers ==== */
/* ==== INÍCIO BLOCO 02/12 — Agenda (helpers + load) + Patients (scope/search/RPC) ==== */

  // ---------- Agenda ----------
  const APPT_TIME_COL_CANDIDATES = ["start_at", "starts_at", "start_time", "start_datetime", "start"];
  const APPT_END_COL_CANDIDATES = ["end_at", "ends_at", "end_time", "end_datetime", "end"];

  function pickFirstExisting(obj, candidates) {
    for (const k of candidates) {
      if (obj && Object.prototype.hasOwnProperty.call(obj, k) && obj[k] != null) return k;
    }
    return null;
  }

  async function loadAppointmentsForRange({ clinicId, startISO, endISO }) {
    let lastErr = null;

    for (const col of APPT_TIME_COL_CANDIDATES) {
      try {
        let q = window.sb
          .from("appointments")
          .select("*")
          .gte(col, startISO)
          .lt(col, endISO)
          .order(col, { ascending: true });

        if (clinicId) q = q.eq("clinic_id", clinicId);

        const { data, error } = await q;
        if (error) throw error;

        return { data: Array.isArray(data) ? data : [], timeColUsed: col };
      } catch (e) {
        lastErr = e;
      }
    }

    throw lastErr || new Error("Não foi possível carregar appointments: nenhuma coluna de tempo reconhecida.");
  }

  // ---------- Patients ----------
  async function listPatientIdsForScope({ clinicId }) {
    let q = window.sb
      .from("patient_clinic")
      .select("patient_id, clinic_id")
      .eq("is_active", true)
      .limit(2000);

    if (clinicId) q = q.eq("clinic_id", clinicId);

    const { data, error } = await q;
    if (error) throw error;

    const ids = (data || []).map((r) => r.patient_id).filter(Boolean);
    return { ids, rows: data || [] };
  }

  function buildPatientOrFilter(termRaw) {
    const term = String(termRaw || "").trim();
    const digits = normalizeDigits(term);

    const parts = [];

    if (term.length >= 2) {
      const safe = term.replaceAll(",", " ");
      parts.push(`full_name.ilike.%${safe}%`);
      parts.push(`email.ilike.%${safe}%`);
      parts.push(`passport_id.ilike.%${safe}%`);
      parts.push(`external_id.ilike.%${safe}%`);
    }

    if (digits.length >= 3) {
      parts.push(`phone.ilike.%${digits}%`);
    }

    if (digits.length === 9) {
      parts.push(`sns.eq.${digits}`);
      parts.push(`nif.eq.${digits}`);
    }

    if (/^[A-Za-z0-9]{4,20}$/.test(term)) {
      const safe = term.replaceAll(",", " ");
      parts.push(`passport_id.eq.${safe}`);
    }

    const uniq = [];
    const seen = new Set();
    for (const p of parts) {
      if (!seen.has(p)) {
        seen.add(p);
        uniq.push(p);
      }
    }

    return uniq.join(",");
  }

  async function searchPatientsScoped({ clinicId, q, limit = 12 }) {
    const term = (q || "").trim();
    if (!term || term.length < 2) return [];

    const { ids } = await listPatientIdsForScope({ clinicId });
    if (ids.length === 0) return [];

    const orStr = buildPatientOrFilter(term);
    if (!orStr) return [];

    const { data: pts, error: pErr } = await window.sb
      .from("patients")
      .select(
        "id, full_name, dob, phone, email, external_id, sns, nif, passport_id, insurance_provider, insurance_policy_number, address_line1, postal_code, city, country, notes"
      )
      .in("id", ids)
      .eq("is_active", true)
      .or(orStr)
      .order("full_name", { ascending: true })
      .limit(limit);

    if (pErr) throw pErr;
    return Array.isArray(pts) ? pts : [];
  }

  async function rpcCreatePatientForClinic(payload) {
    const { data, error } = await window.sb.rpc("create_patient_for_clinic", payload);
    if (error) throw error;
    return data;
  }

  async function fetchPatientsByIds(patientIds) {
    const ids = Array.from(new Set((patientIds || []).filter(Boolean)));
    if (ids.length === 0) return {};

    const CHUNK = 150;
    const out = {};
    for (let i = 0; i < ids.length; i += CHUNK) {
      const part = ids.slice(i, i + CHUNK);
      const { data, error } = await window.sb
        .from("patients")
        .select("id, full_name, phone, email, sns, nif, passport_id")
        .in("id", part)
        .eq("is_active", true);

      if (error) throw error;
      for (const p of data || []) out[p.id] = p;
    }
    return out;
  }

  async function fetchPatientById(patientId) {
    if (!patientId) return null;
    const { data, error } = await window.sb
      .from("patients")
      .select(
        "id, full_name, dob, phone, email, external_id, sns, nif, passport_id, insurance_provider, insurance_policy_number, address_line1, postal_code, city, country, notes, is_active"
      )
      .eq("id", patientId)
      .limit(1);

    if (error) throw error;
    if (!data || data.length === 0) return null;
    return data[0];
  }

  async function updatePatient(patientId, payload) {
    if (!patientId) throw new Error("patientId em falta");
    const { data, error } = await window.sb
      .from("patients")
      .update(payload)
      .eq("id", patientId)
      .select(
        "id, full_name, dob, phone, email, external_id, sns, nif, passport_id, insurance_provider, insurance_policy_number, address_line1, postal_code, city, country, notes, is_active"
      )
      .limit(1);

    if (error) throw error;
    if (!data || data.length === 0) return null;
    return data[0];
  }

/* ==== FIM BLOCO 02/12 — Agenda (helpers + load) + Patients (scope/search/RPC) ==== */
/* ==== INÍCIO BLOCO 03/12 — Constantes (procedimentos/status) + estado global + render shell (HTML+CSS) ==== */

  // ---------- Tipos / Status / Duração ----------
  const PROCEDURE_OPTIONS = [
    "Primeira Consulta",
    "Consulta de Reavaliação",
    "Plasma Rico em Plaquetas",
    "Viscossuplementação",
    "Relatórios",
    "Revalidação de tratamentos",
    "Outro",
  ];

  // ✅ BD atualizada: apenas 5 estados permitidos
  // scheduled | arrived | done | no_show | confirmed
  // (cancelled foi migrado para no_show)
  const STATUS_OPTIONS = ["scheduled", "arrived", "done", "no_show", "confirmed"];

  const DURATION_OPTIONS = [15, 20, 30, 45, 60];

  // ✅ Estado com cores (5 estados)
  function statusMeta(statusRaw) {
    const s = String(statusRaw || "scheduled").toLowerCase();
    const map = {
      scheduled: { icon: "👤", label: "Marcada", bg: "#eff6ff", fg: "#1d4ed8", br: "#bfdbfe" },
      arrived:   { icon: "⏳", label: "Chegou", bg: "#fffbeb", fg: "#92400e", br: "#fde68a" },
      done:      { icon: "✅", label: "Realizada", bg: "#ecfdf5", fg: "#065f46", br: "#a7f3d0" },
      no_show:   { icon: "❌", label: "Faltou/Cancelada", bg: "#fef2f2", fg: "#991b1b", br: "#fecaca" },
      confirmed: { icon: "🎁", label: "Dispensa de honorários", bg: "#dbeafe", fg: "#1e40af", br: "#93c5fd" },
    };
    return map[s] || map.scheduled;
  }

  // ---------- Estado global ----------
  let G = {
    sessionUser: null,
    role: null,
    clinics: [],
    clinicsById: {},
    agenda: { rows: [], timeColUsed: "start_at" },
    selectedDayISO: fmtDateISO(new Date()),
    calMonth: null,
    patientsById: {},
    patientQuick: { lastResults: [], selected: null },
  };

  // ---------- Render shell ----------
  function renderAppShell() {
    document.body.innerHTML = `
      <style>
        .gcBtn { padding:10px 12px; border-radius:10px; border:1px solid #ddd; background:#fff; cursor:pointer; font-size:${UI.fs13}px; }
        .gcBtn:disabled { opacity:0.6; cursor:not-allowed; }

        .gcBtnPrimary { padding:11px 14px; border-radius:12px; border:1px solid #334155; background:#334155; color:#fff; cursor:pointer; font-size:${UI.fs13}px; font-weight:900; }
        .gcBtnPrimary:disabled { opacity:0.6; cursor:not-allowed; }

        .gcSelect { padding:10px 12px; border-radius:10px; border:1px solid #ddd; background:#fff; font-size:${UI.fs13}px; }
        .gcLabel { font-size:${UI.fs12}px; color:#666; }
        .gcCard { padding:12px 14px; border:1px solid #eee; border-radius:12px; background:#fff; }
        .gcMutedCard { padding:10px 12px; border-radius:10px; border:1px solid #ddd; background:#fafafa; }

        .gcGridRow {
          display:grid;
          grid-template-columns: 110px minmax(260px, 1.6fr) 240px 280px 170px 160px;
          gap:14px;
          align-items:start;
          width:100%;
        }
        @media (max-width: 1100px){
          .gcGridRow { grid-template-columns: 110px 1fr; }
          .gcGridRow > div { min-width: 0 !important; }
        }

        .gcPatientLink{
          display:block;
          font-size:${UI.fs18}px;
          line-height:1.15;
          color:#111;
          font-weight:950;
          cursor:pointer;
          text-decoration:underline;
          white-space:normal;
          overflow-wrap:anywhere;
          word-break:break-word;
        }

        .gcCellTitle { font-size:${UI.fs12}px; color:#666; }
        .gcCellValue { font-size:${UI.fs13}px; color:#111; font-weight:700; margin-top:6px; }

        .gcStatusSelect{
          appearance:none;
          -webkit-appearance:none;
          -moz-appearance:none;
          border-radius:999px;
          border:1px solid transparent;
          padding:8px 36px 8px 12px;
          font-size:${UI.fs13}px;
          font-weight:900;
          cursor:pointer;
          background-image: linear-gradient(45deg, transparent 50%, currentColor 50%), linear-gradient(135deg, currentColor 50%, transparent 50%);
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
        @media (max-width: 980px){
          .gcSearchWrap { flex: 1 1 100%; min-width: 280px; }
        }

        .gcGridRow > div{
          display:flex;
          flex-direction:column;
          justify-content:flex-start;
        }
        .gcCellTitle{
          min-height: 16px;
          display:flex;
          align-items:flex-end;
        }
        .gcGridRow .gcStatusSelect{
          margin-top: 6px;
          align-self:flex-start;
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

          <button id="btnLogout" class="gcBtn">Logout</button>
        </header>

        <main style="margin-top:14px;">
          <section class="gcCard">
            <div style="display:flex; align-items:flex-end; justify-content:space-between; gap:12px; flex-wrap:wrap;">
              <div>
                <div style="font-size:${UI.fs16}px; color:#111; font-weight:800;">Agenda</div>
                <div style="font-size:${UI.fs12}px; color:#666; margin-top:4px;" id="agendaSubtitle">—</div>
              </div>
            </div>

            <div style="margin-top:12px;" class="gcToolbar">
              <div class="gcToolbarBlock" style="flex-direction:row; gap:10px; align-items:flex-end;">
                <button id="btnCal" class="gcBtn" title="Calendário">Calendário</button>
                <button id="btnToday" class="gcBtn" title="Voltar a hoje">Hoje</button>

                <!-- ✅ Alteração 1: texto do botão -->
                <button id="btnNewAppt" class="gcBtnPrimary">+ Agendar Consulta 📅</button>

                <button id="btnNewPatientMain" class="gcBtn" title="Criar novo doente">＋ Novo doente</button>
              </div>

              <div class="gcToolbarBlock gcSearchWrap">
                <div class="gcLabel">Pesquisa de doente (Nome / SNS / NIF / Telefone / Passaporte-ID)</div>
                <input
                  id="pQuickQuery"
                  name="gc_patient_search"
                  type="search"
                  placeholder="ex.: Man… | 916… | 123456789"
                  autocomplete="off"
                  autocorrect="off"
                  autocapitalize="off"
                  spellcheck="false"
                  inputmode="search"
                  data-form-type="other"
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

            <div style="margin-top:12px;" id="agendaStatus" aria-live="polite"></div>

            <div style="margin-top:10px; border-top:1px solid #f0f0f0; padding-top:10px;">
              <ul id="agendaList" style="list-style:none; padding:0; margin:0;"></ul>
            </div>
          </section>
        </main>

        <div id="modalRoot"></div>
      </div>
    `;
  }

/* ==== FIM BLOCO 03/12 — Constantes (procedimentos/status) + estado global + render shell (HTML+CSS) ==== */
/* ==== INÍCIO BLOCO 04/12 — Helpers UI Agenda + abrir doente + update status + renderAgendaList ==== */

  function setAgendaSubtitleForSelectedDay() {
    const r = isoLocalDayRangeFromISODate(G.selectedDayISO);
    const sub = document.getElementById("agendaSubtitle");
    if (!sub || !r) return;
    sub.textContent = `${fmtDatePt(r.start)} (00:00–24:00)`;
  }

  function setAgendaStatus(kind, text) {
    const el = document.getElementById("agendaStatus");
    if (!el) return;

    const color = kind === "loading" ? "#666" : kind === "error" ? "#b00020" : kind === "ok" ? "#111" : "#666";
    el.innerHTML = `<div style="font-size:${UI.fs12}px; color:${color};">${escapeHtml(text)}</div>`;
  }

  function renderClinicsSelect(clinics) {
    const sel = document.getElementById("selClinic");
    if (!sel) return;

    const opts = [];
    opts.push(`<option value="">Todas</option>`);
    for (const c of clinics) {
      const label = c.name || c.slug || c.id;
      opts.push(`<option value="${escapeHtml(c.id)}">${escapeHtml(label)}</option>`);
    }
    sel.innerHTML = opts.join("");

    if (clinics.length === 1) sel.value = clinics[0].id;
  }

  function getPatientForAppointmentRow(apptRow) {
    const pid = apptRow && apptRow.patient_id ? apptRow.patient_id : null;
    if (!pid) return null;
    return G.patientsById && G.patientsById[pid] ? G.patientsById[pid] : null;
  }

  async function openPatientFeedFromAny(patientLike) {
    try {
      const pid = patientLike && patientLike.id ? patientLike.id : null;
      if (!pid) {
        alert("Doente inválido.");
        return;
      }
      const full = await fetchPatientById(pid);
      if (!full) {
        alert("Não consegui carregar o doente (RLS ou não existe).");
        return;
      }
      openPatientViewModal(full);
    } catch (e) {
      console.error("openPatientFeed falhou:", e);
      alert("Erro ao abrir doente. Vê a consola para detalhe.");
    }
  }

  async function updateAppointmentStatus(apptId, newStatus) {
    if (!apptId) return;
    const raw = String(newStatus || "").trim().toLowerCase();
    if (!raw) return;

    // ✅ Regra fechada: “Faltou/Cancelou” grava SEMPRE no_show
    const s = (raw === "cancelled") ? "no_show" : raw;

    const idx = (G.agenda.rows || []).findIndex((x) => x && x.id === apptId);
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

  // ✅ Agenda alinhada em grelha + Estado clicável com cor (select estilizado)
  function renderAgendaList() {
    const ul = document.getElementById("agendaList");
    if (!ul) return;

    const rows = G.agenda.rows || [];
    const timeColUsed = G.agenda.timeColUsed || "start_at";

    if (rows.length === 0) {
      ul.innerHTML = `<li style="padding:10px 0; font-size:${UI.fs12}px; color:#666;">Sem marcações para este dia.</li>`;
      return;
    }

    ul.innerHTML = rows
      .map((r) => {
        const startVal = r[timeColUsed] ?? r[pickFirstExisting(r, APPT_TIME_COL_CANDIDATES)];
        const endVal = r[pickFirstExisting(r, APPT_END_COL_CANDIDATES)];

        const start = startVal ? new Date(startVal) : null;
        const end = endVal ? new Date(endVal) : null;

        const tStart = fmtTime(start);
        const tEnd = end ? fmtTime(end) : null;

        const clinicId = r.clinic_id ?? null;
        const clinicName =
          clinicId && G.clinicsById[clinicId]
            ? G.clinicsById[clinicId].name || G.clinicsById[clinicId].slug || clinicId
            : clinicId || "—";

        // ✅ normaliza histórico: cancelled aparece como no_show no UI
        const statusRaw = r.status ?? "scheduled";
        const status = (String(statusRaw).toLowerCase() === "cancelled") ? "no_show" : statusRaw;

        const meta = statusMeta(status);

        const proc = r.procedure_type ?? "—";
        const notes = r.notes ? clipOneLine(r.notes, 130) : "";

        const p = getPatientForAppointmentRow(r);
        const patientName = p && p.full_name ? p.full_name : (r.patient_id ? `Doente (ID): ${r.patient_id}` : "—");
        const patientPhone = p && p.phone ? p.phone : "—";

        function optLabel(s) {
          const m = statusMeta(s);
          return `${m.icon} ${m.label}`;
        }

        return `
        <li data-appt-id="${escapeHtml(r.id)}" style="padding:10px 0; border-bottom:1px solid #f2f2f2;">
          <div class="gcGridRow">
            <div>
              <div style="font-size:${UI.fs16}px; font-weight:900; color:#111; padding-top:2px;">
                ${escapeHtml(tStart)}${tEnd ? `–${escapeHtml(tEnd)}` : ""}
              </div>
            </div>

            <div style="min-width: 260px;">
              <span data-patient-open="1" class="gcPatientLink">${escapeHtml(patientName)}</span>
              ${notes ? `<div style="margin-top:6px; font-size:${UI.fs12}px; color:#444;">Notas: ${escapeHtml(notes)}</div>` : ""}
            </div>

            <div style="min-width: 220px;">
              <div class="gcCellTitle">Tipo</div>
              <div class="gcCellValue">${escapeHtml(proc)}</div>
            </div>

            <div style="min-width: 260px;">
              <div class="gcCellTitle">Estado</div>
              <div style="margin-top:6px;">
                <select data-status-select="1"
                        class="gcStatusSelect"
                        style="background:${escapeHtml(meta.bg)}; color:${escapeHtml(meta.fg)}; border-color:${escapeHtml(meta.br)};"
                        title="Clique para alterar estado">
                  ${STATUS_OPTIONS.map((s) => {
                    const val = (s === "cancelled") ? "no_show" : s;
                    const sel = (val === String(status).toLowerCase()) ? " selected" : "";
                    return `<option value="${escapeHtml(val)}"${sel}>${escapeHtml(optLabel(val))}</option>`;
                  }).join("")}
                </select>
              </div>
            </div>

            <div style="min-width: 160px;">
              <div class="gcCellTitle">Telefone</div>
              <div class="gcCellValue">${escapeHtml(patientPhone)}</div>
            </div>

            <div style="min-width: 160px;">
              <div class="gcCellTitle">Clínica</div>
              <div class="gcCellValue">${escapeHtml(clinicName)}</div>
            </div>
          </div>
        </li>
      `;
      })
      .join("");

    ul.querySelectorAll("li[data-appt-id]").forEach((li) => {
      li.addEventListener("click", (ev) => {
        const t = ev.target;

        if (t && (t.getAttribute("data-status-select") === "1" || (t.closest && t.closest("[data-status-select='1']")))) return;
        if (t && (t.getAttribute("data-patient-open") === "1" || (t.closest && t.closest("[data-patient-open='1']")))) return;

        const id = li.getAttribute("data-appt-id");
        const row = rows.find((x) => x.id === id);
        if (row) openApptModal({ mode: "edit", row });
      });

      const pLink = li.querySelector("[data-patient-open='1']");
      if (pLink) {
        pLink.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();

          const apptId = li.getAttribute("data-appt-id");
          const row = rows.find((x) => x.id === apptId);
          if (!row) return;

          if (!row.patient_id) {
            alert("Marcação sem patient_id.");
            return;
          }
          openPatientFeedFromAny({ id: row.patient_id });
        });
      }

      const sel = li.querySelector("select[data-status-select='1']");
      if (sel) {
        sel.addEventListener("click", (ev) => ev.stopPropagation());
        sel.addEventListener("change", async (ev) => {
          ev.stopPropagation();
          const apptId = li.getAttribute("data-appt-id");
          const v = sel.value;
          await updateAppointmentStatus(apptId, v);
        });
      }
    });
  }

/* ==== FIM BLOCO 04/12 — Helpers UI Agenda + abrir doente + update status + renderAgendaList ==== */
/* ==== INÍCIO BLOCO 05/12 — Pesquisa rápida (main) + utilitários de modal doente + validação ==== */

  // ---------- Pesquisa rápida de doentes (main page) ----------
  function setQuickPatientMsg(kind, text) {
    const el = document.getElementById("pQuickMsg");
    if (!el) return;
    const color = kind === "error" ? "#b00020" : kind === "ok" ? "#111" : "#666";
    el.style.color = color;
    el.textContent = text || "";
  }

  function renderQuickPatientSelected() {
    const box = document.getElementById("pQuickSelected");
    if (!box) return;

    const p = G.patientQuick.selected;
    if (!p) {
      box.textContent = "—";
      return;
    }

    const idBits = [];
    if (p.sns) idBits.push(`SNS:${p.sns}`);
    if (p.nif) idBits.push(`NIF:${p.nif}`);
    if (p.passport_id) idBits.push(`ID:${p.passport_id}`);
    const phone = p.phone ? ` • Tel:${p.phone}` : "";
    const ids = idBits.length ? ` • ${idBits.join(" / ")}` : "";
    box.textContent = `${p.full_name}${ids}${phone}`;
  }

  function renderQuickPatientResults(results) {
    const host = document.getElementById("pQuickResults");
    if (!host) return;

    if (!results || results.length === 0) {
      host.innerHTML = `<div style="font-size:${UI.fs12}px; color:#666;">Sem resultados.</div>`;
      return;
    }

    const selectedId = G.patientQuick && G.patientQuick.selected ? G.patientQuick.selected.id : null;

    host.innerHTML = results
      .map((p) => {
        const idBits = [];
        if (p.sns) idBits.push(`SNS:${p.sns}`);
        if (p.nif) idBits.push(`NIF:${p.nif}`);
        if (p.passport_id) idBits.push(`ID:${p.passport_id}`);
        const idLine = idBits.length ? idBits.join(" / ") : (p.external_id ? `Ext:${p.external_id}` : "");
        const phone = p.phone ? `Tel:${p.phone}` : "";
        const line2Parts = [idLine, phone].filter(Boolean).join(" • ");

        const isSel = selectedId && p.id === selectedId;
        const bg = isSel ? "background:#f2f2f2;" : "background:#fff;";
        const br = isSel ? "border:1px solid #cbd5e1;" : "border:1px solid #f0f0f0;";

        return `
          <div data-pid="${escapeHtml(p.id)}"
               style="padding:8px; ${br} border-radius:10px; margin-bottom:8px; cursor:pointer; ${bg}">
            <div style="font-size:${UI.fs13}px; color:#111; font-weight:700; white-space:normal; overflow-wrap:anywhere; word-break:break-word;">${escapeHtml(p.full_name)}</div>
            <div style="font-size:${UI.fs12}px; color:#666;">${escapeHtml(line2Parts || "—")}</div>
          </div>
        `;
      })
      .join("");

    // ✅ Event delegation: 1 listener robusto no host
    // remove listener anterior (se existir)
    if (host._gcQuickDelegate) {
      host.removeEventListener("mousedown", host._gcQuickDelegate);
      host.removeEventListener("click", host._gcQuickDelegate);
      host._gcQuickDelegate = null;
    }

    const delegate = async (ev) => {
      const t = ev.target;
      const card = t && t.closest ? t.closest("[data-pid]") : null;
      if (!card) return;

      ev.preventDefault();
      ev.stopPropagation();

      const pid = card.getAttribute("data-pid");
      if (!pid) return;

      const p = (results || []).find((x) => x.id === pid);
      if (!p) return;

      // seleção
      G.patientQuick.selected = p;

      const input = document.getElementById("pQuickQuery");
      if (input) input.value = p.full_name || "";

      renderQuickPatientSelected();
      setQuickPatientMsg("ok", "Doente selecionado.");

      // fecha resultados
      const hostNow = document.getElementById("pQuickResults");
      if (hostNow) hostNow.style.display = "none";

      // ✅ abrir FEED (sem silêncio)
      try {
        if (typeof openPatientFeedFromAny !== "function") {
          alert("Erro: openPatientFeedFromAny não está disponível (função não encontrada).");
          return;
        }
        await openPatientFeedFromAny({ id: pid });
      } catch (e) {
        console.error("Abrir FEED a partir da pesquisa falhou:", e);
        alert("Não consegui abrir o Feed a partir da pesquisa. Vê a consola para detalhe.");
      }
    };

    host._gcQuickDelegate = delegate;
    host.addEventListener("mousedown", delegate);
    host.addEventListener("click", delegate);
  }

  function closeModalRoot() {
    const root = document.getElementById("modalRoot");
    if (root) root.innerHTML = "";
  }

  function validatePatientEdit(values) {
    const fullName = (values.full_name || "").trim();
    if (!fullName) return { ok: false, msg: "Nome completo é obrigatório." };

    const sns = normalizeDigits(values.sns);
    const nif = normalizeDigits(values.nif);
    const pass = (values.passport_id || "").trim();

    if (sns && !/^[0-9]{9}$/.test(sns)) return { ok: false, msg: "SNS inválido: tem de ter 9 dígitos." };
    if (nif && !/^[0-9]{9}$/.test(nif)) return { ok: false, msg: "NIF inválido: tem de ter 9 dígitos." };
    if (pass && !/^[A-Za-z0-9]{4,20}$/.test(pass)) return { ok: false, msg: "Passaporte/ID inválido: 4–20 alfanum." };

    if (!sns && !nif && !pass) return { ok: false, msg: "Identificação obrigatória: SNS ou NIF ou Passaporte/ID." };

    return {
      ok: true,
      cleaned: {
        full_name: fullName,
        dob: values.dob ? values.dob : null,
        phone: values.phone ? values.phone.trim() : null,
        email: values.email ? values.email.trim() : null,
        sns: sns || null,
        nif: nif || null,
        passport_id: pass || null,
        insurance_provider: values.insurance_provider ? values.insurance_provider.trim() : null,
        insurance_policy_number: values.insurance_policy_number ? values.insurance_policy_number.trim() : null,
        address_line1: values.address_line1 ? values.address_line1.trim() : null,
        postal_code: values.postal_code ? values.postal_code.trim() : null,
        city: values.city ? values.city.trim() : null,
        country: values.country ? values.country.trim() : "PT",
        notes: values.notes ? values.notes.trim() : null,
      },
    };
  }

/* ==== FIM BLOCO 05/12 — Pesquisa rápida (main) + utilitários de modal doente + validação ==== */
/* ==== INÍCIO BLOCO 06/12 — Modal Doente (FASE 1) ==== */
/* ==== INICIO BLOCO 06/12 — Pesquisa rápida (main) + utilitários de modal doente + validação ==== */
/* ==== INÍCIO BLOCO 06A/12 — Modal Doente (FASE 1) ==== */
/*
  BLOCO 06A/12 — Modal Doente (FASE 1)
  - Helpers internos + carregamento de clínica ativa do doente
  - Estrutura modular para preparar FASE 2 (inline + timeline)
  - IMPORTANTE: NÃO define openPatientViewModal (fica apenas no 06B).
*/

function openPatientViewModal__stub(patient) {
  const root = document.getElementById("modalRoot");
  if (!root || !patient) return;

  const p = patient;

  // ---------- State ----------
  let activeClinicId = null;

  // ---------- Role helpers ----------
  function role() {
    return String(G.role || "").toLowerCase();
  }

  function isDoctor() {
    return role() === "doctor";
  }

  // ---------- Data loaders ----------
  async function fetchActiveClinic() {
    const { data, error } = await window.sb
      .from("patient_clinic")
      .select("clinic_id")
      .eq("patient_id", p.id)
      .eq("is_active", true)
      .limit(1);

    if (error) {
      console.error(error);
      activeClinicId = null;
      return;
    }

    activeClinicId = data && data.length ? data[0].clinic_id : null;
  }

  // ---------- Boot ----------
  fetchActiveClinic().then(() => {
    renderFeed();
  });

  /* === UI + Actions são definidos no BLOCO 06B para manter organização === */

  /* placeholders (mantidos aqui para evitar hoist confuso em edições futuras) */
  function renderFeed() {}
  function openConsultForm() {}
  async function saveConsult() {}
}

// NOTE: 06A mantém apenas loaders/state base. A implementação REAL do modal está no 06B (openPatientViewModal).
/* ==== FIM BLOCO 06A/12 — Modal Doente (FASE 1) ==== */
/* ==== INICIO BLOCO 06B/12 — Modal Doente (HDA Rich + Diagnóstico sem acentos (search_text) + Tratamentos (catálogo+seleção+gravação) + Feed completo) ==== */

function openPatientViewModal(patient) {

  const root = document.getElementById("modalRoot");
  if (!root || !patient) return;

  const p = patient;

  /* ================= STATE ================= */
  let activeClinicId = null;
  let creatingConsult = false;

  let timelineLoading = false;
  let consultRows = [];          // rows enriquecidas com author_name + diagnoses[] + treatments[]
  let saving = false;

  let lastSavedConsultId = null; // ✅ consultId da última consulta gravada

  let draftHDAHtml = "";         // HDA em HTML (rich text)

  // ---- Identificação (modal interno) ----
  let identOpen = false;
  let identMode = "view";        // "view" | "edit"
  let identSaving = false;
  let identDraft = {};

  // ---- Diagnóstico (catálogo) ----
  let diagQuery = "";
  let diagLoading = false;
  let diagResults = [];          // [{id, label, code}]
  let selectedDiag = [];         // [{id, label, code}]
  let diagDebounceT = null;

  // ---- Tratamentos (catálogo) ----
  let prescriptionText = "R/ 20 Sessões de Tratamentos de Medicina Fisica e de Reabilitação com:";
  let treatQuery = "";
  let treatLoading = false;
  let treatResults = [];         // [{id, label, code}]
  let selectedTreat = [];        // [{id, label, code, qty}]
  let treatDebounceT = null;

  // ---- Documentos/PDF ----
  let docOpen = false;
  let docMode = "edit";          // "edit" | "preview"
  let docSaving = false;
  let docDraftHtml = "";         // HTML editável do documento v1 (GUARDADO também na tabela documents.html)
  let docTitle = "Relatório Médico";
  let docsLoading = false;
  let docRows = [];              // [{id, created_at, title, consultation_id, storage_path, url, version}]

  /* ================= ROLE ================= */
  function role() { return String(G.role || "").toLowerCase(); }
  function isDoctor() { return role() === "doctor"; }

  /* ================= DATA ================= */
  async function fetchActiveClinic() {
    const { data, error } = await window.sb
      .from("patient_clinic")
      .select("clinic_id")
      .eq("patient_id", p.id)
      .eq("is_active", true)
      .limit(1);

    if (error) {
      console.error(error);
      activeClinicId = null;
      return;
    }

    activeClinicId = data && data.length ? data[0].clinic_id : null;
  }

  function getTreatOrderFromPlan(planText) {
    try {
      const o = JSON.parse(planText || "");
      const arr = o && Array.isArray(o.treat_order) ? o.treat_order : null;
      return arr && arr.length ? arr.map(String) : null;
    } catch (e) {
      return null;
    }
  }

  function getPrescriptionTextFromPlan(planText) {
    try {
      const o = JSON.parse(planText || "");
      const t = o && typeof o.prescriptionText === "string" ? o.prescriptionText : "";
      return t || "";
    } catch (e) {
      return "";
    }
  }

  async function loadConsultations() {
    timelineLoading = true;

    // 1) Buscar consultas (inclui plan_text para guardar ordem dos tratamentos)
    const { data, error } = await window.sb
      .from("consultations")
      .select("id, clinic_id, report_date, hda, plan_text, created_at, author_user_id")
      .eq("patient_id", p.id)
      .order("report_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      consultRows = [];
      timelineLoading = false;
      return;
    }

    const rows = data || [];

    // 2) Mapear author_user_id -> display_name (via clinic_members)
    const authorIds = [...new Set(rows.map(r => r.author_user_id).filter(Boolean))];

    let authorMap = {};
    if (authorIds.length) {
      const { data: cms, error: cmErr } = await window.sb
        .from("clinic_members")
        .select("user_id, display_name")
        .in("user_id", authorIds);

      if (cmErr) {
        console.error(cmErr);
      } else {
        (cms || []).forEach(x => { authorMap[x.user_id] = x.display_name || ""; });
      }
    }

    const consultIds = rows.map(r => r.id).filter(Boolean);

    // 3) Carregar diagnósticos por consulta
    let diagByConsult = {}; // { consultId: [ {label, code} ] }

    if (consultIds.length) {
      const { data: links, error: lErr } = await window.sb
        .from("consultation_diagnoses")
        .select("consultation_id, diagnosis_id")
        .in("consultation_id", consultIds);

      if (lErr) {
        console.error(lErr);
      } else {
        const diagIds = [...new Set((links || []).map(x => x.diagnosis_id).filter(Boolean))];

        let diagMap = {}; // { diagId: {label, code} }
        if (diagIds.length) {
          const { data: diags, error: dErr } = await window.sb
            .from("diagnoses_catalog")
            .select("id, label, code")
            .in("id", diagIds);

          if (dErr) {
            console.error(dErr);
          } else {
            (diags || []).forEach(d => {
              diagMap[d.id] = { label: d.label || "", code: d.code || "" };
            });
          }
        }

        (links || []).forEach(l => {
          const cid = l.consultation_id;
          const did = l.diagnosis_id;
          if (!cid || !did) return;
          const dd = diagMap[did];
          if (!dd) return;
          if (!diagByConsult[cid]) diagByConsult[cid] = [];
          diagByConsult[cid].push(dd);
        });
      }
    }

    // 4) Carregar tratamentos por consulta
    let treatByConsult = {}; // { consultId: [ {id, label, code, qty} ] }

    if (consultIds.length) {
      const { data: tlinks, error: tErr } = await window.sb
        .from("consultation_treatments")
        .select("consultation_id, treatment_id, qty")
        .in("consultation_id", consultIds);

      if (tErr) {
        console.error(tErr);
      } else {
        const tIds = [...new Set((tlinks || []).map(x => x.treatment_id).filter(Boolean))];

        let tMap = {}; // { treatmentId: {label, code} }
        if (tIds.length) {
          const { data: trs, error: trErr } = await window.sb
            .from("treatments_catalog")
            .select("*")
            .in("id", tIds);

          if (trErr) {
            console.error(trErr);
          } else {
            (trs || []).forEach(t => {
              const label = sentenceizeLabel(t.label || t.name || t.title || "");
              const code = t.code || t.adse_code || t.proc_code || "";
              tMap[t.id] = { label, code };
            });
          }
        }

        (tlinks || []).forEach(l => {
          const cid = l.consultation_id;
          const tid = l.treatment_id;
          if (!cid || !tid) return;
          const tt = tMap[tid];
          if (!tt) return;
          if (!treatByConsult[cid]) treatByConsult[cid] = [];
          treatByConsult[cid].push({ id: tid, ...tt, qty: Number(l.qty || 1) });
        });
      }
    }

    consultRows = rows.map(r => {
      const order = getTreatOrderFromPlan(r.plan_text);
      let treatments = treatByConsult[r.id] || [];

      // Reordenar pela ordem gravada (se existir)
      if (order && order.length) {
        const pos = new Map(order.map((id, i) => [String(id), i]));
        treatments = (treatments || []).slice().sort((a, b) => {
          const pa = pos.has(String(a.id)) ? pos.get(String(a.id)) : 1e9;
          const pb = pos.has(String(b.id)) ? pos.get(String(b.id)) : 1e9;
          return pa - pb;
        });
      }

      return ({
        ...r,
        author_name: authorMap[r.author_user_id] || "",
        diagnoses: diagByConsult[r.id] || [],
        treatments
      });
    });

    // ✅ definir último consultId (para mostrar botões PDF quando abre feed)
    lastSavedConsultId = consultRows && consultRows.length ? (consultRows[0].id || null) : lastSavedConsultId;

    timelineLoading = false;
  }

  /* ================= DOCUMENTOS (carregar do Supabase) ================= */
  async function loadDocuments() {
    docsLoading = true;
    docRows = [];

    try {
      // ✅ schema real: id, clinic_id, patient_id, consultation_id, title, html, parent_document_id, version, storage_path, created_at
      const { data, error } = await window.sb
        .from("documents")
        .select("id, created_at, title, consultation_id, clinic_id, storage_path, version")
        .eq("patient_id", p.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("loadDocuments error:", error);
        docsLoading = false;
        return;
      }

      const rows = data || [];

      const out = [];
      for (const r of rows) {
        let url = "";
        const path = r.storage_path || "";
        if (path) {
          try {
            const s = await window.sb.storage.from("documents").createSignedUrl(path, 60 * 60);
            if (s?.data?.signedUrl) url = s.data.signedUrl;
          } catch (e) {
            // ignore
          }
          if (!url) {
            try {
              const pub = window.sb.storage.from("documents").getPublicUrl(path);
              url = pub?.data?.publicUrl || "";
            } catch (e2) {
              // ignore
            }
          }
        }

        out.push({
          id: r.id,
          created_at: r.created_at,
          title: r.title || "Documento",
          consultation_id: r.consultation_id || null,
          clinic_id: r.clinic_id || null,
          storage_path: path,
          url,
          version: (r.version !== undefined && r.version !== null) ? r.version : null
        });
      }

      docRows = out;
      docsLoading = false;
    } catch (e) {
      console.error("loadDocuments exception:", e);
      docsLoading = false;
    }
  }

  /* ================= SANITIZE HTML (para render seguro) ================= */
  function sanitizeHTML(html) {
    try {
      const allowed = new Set(["B","STRONG","U","BR","P","DIV","UL","OL","LI"]);
      const doc = new DOMParser().parseFromString(String(html || ""), "text/html");

      doc.querySelectorAll("script,style").forEach(n => n.remove());

      const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT, null);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);

      nodes.forEach(el => {
        [...el.attributes].forEach(a => el.removeAttribute(a.name));
        if (!allowed.has(el.tagName)) {
          const text = doc.createTextNode(el.textContent || "");
          el.replaceWith(text);
        }
      });

      return doc.body.innerHTML || "";
    } catch (e) {
      console.error(e);
      return String(html || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
    }
  }

  function escAttr(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  // ===== Cabeçalho do feed (idade por HOJE; 🎂 se faz anos HOJE) =====
  function ageTextToday() {
    try {
      const age = calcAgeYears ? calcAgeYears(p.dob, new Date()) : null;
      if (age === null || age === undefined) return "—";
      return `${age} anos`;
    } catch (e) {
      return "—";
    }
  }

  function birthdayBadgeToday() {
    try {
      const isBday = isBirthdayOnDate ? isBirthdayOnDate(p.dob, new Date()) : false;
      return isBday ? `<span title="Faz anos hoje" style="margin-left:8px;">🎂</span>` : ``;
    } catch (e) {
      return ``;
    }
  }

  /* ================= IDENTIFICAÇÃO (MODAL INTERNO) ================= */

  function openPatientIdentity(mode) {
    identMode = mode === "edit" ? "edit" : "view";
    identOpen = true;
    identSaving = false;

    identDraft = {
      full_name: p.full_name || "",
      dob: p.dob || "",
      sex: p.sex || "",
      phone: p.phone || "",
      email: p.email || "",
      sns: p.sns || "",
      nif: p.nif || "",
      passport_id: p.passport_id || "",
      address_line1: p.address_line1 || "",
      postal_code: p.postal_code || "",
      city: p.city || "",
      country: p.country || "",
      insurance_provider: p.insurance_provider || "",
      insurance_policy_number: p.insurance_policy_number || "",
      notes: p.notes || ""
    };

    render();
    bindIdentityEvents();
  }

  function closeIdentity() {
    identOpen = false;
    identSaving = false;
    render();
  }

  function renderIdentityModal() {
    const ro = (identMode !== "edit") ? "readonly" : "";
    const dis = (identMode !== "edit") ? "disabled" : "";
    const canEdit = (identMode === "edit");

    return `
      <div id="identOverlay"
           style="position:fixed; inset:0; background:rgba(0,0,0,0.35);
                  display:flex; align-items:center; justify-content:center; padding:12px; z-index:2000;">
        <div style="background:#fff; width:min(980px,96vw);
                    max-height:92vh; overflow:auto;
                    border-radius:14px; border:1px solid #e5e5e5; padding:16px;">

          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
            <div style="font-weight:900; font-size:16px;">
              Identificação do doente ${canEdit ? "(editar)" : "(ver)"}
            </div>
            <div style="display:flex; gap:8px;">
              <button id="btnIdentCloseTop" class="gcBtn">Fechar</button>
            </div>
          </div>

          <div style="margin-top:12px; display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div>
              <label>Nome completo</label>
              <input id="id_full_name" ${ro} value="${escAttr(identDraft.full_name)}"
                     style="width:100%; padding:10px; border:1px solid #ddd; border-radius:10px;" />
            </div>
            <div>
              <label>Data de nascimento</label>
              <input id="id_dob" type="date" ${ro} value="${escAttr(identDraft.dob)}"
                     style="width:100%; padding:10px; border:1px solid #ddd; border-radius:10px;" />
            </div>

            <div>
              <label>Sexo</label>
              <input id="id_sex" ${ro} value="${escAttr(identDraft.sex)}"
                     placeholder="M/F/outro"
                     style="width:100%; padding:10px; border:1px solid #ddd; border-radius:10px;" />
            </div>
            <div>
              <label>Telefone</label>
              <input id="id_phone" ${ro} value="${escAttr(identDraft.phone)}"
                     style="width:100%; padding:10px; border:1px solid #ddd; border-radius:10px;" />
            </div>

            <div>
              <label>Email</label>
              <input id="id_email" ${ro} value="${escAttr(identDraft.email)}"
                     style="width:100%; padding:10px; border:1px solid #ddd; border-radius:10px;" />
            </div>
            <div>
              <label>SNS</label>
              <input id="id_sns" ${ro} value="${escAttr(identDraft.sns)}"
                     style="width:100%; padding:10px; border:1px solid #ddd; border-radius:10px;" />
            </div>

            <div>
              <label>NIF</label>
              <input id="id_nif" ${ro} value="${escAttr(identDraft.nif)}"
                     style="width:100%; padding:10px; border:1px solid #ddd; border-radius:10px;" />
            </div>
            <div>
              <label>Passaporte</label>
              <input id="id_passport_id" ${ro} value="${escAttr(identDraft.passport_id)}"
                     style="width:100%; padding:10px; border:1px solid #ddd; border-radius:10px;" />
            </div>

            <div style="grid-column:1 / -1;">
              <label>Morada</label>
              <input id="id_address_line1" ${ro} value="${escAttr(identDraft.address_line1)}"
                     style="width:100%; padding:10px; border:1px solid #ddd; border-radius:10px;" />
            </div>

            <div>
              <label>Código postal</label>
              <input id="id_postal_code" ${ro} value="${escAttr(identDraft.postal_code)}"
                     style="width:100%; padding:10px; border:1px solid #ddd; border-radius:10px;" />
            </div>
            <div>
              <label>Cidade</label>
              <input id="id_city" ${ro} value="${escAttr(identDraft.city)}"
                     style="width:100%; padding:10px; border:1px solid #ddd; border-radius:10px;" />
            </div>

            <div>
              <label>País</label>
              <input id="id_country" ${ro} value="${escAttr(identDraft.country)}"
                     style="width:100%; padding:10px; border:1px solid #ddd; border-radius:10px;" />
            </div>
            <div>
              <label>Seguradora</label>
              <input id="id_insurance_provider" ${ro} value="${escAttr(identDraft.insurance_provider)}"
                     style="width:100%; padding:10px; border:1px solid #ddd; border-radius:10px;" />
            </div>

            <div>
              <label>Nº apólice</label>
              <input id="id_insurance_policy_number" ${ro} value="${escAttr(identDraft.insurance_policy_number)}"
                     style="width:100%; padding:10px; border:1px solid #ddd; border-radius:10px;" />
            </div>

            <div style="grid-column:1 / -1;">
              <label>Notas</label>
              <textarea id="id_notes" ${ro}
                        style="width:100%; min-height:90px; padding:10px; border:1px solid #ddd; border-radius:10px;">${escAttr(identDraft.notes)}</textarea>
            </div>
          </div>

          <div style="margin-top:12px; display:flex; justify-content:space-between; align-items:center; gap:10px;">
            <div id="identStatus" style="color:#64748b;">
              ${identSaving ? "A gravar..." : ""}
            </div>

            <div style="display:flex; gap:10px;">
              <button id="btnIdentClose" class="gcBtn">Cancelar</button>
              <button id="btnIdentSave" class="gcBtn" style="font-weight:900;" ${dis}>
                Gravar
              </button>
            </div>
          </div>

        </div>
      </div>
    `;
  }

  function bindIdentityEvents() {
    const closeTop = document.getElementById("btnIdentCloseTop");
    if (closeTop) closeTop.onclick = () => closeIdentity();

    const btnClose = document.getElementById("btnIdentClose");
    if (btnClose) btnClose.onclick = () => closeIdentity();

    if (!identOpen) return;

    function bindVal(id, key) {
      const el = document.getElementById(id);
      if (!el) return;
      el.oninput = (e) => { identDraft[key] = e?.target?.value ?? ""; };
    }

    bindVal("id_full_name", "full_name");
    bindVal("id_dob", "dob");
    bindVal("id_sex", "sex");
    bindVal("id_phone", "phone");
    bindVal("id_email", "email");
    bindVal("id_sns", "sns");
    bindVal("id_nif", "nif");
    bindVal("id_passport_id", "passport_id");
    bindVal("id_address_line1", "address_line1");
    bindVal("id_postal_code", "postal_code");
    bindVal("id_city", "city");
    bindVal("id_country", "country");
    bindVal("id_insurance_provider", "insurance_provider");
    bindVal("id_insurance_policy_number", "insurance_policy_number");
    bindVal("id_notes", "notes");

    const btnSave = document.getElementById("btnIdentSave");
    if (btnSave) {
      btnSave.disabled = identSaving || identMode !== "edit";
      btnSave.onclick = async () => {
        if (identSaving || identMode !== "edit") return;

        const name = String(identDraft.full_name || "").trim();
        if (!name) { alert("Nome completo é obrigatório."); return; }

        identSaving = true;
        render();
        bindIdentityEvents();

        try {
          const payload = {
            full_name: name,
            dob: identDraft.dob ? identDraft.dob : null,
            sex: String(identDraft.sex || "").trim() || null,
            phone: String(identDraft.phone || "").trim() || null,
            email: String(identDraft.email || "").trim() || null,
            sns: String(identDraft.sns || "").trim() || null,
            nif: String(identDraft.nif || "").trim() || null,
            passport_id: String(identDraft.passport_id || "").trim() || null,
            address_line1: String(identDraft.address_line1 || "").trim() || null,
            postal_code: String(identDraft.postal_code || "").trim() || null,
            city: String(identDraft.city || "").trim() || null,
            country: String(identDraft.country || "").trim() || null,
            insurance_provider: String(identDraft.insurance_provider || "").trim() || null,
            insurance_policy_number: String(identDraft.insurance_policy_number || "").trim() || null,
            notes: String(identDraft.notes || "").trim() || null
          };

          const { data, error } = await window.sb
            .from("patients")
            .update(payload)
            .eq("id", p.id)
            .select("*")
            .single();

          if (error) {
            console.error(error);
            alert("Erro a gravar Identificação.");
            identSaving = false;
            render();
            bindIdentityEvents();
            return;
          }

          if (data) {
            Object.keys(payload).forEach(k => { p[k] = data[k]; });
          }

          identSaving = false;
          identOpen = false;
          render();

        } catch (e) {
          console.error(e);
          alert("Erro a gravar Identificação.");
          identSaving = false;
          render();
          bindIdentityEvents();
        }
      };
    }
  }

  /* ================= DIAGNÓSTICO (CATÁLOGO) ================= */
  function renderDiagArea() {
    const chips = document.getElementById("diagChips");
    if (chips) {
      if (!selectedDiag.length) {
        chips.innerHTML = `<div style="margin-top:8px; color:#64748b;">Sem diagnósticos selecionados.</div>`;
      } else {
        chips.innerHTML = `
          <div style="margin-top:10px; display:flex; flex-wrap:wrap; gap:8px;">
            ${selectedDiag.map(x => `
              <div style="display:inline-flex; align-items:center; gap:8px;
                          padding:8px 10px; border:1px solid #e5e5e5; border-radius:999px;">
                <div style="font-size:14px;">
                  ${escAttr(x.label || "—")}
                  ${x.code ? `<span style="color:#64748b; font-size:12px; margin-left:6px;">${escAttr(x.code)}</span>` : ``}
                </div>
                <button class="diagRemove gcBtn"
                        data-id="${x.id}"
                        style="padding:6px 10px; border-radius:999px;">
                  ×
                </button>
              </div>
            `).join("")}
          </div>
        `;
      }
    }

    const st = document.getElementById("diagStatus");
    if (st) st.innerHTML = diagLoading ? `<div style="margin-top:6px; color:#64748b;">A pesquisar…</div>` : "";

    const dd = document.getElementById("diagDropdownHost");
    if (dd) {
      if (!diagLoading && diagResults && diagResults.length) {
        dd.innerHTML = `
          <div id="diagDropdown"
               style="position:absolute; z-index:50; left:0; right:0;
                      max-width:720px;
                      margin-top:6px; background:#fff; border:1px solid #e5e5e5;
                      border-radius:12px; box-shadow:0 10px 24px rgba(0,0,0,0.08);
                      max-height:220px; overflow:auto;">
            ${diagResults.map(x => `
              <div class="diagPick"
                   data-id="${x.id}"
                   style="padding:10px 12px; border-bottom:1px solid #f1f5f9; cursor:pointer;">
                <div style="font-weight:800;">${escAttr(x.label || "—")}</div>
                ${x.code ? `<div style="color:#64748b; font-size:12px;">${escAttr(x.code)}</div>` : ``}
              </div>
            `).join("")}
          </div>
        `;
      } else {
        dd.innerHTML = "";
      }
    }

    document.querySelectorAll(".diagPick").forEach(el => {
      el.onclick = () => {
        const id = el.getAttribute("data-id");
        const item = (diagResults || []).find(x => String(x.id) === String(id));
        addDiagnosis(item);
      };
    });

    document.querySelectorAll(".diagRemove").forEach(el => {
      el.onclick = (ev) => {
        ev.preventDefault();
        const id = el.getAttribute("data-id");
        removeDiagnosis(id);
      };
    });
  }

  async function searchDiagnoses(q) {
    const query = String(q || "");
    diagQuery = query;

    const clean = query.trim();

    if (!clean || clean.length < 2) {
      diagLoading = false;
      diagResults = [];
      renderDiagArea();
      return;
    }

    diagLoading = true;
    renderDiagArea();

    const needle = clean.toLowerCase();

    const { data, error } = await window.sb
      .from("diagnoses_catalog")
      .select("id, code, label")
      .eq("is_active", true)
      .ilike("search_text", `%${needle}%`)
      .order("label", { ascending: true })
      .limit(15);

    if (error) {
      console.error(error);
      diagLoading = false;
      diagResults = [];
      renderDiagArea();
      return;
    }

    const rows = (data || []).map(r => ({
      id: r.id,
      code: r.code || "",
      label: r.label || ""
    }));

    const sel = new Set(selectedDiag.map(x => String(x.id)));
    diagResults = rows.filter(x => !sel.has(String(x.id)));

    diagLoading = false;
    renderDiagArea();
  }

  function addDiagnosis(item) {
    if (!item || !item.id) return;
    if (selectedDiag.some(x => String(x.id) === String(item.id))) return;

    selectedDiag.push({ id: item.id, code: item.code || "", label: item.label || "" });

    const inp = document.getElementById("diagSearch");
    diagQuery = "";
    diagResults = [];
    if (inp) inp.value = "";

    renderDiagArea();
    inp?.focus();
  }

  function removeDiagnosis(id) {
    selectedDiag = selectedDiag.filter(x => String(x.id) !== String(id));
    renderDiagArea();
  }

  /* ================= TRATAMENTOS (CATÁLOGO) — DUAL LIST ================= */

  function sentenceizeLabel(s) {
    const raw = String(s || "").trim();
    if (!raw) return "";
    let t = raw.toLowerCase();
    t = t.replace(/\s+/g, " ");
    t = t.replace(/(^|[.!?]\s+)([a-zà-ÿ])/g, (m, p1, p2) => p1 + p2.toUpperCase());
    t = t.replace(/^([a-zà-ÿ])/, (m, c) => c.toUpperCase());
    return t;
  }

  function normTreatRow(t) {
    return {
      id: t.id,
      label: sentenceizeLabel(t.label || t.name || t.title || ""),
      code: t.code || t.adse_code || t.proc_code || "",
    };
  }

  async function fetchTreatmentsDefault() {
    try {
      treatLoading = true;
      renderTreatArea();

      let res = await window.sb
        .from("treatments_catalog")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("label", { ascending: true })
        .limit(200);

      if (res?.error) {
        res = await window.sb
          .from("treatments_catalog")
          .select("*")
          .order("sort_order", { ascending: true, nullsFirst: false })
          .order("label", { ascending: true })
          .limit(200);
      }

      const rows = (res?.data || []).map(normTreatRow);

      const sel = new Set(selectedTreat.map(x => String(x.id)));
      treatResults = rows.filter(x => !sel.has(String(x.id)));

      treatLoading = false;
      renderTreatArea();
    } catch (e) {
      console.error(e);
      treatLoading = false;
      treatResults = [];
      renderTreatArea();
    }
  }

  async function searchTreatments(q) {
    const query = String(q || "");
    treatQuery = query;

    const clean = query.trim();

    if (!clean || clean.length < 2) {
      await fetchTreatmentsDefault();
      return;
    }

    treatLoading = true;
    renderTreatArea();

    const needle = clean.toLowerCase();

    let data = null, error = null;

    try {
      const r1 = await window.sb
        .from("treatments_catalog")
        .select("*")
        .eq("is_active", true)
        .ilike("search_text", `%${needle}%`)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("label", { ascending: true })
        .limit(200);

      data = r1.data;
      error = r1.error;

      if (error) throw error;
    } catch (e) {
      try {
        const r2 = await window.sb
          .from("treatments_catalog")
          .select("*")
          .ilike("label", `%${needle}%`)
          .order("sort_order", { ascending: true, nullsFirst: false })
          .order("label", { ascending: true })
          .limit(200);

        data = r2.data;
        error = r2.error;
      } catch (e2) {
        error = e2;
      }
    }

    if (error) {
      console.error(error);
      treatLoading = false;
      treatResults = [];
      renderTreatArea();
      return;
    }

    const rows = (data || []).map(normTreatRow);
    const sel = new Set(selectedTreat.map(x => String(x.id)));
    treatResults = rows.filter(x => !sel.has(String(x.id)));

    treatLoading = false;
    renderTreatArea();
  }

  function addTreatment(item) {
    if (!item || !item.id) return;
    if (selectedTreat.some(x => String(x.id) === String(item.id))) return;

    selectedTreat.push({ id: item.id, code: item.code || "", label: item.label || "", qty: 1 });
    treatResults = (treatResults || []).filter(x => String(x.id) !== String(item.id));

    renderTreatArea();
  }

  function removeTreatment(id) {
    const rem = selectedTreat.find(x => String(x.id) === String(id));
    selectedTreat = selectedTreat.filter(x => String(x.id) !== String(id));

    if (rem) {
      treatResults = [{ id: rem.id, label: rem.label || "", code: rem.code || "" }, ...(treatResults || [])];
      const seen = new Set();
      treatResults = (treatResults || []).filter(x => {
        const k = String(x.id);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    }

    renderTreatArea();
  }

  function renderTreatArea() {
    const boxSel = document.getElementById("treatSelectedBox");
    const boxCat = document.getElementById("treatCatalogBox");
    const st = document.getElementById("treatStatus");

    if (st) st.innerHTML = treatLoading ? `<div style="margin-top:6px; color:#64748b;">A carregar…</div>` : "";

    if (boxSel) {
      if (!selectedTreat.length) {
        boxSel.innerHTML = `<div style="color:#64748b;">Sem tratamentos selecionados.</div>`;
      } else {
        boxSel.innerHTML = `
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${selectedTreat.map(x => `
              <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;
                          padding:10px 12px; border:1px solid #e5e5e5; border-radius:12px;">
                <div style="display:flex; flex-direction:column;">
                  <div style="font-weight:900;">${escAttr(x.label || "—")}</div>
                  ${x.code ? `<div style="color:#64748b; font-size:12px;">${escAttr(x.code)}</div>` : ``}
                </div>
                <button class="treatRemove gcBtn" data-id="${x.id}"
                        style="padding:6px 10px; border-radius:999px;">
                  ×
                </button>
              </div>
            `).join("")}
          </div>
        `;
      }
    }

    if (boxCat) {
      if (!treatResults || !treatResults.length) {
        boxCat.innerHTML = `<div style="color:#64748b;">Sem resultados.</div>`;
      } else {
        boxCat.innerHTML = `
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${treatResults.map(x => `
              <div class="treatPick"
                   data-id="${x.id}"
                   style="padding:10px 12px; border:1px solid #e5e5e5; border-radius:12px; cursor:pointer;">
                <div style="font-weight:900;">${escAttr(x.label || "—")}</div>
                ${x.code ? `<div style="color:#64748b; font-size:12px;">${escAttr(x.code)}</div>` : ``}
              </div>
            `).join("")}
          </div>
        `;
      }
    }

    document.querySelectorAll(".treatPick").forEach(el => {
      el.onclick = () => {
        const id = el.getAttribute("data-id");
        const item = (treatResults || []).find(x => String(x.id) === String(id));
        addTreatment(item);
      };
    });

    document.querySelectorAll(".treatRemove").forEach(el => {
      el.onclick = (ev) => {
        ev.preventDefault();
        const id = el.getAttribute("data-id");
        removeTreatment(id);
      };
    });
  }

  /* ================= DOCUMENTO v1 (HTML + Editor) ================= */
  function fmtDobPt(d) {
    try {
      if (!d) return "—";
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return String(d);
      const dd = String(dt.getDate()).padStart(2, "0");
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      const yy = dt.getFullYear();
      return `${dd}-${mm}-${yy}`;
    } catch (e) {
      return String(d || "—");
    }
  }

  function patientAddressCompact() {
    const a = String(p.address_line1 || "").trim();
    const pc = String(p.postal_code || "").trim();
    const city = String(p.city || "").trim();

    let tail = "";
    if (pc && city) tail = `${pc} ${city}`;
    else if (pc) tail = pc;
    else if (city) tail = city;

    const parts = [];
    if (a) parts.push(a);
    if (tail) parts.push(tail);

    return parts.join(", ") || "—";
  }

  async function fetchClinicForPdf() {
    if (!activeClinicId) return null;
    try {
      const { data, error } = await window.sb
        .from("clinics")
        .select("id, name, address_line1, address_line2, postal_code, city, phone, email, website, logo_url")
        .eq("id", activeClinicId)
        .single();

      if (error) { console.error(error); return null; }
      return data || null;
    } catch (e) {
      console.error(e);
      return null;
    }
  }

  async function fetchCurrentUserDisplayName(userId) {
    try {
      const { data, error } = await window.sb
        .from("clinic_members")
        .select("display_name")
        .eq("user_id", userId)
        .limit(1);

      if (error) { console.error(error); return ""; }
      const v = data && data.length ? (data[0].display_name || "") : "";
      return v;
    } catch (e) {
      console.error(e);
      return "";
    }
  }

  function buildDocV1Html({ clinic, consult, authorName }) {
    const reportDate = consult?.report_date ? String(consult.report_date) : "";
    const hda = sanitizeHTML(consult?.hda || "");
    const diags = (consult?.diagnoses || []).slice(0, 3);
    const trts = (consult?.treatments || []).slice(0, 6);

    const rx = getPrescriptionTextFromPlan(consult?.plan_text || "") || "R/ 20 Sessões de Tratamentos de Medicina Fisica e de Reabilitação com:";

    const line2Parts = [];
    if (p.sns) line2Parts.push(`Nº Utente: ${escAttr(p.sns)}`);
    if (p.insurance_provider) line2Parts.push(`Seguro: ${escAttr(p.insurance_provider)}`);
    if (p.insurance_policy_number) line2Parts.push(`Nº: ${escAttr(p.insurance_policy_number)}`);
    if (p.nif) line2Parts.push(`NIF: ${escAttr(p.nif)}`);

    const line2 = line2Parts.join(" | ") || "—";

    const clinicWebsite = (clinic && clinic.website) ? String(clinic.website) : (p.website || "www.joaomorais.pt");
    const logoUrl = clinic && clinic.logo_url ? String(clinic.logo_url) : "";

    return `
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escAttr(docTitle)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm 18mm 18mm; }
  body { font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif; color:#111; }
  .page { position: relative; min-height: 1000px; }
  .vbar { position: fixed; left: 0; top: 0; bottom: 0; width: 10mm; background: #111; }
  .wrap { margin-left: 6mm; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; gap:14px; }
  .h-left { flex: 1; }
  .h-name { font-weight: 900; font-size: 18px; letter-spacing: 0.2px; }
  .h-line { margin-top: 4px; font-size: 12.5px; line-height: 1.35; }
  .h-line b { font-weight: 800; }
  .logo { width: 140px; max-height: 60px; object-fit: contain; }
  .sep { height: 1px; background: #111; margin: 10px 0 12px 0; opacity: 0.9; }

  .section { margin-top: 10px; }
  .stitle { font-weight: 900; font-size: 13px; text-transform: uppercase; letter-spacing: 0.6px; }
  .sbody { margin-top: 6px; font-size: 13.5px; line-height: 1.6; }

  .rx { margin-top: 8px; font-size: 13.5px; line-height: 1.55; }
  .rx b { font-weight: 900; }

  .footer { margin-top: 18px; display:flex; justify-content:space-between; align-items:flex-end; gap:12px; }
  .foot-left { font-size: 12px; }
  .foot-vbar { width: 90px; height: 6px; background:#111; margin-top:6px; }
  .sign { margin-top: 22px; border-top: 1px solid #111; padding-top: 10px; }
  .sign .name { font-weight: 900; }
  .sign .meta { font-size: 12px; margin-top: 4px; }
  .last-page { min-height: 1000px; display:flex; flex-direction:column; }
  .push { flex: 1; }
</style>
</head>
<body>
  <div class="vbar"></div>
  <div class="wrap">

    <div class="page">
      <div class="header">
        <div class="h-left">
          <div class="h-name">${escAttr(p.full_name || "—")}</div>
          <div class="h-line">${line2}</div>
          <div class="h-line"><b>DN:</b> ${escAttr(fmtDobPt(p.dob))} &nbsp; | &nbsp; <b>Morada:</b> ${escAttr(patientAddressCompact())}</div>
          ${reportDate ? `<div class="h-line"><b>Data:</b> ${escAttr(reportDate)}</div>` : ``}
        </div>
        <div>
          ${logoUrl ? `<img class="logo" src="${escAttr(logoUrl)}" />` : ``}
        </div>
      </div>

      <div class="sep"></div>

      <div class="section">
        <div class="stitle">História clínica</div>
        <div class="sbody">${hda || `<span style="color:#475569;">—</span>`}</div>
      </div>

      <div class="section">
        <div class="stitle">Diagnóstico</div>
        <div class="sbody">
          ${diags && diags.length ? `
            <ul style="margin:6px 0 0 18px; padding:0;">
              ${diags.map(d => `<li>${escAttr(d.label || "—")}${d.code ? ` <span style="color:#475569;">(${escAttr(d.code)})</span>` : ``}</li>`).join("")}
            </ul>
          ` : `<span style="color:#475569;">—</span>`}
        </div>
      </div>

      <div class="section">
        <div class="stitle">Plano terapêutico</div>
        <div class="rx"><b>${escAttr(rx)}</b></div>
        <div class="sbody">
          ${trts && trts.length ? `
            <ul style="margin:6px 0 0 18px; padding:0;">
              ${trts.map(t => `<li>${escAttr(sentenceizeLabel(t.label || "—"))}${t.code ? ` <span style="color:#475569;">(${escAttr(t.code)})</span>` : ``}</li>`).join("")}
            </ul>
          ` : `<span style="color:#475569;">—</span>`}
        </div>
      </div>

      <div class="footer">
        <div class="foot-left">
          <div>${escAttr(clinicWebsite || "www.joaomorais.pt")}</div>
          <div class="foot-vbar"></div>
        </div>
        <div style="font-size:12px; color:#475569;">
          ${clinic && clinic.name ? escAttr(clinic.name) : ``}
        </div>
      </div>
    </div>

    <div class="page last-page">
      <div class="push"></div>
      <div class="sign">
        <div class="name">${escAttr(authorName || "")}</div>
        <div class="meta">Assinatura</div>
      </div>
    </div>

  </div>
</body>
</html>
`;
  }

  function openDocumentEditor(html) {
    docDraftHtml = String(html || "");
    docMode = "edit";
    docOpen = true;
    docSaving = false;
    render();
    bindDocEvents();
  }

  function closeDocumentEditor() {
    docOpen = false;
    docSaving = false;
    docMode = "edit";
    render();
  }

  function renderDocumentEditorModal() {
    // ✅ textarea sem conteúdo inline (para não escapar HTML); o valor é colocado em bindDocEvents()
    return `
      <div id="docOverlay"
           style="position:fixed; inset:0; background:rgba(0,0,0,0.35);
                  display:flex; align-items:center; justify-content:center; padding:12px; z-index:2200;">
        <div style="background:#fff; width:min(1200px,96vw);
                    max-height:92vh; overflow:auto;
                    border-radius:14px; border:1px solid #e5e5e5; padding:16px;">

          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
            <div style="font-weight:900; font-size:16px;">Documento v1 — ${docMode === "preview" ? "pré-visualização" : "editar HTML"}</div>
            <div style="display:flex; gap:8px;">
              <button id="btnDocCloseTop" class="gcBtn">Fechar</button>
            </div>
          </div>

          <div style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
            <div style="flex:1; min-width:260px;">
              <label>Título</label>
              <input id="docTitle" value="${escAttr(docTitle)}"
                     style="width:100%; padding:10px; border:1px solid #ddd; border-radius:10px;" />
            </div>

            <div style="display:flex; gap:8px; align-items:flex-end;">
              <button id="btnDocModeEdit" class="gcBtn">Editar</button>
              <button id="btnDocModePreview" class="gcBtn" style="font-weight:900;">Pré-visualizar</button>
            </div>
          </div>

          ${docMode === "preview" ? `
            <div style="margin-top:12px; border:1px solid #e5e5e5; border-radius:12px; overflow:hidden;">
              <iframe id="docPreview" style="width:100%; height:65vh; border:0;"></iframe>
            </div>
          ` : `
            <div style="margin-top:12px;">
              <textarea id="docHtml"
                        style="width:100%; height:65vh; padding:12px; border:1px solid #ddd; border-radius:12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size:12px; line-height:1.4;"></textarea>
            </div>
          `}

          <div style="margin-top:12px; display:flex; justify-content:space-between; align-items:center; gap:10px;">
            <div id="docStatus" style="color:#64748b;">${docSaving ? "A gerar/upload..." : ""}</div>

            <div style="display:flex; gap:10px;">
              <button id="btnDocCancel" class="gcBtn">Cancelar</button>
              <button id="btnDocGeneratePdfNow" class="gcBtn" style="font-weight:900;">
                Gerar PDF (v1)
              </button>
            </div>
          </div>

        </div>
      </div>
    `;
  }

  function bindDocEvents() {
    const btnCloseTop = document.getElementById("btnDocCloseTop");
    if (btnCloseTop) btnCloseTop.onclick = () => closeDocumentEditor();

    const btnCancel = document.getElementById("btnDocCancel");
    if (btnCancel) btnCancel.onclick = () => closeDocumentEditor();

    const t = document.getElementById("docTitle");
    if (t) t.oninput = (e) => { docTitle = e?.target?.value ?? "Relatório Médico"; };

    const bEdit = document.getElementById("btnDocModeEdit");
    const bPrev = document.getElementById("btnDocModePreview");
    if (bEdit) bEdit.onclick = () => { docMode = "edit"; render(); bindDocEvents(); };
    if (bPrev) bPrev.onclick = () => { docMode = "preview"; render(); bindDocEvents(); mountPreviewIframe(); };

    const ta = document.getElementById("docHtml");
    if (ta) {
      // ✅ colocar conteúdo real no editor
      if (ta.value !== String(docDraftHtml || "")) ta.value = String(docDraftHtml || "");
      ta.oninput = (e) => { docDraftHtml = e?.target?.value ?? ""; };
    }

    const btnGen = document.getElementById("btnDocGeneratePdfNow");
    if (btnGen) {
      btnGen.disabled = !!docSaving;
      btnGen.onclick = async () => {
        if (docSaving) return;
        // garantir que o draft apanha o valor final
        const ta2 = document.getElementById("docHtml");
        if (ta2) docDraftHtml = ta2.value || "";

        docSaving = true;
        render();
        bindDocEvents();
        const ok = await generatePdfAndUploadV1();
        docSaving = false;

        if (ok) {
          docOpen = false;
          await loadDocuments();
          render();
        } else {
          render();
          bindDocEvents();
        }
      };
    }

    if (docMode === "preview") mountPreviewIframe();
  }

  function mountPreviewIframe() {
    const iframe = document.getElementById("docPreview");
    if (!iframe) return;
    try {
      const blob = new Blob([String(docDraftHtml || "")], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      iframe.src = url;
      setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) {} }, 15000);
    } catch (e) {
      console.error(e);
    }
  }

  async function htmlToPdfBlob(html, fileName) {
    if (window.html2pdf) {
      const host = document.createElement("div");
      host.style.position = "fixed";
      host.style.left = "0";
      host.style.top = "0";
      host.style.width = "210mm";
      host.style.background = "#fff";
      host.style.zIndex = "0";
      host.style.pointerEvents = "none";
      host.style.opacity = "1";
      host.style.transform = "none";
      host.innerHTML = String(html || "");

      document.body.appendChild(host);

      try {
        try { window.scrollTo(0, 0); } catch (_) {}

        const opt = {
          margin: 0,
          filename: fileName || "documento.pdf",
          image: { type: "jpeg", quality: 0.98 },
          pagebreak: { mode: ["css", "legacy"] },
          html2canvas: {
            scale: 2,
            useCORS: true,
            backgroundColor: "#ffffff",
            windowWidth: Math.max(host.scrollWidth, host.offsetWidth, 800),
            windowHeight: Math.max(host.scrollHeight, host.offsetHeight, 1100),
            scrollX: 0,
            scrollY: 0
          },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
        };

        const worker = window.html2pdf().set(opt).from(host);
        const pdf = await worker.toPdf().get("pdf");
        return pdf.output("blob");
      } finally {
        try { document.body.removeChild(host); } catch (e) {}
      }
    }

    alert("Não encontrei html2pdf no frontend. Confirma que a biblioteca está incluída no app.html.");
    return null;
  }

  async function uploadPdfToStorage({ blob, path }) {
    try {
      const r = await window.sb.storage
        .from("documents")
        .upload(path, blob, {
          contentType: "application/pdf",
          upsert: true
        });

      if (r?.error) {
        console.error("uploadPdf error:", r.error);
        return { ok: false, error: r.error };
      }

      return { ok: true };
    } catch (e) {
      console.error("uploadPdf exception:", e);
      return { ok: false, error: e };
    }
  }

  async function insertDocumentRow(meta) {
    // ✅ schema real: clinic_id, patient_id, consultation_id, title, html, parent_document_id, version, storage_path
    try {
      const payload = {
        clinic_id: meta.clinic_id,
        patient_id: meta.patient_id,
        consultation_id: meta.consultation_id,
        title: meta.title,
        html: meta.html || "",
        parent_document_id: meta.parent_document_id || null,
        version: Number(meta.version || 1),
        storage_path: meta.storage_path || null
      };

      const { data, error } = await window.sb
        .from("documents")
        .insert(payload)
        .select("id")
        .single();

      if (error) {
        console.error("insertDocumentRow error:", error);
        return { ok: false, error };
      }

      return { ok: true, id: data?.id || null };
    } catch (e) {
      console.error("insertDocumentRow exception:", e);
      return { ok: false, error: e };
    }
  }

  async function generatePdfAndUploadV1() {
    try {
      if (!lastSavedConsultId) { alert("Sem consulta gravada para gerar PDF."); return false; }

      const userRes = await window.sb.auth.getUser();
      const userId = userRes?.data?.user?.id;
      if (!userId) { alert("Utilizador não autenticado."); return false; }

      const consult = (consultRows || []).find(x => String(x.id) === String(lastSavedConsultId));
      if (!consult) {
        alert("Não encontrei a consulta no feed. Atualiza o feed e tenta novamente.");
        return false;
      }

      const clinic = await fetchClinicForPdf();
      const authorName = await fetchCurrentUserDisplayName(userId);

      if (!docDraftHtml || docDraftHtml.trim().length < 50) {
        docDraftHtml = buildDocV1Html({ clinic, consult, authorName });
      }

      const safeTitle = String(docTitle || "Relatório Médico")
        .trim()
        .replace(/[^\p{L}\p{N}\s._-]+/gu, "")
        .replace(/\s+/g, " ")
        .slice(0, 80) || "Relatorio";

      const fileName = `${safeTitle}.pdf`;

      const blob = await htmlToPdfBlob(docDraftHtml, fileName);
      if (!blob) return false;

      const ymd = new Date().toISOString().slice(0,10);
      const path = `clinic_${activeClinicId}/patient_${p.id}/consult_${consult.id}/v1_${ymd}.pdf`;

      const up = await uploadPdfToStorage({ blob, path });
      if (!up.ok) {
        alert("Falhou o upload do PDF para Storage.");
        return false;
      }

      const ins = await insertDocumentRow({
        patient_id: p.id,
        clinic_id: activeClinicId,
        consultation_id: consult.id,
        title: safeTitle,
        html: String(docDraftHtml || ""),
        parent_document_id: null,
        version: 1,
        storage_path: path
      });

      if (!ins.ok) {
        alert("PDF gerado e enviado para Storage, mas falhou o registo na tabela documents (ver consola).");
        return false;
      }

      alert("PDF (v1) criado com sucesso.");
      return true;
    } catch (e) {
      console.error(e);
      alert("Erro na geração/upload do PDF.");
      return false;
    }
  }

  /* ================= TIMELINE ================= */
  function renderDocumentsInlineForConsult(consultId) {
    const docs = (docRows || []).filter(d => d.consultation_id && String(d.consultation_id) === String(consultId));
    if (!docs.length) return "";

    return `
      <div style="margin-top:12px;">
        <div style="font-weight:900;">Documentos:</div>
        <div style="margin-top:8px; display:flex; flex-direction:column; gap:8px;">
          ${docs.map(d => `
            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;
                        padding:10px 12px; border:1px solid #e5e5e5; border-radius:12px;">
              <div style="display:flex; flex-direction:column;">
                <div style="font-weight:900;">${escAttr(d.title || "Documento")}${d.version ? ` <span style="color:#64748b; font-size:12px;">(v${escAttr(d.version)})</span>` : ``}</div>
                <div style="color:#64748b; font-size:12px;">${d.created_at ? escAttr(String(d.created_at)) : ""}</div>
              </div>
              <div style="display:flex; gap:8px;">
                ${d.url ? `<a class="gcBtn" href="${escAttr(d.url)}" target="_blank" rel="noopener" style="text-decoration:none;">Abrir</a>` : `<button class="gcBtn" disabled>Sem link</button>`}
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  function renderTimeline() {

    if (timelineLoading) return `<div style="color:#64748b;">A carregar registos...</div>`;
    if (!consultRows || !consultRows.length) return `<div style="color:#64748b;">Sem registos clínicos.</div>`;

    return `
      <div style="display:flex; flex-direction:column; gap:14px;">
        ${consultRows.map(r => {
          const d = r.created_at ? new Date(r.created_at) : null;
          const when = (d && !isNaN(d.getTime()))
            ? `${fmtDatePt(d)} às ${fmtTime(d)}`
            : (r.report_date ? String(r.report_date) : "—");

          return `
          <div style="border:1px solid #e5e5e5; border-radius:14px; padding:16px;">

            <div style="font-weight:900; font-size:16px;">
              Consulta — ${when} - ${escAttr(String(r.author_name || ""))}
            </div>

            <div style="margin-top:10px; line-height:1.55; font-size:15px;">
              ${sanitizeHTML(r.hda || "") || `<span style="color:#64748b;">—</span>`}
            </div>

            ${r.diagnoses && r.diagnoses.length ? `
              <div style="margin-top:12px;">
                <div style="font-weight:900;">Diagnósticos:</div>
                <ul style="margin:8px 0 0 18px;">
                  ${r.diagnoses.map(dg => `
                    <li>${escAttr(dg.label || "—")}${dg.code ? ` <span style="color:#64748b;">(${escAttr(dg.code)})</span>` : ``}</li>
                  `).join("")}
                </ul>
              </div>
            ` : ``}

            ${r.treatments && r.treatments.length ? `
              <div style="margin-top:12px;">
                <div style="font-weight:900;">Tratamentos:</div>
                <ul style="margin:8px 0 0 18px;">
                  ${r.treatments.map(t => `
                    <li>
                      ${escAttr(sentenceizeLabel(t.label || "—"))}
                      ${t.code ? ` <span style="color:#64748b;">(${escAttr(t.code)})</span>` : ``}
                    </li>
                  `).join("")}
                </ul>
              </div>
            ` : ``}

            ${renderDocumentsInlineForConsult(r.id)}

          </div>
        `; }).join("")}
      </div>
    `;
  }

  /* ================= INLINE FORM ================= */
  function renderConsultFormInline() {
    const today = new Date().toISOString().slice(0, 10);

    return `
      <div style="margin-top:16px; padding:16px; border:1px solid #e5e5e5; border-radius:14px;">

        <div style="font-weight:900; font-size:16px;">Nova Consulta Médica</div>

        <div style="margin-top:10px;">
          <label>Data</label>
          <input type="date" value="${today}" readonly
            style="padding:8px; border:1px solid #ddd; border-radius:8px;" />
        </div>

        <div style="margin-top:14px; display:flex; gap:8px; flex-wrap:wrap;">
          <button id="hBold" class="gcBtn">Negrito</button>
          <button id="hUnder" class="gcBtn">Sublinhar</button>
          <button id="hUL" class="gcBtn">Lista</button>
          <button id="hOL" class="gcBtn">Numeração</button>
        </div>

        <div id="hdaEditor"
             contenteditable="true"
             style="margin-top:10px; min-height:240px; padding:12px;
                    border:1px solid #ddd; border-radius:12px;
                    line-height:1.6; font-size:16px; overflow:auto;">
          ${draftHDAHtml || ""}
        </div>

        <div style="margin-top:14px;">
          <label>Diagnóstico (catálogo)</label>

          <div style="position:relative; margin-top:6px; max-width:720px;">
            <input id="diagSearch"
                   value="${escAttr(diagQuery)}"
                   placeholder="Pesquisar (mín. 2 letras)…"
                   style="width:100%; padding:10px; border:1px solid #ddd; border-radius:10px;" />
            <div id="diagStatus"></div>
            <div id="diagDropdownHost" style="position:relative;"></div>
          </div>

          <div id="diagChips"></div>
        </div>

        <!-- ===== TRATAMENTOS ===== -->
        <div style="margin-top:14px;">
          <label>Tratamentos (catálogo)</label>

          <div style="margin-top:6px; max-width:980px;">
            <input id="prescriptionText"
                   value="${escAttr(prescriptionText)}"
                   style="width:100%; padding:10px; border:1px solid #ddd; border-radius:10px;" />

            <div style="margin-top:6px; display:flex; gap:10px; flex-wrap:wrap;">
              <div style="flex:1; min-width:320px;">
                <div style="font-weight:900; margin-bottom:6px;">Selecionados</div>
                <div id="treatSelectedBox"
                     style="min-height:120px; padding:12px; border:1px solid #e5e5e5; border-radius:12px; background:#fff;">
                </div>
              </div>

              <div style="flex:1; min-width:320px;">
                <div style="font-weight:900; margin-bottom:6px;">Catálogo</div>
                <input id="treatSearch"
                       value="${escAttr(treatQuery)}"
                       placeholder="Pesquisar tratamentos (mín. 2 letras)…"
                       style="width:100%; padding:10px; border:1px solid #ddd; border-radius:10px;" />
                <div id="treatStatus"></div>
                <div id="treatCatalogBox"
                     style="margin-top:8px; min-height:120px; max-height:320px; overflow:auto; padding:12px; border:1px solid #e5e5e5; border-radius:12px; background:#fff;">
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style="margin-top:14px; display:flex; justify-content:flex-end; gap:10px;">
          <button id="btnCancelConsult" class="gcBtn">Cancelar</button>
          <button id="btnSaveConsult" class="gcBtn" style="font-weight:900;">Gravar</button>
        </div>

      </div>
    `;
  }

  function bindConsultEvents() {
    const ed = document.getElementById("hdaEditor");
    if (ed) {
      ed.oninput = () => { draftHDAHtml = ed.innerHTML || ""; };

      function cmd(c) {
        ed.focus();
        try { document.execCommand(c, false, null); } catch (e) {}
        draftHDAHtml = ed.innerHTML || "";
      }

      const bBold = document.getElementById("hBold");
      const bUnder = document.getElementById("hUnder");
      const bUL = document.getElementById("hUL");
      const bOL = document.getElementById("hOL");

      if (bBold) bBold.onclick = () => cmd("bold");
      if (bUnder) bUnder.onclick = () => cmd("underline");
      if (bUL) bUL.onclick = () => cmd("insertUnorderedList");
      if (bOL) bOL.onclick = () => cmd("insertOrderedList");
    }

    const diagInput = document.getElementById("diagSearch");
    if (diagInput) {
      diagInput.oninput = (e) => {
        const v = e?.target?.value ?? "";
        diagQuery = v;
        if (diagDebounceT) clearTimeout(diagDebounceT);
        diagDebounceT = setTimeout(() => searchDiagnoses(v), 220);
      };

      diagInput.onfocus = () => {
        const v = diagInput.value || "";
        if (String(v).trim().length >= 2) searchDiagnoses(v);
      };

      diagInput.onkeydown = (ev) => {
        if (ev.key === "Enter") ev.preventDefault();
      };
    }

    renderDiagArea();

    const pr = document.getElementById("prescriptionText");
    if (pr) {
      pr.oninput = (e) => { prescriptionText = e?.target?.value ?? ""; };
    }

    const tInput = document.getElementById("treatSearch");
    if (tInput) {
      tInput.oninput = (e) => {
        const v = e?.target?.value ?? "";
        treatQuery = v;
        if (treatDebounceT) clearTimeout(treatDebounceT);
        treatDebounceT = setTimeout(() => searchTreatments(v), 220);
      };

      tInput.onfocus = () => {
        const v = tInput.value || "";
        if (String(v).trim().length >= 2) searchTreatments(v);
      };

      tInput.onkeydown = (ev) => {
        if (ev.key === "Enter") ev.preventDefault();
      };
    }

    renderTreatArea();
    fetchTreatmentsDefault();

    const btnCancel = document.getElementById("btnCancelConsult");
    if (btnCancel) btnCancel.onclick = () => { creatingConsult = false; render(); };

    const btnSave = document.getElementById("btnSaveConsult");
    if (btnSave) {
      btnSave.disabled = !!saving;
      btnSave.onclick = async () => {
        if (saving) return;
        saving = true;
        btnSave.disabled = true;

        if (ed) draftHDAHtml = ed.innerHTML || "";

        const ok = await saveConsult();

        saving = false;
        btnSave.disabled = false;

        if (ok) {
          creatingConsult = false;
          await loadConsultations();
          await loadDocuments();
          render();
        }
      };
    }
  }

  async function saveConsult() {
    try {
      const userRes = await window.sb.auth.getUser();
      const userId = userRes?.data?.user?.id;

      if (!userId) { alert("Utilizador não autenticado."); return false; }

      const today = new Date().toISOString().slice(0, 10);
      const now = new Date();

      if (!activeClinicId) { alert("Sem clínica ativa associada ao doente."); return false; }

      const { data: appts, error: apptErr } = await window.sb
        .from("appointments")
        .select("*")
        .eq("patient_id", p.id);

      if (apptErr) console.error(apptErr);

      let appointmentId = null;
      if (appts && appts.length) {
        const sameDay = appts.filter(a => a.start_at && a.start_at.slice(0,10) === today);
        if (sameDay.length) {
          sameDay.sort((a,b) =>
            Math.abs(new Date(a.start_at) - now) -
            Math.abs(new Date(b.start_at) - now)
          );
          appointmentId = sameDay[0].id;
        }
      }

      const planPayload = {
        prescriptionText,
        treat_order: (selectedTreat || []).map(x => x.id)
      };

      const { data: ins, error: insErr } = await window.sb
        .from("consultations")
        .insert({
          clinic_id: activeClinicId,
          patient_id: p.id,
          author_user_id: userId,
          report_date: today,
          hda: draftHDAHtml,
          assessment: "",
          plan_text: JSON.stringify(planPayload),
          appointment_id: appointmentId
        })
        .select("id")
        .single();

      if (insErr) { console.error(insErr); alert("Erro ao gravar consulta."); return false; }

      const consultId = ins?.id;
      lastSavedConsultId = consultId || null;

      if (consultId && selectedDiag && selectedDiag.length) {
        const rows = selectedDiag.map(x => ({ consultation_id: consultId, diagnosis_id: x.id }));
        const { error: dErr } = await window.sb
          .from("consultation_diagnoses")
          .upsert(rows, { onConflict: "consultation_id,diagnosis_id" });

        if (dErr) { console.error(dErr); alert("Consulta gravada, mas houve erro a gravar diagnósticos."); }
      }

      if (consultId && selectedTreat && selectedTreat.length) {
        const rows = selectedTreat.map(x => ({
          consultation_id: consultId,
          treatment_id: x.id,
          qty: Number(x.qty || 1)
        }));

        const { error: tErr } = await window.sb
          .from("consultation_treatments")
          .upsert(rows, { onConflict: "consultation_id,treatment_id" });

        if (tErr) { console.error(tErr); alert("Consulta gravada, mas houve erro a gravar tratamentos."); }
      }

      if (appointmentId) {
        const { error: uErr } = await window.sb
          .from("appointments")
          .update({ status: "done" })
          .eq("id", appointmentId);

        if (uErr) console.error(uErr);
      }

      try {
        if (typeof refreshAgenda === "function") {
          await refreshAgenda();
        } else if (typeof renderAgendaList === "function") {
          renderAgendaList();
        }
      } catch (e) {
        console.error("refreshAgenda falhou:", e);
      }

      draftHDAHtml = "";
      diagQuery = "";
      diagLoading = false;
      diagResults = [];
      selectedDiag = [];

      prescriptionText = "R/ 20 Sessões de Tratamentos de Medicina Fisica e de Reabilitação com:";
      treatQuery = "";
      treatLoading = false;
      treatResults = [];
      selectedTreat = [];

      alert("Consulta gravada.");
      return true;

    } catch (err) {
      console.error(err);
      alert("Erro ao gravar consulta.");
      return false;
    }
  }

  /* ================= MAIN RENDER ================= */
  function render() {
    root.innerHTML = `
      <div style="position:fixed; inset:0; background:rgba(0,0,0,0.35);
                  display:flex; align-items:center; justify-content:center; padding:12px;">
        <div style="background:#fff; width:min(1400px,96vw);
                    height:92vh; border-radius:14px;
                    border:1px solid #e5e5e5; padding:16px; overflow:auto;">

          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="font-weight:900;">Feed do Doente</div>
            <button id="btnClosePView" class="gcBtn">Fechar</button>
          </div>

          <div style="margin-top:12px; display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap;">
            <div>
              <div style="font-weight:900; font-size:18px;">
                ${escAttr(p.full_name || "—")}${birthdayBadgeToday()}
              </div>

              <div style="margin-top:6px; color:#475569; display:flex; gap:14px; flex-wrap:wrap;">
                <div><b>SNS:</b> ${escAttr(p.sns || "—")}</div>
                <div><b>Seguro:</b> ${escAttr(p.insurance_provider || "—")}</div>
                <div><b>Nº:</b> ${escAttr(p.insurance_policy_number || "—")}</div>
                <div><b>Idade:</b> ${escAttr(ageTextToday())}</div>
              </div>
            </div>

            <div style="display:flex; gap:10px; align-items:flex-start; flex-wrap:wrap;">
              <button id="btnViewIdent" class="gcBtn">Ver Identificação</button>
              <button id="btnEditIdent" class="gcBtn" style="font-weight:900;">Editar Dados</button>
            </div>
          </div>

          <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
            ${isDoctor() && !creatingConsult ? `
              <button id="btnNewConsult" class="gcBtn" style="font-weight:900;">
                Consulta Médica
              </button>` : ``}

            ${isDoctor() && lastSavedConsultId ? `
              <button id="btnEditDocument" class="gcBtn">
                Editar Documento
              </button>
              <button id="btnGeneratePdf" class="gcBtn" style="font-weight:900;">
                Gerar PDF
              </button>` : ``}

            ${docsLoading ? `<div style="color:#64748b;">A carregar PDFs…</div>` : ``}
          </div>

          ${creatingConsult ? renderConsultFormInline() : ""}

          <div style="margin-top:18px;">
            ${renderTimeline()}
          </div>

        </div>
      </div>

      ${identOpen ? renderIdentityModal() : ""}

      ${docOpen ? renderDocumentEditorModal() : ""}
    `;

    document.getElementById("btnClosePView")?.addEventListener("click", closeModalRoot);

    const bView = document.getElementById("btnViewIdent");
    if (bView) bView.onclick = () => openPatientIdentity("view");

    const bEdit = document.getElementById("btnEditIdent");
    if (bEdit) bEdit.onclick = () => openPatientIdentity("edit");

    if (isDoctor() && !creatingConsult) {
      const btnNew = document.getElementById("btnNewConsult");
      if (btnNew) {
        btnNew.onclick = () => {
          creatingConsult = true;
          render();
          bindConsultEvents();
        };
      }
    }

    const btnEditDoc = document.getElementById("btnEditDocument");
    if (btnEditDoc) {
      btnEditDoc.onclick = async () => {
        const userRes = await window.sb.auth.getUser();
        const userId = userRes?.data?.user?.id;

        const consult = (consultRows || []).find(x => String(x.id) === String(lastSavedConsultId));
        if (!consult) { alert("Consulta não encontrada."); return; }

        const clinic = await fetchClinicForPdf();
        const authorName = userId ? await fetchCurrentUserDisplayName(userId) : "";

        const html = buildDocV1Html({ clinic, consult, authorName });
        openDocumentEditor(html);
      };
    }

    const btnPdf = document.getElementById("btnGeneratePdf");
    if (btnPdf) {
      btnPdf.onclick = async () => {
        docSaving = true;
        render();
        const ok = await generatePdfAndUploadV1();
        docSaving = false;

        if (ok) {
          await loadDocuments();
          render();
        } else {
          render();
        }
      };
    }

    if (creatingConsult) bindConsultEvents();
    if (identOpen) bindIdentityEvents();
    if (docOpen) bindDocEvents();
  }

  (async function boot() {
    await fetchActiveClinic();
    await loadConsultations();
    await loadDocuments();
    render();
  })();
}

/* ==== Fim BLOCO 06B/12 — Modal Doente (HDA Rich + Diagnóstico sem acentos (search_text) + Tratamentos (catálogo+seleção+gravação) + Feed completo) ==== */
/* ==== INÍCIO BLOCO 07/12 — Novo doente (modal página inicial) ==== */

  // ---------- Novo doente (modal da página inicial) ----------
  function openNewPatientMainModal({ clinicId }) {
    const root = document.getElementById("modalRoot");
    if (!root) return;

    if (!clinicId) {
      alert("Seleciona uma clínica (não pode ser 'Todas') para criar um doente.");
      return;
    }

    root.innerHTML = `
      <div id="npMainOverlay" style="position:fixed; inset:0; background:rgba(0,0,0,0.35); display:flex; align-items:center; justify-content:center; padding:18px;">
        <div style="background:#fff; width:min(860px, 100%); border-radius:14px; border:1px solid #e5e5e5; padding:14px; max-height: 86vh; overflow:auto;">
          <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start;">
            <div>
              <div style="font-size:${UI.fs14}px; font-weight:900; color:#111;">Novo doente</div>
              <div style="font-size:${UI.fs12}px; color:#666; margin-top:4px;">
                Nome obrigatório. Identificação: SNS (9 dígitos) ou NIF (9 dígitos) ou Passaporte/ID (4–20 alfanum).
              </div>
            </div>
            <button id="npMainClose" class="gcBtn">Fechar</button>
          </div>

          <div style="margin-top:12px; border:1px solid #eee; border-radius:12px; padding:12px; background:#fafafa;">
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
              <div style="display:flex; flex-direction:column; gap:4px; grid-column: 1 / -1;">
                <label class="gcLabel">Nome completo *</label>
                <input id="npFullName" type="text" autocomplete="off" autocapitalize="off" spellcheck="false"
                  style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
              </div>

              <div style="display:flex; flex-direction:column; gap:4px;">
                <label class="gcLabel">Data nascimento</label>
                <input id="npDob" type="date"
                  style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
              </div>

              <div style="display:flex; flex-direction:column; gap:4px;">
                <label class="gcLabel">Telefone</label>
                <input id="npPhone" type="text" autocomplete="off" autocapitalize="off" spellcheck="false"
                  style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
              </div>

              <div style="display:flex; flex-direction:column; gap:4px;">
                <label class="gcLabel">Email</label>
                <input id="npEmail" type="email" autocomplete="off" autocapitalize="off" spellcheck="false"
                  style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
              </div>

              <div style="display:flex; flex-direction:column; gap:4px;">
                <label class="gcLabel">SNS (9 dígitos)</label>
                <input id="npSNS" type="text" inputmode="numeric" placeholder="#########" autocomplete="off"
                  style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
              </div>

              <div style="display:flex; flex-direction:column; gap:4px;">
                <label class="gcLabel">NIF (9 dígitos)</label>
                <input id="npNIF" type="text" inputmode="numeric" placeholder="#########" autocomplete="off"
                  style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
              </div>

              <div style="display:flex; flex-direction:column; gap:4px; grid-column: 1 / -1;">
                <label class="gcLabel">Passaporte/ID (4–20)</label>
                <input id="npPassport" type="text" placeholder="AB123456" autocomplete="off" autocapitalize="off" spellcheck="false"
                  style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
              </div>

              <div style="display:flex; flex-direction:column; gap:4px;">
                <label class="gcLabel">Seguro</label>
                <input id="npInsuranceProvider" type="text" autocomplete="off" autocapitalize="off" spellcheck="false"
                  style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
              </div>

              <div style="display:flex; flex-direction:column; gap:4px;">
                <label class="gcLabel">Apólice</label>
                <input id="npInsurancePolicy" type="text" autocomplete="off" autocapitalize="off" spellcheck="false"
                  style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
              </div>

              <div style="display:flex; flex-direction:column; gap:4px; grid-column: 1 / -1;">
                <label class="gcLabel">Morada</label>
                <input id="npAddress1" type="text" autocomplete="off" autocapitalize="off" spellcheck="false"
                  style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
              </div>

              <div style="display:flex; flex-direction:column; gap:4px;">
                <label class="gcLabel">Código-postal</label>
                <input id="npPostal" type="text" autocomplete="off" autocapitalize="off" spellcheck="false"
                  style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
              </div>

              <div style="display:flex; flex-direction:column; gap:4px;">
                <label class="gcLabel">Cidade</label>
                <input id="npCity" type="text" autocomplete="off" autocapitalize="off" spellcheck="false"
                  style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
              </div>

              <div style="display:flex; flex-direction:column; gap:4px; grid-column: 1 / -1;">
                <label class="gcLabel">País</label>
                <input id="npCountry" type="text" value="PT" autocomplete="off" autocapitalize="off" spellcheck="false"
                  style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
              </div>

              <div style="display:flex; flex-direction:column; gap:4px; grid-column: 1 / -1;">
                <label class="gcLabel">Notas</label>
                <textarea id="npNotes" rows="2"
                  style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; resize:vertical; font-size:${UI.fs13}px;"></textarea>
              </div>
            </div>

            <div style="margin-top:10px; display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
              <div id="npMsg" style="font-size:${UI.fs12}px; color:#666;"></div>
              <div style="display:flex; gap:10px;">
                <button id="npCancel" class="gcBtn">Cancelar</button>
                <button id="npCreate" class="gcBtn" style="font-weight:900;">Criar doente</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const overlay = document.getElementById("npMainOverlay");
    const btnClose = document.getElementById("npMainClose");
    const npCancel = document.getElementById("npCancel");
    const npCreate = document.getElementById("npCreate");
    const npMsg = document.getElementById("npMsg");

    const npFullName = document.getElementById("npFullName");
    const npDob = document.getElementById("npDob");
    const npPhone = document.getElementById("npPhone");
    const npEmail = document.getElementById("npEmail");
    const npSNS = document.getElementById("npSNS");
    const npNIF = document.getElementById("npNIF");
    const npPassport = document.getElementById("npPassport");
    const npInsuranceProvider = document.getElementById("npInsuranceProvider");
    const npInsurancePolicy = document.getElementById("npInsurancePolicy");
    const npAddress1 = document.getElementById("npAddress1");
    const npPostal = document.getElementById("npPostal");
    const npCity = document.getElementById("npCity");
    const npCountry = document.getElementById("npCountry");
    const npNotes = document.getElementById("npNotes");

    function setErr(msg) { if (npMsg) { npMsg.style.color = "#b00020"; npMsg.textContent = msg; } }
    function setInfo(msg) { if (npMsg) { npMsg.style.color = "#666"; npMsg.textContent = msg; } }

    function close() { closeModalRoot(); }

    if (btnClose) btnClose.addEventListener("click", close);
    if (npCancel) npCancel.addEventListener("click", close);
    if (overlay) overlay.addEventListener("click", (ev) => { if (ev.target && ev.target.id === "npMainOverlay") close(); });

    function validate() {
      const fullName = (npFullName.value || "").trim();
      if (!fullName) return { ok: false, msg: "Nome completo é obrigatório." };

      const sns = normalizeDigits(npSNS.value);
      const nif = normalizeDigits(npNIF.value);
      const pass = (npPassport.value || "").trim();

      if (sns && !/^[0-9]{9}$/.test(sns)) return { ok: false, msg: "SNS inválido: tem de ter 9 dígitos." };
      if (nif && !/^[0-9]{9}$/.test(nif)) return { ok: false, msg: "NIF inválido: tem de ter 9 dígitos." };
      if (pass && !/^[A-Za-z0-9]{4,20}$/.test(pass)) return { ok: false, msg: "Passaporte/ID inválido: 4–20 alfanum." };

      if (!sns && !nif && !pass) return { ok: false, msg: "Identificação obrigatória: SNS ou NIF ou Passaporte/ID." };

      return {
        ok: true,
        full_name: fullName,
        dob: npDob.value ? npDob.value : null,
        phone: npPhone.value ? npPhone.value.trim() : null,
        email: npEmail.value ? npEmail.value.trim() : null,
        sns: sns || null,
        nif: nif || null,
        passport_id: pass || null,
        insurance_provider: npInsuranceProvider.value ? npInsuranceProvider.value.trim() : null,
        insurance_policy_number: npInsurancePolicy.value ? npInsurancePolicy.value.trim() : null,
        address_line1: npAddress1.value ? npAddress1.value.trim() : null,
        postal_code: npPostal.value ? npPostal.value.trim() : null,
        city: npCity.value ? npCity.value.trim() : null,
        country: npCountry.value ? npCountry.value.trim() : "PT",
        notes: npNotes.value ? npNotes.value.trim() : null,
      };
    }

    function refreshButtonState() {
      if (npSNS) { const d = normalizeDigits(npSNS.value); if (npSNS.value !== d) npSNS.value = d; }
      if (npNIF) { const d = normalizeDigits(npNIF.value); if (npNIF.value !== d) npNIF.value = d; }

      const v = validate();
      if (!v.ok) { npCreate.disabled = true; setErr(v.msg); }
      else { npCreate.disabled = false; setInfo("OK para criar."); }
    }

    [
      npFullName, npDob, npPhone, npEmail, npSNS, npNIF, npPassport,
      npInsuranceProvider, npInsurancePolicy, npAddress1, npPostal, npCity, npCountry, npNotes
    ].forEach((el) => {
      if (!el) return;
      el.addEventListener("input", refreshButtonState);
      el.addEventListener("change", refreshButtonState);
    });

    if (npCreate) {
      npCreate.addEventListener("click", async () => {
        const v = validate();
        if (!v.ok) { setErr(v.msg); return; }

        npCreate.disabled = true;
        setInfo("A criar…");

        try {
          const payload = {
            p_clinic_id: clinicId,
            p_full_name: v.full_name,
            p_dob: v.dob,
            p_sex: null,
            p_phone: v.phone,
            p_email: v.email,
            p_external_id: null,
            p_notes: v.notes,
            p_sns: v.sns,
            p_nif: v.nif,
            p_passport_id: v.passport_id,
            p_address_line1: v.address_line1,
            p_postal_code: v.postal_code,
            p_city: v.city,
            p_country: v.country,
            p_insurance_provider: v.insurance_provider,
            p_insurance_policy_number: v.insurance_policy_number,
          };

          const newPatientId = await rpcCreatePatientForClinic(payload);
          if (!newPatientId) {
            setErr("Criado, mas não consegui obter o ID. Pesquisa pelo nome e seleciona.");
            npCreate.disabled = false;
            return;
          }

          // Seleciona automaticamente o novo doente (na UI principal)
          const minimal = {
            id: newPatientId,
            full_name: v.full_name,
            phone: v.phone,
            email: v.email,
            sns: v.sns,
            nif: v.nif,
            passport_id: v.passport_id,
          };
          G.patientQuick.selected = minimal;

          // limpa pesquisa e esconde resultados
          const q = document.getElementById("pQuickQuery");
          if (q) q.value = "";
          const rHost = document.getElementById("pQuickResults");
          if (rHost) { rHost.innerHTML = ""; rHost.style.display = "none"; }

          close();
        } catch (e) {
          console.error("Criar doente (main) falhou:", e);
          const msg = String(e && (e.message || e.details || e.hint) ? (e.message || e.details || e.hint) : e);

          if (msg.includes("patients_sns_unique_not_null")) setErr("SNS já existe noutro doente.");
          else if (msg.includes("patients_nif_unique_not_null")) setErr("NIF já existe noutro doente.");
          else if (msg.includes("patients_passport_unique_not_null")) setErr("Passaporte/ID já existe noutro doente.");
          else if (msg.includes("patients_sns_format_check")) setErr("SNS inválido (9 dígitos).");
          else if (msg.includes("patients_nif_format_check")) setErr("NIF inválido (9 dígitos).");
          else if (msg.includes("patients_passport_format_check")) setErr("Passaporte/ID inválido (4–20 alfanum).");
          else if (msg.includes("patients_sns_or_nif_or_passport_check")) setErr("Identificação obrigatória: SNS/NIF/Passaporte.");
          else setErr("Erro ao criar doente. Vê a consola.");

          npCreate.disabled = false;
        }
      });
    }

    npCreate.disabled = true;
    setInfo("Preenche o Nome e um identificador (SNS/NIF/Passaporte).");
    refreshButtonState();
  }

/* ==== FIM BLOCO 07/12 — Novo doente (modal página inicial) ==== */
/* ==== INÍCIO BLOCO 08/12 — Pesquisa rápida (wiring) + Calendário mensal overlay ==== */

  // ---------- Pesquisa rápida: wiring ----------
  async function wireQuickPatientSearch() {
    const input = document.getElementById("pQuickQuery");
    const resHost = document.getElementById("pQuickResults");
    if (!input || !resHost) return;

    // estado inicial: sem resultados visíveis
    resHost.innerHTML = "";
    resHost.style.display = "none";

    let timer = null;

    async function run() {
      const term = (input.value || "").trim();

      // < 2 chars: não mostrar nada (sem mensagens auxiliares)
      if (!term || term.length < 2) {
        resHost.innerHTML = "";
        resHost.style.display = "none";
        return;
      }

      const selClinic = document.getElementById("selClinic");
      const clinicId = selClinic && selClinic.value ? selClinic.value : null;

      resHost.style.display = "block";
      resHost.innerHTML = `<div style="font-size:${UI.fs12}px; color:#666;">A pesquisar…</div>`;

      try {
        const pts = await searchPatientsScoped({ clinicId, q: term, limit: 30 });
        G.patientQuick.lastResults = pts;

        // render do teu helper existente (cada item deve ser clicável)
        renderQuickPatientResults(pts);

        // se não há resultados, mostra apenas "Sem resultados."
        if (!pts || pts.length === 0) {
          resHost.style.display = "block";
          resHost.innerHTML = `<div style="font-size:${UI.fs12}px; color:#666;">Sem resultados.</div>`;
        }
      } catch (e) {
        console.error("Pesquisa rápida de doente falhou:", e);
        resHost.style.display = "block";
        resHost.innerHTML = `<div style="font-size:${UI.fs12}px; color:#b00020;">Erro na pesquisa. Vê a consola.</div>`;
      }
    }

    function schedule() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(run, 250);
    }

    input.addEventListener("input", schedule);
  }

  // ---------- Calendário mensal overlay ----------
  function monthLabel(d) {
    const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  function buildMonthGrid(monthDate) {
    const y = monthDate.getFullYear();
    const m = monthDate.getMonth();

    const first = new Date(y, m, 1, 0, 0, 0, 0);
    const last = new Date(y, m + 1, 0, 0, 0, 0, 0);
    const daysInMonth = last.getDate();

    const jsDowFirst = first.getDay();
    const dowFirstMon0 = (jsDowFirst + 6) % 7;

    const cells = [];
    for (let i = 0; i < dowFirstMon0; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, m, d, 0, 0, 0, 0));
    while (cells.length % 7 !== 0) cells.push(null);
    while (cells.length < 42) cells.push(null);

    return cells;
  }

  function openCalendarOverlay() {
    const root = document.getElementById("modalRoot");
    if (!root) return;

    const todayISO = fmtDateISO(new Date());
    const selectedISO = G.selectedDayISO;

    if (!G.calMonth) {
      const selD = parseISODateToLocalStart(selectedISO) || new Date();
      G.calMonth = new Date(selD.getFullYear(), selD.getMonth(), 1, 0, 0, 0, 0);
    }

    const cells = buildMonthGrid(G.calMonth);
    const weekDays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

    root.innerHTML = `
      <div id="calOverlay" style="position:fixed; inset:0; background:rgba(0,0,0,0.35); display:flex; align-items:center; justify-content:center; padding:18px;">
        <div style="background:#fff; width:min(520px, 100%); border-radius:14px; border:1px solid #e5e5e5; padding:14px;">
          <div style="display:flex; justify-content:space-between; gap:10px; align-items:center;">
            <button id="calPrev" class="gcBtn">◀</button>
            <div style="font-size:${UI.fs14}px; font-weight:800; color:#111;" id="calTitle">${escapeHtml(monthLabel(G.calMonth))}</div>
            <button id="calNext" class="gcBtn">▶</button>
          </div>

          <div style="margin-top:10px; display:grid; grid-template-columns: repeat(7, 1fr); gap:6px;">
            ${weekDays.map((w) => `<div style="font-size:${UI.fs12}px; color:#666; text-align:center; padding:6px 0;">${w}</div>`).join("")}
            ${cells
              .map((d) => {
                if (!d) return `<div></div>`;
                const iso = fmtDateISO(d);
                const isToday = iso === todayISO;
                const isSelected = iso === selectedISO;

                const base = "padding:10px 0; border-radius:10px; border:1px solid #eee; text-align:center; cursor:pointer; user-select:none;";
                const bg = isSelected
                  ? "background:#111; color:#fff; border-color:#111;"
                  : isToday
                    ? "background:#f2f2f2; color:#111;"
                    : "background:#fff; color:#111;";
                return `<div data-iso="${iso}" style="${base}${bg} font-size:${UI.fs13}px;">${d.getDate()}</div>`;
              })
              .join("")}
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
    const calPrev = document.getElementById("calPrev");
    const calNext = document.getElementById("calNext");

    function close() {
      root.innerHTML = "";
    }

    if (calClose) calClose.addEventListener("click", close);
    if (overlay) overlay.addEventListener("click", (ev) => { if (ev.target && ev.target.id === "calOverlay") close(); });

    if (calPrev) calPrev.addEventListener("click", () => {
      G.calMonth = new Date(G.calMonth.getFullYear(), G.calMonth.getMonth() - 1, 1, 0, 0, 0, 0);
      openCalendarOverlay();
    });

    if (calNext) calNext.addEventListener("click", () => {
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

/* ==== FIM BLOCO 08/12 — Pesquisa rápida (wiring) + Calendário mensal overlay ==== */
/* ==== INÍCIO BLOCO 09/12 — Modal marcação (helpers + UI + pesquisa + novo doente interno + save) ==== */

  // ---------- Modal marcação ----------
  function closeModal() {
    closeModalRoot();
  }

  function calcEndFromStartAndDuration(startLocalStr, durMin) {
    const s = fromLocalInputValue(startLocalStr);
    if (!s || isNaN(s.getTime())) return null;
    const e = new Date(s.getTime() + durMin * 60000);
    return { startAt: s.toISOString(), endAt: e.toISOString() };
  }

  function makeAutoTitle(patientName, procType) {
    const n = (patientName || "").trim();
    const p = (procType || "").trim();
    if (!n) return null;
    if (!p || p === "—") return n;
    return `${n} — ${p}`;
  }

  function openApptModal({ mode, row }) {
    const root = document.getElementById("modalRoot");
    if (!root) return;

    const isEdit = mode === "edit";

    const selClinic = document.getElementById("selClinic");
    const defaultClinicId =
      isEdit && row && row.clinic_id
        ? row.clinic_id
        : selClinic && selClinic.value
          ? selClinic.value
          : G.clinics.length === 1
            ? G.clinics[0].id
            : "";

    const selectedDayStart = parseISODateToLocalStart(G.selectedDayISO) || new Date();
    const startBase = new Date(selectedDayStart.getFullYear(), selectedDayStart.getMonth(), selectedDayStart.getDate(), 9, 0, 0, 0);

    const startInit = isEdit && row && row.start_at ? new Date(row.start_at) : startBase;
    const endInit = isEdit && row && row.end_at ? new Date(row.end_at) : new Date(startInit.getTime() + 20 * 60000);
    const durInit = Math.max(5, Math.round((endInit.getTime() - startInit.getTime()) / 60000));
    const durationBest = DURATION_OPTIONS.includes(durInit) ? durInit : 20;

    const procInit = isEdit ? (row.procedure_type ?? "") : "";

    // ---- Status UI (apenas 1 "Faltou/Cancelada")
    const STATUS_UI = [
      { value: "scheduled", label: "Marcada" },
      { value: "arrived", label: "Chegou" },
      { value: "done", label: "Realizada" },
      { value: "no_show", label: "Faltou/Cancelada" },
    ];
    const statusRaw = isEdit ? (row.status ?? "scheduled") : "scheduled";
    const statusInit =
      statusRaw === "cancelled" ? "no_show"
      : STATUS_UI.some((s) => s.value === statusRaw) ? statusRaw
      : "scheduled";

    const patientIdInit = isEdit ? (row.patient_id ?? "") : "";
    const titleInit = isEdit ? (row.title ?? "") : "";
    const notesInit = isEdit ? (row.notes ?? "") : "";

    const procIsOther = procInit && !PROCEDURE_OPTIONS.includes(procInit) ? true : procInit === "Outro";
    const procSelectValue = procIsOther ? "Outro" : (procInit || "");

    root.innerHTML = `
      <div id="modalOverlay" style="position:fixed; inset:0; background:rgba(0,0,0,0.35); display:flex; align-items:center; justify-content:center; padding:18px;">
        <div style="background:#fff; width:min(920px, 100%); border-radius:14px; border:1px solid #e5e5e5; padding:14px; max-height: 86vh; overflow:auto;">
          <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start;">
            <div>
              <div style="font-size:${UI.fs14}px; font-weight:900; color:#111;">
                ${isEdit ? "Editar consulta agendada" : "Agendar consulta"}
              </div>
              <div style="font-size:${UI.fs12}px; color:#666; margin-top:4px;">
                Dia selecionado: ${escapeHtml(G.selectedDayISO)}. Doente e Tipo são obrigatórios.
              </div>
            </div>
            <button id="btnCloseModal" class="gcBtn">Fechar</button>
          </div>

          <!-- Linha 0: Pesquisa do doente (igual ao dashboard: 1 input + lista; sem "Selecionado") -->
          <div style="margin-top:12px; display:flex; flex-direction:column; gap:6px;">
            <label style="font-size:${UI.fs12}px; color:#666;">Doente (obrigatório)</label>

            <div style="display:grid; grid-template-columns: 1fr auto; gap:10px; align-items:center;">
              <input id="mPatientQuery"
                type="search"
                placeholder="ex.: Man… | 916… | 123456789"
                autocomplete="off"
                autocorrect="off"
                autocapitalize="off"
                spellcheck="false"
                inputmode="search"
                data-form-type="other"
                style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; width:100%; font-size:${UI.fs13}px;" />

              <button id="btnNewPatient" class="gcBtn" style="white-space:nowrap;">
                ＋ 👤 Novo doente
              </button>
            </div>

            <div id="mPatientResults"
                 style="display:none; margin-top:8px; border:1px solid #eee; border-radius:10px; padding:8px; background:#fff; max-height:220px; overflow:auto;">
            </div>

            <input type="hidden" id="mPatientId" value="" />
            <input type="hidden" id="mPatientName" value="" />

            <div id="newPatientHost" style="margin-top:8px;"></div>
          </div>

          <!-- Linha 1: Clínica | Tipo | Estado -->
          <div style="margin-top:12px; display:grid; grid-template-columns: 1fr 1fr 1fr; gap:12px;">
            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:${UI.fs12}px; color:#666;">Clínica</label>
              <select id="mClinic" class="gcSelect"></select>
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:${UI.fs12}px; color:#666;">Tipo (obrigatório)</label>
              <select id="mProc" class="gcSelect">
                <option value="">—</option>
                ${PROCEDURE_OPTIONS.map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("")}
              </select>
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:${UI.fs12}px; color:#666;">Estado</label>
              <select id="mStatus" class="gcSelect">
                ${STATUS_UI.map((s) => `<option value="${escapeHtml(s.value)}">${escapeHtml(s.label)}</option>`).join("")}
              </select>
            </div>

            <div id="mProcOtherWrap" style="display:none; flex-direction:column; gap:4px; grid-column: 1 / -1;">
              <label style="font-size:${UI.fs12}px; color:#666;">Outro (texto) *</label>
              <input id="mProcOther" type="text" placeholder="ex.: Ondas de choque" autocomplete="off" autocapitalize="off" spellcheck="false"
                style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
            </div>
          </div>

          <!-- Linha 2: Início | Duração -->
          <div style="margin-top:12px; display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:${UI.fs12}px; color:#666;">Início</label>
              <input id="mStart" type="datetime-local" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:${UI.fs12}px; color:#666;">Duração (min)</label>
              <select id="mDuration" class="gcSelect">
                ${DURATION_OPTIONS.map((n) => `<option value="${n}">${n}</option>`).join("")}
              </select>
            </div>
          </div>

          <!-- Linha 3: Notas -->
          <div style="margin-top:12px; display:flex; flex-direction:column; gap:4px;">
            <label style="font-size:${UI.fs12}px; color:#666;">Notas</label>
            <textarea id="mNotes" rows="3" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; resize:vertical; font-size:${UI.fs13}px;"></textarea>
          </div>

          <div style="margin-top:12px; display:flex; justify-content:space-between; gap:12px; align-items:center; flex-wrap:wrap;">
            <div id="mMsg" style="font-size:${UI.fs12}px; color:#666;"></div>
            <div style="display:flex; gap:10px;">
              <button id="btnCancel" class="gcBtn">Cancelar</button>
              <button id="btnSave" class="gcBtn" style="font-weight:900;">
                ${isEdit ? "Guardar" : "Agendar"}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    const overlay = document.getElementById("modalOverlay");
    const btnClose = document.getElementById("btnCloseModal");
    const btnCancel = document.getElementById("btnCancel");
    const btnSave = document.getElementById("btnSave");
    const btnNewPatient = document.getElementById("btnNewPatient");

    const mClinic = document.getElementById("mClinic");
    const mStatus = document.getElementById("mStatus");
    const mStart = document.getElementById("mStart");
    const mDuration = document.getElementById("mDuration");
    const mProc = document.getElementById("mProc");
    const mProcOtherWrap = document.getElementById("mProcOtherWrap");
    const mProcOther = document.getElementById("mProcOther");
    const mNotes = document.getElementById("mNotes");
    const mMsg = document.getElementById("mMsg");

    const mPatientQuery = document.getElementById("mPatientQuery");
    const mPatientResults = document.getElementById("mPatientResults");
    const mPatientId = document.getElementById("mPatientId");
    const mPatientName = document.getElementById("mPatientName");

    // --- helpers de cleanup (evita redefinir closeModal / leaks) ---
    let _cleanupFns = [];
    function addCleanup(fn) { if (typeof fn === "function") _cleanupFns.push(fn); }
    function runCleanup() {
      const fns = _cleanupFns;
      _cleanupFns = [];
      fns.forEach((fn) => { try { fn(); } catch (_) {} });
    }

    function safeCloseModal() {
      runCleanup();
      closeModal();
    }

    const clinicOpts = [];
    for (const c of G.clinics) {
      const label = c.name || c.slug || c.id;
      clinicOpts.push(`<option value="${escapeHtml(c.id)}">${escapeHtml(label)}</option>`);
    }
    if (mClinic) {
      mClinic.innerHTML = clinicOpts.join("");
      if (defaultClinicId) mClinic.value = defaultClinicId;
      if (G.clinics.length === 1) mClinic.disabled = true;
    }

    if (mStatus) mStatus.value = statusInit;
    if (mStart) mStart.value = toLocalInputValue(startInit);
    if (mDuration) mDuration.value = String(durationBest);
    if (mProc) mProc.value = procSelectValue;
    if (mNotes) mNotes.value = notesInit;

    function setSelectedPatient({ id, name }) {
      if (mPatientId) mPatientId.value = id || "";
      if (mPatientName) mPatientName.value = name || "";
    }

    function closeResults() {
      if (!mPatientResults) return;
      mPatientResults.style.display = "none";
      mPatientResults.innerHTML = "";
    }

    function showResultsLoading() {
      if (!mPatientResults) return;
      mPatientResults.style.display = "block";
      mPatientResults.innerHTML = `<div style="font-size:${UI.fs12}px; color:#666;">A pesquisar…</div>`;
    }

    function showResultsEmpty() {
      if (!mPatientResults) return;
      mPatientResults.style.display = "block";
      mPatientResults.innerHTML = `<div style="font-size:${UI.fs12}px; color:#666;">Sem resultados.</div>`;
    }

    function showResultsError() {
      if (!mPatientResults) return;
      mPatientResults.style.display = "block";
      mPatientResults.innerHTML = `<div style="font-size:${UI.fs12}px; color:#b00020;">Erro na pesquisa. Vê a consola.</div>`;
    }

    // Render de resultados alinhado com o padrão do dashboard (cards clicáveis + 2.ª linha ids/tel)
    function showResultsList(pts) {
      if (!mPatientResults) return;

      mPatientResults.style.display = "block";
      mPatientResults.innerHTML = (pts || []).map((p) => {
        const idBits = [];
        if (p.sns) idBits.push(`SNS:${p.sns}`);
        if (p.nif) idBits.push(`NIF:${p.nif}`);
        if (p.passport_id) idBits.push(`ID:${p.passport_id}`);
        const phone = p.phone ? `Tel:${p.phone}` : "";
        const line2 = [idBits.join(" / "), phone].filter(Boolean).join(" • ");

        return `
          <div data-pid="${escapeHtml(p.id)}" data-pname="${escapeHtml(p.full_name)}"
               style="padding:8px; border:1px solid #f0f0f0; border-radius:10px; margin-bottom:8px; cursor:pointer;">
            <div style="font-size:${UI.fs13}px; color:#111; font-weight:800; white-space:normal; overflow-wrap:anywhere; word-break:break-word;">
              ${escapeHtml(p.full_name)}
            </div>
            <div style="font-size:${UI.fs12}px; color:#666;">${escapeHtml(line2 || "—")}</div>
          </div>
        `;
      }).join("");

      mPatientResults.querySelectorAll("[data-pid]").forEach((el) => {
        el.addEventListener("click", () => {
          const pid = el.getAttribute("data-pid") || "";
          const pname = el.getAttribute("data-pname") || "";

          setSelectedPatient({ id: pid, name: pname });
          if (mPatientQuery) mPatientQuery.value = pname; // igual ao dashboard: fica preenchido com o nome
          closeResults();
        });
      });
    }

    // Pré-preencher seleção em edição
    if (patientIdInit) {
      const displayName = titleInit ? String(titleInit).split(" — ")[0] : "";
      setSelectedPatient({ id: patientIdInit, name: displayName || `ID: ${patientIdInit}` });
      if (mPatientQuery) mPatientQuery.value = displayName || ""; // em edição, mostra o nome se existir
    } else {
      setSelectedPatient({ id: "", name: "" });
    }

    // Proc (obrigatório)
    function updateProcOtherVisibility() {
      const v = mProc ? mProc.value : "";
      const show = v === "Outro";
      if (mProcOtherWrap) mProcOtherWrap.style.display = show ? "flex" : "none";
      if (!show && mProcOther) mProcOther.value = "";
    }

    updateProcOtherVisibility();
    if (procIsOther && mProcOther) {
      mProcOther.value = procInit === "Outro" ? "" : procInit;
      if (mProcOtherWrap) mProcOtherWrap.style.display = "flex";
    }

    function getProcedureValueStrict() {
      const sel = mProc && mProc.value ? mProc.value : "";
      if (!sel) return ""; // obrigatório
      if (sel !== "Outro") return sel;

      const other = mProcOther && mProcOther.value ? mProcOther.value.trim() : "";
      if (!other) return ""; // Outro exige texto
      return other;
    }

    // Pesquisa (padrão dashboard: só aparece quando term>=2; fecha ao selecionar; fecha ao limpar)
    let searchTimer = null;

    async function runSearch() {
      const clinicId = mClinic ? (mClinic.value || "") : "";
      const term = (mPatientQuery ? (mPatientQuery.value || "").trim() : "");

      if (!term || term.length < 2) {
        closeResults();
        return;
      }

      if (!clinicId) {
        closeResults();
        return;
      }

      showResultsLoading();

      try {
        const pts = await searchPatientsScoped({ clinicId, q: term, limit: 30 });
        if (!pts || pts.length === 0) {
          showResultsEmpty();
          return;
        }
        showResultsList(pts);
      } catch (e) {
        console.error("Pesquisa doente (modal) falhou:", e);
        showResultsError();
      }
    }

    function scheduleSearch() {
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(runSearch, 250);
    }

    // Fechar resultados ao clicar fora
    function onDocMouseDown(ev) {
      const t = ev.target;

      const inInput =
        mPatientQuery &&
        (t === mPatientQuery || (t && t.closest && t.closest("#mPatientQuery")));

      const inResults =
        mPatientResults &&
        (t === mPatientResults || (t && t.closest && t.closest("#mPatientResults")));

      if (!inInput && !inResults) closeResults();
    }

    document.addEventListener("mousedown", onDocMouseDown);
    addCleanup(() => document.removeEventListener("mousedown", onDocMouseDown));

    function openNewPatientForm() {
      const clinicId = mClinic ? mClinic.value : "";
      if (!clinicId) {
        mMsg.style.color = "#b00020";
        mMsg.textContent = "Seleciona a clínica antes de criar doente.";
        return;
      }

      const host = document.getElementById("newPatientHost");
      if (!host) {
        mMsg.style.color = "#b00020";
        mMsg.textContent = "Falha UI: newPatientHost não encontrado.";
        return;
      }

      host.innerHTML = `
        <div id="subNewPatient" style="border:1px solid #eee; border-radius:12px; padding:12px; background:#fafafa;">
          <div style="font-size:${UI.fs13}px; font-weight:900; color:#111;">Novo doente</div>
          <div style="font-size:${UI.fs12}px; color:#666; margin-top:4px;">
            Nome obrigatório. Identificação: SNS (9 dígitos) ou NIF (9 dígitos) ou Passaporte/ID (4–20 alfanum).
          </div>

          <div style="margin-top:10px; display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:${UI.fs12}px; color:#666;">Nome completo *</label>
              <input id="npFullName" type="text" autocomplete="off" autocapitalize="off" spellcheck="false"
                style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:${UI.fs12}px; color:#666;">Data nascimento</label>
              <input id="npDob" type="date" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:${UI.fs12}px; color:#666;">Telefone</label>
              <input id="npPhone" type="text" autocomplete="off" autocapitalize="off" spellcheck="false"
                style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:${UI.fs12}px; color:#666;">Email</label>
              <input id="npEmail" type="email" autocomplete="off" autocapitalize="off" spellcheck="false"
                style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:${UI.fs12}px; color:#666;">SNS (9 dígitos)</label>
              <input id="npSNS" type="text" inputmode="numeric" placeholder="#########" autocomplete="off"
                style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:${UI.fs12}px; color:#666;">NIF (9 dígitos)</label>
              <input id="npNIF" type="text" inputmode="numeric" placeholder="#########" autocomplete="off"
                style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:${UI.fs12}px; color:#666;">Passaporte/ID (4–20)</label>
              <input id="npPassport" type="text" placeholder="AB123456" autocomplete="off" autocapitalize="off" spellcheck="false"
                style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:${UI.fs12}px; color:#666;">Seguro</label>
              <input id="npInsuranceProvider" type="text" autocomplete="off" autocapitalize="off" spellcheck="false"
                style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:${UI.fs12}px; color:#666;">Apólice</label>
              <input id="npInsurancePolicy" type="text" autocomplete="off" autocapitalize="off" spellcheck="false"
                style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
            </div>

            <div style="grid-column: 1 / -1; display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:${UI.fs12}px; color:#666;">Morada</label>
              <input id="npAddress1" type="text" autocomplete="off" autocapitalize="off" spellcheck="false"
                style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:${UI.fs12}px; color:#666;">Código-postal</label>
              <input id="npPostal" type="text" autocomplete="off" autocapitalize="off" spellcheck="false"
                style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:${UI.fs12}px; color:#666;">Cidade</label>
              <input id="npCity" type="text" autocomplete="off" autocapitalize="off" spellcheck="false"
                style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:${UI.fs12}px; color:#666;">País</label>
              <input id="npCountry" type="text" value="PT" autocomplete="off" autocapitalize="off" spellcheck="false"
                style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
            </div>

            <div style="grid-column: 1 / -1; display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:${UI.fs12}px; color:#666;">Notas</label>
              <textarea id="npNotes" rows="2" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; resize:vertical; font-size:${UI.fs13}px;"></textarea>
            </div>
          </div>

          <div style="margin-top:10px; display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
            <div id="npMsg" style="font-size:${UI.fs12}px; color:#666;"></div>
            <div style="display:flex; gap:10px;">
              <button id="npCancel" class="gcBtn">Fechar</button>
              <button id="npCreate" class="gcBtn" style="font-weight:900;">Criar doente</button>
            </div>
          </div>
        </div>
      `;

      const npFullName = document.getElementById("npFullName");
      const npDob = document.getElementById("npDob");
      const npPhone = document.getElementById("npPhone");
      const npEmail = document.getElementById("npEmail");
      const npSNS = document.getElementById("npSNS");
      const npNIF = document.getElementById("npNIF");
      const npPassport = document.getElementById("npPassport");
      const npInsuranceProvider = document.getElementById("npInsuranceProvider");
      const npInsurancePolicy = document.getElementById("npInsurancePolicy");
      const npAddress1 = document.getElementById("npAddress1");
      const npPostal = document.getElementById("npPostal");
      const npCity = document.getElementById("npCity");
      const npCountry = document.getElementById("npCountry");
      const npNotes = document.getElementById("npNotes");
      const npMsg = document.getElementById("npMsg");
      const npCancel = document.getElementById("npCancel");
      const npCreate = document.getElementById("npCreate");

      function setErr(msg) { npMsg.style.color = "#b00020"; npMsg.textContent = msg; }
      function setInfo(msg) { npMsg.style.color = "#666"; npMsg.textContent = msg; }

      function validate() {
        const fullName = (npFullName.value || "").trim();
        if (!fullName) return { ok: false, msg: "Nome completo é obrigatório." };

        const sns = normalizeDigits(npSNS.value);
        const nif = normalizeDigits(npNIF.value);
        const pass = (npPassport.value || "").trim();

        if (sns && !/^[0-9]{9}$/.test(sns)) return { ok: false, msg: "SNS inválido: tem de ter 9 dígitos." };
        if (nif && !/^[0-9]{9}$/.test(nif)) return { ok: false, msg: "NIF inválido: tem de ter 9 dígitos." };
        if (pass && !/^[A-Za-z0-9]{4,20}$/.test(pass)) return { ok: false, msg: "Passaporte/ID inválido: 4–20 alfanum." };

        if (!sns && !nif && !pass) return { ok: false, msg: "Identificação obrigatória: SNS ou NIF ou Passaporte/ID." };

        return {
          ok: true,
          full_name: fullName,
          dob: npDob.value ? npDob.value : null,
          phone: npPhone.value ? npPhone.value.trim() : null,
          email: npEmail.value ? npEmail.value.trim() : null,
          sns: sns || null,
          nif: nif || null,
          passport_id: pass || null,
          insurance_provider: npInsuranceProvider.value ? npInsuranceProvider.value.trim() : null,
          insurance_policy_number: npInsurancePolicy.value ? npInsurancePolicy.value.trim() : null,
          address_line1: npAddress1.value ? npAddress1.value.trim() : null,
          postal_code: npPostal.value ? npPostal.value.trim() : null,
          city: npCity.value ? npCity.value.trim() : null,
          country: npCountry.value ? npCountry.value.trim() : "PT",
          notes: npNotes.value ? npNotes.value.trim() : null,
        };
      }

      function refreshButtonState() {
        if (npSNS) { const d = normalizeDigits(npSNS.value); if (npSNS.value !== d) npSNS.value = d; }
        if (npNIF) { const d = normalizeDigits(npNIF.value); if (npNIF.value !== d) npNIF.value = d; }

        const v = validate();
        if (!v.ok) { npCreate.disabled = true; setErr(v.msg); }
        else { npCreate.disabled = false; setInfo("OK para criar."); }
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
          const payload = {
            p_clinic_id: clinicId,
            p_full_name: v.full_name,
            p_dob: v.dob,
            p_sex: null,
            p_phone: v.phone,
            p_email: v.email,
            p_external_id: null,
            p_notes: v.notes,
            p_sns: v.sns,
            p_nif: v.nif,
            p_passport_id: v.passport_id,
            p_address_line1: v.address_line1,
            p_postal_code: v.postal_code,
            p_city: v.city,
            p_country: v.country,
            p_insurance_provider: v.insurance_provider,
            p_insurance_policy_number: v.insurance_policy_number,
          };

          const newPatientId = await rpcCreatePatientForClinic(payload);

          if (!newPatientId) {
            setErr("Criado, mas não consegui obter o ID. Pesquisa pelo nome e seleciona.");
            npCreate.disabled = false;
            return;
          }

          setSelectedPatient({ id: newPatientId, name: v.full_name });
          if (mPatientQuery) mPatientQuery.value = v.full_name;
          closeResults();
          host.innerHTML = "";
        } catch (e) {
          console.error("Criar doente falhou:", e);
          const msg = String(e && (e.message || e.details || e.hint) ? (e.message || e.details || e.hint) : e);

          if (msg.includes("patients_sns_unique_not_null")) setErr("SNS já existe noutro doente.");
          else if (msg.includes("patients_nif_unique_not_null")) setErr("NIF já existe noutro doente.");
          else if (msg.includes("patients_passport_unique_not_null")) setErr("Passaporte/ID já existe noutro doente.");
          else if (msg.includes("patients_sns_format_check")) setErr("SNS inválido (9 dígitos).");
          else if (msg.includes("patients_nif_format_check")) setErr("NIF inválido (9 dígitos).");
          else if (msg.includes("patients_passport_format_check")) setErr("Passaporte/ID inválido (4–20 alfanum).");
          else if (msg.includes("patients_sns_or_nif_or_passport_check")) setErr("Identificação obrigatória: SNS/NIF/Passaporte.");
          else setErr("Erro ao criar doente. Vê a consola.");

          npCreate.disabled = false;
        }
      });

      npCreate.disabled = true;
      setInfo("Preenche o Nome e um identificador (SNS/NIF/Passaporte).");
      refreshButtonState();
    }

    async function onSave() {
      // Clínica obrigatória
      if (!mClinic || !mClinic.value) {
        mMsg.style.color = "#b00020";
        mMsg.textContent = "Seleciona a clínica.";
        return;
      }

      // Início obrigatório
      if (!mStart || !mStart.value) {
        mMsg.style.color = "#b00020";
        mMsg.textContent = "Define o início.";
        return;
      }

      // Doente obrigatório (seleção real via hidden)
      const pid = mPatientId ? (mPatientId.value || "") : "";
      const pname = mPatientName ? (mPatientName.value || "") : "";
      if (!pid) {
        mMsg.style.color = "#b00020";
        mMsg.textContent = "Seleciona um doente.";
        return;
      }

      // ✅ Tipo obrigatório (e “Outro” exige texto)
      const proc = getProcedureValueStrict();
      if (!proc) {
        mMsg.style.color = "#b00020";
        mMsg.textContent = "Seleciona o Tipo de consulta (e se for 'Outro', preenche o texto).";
        return;
      }

      const dur = mDuration ? parseInt(mDuration.value, 10) : 20;
      const times = calcEndFromStartAndDuration(mStart.value, dur);
      if (!times) {
        mMsg.style.color = "#b00020";
        mMsg.textContent = "Data/hora inválida.";
        return;
      }

      const autoTitle = makeAutoTitle(pname, proc);

      // UI só tem no_show (mapeamento já feito)
      const statusToSave = (mStatus && mStatus.value) ? mStatus.value : "scheduled";

      const payload = {
        clinic_id: mClinic.value,
        patient_id: pid,
        start_at: times.startAt,
        end_at: times.endAt,
        status: statusToSave,
        procedure_type: proc,
        title: autoTitle,
        notes: mNotes && mNotes.value ? mNotes.value.trim() : null,
      };
      if (payload.notes === "") payload.notes = null;

      btnSave.disabled = true;
      mMsg.style.color = "#666";
      mMsg.textContent = "A guardar…";

      try {
        if (isEdit) {
          const { error } = await window.sb.from("appointments").update(payload).eq("id", row.id);
          if (error) throw error;
        } else {
          const { error } = await window.sb.from("appointments").insert(payload);
          if (error) throw error;
        }

        safeCloseModal();
        await refreshAgenda();
      } catch (e) {
        console.error("Guardar marcação falhou:", e);
        mMsg.style.color = "#b00020";
        mMsg.textContent = "Erro ao guardar. Vê a consola.";
        btnSave.disabled = false;
      }
    }

    if (btnClose) btnClose.addEventListener("click", safeCloseModal);
    if (btnCancel) btnCancel.addEventListener("click", safeCloseModal);
    if (overlay) overlay.addEventListener("click", (ev) => { if (ev.target && ev.target.id === "modalOverlay") safeCloseModal(); });

    if (mProc) mProc.addEventListener("change", updateProcOtherVisibility);

    // Se mudar clínica: limpa seleção e fecha resultados + sub-form
    if (mClinic) {
      mClinic.addEventListener("change", () => {
        setSelectedPatient({ id: "", name: "" });
        if (mPatientQuery) mPatientQuery.value = "";
        closeResults();
        const host = document.getElementById("newPatientHost");
        if (host) host.innerHTML = "";
      });
    }

    if (mPatientQuery) {
      mPatientQuery.addEventListener("input", () => {
        // ao escrever, invalida seleção anterior (para não gravar com doente antigo)
        setSelectedPatient({ id: "", name: "" });
        scheduleSearch();
      });
      mPatientQuery.addEventListener("focus", scheduleSearch);
    }

    if (btnNewPatient) btnNewPatient.addEventListener("click", openNewPatientForm);
    if (btnSave) btnSave.addEventListener("click", onSave);
  }

/* ==== FIM BLOCO 09/12 — Modal marcação (helpers + UI + pesquisa + novo doente interno + save) ==== */
/* ==== INÍCIO BLOCO 10/12 — Logout + Refresh agenda ==== */

  // ---------- Logout ----------
  async function wireLogout() {
    const btn = document.getElementById("btnLogout");
    if (!btn) return;

    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.textContent = "A terminar sessão…";
      try {
        const { error } = await window.sb.auth.signOut();
        if (error) throw error;
        hardRedirect("/index.html");
      } catch (e) {
        console.error("Logout falhou:", e);
        btn.disabled = false;
        btn.textContent = "Logout";
        alert("Não foi possível terminar a sessão. Vê a consola para detalhe.");
      }
    });
  }

  // ---------- Refresh agenda ----------
  async function refreshAgenda() {
    const sel = document.getElementById("selClinic");
    const clinicId = sel ? sel.value || null : null;

    const r = isoLocalDayRangeFromISODate(G.selectedDayISO);
    if (!r) {
      setAgendaStatus("error", "Dia inválido.");
      return;
    }

    setAgendaStatus("loading", "A carregar marcações…");

    try {
      const { data, timeColUsed } = await loadAppointmentsForRange({ clinicId, startISO: r.startISO, endISO: r.endISO });

      const patientIds = (data || []).map((x) => x && x.patient_id).filter(Boolean);
      try {
        G.patientsById = await fetchPatientsByIds(patientIds);
      } catch (e) {
        console.error("Falha ao carregar pacientes para agenda:", e);
        G.patientsById = {};
      }

      G.agenda.rows = data;
      G.agenda.timeColUsed = timeColUsed || "start_at";
      setAgendaStatus("ok", `OK: ${data.length} marcação(ões).`);
      renderAgendaList();
    } catch (e) {
      console.error("Agenda load falhou:", e);
      setAgendaStatus("error", "Erro ao carregar agenda. Vê a consola.");
      G.agenda.rows = [];
      G.patientsById = {};
      renderAgendaList();
    }
  }

/* ==== FIM BLOCO 10/12 — Logout + Refresh agenda ==== */

/* ==== INÍCIO BLOCO 11/12 — Boot (init da app + wiring de botões) ==== */

  // ---------- Boot ----------
  async function boot() {
    try {
      if (!window.sb || !window.sb.auth || typeof window.sb.auth.getSession !== "function") {
        console.error("Supabase client não encontrado (window.sb). Confirma app.html.");
        document.body.textContent = "Erro: Supabase client não encontrado (window.sb).";
        return;
      }

      const { data, error } = await window.sb.auth.getSession();
      if (error) throw error;

      const session = data ? data.session : null;
      if (!session || !session.user) {
        hardRedirect("/index.html");
        return;
      }

      G.sessionUser = session.user;

      renderAppShell();
      await wireLogout();

      try { G.role = await fetchMyRole(G.sessionUser.id); } catch { G.role = null; }
      try { G.clinics = await fetchVisibleClinics(); } catch { G.clinics = []; }

      G.clinicsById = {};
      for (const c of G.clinics) G.clinicsById[c.id] = c;

      const hdrEmail = document.getElementById("hdrEmail");
      if (hdrEmail) hdrEmail.textContent = G.sessionUser.email || "—";

      const hdrRole = document.getElementById("hdrRole");
      if (hdrRole) hdrRole.textContent = G.role ? G.role : "—";

      const hdrClinicCount = document.getElementById("hdrClinicCount");
      if (hdrClinicCount) hdrClinicCount.textContent = String(G.clinics.length);

      renderClinicsSelect(G.clinics);
      setAgendaSubtitleForSelectedDay();

      await wireQuickPatientSearch();

      const sel = document.getElementById("selClinic");
      if (sel) sel.addEventListener("change", refreshAgenda);

      const btnRefresh = document.getElementById("btnRefreshAgenda");
      if (btnRefresh) btnRefresh.addEventListener("click", refreshAgenda);

      const btnNew = document.getElementById("btnNewAppt");
      if (btnNew) btnNew.addEventListener("click", () => openApptModal({ mode: "new", row: null }));

      const btnNewPatientMain = document.getElementById("btnNewPatientMain");
      if (btnNewPatientMain) {
        btnNewPatientMain.addEventListener("click", () => {
          const s = document.getElementById("selClinic");
          const clinicId = s && s.value ? s.value : null;
          openNewPatientMainModal({ clinicId });
        });
      }

      const btnCal = document.getElementById("btnCal");
      if (btnCal) btnCal.addEventListener("click", openCalendarOverlay);

      const btnToday = document.getElementById("btnToday");
      if (btnToday) {
        btnToday.addEventListener("click", async () => {
          G.selectedDayISO = fmtDateISO(new Date());
          setAgendaSubtitleForSelectedDay();
          await refreshAgenda();
        });
      }

      if (btnNew && G.role && !["doctor", "secretary"].includes(String(G.role).toLowerCase())) {
        btnNew.disabled = true;
        btnNew.title = "Sem permissão para criar marcações.";
      }

      // Novo doente na página inicial: também só doctor/secretary (por defeito)
      if (btnNewPatientMain && G.role && !["doctor", "secretary"].includes(String(G.role).toLowerCase())) {
        btnNewPatientMain.disabled = true;
        btnNewPatientMain.title = "Sem permissão para criar doentes.";
      }

      await refreshAgenda();
    } catch (e) {
      console.error("Boot falhou:", e);
      document.body.textContent = "Erro ao iniciar a app. Abre a consola para detalhe.";
    }
  }

/* ==== FIM BLOCO 11/12 — Boot (init da app + wiring de botões) ==== */
/* ==== INÍCIO BLOCO 12/12 — DOMContentLoaded + fechamento IIFE ==== */

  document.addEventListener("DOMContentLoaded", boot);

})();  // Fim IIFE

/* ==== FIM BLOCO 12/12 — DOMContentLoaded + fechamento IIFE ==== */