// app.js — frontend funcional com login Supabase + criar doente

const SUPABASE_URL = 'https://vfrmjfveclfwxcdknlvs.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmcm1qZnZlY2xmd3hjZGtubHZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2ODM1NTQsImV4cCI6MjA4NDI1OTU1NH0.jSQMR2jar0UxrDeXpYBOvFSj8ucjPWOdaBRKKr543hc';

const el = (id) => document.getElementById(id);
const setText = (id, text) => el(id).textContent = text;
const setHtml = (id, html) => el(id).innerHTML = html;

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// estado
let selectedClinicId = null;
let selectedClinicName = null;

// LOGIN
async function login() {
  const email = el('email').value.trim();
  const password = el('password').value;

  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return alert(error.message);

  el('authCard').style.display = 'none';
  el('appCard').style.display = 'block';

  await loadClinics();
}

// LOGOUT
async function logout() {
  await sb.auth.signOut();
  location.reload();
}

// CLÍNICAS
async function loadClinics() {
  const { data, error } = await sb
    .from('clinics')
    .select('id, name')
    .order('name');

  if (error) return alert(error.message);

  el('clinicsTable').innerHTML =
    '<ul>' +
    data.map(c =>
      `<li style="cursor:pointer;padding:4px"
          onclick="selectClinic('${c.id}','${c.name.replace(/'/g, '')}')">
          ${c.name}
       </li>`
    ).join('') +
    '</ul>';
}

async function selectClinic(id, name) {
  selectedClinicId = id;
  selectedClinicName = name;

  setHtml('patientsBox', `
    <h3>Doentes — ${name}</h3>
    <button onclick="addPatient()">Adicionar doente</button>
    <div id="patientsList">A carregar…</div>
  `);

  await loadPatients();
}

// LISTAR DOENTES
async function loadPatients() {
  const { data, error } = await sb
    .from('patients')
    .select('id, full_name')
    .order('full_name');

  if (error) {
    el('patientsList').textContent = error.message;
    return;
  }

  el('patientsList').innerHTML =
    data.length === 0
      ? 'Sem doentes.'
      : '<ul>' + data.map(p => `<li>${p.full_name}</li>`).join('') + '</ul>';
}

// CRIAR DOENTE
async function addPatient() {
  if (!selectedClinicId) {
    alert('Seleciona primeiro uma clínica.');
    return;
  }

  const fullName = prompt('Nome completo do doente:');
  if (!fullName) return;

  const birthDate = prompt('Data de nascimento (AAAA-MM-DD) ou deixar vazio:') || null;

  const { error } = await sb.rpc('create_patient_for_clinic', {
    p_full_name: fullName,
    p_clinic_id: selectedClinicId,
    p_birth_date: birthDate
  });

  if (error) {
    alert(error.message);
    return;
  }

  await loadPatients();
}

// eventos
el('btnLogin').onclick = login;
el('btnLogout').onclick = logout;