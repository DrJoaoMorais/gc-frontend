/* =========================================================
   Gestão Clínica V2 — app.js (ficheiro completo)
   Requisitos:
   - window.sb já criado no app.html (Supabase client)
   - /app.html exige sessão; sem sessão -> redirect /index.html
   - Header mínimo: email + botão Logout
   ========================================================= */

(function () {
  "use strict";

  function $(id) {
    return document.getElementById(id);
  }

  function hardRedirect(path) {
    window.location.replace(path);
  }

  function renderApp(user) {
    // Cria UI mínima toda por JS (não exige alterações em app.html)
    document.body.innerHTML = `
      <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 16px;">
        <header style="display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 14px; border:1px solid #e5e5e5; border-radius:12px;">
          <div style="display:flex; flex-direction:column; gap:2px;">
            <div style="font-size:14px; color:#111;">Sessão ativa</div>
            <div style="font-size:12px; color:#666;" id="hdrEmail">—</div>
          </div>
          <button id="btnLogout" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; background:#fff; cursor:pointer;">
            Logout
          </button>
        </header>

        <main style="margin-top:14px; padding:12px 14px; border:1px solid #eee; border-radius:12px;">
          <div style="font-size:14px; color:#111;">App pronta.</div>
          <div style="font-size:12px; color:#666; margin-top:6px;">
            Próximo: agenda do dia (lista) + filtro por clínica.
          </div>
        </main>
      </div>
    `;

    const email = (user && user.email) ? user.email : "—";
    const hdrEmail = $("hdrEmail");
    if (hdrEmail) hdrEmail.textContent = email;

    const btn = $("btnLogout");
    if (btn) {
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        btn.textContent = "A terminar sessão…";
        try {
          const { error } = await window.sb.auth.signOut();
          if (error) throw error;
          hardRedirect("/index.html");
        } catch (e) {
          console.error("Logout falhou:", e);
          btn.disabled = false;
          btn.textContent = "Logout";
          alert("Não foi possível terminar a sessão. Vê a consola para detalhe.");
        }
      });
    }
  }

  async function boot() {
    try {
      if (!window.sb || !window.sb.auth || typeof window.sb.auth.getSession !== "function") {
        console.error("Supabase client não encontrado (window.sb). Confirma app.html.");
        document.body.textContent = "Erro: Supabase client não encontrado (window.sb).";
        return;
      }

      const { data, error } = await window.sb.auth.getSession();
      if (error) throw error;

      const session = data ? data.session : null;
      if (!session || !session.user) {
        hardRedirect("/index.html");
        return;
      }

      renderApp(session.user);
    } catch (e) {
      console.error("Boot falhou:", e);
      document.body.textContent = "Erro ao iniciar a app. Abre a consola para detalhe.";
    }
  }

  // Arranque
  boot();
})();