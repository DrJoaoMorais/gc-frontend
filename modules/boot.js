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
import {
  renderAppShell,
  renderClinicsSelect,
  hydrateShellHeader
}                                          from "./shell.js";
import {
  setAgendaSubtitleForSelectedDay,
  refreshAgenda
}                                          from "./agenda.js";
import { openApptModal }                   from "./agenda.js";
import { openNewPatientMainModal }         from "./doente.js";
import { wireQuickPatientSearch, openCalendarOverlay } from "./pesquisa.js";
import { wireLogout, ensureAAL2, __gcForceSessionLock, __gcIsAuthError, __gcSessionLockActive } from "./session.js";
import { fmtDateISO }                      from "./helpers.js";

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

    await renderCurrentView();

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
  await wireLogout();
  hydrateShellHeader();

  /* Botão Gestão */
  const btnManagement = document.getElementById("btnManagement");
  if (btnManagement) {
    btnManagement.addEventListener("click", async () => {
      if (String(G.currentView || "agenda").toLowerCase() === "management") return;
      G.currentView = "management";
      await renderCurrentView();
    });
  }

  /* Botão Voltar para Agenda */
  const btnBack = document.getElementById("btnBackToAgenda");
  if (btnBack) {
    btnBack.addEventListener("click", async () => {
      G.currentView = "agenda";
      await renderCurrentView();
    });
  }

  /* Se não é a view de agenda, termina aqui */
  if (String(G.currentView || "agenda").toLowerCase() !== "agenda") return;

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

  /* Hoje */
  const btnToday = document.getElementById("btnToday");
  if (btnToday) {
    btnToday.addEventListener("click", async () => {
      G.selectedDayISO = fmtDateISO(new Date());
      setAgendaSubtitleForSelectedDay();
      await refreshAgenda();
    });
  }

  /* Permissões */
  const doctorOrSecretary = ["doctor","secretary"];
  if (btnNew && G.role && !doctorOrSecretary.includes(String(G.role).toLowerCase())) {
    btnNew.disabled = true;
    btnNew.title    = "Sem permissão para criar marcações.";
  }
  if (btnNewPatientMain && G.role && !doctorOrSecretary.includes(String(G.role).toLowerCase())) {
    btnNewPatientMain.disabled = true;
    btnNewPatientMain.title    = "Sem permissão para criar doentes.";
  }

  await refreshAgenda();
}
