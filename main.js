/**
 * main.js — Passo 8/9
 * Ponto de entrada ES6 que substitui app.js (Passo 9: trocar linha no app.html).
 *
 * Importa todos os módulos e:
 *   1. Recria as pontes window.__gc_* que os módulos doente.js / exames.js /
 *      analises.js consomem via window (vindas do bloco 06Fa do app.js original).
 *   2. Regista o boot no DOMContentLoaded.
 *
 * ESTRUTURA DE MÓDULOS
 * ─────────────────────
 *  config.js   → G, UI
 *  helpers.js  → utilitários de data/string
 *  state.js    → estado da app
 *  auth.js     → MFA, roles, logout
 *  db.js       → queries Supabase
 *  shell.js    → render HTML+CSS (sidebar, header, estilos)
 *  agenda.js   → agenda completa, marcações, GCAL Worker
 *  doente.js   → openPatientViewModal, openNewPatientMainModal
 *  pesquisa.js → wireQuickPatientSearch, openCalendarOverlay
 *  exames.js   → openExamsPanel, buildExamRequestHtml
 *  analises.js → openAnalisesModal, ANALISES_CATALOG
 *  session.js  → __gcForceSessionLock, ensureAAL2, wireLogout
 *  boot.js     → boot()
 */

/* ── imports ─────────────────────────────────────────────────────────── */

// Módulos de base (sem side-effects — apenas expõem funções/constantes)
import { G, UI }              from "./modules/config.js";
import "./modules/state.js";   // inicializa G se necessário
import "./modules/helpers.js"; // sem exports diretos necessários aqui

// Módulos de serviço
import { fetchMyRole, fetchVisibleClinics } from "./modules/auth.js";
import { searchPatientsScoped }             from "./modules/db.js";
import {
  renderAppShell,
  renderClinicsSelect,
  hydrateShellHeader
}                                           from "./modules/shell.js";

// Agenda
import {
  setAgendaSubtitleForSelectedDay,
  refreshAgenda,
  openApptModal
}                                           from "./modules/agenda.js";

// Doente
import {
  openPatientViewModal,
  openNewPatientMainModal,
  renderQuickPatientResults
}                                           from "./modules/doente.js";

// Pesquisa + Calendário
import {
  wireQuickPatientSearch,
  openCalendarOverlay
}                                           from "./modules/pesquisa.js";

// Exames
import {
  openExamsPanel,
  closeExamsPanel,
  examsUiState,
  loadExamsCatalog,
  buildExamRequestHtml
}                                           from "./modules/exames.js";

// Análises
import {
  openAnalisesModal,
  gerarAnalisePdf,
  buildAnalisesHtml,
  ANALISES_CATALOG
}                                           from "./modules/analises.js";

// Sessão + MFA
import {
  __gcSessionLockActive,
  __gcIsAuthError,
  __gcForceSessionLock,
  __gcRenderSessionLockedScreen,
  wireLogout,
  ensureAAL2
}                                           from "./modules/session.js";

// Boot
import { boot }                             from "./modules/boot.js";

/* ── pontes window.__gc_* ────────────────────────────────────────────── */
/*
 * Os módulos doente.js, exames.js e analises.js consomem estas funções via
 * window.* porque foram escritos dentro do contexto do app.js (IIFE).
 * O pdf.js (Passo 7, pendente) irá exportá-las diretamente; até lá,
 * e para manter compatibilidade com qualquer código legacy, expomo-las
 * também via window logo que o módulo carrega.
 *
 * NOTA: As implementações reais de storageSignedUrl, urlToDataUrl,
 * openDocumentEditor, etc. vivem em doente.js / pdf.js.
 * Aqui garantimos que o namespace window.__gc_* está preenchido
 * ANTES de qualquer chamada dos outros módulos.
 *
 * Se pdf.js ainda não estiver refatorado, estas pontes são no-ops seguros
 * que o pdf.js original (dentro do app.js) substituirá quando for integrado.
 */

