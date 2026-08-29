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

/* fmtSessionDate — formata datas "yyyy-mm-dd" (session_date/data de sessão)
   como dd-mm-aaaa, forçando meia-noite LOCAL (evita o dia mudar por causa
   de fuso horário quando a string não tem hora, mesmo padrão já usado em
   fmtHomeAcompDatePt no Home). Devolve null (não "—") para poder distinguir
   "sem data" de "data inválida" em quem chama. */
function fmtSessionDate(value) {
  if (!value) return null;
  const isDateOnly = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
  const d = isDateOnly ? new Date(`${value}T00:00:00`) : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

/* todayISODate — "yyyy-mm-dd" local, para comparar com session_date (string
   ISO), sem depender de fuso do servidor. */
function todayISODate() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/* fmtDurationHuman — segundos → texto humano ("1 min", "1 min 30 s", "1 h").
   null quando o valor não é um número válido (nunca inventar "0 s" para um
   campo ausente). */
function fmtDurationHuman(totalSec) {
  const n = Number(totalSec);
  if (!Number.isFinite(n) || n < 0) return null;
  const sec = Math.round(n);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const parts = [];
  if (h > 0) parts.push(`${h} h`);
  if (m > 0) parts.push(`${m} min`);
  if (s > 0) parts.push(`${s} s`);
  return parts.length ? parts.join(" ") : "0 s";
}

/* computeSetsCounts — contagem objetiva de sets[] alterados/não realizados
   de um log, sem nomes de exercício (sem query a wo_exercises). Partilhada
   por vários blocos visuais para não duplicar a mesma regra. */
function computeSetsCounts(log) {
  const sets = Array.isArray(log?.sets) ? log.sets : [];
  const altered = sets.filter((e) => e?.status && e.status !== "as_prescribed" && e.status !== "skipped").length;
  const skipped = sets.filter((e) => e?.status === "skipped").length;
  return { altered, skipped };
}

/* truncateText — trecho curto para pré-visualização no cabeçalho fechado da
   sessão (sintomas/comentário). Nunca inventa texto: só corta o real. */
function truncateText(text, maxLen) {
  const t = String(text || "").trim();
  if (!t) return "";
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1).trimEnd()}…`;
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
.gc-exfollow-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:16px}
.gc-exfollow-back{border:1px solid #cbd5e1;background:#fff;color:#0f2d52;border-radius:9px;padding:8px 11px;font:650 12px inherit;cursor:pointer}
.gc-exfollow-kicker{font-size:11px;font-weight:750;text-transform:uppercase;letter-spacing:.05em;color:#64748b}
.gc-exfollow-title{margin:3px 0 0;font-size:26px;line-height:1.15;color:#0f2d52;letter-spacing:-.4px}
.gc-exfollow-sub{margin:5px 0 0;font-size:12px;color:#64748b}
.gc-exfollow-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:12px 0 14px}
.gc-exfollow-card{border:1px solid #e2e8f0;background:#fff;border-radius:12px;padding:11px 14px}
.gc-exfollow-card b{display:block;font-size:11px;color:#64748b;margin-bottom:4px}
.gc-exfollow-card strong{font-size:14px;color:#0f172a}
.gc-exfollow-section{border:1px solid #e2e8f0;background:#fff;border-radius:13px;padding:14px 16px;margin-top:10px}
.gc-exfollow-section h2{font-size:15px;color:#0f2d52;margin:0 0 4px}
.gc-exfollow-section p{font-size:12px;color:#64748b;margin:0}
.gc-exfollow-empty{margin-top:10px;border:1px dashed #cbd5e1;border-radius:10px;padding:14px;color:#94a3b8;font-size:12px;text-align:center}
.gc-exfollow-note-muted{font-size:11.5px;color:#94a3b8;font-style:italic;padding:2px 0}
.gc-exfollow-signals{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.gc-exfollow-signal{display:inline-flex;align-items:center;font-size:11.5px;font-weight:650;color:#9a3412;background:#fff7ed;border:1px solid #fed7aa;border-radius:999px;padding:5px 10px}
.gc-exfollow-quote{margin-top:10px;border:1px solid #e2e8f0;background:#f8fafc;border-radius:10px;padding:10px 12px;font-size:12.5px;color:#334155;white-space:pre-wrap}
.gc-exfollow-quote b{display:block;font-size:11px;color:#64748b;margin-bottom:3px;font-weight:650}
.gc-exfollow-meta{display:flex;flex-wrap:wrap;gap:14px;margin-top:12px;font-size:11.5px;color:#64748b}

/* 3 cartões compactos (Evolução clínica / Evolução por exercício / Decisão). */
.gc-exfollow-mini-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:10px}
.gc-exfollow-mini-card{border:1px solid #e2e8f0;background:#fff;border-radius:12px;padding:13px 14px}
.gc-exfollow-mini-icon{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:8px;background:#eff6ff;color:#1d4ed8;font-size:14px;margin-bottom:7px}
.gc-exfollow-mini-card h3{font-size:12.5px;margin:0 0 3px;color:#0f2d52}
.gc-exfollow-mini-card p{font-size:11px;color:#64748b;margin:0 0 8px;line-height:1.4}
.gc-exfollow-mini-link{font-size:11px;font-weight:650;color:#1d4ed8}

/* Linha temporal — lista compacta tipo tabela, uma linha por sessão. */
.gc-exfollow-timeline{border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;background:#fff;margin-top:10px}
.gc-exfollow-tl-item{padding:9px 14px;border-bottom:1px solid #eef2f6}
.gc-exfollow-tl-item:last-child{border-bottom:none}
.gc-exfollow-tl-item.gc-exfollow-tl-flagged{border-left:3px solid #f59e0b;padding-left:11px}
.gc-exfollow-row{display:flex;align-items:center;gap:16px}
.gc-exfollow-row-date{display:flex;align-items:flex-start;gap:7px;flex:0 0 auto;min-width:112px}
.gc-exfollow-row-icon{width:9px;height:9px;border-radius:50%;flex:0 0 auto;margin-top:6px;background:#cbd5e1}
.gc-exfollow-tl-date{font-size:13px;font-weight:750;color:#0f172a;line-height:1.3}
.gc-exfollow-tl-badge{display:inline-block;font-size:10.5px;font-weight:650;border-radius:999px;padding:2px 8px;white-space:nowrap;margin-top:2px}
.gc-exfollow-tl-ok .gc-exfollow-row-icon{background:#10b981}
.gc-exfollow-tl-ok .gc-exfollow-tl-badge{background:#ecfdf5;color:#047857;border:1px solid #a7f3d0}
.gc-exfollow-tl-today .gc-exfollow-row-icon{background:#3b82f6}
.gc-exfollow-tl-today .gc-exfollow-tl-badge{background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe}
.gc-exfollow-tl-neutral .gc-exfollow-row-icon{background:#cbd5e1}
.gc-exfollow-tl-neutral .gc-exfollow-tl-badge{background:#f1f5f9;color:#475569;border:1px solid #e2e8f0}
.gc-exfollow-tl-warn .gc-exfollow-row-icon{background:#94a3b8}
.gc-exfollow-tl-warn .gc-exfollow-tl-badge{background:#f1f5f9;color:#475569;border:1px solid #e2e8f0}
.gc-exfollow-tl-removed .gc-exfollow-row-icon{background:#f87171}
.gc-exfollow-tl-removed .gc-exfollow-tl-badge{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca}
.gc-exfollow-tl-removed .gc-exfollow-tl-date{color:#94a3b8}
.gc-exfollow-tl-attention .gc-exfollow-row-icon{background:#f59e0b}
.gc-exfollow-tl-attention .gc-exfollow-tl-badge{background:#fff7ed;color:#9a3412;border:1px solid #fed7aa}
.gc-exfollow-row-fields{display:flex;flex-wrap:wrap;align-items:center;gap:16px;flex:1 1 auto;min-width:0}
.gc-exfollow-field{display:flex;flex-direction:column;gap:1px;min-width:60px;max-width:220px}
.gc-exfollow-field b{font-size:9px;font-weight:650;color:#94a3b8;text-transform:uppercase;letter-spacing:.03em}
.gc-exfollow-field span{font-size:12px;font-weight:650;color:#334155;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gc-exfollow-field-symptom span{color:#be185d}
.gc-exfollow-field-comment span{color:#c2410c}
.gc-exfollow-field-reply span{color:#047857}
.gc-exfollow-tl-toggle{flex:0 0 auto;margin-left:auto;border:1px solid #cbd5e1;background:#fff;color:#0f2d52;border-radius:8px;padding:5px 11px;font:650 11.5px inherit;cursor:pointer;white-space:nowrap}
.gc-exfollow-tl-toggle:hover{border-color:#93c5fd;background:#f8fbff}

/* Painel expandido — blocos empilhados, dentro da mesma sessão. */
.gc-exfollow-detail{margin-top:11px;padding-top:11px;border-top:1px solid #e2e8f0;display:flex;flex-direction:column;gap:13px}
.gc-exfollow-block{display:flex;flex-direction:column;gap:7px}
.gc-exfollow-block>b{display:block;font-size:10.5px;font-weight:750;text-transform:uppercase;letter-spacing:.04em;color:#64748b}
.gc-exfollow-treino-modalidade{font-size:11px;font-weight:750;text-transform:uppercase;letter-spacing:.04em;color:#64748b;margin-bottom:8px}

/* Métricas — colunas compactas. */
.gc-exfollow-metrics{display:flex;flex-wrap:wrap;gap:8px}
.gc-exfollow-metric{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:7px 11px;min-width:92px}
.gc-exfollow-metric b{display:block;font-size:9.5px;font-weight:650;color:#64748b;margin-bottom:2px}
.gc-exfollow-metric strong{font-size:15px;color:#0f172a;font-weight:750}

/* Como se sentiu — antes/depois com mini-escala 1-5 real. */
.gc-exfollow-avaliacoes{display:flex;align-items:center;gap:12px}
.gc-exfollow-avaliacao{flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:11px;padding:9px 12px;text-align:center}
.gc-exfollow-avaliacao b{display:block;font-size:10px;font-weight:650;color:#64748b;margin-bottom:6px}
.gc-exfollow-avaliacao-arrow{flex:0 0 auto;font-size:16px;color:#94a3b8}
.gc-exfollow-scale{display:flex;gap:4px;justify-content:center}
.gc-exfollow-scale-dot{width:20px;height:20px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;background:#e2e8f0;color:#94a3b8}
.gc-exfollow-scale-dot.is-active{background:#0f2d52;color:#fff}

/* Sintomas / Comentário / Resposta — 3 colunas ao mesmo nível. */
.gc-exfollow-triple{display:flex;gap:10px}
.gc-exfollow-col{flex:1;min-width:0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:9px 11px}
.gc-exfollow-col b{display:block;font-size:10px;font-weight:750;text-transform:uppercase;letter-spacing:.03em;margin-bottom:5px}
.gc-exfollow-col p{margin:0;font-size:12px;color:#334155;white-space:pre-wrap;line-height:1.4}
.gc-exfollow-col-symptom b{color:#be185d}
.gc-exfollow-col-comment b{color:#c2410c}
.gc-exfollow-col-reply b{color:#047857}

/* Exercícios kind=list — sequência horizontal compacta. */
.gc-exfollow-ex-row{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px}
.gc-exfollow-ex-card{flex:0 0 104px;display:flex;flex-direction:column;gap:3px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:7px;font-size:11px}
.gc-exfollow-ex-photo{width:100%;height:62px;object-fit:cover;border-radius:7px;background:#e2e8f0;display:block}
.gc-exfollow-ex-photo-empty{display:flex;align-items:center;justify-content:center}
.gc-exfollow-ex-name{font-weight:700;color:#0f172a;font-size:11.5px;line-height:1.25}
.gc-exfollow-ex-prescrito{color:#334155;font-weight:650}
.gc-exfollow-ex-carga{color:#64748b}
.gc-exfollow-ex-status{margin-top:2px;font-size:10px;font-weight:700;border-radius:6px;padding:2px 6px;display:inline-block;width:fit-content}
.gc-exfollow-ex-status-ok{background:#ecfdf5;color:#047857}
.gc-exfollow-ex-status-alt{background:#fff7ed;color:#9a3412}
.gc-exfollow-ex-status-skip{background:#fef2f2;color:#b91c1c}

/* Cardio — timeline horizontal (preservada). */
.gc-exfollow-card-timeline{display:flex;gap:2px;border-radius:8px;overflow:hidden;height:28px;margin-bottom:8px}
.gc-exfollow-card-timeline-seg{display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden}
.gc-exfollow-card-timeline-group{position:relative;display:flex;overflow:hidden;min-width:60px}
.gc-exfollow-card-series-pattern{display:flex;width:100%;height:100%}
.gc-exfollow-card-series-seg{flex:1 1 0;min-width:3px;border-right:1px solid rgba(255,255,255,.7)}
.gc-exfollow-card-series-seg:last-child{border-right:0}
.gc-exfollow-card-series-rec{opacity:.55}
.gc-exfollow-card-timeline-caption{position:absolute;left:0;right:0;bottom:2px;text-align:center;font-size:9px;font-weight:700;color:#fff;text-shadow:0 1px 2px rgba(15,23,42,.6);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 3px;pointer-events:none}
.gc-exfollow-card-zone-z1{background:#94a3b8}
.gc-exfollow-card-zone-z2{background:#60a5fa}
.gc-exfollow-card-zone-z3{background:#34d399}
.gc-exfollow-card-zone-z4{background:#fbbf24}
.gc-exfollow-card-zone-z5{background:#f87171}
.gc-exfollow-card-zone-none{background:#cbd5e1}
.gc-exfollow-card-blocks{display:flex;flex-wrap:wrap;gap:6px}
.gc-exfollow-card-block{border:1px solid #e2e8f0;background:#f8fafc;border-radius:8px;padding:6px 9px;display:flex;flex-direction:column;gap:2px;font-size:11px;color:#334155;min-width:90px}
.gc-exfollow-card-block b{font-size:10.5px;color:#0f2d52;font-weight:750}

/* Resposta médica — preservada (só reposicionada). */
.gc-exfollow-reply-messages{display:flex;flex-direction:column;gap:6px}
.gc-exfollow-reply-message{border:1px solid #e2e8f0;background:#fff;border-radius:8px;padding:8px 10px}
.gc-exfollow-reply-message p{margin:0;font-size:12px;color:#0f172a;white-space:pre-wrap}
.gc-exfollow-reply-message-meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:5px;font-size:10px;color:#64748b}
.gc-exfollow-reply{display:flex;flex-direction:column;gap:2px}
.gc-exfollow-reply-textarea{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:9px;padding:8px 10px;font:400 12.5px inherit;color:#0f172a;resize:vertical}
.gc-exfollow-reply-actions{display:flex;gap:8px;margin-top:8px}
.gc-exfollow-reply-save{border:1px solid #0f2d52;background:#0f2d52;color:#fff;border-radius:8px;padding:7px 12px;font:650 12px inherit;cursor:pointer}
.gc-exfollow-reply-save:disabled{opacity:.6;cursor:default}
.gc-exfollow-reply-cancel{border:1px solid #cbd5e1;background:#fff;color:#0f2d52;border-radius:8px;padding:7px 12px;font:650 12px inherit;cursor:pointer}
.gc-exfollow-reply-cancel:disabled{opacity:.6;cursor:default}
.gc-exfollow-reply-open{border:1px solid #cbd5e1;background:#fff;color:#0f2d52;border-radius:8px;padding:6px 11px;font:650 11.5px inherit;cursor:pointer}
.gc-exfollow-reply-error{margin-top:8px;font-size:11.5px;color:#b91c1c}
.gc-exfollow-reply-success{margin-bottom:8px;font-size:11.5px;color:#047857;font-weight:650}

.gc-exfollow-error{border:1px solid #fecaca;background:#fef2f2;color:#991b1b;border-radius:10px;padding:12px 14px;font-size:12px}
@media(max-width:800px){
  .gc-exfollow-grid,.gc-exfollow-mini-grid{grid-template-columns:1fr}
  .gc-exfollow-head{flex-direction:column}
  .gc-exfollow-back{order:-1}
  .gc-exfollow-row{flex-wrap:wrap;row-gap:8px}
  .gc-exfollow-tl-toggle{margin-left:0}
  .gc-exfollow-avaliacoes{flex-direction:column}
  .gc-exfollow-avaliacao-arrow{transform:rotate(90deg)}
  .gc-exfollow-triple{flex-direction:column}
}
`;
}

