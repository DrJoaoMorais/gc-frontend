/* Home Dashboard — esqueleto visual validado; sem dados reais nesta fase. */

const ICON = {
  alert: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`,
  clock: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  inbox: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4h16v16H4z"/><path d="M4 14h4l2 3h4l2-3h4" stroke-linejoin="round"/></svg>`,
  check: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  calendar: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18" stroke-linecap="round"/></svg>`
};

export function homeDashboardHtml() {
  return `
    <section class="gc-home">
      <div class="gc-home-head">
        <div><div class="gc-home-title">Bom dia, Dr. João</div><div class="gc-home-sub">Aqui está o que precisa da sua atenção hoje.</div></div>
        <button class="gc-home-agenda-btn" data-home-action="agenda">${ICON.calendar}<span>Agenda de hoje</span></button>
      </div>

      <div class="gc-home-kpis">
        <div class="gc-home-kpi gc-home-kpi-red"><div class="gc-home-kpi-icon">${ICON.alert}</div><div><b>Urgentes</b><strong id="gcHomeStatUrgentes">—</strong><span>A ligar aos alertas</span></div></div>
        <div class="gc-home-kpi gc-home-kpi-orange"><div class="gc-home-kpi-icon">${ICON.clock}</div><div><b>Atenção</b><strong id="gcHomeStatAtencao">—</strong><span>A ligar aos alertas</span></div></div>
        <div class="gc-home-kpi gc-home-kpi-blue"><div class="gc-home-kpi-icon">${ICON.inbox}</div><div><b>Novos</b><strong id="gcHomeStatNovos">—</strong><span>A ligar aos alertas</span></div></div>
        <div class="gc-home-kpi gc-home-kpi-green"><div class="gc-home-kpi-icon">${ICON.check}</div><div><b>Resolvidos</b><strong id="gcHomeStatResolvidos">—</strong><span>Hoje</span></div></div>
      </div>

      <div class="gc-home-section-head"><div><h2>Precisa da sua atenção</h2><p>Alertas clínicos e operacionais pendentes</p></div><button type="button" id="gcHomeAlertsToggle" style="display:none;">Ver todos</button></div>
      <div id="gcHomeAlertsList">
        <div class="gc-home-empty">
          <div class="gc-home-empty-icon">${ICON.inbox}</div>
          <div><b>A carregar alertas…</b><p>Área preparada para os alertas reais.</p></div>
        </div>
      </div>

      <div class="gc-home-section-head gc-home-today-head"><div><h2>Hoje</h2><p>Resumo rápido da atividade</p></div></div>
      <div class="gc-home-today">
        <div><b>Consultas</b><strong id="gcHomeStatConsultas">—</strong><small>A ligar à agenda</small></div>
        <div><b>Pedidos online</b><strong id="gcHomeStatPedidosOnline">—</strong><small>A ligar aos pedidos</small></div>
        <div><b>Consentimentos</b><strong id="gcHomeStatConsentimentos">—</strong><small>A ligar aos pendentes</small></div>
      </div>
    </section>`;
}

