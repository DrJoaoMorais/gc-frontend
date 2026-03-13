/* ========================================================
   doente.js — Módulo ES6
   Blocos 06 e 07 do app.js original
   --------------------------------------------------------
   06A — Stub (mantido; não usado)
   06B — Bootstrap + State + Helpers base
   06C — Identificação do doente
   06D — Diagnósticos
   06E — Tratamentos
   06Fa — Documentos/PDF (config + helpers + load + clinic + template)
   06Fb — Documentos/PDF (editor + bind)
   06Fc — Documentos/PDF (storage + generate + exports)
   06G  — Timeline (load + render + physio_records)
   06H  — Consulta médica (UI HDA + Quill + Spellcheck)
   06I  — saveConsult (insert + upsert ligações + reset)
   06J  — Render + Wiring + Boot
   07A  — openNewPatientMainModal (abertura e render)
   07B  — Estado local e fecho
   07C  — Validação
   07D  — Estado do botão / feedback
   07E  — Criação do doente
   ======================================================== */

import { UI } from "./config.js";
import { G } from "./state.js";
import {
  calcAgeYears,
  isBirthdayOnDate,
  fmtDatePt,
  fmtTime,
  normalizeDigits,
  closeModalRoot,
  ensurePatientActiveInClinic,
  rpcCreatePatientForClinic,
} from "./helpers.js";

/* ==== INÍCIO BLOCO 06A/12 — Stub (mantido; não usado) ==== */
function openPatientViewModal__stub(patient) {
  const root = document.getElementById("modalRoot");
  if (!root || !patient) return;
  const p = patient;

  let activeClinicId = null;

  function role() { return String(G.role || "").toLowerCase(); }
  function isDoctor() { return role() === "doctor"; }

  async function fetchActiveClinic() {
    const { data, error } = await window.sb
      .from("patient_clinic")
      .select("clinic_id")
      .eq("patient_id", p.id)
      .eq("is_active", true)
      .limit(1);

    if (error) { console.error(error); activeClinicId = null; return; }
    activeClinicId = data && data.length ? data[0].clinic_id : null;
  }

  fetchActiveClinic().then(() => { renderFeed(); });

  function renderFeed() {}
  function openConsultForm() {}
  async function saveConsult() {}
}
/* ==== FIM BLOCO 06A/12 ==== */