/* renderAttentionBlock — Bloco 1 ("Porque precisa da minha atenção agora?").
   Usa EXATAMENTE os mesmos sinais objetivos já usados no Home
   (loadHomeAcompanhamentoExercicio em boot.js): readiness mais recente
   (has_symptoms) e último log (rpe>=8, note, sets[].status). Sem
   interpretação clínica, sem IA, sem query a wo_exercises — sets[]
   alterados/não realizados aparecem só como contagem. Inalterado nesta
   passagem (só camada visual da timeline foi redesenhada). */
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
    const { altered: alteredCount, skipped: skippedCount } = computeSetsCounts(log);
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

/* buildTimelineSessions — união por session_id de 4 fontes (nunca só
   data.sessions[], para não fazer desaparecer sessões removidas):
   1) sessões presentes em prescription.data.sessions[]
   2) wo_session_prescription_snapshots
   3) wo_session_logs
   4) wo_session_readiness
   Nunca agrupa por data — há legitimamente duas sessões no mesmo dia.
   Inalterado nesta passagem. */
function buildTimelineSessions(prescription, snapshots, readinessRows, logRows) {
  const bySessionId = new Map();
  const ensure = (sessionId) => {
    if (!sessionId) return null;
    if (!bySessionId.has(sessionId)) {
      bySessionId.set(sessionId, { sessionId, inPlan: false, planDate: null, kind: null, snapshot: null, readiness: null, log: null });
    }
    return bySessionId.get(sessionId);
  };

  const planSessions = Array.isArray(prescription?.data?.sessions) ? prescription.data.sessions : [];
  planSessions.forEach((s) => {
    const entry = ensure(s?.session_id);
    if (!entry) return;
    entry.inPlan = true;
    entry.planDate = s.date || null;
    entry.kind = s.kind || null;
  });

  (snapshots || []).forEach((snap) => {
    const entry = ensure(snap?.session_id);
    if (entry) entry.snapshot = snap;
  });

  (readinessRows || []).forEach((r) => {
    const entry = ensure(r?.session_id);
    if (!entry) return;
    const prevAt = entry.readiness ? new Date(entry.readiness.answered_at).getTime() : -Infinity;
    const curAt = new Date(r?.answered_at).getTime();
    if (!entry.readiness || (Number.isFinite(curAt) && curAt >= prevAt)) entry.readiness = r;
  });

  (logRows || []).forEach((l) => {
    const entry = ensure(l?.session_id);
    if (!entry) return;
    const prevAt = entry.log ? new Date(entry.log.logged_at).getTime() : -Infinity;
    const curAt = new Date(l?.logged_at).getTime();
    if (!entry.log || (Number.isFinite(curAt) && curAt >= prevAt)) entry.log = l;
  });

  return [...bySessionId.values()];
}

