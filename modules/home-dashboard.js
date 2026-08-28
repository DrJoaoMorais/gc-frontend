/* Home Dashboard — painel clínico-operacional do médico (V1). */

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
        <div><div class="gc-home-title">Início</div><div class="gc-home-sub">Panorama clínico e operacional</div></div>
        <div class="gc-home-head-actions">
          <select id="gcHomeClinicSelect" class="gc-home-clinic-select"><option value="">Todas as clínicas</option></select>
          <button class="gc-home-agenda-btn" data-home-action="agenda">${ICON.calendar}<span>Agenda de hoje</span></button>
        </div>
      </div>

      <div class="gc-home-today">
        <div><b>Consultas hoje</b><strong id="gcHomeStatConsultas">—</strong><div id="gcHomeConsultasBreakdown" class="gc-home-consultas-breakdown"></div></div>
        <div id="gcHomePedidosCard" class="gc-home-clickable-card" role="button" tabindex="0" aria-expanded="false">
          <b>Pedidos online</b><strong id="gcHomeStatPedidosOnline">—</strong>
          <small class="gc-home-card-hint">Pendentes <span class="gc-home-pedidos-caret">▾</span></small>
        </div>
        <div><b>Assuntos a tratar</b><strong id="gcHomeStatAssuntos">—</strong><small class="gc-home-card-muted">Ainda não configurado</small></div>
      </div>
      <div id="gcHomePedidosExpand" class="gc-home-pedidos-expand" hidden></div>

      <div class="gc-home-alertbar" id="gcHomeAlertBar">
        <button type="button" class="gc-home-alertbar-item on" data-alert-filter="all"><span>Todos</span><strong id="gcHomeStatTodos">—</strong></button>
        <button type="button" class="gc-home-alertbar-item urgent" data-alert-filter="urgent"><span>Urgentes</span><strong id="gcHomeStatUrgentes">—</strong></button>
        <button type="button" class="gc-home-alertbar-item attention" data-alert-filter="attention"><span>Atenção</span><strong id="gcHomeStatAtencao">—</strong></button>
        <button type="button" class="gc-home-alertbar-item info" data-alert-filter="info"><span>Novos</span><strong id="gcHomeStatNovos">—</strong></button>
        <button type="button" class="gc-home-alertbar-item resolved" data-alert-filter="resolved"><span>Resolvidos</span><strong id="gcHomeStatResolvidos">—</strong></button>
      </div>

      <div class="gc-home-section-head"><div><h2>Precisa da sua atenção</h2><p>Alertas clínicos e operacionais pendentes</p></div><button type="button" id="gcHomeAlertsToggle" style="display:none;">Ver todos</button></div>
      <div id="gcHomeAlertsList">
        <div class="gc-home-empty">
          <div class="gc-home-empty-icon">${ICON.inbox}</div>
          <div><b>A carregar alertas…</b><p>Área preparada para os alertas reais.</p></div>
        </div>
      </div>

      <div class="gc-home-section-head"><div><h2>Acompanhamento ativo</h2><p id="gcHomeAcompSub">— doentes</p></div></div>
      <div class="gc-home-acomp">
        <div class="gc-home-acomp-stats" id="gcHomeAcompStats">
          <button type="button" data-acomp-filter="needsAction"><b>Precisa de ação</b><strong id="gcHomeAcompAcao">—</strong></button>
          <button type="button" data-acomp-filter="endingSoon"><b>A terminar</b><strong id="gcHomeAcompTerminar">—</strong></button>
          <button type="button" data-acomp-filter="inactive"><b>Sem atividade</b><strong id="gcHomeAcompSemAtiv">—</strong></button>
          <button type="button" data-acomp-filter="regular"><b>Regular</b><strong id="gcHomeAcompRegular">—</strong></button>
        </div>
        <div id="gcHomeAcompList" class="gc-home-acomp-list"></div>
        <button type="button" class="gc-home-acomp-viewall" id="gcHomeAcompViewAll" disabled>Ver todos os acompanhamentos</button>
      </div>
    </section>`;
}

export function homeDashboardStyles() {
  return `
