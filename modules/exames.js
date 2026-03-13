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
  isOpen:         false,
  query:          "",
  exams:          [],
  selectedGroup:  "",
  selectedExamId: "",
  clinicalInfo:   "",
  patientId:      "",
  consultationId: null,
  mode:           "groups"
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
  examsUiState.isOpen        = true;
  examsUiState.patientId     = String(opts?.patientId     || examsUiState.patientId || "");
  examsUiState.consultationId = opts?.consultationId      || null;
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

    <div style="padding:16px; border-bottom:1px solid #f1f5f9;">
      <input id="gcExamSearch" type="text" placeholder="Pesquisar exame..."
        style="width:100%; padding:10px 12px; border:1px solid #cbd5e1; border-radius:8px;
               font-size:14px; box-sizing:border-box;">
    </div>

    <div id="gcExamResults" style="flex:1; overflow:auto; padding:16px;"></div>
  `;

  host.appendChild(panel);
  loadAndRenderExams();

  document.getElementById("gcCloseExamsPanel")?.addEventListener("click", closeExamsPanel);
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

function renderExamGroups() {
  const container = document.getElementById("gcExamResults");
  if (!container) return;

  const exams  = examsUiState.exams || [];
  const groups = listExamGroups(exams);
  const direct = listDirectExams(exams);

  let html = "";

  if (groups.length) {
    html += `
      <div style="font-size:11px; font-weight:800; letter-spacing:0.6px;
                  color:#64748b; text-transform:uppercase; margin-bottom:8px;">
        Categorias
      </div>`;
    groups.forEach(g => {
      html += `
        <div class="gcExamGroup" data-group="${g}"
          style="padding:10px 12px; border:1px solid #e2e8f0; border-radius:8px;
                 margin-bottom:8px; cursor:pointer; font-weight:600; background:#ffffff;">
          ${g}
        </div>`;
    });
  }

  if (direct.length) {
    html += `
      <div style="font-size:11px; font-weight:800; letter-spacing:0.6px;
                  color:#64748b; text-transform:uppercase; margin-top:16px; margin-bottom:8px;">
        Exames
      </div>`;
    direct.forEach(exam => {
      html += `
        <div class="gcExamDirect" data-exam-id="${exam.id}"
          style="padding:10px 12px; border:1px solid #e2e8f0; border-radius:8px;
                 margin-bottom:8px; cursor:pointer; background:#ffffff;">
          ${exam.exam_name}
        </div>`;
    });
  }

  container.innerHTML = html;

  container.querySelectorAll(".gcExamGroup").forEach(el => {
    el.addEventListener("click", () => {
      const groupLabel = el.getAttribute("data-group") || "";
      if (groupLabel) openExamGroup(groupLabel);
    });
  });

  container.querySelectorAll(".gcExamDirect").forEach(el => {
    el.addEventListener("click", () => {
      const examId = el.getAttribute("data-exam-id") || "";
      if (examId) openExamRequest(examId);
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
  const container = document.getElementById("gcExamResults");
  if (!container) return;

  let html = `
    <div style="margin-bottom:12px; display:flex; align-items:center; gap:8px;">
      <button id="gcExamBack" class="gcBtn"
        style="background:#ffffff; border:1px solid #cbd5e1; color:#0f172a; font-weight:600;">
        ← Voltar
      </button>
      <div style="font-weight:800; color:#111827;">${groupLabel}</div>
    </div>`;

  list.forEach(exam => {
    html += `
      <div class="gcExamItem" data-exam-id="${exam.id}"
        style="padding:10px 12px; border:1px solid #e2e8f0; border-radius:8px;
               margin-bottom:8px; cursor:pointer; background:#ffffff;">
        ${exam.exam_name}
      </div>`;
  });

  container.innerHTML = html;

  document.getElementById("gcExamBack")?.addEventListener("click", () => {
    examsUiState.mode           = "groups";
    examsUiState.selectedGroup  = "";
    examsUiState.selectedExamId = "";
    renderExamGroups();
  });

  container.querySelectorAll(".gcExamItem").forEach(el => {
    el.addEventListener("click", () => {
      const examId = el.getAttribute("data-exam-id") || "";
      if (examId) openExamRequest(examId);
    });
  });
}

function openExamRequest(examId) {
  examsUiState.selectedExamId = examId;
  examsUiState.mode           = "exam";

  const exams     = examsUiState.exams || [];
  const exam      = getExamById(exams, examId);
  const container = document.getElementById("gcExamResults");
  if (!container) return;

  if (!exam) {
    container.innerHTML = `<div style="color:#b91c1c; font-weight:600;">Exame não encontrado.</div>`;
    return;
  }

  const savedInfo = String(examsUiState.clinicalInfo || "");

  container.innerHTML = `
    <div style="margin-bottom:12px; display:flex; align-items:center; gap:8px;">
      <button id="gcExamRequestBack" class="gcBtn"
        style="background:#ffffff; border:1px solid #cbd5e1; color:#0f172a; font-weight:600;">
        ← Voltar
      </button>
    </div>

    <div style="border:1px solid #e2e8f0; border-radius:12px; background:#ffffff; padding:16px;">
      <div style="font-size:18px; font-weight:900; color:#111827; margin-bottom:16px;">
        Pedido de Exame
      </div>
      <div style="font-weight:800; color:#111827; margin-bottom:8px;">R/</div>
      <div style="font-size:16px; font-weight:700; color:#111827; line-height:1.4; margin-bottom:18px;">
        ${exam.exam_name}
      </div>

      <label for="gcExamClinicalInfo"
        style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:8px;">
        Informação clínica
      </label>
      <textarea id="gcExamClinicalInfo"
        placeholder="Escreva a informação clínica..."
        style="width:100%; min-height:180px; padding:12px; border:1px solid #cbd5e1;
               border-radius:10px; font-size:14px; line-height:1.5; box-sizing:border-box;
               resize:vertical; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;"
      >${savedInfo}</textarea>

      <div style="margin-top:14px; display:flex; justify-content:flex-end;">
        <button id="gcGenerateExamPdf" class="gcBtn"
          style="background:#1e3a8a; border:1px solid #1e3a8a; color:#ffffff; font-weight:800;">
          Pré-visualizar e Gerar PDF
        </button>
      </div>
    </div>`;

  /* --- Voltar --- */
  document.getElementById("gcExamRequestBack")?.addEventListener("click", () => {
    examsUiState.clinicalInfo = String(document.getElementById("gcExamClinicalInfo")?.value || "");
    if (examsUiState.selectedGroup) {
      openExamGroup(examsUiState.selectedGroup);
      return;
    }
    examsUiState.mode           = "groups";
    examsUiState.selectedExamId = "";
    renderExamGroups();
  });

  /* --- Guardar info clínica ao digitar --- */
  document.getElementById("gcExamClinicalInfo")?.addEventListener("input", ev => {
    examsUiState.clinicalInfo = String(ev.target?.value || "");
  });

  /* --- Gerar PDF --- */
  document.getElementById("gcGenerateExamPdf")?.addEventListener("click", async () => {
    try {
      examsUiState.clinicalInfo = String(document.getElementById("gcExamClinicalInfo")?.value || "");

      const currentExam = getExamById(examsUiState.exams || [], examsUiState.selectedExamId);
      if (!currentExam) { alert("Exame não encontrado."); return; }

      const patientId = String(examsUiState.patientId || "").trim();
      if (!patientId)  { alert("Doente sem ID válido."); return; }

      /* Clínica ativa do doente */
      const { data: patientClinicRow, error: pcErr } = await window.sb
        .from("patient_clinic")
        .select("clinic_id")
        .eq("patient_id", patientId)
        .eq("is_active", true)
        .single();
      if (pcErr || !patientClinicRow?.clinic_id) {
        console.error("patient_clinic error:", pcErr);
        alert("Não consegui determinar a clínica ativa do doente.");
        return;
      }

      const resolvedClinicId = String(patientClinicRow.clinic_id || "").trim();
      if (!resolvedClinicId) { alert("Sem clínica ativa."); return; }

      /* Dados da clínica */
      const { data: clinic, error: clinicErr } = await window.sb
        .from("clinics")
        .select("id, name, address_line1, address_line2, postal_code, city, phone, email, website, logo_url")
        .eq("id", resolvedClinicId)
        .single();
      if (clinicErr || !clinic) {
        console.error("clinics error:", clinicErr);
        alert("Não consegui carregar os dados da clínica.");
        return;
      }

      /* Assets */
      const bucket      = window.__gc_VINHETA_BUCKET;
      const signedUrl   = window.__gc_storageSignedUrl;
      const toDataUrl   = window.__gc_urlToDataUrl;

      let vinhetaUrl = "";
      try {
        const u = await signedUrl(bucket, window.__gc_VINHETA_PATH, 3600);
        if (u) vinhetaUrl = await toDataUrl(u, "image/png");
      } catch (e) { console.warn("vinheta falhou:", e); }

      let clinicLogoUrl = "";
      try {
        const rawLogo = String(clinic?.logo_url || "").trim();
        if (rawLogo.startsWith("data:")) {
          clinicLogoUrl = rawLogo;
        } else if (rawLogo.startsWith("http://") || rawLogo.startsWith("https://")) {
          clinicLogoUrl = await toDataUrl(rawLogo, "image/png");
        }
      } catch (e) { console.warn("logo falhou:", e); }

      /* HTML e abrir editor */
      const html = buildExamRequestHtml({
        clinic,
        examName:     currentExam.exam_name,
        clinicalInfo: examsUiState.clinicalInfo,
        vinhetaUrl,
        clinicLogoUrl,
        signatureUrl: ""
      });

      window.__gc_pendingExamCtx = {
        patientId,
        clinicId:       resolvedClinicId,
        consultationId: examsUiState.consultationId || null,
        examName:       currentExam.exam_name
      };

      window.openDocumentEditor(html, `Pedido de Exame — ${currentExam.exam_name}`);

    } catch (err) {
      console.error("Gerar PDF pedido de exame falhou:", err);
      alert("Erro ao gerar pedido de exame.");
    }
  });
}

/* ====================================================================
   BLOCO 12G — HTML do pedido de exame
   ==================================================================== */

/**
 * buildExamRequestHtml
 * Constrói o HTML A4 para o pedido de exame (usado pelo editor/PDF).
 */
export function buildExamRequestHtml({ clinic, examName, clinicalInfo, vinhetaUrl, clinicLogoUrl, signatureUrl }) {
  function escHtml(v)  { return String(v||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
  function escUrl(u)   { return String(u||"").replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  function nl2br(v)    { return escHtml(v).replace(/\n/g,"<br>"); }
  function fmtDate(d)  {
    try {
      const dt = d ? new Date(d) : new Date();
      return `${String(dt.getDate()).padStart(2,"0")}-${String(dt.getMonth()+1).padStart(2,"0")}-${dt.getFullYear()}`;
    } catch (_) { return ""; }
  }

  const locality     = String(clinic?.city || "").trim();
  const localityDate = [locality, fmtDate(new Date())].filter(Boolean).join(", ");
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
      <div class="examName">${escHtml(examName || "—")}</div>
      <div class="label">Informação clínica</div>
      <div class="clinicalInfo">${clinicalInfo && String(clinicalInfo).trim() ? nl2br(clinicalInfo) : "—"}</div>
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
