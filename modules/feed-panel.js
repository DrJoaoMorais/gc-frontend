/* ========================================================
   FEED-PANEL.JS — Painel iframe isolado do feed do doente
   --------------------------------------------------------
   Passo 2/6 — painel isolado, sem ligação à agenda.
   Chamada apenas manual (consola / botão temporário) por agora.
   ======================================================== */

const FEED_DOENTE_URL = "/modules/consulta/v2/consulta-completa/feed-doente.html";

/* ---- openFeedPanel ----
   Cria (ou reaproveita) um iframe no espaço de conteúdo do shell
   e carrega feed-doente.html para o doente/clínica indicados.
   Sem sandbox — o feed precisa de aceder a window.parent/Supabase normalmente. */
export function openFeedPanel(patientId, sessionClinicId) {
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

  iframe.src = `${FEED_DOENTE_URL}?${params.toString()}`;
  return iframe;
}
