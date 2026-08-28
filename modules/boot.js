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
  setHomeDashboardAlertStats,
  renderHomeDashboardAlerts,
  renderHomeClinicSelect,
  renderHomeConsultasBreakdown,
  wireHomeAlertFilterBar,
  wirePedidosOnlineToggle,
  renderHomePedidosOnlineList,
  setHomeAcompanhamentoStats,
  wireHomeAcompFilterBar,
  renderHomeAcompanhamentoList,
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

/* Estado próprio do Home (scope de clínica) — independente de G.activeClinicId.
   Só é seedado a partir de G.activeClinicId uma vez, na primeira vez que a
   vista Home é aberta na sessão; depois disso é controlado só pelo seletor
   do Home. Nunca escrito automaticamente de volta em G.activeClinicId — só
   é copiado para lá no momento explícito de abrir a Agenda. */
let homeClinicId = null;
let homeClinicIdInitialized = false;

/* Filtro da barra de alertas do Home — filtra só em memória as listas já
   carregadas por loadHomeAlerts(); nunca dispara uma query nova. */
let homeAlertFilter = "all";
let homePendingAlertsSorted = [];
let homeResolvedTodayAlerts = [];

/* Detalhe do Acompanhamento ativo — populado só por loadHomeAcompanhamentoExercicio();
   clicar num contador nunca faz query nova, só lê daqui. */
