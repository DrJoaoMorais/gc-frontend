import { getPushStatus, enablePushNotifications } from "./push-notifications.js";

const BELL_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>`;

function ensureModalStyles() {
  if (document.getElementById("gcPushUiStyles")) return;
  const style = document.createElement("style");
  style.id = "gcPushUiStyles";
  style.textContent = `
    .gc-push-overlay{position:fixed;inset:0;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;padding:20px;z-index:2500}
    .gc-push-card{width:min(440px,100%);background:#fff;border:1px solid #e2e8f0;border-radius:16px;box-shadow:0 20px 50px rgba(15,23,42,.18);padding:22px}
    .gc-push-title{font-size:18px;font-weight:750;color:#0f2d52;margin:0 0 6px}
    .gc-push-text{font-size:13px;line-height:1.5;color:#64748b;margin:0}
    .gc-push-status{margin-top:14px;padding:10px 12px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;font-size:13px;color:#334155}
    .gc-push-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}
    .gc-push-btn{border:1px solid #cbd5e1;background:#fff;color:#0f2d52;border-radius:9px;padding:9px 13px;font:600 13px/1.2 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;cursor:pointer}
    .gc-push-btn-primary{border-color:#1a56db;background:#1a56db;color:#fff}
    .gc-push-btn:disabled{opacity:.55;cursor:not-allowed}
  `;
  document.head.appendChild(style);
}

function statusText(status) {
  if (!status?.supported) return "Este browser/dispositivo não suporta Web Push.";
  if (status.permission === "denied") return "Notificações bloqueadas nas definições deste browser/dispositivo.";
  if (status.subscribed) return "Notificações ativas neste dispositivo.";
  if (status.permission === "granted") return "Permissão concedida; falta concluir a subscrição deste dispositivo.";
  return "Notificações ainda não ativadas neste dispositivo.";
}

async function openPushModal() {
  ensureModalStyles();

  const overlay = document.createElement("div");
  overlay.className = "gc-push-overlay";
  overlay.innerHTML = `
    <div class="gc-push-card" role="dialog" aria-modal="true" aria-labelledby="gcPushTitle">
      <h2 class="gc-push-title" id="gcPushTitle">Notificações neste dispositivo</h2>
      <p class="gc-push-text">Ative para receber alertas do Gestão Clínica neste browser/dispositivo. O estado dos alertas continua centralizado no GC.</p>
      <div class="gc-push-status" id="gcPushStatus">A verificar…</div>
      <div class="gc-push-actions">
        <button class="gc-push-btn" id="gcPushClose" type="button">Fechar</button>
        <button class="gc-push-btn gc-push-btn-primary" id="gcPushEnable" type="button">Ativar notificações</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  const closeBtn = overlay.querySelector("#gcPushClose");
  const enableBtn = overlay.querySelector("#gcPushEnable");
  const statusEl = overlay.querySelector("#gcPushStatus");

  const close = () => overlay.remove();
  closeBtn?.addEventListener("click", close);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });

  let status;
  try {
    status = await getPushStatus();
    statusEl.textContent = statusText(status);
    if (!status.supported || status.permission === "denied" || status.subscribed) {
      enableBtn.disabled = true;
      if (status.subscribed) enableBtn.textContent = "Ativas";
    }
  } catch (error) {
    console.error("[Push UI] erro ao obter estado:", error);
    statusEl.textContent = "Não foi possível verificar o estado das notificações.";
  }

  enableBtn?.addEventListener("click", async () => {
    enableBtn.disabled = true;
    const original = enableBtn.textContent;
    enableBtn.textContent = "A ativar…";
    statusEl.textContent = "A aguardar autorização do dispositivo…";

    try {
      await enablePushNotifications();
      const next = await getPushStatus();
      statusEl.textContent = statusText(next);
      enableBtn.textContent = "Ativas";
    } catch (error) {
      console.error("[Push UI] falha ao ativar:", error);
      statusEl.textContent = error?.message || "Não foi possível ativar as notificações.";
      enableBtn.disabled = false;
      enableBtn.textContent = original;
    }
  });
}

function injectButton() {
  const bottom = document.querySelector(".gc-sidebar-bottom");
  if (!bottom || document.getElementById("btnPushNotifications")) return;

  const button = document.createElement("button");
  button.className = "gc-nav-btn";
  button.id = "btnPushNotifications";
  button.type = "button";
  button.title = "Notificações";
  button.innerHTML = BELL_ICON;
  button.addEventListener("click", openPushModal);

  bottom.insertBefore(button, bottom.firstChild);
}

function start() {
  injectButton();
  const observer = new MutationObserver(injectButton);
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}