/* resolveSessionDate — prioridade: snapshot.session_date > session.date do
   array atual > null (nunca inventar). Inalterado. */
function resolveSessionDate(entry) {
  return entry?.snapshot?.session_date || entry?.planDate || null;
}

/* classifySession — ordem obrigatória exata (log tem sempre prioridade
   máxima: uma sessão com log nunca é classificada como removida, mesmo
   com removed_at preenchido). Inalterado — nenhum threshold novo. */
function classifySession(entry, todayISO) {
  const hasLog = !!entry.log;
  const hasReadiness = !!entry.readiness;
  const frozenAt = entry.snapshot?.frozen_at || null;
  const removedAt = entry.snapshot?.removed_at || null;
  const sessionDate = resolveSessionDate(entry);

  if (hasLog) return "REALIZADA";
  if (removedAt && frozenAt) return "REMOVIDA_DEPOIS";
  if (removedAt && !frozenAt) return "REMOVIDA_ANTES";
  if (frozenAt || hasReadiness) return "INICIADA_SEM_REGISTO";
  if (sessionDate && sessionDate < todayISO) return "NAO_REALIZADA";
  if (sessionDate && sessionDate === todayISO && entry.inPlan) return "HOJE";
  if (sessionDate && sessionDate > todayISO && entry.inPlan) return "PREVISTA";
  return "INDETERMINADO";
}

/* TIMELINE_STATUS_META — rótulos inalterados; cores (css) alinhadas com a
   linguagem do mockup: verde=realizada, azul=hoje/prevista, cinza=não
   realizada, vermelho discreto=removida, âmbar=iniciada sem registo. */
