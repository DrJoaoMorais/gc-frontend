/* ========================================================
   CONSENTIMENTOS.JS — Consentimentos informados + RGPD
   --------------------------------------------------------
   01 — Helpers e constantes
   02 — checkConsentStatus  (exportada)
   03 — openConsentModal    (exportada)
   04 — Render do modal + canvas de assinatura
   05 — PDF proxy
   06 — Templates HTML (RGPD, PRP, Corticoide, AH)
   ======================================================== */

const PDF_PROXY_URL = "https://gc-pdf-proxy.dr-joao-morais.workers.dev/pdf";
const DOC_BUCKET    = "documents";

/* ======================================================== */
/*  01 — Helpers                                            */
/* ======================================================== */

function escH(s) {
  return String(s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function todayPt() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
}

function fmtDobPt(dob) {
  if (!dob) return "—";
  const parts = String(dob).split("-");
  if (parts.length !== 3) return dob;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function clinicAddress(clinic) {
  const parts = [clinic?.address_line1, clinic?.postal_code, clinic?.city].filter(Boolean);
  return parts.join(", ") || "—";
}

const CONSENT_TITLES = {
  rgpd:       "RGPD — Política de Privacidade",
  prp:        "Consentimento Informado — PRP",
  corticoide: "Consentimento Informado — Corticosteróide",
  ah:         "Consentimento Informado — Ácido Hialurónico",
};

/* ======================================================== */
/*  02 — checkConsentStatus                                 */
/* ======================================================== */

export async function checkConsentStatus(patientId, clinicId) {
  if (!patientId || !clinicId) return {};
  try {
    const { data, error } = await window.sb
      .from("consents")
      .select("type")
      .eq("patient_id", patientId)
      .eq("clinic_id", clinicId)
      .eq("status", "signed");

    if (error) { console.warn("checkConsentStatus:", error); return {}; }

    const signed = {};
    (data || []).forEach(r => { signed[r.type] = true; });
    return signed;
  } catch (e) {
    console.warn("checkConsentStatus:", e);
    return {};
  }
}

/* ======================================================== */
/*  03 — openConsentModal                                   */
/* ======================================================== */

export function openConsentModal({ type, patient, clinicId, clinic, onSaved }) {
  document.getElementById("gcConsentOverlay")?.remove();

  const p = patient;
  let clinicFields     = {};
  let consentResponses = {};
  let saving = false;
  let step   = "read"; // "read" | "sign"

  const overlay = document.createElement("div");
  overlay.id = "gcConsentOverlay";
  Object.assign(overlay.style, {
    position: "fixed", inset: "0", zIndex: "4000",
    background: "rgba(15,23,42,0.6)",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: "16px",
  });
  document.body.appendChild(overlay);

  function close() { overlay.remove(); }

  /* ── Render ─────────────────────────────────────────── */
  function render() {
    const isRead = step === "read";

    overlay.innerHTML = `
      <div style="
        background:#fff; width:min(1100px,98vw); height:94vh;
        border-radius:16px; overflow:hidden; display:flex; flex-direction:column;
        box-shadow:0 24px 64px rgba(0,0,0,0.35);
      ">

        <!-- Cabeçalho -->
        <div style="
          background:#0f2d52; color:#fff; padding:12px 20px;
          display:flex; justify-content:space-between; align-items:center; flex-shrink:0;
        ">
          <div style="display:flex; flex-direction:column; gap:2px;">
            <div style="font-weight:900; font-size:15px;">${escH(CONSENT_TITLES[type] || type)}</div>
            <div style="font-size:11px; opacity:0.75;">
              ${isRead
                ? "Passo 1 de 2 — Leia o documento antes de assinar"
                : "Passo 2 de 2 — Preencha e assine"}
            </div>
          </div>
          <div style="display:flex; gap:8px; align-items:center;">
            ${!isRead ? `<button id="gcConsentBack" style="
              background:rgba(255,255,255,0.15); border:1px solid rgba(255,255,255,0.3);
              color:#fff; font-size:12px; font-weight:600; cursor:pointer;
              padding:5px 12px; border-radius:8px;
            ">← Ler documento</button>` : ""}
            <button id="gcConsentClose" style="
              background:none; border:none; color:#fff; font-size:20px;
              cursor:pointer; padding:4px 10px; border-radius:6px; line-height:1;
            ">✕</button>
          </div>
        </div>

        ${isRead ? `
          <!-- PASSO 1 — Documento completo para leitura -->
          <div style="flex:1; min-height:0; overflow:hidden;">
            <iframe id="gcConsentPreviewFrame" style="width:100%; height:100%; border:none; display:block;"></iframe>
          </div>
          <div style="
            border-top:2px solid #0f2d52; padding:14px 20px;
            display:flex; justify-content:space-between; align-items:center;
            background:#f0f6ff; flex-shrink:0; gap:10px; flex-wrap:wrap;
          ">
            <div style="font-size:12px; color:#1d4ed8; font-weight:600;">
              📖 Leia o documento completo antes de avançar
            </div>
            <button id="gcConsentAdvance" style="
              padding:10px 24px; border-radius:10px; border:none;
              background:#0f2d52; color:#fff; cursor:pointer; font-size:14px; font-weight:700;
            ">Li o documento — Avançar para assinar →</button>
          </div>
        ` : `
          <!-- PASSO 2 — Campos + assinatura -->
          <div style="flex:1; overflow-y:auto; padding:20px; display:flex; flex-direction:column; gap:16px;">

            ${renderVariableFields()}

            ${type === "rgpd" ? renderRgpdCheckboxes() : renderDocumentNote()}

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
              ${renderCanvasBlock("gcCanvasPatient", "gcClearPatient", "Assinatura do doente")}
              ${renderCanvasBlock("gcCanvasDoctor",  "gcClearDoctor",  "Assinatura do médico")}
            </div>

          </div>
          <div style="
            border-top:1px solid #e2e8f0; padding:12px 20px;
            display:flex; justify-content:space-between; align-items:center;
            background:#f8fafc; flex-shrink:0; gap:10px; flex-wrap:wrap;
          ">
            <div id="gcConsentMsg" style="font-size:12px; color:#64748b;"></div>
            <div style="display:flex; gap:10px;">
              <button id="gcConsentPaper" style="
                padding:9px 14px; border-radius:10px; border:1px solid #e2e8f0;
                background:#fff; cursor:pointer; font-size:13px; font-weight:600; color:#475569;
              ">📄 Papel (PDF sem assinatura)</button>
              <button id="gcConsentSave" style="
                padding:9px 20px; border-radius:10px; border:none;
                background:#0f2d52; color:#fff; cursor:pointer; font-size:13px; font-weight:700;
              ">Gravar e gerar PDF</button>
            </div>
          </div>
        `}

      </div>
    `;

    // Injectar documento no iframe (evita escapar HTML no atributo srcdoc)
    if (isRead) {
      const frame = document.getElementById("gcConsentPreviewFrame");
      if (frame) {
        frame.srcdoc = buildConsentHtml({
          type, patient: p, clinic, clinicFields,
          consentResponses, patientSig: null, doctorSig: null,
          today: todayPt(), paperMode: true,
        });
      }
      document.getElementById("gcConsentAdvance")?.addEventListener("click", () => { step = "sign"; render(); });
    } else {
      document.getElementById("gcConsentBack")?.addEventListener("click", () => { step = "read"; render(); });
      document.getElementById("gcClearPatient")?.addEventListener("click", () => clearCanvas("gcCanvasPatient"));
      document.getElementById("gcClearDoctor")?.addEventListener("click",  () => clearCanvas("gcCanvasDoctor"));
      initCanvas(document.getElementById("gcCanvasPatient"));
      initCanvas(document.getElementById("gcCanvasDoctor"));
      wireFieldInputs();
      if (type === "rgpd") wireRgpdInputs();
      document.getElementById("gcConsentSave")?.addEventListener("click", () => handleSave(false));
      document.getElementById("gcConsentPaper")?.addEventListener("click", () => handleSave(true));
    }

    document.getElementById("gcConsentClose")?.addEventListener("click", close);
    overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
  }

  /* ── Campos variáveis ───────────────────────────────── */
  function renderVariableFields() {
    const wrapCss = `background:#f0f6ff; border:1px solid #bcd4f5; border-radius:10px; padding:14px;`;
    const lblCss  = `font-size:12px; font-weight:800; color:#1d4ed8; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:10px;`;
    const gridCss = `display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:10px;`;
    const fldCss  = `font-size:11px; color:#64748b; margin-bottom:4px;`;
    const inpCss  = `width:100%; padding:8px; border:1px solid #ddd; border-radius:8px; font-size:13px; box-sizing:border-box;`;

    function field(id, label, type_ = "text", placeholder = "") {
      return `<div><div style="${fldCss}">${label}</div><input id="${id}" type="${type_}" placeholder="${placeholder}" style="${inpCss}" /></div>`;
    }
    function select(id, label, options) {
      return `<div><div style="${fldCss}">${label}</div><select id="${id}" style="${inpCss}">${options.map(([v,l]) => `<option value="${v}">${l}</option>`).join("")}</select></div>`;
    }
    const modalidade = select("cf_modalidade", "Modalidade", [["presencial","Presencial"],["teleconsulta","Teleconsulta"]]);

    if (type === "rgpd") {
      return `<div style="${wrapCss}"><div style="${lblCss}">Dados para preenchimento</div><div style="${gridCss}">${modalidade}</div></div>`;
    }
    if (type === "prp") {
      return `<div style="${wrapCss}"><div style="${lblCss}">Dados do procedimento (médico)</div><div style="${gridCss}">
        ${select("cf_protocolo","Protocolo PRP",[["LP-PRP","LP-PRP"],["LR-PRP","LR-PRP"]])}
        ${field("cf_sessoes","N.º sessões","text","ex: 3")}
        ${field("cf_intervalo","Intervalo","text","ex: 4 semanas")}
        ${field("cf_articulacao","Articulação / Estrutura","text","ex: Joelho direito")}
        ${select("cf_tecnica","Técnica",[["Anatómica","Anatómica"],["Ecoguiada","Ecoguiada"]])}
        ${modalidade}
      </div></div>`;
    }
    if (type === "corticoide") {
      return `<div style="${wrapCss}"><div style="${lblCss}">Dados do procedimento (médico)</div><div style="${gridCss}">
        ${field("cf_farmaco","Fármaco","text","ex: Triamcinolona")}
        ${field("cf_dose","Dose","text","ex: 40mg")}
        ${field("cf_lote","Lote / Validade","text","ex: LT12345 / 2026-06")}
        ${field("cf_anestesico","Anestésico local","text","ex: Lidocaína 1%")}
        ${field("cf_articulacao","Articulação / Estrutura","text","ex: Ombro direito")}
        ${select("cf_tecnica","Técnica",[["Anatómica","Anatómica"],["Ecoguiada","Ecoguiada"]])}
        ${field("cf_seguimento","Seguimento (semanas)","text","ex: 4")}
        ${modalidade}
      </div></div>`;
    }
    if (type === "ah") {
      return `<div style="${wrapCss}"><div style="${lblCss}">Dados do procedimento (médico)</div><div style="${gridCss}">
        ${field("cf_produto","Produto / Marca","text","ex: Durolane")}
        ${field("cf_lote","Lote","text","ex: LT98765")}
        ${field("cf_validade","Validade","text","ex: 2026-12")}
        ${field("cf_ninjeccoes","N.º injecções","text","ex: 3")}
        ${field("cf_intervalo","Intervalo","text","ex: 1 semana")}
        ${field("cf_articulacao","Articulação / Estrutura","text","ex: Joelho esquerdo")}
        ${select("cf_tecnica","Técnica",[["Anatómica","Anatómica"],["Ecoguiada","Ecoguiada"]])}
        ${field("cf_seguimento","Seguimento (semanas)","text","ex: 6")}
        ${modalidade}
      </div></div>`;
    }
    return "";
  }

  function renderDocumentNote() {
    return `
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px 16px; font-size:12px; color:#64748b;">
        O documento completo será gerado em PDF com os dados do doente, da clínica e os campos acima preenchidos, incluindo as assinaturas.
      </div>
    `;
  }

  function renderRgpdCheckboxes() {
    function checkRow(key, label, optional = false) {
      return `
        <div style="display:flex; justify-content:space-between; align-items:center;
                    border:0.5px solid #e2e8f0; padding:8px 12px; margin:2px 0; border-radius:6px; font-size:13px;">
          <span>${escH(label)}</span>
          <span style="display:flex; gap:16px; flex-shrink:0;">
            <label style="cursor:pointer; display:flex; align-items:center; gap:4px;">
              <input type="radio" class="rgpd-check" name="${key}" data-key="${key}" data-val="sim" />Sim
            </label>
            <label style="cursor:pointer; display:flex; align-items:center; gap:4px;">
              <input type="radio" class="rgpd-check" name="${key}" data-key="${key}" data-val="nao" />Não
            </label>
          </span>
        </div>`;
    }
    return `
      <div style="border:1px solid #e2e8f0; border-radius:10px; overflow:hidden;">
        <div style="background:#f8fafc; border-bottom:1px solid #e2e8f0; padding:8px 14px;
                    font-size:12px; font-weight:700; color:#374151;">
          Secção 9 — Consentimento para Tratamento de Dados de Saúde
        </div>
        <div style="padding:10px 12px;">
          ${checkRow("prestacao","Prestação de cuidados de saúde e acompanhamento clínico.")}
          ${checkRow("gestao_consultas","Gestão de consultas e contacto (telefone, SMS, email).")}
          ${checkRow("faturacao","Emissão de faturas/recibos e cumprimento de obrigações legais.")}
          ${checkRow("armazenamento","Armazenamento digital seguro na plataforma referida (Supabase, servidores UE).")}
          ${checkRow("link_digital","Envio de link para assinatura digital de consentimentos clínicos.")}
        </div>
        <div style="background:#f8fafc; border-top:1px solid #e2e8f0; border-bottom:1px solid #e2e8f0;
                    padding:8px 14px; font-size:12px; font-weight:700; color:#374151;">
          Secção 10 — Consentimentos Opcionais (a recusa não afecta os cuidados de saúde)
        </div>
        <div style="padding:10px 12px;">
          ${checkRow("lembretes","Envio de informações relevantes e lembretes de consulta (email/SMS).",true)}
          ${checkRow("comunicacoes","Envio de comunicações de natureza informativa ou de saúde preventiva.",true)}
          ${checkRow("estudos","Utilização de dados anonimizados/pseudonimizados em estudos científicos.",true)}
        </div>
      </div>
    `;
  }

  function renderCanvasBlock(canvasId, clearId, label) {
    return `
      <div style="border:1px solid #e2e8f0; border-radius:10px; overflow:hidden;">
        <div style="background:#f8fafc; border-bottom:1px solid #e2e8f0; padding:8px 12px;
                    display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:12px; font-weight:700; color:#374151;">${escH(label)}</span>
          <button id="${clearId}" style="
            font-size:11px; padding:3px 8px; border-radius:6px;
            border:1px solid #e2e8f0; background:#fff; cursor:pointer; color:#64748b;
          ">Limpar</button>
        </div>
        <canvas id="${canvasId}" width="380" height="120"
          style="display:block; width:100%; cursor:crosshair; touch-action:none; background:#fff;"></canvas>
      </div>
    `;
  }

  /* ── Wiring ─────────────────────────────────────────── */
  function wireFieldInputs() {
    overlay.querySelectorAll("[id^='cf_']").forEach(el => {
      const key = el.id.replace("cf_", "");
      clinicFields[key] = el.value;
      el.addEventListener("input",  () => { clinicFields[key] = el.value; });
      el.addEventListener("change", () => { clinicFields[key] = el.value; });
    });
  }

  function wireRgpdInputs() {
    overlay.querySelectorAll(".rgpd-check").forEach(el => {
      el.addEventListener("change", () => {
        const key = el.getAttribute("data-key");
        const val = el.getAttribute("data-val");
        if (!consentResponses[key]) consentResponses[key] = {};
        consentResponses[key] = el.checked ? val : null;
      });
    });
  }

  /* ── Canvas ─────────────────────────────────────────── */
  function initCanvas(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.strokeStyle = "#111"; ctx.lineWidth = 2;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    let drawing = false, lx = 0, ly = 0;

    function pos(e) {
      const rect = canvas.getBoundingClientRect();
      const sx = canvas.width  / rect.width;
      const sy = canvas.height / rect.height;
      const src = e.touches ? e.touches[0] : e;
      return { x: (src.clientX - rect.left) * sx, y: (src.clientY - rect.top) * sy };
    }
    function draw(e) {
      if (!drawing) return;
      const p = pos(e);
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(p.x, p.y); ctx.stroke();
      lx = p.x; ly = p.y;
    }

    canvas.addEventListener("mousedown",  e => { drawing = true; const p = pos(e); lx = p.x; ly = p.y; });
    canvas.addEventListener("mousemove",  draw);
    canvas.addEventListener("mouseup",    () => drawing = false);
    canvas.addEventListener("mouseleave", () => drawing = false);
    canvas.addEventListener("touchstart", e => { e.preventDefault(); drawing = true; const p = pos(e); lx = p.x; ly = p.y; }, { passive: false });
    canvas.addEventListener("touchmove",  e => { e.preventDefault(); draw(e); }, { passive: false });
    canvas.addEventListener("touchend",   () => drawing = false);
  }

  function clearCanvas(id) {
    const c = document.getElementById(id);
    if (!c) return;
    c.getContext("2d").clearRect(0, 0, c.width, c.height);
  }

  function isBlank(id) {
    const c = document.getElementById(id);
    if (!c) return true;
    return !c.getContext("2d").getImageData(0, 0, c.width, c.height).data.some(v => v !== 0);
  }

  function dataUrl(id) {
    const c = document.getElementById(id);
    return (!c || isBlank(id)) ? "" : c.toDataURL("image/png");
  }

  /* ── Gravar ─────────────────────────────────────────── */
  async function handleSave(paperMode) {
    if (saving) return;

    // Ler valores actuais dos campos
    overlay.querySelectorAll("[id^='cf_']").forEach(el => {
      clinicFields[el.id.replace("cf_", "")] = el.value || "";
    });

    const patSig = dataUrl("gcCanvasPatient");
    const docSig = dataUrl("gcCanvasDoctor");

    if (!paperMode && !patSig) {
      setMsg("A assinatura do doente é obrigatória.", "error");
      return;
    }

    saving = true;
    const btnSave = document.getElementById("gcConsentSave");
    if (btnSave) { btnSave.disabled = true; btnSave.textContent = "A gerar PDF…"; }
    setMsg("A gerar PDF…", "info");

    try {
      const userRes = await window.sb.auth.getUser();
      const userId  = userRes?.data?.user?.id || null;

      const html = buildConsentHtml({
        type, patient: p, clinic, clinicFields, consentResponses,
        patientSig: paperMode ? "" : patSig,
        doctorSig:  paperMode ? "" : docSig,
        today: todayPt(), paperMode,
      });

      const pdfBlob = await renderPdfViaProxy(html);

      const ts = Date.now();
      const storagePath = `consents/${p.id}/${type}_${ts}.pdf`;

      const { error: uploadErr } = await window.sb.storage
        .from(DOC_BUCKET)
        .upload(storagePath, pdfBlob, { contentType: "application/pdf", upsert: false });

      if (uploadErr) throw uploadErr;

      const { error: insertErr } = await window.sb.from("consents").insert({
        patient_id:        p.id,
        clinic_id:         clinicId,
        type,
        status:            paperMode ? "paper_sent" : "signed",
        modalidade:        clinicFields.modalidade || "presencial",
        clinical_fields:   Object.keys(clinicFields).length ? clinicFields : null,
        consent_responses: Object.keys(consentResponses).length ? consentResponses : null,
        signed_at:         paperMode ? null : new Date().toISOString(),
        doctor_signed_at:  (!paperMode && docSig) ? new Date().toISOString() : null,
        created_by:        userId,
        storage_path:      storagePath,
      });

      if (insertErr) throw insertErr;

      const url = URL.createObjectURL(pdfBlob);
      window.open(url, "_blank");

      close();
      if (typeof onSaved === "function") onSaved(type);

    } catch (e) {
      console.error("handleSave consent:", e);
      setMsg("Erro ao gerar/guardar. Tente de novo.", "error");
      saving = false;
      if (btnSave) { btnSave.disabled = false; btnSave.textContent = "Gravar e gerar PDF"; }
    }
  }

  function setMsg(text, kind = "info") {
    const el = document.getElementById("gcConsentMsg");
    if (!el) return;
    el.textContent = text;
    el.style.color = kind === "error" ? "#dc2626" : "#64748b";
  }

  render();
}

/* ======================================================== */
/*  05 — PDF proxy                                          */
/* ======================================================== */

async function renderPdfViaProxy(html) {
  const res = await fetch(PDF_PROXY_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ html: String(html || "") }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`PDF proxy ${res.status}: ${msg}`);
  }
  return new Blob([await res.arrayBuffer()], { type: "application/pdf" });
}

