/* ========================================================
   DB.JS — Queries Supabase
   --------------------------------------------------------
   02A — Constantes e helpers da agenda
      02A.1  APPT_TIME_COL_CANDIDATES
      02A.2  APPT_END_COL_CANDIDATES
      02A.3  pickFirstExisting(obj, candidates)

   02B — Load da agenda
      02B.1  loadAppointmentsForRange({ clinicId, startISO, endISO })

   02C — Scope de doentes (interno — substituído pelo fix 02E)
      02C.1  listPatientIdsForScope({ clinicId })   [legado/fallback]

   02D — Construção de filtros de pesquisa
      02D.1  buildPatientOrFilter(termRaw)

   02E — Pesquisa de doentes  ✅ FIX: 2 queries → 1 query com JOIN
      02E.1  searchPatientsScoped({ clinicId, q, limit })

   02F — RPC criação/transferência de doente
      02F.1  rpcCreatePatientForClinic(payload)

   02G — Fetch de doentes por IDs
      02G.1  fetchPatientsByIds(patientIds)

   02H — Fetch de doente individual
      02H.1  fetchPatientById(patientId)

   02I — Atualização de doente
      02I.1  updatePatient(patientId, payload)
   ======================================================== */

import { normalizeDigits } from "./helpers.js";

/* Campos de doente usados em todos os SELECTs */
const PATIENT_FIELDS =
  "id, full_name, dob, phone, email, external_id, sns, nif, passport_id, " +
  "insurance_provider, insurance_policy_number, address_line1, postal_code, " +
  "city, country, notes";

const PATIENT_FIELDS_FULL = PATIENT_FIELDS + ", is_active";


/* ==== 02A — Constantes e helpers da agenda ==== */

/* ---- 02A.1 — APPT_TIME_COL_CANDIDATES ---- */
export const APPT_TIME_COL_CANDIDATES = ["start_at", "starts_at", "start_time", "start_datetime", "start"];

/* ---- 02A.2 — APPT_END_COL_CANDIDATES ---- */
export const APPT_END_COL_CANDIDATES  = ["end_at", "ends_at", "end_time", "end_datetime", "end"];

/* ---- 02A.3 — pickFirstExisting ---- */
export function pickFirstExisting(obj, candidates) {
  for (const k of candidates) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, k) && obj[k] != null) return k;
  }
  return null;
}


/* ==== 02B — Load da agenda ==== */

/* ---- 02B.1 — loadAppointmentsForRange ---- */
export async function loadAppointmentsForRange({ clinicId, startISO, endISO }) {
  let lastErr = null;

  for (const col of APPT_TIME_COL_CANDIDATES) {
    try {
      let q = window.sb
        .from("appointments")
        .select("*")
        .gte(col, startISO)
        .lt(col, endISO)
        .order(col, { ascending: true });

      // Filtrar por clínica mas incluir bloqueios globais
      if (clinicId) {
        q = q.or(`clinic_id.eq.${clinicId},and(clinic_id.is.null,mode.eq.bloqueio)`);
      }

      const { data, error } = await q;
      if (error) throw error;

      return { data: Array.isArray(data) ? data : [], timeColUsed: col };
    } catch (e) {
      lastErr = e;
    }
  }

  throw lastErr || new Error("Não foi possível carregar appointments: nenhuma coluna de tempo reconhecida.");
}


/* ==== 02C — Scope de doentes (fallback interno) ==== */

/* ---- 02C.1 — listPatientIdsForScope ---- */
async function listPatientIdsForScope({ clinicId }) {
  let q = window.sb
    .from("patient_clinic")
    .select("patient_id, clinic_id")
    .eq("is_active", true)
    .limit(2000);

  if (clinicId) q = q.eq("clinic_id", clinicId);

  const { data, error } = await q;
  if (error) throw error;

  const ids = (data || []).map((r) => r.patient_id).filter(Boolean);
  return { ids, rows: data || [] };
}


/* ==== 02D — Construção de filtros de pesquisa ==== */

/* ---- 02D.0 — stripAccents ---- */
/* Remove acentos e diacríticos de uma string.
   "Sérgio" → "Sergio", "João" → "Joao", "Conceição" → "Conceicao"
   Usa NFD (decomposição canónica) + remoção de combining marks (U+0300–U+036F). */
