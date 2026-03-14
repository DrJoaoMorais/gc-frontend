/**
 * exames.js — Passo 7
 * BLOCO 12A–12G: Catálogo de exames complementares, painel lateral,
 *                lista por grupo, pedido de exame e geração de HTML para PDF
 * Extraído de app.js blocos 12A, 12B, 12C, 12D, 12E, 12F, 12G
 *
 * Globals consumidas (expostas em app.js via window.__gc_*):
 *   window.sb                     — Supabase client
 *   window.__gc_storageSignedUrl  — helper de URL assinado
 *   window.__gc_urlToDataUrl      — helper base64
 *   window.__gc_VINHETA_BUCKET    — bucket Supabase Storage ("clinic-private")
 *   window.__gc_VINHETA_PATH      — caminho vinheta
 *   window.openDocumentEditor     — abre editor Quill/PDF (exportado de pdf.js)
 *   window.__gc_pendingExamCtx    — contexto gravado antes de abrir editor
 */

/* ====================================================================
   BLOCO 12A — Catálogo de exames (load + pesquisa)
   ==================================================================== */

/**
 * loadExamsCatalog
 * Carrega todos os exames activos da tabela `exams_catalog`, ordenados por sort_order.
 * @returns {Promise<Array>}
 */
export async function loadExamsCatalog() {
  try {
    const { data, error } = await window.sb
      .from("exams_catalog")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error("Erro ao carregar catálogo de exames:", err);
    return [];
  }
}

/**
 * searchExams
 * Filtra array de exames pelo query (exam_name, body_region, search_terms, category).
 * @param {Array}  exams
 * @param {string} query
 * @returns {Array}
 */
export function searchExams(exams, query) {
  if (!query || !query.trim()) return exams;
  const q = query.toLowerCase();
  return exams.filter(e =>
    (e.exam_name    && e.exam_name.toLowerCase().includes(q))    ||
    (e.body_region  && e.body_region.toLowerCase().includes(q))  ||
    (e.search_terms && e.search_terms.toLowerCase().includes(q)) ||
    (e.category     && e.category.toLowerCase().includes(q))
  );
}

/* ====================================================================
   BLOCO 12B — Estado do painel de exames
   ==================================================================== */

export const examsUiState = {
  isOpen:              false,
  query:               "",
  exams:               [],
  selectedGroup:       "",
  selectedExamId:      "",
  selectedExams:       [],   /* lista de exam IDs seleccionados */
  clinicalInfo:        "",   /* @deprecated — substituído por clinicalInfoByExam */
  clinicalInfoByExam:  {},   /* { [examId]: string } — info clínica por exame */
  examDate:            "",   /* data do pedido, editável, default hoje */
  patientId:           "",
  consultationId:      null,
  mode:                "groups"
};

/* ====================================================================
   BLOCO 12C — Abertura / fecho do painel
   ==================================================================== */

/**
 * openExamsPanel
 * Abre o painel lateral de pedidos de exames dentro do modal de doente.
 * @param {{ patientId?: string, consultationId?: string|null }} opts
 */
export function openExamsPanel(opts = {}) {
  const prevPatient = examsUiState.patientId;
  examsUiState.isOpen         = true;
  examsUiState.patientId      = String(opts?.patientId     || examsUiState.patientId || "");
  examsUiState.consultationId = opts?.consultationId       || null;
  examsUiState.__onClose      = opts?.onClose              || null;
  /* Limpar selecções ao mudar de doente */
  if (prevPatient && prevPatient !== examsUiState.patientId) {
    examsUiState.selectedExams       = [];
    examsUiState.clinicalInfoByExam  = {};
    examsUiState.examDate            = "";
    examsUiState.clinicalInfo        = "";
    examsUiState.selectedExamId      = "";
    examsUiState.selectedGroup       = "";
    examsUiState.mode                = "groups";
  }
  renderExamsPanel();
}

