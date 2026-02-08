/* =========================================================
   Gestão Clínica V2 — app.js (ficheiro completo)
   - Auth bootstrap + header + logout
   - Agenda por dia selecionado (default = hoje) + filtro por clínica (RLS)
   - Calendário mensal (overlay) para escolher dia
   - Modal marcação: doente obrigatório (pesquisa + novo doente via RPC)
   - ✅ Pesquisa rápida de doentes (Nome/SNS/NIF/Telefone/Passaporte)
   - ✅ Pesquisa no modal também por SNS/NIF/Telefone/Passaporte
   - ✅ Mostrar notas (appointments.notes) na lista da agenda
   - ✅ Agenda mostra Nome do doente + Telefone (patients)
   - ✅ Linha agenda: Hora | Doente | Tipo | Estado | Clínica | Telefone + Status editável
   - ✅ NOVO (FIX): Abrir doente com ecrã de detalhe + botão "Editar" + Guardar alterações (update patients)
   - ✅ MELHORIA (UI): letra maior + reorganização da linha da agenda (como pedido)
   ========================================================= */

(function () {
  "use strict";

  // ===== UI SCALE (apenas agenda + shell) =====
  const UI = {
    fs12: 13,
    fs13: 14,
    fs14: 15,
    fs16: 17,
  };

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
    // "YYYY-MM-DD" -> Date local at 00:00
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

  function clipOneLine(s, max = 90) {
    const t = String(s || "").replace(/\s+/g, " ").trim();
    if (!t) return "";
    if (t.length <= max) return t;
    return t.slice(0, max - 1) + "…";
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
  async function listPatientIdsForScope({ clinicId }) {
    let q = window.sb
      .from("patient_clinic")
      .select("patient_id, clinic_id")
      .eq("is_active", true)
      .limit(2000);

    if (clinicId) q = q.eq("clinic_id", clinicId);

    const { data, error } = await q;
    if (error) throw error;

    const ids = (data || []).map((r) => r.patient_id).filter(Boolean);
    return { ids, rows: data || [] };
  }

  function buildPatientOrFilter(termRaw) {
    const term = String(termRaw || "").trim();
    const digits = normalizeDigits(term);

    const parts = [];

    if (term.length >= 2) {
      const safe = term.replaceAll(",", " ");
      parts.push(`full_name.ilike.%${safe}%`);
      parts.push(`email.ilike.%${safe}%`);
      parts.push(`passport_id.ilike.%${safe}%`);
      parts.push(`external_id.ilike.%${safe}%`);
    }

    if (digits.length >= 3) {
      parts.push(`phone.ilike.%${digits}%`);
    }

    if (digits.length === 9) {
      parts.push(`sns.eq.${digits}`);
      parts.push(`nif.eq.${digits}`);
    }

    if (/^[A-Za-z0-9]{4,20}$/.test(term)) {
      const safe = term.replaceAll(",", " ");
      parts.push(`passport_id.eq.${safe}`);
    }

    const uniq = [];
    const seen = new Set();
    for (const p of parts) {
      if (!seen.has(p)) {
        seen.add(p);
        uniq.push(p);
      }
    }

    return uniq.join(",");
  }

  async function searchPatientsScoped({ clinicId, q, limit = 12 }) {
    const term = (q || "").trim();
    if (!term || term.length < 2) return [];

    const { ids } = await listPatientIdsForScope({ clinicId });
    if (ids.length === 0) return [];

    const orStr = buildPatientOrFilter(term);
    if (!orStr) return [];

    const { data: pts, error: pErr } = await window.sb
      .from("patients")
      .select("id, full_name, dob, phone, email, external_id, sns, nif, passport_id, insurance_provider, insurance_policy_number, address_line1, postal_code, city, country, notes")
      .in("id", ids)
      .eq("is_active", true)
      .or(orStr)
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

  // Carregar pacientes por IDs (para agenda mostrar Nome/Telefone)
  async function fetchPatientsByIds(patientIds) {
    const ids = Array.from(new Set((patientIds || []).filter(Boolean)));
    if (ids.length === 0) return {};

    const CHUNK = 150;
    const out = {};
    for (let i = 0; i < ids.length; i += CHUNK) {
      const part = ids.slice(i, i + CHUNK);
      const { data, error } = await window.sb
        .from("patients")
        .select("id, full_name, phone, email, sns, nif, passport_id")
        .in("id", part)
        .eq("is_active", true);

      if (error) throw error;
      for (const p of (data || [])) out[p.id] = p;
    }
    return out;
  }

  // ✅ NOVO: carregar 1 doente com campos completos (para editar)
  async function fetchPatientById(patientId) {
    if (!patientId) return null;
    const { data, error } = await window.sb
      .from("patients")
      .select("id, full_name, dob, phone, email, external_id, sns, nif, passport_id, insurance_provider, insurance_policy_number, address_line1, postal_code, city, country, notes, is_active")
      .eq("id", patientId)
      .limit(1);

    if (error) throw error;
    if (!data || data.length === 0) return null;
    return data[0];
  }

  // ✅ NOVO: update doente
  async function updatePatient(patientId, payload) {
    if (!patientId) throw new Error("patientId em falta");
    const { data, error } = await window.sb
      .from("patients")
      .update(payload)
      .eq("id", patientId)
      .select("id, full_name, dob, phone, email, external_id, sns, nif, passport_id, insurance_provider, insurance_policy_number, address_line1, postal_code, city, country, notes, is_active")
      .limit(1);

    if (error) throw error;
    if (!data || data.length === 0) return null;
    return data[0];
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
    patientsById: {},
    patientQuick: { lastResults: [], selected: null },
  };

  // ---------- Render shell ----------
  function renderAppShell() {
    document.body.innerHTML = `
      <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 16px; font-size:${UI.fs14}px;">
        <header style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding:12px 14px; border:1px solid #e5e5e5; border-radius:12px;">
          <div style="display:flex; flex-direction:column; gap:6px; min-width: 260px;">
            <div style="font-size:${UI.fs14}px; color:#111; font-weight:700;">Sessão ativa</div>
            <div style="font-size:${UI.fs12}px; color:#444;"><span style="color:#666;">Email:</span> <span id="hdrEmail">—</span></div>
            <div style="font-size:${UI.fs12}px; color:#444;"><span style="color:#666;">Role:</span> <span id="hdrRole">—</span></div>
            <div style="font-size:${UI.fs12}px; color:#444;"><span style="color:#666;">Clínicas:</span> <span id="hdrClinicCount">0</span></div>
          </div>

          <button id="btnLogout" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; background:#fff; cursor:pointer; font-size:${UI.fs13}px;">
            Logout
          </button>
        </header>

        <main style="margin-top:14px;">
          <section style="padding:12px 14px; border:1px solid #eee; border-radius:12px;">
            <div style="display:flex; align-items:flex-end; justify-content:space-between; gap:12px; flex-wrap:wrap;">
              <div>
                <div style="font-size:${UI.fs16}px; color:#111; font-weight:800;">Agenda</div>
                <div style="font-size:${UI.fs12}px; color:#666; margin-top:4px;" id="agendaSubtitle">—</div>
              </div>

              <div style="display:flex; gap:10px; align-items:flex-end; flex-wrap:wrap;">
                <button id="btnCal" title="Calendário" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; background:#fff; cursor:pointer; font-size:${UI.fs13}px;">
                  Calendário
                </button>

                <button id="btnToday" title="Voltar a hoje" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; background:#fff; cursor:pointer; font-size:${UI.fs13}px;">
                  Hoje
                </button>

                <div style="display:flex; flex-direction:column; gap:4px;">
                  <label for="selClinic" style="font-size:${UI.fs12}px; color:#666;">Clínica</label>
                  <select id="selClinic" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; background:#fff; min-width: 240px; font-size:${UI.fs13}px;"></select>
                </div>

                <button id="btnNewAppt" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; background:#fff; cursor:pointer; font-size:${UI.fs13}px;">
                  Nova marcação
                </button>

                <button id="btnRefreshAgenda" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; background:#fff; cursor:pointer; font-size:${UI.fs13}px;">
                  Atualizar
                </button>
              </div>
            </div>

            <div style="margin-top:12px; display:flex; gap:12px; align-items:flex-start; flex-wrap:wrap;">
              <div style="flex:1; min-width: 320px;">
                <div style="font-size:${UI.fs12}px; color:#666; margin-bottom:6px;">Pesquisa de doente (Nome / SNS / NIF / Telefone / Passaporte-ID)</div>
                <input id="pQuickQuery" type="text" placeholder="ex.: Man… | 916… | 123456789"
                  autocomplete="off" autocapitalize="off" spellcheck="false"
                  style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; width:100%; font-size:${UI.fs13}px;" />
                <div id="pQuickResults" style="margin-top:8px; border:1px solid #eee; border-radius:10px; padding:8px; background:#fff; max-height:180px; overflow:auto;">
                  <div style="font-size:${UI.fs12}px; color:#666;">Escreve para pesquisar.</div>
                </div>
              </div>

              <div style="width: 340px; min-width: 280px;">
                <div style="font-size:${UI.fs12}px; color:#666; margin-bottom:6px;">Selecionado</div>
                <div id="pQuickSelected" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; background:#fafafa; min-height: 42px; display:flex; align-items:center; color:#111; font-size:${UI.fs13}px;">
                  —
                </div>
                <div style="margin-top:8px; display:flex; gap:10px; flex-wrap:wrap;">
                  <button id="btnQuickOpen" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; background:#fff; cursor:pointer; font-size:${UI.fs13}px;">
                    Ver doente
                  </button>
                </div>
                <div id="pQuickMsg" style="margin-top:8px; font-size:${UI.fs12}px; color:#666;"></div>
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
    el.innerHTML = `<div style="font-size:${UI.fs12}px; color:${color};">${escapeHtml(text)}</div>`;
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

  function getPatientForAppointmentRow(apptRow) {
    const pid = apptRow && apptRow.patient_id ? apptRow.patient_id : null;
    if (!pid) return null;
    return G.patientsById && G.patientsById[pid] ? G.patientsById[pid] : null;
  }

  // ✅ Abrir doente: garante fetch completo antes de abrir modal (para poder editar)
  async function openPatientFeedFromAny(patientLike) {
    try {
      const pid = patientLike && patientLike.id ? patientLike.id : null;
      if (!pid) {
        alert("Doente inválido.");
        return;
      }
      const full = await fetchPatientById(pid);
      if (!full) {
        alert("Não consegui carregar o doente (RLS ou não existe).");
        return;
      }
      openPatientViewModal(full);
    } catch (e) {
      console.error("openPatientFeed falhou:", e);
      alert("Erro ao abrir doente. Vê a consola para detalhe.");
    }
  }

  async function updateAppointmentStatus(apptId, newStatus) {
    if (!apptId) return;
    const s = String(newStatus || "").trim();
    if (!s) return;

    const idx = (G.agenda.rows || []).findIndex((x) => x && x.id === apptId);
    if (idx >= 0) {
      G.agenda.rows[idx].status = s;
      renderAgendaList();
    }

    try {
      const { error } = await window.sb.from("appointments").update({ status: s }).eq("id", apptId);
      if (error) throw error;
    } catch (e) {
      console.error("Update status falhou:", e);
      await refreshAgenda();
      alert("Não foi possível atualizar o estado. Vê a consola para detalhe.");
    }
  }

  // ✅ MELHORIA: linha agenda na ordem pedida + letra maior
  function renderAgendaList() {
    const ul = document.getElementById("agendaList");
    if (!ul) return;

    const rows = G.agenda.rows || [];
    const timeColUsed = G.agenda.timeColUsed || "start_at";

    if (rows.length === 0) {
      ul.innerHTML = `<li style="padding:10px 0; font-size:${UI.fs12}px; color:#666;">Sem marcações para este dia.</li>`;
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

        const status = r.status ?? "scheduled";
        const proc = r.procedure_type ?? "—";
        const notes = r.notes ? clipOneLine(r.notes, 110) : "";

        const p = getPatientForAppointmentRow(r);
        const patientName = p && p.full_name ? p.full_name : (r.patient_id ? `Doente (ID): ${r.patient_id}` : "—");
        const patientPhone = p && p.phone ? p.phone : "—";

        return `
        <li data-appt-id="${escapeHtml(r.id)}" style="padding:10px 0; border-bottom:1px solid #f2f2f2;">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
            <div style="display:flex; gap:14px; align-items:center; flex-wrap:wrap;">
              <!-- hora -->
              <div style="font-size:${UI.fs16}px; font-weight:800; color:#111; min-width: 96px;">
                ${escapeHtml(tStart)}${tEnd ? `–${escapeHtml(tEnd)}` : ""}
              </div>

              <!-- doente -->
              <div style="min-width: 240px;">
                <span data-patient-open="1" style="font-size:${UI.fs14}px; color:#111; font-weight:800; cursor:pointer; text-decoration:underline;">
                  ${escapeHtml(patientName)}
                </span>
              </div>

              <!-- tipo -->
              <div style="min-width: 220px;">
                <div style="font-size:${UI.fs12}px; color:#666;">Tipo</div>
                <div style="font-size:${UI.fs13}px; color:#111; font-weight:600;">${escapeHtml(proc)}</div>
              </div>

              <!-- estado -->
              <div style="min-width: 180px;">
                <div style="font-size:${UI.fs12}px; color:#666;">Estado</div>
                <select data-status-select="1"
                        style="padding:9px 10px; border-radius:10px; border:1px solid #ddd; background:#fff; cursor:pointer; font-size:${UI.fs13}px;">
                  ${STATUS_OPTIONS.map((s) => `<option value="${escapeHtml(s)}"${s === status ? " selected" : ""}>${escapeHtml(s)}</option>`).join("")}
                </select>
              </div>

              <!-- clínica -->
              <div style="min-width: 160px;">
                <div style="font-size:${UI.fs12}px; color:#666;">Clínica</div>
                <div style="font-size:${UI.fs13}px; color:#111; font-weight:600;">${escapeHtml(clinicName)}</div>
              </div>

              <!-- telefone -->
              <div style="min-width: 160px;">
                <div style="font-size:${UI.fs12}px; color:#666;">Telefone</div>
                <div style="font-size:${UI.fs13}px; color:#111; font-weight:600;">${escapeHtml(patientPhone)}</div>
              </div>
            </div>
          </div>

          ${notes ? `<div style="margin-top:6px; font-size:${UI.fs12}px; color:#444;">Notas: ${escapeHtml(notes)}</div>` : ""}
        </li>
      `;
      })
      .join("");

    ul.querySelectorAll("li[data-appt-id]").forEach((li) => {
      li.addEventListener("click", (ev) => {
        const t = ev.target;
        if (t && (t.getAttribute("data-status-select") === "1" || (t.closest && t.closest("[data-status-select='1']")))) return;
        if (t && (t.getAttribute("data-patient-open") === "1" || (t.closest && t.closest("[data-patient-open='1']")))) return;

        const id = li.getAttribute("data-appt-id");
        const row = rows.find((x) => x.id === id);
        if (row) openApptModal({ mode: "edit", row });
      });

      const pLink = li.querySelector("[data-patient-open='1']");
      if (pLink) {
        pLink.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();

          const apptId = li.getAttribute("data-appt-id");
          const row = rows.find((x) => x.id === apptId);
          if (!row) return;

          if (!row.patient_id) {
            alert("Marcação sem patient_id.");
            return;
          }
          openPatientFeedFromAny({ id: row.patient_id });
        });
      }

      const sel = li.querySelector("select[data-status-select='1']");
      if (sel) {
        sel.addEventListener("click", (ev) => ev.stopPropagation());
        sel.addEventListener("change", async (ev) => {
          ev.stopPropagation();
          const apptId = li.getAttribute("data-appt-id");
          const v = sel.value;
          await updateAppointmentStatus(apptId, v);
        });
      }
    });
  }

  // ---------- Pesquisa rápida de doentes (main page) ----------
  function setQuickPatientMsg(kind, text) {
    const el = document.getElementById("pQuickMsg");
    if (!el) return;
    const color = kind === "error" ? "#b00020" : kind === "ok" ? "#111" : "#666";
    el.style.color = color;
    el.textContent = text || "";
  }

  function renderQuickPatientSelected() {
    const box = document.getElementById("pQuickSelected");
    if (!box) return;

    const p = G.patientQuick.selected;
    if (!p) {
      box.textContent = "—";
      return;
    }

    const idBits = [];
    if (p.sns) idBits.push(`SNS:${p.sns}`);
    if (p.nif) idBits.push(`NIF:${p.nif}`);
    if (p.passport_id) idBits.push(`ID:${p.passport_id}`);
    const phone = p.phone ? ` • Tel:${p.phone}` : "";
    const ids = idBits.length ? ` • ${idBits.join(" / ")}` : "";
    box.textContent = `${p.full_name}${ids}${phone}`;
  }

  function renderQuickPatientResults(results) {
    const host = document.getElementById("pQuickResults");
    if (!host) return;

    if (!results || results.length === 0) {
      host.innerHTML = `<div style="font-size:${UI.fs12}px; color:#666;">Sem resultados.</div>`;
      return;
    }

    host.innerHTML = results
      .map((p) => {
        const idBits = [];
        if (p.sns) idBits.push(`SNS:${p.sns}`);
        if (p.nif) idBits.push(`NIF:${p.nif}`);
        if (p.passport_id) idBits.push(`ID:${p.passport_id}`);
        const idLine = idBits.length ? idBits.join(" / ") : (p.external_id ? `Ext:${p.external_id}` : "");
        const phone = p.phone ? `Tel:${p.phone}` : "";
        const line2Parts = [idLine, phone].filter(Boolean).join(" • ");

        return `
          <div data-pid="${escapeHtml(p.id)}"
               style="padding:8px; border:1px solid #f0f0f0; border-radius:10px; margin-bottom:8px; cursor:pointer;">
            <div style="font-size:${UI.fs13}px; color:#111; font-weight:700;">${escapeHtml(p.full_name)}</div>
            <div style="font-size:${UI.fs12}px; color:#666;">${escapeHtml(line2Parts || "—")}</div>
          </div>
        `;
      })
      .join("");

    host.querySelectorAll("[data-pid]").forEach((el) => {
      el.addEventListener("click", () => {
        const pid = el.getAttribute("data-pid");
        const p = (results || []).find((x) => x.id === pid);
        if (!p) return;
        G.patientQuick.selected = p;
        renderQuickPatientSelected();
        setQuickPatientMsg("ok", "Doente selecionado.");
      });
    });
  }

  // ---------- Modal Doente (ver + editar) ----------
  function closeModalRoot() {
    const root = document.getElementById("modalRoot");
    if (root) root.innerHTML = "";
  }

  function validatePatientEdit(values) {
    const fullName = (values.full_name || "").trim();
    if (!fullName) return { ok: false, msg: "Nome completo é obrigatório." };

    const sns = normalizeDigits(values.sns);
    const nif = normalizeDigits(values.nif);
    const pass = (values.passport_id || "").trim();

    if (sns && !/^[0-9]{9}$/.test(sns)) return { ok: false, msg: "SNS inválido: tem de ter 9 dígitos." };
    if (nif && !/^[0-9]{9}$/.test(nif)) return { ok: false, msg: "NIF inválido: tem de ter 9 dígitos." };
    if (pass && !/^[A-Za-z0-9]{4,20}$/.test(pass)) return { ok: false, msg: "Passaporte/ID inválido: 4–20 alfanum." };

    // Mantém a regra: tem de existir pelo menos 1 identificador (SNS / NIF / Passaporte)
    if (!sns && !nif && !pass) return { ok: false, msg: "Identificação obrigatória: SNS ou NIF ou Passaporte/ID." };

    return {
      ok: true,
      cleaned: {
        full_name: fullName,
        dob: values.dob ? values.dob : null,
        phone: values.phone ? values.phone.trim() : null,
        email: values.email ? values.email.trim() : null,
        sns: sns || null,
        nif: nif || null,
        passport_id: pass || null,
        insurance_provider: values.insurance_provider ? values.insurance_provider.trim() : null,
        insurance_policy_number: values.insurance_policy_number ? values.insurance_policy_number.trim() : null,
        address_line1: values.address_line1 ? values.address_line1.trim() : null,
        postal_code: values.postal_code ? values.postal_code.trim() : null,
        city: values.city ? values.city.trim() : null,
        country: values.country ? values.country.trim() : "PT",
        notes: values.notes ? values.notes.trim() : null,
      },
    };
  }

  function openPatientViewModal(patient) {
    const root = document.getElementById("modalRoot");
    if (!root) return;

    const p = patient;
    if (!p) return;

    // estado local do modal
    let editMode = false;
    let working = false;

    function render() {
      const idBits = [];
      if (p.sns) idBits.push(`SNS: ${p.sns}`);
      if (p.nif) idBits.push(`NIF: ${p.nif}`);
      if (p.passport_id) idBits.push(`Passaporte/ID: ${p.passport_id}`);

      const topSubtitle = idBits.join(" • ") || "—";

      root.innerHTML = `
        <div id="pViewOverlay" style="position:fixed; inset:0; background:rgba(0,0,0,0.35); display:flex; align-items:center; justify-content:center; padding:18px;">
          <div style="background:#fff; width:min(920px, 100%); border-radius:14px; border:1px solid #e5e5e5; padding:14px; max-height: 86vh; overflow:auto;">
            <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start;">
              <div>
                <div style="font-size:${UI.fs14}px; font-weight:800; color:#111;">Doente</div>
                <div style="font-size:${UI.fs12}px; color:#666; margin-top:4px;">${escapeHtml(p.id)}</div>
                <div style="font-size:${UI.fs12}px; color:#666; margin-top:4px;">${escapeHtml(topSubtitle)}</div>
              </div>
              <div style="display:flex; gap:10px; flex-wrap:wrap;">
                <button id="btnToggleEdit" style="padding:8px 10px; border-radius:10px; border:1px solid #ddd; background:#fff; cursor:pointer; font-size:${UI.fs13}px;">
                  ${editMode ? "Cancelar edição" : "Editar doente"}
                </button>
                <button id="btnClosePView" style="padding:8px 10px; border-radius:10px; border:1px solid #ddd; background:#fff; cursor:pointer; font-size:${UI.fs13}px;">Fechar</button>
              </div>
            </div>

            <div style="margin-top:12px; display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
              <div style="grid-column: 1 / -1; padding:12px; border:1px solid #eee; border-radius:12px; background:#fafafa;">
                <div style="font-size:${UI.fs14}px; font-weight:900; color:#111;">
                  ${editMode ? `<input id="peFullName" type="text" value="${escapeHtml(p.full_name || "")}" style="width:100%; padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />`
                             : escapeHtml(p.full_name || "—")}
                </div>
              </div>

              <div style="padding:12px; border:1px solid #eee; border-radius:12px;">
                <div style="font-size:${UI.fs12}px; color:#666;">Data nascimento</div>
                <div style="margin-top:6px;">
                  ${editMode
                    ? `<input id="peDob" type="date" value="${escapeHtml(p.dob ? String(p.dob).slice(0,10) : "")}" style="width:100%; padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />`
                    : `<div style="font-size:${UI.fs13}px; color:#111; font-weight:700;">${escapeHtml(p.dob ? String(p.dob).slice(0,10) : "—")}</div>`}
                </div>
              </div>

              <div style="padding:12px; border:1px solid #eee; border-radius:12px;">
                <div style="font-size:${UI.fs12}px; color:#666;">Telefone</div>
                <div style="margin-top:6px;">
                  ${editMode
                    ? `<input id="pePhone" type="text" value="${escapeHtml(p.phone || "")}" style="width:100%; padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />`
                    : `<div style="font-size:${UI.fs13}px; color:#111; font-weight:700;">${escapeHtml(p.phone || "—")}</div>`}
                </div>
              </div>

              <div style="padding:12px; border:1px solid #eee; border-radius:12px;">
                <div style="font-size:${UI.fs12}px; color:#666;">Email</div>
                <div style="margin-top:6px;">
                  ${editMode
                    ? `<input id="peEmail" type="email" value="${escapeHtml(p.email || "")}" style="width:100%; padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />`
                    : `<div style="font-size:${UI.fs13}px; color:#111; font-weight:700;">${escapeHtml(p.email || "—")}</div>`}
                </div>
              </div>

              <div style="padding:12px; border:1px solid #eee; border-radius:12px;">
                <div style="font-size:${UI.fs12}px; color:#666;">SNS (9 dígitos)</div>
                <div style="margin-top:6px;">
                  ${editMode
                    ? `<input id="peSNS" type="text" inputmode="numeric" value="${escapeHtml(p.sns || "")}" style="width:100%; padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />`
                    : `<div style="font-size:${UI.fs13}px; color:#111; font-weight:700;">${escapeHtml(p.sns || "—")}</div>`}
                </div>
              </div>

              <div style="padding:12px; border:1px solid #eee; border-radius:12px;">
                <div style="font-size:${UI.fs12}px; color:#666;">NIF (9 dígitos)</div>
                <div style="margin-top:6px;">
                  ${editMode
                    ? `<input id="peNIF" type="text" inputmode="numeric" value="${escapeHtml(p.nif || "")}" style="width:100%; padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />`
                    : `<div style="font-size:${UI.fs13}px; color:#111; font-weight:700;">${escapeHtml(p.nif || "—")}</div>`}
                </div>
              </div>

              <div style="grid-column: 1 / -1; padding:12px; border:1px solid #eee; border-radius:12px;">
                <div style="font-size:${UI.fs12}px; color:#666;">Passaporte/ID</div>
                <div style="margin-top:6px;">
                  ${editMode
                    ? `<input id="pePassport" type="text" value="${escapeHtml(p.passport_id || "")}" style="width:100%; padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />`
                    : `<div style="font-size:${UI.fs13}px; color:#111; font-weight:700;">${escapeHtml(p.passport_id || "—")}</div>`}
                </div>
              </div>

              <div style="padding:12px; border:1px solid #eee; border-radius:12px;">
                <div style="font-size:${UI.fs12}px; color:#666;">Seguro</div>
                <div style="margin-top:6px;">
                  ${editMode
                    ? `<input id="peInsProv" type="text" value="${escapeHtml(p.insurance_provider || "")}" style="width:100%; padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />`
                    : `<div style="font-size:${UI.fs13}px; color:#111; font-weight:700;">${escapeHtml(p.insurance_provider || "—")}</div>`}
                </div>
              </div>

              <div style="padding:12px; border:1px solid #eee; border-radius:12px;">
                <div style="font-size:${UI.fs12}px; color:#666;">Apólice</div>
                <div style="margin-top:6px;">
                  ${editMode
                    ? `<input id="peInsPol" type="text" value="${escapeHtml(p.insurance_policy_number || "")}" style="width:100%; padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />`
                    : `<div style="font-size:${UI.fs13}px; color:#111; font-weight:700;">${escapeHtml(p.insurance_policy_number || "—")}</div>`}
                </div>
              </div>

              <div style="grid-column: 1 / -1; padding:12px; border:1px solid #eee; border-radius:12px;">
                <div style="font-size:${UI.fs12}px; color:#666;">Morada</div>
                <div style="margin-top:6px;">
                  ${editMode
                    ? `<input id="peAddr" type="text" value="${escapeHtml(p.address_line1 || "")}" style="width:100%; padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />`
                    : `<div style="font-size:${UI.fs13}px; color:#111; font-weight:700;">${escapeHtml(p.address_line1 || "—")}</div>`}
                </div>
              </div>

              <div style="padding:12px; border:1px solid #eee; border-radius:12px;">
                <div style="font-size:${UI.fs12}px; color:#666;">Código-postal</div>
                <div style="margin-top:6px;">
                  ${editMode
                    ? `<input id="pePostal" type="text" value="${escapeHtml(p.postal_code || "")}" style="width:100%; padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />`
                    : `<div style="font-size:${UI.fs13}px; color:#111; font-weight:700;">${escapeHtml(p.postal_code || "—")}</div>`}
                </div>
              </div>

              <div style="padding:12px; border:1px solid #eee; border-radius:12px;">
                <div style="font-size:${UI.fs12}px; color:#666;">Cidade</div>
                <div style="margin-top:6px;">
                  ${editMode
                    ? `<input id="peCity" type="text" value="${escapeHtml(p.city || "")}" style="width:100%; padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />`
                    : `<div style="font-size:${UI.fs13}px; color:#111; font-weight:700;">${escapeHtml(p.city || "—")}</div>`}
                </div>
              </div>

              <div style="grid-column: 1 / -1; padding:12px; border:1px solid #eee; border-radius:12px;">
                <div style="font-size:${UI.fs12}px; color:#666;">País</div>
                <div style="margin-top:6px;">
                  ${editMode
                    ? `<input id="peCountry" type="text" value="${escapeHtml(p.country || "PT")}" style="width:100%; padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />`
                    : `<div style="font-size:${UI.fs13}px; color:#111; font-weight:700;">${escapeHtml(p.country || "—")}</div>`}
                </div>
              </div>

              <div style="grid-column: 1 / -1; padding:12px; border:1px solid #eee; border-radius:12px;">
                <div style="font-size:${UI.fs12}px; color:#666;">Notas</div>
                <div style="margin-top:6px;">
                  ${editMode
                    ? `<textarea id="peNotes" rows="3" style="width:100%; padding:10px 12px; border-radius:10px; border:1px solid #ddd; resize:vertical; font-size:${UI.fs13}px;">${escapeHtml(p.notes || "")}</textarea>`
                    : `<div style="font-size:${UI.fs13}px; color:#111;">${escapeHtml(p.notes || "—")}</div>`}
                </div>
              </div>
            </div>

            <div style="margin-top:12px; display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
              <div id="peMsg" style="font-size:${UI.fs12}px; color:#666;"></div>
              <div style="display:flex; gap:10px; flex-wrap:wrap;">
                ${editMode ? `<button id="btnSavePatient" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; background:#fff; cursor:pointer; font-weight:700; font-size:${UI.fs13}px;">Guardar</button>` : ""}
              </div>
            </div>
          </div>
        </div>
      `;

      const overlay = document.getElementById("pViewOverlay");
      const btnClose = document.getElementById("btnClosePView");
      const btnToggle = document.getElementById("btnToggleEdit");
      const btnSave = document.getElementById("btnSavePatient");
      const msgEl = document.getElementById("peMsg");

      function setMsg(kind, txt) {
        if (!msgEl) return;
        msgEl.style.color = kind === "error" ? "#b00020" : kind === "ok" ? "#111" : "#666";
        msgEl.textContent = txt || "";
      }

      function close() {
        closeModalRoot();
      }

      if (btnClose) btnClose.addEventListener("click", close);
      if (overlay) overlay.addEventListener("click", (ev) => { if (ev.target && ev.target.id === "pViewOverlay") close(); });

      if (btnToggle) {
        btnToggle.addEventListener("click", () => {
          if (working) return;
          editMode = !editMode;
          render();
        });
      }

      if (btnSave) {
        btnSave.addEventListener("click", async () => {
          if (working) return;

          const vals = {
            full_name: document.getElementById("peFullName") ? document.getElementById("peFullName").value : "",
            dob: document.getElementById("peDob") ? document.getElementById("peDob").value : null,
            phone: document.getElementById("pePhone") ? document.getElementById("pePhone").value : null,
            email: document.getElementById("peEmail") ? document.getElementById("peEmail").value : null,
            sns: document.getElementById("peSNS") ? document.getElementById("peSNS").value : null,
            nif: document.getElementById("peNIF") ? document.getElementById("peNIF").value : null,
            passport_id: document.getElementById("pePassport") ? document.getElementById("pePassport").value : null,
            insurance_provider: document.getElementById("peInsProv") ? document.getElementById("peInsProv").value : null,
            insurance_policy_number: document.getElementById("peInsPol") ? document.getElementById("peInsPol").value : null,
            address_line1: document.getElementById("peAddr") ? document.getElementById("peAddr").value : null,
            postal_code: document.getElementById("pePostal") ? document.getElementById("pePostal").value : null,
            city: document.getElementById("peCity") ? document.getElementById("peCity").value : null,
            country: document.getElementById("peCountry") ? document.getElementById("peCountry").value : null,
            notes: document.getElementById("peNotes") ? document.getElementById("peNotes").value : null,
          };

          const snsEl = document.getElementById("peSNS");
          const nifEl = document.getElementById("peNIF");
          if (snsEl) snsEl.value = normalizeDigits(snsEl.value);
          if (nifEl) nifEl.value = normalizeDigits(nifEl.value);

          const v = validatePatientEdit(vals);
          if (!v.ok) {
            setMsg("error", v.msg);
            return;
          }

          working = true;
          setMsg("info", "A guardar…");

          try {
            const updated = await updatePatient(p.id, v.cleaned);
            if (!updated) throw new Error("Update sem retorno");

            Object.assign(p, updated);

            if (p.id) {
              G.patientsById[p.id] = Object.assign({}, (G.patientsById[p.id] || {}), {
                id: p.id,
                full_name: p.full_name,
                phone: p.phone,
                email: p.email,
                sns: p.sns,
                nif: p.nif,
                passport_id: p.passport_id,
              });
              if (G.patientQuick && G.patientQuick.selected && G.patientQuick.selected.id === p.id) {
                G.patientQuick.selected = Object.assign({}, G.patientQuick.selected, p);
                renderQuickPatientSelected();
              }
            }

            renderAgendaList();

            setMsg("ok", "Guardado.");
            editMode = false;
            render();
          } catch (e) {
            console.error("Guardar doente falhou:", e);
            const msg = String(e && (e.message || e.details || e.hint) ? (e.message || e.details || e.hint) : e);

            if (msg.includes("patients_sns_unique_not_null")) setMsg("error", "SNS já existe noutro doente.");
            else if (msg.includes("patients_nif_unique_not_null")) setMsg("error", "NIF já existe noutro doente.");
            else if (msg.includes("patients_passport_unique_not_null")) setMsg("error", "Passaporte/ID já existe noutro doente.");
            else if (msg.includes("patients_sns_format_check")) setMsg("error", "SNS inválido (9 dígitos).");
            else if (msg.includes("patients_nif_format_check")) setMsg("error", "NIF inválido (9 dígitos).");
            else if (msg.includes("patients_passport_format_check")) setMsg("error", "Passaporte/ID inválido (4–20 alfanum).");
            else if (msg.includes("patients_sns_or_nif_or_passport_check")) setMsg("error", "Identificação obrigatória: SNS/NIF/Passaporte.");
            else setMsg("error", "Erro ao guardar. Vê a consola.");
          } finally {
            working = false;
          }
        });
      }
    }

    render();
  }

  // ---------- Pesquisa rápida: wiring ----------
  async function wireQuickPatientSearch() {
    const input = document.getElementById("pQuickQuery");
    const resHost = document.getElementById("pQuickResults");
    const btnOpen = document.getElementById("btnQuickOpen");
    if (!input || !resHost || !btnOpen) return;

    let timer = null;

    async function run() {
      const term = (input.value || "").trim();
      if (!term || term.length < 2) {
        resHost.innerHTML = `<div style="font-size:${UI.fs12}px; color:#666;">Escreve para pesquisar.</div>`;
        setQuickPatientMsg("info", "");
        return;
      }

      const selClinic = document.getElementById("selClinic");
      const clinicId = selClinic && selClinic.value ? selClinic.value : null;

      resHost.innerHTML = `<div style="font-size:${UI.fs12}px; color:#666;">A pesquisar…</div>`;
      setQuickPatientMsg("info", "");

      try {
        const pts = await searchPatientsScoped({ clinicId, q: term, limit: 30 });
        G.patientQuick.lastResults = pts;
        renderQuickPatientResults(pts);

        if (pts.length === 0) setQuickPatientMsg("info", "Sem resultados.");
      } catch (e) {
        console.error("Pesquisa rápida de doente falhou:", e);
        resHost.innerHTML = `<div style="font-size:${UI.fs12}px; color:#b00020;">Erro na pesquisa. Vê a consola.</div>`;
        setQuickPatientMsg("error", "Erro na pesquisa.");
      }
    }

    function schedule() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(run, 250);
    }

    input.addEventListener("input", schedule);

    btnOpen.addEventListener("click", () => {
      if (!G.patientQuick.selected) {
        setQuickPatientMsg("error", "Seleciona um doente primeiro.");
        return;
      }
      openPatientFeedFromAny(G.patientQuick.selected);
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
            <button id="calPrev" style="padding:8px 10px; border-radius:10px; border:1px solid #ddd; background:#fff; cursor:pointer; font-size:${UI.fs13}px;">◀</button>
            <div style="font-size:${UI.fs14}px; font-weight:800; color:#111;" id="calTitle">${escapeHtml(monthLabel(G.calMonth))}</div>
            <button id="calNext" style="padding:8px 10px; border-radius:10px; border:1px solid #ddd; background:#fff; cursor:pointer; font-size:${UI.fs13}px;">▶</button>
          </div>

          <div style="margin-top:10px; display:grid; grid-template-columns: repeat(7, 1fr); gap:6px;">
            ${weekDays.map((w) => `<div style="font-size:${UI.fs12}px; color:#666; text-align:center; padding:6px 0;">${w}</div>`).join("")}
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
                return `<div data-iso="${iso}" style="${base}${bg} font-size:${UI.fs13}px;">${d.getDate()}</div>`;
              })
              .join("")}
          </div>

          <div style="margin-top:12px; display:flex; justify-content:space-between; gap:10px; align-items:center; flex-wrap:wrap;">
            <div style="font-size:${UI.fs12}px; color:#666;">Clique num dia para abrir a agenda desse dia.</div>
            <button id="calClose" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; background:#fff; cursor:pointer; font-size:${UI.fs13}px;">Fechar</button>
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

  // ---------- Modal marcação ----------
  function closeModal() {
    closeModalRoot();
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
    // (mantido igual ao teu ficheiro; sem alterações funcionais)
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
        <div style="background:#fff; width:min(860px, 100%); border-radius:14px; border:1px solid #e5e5e5; padding:14px; max-height: 86vh; overflow:auto;">
          <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start;">
            <div>
              <div style="font-size:${UI.fs14}px; font-weight:800; color:#111;">
                ${isEdit ? "Editar marcação" : "Nova marcação"}
              </div>
              <div style="font-size:${UI.fs12}px; color:#666; margin-top:4px;">
                Dia selecionado: ${escapeHtml(G.selectedDayISO)}. Doente é obrigatório.
              </div>
            </div>
            <button id="btnCloseModal" style="padding:8px 10px; border-radius:10px; border:1px solid #ddd; background:#fff; cursor:pointer; font-size:${UI.fs13}px;">Fechar</button>
          </div>

          <div style="margin-top:12px; display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:${UI.fs12}px; color:#666;">Clínica</label>
              <select id="mClinic" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; background:#fff; font-size:${UI.fs13}px;"></select>
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:${UI.fs12}px; color:#666;">Status</label>
              <select id="mStatus" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; background:#fff; font-size:${UI.fs13}px;">
                ${STATUS_OPTIONS.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("")}
              </select>
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:${UI.fs12}px; color:#666;">Início</label>
              <input id="mStart" type="datetime-local" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:${UI.fs12}px; color:#666;">Duração (min)</label>
              <select id="mDuration" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; background:#fff; font-size:${UI.fs13}px;">
                ${DURATION_OPTIONS.map((n) => `<option value="${n}">${n}</option>`).join("")}
              </select>
            </div>

            <div style="display:flex; flex-direction:column; gap:4px; grid-column: 1 / -1;">
              <label style="font-size:${UI.fs12}px; color:#666;">Doente (obrigatório)</label>

              <div style="display:grid; grid-template-columns: 1fr 320px; gap:12px; align-items:start;">
                <div style="display:flex; flex-direction:column; gap:6px;">
                  <input id="mPatientQuery" type="text"
                    placeholder="Pesquisar por nome / SNS / NIF / telefone / Passaporte-ID (mín. 2 letras)…"
                    autocomplete="off" autocapitalize="off" spellcheck="false"
                    style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; width:100%; font-size:${UI.fs13}px;" />
                  <div id="mPatientResults" style="border:1px solid #eee; border-radius:10px; padding:8px; max-height:180px; overflow:auto; background:#fff;">
                    <div style="font-size:${UI.fs12}px; color:#666;">Pesquisar para mostrar resultados.</div>
                  </div>
                </div>

                <div style="display:flex; flex-direction:column; gap:6px;">
                  <div style="font-size:${UI.fs12}px; color:#666;">Selecionado</div>
                  <div id="mPatientSelected" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; min-height: 42px; display:flex; align-items:center; color:#111; font-size:${UI.fs13}px;">
                    —
                  </div>
                  <div style="display:flex; gap:10px; flex-wrap:wrap;">
                    <button id="btnNewPatient" style="flex:1; padding:10px 12px; border-radius:10px; border:1px solid #ddd; background:#fff; cursor:pointer; font-size:${UI.fs13}px;">
                      Novo doente
                    </button>
                  </div>
                </div>
              </div>

              <input type="hidden" id="mPatientId" value="" />
              <input type="hidden" id="mPatientName" value="" />

              <div id="newPatientHost" style="margin-top:10px;"></div>
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:${UI.fs12}px; color:#666;">Tipo de consulta</label>
              <select id="mProc" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; background:#fff; font-size:${UI.fs13}px;">
                <option value="">—</option>
                ${PROCEDURE_OPTIONS.map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("")}
              </select>
            </div>

            <div id="mProcOtherWrap" style="display:none; flex-direction:column; gap:4px;">
              <label style="font-size:${UI.fs12}px; color:#666;">Outro (texto)</label>
              <input id="mProcOther" type="text" placeholder="ex.: Ondas de choque" autocomplete="off" autocapitalize="off" spellcheck="false"
                style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
            </div>

            <div style="grid-column: 1 / -1; display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:${UI.fs12}px; color:#666;">Título (automático)</label>
              <input id="mTitleAuto" type="text" disabled style="padding:10px 12px; border-radius:10px; border:1px solid #eee; background:#fafafa; font-size:${UI.fs13}px;" />
            </div>

            <div style="grid-column: 1 / -1; display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:${UI.fs12}px; color:#666;">Notas</label>
              <textarea id="mNotes" rows="3" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; resize:vertical; font-size:${UI.fs13}px;"></textarea>
            </div>
          </div>

          <div style="margin-top:12px; display:flex; justify-content:space-between; gap:12px; align-items:center; flex-wrap:wrap;">
            <div id="mMsg" style="font-size:${UI.fs12}px; color:#666;"></div>
            <div style="display:flex; gap:10px;">
              <button id="btnCancel" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; background:#fff; cursor:pointer; font-size:${UI.fs13}px;">Cancelar</button>
              <button id="btnSave" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; background:#fff; cursor:pointer; font-weight:800; font-size:${UI.fs13}px;">
                ${isEdit ? "Guardar alterações" : "Criar marcação"}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // --- wiring original (sem alterações de lógica) ---
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

    let searchTimer = null;

    async function runSearch() {
      const clinicId = mClinic ? mClinic.value : "";
      const term = mPatientQuery ? mPatientQuery.value : "";
      if (!clinicId) {
        mPatientResults.innerHTML = `<div style="font-size:${UI.fs12}px; color:#666;">Seleciona a clínica para pesquisar doentes.</div>`;
        return;
      }
      if (!term || term.trim().length < 2) {
        mPatientResults.innerHTML = `<div style="font-size:${UI.fs12}px; color:#666;">Escreve pelo menos 2 caracteres.</div>`;
        return;
      }

      mPatientResults.innerHTML = `<div style="font-size:${UI.fs12}px; color:#666;">A pesquisar…</div>`;
      try {
        const pts = await searchPatientsScoped({ clinicId, q: term, limit: 20 });
        if (pts.length === 0) {
          mPatientResults.innerHTML = `<div style="font-size:${UI.fs12}px; color:#666;">Sem resultados.</div>`;
          return;
        }

        mPatientResults.innerHTML = pts
          .map((p) => {
            const idBits = [];
            if (p.sns) idBits.push(`SNS:${p.sns}`);
            if (p.nif) idBits.push(`NIF:${p.nif}`);
            if (p.passport_id) idBits.push(`ID:${p.passport_id}`);
            const phone = p.phone ? `Tel:${p.phone}` : "";
            const idLine = [idBits.join(" / "), phone].filter(Boolean).join(" • ");

            return `
            <div data-pid="${escapeHtml(p.id)}" data-pname="${escapeHtml(p.full_name)}"
                 style="padding:8px; border:1px solid #f0f0f0; border-radius:10px; margin-bottom:8px; cursor:pointer;">
              <div style="font-size:${UI.fs13}px; color:#111; font-weight:700;">${escapeHtml(p.full_name)}</div>
              <div style="font-size:${UI.fs12}px; color:#666;">${escapeHtml(idLine || "—")}</div>
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
        mPatientResults.innerHTML = `<div style="font-size:${UI.fs12}px; color:#b00020;">Erro na pesquisa. Vê a consola.</div>`;
      }
    }

    function scheduleSearch() {
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(runSearch, 250);
    }

    function openNewPatientForm() {
      // (mantido igual ao teu ficheiro)
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

      host.innerHTML = `
        <div id="subNewPatient" style="border:1px solid #eee; border-radius:12px; padding:12px; background:#fafafa;">
          <div style="font-size:${UI.fs13}px; font-weight:800; color:#111;">Novo doente</div>
          <div style="font-size:${UI.fs12}px; color:#666; margin-top:4px;">
            Nome obrigatório. Identificação: SNS (9 dígitos) ou NIF (9 dígitos) ou Passaporte/ID (4–20 alfanum).
          </div>

          <div style="margin-top:10px; display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:${UI.fs12}px; color:#666;">Nome completo *</label>
              <input id="npFullName" type="text" autocomplete="off" autocapitalize="off" spellcheck="false"
                style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:${UI.fs12}px; color:#666;">Data nascimento</label>
              <input id="npDob" type="date" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:${UI.fs12}px; color:#666;">Telefone</label>
              <input id="npPhone" type="text" autocomplete="off" autocapitalize="off" spellcheck="false"
                style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:${UI.fs12}px; color:#666;">Email</label>
              <input id="npEmail" type="email" autocomplete="off" autocapitalize="off" spellcheck="false"
                style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:${UI.fs12}px; color:#666;">SNS (9 dígitos)</label>
              <input id="npSNS" type="text" inputmode="numeric" placeholder="#########" autocomplete="off"
                style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:${UI.fs12}px; color:#666;">NIF (9 dígitos)</label>
              <input id="npNIF" type="text" inputmode="numeric" placeholder="#########" autocomplete="off"
                style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:${UI.fs12}px; color:#666;">Passaporte/ID (4–20)</label>
              <input id="npPassport" type="text" placeholder="AB123456" autocomplete="off" autocapitalize="off" spellcheck="false"
                style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:${UI.fs12}px; color:#666;">Seguro</label>
              <input id="npInsuranceProvider" type="text" autocomplete="off" autocapitalize="off" spellcheck="false"
                style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:${UI.fs12}px; color:#666;">Apólice</label>
              <input id="npInsurancePolicy" type="text" autocomplete="off" autocapitalize="off" spellcheck="false"
                style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
            </div>

            <div style="grid-column: 1 / -1; display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:${UI.fs12}px; color:#666;">Morada</label>
              <input id="npAddress1" type="text" autocomplete="off" autocapitalize="off" spellcheck="false"
                style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:${UI.fs12}px; color:#666;">Código-postal</label>
              <input id="npPostal" type="text" autocomplete="off" autocapitalize="off" spellcheck="false"
                style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:${UI.fs12}px; color:#666;">Cidade</label>
              <input id="npCity" type="text" autocomplete="off" autocapitalize="off" spellcheck="false"
                style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:${UI.fs12}px; color:#666;">País</label>
              <input id="npCountry" type="text" value="PT" autocomplete="off" autocapitalize="off" spellcheck="false"
                style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
            </div>

            <div style="grid-column: 1 / -1; display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:${UI.fs12}px; color:#666;">Notas</label>
              <textarea id="npNotes" rows="2" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; resize:vertical; font-size:${UI.fs13}px;"></textarea>
            </div>
          </div>

          <div style="margin-top:10px; display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
            <div id="npMsg" style="font-size:${UI.fs12}px; color:#666;"></div>
            <div style="display:flex; gap:10px;">
              <button id="npCancel" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; background:#fff; cursor:pointer; font-size:${UI.fs13}px;">Fechar</button>
              <button id="npCreate" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; background:#fff; cursor:pointer; font-weight:800; font-size:${UI.fs13}px;">Criar doente</button>
            </div>
          </div>
        </div>
      `;

      // wiring igual ao teu ficheiro (sem alterações)
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
          const msg = String(e && (e.message || e.details || e.hint) ? (e.message || e.details || e.hint) : e);

          if (msg.includes("patients_sns_unique_not_null")) setErr("SNS já existe noutro doente.");
          else if (msg.includes("patients_nif_unique_not_null")) setErr("NIF já existe noutro doente.");
          else if (msg.includes("patients_passport_unique_not_null")) setErr("Passaporte/ID já existe noutro doente.");
          else if (msg.includes("patients_sns_format_check")) setErr("SNS inválido (9 dígitos).");
          else if (msg.includes("patients_nif_format_check")) setErr("NIF inválido (9 dígitos).");
          else if (msg.includes("patients_passport_format_check")) setErr("Passaporte/ID inválido (4–20 alfanum).");
          else if (msg.includes("patients_sns_or_nif_or_passport_check")) setErr("Identificação obrigatória: SNS/NIF/Passaporte.");
          else setErr("Erro ao criar doente. Vê a consola.");

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
        const pidEl = document.getElementById("mPatientId");
        const pnEl = document.getElementById("mPatientName");
        const selEl = document.getElementById("mPatientSelected");
        const resEl = document.getElementById("mPatientResults");
        const host = document.getElementById("newPatientHost");

        if (pidEl) pidEl.value = "";
        if (pnEl) pnEl.value = "";
        if (selEl) selEl.textContent = "—";
        if (resEl) resEl.innerHTML = `<div style="font-size:${UI.fs12}px; color:#666;">Pesquisar para mostrar resultados.</div>`;
        if (host) host.innerHTML = "";

        updateTitleAuto();
      });
    }

    if (mPatientQuery) mPatientQuery.addEventListener("input", scheduleSearch);
    if (btnNewPatient) btnNewPatient.addEventListener("click", openNewPatientForm);
    if (btnSave) btnSave.addEventListener("click", onSave);

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

      const patientIds = (data || []).map((x) => x && x.patient_id).filter(Boolean);
      try {
        G.patientsById = await fetchPatientsByIds(patientIds);
      } catch (e) {
        console.error("Falha ao carregar pacientes para agenda:", e);
        G.patientsById = {};
      }

      G.agenda.rows = data;
      G.agenda.timeColUsed = timeColUsed || "start_at";
      setAgendaStatus("ok", `OK: ${data.length} marcação(ões).`);
      renderAgendaList();
    } catch (e) {
      console.error("Agenda load falhou:", e);
      setAgendaStatus("error", "Erro ao carregar agenda. Vê a consola.");
      G.agenda.rows = [];
      G.patientsById = {};
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

      await wireQuickPatientSearch();

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

      await refreshAgenda();
    } catch (e) {
      console.error("Boot falhou:", e);
      document.body.textContent = "Erro ao iniciar a app. Abre a consola para detalhe.";
    }
  }

  boot();
})();
