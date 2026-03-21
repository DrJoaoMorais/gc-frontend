/* ========================================================
   AUTH.JS — Autenticação, Permissões e Sessão
   --------------------------------------------------------
   01F — Fetch de role e clínicas visíveis
      01F.1  fetchMyRole(userId)
      01F.2  fetchVisibleClinics()
      01F.3  resolveEffectiveRole()   ← NOVO

   01G — Debug hooks globais
      01G.1  setupGlobalDebugHooks()   (auto-executa)

   01H — Logout automático por inatividade
      01H.1  setupIdleLogout()         (auto-executa)

   10A — Sessão bloqueada / auth guard
      10A.2  __gcIsAuthError(err)
      10A.3  __gcRenderSessionLockedScreen(reasonText)
      10A.4  __gcForceSessionLock(reasonText)

   10B — Logout
      10B.1  wireLogout()

   11A — MFA Gate (AAL2 obrigatório para todos)
      11A.1  ensureAAL2()

   11B — Boot principal
      11B.1  boot()
   ======================================================== */

import { hardRedirect, fmtDateISO } from "./helpers.js";
import { G } from "./state.js";

/* ---- Referências a funções definidas noutros módulos ----
   Estas funções são injectadas em runtime via window.*
   para evitar dependências circulares durante a migração.
   Serão substituídas por imports directos no Passo 9.
   -------------------------------------------------------- */
function renderAppShell()             { return window.__gc_renderAppShell(); }
function hydrateShellHeader()         { return window.__gc_hydrateShellHeader(); }
function renderClinicsSelect(c)       { return window.__gc_renderClinicsSelect(c); }
function setAgendaSubtitleForSelectedDay() { return window.__gc_setAgendaSubtitleForSelectedDay(); }
function wireQuickPatientSearch()     { return window.__gc_wireQuickPatientSearch(); }
function refreshAgenda()              { return window.__gc_refreshAgenda(); }
function openApptModal(opts)          { return window.__gc_openApptModal(opts); }
function openNewPatientMainModal(o)   { return window.__gc_openNewPatientMainModal(o); }
function openCalendarOverlay()        { return window.__gc_openCalendarOverlay(); }


/* ==== 01F — Fetch de role e clínicas visíveis ==== */

/* ---- 01F.1 — fetchMyRole ---- */
export async function fetchMyRole(userId) {
  // Fonte de verdade: clinic_members (multi-clínica)
  const { data, error } = await window.sb
    .from("clinic_members")
    .select("role, clinic_id, is_active")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error) throw error;

  const rows = Array.isArray(data) ? data : [];

  // Guardar mapa clinic_id → role no estado global
  G.myClinicRoles = {};
  for (const r of rows) {
    if (r.clinic_id) G.myClinicRoles[r.clinic_id] = String(r.role || "").trim();
  }

  window.__GC_MY_CLINIC_IDS__    = rows.map(r => r.clinic_id).filter(Boolean);
  window.__GC_MY_CLINICS_COUNT__ = window.__GC_MY_CLINIC_IDS__.length;
  window.__GC_IS_SUPERADMIN__    = rows.some(r => r.role === "super_admin");

  // Se ainda não há clínica activa, usar a clínica principal (João Morais Web)
  // ou a primeira clínica disponível
  if (!G.activeClinicId && rows.length > 0) {
    // Preferir a clínica onde é super_admin como clínica de gestão por defeito
    const superRow = rows.find(r => r.role === "super_admin");
    // Mas arrancar na primeira clínica clínica (medico) se existir
    const medicoRow = rows.find(r => r.role === "medico");
    G.activeClinicId = (medicoRow || superRow || rows[0]).clinic_id;
  }

  // Role efectivo = role na clínica activa
  return resolveEffectiveRole();
}