const TIMELINE_STATUS_META = {
  REALIZADA:            { label: "Realizada",                    css: "ok" },
  HOJE:                 { label: "Hoje",                          css: "today" },
  PREVISTA:             { label: "Prevista",                      css: "today" },
  NAO_REALIZADA:        { label: "Não realizada",                 css: "warn" },
  REMOVIDA_ANTES:       { label: "Removida antes de iniciar",     css: "removed" },
  REMOVIDA_DEPOIS:      { label: "Removida depois de iniciada",   css: "removed" },
  INICIADA_SEM_REGISTO: { label: "Iniciada · sem registo final",  css: "attention" },
  INDETERMINADO:        { label: "Estado indeterminado",          css: "neutral" },
};

const CARD_ZONE_CLASS = {
  Z1: "gc-exfollow-card-zone-z1",
  Z2: "gc-exfollow-card-zone-z2",
  Z3: "gc-exfollow-card-zone-z3",
  Z4: "gc-exfollow-card-zone-z4",
  Z5: "gc-exfollow-card-zone-z5",
};
function cardZoneClass(zone) {
  return CARD_ZONE_CLASS[zone] || "gc-exfollow-card-zone-none";
}

/* computeCardBlockVisualDuration — duração usada só para a LARGURA da
   timeline visual. "continuous": duration_sec direto. "series": só quando
   count/work.duration_sec/recovery.duration_sec existirem TODOS — nunca
   inventar proporção a partir de dados parciais (fica largura neutra).
   Inalterado. */
function computeCardBlockVisualDuration(block) {
  if (block?.type === "continuous") {
    const sec = Number(block.duration_sec);
    return Number.isFinite(sec) && sec > 0 ? sec : null;
  }
  if (block?.type === "series") {
    const workSec = Number(block.work?.duration_sec);
    const recSec = Number(block.recovery?.duration_sec);
    const count = Number(block.count);
    if (Number.isFinite(workSec) && Number.isFinite(recSec) && Number.isFinite(count) && count > 0) {
      return count * (workSec + recSec);
    }
  }
  return null;
}

/* renderCardPrescribedTimeline — timeline horizontal do cardio (preservada
   sem alterações nesta passagem). "continuous": um único segmento.
   "series": grupo com `count` pares work/recovery repetidos lado a lado —
   nunca um bloco sólido para uma série intervalada. */
function renderCardPrescribedTimeline(blocks) {
  const segs = blocks.map((block, i) => {
    const visualSec = computeCardBlockVisualDuration(block);
    const flexStyle = visualSec ? `flex:${visualSec} 0 auto` : "flex:0 0 36px";
    const count = block?.type === "series" ? Number(block.count) : NaN;
    const workSec = block?.type === "series" ? Number(block.work?.duration_sec) : NaN;
    const recSec = block?.type === "series" ? Number(block.recovery?.duration_sec) : NaN;
    const canDrawPairs = Number.isFinite(count) && count > 0
      && Number.isFinite(workSec) && workSec > 0
      && Number.isFinite(recSec) && recSec > 0
      && Number.isFinite(visualSec) && visualSec > 0;

    if (canDrawPairs) {
      const workZone = block.work?.intensity?.zone;
      const recZone = block.recovery?.intensity?.zone;
      const pairs = Array.from({ length: count }, () =>
        `<i class="gc-exfollow-card-series-seg ${cardZoneClass(workZone)}" style="flex:${workSec} 0 0"></i>` +
        `<i class="gc-exfollow-card-series-seg gc-exfollow-card-series-rec ${cardZoneClass(recZone)}" style="flex:${recSec} 0 0"></i>`
      ).join("");
      const caption = `${count} × ${fmtDurationHuman(workSec)} · Rec. ${fmtDurationHuman(recSec)}`;
      return `<div class="gc-exfollow-card-timeline-group" style="${flexStyle}" title="Bloco ${i + 1}"><span class="gc-exfollow-card-series-pattern">${pairs}</span><span class="gc-exfollow-card-timeline-caption">${esc(caption)}</span></div>`;
    }

    const zone = block?.intensity?.zone || block?.work?.intensity?.zone || null;
    return `<div class="gc-exfollow-card-timeline-seg ${cardZoneClass(zone)}" style="${flexStyle}" title="Bloco ${i + 1}">${zone ? esc(zone) : ""}</div>`;
  });
  return `<div class="gc-exfollow-card-timeline">${segs.join("")}</div>`;
}

/* renderCardBlockCards — cartões compactos por bloco cardio (preservados).
   Nomenclatura neutra "Bloco N". Só mostra campos realmente existentes. */
function renderCardBlockCards(blocks) {
  const cards = blocks.map((block, i) => {
    const lines = [];
    if (block?.type === "continuous") {
      lines.push("Contínuo");
      const dur = fmtDurationHuman(block.duration_sec);
      if (dur) lines.push(dur);
      if (block.intensity?.zone) lines.push(block.intensity.zone);
      if (block.intensity?.rpe != null) lines.push(`RPE ${block.intensity.rpe}`);
      const paceLabel = fmtDurationHuman(block.intensity?.pace_sec_per_km);
      if (paceLabel) lines.push(`${paceLabel}/km`);
    } else if (block?.type === "series") {
      const workDur = fmtDurationHuman(block.work?.duration_sec);
      if (block.count != null && workDur) lines.push(`${block.count} × ${workDur}`);
      else if (workDur) lines.push(workDur);
      if (block.work?.intensity?.zone) lines.push(block.work.intensity.zone);
      if (block.work?.intensity?.rpe != null) lines.push(`RPE ${block.work.intensity.rpe}`);
      const recDur = fmtDurationHuman(block.recovery?.duration_sec);
      if (recDur) lines.push(`Recuperação: ${recDur}`);
      if (block.recovery?.intensity?.zone) lines.push(`Recuperação: ${block.recovery.intensity.zone}`);
      if (block.recovery?.intensity?.rpe != null) lines.push(`Recuperação RPE ${block.recovery.intensity.rpe}`);
    } else if (block?.type) {
      lines.push(String(block.type));
    }
    return `<div class="gc-exfollow-card-block"><b>Bloco ${i + 1}</b>${lines.map((l) => `<span>${esc(l)}</span>`).join("")}</div>`;
  });
  return `<div class="gc-exfollow-card-blocks">${cards.join("")}</div>`;
}

/* renderCardTreinoVisual — visual do treino prescrito para kind="card".
   Fonte EXCLUSIVA: entry.snapshot.snapshot (nunca a prescrição atual). Sem
   snapshot: frase discreta, nunca painel tracejado grande (dados históricos
   nunca são reconstruídos a partir da prescrição atual). */
function renderCardTreinoVisual(entry) {
  const snap = entry.snapshot?.snapshot || null;
  const blocks = Array.isArray(snap?.blocks) ? snap.blocks : null;
  if (!blocks || !blocks.length) {
    return `<div class="gc-exfollow-note-muted">Detalhe histórico do treino não disponível.</div>`;
  }
  const modalidadeHtml = snap?.modality ? `<div class="gc-exfollow-treino-modalidade">${esc(snap.modality)}</div>` : "";
  return `${modalidadeHtml}${renderCardPrescribedTimeline(blocks)}${renderCardBlockCards(blocks)}`;
}

