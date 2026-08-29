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
   pelo Bloco 1 e pela Linha temporal para não duplicar a mesma regra. */
function computeSetsCounts(log) {
  const sets = Array.isArray(log?.sets) ? log.sets : [];
  const altered = sets.filter((e) => e?.status && e.status !== "as_prescribed" && e.status !== "skipped").length;
  const skipped = sets.filter((e) => e?.status === "skipped").length;
  return { altered, skipped };
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
.gc-exfollow-timeline{display:flex;flex-direction:column;gap:8px;margin-top:10px}
.gc-exfollow-tl-item{border:1px solid #e2e8f0;background:#fff;border-radius:10px;padding:10px 12px}
.gc-exfollow-tl-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.gc-exfollow-tl-date{font-size:12.5px;font-weight:700;color:#0f172a}
.gc-exfollow-tl-badge{font-size:11px;font-weight:650;border-radius:999px;padding:3px 9px;white-space:nowrap}
.gc-exfollow-tl-lines{display:flex;flex-wrap:wrap;gap:10px;margin-top:6px;font-size:11.5px;color:#64748b}
.gc-exfollow-tl-ok .gc-exfollow-tl-badge{background:#ecfdf5;color:#047857;border:1px solid #a7f3d0}
.gc-exfollow-tl-today .gc-exfollow-tl-badge{background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe}
.gc-exfollow-tl-neutral .gc-exfollow-tl-badge{background:#f1f5f9;color:#475569;border:1px solid #e2e8f0}
.gc-exfollow-tl-warn .gc-exfollow-tl-badge{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca}
.gc-exfollow-tl-removed{opacity:.7}
.gc-exfollow-tl-removed .gc-exfollow-tl-badge{background:#f8fafc;color:#94a3b8;border:1px solid #e2e8f0}
.gc-exfollow-tl-attention .gc-exfollow-tl-badge{background:#fff7ed;color:#9a3412;border:1px solid #fed7aa}
.gc-exfollow-tl-toggle{margin-top:8px;border:1px solid #cbd5e1;background:#fff;color:#0f2d52;border-radius:8px;padding:5px 10px;font:650 11.5px inherit;cursor:pointer}
.gc-exfollow-tl-toggle:hover{border-color:#93c5fd;background:#f8fbff}
.gc-exfollow-tl-detail{margin-top:8px;border:1px dashed #cbd5e1;border-radius:8px;padding:8px 10px;display:flex;flex-direction:column;gap:3px;font-size:11px;color:#475569}
.gc-exfollow-card-detail{margin-top:8px;display:flex;flex-direction:column;gap:10px}
.gc-exfollow-card-section{border-top:1px solid #e2e8f0;padding-top:8px}
.gc-exfollow-card-section b{display:block;font-size:11px;font-weight:750;text-transform:uppercase;letter-spacing:.04em;color:#64748b;margin-bottom:6px}
.gc-exfollow-card-timeline{display:flex;gap:2px;border-radius:8px;overflow:hidden;height:30px;margin-bottom:8px}
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
   Nunca agrupa por data — há legitimamente duas sessões no mesmo dia. */
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
   array atual > null (nunca inventar). Devolve string "yyyy-mm-dd" crua,
   própria para comparação lexicográfica com todayISODate(). */
function resolveSessionDate(entry) {
  return entry?.snapshot?.session_date || entry?.planDate || null;
}

/* classifySession — ordem obrigatória exata (log tem sempre prioridade
   máxima: uma sessão com log nunca é classificada como removida, mesmo
   com removed_at preenchido). */
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

const TIMELINE_STATUS_META = {
  REALIZADA:            { label: "Realizada",                    css: "ok" },
  HOJE:                 { label: "Hoje · Prevista",               css: "today" },
  PREVISTA:             { label: "Prevista",                      css: "neutral" },
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
   inventar proporção a partir de dados parciais (fica largura neutra). */
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

/* renderCardPrescribedTimeline — timeline horizontal. "continuous": um
   único segmento (como antes). "series": grupo com `count` pares
   work/recovery repetidos lado a lado — mesma lógica visual já validada
   em prescricao.js:renderResumoVisualCardio (largura relativa work:
   recovery dentro de cada par, cor por zona de cada lado, legenda
   "N × duração · Rec. duração"). A largura TOTAL do grupo continua a vir,
   inalterada, de computeCardBlockVisualDuration — largura mínima/neutra
   (flex:0 0 36px) quando não é possível calculá-la; nesse caso nunca se
   inventa a subdivisão interna, cai-se no segmento único neutro (como
   continuous). Só quando `count` é um número válido é que se desenham os
   pares — nunca se inventa um nº de repetições. */
function renderCardPrescribedTimeline(blocks) {
  const segs = blocks.map((block, i) => {
    const visualSec = computeCardBlockVisualDuration(block);
    const flexStyle = visualSec ? `flex:${visualSec} 0 auto` : "flex:0 0 36px";
    const count = block?.type === "series" ? Number(block.count) : NaN;
    const workSec = block?.type === "series" ? Number(block.work?.duration_sec) : NaN;
    const recSec = block?.type === "series" ? Number(block.recovery?.duration_sec) : NaN;
    // Só desenha o padrão repetido work/recovery quando TODOS os 4 dados são
    // válidos (count, work.duration_sec, recovery.duration_sec,
    // computeCardBlockVisualDuration) — sem fallback 60/30. Falta qualquer
    // um → cai sempre na representação simples/neutra abaixo, sem inventar
    // duração nem proporção.
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

/* renderCardBlockCards — cartões compactos por bloco, pela ordem original
   de blocks[]. Nomenclatura neutra "Bloco N" — nunca "Aquecimento"/
   "Arrefecimento" (semântica não disponível nos dados). Só mostra campos
   realmente existentes. */
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

/* computeCardRealized — só entry.log.sets (nunca o snapshot para o
   realizado). Trata as 3 variantes reais já auditadas: A) resumo de sessão;
   B) entradas por block_id+status (associadas ao snapshot só por
   igualdade exata de block_id, sem transformar status em dado
   fisiológico); C) sem detalhe estruturado nenhum. */
function computeCardRealized(entry) {
  const log = entry.log;
  const lines = [];

  if (log) {
    const sets = Array.isArray(log.sets) ? log.sets : [];
    const resumo = sets.find((e) => e?.tipo === "resumo");
    const blockEntries = sets.filter((e) => e && typeof e === "object" && Object.prototype.hasOwnProperty.call(e, "block_id"));

    if (resumo) {
      const dur = fmtDurationHuman(resumo.tempo_total_sec);
      if (dur) lines.push(`Tempo total: ${dur}`);
      const distM = Number(resumo.distancia_total_m);
      if (Number.isFinite(distM)) lines.push(`Distância total: ${(distM / 1000).toFixed(2).replace(".", ",")} km`);
    }

    if (blockEntries.length) {
      lines.push("Registo por blocos disponível");
      const prescribedBlocks = entry.snapshot?.snapshot?.blocks;
      const indexByBlockId = new Map();
      if (Array.isArray(prescribedBlocks)) {
        prescribedBlocks.forEach((b, i) => { if (b?.block_id) indexByBlockId.set(b.block_id, i + 1); });
      }
      blockEntries.forEach((be) => {
        const idx = be.block_id ? indexByBlockId.get(be.block_id) : null;
        const label = idx ? `Bloco ${idx}` : String(be.block_id || "—");
        lines.push(`${label}: ${be.status != null ? be.status : "—"}`);
      });
    }

    if (!resumo && !blockEntries.length) {
      lines.push("Sem detalhe estruturado do treino realizado.");
    }
  } else {
    lines.push("Sem registo final.");
  }

  return {
    lines,
    rpe: log?.rpe,
    feel: log?.feel,
    noteText: String(log?.note || "").trim(),
  };
}

/* renderCardSessionDetail — visualização clínica de "Ver treino" para
   kind="card". Prescrito vem EXCLUSIVAMENTE de entry.snapshot.snapshot
   (nunca da prescrição atual); realizado vem EXCLUSIVAMENTE de
   entry.log.sets. Secções visualmente separadas — nunca mistura valores
   realizados dentro da timeline prescrita. session_id nunca aparece aqui. */
function renderCardSessionDetail(entry, meta, sessionDateLabel) {
  const snap = entry.snapshot?.snapshot || null;
  const blocks = Array.isArray(snap?.blocks) ? snap.blocks : null;

  const headerParts = [];
  if (snap?.modality) headerParts.push(snap.modality);
  headerParts.push(sessionDateLabel);
  headerParts.push(meta.label);

  const prescribedHtml = blocks && blocks.length
    ? `${renderCardPrescribedTimeline(blocks)}${renderCardBlockCards(blocks)}`
    : `<div class="gc-exfollow-empty">Prescrito histórico não disponível.</div>`;

  const realized = computeCardRealized(entry);
  const realizedLinesHtml = realized.lines.length
    ? `<div class="gc-exfollow-tl-lines">${realized.lines.map((l) => `<span>${esc(l)}</span>`).join("")}</div>`
    : "";
  const realizedMetaParts = [];
  if (realized.rpe != null && realized.rpe !== "") realizedMetaParts.push(`RPE: ${realized.rpe}/10`);
  if (realized.feel != null && realized.feel !== "") realizedMetaParts.push(`Sensação pós-treino: ${realized.feel}/5`);
  const realizedMetaHtml = realizedMetaParts.length
    ? `<div class="gc-exfollow-meta">${realizedMetaParts.map((m) => `<span>${esc(m)}</span>`).join("")}</div>`
    : "";
  const realizedNoteHtml = realized.noteText
    ? `<div class="gc-exfollow-quote"><b>Comentário do doente</b>${esc(realized.noteText)}</div>`
    : "";

  return `
    <div class="gc-exfollow-card-detail">
      <div class="gc-exfollow-tl-lines">${headerParts.map((l) => `<span>${esc(l)}</span>`).join("")}</div>
      <div class="gc-exfollow-card-section">
        <b>Prescrito</b>
        ${prescribedHtml}
      </div>
      <div class="gc-exfollow-card-section">
        <b>Realizado</b>
        ${realizedLinesHtml}
        ${realizedMetaHtml}
        ${realizedNoteHtml}
      </div>
    </div>`;
}

/* renderTimelineDetailPanel — painel de "Ver treino". Para kind="card"
   (identificado por entry.kind ou, na ausência dele — sessão já removida
   do array atual —, por snapshot.snapshot.kind), usa a visualização
   clínica de renderCardSessionDetail(). Para os restantes kinds
   (list/walk/circuit/desconhecido), mantém inalterado o painel técnico da
   1ª fase (data/kind/estado/disponibilidade/congelamento). */
function renderTimelineDetailPanel(entry, meta, sessionDateLabel) {
  const effectiveKind = entry.kind || entry.snapshot?.snapshot?.kind || null;
  if (effectiveKind === "card") {
    return renderCardSessionDetail(entry, meta, sessionDateLabel);
  }

  const lines = [];
  lines.push(`Data: ${sessionDateLabel}`);
  lines.push(`session_id: ${entry.sessionId}`);
  if (entry.kind) lines.push(`Kind: ${entry.kind}`);
  lines.push(`Estado: ${meta.label}`);
  lines.push(entry.snapshot ? "Prescrito histórico disponível" : "Prescrito histórico não disponível");
  lines.push(entry.log ? "Registo realizado disponível" : "Sem registo final");
  if (entry.readiness?.answered_at) lines.push(`Readiness: ${fmtDateTime(entry.readiness.answered_at)}`);
  if (entry.snapshot?.frozen_at) lines.push(`Prescrição congelada: ${fmtDateTime(entry.snapshot.frozen_at)}`);

  return `<div class="gc-exfollow-tl-detail">${lines.map((l) => `<div>${esc(l)}</div>`).join("")}</div>`;
}

/* renderTimelineItem — cartão compacto por sessão. Só mostra o que existir
   objetivamente nas 4 fontes; nunca nomes de exercício (sem wo_exercises). */
function renderTimelineItem(entry, todayISO, expandedSessionId) {
  const status = classifySession(entry, todayISO);
  const meta = TIMELINE_STATUS_META[status] || TIMELINE_STATUS_META.INDETERMINADO;
  const sessionDateRaw = resolveSessionDate(entry);
  const sessionDateLabel = fmtSessionDate(sessionDateRaw) || "Data desconhecida";
  const isExpanded = expandedSessionId === entry.sessionId;

  const lines = [];
  if (entry.kind) lines.push(entry.kind);
  if (entry.readiness?.answered_at) lines.push(`Readiness: ${fmtDateTime(entry.readiness.answered_at)}`);
  if (entry.readiness?.has_symptoms === true) lines.push("Sintomas reportados antes do treino");
  if (entry.log?.logged_at) lines.push(`Registo final: ${fmtDateTime(entry.log.logged_at)}`);
  if (entry.log?.rpe != null && entry.log?.rpe !== "") lines.push(`RPE ${entry.log.rpe}/10`);
  if (entry.log?.feel != null && entry.log?.feel !== "") lines.push(`Sensação pós-treino: ${entry.log.feel}/5`);
  const { altered, skipped } = computeSetsCounts(entry.log);
  if (altered > 0) lines.push(`${altered} exercício${altered === 1 ? "" : "s"} alterado${altered === 1 ? "" : "s"}`);
  if (skipped > 0) lines.push(`${skipped} exercício${skipped === 1 ? "" : "s"} não realizado${skipped === 1 ? "" : "s"}`);

  const quotes = [];
  const symptomNote = entry.readiness?.has_symptoms === true ? String(entry.readiness?.symptom_note || "").trim() : "";
  if (symptomNote) quotes.push({ label: "Sintomas reportados pelo doente", text: symptomNote });
  const noteText = String(entry.log?.note || "").trim();
  if (noteText) quotes.push({ label: "Comentário do doente", text: noteText });

  return `
    <div class="gc-exfollow-tl-item gc-exfollow-tl-${meta.css}">
      <div class="gc-exfollow-tl-head">
        <span class="gc-exfollow-tl-date">${esc(sessionDateLabel)}</span>
        <span class="gc-exfollow-tl-badge">${esc(meta.label)}</span>
      </div>
      ${lines.length ? `<div class="gc-exfollow-tl-lines">${lines.map((l) => `<span>${esc(l)}</span>`).join("")}</div>` : ""}
      ${quotes.map((q) => `<div class="gc-exfollow-quote"><b>${esc(q.label)}</b>${esc(q.text)}</div>`).join("")}
      <button type="button" class="gc-exfollow-tl-toggle" data-toggle-session="${esc(entry.sessionId)}">${isExpanded ? "Fechar treino" : "Ver treino"}</button>
      ${isExpanded ? renderTimelineDetailPanel(entry, meta, sessionDateLabel) : ""}
    </div>`;
}

/* renderTimelineBlock — Bloco 2 ("Linha temporal do plano"). Ordena por
   data resolvida (sessões sem data conhecida ficam no fim, sem inventar
   posição cronológica para elas). expandedSessionId identifica, por
   session_id, qual painel de "Ver treino" (se algum) deve aparecer
   expandido — nunca mais do que um em simultâneo. */
function renderTimelineBlock(prescription, snapshots, readinessRows, logRows, expandedSessionId) {
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

  return `<div class="gc-exfollow-timeline">${entries.map((e) => renderTimelineItem(e, todayISO, expandedSessionId)).join("")}</div>`;
}

function renderShell(root, patient, prescription, readiness, log, snapshots, readinessRows, logRows, expandedSessionId) {
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
        ${renderTimelineBlock(prescription, snapshots, readinessRows, logRows, expandedSessionId)}
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

  const [patientRes, prescriptionRes, snapshotsRes, readinessRes, logsRes] = await Promise.all([
    window.sb.from("patients").select("id, full_name").eq("id", patientId).maybeSingle(),
    window.sb.from("wo_prescriptions").select("id, patient_id, clinic_id, status, created_at, expires_at, first_opened_at, data").eq("id", prescriptionId).eq("patient_id", patientId).maybeSingle(),
    window.sb.from("wo_session_prescription_snapshots").select("session_id, session_date, frozen_at, removed_at, snapshot").eq("prescription_id", prescriptionId),
    window.sb.from("wo_session_readiness").select("session_id, answered_at, has_symptoms, symptom_note").eq("prescription_id", prescriptionId),
    window.sb.from("wo_session_logs").select("session_id, logged_at, rpe, feel, note, sets").eq("prescription_id", prescriptionId),
  ]);

  if (patientRes.error) throw patientRes.error;
  if (prescriptionRes.error) throw prescriptionRes.error;
  if (snapshotsRes.error) throw snapshotsRes.error;
  if (readinessRes.error) throw readinessRes.error;
  if (logsRes.error) throw logsRes.error;
  if (!patientRes.data || !prescriptionRes.data) {
    root.innerHTML = `<style>${styles()}</style><div class="gc-exfollow"><div class="gc-exfollow-error">Acompanhamento não encontrado ou sem acesso.</div></div>`;
    return;
  }

  const snapshots = snapshotsRes.data || [];
  const readinessRows = readinessRes.data || [];
  const logRows = logsRes.data || [];

  /* Bloco 1 reutiliza os mesmos arrays completos (sem query duplicada):
     "mais recente" = maior answered_at/logged_at dentro do array já carregado. */
  const latestReadiness = [...readinessRows].sort((a, b) => new Date(b.answered_at) - new Date(a.answered_at))[0] || null;
  const latestLog = [...logRows].sort((a, b) => new Date(b.logged_at) - new Date(a.logged_at))[0] || null;

  /* Estado local do módulo (não G): qual session_id, se algum, está com o
     painel de "Ver treino" expandido. Nunca mais do que um. Sem query nova
     ao expandir/fechar — repinta com os mesmos arrays já carregados acima. */
  let expandedSessionId = null;

  function paint() {
    renderShell(root, patientRes.data, prescriptionRes.data, latestReadiness, latestLog, snapshots, readinessRows, logRows, expandedSessionId);

    document.getElementById("gcExFollowBack")?.addEventListener("click", () => {
      if (typeof onBack === "function") onBack();
    });

    root.querySelectorAll("[data-toggle-session]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sid = btn.getAttribute("data-toggle-session");
        expandedSessionId = expandedSessionId === sid ? null : sid;
        paint();
      });
    });
  }

  paint();
}
