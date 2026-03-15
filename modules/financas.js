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
  const fim    = new Date(ano, mes, 1).toISOString().slice(0, 10); // primeiro dia do mês seguinte

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

    content.innerHTML = `
      <style>
        .fin-metric { background:#f8fafc; border-radius:10px; padding:14px 16px; }
        .fin-metric-label { font-size:11px; color:#94a3b8; margin-bottom:5px; text-transform:uppercase; letter-spacing:.05em; }
        .fin-metric-value { font-size:22px; font-weight:800; color:#0f2d52; }
        .fin-metric-sub { font-size:11px; color:#94a3b8; margin-top:3px; }
        .fin-tab { padding:6px 14px; border-radius:8px; border:0.5px solid #e2e8f0; background:#fff; font-size:12px; font-weight:500; cursor:pointer; color:#64748b; font-family:inherit; }
        .fin-tab.active { background:#0f2d52; color:#fff; border-color:#0f2d52; }
        .fin-table { width:100%; border-collapse:collapse; font-size:13px; }
        .fin-table th { font-size:11px; font-weight:600; color:#94a3b8; text-transform:uppercase; letter-spacing:.05em; padding:8px 12px; background:#f8fafc; border-bottom:0.5px solid #e2e8f0; text-align:left; }
        .fin-table td { padding:10px 12px; border-bottom:0.5px solid #f1f5f9; vertical-align:middle; color:#0f172a; }
        .fin-table tr:last-child td { border-bottom:none; }
        .fin-table tr:hover td { background:#f8faff; }
        .fin-section { background:#fff; border:0.5px solid #e2e8f0; border-radius:12px; overflow:hidden; margin-top:16px; }
        .fin-section-header { padding:12px 16px; border-bottom:0.5px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; }
        .fin-section-title { font-size:13px; font-weight:700; color:#0f172a; }
      </style>

      <!-- HEADER -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
        <div>
          <div style="font-size:18px;font-weight:800;color:#0f2d52;">Rendimentos</div>
          <div style="font-size:13px;color:#94a3b8;margin-top:2px;">${mesLabel(ano, mes)} — valor esperado</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          ${meses.map(m => `
            <button class="fin-tab${m.ano === ano && m.mes === mes ? " active" : ""}"
              data-ano="${m.ano}" data-mes="${m.mes}">
              ${new Date(m.ano, m.mes - 1, 1).toLocaleString("pt-PT", { month: "short" })} ${m.ano !== now.getFullYear() ? m.ano : ""}
            </button>
          `).join("")}
        </div>
      </div>

      <!-- MÉTRICAS -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;">
        <div class="fin-metric">
          <div class="fin-metric-label">Total esperado</div>
          <div class="fin-metric-value">${(totalEsperado + totalAvencas).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}</div>
          <div class="fin-metric-sub">Actos realizados + avenças</div>
        </div>
        <div class="fin-metric">
          <div class="fin-metric-label">Avenças</div>
          <div class="fin-metric-value">${totalAvencas.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}</div>
          <div class="fin-metric-sub">${avencas.length} entidade(s)</div>
        </div>
        <div class="fin-metric">
          <div class="fin-metric-label">Actos realizados</div>
          <div class="fin-metric-value">${totalEsperado.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}</div>
          <div class="fin-metric-sub">${realizadas.length} consulta(s)</div>
        </div>
        <div class="fin-metric">
          <div class="fin-metric-label">Faltas</div>
          <div class="fin-metric-value" style="color:#e02424;">${faltas.length}</div>
          <div class="fin-metric-sub">${dispensadas.length} dispensa(s)</div>
        </div>
      </div>

      <!-- REGISTOS DO MÊS -->
      <div class="fin-section">
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

      <!-- AVENÇAS ACTIVAS -->
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
