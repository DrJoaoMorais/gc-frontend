// app.js — PASSO 2 (JS limpo, sem duplicar "supabase")

const SUPABASE_URL = 'https://vfrmjfveclfwxcdknlvs.supabase.co';
const SUPABASE_KEY = 'COLOCA_AQUI_A_ANON_KEY_ATUAL_DO_SUPABASE';

// O objeto "supabase" já vem do CDN (@supabase/supabase-js@2)
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Prova de vida JS
document.getElementById('cfgUrl').textContent = SUPABASE_URL;
document.getElementById('cfgKey').textContent = SUPABASE_KEY.slice(0, 20) + '…';
document.getElementById('authMsg').textContent = 'JS OK';

// Teste de evento
document.getElementById('btnLogin').addEventListener('click', () => {
  document.getElementById('authMsg').textContent = 'Clique OK (handler ativo)';
});