/* ---- 01F.2 — fetchVisibleClinics ---- */
export async function fetchVisibleClinics() {
  // super_admin vê todas as clínicas; outros vêem apenas as suas
  const isSuperAdmin = window.__GC_IS_SUPERADMIN__ || false;

  if (isSuperAdmin) {
    const { data, error } = await window.sb
      .from("clinics")
      .select("id, name, slug, is_active")
      .eq("is_active", true)
      .order("name", { ascending: true });
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  }

  // Não super_admin: apenas clínicas onde tem membro activo
  const clinicIds = window.__GC_MY_CLINIC_IDS__ || [];
  if (!clinicIds.length) return [];

  const { data, error } = await window.sb
    .from("clinics")
    .select("id, name, slug, is_active")
    .in("id", clinicIds)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

/* ---- 01F.3 — resolveEffectiveRole ---- */
export function resolveEffectiveRole() {
  // Calcula o role efectivo com base na clínica activa
  if (!G.activeClinicId || !G.myClinicRoles) return null;
  const role = G.myClinicRoles[G.activeClinicId] || null;

  // Hierarquia de prioridade (segurança)
  const priority = ["super_admin", "admin", "medico", "fisioterapeuta", "administrativo"];
  return priority.includes(role) ? role : null;
}


/* ==== 01G — Debug hooks globais ==== */

/* ---- 01G.1 — setupGlobalDebugHooks (auto-executa) ---- */
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
      safeLog("   stack:",   r?.stack);
      safeLog("   name:",    r?.name);
      safeLog("   cause:",   r?.cause);
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


/* ==== 01H — Logout automático por inatividade ==== */

/* ---- 01H.1 — setupIdleLogout (auto-executa) ---- */
(function setupIdleLogout() {
  const IDLE_MS = 30 * 60 * 1000; // 30 minutos
  const LS_LAST_ACTIVITY = "gc_last_activity";

  let idleTimer    = null;
  let listenersOn  = false;

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
    try { localStorage.setItem(LS_LAST_ACTIVITY, String(nowMs())); } catch (_) {}
  }

  function getLastActivityMs() {
    try {
      const v = localStorage.getItem(LS_LAST_ACTIVITY);
      const n = v ? Number(v) : NaN;
      return Number.isFinite(n) ? n : 0;
    } catch (_) { return 0; }
  }

  function clearIdleTimer() {
    if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
  }

  function scheduleIdleCheck() {
    clearIdleTimer();
    const last      = getLastActivityMs() || nowMs();
    const elapsed   = nowMs() - last;
    const remaining = Math.max(0, IDLE_MS - elapsed);

    idleTimer = setTimeout(async () => {
      const elapsed2 = nowMs() - (getLastActivityMs() || 0);
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
    window.addEventListener("click",      onAnyActivity, opts);
    window.addEventListener("mousemove",  onAnyActivity, opts);
    window.addEventListener("keydown",    onAnyActivity, opts);
    window.addEventListener("scroll",     onAnyActivity, opts);
    window.addEventListener("touchstart", onAnyActivity, opts);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") onAnyActivity();
    }, true);
  }

  function removeListeners() {
    if (!listenersOn) return;
    listenersOn = false;
    window.removeEventListener("click",      onAnyActivity, true);
    window.removeEventListener("mousemove",  onAnyActivity, true);
    window.removeEventListener("keydown",    onAnyActivity, true);
    window.removeEventListener("scroll",     onAnyActivity, true);
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

    window.sb.auth.onAuthStateChange((event, session) => {
      const ev = String(event || "").toUpperCase();
      if (ev === "SIGNED_IN" || ev === "TOKEN_REFRESHED") {
        window.__gcHasSession = true;
        addListeners();
        markActivity();
        scheduleIdleCheck();
      } else if (ev === "SIGNED_OUT" || ev === "USER_DELETED") {
        window.__gcHasSession = false;
        removeListeners();
      }
    });
  }

  bootstrap().catch(e => console.warn("[SEC] setupIdleLogout bootstrap error:", e));
})();


/* ==== 10A — Sessão bloqueada / auth guard ==== */

/* ---- 10A.1 — __gcSessionLockActive ---- */
export let __gcSessionLockActive = false;

/* ---- 10A.2 — __gcIsAuthError ---- */
export function __gcIsAuthError(err) {
  if (!err) return false;
  const msg = String(err?.message || err?.error_description || err?.toString() || "").toLowerCase();
  const status = Number(err?.status || err?.statusCode || 0);
  return (
    status === 401 ||
    msg.includes("jwt expired") ||
    msg.includes("invalid jwt") ||
    msg.includes("not authenticated") ||
    msg.includes("session_not_found") ||
    msg.includes("refresh_token_not_found") ||
    msg.includes("invalid refresh token")
  );
}

/* ---- 10A.3 — __gcRenderSessionLockedScreen ---- */
export function __gcRenderSessionLockedScreen(reasonText) {
  const reason = String(reasonText || "A sua sessão foi terminada por segurança.");
  document.body.innerHTML = `
    <style>
      body { margin:0; font-family: system-ui, sans-serif; background:#0b1020; color:#e8eefc; display:flex; align-items:center; justify-content:center; height:100vh; }
      .lock-box { background:#121a33; border:1px solid #22305f; border-radius:16px; padding:40px 32px; max-width:420px; text-align:center; }
      .lock-title { font-size:20px; font-weight:700; margin-bottom:12px; }
      .lock-reason { font-size:14px; color:#94a3b8; margin-bottom:24px; }
      .lock-btn { padding:12px 28px; border-radius:10px; border:none; background:#1a56db; color:#fff; font-size:15px; font-weight:600; cursor:pointer; }
    </style>
    <div class="lock-box">
      <div class="lock-title">🔒 Sessão terminada</div>
      <div class="lock-reason">${reason}</div>
      <button class="lock-btn" onclick="window.location.replace('/index.html')">Iniciar sessão</button>
    </div>
  `;
}

