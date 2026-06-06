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
  const DOW = ["domingo","segunda","terça","quarta","quinta","sexta","sábado"];
  const MESES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  const d = new Date(dataISO + "T00:00:00");
  const dataLabel = `${DOW[d.getDay()]}, ${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;

  const ov = document.createElement("div");
  ov.id = "gcTurnoOverlay";
  ov.style.cssText = "position:fixed;inset:0;background:rgba(15,45,82,0.3);display:flex;align-items:center;justify-content:center;z-index:2000;padding:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;";
  ov.innerHTML = `
    <div style="background:#fff;border-radius:14px;border:1px solid #e2e8f0;box-shadow:0 4px 24px rgba(15,45,82,0.15);width:min(360px,100%);">
      <div style="padding:14px 16px;border-bottom:1px solid #f1f5f9;">
        <div style="font-size:15px;font-weight:700;color:#0f2d52;">Abrir dia de consultas</div>
        <div style="font-size:11px;color:#64748b;margin-top:2px;">${escapeHtml(clinicName || "")} · ${escapeHtml(dataLabel)}</div>
      </div>
      <div style="padding:16px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
          <div>
            <label style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;display:block;margin-bottom:4px;">Início</label>
            <input id="gcTurnoIni" type="time" value="17:00" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #e2e8f0;font-size:13px;font-family:inherit;color:#1e293b;box-sizing:border-box;" />
          </div>
          <div>
            <label style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;display:block;margin-bottom:4px;">Fim</label>
            <input id="gcTurnoFim" type="time" value="19:00" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #e2e8f0;font-size:13px;font-family:inherit;color:#1e293b;box-sizing:border-box;" />
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
          <label style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;">Duração slot (min)</label>
          <input id="gcTurnoDur" type="number" min="5" max="120" step="5" value="15" style="width:64px;padding:6px 8px;border-radius:8px;border:1px solid #e2e8f0;font-size:13px;font-family:inherit;color:#1e293b;" />
        </div>
        <div style="background:#eff6ff;border-left:3px solid #1a56db;padding:8px 10px;font-size:11px;color:#1e40af;line-height:1.5;">
          Abre o dia só desta vez. Não cria padrão fixo.
        </div>
        <div id="gcTurnoMsg" style="font-size:11px;color:#b00020;min-height:14px;margin-top:8px;"></div>
      </div>
      <div style="padding:12px 16px;border-top:1px solid #f1f5f9;display:flex;gap:8px;justify-content:flex-end;">
        <button id="gcTurnoCancel" class="gcBtnGhost" style="font-size:13px;padding:7px 14px;border-radius:8px;">Cancelar</button>
        <button id="gcTurnoSave" class="gcBtnPrimary" style="font-size:13px;padding:7px 16px;border-radius:8px;font-weight:600;">Abrir dia</button>
      </div>
    </div>`;

  document.body.appendChild(ov);
  const close = () => ov.remove();
  ov.addEventListener("click", e => { if (e.target === ov) close(); });
  ov.querySelector("#gcTurnoCancel").addEventListener("click", close);

  ov.querySelector("#gcTurnoSave").addEventListener("click", async () => {
    const ini = ov.querySelector("#gcTurnoIni").value;
    const fim = ov.querySelector("#gcTurnoFim").value;
    const dur = parseInt(ov.querySelector("#gcTurnoDur").value) || 15;
    const msg = ov.querySelector("#gcTurnoMsg");
    const btn = ov.querySelector("#gcTurnoSave");
    msg.textContent = "";

    if (!ini || !fim) { msg.textContent = "Indica hora de início e fim."; return; }
    if (fim <= ini)   { msg.textContent = "A hora de fim tem de ser depois do início."; return; }

    btn.disabled = true;
    btn.textContent = "A abrir…";
    try {
      const { data: u } = await window.sb.auth.getUser();
      const { error } = await window.sb.from("dias_consulta_avulsos").insert({
        clinic_id: clinicId,
        data: dataISO,
        hora_inicio: ini,
        hora_fim: fim,
        duracao_min: dur,
        criado_por: u?.user?.id || null,
      });
      if (error) {
        if (error.code === "23505") { msg.textContent = "Já existe um turno a esta hora neste dia."; }
        else throw error;
        btn.disabled = false; btn.textContent = "Abrir dia";
        return;
      }
      close();
      if (typeof onCriado === "function") onCriado();
    } catch (e) {
      msg.textContent = "Erro: " + (e.message || e);
      btn.disabled = false;
      btn.textContent = "Abrir dia";
    }
  });

  setTimeout(() => ov.querySelector("#gcTurnoIni")?.focus(), 50);
}
