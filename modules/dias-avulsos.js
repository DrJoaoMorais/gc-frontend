import { openScheduleModal } from './agenda-disponibilidade.js';
/* ========================================================
   DIAS-AVULSOS.JS — Turnos de consulta avulsos por data
   --------------------------------------------------------
   Disponibilidade ad-hoc (Liga, Athletix, Filipe Cachopas…)
   Grava só uma linha em dias_consulta_avulsos.
   NÃO cria appointments — não toca na contabilização.
   ======================================================== */

import { escapeHtml } from "./helpers.js";

/* dataISO = "YYYY-MM-DD". Devolve true se o dia já tem
   consultas abertas (padrão recorrente OU turno avulso). */
export async function verificarDiaAberto(clinicId, dataISO) {
  if (!clinicId || !dataISO) return true; // sem dados → não incomodar
  const dow = new Date(dataISO + "T00:00:00").getDay(); // 0=Dom … 6=Sáb

  try {
    const [rec, avulso] = await Promise.all([
      window.sb.from("horarios_recorrentes")
        .select("id")
        .eq("clinic_id", clinicId)
        .eq("day_of_week", dow)
        .eq("is_active", true)
        .limit(1),
      window.sb.from("dias_consulta_avulsos")
        .select("id")
        .eq("clinic_id", clinicId)
        .eq("data", dataISO)
        .limit(1),
    ]);
    const temRec    = (rec.data || []).length > 0;
    const temAvulso = (avulso.data || []).length > 0;
    return temRec || temAvulso;
  } catch (e) {
    console.error("verificarDiaAberto:", e);
    return true; // em erro, não bloquear o fluxo
  }
}

/* Mini-modal para abrir um turno avulso.
   onCriado() é chamado após gravar com sucesso. */
export function abrirMiniModalCriarTurno({ clinicId, dataISO, clinicName, onCriado }) {
  return openScheduleModal({clinicId,day:dataISO,onSaved:onCriado});
}
