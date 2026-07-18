/**
 * pedidos-v2.js
 * Modal "Pedidos" (Análises + Exames) — Passo 4c: identificação real do doente.
 *
 * Análises: renderizado a partir de ANALISES_GRUPOS / ANALISES_PERFIS
 * (analises-catalog-v2.js, import estático).
 * Exames: carregado de exams_catalog via window.sb (mesmo padrão de
 * exames.js), agrupado por category+subcategory (equivalente generalizado
 * a getExamGroupLabel de exames.js — ver nota no cabeçalho da função).
 * Doente: se options.patientId vier, o módulo carrega full_name/dob/nif/
 * insurance_provider/insurance_policy_number (mesmos campos que
 * analises.js/patient-card.js já usam) e substitui o cabeçalho + os dois
 * cartões "Cabeçalho V2" (Análises e Exames) — sem bloquear a abertura do
 * modal ("A carregar…" até resolver; aviso claro se falhar/não existir).
 *
 * Ainda NÃO gera PDFs nem liga a window.opener — botão "Gerar PDF" fica
 * sem acção real (Passo 4d). Tudo o que precisa de Supabase usa window.sb
 * directamente.
 *
 * Uso (dentro de #fdModalRoot do feed, que já tem all:initial + box-sizing
 * aplicado a si e a todos os descendentes — ver feed-doente.html):
 *
 *   import { mount, unmount } from './pedidos-v2.js';
 *   mount(container, { patientId, onClose });
 *   // ou, sem BD (ex.: testes de esqueleto visual): mount(container, { patientName, patientMeta, onClose });
 *   ...
 *   unmount(container);
 */

import { ANALISES_GRUPOS, ANALISES_PERFIS } from "./analises-catalog-v2.js";

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
 * calcAge / formatPatientMeta
 * Mesma fórmula de idade que feed-doente.html (boot()) e mesmos campos
 * de patients que analises.js (gerarAnalisePdf) e patient-card.js usam
 * para o "cabeçalho V2" — combinados aqui: DN+idade e NIF vêm de
 * patient-card.js, seguradora+apólice vêm de feed-doente.html (patient-card.js
 * não mostra seguro).
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

function formatPatientMeta(p) {
  const bits = [];
  if (p.dob) {
    const d = new Date(p.dob);
    if (!isNaN(d.getTime())) {
      const idade = calcAge(p.dob);
      bits.push(`DN ${d.toLocaleDateString("pt-PT")}${idade !== null ? ` (${idade} a)` : ""}`);
    }
  }
  if (p.nif) bits.push(`NIF ${p.nif}`);
  if (p.insurance_provider) {
    bits.push(`${p.insurance_provider}${p.insurance_policy_number ? " · Ap. " + p.insurance_policy_number : ""}`);
  }
  return bits.join(" · ");
}

/**
 * loadPatientData
 * Mesma tabela/campos que analises.js (gerarAnalisePdf) usa para o
 * cabeçalho do PDF: full_name, dob, nif, insurance_provider,
 * insurance_policy_number.
 */
