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
import { fetchProcedureTypes, loadAppointmentsForRange } from "./db.js";
import {
  renderAppShell,
  hydrateShellHeader
}                                          from "./shell.js";
import {
  setHomeDashboardConsultasHoje,
  setHomeDashboardPedidosOnline,
  setHomeDashboardConsentimentos,
  setHomeDashboardAlertStats,
  renderHomeDashboardAlerts,
}                                          from "./home-dashboard.js";
import {
  setAgendaSubtitleForSelectedDay,
  refreshAgenda,
  renderClinicsSelect
}                                          from "./agenda.js";
import { openApptModal }                   from "./agenda.js";
import { openNewPatientMainModal }         from "./novo-doente.js";
import { wireQuickPatientSearch }                      from "./pesquisa.js";
import { openCalendarOverlay, openWeekView }           from "./agenda.js";
import { wireLogout, ensureAAL2, __gcForceSessionLock, __gcIsAuthError, __gcSessionLockActive } from "./session.js";
import { fmtDateISO, isoLocalDayRangeFromISODate } from "./helpers.js";
import { renderDoentePanorama } from "./doente-admin.js";
import { renderFinancas }                  from "./financas.js";
import { renderGestao }                    from "./gestao.js";
import { initGestaoAgenda }               from "./gestaoagenda.js";

