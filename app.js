// ============================
// GC — FRONTEND FINAL
// ============================
const BUILD = "22-01-2026 FINAL — AUTH OK";
console.log("GC build:", BUILD);

// ============================
// SUPABASE CONFIG (FINAL)
// ============================
const SUPABASE_URL = "https://vfrmjfveclfwxcdknlvs.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmcm1qZnZlY2xmd3hjZGtubHZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2ODM1NTQsImV4cCI6MjA4NDI1OTU1NH0.jSQMR2jar0UxrDeXpYBOvFSj8ucjPWOdaBRKKr543hc";

// ============================
// HELPERS
// ============================
const el = (id) => document.getElementById(id);
const setHtml = (id, html) => (el(id).innerHTML = html);

setHtml("cfgUrl", SUPABASE_URL);
setHtml("cfgKey", SUPABASE_ANON_KEY.slice(0, 20) + "…");

// ============================
// SUPABASE CLIENT
// ============================
const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// ============================
// AUTH
// ============================
async function login() {
  const email = el("email").value.trim();
  const password = el("password").value;

  setHtml("authMsg", "A autenticar…");

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    setHtml("authMsg", `<span style="color:#ff7c7c">${error.message}</span>`);
    return;
  }

  setHtml("authMsg", `<span style="color:#7cffb2">Login OK</span>`);
  showApp();
  loadClinics();
}

async function logout() {
  await supabase.auth.signOut();
  location.reload();
}

function showApp() {
  el("authCard").style.display = "none";
  el("appCard").style.display = "block";
}

// ============================
// TESTE RLS — CLÍNICAS
// ============================
async function loadClinics() {
  setHtml("clinicsMsg", "A carregar clínicas…");

  const { data, error } = await supabase
    .from("clinics")
    .select("id, code, name")
    .order("name");

  if (error) {
    setHtml(
      "clinicsMsg",
      `<span style="color:#ff7c7c">${error.message}</span>`
    );
    return;
  }

  setHtml(
    "clinicsMsg",
    `<span style="color:#7cffb2">OK — ${data.length} clínica(s)</span>`
  );

  el("clinicsTable").innerHTML =
    "<table><tr><th>ID</th><th>Código</th><th>Nome</th></tr>" +
    data
      .map(
        (c) =>
          `<tr><td>${c.id}</td><td>${c.code}</td><td>${c.name}</td></tr>`
      )
      .join("") +
    "</table>";
}

// ============================
// EVENTS
// ============================
el("btnLogin").onclick = login;
el("btnLogout").onclick = logout;