/**
 * closeExamsPanel
 * Remove o painel do DOM.
 */
export function closeExamsPanel() {
  examsUiState.isOpen = false;
  const panel = document.getElementById("gcExamsPanel");
  if (panel) panel.remove();
  if (typeof examsUiState.__onClose === "function") {
    examsUiState.__onClose();
    examsUiState.__onClose = null;
  }
}

/**
 * renderExamsPanel (interno)
 * Cria o painel lateral e insere-o no host do modal de doente.
 */
function renderExamsPanel() {
  if (!examsUiState.isOpen) return;

  const oldPanel = document.getElementById("gcExamsPanel");
  if (oldPanel) oldPanel.remove();

  const btnClose = document.getElementById("btnClosePView");
  if (!btnClose) {
    console.error("Botão btnClosePView não encontrado para o painel de exames.");
    return;
  }

  /* Sobe na árvore DOM até encontrar o container branco grande com scroll */
  let host = btnClose.parentElement;
  while (host && host.parentElement) {
    const style          = window.getComputedStyle(host);
    const hasWhiteBg     = style.backgroundColor === "rgb(255, 255, 255)";
    const hasLargeBox    = host.clientWidth >= 900 && host.clientHeight >= 500;
    const hasScrollable  = style.overflow === "auto" || style.overflowY === "auto";
    if (hasWhiteBg && hasLargeBox && hasScrollable) break;
    host = host.parentElement;
  }

  if (!host) {
    console.error("Host do modal do doente não encontrado para o painel de exames.");
    return;
  }

  host.style.position = "relative";

  const panel     = document.createElement("div");
  panel.id        = "gcExamsPanel";
  Object.assign(panel.style, {
    position:             "absolute",
    top:                  "0",
    right:                "0",
    width:                "420px",
    height:               "100%",
    background:           "#ffffff",
    borderLeft:           "1px solid #e5e7eb",
    boxShadow:            "-8px 0 24px rgba(0,0,0,0.08)",
    zIndex:               "50",
    display:              "flex",
    flexDirection:        "column",
    borderTopRightRadius: "14px",
    borderBottomRightRadius: "14px"
  });

  panel.innerHTML = `
    <div style="padding:16px; border-bottom:1px solid #e5e7eb; display:flex; justify-content:space-between; align-items:center;">
      <div style="font-weight:800; font-size:16px; color:#111827;">Pedidos de Exames</div>
      <button id="gcCloseExamsPanel" class="gcBtn"
        style="background:#ffffff; border:1px solid #d1d5db; color:#111827; font-weight:700;">
        Fechar
      </button>
    </div>

    <div style="padding:12px 16px; border-bottom:1px solid #f1f5f9;">
      <input id="gcExamSearch" type="text" placeholder="Pesquisar exame..."
        style="width:100%; padding:10px 12px; border:1px solid #cbd5e1; border-radius:8px;
               font-size:14px; box-sizing:border-box;">
    </div>

    <div id="gcExamResults" style="flex:1; overflow:auto; padding:16px;"></div>

    <div id="gcExamSelBarFooter" style="
      border-top:1px solid #e5e7eb;
      background:#f8fafc;
      padding:10px 14px;
      flex-shrink:0;
      display:none;">
    </div>
  `;

  host.appendChild(panel);
  loadAndRenderExams();

  document.getElementById("gcCloseExamsPanel")?.addEventListener("click", closeExamsPanel);

  /* Pesquisa — filtra em tempo real sobre todos os exames */
  document.getElementById("gcExamSearch")?.addEventListener("input", (ev) => {
    const q = String(ev.target?.value || "").trim();
    if (!q) {
      examsUiState.mode          = "groups";
      examsUiState.selectedGroup = "";
      renderExamGroups();
      return;
    }

    const all       = examsUiState.exams || [];
    const results   = searchExams(all, q);
    const sel       = examsUiState.selectedExams || [];
    const container = document.getElementById("gcExamResults");
    if (!container) return;

    if (!results.length) {
      container.innerHTML = `<div style="color:#64748b;font-size:13px;padding:8px 0;">Sem resultados para "${q}"</div>`;
      renderSelectedBar();
      return;
    }

    let html = `<div style="font-size:11px;font-weight:800;letter-spacing:0.6px;color:#64748b;text-transform:uppercase;margin-bottom:8px;">Resultados</div>`;
    results.forEach(exam => {
      /* Mostrar o grupo como subtítulo dentro do renderExamRow */
      const grpLabel = getExamGroupLabel(exam) || "";
      html += renderExamRow(exam, sel, grpLabel);
    });
    container.innerHTML = html;
    renderSelectedBar();

    /* Re-render dos resultados ao fazer toggle — reutiliza o mesmo listener */
    bindExamRowEvents(container, () => {
      ev.target.dispatchEvent(new Event("input"));
    });
  });
}

