// app.js — PRODUÇÃO (redirect para /index.html se não houver sessão)
//         + MODO DEBUG (opcional) via ?debug=1

(function () {
  if (window.__APP_BOOTED) return;
  window.__APP_BOOTED = true;

  function setStatus(msg) {
    const el = document.getElementById("status");
    if (el) el.textContent = msg;
  }

  function isDebug() {
    try {
      return new URLSearchParams(window.location.search).get("debug") === "1";
    } catch (_) {
      return false;
    }
  }

  async function initApp() {
    try {
      console.log("[APP] initApp start");

      if (!window.sb) {
        console.error("[APP] Supabase client (window.sb) não existe");
        setStatus("Erro: Supabase não inicializado.");
        return;
      }

      setStatus("A verificar sessão…");

      const { data, error } = await window.sb.auth.getSession();
      if (error) {
        console.error("[APP] getSession error:", error);
        setStatus("Erro ao verificar sessão.");
        return;
      }

      const session = data?.session || null;

      if (!session) {
        if (isDebug()) {
          console.warn("[APP] sem sessão (DEBUG, sem redirect)");
          setStatus("Sem sessão ativa (utilizador não autenticado).");
          return;
        }

        console.warn("[APP] sem sessão — redirect para /index.html");
        window.location.replace("/index.html");
        return;
      }

      // Sessão válida
      console.log("[APP] sessão ativa", session.user?.email || "(sem email)");
      setStatus("Sessão ativa. App pronta.");
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
