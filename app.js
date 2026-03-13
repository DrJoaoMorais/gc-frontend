/* ========================================================
   BLOCO 01/12 — Cabeçalho + utilitários base + helpers
   MAPA DE NAVEGAÇÃO
   --------------------------------------------------------
   01A — Cabeçalho do ficheiro + configuração base
   01B — Helpers genéricos de string/HTML
   01C — Helpers de datas/horas
   01D — Helpers utilitários transversais
   01E — Helpers DOB (idade + aniversário)
   01F — Fetch de role e clínicas visíveis
   01G — Debug hooks globais
   01H — Logout automático por inatividade
   ======================================================== */
/* ==== INÍCIO BLOCO 01A — Cabeçalho do ficheiro + configuração base ==== */
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

  /* ---- FUNÇÃO/CONFIG 01A.1 — Config Google Calendar Worker ---- */
  // =========================================================
  // CONFIG — Google Calendar Worker (GCAL)
  // =========================================================
  // ✅ Troca apenas a URL abaixo pela tua URL real do Worker gc-gcal (sem /sync-day)
  window.__GC_GCAL_WORKER_URL__ = "https://gc-gcal.dr-joao-morais.workers.dev";
  /* ---- FIM FUNÇÃO/CONFIG 01A.1 ---- */

  /* ---- FUNÇÃO/CONFIG 01A.2 — UI scale ---- */
  // ===== UI SCALE (apenas agenda + shell) =====
  const UI = {
    fs12: 13,
    fs13: 14,
    fs14: 15,
    fs16: 17,
    fs18: 19, // nome do doente
  };
  /* ---- FIM FUNÇÃO/CONFIG 01A.2 ---- */
/* ==== FIM BLOCO 01A — Cabeçalho do ficheiro + configuração base ==== */


/* ==== INÍCIO BLOCO 01B — Helpers genéricos de string/HTML ==== */
  /* ---- FUNÇÃO 01B.1 — hardRedirect ---- */
  function hardRedirect(path) {
    window.location.replace(path);
  }
  /* ---- FIM FUNÇÃO 01B.1 ---- */

  /* ---- FUNÇÃO 01B.2 — escapeHtml ---- */
  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
  /* ---- FIM FUNÇÃO 01B.2 ---- */

  /* ---- FUNÇÃO 01B.3 — normalizeDigits ---- */
  function normalizeDigits(v) {
    return String(v || "").replace(/\D+/g, "");
  }
  /* ---- FIM FUNÇÃO 01B.3 ---- */

  /* ---- FUNÇÃO 01B.4 — clipOneLine ---- */
  function clipOneLine(s, max = 110) {
    const t = String(s || "").replace(/\s+/g, " ").trim();
    if (!t) return "";
    if (t.length <= max) return t;
    return t.slice(0, max - 1) + "…";
  }
  /* ---- FIM FUNÇÃO 01B.4 ---- */
/* ==== FIM BLOCO 01B — Helpers genéricos de string/HTML ==== */


/* ==== INÍCIO BLOCO 01C — Helpers de datas/horas ==== */
  /* ---- FUNÇÃO 01C.1 — fmtTime ---- */
  function fmtTime(d) {
    if (!(d instanceof Date) || isNaN(d.getTime())) return "—";
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }
  /* ---- FIM FUNÇÃO 01C.1 ---- */

  /* ---- FUNÇÃO 01C.2 — fmtDatePt ---- */
  function fmtDatePt(d) {
    if (!(d instanceof Date) || isNaN(d.getTime())) return "—";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = String(d.getFullYear());
    return `${dd}-${mm}-${yyyy}`;
  }
  /* ---- FIM FUNÇÃO 01C.2 ---- */

  /* ---- FUNÇÃO 01C.3 — fmtDateISO ---- */
  function fmtDateISO(d) {
    if (!(d instanceof Date) || isNaN(d.getTime())) return "";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  /* ---- FIM FUNÇÃO 01C.3 ---- */

  /* ---- FUNÇÃO 01C.4 — parseISODateToLocalStart ---- */
  function parseISODateToLocalStart(dateISO) {
    const [y, m, d] = (dateISO || "").split("-").map((n) => parseInt(n, 10));
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }
  /* ---- FIM FUNÇÃO 01C.4 ---- */

  /* ---- FUNÇÃO 01C.5 — __gcIsoLocalDayRangeCore ---- */
  function __gcIsoLocalDayRangeCore(dateStr) {
    const start = parseISODateToLocalStart(dateStr);
    if (!start) return null;
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1, 0, 0, 0, 0);
    return { startISO: start.toISOString(), endISO: end.toISOString(), start, end };
  }
  /* ---- FIM FUNÇÃO 01C.5 ---- */

  /* ---- FUNÇÃO 01C.6 — isoLocalDayRangeFromISODate ---- */
  function isoLocalDayRangeFromISODate(dateStr) {
    return __gcIsoLocalDayRangeCore(dateStr);
  }
  /* ---- FIM FUNÇÃO 01C.6 ---- */

  /* ---- FUNÇÃO 01C.7 — isoLocalDayRangeFromISO ---- */
  function isoLocalDayRangeFromISO(dateStr) {
    return __gcIsoLocalDayRangeCore(dateStr);
  }
  /* ---- FIM FUNÇÃO 01C.7 ---- */

  /* ---- FUNÇÃO 01C.8 — toLocalInputValue ---- */
  function toLocalInputValue(dateObj) {
    const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  }
  /* ---- FIM FUNÇÃO 01C.8 ---- */

  /* ---- FUNÇÃO 01C.9 — fromLocalInputValue ---- */
  function fromLocalInputValue(v) {
    return new Date(v);
  }
  /* ---- FIM FUNÇÃO 01C.9 ---- */
/* ==== FIM BLOCO 01C — Helpers de datas/horas ==== */


/* ==== INÍCIO BLOCO 01D — Helpers utilitários transversais ==== */
/* ==== FIM BLOCO 01D — Helpers utilitários transversais ==== */


/* ==== INÍCIO BLOCO 01E — Helpers DOB (idade + aniversário) ==== */
  /* ---- FUNÇÃO 01E.1 — parseISODateOnly ---- */
  function parseISODateOnly(isoDate) {
    // isoDate: "YYYY-MM-DD" (dob vindo do Postgres date)
    if (!isoDate) return null;
    const [y, m, d] = String(isoDate).split("-").map(Number);
    if (!y || !m || !d) return null;
    return { y, m, d };
  }
  /* ---- FIM FUNÇÃO 01E.1 ---- */

  /* ---- FUNÇÃO 01E.2 — calcAgeYears ---- */
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
  /* ---- FIM FUNÇÃO 01E.2 ---- */

  /* ---- FUNÇÃO 01E.3 — isBirthdayOnDate ---- */
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
  /* ---- FIM FUNÇÃO 01E.3 ---- */
/* ==== FIM BLOCO 01E — Helpers DOB (idade + aniversário) ==== */


/* ==== INÍCIO BLOCO 01F — Fetch de role e clínicas visíveis ==== */
  /* ---- FUNÇÃO 01F.1 — fetchMyRole ---- */
  async function fetchMyRole(userId) {
    // ✅ Guardar flag de superadmin SEM mudar o role operacional
    // (evita bloquear UI/permissions que esperam doctor/secretary/physio)
    window.__GC_IS_SUPERADMIN__ = false;
    try {
      const { data: isSa, error: eSa } = await window.sb.rpc("is_superadmin");
      if (eSa) throw eSa;
      window.__GC_IS_SUPERADMIN__ = (isSa === true);
    } catch (e) {
      // não bloqueia
      try { console.warn("fetchMyRole: rpc(is_superadmin) falhou:", e); } catch (_) {}
      window.__GC_IS_SUPERADMIN__ = false;
    }

    // ✅ Fonte de verdade: user_clinics (multi-clínica)
    const { data, error } = await window.sb
      .from("user_clinics")
      .select("role, clinic_id, is_active")
      .eq("user_id", userId)
      .eq("is_active", true);

    if (error) throw error;

    const rows = Array.isArray(data) ? data : [];

    // Guardar para UI (contagem/IDs)
    window.__GC_MY_CLINIC_IDS__ = rows.map(r => r.clinic_id).filter(Boolean);
    window.__GC_MY_CLINICS_COUNT__ = window.__GC_MY_CLINIC_IDS__.length;

    // Role “operacional” (prioridade)
    const roles = rows.map(r => String(r.role || "").trim()).filter(Boolean);
    if (roles.includes("doctor")) return "doctor";
    if (roles.includes("physio")) return "physio";
    if (roles.includes("secretary")) return "secretary";
    return null;
  }
  /* ---- FIM FUNÇÃO 01F.1 ---- */

  /* ---- FUNÇÃO 01F.2 — fetchVisibleClinics ---- */
  async function fetchVisibleClinics() {
    const { data, error } = await window.sb
      .from("clinics")
      .select("id, name, slug")
      .order("name", { ascending: true });

    if (error) throw error;
    return Array.isArray(data) ? data : [];
  }
  /* ---- FIM FUNÇÃO 01F.2 ---- */
/* ==== FIM BLOCO 01F — Fetch de role e clínicas visíveis ==== */


/* ==== INÍCIO BLOCO 01G — Debug hooks globais ==== */
  /* ---- FUNÇÃO 01G.1 — setupGlobalDebugHooks ---- */
  (function setupGlobalDebugHooks() {
    if (window.__GC_DEBUG_HOOKS_INSTALLED__) return;
    window.__GC_DEBUG_HOOKS_INSTALLED__ = true;

    function safeLog(...args) {
      try { console.log(...args); } catch (_) {}
    }

    window.addEventListener("unhandledrejection", (ev) => {
      const r = ev.reason;
      safeLog("❌ UNHANDLED_REJECTION:", r);

      try {
        if (r && typeof r === "object") {
          safeLog("   keys:", Object.keys(r));
          safeLog("   json:", JSON.stringify(r, Object.getOwnPropertyNames(r), 2));
        }
      } catch (e) {
        safeLog("   (não foi possível stringify reason):", e);
      }

      try {
        safeLog("   message:", r?.message);
        safeLog("   stack:", r?.stack);
      } catch (_) {}

      try {
        safeLog("   name:", r?.name);
        safeLog("   cause:", r?.cause);
        safeLog("   toString:", String(r));
      } catch (_) {}
    });

    window.addEventListener("error", (ev) => {
      safeLog("❌ WINDOW_ERROR:", ev.message, "at", ev.filename + ":" + ev.lineno + ":" + ev.colno);
      if (ev.error) {
        safeLog("   error:", ev.error);
        safeLog("   stack:", ev.error.stack);
      }
    });

    safeLog("✅ Debug hooks ativos (unhandledrejection + window.error)");
  })();
  /* ---- FIM FUNÇÃO 01G.1 ---- */
/* ==== FIM BLOCO 01G — Debug hooks globais ==== */


/* ==== INÍCIO BLOCO 01H — Logout automático por inatividade ==== */
  /* ---- FUNÇÃO 01H.1 — setupIdleLogout ---- */
  (function setupIdleLogout() {
    const IDLE_MINUTES = 30;
    const IDLE_MS = IDLE_MINUTES * 60 * 1000;

    const LS_LAST_ACTIVITY = "gc_last_activity";

    let idleTimer = null;
    let listenersOn = false;

    function nowMs() { return Date.now(); }

    async function safeSignOut(reason) {
      try {
        if (!window.sb || !window.sb.auth) return;

        if (window.__gcSigningOut) return;
        window.__gcSigningOut = true;

        console.warn("[SEC] Idle logout:", reason || "inactivity");

        await window.sb.auth.signOut();

      } catch (e) {
        console.error("[SEC] Idle logout error:", e);
      } finally {
        window.__gcSigningOut = false;
      }
    }

    function markActivity() {
      try {
        localStorage.setItem(LS_LAST_ACTIVITY, String(nowMs()));
      } catch (_) {}
    }

    function getLastActivityMs() {
      try {
        const v = localStorage.getItem(LS_LAST_ACTIVITY);
        const n = v ? Number(v) : NaN;
        return Number.isFinite(n) ? n : 0;
      } catch (_) {
        return 0;
      }
    }

    function clearIdleTimer() {
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
    }

    function scheduleIdleCheck() {
      clearIdleTimer();

      const last = getLastActivityMs() || nowMs();
      const elapsed = nowMs() - last;
      const remaining = Math.max(0, IDLE_MS - elapsed);

      idleTimer = setTimeout(async () => {
        const last2 = getLastActivityMs() || 0;
        const elapsed2 = nowMs() - last2;

        if (elapsed2 >= IDLE_MS) {
          await safeSignOut("30min inactivity");
        } else {
          scheduleIdleCheck();
        }
      }, remaining);
    }

    function onAnyActivity() {
      if (!window.__gcHasSession) return;
      markActivity();
      scheduleIdleCheck();
    }

    function addListeners() {
      if (listenersOn) return;
      listenersOn = true;

      const opts = { passive: true, capture: true };

      window.addEventListener("click", onAnyActivity, opts);
      window.addEventListener("mousemove", onAnyActivity, opts);
      window.addEventListener("keydown", onAnyActivity, opts);
      window.addEventListener("scroll", onAnyActivity, opts);
      window.addEventListener("touchstart", onAnyActivity, opts);

      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") onAnyActivity();
      }, true);
    }

    function removeListeners() {
      if (!listenersOn) return;
      listenersOn = false;

      window.removeEventListener("click", onAnyActivity, true);
      window.removeEventListener("mousemove", onAnyActivity, true);
      window.removeEventListener("keydown", onAnyActivity, true);
      window.removeEventListener("scroll", onAnyActivity, true);
      window.removeEventListener("touchstart", onAnyActivity, true);

      clearIdleTimer();
    }

    async function bootstrap() {
      if (!window.sb || !window.sb.auth) {
        console.warn("[SEC] Supabase client não encontrado (window.sb)");
        return;
      }

      const { data } = await window.sb.auth.getSession();
      window.__gcHasSession = !!(data && data.session);

      if (window.__gcHasSession) {
        addListeners();
        markActivity();
        scheduleIdleCheck();
      }

      window.sb.auth.onAuthStateChange((_event, session) => {
        window.__gcHasSession = !!session;

        if (window.__gcHasSession) {
          addListeners();
          markActivity();
          scheduleIdleCheck();
        } else {
          removeListeners();
        }
      });
    }

    bootstrap();
  })();
  /* ---- FIM FUNÇÃO 01H.1 ---- */
/* ==== FIM BLOCO 01H — Logout automático por inatividade ==== */
/* ==== FIM BLOCO 01/12 — Cabeçalho + utilitários base + helpers ==== */

/* ========================================================
   BLOCO 02/12 — Agenda (helpers + load) + Patients (scope/search/RPC)
   MAPA DE NAVEGAÇÃO
   --------------------------------------------------------
   02A — Constantes e helpers da agenda
   02B — Load da agenda
   02C — Scope de doentes por clínica
   02D — Construção de filtros de pesquisa
   02E — Pesquisa de doentes
   02F — RPC de criação/transferência de doente
   02G — Fetch de doentes por ID
   02H — Fetch de doente individual
   02I — Atualização de doente
   02J — Helpers globais de clínica ativa / transferência
   ======================================================== */

/* ==== INÍCIO BLOCO 02A — Constantes e helpers da agenda ==== */
  /* ---- FUNÇÃO/CONST 02A.1 — APPT_TIME_COL_CANDIDATES ---- */
  const APPT_TIME_COL_CANDIDATES = ["start_at", "starts_at", "start_time", "start_datetime", "start"];
  /* ---- FIM FUNÇÃO/CONST 02A.1 ---- */

  /* ---- FUNÇÃO/CONST 02A.2 — APPT_END_COL_CANDIDATES ---- */
  const APPT_END_COL_CANDIDATES = ["end_at", "ends_at", "end_time", "end_datetime", "end"];
  /* ---- FIM FUNÇÃO/CONST 02A.2 ---- */

  /* ---- FUNÇÃO 02A.3 — pickFirstExisting ---- */
  function pickFirstExisting(obj, candidates) {
    for (const k of candidates) {
      if (obj && Object.prototype.hasOwnProperty.call(obj, k) && obj[k] != null) return k;
    }
    return null;
  }
  /* ---- FIM FUNÇÃO 02A.3 ---- */
/* ==== FIM BLOCO 02A — Constantes e helpers da agenda ==== */


/* ==== INÍCIO BLOCO 02B — Load da agenda ==== */
  /* ---- FUNÇÃO 02B.1 — loadAppointmentsForRange ---- */
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

        // ✅ IMPORTANTE:
        // Se estás a filtrar por clínica, tens de incluir também bloqueios globais:
        // (clinic_id = clinicId) OR (clinic_id IS NULL AND mode = 'bloqueio')
        if (clinicId) {
          q = q.or(`clinic_id.eq.${clinicId},and(clinic_id.is.null,mode.eq.bloqueio)`);
        }

        const { data, error } = await q;
        if (error) throw error;

        return { data: Array.isArray(data) ? data : [], timeColUsed: col };
      } catch (e) {
        lastErr = e;
      }
    }

    throw lastErr || new Error("Não foi possível carregar appointments: nenhuma coluna de tempo reconhecida.");
  }
  /* ---- FIM FUNÇÃO 02B.1 ---- */
/* ==== FIM BLOCO 02B — Load da agenda ==== */


/* ==== INÍCIO BLOCO 02C — Scope de doentes por clínica ==== */
  /* ---- FUNÇÃO 02C.1 — listPatientIdsForScope ---- */
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
  /* ---- FIM FUNÇÃO 02C.1 ---- */
/* ==== FIM BLOCO 02C — Scope de doentes por clínica ==== */


/* ==== INÍCIO BLOCO 02D — Construção de filtros de pesquisa ==== */
  /* ---- FUNÇÃO 02D.1 — buildPatientOrFilter ---- */
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
  /* ---- FIM FUNÇÃO 02D.1 ---- */
/* ==== FIM BLOCO 02D — Construção de filtros de pesquisa ==== */


/* ==== INÍCIO BLOCO 02E — Pesquisa de doentes ==== */
  /* ---- FUNÇÃO 02E.1 — searchPatientsScoped ---- */
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
  /* ---- FIM FUNÇÃO 02E.1 ---- */
/* ==== FIM BLOCO 02E — Pesquisa de doentes ==== */


/* ==== INÍCIO BLOCO 02F — RPC de criação/transferência de doente ==== */
  /* ---- FUNÇÃO 02F.1 — rpcCreatePatientForClinic ---- */
  async function rpcCreatePatientForClinic(payload) {
    const { data, error } = await window.sb.rpc("create_patient_for_clinic_v2", payload);
    if (error) throw error;

    // data = { patient_id, action }
    const patientId = data?.patient_id || null;
    const action = data?.action || "created";

    if (!patientId) throw new Error("RPC create_patient_for_clinic_v2 devolveu patient_id vazio");

    // Doente já existia — foi associado silenciosamente à clínica atual (reused_linked)
    // Não há transferência, não há confirmação, as outras clínicas não são afetadas

    // Para manter compatibilidade com o resto do código:
    // - antes devolvia UUID direto
    // - agora devolvemos só o UUID
    return patientId;
  }
  /* ---- FIM FUNÇÃO 02F.1 ---- */
/* ==== FIM BLOCO 02F — RPC de criação/transferência de doente ==== */


/* ==== INÍCIO BLOCO 02G — Fetch de doentes por ID ==== */
  /* ---- FUNÇÃO 02G.1 — fetchPatientsByIds ---- */
  async function fetchPatientsByIds(patientIds) {
    const ids = Array.from(new Set((patientIds || []).filter(Boolean)));
    if (ids.length === 0) return {};

    const CHUNK = 150;
    const out = {};
    for (let i = 0; i < ids.length; i += CHUNK) {
      const part = ids.slice(i, i + CHUNK);

      // ✅ ESTE SELECT alimenta G.patientsById (agenda + impressão)
      // Tem de incluir os campos administrativos.
      const { data, error } = await window.sb
        .from("patients")
        .select(
          "id, full_name, dob, phone, email, external_id, sns, nif, passport_id, insurance_provider, insurance_policy_number, address_line1, postal_code, city, country, notes"
        )
        .in("id", part)
        .eq("is_active", true);

      if (error) throw error;
      for (const p of data || []) out[p.id] = p;
    }
    return out;
  }
  /* ---- FIM FUNÇÃO 02G.1 ---- */
/* ==== FIM BLOCO 02G — Fetch de doentes por ID ==== */


/* ==== INÍCIO BLOCO 02H — Fetch de doente individual ==== */
  /* ---- FUNÇÃO 02H.1 — fetchPatientById ---- */
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
  /* ---- FIM FUNÇÃO 02H.1 ---- */
/* ==== FIM BLOCO 02H — Fetch de doente individual ==== */


/* ==== INÍCIO BLOCO 02I — Atualização de doente ==== */
  /* ---- FUNÇÃO 02I.1 — updatePatient ---- */
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
  /* ---- FIM FUNÇÃO 02I.1 ---- */
/* ==== FIM BLOCO 02I — Atualização de doente ==== */


/* ==== INÍCIO BLOCO 02J — Helpers globais de clínica ativa / transferência ==== */
  /* ---- FUNÇÃO 02J.1 — fetchPatientIdentifiers ---- */
  async function fetchPatientIdentifiers(patientId) {
    try {
      const { data, error } = await window.sb
        .from("patients")
        .select("full_name, sns, nif, passport_id, phone, dob")
        .eq("id", patientId)
        .limit(1);

      if (error) throw error;
      const p = (data && data.length) ? data[0] : null;
      return p || null;
    } catch (e) {
      console.warn("fetchPatientIdentifiers falhou:", e);
      return null;
    }
  }
  /* ---- FIM FUNÇÃO 02J.1 ---- */

  /* ---- FUNÇÃO 02J.2 — fetchActiveClinicForPatient ---- */
  async function fetchActiveClinicForPatient(patientId) {
    try {
      const { data, error } = await window.sb
        .from("patient_clinic")
        .select("clinic_id, is_active")
        .eq("patient_id", patientId)
        .eq("is_active", true)
        .limit(1);

      if (error) throw error;
      const r = (data && data.length) ? data[0] : null;
      return r ? (r.clinic_id || null) : null;
    } catch (e) {
      console.warn("fetchActiveClinicForPatient falhou:", e);
      return null;
    }
  }
  /* ---- FIM FUNÇÃO 02J.2 ---- */

  /* ---- FUNÇÃO 02J.3 — buildTransferConfirmText ---- */
  function buildTransferConfirmText({ patient, fromClinicName, toClinicName }) {
    const name = (patient?.full_name || "").trim() || "—";
    const parts = [];

    const sns = patient?.sns ? `SNS: ${patient.sns}` : "";
    const nif = patient?.nif ? `NIF: ${patient.nif}` : "";
    const tel = patient?.phone ? `Tel: ${patient.phone}` : "";
    const pid = patient?.passport_id ? `ID: ${patient.passport_id}` : "";
    const dob = patient?.dob ? `DN: ${patient.dob}` : "";

    const idLine = [sns, nif, tel, pid, dob].filter(Boolean).join("  |  ");

    parts.push("Confirme que é o doente correto:");
    parts.push(`${name}`);
    if (idLine) parts.push(idLine);
    parts.push("");
    parts.push(`Este doente está ativo em: ${fromClinicName || "—"}`);
    parts.push(`Pretende transferir para: ${toClinicName || "—"} ?`);
    parts.push("");
    parts.push("(Isto atualiza automaticamente a clínica ativa do doente.)");

    return parts.join("\n");
  }
  /* ---- FIM FUNÇÃO 02J.3 ---- */

  /* ---- FUNÇÃO 02J.4 — ensurePatientActiveInClinic ---- */
  async function ensurePatientActiveInClinic({ patientId, targetClinicId }) {
    const pid = String(patientId || "");
    const cid = String(targetClinicId || "");
    if (!pid || !cid) {
      throw new Error("ensurePatientActiveInClinic: patientId/targetClinicId em falta.");
    }

    const prevActiveClinicId = await fetchActiveClinicForPatient(pid);

    if (prevActiveClinicId && String(prevActiveClinicId) === cid) return true;

    async function ensureRowExistsInactive(pId, cId) {
      const { data: exist, error: e0 } = await window.sb
        .from("patient_clinic")
        .select("clinic_id")
        .eq("patient_id", pId)
        .eq("clinic_id", cId)
        .limit(1);

      if (e0) throw e0;
      if (exist && exist.length) return true;

      const { error: eIns } = await window.sb
        .from("patient_clinic")
        .insert({ patient_id: pId, clinic_id: cId, is_active: false });

      if (eIns) throw eIns;
      return true;
    }

    async function setActiveClinic(pId, cId) {
      await ensureRowExistsInactive(pId, cId);

      const { error: eOff } = await window.sb
        .from("patient_clinic")
        .update({ is_active: false })
        .eq("patient_id", pId)
        .eq("is_active", true);

      if (eOff) throw eOff;

      const { error: eOn } = await window.sb
        .from("patient_clinic")
        .update({ is_active: true })
        .eq("patient_id", pId)
        .eq("clinic_id", cId);

      if (eOn) throw eOn;

      const nowActive = await fetchActiveClinicForPatient(pId);
      if (!nowActive || String(nowActive) !== String(cId)) {
        throw new Error("Falha ao ativar clínica destino (validação falhou).");
      }

      return true;
    }

    try {
      await setActiveClinic(pid, cid);
      return true;
    } catch (e) {
      try {
        if (prevActiveClinicId) {
          await setActiveClinic(pid, String(prevActiveClinicId));
        }
      } catch (_) {}
      throw e;
    }
  }
  /* ---- FIM FUNÇÃO 02J.4 ---- */

  /* ---- FUNÇÃO 02J.5 — maybeTransferPatientToClinic ---- */
  async function maybeTransferPatientToClinic({ patientId, targetClinicId }) {
    const activeClinicId = await fetchActiveClinicForPatient(patientId);

    if (!activeClinicId) return { changed: false, noActive: true };
    if (String(activeClinicId) === String(targetClinicId)) return { changed: false };

    const fromClinicName = (G.clinicsById && G.clinicsById[activeClinicId])
      ? (G.clinicsById[activeClinicId].name || G.clinicsById[activeClinicId].slug || activeClinicId)
      : activeClinicId;

    const toClinicName = (G.clinicsById && G.clinicsById[targetClinicId])
      ? (G.clinicsById[targetClinicId].name || G.clinicsById[targetClinicId].slug || targetClinicId)
      : targetClinicId;

    const patient = await fetchPatientIdentifiers(patientId);

    const ok = confirm(buildTransferConfirmText({ patient, fromClinicName, toClinicName }));
    if (!ok) return { changed: false, cancelled: true };

    await ensurePatientActiveInClinic({ patientId, targetClinicId });
    return { changed: true };
  }
  /* ---- FIM FUNÇÃO 02J.5 ---- */
/* ==== FIM BLOCO 02J — Helpers globais de clínica ativa / transferência ==== */

/* ==== FIM BLOCO 02/12 — Agenda (helpers + load) + Patients (scope/search/RPC) ==== */

/* ========================================================
   BLOCO 03/12 — Constantes (procedimentos/status) + estado global + render shell (HTML+CSS)
   MAPA DE NAVEGAÇÃO
   --------------------------------------------------------
   03A — Constantes de procedimentos
   03B — Constantes de estados/status
   03C — Constantes de duração
   03D — Metadata de estado
   03E — Estado global da app
   03F — Render shell (HTML + CSS)
   ======================================================== */

/* ==== INÍCIO BLOCO 03A — Constantes de procedimentos ==== */
  /* ---- FUNÇÃO/CONST 03A.1 — PROCEDURE_OPTIONS ---- */
  const PROCEDURE_OPTIONS = [
    "🆕 Primeira Consulta",
    "🔁 Consulta de Reavaliação",
    "🩸 Plasma Rico em Plaquetas",
    "💉 Viscossuplementação",
    "🎥 Teleconsulta",
    "📑 Revalidação de tratamentos",
    "🖋️ Relatórios",
    "📌Outro",
  ];
  /* ---- FIM FUNÇÃO/CONST 03A.1 ---- */
/* ==== FIM BLOCO 03A — Constantes de procedimentos ==== */


/* ==== INÍCIO BLOCO 03B — Constantes de estados/status ==== */
  /* ---- FUNÇÃO/CONST 03B.1 — STATUS_OPTIONS ---- */
  const STATUS_OPTIONS = ["scheduled", "arrived", "done", "no_show", "confirmed"];
  /* ---- FIM FUNÇÃO/CONST 03B.1 ---- */
/* ==== FIM BLOCO 03B — Constantes de estados/status ==== */


/* ==== INÍCIO BLOCO 03C — Constantes de duração ==== */
  /* ---- FUNÇÃO/CONST 03C.1 — DURATION_OPTIONS ---- */
  const DURATION_OPTIONS = [15, 20, 30, 45, 60];
  /* ---- FIM FUNÇÃO/CONST 03C.1 ---- */
/* ==== FIM BLOCO 03C — Constantes de duração ==== */


/* ==== INÍCIO BLOCO 03D — Metadata de estado ==== */
  /* ---- FUNÇÃO 03D.1 — statusMeta ---- */
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
  /* ---- FIM FUNÇÃO 03D.1 ---- */
/* ==== FIM BLOCO 03D — Metadata de estado ==== */

/* ==== INÍCIO BLOCO 03E — Estado global da app ==== */
  /* ---- FUNÇÃO/STATE 03E.1 — G ---- */
  var G = window.G = {
    sessionUser: null,
    role: null,
    clinics: [],
    clinicsById: {},
    agenda: { rows: [], timeColUsed: "start_at" },
    selectedDayISO: fmtDateISO(new Date()),
    calMonth: null,
    patientsById: {},
    patientQuick: { lastResults: [], selected: null },
    currentView: "agenda",
  };
  /* ---- FIM FUNÇÃO/STATE 03E.1 ---- */
/* ==== FIM BLOCO 03E — Estado global da app ==== */