async function loadPatientData(patientId) {
  const { data, error } = await window.sb
    .from("patients")
    .select("full_name, dob, nif, insurance_provider, insurance_policy_number")
    .eq("id", patientId)
    .single();
  if (error || !data) throw error || new Error("doente não encontrado");
  return data;
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

function ensureStyles() {
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
    patient: options.patientId
      ? { name: "A carregar…", meta: "", status: "loading" }
      : { name: options.patientName || "Doente de exemplo", meta: options.patientMeta || "DN — · NIF — · Seguro —", status: "ready" },
    analises: {
      selected: new Set(),      // nomes exactos (ANALISES_GRUPOS[].items[].name)
      openGroups: new Set(),    // ids de grupo abertos manualmente
      search: "",
      clinicalInfo: "",
      date: today
    },
    exames: {
      rows: [],
      loaded: false,
      selected: new Set(),      // exam ids (uuid)
      openGroups: new Set(),    // group labels (examGroupLabel) abertos manualmente
      search: "",
      date: today
    }
  };

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
          <div class="pdv2-tab pdv2-tab--on" data-pdv2-tab="analises">Análises <span class="pdv2-n">0</span></div>
          <div class="pdv2-tab" data-pdv2-tab="exames">Exames <span class="pdv2-n">0</span></div>
        </div>

        <div class="pdv2-tabpanel pdv2-tabpanel--on" data-pdv2-panel="analises"></div>
        <div class="pdv2-tabpanel" data-pdv2-panel="exames" style="display:none;"></div>

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
            <span class="pdv2-chev">${isOpen ? "▲" : "▼"}</span>
          </div>
          <div class="pdv2-grpItems">${itemsHtml}</div>
        </div>`;
    }).join("");
    return anyGroup ? html : `<div class="pdv2-vazio">Sem resultados para a pesquisa.</div>`;
  }

  function buildAnalisesPillsHtml() {
    if (!state.analises.selected.size) return `<div class="pdv2-vazio">Sem análises seleccionadas.</div>`;

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

    let html = "";
    byGroup.forEach((names, label) => {
      html += `<div class="pdv2-pillGrp">${escHtml(label)}</div>`;
      names.forEach((name) => {
        html += `<div class="pdv2-pill"><span class="pdv2-miolo">${escHtml(name)}</span><span class="pdv2-x" data-pdv2-removename="${escHtml(name)}">×</span></div>`;
      });
    });
    return html;
  }

  function buildAnalisesPanelHtml() {
    const n = state.analises.selected.size;
    return `
      <div class="pdv2-quick">${buildAnalisesQuickHtml()}</div>
      <div class="pdv2-body">
        <div class="pdv2-colEsq">${buildAnalisesGroupsHtml()}</div>
        <div class="pdv2-colDir">
          <h3>Pedido actual</h3>

          <div class="pdv2-idCard">
            <span class="pdv2-v2tag">Cabeçalho V2</span>
            <div class="pdv2-idnome">${escHtml(state.patient.name)}</div>
            <div class="pdv2-idmeta">${escHtml(state.patient.meta)}</div>
          </div>

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
            <button class="pdv2-btnPdf" ${n ? "" : "disabled"}>Gerar PDF · ${n} análise${n === 1 ? "" : "s"}</button>
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

    panel.innerHTML = buildAnalisesPanelHtml();
    bindAnalisesPanelEvents(panel);

    if (focusInfo) {
      const el = panel.querySelector(`[data-pdv2-role="${focusInfo.role}"]`);
      if (el) { el.focus(); el.setSelectionRange?.(focusInfo.start, focusInfo.end); }
    }

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
        return `
          <label class="pdv2-item">
            <input type="checkbox" data-pdv2-examid="${escHtml(e.id)}" ${checked ? "checked" : ""}>
            <span>${escHtml(e.exam_name)}</span>
          </label>`;
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

  function buildExamesPanelHtml() {
    const n = state.exames.selected.size;
    const nGroups = selectedExamsByGroup().size;
    return `
      <div class="pdv2-quick">${buildExamesQuickHtml()}</div>
      <div class="pdv2-body">
        <div class="pdv2-colEsq">${buildExamesGroupsHtml()}</div>
        <div class="pdv2-colDir">
          <h3>Pedido actual</h3>

          <div class="pdv2-idCard">
            <span class="pdv2-v2tag">Cabeçalho V2</span>
            <div class="pdv2-idnome">${escHtml(state.patient.name)}</div>
            <div class="pdv2-idmeta">${escHtml(state.patient.meta)}</div>
          </div>

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
            <button class="pdv2-btnPdf" ${n ? "" : "disabled"}>Gerar ${nGroups || 0} PDF${nGroups === 1 ? "" : "s"} · ${n} exame${n === 1 ? "" : "s"}</button>
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
        if (cb.checked) state.exames.selected.add(id); else state.exames.selected.delete(id);
        renderExamesPanel();
      });
    });

    panel.querySelectorAll("[data-pdv2-removeexamid]").forEach((x) => {
      x.addEventListener("click", () => {
        state.exames.selected.delete(x.dataset.pdv2Removeexamid);
        renderExamesPanel();
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

    panel.innerHTML = buildExamesPanelHtml();
    bindExamesPanelEvents(panel);

    if (focusInfo) {
      const el = panel.querySelector(`[data-pdv2-role="${focusInfo.role}"]`);
      if (el) { el.focus(); el.setSelectionRange?.(focusInfo.start, focusInfo.end); }
    }

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
      state.patient.meta = formatPatientMeta(data);
      state.patient.status = "ready";
    } catch (err) {
      console.error("[pedidos-v2] erro ao carregar doente:", err);
      state.patient.name = "⚠️ Doente não encontrado";
      state.patient.meta = "";
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
.pdv2-overlay{
  --navy:#0f2d52; --blue:#1a56db; --blue-soft:#eff4ff;
  --ink:#0f172a; --mut:#64748b; --line:#e5e7eb; --bg:#f8fafc;
  --ok:#1d9e75; --ok-soft:#e8f8f3;
  position:fixed; inset:0; background:rgba(15,45,82,.45);
  display:flex; align-items:center; justify-content:center; z-index:100; padding:20px;
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
.pdv2-grpHead{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;cursor:pointer;background:var(--bg);user-select:none;}
.pdv2-grp--open .pdv2-grpHead{background:var(--blue-soft);}
.pdv2-grpHead:hover{background:#eef2f8;}
.pdv2-nome{font-size:13px;font-weight:600;display:flex;align-items:center;gap:9px;}
.pdv2-badge{font-size:10px;font-weight:700;background:var(--blue);color:#fff;padding:2px 8px;border-radius:100px;}
.pdv2-chev{font-size:10px;color:var(--mut);}
.pdv2-grpItems{display:none;grid-template-columns:1fr 1fr;gap:2px 14px;padding:10px 14px 12px;border-top:1px solid var(--line);}
.pdv2-grp--open .pdv2-grpItems{display:grid;}
.pdv2-item{display:flex;align-items:flex-start;gap:8px;font-size:12px;color:#374151;padding:4px 6px;border-radius:6px;cursor:pointer;line-height:1.35;}
.pdv2-item:hover{background:var(--bg);}
.pdv2-item input{width:15px;height:15px;accent-color:var(--blue);flex-shrink:0;margin-top:1px;cursor:pointer;}
.pdv2-info{display:block;font-size:10px;color:var(--mut);margin-top:1px;}

.pdv2-vazio{font-size:12px;color:#94a3b8;padding:8px 6px;line-height:1.6;}

.pdv2-colDir{border-left:1px solid var(--line);background:var(--bg);display:flex;flex-direction:column;overflow:hidden;}
.pdv2-colDir h3{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--mut);margin:0;padding:14px 16px 8px;}

.pdv2-idCard{margin:0 16px 10px;background:#fff;border:1px solid var(--line);border-left:3px solid var(--navy);border-radius:8px;padding:10px 12px;}
.pdv2-idnome{font-family:'Cormorant Garamond',serif;font-size:17px;font-weight:700;color:var(--navy);line-height:1.2;}
.pdv2-idmeta{font-size:11px;color:var(--mut);margin-top:3px;line-height:1.5;}
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

.pdv2-miniDoc{margin:0 16px 10px;background:#fff;border:1px solid var(--line);border-radius:8px;padding:9px 11px;font-size:9px;color:var(--mut);}
.pdv2-mh{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid var(--navy);padding-bottom:4px;margin-bottom:4px;}
.pdv2-logo{width:34px;height:11px;background:var(--navy);border-radius:2px;}
.pdv2-tit{font-family:'Cormorant Garamond',serif;font-size:11px;font-weight:700;color:var(--navy);}
.pdv2-corpo{height:26px;background:repeating-linear-gradient(#fff,#fff 4px,var(--bg) 4px,var(--bg) 6px);border-radius:3px;margin:4px 0;}
.pdv2-mf{border-top:1px solid var(--line);padding-top:3px;display:flex;justify-content:space-between;font-size:8px;}
.pdv2-cap{font-size:9px;text-align:center;margin-top:5px;color:#94a3b8;}
`;
