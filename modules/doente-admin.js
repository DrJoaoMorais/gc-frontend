/* ========================================================
   DOENTE-ADMIN.JS — Panorama clínico do doente
   ======================================================== */

import { G } from "./state.js";
export async function renderDoentePanorama(patientId) {
  const supabase = window.sb;
  const root = document.getElementById("gcDoentePanoramaRoot");
  if (!root) return;

  root.innerHTML = `<div style="padding:24px;color:#94a3b8;font-size:13px;">A carregar...</div>`;

  /* ── 1. Carregar dados do doente ── */
  const { data: pt, error } = await supabase
    .from("patients")
    .select("*")
    .eq("id", patientId)
    .single();

  if (error || !pt) {
    root.innerHTML = `<div style="padding:24px;color:#ef4444;">Erro ao carregar doente.</div>`;
    return;
  }

  /* ── 2. Carregar consultas (últimas 20) ── */
  const { data: appts } = await supabase
    .from("appointments")
    .select("id, start_at, status, procedure_type, title, clinic_id")
    .eq("patient_id", patientId)
    .order("start_at", { ascending: false })
    .limit(20);

  /* ── 3. Carregar consentimentos ── */
  const { data: tokens } = await supabase
    .from("consent_tokens")
    .select("id, type, created_at, expires_at, clinic_id")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(10);

  /* ── 4. Carregar documentos/relatórios ── */
  const { data: docs } = await supabase
    .from("documents")
    .select("id, title, created_at, clinic_id")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(10);

  /* ── 5. Calcular métricas ── */
  const hoje = new Date();
  const dob = pt.dob ? new Date(pt.dob) : null;
  const idade = dob ? Math.floor((hoje - dob) / (365.25 * 24 * 3600 * 1000)) : null;
  const sexo = pt.sex === "F" ? "F" : pt.sex === "M" ? "M" : "";
  const dobStr = dob ? dob.toLocaleDateString("pt-PT", { day:"2-digit", month:"short", year:"numeric" }) : "";

  const iniciais = (pt.full_name || "?").split(" ").filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join("");

  const totalConsultas = (appts || []).length;
  const ultima = (appts || []).find(a => new Date(a.start_at) <= hoje);
  const proxima = (appts || []).slice().reverse().find(a => new Date(a.start_at) > hoje);

  const ultimaStr = ultima
    ? new Date(ultima.start_at).toLocaleDateString("pt-PT", { day:"numeric", month:"short", year:"numeric" })
    : "—";

  const proximaStr = proxima
    ? new Date(proxima.start_at).toLocaleDateString("pt-PT", { day:"numeric", month:"short", year:"numeric" }) +
      " · " + new Date(proxima.start_at).toLocaleTimeString("pt-PT", { hour:"2-digit", minute:"2-digit" })
    : "—";

  /* ── 6. Calendário ── */
  let calMes = hoje.getMonth();
  let calAno = hoje.getFullYear();

  /* ── 7. Clínica principal ── */
  const clinicaId = pt.clinic_id || (appts && appts[0]?.clinic_id) || null;
  const clinica = clinicaId && G.clinics ? G.clinics.find(c => c.id === clinicaId) : null;
  const clinicaNome = clinica?.display_name || clinica?.name || "—";

  /* ── 8. Render ── */
  root.innerHTML = `
<style>
.dpa-wrap{max-width:1100px;margin:0 auto;padding:0 0 40px;}
.dpa-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:24px;flex-wrap:wrap;}
.dpa-identity{display:flex;align-items:center;gap:14px;}
.dpa-avatar{width:52px;height:52px;border-radius:50%;background:#1a56db;color:#fff;font-size:18px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.dpa-name{font-size:22px;font-weight:700;color:#0f2d52;line-height:1.2;}
.dpa-sub{font-size:13px;color:#64748b;margin-top:2px;}
.dpa-actions{display:flex;gap:8px;flex-shrink:0;}
.dpa-btn{padding:8px 16px;border-radius:8px;border:1px solid #e2e8f0;background:#fff;color:#0f172a;font-size:13px;font-weight:500;cursor:pointer;font-family:inherit;transition:background .12s;}
.dpa-btn:hover{background:#f1f5f9;}
.dpa-btn-primary{background:#1a56db;color:#fff;border-color:#1a56db;}
.dpa-btn-primary:hover{background:#1648c0;}
.dpa-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
@media(max-width:800px){.dpa-grid{grid-template-columns:1fr;}}
.dpa-card{background:#fff;border:0.5px solid #e2e8f0;border-radius:12px;padding:20px;}
.dpa-card-title{font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:14px;}
.dpa-id-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 20px;}
.dpa-id-label{font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px;}
.dpa-id-value{font-size:14px;font-weight:600;color:#0f172a;}
.dpa-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px;}
.dpa-metric{background:#f8fafc;border-radius:8px;padding:12px;text-align:center;}
.dpa-metric-val{font-size:22px;font-weight:800;color:#0f2d52;}
.dpa-metric-lbl{font-size:11px;color:#94a3b8;margin-top:2px;}
.dpa-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:.5px solid #f1f5f9;font-size:13px;}
.dpa-row:last-child{border-bottom:none;}
.dpa-row-label{color:#64748b;}
.dpa-row-value{font-weight:600;color:#0f172a;}
.dpa-row-link{font-weight:600;color:#1a56db;cursor:pointer;}
.dpa-cal-nav{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}
.dpa-cal-title{font-size:14px;font-weight:600;color:#0f2d52;}
.dpa-cal-nbtn{background:none;border:.5px solid #e2e8f0;border-radius:6px;padding:3px 8px;cursor:pointer;font-size:13px;color:#475569;}
.dpa-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center;}
.dpa-cal-dow{font-size:10px;font-weight:600;color:#94a3b8;padding:4px 0;}
.dpa-cal-day{padding:5px 2px;border-radius:6px;cursor:default;position:relative;}
.dpa-cal-day.today{background:#eff6ff;font-weight:700;color:#1a56db;}
.dpa-cal-day.other-month{color:#cbd5e1;}
.dpa-cal-dots{display:flex;justify-content:center;gap:2px;margin-top:2px;min-height:6px;}
.dpa-dot{width:5px;height:5px;border-radius:50%;}
.dpa-legend{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px;}
.dpa-leg-item{display:flex;align-items:center;gap:4px;font-size:11px;color:#64748b;}
.dpa-consent-item{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:.5px solid #f1f5f9;font-size:13px;}
.dpa-consent-item:last-child{border-bottom:none;}
.dpa-badge{padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;}
.dpa-badge-green{background:#dcfce7;color:#15803d;}
.dpa-badge-amber{background:#fef3c7;color:#d97706;}
.dpa-badge-gray{background:#f1f5f9;color:#64748b;}
.dpa-hist-item{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:.5px solid #f1f5f9;font-size:13px;}
.dpa-hist-item:last-child{border-bottom:none;}
.dpa-hist-tag{padding:2px 8px;border-radius:999px;font-size:11px;font-weight:500;background:#eff6ff;color:#1a56db;}
.dpa-doc-ver{padding:4px 10px;border-radius:6px;border:.5px solid #e2e8f0;background:#fff;font-size:12px;cursor:pointer;font-family:inherit;}
.dpa-doc-ver:hover{background:#f1f5f9;}
.dpa-back{display:flex;align-items:center;gap:6px;color:#64748b;font-size:13px;cursor:pointer;margin-bottom:16px;width:fit-content;}
.dpa-back:hover{color:#0f2d52;}
</style>

<div class="dpa-wrap">

  <!-- Voltar -->
  <div class="dpa-back" id="dpaBack">
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
    Voltar aos doentes
  </div>

  <!-- Cabeçalho -->
  <div class="dpa-header">
    <div class="dpa-identity">
      <div class="dpa-avatar">${iniciais}</div>
      <div>
        <div class="dpa-name">${pt.full_name || "—"}</div>
        <div class="dpa-sub">${[sexo, dobStr, idade ? idade + " anos" : "", clinicaNome].filter(Boolean).join(" · ")}</div>
      </div>
    </div>
    <div class="dpa-actions">
      <button class="dpa-btn" id="dpaEditBtn">editar dados</button>
      <button class="dpa-btn dpa-btn-primary" id="dpaOpenProcessoBtn">abrir processo clínico</button>
    </div>
  </div>

  <!-- Grelha principal -->
  <div class="dpa-grid">

    <!-- Identificação -->
    <div class="dpa-card">
      <div class="dpa-card-title">Identificação</div>
      <div class="dpa-id-grid">
        <div><div class="dpa-id-label">SNS</div><div class="dpa-id-value">${pt.sns || "—"}</div></div>
        <div><div class="dpa-id-label">NIF</div><div class="dpa-id-value">${pt.nif || "—"}</div></div>
        <div><div class="dpa-id-label">Telemóvel</div><div class="dpa-id-value">${pt.phone || "—"}</div></div>
        <div><div class="dpa-id-label">Email</div><div class="dpa-id-value" style="font-size:12px;word-break:break-all;">${pt.email || "—"}</div></div>
        <div><div class="dpa-id-label">Seguro</div><div class="dpa-id-value">${pt.insurance_provider || "—"}</div></div>
        <div><div class="dpa-id-label">Apólice</div><div class="dpa-id-value">${pt.insurance_policy_number || "—"}</div></div>
      </div>
    </div>

    <!-- Calendário -->
    <div class="dpa-card" id="dpaCalCard">
      <div class="dpa-cal-nav">
        <button class="dpa-cal-nbtn" id="dpaCalPrev">‹</button>
        <div class="dpa-cal-title" id="dpaCalTitle"></div>
        <button class="dpa-cal-nbtn" id="dpaCalNext">›</button>
      </div>
      <div id="dpaCalBody"></div>
      <div class="dpa-legend">
        <div class="dpa-leg-item"><div class="dpa-dot" style="background:#1a56db"></div> consulta</div>
        <div class="dpa-leg-item"><div class="dpa-dot" style="background:#0891b2"></div> fisioterapia</div>
        <div class="dpa-leg-item"><div class="dpa-dot" style="background:#d97706"></div> procedimento</div>
      </div>
    </div>

    <!-- Impacto financeiro -->
    <div class="dpa-card">
      <div class="dpa-card-title">Impacto Financeiro</div>
      <div class="dpa-metrics">
        <div class="dpa-metric"><div class="dpa-metric-val">${totalConsultas}</div><div class="dpa-metric-lbl">consultas</div></div>
        <div class="dpa-metric"><div class="dpa-metric-val">—</div><div class="dpa-metric-lbl">procedimentos</div></div>
        <div class="dpa-metric"><div class="dpa-metric-val">—€</div><div class="dpa-metric-lbl">valor total</div></div>
      </div>
      <div class="dpa-row"><span class="dpa-row-label">última consulta</span><span class="dpa-row-value">${ultimaStr}</span></div>
      <div class="dpa-row"><span class="dpa-row-label">próxima consulta</span><span class="dpa-row-link" id="dpaProximaLink">${proximaStr}</span></div>
    </div>

    <!-- Consentimentos -->
    <div class="dpa-card">
      <div class="dpa-card-title">Consentimentos</div>
      <div id="dpaConsentimentos">
        ${(tokens && tokens.length > 0) ? tokens.map(t => {
          const exp = new Date(t.expires_at);
          const assinado = exp < hoje;
          const badge = assinado
            ? `<span class="dpa-badge dpa-badge-green">assinado</span>`
            : `<span class="dpa-badge dpa-badge-amber">pendente</span>`;
          const dataStr = new Date(t.created_at).toLocaleDateString("pt-PT", { day:"numeric", month:"short", year:"numeric" });
          return `<div class="dpa-consent-item"><div><div style="font-weight:600">${t.type || "RGPD"}</div><div style="font-size:11px;color:#94a3b8;">${dataStr}</div></div>${badge}</div>`;
        }).join("") : `<div style="color:#94a3b8;font-size:13px;padding:8px 0;">Sem consentimentos registados.</div>`}
      </div>
      <button class="dpa-btn" style="width:100%;margin-top:12px;text-align:center;" id="dpaNovoConsentBtn">+ novo consentimento</button>
    </div>

    <!-- Histórico de consultas -->
    <div class="dpa-card">
      <div class="dpa-card-title">Histórico de Consultas</div>
      <div>
        ${(appts && appts.length > 0) ? appts.slice(0,6).map(a => {
          const dataStr = new Date(a.start_at).toLocaleDateString("pt-PT", { day:"numeric", month:"short" });
          const tag = a.procedure_type || "consulta";
          const tagColor = tag.includes("fisio") ? "#0891b2" : tag.includes("prp") || tag.includes("proced") ? "#d97706" : "#1a56db";
          return `<div class="dpa-hist-item">
            <div>
              <div style="font-weight:600">${a.title || tag}</div>
              <div style="font-size:11px;color:#94a3b8;">${dataStr}</div>
            </div>
            <span class="dpa-hist-tag" style="background:${tagColor}18;color:${tagColor}">${tag}</span>
          </div>`;
        }).join("") : `<div style="color:#94a3b8;font-size:13px;padding:8px 0;">Sem consultas registadas.</div>`}
      </div>
    </div>

    <!-- Relatórios -->
    <div class="dpa-card">
      <div class="dpa-card-title">Relatórios Realizados</div>
      <div>
        ${(docs && docs.length > 0) ? docs.slice(0,5).map(d => {
          const dataStr = new Date(d.created_at).toLocaleDateString("pt-PT", { day:"numeric", month:"short", year:"numeric" });
          return `<div class="dpa-hist-item">
            <div>
              <div style="font-weight:600">${d.title || "Relatório"}</div>
              <div style="font-size:11px;color:#94a3b8;">${dataStr}</div>
            </div>
            <button class="dpa-doc-ver" data-doc-id="${d.id}">ver</button>
          </div>`;
        }).join("") : `<div style="color:#94a3b8;font-size:13px;padding:8px 0;">Sem relatórios gerados.</div>`}
      </div>
    </div>

  </div>
</div>
  `;

  /* ── Calendário ── */
  function renderCal(mes, ano) {
    const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
    document.getElementById("dpaCalTitle").textContent = `${meses[mes]} ${ano}`;

    const daysInMonth = new Date(ano, mes + 1, 0).getDate();
    const firstDay = (new Date(ano, mes, 1).getDay() + 6) % 7; // seg=0

    const apptsByDay = {};
    (appts || []).forEach(a => {
      const d = new Date(a.start_at);
      if (d.getMonth() === mes && d.getFullYear() === ano) {
        const day = d.getDate();
        if (!apptsByDay[day]) apptsByDay[day] = [];
        apptsByDay[day].push(a);
      }
    });

    const dows = ["seg","ter","qua","qui","sex","sáb","dom"];
    let html = `<div class="dpa-cal-grid">`;
    dows.forEach(d => { html += `<div class="dpa-cal-dow">${d}</div>`; });

    for (let i = 0; i < firstDay; i++) html += `<div></div>`;

    for (let d = 1; d <= daysInMonth; d++) {
      const isToday = d === hoje.getDate() && mes === hoje.getMonth() && ano === hoje.getFullYear();
      const dayAppts = apptsByDay[d] || [];
      const dots = dayAppts.slice(0,3).map(a => {
        const tag = (a.procedure_type || "").toLowerCase();
        const col = tag.includes("fisio") ? "#0891b2" : tag.includes("prp") || tag.includes("proced") ? "#d97706" : "#1a56db";
        return `<div class="dpa-dot" style="background:${col}"></div>`;
      }).join("");
      html += `<div class="dpa-cal-day${isToday ? " today" : ""}">
        <div style="font-size:12px;">${d}</div>
        <div class="dpa-cal-dots">${dots}</div>
      </div>`;
    }
    html += `</div>`;
    document.getElementById("dpaCalBody").innerHTML = html;
  }

  renderCal(calMes, calAno);

  document.getElementById("dpaCalPrev").addEventListener("click", () => {
    calMes--; if (calMes < 0) { calMes = 11; calAno--; }
    renderCal(calMes, calAno);
  });
  document.getElementById("dpaCalNext").addEventListener("click", () => {
    calMes++; if (calMes > 11) { calMes = 0; calAno++; }
    renderCal(calMes, calAno);
  });

  /* ── Botões ── */
  document.getElementById("dpaBack").addEventListener("click", () => {
    G.currentView = "doentes";
    if (typeof window.__gc_renderCurrentView === "function") window.__gc_renderCurrentView();
  });

  document.getElementById("dpaOpenProcessoBtn").addEventListener("click", () => {
    if (typeof window.__gc_openPatientView === "function") window.__gc_openPatientView(patientId);
  });

  document.getElementById("dpaEditBtn").addEventListener("click", () => {
    if (typeof window.__gc_openEditPatient === "function") window.__gc_openEditPatient(patientId);
  });
}

window.__gc_renderDoentePanorama = renderDoentePanorama;
