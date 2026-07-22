/**
 * pedidos-v2.js
 * Modal "Pedidos" (Análises + Exames) — Passo 5: ligado aos botões do feed.
 *
 * Análises: renderizado a partir de ANALISES_GRUPOS / ANALISES_PERFIS
 * (analises-catalog-v2.js, import estático).
 * Exames: carregado de exams_catalog via window.sb (mesmo padrão de
 * exames.js), agrupado por category+subcategory (equivalente generalizado
 * a getExamGroupLabel de exames.js — ver nota no cabeçalho da função).
 * Doente: se options.patientId vier, o módulo carrega full_name/dob/nif/sns/
 * cc_number/address_line1/postal_code/city/insurance_provider/
 * insurance_policy_number — os mesmos campos que buildPatientCard
 * (patient-card.js) usa, mais seguradora/apólice (extensão do componente,
 * ver patient-card.js). O cabeçalho navy do modal fica com uma versão
 * simplificada (nome+DN+idade+NIF, texto claro sobre navy); os dois cartões
 * "Cabeçalho V2" (Análises e Exames) usam buildPatientCard() a sério — a
 * mesma função usada no corpo do PDF, não uma reimplementação à parte.
 * Nada disto bloqueia a abertura do modal ("A carregar…" até resolver;
 * aviso claro se falhar/não existir).
 *
 * PDF: gerado self-contained (SEM window.openDocumentEditor/doente.js,
 * que não existem no contexto de feed-doente.html) — replica o padrão de
 * relatorio-consulta.js/atestado.js: buildShellV2 (import estático) +
 * buildPatientCard + fetch directo ao worker gc-pdf-proxy + upload para
 * Storage + insert em documents. Análises gera 1 PDF; Exames gera 1 PDF
 * por modalidade, em sequência (não paralelo), com progresso visível e
 * paragem imediata em caso de falha a meio (ver onGerarExamesPdf).
 *
 * Tudo o que precisa de Supabase usa window.sb directamente.
 *
 * Uso (dentro de #fdModalRoot do feed, que já tem all:initial + box-sizing
 * aplicado a si e a todos os descendentes — ver feed-doente.html):
 *
 *   import { mount, unmount } from './pedidos-v2.js';
 *   mount(container, { patientId, consultationId, initialTab, onClose });
 *   // initialTab: 'analises' (default) ou 'exames' — só define o separador
 *   // activo no arranque, não muda mais nenhuma lógica.
 *   // ou, sem BD (ex.: testes de esqueleto visual): mount(container, { patientName, patientMeta, onClose });
 *   ...
 *   unmount(container);
 */

import { ANALISES_GRUPOS, ANALISES_PERFIS } from "./analises-catalog-v2.js";
import { buildShellV2, loadClinicById, loadCurrentDoctor, getVinhetaDataUrl } from "../relatorios/v2/_shell/shell-v2.js";
import { buildPatientCard } from "../relatorios/v2/_components/patient-card.js";

const STYLE_ID = "pdv2-styles";

const EXAM_GROUP_ICONS = {
  "Cardiologia": "🫀",
  "Provas Funcionais Respiratórias": "🫁",
  "Ressonância Magnética": "🧲",
  "Tomografia Computorizada": "🖥️",
  "Ecografia Osteoarticular": "📡",
  "Ecografia Partes Moles": "📡",
  "Radiografia": "☢️",
  "Densitometria Óssea": "🦴"
};
const EXAM_QUICK_CATEGORIAS = ["Cardiologia", "Provas Funcionais Respiratórias"];
const EXAM_QUICK_REGIOES = ["Ombro", "Joelho", "Coluna lombar", "Anca"];

/**
 * ANALISES_PRESELECAO_DEFAULT
 * Nomes exactos de ANALISES_GRUPOS[].items[].name — pré-seleccionados só na
 * abertura inicial do modal (mount), só no separador Análises. Não se aplica a
 * Exames. Só popula o Set inicial de state.analises.selected — depois disso o
 * utilizador controla livremente (desmarcar não volta a marcar sozinho).
 */
const ANALISES_PRESELECAO_DEFAULT = [
  "Hemograma completo",
  "Glicose em jejum", "Hemoglobina glicada (HbA1c)", "Ureia", "Creatinina", "Cistatina-C",
  "Ácido úrico", "Ionograma (Sódio, Potássio, Cloro)", "Aspartato aminotransferase (AST / TGO)",
  "Alanina aminotransferase (ALT / TGP)", "Fosfatase alcalina (FA)", "Gama-glutamiltransferase (GGT)",
  "Proteínas totais e albumina",
  "Proteína C reativa ultra-sensível (PCR-us)", "Velocidade de sedimentação (VS)",
  "Vitamina D (25-hidroxivitamina D)", "Magnésio",
  "Cálcio total",
  "Colesterol total", "Colesterol LDL", "Colesterol HDL", "Triglicerídeos", "Apolipoproteína B",
  "Lipoproteína (a) — Lp(a)",
  "Hormona tiroestimulante (TSH)",
  "Exame sumário de urina (EAU)"
];

const PDF_PROXY_URL = "https://gc-pdf-proxy.dr-joao-morais.workers.dev/pdf";
const MIN_PDF_BYTES = 5000; // mesmo limiar de "provável em branco" que doente.js usa (generatePdfAndUploadV1)
const SHELL_CSS_URL = new URL("../relatorios/v2/_shell/shell-v2.css", import.meta.url).href;
// .gcv2-patient-card/.gcv2-pc-* só têm estilo em atestado.css (shell-v2.css não os define) —
// relatorio-consulta.js também carrega os dois (ensureShellCss + ensureAtestadoCss) pelo mesmo motivo.
const PATIENT_CARD_CSS_URL = new URL("../relatorios/v2/atestados/atestado.css", import.meta.url).href;
const DOC_EXTRA_CSS = `
  .pdv2-doc-cols{column-count:2;column-gap:24px;}
  .pdv2-doc-section{margin-bottom:14px;break-inside:avoid;page-break-inside:avoid;-webkit-column-break-inside:avoid;}
  /* Linha divisória entre blocos de análises — sem título por cima (removido a pedido).
     Scoped a .pdv2-doc-cols (só Análises) para não acrescentar borda aos PDFs de Exames,
     que reutilizam .pdv2-doc-section fora desse contentor. */
  .pdv2-doc-cols .pdv2-doc-section{border-top:1px solid #e2e2e6;padding-top:8px;}
  .pdv2-doc-list{margin:0;padding-left:18px;font-size:13px;line-height:1.6;}
  .pdv2-doc-list li{margin-bottom:2px;}
  .pdv2-doc-prose{font-size:13px;line-height:1.6;white-space:pre-wrap;}
  .pdv2-clinical-info{font-size:11px;color:#555;margin:2px 0 0 4px;white-space:pre-wrap;}
`;

