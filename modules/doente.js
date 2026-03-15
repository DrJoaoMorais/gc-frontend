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

// Expor G para uso em closures (closeModalSafe)
window.__gc_G = G;
import {
  calcAgeYears,
  isBirthdayOnDate,
  fmtDatePt,
  fmtTime,
  normalizeDigits,
} from "./helpers.js";
import { closeModalRoot, ensurePatientActiveInClinic } from "./agenda.js";
import { rpcCreatePatientForClinic } from "./db.js";
import { examsUiState, buildExamRequestHtml } from "./exames.js";
import { analisesUiState, openAnalisesPanel, closeAnalisesPanel } from "./analises.js";

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

  // Usar gc-content como contentor principal (página inteira, sem modal)
  const gcContent = document.querySelector(".gc-content");
  const root = gcContent || document.getElementById("modalRoot");
  if (!root || !patient) return;

  // Activar sidebar "Doentes"
  document.querySelectorAll(".gc-nav-btn").forEach(b => b.classList.remove("active"));
  const navDoentes = document.querySelector('[data-nav="doentes"]');
  if (navDoentes) navDoentes.classList.add("active");

  // Highlight the Agenda nav button as "go back" shortcut
  const navAgenda = document.querySelector('[data-nav="agenda"]');
  if (navAgenda) {
    navAgenda.setAttribute("title", "Voltar à Agenda (atalho)");
    navAgenda.style.setProperty("box-shadow", "inset 2px 0 0 #1a56db", "important");
    navAgenda.style.opacity = "1";
  }

  // Guardar scroll position
  if (gcContent) gcContent.scrollTop = 0;

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
    // Reset agenda nav highlight
    try {
      const navAgenda = document.querySelector('[data-nav="agenda"]');
      if (navAgenda) {
        navAgenda.style.removeProperty("box-shadow");
        navAgenda.removeAttribute("title");
      }
    } catch (_) {}
    // Voltar à agenda — re-render a view de agenda
    try {
      const G_ref = window.__gc_G || (typeof G !== "undefined" ? G : null);
      if (G_ref) G_ref.currentView = "agenda";
    } catch (_) {}
    if (typeof window.__gc_renderCurrentView === "function") {
      window.__gc_renderCurrentView();
    } else {
      // fallback
      try { root.innerHTML = ""; } catch (_) {}
      try { if (typeof closeModalRoot === "function") closeModalRoot(); } catch (_) {}
    }
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
                    height:92vh; display:flex; flex-direction:column;
                    border-radius:14px; border:1px solid #e5e5e5; overflow:hidden;">

          <!-- HEADER fixo -->
          <div style="padding:14px 16px; border-bottom:1px solid #e5e5e5; flex-shrink:0;">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
              <div style="font-weight:900; font-size:16px;">
                Documento v1 — ${docMode === "preview" ? "pré-visualização" : (docMode === "html" ? "editar HTML" : "editor visual")}
              </div>
              <button id="btnDocCloseTop" class="gcBtn">Fechar</button>
            </div>

            <div style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
              <div style="flex:1; min-width:260px;">
                <label>Título</label>
                <input id="docTitle" value="${escAttr(docTitle)}"
                       style="width:100%; padding:10px; border:1px solid #ddd; border-radius:10px;" />
              </div>
              <div style="display:flex; gap:8px; align-items:flex-end;">
                <button id="btnDocModeVisual" class="gcBtn" ${docMode === "visual" ? `style="font-weight:900;"` : ``}>Editor</button>
                <button id="btnDocModeHtml"   class="gcBtn" ${docMode === "html"    ? `style="font-weight:900;"` : ``}>HTML</button>
                <button id="btnDocModePreview" class="gcBtn" ${docMode === "preview" ? `style="font-weight:900;"` : ``}>Pré-visualizar</button>
              </div>
            </div>
          </div>

          <!-- CONTEÚDO com scroll -->
          <div style="flex:1; overflow:auto; padding:12px 16px;">
            ${docMode === "html" ? `
              <textarea id="docHtml"
                        style="width:100%; height:100%; min-height:300px; padding:12px; border:1px solid #ddd; border-radius:12px;
                               font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Courier New',monospace;
                               font-size:12px; line-height:1.4; box-sizing:border-box;">${escAttr(docDraftHtml)}</textarea>
            ` : `
              <div style="border:1px solid #e5e5e5; border-radius:12px; overflow:hidden; height:100%; display:flex; flex-direction:column;">
                ${docMode === "visual" ? `
                <div id="docToolbar" style="display:flex; gap:4px; padding:8px 10px; background:#f8f8f8; border-bottom:1px solid #e5e5e5; flex-wrap:wrap; align-items:center; flex-shrink:0;">
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
                <iframe id="docFrame" style="flex:1; width:100%; border:0; background:#fff; min-height:200px;"></iframe>
              </div>
            `}
          </div>

          <!-- FOOTER fixo — sempre visível -->
          <div style="padding:12px 16px; border-top:1px solid #e5e5e5; background:#f8fafc;
                      display:flex; justify-content:space-between; align-items:center; gap:10px; flex-shrink:0;">
            <div id="docStatus" style="font-size:13px; color:#64748b; display:flex; align-items:center; gap:8px;">
              ${docSaving ? `
                <div style="width:16px; height:16px; border:2px solid #cbd5e1; border-top-color:#1a56db;
                             border-radius:50%; animation:gcSpin 0.7s linear infinite; flex-shrink:0;"></div>
                <span style="color:#1a56db; font-weight:600;">A gerar PDF…</span>
              ` : ""}
            </div>
            <div style="display:flex; gap:10px;">
              <button id="btnDocCancel" class="gcBtn">Cancelar</button>
              <button id="btnDocGeneratePdfNow" class="gcBtn"
                style="font-weight:900; background:#1a56db; border:1px solid #1a56db; color:#fff; padding:8px 20px;">
                Gerar PDF (v1)
              </button>
            </div>
          </div>

        </div>
      </div>
      <style>
        @keyframes gcSpin { to { transform: rotate(360deg); } }
      </style>
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

          /* Verificar se há mais PDFs de exames na fila */
          const queue = window.__gc_pendingExamQueue;
          if (Array.isArray(queue) && queue.length > 0) {
            const next = queue.shift();
            window.__gc_pendingExamQueue = queue;

            const nextHtml = buildExamRequestHtml({
              clinic:        next.clinic,
              examName:      next.examName,
              clinicalInfo:  next.clinicalInfo  || "",
              examDate:      next.examDate      || "",
              vinhetaUrl:    next.vinhetaUrl    || "",
              clinicLogoUrl: next.clinicLogoUrl || "",
              signatureUrl:  ""
            });
            window.__gc_pendingExamCtx = {
              patientId:      next.patientId,
              clinicId:       next.clinicId,
              consultationId: next.consultationId || null,
              examName:       next.grp || next.examName
            };
            await loadDocuments();
            openDocumentEditor(nextHtml, `Pedido de Exame — ${next.grp || ""}`);
          } else {
            window.__gc_pendingExamQueue = [];
            await loadDocuments();
            render();
          }
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
      /* Se há contexto de exame, usar esse — senão usar o contexto da consulta */
      const examCtx = window.__gc_pendingExamCtx || null;

      const targetPatientId      = examCtx?.patientId      || p.id;
      const targetClinicId       = examCtx?.clinicId       || activeClinicId;
      const targetConsultationId = examCtx?.consultationId || lastSavedConsultId;

      if (!targetConsultationId) { alert("Sem consulta gravada para gerar PDF."); return false; }
      if (!targetClinicId)       { alert("Sem clínica ativa."); return false; }

      const userRes = await window.sb.auth.getUser();
      const userId = userRes?.data?.user?.id;
      if (!userId) { alert("Utilizador não autenticado."); return false; }

      const consult = (consultRows || []).find(x => String(x.id) === String(targetConsultationId));
      if (!consult) { alert("Não encontrei a consulta no feed. Atualiza o feed e tenta novamente."); return false; }

      if (!docDraftHtml || !docDraftHtml.trim()) {
        alert("Sem conteúdo no editor para gerar PDF.");
        return false;
      }

      const titleSafe = safeText(docTitle || "Documento");

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
      const path = `clinic_${targetClinicId}/patient_${targetPatientId}/consult_${consult.id}/v${version}_${ymd}_${hms}.pdf`;

      const up = await uploadPdfToStorage({ blob, path });
      if (!up.ok) {
        const msg = String(up.error?.message || up.error?.error || up.error || "erro desconhecido");
        alert(`Falhou o upload do PDF para Storage.\nDetalhe: ${msg}`);
        return false;
      }

      const ins = await insertDocumentRow({
        clinic_id:      targetClinicId,
        patient_id:     targetPatientId,
        consultation_id: consult.id,
        title:          titleSafe,
        html:           "",
        parent_document_id: null,
        version,
        storage_path:   path
      });

      if (!ins.ok) {
        const msg = String(ins.error?.message || ins.error?.error || ins.error || "erro desconhecido");
        alert(`PDF enviado para Storage, mas falhou o registo na tabela documents.\nDetalhe: ${msg}`);
        return false;
      }

      /* Limpar contexto de exame após gravação bem-sucedida */
      window.__gc_pendingExamCtx = null;

      alert("PDF criado com sucesso.");
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
    window.__gc_openPatientViewModal = openPatientViewModal;
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
                  ${(() => { try { const _d = d.created_at ? new Date(d.created_at) : null; return (_d && !isNaN(_d.getTime())) ? `${fmtDatePt(_d)} às ${fmtTime(_d)}` : (d.created_at ? escAttr(String(d.created_at)) : ""); } catch(_) { return d.created_at ? escAttr(String(d.created_at)) : ""; } })()}
                </div>
              </div>
              <div style="display:flex; gap:8px;">
                ${d.url
                  ? (() => {
                      const _dDate = d.created_at ? new Date(d.created_at) : new Date();
                      const _ymd = `${_dDate.getFullYear()}-${String(_dDate.getMonth()+1).padStart(2,'0')}-${String(_dDate.getDate()).padStart(2,'0')}`;
                      const _words = (p.full_name || '').trim().split(/\s+/);
                      const _initials = (_words.length >= 2
                        ? (_words[0][0] + _words[_words.length - 1][0])
                        : (_words[0] ? _words[0].slice(0,2) : 'XX')
                      ).toUpperCase();
                      const _clinic = (activeClinicName || '').replace(/[^a-zA-Z0-9À-ÿ]/g, '').slice(0,20) || 'Clinica';
                      const _dlName = `GCC_${_initials}_${_clinic}_${_ymd}.pdf`;
                      return `<a class="gcBtn" href="${escAttr(d.url)}" target="_blank" rel="noopener" style="text-decoration:none;">Abrir</a>
                              <a class="gcBtn" href="${escAttr(d.url)}" download="${escAttr(_dlName)}" rel="noopener"
                                style="text-decoration:none; background:#f0f9ff; border:1px solid #bae6fd; color:#0369a1; font-weight:700;"
                                title="${escAttr(_dlName)}">⬇</a>`;
                    })()
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
          #physioQuillEditor .ql-editor { min-height: 320px; line-height: 1.35; font-size: 14px; }
          #physioQuillEditor .ql-editor p { margin:0; }
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

  /* ── renderHdaWithCollapsibleExams ──────────────────────────────────
     Detecta blocos de exame objectivo pelo marcador:
       "── ARTICULAÇÃO — EXAME OBJECTIVO ──"
     e encapsula-os num <details> colapsável no feed.
  ── */
  function renderHdaWithCollapsibleExams(hda) {
    if (!hda || !String(hda).trim()) return '<span style="color:#64748b;">—</span>';

    var sanitized = sanitizeHTML(String(hda));

    if (sanitized.indexOf('EXAME OBJECTIVO') === -1) {
      return sanitized;
    }

    // Dividir por </p> para processar linha a linha
    var parts = sanitized.split('</p>');
    var result = '';
    var inExam = false;
    var examTitle = '';
    var examLines = [];

    for (var i = 0; i < parts.length; i++) {
      var seg = parts[i];
      if (!seg.trim()) continue;

      // Texto puro (sem tags HTML)
      var textOnly = seg.replace(/<[^>]+>/g, '').trim();

      var isExamHeader = /──.*EXAME OBJECTIVO.*──/.test(textOnly);
      var isSeparator  = /^─{10,}/.test(textOnly);

      if (isExamHeader) {
        // Fechar bloco anterior se estava aberto
        if (inExam && examLines.length) {
          result += _wrapExamBlock(examTitle, examLines);
          examLines = [];
        }
        inExam = true;
        // Extrair nome: "── OMBRO — EXAME OBJECTIVO ──" → "OMBRO"
        var m = textOnly.match(/──\s*([^—]+)\s*—/);
        examTitle = m ? m[1].trim() : 'Exame Objectivo';

      } else if (isSeparator && inExam) {
        result += _wrapExamBlock(examTitle, examLines);
        examLines = [];
        inExam = false;

      } else if (inExam) {
        if (textOnly) examLines.push(textOnly);

      } else {
        if (seg.trim()) result += seg.trim() + '</p>';
      }
    }

    // Fechar bloco aberto no fim (sem separador)
    if (inExam && examLines.length) {
      result += _wrapExamBlock(examTitle, examLines);
    }

    return result || sanitized;
  }

  function _wrapExamBlock(title, lines) {
    var body = lines.join('\n');
    return (
      '<details style="margin:5px 0; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden;">' +
      '<summary style="cursor:pointer; padding:6px 12px; background:#f8fafc; font-size:12px;' +
      ' font-weight:700; color:#1a56db; user-select:none; list-style:none;' +
      ' display:flex; align-items:center; gap:6px;">' +
      '<span>\uD83D\uDD0D</span>' +
      '<span>Exame Objectivo \u2014 ' + title + '</span>' +
      '<span style="margin-left:auto; font-size:11px; color:#94a3b8; font-weight:400;">clique para expandir</span>' +
      '</summary>' +
      '<div style="padding:8px 14px; font-size:12px; line-height:1.3; color:#374151;' +
      ' white-space:pre-wrap; font-family:inherit;">' +
      body +
      '</div>' +
      '</details>'
    );
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
                <div class="gcHdaFeed" style="font-size:14px; color:#111827;">
                  ${renderHdaWithCollapsibleExams(r.hda || "")}
                </div>
                <style>.gcHdaFeed p{margin:0;line-height:1.4;}.gcHdaFeed br{display:none;}.gcHdaFeed p+p{margin-top:2px;}.gcHdaFeed p:empty{display:none;}</style>

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
    <div style="margin-top:16px; border:1px solid #e5e5e5; border-radius:14px; background:#ffffff; display:flex; flex-direction:column;">

      <style>
        #hdaEditor h2 { font-size:18px; font-weight:800; margin:10px 0 4px; color:#0f172a; }
        #hdaEditor h3 { font-size:15px; font-weight:700; margin:8px 0 3px; color:#0f172a; }
        #hdaEditor ul, #hdaEditor ol { margin:6px 0 6px 22px; padding:0; }
        #hdaEditor li { margin:1px 0; line-height:1.35; }
        #hdaEditor p { margin:0; line-height:1.35; }
        #hdaEditor p + p { margin-top:1px; }
        #hdaEditor p  { margin:4px 0; }
        #hdaToolbar button.active { background:#e0eaff; border-color:#1a56db; color:#1a56db; }
      </style>

      <div style="padding:14px 16px; border-bottom:1px solid #f1f5f9; display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
        <div style="font-weight:900; font-size:15px; color:#0f172a;">
          ${editingConsultId ? "Editar Consulta Médica" : "Nova Consulta Médica"}
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:12px; font-weight:700; color:#64748b;">Data</span>
          <input type="date" id="consultDate" value="${editingConsultRow?.report_date || today}"
                 style="padding:6px 10px; border:1px solid #e2e8f0; border-radius:8px; font-size:13px; color:#0f172a; background:#fff;" />
        </div>
      </div>

      <div style="padding:16px; flex:1;">

        <div style="font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; color:#64748b; margin-bottom:6px;">
          Anamnese / História Clínica (HDA)
        </div>
        <div class="gcQuillWrap" style="border:1px solid #ddd; border-radius:12px; overflow:hidden;">
          <style>
            .gcQuillWrap .ql-toolbar.ql-snow { border:none; border-bottom:1px solid #e5e7eb; border-radius:0; background:#f8fafc; }
            .gcQuillWrap .ql-container.ql-snow { border:none; }
            .gcQuillWrap .ql-editor { min-height:200px; font-size:14px; line-height:1.35; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif; }
            .gcQuillWrap .ql-editor p { margin:0; }
            .gcQuillWrap .ql-editor p + p { margin-top:1px; }
          </style>
          <div id="hdaQuillToolbar">
            <span class="ql-formats">
              <button class="ql-bold"></button>
              <button class="ql-italic"></button>
              <button class="ql-underline"></button>
            </span>
            <span class="ql-formats">
              <select class="ql-header">
                <option value="2">Título</option>
                <option value="3">Subtítulo</option>
                <option selected></option>
              </select>
            </span>
            <span class="ql-formats">
              <button class="ql-list" value="bullet"></button>
              <button class="ql-list" value="ordered"></button>
            </span>
            <span class="ql-formats">
              <button class="ql-clean"></button>
            </span>
          </div>
          <div id="hdaQuillEditor"></div>
        </div>

        <div style="margin-top:16px;">
          <div style="font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; color:#64748b; margin-bottom:6px;">Diagnóstico (catálogo)</div>
          <div style="position:relative; max-width:720px;">
            <input id="diagSearch" value="${escAttr(diagQuery)}"
                   placeholder="Pesquisar (mín. 2 letras)…"
                   style="width:100%; padding:10px; border:1px solid #ddd; border-radius:10px;" />
            <div id="diagStatus"></div>
            <div id="diagDropdownHost" style="position:relative;"></div>
          </div>
          <div id="diagChips"></div>
        </div>

        <div style="margin-top:16px;">
          <div style="font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; color:#64748b; margin-bottom:6px;">Plano terapêutico</div>
          <input id="prescriptionText" value="${escAttr(prescriptionText)}"
                 style="width:100%; padding:10px; border:1px solid #ddd; border-radius:10px;" />

          <div style="margin-top:8px; display:flex; gap:10px; flex-wrap:wrap;">

            <div style="flex:1; min-width:320px; display:flex; flex-direction:column;">
              <div style="font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; color:#64748b; margin-bottom:6px;">Seleccionados</div>
              <div id="treatSelectedBox"
                   style="flex:1; min-height:220px; max-height:300px; overflow:auto;
                          padding:12px; border:1px solid #e5e5e5; border-radius:12px; background:#fff;"></div>
            </div>

            <div style="flex:1; min-width:320px; display:flex; flex-direction:column;">
              <div style="font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; color:#64748b; margin-bottom:6px;">Catálogo</div>
              <input id="treatSearch" value="${escAttr(treatQuery)}"
                     placeholder="Pesquisar tratamentos (mín. 2 letras)…"
                     style="width:100%; padding:10px; border:1px solid #ddd; border-radius:10px;" />
              <div id="treatStatus"></div>
              <div id="treatCatalogBox"
                   style="margin-top:8px; min-height:160px; max-height:220px; overflow:auto;
                          padding:12px; border:1px solid #e5e5e5; border-radius:12px; background:#fff;"></div>
              <div style="margin-top:8px; display:flex; gap:6px; align-items:center;">
                <input id="treatCustomInput"
                       placeholder="Tratamento livre (não catalogado)…"
                       style="flex:1; padding:8px 10px; border:1px solid #ddd; border-radius:8px; font-size:13px;" />
                <button id="btnAddCustomTreat" class="gcBtn" type="button"
                  style="padding:8px 12px; font-weight:700; background:#f0f9ff; border:1px solid #bcd4f5; color:#1d6db5; white-space:nowrap; flex-shrink:0;">
                  + Adicionar
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>

      <div style="padding:12px 16px; border-top:1px solid #e5e7eb; background:#f8fafc;
                  border-radius:0 0 14px 14px; display:flex; align-items:center; justify-content:space-between; gap:10px;">
        <button id="btnSaveConsult" class="gcBtn" type="button"
          style="font-weight:800; background:#1a56db; border:1px solid #1a56db; color:#ffffff; padding:9px 24px; font-size:14px;">
          Gravar Consulta
        </button>
        <button id="btnCancelConsult" class="gcBtn" type="button">Cancelar</button>
      </div>

    </div>
  `;
  }

  function bindConsultEvents() {
    /* ---- Editor HDA — Quill nativo ---- */
    window.__gcQuillHDA = null;
    const qRoot    = document.getElementById("hdaQuillEditor");
    const qToolbar = document.getElementById("hdaQuillToolbar");
    if (qRoot && window.Quill) {
      const quill = new window.Quill(qRoot, {
        theme:   "snow",
        modules: { toolbar: qToolbar }
      });
      quill.root.setAttribute("spellcheck",     "true");
      quill.root.setAttribute("lang",           "pt-PT");
      quill.root.setAttribute("autocapitalize", "sentences");
      const initial = String(draftHDAHtml || "").trim();
      if (initial) {
        try { quill.clipboard.dangerouslyPasteHTML(initial); }
        catch(_) { quill.setText(initial); }
      }
      quill.on("text-change", () => { draftHDAHtml = quill.root.innerHTML || ""; });
      window.__gcQuillHDA = quill;
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

    /* Tratamento livre — não catalogado */
    const btnCustom = document.getElementById("btnAddCustomTreat");
    const inputCustom = document.getElementById("treatCustomInput");
    function addCustomTreat() {
      const label = String(inputCustom?.value || "").trim();
      if (!label) return;
      const customId = `custom_${Date.now()}`;
      addTreatment({ id: customId, label, code: "" });
      if (inputCustom) inputCustom.value = "";
    }
    btnCustom?.addEventListener("click", addCustomTreat);
    inputCustom?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); addCustomTreat(); }
    });

    document.getElementById("btnCancelConsult")?.addEventListener("click", () => {
      if (window.__gcTiptapEditor) { try { window.__gcTiptapEditor.destroy(); } catch(_){} window.__gcTiptapEditor = null; }
      window.__gcQuillHDA = null;
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
          const q = window.__gcQuillHDA;
          if (q) draftHDAHtml = q.root.innerHTML || "";
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
      <style>
        /* ── Patient view layout ── */
        .gc-pv {
          display:flex; gap:0;
          /* Break out of gc-content padding by going full negative */
          margin:-16px -20px -20px;
          min-height:calc(100vh - 0px);
        }

        /* ── Left action sidebar ── */
        .gc-pv-sb {
          width:188px; flex-shrink:0;
          position:sticky; top:0; align-self:flex-start;
          height:100vh; overflow-y:auto;
          background:#f8fafc; border-right:1px solid #e5e7eb;
          padding:12px 8px 20px;
          display:flex; flex-direction:column; gap:2px;
          box-sizing:border-box;
        }

        /* ── Main feed ── */
        .gc-pv-feed {
          flex:1; min-width:0;
          padding:0 20px 40px;
          overflow-y:auto;
        }

        /* ── Patient header strip ── */
        .gc-pv-header {
          position:sticky; top:0; z-index:10;
          background:#fff; border-bottom:2px solid #0f2d52;
          padding:10px 0 10px;
          margin-bottom:16px;
        }
        .gc-pv-name {
          font-weight:900; font-size:22px; line-height:1.15; color:#0f2d52;
          display:flex; align-items:center; gap:8px;
        }
        .gc-pv-meta {
          display:flex; gap:4px 14px; flex-wrap:wrap;
          font-size:13px; color:#475569; margin-top:5px;
        }
        .gc-pv-meta b { color:#0f2d52; font-weight:700; }

        /* ── Sidebar buttons ── */
        .gc-sb-btn {
          display:flex; align-items:center; gap:8px;
          width:100%; text-align:left; padding:7px 10px;
          border-radius:9px; border:1px solid transparent;
          background:none; color:#374151; font-size:13px;
          cursor:pointer; font-family:inherit;
          transition:background .1s, border-color .1s;
          white-space:nowrap; overflow:hidden;
        }
        .gc-sb-btn:hover { background:#fff; border-color:#e2e8f0; }
        .gc-sb-btn--active { background:#eff6ff; border-color:#1a56db; color:#1a56db; font-weight:700; }
        .gc-sb-btn--primary { background:#1a56db; border-color:#1a56db; color:#fff; font-weight:700; }
        .gc-sb-btn--primary:hover { background:#1749be; }
        .gc-sb-icon { font-size:15px; flex-shrink:0; line-height:1; }
        .gc-sb-div { height:1px; background:#e5e7eb; margin:5px 2px; }
        .gc-sb-lbl {
          font-size:10px; font-weight:800; text-transform:uppercase;
          letter-spacing:0.06em; color:#94a3b8; padding:3px 10px 2px; margin-top:3px;
        }
        .gc-sb-pname {
          font-size:12px; font-weight:700; color:#0f2d52;
          padding:3px 10px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        }
        .gc-sb-pmeta {
          font-size:11px; color:#64748b; padding:0 10px 2px; line-height:1.55;
        }

        /* ── Responsive collapse ── */
        @media (max-width:680px) {
          .gc-pv-sb { width:48px; padding:8px 4px; }
          .gc-sb-btn span:not(.gc-sb-icon) { display:none; }
          .gc-sb-lbl,.gc-sb-pname,.gc-sb-pmeta { display:none; }
          .gc-pv-header { padding:8px 0 6px; }
          .gc-pv-name { font-size:16px; }
        }

        /* ── Action btn classes (kept for compatibility) ── */
        .gc-action-btn { font-weight:700!important; background:#ffffff!important; border:1px solid #cbd5e1!important; color:#0f172a!important; }
        .gc-action-btn--active-primary { background:#1a56db!important; border-color:#1a56db!important; color:#fff!important; font-weight:800!important; }
        .gc-action-btn--active-border { background:#eff6ff!important; border-color:#1a56db!important; color:#1a56db!important; }
      </style>

      <div class="gc-pv">

        <!-- ════ SIDEBAR ════ -->
        <div class="gc-pv-sb">

          <!-- Patient info -->
          <div class="gc-sb-pname">${escAttr(p.full_name || "—")} ${birthdayBadgeToday()}</div>
          <div class="gc-sb-pmeta">
            ${escAttr(activeClinicName || "—")}${p.sns ? '<br>SNS ' + escAttr(p.sns) : ''}${ageTextToday() !== '—' ? '<br>' + escAttr(ageTextToday()) : ''}
          </div>

          <div class="gc-sb-div"></div>

          ${isDoctor() ? `
            <div class="gc-sb-lbl">Ações</div>

            <button id="btnNewConsult" class="gc-sb-btn ${creatingConsult ? 'gc-sb-btn--primary' : ''}">
              <span class="gc-sb-icon">📋</span><span>Consulta</span>
            </button>

            <button id="btnExameObjectivo" class="gc-sb-btn">
              <span class="gc-sb-icon">🔍</span><span>Exame Objectivo</span>
            </button>

            <button id="btnMedicalReports" class="gc-sb-btn">
              <span class="gc-sb-icon">📄</span><span>Relatórios</span>
            </button>

            <button id="btnComplementaryExams" class="gc-sb-btn ${examsUiState?.isOpen ? 'gc-sb-btn--active' : ''}">
              <span class="gc-sb-icon">🧪</span><span>Exames</span>
            </button>

            <button id="btnAnalyses" class="gc-sb-btn ${analisesUiState?.isOpen ? 'gc-sb-btn--active' : ''}">
              <span class="gc-sb-icon">🔬</span><span>Análises</span>
            </button>

            <div class="gc-sb-div"></div>
          ` : ``}

          <button id="btnViewIdent" class="gc-sb-btn" style="color:#64748b;">
            <span class="gc-sb-icon">👤</span><span>Identificação</span>
          </button>

          ${docsLoading ? `<div style="font-size:11px;color:#94a3b8;padding:3px 10px;">A carregar…</div>` : ``}
        </div>

        <!-- ════ FEED ════ -->
        <div class="gc-pv-feed">

          <!-- Sticky patient header -->
          <div class="gc-pv-header">
            <div class="gc-pv-name">
              ${escAttr(p.full_name || "—")} ${birthdayBadgeToday()}
            </div>
            <div class="gc-pv-meta">
              <div><b>Clínica:</b> ${escAttr(activeClinicName || "—")}</div>
              ${p.sns ? `<div><b>SNS:</b> ${escAttr(p.sns)}</div>` : ''}
              ${p.phone ? `<div><b>Tel:</b> ${escAttr(p.phone)}</div>` : ''}
              ${p.insurance_provider ? `<div><b>Seguro:</b> ${escAttr(p.insurance_provider)}</div>` : ''}
              ${p.insurance_policy_number ? `<div><b>Nº apólice:</b> ${escAttr(p.insurance_policy_number)}</div>` : ''}
              ${ageTextToday() !== '—' ? `<div><b>Idade:</b> ${escAttr(ageTextToday())}</div>` : ''}
            </div>
          </div>

          ${creatingConsult ? renderConsultFormInline() : ""}

          <div style="margin-top:${creatingConsult ? '16px' : '0'};">
            ${renderTimeline()}
          </div>

        </div>

      </div>

      ${identOpen ? renderIdentityModal() : ""}
      ${docOpen ? renderDocumentEditorModal() : ""}
    `;

    document.getElementById("btnViewIdent")?.addEventListener("click", () => openPatientIdentity("view"));

    // Exame Objectivo — sempre disponível, independente do estado da consulta
    document.getElementById("btnExameObjectivo")?.addEventListener("click", () => {
      openExameObjectivoMenu(document.getElementById("btnExameObjectivo"));
    });

    if (isDoctor()) {
      // Nova consulta — só quando não há consulta aberta
      if (!creatingConsult) {
        document.getElementById("btnNewConsult")?.addEventListener("click", () => {
          editingConsultId = null;
          editingConsultRow = null;
          creatingConsult = true;
          render();
          bindConsultEvents();
        });
      }

      // Relatórios, Exames e Análises — sempre disponíveis
      document.getElementById("btnMedicalReports")?.addEventListener("click", (e) => {
        openReportsMenu(e.currentTarget);
      });

      document.getElementById("btnComplementaryExams")?.addEventListener("click", () => {
        const consultId = lastSavedConsultId || (consultRows && consultRows.length ? consultRows[0].id : null);
        if (examsUiState.isOpen) {
          if (typeof closeExamsPanel === "function") closeExamsPanel();
          examsUiState.isOpen = false;
          render();
        } else {
          if (typeof openExamsPanel === "function") openExamsPanel({ patientId: p.id, consultationId: consultId || null, onClose: () => { render(); } });
          render();
        }
      });

      document.getElementById("btnAnalyses")?.addEventListener("click", () => {
        const consultId = lastSavedConsultId || (consultRows && consultRows.length ? consultRows[0].id : null);
        if (analisesUiState.isOpen) {
          closeAnalisesPanel();
          analisesUiState.isOpen = false;
          render();
        } else {
          openAnalisesPanel({ patientId: p.id, consultationId: consultId || null, onClose: () => { render(); } });
          render();
        }
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


  /* ====================================================================
     RELATÓRIOS — Menu + Templates PRP / Atestados
     ==================================================================== */



    /* ====================================================================
     EXAME OBJECTIVO — Menu selector
     ==================================================================== */
  function openExameObjectivoMenu(anchorBtn) {
    document.getElementById("gcExObjMenu")?.remove();

    const menu = document.createElement("div");
    menu.id = "gcExObjMenu";
    Object.assign(menu.style, {
      position: "fixed", zIndex: "3000", background: "#fff",
      border: "1px solid #e2e8f0", borderRadius: "12px",
      boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
      padding: "8px 0", minWidth: "240px",
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif",
      overflowY: "auto"
    });
    const rect = anchorBtn.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const menuMaxH = Math.min(Math.max(spaceBelow, spaceAbove) - 8, 520);
    menu.style.maxHeight = menuMaxH + "px";
    if (spaceBelow >= spaceAbove || spaceBelow >= 300) {
      menu.style.top  = (rect.bottom + 6) + "px";
    } else {
      menu.style.bottom = (window.innerHeight - rect.top + 6) + "px";
    }
    // Horizontal: avoid going off-screen right
    const leftPos = Math.min(rect.left, window.innerWidth - 260);
    menu.style.left = Math.max(0, leftPos) + "px";

    const grupos = [
      {
        label: "Neurológico",
        items: [
          { id: "pfp",       label: "😐 Paresia Facial Periférica", ready: true },
          { id: "neuro_sum", label: "🧠 Neurológico Sumário",       ready: false },
        ]
      },
      {
        label: "Músculo-Esquelético — Membro Superior",
        items: [
          { id: "ombro",    label: "💪 Ombro",        ready: true },
          { id: "cotovelo", label: "🦾 Cotovelo",     ready: true },
          { id: "punho",    label: "✋ Punho / Mão",  ready: true },
        ]
      },
      {
        label: "Músculo-Esquelético — Membro Inferior",
        items: [
          { id: "anca",     label: "🦴 Anca",                 ready: true },
          { id: "joelho",   label: "🦵 Joelho",               ready: true },
          { id: "tibio",    label: "🦶 Tibiotársica / Pé",    ready: true },
        ]
      },
      {
        label: "Coluna",
        items: [
          { id: "cervical", label: "🫀 Coluna Cervical", ready: true },
          { id: "lombar",   label: "🫁 Coluna Lombar",   ready: true },
        ]
      },
      {
        label: "Atleta",
        items: [
          { id: "atleta", label: "🏃 Avaliação do Atleta", ready: true },
        ]
      },
    ];

    grupos.forEach((grp, gi) => {
      if (gi > 0) {
        const sep = document.createElement("div");
        Object.assign(sep.style, { height: "1px", background: "#f1f5f9", margin: "6px 0" });
        menu.appendChild(sep);
      }
      const lbl = document.createElement("div");
      lbl.textContent = grp.label;
      Object.assign(lbl.style, { padding: "4px 16px 2px", fontSize: "11px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" });
      menu.appendChild(lbl);

      grp.items.forEach(item => {
        const btn = document.createElement("button");
        btn.textContent = item.label;
        Object.assign(btn.style, {
          display: "block", width: "100%", textAlign: "left",
          background: "none", border: "none", padding: "9px 20px",
          fontSize: "14px", fontFamily: "inherit",
          color: item.ready ? "#0f172a" : "#94a3b8",
          cursor: item.ready ? "pointer" : "default",
          opacity: item.ready ? "1" : "0.6"
        });
        if (item.ready) {
          btn.onmouseenter = () => btn.style.background = "#f1f5f9";
          btn.onmouseleave = () => btn.style.background = "none";
          btn.addEventListener("click", () => { menu.remove(); openExameObjectivoForm(item.id); });
        }
        menu.appendChild(btn);
      });
    });

    document.body.appendChild(menu);
    setTimeout(() => {
      const close = (ev) => {
        if (!menu.contains(ev.target) && ev.target !== anchorBtn) {
          menu.remove(); document.removeEventListener("click", close);
        }
      };
      document.addEventListener("click", close);
    }, 50);
  }

  function openExameObjectivoForm(formId) {
    if (formId === "pfp") {
      const pfpHtml = `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="utf-8">
<title>Paresia Facial Periférica — Exame Objectivo</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:14px;color:#0f172a;background:#f8fafc;padding:0}
.page{max-width:960px;margin:0 auto;padding:16px 20px 80px}
h1{font-size:18px;font-weight:700;margin-bottom:2px}
.subtitle{font-size:12px;color:#64748b;margin-bottom:20px}
.sec{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:12px}
.sec-title{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #f1f5f9}
.num{width:22px;height:22px;border-radius:50%;background:#1a56db;color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.gl{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;margin-bottom:6px;margin-top:12px}
.gl:first-child{margin-top:0}
/* Botões de escolha rápida */
.opts{display:flex;gap:6px;flex-wrap:wrap}
.opt{padding:5px 12px;border:1px solid #e2e8f0;border-radius:20px;font-size:12px;font-weight:500;cursor:pointer;background:#f8fafc;color:#475569;transition:all .15s;user-select:none}
.opt:hover{border-color:#1a56db;color:#1a56db}
.opt.sel{background:#1a56db;border-color:#1a56db;color:#fff}
.opt.sel-red{background:#dc2626;border-color:#dc2626;color:#fff}
.opt.sel-amber{background:#d97706;border-color:#d97706;color:#fff}
/* Grid de parâmetros */
.param-grid{display:grid;grid-template-columns:1fr;gap:8px}
.param-row{display:grid;grid-template-columns:200px 1fr;gap:12px;align-items:start;padding:6px 0;border-bottom:1px solid #f8fafc}
.param-row:last-child{border-bottom:none}
.param-label{font-size:13px;font-weight:500;color:#374151;padding-top:4px}
.cols2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.cols3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
input[type=text],input[type=date],textarea{width:100%;padding:7px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;color:#0f172a;background:#fff}
textarea{resize:vertical;min-height:60px;line-height:1.5}
/* House-Brackmann */
.hb-item{display:flex;align-items:center;gap:10px;padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;cursor:pointer;margin-bottom:6px;transition:all .15s}
.hb-item:hover{border-color:#1a56db}
.hb-item.sel{border-color:#1a56db;background:#eff6ff}
.hb-grade{width:28px;height:28px;border-radius:50%;background:#e2e8f0;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;flex-shrink:0}
.hb-item.sel .hb-grade{background:#1a56db;color:#fff}
/* Barra acções */
.bar-acoes{position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid #e2e8f0;padding:10px 20px;display:flex;gap:10px;justify-content:flex-end;z-index:100}
.btn-copy{padding:9px 22px;border:none;border-radius:8px;background:#1a56db;color:#fff;font-size:13px;font-weight:600;cursor:pointer}
.btn-pdf{padding:9px 22px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;color:#475569;font-size:13px;cursor:pointer}
#toast{position:fixed;bottom:70px;left:50%;transform:translateX(-50%);background:#0f6e56;color:#fff;padding:9px 20px;border-radius:8px;font-size:13px;opacity:0;transition:opacity .3s;pointer-events:none;z-index:200}
#toast.show{opacity:1}
@media print{.bar-acoes,#toast{display:none!important}.page{padding-bottom:16px}}
.sub-title{font-size:12px;font-weight:700;color:#1a56db;margin:14px 0 6px;text-transform:uppercase;letter-spacing:0.04em}
.rf-row{display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid #f8fafc;}
.rf-row:last-child{border-bottom:none;}
.rf-cb{width:16px;height:16px;cursor:pointer;accent-color:#dc2626;flex-shrink:0;}
.rf-lbl{font-size:13px;color:#374151;cursor:pointer;}
.rf-tip{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;background:#f1f5f9;color:#94a3b8;font-size:10px;font-weight:700;cursor:help;position:relative;}
.rf-tip:hover::after{content:attr(data-tip);position:absolute;left:20px;top:50%;transform:translateY(-50%);background:#0f172a;color:#fff;font-size:11px;padding:4px 8px;border-radius:6px;white-space:nowrap;z-index:100;font-weight:400;}
.rf-warn{display:none;margin-top:8px;padding:8px 12px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;color:#dc2626;font-size:12px;font-weight:600;}
.rf-warn.show{display:block;}
</style>
</head>
<body>
<div class="page">
  <h1>Exame Objectivo — Paresia Facial Periférica</h1>
  <div class="subtitle">Clique nas opções · Copie para a consulta no final</div>

  <!-- 1. AVALIAÇÃO INICIAL -->
  <div class="sec">
    <div class="sec-title"><div class="num">1</div>Avaliação Inicial</div>
    <div class="cols2">
      <div>
        <div class="gl">Paresia facial desde</div>
        <input type="date" id="pfp_inicio">
      </div>
      <div>
        <div class="gl">Lateralidade</div>
        <div class="opts" id="pfp_lado">
          <div class="opt" data-v="Direita">Direita</div>
          <div class="opt" data-v="Esquerda">Esquerda</div>
        </div>
      </div>
    </div>
    <div class="cols3" style="margin-top:14px">
      <div>
        <div class="gl">Recorreu ao SU</div>
        <div class="opts" id="pfp_su">
          <div class="opt" data-v="Sim">Sim</div>
          <div class="opt" data-v="Não">Não</div>
        </div>
      </div>
      <div>
        <div class="gl">Aciclovir</div>
        <div class="opts" id="pfp_aciclo">
          <div class="opt" data-v="Sim">Sim</div>
          <div class="opt" data-v="Não">Não</div>
        </div>
      </div>
      <div>
        <div class="gl">Corticoterapia</div>
        <div class="opts" id="pfp_cortico">
          <div class="opt" data-v="Sim">Sim</div>
          <div class="opt" data-v="Não">Não</div>
        </div>
      </div>
    </div>
    <div style="margin-top:12px">
      <div class="gl">Medicação actual</div>
      <input type="text" id="pfp_med" placeholder="ex: Prednisolona 60mg, Aciclovir 800mg 5x/dia...">
    </div>
    <div style="margin-top:10px">
      <div class="gl">Evolução até hoje</div>
      <textarea id="pfp_evol" placeholder="Descreva a evolução desde o início..."></textarea>
    </div>
  </div>

  <!-- 2. INSPEÇÃO EM REPOUSO -->
  <div class="sec">
    <div class="sec-title"><div class="num">2</div>Inspeção Facial em Repouso</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Simetria facial</div><div class="opts sg" id="r_sim"><div class="opt" data-v="Simétrica">Simétrica</div><div class="opt" data-v="Assimetria facial">Assimétrica</div></div></div>
      <div class="param-row"><div class="param-label">Sulco nasolabial</div><div class="opts sg" id="r_snl"><div class="opt" data-v="Preservado">Preservado</div><div class="opt" data-v="Apagado">Apagado</div></div></div>
      <div class="param-row"><div class="param-label">Comissura labial</div><div class="opts sg" id="r_com"><div class="opt" data-v="Simétrica">Simétrica</div><div class="opt" data-v="Desvio contralateral">Desvio contralateral</div></div></div>
      <div class="param-row"><div class="param-label">Sobrancelha</div><div class="opts sg" id="r_sob"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Queda">Queda</div></div></div>
      <div class="param-row"><div class="param-label">Fenda palpebral</div><div class="opts sg" id="r_fp"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Aumentada">Aumentada</div></div></div>
      <div class="param-row"><div class="param-label">Lagoftalmo repouso</div><div class="opts sg" id="r_lag"><div class="opt" data-v="Ausente">Ausente</div><div class="opt" data-v="Presente">Presente</div></div></div>
      <div class="param-row"><div class="param-label">Tónus facial</div><div class="opts sg" id="r_ton"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Hipotonia">Hipotonia</div></div></div>
      <div class="param-row"><div class="param-label">Movimentos involuntários</div><div class="opts sg" id="r_mov"><div class="opt" data-v="Ausentes">Ausentes</div><div class="opt" data-v="Sincinesias">Sincinesias</div><div class="opt" data-v="Espasmos">Espasmos</div></div></div>
    </div>
  </div>

  <!-- 3. AVALIAÇÃO MOTORA -->
  <div class="sec">
    <div class="sec-title"><div class="num">3</div>Avaliação Motora — VII Par</div>

    <div class="sub-title">Região Frontal</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Elevação sobrancelhas</div><div class="opts sg" id="m_esob"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Diminuída">Diminuída</div><div class="opt" data-v="Ausente">Ausente</div></div></div>
      <div class="param-row"><div class="param-label">Rugas frontais</div><div class="opts sg" id="m_rug"><div class="opt" data-v="Presentes">Presentes</div><div class="opt" data-v="Reduzidas">Reduzidas</div><div class="opt" data-v="Ausentes">Ausentes</div></div></div>
      <div class="param-row"><div class="param-label">Simetria frontal</div><div class="opts sg" id="m_sfr"><div class="opt" data-v="Simétrica">Simétrica</div><div class="opt" data-v="Assimétrica">Assimétrica</div></div></div>
    </div>

    <div class="sub-title">Região Ocular</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Fecho palpebral suave</div><div class="opts sg" id="m_fps"><div class="opt" data-v="Completo">Completo</div><div class="opt" data-v="Incompleto">Incompleto</div></div></div>
      <div class="param-row"><div class="param-label">Fecho palpebral forçado</div><div class="opts sg" id="m_fpf"><div class="opt" data-v="Completo">Completo</div><div class="opt" data-v="Incompleto">Incompleto</div></div></div>
      <div class="param-row"><div class="param-label">Lagoftalmo</div><div class="opts sg" id="m_lag"><div class="opt" data-v="Ausente">Ausente</div><div class="opt" data-v="Presente">Presente</div></div></div>
      <div class="param-row"><div class="param-label">Sinal de Bell</div><div class="opts sg" id="m_bell"><div class="opt" data-v="Ausente">Ausente</div><div class="opt" data-v="Presente">Presente</div></div></div>
      <div class="param-row"><div class="param-label">Piscar espontâneo</div><div class="opts sg" id="m_pisc"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Diminuído">Diminuído</div></div></div>
    </div>

    <div class="sub-title">Região Nasal</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Dilatação narinas</div><div class="opts sg" id="m_nar"><div class="opt" data-v="Simétrica">Simétrica</div><div class="opt" data-v="Diminuída">Diminuída</div></div></div>
    </div>

    <div class="sub-title">Região Oral</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Mostrar dentes</div><div class="opts sg" id="m_dent"><div class="opt" data-v="Simétrico">Simétrico</div><div class="opt" data-v="Assimétrico">Assimétrico</div></div></div>
      <div class="param-row"><div class="param-label">Sorriso</div><div class="opts sg" id="m_sorr"><div class="opt" data-v="Simétrico">Simétrico</div><div class="opt" data-v="Assimétrico">Assimétrico</div></div></div>
      <div class="param-row"><div class="param-label">Assobiar</div><div class="opts sg" id="m_ass"><div class="opt" data-v="Preservado">Preservado</div><div class="opt" data-v="Incapaz">Incapaz</div></div></div>
      <div class="param-row"><div class="param-label">Insuflar bochechas</div><div class="opts sg" id="m_boc"><div class="opt" data-v="Mantém ar">Mantém ar</div><div class="opt" data-v="Escape de ar">Escape de ar</div></div></div>
    </div>
  </div>

  <!-- 4. FUNÇÃO OROFACIAL -->
  <div class="sec">
    <div class="sec-title"><div class="num">4</div>Função Orofacial</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Articulação da fala</div><div class="opts sg" id="o_fala"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Disartria ligeira">Disartria ligeira</div><div class="opt" data-v="Disartria moderada">Disartria moderada</div></div></div>
      <div class="param-row"><div class="param-label">Mobilidade labial</div><div class="opts sg" id="o_lab"><div class="opt" data-v="Preservada">Preservada</div><div class="opt" data-v="Diminuída">Diminuída</div></div></div>
      <div class="param-row"><div class="param-label">Retenção de saliva</div><div class="opts sg" id="o_sal"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Sialorreia">Sialorreia</div></div></div>
      <div class="param-row"><div class="param-label">Controlo oral líquidos</div><div class="opts sg" id="o_liq"><div class="opt" data-v="Preservado">Preservado</div><div class="opt" data-v="Escape">Escape</div></div></div>
    </div>
  </div>

  <!-- 5. AVALIAÇÃO OCULAR -->
  <div class="sec">
    <div class="sec-title"><div class="num">5</div>Avaliação Ocular</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Fecho ocular</div><div class="opts sg" id="oc_fecho"><div class="opt" data-v="Completo">Completo</div><div class="opt" data-v="Incompleto">Incompleto</div></div></div>
      <div class="param-row"><div class="param-label">Lacrimejo</div><div class="opts sg" id="oc_lac"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Diminuído">Diminuído</div><div class="opt" data-v="Aumentado">Aumentado</div></div></div>
      <div class="param-row"><div class="param-label">Hiperemia conjuntival</div><div class="opts sg" id="oc_hip"><div class="opt" data-v="Ausente">Ausente</div><div class="opt" data-v="Presente">Presente</div></div></div>
      <div class="param-row"><div class="param-label">Risco de queratite</div><div class="opts sg" id="oc_qer"><div class="opt" data-v="Não">Não</div><div class="opt" data-v="Sim — referenciar">Sim</div></div></div>
    </div>
  </div>

  <!-- 6. SINCINESIAS -->
  <div class="sec">
    <div class="sec-title"><div class="num">6</div>Sincinesias e Contraturas</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Sincinesia olho→boca</div><div class="opts sg" id="s_ob"><div class="opt" data-v="Não">Não</div><div class="opt" data-v="Sim">Sim</div></div></div>
      <div class="param-row"><div class="param-label">Sincinesia boca→olho</div><div class="opts sg" id="s_bo"><div class="opt" data-v="Não">Não</div><div class="opt" data-v="Sim">Sim</div></div></div>
      <div class="param-row"><div class="param-label">Espasmo hemifacial</div><div class="opts sg" id="s_esp"><div class="opt" data-v="Não">Não</div><div class="opt" data-v="Sim">Sim</div></div></div>
      <div class="param-row"><div class="param-label">Contratura facial</div><div class="opts sg" id="s_con"><div class="opt" data-v="Não">Não</div><div class="opt" data-v="Sim">Sim</div></div></div>
      <div class="param-row"><div class="param-label">Lágrimas de crocodilo</div><div class="opts sg" id="s_croc"><div class="opt" data-v="Não">Não</div><div class="opt" data-v="Sim">Sim</div></div></div>
    </div>
  </div>

  <!-- 7. HOUSE-BRACKMANN -->
  <div class="sec">
    <div class="sec-title"><div class="num">7</div>House-Brackmann</div>
    <div id="hb_grp">
      <div class="hb-item" data-hb="I"><div class="hb-grade">I</div><div><strong>Grau I</strong> — Função normal</div></div>
      <div class="hb-item" data-hb="II"><div class="hb-grade">II</div><div><strong>Grau II</strong> — Disfunção ligeira · assimetria mínima · fecho ocular completo com esforço mínimo</div></div>
      <div class="hb-item" data-hb="III"><div class="hb-grade">III</div><div><strong>Grau III</strong> — Disfunção moderada · assimetria evidente · fecho ocular completo com esforço</div></div>
      <div class="hb-item" data-hb="IV"><div class="hb-grade">IV</div><div><strong>Grau IV</strong> — Disfunção moderadamente grave · fecho ocular incompleto</div></div>
      <div class="hb-item" data-hb="V"><div class="hb-grade">V</div><div><strong>Grau V</strong> — Disfunção grave · movimento mínimo</div></div>
      <div class="hb-item" data-hb="VI"><div class="hb-grade">VI</div><div><strong>Grau VI</strong> — Paralisia completa</div></div>
    </div>
  </div>

  <!-- 8. OBSERVAÇÕES -->
  <div class="sec">
    <div class="sec-title"><div class="num">8</div>Observações Adicionais</div>
    <div class="opts" id="obs_flags" style="margin-bottom:12px">
      <div class="opt" data-v="dor retroauricular">Dor retroauricular</div>
      <div class="opt" data-v="hiperacusia">Hiperacusia</div>
      <div class="opt" data-v="infecção viral recente">Infecção viral recente</div>
      <div class="opt" data-v="Ramsay Hunt">Ramsay Hunt</div>
      <div class="opt" data-v="traumatismo prévio">Traumatismo prévio</div>
      <div class="opt" data-v="episódio prévio">Episódio prévio</div>
      <div class="opt" data-v="investigar causa central">Investigar causa central</div>
    </div>
    <div class="gl">Notas</div>
    <textarea id="pfp_notas" placeholder="Outras observações..."></textarea>
  </div>

</div>

<div id="toast">✓ Copiado — cole na consulta (Ctrl+V)</div>

<div class="bar-acoes">
  <button type="button" class="btn-pdf" id="btnPdf">Exportar PDF</button>
  <button type="button" class="btn-copy" id="btnCopy">Copiar resumo para consulta</button>
</div>

<script>
(function(){
  // Botões de escolha única por grupo
  document.querySelectorAll('.opts.sg, #pfp_lado, #pfp_su, #pfp_aciclo, #pfp_cortico').forEach(function(grp){
    grp.querySelectorAll('.opt').forEach(function(btn){
      btn.addEventListener('click', function(){
        grp.querySelectorAll('.opt').forEach(function(b){ b.classList.remove('sel'); });
        btn.classList.add('sel');
      });
    });
  });

  // Botões múltipla selecção (obs_flags)
  document.querySelectorAll('#obs_flags .opt').forEach(function(btn){
    btn.addEventListener('click', function(){ btn.classList.toggle('sel'); });
  });

  // House-Brackmann
  document.querySelectorAll('#hb_grp .hb-item').forEach(function(item){
    item.addEventListener('click', function(){
      document.querySelectorAll('#hb_grp .hb-item').forEach(function(i){ i.classList.remove('sel'); });
      item.classList.add('sel');
    });
  });

  function getOpt(id){
    var el = document.getElementById(id);
    if(!el) return '';
    var sel = el.querySelector('.opt.sel');
    return sel ? sel.dataset.v : '';
  }
  function getMulti(id){
    var el = document.getElementById(id);
    if(!el) return [];
    return Array.from(el.querySelectorAll('.opt.sel')).map(function(b){ return b.dataset.v; });
  }
  function getHB(){
    var sel = document.querySelector('#hb_grp .hb-item.sel');
    return sel ? sel.dataset.hb : '';
  }

  function gerarResumo(){
    var L = [];
    L.push('── PARESIA FACIAL PERIFÉRICA — EXAME OBJECTIVO ──');
    L.push('');

    // 1. Inicial
    var ini   = document.getElementById('pfp_inicio').value;
    var lado  = getOpt('pfp_lado');
    var su    = getOpt('pfp_su');
    var acicl = getOpt('pfp_aciclo');
    var cort  = getOpt('pfp_cortico');
    var med   = document.getElementById('pfp_med').value.trim();
    var evol  = document.getElementById('pfp_evol').value.trim();
    if(ini) L.push('Início: '+ini);
    if(lado) L.push('Lado: '+lado);
    if(su)   L.push('Serviço de Urgência: '+su);
    if(acicl) L.push('Aciclovir: '+acicl);
    if(cort)  L.push('Corticoterapia: '+cort);
    if(med)   L.push('Medicação: '+med);
    if(evol)  L.push('Evolução: '+evol);

    // Secções
    var params = [
      ['Inspeção em Repouso', [
        ['Simetria','r_sim'],['Sulco nasolabial','r_snl'],['Comissura','r_com'],
        ['Sobrancelha','r_sob'],['Fenda palpebral','r_fp'],['Lagoftalmo repouso','r_lag'],
        ['Tónus','r_ton'],['Movimentos involuntários','r_mov']
      ]],
      ['Motora — Frontal', [
        ['Elevação sobrancelhas','m_esob'],['Rugas frontais','m_rug'],['Simetria frontal','m_sfr']
      ]],
      ['Motora — Ocular', [
        ['Fecho suave','m_fps'],['Fecho forçado','m_fpf'],['Lagoftalmo','m_lag'],
        ['Sinal de Bell','m_bell'],['Piscar','m_pisc']
      ]],
      ['Motora — Nasal', [['Narinas','m_nar']]],
      ['Motora — Oral', [
        ['Mostrar dentes','m_dent'],['Sorriso','m_sorr'],['Assobiar','m_ass'],['Bochechas','m_boc']
      ]],
      ['Função Orofacial', [
        ['Fala','o_fala'],['Lábios','o_lab'],['Saliva','o_sal'],['Líquidos','o_liq']
      ]],
      ['Avaliação Ocular', [
        ['Fecho','oc_fecho'],['Lacrimejo','oc_lac'],['Hiperemia','oc_hip'],['Queratite','oc_qer']
      ]],
      ['Sincinesias', [
        ['Olho→boca','s_ob'],['Boca→olho','s_bo'],['Espasmo','s_esp'],['Contratura','s_con'],['Lágrimas crocodilo','s_croc']
      ]],
    ];

    params.forEach(function(sec){
      var nome = sec[0]; var items = sec[1];
      var rows = items.map(function(i){ var v = getOpt(i[1]); return v ? '  • '+i[0]+': '+v : ''; }).filter(Boolean);
      if(rows.length){ L.push(''); L.push(nome+':'); rows.forEach(function(r){ L.push(r); }); }
    });

    // HB
    var hb = getHB();
    if(hb) { L.push(''); L.push('House-Brackmann: Grau '+hb); }

    // Obs
    var obs = getMulti('obs_flags');
    var notas = document.getElementById('pfp_notas').value.trim();
    if(obs.length){ L.push(''); L.push('Obs: '+obs.join(', ')); }
    if(notas){ L.push('Notas: '+notas); }

    L.push('');
    L.push('──────────────────────────────────────────────────');
    return L.join(String.fromCharCode(10));
  }

  document.getElementById('btnCopy').addEventListener('click', function(){
    var txt = gerarResumo();
    var showToast = function(){
      var t = document.getElementById('toast');
      t.classList.add('show');
      setTimeout(function(){ t.classList.remove('show'); }, 2800);
    };
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(txt).then(showToast).catch(function(){
        fallbackCopy(txt); showToast();
      });
    } else { fallbackCopy(txt); showToast(); }
  });

  function fallbackCopy(txt){
    var ta = document.createElement('textarea');
    ta.value = txt; ta.style.position='fixed'; ta.style.opacity='0';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy');
    document.body.removeChild(ta);
  }

  document.getElementById('btnPdf').addEventListener('click', function(){ window.print(); });
})();
</script>
</body>
</html>
`;
      const blob = new Blob([pfpHtml], { type: "text/html" });
      const url  = URL.createObjectURL(blob);
      const win  = window.open(url, "_blank", "width=1000,height=800,scrollbars=yes");
      // Libertar Blob URL depois de abrir
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      return;
    }
    // ── helpers partilhados por todos os formulários músculo-esqueléticos ──
    const _mskCss = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:14px;color:#0f172a;background:#f8fafc;padding:0}
.page{max-width:980px;margin:0 auto;padding:16px 20px 80px}
h1{font-size:18px;font-weight:700;margin-bottom:2px}
.subtitle{font-size:12px;color:#64748b;margin-bottom:16px}
.sec{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:10px}
.sec-title{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #f1f5f9}
.num{width:22px;height:22px;border-radius:50%;background:#1a56db;color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.gl{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;margin-bottom:6px;margin-top:12px}
.gl:first-child{margin-top:0}
.sub-title{font-size:12px;font-weight:700;color:#1a56db;margin:14px 0 6px;text-transform:uppercase;letter-spacing:0.04em}
.opts{display:flex;gap:6px;flex-wrap:wrap}
.opt{padding:5px 12px;border:1px solid #e2e8f0;border-radius:20px;font-size:12px;font-weight:500;cursor:pointer;background:#f8fafc;color:#475569;transition:all .15s;user-select:none}
.opt:hover{border-color:#1a56db;color:#1a56db}
.opt.sel{background:#1a56db;border-color:#1a56db;color:#fff}
.param-grid{display:grid;grid-template-columns:1fr;gap:0}
.param-row{display:grid;grid-template-columns:210px 1fr;gap:12px;align-items:start;padding:6px 0;border-bottom:1px solid #f8fafc}
.param-row:last-child{border-bottom:none}
.param-label{font-size:13px;font-weight:500;color:#374151;padding-top:4px}
.cols2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.cols3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
.cols4{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px}
input[type=text],input[type=date],input[type=number],textarea{width:100%;padding:7px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;color:#0f172a;background:#fff}
textarea{resize:vertical;min-height:56px;line-height:1.5}
.bar-acoes{position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid #e2e8f0;padding:10px 20px;display:flex;gap:10px;justify-content:flex-end;z-index:100}
.btn-copy{padding:9px 22px;border:none;border-radius:8px;background:#1a56db;color:#fff;font-size:13px;font-weight:600;cursor:pointer}
.btn-pdf{padding:9px 22px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;color:#475569;font-size:13px;cursor:pointer}
#toast{position:fixed;bottom:70px;left:50%;transform:translateX(-50%);background:#0f6e56;color:#fff;padding:9px 20px;border-radius:8px;font-size:13px;opacity:0;transition:opacity .3s;pointer-events:none;z-index:200}
#toast.show{opacity:1}
@media print{.bar-acoes,#toast{display:none!important}.page{padding-bottom:16px}}
.eva-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.eva-lbl{font-size:12px;color:#64748b;min-width:130px}
.eva-btns{display:flex;gap:4px}
.eva-btns .opt{min-width:32px;text-align:center;padding:4px 8px}
`;

    const _mskJs = `
(function(){
  // escolha única por grupo com classe .sg
  document.querySelectorAll('.opts.sg').forEach(function(grp){
    grp.querySelectorAll('.opt').forEach(function(btn){
      btn.addEventListener('click',function(){
        grp.querySelectorAll('.opt').forEach(function(b){b.classList.remove('sel');});
        btn.classList.add('sel');
      });
    });
  });
  // escolha múltipla (sem .sg)
  document.querySelectorAll('.opts.mg').forEach(function(grp){
    grp.querySelectorAll('.opt').forEach(function(btn){
      btn.addEventListener('click',function(){btn.classList.toggle('sel');});
    });
  });

  function getOpt(id){
    var el=document.getElementById(id); if(!el) return '';
    var s=el.querySelector('.opt.sel'); return s?s.dataset.v:'';
  }
  function getMulti(id){
    var el=document.getElementById(id); if(!el) return [];
    return Array.from(el.querySelectorAll('.opt.sel')).map(function(b){return b.dataset.v;});
  }
  function getVal(id){var el=document.getElementById(id);return el?(el.value||'').trim():'';}
  function evaRow(id){
    // EVA: devolve texto "X/10" ou vazio
    var el=document.getElementById(id); if(!el) return '';
    var s=el.querySelector('.opt.sel'); return s?s.dataset.v+'/10':'';
  }

  function linha(label,val){ return val?'  • '+label+': '+val:''; }
  function secao(titulo,linhas){
    var rows=linhas.filter(Boolean);
    if(!rows.length) return '';
    return '\\n'+titulo+':\\n'+rows.join('\\n');
  }

  window._getOpt=getOpt;
  window._getMulti=getMulti;
  window._getVal=getVal;
  window._evaRow=evaRow;
  window._linha=linha;
  window._secao=secao;

  function copiar(txt){
    function showToast(){var t=document.getElementById('toast');t.classList.add('show');setTimeout(function(){t.classList.remove('show');},2800);}
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(txt).then(showToast).catch(function(){fallback(txt);showToast();});
    } else {fallback(txt);showToast();}
  }
  function fallback(txt){var ta=document.createElement('textarea');ta.value=txt;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);}

  document.getElementById('btnPdf').addEventListener('click',function(){window.print();});
  document.getElementById('btnCopy').addEventListener('click',function(){
    if(typeof window._gerarResumo==='function') copiar(window._gerarResumo());
  });

  // Red Flags checkboxes
  document.querySelectorAll('.rf-cb').forEach(function(cb){
    cb.addEventListener('change',function(){
      var par=cb.closest('[id$="_warn"],[id$="warn"]');
      // find nearest rf-warn sibling
      var sec=cb.closest('.sec,.sec-reds');
      var w=sec?sec.querySelector('.rf-warn'):null;
      if(!w) w=document.getElementById('rf_warn');
      if(!w) w=document.getElementById('reds_warn');
      if(w){
        var any=sec?sec.querySelectorAll('.rf-cb:checked').length>0:false;
        if(any)w.classList.add('show');else w.classList.remove('show');
      }
    });
  });
  function getRF(){return Array.from(document.querySelectorAll('.rf-cb:checked')).map(function(c){return c.dataset.rf;});}
  window.getRF=getRF;
})();
`;

    // ── helper: abrir Blob URL ──
    function _abrirBlob(htmlStr) {
      const blob = new Blob([htmlStr], { type: "text/html" });
      const url  = URL.createObjectURL(blob);
      window.open(url, "_blank", "width=1020,height=840,scrollbars=yes");
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }

    // helper: EVA buttons 0-10
    function _evaOpts(id) {
      let s = `<div class="eva-btns opts sg" id="${id}">`;
      for (let i=0;i<=10;i++) s+=`<div class="opt" data-v="${i}">${i}</div>`;
      s += `</div>`;
      return s;
    }

    /* ══════════════════════════════════════════════════════════════
       OMBRO
    ══════════════════════════════════════════════════════════════ */
    if (formId === "ombro") {
      _abrirBlob(`<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8">
<title>Exame Objectivo — Ombro</title><style>${_mskCss}</style></head><body>
<div class="page">
  <h1>Exame Objectivo — Ombro</h1>
  <div class="subtitle">Clique nas opções · Copie para a consulta no final</div>

  <!-- 1. LATERALIDADE & DOR -->
  <div class="sec">
    <div class="sec-title"><div class="num">1</div>Lateralidade &amp; Caracterização da Dor</div>
    <div class="cols2">
      <div>
        <div class="gl">Ombro avaliado</div>
        <div class="opts sg" id="lado"><div class="opt" data-v="Direito">Direito</div><div class="opt" data-v="Esquerdo">Esquerdo</div><div class="opt" data-v="Bilateral">Bilateral</div></div>
      </div>
      <div>
        <div class="gl">Tipo de dor</div>
        <div class="opts sg" id="tipo_dor"><div class="opt" data-v="Mecânica">Mecânica</div><div class="opt" data-v="Inflamatória">Inflamatória</div><div class="opt" data-v="Neuropática">Neuropática</div><div class="opt" data-v="Mista">Mista</div></div>
      </div>
    </div>
    <div class="sub-title" style="margin-top:14px">EVA (0 = sem dor · 10 = dor máxima)</div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:6px">
      <div class="eva-row"><span class="eva-lbl">Repouso</span>${_evaOpts("eva_rep")}</div>
      <div class="eva-row"><span class="eva-lbl">Actividade</span>${_evaOpts("eva_act")}</div>
      <div class="eva-row"><span class="eva-lbl">Pico máximo</span>${_evaOpts("eva_pic")}</div>
    </div>
    <div class="cols2" style="margin-top:14px">
      <div>
        <div class="gl">Irradiação</div>
        <div class="opts sg" id="irrad"><div class="opt" data-v="Não irradia">Não irradia</div><div class="opt" data-v="Irradiação proximal">Proximal</div><div class="opt" data-v="Irradiação distal">Distal</div></div>
      </div>
      <div>
        <div class="gl">Dor noturna</div>
        <div class="opts sg" id="d_noturna"><div class="opt" data-v="Não">Não</div><div class="opt" data-v="Sim — deitar sobre o ombro">Sim</div></div>
      </div>
    </div>
  </div>

  <!-- 2. INSPEÇÃO -->
  <div class="sec">
    <div class="sec-title"><div class="num">2</div>Inspeção</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Postura ombros</div><div class="opts mg" id="insp_pos"><div class="opt" data-v="Ombros anteriorizados">Anteriorizados</div><div class="opt" data-v="Rotação interna aumentada">Rot. interna ↑</div><div class="opt" data-v="Assimetria escapular">Assimetria escap.</div></div></div>
      <div class="param-row"><div class="param-label">Escápula</div><div class="opts sg" id="insp_esc"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Escápula alada">Alada</div></div></div>
      <div class="param-row"><div class="param-label">Atrofia muscular</div><div class="opts mg" id="insp_atr"><div class="opt" data-v="Sem atrofia">Sem atrofia</div><div class="opt" data-v="Atrofia deltóide">Deltóide</div><div class="opt" data-v="Atrofia supra-espinhoso">Supra-esp.</div><div class="opt" data-v="Atrofia infra-espinhoso">Infra-esp.</div></div></div>
    </div>
  </div>

  <!-- 3. PALPAÇÃO -->
  <div class="sec">
    <div class="sec-title"><div class="num">3</div>Palpação</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Articulação AC</div><div class="opts sg" id="palp_ac"><div class="opt" data-v="Indolor">Indolor</div><div class="opt" data-v="Dolorosa">Dolorosa</div></div></div>
      <div class="param-row"><div class="param-label">Tubérculo maior</div><div class="opts sg" id="palp_tb"><div class="opt" data-v="Indolor">Indolor</div><div class="opt" data-v="Doloroso">Doloroso</div></div></div>
      <div class="param-row"><div class="param-label">Sulco bicipital</div><div class="opts sg" id="palp_bic"><div class="opt" data-v="Indolor">Indolor</div><div class="opt" data-v="Doloroso">Doloroso</div></div></div>
      <div class="param-row"><div class="param-label">Bursa subacromial</div><div class="opts sg" id="palp_bur"><div class="opt" data-v="Indolor">Indolor</div><div class="opt" data-v="Dolorosa">Dolorosa</div></div></div>
    </div>
  </div>

  <!-- 4. MOBILIDADE -->
  <div class="sec">
    <div class="sec-title"><div class="num">4</div>Mobilidade (activa / passiva)</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Flexão (ref: 180°)</div><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;"><div class="opts sg" id="mob_flex"><div class="opt" data-v="Completa">Completa</div><div class="opt" data-v="Limitada com dor">Limitada c/ dor</div><div class="opt" data-v="Limitada sem dor">Limitada s/ dor</div><div class="opt" data-v="Muito limitada">Muito limitada</div></div><input type="number" placeholder="°" style="width:58px;padding:4px 6px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;text-align:center;" id="mob_flex_g" min="0" max="180"></div></div>
      <div class="param-row"><div class="param-label">Extensão (ref: 60°)</div><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;"><div class="opts sg" id="mob_ext"><div class="opt" data-v="Completa">Completa</div><div class="opt" data-v="Limitada com dor">Limitada c/ dor</div><div class="opt" data-v="Limitada sem dor">Limitada s/ dor</div></div><input type="number" placeholder="°" style="width:58px;padding:4px 6px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;text-align:center;" id="mob_ext_g" min="0" max="60"></div></div>
      <div class="param-row"><div class="param-label">Abdução (ref: 180°)</div><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;"><div class="opts sg" id="mob_abd"><div class="opt" data-v="Completa">Completa</div><div class="opt" data-v="Arco doloroso 60°–120°">Arco doloroso</div><div class="opt" data-v="Limitada com dor">Limitada c/ dor</div><div class="opt" data-v="Muito limitada">Muito limitada</div></div><input type="number" placeholder="°" style="width:58px;padding:4px 6px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;text-align:center;" id="mob_abd_g" min="0" max="180"></div></div>
      <div class="param-row"><div class="param-label">Rotação externa (ref: 90°)</div><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;"><div class="opts sg" id="mob_re"><div class="opt" data-v="Completa">Completa</div><div class="opt" data-v="Limitada com dor">Limitada c/ dor</div><div class="opt" data-v="Limitada sem dor">Limitada s/ dor</div></div><input type="number" placeholder="°" style="width:58px;padding:4px 6px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;text-align:center;" id="mob_re_g" min="0" max="90"></div></div>
      <div class="param-row"><div class="param-label">Rotação interna (nível vertebral)</div><div class="opts sg" id="mob_ri"><div class="opt" data-v="T12–L1 (normal)">T12–L1 ✓</div><div class="opt" data-v="LomboSagrada">LomboSagrada</div><div class="opt" data-v="Nádega">Nádega</div><div class="opt" data-v="Anca">Anca</div><div class="opt" data-v="T10–T12">T10–T12</div><div class="opt" data-v="T7–T10">T7–T10</div><div class="opt" data-v="Abaixo de T7">↓ T7</div></div></div>
      <div class="param-row"><div class="param-label">Crepitação</div><div class="opts sg" id="mob_crep"><div class="opt" data-v="Ausente">Ausente</div><div class="opt" data-v="Presente">Presente</div></div></div>
    </div>
  </div>

  <!-- 5. FORÇA MRC -->
  <div class="sec">
    <div class="sec-title"><div class="num">5</div>Força Muscular (MRC)</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Supra-espinhoso</div><div class="opts sg" id="f_sup"><div class="opt" data-v="5/5">5/5</div><div class="opt" data-v="4/5">4/5</div><div class="opt" data-v="3/5">3/5</div><div class="opt" data-v="2/5">2/5</div><div class="opt" data-v="1/5">1/5</div><div class="opt" data-v="0/5">0/5</div></div></div>
      <div class="param-row"><div class="param-label">Infra-espinhoso</div><div class="opts sg" id="f_inf"><div class="opt" data-v="5/5">5/5</div><div class="opt" data-v="4/5">4/5</div><div class="opt" data-v="3/5">3/5</div><div class="opt" data-v="2/5">2/5</div><div class="opt" data-v="1/5">1/5</div><div class="opt" data-v="0/5">0/5</div></div></div>
      <div class="param-row"><div class="param-label">Subescapular</div><div class="opts sg" id="f_sub"><div class="opt" data-v="5/5">5/5</div><div class="opt" data-v="4/5">4/5</div><div class="opt" data-v="3/5">3/5</div><div class="opt" data-v="2/5">2/5</div><div class="opt" data-v="1/5">1/5</div><div class="opt" data-v="0/5">0/5</div></div></div>
      <div class="param-row"><div class="param-label">Deltóide</div><div class="opts sg" id="f_del"><div class="opt" data-v="5/5">5/5</div><div class="opt" data-v="4/5">4/5</div><div class="opt" data-v="3/5">3/5</div><div class="opt" data-v="2/5">2/5</div><div class="opt" data-v="1/5">1/5</div><div class="opt" data-v="0/5">0/5</div></div></div>
    </div>
  </div>

  <!-- 6. TESTES ESPECÍFICOS -->
  <div class="sec">
    <div class="sec-title"><div class="num">6</div>Testes Específicos</div>
    <div class="sub-title">Conflito Subacromial</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Neer</div><div class="opts sg" id="t_neer"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo">Pos.</div></div></div>
      <div class="param-row"><div class="param-label">Hawkins</div><div class="opts sg" id="t_hawk"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo">Pos.</div></div></div>
    </div>
    <div class="sub-title">Coifa dos Rotadores</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Jobe (supra-espinhoso)</div><div class="opts sg" id="t_jobe"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo">Pos.</div></div></div>
      <div class="param-row"><div class="param-label">Patte (infra-espinhoso)</div><div class="opts sg" id="t_patte"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo">Pos.</div></div></div>
      <div class="param-row"><div class="param-label">Lift-off (subescapular)</div><div class="opts sg" id="t_liftoff"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo">Pos.</div></div></div>
      <div class="param-row"><div class="param-label">Belly press</div><div class="opts sg" id="t_belly"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo">Pos.</div></div></div>
      <div class="param-row"><div class="param-label">Drop Arm Test</div><div class="opts sg" id="t_drop"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo — suspeita rotura coifa">Pos.</div></div></div>
    </div>
    <div class="sub-title">Bicípite</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Speed</div><div class="opts sg" id="t_speed"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo">Pos.</div></div></div>
      <div class="param-row"><div class="param-label">Yergason</div><div class="opts sg" id="t_yerg"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo">Pos.</div></div></div>
    </div>
    <div class="sub-title">Instabilidade</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Apprehension</div><div class="opts sg" id="t_appr"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo">Pos.</div></div></div>
      <div class="param-row"><div class="param-label">Relocation</div><div class="opts sg" id="t_reloc"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo">Pos.</div></div></div>
      <div class="param-row"><div class="param-label">Sulcus sign</div><div class="opts sg" id="t_sulc"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo">Pos.</div></div></div>
    </div>
  </div>

  <!-- 7. AVALIAÇÃO FUNCIONAL -->
  <div class="sec">
    <div class="sec-title"><div class="num">7</div>Avaliação Funcional &amp; Observações</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Elevação acima da cabeça</div><div class="opts sg" id="func_elev"><div class="opt" data-v="Mantida">Mantida</div><div class="opt" data-v="Dificuldade">Dificuldade</div><div class="opt" data-v="Incapaz">Incapaz</div></div></div>
      <div class="param-row"><div class="param-label">Alcançar costas</div><div class="opts sg" id="func_cos"><div class="opt" data-v="Mantida">Mantida</div><div class="opt" data-v="Dificuldade">Dificuldade</div><div class="opt" data-v="Incapaz">Incapaz</div></div></div>
      <div class="param-row"><div class="param-label">Vestir camisola</div><div class="opts sg" id="func_vest"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Com dor">Com dor</div><div class="opt" data-v="Dificuldade">Dificuldade</div></div></div>
    </div>
    <div style="margin-top:12px"><div class="gl">Notas / Conclusão</div><textarea id="notas" placeholder="Impressão clínica, plano..."></textarea></div>
  </div>
</div>
<div id="toast">✓ Copiado — cole na consulta (Ctrl+V)</div>
<div class="bar-acoes"><button class="btn-pdf" id="btnPdf">Imprimir / PDF</button><button class="btn-copy" id="btnCopy">Copiar resumo para consulta</button></div>
<script>
${_mskJs}
window._gerarResumo = function(){
  var g=window._getOpt, m=window._getMulti, v=window._getVal, e=window._evaRow;
  var L=['── OMBRO — EXAME OBJECTIVO ──'];
  var lado=g('lado'); if(lado) L.push('Ombro '+lado);
  var evr=e('eva_rep'),eva=e('eva_act'),evp=e('eva_pic');
  var evaStr=[evr?'repouso '+evr:'',eva?'actividade '+eva:'',evp?'pico '+evp:''].filter(Boolean).join(' | ');
  if(evaStr) L.push('EVA: '+evaStr);
  var td=g('tipo_dor'); if(td) L.push('Dor: '+td);
  var ir=m('irrad'); if(ir.length) L.push('Irradiação: '+ir.join(', '));
  var dn=g('d_noturna'); if(dn) L.push('Dor noturna: '+dn);

  var insp=[m('insp_pos').join(', '),g('insp_esc'),m('insp_atr').join(', ')].filter(Boolean);
  if(insp.length){L.push('');L.push('Inspeção: '+insp.join(' | '));}

  var palp=['AC: '+g('palp_ac'),'Tubérculo: '+g('palp_tb'),'Sulco bicipital: '+g('palp_bic'),'Bursa: '+g('palp_bur')].filter(function(x){return x.split(': ')[1];});
  if(palp.length){L.push('');L.push('Palpação:');palp.forEach(function(x){L.push('  • '+x);});}

  L.push('');L.push('Mobilidade:');
  var mobG=[['Flexão',g('mob_flex'),document.getElementById('mob_flex_g')&&document.getElementById('mob_flex_g').value],['Extensão',g('mob_ext'),document.getElementById('mob_ext_g')&&document.getElementById('mob_ext_g').value],['Abdução',g('mob_abd'),document.getElementById('mob_abd_g')&&document.getElementById('mob_abd_g').value],['Rot. externa',g('mob_re'),document.getElementById('mob_re_g')&&document.getElementById('mob_re_g').value],['Rot. interna',g('mob_ri'),null],['Crepitação',g('mob_crep'),null]];
  mobG.forEach(function(p){if(p[1]){var gr=p[2]?' ('+p[2]+'°)':'';L.push('  • '+p[0]+': '+p[1]+gr);}});

  L.push('');L.push('Força MRC:');
  [['Supra-espinhoso',g('f_sup')],['Infra-espinhoso',g('f_inf')],['Subescapular',g('f_sub')],['Deltóide',g('f_del')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});

  L.push('');L.push('Testes:');
  [['Neer',g('t_neer')],['Hawkins',g('t_hawk')],['Jobe',g('t_jobe')],['Patte',g('t_patte')],['Lift-off',g('t_liftoff')],['Belly press',g('t_belly')],['Drop Arm',g('t_drop')],['Speed',g('t_speed')],['Yergason',g('t_yerg')],['Apprehension',g('t_appr')],['Relocation',g('t_reloc')],['Sulcus',g('t_sulc')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});

  var func=[g('func_elev')?'elevação: '+g('func_elev'):'',g('func_cos')?'costas: '+g('func_cos'):'',g('func_vest')?'vestir: '+g('func_vest'):''].filter(Boolean);
  if(func.length){L.push('');L.push('Funcional: '+func.join(' | '));}

  var n=v('notas'); if(n){L.push('');L.push('Notas: '+n);}
  L.push('');L.push('──────────────────────────────────────────────────');
  return L.join('\\n');
};
</script></body></html>`);
      return;
    }

    /* ══════════════════════════════════════════════════════════════
       COTOVELO
    ══════════════════════════════════════════════════════════════ */
    if (formId === "cotovelo") {
      _abrirBlob(`<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8">
<title>Exame Objectivo — Cotovelo</title><style>${_mskCss}</style></head><body>
<div class="page">
  <h1>Exame Objectivo — Cotovelo</h1>
  <div class="subtitle">Clique nas opções · Copie para a consulta no final</div>

  <div class="sec">
    <div class="sec-title"><div class="num">1</div>Lateralidade &amp; Dor</div>
    <div class="cols2">
      <div><div class="gl">Cotovelo avaliado</div><div class="opts sg" id="lado"><div class="opt" data-v="Direito">Direito</div><div class="opt" data-v="Esquerdo">Esquerdo</div><div class="opt" data-v="Bilateral">Bilateral</div></div></div>
      <div><div class="gl">Tipo de dor</div><div class="opts sg" id="tipo_dor"><div class="opt" data-v="Mecânica">Mecânica</div><div class="opt" data-v="Inflamatória">Inflamatória</div><div class="opt" data-v="Neuropática">Neuropática</div></div></div>
    </div>
    <div class="sub-title" style="margin-top:14px">EVA</div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:6px">
      <div class="eva-row"><span class="eva-lbl">Repouso</span>${_evaOpts("eva_rep")}</div>
      <div class="eva-row"><span class="eva-lbl">Actividade</span>${_evaOpts("eva_act")}</div>
      <div class="eva-row"><span class="eva-lbl">Pico máximo</span>${_evaOpts("eva_pic")}</div>
    </div>
    <div style="margin-top:12px"><div class="gl">Localização da dor</div>
      <div class="opts mg" id="local_dor"><div class="opt" data-v="Epicôndilo lateral (tendão extensores)">Epicôndilo lateral</div><div class="opt" data-v="Epicôndilo medial (tendão flexores)">Epicôndilo medial</div><div class="opt" data-v="Face posterior — olécrano">Olécrano</div><div class="opt" data-v="Face anterior">Anterior</div></div>
    </div>
  </div>

  <div class="sec">
    <div class="sec-title"><div class="num">2</div>Inspeção &amp; Palpação</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Edema/tumefacção</div><div class="opts sg" id="insp_edema"><div class="opt" data-v="Ausente">Ausente</div><div class="opt" data-v="Ligeiro">Ligeiro</div><div class="opt" data-v="Moderado">Moderado</div></div></div>
      <div class="param-row"><div class="param-label">Ângulo de carregamento</div><div class="opts sg" id="insp_ang"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Varo">Varo</div><div class="opt" data-v="Valgo">Valgo</div></div></div>
      <div class="param-row"><div class="param-label">Palpação epicôndilo lateral</div><div class="opts sg" id="palp_ecl"><div class="opt" data-v="Indolor">Indolor</div><div class="opt" data-v="Doloroso">Doloroso</div></div></div>
      <div class="param-row"><div class="param-label">Palpação epicôndilo medial</div><div class="opts sg" id="palp_ecm"><div class="opt" data-v="Indolor">Indolor</div><div class="opt" data-v="Doloroso">Doloroso</div></div></div>
      <div class="param-row"><div class="param-label">Olécrano</div><div class="opts sg" id="palp_olec"><div class="opt" data-v="Indolor">Indolor</div><div class="opt" data-v="Doloroso">Doloroso</div><div class="opt" data-v="Bursite">Bursite</div></div></div>
    </div>
  </div>

  <div class="sec">
    <div class="sec-title"><div class="num">3</div>Mobilidade</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Flexão (ref: 145°)</div><div class="opts sg" id="mob_flex"><div class="opt" data-v="Completa">Completa</div><div class="opt" data-v="Limitada c/ dor">Limitada c/ dor</div><div class="opt" data-v="Limitada s/ dor">Limitada s/ dor</div></div></div>
      <div class="param-row"><div class="param-label">Extensão (ref: 0°)</div><div class="opts sg" id="mob_ext"><div class="opt" data-v="Completa">Completa</div><div class="opt" data-v="Défice extensão c/ dor">Défice c/ dor</div><div class="opt" data-v="Défice extensão s/ dor">Défice s/ dor</div></div></div>
      <div class="param-row"><div class="param-label">Pronação (ref: 80°)</div><div class="opts sg" id="mob_pro"><div class="opt" data-v="Completa">Completa</div><div class="opt" data-v="Limitada c/ dor">Limitada c/ dor</div><div class="opt" data-v="Limitada s/ dor">Limitada s/ dor</div></div></div>
      <div class="param-row"><div class="param-label">Supinação (ref: 80°)</div><div class="opts sg" id="mob_sup"><div class="opt" data-v="Completa">Completa</div><div class="opt" data-v="Limitada c/ dor">Limitada c/ dor</div><div class="opt" data-v="Limitada s/ dor">Limitada s/ dor</div></div></div>
    </div>
  </div>

  <div class="sec">
    <div class="sec-title"><div class="num">4</div>Força &amp; Testes Específicos</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Força extensores punho</div><div class="opts sg" id="f_ext"><div class="opt" data-v="5/5">5/5</div><div class="opt" data-v="4/5">4/5</div><div class="opt" data-v="3/5">3/5</div><div class="opt" data-v="2/5">2/5</div></div></div>
      <div class="param-row"><div class="param-label">Força flexores punho</div><div class="opts sg" id="f_flex"><div class="opt" data-v="5/5">5/5</div><div class="opt" data-v="4/5">4/5</div><div class="opt" data-v="3/5">3/5</div><div class="opt" data-v="2/5">2/5</div></div></div>
    </div>
    <div class="sub-title">Epicondilite lateral (Ténis)</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Cozen (resistência extensão)</div><div class="opts sg" id="t_cozen"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo">Pos.</div></div></div>
      <div class="param-row"><div class="param-label">Mill's (extensão passiva)</div><div class="opts sg" id="t_mills"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo">Pos.</div></div></div>
      <div class="param-row"><div class="param-label">Chair test</div><div class="opts sg" id="t_chair"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo">Pos.</div></div></div>
    </div>
    <div class="sub-title">Epicondilite medial (Golfista)</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Resistência flexão punho</div><div class="opts sg" id="t_golf"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo">Pos.</div></div></div>
    </div>
    <div class="sub-title">Nervo cubital</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Sinal de Tinel (goteira cubital)</div><div class="opts sg" id="t_tinel"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo">Pos.</div></div></div>
    </div>
  </div>

  <div class="sec">
    <div class="sec-title"><div class="num">5</div>Observações</div>
    <textarea id="notas" placeholder="Conclusão clínica, plano..."></textarea>
  </div>
</div>
<div id="toast">✓ Copiado — cole na consulta (Ctrl+V)</div>
<div class="bar-acoes"><button class="btn-pdf" id="btnPdf">Imprimir / PDF</button><button class="btn-copy" id="btnCopy">Copiar resumo para consulta</button></div>
<script>
${_mskJs}
window._gerarResumo = function(){
  var g=window._getOpt,m=window._getMulti,v=window._getVal,e=window._evaRow;
  var L=['── COTOVELO — EXAME OBJECTIVO ──'];
  var lado=g('lado'); if(lado) L.push('Cotovelo '+lado);
  var evStr=[e('eva_rep')?'repouso '+e('eva_rep'):'',e('eva_act')?'actividade '+e('eva_act'):'',e('eva_pic')?'pico '+e('eva_pic'):''].filter(Boolean).join(' | ');
  if(evStr) L.push('EVA: '+evStr);
  var td=g('tipo_dor'); if(td) L.push('Dor: '+td);
  var ld=m('local_dor'); if(ld.length) L.push('Localização: '+ld.join(', '));
  L.push('');L.push('Inspeção/Palpação:');
  [['Edema',g('insp_edema')],['Ângulo carregamento',g('insp_ang')],['Epicôndilo lateral',g('palp_ecl')],['Epicôndilo medial',g('palp_ecm')],['Olécrano',g('palp_olec')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
  L.push('');L.push('Mobilidade:');
  [['Flexão',g('mob_flex')],['Extensão',g('mob_ext')],['Pronação',g('mob_pro')],['Supinação',g('mob_sup')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
  L.push('');L.push('Força:');
  [['Extensores punho',g('f_ext')],['Flexores punho',g('f_flex')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
  L.push('');L.push('Testes:');
  [['Cozen',g('t_cozen')],['Mills',g('t_mills')],['Chair test',g('t_chair')],['Resistência flexão (golfista)',g('t_golf')],['Tinel cubital',g('t_tinel')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
  var n=v('notas'); if(n){L.push('');L.push('Notas: '+n);}
  L.push('');L.push('──────────────────────────────────────────────────');
  return L.join('\\n');
};
</script></body></html>`);
      return;
    }

    /* ══════════════════════════════════════════════════════════════
       PUNHO / MÃO
    ══════════════════════════════════════════════════════════════ */
    if (formId === "punho") {
      _abrirBlob(`<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8">
<title>Exame Objectivo — Punho / Mão</title><style>${_mskCss}</style></head><body>
<div class="page">
  <h1>Exame Objectivo — Punho / Mão</h1>
  <div class="subtitle">Clique nas opções · Copie para a consulta no final</div>

  <div class="sec">
    <div class="sec-title"><div class="num">1</div>Lateralidade &amp; Dor</div>
    <div class="cols2">
      <div><div class="gl">Lado avaliado</div><div class="opts sg" id="lado"><div class="opt" data-v="Direito">Direito</div><div class="opt" data-v="Esquerdo">Esquerdo</div><div class="opt" data-v="Bilateral">Bilateral</div></div></div>
      <div><div class="gl">Membro dominante</div><div class="opts sg" id="dominant"><div class="opt" data-v="Direito">Direito</div><div class="opt" data-v="Esquerdo">Esquerdo</div></div></div>
    </div>
    <div class="sub-title" style="margin-top:14px">EVA</div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:6px">
      <div class="eva-row"><span class="eva-lbl">Repouso</span>${_evaOpts("eva_rep")}</div>
      <div class="eva-row"><span class="eva-lbl">Actividade</span>${_evaOpts("eva_act")}</div>
      <div class="eva-row"><span class="eva-lbl">Pico máximo</span>${_evaOpts("eva_pic")}</div>
    </div>
    <div style="margin-top:12px"><div class="gl">Localização da dor</div>
      <div class="opts mg" id="local_dor"><div class="opt" data-v="Face dorsal do punho">Dorsal</div><div class="opt" data-v="Face palmar do punho">Palmar</div><div class="opt" data-v="Radial (tabaqueira anatómica)">Tabaqueira</div><div class="opt" data-v="Cubital">Cubital</div><div class="opt" data-v="Dedos">Dedos</div></div>
    </div>
  </div>

  <div class="sec">
    <div class="sec-title"><div class="num">2</div>Inspeção &amp; Palpação</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Edema</div><div class="opts sg" id="insp_edema"><div class="opt" data-v="Ausente">Ausente</div><div class="opt" data-v="Ligeiro">Ligeiro</div><div class="opt" data-v="Moderado">Moderado</div></div></div>
      <div class="param-row"><div class="param-label">Deformidade</div><div class="opts mg" id="insp_def"><div class="opt" data-v="Sem deformidade">Sem deformidade</div><div class="opt" data-v="Desvio cubital dedos">Desvio cubital</div><div class="opt" data-v="Nódulos de Heberden">Heberden</div><div class="opt" data-v="Nódulos de Bouchard">Bouchard</div><div class="opt" data-v="Rizartrose polegár">Rizartrose</div></div></div>
      <div class="param-row"><div class="param-label">Tabaqueira anatómica</div><div class="opts sg" id="palp_tab"><div class="opt" data-v="Indolor">Indolor</div><div class="opt" data-v="Dolorosa — suspeita escafoide">Dolorosa</div></div></div>
      <div class="param-row"><div class="param-label">Pulso radial</div><div class="opts sg" id="palp_puls"><div class="opt" data-v="Presente e simétrico">Presente</div><div class="opt" data-v="Assimétrico">Assimétrico</div></div></div>
    </div>
  </div>

  <div class="sec">
    <div class="sec-title"><div class="num">3</div>Mobilidade do Punho</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Flexão dorsal (ref: 70°)</div><div class="opts sg" id="mob_flex"><div class="opt" data-v="Completa">Completa</div><div class="opt" data-v="Limitada c/ dor">Limitada c/ dor</div><div class="opt" data-v="Limitada s/ dor">Limitada s/ dor</div></div></div>
      <div class="param-row"><div class="param-label">Flexão palmar (ref: 80°)</div><div class="opts sg" id="mob_ext"><div class="opt" data-v="Completa">Completa</div><div class="opt" data-v="Limitada c/ dor">Limitada c/ dor</div><div class="opt" data-v="Limitada s/ dor">Limitada s/ dor</div></div></div>
      <div class="param-row"><div class="param-label">Desvio radial (ref: 20°)</div><div class="opts sg" id="mob_rad"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Limitado c/ dor">Limitado c/ dor</div></div></div>
      <div class="param-row"><div class="param-label">Desvio cubital (ref: 35°)</div><div class="opts sg" id="mob_cub"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Limitado c/ dor">Limitado c/ dor</div></div></div>
    </div>
  </div>

  <div class="sec">
    <div class="sec-title"><div class="num">4</div>Força &amp; Testes Específicos</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Preensão palmar (grip)</div><div class="opts sg" id="f_grip"><div class="opt" data-v="5/5 — normal">5/5</div><div class="opt" data-v="4/5 — ligeiramente diminuída">4/5</div><div class="opt" data-v="3/5 — moderadamente diminuída">3/5</div><div class="opt" data-v="2/5 — muito diminuída">2/5</div><div class="opt" data-v="1/5 — vestigial">1/5</div></div></div>
      <div class="param-row"><div class="param-label">Pinça polegar-índice</div><div class="opts sg" id="f_pinc"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Diminuída">Diminuída</div></div></div>
    </div>
    <div class="sub-title">Canal cárpico</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Tinel (pulso)</div><div class="opts sg" id="t_tinel"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo — parestesias dedos">Pos.</div></div></div>
      <div class="param-row"><div class="param-label">Phalen</div><div class="opts sg" id="t_phalen"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo">Pos.</div></div></div>
      <div class="param-row"><div class="param-label">Durkan</div><div class="opts sg" id="t_durkan"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo">Pos.</div></div></div>
    </div>
    <div class="sub-title">De Quervain</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Finkelstein</div><div class="opts sg" id="t_fink"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo — tenossinovite 1º compartimento">Pos.</div></div></div>
    </div>
  </div>

  <div class="sec">
    <div class="sec-title"><div class="num">5</div>Observações</div>
    <textarea id="notas" placeholder="Conclusão clínica, plano..."></textarea>
  </div>
</div>
<div id="toast">✓ Copiado — cole na consulta (Ctrl+V)</div>
<div class="bar-acoes"><button class="btn-pdf" id="btnPdf">Imprimir / PDF</button><button class="btn-copy" id="btnCopy">Copiar resumo para consulta</button></div>
<script>
${_mskJs}
window._gerarResumo = function(){
  var g=window._getOpt,m=window._getMulti,v=window._getVal,e=window._evaRow;
  var L=['── PUNHO / MÃO — EXAME OBJECTIVO ──'];
  var lado=g('lado'),dom=g('dominant');
  if(lado) L.push('Lado '+lado+(dom?' (dominante: '+dom+')':''));
  var evStr=[e('eva_rep')?'repouso '+e('eva_rep'):'',e('eva_act')?'actividade '+e('eva_act'):'',e('eva_pic')?'pico '+e('eva_pic'):''].filter(Boolean).join(' | ');
  if(evStr) L.push('EVA: '+evStr);
  var ld=m('local_dor'); if(ld.length) L.push('Localização: '+ld.join(', '));
  L.push('');L.push('Inspeção/Palpação:');
  [['Edema',g('insp_edema')],['Deformidade',m('insp_def').join(', ')],['Tabaqueira',g('palp_tab')],['Pulso radial',g('palp_puls')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
  L.push('');L.push('Mobilidade punho:');
  [['Flexão dorsal',g('mob_flex')],['Flexão palmar',g('mob_ext')],['Desvio radial',g('mob_rad')],['Desvio cubital',g('mob_cub')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
  L.push('');L.push('Força:');
  [['Grip',g('f_grip')],['Pinça',g('f_pinc')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
  L.push('');L.push('Testes:');
  [['Tinel',g('t_tinel')],['Phalen',g('t_phalen')],['Durkan',g('t_durkan')],['Finkelstein',g('t_fink')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
  var n=v('notas'); if(n){L.push('');L.push('Notas: '+n);}
  L.push('');L.push('──────────────────────────────────────────────────');
  return L.join('\\n');
};
</script></body></html>`);
      return;
    }

    /* ══════════════════════════════════════════════════════════════
       ANCA
    ══════════════════════════════════════════════════════════════ */
    if (formId === "anca") {
      _abrirBlob(`<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8">
<title>Exame Objectivo — Anca</title><style>${_mskCss}</style></head><body>
<div class="page">
  <h1>Exame Objectivo — Anca</h1>
  <div class="subtitle">Clique nas opções · Copie para a consulta no final</div>

  <div class="sec">
    <div class="sec-title"><div class="num">1</div>Lateralidade &amp; Dor</div>
    <div class="cols2">
      <div><div class="gl">Anca avaliada</div><div class="opts sg" id="lado"><div class="opt" data-v="Direita">Direita</div><div class="opt" data-v="Esquerda">Esquerda</div><div class="opt" data-v="Bilateral">Bilateral</div></div></div>
      <div><div class="gl">Tipo de dor</div><div class="opts sg" id="tipo_dor"><div class="opt" data-v="Mecânica">Mecânica</div><div class="opt" data-v="Inflamatória">Inflamatória</div><div class="opt" data-v="Neuropática">Neuropática</div></div></div>
    </div>
    <div class="sub-title" style="margin-top:14px">EVA</div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:6px">
      <div class="eva-row"><span class="eva-lbl">Repouso</span>${_evaOpts("eva_rep")}</div>
      <div class="eva-row"><span class="eva-lbl">Actividade</span>${_evaOpts("eva_act")}</div>
      <div class="eva-row"><span class="eva-lbl">Pico máximo</span>${_evaOpts("eva_pic")}</div>
    </div>
    <div style="margin-top:12px"><div class="gl">Localização da dor</div>
      <div class="opts mg" id="local_dor"><div class="opt" data-v="Virilha">Virilha</div><div class="opt" data-v="Face lateral — grande trocânter">Trocânter</div><div class="opt" data-v="Face posterior — glúteo">Glúteo</div><div class="opt" data-v="Irradiação coxa">Irradiação coxa</div></div>
    </div>
  </div>

  <div class="sec">
    <div class="sec-title"><div class="num">2</div>Inspeção &amp; Marcha</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Marcha</div><div class="opts sg" id="marcha"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Claudicação álgica">Claudicação álgica</div><div class="opt" data-v="Trendelenburg">Trendelenburg</div><div class="opt" data-v="Antálgica">Antálgica</div></div></div>
      <div class="param-row"><div class="param-label">Sinal de Trendelenburg</div><div class="opts sg" id="trend"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo">Pos.</div></div></div>
      <div class="param-row"><div class="param-label">Discrepância membros</div><div class="opts sg" id="discr"><div class="opt" data-v="Sem discrepância">Sem discrepância</div><div class="opt" data-v="Encurtamento aparente">Encurtamento aparente</div><div class="opt" data-v="Encurtamento real">Encurtamento real</div></div></div>
    </div>
  </div>

  <div class="sec">
    <div class="sec-title"><div class="num">3</div>Mobilidade</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Flexão (ref: 120°)</div><div class="opts sg" id="mob_flex"><div class="opt" data-v="Completa">Completa</div><div class="opt" data-v="Limitada c/ dor">Limitada c/ dor</div><div class="opt" data-v="Limitada s/ dor">Limitada s/ dor</div></div></div>
      <div class="param-row"><div class="param-label">Extensão (ref: 20°)</div><div class="opts sg" id="mob_ext"><div class="opt" data-v="Completa">Completa</div><div class="opt" data-v="Limitada c/ dor">Limitada c/ dor</div><div class="opt" data-v="Limitada s/ dor">Limitada s/ dor</div></div></div>
      <div class="param-row"><div class="param-label">Abdução (ref: 45°)</div><div class="opts sg" id="mob_abd"><div class="opt" data-v="Completa">Completa</div><div class="opt" data-v="Limitada c/ dor">Limitada c/ dor</div><div class="opt" data-v="Limitada s/ dor">Limitada s/ dor</div></div></div>
      <div class="param-row"><div class="param-label">Adução (ref: 30°)</div><div class="opts sg" id="mob_adu"><div class="opt" data-v="Completa">Completa</div><div class="opt" data-v="Limitada c/ dor">Limitada c/ dor</div></div></div>
      <div class="param-row"><div class="param-label">Rotação interna (ref: 45°)</div><div class="opts sg" id="mob_ri"><div class="opt" data-v="Completa">Completa</div><div class="opt" data-v="Limitada c/ dor">Limitada c/ dor</div><div class="opt" data-v="Limitada s/ dor">Limitada s/ dor</div></div></div>
      <div class="param-row"><div class="param-label">Rotação externa (ref: 45°)</div><div class="opts sg" id="mob_re"><div class="opt" data-v="Completa">Completa</div><div class="opt" data-v="Limitada c/ dor">Limitada c/ dor</div><div class="opt" data-v="Limitada s/ dor">Limitada s/ dor</div></div></div>
    </div>
  </div>

  <div class="sec">
    <div class="sec-title"><div class="num">4</div>Testes Específicos</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">FABER (Patrick)</div><div class="opts sg" id="t_faber"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo — dor virilha">Pos. virilha</div><div class="opt" data-v="Positivo — dor sacroilíaca">Pos. SI</div></div></div>
      <div class="param-row"><div class="param-label">FADIR</div><div class="opts sg" id="t_fadir"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo — conflito FAI">Pos. FAI</div></div></div>
      <div class="param-row"><div class="param-label">Ober (banda iliotibial)</div><div class="opts sg" id="t_ober"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo">Pos.</div></div></div>
      <div class="param-row"><div class="param-label">Thomas (flexores anca)</div><div class="opts sg" id="t_thomas"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo — encurtamento ilipsoas">Pos.</div></div></div>
    </div>
  </div>

  <div class="sec">
    <div class="sec-title"><div class="num">5</div>Força &amp; Observações</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Abdutores anca</div><div class="opts sg" id="f_abd"><div class="opt" data-v="5/5">5/5</div><div class="opt" data-v="4/5">4/5</div><div class="opt" data-v="3/5">3/5</div><div class="opt" data-v="2/5">2/5</div></div></div>
      <div class="param-row"><div class="param-label">Glúteo médio</div><div class="opts sg" id="f_glmed"><div class="opt" data-v="5/5">5/5</div><div class="opt" data-v="4/5">4/5</div><div class="opt" data-v="3/5">3/5</div><div class="opt" data-v="2/5">2/5</div></div></div>
    </div>
    <div style="margin-top:12px"><div class="gl">Notas / Conclusão</div><textarea id="notas" placeholder="Conclusão clínica, plano..."></textarea></div>
  </div>
</div>
<div id="toast">✓ Copiado — cole na consulta (Ctrl+V)</div>
<div class="bar-acoes"><button class="btn-pdf" id="btnPdf">Imprimir / PDF</button><button class="btn-copy" id="btnCopy">Copiar resumo para consulta</button></div>
<script>
${_mskJs}
window._gerarResumo = function(){
  var g=window._getOpt,m=window._getMulti,v=window._getVal,e=window._evaRow;
  var L=['── ANCA — EXAME OBJECTIVO ──'];
  var lado=g('lado'); if(lado) L.push('Anca '+lado);
  var evStr=[e('eva_rep')?'repouso '+e('eva_rep'):'',e('eva_act')?'actividade '+e('eva_act'):'',e('eva_pic')?'pico '+e('eva_pic'):''].filter(Boolean).join(' | ');
  if(evStr) L.push('EVA: '+evStr);
  var td=g('tipo_dor'); if(td) L.push('Dor: '+td);
  var ld=m('local_dor'); if(ld.length) L.push('Localização: '+ld.join(', '));
  L.push('');L.push('Marcha:');
  [['Padrão',g('marcha')],['Trendelenburg',g('trend')],['Discrepância',g('discr')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
  L.push('');L.push('Mobilidade:');
  [['Flexão',g('mob_flex')],['Extensão',g('mob_ext')],['Abdução',g('mob_abd')],['Adução',g('mob_adu')],['Rot. interna',g('mob_ri')],['Rot. externa',g('mob_re')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
  L.push('');L.push('Testes:');
  [['FABER',g('t_faber')],['FADIR',g('t_fadir')],['Ober',g('t_ober')],['Thomas',g('t_thomas')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
  L.push('');L.push('Força:');
  [['Abdutores',g('f_abd')],['Glúteo médio',g('f_glmed')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
  var n=v('notas'); if(n){L.push('');L.push('Notas: '+n);}
  L.push('');L.push('──────────────────────────────────────────────────');
  return L.join('\\n');
};
</script></body></html>`);
      return;
    }

    /* ══════════════════════════════════════════════════════════════
       JOELHO
    ══════════════════════════════════════════════════════════════ */
    if (formId === "joelho") {
      _abrirBlob(`<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8">
<title>Exame Objectivo — Joelho</title><style>${_mskCss}</style></head><body>
<div class="page">
  <h1>Exame Objectivo — Joelho</h1>
  <div class="subtitle">Clique nas opções · Copie para a consulta no final</div>

  <div class="sec">
    <div class="sec-title"><div class="num">1</div>Lateralidade &amp; Dor</div>
    <div class="cols2">
      <div><div class="gl">Joelho avaliado</div><div class="opts sg" id="lado"><div class="opt" data-v="Direito">Direito</div><div class="opt" data-v="Esquerdo">Esquerdo</div><div class="opt" data-v="Bilateral">Bilateral</div></div></div>
      <div><div class="gl">Tipo de dor</div><div class="opts sg" id="tipo_dor"><div class="opt" data-v="Mecânica">Mecânica</div><div class="opt" data-v="Inflamatória">Inflamatória</div><div class="opt" data-v="Neuropática">Neuropática</div></div></div>
    </div>
    <div class="sub-title" style="margin-top:14px">EVA</div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:6px">
      <div class="eva-row"><span class="eva-lbl">Repouso</span>${_evaOpts("eva_rep")}</div>
      <div class="eva-row"><span class="eva-lbl">Actividade</span>${_evaOpts("eva_act")}</div>
      <div class="eva-row"><span class="eva-lbl">Pico máximo</span>${_evaOpts("eva_pic")}</div>
    </div>
    <div style="margin-top:12px"><div class="gl">Localização da dor</div>
      <div class="opts mg" id="local_dor"><div class="opt" data-v="Compartimento medial">Medial</div><div class="opt" data-v="Compartimento lateral">Lateral</div><div class="opt" data-v="Região patelofemoral">Patelofemoral</div><div class="opt" data-v="Tendão rotuliano">Tend. rotuliano</div><div class="opt" data-v="Poplíteo">Poplíteo</div></div>
    </div>
  </div>

  <div class="sec">
    <div class="sec-title"><div class="num">2</div>Inspeção &amp; Palpação</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Eixo joelho</div><div class="opts sg" id="insp_eixo"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Varo">Varo</div><div class="opt" data-v="Valgo">Valgo</div></div></div>
      <div class="param-row"><div class="param-label">Edema articular</div><div class="opts sg" id="insp_edema"><div class="opt" data-v="Ausente">Ausente</div><div class="opt" data-v="Ligeiro">Ligeiro</div><div class="opt" data-v="Moderado — derrame articular">Moderado</div><div class="opt" data-v="Volumoso — derrame abundante">Volumoso</div></div></div>
      <div class="param-row"><div class="param-label">Choque rotuliano</div><div class="opts sg" id="choque_rot"><div class="opt" data-v="Ausente">Ausente</div><div class="opt" data-v="Presente">Presente</div></div></div>
      <div class="param-row"><div class="param-label">Interlinha medial</div><div class="opts sg" id="palp_med"><div class="opt" data-v="Indolor">Indolor</div><div class="opt" data-v="Dolorosa">Dolorosa</div></div></div>
      <div class="param-row"><div class="param-label">Interlinha lateral</div><div class="opts sg" id="palp_lat"><div class="opt" data-v="Indolor">Indolor</div><div class="opt" data-v="Dolorosa">Dolorosa</div></div></div>
      <div class="param-row"><div class="param-label">Tendão rotuliano</div><div class="opts sg" id="palp_rot"><div class="opt" data-v="Indolor">Indolor</div><div class="opt" data-v="Doloroso">Doloroso</div></div></div>
      <div class="param-row"><div class="param-label">Tuberosidade tibial anterior</div><div class="opts sg" id="palp_tta"><div class="opt" data-v="Indolor">Indolor</div><div class="opt" data-v="Dolorosa — Osgood-Schlatter?">Dolorosa</div></div></div>
    </div>
  </div>

  <div class="sec">
    <div class="sec-title"><div class="num">3</div>Mobilidade</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Flexão (ref: 140°)</div><div class="opts sg" id="mob_flex"><div class="opt" data-v="Completa">Completa</div><div class="opt" data-v="Limitada c/ dor">Limitada c/ dor</div><div class="opt" data-v="Limitada s/ dor">Limitada s/ dor</div></div></div>
      <div class="param-row"><div class="param-label">Extensão (ref: 0°)</div><div class="opts sg" id="mob_ext"><div class="opt" data-v="Completa">Completa</div><div class="opt" data-v="Défice extensão c/ dor">Défice c/ dor</div><div class="opt" data-v="Défice extensão s/ dor">Défice s/ dor</div><div class="opt" data-v="Recurvatum">Recurvatum</div></div></div>
      <div class="param-row"><div class="param-label">Crepitação</div><div class="opts sg" id="mob_crep"><div class="opt" data-v="Ausente">Ausente</div><div class="opt" data-v="Femoropatelar">Femoropatelar</div><div class="opt" data-v="Femorotibial">Femorotibial</div></div></div>
    </div>
  </div>

  <div class="sec">
    <div class="sec-title"><div class="num">4</div>Testes Específicos</div>
    <div class="sub-title">Ligamentos</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Lachman (LCA)</div><div class="opts sg" id="t_lach"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo — instabilidade anterior">Pos.</div></div></div>
      <div class="param-row"><div class="param-label">Pivot shift (LCA)</div><div class="opts sg" id="t_pivot"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo">Pos.</div></div></div>
      <div class="param-row"><div class="param-label">Gaveta posterior (LCP)</div><div class="opts sg" id="t_gav"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo — instabilidade posterior">Pos.</div></div></div>
      <div class="param-row"><div class="param-label">Valgo stress (LCM)</div><div class="opts sg" id="t_valgo"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo">Pos.</div></div></div>
      <div class="param-row"><div class="param-label">Varo stress (LCL)</div><div class="opts sg" id="t_varo"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo">Pos.</div></div></div>
    </div>
    <div class="sub-title">Meniscos</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">McMurray</div><div class="opts sg" id="t_mcmur"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo medial">Pos. medial</div><div class="opt" data-v="Positivo lateral">Pos. lateral</div></div></div>
      <div class="param-row"><div class="param-label">Thessaly</div><div class="opts sg" id="t_thess"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo">Pos.</div></div></div>
    </div>
    <div class="sub-title">Patela</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Clarke (chondromalacia)</div><div class="opts sg" id="t_clark"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo">Pos.</div></div></div>
      <div class="param-row"><div class="param-label">Apprehension patelar</div><div class="opts sg" id="t_appr"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo">Pos.</div></div></div>
    </div>
  </div>

  <div class="sec">
    <div class="sec-title"><div class="num">5</div>Força &amp; Observações</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Quadricípite</div><div class="opts sg" id="f_quad"><div class="opt" data-v="5/5">5/5</div><div class="opt" data-v="4/5">4/5</div><div class="opt" data-v="3/5">3/5</div><div class="opt" data-v="2/5">2/5</div></div></div>
      <div class="param-row"><div class="param-label">Isquiotibiais</div><div class="opts sg" id="f_isq"><div class="opt" data-v="5/5">5/5</div><div class="opt" data-v="4/5">4/5</div><div class="opt" data-v="3/5">3/5</div><div class="opt" data-v="2/5">2/5</div></div></div>
    </div>
    <div style="margin-top:12px"><div class="gl">Notas / Conclusão</div><textarea id="notas" placeholder="Conclusão clínica, plano..."></textarea></div>
  </div>
</div>
<div id="toast">✓ Copiado — cole na consulta (Ctrl+V)</div>
<div class="bar-acoes"><button class="btn-pdf" id="btnPdf">Imprimir / PDF</button><button class="btn-copy" id="btnCopy">Copiar resumo para consulta</button></div>
<script>
${_mskJs}
window._gerarResumo = function(){
  var g=window._getOpt,m=window._getMulti,v=window._getVal,e=window._evaRow;
  var L=['── JOELHO — EXAME OBJECTIVO ──'];
  var lado=g('lado'); if(lado) L.push('Joelho '+lado);
  var evStr=[e('eva_rep')?'repouso '+e('eva_rep'):'',e('eva_act')?'actividade '+e('eva_act'):'',e('eva_pic')?'pico '+e('eva_pic'):''].filter(Boolean).join(' | ');
  if(evStr) L.push('EVA: '+evStr);
  var td=g('tipo_dor'); if(td) L.push('Dor: '+td);
  var ld=m('local_dor'); if(ld.length) L.push('Localização: '+ld.join(', '));
  L.push('');L.push('Inspeção/Palpação:');
  [['Eixo',g('insp_eixo')],['Edema',g('insp_edema')],['Choque rotuliano',g('choque_rot')],['Interlinha medial',g('palp_med')],['Interlinha lateral',g('palp_lat')],['Tendão rotuliano',g('palp_rot')],['Tuberosidade tibial',g('palp_tta')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
  L.push('');L.push('Mobilidade:');
  [['Flexão',g('mob_flex')],['Extensão',g('mob_ext')],['Crepitação',g('mob_crep')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
  L.push('');L.push('Testes:');
  [['Lachman',g('t_lach')],['Pivot shift',g('t_pivot')],['Gaveta posterior',g('t_gav')],['Valgo stress',g('t_valgo')],['Varo stress',g('t_varo')],['McMurray',g('t_mcmur')],['Thessaly',g('t_thess')],['Clarke',g('t_clark')],['Apprehension patelar',g('t_appr')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
  L.push('');L.push('Força:');
  [['Quadricípite',g('f_quad')],['Isquiotibiais',g('f_isq')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
  var n=v('notas'); if(n){L.push('');L.push('Notas: '+n);}
  L.push('');L.push('──────────────────────────────────────────────────');
  return L.join('\\n');
};
</script></body></html>`);
      return;
    }

    /* ══════════════════════════════════════════════════════════════
       TIBIOTÁRSICA / PÉ
    ══════════════════════════════════════════════════════════════ */
    if (formId === "tibio") {
      _abrirBlob(`<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8">
<title>Exame Objectivo — Tibiotársica / Pé</title><style>${_mskCss}</style></head><body>
<div class="page">
  <h1>Exame Objectivo — Tibiotársica / Pé</h1>
  <div class="subtitle">Clique nas opções · Copie para a consulta no final</div>

  <div class="sec">
    <div class="sec-title"><div class="num">1</div>Lateralidade &amp; Dor</div>
    <div class="cols2">
      <div><div class="gl">Tibiotársica/pé avaliado</div><div class="opts sg" id="lado"><div class="opt" data-v="Direito">Direito</div><div class="opt" data-v="Esquerdo">Esquerdo</div><div class="opt" data-v="Bilateral">Bilateral</div></div></div>
      <div><div class="gl">Tipo de dor</div><div class="opts sg" id="tipo_dor"><div class="opt" data-v="Mecânica">Mecânica</div><div class="opt" data-v="Inflamatória">Inflamatória</div><div class="opt" data-v="Neuropática">Neuropática</div></div></div>
    </div>
    <div class="sub-title" style="margin-top:14px">EVA</div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:6px">
      <div class="eva-row"><span class="eva-lbl">Repouso</span>${_evaOpts("eva_rep")}</div>
      <div class="eva-row"><span class="eva-lbl">Actividade</span>${_evaOpts("eva_act")}</div>
      <div class="eva-row"><span class="eva-lbl">Pico máximo</span>${_evaOpts("eva_pic")}</div>
    </div>
    <div style="margin-top:12px"><div class="gl">Localização da dor</div>
      <div class="opts mg" id="local_dor"><div class="opt" data-v="Face anterior tibiotársica">Anterior</div><div class="opt" data-v="Maléolo medial">Maléolo medial</div><div class="opt" data-v="Maléolo lateral">Maléolo lateral</div><div class="opt" data-v="Calcâneo — inserção aquiliana">Calcâneo/aquileu</div><div class="opt" data-v="Plantar — fascia plantar">Fascia plantar</div><div class="opt" data-v="Antepé — metatarsos">Antepé</div></div>
    </div>
  </div>

  <div class="sec">
    <div class="sec-title"><div class="num">2</div>Inspeção &amp; Palpação</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Morfologia do arco plantar</div><div class="opts sg" id="insp_arco"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Pé plano">Pé plano</div><div class="opt" data-v="Pé cavo">Pé cavo</div></div></div>
      <div class="param-row"><div class="param-label">Edema</div><div class="opts sg" id="insp_edema"><div class="opt" data-v="Ausente">Ausente</div><div class="opt" data-v="Pré-maleolar">Pré-maleolar</div><div class="opt" data-v="Difuso">Difuso</div></div></div>
      <div class="param-row"><div class="param-label">Tendão aquiliano</div><div class="opts sg" id="palp_aq"><div class="opt" data-v="Indolor">Indolor</div><div class="opt" data-v="Doloroso — corpo tendão">Corpo tendão</div><div class="opt" data-v="Doloroso — inserção">Inserção</div></div></div>
      <div class="param-row"><div class="param-label">Fascia plantar — inserção</div><div class="opts sg" id="palp_fasc"><div class="opt" data-v="Indolor">Indolor</div><div class="opt" data-v="Dolorosa à palpação">Dolorosa</div></div></div>
      <div class="param-row"><div class="param-label">Peroné/maléolo lateral</div><div class="opts sg" id="palp_lat"><div class="opt" data-v="Indolor">Indolor</div><div class="opt" data-v="Doloroso">Doloroso</div></div></div>
    </div>
  </div>

  <div class="sec">
    <div class="sec-title"><div class="num">3</div>Mobilidade</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Dorsiflexão (ref: 20°)</div><div class="opts sg" id="mob_dors"><div class="opt" data-v="Completa">Completa</div><div class="opt" data-v="Limitada c/ dor">Limitada c/ dor</div><div class="opt" data-v="Limitada s/ dor">Limitada s/ dor</div></div></div>
      <div class="param-row"><div class="param-label">Flexão plantar (ref: 50°)</div><div class="opts sg" id="mob_plan"><div class="opt" data-v="Completa">Completa</div><div class="opt" data-v="Limitada c/ dor">Limitada c/ dor</div><div class="opt" data-v="Limitada s/ dor">Limitada s/ dor</div></div></div>
      <div class="param-row"><div class="param-label">Inversão / Eversão</div><div class="opts sg" id="mob_inv"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Inversão dolorosa">Inversão dolorosa</div><div class="opt" data-v="Eversão dolorosa">Eversão dolorosa</div><div class="opt" data-v="Ambas dolorosas">Ambas dolorosas</div></div></div>
    </div>
  </div>

  <div class="sec">
    <div class="sec-title"><div class="num">4</div>Testes Específicos &amp; Força</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Squeeze test fíbula</div><div class="opts sg" id="t_squeeze"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo — suspeita fractura">Pos.</div></div></div>
      <div class="param-row"><div class="param-label">Thompson (aquileu)</div><div class="opts sg" id="t_thomp"><div class="opt" data-v="Negativo — aquileu íntegro">Neg.</div><div class="opt" data-v="Positivo — suspeita rotura">Pos.</div></div></div>
      <div class="param-row"><div class="param-label">Drawer anterior tíbio-peroneio</div><div class="opts sg" id="t_draw"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo — lesão LPF">Pos.</div></div></div>
      <div class="param-row"><div class="param-label">Stress em inversão (LPF)</div><div class="opts sg" id="t_stress"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo">Pos.</div></div></div>
    </div>
    <div class="sub-title">Força (marcha funcional)</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Marcha em pontas (S1)</div><div class="opts sg" id="f_pont"><div class="opt" data-v="Normal bilateral">Normal</div><div class="opt" data-v="Dificuldade unilateral">Dificuldade</div><div class="opt" data-v="Incapaz">Incapaz</div></div></div>
      <div class="param-row"><div class="param-label">Marcha em calcanhares (L4–L5)</div><div class="opts sg" id="f_calc"><div class="opt" data-v="Normal bilateral">Normal</div><div class="opt" data-v="Dificuldade unilateral">Dificuldade</div><div class="opt" data-v="Incapaz">Incapaz</div></div></div>
    </div>
  </div>

  <div class="sec">
    <div class="sec-title"><div class="num">5</div>Observações</div>
    <textarea id="notas" placeholder="Conclusão clínica, plano..."></textarea>
  </div>
</div>
<div id="toast">✓ Copiado — cole na consulta (Ctrl+V)</div>
<div class="bar-acoes"><button class="btn-pdf" id="btnPdf">Imprimir / PDF</button><button class="btn-copy" id="btnCopy">Copiar resumo para consulta</button></div>
<script>
${_mskJs}
window._gerarResumo = function(){
  var g=window._getOpt,m=window._getMulti,v=window._getVal,e=window._evaRow;
  var L=['── TIBIOTÁRSICA / PÉ — EXAME OBJECTIVO ──'];
  var lado=g('lado'); if(lado) L.push('Tibiotársica/pé '+lado);
  var evStr=[e('eva_rep')?'repouso '+e('eva_rep'):'',e('eva_act')?'actividade '+e('eva_act'):'',e('eva_pic')?'pico '+e('eva_pic'):''].filter(Boolean).join(' | ');
  if(evStr) L.push('EVA: '+evStr);
  var td=g('tipo_dor'); if(td) L.push('Dor: '+td);
  var ld=m('local_dor'); if(ld.length) L.push('Localização: '+ld.join(', '));
  L.push('');L.push('Inspeção/Palpação:');
  [['Arco plantar',g('insp_arco')],['Edema',g('insp_edema')],['Aquileu',g('palp_aq')],['Fascia plantar',g('palp_fasc')],['Maléolo lateral',g('palp_lat')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
  L.push('');L.push('Mobilidade:');
  [['Dorsiflexão',g('mob_dors')],['Flexão plantar',g('mob_plan')],['Inversão/Eversão',g('mob_inv')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
  L.push('');L.push('Testes:');
  [['Squeeze fíbula',g('t_squeeze')],['Thompson',g('t_thomp')],['Drawer anterior',g('t_draw')],['Stress inversão',g('t_stress')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
  L.push('');L.push('Força:');
  [['Pontas (S1)',g('f_pont')],['Calcanhares (L4-L5)',g('f_calc')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
  var n=v('notas'); if(n){L.push('');L.push('Notas: '+n);}
  L.push('');L.push('──────────────────────────────────────────────────');
  return L.join('\\n');
};
</script></body></html>`);
      return;
    }

    /* ══════════════════════════════════════════════════════════════
       COLUNA CERVICAL
    ══════════════════════════════════════════════════════════════ */
    if (formId === "cervical") {
      _abrirBlob(`<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8">
<title>Exame Objectivo — Coluna Cervical</title><style>${_mskCss}</style></head><body>
<div class="page">
  <h1>Exame Objectivo — Coluna Cervical</h1>
  <div class="subtitle">Clique nas opções · Copie para a consulta no final</div>

  <div class="sec">
    <div class="sec-title"><div class="num">1</div>Localização da Dor &amp; Irradiação</div>
    <div class="cols2">
      <div><div class="gl">Localização predominante</div><div class="opts sg" id="local_pred"><div class="opt" data-v="Central">Central</div><div class="opt" data-v="Direita">Direita</div><div class="opt" data-v="Esquerda">Esquerda</div><div class="opt" data-v="Bilateral">Bilateral</div></div></div>
      <div><div class="gl">Tipo de dor</div><div class="opts sg" id="tipo_dor"><div class="opt" data-v="Mecânica">Mecânica</div><div class="opt" data-v="Inflamatória">Inflamatória</div><div class="opt" data-v="Neuropática">Neuropática</div></div></div>
    </div>
    <div class="sub-title" style="margin-top:14px">EVA</div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:6px">
      <div class="eva-row"><span class="eva-lbl">Repouso</span>${_evaOpts("eva_rep")}</div>
      <div class="eva-row"><span class="eva-lbl">Actividade</span>${_evaOpts("eva_act")}</div>
      <div class="eva-row"><span class="eva-lbl">Pico máximo</span>${_evaOpts("eva_pic")}</div>
    </div>
    <div style="margin-top:12px"><div class="gl">Irradiação</div>
      <div class="opts mg" id="irrad"><div class="opt" data-v="Sem irradiação">Sem irradiação</div><div class="opt" data-v="Ombro">Ombro</div><div class="opt" data-v="Braço">Braço</div><div class="opt" data-v="Antebraço">Antebraço</div><div class="opt" data-v="Mão / dedos">Mão/dedos</div></div>
    </div>
    <div style="margin-top:10px"><div class="gl">Sintomas neurológicos</div>
      <div class="opts mg" id="sint_neuro"><div class="opt" data-v="Sem sintomas neurológicos">Sem sint. neuro.</div><div class="opt" data-v="Parestesias">Parestesias</div><div class="opt" data-v="Dormência">Dormência</div><div class="opt" data-v="Fraqueza membro">Fraqueza</div><div class="opt" data-v="Cefaleias">Cefaleias</div></div>
    </div>
  </div>

  <div class="sec">
    <div class="sec-title"><div class="num">2</div>Inspeção &amp; Palpação</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Postura cabeça</div><div class="opts sg" id="insp_post"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Cabeça anteriorizada">Anteriorizada</div></div></div>
      <div class="param-row"><div class="param-label">Hipercifose dorsal assoc.</div><div class="opts sg" id="insp_cif"><div class="opt" data-v="Sem hipercifose">Sem</div><div class="opt" data-v="Hipercifose dorsal associada">Hipercifose</div></div></div>
      <div class="param-row"><div class="param-label">Musculatura paravertebral cerv.</div><div class="opts sg" id="palp_par"><div class="opt" data-v="Sem dor">Sem dor</div><div class="opt" data-v="Contratura bilateral">Contratura bilateral</div><div class="opt" data-v="Contratura direita">Contratura D</div><div class="opt" data-v="Contratura esquerda">Contratura E</div></div></div>
      <div class="param-row"><div class="param-label">Trapézio superior</div><div class="opts sg" id="palp_trap"><div class="opt" data-v="Indolor">Indolor</div><div class="opt" data-v="Doloroso bilateral">Bilateral</div><div class="opt" data-v="Doloroso direito">D</div><div class="opt" data-v="Doloroso esquerdo">E</div></div></div>
      <div class="param-row"><div class="param-label">Articulações facetárias</div><div class="opts sg" id="palp_fac"><div class="opt" data-v="Indolor">Indolor</div><div class="opt" data-v="Dolorosas">Dolorosas</div></div></div>
    </div>
  </div>

  <div class="sec">
    <div class="sec-title"><div class="num">3</div>Mobilidade Cervical</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Flexão (ref: 45°)</div><div class="opts sg" id="mob_flex"><div class="opt" data-v="Completa">Completa</div><div class="opt" data-v="Limitada c/ dor">Limitada c/ dor</div><div class="opt" data-v="Limitada s/ dor">Limitada s/ dor</div></div></div>
      <div class="param-row"><div class="param-label">Extensão (ref: 60°)</div><div class="opts sg" id="mob_ext"><div class="opt" data-v="Completa">Completa</div><div class="opt" data-v="Limitada c/ dor">Limitada c/ dor</div><div class="opt" data-v="Limitada s/ dor">Limitada s/ dor</div></div></div>
      <div class="param-row"><div class="param-label">Rotação D (ref: 80°)</div><div class="opts sg" id="mob_rotd"><div class="opt" data-v="Completa">Completa</div><div class="opt" data-v="Limitada c/ dor">Limitada c/ dor</div><div class="opt" data-v="Limitada s/ dor">Limitada s/ dor</div></div></div>
      <div class="param-row"><div class="param-label">Rotação E (ref: 80°)</div><div class="opts sg" id="mob_rote"><div class="opt" data-v="Completa">Completa</div><div class="opt" data-v="Limitada c/ dor">Limitada c/ dor</div><div class="opt" data-v="Limitada s/ dor">Limitada s/ dor</div></div></div>
      <div class="param-row"><div class="param-label">Inclinação lateral D (ref: 45°)</div><div class="opts sg" id="mob_incd"><div class="opt" data-v="Completa">Completa</div><div class="opt" data-v="Limitada c/ dor">Limitada c/ dor</div></div></div>
      <div class="param-row"><div class="param-label">Inclinação lateral E (ref: 45°)</div><div class="opts sg" id="mob_ince"><div class="opt" data-v="Completa">Completa</div><div class="opt" data-v="Limitada c/ dor">Limitada c/ dor</div></div></div>
    </div>
  </div>

  <div class="sec">
    <div class="sec-title"><div class="num">4</div>Avaliação Neurológica</div>
    <div class="sub-title">Força (Miotomos)</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">C5 — abdução ombro</div><div class="opts sg" id="f_c5"><div class="opt" data-v="5/5">5/5</div><div class="opt" data-v="4/5">4/5</div><div class="opt" data-v="3/5">3/5</div><div class="opt" data-v="2/5">2/5</div></div></div>
      <div class="param-row"><div class="param-label">C6 — flexão cotovelo</div><div class="opts sg" id="f_c6"><div class="opt" data-v="5/5">5/5</div><div class="opt" data-v="4/5">4/5</div><div class="opt" data-v="3/5">3/5</div><div class="opt" data-v="2/5">2/5</div></div></div>
      <div class="param-row"><div class="param-label">C7 — extensão cotovelo</div><div class="opts sg" id="f_c7"><div class="opt" data-v="5/5">5/5</div><div class="opt" data-v="4/5">4/5</div><div class="opt" data-v="3/5">3/5</div><div class="opt" data-v="2/5">2/5</div></div></div>
      <div class="param-row"><div class="param-label">C8 — flexão dedos</div><div class="opts sg" id="f_c8"><div class="opt" data-v="5/5">5/5</div><div class="opt" data-v="4/5">4/5</div><div class="opt" data-v="3/5">3/5</div><div class="opt" data-v="2/5">2/5</div></div></div>
      <div class="param-row"><div class="param-label">T1 — interósseos</div><div class="opts sg" id="f_t1"><div class="opt" data-v="5/5">5/5</div><div class="opt" data-v="4/5">4/5</div><div class="opt" data-v="3/5">3/5</div><div class="opt" data-v="2/5">2/5</div></div></div>
    </div>
    <div class="sub-title">Sensibilidade (Dermátomos)</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">C5 — face lateral braço</div><div class="opts sg" id="s_c5"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Diminuída">Diminuída</div><div class="opt" data-v="Ausente">Ausente</div></div></div>
      <div class="param-row"><div class="param-label">C6 — polegar</div><div class="opts sg" id="s_c6"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Diminuída">Diminuída</div><div class="opt" data-v="Ausente">Ausente</div></div></div>
      <div class="param-row"><div class="param-label">C7 — dedo médio</div><div class="opts sg" id="s_c7"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Diminuída">Diminuída</div><div class="opt" data-v="Ausente">Ausente</div></div></div>
      <div class="param-row"><div class="param-label">C8 — 5º dedo</div><div class="opts sg" id="s_c8"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Diminuída">Diminuída</div><div class="opt" data-v="Ausente">Ausente</div></div></div>
    </div>
  </div>


  <!-- RED FLAGS -->
  <div class="sec" style="border:1px solid #fecaca;background:#fff;">
    <div class="sec-title" style="color:#dc2626;border-color:#fecaca;"><div class="num" style="background:#dc2626;">!</div>Red Flags — Alerta Clínico</div>
    <div id="cerv_rf_warn" class="rf-warn">⚠️ Red flag presente — investigar / referenciar urgente</div>
    <div class="param-grid">
      <div class="rf-row"><input type="checkbox" class="rf-cb" data-rf="Febre" id="crf1"><label class="rf-lbl" for="crf1">Febre</label><span class="rf-tip" data-tip="Suspeita infecção vertebral / neoplasia">i</span></div>
      <div class="rf-row"><input type="checkbox" class="rf-cb" data-rf="Perda ponderal inexplicada" id="crf2"><label class="rf-lbl" for="crf2">Perda ponderal inexplicada</label><span class="rf-tip" data-tip="Neoplasia — investigar">i</span></div>
      <div class="rf-row"><input type="checkbox" class="rf-cb" data-rf="História de neoplasia" id="crf3"><label class="rf-lbl" for="crf3">História de neoplasia</label><span class="rf-tip" data-tip="Métastases vertebrais">i</span></div>
      <div class="rf-row"><input type="checkbox" class="rf-cb" data-rf="Trauma significativo" id="crf4"><label class="rf-lbl" for="crf4">Trauma significativo</label><span class="rf-tip" data-tip="Fractura vertebral — Rx urgente">i</span></div>
      <div class="rf-row"><input type="checkbox" class="rf-cb" data-rf="Dor noturna persistente" id="crf5"><label class="rf-lbl" for="crf5">Dor noturna persistente</label><span class="rf-tip" data-tip="Neoplasia / espondilodiscite">i</span></div>
      <div class="rf-row"><input type="checkbox" class="rf-cb" data-rf="Défice neurológico progressivo" id="crf6"><label class="rf-lbl" for="crf6">Défice neurológico progressivo</label><span class="rf-tip" data-tip="Compressão medular — urgente">i</span></div>
      <div class="rf-row"><input type="checkbox" class="rf-cb" data-rf="Incontinência urinária ou fecal" id="crf7"><label class="rf-lbl" for="crf7">Incontinência urinária / fecal</label><span class="rf-tip" data-tip="Síndrome cauda equina — emergência">i</span></div>
      <div class="rf-row"><input type="checkbox" class="rf-cb" data-rf="Anestesia em sela" id="crf8"><label class="rf-lbl" for="crf8">Anestesia em sela</label><span class="rf-tip" data-tip="Síndrome cauda equina — emergência">i</span></div>
      <div class="rf-row"><input type="checkbox" class="rf-cb" data-rf="Suspeita de infecção vertebral" id="crf9"><label class="rf-lbl" for="crf9">Suspeita de infecção vertebral</label><span class="rf-tip" data-tip="Espondilodiscite — antibioterapia / cirurgia">i</span></div>
    </div>
  </div>
  <div class="sec">
    <div class="sec-title"><div class="num">5</div>Testes Específicos &amp; Observações</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Spurling</div><div class="opts sg" id="t_spur"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo D">Pos. D</div><div class="opt" data-v="Positivo E">Pos. E</div></div></div>
      <div class="param-row"><div class="param-label">Distração cervical</div><div class="opts sg" id="t_distr"><div class="opt" data-v="Sem alívio">Sem alívio</div><div class="opt" data-v="Alívio com distracção">Alívio c/ distracção</div></div></div>
      <div class="param-row"><div class="param-label">Compressão foraminal</div><div class="opts sg" id="t_foram"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo — reproduz irradiação">Pos.</div></div></div>
    </div>
    <div style="margin-top:12px"><div class="gl">Notas / Conclusão</div><textarea id="notas" placeholder="Ex: radiculopatia C6 direita, síndrome cervical miofascial..."></textarea></div>
  </div>
</div>
<div id="toast">✓ Copiado — cole na consulta (Ctrl+V)</div>
<div class="bar-acoes"><button class="btn-pdf" id="btnPdf">Imprimir / PDF</button><button class="btn-copy" id="btnCopy">Copiar resumo para consulta</button></div>
<script>
${_mskJs}
window._gerarResumo = function(){
  var g=window._getOpt,m=window._getMulti,v=window._getVal,e=window._evaRow;
  var L=['── COLUNA CERVICAL — EXAME OBJECTIVO ──'];
  var lp=g('local_pred'); if(lp) L.push('Localização: '+lp);
  var evStr=[e('eva_rep')?'repouso '+e('eva_rep'):'',e('eva_act')?'actividade '+e('eva_act'):'',e('eva_pic')?'pico '+e('eva_pic'):''].filter(Boolean).join(' | ');
  if(evStr) L.push('EVA: '+evStr);
  var td=g('tipo_dor'); if(td) L.push('Dor: '+td);
  var ir=m('irrad'); if(ir.length) L.push('Irradiação: '+ir.join(', '));
  var sn=m('sint_neuro'); if(sn.length) L.push('Sint. neurológicos: '+sn.join(', '));
  var rf=(typeof window.getRF==='function'?window.getRF():[]).filter(function(x){return x;}); if(rf.length){L.push('');L.push('RED FLAGS: '+rf.join(', '));}
  L.push('');L.push('Inspeção/Palpação:');
  [['Postura',g('insp_post')],['Hipercifose',g('insp_cif')],['Paravertebral cerv.',g('palp_par')],['Trapézio',g('palp_trap')],['Facetárias',g('palp_fac')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
  L.push('');L.push('Mobilidade:');
  [['Flexão',g('mob_flex')],['Extensão',g('mob_ext')],['Rotação D',g('mob_rotd')],['Rotação E',g('mob_rote')],['Inclinação D',g('mob_incd')],['Inclinação E',g('mob_ince')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
  L.push('');L.push('Força (miotomos):');
  [['C5 (abd. ombro)',g('f_c5')],['C6 (flex. cotov.)',g('f_c6')],['C7 (ext. cotov.)',g('f_c7')],['C8 (flex. dedos)',g('f_c8')],['T1 (interósseos)',g('f_t1')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
  L.push('');L.push('Sensibilidade (dermátomos):');
  [['C5',g('s_c5')],['C6',g('s_c6')],['C7',g('s_c7')],['C8',g('s_c8')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
  L.push('');L.push('Testes:');
  [['Spurling',g('t_spur')],['Distracção',g('t_distr')],['Compressão foraminal',g('t_foram')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
  var n=v('notas'); if(n){L.push('');L.push('Conclusão: '+n);}
  L.push('');L.push('──────────────────────────────────────────────────');
  return L.join('\\n');
};
</script></body></html>`);
      return;
    }

    /* ══════════════════════════════════════════════════════════════
       COLUNA LOMBAR
    ══════════════════════════════════════════════════════════════ */
    if (formId === "lombar") {
      _abrirBlob(`<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8">
<title>Exame Objectivo — Coluna Lombar</title><style>${_mskCss}</style></head><body>
<div class="page">
  <h1>Exame Objectivo — Coluna Lombar</h1>
  <div class="subtitle">Clique nas opções · Copie para a consulta no final</div>

  <div class="sec">
    <div class="sec-title"><div class="num">1</div>Localização da Dor &amp; Irradiação</div>
    <div class="cols2">
      <div><div class="gl">Localização</div><div class="opts sg" id="local_pred"><div class="opt" data-v="Central">Central</div><div class="opt" data-v="Lombar direita">Lombar D</div><div class="opt" data-v="Lombar esquerda">Lombar E</div><div class="opt" data-v="Bilateral">Bilateral</div></div></div>
      <div><div class="gl">Tipo de dor</div><div class="opts sg" id="tipo_dor"><div class="opt" data-v="Mecânica">Mecânica</div><div class="opt" data-v="Inflamatória">Inflamatória</div><div class="opt" data-v="Neuropática">Neuropática</div></div></div>
    </div>
    <div class="sub-title" style="margin-top:14px">EVA</div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:6px">
      <div class="eva-row"><span class="eva-lbl">Repouso</span>${_evaOpts("eva_rep")}</div>
      <div class="eva-row"><span class="eva-lbl">Actividade</span>${_evaOpts("eva_act")}</div>
      <div class="eva-row"><span class="eva-lbl">Pico máximo</span>${_evaOpts("eva_pic")}</div>
    </div>
    <div style="margin-top:12px"><div class="gl">Irradiação</div>
      <div class="opts mg" id="irrad"><div class="opt" data-v="Sem irradiação">Sem irradiação</div><div class="opt" data-v="Glúteo">Glúteo</div><div class="opt" data-v="Coxa">Coxa</div><div class="opt" data-v="Perna">Perna</div><div class="opt" data-v="Pé">Pé</div></div>
    </div>
    <div style="margin-top:10px"><div class="gl">Sintomas neurológicos</div>
      <div class="opts mg" id="sint_neuro"><div class="opt" data-v="Sem sintomas neurológicos">Sem sint. neuro.</div><div class="opt" data-v="Parestesias">Parestesias</div><div class="opt" data-v="Dormência">Dormência</div><div class="opt" data-v="Fraqueza membro inferior">Fraqueza MI</div><div class="opt" data-v="Disfunção esfincteriana — urgente">Disfunção esfinc.</div></div>
    </div>
  </div>

  <div class="sec">
    <div class="sec-title"><div class="num">2</div>Inspeção &amp; Palpação</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Coluna sagital</div><div class="opts mg" id="insp_sag"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Hiperlordose lombar">Hiperlordose</div><div class="opt" data-v="Rectificação lombar">Rectificação</div><div class="opt" data-v="Cifose lombar">Cifose</div></div></div>
      <div class="param-row"><div class="param-label">Escoliose</div><div class="opts sg" id="insp_escol"><div class="opt" data-v="Sem escoliose">Sem</div><div class="opt" data-v="Escoliose postural">Postural</div><div class="opt" data-v="Escoliose estrutural">Estrutural</div></div></div>
      <div class="param-row"><div class="param-label">Postura antálgica</div><div class="opts sg" id="insp_antal"><div class="opt" data-v="Ausente">Ausente</div><div class="opt" data-v="Presente — inclinação lateral">Inclinação lateral</div></div></div>
      <div class="param-row"><div class="param-label">Espinhosas lombares</div><div class="opts sg" id="palp_esp"><div class="opt" data-v="Indolores">Indolores</div><div class="opt" data-v="Dolorosas">Dolorosas</div></div></div>
      <div class="param-row"><div class="param-label">Paravertebral lombar</div><div class="opts sg" id="palp_par"><div class="opt" data-v="Sem dor">Sem dor</div><div class="opt" data-v="Contratura bilateral">Contratura bilateral</div><div class="opt" data-v="Contratura direita">Contratura D</div><div class="opt" data-v="Contratura esquerda">Contratura E</div></div></div>
      <div class="param-row"><div class="param-label">Sacroilíacas</div><div class="opts sg" id="palp_si"><div class="opt" data-v="Indolores">Indolores</div><div class="opt" data-v="Dolorosa direita">Dolorosa D</div><div class="opt" data-v="Dolorosa esquerda">Dolorosa E</div><div class="opt" data-v="Bilateral">Bilateral</div></div></div>
    </div>
  </div>

  <div class="sec">
    <div class="sec-title"><div class="num">3</div>Mobilidade Lombar</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Flexão — Schober</div><div class="opts sg" id="mob_flex"><div class="opt" data-v="Normal (&gt;5cm)">Normal (&gt;5cm)</div><div class="opt" data-v="Ligeiramente limitada (3-5cm)">Ligeira (3-5cm)</div><div class="opt" data-v="Moderadamente limitada (1-3cm)">Moderada (1-3cm)</div><div class="opt" data-v="Muito limitada (&lt;1cm)">Muito limitada</div></div></div>
      <div class="param-row"><div class="param-label">Extensão</div><div class="opts sg" id="mob_ext"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Limitada c/ dor">Limitada c/ dor</div><div class="opt" data-v="Limitada s/ dor">Limitada s/ dor</div></div></div>
      <div class="param-row"><div class="param-label">Inclinação lateral D</div><div class="opts sg" id="mob_incd"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Limitada c/ dor">Limitada c/ dor</div></div></div>
      <div class="param-row"><div class="param-label">Inclinação lateral E</div><div class="opts sg" id="mob_ince"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Limitada c/ dor">Limitada c/ dor</div></div></div>
    </div>
  </div>

  <div class="sec">
    <div class="sec-title"><div class="num">4</div>Avaliação Neurológica</div>
    <div class="sub-title">Força (Miotomos)</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">L2 — flexão anca</div><div class="opts sg" id="f_l2"><div class="opt" data-v="5/5">5/5</div><div class="opt" data-v="4/5">4/5</div><div class="opt" data-v="3/5">3/5</div><div class="opt" data-v="2/5">2/5</div></div></div>
      <div class="param-row"><div class="param-label">L3 — extensão joelho</div><div class="opts sg" id="f_l3"><div class="opt" data-v="5/5">5/5</div><div class="opt" data-v="4/5">4/5</div><div class="opt" data-v="3/5">3/5</div><div class="opt" data-v="2/5">2/5</div></div></div>
      <div class="param-row"><div class="param-label">L4 — dorsiflexão pé</div><div class="opts sg" id="f_l4"><div class="opt" data-v="5/5">5/5</div><div class="opt" data-v="4/5">4/5</div><div class="opt" data-v="3/5">3/5</div><div class="opt" data-v="2/5">2/5</div></div></div>
      <div class="param-row"><div class="param-label">L5 — extensão hálux</div><div class="opts sg" id="f_l5"><div class="opt" data-v="5/5">5/5</div><div class="opt" data-v="4/5">4/5</div><div class="opt" data-v="3/5">3/5</div><div class="opt" data-v="2/5">2/5</div></div></div>
      <div class="param-row"><div class="param-label">S1 — flexão plantar</div><div class="opts sg" id="f_s1"><div class="opt" data-v="5/5">5/5</div><div class="opt" data-v="4/5">4/5</div><div class="opt" data-v="3/5">3/5</div><div class="opt" data-v="2/5">2/5</div></div></div>
    </div>
    <div class="sub-title">Sensibilidade (Dermátomos)</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">L3 — joelho medial</div><div class="opts sg" id="s_l3"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Diminuída">Diminuída</div><div class="opt" data-v="Ausente">Ausente</div></div></div>
      <div class="param-row"><div class="param-label">L4 — face medial perna</div><div class="opts sg" id="s_l4"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Diminuída">Diminuída</div><div class="opt" data-v="Ausente">Ausente</div></div></div>
      <div class="param-row"><div class="param-label">L5 — dorso do pé</div><div class="opts sg" id="s_l5"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Diminuída">Diminuída</div><div class="opt" data-v="Ausente">Ausente</div></div></div>
      <div class="param-row"><div class="param-label">S1 — face lateral pé</div><div class="opts sg" id="s_s1"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Diminuída">Diminuída</div><div class="opt" data-v="Ausente">Ausente</div></div></div>
    </div>
    <div class="sub-title">Marcha Neurológica</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Marcha em pontas (S1)</div><div class="opts sg" id="marcha_pont"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Dificuldade">Dificuldade</div><div class="opt" data-v="Incapaz">Incapaz</div></div></div>
      <div class="param-row"><div class="param-label">Marcha em calcanhares (L4–L5)</div><div class="opts sg" id="marcha_calc"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Dificuldade">Dificuldade</div><div class="opt" data-v="Incapaz">Incapaz</div></div></div>
    </div>
  </div>


  <!-- RED FLAGS -->
  <div class="sec" style="border:1px solid #fecaca;background:#fff;">
    <div class="sec-title" style="color:#dc2626;border-color:#fecaca;"><div class="num" style="background:#dc2626;">!</div>Red Flags — Alerta Clínico</div>
    <div id="lomb_rf_warn" class="rf-warn">⚠️ Red flag presente — investigar / referenciar urgente</div>
    <div class="param-grid">
      <div class="rf-row"><input type="checkbox" class="rf-cb" data-rf="Febre" id="lrf1"><label class="rf-lbl" for="lrf1">Febre</label><span class="rf-tip" data-tip="Suspeita infecção vertebral / neoplasia">i</span></div>
      <div class="rf-row"><input type="checkbox" class="rf-cb" data-rf="Perda ponderal inexplicada" id="lrf2"><label class="rf-lbl" for="lrf2">Perda ponderal inexplicada</label><span class="rf-tip" data-tip="Neoplasia — investigar">i</span></div>
      <div class="rf-row"><input type="checkbox" class="rf-cb" data-rf="História de neoplasia" id="lrf3"><label class="rf-lbl" for="lrf3">História de neoplasia</label><span class="rf-tip" data-tip="Métastases vertebrais">i</span></div>
      <div class="rf-row"><input type="checkbox" class="rf-cb" data-rf="Trauma significativo" id="lrf4"><label class="rf-lbl" for="lrf4">Trauma significativo</label><span class="rf-tip" data-tip="Fractura vertebral — Rx urgente">i</span></div>
      <div class="rf-row"><input type="checkbox" class="rf-cb" data-rf="Dor noturna persistente" id="lrf5"><label class="rf-lbl" for="lrf5">Dor noturna persistente</label><span class="rf-tip" data-tip="Neoplasia / espondilodiscite">i</span></div>
      <div class="rf-row"><input type="checkbox" class="rf-cb" data-rf="Défice neurológico progressivo" id="lrf6"><label class="rf-lbl" for="lrf6">Défice neurológico progressivo</label><span class="rf-tip" data-tip="Compressão medular — urgente">i</span></div>
      <div class="rf-row"><input type="checkbox" class="rf-cb" data-rf="Incontinência urinária ou fecal" id="lrf7"><label class="rf-lbl" for="lrf7">Incontinência urinária / fecal</label><span class="rf-tip" data-tip="Síndrome cauda equina — emergência">i</span></div>
      <div class="rf-row"><input type="checkbox" class="rf-cb" data-rf="Anestesia em sela" id="lrf8"><label class="rf-lbl" for="lrf8">Anestesia em sela</label><span class="rf-tip" data-tip="Síndrome cauda equina — emergência">i</span></div>
      <div class="rf-row"><input type="checkbox" class="rf-cb" data-rf="Suspeita de infecção vertebral" id="lrf9"><label class="rf-lbl" for="lrf9">Suspeita de infecção vertebral</label><span class="rf-tip" data-tip="Espondilodiscite — antibioterapia / cirurgia">i</span></div>
    </div>
  </div>
  <div class="sec">
    <div class="sec-title"><div class="num">5</div>Testes Específicos &amp; Observações</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Lasègue D (elevação perna)</div><div class="opts sg" id="t_las_d"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo &lt;30°">Pos. &lt;30°</div><div class="opt" data-v="Positivo 30°–60°">Pos. 30-60°</div><div class="opt" data-v="Positivo &gt;60°">Pos. &gt;60°</div></div></div>
      <div class="param-row"><div class="param-label">Lasègue E (elevação perna)</div><div class="opts sg" id="t_las_e"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo &lt;30°">Pos. &lt;30°</div><div class="opt" data-v="Positivo 30°–60°">Pos. 30-60°</div><div class="opt" data-v="Positivo &gt;60°">Pos. &gt;60°</div></div></div>
      <div class="param-row"><div class="param-label">Slump test</div><div class="opts sg" id="t_slump"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo">Pos.</div></div></div>
      <div class="param-row"><div class="param-label">FABER (articulação sacroilíaca)</div><div class="opts sg" id="t_faber"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo — dor SI">Pos.</div></div></div>
    </div>
    <div style="margin-top:12px"><div class="gl">Notas / Conclusão</div><textarea id="notas" placeholder="Ex: radiculopatia L5 direita, lombalgia mecânica inespecífica, espondiloartrose L4-L5..."></textarea></div>
  </div>
</div>
<div id="toast">✓ Copiado — cole na consulta (Ctrl+V)</div>
<div class="bar-acoes"><button class="btn-pdf" id="btnPdf">Imprimir / PDF</button><button class="btn-copy" id="btnCopy">Copiar resumo para consulta</button></div>
<script>
${_mskJs}
window._gerarResumo = function(){
  var g=window._getOpt,m=window._getMulti,v=window._getVal,e=window._evaRow;
  var L=['── COLUNA LOMBAR — EXAME OBJECTIVO ──'];
  var lp=g('local_pred'); if(lp) L.push('Localização: '+lp);
  var evStr=[e('eva_rep')?'repouso '+e('eva_rep'):'',e('eva_act')?'actividade '+e('eva_act'):'',e('eva_pic')?'pico '+e('eva_pic'):''].filter(Boolean).join(' | ');
  if(evStr) L.push('EVA: '+evStr);
  var td=g('tipo_dor'); if(td) L.push('Dor: '+td);
  var ir=m('irrad'); if(ir.length) L.push('Irradiação: '+ir.join(', '));
  var sn=m('sint_neuro'); if(sn.length) L.push('Sint. neurológicos: '+sn.join(', '));
  var rf=(typeof window.getRF==='function'?window.getRF():[]).filter(function(x){return x;}); if(rf.length){L.push('');L.push('RED FLAGS: '+rf.join(', '));}
  L.push('');L.push('Inspeção/Palpação:');
  [['Coluna sagital',m('insp_sag').join(', ')],['Escoliose',g('insp_escol')],['Postura antálgica',g('insp_antal')],['Espinhosas',g('palp_esp')],['Paravertebral',g('palp_par')],['Sacroilíacas',g('palp_si')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
  L.push('');L.push('Mobilidade:');
  [['Flexão — Schober',g('mob_flex')],['Extensão',g('mob_ext')],['Inclinação D',g('mob_incd')],['Inclinação E',g('mob_ince')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
  L.push('');L.push('Força (miotomos):');
  [['L2 (flex. anca)',g('f_l2')],['L3 (ext. joelho)',g('f_l3')],['L4 (dorsiflexão)',g('f_l4')],['L5 (ext. hálux)',g('f_l5')],['S1 (flex. plantar)',g('f_s1')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
  L.push('');L.push('Sensibilidade (dermátomos):');
  [['L3',g('s_l3')],['L4',g('s_l4')],['L5',g('s_l5')],['S1',g('s_s1')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
  L.push('');L.push('Marcha:');
  [['Pontas (S1)',g('marcha_pont')],['Calcanhares (L4-L5)',g('marcha_calc')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
  L.push('');L.push('Testes:');
  [['Lasègue D',g('t_las_d')],['Lasègue E',g('t_las_e')],['Slump',g('t_slump')],['FABER',g('t_faber')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
  var n=v('notas'); if(n){L.push('');L.push('Conclusão: '+n);}
  L.push('');L.push('──────────────────────────────────────────────────');
  return L.join('\\n');
};
</script></body></html>`);
      return;
    }

    /* ══════════════════════════════════════════════════════════════
       ATLETA
    ══════════════════════════════════════════════════════════════ */
    if (formId === "atleta") {
      _abrirBlob(`<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8">
<title>Avalia\u00e7\u00e3o do Atleta</title><style>${_mskCss}
.sec-atleta{background:#f0f9ff;border-color:#bae6fd;}
.num-atl{background:#0284c7!important;}
.sec-reds{border-color:#fecaca;}
.num-red{background:#dc2626!important;}
</style></head><body>
<div class="page">
  <h1>Avalia\u00e7\u00e3o do Atleta</h1>
  <div class="subtitle">Screening m\u00fasculo-esquel\u00e9tico completo \u2022 Preencher em 3\u20135 min</div>

  <!-- PERFIL DESPORTIVO -->
  <div class="sec sec-atleta">
    <div class="sec-title"><div class="num num-atl">1</div>Perfil Desportivo</div>
    <div class="cols2">
      <div><div class="gl">Tipo de desporto</div><input type="text" id="at_desp" placeholder="ex: futebol, corrida, ciclismo..."></div>
      <div><div class="gl">N\u00edvel competitivo</div><div class="opts sg" id="at_nivel"><div class="opt" data-v="Recreativo">Recreativo</div><div class="opt" data-v="Amador federado">Amador fed.</div><div class="opt" data-v="Semi-profissional">Semi-prof.</div><div class="opt" data-v="Profissional">Profissional</div></div></div>
    </div>
    <div class="cols2" style="margin-top:10px;">
      <div><div class="gl">Treinos / semana</div><input type="number" id="at_trn" min="0" max="21" placeholder="n\u00ba"></div>
      <div><div class="gl">Horas de treino / semana</div><input type="number" id="at_hrs" min="0" max="60" placeholder="h"></div>
    </div>
    <div class="cols2" style="margin-top:10px;">
      <div><div class="gl">Altera\u00e7\u00e3o recente de carga</div><div class="opts sg" id="at_carga"><div class="opt" data-v="N\u00e3o">N\u00e3o</div><div class="opt" data-v="Aumento de carga">Aumento</div><div class="opt" data-v="Redu\u00e7\u00e3o de carga">Redu\u00e7\u00e3o</div></div></div>
      <div><div class="gl">Altera\u00e7\u00e3o equipamento / sapatilhas</div><div class="opts sg" id="at_equip"><div class="opt" data-v="N\u00e3o">N\u00e3o</div><div class="opt" data-v="Sim">Sim</div></div></div>
    </div>
    <div class="cols2" style="margin-top:10px;">
      <div><div class="gl">Ortóteses / ligaduras</div><div class="opts mg" id="at_orteses"><div class="opt" data-v="N\u00e3o usa">N\u00e3o usa</div><div class="opt" data-v="Ort\u00f3teses">Ort\u00f3teses</div><div class="opt" data-v="Ligaduras funcionais">Ligaduras</div></div></div>
      <div><div class="gl">Cirurgia ME pr\u00e9via</div><div class="opts sg" id="at_cir"><div class="opt" data-v="N\u00e3o">N\u00e3o</div><div class="opt" data-v="Sim">Sim</div></div></div>
    </div>
    <div style="margin-top:10px"><div class="gl">Bike fit (ciclismo)</div><div class="opts sg" id="at_bfit"><div class="opt" data-v="N/A">N/A</div><div class="opt" data-v="Realizado">Realizado</div><div class="opt" data-v="N\u00e3o realizado">N\u00e3o realizado</div></div></div>
    <div style="margin-top:10px"><div class="gl">Les\u00f5es pr\u00e9vias relevantes</div><textarea id="at_les" placeholder="Localiza\u00e7\u00e3o e tipo..."></textarea></div>
  </div>

  <!-- QUEIXA ACTUAL -->
  <div class="sec">
    <div class="sec-title"><div class="num">2</div>Queixa Actual</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Dor actual</div><div class="opts sg" id="at_dor"><div class="opt" data-v="N\u00e3o">N\u00e3o</div><div class="opt" data-v="Sim">Sim</div></div></div>
      <div class="param-row"><div class="param-label">Les\u00e3o \u00faltimos 12 meses</div><div class="opts sg" id="at_les12"><div class="opt" data-v="N\u00e3o">N\u00e3o</div><div class="opt" data-v="Sim">Sim</div></div></div>
      <div class="param-row"><div class="param-label">Falhou treinos / competi\u00e7\u00e3o</div><div class="opts sg" id="at_falhou"><div class="opt" data-v="N\u00e3o">N\u00e3o</div><div class="opt" data-v="Sim">Sim</div></div></div>
      <div class="param-row"><div class="param-label">Localiza\u00e7\u00e3o da dor</div><div style="flex:1;"><input type="text" id="at_local" placeholder="ex: joelho D, aq\u00fales E..."></div></div>
    </div>
  </div>

  <!-- RED-S -->
  <div class="sec sec-reds">
    <div class="sec-title" style="color:#dc2626;border-color:#fecaca;"><div class="num num-red">!</div>RED-S \u2014 Relative Energy Deficiency in Sport</div>
    <div id="reds_warn" class="rf-warn">\u26a0\ufe0f RED-S suspeito \u2014 avaliar nutri\u00e7\u00e3o desportiva</div>
    <div class="param-grid">
      <div class="rf-row"><input type="checkbox" class="rf-cb" data-rf="Perda de peso inexplicada" id="reds1"><label class="rf-lbl" for="reds1">Perda de peso inexplicada</label><span class="rf-tip" data-tip="D\u00e9fice energ\u00e9tico cr\u00f3nico">i</span></div>
      <div class="rf-row"><input type="checkbox" class="rf-cb" data-rf="Fadiga persistente" id="reds2"><label class="rf-lbl" for="reds2">Fadiga persistente</label></div>
      <div class="rf-row"><input type="checkbox" class="rf-cb" data-rf="Diminui\u00e7\u00e3o do rendimento" id="reds3"><label class="rf-lbl" for="reds3">Diminui\u00e7\u00e3o do rendimento</label></div>
      <div class="rf-row"><input type="checkbox" class="rf-cb" data-rf="Les\u00f5es de repeti\u00e7\u00e3o" id="reds4"><label class="rf-lbl" for="reds4">Les\u00f5es de repeti\u00e7\u00e3o</label></div>
      <div class="rf-row"><input type="checkbox" class="rf-cb" data-rf="Fracturas de stress" id="reds5"><label class="rf-lbl" for="reds5">Fracturas de stress</label><span class="rf-tip" data-tip="Baixa DMO">i</span></div>
      <div class="rf-row"><input type="checkbox" class="rf-cb" data-rf="Altera\u00e7\u00f5es menstruais" id="reds6"><label class="rf-lbl" for="reds6">Altera\u00e7\u00f5es menstruais</label><span class="rf-tip" data-tip="Tr\u00edade da atleta feminina">i</span></div>
      <div class="rf-row"><input type="checkbox" class="rf-cb" data-rf="Baixa densidade mineral \u00f3ssea" id="reds7"><label class="rf-lbl" for="reds7">Baixa DMO</label></div>
      <div class="rf-row"><input type="checkbox" class="rf-cb" data-rf="Infec\u00e7\u00f5es frequentes" id="reds8"><label class="rf-lbl" for="reds8">Infec\u00e7\u00f5es frequentes</label></div>
    </div>
  </div>

  <!-- INSPECÇÃO POSTURAL -->
  <div class="sec">
    <div class="sec-title"><div class="num">3</div>Inspe\u00e7\u00e3o Postural</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Coluna</div><div class="opts mg" id="post_col"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Hipercifose">Hipercifose</div><div class="opt" data-v="Hiperlordose">Hiperlordose</div><div class="opt" data-v="Escoliose">Escoliose</div></div></div>
      <div class="param-row"><div class="param-label">Ombros</div><div class="opts mg" id="post_ombros"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Anteriorizados">Anteriorizados</div><div class="opt" data-v="Rot. int. \u2191">Rot. int. \u2191</div><div class="opt" data-v="Assimetria escapular">Assimetria</div><div class="opt" data-v="Esc\u00e1pula alada">Alada</div></div></div>
      <div class="param-row"><div class="param-label">Bacia</div><div class="opts mg" id="post_bac"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Obliquidade p\u00e9lvica">Obliquidade</div></div></div>
      <div class="param-row"><div class="param-label">Joelhos</div><div class="opts mg" id="post_joe"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Genu valgum">Valgum</div><div class="opt" data-v="Genu varum">Varum</div><div class="opt" data-v="Recurvatum">Recurvatum</div></div></div>
      <div class="param-row"><div class="param-label">P\u00e9</div><div class="opts mg" id="post_pe"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="P\u00e9 plano">Plano</div><div class="opt" data-v="P\u00e9 cavo">Cavo</div><div class="opt" data-v="Prona\u00e7\u00e3o \u2191">Prona\u00e7\u00e3o \u2191</div><div class="opt" data-v="Supina\u00e7\u00e3o \u2191">Supina\u00e7\u00e3o \u2191</div></div></div>
    </div>
  </div>

  <!-- MARCHA E MOBILIDADE GLOBAL -->
  <div class="sec">
    <div class="sec-title"><div class="num">4</div>Marcha &amp; Mobilidade Global</div>
    <div class="sub-title">Marcha</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Padr\u00e3o</div><div class="opts sg" id="mar_pad"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Assimetria">Assimetria</div><div class="opt" data-v="Claudica\u00e7\u00e3o">Claudica\u00e7\u00e3o</div><div class="opt" data-v="Rigidez lombar / p\u00e9lvica">Rigidez</div></div></div>
      <div class="param-row"><div class="param-label">Rota\u00e7\u00e3o p\u00e9s</div><div class="opts sg" id="mar_rot"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="In-toeing">In-toeing</div><div class="opt" data-v="Out-toeing">Out-toeing</div></div></div>
      <div class="param-row"><div class="param-label">Prona\u00e7\u00e3o / Supina\u00e7\u00e3o</div><div class="opts sg" id="mar_pron"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Hiperpronação D">Hiperpron. D</div><div class="opt" data-v="Hiperpronação E">Hiperpron. E</div><div class="opt" data-v="Bilateral">Bilateral</div></div></div>
      <div class="param-row"><div class="param-label">Pontas (S1)</div><div class="opts sg" id="mar_pont"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Dificuldade">Dificuldade</div><div class="opt" data-v="Incapaz">Incapaz</div></div></div>
      <div class="param-row"><div class="param-label">Calcanhares (L4\u2013L5)</div><div class="opts sg" id="mar_calc"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Dificuldade">Dificuldade</div><div class="opt" data-v="Incapaz">Incapaz</div></div></div>
    </div>
    <div class="sub-title">Mobilidade Global</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Eleva\u00e7\u00e3o bilateral ombros</div><div class="opts sg" id="mob_ombros"><div class="opt" data-v="Sim\u00e9trica e completa">Sim\u00e9trica</div><div class="opt" data-v="Assimetria">Assimetria</div><div class="opt" data-v="Compensa\u00e7\u00e3o lombar">Compensa\u00e7\u00e3o</div></div></div>
      <div class="param-row"><div class="param-label">Flex\u00e3o ant. (isquiotibiais)</div><div class="opts sg" id="mob_flex_ant"><div class="opt" data-v="Alcança o chão">Alcança chão</div><div class="opt" data-v="Encurtamento ligeiro">Encurt. ligeiro</div><div class="opt" data-v="Encurtamento moderado">Encurt. moderado</div></div></div>
      <div class="param-row"><div class="param-label">RI anca</div><div class="opts sg" id="mob_ri_anca"><div class="opt" data-v="Normal bilateral">Normal</div><div class="opt" data-v="Limitada D">Limitada D</div><div class="opt" data-v="Limitada E">Limitada E</div><div class="opt" data-v="Bilateral limitada">Bilateral</div></div></div>
      <div class="param-row"><div class="param-label">Dorsiflexão tornozelo</div><div class="opts sg" id="mob_dors"><div class="opt" data-v="Normal bilateral">Normal</div><div class="opt" data-v="Limitada D">Limitada D</div><div class="opt" data-v="Limitada E">Limitada E</div><div class="opt" data-v="Bilateral limitada">Bilateral</div></div></div>
    </div>
  </div>

  <!-- FORÇA FUNCIONAL -->
  <div class="sec">
    <div class="sec-title"><div class="num">5</div>For\u00e7a Funcional</div>
    <div class="sub-title">Agachamento bilateral</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Alinhamento joelhos</div><div class="opts sg" id="sq_joe"><div class="opt" data-v="Alinhado">Alinhado</div><div class="opt" data-v="Valgismo din\u00e2mico">Valgismo</div><div class="opt" data-v="Varismo din\u00e2mico">Varismo</div></div></div>
      <div class="param-row"><div class="param-label">Controlo p\u00e9lvico</div><div class="opts sg" id="sq_pelv"><div class="opt" data-v="Mantido">Mantido</div><div class="opt" data-v="Obliquidade">Obliquidade</div></div></div>
      <div class="param-row"><div class="param-label">Inclina\u00e7\u00e3o tronco</div><div class="opts sg" id="sq_tronco"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Excessiva (mobilidade tornozelo?)">Excessiva</div></div></div>
    </div>
    <div class="sub-title">Agachamento monopodal</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Controlo neuromuscular</div><div class="opts sg" id="sq_mono"><div class="opt" data-v="Bom">Bom</div><div class="opt" data-v="Valgismo din\u00e2mico \u2014 risco LCA">Valgismo</div><div class="opt" data-v="Trendelenburg \u2014 gl\u00fateo m\u00e9dio">Trendelenburg</div><div class="opt" data-v="Inst\u00e1vel">Inst\u00e1vel</div></div></div>
    </div>
    <div class="sub-title">Equil\u00edbrio monopodal</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Equil\u00edbrio D</div><div class="opts sg" id="eq_d"><div class="opt" data-v="Est\u00e1vel (&gt;10s)">Est\u00e1vel</div><div class="opt" data-v="Inst\u00e1vel (&lt;10s)">Inst\u00e1vel</div></div></div>
      <div class="param-row"><div class="param-label">Equil\u00edbrio E</div><div class="opts sg" id="eq_e"><div class="opt" data-v="Est\u00e1vel (&gt;10s)">Est\u00e1vel</div><div class="opt" data-v="Inst\u00e1vel (&lt;10s)">Inst\u00e1vel</div></div></div>
    </div>
    <div class="sub-title">Ponte gl\u00fateia</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Activa\u00e7\u00e3o gl\u00fateo</div><div class="opts sg" id="ponte"><div class="opt" data-v="Boa bilateral">Boa</div><div class="opt" data-v="D\u00e9fice D">D\u00e9fice D</div><div class="opt" data-v="D\u00e9fice E">D\u00e9fice E</div><div class="opt" data-v="D\u00e9fice bilateral">Bilateral</div></div></div>
    </div>
  </div>

  <!-- SCREENING NEUROLÓGICO -->
  <div class="sec">
    <div class="sec-title"><div class="num">6</div>Screening Neurol\u00f3gico R\u00e1pido</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Dorsiflexão p\u00e9 (L4)</div><div class="opts sg" id="neu_dors"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="D\u00e9fice D">D\u00e9fice D</div><div class="opt" data-v="D\u00e9fice E">D\u00e9fice E</div></div></div>
      <div class="param-row"><div class="param-label">Extens\u00e3o joelho (L3)</div><div class="opts sg" id="neu_joe"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="D\u00e9fice D">D\u00e9fice D</div><div class="opt" data-v="D\u00e9fice E">D\u00e9fice E</div></div></div>
      <div class="param-row"><div class="param-label">Eleva\u00e7\u00e3o bra\u00e7o (C5)</div><div class="opts sg" id="neu_braco"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="D\u00e9fice D">D\u00e9fice D</div><div class="opt" data-v="D\u00e9fice E">D\u00e9fice E</div></div></div>
      <div class="param-row"><div class="param-label">Sensibilidade membro inferior</div><div class="opts sg" id="neu_sens"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Alterada D">Alterada D</div><div class="opt" data-v="Alterada E">Alterada E</div></div></div>
    </div>
  </div>

  <!-- EQUIPAMENTO -->
  <div class="sec">
    <div class="sec-title"><div class="num">7</div>Equipamento</div>
    <div class="param-grid">
      <div class="param-row"><div class="param-label">Sapatilhas</div><div style="flex:1;"><input type="text" id="eq_sap" placeholder="Marca e modelo..."></div></div>
      <div class="param-row"><div class="param-label">Idade sapatilhas</div><div class="opts sg" id="eq_idade"><div class="opt" data-v="&lt;3 meses">&lt;3m</div><div class="opt" data-v="3\u20136 meses">3\u20136m</div><div class="opt" data-v="6\u201312 meses">6\u201312m</div><div class="opt" data-v="&gt;12 meses">&gt;12m</div></div></div>
      <div class="param-row"><div class="param-label">Palmilhas</div><div class="opts sg" id="eq_palm"><div class="opt" data-v="N\u00e3o usa">N\u00e3o</div><div class="opt" data-v="De s\u00e9rie">S\u00e9rie</div><div class="opt" data-v="Ortop\u00e9dicas personalizadas">Ortop\u00e9dicas</div></div></div>
    </div>
  </div>

  <!-- CONCLUSÃO -->
  <div class="sec">
    <div class="sec-title"><div class="num">8</div>Conclusão &amp; Plano</div>
    <div><div class="gl">Principais achados</div><textarea id="at_achados" placeholder="Resumo dos achados..." style="min-height:55px;"></textarea></div>
    <div style="margin-top:10px"><div class="gl">Plano / Recomenda\u00e7\u00f5es</div><textarea id="at_plano" placeholder="Recomenda\u00e7\u00f5es, objectivos, reencaminhamentos..." style="min-height:55px;"></textarea></div>
  </div>
</div>
<div id="toast">\u2713 Copiado \u2014 cole na consulta (Ctrl+V)</div>
<div class="bar-acoes"><button class="btn-pdf" id="btnPdf">Imprimir / PDF</button><button class="btn-copy" id="btnCopy">Copiar resumo para consulta</button></div>
<script>
${_mskJs}
window._gerarResumo = function(){
  var g=window._getOpt,m=window._getMulti,v=window._getVal;
  var L=['\u2500\u2500 ATLETA \u2014 AVALIA\u00c7\u00c3O \u2500\u2500'];
  var desp=v('at_desp'); if(desp) L.push('Desporto: '+desp);
  var niv=g('at_nivel'); if(niv) L.push('N\u00edvel: '+niv);
  var trn=v('at_trn'),hrs=v('at_hrs');
  if(trn||hrs) L.push('Carga: '+(trn?trn+'x/sem ':'' )+(hrs?hrs+'h/sem':''));
  var les=v('at_les'); if(les) L.push('Les\u00f5es pr\u00e9vias: '+les);
  var carga=g('at_carga'); if(carga&&carga!=='N\u00e3o') L.push('Altera\u00e7\u00e3o carga: '+carga);
  var equip=g('at_equip'); if(equip==='Sim') L.push('Altera\u00e7\u00e3o equipamento: Sim');
  var bfit=g('at_bfit'); if(bfit&&bfit!=='N/A') L.push('Bike fit: '+bfit);
  L.push('');
  var dor=g('at_dor'); if(dor) L.push('Dor actual: '+dor);
  var loc=v('at_local'); if(loc) L.push('Localiza\u00e7\u00e3o: '+loc);
  var les12=g('at_les12'); if(les12==='Sim') L.push('Les\u00e3o 12m: Sim');
  var fal=g('at_falhou'); if(fal==='Sim') L.push('Falhou treinos: Sim');
  var reds=(typeof window.getRF==='function'?window.getRF():[]).filter(function(x){return x;}); if(reds.length){L.push('');L.push('RED-S (alerta): '+reds.join(', '));}
  L.push('');L.push('Postura:');
  [['Coluna',m('post_col').join(', ')],['Ombros',m('post_ombros').join(', ')],['Bacia',m('post_bac').join(', ')],['Joelhos',m('post_joe').join(', ')],['P\u00e9',m('post_pe').join(', ')]].forEach(function(p){if(p[1]&&p[1].indexOf('Normal')<0)L.push('  \u2022 '+p[0]+': '+p[1]);});
  L.push('');L.push('Marcha / Mobilidade:');
  [['Marcha',g('mar_pad')],['Rota\u00e7\u00e3o p\u00e9s',g('mar_rot')],['Prona\u00e7\u00e3o',g('mar_pron')],['Pontas S1',g('mar_pont')],['Calcanhares L4-L5',g('mar_calc')],['Eleva\u00e7\u00e3o ombros',g('mob_ombros')],['Flex. anterior',g('mob_flex_ant')],['RI anca',g('mob_ri_anca')],['Dorsiflexão',g('mob_dors')]].forEach(function(p){if(p[1])L.push('  \u2022 '+p[0]+': '+p[1]);});
  L.push('');L.push('For\u00e7a funcional:');
  [['Agach. bilateral \u2014 joelhos',g('sq_joe')],['Agach. bilateral \u2014 pelvis',g('sq_pelv')],['Agach. bilateral \u2014 tronco',g('sq_tronco')],['Agach. monopodal',g('sq_mono')],['Equil\u00edbrio D',g('eq_d')],['Equil\u00edbrio E',g('eq_e')],['Ponte gl\u00fateia',g('ponte')]].forEach(function(p){if(p[1])L.push('  \u2022 '+p[0]+': '+p[1]);});
  L.push('');L.push('Screening neurol\u00f3gico:');
  [['Dorsiflexão L4',g('neu_dors')],['Extens\u00e3o joelho L3',g('neu_joe')],['Eleva\u00e7\u00e3o bra\u00e7o C5',g('neu_braco')],['Sensibilidade',g('neu_sens')]].forEach(function(p){if(p[1])L.push('  \u2022 '+p[0]+': '+p[1]);});
  var sap=v('eq_sap'),idSap=g('eq_idade'),palm=g('eq_palm');
  if(sap||palm){L.push('');if(sap)L.push('Sapatilhas: '+sap+(idSap?' ('+idSap+')':''));if(palm)L.push('Palmilhas: '+palm);}
  var ach=v('at_achados'),pla=v('at_plano');
  if(ach){L.push('');L.push('Achados: '+ach);}
  if(pla){L.push('Plano: '+pla);}
  L.push('');L.push('\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  return L.join('\\n');
};
</script></body></html>`);
      return;
    }

    alert("Formulário em desenvolvimento.");
  }


  function openReportsMenu(anchorBtn) {
    // Remove menu anterior se existir
    document.getElementById("gcReportsMenu")?.remove();

    const menu = document.createElement("div");
    menu.id = "gcReportsMenu";
    Object.assign(menu.style, {
      position: "fixed",
      zIndex: "3000",
      background: "#fff",
      border: "1px solid #e2e8f0",
      borderRadius: "12px",
      boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
      padding: "8px 0",
      minWidth: "260px",
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif"
    });

    const rect = anchorBtn.getBoundingClientRect();
    menu.style.top  = (rect.bottom + 6) + "px";
    menu.style.left = rect.left + "px";

    const groups = [
      {
        label: "PRP — Reembolso",
        items: [
          { id: "prp_tendinopatia", label: "🩹 Tendinopatia" },
          { id: "prp_osteoartrose", label: "🦴 Osteoartrose" },
          { id: "prp_rotura",       label: "💪 Rotura Muscular" }
        ]
      },
      {
        label: "Relatório Neurologia",
        items: [
          { id: "relatorio_neurologico", label: "🧠 Exame Neurológico" },
          { id: "paresia_facial",        label: "😐 Paresia Facial Periférica (em breve)" }
        ]
      },
      {
        label: "Atestados",
        items: [
          { id: "atestado_ef",      label: "🏫 Dispensa Educação Física" },
          { id: "atestado_doenca",  label: "🏥 Atestado de Doença" }
        ]
      }
    ];

    groups.forEach((grp, gi) => {
      if (gi > 0) {
        const sep = document.createElement("div");
        Object.assign(sep.style, { height: "1px", background: "#f1f5f9", margin: "6px 0" });
        menu.appendChild(sep);
      }

      const lbl = document.createElement("div");
      lbl.textContent = grp.label;
      Object.assign(lbl.style, {
        padding: "4px 16px 2px",
        fontSize: "11px",
        fontWeight: "700",
        color: "#94a3b8",
        textTransform: "uppercase",
        letterSpacing: "0.05em"
      });
      menu.appendChild(lbl);

      grp.items.forEach(item => {
        const btn = document.createElement("button");
        btn.textContent = item.label;
        Object.assign(btn.style, {
          display: "block",
          width: "100%",
          textAlign: "left",
          background: "none",
          border: "none",
          padding: "9px 20px",
          fontSize: "14px",
          color: "#0f172a",
          cursor: "pointer",
          fontFamily: "inherit"
        });
        if (item.label.includes("em breve")) {
          btn.style.color = "#94a3b8";
          btn.style.cursor = "default";
          btn.style.opacity = "0.6";
        } else {
          btn.onmouseenter = () => btn.style.background = "#f1f5f9";
          btn.onmouseleave = () => btn.style.background = "none";
          btn.addEventListener("click", () => {
            menu.remove();
            openReportTemplate(item.id);
          });
        }
        menu.appendChild(btn);
      });
    });

    document.body.appendChild(menu);

    // Fechar ao clicar fora
    setTimeout(() => {
      const close = (ev) => {
        if (!menu.contains(ev.target) && ev.target !== anchorBtn) {
          menu.remove();
          document.removeEventListener("click", close);
        }
      };
      document.addEventListener("click", close);
    }, 50);
  }

  async function openReportTemplate(templateId) {
    try {
      const clinic      = await fetchClinicForPdf();
      const locality    = String(clinic?.city || "").trim();
      const todayPt     = new Date().toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-");
      const localityDate = [locality, todayPt].filter(Boolean).join(", ");

      const name    = escAttr(String(p?.full_name || "").trim() || "—");
      const sns     = escAttr(String(p?.sns || "").trim());
      const nif     = escAttr(String(p?.nif || "").trim());
      const dobPt   = p?.dob ? escAttr(fmtDobPt(p.dob)) : "";

      const lineParts = [];
      if (sns)   lineParts.push(`<b>Nº Utente:</b> ${sns}`);
      if (dobPt) lineParts.push(`<b>DN:</b> ${dobPt}`);
      if (nif)   lineParts.push(`<b>NIF:</b> ${nif}`);
      const patientLine2 = lineParts.join("&nbsp;&nbsp;&nbsp;");

      const websiteHtml  = escAttr(clinic?.website || "www.JoaoMorais.pt");
      const phoneHtml    = escAttr(clinic?.phone || "");

      let vinhetaUrl = "";
      try {
        const u = await storageSignedUrl(VINHETA_BUCKET, VINHETA_PATH, 3600);
        if (u) vinhetaUrl = await urlToDataUrl(u, "image/png");
      } catch (_) {}

      const vinhetaTag = vinhetaUrl
        ? `<img style="width:4cm;height:2.5cm;object-fit:contain;display:block;margin-top:8px;" src="${vinhetaUrl}" />`
        : "";

      const sharedStyles = `
        body { margin:0; background:#fff; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif; color:#111; font-size:14px; line-height:1.5; }
        * { box-sizing:border-box; }
        @page { size:A4; margin:16mm; }
        .a4 { width:210mm; background:#fff; }
        .top { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
        .topLeft { font-size:13.5px; line-height:1.4; }
        .hr { height:1px; background:#111; margin:10px 0 14px 0; }
        .title { text-align:center; font-weight:900; font-size:20px; margin:2px 0 12px 0; }
        .row { margin-top:6px; font-size:13.5px; }
        .section { margin-top:18px; }
        .stitle { font-weight:900; font-size:15px; margin-bottom:6px; }
        .field { background:#f8fafc; border:1.5px dashed #94a3b8; border-radius:6px; padding:6px 10px; margin:6px 0; color:#1e40af; font-style:italic; display:inline-block; min-width:180px; }
        .footerBlock { margin-top:28px; }
        .hr2 { height:1px; background:#111; margin:16px 0 10px 0; }
        .footRow { display:flex; justify-content:space-between; align-items:flex-start; gap:10px; }
        .web { font-size:14px; font-weight:700; }
        .locDate { text-align:right; font-size:14px; margin-top:14px; }
        .sig { margin-top:40px; display:flex; justify-content:flex-end; }
        .sigBox { width:360px; text-align:center; }
        .sigLine { border-top:1px solid #111; padding-top:10px; }
        .sigName { font-weight:900; font-size:17px; margin-top:6px; }
        .sigRole { font-size:13px; margin-top:2px; }
      `;

      const header = `
        <div class="top">
          <div class="topLeft">
            <div>${websiteHtml}</div>
            <div>${phoneHtml}</div>
          </div>
        </div>
        <div class="hr"></div>
      `;

      const patientBlock = `
        <div class="row"><b>Nome:</b> ${name}</div>
        ${patientLine2 ? `<div class="row">${patientLine2}</div>` : ""}
        <div class="hr" style="margin-top:14px;opacity:0.5;"></div>
      `;

      const footer = `
        <div class="footerBlock">
          <div class="hr2"></div>
          <div class="footRow">
            <div>
              <div class="web">${websiteHtml}</div>
              ${vinhetaTag}
            </div>
            <div style="flex:1;">
              <div class="locDate">${escAttr(localityDate)}</div>
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
      `;

      let html = "";
      let title = "Relatório";

      if (templateId === "prp_tendinopatia") {
        // Mostrar modal de preenchimento antes de gerar o documento
        await openPrpTendinopatiaModal({ clinic, locality: escAttr(localityDate), vinhetaUrl, websiteHtml, phoneHtml, patientBlock, footer, sharedStyles });
        return; // openDocumentEditor é chamado dentro do modal
      }

            if (templateId === "prp_osteoartrose") {
        title = "PRP — Osteoartrose";
        html = `<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title>
        <style>${sharedStyles}
          .ref { font-size:12px; color:#475569; line-height:1.6; }
          .ref li { margin-bottom:4px; }
          .evid { background:#f0f9ff; border-left:3px solid #0ea5e9; padding:10px 14px; border-radius:0 6px 6px 0; margin:10px 0; font-size:13.5px; }
        </style></head><body><div class="a4">
          ${header}
          <div class="title">Relatório Médico — Pedido de Autorização de Reembolso</div>
          <div style="text-align:center;font-size:13px;color:#64748b;margin-bottom:12px;">
            Aplicação de Plasma Rico em Plaquetas (PRP) — Osteoartrose
          </div>
          ${patientBlock}

          <div class="section">
            <div class="stitle">Diagnóstico</div>
            <p>
              O/A doente apresenta <b>osteoartrose</b> de <span class="field">[localização — ex: joelho direito / anca esquerda / tornozelo / articulação acromioclavicular]</span>,
              grau <span class="field">[Kellgren-Lawrence I / II / III]</span>, confirmada por radiografia simples
              <span class="field">[e/ou RM — descrever achados: diminuição do espaço articular, esclerose subcondral, osteófitos]</span>.
            </p>
          </div>

          <div class="section">
            <div class="stitle">História Clínica</div>
            <p>
              Queixas com evolução de <span class="field">[duração]</span>, com dor articular
              de características mecânicas, rigidez matinal inferior a 30 minutos, e limitação funcional
              progressiva. Escala de dor EVA: <span class="field">[0–10]</span> em repouso e
              <span class="field">[0–10]</span> em actividade. Impacto nas actividades de vida diária:
              <span class="field">[descrever — ex: dificuldade na marcha, subir escadas, actividade desportiva]</span>.
            </p>
          </div>

          <div class="section">
            <div class="stitle">Tratamentos Conservadores Realizados (sem resposta adequada)</div>
            <ul style="margin:8px 0 0 18px;padding:0;">
              <li>Fisioterapia / reabilitação — <span class="field">[duração / número de sessões]</span></li>
              <li>AINEs e analgésicos — <span class="field">[duração]</span></li>
              <li>Infiltração de corticosteróide intra-articular — <span class="field">[número / datas]</span> <em>(se aplicável)</em></li>
              <li>Viscossuplementação com ácido hialurónico — <span class="field">[número de ciclos / datas]</span> <em>(se aplicável)</em></li>
              <li><span class="field">[outros tratamentos]</span></li>
            </ul>
          </div>

          <div class="section">
            <div class="stitle">Justificação Clínica e Evidência Científica para PRP</div>
            <p>
              Face à ausência de resposta satisfatória aos tratamentos conservadores optimizados,
              e tratando-se de osteoartrose em grau não cirúrgico (<span class="field">KL I–III</span>),
              propõe-se a aplicação de <b>Plasma Rico em Plaquetas (PRP)</b> intra-articular,
              terapêutica biológica autóloga com efeito condroprotector, anti-inflamatório e modulador
              do microambiente articular, actuando através de factores de crescimento (TGF-β, IGF-1,
              PDGF, FGF) que promovem a síntese de proteoglicanos e inibem a degradação da cartilagem.
            </p>
            <div class="evid">
              A evidência científica actual (2024–2025) demonstra que PRP — particularmente LP-PRP
              (leukocyte-poor) — é superior ao ácido hialurónico e aos corticosteróides na redução da
              dor e melhoria funcional em osteoartrose ligeira a moderada (KL I–III), com benefício
              sustentado aos 6 e 12 meses e perfil de segurança favorável.
            </div>
            <p style="margin-top:10px;font-size:13.5px;"><b>Referências bibliográficas de suporte:</b></p>
            <ol class="ref">
              <li>
                <b>Mende E et al.</b> — <em>Comprehensive Summary of Meta-Analyses on PRP Therapies for Knee Osteoarthritis.</em>
                Military Medicine, Oxford Academic. Nov/Dec 2024. — Revisão de 39 meta-análises e revisões sistemáticas:
                PRP reduziu significativamente dor (VAS e WOMAC) nos 12 meses de seguimento; LP-PRP recomendado para
                OA ligeira-moderada (KL 1–3); efeitos adversos minor e transitórios.
              </li>
              <li>
                <b>Hamid A et al.</b> — <em>Efficacy and Safety of PRP for Knee Osteoarthritis: Systematic Review and Meta-analysis of RCTs (2021–2024).</em>
                PubMed. 2025. — PRP demonstrou valor único e efeitos sinérgicos; eficácia máxima aos 3 meses,
                sustentada aos 12 meses; 3 ou mais injecções recomendadas em doença mais avançada.
              </li>
              <li>
                <b>Annals of Medicine & Surgery. 2024.</b> — <em>Comparative Effectiveness of Intra-articular Therapies in KOA: Meta-analysis.</em>
                PRP superior ao ácido hialurónico e corticosteróides em outcomes de dor e função a médio-longo prazo.
              </li>
              <li>
                <b>Du D, Liang Y. J Orthop Surg Res. 2025.</b> — <em>Meta-analysis: PRP+HA vs PRP alone in KOA (16 studies, 1384 doentes).</em>
                PRP com benefício significativo a longo prazo (6 e 12 meses) nos scores WOMAC e Lequesne vs. controlo.
              </li>
              <li>
                <b>ACR / Arthritis Foundation (desde 2019).</b> — Recomendam PRP para osteoartrose do joelho e anca,
                com base em evidência de outcomes sintomáticos positivos e excelente perfil de segurança autóloga.
              </li>
            </ol>
            <p style="margin-top:12px;">
              Está prevista a realização de <span class="field">[1 a 3]</span> infiltração(ões) intra-articular(es) de PRP,
              com intervalo de <span class="field">[4 semanas]</span> entre sessões,
              associadas a programa de reabilitação e controlo de peso.
            </p>
          </div>

          <div class="section">
            <div class="stitle">Conclusão</div>
            <p>
              Solicita-se autorização de reembolso da aplicação de Plasma Rico em Plaquetas (PRP)
              intra-articular em <span class="field">[localização]</span> — osteoartrose grau
              <span class="field">KL [I/II/III]</span> — em doente sem resposta ao tratamento
              conservador optimizado, com evidência científica de nível I (meta-análises de RCTs,
              2024–2025), excelente perfil de segurança e ausência de contraindicações cirúrgicas
              neste estadio.
            </p>
          </div>

          ${footer}
        </div></body></html>`;
      }

      if (templateId === "prp_rotura") {
        title = "PRP — Rotura Muscular";
        html = `<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title>
        <style>${sharedStyles}
          .ref { font-size:12px; color:#475569; line-height:1.6; }
          .ref li { margin-bottom:4px; }
          .evid { background:#f0f9ff; border-left:3px solid #0ea5e9; padding:10px 14px; border-radius:0 6px 6px 0; margin:10px 0; font-size:13.5px; }
        </style></head><body><div class="a4">
          ${header}
          <div class="title">Relatório Médico — Pedido de Autorização de Reembolso</div>
          <div style="text-align:center;font-size:13px;color:#64748b;margin-bottom:12px;">
            Aplicação de Plasma Rico em Plaquetas (PRP) — Rotura Muscular
          </div>
          ${patientBlock}

          <div class="section">
            <div class="stitle">Diagnóstico</div>
            <p>
              O/A doente apresenta <b>rotura muscular</b>
              <span class="field">[grau I / II / III parcial]</span> do
              <span class="field">[músculo / grupo muscular — ex: isquiotibiais / gémeos / quadricípite / adutores / recto abdominal]</span>,
              <span class="field">[lado direito / esquerdo]</span>, confirmada por ecografia
              <span class="field">[e/ou RM — descrever: extensão da lesão, localização, presença de hematoma]</span>.
            </p>
          </div>

          <div class="section">
            <div class="stitle">História Clínica</div>
            <p>
              Lesão ocorrida em <span class="field">[data ou há X dias/semanas]</span>,
              durante <span class="field">[actividade — ex: corrida / salto / contracção excêntrica brusca]</span>.
              Dor súbita localizada a <span class="field">[localização anatómica]</span>,
              com <span class="field">[equimose / hematoma / impotência funcional parcial / total]</span>.
              EVA: <span class="field">[0–10]</span> em repouso e <span class="field">[0–10]</span> em actividade.
            </p>
            <p>
              <span class="field">[Atleta de competição — descrever modalidade e nível competitivo, se aplicável.]</span>
              Objetivo de retorno à actividade: <span class="field">[prazo pretendido]</span>.
            </p>
          </div>

          <div class="section">
            <div class="stitle">Tratamento Conservador Realizado</div>
            <ul style="margin:8px 0 0 18px;padding:0;">
              <li>Protocolo RICE/POLICE na fase aguda</li>
              <li>Fisioterapia / reabilitação — <span class="field">[duração / número de sessões]</span></li>
              <li>AINEs — <span class="field">[duração limitada à fase aguda]</span></li>
              <li><span class="field">[outros tratamentos]</span></li>
            </ul>
          </div>

          <div class="section">
            <div class="stitle">Justificação Clínica e Evidência Científica para PRP</div>
            <p>
              Propõe-se a aplicação de <b>Plasma Rico em Plaquetas (PRP)</b> intra-lesional,
              guiada por ecografia, com o objectivo de acelerar a regeneração muscular e reduzir
              o risco de recidiva. O PRP actua através da libertação de factores de crescimento
              (IGF-1, TGF-β, PDGF, VEGF, HGF) que estimulam a proliferação de células satélite,
              miogénese, angiogénese e remodelação da matriz extracelular muscular.
            </p>
            <div class="evid">
              A evidência actual suporta o uso de PRP em roturas musculares de grau I–II e roturas
              parciais de grau III, com aceleração documentada do retorno à actividade desportiva,
              redução do tempo de recuperação e diminuição da taxa de recidiva em atletas.
            </div>
            <p style="margin-top:10px;font-size:13.5px;"><b>Referências bibliográficas de suporte:</b></p>
            <ol class="ref">
              <li>
                <b>Schneider N et al.</b> — <em>The Use of PRP and Stem Cell Injections in Musculoskeletal Injuries.</em>
                Cureus. 2024. — PRP associado a retorno mais rápido às actividades de vida diária e alívio
                mais duradouro em lesões musculares agudas e roturas de tecidos moles, sem efeitos adversos major.
              </li>
              <li>
                <b>O'Dowd A et al.</b> — <em>Update on PRP in Musculoskeletal Injuries: Systematic Review 2014–2021.</em>
                Am J Sports Med. 2022. — 32 RCTs incluídos; 6 estudos em lesões agudas de tecidos moles:
                PRP demonstrou benefício na aceleração da cicatrização e retorno ao desporto.
              </li>
              <li>
                <b>Pretorius et al.</b> — <em>Current Status and Advancements in PRP Therapy.</em>
                PMC / Cureus. 2023. — Evidência de nível I para lesões musculares;
                PRP e células estaminais associados a menor número de efeitos adversos vs. cirurgia,
                com retorno mais rápido ao desporto.
              </li>
              <li>
                <b>Rothrauff BB et al.</b> — <em>PRP in the Treatment of Musculoskeletal Disease in 2025 and Beyond.</em>
                Am J Sports Med. 2026. — Revisão actualizada dos mecanismos biológicos e aplicações clínicas:
                PRP promove proliferação de mioblastos (upregulation de ciclina A, CDK1, CDK2) e regeneração muscular.
              </li>
              <li>
                <b>Chalidis B et al.</b> — <em>Molecular and Biologic Effects of PRP in Ligament and Tendon Healing.</em>
                Int J Mol Sci. 2023. — Revisão sistemática dos mecanismos: PDGF, TGF-β, VEGF com papel central
                na remodelação tecidular, proliferação celular e controlo da inflamação pós-lesão.
              </li>
            </ol>
            <p style="margin-top:12px;">
              Está prevista a realização de <span class="field">[1 a 2]</span> aplicação(ões) de PRP intra-lesional,
              guiada por ecografia, nas primeiras <span class="field">[48–72 horas / 1 semana]</span> após a lesão
              <span class="field">[ou na fase sub-aguda]</span>, integrada em programa de reabilitação estruturado.
            </p>
          </div>

          <div class="section">
            <div class="stitle">Conclusão</div>
            <p>
              Solicita-se autorização de reembolso da aplicação de PRP em rotura muscular
              <span class="field">[grau I/II/III parcial]</span> do
              <span class="field">[músculo]</span>, em doente
              <span class="field">[atleta de competição / com necessidade de retorno rápido à actividade]</span>,
              com suporte em evidência científica actual, excelente perfil de segurança e
              ausência de contraindicações para terapêutica regenerativa autóloga.
            </p>
          </div>

          ${footer}
        </div></body></html>`;
      }

      if (templateId === "relatorio_neurologico") {
        openRelatorioNeurologicoModal({ patientBlock, footer, sharedStyles, vinhetaUrl, websiteHtml, phoneHtml, localityDate: escAttr(localityDate) });
        return;
      }

      if (templateId === "atestado_doenca") {
        openAtestadoDoencaModal({ locality: escAttr(localityDate), vinhetaUrl, websiteHtml, phoneHtml, footer, sharedStyles, name, sns, dobPt, nif });
        return;
      }

      if (html) {
        openDocumentEditor(html, title);
      }

    } catch (err) {
      console.error("openReportTemplate falhou:", err);
      alert("Erro ao abrir template de relatório.");
    }
  }


  /* ====================================================================
     ATESTADO DE DOENÇA — Modal de preenchimento
     ==================================================================== */
  function openAtestadoDoencaModal({ locality, vinhetaUrl, websiteHtml, phoneHtml, footer, sharedStyles, name, sns, dobPt, nif }) {
    document.getElementById("gcAtestadoModal")?.remove();

    const overlay = document.createElement("div");
    overlay.id = "gcAtestadoModal";
    Object.assign(overlay.style, {
      position: "fixed", inset: "0", background: "rgba(0,0,0,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "16px", zIndex: "3100",
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif"
    });

    // Datas por defeito: hoje e hoje+3
    const today = new Date();
    const todayIso = today.toISOString().slice(0,10);
    const ateD = new Date(today); ateD.setDate(ateD.getDate()+3);
    const ateIso = ateD.toISOString().slice(0,10);

    overlay.innerHTML = `
      <div style="background:#fff;width:min(640px,100%);max-height:92vh;overflow-y:auto;
                  border-radius:14px;border:1px solid #e2e8f0;padding:26px;">

        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">
          <div>
            <div style="font-weight:900;font-size:16px;color:#0f172a;">🏥 Atestado de Doença</div>
            <div style="font-size:12px;color:#64748b;margin-top:2px;">Preencha e gere o atestado</div>
          </div>
          <button id="gcAtClose" style="border:1px solid #e2e8f0;background:#fff;border-radius:8px;padding:6px 14px;cursor:pointer;font-size:13px;">✕</button>
        </div>

        <!-- Tratamento -->
        <div style="margin-bottom:14px;">
          <label style="font-weight:700;font-size:13px;display:block;margin-bottom:6px;">Tratamento</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${["Sra.","Sr.","Jovem","Menor","Menina","Menino"].map(t =>
              `<label style="display:flex;align-items:center;gap:5px;font-size:13px;cursor:pointer;padding:6px 12px;border:1px solid #e2e8f0;border-radius:8px;">
                <input type="radio" name="adTrat" value="${t}" ${t==="Menor"?"checked":""}> ${t}
              </label>`
            ).join("")}
          </div>
        </div>

        <!-- Diagnóstico -->
        <div style="margin-bottom:14px;">
          <label style="font-weight:700;font-size:13px;display:block;margin-bottom:4px;">Quadro clínico / Diagnóstico</label>
          <textarea id="adDiag" rows="3"
            placeholder="ex: quadro clínico agudo caracterizado por febre, tosse e prostração, compatível com síndrome gripal"
            style="width:100%;padding:9px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;resize:vertical;box-sizing:border-box;line-height:1.5;"></textarea>
        </div>

        <!-- Datas -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
          <div>
            <label style="font-weight:700;font-size:13px;display:block;margin-bottom:4px;">Dispensa a partir de</label>
            <input id="adDe" type="date" value="${todayIso}" style="width:100%;padding:9px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;box-sizing:border-box;" />
          </div>
          <div>
            <label style="font-weight:700;font-size:13px;display:block;margin-bottom:4px;">Até (inclusive)</label>
            <input id="adAte" type="date" value="${ateIso}" style="width:100%;padding:9px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;box-sizing:border-box;" />
          </div>
        </div>

        <!-- Motivos -->


        <div style="display:flex;justify-content:flex-end;gap:10px;">
          <button id="gcAtCancel" style="border:1px solid #e2e8f0;background:#fff;border-radius:8px;padding:9px 20px;cursor:pointer;font-size:13px;color:#475569;">Cancelar</button>
          <button id="gcAtGerar" style="border:none;background:#1a56db;color:#fff;border-radius:8px;padding:9px 22px;cursor:pointer;font-size:14px;font-weight:700;">Gerar Atestado</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    document.getElementById("gcAtClose").addEventListener("click", close);
    document.getElementById("gcAtCancel").addEventListener("click", close);
    overlay.addEventListener("click", (ev) => { if (ev.target === overlay) close(); });

    document.getElementById("gcAtGerar").addEventListener("click", () => {
      // Recolher valores
      const tratEl = overlay.querySelector('input[name="adTrat"]:checked');
      const trat   = tratEl ? tratEl.value : "Menor";
      const diag   = (document.getElementById("adDiag").value || "").trim()
                     || "quadro clínico agudo que condiciona incapacidade temporária";

      const fmtDate = (iso) => {
        if (!iso) return "__/__/____";
        const [y,m,d] = iso.split("-");
        return `${d}/${m}/${y}`;
      };
      const de  = fmtDate(document.getElementById("adDe").value);
      const ate = fmtDate(document.getElementById("adAte").value);



      // Linha de identificação do doente
      const idParts = [];
      if (sns)   idParts.push(`<b>N.º Utente:</b> ${sns}`);
      if (dobPt) idParts.push(`<b>DN:</b> ${dobPt}`);
      if (nif)   idParts.push(`<b>NIF:</b> ${nif}`);
      const idLine = idParts.join("&nbsp;&nbsp;");

      const vinhetaTag = vinhetaUrl
        ? `<img style="width:4cm;height:2.5cm;object-fit:contain;display:block;margin-top:8px;" src="${vinhetaUrl}" />`
        : "";

      // Identificação do doente: SNS preferido, senão NIF/CC, senão DN
      const idPecas = [];
      if (dobPt) idPecas.push(`nascido(a) em <b>${dobPt}</b>`);
      if (sns)   idPecas.push(`N.º de Utente <b>${sns}</b>`);
      else if (nif) idPecas.push(`NIF/CC <b>${nif}</b>`);
      const idDoente = idPecas.length ? ", " + idPecas.join(", ") : "";

      const title = "Atestado de Doença";
      const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title>
      <style>${sharedStyles}
        .doc-title{text-align:center;font-weight:900;font-size:17px;margin:4px 0 24px 0;letter-spacing:0.03em;text-transform:uppercase}
        .body-text{font-size:14px;line-height:1.9;text-align:justify;margin-bottom:16px}
      </style></head><body><div class="a4">

        <div class="top">
          <div class="topLeft"><div>${websiteHtml}</div><div>${phoneHtml}</div></div>
        </div>
        <div class="hr"></div>

        <div class="doc-title">Declaração Médica</div>

        <p class="body-text">
          Eu, <b>João Morais</b>, Médico licenciado pela Faculdade de Medicina da Universidade de Coimbra,
          Especialista em Medicina Física e de Reabilitação e Pós-graduado em Medicina Desportiva,
          com Cédula Profissional da Ordem dos Médicos n.º <b>44380</b>,
          atesto por minha honra que ${trat} <b>${name}</b>${idDoente}
          se encontra doente${diag ? ", apresentando " + diag : ""}, estando impedido(a) de frequentar a escola no período
          compreendido entre <b>${de}</b> e <b>${ate}</b> (inclusive).
        </p>

        <p class="body-text">
          Por ser verdade e me ter sido pedido, dato e assino o presente atestado.
        </p>

        <div class="footerBlock">
          <div class="hr2"></div>
          <div class="footRow">
            <div>
              <div class="web">${websiteHtml}</div>
              ${vinhetaTag}
            </div>
            <div style="flex:1;">
              <div class="locDate">${locality}</div>
              <div class="sig">
                <div class="sigBox">
                  <div class="sigLine"></div>
                  <div class="sigName">Dr. João Morais</div>
                  <div class="sigRole">Especialista em Medicina Física e de Reabilitação</div>
                  <div class="sigRole">OM n.º 44380</div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div></body></html>`;

      close();
      openDocumentEditor(html, title);
    });
  }


  /* ====================================================================
     RELATÓRIO NEUROLÓGICO — Modal com iframe
     ==================================================================== */
  function openRelatorioNeurologicoModal({ patientBlock, footer, sharedStyles, vinhetaUrl, websiteHtml, phoneHtml, localityDate }) {
    document.getElementById("gcNeuroModal")?.remove();

    // HTML do formulário embebido como Blob — não interfere com o router da SPA
    const htmlContent = `
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--font-sans);font-size:14px;color:var(--color-text-primary);background:transparent}
.page{max-width:920px;margin:0 auto;padding:16px}
h1{font-size:20px;font-weight:500;margin-bottom:3px}
.subtitle{font-size:12px;color:var(--color-text-secondary);margin-bottom:18px}
.sec{background:var(--color-background-primary);border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-lg);padding:16px 20px;margin-bottom:10px}
.sec-title{font-size:15px;font-weight:500;margin-bottom:14px;display:flex;align-items:center;gap:8px}
.num{width:22px;height:22px;background:#E1F5EE;color:#0F6E56;border-radius:50%;font-size:11px;font-weight:500;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.gl{font-size:11px;color:var(--color-text-secondary);margin-bottom:7px;font-weight:500;text-transform:uppercase;letter-spacing:.03em}
.rg,.cg{display:flex;flex-direction:column;gap:5px}
.ri,.ci{display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px}
.ri input,.ci input{width:14px;height:14px;accent-color:#1d9e75;cursor:pointer;flex-shrink:0}
textarea{width:100%;border:0.5px solid var(--color-border-secondary);border-radius:var(--border-radius-md);padding:9px 12px;font-size:13px;resize:vertical;min-height:72px;background:var(--color-background-secondary);color:var(--color-text-primary);font-family:var(--font-sans)}
.cols2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.cols3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px}
.cols4{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px}
.divider{height:0.5px;background:var(--color-border-tertiary);margin:12px 0}
.note{font-size:11px;color:var(--color-text-tertiary);font-style:italic;margin-top:4px}
.sub-title{font-size:13px;font-weight:500;color:var(--color-text-secondary);margin:14px 0 10px;padding-top:12px;border-top:0.5px solid var(--color-border-tertiary)}

/* Pain */
.pain-wrap{display:flex;gap:3px;flex-wrap:nowrap;margin-top:6px}
.pb{width:34px;height:46px;border-radius:var(--border-radius-md);border:0.5px solid var(--color-border-secondary);background:var(--color-background-secondary);cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-size:10px;font-weight:500;transition:all .12s;flex-shrink:0}
.pb.act{border-color:#1d9e75;background:#E1F5EE;color:#0F6E56}
.pb.warn{border-color:#E24B4A;background:#FCEBEB;color:#A32D2D}
.pf{font-size:16px;line-height:1}

/* Muscle table */
.mt{width:100%;border-collapse:collapse;font-size:11px}
.mt th{background:var(--color-background-secondary);padding:4px 3px;text-align:center;border:0.5px solid var(--color-border-tertiary);font-weight:500;font-size:10px;color:var(--color-text-secondary)}
.mt td{border:0.5px solid var(--color-border-tertiary);padding:1px}
.mt td.rl{font-size:10px;padding:4px 6px;color:var(--color-text-secondary);font-weight:500;white-space:nowrap;background:var(--color-background-secondary)}
.mt input[type=text]{width:100%;border:none;background:transparent;text-align:center;font-size:11px;padding:3px 1px;color:var(--color-text-primary);font-family:var(--font-sans)}
.mt input[type=text]:focus{outline:none;background:var(--color-background-info)}

/* Reflexes table */
.rt{border-collapse:collapse;font-size:12px;width:100%}
.rt th{background:var(--color-background-secondary);padding:5px 8px;text-align:center;border:0.5px solid var(--color-border-tertiary);font-weight:500;font-size:10px;color:var(--color-text-secondary)}
.rt td{border:0.5px solid var(--color-border-tertiary);padding:3px 6px;text-align:center;font-size:11px}
.rt td.rl{text-align:left;font-size:11px;color:var(--color-text-secondary);font-weight:500;white-space:nowrap;background:var(--color-background-secondary);padding:4px 8px}
.rt select{border:none;background:transparent;font-size:11px;color:var(--color-text-primary);cursor:pointer;font-family:var(--font-sans);width:100%}

/* Ashworth */
.ash-tbl{border-collapse:collapse;font-size:11px;width:100%}
.ash-tbl th{background:var(--color-background-secondary);padding:4px 6px;border:0.5px solid var(--color-border-tertiary);font-weight:500;font-size:10px;text-align:center;color:var(--color-text-secondary)}
.ash-tbl th.ash-e{background:#dbeafe;color:#1d4ed8;font-weight:700}
.ash-tbl th.ash-d{background:#fee2e2;color:#b91c1c;font-weight:700}
.ash-tbl td.ash-e{background:#eff6ff}
.ash-tbl td.ash-d{background:#fff5f5}
.ash-tbl td{border:0.5px solid var(--color-border-tertiary);padding:2px 4px;text-align:center}
.ash-tbl td.rl{text-align:left;font-size:10px;color:var(--color-text-secondary);background:var(--color-background-secondary);padding:4px 6px;white-space:nowrap}
.ash-tbl select{border:none;background:transparent;font-size:11px;color:var(--color-text-primary);cursor:pointer;font-family:var(--font-sans);width:100%}

/* Sensitivity grid */
.sens-tbl{border-collapse:collapse;font-size:11px;width:100%}
.sens-tbl th{background:var(--color-background-secondary);padding:4px 6px;border:0.5px solid var(--color-border-tertiary);font-weight:500;font-size:10px;text-align:center;color:var(--color-text-secondary)}
.sens-tbl td{border:0.5px solid var(--color-border-tertiary);padding:3px 4px;text-align:center}
.sens-tbl td.rl{text-align:left;font-size:10px;color:var(--color-text-secondary);background:var(--color-background-secondary);padding:4px 6px;white-space:nowrap}
.sens-tbl select{border:none;background:transparent;font-size:11px;cursor:pointer;font-family:var(--font-sans);width:100%;color:var(--color-text-primary)}

/* Body map */
.bmap{display:flex;gap:14px;align-items:flex-start}
.bsvg-wrap{flex:1;min-width:0;background:var(--color-background-secondary);border-radius:var(--border-radius-lg);border:0.5px solid var(--color-border-tertiary);padding:10px}
.bleg{width:148px;flex-shrink:0}
.li{display:flex;align-items:center;gap:8px;margin-bottom:8px;cursor:pointer;padding:6px 9px;border-radius:var(--border-radius-md);border:0.5px solid transparent;transition:all .12s;font-size:12px}
.li:hover,.li.act{background:var(--color-background-secondary);border-color:var(--color-border-secondary)}
.ldot{width:13px;height:13px;border-radius:50%;flex-shrink:0;border:2px solid rgba(0,0,0,.12)}

/* Glasgow */
.gcw{display:none;margin-top:12px;padding:14px;background:var(--color-background-secondary);border-radius:var(--border-radius-md);border:0.5px solid var(--color-border-info)}
.gcw.show{display:block}
.glasgow-tbl{border-collapse:collapse;font-size:11px;width:100%}
.glasgow-tbl th{background:var(--color-background-primary);padding:4px 8px;border:0.5px solid var(--color-border-tertiary);font-weight:500;text-align:left}
.glasgow-tbl td{border:0.5px solid var(--color-border-tertiary);padding:4px 8px;font-size:11px}
.glasgow-tbl td:first-child{font-weight:500;background:var(--color-background-secondary)}
.glasgow-score{font-size:18px;font-weight:500;color:#0F6E56;margin-top:8px}

/* Lang expand */
.lang-expand{display:none;margin-top:10px;padding:12px;background:var(--color-background-secondary);border-radius:var(--border-radius-md);border:0.5px solid var(--color-border-tertiary)}
.lang-expand.show{display:block}

/* Ulcera */
.ul-sec{display:none;margin-top:8px;padding:10px;background:var(--color-background-secondary);border-radius:var(--border-radius-md);border:0.5px solid var(--color-border-tertiary)}
.ul-sec.show{display:block}

/* Cranial nerves */
.cn-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px}
.cn-item{padding:10px 12px;background:var(--color-background-secondary);border-radius:var(--border-radius-md);border:0.5px solid var(--color-border-tertiary)}
.cn-label{font-size:11px;font-weight:500;color:var(--color-text-secondary);margin-bottom:6px}

/* Objectivos */
.obj-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:8px}
.obj-item{display:flex;align-items:flex-start;gap:8px;cursor:pointer;font-size:12px;padding:6px 10px;border-radius:var(--border-radius-md);border:0.5px solid var(--color-border-tertiary);background:var(--color-background-secondary);transition:all .12s}
.obj-item.sel{background:#E1F5EE;border-color:#5DCAA5;color:#0F6E56}
.obj-item input{width:14px;height:14px;accent-color:#1d9e75;flex-shrink:0;margin-top:1px}

/* Balance */
.btbl{border-collapse:collapse;font-size:12px}
.btbl th,.btbl td{border:0.5px solid var(--color-border-secondary);padding:6px 12px;text-align:center}
.btbl th{background:var(--color-background-secondary);font-weight:500}
.btbl select{border:none;background:transparent;font-size:12px;cursor:pointer;font-family:var(--font-sans);color:var(--color-text-primary)}

.inp-sm{border:0.5px solid var(--color-border-secondary);border-radius:var(--border-radius-md);padding:5px 9px;font-size:13px;background:var(--color-background-secondary);color:var(--color-text-primary);font-family:var(--font-sans);width:72px}
.flex-r{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.btn-open{display:inline-flex;align-items:center;gap:5px;padding:6px 13px;border:0.5px solid var(--color-border-secondary);border-radius:var(--border-radius-md);background:var(--color-background-secondary);font-size:12px;cursor:pointer;font-family:var(--font-sans);color:var(--color-text-primary)}
.btn-open:hover{background:var(--color-background-tertiary)}
.save-btn{padding:9px 22px;border:none;border-radius:var(--border-radius-md);background:#1d9e75;color:white;font-size:13px;font-weight:500;cursor:pointer;font-family:var(--font-sans)}
.save-btn:hover{background:#0f6e56}
.bottom-bar{display:flex;gap:10px;align-items:center;justify-content:flex-end;margin-top:14px;padding-top:14px;border-top:0.5px solid var(--color-border-tertiary)}
.badge-new{display:inline-block;padding:1px 7px;border-radius:100px;font-size:10px;font-weight:500;background:#E1F5EE;color:#0F6E56;margin-left:6px;vertical-align:middle}
/* Tooltip sensitivo */
#sens-tooltip{display:none;position:fixed;background:#1e293b;color:white;font-size:11px;padding:8px 12px;border-radius:8px;pointer-events:none;z-index:9999;max-width:260px;line-height:1.4;box-shadow:0 4px 12px rgba(0,0,0,0.3)}
.sens-leg{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:100px;font-size:11px;font-weight:500;border:0.5px solid var(--color-border-secondary);background:var(--color-background-secondary);cursor:pointer;color:var(--color-text-secondary);transition:all .12s;user-select:none}
.sens-leg.act{box-shadow:0 0 0 2px #1d9e75;color:var(--color-text-primary)}
.sens-leg:hover{background:var(--color-background-tertiary)}
/* Muscle table v2 — com nervo e raiz */
.mt2{width:100%;border-collapse:collapse;font-size:12px}
.mt2 th{background:var(--color-background-secondary);padding:5px 8px;border:0.5px solid var(--color-border-tertiary);font-weight:500;font-size:11px;color:var(--color-text-secondary);text-align:center;white-space:nowrap}
.mt2 th:first-child{text-align:left}
.mt2 td{border:0.5px solid var(--color-border-tertiary);padding:4px 8px;font-size:12px;vertical-align:middle}
.mt2 td.mv{font-weight:500;color:var(--color-text-primary);white-space:nowrap}
.mt2 td.mus{color:var(--color-text-secondary);font-size:11px}
.mt2 td.nrv{color:var(--color-text-secondary);font-size:11px;font-style:italic}
.mt2 td.raiz{text-align:center;font-size:11px;font-weight:600;color:var(--color-text-info)}
.mt2 td.mrc-cell{text-align:center;cursor:pointer;font-size:13px;font-weight:600;min-width:48px;transition:background .15s;user-select:none}
.mrc-sel{border:1px solid var(--color-border-tertiary);border-radius:6px;padding:3px 4px;font-size:13px;font-weight:600;min-width:52px;text-align:center;cursor:pointer;background:transparent;color:var(--color-text-primary)}
.mrc-sel-d{background:#fff5f5;border-color:#fca5a5;color:#b91c1c}
.mrc-sel-e{background:#eff6ff;border-color:#93c5fd;color:#1d4ed8}
.mrc-sel option{font-weight:600}
.mt2 td.mrc-cell:hover{filter:brightness(0.92)}
.mt2 td.mrc-5{background:#dcfce7;color:#166534}
.mt2 td.mrc-4{background:#fef9c3;color:#713f12}
.mt2 td.mrc-3{background:#ffedd5;color:#7c2d12}
.mt2 td.mrc-2{background:#fee2e2;color:#991b1b}
.mt2 td.mrc-1{background:#fce7f3;color:#831843}
.mt2 td.mrc-0{background:#f1f5f9;color:#475569}
.mt2 td.mrc-nd{background:transparent;color:var(--color-text-tertiary)}
.muscle-block-title{font-size:12px;font-weight:600;color:var(--color-text-secondary);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;padding-bottom:4px;border-bottom:1.5px solid var(--color-border-tertiary)}
.mrc-chip{display:inline-flex;align-items:center;padding:2px 8px;border-radius:100px;font-size:10px;font-weight:500;border:0.5px solid transparent}

@media print{.gc-actions{display:none!important}}
.gc-pdf-btn{padding:9px 22px;border:none;border-radius:8px;background:#1a56db;color:white;font-size:13px;font-weight:500;cursor:pointer}
.gc-save-btn{padding:9px 22px;border:none;border-radius:8px;background:#1d9e75;color:white;font-size:13px;font-weight:500;cursor:pointer}
#gc-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#0f172a;color:#fff;padding:10px 22px;border-radius:8px;font-size:13px;opacity:0;transition:opacity .3s;pointer-events:none;z-index:9999}
#gc-toast.show{opacity:1}
</style>

<div class="page">
<h1>Relatório Neurológico — MFR</h1>
<p class="subtitle">Medicina Física e de Reabilitação · Dr. João Morais</p>

<!-- 1. QUEIXA -->
<div class="sec">
  <div class="sec-title"><div class="num">1</div>Queixa principal / Motivo de referenciação</div>
  <textarea style="min-height:90px" placeholder="Ex: Fractura transtrocantérica dta, encavilhamento 21/1/2026. Síndrome de imobilização..."></textarea>
</div>

<!-- 2. ESTADO GERAL — RELATÓRIO NEUROLÓGICO -->
<div class="sec">
  <div class="sec-title"><div class="num">2</div>Estado geral</div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:12px">
    <div>
      <div class="gl">Consciência</div>
      <div class="rg">
        <label class="ri"><input type="radio" name="cons" onchange="checkGlasgow(this,false)"> Vigil / Consciente</label>
        <label class="ri"><input type="radio" name="cons" onchange="checkGlasgow(this,true)"> Somnolento</label>
        <label class="ri"><input type="radio" name="cons" onchange="checkGlasgow(this,true)"> Confuso</label>
        <label class="ri"><input type="radio" name="cons" onchange="checkGlasgow(this,true)"> Inconsciente / Coma</label>
      </div>
      <div class="gcw" id="gcw">
        <div class="gl" style="color:var(--color-text-info);margin-bottom:8px">Escala de Coma de Glasgow</div>
        <table class="glasgow-tbl">
          <tr><th>Abertura ocular</th><td><select onchange="calcGlasgow()">
            <option value="4">4 — Espontânea</option><option value="3">3 — À fala</option>
            <option value="2">2 — À dor</option><option value="1">1 — Nunca</option>
          </select></td></tr>
          <tr><th>Resposta verbal</th><td><select onchange="calcGlasgow()">
            <option value="5">5 — Orientada</option><option value="4">4 — Confusa</option>
            <option value="3">3 — Palavras inadequadas</option><option value="2">2 — Sons incompreensíveis</option>
            <option value="1">1 — Nenhuma</option>
          </select></td></tr>
          <tr><th>Resposta motora</th><td><select onchange="calcGlasgow()">
            <option value="6">6 — Obedece ordens</option><option value="5">5 — Localiza dor</option>
            <option value="4">4 — Retirada (fuga)</option><option value="3">3 — Flexão anormal</option>
            <option value="2">2 — Extensão</option><option value="1">1 — Nenhuma</option>
          </select></td></tr>
        </table>
        <div class="glasgow-score">GCS: <span id="gcs-val">15</span>/15 — <span id="gcs-interp">Sem alteração</span></div>
      </div>
    </div>
    <div>
      <div class="gl">Estado mental</div>
      <div class="rg">
        <label class="ri"><input type="radio" name="ment"> Orientado (T/E/P)</label>
        <label class="ri"><input type="radio" name="ment"> Desorientado temporal</label>
        <label class="ri"><input type="radio" name="ment"> Desorientado espacial</label>
        <label class="ri"><input type="radio" name="ment"> Desorientado na pessoa</label>
      </div>
    </div>
    <div>
      <div class="gl">Comportamento / Colaboração</div>
      <div class="rg">
        <label class="ri"><input type="radio" name="comp"> Nada colaborante</label>
        <label class="ri"><input type="radio" name="comp"> Pouco colaborante</label>
        <label class="ri"><input type="radio" name="comp"> Colaborante</label>
        <label class="ri"><input type="radio" name="comp"> Muito colaborante</label>
      </div>
    </div>
  </div>
  <div style="margin-bottom:12px">
    <div class="gl">Estado afectivo</div>
    <div style="display:flex;gap:16px;flex-wrap:wrap">
      <label class="ri"><input type="radio" name="afet"> Normal</label>
      <label class="ri"><input type="radio" name="afet"> Inquieto / Ansioso</label>
      <label class="ri"><input type="radio" name="afet"> Apático</label>
      <label class="ri"><input type="radio" name="afet"> Deprimido</label>
      <label class="ri"><input type="radio" name="afet"> Exaltado / Agressivo</label>
      <label class="ri"><input type="radio" name="afet"> Instável / Lábil</label>
    </div>
  </div>
  <div style="margin-bottom:18px">
    <div class="gl">Comunicação</div>
    <div style="display:flex;gap:16px;flex-wrap:wrap">
      <label class="ri"><input type="radio" name="comun"> Sem alterações</label>
      <label class="ri"><input type="radio" name="comun"> Disartria</label>
      <label class="ri"><input type="radio" name="comun"> Hipofonia</label>
      <label class="ri"><input type="radio" name="comun"> Alterações da linguagem</label>
    </div>
  </div>
  <div class="sub-title">Avaliação da linguagem <span class="badge-new">novo</span></div>

  <!-- Discurso global -->
  <div style="margin-bottom:12px">
    <div class="gl">Discurso</div>
    <div style="display:flex;gap:16px;flex-wrap:wrap">
      <label class="ri"><input type="radio" name="discurso"> Fluente e coerente</label>
      <label class="ri"><input type="radio" name="discurso"> Não fluente / Telegráfico</label>
      <label class="ri"><input type="radio" name="discurso"> Incoerente / Desorganizado</label>
      <label class="ri"><input type="radio" name="discurso"> Sem produção verbal</label>
    </div>
  </div>

  <!-- 4 domínios -->
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-bottom:10px">

    <!-- Fluência -->
    <div class="cn-item">
      <div class="cn-label">Fluência</div>
      <div class="rg" style="margin-bottom:6px">
        <label class="ri"><input type="radio" name="ling_fluencia"> Preservada</label>
        <label class="ri"><input type="radio" name="ling_fluencia"> Reduzida</label>
        <label class="ri"><input type="radio" name="ling_fluencia"> Ausente</label>
      </div>
      <div style="font-size:10px;color:var(--color-text-tertiary);margin-bottom:3px">Se alterada:</div>
      <div class="cg">
        <label class="ci"><input type="checkbox"> Parafasias fonémicas</label>
        <label class="ci"><input type="checkbox"> Parafasias semânticas</label>
        <label class="ci"><input type="checkbox"> Neologismos / Jargão</label>
      </div>
    </div>

    <!-- Compreensão -->
    <div class="cn-item">
      <div class="cn-label">Compreensão</div>
      <div class="rg" style="margin-bottom:6px">
        <label class="ri"><input type="radio" name="compreensao"> Preservada (simples e complexas)</label>
        <label class="ri"><input type="radio" name="compreensao"> Só ordens simples</label>
        <label class="ri"><input type="radio" name="compreensao"> Défice marcado</label>
        <label class="ri"><input type="radio" name="compreensao"> Ausente</label>
      </div>
    </div>

    <!-- Nomeação -->
    <div class="cn-item">
      <div class="cn-label">Nomeação</div>
      <div class="rg" style="margin-bottom:6px">
        <label class="ri"><input type="radio" name="nomeacao"> Preservada</label>
        <label class="ri"><input type="radio" name="nomeacao"> Anomia ligeira</label>
        <label class="ri"><input type="radio" name="nomeacao"> Anomia marcada</label>
        <label class="ri"><input type="radio" name="nomeacao"> Ausente</label>
      </div>
      <div class="cg">
        <label class="ci"><input type="checkbox"> Circunlóquios</label>
        <label class="ci"><input type="checkbox"> Pista fonémica ajuda</label>
      </div>
    </div>

    <!-- Repetição -->
    <div class="cn-item">
      <div class="cn-label">Repetição</div>
      <div class="rg" style="margin-bottom:6px">
        <label class="ri"><input type="radio" name="repeticao"> Preservada</label>
        <label class="ri"><input type="radio" name="repeticao"> Alterada — palavras</label>
        <label class="ri"><input type="radio" name="repeticao"> Alterada — frases</label>
        <label class="ri"><input type="radio" name="repeticao"> Ausente</label>
      </div>
      <div style="font-size:10px;color:var(--color-text-tertiary);margin-bottom:3px">Leitura / Escrita:</div>
      <div class="cg">
        <label class="ci"><input type="checkbox"> Alexia</label>
        <label class="ci"><input type="checkbox"> Agrafia</label>
        <label class="ci"><input type="checkbox"> Acalculia</label>
      </div>
    </div>
  </div>

  <!-- Classificação afasia + observações -->
  <div class="cols2" style="gap:8px">
    <div class="cn-item">
      <div class="cn-label">Classificação — se afásico</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px">
        <label class="ri"><input type="radio" name="afasia"> Broca (expressiva)</label>
        <label class="ri"><input type="radio" name="afasia"> Wernicke (receptiva)</label>
        <label class="ri"><input type="radio" name="afasia"> Condução</label>
        <label class="ri"><input type="radio" name="afasia"> Global</label>
        <label class="ri"><input type="radio" name="afasia"> Transcortical motora</label>
        <label class="ri"><input type="radio" name="afasia"> Transcortical sensorial</label>
        <label class="ri"><input type="radio" name="afasia"> Anómica</label>
        <label class="ri"><input type="radio" name="afasia"> Mista / Outra</label>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:6px">
      <div class="gl">Observações da linguagem</div>
      <textarea style="flex:1;min-height:100px" placeholder="Ex: Discurso fluente e coerente. Nomeação, Repetição e Compreensão preservadas para ordens simples e complexas. Sem parafasias ou neologismos..."></textarea>
    </div>
  </div>


  <div class="sub-title">Deglutição / Disfagia <span class="badge-new">novo</span></div>
  <div id="disfagia-sec" style="padding:14px 16px;background:var(--color-background-secondary);border-radius:var(--border-radius-lg);border:0.5px solid var(--color-border-info)">
    <div class="cols3" style="gap:14px">
      <div>
        <div class="gl">Consistência problemática</div>
        <div class="cg">
          <label class="ci"><input type="checkbox"> Sem alterações</label>
          <label class="ci"><input type="checkbox"> Líquidos (água, sumo, chá)</label>
          <label class="ci"><input type="checkbox"> Pastosos / Semissólidos</label>
          <label class="ci"><input type="checkbox"> Sólidos (carne, pão, arroz)</label>
          <label class="ci"><input type="checkbox"> Misto líquido-sólido</label>
          <label class="ci"><input type="checkbox"> Todas as consistências</label>
        </div>
        <div class="gl" style="margin-top:10px">Fase da deglutição</div>
        <div class="rg">
          <label class="ri"><input type="radio" name="dis-fase"> Oral (mastigação / formação do bolo)</label>
          <label class="ri"><input type="radio" name="dis-fase"> Faríngea (engolir / trânsito)</label>
          <label class="ri"><input type="radio" name="dis-fase"> Esofágica (sensação de paragem)</label>
          <label class="ri"><input type="radio" name="dis-fase"> Não sabe localizar</label>
        </div>
      </div>
      <div>
        <div class="gl">Sinais e sintomas</div>
        <div class="cg">
          <label class="ci"><input type="checkbox"> Engasgamento / tosse durante refeição</label>
          <label class="ci"><input type="checkbox"> Tosse após a refeição</label>
          <label class="ci"><input type="checkbox"> Voz húmida após deglutição</label>
          <label class="ci"><input type="checkbox"> Regurgitação nasal</label>
          <label class="ci"><input type="checkbox"> Deglutições múltiplas por bolo</label>
          <label class="ci"><input type="checkbox"> Odinofagia (dor ao engolir)</label>
          <label class="ci"><input type="checkbox"> Globus (sensação de bolo)</label>
          <label class="ci"><input type="checkbox"> Recusa / evicção alimentar</label>
          <label class="ci"><input type="checkbox"> Perda de peso / desnutrição</label>
          <label class="ci"><input type="checkbox"> Aspiração silenciosa</label>
          <label class="ci"><input type="checkbox"> Pneumonia de aspiração prévia</label>
        </div>
      </div>
      <div>
        <div class="gl">Grau funcional (FOIS)</div>
        <div class="rg" style="margin-bottom:12px">
          <label class="ri"><input type="radio" name="dis-grau"><span style="font-size:11px"><strong>1</strong> — Alimentação exclusiva SNG/PEG</span></label>
          <label class="ri"><input type="radio" name="dis-grau"><span style="font-size:11px"><strong>2</strong> — Via oral mínima, não nutritiva</span></label>
          <label class="ri"><input type="radio" name="dis-grau"><span style="font-size:11px"><strong>3</strong> — Via oral + suporte entérico</span></label>
          <label class="ri"><input type="radio" name="dis-grau"><span style="font-size:11px"><strong>4</strong> — Via oral total, consistência única</span></label>
          <label class="ri"><input type="radio" name="dis-grau"><span style="font-size:11px"><strong>5</strong> — Via oral, múltiplas consistências adaptadas</span></label>
          <label class="ri"><input type="radio" name="dis-grau"><span style="font-size:11px"><strong>6</strong> — Via oral total, adaptação mínima</span></label>
          <label class="ri"><input type="radio" name="dis-grau"><span style="font-size:11px"><strong>7</strong> — Via oral total, sem restrições</span></label>
        </div>
        <div class="gl">Escalas de rastreio</div>
        <div class="flex-r" style="margin-bottom:6px">
          <span style="font-size:12px;color:var(--color-text-secondary);min-width:70px">EAT-10</span>
          <input class="inp-sm" type="number" min="0" max="40" placeholder="0–40">
          <span style="font-size:11px;color:var(--color-text-tertiary)">≥3 = risco</span>
        </div>
        <div class="flex-r" style="margin-bottom:10px">
          <span style="font-size:12px;color:var(--color-text-secondary);min-width:70px">GUSS</span>
          <input class="inp-sm" type="number" min="0" max="20" placeholder="0–20">
          <span style="font-size:11px;color:var(--color-text-tertiary)">≤14 = disfagia</span>
        </div>
        <div class="gl">Via de alimentação actual</div>
        <div class="rg">
          <label class="ri"><input type="radio" name="dis-via"> Via oral sem restrições</label>
          <label class="ri"><input type="radio" name="dis-via"> Via oral c/ textura modificada</label>
          <label class="ri"><input type="radio" name="dis-via"> Via oral c/ líquidos espessados</label>
          <label class="ri"><input type="radio" name="dis-via"> SNG (sonda nasogástrica)</label>
          <label class="ri"><input type="radio" name="dis-via"> PEG / Gastrostomia</label>
          <label class="ri"><input type="radio" name="dis-via"> Nutrição parentérica total</label>
        </div>
      </div>
    </div>
    <div style="margin-top:12px">
      <div class="gl">Observações sobre a deglutição</div>
      <textarea style="min-height:60px" placeholder="Ex: Engasga com líquidos. Sem tosse reflexa ao engasgamento — aspiração silenciosa provável. GUSS 12/20 — disfagia moderada..."></textarea>
    </div>
  </div>



</div>

<!-- 3. QUADRO NEUROMOTOR / PARES CRANIANOS -->
<div class="sec">
  <div class="sec-title"><div class="num">3</div>Quadro neuromotor / Pares Cranianos</div>

  <!-- NEUROMOTOR + COORDENAÇÃO -->
  <div class="cols2" style="gap:16px;margin-bottom:14px">
    <div>
      <div class="gl">Quadro neuromotor</div>
      <div class="cg" style="display:grid;grid-template-columns:1fr 1fr;gap:4px">
        <label class="ci"><input type="checkbox"> Sem alterações</label>
        <label class="ci"><input type="checkbox"> Hemiparésia D</label>
        <label class="ci"><input type="checkbox"> Hemiparésia E</label>
        <label class="ci"><input type="checkbox"> Hemiplégia D</label>
        <label class="ci"><input type="checkbox"> Hemiplégia E</label>
        <label class="ci"><input type="checkbox"> Monoparésia</label>
        <label class="ci"><input type="checkbox"> Paraparésia</label>
        <label class="ci"><input type="checkbox"> Paraplegia</label>
        <label class="ci"><input type="checkbox"> Tetraparésia</label>
        <label class="ci"><input type="checkbox"> Tetraplegia</label>
      </div>
    </div>
    <div>
      <div class="gl">Coordenação (assinalar défices)</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div>
          <div style="font-size:10px;color:var(--color-text-tertiary);margin-bottom:4px;font-weight:500">Hemicorpo D</div>
          <div class="cg">
            <label class="ci"><input type="checkbox"> Preensão grossa</label>
            <label class="ci"><input type="checkbox"> Pinça fina</label>
            <label class="ci"><input type="checkbox"> Dedo-nariz</label>
            <label class="ci"><input type="checkbox"> Diadococinésia</label>
            <label class="ci"><input type="checkbox"> Calcanhar-joelho</label>
          </div>
        </div>
        <div>
          <div style="font-size:10px;color:var(--color-text-tertiary);margin-bottom:4px;font-weight:500">Hemicorpo E</div>
          <div class="cg">
            <label class="ci"><input type="checkbox"> Preensão grossa</label>
            <label class="ci"><input type="checkbox"> Pinça fina</label>
            <label class="ci"><input type="checkbox"> Dedo-nariz</label>
            <label class="ci"><input type="checkbox"> Diadococinésia</label>
            <label class="ci"><input type="checkbox"> Calcanhar-joelho</label>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- PARES CRANIANOS — 12 pares completos -->
  <div class="sub-title">Pares cranianos <span class="badge-new">completo</span></div>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:4px">

    <!-- I -->
    <div class="cn-item">
      <div class="cn-label">I — Olfactivo</div>
      <div class="rg">
        <label class="ri"><input type="radio" name="pc1"> Normal</label>
        <label class="ri"><input type="radio" name="pc1"> Anosmia</label>
        <label class="ri"><input type="radio" name="pc1"> Hiperosmia</label>
        <label class="ri"><input type="radio" name="pc1"> Cacosmia</label>
      </div>
    </div>

    <!-- II -->
    <div class="cn-item">
      <div class="cn-label">II — Óptico</div>
      <div class="cg">
        <label class="ci"><input type="checkbox"> Normal</label>
        <label class="ci"><input type="checkbox"> Escotoma</label>
        <label class="ci"><input type="checkbox"> Hemianópsia homónima</label>
        <label class="ci"><input type="checkbox"> Hemianópsia heterónima</label>
        <label class="ci"><input type="checkbox"> Quadrantanópsia</label>
        <label class="ci"><input type="checkbox"> Amaurose</label>
      </div>
    </div>

    <!-- III + IV + VI -->
    <div class="cn-item">
      <div class="cn-label">III / IV / VI — Oculomotores</div>
      <div class="cg" style="margin-bottom:6px">
        <label class="ci"><input type="checkbox"> Movimentos normais</label>
        <label class="ci"><input type="checkbox"> Estrabismo / Diplopia</label>
        <label class="ci"><input type="checkbox"> Ptose palpebral</label>
        <label class="ci"><input type="checkbox"> Nistagmo</label>
      </div>
      <div style="font-size:10px;color:var(--color-text-tertiary);margin-bottom:3px">Pupilas:</div>
      <div class="rg">
        <label class="ri"><input type="radio" name="pupilas"> Isocóricas e reactivas</label>
        <label class="ri"><input type="radio" name="pupilas"> Midríase / Miose</label>
        <label class="ri"><input type="radio" name="pupilas"> Anisocória</label>
        <label class="ri"><input type="radio" name="pupilas"> Reflexo fotomotor ausente</label>
      </div>
    </div>

    <!-- V -->
    <div class="cn-item">
      <div class="cn-label">V — Trigémio</div>
      <div class="cg">
        <label class="ci"><input type="checkbox"> Normal</label>
        <label class="ci"><input type="checkbox"> Hipostesia da face</label>
        <label class="ci"><input type="checkbox"> Nevralgia trigéminal</label>
        <label class="ci"><input type="checkbox"> Reflexo corneano ↓</label>
        <label class="ci"><input type="checkbox"> Défice mastigação</label>
        <label class="ci"><input type="checkbox"> Reflexo mandibular ↓</label>
      </div>
    </div>

    <!-- VII -->
    <div class="cn-item">
      <div class="cn-label">VII — Facial</div>
      <div class="rg" style="margin-bottom:5px">
        <label class="ri"><input type="radio" name="pc7"> Normal</label>
        <label class="ri"><input type="radio" name="pc7"> Parésia central D</label>
        <label class="ri"><input type="radio" name="pc7"> Parésia central E</label>
        <label class="ri"><input type="radio" name="pc7"> Parésia periférica D</label>
        <label class="ri"><input type="radio" name="pc7"> Parésia periférica E</label>
      </div>
      <div class="cg">
        <label class="ci"><input type="checkbox"> Disgeusia</label>
        <label class="ci"><input type="checkbox"> Reflexo corneano ↓ (eferente)</label>
      </div>
    </div>

    <!-- VIII -->
    <div class="cn-item">
      <div class="cn-label">VIII — Estato-acústico</div>
      <div class="cg">
        <label class="ci"><input type="checkbox"> Normal</label>
        <label class="ci"><input type="checkbox"> Hipoacúsia D</label>
        <label class="ci"><input type="checkbox"> Hipoacúsia E</label>
        <label class="ci"><input type="checkbox"> Hiperacúsia</label>
        <label class="ci"><input type="checkbox"> Surdez D / E</label>
        <label class="ci"><input type="checkbox"> Vertigem</label>
        <label class="ci"><input type="checkbox"> Nistagmo</label>
        <label class="ci"><input type="checkbox"> Rinné / Weber alterados</label>
      </div>
    </div>

    <!-- IX + X -->
    <div class="cn-item">
      <div class="cn-label">IX / X — Glossofaríngeo / Vago</div>
      <div class="cg" style="margin-bottom:5px">
        <label class="ci"><input type="checkbox"> Normal</label>
        <label class="ci"><input type="checkbox" id="disfagia-cb" onchange="document.getElementById('disfagia-sec').classList.toggle('show',this.checked)"> Disfagia ➜ caracterizar</label>
        <label class="ci"><input type="checkbox"> Disfonia / Voz anasalada</label>
        <label class="ci"><input type="checkbox"> Reflexo de gag ausente</label>
        <label class="ci"><input type="checkbox"> Disgeusia 1/3 posterior língua</label>
        <label class="ci"><input type="checkbox"> Desvio da úvula</label>
      </div>
    </div>

    <!-- XI -->
    <div class="cn-item">
      <div class="cn-label">XI — Espinhal</div>
      <div class="cg">
        <label class="ci"><input type="checkbox"> Normal</label>
        <label class="ci"><input type="checkbox"> Défice elevação ombros</label>
        <label class="ci"><input type="checkbox"> Défice rotação cabeça</label>
        <label class="ci"><input type="checkbox"> Atrofia trapézio</label>
        <label class="ci"><input type="checkbox"> Atrofia SCM</label>
      </div>
    </div>

    <!-- XII -->
    <div class="cn-item">
      <div class="cn-label">XII — Hipoglosso</div>
      <div class="rg" style="margin-bottom:5px">
        <label class="ri"><input type="radio" name="pc12"> Normal</label>
        <label class="ri"><input type="radio" name="pc12"> Desvio D (lesão ipsilateral)</label>
        <label class="ri"><input type="radio" name="pc12"> Desvio E (lesão ipsilateral)</label>
      </div>
      <div class="cg">
        <label class="ci"><input type="checkbox"> Atrofia / fasciculações</label>
        <label class="ci"><input type="checkbox"> Disartria</label>
        <label class="ci"><input type="checkbox"> Hipofonia</label>
      </div>
    </div>

  </div>

<!-- 4. MAPA CORPORAL -->
<div class="sec">
  <div class="sec-title"><div class="num">4</div>Mapa corporal — localização de alterações</div>
  <div class="bmap">
    <div class="bsvg-wrap">
      <svg id="bsvg" viewBox="0 0 900 620" xmlns="http://www.w3.org/2000/svg" style="width:100%;cursor:crosshair;display:block;border-radius:8px">
        <!-- Fundo branco -->
        <rect width="900" height="620" fill="white" rx="6"/>
        <!-- Imagem anatómica -->
        <image href="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAQDAwMDAgQDAwMEBAQFBgoGBgUFBgwICQcKDgwPDg4MDQ0PERYTDxAVEQ0NExoTFRcYGRkZDxIbHRsYHRYYGRj/2wBDAQQEBAYFBgsGBgsYEA0QGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBj/wAARCAMgBLADASIAAhEBAxEB/8QAHQABAAIDAAMBAAAAAAAAAAAAAAYHBAUIAQIDCf/EAFgQAAEDAwEEBgcEBwYDBQYCCwEAAgMEBREGBxIhMRNBUWFxgQgUIpGhscEjMkLRFVJicoKS8DNDorLC4RYkUxc0Y6PxJSZzg7PSJzZUk+IYRFVkKDV08v/EABsBAQADAAMBAAAAAAAAAAAAAAAEBQYCAwcB/8QAPREAAgIBAgQDBgUDAwQCAwEBAAECAwQFERIhMUEGE1EiYXGhscEUIzKBkULR8CRS4RUzYvE0ciU1grKi/9oADAMBAAIRAxEAPwDvxERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEXpLIyGF0ssjY42Auc95wGgcyT1BVRqHbPTGrfb9I07K57TuurpgehB/YHN/jwHiuE7IwW8jsrqlY9ootpOtUhT3jVF4dv3C81RB/u4j0bR5NW/oqGbcBM85d2mQ5+aj/AIpPojueK11ZaCKEU8t1pcGCtmx+q8749xW6o9Q5eIrjF0RPASt+759i7YXKR1yplHob1F4BDmhzSCDxBC8ruOkIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiKCar2r6X0vUPoWyvuVxbwNLSEHcP7b+TfDie5cZTUVu2coQlN7RRO0VESbWdXXefFFDSW2E8gxnSPx3udw+C2FHf9T1Dg6a91ZPYCAPgFH/Fw7En8HNdS50Vd0N9v0eC6udKOyRoKkNHqYkBtfT7n/iR8R5hc43xZ1SolEkaL5wzw1EQlgkbIw8nNOV9F37nSEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBEUC17tQtOjT+joWC4Xh4y2kY7AjB5OkP4R2DmfiuMpqK3ZzhCU3tFE7e9kcZke5rWjiXOOAPNaKs1rpiikMct3gkePwQZkP+HKoqfUN/1XU9PfK974yctpo/YiZ4NHPxOSt9bbfFuDdYAOwBQnmNv2US/wAGo/rZZbdoNif/AGUdc8dohx8ysmLWlnkGSyrZ+9F+Sh9Lb24B3fgtlFQgAewvqumcXTAlsGoLRUEBlaxpPVIC35rYseyRu8xwcO1pyFCBRsxgsC+sUL6d+/TyPicP1DhdqvfdHW6V2ZNEWipbxPGQysG+3/qNHEeIW6jljmiEkTw5h5ELvjNS6HTKLj1PdERcjiEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAF4JwCvKg+1jUTtPbNat8MvRVFWRSxOzgt3vvEeDcrjOSit2c64OclFdyotqu0So1JeprFbaoxWOmduSFhx628HiSetgI4Dr59iiVlvtvh3RTwvqMjg4cBns49aglwqphqxlEXOEDWNc0Dhknr+im9loYGQmNgGCd7gOv/wBVlM/Om23A3mn6RVGCdnPctbTN2oq+YUxidTzAAta45Dx3H6KeUkIDeSpqgcWPa4Etew8HDmOw/JWXXXYnR0E8T9yasDYgR+En7x8sFdmDn8cHx9UQNU0vy7Y+V0lyM+o1DQQOLYWvqSDul0f3c9mete0d9tk0OKgiF/HLXcQB4qPU1OHvhhhwImN5rKqLbC2BwDeAG84nivqzLZPl0PjwMeKUXvuTG11/qkrad796mf8AdP6n+ykapnTl5kFVc6Koc7oKdglY4uyGDJBH1VpafuDLnYYaljw/mwuHXhXOHlK1bFHqODLGm9+n9zaIiKeVgREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEKKB7WtVzaV2ezPo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hhbFWtf6UZi39b+IREXM4BERAEREAREQBERAEREAREQBERAEREAREQBCi02q70zTuirlenn/ALtA57B2vxho95C+N7Lc+xi5NRXc462w6hF89IC/1AeHRU1HLRQceG7CW5Pm8vKpWzW12otaVdXBGQaupLm9w5fTK2Wp7rINZS9I9znS0U7Hv7XPIJPvVhbM9NCmjhq5o9172AsaRxa38ystcnkW8C9d2emYrWDj+Y+ySRII6en03rXS4YBHBxopT1YkZjj54Vw0NAajT1fTubxdTtIH7TDn6Kj9pc5Jip4nbsjT0gcObSOR9+FdWyfUVPqvQFHdXEdMW9DUNHEiQey4e/5qficDlOr0KXU6rY115T79f2M7SFqbR7OrfaqZgc4F8bWjgBmd7j5ABTh9sjZYZYW+1Juh++RzLeI+S+FltjLdbhG4gyBzxw/C3fJx8eKXS8RQMko45AHtbmV4/AMZx44U5whVHifco48V09ofE+FzvTIbfG5vAuGcKE3W61D5RFG1z5XODQxvEuceQHvwpcyzGppYp353GM4Z61n6Z0vFJfP09VRDcicfVmEc3cjIfDkPM9i7pwlJHGFsKXxPnsSDS1nNj0xT0MpDqg5knI63u4n3cvJbpEXdFJLZFZObnJyfVhERfTiEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAQ8sIvWR4jic93Jo3j5cUB+eu1S6i4bZtTPactN0nI7wHBg/wAimmwCq3qm9Ub3ZYDDM0fqneLT9FUtxmfdda3OvIJFRVyyD+KRzvqrF2EPbS7RrjRSHBnoukYO3deCfmsdjZG+apfE9V1LEUNJcF2SOjIbLT1dO2pcM7z8EdvHH5qV09Ox9VmQfZsJdjq4clrKZzBHCxvDDs/FbuMAQNP6zt4+AWi34pbnnS32NfqC409utFZdK527TUkZlkJ68DOPkPEqu/R0vE1dqjVnrrgKqtdHXOb3lzmkDw9kLJ2vXB08NFpWneTvtdX1uOtjMljT+8/j4MUL2LV5tW2elie7dZVxyUru8kbzfi34qDflbZdcey5fyaXC05S0q+xr2mt18E9/nsdWonUivTFBR/XVYyg2ZagrHuDWxW6dxP8A8sqQKq/SJvP6H9Hy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1+LcWzldS1709/7EHdcqKoOaerjGeRbwK3Flu0tsw1rgW5yS0YWdJ6Log42vXFwjxybUQskHwwV6DYVtDpPs6fUtmqoxyMrJIz8MqP8A9JyaXvHn8GS/+s6ZfHZz2+KNpJqpntNllBBIIweLT3Fe7r3PUNdUmeKrgY3LmP8AZeAOeCOB+C0NTsJ2j1LfYv8AZIXdo6R30Xvadkm1a1Vm5LLY6yLP321L2gjvaW5XOWJl9ZJnVHJ0t7qNi3N42rpKu1trrfJHVUwG+YX8cDtY7t7l5bVsqLe6aEy1MP3muaMvh7cnrCWjZXtDtlZK79IafdDJIZGsj6Rojyc7uMYwFvKXZRqA11RUVusI2tqH77o6ekxuZHEAl3zC+LTsh8nE6JalhQ5qzf8An+xF6idtkhjuEgMoqSAOgy8lx5ZYOsq4dH01ZS6Tpm1sToZX5kMTubA45APYe5azSmzi0aVqX1UdZW19Sfuy1bwejHXugAAeKmIGFb4GC6Pam+Zn9W1SGUlXWuXr6nlERWZRhERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAf/2Q==" x="0" y="10" width="900" height="600" preserveAspectRatio="xMidYMid meet"/>
        <!-- Labels das vistas -->
        <text x="150" y="600" font-size="9" fill="#666" text-anchor="middle" font-family="var(--font-sans)" font-weight="500" letter-spacing="1">ANTERIOR</text>
        <text x="450" y="600" font-size="9" fill="#666" text-anchor="middle" font-family="var(--font-sans)" font-weight="500" letter-spacing="1">POSTERIOR</text>
        <text x="760" y="600" font-size="9" fill="#666" text-anchor="middle" font-family="var(--font-sans)" font-weight="500" letter-spacing="1">LATERAL D</text>
        <!-- Divisórias subtis -->
        <line x1="300" y1="20" x2="300" y2="590" stroke="#ddd" stroke-width="0.5" stroke-dasharray="4,4"/>
        <line x1="610" y1="20" x2="610" y2="590" stroke="#ddd" stroke-width="0.5" stroke-dasharray="4,4"/>
        <!-- Marcadores -->
        <g id="markers"></g>
      </svg>
    </div>
    <div class="bleg">
      <div style="font-size:11px;font-weight:500;color:var(--color-text-secondary);margin-bottom:8px">Tipo de alteração:</div>
      <div class="li act" data-color="#E24B4A" onclick="selType(this)"><div class="ldot" style="background:#E24B4A"></div>Dor</div>
      <div class="li" data-color="#1D9E75" onclick="selType(this)"><div class="ldot" style="background:#1D9E75"></div>Atrofias</div>
      <div class="li" data-color="#378ADD" onclick="selType(this)"><div class="ldot" style="background:#378ADD"></div>Edema</div>
      <div class="li" data-color="#D4537E" onclick="selType(this)"><div class="ldot" style="background:#D4537E"></div>Parestesias</div>
      <div class="li" data-color="#888780" onclick="selType(this)"><div class="ldot" style="background:#888780"></div>Cicatrizes</div>
      <div class="li" data-color="#BA7517" onclick="selType(this)"><div class="ldot" style="background:#BA7517"></div>Fratura/Cirurgia</div>
      <div style="margin-top:12px;padding-top:10px;border-top:0.5px solid var(--color-border-tertiary)">
        <div style="font-size:11px;color:var(--color-text-secondary)" id="mcount">0 marcadores</div>
        <button onclick="clearM()" style="margin-top:5px;font-size:11px;padding:4px 10px;border:0.5px solid var(--color-border-secondary);border-radius:var(--border-radius-md);background:transparent;cursor:pointer;color:var(--color-text-secondary);font-family:var(--font-sans)">Limpar</button>
      </div>
    </div>
  </div>
  <p class="note" style="margin-top:8px">Clique na silhueta para marcar. Clique num marcador para remover.</p>
</div>

<!-- 5. DOR -->
<div class="sec">
  <div class="sec-title"><div class="num">5</div>Avaliação da dor</div>
  <div class="cols2">
    <div>
      <div class="gl">Tipo de dor</div>
      <div class="rg">
        <label class="ri"><input type="checkbox" name="dtipo"> Ausente</label>
        <label class="ri"><input type="checkbox" name="dtipo"> Profunda / Maçadora</label>
        <label class="ri"><input type="checkbox" name="dtipo"> Ardência / Pressão</label>
        <label class="ri"><input type="checkbox" name="dtipo"> Aguda / Lancinante</label>
        <label class="ri"><input type="checkbox" name="dtipo"> Choque / Neuropática</label>
        <label class="ri"><input type="checkbox" name="dtipo"> Irradiada</label>
      </div>
      <div class="gl" style="margin-top:12px">Padrão temporal</div>
      <div class="rg">
        <label class="ri"><input type="checkbox" name="dpad"> Contínua</label>
        <label class="ri"><input type="checkbox" name="dpad"> Intermitente</label>
        <label class="ri"><input type="checkbox" name="dpad"> Ao movimento</label>
        <label class="ri"><input type="checkbox" name="dpad"> Em repouso</label>
        <label class="ri"><input type="checkbox" name="dpad"> Noturna</label>
      </div>
    </div>
    <div>
      <div class="gl">Intensidade — EVA 0–10</div>
      <div class="pain-wrap" id="ps">
        <div class="pb act" onclick="sp(0,this)"><div class="pf">😊</div><div>0</div></div>
        <div class="pb" onclick="sp(1,this)"><div class="pf">🙂</div><div>1</div></div>
        <div class="pb" onclick="sp(2,this)"><div class="pf">🙂</div><div>2</div></div>
        <div class="pb" onclick="sp(3,this)"><div class="pf">😐</div><div>3</div></div>
        <div class="pb" onclick="sp(4,this)"><div class="pf">😐</div><div>4</div></div>
        <div class="pb" onclick="sp(5,this)"><div class="pf">😟</div><div>5</div></div>
        <div class="pb" onclick="sp(6,this)"><div class="pf">😟</div><div>6</div></div>
        <div class="pb" onclick="sp(7,this)"><div class="pf">😣</div><div>7</div></div>
        <div class="pb" onclick="sp(8,this)"><div class="pf">😣</div><div>8</div></div>
        <div class="pb" onclick="sp(9,this)"><div class="pf">😭</div><div>9</div></div>
        <div class="pb" onclick="sp(10,this)"><div class="pf">😭</div><div>10</div></div>
      </div>
      <div style="margin-top:7px;font-size:12px;color:var(--color-text-secondary)">Valor: <strong id="pval" style="font-size:15px">0</strong>/10</div>
      <div class="gl" style="margin-top:12px">Descrição / localização da dor</div>
      <textarea placeholder="Localização, irradiação, fatores de agravamento e alívio..."></textarea>
    </div>
  </div>
</div>

<!-- 6. INSPEÇÃO + TÓNUS + ASHWORTH -->
<div class="sec">
  <div class="sec-title"><div class="num">6</div>Inspeção / Palpação / Tónus muscular</div>
  <div class="cols3">
    <div>
      <div class="gl">Contraturas musculares</div>
      <div class="rg" style="margin-bottom:10px">
        <label class="ri"><input type="radio" name="contr"> Não</label>
        <label class="ri"><input type="radio" name="contr"> Sim — localizadas</label>
        <label class="ri"><input type="radio" name="contr"> Sim — difusas</label>
      </div>
      <div class="gl">Trofismo muscular</div>
      <div class="cg">
        <label class="ci"><input type="checkbox"> Normal (normotrofia)</label>
        <label class="ci"><input type="checkbox"> Atrofia / hipotrofia</label>
        <label class="ci"><input type="checkbox"> Hipertrofia</label>
        <label class="ci"><input type="checkbox"> Pseudo-hipertrofia</label>
      </div>
      <div class="gl" style="margin-top:10px">Tónus muscular</div>
      <div class="rg">
        <label class="ri"><input type="radio" name="tonus"> Normotónico</label>
        <label class="ri"><input type="radio" name="tonus"> Hipotónico / Flácido</label>
        <label class="ri"><input type="radio" name="tonus"> Hipertónico — Rigidez</label>
        <label class="ri"><input type="radio" name="tonus"> Hipertónico — Espasticidade</label>
        <label class="ri"><input type="radio" name="tonus"> Distonia / Paratonia</label>
      </div>
    </div>
    <div>
      <div class="gl">Integridade cutânea</div>
      <div class="rg" style="margin-bottom:10px">
        <label class="ri"><input type="radio" name="cut"> Íntegra e hidratada</label>
        <label class="ri"><input type="radio" name="cut"> Desidratada</label>
        <label class="ri"><input type="radio" name="cut"> Cianótica</label>
        <label class="ri"><input type="radio" name="cut"> Alterada</label>
      </div>
      <div class="gl">Edemas</div>
      <div class="rg" style="margin-bottom:10px">
        <label class="ri"><input type="radio" name="edem"> Não</label>
        <label class="ri"><input type="radio" name="edem"> Localizado</label>
        <label class="ri"><input type="radio" name="edem"> Difuso</label>
      </div>
      <div class="gl">Úlceras de pressão</div>
      <div class="rg">
        <label class="ri"><input type="radio" name="ulc" onchange="document.getElementById('ulcsec').classList.remove('show')"> Não</label>
        <label class="ri"><input type="radio" name="ulc" onchange="document.getElementById('ulcsec').classList.add('show')"> Sim</label>
      </div>
      <div class="ul-sec" id="ulcsec">
        <div class="gl" style="margin-bottom:6px">Localização</div>
        <div class="cg">
          <label class="ci"><input type="checkbox"> Sacro-coccígea</label>
          <label class="ci"><input type="checkbox"> Calcâneo Esquerdo</label>
          <label class="ci"><input type="checkbox"> Calcâneo Direito</label>
          <label class="ci"><input type="checkbox"> Trocânter</label>
          <label class="ci"><input type="checkbox"> Maléolo</label>
          <label class="ci"><input type="checkbox"> Outra</label>
        </div>
        <div class="gl" style="margin-top:7px">Grau (NPUAP)</div>
        <div class="rg">
          <label class="ri"><input type="radio" name="ulcg"> Grau I</label>
          <label class="ri"><input type="radio" name="ulcg"> Grau II</label>
          <label class="ri"><input type="radio" name="ulcg"> Grau III</label>
          <label class="ri"><input type="radio" name="ulcg"> Grau IV</label>
        </div>
      </div>
    </div>
    <div>
      <div class="gl">Cicatrizes</div>
      <div class="rg" style="margin-bottom:8px">
        <label class="ri"><input type="radio" name="cic"> Não</label>
        <label class="ri"><input type="radio" name="cic"> Normal</label>
        <label class="ri"><input type="radio" name="cic"> Hipertrófica</label>
        <label class="ri"><input type="radio" name="cic"> Queloide</label>
      </div>
      <textarea placeholder="Local da cicatriz..." style="min-height:48px;margin-bottom:10px"></textarea>
      <div class="gl">Movimentos involuntários</div>
      <div class="cg">
        <label class="ci"><input type="checkbox"> Tremor de repouso</label>
        <label class="ci"><input type="checkbox"> Tremor de ação/intencional</label>
        <label class="ci"><input type="checkbox"> Tremor postural</label>
        <label class="ci"><input type="checkbox"> Espasmos / Clónus</label>
        <label class="ci"><input type="checkbox"> Fasciculações</label>
        <label class="ci"><input type="checkbox"> Coreia / Atetose</label>
        <label class="ci"><input type="checkbox"> Mioclonias</label>
        <label class="ci"><input type="checkbox"> Distonia</label>
      </div>
    </div>
  </div>

  <!-- ASHWORTH -->
  <div class="sub-title">Escala de Ashworth Modificada — Espasticidade <span class="badge-new">novo</span></div>
  <div style="overflow-x:auto">
  <table class="ash-tbl">
    <thead>
      <tr>
        <th rowspan="2" style="width:100px">Segmento</th>
        <th colspan="2">Ombro</th><th colspan="2">Cotovelo</th>
        <th colspan="2">Punho</th><th colspan="2">Mão/Dedos</th>
        <th colspan="2">Anca</th><th colspan="2">Joelho</th>
        <th colspan="2">TT</th><th colspan="2">Pé/Dedos</th>
      </tr>
      <tr>
        <th class="ash-e">E</th><th class="ash-d">D</th>
        <th class="ash-e">E</th><th class="ash-d">D</th>
        <th class="ash-e">E</th><th class="ash-d">D</th>
        <th class="ash-e">E</th><th class="ash-d">D</th>
        <th class="ash-e">E</th><th class="ash-d">D</th>
        <th class="ash-e">E</th><th class="ash-d">D</th>
        <th class="ash-e">E</th><th class="ash-d">D</th>
        <th class="ash-e">E</th><th class="ash-d">D</th>
      </tr>
    </thead>
    <tbody id="ashtbody"></tbody>
  </table>
  </div>
  <p class="note" style="margin-top:5px">0 sem aumento · 1 ligeiro (final movimento) · 1+ ligeiro (metade) · 2 moderado · 3 considerável · 4 rígido em flexão/extensão</p>
</div>

<!-- 7. FORÇA + REFLEXOS -->
<div class="sec">
  <div class="sec-title"><div class="num">7</div>Força muscular (MRC 0–5) / Reflexos osteotendinosos</div>

  <!-- Legenda MRC inline -->
  <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;align-items:center">
    <span style="font-size:11px;font-weight:500;color:var(--color-text-secondary)">Escala MRC:</span>
    <span class="mrc-chip" style="background:#dcfce7;color:#166534;border-color:#bbf7d0">5 — Normal</span>
    <span class="mrc-chip" style="background:#fef9c3;color:#713f12;border-color:#fde68a">4 — Contra resistência</span>
    <span class="mrc-chip" style="background:#ffedd5;color:#7c2d12;border-color:#fed7aa">3 — Contra gravidade</span>
    <span class="mrc-chip" style="background:#fee2e2;color:#991b1b;border-color:#fecaca">2 — Sem gravidade</span>
    <span class="mrc-chip" style="background:#fce7f3;color:#831843;border-color:#fbcfe8">1 — Esboço</span>
    <span class="mrc-chip" style="background:#f1f5f9;color:#475569;border-color:#cbd5e1">0 — Sem contração</span>
  </div>

  <!-- MEMBRO SUPERIOR -->
  <div class="muscle-block-title">Membro Superior</div>
  <div style="overflow-x:auto">
  <table class="mt2">
    <thead>
      <tr>
        <th style="text-align:left;min-width:170px">Movimento</th>
        <th style="min-width:160px">Músculo principal</th>
        <th style="min-width:130px">Nervo</th>
        <th style="min-width:60px">Raiz</th>
        <th style="min-width:52px">D</th>
        <th style="min-width:52px">E</th>
      </tr>
    </thead>
    <tbody id="mt-ms"></tbody>
  </table>
  </div>

  <!-- MEMBRO INFERIOR -->
  <div class="muscle-block-title" style="margin-top:18px">Membro Inferior</div>
  <div style="overflow-x:auto">
  <table class="mt2">
    <thead>
      <tr>
        <th style="text-align:left;min-width:200px">Movimento</th>
        <th style="min-width:180px">Músculo principal</th>
        <th style="min-width:150px">Nervo</th>
        <th style="min-width:60px">Raiz</th>
        <th style="min-width:52px">D</th>
        <th style="min-width:52px">E</th>
      </tr>
    </thead>
    <tbody id="mt-mi"></tbody>
  </table>
  </div>

  <!-- COLUNA -->
  <div class="muscle-block-title" style="margin-top:18px">Coluna</div>
  <div style="overflow-x:auto">
  <table class="mt2">
    <thead>
      <tr>
        <th style="text-align:left;min-width:200px">Movimento</th>
        <th style="min-width:200px">Músculo principal</th>
        <th style="min-width:150px">Nervo</th>
        <th style="min-width:60px">Raiz</th>
        <th style="min-width:52px">D</th>
        <th style="min-width:52px">E</th>
      </tr>
    </thead>
    <tbody id="mt-col"></tbody>
  </table>
  </div>

  <p class="note" style="margin-top:8px">Clique na célula D ou E para ciclar 0→1→2→3→4→5→— · A cor muda automaticamente com o grau</p>

  <!-- REFLEXOS -->
  <div class="sub-title">Reflexos osteotendinosos</div>
  <table class="rt">
    <thead>
      <tr><th style="text-align:left;width:160px">Reflexo</th><th>E</th><th>D</th><th style="text-align:left">Nível</th></tr>
    </thead>
    <tbody id="refbody"></tbody>
  </table>
  <p class="note" style="margin-top:5px">Ausente (0) · Diminuído (↓) · Normal (++) · Vivo (+++) · Clónus (C)</p>
  <div style="margin-top:12px">
    <div class="gl">Reflexo plantar (Babinski)</div>
    <div class="flex-r">
      <span style="font-size:12px;color:var(--color-text-secondary)">Esquerdo:</span>
      <label class="ri" style="margin:0"><input type="radio" name="babE"> Flexão (normal)</label>
      <label class="ri" style="margin:0"><input type="radio" name="babE"> Extensão (Babinski +)</label>
      <label class="ri" style="margin:0"><input type="radio" name="babE"> Indiferente</label>
    </div>
    <div class="flex-r" style="margin-top:6px">
      <span style="font-size:12px;color:var(--color-text-secondary)">Direito:</span>
      <label class="ri" style="margin:0"><input type="radio" name="babD"> Flexão (normal)</label>
      <label class="ri" style="margin:0"><input type="radio" name="babD"> Extensão (Babinski +)</label>
      <label class="ri" style="margin:0"><input type="radio" name="babD"> Indiferente</label>
    </div>
  </div>
</div>

<!-- 8. SENSIBILIDADE -->
<div class="sec">
  <div class="sec-title"><div class="num">8</div>Sensibilidade</div>
  <p class="note" style="margin:0 0 10px;font-size:11px"><strong>Táctil:</strong> algodão &nbsp;·&nbsp; <strong>Álgica:</strong> alfinete (padrão meia/luva) &nbsp;·&nbsp; <strong>Térmica/Vibratória:</strong> diapasão 128Hz — usar <strong>NT</strong> se não testada</p>
  <div class="sub-title">Mapa sensitivo dermatómico — interactivo <span class="badge-new">novo</span></div>

  <!-- Legenda / tipo de alteração -->
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;align-items:center">
    <span style="font-size:11px;font-weight:500;color:var(--color-text-secondary);margin-right:4px">Tipo de alteração:</span>
    <div class="sens-leg act" data-stype="hipostesia" data-scolor="#60a5fa" data-sopacity="0.45" onclick="selSens(this)" style="border-color:#60a5fa;background:#dbeafe">
      <div style="width:12px;height:12px;border-radius:50%;background:#60a5fa;flex-shrink:0"></div><span>Hipostesia</span>
    </div>
    <div class="sens-leg" data-stype="anestesia" data-scolor="#1e3a5f" data-sopacity="0.55" onclick="selSens(this)">
      <div style="width:12px;height:12px;border-radius:50%;background:#1e3a5f;flex-shrink:0"></div><span>Anestesia</span>
    </div>
    <div class="sens-leg" data-stype="hiperestesia" data-scolor="#ef4444" data-sopacity="0.45" onclick="selSens(this)">
      <div style="width:12px;height:12px;border-radius:50%;background:#ef4444;flex-shrink:0"></div><span>Hiperestesia</span>
    </div>
    <div class="sens-leg" data-stype="alodinia" data-scolor="#f97316" data-sopacity="0.45" onclick="selSens(this)">
      <div style="width:12px;height:12px;border-radius:50%;background:#f97316;flex-shrink:0"></div><span>Alodínia</span>
    </div>
    <div class="sens-leg" data-stype="parestesia" data-scolor="#a855f7" data-sopacity="0.45" onclick="selSens(this)">
      <div style="width:12px;height:12px;border-radius:50%;background:#a855f7;flex-shrink:0"></div><span>Parestesia</span>
    </div>
    <div class="sens-leg" data-stype="dor_neuropatica" data-scolor="#ec4899" data-sopacity="0.45" onclick="selSens(this)">
      <div style="width:12px;height:12px;border-radius:50%;background:#ec4899;flex-shrink:0"></div><span>Dor neuropática</span>
    </div>
    <button onclick="clearSensMarkers()" style="margin-left:auto;font-size:11px;padding:4px 11px;border:0.5px solid var(--color-border-secondary);border-radius:var(--border-radius-md);background:transparent;cursor:pointer;color:var(--color-text-secondary);font-family:var(--font-sans)">Limpar tudo</button>
  </div>

  <!-- Tooltip flutuante -->
  <div id="sens-tooltip" style="display:none;position:fixed;background:#1e293b;color:white;font-size:11px;padding:6px 10px;border-radius:6px;pointer-events:none;z-index:9999;max-width:180px;line-height:1.4"></div>

  <!-- Mapas -->
  <!-- Mapas sensitivos: MS + MI lado a lado, mesma altura -->
  <div style="display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap">

    <!-- MEMBROS SUPERIORES -->
    <div style="flex:0 0 auto;width:55%">
      <div class="gl" style="margin-bottom:6px;text-align:center;font-size:11px">Membros superiores — ventral / dorsal</div>
      <div style="background:white;border-radius:var(--border-radius-lg);border:0.5px solid var(--color-border-tertiary);padding:6px">
        <svg id="sens-ms" viewBox="0 0 772 520" xmlns="http://www.w3.org/2000/svg"
             style="height:460px;width:auto;max-width:100%;height:520px;cursor:crosshair;display:block"
             onclick="addSensClick(event,'ms')"
             onmousemove="moveSensTooltip(event)"
             onmouseleave="hideSensTooltip()">
          <image href="data:image/jpeg;base64,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" x="0" y="0" width="772" height="520" preserveAspectRatio="xMidYMid meet"/>
          <g id="sens-markers-ms"></g>
        </svg>
      </div>
      <p class="note" style="margin-top:4px;text-align:center">Clique para marcar · Clique num marcador para remover</p>
    </div>

    <!-- MEMBROS INFERIORES -->
    <div style="flex:0 0 auto;width:calc(45% - 14px)">
      <div class="gl" style="margin-bottom:6px;text-align:center;font-size:11px">Membros inferiores — anterior / posterior</div>
      <div style="background:white;border-radius:var(--border-radius-lg);border:0.5px solid var(--color-border-tertiary);padding:6px">
        <svg id="sens-mi" viewBox="0 0 354 520" xmlns="http://www.w3.org/2000/svg"
             style="height:460px;width:auto;max-width:100%;height:520px;cursor:crosshair;display:block"
             onclick="addSensClick(event,'mi')"
             onmousemove="moveSensTooltip(event)"
             onmouseleave="hideSensTooltip()">
          <image href="data:image/jpeg;base64,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" x="0" y="0" width="354" height="520" preserveAspectRatio="xMidYMid meet"/>
          <g id="sens-markers-mi"></g>
        </svg>
      </div>
      <p class="note" style="margin-top:4px;text-align:center">Clique para marcar · Clique num marcador para remover</p>
    </div>
  </div>

    <!-- Resumo textual -->
  <div style="margin-top:12px">
    <div class="gl">Resumo da avaliação sensitiva</div>
    <textarea style="min-height:64px" placeholder="Ex: Hipostesia no território L4-L5 esquerdo. Hiperestesia no dermátomo C6 direito. Parestesias distais bilaterais em MI compatíveis com polineuropatia..."></textarea>
  </div>

  <!-- Tabela clássica (colapso) -->
  <details style="margin-top:10px">
    <summary style="font-size:12px;cursor:pointer;color:var(--color-text-secondary);padding:6px 0">▸ Tabela detalhada por segmento (formato clássico)</summary>
    <div style="overflow-x:auto;margin-top:8px">
    <table class="sens-tbl">
      <thead>
        <tr>
          <th style="text-align:left;width:130px">Segmento</th>
          <th>Táctil E</th><th>Táctil D</th>
          <th>Álgica E</th><th>Álgica D</th>
          <th>Térmica E</th><th>Térmica D</th>
          <th>Propr. E</th><th>Propr. D</th>
          <th>Vibrat. E</th><th>Vibrat. D</th>
        </tr>
      </thead>
      <tbody id="sensbody"></tbody>
    </table>
    </div>
    <p class="note" style="margin-top:5px"><strong>N</strong> = Normal &nbsp;·&nbsp; <strong>↓</strong> Diminuída &nbsp;·&nbsp; <strong>0</strong> Ausente &nbsp;·&nbsp; <strong>H</strong> = Hiperestesia &nbsp;·&nbsp; <strong>NT</strong> = Não testada</p>
    <p class="note" style="margin-top:3px;font-size:10px;color:var(--color-text-tertiary)">Táctil e Álgica avaliadas &nbsp;·&nbsp; Térmica e Vibratória: seleccionar NT &nbsp;·&nbsp; Proprioceptiva: sem alterações (padrão)</p>
  </details>


</div>

<!-- 9. MOBILIDADE -->
<div class="sec">
  <div class="sec-title"><div class="num">9</div>Mobilidade / Levante / Transferências / Marcha</div>
  <div class="cols4">
    <div>
      <div class="gl">Mobilidade no leito</div>
      <div class="rg">
        <label class="ri"><input type="radio" name="mob"> Independente</label>
        <label class="ri"><input type="radio" name="mob"> Ind. modificada</label>
        <label class="ri"><input type="radio" name="mob"> Supervisão</label>
        <label class="ri"><input type="radio" name="mob"> Ajuda mínima</label>
        <label class="ri"><input type="radio" name="mob"> Ajuda moderada</label>
        <label class="ri"><input type="radio" name="mob"> Ajuda máxima</label>
        <label class="ri"><input type="radio" name="mob"> Total</label>
      </div>
    </div>
    <div>
      <div class="gl">Levante</div>
      <div class="rg">
        <label class="ri"><input type="radio" name="lev"> Independente</label>
        <label class="ri"><input type="radio" name="lev"> Supervisão</label>
        <label class="ri"><input type="radio" name="lev"> Ajuda mínima</label>
        <label class="ri"><input type="radio" name="lev"> Ajuda moderada</label>
        <label class="ri"><input type="radio" name="lev"> Ajuda máxima</label>
        <label class="ri"><input type="radio" name="lev"> Não realiza</label>
      </div>
    </div>
    <div>
      <div class="gl">Transferências</div>
      <div class="rg">
        <label class="ri"><input type="radio" name="transf"> Independente</label>
        <label class="ri"><input type="radio" name="transf"> Supervisão</label>
        <label class="ri"><input type="radio" name="transf"> Ajuda mínima</label>
        <label class="ri"><input type="radio" name="transf"> Ajuda moderada</label>
        <label class="ri"><input type="radio" name="transf"> Ajuda máxima</label>
        <label class="ri"><input type="radio" name="transf"> Não realiza</label>
      </div>
    </div>
    <div>
      <div class="gl">Marcha</div>
      <div class="rg" style="margin-bottom:8px">
        <label class="ri"><input type="radio" name="marc"> Independente</label>
        <label class="ri"><input type="radio" name="marc"> Com auxiliar</label>
        <label class="ri"><input type="radio" name="marc"> Supervisão</label>
        <label class="ri"><input type="radio" name="marc"> Ajuda física</label>
        <label class="ri"><input type="radio" name="marc"> Não deambula</label>
      </div>
      <div class="gl">Auxiliar de marcha</div>
      <div class="cg">
        <label class="ci"><input type="checkbox"> Canadiana unilateral</label>
        <label class="ci"><input type="checkbox"> Canadianas bilaterais</label>
        <label class="ci"><input type="checkbox"> Andarilho</label>
        <label class="ci"><input type="checkbox"> Cadeira de rodas</label>
      </div>
    </div>
  </div>
</div>

<!-- 10. EQUILÍBRIO -->
<div class="sec">
  <div class="sec-title"><div class="num">10</div>Equilíbrio</div>
  <div style="display:flex;gap:20px;flex-wrap:wrap;align-items:flex-start">
    <table class="btbl">
      <thead><tr><th></th><th>Em pé</th><th>Sentado</th></tr></thead>
      <tbody>
        <tr><td style="font-size:12px;text-align:left;padding-right:12px">Estático</td>
          <td><select><option>—</option><option>Normal</option><option>Diminuído</option><option>Ausente</option></select></td>
          <td><select><option>—</option><option>Normal</option><option>Diminuído</option><option>Ausente</option></select></td></tr>
        <tr><td style="font-size:12px;text-align:left">Dinâmico</td>
          <td><select><option>—</option><option>Normal</option><option>Diminuído</option><option>Ausente</option></select></td>
          <td><select><option>—</option><option>Normal</option><option>Diminuído</option><option>Ausente</option></select></td></tr>
      </tbody>
    </table>
    <div>
      <div class="gl">Risco de queda</div>
      <div class="rg">
        <label class="ri"><input type="radio" name="queda"> Ausente</label>
        <label class="ri"><input type="radio" name="queda"> Ligeiro</label>
        <label class="ri"><input type="radio" name="queda"> Moderado</label>
        <label class="ri"><input type="radio" name="queda"> Elevado</label>
      </div>
    </div>
    <div>
      <div class="gl">Escalas clínicas</div>
      <div class="flex-r" style="margin-bottom:7px">
        <span style="font-size:12px;color:var(--color-text-secondary);min-width:120px">Berg (0–56)</span>
        <input class="inp-sm" type="number" min="0" max="56" placeholder="—">

      </div>
      <div class="flex-r" style="margin-bottom:7px">
        <span style="font-size:12px;color:var(--color-text-secondary);min-width:120px">Tinetti Equil. (0–16)</span>
        <input class="inp-sm" type="number" min="0" max="16" placeholder="—">

      </div>
      <div class="flex-r">
        <span style="font-size:12px;color:var(--color-text-secondary);min-width:120px">Tinetti Marcha (0–12)</span>
        <input class="inp-sm" type="number" min="0" max="12" placeholder="—">
        <span style="font-size:11px;color:var(--color-text-tertiary)">Total:</span>
        <input class="inp-sm" type="number" placeholder="—" style="width:55px">
      </div>
    </div>
  </div>
  <div style="margin-top:12px">
    <div class="gl">Observações de equilíbrio</div>
    <textarea placeholder="Ex: Não consegue manter posição ortostática. Dificuldade acentuada em sentado sem apoio..."></textarea>
  </div>
</div>

<!-- 11. OBJETIVOS -->
<div class="sec">
  <div class="sec-title"><div class="num">11</div>Objetivos terapêuticos</div>
  <div class="gl">Selecione os objetivos aplicáveis:</div>
  <div class="obj-grid" id="objgrid"></div>
  <div style="margin-top:10px">
    <div class="gl">Objetivos adicionais</div>
    <textarea placeholder="Objetivos específicos para este doente..."></textarea>
  </div>
</div>

<!-- 12. CONCLUSÃO + PLANO -->
<div class="sec">
  <div class="sec-title"><div class="num">12</div>Diagnóstico funcional e conclusão</div>
  <textarea style="min-height:130px" placeholder="Conclusão clínica, síntese do exame objetivo e orientação para o programa de reabilitação..."></textarea>
  <div class="gl" style="margin-top:12px">Plano de reabilitação proposto</div>
  <textarea placeholder="Programa terapêutico, frequência, metas a curto/médio prazo..."></textarea>
</div>


</div>

<div class="gc-actions" style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;padding-top:14px;border-top:1px solid #e2e8f0">
  <div id="gc-toast"></div>
  <button type="button" class="gc-pdf-btn" id="gc-pdf-btn">Exportar PDF</button>
  <button type="button" class="gc-save-btn" id="gc-save-btn">Gravar</button>
</div>

<script>
var selColor='#E24B4A',mcount=0;
function selType(el){document.querySelectorAll('.li').forEach(i=>i.classList.remove('act'));el.classList.add('act');selColor=el.dataset.color;}

document.getElementById('bsvg').addEventListener('click',function(e){
  if(e.target.closest('#markers g'))return;
  var r=this.getBoundingClientRect(),vb=this.viewBox.baseVal;
  var x=(e.clientX-r.left)*(vb.width/r.width)+vb.x,y=(e.clientY-r.top)*(vb.height/r.height)+vb.y;
  mcount++;
  var g=document.createElementNS('http://www.w3.org/2000/svg','g');
  var c=document.createElementNS('http://www.w3.org/2000/svg','circle');
  c.setAttribute('cx',x);c.setAttribute('cy',y);c.setAttribute('r',9);c.setAttribute('fill',selColor);c.setAttribute('opacity','0.82');
  var t=document.createElementNS('http://www.w3.org/2000/svg','text');
  t.setAttribute('x',x);t.setAttribute('y',y+4);t.setAttribute('text-anchor','middle');
  t.setAttribute('font-size','8');t.setAttribute('font-weight','700');t.setAttribute('fill','white');t.setAttribute('font-family','var(--font-sans)');t.textContent=mcount;
  g.appendChild(c);g.appendChild(t);g.style.cursor='pointer';
  g.addEventListener('click',function(ev){ev.stopPropagation();this.remove();document.getElementById('mcount').textContent=document.querySelectorAll('#markers g').length+' marcadores';});
  document.getElementById('markers').appendChild(g);
  document.getElementById('mcount').textContent=mcount+' marcador'+(mcount!==1?'es':'');
});
function clearM(){document.getElementById('markers').innerHTML='';mcount=0;document.getElementById('mcount').textContent='0 marcadores';}

function sp(v,el){document.querySelectorAll('.pb').forEach(b=>{b.classList.remove('act','warn')});el.classList.add('act');if(v>=7)el.classList.add('warn');document.getElementById('pval').textContent=v;}

function checkGlasgow(r,show){document.getElementById('gcw').classList.toggle('show',show);}
function calcGlasgow(){
  var sels=document.querySelectorAll('#gcw select');
  var total=0;sels.forEach(s=>total+=parseInt(s.value));
  document.getElementById('gcs-val').textContent=total;
  var interp=total>=13?'Ligeira':total>=9?'Moderada':'Grave';
  document.getElementById('gcs-interp').textContent=total===15?'Sem alteração':'Lesão '+interp;
}

// ── FORÇA MUSCULAR — tabelas MS / MI / Coluna ──────────────────
var mrcLabels = ['—','0','1','2','3','4','5'];
var mrcClasses = ['mrc-nd','mrc-0','mrc-1','mrc-2','mrc-3','mrc-4','mrc-5'];
var mrcTitles = [
  'Não avaliado',
  '0 — Sem contração muscular',
  '1 — Contração visível/palpável sem movimento',
  '2 — Movimento sem vencer a gravidade',
  '3 — Movimento contra a gravidade',
  '4 — Movimento contra resistência moderada',
  '5 — Força normal'
];

var musclesMS = [
  ['Flexão do ombro',            'Deltoide anterior',        'Axilar',             'C5'],
  ['Abdução do ombro',           'Deltoide médio',           'Axilar',             'C5'],
  ['Rotação externa do ombro',   'Infraespinhoso',           'Supraescapular',     'C5'],
  ['Rotação interna do ombro',   'Subescapular',             'Subescapular',       'C6'],
  ['Flexão do cotovelo',         'Bíceps braquial',          'Musculocutâneo',     'C5–C6'],
  ['Extensão do cotovelo',       'Tríceps braquial',         'Radial',             'C7'],
  ['Extensão do punho',          'Extensores do carpo',      'Radial',             'C6'],
  ['Flexão do punho',            'Flexores do carpo',        'Mediano / Ulnar',    'C7'],
  ['Extensão dos dedos',         'Extensor comum dos dedos', 'Radial',             'C7'],
  ['Abdução dos dedos',          'Interósseos',              'Ulnar',              'T1'],
];

var musclesMI = [
  ['Flexão da anca',             'Iliopsoas',                'Femoral',            'L2'],
  ['Extensão da anca',           'Glúteo máximo',            'Glúteo inferior',    'L5'],
  ['Abdução da anca',            'Glúteo médio',             'Glúteo superior',    'L5'],
  ['Adução da anca',             'Adutores',                 'Obturador',          'L3'],
  ['Extensão do joelho',         'Quadríceps',               'Femoral',            'L3–L4'],
  ['Flexão do joelho',           'Isquiotibiais',            'Ciático',            'L5–S1'],
  ['Dorsiflexão do tornozelo',   'Tibial anterior',          'Fibular profundo',   'L4'],
  ['Extensão do hálux',          'Extensor longo do hálux',  'Fibular profundo',   'L5'],
  ['Flexão plantar',             'Gastrocnémio / Sóleo',     'Tibial',             'S1'],
  ['Eversão do pé',              'Fibulares',                'Fibular superficial','L5'],
];

var musclesCol = [
  ['Flexão cervical',            'Esternocleidomastoideu',   'Acessório',          'C1–C6'],
  ['Extensão cervical',          'Paravertebrais cervicais', 'Ramos dorsais',      'C1–C6'],
  ['Inclinação cervical',        'Escalenos',                'Ramos cervicais',    'C3–C6'],
  ['Flexão do tronco',           'Recto abdominal',          'Intercostais',       'D5–D12'],
  ['Extensão do tronco',         'Paravertebrais lombares',  'Ramos dorsais',      'D1–L3'],
  ['Inclinação lateral tronco',  'Quadrado lombar',          'Ramos lombares',     'D12–L3'],
];

function buildMuscleTable(tbodyId, data) {
  var tb = document.getElementById(tbodyId);
  var sel = '<td><select class="mrc-sel mrc-sel-d"><option value="">—</option><option>0</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></td>' +
            '<td><select class="mrc-sel mrc-sel-e"><option value="">—</option><option>0</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></td>';
  data.forEach(function(row) {
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td class="mv">' + row[0] + '</td>' +
      '<td class="mus">' + row[1] + '</td>' +
      '<td class="nrv">' + row[2] + '</td>' +
      '<td class="raiz">' + row[3] + '</td>' +
      sel;
    tb.appendChild(tr);
  });
}

buildMuscleTable('mt-ms', musclesMS);
buildMuscleTable('mt-mi', musclesMI);
buildMuscleTable('mt-col', musclesCol);

// Ashworth table
var ashSegs=['Flexores','Extensores'];
var atb=document.getElementById('ashtbody');
ashSegs.forEach(m=>{
  var tr=document.createElement('tr');
  tr.innerHTML='<td class="rl">'+m+'</td>';
  for(var i=0;i<16;i++){var ac=i%2===0?'ash-e':'ash-d';tr.innerHTML+='<td class="'+ac+'"><select><option>—</option><option>0</option><option>1</option><option>1+</option><option>2</option><option>3</option><option>4</option></select></td>';}
  atb.appendChild(tr);
});

// Reflexes table
var refs=[['Bicipital','C5/C6'],['Estilorradial','C5/C6'],['Tricipital','C6/C7'],['Rotuliano/Patelar','L3/L4'],['Aquiliano','L5/S1']];
var rb=document.getElementById('refbody');
refs.forEach(r=>{
  var tr=document.createElement('tr');
  tr.innerHTML='<td class="rl">'+r[0]+'</td>'+'<td><select><option>—</option><option>0 Ausente</option><option>↓ Diminuído</option><option>++ Normal</option><option>+++ Vivo</option><option>C Clónus</option></select></td>'.repeat(2)+'<td style="text-align:left;font-size:10px;color:var(--color-text-tertiary)">'+r[1]+'</td>';
  rb.appendChild(tr);
});

// Sensitivity table
var sensSegs=['MS — C5-C6','MS — C7-C8','Tórax T4-T10','Abd. T10-L1','MI — L2-L4','MI — L4-S1'];
var sb=document.getElementById('sensbody');
sensSegs.forEach(s=>{
  var tr=document.createElement('tr');
  tr.innerHTML='<td class="rl">'+s+'</td>';
  for(var i=0;i<10;i++){tr.innerHTML+='<td><select><option>—</option><option>N</option><option>↓</option><option>0</option><option>H</option><option>NT</option></select></td>';}
  sb.appendChild(tr);
});

// Objectivos
var objs=['Redução do síndrome álgico','Recuperação da força muscular global','Recuperação da força MS','Recuperação da força MI','Melhoria do equilíbrio estático','Melhoria do equilíbrio dinâmico','Treino de marcha','Independência nas transferências','Independência no levante','Prevenção de queda','Redução da espasticidade','Controlo motor e coordenação','Melhoria da amplitude articular','Prevenção de úlceras de pressão','Reeducação neuromotora','Treino de AVD','Integração de auxiliar de marcha','Fortalecimento do tronco/core','Reeducação da marcha pós-AVC','Alta com segurança e autonomia','Reabilitação da deglutição / disfagia','Progressão da via oral (textura / consistência)','Prevenção de aspiração / pneumonia de aspiração','Desmame de SNG / PEG'];
var og=document.getElementById('objgrid');
objs.forEach(o=>{var d=document.createElement('div');d.className='obj-item';d.innerHTML='<input type="checkbox" onchange="this.closest(\\'.obj-item\\').classList.toggle(\\'sel\\',this.checked)"> '+o;og.appendChild(d);});
// ── MAPAS SENSITIVOS DERMATOMAIS ──────────────────────────────
var sensCurType = 'hipostesia';
var sensCurColor = '#60a5fa';
var sensCurOpacity = 0.45;
var sensMcount = 0;

// Dermátomos MS com guia clínica de avaliação
var dermMS = [
  // Ventral esquerdo (x 0-50%)
  {x1:0,x2:22,y1:0,y2:30,label:'N. Axilar / Supraclavicular',avaliacao:'Sensibilidade na face lateral do ombro e região deltóide. Testar com toque leve e picada.'},
  {x1:0,x2:16,y1:30,y2:65,label:'N. Radial (C5-C8) — ventral',avaliacao:'Sensibilidade face posterolateral do antebraço. Défice sugere lesão radial alta. Avaliar extensão punho.'},
  {x1:0,x2:22,y1:65,y2:100,label:'N. Cutâneo Lateral do Antebraço / Musculocutâneo (C5-C6)',avaliacao:'Face lateral do antebraço. Associado ao reflexo bicipital. Avaliar flexão do cotovelo.'},
  {x1:22,x2:40,y1:30,y2:70,label:'N. Cutâneo Medial do Braço e Antebraço (C8-T1)',avaliacao:'Face medial do braço e antebraço. Lesão frequente no síndrome do desfiladeiro torácico.'},
  {x1:28,x2:50,y1:70,y2:100,label:'N. Ulnar (C8-T1) — ventral',avaliacao:'4.º e 5.º dedos + margem ulnar da mão. Testar abdução/adução dos dedos. Sinal de Froment.'},
  {x1:15,x2:38,y1:75,y2:100,label:'N. Mediano (C6-C8) — palmar',avaliacao:'Polegar, 2.º, 3.º e metade do 4.º dedo. Testar com mono-filamento. Oponência do polegar.'},
  // Dorsal direito (x 50-100%)
  {x1:50,x2:75,y1:0,y2:30,label:'N. Supraescapular / N. Axilar (C5-C6) — dorsal',avaliacao:'Região deltóide posterior e fossa infra-espinhosa. Testar rotação externa do ombro.'},
  {x1:50,x2:72,y1:30,y2:70,label:'N. Radial (C6-C8) — dorsal',avaliacao:'Face dorsal do braço e antebraço. Défice = neuropatia radial. Sinal de "mão caída".'},
  {x1:72,x2:100,y1:30,y2:70,label:'N. Cutâneo Medial do Braço (C8-T1) — dorsal',avaliacao:'Face medial posterior do braço. Verificar dermátomo C8 (dedos ulnares).'},
  {x1:50,x2:72,y1:70,y2:100,label:'N. Radial / Cutâneo Lateral Antebraço (C5-C7) — dorso',avaliacao:'Tabaqueira anatómica e dorso radial da mão. Importante na lesão de C6/C7.'},
  {x1:72,x2:100,y1:70,y2:100,label:'N. Ulnar / N. Mediano — dorso da mão',avaliacao:'Dorso dos dedos. N. Mediano: dorso 1.º-3.º dedo. N. Ulnar: 4.º-5.º dedo. Testar discriminação 2 pontos.'},
];

// Dermátomos MI com guia clínica de avaliação
var dermMI = [
  // Anterior (x 0-50%)
  {x1:0,x2:50,y1:0,y2:12,label:'T12 / L1 — Ilioinguinal / Iliohipogástrico',avaliacao:'Região inguinal e face interna da coxa proximal. Avaliar em hérnias, pós-apendicectomia e pós-parto.'},
  {x1:0,x2:25,y1:12,y2:42,label:'L2-L3 — N. Cutâneo Femoral Lateral',avaliacao:'Face anterolateral da coxa. Meralgia parestésica = compressão sob ligamento inguinal. Testar área de hipostesia.'},
  {x1:25,x2:50,y1:12,y2:42,label:'L2-L3 — Femoral Anterior',avaliacao:'Face anterior da coxa. Défice em lesão do nervo femoral ou raízes L2-L3. Testar reflexo rotuliano.'},
  {x1:0,x2:25,y1:42,y2:68,label:'L3-L4 — N. Safeno / Crural Medial',avaliacao:'Face medial da perna. Lesão L4 = hipostesia face medial pé + défice dorsiflexão. Reflexo rotuliano diminuído.'},
  {x1:25,x2:50,y1:42,y2:68,label:'L4-S2 — N. Peroneal Lateral Sural',avaliacao:'Face anterolateral da perna. Lesão L5 = hipostesia dorso do pé. Extensão do hálux (L5). Sinal de Lasègue.'},
  {x1:0,x2:25,y1:68,y2:88,label:'L4-S1 — N. Peroneal Superficial',avaliacao:'Dorso do pé excepto 1.º espaço interdigital. Lesão peroneal comum (cabeça do perónio). Eversão do pé.'},
  {x1:25,x2:50,y1:68,y2:88,label:'S1-S2 — N. Sural / Dorsal Lateral',avaliacao:'Maléolo lateral e margem lateral do pé. Lesão S1 = hipostesia borda lateral. Reflexo aquiliano diminuído/ausente.'},
  {x1:5,x2:45,y1:88,y2:100,label:'L4-S2 — Plantar / Calcâneos',avaliacao:'Planta do pé e calcâneos. Síndrome do túnel társico (tibial posterior). Testar sensibilidade plantar. Reflexo aquiliano.'},
  // Posterior (x 50-100%)
  {x1:50,x2:100,y1:0,y2:10,label:'L1-L3 — Cluneal Superior / Médio',avaliacao:'Região glútea superior. Avaliar em dor lombar referida. Nervos cluniais comprimidos em crista ilíaca.'},
  {x1:50,x2:100,y1:10,y2:42,label:'S1-S3 — N. Cutâneo Femoral Posterior',avaliacao:'Face posterior da coxa. Lesão S1-S2 = hipostesia face posterior. Testar com Slump test. Sinal de Lasègue invertido.'},
  {x1:50,x2:72,y1:42,y2:68,label:'L4-S2 — Peroneal Lateral Sural (posterior)',avaliacao:'Face posterolateral da perna. Lesão L5 ou S1. Testar flexão plantar (S1) e extensão hálux (L5).'},
  {x1:72,x2:100,y1:42,y2:68,label:'S1-S2 — N. Sural / Medial Sural',avaliacao:'Face posteromedial da perna. Lesão S1 clássica. Reflexo aquiliano diminuído/ausente. Dificuldade em pontas dos pés.'},
  {x1:50,x2:100,y1:68,y2:88,label:'S1-S2 — N. Sural / Calcâneos (posterior)',avaliacao:'Calcâneos e face posterior do tornozelo. Lesão S1 = hipostesia calcânea. Testar reflexo aquiliano e força gastrocnémio.'},
  {x1:50,x2:100,y1:88,y2:100,label:'S2-S4 — Plantar Medial / Lateral',avaliacao:'Planta medial e lateral. Síndrome do cone medular (S2-S4): bexiga, recto, função sexual. Avaliar reflexo bulbocavernoso.'},
];

function selSens(el) {
  document.querySelectorAll('.sens-leg').forEach(i => i.classList.remove('act'));
  el.classList.add('act');
  sensCurType    = el.dataset.stype;
  sensCurColor   = el.dataset.scolor;
  sensCurOpacity = parseFloat(el.dataset.sopacity);
}

function addSensClick(e, which) {
  if (e.target.closest('g[data-type]')) return;
  var svg = document.getElementById('sens-' + which);
  var r = svg.getBoundingClientRect();
  var vb = svg.viewBox.baseVal;
  var x = (e.clientX - r.left) * (vb.width  / r.width)  + vb.x;
  var y = (e.clientY - r.top)  * (vb.height / r.height) + vb.y;
  var pctX = ((e.clientX - r.left) / r.width)  * 100;
  var pctY = ((e.clientY - r.top)  / r.height) * 100;
  var dermList = (which === 'ms') ? dermMS : dermMI;
  var derm = getDermInfo(dermList, pctX, pctY);
  sensMcount++;
  var g = document.createElementNS('http://www.w3.org/2000/svg','g');
  g.setAttribute('data-type',   sensCurType);
  g.setAttribute('data-label',  derm.label);
  g.setAttribute('data-avaliacao', derm.avaliacao);
  var bigC = document.createElementNS('http://www.w3.org/2000/svg','circle');
  bigC.setAttribute('cx', x); bigC.setAttribute('cy', y);
  bigC.setAttribute('r', 14); bigC.setAttribute('fill', sensCurColor);
  bigC.setAttribute('opacity', String(sensCurOpacity));
  bigC.setAttribute('stroke', sensCurColor); bigC.setAttribute('stroke-width','1.5');
  var dot = document.createElementNS('http://www.w3.org/2000/svg','circle');
  dot.setAttribute('cx', x); dot.setAttribute('cy', y);
  dot.setAttribute('r', 4.5); dot.setAttribute('fill', sensCurColor); dot.setAttribute('opacity','0.95');
  var abbr = {hipostesia:'↓',anestesia:'0',hiperestesia:'↑↑',alodinia:'A',parestesia:'P',dor_neuropatica:'DN'};
  var txt = document.createElementNS('http://www.w3.org/2000/svg','text');
  txt.setAttribute('x', x); txt.setAttribute('y', y + 3.5);
  txt.setAttribute('text-anchor','middle');
  txt.setAttribute('font-size','6'); txt.setAttribute('font-weight','700');
  txt.setAttribute('fill','white'); txt.setAttribute('font-family','var(--font-sans)');
  txt.textContent = abbr[sensCurType] || '?';
  g.appendChild(bigC); g.appendChild(dot); g.appendChild(txt);
  g.style.cursor = 'pointer';
  g.addEventListener('mouseenter', function(ev) { showSensMarkerTooltip(ev, this); });
  g.addEventListener('mousemove',  function(ev) { moveSensTooltip(ev); });
  g.addEventListener('mouseleave', hideSensTooltip);
  g.addEventListener('click', function(ev) { ev.stopPropagation(); this.remove(); });
  document.getElementById('sens-markers-' + which).appendChild(g);
}

function getDermInfo(list, px, py) {
  for (var d of list) {
    if (px >= d.x1 && px <= d.x2 && py >= d.y1 && py <= d.y2)
      return {label: d.label, avaliacao: d.avaliacao};
  }
  return {label:'Região não mapeada', avaliacao:'Clique numa área com dermátomo identificado para orientação clínica.'};
}

function typeLabel(t) {
  var m = {hipostesia:'Hipostesia',anestesia:'Anestesia',hiperestesia:'Hiperestesia',
           alodinia:'Alodínia',parestesia:'Parestesia',dor_neuropatica:'Dor neuropática'};
  return m[t] || t;
}

function showSensMarkerTooltip(e, el) {
  var tt = document.getElementById('sens-tooltip');
  tt.innerHTML =
    '<div style="font-weight:600;margin-bottom:3px">' + typeLabel(el.dataset.type) + '</div>' +
    '<div style="font-size:10px;opacity:0.85;margin-bottom:4px">' + el.dataset.label + '</div>' +
    '<div style="border-top:0.5px solid rgba(255,255,255,0.3);padding-top:4px;font-size:10px;line-height:1.4">' +
    '<span style="opacity:0.7">Avaliar: </span>' + el.dataset.avaliacao + '</div>';
  tt.style.display = 'block';
  tt.style.left = (e.clientX + 14) + 'px';
  tt.style.top  = (e.clientY - 10) + 'px';
}

function moveSensTooltip(e) {
  var tt = document.getElementById('sens-tooltip');
  if (tt.style.display === 'block') {
    tt.style.left = (e.clientX + 14) + 'px';
    tt.style.top  = (e.clientY - 10) + 'px';
  }
}

function hideSensTooltip() {
  document.getElementById('sens-tooltip').style.display = 'none';
}

function clearSensMarkers() {
  document.getElementById('sens-markers-ms').innerHTML = '';
  document.getElementById('sens-markers-mi').innerHTML = '';
  sensMcount = 0;
}


/* ==== GRAVAR + PDF ==== */
(function(){
  function toast(msg, ok) {
    var t = document.getElementById('gc-toast');
    if (!t) return;
    t.textContent = msg;
    t.style.background = ok ? '#0f6e56' : '#b91c1c';
    t.classList.add('show');
    setTimeout(function(){ t.classList.remove('show'); }, 2800);
  }

  function serialize() {
    var d = {};
    document.querySelectorAll('input,select,textarea').forEach(function(el, i) {
      var k = el.id || el.name || ('f'+i);
      if (el.type === 'radio' || el.type === 'checkbox') {
        d[k + '_' + i] = el.checked;
      } else {
        d[k] = el.value;
      }
    });
    return d;
  }

  function restore(d) {
    if (!d) return;
    document.querySelectorAll('input,select,textarea').forEach(function(el, i) {
      var k = el.id || el.name || ('f'+i);
      if (el.type === 'radio' || el.type === 'checkbox') {
        var v = d[k + '_' + i];
        if (v !== undefined) el.checked = v;
      } else {
        if (d[k] !== undefined) el.value = d[k];
      }
    });
  }

  function gravar() {
    try {
      var pid = window._gcPatientId || 'draft';
      var data = serialize();
      localStorage.setItem('gc_neuro_' + pid, JSON.stringify(data));
      window.parent.postMessage({ type:'gc_neuro_save', patientId:pid, data:data, ts:new Date().toISOString() }, '*');
      toast('Guardado', true);
    } catch(e) {
      toast('Erro: ' + e.message, false);
    }
  }

  function exportPdf() {
    window.print();
  }

  // Ligar botões
  var bs = document.getElementById('gc-save-btn');
  var bp = document.getElementById('gc-pdf-btn');
  if (bs) bs.addEventListener('click', gravar);
  if (bp) bp.addEventListener('click', exportPdf);

  // Receber patientId e restaurar
  window.addEventListener('message', function(ev) {
    if (ev.data && ev.data.type === 'gc_set_patient') {
      window._gcPatientId = ev.data.patientId;
      try {
        var raw = localStorage.getItem('gc_neuro_' + ev.data.patientId);
        if (raw) restore(JSON.parse(raw));
      } catch(e) {}
    }
  });
})();

</script>

// Dados dermatomais aproximados por posição relativa (x%,y%) por mapa
// Usado para tooltip informativo
var dermMS = [
  // Ventral (x 0-50%)
  {x1:0,x2:50,y1:0,y2:25,label:'N. axilar / Supraclavicular'},
  {x1:0,x2:20,y1:25,y2:60,label:'N. radial (ventral)'},
  {x1:5,x2:25,y1:55,y2:100,label:'N. mediano / N. cutâneo lat. antebraço'},
  {x1:20,x2:45,y1:25,y2:65,label:'N. cutâneo medial braço / antebraço'},
  {x1:30,x2:50,y1:60,y2:100,label:'N. ulnar / N. mediano (mão)'},
  // Dorsal (x 50-100%)
  {x1:50,x2:100,y1:0,y2:25,label:'N. axilar / N. supraescapular'},
  {x1:50,x2:75,y1:25,y2:65,label:'N. radial (dorsal)'},
  {x1:75,x2:100,y1:25,y2:65,label:'N. cutâneo medial braço (dorsal)'},
  {x1:50,x2:75,y1:65,y2:100,label:'N. radial / N. cutâneo lat. antebraço (dorsal)'},
  {x1:75,x2:100,y1:65,y2:100,label:'N. ulnar / N. mediano (dorso mão)'},
];

var dermMI = [
  // Anterior (x 0-50%)
  {x1:0,x2:50,y1:0,y2:15,label:'T12 / L1 — Ilioinguinal / Iliohipogástrico'},
  {x1:0,x2:25,y1:15,y2:45,label:'L2-L3 — N. cutâneo femoral lat.'},
  {x1:25,x2:50,y1:15,y2:45,label:'L2-L3 — N. femoral anterior'},
  {x1:0,x2:25,y1:45,y2:70,label:'L3-L4 — Safeno / N. cutâneo medial crural'},
  {x1:25,x2:50,y1:45,y2:70,label:'L4-S2 — N. peroneal lat. sural'},
  {x1:0,x2:25,y1:70,y2:90,label:'L4-S1 — N. peroneal superficial'},
  {x1:25,x2:50,y1:70,y2:90,label:'L2-S2 — N. sural / lat. dorsal cut.'},
  {x1:5,x2:45,y1:90,y2:100,label:'L4-S2 — N. peroneal profundo / calcâneos'},
  // Posterior (x 50-100%)
  {x1:50,x2:100,y1:0,y2:12,label:'L1-L3 — Cluneal superior / médio'},
  {x1:50,x2:100,y1:12,y2:45,label:'S1-S3 — N. cutâneo femoral posterior'},
  {x1:50,x2:75,y1:45,y2:70,label:'L4-S2 — N. peroneal lat. sural (posterior)'},
  {x1:75,x2:100,y1:45,y2:70,label:'S1-S2 — N. sural / medial sural cut.'},
  {x1:50,x2:100,y1:70,y2:90,label:'S1-S2 — N. sural / calcâneos'},
  {x1:50,x2:100,y1:90,y2:100,label:'S1-S2 — N. plantar lat. / calcâneos'},
];

function selSens(el) {
  document.querySelectorAll('.sens-leg').forEach(i => i.classList.remove('act'));
  el.classList.add('act');
  sensCurType = el.dataset.stype;
  sensCurColor = el.dataset.scolor;
  sensCurOpacity = parseFloat(el.dataset.sopacity);
}



</script>`;
    const blob = new Blob([htmlContent], { type: "text/html" });
    const blobUrl = URL.createObjectURL(blob);

    const overlay = document.createElement("div");
    overlay.id = "gcNeuroModal";
    Object.assign(overlay.style, {
      position: "fixed", inset: "0", background: "rgba(0,0,0,0.55)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "12px", zIndex: "3100",
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif"
    });

    const bar = document.createElement("div");
    Object.assign(bar.style, {
      width: "min(1200px, 100%)", background: "#fff",
      borderRadius: "12px 12px 0 0", borderBottom: "1px solid #e2e8f0",
      padding: "12px 18px", display: "flex",
      justifyContent: "space-between", alignItems: "center", flexShrink: "0"
    });
    bar.innerHTML = `<div style="font-weight:700;font-size:15px;color:#0f172a;">🧠 Relatório Neurológico — MFR</div>
      <button id="gcNeuroClose" style="border:1px solid #e2e8f0;background:#fff;border-radius:8px;padding:6px 14px;cursor:pointer;font-size:13px;color:#475569;">✕ Fechar</button>`;

    const frame = document.createElement("iframe");
    frame.src = blobUrl;
    Object.assign(frame.style, {
      width: "min(1200px, 100%)",
      height: "calc(92vh - 52px)",
      border: "none", background: "#fff",
      borderRadius: "0 0 12px 12px", flexShrink: "0"
    });

    // Libertar Blob URL quando o modal fechar
    function closeNeuro() {
      URL.revokeObjectURL(blobUrl);
      overlay.remove();
    }

    overlay.appendChild(bar);
    overlay.appendChild(frame);
    document.body.appendChild(overlay);

    // Passar patientId ao iframe quando estiver pronto
    frame.addEventListener("load", () => {
      try {
        frame.contentWindow.postMessage({ type: "gc_set_patient", patientId: p?.id || null }, "*");
      } catch(_) {}
    });

    // Receber dados gravados do iframe
    function onNeuroMessage(ev) {
      if (!ev.data || ev.data.type !== "gc_neuro_save") return;
      const payload = ev.data;
      // Guardar em Supabase na tabela patient_documents (ou similar)
      (async () => {
        try {
          const { error } = await window.sb
            .from("patient_documents")
            .upsert({
              patient_id: p?.id,
              doc_type: "relatorio_neurologico",
              content: JSON.stringify(payload.data),
              updated_at: payload.ts
            }, { onConflict: "patient_id,doc_type" });
          if (error) console.error("Erro ao guardar relatório neurológico:", error);
          else console.log("Relatório neurológico guardado no Supabase");
        } catch(e) {
          console.error("Erro Supabase relatório neurológico:", e);
        }
      })();
    }
    window.addEventListener("message", onNeuroMessage);

    document.getElementById("gcNeuroClose").addEventListener("click", closeNeuro);
    overlay.addEventListener("click", (ev) => { if (ev.target === overlay) closeNeuro(); });

    // Limpar listener ao fechar
    function closeNeuroFull() {
      window.removeEventListener("message", onNeuroMessage);
      closeNeuro();
    }
    document.getElementById("gcNeuroClose").removeEventListener("click", closeNeuro);
    document.getElementById("gcNeuroClose").addEventListener("click", closeNeuroFull);
  }


  /* ====================================================================
     PRP TENDINOPATIA — Modal de preenchimento
     ==================================================================== */
  function openPrpTendinopatiaModal({ clinic, locality, vinhetaUrl, websiteHtml, phoneHtml, patientBlock, footer, sharedStyles }) {
    // Remove modal anterior
    document.getElementById("gcPrpModal")?.remove();

    const overlay = document.createElement("div");
    overlay.id = "gcPrpModal";
    Object.assign(overlay.style, {
      position: "fixed", inset: "0", background: "rgba(0,0,0,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "16px", zIndex: "3100",
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif"
    });

    overlay.innerHTML = `
      <div style="background:#fff;width:min(780px,100%);max-height:92vh;overflow-y:auto;
                  border-radius:14px;border:1px solid #e2e8f0;padding:24px;">

        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
          <div style="font-weight:900;font-size:16px;">PRP — Tendinopatia<br>
            <span style="font-size:12px;font-weight:400;color:#64748b;">Preencha os campos antes de gerar o relatório</span>
          </div>
          <button id="gcPrpClose" style="border:1px solid #e2e8f0;background:#fff;border-radius:8px;padding:6px 14px;cursor:pointer;font-size:13px;">Cancelar</button>
        </div>

        <!-- DIAGNÓSTICO -->
        <div style="margin-bottom:14px;">
          <label style="font-weight:700;font-size:13px;display:block;margin-bottom:4px;">Diagnóstico / Localização</label>
          <input id="prpDiag" type="text" placeholder="ex: Tendinopatia da coifa dos rotadores, tendão de Aquiles, epicondilite lateral..."
            style="width:100%;padding:9px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;box-sizing:border-box;" />
        </div>

        <div style="margin-bottom:14px;">
          <label style="font-weight:700;font-size:13px;display:block;margin-bottom:4px;">Achados imagiológicos (Ecografia / RM)</label>
          <input id="prpImag" type="text" placeholder="ex: Tendinose com fibrilhação no 1/3 médio, sem rotura completa"
            style="width:100%;padding:9px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;box-sizing:border-box;" />
        </div>

        <!-- HDA -->
        <div style="margin-bottom:14px;">
          <label style="font-weight:700;font-size:13px;display:block;margin-bottom:4px;">Anamnese / História Clínica (HDA)</label>
          <textarea id="prpHda" rows="5" placeholder="Escreva ou cole aqui a história clínica do doente..."
            style="width:100%;padding:9px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;resize:vertical;box-sizing:border-box;line-height:1.5;"></textarea>
        </div>

        <!-- EVA -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
          <div>
            <label style="font-weight:700;font-size:13px;display:block;margin-bottom:4px;">EVA Repouso (0–10)</label>
            <input id="prpEvaR" type="number" min="0" max="10" placeholder="ex: 3"
              style="width:100%;padding:9px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;box-sizing:border-box;" />
          </div>
          <div>
            <label style="font-weight:700;font-size:13px;display:block;margin-bottom:4px;">EVA Actividade (0–10)</label>
            <input id="prpEvaA" type="number" min="0" max="10" placeholder="ex: 7"
              style="width:100%;padding:9px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;box-sizing:border-box;" />
          </div>
        </div>

        <!-- TRATAMENTOS -->
        <div style="margin-bottom:14px;">
          <label style="font-weight:700;font-size:13px;display:block;margin-bottom:8px;">Tratamentos Conservadores Realizados</label>

          <div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:10px;">

            <div style="display:flex;align-items:center;gap:10px;">
              <input type="checkbox" id="trtFisio" checked style="width:16px;height:16px;flex-shrink:0;" />
              <label for="trtFisio" style="font-size:13px;flex:1;">Programa de reabilitação estruturado (exercício excêntrico, agentes físicos)</label>
              <input id="trtFisioDetalhe" type="text" placeholder="sessões / duração"
                style="width:160px;padding:6px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;" />
            </div>

            <div style="display:flex;align-items:center;gap:10px;">
              <input type="checkbox" id="trtAines" checked style="width:16px;height:16px;flex-shrink:0;" />
              <label for="trtAines" style="font-size:13px;flex:1;">Anti-inflamatórios não esteroides (AINEs)</label>
              <select id="trtAinesTipo" style="padding:6px 8px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;">
                <option value="Tópicos e Orais">Tópicos e Orais</option>
                <option value="Tópicos">Tópicos</option>
                <option value="Orais">Orais</option>
                <option value="Orais e IM">Orais e IM</option>
                <option value="Tópicos, Orais e IM">Tópicos, Orais e IM</option>
              </select>
            </div>

            <div style="display:flex;align-items:center;gap:10px;">
              <input type="checkbox" id="trtCort" style="width:16px;height:16px;flex-shrink:0;" />
              <label for="trtCort" style="font-size:13px;flex:1;">Corticoterapia local</label>
              <input id="trtCortDetalhe" type="text" placeholder="nº infiltrações / datas"
                style="width:160px;padding:6px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;" />
            </div>

            <div style="display:flex;align-items:center;gap:10px;">
              <input type="checkbox" id="trtRepouso" checked style="width:16px;height:16px;flex-shrink:0;" />
              <label for="trtRepouso" style="font-size:13px;flex:1;">Repouso relativo / modificação da actividade</label>
              <input id="trtRepousoDetalhe" type="text" placeholder="duração"
                style="width:160px;padding:6px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;" />
            </div>

            <div style="display:flex;align-items:center;gap:10px;">
              <input type="checkbox" id="trtEswt" style="width:16px;height:16px;flex-shrink:0;" />
              <label for="trtEswt" style="font-size:13px;flex:1;">Ondas de Choque Extracorpóreas (ESWT)</label>
              <input id="trtEswtDetalhe" type="text" placeholder="nº sessões / datas"
                style="width:160px;padding:6px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;" />
            </div>

            <div style="display:flex;align-items:center;gap:10px;">
              <input type="checkbox" id="trtOutros" style="width:16px;height:16px;flex-shrink:0;" />
              <label for="trtOutros" style="font-size:13px;flex:1;">Outros</label>
              <input id="trtOutrosDetalhe" type="text" placeholder="descrever"
                style="width:160px;padding:6px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;" />
            </div>

          </div>
        </div>

        <!-- SESSÕES PRP -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
          <div>
            <label style="font-weight:700;font-size:13px;display:block;margin-bottom:4px;">Nº de aplicações de PRP</label>
            <select id="prpSessoes" style="width:100%;padding:9px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;">
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="1 a 3" selected>1 a 3</option>
              <option value="3">3</option>
            </select>
          </div>
          <div>
            <label style="font-weight:700;font-size:13px;display:block;margin-bottom:4px;">Intervalo entre sessões</label>
            <select id="prpIntervalo" style="width:100%;padding:9px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;">
              <option value="3 a 4 semanas">3 a 4 semanas</option>
              <option value="4 semanas" selected>4 semanas</option>
              <option value="4 a 6 semanas">4 a 6 semanas</option>
              <option value="6 semanas">6 semanas</option>
            </select>
          </div>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:10px;">
          <button id="gcPrpClose2" style="border:1px solid #e2e8f0;background:#fff;border-radius:8px;padding:9px 20px;cursor:pointer;font-size:13px;">Cancelar</button>
          <button id="gcPrpGerar" style="border:none;background:#1e3a8a;color:#fff;border-radius:8px;padding:9px 24px;cursor:pointer;font-size:13px;font-weight:700;">
            Gerar Relatório →
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const closeModal = () => document.getElementById("gcPrpModal")?.remove();
    document.getElementById("gcPrpClose")?.addEventListener("click", closeModal);
    document.getElementById("gcPrpClose2")?.addEventListener("click", closeModal);

    document.getElementById("gcPrpGerar")?.addEventListener("click", () => {
      const diag      = document.getElementById("prpDiag")?.value?.trim() || "[localização]";
      const imag      = document.getElementById("prpImag")?.value?.trim() || "[achados imagiológicos]";
      const hda       = (document.getElementById("prpHda")?.value?.trim() || "").replace(/\n/g, "<br>");
      const evaR      = document.getElementById("prpEvaR")?.value || "—";
      const evaA      = document.getElementById("prpEvaA")?.value || "—";
      const sessoes   = document.getElementById("prpSessoes")?.value || "1 a 3";
      const intervalo = document.getElementById("prpIntervalo")?.value || "4 semanas";

      // Build tratamentos list
      const trts = [];
      if (document.getElementById("trtFisio")?.checked) {
        const d = document.getElementById("trtFisioDetalhe")?.value?.trim();
        trts.push(`Programa de reabilitação estruturado, com exercício excêntrico, agentes físicos${d ? " — " + escAttr(d) : ""}`);
      }
      if (document.getElementById("trtAines")?.checked) {
        const tipo = document.getElementById("trtAinesTipo")?.value || "Tópicos e Orais";
        trts.push(`Anti-inflamatórios não esteroides (AINEs) — ${escAttr(tipo)}`);
      }
      if (document.getElementById("trtCort")?.checked) {
        const d = document.getElementById("trtCortDetalhe")?.value?.trim();
        trts.push(`Corticoterapia local${d ? " — " + escAttr(d) : ""}`);
      }
      if (document.getElementById("trtRepouso")?.checked) {
        const d = document.getElementById("trtRepousoDetalhe")?.value?.trim();
        trts.push(`Repouso relativo / modificação da actividade${d ? " — " + escAttr(d) : ""}`);
      }
      if (document.getElementById("trtEswt")?.checked) {
        const d = document.getElementById("trtEswtDetalhe")?.value?.trim();
        trts.push(`Ondas de Choque Extracorpóreas (ESWT)${d ? " — " + escAttr(d) : ""}`);
      }
      if (document.getElementById("trtOutros")?.checked) {
        const d = document.getElementById("trtOutrosDetalhe")?.value?.trim();
        if (d) trts.push(escAttr(d));
      }

      const trtHtml = trts.map(t => `<li style="margin-bottom:4px;">${t}</li>`).join("");

      const hdaHtml = hda
        ? `<p>${hda}</p>`
        : `<p>Queixas com evolução de <span style="color:#1e40af;">[duração]</span>, com dor localizada a <span style="color:#1e40af;">[localização anatómica]</span>, de características mecânicas, com agravamento à <span style="color:#1e40af;">[actividade]</span>. Impacto funcional significativo nas actividades de vida diária.</p>`;

      const vinhetaTag = vinhetaUrl
        ? `<img style="width:4cm;height:2.5cm;object-fit:contain;display:block;margin-top:8px;" src="${vinhetaUrl}" />`
        : "";

      const html = `<!doctype html><html><head><meta charset="utf-8"/><title>PRP — Tendinopatia</title>
      <style>${sharedStyles}
        .ref { font-size:12px; color:#475569; line-height:1.6; }
        .ref li { margin-bottom:4px; }
        .evid { background:#f0f9ff; border-left:3px solid #0ea5e9; padding:10px 14px; border-radius:0 6px 6px 0; margin:10px 0; font-size:13.5px; }
      </style></head><body><div class="a4">
        <div class="top">
          <div class="topLeft"><div>${websiteHtml}</div><div>${phoneHtml}</div></div>
        </div>
        <div class="hr"></div>
        <div class="title">Relatório Médico — Pedido de Autorização de Reembolso</div>
        <div style="text-align:center;font-size:13px;color:#64748b;margin-bottom:12px;">Aplicação de Plasma Rico em Plaquetas (PRP) — Tendinopatia</div>
        ${patientBlock}

        <div class="section">
          <div class="stitle">Diagnóstico</div>
          <p>O/A doente apresenta <b>${escAttr(diag)}</b>, confirmada clinicamente e por imagiologia: ${escAttr(imag)}.</p>
        </div>

        <div class="section">
          <div class="stitle">Anamnese / História Clínica</div>
          ${hdaHtml}
          <p>Escala de dor EVA: <b>${escAttr(evaR)}</b> em repouso e <b>${escAttr(evaA)}</b> em actividade.</p>
        </div>

        <div class="section">
          <div class="stitle">Tratamentos Conservadores Realizados (sem resposta adequada)</div>
          <ul style="margin:8px 0 0 18px;padding:0;line-height:1.8;">${trtHtml}</ul>
        </div>

        <div class="section">
          <div class="stitle">Justificação Clínica e Evidência Científica para PRP</div>
          <p>Face à ausência de resposta satisfatória aos tratamentos conservadores optimizados,
          propõe-se a aplicação de <b>Plasma Rico em Plaquetas (PRP)</b> — terapêutica biológica
          autóloga, regenerativa, que actua através da libertação de factores de crescimento
          (PDGF, TGF-β, IGF-1, VEGF) com efeito angiogénico, anti-inflamatório e de estimulação
          da síntese de colagénio tendinoso.</p>
          <div class="evid">A evidência científica actual suporta o uso de PRP em tendinopatias crónicas refratárias
          ao tratamento conservador, com benefício sustentado na redução da dor e melhoria funcional
          aos 6 e 12 meses de seguimento.</div>
          <p style="margin-top:10px;font-size:13.5px;"><b>Referências bibliográficas de suporte:</b></p>
          <ol class="ref">
            <li><b>Fitzpatrick J et al.</b> — <em>The Effectiveness of Platelet-Rich Plasma in the Treatment of Tendinopathy: A Meta-analysis of Randomized Controlled Clinical Trials.</em> Am J Sports Med. 2017. — Meta-análise de 18 RCTs (1066 doentes): LR-PRP guiado por ecografia demonstrou eficácia superior; efeito positivo fortemente significativo na redução da dor.</li>
            <li><b>Vij N et al.</b> — <em>Platelet-Rich Plasma as a Treatment for Chronic Noncancer Pain.</em> Pain Ther. 2025. — PRP reduziu significativamente a dor vs. corticosteróides (SMD −0.53, p=0.02) e ácido hialurónico (SMD −0.55, p=0.004), com benefício sustentado ≥3 meses.</li>
            <li><b>Azadvari M et al.</b> — <em>PRP injections as second-line treatment in chronic tendinopathy failing conservative treatment.</em> Pain Medicine. 2024. — 9 RCTs, 488 doentes: redução da dor aos 6 meses (MD −0.83) e 12 meses (MD −1.11) vs. controlo.</li>
            <li><b>Georgetown Medical Review. 2024.</b> — <em>Evaluating Efficacy of PRP versus Corticosteroids in Management of Tendinopathies.</em> PRP superior a longo prazo; menos efeitos adversos e maior custo-efectividade.</li>
            <li><b>Kale et al.</b> — <em>Mechanisms, Efficacy, and Clinical Applications of PRP in Tendinopathy.</em> PMC / Cureus. 2024. — PRP promove síntese de colagénio tipo I e redução da degeneração tendinosa.</li>
          </ol>
          <p style="margin-top:12px;">Está prevista a realização de <b>${escAttr(sessoes)}</b> aplicação(ões) de PRP, sob orientação ecográfica, com intervalo de <b>${escAttr(intervalo)}</b> entre sessões, associada a programa de reabilitação supervisionada.</p>
        </div>

        <div class="section">
          <div class="stitle">Conclusão</div>
          <p>Solicita-se autorização de reembolso da aplicação de Plasma Rico em Plaquetas (PRP)
          em <b>${escAttr(diag)}</b> — doente sem resposta ao tratamento conservador optimizado,
          com suporte em evidência científica de nível I-II (meta-análises de RCTs, 2024–2025),
          com perfil de segurança favorável e ausência de efeitos adversos major documentados.</p>
        </div>

        <div class="footerBlock">
          <div class="hr2"></div>
          <div class="footRow">
            <div><div class="web">${websiteHtml}</div>${vinhetaTag}</div>
            <div style="flex:1;">
              <div class="locDate">${locality}</div>
              <div class="sig"><div class="sigBox">
                <div class="sigLine"></div>
                <div class="sigName">Dr. João Morais</div>
                <div class="sigRole">Médico Fisiatra</div>
                <div class="sigRole">Sports Medicine &amp; Rehabilitation</div>
              </div></div>
            </div>
          </div>
        </div>
      </div></body></html>`;

      closeModal();
      openDocumentEditor(html, "PRP — Tendinopatia");
    });
  }

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
