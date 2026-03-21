/* ========================================================
   AUTH.JS — Autenticação, Permissões e Sessão
   --------------------------------------------------------
   01F — Fetch de role e clínicas visíveis
      01F.1  fetchMyRole(userId)
      01F.2  fetchVisibleClinics()

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

  window.__GC_MY_CLINIC_IDS__    = rows.map(r => r.clinic_id).filter(Boolean);
  window.__GC_MY_CLINICS_COUNT__ = window.__GC_MY_CLINIC_IDS__.length;

  window.__GC_IS_SUPERADMIN__ = rows.some(r => r.role === "super_admin");

  const roles = rows.map(r => String(r.role || "").trim()).filter(Boolean);
  if (roles.includes("super_admin"))    return "super_admin";
  if (roles.includes("admin"))          return "admin";
  if (roles.includes("medico"))         return "medico";
  if (roles.includes("fisioterapeuta")) return "fisioterapeuta";
  if (roles.includes("administrativo")) return "administrativo";
  return null;
}

/* ---- 01F.2 — fetchVisibleClinics ---- */
export async function fetchVisibleClinics() {
  const { data, error } = await window.sb
    .from("clinics")
    .select("id, name, slug")
    .order("name", { ascending: true });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
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


/* ==== 10A — Sessão bloqueada / auth guard ==== */

let __gcSessionLockActive = false;

/* ---- 10A.2 — __gcIsAuthError ---- */
export function __gcIsAuthError(err) {
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
    msg.includes("jwt")           ||
    msg.includes("token")         ||
    msg.includes("auth")          ||
    msg.includes("not logged in") ||
    msg.includes("session")       ||
    msg.includes("forbidden")     ||
    msg.includes("unauthorized")
  );
}

/* ---- 10A.3 — __gcRenderSessionLockedScreen ---- */
function __gcRenderSessionLockedScreen(reasonText) {
  const reason = String(reasonText || "Sessão expirada por segurança. Volte a iniciar sessão.");

  const esc = (s) => String(s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");

  const root = document.getElementById("appRoot") || document.body;
  root.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#0b1220;color:#e7eefc;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;">
      <div style="width:100%;max-width:520px;background:#111a2e;border:1px solid rgba(255,255,255,.10);border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.35);padding:24px 20px;">
        <div style="font-size:18px;font-weight:800;letter-spacing:.2px;">Sessão bloqueada</div>
        <div style="margin-top:10px;font-size:14px;line-height:1.5;opacity:.95;">${esc(reason)}</div>
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

/* ---- 10A.4 — __gcForceSessionLock ---- */
export async function __gcForceSessionLock(reasonText) {
  if (__gcSessionLockActive) return;
  __gcSessionLockActive = true;

  try {
    if (G?.authStateSubscription?.unsubscribe) G.authStateSubscription.unsubscribe();
  } catch {}

  try {
    if (window.sb?.auth?.signOut) await window.sb.auth.signOut();
  } catch {}

  try {
    __gcRenderSessionLockedScreen(reasonText);
  } catch (e) {
    console.error("Falha a renderizar ecrã de sessão bloqueada:", e);
    hardRedirect("/index.html");
    return;
  }

  setTimeout(() => hardRedirect("/index.html"), 1500);
}


/* ==== 10B — Logout ==== */

/* ---- 10B.1 — wireLogout ---- */
export async function wireLogout() {
  const btn = document.getElementById("btnLogout");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    btn.disabled    = true;
    btn.textContent = "A terminar sessão…";

    try {
      if (G?.authStateSubscription?.unsubscribe) {
        try { G.authStateSubscription.unsubscribe(); } catch {}
      }
      if (window.sb?.auth?.signOut) {
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


/* ==== 11A — MFA Gate (AAL2 obrigatório para todos) ==== */

/* ---- 11A.1 — ensureAAL2 ---- */
export async function ensureAAL2() {
  const sb = window.sb;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

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
                  ${secret ? `<div style="margin-top:10px;font-size:12px;opacity:.92;"><b>Secret:</b> <span style="font-family:monospace;">${esc(secret)}</span></div>` : ``}
                  ${uri    ? `<div style="margin-top:6px;font-size:12px;opacity:.92;word-break:break-all;"><b>URI:</b> <span style="font-family:monospace;">${esc(uri)}</span></div>` : ``}
                </div>
              </div>
            ` : ``}

            <div style="margin-top:${qrDataUrl ? "14px" : "0"};">
              <label style="display:block;font-size:13px;font-weight:700;margin-bottom:6px;">Código (6 dígitos)</label>
              <input id="inpMFACode" inputmode="numeric" autocomplete="one-time-code" placeholder="123456"
                style="width:100%;padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:#0b1220;color:#e7eefc;font-size:16px;letter-spacing:2px;"
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
                Sessão atual: <span style="font-family:monospace;">${esc(G.sessionUser?.email || "—")}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const btnLogout = document.getElementById("btnMFALogout");
    if (btnLogout) btnLogout.onclick = async () => {
      try { await sb.auth.signOut(); } catch {}
      hardRedirect("/index.html");
    };

    const btnRetry = document.getElementById("btnMFARetry");
    if (btnRetry) btnRetry.onclick = () => window.location.reload();
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
      if (sel) sel.addEventListener("change", refreshAgenda);

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

      if (btnNew && G.role && !["doctor", "secretary"].includes(String(G.role).toLowerCase())) {
        btnNew.disabled = true;
        btnNew.title    = "Sem permissão para criar marcações.";
      }

      if (btnNewPatientMain && G.role && !["doctor", "secretary"].includes(String(G.role).toLowerCase())) {
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
