/**
 * boot.js — Passo 7
 * BLOCO 11B: Boot principal da aplicação
 *   — boot()           — entry point chamado pelo DOMContentLoaded
 *   — renderCurrentView — wiring de botões + refresh agenda
 *
 * Extraído de app.js bloco 11B
 */

import { G }                              from "./state.js";
import { fetchMyRole, fetchVisibleClinics } from "./auth.js";
import { fetchProcedureTypes } from "./db.js";
import {
  renderAppShell,
  hydrateShellHeader
}                                          from "./shell.js";
import {
  setAgendaSubtitleForSelectedDay,
  refreshAgenda,
  renderClinicsSelect
}                                          from "./agenda.js";
import { openApptModal }                   from "./agenda.js";
import { openNewPatientMainModal }         from "./doente.js";
import { wireQuickPatientSearch }                      from "./pesquisa.js";
import { openCalendarOverlay, openWeekView }           from "./agenda.js";
import { wireLogout, ensureAAL2, __gcForceSessionLock, __gcIsAuthError, __gcSessionLockActive } from "./session.js";
import { fmtDateISO }                      from "./helpers.js";
import { renderFinancas }                  from "./financas.js";
import { renderGestao }                    from "./gestao.js";
import { initGestaoAgenda }               from "./gestaoagenda.js";

/* ====================================================================
   BLOCO 11B — Boot principal
   ==================================================================== */

/**
 * boot
 * Ponto de entrada da aplicação.
 * Chamado via document.addEventListener("DOMContentLoaded", boot).
 */
export async function boot() {
  try {
    if (!window.sb?.auth?.getSession) {
      console.error("Supabase client não encontrado (window.sb). Confirma app.html.");
      document.body.textContent = "Erro: Supabase client não encontrado (window.sb).";
      return;
    }

    const { data, error } = await window.sb.auth.getSession();
    if (error) throw error;

    const session = data?.session;
    if (!session?.user) {
      window.location.replace("/index.html");
      return;
    }

    G.sessionUser = session.user;

    /* Limpar subscrição anterior */
    try { G.authStateSubscription?.unsubscribe?.(); } catch {}

    /* Ouvir mudanças de auth state */
    const { data: authStateData } = window.sb.auth.onAuthStateChange(async (event, nextSession) => {
      if (__gcSessionLockActive) return;

      const ev      = String(event || "").toUpperCase();
      const hasUser = !!(nextSession?.user);

      if (!hasUser || ev === "SIGNED_OUT" || ev === "USER_DELETED") {
        await __gcForceSessionLock("Sessão terminada. Volte a iniciar sessão para continuar.");
        return;
      }

      if (["TOKEN_REFRESHED","SIGNED_IN","INITIAL_SESSION","USER_UPDATED"].includes(ev)) {
        G.sessionUser = nextSession.user;
      }
    });

    G.authStateSubscription = authStateData?.subscription || null;

    /* Check periódico de sessão — a cada 5 min verifica se o token ainda é válido */
    const SESSION_CHECK_INTERVAL = 30 * 60 * 1000;
    const sessionCheckTimer = setInterval(async () => {
      if (__gcSessionLockActive) { clearInterval(sessionCheckTimer); return; }
      try {
        const { data, error } = await window.sb.auth.getSession();
        if (error || !data?.session) {
          clearInterval(sessionCheckTimer);
          await __gcForceSessionLock("Sessão expirada. Volte a iniciar sessão para continuar.");
        }
      } catch (_) {}
    }, SESSION_CHECK_INTERVAL);

    /* MFA gate */
    await ensureAAL2();
    if (__gcSessionLockActive) return;

    /* Role */
    try {
      G.role = await fetchMyRole(G.sessionUser.id);
    } catch (e) {
      if (__gcIsAuthError(e)) {
        await __gcForceSessionLock("Sessão expirada durante a validação do utilizador.");
        return;
      }
      G.role = null;
    }

    /* Clínicas */
    try {
      G.clinics = await fetchVisibleClinics();
    } catch (e) {
      if (__gcIsAuthError(e)) {
        await __gcForceSessionLock("Sessão expirada durante o carregamento das clínicas.");
        return;
      }
      G.clinics = [];
    }

    G.clinicsById = {};
    for (const c of G.clinics) G.clinicsById[c.id] = c;

    /* Tipos de procedimento */
    try {
      G.procedureTypes = await fetchProcedureTypes();
    } catch (e) {
      G.procedureTypes = [];
    }

    await renderCurrentView();

  // Verificar pendentes em background — sem bloquear o arranque
  (async () => {
    try {
      const hoje = new Date().toISOString().slice(0, 10);
      const { count } = await window.sb
        .from("registos_financeiros")
        .select("id", { count: "exact", head: true })
        .in("appt_status", ["scheduled", "arrived"])
        .lt("data", hoje);
      const c = count ?? 0;
      if (c > 0) {
        // Badge no ícone de Rendimentos
        const btnFin = document.querySelector('[data-nav="financas"]');
        if (btnFin) {
          const badge = document.createElement("span");
          badge.id = "gcPendentesBadge";
          Object.assign(badge.style, {
            position: "absolute", top: "6px", right: "6px",
            background: "#e02424", color: "#fff",
            fontSize: "10px", fontWeight: "700",
            width: "16px", height: "16px",
            borderRadius: "50%", display: "flex",
            alignItems: "center", justifyContent: "center",
            lineHeight: "1", pointerEvents: "none"
          });
          badge.textContent = c > 9 ? "9+" : String(c);
          btnFin.style.position = "relative";
          btnFin.appendChild(badge);
        }
      }
    } catch (e) {
      console.warn("checkPendentes badge:", e);
    }
  })();

  } catch (e) {
    if (__gcIsAuthError(e)) {
      await __gcForceSessionLock("Sessão expirada ou inválida. Volte a iniciar sessão.");
      return;
    }
    console.error("Boot falhou:", e);
    document.body.textContent = "Erro ao iniciar a app. Abre a consola para detalhe.";
  }
}