/* ====================================================================
   BLOCO 12D — Helpers de organização dos exames
   ==================================================================== */

function getExamGroupLabel(exam) {
  const category    = String(exam?.category    || "").trim();
  const subcategory = String(exam?.subcategory || "").trim();

  if (category === "Ecografia" && subcategory === "Osteoarticular") return "Ecografia Osteoarticular";
  if (category === "Ecografia" && subcategory === "Partes Moles")   return "Ecografia Partes Moles";
  if (category === "Radiografia")                                   return "Radiografia";
  if (category === "Ressonância Magnética")                         return "Ressonância Magnética";
  if (category === "Tomografia Computorizada")                      return "Tomografia Computorizada";
  if (category === "Densitometria Óssea")                           return "Densitometria Óssea";
  return "";
}

function listExamGroups(exams) {
  const wantedOrder = [
    "Ecografia Osteoarticular",
    "Ecografia Partes Moles",
    "Radiografia",
    "Ressonância Magnética",
    "Tomografia Computorizada",
    "Densitometria Óssea"
  ];
  const found = new Set();
  (exams || []).forEach(exam => {
    if (exam?.is_direct === true) return;
    const label = getExamGroupLabel(exam);
    if (label) found.add(label);
  });
  return wantedOrder.filter(label => found.has(label));
}

function listDirectExams(exams) {
  return (exams || [])
    .filter(exam => exam?.is_direct === true)
    .sort((a, b) => Number(a?.sort_order || 0) - Number(b?.sort_order || 0));
}

function listGroupedExams(exams, groupLabel) {
  return (exams || [])
    .filter(exam => exam?.is_direct !== true && getExamGroupLabel(exam) === groupLabel)
    .sort((a, b) => Number(a?.sort_order || 0) - Number(b?.sort_order || 0));
}

function getExamById(exams, examId) {
  return (exams || []).find(exam => String(exam?.id || "") === String(examId || "")) || null;
}

/* ====================================================================
   BLOCO 12E — Render do conteúdo do painel
   ==================================================================== */

