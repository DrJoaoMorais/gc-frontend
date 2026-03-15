/* ========================================================
   FINANCAS.JS — Gestão Financeira
   --------------------------------------------------------
   FA — Queries Supabase
      FA.1  loadEntidades()
      FA.2  loadRegistos({ mes, ano })
      FA.3  loadClinicPrices(clinicId)
      FA.4  insertRegisto(payload)
      FA.5  updateRegisto(id, payload)
      FA.6  deleteRegisto(id)

   FB — Helpers
      FB.1  mesLabel(ano, mes)
      FB.2  periodoFromDate(date)
      FB.3  valorParaStatus(apptStatus, financialStatus)
      FB.4  badgeTipo(tipo)
      FB.5  badgeStatus(apptStatus, financialStatus)

   FC — Render principal
      FC.1  renderFinancas()
      FC.2  renderMetrics(registos, entidades)
      FC.3  renderTabelaRegistos(registos, entidades)
      FC.4  renderTabelaEntidades(entidades)

   FD — Modais
      FD.1  openModalNovoRegisto({ entidades, clinicPrices })
      FD.2  openModalEditarRegisto(registo, entidades)
      FD.3  openModalPdfAthletix(mes, ano)

   FE — Boot
      FE.1  initFinancas()
   ======================================================== */

import { G } from "./state.js";
import { escapeHtml } from "./helpers.js";

/* ==== FA — Queries Supabase ==== */

/* ---- FA.1 — loadEntidades ---- */
async function loadEntidades() {
  const { data, error } = await window.sb
    .from("entidades_financeiras")
    .select("*")
    .eq("ativa", true)
    .order("nome", { ascending: true });
  if (error) throw error;
  return data || [];
}

/* ---- FA.2 — loadRegistos ---- */
async function loadRegistos({ mes, ano }) {
  const inicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
  // Construir fim como string directamente — evita desvio UTC do toISOString()
  const mesFim = mes === 12 ? 1 : mes + 1;
  const anoFim = mes === 12 ? ano + 1 : ano;
  const fim    = `${anoFim}-${String(mesFim).padStart(2, "0")}-01`;

  const { data, error } = await window.sb
    .from("registos_financeiros")
    .select(`
      *,
      entidades_financeiras ( nome, tipo, gera_pdf_consulta, valor_faturado ),
      patients ( full_name, nif, address_line1, postal_code, city )
    `)
    .gte("data", inicio)
    .lt("data", fim)
    .order("data", { ascending: false });

  if (error) throw error;
  return data || [];
}

/* ---- FA.3 — loadClinicPrices ---- */
async function loadClinicPrices(clinicId) {
  if (!clinicId) return [];
  const { data, error } = await window.sb
    .from("clinic_prices")
    .select("procedure_type, price")
    .eq("clinic_id", clinicId)
    .order("procedure_type", { ascending: true });
  if (error) throw error;
  return data || [];
}