export function homeDashboardStyles() {
  return `
.gc-home{max-width:1180px;margin:0 auto;padding:4px 2px 36px}.gc-home-head{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:24px}.gc-home-title{font-size:27px;font-weight:780;letter-spacing:-.6px;color:#0f2d52}.gc-home-sub{margin-top:4px;color:#64748b;font-size:13px}.gc-home-agenda-btn{display:flex;align-items:center;gap:8px;border:1px solid #cbd5e1;background:#fff;color:#0f2d52;border-radius:10px;padding:9px 13px;font:650 13px/1.2 inherit;cursor:pointer}.gc-home-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.gc-home-kpi{background:#fff;border:1px solid #e2e8f0;border-radius:13px;padding:16px;display:flex;gap:13px;min-height:112px;box-shadow:0 1px 3px rgba(15,45,82,.04)}.gc-home-kpi-icon{width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex:0 0 auto}.gc-home-kpi b{display:block;font-size:12px;color:#475569;margin-bottom:3px}.gc-home-kpi strong{display:block;font-size:27px;line-height:1.05;color:#0f172a}.gc-home-kpi span{display:block;font-size:11px;color:#94a3b8;margin-top:7px}.gc-home-kpi-red{border-left:3px solid #dc2626}.gc-home-kpi-red .gc-home-kpi-icon{background:#fef2f2;color:#dc2626}.gc-home-kpi-orange{border-left:3px solid #ea580c}.gc-home-kpi-orange .gc-home-kpi-icon{background:#fff7ed;color:#ea580c}.gc-home-kpi-blue{border-left:3px solid #2563eb}.gc-home-kpi-blue .gc-home-kpi-icon{background:#eff6ff;color:#2563eb}.gc-home-kpi-green{border-left:3px solid #16a34a}.gc-home-kpi-green .gc-home-kpi-icon{background:#f0fdf4;color:#16a34a}.gc-home-section-head{display:flex;align-items:end;justify-content:space-between;margin-top:28px;margin-bottom:10px}.gc-home-section-head h2{font-size:16px;color:#0f2d52;margin:0}.gc-home-section-head p{font-size:11px;color:#94a3b8;margin:3px 0 0}.gc-home-section-head button{border:0;background:transparent;color:#2563eb;font:650 12px inherit;cursor:pointer}.gc-home-empty{background:#fff;border:1px solid #e2e8f0;border-radius:13px;min-height:138px;display:flex;align-items:center;justify-content:center;gap:13px;color:#475569}.gc-home-empty-icon{width:42px;height:42px;border-radius:50%;background:#f1f5f9;color:#64748b;display:flex;align-items:center;justify-content:center}.gc-home-empty b{font-size:13px}.gc-home-empty p{font-size:11px;color:#94a3b8;margin:4px 0 0}.gc-home-alerts{display:flex;flex-direction:column;gap:8px}.gc-home-alerts-extra{flex-direction:column;gap:8px;margin-top:8px}.gc-home-alert-row{display:flex;align-items:flex-start;gap:12px;background:#fff;border:1px solid #e2e8f0;border-left:3px solid #cbd5e1;border-radius:12px;padding:12px 14px}.gc-home-alert-icon{width:32px;height:32px;border-radius:9px;display:flex;align-items:center;justify-content:center;flex:0 0 auto;background:#f1f5f9;color:#64748b}.gc-home-alert-urgent{border-left-color:#dc2626}.gc-home-alert-urgent .gc-home-alert-icon{background:#fef2f2;color:#dc2626}.gc-home-alert-attention{border-left-color:#ea580c}.gc-home-alert-attention .gc-home-alert-icon{background:#fff7ed;color:#ea580c}.gc-home-alert-info{border-left-color:#2563eb}.gc-home-alert-info .gc-home-alert-icon{background:#eff6ff;color:#2563eb}.gc-home-alert-body{flex:1;min-width:0}.gc-home-alert-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.gc-home-alert-badge{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:#475569}.gc-home-alert-source{font-size:11px;color:#94a3b8}.gc-home-alert-time{font-size:11px;color:#94a3b8;margin-left:auto}.gc-home-alert-title{font-size:13px;font-weight:700;color:#0f172a;margin-top:2px}.gc-home-alert-msg{font-size:12px;color:#64748b;margin-top:2px}.gc-home-alert-actions{display:flex;gap:6px;flex:0 0 auto;align-items:flex-start}.gc-home-alert-open,.gc-home-alert-resolve{font-size:11.5px;font-weight:650;border-radius:8px;padding:6px 10px;cursor:pointer;white-space:nowrap;font-family:inherit}.gc-home-alert-open{border:1px solid #cbd5e1;background:#fff;color:#0f2d52}.gc-home-alert-resolve{border:1px solid #a7f3d0;background:#ecfdf5;color:#065f46}.gc-home-today-head{margin-top:24px}.gc-home-today{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.gc-home-today>div{border:1px solid #e2e8f0;background:#fff;border-radius:12px;padding:14px 16px;text-align:left;min-height:91px;font-family:inherit;color:#0f172a}.gc-home-today>div b{display:block;font-size:12px;color:#475569}.gc-home-today>div strong{display:block;font-size:22px;margin-top:4px}.gc-home-today>div small{font-size:11px;color:#94a3b8}.gc-home [data-home-action="agenda"]:hover{border-color:#93c5fd;background:#f8fbff}@media(max-width:900px){.gc-home-kpis{grid-template-columns:repeat(2,1fr)}.gc-home-today{grid-template-columns:repeat(2,1fr)}}@media(max-width:600px){.gc-home{padding:2px 0 24px}.gc-home-head{align-items:flex-start}.gc-home-title{font-size:22px}.gc-home-agenda-btn span{display:none}.gc-home-kpis{grid-template-columns:1fr 1fr;gap:9px}.gc-home-kpi{padding:12px;min-height:98px}.gc-home-kpi-icon{display:none}.gc-home-today{grid-template-columns:1fr}.gc-home-empty{padding:22px 16px;justify-content:flex-start}}
  `;
}

export function wireHomeDashboard(onAgenda) {
  document.querySelectorAll('[data-home-action="agenda"]').forEach((el) => el.addEventListener('click', () => onAgenda?.()));
}

export function setHomeDashboardConsultasHoje(value) {
  const el = document.getElementById("gcHomeStatConsultas");
  if (el) el.textContent = value == null ? "—" : String(value);
}

export function setHomeDashboardPedidosOnline(value) {
  const el = document.getElementById("gcHomeStatPedidosOnline");
  if (el) el.textContent = value == null ? "—" : String(value);
}

export function setHomeDashboardConsentimentos(value) {
  const el = document.getElementById("gcHomeStatConsentimentos");
  if (el) el.textContent = value == null ? "—" : String(value);
}

