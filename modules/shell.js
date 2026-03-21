/* ========================================================
   SHELL.JS — Render HTML + CSS principal da aplicação
   --------------------------------------------------------
   03F — Render shell
      03F.1  renderAppShell()

   03G — Header shell
      03G.1  hydrateShellHeader()
   ======================================================== */

import { G } from "./state.js";
import { UI } from "./config.js";

/* ==== 03F — Render shell (HTML + CSS) ==== */

/* ---- 03F.1 — renderAppShell ---- */
export function renderAppShell() {
  const canSeeManagement = ["super_admin", "admin"].includes(String(G.role || "").toLowerCase());
  const currentView = String(G.currentView || "agenda").toLowerCase();

  /* ── Ícones SVG ─────────────────────────────────── */
  const iconAgenda = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="3" width="16" height="15" rx="2.5" stroke="currentColor" stroke-width="1.6"/><path d="M2 8h16M7 1v4M13 1v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M6 12h2M9.5 12h2M13 12h2M6 15h2M9.5 15h2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`;
  const iconDoentes = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="7" r="4" stroke="currentColor" stroke-width="1.6"/><path d="M3 18c0-3.866 3.134-6 7-6s7 2.134 7 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
  const iconHistorico = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7.5" stroke="currentColor" stroke-width="1.6"/><path d="M10 6v4.5l3 2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const iconGestao = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="2.5" stroke="currentColor" stroke-width="1.5"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
  const iconLogout   = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><polyline points="16 17 21 12 16 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const iconFinancas = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="5" width="16" height="12" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M2 9h16" stroke="currentColor" stroke-width="1.6"/><path d="M6 13h2M10 13h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M6 3h8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;

  const navItems = [
    { id: "agenda",     icon: iconAgenda,    label: "Agenda" },
    { id: "doentes",    icon: iconDoentes,   label: "Doentes" },
    { id: "historico",  icon: iconHistorico, label: "Histórico" },
    ...(canSeeManagement ? [{ id: "financas",   icon: iconFinancas,  label: "Rendimentos" }] : []),
    ...(canSeeManagement ? [{ id: "management", icon: iconGestao,    label: "Gestão" }] : []),
  ];

  /* ── Conteúdo por vista ─────────────────────────── */
  let mainHtml = "";

  if (currentView === "financas") {
    mainHtml = `<div id="gcFinancasRoot"></div>`;
  } else if (currentView === "management") {
    mainHtml = `
      <div class="gc-page-header">
        <div>
          <div class="gc-page-title">Gestão</div>
          <div class="gc-page-sub">Clínicas, utilizadores e estatísticas</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-top:16px;">
        <div class="gc-stat-card"><div class="gc-stat-label">Clínicas</div><div class="gc-stat-value" id="hdrClinicCount">0</div></div>
        <div class="gc-stat-card"><div class="gc-stat-label">Produção</div><div class="gc-stat-value" style="font-size:15px;color:#94a3b8;">Em breve</div></div>
        <div class="gc-stat-card"><div class="gc-stat-label">Receita</div><div class="gc-stat-value" style="font-size:15px;color:#94a3b8;">Em breve</div></div>
      </div>
    `;
  } else if (currentView === "doentes") {
    mainHtml = `
      <div class="gc-page-header">
        <div><div class="gc-page-title">Doentes</div><div class="gc-page-sub">Pesquise e aceda ao feed clínico</div></div>
        <button id="btnNewPatientMain" class="gc-btn-primary">＋ Novo doente</button>
      </div>
      <div class="gc-search-bar" style="margin-top:14px;">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5.5" stroke="#94a3b8" stroke-width="1.4"/><path d="M11 11l3 3" stroke="#94a3b8" stroke-width="1.4" stroke-linecap="round"/></svg>
        <input id="pQuickQuery" type="search" placeholder="Nome, SNS, NIF, Telefone..." autocomplete="off" spellcheck="false" class="gc-search-input"/>
      </div>
      <div id="pQuickResults" style="margin-top:6px;"></div>
    `;
  } else if (currentView === "historico") {
    mainHtml = `
      <div class="gc-page-header">
        <div><div class="gc-page-title">Histórico</div><div class="gc-page-sub">Últimos documentos e actividade</div></div>
      </div>
      <div class="gc-muted" style="margin-top:40px;text-align:center;padding:40px 0;">Em construção — disponível em breve.</div>
    `;
  } else {
    /* ── AGENDA ──────────────────────────────────────── */
    mainHtml = `
      <div class="gc-page-header">
        <div>
          <div class="gc-page-title">Agenda</div>
          <div class="gc-page-sub" id="agendaSubtitle">—</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <button id="btnCal"   class="gc-btn">Calendário</button>
          <button id="btnWeek"  class="gc-btn">Semana</button>
          <button id="btnToday" class="gc-btn">Hoje</button>
          <button id="btnNewAppt" class="gc-btn-primary">＋ Agendar</button>
          ${canSeeManagement ? `<button id="btnNewPresenca" class="gc-btn" style="background:#064e3b;color:#fff;border-color:#064e3b;">＋ Presença</button>` : ""}
          <button id="btnNewPatientMain" class="gc-btn">＋ Novo doente</button>
        </div>
      </div>

      <div id="agendaStats" style="margin-top:14px;display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;"></div>

      <div class="gc-toolbar" style="margin-top:14px;">
        <div class="gc-search-bar" style="flex:1;min-width:260px;max-width:520px;">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5.5" stroke="#94a3b8" stroke-width="1.4"/><path d="M11 11l3 3" stroke="#94a3b8" stroke-width="1.4" stroke-linecap="round"/></svg>
          <input id="pQuickQuery" type="search" placeholder="Pesquisar doente — Nome, SNS, NIF..." autocomplete="off" spellcheck="false" class="gc-search-input"/>
        </div>
        <select id="selClinic" class="gc-select" style="min-width:180px;"></select>
      </div>

      <div id="pQuickResults" style="margin-top:6px;border:0.5px solid #e2e8f0;border-radius:10px;background:#fff;max-height:200px;overflow:auto;display:none;padding:8px;"></div>

      <div id="agendaStatus" style="margin-top:8px;"></div>

      <div style="margin-top:14px;">
        <ul id="agendaList" style="list-style:none;padding:0;margin:0;"></ul>
      </div>
    `;
  }

  /* ── HTML completo ──────────────────────────────────── */
  document.body.innerHTML = `
<style>
*,*::before,*::after{box-sizing:border-box;}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f0f4f8;color:#0f172a;font-size:14px;}
.gc-app{display:flex;height:100vh;overflow:hidden;}

/* SIDEBAR */
.gc-sidebar{width:56px;background:#0f2d52;display:flex;flex-direction:column;align-items:center;flex-shrink:0;z-index:10;}
.gc-sidebar-logo{width:56px;height:56px;display:flex;align-items:center;justify-content:center;border-bottom:1px solid rgba(255,255,255,0.08);flex-shrink:0;}
.gc-logo-text{font-size:15px;font-weight:800;color:#fff;letter-spacing:-0.5px;}
.gc-sidebar-nav{flex:1;display:flex;flex-direction:column;align-items:center;padding:8px 0;gap:2px;width:100%;}
.gc-sidebar-bottom{width:56px;display:flex;flex-direction:column;align-items:center;padding:8px 0 12px;border-top:1px solid rgba(255,255,255,0.08);}
.gc-nav-btn{width:100%;height:48px;display:flex;align-items:center;justify-content:center;background:transparent;border:none;border-left:3px solid transparent;color:rgba(255,255,255,0.45);cursor:pointer;transition:all 0.15s;margin-left:-3px;padding:0;position:relative;font-family:inherit;}
.gc-nav-btn:hover{color:rgba(255,255,255,0.85);background:rgba(255,255,255,0.05);}
.gc-nav-btn.active{background:rgba(255,255,255,0.10);border-left-color:#4a9eff;color:#fff;}
.gc-nav-btn::after{content:attr(title);position:absolute;left:62px;top:50%;transform:translateY(-50%);background:#1e293b;color:#fff;font-size:12px;font-weight:500;padding:5px 10px;border-radius:6px;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity 0.15s;z-index:200;}
.gc-nav-btn:hover::after{opacity:1;}

/* MAIN */
.gc-main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0;}

/* TOPBAR */
.gc-topbar{height:52px;background:#fff;border-bottom:0.5px solid #e2e8f0;display:flex;align-items:center;padding:0 20px;gap:12px;flex-shrink:0;}
.gc-topbar-user{font-size:13px;font-weight:600;color:#0f2d52;}
.gc-topbar-role{font-size:11.5px;color:#94a3b8;}
.gc-topbar-spacer{flex:1;}
.gc-topbar-clinics{font-size:11.5px;color:#64748b;background:#f1f5f9;padding:3px 10px;border-radius:20px;border:0.5px solid #e2e8f0;}

/* CONTENT */
.gc-content{flex:1;overflow-y:auto;padding:20px;}

/* PAGE HEADER */
.gc-page-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;}
.gc-page-title{font-size:18px;font-weight:700;color:#0f2d52;line-height:1.2;}
.gc-page-sub{font-size:12.5px;color:#64748b;margin-top:3px;}

/* STAT CARD */
.gc-stat-card{background:#fff;border:0.5px solid #e2e8f0;border-radius:10px;padding:12px 14px;}
.gc-stat-label{font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;}
.gc-stat-value{font-size:22px;font-weight:700;color:#0f2d52;margin-top:4px;line-height:1;}
.gc-stat-sub{font-size:11.5px;color:#64748b;margin-top:3px;}

/* TOOLBAR */
.gc-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}

/* SEARCH */
.gc-search-bar{display:flex;align-items:center;gap:10px;background:#fff;border:0.5px solid #e2e8f0;border-radius:10px;padding:9px 14px;}
.gc-search-input{border:none;outline:none;font-size:13px;color:#0f172a;background:transparent;flex:1;min-width:0;font-family:inherit;}
.gc-search-input::placeholder{color:#94a3b8;}

/* AGENDA CARD */
.gc-agenda-card{background:#fff;border:0.5px solid #e2e8f0;border-radius:12px;overflow:hidden;}

/* AGENDA HEADER ROW */
.gc-agenda-header-row{display:grid;grid-template-columns:90px 1fr 160px 160px 110px;padding:9px 16px;background:#f8fafc;border-bottom:0.5px solid #e2e8f0;gap:12px;}
.gc-agenda-col-label{font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;}

/* AGENDA ROW */
.gcAgendaGrid{display:grid;grid-template-columns:110px 2.4fr 0.9fr 160px 120px 140px;column-gap:16px;align-items:center;width:100%;}
.gcAgendaHeader .gcAgendaH{font-size:12px;color:#94a3b8;font-weight:700;letter-spacing:.2px;}
.gcAgendaRow{padding:10px 0;border-bottom:0.5px solid #f1f5f9;transition:background 0.1s;}
.gcAgendaRow:hover{background:#f8faff;border-radius:10px;}
.gcAgendaTime{font-size:14px;font-weight:800;color:#0f2d52;white-space:nowrap;}
.gcAgendaNameWrap{min-width:0;}
.gcAgendaNameText{display:block;min-width:0;font-size:14px;font-weight:700;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;}
.gcAgendaNameText:hover{color:#1a56db;text-decoration:underline;}
.gcAgendaNotesBelow{display:block;margin-top:4px;font-size:12px;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.gcAgendaCell{min-width:0;font-size:12px;color:#475569;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.gcAgendaCellType{padding-left:8px;}
.gcAgendaStatusWrap{min-width:0;position:relative;}
.gcAgendaFooter{margin-top:12px;padding-top:12px;border-top:1px dashed #e2e8f0;display:flex;justify-content:flex-end;}

/* STATUS SELECT (legado) */
.gcStatusSelect{appearance:none;border-radius:999px;border:0.5px solid transparent;padding:5px 30px 5px 10px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;background-image:linear-gradient(45deg,transparent 50%,currentColor 50%),linear-gradient(135deg,currentColor 50%,transparent 50%);background-position:calc(100% - 14px) 55%,calc(100% - 8px) 55%;background-size:5px 5px,5px 5px;background-repeat:no-repeat;}
.gcStatusSelect:disabled{opacity:0.7;cursor:not-allowed;}

/* BUTTONS */
.gc-btn{padding:8px 14px;border-radius:8px;border:0.5px solid #e2e8f0;background:#fff;color:#0f172a;font-size:13px;font-weight:500;cursor:pointer;white-space:nowrap;font-family:inherit;transition:background 0.12s;}
.gc-btn:hover{background:#f8fafc;}
.gc-btn:disabled{opacity:0.55;cursor:not-allowed;}
.gc-btn-primary{padding:8px 16px;border-radius:8px;border:none;background:#1a56db;color:#fff;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;font-family:inherit;transition:filter 0.12s;}
.gc-btn-primary:hover{filter:brightness(0.92);}
.gc-btn-primary:disabled{opacity:0.55;cursor:not-allowed;}

/* Compatibilidade com legado */
.gcBtn{padding:8px 14px;border-radius:8px;border:0.5px solid #e2e8f0;background:#fff;color:#0f172a;font-size:13px;font-weight:500;cursor:pointer;font-family:inherit;}
.gcBtnPrimary{padding:8px 16px;border-radius:8px;border:none;background:#1a56db;color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;}
.gcBtnPrimary:hover{filter:brightness(0.92);}
.gcSelect{padding:8px 12px;border-radius:8px;border:0.5px solid #e2e8f0;background:#fff;font-size:13px;color:#0f172a;font-family:inherit;}
.gc-select{padding:8px 12px;border-radius:8px;border:0.5px solid #e2e8f0;background:#fff;font-size:13px;color:#0f172a;font-family:inherit;}
.gcLabel{font-size:12px;color:#64748b;}
.gcCard{background:#fff;border:0.5px solid #e2e8f0;border-radius:12px;padding:16px;}
.gcMutedCard{background:#f8fafc;border:0.5px solid #e2e8f0;border-radius:10px;padding:12px 14px;}
.gc-muted{font-size:13px;color:#94a3b8;}

/* MODAL ROOT */
#modalRoot{position:fixed;inset:0;z-index:1000;pointer-events:none;}
#modalRoot:not(:empty){pointer-events:auto;}

@media(max-width:768px){
  .gcAgendaGrid{grid-template-columns:90px 1fr 140px;}
  .gcAgendaCellType,.gcAgendaCell:nth-child(5),.gcAgendaCell:nth-child(6){display:none;}
}
</style>

<div class="gc-app">

  <!-- SIDEBAR -->
  <aside class="gc-sidebar">
    <div class="gc-sidebar-logo">
      <span class="gc-logo-text">JM</span>
    </div>
    <nav class="gc-sidebar-nav">
      ${navItems.map(item => `
        <button class="gc-nav-btn${currentView === item.id ? " active" : ""}" data-nav="${item.id}" title="${item.label}">${item.icon}</button>
      `).join("")}
    </nav>
    <div class="gc-sidebar-bottom">
      <button class="gc-nav-btn" id="btnLogout" title="Logout">${iconLogout}</button>
    </div>
  </aside>

  <!-- MAIN -->
  <div class="gc-main">

    <!-- TOPBAR -->
    <header class="gc-topbar">
      <span class="gc-topbar-user" id="hdrEmail">Dr. João Morais</span>
      <span class="gc-topbar-role" id="hdrRole"></span>
      <div class="gc-topbar-spacer"></div>
      <span class="gc-topbar-clinics"><span id="hdrClinicCount">0</span> clínicas</span>
    </header>

    <!-- CONTENT -->
    <main class="gc-content">
      ${mainHtml}
    </main>

  </div>

  <!-- MODAL ROOT -->
  <div id="modalRoot"></div>

</div>
  `;

  /* ── Wire sidebar navigation ─────────────────────── */
  document.querySelectorAll("[data-nav]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const view = btn.getAttribute("data-nav");
      G.currentView = view;
      // Usa renderCurrentView do boot.js que reconstrói o DOM E rewirea todos os botões
      if (typeof window.__gc_renderCurrentView === "function") {
        await window.__gc_renderCurrentView();
      } else {
        // Fallback se boot ainda não registou
        renderAppShell();
        hydrateShellHeader();
      }
    });
  });

  window.__gc_renderAppShell = renderAppShell;
}


/* ==== 03G — Header shell ==== */

export function hydrateShellHeader() {
  const hdrEmail = document.getElementById("hdrEmail");
  if (hdrEmail) hdrEmail.textContent = G.sessionUser?.email || "Dr. João Morais";

  const hdrRole = document.getElementById("hdrRole");
  const roleLabels = {
    super_admin:    "SUPERADMINISTRADOR",
    admin:          "Administrador",
    medico:         "Médico",
    fisioterapeuta: "Fisioterapeuta",
    administrativo: "Administrativo",
  };
  if (hdrRole) hdrRole.textContent = G.role ? `· ${roleLabels[G.role] || G.role}` : "";

  const hdrClinicCount = document.getElementById("hdrClinicCount");
  if (hdrClinicCount) hdrClinicCount.textContent = String(Array.isArray(G.clinics) ? G.clinics.length : 0);
}

window.__gc_hydrateShellHeader = hydrateShellHeader;