/* ---- FA.4 — insertRegisto ---- */
async function insertRegisto(payload) {
  const { data, error } = await window.sb
    .from("registos_financeiros")
    .insert(payload)
    .select("*")
    .limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

/* ---- FA.5 — updateRegisto ---- */
async function updateRegisto(id, payload) {
  const { error } = await window.sb
    .from("registos_financeiros")
    .update(payload)
    .eq("id", id);
  if (error) throw error;
}

/* ---- FA.6 — deleteRegisto ---- */
async function deleteRegisto(id) {
  const { error } = await window.sb
    .from("registos_financeiros")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/* ---- FA.7 — loadPresencas ---- */
async function loadPresencas({ mes, ano }) {
  const inicio = `${ano}-${String(mes).padStart(2,"0")}-01`;
  const mesFim = mes === 12 ? 1 : mes + 1;
  const anoFim = mes === 12 ? ano + 1 : ano;
  const fim    = `${anoFim}-${String(mesFim).padStart(2,"0")}-01`;
  const { data, error } = await window.sb
    .from("presencas")
    .select("*")
    .gte("data_inicio", inicio)
    .lt("data_inicio", fim)
    .order("data_inicio", { ascending: false });
  if (error) throw error;
  return data || [];
}

/* ---- FA.8 — insertPresenca ---- */
async function insertPresenca(payload) {
  const { data, error } = await window.sb
    .from("presencas").insert(payload).select("*").limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

/* ---- FA.9 — updatePresenca ---- */
async function updatePresenca(id, payload) {
  const { error } = await window.sb
    .from("presencas").update(payload).eq("id", id);
  if (error) throw error;
}

/* ---- FA.10 — deletePresenca ---- */
async function deletePresenca(id) {
  const { error } = await window.sb
    .from("presencas").delete().eq("id", id);
  if (error) throw error;
}

/* ==== FB — Helpers ==== */

/* ---- FB.1 — mesLabel ---- */
function mesLabel(ano, mes) {
  const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
                 "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return `${meses[mes - 1]} ${ano}`;
}

/* ---- FB.2 — periodoFromDate ---- */
function periodoFromDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/* ---- FB.3 — valorParaStatus ---- */
/* Só conta (valor > 0) se apptStatus = done e financial_status = normal */
function contaParaTotal(apptStatus, financialStatus) {
  if (financialStatus === "honorarios_dispensados") return false;
  return String(apptStatus || "").toLowerCase() === "done";
}

/* ---- FB.4 — badgeTipo ---- */
function badgeTipo(tipo) {
  const map = {
    avenca:  { bg: "#E6F1FB", fg: "#0C447C", label: "Avença" },
    acto:    { bg: "#EEEDFE", fg: "#3C3489", label: "Acto" },
    diaria:  { bg: "#FAEEDA", fg: "#633806", label: "Diária" },
    modulo:  { bg: "#EAF3DE", fg: "#27500A", label: "Módulo" },
  };
  const s = map[tipo] || { bg: "#f1f5f9", fg: "#475569", label: tipo || "—" };
  return `<span style="font-size:11px;background:${s.bg};color:${s.fg};padding:2px 7px;border-radius:4px;font-weight:500;">${escapeHtml(s.label)}</span>`;
}

/* ---- FB.5 — badgeStatus ---- */
function badgeStatus(apptStatus, financialStatus) {
  if (financialStatus === "honorarios_dispensados") {
    return `<span style="font-size:11px;background:#fef3c7;color:#92400e;padding:2px 7px;border-radius:4px;font-weight:500;">Dispensado</span>`;
  }
  const map = {
    done:      { bg: "#d1fae5", fg: "#065f46", label: "Realizada" },
    scheduled: { bg: "#dbeafe", fg: "#1e40af", label: "Marcada" },
    arrived:   { bg: "#e0f2fe", fg: "#0369a1", label: "Chegou" },
    no_show:   { bg: "#fee2e2", fg: "#991b1b", label: "Faltou" },
  };
  const s = map[String(apptStatus || "").toLowerCase()] ||
            { bg: "#f1f5f9", fg: "#475569", label: apptStatus || "—" };
  return `<span style="font-size:11px;background:${s.bg};color:${s.fg};padding:2px 7px;border-radius:4px;font-weight:500;">${escapeHtml(s.label)}</span>`;
}

/* ==== FC — Render principal ==== */

/* ---- FC.1 — renderFinancas ---- */
export async function renderFinancas() {
  const content = document.querySelector(".gc-content");
  if (!content) return;

  content.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:200px;color:#94a3b8;font-size:13px;">A carregar...</div>`;

  const now = new Date();
  let ano   = now.getFullYear();
  let mes   = now.getMonth() + 1;
  let vistaActual = "clinica"; // clinica | registos | analise
  let clinicaFiltro = ""; // "" = todas

  async function render() {
    let entidades = [], registos = [], presencas = [];
    try {
      [entidades, registos, presencas] = await Promise.all([
        loadEntidades(),
        loadRegistos({ mes, ano }),
        loadPresencas({ mes, ano })
      ]);
    } catch (e) {
      console.error("renderFinancas load falhou:", e);
      content.innerHTML = `<div style="color:#b00020;padding:20px;">Erro ao carregar. Vê a consola.</div>`;
      return;
    }

    /* ── Filtro por clínica ── */
    const registosFiltrados = clinicaFiltro
      ? registos.filter(r => {
          const ent = entidades.find(e => e.id === r.entidade_id);
          return ent?.clinic_id === clinicaFiltro || ent?.nome === clinicaFiltro;
        })
      : registos;

    /* ── Métricas globais ── */
    const realizadas  = registosFiltrados.filter(r => contaParaTotal(r.appt_status, r.financial_status));
    const dispensadas = registosFiltrados.filter(r => r.financial_status === "honorarios_dispensados");
    const faltas      = registosFiltrados.filter(r => String(r.appt_status || "").toLowerCase() === "no_show");
    const pendentes   = registosFiltrados.filter(r => {
      const s = String(r.appt_status || "").toLowerCase();
      return (s === "scheduled" || s === "arrived") && r.financial_status !== "honorarios_dispensados";
    });
    const totalReal    = realizadas.reduce((s, r) => s + Number(r.valor || 0), 0);
    const totalPend    = pendentes.reduce((s, r) => s + Number(r.valor || 0), 0);
    const valorPerdido = [...faltas, ...dispensadas].reduce((s, r) => s + Number(r.valor || 0), 0);
    const mediaConsulta = realizadas.length > 0 ? Math.round(totalReal / realizadas.length) : 0;

    /* ── Avenças ── */
    const avencas     = entidades.filter(e => e.tipo === "avenca");
    const totalAvencas = avencas.reduce((s, e) => s + Number(e.avenca_valor || 0), 0);

    /* ── Pendentes vencidos ── */
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const pendVencidos = pendentes.filter(r => {
      if (!r.data) return false;
      return new Date(r.data + "T00:00:00") < hoje;
    });
    const pvPorEnt = {};
    pendVencidos.forEach(r => {
      const nome = (r.entidades_financeiras || {}).nome || "—";
      if (!pvPorEnt[nome]) pvPorEnt[nome] = [];
      pvPorEnt[nome].push(r);
    });

    /* ── Tabs de mês ── */
    const meses = [];
    for (let i = 4; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      meses.push({ ano: d.getFullYear(), mes: d.getMonth() + 1 });
    }

    /* ── Entidades externas (FPF, UC — sem clinic_id) ── */
    const entExternas  = entidades.filter(e => !e.clinic_id && e.tipo !== "avenca");
    const entClinicas  = entidades.filter(e => e.clinic_id && e.tipo === "acto");

    /* ── Dados por clínica para vista "Por clínica" ── */
    function dadosPorEntidade(entId) {
      const regs = registosFiltrados.filter(r => r.entidade_id === entId);
      const porTipo = {};
      regs.forEach(r => {
        const t = r.tipo_acto || "—";
        const s = String(r.appt_status || "").toLowerCase();
        if (!porTipo[t]) porTipo[t] = { done: 0, pend: 0, falta: 0, disp: 0, valor: 0 };
        if (contaParaTotal(r.appt_status, r.financial_status)) {
          porTipo[t].done++;
          porTipo[t].valor += Number(r.valor || 0);
        } else if (s === "scheduled" || s === "arrived") {
          porTipo[t].pend++;
        } else if (s === "no_show") {
          porTipo[t].falta++;
        } else if (r.financial_status === "honorarios_dispensados") {
          porTipo[t].disp++;
        }
      });
      const totalEnt = Object.values(porTipo).reduce((s, v) => s + v.valor, 0);
      return { porTipo, totalEnt, regs };
    }

    /* ── Dados analíticos ── */
    const porTipoGlobal = {};
    realizadas.forEach(r => {
      const t = r.tipo_acto || "Outro";
      porTipoGlobal[t] = (porTipoGlobal[t] || 0) + 1;
    });
    const tiposOrdenados = Object.entries(porTipoGlobal).sort((a, b) => b[1] - a[1]);
    const totalTipos = realizadas.length || 1;
    const tipoCores  = ["#185FA5","#378ADD","#85B7EB","#B5D4F4","#0C447C","#042C53"];
    const porSemana  = [0,0,0,0];
    realizadas.forEach(r => {
      if (!r.data) return;
      const dia = parseInt(r.data.slice(8,10), 10);
      porSemana[dia <= 7 ? 0 : dia <= 14 ? 1 : dia <= 21 ? 2 : 3]++;
    });

    /* ── Presencas por entidade ── */
    function presencasPorEntidade(entId) {
      return presencas.filter(p => p.entidade_id === entId);
    }

    /* ============================================================
       HTML
    ============================================================ */
    content.innerHTML = `
<style>
.fin-mc{background:#f8fafc;border-radius:10px;padding:14px 16px}
.fin-mc-l{font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;font-weight:500}
.fin-mc-v{font-size:22px;font-weight:700}
.fin-mc-s{font-size:11px;color:#94a3b8;margin-top:3px}
.fin-mtab{padding:5px 12px;border-radius:6px;font-size:12px;font-weight:500;cursor:pointer;color:#64748b;border:0.5px solid #e2e8f0;background:#fff;font-family:inherit}
.fin-mtab.on{background:#0f2d52;color:#fff;border-color:#0f2d52}
.fin-vtab{padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;color:#64748b;border:none;background:transparent;border-bottom:2px solid transparent;margin-bottom:-0.5px;font-family:inherit}
.fin-vtab.on{color:#1a56db;border-bottom-color:#1a56db}
.fin-card{background:#fff;border:0.5px solid #e2e8f0;border-radius:12px;overflow:hidden}
.fin-card-head{padding:12px 16px;border-bottom:0.5px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center}
.fin-card-title{font-size:13px;font-weight:700;color:#0f172a}
.fin-tbl{width:100%;border-collapse:collapse;font-size:12px}
.fin-tbl th{padding:7px 14px;background:#f8fafc;border-bottom:0.5px solid #e2e8f0;text-align:left;font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em}
.fin-tbl td{padding:9px 14px;border-bottom:0.5px solid #f1f5f9;vertical-align:middle}
.fin-tbl tr:last-child td{border-bottom:none}
.fin-tbl tr:hover td{background:#f8faff}
.pill-d{font-size:10px;background:#d1fae5;color:#065f46;padding:2px 6px;border-radius:4px;font-weight:500}
.pill-p{font-size:10px;background:#dbeafe;color:#1e40af;padding:2px 6px;border-radius:4px;font-weight:500}
.pill-f{font-size:10px;background:#fee2e2;color:#991b1b;padding:2px 6px;border-radius:4px;font-weight:500}
.pill-disp{font-size:10px;background:#fef3c7;color:#92400e;padding:2px 6px;border-radius:4px;font-weight:500}
.fin-cc-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px}
.fin-avenca-strip{background:#E6F1FB;border:0.5px solid #B5D4F4;border-radius:10px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.gc-btn-sm{padding:5px 12px;border-radius:7px;border:0.5px solid #e2e8f0;background:#fff;font-size:12px;cursor:pointer;color:#0f172a;font-family:inherit}
.gc-btn-sm:hover{background:#f8fafc}
</style>

<!-- TOPO -->
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
  <div>
    <div style="font-size:19px;font-weight:800;color:#0f2d52;">Rendimentos</div>
    <div style="font-size:12px;color:#94a3b8;margin-top:2px;">${mesLabel(ano, mes)} · Dr. João Morais</div>
  </div>
  <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
    <select id="finSelClinica" style="padding:6px 10px;border:0.5px solid #e2e8f0;border-radius:8px;background:#fff;font-size:12px;color:#0f172a;font-family:inherit;">
      <option value="">Todas as clínicas</option>
      ${entClinicas.map(e => `<option value="${e.id}" ${clinicaFiltro === e.id ? "selected" : ""}>${escapeHtml(e.nome)}</option>`).join("")}
    </select>
    <div style="display:flex;background:#f1f5f9;border-radius:8px;padding:3px;gap:2px;">
      ${meses.map(m => `
        <button class="fin-mtab${m.ano === ano && m.mes === mes ? " on" : ""}" data-ano="${m.ano}" data-mes="${m.mes}">
          ${new Date(m.ano, m.mes-1, 1).toLocaleString("pt-PT",{month:"short"})}${m.ano !== now.getFullYear() ? " "+m.ano : ""}
        </button>
      `).join("")}
    </div>
    <button id="btnFinPdfMensal" class="gc-btn-primary" style="font-size:12px;padding:7px 14px;">PDF mensal</button>
  </div>
</div>

<!-- AVISO PENDENTES VENCIDOS -->
${pendVencidos.length > 0 ? `
<div style="background:#fef9ec;border:1px solid #f6c94e;border-radius:10px;padding:11px 16px;margin-bottom:14px;display:flex;gap:10px;align-items:flex-start;">
  <div style="font-size:16px;flex-shrink:0;">⚠️</div>
  <div style="flex:1;">
    <div style="font-size:13px;font-weight:700;color:#92400e;margin-bottom:4px;">${pendVencidos.length} consulta(s) com data passada ainda em estado pendente</div>
    ${Object.entries(pvPorEnt).map(([nome, rows]) => `
      <div style="font-size:12px;color:#78350f;margin-top:2px;">
        <b>${escapeHtml(nome)}</b> — ${rows.map(r => `${new Date(r.data+"T00:00:00").toLocaleDateString("pt-PT")} · ${escapeHtml(r.patients?.full_name||"—")}`).join(" | ")}
      </div>
    `).join("")}
    <div style="font-size:11px;color:#92400e;margin-top:6px;opacity:.8;">Actualize o estado na agenda antes de fechar o dia.</div>
  </div>
</div>
` : ""}

<!-- MÉTRICAS -->
<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:16px;">
  <div class="fin-mc">
    <div class="fin-mc-l">Realizadas</div>
    <div class="fin-mc-v" style="color:#059669;">${totalReal.toLocaleString("pt-PT",{style:"currency",currency:"EUR"})}</div>
    <div class="fin-mc-s">${realizadas.length} consulta(s) · média ${mediaConsulta.toLocaleString("pt-PT",{style:"currency",currency:"EUR"})}</div>
  </div>
  <div class="fin-mc">
    <div class="fin-mc-l">Pendentes</div>
    <div class="fin-mc-v" style="color:#1a56db;">${totalPend.toLocaleString("pt-PT",{style:"currency",currency:"EUR"})}</div>
    <div class="fin-mc-s">${pendentes.length} marcada(s) / chegou</div>
  </div>
  <div class="fin-mc">
    <div class="fin-mc-l">Faltas · dispensas</div>
    <div class="fin-mc-v" style="color:#DC2626;">${faltas.length} · ${dispensadas.length}</div>
    <div class="fin-mc-s">perdido: ${valorPerdido.toLocaleString("pt-PT",{style:"currency",currency:"EUR"})}</div>
  </div>
  <div class="fin-mc">
    <div class="fin-mc-l">Avenças</div>
    <div class="fin-mc-v">${totalAvencas.toLocaleString("pt-PT",{style:"currency",currency:"EUR"})}</div>
    <div class="fin-mc-s">${avencas.map(e=>escapeHtml(e.nome.split("—")[0].trim())).join(" · ")}</div>
  </div>
</div>

<!-- TABS DE VISTA -->
<div style="display:flex;gap:0;border-bottom:0.5px solid #e2e8f0;margin-bottom:16px;">
  <button class="fin-vtab${vistaActual==="clinica"?" on":""}" data-vista="clinica">Por clínica</button>
  <button class="fin-vtab${vistaActual==="registos"?" on":""}" data-vista="registos">Registos</button>
  <button class="fin-vtab${vistaActual==="analise"?" on":""}" data-vista="analise">Análise</button>
</div>

<!-- ════ VISTA: POR CLÍNICA ════ -->
<div id="finVistaCli" style="display:${vistaActual==="clinica"?"block":"none"};">

  <!-- Avenças strip -->
  ${avencas.length > 0 ? `
  <div class="fin-avenca-strip">
    <div>
      <div style="font-size:13px;font-weight:700;color:#0C447C;">Avenças fixas mensais</div>
      <div style="font-size:11px;color:#185FA5;margin-top:2px;">${avencas.map(e=>`${escapeHtml(e.nome)} — ${Number(e.avenca_valor||0).toLocaleString("pt-PT",{style:"currency",currency:"EUR"})}`).join(" · ")}</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:16px;font-weight:700;color:#0C447C;">${totalAvencas.toLocaleString("pt-PT",{style:"currency",currency:"EUR"})}</div>
      <div style="font-size:11px;color:#185FA5;">/mês</div>
    </div>
  </div>
  ` : ""}

  <!-- Grid de clínicas -->
  <div class="fin-cc-grid">
    ${entClinicas.map(e => {
      const d = dadosPorEntidade(e.id);
      const tipos = Object.entries(d.porTipo).sort((a,b) => b[1].valor - a[1].valor);
      return `
      <div class="fin-card">
        <div class="fin-card-head">
          <div>
            <div style="font-size:13px;font-weight:700;color:#0f172a;">${escapeHtml(e.nome)}</div>
            <div style="font-size:11px;color:#94a3b8;margin-top:2px;">${e.gera_pdf_consulta ? `PDF contabilista a ${Number(e.valor_faturado||0).toFixed(0)}€/cons.` : "Consultas e procedimentos"}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:15px;font-weight:700;color:#0f2d52;">${d.totalEnt.toLocaleString("pt-PT",{style:"currency",currency:"EUR"})}</div>
            <div style="font-size:11px;color:#94a3b8;">realizadas</div>
          </div>
        </div>
        <div style="padding:0;">
          ${tipos.length === 0 ? `<div style="padding:16px;text-align:center;color:#94a3b8;font-size:12px;">Sem registos</div>` :
            `<table class="fin-tbl">
              <tbody>
                ${tipos.map(([tipo, v]) => `
                  <tr>
                    <td style="color:#475569;">${escapeHtml(tipo)}</td>
                    <td style="text-align:right;">
                      <div style="display:flex;gap:4px;justify-content:flex-end;align-items:center;flex-wrap:wrap;">
                        ${v.done > 0 ? `<span class="pill-d">${v.done}✓</span>` : ""}
                        ${v.pend > 0 ? `<span class="pill-p">${v.pend}⏳</span>` : ""}
                        ${v.falta > 0 ? `<span class="pill-f">${v.falta}✗</span>` : ""}
                        ${v.disp > 0 ? `<span class="pill-disp">${v.disp}D</span>` : ""}
                        <span style="font-size:12px;font-weight:700;color:#0f2d52;min-width:52px;text-align:right;">${v.valor > 0 ? v.valor.toLocaleString("pt-PT",{style:"currency",currency:"EUR"}) : "—"}</span>
                      </div>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>`
          }
          ${e.gera_pdf_consulta ? `
          <div style="padding:10px 14px;border-top:0.5px solid #f1f5f9;display:flex;justify-content:flex-end;">
            <button class="gc-btn-sm btnFinPdfCli" data-entid="${e.id}">Gerar PDF contabilista</button>
          </div>` : ""}
        </div>
      </div>`;
    }).join("")}
  </div>

  <!-- Entidades externas: FPF, UC, etc. -->
  ${entExternas.length > 0 ? `
  <div class="fin-card" style="margin-top:4px;">
    <div class="fin-card-head">
      <span class="fin-card-title">${entExternas.map(e=>escapeHtml(e.nome)).join(" · ")}</span>
      <div style="display:flex;gap:6px;">
        ${entExternas.map(e => `<button class="gc-btn-sm btnFinNovaPresenca" data-entid="${e.id}" data-nome="${escapeHtml(e.nome)}" data-tipo="${e.tipo}">+ ${escapeHtml(e.nome.split(" ")[0])}</button>`).join("")}
      </div>
    </div>
    <table class="fin-tbl">
      <thead><tr><th>Data</th><th>Entidade</th><th>Descrição</th><th>Dias</th><th style="text-align:right;">Valor</th><th></th></tr></thead>
      <tbody>
        ${entExternas.flatMap(e => presencasPorEntidade(e.id)).length === 0
          ? `<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:20px;">Sem registos. Use os botões acima para adicionar.</td></tr>`
          : entExternas.flatMap(e => presencasPorEntidade(e.id).map(p => {
              const dI = new Date(p.data_inicio+"T00:00:00").toLocaleDateString("pt-PT");
              const dF = p.data_inicio !== p.data_fim ? new Date(p.data_fim+"T00:00:00").toLocaleDateString("pt-PT") : null;
              return `<tr>
                <td style="color:#64748b;white-space:nowrap;">${dI}${dF ? " → "+dF : ""}</td>
                <td style="font-weight:600;">${escapeHtml(e.nome)}</td>
                <td style="color:#64748b;">${escapeHtml(p.descricao||"—")}</td>
                <td style="color:#64748b;">${p.num_dias > 1 ? p.num_dias+" dias" : "1 dia"}</td>
                <td style="text-align:right;font-weight:700;color:#0f2d52;">${Number(p.valor_calculado||0).toLocaleString("pt-PT",{style:"currency",currency:"EUR"})}</td>
                <td style="text-align:right;"><button class="gc-btn-sm btnFinEditPresenca" data-pid="${p.id}">Editar</button></td>
              </tr>`;
            })).join("")
        }
      </tbody>
    </table>
  </div>
  ` : ""}
</div>

<!-- ════ VISTA: REGISTOS ════ -->
<div id="finVistaReg" style="display:${vistaActual==="registos"?"block":"none"};">
  <div class="fin-card">
    <div class="fin-card-head">
      <span class="fin-card-title">Todos os registos — ${mesLabel(ano, mes)}</span>
      <div style="display:flex;gap:6px;">
        <button id="btnFinPdfAthletix" class="gc-btn-sm">PDF Athletix</button>
        <button id="btnFinNovoRegisto" class="gc-btn-primary" style="font-size:12px;padding:6px 14px;">+ Registo</button>
      </div>
    </div>
    ${registosFiltrados.length === 0
      ? `<div style="padding:32px;text-align:center;color:#94a3b8;font-size:13px;">Sem registos para ${mesLabel(ano, mes)}.</div>`
      : `<table class="fin-tbl">
          <thead><tr><th>Data</th><th>Entidade</th><th>Acto</th><th>Doente</th><th>Estado</th><th style="text-align:right;">Valor</th><th></th></tr></thead>
          <tbody>
            ${registosFiltrados.map(r => {
              const ent  = r.entidades_financeiras || {};
              const pat  = r.patients || {};
              const conta = contaParaTotal(r.appt_status, r.financial_status);
              return `<tr>
                <td style="color:#64748b;white-space:nowrap;">${r.data ? new Date(r.data+"T00:00:00").toLocaleDateString("pt-PT") : "—"}</td>
                <td style="font-weight:600;">${escapeHtml(ent.nome||"—")}</td>
                <td style="color:#64748b;">${escapeHtml(r.tipo_acto||r.periodo||"—")}</td>
                <td style="color:#64748b;">${escapeHtml(pat.full_name||"—")}</td>
                <td>${badgeStatus(r.appt_status, r.financial_status)}</td>
                <td style="text-align:right;font-weight:700;color:${conta?"#0f2d52":"#94a3b8"};">${conta ? Number(r.valor||0).toLocaleString("pt-PT",{style:"currency",currency:"EUR"}) : "—"}</td>
                <td style="text-align:right;"><button class="gc-btn-sm btnFinEditar" data-id="${r.id}">Editar</button></td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>`
    }
  </div>
</div>

<!-- ════ VISTA: ANÁLISE ════ -->
<div id="finVistaAna" style="display:${vistaActual==="analise"?"block":"none"};">
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
    <div class="fin-card">
      <div class="fin-card-head"><span class="fin-card-title">Tipos de acto</span></div>
      <div style="padding:14px;">
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px;">
          ${tiposOrdenados.map(([t,n],i) => `<span style="display:flex;align-items:center;gap:4px;font-size:11px;color:#64748b;"><span style="width:9px;height:9px;border-radius:2px;background:${tipoCores[i]||"#94a3b8"};display:inline-block;"></span>${escapeHtml(t)} ${Math.round((n/totalTipos)*100)}%</span>`).join("")}
        </div>
        <div style="position:relative;width:100%;height:160px;"><canvas id="finChartTipos"></canvas></div>
      </div>
    </div>
    <div class="fin-card">
      <div class="fin-card-head"><span class="fin-card-title">Consultas por semana</span></div>
      <div style="padding:14px;">
        <div style="position:relative;width:100%;height:180px;"><canvas id="finChartSemanas"></canvas></div>
      </div>
    </div>
  </div>
  <div class="fin-card">
    <div class="fin-card-head"><span class="fin-card-title">Estado das consultas</span></div>
    <div style="padding:14px 16px;">
      ${[
        {label:"Realizadas", count:realizadas.length, bg:"#d1fae5", fg:"#065f46", dot:"#059669"},
        {label:"Pendentes",  count:pendentes.length,  bg:"#dbeafe", fg:"#1e40af", dot:"#1a56db"},
        {label:"Faltou",     count:faltas.length,     bg:"#fee2e2", fg:"#991b1b", dot:"#DC2626"},
        {label:"Dispensado", count:dispensadas.length,bg:"#fef3c7", fg:"#92400e", dot:"#D97706"},
      ].map(s => {
        const total = realizadas.length + pendentes.length + faltas.length + dispensadas.length || 1;
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:0.5px solid #f1f5f9;">
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="width:8px;height:8px;border-radius:50%;background:${s.dot};flex-shrink:0;"></div>
            <span style="font-size:13px;">${s.label}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:13px;font-weight:700;">${s.count}</span>
            <span style="font-size:11px;background:${s.bg};color:${s.fg};padding:2px 7px;border-radius:4px;">${Math.round((s.count/total)*100)}%</span>
          </div>
        </div>`;
      }).join("")}
      <div style="margin-top:12px;padding-top:10px;border-top:0.5px solid #f1f5f9;">
        <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Valor perdido</div>
        <div style="font-size:20px;font-weight:700;color:#A32D2D;">${valorPerdido > 0 ? "−" : ""}${valorPerdido.toLocaleString("pt-PT",{style:"currency",currency:"EUR"})}</div>
      </div>
    </div>
  </div>
</div>
    `;

    /* ══════ WIRING ══════ */

    /* Tabs de mês */
    content.querySelectorAll(".fin-mtab").forEach(btn => {
      btn.addEventListener("click", () => {
        ano = parseInt(btn.dataset.ano, 10);
        mes = parseInt(btn.dataset.mes, 10);
        render();
      });
    });

    /* Selector de clínica */
    document.getElementById("finSelClinica")?.addEventListener("change", e => {
      clinicaFiltro = e.target.value;
      render();
    });

    /* Tabs de vista */
    content.querySelectorAll(".fin-vtab").forEach(btn => {
      btn.addEventListener("click", () => {
        vistaActual = btn.dataset.vista;
        content.querySelectorAll(".fin-vtab").forEach(b => b.classList.remove("on"));
        btn.classList.add("on");
        document.getElementById("finVistaCli").style.display = vistaActual === "clinica"  ? "block" : "none";
        document.getElementById("finVistaReg").style.display = vistaActual === "registos" ? "block" : "none";
        document.getElementById("finVistaAna").style.display = vistaActual === "analise"  ? "block" : "none";
        if (vistaActual === "analise") renderCharts();
      });
    });

    /* PDF mensal */
    document.getElementById("btnFinPdfMensal")?.addEventListener("click", () => {
      openPdfMensal(registosFiltrados, presencas, entidades, mes, ano);
    });

    /* PDF Athletix */
    document.getElementById("btnFinPdfAthletix")?.addEventListener("click", () => {
      openModalPdfAthletix(registosFiltrados, mes, ano);
    });

    /* PDF por clínica */
    content.querySelectorAll(".btnFinPdfCli").forEach(btn => {
      btn.addEventListener("click", () => {
        const entId = btn.dataset.entid;
        const regsEnt = registosFiltrados.filter(r => r.entidade_id === entId);
        openModalPdfAthletix(regsEnt, mes, ano);
      });
    });

    /* Nova presença (FPF/UC) */
    content.querySelectorAll(".btnFinNovaPresenca").forEach(btn => {
      btn.addEventListener("click", () => {
        const entId = btn.dataset.entid;
        const nome  = btn.dataset.nome;
        const tipo  = btn.dataset.tipo;
        const ent   = entidades.find(e => e.id === entId);
        openModalPresenca({ ent, onSave: render });
      });
    });

    /* Editar presença */
    content.querySelectorAll(".btnFinEditPresenca").forEach(btn => {
      btn.addEventListener("click", async () => {
        const pid = btn.dataset.pid;
        const p   = presencas.find(x => x.id === pid);
        if (p) {
          const ent = entidades.find(e => e.id === p.entidade_id);
          openModalPresenca({ ent, presenca: p, onSave: render });
        }
      });
    });

    /* Editar registo */
    content.querySelectorAll(".btnFinEditar").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const r  = registosFiltrados.find(x => x.id === id);
        if (r) openModalEditarRegisto(r, entidades, render);
      });
    });

    /* Novo registo */
    document.getElementById("btnFinNovoRegisto")?.addEventListener("click", async () => {
      try {
        const clinicPrices = {};
        for (const e of entidades.filter(e => e.clinic_id)) {
          if (!clinicPrices[e.clinic_id]) {
            clinicPrices[e.clinic_id] = await loadClinicPrices(e.clinic_id);
          }
        }
        openModalNovoRegisto({ entidades, clinicPrices, onSave: render, ano, mes });
      } catch (err) { console.error(err); }
    });

    /* Gráficos */
    function renderCharts() {
      ["finChartTipos","finChartSemanas"].forEach(id => {
        const el = document.getElementById(id);
        if (el?._chartInstance) { el._chartInstance.destroy(); el._chartInstance = null; }
      });
      const cT = document.getElementById("finChartTipos");
      if (cT && tiposOrdenados.length > 0) {
        cT._chartInstance = new Chart(cT, {
          type: "doughnut",
          data: { datasets: [{ data: tiposOrdenados.map(([,n])=>n), backgroundColor: tipoCores.slice(0, tiposOrdenados.length), borderWidth: 2, borderColor: "#fff" }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, cutout: "62%" }
        });
      }
      const cS = document.getElementById("finChartSemanas");
      if (cS) {
        cS._chartInstance = new Chart(cS, {
          type: "bar",
          data: { labels: ["S1 (1–7)","S2 (8–14)","S3 (15–21)","S4 (22–31)"], datasets: [{ data: porSemana, backgroundColor: "#185FA5", borderRadius: 5, borderSkipped: false }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 11 }, color: "#94a3b8", autoSkip: false } }, y: { beginAtZero: true, grid: { color: "#f1f5f9" }, ticks: { font: { size: 11 }, color: "#94a3b8", stepSize: 1, precision: 0 } } } }
        });
      }
    }
    if (!window.Chart) {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js";
      s.onload = () => { if (vistaActual === "analise") renderCharts(); };
      document.head.appendChild(s);
    }
    if (vistaActual === "analise") renderCharts();
  }

  await render();
}


