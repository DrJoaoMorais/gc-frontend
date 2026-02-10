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

  /* ==== INÍCIO BLOCO 01/08 — Helpers + Formatação + Utilitários ==== */

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

  /* ==== FIM    BLOCO 01/08 — Helpers + Formatação + Utilitários ==== */

  /* ==== INÍCIO BLOCO 02/08 — Supabase: Role/Clínicas + Agenda (load) ==== */

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

  /* ==== FIM    BLOCO 02/08 — Supabase: Role/Clínicas + Agenda (load) ==== */

  /* ==== INÍCIO BLOCO 03/08 — Doentes: Pesquisa/CRUD/RPC ==== */

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

  /* ==== FIM    BLOCO 03/08 — Doentes: Pesquisa/CRUD/RPC ==== */

  /* ==== INÍCIO BLOCO 04/08 — Catálogos + Estado global (G) ==== */

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

  const STATUS_OPTIONS = ["scheduled", "confirmed", "arrived", "done", "cancelled", "no_show"];
  const DURATION_OPTIONS = [15, 20, 30, 45, 60];

  // ✅ Estado com cores (mantido como está, para não mexer no que está estável)
  function statusMeta(statusRaw) {
    const s = String(statusRaw || "scheduled").toLowerCase();
    const map = {
      scheduled: { icon: "👤", label: "Marcada", bg: "#eff6ff", fg: "#1d4ed8", br: "#bfdbfe" },
      confirmed: { icon: "👤", label: "Confirmada", bg: "#dbeafe", fg: "#1e40af", br: "#93c5fd" },
      arrived: { icon: "⏳", label: "Chegou (AVISAR)", bg: "#fffbeb", fg: "#92400e", br: "#fde68a" },
      done: { icon: "✅", label: "Realizada", bg: "#ecfdf5", fg: "#065f46", br: "#a7f3d0" },
      cancelled: { icon: "❌", label: "Cancelada", bg: "#fef2f2", fg: "#991b1b", br: "#fecaca" },
      no_show: { icon: "⚠️", label: "Faltou", bg: "#fef2f2", fg: "#991b1b", br: "#fecaca" },
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

  /* ==== FIM    BLOCO 04/08 — Catálogos + Estado global (G) ==== */
/* ==== INÍCIO BLOCO 05/08 — Render Shell + Agenda (UI) ==== */

  // ---------- Render shell ----------
  function renderAppShell() {
    document.body.innerHTML = `
      <style>
        .gcBtn { padding:10px 12px; border-radius:10px; border:1px solid #ddd; background:#fff; cursor:pointer; font-size:${UI.fs13}px; }
        .gcBtn:disabled { opacity:0.6; cursor:not-allowed; }

        /* Nova marcação: mais suave (menos “preto total”) */
        .gcBtnPrimary { padding:11px 14px; border-radius:12px; border:1px solid #334155; background:#334155; color:#fff; cursor:pointer; font-size:${UI.fs13}px; font-weight:900; }
        .gcBtnPrimary:disabled { opacity:0.6; cursor:not-allowed; }

        .gcSelect { padding:10px 12px; border-radius:10px; border:1px solid #ddd; background:#fff; font-size:${UI.fs13}px; }
        .gcLabel { font-size:${UI.fs12}px; color:#666; }
        .gcCard { padding:12px 14px; border:1px solid #eee; border-radius:12px; background:#fff; }
        .gcMutedCard { padding:10px 12px; border-radius:10px; border:1px solid #ddd; background:#fafafa; }
        .gcCardTight { padding:10px 12px; border:1px solid #eee; border-radius:12px; background:#fff; }

        /* ✅ Grelha da agenda: Telefone antes | Clínica no fim (à direita) */
        .gcGridRow {
          display:grid;
          grid-template-columns: 110px minmax(260px, 1.6fr) 240px 280px 160px 170px;
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

        /* Estado: o próprio select é o “modelo” */
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

        /* Toolbar compacta (topo) */
        .gcToolbar {
          display:flex;
          align-items:flex-end;
          gap:12px;
          flex-wrap:wrap;
          margin-top:12px;
          width:100%;
        }
        .gcToolbarLeft{
          display:flex;
          flex-direction:row;
          gap:10px;
          align-items:flex-end;
          flex-wrap:wrap;
          flex: 0 0 auto;
        }

        /* Zona "pesquisa/selecionado" — modo único */
        .gcPatientTop {
          position:relative;
          flex: 1 1 520px;
          min-width: 420px;
          max-width: 680px;
        }
        @media (max-width: 980px){
          .gcPatientTop { flex: 1 1 100%; min-width: 280px; max-width:none; }
        }

        /* ✅ Clínica no topo encostada à direita */
        .gcClinicTop {
          margin-left: auto;     /* <-- isto “empurra” para a direita */
          flex: 0 0 210px;
          width: 210px;
          max-width: 210px;
        }
        @media (max-width: 980px){
          .gcClinicTop { margin-left: 0; flex: 1 1 220px; width:auto; max-width:none; }
        }
        #selClinic {
          width: 210px;
          max-width: 210px;
        }
        @media (max-width: 980px){
          #selClinic { width: 100%; max-width:none; }
        }

        /* Search: dropdown flutuante (não ocupa espaço quando fechado) */
        .gcSearchBox { position:relative; }
        #pQuickQuery {
          padding:10px 12px;
          border-radius:10px;
          border:1px solid #ddd;
          width:100%;
          font-size:${UI.fs13}px;
        }
        #pQuickResults {
          display:none;
          position:absolute;
          left:0;
          right:0;
          top: calc(100% + 6px);
          z-index: 30;
          border:1px solid #eee;
          border-radius:10px;
          padding:8px;
          background:#fff;
          max-height:220px;
          overflow:auto;
          box-shadow: 0 10px 30px rgba(0,0,0,0.08);
        }
        .gcSearchBox:focus-within #pQuickResults { display:block; }

        /* Cartão selecionado (aparece só quando há doente) */
        #pQuickSelectedWrap { display:none; }
        #pQuickSelectedWrap.gcShow { display:block; }

        .gcSelectedCard {
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:12px;
          flex-wrap:wrap;
          border:1px solid #e5e5e5;
          border-radius:12px;
          padding:10px 12px;
          background:#fafafa;
        }
        #pQuickSelected{
          min-height: 0;
          border:0;
          background:transparent;
          padding:0;
          font-size:${UI.fs13}px;
          font-weight:900;
          color:#111;
        }
        .gcSelectedActions{
          display:flex;
          gap:10px;
          flex-wrap:wrap;
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

            <!-- Topo compacto: botões (esq) | pesquisa/selecionado (centro) | clínica (dir) -->
            <div class="gcToolbar">
              <div class="gcToolbarLeft">
                <button id="btnCal" class="gcBtn" title="Calendário">Calendário</button>
                <button id="btnToday" class="gcBtn" title="Voltar a hoje">Hoje</button>
                <button id="btnNewAppt" class="gcBtnPrimary">Nova marcação</button>
                <button id="btnNewPatientMain" class="gcBtn" title="Criar novo doente">＋ Novo doente</button>
                <button id="btnRefreshAgenda" class="gcBtn" title="Atualizar agenda">Atualizar</button>
              </div>

              <div class="gcPatientTop">
                <!-- MODO PESQUISA (único campo) -->
                <div id="pQuickSearchWrap" class="gcSearchBox">
                  <div class="gcLabel" style="margin-bottom:6px;">Pesquisar doente (Nome / SNS / NIF / Telefone / Passaporte-ID)</div>
                  <input id="pQuickQuery" type="text" placeholder="ex.: Man… | 916… | 123456789"
                    autocomplete="off" autocapitalize="off" spellcheck="false" />
                  <div id="pQuickResults">
                    <div style="font-size:${UI.fs12}px; color:#666;">Escreve para pesquisar.</div>
                  </div>
                </div>

                <!-- MODO SELECIONADO (cartão compacto) -->
                <div id="pQuickSelectedWrap" style="margin-top:8px;">
                  <div class="gcSelectedCard">
                    <div style="display:flex; flex-direction:column; gap:4px; min-width: 240px; flex: 1 1 360px;">
                      <div class="gcLabel">Doente selecionado</div>
                      <div id="pQuickSelected">—</div>
                      <div id="pQuickMsg" style="font-size:${UI.fs12}px; color:#666;"></div>
                    </div>

                    <div class="gcSelectedActions">
                      <button id="btnQuickOpen" class="gcBtn">Abrir feed</button>
                      <button id="btnQuickClear" class="gcBtn">Trocar doente</button>
                    </div>
                  </div>
                </div>
              </div>

              <div class="gcClinicTop">
                <label for="selClinic" class="gcLabel">Clínica</label>
                <select id="selClinic" class="gcSelect"></select>
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

    // --- Lógica mínima local do BLOCO 05/08 (sem mexer em boot) ---
    // Objetivo: “um campo único” até selecionar; depois mostra cartão + botões, e esconde pesquisa.
    (function wirePatientTopToggle() {
      const searchWrap = document.getElementById("pQuickSearchWrap");
      const selectedWrap = document.getElementById("pQuickSelectedWrap");
      const selectedBox = document.getElementById("pQuickSelected");
      const btnClear = document.getElementById("btnQuickClear");
      const input = document.getElementById("pQuickQuery");
      const results = document.getElementById("pQuickResults");

      if (!searchWrap || !selectedWrap || !selectedBox) return;

      function normalizeSelectedText() {
        return String(selectedBox.textContent || "").replace(/\s+/g, " ").trim();
      }

      function applyState() {
        const t = normalizeSelectedText();
        const has = t && t !== "—";
        if (has) {
          searchWrap.style.display = "none";
          selectedWrap.classList.add("gcShow");
        } else {
          searchWrap.style.display = "block";
          selectedWrap.classList.remove("gcShow");
        }
      }

      // Observa mudanças no “Selecionado” (o BLOCO 06/08 escreve aqui)
      try {
        const obs = new MutationObserver(() => applyState());
        obs.observe(selectedBox, { childList: true, characterData: true, subtree: true });
      } catch {}

      // Botão "Trocar doente"
      if (btnClear) {
        btnClear.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();

          // limpar estado (sem tocar noutros blocos)
          if (G && G.patientQuick) {
            G.patientQuick.selected = null;
            G.patientQuick.lastResults = [];
          }

          selectedBox.textContent = "—";
          if (input) input.value = "";
          if (results) results.innerHTML = `<div style="font-size:${UI.fs12}px; color:#666;">Escreve para pesquisar.</div>`;

          applyState();
          if (input) input.focus();
        });
      }

      // Estado inicial
      applyState();
    })();
  }

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
    const s = String(newStatus || "").trim();
    if (!s) return;

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

        const status = r.status ?? "scheduled";
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
                    return `<option value="${escapeHtml(s)}"${s === status ? " selected" : ""}>${escapeHtml(optLabel(s))}</option>`;
                  }).join("")}
                </select>
              </div>
            </div>

            <!-- ✅ 5ª coluna: Telefone -->
            <div style="min-width: 160px;">
              <div class="gcCellTitle">Telefone</div>
              <div class="gcCellValue">${escapeHtml(patientPhone)}</div>
            </div>

            <!-- ✅ 6ª coluna: Clínica (à direita) -->
            <div style="min-width: 170px;">
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

  /* ==== FIM    BLOCO 05/08 — Render Shell + Agenda (UI) ==== */
   /* ==== INÍCIO BLOCO 06/08 — Pesquisa rápida + Modais de Doente (ver/editar + novo) ==== */

  // ---------- Pesquisa rápida de doentes (main page) ----------
  function setQuickPatientMsg(kind, text) {
    const el = document.getElementById("pQuickMsg");
    if (!el) return;
    const color = kind === "error" ? "#b00020" : kind === "ok" ? "#111" : "#666";
    el.style.color = color;
    el.textContent = text || "";
  }

  function getSelectedClinicLabel() {
    const sel = document.getElementById("selClinic");
    if (!sel) return "";
    const v = sel.value || "";
    if (!v) return "Clínica: Todas";
    const c = G.clinicsById && G.clinicsById[v] ? G.clinicsById[v] : null;
    const name = c ? (c.name || c.slug || v) : v;
    return `Clínica: ${name}`;
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
    else if (p.nif) idBits.push(`NIF:${p.nif}`);
    else if (p.phone) idBits.push(`Tel:${p.phone}`);
    else if (p.passport_id) idBits.push(`ID:${p.passport_id}`);

    const extraBits = [];
    if (p.phone && !idBits.join(" ").includes("Tel:")) extraBits.push(`Tel:${p.phone}`);
    if (p.email) extraBits.push(p.email);

    const idLine = idBits.length ? idBits.join(" / ") : "";
    const extraLine = extraBits.length ? extraBits.join(" • ") : "";
    const clinicLine = getSelectedClinicLabel();

    const parts = [p.full_name, idLine, extraLine, clinicLine].filter(Boolean);
    box.textContent = parts.join(" • ");
  }

  function renderQuickPatientResults(results) {
    const host = document.getElementById("pQuickResults");
    if (!host) return;

    if (!results || results.length === 0) {
      host.innerHTML = `<div style="font-size:${UI.fs12}px; color:#666;">Sem resultados.</div>`;
      return;
    }

    host.innerHTML = results
      .map((p) => {
        const idBits = [];
        if (p.sns) idBits.push(`SNS:${p.sns}`);
        if (p.nif) idBits.push(`NIF:${p.nif}`);
        if (p.passport_id) idBits.push(`ID:${p.passport_id}`);
        const idLine = idBits.length ? idBits.join(" / ") : (p.external_id ? `Ext:${p.external_id}` : "");
        const phone = p.phone ? `Tel:${p.phone}` : "";
        const line2Parts = [idLine, phone].filter(Boolean).join(" • ");

        return `
          <div data-pid="${escapeHtml(p.id)}"
               style="padding:8px; border:1px solid #f0f0f0; border-radius:10px; margin-bottom:8px; cursor:pointer;">
            <div style="font-size:${UI.fs13}px; color:#111; font-weight:800; white-space:normal; overflow-wrap:anywhere; word-break:break-word;">${escapeHtml(p.full_name)}</div>
            <div style="font-size:${UI.fs12}px; color:#666;">${escapeHtml(line2Parts || "—")}</div>
          </div>
        `;
      })
      .join("");

    host.querySelectorAll("[data-pid]").forEach((el) => {
      el.addEventListener("mousedown", (ev) => {
        // mousedown para não perder o foco antes do clique (dropdown é focus-within)
        ev.preventDefault();
      });
      el.addEventListener("click", () => {
        const pid = el.getAttribute("data-pid");
        const p = (results || []).find((x) => x.id === pid);
        if (!p) return;

        G.patientQuick.selected = p;
        renderQuickPatientSelected();
        setQuickPatientMsg("ok", "Doente selecionado.");

        // fecha “dropdown” ao tirar foco do input
        const input = document.getElementById("pQuickQuery");
        if (input) input.blur();
      });
    });
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

  // ---------- Modal Doente (ver + editar) ----------
  function openPatientViewModal(patient) {
    const root = document.getElementById("modalRoot");
    if (!root) return;

    const p = patient;
    if (!p) return;

    let editMode = false;
    let working = false;

    function render() {
      const idBits = [];
      if (p.sns) idBits.push(`SNS: ${p.sns}`);
      if (p.nif) idBits.push(`NIF: ${p.nif}`);
      if (p.passport_id) idBits.push(`Passaporte/ID: ${p.passport_id}`);

      const topSubtitle = idBits.join(" • ") || "—";

      root.innerHTML = `
        <div id="pViewOverlay" style="position:fixed; inset:0; background:rgba(0,0,0,0.35); display:flex; align-items:center; justify-content:center; padding:18px;">
          <div style="background:#fff; width:min(920px, 100%); border-radius:14px; border:1px solid #e5e5e5; padding:14px; max-height: 86vh; overflow:auto;">
            <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start;">
              <div>
                <div style="font-size:${UI.fs14}px; font-weight:800; color:#111;">Doente</div>
                <div style="font-size:${UI.fs12}px; color:#666; margin-top:4px;">${escapeHtml(p.id)}</div>
                <div style="font-size:${UI.fs12}px; color:#666; margin-top:4px;">${escapeHtml(topSubtitle)}</div>
              </div>
              <div style="display:flex; gap:10px; flex-wrap:wrap;">
                <button id="btnToggleEdit" class="gcBtn">
                  ${editMode ? "Cancelar edição" : "Editar doente"}
                </button>
                <button id="btnClosePView" class="gcBtn">Fechar</button>
              </div>
            </div>

            <div style="margin-top:12px; display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
              <div style="grid-column: 1 / -1; padding:12px; border:1px solid #eee; border-radius:12px; background:#fafafa;">
                <div style="font-size:${UI.fs14}px; font-weight:900; color:#111;">
                  ${editMode ? `<input id="peFullName" type="text" value="${escapeHtml(p.full_name || "")}" style="width:100%; padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />`
                             : escapeHtml(p.full_name || "—")}
                </div>
              </div>

              <div style="padding:12px; border:1px solid #eee; border-radius:12px;">
                <div style="font-size:${UI.fs12}px; color:#666;">Data nascimento</div>
                <div style="margin-top:6px;">
                  ${editMode
                    ? `<input id="peDob" type="date" value="${escapeHtml(p.dob ? String(p.dob).slice(0,10) : "")}" style="width:100%; padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />`
                    : `<div style="font-size:${UI.fs13}px; color:#111; font-weight:700;">${escapeHtml(p.dob ? String(p.dob).slice(0,10) : "—")}</div>`}
                </div>
              </div>

              <div style="padding:12px; border:1px solid #eee; border-radius:12px;">
                <div style="font-size:${UI.fs12}px; color:#666;">Telefone</div>
                <div style="margin-top:6px;">
                  ${editMode
                    ? `<input id="pePhone" type="text" value="${escapeHtml(p.phone || "")}" style="width:100%; padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />`
                    : `<div style="font-size:${UI.fs13}px; color:#111; font-weight:700;">${escapeHtml(p.phone || "—")}</div>`}
                </div>
              </div>

              <div style="padding:12px; border:1px solid #eee; border-radius:12px;">
                <div style="font-size:${UI.fs12}px; color:#666;">Email</div>
                <div style="margin-top:6px;">
                  ${editMode
                    ? `<input id="peEmail" type="email" value="${escapeHtml(p.email || "")}" style="width:100%; padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />`
                    : `<div style="font-size:${UI.fs13}px; color:#111; font-weight:700;">${escapeHtml(p.email || "—")}</div>`}
                </div>
              </div>

              <div style="padding:12px; border:1px solid #eee; border-radius:12px;">
                <div style="font-size:${UI.fs12}px; color:#666;">SNS (9 dígitos)</div>
                <div style="margin-top:6px;">
                  ${editMode
                    ? `<input id="peSNS" type="text" inputmode="numeric" value="${escapeHtml(p.sns || "")}" style="width:100%; padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />`
                    : `<div style="font-size:${UI.fs13}px; color:#111; font-weight:700;">${escapeHtml(p.sns || "—")}</div>`}
                </div>
              </div>

              <div style="padding:12px; border:1px solid #eee; border-radius:12px;">
                <div style="font-size:${UI.fs12}px; color:#666;">NIF (9 dígitos)</div>
                <div style="margin-top:6px;">
                  ${editMode
                    ? `<input id="peNIF" type="text" inputmode="numeric" value="${escapeHtml(p.nif || "")}" style="width:100%; padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />`
                    : `<div style="font-size:${UI.fs13}px; color:#111; font-weight:700;">${escapeHtml(p.nif || "—")}</div>`}
                </div>
              </div>

              <div style="grid-column: 1 / -1; padding:12px; border:1px solid #eee; border-radius:12px;">
                <div style="font-size:${UI.fs12}px; color:#666;">Passaporte/ID</div>
                <div style="margin-top:6px;">
                  ${editMode
                    ? `<input id="pePassport" type="text" value="${escapeHtml(p.passport_id || "")}" style="width:100%; padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />`
                    : `<div style="font-size:${UI.fs13}px; color:#111; font-weight:700;">${escapeHtml(p.passport_id || "—")}</div>`}
                </div>
              </div>

              <div style="padding:12px; border:1px solid #eee; border-radius:12px;">
                <div style="font-size:${UI.fs12}px; color:#666;">Seguro</div>
                <div style="margin-top:6px;">
                  ${editMode
                    ? `<input id="peInsProv" type="text" value="${escapeHtml(p.insurance_provider || "")}" style="width:100%; padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />`
                    : `<div style="font-size:${UI.fs13}px; color:#111; font-weight:700;">${escapeHtml(p.insurance_provider || "—")}</div>`}
                </div>
              </div>

              <div style="padding:12px; border:1px solid #eee; border-radius:12px;">
                <div style="font-size:${UI.fs12}px; color:#666;">Apólice</div>
                <div style="margin-top:6px;">
                  ${editMode
                    ? `<input id="peInsPol" type="text" value="${escapeHtml(p.insurance_policy_number || "")}" style="width:100%; padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />`
                    : `<div style="font-size:${UI.fs13}px; color:#111; font-weight:700;">${escapeHtml(p.insurance_policy_number || "—")}</div>`}
                </div>
              </div>

              <div style="grid-column: 1 / -1; padding:12px; border:1px solid #eee; border-radius:12px;">
                <div style="font-size:${UI.fs12}px; color:#666;">Morada</div>
                <div style="margin-top:6px;">
                  ${editMode
                    ? `<input id="peAddr" type="text" value="${escapeHtml(p.address_line1 || "")}" style="width:100%; padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />`
                    : `<div style="font-size:${UI.fs13}px; color:#111; font-weight:700;">${escapeHtml(p.address_line1 || "—")}</div>`}
                </div>
              </div>

              <div style="padding:12px; border:1px solid #eee; border-radius:12px;">
                <div style="font-size:${UI.fs12}px; color:#666;">Código-postal</div>
                <div style="margin-top:6px;">
                  ${editMode
                    ? `<input id="pePostal" type="text" value="${escapeHtml(p.postal_code || "")}" style="width:100%; padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />`
                    : `<div style="font-size:${UI.fs13}px; color:#111; font-weight:700;">${escapeHtml(p.postal_code || "—")}</div>`}
                </div>
              </div>

              <div style="padding:12px; border:1px solid #eee; border-radius:12px;">
                <div style="font-size:${UI.fs12}px; color:#666;">Cidade</div>
                <div style="margin-top:6px;">
                  ${editMode
                    ? `<input id="peCity" type="text" value="${escapeHtml(p.city || "")}" style="width:100%; padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />`
                    : `<div style="font-size:${UI.fs13}px; color:#111; font-weight:700;">${escapeHtml(p.city || "—")}</div>`}
                </div>
              </div>

              <div style="grid-column: 1 / -1; padding:12px; border:1px solid #eee; border-radius:12px;">
                <div style="font-size:${UI.fs12}px; color:#666;">País</div>
                <div style="margin-top:6px;">
                  ${editMode
                    ? `<input id="peCountry" type="text" value="${escapeHtml(p.country || "PT")}" style="width:100%; padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />`
                    : `<div style="font-size:${UI.fs13}px; color:#111; font-weight:700;">${escapeHtml(p.country || "—")}</div>`}
                </div>
              </div>

              <div style="grid-column: 1 / -1; padding:12px; border:1px solid #eee; border-radius:12px;">
                <div style="font-size:${UI.fs12}px; color:#666;">Notas</div>
                <div style="margin-top:6px;">
                  ${editMode
                    ? `<textarea id="peNotes" rows="3" style="width:100%; padding:10px 12px; border-radius:10px; border:1px solid #ddd; resize:vertical; font-size:${UI.fs13}px;">${escapeHtml(p.notes || "")}</textarea>`
                    : `<div style="font-size:${UI.fs13}px; color:#111;">${escapeHtml(p.notes || "—")}</div>`}
                </div>
              </div>
            </div>

            <div style="margin-top:12px; display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
              <div id="peMsg" style="font-size:${UI.fs12}px; color:#666;"></div>
              <div style="display:flex; gap:10px; flex-wrap:wrap;">
                ${editMode ? `<button id="btnSavePatient" class="gcBtn" style="font-weight:800;">Guardar</button>` : ""}
              </div>
            </div>
          </div>
        </div>
      `;

      const overlay = document.getElementById("pViewOverlay");
      const btnClose = document.getElementById("btnClosePView");
      const btnToggle = document.getElementById("btnToggleEdit");
      const btnSave = document.getElementById("btnSavePatient");
      const msgEl = document.getElementById("peMsg");

      function setMsg(kind, txt) {
        if (!msgEl) return;
        msgEl.style.color = kind === "error" ? "#b00020" : kind === "ok" ? "#111" : "#666";
        msgEl.textContent = txt || "";
      }

      function close() {
        closeModalRoot();
      }

      if (btnClose) btnClose.addEventListener("click", close);
      if (overlay) overlay.addEventListener("click", (ev) => { if (ev.target && ev.target.id === "pViewOverlay") close(); });

      if (btnToggle) {
        btnToggle.addEventListener("click", () => {
          if (working) return;
          editMode = !editMode;
          render();
        });
      }

      if (btnSave) {
        btnSave.addEventListener("click", async () => {
          if (working) return;

          const vals = {
            full_name: document.getElementById("peFullName") ? document.getElementById("peFullName").value : "",
            dob: document.getElementById("peDob") ? document.getElementById("peDob").value : null,
            phone: document.getElementById("pePhone") ? document.getElementById("pePhone").value : null,
            email: document.getElementById("peEmail") ? document.getElementById("peEmail").value : null,
            sns: document.getElementById("peSNS") ? document.getElementById("peSNS").value : null,
            nif: document.getElementById("peNIF") ? document.getElementById("peNIF").value : null,
            passport_id: document.getElementById("pePassport") ? document.getElementById("pePassport").value : null,
            insurance_provider: document.getElementById("peInsProv") ? document.getElementById("peInsProv").value : null,
            insurance_policy_number: document.getElementById("peInsPol") ? document.getElementById("peInsPol").value : null,
            address_line1: document.getElementById("peAddr") ? document.getElementById("peAddr").value : null,
            postal_code: document.getElementById("pePostal") ? document.getElementById("pePostal").value : null,
            city: document.getElementById("peCity") ? document.getElementById("peCity").value : null,
            country: document.getElementById("peCountry") ? document.getElementById("peCountry").value : null,
            notes: document.getElementById("peNotes") ? document.getElementById("peNotes").value : null,
          };

          const snsEl = document.getElementById("peSNS");
          const nifEl = document.getElementById("peNIF");
          if (snsEl) snsEl.value = normalizeDigits(snsEl.value);
          if (nifEl) nifEl.value = normalizeDigits(nifEl.value);

          const v = validatePatientEdit(vals);
          if (!v.ok) {
            setMsg("error", v.msg);
            return;
          }

          working = true;
          setMsg("info", "A guardar…");

          try {
            const updated = await updatePatient(p.id, v.cleaned);
            if (!updated) throw new Error("Update sem retorno");

            Object.assign(p, updated);

            if (p.id) {
              G.patientsById[p.id] = Object.assign({}, (G.patientsById[p.id] || {}), {
                id: p.id,
                full_name: p.full_name,
                phone: p.phone,
                email: p.email,
                sns: p.sns,
                nif: p.nif,
                passport_id: p.passport_id,
              });
              if (G.patientQuick && G.patientQuick.selected && G.patientQuick.selected.id === p.id) {
                G.patientQuick.selected = Object.assign({}, G.patientQuick.selected, p);
                renderQuickPatientSelected();
              }
            }

            renderAgendaList();

            setMsg("ok", "Guardado.");
            editMode = false;
            render();
          } catch (e) {
            console.error("Guardar doente falhou:", e);
            const msg = String(e && (e.message || e.details || e.hint) ? (e.message || e.details || e.hint) : e);

            if (msg.includes("patients_sns_unique_not_null")) setMsg("error", "SNS já existe noutro doente.");
            else if (msg.includes("patients_nif_unique_not_null")) setMsg("error", "NIF já existe noutro doente.");
            else if (msg.includes("patients_passport_unique_not_null")) setMsg("error", "Passaporte/ID já existe noutro doente.");
            else if (msg.includes("patients_sns_format_check")) setMsg("error", "SNS inválido (9 dígitos).");
            else if (msg.includes("patients_nif_format_check")) setMsg("error", "NIF inválido (9 dígitos).");
            else if (msg.includes("patients_passport_format_check")) setMsg("error", "Passaporte/ID inválido (4–20 alfanum).");
            else if (msg.includes("patients_sns_or_nif_or_passport_check")) setMsg("error", "Identificação obrigatória: SNS/NIF/Passaporte.");
            else setMsg("error", "Erro ao guardar. Vê a consola.");
          } finally {
            working = false;
          }
        });
      }
    }

    render();
  }

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
          renderQuickPatientSelected();
          setQuickPatientMsg("ok", "Novo doente criado e selecionado.");

          const q = document.getElementById("pQuickQuery");
          if (q) q.value = "";
          const rHost = document.getElementById("pQuickResults");
          if (rHost) rHost.innerHTML = `<div style="font-size:${UI.fs12}px; color:#666;">Escreve para pesquisar.</div>`;

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

  // ---------- Pesquisa rápida: wiring (compatível com BLOCO 05 “modo único”) ----------
  async function wireQuickPatientSearch() {
    const input = document.getElementById("pQuickQuery");
    const resHost = document.getElementById("pQuickResults");
    const btnOpen = document.getElementById("btnQuickOpen");
    if (!input || !resHost || !btnOpen) return;

    let timer = null;
    let lastTerm = "";

    async function run() {
      const term = (input.value || "").trim();
      lastTerm = term;

      if (!term || term.length < 2) {
        resHost.innerHTML = `<div style="font-size:${UI.fs12}px; color:#666;">Escreve pelo menos 2 caracteres.</div>`;
        setQuickPatientMsg("info", "");
        return;
      }

      const selClinic = document.getElementById("selClinic");
      const clinicId = selClinic && selClinic.value ? selClinic.value : null;

      resHost.innerHTML = `<div style="font-size:${UI.fs12}px; color:#666;">A pesquisar…</div>`;
      setQuickPatientMsg("info", "");

      try {
        const pts = await searchPatientsScoped({ clinicId, q: term, limit: 30 });

        // se o utilizador já escreveu outra coisa entretanto, ignora
        if (lastTerm !== term) return;

        G.patientQuick.lastResults = pts;
        renderQuickPatientResults(pts);

        if (pts.length === 0) setQuickPatientMsg("info", "Sem resultados.");
      } catch (e) {
        console.error("Pesquisa rápida de doente falhou:", e);
        resHost.innerHTML = `<div style="font-size:${UI.fs12}px; color:#b00020;">Erro na pesquisa. Vê a consola.</div>`;
        setQuickPatientMsg("error", "Erro na pesquisa.");
      }
    }

    function schedule() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(run, 250);
    }

    input.addEventListener("input", schedule);

    // ao focar, se já tiver texto, tenta atualizar resultados
    input.addEventListener("focus", () => {
      const term = (input.value || "").trim();
      if (term.length >= 2) schedule();
    });

    // “Abrir feed” (por agora abre modal do doente, como está no baseline)
    btnOpen.addEventListener("click", () => {
      if (!G.patientQuick.selected) {
        setQuickPatientMsg("error", "Seleciona um doente primeiro.");
        return;
      }
      openPatientFeedFromAny(G.patientQuick.selected);
    });

    // quando muda clínica, refresca texto do selecionado (inclui “Clínica: …”)
    const selClinic = document.getElementById("selClinic");
    if (selClinic) {
      selClinic.addEventListener("change", () => {
        if (G.patientQuick.selected) renderQuickPatientSelected();
      });
    }

    // estado inicial (se houver selecionado por algum motivo)
    renderQuickPatientSelected();
  }

  /* ==== FIM    BLOCO 06/08 — Pesquisa rápida + Modais de Doente (ver/editar + novo) ==== */
  /* ==== INÍCIO BLOCO 07/08 — Logout + Refresh Agenda + Boot ==== */
(function () {
  "use strict";

  // -----------------------------------------------------------
  // COMPAT SHIM: garantir que "openCalendarOverlay" existe no scope
  // (evita: ReferenceError: Can't find variable: openCalendarOverlay)
  // -----------------------------------------------------------
  var openCalendarOverlay =
    (typeof window.openCalendarOverlay === "function" && window.openCalendarOverlay) ||
    (window.G && typeof window.G.openCalendarOverlay === "function" && window.G.openCalendarOverlay) ||
    null;

  function safeOpenCalendarOverlay() {
    if (typeof openCalendarOverlay === "function") {
      return openCalendarOverlay();
    }
    console.warn("[Calendário] openCalendarOverlay não está definido.");
    alert("Calendário indisponível (função openCalendarOverlay em falta). Abre a consola e confirma o nome da função do overlay.");
  }

  // -----------------------------------------------------------
  // Logout
  // -----------------------------------------------------------
  async function doLogout() {
    try {
      if (window.supabase && window.supabase.auth) {
        await window.supabase.auth.signOut();
      }
    } catch (e) {
      console.warn("Logout com aviso:", e);
    } finally {
      window.location.replace("/index.html");
    }
  }

  function wireLogout() {
    const btn =
      document.querySelector('[data-action="logout"]') ||
      document.querySelector("#btnLogout") ||
      document.querySelector("#logoutBtn") ||
      document.querySelector("button.logout");

    if (btn) btn.addEventListener("click", (e) => { e.preventDefault(); doLogout(); });
  }

  // -----------------------------------------------------------
  // Botões / UI (calendário, hoje, refresh)
  // -----------------------------------------------------------
  function wireCalendarButton() {
    const btn =
      document.querySelector('[data-action="open-calendar"]') ||
      document.querySelector("#btnCalendar") ||
      document.querySelector("#btn-calendar") ||
      document.querySelector("button[name='calendar']");

    if (btn) btn.addEventListener("click", (e) => { e.preventDefault(); safeOpenCalendarOverlay(); });
  }

  function wireTodayButton() {
    const btn =
      document.querySelector('[data-action="today"]') ||
      document.querySelector("#btnToday") ||
      document.querySelector("#todayBtn");

    if (!btn) return;

    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        if (typeof window.setSelectedDay === "function") {
          window.setSelectedDay(new Date());
        } else if (window.G && typeof window.G.setSelectedDay === "function") {
          window.G.setSelectedDay(new Date());
        }
        if (typeof window.refreshAgenda === "function") await window.refreshAgenda();
        else if (typeof window.refreshAgendaDay === "function") await window.refreshAgendaDay();
        else if (window.G && typeof window.G.refreshAgenda === "function") await window.G.refreshAgenda();
      } catch (err) {
        console.warn("Today/Refresh com aviso:", err);
      }
    });
  }

  function wireRefreshAgenda() {
    const btn =
      document.querySelector('[data-action="refresh-agenda"]') ||
      document.querySelector("#btnRefresh") ||
      document.querySelector("#refreshBtn");

    if (!btn) return;

    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        if (typeof window.refreshAgenda === "function") await window.refreshAgenda();
        else if (typeof window.refreshAgendaDay === "function") await window.refreshAgendaDay();
        else if (window.G && typeof window.G.refreshAgenda === "function") await window.G.refreshAgenda();
      } catch (err) {
        console.warn("Refresh agenda com aviso:", err);
      }
    });
  }

  // -----------------------------------------------------------
  // BOOT (não inventa fluxo; chama o boot existente se existir)
  // -----------------------------------------------------------
  async function bootSafe() {
    // Se tens um boot “oficial”, respeitamos.
    if (typeof window.bootApp === "function") return window.bootApp();
    if (typeof window.initApp === "function") return window.initApp();
    if (window.G && typeof window.G.bootApp === "function") return window.G.bootApp();
    if (window.G && typeof window.G.initApp === "function") return window.G.initApp();

    // Fallback mínimo: tentar refresh da agenda
    if (typeof window.refreshAgenda === "function") return window.refreshAgenda();
    if (typeof window.refreshAgendaDay === "function") return window.refreshAgendaDay();
    if (window.G && typeof window.G.refreshAgenda === "function") return window.G.refreshAgenda();
  }

  document.addEventListener("DOMContentLoaded", function () {
    try {
      wireLogout();
      wireCalendarButton();
      wireTodayButton();
      wireRefreshAgenda();

      Promise.resolve()
        .then(bootSafe)
        .catch(function (e) {
          console.error("Boot falhou:", e);
          // Mantém a tua mensagem padrão se já existir na UI:
          const el = document.querySelector("#appError");
          if (el) el.textContent = "Erro ao iniciar a app. Abre a consola para detalhe.";
        });
    } catch (e) {
      console.error("Boot falhou:", e);
      const el = document.querySelector("#appError");
      if (el) el.textContent = "Erro ao iniciar a app. Abre a consola para detalhe.";
    }
  });
})();
/* ==== FIM BLOCO 07/08 — Logout + Refresh Agenda + Boot ==== */
  /* ==== INÍCIO BLOCO 08/08 — Logout + Refresh Agenda + Boot ==== */

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

  boot();

  /* ==== FIM    BLOCO 08/08 — Logout + Refresh Agenda + Boot ==== */
})();
