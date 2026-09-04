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
        <!-- "Assuntos a tratar" fica reservado para futura integração na Gestão da Agenda. -->
        <div id="gcHomeAcompUnificadoCard" class="gc-home-clickable-card" role="button" tabindex="0">
          <b>Acompanhamento ativo</b><strong id="gcHomeAcompUnificadoTotal">—</strong>
          <small id="gcHomeAcompUnificadoResumo">Diários — · Questionários — · Planos —</small>
          <small class="gc-home-card-hint">Ver doentes →</small>
        </div>
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
.gc-home-today #gcHomeAcompUnificadoCard{display:flex;flex-direction:column}
.gc-home-today #gcHomeAcompUnificadoCard .gc-home-card-hint{margin-top:auto;color:#2563eb;font-weight:650}
.gc-home-questionario-queues{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}
.gc-home-questionario-queues button{border:1px solid #e2e8f0;background:#f8fafc;border-radius:9px;padding:7px 9px;text-align:left;cursor:pointer;font:inherit;min-width:0}
.gc-home-questionario-queues button:hover{border-color:#93c5fd;background:#f8fbff}
.gc-home-questionario-queues button span{display:block;font-size:10.5px;color:#64748b;white-space:nowrap}
.gc-home-questionario-queues button strong{display:block;font-size:18px;line-height:1.1;margin-top:2px;color:#0f172a}
.gc-home-questionario-queues button small{display:block;margin-top:3px;font-size:9.5px;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gc-home-questionario-queues button small b{display:inline;font-size:9.5px;color:#64748b}
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
.gc-home-questionario-drawer-bg{position:fixed;inset:0;z-index:10020;background:rgba(15,23,42,.35);display:flex;justify-content:flex-end}
.gc-home-questionario-drawer{width:min(560px,94vw);height:100%;background:#f8fafc;box-shadow:-8px 0 30px rgba(15,23,42,.16);display:flex;flex-direction:column}
.gc-home-questionario-drawer-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:20px 22px 14px;background:#fff;border-bottom:1px solid #e2e8f0}
.gc-home-questionario-drawer-head h2{margin:0;color:#0f2d52;font-size:18px}.gc-home-questionario-drawer-head p{margin:3px 0 0;color:#94a3b8;font-size:11.5px}
.gc-home-questionario-close{border:0;background:transparent;color:#64748b;font-size:24px;cursor:pointer;line-height:1}
.gc-home-questionario-search{margin:14px 16px 8px;border:1px solid #cbd5e1;border-radius:9px;padding:9px 11px;font:13px inherit;background:#fff}
.gc-home-questionario-list{padding:8px 16px;display:flex;flex-direction:column;gap:8px;overflow:auto;flex:1}
.gc-home-questionario-row{display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0;background:#fff;border:1px solid #e2e8f0;border-left:3px solid #64748b;border-radius:12px;padding:10px 12px}
.gc-home-questionario-row.enviado{border-left-color:#f59e0b}
.gc-home-questionario-row.em-preenchimento{border-left-color:#2563eb}
.gc-home-questionario-row.respondido{border-left-color:#16a34a}
.gc-home-questionario-row.prioritario{border-left-color:#dc2626}
.gc-home-questionario-info{display:flex;flex:1;flex-direction:column;gap:2px;min-width:0}
.gc-home-questionario-info strong{font-size:13px;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gc-home-patient-link{display:block;width:fit-content;max-width:100%;border:0;background:transparent;padding:0;color:#0f172a;font:700 13px inherit;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}.gc-home-patient-link:hover{color:#1d5de2;text-decoration:underline}
.gc-home-questionario-info span{font-size:11.5px;color:#94a3b8}
.gc-home-acomp-tags{display:flex;flex-wrap:wrap;gap:5px;margin-top:4px}
.gc-home-acomp-tag{display:inline-flex;align-items:center;border-radius:999px;padding:3px 7px;background:#f1f5f9;color:#475569!important;font-size:10.5px!important}
.gc-home-acomp-tag.diario{background:#eef2ff;color:#4338ca!important}.gc-home-acomp-tag.questionario{background:#fff7ed;color:#9a3412!important}.gc-home-acomp-tag.exercicio{background:#eff6ff;color:#1d4ed8!important}.gc-home-acomp-tag.acao{background:#fef2f2;color:#b91c1c!important}.gc-home-acomp-tag.analisar{background:#ecfdf5;color:#047857!important}
.gc-home-questionario-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px;flex-shrink:0}.gc-home-questionario-actions button{font:650 11px inherit;border-radius:7px;padding:6px 9px;cursor:pointer;white-space:nowrap}
.gc-home-questionario-open{border:1px solid #cbd5e1;background:#fff;color:#0f2d52}.gc-home-questionario-resolve{border:1px solid #a7f3d0;background:#ecfdf5;color:#065f46}.gc-home-acomp-stop{border:1px solid #fecaca;background:#fff;color:#b91c1c}
.gc-home-questionario-pages{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 16px;background:#fff;border-top:1px solid #e2e8f0;color:#64748b;font-size:11.5px}
.gc-home-questionario-pages button{border:1px solid #cbd5e1;background:#fff;color:#0f2d52;border-radius:7px;padding:6px 10px;cursor:pointer}.gc-home-questionario-pages button:disabled{opacity:.4;cursor:default}

/* Acompanhamento ativo — expansão (mesmo padrão de Pedidos online) */
.gc-home-acomp-list{display:flex;flex-direction:column;gap:8px}
.gc-home-acomp-row{display:flex;align-items:center;justify-content:space-between;gap:12px;background:#fff;border:1px solid #e2e8f0;border-left:3px solid #2563eb;border-radius:12px;padding:11px 14px}
.gc-home-acomp-info{display:flex;flex-direction:column;gap:2px;min-width:0}
.gc-home-acomp-info strong{font-size:13px;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gc-home-acomp-info span{font-size:11.5px;color:#94a3b8}
.gc-home-acomp-open{flex-shrink:0;font-size:11.5px;font-weight:650;border-radius:8px;padding:6px 10px;cursor:pointer;white-space:nowrap;font-family:inherit;border:1px solid #cbd5e1;background:#fff;color:#0f2d52}
.gc-home-acomp-open:hover{border-color:#93c5fd;background:#f8fbff}

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
  .gc-home-questionario-row{align-items:flex-start;flex-direction:column}
  .gc-home-questionario-actions{justify-content:flex-start;width:100%}
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

export function setHomeQuestionarioStats(stats) {
  const map = {
    gcHomeQuestionariosAguardam: stats?.aguardamResposta,
    gcHomeQuestionariosEnviados: stats?.enviados,
    gcHomeQuestionariosCurso: stats?.emPreenchimento,
    gcHomeQuestionariosAnalisar: stats?.porAnalisar,
  };
  Object.entries(map).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = (stats == null || value == null) ? "—" : String(value);
  });
}

export function wireHomeQuestionariosToggle({ onOpenWaiting, onOpenReview } = {}) {
  const card = document.getElementById("gcHomeQuestionariosCard");
  if (!card) return;
  card.querySelector('[data-questionario-fila="aguardam"]')?.addEventListener("click", () => onOpenWaiting?.());
  card.querySelector('[data-questionario-fila="analisar"]')?.addEventListener("click", () => onOpenReview?.());
}

export function renderHomeQuestionariosList(rows, { kind = "waiting", onOpen, onResolve } = {}) {
  document.getElementById("gcHomeQuestionarioDrawer")?.remove();
  const bg = document.createElement("div");
  bg.id = "gcHomeQuestionarioDrawer";
  bg.className = "gc-home-questionario-drawer-bg";
  const titulo = kind === "review" ? "Questionários por analisar" : "Questionários que aguardam resposta";
  bg.innerHTML = `<aside class="gc-home-questionario-drawer" role="dialog" aria-modal="true" aria-label="${titulo}">
    <div class="gc-home-questionario-drawer-head"><div><h2>${titulo}</h2><p>${kind === "review" ? "Respostas concluídas ainda não marcadas como analisadas." : "Links válidos enviados ou em preenchimento."}</p></div><button type="button" class="gc-home-questionario-close" aria-label="Fechar">×</button></div>
    <input class="gc-home-questionario-search" type="search" placeholder="Pesquisar doente…" autocomplete="off">
    <div class="gc-home-questionario-list"></div><div class="gc-home-questionario-pages"></div>
  </aside>`;
  document.body.appendChild(bg);
  const close = () => bg.remove();
  bg.addEventListener("click", (event) => { if (event.target === bg) close(); });
  bg.querySelector(".gc-home-questionario-close")?.addEventListener("click", close);
  const root = bg.querySelector(".gc-home-questionario-list");
  const pages = bg.querySelector(".gc-home-questionario-pages");
  if (rows == null) {
    root.innerHTML = `<div class="gc-home-empty"><div class="gc-home-empty-icon">${ICON.inbox}</div><div><b>${rows === undefined ? "A carregar questionários…" : "Não foi possível carregar os questionários"}</b></div></div>`;
    pages.innerHTML = "";
    return;
  }
  let page = 0;
  const pageSize = 20;
  const estado = (row) => row.kind === "review" ? { label: "Por analisar", cls: "respondido", at: row.created_at } : row.status === "in_progress"
      ? { label: "Em preenchimento", cls: "em-preenchimento", at: row.rgpd_accepted_at || row.created_at }
      : { label: "Enviado", cls: "enviado", at: row.created_at };
  const render = () => {
    const query = String(bg.querySelector(".gc-home-questionario-search")?.value || "").trim().toLowerCase();
    const filtered = rows.filter((row) => !query || String(row.patients?.full_name || "").toLowerCase().includes(query));
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    page = Math.min(page, totalPages - 1);
    const visible = filtered.slice(page * pageSize, (page + 1) * pageSize);
    root.innerHTML = visible.length ? visible.map((row) => {
      const e = estado(row);
      return `<div class="gc-home-questionario-row ${e.cls}"><div class="gc-home-questionario-info"><strong>${escHomeHtml(row.patients?.full_name || "Doente")}</strong><span>${e.label} · ${fmtHomeAlertTime(e.at)}</span></div><div class="gc-home-questionario-actions"><button type="button" class="gc-home-questionario-open" data-questionario-open="${escHomeHtml(row.id)}">Ver</button>${kind === "review" ? `<button type="button" class="gc-home-questionario-resolve" data-questionario-resolve="${escHomeHtml(row.id)}">Marcar analisado</button>` : ""}</div></div>`;
    }).join("") : `<div class="gc-home-empty"><div class="gc-home-empty-icon">${ICON.check}</div><div><b>Sem questionários para mostrar</b></div></div>`;
    pages.innerHTML = `<button type="button" data-page="prev" ${page === 0 ? "disabled" : ""}>Anterior</button><span>${filtered.length} registo${filtered.length === 1 ? "" : "s"} · Página ${page + 1} de ${totalPages}</span><button type="button" data-page="next" ${page >= totalPages - 1 ? "disabled" : ""}>Seguinte</button>`;
    root.querySelectorAll("[data-questionario-open]").forEach((btn) => btn.addEventListener("click", () => onOpen?.(rows.find((row) => String(row.id) === btn.getAttribute("data-questionario-open")) || null)));
    root.querySelectorAll("[data-questionario-resolve]").forEach((btn) => btn.addEventListener("click", () => onResolve?.(rows.find((row) => String(row.id) === btn.getAttribute("data-questionario-resolve")) || null)));
    pages.querySelector('[data-page="prev"]')?.addEventListener("click", () => { page--; render(); });
    pages.querySelector('[data-page="next"]')?.addEventListener("click", () => { page++; render(); });
  };
  bg.querySelector(".gc-home-questionario-search")?.addEventListener("input", () => { page = 0; render(); });
  render();
}

export function setHomeAcompanhamentoUnificadoStats(stats) {
  const total = document.getElementById("gcHomeAcompUnificadoTotal");
  const resumo = document.getElementById("gcHomeAcompUnificadoResumo");
  if (total) total.textContent = stats?.total == null ? "—" : String(stats.total);
  if (resumo) resumo.textContent = stats == null
    ? "Diários — · Questionários — · Planos —"
    : `Diários ${stats.diarios ?? 0} · Questionários ${stats.questionarios ?? 0} · Planos ${stats.planos ?? 0}`;
}

export function wireHomeAcompanhamentoUnificado(onOpen) {
  const card = document.getElementById("gcHomeAcompUnificadoCard");
  if (!card) return;
  const open = () => onOpen?.();
  card.addEventListener("click", open);
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); }
  });
}

export function renderHomeAcompanhamentoUnificado(items, { onOpenFollowup, onStopFollowup } = {}) {
  document.getElementById("gcHomeQuestionarioDrawer")?.remove();
  const bg = document.createElement("div");
  bg.id = "gcHomeQuestionarioDrawer";
  bg.className = "gc-home-questionario-drawer-bg";
  bg.innerHTML = `<aside class="gc-home-questionario-drawer" role="dialog" aria-modal="true" aria-label="Acompanhamento ativo">
    <div class="gc-home-questionario-drawer-head"><div><h2>Acompanhamento ativo</h2><p>Doentes com Diário, questionário ou plano de exercício ativo.</p></div><button type="button" class="gc-home-questionario-close" aria-label="Fechar">×</button></div>
    <input class="gc-home-questionario-search" type="search" placeholder="Pesquisar doente…" autocomplete="off">
    <div class="gc-home-questionario-list"></div><div class="gc-home-questionario-pages"></div>
  </aside>`;
  document.body.appendChild(bg);
  const close = () => bg.remove();
  bg.addEventListener("click", (event) => { if (event.target === bg) close(); });
  bg.querySelector(".gc-home-questionario-close")?.addEventListener("click", close);
  const root = bg.querySelector(".gc-home-questionario-list");
  const pages = bg.querySelector(".gc-home-questionario-pages");
  if (items == null) {
    root.innerHTML = `<div class="gc-home-empty"><div class="gc-home-empty-icon">${ICON.alert}</div><div><b>Não foi possível carregar o acompanhamento</b></div></div>`;
    return;
  }
  let page = 0;
  const pageSize = 20;
  const render = () => {
    const query = String(bg.querySelector(".gc-home-questionario-search")?.value || "").trim().toLowerCase();
    const filtered = items.filter((item) => !query || String(item.patientName || "").toLowerCase().includes(query));
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    page = Math.min(page, totalPages - 1);
    const visible = filtered.slice(page * pageSize, (page + 1) * pageSize);
    root.innerHTML = visible.length ? visible.map((item) => {
      const q = item.questionnaire;
      const qLabel = q?.kind === "review" ? "Questionário: por analisar" : q?.status === "in_progress" ? "Questionário: em preenchimento" : q ? "Questionário: enviado" : "";
      const diaryTag = item.diary ? `<span class="gc-home-acomp-tag diario">${item.diary.durationDays === 7 ? "Diário experimental" : "Diário ativo"}: dia ${item.diary.day} de ${item.diary.durationDays}</span>` : "";
      const exerciseTags = item.exercise?.active
        ? [`<span class="gc-home-acomp-tag exercicio">Exercício: plano ativo</span>`, item.exercise.needsAction ? `<span class="gc-home-acomp-tag acao">Precisa de ação</span>` : "", item.exercise.ending ? `<span class="gc-home-acomp-tag">A terminar</span>` : ""].join("") : "";
      return `<div class="gc-home-questionario-row ${q?.kind === "review" || item.exercise?.needsAction ? "prioritario" : ""}">
        <div class="gc-home-questionario-info"><button type="button" class="gc-home-patient-link" data-followup-open="${escHomeHtml(item.itemKey)}">${escHomeHtml(item.patientName || "Doente")}</button><div class="gc-home-acomp-tags">${diaryTag}${qLabel ? `<span class="gc-home-acomp-tag ${q?.kind === "review" ? "analisar" : "questionario"}">${qLabel}</span>` : ""}${exerciseTags}</div></div>
        <div class="gc-home-questionario-actions">
          <button type="button" class="gc-home-questionario-open" data-followup-open="${escHomeHtml(item.itemKey)}">Abrir acompanhamento</button>
          <button type="button" class="gc-home-acomp-stop" data-followup-stop="${escHomeHtml(item.itemKey)}">Retirar do acompanhamento</button>
        </div>
      </div>`;
    }).join("") : `<div class="gc-home-empty"><div class="gc-home-empty-icon">${ICON.check}</div><div><b>Sem doentes em acompanhamento ativo</b></div></div>`;
    pages.innerHTML = `<button type="button" data-page="prev" ${page === 0 ? "disabled" : ""}>Anterior</button><span>${filtered.length} doente${filtered.length === 1 ? "" : "s"} · Página ${page + 1} de ${totalPages}</span><button type="button" data-page="next" ${page >= totalPages - 1 ? "disabled" : ""}>Seguinte</button>`;
    root.querySelectorAll("[data-followup-open]").forEach((btn) => btn.addEventListener("click", () => {
      onOpenFollowup?.(items.find((item) => String(item.itemKey) === btn.getAttribute("data-followup-open")) || null);
    }));
    root.querySelectorAll("[data-followup-stop]").forEach((btn) => btn.addEventListener("click", () => {
      onStopFollowup?.(items.find((item) => String(item.itemKey) === btn.getAttribute("data-followup-stop")) || null);
    }));
    pages.querySelector('[data-page="prev"]')?.addEventListener("click", () => { page--; render(); });
    pages.querySelector('[data-page="next"]')?.addEventListener("click", () => { page++; render(); });
  };
  bg.querySelector(".gc-home-questionario-search")?.addEventListener("input", () => { page = 0; render(); });
  render();
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

/* wireHomeAcompanhamentoToggle — 2 cartões partilham 1 único painel de
   expansão (nunca 2 painéis abertos ao mesmo tempo): clicar no cartão
   ativo fecha; clicar no outro troca o conteúdo. Mesmo mecanismo de
   card+aria-expanded+painel hidden já usado por wirePedidosOnlineToggle. */
export function wireHomeAcompanhamentoToggle({ onOpenAction, onOpenEnding } = {}) {
  const cardAction = document.getElementById("gcHomeAcompCardAcao");
  const cardEnding = document.getElementById("gcHomeAcompCardTerminar");
  const expand = document.getElementById("gcHomeAcompExpand");
  if (!cardAction || !cardEnding || !expand) return;

  let openKind = null;

  const close = () => {
    expand.setAttribute("hidden", "");
    cardAction.setAttribute("aria-expanded", "false");
    cardEnding.setAttribute("aria-expanded", "false");
    openKind = null;
  };

  const openAs = (kind) => {
    expand.removeAttribute("hidden");
    cardAction.setAttribute("aria-expanded", String(kind === "action"));
    cardEnding.setAttribute("aria-expanded", String(kind === "ending"));
    openKind = kind;
    (kind === "action" ? onOpenAction : onOpenEnding)?.();
  };

  const toggle = (kind) => (openKind === kind ? close() : openAs(kind));

  cardAction.addEventListener("click", () => toggle("action"));
  cardAction.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); toggle("action"); }
  });
  cardEnding.addEventListener("click", () => toggle("ending"));
  cardEnding.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); toggle("ending"); }
  });
}

/* renderHomeAcompanhamentoList — lista por PRESCRIÇÃO (nunca deduplicada
   por doente): cada item já vem pronto do boot.js
   ({patientId, prescriptionId, patientName, expiresAt, reasons}). Sem
   query aqui — home-dashboard.js só renderiza. */
export function renderHomeAcompanhamentoList(items, { kind, onOpen } = {}) {
  const root = document.getElementById("gcHomeAcompExpand");
  if (!root) return;

  if (items == null) {
    root.innerHTML = `<div class="gc-home-empty"><div class="gc-home-empty-icon">${ICON.alert}</div><div><b>Não foi possível carregar a lista</b><p>Tente novamente mais tarde.</p></div></div>`;
    return;
  }

  if (!items.length) {
    root.innerHTML = `<div class="gc-home-empty"><div class="gc-home-empty-icon">${ICON.check}</div><div><b>Nenhum acompanhamento.</b></div></div>`;
    return;
  }

  root.innerHTML = `<div class="gc-home-acomp-list">${items.map((it) => {
    const detail = kind === "ending"
      ? `Termina em ${escHomeHtml(fmtHomeDateShort(it.expiresAt))}`
      : escHomeHtml((it.reasons || []).join(" · ") || "—");
    return `
    <div class="gc-home-acomp-row">
      <div class="gc-home-acomp-info">
        <strong>${escHomeHtml(it.patientName || "Doente")}</strong>
        <span>${detail}</span>
      </div>
      <button type="button" class="gc-home-acomp-open" data-patient-id="${escHomeHtml(it.patientId || "")}" data-prescription-id="${escHomeHtml(it.prescriptionId || "")}">Ver acompanhamento →</button>
    </div>`;
  }).join("")}</div>`;

  root.querySelectorAll("[data-prescription-id]").forEach((btn) => {
    btn.addEventListener("click", () => onOpen?.(
      btn.getAttribute("data-patient-id") || null,
      btn.getAttribute("data-prescription-id") || null
    ));
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

function fmtHomeDateShort(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit" });
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
        ${a.target_url || (a.synthetic && a.patient_id && a.clinic_id) ? `<button type="button" class="gc-home-alert-open" data-alert-open="${escHomeHtml(a.id)}">${a.synthetic ? "Abrir acompanhamento" : "Abrir"}</button>` : ""}
        ${a.resolved_at || a.synthetic ? "" : `<button type="button" class="gc-home-alert-resolve" data-alert-resolve="${escHomeHtml(a.id)}">Resolvido</button>`}
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
      onOpen?.(a?.target_url || null, id, a || null);
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

/* setHomeAcompanhamentoStats — mostra apenas as duas regras aprovadas:
   sinais já usados pela fila de atenção e planos a terminar em menos de 3 dias. */
export function setHomeAcompanhamentoStats(stats) {
  const sub = document.getElementById("gcHomeAcompSub");
  if (sub) sub.textContent = stats?.total != null ? `${stats.total} doentes` : "— doentes";
  const map = {
    gcHomeAcompAcao:     stats?.precisaAcao,
    gcHomeAcompTerminar: stats?.aTerminar,
  };
  Object.entries(map).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = (stats == null || value == null) ? "—" : String(value);
  });
}