/* ==== INÍCIO BLOCO 03F — Render shell (HTML + CSS) ==== */
  /* ---- FUNÇÃO 03F.1 — renderAppShell ---- */
  function renderAppShell() {
    const canSeeManagement = String(G.role || "").toLowerCase() === "doctor"
      || String(G.role || "").toLowerCase() === "superadmin";

    const currentView = String(G.currentView || "agenda").toLowerCase();
    const isManagementView = currentView === "management";

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
        .gcBtnPrimary:hover {
          filter: brightness(0.96);
        }
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

        .gcStatusSelect{
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

        @media (max-width: 980px){
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
  }
  /* ---- FIM FUNÇÃO 03F.1 ---- */
/* ==== FIM BLOCO 03F — Render shell (HTML + CSS) ==== */

/* ==== INÍCIO BLOCO 03G — Header shell: preenchimento de sessão ==== */
  /* ---- FUNÇÃO 03G.1 — hydrateShellHeader ---- */
  function hydrateShellHeader() {
    const hdrEmail = document.getElementById("hdrEmail");
    if (hdrEmail) hdrEmail.textContent = G.sessionUser && G.sessionUser.email ? G.sessionUser.email : "—";

    const hdrRole = document.getElementById("hdrRole");
    if (hdrRole) hdrRole.textContent = G.role ? G.role : "—";

    const hdrClinicCount = document.getElementById("hdrClinicCount");
    if (hdrClinicCount) hdrClinicCount.textContent = String(Array.isArray(G.clinics) ? G.clinics.length : 0);
  }
  /* ---- FIM FUNÇÃO 03G.1 ---- */
/* ==== FIM BLOCO 03G — Header shell: preenchimento de sessão ==== */

/* ==== FIM BLOCO 03/12 — Constantes (procedimentos/status) + estado global + render shell (HTML+CSS) ==== */

/* ========================================================
   BLOCO 04/12 — Helpers UI Agenda + abrir doente + update status + renderAgendaList
   MAPA DE NAVEGAÇÃO
   --------------------------------------------------------
   04A — Helpers UI da agenda
   04B — Abertura de doente
   04C — Atualização de estado de marcação
   04D — Impressão da agenda do dia
   04E — Render da lista da agenda
   ======================================================== */

/* ==== INÍCIO BLOCO 04A — Helpers UI da agenda ==== */
  /* ---- FUNÇÃO 04A.1 — setAgendaSubtitleForSelectedDay ---- */
  function setAgendaSubtitleForSelectedDay() {
    const r = isoLocalDayRangeFromISODate(G.selectedDayISO);
    const sub = document.getElementById("agendaSubtitle");
    if (!sub || !r) return;
    sub.textContent = `${fmtDatePt(r.start)} (00:00–24:00)`;
  }
  /* ---- FIM FUNÇÃO 04A.1 ---- */

  /* ---- FUNÇÃO 04A.2 — setAgendaStatus ---- */
  function setAgendaStatus(kind, text) {
    const el = document.getElementById("agendaStatus");
    if (!el) return;

    const color = kind === "loading" ? "#666" : kind === "error" ? "#b00020" : kind === "ok" ? "#111" : "#666";
    el.innerHTML = `<div style="font-size:${UI.fs12}px; color:${color};">${escapeHtml(text)}</div>`;
  }
  /* ---- FIM FUNÇÃO 04A.2 ---- */

  /* ---- FUNÇÃO 04A.3 — renderClinicsSelect ---- */
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
  /* ---- FIM FUNÇÃO 04A.3 ---- */

  /* ---- FUNÇÃO 04A.4 — getPatientForAppointmentRow ---- */
  function getPatientForAppointmentRow(apptRow) {
    const pid = apptRow && apptRow.patient_id ? apptRow.patient_id : null;
    if (!pid) return null;
    return G.patientsById && G.patientsById[pid] ? G.patientsById[pid] : null;
  }
  /* ---- FIM FUNÇÃO 04A.4 ---- */

  /* ---- FUNÇÃO 04A.5 — apptStatusMeta ---- */
  // ✅ Meta do "estado" com prioridade ao mode (bloqueio NÃO depende de status)
  function apptStatusMeta(apptRow) {
    try {
      const mode = String(apptRow?.mode || "").toLowerCase();
      if (mode === "bloqueio") {
        return { icon: "⛔", label: "Bloqueio", bg: "#f3f4f6", fg: "#111827", br: "#d1d5db" };
      }
    } catch (_) {}
    return statusMeta(apptRow?.status ?? "scheduled");
  }
  /* ---- FIM FUNÇÃO 04A.5 ---- */
/* ==== FIM BLOCO 04A — Helpers UI da agenda ==== */


/* ==== INÍCIO BLOCO 04B — Abertura de doente ==== */
  /* ---- FUNÇÃO 04B.1 — openPatientFeedFromAny ---- */
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
  /* ---- FIM FUNÇÃO 04B.1 ---- */
/* ==== FIM BLOCO 04B — Abertura de doente ==== */


/* ==== INÍCIO BLOCO 04C — Atualização de estado de marcação ==== */
  /* ---- FUNÇÃO 04C.1 — updateAppointmentStatus ---- */
  async function updateAppointmentStatus(apptId, newStatus) {
    if (!apptId) return;
    const raw = String(newStatus || "").trim().toLowerCase();
    if (!raw) return;

    const idx = (G.agenda.rows || []).findIndex((x) => x && x.id === apptId);
    if (idx >= 0) {
      // ✅ Bloqueios não permitem mudança de "status"
      const row = G.agenda.rows[idx];
      if (String(row?.mode || "").toLowerCase() === "bloqueio") {
        alert("Este registo é um bloqueio. Não é permitido alterar o estado.");
        renderAgendaList();
        return;
      }
    }

    // ✅ Regra fechada: “Faltou/Cancelou” grava SEMPRE no_show
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
  /* ---- FIM FUNÇÃO 04C.1 ---- */
/* ==== FIM BLOCO 04C — Atualização de estado de marcação ==== */


/* ==== INÍCIO BLOCO 04D — Impressão da agenda do dia ==== */
  /* ---- FUNÇÃO 04D.1 — __gcGetSelectedDayLabelForPrint ---- */
  function __gcGetSelectedDayLabelForPrint() {
    try {
      const iso = String(G.selectedDayISO || "").trim(); // YYYY-MM-DD
      if (!iso) return "";
      const d = new Date(`${iso}T00:00:00`);
      if (isNaN(d.getTime())) return iso;
      return fmtDatePt(d);
    } catch (_) {
      return String(G.selectedDayISO || "");
    }
  }
  /* ---- FIM FUNÇÃO 04D.1 ---- */

  /* ---- FUNÇÃO 04D.2 — __gcBuildAgendaPrintHtml ---- */
  function __gcBuildAgendaPrintHtml(rows) {
    const dayLabel = __gcGetSelectedDayLabelForPrint();
    const clinicFilter = (() => {
      try {
        const cid = document.getElementById("selClinic")?.value || "";
        if (!cid) return "Todas as clínicas";
        const c = G.clinicsById && G.clinicsById[cid] ? G.clinicsById[cid] : null;
        return (c && (c.name || c.slug)) ? (c.name || c.slug) : cid;
      } catch (_) {
        return "";
      }
    })();

    const timeColUsed = G.agenda.timeColUsed || "start_at";

    const rowsHtml = (rows || []).map((r) => {
      const startVal = r[timeColUsed] ?? r[pickFirstExisting(r, APPT_TIME_COL_CANDIDATES)];
      const endVal = r[pickFirstExisting(r, APPT_END_COL_CANDIDATES)];

      const start = startVal ? new Date(startVal) : null;
      const end = endVal ? new Date(endVal) : null;

      const tStart = fmtTime(start);
      const tEnd = end ? fmtTime(end) : null;
      const timeTxt = `${tStart}${tEnd ? `–${tEnd}` : ""}`;

      const clinicId = r.clinic_id ?? null;
      const isGlobalBlock = String(r?.mode || "").toLowerCase() === "bloqueio" && !clinicId;

      const clinicName =
        isGlobalBlock
          ? "GLOBAL"
          : (clinicId && G.clinicsById[clinicId]
              ? G.clinicsById[clinicId].name || G.clinicsById[clinicId].slug || clinicId
              : clinicId || "—");

      const proc = r.procedure_type ?? "—";

      const meta = apptStatusMeta(r);
      const statusTxt = `${meta.icon} ${meta.label}`;

      const p = getPatientForAppointmentRow(r);
      const patientName = p && p.full_name ? p.full_name : (r.patient_id ? `Doente (ID): ${r.patient_id}` : "—");
      const patientPhone = p && p.phone ? p.phone : "—";

      // ✅ Campos administrativos (patients)
      const nif = p && p.nif ? p.nif : "";
      const sns = p && p.sns ? p.sns : "";
      const address = p && p.address_line1 ? p.address_line1 : "";
      const postal = p && p.postal_code ? p.postal_code : "";
      const city = p && p.city ? p.city : "";
      const insurer = p && p.insurance_provider ? p.insurance_provider : "";
      const policy = p && p.insurance_policy_number ? p.insurance_policy_number : "";

      // ✅ Morada numa linha base: "Rua..., 2000-000 Cidade"
      const addrLine = (() => {
        const a = String(address || "").trim();
        const pc = String(postal || "").trim();
        const c = String(city || "").trim();
        const tail = `${pc}${pc && c ? " " : ""}${c}`.trim();
        return `${a}${a && tail ? ", " : ""}${tail}`.trim();
      })();

      // ✅ Seguro numa linha: "Seguradora - nº"
      const insLine = (() => {
        const i = String(insurer || "").trim();
        const pol = String(policy || "").trim();
        if (!i && !pol) return "";
        return `${i}${i && pol ? " - " : ""}${pol}`.trim();
      })();

      return `
        <tr>
          <td class="c-time">${escapeHtml(timeTxt)}</td>
          <td class="c-name">${escapeHtml(patientName)}</td>
          <td class="c-type">${escapeHtml(proc)}</td>
          <td class="c-status">${escapeHtml(statusTxt)}</td>
          <td class="c-phone">${escapeHtml(patientPhone)}</td>
          <td class="c-clinic">${escapeHtml(clinicName)}</td>

          <td class="c-nif">${escapeHtml(nif || "—")}</td>
          <td class="c-addr">${escapeHtml(addrLine || "—")}</td>
          <td class="c-sns">${escapeHtml(sns || "—")}</td>
          <td class="c-ins">${escapeHtml(insLine || "—")}</td>
        </tr>
      `;
    }).join("");

    const safeTitle = `Agenda — ${dayLabel || "Dia"} — ${clinicFilter || ""}`.trim();

    return `
<!doctype html>
<html lang="pt-PT">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(safeTitle)}</title>
  <style>
    body{ font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif; margin:24px; color:#111; }
    h1{ font-size:18px; margin:0 0 6px 0; font-weight:900; }
    .sub{ color:#555; font-size:12px; margin:0 0 14px 0; }

    /* ✅ Permitir wrap e leitura */
    table{ width:100%; border-collapse:collapse; table-layout:fixed; }
    th, td{ border:1px solid #e5e5e5; padding:7px 8px; font-size:12px; vertical-align:top; line-height:1.25; }
    th{ background:#f6f6f6; text-align:left; font-weight:800; }

    /* Colunas “curtas” */
    .c-time{ width:70px; white-space:nowrap; font-weight:800; }
    .c-type{ width:95px; }
    .c-status{ width:110px; white-space:nowrap; }
    .c-phone{ width:95px; white-space:nowrap; }
    .c-clinic{ width:80px; }
    .c-nif{ width:90px; white-space:nowrap; }
    .c-sns{ width:95px; white-space:nowrap; }
    .c-ins{ width:160px; }

    /* ✅ Nome e Morada: 2+ linhas quando necessário (sem reticências) */
    .c-name{
      width:240px;
      font-weight:800;
      white-space:normal;
      overflow:visible;
      text-overflow:clip;
      word-break:break-word;
      overflow-wrap:anywhere;
    }

    .c-addr{
      width:320px;
      white-space:normal;
      overflow:visible;
      text-overflow:clip;
      word-break:break-word;
      overflow-wrap:anywhere;
    }

    @media print{
      body{ margin:10mm; }
    }
  </style>
</head>
<body>
  <h1>Agenda do dia — ${escapeHtml(dayLabel || "—")}</h1>
  <div class="sub">${escapeHtml(clinicFilter || "")}</div>

  <table>
    <thead>
      <tr>
        <th>Horário</th>
        <th>Nome</th>
        <th>Tipo</th>
        <th>Estado</th>
        <th>Telefone</th>
        <th>Clínica</th>
        <th>NIF</th>
        <th>Morada (CP Localidade)</th>
        <th>SNS</th>
        <th>Seguro</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || ""}
    </tbody>
  </table>
</body>
</html>
    `;
  }
  /* ---- FIM FUNÇÃO 04D.2 ---- */

  /* ---- FUNÇÃO 04D.3 — __gcPrintAgendaDay ---- */
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
      setTimeout(() => {
        try { w.print(); } catch (_) {}
      }, 250);
    } catch (e) {
      console.error(e);
      alert("Erro ao preparar impressão. Vê a consola para detalhe.");
    }
  }
  /* ---- FIM FUNÇÃO 04D.3 ---- */
/* ==== FIM BLOCO 04D — Impressão da agenda do dia ==== */


/* ==== INÍCIO BLOCO 04E — Render da lista da agenda ==== */
  /* ---- FUNÇÃO 04E.1 — renderAgendaList ---- */
  // ✅ Agenda em grelha com cabeçalho único + 1 linha por marcação (sem labels repetidos)
  function renderAgendaList() {
    const ul = document.getElementById("agendaList");
    if (!ul) return;

    const rows = G.agenda.rows || [];
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
          .gcAgendaGrid{
            display:grid;
            grid-template-columns: 110px 2.4fr 0.9fr 160px 120px 140px;
            column-gap: 16px;
            align-items: center;
            width:100%;
          }
          .gcAgendaHeader .gcAgendaH{
            font-size:${UI.fs12}px;
            color:#666;
            font-weight:700;
            letter-spacing:.2px;
            text-transform:none;
          }
          .gcAgendaRow{
            padding:10px 0;
            border-bottom:1px solid #f2f2f2;
          }
          .gcAgendaRow:hover{
            background:#f8f8f8;
            border-radius:10px;
          }
          .gcAgendaTime{
            font-size:${UI.fs14}px;
            font-weight:800;
            color:#111;
            white-space:nowrap;
          }
          .gcAgendaNameWrap{ min-width:0; }
          .gcAgendaNameText{
            display:block;
            min-width:0;
            font-size:${UI.fs14}px;
            font-weight:800;
            color:#111;
            white-space:nowrap;
            overflow:hidden;
            text-overflow:ellipsis;
          }
          .gcAgendaNotesBelow{
            display:block;
            margin-top:4px;
            min-width:0;
            font-size:${UI.fs12}px;
            color:#666;
            white-space:nowrap;
            overflow:hidden;
            text-overflow:ellipsis;
          }
          .gcAgendaCell{
            min-width:0;
            font-size:${UI.fs12}px;
            color:#111;
            white-space:nowrap;
            overflow:hidden;
            text-overflow:ellipsis;
          }
          .gcAgendaCellType{ padding-left:8px; }
          .gcAgendaStatusWrap{ min-width:0; }
          .gcStatusSelect{
            width:100%;
            max-width:100%;
            min-width:0;
            font-size:${UI.fs12}px;
            font-weight:800;
            padding:6px 10px;
            border-radius:999px;
            border:1px solid #ddd;
            outline:none;
            white-space:nowrap;
            overflow:hidden;
            text-overflow:ellipsis;
          }
          .gcStatusSelect:disabled{ opacity:0.75; cursor:not-allowed; }
          .gcAgendaFooter{
            margin-top:12px;
            padding-top:12px;
            border-top:1px dashed #e5e5e5;
            display:flex;
            justify-content:flex-end;
          }
        </style>
      </li>
    `;

    const body = rows.map((r) => {
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

      const meta = apptStatusMeta(r);

      const proc = r.procedure_type ?? "—";
      const notes = r.notes ? clipOneLine(r.notes, 140) : "";

      const p = getPatientForAppointmentRow(r);
      const patientName = p && p.full_name ? p.full_name : (r.patient_id ? `Doente (ID): ${r.patient_id}` : "—");
      const patientPhone = p && p.phone ? p.phone : "—";

      const isBlock = String(r?.mode || "").toLowerCase() === "bloqueio";

      function optLabel(s) {
        const m = statusMeta(s);
        return `${m.icon} ${m.label}`;
      }

      const timeTxt = `${tStart}${tEnd ? `–${tEnd}` : ""}`;

      const statusSelectHtml = isBlock
        ? `
          <select data-status-select="1"
                  class="gcStatusSelect"
                  disabled
                  style="background:${escapeHtml(meta.bg)}; color:${escapeHtml(meta.fg)}; border-color:${escapeHtml(meta.br)};"
                  title="Bloqueio (não editável)">
            <option value="bloqueio" selected>${escapeHtml(meta.icon + " " + meta.label)}</option>
          </select>
        `
        : `
          <select data-status-select="1"
                  class="gcStatusSelect"
                  style="background:${escapeHtml(meta.bg)}; color:${escapeHtml(meta.fg)}; border-color:${escapeHtml(meta.br)};"
                  title="Clique para alterar estado">
            ${STATUS_OPTIONS.map((s) => {
              const val = (s === "cancelled") ? "no_show" : s;
              const sel = (val === String(r.status ?? "scheduled").toLowerCase()) ? " selected" : "";
              return `<option value="${escapeHtml(val)}"${sel}>${escapeHtml(optLabel(val))}</option>`;
            }).join("")}
          </select>
        `;

      return `
        <li data-appt-id="${escapeHtml(r.id)}" class="gcAgendaRow">
          <div class="gcAgendaGrid">
            <div class="gcAgendaTime">${escapeHtml(timeTxt)}</div>

            <div class="gcAgendaNameWrap">
              ${isBlock
                ? `<span class="gcAgendaNameText">${escapeHtml("—")}</span>`
                : `<span data-patient-open="1" class="gcPatientLink gcAgendaNameText">${escapeHtml(patientName)}</span>`
              }
              ${notes ? `<span class="gcAgendaNotesBelow">Notas: ${escapeHtml(notes)}</span>` : ``}
            </div>

            <div class="gcAgendaCell gcAgendaCellType" title="${escapeHtml(proc)}">${escapeHtml(proc)}</div>

            <div class="gcAgendaStatusWrap">
              ${statusSelectHtml}
            </div>

            <div class="gcAgendaCell" title="${escapeHtml(patientPhone)}">${escapeHtml(patientPhone)}</div>

            <div class="gcAgendaCell" title="${escapeHtml(clinicName)}">${escapeHtml(clinicName)}</div>
          </div>
        </li>
      `;
    }).join("");

    const footer = `
      <li style="padding:10px 0 0 0;">
        <div class="gcAgendaFooter">
          <button id="btnPrintAgendaDay" class="gcBtn" type="button" style="font-weight:900;">
            Imprimir lista do dia
          </button>
        </div>
      </li>
    `;

    ul.innerHTML = header + body + footer;

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

    const btn = document.getElementById("btnPrintAgendaDay");
    if (btn) {
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        __gcPrintAgendaDay();
      });
    }
  }
  /* ---- FIM FUNÇÃO 04E.1 ---- */
/* ==== FIM BLOCO 04E — Render da lista da agenda ==== */

/* ==== FIM BLOCO 04/12 — Helpers UI Agenda + abrir doente + update status + renderAgendaList ==== */
/* ========================================================
   BLOCO 05/12 — Pesquisa rápida (main) + utilitários de modal doente + validação
   MAPA DE NAVEGAÇÃO
   --------------------------------------------------------
   05A — Mensagens e seleção da pesquisa rápida
   05B — Render dos resultados da pesquisa rápida
   05C — Utilitários do modal
   05D — Validação de edição do doente
   ======================================================== */

/* ==== INÍCIO BLOCO 05A — Mensagens e seleção da pesquisa rápida ==== */
  /* ---- FUNÇÃO 05A.1 — setQuickPatientMsg ---- */
  function setQuickPatientMsg(kind, text) {
    const el = document.getElementById("pQuickMsg");
    if (!el) return;
    const color = kind === "error" ? "#b00020" : kind === "ok" ? "#111" : "#666";
    el.style.color = color;
    el.textContent = text || "";
  }
  /* ---- FIM FUNÇÃO 05A.1 ---- */

  /* ---- FUNÇÃO 05A.2 — renderQuickPatientSelected ---- */
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
  /* ---- FIM FUNÇÃO 05A.2 ---- */
/* ==== FIM BLOCO 05A — Mensagens e seleção da pesquisa rápida ==== */


/* ==== INÍCIO BLOCO 05B — Render dos resultados da pesquisa rápida ==== */
  /* ---- FUNÇÃO 05B.1 — renderQuickPatientResults ---- */
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
  /* ---- FIM FUNÇÃO 05B.1 ---- */
/* ==== FIM BLOCO 05B — Render dos resultados da pesquisa rápida ==== */


/* ==== INÍCIO BLOCO 05C — Utilitários do modal ==== */
  /* ---- FUNÇÃO 05C.1 — closeModalRoot ---- */
  function closeModalRoot() {
    const root = document.getElementById("modalRoot");
    if (root) root.innerHTML = "";
  }
  /* ---- FIM FUNÇÃO 05C.1 ---- */
/* ==== FIM BLOCO 05C — Utilitários do modal ==== */


/* ==== INÍCIO BLOCO 05D — Validação de edição do doente ==== */
  /* ---- FUNÇÃO 05D.1 — validatePatientEdit ---- */
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
  /* ---- FIM FUNÇÃO 05D.1 ---- */
/* ==== FIM BLOCO 05D — Validação de edição do doente ==== */

/* ==== FIM BLOCO 05/12 — Pesquisa rápida (main) + utilitários de modal doente + validação ==== */

/* ==== INÍCIO BLOCO 06/12 — Modal Doente (06A–06J) ==== */

/* ========================================================
   BLOCO 06/12 — Modal Doente
   MAPA DE NAVEGAÇÃO
   --------------------------------------------------------
   06A — Stub (mantido; não usado)
   06B — Bootstrap + State + Helpers base
   06C — Identificação do doente
   06D — Diagnósticos
   06E — Tratamentos
   06Fa — Documentos/PDF (config + helpers + load + clinic + template)
   06Fb — Documentos/PDF (editor + bind)
   06Fc — Documentos/PDF (storage + generate + exports)
   06G — Timeline (load + render + physio_records)
   06H — Consulta médica (UI HDA + Quill + spellcheck)
   06I — saveConsult (insert + upsert ligações + reset)
   06J — Render + wiring + boot
   ======================================================== */

/* ==== INÍCIO BLOCO 06A/12 — Stub (mantido; não usado) ==== */
/*
  06A/12 — Mantido apenas como “stub” histórico.
  IMPORTANTE: O modal REAL é o openPatientViewModal (06B–06J).
*/
/* ---- FUNÇÃO 06A.1 — openPatientViewModal__stub ---- */
function openPatientViewModal__stub(patient) {
  const root = document.getElementById("modalRoot");
  if (!root || !patient) return;
  const p = patient;

  let activeClinicId = null;

  function role() { return String(G.role || "").toLowerCase(); }
  function isDoctor() { return role() === "doctor"; }

  async function fetchActiveClinic() {
    const { data, error } = await window.sb
      .from("patient_clinic")
      .select("clinic_id")
      .eq("patient_id", p.id)
      .eq("is_active", true)
      .limit(1);

    if (error) { console.error(error); activeClinicId = null; return; }
    activeClinicId = data && data.length ? data[0].clinic_id : null;
  }

  fetchActiveClinic().then(() => { renderFeed(); });

  function renderFeed() {}
  function openConsultForm() {}
  async function saveConsult() {}
}
/* ---- FIM FUNÇÃO 06A.1 ---- */
/* ==== FIM BLOCO 06A/12 — Stub (mantido; não usado) ==== */


/* ==== INÍCIO BLOCO 06B/12 — Bootstrap + State + Helpers base (role/close/fetch/escape/format) ==== */

/* ---- FUNÇÃO 06B.1 — openPatientViewModal ---- */
function openPatientViewModal(patient) {

  console.log("06B openPatientViewModal OK", patient);

  const root = document.getElementById("modalRoot");
  if (!root || !patient) return;

  const p = patient;

  /* ================= STATE ================= */
  let activeClinicId = null;
  let activeClinicName = "";     // ✅ usado no cabeçalho (Telefone → Clínica)

  let creatingConsult = false;
let editingConsultId = null;
let editingConsultRow = null;

  let timelineLoading = false;
  let consultRows = [];          // rows enriquecidas com author_name + diagnoses[] + treatments[]
  let saving = false;

  let lastSavedConsultId = null; // consultId da última consulta gravada

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
  let docMode = "visual";        // "visual" | "html" | "preview"
  let docSaving = false;
  let docDraftHtml = "";         // HTML editável do documento v1
  let docTitle = "Relatório Médico";
  let docsLoading = false;
  let docRows = [];              // [{id, created_at, title, consultation_id, storage_path, url, version}]

  /* ================= ROLE ================= */
  /* ---- FUNÇÃO 06B.2 — role ---- */
  function role() { return String(G.role || "").toLowerCase(); }
  /* ---- FIM FUNÇÃO 06B.2 ---- */

  /* ---- FUNÇÃO 06B.3 — isDoctor ---- */
  function isDoctor() { return role() === "doctor"; }
  /* ---- FIM FUNÇÃO 06B.3 ---- */

  /* ================= SAFE CLOSE ================= */
  /* ---- FUNÇÃO 06B.4 — closeModalSafe ---- */
  const closeModalSafe = () => {
    try {
      if (typeof closeModalRoot === "function") return closeModalRoot();
    } catch (e) {}
    try { root.innerHTML = ""; } catch (e2) {}
  };
  /* ---- FIM FUNÇÃO 06B.4 ---- */

  /* ================= DATA: Clínica ativa (id + nome) ================= */
  /* ---- FUNÇÃO 06B.5 — fetchActiveClinic ---- */
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
      activeClinicName = "";
      return;
    }

    activeClinicId = data && data.length ? data[0].clinic_id : null;
    activeClinicName = "";

    if (activeClinicId) {
      try {
        const { data: c, error: cErr } = await window.sb
          .from("clinics")
          .select("name")
          .eq("id", activeClinicId)
          .single();

        if (cErr) console.error(cErr);
        activeClinicName = (c && c.name) ? String(c.name) : "";
      } catch (e) {
        console.error(e);
        activeClinicName = "";
      }
    }
  }
  /* ---- FIM FUNÇÃO 06B.5 ---- */

  /* ---- FUNÇÃO 06B.6 — getTreatOrderFromPlan ---- */
  function getTreatOrderFromPlan(planText) {
    try {
      const o = JSON.parse(planText || "");
      const arr = o && Array.isArray(o.treat_order) ? o.treat_order : null;
      return arr && arr.length ? arr.map(String) : null;
    } catch (e) {
      return null;
    }
  }
  /* ---- FIM FUNÇÃO 06B.6 ---- */

  /* ---- FUNÇÃO 06B.7 — getPrescriptionTextFromPlan ---- */
  function getPrescriptionTextFromPlan(planText) {
    try {
      const o = JSON.parse(planText || "");
      const t = o && typeof o.prescriptionText === "string" ? o.prescriptionText : "";
      return t || "";
    } catch (e) {
      return "";
    }
  }
  /* ---- FIM FUNÇÃO 06B.7 ---- */

  /* ================= SANITIZE/ESC ================= */
  /* ---- FUNÇÃO 06B.8 — sanitizeHTML ---- */
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
  /* ---- FIM FUNÇÃO 06B.8 ---- */

  /* ---- FUNÇÃO 06B.9 — escAttr ---- */
  function escAttr(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }
  /* ---- FIM FUNÇÃO 06B.9 ---- */

  /* ================= CABEÇALHO (idade/🎂) ================= */
  /* ---- FUNÇÃO 06B.10 — ageTextToday ---- */
  function ageTextToday() {
    try {
      const age = calcAgeYears ? calcAgeYears(p.dob, new Date()) : null;
      if (age === null || age === undefined) return "—";
      return `${age} anos`;
    } catch (e) { return "—"; }
  }
  /* ---- FIM FUNÇÃO 06B.10 ---- */

  /* ---- FUNÇÃO 06B.11 — birthdayBadgeToday ---- */
  function birthdayBadgeToday() {
    try {
      const isBday = isBirthdayOnDate ? isBirthdayOnDate(p.dob, new Date()) : false;
      return isBday ? `<span title="Faz anos hoje" style="margin-left:8px;">🎂</span>` : ``;
    } catch (e) { return ``; }
  }
  /* ---- FIM FUNÇÃO 06B.11 ---- */
/* ==== FIM BLOCO 06B/12 — Bootstrap + State + Helpers base (role/close/fetch/escape/format) ==== */


/* ==== INÍCIO BLOCO 06C/12 — Identificação do doente (modal ver/editar) — SEXO REMOVIDO ==== */

  /* ---- FUNÇÃO 06C.1 — openPatientIdentity ---- */
  function openPatientIdentity(mode) {
    identMode = mode === "edit" ? "edit" : "view";
    identOpen = true;
    identSaving = false;

    identDraft = {
      full_name: p.full_name || "",
      dob: p.dob || "",
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
      notes: p.notes || "",
      active_clinic_id: activeClinicId || ""
    };

    render();
    bindIdentityEvents();
  }
  /* ---- FIM FUNÇÃO 06C.1 ---- */

  /* ---- FUNÇÃO 06C.2 — closeIdentity ---- */
  function closeIdentity() {
    identOpen = false;
    identSaving = false;
    render();
  }
  /* ---- FIM FUNÇÃO 06C.2 ---- */

  /* ---- FUNÇÃO 06C.3 — renderIdentityModal ---- */
  function renderIdentityModal() {
    const ro = (identMode !== "edit") ? "readonly" : "";
    const dis = (identMode !== "edit") ? "disabled" : "";
    const canEdit = (identMode === "edit");
    const canManageClinic = role() === "doctor" || role() === "superadmin";
    const canOpenEdit = canManageClinic;
    const visibleClinics = Array.isArray(G.clinics) ? G.clinics : [];
    const currentClinicId = String(identDraft.active_clinic_id || activeClinicId || "");
    const currentClinicName = activeClinicName || "—";

    return `
      <div id="identOverlay"
           style="position:fixed; inset:0; background:rgba(0,0,0,0.35);
                  display:flex; align-items:center; justify-content:center; padding:12px; z-index:2000;">
        <div style="background:#fff; width:min(980px,96vw);
                    max-height:92vh; overflow:auto;
                    border-radius:14px; border:1px solid #e5e5e5; padding:16px;">

          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
            <div style="font-weight:900; font-size:16px;">
              Identificação do doente ${canEdit ? "(editar)" : "(ver)"}
            </div>

            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              ${!canEdit && canOpenEdit ? `
                <button id="btnIdentEditTop" class="gcBtn" style="font-weight:900;">Editar</button>
              ` : ``}
              <button id="btnIdentCloseTop" class="gcBtn">Fechar</button>
            </div>
          </div>

          <div style="margin-top:12px; padding:12px; border:1px solid #e5e7eb; border-radius:12px; background:#f8fafc;">
            <div style="font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; color:#64748b; margin-bottom:8px;">
              Clínica ativa
            </div>

            ${canManageClinic && canEdit ? `
              <select id="id_active_clinic"
                      style="width:100%; padding:10px; border:1px solid #ddd; border-radius:10px; background:#fff;">
                <option value="">Selecionar clínica…</option>
                ${visibleClinics.map((c) => `
                  <option value="${escAttr(c.id)}" ${String(c.id) === currentClinicId ? "selected" : ""}>
                    ${escAttr(c.name || c.slug || c.id)}
                  </option>
                `).join("")}
              </select>
              <div style="margin-top:6px; font-size:12px; color:#64748b;">
                A alteração da clínica ativa será gravada com a identificação.
              </div>
            ` : `
              <div style="padding:10px 12px; border:1px solid #ddd; border-radius:10px; background:#fff; color:#111827;">
                ${escAttr(currentClinicName)}
              </div>
            `}
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
  /* ---- FIM FUNÇÃO 06C.3 ---- */

  /* ---- FUNÇÃO 06C.4 — bindIdentityEvents ---- */
  function bindIdentityEvents() {
    const closeTop = document.getElementById("btnIdentCloseTop");
    if (closeTop) closeTop.onclick = () => closeIdentity();

    const btnEditTop = document.getElementById("btnIdentEditTop");
    if (btnEditTop) {
      btnEditTop.onclick = () => openPatientIdentity("edit");
    }

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

    const selClinic = document.getElementById("id_active_clinic");
    if (selClinic) {
      selClinic.onchange = (e) => {
        identDraft.active_clinic_id = e?.target?.value ?? "";
      };
    }

    const btnSave = document.getElementById("btnIdentSave");
    if (btnSave) {
      btnSave.disabled = identSaving || identMode !== "edit";
      btnSave.onclick = async () => {
        if (identSaving || identMode !== "edit") return;

        const name = String(identDraft.full_name || "").trim();
        if (!name) { alert("Nome completo é obrigatório."); return; }

        const canManageClinic = role() === "doctor" || role() === "superadmin";
        const nextClinicId = String(identDraft.active_clinic_id || "").trim();
        const currentClinicId = String(activeClinicId || "").trim();
        const clinicChanged = !!(canManageClinic && nextClinicId && nextClinicId !== currentClinicId);

        identSaving = true;
        render();
        bindIdentityEvents();

        try {
          const payload = {
            full_name: name,
            dob: identDraft.dob ? identDraft.dob : null,
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

          if (data) Object.keys(payload).forEach(k => { p[k] = data[k]; });

          if (clinicChanged) {
            await ensurePatientActiveInClinic({
              patientId: p.id,
              targetClinicId: nextClinicId
            });

            await fetchActiveClinic();
            identDraft.active_clinic_id = activeClinicId || nextClinicId || "";
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
  /* ---- FIM FUNÇÃO 06C.4 ---- */
/* ==== FIM BLOCO 06C/12 — Identificação do doente (modal ver/editar) — SEXO REMOVIDO ==== */

/* ==== INÍCIO BLOCO 06D/12 — Diagnósticos (pesquisa catálogo + chips + adicionar ao catálogo) ==== */

  // ---- Mini-modal: adicionar diagnóstico ao catálogo ----
  let diagAddOpen = false;
  let diagAddSaving = false;
  let diagAddErr = "";
  let diagAddSystem = "local";
  let diagAddCode = "";
  let diagAddLabel = "";

  /* ---- FUNÇÃO 06D.1 — ensureDiagAddHost ---- */
  function ensureDiagAddHost() {
    let host = document.getElementById("diagAddModalHost");
    if (!host) {
      host = document.createElement("div");
      host.id = "diagAddModalHost";
      document.body.appendChild(host);
    }
    return host;
  }
  /* ---- FIM FUNÇÃO 06D.1 ---- */

  /* ---- FUNÇÃO 06D.2 — openDiagAddModal ---- */
  function openDiagAddModal(prefillLabel = "", prefillCode = "") {
    diagAddErr = "";
    diagAddSystem = "local";
    diagAddLabel = String(prefillLabel || "").trim();
    diagAddCode = String(prefillCode || "").trim();
    diagAddOpen = true;
    diagAddSaving = false;
    renderDiagAddModal();
    setTimeout(() => {
      document.getElementById("diagAddLabel")?.focus();
    }, 0);
  }
  /* ---- FIM FUNÇÃO 06D.2 ---- */

  /* ---- FUNÇÃO 06D.3 — closeDiagAddModal ---- */
  function closeDiagAddModal() {
    diagAddOpen = false;
    diagAddSaving = false;
    diagAddErr = "";
    renderDiagAddModal();
  }
  /* ---- FIM FUNÇÃO 06D.3 ---- */

  /* ---- FUNÇÃO 06D.4 — renderDiagAddModal ---- */
  function renderDiagAddModal() {
    const host = ensureDiagAddHost();
    if (!diagAddOpen) {
      host.innerHTML = "";
      return;
    }

    host.innerHTML = `
      <div style="position:fixed; inset:0; z-index:9999; background:rgba(15,23,42,0.45);
                  display:flex; align-items:center; justify-content:center; padding:16px;">
        <div style="width: min(720px, 96vw); background:#fff; border:1px solid #e5e5e5; border-radius:16px;
                    box-shadow:0 18px 44px rgba(0,0,0,0.18); overflow:hidden;">
          <div style="padding:14px 16px; border-bottom:1px solid #f1f5f9; display:flex; align-items:center; justify-content:space-between;">
            <div style="font-weight:900;">Adicionar diagnóstico ao catálogo</div>
            <button id="diagAddClose" class="gcBtn" style="padding:8px 10px; border-radius:10px;">Fechar</button>
          </div>

          <div style="padding:16px;">
            ${diagAddErr ? `<div style="margin-bottom:10px; padding:10px 12px; border:1px solid #fecaca; background:#fff1f2; color:#991b1b; border-radius:12px;">
              ${escAttr(diagAddErr)}
            </div>` : ``}

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
              <div>
                <div style="font-size:12px; color:#64748b; margin-bottom:6px;">Sistema</div>
                <input id="diagAddSystem" value="${escAttr(diagAddSystem)}"
                       class="gcInput" style="width:100%;" />
                <div style="font-size:11px; color:#94a3b8; margin-top:6px;">Ex.: local</div>
              </div>
              <div>
                <div style="font-size:12px; color:#64748b; margin-bottom:6px;">Código</div>
                <input id="diagAddCode" value="${escAttr(diagAddCode)}"
                       class="gcInput" style="width:100%;" />
                <div style="font-size:11px; color:#94a3b8; margin-top:6px;">Obrigatório (podes usar um código interno)</div>
              </div>
            </div>

            <div style="margin-top:10px;">
              <div style="font-size:12px; color:#64748b; margin-bottom:6px;">Designação</div>
              <input id="diagAddLabel" value="${escAttr(diagAddLabel)}"
                     class="gcInput" style="width:100%;" />
            </div>

            <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:14px;">
              <button id="diagAddCancel" class="gcBtn" style="padding:10px 12px; border-radius:12px;">Cancelar</button>
              <button id="diagAddSave" class="gcBtnPrimary" style="padding:10px 12px; border-radius:12px; min-width:140px;">
                ${diagAddSaving ? "A gravar…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById("diagAddClose")?.addEventListener("click", (ev) => { ev.preventDefault(); closeDiagAddModal(); });
    document.getElementById("diagAddCancel")?.addEventListener("click", (ev) => { ev.preventDefault(); closeDiagAddModal(); });

    document.getElementById("diagAddSave")?.addEventListener("click", async (ev) => {
      ev.preventDefault();
      await saveDiagToCatalog();
    });

    // Enter para guardar (se não estiver a gravar)
    ["diagAddSystem","diagAddCode","diagAddLabel"].forEach(id => {
      document.getElementById(id)?.addEventListener("keydown", async (e) => {
        if (e.key === "Enter" && !diagAddSaving) {
          e.preventDefault();
          await saveDiagToCatalog();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          closeDiagAddModal();
        }
      });
    });
  }
  /* ---- FIM FUNÇÃO 06D.4 ---- */

  /* ---- FUNÇÃO 06D.5 — saveDiagToCatalog ---- */
  async function saveDiagToCatalog() {
    if (diagAddSaving) return;

    const sys = String(document.getElementById("diagAddSystem")?.value || "").trim();
    const code = String(document.getElementById("diagAddCode")?.value || "").trim();
    const label = String(document.getElementById("diagAddLabel")?.value || "").trim();

    if (!sys) { diagAddErr = "Sistema obrigatório."; renderDiagAddModal(); return; }
    if (!code) { diagAddErr = "Código obrigatório."; renderDiagAddModal(); return; }
    if (!label) { diagAddErr = "Designação obrigatória."; renderDiagAddModal(); return; }

    diagAddSaving = true;
    diagAddErr = "";
    renderDiagAddModal();

    try {
      const { data, error } = await window.sb.rpc("add_diagnosis_catalog", {
        p_system: sys,
        p_code: code,
        p_label: label,
        p_is_active: true
      });

      if (error) {
        const msg = String(error.message || error.details || error.hint || "Erro ao adicionar diagnóstico.");
        diagAddErr = msg;
        diagAddSaving = false;
        renderDiagAddModal();
        return;
      }

      // data deve ser a row (RETURNS diagnoses_catalog)
      const row = data || null;
      if (row && row.id) {
        // selecionar automaticamente
        addDiagnosis({ id: row.id, code: row.code || code, label: row.label || label });
      }

      // limpar pesquisa/fechar
      closeDiagAddModal();
      diagQuery = "";
      diagResults = [];
      const inp = document.getElementById("diagSearch");
      if (inp) inp.value = "";
      renderDiagArea();
      inp?.focus();

    } catch (e) {
      console.error(e);
      diagAddErr = "Erro inesperado ao adicionar diagnóstico.";
      diagAddSaving = false;
      renderDiagAddModal();
    }
  }
  /* ---- FIM FUNÇÃO 06D.5 ---- */

  /* ---- FUNÇÃO 06D.6 — renderDiagArea ---- */
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
                <button class="diagRemove gcBtn" data-id="${x.id}"
                        style="padding:6px 10px; border-radius:999px;">×</button>
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
      const clean = String(diagQuery || "").trim();
      const canAdd = (!diagLoading && clean.length >= 2);

      const hasResults = (!diagLoading && diagResults && diagResults.length);
      if (hasResults || canAdd) {
        dd.innerHTML = `
          <div id="diagDropdown"
               style="position:absolute; z-index:50; left:0; right:0;
                      max-width:720px; margin-top:6px; background:#fff;
                      border:1px solid #e5e5e5; border-radius:12px;
                      box-shadow:0 10px 24px rgba(0,0,0,0.08);
                      max-height:260px; overflow:auto;">
            ${hasResults ? diagResults.map(x => `
              <div class="diagPick" data-id="${x.id}"
                   style="padding:10px 12px; border-bottom:1px solid #f1f5f9; cursor:pointer;">
                <div style="font-weight:800;">${escAttr(x.label || "—")}</div>
                ${x.code ? `<div style="color:#64748b; font-size:12px;">${escAttr(x.code)}</div>` : ``}
              </div>
            `).join("") : ``}

            ${canAdd ? `
              <div class="diagAddNew"
                   data-label="${escAttr(clean)}"
                   style="padding:10px 12px; cursor:pointer; background:#f8fafc; border-top:1px solid #e2e8f0;">
                <div style="font-weight:900;">Não encontro → Adicionar ao catálogo</div>
                <div style="color:#64748b; font-size:12px; margin-top:2px;">
                  ${escAttr(clean)}
                </div>
              </div>
            ` : ``}
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

    document.querySelectorAll(".diagAddNew").forEach(el => {
      el.onclick = (ev) => {
        ev.preventDefault();
        const label = String(el.getAttribute("data-label") || "").trim();
        // Por defeito, preenche label; código fica vazio (obrigatório → o utilizador decide)
        openDiagAddModal(label, "");
      };
    });
  }
  /* ---- FIM FUNÇÃO 06D.6 ---- */

  /* ---- FUNÇÃO 06D.7 — searchDiagnoses ---- */
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

    const rows = (data || []).map(r => ({ id: r.id, code: r.code || "", label: r.label || "" }));
    const sel = new Set(selectedDiag.map(x => String(x.id)));
    diagResults = rows.filter(x => !sel.has(String(x.id)));

    diagLoading = false;
    renderDiagArea();
  }
  /* ---- FIM FUNÇÃO 06D.7 ---- */

  /* ---- FUNÇÃO 06D.8 — addDiagnosis ---- */
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
  /* ---- FIM FUNÇÃO 06D.8 ---- */

  /* ---- FUNÇÃO 06D.9 — removeDiagnosis ---- */
  function removeDiagnosis(id) {
    selectedDiag = selectedDiag.filter(x => String(x.id) !== String(id));
    renderDiagArea();
  }
  /* ---- FIM FUNÇÃO 06D.9 ---- */
/* ==== FIM BLOCO 06D/12 — Diagnósticos (pesquisa catálogo + chips + adicionar ao catálogo) ==== */


/* ==== INÍCIO BLOCO 06E/12 — Tratamentos (catálogo + dual list) ==== */

  /* ---- FUNÇÃO 06E.1 — sentenceizeLabel ---- */
  function sentenceizeLabel(s) {
    const raw = String(s || "").trim();
    if (!raw) return "";
    let t = raw.toLowerCase();
    t = t.replace(/\s+/g, " ");
    t = t.replace(/(^|[.!?]\s+)([a-zà-ÿ])/g, (m, p1, p2) => p1 + p2.toUpperCase());
    t = t.replace(/^([a-zà-ÿ])/, (m, c) => c.toUpperCase());
    return t;
  }
  /* ---- FIM FUNÇÃO 06E.1 ---- */

  /* ---- FUNÇÃO 06E.2 — normTreatRow ---- */
  function normTreatRow(t) {
    return {
      id: t.id,
      label: sentenceizeLabel(t.label || t.name || t.title || ""),
      code: t.code || t.adse_code || t.proc_code || "",
    };
  }
  /* ---- FIM FUNÇÃO 06E.2 ---- */

  /* ---- FUNÇÃO 06E.3 — fetchTreatmentsDefault ---- */
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
  /* ---- FIM FUNÇÃO 06E.3 ---- */

  /* ---- FUNÇÃO 06E.4 — searchTreatments ---- */
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
  /* ---- FIM FUNÇÃO 06E.4 ---- */

  /* ---- FUNÇÃO 06E.5 — addTreatment ---- */
  function addTreatment(item) {
    if (!item || !item.id) return;
    if (selectedTreat.some(x => String(x.id) === String(item.id))) return;

    selectedTreat.push({ id: item.id, code: item.code || "", label: item.label || "", qty: 1 });
    treatResults = (treatResults || []).filter(x => String(x.id) !== String(item.id));
    renderTreatArea();
  }
  /* ---- FIM FUNÇÃO 06E.5 ---- */

  /* ---- FUNÇÃO 06E.6 — removeTreatment ---- */
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
  /* ---- FIM FUNÇÃO 06E.6 ---- */

  /* ---- FUNÇÃO 06E.7 — renderTreatArea ---- */
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
                        style="padding:6px 10px; border-radius:999px;">×</button>
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
              <div class="treatPick" data-id="${x.id}"
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
  /* ---- FIM FUNÇÃO 06E.7 ---- */
/* ==== FIM BLOCO 06E/12 — Tratamentos (catálogo + dual list) ==== */


/* ==== INÍCIO BLOCO 06Fa/12 — Documentos/PDF (CONFIG + HELPERS + LOAD + CLINIC + TEMPLATE) ==== */

  // =========================================================
  // CONFIG — PDF via Proxy (Worker com Puppeteer)
  // =========================================================
  /* ---- FUNÇÃO/CONST 06Fa.1 — PDF_PROXY_URL ---- */
  const PDF_PROXY_URL = "https://gc-pdf-proxy.dr-joao-morais.workers.dev/pdf";
  /* ---- FIM FUNÇÃO/CONST 06Fa.1 ---- */

  /* ---- FUNÇÃO/CONST 06Fa.2 — VINHETA_BUCKET ---- */
  const VINHETA_BUCKET = "clinic-private";
  /* ---- FIM FUNÇÃO/CONST 06Fa.2 ---- */

  /* ---- FUNÇÃO/CONST 06Fa.3 — VINHETA_PATH ---- */
  const VINHETA_PATH = "vinheta/vinheta_web.png";
  /* ---- FIM FUNÇÃO/CONST 06Fa.3 ---- */

  /* ---- FUNÇÃO/CONST 06Fa.3b — SIGNATURE_PATH ---- */
  const SIGNATURE_PATH = "signatures/signature_dr_joao_morais.png";
  /* ---- FIM FUNÇÃO/CONST 06Fa.3b ---- */

  /* ---- FUNÇÃO/STATE 06Fa.4 — docForceRebuildOnce ---- */
  let docForceRebuildOnce = false;
  /* ---- FIM FUNÇÃO/STATE 06Fa.4 ---- */

  // =========================================================
  // HELPERS — Signed URL / Base64 / Proxy call / safety
  // =========================================================
  /* ---- FUNÇÃO 06Fa.5 — safeText ---- */
  function safeText(s) {
    return String(s || "")
      .trim()
      .replace(/[^\p{L}\p{N}\s._-]+/gu, "")
      .replace(/\s+/g, " ")
      .slice(0, 80) || "Relatorio";
  }
  /* ---- FIM FUNÇÃO 06Fa.5 ---- */

  /* ---- FUNÇÃO 06Fa.6 — storageSignedUrl ---- */
  async function storageSignedUrl(bucket, path, expiresSec = 3600) {
    try {
      if (!bucket || !path) return "";
      const s = await window.sb.storage.from(bucket).createSignedUrl(path, expiresSec);
      return s?.data?.signedUrl ? String(s.data.signedUrl) : "";
    } catch (e) {
      console.warn("storageSignedUrl error:", e);
      return "";
    }
  }
  /* ---- FIM FUNÇÃO 06Fa.6 ---- */

  /* ---- FUNÇÃO 06Fa.7 — urlToDataUrl ---- */
  // (mantido; pode ser útil noutros pontos)
  async function urlToDataUrl(url, fallbackMime = "image/png") {
    try {
      if (!url) return "";
      const res = await fetch(url, { method: "GET", cache: "no-store" });
      if (!res.ok) throw new Error(`urlToDataUrl fetch ${res.status}`);
      const blob = await res.blob();

      const mime = blob.type && String(blob.type).includes("/") ? blob.type : fallbackMime;

      const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result || ""));
        r.onerror = reject;
        r.readAsDataURL(blob);
      });

      if (dataUrl && dataUrl.startsWith("data:application/octet-stream")) {
        return dataUrl.replace("data:application/octet-stream", `data:${mime}`);
      }
      return dataUrl;
    } catch (e) {
      console.warn("urlToDataUrl error:", e);
      return "";
    }
  }
  /* ---- FIM FUNÇÃO 06Fa.7 ---- */

  /* ---- FUNÇÃO 06Fa.8 — renderPdfViaProxy ---- */
  async function renderPdfViaProxy(html) {
    const res = await fetch(PDF_PROXY_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ html: String(html || "") })
    });

    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      throw new Error(`Proxy error ${res.status}: ${msg || "sem detalhe"}`);
    }

    const buf = await res.arrayBuffer();
    return new Blob([buf], { type: "application/pdf" });
  }
  /* ---- FIM FUNÇÃO 06Fa.8 ---- */

  // =========================================================
  // DOCUMENTS — load list
  // =========================================================
  /* ---- FUNÇÃO 06Fa.9 — loadDocuments ---- */
  async function loadDocuments() {
    docsLoading = true;
    docRows = [];

    try {
      const { data, error } = await window.sb
        .from("documents")
        .select("id, created_at, title, consultation_id, clinic_id, version, storage_path")
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
          } catch (e) {}
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
  /* ---- FIM FUNÇÃO 06Fa.9 ---- */

  // =========================================================
  // CLINIC / USER HELPERS
  // =========================================================
  /* ---- FUNÇÃO 06Fa.10 — fetchClinicForPdf ---- */
async function fetchClinicForPdf() {

  try {

    let clinicId = "";

    // 1️⃣ tentar usar variável global se existir
    if (typeof activeClinicId !== "undefined" && activeClinicId) {
      clinicId = activeClinicId;
    }

    // 2️⃣ fallback: usar clinic_id do doente atual
    if (!clinicId && typeof p !== "undefined" && p?.clinic_id) {
      clinicId = p.clinic_id;
    }

    if (!clinicId) {
      console.warn("fetchClinicForPdf: sem clinicId");
      return null;
    }

    const { data, error } = await window.sb
      .from("clinics")
      .select("id, name, address_line1, address_line2, postal_code, city, phone, email, website, logo_url")
      .eq("id", clinicId)
      .single();

    if (error) {
      console.error("fetchClinicForPdf error:", error);
      return null;
    }

    return data || null;

  } catch (e) {
    console.error("fetchClinicForPdf exception:", e);
    return null;
  }

}
/* ---- FIM FUNÇÃO 06Fa.10 ---- */

  /* ---- FUNÇÃO 06Fa.11 — fetchCurrentUserDisplayName ---- */
  async function fetchCurrentUserDisplayName(userId) {
    try {
      const { data, error } = await window.sb
        .from("clinic_members")
        .select("display_name")
        .eq("user_id", userId)
        .limit(1);

      if (error) { console.error("fetchCurrentUserDisplayName error:", error); return ""; }
      const v = data && data.length ? (data[0].display_name || "") : "";
      return v;
    } catch (e) {
      console.error("fetchCurrentUserDisplayName exception:", e);
      return "";
    }
  }
  /* ---- FIM FUNÇÃO 06Fa.11 ---- */

  /* ---- FUNÇÃO 06Fa.12 — fmtDobPt ---- */
  function fmtDobPt(d) {
    try {
      if (!d) return "—";
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return String(d);
      const dd = String(dt.getDate()).padStart(2, "0");
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      const yy = dt.getFullYear();
      return `${dd}-${mm}-${yy}`;
    } catch (e) { return String(d || "—"); }
  }
  /* ---- FIM FUNÇÃO 06Fa.12 ---- */

  /* ---- FUNÇÃO 06Fa.13 — patientAddressCompact ---- */
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
  /* ---- FIM FUNÇÃO 06Fa.13 ---- */

  // =========================================================
  // HTML TEMPLATE — v1
  // =========================================================
  /* ---- FUNÇÃO 06Fa.14 — buildDocV1Html ---- */
  function buildDocV1Html({ clinic, consult, authorName, vinhetaUrl, clinicLogoUrl, signatureUrl }) {

    function escUrlAttr(u) {
      return String(u || "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }

    function fmtDatePt(d) {
      try {
        if (!d) return "";
        const dt = new Date(d);
        if (isNaN(dt.getTime())) return String(d);
        const dd = String(dt.getDate()).padStart(2, "0");
        const mm = String(dt.getMonth() + 1).padStart(2, "0");
        const yy = dt.getFullYear();
        return `${dd}-${mm}-${yy}`;
      } catch (_) { return String(d || ""); }
    }

    const reportDatePt = consult?.report_date ? fmtDatePt(consult.report_date) : "";
    const hda = sanitizeHTML(consult?.hda || "");
    const diags = Array.isArray(consult?.diagnoses) ? consult.diagnoses : [];
    const trts  = Array.isArray(consult?.treatments) ? consult.treatments : [];

    const rx = getPrescriptionTextFromPlan(consult?.plan_text || "") ||
      "R/ 20 Sessões de Medicina Física e de Reabilitação com:";

    const name = String(p.full_name || "").trim() || "—";

    const lineParts = [];
    if (p.sns) lineParts.push(`<b>Nº Utente:</b> ${escAttr(p.sns)}`);
    if (p.dob) lineParts.push(`<b>DN:</b> ${escAttr(fmtDobPt(p.dob))}`);
    if (p.nif) lineParts.push(`<b>NIF:</b> ${escAttr(p.nif)}`);
    if (p.insurance_provider) lineParts.push(`<b>Seguro:</b> ${escAttr(p.insurance_provider)}`);
    if (p.insurance_policy_number) lineParts.push(`<b>Nº:</b> ${escAttr(p.insurance_policy_number)}`);
    const line2 = lineParts.join("&nbsp;&nbsp;&nbsp;");

    const addr = patientAddressCompact();
    const addrOk = addr && addr !== "—";

    const locality = String(clinic?.city || "").trim();
    const localityDate = [locality, reportDatePt].filter(Boolean).join(", ");

    // ✅ LOGO: usa SEMPRE URL curta; fallback direto ao logo_url da clínica
    const logoSrc = String(clinicLogoUrl || clinic?.logo_url || "").trim();

    function renderDiagList(items) {
      if (!items || !items.length) return `<span class="muted">—</span>`;
      return `
        <ul class="list">
          ${items.map(d => {
            const lbl = escAttr(d?.label || "—");
            const code = d?.code ? ` <span class="code">(${escAttr(d.code)})</span>` : ``;
            return `<li>${lbl}${code}</li>`;
          }).join("")}
        </ul>
      `;
    }

    function renderTreatList(items) {
      if (!items || !items.length) return `<span class="muted">—</span>`;
      return `
        <ul class="list">
          ${items.map(t => {
            const lbl = escAttr(sentenceizeLabel(t?.label || "—"));
            const code = t?.code ? ` <span class="code">(${escAttr(t.code)})</span>` : ``;
            return `<li>${lbl}${code}</li>`;
          }).join("")}
        </ul>
      `;
    }

    return `
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Relatório Médico</title>
<style>
  body { margin:0; background:#fff; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif; color:#111; }
  * { box-sizing:border-box; }

  /* ✅ Paginação mais previsível */
  @page { size: A4; margin: 16mm; }

  /* ✅ Container A4 (sem min-height a forçar “página vazia”) */
  .a4 { width:210mm; background:#fff; }

  .top { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
  .topLeft { font-size:13.5px; line-height:1.4; }
  .logo { width:120px; height:auto; max-height:60px; object-fit:contain; display:block; }

  .hr { height:1px; background:#111; margin:10px 0 14px 0; }
  .title { text-align:center; font-weight:900; font-size:22px; margin:2px 0 12px 0; }
  .row { margin-top:6px; font-size:13.5px; line-height:1.35; }
  .muted { color:#64748b; }

  /* ✅ Secções: permitir quebra (evita empurrar secção inteira para nova página) */
  .section {
    margin-top:18px;
    page-break-inside: auto;
    break-inside: auto;
  }

  /* ✅ Evitar o título de secção ficar “órfão” no fim da página */
  .stitle {
    font-weight:900; font-size:16px; margin-bottom:6px;
    page-break-after: avoid;
    break-after: avoid;
  }

  /* ✅ HDA: espaçamento lógico (line-height 1.2) + controlar margens dos <p> do Quill */
  .hda { font-size:14px; line-height:1.2; }
  .hda p { margin: 0 0 6px 0; }
  .hda p:last-child { margin-bottom: 0; }

  .hda ul, .hda ol { margin:6px 0 6px 18px; padding:0; }
  .hda li { margin:2px 0; }

  .list { margin:8px 0 0 18px; padding:0; font-size:14px; line-height:1.35; }
  .list li { margin:6px 0; }
  .code { color:#64748b; }

  /* ✅ Rodapé: permitir quebra (evita “assinatura isolada em página nova”) */
  .footerBlock { margin-top:22px; page-break-inside:auto; break-inside:auto; }
  .hr2 { height:1px; background:#111; margin:16px 0 10px 0; }
  .footRow { display:flex; justify-content:space-between; align-items:flex-start; gap:10px; }

  .web { font-size:14px; font-weight:700; }

  /* ✅ VINHETA (4cm x 2.5cm) */
  .vinheta { margin-top:8px; width:4cm; height:2.5cm; object-fit:contain; display:block; }

  .locDate { text-align:right; font-size:14px; margin-top:14px; }
  .sig { margin-top:60px; display:flex; justify-content:flex-end; }

  /* ✅ Evitar a CAIXA da assinatura ser partida */
  .sigBox { width:360px; text-align:center; page-break-inside:avoid; break-inside:avoid; }

  .sigImgWrap { position:relative; height:80px; display:flex; align-items:flex-end; justify-content:center; margin-bottom:-1px; }
  .sigImg { max-height:80px; max-width:280px; object-fit:contain; display:block; }
  .sigLine { border-top:1px solid #111; padding-top:10px; }
  .sigName { font-weight:900; font-size:18px; margin-top:6px; }
  .sigRole { font-size:14px; margin-top:2px; }
</style>
</head>
<body>
  <div class="a4">

    <div class="top">
      <div class="topLeft">
        <div>${escAttr(clinic?.website || "www.JoaoMorais.pt")}</div>
        <div>${escAttr(clinic?.phone || "")}</div>
      </div>
      <div>
        ${logoSrc ? `<img class="logo" src="${escUrlAttr(logoSrc)}" />` : ``}
      </div>
    </div>

    <div class="hr"></div>
    <div class="title">Relatório Médico</div>

    <div class="row"><b>Nome:</b> ${escAttr(name)}</div>
    ${line2 ? `<div class="row">${line2}</div>` : ``}
    ${addrOk ? `<div class="row"><b>Morada:</b> ${escAttr(addr)}</div>` : ``}

    <div class="hr" style="margin-top:14px; opacity:0.5;"></div>

    <div class="section">
      <div class="stitle">Anamnese / HDA</div>
      <div class="hda">${hda && String(hda).trim() ? hda : `<span class="muted">—</span>`}</div>
    </div>

    <div class="section">
      <div class="stitle">Diagnóstico</div>
      ${renderDiagList(diags)}
    </div>

    <div class="section">
      <div class="stitle">Prescrição de Tratamento</div>
      <div style="font-size:14px; margin-top:2px;">${escAttr(rx)}</div>
      ${renderTreatList(trts)}
    </div>

    <div class="footerBlock">
      <div class="hr2"></div>

      <div class="footRow">
        <div>
          <div class="web">www.JoaoMorais.pt</div>
          ${vinhetaUrl ? `<img class="vinheta" src="${escUrlAttr(vinhetaUrl)}" />` : ``}
        </div>

        <div style="flex:1;">
          ${localityDate ? `<div class="locDate">${escAttr(localityDate)}</div>` : ``}

          <div class="sig">
            <div class="sigBox">
              <div class="sigLine"></div>
              <div class="sigName">Dr. João Morais</div>
              <div class="sigRole">Médico Fisiatra</div>
              <div class="sigRole">Sports Medicine &amp; Rehabilitation</div>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</body>
</html>
`;
  }
  /* ---- FIM FUNÇÃO 06Fa.14 ---- */
/* ==== FIM BLOCO 06Fa/12 — Documentos/PDF (CONFIG + HELPERS + LOAD + CLINIC + TEMPLATE) ==== */


/* ==== INÍCIO BLOCO 06Fb/12 — Documentos/PDF (EDITOR + BIND) ==== */

  // =========================================================
  // EDITOR — open/render/bind
  // =========================================================
  /* ---- FUNÇÃO 06Fb.1 — openDocumentEditor ---- */
  function openDocumentEditor(html, title) {
    docDraftHtml = String(html || "");
    docTitle = String(title || docTitle || "Relatório Médico");
    docMode = "visual";
    docOpen = true;
    docSaving = false;
    render();
    bindDocEvents();
  }
/* ---- FIM FUNÇÃO 06Fb.1 ---- */

  /* ---- FUNÇÃO 06Fb.2 — closeDocumentEditor ---- */
  function closeDocumentEditor() {
    docOpen = false;
    docSaving = false;
    docMode = "visual";
    render();
  }
  /* ---- FIM FUNÇÃO 06Fb.2 ---- */

  /* ---- FUNÇÃO 06Fb.3 — renderDocumentEditorModal ---- */
  function renderDocumentEditorModal() {
    return `
      <div id="docOverlay"
           style="position:fixed; inset:0; background:rgba(0,0,0,0.35);
                  display:flex; align-items:center; justify-content:center; padding:12px; z-index:2200;">
        <div style="background:#fff; width:min(1200px,96vw);
                    max-height:92vh; overflow:auto;
                    border-radius:14px; border:1px solid #e5e5e5; padding:16px;">

          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
            <div style="font-weight:900; font-size:16px;">
              Documento v1 — ${docMode === "preview" ? "pré-visualização" : (docMode === "html" ? "editar HTML" : "editor visual")}
            </div>
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
              <button id="btnDocModeVisual" class="gcBtn" ${docMode === "visual" ? `style="font-weight:900;"` : ``}>Editor</button>
              <button id="btnDocModeHtml" class="gcBtn" ${docMode === "html" ? `style="font-weight:900;"` : ``}>HTML</button>
              <button id="btnDocModePreview" class="gcBtn" ${docMode === "preview" ? `style="font-weight:900;"` : ``}>Pré-visualizar</button>
            </div>
          </div>

          ${docMode === "html" ? `
            <div style="margin-top:12px;">
              <textarea id="docHtml"
                        style="width:100%; height:65vh; padding:12px; border:1px solid #ddd; border-radius:12px;
                               font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
                               font-size:12px; line-height:1.4;">${escAttr(docDraftHtml)}</textarea>
            </div>
          ` : `
            <div style="margin-top:12px; border:1px solid #e5e5e5; border-radius:12px; overflow:hidden;">
              ${docMode === "visual" ? `
              <div id="docToolbar" style="display:flex; gap:4px; padding:8px 10px; background:#f8f8f8; border-bottom:1px solid #e5e5e5; flex-wrap:wrap; align-items:center;">
                <button onclick="(function(){var d=document.getElementById('docFrame').contentDocument;d.execCommand('bold')})()" style="font-weight:900; min-width:32px; padding:4px 8px; border:1px solid #ddd; border-radius:6px; background:#fff; cursor:pointer; font-size:14px;">B</button>
                <button onclick="(function(){var d=document.getElementById('docFrame').contentDocument;d.execCommand('italic')})()" style="font-style:italic; min-width:32px; padding:4px 8px; border:1px solid #ddd; border-radius:6px; background:#fff; cursor:pointer; font-size:14px;">I</button>
                <button onclick="(function(){var d=document.getElementById('docFrame').contentDocument;d.execCommand('underline')})()" style="text-decoration:underline; min-width:32px; padding:4px 8px; border:1px solid #ddd; border-radius:6px; background:#fff; cursor:pointer; font-size:14px;">U</button>
                <div style="width:1px; background:#ddd; height:24px; margin:0 4px;"></div>
                <select onchange="(function(v){var d=document.getElementById('docFrame').contentDocument;d.execCommand('fontSize',false,v)})(this.value)" style="padding:4px 6px; border:1px solid #ddd; border-radius:6px; background:#fff; cursor:pointer; font-size:13px;">
                  <option value="">Tamanho</option>
                  <option value="2">Pequeno</option>
                  <option value="3">Normal</option>
                  <option value="4">Médio</option>
                  <option value="5">Grande</option>
                  <option value="6">Muito grande</option>
                </select>
                <div style="width:1px; background:#ddd; height:24px; margin:0 4px;"></div>
                <button onclick="(function(){var d=document.getElementById('docFrame').contentDocument;d.execCommand('justifyLeft')})()" style="min-width:32px; padding:4px 8px; border:1px solid #ddd; border-radius:6px; background:#fff; cursor:pointer; font-size:14px;">≡</button>
                <button onclick="(function(){var d=document.getElementById('docFrame').contentDocument;d.execCommand('justifyCenter')})()" style="min-width:32px; padding:4px 8px; border:1px solid #ddd; border-radius:6px; background:#fff; cursor:pointer; font-size:14px;">☰</button>
              </div>` : ``}
              <iframe id="docFrame" style="width:100%; height:65vh; border:0; background:#fff;"></iframe>
            </div>
          `}

          <div style="margin-top:12px; display:flex; justify-content:space-between; align-items:center; gap:10px;">
            <div id="docStatus" style="color:${docSaving ? "#111" : "#64748b"};">
              ${docSaving ? "A gerar/upload..." : ""}
            </div>

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
  /* ---- FIM FUNÇÃO 06Fb.3 ---- */

  /* ---- FUNÇÃO 06Fb.4 — mountDocFrame ---- */
  function mountDocFrame() {
    const iframe = document.getElementById("docFrame");
    if (!iframe) return;

    iframe.srcdoc = String(docDraftHtml || "");

    iframe.onload = () => {
      try {
        const d = iframe.contentDocument;
        if (!d) return;

        if (docMode === "visual") {
          d.designMode = "on";
          d.body.style.outline = "none";
        } else {
          try { d.designMode = "off"; } catch (e) {}
        }
      } catch (e) {
        console.error("mountDocFrame error:", e);
      }
    };
  }
  /* ---- FIM FUNÇÃO 06Fb.4 ---- */

  /* ---- FUNÇÃO 06Fb.5 — syncDocFromFrame ---- */
  function syncDocFromFrame() {
    const iframe = document.getElementById("docFrame");
    if (!iframe) return;

    try {
      const d = iframe.contentDocument || iframe.contentWindow?.document;
      if (!d || !d.documentElement) return;

      let html = "";
      try { html = d.documentElement.outerHTML || ""; } catch (e) { html = ""; }
      if (html && !/<!doctype/i.test(html)) html = "<!doctype html>\n" + html;

      docDraftHtml = String(html || "").trim();
    } catch (e) {
      console.error("syncDocFromFrame error:", e);
    }
  }
  /* ---- FIM FUNÇÃO 06Fb.5 ---- */

  /* ---- FUNÇÃO 06Fb.6 — bindDocEvents ---- */
  function bindDocEvents() {
    document.getElementById("btnDocCloseTop")?.addEventListener("click", closeDocumentEditor);
    document.getElementById("btnDocCancel")?.addEventListener("click", closeDocumentEditor);

    const t = document.getElementById("docTitle");
    if (t) t.oninput = (e) => { docTitle = e?.target?.value ?? "Relatório Médico"; };

    const bVis = document.getElementById("btnDocModeVisual");
    const bHtml = document.getElementById("btnDocModeHtml");
    const bPrev = document.getElementById("btnDocModePreview");

    if (bVis) bVis.onclick = () => { docMode = "visual"; render(); bindDocEvents(); mountDocFrame(); };
    if (bHtml) bHtml.onclick = () => { if (docMode !== "html") syncDocFromFrame(); docMode = "html"; render(); bindDocEvents(); };
    if (bPrev) bPrev.onclick = () => { if (docMode !== "html") syncDocFromFrame(); docMode = "preview"; render(); bindDocEvents(); mountDocFrame(); };

    const ta = document.getElementById("docHtml");
    if (ta) ta.oninput = (e) => { docDraftHtml = e?.target?.value ?? ""; };

    const btnGen = document.getElementById("btnDocGeneratePdfNow");
    if (btnGen) {
      btnGen.disabled = !!docSaving;
      btnGen.onclick = async () => {
        if (docSaving) return;
        docSaving = true;

        // ✅ CORREÇÃO MÍNIMA: evita reutilização de HTML antigo sem imagens
        docDraftHtml = "";

        if (docMode !== "html") syncDocFromFrame();

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
          if (docMode !== "html") mountDocFrame();
        }
      };
    }

    if (docMode !== "html") mountDocFrame();
  }
  /* ---- FIM FUNÇÃO 06Fb.6 ---- */
/* ==== FIM BLOCO 06Fb/12 — Documentos/PDF (EDITOR + BIND) ==== */


/* ==== INÍCIO BLOCO 06Fc/12 — Documentos/PDF (STORAGE + GENERATE + EXPORTS) ==== */

  // =========================================================
  // STORAGE — upload + documents row
  // =========================================================
  /* ---- FUNÇÃO 06Fc.1 — uploadPdfToStorage ---- */
  async function uploadPdfToStorage({ blob, path }) {
    try {
      const r = await window.sb.storage
        .from("documents")
        .upload(path, blob, { contentType: "application/pdf", upsert: false, cacheControl: "3600" });

      if (r?.error) { console.error("uploadPdf error:", r.error); return { ok: false, error: r.error }; }
      return { ok: true };
    } catch (e) {
      console.error("uploadPdf exception:", e);
      return { ok: false, error: e };
    }
  }
  /* ---- FIM FUNÇÃO 06Fc.1 ---- */

  /* ---- FUNÇÃO 06Fc.2 — insertDocumentRow ---- */
  async function insertDocumentRow(meta) {
    try {
      const payload = {
        clinic_id: meta.clinic_id,
        patient_id: meta.patient_id,
        consultation_id: meta.consultation_id || null,
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

      if (error) { console.error("insertDocumentRow error:", error); return { ok: false, error }; }
      return { ok: true, id: data?.id || null };
    } catch (e) {
      console.error("insertDocumentRow exception:", e);
      return { ok: false, error: e };
    }
  }
  /* ---- FIM FUNÇÃO 06Fc.2 ---- */

  /* ---- FUNÇÃO 06Fc.3 — getNextDocVersionForConsult ---- */
  async function getNextDocVersionForConsult(consultId) {
    try {
      const { data, error } = await window.sb
        .from("documents")
        .select("version")
        .eq("consultation_id", consultId)
        .order("version", { ascending: false })
        .limit(1);

      if (error) { console.error("getNextDocVersion error:", error); return 1; }
      const last = data && data.length ? Number(data[0].version || 0) : 0;
      return (isFinite(last) ? last + 1 : 1);
    } catch (e) {
      console.error("getNextDocVersion exception:", e);
      return 1;
    }
  }
  /* ---- FIM FUNÇÃO 06Fc.3 ---- */

  // =========================================================
  // HELPERS — aplicar assets ao HTML (SEM reconstruir template)
  // =========================================================
  function applyPdfAssetsToHtml(html, { clinicLogoUrl, vinhetaUrl, signatureUrl }) {
    let out = String(html || "");

    if (clinicLogoUrl) out = out.replaceAll("__CLINIC_LOGO_URL__", clinicLogoUrl);
    if (vinhetaUrl) out = out.replaceAll("__VINHETA_URL__", vinhetaUrl);

    if (vinhetaUrl && out.includes('class="vinheta"')) {
      out = out.replace(
        /(<img\b[^>]*class="vinheta"[^>]*\bsrc=")[^"]*(")/i,
        `$1${vinhetaUrl}$2`
      );
    }


    return out;
  }

  // =========================================================
  // MAIN — generate via Proxy/Worker + upload + insert
  // =========================================================
  /* ---- FUNÇÃO 06Fc.5 — generatePdfAndUploadV1 ---- */
async function generatePdfAndUploadV1() {
  try {
    if (!lastSavedConsultId) { alert("Sem consulta gravada para gerar PDF."); return false; }

    const userRes = await window.sb.auth.getUser();
    const userId = userRes?.data?.user?.id;
    if (!userId) { alert("Utilizador não autenticado."); return false; }

    const consult = (consultRows || []).find(x => String(x.id) === String(lastSavedConsultId));
    if (!consult) { alert("Não encontrei a consulta no feed. Atualiza o feed e tenta novamente."); return false; }

    if (!activeClinicId) { alert("Sem clínica ativa (patient_clinic)."); return false; }

    const clinic = await fetchClinicForPdf();
    if (!clinic) { alert("Não consegui carregar dados da clínica (clinics)."); return false; }

    const authorName = await fetchCurrentUserDisplayName(userId);

    // =========================================================
    // VINHETA — buscar signed URL e converter para DATA URL
    // =========================================================
    let vinhetaUrl = "";
    try {
      const vinhetaSignedUrl = await storageSignedUrl(VINHETA_BUCKET, VINHETA_PATH, 3600);
      if (vinhetaSignedUrl) {
        vinhetaUrl = await urlToDataUrl(vinhetaSignedUrl, "image/png");
      }
    } catch (e) {
      console.warn("PDF: vinheta signed/data url falhou:", e);
      vinhetaUrl = "";
    }

    // =========================================================
    // ASSINATURA — buscar signed URL e converter para DATA URL
    // =========================================================
    let signatureUrl = "";
    try {
      const signatureSignedUrl = await storageSignedUrl(VINHETA_BUCKET, SIGNATURE_PATH, 3600);
      if (signatureSignedUrl) {
        signatureUrl = await urlToDataUrl(signatureSignedUrl, "image/png");
      }
    } catch (e) {
      console.warn("PDF: assinatura signed/data url falhou:", e);
      signatureUrl = "";
    }

    // =========================================================
    // LOGO — usar data URL se vier de storage/http; manter data: se já existir
    // =========================================================
    let clinicLogoUrl = "";
    try {
      const rawLogo = String(clinic?.logo_url || "").trim();

      if (rawLogo.startsWith("data:")) {
        clinicLogoUrl = rawLogo;
      } else if (rawLogo.startsWith("http://") || rawLogo.startsWith("https://")) {
        clinicLogoUrl = await urlToDataUrl(rawLogo, "image/png");
      } else {
        clinicLogoUrl = "";
      }
    } catch (e) {
      console.warn("PDF: logo data url falhou:", e);
      clinicLogoUrl = "";
    }

    // Sempre rebuild completo para garantir assinatura e assets actualizados
    docDraftHtml = buildDocV1Html({
      clinic,
      consult,
      authorName,
      vinhetaUrl,
      clinicLogoUrl,
      signatureUrl
    });

    const titleSafe = safeText(docTitle || "Relatório Médico");

    let blob;
    try {
      blob = await renderPdfViaProxy(docDraftHtml);
    } catch (e) {
      console.error("renderPdfViaProxy falhou:", e);
      alert(`Falha ao gerar PDF no servidor.\n${String(e?.message || e)}`);
      return false;
    }

    if (!blob || blob.size < 5000) {
      alert("PDF inválido ou demasiado pequeno (provável branco).");
      return false;
    }

    const version = await getNextDocVersionForConsult(consult.id);
    const ymd = new Date().toISOString().slice(0, 10);
    const hms = new Date().toISOString().slice(11, 19).replaceAll(":", "");
    const path = `clinic_${activeClinicId}/patient_${p.id}/consult_${consult.id}/v${version}_${ymd}_${hms}.pdf`;

    const up = await uploadPdfToStorage({ blob, path });
    if (!up.ok) {
      const msg = String(up.error?.message || up.error?.error || up.error || "erro desconhecido");
      alert(`Falhou o upload do PDF para Storage.\nDetalhe: ${msg}`);
      return false;
    }

    const ins = await insertDocumentRow({
      clinic_id: activeClinicId,
      patient_id: p.id,
      consultation_id: consult.id,
      title: titleSafe,
      html: "",
      parent_document_id: null,
      version,
      storage_path: path
    });

    if (!ins.ok) {
      const msg = String(ins.error?.message || ins.error?.error || ins.error || "erro desconhecido");
      alert(`PDF enviado para Storage, mas falhou o registo na tabela documents.\nDetalhe: ${msg}`);
      return false;
    }

    alert("PDF (v1) criado com sucesso.");
    return true;

  } catch (e) {
    console.error("generatePdfAndUploadV1 exception:", e);
    alert("Erro na geração/upload do PDF.");
    return false;
  }
}
/* ---- FIM FUNÇÃO 06Fc.5 ---- */

/* ---- FUNÇÃO 06Fc.6 — window exports ---- */
  try {
    window.generatePdfAndUploadV1 = generatePdfAndUploadV1;
    window.openDocumentEditor = openDocumentEditor;
    window.__gc_storageSignedUrl  = storageSignedUrl;
    window.__gc_urlToDataUrl      = urlToDataUrl;
    window.__gc_renderPdfViaProxy = renderPdfViaProxy;
    window.__gc_uploadPdfToStorage  = uploadPdfToStorage;
    window.__gc_insertDocumentRow   = insertDocumentRow;
    window.__gc_VINHETA_BUCKET      = VINHETA_BUCKET;
    window.__gc_VINHETA_PATH        = VINHETA_PATH;
  } catch (e) {}
  /* ---- FIM FUNÇÃO 06Fc.6 ---- */

/* ==== FIM BLOCO 06Fc/12 — Documentos/PDF (STORAGE + GENERATE + EXPORTS) ==== */


/* ==== INÍCIO BLOCO 06G/12 — Timeline (load + render + physio_records) ==== */

  // =========================================================
  // Estado local (timeline) — SEM TDZ
  // =========================================================
  /* ---- FUNÇÃO/STATE 06G.1 — __gcPhysioState ---- */
  window.__gcPhysioState = window.__gcPhysioState || {
    rows: [],
    loading: false,
    composerOpen: false,
    editingId: null,
    draftHtml: "",
    saving: false
  };
  /* ---- FIM FUNÇÃO/STATE 06G.1 ---- */

  /* ---- FUNÇÃO 06G.2 — __ps ---- */
  function __ps() { return window.__gcPhysioState; }
  /* ---- FIM FUNÇÃO 06G.2 ---- */

  /* ---- FUNÇÃO/STATE 06G.3 — __gcPhysioQuill ---- */
  window.__gcPhysioQuill = window.__gcPhysioQuill || null;
  /* ---- FIM FUNÇÃO/STATE 06G.3 ---- */

  /* ---- FUNÇÃO/STATE 06G.4 — __gcAuthUid ---- */
  window.__gcAuthUid = window.__gcAuthUid || null;
  /* ---- FIM FUNÇÃO/STATE 06G.4 ---- */

  /* ---- FUNÇÃO/STATE 06G.5 — agendaNoteRows ---- */
  let agendaNoteRows = [];
  /* ---- FIM FUNÇÃO/STATE 06G.5 ---- */

  /* ---- FUNÇÃO 06G.6 — __gcGetUidAsync ---- */
  async function __gcGetUidAsync() {
    try {
      const { data, error } = await window.sb.auth.getUser();
      if (error) { console.error(error); return null; }
      const uid = data?.user?.id || null;
      window.__gcAuthUid = uid;
      return uid;
    } catch (e) {
      console.error(e);
      return null;
    }
  }
  /* ---- FIM FUNÇÃO 06G.6 ---- */

  /* ---- FUNÇÃO 06G.7 — __gcGetUidCached ---- */
  function __gcGetUidCached() {
    return window.__gcAuthUid || null;
  }
  /* ---- FIM FUNÇÃO 06G.7 ---- */

  /* ---- FUNÇÃO 06G.8 — __gcRole ---- */
  function __gcRole() {
    return String(G.role || "").toLowerCase();
  }
  /* ---- FIM FUNÇÃO 06G.8 ---- */

  /* ---- FUNÇÃO 06G.9 — __gcIsSecretary ---- */
  function __gcIsSecretary() { return __gcRole() === "secretary"; }
  /* ---- FIM FUNÇÃO 06G.9 ---- */

  /* ---- FUNÇÃO 06G.10 — __gcIsPhysio ---- */
  function __gcIsPhysio() { return __gcRole() === "physio"; }
  /* ---- FIM FUNÇÃO 06G.10 ---- */

  /* ---- FUNÇÃO 06G.11 — __gcIsDoctor ---- */
  function __gcIsDoctor() { return __gcRole() === "doctor"; }
  /* ---- FIM FUNÇÃO 06G.11 ---- */

  /* ---- FUNÇÃO 06G.12 — __gcGuessClinicIdForPhysioRecord ---- */
  function __gcGuessClinicIdForPhysioRecord() {
    // Ordem de preferência:
    try {
      if (typeof getActiveClinicId === "function") {
        const x = getActiveClinicId();
        if (x) return x;
      }
    } catch (_) {}

    try {
      if (typeof getActiveClinicIdForPatient === "function") {
        const x = getActiveClinicIdForPatient(p);
        if (x) return x;
      }
    } catch (_) {}

    // clinic_id da consulta mais recente (se existir)
    try {
      const cid = consultRows && consultRows.length ? (consultRows[0].clinic_id || null) : null;
      if (cid) return cid;
    } catch (_) {}

    // fallback
    try {
      const cid = window.activeClinicId || G.activeClinicId || null;
      if (cid) return cid;
    } catch (_) {}

    return null;
  }
  /* ---- FIM FUNÇÃO 06G.12 ---- */

  /* ---- FUNÇÃO 06G.13 — loadAgendaNotes ---- */
  async function loadAgendaNotes() {
    try {
      // Nota da agenda é administrativa (não clínica) — pode aparecer também para secretária
      const { data, error } = await window.sb
        .from("agenda_notes_v1")
        .select("appointment_id, clinic_id, patient_id, start_at, end_at, status, procedure_type, title, notes, created_by, created_at, updated_at")
        .eq("patient_id", p.id)
        .order("start_at", { ascending: false });

      if (error) {
        console.error(error);
        agendaNoteRows = [];
        return;
      }

      agendaNoteRows = (data || []).map(r => ({
        ...r,
        notes: String(r.notes || "").trim()
      })).filter(r => r.notes && r.notes.length);
    } catch (e) {
      console.error(e);
      agendaNoteRows = [];
    }
  }
  /* ---- FIM FUNÇÃO 06G.13 ---- */

  /* ---- FUNÇÃO 06G.14 — loadPhysioRecords ---- */
  async function loadPhysioRecords() {
    const s = __ps();
    const rRole = __gcRole();
    const isSecretary = rRole === "secretary";
    if (isSecretary) {
      s.rows = [];
      return;
    }

    s.loading = true;

    const { data, error } = await window.sb
      .from("physio_records")
      .select("id, clinic_id, patient_id, author_user_id, content, created_at")
      .eq("patient_id", p.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      s.rows = [];
      s.loading = false;
      return;
    }

    const rows = data || [];

    // Mapear autores (clinic_members)
    const authorIds = [...new Set(rows.map(r => r.author_user_id).filter(Boolean))];
    let authorMap = {};
    if (authorIds.length) {
      const { data: cms, error: cmErr } = await window.sb
        .from("clinic_members")
        .select("user_id, display_name")
        .in("user_id", authorIds);

      if (cmErr) console.error(cmErr);
      else (cms || []).forEach(x => { authorMap[x.user_id] = (x.display_name || "").trim(); });
    }

    s.rows = rows.map(r => ({
      ...r,
      author_name: (authorMap[r.author_user_id] || "").trim()
    }));

    s.loading = false;
  }
  /* ---- FIM FUNÇÃO 06G.14 ---- */

/* ---- FUNÇÃO 06G.15 — loadConsultations ---- */
async function loadConsultations() {
  timelineLoading = true;

  const rRole = String(G.role || "").toLowerCase();
  const isSecretary = rRole === "secretary";

  // ===== carregar notas da agenda (para todos) =====
  await loadAgendaNotes();

  // =========================
  // SECRETÁRIA: só cabeçalhos via RPC (sem conteúdo clínico)
  // =========================
  if (isSecretary) {
    const { data, error } = await window.sb.rpc("get_consultation_headers_for_patient", {
      p_patient_id: p.id
    });

    if (error) {
      console.error(error);
      consultRows = [];
      __ps().rows = []; // secretária não vê registos fisio
      timelineLoading = false;
      return;
    }

    const rows = data || [];
    consultRows = rows.map(r => ({
      ...r,
      author_name: (r.author_display_name || "").trim(),
      diagnoses: [],
      treatments: [],
      hda: "" // não existe para secretária
    }));

    __ps().rows = []; // secretária não vê registos fisio
    timelineLoading = false;
    return;
  }

  // =========================
  // DOCTOR / PHYSIO: consulta completa
  // =========================
  const { data, error } = await window.sb
    .from("consultations")
    .select("id, clinic_id, report_date, hda, plan_text, created_at, author_user_id, author_display_name")
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

  // Fallback extra (consultas antigas sem author_display_name)
  const authorIds = [...new Set(rows.map(r => r.author_user_id).filter(Boolean))];
  let authorMap = {};
  if (authorIds.length) {
    const { data: cms, error: cmErr } = await window.sb
      .from("clinic_members")
      .select("user_id, display_name")
      .in("user_id", authorIds);

    if (cmErr) console.error(cmErr);
    else (cms || []).forEach(x => { authorMap[x.user_id] = x.display_name || ""; });
  }

  const consultIds = rows.map(r => r.id).filter(Boolean);

  let diagByConsult = {};
  if (consultIds.length) {
    const { data: links, error: lErr } = await window.sb
      .from("consultation_diagnoses")
      .select("consultation_id, diagnosis_id")
      .in("consultation_id", consultIds);

    if (lErr) {
      console.error(lErr);
    } else {
      const diagIds = [...new Set((links || []).map(x => x.diagnosis_id).filter(Boolean))];

      let diagMap = {};
      if (diagIds.length) {
        const { data: diags, error: dErr } = await window.sb
          .from("diagnoses_catalog")
          .select("id, label, code")
          .in("id", diagIds);

        if (dErr) console.error(dErr);
        else {
          (diags || []).forEach(d => {
            diagMap[d.id] = {
              id: d.id,
              label: d.label || "",
              code: d.code || ""
            };
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

  let treatByConsult = {};
  if (consultIds.length) {
    const { data: tlinks, error: tErr } = await window.sb
      .from("consultation_treatments")
      .select("consultation_id, treatment_id, qty")
      .in("consultation_id", consultIds);

    if (tErr) {
      console.error(tErr);
    } else {
      const tIds = [...new Set((tlinks || []).map(x => x.treatment_id).filter(Boolean))];

      let tMap = {};
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

    if (order && order.length) {
      const pos = new Map(order.map((id, i) => [String(id), i]));
      treatments = (treatments || []).slice().sort((a, b) => {
        const pa = pos.has(String(a.id)) ? pos.get(String(a.id)) : 1e9;
        const pb = pos.has(String(b.id)) ? pos.get(String(b.id)) : 1e9;
        return pa - pb;
      });
    }

    const a1 = (r.author_display_name || "").trim();
    const a2 = (authorMap[r.author_user_id] || "").trim();

    return ({
      ...r,
      author_name: a1 || a2 || "",
      diagnoses: diagByConsult[r.id] || [],
      treatments
    });
  });

  lastSavedConsultId = consultRows && consultRows.length ? (consultRows[0].id || null) : lastSavedConsultId;

  // ===== carregar registos de fisioterapia =====
  await loadPhysioRecords();

  timelineLoading = false;
}
/* ---- FIM FUNÇÃO 06G.15 ---- */

/* ---- FUNÇÃO 06G.16 — renderDocumentsInlineForConsult ---- */
  function renderDocumentsInlineForConsult(consultId) {
    const docs = (docRows || []).filter(d => d.consultation_id && String(d.consultation_id) === String(consultId));
    if (!docs.length) return "";

    function docStyle(title) {
      const t = String(title || "").toLowerCase();
      if (t.startsWith("pedido de exame"))
        return { border: "#bcd4f5", bg: "#f0f6ff", badge: "#1d6db5", label: "Exame" };
      if (t.startsWith("análise") || t.startsWith("analise"))
        return { border: "#b8e0c8", bg: "#f0faf4", badge: "#1a7a45", label: "Análise" };
      if (t.startsWith("relatório") || t.startsWith("relatorio"))
        return { border: "#e2e8f0", bg: "#f8fafc", badge: "#475569", label: "Relatório" };
      return { border: "#e2e8f0", bg: "#f8fafc", badge: "#475569", label: "Documento" };
    }

    return `
      <div style="margin-top:12px;">
        <div style="font-weight:900;">Documentos:</div>
        <div style="margin-top:8px; display:flex; flex-direction:column; gap:8px;">
          ${docs.map(d => {
            const s = docStyle(d.title);
            return `
            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;
                        padding:10px 12px;
                        border:1px solid ${s.border};
                        background:${s.bg};
                        border-radius:12px;">
              <div style="display:flex; flex-direction:column; gap:2px;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="
                    font-size:11px;
                    font-weight:700;
                    color:${s.badge};
                    background:${s.border};
                    padding:2px 8px;
                    border-radius:20px;
                    text-transform:uppercase;
                    letter-spacing:0.4px;
                  ">${s.label}</span>
                  <span style="font-weight:900;">
                    ${escAttr(d.title || "Documento")}
                    ${d.version ? `<span style="color:#64748b; font-size:12px; font-weight:400;">(v${escAttr(String(d.version))})</span>` : ``}
                  </span>
                </div>
                <div style="color:#94a3b8; font-size:12px; margin-left:2px;">
                  ${d.created_at ? escAttr(String(d.created_at)) : ""}
                </div>
              </div>
              <div style="display:flex; gap:8px;">
                ${d.url
                  ? `<a class="gcBtn" href="${escAttr(d.url)}" target="_blank" rel="noopener" style="text-decoration:none;">Abrir</a>`
                  : `<button class="gcBtn" disabled>Sem link</button>`
                }
              </div>
            </div>
          `;
          }).join("")}
        </div>
      </div>
    `;
  }
/* ---- FIM FUNÇÃO 06G.16 ---- */

  /* ---- FUNÇÃO 06G.17 — __gcRenderPhysioComposer ---- */
  function __gcRenderPhysioComposer() {
    const s = __ps();
    if (!__gcIsPhysio()) return ""; // só physio cria/edita

    if (!s.composerOpen) {
      return `
        <div style="display:flex; justify-content:flex-start;">
          <button id="btnAddPhysioRecord" class="gcBtn" type="button" style="font-weight:900;">+ Registo Fisioterapia</button>
        </div>
      `;
    }

    const title = s.editingId ? "Editar Registo de Fisioterapia" : "Novo Registo de Fisioterapia";

    return `
      <div style="border:1px solid #e5e5e5; border-radius:14px; padding:14px;">
        <style>
          /* ===== Editor fisio: altura ~10 linhas + mais compacto ===== */
          /* No Quill, #physioQuillEditor vira o .ql-container */
          #physioQuillEditor.ql-container.ql-snow {
            min-height: 320px;
          }
          #physioQuillEditor .ql-editor {
            min-height: 320px;
            line-height: 1.35;
            font-size: 15px;
          }
        </style>

        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
          <div style="font-weight:900; font-size:15px;">${title}</div>
          <div style="display:flex; gap:8px;">
            <button id="btnCancelPhysioComposer" class="gcBtn" type="button">Cancelar</button>
            <button id="btnSavePhysioRecord" class="gcBtn" type="button" style="font-weight:900;">Gravar</button>
          </div>
        </div>

        <div style="margin-top:10px;">
          <div id="physioQuillToolbar">
            <span class="ql-formats">
              <button class="ql-bold"></button>
              <button class="ql-underline"></button>
            </span>
            <span class="ql-formats">
              <button class="ql-list" value="ordered"></button>
              <button class="ql-list" value="bullet"></button>
            </span>
            <span class="ql-formats">
              <button class="ql-clean"></button>
            </span>
          </div>
          <div id="physioQuillEditor"></div>
        </div>
      </div>
    `;
  }
  /* ---- FIM FUNÇÃO 06G.17 ---- */

  /* ---- FUNÇÃO 06G.18 — __gcRenderPhysioItem ---- */
  function __gcRenderPhysioItem(r) {
    const d = r.created_at ? new Date(r.created_at) : null;
    const when = (d && !isNaN(d.getTime()))
      ? `${fmtDatePt(d)} às ${fmtTime(d)}`
      : (r.created_at ? String(r.created_at) : "—");

    const authorTxt = (r.author_name || "").trim();
    const uid = __gcGetUidCached();
    const canEdit = __gcIsPhysio() && uid && String(r.author_user_id) === String(uid);

    return `
      <div style="
        border:1px solid #e5e5e5;
        border-radius:14px;
        padding:16px;
        background:#f1f5f9; /* fundo discreto (azul-acinzentado muito claro) */
      ">
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px;">
          <div style="font-weight:900; font-size:16px;">
            Fisioterapia — ${when}${authorTxt ? ` - ${escAttr(authorTxt)}` : ``}
          </div>

          ${canEdit ? `
            <div style="display:flex; gap:8px;">
              <button class="gcBtn" type="button" data-physio-action="edit" data-physio-id="${escAttr(r.id)}">Editar</button>
              <button class="gcBtn" type="button" data-physio-action="delete" data-physio-id="${escAttr(r.id)}">Apagar</button>
            </div>
          ` : ``}
        </div>

        <div style="
          margin-top:8px;
          line-height:1.35; /* mais compacto */
          font-size:15px;
        ">
          ${sanitizeHTML(r.content || "") || `<span style="color:#64748b;">—</span>`}
        </div>
      </div>
    `;
  }
  /* ---- FIM FUNÇÃO 06G.18 ---- */

  /* ---- FUNÇÃO 06G.19 — __gcRenderAgendaNoteItem ---- */
  function __gcRenderAgendaNoteItem(r) {
    const d = r.start_at ? new Date(r.start_at) : null;
    const when = (d && !isNaN(d.getTime()))
      ? `${fmtDatePt(d)} às ${fmtTime(d)}`
      : (r.start_at ? String(r.start_at) : "—");

    const title = (r.title || r.procedure_type || "").trim();

    return `
      <div style="
        border:1px solid #e5e5e5;
        border-radius:14px;
        padding:16px;
        background:#fff7ed; /* laranja muito claro (administrativo) */
      ">
        <div style="font-weight:900; font-size:16px;">
          Nota da agenda — ${when}${title ? ` <span style="color:#64748b; font-weight:700;">(${escAttr(title)})</span>` : ``}
        </div>

        <div style="margin-top:8px; line-height:1.45; font-size:15px;">
          ${escAttr(String(r.notes || "").trim()) || `<span style="color:#64748b;">—</span>`}
        </div>
      </div>
    `;
  }
  /* ---- FIM FUNÇÃO 06G.19 ---- */

/* ---- FUNÇÃO 06G.20 — renderTimeline ---- */
function renderTimeline() {
  if (timelineLoading) return `<div style="color:#64748b;">A carregar registos...</div>`;

  const isSecretary = __gcIsSecretary();

  const noteRows = Array.isArray(agendaNoteRows) ? agendaNoteRows : [];
  const consultList = Array.isArray(consultRows) ? consultRows : [];
  const physioList = Array.isArray(__ps()?.rows) ? __ps().rows : [];

  const notesByAppointmentId = new Map();
  const linkedNoteIds = new Set();

  noteRows.forEach((r) => {
    const apptId = r && r.appointment_id ? String(r.appointment_id) : "";
    if (!apptId) return;
    if (!notesByAppointmentId.has(apptId)) notesByAppointmentId.set(apptId, []);
    notesByAppointmentId.get(apptId).push(r);
  });

  const items = [];

  if (!isSecretary) {
    physioList.forEach((r) => {
      const t = r && r.created_at ? new Date(r.created_at).getTime() : 0;
      items.push({
        type: "physio",
        ts: isNaN(t) ? 0 : t,
        row: r
      });
    });
  }

  consultList.forEach((r) => {
    const d = r && r.created_at ? new Date(r.created_at) : null;
    const t = (d && !isNaN(d.getTime()))
      ? d.getTime()
      : (r && r.report_date ? new Date(String(r.report_date)).getTime() : 0);

    items.push({
      type: isSecretary ? "consult_header" : "consult",
      ts: isNaN(t) ? 0 : t,
      row: r
    });

    const apptId = r && r.appointment_id ? String(r.appointment_id) : "";
    if (!apptId) return;

    const linkedNotes = notesByAppointmentId.get(apptId) || [];
    linkedNotes.forEach((n) => {
      if (n && n.id) linkedNoteIds.add(String(n.id));
    });
  });

  noteRows.forEach((r) => {
    const noteId = r && r.id ? String(r.id) : "";
    if (noteId && linkedNoteIds.has(noteId)) return;

    const t = r && r.start_at ? new Date(r.start_at).getTime() : 0;
    items.push({
      type: "agenda_note",
      ts: isNaN(t) ? 0 : t,
      row: r
    });
  });

  items.sort((a, b) => (b.ts || 0) - (a.ts || 0));

  if (!items.length) {
    if (isSecretary) {
      return `<div style="color:#64748b;">Sem registos.</div>`;
    }

    return `
      <div style="display:flex; flex-direction:column; gap:14px;">
        ${__gcRenderPhysioComposer()}
        <div style="color:#64748b;">Sem registos.</div>
      </div>
    `;
  }

  function renderLinkedAgendaNotesForConsult(consultRow) {
    const apptId = consultRow && consultRow.appointment_id ? String(consultRow.appointment_id) : "";
    if (!apptId) return "";

    const linkedNotes = notesByAppointmentId.get(apptId) || [];
    if (!linkedNotes.length) return "";

    linkedNotes.sort((a, b) => {
      const ta = a && a.start_at ? new Date(a.start_at).getTime() : 0;
      const tb = b && b.start_at ? new Date(b.start_at).getTime() : 0;
      return (tb || 0) - (ta || 0);
    });

    return linkedNotes.map((n) => __gcRenderAgendaNoteItem(n)).join("");
  }

  function renderConsultActions(r) {
    if (isSecretary) return "";

    const consultId = r && r.id ? String(r.id) : "";
    if (!consultId) return "";

    let canEdit = false;

    try {
      const created = r && r.created_at ? new Date(r.created_at).getTime() : null;
      if (created) {
        const now = Date.now();
        const diffHours = (now - created) / (1000 * 60 * 60);
        canEdit = diffHours <= 24;
      }
    } catch (_) {}

    return `
      <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">

        ${canEdit ? `
          <button
            class="gcBtn"
            data-action="edit-consult"
            data-consult-id="${escAttr(consultId)}"
            style="
              font-weight:700;
              background:#f8fafc;
              border:1px solid #cbd5e1;
              color:#334155;
            "
          >
            Editar Consulta
          </button>
        ` : `
          <div style="
            padding:6px 10px;
            font-size:13px;
            color:#64748b;
            border:1px dashed #cbd5e1;
            border-radius:8px;
            background:#f8fafc;
          ">
            Edição indisponível (&gt;24h)
          </div>
        `}

        <button
          class="gcBtn"
          data-action="consult-report"
          data-consult-id="${escAttr(consultId)}"
          style="
            font-weight:800;
            background:#166534;
            border:1px solid #166534;
            color:#ffffff;
          "
        >
          Relatório da Consulta
        </button>
      </div>
    `;
  }

  if (isSecretary) {
    return `
      <div style="display:flex; flex-direction:column; gap:14px;">
        ${items.map((it) => {
          if (it.type === "agenda_note") return __gcRenderAgendaNoteItem(it.row);

          const r = it.row;
          const d = r && r.created_at ? new Date(r.created_at) : null;
          const when = (d && !isNaN(d.getTime()))
            ? `${fmtDatePt(d)} às ${fmtTime(d)}`
            : (r && r.report_date ? String(r.report_date) : "—");
          const authorTxt = (r && r.author_name ? String(r.author_name) : "").trim();

          return `
            ${renderLinkedAgendaNotesForConsult(r)}
            <div style="border:1px solid #e5e7eb; border-radius:14px; overflow:hidden; background:#ffffff;">
              <div style="
                background:#f9fafb;
                border-bottom:1px solid #e5e7eb;
                padding:10px 16px;
                display:flex;
                justify-content:space-between;
                align-items:flex-start;
                gap:12px;
                flex-wrap:wrap;
              ">
                <div style="display:flex; flex-direction:column;">
                  <div style="font-weight:900; font-size:15px; color:#0f172a;">Consulta</div>
                  <div style="font-size:13px; color:#475569; margin-top:2px;">
                    ${when}${authorTxt ? ` • ${escAttr(authorTxt)}` : ``}
                  </div>
                </div>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  return `
    <div style="display:flex; flex-direction:column; gap:14px;">
      ${__gcRenderPhysioComposer()}

      ${items.map((it) => {
        if (it.type === "agenda_note") return __gcRenderAgendaNoteItem(it.row);
        if (it.type === "physio") return __gcRenderPhysioItem(it.row);

        const r = it.row;
        const d = r && r.created_at ? new Date(r.created_at) : null;
        const when = (d && !isNaN(d.getTime()))
          ? `${fmtDatePt(d)} às ${fmtTime(d)}`
          : (r && r.report_date ? String(r.report_date) : "—");

        const authorTxt = (r && r.author_name ? String(r.author_name) : "").trim();

        return `
          ${renderLinkedAgendaNotesForConsult(r)}
          <div style="border:1px solid #e5e7eb; border-radius:14px; overflow:hidden; background:#ffffff;">
            <div style="
              background:#f9fafb;
              border-bottom:1px solid #e5e7eb;
              padding:10px 16px;
              display:flex;
              justify-content:space-between;
              align-items:flex-start;
              gap:12px;
              flex-wrap:wrap;
            ">
              <div style="display:flex; flex-direction:column;">
                <div style="font-weight:900; font-size:15px; color:#0f172a;">Consulta</div>
                <div style="font-size:13px; color:#475569; margin-top:2px;">
                  ${when}${authorTxt ? ` • ${escAttr(authorTxt)}` : ``}
                </div>
              </div>

              <div style="display:flex; gap:8px; flex-wrap:wrap;">
                ${renderConsultActions(r)}
              </div>
            </div>

            <div style="padding:16px;">
              <div style="font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; color:#64748b; margin-bottom:8px;">
                Anamnese / HDA
              </div>

              <div style="
                line-height:1.65;
                font-size:15px;
                color:#111827;
                background:#ffffff;
              ">
                ${sanitizeHTML(r.hda || "") || `<span style="color:#64748b;">—</span>`}
              </div>

              ${r.diagnoses && r.diagnoses.length ? `
                <div style="margin-top:16px;">
                  <div style="font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; color:#64748b; margin-bottom:8px;">
                    Diagnósticos
                  </div>
                  <ul style="margin:0 0 0 18px; line-height:1.55;">
                    ${r.diagnoses.map(dg => `
                      <li>${escAttr(dg.label || "—")}${dg.code ? ` <span style="color:#64748b;">(${escAttr(dg.code)})</span>` : ``}</li>
                    `).join("")}
                  </ul>
                </div>
              ` : ``}

              ${r.treatments && r.treatments.length ? `
                <div style="margin-top:16px;">
                  <div style="font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; color:#64748b; margin-bottom:8px;">
                    Tratamentos
                  </div>
                  <ul style="margin:0 0 0 18px; line-height:1.55;">
                    ${r.treatments.map(t => `
                      <li>${escAttr(sentenceizeLabel(t.label || "—"))}${t.code ? ` <span style="color:#64748b;">(${escAttr(t.code)})</span>` : ``}</li>
                    `).join("")}
                  </ul>
                </div>
              ` : ``}

              ${renderDocumentsInlineForConsult(r.id)}
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}
/* ---- FIM FUNÇÃO 06G.20 ---- */

  /* ---- FUNÇÃO 06G.21 — __gcInstallPhysioTimelineHooksOnce ---- */
  // ===== Hooks (uma vez): click actions + init Quill via MutationObserver =====
  function __gcInstallPhysioTimelineHooksOnce() {
    if (window.__gcPhysioTimelineHooksInstalled) return;
    window.__gcPhysioTimelineHooksInstalled = true;

    document.addEventListener("click", async (ev) => {
      const t = ev.target;
      const s = __ps();

      if (t && t.id === "btnAddPhysioRecord") {
        ev.preventDefault();
        await __gcGetUidAsync(); // garante cache uid
        s.composerOpen = true;
        s.editingId = null;
        s.draftHtml = "";
        window.__gcPhysioQuill = null;
        render();
        return;
      }

      if (t && t.id === "btnCancelPhysioComposer") {
        ev.preventDefault();
        s.composerOpen = false;
        s.editingId = null;
        s.draftHtml = "";
        window.__gcPhysioQuill = null;
        render();
        return;
      }

      if (t && t.id === "btnSavePhysioRecord") {
        ev.preventDefault();
        if (s.saving) return;

        if (!__gcIsPhysio()) return;

        const uid = await __gcGetUidAsync();
        if (!uid) { alert("Sem utilizador autenticado."); return; }

        try {
          const q = window.__gcPhysioQuill;
          if (q && q.root) s.draftHtml = q.root.innerHTML || "";
        } catch (_) {}

        const html = String(s.draftHtml || "").trim();
        if (!html || html === "<p><br></p>") { alert("Registo vazio."); return; }

        const clinicId = __gcGuessClinicIdForPhysioRecord();
        if (!clinicId) { alert("Sem clinic_id ativo para gravar o registo."); return; }

        s.saving = true;

        try {
          if (s.editingId) {
            const { error } = await window.sb
              .from("physio_records")
              .update({ content: html })
              .eq("id", s.editingId);
            if (error) throw error;
          } else {
            const { error } = await window.sb
              .from("physio_records")
              .insert([{
                clinic_id: clinicId,
                patient_id: p.id,
                author_user_id: uid,
                content: html
              }]);
            if (error) throw error;
          }

          s.composerOpen = false;
          s.editingId = null;
          s.draftHtml = "";
          window.__gcPhysioQuill = null;

          await loadPhysioRecords();
          render();

        } catch (e) {
          console.error(e);
          alert("Erro a gravar registo de fisioterapia.");
        } finally {
          s.saving = false;
        }

        return;
      }

      const actionBtn = t && t.closest ? t.closest("[data-physio-action]") : null;
      if (actionBtn) {
        ev.preventDefault();

        const action = actionBtn.getAttribute("data-physio-action");
        const id = actionBtn.getAttribute("data-physio-id");
        if (!action || !id) return;

        const uid = await __gcGetUidAsync();
        if (!__gcIsPhysio() || !uid) return;

        const row = (__ps().rows || []).find(x => String(x.id) === String(id));
        if (!row) return;
        if (String(row.author_user_id) !== String(uid)) return;

        if (action === "edit") {
          s.composerOpen = true;
          s.editingId = row.id;
          s.draftHtml = String(row.content || "");
          window.__gcPhysioQuill = null;
          render();
          return;
        }

        if (action === "delete") {
          if (!confirm("Apagar este registo de fisioterapia?")) return;

          try {
            const { error } = await window.sb
              .from("physio_records")
              .delete()
              .eq("id", row.id);

            if (error) throw error;

            await loadPhysioRecords();
            render();
          } catch (e) {
            console.error(e);
            alert("Erro a apagar registo de fisioterapia.");
          }
          return;
        }
      }
    });

    const obs = new MutationObserver(() => {
      try {
        const host = document.getElementById("physioQuillEditor");
        const tb = document.getElementById("physioQuillToolbar");
        if (!host || !tb) return;

        if (window.__gcPhysioQuill) return;
        if (!window.Quill) return;

        const q = new window.Quill(host, {
          theme: "snow",
          modules: { toolbar: tb }
        });

        q.root.setAttribute("spellcheck", "true");
        q.root.setAttribute("lang", "pt-PT");
        q.root.setAttribute("autocapitalize", "sentences");

        // ===== Garantir altura + compactação (definitivo) =====
        try {
          // container (host) já é .ql-container
          host.style.minHeight = "320px";
          // editor interno
          q.root.style.minHeight = "320px";
          q.root.style.lineHeight = "1.35";
          q.root.style.fontSize = "15px";
        } catch (_) {}

        const s = __ps();
        const initialHtml = String(s.draftHtml || "");
        if (initialHtml.trim().length) {
          try { q.clipboard.dangerouslyPasteHTML(initialHtml); }
          catch (_) { q.setText(initialHtml); }
        } else {
          q.setText("");
        }

        q.on("text-change", () => {
          s.draftHtml = q.root.innerHTML || "";
        });

        s.draftHtml = q.root.innerHTML || "";
        window.__gcPhysioQuill = q;

        // Fix bold/underline toggle no Quill 1.3.6
        document.getElementById("physioQuillToolbar")?.querySelector(".ql-bold")?.addEventListener("mousedown", (e) => {
          e.preventDefault();
          const format = q.getFormat();
          q.format("bold", !format.bold);
        });
        document.getElementById("physioQuillToolbar")?.querySelector(".ql-underline")?.addEventListener("mousedown", (e) => {
          e.preventDefault();
          const format = q.getFormat();
          q.format("underline", !format.underline);
        });
      } catch (_) {}
    });

    obs.observe(document.body, { childList: true, subtree: true });
  }
  /* ---- FIM FUNÇÃO 06G.21 ---- */

  __gcInstallPhysioTimelineHooksOnce();
/* ==== FIM BLOCO 06G/12 — Timeline (load + render + physio_records) ==== */


/* ==== INÍCIO BLOCO 06H/12 — Consulta médica (UI HDA + Quill + Spellcheck) ==== */

/* ---- FUNÇÃO 06H.0 — openConsultForEdit ---- */
function openConsultForEdit(consultId) {
  const row = (consultRows || []).find(x => String(x.id) === String(consultId));
  if (!row) {
    alert("Consulta não encontrada.");
    return;
  }

  editingConsultId = row.id || null;
  editingConsultRow = row || null;
  creatingConsult = true;

  draftHDAHtml = String(row.hda || "");

  diagQuery = "";
  diagLoading = false;
  diagResults = [];
  selectedDiag = Array.isArray(row.diagnoses)
    ? row.diagnoses.map(d => ({
        id: d.id,
        label: d.label || "",
        code: d.code || ""
      }))
    : [];

  prescriptionText =
    getPrescriptionTextFromPlan(row.plan_text) ||
    "R/ 20 Sessões de Tratamentos de Medicina Fisica e de Reabilitação com:";

  treatQuery = "";
  treatLoading = false;
  treatResults = [];
  selectedTreat = Array.isArray(row.treatments)
    ? row.treatments.map(t => ({
        id: t.id,
        label: t.label || "",
        code: t.code || "",
        qty: Number(t.qty || 1)
      }))
    : [];

  render();
  bindConsultEvents();
}
/* ---- FIM FUNÇÃO 06H.0 ---- */

  /* ---- FUNÇÃO 06H.1 — renderConsultFormInline ---- */
  function renderConsultFormInline() {
    const today = new Date().toISOString().slice(0, 10);

    return `
    <div style="margin-top:16px; padding:16px; border:1px solid #e5e5e5; border-radius:14px;">

      <style>
        .gcQuillWrap { margin-top: 10px; }

        .gcQuillWrap .ql-toolbar.ql-snow {
          border: 1px solid #ddd;
          border-radius: 12px 12px 0 0;
        }

        .gcQuillWrap .ql-container.ql-snow {
          border: 1px solid #ddd;
          border-top: none;
          border-radius: 0 0 12px 12px;
          min-height: 240px;
          font-size: 16px;
        }

        .gcQuillWrap .ql-editor {
          line-height: 1.6;
        }
      </style>

      <div style="font-weight:900; font-size:16px;">Nova Consulta Médica</div>

      <div style="margin-top:10px;">
        <label>Data</label>
        <input type="date" value="${today}" readonly
               style="padding:8px; border:1px solid #ddd; border-radius:8px;" />
      </div>

      <div class="gcQuillWrap">
        <div id="hdaQuillToolbar">
          <span class="ql-formats">
            <button class="ql-bold"></button>
            <button class="ql-underline"></button>
          </span>
          <span class="ql-formats">
            <button class="ql-list" value="ordered"></button>
            <button class="ql-list" value="bullet"></button>
          </span>
          <span class="ql-formats">
            <button class="ql-clean"></button>
          </span>
        </div>

        <div id="hdaQuillEditor"></div>
      </div>

      <div style="margin-top:14px;">
        <label>Diagnóstico (catálogo)</label>
        <div style="position:relative; margin-top:6px; max-width:720px;">
          <input id="diagSearch" value="${escAttr(diagQuery)}"
                 placeholder="Pesquisar (mín. 2 letras)…"
                 style="width:100%; padding:10px; border:1px solid #ddd; border-radius:10px;" />
          <div id="diagStatus"></div>
          <div id="diagDropdownHost" style="position:relative;"></div>
        </div>
        <div id="diagChips"></div>
      </div>

      <div style="margin-top:14px;">
        <label>Tratamentos (catálogo)</label>

        <div style="margin-top:6px; max-width:980px;">
          <input id="prescriptionText" value="${escAttr(prescriptionText)}"
                 style="width:100%; padding:10px; border:1px solid #ddd; border-radius:10px;" />

          <div style="margin-top:6px; display:flex; gap:10px; flex-wrap:wrap;">
            <div style="flex:1; min-width:320px;">
              <div style="font-weight:900; margin-bottom:6px;">Selecionados</div>
              <div id="treatSelectedBox"
                   style="min-height:120px; padding:12px; border:1px solid #e5e5e5; border-radius:12px; background:#fff;"></div>
            </div>

            <div style="flex:1; min-width:320px;">
              <div style="font-weight:900; margin-bottom:6px;">Catálogo</div>
              <input id="treatSearch" value="${escAttr(treatQuery)}"
                     placeholder="Pesquisar tratamentos (mín. 2 letras)…"
                     style="width:100%; padding:10px; border:1px solid #ddd; border-radius:10px;" />
              <div id="treatStatus"></div>
              <div id="treatCatalogBox"
                   style="margin-top:8px; min-height:120px; max-height:220px; overflow:auto;
                          padding:12px; border:1px solid #e5e5e5; border-radius:12px; background:#fff;"></div>
            </div>
          </div>
        </div>
      </div>

      <div style="margin-top:14px; display:flex; justify-content:flex-start; gap:10px;">
        <button id="btnCancelConsult" class="gcBtn" type="button">Cancelar</button>
        <button id="btnSaveConsult" class="gcBtn" type="button" style="font-weight:900;">Gravar</button>
      </div>
    </div>
  `;
  }
  /* ---- FIM FUNÇÃO 06H.1 ---- */

  /* ---- FUNÇÃO 06H.2 — bindConsultEvents ---- */
  function bindConsultEvents() {

    const qRoot = document.getElementById("hdaQuillEditor");
    const qToolbar = document.getElementById("hdaQuillToolbar");

    window.__gcQuillHDA = null;

    if (qRoot && window.Quill) {

      const quill = new window.Quill(qRoot, {
        theme: "snow",
        modules: { toolbar: qToolbar }
      });

      // 🔎 ATIVAR DICIONÁRIO (Chrome)
      quill.root.setAttribute("spellcheck", "true");
      quill.root.setAttribute("lang", "pt-PT");
      quill.root.setAttribute("autocapitalize", "sentences");

      window.__gcQuillHDA = quill;

      // Fix bold/underline toggle no Quill 1.3.6
      document.getElementById("hdaQuillToolbar")?.querySelector(".ql-bold")?.addEventListener("mousedown", (e) => {
        e.preventDefault();
        const format = quill.getFormat();
        quill.format("bold", !format.bold);
      });
      document.getElementById("hdaQuillToolbar")?.querySelector(".ql-underline")?.addEventListener("mousedown", (e) => {
        e.preventDefault();
        const format = quill.getFormat();
        quill.format("underline", !format.underline);
      });

      const initialHtml = String(draftHDAHtml || "");
      if (initialHtml.trim().length) {
        try {
          quill.clipboard.dangerouslyPasteHTML(initialHtml);
        } catch (_) {
          quill.setText(initialHtml);
        }
      } else {
        quill.setText("");
      }

      quill.on("text-change", () => {
        draftHDAHtml = quill.root.innerHTML || "";
      });

      draftHDAHtml = quill.root.innerHTML || "";
    }

    // ===== Diagnósticos =====
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
      diagInput.onkeydown = (ev) => { if (ev.key === "Enter") ev.preventDefault(); };
    }

    renderDiagArea();

    // ===== Tratamentos =====
    const pr = document.getElementById("prescriptionText");
    if (pr) pr.oninput = (e) => { prescriptionText = e?.target?.value ?? ""; };

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
      tInput.onkeydown = (ev) => { if (ev.key === "Enter") ev.preventDefault(); };
    }

    renderTreatArea();

    if (!treatResults || !treatResults.length) fetchTreatmentsDefault();

    // ===== Cancelar / Gravar =====
    document.getElementById("btnCancelConsult")?.addEventListener("click", () => {
      creatingConsult = false;
      render();
    });

    const btnSave = document.getElementById("btnSaveConsult");
    if (btnSave) {
      btnSave.disabled = !!saving;
      btnSave.onclick = async () => {
        if (saving) return;
        saving = true;
        btnSave.disabled = true;

        try {
          const quill = window.__gcQuillHDA;
          if (quill && quill.root) draftHDAHtml = quill.root.innerHTML || "";
        } catch (_) {}

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
  /* ---- FIM FUNÇÃO 06H.2 ---- */
/* ==== FIM BLOCO 06H/12 — Consulta médica (UI HDA + Quill + Spellcheck) ==== */


/* ==== INÍCIO BLOCO 06I/12 — saveConsult (insert + upsert ligações + reset) ==== */

/* ---- FUNÇÃO 06I.1 — saveConsult ---- */
async function saveConsult() {
  try {
    const userRes = await window.sb.auth.getUser();
    const userId = userRes?.data?.user?.id;
    if (!userId) { alert("Utilizador não autenticado."); return false; }

    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const isEditing = !!editingConsultId;

    if (!activeClinicId) { alert("Sem clínica ativa associada ao doente."); return false; }

    let appointmentId = null;

    if (!isEditing) {
      const { data: appts, error: apptErr } = await window.sb
        .from("appointments")
        .select("*")
        .eq("patient_id", p.id);

      if (apptErr) console.error(apptErr);

      if (appts && appts.length) {
        const sameDay = appts.filter(a => a.start_at && a.start_at.slice(0, 10) === today);
        if (sameDay.length) {
          sameDay.sort((a, b) => Math.abs(new Date(a.start_at) - now) - Math.abs(new Date(b.start_at) - now));
          appointmentId = sameDay[0].id;
        }
      }
    }

    const planPayload = {
      prescriptionText,
      treat_order: (selectedTreat || []).map(x => x.id)
    };

    let consultId = null;

    if (isEditing) {
      consultId = editingConsultId;

      const reportDateToKeep =
        (editingConsultRow && editingConsultRow.report_date)
          ? String(editingConsultRow.report_date)
          : today;

      const { error: updErr } = await window.sb
        .from("consultations")
        .update({
          clinic_id: activeClinicId,
          patient_id: p.id,
          report_date: reportDateToKeep,
          hda: draftHDAHtml,
          plan_text: JSON.stringify(planPayload)
        })
        .eq("id", consultId);

      if (updErr) {
        console.error(updErr);
        alert("Erro ao atualizar consulta.");
        return false;
      }
    } else {
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

      if (insErr) {
        console.error(insErr);
        alert("Erro ao gravar consulta.");
        return false;
      }

      consultId = ins?.id || null;
    }

    if (!consultId) {
      alert("Não foi possível determinar a consulta a gravar.");
      return false;
    }

    lastSavedConsultId = consultId;

    const { error: delDiagErr } = await window.sb
      .from("consultation_diagnoses")
      .delete()
      .eq("consultation_id", consultId);

    if (delDiagErr) {
      console.error(delDiagErr);
      alert("Consulta gravada, mas houve erro a limpar diagnósticos antigos.");
      return false;
    }

    if (selectedDiag && selectedDiag.length) {
      const diagRows = selectedDiag
        .filter(x => x && x.id !== undefined && x.id !== null && String(x.id).trim() !== "")
        .map(x => ({
          consultation_id: consultId,
          diagnosis_id: String(x.id)
        }));

      console.log("DIAG ROWS TO INSERT:", diagRows);
      console.log("SELECTED DIAG RAW:", selectedDiag);

      if (diagRows.length) {
        const { error: dErr } = await window.sb
          .from("consultation_diagnoses")
          .insert(diagRows);

        if (dErr) {
          console.error("ERRO consultation_diagnoses:", dErr);
          alert("Consulta gravada, mas houve erro a gravar diagnósticos.");
          return false;
        }
      }
    }

    const { error: delTreatErr } = await window.sb
      .from("consultation_treatments")
      .delete()
      .eq("consultation_id", consultId);

    if (delTreatErr) {
      console.error(delTreatErr);
      alert("Consulta gravada, mas houve erro a limpar tratamentos antigos.");
      return false;
    }

    if (selectedTreat && selectedTreat.length) {
      const treatRows = selectedTreat.map(x => ({
        consultation_id: consultId,
        treatment_id: x.id,
        qty: Number(x.qty || 1)
      }));

      const { error: tErr } = await window.sb
        .from("consultation_treatments")
        .insert(treatRows);

      if (tErr) {
        console.error(tErr);
        alert("Consulta gravada, mas houve erro a gravar tratamentos.");
        return false;
      }
    }

    if (!isEditing && appointmentId) {
      const { error: uErr } = await window.sb
        .from("appointments")
        .update({ status: "done" })
        .eq("id", appointmentId);

      if (uErr) console.error(uErr);
    }

    try {
      if (typeof refreshAgenda === "function") await refreshAgenda();
      else if (typeof renderAgendaList === "function") renderAgendaList();
    } catch (e) {
      console.error("refreshAgenda falhou:", e);
    }

    editingConsultId = null;
    editingConsultRow = null;

    draftHDAHtml = "";
    diagQuery = ""; diagLoading = false; diagResults = []; selectedDiag = [];
    prescriptionText = "R/ 20 Sessões de Tratamentos de Medicina Fisica e de Reabilitação com:";
    treatQuery = ""; treatLoading = false; treatResults = []; selectedTreat = [];

    alert(isEditing ? "Consulta atualizada." : "Consulta gravada.");
    return true;

  } catch (err) {
    console.error(err);
    alert("Erro ao gravar consulta.");
    return false;
  }
}
/* ---- FIM FUNÇÃO 06I.1 ---- */
  
/* ==== FIM BLOCO 06I/12 — saveConsult (insert + upsert ligações + reset) ==== */

/* ==== INÍCIO BLOCO 06J/12 — Render + Wiring + Boot (inclui Tel→Clínica no cabeçalho) ==== */
/* ---- FUNÇÃO 06J.1 — render ---- */
function render() {
  console.log("06J render OK");

  root.innerHTML = `
    <div style="position:fixed; inset:0; background:rgba(0,0,0,0.35);
                display:flex; align-items:center; justify-content:center; padding:12px;">
      <div style="background:#fff; width:min(1400px,96vw);
                  height:92vh; border-radius:14px;
                  border:1px solid #e5e5e5; padding:18px; overflow:auto; box-sizing:border-box;">

        <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:10px;">
          <div style="font-weight:800; font-size:14px; color:#111827; letter-spacing:0.2px;">
            Feed do Doente
          </div>
          <button
            id="btnClosePView"
            class="gcBtn"
            style="
              background:#ffffff;
              border:1px solid #d1d5db;
              color:#111827;
              font-weight:700;
            "
          >
            Fechar
          </button>
        </div>

        <div style="border:1px solid #e5e7eb; border-radius:14px; padding:16px; background:#fcfcfd;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap;">
            <div style="min-width:280px; flex:1;">
              <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                <div style="font-weight:900; font-size:28px; line-height:1.1; color:#111827;">
                  ${escAttr(p.full_name || "—")}
                </div>
                <div>${birthdayBadgeToday()}</div>
              </div>

              <div style="margin-top:10px; display:flex; gap:10px 18px; flex-wrap:wrap; color:#475569; font-size:14px; line-height:1.45;">
                <div><span style="font-weight:700; color:#334155;">Telefone:</span> ${escAttr(p.phone || "—")}</div>
                <div><span style="font-weight:700; color:#334155;">Clínica:</span> ${escAttr(activeClinicName || "—")}</div>
                <div><span style="font-weight:700; color:#334155;">SNS:</span> ${escAttr(p.sns || "—")}</div>
                <div><span style="font-weight:700; color:#334155;">Seguro:</span> ${escAttr(p.insurance_provider || "—")}</div>
                <div><span style="font-weight:700; color:#334155;">Nº:</span> ${escAttr(p.insurance_policy_number || "—")}</div>
                <div><span style="font-weight:700; color:#334155;">Idade:</span> ${escAttr(ageTextToday())}</div>
              </div>
            </div>

            <div style="display:flex; gap:10px; align-items:flex-start; flex-wrap:wrap;">
              <button
                id="btnViewIdent"
                class="gcBtn"
                style="
                  background:#ffffff;
                  border:1px solid #d1d5db;
                  color:#111827;
                  font-weight:700;
                "
              >
                Ver Identificação
              </button>
            </div>
          </div>

          <div style="margin-top:14px; height:1px; background:#e5e7eb;"></div>

          ${isDoctor() && !creatingConsult ? `
            <div style="margin-top:14px;">
              <div style="font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:0.6px; color:#64748b; margin-bottom:10px;">
                Ações médicas
              </div>

              <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
                <button
                  id="btnNewConsult"
                  class="gcBtn"
                  style="
                    font-weight:800;
                    background:#1e3a8a;
                    border:1px solid #1e3a8a;
                    color:#ffffff;
                  "
                >
                  Consulta Médica
                </button>

                <button
                  id="btnMedicalReports"
                  class="gcBtn"
                  style="
                    background:#ffffff;
                    border:1px solid #cbd5e1;
                    color:#0f172a;
                    font-weight:700;
                  "
                >
                  Relatórios
                </button>

                <button
                  id="btnComplementaryExams"
                  class="gcBtn"
                  style="
                    background:#ffffff;
                    border:1px solid #cbd5e1;
                    color:#0f172a;
                    font-weight:700;
                  "
                >
                  Exames
                </button>

                <button
                  id="btnAnalyses"
                  class="gcBtn"
                  style="
                    background:#ffffff;
                    border:1px solid #cbd5e1;
                    color:#0f172a;
                    font-weight:700;
                  "
                >
                  Análises
                </button>
              </div>
            </div>
          ` : ``}

          ${docsLoading ? `
            <div style="margin-top:10px; color:#64748b; font-size:14px;">
              A carregar PDFs…
            </div>
          ` : ``}
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

  document.getElementById("btnClosePView")?.addEventListener("click", closeModalSafe);

  document.getElementById("btnViewIdent")?.addEventListener("click", () => openPatientIdentity("view"));

  if (isDoctor() && !creatingConsult) {
    document.getElementById("btnNewConsult")?.addEventListener("click", () => {
      editingConsultId = null;
      editingConsultRow = null;
      creatingConsult = true;
      render();
      bindConsultEvents();
    });

    document.getElementById("btnComplementaryExams")?.addEventListener("click", () => {
      const consultId = lastSavedConsultId || (consultRows && consultRows.length ? consultRows[0].id : null);
      openExamsPanel({ patientId: p.id, consultationId: consultId || null });
    });
  }

  document.querySelectorAll('[data-action="edit-consult"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const consultId = btn.getAttribute("data-consult-id") || "";
      if (!consultId) return;
      openConsultForEdit(consultId);
    });
  });

  document.querySelectorAll('[data-action="consult-report"]').forEach((btn) => {
    btn.addEventListener("click", async () => {
      const consultId = btn.getAttribute("data-consult-id") || "";
      if (!consultId) return;

      const userRes = await window.sb.auth.getUser();
      const userId = userRes?.data?.user?.id;

      const consult = (consultRows || []).find(x => String(x.id) === String(consultId));
      if (!consult) { alert("Consulta não encontrada."); return; }

      const clinic = await fetchClinicForPdf();
      const authorName = userId ? await fetchCurrentUserDisplayName(userId) : "";

      let vinhetaUrl = "";
      try {
        const vinhetaSignedUrl = await storageSignedUrl(VINHETA_BUCKET, VINHETA_PATH, 3600);
        console.log("VINHETA signed URL:", vinhetaSignedUrl);

        if (vinhetaSignedUrl) {
          vinhetaUrl = await urlToDataUrl(vinhetaSignedUrl, "image/png");
        }

        console.log("VINHETA data URL prefix:", vinhetaUrl ? vinhetaUrl.slice(0, 80) : "(vazia)");
      } catch (e) {
        console.warn("Editor: vinheta falhou:", e);
        vinhetaUrl = "";
      }

      const html = buildDocV1Html({
        clinic,
        consult,
        authorName,
        vinhetaUrl
      });

      openDocumentEditor(html);
    });
  });

  if (creatingConsult) bindConsultEvents();
  if (identOpen) bindIdentityEvents();
  if (docOpen) bindDocEvents();
}
/* ---- FIM FUNÇÃO 06J.1 ---- */

/* ---- FUNÇÃO 06J.2 — boot ---- */
(async function boot() {
  try {
    await fetchActiveClinic();
    await loadConsultations();
    await loadDocuments();
  } catch (e) {
    console.error("boot modal falhou:", e);
  }
  render();
})();
/* ---- FIM FUNÇÃO 06J.2 ---- */

} // <-- fecha openPatientViewModal
/* ---- FIM FUNÇÃO 06B.1 ---- */

/* ==== FIM BLOCO 06J/12 — Render + Wiring + Boot (inclui Tel→Clínica no cabeçalho) ==== */

/* ==== FIM BLOCO 06/12 — Modal Doente (06A–06J) ==== */

/* ========================================================
   BLOCO 07/12 — Novo doente (modal página inicial)
   MAPA DE NAVEGAÇÃO
   --------------------------------------------------------
   07A — Abertura e render do modal
   07B — Estado local e fecho do modal
   07C — Validação
   07D — Estado do botão / feedback
   07E — Criação do doente
   ======================================================== */

/* ==== INÍCIO BLOCO 07A — Abertura e render do modal ==== */
  /* ---- FUNÇÃO 07A.1 — openNewPatientMainModal ---- */
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
  /* ==== FIM BLOCO 07A — Abertura e render do modal ==== */


/* ==== INÍCIO BLOCO 07B — Estado local e fecho do modal ==== */
    /* ---- FUNÇÃO 07B.1 — setErr ---- */
    function setErr(msg) { if (npMsg) { npMsg.style.color = "#b00020"; npMsg.textContent = msg; } }
    /* ---- FIM FUNÇÃO 07B.1 ---- */

    /* ---- FUNÇÃO 07B.2 — setInfo ---- */
    function setInfo(msg) { if (npMsg) { npMsg.style.color = "#666"; npMsg.textContent = msg; } }
    /* ---- FIM FUNÇÃO 07B.2 ---- */

    /* ---- FUNÇÃO 07B.3 — close ---- */
    function close() { closeModalRoot(); }
    /* ---- FIM FUNÇÃO 07B.3 ---- */

    if (btnClose) btnClose.addEventListener("click", close);
    if (npCancel) npCancel.addEventListener("click", close);
    if (overlay) overlay.addEventListener("click", (ev) => { if (ev.target && ev.target.id === "npMainOverlay") close(); });
/* ==== FIM BLOCO 07B — Estado local e fecho do modal ==== */


/* ==== INÍCIO BLOCO 07C — Validação ==== */
    /* ---- FUNÇÃO 07C.1 — validate ---- */
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
    /* ---- FIM FUNÇÃO 07C.1 ---- */
/* ==== FIM BLOCO 07C — Validação ==== */


/* ==== INÍCIO BLOCO 07D — Estado do botão / feedback ==== */
    /* ---- FUNÇÃO 07D.1 — refreshButtonState ---- */
    function refreshButtonState() {
      if (npSNS) { const d = normalizeDigits(npSNS.value); if (npSNS.value !== d) npSNS.value = d; }
      if (npNIF) { const d = normalizeDigits(npNIF.value); if (npNIF.value !== d) npNIF.value = d; }

      const v = validate();
      if (!v.ok) { npCreate.disabled = true; setErr(v.msg); }
      else { npCreate.disabled = false; setInfo("OK para criar."); }
    }
    /* ---- FIM FUNÇÃO 07D.1 ---- */

    [
      npFullName, npDob, npPhone, npEmail, npSNS, npNIF, npPassport,
      npInsuranceProvider, npInsurancePolicy, npAddress1, npPostal, npCity, npCountry, npNotes
    ].forEach((el) => {
      if (!el) return;
      el.addEventListener("input", refreshButtonState);
      el.addEventListener("change", refreshButtonState);
    });
/* ==== FIM BLOCO 07D — Estado do botão / feedback ==== */


/* ==== INÍCIO BLOCO 07E — Criação do doente ==== */
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
  /* ---- FIM FUNÇÃO 07A.1 ---- */
/* ==== FIM BLOCO 07E — Criação do doente ==== */

/* ==== FIM BLOCO 07/12 — Novo doente (modal página inicial) ==== */

/* ========================================================
   BLOCO 08/12 — Pesquisa rápida (wiring) + Calendário mensal overlay
   MAPA DE NAVEGAÇÃO
   --------------------------------------------------------
   08A — Wiring da pesquisa rápida
   08B — Helpers do calendário mensal
   08C — Interface do calendário mensal
   ======================================================== */

/* ==== INÍCIO BLOCO 08A — Wiring da pesquisa rápida ==== */
  /* ---- FUNÇÃO 08A.1 — wireQuickPatientSearch ---- */
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
  /* ---- FIM FUNÇÃO 08A.1 ---- */
/* ==== FIM BLOCO 08A — Wiring da pesquisa rápida ==== */


/* ==== INÍCIO BLOCO 08B — Helpers do calendário mensal ==== */
  /* ---- FUNÇÃO 08B.1 — monthLabel ---- */
  function monthLabel(d) {
    const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
  }
  /* ---- FIM FUNÇÃO 08B.1 ---- */

  /* ---- FUNÇÃO 08B.2 — buildMonthGrid ---- */
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
  /* ---- FIM FUNÇÃO 08B.2 ---- */
/* ==== FIM BLOCO 08B — Helpers do calendário mensal ==== */


/* ==== INÍCIO BLOCO 08C — Interface do calendário mensal ==== */
  /* ---- FUNÇÃO 08C.1 — openCalendarOverlay ---- */
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
  /* ---- FIM FUNÇÃO 08C.1 ---- */
/* ==== FIM BLOCO 08C — Interface do calendário mensal ==== */

/* ==== FIM BLOCO 08/12 — Pesquisa rápida (wiring) + Calendário mensal overlay ==== */

/* ========================================================
   BLOCO 09/12 — Modal marcação (helpers + UI + pesquisa + novo doente interno + save)
   MAPA DE NAVEGAÇÃO
   --------------------------------------------------------
   09A — Helpers base + GCAL + datas/horas
   09B — Transferência automática de doente entre clínicas
   09C — openApptModal: render UI + refs DOM + wiring base
   09D — openApptModal: pesquisa doente + novo doente interno + UI dinâmica
   09E — openApptModal: eliminar + guardar consulta/bloqueio + wiring final
   ======================================================== */

/* ==== INÍCIO BLOCO 09A — Helpers base + GCAL + datas/horas ==== */

  /* ---- FUNÇÃO 09A.1 — closeModal ---- */
  function closeModal() {
    closeModalRoot();
  }
  /* ---- FIM FUNÇÃO 09A.1 ---- */

  /* ---- FUNÇÃO 09A.2 — calcEndFromStartAndDuration ---- */
  function calcEndFromStartAndDuration(startLocalStr, durMin) {
    const s = fromLocalInputValue(startLocalStr);
    if (!s || isNaN(s.getTime())) return null;
    const e = new Date(s.getTime() + durMin * 60000);
    return { startAt: s.toISOString(), endAt: e.toISOString() };
  }
  /* ---- FIM FUNÇÃO 09A.2 ---- */

  /* ---- FUNÇÃO 09A.3 — makeAutoTitle ---- */
  function makeAutoTitle(patientName, procType) {
    const n = (patientName || "").trim();
    const p = (procType || "").trim();
    if (!n) return null;
    if (!p || p === "—") return n;
    return `${n} — ${p}`;
  }
  /* ---- FIM FUNÇÃO 09A.3 ---- */

  /* ---- FUNÇÃO 09A.4 — __gcGetGcalSyncDayUrl ---- */
  function __gcGetGcalSyncDayUrl() {
    return "https://gc-gcal.dr-joao-morais.workers.dev/sync-day";
  }
  /* ---- FIM FUNÇÃO 09A.4 ---- */

  /* ---- FUNÇÃO 09A.5 — __gcNormalizeDayISO ---- */
  function __gcNormalizeDayISO(v) {
    const d = String(v || "").slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : "";
  }
  /* ---- FIM FUNÇÃO 09A.5 ---- */

  /* ---- FUNÇÃO 09A.6 — __gcUniqueDays ---- */
  function __gcUniqueDays(days) {
    return Array.from(new Set((days || []).map(__gcNormalizeDayISO).filter(Boolean)));
  }
  /* ---- FIM FUNÇÃO 09A.6 ---- */

  /* ---- FUNÇÃO 09A.7 — __gcFireSyncDay ---- */
  function __gcFireSyncDay(dayISO) {
    return __gcFireSyncDays([dayISO]);
  }
  /* ---- FIM FUNÇÃO 09A.7 ---- */

  /* ---- FUNÇÃO 09A.8 — __gcFireSyncDays ---- */
  function __gcFireSyncDays(dayISOs) {
    try {
      const url = __gcGetGcalSyncDayUrl();
      const days = __gcUniqueDays(dayISOs);

      if (!url) {
        console.warn("[GCAL] sync skipped (url não configurada).");
        return;
      }
      if (!days.length) {
        console.warn("[GCAL] sync skipped (sem dias válidos).", dayISOs);
        return;
      }
      if (!window.sb || !window.sb.auth) {
        console.warn("[GCAL] sync skipped (Supabase client indisponível).");
        return;
      }

      window.sb.auth.getSession().then(({ data, error }) => {
        if (error || !data?.session?.access_token) {
          console.warn("[GCAL] sync skipped (sem sessão/token). days=", days);
          return;
        }

        const token = data.session.access_token;

        days.forEach((d) => {
          fetch(url, {
            method: "POST",
            keepalive: true,
            headers: {
              "content-type": "application/json",
              "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({ dayISO: d }),
          })
            .then(async (r) => {
              if (!r.ok) {
                const txt = await r.text().catch(() => "");
                console.warn("[GCAL] sync-day falhou:", d, r.status, txt);
                return;
              }
              console.log("[GCAL] sync ok dayISO=", d);
            })
            .catch((e) => {
              console.warn("[GCAL] sync-day erro:", d, e?.message || e);
            });
        });
      });

    } catch (e) {
      console.warn("[GCAL] sync-day exceção:", e?.message || e);
    }
  }
  /* ---- FIM FUNÇÃO 09A.8 ---- */

  /* ---- FUNÇÃO 09A.9 — __gcPad2 ---- */
  function __gcPad2(n) {
    return String(n).padStart(2, "0");
  }
  /* ---- FIM FUNÇÃO 09A.9 ---- */

  /* ---- FUNÇÃO 09A.10 — __gcToDateInput ---- */
  function __gcToDateInput(d) {
    try {
      const x = (d instanceof Date) ? d : new Date(d);
      if (!x || isNaN(x.getTime())) return "";
      return `${x.getFullYear()}-${__gcPad2(x.getMonth() + 1)}-${__gcPad2(x.getDate())}`;
    } catch (_) {
      return "";
    }
  }
  /* ---- FIM FUNÇÃO 09A.10 ---- */

  /* ---- FUNÇÃO 09A.11 — __gcToTimeInput ---- */
  function __gcToTimeInput(d) {
    try {
      const x = (d instanceof Date) ? d : new Date(d);
      if (!x || isNaN(x.getTime())) return "";
      return `${__gcPad2(x.getHours())}:${__gcPad2(x.getMinutes())}`;
    } catch (_) {
      return "";
    }
  }
  /* ---- FIM FUNÇÃO 09A.11 ---- */

  /* ---- FUNÇÃO 09A.12 — __gcLocalDateTimeToIso ---- */
  function __gcLocalDateTimeToIso(dateYYYYMMDD, timeHHMM) {
    if (!dateYYYYMMDD) return null;
    const t = timeHHMM || "00:00";
    const s = `${dateYYYYMMDD}T${t}:00`;
    const d = new Date(s);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  }
  /* ---- FIM FUNÇÃO 09A.12 ---- */

  /* ---- FUNÇÃO 09A.13 — __gcAddDaysYYYYMMDD ---- */
  function __gcAddDaysYYYYMMDD(dateYYYYMMDD, add) {
    try {
      const d = new Date(`${dateYYYYMMDD}T00:00:00`);
      if (isNaN(d.getTime())) return dateYYYYMMDD;
      d.setDate(d.getDate() + Number(add || 0));
      return __gcToDateInput(d);
    } catch (_) {
      return dateYYYYMMDD;
    }
  }
  /* ---- FIM FUNÇÃO 09A.13 ---- */

  /* ---- FUNÇÃO 09A.14 — __gcCmpYYYYMMDD ---- */
  function __gcCmpYYYYMMDD(a, b) {
    if (!a || !b) return 0;
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  }
  /* ---- FIM FUNÇÃO 09A.14 ---- */

/* ==== FIM BLOCO 09A — Helpers base + GCAL + datas/horas ==== */


/* ==== INÍCIO BLOCO 09B — Transferência automática de doente entre clínicas ==== */

  /* ---- FUNÇÃO 09B.1 — fetchPatientIdentifiers ---- */
  async function fetchPatientIdentifiers(patientId) {
    try {
      const { data, error } = await window.sb
        .from("patients")
        .select("full_name, sns, nif, passport_id, phone, dob")
        .eq("id", patientId)
        .limit(1);

      if (error) throw error;
      const p = (data && data.length) ? data[0] : null;
      return p || null;
    } catch (e) {
      console.warn("fetchPatientIdentifiers falhou:", e);
      return null;
    }
  }
  /* ---- FIM FUNÇÃO 09B.1 ---- */

  /* ---- FUNÇÃO 09B.2 — fetchActiveClinicForPatient ---- */
  async function fetchActiveClinicForPatient(patientId) {
    try {
      const { data, error } = await window.sb
        .from("patient_clinic")
        .select("clinic_id, is_active")
        .eq("patient_id", patientId)
        .eq("is_active", true)
        .limit(1);

      if (error) throw error;
      const r = (data && data.length) ? data[0] : null;
      return r ? (r.clinic_id || null) : null;
    } catch (e) {
      console.warn("fetchActiveClinicForPatient falhou:", e);
      return null;
    }
  }
  /* ---- FIM FUNÇÃO 09B.2 ---- */

  /* ---- FUNÇÃO 09B.3 — buildTransferConfirmText ---- */
  function buildTransferConfirmText({ patient, fromClinicName, toClinicName }) {
    const name = (patient?.full_name || "").trim() || "—";
    const parts = [];

    const sns = patient?.sns ? `SNS: ${patient.sns}` : "";
    const nif = patient?.nif ? `NIF: ${patient.nif}` : "";
    const tel = patient?.phone ? `Tel: ${patient.phone}` : "";
    const pid = patient?.passport_id ? `ID: ${patient.passport_id}` : "";
    const dob = patient?.dob ? `DN: ${patient.dob}` : "";

    const idLine = [sns, nif, tel, pid, dob].filter(Boolean).join("  |  ");

    parts.push("Confirme que é o doente correto:");
    parts.push(`${name}`);
    if (idLine) parts.push(idLine);
    parts.push("");
    parts.push(`Este doente está ativo em: ${fromClinicName || "—"}`);
    parts.push(`Pretende transferir para: ${toClinicName || "—"} ?`);
    parts.push("");
    parts.push("(Isto atualiza automaticamente a clínica ativa do doente.)");

    return parts.join("\n");
  }
  /* ---- FIM FUNÇÃO 09B.3 ---- */

  /* ---- FUNÇÃO 09B.4 — ensurePatientActiveInClinic ---- */
  async function ensurePatientActiveInClinic({ patientId, targetClinicId }) {
    const pid = String(patientId || "");
    const cid = String(targetClinicId || "");
    if (!pid || !cid) {
      throw new Error("ensurePatientActiveInClinic: patientId/targetClinicId em falta.");
    }

    const prevActiveClinicId = await fetchActiveClinicForPatient(pid);

    if (prevActiveClinicId && String(prevActiveClinicId) === cid) return true;

    async function ensureRowExistsInactive(pId, cId) {
      const { data: exist, error: e0 } = await window.sb
        .from("patient_clinic")
        .select("clinic_id")
        .eq("patient_id", pId)
        .eq("clinic_id", cId)
        .limit(1);

      if (e0) throw e0;
      if (exist && exist.length) return true;

      const { error: eIns } = await window.sb
        .from("patient_clinic")
        .insert({ patient_id: pId, clinic_id: cId, is_active: false });

      if (eIns) throw eIns;
      return true;
    }

    async function setActiveClinic(pId, cId) {
      await ensureRowExistsInactive(pId, cId);

      const { error: eOff } = await window.sb
        .from("patient_clinic")
        .update({ is_active: false })
        .eq("patient_id", pId)
        .eq("is_active", true);

      if (eOff) throw eOff;

      const { error: eOn } = await window.sb
        .from("patient_clinic")
        .update({ is_active: true })
        .eq("patient_id", pId)
        .eq("clinic_id", cId);

      if (eOn) throw eOn;

      const nowActive = await fetchActiveClinicForPatient(pId);
      if (!nowActive || String(nowActive) !== String(cId)) {
        throw new Error("Falha ao ativar clínica destino (validação falhou).");
      }

      return true;
    }

    try {
      await setActiveClinic(pid, cid);
      return true;
    } catch (e) {
      try {
        if (prevActiveClinicId) {
          await setActiveClinic(pid, String(prevActiveClinicId));
        }
      } catch (_) {}
      throw e;
    }
  }
  /* ---- FIM FUNÇÃO 09B.4 ---- */

  /* ---- FUNÇÃO 09B.5 — maybeTransferPatientToClinic ---- */
  async function maybeTransferPatientToClinic({ patientId, targetClinicId }) {
    const activeClinicId = await fetchActiveClinicForPatient(patientId);

    if (!activeClinicId) return { changed: false, noActive: true };
    if (String(activeClinicId) === String(targetClinicId)) return { changed: false };

    const fromClinicName = (G.clinicsById && G.clinicsById[activeClinicId])
      ? (G.clinicsById[activeClinicId].name || G.clinicsById[activeClinicId].slug || activeClinicId)
      : activeClinicId;

    const toClinicName = (G.clinicsById && G.clinicsById[targetClinicId])
      ? (G.clinicsById[targetClinicId].name || G.clinicsById[targetClinicId].slug || targetClinicId)
      : targetClinicId;

    const patient = await fetchPatientIdentifiers(patientId);

    const ok = confirm(buildTransferConfirmText({ patient, fromClinicName, toClinicName }));
    if (!ok) return { changed: false, cancelled: true };

    await ensurePatientActiveInClinic({ patientId, targetClinicId });
    return { changed: true };
  }
  /* ---- FIM FUNÇÃO 09B.5 ---- */

/* ==== FIM BLOCO 09B — Transferência automática de doente entre clínicas ==== */


/* ==== INÍCIO BLOCO 09C — openApptModal: render UI + refs DOM + wiring base ==== */

  /* ---- FUNÇÃO 09C.1 — openApptModal ---- */
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
    const startBase = new Date(
      selectedDayStart.getFullYear(),
      selectedDayStart.getMonth(),
      selectedDayStart.getDate(),
      9, 0, 0, 0
    );

    const startInit = isEdit && row && row.start_at ? new Date(row.start_at) : startBase;
    const endInit = isEdit && row && row.end_at ? new Date(row.end_at) : new Date(startInit.getTime() + 20 * 60000);
    const durInit = Math.max(5, Math.round((endInit.getTime() - startInit.getTime()) / 60000));
    const durationBest = DURATION_OPTIONS.includes(durInit) ? durInit : 20;

    const procInit = isEdit ? (row.procedure_type ?? "") : "";

    const statusRaw = isEdit ? (row.status ?? "scheduled") : "scheduled";
    const statusNorm = (String(statusRaw).toLowerCase() === "cancelled")
      ? "no_show"
      : String(statusRaw || "scheduled").toLowerCase();
    const statusInit = (Array.isArray(STATUS_OPTIONS) && STATUS_OPTIONS.map((x) => String(x).toLowerCase()).includes(statusNorm))
      ? statusNorm
      : "scheduled";

    const patientIdInit = isEdit ? (row.patient_id ?? "") : "";
    const titleInit = isEdit ? (row.title ?? "") : "";
    const notesInit = isEdit ? (row.notes ?? "") : "";

    const procIsOther = procInit && !PROCEDURE_OPTIONS.includes(procInit) ? true : procInit === "Outro";
    const procSelectValue = procIsOther ? "Outro" : (procInit || "");

    const apptModeInit = isEdit ? String(row?.mode || "presencial").toLowerCase() : "presencial";

    const isSuperadmin = !!window.__GC_IS_SUPERADMIN__;
    const isDoctor = String(G.role || "").toLowerCase() === "doctor";
    const canCreateBlocks = isSuperadmin || isDoctor;

    const isBlockEdit = isEdit && String(row?.mode || "").toLowerCase() === "bloqueio";
    const canDeleteAppt = !!(isEdit && row?.id && !isBlockEdit);

    function optLabel(s) {
      const m = statusMeta(s);
      return `${m.icon} ${m.label}`;
    }

    const bDateFromInit = __gcToDateInput(startInit);
    const bDateToInit = __gcToDateInput(startInit);
    const bTimeFromInit = __gcToTimeInput(startInit);
    const bTimeToInit = __gcToTimeInput(endInit);

    root.innerHTML = `
      <div id="modalOverlay" style="position:fixed; inset:0; background:rgba(0,0,0,0.35); display:flex; align-items:center; justify-content:center; padding:18px;">
        <div style="background:#fff; width:min(1040px, 100%); border-radius:14px; border:1px solid #e5e5e5; padding:14px; max-height: 90vh; overflow:auto;">
          <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start;">
            <div>
              <div style="font-size:${UI.fs14}px; font-weight:900; color:#111;">
                ${isBlockEdit ? "Editar bloqueio" : (isEdit ? "Editar marcação" : "Nova marcação")}
              </div>
              <div style="font-size:${UI.fs12}px; color:#666; margin-top:4px;">
                Dia selecionado: ${escapeHtml(G.selectedDayISO)}.
              </div>
            </div>
            <button id="btnCloseModal" class="gcBtn">Fechar</button>
          </div>

          <div style="margin-top:12px; display:flex; flex-direction:column; gap:4px;">
            <label style="font-size:${UI.fs12}px; color:#666;">Ação</label>
            <select id="mMode" class="gcSelect">
              <option value="presencial">Agendar consulta</option>
              ${canCreateBlocks ? `<option value="bloqueio">Realizar bloqueio</option>` : ``}
            </select>
            ${(!canCreateBlocks) ? `<div style="font-size:${UI.fs12}px; color:#666; margin-top:4px;">Bloqueios: apenas médico/superadmin.</div>` : ``}
          </div>

          <div id="mBlockOnlyWrap" style="display:none; margin-top:14px; border:1px solid #eee; border-radius:14px; padding:14px; background:#fafafa;">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
              <div style="font-weight:900; font-size:${UI.fs13}px;">Bloqueio</div>
              ${isBlockEdit ? `<button id="btnDeleteBlock" class="gcBtn" type="button" style="font-weight:900;">Apagar bloqueio</button>` : ``}
            </div>

            <div style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap;">
              <button id="btnBlockDay" class="gcBtn" type="button" style="font-weight:900;">Bloquear dia</button>
              <button id="btnBlockPeriod" class="gcBtn" type="button">Bloquear período</button>
            </div>

            <div style="margin-top:12px; display:grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap:12px; align-items:end;">
              <div style="display:flex; flex-direction:column; gap:4px;">
                <label style="font-size:${UI.fs12}px; color:#666;">Datas De</label>
                <input id="bDateFrom" type="date" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
              </div>
              <div style="display:flex; flex-direction:column; gap:4px;">
                <label style="font-size:${UI.fs12}px; color:#666;">Até</label>
                <input id="bDateTo" type="date" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
              </div>

              <div style="display:flex; flex-direction:column; gap:4px;">
                <label style="font-size:${UI.fs12}px; color:#666;">Das</label>
                <input id="bTimeFrom" type="time" step="60" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
              </div>
              <div style="display:flex; flex-direction:column; gap:4px;">
                <label style="font-size:${UI.fs12}px; color:#666;">Às</label>
                <input id="bTimeTo" type="time" step="60" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
              </div>
            </div>

            <div style="margin-top:12px; display:grid; grid-template-columns: 1fr 1fr; gap:12px; align-items:start;">
              <div style="display:flex; flex-direction:column; gap:4px;">
                <label style="font-size:${UI.fs12}px; color:#666;">Aplicar a</label>
                <select id="bApplyTo" class="gcSelect">
                  <option value="selected">Selecionar clínicas</option>
                  ${isSuperadmin ? `<option value="global">Todas as clínicas (global)</option>` : ``}
                </select>
                <div id="bGlobalHint" style="font-size:${UI.fs12}px; color:#666; margin-top:4px; display:${isSuperadmin ? "none" : "block"};">
                  Global: apenas superadmin.
                </div>
              </div>

              <div id="bClinicsWrap" style="display:flex; flex-direction:column; gap:6px;">
                <label style="font-size:${UI.fs12}px; color:#666;">Clínicas</label>
                <div id="bClinicsList" style="border:1px solid #e5e5e5; border-radius:12px; background:#fff; max-height:240px; overflow:auto; padding:8px;"></div>
                <div style="display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap;">
                  <button id="bSelectAll" class="gcBtn" type="button">Selecionar todas</button>
                  <button id="bClearAll" class="gcBtn" type="button">Limpar</button>
                </div>
              </div>
            </div>
          </div>

          <div id="mConsultOnlyWrap" style="display:block;">
            <div id="mPatientWrap" style="margin-top:12px; display:flex; flex-direction:column; gap:6px;">
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

            <div style="margin-top:12px; display:grid; grid-template-columns: 1fr 1fr 1fr; gap:12px;">
              <div style="display:flex; flex-direction:column; gap:4px;">
                <label style="font-size:${UI.fs12}px; color:#666;">Clínica</label>
                <select id="mClinic" class="gcSelect"></select>
              </div>

              <div id="mProcWrap" style="display:flex; flex-direction:column; gap:4px;">
                <label style="font-size:${UI.fs12}px; color:#666;">Tipo (obrigatório)</label>
                <select id="mProc" class="gcSelect">
                  <option value="">—</option>
                  ${PROCEDURE_OPTIONS.map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("")}
                </select>
              </div>

              <div id="mStatusWrap" style="display:flex; flex-direction:column; gap:4px;">
                <label style="font-size:${UI.fs12}px; color:#666;">Estado</label>
                <select id="mStatus" class="gcSelect">
                  ${STATUS_OPTIONS.map((s) => {
                    const val = (s === "cancelled") ? "no_show" : String(s).toLowerCase();
                    const m = statusMeta(val);
                    return `<option value="${escapeHtml(val)}">${escapeHtml(optLabel(val))}</option>`;
                  }).join("")}
                </select>
              </div>

              <div id="mProcOtherWrap" style="display:none; flex-direction:column; gap:4px; grid-column: 1 / -1;">
                <label style="font-size:${UI.fs12}px; color:#666;">Outro (texto) *</label>
                <input id="mProcOther" type="text" placeholder="ex.: Ondas de choque" autocomplete="off" autocapitalize="off" spellcheck="false"
                  style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
              </div>
            </div>

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
          </div>

          <div style="margin-top:12px; display:flex; flex-direction:column; gap:4px;">
            <label id="mNotesLabel" style="font-size:${UI.fs12}px; color:#666;">Notas</label>
            <textarea id="mNotes" rows="3" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; resize:vertical; font-size:${UI.fs13}px;"></textarea>
          </div>

          <div style="margin-top:12px; display:flex; justify-content:space-between; gap:12px; align-items:center; flex-wrap:wrap;">
            <div id="mMsg" style="font-size:${UI.fs12}px; color:#666;"></div>
            <div style="display:flex; gap:10px;">
              ${canDeleteAppt ? `<button id="btnDeleteAppt" class="gcBtn" type="button" style="font-weight:900;">Eliminar marcação</button>` : ``}
              <button id="btnCancel" class="gcBtn">Cancelar</button>
              <button id="btnSave" class="gcBtn" style="font-weight:900;">Guardar</button>
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
    const btnDeleteAppt = document.getElementById("btnDeleteAppt");

    const mMode = document.getElementById("mMode");

    const mBlockOnlyWrap = document.getElementById("mBlockOnlyWrap");
    const btnDeleteBlock = document.getElementById("btnDeleteBlock");
    const btnBlockDay = document.getElementById("btnBlockDay");
    const btnBlockPeriod = document.getElementById("btnBlockPeriod");
    const bDateFrom = document.getElementById("bDateFrom");
    const bDateTo = document.getElementById("bDateTo");
    const bTimeFrom = document.getElementById("bTimeFrom");
    const bTimeTo = document.getElementById("bTimeTo");
    const bApplyTo = document.getElementById("bApplyTo");
    const bClinicsWrap = document.getElementById("bClinicsWrap");
    const bClinicsList = document.getElementById("bClinicsList");
    const bSelectAll = document.getElementById("bSelectAll");
    const bClearAll = document.getElementById("bClearAll");

    const mConsultOnlyWrap = document.getElementById("mConsultOnlyWrap");
    const mClinic = document.getElementById("mClinic");
    const mStatus = document.getElementById("mStatus");
    const mStart = document.getElementById("mStart");
    const mDuration = document.getElementById("mDuration");
    const mProc = document.getElementById("mProc");
    const mProcWrap = document.getElementById("mProcWrap");
    const mStatusWrap = document.getElementById("mStatusWrap");
    const mProcOtherWrap = document.getElementById("mProcOtherWrap");
    const mProcOther = document.getElementById("mProcOther");

    const mNotes = document.getElementById("mNotes");
    const mNotesLabel = document.getElementById("mNotesLabel");
    const mMsg = document.getElementById("mMsg");

    const mPatientWrap = document.getElementById("mPatientWrap");
    const mPatientQuery = document.getElementById("mPatientQuery");
    const mPatientResults = document.getElementById("mPatientResults");
    const mPatientId = document.getElementById("mPatientId");
    const mPatientName = document.getElementById("mPatientName");

    let _cleanupFns = [];
    function addCleanup(fn) {
      if (typeof fn === "function") _cleanupFns.push(fn);
    }
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

    let __blockMode = "period";
    const __selectedClinicIds = new Set();
    try {
      if (defaultClinicId) __selectedClinicIds.add(String(defaultClinicId));
    } catch (_) {}

    function __renderClinicsChecklist() {
      if (!bClinicsList) return;
      bClinicsList.innerHTML = (G.clinics || []).map((c) => {
        const cid = String(c.id);
        const label = (c.name || c.slug || c.id);
        const checked = __selectedClinicIds.has(cid) ? "checked" : "";
        return `
          <label style="display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:10px; cursor:pointer;">
            <input type="checkbox" data-b-cid="${escapeHtml(cid)}" ${checked} />
            <span style="font-weight:800; color:#111;">${escapeHtml(label)}</span>
          </label>
        `;
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
        bTimeFrom.value = "00:00";
        bTimeTo.value = "23:59";
        if (btnBlockDay) btnBlockDay.style.fontWeight = "900";
        if (btnBlockPeriod) btnBlockPeriod.style.fontWeight = "700";
      } else {
        if (btnBlockDay) btnBlockDay.style.fontWeight = "700";
        if (btnBlockPeriod) btnBlockPeriod.style.fontWeight = "900";
      }
    }

    if (bDateFrom) bDateFrom.value = bDateFromInit;
    if (bDateTo) bDateTo.value = bDateToInit;
    if (bTimeFrom) bTimeFrom.value = bTimeFromInit || "09:00";
    if (bTimeTo) bTimeTo.value = bTimeToInit || "09:20";

    __renderClinicsChecklist();
    __applyBlockModeUi();

    if (bSelectAll) {
      bSelectAll.addEventListener("click", (ev) => {
        ev.preventDefault();
        (G.clinics || []).forEach((c) => __selectedClinicIds.add(String(c.id)));
        __renderClinicsChecklist();
      });
    }

    if (bClearAll) {
      bClearAll.addEventListener("click", (ev) => {
        ev.preventDefault();
        __selectedClinicIds.clear();
        __renderClinicsChecklist();
      });
    }

    if (btnBlockDay) {
      btnBlockDay.addEventListener("click", (ev) => {
        ev.preventDefault();
        __blockMode = "day";
        __applyBlockModeUi();
      });
    }

    if (btnBlockPeriod) {
      btnBlockPeriod.addEventListener("click", (ev) => {
        ev.preventDefault();
        __blockMode = "period";
        __applyBlockModeUi();
      });
    }

    if (bApplyTo) {
      bApplyTo.addEventListener("change", () => {
        const v = String(bApplyTo.value || "selected").toLowerCase();
        if (bClinicsWrap) bClinicsWrap.style.display = (v === "global") ? "none" : "flex";
      });
      const v0 = String(bApplyTo.value || "selected").toLowerCase();
      if (bClinicsWrap) bClinicsWrap.style.display = (v0 === "global") ? "none" : "flex";
    }

    if (btnDeleteBlock) {
      btnDeleteBlock.addEventListener("click", async (ev) => {
        ev.preventDefault();
        if (!isBlockEdit || !row?.id) return;
        if (!confirm("Apagar este bloqueio?")) return;

        try {
          const { error } = await window.sb.from("appointments").delete().eq("id", row.id);
          if (error) throw error;
          safeCloseModal();
          await refreshAgenda();
          __gcFireSyncDay(String(row.start_at || G.selectedDayISO || "").slice(0, 10));
        } catch (e) {
          console.error(e);
          alert("Erro ao apagar bloqueio. Vê a consola para detalhe.");
        }
      });
    }

    if (mMode) {
      mMode.value = apptModeInit;
      if (isEdit && apptModeInit === "bloqueio" && !canCreateBlocks) mMode.disabled = true;
    }

/* ==== FIM BLOCO 09C — openApptModal: render UI + refs DOM + wiring base ==== */


/* ==== INÍCIO BLOCO 09D — openApptModal: pesquisa doente + novo doente interno + UI dinâmica ==== */

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
          if (mPatientQuery) mPatientQuery.value = pname;
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
      const v = mProc ? mProc.value : "";
      const show = v === "Outro";
      if (mProcOtherWrap) mProcOtherWrap.style.display = show ? "flex" : "none";
      if (!show && mProcOther) mProcOther.value = "";
    }

    if (mProc) mProc.addEventListener("change", updateProcOtherVisibility);
    updateProcOtherVisibility();

    if (procIsOther && mProcOther) {
      mProcOther.value = procInit === "Outro" ? "" : procInit;
      if (mProcOtherWrap) mProcOtherWrap.style.display = "flex";
    }

    function applyModeUi() {
      const v = mMode ? String(mMode.value || "presencial").toLowerCase() : "presencial";
      const isBlock = v === "bloqueio";

      if (mBlockOnlyWrap) mBlockOnlyWrap.style.display = isBlock ? "block" : "none";
      if (mConsultOnlyWrap) mConsultOnlyWrap.style.display = isBlock ? "none" : "block";

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
    if (mMode) mMode.addEventListener("change", applyModeUi);

    let searchTimer = null;

    async function runSearch() {
      const vMode = mMode ? String(mMode.value || "presencial").toLowerCase() : "presencial";
      if (vMode === "bloqueio") return;

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

      function setErr(msg) {
        npMsg.style.color = "#b00020";
        npMsg.textContent = msg;
      }

      function setInfo(msg) {
        npMsg.style.color = "#666";
        npMsg.textContent = msg;
      }

      function validate() {
        const fullName = (npFullName.value || "").trim();
        if (!fullName) return { ok: false, msg: "Nome completo é obrigatório." };

        const sns = normalizeDigits(npSNS.value);
        const nif = normalizeDigits(npNIF.value);
        const pass = (npPassport.value || "").trim();

        if (sns && !/^[0-9]{9}$/.test(sns)) return { ok: false, msg: "SNS inválido: tem de ter 9 dígitos." };
        if (nif && !/^[0-9]{9}$/.test(nif)) return { ok: false, msg: "NIF inválido: tem de ter 9 dígitos." };
        if (pass && !/^[A-Za-z0-9]{4,20}$/.test(pass)) return { ok: false, msg: "Passaporte/ID inválido: 4–20 alfanum." };

        if (!sns && !nif && !pass) {
          return { ok: false, msg: "Identificação obrigatória: SNS ou NIF ou Passaporte/ID." };
        }

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
        if (npSNS) {
          const d = normalizeDigits(npSNS.value);
          if (npSNS.value !== d) npSNS.value = d;
        }
        if (npNIF) {
          const d = normalizeDigits(npNIF.value);
          if (npNIF.value !== d) npNIF.value = d;
        }

        const v = validate();
        if (!v.ok) {
          npCreate.disabled = true;
          setErr(v.msg);
        } else {
          npCreate.disabled = false;
          setInfo("OK para criar.");
        }
      }

      [npFullName, npDob, npPhone, npEmail, npSNS, npNIF, npPassport, npInsuranceProvider, npInsurancePolicy, npAddress1, npPostal, npCity, npCountry, npNotes]
        .forEach((el) => {
          if (!el) return;
          el.addEventListener("input", refreshButtonState);
          el.addEventListener("change", refreshButtonState);
        });

      npCancel.addEventListener("click", () => {
        host.innerHTML = "";
      });

      npCreate.addEventListener("click", async () => {
        const v = validate();
        if (!v.ok) {
          setErr(v.msg);
          return;
        }

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

    if (mClinic) {
      mClinic.addEventListener("change", () => {
        const vMode = mMode ? String(mMode.value || "presencial").toLowerCase() : "presencial";
        if (vMode === "bloqueio") return;

        setSelectedPatient({ id: "", name: "" });
        if (mPatientQuery) mPatientQuery.value = "";
        closeResults();
        const host = document.getElementById("newPatientHost");
        if (host) host.innerHTML = "";
      });
    }

    if (mPatientQuery) {
      mPatientQuery.addEventListener("input", () => {
        const vMode = mMode ? String(mMode.value || "presencial").toLowerCase() : "presencial";
        if (vMode === "bloqueio") return;
        setSelectedPatient({ id: "", name: "" });
        scheduleSearch();
      });
      mPatientQuery.addEventListener("focus", scheduleSearch);
    }

    if (btnNewPatient) btnNewPatient.addEventListener("click", openNewPatientForm);

/* ==== FIM BLOCO 09D — openApptModal: pesquisa doente + novo doente interno + UI dinâmica ==== */


/* ==== INÍCIO BLOCO 09E — openApptModal: eliminar + guardar consulta/bloqueio + wiring final ==== */

    async function onDeleteAppt() {
      if (!canDeleteAppt || !row?.id) return;
      if (!confirm("Eliminar esta marcação?")) return;

      try {
        if (btnDeleteAppt) btnDeleteAppt.disabled = true;
        if (btnSave) btnSave.disabled = true;

        mMsg.style.color = "#666";
        mMsg.textContent = "A eliminar…";

        const dayISO = String(row.start_at || G.selectedDayISO || "").slice(0, 10);

        const { error } = await window.sb.from("appointments").delete().eq("id", row.id);
        if (error) throw error;

        console.log("[APPT] delete ok id=", row.id);

        safeCloseModal();
        await refreshAgenda();
        console.log("[APPT] refreshAgenda ok");

        __gcFireSyncDay(dayISO);
      } catch (e) {
        console.error("Eliminar falhou:", e);
        const msg = String(e && (e.message || e.details || e.hint) ? (e.message || e.details || e.hint) : e);
        mMsg.style.color = "#b00020";
        mMsg.textContent = msg || "Erro ao eliminar. Vê a consola.";
        if (btnDeleteAppt) btnDeleteAppt.disabled = false;
        if (btnSave) btnSave.disabled = false;
      }
    }

    if (btnDeleteAppt) btnDeleteAppt.addEventListener("click", onDeleteAppt);

    async function onSave() {
      const vMode = mMode ? String(mMode.value || "presencial").toLowerCase() : "presencial";
      const isBlock = vMode === "bloqueio";

      btnSave.disabled = true;
      mMsg.style.color = "#666";
      mMsg.textContent = "A guardar…";

      try {
        if (isBlock) {
          if (!canCreateBlocks) throw new Error("Sem permissões para criar bloqueios.");

          const dateFrom = bDateFrom?.value || "";
          const dateTo = bDateTo?.value || "";
          const timeFrom = bTimeFrom?.value || "00:00";
          const timeTo = bTimeTo?.value || "23:59";

          if (!dateFrom) throw new Error("Datas De em falta.");
          if (!dateTo) throw new Error("Até em falta.");
          if (__gcCmpYYYYMMDD(dateFrom, dateTo) > 0) throw new Error("Intervalo de datas inválido.");

          const applyToRaw = String(bApplyTo?.value || "selected").toLowerCase();
          const idsSelected = Array.from(__selectedClinicIds || []).map(String);

          const allClinicsCount = Array.isArray(G.clinics) ? G.clinics.length : 0;
          const allSelected = allClinicsCount > 0 && idsSelected.length === allClinicsCount;

          let applyTo = applyToRaw;
          if (applyToRaw === "selected" && allSelected && isSuperadmin) {
            applyTo = "global";
          }

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
            if (new Date(eIso).getTime() <= new Date(sIso).getTime()) {
              throw new Error("Hora 'Às' tem de ser depois de 'Das'.");
            }

            for (const t of targetClinicIds) {
              rowsToInsert.push({
                clinic_id: (t === null) ? null : String(t),
                patient_id: null,
                start_at: sIso,
                end_at: eIso,
                status: "confirmed",
                procedure_type: null,
                title: "BLOQUEIO",
                notes: mNotes && mNotes.value ? mNotes.value.trim() : null,
                mode: "bloqueio",
              });
            }

            d = __gcAddDaysYYYYMMDD(d, 1);
          }

          if (isEdit && row?.id) {
            const first = rowsToInsert[0] || null;
            if (!first) throw new Error("Sem dados para guardar.");
            const { error } = await window.sb.from("appointments").update(first).eq("id", row.id);
            if (error) throw error;
            console.log("[APPT] update block ok id=", row.id);
          } else {
            const { error } = await window.sb.from("appointments").insert(rowsToInsert);
            if (error) throw error;
            console.log("[APPT] insert block ok n=", rowsToInsert.length);
          }

          safeCloseModal();
          await refreshAgenda();
          console.log("[APPT] refreshAgenda ok");

          const syncDays = [String(dateFrom || "").slice(0, 10)];
          if (isEdit && row?.start_at) syncDays.push(String(row.start_at).slice(0, 10));
          __gcFireSyncDays(syncDays);
          return;
        }

        if (!mClinic || !mClinic.value) throw new Error("Seleciona a clínica.");

        const pid = mPatientId ? (mPatientId.value || "") : "";
        const pname = mPatientName ? (mPatientName.value || "") : "";
        if (!pid) throw new Error("Seleciona um doente.");

        const proc = (() => {
          const sel = mProc && mProc.value ? mProc.value : "";
          if (!sel) return "";
          if (sel !== "Outro") return sel;
          const other = mProcOther && mProcOther.value ? mProcOther.value.trim() : "";
          if (!other) return "";
          return other;
        })();
        if (!proc) throw new Error("Seleciona o Tipo de consulta (e se for 'Outro', preenche o texto).");

        if (!mStart || !mStart.value) throw new Error("Define o início.");

        const dur = mDuration ? parseInt(mDuration.value, 10) : 20;
        const times = calcEndFromStartAndDuration(mStart.value, dur);
        if (!times) throw new Error("Data/hora inválida.");

        const tRes = await maybeTransferPatientToClinic({ patientId: pid, targetClinicId: mClinic.value });
        if (tRes && tRes.cancelled) {
          mMsg.style.color = "#b00020";
          mMsg.textContent = "Operação cancelada (transferência não confirmada).";
          btnSave.disabled = false;
          return;
        }

        const autoTitle = makeAutoTitle(pname, proc);
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
          mode: "presencial",
        };

        if (payload && payload.notes === "") payload.notes = null;

        const oldDayISO = isEdit && row?.start_at ? String(row.start_at).slice(0, 10) : "";
        const newDayISO = String(times.startAt || G.selectedDayISO || "").slice(0, 10);

        if (isEdit) {
          const { error } = await window.sb.from("appointments").update(payload).eq("id", row.id);
          if (error) throw error;
          console.log("[APPT] update ok id=", row.id);
        } else {
          const { data, error } = await window.sb
            .from("appointments")
            .insert(payload)
            .select("id")
            .limit(1);

          if (error) throw error;
          const newId = (data && data.length) ? data[0].id : null;
          console.log("[APPT] insert ok id=", newId);
        }

        safeCloseModal();
        await refreshAgenda();
        console.log("[APPT] refreshAgenda ok");

        __gcFireSyncDays([oldDayISO, newDayISO]);

      } catch (e) {
        console.error("Guardar falhou:", e);
        const msg = String(e && (e.message || e.details || e.hint) ? (e.message || e.details || e.hint) : e);

        if (msg.toLowerCase().includes("existe bloqueio")) {
          mMsg.style.color = "#b00020";
          mMsg.textContent = "Não permitido: existe um bloqueio nesse intervalo.";
        } else if (msg.toLowerCase().includes("bloqueio") && msg.toLowerCase().includes("sobrepõe")) {
          mMsg.style.color = "#b00020";
          mMsg.textContent = "Não permitido: o bloqueio sobrepõe uma marcação existente.";
        } else {
          mMsg.style.color = "#b00020";
          mMsg.textContent = msg || "Erro ao guardar. Vê a consola.";
        }
        btnSave.disabled = false;
      }
    }

    if (btnSave) btnSave.addEventListener("click", onSave);
    if (btnCancel) btnCancel.addEventListener("click", safeCloseModal);
    if (btnClose) btnClose.addEventListener("click", safeCloseModal);
    if (overlay) {
      overlay.addEventListener("click", (ev) => {
        if (ev.target === overlay) safeCloseModal();
      });
    }
  }
  /* ---- FIM FUNÇÃO 09C.1 ---- */

/* ==== FIM BLOCO 09E — openApptModal: eliminar + guardar consulta/bloqueio + wiring final ==== */

/* ========================================================
   FIM BLOCO 09/12 — Modal marcação
   ======================================================== */

/* ========================================================
   BLOCO 10/12 — Logout + Refresh agenda
   MAPA DE NAVEGAÇÃO
   --------------------------------------------------------
   10A — Sessão bloqueada / auth guard
      10A.1 __gcSessionLockActive
      10A.2 __gcIsAuthError
      10A.3 __gcRenderSessionLockedScreen
      10A.4 __gcForceSessionLock

   10B — Logout
      10B.1 wireLogout

   10C — Refresh agenda
      10C.1 refreshAgenda
   ======================================================== */

/* ==== INÍCIO BLOCO 10A — Sessão bloqueada / auth guard ==== */

  let __gcSessionLockActive = false;

  /* ---- FUNÇÃO 10A.2 — __gcIsAuthError ---- */
  function __gcIsAuthError(err) {
    const msg = String(
      (err && (err.message || err.error_description || err.error)) || ""
    ).toLowerCase();

    const status =
      err?.status ??
      err?.statusCode ??
      err?.code ??
      err?.response?.status ??
      null;

    return (
      status === 401 ||
      status === 403 ||
      msg.includes("jwt") ||
      msg.includes("token") ||
      msg.includes("auth") ||
      msg.includes("not logged in") ||
      msg.includes("session") ||
      msg.includes("forbidden") ||
      msg.includes("unauthorized")
    );
  }
  /* ---- FIM FUNÇÃO 10A.2 ---- */

  /* ---- FUNÇÃO 10A.3 — __gcRenderSessionLockedScreen ---- */
  function __gcRenderSessionLockedScreen(reasonText) {
    const reason = String(
      reasonText || "Sessão expirada por segurança. Volte a iniciar sessão."
    );

    const root = document.getElementById("appRoot") || document.body;
    root.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#0b1220;color:#e7eefc;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;">
        <div style="width:100%;max-width:520px;background:#111a2e;border:1px solid rgba(255,255,255,.10);border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.35);padding:24px 20px;">
          <div style="font-size:18px;font-weight:800;letter-spacing:.2px;">Sessão bloqueada</div>
          <div style="margin-top:10px;font-size:14px;line-height:1.5;opacity:.95;">
            ${reason.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;")}
          </div>
          <div style="margin-top:16px;font-size:13px;line-height:1.45;opacity:.82;">
            Por segurança, a aplicação foi bloqueada para impedir alterações sem autenticação válida.
          </div>
          <div style="display:flex;gap:10px;margin-top:18px;">
            <button id="btnGoLoginNow" style="flex:1;border:0;background:#3b82f6;color:#fff;border-radius:12px;padding:12px 14px;font-size:14px;font-weight:700;cursor:pointer;">
              Voltar ao login
            </button>
            <button id="btnReloadLocked" style="border:1px solid rgba(255,255,255,.18);background:transparent;color:#e7eefc;border-radius:12px;padding:12px 14px;font-size:14px;cursor:pointer;">
              Recarregar
            </button>
          </div>
        </div>
      </div>
    `;

    const btnGo = document.getElementById("btnGoLoginNow");
    if (btnGo) btnGo.onclick = () => hardRedirect("/index.html");

    const btnReload = document.getElementById("btnReloadLocked");
    if (btnReload) btnReload.onclick = () => window.location.reload();
  }
  /* ---- FIM FUNÇÃO 10A.3 ---- */

  /* ---- FUNÇÃO 10A.4 — __gcForceSessionLock ---- */
  async function __gcForceSessionLock(reasonText) {
    if (__gcSessionLockActive) return;
    __gcSessionLockActive = true;

    try {
      if (G && G.authStateSubscription && typeof G.authStateSubscription.unsubscribe === "function") {
        G.authStateSubscription.unsubscribe();
      }
    } catch {}

    try {
      if (window.sb && window.sb.auth && typeof window.sb.auth.signOut === "function") {
        await window.sb.auth.signOut();
      }
    } catch {}

    try {
      __gcRenderSessionLockedScreen(reasonText);
    } catch (e) {
      console.error("Falha a renderizar ecrã de sessão bloqueada:", e);
      hardRedirect("/index.html");
      return;
    }

    setTimeout(() => {
      hardRedirect("/index.html");
    }, 1500);
  }
  /* ---- FIM FUNÇÃO 10A.4 ---- */

/* ==== FIM BLOCO 10A — Sessão bloqueada / auth guard ==== */


/* ==== INÍCIO BLOCO 10B — Logout ==== */

/* ---- FUNÇÃO 10B.1 — wireLogout ---- */
async function wireLogout() {
  const btn = document.getElementById("btnLogout");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    btn.textContent = "A terminar sessão…";

    try {
      if (G && G.authStateSubscription && typeof G.authStateSubscription.unsubscribe === "function") {
        try { G.authStateSubscription.unsubscribe(); } catch {}
      }

      if (window.sb && window.sb.auth && typeof window.sb.auth.signOut === "function") {
        await Promise.race([
          window.sb.auth.signOut(),
          new Promise((resolve) => setTimeout(resolve, 1200))
        ]);
      }
    } catch (e) {
      console.error("Logout falhou:", e);
    } finally {
      hardRedirect("/index.html");
    }
  });
}
/* ---- FIM FUNÇÃO 10B.1 ---- */

/* ==== FIM BLOCO 10B — Logout ==== */


/* ==== INÍCIO BLOCO 10C — Refresh agenda ==== */

  /* ---- FUNÇÃO 10C.1 — refreshAgenda ---- */
  async function refreshAgenda() {
    if (__gcSessionLockActive) return;

    const sel = document.getElementById("selClinic");
    const clinicId = sel ? sel.value || null : null;

    const r = isoLocalDayRangeFromISODate(G.selectedDayISO);
    if (!r) {
      setAgendaStatus("error", "Dia inválido.");
      return;
    }

    setAgendaStatus("loading", "A carregar marcações…");

    try {
      const { data, timeColUsed } = await loadAppointmentsForRange({
        clinicId,
        startISO: r.startISO,
        endISO: r.endISO
      });

      const patientIds = (data || []).map((x) => x && x.patient_id).filter(Boolean);
      try {
        G.patientsById = await fetchPatientsByIds(patientIds);
      } catch (e) {
        if (__gcIsAuthError(e)) {
          await __gcForceSessionLock("Sessão expirada ou inválida. Volte a iniciar sessão.");
          return;
        }
        console.error("Falha ao carregar pacientes para agenda:", e);
        G.patientsById = {};
      }

      G.agenda.rows = data;
      G.agenda.timeColUsed = timeColUsed || "start_at";
      setAgendaStatus("ok", `OK: ${data.length} marcação(ões).`);
      renderAgendaList();
    } catch (e) {
      if (__gcIsAuthError(e)) {
        await __gcForceSessionLock("Sessão expirada ou inválida. Volte a iniciar sessão.");
        return;
      }

      console.error("Agenda load falhou:", e);
      setAgendaStatus("error", "Erro ao carregar agenda. Vê a consola.");
      G.agenda.rows = [];
      G.patientsById = {};
      renderAgendaList();
    }
  }
  /* ---- FIM FUNÇÃO 10C.1 ---- */

/* ==== FIM BLOCO 10C — Refresh agenda ==== */

/* ========================================================
   FIM BLOCO 10/12 — BLOCO 10/12 — Logout + Refresh agenda MAPA DE NAVEGAÇÃO
   ======================================================== */

   /* ========================================================
   BLOCO 11/12 — Boot (init da app + wiring de botões)
   MAPA DE NAVEGAÇÃO
   --------------------------------------------------------
   11A — MFA Gate (AAL2 obrigatório para todos)
      11A.1 ensureAAL2
         11A.1a esc
         11A.1b renderMFAScreen
         11A.1c getAAL

   11B — Boot principal
      11B.1 boot
   ======================================================== */


/* ==== INÍCIO BLOCO 11A — MFA Gate (AAL2 obrigatório para todos) ==== */

  /* ---- FUNÇÃO 11A.1 — ensureAAL2 ---- */
  async function ensureAAL2() {
    const sb = window.sb;

    /* ---- FUNÇÃO 11A.1a — esc ---- */
    function esc(s) {
      return String(s == null ? "" : s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }
    /* ---- FIM FUNÇÃO 11A.1a ---- */

    /* ---- FUNÇÃO 11A.1b — renderMFAScreen ---- */
    function renderMFAScreen({ title, subtitle, qrDataUrl, secret, uri, errorMsg }) {
      const root = document.getElementById("appRoot") || document.body;

      root.innerHTML = `
        <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#0b1220;color:#e7eefc;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;">
          <div style="width:100%;max-width:520px;background:#111a2e;border:1px solid rgba(255,255,255,.10);border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.35);padding:20px 18px;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
              <div>
                <div style="font-size:16px;font-weight:700;letter-spacing:.2px;">${esc(title || "Dupla autenticação obrigatória")}</div>
                <div style="margin-top:4px;font-size:13px;opacity:.9;line-height:1.35;">${esc(subtitle || "Introduza o código da sua app autenticadora para continuar.")}</div>
              </div>
              <button id="btnMFALogout" style="border:1px solid rgba(255,255,255,.18);background:transparent;color:#e7eefc;border-radius:10px;padding:8px 10px;font-size:13px;cursor:pointer;">Sair</button>
            </div>

            <div style="margin-top:14px;border-top:1px solid rgba(255,255,255,.10);padding-top:14px;">
              ${qrDataUrl ? `
                <div style="display:flex;gap:14px;flex-wrap:wrap;">
                  <div style="background:#fff;border-radius:12px;padding:10px;">
                    <img alt="QR TOTP" src="${qrDataUrl}" style="display:block;width:170px;height:170px;object-fit:contain;" />
                  </div>
                  <div style="flex:1;min-width:240px;">
                    <div style="font-size:13px;font-weight:700;margin-bottom:6px;">Configuração TOTP</div>
                    <div style="font-size:12px;opacity:.92;line-height:1.35;">
                      1) Abra a app autenticadora (Google Authenticator / Microsoft Authenticator / Apple Passwords / 1Password).<br/>
                      2) Adicione conta por QR code.<br/>
                      3) Introduza abaixo o código de 6 dígitos.
                    </div>
                    ${secret ? `<div style="margin-top:10px;font-size:12px;opacity:.92;"><b>Secret:</b> <span style="font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">${esc(secret)}</span></div>` : ``}
                    ${uri ? `<div style="margin-top:6px;font-size:12px;opacity:.92;word-break:break-all;"><b>URI:</b> <span style="font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">${esc(uri)}</span></div>` : ``}
                  </div>
                </div>
              ` : ``}

              <div style="margin-top:${qrDataUrl ? "14px" : "0"};">
                <label style="display:block;font-size:13px;font-weight:700;margin-bottom:6px;">Código (6 dígitos)</label>
                <input id="inpMFACode" inputmode="numeric" autocomplete="one-time-code" placeholder="123456"
                  style="width:100%;padding:12px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:#0b1220;color:#e7eefc;font-size:16px;letter-spacing:2px;"
                />
                <div style="display:flex;gap:10px;margin-top:10px;">
                  <button id="btnMFAVerify" style="flex:1;border:0;background:#3b82f6;color:white;border-radius:12px;padding:11px 12px;font-size:14px;font-weight:700;cursor:pointer;">
                    Verificar e continuar
                  </button>
                  <button id="btnMFARetry" style="border:1px solid rgba(255,255,255,.18);background:transparent;color:#e7eefc;border-radius:12px;padding:11px 12px;font-size:14px;cursor:pointer;">
                    Recarregar
                  </button>
                </div>
                ${errorMsg ? `<div style="margin-top:10px;color:#ffb4b4;font-size:13px;line-height:1.35;">${esc(errorMsg)}</div>` : ``}
                <div style="margin-top:10px;font-size:12px;opacity:.85;line-height:1.35;">
                  Sessão atual: <span style="font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">${esc(G.sessionUser && G.sessionUser.email ? G.sessionUser.email : "—")}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      const btnLogout = document.getElementById("btnMFALogout");
      if (btnLogout) {
        btnLogout.onclick = async () => {
          try { await sb.auth.signOut(); } catch {}
          hardRedirect("/index.html");
        };
      }

      const btnRetry = document.getElementById("btnMFARetry");
      if (btnRetry) btnRetry.onclick = () => window.location.reload();
    }
    /* ---- FIM FUNÇÃO 11A.1b ---- */

    /* ---- FUNÇÃO 11A.1c — getAAL ---- */
    async function getAAL() {
      const { data: aal, error: aalErr } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalErr) throw aalErr;
      return aal;
    }
    /* ---- FIM FUNÇÃO 11A.1c ---- */

    const aal0 = await getAAL();
    if (String(aal0.currentLevel).toLowerCase() === "aal2") return true;

    const { data: factors, error: lfErr } = await sb.auth.mfa.listFactors();
    if (lfErr) throw lfErr;

    const totps = (factors && factors.totp) ? factors.totp : [];
    let factor = null;
    if (Array.isArray(totps) && totps.length) {
      factor = totps.find(f => String(f.status || "").toLowerCase() === "verified") || totps[0];
    }

    if (!factor) {
      const { data: en, error: enErr } = await sb.auth.mfa.enroll({ factorType: "totp" });
      if (enErr) throw enErr;

      factor = { id: en.id, factor_type: "totp" };

      const qr = en && en.totp ? en.totp.qr_code : null;
      const secret = en && en.totp ? en.totp.secret : null;
      const uri = en && en.totp ? en.totp.uri : null;

      let lastErr = null;
      while (true) {
        renderMFAScreen({
          title: "Configurar dupla autenticação (TOTP)",
          subtitle: "Necessário configurar TOTP para continuar.",
          qrDataUrl: qr,
          secret,
          uri,
          errorMsg: lastErr
        });

        const code = await new Promise((resolve) => {
          const inp = document.getElementById("inpMFACode");
          const btn = document.getElementById("btnMFAVerify");
          if (inp) inp.focus();

          const submit = () => {
            const v = inp ? String(inp.value || "").replace(/\s+/g, "") : "";
            resolve(v);
          };

          if (btn) btn.onclick = submit;
          if (inp) inp.onkeydown = (ev) => { if (ev.key === "Enter") submit(); };
        });

        if (!/^\d{6}$/.test(code)) {
          lastErr = "Código inválido. Introduza 6 dígitos.";
          continue;
        }

        const { error: cavErr } = await sb.auth.mfa.challengeAndVerify({
          factorId: factor.id,
          code
        });
        if (cavErr) {
          lastErr = cavErr.message || "Falha ao verificar MFA. Tente novamente.";
          continue;
        }

        const aal1 = await getAAL();
        if (String(aal1.currentLevel).toLowerCase() === "aal2") return true;

        lastErr = "Verificação concluída, mas a sessão não ficou em AAL2. Recarregue a página.";
      }
    }

    let lastErr = null;
    while (true) {
      renderMFAScreen({
        title: "Dupla autenticação obrigatória (TOTP)",
        subtitle: "Introduza o código da sua app autenticadora para continuar.",
        qrDataUrl: null,
        secret: null,
        uri: null,
        errorMsg: lastErr
      });

      const code = await new Promise((resolve) => {
        const inp = document.getElementById("inpMFACode");
        const btn = document.getElementById("btnMFAVerify");
        if (inp) inp.focus();

        const submit = () => {
          const v = inp ? String(inp.value || "").replace(/\s+/g, "") : "";
          resolve(v);
        };

        if (btn) btn.onclick = submit;
        if (inp) inp.onkeydown = (ev) => { if (ev.key === "Enter") submit(); };
      });

      if (!/^\d{6}$/.test(code)) {
        lastErr = "Código inválido. Introduza 6 dígitos.";
        continue;
      }

      const { error: cavErr } = await sb.auth.mfa.challengeAndVerify({
        factorId: factor.id,
        code
      });
      if (cavErr) {
        lastErr = cavErr.message || "Falha ao verificar MFA. Tente novamente.";
        continue;
      }

      const aal2 = await getAAL();
      if (String(aal2.currentLevel).toLowerCase() === "aal2") return true;

      lastErr = "Verificação concluída, mas a sessão não ficou em AAL2. Recarregue a página.";
    }
  }
  /* ---- FIM FUNÇÃO 11A.1 ---- */

/* ==== FIM BLOCO 11A — MFA Gate (AAL2 obrigatório para todos) ==== */


/* ==== INÍCIO BLOCO 11B — Boot principal ==== */

    /* ---- FUNÇÃO 11B.1 — boot ---- */
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

      if (G && G.authStateSubscription && typeof G.authStateSubscription.unsubscribe === "function") {
        try { G.authStateSubscription.unsubscribe(); } catch {}
      }

      const { data: authStateData } = window.sb.auth.onAuthStateChange(async (event, nextSession) => {
        if (__gcSessionLockActive) return;

        const ev = String(event || "").toUpperCase();
        const hasUser = !!(nextSession && nextSession.user);

        if (!hasUser || ev === "SIGNED_OUT" || ev === "USER_DELETED") {
          await __gcForceSessionLock("Sessão terminada. Volte a iniciar sessão para continuar.");
          return;
        }

        if (ev === "TOKEN_REFRESHED" || ev === "SIGNED_IN" || ev === "INITIAL_SESSION" || ev === "USER_UPDATED") {
          G.sessionUser = nextSession.user;
        }
      });

      G.authStateSubscription = authStateData && authStateData.subscription
        ? authStateData.subscription
        : null;

      await ensureAAL2();

      if (__gcSessionLockActive) return;

      try {
        G.role = await fetchMyRole(G.sessionUser.id);
      } catch (e) {
        if (__gcIsAuthError(e)) {
          await __gcForceSessionLock("Sessão expirada durante a validação do utilizador.");
          return;
        }
        G.role = null;
      }

      try {
        G.clinics = await fetchVisibleClinics();
      } catch (e) {
        if (__gcIsAuthError(e)) {
          await __gcForceSessionLock("Sessão expirada durante o carregamento das clínicas.");
          return;
        }
        G.clinics = [];
      }

      G.clinicsById = {};
      for (const c of G.clinics) G.clinicsById[c.id] = c;

      async function renderCurrentView() {
        renderAppShell();
        await wireLogout();
        hydrateShellHeader();

        const btnManagement = document.getElementById("btnManagement");
        if (btnManagement) {
          btnManagement.addEventListener("click", async () => {
            if (String(G.currentView || "agenda").toLowerCase() === "management") return;
            G.currentView = "management";
            await renderCurrentView();
          });
        }

        const btnBack = document.getElementById("btnBackToAgenda");
        if (btnBack) {
          btnBack.addEventListener("click", async () => {
            G.currentView = "agenda";
            await renderCurrentView();
          });
        }

        if (String(G.currentView || "agenda").toLowerCase() !== "agenda") {
  return;
}

        renderClinicsSelect(G.clinics);
        setAgendaSubtitleForSelectedDay();
        await wireQuickPatientSearch();

        const sel = document.getElementById("selClinic");
        if (sel) sel.addEventListener("change", refreshAgenda);

        const btnRefresh = document.getElementById("btnRefreshAgenda");
        if (btnRefresh) btnRefresh.addEventListener("click", refreshAgenda);

        const btnNew = document.getElementById("btnNewAppt");
        if (btnNew) {
          btnNew.addEventListener("click", () => openApptModal({ mode: "new", row: null }));
        }

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

        if (btnNewPatientMain && G.role && !["doctor", "secretary"].includes(String(G.role).toLowerCase())) {
          btnNewPatientMain.disabled = true;
          btnNewPatientMain.title = "Sem permissão para criar doentes.";
        }

        await refreshAgenda();
      }

      await renderCurrentView();

    } catch (e) {
      if (__gcIsAuthError(e)) {
        await __gcForceSessionLock("Sessão expirada ou inválida. Volte a iniciar sessão.");
        return;
      }

      console.error("Boot falhou:", e);
      document.body.textContent = "Erro ao iniciar a app. Abre a consola para detalhe.";
    }
  }
  /* ---- FIM FUNÇÃO 11B.1 ---- */

/* ==== FIM BLOCO 11B — Boot principal ==== */

/* ========================================================
   BLOCO 12 — Catálogo de exames
   MAPA DE NAVEGAÇÃO
   --------------------------------------------------------
   12A — Catálogo de exames (load + pesquisa)
      12A.1 loadExamsCatalog
      12A.2 searchExams
   ======================================================== */


/* ==== INÍCIO BLOCO 12A — Catálogo de exames ==== */

/* ---- FUNÇÃO 12A.1 — loadExamsCatalog ---- */
async function loadExamsCatalog() {
  try {

    const { data, error } = await window.sb
      .from("exams_catalog")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) throw error;

    return data || [];

  } catch (err) {

    console.error("Erro ao carregar catálogo de exames:", err);
    return [];

  }
}
/* ---- FIM FUNÇÃO 12A.1 ---- */


/* ---- FUNÇÃO 12A.2 — searchExams ---- */
function searchExams(exams, query) {

  if (!query || !query.trim()) return exams;

  const q = query.toLowerCase();

  return exams.filter((e) => {

    return (
      (e.exam_name && e.exam_name.toLowerCase().includes(q)) ||
      (e.body_region && e.body_region.toLowerCase().includes(q)) ||
      (e.search_terms && e.search_terms.toLowerCase().includes(q)) ||
      (e.category && e.category.toLowerCase().includes(q))
    );

  });

}
/* ---- FIM FUNÇÃO 12A.2 ---- */

 /* ==== FIM BLOCO 12A — Catálogo de exames ==== */

/* ==== INÍCIO BLOCO 12B — Estado do painel de exames ==== */

/* ---- FUNÇÃO 12B.1 — examsUiState ---- */
const examsUiState = {
  isOpen: false,
  query: "",
  exams: [],
  selectedGroup: "",
  selectedExamId: "",
  clinicalInfo: "",
  patientId: "",
  consultationId: null,
  mode: "groups"
};
/* ---- FIM FUNÇÃO 12B.1 ---- */

/* ==== FIM BLOCO 12B — Estado do painel de exames ==== */


/* ==== INÍCIO BLOCO 12C — Abertura / fecho do painel de exames ==== */

/* ---- FUNÇÃO 12C.1 — openExamsPanel ---- */
function openExamsPanel(opts = {}) {
  examsUiState.isOpen = true;
  examsUiState.patientId     = String(opts?.patientId || examsUiState.patientId || "");
  examsUiState.consultationId = opts?.consultationId || null;
  renderExamsPanel();
}
/* ---- FIM FUNÇÃO 12C.1 ---- */


/* ---- FUNÇÃO 12C.2 — closeExamsPanel ---- */
function closeExamsPanel() {
  examsUiState.isOpen = false;

  const panel = document.getElementById("gcExamsPanel");
  if (panel) panel.remove();
}
/* ---- FIM FUNÇÃO 12C.2 ---- */


/* ---- FUNÇÃO 12C.3 — renderExamsPanel ---- */
function renderExamsPanel() {

  if (!examsUiState.isOpen) return;

  const oldPanel = document.getElementById("gcExamsPanel");
  if (oldPanel) oldPanel.remove();

  const btnClose = document.getElementById("btnClosePView");
  if (!btnClose) {
    console.error("Botão btnClosePView não encontrado para o painel de exames.");
    return;
  }

  let host = btnClose.parentElement;
  while (host && host.parentElement) {
    const style = window.getComputedStyle(host);

    const hasWhiteBg =
      style.backgroundColor === "rgb(255, 255, 255)";

    const hasLargeBox =
      host.clientWidth >= 900 &&
      host.clientHeight >= 500;

    const hasScrollableContent =
      style.overflow === "auto" || style.overflowY === "auto";

    if (hasWhiteBg && hasLargeBox && hasScrollableContent) {
      break;
    }

    host = host.parentElement;
  }

  if (!host) {
    console.error("Host do modal do doente não encontrado para o painel de exames.");
    return;
  }

  host.style.position = "relative";

  const panel = document.createElement("div");
  panel.id = "gcExamsPanel";

  panel.style.position = "absolute";
  panel.style.top = "0";
  panel.style.right = "0";
  panel.style.width = "420px";
  panel.style.height = "100%";
  panel.style.background = "#ffffff";
  panel.style.borderLeft = "1px solid #e5e7eb";
  panel.style.boxShadow = "-8px 0 24px rgba(0,0,0,0.08)";
  panel.style.zIndex = "50";
  panel.style.display = "flex";
  panel.style.flexDirection = "column";
  panel.style.borderTopRightRadius = "14px";
  panel.style.borderBottomRightRadius = "14px";

  panel.innerHTML = `
    <div style="padding:16px; border-bottom:1px solid #e5e7eb; display:flex; justify-content:space-between; align-items:center;">
      <div style="font-weight:800; font-size:16px; color:#111827;">
        Pedidos de Exames
      </div>

      <button
        id="gcCloseExamsPanel"
        class="gcBtn"
        style="
          background:#ffffff;
          border:1px solid #d1d5db;
          color:#111827;
          font-weight:700;
        "
      >
        Fechar
      </button>
    </div>

    <div style="padding:16px; border-bottom:1px solid #f1f5f9;">
      <input
        id="gcExamSearch"
        type="text"
        placeholder="Pesquisar exame..."
        style="
          width:100%;
          padding:10px 12px;
          border:1px solid #cbd5e1;
          border-radius:8px;
          font-size:14px;
          box-sizing:border-box;
        "
      >
    </div>

    <div id="gcExamResults" style="flex:1; overflow:auto; padding:16px;">
    </div>
  `;

  host.appendChild(panel);
  loadAndRenderExams();

  document.getElementById("gcCloseExamsPanel")?.addEventListener("click", closeExamsPanel);
}
/* ---- FIM FUNÇÃO 12C.3 ---- */

/* ==== FIM BLOCO 12C — Abertura / fecho do painel de exames ==== */

/* ==== INÍCIO BLOCO 12D — Helpers de organização dos exames ==== */

/* ---- FUNÇÃO 12D.1 — getExamGroupLabel ---- */
function getExamGroupLabel(exam) {
  const category = String(exam?.category || "").trim();
  const subcategory = String(exam?.subcategory || "").trim();

  if (category === "Ecografia" && subcategory === "Osteoarticular") {
    return "Ecografia Osteoarticular";
  }

  if (category === "Ecografia" && subcategory === "Partes Moles") {
    return "Ecografia Partes Moles";
  }

  if (category === "Radiografia") {
    return "Radiografia";
  }

  if (category === "Ressonância Magnética") {
    return "Ressonância Magnética";
  }

  if (category === "Tomografia Computorizada") {
    return "Tomografia Computorizada";
  }

  if (category === "Densitometria Óssea") {
    return "Densitometria Óssea";
  }

  return "";
}
/* ---- FIM FUNÇÃO 12D.1 ---- */


/* ---- FUNÇÃO 12D.2 — listExamGroups ---- */
function listExamGroups(exams) {
  const wantedOrder = [
    "Ecografia Osteoarticular",
    "Ecografia Partes Moles",
    "Radiografia",
    "Ressonância Magnética",
    "Tomografia Computorizada",
    "Densitometria Óssea"
  ];

  const found = new Set();

  (exams || []).forEach((exam) => {
    if (exam?.is_direct === true) return;

    const label = getExamGroupLabel(exam);
    if (label) found.add(label);
  });

  return wantedOrder.filter((label) => found.has(label));
}
/* ---- FIM FUNÇÃO 12D.2 ---- */


/* ---- FUNÇÃO 12D.3 — listDirectExams ---- */
function listDirectExams(exams) {
  return (exams || [])
    .filter((exam) => exam?.is_direct === true)
    .sort((a, b) => Number(a?.sort_order || 0) - Number(b?.sort_order || 0));
}
/* ---- FIM FUNÇÃO 12D.3 ---- */


/* ---- FUNÇÃO 12D.4 — listGroupedExams ---- */
function listGroupedExams(exams, groupLabel) {
  return (exams || [])
    .filter((exam) => {
      if (exam?.is_direct === true) return false;
      return getExamGroupLabel(exam) === groupLabel;
    })
    .sort((a, b) => Number(a?.sort_order || 0) - Number(b?.sort_order || 0));
}
/* ---- FIM FUNÇÃO 12D.4 ---- */


/* ---- FUNÇÃO 12D.5 — getExamById ---- */
function getExamById(exams, examId) {
  return (exams || []).find((exam) => String(exam?.id || "") === String(examId || "")) || null;
}
/* ---- FIM FUNÇÃO 12D.5 ---- */

/* ==== FIM BLOCO 12D — Helpers de organização dos exames ==== */

/* ==== INÍCIO BLOCO 12E — Render do conteúdo do painel de exames ==== */

/* ---- FUNÇÃO 12E.1 — renderExamGroups ---- */
function renderExamGroups() {

  const container = document.getElementById("gcExamResults");
  if (!container) return;

  const exams = examsUiState.exams || [];

  const groups = listExamGroups(exams);
  const direct = listDirectExams(exams);

  let html = "";

  /* CATEGORIAS */
  if (groups.length) {

    html += `
      <div style="font-size:11px; font-weight:800; letter-spacing:0.6px;
                  color:#64748b; text-transform:uppercase; margin-bottom:8px;">
        Categorias
      </div>
    `;

    groups.forEach((g) => {
      html += `
        <div
          class="gcExamGroup"
          data-group="${g}"
          style="
            padding:10px 12px;
            border:1px solid #e2e8f0;
            border-radius:8px;
            margin-bottom:8px;
            cursor:pointer;
            font-weight:600;
            background:#ffffff;
          "
        >
          ${g}
        </div>
      `;
    });
  }

  /* EXAMES DIRETOS */
  if (direct.length) {

    html += `
      <div style="font-size:11px; font-weight:800; letter-spacing:0.6px;
                  color:#64748b; text-transform:uppercase;
                  margin-top:16px; margin-bottom:8px;">
        Exames
      </div>
    `;

    direct.forEach((exam) => {
      html += `
        <div
          class="gcExamDirect"
          data-exam-id="${exam.id}"
          style="
            padding:10px 12px;
            border:1px solid #e2e8f0;
            border-radius:8px;
            margin-bottom:8px;
            cursor:pointer;
            background:#ffffff;
          "
        >
          ${exam.exam_name}
        </div>
      `;
    });
  }

  container.innerHTML = html;

  container.querySelectorAll(".gcExamGroup").forEach((el) => {
    el.addEventListener("click", () => {
      const groupLabel = el.getAttribute("data-group") || "";
      if (!groupLabel) return;
      openExamGroup(groupLabel);
    });
  });

  container.querySelectorAll(".gcExamDirect").forEach((el) => {
    el.addEventListener("click", () => {
      const examId = el.getAttribute("data-exam-id") || "";
      if (!examId) return;
      openExamRequest(examId);
    });
  });

}
/* ---- FIM FUNÇÃO 12E.1 ---- */


/* ---- FUNÇÃO 12E.2 — loadAndRenderExams ---- */
async function loadAndRenderExams() {

  try {
    const exams = await loadExamsCatalog();
    examsUiState.exams = exams;
    renderExamGroups();
  } catch (err) {
    console.error("Erro ao carregar exames:", err);
  }

}
/* ---- FIM FUNÇÃO 12E.2 ---- */


/* ==== FIM BLOCO 12E — Render do conteúdo do painel de exames ==== */

/* ==== INÍCIO BLOCO 12F — Lista de exames por categoria + abertura do pedido ==== */

/* ---- FUNÇÃO 12F.1 — openExamGroup ---- */
function openExamGroup(groupLabel) {

  examsUiState.selectedGroup = groupLabel;
  examsUiState.selectedExamId = "";
  examsUiState.mode = "group";

  const exams = examsUiState.exams || [];
  const list = listGroupedExams(exams, groupLabel);

  const container = document.getElementById("gcExamResults");
  if (!container) return;

  let html = `
    <div style="margin-bottom:12px; display:flex; align-items:center; gap:8px;">
      <button
        id="gcExamBack"
        class="gcBtn"
        style="
          background:#ffffff;
          border:1px solid #cbd5e1;
          color:#0f172a;
          font-weight:600;
        "
      >
        ← Voltar
      </button>

      <div style="font-weight:800; color:#111827;">
        ${groupLabel}
      </div>
    </div>
  `;

  list.forEach((exam) => {
    html += `
      <div
        class="gcExamItem"
        data-exam-id="${exam.id}"
        style="
          padding:10px 12px;
          border:1px solid #e2e8f0;
          border-radius:8px;
          margin-bottom:8px;
          cursor:pointer;
          background:#ffffff;
        "
      >
        ${exam.exam_name}
      </div>
    `;
  });

  container.innerHTML = html;

  document.getElementById("gcExamBack")?.addEventListener("click", () => {
    examsUiState.mode = "groups";
    examsUiState.selectedGroup = "";
    examsUiState.selectedExamId = "";
    renderExamGroups();
  });

  container.querySelectorAll(".gcExamItem").forEach((el) => {
    el.addEventListener("click", () => {
      const examId = el.getAttribute("data-exam-id") || "";
      if (!examId) return;
      openExamRequest(examId);
    });
  });

}
/* ---- FIM FUNÇÃO 12F.1 ---- */

/* ---- FUNÇÃO 12F.2 — openExamRequest ---- */
function openExamRequest(examId) {
  examsUiState.selectedExamId = examId;
  examsUiState.mode = "exam";
  const exams = examsUiState.exams || [];
  const exam = getExamById(exams, examId);
  const container = document.getElementById("gcExamResults");
  if (!container) return;
  if (!exam) {
    container.innerHTML = `
      <div style="color:#b91c1c; font-weight:600;">
        Exame não encontrado.
      </div>
    `;
    return;
  }
  const savedInfo = String(examsUiState.clinicalInfo || "");
  container.innerHTML = `
    <div style="margin-bottom:12px; display:flex; align-items:center; gap:8px;">
      <button
        id="gcExamRequestBack"
        class="gcBtn"
        style="
          background:#ffffff;
          border:1px solid #cbd5e1;
          color:#0f172a;
          font-weight:600;
        "
      >
        ← Voltar
      </button>
    </div>
    <div style="
      border:1px solid #e2e8f0;
      border-radius:12px;
      background:#ffffff;
      padding:16px;
    ">
      <div style="
        font-size:18px;
        font-weight:900;
        color:#111827;
        margin-bottom:16px;
      ">
        Pedido de Exame
      </div>
      <div style="
        font-weight:800;
        color:#111827;
        margin-bottom:8px;
      ">
        R/
      </div>
      <div style="
        font-size:16px;
        font-weight:700;
        color:#111827;
        line-height:1.4;
        margin-bottom:18px;
      ">
        ${exam.exam_name}
      </div>
      <label
        for="gcExamClinicalInfo"
        style="
          display:block;
          font-size:13px;
          font-weight:700;
          color:#334155;
          margin-bottom:8px;
        "
      >
        Informação clínica
      </label>
      <textarea
        id="gcExamClinicalInfo"
        placeholder="Escreva a informação clínica..."
        style="
          width:100%;
          min-height:180px;
          padding:12px;
          border:1px solid #cbd5e1;
          border-radius:10px;
          font-size:14px;
          line-height:1.5;
          box-sizing:border-box;
          resize:vertical;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
        "
      >${savedInfo}</textarea>
      <div style="margin-top:14px; display:flex; justify-content:flex-end;">
        <button
          id="gcGenerateExamPdf"
          class="gcBtn"
          style="
            background:#1e3a8a;
            border:1px solid #1e3a8a;
            color:#ffffff;
            font-weight:800;
          "
        >
          Pré-visualizar e Gerar PDF
        </button>
      </div>
    </div>
  `;

  document.getElementById("gcExamRequestBack")?.addEventListener("click", () => {
    examsUiState.clinicalInfo = String(document.getElementById("gcExamClinicalInfo")?.value || "");
    if (examsUiState.selectedGroup) {
      openExamGroup(examsUiState.selectedGroup);
      return;
    }
    examsUiState.mode = "groups";
    examsUiState.selectedExamId = "";
    renderExamGroups();
  });

  document.getElementById("gcExamClinicalInfo")?.addEventListener("input", (ev) => {
    examsUiState.clinicalInfo = String(ev.target?.value || "");
  });

  document.getElementById("gcGenerateExamPdf")?.addEventListener("click", async () => {
    try {
      examsUiState.clinicalInfo = String(document.getElementById("gcExamClinicalInfo")?.value || "");
      const exams = examsUiState.exams || [];
      const exam = getExamById(exams, examsUiState.selectedExamId);
      if (!exam) { alert("Exame não encontrado."); return; }

      const patientId = String(examsUiState.patientId || "").trim();
      if (!patientId) { alert("Doente sem ID válido."); return; }

      /* ===== obter clínica ativa do doente ===== */
      const { data: patientClinicRow, error: patientClinicError } = await window.sb
        .from("patient_clinic")
        .select("clinic_id")
        .eq("patient_id", patientId)
        .eq("is_active", true)
        .single();
      if (patientClinicError || !patientClinicRow?.clinic_id) {
        console.error("patient_clinic error:", patientClinicError);
        alert("Não consegui determinar a clínica ativa do doente.");
        return;
      }

      const resolvedClinicId = String(patientClinicRow.clinic_id || "").trim();
      if (!resolvedClinicId) { alert("Sem clínica ativa."); return; }

      /* ===== carregar dados da clínica ===== */
      const { data: clinic, error: clinicError } = await window.sb
        .from("clinics")
        .select("id, name, address_line1, address_line2, postal_code, city, phone, email, website, logo_url")
        .eq("id", resolvedClinicId)
        .single();
      if (clinicError || !clinic) {
        console.error("clinics error:", clinicError);
        alert("Não consegui carregar os dados da clínica.");
        return;
      }

      /* ===== vinheta ===== */
      let vinhetaUrl = "";
      try {
        const vinhetaSignedUrl = await window.__gc_storageSignedUrl(window.__gc_VINHETA_BUCKET, window.__gc_VINHETA_PATH, 3600);
        if (vinhetaSignedUrl) {
          vinhetaUrl = await window.__gc_urlToDataUrl(vinhetaSignedUrl, "image/png");
        }
      } catch (e) {
        console.warn("Pedido de exame: vinheta falhou:", e);
        vinhetaUrl = "";
      }

      /* ===== logo clínica ===== */
      let clinicLogoUrl = "";
      try {
        const rawLogo = String(clinic?.logo_url || "").trim();
        if (rawLogo.startsWith("data:")) {
          clinicLogoUrl = rawLogo;
        } else if (rawLogo.startsWith("http://") || rawLogo.startsWith("https://")) {
          clinicLogoUrl = await window.__gc_urlToDataUrl(rawLogo, "image/png");
        } else {
          clinicLogoUrl = "";
        }
      } catch (e) {
        console.warn("Pedido de exame: logo falhou:", e);
        clinicLogoUrl = "";
      }

      /* ===== assinatura ===== */
      let signatureUrl = "";
      try {
        const signatureSignedUrl = await window.__gc_storageSignedUrl(window.__gc_VINHETA_BUCKET, "signatures/signature_dr_joao_morais.png", 3600);
        if (signatureSignedUrl) {
          signatureUrl = await window.__gc_urlToDataUrl(signatureSignedUrl, "image/png");
        }
      } catch (e) {
        console.warn("Pedido de exame: assinatura falhou:", e);
        signatureUrl = "";
      }

      /* ===== gerar HTML ===== */
      const html = buildExamRequestHtml({
        clinic,
        examName: exam.exam_name,
        clinicalInfo: examsUiState.clinicalInfo,
        vinhetaUrl,
        clinicLogoUrl,
        signatureUrl
      });

      /* ===== guardar contexto e abrir editor ===== */
      window.__gc_pendingExamCtx = {
        patientId,
        clinicId: resolvedClinicId,
        consultationId: examsUiState.consultationId || null,
        examName: exam.exam_name
      };

      window.openDocumentEditor(html, `Pedido de Exame — ${exam.exam_name}`);

    } catch (err) {
      console.error("Gerar PDF pedido de exame falhou:", err);
      alert("Erro ao gerar pedido de exame.");
    }
  });
}
/* ---- FIM FUNÇÃO 12F.2 ---- */

/* ==== FIM BLOCO 12F ==== */

/* ==== INÍCIO BLOCO 12G — HTML do pedido de exame ==== */

/* ---- FUNÇÃO 12G.1 — buildExamRequestHtml ---- */
function buildExamRequestHtml({ clinic, examName, clinicalInfo, vinhetaUrl, clinicLogoUrl, signatureUrl }) {

  function escHtml(v) {
    return String(v || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escUrlAttr(u) {
    return String(u || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function nl2br(v) {
    return escHtml(v).replace(/\n/g, "<br>");
  }

  function fmtDatePt(d) {
    try {
      const dt = d ? new Date(d) : new Date();
      const dd = String(dt.getDate()).padStart(2, "0");
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      const yy = dt.getFullYear();
      return `${dd}-${mm}-${yy}`;
    } catch (_) {
      return "";
    }
  }

  const locality = String(clinic?.city || "").trim();
  const localityDate = [locality, fmtDatePt(new Date())].filter(Boolean).join(", ");
  const logoSrc = String(clinicLogoUrl || clinic?.logo_url || "").trim();

  return `
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Pedido de Exame</title>
<style>
  body { margin:0; background:#fff; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif; color:#111; }
  * { box-sizing:border-box; }
  @page { size: A4; margin: 16mm; }
  .a4 { width:210mm; background:#fff; }
  .top { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
  .topLeft { font-size:13.5px; line-height:1.4; }
  .logo { width:120px; height:auto; max-height:60px; object-fit:contain; display:block; }
  .hr { height:1px; background:#111; margin:10px 0 14px 0; }
  .title { text-align:center; font-weight:900; font-size:22px; margin:2px 0 18px 0; }
  .bodyText { font-size:15px; line-height:1.45; }
  .rx { font-weight:800; margin-bottom:12px; }
  .examName { font-weight:800; font-size:18px; margin-bottom:18px; }
  .label { font-weight:800; margin-bottom:8px; }
  .clinicalInfo { min-height:180px; white-space:normal; }
  .footerBlock { margin-top:28px; page-break-inside:auto; break-inside:auto; }
  .hr2 { height:1px; background:#111; margin:16px 0 10px 0; }
  .footRow { display:flex; justify-content:space-between; align-items:flex-start; gap:10px; }
  .web { font-size:14px; font-weight:700; }
  .vinheta { margin-top:8px; width:4cm; height:2.5cm; object-fit:contain; display:block; }
  .locDate { text-align:right; font-size:14px; margin-top:14px; }
  .sig { margin-top:60px; display:flex; justify-content:flex-end; }
  .sigBox { width:360px; text-align:center; page-break-inside:avoid; break-inside:avoid; }
  .sigImgWrap { position:relative; height:80px; display:flex; align-items:flex-end; justify-content:center; margin-bottom:-1px; }
  .sigImg { max-height:80px; max-width:280px; object-fit:contain; display:block; }
  .sigLine { border-top:1px solid #111; padding-top:10px; }
  .sigName { font-weight:900; font-size:18px; margin-top:6px; }
  .sigRole { font-size:14px; margin-top:2px; }
</style>
</head>
<body>
  <div class="a4">

    <div class="top">
      <div class="topLeft">
        <div>${escHtml(clinic?.website || "www.JoaoMorais.pt")}</div>
        <div>${escHtml(clinic?.phone || "")}</div>
      </div>
      <div>
        ${logoSrc ? `<img class="logo" src="${escUrlAttr(logoSrc)}" />` : ``}
      </div>
    </div>

    <div class="hr"></div>
    <div class="title">Pedido de Exame</div>

    <div class="bodyText">
      <div class="rx">R/</div>
      <div class="examName">${escHtml(examName || "—")}</div>

      <div class="label">Informação clínica</div>
      <div class="clinicalInfo">${clinicalInfo && String(clinicalInfo).trim() ? nl2br(clinicalInfo) : "—"}</div>
    </div>

    <div class="footerBlock">
      <div class="hr2"></div>

      <div class="footRow">
        <div>
          <div class="web">www.JoaoMorais.pt</div>
          ${vinhetaUrl ? `<img class="vinheta" src="${escUrlAttr(vinhetaUrl)}" />` : ``}
        </div>

        <div style="flex:1;">
          ${localityDate ? `<div class="locDate">${escHtml(localityDate)}</div>` : ``}

          <div class="sig">
            <div class="sigBox">
              <div class="sigLine"></div>
              <div class="sigName">Dr. João Morais</div>
              <div class="sigRole">Médico Fisiatra</div>
              <div class="sigRole">Sports Medicine &amp; Rehabilitation</div>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</body>
</html>
`;
}
/* ---- FIM FUNÇÃO 12G.1 ---- */

/* ==== FIM BLOCO 12G — HTML do pedido de exame ==== */

/* ========================================================
   BLOCO 13/13 — DOMContentLoaded + fechamento IIFE
   MAPA DE NAVEGAÇÃO
   --------------------------------------------------------
   13A — DOMContentLoaded
      13A.1 document.addEventListener("DOMContentLoaded", boot)

   13B — Fechamento IIFE
      13B.1 fechamento da IIFE
   ======================================================== */

/* ==== INÍCIO BLOCO 13A — DOMContentLoaded ==== */

  /* ---- FUNÇÃO 13A.1 — document.addEventListener("DOMContentLoaded", boot) ---- */
  document.addEventListener("DOMContentLoaded", boot);
  /* ---- FIM FUNÇÃO 13A.1 ---- */

/* ==== FIM BLOCO 13A — DOMContentLoaded ==== */


/* ==== INÍCIO BLOCO 13B — Fechamento IIFE ==== */

})();  // Fim IIFE

/* ==== FIM BLOCO 13B — Fechamento IIFE ==== */