/* ==================== kind="list" — sequência horizontal ==================== */

/* describeItemPrescribed — resumo curto "3 × 12" / "3 × 30 s" a partir
   exclusivamente dos campos reais do item (nunca inventa valores). */
function describeItemPrescribed(item) {
  if (Array.isArray(item?.duration_series) && item.duration_series.length) {
    const n = item.duration_series.length;
    const durs = item.duration_series.map((s) => fmtDurationHuman(s?.duration_sec)).filter(Boolean);
    if (!durs.length) return null;
    const allSame = durs.every((d) => d === durs[0]);
    return allSame ? `${n} × ${durs[0]}` : `${n} × ${durs.join("/")}`;
  }
  if (item?.duration_sec != null) {
    const dur = fmtDurationHuman(item.duration_sec);
    if (!dur) return null;
    return item.sets != null ? `${item.sets} × ${dur}` : dur;
  }
  if (Array.isArray(item?.series) && item.series.length) {
    const n = item.series.length;
    const reps = item.series.map((s) => s?.reps).filter((v) => v != null && v !== "");
    if (!reps.length) return `${n} série${n === 1 ? "" : "s"}`;
    const allSame = reps.length === n && reps.every((r) => Number(r) === Number(reps[0]));
    return allSame ? `${n} × ${reps[0]}` : `${n} × ${reps.join("/")}`;
  }
  if (item?.sets != null && item?.reps_fixed != null) return `${item.sets} × ${item.reps_fixed}`;
  if (item?.sets != null && (item?.reps_min != null || item?.reps_max != null)) {
    return `${item.sets} × ${item.reps_min ?? "—"}-${item.reps_max ?? "—"}`;
  }
  return null;
}

/* describeItemLoad — carga prescrita, só quando existir objetivamente. */
function describeItemLoad(item) {
  if (item?.load != null && item.load !== "") return `${item.load} kg`;
  if (Array.isArray(item?.series) && item.series.length) {
    const loads = item.series.map((s) => s?.load).filter((v) => v != null && v !== "");
    if (!loads.length) return null;
    const allSame = loads.every((l) => String(l) === String(loads[0]));
    return allSame ? `${loads[0]} kg` : `${loads.join("/")} kg`;
  }
  return null;
}

/* findLogEntryForExercise — liga snapshot.items[] ao realizado só por
   igualdade exata de exercise_id (mesma chave usada em wo_session_logs). */
function findLogEntryForExercise(log, exerciseId) {
  if (!exerciseId) return null;
  const sets = Array.isArray(log?.sets) ? log.sets : [];
  return sets.find((e) => e?.exercise_id === exerciseId) || null;
}

/* renderListItemCard — cartão compacto por exercício. photo_url já vem
   embutido no snapshot (sem query a wo_exercises). Sem foto: placeholder
   discreto, nunca imagem partida. Estado (conforme/alterado/não
   realizado) só aparece quando o log tiver esse exercise_id — sem
   inventar comparação onde não existe. */
function renderListItemCard(item, log) {
  const photo = item?.photo_url;
  const name = item?.name || "Exercício";
  const prescrito = describeItemPrescribed(item);
  const carga = describeItemLoad(item);
  const logEntry = findLogEntryForExercise(log, item?.exercise_id);
  const rawStatus = logEntry?.status || null;
  const statusLabel = rawStatus === "as_prescribed" ? "Conforme prescrito"
    : rawStatus === "skipped" ? "Não realizado"
    : rawStatus ? "Alterado"
    : null;
  const statusClass = rawStatus === "as_prescribed" ? "ok" : rawStatus === "skipped" ? "skip" : "alt";

  return `
    <div class="gc-exfollow-ex-card">
      ${photo ? `<img class="gc-exfollow-ex-photo" src="${esc(photo)}" alt="">` : `<div class="gc-exfollow-ex-photo gc-exfollow-ex-photo-empty"></div>`}
      <div class="gc-exfollow-ex-name">${esc(name)}</div>
      ${prescrito ? `<div class="gc-exfollow-ex-prescrito">${esc(prescrito)}</div>` : ""}
      ${carga ? `<div class="gc-exfollow-ex-carga">${esc(carga)}</div>` : ""}
      ${statusLabel ? `<div class="gc-exfollow-ex-status gc-exfollow-ex-status-${statusClass}">${esc(statusLabel)}</div>` : ""}
    </div>`;
}

/* renderListTreinoVisual — sequência horizontal de exercícios para
   kind="list". Fonte EXCLUSIVA: entry.snapshot.snapshot.items[] (nunca a
   prescrição atual, nunca wo_exercises). Sem snapshot: frase discreta, sem
   painel tracejado grande — nunca reconstruir a partir do treino atual. */
function renderListTreinoVisual(entry) {
  const snap = entry.snapshot?.snapshot || null;
  const items = Array.isArray(snap?.items) ? snap.items : null;
  if (!items || !items.length) {
    return `<div class="gc-exfollow-note-muted">Detalhe histórico do treino não disponível.</div>`;
  }
  return `<div class="gc-exfollow-ex-row">${items.map((it) => renderListItemCard(it, entry.log)).join("")}</div>`;
}

/* ==================== Blocos partilhados (card + list) ==================== */

/* renderMetricasBlock — linha compacta de métricas (RPE, recuperação
   pós-treino, duração/distância quando existir resumo de sessão,
   exercícios alterados/não realizados). Só a partir de entry.log — nada
   inventado, nada omitido que exista. */
function renderMetricasBlock(log) {
  if (!log) return "";
  const metrics = [];
  if (log.rpe != null && log.rpe !== "") metrics.push({ label: "RPE (esforço)", value: `${log.rpe}/10` });
  if (log.feel != null && log.feel !== "") metrics.push({ label: "Recuperação pós-treino", value: `${log.feel}/5` });
  const sets = Array.isArray(log.sets) ? log.sets : [];
  const resumo = sets.find((e) => e?.tipo === "resumo");
  if (resumo) {
    const dur = fmtDurationHuman(resumo.tempo_total_sec);
    if (dur) metrics.push({ label: "Duração do treino", value: dur });
    const distM = Number(resumo.distancia_total_m);
    if (Number.isFinite(distM)) metrics.push({ label: "Distância", value: `${(distM / 1000).toFixed(2).replace(".", ",")} km` });
  }
  const { altered, skipped } = computeSetsCounts(log);
  if (altered > 0) metrics.push({ label: "Exercícios alterados", value: String(altered) });
  if (skipped > 0) metrics.push({ label: "Exercícios não realizados", value: String(skipped) });
  if (!metrics.length) return "";
  const itemsHtml = metrics.map((m) => `<div class="gc-exfollow-metric"><b>${esc(m.label)}</b><strong>${esc(m.value)}</strong></div>`).join("");
  return `<div class="gc-exfollow-block"><b>Métricas</b><div class="gc-exfollow-metrics">${itemsHtml}</div></div>`;
}

/* renderMiniScale — escala 1-5 real (readiness.feeling / log.feel), sem
   converter para outra escala nem inventar labels. */
