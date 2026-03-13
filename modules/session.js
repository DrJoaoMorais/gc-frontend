/**
 * session.js — Passo 7
 * BLOCO 10A — Sessão bloqueada / auth guard
 * BLOCO 10B — Logout
 * BLOCO 11A — MFA Gate (AAL2 obrigatório)
 *
 * Extraído de app.js blocos 10A, 10B, 11A
 *
 * Imports:
 *   config.js  → G
 *   helpers.js → hardRedirect  (se existir; caso contrário usa window.location)
 */

import { G } from "./state.js";

/* ====================================================================
   BLOCO 10A — Sessão bloqueada / auth guard
   ==================================================================== */

export let __gcSessionLockActive = false;

/**
 * __gcIsAuthError
 * Devolve true se o erro indica sessão inválida / expirada.
 */
export function __gcIsAuthError(err) {
  const msg    = String((err && (err.message || err.error_description || err.error)) || "").toLowerCase();
  const status = err?.status ?? err?.statusCode ?? err?.code ?? err?.response?.status ?? null;

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

/**
 * __gcRenderSessionLockedScreen
 * Substitui o conteúdo de #appRoot pelo ecrã de sessão bloqueada.
 */
export function __gcRenderSessionLockedScreen(reasonText) {
  const reason = String(reasonText || "Sessão expirada por segurança. Volte a iniciar sessão.");
  const esc    = s => String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");

  const root = document.getElementById("appRoot") || document.body;
  root.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;
                padding:24px;background:#0b1220;color:#e7eefc;
                font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;">
      <div style="width:100%;max-width:520px;background:#111a2e;
                  border:1px solid rgba(255,255,255,.10);border-radius:14px;
                  box-shadow:0 10px 30px rgba(0,0,0,.35);padding:24px 20px;">
        <div style="font-size:18px;font-weight:800;letter-spacing:.2px;">Sessão bloqueada</div>
        <div style="margin-top:10px;font-size:14px;line-height:1.5;opacity:.95;">
          ${esc(reason)}
        </div>
        <div style="margin-top:16px;font-size:13px;line-height:1.45;opacity:.82;">
          Por segurança, a aplicação foi bloqueada para impedir alterações sem autenticação válida.
        </div>
        <div style="display:flex;gap:10px;margin-top:18px;">
          <button id="btnGoLoginNow"
            style="flex:1;border:0;background:#3b82f6;color:#fff;border-radius:12px;
                   padding:12px 14px;font-size:14px;font-weight:700;cursor:pointer;">
            Voltar ao login
          </button>
          <button id="btnReloadLocked"
            style="border:1px solid rgba(255,255,255,.18);background:transparent;color:#e7eefc;
                   border-radius:12px;padding:12px 14px;font-size:14px;cursor:pointer;">
            Recarregar
          </button>
        </div>
      </div>
    </div>`;

  const btnGo     = document.getElementById("btnGoLoginNow");
  const btnReload = document.getElementById("btnReloadLocked");
  if (btnGo)     btnGo.onclick     = () => window.location.replace("/index.html");
  if (btnReload) btnReload.onclick = () => window.location.reload();
}

/**
 * __gcForceSessionLock
 * Termina a sessão, renderiza ecrã bloqueado e redireciona após 1,5 s.
 */
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
    window.location.replace("/index.html");
    return;
  }

  setTimeout(() => window.location.replace("/index.html"), 1500);
}

/* ====================================================================
   BLOCO 10B — Logout
   ==================================================================== */

/**
 * wireLogout
 * Liga o botão #btnLogout ao logout do Supabase.
 */
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
          new Promise(resolve => setTimeout(resolve, 1200))
        ]);
      }
    } catch (e) {
      console.error("Logout falhou:", e);
    } finally {
      window.location.replace("/index.html");
    }
  });
}

/* ====================================================================
   BLOCO 11A — MFA Gate (AAL2 obrigatório para todos)
   ==================================================================== */

/**
 * ensureAAL2
 * Garante que a sessão tem nível AAL2 (TOTP verificado).
 * Se o utilizador não tiver TOTP configurado, guia-o pelo enroll.
 * @returns {Promise<true>}
 */
export async function ensureAAL2() {
  const sb = window.sb;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  }

  function renderMFAScreen({ title, subtitle, qrDataUrl, secret, uri, errorMsg }) {
    const root = document.getElementById("appRoot") || document.body;
    root.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;
                  padding:24px;background:#0b1220;color:#e7eefc;
                  font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;">
        <div style="width:100%;max-width:520px;background:#111a2e;
                    border:1px solid rgba(255,255,255,.10);border-radius:14px;
                    box-shadow:0 10px 30px rgba(0,0,0,.35);padding:20px 18px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
            <div>
              <div style="font-size:16px;font-weight:700;letter-spacing:.2px;">${esc(title || "Dupla autenticação obrigatória")}</div>
              <div style="margin-top:4px;font-size:13px;opacity:.9;line-height:1.35;">${esc(subtitle || "Introduza o código da sua app autenticadora para continuar.")}</div>
            </div>
            <button id="btnMFALogout"
              style="border:1px solid rgba(255,255,255,.18);background:transparent;color:#e7eefc;
                     border-radius:10px;padding:8px 10px;font-size:13px;cursor:pointer;">
              Sair
            </button>
          </div>

          <div style="margin-top:14px;border-top:1px solid rgba(255,255,255,.10);padding-top:14px;">
            ${qrDataUrl ? `
              <div style="display:flex;gap:14px;flex-wrap:wrap;">
                <div style="background:#fff;border-radius:12px;padding:10px;">
                  <img alt="QR TOTP" src="${qrDataUrl}" style="display:block;width:170px;height:170px;object-fit:contain;"/>
                </div>
                <div style="flex:1;min-width:240px;">
                  <div style="font-size:13px;font-weight:700;margin-bottom:6px;">Configuração TOTP</div>
                  <div style="font-size:12px;opacity:.92;line-height:1.35;">
                    1) Abra a app autenticadora (Google Authenticator / Microsoft Authenticator / Apple Passwords / 1Password).<br/>
                    2) Adicione conta por QR code.<br/>
                    3) Introduza abaixo o código de 6 dígitos.
                  </div>
                  ${secret ? `<div style="margin-top:10px;font-size:12px;opacity:.92;"><b>Secret:</b> <span style="font-family:monospace;">${esc(secret)}</span></div>` : ""}
                  ${uri    ? `<div style="margin-top:6px;font-size:12px;opacity:.92;word-break:break-all;"><b>URI:</b> <span style="font-family:monospace;">${esc(uri)}</span></div>` : ""}
                </div>
              </div>` : ""}

            <div style="margin-top:${qrDataUrl ? "14px" : "0"};">
              <label style="display:block;font-size:13px;font-weight:700;margin-bottom:6px;">Código (6 dígitos)</label>
              <input id="inpMFACode" inputmode="numeric" autocomplete="one-time-code" placeholder="123456"
                style="width:100%;padding:12px 12px;border-radius:12px;
                       border:1px solid rgba(255,255,255,.18);background:#0b1220;
                       color:#e7eefc;font-size:16px;letter-spacing:2px;"/>
              <div style="display:flex;gap:10px;margin-top:10px;">
                <button id="btnMFAVerify"
                  style="flex:1;border:0;background:#3b82f6;color:white;border-radius:12px;
                         padding:11px 12px;font-size:14px;font-weight:700;cursor:pointer;">
                  Verificar e continuar
                </button>
                <button id="btnMFARetry"
                  style="border:1px solid rgba(255,255,255,.18);background:transparent;color:#e7eefc;
                         border-radius:12px;padding:11px 12px;font-size:14px;cursor:pointer;">
                  Recarregar
                </button>
              </div>
              ${errorMsg ? `<div style="margin-top:10px;color:#ffb4b4;font-size:13px;line-height:1.35;">${esc(errorMsg)}</div>` : ""}
              <div style="margin-top:10px;font-size:12px;opacity:.85;line-height:1.35;">
                Sessão atual: <span style="font-family:monospace;">${esc(G.sessionUser?.email || "—")}</span>
              </div>
            </div>
          </div>
        </div>
      </div>`;

    document.getElementById("btnMFALogout")?.addEventListener("click", async () => {
      try { await sb.auth.signOut(); } catch {}
      window.location.replace("/index.html");
    });

    document.getElementById("btnMFARetry")?.addEventListener("click", () => window.location.reload());
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

  const totps  = Array.isArray(factors?.totp) ? factors.totp : [];
  let factor   = totps.find(f => String(f.status||"").toLowerCase() === "verified") || totps[0] || null;

  /* ----- Enroll TOTP se não existe ----- */
  if (!factor) {
    const { data: en, error: enErr } = await sb.auth.mfa.enroll({ factorType: "totp" });
    if (enErr) throw enErr;

    factor = { id: en.id, factor_type: "totp" };
    const qr     = en?.totp?.qr_code || null;
    const secret = en?.totp?.secret  || null;
    const uri    = en?.totp?.uri     || null;

    let lastErr = null;
    while (true) {
      renderMFAScreen({
        title:     "Configurar dupla autenticação (TOTP)",
        subtitle:  "Necessário configurar TOTP para continuar.",
        qrDataUrl: qr, secret, uri, errorMsg: lastErr
      });

      const code = await waitForMFACode();
      if (!/^\d{6}$/.test(code)) { lastErr = "Código inválido. Introduza 6 dígitos."; continue; }

      const { error: cavErr } = await sb.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
      if (cavErr) { lastErr = cavErr.message || "Falha ao verificar MFA. Tente novamente."; continue; }

      const aal1 = await getAAL();
      if (String(aal1.currentLevel).toLowerCase() === "aal2") return true;
      lastErr = "Verificação concluída, mas a sessão não ficou em AAL2. Recarregue a página.";
    }
  }

  /* ----- Verificar TOTP existente ----- */
  let lastErr = null;
  while (true) {
    renderMFAScreen({
      title:     "Dupla autenticação obrigatória (TOTP)",
      subtitle:  "Introduza o código da sua app autenticadora para continuar.",
      qrDataUrl: null, secret: null, uri: null, errorMsg: lastErr
    });

    const code = await waitForMFACode();
    if (!/^\d{6}$/.test(code)) { lastErr = "Código inválido. Introduza 6 dígitos."; continue; }

    const { error: cavErr } = await sb.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    if (cavErr) { lastErr = cavErr.message || "Falha ao verificar MFA. Tente novamente."; continue; }

    const aal2 = await getAAL();
    if (String(aal2.currentLevel).toLowerCase() === "aal2") return true;
    lastErr = "Verificação concluída, mas a sessão não ficou em AAL2. Recarregue a página.";
  }
}

/** Utilitário: espera que o utilizador clique em btnMFAVerify ou pressione Enter */
function waitForMFACode() {
  return new Promise(resolve => {
    const inp = document.getElementById("inpMFACode");
    const btn = document.getElementById("btnMFAVerify");
    if (inp) inp.focus();

    const submit = () => {
      const v = inp ? String(inp.value || "").replace(/\s+/g, "") : "";
      resolve(v);
    };

    if (btn) btn.onclick    = submit;
    if (inp) inp.onkeydown  = ev => { if (ev.key === "Enter") submit(); };
  });
}
