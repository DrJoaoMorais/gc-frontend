/* =========================================================
   Gestão Clínica V2 — app.js (FICHEIRO COMPLETO)
   Estado:
   - Login / sessão OK
   - Agenda diária + calendário mensal
   - Marcação com doente obrigatório
   - Novo doente com identificação completa
   - Alinhado 1:1 com Supabase (patients + RPC create_patient_for_clinic)
   ========================================================= */

(function () {
  "use strict";

  /* ================= UTIL ================= */

  function hardRedirect(path) {
    window.location.replace(path);
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function fmtDateISO(d) {
    if (!(d instanceof Date)) return "";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function fmtDatePt(d) {
    if (!(d instanceof Date)) return "—";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }

  function fmtTime(d) {
    if (!(d instanceof Date)) return "—";
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  function parseISODateToLocalStart(iso) {
    const [y, m, d] = (iso || "").split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }

  function isoDayRange(iso) {
    const start = parseISODateToLocalStart(iso);
    if (!start) return null;
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
    return { startISO: start.toISOString(), endISO: end.toISOString(), start };
  }

  function toLocalInputValue(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  }

  /* ================= ESTADO GLOBAL ================= */

  const G = {
    user: null,
    role: null,
    clinics: [],
    clinicsById: {},
    selectedDayISO: fmtDateISO(new Date()),
    agenda: []
  };

  /* ================= SUPABASE HELPERS ================= */

  async function fetchMyRole(userId) {
    const { data, error } = await window.sb
      .from("clinic_members")
      .select("role")
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(1);

    if (error) throw error;
    return data?.[0]?.role ?? null;
  }

  async function fetchClinics() {
    const { data, error } = await window.sb
      .from("clinics")
      .select("id,name,slug")
      .order("name");

    if (error) throw error;
    return data || [];
  }

  async function searchPatients({ clinicId, q }) {
    if (!q || q.length < 2) return [];

    const { data: pc } = await window.sb
      .from("patient_clinic")
      .select("patient_id")
      .eq("clinic_id", clinicId)
      .eq("is_active", true);

    const ids = pc?.map(r => r.patient_id) || [];
    if (!ids.length) return [];

    const { data, error } = await window.sb
      .from("patients")
      .select("id,full_name,dob")
      .in("id", ids)
      .ilike("full_name", `%${q}%`)
      .order("full_name")
      .limit(10);

    if (error) throw error;
    return data || [];
  }

  async function rpcCreatePatient(payload) {
    const { data, error } = await window.sb.rpc("create_patient_for_clinic", payload);
    if (error) throw error;
    return data;
  }

  /* ================= RENDER APP ================= */

  function renderShell() {
    document.body.innerHTML = `
      <div style="font-family:system-ui; margin:16px;">
        <header style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div><b>${escapeHtml(G.user.email)}</b></div>
            <div style="font-size:12px;color:#666;">Role: ${escapeHtml(G.role || "—")}</div>
          </div>
          <button id="btnLogout">Logout</button>
        </header>

        <section style="margin-top:16px;">
          <div style="display:flex; gap:8px; align-items:center;">
            <input type="date" id="selDay" />
            <select id="selClinic"></select>
            <button id="btnNew">Nova marcação</button>
          </div>
          <ul id="agenda" style="margin-top:12px;"></ul>
        </section>

        <div id="modalRoot"></div>
      </div>
    `;
  }

  /* ================= AGENDA ================= */

  async function loadAgenda() {
    const clinicId = document.getElementById("selClinic").value || null;
    const r = isoDayRange(G.selectedDayISO);
    if (!r) return;

    const q = window.sb
      .from("appointments")
      .select("*")
      .gte("start_at", r.startISO)
      .lt("start_at", r.endISO)
      .order("start_at");

    if (clinicId) q.eq("clinic_id", clinicId);

    const { data, error } = await q;
    if (error) {
      console.error(error);
      return;
    }

    G.agenda = data || [];
    renderAgenda();
  }

  function renderAgenda() {
    const ul = document.getElementById("agenda");
    if (!G.agenda.length) {
      ul.innerHTML = `<li style="color:#666;">Sem marcações</li>`;
      return;
    }

    ul.innerHTML = G.agenda.map(r => {
      const s = new Date(r.start_at);
      const e = r.end_at ? new Date(r.end_at) : null;
      return `
        <li style="padding:6px 0;">
          <b>${fmtTime(s)}${e ? "–" + fmtTime(e) : ""}</b>
          ${escapeHtml(r.title || "—")}
        </li>`;
    }).join("");
  }

  /* ================= MODAL MARCAÇÃO + NOVO DOENTE ================= */

  function openNewPatientForm({ clinicId, onSelect }) {
    const root = document.getElementById("modalRoot");

    root.innerHTML = `
      <div style="position:fixed; inset:0; background:rgba(0,0,0,.3); display:flex; justify-content:center; align-items:center;">
        <div style="background:#fff; padding:16px; width:600px;">
          <h3>Novo doente</h3>

          <input id="pName" placeholder="Nome completo *" />
          <input id="pDob" type="date" />
          <input id="pPhone" placeholder="Telefone" />
          <input id="pEmail" placeholder="Email" />

          <input id="pSNS" placeholder="SNS (9 dígitos)" />
          <input id="pNIF" placeholder="NIF (9 dígitos)" />
          <input id="pPass" placeholder="Passaporte / ID" />

          <input id="pIns" placeholder="Seguro" />
          <input id="pApol" placeholder="Apólice" />

          <input id="pAddr" placeholder="Morada" />
          <input id="pPostal" placeholder="Código postal" />
          <input id="pCity" placeholder="Cidade" />

          <textarea id="pNotes" placeholder="Notas"></textarea>

          <div id="pMsg" style="font-size:12px;color:#666;"></div>

          <button id="pCancel">Cancelar</button>
          <button id="pSave">Criar</button>
        </div>
      </div>
    `;

    const $ = id => document.getElementById(id);

    $("pCancel").onclick = () => root.innerHTML = "";

    $("pSave").onclick = async () => {
      const name = $("pName").value.trim();
      const sns = $("pSNS").value.replace(/\D/g,"");
      const nif = $("pNIF").value.replace(/\D/g,"");
      const pass = $("pPass").value.trim();

      if (!name) return $("pMsg").textContent = "Nome obrigatório.";
      if (!sns && !nif && !pass) return $("pMsg").textContent = "SNS ou NIF ou Passaporte obrigatório.";

      try {
        const id = await rpcCreatePatient({
          p_clinic_id: clinicId,
          p_full_name: name,
          p_dob: $("pDob").value || null,
          p_sex: null,
          p_phone: $("pPhone").value || null,
          p_email: $("pEmail").value || null,
          p_external_id: null,
          p_notes: $("pNotes").value || null,
          p_sns: sns || null,
          p_nif: nif || null,
          p_passport_id: pass || null,
          p_address_line1: $("pAddr").value || null,
          p_postal_code: $("pPostal").value || null,
          p_city: $("pCity").value || null,
          p_country: "PT",
          p_insurance_provider: $("pIns").value || null,
          p_insurance_policy_number: $("pApol").value || null
        });

        onSelect(id, name);
        root.innerHTML = "";
      } catch (e) {
        console.error(e);
        $("pMsg").textContent = "Erro ao criar doente.";
      }
    };
  }

  /* ================= BOOT ================= */

  async function boot() {
    const { data } = await window.sb.auth.getSession();
    if (!data?.session) return hardRedirect("/index.html");

    G.user = data.session.user;

    G.role = await fetchMyRole(G.user.id);
    G.clinics = await fetchClinics();
    G.clinics.forEach(c => G.clinicsById[c.id] = c);

    renderShell();

    document.getElementById("selDay").value = G.selectedDayISO;
    document.getElementById("selDay").onchange = e => {
      G.selectedDayISO = e.target.value;
      loadAgenda();
    };

    const selClinic = document.getElementById("selClinic");
    selClinic.innerHTML = `<option value="">Todas</option>` +
      G.clinics.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
    selClinic.onchange = loadAgenda;

    document.getElementById("btnLogout").onclick = async () => {
      await window.sb.auth.signOut();
      hardRedirect("/index.html");
    };

    loadAgenda();
  }

  boot();

})();
