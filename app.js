/* =========================================================
   Gestão Clínica V2 — app.js (ficheiro completo)
   - Requer window.sb criado no app.html
   - /app.html exige sessão; sem sessão -> /index.html
   - Header mínimo: email + role + nº clínicas + Logout
   ========================================================= */

(function () {
  "use strict";

  function hardRedirect(path) {
    window.location.replace(path);
  }

  async function fetchMyRole(userId) {
    // RLS atual permite SELECT apenas da linha do próprio utilizador em clinic_members
    // Vamos buscar a role “principal” do utilizador.
    const { data, error } = await window.sb
      .from("clinic_members")
      .select("role, clinic_id, is_active")
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(1);

    if (error) throw error;
    if (!data || data.length === 0) return null;
    return data[0].role || null;
  }

  async function fetchVisibleClinics() {
    // RLS em clinics garante que só devolve clínicas onde o user é membro ativo
    const { data, error } = await window.sb
      .from("clinics")
      .select("id, name, slug")
      .order("name", { ascending: true });

    if (error) throw error;
    return Array.isArray(data) ? data : [];
  }

  function renderApp({ email, role, clinics }) {
    const roleLabel = role ? role : "—";
    const clinicCount = clinics.length;

    document.body.innerHTML = `
      <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 16px;">
        <header style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding:12px 14px; border:1px solid #e5e5e5; border-radius:12px;">
          <div style="display:flex; flex-direction:column; gap:4px; min-width: 240px;">
            <div style="font-size:14px; color:#111; font-weight:600;">Sessão ativa</div>
            <div style="font-size:12px; color:#444;"><span style="color:#666;">Email:</span> ${escapeHtml(email || "—")}</div>
            <div style="font-size:12px; color:#444;"><span style="color:#666;">Role:</span> ${escapeHtml(roleLabel)}</div>
            <div style="font-size:12px; color:#444;"><span style="color:#666;">Clínicas:</span> ${clinicCount}</div>
          </div>

          <button id="btnLogout" style="padding:10px 12px; border-radius:10px; border:1px solid #ddd; background:#fff; cursor:pointer;">
            Logout
          </button>
        </header>

        <main style="margin-top:14px; padding:12px 14px; border:1px solid #eee; border-radius:12px;">
          <div style="font-size:14px; color:#111; font-weight:600;">Bootstrap OK</div>
          <div style="font-size:12px; color:#666; margin-top:6px;">
            Próximo passo: Agenda do dia (lista) + filtro por clínica.
          </div>

          <div style="margin-top:12px; font-size:12px; color:#111;">
            <div style="font-weight:600; margin-bottom:6px;">Clínicas visíveis</div>
            <ul style="margin:0; padding-left:18px; color:#444;">
              ${clinics.map(c => `<li>${escapeHtml(c.name || c.slug || c.id)}</li>`).join("") || "<li>—</li>"}
            </ul>
          </div>
        </main>
      </div>
    `;

    const btn = document.getElementById("btnLogout");
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

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
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

      const user = session.user;
      const email = user.email || "—";

      // Carregar role + clínicas (via RLS)
      let role = null;
      let clinics = [];

      try {
        role = await fetchMyRole(user.id);
      } catch (e) {
        console.warn("Não foi possível carregar role via clinic_members:", e);
      }

      try {
        clinics = await fetchVisibleClinics();
      } catch (e) {
        console.warn("Não foi possível carregar clínicas via clinics:", e);
      }

      renderApp({ email, role, clinics });
    } catch (e) {
      console.error("Boot falhou:", e);
      document.body.textContent = "Erro ao iniciar a app. Abre a consola para detalhe.";
    }
  }

  boot();
})();