let homeAcompDetail = { needsAction: [], endingSoon: [], inactive: [], regular: [] };
let homeAcompSelectedCategory = null;

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
    if (!homeClinicIdInitialized) {
      homeClinicIdInitialized = true;
      homeClinicId = (G.activeClinicId && (G.clinics || []).some((c) => c.id === G.activeClinicId))
        ? G.activeClinicId
        : null;
    }

    renderHomeClinicSelect(G.clinics, homeClinicId, (newClinicId) => {
      homeClinicId = newClinicId || null;
      /* Mudar de clínica limpa a seleção de Acompanhamento ativo em vez de
         recalcular a lista no scope antigo — evita mostrar dados da
         clínica anterior. */
      closeHomeAcompList();
      /* Só recarrega dados clinic-scoped já reais do Home — nunca navega
         nem toca em G.activeClinicId aqui. */
      Promise.all([
        loadHomeConsultasHoje(),
        loadHomePedidosOnlinePendentes(),
        loadHomeAlerts(),
        loadHomeAcompanhamentoExercicio(),
      ]);
      /* Painel de Pedidos online: só recarrega a lista se já estiver
         aberto (sem o atributo "hidden"); fechado, não faz query extra. */
      const pedidosExpand = document.getElementById("gcHomePedidosExpand");
      if (pedidosExpand && !pedidosExpand.hasAttribute("hidden")) {
        loadHomePedidosOnlineList();
      }
    });

    wireHomeAlertFilterBar(homeAlertFilter, (newFilter) => {
      homeAlertFilter = newFilter || "all";
      applyHomeAlertFilter();
    });

    wirePedidosOnlineToggle(() => {
      loadHomePedidosOnlineList();
    });

    wireHomeAcompFilterBar(homeAcompSelectedCategory, (category) => {
      homeAcompSelectedCategory = category;
      renderHomeAcompanhamentoList(category, homeAcompDetail[category], { onClose: closeHomeAcompList });
    });

    await Promise.all([
      loadHomeConsultasHoje(),
      loadHomePedidosOnlinePendentes(),
      loadHomeAlerts(),
      loadHomeAcompanhamentoExercicio(),
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

  /* Vista Acompanhamento individual de Exercício */
  if (view === "exercicio-acompanhamento") {
    const { initAcompanhamentoExercicio } = await import("./exercicio/acompanhamento/acompanhamento.js");
    await initAcompanhamentoExercicio({
      patientId: G._exerciseFollowupPatientId || null,
      prescriptionId: G._exerciseFollowupPrescriptionId || null,
      onBack: () => {
        G.currentView = "home";
        renderCurrentView();
      },
    });
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
    if (!r) {
      setHomeDashboardConsultasHoje(null);
      renderHomeConsultasBreakdown(null, { onClinicClick: openHomeAgendaForClinic });
      return;
    }

    const { data } = await loadAppointmentsForRange({
      clinicId: homeClinicId || null,
      startISO: r.startISO,
      endISO:   r.endISO,
    });

    const rows = (data || []).filter((row) => String(row?.mode || "").toLowerCase() !== "bloqueio");
    setHomeDashboardConsultasHoje(rows.length);

    const byClinic = new Map();
    rows.forEach((row) => {
      byClinic.set(row.clinic_id, (byClinic.get(row.clinic_id) || 0) + 1);
    });
    const breakdown = [...byClinic.entries()]
      .map(([clinicId, count]) => ({
        clinicId,
        count,
        name: G.clinicsById?.[clinicId]?.name || G.clinicsById?.[clinicId]?.slug || clinicId,
      }))
      .sort((a, b) => b.count - a.count);

    renderHomeConsultasBreakdown(breakdown, { onClinicClick: openHomeAgendaForClinic });
  } catch (e) {
    console.warn("Home: falha ao carregar consultas de hoje:", e);
    setHomeDashboardConsultasHoje(null);
    renderHomeConsultasBreakdown(null, { onClinicClick: openHomeAgendaForClinic });
  }
}

/* openHomeAgendaForClinic — copia o scope escolhido no Home para
   G.activeClinicId só no momento explícito de navegar, e abre a Agenda
   pelo mecanismo já existente (renderClinicsSelect/refreshAgenda lêem
   G.activeClinicId). Nunca sincronizado fora deste clique. */
function openHomeAgendaForClinic(clinicId) {
  G.activeClinicId = clinicId || null;
  G.currentView = "agenda";
  if (typeof window.__gc_renderCurrentView === "function") {
    window.__gc_renderCurrentView();
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
    if (homeClinicId) q = q.eq("clinic_id", homeClinicId);

    const { count, error } = await q;
    if (error) throw error;
    setHomeDashboardPedidosOnline(count ?? 0);
  } catch (e) {
    console.warn("Home: falha ao carregar pedidos online pendentes:", e);
    setHomeDashboardPedidosOnline(null);
  }
}

/* ====================================================================
   loadHomePedidosOnlineList — lista real dos pedidos pendentes, só
   carregada quando o cartão "Pedidos online" é expandido (não corre no
   Promise.all inicial). Mesma tabela/filtro/scope de clínica que
   loadHomePedidosOnlinePendentes() e que loadAndRenderPendentes()
   (agenda.js) — mesmas colunas relevantes, sem a parte de UI/estado
   dessa função (que é privada e depende de #pendentesSection).
   ==================================================================== */
async function loadHomePedidosOnlineList() {
  try {
    let q = window.sb
      .from("patient_uploads")
      .select("id, created_at, tipo, clinic_id, atleta_nome")
      .eq("status", "pendente")
      .order("created_at", { ascending: true });
    if (homeClinicId) q = q.eq("clinic_id", homeClinicId);

    const { data, error } = await q;
    if (error) throw error;
    renderHomePedidosOnlineList(data || [], { onOpenAgenda: openHomeAgendaForClinic });
  } catch (e) {
    console.warn("Home: falha ao carregar lista de pedidos online:", e);
    renderHomePedidosOnlineList(null, { onOpenAgenda: openHomeAgendaForClinic });
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
const HOME_ALERT_SELECT_COLUMNS = "id, clinic_id, patient_id, source, event_type, severity, title, message, target_url, created_at, resolved_at";

async function loadHomeAlerts() {
  try {
    let q = window.sb
      .from("alerts")
      .select(HOME_ALERT_SELECT_COLUMNS)
      .is("resolved_at", null)
      .order("created_at", { ascending: false });
    if (homeClinicId) q = q.eq("clinic_id", homeClinicId);

    const { data: pending, error } = await q;
    if (error) throw error;

    const rows = pending || [];
    const urgent    = rows.filter((a) => a.severity === "urgent").length;
    const attention = rows.filter((a) => a.severity === "attention").length;
    const info      = rows.filter((a) => a.severity === "info").length;

    /* Mesma leitura que antes só contava (head:true) — transformada em
       leitura das linhas para poder alimentar o filtro "Resolvidos" sem
       criar uma segunda query. */
    let resolvedRows = [];
    const r = isoLocalDayRangeFromISODate(fmtDateISO(new Date()));
    if (r) {
      let rq = window.sb
        .from("alerts")
        .select(HOME_ALERT_SELECT_COLUMNS)
        .gte("resolved_at", r.startISO)
        .lt("resolved_at", r.endISO)
        .order("resolved_at", { ascending: false });
      if (homeClinicId) rq = rq.eq("clinic_id", homeClinicId);
      const { data: resolved, error: rErr } = await rq;
      if (rErr) throw rErr;
      resolvedRows = resolved || [];
    }

    setHomeDashboardAlertStats({ urgent, attention, info, resolvedToday: resolvedRows.length });

    homePendingAlertsSorted = rows.slice().sort((a, b) => {
      const sa = HOME_ALERT_SEVERITY_ORDER[a.severity] ?? 3;
      const sb = HOME_ALERT_SEVERITY_ORDER[b.severity] ?? 3;
      if (sa !== sb) return sa - sb;
      return new Date(b.created_at) - new Date(a.created_at);
    });
    homeResolvedTodayAlerts = resolvedRows;

    applyHomeAlertFilter();
  } catch (e) {
    console.warn("Home: falha ao carregar alertas:", e);
    setHomeDashboardAlertStats(null);
    homePendingAlertsSorted = [];
    homeResolvedTodayAlerts = [];
    renderHomeDashboardAlerts(null);
  }
}

/* applyHomeAlertFilter — filtra em memória (pendentes ou resolvidosHoje,
   já carregados por loadHomeAlerts) segundo homeAlertFilter; nunca faz
   query. No filtro "resolved", os itens já têm resolved_at preenchido —
   renderHomeDashboardAlerts omite o botão "Resolvido" nesses casos. */
function applyHomeAlertFilter() {
  const filtered = homeAlertFilter === "resolved"
    ? homeResolvedTodayAlerts
    : homeAlertFilter === "all"
      ? homePendingAlertsSorted
      : homePendingAlertsSorted.filter((a) => a.severity === homeAlertFilter);

  renderHomeDashboardAlerts(filtered, {
    onOpen: (url) => { if (url) window.open(url, "_blank", "noopener"); },
    onResolve: (alertId) => { resolveHomeAlert(alertId); },
  });
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

/* closeHomeAcompList — limpa a seleção do Acompanhamento ativo e o
   destaque visual do contador, sem tocar nos contadores/dados. */
function closeHomeAcompList() {
  homeAcompSelectedCategory = null;
  document.querySelectorAll('#gcHomeAcompStats [data-acomp-filter]').forEach((b) => b.classList.remove("on"));
  renderHomeAcompanhamentoList(null, null);
}

/* dd-mm-aaaa — aceita ISO completo, "yyyy-mm-dd" (datas de sessão) ou ms. */
function fmtHomeAcompDatePt(value) {
  if (value == null) return null;
  const d = (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value))
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
  if (isNaN(d.getTime())) return null;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getFullYear()}`;
}

/* ====================================================================
   loadHomeAcompanhamentoExercicio — contadores (Precisa de ação /
   A terminar / Sem atividade / Regular) + detalhe por doente, a partir
   de planos REALMENTE ativos (status='active' E expires_at > agora).
   Scope de clínica: homeClinicId (RLS já restringe às clínicas do
   utilizador quando null). Sem escrita em alerts, sem alteração a
   prescricao.js. Só 4 queries no total (prescrições, logs, readiness,
   doentes) — nenhuma delas por doente/prescrição (sem N+1).

   Sinais de "Precisa de ação" — estado MAIS RECENTE por prescrição:
     - a readiness MAIS RECENTE dessa prescrição (por answered_at) tem
       has_symptoms === true;
     - o ÚLTIMO log dessa prescrição tem: note preenchida, OU rpe >= 8,
       OU algum exercício com status !== 'as_prescribed' (inclui
       'skipped'). Os motivos mostrados na lista distinguem "alterado"
       de "skipped", mas a condição de pertença à categoria é a mesma
       já validada (qualquer status diferente de 'as_prescribed').

   "A terminar": expires_at > agora e <= agora + 7 dias.
   "Sem atividade": pelo menos uma sessão em data.sessions[] com
   date < hoje local sem linha correspondente em wo_session_logs.
   "Regular": doente ativo que não cai em nenhuma das três anteriores.
   ==================================================================== */
async function loadHomeAcompanhamentoExercicio() {
  try {
    let pq = window.sb
      .from("wo_prescriptions")
      .select("id, patient_id, clinic_id, expires_at, data")
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString());
    if (homeClinicId) pq = pq.eq("clinic_id", homeClinicId);

    const { data: prescriptions, error } = await pq;
    if (error) throw error;

    const rows = prescriptions || [];
    if (!rows.length) {
      homeAcompDetail = { needsAction: [], endingSoon: [], inactive: [], regular: [] };
      setHomeAcompanhamentoStats({ total: 0, precisaAcao: 0, aTerminar: 0, semAtividade: 0, regular: 0 });
      if (homeAcompSelectedCategory) renderHomeAcompanhamentoList(homeAcompSelectedCategory, [], { onClose: closeHomeAcompList });
      return;
    }

    const prescriptionIds = rows.map((p) => p.id);

    /* Logs de todas as prescrições ativas — usados para 2 fins a partir
       da MESMA query (evita N+1): (a) o log mais recente por prescrição
       decide "Precisa de ação" e alimenta "última sessão"; (b) o
       conjunto completo de session_ids já logados decide "Sem
       atividade". */
    const { data: logs, error: logsErr } = await window.sb
      .from("wo_session_logs")
      .select("prescription_id, session_id, logged_at, rpe, note, sets")
      .in("prescription_id", prescriptionIds)
      .order("logged_at", { ascending: false });
    if (logsErr) throw logsErr;

    const lastLogByPrescription = new Map();
    const loggedSessionKeys = new Set();
    (logs || []).forEach((l) => {
      if (!lastLogByPrescription.has(l.prescription_id)) lastLogByPrescription.set(l.prescription_id, l);
      loggedSessionKeys.add(`${l.prescription_id}::${l.session_id}`);
    });

    /* Readiness mais recente por prescrição (não "alguma vez teve
       sintomas") — sem filtro de has_symptoms na query, para poder
       ver também as respostas normais mais recentes que anulam uma
       readiness antiga com sintomas. */
    const { data: readiness, error: rErr } = await window.sb
      .from("wo_session_readiness")
      .select("prescription_id, has_symptoms, answered_at")
      .in("prescription_id", prescriptionIds)
      .order("answered_at", { ascending: false });
    if (rErr) throw rErr;

    const latestReadinessByPrescription = new Map();
    (readiness || []).forEach((r) => {
      if (!latestReadinessByPrescription.has(r.prescription_id)) latestReadinessByPrescription.set(r.prescription_id, r);
    });

    const todayISO = fmtDateISO(new Date());
    const SEVEN_DAYS_MS = 7 * 24 * 3600 * 1000;
    const nowMs = Date.now();

    const allPatients  = new Set();
    const needsAction  = new Set();
    const endingSoon   = new Set();
    const inactive     = new Set();

    const needsActionAcc = new Map(); // patientId -> { reasons:Set<string>, lastSessionAt }
    const endingSoonAcc  = new Map(); // patientId -> { expiresAtMs }
    const inactiveAcc    = new Map(); // patientId -> { overdueCount, mostRecentOverdueDate, lastSessionAt }

    rows.forEach((p) => {
      allPatients.add(p.patient_id);

      const expiresAtMs   = new Date(p.expires_at).getTime();
      const lastLog        = lastLogByPrescription.get(p.id);
      const lastSessionAt  = lastLog?.logged_at || null;

      /* Precisa de ação — motivos + pertença, a partir dos mesmos 2 sinais
         já validados (readiness mais recente / último log). */
      let flagged = false;
      const reasons = [];
      const latestReadiness = latestReadinessByPrescription.get(p.id);
      if (latestReadiness?.has_symptoms === true) {
        reasons.push("Sintomas reportados antes do treino");
        flagged = true;
      }
      if (lastLog) {
        const rpeNum = Number(lastLog.rpe || 0);
        const sets = Array.isArray(lastLog.sets) ? lastLog.sets : [];
        const hasSkipped        = sets.some((entry) => entry.status === "skipped");
        const hasAlteradoOutro  = sets.some((entry) => entry.status && entry.status !== "as_prescribed" && entry.status !== "skipped");
        const alteradoQualquer  = sets.some((entry) => entry.status && entry.status !== "as_prescribed");
        if (rpeNum >= 8) { reasons.push(`Esforço elevado: RPE ${rpeNum}/10`); flagged = true; }
        if (lastLog.note) { reasons.push("Comentário do doente"); flagged = true; }
        if (hasAlteradoOutro) reasons.push("Exercício alterado");
        if (hasSkipped) reasons.push("Exercício não realizado/skipped");
        if (alteradoQualquer) flagged = true;
      }
      if (flagged) {
        needsAction.add(p.patient_id);
        const acc = needsActionAcc.get(p.patient_id) || { reasons: new Set(), lastSessionAt: null };
        reasons.forEach((r) => acc.reasons.add(r));
        if (lastSessionAt && (!acc.lastSessionAt || lastSessionAt > acc.lastSessionAt)) acc.lastSessionAt = lastSessionAt;
        needsActionAcc.set(p.patient_id, acc);
      }

      /* A terminar — guarda o plano com expiração mais próxima. */
      if (expiresAtMs - nowMs <= SEVEN_DAYS_MS) {
        endingSoon.add(p.patient_id);
        const acc = endingSoonAcc.get(p.patient_id);
        if (!acc || expiresAtMs < acc.expiresAtMs) endingSoonAcc.set(p.patient_id, { expiresAtMs });
      }

      /* Sem atividade — sessões vencidas (date < hoje) sem log. */
      const sessions = Array.isArray(p.data?.sessions) ? p.data.sessions : [];
      const overdueDates = sessions
        .filter((s) => s?.date && s?.session_id && s.date < todayISO && !loggedSessionKeys.has(`${p.id}::${s.session_id}`))
        .map((s) => s.date);
      if (overdueDates.length) {
        inactive.add(p.patient_id);
        const mostRecentOverdue = overdueDates.reduce((a, b) => (b > a ? b : a));
        const acc = inactiveAcc.get(p.patient_id) || { overdueCount: 0, mostRecentOverdueDate: null, lastSessionAt: null };
        acc.overdueCount += overdueDates.length;
        if (!acc.mostRecentOverdueDate || mostRecentOverdue > acc.mostRecentOverdueDate) acc.mostRecentOverdueDate = mostRecentOverdue;
        if (lastSessionAt && (!acc.lastSessionAt || lastSessionAt > acc.lastSessionAt)) acc.lastSessionAt = lastSessionAt;
        inactiveAcc.set(p.patient_id, acc);
      }
    });

    /* Regular — por exclusão; segunda passada só para os doentes que
       sobrarem, sem query nova (mesmos `rows` já em memória). */
    const regularPatientIds = new Set(
      [...allPatients].filter((pid) => !needsAction.has(pid) && !endingSoon.has(pid) && !inactive.has(pid))
    );
    const regularAcc = new Map(); // patientId -> { expiresAtMs, lastSessionAt }
    rows.forEach((p) => {
      if (!regularPatientIds.has(p.patient_id)) return;
      const expiresAtMs  = new Date(p.expires_at).getTime();
      const lastLog       = lastLogByPrescription.get(p.id);
      const lastSessionAt = lastLog?.logged_at || null;
      const acc = regularAcc.get(p.patient_id) || { expiresAtMs: Infinity, lastSessionAt: null };
      if (expiresAtMs < acc.expiresAtMs) acc.expiresAtMs = expiresAtMs;
      if (lastSessionAt && (!acc.lastSessionAt || lastSessionAt > acc.lastSessionAt)) acc.lastSessionAt = lastSessionAt;
      regularAcc.set(p.patient_id, acc);
    });

    /* Nomes — UMA query agrupada, nunca uma por doente. */
    let nameByPatient = new Map();
    if (allPatients.size) {
      const { data: patients, error: patErr } = await window.sb
        .from("patients")
        .select("id, full_name")
        .in("id", [...allPatients]);
      if (patErr) throw patErr;
      nameByPatient = new Map((patients || []).map((pt) => [pt.id, pt.full_name]));
    }

    const needsActionItems = [...needsActionAcc.entries()].map(([pid, acc]) => ({
      patientId: pid,
      name: nameByPatient.get(pid) || "—",
      subtitle: [...acc.reasons].join(" · "),
      meta: acc.lastSessionAt ? `Última sessão: ${fmtHomeAcompDatePt(acc.lastSessionAt)}` : null,
    }));

    const endingSoonItems = [...endingSoonAcc.entries()].map(([pid, acc]) => {
      const expiresDateISO = fmtDateISO(new Date(acc.expiresAtMs));
      const subtitle = expiresDateISO === todayISO
        ? "Plano termina hoje"
        : (() => {
            const daysLeft = Math.round((new Date(`${expiresDateISO}T00:00:00`) - new Date(`${todayISO}T00:00:00`)) / 86400000);
            return `Plano termina em ${daysLeft} dia${daysLeft === 1 ? "" : "s"}`;
          })();
      return {
        patientId: pid,
        name: nameByPatient.get(pid) || "—",
        subtitle,
        meta: `Fim: ${fmtHomeAcompDatePt(acc.expiresAtMs)}`,
      };
    });

    const inactiveItems = [...inactiveAcc.entries()].map(([pid, acc]) => {
      const subtitle = `${acc.overdueCount} sessão${acc.overdueCount === 1 ? "" : "ões"} prevista${acc.overdueCount === 1 ? "" : "s"} não realizada${acc.overdueCount === 1 ? "" : "s"}`;
      const metaParts = [];
      if (acc.mostRecentOverdueDate) metaParts.push(`Sessão vencida mais recente: ${fmtHomeAcompDatePt(acc.mostRecentOverdueDate)}`);
      if (acc.lastSessionAt) metaParts.push(`Última sessão realizada: ${fmtHomeAcompDatePt(acc.lastSessionAt)}`);
      return {
        patientId: pid,
        name: nameByPatient.get(pid) || "—",
        subtitle,
        meta: metaParts.join(" · ") || null,
      };
    });

    const regularItems = [...regularAcc.entries()].map(([pid, acc]) => ({
      patientId: pid,
      name: nameByPatient.get(pid) || "—",
      subtitle: "Acompanhamento regular",
      meta: [
        acc.lastSessionAt ? `Última sessão: ${fmtHomeAcompDatePt(acc.lastSessionAt)}` : null,
        acc.expiresAtMs !== Infinity ? `Fim do plano: ${fmtHomeAcompDatePt(acc.expiresAtMs)}` : null,
      ].filter(Boolean).join(" · ") || null,
    }));

    homeAcompDetail = {
      needsAction: needsActionItems,
      endingSoon: endingSoonItems,
      inactive: inactiveItems,
      regular: regularItems,
    };

    setHomeAcompanhamentoStats({
      total: allPatients.size,
      precisaAcao: needsAction.size,
      aTerminar: endingSoon.size,
      semAtividade: inactive.size,
      regular: regularItems.length,
    });

    /* Se já havia uma categoria selecionada (ex.: reentrada na vista Home
       com o DOM reconstruído), refrescar a lista com os dados novos. */
    if (homeAcompSelectedCategory) {
      renderHomeAcompanhamentoList(homeAcompSelectedCategory, homeAcompDetail[homeAcompSelectedCategory], { onClose: closeHomeAcompList });
    }
  } catch (e) {
    console.warn("Home: falha ao carregar acompanhamento de exercício:", e);
    homeAcompDetail = { needsAction: [], endingSoon: [], inactive: [], regular: [] };
    setHomeAcompanhamentoStats(null);
    if (homeAcompSelectedCategory) renderHomeAcompanhamentoList(homeAcompSelectedCategory, null);
  }
}

/* Expor renderCurrentView globalmente para shell.js */
window.__gc_renderCurrentView = renderCurrentView;