function escHtml(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function normalizeTxt(s) {
  return String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * examGroupLabel
 * Generalização de getExamGroupLabel (exames.js): combina category+subcategory
 * quando existe subcategory, em vez de uma lista fechada de categorias
 * conhecidas — necessário para mostrar categorias novas (Cardiologia, Provas
 * Funcionais Respiratórias) que getExamGroupLabel ainda não reconhece.
 */
function examGroupLabel(exam) {
  const category = String(exam?.category || "").trim();
  const subcategory = String(exam?.subcategory || "").trim();
  return subcategory ? `${category} ${subcategory}` : category;
}

function examGroupIcon(label) {
  return EXAM_GROUP_ICONS[label] || "🩺";
}

/**
 * calcAge / formatHeaderMeta
 * calcAge continua a existir só para o cabeçalho simplificado do modal
 * (.pdv2-head, fundo navy — buildPatientCard não pode ser usada aí
 * directamente, as suas cores de texto (#4b5563/#6b7280) foram desenhadas
 * para fundo branco e ficam ilegíveis em navy). O cartão "Cabeçalho V2" da
 * coluna direita já não usa esta função — usa buildPatientCard() a sério
 * (ver buildIdCardHtml), que faz o seu próprio cálculo de idade.
 */
function calcAge(iso) {
  if (!iso) return null;
  const nasc = new Date(iso);
  if (isNaN(nasc.getTime())) return null;
  const hoje = new Date();
  let anos = hoje.getFullYear() - nasc.getFullYear();
  if (hoje < new Date(hoje.getFullYear(), nasc.getMonth(), nasc.getDate())) anos--;
  return anos;
}

function formatHeaderMeta(p) {
  // Só nome (já está fora desta função) + DN/idade + NIF — versão mínima do
  // cabeçalho. Seguradora/apólice não entra aqui (ficaria a poluir a barra
  // navy); já aparece no cartão "Cabeçalho V2" via buildPatientCard.
  const bits = [];
  if (p.dob) {
    const d = new Date(p.dob);
    if (!isNaN(d.getTime())) {
      const idade = calcAge(p.dob);
      bits.push(`DN ${d.toLocaleDateString("pt-PT")}${idade !== null ? ` (${idade} anos)` : ""}`);
    }
  }
  if (p.nif) bits.push(`NIF ${p.nif}`);
  return bits.join(" · ");
}

/**
 * loadPatientData
 * Mesmos campos que buildPatientCard (patient-card.js) usa: full_name, dob,
 * nif, sns, cc_number, address_line1, postal_code, city — mais
 * insurance_provider/insurance_policy_number (extensão sobre o componente,
 * ver patient-card.js). Sem passport_id — removido do componente partilhado
 * nesta sessão. clinic_id vem de patient_clinic (mesmo padrão de
 * exames.js openExamClinicalInfoStep) — necessário para o path de Storage,
 * para loadClinicById (nome da clínica, reaproveitado de ensurePdfAssets
 * tanto para o PDF como para o cartão em ecrã) e para gerar o PDF.
 */
async function loadPatientData(patientId) {
  const [patientRes, clinicRes] = await Promise.all([
    window.sb
      .from("patients")
      .select("full_name, dob, nif, sns, cc_number, address_line1, postal_code, city, insurance_provider, insurance_policy_number")
      .eq("id", patientId)
      .single(),
    window.sb
      .from("patient_clinic")
      .select("clinic_id")
      .eq("patient_id", patientId)
      .eq("is_active", true)
      .maybeSingle()
  ]);
  if (patientRes.error || !patientRes.data) throw patientRes.error || new Error("doente não encontrado");
  return { ...patientRes.data, clinicId: clinicRes.data?.clinic_id || null };
}

/**
 * generateDocNumber
 * Mesma fórmula que relatorio-consulta.js já usa (não há sequência
 * canónica na BD — doc_number/doc_suffix são texto livre, sem tabela de
 * numeração). JM-{ano 2 díg.}-{5 díg. de segundos}-A.
 */
function generateDocNumber() {
  const y = new Date().getFullYear().toString().slice(-2);
  const s = String(Math.floor(Date.now() / 1000) % 100000).padStart(5, "0");
  return `JM-${y}-${s}-A`;
}

function slugifyLabel(s) {
  return normalizeTxt(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "doc";
}

/**
 * renderPdfViaProxy
 * Mesmo endpoint/payload que relatorio-consulta.js e atestado.js
 * ({ html, media: 'print' }). Verifica blob.size < MIN_PDF_BYTES como
 * doente.js (generatePdfAndUploadV1) — PDF suspeitosamente pequeno conta
 * como erro, não sucesso silencioso.
 */
async function renderPdfViaProxy(html) {
  const resp = await fetch(PDF_PROXY_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ html, media: "print" })
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`PDF worker erro ${resp.status}: ${errText.slice(0, 200)}`);
  }
  const buf = await resp.arrayBuffer();
  const blob = new Blob([buf], { type: "application/pdf" });
  if (!blob || blob.size < MIN_PDF_BYTES) {
    throw new Error("PDF inválido ou demasiado pequeno (provável em branco).");
  }
  return blob;
}

/**
 * uploadAndRegisterDocument
 * Storage bucket 'documents', path clinic_{id}/patient_{id}/{folder}/{ficheiro}.pdf,
 * upsert:true (padrão dos módulos v2). Insert em documents com os campos
 * reais da tabela (ver sessão 4d — schema confirmado via Supabase).
 */
async function uploadAndRegisterDocument({ blob, clinicId, patientId, consultationId, title, category, html, docNumber, folder, fileNameHint }) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = fileNameHint ? `${fileNameHint}_${ts}.pdf` : `${ts}.pdf`;
  const path = `clinic_${clinicId}/patient_${patientId}/${folder}/${fileName}`;

  const up = await window.sb.storage.from("documents").upload(path, blob, {
    contentType: "application/pdf",
    upsert: true
  });
  if (up.error) throw new Error(`Falha no upload para Storage: ${up.error.message || up.error}`);

  const ins = await window.sb.from("documents").insert({
    clinic_id: clinicId,
    patient_id: patientId,
    consultation_id: consultationId || null,
    title,
    html: html || "",
    storage_path: path,
    category,
    doc_number: docNumber || null
  }).select("id").single();
  if (ins.error) throw new Error(`Falha ao registar em documents: ${ins.error.message || ins.error}`);

  return { path, id: ins.data?.id || null };
}

/**
 * loadExamsCatalog
 * Mesmo padrão de modules/exames.js (loadExamsCatalog): window.sb direto,
 * sem window.opener. Só exames agrupáveis (is_direct = false).
 */
async function loadExamsCatalog() {
  try {
    const { data, error } = await window.sb
      .from("exams_catalog")
      .select("id, category, subcategory, exam_name, sort_order, body_region")
      .eq("is_active", true)
      .eq("is_direct", false)
      .order("category", { ascending: true })
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error("[pedidos-v2] erro ao carregar exams_catalog:", err);
    return [];
  }
}

