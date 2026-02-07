/* =========================================================
   Gestão Clínica V2 — app.js (ficheiro completo)
   - Requer window.sb criado no app.html
   - /app.html exige sessão; sem sessão -> /index.html
   - Header: email + role + nº clínicas + Logout
   - Agenda do dia: lista + filtro por clínica (respeita RLS)
   ========================================================= */

(function () {
  "use strict";

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

  function fmtTime(d) {
    if (!(d instanceof Date) || isNaN(d.getTime())) return "—";
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  function isoLocalDayRange() {
    // Range do "dia local" do browser (Lisboa no teu caso)
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
    return { startISO: start.toISOString(), endISO: end.toISOString(), start, end };
  }

  async function fetchMyRole(userId) {
    const { data, error } = await window.sb
      .from("clinic_members")
      .select("role, clinic_id, is_active")
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(1);

    if (error) throw error;
    if (!data || data.length === 0) return null;
    return data[0].role || null;
  }

  async function fetchVisibleClinics() {
    const { data, error } = await window.sb
      .from("clinics")
      .select("id, name, slug")
      .order("name", { ascending: true });

    if (error) throw error;
    return Array.isArray(data) ? data : [];
  }

  // ---------- Agenda (robusta a nomes de colunas) ----------
  const APPT_TIME_COL_CANDIDATES = ["start_at", "starts_at", "start_time", "start_datetime", "start"];
  const APPT_END_COL_CANDIDATES = ["end_at", "ends_at", "end_time", "end_datetime", "end"];
  const APPT_STATUS_CANDIDATES = ["status", "state"];
  const APPT_PATIENT_LABEL_CANDIDATES = ["patient_name", "patient_label", "patient_full_name", "title", "summary", "notes"];

  function pickFirstExisting(obj, candidates) {
    for (const k of candidates) {
      if (obj && Object.prototype.hasOwnProperty.call(obj, k) && obj[k] != null) return k;
    }
    return null;
  }

  async function loadAppointmentsForToday({ clinicId }) {
    // Tentamos filtrar por uma coluna de data/hora conhecida; se falhar, tentamos a próxima.
    const { startISO, endISO } = isoLocalDayRange();

    let lastErr = null;

    for (const col of APPT_TIME_COL_CANDIDATES) {
      try {
        let q = window.sb
          .from("appointments")
          .select("*")
          .gte(col, startISO)
          .lt(col, endISO)
          .order(col, { ascending: true });

        if (clinicId) q = q.eq("clinic_id", clinicId);

        const { data, error } = await q;
        if (error) throw error;

        return { data: Array.isArray(data) ? data : [], timeColUsed: col };
      } catch (e) {
        lastErr = e;
        // continua para próxima coluna
      }
    }

    throw lastErr || new Error("Não foi possível carregar appointments: nenhuma coluna de tempo reconhecida.");
  }

  // ---------- Render ----------
  function renderAppShell() {
    document.body.innerHTML = `
      <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 16px;">
        <header style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding:12px 14px; border:1px solid #e5e5e5; border-radius:12px;">
          <div style="display:flex; flex-direction:column; gap:4px; min-width: 260px;">
            <div style="font-size:14px; color:#111; font-weight:600;">Sessão ativa</div>
            <div style="font-size:12px; color:#444;"><span style="color:#666;">Email:</span> <span id="hdrEmail">—</span></div>
            <div style="font-size:12px; color:#444;"><span style="color:#666;">Role:</span> <span id="hdrRole">—</span></div>
            <div style="font-size:12px; color:#444;"><span style="color:#666;">Clínicas:</span> <span id="hdrClinicCount">0</span></div>
          </div>

          <button id="btnLogout" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; background:#fff; cursor:pointer;">
            Logout
          </button>
        </header>

        <main style="margin-top:14px;">
          <section style="padding:12px 14px; border:1px solid #eee; border-radius:12px;">
            <div style="display:flex; align-items:flex-end; justify-content:space-between; gap:12px; flex-wrap:wrap;">
              <div>
                <div style="font-size:14px; color:#111; font-weight:600;">Agenda do dia</div>
                <div style="font-size:12px; color:#666; margin-top:4px;" id="agendaSubtitle">—</div>
              </div>

              <div style="display:flex; gap:10px; align-items:flex-end; flex-wrap:wrap;">
                <div style="display:flex; flex-direction:column; gap:4px;">
                  <label for="selClinic" style="font-size:12px; color:#666;">Clínica</label>
                  <select id="selClinic" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; background:#fff; min-width: 240px;"></select>
                </div>

                <button id="btnRefreshAgenda" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; background:#fff; cursor:pointer;">
                  Atualizar
                </button>
              </div>
            </div>

            <div style="margin-top:12px;" id="agendaStatus" aria-live="polite"></div>

            <div style="margin-top:10px; border-top:1px solid #f0f0f0; padding-top:10px;">
              <ul id="agendaList" style="list-style:none; padding:0; margin:0;"></ul>
            </div>
          </section>
        </main>
      </div>
    `;
  }

  function renderClinicsSelect(clinics) {
    const sel = document.getElementById("selClinic");
    if (!sel) return;

    const opts = [];
    opts.push(`<option value="">Todas</option>`);
    for (const c of clinics) {
      const label = c.name || c.slug || c.id;
      opts.push(`<option value="${escapeHtml(c.id)}">${escapeHtml(label)}</option>`);
    }
    sel.innerHTML = opts.join("");

    // Se só há uma clínica visível (secretária/fisio típica), pré-selecionar
    if (clinics.length === 1) sel.value = clinics[0].id;
  }

  function renderAgendaSubtitle() {
    const { start, end } = isoLocalDayRange();
    const dd = String(start.getDate()).padStart(2, "0");
    const mm = String(start.getMonth() + 1).padStart(2, "0");
    const yyyy = String(start.getFullYear());
    const sub = document.getElementById("agendaSubtitle");
    if (sub) sub.textContent = `${dd}-${mm}-${yyyy} (00:00–24:00)`;
  }

  function setAgendaStatus(kind, text) {
    const el = document.getElementById("agendaStatus");
    if (!el) return;

    const color =
      kind === "loading" ? "#666" :
      kind === "error" ? "#b00020" :
      kind === "ok" ? "#111" : "#666";

    el.innerHTML = `<div style="font-size:12px; color:${color};">${escapeHtml(text)}</div>`;
  }

  function renderAgendaList({ rows, clinicsById, timeColUsed }) {
    const ul = document.getElementById("agendaList");
    if (!ul) return;

    if (!rows || rows.length === 0) {
      ul.innerHTML = `<li style="padding:10px 0; font-size:12px; color:#666;">Sem marcações para hoje.</li>`;
      return;
    }

    ul.innerHTML = rows.map((r) => {
      const timeCol = timeColUsed || pickFirstExisting(r, APPT_TIME_COL_CANDIDATES);
      const endCol = pickFirstExisting(r, APPT_END_COL_CANDIDATES);
      const statusCol = pickFirstExisting(r, APPT_STATUS_CANDIDATES);
      const patientLabelCol = pickFirstExisting(r, APPT_PATIENT_LABEL_CANDIDATES);

      const startVal = timeCol ? r[timeCol] : null;
      const endVal = endCol ? r[endCol] : null;

      const start = startVal ? new Date(startVal) : null;
      const end = endVal ? new Date(endVal) : null;

      const tStart = fmtTime(start);
      const tEnd = end ? fmtTime(end) : null;

      const status = statusCol ? (r[statusCol] ?? "—") : "—";
      const clinicId = r.clinic_id ?? null;
      const clinicName = clinicId && clinicsById[clinicId]
        ? (clinicsById[clinicId].name || clinicsById[clinicId].slug || clinicId)
        : (clinicId || "—");

      const patientLabel = patientLabelCol ? (r[patientLabelCol] ?? "—") : "—";

      const rightMeta = [
        `Clínica: ${clinicName}`,
        `Status: ${status}`
      ].join(" • ");

      return `
        <li style="padding:10px 0; border-bottom:1px solid #f2f2f2;">
          <div style="display:flex; align-items:baseline; justify-content:space-between; gap:12px; flex-wrap:wrap;">
            <div style="display:flex; gap:10px; align-items:baseline; flex-wrap:wrap;">
              <div style="font-size:14px; font-weight:600; color:#111; min-width: 80px;">
                ${escapeHtml(tStart)}${tEnd ? `–${escapeHtml(tEnd)}` : ""}
              </div>
              <div style="font-size:13px; color:#111;">
                ${escapeHtml(patientLabel)}
              </div>
            </div>
            <div style="font-size:12px; color:#666;">
              ${escapeHtml(rightMeta)}
            </div>
          </div>
        </li>
      `;
    }).join("");
  }

  async function wireLogout() {
    const btn = document.getElementById("btnLogout");
    if (!btn) return;

    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.textContent = "A terminar sessão…";
      try {
        const { error } = await window.sb.auth.signOut();
        if (error) throw error;
        hardRedirect("/index.html");
      } catch (e) {
        console.error("Logout falhou:", e);
        btn.disabled = false;
        btn.textContent = "Logout";
        alert("Não foi possível terminar a sessão. Vê a consola para detalhe.");
      }
    });
  }

  async function refreshAgenda(clinics) {
    const sel = document.getElementById("selClinic");
    const clinicId = sel ? (sel.value || null) : null;

    const clinicsById = {};
    for (const c of clinics) clinicsById[c.id] = c;

    setAgendaStatus("loading", "A carregar marcações do dia…");

    try {
      const { data, timeColUsed } = await loadAppointmentsForToday({ clinicId });
      setAgendaStatus("ok", `OK: ${data.length} marcação(ões) carregada(s).`);
      renderAgendaList({ rows: data, clinicsById, timeColUsed });
    } catch (e) {
      console.error("Agenda load falhou:", e);
      setAgendaStatus("error", "Erro ao carregar agenda. Vê a consola para detalhe.");
      const ul = document.getElementById("agendaList");
      if (ul) ul.innerHTML = `<li style="padding:10px 0; font-size:12px; color:#b00020;">Falha ao carregar.</li>`;
    }
  }

  // ---------- Boot ----------
  async function boot() {
    try {
      if (!window.sb || !window.sb.auth || typeof window.sb.auth.getSession !== "function") {
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

      // UI base
      renderAppShell();
      renderAgendaSubtitle();
      await wireLogout();

      const user = session.user;
      const email = user.email || "—";

      // Carregar role + clínicas (via RLS)
      let role = null;
      let clinics = [];

      try {
        role = await fetchMyRole(user.id);
      } catch (e) {
        console.warn("Não foi possível carregar role via clinic_members:", e);
      }

      try {
        clinics = await fetchVisibleClinics();
      } catch (e) {
        console.warn("Não foi possível carregar clínicas via clinics:", e);
      }

      // Header
      const hdrEmail = document.getElementById("hdrEmail");
      if (hdrEmail) hdrEmail.textContent = email;

      const hdrRole = document.getElementById("hdrRole");
      if (hdrRole) hdrRole.textContent = role ? role : "—";

      const hdrClinicCount = document.getElementById("hdrClinicCount");
      if (hdrClinicCount) hdrClinicCount.textContent = String(clinics.length);

      // Select clínicas
      renderClinicsSelect(clinics);

      // Eventos
      const sel = document.getElementById("selClinic");
      if (sel) {
        sel.addEventListener("change", async () => {
          await refreshAgenda(clinics);
        });
      }

      const btnRefresh = document.getElementById("btnRefreshAgenda");
      if (btnRefresh) {
        btnRefresh.addEventListener("click", async () => {
          btnRefresh.disabled = true;
          try {
            await refreshAgenda(clinics);
          } finally {
            btnRefresh.disabled = false;
          }
        });
      }

      // Carregar agenda inicial
      await refreshAgenda(clinics);
    } catch (e) {
      console.error("Boot falhou:", e);
      document.body.textContent = "Erro ao iniciar a app. Abre a consola para detalhe.";
    }
  }

  boot();
})();