const ALERT_SOURCE_LABELS = {
  website:      "Site",
  exercise:     "Exercício",
  diary:        "Diário",
  questionnaire:"Questionário",
  consent:      "Consentimento",
  system:       "Sistema",
};

const ALERT_SEVERITY_META = {
  urgent:    { label: "Urgente", icon: "alert", cls: "gc-home-alert-urgent" },
  attention: { label: "Atenção", icon: "clock", cls: "gc-home-alert-attention" },
  info:      { label: "Novo",    icon: "inbox", cls: "gc-home-alert-info" },
};

function escHomeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtHomeAlertTime(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch (_) {
    return "—";
  }
}

export function setHomeDashboardAlertStats(stats) {
  const map = {
    gcHomeStatUrgentes:   stats?.urgent,
    gcHomeStatAtencao:    stats?.attention,
    gcHomeStatNovos:      stats?.info,
    gcHomeStatResolvidos: stats?.resolvedToday,
  };
  Object.entries(map).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = (stats == null || value == null) ? "—" : String(value);
  });
}

const HOME_ALERTS_VISIBLE = 5;

function homeAlertRowHtml(a) {
  const meta = ALERT_SEVERITY_META[a.severity] || ALERT_SEVERITY_META.info;
  const sourceLabel = ALERT_SOURCE_LABELS[a.source] || a.source || "—";
  return `
    <div class="gc-home-alert-row ${meta.cls}" data-alert-id="${escHomeHtml(a.id)}">
      <div class="gc-home-alert-icon">${ICON[meta.icon]}</div>
      <div class="gc-home-alert-body">
        <div class="gc-home-alert-top"><span class="gc-home-alert-badge">${meta.label}</span><span class="gc-home-alert-source">${escHomeHtml(sourceLabel)}</span><span class="gc-home-alert-time">${fmtHomeAlertTime(a.created_at)}</span></div>
        <div class="gc-home-alert-title">${escHomeHtml(a.title || "—")}</div>
        ${a.message ? `<div class="gc-home-alert-msg">${escHomeHtml(a.message)}</div>` : ""}
      </div>
      <div class="gc-home-alert-actions">
        ${a.target_url ? `<button type="button" class="gc-home-alert-open" data-alert-open="${escHomeHtml(a.id)}">Abrir</button>` : ""}
        <button type="button" class="gc-home-alert-resolve" data-alert-resolve="${escHomeHtml(a.id)}">Resolvido</button>
      </div>
    </div>`;
}

export function renderHomeDashboardAlerts(alerts, { onOpen, onResolve } = {}) {
  const root = document.getElementById("gcHomeAlertsList");
  const toggleBtn = document.getElementById("gcHomeAlertsToggle");
  if (!root) return;

  if (alerts == null) {
    root.innerHTML = `
      <div class="gc-home-empty">
        <div class="gc-home-empty-icon">${ICON.inbox}</div>
        <div><b>Não foi possível carregar os alertas</b><p>Tente novamente mais tarde.</p></div>
      </div>`;
    if (toggleBtn) { toggleBtn.style.display = "none"; toggleBtn.onclick = null; }
    return;
  }

  if (!alerts.length) {
    root.innerHTML = `
      <div class="gc-home-empty">
        <div class="gc-home-empty-icon">${ICON.check}</div>
        <div><b>Sem alertas pendentes</b><p>Não há situações a exigir a sua atenção neste momento.</p></div>
      </div>`;
    if (toggleBtn) { toggleBtn.style.display = "none"; toggleBtn.onclick = null; }
    return;
  }

  const visible = alerts.slice(0, HOME_ALERTS_VISIBLE);
  const extra   = alerts.slice(HOME_ALERTS_VISIBLE);

  root.innerHTML = `<div class="gc-home-alerts">${visible.map(homeAlertRowHtml).join("")}${
    extra.length ? `<div class="gc-home-alerts-extra" style="display:none;">${extra.map(homeAlertRowHtml).join("")}</div>` : ""
  }</div>`;

  root.querySelectorAll("[data-alert-open]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-alert-open");
      const a = alerts.find((x) => String(x.id) === id);
      onOpen?.(a?.target_url || null, id);
    });
  });

  root.querySelectorAll("[data-alert-resolve]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-alert-resolve");
      onResolve?.(id);
    });
  });

  if (toggleBtn) {
    if (extra.length) {
      toggleBtn.style.display = "";
      toggleBtn.textContent = "Ver todos";
      toggleBtn.onclick = () => {
        const extraEl = root.querySelector(".gc-home-alerts-extra");
        if (!extraEl) return;
        const isHidden = extraEl.style.display === "none";
        extraEl.style.display = isHidden ? "flex" : "none";
        toggleBtn.textContent = isHidden ? "Ver menos" : "Ver todos";
      };
    } else {
      toggleBtn.style.display = "none";
      toggleBtn.onclick = null;
    }
  }
}