/* ==== INÍCIO BLOCO 06B/12 — Bootstrap + State + Helpers base ==== */
function openPatientViewModal(patient) {

  console.log("06B openPatientViewModal OK", patient);

  const root = document.getElementById("modalRoot");
  if (!root || !patient) return;

  const p = patient;

  /* ================= STATE ================= */
  let activeClinicId = null;
  let activeClinicName = "";

  let creatingConsult = false;
  let editingConsultId = null;
  let editingConsultRow = null;

  let timelineLoading = false;
  let consultRows = [];
  let saving = false;

  let lastSavedConsultId = null;
  let draftHDAHtml = "";

  // ---- Identificação ----
  let identOpen = false;
  let identMode = "view";
  let identSaving = false;
  let identDraft = {};

  // ---- Diagnóstico ----
  let diagQuery = "";
  let diagLoading = false;
  let diagResults = [];
  let selectedDiag = [];
  let diagDebounceT = null;

  // ---- Tratamentos ----
  let prescriptionText = "R/ 20 Sessões de Tratamentos de Medicina Fisica e de Reabilitação com:";
  let treatQuery = "";
  let treatLoading = false;
  let treatResults = [];
  let selectedTreat = [];
  let treatDebounceT = null;

  // ---- Documentos/PDF ----
  let docOpen = false;
  let docMode = "visual";
  let docSaving = false;
  let docDraftHtml = "";
  let docTitle = "Relatório Médico";
  let docsLoading = false;
  let docRows = [];

  /* ================= ROLE ================= */
  function role() { return String(G.role || "").toLowerCase(); }
  function isDoctor() { return role() === "doctor"; }

  /* ================= SAFE CLOSE ================= */
  const closeModalSafe = () => {
    try {
      if (typeof closeModalRoot === "function") return closeModalRoot();
    } catch (e) {}
    try { root.innerHTML = ""; } catch (e2) {}
  };

  /* ================= DATA: Clínica ativa ================= */
  async function fetchActiveClinic() {
    const { data, error } = await window.sb
      .from("patient_clinic")
      .select("clinic_id")
      .eq("patient_id", p.id)
      .eq("is_active", true)
      .limit(1);

    if (error) {
      console.error(error);
      activeClinicId = null;
      activeClinicName = "";
      return;
    }

    activeClinicId = data && data.length ? data[0].clinic_id : null;
    activeClinicName = "";

    if (activeClinicId) {
      try {
        const { data: c, error: cErr } = await window.sb
          .from("clinics")
          .select("name")
          .eq("id", activeClinicId)
          .single();

        if (cErr) console.error(cErr);
        activeClinicName = (c && c.name) ? String(c.name) : "";
      } catch (e) {
        console.error(e);
        activeClinicName = "";
      }
    }
  }

  function getTreatOrderFromPlan(planText) {
    try {
      const o = JSON.parse(planText || "");
      const arr = o && Array.isArray(o.treat_order) ? o.treat_order : null;
      return arr && arr.length ? arr.map(String) : null;
    } catch (e) {
      return null;
    }
  }

  function getPrescriptionTextFromPlan(planText) {
    try {
      const o = JSON.parse(planText || "");
      const t = o && typeof o.prescriptionText === "string" ? o.prescriptionText : "";
      return t || "";
    } catch (e) {
      return "";
    }
  }

  /* ================= SANITIZE/ESC ================= */
  function sanitizeHTML(html) {
    try {
      const allowed = new Set(["B","STRONG","U","BR","P","DIV","UL","OL","LI"]);
      const doc = new DOMParser().parseFromString(String(html || ""), "text/html");

      doc.querySelectorAll("script,style").forEach(n => n.remove());

      const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT, null);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);

      nodes.forEach(el => {
        [...el.attributes].forEach(a => el.removeAttribute(a.name));
        if (!allowed.has(el.tagName)) {
          const text = doc.createTextNode(el.textContent || "");
          el.replaceWith(text);
        }
      });

      return doc.body.innerHTML || "";
    } catch (e) {
      console.error(e);
      return String(html || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
    }
  }

  function escAttr(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  /* ================= CABEÇALHO ================= */
  function ageTextToday() {
    try {
      const age = calcAgeYears ? calcAgeYears(p.dob, new Date()) : null;
      if (age === null || age === undefined) return "—";
      return `${age} anos`;
    } catch (e) { return "—"; }
  }

  function birthdayBadgeToday() {
    try {
      const isBday = isBirthdayOnDate ? isBirthdayOnDate(p.dob, new Date()) : false;
      return isBday ? `<span title="Faz anos hoje" style="margin-left:8px;">🎂</span>` : ``;
    } catch (e) { return ``; }
  }
/* ==== FIM BLOCO 06B/12 ==== */


/* ==== INÍCIO BLOCO 06C/12 — Identificação do doente ==== */

  function openPatientIdentity(mode) {
    identMode = mode === "edit" ? "edit" : "view";
    identOpen = true;
    identSaving = false;

    identDraft = {
      full_name: p.full_name || "",
      dob: p.dob || "",
      phone: p.phone || "",
      email: p.email || "",
      sns: p.sns || "",
      nif: p.nif || "",
      passport_id: p.passport_id || "",
      address_line1: p.address_line1 || "",
      postal_code: p.postal_code || "",
      city: p.city || "",
      country: p.country || "",
      insurance_provider: p.insurance_provider || "",
      insurance_policy_number: p.insurance_policy_number || "",
      notes: p.notes || "",
      active_clinic_id: activeClinicId || ""
    };

    render();
    bindIdentityEvents();
  }

  function closeIdentity() {
    identOpen = false;
    identSaving = false;
    render();
  }

  function renderIdentityModal() {
    const ro = (identMode !== "edit") ? "readonly" : "";
    const dis = (identMode !== "edit") ? "disabled" : "";
    const canEdit = (identMode === "edit");
    const canManageClinic = role() === "doctor" || role() === "superadmin";
    const canOpenEdit = canManageClinic;
    const visibleClinics = Array.isArray(G.clinics) ? G.clinics : [];
    const currentClinicId = String(identDraft.active_clinic_id || activeClinicId || "");
    const currentClinicName = activeClinicName || "—";

    return `
      <div id="identOverlay"
           style="position:fixed; inset:0; background:rgba(0,0,0,0.35);
                  display:flex; align-items:center; justify-content:center; padding:12px; z-index:2000;">
        <div style="background:#fff; width:min(980px,96vw);
                    max-height:92vh; overflow:auto;
                    border-radius:14px; border:1px solid #e5e5e5; padding:16px;">

          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
            <div style="font-weight:900; font-size:16px;">
              Identificação do doente ${canEdit ? "(editar)" : "(ver)"}
            </div>

            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              ${!canEdit && canOpenEdit ? `
                <button id="btnIdentEditTop" class="gcBtn" style="font-weight:900;">Editar</button>
              ` : ``}
              <button id="btnIdentCloseTop" class="gcBtn">Fechar</button>
            </div>
          </div>

          <div style="margin-top:12px; padding:12px; border:1px solid #e5e7eb; border-radius:12px; background:#f8fafc;">
            <div style="font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; color:#64748b; margin-bottom:8px;">
              Clínica ativa
            </div>

            ${canManageClinic && canEdit ? `
              <select id="id_active_clinic"
                      style="width:100%; padding:10px; border:1px solid #ddd; border-radius:10px; background:#fff;">
                <option value="">Selecionar clínica…</option>
                ${visibleClinics.map((c) => `
                  <option value="${escAttr(c.id)}" ${String(c.id) === currentClinicId ? "selected" : ""}>
                    ${escAttr(c.name || c.slug || c.id)}
                  </option>
                `).join("")}
              </select>
              <div style="margin-top:6px; font-size:12px; color:#64748b;">
                A alteração da clínica ativa será gravada com a identificação.
              </div>
            ` : `
              <div style="padding:10px 12px; border:1px solid #ddd; border-radius:10px; background:#fff; color:#111827;">
                ${escAttr(currentClinicName)}
              </div>
            `}
          </div>

          <div style="margin-top:12px; display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div>
              <label>Nome completo</label>
              <input id="id_full_name" ${ro} value="${escAttr(identDraft.full_name)}"
                     style="width:100%; padding:10px; border:1px solid #ddd; border-radius:10px;" />
            </div>
            <div>
              <label>Data de nascimento</label>
              <input id="id_dob" type="date" ${ro} value="${escAttr(identDraft.dob)}"
                     style="width:100%; padding:10px; border:1px solid #ddd; border-radius:10px;" />
            </div>

            <div>
              <label>Telefone</label>
              <input id="id_phone" ${ro} value="${escAttr(identDraft.phone)}"
                     style="width:100%; padding:10px; border:1px solid #ddd; border-radius:10px;" />
            </div>
            <div>
              <label>Email</label>
              <input id="id_email" ${ro} value="${escAttr(identDraft.email)}"
                     style="width:100%; padding:10px; border:1px solid #ddd; border-radius:10px;" />
            </div>

            <div>
              <label>SNS</label>
              <input id="id_sns" ${ro} value="${escAttr(identDraft.sns)}"
                     style="width:100%; padding:10px; border:1px solid #ddd; border-radius:10px;" />
            </div>
            <div>
              <label>NIF</label>
              <input id="id_nif" ${ro} value="${escAttr(identDraft.nif)}"
                     style="width:100%; padding:10px; border:1px solid #ddd; border-radius:10px;" />
            </div>

            <div>
              <label>Passaporte</label>
              <input id="id_passport_id" ${ro} value="${escAttr(identDraft.passport_id)}"
                     style="width:100%; padding:10px; border:1px solid #ddd; border-radius:10px;" />
            </div>
            <div>
              <label>Seguradora</label>
              <input id="id_insurance_provider" ${ro} value="${escAttr(identDraft.insurance_provider)}"
                     style="width:100%; padding:10px; border:1px solid #ddd; border-radius:10px;" />
            </div>

            <div>
              <label>Nº apólice</label>
              <input id="id_insurance_policy_number" ${ro} value="${escAttr(identDraft.insurance_policy_number)}"
                     style="width:100%; padding:10px; border:1px solid #ddd; border-radius:10px;" />
            </div>

            <div style="grid-column:1 / -1;">
              <label>Morada</label>
              <input id="id_address_line1" ${ro} value="${escAttr(identDraft.address_line1)}"
                     style="width:100%; padding:10px; border:1px solid #ddd; border-radius:10px;" />
            </div>

            <div>
              <label>Código postal</label>
              <input id="id_postal_code" ${ro} value="${escAttr(identDraft.postal_code)}"
                     style="width:100%; padding:10px; border:1px solid #ddd; border-radius:10px;" />
            </div>
            <div>
              <label>Cidade</label>
              <input id="id_city" ${ro} value="${escAttr(identDraft.city)}"
                     style="width:100%; padding:10px; border:1px solid #ddd; border-radius:10px;" />
            </div>

            <div>
              <label>País</label>
              <input id="id_country" ${ro} value="${escAttr(identDraft.country)}"
                     style="width:100%; padding:10px; border:1px solid #ddd; border-radius:10px;" />
            </div>

            <div style="grid-column:1 / -1;">
              <label>Notas</label>
              <textarea id="id_notes" ${ro}
                        style="width:100%; min-height:90px; padding:10px; border:1px solid #ddd; border-radius:10px;">${escAttr(identDraft.notes)}</textarea>
            </div>
          </div>

          <div style="margin-top:12px; display:flex; justify-content:space-between; align-items:center; gap:10px;">
            <div id="identStatus" style="color:#64748b;">
              ${identSaving ? "A gravar..." : ""}
            </div>

            <div style="display:flex; gap:10px;">
              <button id="btnIdentClose" class="gcBtn">Cancelar</button>
              <button id="btnIdentSave" class="gcBtn" style="font-weight:900;" ${dis}>
                Gravar
              </button>
            </div>
          </div>

        </div>
      </div>
    `;
  }

  function bindIdentityEvents() {
    const closeTop = document.getElementById("btnIdentCloseTop");
    if (closeTop) closeTop.onclick = () => closeIdentity();

    const btnEditTop = document.getElementById("btnIdentEditTop");
    if (btnEditTop) {
      btnEditTop.onclick = () => openPatientIdentity("edit");
    }

    const btnClose = document.getElementById("btnIdentClose");
    if (btnClose) btnClose.onclick = () => closeIdentity();

    if (!identOpen) return;

    function bindVal(id, key) {
      const el = document.getElementById(id);
      if (!el) return;
      el.oninput = (e) => { identDraft[key] = e?.target?.value ?? ""; };
    }

    bindVal("id_full_name", "full_name");
    bindVal("id_dob", "dob");
    bindVal("id_phone", "phone");
    bindVal("id_email", "email");
    bindVal("id_sns", "sns");
    bindVal("id_nif", "nif");
    bindVal("id_passport_id", "passport_id");
    bindVal("id_address_line1", "address_line1");
    bindVal("id_postal_code", "postal_code");
    bindVal("id_city", "city");
    bindVal("id_country", "country");
    bindVal("id_insurance_provider", "insurance_provider");
    bindVal("id_insurance_policy_number", "insurance_policy_number");
    bindVal("id_notes", "notes");

    const selClinic = document.getElementById("id_active_clinic");
    if (selClinic) {
      selClinic.onchange = (e) => {
        identDraft.active_clinic_id = e?.target?.value ?? "";
      };
    }

    const btnSave = document.getElementById("btnIdentSave");
    if (btnSave) {
      btnSave.disabled = identSaving || identMode !== "edit";
      btnSave.onclick = async () => {
        if (identSaving || identMode !== "edit") return;

        const name = String(identDraft.full_name || "").trim();
        if (!name) { alert("Nome completo é obrigatório."); return; }

        const canManageClinic = role() === "doctor" || role() === "superadmin";
        const nextClinicId = String(identDraft.active_clinic_id || "").trim();
        const currentClinicId = String(activeClinicId || "").trim();
        const clinicChanged = !!(canManageClinic && nextClinicId && nextClinicId !== currentClinicId);

        identSaving = true;
        render();
        bindIdentityEvents();

        try {
          const payload = {
            full_name: name,
            dob: identDraft.dob ? identDraft.dob : null,
            phone: String(identDraft.phone || "").trim() || null,
            email: String(identDraft.email || "").trim() || null,
            sns: String(identDraft.sns || "").trim() || null,
            nif: String(identDraft.nif || "").trim() || null,
            passport_id: String(identDraft.passport_id || "").trim() || null,
            address_line1: String(identDraft.address_line1 || "").trim() || null,
            postal_code: String(identDraft.postal_code || "").trim() || null,
            city: String(identDraft.city || "").trim() || null,
            country: String(identDraft.country || "").trim() || null,
            insurance_provider: String(identDraft.insurance_provider || "").trim() || null,
            insurance_policy_number: String(identDraft.insurance_policy_number || "").trim() || null,
            notes: String(identDraft.notes || "").trim() || null
          };

          const { data, error } = await window.sb
            .from("patients")
            .update(payload)
            .eq("id", p.id)
            .select("*")
            .single();

          if (error) {
            console.error(error);
            alert("Erro a gravar Identificação.");
            identSaving = false;
            render();
            bindIdentityEvents();
            return;
          }

          if (data) Object.keys(payload).forEach(k => { p[k] = data[k]; });

          if (clinicChanged) {
            await ensurePatientActiveInClinic({
              patientId: p.id,
              targetClinicId: nextClinicId
            });

            await fetchActiveClinic();
            identDraft.active_clinic_id = activeClinicId || nextClinicId || "";
          }

          identSaving = false;
          identOpen = false;
          render();

        } catch (e) {
          console.error(e);
          alert("Erro a gravar Identificação.");
          identSaving = false;
          render();
          bindIdentityEvents();
        }
      };
    }
  }
/* ==== FIM BLOCO 06C/12 ==== */


/* ==== INÍCIO BLOCO 06D/12 — Diagnósticos ==== */

  let diagAddOpen = false;
  let diagAddSaving = false;
  let diagAddErr = "";
  let diagAddSystem = "local";
  let diagAddCode = "";
  let diagAddLabel = "";

  function ensureDiagAddHost() {
    let host = document.getElementById("diagAddModalHost");
    if (!host) {
      host = document.createElement("div");
      host.id = "diagAddModalHost";
      document.body.appendChild(host);
    }
    return host;
  }

  function openDiagAddModal(prefillLabel = "", prefillCode = "") {
    diagAddErr = "";
    diagAddSystem = "local";
    diagAddLabel = String(prefillLabel || "").trim();
    diagAddCode = String(prefillCode || "").trim();
    diagAddOpen = true;
    diagAddSaving = false;
    renderDiagAddModal();
    setTimeout(() => {
      document.getElementById("diagAddLabel")?.focus();
    }, 0);
  }

  function closeDiagAddModal() {
    diagAddOpen = false;
    diagAddSaving = false;
    diagAddErr = "";
    renderDiagAddModal();
  }

  function renderDiagAddModal() {
    const host = ensureDiagAddHost();
    if (!diagAddOpen) {
      host.innerHTML = "";
      return;
    }

    host.innerHTML = `
      <div style="position:fixed; inset:0; z-index:9999; background:rgba(15,23,42,0.45);
                  display:flex; align-items:center; justify-content:center; padding:16px;">
        <div style="width: min(720px, 96vw); background:#fff; border:1px solid #e5e5e5; border-radius:16px;
                    box-shadow:0 18px 44px rgba(0,0,0,0.18); overflow:hidden;">
          <div style="padding:14px 16px; border-bottom:1px solid #f1f5f9; display:flex; align-items:center; justify-content:space-between;">
            <div style="font-weight:900;">Adicionar diagnóstico ao catálogo</div>
            <button id="diagAddClose" class="gcBtn" style="padding:8px 10px; border-radius:10px;">Fechar</button>
          </div>

          <div style="padding:16px;">
            ${diagAddErr ? `<div style="margin-bottom:10px; padding:10px 12px; border:1px solid #fecaca; background:#fff1f2; color:#991b1b; border-radius:12px;">
              ${escAttr(diagAddErr)}
            </div>` : ``}

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
              <div>
                <div style="font-size:12px; color:#64748b; margin-bottom:6px;">Sistema</div>
                <input id="diagAddSystem" value="${escAttr(diagAddSystem)}"
                       class="gcInput" style="width:100%;" />
                <div style="font-size:11px; color:#94a3b8; margin-top:6px;">Ex.: local</div>
              </div>
              <div>
                <div style="font-size:12px; color:#64748b; margin-bottom:6px;">Código</div>
                <input id="diagAddCode" value="${escAttr(diagAddCode)}"
                       class="gcInput" style="width:100%;" />
                <div style="font-size:11px; color:#94a3b8; margin-top:6px;">Obrigatório (podes usar um código interno)</div>
              </div>
            </div>

            <div style="margin-top:10px;">
              <div style="font-size:12px; color:#64748b; margin-bottom:6px;">Designação</div>
              <input id="diagAddLabel" value="${escAttr(diagAddLabel)}"
                     class="gcInput" style="width:100%;" />
            </div>

            <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:14px;">
              <button id="diagAddCancel" class="gcBtn" style="padding:10px 12px; border-radius:12px;">Cancelar</button>
              <button id="diagAddSave" class="gcBtnPrimary" style="padding:10px 12px; border-radius:12px; min-width:140px;">
                ${diagAddSaving ? "A gravar…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById("diagAddClose")?.addEventListener("click", (ev) => { ev.preventDefault(); closeDiagAddModal(); });
    document.getElementById("diagAddCancel")?.addEventListener("click", (ev) => { ev.preventDefault(); closeDiagAddModal(); });

    document.getElementById("diagAddSave")?.addEventListener("click", async (ev) => {
      ev.preventDefault();
      await saveDiagToCatalog();
    });

    ["diagAddSystem","diagAddCode","diagAddLabel"].forEach(id => {
      document.getElementById(id)?.addEventListener("keydown", async (e) => {
        if (e.key === "Enter" && !diagAddSaving) {
          e.preventDefault();
          await saveDiagToCatalog();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          closeDiagAddModal();
        }
      });
    });
  }

  async function saveDiagToCatalog() {
    if (diagAddSaving) return;

    const sys = String(document.getElementById("diagAddSystem")?.value || "").trim();
    const code = String(document.getElementById("diagAddCode")?.value || "").trim();
    const label = String(document.getElementById("diagAddLabel")?.value || "").trim();

    if (!sys) { diagAddErr = "Sistema obrigatório."; renderDiagAddModal(); return; }
    if (!code) { diagAddErr = "Código obrigatório."; renderDiagAddModal(); return; }
    if (!label) { diagAddErr = "Designação obrigatória."; renderDiagAddModal(); return; }

    diagAddSaving = true;
    diagAddErr = "";
    renderDiagAddModal();

    try {
      const { data, error } = await window.sb.rpc("add_diagnosis_catalog", {
        p_system: sys,
        p_code: code,
        p_label: label,
        p_is_active: true
      });

      if (error) {
        const msg = String(error.message || error.details || error.hint || "Erro ao adicionar diagnóstico.");
        diagAddErr = msg;
        diagAddSaving = false;
        renderDiagAddModal();
        return;
      }

      const row = data || null;
      if (row && row.id) {
        addDiagnosis({ id: row.id, code: row.code || code, label: row.label || label });
      }

      closeDiagAddModal();
      diagQuery = "";
      diagResults = [];
      const inp = document.getElementById("diagSearch");
      if (inp) inp.value = "";
      renderDiagArea();
      inp?.focus();

    } catch (e) {
      console.error(e);
      diagAddErr = "Erro inesperado ao adicionar diagnóstico.";
      diagAddSaving = false;
      renderDiagAddModal();
    }
  }

  function renderDiagArea() {
    const chips = document.getElementById("diagChips");
    if (chips) {
      if (!selectedDiag.length) {
        chips.innerHTML = `<div style="margin-top:8px; color:#64748b;">Sem diagnósticos selecionados.</div>`;
      } else {
        chips.innerHTML = `
          <div style="margin-top:10px; display:flex; flex-wrap:wrap; gap:8px;">
            ${selectedDiag.map(x => `
              <div style="display:inline-flex; align-items:center; gap:8px;
                          padding:8px 10px; border:1px solid #e5e5e5; border-radius:999px;">
                <div style="font-size:14px;">
                  ${escAttr(x.label || "—")}
                  ${x.code ? `<span style="color:#64748b; font-size:12px; margin-left:6px;">${escAttr(x.code)}</span>` : ``}
                </div>
                <button class="diagRemove gcBtn" data-id="${x.id}"
                        style="padding:6px 10px; border-radius:999px;">×</button>
              </div>
            `).join("")}
          </div>
        `;
      }
    }

    const st = document.getElementById("diagStatus");
    if (st) st.innerHTML = diagLoading ? `<div style="margin-top:6px; color:#64748b;">A pesquisar…</div>` : "";

    const dd = document.getElementById("diagDropdownHost");
    if (dd) {
      const clean = String(diagQuery || "").trim();
      const canAdd = (!diagLoading && clean.length >= 2);
      const hasResults = (!diagLoading && diagResults && diagResults.length);

      if (hasResults || canAdd) {
        dd.innerHTML = `
          <div id="diagDropdown"
               style="position:absolute; z-index:50; left:0; right:0;
                      max-width:720px; margin-top:6px; background:#fff;
                      border:1px solid #e5e5e5; border-radius:12px;
                      box-shadow:0 10px 24px rgba(0,0,0,0.08);
                      max-height:260px; overflow:auto;">
            ${hasResults ? diagResults.map(x => `
              <div class="diagPick" data-id="${x.id}"
                   style="padding:10px 12px; border-bottom:1px solid #f1f5f9; cursor:pointer;">
                <div style="font-weight:800;">${escAttr(x.label || "—")}</div>
                ${x.code ? `<div style="color:#64748b; font-size:12px;">${escAttr(x.code)}</div>` : ``}
              </div>
            `).join("") : ``}

            ${canAdd ? `
              <div class="diagAddNew"
                   data-label="${escAttr(clean)}"
                   style="padding:10px 12px; cursor:pointer; background:#f8fafc; border-top:1px solid #e2e8f0;">
                <div style="font-weight:900;">Não encontro → Adicionar ao catálogo</div>
                <div style="color:#64748b; font-size:12px; margin-top:2px;">
                  ${escAttr(clean)}
                </div>
              </div>
            ` : ``}
          </div>
        `;
      } else {
        dd.innerHTML = "";
      }
    }

    document.querySelectorAll(".diagPick").forEach(el => {
      el.onclick = () => {
        const id = el.getAttribute("data-id");
        const item = (diagResults || []).find(x => String(x.id) === String(id));
        addDiagnosis(item);
      };
    });

    document.querySelectorAll(".diagRemove").forEach(el => {
      el.onclick = (ev) => {
        ev.preventDefault();
        const id = el.getAttribute("data-id");
        removeDiagnosis(id);
      };
    });

    document.querySelectorAll(".diagAddNew").forEach(el => {
      el.onclick = (ev) => {
        ev.preventDefault();
        const label = String(el.getAttribute("data-label") || "").trim();
        openDiagAddModal(label, "");
      };
    });
  }

  async function searchDiagnoses(q) {
    const query = String(q || "");
    diagQuery = query;

    const clean = query.trim();
    if (!clean || clean.length < 2) {
      diagLoading = false;
      diagResults = [];
      renderDiagArea();
      return;
    }

    diagLoading = true;
    renderDiagArea();

    const needle = clean.toLowerCase();

    const { data, error } = await window.sb
      .from("diagnoses_catalog")
      .select("id, code, label")
      .eq("is_active", true)
      .ilike("search_text", `%${needle}%`)
      .order("label", { ascending: true })
      .limit(15);

    if (error) {
      console.error(error);
      diagLoading = false;
      diagResults = [];
      renderDiagArea();
      return;
    }

    const rows = (data || []).map(r => ({ id: r.id, code: r.code || "", label: r.label || "" }));
    const sel = new Set(selectedDiag.map(x => String(x.id)));
    diagResults = rows.filter(x => !sel.has(String(x.id)));

    diagLoading = false;
    renderDiagArea();
  }

  function addDiagnosis(item) {
    if (!item || !item.id) return;
    if (selectedDiag.some(x => String(x.id) === String(item.id))) return;

    selectedDiag.push({ id: item.id, code: item.code || "", label: item.label || "" });

    const inp = document.getElementById("diagSearch");
    diagQuery = "";
    diagResults = [];
    if (inp) inp.value = "";

    renderDiagArea();
    inp?.focus();
  }

  function removeDiagnosis(id) {
    selectedDiag = selectedDiag.filter(x => String(x.id) !== String(id));
    renderDiagArea();
  }
/* ==== FIM BLOCO 06D/12 ==== */


/* ==== INÍCIO BLOCO 06E/12 — Tratamentos ==== */

  function sentenceizeLabel(s) {
    const raw = String(s || "").trim();
    if (!raw) return "";
    let t = raw.toLowerCase();
    t = t.replace(/\s+/g, " ");
    t = t.replace(/(^|[.!?]\s+)([a-zà-ÿ])/g, (m, p1, p2) => p1 + p2.toUpperCase());
    t = t.replace(/^([a-zà-ÿ])/, (m, c) => c.toUpperCase());
    return t;
  }

  function normTreatRow(t) {
    return {
      id: t.id,
      label: sentenceizeLabel(t.label || t.name || t.title || ""),
      code: t.code || t.adse_code || t.proc_code || "",
    };
  }

  async function fetchTreatmentsDefault() {
    try {
      treatLoading = true;
      renderTreatArea();

      let res = await window.sb
        .from("treatments_catalog")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("label", { ascending: true })
        .limit(200);

      if (res?.error) {
        res = await window.sb
          .from("treatments_catalog")
          .select("*")
          .order("sort_order", { ascending: true, nullsFirst: false })
          .order("label", { ascending: true })
          .limit(200);
      }

      const rows = (res?.data || []).map(normTreatRow);
      const sel = new Set(selectedTreat.map(x => String(x.id)));
      treatResults = rows.filter(x => !sel.has(String(x.id)));

      treatLoading = false;
      renderTreatArea();
    } catch (e) {
      console.error(e);
      treatLoading = false;
      treatResults = [];
      renderTreatArea();
    }
  }

  async function searchTreatments(q) {
    const query = String(q || "");
    treatQuery = query;

    const clean = query.trim();
    if (!clean || clean.length < 2) {
      await fetchTreatmentsDefault();
      return;
    }

    treatLoading = true;
    renderTreatArea();

    const needle = clean.toLowerCase();
    let data = null, error = null;

    try {
      const r1 = await window.sb
        .from("treatments_catalog")
        .select("*")
        .eq("is_active", true)
        .ilike("search_text", `%${needle}%`)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("label", { ascending: true })
        .limit(200);

      data = r1.data;
      error = r1.error;
      if (error) throw error;
    } catch (e) {
      try {
        const r2 = await window.sb
          .from("treatments_catalog")
          .select("*")
          .ilike("label", `%${needle}%`)
          .order("sort_order", { ascending: true, nullsFirst: false })
          .order("label", { ascending: true })
          .limit(200);

        data = r2.data;
        error = r2.error;
      } catch (e2) {
        error = e2;
      }
    }

    if (error) {
      console.error(error);
      treatLoading = false;
      treatResults = [];
      renderTreatArea();
      return;
    }

    const rows = (data || []).map(normTreatRow);
    const sel = new Set(selectedTreat.map(x => String(x.id)));
    treatResults = rows.filter(x => !sel.has(String(x.id)));

    treatLoading = false;
    renderTreatArea();
  }

  function addTreatment(item) {
    if (!item || !item.id) return;
    if (selectedTreat.some(x => String(x.id) === String(item.id))) return;

    selectedTreat.push({ id: item.id, code: item.code || "", label: item.label || "", qty: 1 });
    treatResults = (treatResults || []).filter(x => String(x.id) !== String(item.id));
    renderTreatArea();
  }

  function removeTreatment(id) {
    const rem = selectedTreat.find(x => String(x.id) === String(id));
    selectedTreat = selectedTreat.filter(x => String(x.id) !== String(id));

    if (rem) {
      treatResults = [{ id: rem.id, label: rem.label || "", code: rem.code || "" }, ...(treatResults || [])];
      const seen = new Set();
      treatResults = (treatResults || []).filter(x => {
        const k = String(x.id);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    }

    renderTreatArea();
  }

  function renderTreatArea() {
    const boxSel = document.getElementById("treatSelectedBox");
    const boxCat = document.getElementById("treatCatalogBox");
    const st = document.getElementById("treatStatus");

    if (st) st.innerHTML = treatLoading ? `<div style="margin-top:6px; color:#64748b;">A carregar…</div>` : "";

    if (boxSel) {
      if (!selectedTreat.length) {
        boxSel.innerHTML = `<div style="color:#64748b;">Sem tratamentos selecionados.</div>`;
      } else {
        boxSel.innerHTML = `
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${selectedTreat.map(x => `
              <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;
                          padding:10px 12px; border:1px solid #e5e5e5; border-radius:12px;">
                <div style="display:flex; flex-direction:column;">
                  <div style="font-weight:900;">${escAttr(x.label || "—")}</div>
                  ${x.code ? `<div style="color:#64748b; font-size:12px;">${escAttr(x.code)}</div>` : ``}
                </div>
                <button class="treatRemove gcBtn" data-id="${x.id}"
                        style="padding:6px 10px; border-radius:999px;">×</button>
              </div>
            `).join("")}
          </div>
        `;
      }
    }

    if (boxCat) {
      if (!treatResults || !treatResults.length) {
        boxCat.innerHTML = `<div style="color:#64748b;">Sem resultados.</div>`;
      } else {
        boxCat.innerHTML = `
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${treatResults.map(x => `
              <div class="treatPick" data-id="${x.id}"
                   style="padding:10px 12px; border:1px solid #e5e5e5; border-radius:12px; cursor:pointer;">
                <div style="font-weight:900;">${escAttr(x.label || "—")}</div>
                ${x.code ? `<div style="color:#64748b; font-size:12px;">${escAttr(x.code)}</div>` : ``}
              </div>
            `).join("")}
          </div>
        `;
      }
    }

    document.querySelectorAll(".treatPick").forEach(el => {
      el.onclick = () => {
        const id = el.getAttribute("data-id");
        const item = (treatResults || []).find(x => String(x.id) === String(id));
        addTreatment(item);
      };
    });

    document.querySelectorAll(".treatRemove").forEach(el => {
      el.onclick = (ev) => {
        ev.preventDefault();
        const id = el.getAttribute("data-id");
        removeTreatment(id);
      };
    });
  }
/* ==== FIM BLOCO 06E/12 ==== */


/* ==== INÍCIO BLOCO 06Fa/12 — Documentos/PDF (CONFIG + HELPERS + LOAD + CLINIC + TEMPLATE) ==== */

  const PDF_PROXY_URL = "https://gc-pdf-proxy.dr-joao-morais.workers.dev/pdf";
  const VINHETA_BUCKET = "clinic-private";
  const VINHETA_PATH = "vinheta/vinheta_web.png";
  const SIGNATURE_PATH = "signatures/signature_dr_joao_morais.png";

  let docForceRebuildOnce = false;

  function safeText(s) {
    return String(s || "")
      .trim()
      .replace(/[^\p{L}\p{N}\s._-]+/gu, "")
      .replace(/\s+/g, " ")
      .slice(0, 80) || "Relatorio";
  }

  async function storageSignedUrl(bucket, path, expiresSec = 3600) {
    try {
      if (!bucket || !path) return "";
      const s = await window.sb.storage.from(bucket).createSignedUrl(path, expiresSec);
      return s?.data?.signedUrl ? String(s.data.signedUrl) : "";
    } catch (e) {
      console.warn("storageSignedUrl error:", e);
      return "";
    }
  }

  async function urlToDataUrl(url, fallbackMime = "image/png") {
    try {
      if (!url) return "";
      const res = await fetch(url, { method: "GET", cache: "no-store" });
      if (!res.ok) throw new Error(`urlToDataUrl fetch ${res.status}`);
      const blob = await res.blob();

      const mime = blob.type && String(blob.type).includes("/") ? blob.type : fallbackMime;

      const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result || ""));
        r.onerror = reject;
        r.readAsDataURL(blob);
      });

      if (dataUrl && dataUrl.startsWith("data:application/octet-stream")) {
        return dataUrl.replace("data:application/octet-stream", `data:${mime}`);
      }
      return dataUrl;
    } catch (e) {
      console.warn("urlToDataUrl error:", e);
      return "";
    }
  }

  async function renderPdfViaProxy(html) {
    const res = await fetch(PDF_PROXY_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ html: String(html || "") })
    });

    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      throw new Error(`Proxy error ${res.status}: ${msg || "sem detalhe"}`);
    }

    const buf = await res.arrayBuffer();
    return new Blob([buf], { type: "application/pdf" });
  }

  async function loadDocuments() {
    docsLoading = true;
    docRows = [];

    try {
      const { data, error } = await window.sb
        .from("documents")
        .select("id, created_at, title, consultation_id, clinic_id, version, storage_path")
        .eq("patient_id", p.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("loadDocuments error:", error);
        docsLoading = false;
        return;
      }

      const rows = data || [];
      const out = [];

      for (const r of rows) {
        let url = "";
        const path = r.storage_path || "";
        if (path) {
          try {
            const s = await window.sb.storage.from("documents").createSignedUrl(path, 60 * 60);
            if (s?.data?.signedUrl) url = s.data.signedUrl;
          } catch (e) {}
        }

        out.push({
          id: r.id,
          created_at: r.created_at,
          title: r.title || "Documento",
          consultation_id: r.consultation_id || null,
          clinic_id: r.clinic_id || null,
          storage_path: path,
          url,
          version: (r.version !== undefined && r.version !== null) ? r.version : null
        });
      }

      docRows = out;
      docsLoading = false;
    } catch (e) {
      console.error("loadDocuments exception:", e);
      docsLoading = false;
    }
  }

  async function fetchClinicForPdf() {
    try {
      let clinicId = "";

      if (typeof activeClinicId !== "undefined" && activeClinicId) {
        clinicId = activeClinicId;
      }

      if (!clinicId && typeof p !== "undefined" && p?.clinic_id) {
        clinicId = p.clinic_id;
      }

      if (!clinicId) {
        console.warn("fetchClinicForPdf: sem clinicId");
        return null;
      }

      const { data, error } = await window.sb
        .from("clinics")
        .select("id, name, address_line1, address_line2, postal_code, city, phone, email, website, logo_url")
        .eq("id", clinicId)
        .single();

      if (error) {
        console.error("fetchClinicForPdf error:", error);
        return null;
      }

      return data || null;

    } catch (e) {
      console.error("fetchClinicForPdf exception:", e);
      return null;
    }
  }

  async function fetchCurrentUserDisplayName(userId) {
    try {
      const { data, error } = await window.sb
        .from("clinic_members")
        .select("display_name")
        .eq("user_id", userId)
        .limit(1);

      if (error) { console.error("fetchCurrentUserDisplayName error:", error); return ""; }
      const v = data && data.length ? (data[0].display_name || "") : "";
      return v;
    } catch (e) {
      console.error("fetchCurrentUserDisplayName exception:", e);
      return "";
    }
  }

  function fmtDobPt(d) {
    try {
      if (!d) return "—";
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return String(d);
      const dd = String(dt.getDate()).padStart(2, "0");
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      const yy = dt.getFullYear();
      return `${dd}-${mm}-${yy}`;
    } catch (e) { return String(d || "—"); }
  }

  function patientAddressCompact() {
    const a = String(p.address_line1 || "").trim();
    const pc = String(p.postal_code || "").trim();
    const city = String(p.city || "").trim();

    let tail = "";
    if (pc && city) tail = `${pc} ${city}`;
    else if (pc) tail = pc;
    else if (city) tail = city;

    const parts = [];
    if (a) parts.push(a);
    if (tail) parts.push(tail);

    return parts.join(", ") || "—";
  }

  function buildDocV1Html({ clinic, consult, authorName, vinhetaUrl, clinicLogoUrl, signatureUrl }) {

    function escUrlAttr(u) {
      return String(u || "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }

    function fmtDatePt(d) {
      try {
        if (!d) return "";
        const dt = new Date(d);
        if (isNaN(dt.getTime())) return String(d);
        const dd = String(dt.getDate()).padStart(2, "0");
        const mm = String(dt.getMonth() + 1).padStart(2, "0");
        const yy = dt.getFullYear();
        return `${dd}-${mm}-${yy}`;
      } catch (_) { return String(d || ""); }
    }

    const reportDatePt = consult?.report_date ? fmtDatePt(consult.report_date) : "";
    const hda = sanitizeHTML(consult?.hda || "");
    const diags = Array.isArray(consult?.diagnoses) ? consult.diagnoses : [];
    const trts  = Array.isArray(consult?.treatments) ? consult.treatments : [];

    const rx = getPrescriptionTextFromPlan(consult?.plan_text || "") ||
      "R/ 20 Sessões de Medicina Física e de Reabilitação com:";

    const name = String(p.full_name || "").trim() || "—";

    const lineParts = [];
    if (p.sns) lineParts.push(`<b>Nº Utente:</b> ${escAttr(p.sns)}`);
    if (p.dob) lineParts.push(`<b>DN:</b> ${escAttr(fmtDobPt(p.dob))}`);
    if (p.nif) lineParts.push(`<b>NIF:</b> ${escAttr(p.nif)}`);
    if (p.insurance_provider) lineParts.push(`<b>Seguro:</b> ${escAttr(p.insurance_provider)}`);
    if (p.insurance_policy_number) lineParts.push(`<b>Nº:</b> ${escAttr(p.insurance_policy_number)}`);
    const line2 = lineParts.join("&nbsp;&nbsp;&nbsp;");

    const addr = patientAddressCompact();
    const addrOk = addr && addr !== "—";

    const locality = String(clinic?.city || "").trim();
    const localityDate = [locality, reportDatePt].filter(Boolean).join(", ");

    const logoSrc = String(clinicLogoUrl || clinic?.logo_url || "").trim();

    function renderDiagList(items) {
      if (!items || !items.length) return `<span class="muted">—</span>`;
      return `
        <ul class="list">
          ${items.map(d => {
            const lbl = escAttr(d?.label || "—");
            const code = d?.code ? ` <span class="code">(${escAttr(d.code)})</span>` : ``;
            return `<li>${lbl}${code}</li>`;
          }).join("")}
        </ul>
      `;
    }

    function renderTreatList(items) {
      if (!items || !items.length) return `<span class="muted">—</span>`;
      return `
        <ul class="list">
          ${items.map(t => {
            const lbl = escAttr(sentenceizeLabel(t?.label || "—"));
            const code = t?.code ? ` <span class="code">(${escAttr(t.code)})</span>` : ``;
            return `<li>${lbl}${code}</li>`;
          }).join("")}
        </ul>
      `;
    }

    return `
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Relatório Médico</title>
<style>
  body { margin:0; background:#fff; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif; color:#111; }
  * { box-sizing:border-box; }
  @page { size: A4; margin: 16mm; }
  .a4 { width:210mm; background:#fff; }
  .top { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
  .topLeft { font-size:13.5px; line-height:1.4; }
  .logo { width:120px; height:auto; max-height:60px; object-fit:contain; display:block; }
  .hr { height:1px; background:#111; margin:10px 0 14px 0; }
  .title { text-align:center; font-weight:900; font-size:22px; margin:2px 0 12px 0; }
  .row { margin-top:6px; font-size:13.5px; line-height:1.35; }
  .muted { color:#64748b; }
  .section { margin-top:18px; page-break-inside: auto; break-inside: auto; }
  .stitle { font-weight:900; font-size:16px; margin-bottom:6px; page-break-after: avoid; break-after: avoid; }
  .hda { font-size:14px; line-height:1.2; }
  .hda p { margin: 0 0 6px 0; }
  .hda p:last-child { margin-bottom: 0; }
  .hda ul, .hda ol { margin:6px 0 6px 18px; padding:0; }
  .hda li { margin:2px 0; }
  .list { margin:8px 0 0 18px; padding:0; font-size:14px; line-height:1.35; }
  .list li { margin:6px 0; }
  .code { color:#64748b; }
  .footerBlock { margin-top:22px; page-break-inside:auto; break-inside:auto; }
  .hr2 { height:1px; background:#111; margin:16px 0 10px 0; }
  .footRow { display:flex; justify-content:space-between; align-items:flex-start; gap:10px; }
  .web { font-size:14px; font-weight:700; }
  .vinheta { margin-top:8px; width:4cm; height:2.5cm; object-fit:contain; display:block; }
  .locDate { text-align:right; font-size:14px; margin-top:14px; }
  .sig { margin-top:40px; display:flex; justify-content:flex-end; }
  .sigBox { width:360px; text-align:center; page-break-inside:avoid; break-inside:avoid; }
  .sigImgWrap { position:relative; height:80px; display:flex; align-items:flex-end; justify-content:center; margin-bottom:-1px; }
  .sigImg { max-height:80px; max-width:280px; object-fit:contain; display:block; }
  .sigLine { border-top:1px solid #111; padding-top:10px; }
  .sigName { font-weight:900; font-size:18px; margin-top:6px; }
  .sigRole { font-size:14px; margin-top:2px; }
</style>
</head>
<body>
  <div class="a4">
    <div class="top">
      <div class="topLeft">
        <div>${escAttr(clinic?.website || "www.JoaoMorais.pt")}</div>
        <div>${escAttr(clinic?.phone || "")}</div>
      </div>
      <div>
        ${logoSrc ? `<img class="logo" src="${escUrlAttr(logoSrc)}" />` : ``}
      </div>
    </div>

    <div class="hr"></div>
    <div class="title">Relatório Médico</div>

    <div class="row"><b>Nome:</b> ${escAttr(name)}</div>
    ${line2 ? `<div class="row">${line2}</div>` : ``}
    ${addrOk ? `<div class="row"><b>Morada:</b> ${escAttr(addr)}</div>` : ``}

    <div class="hr" style="margin-top:14px; opacity:0.5;"></div>

    <div class="section">
      <div class="stitle">Anamnese / HDA</div>
      <div class="hda">${hda && String(hda).trim() ? hda : `<span class="muted">—</span>`}</div>
    </div>

    <div class="section">
      <div class="stitle">Diagnóstico</div>
      ${renderDiagList(diags)}
    </div>

    <div class="section">
      <div class="stitle">Prescrição de Tratamento</div>
      <div style="font-size:14px; margin-top:2px;">${escAttr(rx)}</div>
      ${renderTreatList(trts)}
    </div>

    <div class="footerBlock">
      <div class="hr2"></div>
      <div class="footRow">
        <div>
          <div class="web">www.JoaoMorais.pt</div>
          ${vinhetaUrl ? `<img class="vinheta" src="${escUrlAttr(vinhetaUrl)}" />` : ``}
        </div>
        <div style="flex:1;">
          ${localityDate ? `<div class="locDate">${escAttr(localityDate)}</div>` : ``}
          <div class="sig">
            <div class="sigBox">
              <div class="sigLine"></div>
              <div class="sigName">Dr. João Morais</div>
              <div class="sigRole">Médico Fisiatra</div>
              <div class="sigRole">Sports Medicine &amp; Rehabilitation</div>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</body>
</html>
`;
  }
/* ==== FIM BLOCO 06Fa/12 ==== */


/* ==== INÍCIO BLOCO 06Fb/12 — Documentos/PDF (EDITOR + BIND) ==== */

  function openDocumentEditor(html, title) {
    docDraftHtml = String(html || "");
    docTitle = String(title || docTitle || "Relatório Médico");
    docMode = "visual";
    docOpen = true;
    docSaving = false;
    render();
    bindDocEvents();
  }

  function closeDocumentEditor() {
    docOpen = false;
    docSaving = false;
    docMode = "visual";
    render();
  }

  function renderDocumentEditorModal() {
    return `
      <div id="docOverlay"
           style="position:fixed; inset:0; background:rgba(0,0,0,0.35);
                  display:flex; align-items:center; justify-content:center; padding:12px; z-index:2200;">
        <div style="background:#fff; width:min(1200px,96vw);
                    max-height:92vh; overflow:auto;
                    border-radius:14px; border:1px solid #e5e5e5; padding:16px;">

          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
            <div style="font-weight:900; font-size:16px;">
              Documento v1 — ${docMode === "preview" ? "pré-visualização" : (docMode === "html" ? "editar HTML" : "editor visual")}
            </div>
            <div style="display:flex; gap:8px;">
              <button id="btnDocCloseTop" class="gcBtn">Fechar</button>
            </div>
          </div>

          <div style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
            <div style="flex:1; min-width:260px;">
              <label>Título</label>
              <input id="docTitle" value="${escAttr(docTitle)}"
                     style="width:100%; padding:10px; border:1px solid #ddd; border-radius:10px;" />
            </div>

            <div style="display:flex; gap:8px; align-items:flex-end;">
              <button id="btnDocModeVisual" class="gcBtn" ${docMode === "visual" ? `style="font-weight:900;"` : ``}>Editor</button>
              <button id="btnDocModeHtml" class="gcBtn" ${docMode === "html" ? `style="font-weight:900;"` : ``}>HTML</button>
              <button id="btnDocModePreview" class="gcBtn" ${docMode === "preview" ? `style="font-weight:900;"` : ``}>Pré-visualizar</button>
            </div>
          </div>

          ${docMode === "html" ? `
            <div style="margin-top:12px;">
              <textarea id="docHtml"
                        style="width:100%; height:65vh; padding:12px; border:1px solid #ddd; border-radius:12px;
                               font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
                               font-size:12px; line-height:1.4;">${escAttr(docDraftHtml)}</textarea>
            </div>
          ` : `
            <div style="margin-top:12px; border:1px solid #e5e5e5; border-radius:12px; overflow:hidden;">
              ${docMode === "visual" ? `
              <div id="docToolbar" style="display:flex; gap:4px; padding:8px 10px; background:#f8f8f8; border-bottom:1px solid #e5e5e5; flex-wrap:wrap; align-items:center;">
                <button onclick="(function(){var d=document.getElementById('docFrame').contentDocument;d.execCommand('bold')})()" style="font-weight:900; min-width:32px; padding:4px 8px; border:1px solid #ddd; border-radius:6px; background:#fff; cursor:pointer; font-size:14px;">B</button>
                <button onclick="(function(){var d=document.getElementById('docFrame').contentDocument;d.execCommand('italic')})()" style="font-style:italic; min-width:32px; padding:4px 8px; border:1px solid #ddd; border-radius:6px; background:#fff; cursor:pointer; font-size:14px;">I</button>
                <button onclick="(function(){var d=document.getElementById('docFrame').contentDocument;d.execCommand('underline')})()" style="text-decoration:underline; min-width:32px; padding:4px 8px; border:1px solid #ddd; border-radius:6px; background:#fff; cursor:pointer; font-size:14px;">U</button>
                <div style="width:1px; background:#ddd; height:24px; margin:0 4px;"></div>
                <select onchange="(function(v){var d=document.getElementById('docFrame').contentDocument;d.execCommand('fontSize',false,v)})(this.value)" style="padding:4px 6px; border:1px solid #ddd; border-radius:6px; background:#fff; cursor:pointer; font-size:13px;">
                  <option value="">Tamanho</option>
                  <option value="2">Pequeno</option>
                  <option value="3">Normal</option>
                  <option value="4">Médio</option>
                  <option value="5">Grande</option>
                  <option value="6">Muito grande</option>
                </select>
                <div style="width:1px; background:#ddd; height:24px; margin:0 4px;"></div>
                <button onclick="(function(){var d=document.getElementById('docFrame').contentDocument;d.execCommand('justifyLeft')})()" style="min-width:32px; padding:4px 8px; border:1px solid #ddd; border-radius:6px; background:#fff; cursor:pointer; font-size:14px;">≡</button>
                <button onclick="(function(){var d=document.getElementById('docFrame').contentDocument;d.execCommand('justifyCenter')})()" style="min-width:32px; padding:4px 8px; border:1px solid #ddd; border-radius:6px; background:#fff; cursor:pointer; font-size:14px;">☰</button>
              </div>` : ``}
              <iframe id="docFrame" style="width:100%; height:65vh; border:0; background:#fff;"></iframe>
            </div>
          `}

          <div style="margin-top:12px; display:flex; justify-content:space-between; align-items:center; gap:10px;">
            <div id="docStatus" style="color:${docSaving ? "#111" : "#64748b"};">
              ${docSaving ? "A gerar/upload..." : ""}
            </div>

            <div style="display:flex; gap:10px;">
              <button id="btnDocCancel" class="gcBtn">Cancelar</button>
              <button id="btnDocGeneratePdfNow" class="gcBtn" style="font-weight:900;">
                Gerar PDF (v1)
              </button>
            </div>
          </div>

        </div>
      </div>
    `;
  }

  function mountDocFrame() {
    const iframe = document.getElementById("docFrame");
    if (!iframe) return;

    iframe.srcdoc = String(docDraftHtml || "");

    iframe.onload = () => {
      try {
        const d = iframe.contentDocument;
        if (!d) return;

        if (docMode === "visual") {
          d.designMode = "on";
          d.body.style.outline = "none";
        } else {
          try { d.designMode = "off"; } catch (e) {}
        }
      } catch (e) {
        console.error("mountDocFrame error:", e);
      }
    };
  }

  function syncDocFromFrame() {
    const iframe = document.getElementById("docFrame");
    if (!iframe) return;

    try {
      const d = iframe.contentDocument || iframe.contentWindow?.document;
      if (!d || !d.documentElement) return;

      let html = "";
      try { html = d.documentElement.outerHTML || ""; } catch (e) { html = ""; }
      if (html && !/<!doctype/i.test(html)) html = "<!doctype html>\n" + html;

      docDraftHtml = String(html || "").trim();
    } catch (e) {
      console.error("syncDocFromFrame error:", e);
    }
  }

  function bindDocEvents() {
    document.getElementById("btnDocCloseTop")?.addEventListener("click", closeDocumentEditor);
    document.getElementById("btnDocCancel")?.addEventListener("click", closeDocumentEditor);

    const t = document.getElementById("docTitle");
    if (t) t.oninput = (e) => { docTitle = e?.target?.value ?? "Relatório Médico"; };

    const bVis = document.getElementById("btnDocModeVisual");
    const bHtml = document.getElementById("btnDocModeHtml");
    const bPrev = document.getElementById("btnDocModePreview");

    if (bVis) bVis.onclick = () => { docMode = "visual"; render(); bindDocEvents(); mountDocFrame(); };
    if (bHtml) bHtml.onclick = () => { if (docMode !== "html") syncDocFromFrame(); docMode = "html"; render(); bindDocEvents(); };
    if (bPrev) bPrev.onclick = () => { if (docMode !== "html") syncDocFromFrame(); docMode = "preview"; render(); bindDocEvents(); mountDocFrame(); };

    const ta = document.getElementById("docHtml");
    if (ta) ta.oninput = (e) => { docDraftHtml = e?.target?.value ?? ""; };

    const btnGen = document.getElementById("btnDocGeneratePdfNow");
    if (btnGen) {
      btnGen.disabled = !!docSaving;
      btnGen.onclick = async () => {
        if (docSaving) return;
        docSaving = true;
        docDraftHtml = "";
        if (docMode !== "html") syncDocFromFrame();
        render();
        bindDocEvents();
        const ok = await generatePdfAndUploadV1();
        docSaving = false;
        if (ok) {
          docOpen = false;
          await loadDocuments();
          render();
        } else {
          render();
          bindDocEvents();
          if (docMode !== "html") mountDocFrame();
        }
      };
    }

    if (docMode !== "html") mountDocFrame();
  }
/* ==== FIM BLOCO 06Fb/12 ==== */


/* ==== INÍCIO BLOCO 06Fc/12 — Documentos/PDF (STORAGE + GENERATE + EXPORTS) ==== */

  async function uploadPdfToStorage({ blob, path }) {
    try {
      const r = await window.sb.storage
        .from("documents")
        .upload(path, blob, { contentType: "application/pdf", upsert: false, cacheControl: "3600" });

      if (r?.error) { console.error("uploadPdf error:", r.error); return { ok: false, error: r.error }; }
      return { ok: true };
    } catch (e) {
      console.error("uploadPdf exception:", e);
      return { ok: false, error: e };
    }
  }

  async function insertDocumentRow(meta) {
    try {
      const payload = {
        clinic_id: meta.clinic_id,
        patient_id: meta.patient_id,
        consultation_id: meta.consultation_id || null,
        title: meta.title,
        html: meta.html || "",
        parent_document_id: meta.parent_document_id || null,
        version: Number(meta.version || 1),
        storage_path: meta.storage_path || null
      };

      const { data, error } = await window.sb
        .from("documents")
        .insert(payload)
        .select("id")
        .single();

      if (error) { console.error("insertDocumentRow error:", error); return { ok: false, error }; }
      return { ok: true, id: data?.id || null };
    } catch (e) {
      console.error("insertDocumentRow exception:", e);
      return { ok: false, error: e };
    }
  }

  async function getNextDocVersionForConsult(consultId) {
    try {
      const { data, error } = await window.sb
        .from("documents")
        .select("version")
        .eq("consultation_id", consultId)
        .order("version", { ascending: false })
        .limit(1);

      if (error) { console.error("getNextDocVersion error:", error); return 1; }
      const last = data && data.length ? Number(data[0].version || 0) : 0;
      return (isFinite(last) ? last + 1 : 1);
    } catch (e) {
      console.error("getNextDocVersion exception:", e);
      return 1;
    }
  }

  function applyPdfAssetsToHtml(html, { clinicLogoUrl, vinhetaUrl, signatureUrl }) {
    let out = String(html || "");
    if (clinicLogoUrl) out = out.replaceAll("__CLINIC_LOGO_URL__", clinicLogoUrl);
    if (vinhetaUrl) out = out.replaceAll("__VINHETA_URL__", vinhetaUrl);
    if (vinhetaUrl && out.includes('class="vinheta"')) {
      out = out.replace(
        /(<img\b[^>]*class="vinheta"[^>]*\bsrc=")[^"]*(")/i,
        `$1${vinhetaUrl}$2`
      );
    }
    return out;
  }

  async function generatePdfAndUploadV1() {
    try {
      if (!lastSavedConsultId) { alert("Sem consulta gravada para gerar PDF."); return false; }

      const userRes = await window.sb.auth.getUser();
      const userId = userRes?.data?.user?.id;
      if (!userId) { alert("Utilizador não autenticado."); return false; }

      const consult = (consultRows || []).find(x => String(x.id) === String(lastSavedConsultId));
      if (!consult) { alert("Não encontrei a consulta no feed. Atualiza o feed e tenta novamente."); return false; }

      if (!activeClinicId) { alert("Sem clínica ativa (patient_clinic)."); return false; }

      const clinic = await fetchClinicForPdf();
      if (!clinic) { alert("Não consegui carregar dados da clínica (clinics)."); return false; }

      const authorName = await fetchCurrentUserDisplayName(userId);

      let vinhetaUrl = "";
      try {
        const vinhetaSignedUrl = await storageSignedUrl(VINHETA_BUCKET, VINHETA_PATH, 3600);
        if (vinhetaSignedUrl) {
          vinhetaUrl = await urlToDataUrl(vinhetaSignedUrl, "image/png");
        }
      } catch (e) {
        console.warn("PDF: vinheta signed/data url falhou:", e);
        vinhetaUrl = "";
      }

      let signatureUrl = "";
      try {
        const signatureSignedUrl = await storageSignedUrl(VINHETA_BUCKET, SIGNATURE_PATH, 3600);
        if (signatureSignedUrl) {
          signatureUrl = await urlToDataUrl(signatureSignedUrl, "image/png");
        }
      } catch (e) {
        console.warn("PDF: assinatura signed/data url falhou:", e);
        signatureUrl = "";
      }

      let clinicLogoUrl = "";
      try {
        const rawLogo = String(clinic?.logo_url || "").trim();
        if (rawLogo.startsWith("data:")) {
          clinicLogoUrl = rawLogo;
        } else if (rawLogo.startsWith("http://") || rawLogo.startsWith("https://")) {
          clinicLogoUrl = await urlToDataUrl(rawLogo, "image/png");
        } else {
          clinicLogoUrl = "";
        }
      } catch (e) {
        console.warn("PDF: logo data url falhou:", e);
        clinicLogoUrl = "";
      }

      docDraftHtml = buildDocV1Html({
        clinic, consult, authorName, vinhetaUrl, clinicLogoUrl, signatureUrl
      });

      const titleSafe = safeText(docTitle || "Relatório Médico");

      let blob;
      try {
        blob = await renderPdfViaProxy(docDraftHtml);
      } catch (e) {
        console.error("renderPdfViaProxy falhou:", e);
        alert(`Falha ao gerar PDF no servidor.\n${String(e?.message || e)}`);
        return false;
      }

      if (!blob || blob.size < 5000) {
        alert("PDF inválido ou demasiado pequeno (provável branco).");
        return false;
      }

      const version = await getNextDocVersionForConsult(consult.id);
      const ymd = new Date().toISOString().slice(0, 10);
      const hms = new Date().toISOString().slice(11, 19).replaceAll(":", "");
      const path = `clinic_${activeClinicId}/patient_${p.id}/consult_${consult.id}/v${version}_${ymd}_${hms}.pdf`;

      const up = await uploadPdfToStorage({ blob, path });
      if (!up.ok) {
        const msg = String(up.error?.message || up.error?.error || up.error || "erro desconhecido");
        alert(`Falhou o upload do PDF para Storage.\nDetalhe: ${msg}`);
        return false;
      }

      const ins = await insertDocumentRow({
        clinic_id: activeClinicId,
        patient_id: p.id,
        consultation_id: consult.id,
        title: titleSafe,
        html: "",
        parent_document_id: null,
        version,
        storage_path: path
      });

      if (!ins.ok) {
        const msg = String(ins.error?.message || ins.error?.error || ins.error || "erro desconhecido");
        alert(`PDF enviado para Storage, mas falhou o registo na tabela documents.\nDetalhe: ${msg}`);
        return false;
      }

      alert("PDF (v1) criado com sucesso.");
      return true;

    } catch (e) {
      console.error("generatePdfAndUploadV1 exception:", e);
      alert("Erro na geração/upload do PDF.");
      return false;
    }
  }

  // Exports globais (compatibilidade com código legado)
  try {
    window.generatePdfAndUploadV1 = generatePdfAndUploadV1;
    window.openDocumentEditor = openDocumentEditor;
    window.__gc_storageSignedUrl  = storageSignedUrl;
    window.__gc_urlToDataUrl      = urlToDataUrl;
    window.__gc_renderPdfViaProxy = renderPdfViaProxy;
    window.__gc_uploadPdfToStorage  = uploadPdfToStorage;
    window.__gc_insertDocumentRow   = insertDocumentRow;
    window.__gc_VINHETA_BUCKET      = VINHETA_BUCKET;
    window.__gc_VINHETA_PATH        = VINHETA_PATH;
  } catch (e) {}
/* ==== FIM BLOCO 06Fc/12 ==== */


/* ==== INÍCIO BLOCO 06G/12 — Timeline ==== */

  window.__gcPhysioState = window.__gcPhysioState || {
    rows: [],
    loading: false,
    composerOpen: false,
    editingId: null,
    draftHtml: "",
    saving: false
  };

  function __ps() { return window.__gcPhysioState; }

  window.__gcPhysioQuill = window.__gcPhysioQuill || null;
  window.__gcAuthUid = window.__gcAuthUid || null;

  let agendaNoteRows = [];

  async function __gcGetUidAsync() {
    try {
      const { data, error } = await window.sb.auth.getUser();
      if (error) { console.error(error); return null; }
      const uid = data?.user?.id || null;
      window.__gcAuthUid = uid;
      return uid;
    } catch (e) {
      console.error(e);
      return null;
    }
  }

  function __gcGetUidCached() {
    return window.__gcAuthUid || null;
  }

  function __gcRole() {
    return String(G.role || "").toLowerCase();
  }

  function __gcIsSecretary() { return __gcRole() === "secretary"; }
  function __gcIsPhysio() { return __gcRole() === "physio"; }
  function __gcIsDoctor() { return __gcRole() === "doctor"; }

  function __gcGuessClinicIdForPhysioRecord() {
    try {
      if (typeof getActiveClinicId === "function") {
        const x = getActiveClinicId();
        if (x) return x;
      }
    } catch (_) {}

    try {
      if (typeof getActiveClinicIdForPatient === "function") {
        const x = getActiveClinicIdForPatient(p);
        if (x) return x;
      }
    } catch (_) {}

    try {
      const cid = consultRows && consultRows.length ? (consultRows[0].clinic_id || null) : null;
      if (cid) return cid;
    } catch (_) {}

    try {
      const cid = window.activeClinicId || G.activeClinicId || null;
      if (cid) return cid;
    } catch (_) {}

    return null;
  }

  async function loadAgendaNotes() {
    try {
      const { data, error } = await window.sb
        .from("agenda_notes_v1")
        .select("appointment_id, clinic_id, patient_id, start_at, end_at, status, procedure_type, title, notes, created_by, created_at, updated_at")
        .eq("patient_id", p.id)
        .order("start_at", { ascending: false });

      if (error) {
        console.error(error);
        agendaNoteRows = [];
        return;
      }

      agendaNoteRows = (data || []).map(r => ({
        ...r,
        notes: String(r.notes || "").trim()
      })).filter(r => r.notes && r.notes.length);
    } catch (e) {
      console.error(e);
      agendaNoteRows = [];
    }
  }

  async function loadPhysioRecords() {
    const s = __ps();
    const rRole = __gcRole();
    const isSecretary = rRole === "secretary";
    if (isSecretary) {
      s.rows = [];
      return;
    }

    s.loading = true;

    const { data, error } = await window.sb
      .from("physio_records")
      .select("id, clinic_id, patient_id, author_user_id, content, created_at")
      .eq("patient_id", p.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      s.rows = [];
      s.loading = false;
      return;
    }

    const rows = data || [];

    const authorIds = [...new Set(rows.map(r => r.author_user_id).filter(Boolean))];
    let authorMap = {};
    if (authorIds.length) {
      const { data: cms, error: cmErr } = await window.sb
        .from("clinic_members")
        .select("user_id, display_name")
        .in("user_id", authorIds);

      if (cmErr) console.error(cmErr);
      else (cms || []).forEach(x => { authorMap[x.user_id] = (x.display_name || "").trim(); });
    }

    s.rows = rows.map(r => ({
      ...r,
      author_name: (authorMap[r.author_user_id] || "").trim()
    }));

    s.loading = false;
  }

  async function loadConsultations() {
    timelineLoading = true;

    const rRole = String(G.role || "").toLowerCase();
    const isSecretary = rRole === "secretary";

    await loadAgendaNotes();

    if (isSecretary) {
      const { data, error } = await window.sb.rpc("get_consultation_headers_for_patient", {
        p_patient_id: p.id
      });

      if (error) {
        console.error(error);
        consultRows = [];
        __ps().rows = [];
        timelineLoading = false;
        return;
      }

      const rows = data || [];
      consultRows = rows.map(r => ({
        ...r,
        author_name: (r.author_display_name || "").trim(),
        diagnoses: [],
        treatments: [],
        hda: ""
      }));

      __ps().rows = [];
      timelineLoading = false;
      return;
    }

    const { data, error } = await window.sb
      .from("consultations")
      .select("id, clinic_id, report_date, hda, plan_text, created_at, author_user_id, author_display_name")
      .eq("patient_id", p.id)
      .order("report_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      consultRows = [];
      timelineLoading = false;
      return;
    }

    const rows = data || [];

    const authorIds = [...new Set(rows.map(r => r.author_user_id).filter(Boolean))];
    let authorMap = {};
    if (authorIds.length) {
      const { data: cms, error: cmErr } = await window.sb
        .from("clinic_members")
        .select("user_id, display_name")
        .in("user_id", authorIds);

      if (cmErr) console.error(cmErr);
      else (cms || []).forEach(x => { authorMap[x.user_id] = x.display_name || ""; });
    }

    const consultIds = rows.map(r => r.id).filter(Boolean);

    let diagByConsult = {};
    if (consultIds.length) {
      const { data: links, error: lErr } = await window.sb
        .from("consultation_diagnoses")
        .select("consultation_id, diagnosis_id")
        .in("consultation_id", consultIds);

      if (lErr) {
        console.error(lErr);
      } else {
        const diagIds = [...new Set((links || []).map(x => x.diagnosis_id).filter(Boolean))];
        let diagMap = {};
        if (diagIds.length) {
          const { data: diags, error: dErr } = await window.sb
            .from("diagnoses_catalog")
            .select("id, label, code")
            .in("id", diagIds);

          if (dErr) console.error(dErr);
          else {
            (diags || []).forEach(d => {
              diagMap[d.id] = { id: d.id, label: d.label || "", code: d.code || "" };
            });
          }
        }

        (links || []).forEach(l => {
          const cid = l.consultation_id;
          const did = l.diagnosis_id;
          if (!cid || !did) return;
          const dd = diagMap[did];
          if (!dd) return;
          if (!diagByConsult[cid]) diagByConsult[cid] = [];
          diagByConsult[cid].push(dd);
        });
      }
    }

    let treatByConsult = {};
    if (consultIds.length) {
      const { data: tlinks, error: tErr } = await window.sb
        .from("consultation_treatments")
        .select("consultation_id, treatment_id, qty")
        .in("consultation_id", consultIds);

      if (tErr) {
        console.error(tErr);
      } else {
        const tIds = [...new Set((tlinks || []).map(x => x.treatment_id).filter(Boolean))];
        let tMap = {};
        if (tIds.length) {
          const { data: trs, error: trErr } = await window.sb
            .from("treatments_catalog")
            .select("*")
            .in("id", tIds);

          if (trErr) {
            console.error(trErr);
          } else {
            (trs || []).forEach(t => {
              const label = sentenceizeLabel(t.label || t.name || t.title || "");
              const code = t.code || t.adse_code || t.proc_code || "";
              tMap[t.id] = { label, code };
            });
          }
        }

        (tlinks || []).forEach(l => {
          const cid = l.consultation_id;
          const tid = l.treatment_id;
          if (!cid || !tid) return;
          const tt = tMap[tid];
          if (!tt) return;
          if (!treatByConsult[cid]) treatByConsult[cid] = [];
          treatByConsult[cid].push({ id: tid, ...tt, qty: Number(l.qty || 1) });
        });
      }
    }

    consultRows = rows.map(r => {
      const order = getTreatOrderFromPlan(r.plan_text);
      let treatments = treatByConsult[r.id] || [];

      if (order && order.length) {
        const pos = new Map(order.map((id, i) => [String(id), i]));
        treatments = (treatments || []).slice().sort((a, b) => {
          const pa = pos.has(String(a.id)) ? pos.get(String(a.id)) : 1e9;
          const pb = pos.has(String(b.id)) ? pos.get(String(b.id)) : 1e9;
          return pa - pb;
        });
      }

      const a1 = (r.author_display_name || "").trim();
      const a2 = (authorMap[r.author_user_id] || "").trim();

      return ({
        ...r,
        author_name: a1 || a2 || "",
        diagnoses: diagByConsult[r.id] || [],
        treatments
      });
    });

    lastSavedConsultId = consultRows && consultRows.length ? (consultRows[0].id || null) : lastSavedConsultId;

    await loadPhysioRecords();

    timelineLoading = false;
  }

  function renderDocumentsInlineForConsult(consultId) {
    const docs = (docRows || []).filter(d => d.consultation_id && String(d.consultation_id) === String(consultId));
    if (!docs.length) return "";

    function docStyle(title) {
      const t = String(title || "").toLowerCase();
      if (t.startsWith("pedido de exame"))
        return { border: "#bcd4f5", bg: "#f0f6ff", badge: "#1d6db5", label: "Exame" };
      if (t.startsWith("análise") || t.startsWith("analise"))
        return { border: "#b8e0c8", bg: "#f0faf4", badge: "#1a7a45", label: "Análise" };
      if (t.startsWith("relatório") || t.startsWith("relatorio"))
        return { border: "#e2e8f0", bg: "#f8fafc", badge: "#475569", label: "Relatório" };
      return { border: "#e2e8f0", bg: "#f8fafc", badge: "#475569", label: "Documento" };
    }

    return `
      <div style="margin-top:12px;">
        <div style="font-weight:900;">Documentos:</div>
        <div style="margin-top:8px; display:flex; flex-direction:column; gap:8px;">
          ${docs.map(d => {
            const s = docStyle(d.title);
            return `
            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;
                        padding:10px 12px;
                        border:1px solid ${s.border};
                        background:${s.bg};
                        border-radius:12px;">
              <div style="display:flex; flex-direction:column; gap:2px;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="
                    font-size:11px;
                    font-weight:700;
                    color:${s.badge};
                    background:${s.border};
                    padding:2px 8px;
                    border-radius:20px;
                    text-transform:uppercase;
                    letter-spacing:0.4px;
                  ">${s.label}</span>
                  <span style="font-weight:900;">
                    ${escAttr(d.title || "Documento")}
                    ${d.version ? `<span style="color:#64748b; font-size:12px; font-weight:400;">(v${escAttr(String(d.version))})</span>` : ``}
                  </span>
                </div>
                <div style="color:#94a3b8; font-size:12px; margin-left:2px;">
                  ${d.created_at ? escAttr(String(d.created_at)) : ""}
                </div>
              </div>
              <div style="display:flex; gap:8px;">
                ${d.url
                  ? `<a class="gcBtn" href="${escAttr(d.url)}" target="_blank" rel="noopener" style="text-decoration:none;">Abrir</a>`
                  : `<button class="gcBtn" disabled>Sem link</button>`
                }
              </div>
            </div>
          `;
          }).join("")}
        </div>
      </div>
    `;
  }

  function __gcRenderPhysioComposer() {
    const s = __ps();
    if (!__gcIsPhysio()) return "";

    if (!s.composerOpen) {
      return `
        <div style="display:flex; justify-content:flex-start;">
          <button id="btnAddPhysioRecord" class="gcBtn" type="button" style="font-weight:900;">+ Registo Fisioterapia</button>
        </div>
      `;
    }

    const title = s.editingId ? "Editar Registo de Fisioterapia" : "Novo Registo de Fisioterapia";

    return `
      <div style="border:1px solid #e5e5e5; border-radius:14px; padding:14px;">
        <style>
          #physioQuillEditor.ql-container.ql-snow { min-height: 320px; }
          #physioQuillEditor .ql-editor { min-height: 320px; line-height: 1.35; font-size: 15px; }
        </style>

        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
          <div style="font-weight:900; font-size:15px;">${title}</div>
          <div style="display:flex; gap:8px;">
            <button id="btnCancelPhysioComposer" class="gcBtn" type="button">Cancelar</button>
            <button id="btnSavePhysioRecord" class="gcBtn" type="button" style="font-weight:900;">Gravar</button>
          </div>
        </div>

        <div style="margin-top:10px;">
          <div id="physioQuillToolbar">
            <span class="ql-formats">
              <button class="ql-bold"></button>
              <button class="ql-underline"></button>
            </span>
            <span class="ql-formats">
              <button class="ql-list" value="ordered"></button>
              <button class="ql-list" value="bullet"></button>
            </span>
            <span class="ql-formats">
              <button class="ql-clean"></button>
            </span>
          </div>
          <div id="physioQuillEditor"></div>
        </div>
      </div>
    `;
  }

  function __gcRenderPhysioItem(r) {
    const d = r.created_at ? new Date(r.created_at) : null;
    const when = (d && !isNaN(d.getTime()))
      ? `${fmtDatePt(d)} às ${fmtTime(d)}`
      : (r.created_at ? String(r.created_at) : "—");

    const authorTxt = (r.author_name || "").trim();
    const uid = __gcGetUidCached();
    const canEdit = __gcIsPhysio() && uid && String(r.author_user_id) === String(uid);

    return `
      <div style="border:1px solid #e5e5e5; border-radius:14px; padding:16px; background:#f1f5f9;">
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px;">
          <div style="font-weight:900; font-size:16px;">
            Fisioterapia — ${when}${authorTxt ? ` - ${escAttr(authorTxt)}` : ``}
          </div>

          ${canEdit ? `
            <div style="display:flex; gap:8px;">
              <button class="gcBtn" type="button" data-physio-action="edit" data-physio-id="${escAttr(r.id)}">Editar</button>
              <button class="gcBtn" type="button" data-physio-action="delete" data-physio-id="${escAttr(r.id)}">Apagar</button>
            </div>
          ` : ``}
        </div>

        <div style="margin-top:8px; line-height:1.35; font-size:15px;">
          ${sanitizeHTML(r.content || "") || `<span style="color:#64748b;">—</span>`}
        </div>
      </div>
    `;
  }

  function __gcRenderAgendaNoteItem(r) {
    const d = r.start_at ? new Date(r.start_at) : null;
    const when = (d && !isNaN(d.getTime()))
      ? `${fmtDatePt(d)} às ${fmtTime(d)}`
      : (r.start_at ? String(r.start_at) : "—");

    const title = (r.title || r.procedure_type || "").trim();

    return `
      <div style="border:1px solid #e5e5e5; border-radius:14px; padding:16px; background:#fff7ed;">
        <div style="font-weight:900; font-size:16px;">
          Nota da agenda — ${when}${title ? ` <span style="color:#64748b; font-weight:700;">(${escAttr(title)})</span>` : ``}
        </div>

        <div style="margin-top:8px; line-height:1.45; font-size:15px;">
          ${escAttr(String(r.notes || "").trim()) || `<span style="color:#64748b;">—</span>`}
        </div>
      </div>
    `;
  }

  function renderTimeline() {
    if (timelineLoading) return `<div style="color:#64748b;">A carregar registos...</div>`;

    const isSecretary = __gcIsSecretary();

    const noteRows = Array.isArray(agendaNoteRows) ? agendaNoteRows : [];
    const consultList = Array.isArray(consultRows) ? consultRows : [];
    const physioList = Array.isArray(__ps()?.rows) ? __ps().rows : [];

    const notesByAppointmentId = new Map();
    const linkedNoteIds = new Set();

    noteRows.forEach((r) => {
      const apptId = r && r.appointment_id ? String(r.appointment_id) : "";
      if (!apptId) return;
      if (!notesByAppointmentId.has(apptId)) notesByAppointmentId.set(apptId, []);
      notesByAppointmentId.get(apptId).push(r);
    });

    const items = [];

    if (!isSecretary) {
      physioList.forEach((r) => {
        const t = r && r.created_at ? new Date(r.created_at).getTime() : 0;
        items.push({ type: "physio", ts: isNaN(t) ? 0 : t, row: r });
      });
    }

    consultList.forEach((r) => {
      const d = r && r.created_at ? new Date(r.created_at) : null;
      const t = (d && !isNaN(d.getTime()))
        ? d.getTime()
        : (r && r.report_date ? new Date(String(r.report_date)).getTime() : 0);

      items.push({
        type: isSecretary ? "consult_header" : "consult",
        ts: isNaN(t) ? 0 : t,
        row: r
      });

      const apptId = r && r.appointment_id ? String(r.appointment_id) : "";
      if (!apptId) return;

      const linkedNotes = notesByAppointmentId.get(apptId) || [];
      linkedNotes.forEach((n) => {
        if (n && n.id) linkedNoteIds.add(String(n.id));
      });
    });

    noteRows.forEach((r) => {
      const noteId = r && r.id ? String(r.id) : "";
      if (noteId && linkedNoteIds.has(noteId)) return;
      const t = r && r.start_at ? new Date(r.start_at).getTime() : 0;
      items.push({ type: "agenda_note", ts: isNaN(t) ? 0 : t, row: r });
    });

    items.sort((a, b) => (b.ts || 0) - (a.ts || 0));

    if (!items.length) {
      if (isSecretary) {
        return `<div style="color:#64748b;">Sem registos.</div>`;
      }
      return `
        <div style="display:flex; flex-direction:column; gap:14px;">
          ${__gcRenderPhysioComposer()}
          <div style="color:#64748b;">Sem registos.</div>
        </div>
      `;
    }

    function renderLinkedAgendaNotesForConsult(consultRow) {
      const apptId = consultRow && consultRow.appointment_id ? String(consultRow.appointment_id) : "";
      if (!apptId) return "";
      const linkedNotes = notesByAppointmentId.get(apptId) || [];
      if (!linkedNotes.length) return "";
      linkedNotes.sort((a, b) => {
        const ta = a && a.start_at ? new Date(a.start_at).getTime() : 0;
        const tb = b && b.start_at ? new Date(b.start_at).getTime() : 0;
        return (tb || 0) - (ta || 0);
      });
      return linkedNotes.map((n) => __gcRenderAgendaNoteItem(n)).join("");
    }

    function renderConsultActions(r) {
      if (isSecretary) return "";
      const consultId = r && r.id ? String(r.id) : "";
      if (!consultId) return "";

      let canEdit = false;
      try {
        const created = r && r.created_at ? new Date(r.created_at).getTime() : null;
        if (created) {
          const now = Date.now();
          const diffHours = (now - created) / (1000 * 60 * 60);
          canEdit = diffHours <= 24;
        }
      } catch (_) {}

      return `
        <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
          ${canEdit ? `
            <button class="gcBtn" data-action="edit-consult" data-consult-id="${escAttr(consultId)}"
              style="font-weight:700; background:#f8fafc; border:1px solid #cbd5e1; color:#334155;">
              Editar Consulta
            </button>
          ` : `
            <div style="padding:6px 10px; font-size:13px; color:#64748b; border:1px dashed #cbd5e1; border-radius:8px; background:#f8fafc;">
              Edição indisponível (&gt;24h)
            </div>
          `}

          <button class="gcBtn" data-action="consult-report" data-consult-id="${escAttr(consultId)}"
            style="font-weight:800; background:#166534; border:1px solid #166534; color:#ffffff;">
            Relatório da Consulta
          </button>
        </div>
      `;
    }

    if (isSecretary) {
      return `
        <div style="display:flex; flex-direction:column; gap:14px;">
          ${items.map((it) => {
            if (it.type === "agenda_note") return __gcRenderAgendaNoteItem(it.row);

            const r = it.row;
            const d = r && r.created_at ? new Date(r.created_at) : null;
            const when = (d && !isNaN(d.getTime()))
              ? `${fmtDatePt(d)} às ${fmtTime(d)}`
              : (r && r.report_date ? String(r.report_date) : "—");
            const authorTxt = (r && r.author_name ? String(r.author_name) : "").trim();

            return `
              ${renderLinkedAgendaNotesForConsult(r)}
              <div style="border:1px solid #e5e7eb; border-radius:14px; overflow:hidden; background:#ffffff;">
                <div style="background:#f9fafb; border-bottom:1px solid #e5e7eb; padding:10px 16px;
                            display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap;">
                  <div style="display:flex; flex-direction:column;">
                    <div style="font-weight:900; font-size:15px; color:#0f172a;">Consulta</div>
                    <div style="font-size:13px; color:#475569; margin-top:2px;">
                      ${when}${authorTxt ? ` • ${escAttr(authorTxt)}` : ``}
                    </div>
                  </div>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      `;
    }

    return `
      <div style="display:flex; flex-direction:column; gap:14px;">
        ${__gcRenderPhysioComposer()}

        ${items.map((it) => {
          if (it.type === "agenda_note") return __gcRenderAgendaNoteItem(it.row);
          if (it.type === "physio") return __gcRenderPhysioItem(it.row);

          const r = it.row;
          const d = r && r.created_at ? new Date(r.created_at) : null;
          const when = (d && !isNaN(d.getTime()))
            ? `${fmtDatePt(d)} às ${fmtTime(d)}`
            : (r && r.report_date ? String(r.report_date) : "—");

          const authorTxt = (r && r.author_name ? String(r.author_name) : "").trim();

          return `
            ${renderLinkedAgendaNotesForConsult(r)}
            <div style="border:1px solid #e5e7eb; border-radius:14px; overflow:hidden; background:#ffffff;">
              <div style="background:#f9fafb; border-bottom:1px solid #e5e7eb; padding:10px 16px;
                          display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap;">
                <div style="display:flex; flex-direction:column;">
                  <div style="font-weight:900; font-size:15px; color:#0f172a;">Consulta</div>
                  <div style="font-size:13px; color:#475569; margin-top:2px;">
                    ${when}${authorTxt ? ` • ${escAttr(authorTxt)}` : ``}
                  </div>
                </div>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                  ${renderConsultActions(r)}
                </div>
              </div>

              <div style="padding:16px;">
                <div style="font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; color:#64748b; margin-bottom:8px;">
                  Anamnese / HDA
                </div>
                <div style="line-height:1.65; font-size:15px; color:#111827; background:#ffffff;">
                  ${sanitizeHTML(r.hda || "") || `<span style="color:#64748b;">—</span>`}
                </div>

                ${r.diagnoses && r.diagnoses.length ? `
                  <div style="margin-top:16px;">
                    <div style="font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; color:#64748b; margin-bottom:8px;">
                      Diagnósticos
                    </div>
                    <ul style="margin:0 0 0 18px; line-height:1.55;">
                      ${r.diagnoses.map(dg => `
                        <li>${escAttr(dg.label || "—")}${dg.code ? ` <span style="color:#64748b;">(${escAttr(dg.code)})</span>` : ``}</li>
                      `).join("")}
                    </ul>
                  </div>
                ` : ``}

                ${r.treatments && r.treatments.length ? `
                  <div style="margin-top:16px;">
                    <div style="font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; color:#64748b; margin-bottom:8px;">
                      Tratamentos
                    </div>
                    <ul style="margin:0 0 0 18px; line-height:1.55;">
                      ${r.treatments.map(t => `
                        <li>${escAttr(sentenceizeLabel(t.label || "—"))}${t.code ? ` <span style="color:#64748b;">(${escAttr(t.code)})</span>` : ``}</li>
                      `).join("")}
                    </ul>
                  </div>
                ` : ``}

                ${renderDocumentsInlineForConsult(r.id)}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function __gcInstallPhysioTimelineHooksOnce() {
    if (window.__gcPhysioTimelineHooksInstalled) return;
    window.__gcPhysioTimelineHooksInstalled = true;

    document.addEventListener("click", async (ev) => {
      const t = ev.target;
      const s = __ps();

      if (t && t.id === "btnAddPhysioRecord") {
        ev.preventDefault();
        await __gcGetUidAsync();
        s.composerOpen = true;
        s.editingId = null;
        s.draftHtml = "";
        window.__gcPhysioQuill = null;
        render();
        return;
      }

      if (t && t.id === "btnCancelPhysioComposer") {
        ev.preventDefault();
        s.composerOpen = false;
        s.editingId = null;
        s.draftHtml = "";
        window.__gcPhysioQuill = null;
        render();
        return;
      }

      if (t && t.id === "btnSavePhysioRecord") {
        ev.preventDefault();
        if (s.saving) return;
        if (!__gcIsPhysio()) return;

        const uid = await __gcGetUidAsync();
        if (!uid) { alert("Sem utilizador autenticado."); return; }

        try {
          const q = window.__gcPhysioQuill;
          if (q && q.root) s.draftHtml = q.root.innerHTML || "";
        } catch (_) {}

        const html = String(s.draftHtml || "").trim();
        if (!html || html === "<p><br></p>") { alert("Registo vazio."); return; }

        const clinicId = __gcGuessClinicIdForPhysioRecord();
        if (!clinicId) { alert("Sem clinic_id ativo para gravar o registo."); return; }

        s.saving = true;

        try {
          if (s.editingId) {
            const { error } = await window.sb
              .from("physio_records")
              .update({ content: html })
              .eq("id", s.editingId);
            if (error) throw error;
          } else {
            const { error } = await window.sb
              .from("physio_records")
              .insert([{
                clinic_id: clinicId,
                patient_id: p.id,
                author_user_id: uid,
                content: html
              }]);
            if (error) throw error;
          }

          s.composerOpen = false;
          s.editingId = null;
          s.draftHtml = "";
          window.__gcPhysioQuill = null;

          await loadPhysioRecords();
          render();

        } catch (e) {
          console.error(e);
          alert("Erro a gravar registo de fisioterapia.");
        } finally {
          s.saving = false;
        }

        return;
      }

      const actionBtn = t && t.closest ? t.closest("[data-physio-action]") : null;
      if (actionBtn) {
        ev.preventDefault();

        const action = actionBtn.getAttribute("data-physio-action");
        const id = actionBtn.getAttribute("data-physio-id");
        if (!action || !id) return;

        const uid = await __gcGetUidAsync();
        if (!__gcIsPhysio() || !uid) return;

        const row = (__ps().rows || []).find(x => String(x.id) === String(id));
        if (!row) return;
        if (String(row.author_user_id) !== String(uid)) return;

        if (action === "edit") {
          s.composerOpen = true;
          s.editingId = row.id;
          s.draftHtml = String(row.content || "");
          window.__gcPhysioQuill = null;
          render();
          return;
        }

        if (action === "delete") {
          if (!confirm("Apagar este registo de fisioterapia?")) return;
          try {
            const { error } = await window.sb
              .from("physio_records")
              .delete()
              .eq("id", row.id);
            if (error) throw error;
            await loadPhysioRecords();
            render();
          } catch (e) {
            console.error(e);
            alert("Erro a apagar registo de fisioterapia.");
          }
          return;
        }
      }
    });

    const obs = new MutationObserver(() => {
      try {
        const host = document.getElementById("physioQuillEditor");
        const tb = document.getElementById("physioQuillToolbar");
        if (!host || !tb) return;
        if (window.__gcPhysioQuill) return;
        if (!window.Quill) return;

        const q = new window.Quill(host, {
          theme: "snow",
          modules: { toolbar: tb }
        });

        q.root.setAttribute("spellcheck", "true");
        q.root.setAttribute("lang", "pt-PT");
        q.root.setAttribute("autocapitalize", "sentences");

        try {
          host.style.minHeight = "320px";
          q.root.style.minHeight = "320px";
          q.root.style.lineHeight = "1.35";
          q.root.style.fontSize = "15px";
        } catch (_) {}

        const s = __ps();
        const initialHtml = String(s.draftHtml || "");
        if (initialHtml.trim().length) {
          try { q.clipboard.dangerouslyPasteHTML(initialHtml); }
          catch (_) { q.setText(initialHtml); }
        } else {
          q.setText("");
        }

        q.on("text-change", () => {
          s.draftHtml = q.root.innerHTML || "";
        });

        s.draftHtml = q.root.innerHTML || "";
        window.__gcPhysioQuill = q;

        document.getElementById("physioQuillToolbar")?.querySelector(".ql-bold")?.addEventListener("mousedown", (e) => {
          e.preventDefault();
          const format = q.getFormat();
          q.format("bold", !format.bold);
        });
        document.getElementById("physioQuillToolbar")?.querySelector(".ql-underline")?.addEventListener("mousedown", (e) => {
          e.preventDefault();
          const format = q.getFormat();
          q.format("underline", !format.underline);
        });
      } catch (_) {}
    });

    obs.observe(document.body, { childList: true, subtree: true });
  }

  __gcInstallPhysioTimelineHooksOnce();
/* ==== FIM BLOCO 06G/12 ==== */


/* ==== INÍCIO BLOCO 06H/12 — Consulta médica ==== */

  function openConsultForEdit(consultId) {
    const row = (consultRows || []).find(x => String(x.id) === String(consultId));
    if (!row) { alert("Consulta não encontrada."); return; }

    editingConsultId = row.id || null;
    editingConsultRow = row || null;
    creatingConsult = true;

    draftHDAHtml = String(row.hda || "");

    diagQuery = "";
    diagLoading = false;
    diagResults = [];
    selectedDiag = Array.isArray(row.diagnoses)
      ? row.diagnoses.map(d => ({ id: d.id, label: d.label || "", code: d.code || "" }))
      : [];

    prescriptionText =
      getPrescriptionTextFromPlan(row.plan_text) ||
      "R/ 20 Sessões de Tratamentos de Medicina Fisica e de Reabilitação com:";

    treatQuery = "";
    treatLoading = false;
    treatResults = [];
    selectedTreat = Array.isArray(row.treatments)
      ? row.treatments.map(t => ({ id: t.id, label: t.label || "", code: t.code || "", qty: Number(t.qty || 1) }))
      : [];

    render();
    bindConsultEvents();
  }

  function renderConsultFormInline() {
    const today = new Date().toISOString().slice(0, 10);

    return `
    <div style="margin-top:16px; padding:16px; border:1px solid #e5e5e5; border-radius:14px;">

      <style>
        .gcQuillWrap { margin-top: 10px; }
        .gcQuillWrap .ql-toolbar.ql-snow { border: 1px solid #ddd; border-radius: 12px 12px 0 0; }
        .gcQuillWrap .ql-container.ql-snow { border: 1px solid #ddd; border-top: none; border-radius: 0 0 12px 12px; min-height: 240px; font-size: 16px; }
        .gcQuillWrap .ql-editor { line-height: 1.6; }
      </style>

      <div style="font-weight:900; font-size:16px;">Nova Consulta Médica</div>

      <div style="margin-top:10px;">
        <label>Data</label>
        <input type="date" value="${today}" readonly
               style="padding:8px; border:1px solid #ddd; border-radius:8px;" />
      </div>

      <div class="gcQuillWrap">
        <div id="hdaQuillToolbar">
          <span class="ql-formats">
            <button class="ql-bold"></button>
            <button class="ql-underline"></button>
          </span>
          <span class="ql-formats">
            <button class="ql-list" value="ordered"></button>
            <button class="ql-list" value="bullet"></button>
          </span>
          <span class="ql-formats">
            <button class="ql-clean"></button>
          </span>
        </div>
        <div id="hdaQuillEditor"></div>
      </div>

      <div style="margin-top:14px;">
        <label>Diagnóstico (catálogo)</label>
        <div style="position:relative; margin-top:6px; max-width:720px;">
          <input id="diagSearch" value="${escAttr(diagQuery)}"
                 placeholder="Pesquisar (mín. 2 letras)…"
                 style="width:100%; padding:10px; border:1px solid #ddd; border-radius:10px;" />
          <div id="diagStatus"></div>
          <div id="diagDropdownHost" style="position:relative;"></div>
        </div>
        <div id="diagChips"></div>
      </div>

      <div style="margin-top:14px;">
        <label>Tratamentos (catálogo)</label>
        <div style="margin-top:6px; max-width:980px;">
          <input id="prescriptionText" value="${escAttr(prescriptionText)}"
                 style="width:100%; padding:10px; border:1px solid #ddd; border-radius:10px;" />

          <div style="margin-top:6px; display:flex; gap:10px; flex-wrap:wrap;">
            <div style="flex:1; min-width:320px;">
              <div style="font-weight:900; margin-bottom:6px;">Selecionados</div>
              <div id="treatSelectedBox"
                   style="min-height:120px; padding:12px; border:1px solid #e5e5e5; border-radius:12px; background:#fff;"></div>
            </div>

            <div style="flex:1; min-width:320px;">
              <div style="font-weight:900; margin-bottom:6px;">Catálogo</div>
              <input id="treatSearch" value="${escAttr(treatQuery)}"
                     placeholder="Pesquisar tratamentos (mín. 2 letras)…"
                     style="width:100%; padding:10px; border:1px solid #ddd; border-radius:10px;" />
              <div id="treatStatus"></div>
              <div id="treatCatalogBox"
                   style="margin-top:8px; min-height:120px; max-height:220px; overflow:auto;
                          padding:12px; border:1px solid #e5e5e5; border-radius:12px; background:#fff;"></div>
            </div>
          </div>
        </div>
      </div>

      <div style="margin-top:14px; display:flex; justify-content:flex-start; gap:10px;">
        <button id="btnCancelConsult" class="gcBtn" type="button">Cancelar</button>
        <button id="btnSaveConsult" class="gcBtn" type="button" style="font-weight:900;">Gravar</button>
      </div>
    </div>
  `;
  }

  function bindConsultEvents() {
    const qRoot = document.getElementById("hdaQuillEditor");
    const qToolbar = document.getElementById("hdaQuillToolbar");

    window.__gcQuillHDA = null;

    if (qRoot && window.Quill) {
      const quill = new window.Quill(qRoot, {
        theme: "snow",
        modules: { toolbar: qToolbar }
      });

      quill.root.setAttribute("spellcheck", "true");
      quill.root.setAttribute("lang", "pt-PT");
      quill.root.setAttribute("autocapitalize", "sentences");

      window.__gcQuillHDA = quill;

      document.getElementById("hdaQuillToolbar")?.querySelector(".ql-bold")?.addEventListener("mousedown", (e) => {
        e.preventDefault();
        const format = quill.getFormat();
        quill.format("bold", !format.bold);
      });
      document.getElementById("hdaQuillToolbar")?.querySelector(".ql-underline")?.addEventListener("mousedown", (e) => {
        e.preventDefault();
        const format = quill.getFormat();
        quill.format("underline", !format.underline);
      });

      const initialHtml = String(draftHDAHtml || "");
      if (initialHtml.trim().length) {
        try { quill.clipboard.dangerouslyPasteHTML(initialHtml); }
        catch (_) { quill.setText(initialHtml); }
      } else {
        quill.setText("");
      }

      quill.on("text-change", () => {
        draftHDAHtml = quill.root.innerHTML || "";
      });

      draftHDAHtml = quill.root.innerHTML || "";
    }

    const diagInput = document.getElementById("diagSearch");
    if (diagInput) {
      diagInput.oninput = (e) => {
        const v = e?.target?.value ?? "";
        diagQuery = v;
        if (diagDebounceT) clearTimeout(diagDebounceT);
        diagDebounceT = setTimeout(() => searchDiagnoses(v), 220);
      };
      diagInput.onfocus = () => {
        const v = diagInput.value || "";
        if (String(v).trim().length >= 2) searchDiagnoses(v);
      };
      diagInput.onkeydown = (ev) => { if (ev.key === "Enter") ev.preventDefault(); };
    }

    renderDiagArea();

    const pr = document.getElementById("prescriptionText");
    if (pr) pr.oninput = (e) => { prescriptionText = e?.target?.value ?? ""; };

    const tInput = document.getElementById("treatSearch");
    if (tInput) {
      tInput.oninput = (e) => {
        const v = e?.target?.value ?? "";
        treatQuery = v;
        if (treatDebounceT) clearTimeout(treatDebounceT);
        treatDebounceT = setTimeout(() => searchTreatments(v), 220);
      };
      tInput.onfocus = () => {
        const v = tInput.value || "";
        if (String(v).trim().length >= 2) searchTreatments(v);
      };
      tInput.onkeydown = (ev) => { if (ev.key === "Enter") ev.preventDefault(); };
    }

    renderTreatArea();

    if (!treatResults || !treatResults.length) fetchTreatmentsDefault();

    document.getElementById("btnCancelConsult")?.addEventListener("click", () => {
      creatingConsult = false;
      render();
    });

    const btnSave = document.getElementById("btnSaveConsult");
    if (btnSave) {
      btnSave.disabled = !!saving;
      btnSave.onclick = async () => {
        if (saving) return;
        saving = true;
        btnSave.disabled = true;

        try {
          const quill = window.__gcQuillHDA;
          if (quill && quill.root) draftHDAHtml = quill.root.innerHTML || "";
        } catch (_) {}

        const ok = await saveConsult();

        saving = false;
        btnSave.disabled = false;

        if (ok) {
          creatingConsult = false;
          await loadConsultations();
          await loadDocuments();
          render();
        }
      };
    }
  }
/* ==== FIM BLOCO 06H/12 ==== */


/* ==== INÍCIO BLOCO 06I/12 — saveConsult ==== */

  async function saveConsult() {
    try {
      const userRes = await window.sb.auth.getUser();
      const userId = userRes?.data?.user?.id;
      if (!userId) { alert("Utilizador não autenticado."); return false; }

      const today = new Date().toISOString().slice(0, 10);
      const now = new Date();
      const isEditing = !!editingConsultId;

      if (!activeClinicId) { alert("Sem clínica ativa associada ao doente."); return false; }

      let appointmentId = null;

      if (!isEditing) {
        const { data: appts, error: apptErr } = await window.sb
          .from("appointments")
          .select("*")
          .eq("patient_id", p.id);

        if (apptErr) console.error(apptErr);

        if (appts && appts.length) {
          const sameDay = appts.filter(a => a.start_at && a.start_at.slice(0, 10) === today);
          if (sameDay.length) {
            sameDay.sort((a, b) => Math.abs(new Date(a.start_at) - now) - Math.abs(new Date(b.start_at) - now));
            appointmentId = sameDay[0].id;
          }
        }
      }

      const planPayload = {
        prescriptionText,
        treat_order: (selectedTreat || []).map(x => x.id)
      };

      let consultId = null;

      if (isEditing) {
        consultId = editingConsultId;

        const reportDateToKeep =
          (editingConsultRow && editingConsultRow.report_date)
            ? String(editingConsultRow.report_date)
            : today;

        const { error: updErr } = await window.sb
          .from("consultations")
          .update({
            clinic_id: activeClinicId,
            patient_id: p.id,
            report_date: reportDateToKeep,
            hda: draftHDAHtml,
            plan_text: JSON.stringify(planPayload)
          })
          .eq("id", consultId);

        if (updErr) {
          console.error(updErr);
          alert("Erro ao atualizar consulta.");
          return false;
        }
      } else {
        const { data: ins, error: insErr } = await window.sb
          .from("consultations")
          .insert({
            clinic_id: activeClinicId,
            patient_id: p.id,
            author_user_id: userId,
            report_date: today,
            hda: draftHDAHtml,
            assessment: "",
            plan_text: JSON.stringify(planPayload),
            appointment_id: appointmentId
          })
          .select("id")
          .single();

        if (insErr) {
          console.error(insErr);
          alert("Erro ao gravar consulta.");
          return false;
        }

        consultId = ins?.id || null;
      }

      if (!consultId) {
        alert("Não foi possível determinar a consulta a gravar.");
        return false;
      }

      lastSavedConsultId = consultId;

      const { error: delDiagErr } = await window.sb
        .from("consultation_diagnoses")
        .delete()
        .eq("consultation_id", consultId);

      if (delDiagErr) {
        console.error(delDiagErr);
        alert("Consulta gravada, mas houve erro a limpar diagnósticos antigos.");
        return false;
      }

      if (selectedDiag && selectedDiag.length) {
        const diagRows = selectedDiag
          .filter(x => x && x.id !== undefined && x.id !== null && String(x.id).trim() !== "")
          .map(x => ({
            consultation_id: consultId,
            diagnosis_id: String(x.id)
          }));

        console.log("DIAG ROWS TO INSERT:", diagRows);
        console.log("SELECTED DIAG RAW:", selectedDiag);

        if (diagRows.length) {
          const { error: dErr } = await window.sb
            .from("consultation_diagnoses")
            .insert(diagRows);

          if (dErr) {
            console.error("ERRO consultation_diagnoses:", dErr);
            alert("Consulta gravada, mas houve erro a gravar diagnósticos.");
            return false;
          }
        }
      }

      const { error: delTreatErr } = await window.sb
        .from("consultation_treatments")
        .delete()
        .eq("consultation_id", consultId);

      if (delTreatErr) {
        console.error(delTreatErr);
        alert("Consulta gravada, mas houve erro a limpar tratamentos antigos.");
        return false;
      }

      if (selectedTreat && selectedTreat.length) {
        const treatRows = selectedTreat.map(x => ({
          consultation_id: consultId,
          treatment_id: x.id,
          qty: Number(x.qty || 1)
        }));

        const { error: tErr } = await window.sb
          .from("consultation_treatments")
          .insert(treatRows);

        if (tErr) {
          console.error(tErr);
          alert("Consulta gravada, mas houve erro a gravar tratamentos.");
          return false;
        }
      }

      if (!isEditing && appointmentId) {
        const { error: uErr } = await window.sb
          .from("appointments")
          .update({ status: "done" })
          .eq("id", appointmentId);

        if (uErr) console.error(uErr);
      }

      try {
        if (typeof refreshAgenda === "function") await refreshAgenda();
        else if (typeof renderAgendaList === "function") renderAgendaList();
      } catch (e) {
        console.error("refreshAgenda falhou:", e);
      }

      editingConsultId = null;
      editingConsultRow = null;

      draftHDAHtml = "";
      diagQuery = ""; diagLoading = false; diagResults = []; selectedDiag = [];
      prescriptionText = "R/ 20 Sessões de Tratamentos de Medicina Fisica e de Reabilitação com:";
      treatQuery = ""; treatLoading = false; treatResults = []; selectedTreat = [];

      alert(isEditing ? "Consulta atualizada." : "Consulta gravada.");
      return true;

    } catch (err) {
      console.error(err);
      alert("Erro ao gravar consulta.");
      return false;
    }
  }
/* ==== FIM BLOCO 06I/12 ==== */


/* ==== INÍCIO BLOCO 06J/12 — Render + Wiring + Boot ==== */

  function render() {
    console.log("06J render OK");

    root.innerHTML = `
      <div style="position:fixed; inset:0; background:rgba(0,0,0,0.35);
                  display:flex; align-items:center; justify-content:center; padding:12px;">
        <div style="background:#fff; width:min(1400px,96vw);
                    height:92vh; border-radius:14px;
                    border:1px solid #e5e5e5; padding:18px; overflow:auto; box-sizing:border-box;">

          <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:10px;">
            <div style="font-weight:800; font-size:14px; color:#111827; letter-spacing:0.2px;">
              Feed do Doente
            </div>
            <button id="btnClosePView" class="gcBtn"
              style="background:#ffffff; border:1px solid #d1d5db; color:#111827; font-weight:700;">
              Fechar
            </button>
          </div>

          <div style="border:1px solid #e5e7eb; border-radius:14px; padding:16px; background:#fcfcfd;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap;">
              <div style="min-width:280px; flex:1;">
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                  <div style="font-weight:900; font-size:28px; line-height:1.1; color:#111827;">
                    ${escAttr(p.full_name || "—")}
                  </div>
                  <div>${birthdayBadgeToday()}</div>
                </div>

                <div style="margin-top:10px; display:flex; gap:10px 18px; flex-wrap:wrap; color:#475569; font-size:14px; line-height:1.45;">
                  <div><span style="font-weight:700; color:#334155;">Telefone:</span> ${escAttr(p.phone || "—")}</div>
                  <div><span style="font-weight:700; color:#334155;">Clínica:</span> ${escAttr(activeClinicName || "—")}</div>
                  <div><span style="font-weight:700; color:#334155;">SNS:</span> ${escAttr(p.sns || "—")}</div>
                  <div><span style="font-weight:700; color:#334155;">Seguro:</span> ${escAttr(p.insurance_provider || "—")}</div>
                  <div><span style="font-weight:700; color:#334155;">Nº:</span> ${escAttr(p.insurance_policy_number || "—")}</div>
                  <div><span style="font-weight:700; color:#334155;">Idade:</span> ${escAttr(ageTextToday())}</div>
                </div>
              </div>

              <div style="display:flex; gap:10px; align-items:flex-start; flex-wrap:wrap;">
                <button id="btnViewIdent" class="gcBtn"
                  style="background:#ffffff; border:1px solid #d1d5db; color:#111827; font-weight:700;">
                  Ver Identificação
                </button>
              </div>
            </div>

            <div style="margin-top:14px; height:1px; background:#e5e7eb;"></div>

            ${isDoctor() && !creatingConsult ? `
              <div style="margin-top:14px;">
                <div style="font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:0.6px; color:#64748b; margin-bottom:10px;">
                  Ações médicas
                </div>

                <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
                  <button id="btnNewConsult" class="gcBtn"
                    style="font-weight:800; background:#1e3a8a; border:1px solid #1e3a8a; color:#ffffff;">
                    Consulta Médica
                  </button>

                  <button id="btnMedicalReports" class="gcBtn"
                    style="background:#ffffff; border:1px solid #cbd5e1; color:#0f172a; font-weight:700;">
                    Relatórios
                  </button>

                  <button id="btnComplementaryExams" class="gcBtn"
                    style="background:#ffffff; border:1px solid #cbd5e1; color:#0f172a; font-weight:700;">
                    Exames
                  </button>

                  <button id="btnAnalyses" class="gcBtn"
                    style="background:#ffffff; border:1px solid #cbd5e1; color:#0f172a; font-weight:700;">
                    Análises
                  </button>
                </div>
              </div>
            ` : ``}

            ${docsLoading ? `
              <div style="margin-top:10px; color:#64748b; font-size:14px;">
                A carregar PDFs…
              </div>
            ` : ``}
          </div>

          ${creatingConsult ? renderConsultFormInline() : ""}

          <div style="margin-top:18px;">
            ${renderTimeline()}
          </div>

        </div>
      </div>

      ${identOpen ? renderIdentityModal() : ""}
      ${docOpen ? renderDocumentEditorModal() : ""}
    `;

    document.getElementById("btnClosePView")?.addEventListener("click", closeModalSafe);
    document.getElementById("btnViewIdent")?.addEventListener("click", () => openPatientIdentity("view"));

    if (isDoctor() && !creatingConsult) {
      document.getElementById("btnNewConsult")?.addEventListener("click", () => {
        editingConsultId = null;
        editingConsultRow = null;
        creatingConsult = true;
        render();
        bindConsultEvents();
      });

      document.getElementById("btnComplementaryExams")?.addEventListener("click", () => {
        const consultId = lastSavedConsultId || (consultRows && consultRows.length ? consultRows[0].id : null);
        if (typeof openExamsPanel === "function") openExamsPanel({ patientId: p.id, consultationId: consultId || null });
      });

      document.getElementById("btnAnalyses")?.addEventListener("click", () => {
        const consultId = lastSavedConsultId || (consultRows && consultRows.length ? consultRows[0].id : null);
        if (typeof openAnalisesModal === "function") openAnalisesModal({ patientId: p.id, consultationId: consultId || null });
      });
    }

    document.querySelectorAll('[data-action="edit-consult"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const consultId = btn.getAttribute("data-consult-id") || "";
        if (!consultId) return;
        openConsultForEdit(consultId);
      });
    });

    document.querySelectorAll('[data-action="consult-report"]').forEach((btn) => {
      btn.addEventListener("click", async () => {
        const consultId = btn.getAttribute("data-consult-id") || "";
        if (!consultId) return;

        const userRes = await window.sb.auth.getUser();
        const userId = userRes?.data?.user?.id;

        const consult = (consultRows || []).find(x => String(x.id) === String(consultId));
        if (!consult) { alert("Consulta não encontrada."); return; }

        const clinic = await fetchClinicForPdf();
        const authorName = userId ? await fetchCurrentUserDisplayName(userId) : "";

        let vinhetaUrl = "";
        try {
          const vinhetaSignedUrl = await storageSignedUrl(VINHETA_BUCKET, VINHETA_PATH, 3600);
          console.log("VINHETA signed URL:", vinhetaSignedUrl);

          if (vinhetaSignedUrl) {
            vinhetaUrl = await urlToDataUrl(vinhetaSignedUrl, "image/png");
          }

          console.log("VINHETA data URL prefix:", vinhetaUrl ? vinhetaUrl.slice(0, 80) : "(vazia)");
        } catch (e) {
          console.warn("Editor: vinheta falhou:", e);
          vinhetaUrl = "";
        }

        const html = buildDocV1Html({ clinic, consult, authorName, vinhetaUrl });
        openDocumentEditor(html);
      });
    });

    if (creatingConsult) bindConsultEvents();
    if (identOpen) bindIdentityEvents();
    if (docOpen) bindDocEvents();
  }

  (async function boot() {
    try {
      await fetchActiveClinic();
      await loadConsultations();
      await loadDocuments();
    } catch (e) {
      console.error("boot modal falhou:", e);
    }
    render();
  })();

} // <-- fecha openPatientViewModal
/* ==== FIM BLOCO 06J/12 ==== */


/* ==== INÍCIO BLOCO 07/12 — Novo doente (modal página inicial) ==== */

function openNewPatientMainModal({ clinicId }) {
  const root = document.getElementById("modalRoot");
  if (!root) return;

  if (!clinicId) {
    alert("Seleciona uma clínica (não pode ser 'Todas') para criar um doente.");
    return;
  }

  root.innerHTML = `
    <div id="npMainOverlay" style="position:fixed; inset:0; background:rgba(0,0,0,0.35); display:flex; align-items:center; justify-content:center; padding:18px;">
      <div style="background:#fff; width:min(860px, 100%); border-radius:14px; border:1px solid #e5e5e5; padding:14px; max-height: 86vh; overflow:auto;">
        <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start;">
          <div>
            <div style="font-size:${UI.fs14}px; font-weight:900; color:#111;">Novo doente</div>
            <div style="font-size:${UI.fs12}px; color:#666; margin-top:4px;">
              Nome obrigatório. Identificação: SNS (9 dígitos) ou NIF (9 dígitos) ou Passaporte/ID (4–20 alfanum).
            </div>
          </div>
          <button id="npMainClose" class="gcBtn">Fechar</button>
        </div>

        <div style="margin-top:12px; border:1px solid #eee; border-radius:12px; padding:12px; background:#fafafa;">
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
            <div style="display:flex; flex-direction:column; gap:4px; grid-column: 1 / -1;">
              <label class="gcLabel">Nome completo *</label>
              <input id="npFullName" type="text" autocomplete="off" autocapitalize="off" spellcheck="false"
                style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label class="gcLabel">Data nascimento</label>
              <input id="npDob" type="date"
                style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label class="gcLabel">Telefone</label>
              <input id="npPhone" type="text" autocomplete="off" autocapitalize="off" spellcheck="false"
                style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label class="gcLabel">Email</label>
              <input id="npEmail" type="email" autocomplete="off" autocapitalize="off" spellcheck="false"
                style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label class="gcLabel">SNS (9 dígitos)</label>
              <input id="npSNS" type="text" inputmode="numeric" placeholder="#########" autocomplete="off"
                style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label class="gcLabel">NIF (9 dígitos)</label>
              <input id="npNIF" type="text" inputmode="numeric" placeholder="#########" autocomplete="off"
                style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px; grid-column: 1 / -1;">
              <label class="gcLabel">Passaporte/ID (4–20)</label>
              <input id="npPassport" type="text" placeholder="AB123456" autocomplete="off" autocapitalize="off" spellcheck="false"
                style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label class="gcLabel">Seguro</label>
              <input id="npInsuranceProvider" type="text" autocomplete="off" autocapitalize="off" spellcheck="false"
                style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label class="gcLabel">Apólice</label>
              <input id="npInsurancePolicy" type="text" autocomplete="off" autocapitalize="off" spellcheck="false"
                style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px; grid-column: 1 / -1;">
              <label class="gcLabel">Morada</label>
              <input id="npAddress1" type="text" autocomplete="off" autocapitalize="off" spellcheck="false"
                style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label class="gcLabel">Código-postal</label>
              <input id="npPostal" type="text" autocomplete="off" autocapitalize="off" spellcheck="false"
                style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label class="gcLabel">Cidade</label>
              <input id="npCity" type="text" autocomplete="off" autocapitalize="off" spellcheck="false"
                style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px; grid-column: 1 / -1;">
              <label class="gcLabel">País</label>
              <input id="npCountry" type="text" value="PT" autocomplete="off" autocapitalize="off" spellcheck="false"
                style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; font-size:${UI.fs13}px;" />
            </div>

            <div style="display:flex; flex-direction:column; gap:4px; grid-column: 1 / -1;">
              <label class="gcLabel">Notas</label>
              <textarea id="npNotes" rows="2"
                style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; resize:vertical; font-size:${UI.fs13}px;"></textarea>
            </div>
          </div>

          <div style="margin-top:10px; display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
            <div id="npMsg" style="font-size:${UI.fs12}px; color:#666;"></div>
            <div style="display:flex; gap:10px;">
              <button id="npCancel" class="gcBtn">Cancelar</button>
              <button id="npCreate" class="gcBtn" style="font-weight:900;">Criar doente</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const overlay = document.getElementById("npMainOverlay");
  const btnClose = document.getElementById("npMainClose");
  const npCancel = document.getElementById("npCancel");
  const npCreate = document.getElementById("npCreate");
  const npMsg = document.getElementById("npMsg");

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

  /* ---- 07B — Estado local e fecho ---- */
  function setErr(msg) { if (npMsg) { npMsg.style.color = "#b00020"; npMsg.textContent = msg; } }
  function setInfo(msg) { if (npMsg) { npMsg.style.color = "#666"; npMsg.textContent = msg; } }
  function close() { closeModalRoot(); }

  if (btnClose) btnClose.addEventListener("click", close);
  if (npCancel) npCancel.addEventListener("click", close);
  if (overlay) overlay.addEventListener("click", (ev) => { if (ev.target && ev.target.id === "npMainOverlay") close(); });

  /* ---- 07C — Validação ---- */
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

  /* ---- 07D — Estado do botão ---- */
  function refreshButtonState() {
    if (npSNS) { const d = normalizeDigits(npSNS.value); if (npSNS.value !== d) npSNS.value = d; }
    if (npNIF) { const d = normalizeDigits(npNIF.value); if (npNIF.value !== d) npNIF.value = d; }

    const v = validate();
    if (!v.ok) { npCreate.disabled = true; setErr(v.msg); }
    else { npCreate.disabled = false; setInfo("OK para criar."); }
  }

  [
    npFullName, npDob, npPhone, npEmail, npSNS, npNIF, npPassport,
    npInsuranceProvider, npInsurancePolicy, npAddress1, npPostal, npCity, npCountry, npNotes
  ].forEach((el) => {
    if (!el) return;
    el.addEventListener("input", refreshButtonState);
    el.addEventListener("change", refreshButtonState);
  });

  /* ---- 07E — Criação do doente ---- */
  if (npCreate) {
    npCreate.addEventListener("click", async () => {
      const v = validate();
      if (!v.ok) { setErr(v.msg); return; }

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

        const minimal = {
          id: newPatientId,
          full_name: v.full_name,
          phone: v.phone,
          email: v.email,
          sns: v.sns,
          nif: v.nif,
          passport_id: v.passport_id,
        };
        G.patientQuick.selected = minimal;

        const q = document.getElementById("pQuickQuery");
        if (q) q.value = "";
        const rHost = document.getElementById("pQuickResults");
        if (rHost) { rHost.innerHTML = ""; rHost.style.display = "none"; }

        close();
      } catch (e) {
        console.error("Criar doente (main) falhou:", e);
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
  }

  npCreate.disabled = true;
  setInfo("Preenche o Nome e um identificador (SNS/NIF/Passaporte).");
  refreshButtonState();
}
/* ==== FIM BLOCO 07/12 ==== */


/* ========================================================
   EXPORTS
   ======================================================== */
export {
  openPatientViewModal,
  openNewPatientMainModal,
};
