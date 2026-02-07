/* =========================================================
   Gestão Clínica V2 — app.js (ficheiro completo)
   - Requer window.sb criado no app.html
   - /app.html exige sessão; sem sessão -> /index.html
   - Header: email + role + nº clínicas + Logout
   - Agenda do dia: lista + filtro por clínica (RLS)
   - Modal: Criar/Editar marcação (tipo + duração + status)
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

  function fmtDate(d) {
    if (!(d instanceof Date) || isNaN(d.getTime())) return "—";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = String(d.getFullYear());
    return `${dd}-${mm}-${yyyy}`;
  }

  function toLocalInputValue(dateObj) {
    // "YYYY-MM-DDTHH:MM" em hora local
    const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  }

  function fromLocalInputValue(v) {
    // interpreta como local
    const d = new Date(v);
    return d;
  }

  function isoLocalDayRange() {
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

  function pickFirstExisting(obj, candidates) {
    for (const k of candidates) {
      if (obj && Object.prototype.hasOwnProperty.call(obj, k) && obj[k] != null) return k;
    }
    return null;
  }

  async function loadAppointmentsForToday({ clinicId }) {
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
      }
    }

    throw lastErr || new Error("Não foi possível carregar appointments: nenhuma coluna de tempo reconhecida.");
  }

  // ---------- Tipos / Status ----------
  const PROCEDURE_OPTIONS = [
    "Primeira Consulta",
    "Consulta de Reavaliação",
    "Plasma Rico em Plaquetas",
    "Viscossuplementação",
    "Relatórios",
    "Revalidação de tratamentos",
    "Outro"
  ];

  const STATUS_OPTIONS = [
    "scheduled",
    "confirmed",
    "arrived",
    "done",
    "cancelled",
    "no_show"
  ];

  const DURATION_OPTIONS = [15, 20, 30, 45, 60];

  // ---------- Estado global mínimo ----------
  let G = {
    sessionUser: null,
    role: null,
    clinics: [],
    clinicsById: {},
    agenda: { rows: [], timeColUsed: "start_at" }
  };

  // ---------- Render base ----------
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

                <button id="btnNewAppt" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; background:#fff; cursor:pointer;">
                  Nova marcação
                </button>

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

        <div id="modalRoot"></div>
      </div>
    `;
  }

  function renderAgendaSubtitle() {
    const { start } = isoLocalDayRange();
    const sub = document.getElementById("agendaSubtitle");
    if (sub) sub.textContent = `${fmtDate(start)} (00:00–24:00)`;
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

    if (clinics.length === 1) sel.value = clinics[0].id;
  }

  function renderAgendaList() {
    const ul = document.getElementById("agendaList");
    if (!ul) return;

    const rows = G.agenda.rows || [];
    const timeColUsed = G.agenda.timeColUsed || "start_at";

    if (rows.length === 0) {
      ul.innerHTML = `<li style="padding:10px 0; font-size:12px; color:#666;">Sem marcações para hoje.</li>`;
      return;
    }

    ul.innerHTML = rows.map((r) => {
      const startVal = r[timeColUsed] ?? r[pickFirstExisting(r, APPT_TIME_COL_CANDIDATES)];
      const endVal = r[pickFirstExisting(r, APPT_END_COL_CANDIDATES)];

      const start = startVal ? new Date(startVal) : null;
      const end = endVal ? new Date(endVal) : null;

      const tStart = fmtTime(start);
      const tEnd = end ? fmtTime(end) : null;

      const clinicId = r.clinic_id ?? null;
      const clinicName = clinicId && G.clinicsById[clinicId]
        ? (G.clinicsById[clinicId].name || G.clinicsById[clinicId].slug || clinicId)
        : (clinicId || "—");

      const status = r.status ?? "—";
      const proc = r.procedure_type ?? "—";
      const title = r.title ?? "—";

      return `
        <li data-appt-id="${escapeHtml(r.id)}" style="padding:10px 0; border-bottom:1px solid #f2f2f2; cursor:pointer;">
          <div style="display:flex; align-items:baseline; justify-content:space-between; gap:12px; flex-wrap:wrap;">
            <div style="display:flex; gap:10px; align-items:baseline; flex-wrap:wrap;">
              <div style="font-size:14px; font-weight:600; color:#111; min-width: 90px;">
                ${escapeHtml(tStart)}${tEnd ? `–${escapeHtml(tEnd)}` : ""}
              </div>
              <div style="font-size:13px; color:#111;">
                ${escapeHtml(title)}
              </div>
              <div style="font-size:12px; color:#666;">
                ${escapeHtml(proc)}
              </div>
            </div>
            <div style="font-size:12px; color:#666;">
              ${escapeHtml(clinicName)} • ${escapeHtml(status)}
            </div>
          </div>
        </li>
      `;
    }).join("");

    // click -> editar
    ul.querySelectorAll("li[data-appt-id]").forEach((li) => {
      li.addEventListener("click", () => {
        const id = li.getAttribute("data-appt-id");
        const row = rows.find((x) => x.id === id);
        if (row) openApptModal({ mode: "edit", row });
      });
    });
  }

  // ---------- Modal ----------
  function closeModal() {
    const root = document.getElementById("modalRoot");
    if (root) root.innerHTML = "";
  }

  function openApptModal({ mode, row }) {
    const root = document.getElementById("modalRoot");
    if (!root) return;

    const isEdit = mode === "edit";
    const selClinic = document.getElementById("selClinic");
    const defaultClinicId =
      (isEdit && row && row.clinic_id) ? row.clinic_id :
      (selClinic && selClinic.value ? selClinic.value : (G.clinics.length === 1 ? G.clinics[0].id : ""));

    // default start: agora arredondado a 5 min
    const now = new Date();
    now.setSeconds(0, 0);
    const rounded = new Date(now.getTime());
    rounded.setMinutes(Math.ceil(rounded.getMinutes() / 5) * 5);

    const startInit = isEdit && row && row.start_at ? new Date(row.start_at) : rounded;
    const endInit = isEdit && row && row.end_at ? new Date(row.end_at) : new Date(startInit.getTime() + 20 * 60000);

    const durInit = Math.max(5, Math.round((endInit.getTime() - startInit.getTime()) / 60000));
    const durationBest = DURATION_OPTIONS.includes(durInit) ? durInit : 20;

    const procInit = isEdit ? (row.procedure_type ?? "") : "";
    const statusInit = isEdit ? (row.status ?? "scheduled") : "scheduled";
    const titleInit = isEdit ? (row.title ?? "") : "";
    const notesInit = isEdit ? (row.notes ?? "") : "";

    const procIsOther = procInit && !PROCEDURE_OPTIONS.includes(procInit) ? true : (procInit === "Outro");
    const procSelectValue = procIsOther ? "Outro" : (procInit || "");

    root.innerHTML = `
      <div id="modalOverlay" style="position:fixed; inset:0; background:rgba(0,0,0,0.35); display:flex; align-items:center; justify-content:center; padding:18px;">
        <div style="background:#fff; width:min(720px, 100%); border-radius:14px; border:1px solid #e5e5e5; padding:14px;">
          <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start;">
            <div>
              <div style="font-size:14px; font-weight:700; color:#111;">
                ${isEdit ? "Editar marcação" : "Nova marcação"}
              </div>
              <div style="font-size:12px; color:#666; margin-top:4px;">
                Duração define automaticamente o fim (end_at).
              </div>
            </div>
            <button id="btnCloseModal" style="padding:8px 10px; border-radius:10px; border:1px solid #ddd; background:#fff; cursor:pointer;">Fechar</button>
          </div>

          <div style="margin-top:12px; display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:12px; color:#666;">Clínica</label>
              <select id="mClinic" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; background:#fff;"></select>
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:12px; color:#666;">Status</label>
              <select id="mStatus" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; background:#fff;">
                ${STATUS_OPTIONS.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("")}
              </select>
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:12px; color:#666;">Início</label>
              <input id="mStart" type="datetime-local" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd;" />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:12px; color:#666;">Duração (min)</label>
              <select id="mDuration" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; background:#fff;">
                ${DURATION_OPTIONS.map(n => `<option value="${n}">${n}</option>`).join("")}
              </select>
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:12px; color:#666;">Tipo de consulta</label>
              <select id="mProc" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; background:#fff;">
                <option value="">—</option>
                ${PROCEDURE_OPTIONS.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("")}
              </select>
            </div>

            <div id="mProcOtherWrap" style="display:none; flex-direction:column; gap:4px;">
              <label style="font-size:12px; color:#666;">Outro (texto)</label>
              <input id="mProcOther" type="text" placeholder="ex.: Ondas de choque" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd;" />
            </div>

            <div style="grid-column: 1 / -1; display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:12px; color:#666;">Título</label>
              <input id="mTitle" type="text" placeholder="ex.: João Silva — Joelho D" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd;" />
            </div>

            <div style="grid-column: 1 / -1; display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:12px; color:#666;">Notas</label>
              <textarea id="mNotes" rows="3" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; resize:vertical;"></textarea>
            </div>
          </div>

          <div style="margin-top:12px; display:flex; justify-content:space-between; gap:12px; align-items:center; flex-wrap:wrap;">
            <div id="mMsg" style="font-size:12px; color:#666;"></div>
            <div style="display:flex; gap:10px;">
              <button id="btnCancel" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; background:#fff; cursor:pointer;">Cancelar</button>
              <button id="btnSave" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; background:#fff; cursor:pointer; font-weight:600;">
                ${isEdit ? "Guardar alterações" : "Criar marcação"}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    const overlay = document.getElementById("modalOverlay");
    const btnClose = document.getElementById("btnCloseModal");
    const btnCancel = document.getElementById("btnCancel");
    const btnSave = document.getElementById("btnSave");

    const mClinic = document.getElementById("mClinic");
    const mStatus = document.getElementById("mStatus");
    const mStart = document.getElementById("mStart");
    const mDuration = document.getElementById("mDuration");
    const mProc = document.getElementById("mProc");
    const mProcOtherWrap = document.getElementById("mProcOtherWrap");
    const mProcOther = document.getElementById("mProcOther");
    const mTitle = document.getElementById("mTitle");
    const mNotes = document.getElementById("mNotes");
    const mMsg = document.getElementById("mMsg");

    // preencher clínicas
    const clinicOpts = [];
    if (G.clinics.length === 0) clinicOpts.push(`<option value="">—</option>`);
    for (const c of G.clinics) {
      const label = c.name || c.slug || c.id;
      clinicOpts.push(`<option value="${escapeHtml(c.id)}">${escapeHtml(label)}</option>`);
    }
    if (mClinic) {
      mClinic.innerHTML = clinicOpts.join("");
      if (defaultClinicId) mClinic.value = defaultClinicId;
      if (G.clinics.length === 1) mClinic.disabled = true;
    }

    if (mStatus) mStatus.value = statusInit;
    if (mStart) mStart.value = toLocalInputValue(startInit);
    if (mDuration) mDuration.value = String(durationBest);
    if (mProc) mProc.value = procSelectValue;
    if (mTitle) mTitle.value = titleInit;
    if (mNotes) mNotes.value = notesInit;

    function updateProcOtherVisibility() {
      const v = mProc ? mProc.value : "";
      const show = (v === "Outro");
      if (mProcOtherWrap) {
        mProcOtherWrap.style.display = show ? "flex" : "none";
      }
      if (!show && mProcOther) mProcOther.value = "";
    }

    // prefill outro se necessário
    updateProcOtherVisibility();
    if (procIsOther && mProcOther) {
      mProcOther.value = procInit === "Outro" ? "" : procInit;
      if (mProcOtherWrap) mProcOtherWrap.style.display = "flex";
    }

    function calcEndAtISO() {
      const s = mStart ? fromLocalInputValue(mStart.value) : null;
      const dur = mDuration ? parseInt(mDuration.value, 10) : 20;
      if (!s || isNaN(s.getTime())) return null;
      const e = new Date(s.getTime() + dur * 60000);
      return { startAt: s.toISOString(), endAt: e.toISOString() };
    }

    async function onSave() {
      if (!mClinic || !mClinic.value) {
        mMsg.textContent = "Seleciona a clínica.";
        return;
      }
      if (!mStart || !mStart.value) {
        mMsg.textContent = "Define o início.";
        return;
      }

      const times = calcEndAtISO();
      if (!times) {
        mMsg.textContent = "Data/hora inválida.";
        return;
      }

      // procedure_type
      let proc = (mProc && mProc.value) ? mProc.value : null;
      if (proc === "Outro") {
        const other = (mProcOther && mProcOther.value) ? mProcOther.value.trim() : "";
        proc = other ? other : "Outro";
      }

      const payload = {
        clinic_id: mClinic.value,
        start_at: times.startAt,
        end_at: times.endAt,
        status: (mStatus && mStatus.value) ? mStatus.value : "scheduled",
        procedure_type: proc,
        title: (mTitle && mTitle.value) ? mTitle.value.trim() : null,
        notes: (mNotes && mNotes.value) ? mNotes.value.trim() : null
      };

      // limpeza
      if (payload.title === "") payload.title = null;
      if (payload.notes === "") payload.notes = null;

      btnSave.disabled = true;
      mMsg.style.color = "#666";
      mMsg.textContent = "A guardar…";

      try {
        if (isEdit) {
          const { error } = await window.sb
            .from("appointments")
            .update(payload)
            .eq("id", row.id);
          if (error) throw error;
        } else {
          // INSERT
          const { error } = await window.sb
            .from("appointments")
            .insert(payload);
          if (error) throw error;
        }

        mMsg.style.color = "#111";
        mMsg.textContent = "Guardado.";
        closeModal();

        // refresh agenda
        await refreshAgenda();
      } catch (e) {
        console.error("Guardar marcação falhou:", e);
        mMsg.style.color = "#b00020";
        mMsg.textContent = "Erro ao guardar. Vê a consola.";
        btnSave.disabled = false;
      }
    }

    // handlers
    if (btnClose) btnClose.addEventListener("click", closeModal);
    if (btnCancel) btnCancel.addEventListener("click", closeModal);

    if (overlay) {
      overlay.addEventListener("click", (ev) => {
        if (ev.target && ev.target.id === "modalOverlay") closeModal();
      });
    }

    if (mProc) mProc.addEventListener("change", updateProcOtherVisibility);
    if (mStart) mStart.addEventListener("change", () => { /* end_at calculado no save */ });
    if (mDuration) mDuration.addEventListener("change", () => { /* end_at calculado no save */ });

    if (btnSave) btnSave.addEventListener("click", onSave);
  }

  // ---------- Logout ----------
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

  // ---------- Refresh agenda ----------
  async function refreshAgenda() {
    const sel = document.getElementById("selClinic");
    const clinicId = sel ? (sel.value || null) : null;

    setAgendaStatus("loading", "A carregar marcações do dia…");

    try {
      const { data, timeColUsed } = await loadAppointmentsForToday({ clinicId });
      G.agenda.rows = data;
      G.agenda.timeColUsed = timeColUsed || "start_at";
      setAgendaStatus("ok", `OK: ${data.length} marcação(ões) carregada(s).`);
      renderAgendaList();
    } catch (e) {
      console.error("Agenda load falhou:", e);
      setAgendaStatus("error", "Erro ao carregar agenda. Vê a consola para detalhe.");
      G.agenda.rows = [];
      renderAgendaList();
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

      G.sessionUser = session.user;

      // UI base
      renderAppShell();
      renderAgendaSubtitle();
      await wireLogout();

      // role + clínicas (via RLS)
      try {
        G.role = await fetchMyRole(G.sessionUser.id);
      } catch (e) {
        console.warn("Não foi possível carregar role via clinic_members:", e);
        G.role = null;
      }

      try {
        G.clinics = await fetchVisibleClinics();
      } catch (e) {
        console.warn("Não foi possível carregar clínicas via clinics:", e);
        G.clinics = [];
      }

      G.clinicsById = {};
      for (const c of G.clinics) G.clinicsById[c.id] = c;

      // Header
      const hdrEmail = document.getElementById("hdrEmail");
      if (hdrEmail) hdrEmail.textContent = G.sessionUser.email || "—";

      const hdrRole = document.getElementById("hdrRole");
      if (hdrRole) hdrRole.textContent = G.role ? G.role : "—";

      const hdrClinicCount = document.getElementById("hdrClinicCount");
      if (hdrClinicCount) hdrClinicCount.textContent = String(G.clinics.length);

      // Select clínicas
      renderClinicsSelect(G.clinics);

      // Eventos
      const sel = document.getElementById("selClinic");
      if (sel) sel.addEventListener("change", refreshAgenda);

      const btnRefresh = document.getElementById("btnRefreshAgenda");
      if (btnRefresh) btnRefresh.addEventListener("click", refreshAgenda);

      const btnNew = document.getElementById("btnNewAppt");
      if (btnNew) {
        btnNew.addEventListener("click", () => {
          openApptModal({ mode: "new", row: null });
        });
      }

      // Permissões UI (RLS manda, mas evitamos fricção)
      // Só doctor/secretary podem criar/editar marcações
      if (btnNew && G.role && !["doctor", "secretary"].includes(String(G.role).toLowerCase())) {
        btnNew.disabled = true;
        btnNew.title = "Sem permissão para criar marcações.";
      }

      // Carregar agenda inicial
      await refreshAgenda();
    } catch (e) {
      console.error("Boot falhou:", e);
      document.body.textContent = "Erro ao iniciar a app. Abre a consola para detalhe.";
    }
  }

  boot();
})();