function renderSelectedBar() {
  const footer  = document.getElementById("gcExamSelBarFooter");
  if (!footer) return;

  const sel   = examsUiState.selectedExams || [];
  const exams = examsUiState.exams || [];

  if (!sel.length) {
    footer.style.display = "none";
    footer.innerHTML = "";
    return;
  }

  /* Agrupar por tipo */
  const groups = {};
  sel.forEach(id => {
    const ex = getExamById(exams, id);
    if (!ex) return;
    const grp = getExamGroupLabel(ex) || ex.exam_name;
    if (!groups[grp]) groups[grp] = [];
    groups[grp].push(ex.exam_name);
  });
  const nPdfs   = Object.keys(groups).length;
  const todayIso = new Date().toISOString().slice(0, 10);
  const dateVal  = examsUiState.examDate || todayIso;

  footer.style.display = "block";
  footer.innerHTML = `
    <div style="font-size:12px;font-weight:700;color:#1a56db;margin-bottom:2px;">
      ${sel.length} exame${sel.length!==1?"s":""} → ${nPdfs} PDF${nPdfs!==1?"s":""}
    </div>
    <div style="font-size:11px;color:#64748b;margin-bottom:8px;line-height:1.5;">
      ${Object.entries(groups).map(([g, items]) => `${g} (${items.length})`).join(" · ")}
    </div>
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
      <label style="font-size:11px;font-weight:700;color:#334155;white-space:nowrap;">Data do pedido:</label>
      <input type="date" id="gcExamFooterDate" value="${dateVal}"
        style="flex:1;padding:5px 8px;border:1px solid #cbd5e1;border-radius:6px;
               font-size:12px;font-family:inherit;color:#0f172a;background:#fff;cursor:pointer;">
    </div>
    <div style="display:flex;gap:8px;">
      <button id="gcExamClearSel" class="gcBtn"
        style="font-size:12px;background:#fff;border:1px solid #e5e7eb;color:#64748b;flex-shrink:0;">
        Limpar
      </button>
      <button id="gcExamGenPdfs" class="gcBtn"
        style="font-size:12px;background:#1a56db;border:1px solid #1a56db;color:#fff;font-weight:700;flex:1;text-align:center;">
        Gerar ${nPdfs} PDF${nPdfs!==1?"s":""}  →
      </button>
    </div>`;

  footer.querySelector("#gcExamFooterDate")?.addEventListener("change", ev => {
    examsUiState.examDate = String(ev.target?.value || "");
  });

  footer.querySelector("#gcExamClearSel")?.addEventListener("click", () => {
    examsUiState.selectedExams      = [];
    examsUiState.clinicalInfoByExam = {};
    examsUiState.examDate           = "";
    renderExamGroups();
  });

  footer.querySelector("#gcExamGenPdfs")?.addEventListener("click", () => {
    /* Guardar infos clínicas dos textareas antes de gerar */
    document.querySelectorAll("textarea[data-exam-info-id]").forEach(ta => {
      const id = ta.getAttribute("data-exam-info-id");
      if (id) examsUiState.clinicalInfoByExam[id] = ta.value;
    });
    examsUiState.examDate = document.getElementById("gcExamFooterDate")?.value || examsUiState.examDate;
    openExamClinicalInfoStep();
  });
}

/* ====================================================================
   BLOCO 12E.1 — Helpers de render de linha de exame com caixa inline
   ==================================================================== */

/**
 * renderExamRow — HTML de uma linha de exame com checkbox.
 * Se seleccionado, mostra imediatamente a caixa de info clínica inline.
 */
function renderExamRow(exam, sel, groupSubtitle) {
  const isSel     = sel.includes(exam.id);
  const savedInfo = isSel ? (examsUiState.clinicalInfoByExam[exam.id] || "") : "";

  return `
    <div class="gcExamRowWrap" data-exam-wrap-id="${exam.id}"
      style="border:1px solid ${isSel ? '#1a56db' : '#e2e8f0'};border-radius:8px;
             margin-bottom:8px;overflow:hidden;background:${isSel ? '#eff6ff' : '#ffffff'};">
      <label style="display:flex;align-items:center;gap:10px;padding:10px 12px;
                    cursor:pointer;user-select:none;">
        <input type="checkbox" data-exam-id="${exam.id}" ${isSel ? "checked" : ""}
          style="width:15px;height:15px;accent-color:#1a56db;flex-shrink:0;cursor:pointer;">
        <div>
          <div style="font-size:13px;font-weight:${isSel ? '700' : '500'};color:#0f172a;line-height:1.4;">
            ${exam.exam_name}
          </div>
          ${groupSubtitle ? `<div style="font-size:11px;color:#94a3b8;margin-top:1px;">${groupSubtitle}</div>` : ""}
        </div>
      </label>
      ${isSel ? `
        <div style="padding:0 12px 10px 37px;">
          <textarea
            data-exam-info-id="${exam.id}"
            placeholder="Informação clínica para este exame…"
            style="width:100%;min-height:64px;padding:8px 10px;
                   border:1px solid #bcd4f5;border-radius:7px;
                   font-size:12px;line-height:1.5;resize:vertical;
                   font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                   color:#0f172a;background:#fff;box-sizing:border-box;"
          >${savedInfo}</textarea>
        </div>` : ""}
    </div>`;
}