function stripAccents(str) {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/* ---- 02D.1 — buildPatientOrFilter ---- */
export function buildPatientOrFilter(termRaw) {
  const term         = String(termRaw || "").trim();
  const termStripped = stripAccents(term);   /* versão sem acentos */
  const digits       = normalizeDigits(term);

  const parts = [];

  if (term.length >= 2) {
    const safe         = term.replaceAll(",", " ");
    const safeStripped = termStripped.replaceAll(",", " ");

    /* Pesquisa com o termo original (apanha "Sérgio" se escrever "Sérgio") */
    parts.push(`full_name.ilike.%${safe}%`);
    parts.push(`email.ilike.%${safe}%`);
    parts.push(`passport_id.ilike.%${safe}%`);
    parts.push(`external_id.ilike.%${safe}%`);

    /* Pesquisa sem acentos (apanha "Sérgio" se escrever "Sergio") */
    if (safeStripped !== safe) {
      parts.push(`full_name.ilike.%${safeStripped}%`);
      parts.push(`email.ilike.%${safeStripped}%`);
      parts.push(`passport_id.ilike.%${safeStripped}%`);
      parts.push(`external_id.ilike.%${safeStripped}%`);
    }
  }

  if (digits.length >= 3) parts.push(`phone.ilike.%${digits}%`);

  if (digits.length === 9) {
    parts.push(`sns.eq.${digits}`);
    parts.push(`nif.eq.${digits}`);
  }

  if (/^[A-Za-z0-9]{4,20}$/.test(term)) {
    parts.push(`passport_id.eq.${term.replaceAll(",", " ")}`);
  }

  return [...new Set(parts)].join(",");
}


/* ==== 02E — Pesquisa de doentes ✅ FIX: 1 query directa com JOIN ==== */

/* ---- 02E.1 — searchPatientsScoped ---- */
export async function searchPatientsScoped({ clinicId, q, limit = 12 }) {
  const term = (q || "").trim();
  if (!term || term.length < 2) return [];

  const orStr = buildPatientOrFilter(term);
  if (!orStr) return [];

  try {
    // ✅ FIX: query única com JOIN directo
    // Em vez de carregar até 2000 IDs e depois filtrar,
    // filtra directamente na base de dados com JOIN
    let query = window.sb
      .from("patients")
      .select(`${PATIENT_FIELDS}, patient_clinic!inner(clinic_id, is_active)`)
      .eq("is_active", true)
      .eq("patient_clinic.is_active", true)
      .or(orStr)
      .order("full_name", { ascending: true })
      .limit(limit);

    if (clinicId) {
      query = query.eq("patient_clinic.clinic_id", clinicId);
    }

    const { data: pts, error: pErr } = await query;
    if (pErr) throw pErr;

    // Remover campo patient_clinic do resultado final
    return (Array.isArray(pts) ? pts : []).map(({ patient_clinic: _pc, ...p }) => p);

  } catch (joinErr) {
    // Fallback para método original se o JOIN não for suportado
    console.warn("[db] searchPatientsScoped JOIN falhou, a usar fallback:", joinErr?.message);

    const { ids } = await listPatientIdsForScope({ clinicId });
    if (ids.length === 0) return [];

    const { data: pts, error: pErr } = await window.sb
      .from("patients")
      .select(PATIENT_FIELDS)
      .in("id", ids)
      .eq("is_active", true)
      .or(orStr)
      .order("full_name", { ascending: true })
      .limit(limit);

    if (pErr) throw pErr;
    return Array.isArray(pts) ? pts : [];
  }
}


/* ==== 02F — RPC criação/transferência de doente ==== */

/* ---- 02F.1 — rpcCreatePatientForClinic ---- */
export async function rpcCreatePatientForClinic(payload) {
  const { data, error } = await window.sb.rpc("create_patient_for_clinic_v2", payload);
  if (error) throw error;

  const patientId = data?.patient_id || null;
  const action    = data?.action     || "created";

  if (!patientId) throw new Error("RPC create_patient_for_clinic_v2 devolveu patient_id vazio");

  if (action === "reused_transferred") {
    const ok = confirm(
      "Este doente já existia noutra clínica.\n\n" +
      "Confirmas a transferência para a clínica atual?"
    );

    if (!ok) {
      const clinicId = payload?.p_clinic_id || payload?.clinic_id || null;
      try {
        if (clinicId) {
          await window.sb
            .from("patient_clinic")
            .update({ is_active: false })
            .eq("patient_id", patientId)
            .eq("clinic_id", clinicId);
        }

        const { data: prevRows } = await window.sb
          .from("patient_clinic")
          .select("id, clinic_id, created_at")
          .eq("patient_id", patientId)
          .order("created_at", { ascending: false })
          .limit(5);

        const prev = (prevRows || []).find(r => r.clinic_id !== clinicId);
        if (prev?.clinic_id) {
          await window.sb
            .from("patient_clinic")
            .update({ is_active: true })
            .eq("patient_id", patientId)
            .eq("clinic_id", prev.clinic_id);
        }
      } catch (e) {
        console.warn("Reversão de transferência falhou:", e);
      }

      throw new Error("TRANSFER_CANCELLED");
    }
  }

  return patientId;
}


/* ==== 02G — Fetch de doentes por IDs ==== */

/* ---- 02G.1 — fetchPatientsByIds ---- */
export async function fetchPatientsByIds(patientIds) {
  const ids = Array.from(new Set((patientIds || []).filter(Boolean)));
  if (ids.length === 0) return {};

  const CHUNK = 150;
  const out   = {};

  for (let i = 0; i < ids.length; i += CHUNK) {
    const part = ids.slice(i, i + CHUNK);

    const { data, error } = await window.sb
      .from("patients")
      .select(PATIENT_FIELDS)
      .in("id", part)
      .eq("is_active", true);

    if (error) throw error;
    for (const p of data || []) out[p.id] = p;
  }

  return out;
}


/* ==== 02H — Fetch de doente individual ==== */

/* ---- 02H.1 — fetchPatientById ---- */
export async function fetchPatientById(patientId) {
  if (!patientId) return null;

  const { data, error } = await window.sb
    .from("patients")
    .select(PATIENT_FIELDS_FULL)
    .eq("id", patientId)
    .limit(1);

  if (error) throw error;
  if (!data || data.length === 0) return null;
  return data[0];
}


/* ==== 02J — Tipos de procedimento ==== */

/* ---- 02J.1 — fetchProcedureTypes ---- */
export async function fetchProcedureTypes() {
  const { data, error } = await window.sb
    .from("procedure_types")
    .select("name")
    .eq("active", true)
    .order("id", { ascending: true });

  if (error) throw error;
  return (Array.isArray(data) ? data : []).map(r => r.name).filter(Boolean);
}


/* ==== 02I — Atualização de doente ==== */

/* ---- 02I.1 — updatePatient ---- */
export async function updatePatient(patientId, payload) {
  if (!patientId) throw new Error("patientId em falta");

  const { data, error } = await window.sb
    .from("patients")
    .update(payload)
    .eq("id", patientId)
    .select(PATIENT_FIELDS_FULL)
    .limit(1);

  if (error) throw error;
  if (!data || data.length === 0) return null;
  return data[0];
}
