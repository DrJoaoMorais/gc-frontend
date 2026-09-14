/* ========================================================
   SHELL.JS — Render HTML + CSS principal da aplicação
   --------------------------------------------------------
   03F — Render shell
      03F.1  renderAppShell()

   03G — Header shell
      03G.1  hydrateShellHeader()
   ======================================================== */

import { agendaWorkspaceHTML, agendaWorkspaceStyles } from './agenda-workspace.js';
import { G } from "./state.js";
import { UI } from "./config.js";
import { injectDesignSystem } from "./ui.js";
import { homeDashboardHtml, homeDashboardStyles, wireHomeDashboard } from "./home-dashboard.js";

/* ==== 03F — Render shell (HTML + CSS) ==== */

/* ---- 03F.1 — renderAppShell ---- */
export function renderAppShell() {
  injectDesignSystem();
  const canSeeManagement = ["super_admin", "admin"].includes(String(G.role || "").toLowerCase());
  const currentView = String(G.currentView || "agenda").toLowerCase();

  /* ── Ícones SVG ─────────────────────────────────── */
  const iconHome = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2F9BFF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-8H9v8H4a1 1 0 0 1-1-1Z"/></svg>`;
  const iconAgenda = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#35C2F4" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18M8 15h.01M12 15h.01M16 15h.01M8 18h.01M12 18h.01M16 18h.01"/></svg>`;
  const iconDoentes = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2CCFA7" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="4"/><path d="M2 21v-2a7 7 0 0 1 14 0v2M17 4a4 4 0 0 1 0 8M22 21v-2a7 7 0 0 0-4-6"/></svg>`;
  const iconHistorico = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFC35A" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11a9 9 0 1 1 2.7 7.3M3 4v7h7M12 7v5l3 2"/></svg>`;
  const iconGestaAgenda = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#A978F5" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6M8 3v4M16 3v4M3 11h10"/><circle cx="17" cy="17" r="5"/><path d="M17 14v3l2 1"/></svg>`;
  const iconGestao = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C49AFF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><g transform="translate(1 0)"><path d="m9 3-.5 2-1.7 1L4.8 5.5l-2 3.5 1.5 1.5v3L2.8 15l2 3.5 2-.5 1.7 1 .5 2h4l.5-2 1.7-1 2 .5 2-3.5-1.5-1.5v-3L19.2 9l-2-3.5-2 .5-1.7-1-.5-2Z"/><circle cx="11" cy="12" r="3"/></g></svg>`;
  const iconLogout   = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9FB3CA" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M9 12h12m-5-5 5 5-5 5"/></svg>`;
  const iconFinancas = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F4C95D" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18M7 17v-5M12 17V8M17 17V5"/></svg>`;
  const iconExercicio = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7CCB45" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="4" height="12" rx="1"/><rect x="17" y="6" width="4" height="12" rx="1"/><path d="M7 12h10M1 9v6M23 9v6"/></svg>`;

  const navItems = [
    { id: "home",          icon: iconHome,         label: "Início" },
    { id: "agenda",        icon: iconAgenda,       label: "Agenda" },
    { id: "gestaoagenda",  icon: iconGestaAgenda,  label: "Gestão de agenda" },
    { id: "doentes",       icon: iconDoentes,      label: "Doentes" },
    { id: "historico",     icon: iconHistorico,    label: "Histórico" },
    { id: "exercicio",     icon: iconExercicio,    label: "Exercício" },
    ...(canSeeManagement ? [{ id: "financas",   icon: iconFinancas,  label: "Rendimentos" }] : []),
    ...(canSeeManagement ? [{ id: "management", icon: iconGestao,    label: "Gestão" }] : []),
  ];

  /* ── Conteúdo por vista ─────────────────────────── */
  let mainHtml = "";

  if (currentView === "home") {
    mainHtml = `<style>${homeDashboardStyles()}</style>${homeDashboardHtml()}`;
  } else if (currentView === "financas") {
    mainHtml = `<div id="gcFinancasRoot"></div>`;
  } else if (currentView === "management") {
    mainHtml = ``;
  } else if (currentView === "doentes") {
    mainHtml = `
      <div class="gc-page-header">
        <div><div class="gc-page-title">Doentes</div><div class="gc-page-sub">Pesquise e aceda ao panorama clínico</div></div>
        <button id="btnNewPatientMain" class="gcBtnPrimary">＋ Novo doente</button>
      </div>
      <div class="gc-search-bar" style="margin-top:14px;">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5.5" stroke="#94a3b8" stroke-width="1.4"/><path d="M11 11l3 3" stroke="#94a3b8" stroke-width="1.4" stroke-linecap="round"/></svg>
        <input id="pQuickQuery" type="search" placeholder="Nome, SNS, NIF, Telefone..." autocomplete="off" spellcheck="false" class="gc-search-input"/>
      </div>
      <div id="pQuickResults" style="margin-top:6px;"></div>
    `;
  } else if (currentView === "doente-panorama") {
    mainHtml = `<div id="gcDoentePanoramaRoot"></div>`;
  } else if (currentView === "historico") {
    mainHtml = `
      <div class="gc-page-header">
        <div><div class="gc-page-title">Histórico</div><div class="gc-page-sub">Últimos documentos e actividade</div></div>
      </div>
      <div class="gc-muted" style="margin-top:40px;text-align:center;padding:40px 0;">Em construção — disponível em breve.</div>
    `;
  } else if (currentView === "exercicio") {
    mainHtml = `<div id="gcwoPrescricaoRoot"></div>`;
  } else if (currentView === "gestaoagenda") {
    mainHtml = `<div id="gcGestaoAgendaRoot"></div>`;
  } else if (currentView === "exercicio-acompanhamento") {
    mainHtml = `<div id="gcExFollowRoot"></div>`;
  } else {
    mainHtml = `<style>${agendaWorkspaceStyles()}</style>${agendaWorkspaceHTML()}`;
  }

  /* ── HTML completo ──────────────────────────────────── */
  document.body.innerHTML = `
<style>
*,*::before,*::after{box-sizing:border-box;}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f0f4f8;color:#0f172a;font-size:14px;}
.gc-app{display:flex;height:100vh;overflow:hidden;}

/* SIDEBAR */
.gc-sidebar{width:56px;background:#0f2d52;display:flex;flex-direction:column;align-items:center;flex-shrink:0;position:relative;z-index:500;}
.gc-sidebar-logo{width:56px;height:56px;display:flex;align-items:center;justify-content:center;border-bottom:1px solid rgba(255,255,255,0.08);flex-shrink:0;}
.gc-logo-text{font-size:15px;font-weight:800;color:#fff;letter-spacing:-0.5px;}
.gc-sidebar-nav{flex:1;display:flex;flex-direction:column;align-items:center;padding:8px 0;gap:2px;width:100%;}
.gc-sidebar-bottom{width:56px;display:flex;flex-direction:column;align-items:center;padding:8px 0 12px;border-top:1px solid rgba(255,255,255,0.08);}
.gc-nav-btn{width:100%;height:48px;display:flex;align-items:center;justify-content:center;background:transparent;border:none;border-left:3px solid transparent;color:rgba(255,255,255,0.45);cursor:pointer;transition:all 0.15s;margin-left:-3px;padding:0;position:relative;font-family:inherit;}
.gc-nav-btn:hover{color:rgba(255,255,255,0.85);background:rgba(255,255,255,0.05);}
.gc-nav-btn.active{background:rgba(255,255,255,0.10);border-left-color:#4a9eff;color:#fff;}
.gc-nav-btn::after{content:attr(title);position:absolute;left:62px;top:50%;transform:translateY(-50%);background:#1e293b;color:#fff;font-size:12px;font-weight:500;padding:5px 10px;border-radius:6px;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity 0.15s;z-index:600;}
.gc-nav-btn:hover::after{opacity:1;}

/* MAIN */
.gc-main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0;}

/* TOPBAR */
.gc-topbar{height:52px;background:#fff;border-bottom:0.5px solid #e2e8f0;display:flex;align-items:center;padding:0 20px;gap:12px;flex-shrink:0;}
.gc-topbar-logo{height:36px;width:auto;object-fit:contain;flex-shrink:0;}
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
/* gcBtn/gcBtnPrimary definidos em ui.js — ver injectDesignSystem() */
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
      <img src="/assets/logo.png" class="gc-topbar-logo" alt="Logótipo João Morais">
      <span class="gc-topbar-user" id="hdrEmail"></span>
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

  /* ── Wire Home dashboard actions (mesmo mecanismo de navegação) ───── */
  if (currentView === "home") {
    wireHomeDashboard(async () => {
      /* Copia o scope de clínica do Home (seletor próprio) só neste
         momento de navegação explícita — nunca sincronizado fora daqui. */
      const homeClinicSel = document.getElementById("gcHomeClinicSelect");
      G.activeClinicId = homeClinicSel?.value || null;
      G.currentView = "agenda";
      if (typeof window.__gc_renderCurrentView === "function") {
        await window.__gc_renderCurrentView();
      } else {
        renderAppShell();
        hydrateShellHeader();
      }
    });
  }

  window.__gc_renderAppShell = renderAppShell;
}


/* ==== 03G — Header shell ==== */

export function hydrateShellHeader() {
  const hdrEmail = document.getElementById("hdrEmail");
  if (hdrEmail) hdrEmail.textContent = G.sessionUser?.email || "";

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