/* ---- 10A.4 — __gcForceSessionLock ---- */
export async function __gcForceSessionLock(reasonText) {
  __gcSessionLockActive = true;
  try { await window.sb?.auth?.signOut(); } catch (_) {}
  __gcRenderSessionLockedScreen(reasonText);
}


/* ==== 10B — Logout ==== */

/* ---- 10B.1 — wireLogout ---- */
export async function wireLogout() {
  const btn = document.getElementById("btnLogout");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    try {
      await window.sb.auth.signOut();
    } catch (_) {}
    window.location.replace("/index.html");
  });
}


/* ==== 11A — MFA Gate (AAL2 obrigatório para todos) ==== */

/* ---- 11A.1 — ensureAAL2 ---- */
export async function ensureAAL2() {
  const sb = window.sb;
  if (!sb) return false;

  function renderMFAScreen({ title, subtitle, qrDataUrl, secret, uri, errorMsg }) {
    document.body.innerHTML = `
      <style>
        body { margin:0; font-family:system-ui,sans-serif; background:#0b1020; color:#e8eefc; display:flex; align-items:center; justify-content:center; height:100vh; }
        .mfa-box { background:#121a33; border:1px solid #22305f; border-radius:16px; padding:36px 28px; max-width:380px; width:100%; text-align:center; }
        .mfa-title { font-size:18px; font-weight:700; margin-bottom:6px; }
        .mfa-sub { font-size:13px; color:#94a3b8; margin-bottom:20px; }
        .mfa-qr { margin:0 auto 16px; width:180px; height:180px; border-radius:8px; background:#fff; display:flex; align-items:center; justify-content:center; }
        .mfa-qr img { width:100%; border-radius:8px; }
        .mfa-secret { font-size:12px; color:#94a3b8; margin-bottom:16px; word-break:break-all; }
        .mfa-input { width:100%; padding:12px; border-radius:10px; border:1px solid #22305f; background:#0f1630; color:#e8eefc; font-size:20px; text-align:center; letter-spacing:6px; margin-bottom:12px; box-sizing:border-box; }
        .mfa-btn { width:100%; padding:12px; border-radius:10px; border:none; background:#1a56db; color:#fff; font-size:15px; font-weight:600; cursor:pointer; }
        .mfa-err { color:#f87171; font-size:13px; margin-top:10px; }
      </style>
      <div class="mfa-box">
        <div class="mfa-title">${title}</div>
        <div class="mfa-sub">${subtitle}</div>
        ${qrDataUrl ? `<div class="mfa-qr"><img src="${qrDataUrl}" alt="QR Code MFA"/></div>` : ""}
        ${secret ? `<div class="mfa-secret">Chave manual: <strong>${secret}</strong></div>` : ""}
        <input id="inpMFACode" class="mfa-input" type="text" inputmode="numeric" maxlength="6" placeholder="000000" autocomplete="one-time-code"/>
        <button id="btnMFAVerify" class="mfa-btn">Verificar</button>
        ${errorMsg ? `<div class="mfa-err">${errorMsg}</div>` : ""}
      </div>
    `;
  }

  async function getAAL() {
    const { data: aal, error: aalErr } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalErr) throw aalErr;
    return aal;
  }

  const aal0 = await getAAL();
  if (String(aal0.currentLevel).toLowerCase() === "aal2") return true;

  const { data: factors, error: lfErr } = await sb.auth.mfa.listFactors();
  if (lfErr) throw lfErr;

  const totps  = (factors && factors.totp) ? factors.totp : [];
  let   factor = null;
  if (Array.isArray(totps) && totps.length) {
    factor = totps.find(f => String(f.status || "").toLowerCase() === "verified") || totps[0];
  }

  if (!factor) {
    const { data: en, error: enErr } = await sb.auth.mfa.enroll({ factorType: "totp" });
    if (enErr) throw enErr;

    factor = { id: en.id, factor_type: "totp" };
    const qr     = en?.totp?.qr_code ?? null;
    const secret = en?.totp?.secret  ?? null;
    const uri    = en?.totp?.uri     ?? null;

    let lastErr = null;
    while (true) {
      renderMFAScreen({ title: "Configurar dupla autenticação (TOTP)", subtitle: "Necessário configurar TOTP para continuar.", qrDataUrl: qr, secret, uri, errorMsg: lastErr });

      const code = await new Promise((resolve) => {
        const inp = document.getElementById("inpMFACode");
        const btn = document.getElementById("btnMFAVerify");
        if (inp) inp.focus();
        const submit = () => resolve(inp ? String(inp.value || "").replace(/\s+/g, "") : "");
        if (btn) btn.onclick = submit;
        if (inp) inp.onkeydown = (ev) => { if (ev.key === "Enter") submit(); };
      });

      if (!/^\d{6}$/.test(code)) { lastErr = "Código inválido. Introduza 6 dígitos."; continue; }

      const { error: cavErr } = await sb.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
      if (cavErr) { lastErr = cavErr.message || "Falha ao verificar MFA. Tente novamente."; continue; }

      const aal1 = await getAAL();
      if (String(aal1.currentLevel).toLowerCase() === "aal2") return true;

      lastErr = "Verificação concluída, mas a sessão não ficou em AAL2. Recarregue a página.";
    }
  }

  let lastErr = null;
  while (true) {
    renderMFAScreen({ title: "Dupla autenticação obrigatória (TOTP)", subtitle: "Introduza o código da sua app autenticadora para continuar.", qrDataUrl: null, secret: null, uri: null, errorMsg: lastErr });

    const code = await new Promise((resolve) => {
      const inp = document.getElementById("inpMFACode");
      const btn = document.getElementById("btnMFAVerify");
      if (inp) inp.focus();
      const submit = () => resolve(inp ? String(inp.value || "").replace(/\s+/g, "") : "");
      if (btn) btn.onclick = submit;
      if (inp) inp.onkeydown = (ev) => { if (ev.key === "Enter") submit(); };
    });

    if (!/^\d{6}$/.test(code)) { lastErr = "Código inválido. Introduza 6 dígitos."; continue; }

    const { error: cavErr } = await sb.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    if (cavErr) { lastErr = cavErr.message || "Falha ao verificar MFA. Tente novamente."; continue; }

    const aal2 = await getAAL();
    if (String(aal2.currentLevel).toLowerCase() === "aal2") return true;

    lastErr = "Verificação concluída, mas a sessão não ficou em AAL2. Recarregue a página.";
  }
}


