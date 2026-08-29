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
  wireHomeAcompanhamentoToggle,
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

/* Listas por PRESCRIÇÃO já preparadas por loadHomeAcompanhamentoAtivo()
   (patientName incluído) — os cartões "Precisa de ação"/"A terminar"
   só as leem ao expandir, sem query nova. null = falha ao carregar. */
let homeAcompActionItems = [];
let homeAcompEndingItems = [];

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
      /* Só recarrega dados clinic-scoped já reais do Home — nunca navega
         nem toca em G.activeClinicId aqui. */
      Promise.all([
        loadHomeConsultasHoje(),
        loadHomePedidosOnlinePendentes(),
        loadHomeAlerts(),
        loadHomeAcompanhamentoAtivo(),
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

    wireHomeAcompanhamentoToggle({
      onOpenAction: () => renderHomeAcompanhamentoList(homeAcompActionItems, { kind: "action", onOpen: openHomeExerciseFollowup }),
      onOpenEnding: () => renderHomeAcompanhamentoList(homeAcompEndingItems, { kind: "ending", onOpen: openHomeExerciseFollowup }),
    });

    await Promise.all([
      loadHomeConsultasHoje(),
      loadHomePedidosOnlinePendentes(),
      loadHomeAlerts(),
      loadHomeAcompanhamentoAtivo(),
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
   loadHomeAcompanhamentoAtivo — usa apenas regras já existentes:
   - plano ativo: status=active e expires_at no futuro;
   - precisa de ação: sintomas na readiness, ou o último log tem nota,
     exercício alterado/omitido, ou RPE >= 8;
   - a terminar: expires_at no futuro e a menos de 3 dias.
   Não calcula "Sem atividade" nem "Regular".
   ==================================================================== */
async function loadHomeAcompanhamentoAtivo() {
  const agora = new Date();
  const TRES_DIAS_MS = 3 * 24 * 60 * 60 * 1000;
  const clinicIds = homeClinicId
    ? [homeClinicId]
    : (G.clinics || []).map((clinic) => clinic.id).filter(Boolean);

  if (!clinicIds.length) {
    setHomeAcompanhamentoStats({ total: 0, precisaAcao: 0, aTerminar: 0 });
    homeAcompActionItems = [];
    homeAcompEndingItems = [];
    return;
  }

  try {
    const { data: prescriptions, error: prescriptionsError } = await window.sb
      .from("wo_prescriptions")
      .select("id, patient_id, clinic_id, expires_at")
      .eq("status", "active")
      .gt("expires_at", agora.toISOString())
      .in("clinic_id", clinicIds)
      .limit(500);
    if (prescriptionsError) throw prescriptionsError;

    const rows = prescriptions || [];
    const prescriptionIds = rows.map((row) => row.id);
    const patientByPrescription = new Map(rows.map((row) => [row.id, row.patient_id]));
    const activePatients = new Set(rows.map((row) => row.patient_id).filter(Boolean));
    const endingRows = rows.filter((row) => {
      const remaining = new Date(row.expires_at).getTime() - agora.getTime();
      return remaining > 0 && remaining < TRES_DIAS_MS;
    });
    const endingPatients = new Set(endingRows.map((row) => row.patient_id).filter(Boolean));

    if (!prescriptionIds.length) {
      setHomeAcompanhamentoStats({ total: 0, precisaAcao: 0, aTerminar: 0 });
      homeAcompActionItems = [];
      homeAcompEndingItems = [];
      return;
    }

    const [readinessResult, logsResult] = await Promise.all([
      window.sb
        .from("wo_session_readiness")
        .select("prescription_id, patient_id")
        .in("prescription_id", prescriptionIds)
        .eq("has_symptoms", true)
        .limit(1000),
      window.sb
        .from("wo_session_logs")
        .select("prescription_id, session_id, logged_at, rpe, sets, note")
        .in("prescription_id", prescriptionIds)
        .order("logged_at", { ascending: false })
        .limit(2000),
    ]);
    if (readinessResult.error) throw readinessResult.error;
    if (logsResult.error) throw logsResult.error;

    const actionPatients = new Set(
      (readinessResult.data || []).map((row) => row.patient_id).filter(Boolean)
    );

    const latestLogByPrescription = new Map();
    (logsResult.data || []).forEach((log) => {
      if (!latestLogByPrescription.has(log.prescription_id)) {
        latestLogByPrescription.set(log.prescription_id, log);
      }
    });

    /* Motivos reais de "Precisa de ação", por prescription_id (nunca por
       patient_id — um sinal de uma prescrição nunca deve aparecer
       associado a outra prescrição do mesmo doente). Mesmos 4 critérios
       já usados para os contadores acima, sem alterar nenhum. */
    const HOME_ACOMP_REASON_ORDER = ["Sintomas/dor", "Nota após treino", "Treino alterado/não realizado", "RPE elevado"];
    const reasonsByPrescription = new Map();
    const addReason = (prescriptionId, reason) => {
      if (!prescriptionId) return;
      if (!reasonsByPrescription.has(prescriptionId)) reasonsByPrescription.set(prescriptionId, new Set());
      reasonsByPrescription.get(prescriptionId).add(reason);
    };

    (readinessResult.data || []).forEach((row) => {
      addReason(row.prescription_id, "Sintomas/dor");
    });

    latestLogByPrescription.forEach((log, prescriptionId) => {
      const sets = Array.isArray(log.sets) ? log.sets : [];
      const altered = sets.some((entry) => entry?.status && entry.status !== "as_prescribed");
      const hasNote = Boolean(String(log.note || "").trim());
      const highRpe = Number(log.rpe || 0) >= 8;
      if (hasNote) addReason(prescriptionId, "Nota após treino");
      if (altered) addReason(prescriptionId, "Treino alterado/não realizado");
      if (highRpe) addReason(prescriptionId, "RPE elevado");
      if (hasNote || altered || highRpe) {
        const patientId = patientByPrescription.get(prescriptionId);
        if (patientId) actionPatients.add(patientId);
      }
    });

    /* Listas por PRESCRIÇÃO (nunca deduplicadas por doente — se um doente
       tiver 2 planos ativos sinalizados, aparecem 2 linhas). */
    const actionItems = Array.from(reasonsByPrescription.entries()).map(([prescriptionId, reasonSet]) => ({
      patientId: patientByPrescription.get(prescriptionId) || null,
      prescriptionId,
      patientName: null,
      reasons: HOME_ACOMP_REASON_ORDER.filter((r) => reasonSet.has(r)),
    }));
    const endingItems = endingRows.map((row) => ({
      patientId: row.patient_id || null,
      prescriptionId: row.id,
      patientName: null,
      expiresAt: row.expires_at,
    }));

    /* Nome do doente — única query adicional, só com os IDs que a lista
       vai mesmo mostrar (união de action+ending), nunca N+1. Falha aqui
       nunca invalida os contadores já calculados acima nem faz crashar
       o Home — só cai para o fallback "Doente" em renderHomeAcompanhamentoList. */
    const patientIds = Array.from(new Set(
      [...actionItems, ...endingItems].map((it) => it.patientId).filter(Boolean)
    ));
    if (patientIds.length) {
      try {
        const { data: patientsData, error: patientsError } = await window.sb
          .from("patients")
          .select("id, full_name")
          .in("id", patientIds);
        if (patientsError) throw patientsError;
        const nameById = new Map((patientsData || []).map((p) => [p.id, p.full_name]));
        actionItems.forEach((it) => { it.patientName = nameById.get(it.patientId) || null; });
        endingItems.forEach((it) => { it.patientName = nameById.get(it.patientId) || null; });
      } catch (namesError) {
        console.warn("Home: falha ao carregar nomes de acompanhamento ativo:", namesError);
      }
    }

    homeAcompActionItems = actionItems;
    homeAcompEndingItems = endingItems;

    setHomeAcompanhamentoStats({
      total: activePatients.size,
      precisaAcao: actionPatients.size,
      aTerminar: endingPatients.size,
    });
  } catch (error) {
    console.warn("Home: falha ao carregar acompanhamento ativo:", error);
    setHomeAcompanhamentoStats(null);
    homeAcompActionItems = null;
    homeAcompEndingItems = null;
  }
}

/* openHomeExerciseFollowup — clique numa linha da lista de acompanhamento
   ativo do Home. Nunca "primeiro doente": vem sempre do par exato
   {patientId, prescriptionId} da linha clicada. Mesmo mecanismo genérico
   já usado pelo router de renderCurrentView (view "exercicio-acompanhamento"). */
function openHomeExerciseFollowup(patientId, prescriptionId) {
  if (!patientId || !prescriptionId) return;
  G._exerciseFollowupPatientId = patientId;
  G._exerciseFollowupPrescriptionId = prescriptionId;
  G.currentView = "exercicio-acompanhamento";
  renderCurrentView();
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

/* Expor renderCurrentView globalmente para shell.js */
window.__gc_renderCurrentView = renderCurrentView;
