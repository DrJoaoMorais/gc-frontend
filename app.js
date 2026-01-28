// app.js — LOGIN apenas (index.html) → redireciona para /app.html

const SUPABASE_URL = "https://vfrmjfveclfwxcdknlvs.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmcm1qZnZlY2xmd3hjZGtubHZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2ODM1NTQsImV4cCI6MjA4NDI1OTU1NH0.jSQMR2jar0UxrDeXpYBOvFSj8ucjPWOdaBRKKr543hc";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const el = (id) => document.getElementById(id);

function setAuthMsg(msg, isError = false) {
  const box = el("authMsg");
  if (!box) return;
  box.textContent = msg || "";
  box.style.color = isError ? "#ffb4b4" : "#b8d4ff";
}

// Mostrar config no cartão (opcional)
(function fillConfig() {
  if (el("cfgUrl")) el("cfgUrl").textContent = SUPABASE_URL;
  if (el("cfgKey")) el("cfgKey").textContent = SUPABASE_KEY.slice(0, 12) + "…";
})();

async function goApp() {
  // Redireciona SEMPRE para a app real
  window.location.href = "/app.html";
}

async function init() {
  // Se já houver sessão, não mostrar o ecrã azul de login — vai direto para a app
  const { data, error } = await sb.auth.getSession();
  if (error) {
    setAuthMsg("Erro ao verificar sessão: " + error.message, true);
    return;
  }
  if (data?.session) {
    await goApp();
  }
}

async function login() {
  try {
    const email = (el("email")?.value || "").trim();
    const password = el("password")?.value || "";

    if (!email || !password) {
      setAuthMsg("Preenche email e password.", true);
      return;
    }

    setAuthMsg("A autenticar…");

    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthMsg(error.message, true);
      return;
    }

    await goApp();
  } catch (e) {
    setAuthMsg(String(e?.message || e), true);
  }
}

// Eventos
if (el("btnLogin")) el("btnLogin").onclick = login;

// Enter para submeter
if (el("email")) el("email").addEventListener("keydown", (e) => { if (e.key === "Enter") login(); });
if (el("password")) el("password").addEventListener("keydown", (e) => { if (e.key === "Enter") login(); });

init();