function renderMiniScale(value) {
  const v = Number(value);
  const dots = [1, 2, 3, 4, 5].map((n) => `<span class="gc-exfollow-scale-dot${n === v ? " is-active" : ""}">${n}</span>`).join("");
  return `<div class="gc-exfollow-scale">${dots}</div>`;
}

/* renderAvaliacoes — "antes de começar" (readiness.feeling) → "depois de
   terminar" (log.feel). Só os valores reais 1-5 já gravados. Mostra só
   o(s) lado(s) que existirem. */
function renderAvaliacoes(readiness, log) {
  const antes = readiness?.feeling != null ? Number(readiness.feeling) : null;
  const depois = log?.feel != null ? Number(log.feel) : null;
  const temAntes = Number.isFinite(antes);
  const temDepois = Number.isFinite(depois);
  if (!temAntes && !temDepois) return "";

  const cardAntes = temAntes ? `<div class="gc-exfollow-avaliacao"><b>Antes de começar</b>${renderMiniScale(antes)}</div>` : "";
  const arrow = temAntes && temDepois ? `<div class="gc-exfollow-avaliacao-arrow">→</div>` : "";
  const cardDepois = temDepois ? `<div class="gc-exfollow-avaliacao"><b>Depois de terminar</b>${renderMiniScale(depois)}</div>` : "";

  return `<div class="gc-exfollow-block"><b>Como se sentiu</b><div class="gc-exfollow-avaliacoes">${cardAntes}${arrow}${cardDepois}</div></div>`;
}

/* Mapa mínimo de reasons devolvidos por wo_send_session_message — texto
   legível para o médico. Reason desconhecido cai no fallback genérico.
   Inalterado nesta passagem. */
const REPLY_ERROR_MESSAGES = {
  nao_autenticado: "Sessão de utilizador inválida.",
  sessao_invalida: "Sessão de treino inválida.",
  mensagem_vazia: "Escreva uma mensagem antes de enviar.",
  prescricao_nao_encontrada: "Plano não encontrado.",
  expirado: "Este plano já não está ativo.",
  sem_permissao: "Não tem permissão para enviar esta mensagem.",
  sessao_nao_encontrada: "Esta sessão já não está disponível.",
};
const REPLY_ERROR_FALLBACK = "Não foi possível disponibilizar a mensagem.";

/* renderSessionMessages — mensagens já enviadas para esta sessão (body,
   published_at, read_at) — usadas na coluna "A minha resposta". Ordem
   cronológica ascendente (já vem assim da query, por created_at). Nunca
   mostra id/author_user_id/prescription_id/session_id. Inalterado
   funcionalmente — só deixou de repetir o título "A minha resposta" por
   mensagem, que passou a vir da coluna que a envolve. */
function renderSessionMessages(messages) {
  if (!messages || !messages.length) return "";
  const items = messages.map((m) => {
    const publishedLabel = m.published_at ? `Disponibilizada em ${fmtDateTime(m.published_at)}` : "";
    const readLabel = m.read_at ? `Lida pelo doente em ${fmtDateTime(m.read_at)}` : "Ainda não lida";
    return `
      <div class="gc-exfollow-reply-message">
        <p>${esc(m.body || "")}</p>
        <div class="gc-exfollow-reply-message-meta">
          <span>${esc(publishedLabel)}</span>
          <span>${esc(readLabel)}</span>
        </div>
      </div>`;
  }).join("");
  return `<div class="gc-exfollow-reply-messages">${items}</div>`;
}

/* renderSintomasComentarioResposta — sintomas / comentário / a minha
   resposta lado a lado (3 colunas em desktop, empilhadas em mobile via
   CSS). Coluna só aparece quando existir conteúdo real; as restantes
   ocupam o espaço disponível (flex:1 cada). */
function renderSintomasComentarioResposta(readiness, log, messages) {
  const cols = [];

  const symptomNote = readiness?.has_symptoms === true ? String(readiness?.symptom_note || "").trim() : "";
  if (symptomNote) {
    cols.push(`<div class="gc-exfollow-col gc-exfollow-col-symptom"><b>Sintomas antes do treino</b><p>${esc(symptomNote)}</p></div>`);
  }

  const noteText = String(log?.note || "").trim();
  if (noteText) {
    cols.push(`<div class="gc-exfollow-col gc-exfollow-col-comment"><b>Comentário do doente</b><p>${esc(noteText)}</p></div>`);
  }

  const respostaHtml = renderSessionMessages(messages);
  if (respostaHtml) {
    cols.push(`<div class="gc-exfollow-col gc-exfollow-col-reply"><b>A minha resposta</b>${respostaHtml}</div>`);
  }

  if (!cols.length) return "";
  return `<div class="gc-exfollow-block"><div class="gc-exfollow-triple">${cols.join("")}</div></div>`;
}

/* renderResponderAction — "Responder ao doente"/"Responder novamente" e,
   quando aberto, o formulário. Lógica RPC e estado (replyState)
   inalterados nesta passagem — só deixou de incluir a listagem de
   mensagens já enviadas (agora na coluna "A minha resposta"). */
function renderResponderAction(entry, replyState, messages) {
  const openLabel = messages && messages.length ? "Responder novamente" : "Responder ao doente";

  const isThisSession = replyState && replyState.sessionId === entry.sessionId;
  const successNote = isThisSession && replyState.success
    ? `<div class="gc-exfollow-reply-success">Mensagem disponibilizada ao doente.</div>`
    : "";

  const isOpen = isThisSession && !replyState.success;

  if (!isOpen) {
    return `${successNote}<button type="button" class="gc-exfollow-reply-open" data-reply-open="${esc(entry.sessionId)}">${esc(openLabel)}</button>`;
  }

  const disabledAttr = replyState.sending ? "disabled" : "";
  const errorHtml = replyState.error
    ? `<div class="gc-exfollow-reply-error">${esc(replyState.error)}</div>`
    : "";

  return `
    <div class="gc-exfollow-reply">
      <textarea class="gc-exfollow-reply-textarea" rows="4" data-reply-textarea placeholder="Escreva a sua resposta..." ${disabledAttr}>${esc(replyState.body || "")}</textarea>
      ${errorHtml}
      <div class="gc-exfollow-reply-actions">
        <button type="button" class="gc-exfollow-reply-save" data-reply-save ${disabledAttr}>${replyState.sending ? "A guardar…" : "Guardar e disponibilizar ao doente"}</button>
        <button type="button" class="gc-exfollow-reply-cancel" data-reply-cancel ${disabledAttr}>Cancelar</button>
      </div>
    </div>`;
}

/* renderTimelineDetailPanel — painel de "Ver treino", continuação da
   mesma sessão. Ordem obrigatória: A) treino visual, B) métricas,
   C) como se sentiu antes→depois, D) sintomas/comentário/resposta em 3
   colunas, E) ação de responder. O visual do treino depende só do kind
   efetivo (entry.kind ou, na ausência dele — sessão removida do array
   atual —, snapshot.snapshot.kind). */
