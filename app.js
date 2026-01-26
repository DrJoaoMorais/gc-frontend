// app.js — JS único (Supabase via CDN)

const SUPABASE_URL = 'https://vfrmjfveclfwxcdknlvs.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmcm1qZnZlY2xmd3hjZGtubHZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2ODM1NTQsImV4cCI6MjA4NDI1OTU1NH0.jSQMR2jar0UxrDeXpYBOvFSj8ucjPWOdaBRKKr543hc';

// Helpers
const el = (id) => document.getElementById(id);
const setText = (id, text) => {
  const node = el(id);
  if (node) node.textContent = text;
};
const setHtml = (id, html) => {
  const node = el(id);
  if (node) node.innerHTML = html;
};

// Verifica se o Supabase carregou do CDN
if (!window.supabase) {
  setHtml('authMsg', 'Erro: Supabase JS não carregou.');
  throw new Error('Supabase JS não carregou.');
}

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Prova de vida JS
setText('cfgUrl', SUPABASE_URL);
setText('cfgKey', SUPABASE_KEY.slice(0, 20) + '…');
setText('authMsg', 'JS OK');

const hasAnonKey = !SUPABASE_KEY.includes('COLOCA_AQUI');
if (!hasAnonKey) {
  setHtml(
    'authMsg',
    '<span style="color:#ff7c7c">Falta a anon key do Supabase no app.js.</span>'
  );
  el('btnLogin').disabled = true;
}

// LOGIN
async function login() {
  if (!hasAnonKey) return;

  const email = el('email').value.trim();
  const password = el('password').value;

  if (!email || !password) {
    setHtml('authMsg', '<span style="color:#ffb454">Email e password são obrigatórios.</span>');
    return;
  }

  setText('authMsg', 'A autenticar…');

  const { error } = await sb.auth.signInWithPassword({ email, password });

  if (error) {
    setHtml('authMsg', `<span style="color:#ff7c7c">${error.message}</span>`);
    return;
  }

  setHtml('authMsg', '<span style="color:#7cffb2">Login OK</span>');
  showApp();
  await loadClinics();
}

// LOGOUT
async function logout() {
  await sb.auth.signOut();
  location.reload();
}

// UI
function showApp() {
  el('authCard').style.display = 'none';
  el('appCard').style.display = 'block';
}

// CARREGAR CLÍNICAS
async function loadClinics() {
  setText('clinicsMsg', 'A carregar clínicas…');

  const { data, error } = await sb
    .from('clinics')
    .select('id, code, name')
    .order('name');

  if (error) {
    setHtml('clinicsMsg', `<span style="color:#ff7c7c">${error.message}</span>`);
    return;
  }

  setHtml('clinicsMsg', `<span style="color:#7cffb2">OK — ${data.length} clínica(s)</span>`);

  el('clinicsTable').innerHTML =
    '<table><tr><th>ID</th><th>Código</th><th>Nome</th></tr>' +
    data.map((c) => `<tr><td>${c.id}</td><td>${c.code ?? ''}</td><td>${c.name ?? ''}</td></tr>`).join('') +
    '</table>';
}

// EVENTOS
el('btnLogin').addEventListener('click', login);
el('btnLogout').addEventListener('click', logout);

// ENTER para login
['email', 'password'].forEach((fieldId) => {
  el(fieldId).addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      login();
    }
  });
});