/* ==== FD — Modais ==== */

/* ---- FD.1 — openModalNovoRegisto ---- */
function openModalNovoRegisto({ entidades, clinicPrices, onSave, ano, mes }) {
  document.getElementById("gcFinModal")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "gcFinModal";
  Object.assign(overlay.style, {
    position: "fixed", inset: "0", background: "rgba(0,0,0,0.35)",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: "16px", zIndex: "2000",
    fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif"
  });

  const hoje = new Date().toISOString().slice(0, 10);

  overlay.innerHTML = `
    <div style="background:#fff;width:min(560px,100%);border-radius:14px;border:1px solid #e2e8f0;padding:22px;max-height:90vh;overflow-y:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
        <div style="font-size:15px;font-weight:800;color:#0f2d52;">Novo Registo Financeiro</div>
        <button id="gcFinModalClose" class="gc-btn" style="font-size:12px;">Fechar</button>
      </div>

      <div style="display:flex;flex-direction:column;gap:12px;">

        <div>
          <label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px;">Entidade *</label>
          <select id="finEntidade" style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;">
            <option value="">— seleccionar —</option>
            ${entidades.map(e => `<option value="${e.id}" data-tipo="${e.tipo}" data-clinic="${e.clinic_id || ""}" data-avenca="${e.avenca_valor || 0}" data-diaria="${e.tipo === "diaria" ? 200 : 0}">${escapeHtml(e.nome)}</option>`).join("")}
          </select>
        </div>

        <div id="finActoRow" style="display:none;">
          <label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px;">Tipo de acto</label>
          <select id="finActo" style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;">
            <option value="">— seleccionar —</option>
          </select>
        </div>

        <div>
          <label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px;">Data *</label>
          <input id="finData" type="date" value="${hoje}"
            style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;" />
        </div>

        <div>
          <label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px;">Valor (€) *</label>
          <input id="finValor" type="number" min="0" step="0.01" placeholder="0.00"
            style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;" />
        </div>

        <div>
          <label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px;">Estado da consulta</label>
          <select id="finApptStatus" style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;">
            <option value="done">Realizada</option>
            <option value="scheduled">Marcada</option>
            <option value="arrived">Chegou</option>
            <option value="no_show">Faltou</option>
          </select>
        </div>

        <div>
          <label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px;">Estado financeiro</label>
          <select id="finFinStatus" style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;">
            <option value="normal">Normal</option>
            <option value="honorarios_dispensados">Dispensa de honorários</option>
          </select>
        </div>

        <div>
          <label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px;">Notas</label>
          <input id="finNotas" type="text" placeholder="opcional"
            style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;" />
        </div>

        <div id="finMsg" style="font-size:12px;color:#b00020;min-height:16px;"></div>

        <button id="finBtnGuardar" class="gc-btn-primary" style="width:100%;padding:10px;">Guardar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const selEnt    = overlay.querySelector("#finEntidade");
  const actoRow   = overlay.querySelector("#finActoRow");
  const selActo   = overlay.querySelector("#finActo");
  const inpValor  = overlay.querySelector("#finValor");
  const msg       = overlay.querySelector("#finMsg");

  /* Ao mudar entidade — actualizar actos e valor */
  selEnt.addEventListener("change", () => {
    const opt    = selEnt.selectedOptions[0];
    const tipo   = opt?.dataset.tipo || "";
    const clinic = opt?.dataset.clinic || "";

    if (tipo === "acto" && clinic && clinicPrices[clinic]) {
      actoRow.style.display = "block";
      const prices = clinicPrices[clinic];
      selActo.innerHTML = `<option value="">— seleccionar —</option>` +
        prices.map(p => `<option value="${escapeHtml(p.procedure_type)}" data-valor="${p.price}">${escapeHtml(p.procedure_type)} — ${Number(p.price).toFixed(2)}€</option>`).join("") +
        `<option value="__outro__">Outro (valor manual)</option>`;
    } else {
      actoRow.style.display = "none";
    }

    /* Pré-preencher valor */
    if (tipo === "avenca") {
      inpValor.value = opt?.dataset.avenca || "";
    } else if (tipo === "diaria") {
      inpValor.value = "200";
    } else {
      inpValor.value = "";
    }
  });

  /* Ao mudar acto — preencher valor */
  selActo.addEventListener("change", () => {
    const opt = selActo.selectedOptions[0];
    if (opt?.dataset.valor !== undefined) {
      inpValor.value = opt.dataset.valor;
    }
  });

  /* Fechar */
  const close = () => overlay.remove();
  overlay.querySelector("#gcFinModalClose").addEventListener("click", close);
  overlay.addEventListener("click", ev => { if (ev.target === overlay) close(); });

  /* Guardar */
  overlay.querySelector("#finBtnGuardar").addEventListener("click", async () => {
    msg.textContent = "";
    const entId      = selEnt.value;
    const data       = overlay.querySelector("#finData").value;
    const valor      = parseFloat(overlay.querySelector("#finValor").value || "0");
    const apptStatus = overlay.querySelector("#finApptStatus").value;
    const finStatus  = overlay.querySelector("#finFinStatus").value;
    const notas      = overlay.querySelector("#finNotas").value.trim();
    const tipoActo   = selActo.value && selActo.value !== "__outro__" ? selActo.value : null;

    if (!entId)  { msg.textContent = "Seleccione a entidade."; return; }
    if (!data)   { msg.textContent = "Indique a data."; return; }
    if (isNaN(valor)) { msg.textContent = "Valor inválido."; return; }

    const ent     = entidades.find(e => e.id === entId);
    const periodo = periodoFromDate(data);

    const payload = {
      entidade_id:      entId,
      data,
      periodo,
      tipo_acto:        tipoActo || ent?.tipo || null,
      valor:            finStatus === "honorarios_dispensados" ? 0 : valor,
      financial_status: finStatus,
      appt_status:      apptStatus,
      notas:            notas || null,
    };

    try {
      overlay.querySelector("#finBtnGuardar").disabled = true;
      await insertRegisto(payload);
      close();
      await onSave();
    } catch (e) {
      console.error("insertRegisto falhou:", e);
      msg.textContent = "Erro ao guardar. Vê a consola.";
      overlay.querySelector("#finBtnGuardar").disabled = false;
    }
  });
}

/* ---- FD.2 — openModalEditarRegisto ---- */
function openModalEditarRegisto(registo, entidades, onSave) {
  document.getElementById("gcFinEditModal")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "gcFinEditModal";
  Object.assign(overlay.style, {
    position: "fixed", inset: "0", background: "rgba(0,0,0,0.35)",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: "16px", zIndex: "2000",
    fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif"
  });

  const ent = entidades.find(e => e.id === registo.entidade_id) || {};

  overlay.innerHTML = `
    <div style="background:#fff;width:min(520px,100%);border-radius:14px;border:1px solid #e2e8f0;padding:22px;max-height:90vh;overflow-y:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
        <div style="font-size:15px;font-weight:800;color:#0f2d52;">Editar Registo</div>
        <button id="gcFinEditClose" class="gc-btn" style="font-size:12px;">Fechar</button>
      </div>
      <div style="font-size:13px;color:#64748b;margin-bottom:14px;">${escapeHtml(ent.nome || "—")} · ${escapeHtml(registo.tipo_acto || registo.periodo || "—")}</div>

      <div style="display:flex;flex-direction:column;gap:12px;">

        <div>
          <label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px;">Data</label>
          <input id="finEditData" type="date" value="${registo.data || ""}"
            style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;" />
        </div>

        <div>
          <label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px;">Valor (€)</label>
          <input id="finEditValor" type="number" min="0" step="0.01" value="${registo.valor || 0}"
            style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;" />
        </div>

        <div>
          <label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px;">Estado da consulta</label>
          <select id="finEditApptStatus" style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;">
            <option value="done"      ${registo.appt_status === "done"      ? "selected" : ""}>Realizada</option>
            <option value="scheduled" ${registo.appt_status === "scheduled" ? "selected" : ""}>Marcada</option>
            <option value="arrived"   ${registo.appt_status === "arrived"   ? "selected" : ""}>Chegou</option>
            <option value="no_show"   ${registo.appt_status === "no_show"   ? "selected" : ""}>Faltou</option>
          </select>
        </div>

        <div>
          <label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px;">Estado financeiro</label>
          <select id="finEditFinStatus" style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;">
            <option value="normal"                  ${registo.financial_status === "normal"                  ? "selected" : ""}>Normal</option>
            <option value="honorarios_dispensados"  ${registo.financial_status === "honorarios_dispensados"  ? "selected" : ""}>Dispensa de honorários</option>
          </select>
        </div>

        <div>
          <label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px;">Notas</label>
          <input id="finEditNotas" type="text" value="${escapeHtml(registo.notas || "")}"
            style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;" />
        </div>

        <div id="finEditMsg" style="font-size:12px;color:#b00020;min-height:16px;"></div>

        <div style="display:flex;gap:8px;">
          <button id="finEditBtnGuardar" class="gc-btn-primary" style="flex:1;padding:10px;">Guardar</button>
          <button id="finEditBtnEliminar" class="gc-btn" style="padding:10px;color:#b00020;border-color:#fecaca;">Eliminar</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector("#gcFinEditClose").addEventListener("click", close);
  overlay.addEventListener("click", ev => { if (ev.target === overlay) close(); });

  overlay.querySelector("#finEditBtnGuardar").addEventListener("click", async () => {
    const msg        = overlay.querySelector("#finEditMsg");
    const data       = overlay.querySelector("#finEditData").value;
    const valor      = parseFloat(overlay.querySelector("#finEditValor").value || "0");
    const apptStatus = overlay.querySelector("#finEditApptStatus").value;
    const finStatus  = overlay.querySelector("#finEditFinStatus").value;
    const notas      = overlay.querySelector("#finEditNotas").value.trim();

    if (!data) { msg.textContent = "Indique a data."; return; }

    try {
      overlay.querySelector("#finEditBtnGuardar").disabled = true;

      await updateRegisto(registo.id, {
        data,
        periodo:          periodoFromDate(data),
        valor:            finStatus === "honorarios_dispensados" ? 0 : valor,
        financial_status: finStatus,
        appt_status:      apptStatus,
        notas:            notas || null,
      });

      // Sincronizar estado de volta ao appointment correspondente
      if (registo.appointment_id) {
        try {
          await window.sb
            .from("appointments")
            .update({
              status:           apptStatus,
              financial_status: finStatus
            })
            .eq("id", registo.appointment_id);
        } catch (syncErr) {
          console.warn("Sync appointment falhou (não crítico):", syncErr);
        }
      }

      close();
      await onSave();
    } catch (e) {
      console.error("updateRegisto falhou:", e);
      msg.textContent = "Erro ao guardar. Vê a consola.";
      overlay.querySelector("#finEditBtnGuardar").disabled = false;
    }
  });

  overlay.querySelector("#finEditBtnEliminar").addEventListener("click", async () => {
    if (!confirm("Eliminar este registo? Esta acção não pode ser desfeita.")) return;
    try {
      await deleteRegisto(registo.id);
      close();
      await onSave();
    } catch (e) {
      console.error("deleteRegisto falhou:", e);
      overlay.querySelector("#finEditMsg").textContent = "Erro ao eliminar.";
    }
  });
}

