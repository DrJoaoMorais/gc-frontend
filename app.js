// app.js — BOOTSTRAP LIMPO (SEM LOGIN, SEM REDIRECTS)

(function () {
  // evita execuções duplas
  if (window.__APP_BOOTED) return;
  window.__APP_BOOTED = true;

  function setStatus(msg) {
    const el = document.getElementById("status");
    if (el) el.textContent = msg;
  }

  async function initApp() {
    try {
      console.log("[APP] initApp start");

      if (!window.sb) {
        console.error("[APP] Supabase client (window.sb) não existe");
        setStatus("Erro: Supabase não inicializado.");
        return;
      }

      // Apenas verificar sessão (SEM redirecionar)
      const { data, error } = await window.sb.auth.getSession();
      if (error) {
        console.error("[APP] getSession error:", error);
        setStatus("Erro ao verificar sessão.");
        return;
      }

      if (!data?.session) {
        setStatus("Sem sessão ativa (utilizador não autenticado).");
        console.warn("[APP] sem sessão");
        return;
      }

      // Sessão válida
      setStatus("Sessão ativa. App pronta.");
      console.log("[APP] sessão ativa", data.session.user.email);
    } catch (e) {
      console.error("[APP] crash:", e);
      setStatus("Erro inesperado na aplicação.");
    }
  }

  window.addEventListener("load", () => {
    console.log("[APP] window.load");
    initApp();
  });
})();