/* ==== 11B — Boot principal ==== */

/* ---- 11B.1 — boot ---- */
export async function boot() {
  try {
    if (!window.sb?.auth?.getSession) {
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

    if (G?.authStateSubscription?.unsubscribe) {
      try { G.authStateSubscription.unsubscribe(); } catch {}
    }

    const { data: authStateData } = window.sb.auth.onAuthStateChange(async (event, nextSession) => {
      if (__gcSessionLockActive) return;

      const ev     = String(event || "").toUpperCase();
      const hasUser = !!(nextSession && nextSession.user);

      if (!hasUser || ev === "SIGNED_OUT" || ev === "USER_DELETED") {
        await __gcForceSessionLock("Sessão terminada. Volte a iniciar sessão para continuar.");
        return;
      }

      if (["TOKEN_REFRESHED", "SIGNED_IN", "INITIAL_SESSION", "USER_UPDATED"].includes(ev)) {
        G.sessionUser = nextSession.user;
      }
    });

    G.authStateSubscription = authStateData?.subscription ?? null;

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

      if (String(G.currentView || "agenda").toLowerCase() !== "agenda") return;

      renderClinicsSelect(G.clinics);
      setAgendaSubtitleForSelectedDay();
      await wireQuickPatientSearch();

      const sel = document.getElementById("selClinic");
      if (sel) {
        // Mudar clínica activa actualiza o role efectivo
        sel.addEventListener("change", () => {
          G.activeClinicId = sel.value || G.activeClinicId;
          G.role = resolveEffectiveRole();
          refreshAgenda();
        });
      }

      const btnRefresh = document.getElementById("btnRefreshAgenda");
      if (btnRefresh) btnRefresh.addEventListener("click", refreshAgenda);

      const btnNew = document.getElementById("btnNewAppt");
      if (btnNew) btnNew.addEventListener("click", () => openApptModal({ mode: "new", row: null }));

      const btnNewPatientMain = document.getElementById("btnNewPatientMain");
      if (btnNewPatientMain) {
        btnNewPatientMain.addEventListener("click", () => {
          const s        = document.getElementById("selClinic");
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

      const canSchedule = ["super_admin", "admin", "medico", "administrativo"].includes(String(G.role || "").toLowerCase());
      if (btnNew && G.role && !canSchedule) {
        btnNew.disabled = true;
        btnNew.title    = "Sem permissão para criar marcações.";
      }

      if (btnNewPatientMain && G.role && !canSchedule) {
        btnNewPatientMain.disabled = true;
        btnNewPatientMain.title    = "Sem permissão para criar doentes.";
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