/* ---- FD.3 — openModalPdfAthletix ---- */
function openModalPdfAthletix(registos, mes, ano) {
  /* Filtrar só Athletix com consultas realizadas */
  const athletix = registos.filter(r => {
    const ent = r.entidades_financeiras || {};
    return ent.gera_pdf_consulta &&
           contaParaTotal(r.appt_status, r.financial_status) &&
           r.patients;
  });

  if (athletix.length === 0) {
    alert(`Sem consultas realizadas na Athletix em ${mesLabel(ano, mes)}.`);
    return;
  }

  const linhas = athletix.map(r => {
    const p   = r.patients || {};
    const ent = r.entidades_financeiras || {};
    const valorFaturado = Number(ent.valor_faturado || r.valor || 0);
    return `
      <tr>
        <td style="padding:8px 12px;border-bottom:0.5px solid #e2e8f0;">${new Date(r.data + "T00:00:00").toLocaleDateString("pt-PT")}</td>
        <td style="padding:8px 12px;border-bottom:0.5px solid #e2e8f0;">${escapeHtml(p.full_name || "—")}</td>
        <td style="padding:8px 12px;border-bottom:0.5px solid #e2e8f0;">${escapeHtml(p.nif || "—")}</td>
        <td style="padding:8px 12px;border-bottom:0.5px solid #e2e8f0;">${escapeHtml(p.address_line1 || "—")}</td>
        <td style="padding:8px 12px;border-bottom:0.5px solid #e2e8f0;text-align:right;font-weight:700;">${valorFaturado.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}</td>
      </tr>
    `;
  }).join("");

  const totalFaturado = athletix.reduce((s, r) => {
    const ent = r.entidades_financeiras || {};
    return s + Number(ent.valor_faturado || r.valor || 0);
  }, 0);

  const html = `<!doctype html><html><head><meta charset="utf-8">
    <title>Athletix — ${mesLabel(ano, mes)}</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 13px; color: #0f172a; margin: 40px; }
      h1 { font-size: 18px; font-weight: 900; color: #0f2d52; margin-bottom: 4px; }
      .sub { font-size: 13px; color: #64748b; margin-bottom: 24px; }
      table { width: 100%; border-collapse: collapse; }
      th { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase;
           letter-spacing: .05em; padding: 8px 12px; border-bottom: 2px solid #0f2d52; text-align: left; }
      .total { text-align: right; font-weight: 900; font-size: 15px; color: #0f2d52;
               padding: 12px; border-top: 2px solid #0f2d52; margin-top: 4px; }
      @media print { body { margin: 20px; } }
    </style>
    </head><body>
    <h1>Athletix — Consultas Realizadas</h1>
    <div class="sub">${mesLabel(ano, mes)} · Dr. João Morais · Para contabilista</div>
    <table>
      <thead>
        <tr>
          <th>Data</th><th>Nome</th><th>NIF</th><th>Morada</th><th style="text-align:right;">Valor</th>
        </tr>
      </thead>
      <tbody>${linhas}</tbody>
    </table>
    <div class="total">Total: ${totalFaturado.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}</div>
    <script>window.onload = () => window.print();<\/script>
    </body></html>`;

  const w = window.open("", "_blank");
  if (w) w.document.write(html);
}