// Import dinâmico e versionado (não estático): evita que o browser/CDN sirva
// uma cópia antiga de prescricao.js depois de um deploy — mesmo problema que
// já resolvemos para o CSS, aqui aplicado ao próprio módulo JS.
const PRESCRICAO_JS_VERSION = '2026-08-25-3';

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

      if (!hasUser || ev === "SIGNED_OUT" || ev === "USER_DELETED" || ev === "TOKEN_EXPIRED") {
        await __gcForceSessionLock("Sessão terminada. Volte a iniciar sessão para continuar.");
        return;
      }

      if (["TOKEN_REFRESHED","SIGNED_IN","INITIAL_SESSION","USER_UPDATED"].includes(ev)) {
        G.sessionUser = nextSession.user;
      }
    });

    G.authStateSubscription = authStateData?.subscription || null;

    /* Check periódico de sessão — a cada 5 min verifica se o token ainda é válido */
    const SESSION_CHECK_INTERVAL = 5 * 60 * 1000;
    const sessionCheckTimer = setInterval(async () => {
      if (__gcSessionLockActive) { clearInterval(sessionCheckTimer); return; }
      try {
        const { data, error } = await window.sb.auth.getSession();
        if (error || !data?.session) {
          clearInterval(sessionCheckTimer);
          await __gcForceSessionLock("Sessão expirada. Volte a iniciar sessão para continuar.");
        }
      } catch (_) {
        clearInterval(sessionCheckTimer);
        await __gcForceSessionLock("Sessão expirada. Volte a iniciar sessão para continuar.");
      }
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

    if (G.role === "administrativo" && G.currentView === "agenda") {
      G.currentView = "gestaoagenda";
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

  /* Vista Início */
  if (view === "home") {
    await Promise.all([
      loadHomeConsultasHoje(),
      loadHomePedidosOnlinePendentes(),
      loadHomeConsentimentosPendentes(),
      loadHomeAlerts(),
    ]);
    return;
  }

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

  /* Vista Panorama do Doente */
  if (view === "doente-panorama") {
    if (G._panoramaPatientId) {
      await window.__gc_renderDoentePanorama(G._panoramaPatientId);
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

  /* Vista Prescrição de Exercício */
  if (view === "exercicio") {
    const { initPrescricao } = await import(`./exercicio/prescricao/prescricao.js?v=${PRESCRICAO_JS_VERSION}`);
    await initPrescricao();
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

/* ====================================================================
   loadHomeConsultasHoje — mesma fonte/scope de clínica da Agenda,
   restrito ao dia de hoje e excluindo bloqueios.
   ==================================================================== */
async function loadHomeConsultasHoje() {
  try {
    const r = isoLocalDayRangeFromISODate(fmtDateISO(new Date()));
    if (!r) { setHomeDashboardConsultasHoje(null); return; }

    const { data } = await loadAppointmentsForRange({
      clinicId: G.activeClinicId || null,
      startISO: r.startISO,
      endISO:   r.endISO,
    });

    const count = (data || []).filter((row) => String(row?.mode || "").toLowerCase() !== "bloqueio").length;
    setHomeDashboardConsultasHoje(count);
  } catch (e) {
    console.warn("Home: falha ao carregar consultas de hoje:", e);
    setHomeDashboardConsultasHoje(null);
  }
}

/* ====================================================================
   loadHomePedidosOnlinePendentes — mesma tabela/filtro/scope de clínica
   que a Agenda usa em loadAndRenderPendentes (agenda.js), mas sem a
   parte de UI (não depende de #pendentesSection).
   ==================================================================== */
async function loadHomePedidosOnlinePendentes() {
  try {
    let q = window.sb
      .from("patient_uploads")
      .select("id", { count: "exact", head: true })
      .eq("status", "pendente");
    if (G.activeClinicId) q = q.eq("clinic_id", G.activeClinicId);

    const { count, error } = await q;
    if (error) throw error;
    setHomeDashboardPedidosOnline(count ?? 0);
  } catch (e) {
    console.warn("Home: falha ao carregar pedidos online pendentes:", e);
    setHomeDashboardPedidosOnline(null);
  }
}

/* ====================================================================
   loadHomeConsentimentosPendentes — pares patient_id::clinic_id de
   consultas de hoje sem RGPD resolvido (signed/paper_signed), mesma
   regra "ever signed" e o mesmo scope patient_id+clinic_id corrigidos
   em gestaoagenda.js (commit df1a897). Loader independente — não
   reutiliza loadHomeConsultasHoje() para não lhe alterar o contrato.
   ==================================================================== */
async function loadHomeConsentimentosPendentes() {
  try {
    const r = isoLocalDayRangeFromISODate(fmtDateISO(new Date()));
    if (!r) { setHomeDashboardConsentimentos(null); return; }

    const { data } = await loadAppointmentsForRange({
      clinicId: G.activeClinicId || null,
      startISO: r.startISO,
      endISO:   r.endISO,
    });

    const todayPairs = new Set();
    (data || []).forEach((row) => {
      if (String(row?.mode || "").toLowerCase() === "bloqueio") return;
      if (!row?.patient_id || !row?.clinic_id) return;
      todayPairs.add(`${row.patient_id}::${row.clinic_id}`);
    });

    if (!todayPairs.size) { setHomeDashboardConsentimentos(0); return; }

    const patientIds = [...new Set([...todayPairs].map((key) => key.split("::")[0]))];
    const resolvedPairs = new Set();

    const { data: cd, error: cdErr } = await window.sb
      .from("consents")
      .select("patient_id, clinic_id, status")
      .in("patient_id", patientIds)
      .eq("type", "rgpd");
    if (cdErr) throw cdErr;
    (cd || []).forEach((c) => {
      if (c.status === "signed" || c.status === "paper_signed") {
        resolvedPairs.add(`${c.patient_id}::${c.clinic_id}`);
      }
    });

    const { data: ct, error: ctErr } = await window.sb
      .from("consent_tokens")
      .select("patient_id, clinic_id")
      .in("patient_id", patientIds)
      .eq("document_type", "rgpd")
      .eq("status", "signed");
    if (ctErr) throw ctErr;
    (ct || []).forEach((t) => {
      resolvedPairs.add(`${t.patient_id}::${t.clinic_id}`);
    });

    const pending = [...todayPairs].filter((key) => !resolvedPairs.has(key)).length;
    setHomeDashboardConsentimentos(pending);
  } catch (e) {
    console.warn("Home: falha ao carregar consentimentos pendentes:", e);
    setHomeDashboardConsentimentos(null);
  }
}

/* ====================================================================
   loadHomeAlerts — tabela alerts (fonte central de alertas do GC; o
   Push é só um canal externo). "Lido" (seen_at) é distinto de
   "Resolvido" (resolved_at) — só resolved_at conta como tratado.
   severity/source usam exclusivamente os valores validados em
   create_alert() no Supabase: severity ∈ {urgent,attention,info},
   source ∈ {website,exercise,diary,questionnaire,consent,system}.
   ==================================================================== */
const HOME_ALERT_SEVERITY_ORDER = { urgent: 0, attention: 1, info: 2 };

async function loadHomeAlerts() {
  try {
    let q = window.sb
      .from("alerts")
      .select("id, clinic_id, patient_id, source, event_type, severity, title, message, target_url, created_at")
      .is("resolved_at", null)
      .order("created_at", { ascending: false });
    if (G.activeClinicId) q = q.eq("clinic_id", G.activeClinicId);

    const { data: pending, error } = await q;
    if (error) throw error;

    const rows = pending || [];
    const urgent    = rows.filter((a) => a.severity === "urgent").length;
    const attention = rows.filter((a) => a.severity === "attention").length;
    const info      = rows.filter((a) => a.severity === "info").length;

    let resolvedToday = 0;
    const r = isoLocalDayRangeFromISODate(fmtDateISO(new Date()));
    if (r) {
      let rq = window.sb
        .from("alerts")
        .select("id", { count: "exact", head: true })
        .gte("resolved_at", r.startISO)
        .lt("resolved_at", r.endISO);
      if (G.activeClinicId) rq = rq.eq("clinic_id", G.activeClinicId);
      const { count, error: rErr } = await rq;
      if (rErr) throw rErr;
      resolvedToday = count ?? 0;
    }

    setHomeDashboardAlertStats({ urgent, attention, info, resolvedToday });

    const sorted = rows.slice().sort((a, b) => {
      const sa = HOME_ALERT_SEVERITY_ORDER[a.severity] ?? 3;
      const sb = HOME_ALERT_SEVERITY_ORDER[b.severity] ?? 3;
      if (sa !== sb) return sa - sb;
      return new Date(b.created_at) - new Date(a.created_at);
    });

    renderHomeDashboardAlerts(sorted, {
      onOpen: (url) => { if (url) window.open(url, "_blank", "noopener"); },
      onResolve: (alertId) => { resolveHomeAlert(alertId); },
    });
  } catch (e) {
    console.warn("Home: falha ao carregar alertas:", e);
    setHomeDashboardAlertStats(null);
    renderHomeDashboardAlerts(null);
  }
}

/* resolveHomeAlert — marca explicitamente como resolvido (resolved_at/
   resolved_by); nunca apaga o registo. Abrir (onOpen) nunca chama isto. */
async function resolveHomeAlert(alertId) {
  try {
    const userRes = await window.sb.auth.getUser();
    const userId  = userRes?.data?.user?.id || null;

    const { error } = await window.sb
      .from("alerts")
      .update({ resolved_at: new Date().toISOString(), resolved_by: userId })
      .eq("id", alertId);
    if (error) throw error;

    await loadHomeAlerts();
  } catch (e) {
    console.warn("Home: falha ao marcar alerta como resolvido:", e);
  }
}

/* Expor renderCurrentView globalmente para shell.js */
window.__gc_renderCurrentView = renderCurrentView;
