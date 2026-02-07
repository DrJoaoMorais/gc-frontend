// login.js — LOGIN apenas (index.html) → redireciona para /app.html

const SUPABASE_URL = "https://vfrmjfveclfwxcdknlvs.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54Zm56emN1cXp4bXpzaWhicnRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyODg3MjEsImV4cCI6MjA4NTg2NDcyMX0.Vk3-Aiq13fNMQWDyicHWErERWB5JBC9wZQ7OnVLmCnA";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const el = (id) => document.getElementById(id);

function setAuthMsg(msg, kind = "info") {
  const box = el("authMsg");
  if (!box) return;

  box.textContent = msg || "";
  if (!msg) {
    box.style.padding = "0";
    return;
  }
  box.style.padding = "8px 10px";
  box.style.borderRadius = "8px";

  if (kind === "error") {
    box.style.color = "#ffd0d0";
    box.style.background = "rgba(255, 80, 80, 0.12)";
    box.style.border = "1px solid rgba(255, 80, 80, 0.25)";
    return;
  }
  if (kind === "success") {
    box.style.color = "#d6ffe0";
    box.style.background = "rgba(30, 200, 90, 0.12)";
    box.style.border = "1px solid rgba(30, 200, 90, 0.25)";
    return;
  }

  box.style.color = "#b8d4ff";
  box.style.background = "rgba(59, 130, 246, 0.10)";
  box.style.border = "1px solid rgba(59, 130, 246, 0.18)";
}

function setBusy(isBusy) {
  const btn = el("btnLogin");
  const email = el("email");
  const pass = el("password");

  if (btn) {
    btn.disabled = !!isBusy;
    btn.style.opacity = isBusy ? "0.7" : "1";
    btn.style.cursor = isBusy ? "not-allowed" : "pointer";
    btn.textContent = isBusy ? "A autenticar…" : "Entrar";
  }
  if (email) email.disabled = !!isBusy;
  if (pass) pass.disabled = !!isBusy;
}

function normalizeEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function mapAuthError(err) {
  const msg = String(err?.message || err || "");
  const status = err?.status;

  if (status === 400 || /invalid login credentials/i.test(msg)) {
    return "Credenciais inválidas (email ou password incorretos).";
  }
  if (status === 429 || /rate limit|too many requests/i.test(msg)) {
    return "Demasiadas tentativas. Aguarde 1–2 minutos e tente novamente.";
  }
  if (/network|failed to fetch|fetch/i.test(msg)) {
    return "Sem ligação à internet. Verifique a ligação e tente novamente.";
  }
  return "Erro ao autenticar: " + msg;
}

function goApp() {
  window.location.replace("/app.html");
}

async function init() {
  try {
    setAuthMsg("");

    const { data, error } = await sb.auth.getSession();
    if (error) {
      setAuthMsg("Erro ao verificar sessão: " + String(error.message || error), "error");
      return;
    }
    if (data?.session) {
      goApp();
      return;
    }

    sb.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        goApp();
      }
    });
  } catch (e) {
    setAuthMsg("Erro inesperado no init: " + String(e?.message || e), "error");
  }
}

async function login() {
  if (el("btnLogin")?.disabled) return;

  try {
    const email = normalizeEmail(el("email")?.value);
    const password = el("password")?.value || "";

    if (!email || !password) {
      setAuthMsg("Preenche email e password.", "error");
      return;
    }

    setBusy(true);
    setAuthMsg("A autenticar…", "info");

    const { error } = await sb.auth.signInWithPassword({ email, password });

    if (error) {
      setAuthMsg(mapAuthError(error), "error");
      setBusy(false);
      return;
    }

    setAuthMsg("Login efetuado. A abrir aplicação…", "success");
    goApp();
  } catch (e) {
    setAuthMsg("Erro inesperado: " + String(e?.message || e), "error");
    setBusy(false);
  }
}

// Eventos
if (el("btnLogin")) el("btnLogin").onclick = login;

if (el("email"))
  el("email").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      login();
    }
  });

if (el("password"))
  el("password").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      login();
    }
  });

init();