/**
 * bindExamRowEvents — adiciona listeners de checkbox e textarea a um container.
 * @param {HTMLElement} container
 * @param {Function} rerender — função a chamar para re-render após toggle
 */
function bindExamRowEvents(container, rerender) {
  /* Guardar texto antes de re-render */
  function saveAllInfos() {
    container.querySelectorAll("textarea[data-exam-info-id]").forEach(ta => {
      const id = ta.getAttribute("data-exam-info-id");
      if (id) examsUiState.clinicalInfoByExam[id] = ta.value;
    });
  }

  container.querySelectorAll("input[data-exam-id]").forEach(cb => {
    cb.addEventListener("change", () => {
      saveAllInfos();
      const id  = cb.getAttribute("data-exam-id") || "";
      if (!id) return;
      const idx = examsUiState.selectedExams.indexOf(id);
      if (cb.checked && idx === -1) {
        examsUiState.selectedExams.push(id);
      }
      if (!cb.checked && idx !== -1) {
        examsUiState.selectedExams.splice(idx, 1);
        delete examsUiState.clinicalInfoByExam[id]; /* apagar info ao desseleccionar */
      }
      rerender();
    });
  });

  /* Guardar info clínica ao digitar (sem re-render) */
  container.querySelectorAll("textarea[data-exam-info-id]").forEach(ta => {
    ta.addEventListener("input", () => {
      const id = ta.getAttribute("data-exam-info-id");
      if (id) examsUiState.clinicalInfoByExam[id] = ta.value;
    });
  });
}

function renderExamGroups() {
  const container = document.getElementById("gcExamResults");
  if (!container) return;

  const exams  = examsUiState.exams || [];
  const groups = listExamGroups(exams);
  const direct = listDirectExams(exams);
  const sel    = examsUiState.selectedExams || [];

  let html = ``;

  if (groups.length) {
    html += `
      <div style="font-size:11px;font-weight:800;letter-spacing:0.6px;
                  color:#64748b;text-transform:uppercase;margin-bottom:8px;">
        Categorias
      </div>`;
    groups.forEach(g => {
      const countInGroup = listGroupedExams(exams, g).filter(ex => sel.includes(ex.id)).length;
      html += `
        <div class="gcExamGroup" data-group="${g}"
          style="padding:10px 12px;border:1px solid ${countInGroup ? '#1a56db' : '#e2e8f0'};
                 border-radius:8px;margin-bottom:8px;cursor:pointer;
                 font-weight:600;background:${countInGroup ? '#eff6ff' : '#ffffff'};
                 display:flex;align-items:center;justify-content:space-between;">
          <span>${g}</span>
          ${countInGroup ? `<span style="font-size:11px;font-weight:700;color:#1a56db;background:#bcd4f5;padding:2px 7px;border-radius:20px;">${countInGroup}</span>` : ""}
        </div>`;
    });
  }

  if (direct.length) {
    html += `
      <div style="font-size:11px;font-weight:800;letter-spacing:0.6px;
                  color:#64748b;text-transform:uppercase;margin-top:16px;margin-bottom:8px;">
        Exames directos
      </div>`;
    direct.forEach(exam => {
      html += renderExamRow(exam, sel);
    });
  }

  container.innerHTML = html;
  renderSelectedBar();
  bindExamRowEvents(container, () => renderExamGroups());

  container.querySelectorAll(".gcExamGroup").forEach(el => {
    el.addEventListener("click", () => {
      const groupLabel = el.getAttribute("data-group") || "";
      if (groupLabel) openExamGroup(groupLabel);
    });
  });
}

