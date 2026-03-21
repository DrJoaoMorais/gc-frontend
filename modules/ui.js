// modules/ui.js
// Design system unificado — botões, modais, inputs
// Importar em shell.js: import { injectDesignSystem } from './ui.js';

export function injectDesignSystem() {
  if (document.getElementById("gc-design-system")) return;
  const style = document.createElement("style");
  style.id = "gc-design-system";
  style.textContent = `
/* ── Botões — base ───────────────────────────────────── */
.gcBtn,.gcBtnPrimary,.gcBtnSuccess,.gcBtnDanger,.gcBtnOutline,.gcBtnGhost {
  display:inline-flex;align-items:center;justify-content:center;gap:6px;
  padding:0 14px;height:34px;border-radius:8px;font-size:13px;font-weight:500;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;
  cursor:pointer;border:none;transition:background 0.13s,opacity 0.13s,transform 0.1s;
  white-space:nowrap;line-height:1;text-decoration:none;vertical-align:middle;
}
.gcBtn:active,.gcBtnPrimary:active,.gcBtnSuccess:active,
.gcBtnDanger:active,.gcBtnOutline:active,.gcBtnGhost:active{transform:scale(0.97);opacity:0.88;}
.gcBtn:disabled,.gcBtnPrimary:disabled,.gcBtnSuccess:disabled,
.gcBtnDanger:disabled,.gcBtnOutline:disabled,.gcBtnGhost:disabled{opacity:0.45;cursor:not-allowed;transform:none;}

/* Ghost — fechar, secundário, navegação ◀ ▶ */
.gcBtn{background:transparent;color:#374151;border:0.5px solid #d1d5db;}
.gcBtn:hover:not(:disabled){background:#f3f4f6;border-color:#9ca3af;}

/* Primário — criar, agendar, novo doente */
.gcBtnPrimary{background:#1a56db;color:#fff;}
.gcBtnPrimary:hover:not(:disabled){background:#1447c0;}

/* Sucesso — gravar, guardar, confirmar */
.gcBtnSuccess{background:#0f9d58;color:#fff;}
.gcBtnSuccess:hover:not(:disabled){background:#0d8a4e;}

/* Perigo — apagar, registar falta, eliminar */
.gcBtnDanger{background:#dc2626;color:#fff;}
.gcBtnDanger:hover:not(:disabled){background:#b91c1c;}

/* Outline — imprimir, exportar, PDF, vista */
.gcBtnOutline{background:transparent;color:#1a56db;border:1.5px solid #1a56db;}
.gcBtnOutline:hover:not(:disabled){background:#eff4ff;}

/* Ghost explícito — cancelar, fechar */
.gcBtnGhost{background:transparent;color:#6b7280;border:0.5px solid #d1d5db;}
.gcBtnGhost:hover:not(:disabled){background:#f3f4f6;color:#374151;}

/* Tamanhos */
.gcBtnSm{height:28px;padding:0 10px;font-size:12px;border-radius:6px;}
.gcBtnLg{height:40px;padding:0 20px;font-size:14px;}
.gcBtnIcon{width:34px;padding:0;}
.gcBtnIcon.gcBtnSm{width:28px;}
  `;
  document.head.appendChild(style);
}