/* ---- FD.4 — openModalPresenca ---- */
function openModalPresenca({ ent, presenca, onSave }) {
  document.getElementById("gcPresModal")?.remove();
  const isEdit = !!presenca;
  const hoje   = new Date().toISOString().slice(0, 10);
  const isFpf  = (ent?.tipo || "") === "diaria";

  const overlay = document.createElement("div");
  overlay.id = "gcPresModal";
  Object.assign(overlay.style, {
    position: "fixed", inset: "0", background: "rgba(0,0,0,0.35)",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: "16px", zIndex: "2000",
    fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif"
  });

  overlay.innerHTML = `
    <div style="background:#fff;width:min(480px,100%);border-radius:14px;border:1px solid #e2e8f0;padding:22px;max-height:90vh;overflow-y:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
        <div style="font-size:15px;font-weight:800;color:#0f2d52;">${isEdit ? "Editar" : "Novo"} — ${escapeHtml(ent?.nome||"")}</div>
        <button id="gcPresClose" class="gc-btn" style="font-size:12px;">Fechar</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div>
            <label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px;">${isFpf ? "Data início *" : "Data *"}</label>
            <input id="presDataIni" type="date" value="${presenca?.data_inicio || hoje}"
              style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;" />
          </div>
          <div>
            <label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px;">Data fim</label>
            <input id="presDataFim" type="date" value="${presenca?.data_fim || hoje}"
              style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;" />
          </div>
        </div>
        <div id="presDiasWrap" style="background:#f8fafc;border-radius:8px;padding:10px 12px;font-size:13px;color:#0f2d52;font-weight:600;text-align:center;">
          1 dia
        </div>
        <div>
          <label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px;">Descrição</label>
          <input id="presDescricao" type="text" value="${escapeHtml(presenca?.descricao||"")}"
            placeholder="${isFpf ? "ex: Jogo Sub-21 · Estágio · Treino" : "ex: Aula de Medicina Desportiva"}"
            style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;" />
        </div>
        <div>
          <label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px;">Valor por dia (€)</label>
          <input id="presValorDia" type="number" min="0" step="0.01"
            value="${presenca?.valor_dia || (isFpf ? 200 : 0)}"
            style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;" />
        </div>
        <div id="presValorTotalWrap" style="background:#E6F1FB;border-radius:8px;padding:10px 12px;font-size:14px;color:#0C447C;font-weight:700;text-align:right;">
          Total: 200,00 €
        </div>
        <div>
          <label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px;">Notas</label>
          <input id="presNotas" type="text" value="${escapeHtml(presenca?.notas||"")}"
            style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;" />
        </div>
        <div id="presMsg" style="font-size:12px;color:#b00020;min-height:16px;"></div>
        <div style="display:flex;gap:8px;">
          <button id="presBtnGuardar" class="gc-btn-primary" style="flex:1;padding:10px;">Guardar</button>
          ${isEdit ? `<button id="presBtnEliminar" class="gc-btn" style="padding:10px;color:#b00020;border-color:#fecaca;">Eliminar</button>` : ""}
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const inpIni   = overlay.querySelector("#presDataIni");
  const inpFim   = overlay.querySelector("#presDataFim");
  const inpVal   = overlay.querySelector("#presValorDia");
  const wrapDias = overlay.querySelector("#presDiasWrap");
  const wrapTot  = overlay.querySelector("#presValorTotalWrap");
  const msg      = overlay.querySelector("#presMsg");

  function updateCalc() {
    const d1 = inpIni.value, d2 = inpFim.value;
    if (!d1 || !d2) return;
    const dias  = Math.max(1, Math.round((new Date(d2) - new Date(d1)) / 86400000) + 1);
    const valor = parseFloat(inpVal.value || 0);
    wrapDias.textContent = `${dias} dia(s)`;
    wrapTot.textContent  = `Total: ${(dias * valor).toLocaleString("pt-PT",{style:"currency",currency:"EUR"})}`;
  }

  inpIni.addEventListener("change", updateCalc);
  inpFim.addEventListener("change", updateCalc);
  inpVal.addEventListener("input",  updateCalc);
  updateCalc();

  const close = () => overlay.remove();
  overlay.querySelector("#gcPresClose").addEventListener("click", close);
  overlay.addEventListener("click", ev => { if (ev.target === overlay) close(); });

  overlay.querySelector("#presBtnGuardar").addEventListener("click", async () => {
    const ini   = inpIni.value;
    const fim   = inpFim.value;
    const vdia  = parseFloat(inpVal.value || 0);
    const desc  = overlay.querySelector("#presDescricao").value.trim();
    const notas = overlay.querySelector("#presNotas").value.trim();

    if (!ini) { msg.textContent = "Indique a data de início."; return; }
    if (!fim || fim < ini) { msg.textContent = "Data fim tem de ser igual ou posterior ao início."; return; }

    const payload = {
      entidade_id: ent.id,
      data_inicio: ini,
      data_fim:    fim,
      tipo:        ini === fim ? "dia" : "intervalo",
      descricao:   desc || null,
      valor_dia:   vdia,
      notas:       notas || null,
    };

    try {
      overlay.querySelector("#presBtnGuardar").disabled = true;
      if (isEdit) await updatePresenca(presenca.id, payload);
      else        await insertPresenca(payload);
      close();
      await onSave();
    } catch (e) {
      console.error("presenca guardar falhou:", e);
      msg.textContent = "Erro ao guardar. Vê a consola.";
      overlay.querySelector("#presBtnGuardar").disabled = false;
    }
  });

  overlay.querySelector("#presBtnEliminar")?.addEventListener("click", async () => {
    if (!confirm("Eliminar este registo?")) return;
    try {
      await deletePresenca(presenca.id);
      close();
      await onSave();
    } catch (e) {
      msg.textContent = "Erro ao eliminar.";
    }
  });
}


/* ---- FD.5 — openPdfMensal ---- */
function openPdfMensal(registos, presencas, entidades, mes, ano) {
  const realizadas = registos.filter(r => contaParaTotal(r.appt_status, r.financial_status));
  const faltas     = registos.filter(r => String(r.appt_status||"").toLowerCase() === "no_show");
  const dispensas  = registos.filter(r => r.financial_status === "honorarios_dispensados");
  const avencas    = entidades.filter(e => e.tipo === "avenca");
  const totalReal  = realizadas.reduce((s,r) => s + Number(r.valor||0), 0);
  const totalAv    = avencas.reduce((s,e) => s + Number(e.avenca_valor||0), 0);
  const totalPres  = presencas.reduce((s,p) => s + Number(p.valor_calculado||0), 0);

  const linhasReal = realizadas.map(r => {
    const pat = r.patients||{};
    const ent = r.entidades_financeiras||{};
    return `<tr>
      <td>${r.data ? new Date(r.data+"T00:00:00").toLocaleDateString("pt-PT") : "—"}</td>
      <td>${escapeHtml(ent.nome||"—")}</td>
      <td>${escapeHtml(r.tipo_acto||"—")}</td>
      <td>${escapeHtml(pat.full_name||"—")}</td>
      <td style="text-align:right;">${Number(r.valor||0).toLocaleString("pt-PT",{style:"currency",currency:"EUR"})}</td>
    </tr>`;
  }).join("");

  const linhasPres = presencas.map(p => {
    const ent = entidades.find(e => e.id === p.entidade_id)||{};
    const dI  = new Date(p.data_inicio+"T00:00:00").toLocaleDateString("pt-PT");
    const dF  = p.data_inicio !== p.data_fim ? " → "+new Date(p.data_fim+"T00:00:00").toLocaleDateString("pt-PT") : "";
    return `<tr>
      <td>${dI}${dF}</td>
      <td>${escapeHtml(ent.nome||"—")}</td>
      <td>${escapeHtml(p.descricao||"—")}</td>
      <td>${p.num_dias} dia(s)</td>
      <td style="text-align:right;">${Number(p.valor_calculado||0).toLocaleString("pt-PT",{style:"currency",currency:"EUR"})}</td>
    </tr>`;
  }).join("");

  const html = `<!doctype html><html><head><meta charset="utf-8">
    <title>Rendimentos — ${mesLabel(ano, mes)}</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:13px;color:#0f172a;margin:40px}
      h1{font-size:18px;font-weight:900;color:#0f2d52;margin-bottom:4px}
      .sub{font-size:12px;color:#64748b;margin-bottom:24px}
      h2{font-size:14px;font-weight:700;color:#0f2d52;margin:20px 0 8px}
      table{width:100%;border-collapse:collapse;margin-bottom:16px}
      th{font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;padding:7px 10px;border-bottom:2px solid #0f2d52;text-align:left}
      td{padding:7px 10px;border-bottom:0.5px solid #e2e8f0;font-size:12px}
      .total{text-align:right;font-weight:900;font-size:14px;color:#0f2d52;padding:10px;border-top:2px solid #0f2d52;margin-top:4px}
      .avenca-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:0.5px solid #e2e8f0;font-size:12px}
      .sumario{background:#f8fafc;border-radius:8px;padding:14px;margin-top:16px}
      .sum-row{display:flex;justify-content:space-between;padding:5px 0;font-size:13px}
      .sum-total{font-weight:900;font-size:15px;color:#0f2d52;border-top:1px solid #e2e8f0;margin-top:4px;padding-top:8px}
      @media print{body{margin:20px}}
    </style>
    </head><body>
    <h1>Rendimentos — Dr. João Morais</h1>
    <div class="sub">${mesLabel(ano, mes)}</div>

    ${avencas.length > 0 ? `
    <h2>Avenças mensais</h2>
    ${avencas.map(e => `<div class="avenca-row"><span>${escapeHtml(e.nome)}</span><span style="font-weight:700;">${Number(e.avenca_valor||0).toLocaleString("pt-PT",{style:"currency",currency:"EUR"})}</span></div>`).join("")}
    <div class="total">Total avenças: ${totalAv.toLocaleString("pt-PT",{style:"currency",currency:"EUR"})}</div>
    ` : ""}

    ${realizadas.length > 0 ? `
    <h2>Consultas e procedimentos realizados</h2>
    <table>
      <thead><tr><th>Data</th><th>Clínica</th><th>Tipo</th><th>Doente</th><th style="text-align:right;">Valor</th></tr></thead>
      <tbody>${linhasReal}</tbody>
    </table>
    <div class="total">Subtotal consultas: ${totalReal.toLocaleString("pt-PT",{style:"currency",currency:"EUR"})}</div>
    ` : ""}

    ${presencas.length > 0 ? `
    <h2>Presenças (FPF / UC)</h2>
    <table>
      <thead><tr><th>Data</th><th>Entidade</th><th>Descrição</th><th>Dias</th><th style="text-align:right;">Valor</th></tr></thead>
      <tbody>${linhasPres}</tbody>
    </table>
    <div class="total">Subtotal presenças: ${totalPres.toLocaleString("pt-PT",{style:"currency",currency:"EUR"})}</div>
    ` : ""}

    ${faltas.length > 0 ? `
    <h2>Faltas (sem valor)</h2>
    <table>
      <thead><tr><th>Data</th><th>Clínica</th><th>Tipo</th><th>Doente</th><th>Estado</th></tr></thead>
      <tbody>${faltas.map(r => `<tr>
        <td>${r.data ? new Date(r.data+"T00:00:00").toLocaleDateString("pt-PT") : "—"}</td>
        <td>${escapeHtml((r.entidades_financeiras||{}).nome||"—")}</td>
        <td>${escapeHtml(r.tipo_acto||"—")}</td>
        <td>${escapeHtml((r.patients||{}).full_name||"—")}</td>
        <td>Faltou</td>
      </tr>`).join("")}</tbody>
    </table>
    ` : ""}

    <div class="sumario">
      <div class="sum-row"><span>Avenças</span><span>${totalAv.toLocaleString("pt-PT",{style:"currency",currency:"EUR"})}</span></div>
      <div class="sum-row"><span>Consultas realizadas (${realizadas.length})</span><span>${totalReal.toLocaleString("pt-PT",{style:"currency",currency:"EUR"})}</span></div>
      <div class="sum-row"><span>Presenças</span><span>${totalPres.toLocaleString("pt-PT",{style:"currency",currency:"EUR"})}</span></div>
      <div class="sum-row sum-total"><span>TOTAL ESPERADO</span><span>${(totalAv+totalReal+totalPres).toLocaleString("pt-PT",{style:"currency",currency:"EUR"})}</span></div>
    </div>
    <script>window.onload = () => window.print();<\/script>
    </body></html>`;

  const w = window.open("", "_blank");
  if (w) w.document.write(html);
}


/* ==== FE — Boot ==== */

/* ---- FE.1 — initFinancas ---- */
export function initFinancas() {
  window.__gc_renderFinancas = renderFinancas;
}

initFinancas();