async function loadAndRenderExams() {
  try {
    const exams         = await loadExamsCatalog();
    examsUiState.exams  = exams;
    renderExamGroups();
  } catch (err) {
    console.error("Erro ao carregar exames:", err);
  }
}

/* ====================================================================
   BLOCO 12F — Lista de exames por categoria + abertura do pedido
   ==================================================================== */

function openExamGroup(groupLabel) {
  examsUiState.selectedGroup  = groupLabel;
  examsUiState.selectedExamId = "";
  examsUiState.mode           = "group";

  const exams     = examsUiState.exams || [];
  const list      = listGroupedExams(exams, groupLabel);
  const sel       = examsUiState.selectedExams || [];
  const container = document.getElementById("gcExamResults");
  if (!container) return;

  let html = `
    <div style="margin-bottom:10px;display:flex;align-items:center;gap:8px;">
      <button id="gcExamBack" class="gcBtn"
        style="background:#ffffff;border:1px solid #cbd5e1;color:#0f172a;font-weight:600;">
        ← Voltar
      </button>
      <div style="font-weight:800;color:#111827;font-size:14px;">${groupLabel}</div>
    </div>`;

  list.forEach(exam => {
    html += renderExamRow(exam, sel);
  });

  container.innerHTML = html;
  renderSelectedBar();
  bindExamRowEvents(container, () => openExamGroup(groupLabel));

  document.getElementById("gcExamBack")?.addEventListener("click", () => {
    examsUiState.mode          = "groups";
    examsUiState.selectedGroup = "";
    renderExamGroups();
  });
}

/**
 * openExamClinicalInfoStep
 * Mostra o passo de informação clínica e gera um PDF por grupo de tipo de exame.
 * Substitui openExamRequest no novo flow multi-select.
 */
/**
 * openExamClinicalInfoStep
 * Gera os PDFs agrupados por tipo usando a info clínica já guardada por exame.
 * Chamada pelo botão "Gerar N PDFs →" no footer.
 */
