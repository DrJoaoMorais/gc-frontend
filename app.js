/* =========================================================
   Gestão Clínica V2 — app.js (ficheiro completo)
   - Auth bootstrap + header + logout
   - Agenda do dia + filtro por clínica (RLS)
   - Modal marcação: doente obrigatório (pesquisa + novo doente via RPC)
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
    const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  }

  function fromLocalInputValue(v) {
    return new Date(v);
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

  // ---------- Agenda ----------
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

  // ---------- Patients: pesquisa ----------
  async function searchPatients({ clinicId, q, limit = 12 }) {
    // Estratégia simples: pesquisar por nome dentro da clínica
    // 1) buscar patients via join indireto: patient_clinic -> patients
    // (Como não há view, fazemos em 2 passos: ids na patient_clinic, depois patients.)
    // Nota: RLS em patient_clinic permite SELECT para membros. Patients_select também restringe por membership.
    const term = (q || "").trim();
    if (!term || term.length < 2) return [];

    // 1) obter patient_ids ativos na clínica (limit mais alto para permitir filtro de nome depois)
    const { data: pcRows, error: pcErr } = await window.sb
      .from("patient_clinic")
      .select("patient_id")
      .eq("clinic_id", clinicId)
      .eq("is_active", true)
      .limit(200);

    if (pcErr) throw pcErr;
    const ids = (pcRows || []).map(r => r.patient_id).filter(Boolean);
    if (ids.length === 0) return [];

    // 2) buscar patients e filtrar por full_name ilike
    // Supabase JS suporta .in() com lista
    const { data: pts, error: pErr } = await window.sb
      .from("patients")
      .select("id, full_name, dob, sex, phone, email, external_id")
      .in("id", ids)
      .ilike("full_name", `%${term}%`)
      .eq("is_active", true)
      .order("full_name", { ascending: true })
      .limit(limit);

    if (pErr) throw pErr;
    return Array.isArray(pts) ? pts : [];
  }

  async function rpcCreatePatientForClinic(payload) {
    const { data, error } = await window.sb.rpc("create_patient_for_clinic", payload);
    if (error) throw error;
    return data;
  }

  // ---------- Tipos / Status / Duração ----------
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

  // ---------- Estado ----------
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

    ul.querySelectorAll("li[data-appt-id]").forEach((li) => {
      li.addEventListener("click", () => {
        const id = li.getAttribute("data-appt-id");
        const row = rows.find((x) => x.id === id);
        if (row) openApptModal({ mode: "edit", row });
      });
    });
  }

  // ---------- Modal helpers ----------
  function closeModal() {
    const root = document.getElementById("modalRoot");
    if (root) root.innerHTML = "";
  }

  function calcEndFromStartAndDuration(startLocalStr, durMin) {
    const s = fromLocalInputValue(startLocalStr);
    if (!s || isNaN(s.getTime())) return null;
    const e = new Date(s.getTime() + durMin * 60000);
    return { startAt: s.toISOString(), endAt: e.toISOString() };
  }

  function makeAutoTitle(patientName, procType) {
    const n = (patientName || "").trim();
    const p = (procType || "").trim();
    if (!n) return null;
    if (!p || p === "—") return n;
    return `${n} — ${p}`;
  }

  function openApptModal({ mode, row }) {
    const root = document.getElementById("modalRoot");
    if (!root) return;

    const isEdit = mode === "edit";

    const selClinic = document.getElementById("selClinic");
    const defaultClinicId =
      (isEdit && row && row.clinic_id) ? row.clinic_id :
      (selClinic && selClinic.value ? selClinic.value : (G.clinics.length === 1 ? G.clinics[0].id : ""));

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

    // Patient obrigatório
    const patientIdInit = isEdit ? (row.patient_id ?? "") : "";
    const patientNameInit = ""; // vamos tentar resolver a partir de search quando abrir (opcional)

    // Title passa a ser auto (mas mostramos campo read-only para transparência)
    const titleInit = isEdit ? (row.title ?? "") : "";
    const notesInit = isEdit ? (row.notes ?? "") : "";

    const procIsOther = procInit && !PROCEDURE_OPTIONS.includes(procInit) ? true : (procInit === "Outro");
    const procSelectValue = procIsOther ? "Outro" : (procInit || "");

    root.innerHTML = `
      <div id="modalOverlay" style="position:fixed; inset:0; background:rgba(0,0,0,0.35); display:flex; align-items:center; justify-content:center; padding:18px;">
        <div style="background:#fff; width:min(820px, 100%); border-radius:14px; border:1px solid #e5e5e5; padding:14px;">
          <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start;">
            <div>
              <div style="font-size:14px; font-weight:700; color:#111;">
                ${isEdit ? "Editar marcação" : "Nova marcação"}
              </div>
              <div style="font-size:12px; color:#666; margin-top:4px;">
                Doente é obrigatório. Duração define o fim (end_at).
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

            <div style="display:flex; flex-direction:column; gap:4px; grid-column: 1 / -1;">
              <label style="font-size:12px; color:#666;">Doente (obrigatório)</label>
              <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:flex-start;">
                <div style="flex:1; min-width: 240px; display:flex; flex-direction:column; gap:6px;">
                  <input id="mPatientQuery" type="text" placeholder="Escrever nome (mín. 2 letras)…"
                    style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; width:100%;" />
                  <div id="mPatientResults" style="border:1px solid #eee; border-radius:10px; padding:8px; max-height:160px; overflow:auto; background:#fff;">
                    <div style="font-size:12px; color:#666;">Pesquisar para mostrar resultados.</div>
                  </div>
                </div>

                <div style="width: 280px; display:flex; flex-direction:column; gap:6px;">
                  <div style="font-size:12px; color:#666;">Selecionado</div>
                  <div id="mPatientSelected" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; min-height: 42px; display:flex; align-items:center; color:#111;">
                    —
                  </div>
                  <button id="btnNewPatient" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; background:#fff; cursor:pointer;">
                    Novo doente
                  </button>
                </div>
              </div>
              <input type="hidden" id="mPatientId" value="" />
              <input type="hidden" id="mPatientName" value="" />
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
              <label style="font-size:12px; color:#666;">Título (automático)</label>
              <input id="mTitleAuto" type="text" disabled style="padding:10px 12px; border-radius:10px; border:1px solid #eee; background:#fafafa;" />
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
    const btnNewPatient = document.getElementById("btnNewPatient");

    const mClinic = document.getElementById("mClinic");
    const mStatus = document.getElementById("mStatus");
    const mStart = document.getElementById("mStart");
    const mDuration = document.getElementById("mDuration");
    const mProc = document.getElementById("mProc");
    const mProcOtherWrap = document.getElementById("mProcOtherWrap");
    const mProcOther = document.getElementById("mProcOther");
    const mNotes = document.getElementById("mNotes");
    const mMsg = document.getElementById("mMsg");

    const mPatientQuery = document.getElementById("mPatientQuery");
    const mPatientResults = document.getElementById("mPatientResults");
    const mPatientSelected = document.getElementById("mPatientSelected");
    const mPatientId = document.getElementById("mPatientId");
    const mPatientName = document.getElementById("mPatientName");
    const mTitleAuto = document.getElementById("mTitleAuto");

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
    if (mNotes) mNotes.value = notesInit;

    function updateProcOtherVisibility() {
      const v = mProc ? mProc.value : "";
      const show = (v === "Outro");
      if (mProcOtherWrap) mProcOtherWrap.style.display = show ? "flex" : "none";
      if (!show && mProcOther) mProcOther.value = "";
      updateTitleAuto();
    }

    function getProcedureValue() {
      let proc = (mProc && mProc.value) ? mProc.value : "";
      if (proc === "Outro") {
        const other = (mProcOther && mProcOther.value) ? mProcOther.value.trim() : "";
        proc = other ? other : "Outro";
      }
      return proc;
    }

    function updateTitleAuto() {
      const pname = mPatientName ? (mPatientName.value || "") : "";
      const proc = getProcedureValue();
      const t = makeAutoTitle(pname, proc);
      if (mTitleAuto) mTitleAuto.value = t || "";
    }

    // setup proc outro
    updateProcOtherVisibility();
    if (procIsOther && mProcOther) {
      mProcOther.value = procInit === "Outro" ? "" : procInit;
      if (mProcOtherWrap) mProcOtherWrap.style.display = "flex";
    }

    // Se em edição já existe patient_id, tentamos mostrar “(ID)” enquanto não buscamos nome
    if (mPatientId) mPatientId.value = patientIdInit || "";
    if (mPatientSelected) {
      mPatientSelected.textContent = patientIdInit ? `Selecionado (ID): ${patientIdInit}` : "—";
    }
    if (mPatientName) mPatientName.value = patientNameInit || "";
    if (mTitleAuto) mTitleAuto.value = titleInit || "";

    // Pesquisa de doentes
    let searchTimer = null;

    async function runSearch() {
      const clinicId = mClinic ? mClinic.value : "";
      const term = mPatientQuery ? mPatientQuery.value : "";
      if (!clinicId) {
        mPatientResults.innerHTML = `<div style="font-size:12px; color:#666;">Seleciona a clínica para pesquisar doentes.</div>`;
        return;
      }
      if (!term || term.trim().length < 2) {
        mPatientResults.innerHTML = `<div style="font-size:12px; color:#666;">Escreve pelo menos 2 letras.</div>`;
        return;
      }

      mPatientResults.innerHTML = `<div style="font-size:12px; color:#666;">A pesquisar…</div>`;
      try {
        const pts = await searchPatients({ clinicId, q: term, limit: 12 });
        if (pts.length === 0) {
          mPatientResults.innerHTML = `<div style="font-size:12px; color:#666;">Sem resultados.</div>`;
          return;
        }

        mPatientResults.innerHTML = pts.map(p => {
          const dob = p.dob ? ` • ${p.dob}` : "";
          const ext = p.external_id ? ` • ${escapeHtml(p.external_id)}` : "";
          return `
            <div data-pid="${escapeHtml(p.id)}" data-pname="${escapeHtml(p.full_name)}"
                 style="padding:8px; border:1px solid #f0f0f0; border-radius:10px; margin-bottom:8px; cursor:pointer;">
              <div style="font-size:13px; color:#111; font-weight:600;">${escapeHtml(p.full_name)}</div>
              <div style="font-size:12px; color:#666;">${escapeHtml(dob)}${ext}</div>
            </div>
          `;
        }).join("");

        mPatientResults.querySelectorAll("[data-pid]").forEach(el => {
          el.addEventListener("click", () => {
            const pid = el.getAttribute("data-pid");
            const pname = el.getAttribute("data-pname");
            if (mPatientId) mPatientId.value = pid || "";
            if (mPatientName) mPatientName.value = pname || "";
            if (mPatientSelected) mPatientSelected.textContent = pname ? pname : (pid ? `Selecionado (ID): ${pid}` : "—");
            updateTitleAuto();
          });
        });
      } catch (e) {
        console.error("Pesquisa doente falhou:", e);
        mPatientResults.innerHTML = `<div style="font-size:12px; color:#b00020;">Erro na pesquisa. Vê a consola.</div>`;
      }
    }

    function scheduleSearch() {
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(runSearch, 250);
    }

    // Novo doente (sub-modal simples)
    function openNewPatientForm() {
      const clinicId = mClinic ? mClinic.value : "";
      if (!clinicId) {
        mMsg.style.color = "#b00020";
        mMsg.textContent = "Seleciona a clínica antes de criar doente.";
        return;
      }

      const sub = document.createElement("div");
      sub.id = "subNewPatient";
      sub.style.marginTop = "10px";
      sub.innerHTML = `
        <div style="border:1px solid #eee; border-radius:12px; padding:12px; background:#fafafa;">
          <div style="font-size:13px; font-weight:700; color:#111;">Novo doente</div>
          <div style="font-size:12px; color:#666; margin-top:4px;">Campos mínimos. DOB no formato AAAA-MM-DD.</div>

          <div style="margin-top:10px; display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:12px; color:#666;">Nome completo *</label>
              <input id="npFullName" type="text" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd;" />
            </div>
            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:12px; color:#666;">Data nascimento</label>
              <input id="npDob" type="date" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd;" />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:12px; color:#666;">Sexo</label>
              <select id="npSex" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; background:#fff;">
                <option value="">—</option>
                <option value="M">M</option>
                <option value="F">F</option>
                <option value="O">O</option>
              </select>
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:12px; color:#666;">Telefone</label>
              <input id="npPhone" type="text" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd;" />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:12px; color:#666;">Email</label>
              <input id="npEmail" type="email" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd;" />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:12px; color:#666;">External ID (SNS/NIF/ID)</label>
              <input id="npExternalId" type="text" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd;" />
            </div>

            <div style="grid-column: 1 / -1; display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:12px; color:#666;">Notas</label>
              <textarea id="npNotes" rows="2" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; resize:vertical;"></textarea>
            </div>
          </div>

          <div style="margin-top:10px; display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
            <div id="npMsg" style="font-size:12px; color:#666;"></div>
            <div style="display:flex; gap:10px;">
              <button id="npCancel" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; background:#fff; cursor:pointer;">Fechar</button>
              <button id="npCreate" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; background:#fff; cursor:pointer; font-weight:600;">Criar doente</button>
            </div>
          </div>
        </div>
      `;

      // inserir antes dos botões finais
      const grid = overlay.querySelector("div[style*='grid-template-columns']");
      if (grid && grid.parentElement) {
        grid.parentElement.insertBefore(sub, grid.parentElement.lastElementChild);
      } else {
        // fallback
        overlay.querySelector("div[style*='background:#fff']").appendChild(sub);
      }

      const npFullName = document.getElementById("npFullName");
      const npDob = document.getElementById("npDob");
      const npSex = document.getElementById("npSex");
      const npPhone = document.getElementById("npPhone");
      const npEmail = document.getElementById("npEmail");
      const npExternalId = document.getElementById("npExternalId");
      const npNotes = document.getElementById("npNotes");
      const npMsg = document.getElementById("npMsg");
      const npCancel = document.getElementById("npCancel");
      const npCreate = document.getElementById("npCreate");

      function closeSub() {
        const el = document.getElementById("subNewPatient");
        if (el) el.remove();
      }

      npCancel.addEventListener("click", closeSub);

      npCreate.addEventListener("click", async () => {
        const fullName = (npFullName.value || "").trim();
        if (!fullName) {
          npMsg.style.color = "#b00020";
          npMsg.textContent = "Nome completo é obrigatório.";
          return;
        }

        npCreate.disabled = true;
        npMsg.style.color = "#666";
        npMsg.textContent = "A criar…";

        try {
          const payload = {
            p_clinic_id: clinicId,
            p_full_name: fullName,
            p_dob: npDob.value ? npDob.value : null,
            p_sex: npSex.value ? npSex.value : null,
            p_phone: npPhone.value ? npPhone.value.trim() : null,
            p_email: npEmail.value ? npEmail.value.trim() : null,
            p_external_id: npExternalId.value ? npExternalId.value.trim() : null,
            p_notes: npNotes.value ? npNotes.value.trim() : null
          };

          const created = await rpcCreatePatientForClinic(payload);

          // Tentativa de extrair o patient_id:
          // Pode devolver UUID diretamente, ou JSON/record. Lidamos com ambos.
          let newPatientId = null;
          let newPatientName = fullName;

          if (typeof created === "string") newPatientId = created;
          else if (created && typeof created === "object") {
            newPatientId = created.patient_id || created.id || created.p_patient_id || null;
            newPatientName = created.full_name || created.p_full_name || fullName;
          }

          if (!newPatientId) {
            // fallback: pesquisar por nome recém-criado (não ideal, mas evita bloquear)
            const pts = await searchPatients({ clinicId, q: fullName, limit: 5 });
            const exact = pts.find(p => (p.full_name || "").toLowerCase() === fullName.toLowerCase());
            if (exact) newPatientId = exact.id;
          }

          if (!newPatientId) {
            npMsg.style.color = "#b00020";
            npMsg.textContent = "Criado, mas não consegui obter o ID. Pesquisa pelo nome e seleciona.";
            npCreate.disabled = false;
            return;
          }

          // selecionar automaticamente no modal principal
          mPatientId.value = newPatientId;
          mPatientName.value = newPatientName;
          mPatientSelected.textContent = newPatientName;
          updateTitleAuto();

          npMsg.style.color = "#111";
          npMsg.textContent = "Doente criado e selecionado.";
          closeSub();
        } catch (e) {
          console.error("Criar doente falhou:", e);
          npMsg.style.color = "#b00020";
          npMsg.textContent = "Erro ao criar doente. Vê a consola.";
          npCreate.disabled = false;
        }
      });
    }

    async function onSave() {
      // validações
      if (!mClinic || !mClinic.value) {
        mMsg.style.color = "#b00020";
        mMsg.textContent = "Seleciona a clínica.";
        return;
      }
      if (!mStart || !mStart.value) {
        mMsg.style.color = "#b00020";
        mMsg.textContent = "Define o início.";
        return;
      }
      const pid = mPatientId ? (mPatientId.value || "") : "";
      const pname = mPatientName ? (mPatientName.value || "") : "";
      if (!pid) {
        mMsg.style.color = "#b00020";
        mMsg.textContent = "Seleciona um doente.";
        return;
      }

      const dur = mDuration ? parseInt(mDuration.value, 10) : 20;
      const times = calcEndFromStartAndDuration(mStart.value, dur);
      if (!times) {
        mMsg.style.color = "#b00020";
        mMsg.textContent = "Data/hora inválida.";
        return;
      }

      const proc = getProcedureValue();
      const autoTitle = makeAutoTitle(pname, proc);

      const payload = {
        clinic_id: mClinic.value,
        patient_id: pid,
        start_at: times.startAt,
        end_at: times.endAt,
        status: (mStatus && mStatus.value) ? mStatus.value : "scheduled",
        procedure_type: proc ? proc : null,
        title: autoTitle,
        notes: (mNotes && mNotes.value) ? mNotes.value.trim() : null
      };
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
          const { error } = await window.sb
            .from("appointments")
            .insert(payload);
          if (error) throw error;
        }

        mMsg.style.color = "#111";
        mMsg.textContent = "Guardado.";
        closeModal();
        await refreshAgenda();
      } catch (e) {
        console.error("Guardar marcação falhou:", e);
        mMsg.style.color = "#b00020";
        mMsg.textContent = "Erro ao guardar. Vê a consola.";
        btnSave.disabled = false;
      }
    }

    // handlers base
    if (btnClose) btnClose.addEventListener("click", closeModal);
    if (btnCancel) btnCancel.addEventListener("click", closeModal);
    if (overlay) overlay.addEventListener("click", (ev) => { if (ev.target && ev.target.id === "modalOverlay") closeModal(); });

    if (mProc) mProc.addEventListener("change", updateProcOtherVisibility);
    if (mProcOther) mProcOther.addEventListener("input", updateTitleAuto);
    if (mClinic) mClinic.addEventListener("change", () => {
      // limpar seleção de doente ao mudar clínica
      if (mPatientId) mPatientId.value = "";
      if (mPatientName) mPatientName.value = "";
      if (mPatientSelected) mPatientSelected.textContent = "—";
      if (mPatientResults) mPatientResults.innerHTML = `<div style="font-size:12px; color:#666;">Pesquisar para mostrar resultados.</div>`;
      updateTitleAuto();
    });

    if (mPatientQuery) mPatientQuery.addEventListener("input", scheduleSearch);
    if (btnNewPatient) btnNewPatient.addEventListener("click", openNewPatientForm);

    if (btnSave) btnSave.addEventListener("click", onSave);

    // inicial
    updateTitleAuto();
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

  // ---------- Agenda refresh ----------
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

      renderAppShell();
      renderAgendaSubtitle();
      await wireLogout();

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

      renderClinicsSelect(G.clinics);

      const sel = document.getElementById("selClinic");
      if (sel) sel.addEventListener("change", refreshAgenda);

      const btnRefresh = document.getElementById("btnRefreshAgenda");
      if (btnRefresh) btnRefresh.addEventListener("click", refreshAgenda);

      const btnNew = document.getElementById("btnNewAppt");
      if (btnNew) {
        btnNew.addEventListener("click", () => openApptModal({ mode: "new", row: null }));
      }

      // UI friction: só doctor/secretary podem criar/editar
      if (btnNew && G.role && !["doctor", "secretary"].includes(String(G.role).toLowerCase())) {
        btnNew.disabled = true;
        btnNew.title = "Sem permissão para criar marcações.";
      }

      await refreshAgenda();
    } catch (e) {
      console.error("Boot falhou:", e);
      document.body.textContent = "Erro ao iniciar a app. Abre a consola para detalhe.";
    }
  }

  boot();
})();
