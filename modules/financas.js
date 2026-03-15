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
  let   ano = now.getFullYear();
  let   mes = now.getMonth() + 1;

  async function render() {
    let entidades = [], registos = [];
    try {
      [entidades, registos] = await Promise.all([
        loadEntidades(),
        loadRegistos({ mes, ano })
      ]);
    } catch (e) {
      console.error("renderFinancas load falhou:", e);
      content.innerHTML = `<div style="color:#b00020;padding:20px;">Erro ao carregar dados financeiros. Vê a consola.</div>`;
      return;
    }

    /* Calcular métricas */
    const realizadas   = registos.filter(r => contaParaTotal(r.appt_status, r.financial_status));
    const dispensadas  = registos.filter(r => r.financial_status === "honorarios_dispensados");
    const faltas       = registos.filter(r => String(r.appt_status || "").toLowerCase() === "no_show");
    const totalEsperado = realizadas.reduce((s, r) => s + Number(r.valor || 0), 0);

    /* Avenças do mês */
    const periodo = `${ano}-${String(mes).padStart(2, "0")}`;
    const avencas = entidades.filter(e => e.tipo === "avenca");
    const totalAvencas = avencas.reduce((s, e) => s + Number(e.avenca_valor || 0), 0);

    /* Tabs de mês */
    const meses = [];
    for (let i = 4; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      meses.push({ ano: d.getFullYear(), mes: d.getMonth() + 1 });
    }

    /* ── Dados analíticos ── */
    const totalGeral = totalEsperado + totalAvencas;
    const mediaConsulta = realizadas.length > 0 ? Math.round(totalEsperado / realizadas.length) : 0;
    const valorPerdido  = [...faltas, ...dispensadas].reduce((s, r) => s + Number(r.valor || 0), 0);

    /* Rendimento por entidade */
    const porEntidade = {};
    registos.forEach(r => {
      const ent = r.entidades_financeiras || {};
      const key = ent.nome || "—";
      if (!porEntidade[key]) porEntidade[key] = { nome: key, tipo: ent.tipo, valor: 0, count: 0 };
      if (contaParaTotal(r.appt_status, r.financial_status)) {
        porEntidade[key].valor += Number(r.valor || 0);
        porEntidade[key].count++;
      }
    });
    /* Adicionar avenças */
    avencas.forEach(e => {
      const key = e.nome;
      if (!porEntidade[key]) porEntidade[key] = { nome: key, tipo: e.tipo, valor: 0, count: 0 };
      porEntidade[key].valor += Number(e.avenca_valor || 0);
      porEntidade[key].isAvenca = true;
    });
    const entOrdenadas = Object.values(porEntidade).sort((a, b) => b.valor - a.valor);
    const maxValEnt = entOrdenadas.length > 0 ? entOrdenadas[0].valor : 1;

    /* Tipos de acto */
    const porTipo = {};
    registos.filter(r => contaParaTotal(r.appt_status, r.financial_status)).forEach(r => {
      const t = r.tipo_acto || "Outro";
      porTipo[t] = (porTipo[t] || 0) + 1;
    });
    const tiposOrdenados = Object.entries(porTipo).sort((a, b) => b[1] - a[1]);
    const totalTipos = Object.values(porTipo).reduce((s, v) => s + v, 0) || 1;
    const tipoCores = ["#185FA5","#378ADD","#85B7EB","#B5D4F4","#E6F1FB","#0C447C"];

    /* Consultas por semana */
    const porSemana = [0, 0, 0, 0];
    registos.forEach(r => {
      if (!contaParaTotal(r.appt_status, r.financial_status)) return;
      if (!r.data) return;
      const dia = parseInt(r.data.slice(8, 10), 10);
      const idx = dia <= 7 ? 0 : dia <= 14 ? 1 : dia <= 21 ? 2 : 3;
      porSemana[idx]++;
    });

    content.innerHTML = `
      <style>
        .fin-metric { background:#f8fafc; border-radius:10px; padding:14px 16px; }
        .fin-metric-label { font-size:11px; color:#94a3b8; margin-bottom:5px; text-transform:uppercase; letter-spacing:.05em; }
        .fin-metric-value { font-size:22px; font-weight:800; color:#0f2d52; }
        .fin-metric-sub { font-size:11px; color:#94a3b8; margin-top:3px; }
        .fin-tab { padding:6px 14px; border-radius:8px; border:0.5px solid #e2e8f0; background:#fff; font-size:12px; font-weight:500; cursor:pointer; color:#64748b; font-family:inherit; }
        .fin-tab.active { background:#0f2d52; color:#fff; border-color:#0f2d52; }
        .fin-view-tab { padding:7px 16px; border-radius:8px; border:0.5px solid #e2e8f0; background:#fff; font-size:13px; font-weight:500; cursor:pointer; color:#64748b; font-family:inherit; }
        .fin-view-tab.active { background:#1a56db; color:#fff; border-color:#1a56db; }
        .fin-table { width:100%; border-collapse:collapse; font-size:13px; }
        .fin-table th { font-size:11px; font-weight:600; color:#94a3b8; text-transform:uppercase; letter-spacing:.05em; padding:8px 12px; background:#f8fafc; border-bottom:0.5px solid #e2e8f0; text-align:left; }
        .fin-table td { padding:10px 12px; border-bottom:0.5px solid #f1f5f9; vertical-align:middle; color:#0f172a; }
        .fin-table tr:last-child td { border-bottom:none; }
        .fin-table tr:hover td { background:#f8faff; }
        .fin-section { background:#fff; border:0.5px solid #e2e8f0; border-radius:12px; overflow:hidden; margin-top:16px; }
        .fin-section-header { padding:12px 16px; border-bottom:0.5px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; }
        .fin-section-title { font-size:13px; font-weight:700; color:#0f172a; }
        .fin-two-col { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-top:16px; }
        .fin-ent-row { display:flex; align-items:center; gap:10px; margin-bottom:10px; }
        .fin-ent-row:last-child { margin-bottom:0; }
        .fin-bar-wrap { flex:1; background:#f1f5f9; border-radius:4px; height:8px; overflow:hidden; }
        .fin-bar { height:8px; border-radius:4px; }
        .fin-status-row { display:flex; align-items:center; justify-content:space-between; padding:9px 0; border-bottom:0.5px solid #f1f5f9; }
        .fin-status-row:last-child { border-bottom:none; }
      </style>

      <!-- HEADER -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;flex-wrap:wrap;gap:10px;">
        <div>
          <div style="font-size:18px;font-weight:800;color:#0f2d52;">Rendimentos</div>
          <div style="font-size:13px;color:#94a3b8;margin-top:2px;">${mesLabel(ano, mes)}</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
          ${meses.map(m => `
            <button class="fin-tab${m.ano === ano && m.mes === mes ? " active" : ""}"
              data-ano="${m.ano}" data-mes="${m.mes}">
              ${new Date(m.ano, m.mes - 1, 1).toLocaleString("pt-PT", { month: "short" })} ${m.ano !== now.getFullYear() ? m.ano : ""}
            </button>
          `).join("")}
        </div>
      </div>

      <!-- MÉTRICAS -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:14px;">
        <div class="fin-metric">
          <div class="fin-metric-label">Total esperado</div>
          <div class="fin-metric-value">${totalGeral.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}</div>
          <div class="fin-metric-sub">Actos + avenças</div>
        </div>
        <div class="fin-metric">
          <div class="fin-metric-label">Consultas realizadas</div>
          <div class="fin-metric-value">${realizadas.length}</div>
          <div class="fin-metric-sub">média ${mediaConsulta.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}/cons.</div>
        </div>
        <div class="fin-metric">
          <div class="fin-metric-label">Faltas / dispensas</div>
          <div class="fin-metric-value" style="color:#e02424;">${faltas.length} / ${dispensadas.length}</div>
          <div class="fin-metric-sub">perdido: ${valorPerdido.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}</div>
        </div>
        <div class="fin-metric">
          <div class="fin-metric-label">Avenças</div>
          <div class="fin-metric-value">${totalAvencas.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}</div>
          <div class="fin-metric-sub">${avencas.length} entidade(s)</div>
        </div>
      </div>

      <!-- TABS DE VISTA -->
      <div style="display:flex;gap:8px;margin-bottom:16px;border-bottom:0.5px solid #e2e8f0;padding-bottom:12px;">
        <button class="fin-view-tab active" data-view="registos">Registos</button>
        <button class="fin-view-tab" data-view="analise">Análise</button>
      </div>

      <!-- VISTA: REGISTOS -->
      <div id="finVistaRegistos">
        <div class="fin-section" style="margin-top:0;">
          <div class="fin-section-header">
            <span class="fin-section-title">Registos — ${mesLabel(ano, mes)}</span>
            <div style="display:flex;gap:8px;">
              <button id="btnFinPdfAthletix" class="gc-btn" style="font-size:12px;">PDF Athletix</button>
              <button id="btnFinNovoRegisto" class="gc-btn-primary" style="font-size:12px;">+ Registo</button>
            </div>
          </div>
          ${registos.length === 0 ? `
            <div style="padding:32px;text-align:center;color:#94a3b8;font-size:13px;">
              Sem registos para ${mesLabel(ano, mes)}.
            </div>
          ` : `
            <table class="fin-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Entidade</th>
                  <th>Tipo</th>
                  <th>Acto</th>
                  <th>Doente</th>
                  <th>Estado</th>
                  <th style="text-align:right;">Valor</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${registos.map(r => {
                  const ent   = r.entidades_financeiras || {};
                  const pat   = r.patients || {};
                  const conta = contaParaTotal(r.appt_status, r.financial_status);
                  return `
                    <tr>
                      <td style="white-space:nowrap;color:#64748b;">${r.data ? new Date(r.data + "T00:00:00").toLocaleDateString("pt-PT") : "—"}</td>
                      <td style="font-weight:600;">${escapeHtml(ent.nome || "—")}</td>
                      <td>${badgeTipo(ent.tipo)}</td>
                      <td style="color:#64748b;">${escapeHtml(r.tipo_acto || r.periodo || "—")}</td>
                      <td style="color:#64748b;">${escapeHtml(pat.full_name || "—")}</td>
                      <td>${badgeStatus(r.appt_status, r.financial_status)}</td>
                      <td style="text-align:right;font-weight:700;color:${conta ? "#0f2d52" : "#94a3b8"};">
                        ${conta ? Number(r.valor || 0).toLocaleString("pt-PT", { style: "currency", currency: "EUR" }) : "—"}
                      </td>
                      <td style="text-align:right;">
                        <button class="gc-btn btnFinEditar" data-id="${r.id}" style="font-size:11px;padding:4px 10px;">Editar</button>
                      </td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          `}
        </div>

        <div class="fin-section">
          <div class="fin-section-header">
            <span class="fin-section-title">Avenças activas</span>
          </div>
          <table class="fin-table">
            <thead>
              <tr>
                <th>Entidade</th>
                <th>Tipo</th>
                <th style="text-align:right;">Valor/mês</th>
              </tr>
            </thead>
            <tbody>
              ${avencas.length === 0
                ? `<tr><td colspan="3" style="text-align:center;color:#94a3b8;padding:24px;">Sem avenças configuradas.</td></tr>`
                : avencas.map(e => `
                  <tr>
                    <td style="font-weight:600;">${escapeHtml(e.nome)}</td>
                    <td>${badgeTipo(e.tipo)}</td>
                    <td style="text-align:right;font-weight:700;color:#0f2d52;">
                      ${Number(e.avenca_valor || 0).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
                    </td>
                  </tr>
                `).join("")
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- VISTA: ANÁLISE -->
      <div id="finVistaAnalise" style="display:none;">

        <div class="fin-two-col">

          <!-- Rendimento por entidade -->
          <div class="fin-section" style="margin-top:0;">
            <div class="fin-section-header"><span class="fin-section-title">Rendimento por entidade</span></div>
            <div style="padding:16px;">
              ${entOrdenadas.length === 0
                ? `<div style="text-align:center;color:#94a3b8;font-size:13px;padding:16px 0;">Sem dados.</div>`
                : entOrdenadas.map(e => `
                  <div class="fin-ent-row">
                    <div style="font-size:12px;font-weight:600;color:#0f172a;min-width:110px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(e.nome)}</div>
                    <div class="fin-bar-wrap">
                      <div class="fin-bar" style="width:${Math.round((e.valor / Math.max(maxValEnt, 1)) * 100)}%;background:#185FA5;"></div>
                    </div>
                    <div style="font-size:12px;font-weight:600;color:#0f172a;min-width:64px;text-align:right;">${Number(e.valor).toLocaleString("pt-PT",{style:"currency",currency:"EUR"})}</div>
                    <div style="font-size:11px;color:#94a3b8;min-width:40px;text-align:right;">${e.isAvenca ? "avença" : e.count + " cons."}</div>
                  </div>
                `).join("")
              }
            </div>
          </div>

          <!-- Tipos de acto -->
          <div class="fin-section" style="margin-top:0;">
            <div class="fin-section-header"><span class="fin-section-title">Tipos de acto</span></div>
            <div style="padding:16px;">
              ${tiposOrdenados.length === 0
                ? `<div style="text-align:center;color:#94a3b8;font-size:13px;padding:16px 0;">Sem actos registados.</div>`
                : `
                  <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
                    ${tiposOrdenados.map(([t, n], i) => `
                      <span style="display:flex;align-items:center;gap:4px;font-size:11px;color:#64748b;">
                        <span style="width:9px;height:9px;border-radius:2px;background:${tipoCores[i] || "#94a3b8"};display:inline-block;flex-shrink:0;"></span>
                        ${escapeHtml(t)} ${Math.round((n/totalTipos)*100)}%
                      </span>
                    `).join("")}
                  </div>
                  <div style="position:relative;width:100%;height:160px;">
                    <canvas id="finChartTipos"></canvas>
                  </div>
                `
              }
            </div>
          </div>
        </div>

        <div class="fin-two-col">

          <!-- Consultas por semana -->
          <div class="fin-section" style="margin-top:0;">
            <div class="fin-section-header"><span class="fin-section-title">Consultas por semana</span></div>
            <div style="padding:16px;">
              <div style="position:relative;width:100%;height:160px;">
                <canvas id="finChartSemanas"></canvas>
              </div>
            </div>
          </div>

          <!-- Estado das consultas -->
          <div class="fin-section" style="margin-top:0;">
            <div class="fin-section-header"><span class="fin-section-title">Estado das consultas</span></div>
            <div style="padding:14px 16px;">
              <div class="fin-status-row">
                <div style="display:flex;align-items:center;gap:8px;">
                  <div style="width:8px;height:8px;border-radius:50%;background:#059669;flex-shrink:0;"></div>
                  <span style="font-size:13px;color:#0f172a;">Realizadas</span>
                </div>
                <div style="display:flex;align-items:center;gap:8px;">
                  <span style="font-size:13px;font-weight:700;color:#0f172a;">${realizadas.length}</span>
                  <span style="font-size:11px;background:#d1fae5;color:#065f46;padding:2px 7px;border-radius:4px;">${realizadas.length + faltas.length + dispensadas.length > 0 ? Math.round((realizadas.length / (realizadas.length + faltas.length + dispensadas.length)) * 100) : 0}%</span>
                </div>
              </div>
              <div class="fin-status-row">
                <div style="display:flex;align-items:center;gap:8px;">
                  <div style="width:8px;height:8px;border-radius:50%;background:#DC2626;flex-shrink:0;"></div>
                  <span style="font-size:13px;color:#0f172a;">Faltou</span>
                </div>
                <div style="display:flex;align-items:center;gap:8px;">
                  <span style="font-size:13px;font-weight:700;color:#0f172a;">${faltas.length}</span>
                  <span style="font-size:11px;background:#fee2e2;color:#991b1b;padding:2px 7px;border-radius:4px;">${realizadas.length + faltas.length + dispensadas.length > 0 ? Math.round((faltas.length / (realizadas.length + faltas.length + dispensadas.length)) * 100) : 0}%</span>
                </div>
              </div>
              <div class="fin-status-row">
                <div style="display:flex;align-items:center;gap:8px;">
                  <div style="width:8px;height:8px;border-radius:50%;background:#D97706;flex-shrink:0;"></div>
                  <span style="font-size:13px;color:#0f172a;">Dispensado</span>
                </div>
                <div style="display:flex;align-items:center;gap:8px;">
                  <span style="font-size:13px;font-weight:700;color:#0f172a;">${dispensadas.length}</span>
                  <span style="font-size:11px;background:#fef3c7;color:#92400e;padding:2px 7px;border-radius:4px;">${realizadas.length + faltas.length + dispensadas.length > 0 ? Math.round((dispensadas.length / (realizadas.length + faltas.length + dispensadas.length)) * 100) : 0}%</span>
                </div>
              </div>
              <div style="margin-top:14px;padding-top:12px;border-top:0.5px solid #f1f5f9;">
                <div style="font-size:11px;color:#94a3b8;margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em;">Valor perdido</div>
                <div style="font-size:20px;font-weight:800;color:#A32D2D;">${valorPerdido > 0 ? "−" : ""}${valorPerdido.toLocaleString("pt-PT",{style:"currency",currency:"EUR"})}</div>
              </div>
            </div>
          </div>

        </div>
      </div>
    `;

    /* ── Wiring ── */

    /* Tabs de mês */
    content.querySelectorAll(".fin-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        ano = parseInt(btn.dataset.ano, 10);
        mes = parseInt(btn.dataset.mes, 10);
        render();
      });
    });

    /* Tabs de vista (Registos / Análise) */
    content.querySelectorAll(".fin-view-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        content.querySelectorAll(".fin-view-tab").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const v = btn.dataset.view;
        const elReg = document.getElementById("finVistaRegistos");
        const elAna = document.getElementById("finVistaAnalise");
        if (elReg) elReg.style.display = v === "registos" ? "block" : "none";
        if (elAna) elAna.style.display = v === "analise"  ? "block" : "none";
        if (v === "analise") renderCharts();
      });
    });

    /* Gráficos Chart.js — só renderiza quando a tab Análise está activa */
    function renderCharts() {
      /* Destruir instâncias anteriores se existirem */
      ["finChartTipos","finChartSemanas"].forEach(id => {
        const el = document.getElementById(id);
        if (el && el._chartInstance) { el._chartInstance.destroy(); el._chartInstance = null; }
      });

      /* Donut — tipos de acto */
      const cTipos = document.getElementById("finChartTipos");
      if (cTipos && tiposOrdenados.length > 0) {
        cTipos._chartInstance = new Chart(cTipos, {
          type: "doughnut",
          data: {
            labels: tiposOrdenados.map(([t]) => t),
            datasets: [{
              data: tiposOrdenados.map(([, n]) => n),
              backgroundColor: tipoCores.slice(0, tiposOrdenados.length),
              borderWidth: 2,
              borderColor: "#ffffff"
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            cutout: "62%"
          }
        });
      }

      /* Barras — consultas por semana */
      const cSemanas = document.getElementById("finChartSemanas");
      if (cSemanas) {
        cSemanas._chartInstance = new Chart(cSemanas, {
          type: "bar",
          data: {
            labels: ["S1 (1–7)", "S2 (8–14)", "S3 (15–21)", "S4 (22–31)"],
            datasets: [{
              data: porSemana,
              backgroundColor: "#185FA5",
              borderRadius: 5,
              borderSkipped: false
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: {
                grid: { display: false },
                ticks: { font: { size: 11 }, color: "#94a3b8", autoSkip: false }
              },
              y: {
                beginAtZero: true,
                grid: { color: "#f1f5f9" },
                ticks: { font: { size: 11 }, color: "#94a3b8", stepSize: 1, precision: 0 }
              }
            }
          }
        });
      }
    }

    /* Carregar Chart.js se ainda não estiver disponível */
    if (!window.Chart) {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js";
      s.onload = () => {
        if (document.getElementById("finVistaAnalise")?.style.display !== "none") renderCharts();
      };
      document.head.appendChild(s);
    }

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
      } catch (err) {
        console.error("Erro ao abrir modal:", err);
      }
    });

    /* Editar registo */
    content.querySelectorAll(".btnFinEditar").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const r  = registos.find(x => x.id === id);
        if (r) openModalEditarRegisto(r, entidades, render);
      });
    });

    /* PDF Athletix */
    document.getElementById("btnFinPdfAthletix")?.addEventListener("click", () => {
      openModalPdfAthletix(registos, mes, ano);
    });
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

/* ==== FE — Boot ==== */

/* ---- FE.1 — initFinancas ---- */
export function initFinancas() {
  window.__gc_renderFinancas = renderFinancas;
}

initFinancas();