async function openExamClinicalInfoStep() {
  const exams = examsUiState.exams || [];
  const sel   = examsUiState.selectedExams || [];
  if (!sel.length) { renderExamGroups(); return; }

  /* Agrupar por tipo — preservar ordem de selecção */
  const groups = {};
  sel.forEach(id => {
    const ex = getExamById(exams, id);
    if (!ex) return;
    const grp = getExamGroupLabel(ex) || ex.exam_name;
    if (!groups[grp]) groups[grp] = [];
    groups[grp].push(ex);
  });

  const groupEntries = Object.entries(groups);
  const nPdfs        = groupEntries.length;

  const genBtn = document.getElementById("gcExamGenPdfs");
  if (genBtn) { genBtn.textContent = "A carregar…"; genBtn.disabled = true; }

  try {
    const patientId = String(examsUiState.patientId || "").trim();
    if (!patientId) { alert("Doente sem ID válido."); return; }

    /* Clínica */
    const { data: patientClinicRow, error: pcErr } = await window.sb
      .from("patient_clinic").select("clinic_id")
      .eq("patient_id", patientId).eq("is_active", true).single();
    if (pcErr || !patientClinicRow?.clinic_id) {
      alert("Não consegui determinar a clínica ativa do doente."); return;
    }
    const resolvedClinicId = String(patientClinicRow.clinic_id).trim();

    const { data: clinic, error: clinicErr } = await window.sb
      .from("clinics")
      .select("id, name, address_line1, address_line2, postal_code, city, phone, email, website, logo_url")
      .eq("id", resolvedClinicId).single();
    if (clinicErr || !clinic) { alert("Não consegui carregar os dados da clínica."); return; }

    /* Assets */
    const bucket    = window.__gc_VINHETA_BUCKET;
    const signedUrl = window.__gc_storageSignedUrl;
    const toDataUrl = window.__gc_urlToDataUrl;

    let vinhetaUrl = "";
    try {
      const u = await signedUrl(bucket, window.__gc_VINHETA_PATH, 3600);
      if (u) vinhetaUrl = await toDataUrl(u, "image/png");
    } catch (e) { console.warn("vinheta falhou:", e); }

    let clinicLogoUrl = "";
    try {
      const rawLogo = String(clinic?.logo_url || "").trim();
      if (rawLogo.startsWith("data:")) clinicLogoUrl = rawLogo;
      else if (rawLogo.startsWith("http://") || rawLogo.startsWith("https://"))
        clinicLogoUrl = await toDataUrl(rawLogo, "image/png");
    } catch (e) { console.warn("logo falhou:", e); }

    const examDate = examsUiState.examDate || new Date().toISOString().slice(0, 10);

    /* Construir examName com info clínica por exame para cada grupo */
    function buildExamNameForGroup(examsInGroup) {
      return examsInGroup.map(ex => {
        const info = String(examsUiState.clinicalInfoByExam[ex.id] || "").trim();
        return info ? `${ex.exam_name}\n${info}` : ex.exam_name;
      }).join("\n\n");
    }

    const firstGroup    = groupEntries[0];
    const firstGrpKey   = firstGroup[0];
    const firstExams    = firstGroup[1];
    const firstExamName = buildExamNameForGroup(firstExams);

    const html = buildExamRequestHtml({
      clinic,
      examName:     firstExamName,
      clinicalInfo: "",   /* info já embutida em examName por exame */
      examDate,
      vinhetaUrl,
      clinicLogoUrl,
      signatureUrl: ""
    });

    window.__gc_pendingExamCtx = {
      patientId,
      clinicId:       resolvedClinicId,
      consultationId: examsUiState.consultationId || null,
      examName:       firstGrpKey
    };

    if (groupEntries.length > 1) {
      window.__gc_pendingExamQueue = groupEntries.slice(1).map(([grp, items]) => ({
        grp,
        examName:     buildExamNameForGroup(items),
        clinic,
        clinicalInfo: "",
        examDate,
        vinhetaUrl,
        clinicLogoUrl,
        patientId,
        clinicId:       resolvedClinicId,
        consultationId: examsUiState.consultationId || null
      }));
    } else {
      window.__gc_pendingExamQueue = [];
    }

    window.openDocumentEditor(html, `Pedido de Exame — ${firstGrpKey}`);

  } catch (err) {
    console.error("Gerar PDF pedido de exame falhou:", err);
    alert("Erro ao gerar pedido de exame.");
    if (genBtn) { genBtn.textContent = `Gerar ${nPdfs} PDF${nPdfs!==1?"s":""}  →`; genBtn.disabled = false; }
  }
}

/**
 * openExamRequest
 * @deprecated Mantido por compatibilidade. No novo flow, usa openExamClinicalInfoStep.
 * Se chamado directamente (exame directo único), selecciona e abre o passo de info clínica.
 */
function openExamRequest(examId) {
  if (!examsUiState.selectedExams.includes(examId)) {
    examsUiState.selectedExams.push(examId);
  }
  openExamClinicalInfoStep();
}

/* ====================================================================
   BLOCO 12G — HTML do pedido de exame
   ==================================================================== */

/**
 * buildExamRequestHtml
 * Constrói o HTML A4 para o pedido de exame (usado pelo editor/PDF).
 */
