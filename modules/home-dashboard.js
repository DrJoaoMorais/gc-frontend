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
        <div class="gc-home-kpi gc-home-kpi-red"><div class="gc-home-kpi-icon">${ICON.alert}</div><div><b>Urgentes</b><strong>—</strong><span>A ligar aos alertas</span></div></div>
        <div class="gc-home-kpi gc-home-kpi-orange"><div class="gc-home-kpi-icon">${ICON.clock}</div><div><b>Atenção</b><strong>—</strong><span>A ligar aos alertas</span></div></div>
        <div class="gc-home-kpi gc-home-kpi-blue"><div class="gc-home-kpi-icon">${ICON.inbox}</div><div><b>Novos</b><strong>—</strong><span>A ligar aos alertas</span></div></div>
        <div class="gc-home-kpi gc-home-kpi-green"><div class="gc-home-kpi-icon">${ICON.check}</div><div><b>Resolvidos</b><strong>—</strong><span>Hoje</span></div></div>
      </div>

      <div class="gc-home-section-head"><div><h2>Precisa da sua atenção</h2><p>Alertas clínicos e operacionais pendentes</p></div><button type="button">Ver todos</button></div>
      <div class="gc-home-empty">
        <div class="gc-home-empty-icon">${ICON.inbox}</div>
        <div><b>Área preparada para os alertas reais</b><p>Nesta primeira fase não são apresentados dados fictícios de doentes.</p></div>
      </div>

      <div class="gc-home-section-head gc-home-today-head"><div><h2>Hoje</h2><p>Resumo rápido da atividade</p></div></div>
      <div class="gc-home-today">
        <button data-home-action="agenda"><span>${ICON.calendar}</span><b>Agenda</b><small>Abrir consultas de hoje</small><i>→</i></button>
        <div><b>Consultas</b><strong id="gcHomeStatConsultas">—</strong><small>A ligar à agenda</small></div>
        <div><b>Pedidos online</b><strong>—</strong><small>A ligar aos pedidos</small></div>
        <div><b>Consentimentos</b><strong>—</strong><small>A ligar aos pendentes</small></div>
      </div>
    </section>`;
}

export function homeDashboardStyles() {
  return `
.gc-home{max-width:1180px;margin:0 auto;padding:4px 2px 36px}.gc-home-head{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:24px}.gc-home-title{font-size:27px;font-weight:780;letter-spacing:-.6px;color:#0f2d52}.gc-home-sub{margin-top:4px;color:#64748b;font-size:13px}.gc-home-agenda-btn{display:flex;align-items:center;gap:8px;border:1px solid #cbd5e1;background:#fff;color:#0f2d52;border-radius:10px;padding:9px 13px;font:650 13px/1.2 inherit;cursor:pointer}.gc-home-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.gc-home-kpi{background:#fff;border:1px solid #e2e8f0;border-radius:13px;padding:16px;display:flex;gap:13px;min-height:112px;box-shadow:0 1px 3px rgba(15,45,82,.04)}.gc-home-kpi-icon{width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex:0 0 auto}.gc-home-kpi b{display:block;font-size:12px;color:#475569;margin-bottom:3px}.gc-home-kpi strong{display:block;font-size:27px;line-height:1.05;color:#0f172a}.gc-home-kpi span{display:block;font-size:11px;color:#94a3b8;margin-top:7px}.gc-home-kpi-red{border-left:3px solid #dc2626}.gc-home-kpi-red .gc-home-kpi-icon{background:#fef2f2;color:#dc2626}.gc-home-kpi-orange{border-left:3px solid #ea580c}.gc-home-kpi-orange .gc-home-kpi-icon{background:#fff7ed;color:#ea580c}.gc-home-kpi-blue{border-left:3px solid #2563eb}.gc-home-kpi-blue .gc-home-kpi-icon{background:#eff6ff;color:#2563eb}.gc-home-kpi-green{border-left:3px solid #16a34a}.gc-home-kpi-green .gc-home-kpi-icon{background:#f0fdf4;color:#16a34a}.gc-home-section-head{display:flex;align-items:end;justify-content:space-between;margin-top:28px;margin-bottom:10px}.gc-home-section-head h2{font-size:16px;color:#0f2d52;margin:0}.gc-home-section-head p{font-size:11px;color:#94a3b8;margin:3px 0 0}.gc-home-section-head button{border:0;background:transparent;color:#2563eb;font:650 12px inherit;cursor:pointer}.gc-home-empty{background:#fff;border:1px solid #e2e8f0;border-radius:13px;min-height:138px;display:flex;align-items:center;justify-content:center;gap:13px;color:#475569}.gc-home-empty-icon{width:42px;height:42px;border-radius:50%;background:#f1f5f9;color:#64748b;display:flex;align-items:center;justify-content:center}.gc-home-empty b{font-size:13px}.gc-home-empty p{font-size:11px;color:#94a3b8;margin:4px 0 0}.gc-home-today-head{margin-top:24px}.gc-home-today{display:grid;grid-template-columns:1.35fr repeat(3,1fr);gap:12px}.gc-home-today>div,.gc-home-today>button{border:1px solid #e2e8f0;background:#fff;border-radius:12px;padding:14px 16px;text-align:left;min-height:91px;font-family:inherit;color:#0f172a}.gc-home-today>button{cursor:pointer;display:grid;grid-template-columns:auto 1fr auto;grid-template-rows:auto auto;column-gap:10px;align-items:center}.gc-home-today>button span{grid-row:1/3;color:#2563eb}.gc-home-today>button b{font-size:13px}.gc-home-today>button small{grid-column:2;font-size:11px;color:#94a3b8}.gc-home-today>button i{grid-column:3;grid-row:1/3;font-style:normal;color:#2563eb;font-size:18px}.gc-home-today>div b{display:block;font-size:12px;color:#475569}.gc-home-today>div strong{display:block;font-size:22px;margin-top:4px}.gc-home-today>div small{font-size:11px;color:#94a3b8}.gc-home [data-home-action="agenda"]:hover{border-color:#93c5fd;background:#f8fbff}@media(max-width:900px){.gc-home-kpis{grid-template-columns:repeat(2,1fr)}.gc-home-today{grid-template-columns:repeat(2,1fr)}}@media(max-width:600px){.gc-home{padding:2px 0 24px}.gc-home-head{align-items:flex-start}.gc-home-title{font-size:22px}.gc-home-agenda-btn span{display:none}.gc-home-kpis{grid-template-columns:1fr 1fr;gap:9px}.gc-home-kpi{padding:12px;min-height:98px}.gc-home-kpi-icon{display:none}.gc-home-today{grid-template-columns:1fr}.gc-home-empty{padding:22px 16px;justify-content:flex-start}}
  `;
}

export function wireHomeDashboard(onAgenda) {
  document.querySelectorAll('[data-home-action="agenda"]').forEach((el) => el.addEventListener('click', () => onAgenda?.()));
}

export function setHomeDashboardConsultasHoje(value) {
  const el = document.getElementById("gcHomeStatConsultas");
  if (el) el.textContent = value == null ? "—" : String(value);
}
