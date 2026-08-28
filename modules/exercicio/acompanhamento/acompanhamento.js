/* Acompanhamento de Exercício — vista individual do doente. */

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fmtDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

function fmtDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function daysUntil(value) {
  if (!value) return null;
  const end = new Date(value);
  if (Number.isNaN(end.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.ceil((target - today) / 86400000);
}

function styles() {
  return `
.gc-exfollow{max-width:1180px;margin:0 auto;padding:4px 2px 40px;color:#0f172a}
.gc-exfollow-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:18px}
.gc-exfollow-back{border:1px solid #cbd5e1;background:#fff;color:#0f2d52;border-radius:9px;padding:8px 11px;font:650 12px inherit;cursor:pointer}
.gc-exfollow-kicker{font-size:11px;font-weight:750;text-transform:uppercase;letter-spacing:.05em;color:#64748b}
.gc-exfollow-title{margin:3px 0 0;font-size:26px;line-height:1.15;color:#0f2d52;letter-spacing:-.4px}
.gc-exfollow-sub{margin:5px 0 0;font-size:12px;color:#64748b}
.gc-exfollow-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:14px 0 22px}
.gc-exfollow-card{border:1px solid #e2e8f0;background:#fff;border-radius:12px;padding:13px 15px}
.gc-exfollow-card b{display:block;font-size:11px;color:#64748b;margin-bottom:5px}
.gc-exfollow-card strong{font-size:14px;color:#0f172a}
.gc-exfollow-section{border:1px solid #e2e8f0;background:#fff;border-radius:13px;padding:16px;margin-top:12px}
.gc-exfollow-section h2{font-size:15px;color:#0f2d52;margin:0 0 4px}
.gc-exfollow-section p{font-size:12px;color:#64748b;margin:0}
.gc-exfollow-empty{margin-top:12px;border:1px dashed #cbd5e1;border-radius:10px;padding:18px;color:#94a3b8;font-size:12px;text-align:center}
.gc-exfollow-signals{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.gc-exfollow-signal{display:inline-flex;align-items:center;font-size:11.5px;font-weight:650;color:#9a3412;background:#fff7ed;border:1px solid #fed7aa;border-radius:999px;padding:5px 10px}
.gc-exfollow-quote{margin-top:10px;border:1px solid #e2e8f0;background:#f8fafc;border-radius:10px;padding:10px 12px;font-size:12.5px;color:#334155;white-space:pre-wrap}
.gc-exfollow-quote b{display:block;font-size:11px;color:#64748b;margin-bottom:3px;font-weight:650}
.gc-exfollow-meta{display:flex;flex-wrap:wrap;gap:14px;margin-top:12px;font-size:11.5px;color:#64748b}
.gc-exfollow-error{border:1px solid #fecaca;background:#fef2f2;color:#991b1b;border-radius:10px;padding:12px 14px;font-size:12px}
@media(max-width:800px){.gc-exfollow-grid{grid-template-columns:1fr}.gc-exfollow-head{flex-direction:column}.gc-exfollow-back{order:-1}}
`;
}

/* renderAttentionBlock — Bloco 1 ("Porque precisa da minha atenção agora?").
   Usa EXATAMENTE os mesmos sinais objetivos já usados no Home
   (loadHomeAcompanhamentoExercicio em boot.js): readiness mais recente
   (has_symptoms) e último log (rpe>=8, note, sets[].status). Sem
   interpretação clínica, sem IA, sem query a wo_exercises — sets[]
   alterados/não realizados aparecem só como contagem. */
function renderAttentionBlock(readiness, log) {
  const signals = [];
  const quotes = [];

  if (readiness?.has_symptoms === true) {
    signals.push("Sintomas reportados antes do treino");
  }
  if (readiness?.has_symptoms === true) {
    const symptomNote = String(readiness?.symptom_note || "").trim();
    if (symptomNote) {
      quotes.push({ label: "Sintomas reportados pelo doente", text: symptomNote });
    }
  }

  if (log) {
    const rpeNum = Number(log.rpe);
    if (Number.isFinite(rpeNum) && rpeNum >= 8) {
      signals.push(`Esforço elevado · RPE ${rpeNum}/10`);
    }
    const noteText = String(log.note || "").trim();
    if (noteText) {
      signals.push("Comentário do doente");
      quotes.push({ label: "Comentário do doente", text: noteText });
    }
    const sets = Array.isArray(log.sets) ? log.sets : [];
    const alteredCount = sets.filter((e) => e?.status && e.status !== "as_prescribed" && e.status !== "skipped").length;
    const skippedCount = sets.filter((e) => e?.status === "skipped").length;
    if (alteredCount > 0) signals.push(`${alteredCount} exercício${alteredCount === 1 ? "" : "s"} alterado${alteredCount === 1 ? "" : "s"}`);
    if (skippedCount > 0) signals.push(`${skippedCount} exercício${skippedCount === 1 ? "" : "s"} não realizado${skippedCount === 1 ? "" : "s"}`);
  }

  const signalsHtml = signals.length
    ? `<div class="gc-exfollow-signals">${signals.map((s) => `<span class="gc-exfollow-signal">${esc(s)}</span>`).join("")}</div>`
    : `<div class="gc-exfollow-empty">Sem sinais objetivos que exijam atenção no registo mais recente.</div>`;

  const quotesHtml = quotes.map((q) => `<div class="gc-exfollow-quote"><b>${esc(q.label)}</b>${esc(q.text)}</div>`).join("");

  const metaParts = [];
  if (readiness?.answered_at) metaParts.push(`Readiness mais recente: ${fmtDateTime(readiness.answered_at)}`);
  if (log?.logged_at) metaParts.push(`Último registo de treino: ${fmtDateTime(log.logged_at)}`);
  if (log?.feel != null && log.feel !== "") metaParts.push(`Sensação pós-treino: ${log.feel}/5`);
  const metaHtml = metaParts.length
    ? `<div class="gc-exfollow-meta">${metaParts.map((m) => `<span>${esc(m)}</span>`).join("")}</div>`
    : "";

  return `${signalsHtml}${quotesHtml}${metaHtml}`;
}

function renderShell(root, patient, prescription, readiness, log) {
  const remaining = daysUntil(prescription?.expires_at);
  const endLabel = remaining === null
    ? "—"
    : remaining < 0
      ? "Terminado"
      : remaining === 0
        ? "Termina hoje"
        : `Termina em ${remaining} dia${remaining === 1 ? "" : "s"}`;

  root.innerHTML = `
    <style>${styles()}</style>
    <section class="gc-exfollow">
      <div class="gc-exfollow-head">
        <div>
          <div class="gc-exfollow-kicker">Acompanhamento de Exercício</div>
          <h1 class="gc-exfollow-title">${esc(patient?.full_name || "Doente")}</h1>
          <p class="gc-exfollow-sub">Plano ${fmtDate(prescription?.created_at)} → ${fmtDate(prescription?.expires_at)}</p>
        </div>
        <button type="button" class="gc-exfollow-back" id="gcExFollowBack">Voltar ao Início</button>
      </div>

      <div class="gc-exfollow-grid">
        <div class="gc-exfollow-card"><b>Estado do plano</b><strong>${esc(prescription?.status || "—")}</strong></div>
        <div class="gc-exfollow-card"><b>Fim do plano</b><strong>${esc(endLabel)}</strong></div>
        <div class="gc-exfollow-card"><b>Primeira abertura</b><strong>${fmtDate(prescription?.first_opened_at)}</strong></div>
      </div>

      <div class="gc-exfollow-section">
        <h2>Porque precisa da minha atenção agora?</h2>
        <p>Sinais objetivos do registo mais recente — sem interpretação clínica.</p>
        ${renderAttentionBlock(readiness, log)}
      </div>

      <div class="gc-exfollow-section">
        <h2>Linha temporal do plano</h2>
        <p>Sessões realizadas, previstas, não realizadas e removidas.</p>
        <div class="gc-exfollow-empty">Estrutura preparada.</div>
      </div>

      <div class="gc-exfollow-section">
        <h2>Evolução clínica global</h2>
        <p>Sintomas, RPE, sensação pós-treino, adesão e alterações.</p>
        <div class="gc-exfollow-empty">Estrutura preparada.</div>
      </div>

      <div class="gc-exfollow-section">
        <h2>Evolução por exercício</h2>
        <p>Prescrito versus realizado e progressão ao longo das sessões.</p>
        <div class="gc-exfollow-empty">Estrutura preparada.</div>
      </div>

      <div class="gc-exfollow-section">
        <h2>Decisão / Ação médica</h2>
        <p>Área preparada para fechar o circuito de acompanhamento.</p>
        <div class="gc-exfollow-empty">Sem ações implementadas nesta passagem.</div>
      </div>
    </section>`;
}

export async function initAcompanhamentoExercicio({ patientId, prescriptionId, onBack } = {}) {
  const root = document.getElementById("gcExFollowRoot");
  if (!root) throw new Error("Contentor #gcExFollowRoot não encontrado.");

  if (!patientId || !prescriptionId) {
    root.innerHTML = `<style>${styles()}</style><div class="gc-exfollow"><div class="gc-exfollow-error">Não foi possível abrir o acompanhamento: falta identificar o doente ou o plano.</div></div>`;
    return;
  }

  const [patientRes, prescriptionRes, readinessRes, logsRes] = await Promise.all([
    window.sb.from("patients").select("id, full_name").eq("id", patientId).maybeSingle(),
    window.sb.from("wo_prescriptions").select("id, patient_id, clinic_id, status, created_at, expires_at, first_opened_at").eq("id", prescriptionId).eq("patient_id", patientId).maybeSingle(),
    window.sb.from("wo_session_readiness").select("session_id, has_symptoms, symptom_note, answered_at").eq("prescription_id", prescriptionId).order("answered_at", { ascending: false }).limit(1),
    window.sb.from("wo_session_logs").select("session_id, logged_at, rpe, feel, note, sets").eq("prescription_id", prescriptionId).order("logged_at", { ascending: false }).limit(1),
  ]);

  if (patientRes.error) throw patientRes.error;
  if (prescriptionRes.error) throw prescriptionRes.error;
  if (readinessRes.error) throw readinessRes.error;
  if (logsRes.error) throw logsRes.error;
  if (!patientRes.data || !prescriptionRes.data) {
    root.innerHTML = `<style>${styles()}</style><div class="gc-exfollow"><div class="gc-exfollow-error">Acompanhamento não encontrado ou sem acesso.</div></div>`;
    return;
  }

  const latestReadiness = (readinessRes.data || [])[0] || null;
  const latestLog = (logsRes.data || [])[0] || null;

  renderShell(root, patientRes.data, prescriptionRes.data, latestReadiness, latestLog);

  document.getElementById("gcExFollowBack")?.addEventListener("click", () => {
    if (typeof onBack === "function") onBack();
  });
}