/* ====================================================================
   renderCurrentView — wiring completo da view atual
   ==================================================================== */

async function renderCurrentView() {
  renderAppShell();
  hydrateShellHeader();

  /* Sempre re-wirar logout após qualquer render */
  await wireLogout();

  const view = String(G.currentView || "agenda").toLowerCase();

  /* Vista Doentes — wirar pesquisa */
  if (view === "doentes") {
    await wireQuickPatientSearch();
    const btnNewPatDt = document.getElementById("btnNewPatientMain");
    if (btnNewPatDt) {
      btnNewPatDt.addEventListener("click", () => {
        const s = document.getElementById("selClinic");
        openNewPatientMainModal({ clinicId: s?.value || null });
      });
    }
    return;
  }

  /* Vista Financas */
  if (view === "financas") {
    await renderFinancas();
    return;
  }

  /* Vista Gestão */
  if (view === "management") {
    await renderGestao();
    return;
  }

  /* Vista Gestão de Agenda */
  if (view === "gestaoagenda") {
    initGestaoAgenda();
    return;
  }

  /* Se não é a view de agenda, termina aqui */
  if (view !== "agenda") return;

  /* ---- View de Agenda ---- */
  renderClinicsSelect(G.clinics);
  setAgendaSubtitleForSelectedDay();
  await wireQuickPatientSearch();

  /* Selector de clínica → refresh */
  const sel = document.getElementById("selClinic");
  if (sel) sel.addEventListener("change", refreshAgenda);

  /* Botão refresh */
  const btnRefresh = document.getElementById("btnRefreshAgenda");
  if (btnRefresh) btnRefresh.addEventListener("click", refreshAgenda);

  /* Nova marcação */
  const btnNew = document.getElementById("btnNewAppt");
  if (btnNew) {
    btnNew.addEventListener("click", () => openApptModal({ mode: "new", row: null }));
  }

  /* Novo doente */
  const btnNewPatientMain = document.getElementById("btnNewPatientMain");
  if (btnNewPatientMain) {
    btnNewPatientMain.addEventListener("click", () => {
      const s        = document.getElementById("selClinic");
      const clinicId = s?.value || null;
      openNewPatientMainModal({ clinicId });
    });
  }

  /* Calendário overlay */
  const btnCal = document.getElementById("btnCal");
  if (btnCal) btnCal.addEventListener("click", openCalendarOverlay);

  /* Vista semanal */
  const btnWeek = document.getElementById("btnWeek");
  if (btnWeek) {
    btnWeek.addEventListener("click", () => {
      G.weekStartISO = null; /* recalcula a partir do dia seleccionado */
      openWeekView();
    });
  }

  /* Hoje */
  const btnToday = document.getElementById("btnToday");
  if (btnToday) {
    btnToday.addEventListener("click", async () => {
      G.selectedDayISO = fmtDateISO(new Date());
      setAgendaSubtitleForSelectedDay();
      await refreshAgenda();
    });
  }

  /* Dia anterior */
  const btnPrevDay = document.getElementById("btnPrevDay");
  if (btnPrevDay) {
    btnPrevDay.addEventListener("click", async () => {
      const d = new Date((G.selectedDayISO || fmtDateISO(new Date())) + "T00:00:00");
      d.setDate(d.getDate() - 1);
      G.selectedDayISO = fmtDateISO(d);
      setAgendaSubtitleForSelectedDay();
      await refreshAgenda();
    });
  }

  /* Próximo dia */
  const btnNextDay = document.getElementById("btnNextDay");
  if (btnNextDay) {
    btnNextDay.addEventListener("click", async () => {
      const d = new Date((G.selectedDayISO || fmtDateISO(new Date())) + "T00:00:00");
      d.setDate(d.getDate() + 1);
      G.selectedDayISO = fmtDateISO(d);
      setAgendaSubtitleForSelectedDay();
      await refreshAgenda();
    });
  }

  /* Permissões */
  const podeAgendar = ["super_admin","admin","medico","administrativo","fisioterapeuta"];
  if (btnNew && G.role && !podeAgendar.includes(String(G.role).toLowerCase())) {
    btnNew.disabled = true;
    btnNew.title    = "Sem permissão para criar marcações.";
  }
  const podeCriarDoente = ["super_admin","admin","medico","administrativo","fisioterapeuta"];
  if (btnNewPatientMain && G.role && !podeCriarDoente.includes(String(G.role).toLowerCase())) {
    btnNewPatientMain.disabled = true;
    btnNewPatientMain.title    = "Sem permissão para criar doentes.";
  }

  await refreshAgenda();
}

/* Expor renderCurrentView globalmente para shell.js */
window.__gc_renderCurrentView = renderCurrentView;