function renderTimelineDetailPanel(entry, replyState, messagesBySessionId) {
  const effectiveKind = entry.kind || entry.snapshot?.snapshot?.kind || null;

  let treinoHtml = "";
  if (effectiveKind === "card") {
    treinoHtml = renderCardTreinoVisual(entry);
  } else if (effectiveKind === "list") {
    treinoHtml = renderListTreinoVisual(entry);
  }

  const metricasHtml = renderMetricasBlock(entry.log);
  const avaliacoesHtml = renderAvaliacoes(entry.readiness, entry.log);

  const messages = messagesBySessionId ? (messagesBySessionId.get(entry.sessionId) || []) : [];
  const tripleHtml = renderSintomasComentarioResposta(entry.readiness, entry.log, messages);
  const responderHtml = `<div class="gc-exfollow-block"><b>Responder</b>${renderResponderAction(entry, replyState, messages)}</div>`;

  const blocks = [treinoHtml, metricasHtml, avaliacoesHtml, tripleHtml, responderHtml].filter(Boolean);
  return `<div class="gc-exfollow-detail">${blocks.join("")}</div>`;
}

/* renderTimelineItem — uma linha compacta por sessão (lista tipo tabela).
   Fechada por defeito: ícone de estado + data + badge, colunas de campos
   só quando EXISTIREM (RPE, recuperação, sintomas/comentário com trecho
   curto, "respondido") e o botão à direita. Sessões que já eram
   objetivamente classificadas como merecendo atenção (mesmos sinais do
   Bloco 1: RPE≥8, sintomas, comentário, exercícios alterados/não
   realizados, ou estado NAO_REALIZADA) recebem só um indicador lateral
   discreto — nunca uma moldura à volta de todo o cartão. */
function renderTimelineItem(entry, todayISO, expandedSessionId, replyState, messagesBySessionId) {
  const status = classifySession(entry, todayISO);
  const meta = TIMELINE_STATUS_META[status] || TIMELINE_STATUS_META.INDETERMINADO;
  const sessionDateRaw = resolveSessionDate(entry);
  const sessionDateLabel = fmtSessionDate(sessionDateRaw) || "Data desconhecida";
  const isExpanded = expandedSessionId === entry.sessionId;

  const hasSymptoms = entry.readiness?.has_symptoms === true;
  const hasComment = !!String(entry.log?.note || "").trim();
  const messages = messagesBySessionId ? (messagesBySessionId.get(entry.sessionId) || []) : [];
  const hasReply = messages.length > 0;

  const fields = [];
  if (entry.log?.rpe != null && entry.log?.rpe !== "") {
    fields.push(`<div class="gc-exfollow-field"><b>RPE</b><span>${esc(entry.log.rpe)}/10</span></div>`);
  }
  if (entry.log?.feel != null && entry.log?.feel !== "") {
    fields.push(`<div class="gc-exfollow-field"><b>Recuperação</b><span>${esc(entry.log.feel)}/5</span></div>`);
  }
  if (hasSymptoms) {
    const preview = truncateText(entry.readiness?.symptom_note, 40) || "Reportados";
    fields.push(`<div class="gc-exfollow-field gc-exfollow-field-symptom"><b>Sintomas</b><span>${esc(preview)}</span></div>`);
  }
  if (hasComment) {
    fields.push(`<div class="gc-exfollow-field gc-exfollow-field-comment"><b>Comentário</b><span>${esc(truncateText(entry.log?.note, 56))}</span></div>`);
  }
  if (hasReply) {
    fields.push(`<div class="gc-exfollow-field gc-exfollow-field-reply"><b>A minha resposta</b><span>Respondido</span></div>`);
  }

  const rpeNum = Number(entry.log?.rpe);
  const { altered, skipped } = computeSetsCounts(entry.log);
  const precisaAtencao = status === "NAO_REALIZADA" || hasSymptoms || hasComment
    || (Number.isFinite(rpeNum) && rpeNum >= 8) || altered > 0 || skipped > 0;

  const itemClass = `gc-exfollow-tl-item gc-exfollow-tl-${meta.css}${precisaAtencao ? " gc-exfollow-tl-flagged" : ""}`;

  return `
    <div class="${itemClass}">
      <div class="gc-exfollow-row">
        <div class="gc-exfollow-row-date">
          <span class="gc-exfollow-row-icon" aria-hidden="true"></span>
          <div>
            <div class="gc-exfollow-tl-date">${esc(sessionDateLabel)}</div>
            <span class="gc-exfollow-tl-badge">${esc(meta.label)}</span>
          </div>
        </div>
        <div class="gc-exfollow-row-fields">${fields.join("")}</div>
        <button type="button" class="gc-exfollow-tl-toggle" data-toggle-session="${esc(entry.sessionId)}">${isExpanded ? "Fechar treino" : "Ver treino"}</button>
      </div>
      ${isExpanded ? renderTimelineDetailPanel(entry, replyState, messagesBySessionId) : ""}
    </div>`;
}

/* renderTimelineBlock — Bloco "Linha temporal do plano". Ordena por data
   resolvida (sessões sem data conhecida ficam no fim, sem inventar
   posição cronológica para elas). expandedSessionId identifica, por
   session_id, qual painel de "Ver treino" (se algum) deve aparecer
   expandido — nunca mais do que um em simultâneo. Inalterado nesta
   passagem. */
function renderTimelineBlock(prescription, snapshots, readinessRows, logRows, expandedSessionId, replyState, messagesBySessionId) {
  const entries = buildTimelineSessions(prescription, snapshots, readinessRows, logRows);
  if (!entries.length) {
    return `<div class="gc-exfollow-empty">Não existem sessões disponíveis para apresentar.</div>`;
  }

  const todayISO = todayISODate();
  entries.sort((a, b) => {
    const da = resolveSessionDate(a);
    const db = resolveSessionDate(b);
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return da < db ? -1 : da > db ? 1 : 0;
  });

  return `<div class="gc-exfollow-timeline">${entries.map((e) => renderTimelineItem(e, todayISO, expandedSessionId, replyState, messagesBySessionId)).join("")}</div>`;
}

/* renderShell — cabeçalho inalterado; Bloco 1 ("Porque precisa da minha
   atenção agora?") mantém a posição atual. "Evolução clínica global" /
   "Evolução por exercício" / "Decisão / Ação médica" passaram a 3
   cartões compactos na mesma linha (sem conteúdo/análise nova, sem
   navegação funcional nesta passagem), antes da linha temporal. */
