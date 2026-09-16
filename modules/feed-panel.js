import { G } from './state.js';
import { canAccessExercise } from './exercicio/permissoes.js';

/* ========================================================
   FEED-PANEL.JS — Painel iframe isolado do feed do doente
   --------------------------------------------------------
   Passo 2/6 — painel isolado, sem ligação à agenda.
   Chamada apenas manual (consola / botão temporário) por agora.
   ======================================================== */


function allowCareNavigation() {
  const frame = document.getElementById('gcFeedPanelIframe');
  return frame?.contentWindow?.__gc_canLeaveCare?.() !== false;
}

function selectPanelNavigation(view) {
  G.currentView = view;
  document.querySelectorAll('[data-nav]').forEach(button => {
    const active = button.dataset.nav === view;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
}

export async function openAcompanhamentoList() {
  if (!allowCareNavigation()) return false;
  if (typeof window.__gc_renderCurrentView !== 'function') return false;
  const view = canAccessExercise() ? 'home' : 'doentes';
  G._exerciseLaunch = null;
  selectPanelNavigation(view);
  await window.__gc_renderCurrentView();
  document.getElementById('gcExerciseHome')?.scrollIntoView({block:'start'});
  return true;
}

const FEED_DOENTE_URL = "/modules/consulta/v2/consulta-completa/feed-doente.html";

/* ---- openFeedPanel ----
   Cria (ou reaproveita) um iframe no espaço de conteúdo do shell
   e carrega feed-doente.html para o doente/clínica indicados.
   Sem sandbox — o feed precisa de aceder a window.parent/Supabase normalmente. */
export function openFeedPanel(patientId, sessionClinicId, options = {}) {
  if (!allowCareNavigation()) return null;
  const content = document.querySelector(".gc-content");
  if (!content) return null;

  let iframe = document.getElementById("gcFeedPanelIframe");
  if (!iframe) {
    iframe = document.createElement("iframe");
    iframe.id = "gcFeedPanelIframe";
    iframe.style.width  = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "none";
    iframe.style.display = "block";
    content.innerHTML = "";
    content.appendChild(iframe);
  }

  const params = new URLSearchParams();
  if (patientId)       params.set("patientId", patientId);
  if (sessionClinicId) params.set("sessionClinicId", sessionClinicId);

  if (options.fromCare) selectPanelNavigation("doentes");
  content.scrollTop = 0;
  iframe.src = `${FEED_DOENTE_URL}?${params.toString()}`;
  return iframe;
}

const ACOMPANHAMENTO_URL = "/modules/acompanhamento-clinico.html?v=2026-09-15-navigation";

/* ---- openAcompanhamentoPanel ----
   Mesmo iframe/mecanismo do openFeedPanel, mas reabre directamente a área de
   Acompanhamento do doente — usado para o botão "voltar" a partir de um fluxo
   de prescrição lançado por lá (ex: Exercícios por patologia), já que entrar
   nesse fluxo troca G.currentView e destrói o iframe original do feed. */
export function openAcompanhamentoPanel(patientId, clinicId, options = {}) {
  if (!patientId || !clinicId || !allowCareNavigation()) return null;
  const content = document.querySelector(".gc-content");
  if (!content) return null;

  let iframe = document.getElementById("gcFeedPanelIframe");
  if (!iframe) {
    iframe = document.createElement("iframe");
    iframe.id = "gcFeedPanelIframe";
    iframe.style.width  = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "none";
    iframe.style.display = "block";
    content.innerHTML = "";
    content.appendChild(iframe);
  }

  const params = new URLSearchParams();
  if (patientId) params.set("patientId", patientId);
  if (clinicId)  params.set("clinicId", clinicId);

  if (['blank', 'pathology', 'previous', 'catalog'].includes(options.mode)) params.set('mode', options.mode);
  selectPanelNavigation(canAccessExercise() ? 'home' : 'doentes');
  content.scrollTop = 0;
  iframe.src = `${ACOMPANHAMENTO_URL}&${params.toString()}`;
  return iframe;
}