function ensurePatientCardCss() {
  // .gcv2-patient-card/.gcv2-pc-* (usadas pelo cartão "Cabeçalho V2" em ecrã, via
  // buildPatientCard) só têm estilo em atestado.css — mesmo ficheiro já usado para o
  // PDF (PATIENT_CARD_CSS_URL). Carrega-o também na página anfitriã, padrão idêntico ao
  // ensureAtestadoCss() de atestado.js. Selectores todos prefixados .gcv2-* — sem risco
  // de colidir com o resto do feed.
  if (document.querySelector('link[data-pdv2-patient-card-css]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = PATIENT_CARD_CSS_URL;
  link.dataset.pdv2PatientCardCss = "1";
  document.head.appendChild(link);
}

function ensureStyles() {
  ensurePatientCardCss();
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

function removeStyles() {
  document.getElementById(STYLE_ID)?.remove();
}

/**
 * mount
 * Constrói o modal de Pedidos dentro de `container`, com dados reais.
 */
export function mount(container, options = {}) {
  if (!container) return;

  const today = new Date().toISOString().slice(0, 10);

  ensureStyles();

  /* ---- estado (por montagem — fecha sobre `container`) ---- */
  const state = {
    patientId: options.patientId || null,
    consultationId: options.consultationId || null,
    patient: options.patientId
      ? { name: "A carregar…", meta: "", status: "loading", raw: null, clinicId: null }
      : { name: options.patientName || "Doente de exemplo", meta: options.patientMeta || "DN — · NIF — · Seguro —", status: "ready", raw: null, clinicId: null },
    pdfAssets: { loaded: false, clinic: null, doctor: null, vinhetaUrl: null },
    analises: {
      selected: new Set(),      // nomes exactos (ANALISES_GRUPOS[].items[].name)
      openGroups: new Set(),    // ids de grupo abertos manualmente
      search: "",
      clinicalInfo: "",
      date: today,
      generating: false,
      statusMsg: null           // { type: 'info'|'success'|'error', text }
    },
    exames: {
      rows: [],
      loaded: false,
      selected: new Set(),      // exam ids (uuid)
      clinicalInfoByExam: new Map(), // exam id -> texto de informação clínica (por exame)
      openGroups: new Set(),    // group labels (examGroupLabel) abertos manualmente
      search: "",
      date: today,
      generating: false,
      progress: null,           // { current, total, label } enquanto gera
      lastRun: null             // { total, results: [{label, ok, url|error}] } depois de gerar
    }
  };

  // Pré-selecção por defeito — só aqui, na criação do estado (mount). Depois disto
  // o utilizador controla livremente state.analises.selected; reabrir o modal cria
  // um `state` novo e corre isto outra vez, restaurando a pré-selecção completa.
  ANALISES_PRESELECAO_DEFAULT.forEach((name) => state.analises.selected.add(name));
  ANALISES_GRUPOS.forEach((grp) => {
    if (grp.items.some((it) => ANALISES_PRESELECAO_DEFAULT.includes(it.name))) {
      state.analises.openGroups.add(grp.id);
    }
  });

  const initialTab = options.initialTab === "exames" ? "exames" : "analises";

  container.innerHTML = `
    <div class="pdv2-overlay">
      <div class="pdv2-modal">

        <div class="pdv2-head">
          <div class="pdv2-titulo">Pedidos</div>
          <div class="pdv2-doente">
            <span><b data-pdv2="head-nome">${escHtml(state.patient.name)}</b></span>
            <span data-pdv2="head-meta">${escHtml(state.patient.meta)}</span>
          </div>
          <button class="pdv2-fechar" data-pdv2="fechar">Fechar</button>
        </div>

        <div class="pdv2-tabs">
          <div class="pdv2-tab ${initialTab === "analises" ? "pdv2-tab--on" : ""}" data-pdv2-tab="analises">Análises <span class="pdv2-n">0</span></div>
          <div class="pdv2-tab ${initialTab === "exames" ? "pdv2-tab--on" : ""}" data-pdv2-tab="exames">Exames <span class="pdv2-n">0</span></div>
        </div>

        <div class="pdv2-tabpanel ${initialTab === "analises" ? "pdv2-tabpanel--on" : ""}" data-pdv2-panel="analises" style="${initialTab === "analises" ? "" : "display:none;"}"></div>
        <div class="pdv2-tabpanel ${initialTab === "exames" ? "pdv2-tabpanel--on" : ""}" data-pdv2-panel="exames" style="${initialTab === "exames" ? "" : "display:none;"}"></div>

      </div>
    </div>
  `;

  /* ================================================================
     ANÁLISES
     ================================================================ */

  function buildAnalisesQuickHtml() {
    const chips = ANALISES_PERFIS.map((p) => {
      if (!p.submenu) {
        return `<button class="pdv2-chip" data-pdv2-perfil="${escHtml(p.id)}">${escHtml(p.label)}</button>`;
      }
      const opts = p.submenu.map((s) =>
        `<button class="pdv2-op" data-pdv2-perfil="${escHtml(p.id)}" data-pdv2-sub="${escHtml(s.id)}">${escHtml(s.label)}</button>`
      ).join("");
      return `
        <div class="pdv2-chipWrap" data-pdv2="chipwrap">
          <button class="pdv2-chip">${escHtml(p.label)} ▾</button>
          <div class="pdv2-chipMenu">${opts}</div>
        </div>`;
    }).join("");

    return `
      <span class="pdv2-lbl">Perfis rápidos</span>
      ${chips}
      <input class="pdv2-search" type="text" data-pdv2-role="search"
        placeholder="Pesquisar análise… (ferritina, PCR, TSH)" value="${escHtml(state.analises.search)}">
    `;
  }

  function buildAnalisesGroupsHtml() {
    const qNorm = normalizeTxt(state.analises.search.trim());
    let anyGroup = false;
    const html = ANALISES_GRUPOS.map((grp) => {
      const filtered = qNorm ? grp.items.filter((it) => normalizeTxt(it.name).includes(qNorm)) : grp.items;
      if (qNorm && filtered.length === 0) return "";
      anyGroup = true;
      const isOpen = qNorm ? true : state.analises.openGroups.has(grp.id);
      const selCount = grp.items.reduce((n, it) => n + (state.analises.selected.has(it.name) ? 1 : 0), 0);
      const allSelected = filtered.length > 0 && filtered.every((it) => state.analises.selected.has(it.name));
      const itemsHtml = filtered.map((it) => {
        const checked = state.analises.selected.has(it.name);
        const infoBits = [it.info, it.subcategoria].filter(Boolean).join(" · ");
        return `
          <label class="pdv2-item">
            <input type="checkbox" data-pdv2-name="${escHtml(it.name)}" ${checked ? "checked" : ""}>
            <span>${escHtml(it.name)}${infoBits ? `<span class="pdv2-info">${escHtml(infoBits)}</span>` : ""}</span>
          </label>`;
      }).join("");
      return `
        <div class="pdv2-grp ${isOpen ? "pdv2-grp--open" : ""}" data-pdv2-grpid="${escHtml(grp.id)}">
          <div class="pdv2-grpHead">
            <span class="pdv2-nome">${grp.icon} ${escHtml(grp.label)} ${selCount ? `<span class="pdv2-badge">${selCount} sel.</span>` : ""}</span>
            <button type="button" class="pdv2-selall" data-pdv2-selall="${escHtml(grp.id)}">${allSelected ? "Nenhum" : "Tudo"}</button>
            <span class="pdv2-chev">${isOpen ? "▲" : "▼"}</span>
          </div>
          <div class="pdv2-grpItems">${itemsHtml}</div>
        </div>`;
    }).join("");
    return anyGroup ? html : `<div class="pdv2-vazio">Sem resultados para a pesquisa.</div>`;
  }

  function getAnalisesByGroupForSelected() {
    const firstGroupLabel = new Map();
    ANALISES_GRUPOS.forEach((grp) => {
      grp.items.forEach((it) => {
        if (!firstGroupLabel.has(it.name)) firstGroupLabel.set(it.name, grp.label);
      });
    });

    const byGroup = new Map();
    ANALISES_GRUPOS.forEach((grp) => {
      grp.items.forEach((it) => {
        if (!state.analises.selected.has(it.name)) return;
        if (firstGroupLabel.get(it.name) !== grp.label) return;
        if (!byGroup.has(grp.label)) byGroup.set(grp.label, []);
        if (!byGroup.get(grp.label).includes(it.name)) byGroup.get(grp.label).push(it.name);
      });
    });
    return byGroup;
  }

  function buildAnalisesPillsHtml() {
    if (!state.analises.selected.size) return `<div class="pdv2-vazio">Sem análises seleccionadas.</div>`;
    const byGroup = getAnalisesByGroupForSelected();
    let html = "";
    byGroup.forEach((names, label) => {
      html += `<div class="pdv2-pillGrp">${escHtml(label)}</div>`;
      names.forEach((name) => {
        html += `<div class="pdv2-pill"><span class="pdv2-miolo">${escHtml(name)}</span><span class="pdv2-x" data-pdv2-removename="${escHtml(name)}">×</span></div>`;
      });
    });
    return html;
  }

  function buildAnalisesDocBodyHtml() {
    // Sem título de secção (label do grupo) no PDF — só a lista, separada por
    // linha (border-top em .pdv2-doc-cols .pdv2-doc-section, ver DOC_EXTRA_CSS).
    // O título continua visível no ecrã (.pdv2-grpHead, buildAnalisesGroupsHtml)
    // — só desaparece no PDF final, não é tocado ali.
    const byGroup = getAnalisesByGroupForSelected();
    let html = "";
    byGroup.forEach((names) => {
      html += `<div class="pdv2-doc-section"><ul class="pdv2-doc-list">`;
      names.forEach((name) => { html += `<li>${escHtml(name)}</li>`; });
      html += `</ul></div>`;
    });
    if (state.analises.clinicalInfo.trim()) {
      html += `<div class="pdv2-doc-section"><p class="pdv2-doc-prose">${escHtml(state.analises.clinicalInfo)}</p></div>`;
    }
    // Só Análises — layout a 2 colunas para caber numa página com muitos itens
    // seleccionados (ex: pré-selecção de 26). Exames fica a 1 coluna (não tocar).
    return `<div class="pdv2-doc-cols">${html}</div>`;
  }

  /* ---- PDF: assets partilhados (clínica/médico/vinheta) + shell ---- */

  async function ensurePdfAssets() {
    if (state.pdfAssets.loaded) return state.pdfAssets;
    const [clinic, doctor, vinhetaUrl] = await Promise.all([
      loadClinicById(state.patient.clinicId),
      loadCurrentDoctor(),
      getVinhetaDataUrl()
    ]);
    state.pdfAssets = { loaded: true, clinic, doctor, vinhetaUrl };
    return state.pdfAssets;
  }

  async function buildFullDocHtml({ title, contentHtml, date }) {
    if (state.patient.status !== "ready") throw new Error("Doente ainda não carregado.");
    if (!state.patient.clinicId) throw new Error("Sem clínica activa associada ao doente.");
    const assets = await ensurePdfAssets();
    // Sem clinic aqui de propósito — igual a relatorio-consulta.js (a clínica já vai no
    // cabeçalho/rodapé do documento via buildShellV2 duas linhas abaixo, não se repete
    // dentro do cartão de identificação).
    const patientCardHtml = buildPatientCard({ patient: state.patient.raw, mode: "full" });
    const shellHtml = buildShellV2({
      clinic: assets.clinic,
      doctor: assets.doctor,
      config: { date, title, vinhetaUrl: assets.vinhetaUrl },
      contentHtml: `${patientCardHtml}${contentHtml}`
    });
    return `<!doctype html><html lang="pt-PT"><head><meta charset="utf-8"><link rel="stylesheet" href="${SHELL_CSS_URL}"><link rel="stylesheet" href="${PATIENT_CARD_CSS_URL}"><style>${DOC_EXTRA_CSS}</style></head><body>${shellHtml}</body></html>`;
  }

  /* ---- PDF: Análises (1 documento) ---- */

  async function onGerarAnalisesPdf() {
    if (state.analises.generating || !state.analises.selected.size) return;
    state.analises.generating = true;
    state.analises.statusMsg = { type: "info", text: "A gerar PDF…" };
    renderAnalisesPanel();

    try {
      const fullHtml = await buildFullDocHtml({
        title: "Pedido de Análises",
        contentHtml: buildAnalisesDocBodyHtml(),
        date: state.analises.date
      });
      const blob = await renderPdfViaProxy(fullHtml);
      await uploadAndRegisterDocument({
        blob,
        clinicId: state.patient.clinicId,
        patientId: state.patientId,
        consultationId: state.consultationId,
        title: "Pedido de Análises",
        category: "analises",
        html: fullHtml,
        docNumber: generateDocNumber(),
        folder: "analises"
      });
      window.open(URL.createObjectURL(blob), "_blank");
      state.analises.statusMsg = { type: "success", text: "PDF gerado e guardado com sucesso." };
    } catch (err) {
      console.error("[pedidos-v2] erro ao gerar PDF de análises:", err);
      state.analises.statusMsg = { type: "error", text: "Erro ao gerar PDF: " + (err?.message || err) };
    } finally {
      state.analises.generating = false;
      renderAnalisesPanel();
    }
  }

  /**
   * buildIdCardHtml
   * Cartão "Cabeçalho V2" — mesma buildPatientCard() do PDF final (não uma
   * reimplementação própria), reutilizada tal e qual nos separadores Análises e
   * Exames (chamada única, não há cópias). Sem clinic — igual a
   * relatorio-consulta.js, a clínica não entra neste cartão (já vai no
   * cabeçalho/rodapé do documento, via buildShellV2, só no PDF final). Enquanto o
   * doente ainda não carregou (ou falhou), buildPatientCard({patient:null}) devolve
   * '' — mostra-se o nome de estado (state.patient.name já traz "A carregar…" ou a
   * mensagem de erro).
   */
  function buildIdCardHtml() {
    const cardBody = (state.patient.status === "ready" && state.patient.raw)
      ? buildPatientCard({ patient: state.patient.raw, mode: "full" })
      : `<div class="gcv2-pc-line gcv2-pc-line-main">${escHtml(state.patient.name)}</div>`;
    return `
      <div class="pdv2-idCard">
        <span class="pdv2-v2tag">Cabeçalho V2</span>
        ${cardBody}
      </div>`;
  }

  function buildAnalisesPanelHtml() {
    const n = state.analises.selected.size;
    return `
      <div class="pdv2-quick">${buildAnalisesQuickHtml()}</div>
      <div class="pdv2-body">
        <div class="pdv2-colEsq">${buildAnalisesGroupsHtml()}</div>
        <div class="pdv2-colDir">
          <h3>Pedido actual</h3>

          ${buildIdCardHtml()}

          <div class="pdv2-pills">${buildAnalisesPillsHtml()}</div>

          <div class="pdv2-miniDoc">
            <div class="pdv2-mh"><div class="pdv2-logo"></div><div class="pdv2-tit">Pedido de Análises</div></div>
            <div class="pdv2-corpo"></div>
            <div class="pdv2-mf"><span>Dr. João Morais · OM 44380</span><span>Vinheta</span></div>
            <div class="pdv2-cap">Pré-visualização — sai com cabeçalho e rodapé do Relatório V2</div>
          </div>

          <div class="pdv2-rodape">
            <div class="pdv2-linha">
              <input type="text" data-pdv2-role="clininfo" placeholder="Informação clínica (opcional)…" value="${escHtml(state.analises.clinicalInfo)}">
              <input type="date" data-pdv2-role="date" value="${escHtml(state.analises.date)}">
            </div>
            <button class="pdv2-btnPdf" data-pdv2="gerarpdf-analises" ${(state.analises.generating || !n) ? "disabled" : ""}>${state.analises.generating ? "A gerar PDF…" : `Gerar PDF · ${n} análise${n === 1 ? "" : "s"}`}</button>
            ${state.analises.statusMsg ? `<div class="pdv2-docstatus pdv2-docstatus--${state.analises.statusMsg.type}">${escHtml(state.analises.statusMsg.text)}</div>` : ""}
            <div class="pdv2-notaPdf">Um único PDF com todas as análises seleccionadas</div>
          </div>
        </div>
      </div>
    `;
  }

  function applyPerfilAnalises(perfilId, subId) {
    const perfil = ANALISES_PERFIS.find((p) => p.id === perfilId);
    if (!perfil) return;
    const lista = subId ? perfil.submenu?.find((s) => s.id === subId)?.analises : perfil.analises;
    if (!lista) return;
    lista.forEach((name) => state.analises.selected.add(name));
    ANALISES_GRUPOS.forEach((grp) => {
      if (grp.items.some((it) => lista.includes(it.name))) state.analises.openGroups.add(grp.id);
    });
    renderAnalisesPanel();
  }

  function bindAnalisesPanelEvents(panel) {
    panel.querySelectorAll('[data-pdv2="chipwrap"] > .pdv2-chip').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const wrap = btn.parentElement;
        const estava = wrap.classList.contains("pdv2-chipWrap--open");
        panel.querySelectorAll(".pdv2-chipWrap--open").forEach((w) => w.classList.remove("pdv2-chipWrap--open"));
        if (!estava) wrap.classList.add("pdv2-chipWrap--open");
      });
    });

    panel.querySelectorAll("[data-pdv2-perfil]").forEach((btn) => {
      btn.addEventListener("click", () => applyPerfilAnalises(btn.dataset.pdv2Perfil, btn.dataset.pdv2Sub || null));
    });

    panel.querySelectorAll(".pdv2-grpHead").forEach((head) => {
      head.addEventListener("click", () => {
        const grpEl = head.closest(".pdv2-grp");
        if (!grpEl) return;
        const nowOpen = grpEl.classList.toggle("pdv2-grp--open");
        const grpId = grpEl.dataset.pdv2Grpid;
        if (nowOpen) state.analises.openGroups.add(grpId); else state.analises.openGroups.delete(grpId);
        const chev = head.querySelector(".pdv2-chev");
        if (chev) chev.textContent = nowOpen ? "▲" : "▼";
      });
    });

    panel.querySelectorAll("[data-pdv2-selall]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const grp = ANALISES_GRUPOS.find((g) => g.id === btn.dataset.pdv2Selall);
        if (!grp) return;
        const qNorm = normalizeTxt(state.analises.search.trim());
        const filtered = qNorm ? grp.items.filter((it) => normalizeTxt(it.name).includes(qNorm)) : grp.items;
        const allSelected = filtered.length > 0 && filtered.every((it) => state.analises.selected.has(it.name));
        filtered.forEach((it) => {
          if (allSelected) state.analises.selected.delete(it.name); else state.analises.selected.add(it.name);
        });
        renderAnalisesPanel();
      });
    });

    panel.querySelectorAll(".pdv2-item input[data-pdv2-name]").forEach((cb) => {
      cb.addEventListener("change", () => {
        const name = cb.dataset.pdv2Name;
        if (cb.checked) state.analises.selected.add(name); else state.analises.selected.delete(name);
        renderAnalisesPanel();
      });
    });

    panel.querySelectorAll("[data-pdv2-removename]").forEach((x) => {
      x.addEventListener("click", () => {
        state.analises.selected.delete(x.dataset.pdv2Removename);
        renderAnalisesPanel();
      });
    });

    const searchEl = panel.querySelector('[data-pdv2-role="search"]');
    searchEl?.addEventListener("input", (e) => {
      state.analises.search = e.target.value;
      renderAnalisesPanel({ preserveFocus: "search" });
    });

    panel.querySelector('[data-pdv2-role="clininfo"]')?.addEventListener("input", (e) => {
      state.analises.clinicalInfo = e.target.value;
    });
    panel.querySelector('[data-pdv2-role="date"]')?.addEventListener("input", (e) => {
      state.analises.date = e.target.value;
    });

    panel.querySelector('[data-pdv2="gerarpdf-analises"]')?.addEventListener("click", onGerarAnalisesPdf);
  }

  function renderAnalisesPanel(opts = {}) {
    const panel = container.querySelector('[data-pdv2-panel="analises"]');
    if (!panel) return;

    let focusInfo = null;
    if (opts.preserveFocus) {
      const el = panel.querySelector(`[data-pdv2-role="${opts.preserveFocus}"]`);
      if (el && document.activeElement === el) {
        focusInfo = { role: opts.preserveFocus, start: el.selectionStart, end: el.selectionEnd };
      }
    }
    const scrollTop = panel.querySelector(".pdv2-colEsq")?.scrollTop ?? 0;

    panel.innerHTML = buildAnalisesPanelHtml();
    bindAnalisesPanelEvents(panel);

    if (focusInfo) {
      const el = panel.querySelector(`[data-pdv2-role="${focusInfo.role}"]`);
      if (el) { el.focus(); el.setSelectionRange?.(focusInfo.start, focusInfo.end); }
    }
    const colEsq = panel.querySelector(".pdv2-colEsq");
    if (colEsq) colEsq.scrollTop = scrollTop;

    updateTabBadges();
  }

  /* ================================================================
     EXAMES
     ================================================================ */

  function buildExamesQuickHtml() {
    const cats = EXAM_QUICK_CATEGORIAS.map((c) =>
      `<button class="pdv2-chip" data-pdv2-examsearch="${escHtml(c)}">${escHtml(c)}</button>`
    ).join("");
    const regioes = EXAM_QUICK_REGIOES.map((r) =>
      `<button class="pdv2-chip" data-pdv2-examsearch="${escHtml(r)}">${escHtml(r)}</button>`
    ).join("");
    return `
      <span class="pdv2-lbl">Perfis</span>
      ${cats}
      <span class="pdv2-lbl" style="margin-left:10px;">Região</span>
      ${regioes}
      <input class="pdv2-search" type="text" data-pdv2-role="examsearch"
        placeholder="Pesquisar exame… (RM ombro, eco, RX)" value="${escHtml(state.exames.search)}">
    `;
  }

  function groupExamRows() {
    const map = new Map();
    state.exames.rows.forEach((exam) => {
      const label = examGroupLabel(exam);
      if (!map.has(label)) map.set(label, []);
      map.get(label).push(exam);
    });
    return map;
  }

  function matchesExamSearch(exam, qNorm) {
    if (!qNorm) return true;
    const hay = normalizeTxt([exam.exam_name, exam.body_region, exam.category, exam.subcategory].filter(Boolean).join(" "));
    return hay.includes(qNorm);
  }

  function buildExamesGroupsHtml() {
    if (!state.exames.loaded) return `<div class="pdv2-vazio">A carregar catálogo de exames…</div>`;
    if (!state.exames.rows.length) return `<div class="pdv2-vazio">Sem exames activos no catálogo.</div>`;

    const qNorm = normalizeTxt(state.exames.search.trim());
    const groups = groupExamRows();
    let anyGroup = false;

    let html = "";
    groups.forEach((items, label) => {
      const filtered = qNorm ? items.filter((e) => matchesExamSearch(e, qNorm)) : items;
      if (qNorm && filtered.length === 0) return;
      anyGroup = true;
      const isOpen = qNorm ? true : state.exames.openGroups.has(label);
      const selCount = items.reduce((n, e) => n + (state.exames.selected.has(e.id) ? 1 : 0), 0);
      const itemsHtml = filtered.map((e) => {
        const checked = state.exames.selected.has(e.id);
        const infoVal = checked ? (state.exames.clinicalInfoByExam.get(e.id) || "") : "";
        return `
          <div class="pdv2-examRow">
            <label class="pdv2-item">
              <input type="checkbox" data-pdv2-examid="${escHtml(e.id)}" ${checked ? "checked" : ""}>
              <span>${escHtml(e.exam_name)}</span>
            </label>
            ${checked ? `
            <textarea class="pdv2-examinfo" data-pdv2-examinfo="${escHtml(e.id)}"
              placeholder="Informação clínica para este exame…">${escHtml(infoVal)}</textarea>` : ""}
          </div>`;
      }).join("");
      html += `
        <div class="pdv2-grp ${isOpen ? "pdv2-grp--open" : ""}" data-pdv2-grplabel="${escHtml(label)}">
          <div class="pdv2-grpHead">
            <span class="pdv2-nome">${examGroupIcon(label)} ${escHtml(label)} ${selCount ? `<span class="pdv2-badge">${selCount} sel.</span>` : ""}</span>
            <span class="pdv2-chev">${isOpen ? "▲" : "▼"}</span>
          </div>
          <div class="pdv2-grpItems">${itemsHtml}</div>
        </div>`;
    });
    return anyGroup ? html : `<div class="pdv2-vazio">Sem resultados para a pesquisa.</div>`;
  }

  function selectedExamsByGroup() {
    const byGroup = new Map();
    state.exames.rows.forEach((exam) => {
      if (!state.exames.selected.has(exam.id)) return;
      const label = examGroupLabel(exam);
      if (!byGroup.has(label)) byGroup.set(label, []);
      byGroup.get(label).push(exam);
    });
    return byGroup;
  }

  function buildExamesPillsHtml() {
    if (!state.exames.selected.size) return `<div class="pdv2-vazio">Sem exames seleccionados.</div>`;
    const byGroup = selectedExamsByGroup();
    let html = "";
    byGroup.forEach((exams, label) => {
      html += `<div class="pdv2-pillGrp">${escHtml(label)} · 1 PDF</div>`;
      exams.forEach((e) => {
        html += `<div class="pdv2-pill"><span class="pdv2-miolo">${escHtml(e.exam_name)}</span><span class="pdv2-x" data-pdv2-removeexamid="${escHtml(e.id)}">×</span></div>`;
      });
    });
    return html;
  }

  function buildExamesDocBodyHtml(examsInGroup) {
    let html = `<div class="pdv2-doc-section"><ul class="pdv2-doc-list">`;
    examsInGroup.forEach((e) => {
      const info = state.exames.clinicalInfoByExam.get(e.id) || "";
      html += `<li>${escHtml(e.exam_name)}${info ? `<div class="pdv2-clinical-info">${escHtml(info)}</div>` : ""}</li>`;
    });
    html += `</ul></div>`;
    return html;
  }

  /* ---- PDF: Exames (1 documento por modalidade, em sequência) ---- */

  async function onGerarExamesPdf() {
    if (state.exames.generating) return;
    const byGroup = selectedExamsByGroup();
    if (!byGroup.size) return;

    state.exames.generating = true;
    state.exames.lastRun = null;
    const results = [];
    const entries = [...byGroup.entries()];
    state.exames.progress = { current: 0, total: entries.length, label: "" };
    renderExamesPanel();

    for (let i = 0; i < entries.length; i++) {
      const [label, exams] = entries[i];
      state.exames.progress = { current: i + 1, total: entries.length, label };
      renderExamesPanel();

      try {
        const fullHtml = await buildFullDocHtml({
          title: `Pedido de Exame — ${label}`,
          contentHtml: buildExamesDocBodyHtml(exams),
          date: state.exames.date
        });
        const blob = await renderPdfViaProxy(fullHtml);
        await uploadAndRegisterDocument({
          blob,
          clinicId: state.patient.clinicId,
          patientId: state.patientId,
          consultationId: state.consultationId,
          title: `Pedido de Exame — ${label}`,
          category: "exames",
          html: fullHtml,
          docNumber: generateDocNumber(),
          folder: "exames",
          fileNameHint: slugifyLabel(label)
        });
        results.push({ label, ok: true, url: URL.createObjectURL(blob) });
      } catch (err) {
        console.error(`[pedidos-v2] erro ao gerar PDF de exame (${label}):`, err);
        results.push({ label, ok: false, error: String(err?.message || err) });
        break; // pára a sequência — não gera os restantes às cegas
      }
    }

    state.exames.generating = false;
    state.exames.progress = null;
    state.exames.lastRun = { total: entries.length, results };
    renderExamesPanel();
  }

  function renderExamesResultsSummary() {
    if (!state.exames.lastRun) return "";
    const { total, results } = state.exames.lastRun;
    const okCount = results.filter((r) => r.ok).length;
    const allOk = okCount === total;
    const falhou = results.find((r) => !r.ok);
    const resumo = allOk
      ? `${okCount} de ${total} PDFs gerados.`
      : `${okCount} de ${total} — falhou "${falhou?.label}". ${falhou?.error || ""}`;
    const linksHtml = results.filter((r) => r.ok).map((r) =>
      `<div class="pdv2-docresult"><span>${escHtml(r.label)}</span><button class="pdv2-doclink" data-pdv2-openurl="${escHtml(r.url)}">Abrir PDF</button></div>`
    ).join("");
    return `<div class="pdv2-docstatus pdv2-docstatus--${allOk ? "success" : "error"}">${escHtml(resumo)}</div>${linksHtml}`;
  }

  function buildExamesPanelHtml() {
    const n = state.exames.selected.size;
    const nGroups = selectedExamsByGroup().size;
    return `
      <div class="pdv2-quick">${buildExamesQuickHtml()}</div>
      <div class="pdv2-body">
        <div class="pdv2-colEsq">${buildExamesGroupsHtml()}</div>
        <div class="pdv2-colDir">
          <h3>Pedido actual</h3>

          ${buildIdCardHtml()}

          <div class="pdv2-pills">${buildExamesPillsHtml()}</div>

          <div class="pdv2-miniDoc">
            <div class="pdv2-mh"><div class="pdv2-logo"></div><div class="pdv2-tit">Pedido de Exame</div></div>
            <div class="pdv2-corpo"></div>
            <div class="pdv2-mf"><span>Dr. João Morais · OM 44380</span><span>Vinheta</span></div>
            <div class="pdv2-cap">Pré-visualização — cabeçalho e rodapé do Relatório V2</div>
          </div>

          <div class="pdv2-rodape">
            <div class="pdv2-linha">
              <input type="date" data-pdv2-role="examdate" style="flex:1;" value="${escHtml(state.exames.date)}">
            </div>
            <button class="pdv2-btnPdf" data-pdv2="gerarpdf-exames" ${(state.exames.generating || !n) ? "disabled" : ""}>${
              state.exames.generating
                ? `A gerar PDF ${state.exames.progress.current} de ${state.exames.progress.total} — ${escHtml(state.exames.progress.label)}…`
                : `Gerar ${nGroups || 0} PDF${nGroups === 1 ? "" : "s"} · ${n} exame${n === 1 ? "" : "s"}`
            }</button>
            ${renderExamesResultsSummary()}
            <div class="pdv2-notaPdf">Um PDF por modalidade</div>
          </div>
        </div>
      </div>
    `;
  }

  function bindExamesPanelEvents(panel) {
    panel.querySelectorAll("[data-pdv2-examsearch]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.exames.search = btn.dataset.pdv2Examsearch;
        renderExamesPanel();
      });
    });

    panel.querySelectorAll(".pdv2-grpHead").forEach((head) => {
      head.addEventListener("click", () => {
        const grpEl = head.closest(".pdv2-grp");
        if (!grpEl) return;
        const nowOpen = grpEl.classList.toggle("pdv2-grp--open");
        const label = grpEl.dataset.pdv2Grplabel;
        if (nowOpen) state.exames.openGroups.add(label); else state.exames.openGroups.delete(label);
        const chev = head.querySelector(".pdv2-chev");
        if (chev) chev.textContent = nowOpen ? "▲" : "▼";
      });
    });

    panel.querySelectorAll(".pdv2-item input[data-pdv2-examid]").forEach((cb) => {
      cb.addEventListener("change", () => {
        const id = cb.dataset.pdv2Examid;
        if (cb.checked) {
          state.exames.selected.add(id);
        } else {
          state.exames.selected.delete(id);
          state.exames.clinicalInfoByExam.delete(id);
        }
        renderExamesPanel();
      });
    });

    panel.querySelectorAll("[data-pdv2-removeexamid]").forEach((x) => {
      x.addEventListener("click", () => {
        const id = x.dataset.pdv2Removeexamid;
        state.exames.selected.delete(id);
        state.exames.clinicalInfoByExam.delete(id);
        renderExamesPanel();
      });
    });

    panel.querySelectorAll("textarea[data-pdv2-examinfo]").forEach((ta) => {
      ta.addEventListener("input", () => {
        const id = ta.dataset.pdv2Examinfo;
        const val = ta.value;
        if (val) state.exames.clinicalInfoByExam.set(id, val); else state.exames.clinicalInfoByExam.delete(id);
      });
    });

    const searchEl = panel.querySelector('[data-pdv2-role="examsearch"]');
    searchEl?.addEventListener("input", (e) => {
      state.exames.search = e.target.value;
      renderExamesPanel({ preserveFocus: "examsearch" });
    });

    panel.querySelector('[data-pdv2-role="examdate"]')?.addEventListener("input", (e) => {
      state.exames.date = e.target.value;
    });

    panel.querySelector('[data-pdv2="gerarpdf-exames"]')?.addEventListener("click", onGerarExamesPdf);
    panel.querySelectorAll("[data-pdv2-openurl]").forEach((b) => {
      b.addEventListener("click", () => window.open(b.dataset.pdv2Openurl, "_blank"));
    });
  }

  function renderExamesPanel(opts = {}) {
    const panel = container.querySelector('[data-pdv2-panel="exames"]');
    if (!panel) return;

    let focusInfo = null;
    if (opts.preserveFocus) {
      const el = panel.querySelector(`[data-pdv2-role="${opts.preserveFocus}"]`);
      if (el && document.activeElement === el) {
        focusInfo = { role: opts.preserveFocus, start: el.selectionStart, end: el.selectionEnd };
      }
    }
    const scrollTop = panel.querySelector(".pdv2-colEsq")?.scrollTop ?? 0;

    panel.innerHTML = buildExamesPanelHtml();
    bindExamesPanelEvents(panel);

    if (focusInfo) {
      const el = panel.querySelector(`[data-pdv2-role="${focusInfo.role}"]`);
      if (el) { el.focus(); el.setSelectionRange?.(focusInfo.start, focusInfo.end); }
    }
    const colEsq = panel.querySelector(".pdv2-colEsq");
    if (colEsq) colEsq.scrollTop = scrollTop;

    updateTabBadges();
  }

  /* ================================================================
     CHROME (tabs, fechar, dropdown-outside-click) — ligado uma única vez
     ================================================================ */

  function updateTabBadges() {
    const nA = container.querySelector('[data-pdv2-tab="analises"] .pdv2-n');
    const nE = container.querySelector('[data-pdv2-tab="exames"] .pdv2-n');
    if (nA) nA.textContent = String(state.analises.selected.size);
    if (nE) nE.textContent = String(state.exames.selected.size);
  }

  function renderPatientHeader() {
    const nomeEl = container.querySelector('[data-pdv2="head-nome"]');
    const metaEl = container.querySelector('[data-pdv2="head-meta"]');
    if (nomeEl) nomeEl.textContent = state.patient.name;
    if (metaEl) metaEl.textContent = state.patient.meta;
  }

  async function carregarPatientHeader(patientId) {
    try {
      const data = await loadPatientData(patientId);
      state.patient.name = data.full_name || "Doente";
      state.patient.meta = formatHeaderMeta(data);
      state.patient.raw = data;
      state.patient.clinicId = data.clinicId;
      state.patient.status = "ready";
      // Pré-carrega clínica/médico/vinheta (ensurePdfAssets, mesma função usada para o
      // PDF) já aqui — o cartão "Cabeçalho V2" em ecrã precisa do nome da clínica via
      // buildPatientCard, não só o PDF final. loadClinicById/loadCurrentDoctor/
      // getVinhetaDataUrl nunca rejeitam (self-catch, devolvem null em erro), por isso
      // isto não risca o try/catch do doente em si.
      await ensurePdfAssets();
    } catch (err) {
      console.error("[pedidos-v2] erro ao carregar doente:", err);
      state.patient.name = "⚠️ Doente não encontrado";
      state.patient.meta = "";
      state.patient.raw = null;
      state.patient.clinicId = null;
      state.patient.status = "error";
    }
    renderPatientHeader();
    renderAnalisesPanel();
    renderExamesPanel();
  }

  const tabs = container.querySelectorAll("[data-pdv2-tab]");
  const onTabClick = (e) => {
    const alvo = e.currentTarget.dataset.pdv2Tab;
    tabs.forEach((t) => t.classList.toggle("pdv2-tab--on", t === e.currentTarget));
    container.querySelectorAll("[data-pdv2-panel]").forEach((p) => {
      const isAlvo = p.dataset.pdv2Panel === alvo;
      p.style.display = isAlvo ? "flex" : "none";
      p.classList.toggle("pdv2-tabpanel--on", isAlvo);
    });
  };
  tabs.forEach((t) => t.addEventListener("click", onTabClick));

  const onDocClick = () => container.querySelectorAll(".pdv2-chipWrap--open").forEach((w) => w.classList.remove("pdv2-chipWrap--open"));
  document.addEventListener("click", onDocClick);

  const onFechar = () => {
    unmount(container);
    if (typeof options.onClose === "function") options.onClose();
  };
  container.querySelector('[data-pdv2="fechar"]')?.addEventListener("click", onFechar);

  container.__pdv2State = { onDocClick };

  /* ---- renderização inicial + carregamento assíncrono (exames + doente) ---- */
  renderAnalisesPanel();
  renderExamesPanel();
  loadExamsCatalog().then((rows) => {
    state.exames.rows = rows;
    state.exames.loaded = true;
    renderExamesPanel();
  });
  if (options.patientId) carregarPatientHeader(options.patientId);
}