.gc-home{max-width:1180px;margin:0 auto;padding:4px 2px 36px}
.gc-home-head{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:24px}
.gc-home-title{font-size:27px;font-weight:780;letter-spacing:-.6px;color:#0f2d52}
.gc-home-sub{margin-top:4px;color:#64748b;font-size:13px}
.gc-home-agenda-btn{display:flex;align-items:center;gap:8px;border:1px solid #cbd5e1;background:#fff;color:#0f2d52;border-radius:10px;padding:9px 13px;font:650 13px/1.2 inherit;cursor:pointer}
.gc-home-head-actions{display:flex;align-items:center;gap:10px}
.gc-home-clinic-select{border:1px solid #cbd5e1;background:#fff;color:#0f2d52;border-radius:10px;padding:9px 12px;font:600 13px/1.2 inherit;cursor:pointer}
.gc-home-section-head{display:flex;align-items:end;justify-content:space-between;margin-top:28px;margin-bottom:10px}
.gc-home-section-head h2{font-size:16px;color:#0f2d52;margin:0}
.gc-home-section-head p{font-size:11px;color:#94a3b8;margin:3px 0 0}
.gc-home-section-head button{border:0;background:transparent;color:#2563eb;font:650 12px inherit;cursor:pointer}
.gc-home-empty{background:#fff;border:1px solid #e2e8f0;border-radius:13px;min-height:138px;display:flex;align-items:center;justify-content:center;gap:13px;color:#475569}
.gc-home-empty-icon{width:42px;height:42px;border-radius:50%;background:#f1f5f9;color:#64748b;display:flex;align-items:center;justify-content:center}
.gc-home-empty b{font-size:13px}
.gc-home-empty p{font-size:11px;color:#94a3b8;margin:4px 0 0}

/* Primeira linha — 3 cartões */
.gc-home-today{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;align-items:start}
.gc-home-today>div{border:1px solid #e2e8f0;background:#fff;border-radius:12px;padding:14px 16px;text-align:left;min-height:91px;font-family:inherit;color:#0f172a}
.gc-home-today>div b{display:block;font-size:12px;color:#475569}
.gc-home-today>div strong{display:block;font-size:22px;margin-top:4px}
.gc-home-today>div small{font-size:11px;color:#94a3b8}
.gc-home-card-muted{font-style:italic}
.gc-home-consultas-breakdown{margin-top:8px;display:flex;flex-direction:column;gap:2px}
.gc-home-consultas-row{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;border:none;background:transparent;padding:3px 0;font:inherit;cursor:pointer;text-align:left}
.gc-home-consultas-row:hover .gc-home-consultas-row-name{color:#1a56db;text-decoration:underline}
.gc-home-consultas-row-name{font-size:11.5px;color:#475569;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gc-home-consultas-row-count{font-size:11.5px;font-weight:700;color:#0f172a;flex-shrink:0}
.gc-home-clickable-card{cursor:pointer;transition:border-color .12s,box-shadow .12s}
.gc-home-clickable-card:hover{border-color:#93c5fd;box-shadow:0 1px 4px rgba(15,45,82,.08)}
.gc-home-clickable-card:focus-visible{outline:2px solid #93c5fd;outline-offset:2px}
.gc-home-card-hint{display:flex;align-items:center;gap:4px}
.gc-home-pedidos-caret{display:inline-block;transition:transform .15s}
.gc-home-clickable-card[aria-expanded="true"] .gc-home-pedidos-caret{transform:rotate(180deg)}

/* Pedidos online — expansão */
.gc-home-pedidos-expand{margin-top:10px}
.gc-home-pedidos-list{display:flex;flex-direction:column;gap:8px}
.gc-home-pedido-row{display:flex;align-items:center;justify-content:space-between;gap:12px;background:#fff;border:1px solid #e2e8f0;border-left:3px solid #f59e0b;border-radius:12px;padding:11px 14px}
.gc-home-pedido-info{display:flex;flex-direction:column;gap:2px;min-width:0}
.gc-home-pedido-info strong{font-size:13px;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gc-home-pedido-info span{font-size:11.5px;color:#94a3b8}
.gc-home-pedido-open{flex-shrink:0;font-size:11.5px;font-weight:650;border-radius:8px;padding:6px 10px;cursor:pointer;white-space:nowrap;font-family:inherit;border:1px solid #cbd5e1;background:#fff;color:#0f2d52}
.gc-home-pedido-open:hover{border-color:#93c5fd;background:#f8fbff}

/* Barra compacta de alertas */
.gc-home-alertbar{display:flex;flex-wrap:wrap;gap:8px;margin-top:20px}
.gc-home-alertbar-item{display:flex;align-items:center;gap:6px;border:1px solid #e2e8f0;background:#fff;border-radius:999px;padding:6px 12px;font:inherit;cursor:default}
button.gc-home-alertbar-item{cursor:pointer}
button.gc-home-alertbar-item:hover{border-color:#93c5fd}
.gc-home-alertbar-item span{font-size:11.5px;color:#64748b;font-weight:600}
.gc-home-alertbar-item strong{font-size:13px;color:#0f172a;font-weight:800}
.gc-home-alertbar-item.on{border-color:#0f2d52;background:#0f2d52}
.gc-home-alertbar-item.on span{color:rgba(255,255,255,.75)}
.gc-home-alertbar-item.on strong{color:#fff}
.gc-home-alertbar-item.urgent strong{color:#dc2626}
.gc-home-alertbar-item.attention strong{color:#ea580c}
.gc-home-alertbar-item.info strong{color:#2563eb}
.gc-home-alertbar-item.resolved strong{color:#16a34a}
.gc-home-alertbar-item.on.urgent strong,.gc-home-alertbar-item.on.attention strong,.gc-home-alertbar-item.on.info strong{color:#fff}

/* Precisa da sua atenção */
.gc-home-alerts{display:flex;flex-direction:column;gap:8px}
.gc-home-alerts-extra{flex-direction:column;gap:8px;margin-top:8px}
.gc-home-alert-row{display:flex;align-items:flex-start;gap:12px;background:#fff;border:1px solid #e2e8f0;border-left:3px solid #cbd5e1;border-radius:12px;padding:12px 14px}
.gc-home-alert-icon{width:32px;height:32px;border-radius:9px;display:flex;align-items:center;justify-content:center;flex:0 0 auto;background:#f1f5f9;color:#64748b}
.gc-home-alert-urgent{border-left-color:#dc2626}
.gc-home-alert-urgent .gc-home-alert-icon{background:#fef2f2;color:#dc2626}
.gc-home-alert-attention{border-left-color:#ea580c}
.gc-home-alert-attention .gc-home-alert-icon{background:#fff7ed;color:#ea580c}
.gc-home-alert-info{border-left-color:#2563eb}
.gc-home-alert-info .gc-home-alert-icon{background:#eff6ff;color:#2563eb}
.gc-home-alert-body{flex:1;min-width:0}
.gc-home-alert-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.gc-home-alert-badge{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:#475569}
.gc-home-alert-source{font-size:11px;color:#94a3b8}
.gc-home-alert-time{font-size:11px;color:#94a3b8;margin-left:auto}
.gc-home-alert-title{font-size:13px;font-weight:700;color:#0f172a;margin-top:2px}
.gc-home-alert-msg{font-size:12px;color:#64748b;margin-top:2px}
.gc-home-alert-actions{display:flex;gap:6px;flex:0 0 auto;align-items:flex-start}
.gc-home-alert-open,.gc-home-alert-resolve{font-size:11.5px;font-weight:650;border-radius:8px;padding:6px 10px;cursor:pointer;white-space:nowrap;font-family:inherit}
.gc-home-alert-open{border:1px solid #cbd5e1;background:#fff;color:#0f2d52}
.gc-home-alert-resolve{border:1px solid #a7f3d0;background:#ecfdf5;color:#065f46}

/* Acompanhamento ativo */
.gc-home-acomp{border:1px solid #e2e8f0;background:#fff;border-radius:13px;padding:16px}
.gc-home-acomp-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.gc-home-acomp-stats>button{border:1px solid #f1f5f9;background:#fff;border-radius:10px;padding:10px 12px;text-align:left;font-family:inherit;cursor:pointer}
.gc-home-acomp-stats>button:hover{border-color:#93c5fd}
.gc-home-acomp-stats>button.on{border-color:#0f2d52;background:#f0f6ff}
.gc-home-acomp-stats b{display:block;font-size:11.5px;color:#64748b}
.gc-home-acomp-stats strong{display:block;font-size:20px;color:#0f172a;margin-top:3px}
.gc-home-acomp-list{margin-top:14px;min-height:0}
.gc-home-acomp-heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.gc-home-acomp-heading>span{font-size:12.5px;font-weight:700;color:#0f2d52;text-transform:uppercase;letter-spacing:.03em}
.gc-home-acomp-close{border:0;background:transparent;color:#2563eb;font:650 12px inherit;cursor:pointer}
.gc-home-acomp-items{display:flex;flex-direction:column;gap:8px}
.gc-home-acomp-item{display:flex;align-items:center;justify-content:space-between;gap:12px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:11px 14px}
.gc-home-acomp-item-info{display:flex;flex-direction:column;gap:2px;min-width:0}
.gc-home-acomp-item-name{font-size:13px;font-weight:700;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gc-home-acomp-item-sub{font-size:11.5px;color:#475569}
.gc-home-acomp-item-meta{font-size:11px;color:#94a3b8}
.gc-home-acomp-item-open{flex-shrink:0;font-size:11.5px;font-weight:650;border-radius:8px;padding:6px 10px;white-space:nowrap;font-family:inherit;border:1px solid #e2e8f0;background:#f8fafc;color:#94a3b8;cursor:not-allowed}
.gc-home-acomp-viewall{margin-top:14px;width:100%;border:1px solid #e2e8f0;background:#f8fafc;color:#64748b;border-radius:10px;padding:10px;font:650 12.5px inherit;cursor:not-allowed}

.gc-home [data-home-action="agenda"]:hover{border-color:#93c5fd;background:#f8fbff}

@media(max-width:900px){
  .gc-home-today{grid-template-columns:repeat(2,1fr)}
  .gc-home-acomp-stats{grid-template-columns:repeat(2,1fr)}
}
@media(max-width:600px){
  .gc-home{padding:2px 0 24px}
  .gc-home-head{align-items:flex-start}
  .gc-home-head-actions{width:100%;justify-content:space-between}
  .gc-home-title{font-size:22px}
  .gc-home-agenda-btn span{display:none}
  .gc-home-today{grid-template-columns:1fr}
  .gc-home-acomp-stats{grid-template-columns:1fr}
  .gc-home-empty{padding:22px 16px;justify-content:flex-start}
}
  `;
}

export function wireHomeDashboard(onAgenda) {
  document.querySelectorAll('[data-home-action="agenda"]').forEach((el) => el.addEventListener('click', () => onAgenda?.()));
}

export function setHomeDashboardConsultasHoje(value) {
  const el = document.getElementById("gcHomeStatConsultas");
  if (el) el.textContent = value == null ? "—" : String(value);
}

export function renderHomeClinicSelect(clinics, selectedId, onChange) {
  const sel = document.getElementById("gcHomeClinicSelect");
  if (!sel) return;
  const opts = [`<option value="">Todas as clínicas</option>`].concat(
    (clinics || []).map((c) => `<option value="${escHomeHtml(c.id)}">${escHomeHtml(c.name || c.slug || c.id)}</option>`)
  );
  sel.innerHTML = opts.join("");
  sel.value = selectedId || "";
  sel.onchange = () => onChange?.(sel.value || null);
}

export function renderHomeConsultasBreakdown(breakdown, { onClinicClick } = {}) {
  const root = document.getElementById("gcHomeConsultasBreakdown");
  if (!root) return;
  if (!breakdown || !breakdown.length) { root.innerHTML = ""; return; }

  root.innerHTML = breakdown.map((b) => `
    <button type="button" class="gc-home-consultas-row" data-clinic-id="${escHomeHtml(b.clinicId)}">
      <span class="gc-home-consultas-row-name">${escHomeHtml(b.name)}</span>
      <span class="gc-home-consultas-row-count">${escHomeHtml(String(b.count))}</span>
    </button>`).join("");

  root.querySelectorAll("[data-clinic-id]").forEach((btn) => {
    btn.addEventListener("click", () => onClinicClick?.(btn.getAttribute("data-clinic-id")));
  });
}

export function setHomeDashboardPedidosOnline(value) {
  const el = document.getElementById("gcHomeStatPedidosOnline");
  if (el) el.textContent = value == null ? "—" : String(value);
}

/* Mesma etiqueta de tipo já usada em agenda.js (_TIPO_LABEL) — duplicada aqui
   por ser apenas um mapa de apresentação estático, não lógica de negócio;
   _TIPO_LABEL não é exportado por agenda.js. */
const HOME_PEDIDO_TIPO_LABELS = {
  videoconsulta: "Videoconsulta",
  exame_desportivo: "Exame Médico Desportivo",
};

export function wirePedidosOnlineToggle(onOpen) {
  const card = document.getElementById("gcHomePedidosCard");
  const expand = document.getElementById("gcHomePedidosExpand");
  if (!card || !expand) return;

  const toggle = () => {
    const isHidden = expand.hasAttribute("hidden");
    if (isHidden) {
      expand.removeAttribute("hidden");
      card.setAttribute("aria-expanded", "true");
      onOpen?.();
    } else {
      expand.setAttribute("hidden", "");
      card.setAttribute("aria-expanded", "false");
    }
  };

  card.addEventListener("click", toggle);
  card.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); toggle(); }
  });
}

export function renderHomePedidosOnlineList(rows, { onOpenAgenda } = {}) {
  const root = document.getElementById("gcHomePedidosExpand");
  if (!root) return;

  if (rows == null) {
    root.innerHTML = `<div class="gc-home-empty"><div class="gc-home-empty-icon">${ICON.inbox}</div><div><b>Não foi possível carregar os pedidos</b><p>Tente novamente mais tarde.</p></div></div>`;
    return;
  }

  if (!rows.length) {
    root.innerHTML = `<div class="gc-home-empty"><div class="gc-home-empty-icon">${ICON.check}</div><div><b>Sem pedidos pendentes</b><p>Não há pedidos online por tratar neste âmbito.</p></div></div>`;
    return;
  }

  root.innerHTML = `<div class="gc-home-pedidos-list">${rows.map((r) => `
    <div class="gc-home-pedido-row">
      <div class="gc-home-pedido-info">
        <strong>${escHomeHtml(r.atleta_nome || "—")}</strong>
        <span>${escHomeHtml(HOME_PEDIDO_TIPO_LABELS[r.tipo] || r.tipo || "—")} · ${fmtHomeAlertTime(r.created_at)}</span>
      </div>
      <button type="button" class="gc-home-pedido-open" data-clinic-id="${escHomeHtml(r.clinic_id || "")}">Abrir na Agenda</button>
    </div>`).join("")}</div>`;

  root.querySelectorAll("[data-clinic-id]").forEach((btn) => {
    btn.addEventListener("click", () => onOpenAgenda?.(btn.getAttribute("data-clinic-id") || null));
  });
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
  const total = stats == null ? null : (Number(stats.urgent || 0) + Number(stats.attention || 0) + Number(stats.info || 0));
  const map = {
    gcHomeStatTodos:      total,
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

/* wireHomeAlertFilterBar — só filtra em memória as listas já carregadas
   (via callback do chamador: pendentes por severidade, ou resolvidosHoje
   para o filtro "resolved"); nunca faz query nova aqui. */
export function wireHomeAlertFilterBar(currentFilter, onFilterChange) {
  const bar = document.getElementById("gcHomeAlertBar");
  if (!bar) return;
  const buttons = bar.querySelectorAll("[data-alert-filter]");
  buttons.forEach((btn) => {
    btn.classList.toggle("on", btn.getAttribute("data-alert-filter") === (currentFilter || "all"));
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.toggle("on", b === btn));
      onFilterChange?.(btn.getAttribute("data-alert-filter"));
    });
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
        ${a.resolved_at ? "" : `<button type="button" class="gc-home-alert-resolve" data-alert-resolve="${escHomeHtml(a.id)}">Resolvido</button>`}
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

/* setHomeAcompanhamentoStats — preenche os 4 contadores + total, a partir
   de loadHomeAcompanhamentoExercicio() (boot.js). */
export function setHomeAcompanhamentoStats(stats) {
  const sub = document.getElementById("gcHomeAcompSub");
  if (sub) sub.textContent = stats?.total != null ? `${stats.total} doentes` : "— doentes";
  const map = {
    gcHomeAcompAcao:     stats?.precisaAcao,
    gcHomeAcompTerminar: stats?.aTerminar,
    gcHomeAcompSemAtiv:  stats?.semAtividade,
    gcHomeAcompRegular:  stats?.regular,
  };
  Object.entries(map).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = (stats == null || value == null) ? "—" : String(value);
  });
}

/* wireHomeAcompFilterBar — liga os 4 contadores clicáveis; o clique só
   chama o callback do chamador (boot.js), que já tem os dados em memória
   — nunca faz query aqui. */
export function wireHomeAcompFilterBar(currentCategory, onCategoryClick) {
  const bar = document.getElementById("gcHomeAcompStats");
  if (!bar) return;
  const buttons = bar.querySelectorAll("[data-acomp-filter]");
  buttons.forEach((btn) => {
    btn.classList.toggle("on", btn.getAttribute("data-acomp-filter") === currentCategory);
    btn.addEventListener("click", () => {
      const category = btn.getAttribute("data-acomp-filter");
      buttons.forEach((b) => b.classList.toggle("on", b === btn));
      onCategoryClick?.(category);
    });
  });
}

const ACOMP_CATEGORY_LABELS = {
  needsAction: "Precisa de ação",
  endingSoon:  "A terminar",
  inactive:    "Sem atividade",
  regular:     "Regular",
};

/* renderHomeAcompanhamentoList — lista compacta por doente, para a
   categoria selecionada. `items` já vem formatado (nome/subtítulo/meta)
   por boot.js — este módulo só apresenta, não calcula regras. */
export function renderHomeAcompanhamentoList(category, items, { onClose } = {}) {
  const root = document.getElementById("gcHomeAcompList");
  if (!root) return;

  if (!category) { root.innerHTML = ""; return; }

  const title = ACOMP_CATEGORY_LABELS[category] || category;
  const heading = `
    <div class="gc-home-acomp-heading">
      <span>${escHomeHtml(title)}</span>
      <button type="button" class="gc-home-acomp-close" id="gcHomeAcompClose">Fechar</button>
    </div>`;

  if (!items || !items.length) {
    root.innerHTML = `${heading}<div class="gc-home-empty"><div class="gc-home-empty-icon">${ICON.check}</div><div><b>Sem doentes nesta categoria</b><p>Não há ninguém em "${escHomeHtml(title)}" neste âmbito.</p></div></div>`;
  } else {
    root.innerHTML = `${heading}<div class="gc-home-acomp-items">${items.map((it) => `
      <div class="gc-home-acomp-item">
        <div class="gc-home-acomp-item-info">
          <span class="gc-home-acomp-item-name">${escHomeHtml(it.name || "—")}</span>
          <span class="gc-home-acomp-item-sub">Exercício${it.subtitle ? ` · ${escHomeHtml(it.subtitle)}` : ""}</span>
          ${it.meta ? `<span class="gc-home-acomp-item-meta">${escHomeHtml(it.meta)}</span>` : ""}
        </div>
        <button type="button" class="gc-home-acomp-item-open" disabled title="Em preparação">Abrir acompanhamento</button>
      </div>`).join("")}</div>`;
  }

  document.getElementById("gcHomeAcompClose")?.addEventListener("click", () => onClose?.());
}