// Constantes de Storage (usadas em exames.js e analises.js)
window.__gc_VINHETA_BUCKET  = "clinic-private";
window.__gc_VINHETA_PATH    = "vinheta/vinheta_web.png";
window.__gc_SIGNATURE_PATH  = "signatures/signature_dr_joao_morais.png";

// URL do GCAL Worker (usado em agenda.js)
window.__GC_GCAL_WORKER_URL__ = "https://gc-gcal.dr-joao-morais.workers.dev";

/**
 * storageSignedUrl — helper de URL assinado do Supabase Storage.
 * Exposto via window para uso em módulos que ainda acedem via window.
 */
async function storageSignedUrl(bucket, path, expiresSec = 3600) {
  try {
    if (!bucket || !path) return "";
    const s = await window.sb.storage.from(bucket).createSignedUrl(path, expiresSec);
    return s?.data?.signedUrl ? String(s.data.signedUrl) : "";
  } catch (e) {
    console.warn("storageSignedUrl error:", e);
    return "";
  }
}

/**
 * urlToDataUrl — converte um URL em base64 data-URL.
 */
async function urlToDataUrl(url, fallbackMime = "image/png") {
  try {
    if (!url) return "";
    const res = await fetch(url, { method: "GET", cache: "no-store" });
    if (!res.ok) throw new Error(`urlToDataUrl fetch ${res.status}`);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const r    = new FileReader();
      r.onload   = () => resolve(String(r.result || ""));
      r.onerror  = () => reject(new Error("FileReader error"));
      r.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn("urlToDataUrl error:", e);
    return "";
  }
}

/**
 * fetchClinicForPdf
 * Carrega a clínica ativa do utilizador atual para uso nos PDFs.
 * Equivalente ao fetchClinicForPdf do bloco 06Fa do app.js.
 */
async function fetchClinicForPdf() {
  const { data: { user } } = await window.sb.auth.getUser();
  if (!user) throw new Error("Sem utilizador autenticado.");

  // Apanha o clinic_id via appointments ou via patient_clinic
  // Fallback: primeira clínica visível em G.clinics
  const clinics = G.clinics || [];
  if (!clinics.length) throw new Error("Sem clínicas carregadas.");

  // Usa a clínica actualmente seleccionada no selector, se existir
  const sel      = document.getElementById("selClinic");
  const clinicId = (sel && sel.value) ? sel.value : clinics[0]?.id;
  if (!clinicId) throw new Error("Sem clínica ativa.");

  const { data: clinic, error } = await window.sb
    .from("clinics")
    .select("id, name, address_line1, address_line2, postal_code, city, phone, email, website, logo_url")
    .eq("id", clinicId)
    .single();

  if (error || !clinic) throw new Error("Não consegui carregar dados da clínica.");
  return clinic;
}

// Expor via window (analises.js e exames.js consomem estas pontes)
window.__gc_storageSignedUrl  = storageSignedUrl;
window.__gc_urlToDataUrl      = urlToDataUrl;
window.__gc_fetchClinicForPdf = fetchClinicForPdf;

// openDocumentEditor será exposto pelo pdf.js quando integrado.
// Por agora, garantimos que a propriedade existe para evitar crashes.
if (!window.openDocumentEditor) {
  window.openDocumentEditor = (html, title) => {
    console.warn("[main.js] openDocumentEditor ainda não disponível. pdf.js pendente.", title);
    alert("Editor de documentos ainda não disponível nesta versão modular. pdf.js pendente.");
  };
}

/* ── expor funções necessárias globalmente (compatibilidade) ─────────── */
/*
 * Alguns event listeners inline no HTML (ou em partes do código não
 * refatoradas) podem chamar funções pelo nome global. Expomo-las aqui
 * para manter compatibilidade durante a transição.
 */
window.openPatientViewModal    = openPatientViewModal;
window.openNewPatientMainModal = openNewPatientMainModal;
window.openApptModal           = openApptModal;
window.openExamsPanel          = openExamsPanel;
window.closeExamsPanel         = closeExamsPanel;
window.openAnalisesModal       = openAnalisesModal;
window.openCalendarOverlay     = openCalendarOverlay;
window.refreshAgenda           = refreshAgenda;

/* ── arranque ────────────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", boot);