/* ======================================================== */
/*  06 — Templates HTML                                     */
/* ======================================================== */

function buildConsentHtml({ type, patient, clinic, clinicFields, consentResponses, patientSig, doctorSig, today, paperMode }) {
  const p  = patient;
  const cf = clinicFields || {};

  const clinicName  = escH(clinic?.name || "—");
  const clinicAddr  = escH(clinicAddress(clinic));
  const clinicPhone = escH(clinic?.phone || "—");
  const clinicEmail = escH(clinic?.email || "—");
  const patName     = escH(p?.full_name || "—");
  const patDob      = escH(fmtDobPt(p?.dob));
  const patNif      = escH(p?.nif || p?.passport_id || "—");
  const patPhone    = escH(p?.phone || "—");
  const patEmail    = escH(p?.email || "—");

  const modalidade  = cf.modalidade === "teleconsulta" ? "teleconsulta" : "presencial";
  const chk = (m) => m === modalidade ? "☑" : "☐";

  const sigImg = (dataUrl) => dataUrl
    ? `<img src="${dataUrl}" style="max-height:48px; max-width:200px;" alt="assinatura" />`
    : `<span style="display:inline-block; width:200px; border-bottom:1px solid #555;">&nbsp;</span>`;

  const css = `
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:Arial,Helvetica,sans-serif;font-size:9.5pt;color:#111;background:#fff;padding:10mm 12mm;}
    @page{size:A4;margin:0;}
    .hdr{text-align:center;border-bottom:2px solid #0f2d52;padding-bottom:12px;margin-bottom:16px;}
    .sec-8{page-break-before:always;}
    .hdr-name{font-size:15pt;font-weight:900;color:#0f2d52;}
    .hdr-sub{font-size:9.5pt;color:#475569;margin-top:2px;}
    .hdr-meta{display:flex;justify-content:space-between;font-size:8pt;color:#64748b;margin-top:5px;}
    .doc-title{background:#0f2d52;color:#fff;text-align:center;font-weight:900;font-size:11pt;padding:6px 10px;margin:10px 0;}
    .sec{background:#0f2d52;color:#fff;font-weight:700;font-size:9pt;padding:4px 10px;margin:8px 0 4px;}
    .grid2{display:grid;grid-template-columns:1fr 1fr;gap:2px 12px;margin-bottom:4px;}
    .f{border-bottom:1px solid #bbb;padding:2px 0;font-size:9.5pt;}
    .f b{color:#222;}
    .txt{font-size:9pt;line-height:1.45;margin-bottom:3px;}
    .ul{padding-left:18px;margin-bottom:3px;}
    .ul li{margin-bottom:2px;}
    .ol{padding-left:18px;margin-bottom:3px;}
    .ol li{margin-bottom:2px;}
    .cbrow{display:flex;justify-content:space-between;align-items:center;border:0.5px solid #ddd;padding:4px 10px;margin:2px 0;font-size:9pt;}
    .warn{background:#fffbeb;border:0.5px solid #f59e0b;border-radius:3px;padding:5px 10px;font-size:9pt;margin:5px 0;}
    .decl{border:0.5px solid #ddd;border-radius:3px;padding:6px 10px;margin-bottom:6px;}
    .sig-wrap{margin-top:10px;padding-top:8px;border-top:1px solid #ddd;}
    .sig-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:8px;}
    .sig-lbl{font-size:9pt;font-weight:700;color:#374151;margin-bottom:4px;}
    .sig-area{min-height:52px;border-bottom:1px solid #555;display:flex;align-items:flex-end;padding-bottom:2px;}
    .sig-date{font-size:8pt;color:#64748b;margin-top:3px;}
    .muted{color:#64748b;}
    .bold{font-weight:700;}
    .footer{text-align:center;font-size:8pt;color:#94a3b8;margin-top:14px;padding-top:5px;border-top:0.5px solid #e2e8f0;}
  `;

  let body = "";
  if      (type === "rgpd")       body = bodyRgpd({ patName, patDob, patNif, patPhone, patEmail, clinicName, clinicAddr, clinicPhone, clinicEmail, chk, cr: consentResponses || {}, today, sigImg, patientSig });
  else if (type === "prp")        body = bodyPrp({ patName, patDob, patNif, patPhone, patEmail, clinicName, clinicAddr, clinicPhone, clinicEmail, chk, cf, today, sigImg, patientSig, doctorSig });
  else if (type === "corticoide") body = bodyCorticoide({ patName, patDob, patNif, patPhone, patEmail, clinicName, clinicAddr, clinicPhone, clinicEmail, chk, cf, today, sigImg, patientSig, doctorSig });
  else if (type === "ah")         body = bodyAh({ patName, patDob, patNif, patPhone, patEmail, clinicName, clinicAddr, clinicPhone, clinicEmail, chk, cf, today, sigImg, patientSig, doctorSig });

  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
  <div class="hdr">
    <div class="hdr-name">Dr. João Morais</div>
    <div class="hdr-sub">Medicina Física e de Reabilitação | Medicina Desportiva</div>
    <div class="hdr-meta"><span>Cédula: 44380</span><span>Contacto: 916 390 074</span><span>Email: Dr.Joao.Morais@gmail.com</span></div>
  </div>
  ${body}
  <div class="footer">Versão 2.0 — 2025 | gc.joaomorais.pt</div>
  </body></html>`;
}

/* ── RGPD ─────────────────────────────────────────────── */
function bodyRgpd({ patName, patDob, patNif, patPhone, patEmail, clinicName, clinicAddr, clinicPhone, clinicEmail, chk, cr, today, sigImg, patientSig }) {
  function cbRow(key, label) {
    const v = cr[key];
    return `<div class="cbrow"><span>${escH(label)}</span><span style="display:flex;gap:14px;">
      <span>${v === "sim" ? "☑" : "☐"} Sim</span><span>${v === "nao" ? "☑" : "☐"} Não</span>
    </span></div>`;
  }
  return `
  <div class="doc-title">POLÍTICA DE PRIVACIDADE E CONSENTIMENTO PARA TRATAMENTO DE DADOS PESSOAIS (RGPD)</div>
  <div class="grid2">
    <div class="f"><b>Clínica / Local:</b> ${clinicName}</div>
    <div class="f"><b>Morada:</b> ${clinicAddr}</div>
    <div class="f"><b>Contacto:</b> ${clinicPhone}</div>
    <div class="f"><b>Email:</b> ${clinicEmail}</div>
    <div class="f" style="grid-column:1/-1;"><b>Modalidade:</b> ${chk("presencial")} Consulta presencial &nbsp;&nbsp; ${chk("teleconsulta")} Teleconsulta (www.joaomorais.pt)</div>
  </div>
  <div class="sec">1. Identificação do Titular dos Dados</div>
  <div class="grid2">
    <div class="f" style="grid-column:1/-1;"><b>Nome completo:</b> ${patName}</div>
    <div class="f"><b>Data de nascimento:</b> ${patDob}</div>
    <div class="f"><b>N.º CC / NIF:</b> ${patNif}</div>
    <div class="f"><b>Telefone:</b> ${patPhone}</div>
    <div class="f"><b>Email:</b> ${patEmail}</div>
  </div>
  <div class="sec">2. Finalidade do Tratamento de Dados</div>
  <ol class="ol txt"><li>Prestação de cuidados de saúde e acompanhamento clínico.</li><li>Gestão de consultas e contacto com o doente (telefone, SMS, email).</li><li>Emissão de faturas/recibos e cumprimento de obrigações legais e fiscais.</li><li>Registo clínico e arquivo de informação médica.</li><li>Envio de link para assinatura digital de consentimentos informados (quando aplicável).</li><li>Anonimização/pseudonimização para estudos científicos (com consentimento específico).</li></ol>
  <div class="sec">3. Tipo de Dados Recolhidos</div>
  <div class="txt">Serão recolhidos e tratados: dados de identificação, dados de contacto e dados de saúde (categoria especial de dados pessoais — art. 9.º do RGPD), incluindo registos clínicos, procedimentos realizados e documentos de consentimento informado.</div>
  <div class="sec">4. Base Legal</div>
  <ul class="ul txt"><li>Prestação de cuidados de saúde — art. 9.º, n.º 2, al. h) do RGPD e art. 26.º da Lei n.º 58/2019.</li><li>Cumprimento de obrigações legais — art. 6.º, n.º 1, al. c) do RGPD.</li><li>Consentimento do titular — art. 6.º, n.º 1, al. a) e art. 9.º, n.º 2, al. a) do RGPD (quando aplicável).</li></ul>
  <div class="sec">5. Partilha de Dados</div>
  <ul class="ul txt"><li>Entidades seguradoras ou subsistemas de saúde (mediante autorização do titular).</li><li>Entidades reguladoras ou autoridades legais (por obrigação legal).</li><li>Prestadores de serviços de TI — nomeadamente a plataforma <b>Supabase</b> (servidores na União Europeia), utilizada para armazenamento seguro de dados clínicos e gestão de consentimentos digitais, com garantia contratual de confidencialidade e conformidade RGPD.</li></ul>
  <div class="sec">6. Conservação dos Dados</div>
  <div class="txt">Os dados de saúde serão conservados pelo prazo mínimo de <b>10 anos</b> após o último acto clínico. Os dados de comunicações opcionais serão conservados enquanto o titular mantiver o seu consentimento.</div>
  <div class="txt muted" style="font-style:italic;font-size:8.5pt;">Nota multi-clínica: Este consentimento é específico para o local de consulta indicado no cabeçalho. Em caso de consulta noutro local, será solicitado novo consentimento.</div>
  <div class="sec">7. Direitos do Titular dos Dados</div>
  <ul class="ul txt"><li>Aceder, rectificar ou apagar os seus dados pessoais.</li><li>Limitar ou opor-se ao tratamento.</li><li>Solicitar a portabilidade dos dados.</li><li>Retirar o consentimento a qualquer momento.</li><li>Apresentar reclamação à <b>CNPD</b> — www.cnpd.pt.</li></ul>
  <div class="txt">Contacto: <b>Dr.Joao.Morais@gmail.com</b> | <b>916 390 074</b></div>
  <div class="sec sec-8">8. Declaração de Tomada de Conhecimento</div>
  <div class="txt">Declaro que tomei conhecimento da informação de privacidade acima apresentada, que me foi explicada de forma clara e compreensível, e que tive oportunidade de colocar questões e obter respostas satisfatórias.</div>
  <div class="sig-wrap">
    <div class="sig-grid">
      <div><div class="sig-lbl">Assinatura do titular:</div><div class="sig-area">${sigImg(patientSig)}</div><div class="sig-date">Data: ${today}</div></div>
      <div><div class="sig-lbl">Representante legal (se aplicável):</div><div class="sig-area"><span style="display:inline-block;width:180px;border-bottom:1px solid #555;">&nbsp;</span></div><div class="sig-date">Relação: ___________________</div></div>
    </div>
  </div>
  <div class="sec">9. Consentimento para Tratamento de Dados de Saúde</div>
  <div class="txt">Autorizo o tratamento dos meus dados pessoais, incluindo dados de saúde, para as finalidades descritas:</div>
  ${cbRow("prestacao","Prestação de cuidados de saúde e acompanhamento clínico.")}
  ${cbRow("gestao_consultas","Gestão de consultas e contacto (telefone, SMS, email).")}
  ${cbRow("faturacao","Emissão de faturas/recibos e cumprimento de obrigações legais.")}
  ${cbRow("armazenamento","Armazenamento digital seguro na plataforma referida (Supabase, servidores UE).")}
  ${cbRow("link_digital","Envio de link para assinatura digital de consentimentos clínicos.")}
  <div class="sig-wrap" style="margin-top:6px;">
    <div class="sig-area" style="min-height:40px;">${sigImg(patientSig)}</div>
    <div class="sig-date">Data: ${today}</div>
  </div>
  <div class="sec">10. Consentimentos Opcionais</div>
  <div class="txt">Os itens abaixo são opcionais. A recusa não afecta a prestação de cuidados de saúde.</div>
  ${cbRow("lembretes","Envio de informações relevantes e lembretes de consulta (email/SMS).")}
  ${cbRow("comunicacoes","Envio de comunicações de natureza informativa ou de saúde preventiva.")}
  ${cbRow("estudos","Utilização de dados anonimizados/pseudonimizados em estudos científicos.")}
  <div class="sig-wrap" style="margin-top:6px;">
    <div class="sig-area" style="min-height:40px;">${sigImg(patientSig)}</div>
    <div class="sig-date">Data: ${today}</div>
  </div>
  <div class="txt muted" style="margin-top:8px;">Exemplar: ☐ Titular dos dados &nbsp; ☐ Processo clínico</div>
  `;
}

/* ── PRP ──────────────────────────────────────────────── */
function bodyPrp({ patName, patDob, patNif, patPhone, patEmail, clinicName, clinicAddr, clinicPhone, clinicEmail, chk, cf, today, sigImg, patientSig, doctorSig }) {
  const pLP = cf.protocolo === "LR-PRP" ? "☐" : "☑";
  const pLR = cf.protocolo === "LR-PRP" ? "☑" : "☐";
  const tA  = cf.tecnica === "Ecoguiada" ? "☐" : "☑";
  const tE  = cf.tecnica === "Ecoguiada" ? "☑" : "☐";
  return `
  <div class="doc-title">CONSENTIMENTO INFORMADO — PRP (Plasma Rico em Plaquetas)</div>
  <div class="grid2">
    <div class="f"><b>Clínica / Local:</b> ${clinicName}</div><div class="f"><b>Morada:</b> ${clinicAddr}</div>
    <div class="f"><b>Contacto:</b> ${clinicPhone}</div><div class="f"><b>Email:</b> ${clinicEmail}</div>
    <div class="f" style="grid-column:1/-1;"><b>Modalidade:</b> ${chk("presencial")} Presencial &nbsp;&nbsp; ${chk("teleconsulta")} Teleconsulta</div>
  </div>
  <div class="grid2">
    <div class="f" style="grid-column:1/-1;"><b>Doente:</b> ${patName}</div>
    <div class="f"><b>Data de nascimento:</b> ${patDob}</div><div class="f"><b>N.º CC / NIF:</b> ${patNif}</div>
    <div class="f"><b>Telefone:</b> ${patPhone}</div><div class="f"><b>Email:</b> ${patEmail}</div>
  </div>
  <div class="sec">Dados do Procedimento</div>
  <div class="txt"><b>Protocolo PRP:</b> ${pLP} LP-PRP &nbsp;&nbsp; ${pLR} LR-PRP &nbsp;&nbsp;&nbsp; <b>N.º sessões previstas:</b> ${escH(cf.sessoes||"—")} &nbsp;&nbsp;&nbsp; <b>Intervalo:</b> ${escH(cf.intervalo||"—")}</div>
  <div class="sec">Resumo em Linguagem Simples</div>
  <div class="txt"><b>O que é:</b> Preparado a partir do seu próprio sangue (colheita + centrifugação) e injectado na zona a tratar.</div>
  <div class="txt"><b>Objectivo:</b> Reduzir dor e melhorar função. Não garante cura — os resultados variam entre doentes.</div>
  <div class="txt"><b>Probabilidade de benefício:</b> Cerca de 6 em 10 doentes são "respondedores" aos 6 meses (56–73% conforme estudos).</div>
  <div class="txt"><b>Efeitos mais comuns:</b> Dor e inchaço transitórios nas primeiras 24–72 horas.</div>
  <div class="txt"><b>Riscos raros mas importantes:</b> Infecção articular (~0,001–0,072%), reacção inflamatória intensa, hemorragia.</div>
  <div class="txt"><b>Alternativas:</b> Fisioterapia/exercício, infiltração de corticóide ou ácido hialurónico, cirurgia.</div>
  <div class="sec">Descrição do Procedimento</div>
  <ol class="ol txt"><li>Confirmação de identidade, indicação, alergias e medicação (incluindo anti-agregantes/anticoagulantes).</li><li>Colheita de sangue venoso (quantidade definida pelo protocolo).</li><li>Processamento em centrífuga/kit próprio para obtenção de PRP.</li><li>Preparação asséptica da pele; anestesia local se indicada.</li><li>Inserção de agulha na articulação/estrutura (com ou sem guia ecográfica) e aplicação do PRP.</li><li>Penso; observação breve e instruções pós-procedimento. Duração total: 10–30 minutos.</li></ol>
  <div class="sec">Riscos e Complicações</div>
  <div class="bold txt">Frequentes:</div>
  <ul class="ul txt"><li>Dor pós-injecção: ligeira (~28%), moderada (~16%), intensa (~3%).</li><li>Inchaço/edema local (~19%).</li><li>Rigidez transitória e febre ligeira/mal-estar (~5%).</li></ul>
  <div class="bold txt">Raros:</div>
  <ul class="ul txt"><li>Hematoma/hemartrose.</li><li>Reacção inflamatória intensa.</li><li>Infecção articular (artrite séptica) — rara (~0,001%–0,072%).</li><li>Lesão de nervo/vaso/tendão por agulha — muito rara.</li><li>Reacção vasovagal (desmaio).</li></ul>
  <div class="sec">Contraindicações</div>
  <ul class="ul txt"><li>Infecção local/sistémica activa ou febre.</li><li>Doença oncológica/hematológica em fases específicas.</li><li>Trombocitopenia grave.</li><li>Anticoagulantes/anti-agregantes — avaliar suspensão ~1 semana antes.</li><li>Cirurgia articular programada nos próximos 3 meses.</li></ul>
  <div class="sec">Instruções Antes e Após</div>
  <div class="bold txt">Antes:</div><ul class="ul txt"><li>Informar toda a medicação, especialmente anti-inflamatórios, anti-agregantes e anticoagulantes.</li><li>Suspender AINEs/AAS ~1 semana antes.</li><li>Comunicar qualquer infecção, febre ou ferida cutânea.</li></ul>
  <div class="bold txt">Após:</div><ul class="ul txt"><li>Evitar sobrecarga articular nas primeiras 24 horas; não imobilizar.</li><li>Evitar AINEs/AAS durante ~1 semana após o procedimento.</li><li>Paracetamol se necessário para controlo da dor.</li><li>Seguimento em consulta: ${escH(cf.seguimento||"___")} semanas.</li></ul>
  <div class="warn"><b>Sinais de Alarme:</b> ☐ Febre &gt;38°C &nbsp; ☐ Dor intensa e progressiva &nbsp; ☐ Inchaço acentuado &nbsp; ☐ Rubor/calor intenso &nbsp; ☐ Pus/secreção<br><b>Urgência: 916 390 074</b> &nbsp; Emergência: <b>112</b></div>
  <div class="sec">Declaração de Consentimento</div>
  <div class="decl">
    <div class="txt">☑ Recebi informação oral e escrita sobre o procedimento, benefícios, riscos e alternativas.</div>
    <div class="txt">☑ Tive oportunidade de colocar questões e obtive respostas satisfatórias.</div>
    <div class="txt">☑ Compreendi que posso revogar este consentimento antes do início do procedimento.</div>
    <div class="txt">☑ Consinto livremente na realização do procedimento descrito neste documento.</div>
  </div>
  <div class="txt"><b>Articulação / Estrutura a tratar:</b> ${escH(cf.articulacao||"—")} &nbsp;&nbsp;&nbsp; <b>Técnica:</b> ${tA} Anatómica &nbsp; ${tE} Ecoguiada</div>
  <div class="sig-wrap"><div class="sig-grid">
    <div><div class="sig-lbl">Assinatura do doente:</div><div class="sig-area">${sigImg(patientSig)}</div><div class="sig-date">Data: ${today}</div></div>
    <div><div class="sig-lbl">Médico: Dr. João Morais &nbsp; Cédula: 44380</div><div class="sig-area">${sigImg(doctorSig)}</div><div class="sig-date">Data: ${today}</div></div>
  </div><div class="txt muted" style="margin-top:6px;">Exemplar: ☐ Doente &nbsp; ☐ Processo clínico</div></div>
  `;
}

/* ── Corticoide ───────────────────────────────────────── */
function bodyCorticoide({ patName, patDob, patNif, patPhone, patEmail, clinicName, clinicAddr, clinicPhone, clinicEmail, chk, cf, today, sigImg, patientSig, doctorSig }) {
  const tA = cf.tecnica === "Ecoguiada" ? "☐" : "☑";
  const tE = cf.tecnica === "Ecoguiada" ? "☑" : "☐";
  return `
  <div class="doc-title">CONSENTIMENTO INFORMADO — Infiltração com Corticosteróide</div>
  <div class="grid2">
    <div class="f"><b>Clínica / Local:</b> ${clinicName}</div><div class="f"><b>Morada:</b> ${clinicAddr}</div>
    <div class="f"><b>Contacto:</b> ${clinicPhone}</div><div class="f"><b>Email:</b> ${clinicEmail}</div>
    <div class="f" style="grid-column:1/-1;"><b>Modalidade:</b> ${chk("presencial")} Presencial &nbsp;&nbsp; ${chk("teleconsulta")} Teleconsulta</div>
  </div>
  <div class="grid2">
    <div class="f" style="grid-column:1/-1;"><b>Doente:</b> ${patName}</div>
    <div class="f"><b>Data de nascimento:</b> ${patDob}</div><div class="f"><b>N.º CC / NIF:</b> ${patNif}</div>
    <div class="f"><b>Telefone:</b> ${patPhone}</div><div class="f"><b>Email:</b> ${patEmail}</div>
  </div>
  <div class="sec">Dados do Procedimento</div>
  <div class="txt"><b>Fármaco:</b> ${escH(cf.farmaco||"—")} &nbsp;&nbsp; <b>Dose:</b> ${escH(cf.dose||"—")} &nbsp;&nbsp; <b>Lote/Validade:</b> ${escH(cf.lote||"—")} &nbsp;&nbsp; <b>Anestésico local:</b> ${escH(cf.anestesico||"—")}</div>
  <div class="sec">Resumo em Linguagem Simples</div>
  <div class="txt"><b>O que é:</b> Injecção de um corticosteróide dentro da articulação para reduzir rapidamente a inflamação e a dor.</div>
  <div class="txt"><b>Objectivo:</b> Alívio rápido de crise ("flare") inflamatória. O efeito é geralmente temporário.</div>
  <div class="txt"><b>Probabilidade de benefício:</b> Cerca de 61% com resposta WOMAC40 às 4 semanas; literatura refere ~70% (variável).</div>
  <div class="txt"><b>Duração típica do efeito:</b> 2–4 semanas; por vezes até ~6 semanas.</div>
  <div class="txt"><b>Efeitos mais comuns:</b> Aumento transitório de dor nas primeiras 24–48 h ("flare pós-injecção"), rubor facial.</div>
  <div class="txt"><b>Em doentes com diabetes:</b> Pode elevar transitoriamente a glicemia nos primeiros dias — monitorizar.</div>
  <div class="sec">Descrição do Procedimento</div>
  <ol class="ol txt"><li>Confirmação de identidade, indicação, alergias e medicação (incluindo anticoagulantes e antidiabéticos).</li><li>Desinfeção e técnica estéril rigorosa.</li><li>Inserção de agulha intra-articular (com ou sem guia ecográfica); aspiração de derrame se indicado.</li><li>Injecção do corticosteróide (± anestésico local) e penso.</li><li>Observação breve e instruções. Duração total: 10–20 minutos.</li></ol>
  <div class="sec">Riscos e Complicações</div>
  <div class="bold txt">Frequentes:</div>
  <ul class="ul txt"><li>"Flare" pós-injecção (aumento transitório de dor 24–48 h) — reportado em 4–35%.</li><li>Dor local e pequeno hematoma.</li><li>Rubor/afrontamentos transitório.</li></ul>
  <div class="bold txt">Raros:</div>
  <ul class="ul txt"><li>Infecção articular (artrite séptica) — rara (~0,001%–0,093%).</li><li>Hemartrose.</li><li>Alterações cutâneas locais (atrofia subcutânea, hipopigmentação).</li><li>Reacção alérgica.</li><li>Em doentes com diabetes: hiperglicemia transitória 24–72 h; monitorizar até 1 semana.</li><li>Uso repetido: possível perda de espessura cartilagínea a longo prazo.</li></ul>
  <div class="sec">Contraindicações</div>
  <ul class="ul txt"><li>Infecção local ou sistémica activa/suspeita de artrite séptica.</li><li>Alergia ao fármaco ou excipientes.</li><li>Coagulopatia grave não controlada.</li><li>Diabetes mellitus mal controlada.</li><li>Cirurgia articular programada nos próximos 3 meses.</li></ul>
  <div class="sec">Instruções Antes e Após</div>
  <div class="bold txt">Antes:</div><ul class="ul txt"><li>Informar toda a medicação, especialmente anticoagulantes/anti-agregantes e antidiabéticos.</li><li>Comunicar qualquer infecção, febre ou ferida cutânea próxima do local.</li></ul>
  <div class="bold txt">Após:</div><ul class="ul txt"><li>Evitar sobrecarga articular nas primeiras 24 horas; não imobilizar.</li><li>Gelo local e paracetamol se necessário.</li><li>Doentes com diabetes: monitorizar glicemia com maior frequência por 3–7 dias.</li><li>Seguimento em consulta: ${escH(cf.seguimento||"___")} semanas.</li></ul>
  <div class="warn"><b>Sinais de Alarme:</b> ☐ Febre &gt;38°C &nbsp; ☐ Dor intensa e progressiva &nbsp; ☐ Inchaço acentuado &nbsp; ☐ Rubor/calor intenso &nbsp; ☐ Pus/secreção<br><b>Urgência: 916 390 074</b> &nbsp; Emergência: <b>112</b></div>
  <div class="sec">Declaração de Consentimento</div>
  <div class="decl">
    <div class="txt">☑ Recebi informação oral e escrita sobre o procedimento, benefícios, riscos e alternativas.</div>
    <div class="txt">☑ Tive oportunidade de colocar questões e obtive respostas satisfatórias.</div>
    <div class="txt">☑ Compreendi que posso revogar este consentimento antes do início do procedimento.</div>
    <div class="txt">☑ Consinto livremente na realização do procedimento descrito neste documento.</div>
  </div>
  <div class="txt"><b>Articulação / Estrutura a tratar:</b> ${escH(cf.articulacao||"—")} &nbsp;&nbsp;&nbsp; <b>Técnica:</b> ${tA} Anatómica &nbsp; ${tE} Ecoguiada</div>
  <div class="sig-wrap"><div class="sig-grid">
    <div><div class="sig-lbl">Assinatura do doente:</div><div class="sig-area">${sigImg(patientSig)}</div><div class="sig-date">Data: ${today}</div></div>
    <div><div class="sig-lbl">Médico: Dr. João Morais &nbsp; Cédula: 44380</div><div class="sig-area">${sigImg(doctorSig)}</div><div class="sig-date">Data: ${today}</div></div>
  </div><div class="txt muted" style="margin-top:6px;">Exemplar: ☐ Doente &nbsp; ☐ Processo clínico</div></div>
  `;
}

/* ── Ácido Hialurónico ────────────────────────────────── */
function bodyAh({ patName, patDob, patNif, patPhone, patEmail, clinicName, clinicAddr, clinicPhone, clinicEmail, chk, cf, today, sigImg, patientSig, doctorSig }) {
  const tA = cf.tecnica === "Ecoguiada" ? "☐" : "☑";
  const tE = cf.tecnica === "Ecoguiada" ? "☑" : "☐";
  return `
  <div class="doc-title">CONSENTIMENTO INFORMADO — Viscossuplementação com Ácido Hialurónico</div>
  <div class="grid2">
    <div class="f"><b>Clínica / Local:</b> ${clinicName}</div><div class="f"><b>Morada:</b> ${clinicAddr}</div>
    <div class="f"><b>Contacto:</b> ${clinicPhone}</div><div class="f"><b>Email:</b> ${clinicEmail}</div>
    <div class="f" style="grid-column:1/-1;"><b>Modalidade:</b> ${chk("presencial")} Presencial &nbsp;&nbsp; ${chk("teleconsulta")} Teleconsulta</div>
  </div>
  <div class="grid2">
    <div class="f" style="grid-column:1/-1;"><b>Doente:</b> ${patName}</div>
    <div class="f"><b>Data de nascimento:</b> ${patDob}</div><div class="f"><b>N.º CC / NIF:</b> ${patNif}</div>
    <div class="f"><b>Telefone:</b> ${patPhone}</div><div class="f"><b>Email:</b> ${patEmail}</div>
  </div>
  <div class="sec">Dados do Procedimento</div>
  <div class="txt"><b>Produto / Marca:</b> ${escH(cf.produto||"—")} &nbsp;&nbsp; <b>Lote:</b> ${escH(cf.lote||"—")} &nbsp;&nbsp; <b>Validade:</b> ${escH(cf.validade||"—")} &nbsp;&nbsp; <b>N.º injecções:</b> ${escH(cf.ninjeccoes||"—")} &nbsp;&nbsp; <b>Intervalo:</b> ${escH(cf.intervalo||"—")}</div>
  <div class="sec">Resumo em Linguagem Simples</div>
  <div class="txt"><b>O que é:</b> Injecção de ácido hialurónico (substância natural presente nas articulações) para melhorar a lubrificação e reduzir a dor.</div>
  <div class="txt"><b>Objectivo:</b> Melhorar sintomas (dor e função). O efeito é variável e não garante cura.</div>
  <div class="txt"><b>Probabilidade de benefício:</b> Cerca de 59–65% dos doentes são "respondedores" até 6 meses (critérios OMERACT-OARSI).</div>
  <div class="txt"><b>Efeitos mais comuns:</b> Dor e inchaço transitórios no local da injecção.</div>
  <div class="txt"><b>Riscos raros mas importantes:</b> Infecção articular, reacção inflamatória aguda.</div>
  <div class="txt"><b>Alternativas:</b> Fisioterapia/exercício, infiltração de corticóide ou PRP, cirurgia.</div>
  <div class="sec">Descrição do Procedimento</div>
  <ol class="ol txt"><li>Confirmação de identidade, indicação, alergias e medicação.</li><li>Preparação asséptica rigorosa da pele.</li><li>Inserção de agulha intra-articular (com ou sem guia ecográfica); aspiração de derrame se presente.</li><li>Injecção do ácido hialurónico e penso.</li><li>Observação breve e instruções pós-procedimento. Duração total: 10–20 minutos.</li></ol>
  <div class="sec">Riscos e Complicações</div>
  <div class="bold txt">Frequentes:</div>
  <ul class="ul txt"><li>Dor local e inchaço transitórios após a injecção.</li><li>Pequeno hematoma no local de punção.</li><li>Rigidez transitória.</li></ul>
  <div class="bold txt">Raros:</div>
  <ul class="ul txt"><li>Reacção inflamatória aguda ("pseudosséptica") — rara; incidência variável por produto.</li><li>Infecção articular (artrite séptica) — rara (~0,001%–0,03%).</li><li>Eventos adversos graves — ligeiramente mais frequentes que placebo em meta-análise.</li><li>Reacção alérgica.</li><li>Hemartrose.</li></ul>
  <div class="sec">Contraindicações</div>
  <ul class="ul txt"><li>Infecção local ou sistémica activa/febre.</li><li>Alergia conhecida ao ácido hialurónico ou excipientes do produto.</li><li>Coagulopatia grave não controlada.</li><li>Cirurgia articular programada nos próximos 3 meses.</li><li>Derrame articular volumoso (aspirar previamente se indicado).</li></ul>
  <div class="sec">Instruções Antes e Após</div>
  <div class="bold txt">Antes:</div><ul class="ul txt"><li>Informar toda a medicação, especialmente anticoagulantes.</li><li>Comunicar qualquer infecção, febre ou ferida cutânea próxima do local.</li></ul>
  <div class="bold txt">Após:</div><ul class="ul txt"><li>Evitar sobrecarga articular nas primeiras 24 horas; não imobilizar.</li><li>Gelo local e paracetamol se necessário. Não aplicar calor nas primeiras 24 horas.</li><li>Seguimento em consulta: ${escH(cf.seguimento||"___")} semanas.</li></ul>
  <div class="warn"><b>Sinais de Alarme:</b> ☐ Febre &gt;38°C &nbsp; ☐ Dor intensa e progressiva &nbsp; ☐ Inchaço acentuado &nbsp; ☐ Rubor/calor intenso &nbsp; ☐ Pus/secreção<br><b>Urgência: 916 390 074</b> &nbsp; Emergência: <b>112</b></div>
  <div class="sec">Declaração de Consentimento</div>
  <div class="decl">
    <div class="txt">☑ Recebi informação oral e escrita sobre o procedimento, benefícios, riscos e alternativas.</div>
    <div class="txt">☑ Tive oportunidade de colocar questões e obtive respostas satisfatórias.</div>
    <div class="txt">☑ Compreendi que posso revogar este consentimento antes do início do procedimento.</div>
    <div class="txt">☑ Consinto livremente na realização do procedimento descrito neste documento.</div>
  </div>
  <div class="txt"><b>Articulação / Estrutura a tratar:</b> ${escH(cf.articulacao||"—")} &nbsp;&nbsp;&nbsp; <b>Técnica:</b> ${tA} Anatómica &nbsp; ${tE} Ecoguiada</div>
  <div class="sig-wrap"><div class="sig-grid">
    <div><div class="sig-lbl">Assinatura do doente:</div><div class="sig-area">${sigImg(patientSig)}</div><div class="sig-date">Data: ${today}</div></div>
    <div><div class="sig-lbl">Médico: Dr. João Morais &nbsp; Cédula: 44380</div><div class="sig-area">${sigImg(doctorSig)}</div><div class="sig-date">Data: ${today}</div></div>
  </div><div class="txt muted" style="margin-top:6px;">Exemplar: ☐ Doente &nbsp; ☐ Processo clínico</div></div>
  `;
}