function renderShell(root, patient, prescription, readiness, log, snapshots, readinessRows, logRows, expandedSessionId, replyState, messagesBySessionId) {
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

      <div class="gc-exfollow-mini-grid">
        <div class="gc-exfollow-mini-card">
          <div class="gc-exfollow-mini-icon" aria-hidden="true">↗</div>
          <h3>Evolução clínica global</h3>
          <p>Sintomas, RPE, sensação pós-treino, adesão e alterações.</p>
          <span class="gc-exfollow-mini-link">Ver evolução →</span>
        </div>
        <div class="gc-exfollow-mini-card">
          <div class="gc-exfollow-mini-icon" aria-hidden="true">▦</div>
          <h3>Evolução por exercício</h3>
          <p>Prescrito versus realizado e progressão ao longo das sessões.</p>
          <span class="gc-exfollow-mini-link">Ver evolução →</span>
        </div>
        <div class="gc-exfollow-mini-card">
          <div class="gc-exfollow-mini-icon" aria-hidden="true">✎</div>
          <h3>Decisão / Ação médica</h3>
          <p>Área preparada para fechar o circuito de acompanhamento.</p>
          <span class="gc-exfollow-mini-link">Ver decisões / ações →</span>
        </div>
      </div>

      <div class="gc-exfollow-section">
        <h2>Linha temporal do plano</h2>
        <p>Sessões realizadas, previstas, não realizadas e removidas.</p>
        ${renderTimelineBlock(prescription, snapshots, readinessRows, logRows, expandedSessionId, replyState, messagesBySessionId)}
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

  const [patientRes, prescriptionRes, snapshotsRes, readinessRes, logsRes, messagesRes] = await Promise.all([
    window.sb.from("patients").select("id, full_name").eq("id", patientId).maybeSingle(),
    window.sb.from("wo_prescriptions").select("id, patient_id, clinic_id, status, created_at, expires_at, first_opened_at, data").eq("id", prescriptionId).eq("patient_id", patientId).maybeSingle(),
    window.sb.from("wo_session_prescription_snapshots").select("session_id, session_date, frozen_at, removed_at, snapshot").eq("prescription_id", prescriptionId),
    window.sb.from("wo_session_readiness").select("session_id, answered_at, has_symptoms, symptom_note, feeling").eq("prescription_id", prescriptionId),
    window.sb.from("wo_session_logs").select("session_id, logged_at, rpe, feel, note, sets").eq("prescription_id", prescriptionId),
    window.sb.from("wo_session_doctor_messages").select("id,prescription_id,session_id,body,published_at,read_at,created_at,author_user_id").eq("prescription_id", prescriptionId).not("published_at", "is", null).order("created_at", { ascending: true }),
  ]);

  if (patientRes.error) throw patientRes.error;
  if (prescriptionRes.error) throw prescriptionRes.error;
  if (snapshotsRes.error) throw snapshotsRes.error;
  if (readinessRes.error) throw readinessRes.error;
  if (logsRes.error) throw logsRes.error;
  if (messagesRes.error) throw messagesRes.error;
  if (!patientRes.data || !prescriptionRes.data) {
    root.innerHTML = `<style>${styles()}</style><div class="gc-exfollow"><div class="gc-exfollow-error">Acompanhamento não encontrado ou sem acesso.</div></div>`;
    return;
  }

  const snapshots = snapshotsRes.data || [];
  const readinessRows = readinessRes.data || [];
  const logRows = logsRes.data || [];

  /* Mensagens do médico já enviadas, agrupadas por session_id — já vêm
     ordenadas cronologicamente pela própria query (created_at ascendente).
     Nunca N+1: uma query só, para toda a prescrição. */
  const messagesBySessionId = new Map();
  (messagesRes.data || []).forEach((m) => {
    const list = messagesBySessionId.get(m.session_id) || [];
    list.push(m);
    messagesBySessionId.set(m.session_id, list);
  });

  /* Bloco 1 reutiliza os mesmos arrays completos (sem query duplicada):
     "mais recente" = maior answered_at/logged_at dentro do array já carregado. */
  const latestReadiness = [...readinessRows].sort((a, b) => new Date(b.answered_at) - new Date(a.answered_at))[0] || null;
  const latestLog = [...logRows].sort((a, b) => new Date(b.logged_at) - new Date(a.logged_at))[0] || null;

  /* Estado local do módulo (não G): qual session_id, se algum, está com o
     painel de "Ver treino" expandido. Nunca mais do que um. Sem query nova
     ao expandir/fechar — repinta com os mesmos arrays já carregados acima. */
  let expandedSessionId = null;

  /* Estado local (não G) do "Responder ao doente". replyState.sessionId
     identifica a QUE sessão pertence o texto em curso — nunca se escolhe
     por data, nunca se troca de prescrição. Reposto sempre que se muda de
     sessão expandida (nunca transporta texto escrito para outra sessão). */
  let replyState = { sessionId: null, body: "", sending: false, success: false, error: null };

  function resetReplyState() {
    replyState = { sessionId: null, body: "", sending: false, success: false, error: null };
  }

  async function handleReplySave() {
    const body = String(replyState.body || "").trim();
    const sessionId = replyState.sessionId;

    if (!body) {
      replyState.error = REPLY_ERROR_MESSAGES.mensagem_vazia;
      paint();
      return;
    }
    if (!prescriptionId || !sessionId) {
      replyState.error = REPLY_ERROR_FALLBACK;
      paint();
      return;
    }

    replyState.sending = true;
    replyState.error = null;
    replyState.success = false;
    paint();

    const { data, error } = await window.sb.rpc("wo_send_session_message", {
      p_prescription_id: prescriptionId,
      p_session_id: sessionId,
      p_body: body,
    });

    replyState.sending = false;

    if (error) {
      replyState.error = REPLY_ERROR_FALLBACK;
      paint();
      return;
    }

    if (data?.ok) {
      /* Sem nova query: a RPC só devolve {ok,id,created_at,published_at} —
         confirmado no corpo real. Construir a mensagem em memória com o
         que já sabemos localmente (session_id, body só acabado de enviar)
         e acrescentar ao Map desta sessão, para aparecer imediatamente. */
      const list = messagesBySessionId.get(sessionId) || [];
      list.push({
        id: data.id,
        session_id: sessionId,
        body,
        created_at: data.created_at,
        published_at: data.published_at,
        read_at: null,
      });
      messagesBySessionId.set(sessionId, list);

      replyState.success = true;
      replyState.body = "";
      paint();
      return;
    }

    replyState.error = REPLY_ERROR_MESSAGES[data?.reason] || REPLY_ERROR_FALLBACK;
    paint();
  }

  function paint() {
    renderShell(root, patientRes.data, prescriptionRes.data, latestReadiness, latestLog, snapshots, readinessRows, logRows, expandedSessionId, replyState, messagesBySessionId);

    document.getElementById("gcExFollowBack")?.addEventListener("click", () => {
      if (typeof onBack === "function") onBack();
    });

    root.querySelectorAll("[data-toggle-session]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sid = btn.getAttribute("data-toggle-session");
        expandedSessionId = expandedSessionId === sid ? null : sid;
        resetReplyState();
        paint();
      });
    });

    root.querySelectorAll("[data-reply-open]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sid = btn.getAttribute("data-reply-open");
        replyState = { sessionId: sid, body: "", sending: false, success: false, error: null };
        paint();
      });
    });

    root.querySelectorAll("[data-reply-cancel]").forEach((btn) => {
      btn.addEventListener("click", () => {
        resetReplyState();
        paint();
      });
    });

    root.querySelectorAll("[data-reply-textarea]").forEach((el) => {
      el.addEventListener("input", () => {
        replyState.body = el.value;
      });
    });

    root.querySelectorAll("[data-reply-save]").forEach((btn) => {
      btn.addEventListener("click", () => { handleReplySave(); });
    });
  }

  paint();
}