/**
 * unmount
 * Remove tudo o que mount() criou em `container` (DOM, listeners, style).
 */
export function unmount(container) {
  if (!container) return;
  const state = container.__pdv2State;
  if (state?.onDocClick) document.removeEventListener("click", state.onDocClick);
  container.__pdv2State = null;
  container.innerHTML = "";
  removeStyles();
}

/* ====================================================================
   CSS — variáveis de cor definidas localmente em .pdv2-overlay (não
   depende de variáveis globais da página; container tem all:initial).
   ==================================================================== */
const CSS = `
/* z-index bem acima do máximo em feed-doente.html (.fd-topbar=200,
   .fd-acao-bar=199, .fd-antec=198) — descoberto na sessão 5, o modal
   ficava tapado pela topbar do feed com um valor mais baixo. */
.pdv2-overlay{
  --navy:#0f2d52; --blue:#1a56db; --blue-soft:#eff4ff;
  --ink:#0f172a; --mut:#64748b; --line:#e5e7eb; --bg:#f8fafc;
  --ok:#1d9e75; --ok-soft:#e8f8f3;
  position:fixed; inset:0; background:rgba(15,45,82,.45);
  display:flex; align-items:center; justify-content:center; z-index:9999; padding:20px;
  font-family:'Outfit', system-ui, -apple-system, sans-serif;
  box-sizing:border-box;
}
.pdv2-overlay *{ box-sizing:border-box; }
.pdv2-modal{width:min(1120px,100%);height:min(760px,94vh);background:#fff;border-radius:16px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 64px rgba(15,45,82,.35);color:var(--ink);}

.pdv2-head{background:var(--navy);color:#fff;padding:14px 20px;display:flex;align-items:center;gap:18px;flex-shrink:0;}
.pdv2-titulo{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:700;letter-spacing:.3px;}
.pdv2-doente{font-size:12.5px;opacity:.85;display:flex;gap:14px;flex-wrap:wrap;}
.pdv2-doente b{font-weight:600;opacity:1;}
.pdv2-fechar{margin-left:auto;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.3);color:#fff;font-family:inherit;font-size:12px;font-weight:600;padding:7px 16px;border-radius:8px;cursor:pointer;}
.pdv2-fechar:hover{background:rgba(255,255,255,.22);}

.pdv2-tabs{display:flex;border-bottom:1px solid var(--line);flex-shrink:0;background:#fff;padding:0 20px;}
.pdv2-tab{font-size:14px;font-weight:600;color:var(--mut);padding:13px 22px;cursor:pointer;border-bottom:3px solid transparent;user-select:none;}
.pdv2-tab:hover{color:var(--ink);}
.pdv2-tab--on{color:var(--blue);border-bottom-color:var(--blue);}
.pdv2-n{display:inline-block;min-width:18px;text-align:center;font-size:11px;font-weight:700;background:#cbd5e1;color:#fff;border-radius:100px;padding:1px 6px;margin-left:7px;vertical-align:1px;}
.pdv2-tab--on .pdv2-n{background:var(--blue);}

.pdv2-tabpanel{display:none;flex-direction:column;flex:1;overflow:hidden;}
.pdv2-tabpanel--on{display:flex;}

.pdv2-quick{display:flex;align-items:center;gap:8px;padding:12px 20px;border-bottom:1px solid var(--line);flex-shrink:0;flex-wrap:wrap;background:var(--bg);}
.pdv2-lbl{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--mut);margin-right:2px;}
.pdv2-chip{font-size:12px;font-weight:600;color:var(--navy);background:#fff;border:1px solid #c7d5ea;border-radius:100px;padding:6px 14px;cursor:pointer;font-family:inherit;transition:all .12s;}
.pdv2-chip:hover{border-color:var(--blue);color:var(--blue);background:var(--blue-soft);}
.pdv2-chipWrap{position:relative;display:inline-block;}
.pdv2-chipMenu{display:none;position:absolute;top:calc(100% + 4px);left:0;background:#fff;border:1px solid #c7d5ea;border-radius:10px;box-shadow:0 10px 28px rgba(15,45,82,.18);z-index:20;min-width:230px;padding:5px;}
.pdv2-chipWrap--open .pdv2-chipMenu{display:block;}
.pdv2-op{display:block;width:100%;text-align:left;font-size:12px;font-weight:500;color:var(--ink);background:none;border:none;border-radius:7px;padding:7px 10px;cursor:pointer;font-family:inherit;}
.pdv2-op:hover{background:var(--blue-soft);color:var(--blue);}
.pdv2-search{margin-left:auto;width:280px;padding:8px 12px;font-size:13px;border:1px solid #cbd5e1;border-radius:8px;font-family:inherit;outline:none;background:#fff;}
.pdv2-search:focus{border-color:var(--blue);}

.pdv2-body{display:grid;grid-template-columns:1fr 330px;flex:1;overflow:hidden;}
.pdv2-colEsq{overflow-y:auto;padding:16px 20px;}

.pdv2-grp{border:1px solid var(--line);border-radius:10px;margin-bottom:8px;overflow:hidden;background:#fff;}
.pdv2-grp--open{border-color:var(--blue);}
.pdv2-grpHead{display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--line);user-select:none;}
.pdv2-nome{font-size:13px;font-weight:400;display:flex;align-items:center;gap:9px;flex:1;min-width:0;}
.pdv2-badge{font-size:10px;font-weight:700;background:var(--blue);color:#fff;padding:2px 8px;border-radius:100px;}
.pdv2-selall{font-size:11px;font-weight:600;color:var(--blue);background:none;border:none;padding:2px 4px;cursor:pointer;font-family:inherit;text-decoration:underline;flex-shrink:0;}
.pdv2-selall:hover{color:var(--navy);}
.pdv2-chev{font-size:10px;color:var(--mut);flex-shrink:0;}
.pdv2-grpItems{display:none;grid-template-columns:1fr 1fr;gap:2px 14px;padding:10px 14px 12px;}
.pdv2-grp--open .pdv2-grpItems{display:grid;}
.pdv2-item{display:flex;align-items:flex-start;gap:8px;font-size:12px;color:#374151;padding:4px 6px;border-radius:6px;cursor:pointer;line-height:1.35;}
.pdv2-item:hover{background:var(--bg);}
.pdv2-item input{width:15px;height:15px;accent-color:var(--blue);flex-shrink:0;margin-top:1px;cursor:pointer;}
.pdv2-info{display:block;font-size:10px;color:var(--mut);margin-top:1px;}
.pdv2-examinfo{width:100%;min-height:52px;margin:2px 0 4px 23px;padding:6px 8px;font-size:11px;line-height:1.4;
  border:1px solid #bcd4f5;border-radius:6px;font-family:inherit;color:var(--ink);background:#fff;
  resize:vertical;box-sizing:border-box;}
.pdv2-examinfo:focus{outline:none;border-color:var(--blue);}

.pdv2-vazio{font-size:12px;color:#94a3b8;padding:8px 6px;line-height:1.6;}

.pdv2-colDir{border-left:1px solid var(--line);background:var(--bg);display:flex;flex-direction:column;overflow:hidden;}
.pdv2-colDir h3{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--mut);margin:0;padding:14px 16px 8px;}

/* .pdv2-idCard envolve o resultado real de buildPatientCard() (.gcv2-patient-card,
   estilos vindos de atestado.css — ver ensurePatientCardCss). Já traz o seu próprio
   border-left azul/padding, por isso o wrapper fica com moldura clara só para o selo
   "Cabeçalho V2" ter onde assentar, sem duplicar borda/padding. */
.pdv2-idCard{margin:0 16px 10px;background:#fff;border:1px solid var(--line);border-radius:8px;padding:6px;}
.pdv2-idCard .gcv2-patient-card{margin-bottom:0;}
.pdv2-v2tag{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--blue);background:var(--blue-soft);border-radius:5px;padding:2px 7px;float:right;}

.pdv2-pills{flex:1;overflow-y:auto;padding:2px 16px 10px;}
.pdv2-pillGrp{font-size:10px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.05em;margin:8px 0 4px;}
.pdv2-pill{font-size:12px;background:#fff;border:1px solid #cbd5e1;border-radius:7px;padding:6px 10px;display:flex;align-items:flex-start;gap:8px;margin-bottom:5px;line-height:1.3;}
.pdv2-x{margin-left:auto;color:#94a3b8;cursor:pointer;font-size:15px;line-height:1;padding:0 2px;flex-shrink:0;}
.pdv2-x:hover{color:#dc2626;}
.pdv2-miolo{flex:1;}

.pdv2-rodape{border-top:1px solid var(--line);padding:12px 16px;background:#fff;flex-shrink:0;}
.pdv2-linha{display:flex;gap:8px;margin-bottom:9px;}
.pdv2-linha input[type=text]{flex:1;padding:8px 10px;font-size:12px;border:1px solid #cbd5e1;border-radius:7px;font-family:inherit;outline:none;}
.pdv2-linha input[type=date]{padding:7px 8px;font-size:12px;border:1px solid #cbd5e1;border-radius:7px;font-family:inherit;color:var(--ink);}
.pdv2-btnPdf{width:100%;padding:11px;border:none;border-radius:9px;background:var(--blue);color:#fff;font-family:inherit;font-size:13.5px;font-weight:700;cursor:pointer;}
.pdv2-btnPdf:disabled{background:#cbd5e1;color:#94a3b8;cursor:not-allowed;}
.pdv2-notaPdf{font-size:10.5px;color:var(--mut);text-align:center;margin-top:7px;line-height:1.4;}

.pdv2-docstatus{font-size:12px;padding:8px 10px;border-radius:7px;margin-top:8px;line-height:1.4;}
.pdv2-docstatus--info{background:var(--blue-soft);color:var(--blue);}
.pdv2-docstatus--success{background:var(--ok-soft);color:var(--ok);}
.pdv2-docstatus--error{background:#fef2f2;color:#b91c1c;}
.pdv2-docresult{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:12px;padding:5px 10px;border:1px solid var(--line);border-radius:6px;margin-top:4px;background:#fff;}
.pdv2-doclink{font-size:11px;font-weight:600;color:var(--blue);background:none;border:1px solid var(--blue);border-radius:6px;padding:3px 8px;cursor:pointer;font-family:inherit;flex-shrink:0;}
.pdv2-doclink:hover{background:var(--blue-soft);}

.pdv2-miniDoc{margin:0 16px 10px;background:#fff;border:1px solid var(--line);border-radius:8px;padding:9px 11px;font-size:9px;color:var(--mut);}
.pdv2-mh{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid var(--navy);padding-bottom:4px;margin-bottom:4px;}
.pdv2-logo{width:34px;height:11px;background:var(--navy);border-radius:2px;}
.pdv2-tit{font-family:'Cormorant Garamond',serif;font-size:11px;font-weight:700;color:var(--navy);}
.pdv2-corpo{height:26px;background:repeating-linear-gradient(#fff,#fff 4px,var(--bg) 4px,var(--bg) 6px);border-radius:3px;margin:4px 0;}
.pdv2-mf{border-top:1px solid var(--line);padding-top:3px;display:flex;justify-content:space-between;font-size:8px;}
.pdv2-cap{font-size:9px;text-align:center;margin-top:5px;color:#94a3b8;}
`;
