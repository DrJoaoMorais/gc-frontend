/* =========================================================
   Gestão Clínica V2 — app.js (ficheiro completo)
   - Auth bootstrap + header + logout
   - Agenda por dia selecionado (default = hoje) + filtro por clínica (RLS)
   - Calendário mensal (overlay) para escolher dia
   - Modal marcação: doente obrigatório (pesquisa + novo doente via RPC)
   - ✅ Pesquisa rápida de doentes (Nome/SNS/NIF/Telefone) na página principal
   - ✅ Edição de doente (modal dedicado) via RPC update_patient_for_clinic (se existir)
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

  function fmtDatePt(d) {
    if (!(d instanceof Date) || isNaN(d.getTime())) return "—";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = String(d.getFullYear());
    return `${dd}-${mm}-${yyyy}`;
  }

  function fmtDateISO(d) {
    if (!(d instanceof Date) || isNaN(d.getTime())) return "";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function parseISODateToLocalStart(dateISO) {
    const [y, m, d] = (dateISO || "").split("-").map((n) => parseInt(n, 10));
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }

  function isoLocalDayRangeFromISODate(dateStr) {
    const start = parseISODateToLocalStart(dateStr);
    if (!start) return null;
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1, 0, 0, 0, 0);
    return { startISO: start.toISOString(), endISO: end.toISOString(), start, end };
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

  function normalizeDigits(v) {
    return String(v || "").replace(/\D+/g, "");
  }

  function normalizeTrimOrNull(v) {
    const t = String(v ?? "").trim();
    return t ? t : null;
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

  async function loadAppointmentsForRange({ clinicId, startISO, endISO }) {
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

  // ---------- Patients ----------
  async function getActivePatientIdsForClinic(clinicId) {
    const { data: pcRows, error: pcErr } = await window.sb
      .from("patient_clinic")
      .select("patient_id")
      .eq("clinic_id", clinicId)
      .eq("is_active", true)
      .limit(2000);

    if (pcErr) throw pcErr;
    const ids = (pcRows || []).map((r) => r.patient_id).filter(Boolean);
    return ids;
  }

  // Pesquisa “inteligente”:
  // - Nome: prefixo (Man -> Man%)
  // - SNS/NIF: 9 dígitos (match exato)
  // - Telefone: contém (pode dar vários)
  async function searchPatientsSmart({ clinicId, q, limit = 20 }) {
    const term = (q || "").trim();
    if (!term || term.length < 2) return [];

    const ids = await getActivePatientIdsForClinic(clinicId);
    if (ids.length === 0) return [];

    const digits = normalizeDigits(term);

    // Base select (inclui campos úteis para mostrar e editar)
    let query = window.sb
      .from("patients")
      .select("id, full_name, dob, phone, email, external_id, sns, nif, passport_id, address_line1, postal_code, city, country, insurance_provider, insurance_policy_number, notes")
      .in("id", ids)
      .eq("is_active", true);

    // Heurística:
    // - se 9 dígitos -> SNS ou NIF exato (e também tenta telefone contém)
    // - se >=6 dígitos -> telefone contém
    // - caso contrário -> nome prefixo + contém (fallback)
    if (digits && digits.length === 9) {
      // SNS/NIF exato OU telefone contém
      query = query.or(`sns.eq.${digits},nif.eq.${digits},phone.ilike.%${digits}%`);
    } else if (digits && digits.length >= 6) {
      query = query.or(`phone.ilike.%${digits}%,full_name.ilike.${term}%`);
    } else {
      // Nome prefixo + contém (mais amigável)
      const safe = term.replaceAll(",", " "); // evita quebrar or()
      query = query.or(`full_name.ilike.${safe}%,full_name.ilike.%${safe}%`);
    }

    const { data: pts, error: pErr } = await query.order("full_name", { ascending: true }).limit(limit);
    if (pErr) throw pErr;
    return Array.isArray(pts) ? pts : [];
  }

  async function fetchPatientByIdForClinic({ clinicId, patientId }) {
    if (!clinicId || !patientId) return null;

    const { data: pcRows, error: pcErr } = await window.sb
      .from("patient_clinic")
      .select("patient_id")
      .eq("clinic_id", clinicId)
      .eq("patient_id", patientId)
      .eq("is_active", true)
      .limit(1);

    if (pcErr) throw pcErr;
    if (!pcRows || pcRows.length === 0) return null;

    const { data: pts, error: pErr } = await window.sb
      .from("patients")
      .select("id, full_name, dob, phone, email, external_id, sns, nif, passport_id, address_line1, postal_code, city, country, insurance_provider, insurance_policy_number, notes, is_active")
      .eq("id", patientId)
      .limit(1);

    if (pErr) throw pErr;
    if (!pts || pts.length === 0) return null;
    return pts[0];
  }

  async function rpcCreatePatientForClinic(payload) {
    const { data, error } = await window.sb.rpc("create_patient_for_clinic", payload);
    if (error) throw error;
    return data;
  }

  async function rpcUpdatePatientForClinic(payload) {
    // Nota: esta RPC tem de existir no Supabase. Se não existir, vai dar erro claro na consola.
    const { data, error } = await window.sb.rpc("update_patient_for_clinic", payload);
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
    "Outro",
  ];

  const STATUS_OPTIONS = ["scheduled", "confirmed", "arrived", "done", "cancelled", "no_show"];
  const DURATION_OPTIONS = [15, 20, 30, 45, 60];

  // ---------- Estado ----------
  let G = {
    sessionUser: null,
    role: null,
    clinics: [],
    clinicsById: {},
    agenda: { rows: [], timeColUsed: "start_at" },
    selectedDayISO: fmtDateISO(new Date()),
    calMonth: null,

    // pesquisa rápida
    patientQuick: {
      selected: null,
    },
  };

  // ---------- Render shell ----------
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

        <main style="margin-top:14px; display:grid; grid-template-columns: 1fr; gap:14px;">
          <section style="padding:12px 14px; border:1px solid #eee; border-radius:12px;">
            <div style="display:flex; align-items:flex-end; justify-content:space-between; gap:12px; flex-wrap:wrap;">
              <div>
                <div style="font-size:14px; color:#111; font-weight:600;">Agenda</div>
                <div style="font-size:12px; color:#666; margin-top:4px;" id="agendaSubtitle">—</div>
              </div>

              <div style="display:flex; gap:10px; align-items:flex-end; flex-wrap:wrap;">
                <button id="btnCal" title="Calendário" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; background:#fff; cursor:pointer;">
                  Calendário
                </button>

                <button id="btnToday" title="Voltar a hoje" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; background:#fff; cursor:pointer;">
                  Hoje
                </button>

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

          <!-- ✅ Pesquisa rápida de doentes -->
          <section style="padding:12px 14px; border:1px solid #eee; border-radius:12px;">
            <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-end; flex-wrap:wrap;">
              <div>
                <div style="font-size:14px; color:#111; font-weight:600;">Pesquisa rápida de doentes</div>
                <div style="font-size:12px; color:#666; margin-top:4px;">
                  Nome (prefixo), SNS, NIF ou Telefone (pode dar múltiplos resultados).
                </div>
              </div>
              <div style="display:flex; gap:10px; align-items:flex-end; flex-wrap:wrap;">
                <input id="pqQuery" type="text" placeholder="Ex.: Man / 9 dígitos (SNS/NIF) / telefone…"
                  style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; min-width: 320px;" />
                <button id="pqClear" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; background:#fff; cursor:pointer;">
                  Limpar
                </button>
              </div>
            </div>

            <div id="pqMsg" style="margin-top:10px; font-size:12px; color:#666;"></div>

            <div style="margin-top:10px; display:grid; grid-template-columns: 1fr 320px; gap:12px; align-items:start;">
              <div id="pqResults" style="border:1px solid #eee; border-radius:12px; padding:10px; min-height: 70px; background:#fff;">
                <div style="font-size:12px; color:#666;">Escreve para pesquisar.</div>
              </div>

              <div style="border:1px solid #eee; border-radius:12px; padding:10px; background:#fff;">
                <div style="font-size:12px; color:#666;">Selecionado</div>
                <div id="pqSelected" style="margin-top:6px; font-size:13px; color:#111; font-weight:600;">—</div>
                <div id="pqSelectedMeta" style="margin-top:4px; font-size:12px; color:#666;">—</div>

                <div style="margin-top:10px; display:flex; gap:10px;">
                  <button id="pqEdit" style="flex:1; padding:10px 12px; border-radius:10px; border:1px solid #ddd; background:#fff; cursor:pointer;" disabled>
                    Editar doente
                  </button>
                </div>
              </div>
            </div>
          </section>
        </main>

        <div id="modalRoot"></div>
      </div>
    `;
  }

  function setAgendaSubtitleForSelectedDay() {
    const r = isoLocalDayRangeFromISODate(G.selectedDayISO);
    const sub = document.getElementById("agendaSubtitle");
    if (!sub || !r) return;
    sub.textContent = `${fmtDatePt(r.start)} (00:00–24:00)`;
  }

  function setAgendaStatus(kind, text) {
    const el = document.getElementById("agendaStatus");
    if (!el) return;

    const color = kind === "loading" ? "#666" : kind === "error" ? "#b00020" : kind === "ok" ? "#111" : "#666";
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
      ul.innerHTML = `<li style="padding:10px 0; font-size:12px; color:#666;">Sem marcações para este dia.</li>`;
      return;
    }

    ul.innerHTML = rows
      .map((r) => {
        const startVal = r[timeColUsed] ?? r[pickFirstExisting(r, APPT_TIME_COL_CANDIDATES)];
        const endVal = r[pickFirstExisting(r, APPT_END_COL_CANDIDATES)];

        const start = startVal ? new Date(startVal) : null;
        const end = endVal ? new Date(endVal) : null;

        const tStart = fmtTime(start);
        const tEnd = end ? fmtTime(end) : null;

        const clinicId = r.clinic_id ?? null;
        const clinicName =
          clinicId && G.clinicsById[clinicId]
            ? G.clinicsById[clinicId].name || G.clinicsById[clinicId].slug || clinicId
            : clinicId || "—";

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
      })
      .join("");

    ul.querySelectorAll("li[data-appt-id]").forEach((li) => {
      li.addEventListener("click", () => {
        const id = li.getAttribute("data-appt-id");
        const row = rows.find((x) => x.id === id);
        if (row) openApptModal({ mode: "edit", row });
      });
    });
  }

  // ---------- Calendário mensal overlay ----------
  function monthLabel(d) {
    const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  function buildMonthGrid(monthDate) {
    const y = monthDate.getFullYear();
    const m = monthDate.getMonth();

    const first = new Date(y, m, 1, 0, 0, 0, 0);
    const last = new Date(y, m + 1, 0, 0, 0, 0, 0);
    const daysInMonth = last.getDate();

    const jsDowFirst = first.getDay();
    const dowFirstMon0 = (jsDowFirst + 6) % 7;

    const cells = [];
    for (let i = 0; i < dowFirstMon0; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, m, d, 0, 0, 0, 0));
    while (cells.length % 7 !== 0) cells.push(null);
    while (cells.length < 42) cells.push(null);

    return cells;
  }

  function openCalendarOverlay() {
    const root = document.getElementById("modalRoot");
    if (!root) return;

    const todayISO = fmtDateISO(new Date());
    const selectedISO = G.selectedDayISO;

    if (!G.calMonth) {
      const selD = parseISODateToLocalStart(selectedISO) || new Date();
      G.calMonth = new Date(selD.getFullYear(), selD.getMonth(), 1, 0, 0, 0, 0);
    }

    const cells = buildMonthGrid(G.calMonth);
    const weekDays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

    root.innerHTML = `
      <div id="calOverlay" style="position:fixed; inset:0; background:rgba(0,0,0,0.35); display:flex; align-items:center; justify-content:center; padding:18px;">
        <div style="background:#fff; width:min(520px, 100%); border-radius:14px; border:1px solid #e5e5e5; padding:14px;">
          <div style="display:flex; justify-content:space-between; gap:10px; align-items:center;">
            <button id="calPrev" style="padding:8px 10px; border-radius:10px; border:1px solid #ddd; background:#fff; cursor:pointer;">◀</button>
            <div style="font-size:14px; font-weight:700; color:#111;" id="calTitle">${escapeHtml(monthLabel(G.calMonth))}</div>
            <button id="calNext" style="padding:8px 10px; border-radius:10px; border:1px solid #ddd; background:#fff; cursor:pointer;">▶</button>
          </div>

          <div style="margin-top:10px; display:grid; grid-template-columns: repeat(7, 1fr); gap:6px;">
            ${weekDays.map((w) => `<div style="font-size:12px; color:#666; text-align:center; padding:6px 0;">${w}</div>`).join("")}
            ${cells
              .map((d) => {
                if (!d) return `<div></div>`;
                const iso = fmtDateISO(d);
                const isToday = iso === todayISO;
                const isSelected = iso === selectedISO;

                const base = "padding:10px 0; border-radius:10px; border:1px solid #eee; text-align:center; cursor:pointer; user-select:none;";
                const bg = isSelected
                  ? "background:#111; color:#fff; border-color:#111;"
                  : isToday
                    ? "background:#f2f2f2; color:#111;"
                    : "background:#fff; color:#111;";
                return `<div data-iso="${iso}" style="${base}${bg}">${d.getDate()}</div>`;
              })
              .join("")}
          </div>

          <div style="margin-top:12px; display:flex; justify-content:space-between; gap:10px; align-items:center; flex-wrap:wrap;">
            <div style="font-size:12px; color:#666;">Clique num dia para abrir a agenda desse dia.</div>
            <button id="calClose" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; background:#fff; cursor:pointer;">Fechar</button>
          </div>
        </div>
      </div>
    `;

    const overlay = document.getElementById("calOverlay");
    const calClose = document.getElementById("calClose");
    const calPrev = document.getElementById("calPrev");
    const calNext = document.getElementById("calNext");

    function close() {
      root.innerHTML = "";
    }

    if (calClose) calClose.addEventListener("click", close);
    if (overlay) overlay.addEventListener("click", (ev) => { if (ev.target && ev.target.id === "calOverlay") close(); });

    if (calPrev) calPrev.addEventListener("click", () => {
      G.calMonth = new Date(G.calMonth.getFullYear(), G.calMonth.getMonth() - 1, 1, 0, 0, 0, 0);
      openCalendarOverlay();
    });

    if (calNext) calNext.addEventListener("click", () => {
      G.calMonth = new Date(G.calMonth.getFullYear(), G.calMonth.getMonth() + 1, 1, 0, 0, 0, 0);
      openCalendarOverlay();
    });

    root.querySelectorAll("[data-iso]").forEach((el) => {
      el.addEventListener("click", async () => {
        const iso = el.getAttribute("data-iso");
        if (!iso) return;
        G.selectedDayISO = iso;

        const d = parseISODateToLocalStart(iso);
        if (d) G.calMonth = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);

        close();
        setAgendaSubtitleForSelectedDay();
        await refreshAgenda();
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

  // ---------- Modal: Editar doente (dedicado) ----------
  function openEditPatientModal({ clinicId, patientId }) {
    const root = document.getElementById("modalRoot");
    if (!root) return;

    root.innerHTML = `
      <div id="pModalOverlay" style="position:fixed; inset:0; background:rgba(0,0,0,0.35); display:flex; align-items:center; justify-content:center; padding:18px;">
        <div style="background:#fff; width:min(860px, 100%); border-radius:14px; border:1px solid #e5e5e5; padding:14px; max-height: 86vh; overflow:auto;">
          <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start;">
            <div>
              <div style="font-size:14px; font-weight:700; color:#111;">Editar doente</div>
              <div style="font-size:12px; color:#666; margin-top:4px;">
                Clínica: ${escapeHtml((G.clinicsById[clinicId] && (G.clinicsById[clinicId].name || G.clinicsById[clinicId].slug)) || clinicId || "—")}
              </div>
            </div>
            <button id="pBtnClose" style="padding:8px 10px; border-radius:10px; border:1px solid #ddd; background:#fff; cursor:pointer;">Fechar</button>
          </div>

          <div id="pMsg" style="margin-top:10px; font-size:12px; color:#666;"></div>

          <div style="margin-top:10px; border:1px solid #eee; border-radius:12px; padding:12px; background:#fafafa;">
            <div style="font-size:12px; color:#666;">
              Nome obrigatório. Identificação: SNS (9 dígitos) ou NIF (9 dígitos) ou Passaporte/ID (4–20 alfanum).
            </div>

            <div style="margin-top:10px; display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
              <div style="display:flex; flex-direction:column; gap:4px;">
                <label style="font-size:12px; color:#666;">Nome completo *</label>
                <input id="epFullName" type="text" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd;" />
              </div>

              <div style="display:flex; flex-direction:column; gap:4px;">
                <label style="font-size:12px; color:#666;">Data nascimento</label>
                <input id="epDob" type="text" disabled style="padding:10px 12px; border-radius:10px; border:1px solid #eee; background:#fafafa;" />
              </div>

              <div style="display:flex; flex-direction:column; gap:4px;">
                <label style="font-size:12px; color:#666;">Telefone</label>
                <input id="epPhone" type="text" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd;" />
              </div>

              <div style="display:flex; flex-direction:column; gap:4px;">
                <label style="font-size:12px; color:#666;">Email</label>
                <input id="epEmail" type="email" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd;" />
              </div>

              <div style="display:flex; flex-direction:column; gap:4px;">
                <label style="font-size:12px; color:#666;">SNS (9 dígitos)</label>
                <input id="epSNS" type="text" inputmode="numeric" placeholder="#########" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd;" />
              </div>

              <div style="display:flex; flex-direction:column; gap:4px;">
                <label style="font-size:12px; color:#666;">NIF (9 dígitos)</label>
                <input id="epNIF" type="text" inputmode="numeric" placeholder="#########" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd;" />
              </div>

              <div style="display:flex; flex-direction:column; gap:4px;">
                <label style="font-size:12px; color:#666;">Passaporte/ID (4–20)</label>
                <input id="epPassport" type="text" placeholder="AB123456" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd;" />
              </div>

              <div style="display:flex; flex-direction:column; gap:4px;">
                <label style="font-size:12px; color:#666;">Seguro</label>
                <input id="epInsuranceProvider" type="text" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd;" />
              </div>

              <div style="display:flex; flex-direction:column; gap:4px;">
                <label style="font-size:12px; color:#666;">Apólice</label>
                <input id="epInsurancePolicy" type="text" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd;" />
              </div>

              <div style="grid-column: 1 / -1; display:flex; flex-direction:column; gap:4px;">
                <label style="font-size:12px; color:#666;">Morada</label>
                <input id="epAddress1" type="text" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd;" />
              </div>

              <div style="display:flex; flex-direction:column; gap:4px;">
                <label style="font-size:12px; color:#666;">Código-postal</label>
                <input id="epPostal" type="text" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd;" />
              </div>

              <div style="display:flex; flex-direction:column; gap:4px;">
                <label style="font-size:12px; color:#666;">Cidade</label>
                <input id="epCity" type="text" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd;" />
              </div>

              <div style="display:flex; flex-direction:column; gap:4px;">
                <label style="font-size:12px; color:#666;">País</label>
                <input id="epCountry" type="text" value="PT" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd;" />
              </div>

              <div style="grid-column: 1 / -1; display:flex; flex-direction:column; gap:4px;">
                <label style="font-size:12px; color:#666;">Notas</label>
                <textarea id="epNotes" rows="2" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; resize:vertical;"></textarea>
              </div>
            </div>

            <div style="margin-top:10px; display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
              <div id="epMsg" style="font-size:12px; color:#666;"></div>
              <div style="display:flex; gap:10px;">
                <button id="epCancel" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; background:#fff; cursor:pointer;">Cancelar</button>
                <button id="epSave" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; background:#fff; cursor:pointer; font-weight:600;">Guardar doente</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const overlay = document.getElementById("pModalOverlay");
    const pBtnClose = document.getElementById("pBtnClose");
    const pMsg = document.getElementById("pMsg");

    const epFullName = document.getElementById("epFullName");
    const epDob = document.getElementById("epDob");
    const epPhone = document.getElementById("epPhone");
    const epEmail = document.getElementById("epEmail");
    const epSNS = document.getElementById("epSNS");
    const epNIF = document.getElementById("epNIF");
    const epPassport = document.getElementById("epPassport");
    const epInsuranceProvider = document.getElementById("epInsuranceProvider");
    const epInsurancePolicy = document.getElementById("epInsurancePolicy");
    const epAddress1 = document.getElementById("epAddress1");
    const epPostal = document.getElementById("epPostal");
    const epCity = document.getElementById("epCity");
    const epCountry = document.getElementById("epCountry");
    const epNotes = document.getElementById("epNotes");
    const epMsg = document.getElementById("epMsg");
    const epCancel = document.getElementById("epCancel");
    const epSave = document.getElementById("epSave");

    function close() {
      closeModal();
    }
    if (pBtnClose) pBtnClose.addEventListener("click", close);
    if (epCancel) epCancel.addEventListener("click", close);
    if (overlay) overlay.addEventListener("click", (ev) => { if (ev.target && ev.target.id === "pModalOverlay") close(); });

    function setTop(kind, msg) {
      if (!pMsg) return;
      pMsg.style.color = kind === "error" ? "#b00020" : "#666";
      pMsg.textContent = msg;
    }

    function setErr(msg) {
      epMsg.style.color = "#b00020";
      epMsg.textContent = msg;
    }
    function setInfo(msg) {
      epMsg.style.color = "#666";
      epMsg.textContent = msg;
    }

    function validate() {
      const fullName = (epFullName.value || "").trim();
      if (!fullName) return { ok: false, msg: "Nome completo é obrigatório." };

      const sns = normalizeDigits(epSNS.value);
      const nif = normalizeDigits(epNIF.value);
      const pass = String(epPassport.value || "").trim();

      if (sns && !/^[0-9]{9}$/.test(sns)) return { ok: false, msg: "SNS inválido: tem de ter 9 dígitos." };
      if (nif && !/^[0-9]{9}$/.test(nif)) return { ok: false, msg: "NIF inválido: tem de ter 9 dígitos." };
      if (pass && !/^[A-Za-z0-9]{4,20}$/.test(pass)) return { ok: false, msg: "Passaporte/ID inválido: 4–20 alfanum." };

      if (!sns && !nif && !pass) return { ok: false, msg: "Identificação obrigatória: SNS ou NIF ou Passaporte/ID." };

      return {
        ok: true,
        full_name: fullName,
        sns: sns || null,
        nif: nif || null,
        passport_id: pass || null,
        phone: normalizeTrimOrNull(epPhone.value),
        email: normalizeTrimOrNull(epEmail.value),
        address_line1: normalizeTrimOrNull(epAddress1.value),
        postal_code: normalizeTrimOrNull(epPostal.value),
        city: normalizeTrimOrNull(epCity.value),
        country: normalizeTrimOrNull(epCountry.value) || "PT",
        insurance_provider: normalizeTrimOrNull(epInsuranceProvider.value),
        insurance_policy_number: normalizeTrimOrNull(epInsurancePolicy.value),
        notes: normalizeTrimOrNull(epNotes.value),
      };
    }

    function refreshState() {
      if (epSNS) {
        const d = normalizeDigits(epSNS.value);
        if (epSNS.value !== d) epSNS.value = d;
      }
      if (epNIF) {
        const d = normalizeDigits(epNIF.value);
        if (epNIF.value !== d) epNIF.value = d;
      }

      const v = validate();
      if (!v.ok) {
        epSave.disabled = true;
        setErr(v.msg);
      } else {
        epSave.disabled = false;
        setInfo("OK para guardar.");
      }
    }

    [
      epFullName, epPhone, epEmail, epSNS, epNIF, epPassport,
      epInsuranceProvider, epInsurancePolicy, epAddress1, epPostal, epCity, epCountry, epNotes
    ].forEach((el) => {
      if (!el) return;
      el.addEventListener("input", refreshState);
      el.addEventListener("change", refreshState);
    });

    epSave.addEventListener("click", async () => {
      const v = validate();
      if (!v.ok) { setErr(v.msg); return; }

      epSave.disabled = true;
      setInfo("A guardar…");

      try {
        await rpcUpdatePatientForClinic({
          p_clinic_id: clinicId,
          p_patient_id: patientId,
          p_full_name: v.full_name,
          p_sns: v.sns,
          p_nif: v.nif,
          p_passport_id: v.passport_id,
          p_phone: v.phone,
          p_email: v.email,
          p_address_line1: v.address_line1,
          p_postal_code: v.postal_code,
          p_city: v.city,
          p_country: v.country,
          p_insurance_provider: v.insurance_provider,
          p_insurance_policy_number: v.insurance_policy_number,
          p_notes: v.notes,
        });

        setTop("ok", "Doente atualizado.");
        close();
      } catch (e) {
        console.error("Guardar doente falhou:", e);
        const msg = String(e && (e.message || e.details || e.hint) ? (e.message || e.details || e.hint) : e);
        setErr(msg.includes("duplicate") ? "Identificador já existe noutro doente." : "Erro ao guardar. Vê a consola.");
        epSave.disabled = false;
      }
    });

    // carregar doente
    (async () => {
      try {
        setTop("ok", "A carregar doente…");
        const p = await fetchPatientByIdForClinic({ clinicId, patientId });
        if (!p) {
          setTop("error", "Doente não encontrado nesta clínica (ou sem permissões).");
          epSave.disabled = true;
          return;
        }

        epFullName.value = p.full_name || "";
        epDob.value = p.dob ? String(p.dob) : "—";
        epPhone.value = p.phone || "";
        epEmail.value = p.email || "";
        epSNS.value = p.sns || "";
        epNIF.value = p.nif || "";
        epPassport.value = p.passport_id || "";
        epInsuranceProvider.value = p.insurance_provider || "";
        epInsurancePolicy.value = p.insurance_policy_number || "";
        epAddress1.value = p.address_line1 || "";
        epPostal.value = p.postal_code || "";
        epCity.value = p.city || "";
        epCountry.value = p.country || "PT";
        epNotes.value = p.notes || "";

        setTop("ok", "Carregado.");
        epSave.disabled = true;
        setInfo("A validar…");
        refreshState();
      } catch (e) {
        console.error("Carregar doente falhou:", e);
        setTop("error", "Erro ao carregar doente. Vê a consola.");
        epSave.disabled = true;
      }
    })();
  }

  // ---------- Modal marcação ----------
  function openApptModal({ mode, row }) {
    const root = document.getElementById("modalRoot");
    if (!root) return;

    const isEdit = mode === "edit";

    const selClinic = document.getElementById("selClinic");
    const defaultClinicId =
      isEdit && row && row.clinic_id
        ? row.clinic_id
        : selClinic && selClinic.value
          ? selClinic.value
          : G.clinics.length === 1
            ? G.clinics[0].id
            : "";

    const selectedDayStart = parseISODateToLocalStart(G.selectedDayISO) || new Date();
    const startBase = new Date(selectedDayStart.getFullYear(), selectedDayStart.getMonth(), selectedDayStart.getDate(), 9, 0, 0, 0);

    const startInit = isEdit && row && row.start_at ? new Date(row.start_at) : startBase;
    const endInit = isEdit && row && row.end_at ? new Date(row.end_at) : new Date(startInit.getTime() + 20 * 60000);
    const durInit = Math.max(5, Math.round((endInit.getTime() - startInit.getTime()) / 60000));
    const durationBest = DURATION_OPTIONS.includes(durInit) ? durInit : 20;

    const procInit = isEdit ? row.procedure_type ?? "" : "";
    const statusInit = isEdit ? row.status ?? "scheduled" : "scheduled";

    const patientIdInit = isEdit ? row.patient_id ?? "" : "";
    const titleInit = isEdit ? row.title ?? "" : "";
    const notesInit = isEdit ? row.notes ?? "" : "";

    const procIsOther = procInit && !PROCEDURE_OPTIONS.includes(procInit) ? true : procInit === "Outro";
    const procSelectValue = procIsOther ? "Outro" : procInit || "";

    root.innerHTML = `
      <div id="modalOverlay" style="position:fixed; inset:0; background:rgba(0,0,0,0.35); display:flex; align-items:center; justify-content:center; padding:18px;">
        <div style="background:#fff; width:min(820px, 100%); border-radius:14px; border:1px solid #e5e5e5; padding:14px; max-height: 86vh; overflow:auto;">
          <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start;">
            <div>
              <div style="font-size:14px; font-weight:700; color:#111;">
                ${isEdit ? "Editar marcação" : "Nova marcação"}
              </div>
              <div style="font-size:12px; color:#666; margin-top:4px;">
                Dia selecionado: ${escapeHtml(G.selectedDayISO)}. Doente é obrigatório.
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
                ${STATUS_OPTIONS.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("")}
              </select>
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:12px; color:#666;">Início</label>
              <input id="mStart" type="datetime-local" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd;" />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:12px; color:#666;">Duração (min)</label>
              <select id="mDuration" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; background:#fff;">
                ${DURATION_OPTIONS.map((n) => `<option value="${n}">${n}</option>`).join("")}
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
              <div id="newPatientHost" style="margin-top:10px;"></div>
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:12px; color:#666;">Tipo de consulta</label>
              <select id="mProc" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; background:#fff;">
                <option value="">—</option>
                ${PROCEDURE_OPTIONS.map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("")}
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

    const clinicOpts = [];
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

    function getProcedureValue() {
      let proc = mProc && mProc.value ? mProc.value : "";
      if (proc === "Outro") {
        const other = mProcOther && mProcOther.value ? mProcOther.value.trim() : "";
        proc = other ? other : "Outro";
      }
      return proc;
    }

    function updateTitleAuto() {
      const pname = mPatientName ? mPatientName.value || "" : "";
      const proc = getProcedureValue();
      const t = makeAutoTitle(pname, proc);
      if (mTitleAuto) mTitleAuto.value = t || "";
    }

    function updateProcOtherVisibility() {
      const v = mProc ? mProc.value : "";
      const show = v === "Outro";
      if (mProcOtherWrap) mProcOtherWrap.style.display = show ? "flex" : "none";
      if (!show && mProcOther) mProcOther.value = "";
      updateTitleAuto();
    }

    updateProcOtherVisibility();
    if (procIsOther && mProcOther) {
      mProcOther.value = procInit === "Outro" ? "" : procInit;
      if (mProcOtherWrap) mProcOtherWrap.style.display = "flex";
    }

    if (mPatientId) mPatientId.value = patientIdInit || "";
    if (mPatientSelected) mPatientSelected.textContent = patientIdInit ? `Selecionado (ID): ${patientIdInit}` : "—";
    if (mTitleAuto) mTitleAuto.value = titleInit || "";

    // search (nome apenas, como tinhas)
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
        const pts = await searchPatientsSmart({ clinicId, q: term, limit: 12 });
        if (pts.length === 0) {
          mPatientResults.innerHTML = `<div style="font-size:12px; color:#666;">Sem resultados.</div>`;
          return;
        }

        mPatientResults.innerHTML = pts
          .map((p) => {
            const dob = p.dob ? ` • ${p.dob}` : "";
            const idBits = [];
            if (p.sns) idBits.push(`SNS:${p.sns}`);
            if (p.nif) idBits.push(`NIF:${p.nif}`);
            if (p.passport_id) idBits.push(`ID:${p.passport_id}`);
            const idLine = idBits.length ? ` • ${escapeHtml(idBits.join(" / "))}` : (p.external_id ? ` • ${escapeHtml(p.external_id)}` : "");
            return `
            <div data-pid="${escapeHtml(p.id)}" data-pname="${escapeHtml(p.full_name)}"
                 style="padding:8px; border:1px solid #f0f0f0; border-radius:10px; margin-bottom:8px; cursor:pointer;">
              <div style="font-size:13px; color:#111; font-weight:600;">${escapeHtml(p.full_name)}</div>
              <div style="font-size:12px; color:#666;">${escapeHtml(dob)}${idLine}</div>
            </div>
          `;
          })
          .join("");

        mPatientResults.querySelectorAll("[data-pid]").forEach((el) => {
          el.addEventListener("click", () => {
            const pid = el.getAttribute("data-pid");
            const pname = el.getAttribute("data-pname");
            if (mPatientId) mPatientId.value = pid || "";
            if (mPatientName) mPatientName.value = pname || "";
            if (mPatientSelected) mPatientSelected.textContent = pname ? pname : pid ? `Selecionado (ID): ${pid}` : "—";
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

    function openNewPatientForm() {
      const clinicId = mClinic ? mClinic.value : "";
      if (!clinicId) {
        mMsg.style.color = "#b00020";
        mMsg.textContent = "Seleciona a clínica antes de criar doente.";
        return;
      }

      const host = document.getElementById("newPatientHost");
      if (!host) {
        mMsg.style.color = "#b00020";
        mMsg.textContent = "Falha UI: newPatientHost não encontrado.";
        return;
      }

      host.innerHTML = "";

      host.innerHTML = `
        <div id="subNewPatient" style="border:1px solid #eee; border-radius:12px; padding:12px; background:#fafafa;">
          <div style="font-size:13px; font-weight:700; color:#111;">Novo doente</div>
          <div style="font-size:12px; color:#666; margin-top:4px;">
            Nome obrigatório. Identificação: SNS (9 dígitos) ou NIF (9 dígitos) ou Passaporte/ID (4–20 alfanum).
          </div>

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
              <label style="font-size:12px; color:#666;">Telefone</label>
              <input id="npPhone" type="text" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd;" />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:12px; color:#666;">Email</label>
              <input id="npEmail" type="email" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd;" />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:12px; color:#666;">SNS (9 dígitos)</label>
              <input id="npSNS" type="text" inputmode="numeric" placeholder="#########" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd;" />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:12px; color:#666;">NIF (9 dígitos)</label>
              <input id="npNIF" type="text" inputmode="numeric" placeholder="#########" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd;" />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:12px; color:#666;">Passaporte/ID (4–20)</label>
              <input id="npPassport" type="text" placeholder="AB123456" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd;" />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:12px; color:#666;">Seguro</label>
              <input id="npInsuranceProvider" type="text" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd;" />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:12px; color:#666;">Apólice</label>
              <input id="npInsurancePolicy" type="text" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd;" />
            </div>

            <div style="grid-column: 1 / -1; display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:12px; color:#666;">Morada</label>
              <input id="npAddress1" type="text" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd;" />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:12px; color:#666;">Código-postal</label>
              <input id="npPostal" type="text" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd;" />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:12px; color:#666;">Cidade</label>
              <input id="npCity" type="text" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd;" />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:12px; color:#666;">País</label>
              <input id="npCountry" type="text" value="PT" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd;" />
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

      const npFullName = document.getElementById("npFullName");
      const npDob = document.getElementById("npDob");
      const npPhone = document.getElementById("npPhone");
      const npEmail = document.getElementById("npEmail");
      const npSNS = document.getElementById("npSNS");
      const npNIF = document.getElementById("npNIF");
      const npPassport = document.getElementById("npPassport");
      const npInsuranceProvider = document.getElementById("npInsuranceProvider");
      const npInsurancePolicy = document.getElementById("npInsurancePolicy");
      const npAddress1 = document.getElementById("npAddress1");
      const npPostal = document.getElementById("npPostal");
      const npCity = document.getElementById("npCity");
      const npCountry = document.getElementById("npCountry");
      const npNotes = document.getElementById("npNotes");
      const npMsg = document.getElementById("npMsg");
      const npCancel = document.getElementById("npCancel");
      const npCreate = document.getElementById("npCreate");

      function setErr(msg) {
        npMsg.style.color = "#b00020";
        npMsg.textContent = msg;
      }

      function setInfo(msg) {
        npMsg.style.color = "#666";
        npMsg.textContent = msg;
      }

      function validate() {
        const fullName = (npFullName.value || "").trim();
        if (!fullName) return { ok: false, msg: "Nome completo é obrigatório." };

        const sns = normalizeDigits(npSNS.value);
        const nif = normalizeDigits(npNIF.value);
        const pass = (npPassport.value || "").trim();

        if (sns && !/^[0-9]{9}$/.test(sns)) return { ok: false, msg: "SNS inválido: tem de ter 9 dígitos." };
        if (nif && !/^[0-9]{9}$/.test(nif)) return { ok: false, msg: "NIF inválido: tem de ter 9 dígitos." };
        if (pass && !/^[A-Za-z0-9]{4,20}$/.test(pass)) return { ok: false, msg: "Passaporte/ID inválido: 4–20 alfanum." };

        if (!sns && !nif && !pass) return { ok: false, msg: "Identificação obrigatória: SNS ou NIF ou Passaporte/ID." };

        return {
          ok: true,
          full_name: fullName,
          dob: npDob.value ? npDob.value : null,
          phone: npPhone.value ? npPhone.value.trim() : null,
          email: npEmail.value ? npEmail.value.trim() : null,
          sns: sns || null,
          nif: nif || null,
          passport_id: pass || null,
          insurance_provider: npInsuranceProvider.value ? npInsuranceProvider.value.trim() : null,
          insurance_policy_number: npInsurancePolicy.value ? npInsurancePolicy.value.trim() : null,
          address_line1: npAddress1.value ? npAddress1.value.trim() : null,
          postal_code: npPostal.value ? npPostal.value.trim() : null,
          city: npCity.value ? npCity.value.trim() : null,
          country: npCountry.value ? npCountry.value.trim() : "PT",
          notes: npNotes.value ? npNotes.value.trim() : null,
        };
      }

      function refreshButtonState() {
        if (npSNS) {
          const d = normalizeDigits(npSNS.value);
          if (npSNS.value !== d) npSNS.value = d;
        }
        if (npNIF) {
          const d = normalizeDigits(npNIF.value);
          if (npNIF.value !== d) npNIF.value = d;
        }

        const v = validate();
        if (!v.ok) {
          npCreate.disabled = true;
          setErr(v.msg);
        } else {
          npCreate.disabled = false;
          setInfo("OK para criar.");
        }
      }

      [
        npFullName, npDob, npPhone, npEmail, npSNS, npNIF, npPassport,
        npInsuranceProvider, npInsurancePolicy, npAddress1, npPostal, npCity, npCountry, npNotes,
      ].forEach((el) => {
        if (!el) return;
        el.addEventListener("input", refreshButtonState);
        el.addEventListener("change", refreshButtonState);
      });

      npCancel.addEventListener("click", () => {
        host.innerHTML = "";
      });

      npCreate.addEventListener("click", async () => {
        const v = validate();
        if (!v.ok) {
          setErr(v.msg);
          return;
        }

        npCreate.disabled = true;
        setInfo("A criar…");

        try {
          const payload = {
            p_clinic_id: clinicId,
            p_full_name: v.full_name,
            p_dob: v.dob,
            p_sex: null,
            p_phone: v.phone,
            p_email: v.email,
            p_external_id: null,
            p_notes: v.notes,

            p_sns: v.sns,
            p_nif: v.nif,
            p_passport_id: v.passport_id,
            p_address_line1: v.address_line1,
            p_postal_code: v.postal_code,
            p_city: v.city,
            p_country: v.country,
            p_insurance_provider: v.insurance_provider,
            p_insurance_policy_number: v.insurance_policy_number,
          };

          const newPatientId = await rpcCreatePatientForClinic(payload);

          if (!newPatientId) {
            setErr("Criado, mas não consegui obter o ID. Pesquisa pelo nome e seleciona.");
            npCreate.disabled = false;
            return;
          }

          mPatientId.value = newPatientId;
          mPatientName.value = v.full_name;
          mPatientSelected.textContent = v.full_name;
          updateTitleAuto();

          host.innerHTML = "";
        } catch (e) {
          console.error("Criar doente falhou:", e);
          setErr("Erro ao criar doente. Vê a consola.");
          npCreate.disabled = false;
        }
      });

      npCreate.disabled = true;
      setInfo("Preenche o Nome e um identificador (SNS/NIF/Passaporte).");
      refreshButtonState();
    }

    async function onSave() {
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
      const pid = mPatientId ? mPatientId.value || "" : "";
      const pname = mPatientName ? mPatientName.value || "" : "";
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
        status: mStatus && mStatus.value ? mStatus.value : "scheduled",
        procedure_type: proc ? proc : null,
        title: autoTitle,
        notes: mNotes && mNotes.value ? mNotes.value.trim() : null,
      };
      if (payload.notes === "") payload.notes = null;

      btnSave.disabled = true;
      mMsg.style.color = "#666";
      mMsg.textContent = "A guardar…";

      try {
        if (isEdit) {
          const { error } = await window.sb.from("appointments").update(payload).eq("id", row.id);
          if (error) throw error;
        } else {
          const { error } = await window.sb.from("appointments").insert(payload);
          if (error) throw error;
        }

        closeModal();
        await refreshAgenda();
      } catch (e) {
        console.error("Guardar marcação falhou:", e);
        mMsg.style.color = "#b00020";
        mMsg.textContent = "Erro ao guardar. Vê a consola.";
        btnSave.disabled = false;
      }
    }

    if (btnClose) btnClose.addEventListener("click", closeModal);
    if (btnCancel) btnCancel.addEventListener("click", closeModal);
    if (overlay) overlay.addEventListener("click", (ev) => { if (ev.target && ev.target.id === "modalOverlay") closeModal(); });

    if (mProc) mProc.addEventListener("change", updateProcOtherVisibility);
    if (mProcOther) mProcOther.addEventListener("input", updateTitleAuto);

    if (mClinic) {
      mClinic.addEventListener("change", () => {
        if (mPatientId) mPatientId.value = "";
        if (mPatientName) mPatientName.value = "";
        if (mPatientSelected) mPatientSelected.textContent = "—";
        if (mPatientResults) mPatientResults.innerHTML = `<div style="font-size:12px; color:#666;">Pesquisar para mostrar resultados.</div>`;
        const host = document.getElementById("newPatientHost");
        if (host) host.innerHTML = "";
        updateTitleAuto();
      });
    }

    if (mPatientQuery) mPatientQuery.addEventListener("input", scheduleSearch);
    if (btnNewPatient) btnNewPatient.addEventListener("click", openNewPatientForm);
    if (btnSave) btnSave.addEventListener("click", onSave);

    updateTitleAuto();
  }

  // ---------- Pesquisa rápida (main) ----------
  function setPQ(kind, msg) {
    const el = document.getElementById("pqMsg");
    if (!el) return;
    el.style.color = kind === "error" ? "#b00020" : "#666";
    el.textContent = msg;
  }

  function renderPQSelected() {
    const nameEl = document.getElementById("pqSelected");
    const metaEl = document.getElementById("pqSelectedMeta");
    const btn = document.getElementById("pqEdit");

    const p = G.patientQuick.selected;

    if (!p) {
      if (nameEl) nameEl.textContent = "—";
      if (metaEl) metaEl.textContent = "—";
      if (btn) btn.disabled = true;
      return;
    }

    const bits = [];
    if (p.sns) bits.push(`SNS:${p.sns}`);
    if (p.nif) bits.push(`NIF:${p.nif}`);
    if (p.passport_id) bits.push(`ID:${p.passport_id}`);
    if (p.phone) bits.push(`Tel:${p.phone}`);
    if (p.email) bits.push(`Email:${p.email}`);

    if (nameEl) nameEl.textContent = p.full_name || "—";
    if (metaEl) metaEl.textContent = bits.length ? bits.join(" • ") : "—";
    if (btn) btn.disabled = false;
  }

  async function wirePatientQuickSearch() {
    const input = document.getElementById("pqQuery");
    const btnClear = document.getElementById("pqClear");
    const res = document.getElementById("pqResults");
    const btnEdit = document.getElementById("pqEdit");
    const selClinic = document.getElementById("selClinic");

    if (!input || !res || !btnEdit) return;

    let t = null;

    function clear() {
      input.value = "";
      G.patientQuick.selected = null;
      renderPQSelected();
      res.innerHTML = `<div style="font-size:12px; color:#666;">Escreve para pesquisar.</div>`;
      setPQ("ok", "");
    }

    async function run() {
      const clinicId = selClinic ? selClinic.value || "" : "";
      const term = (input.value || "").trim();

      if (!term || term.length < 2) {
        res.innerHTML = `<div style="font-size:12px; color:#666;">Escreve pelo menos 2 caracteres.</div>`;
        setPQ("ok", "");
        return;
      }

      if (!clinicId) {
        res.innerHTML = `<div style="font-size:12px; color:#666;">Seleciona uma clínica para pesquisar.</div>`;
        setPQ("error", "Pesquisa rápida requer clínica selecionada (não “Todas”).");
        return;
      }

      setPQ("ok", "A pesquisar…");
      res.innerHTML = `<div style="font-size:12px; color:#666;">A pesquisar…</div>`;

      try {
        const pts = await searchPatientsSmart({ clinicId, q: term, limit: 20 });
        if (!pts.length) {
          res.innerHTML = `<div style="font-size:12px; color:#666;">Sem resultados.</div>`;
          setPQ("ok", "Sem resultados.");
          return;
        }

        res.innerHTML = pts.map((p) => {
          const idBits = [];
          if (p.sns) idBits.push(`SNS:${p.sns}`);
          if (p.nif) idBits.push(`NIF:${p.nif}`);
          if (p.passport_id) idBits.push(`ID:${p.passport_id}`);
          if (p.phone) idBits.push(`Tel:${p.phone}`);
          const idLine = idBits.length ? idBits.join(" / ") : "—";

          return `
            <div data-payload="${escapeHtml(JSON.stringify(p))}"
                 style="padding:10px; border:1px solid #f0f0f0; border-radius:12px; margin-bottom:10px; cursor:pointer;">
              <div style="font-size:13px; color:#111; font-weight:700;">${escapeHtml(p.full_name || "—")}</div>
              <div style="font-size:12px; color:#666; margin-top:4px;">${escapeHtml(idLine)}</div>
            </div>
          `;
        }).join("");

        res.querySelectorAll("[data-payload]").forEach((el) => {
          el.addEventListener("click", () => {
            const raw = el.getAttribute("data-payload");
            if (!raw) return;
            try {
              const p = JSON.parse(raw);
              G.patientQuick.selected = p;
              renderPQSelected();
              setPQ("ok", "Selecionado.");
            } catch {
              setPQ("error", "Falha ao selecionar (JSON inválido).");
            }
          });
        });

        setPQ("ok", `${pts.length} resultado(s).`);
      } catch (e) {
        console.error("Pesquisa rápida falhou:", e);
        res.innerHTML = `<div style="font-size:12px; color:#b00020;">Erro na pesquisa. Vê a consola.</div>`;
        setPQ("error", "Erro na pesquisa rápida. Vê a consola.");
      }
    }

    function schedule() {
      if (t) clearTimeout(t);
      t = setTimeout(run, 250);
    }

    input.addEventListener("input", schedule);
    if (btnClear) btnClear.addEventListener("click", clear);

    btnEdit.addEventListener("click", () => {
      const clinicId = selClinic ? selClinic.value || "" : "";
      const p = G.patientQuick.selected;
      if (!clinicId) {
        setPQ("error", "Seleciona uma clínica antes de editar.");
        return;
      }
      if (!p || !p.id) return;
      openEditPatientModal({ clinicId, patientId: p.id });
    });

    // reset quando muda clínica
    if (selClinic) {
      selClinic.addEventListener("change", () => {
        clear();
      });
    }

    // estado inicial
    clear();
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
    const clinicId = sel ? sel.value || null : null;

    const r = isoLocalDayRangeFromISODate(G.selectedDayISO);
    if (!r) {
      setAgendaStatus("error", "Dia inválido.");
      return;
    }

    setAgendaStatus("loading", "A carregar marcações…");

    try {
      const { data, timeColUsed } = await loadAppointmentsForRange({ clinicId, startISO: r.startISO, endISO: r.endISO });
      G.agenda.rows = data;
      G.agenda.timeColUsed = timeColUsed || "start_at";
      setAgendaStatus("ok", `OK: ${data.length} marcação(ões).`);
      renderAgendaList();
    } catch (e) {
      console.error("Agenda load falhou:", e);
      setAgendaStatus("error", "Erro ao carregar agenda. Vê a consola.");
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
      await wireLogout();

      try {
        G.role = await fetchMyRole(G.sessionUser.id);
      } catch {
        G.role = null;
      }
      try {
        G.clinics = await fetchVisibleClinics();
      } catch {
        G.clinics = [];
      }

      G.clinicsById = {};
      for (const c of G.clinics) G.clinicsById[c.id] = c;

      const hdrEmail = document.getElementById("hdrEmail");
      if (hdrEmail) hdrEmail.textContent = G.sessionUser.email || "—";

      const hdrRole = document.getElementById("hdrRole");
      if (hdrRole) hdrRole.textContent = G.role ? G.role : "—";

      const hdrClinicCount = document.getElementById("hdrClinicCount");
      if (hdrClinicCount) hdrClinicCount.textContent = String(G.clinics.length);

      renderClinicsSelect(G.clinics);

      setAgendaSubtitleForSelectedDay();

      const sel = document.getElementById("selClinic");
      if (sel) sel.addEventListener("change", refreshAgenda);

      const btnRefresh = document.getElementById("btnRefreshAgenda");
      if (btnRefresh) btnRefresh.addEventListener("click", refreshAgenda);

      const btnNew = document.getElementById("btnNewAppt");
      if (btnNew) btnNew.addEventListener("click", () => openApptModal({ mode: "new", row: null }));

      const btnCal = document.getElementById("btnCal");
      if (btnCal) btnCal.addEventListener("click", openCalendarOverlay);

      const btnToday = document.getElementById("btnToday");
      if (btnToday) {
        btnToday.addEventListener("click", async () => {
          G.selectedDayISO = fmtDateISO(new Date());
          setAgendaSubtitleForSelectedDay();
          await refreshAgenda();
        });
      }

      if (btnNew && G.role && !["doctor", "secretary"].includes(String(G.role).toLowerCase())) {
        btnNew.disabled = true;
        btnNew.title = "Sem permissão para criar marcações.";
      }

      // ✅ liga pesquisa rápida
      await wirePatientQuickSearch();

      await refreshAgenda();
    } catch (e) {
      console.error("Boot falhou:", e);
      document.body.textContent = "Erro ao iniciar a app. Abre a consola para detalhe.";
    }
  }

  boot();
})();