export function buildExamRequestHtml({ clinic, examName, clinicalInfo, examDate, vinhetaUrl, clinicLogoUrl, signatureUrl }) {
  function escHtml(v)  { return String(v||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
  function escUrl(u)   { return String(u||"").replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  function nl2br(v)    { return escHtml(v).replace(/\n/g,"<br>"); }
  function fmtDate(d)  {
    try {
      const dt = d ? new Date(d + "T12:00:00") : new Date();
      return `${String(dt.getDate()).padStart(2,"0")}-${String(dt.getMonth()+1).padStart(2,"0")}-${dt.getFullYear()}`;
    } catch (_) { return ""; }
  }

  const locality     = String(clinic?.city || "").trim();
  const dateToUse    = examDate || new Date().toISOString().slice(0, 10);
  const localityDate = [locality, fmtDate(dateToUse)].filter(Boolean).join(", ");
  const logoSrc      = String(clinicLogoUrl || clinic?.logo_url || "").trim();

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>Pedido de Exame</title>
<style>
  body{margin:0;background:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;color:#111;}
  *{box-sizing:border-box;}
  @page{size:A4;margin:16mm;}
  .a4{width:210mm;background:#fff;}
  .top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;}
  .topLeft{font-size:13.5px;line-height:1.4;}
  .logo{width:120px;height:auto;max-height:60px;object-fit:contain;display:block;}
  .hr{height:1px;background:#111;margin:10px 0 14px 0;}
  .title{text-align:center;font-weight:900;font-size:22px;margin:2px 0 18px 0;}
  .bodyText{font-size:15px;line-height:1.45;}
  .rx{font-weight:800;margin-bottom:12px;}
  .examName{font-weight:800;font-size:18px;margin-bottom:18px;}
  .label{font-weight:800;margin-bottom:8px;}
  .clinicalInfo{min-height:180px;white-space:normal;}
  .footerBlock{margin-top:28px;page-break-inside:auto;break-inside:auto;}
  .hr2{height:1px;background:#111;margin:16px 0 10px 0;}
  .footRow{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;}
  .web{font-size:14px;font-weight:700;}
  .vinheta{margin-top:8px;width:4cm;height:2.5cm;object-fit:contain;display:block;}
  .locDate{text-align:right;font-size:14px;margin-top:14px;}
  .sig{margin-top:40px;display:flex;justify-content:flex-end;}
  .sigBox{width:360px;text-align:center;page-break-inside:avoid;break-inside:avoid;}
  .sigLine{border-top:1px solid #111;padding-top:10px;}
  .sigName{font-weight:900;font-size:18px;margin-top:6px;}
  .sigRole{font-size:14px;margin-top:2px;}
</style>
</head>
<body>
  <div class="a4">
    <div class="top">
      <div class="topLeft">
        <div>${escHtml(clinic?.website || "www.JoaoMorais.pt")}</div>
        <div>${escHtml(clinic?.phone   || "")}</div>
      </div>
      <div>${logoSrc ? `<img class="logo" src="${escUrl(logoSrc)}"/>` : ""}</div>
    </div>

    <div class="hr"></div>
    <div class="title">Pedido de Exame</div>

    <div class="bodyText">
      <div class="rx">R/</div>
      ${(() => {
        /* examName pode conter múltiplos exames separados por \n\n
           Cada bloco: "Nome do exame\nInfo clínica" */
        const blocks = (examName || "—").split("\n\n");
        return blocks.map(block => {
          const lines = block.split("\n");
          const name  = escHtml(lines[0] || "—");
          const info  = lines.slice(1).join("\n").trim();
          return `
            <div style="margin-bottom:18px;">
              <div class="examName">${name}</div>
              ${info ? `
                <div class="label">Informação clínica</div>
                <div class="clinicalInfo">${nl2br(info)}</div>` : ""}
            </div>`;
        }).join("");
      })()}
    </div>

    <div class="footerBlock">
      <div class="hr2"></div>
      <div class="footRow">
        <div>
          <div class="web">www.JoaoMorais.pt</div>
          ${vinhetaUrl ? `<img class="vinheta" src="${escUrl(vinhetaUrl)}"/>` : ""}
        </div>
        <div style="flex:1;">
          ${localityDate ? `<div class="locDate">${escHtml(localityDate)}</div>` : ""}
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
</html>`;
}
