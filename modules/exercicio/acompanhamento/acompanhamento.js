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
.gc-exfollow-topbar{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-bottom:10px}
.gc-exfollow-topbar-label{font-size:11px;font-weight:750;text-transform:uppercase;letter-spacing:.05em;color:#64748b}
.gc-exfollow-back{border:1px solid #cbd5e1;background:#fff;color:#0f2d52;border-radius:9px;padding:7px 11px;font:650 12px inherit;cursor:pointer}
.gc-exfollow-titlecard{margin-bottom:10px}
.gc-exfollow-title{margin:0;font-size:24px;line-height:1.15;color:#0f2d52;letter-spacing:-.4px}
.gc-exfollow-sub{margin:4px 0 0;font-size:12px;color:#64748b}
.gc-exfollow-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:0 0 14px}
.gc-exfollow-card{border:1px solid #e2e8f0;background:#fff;border-radius:11px;padding:8px 13px}
.gc-exfollow-card b{display:block;font-size:10px;color:#64748b;margin-bottom:2px}
.gc-exfollow-card strong{font-size:13px;color:#0f172a}
.gc-exfollow-section{border:1px solid #e2e8f0;background:#fff;border-radius:13px;padding:14px 16px;margin-top:10px}
.gc-exfollow-section h2{font-size:15px;color:#0f2d52;margin:0 0 4px}
.gc-exfollow-section p{font-size:12px;color:#64748b;margin:0}
.gc-exfollow-section-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}
.gc-exfollow-legend{display:flex;flex-wrap:wrap;gap:10px;font-size:10.5px;color:#64748b;padding-top:3px}
.gc-exfollow-legend span{display:inline-flex;align-items:center;gap:4px}
.gc-exfollow-legend-dot{width:7px;height:7px;border-radius:50%;display:inline-block}
.gc-exfollow-legend-dot-ok{background:#10b981}
.gc-exfollow-legend-dot-today{background:#3b82f6}
.gc-exfollow-legend-dot-warn{background:#94a3b8}
.gc-exfollow-legend-dot-removed{background:#f87171}
.gc-exfollow-legend-dot-attention{background:#f59e0b}
.gc-exfollow-empty{margin-top:10px;border:1px dashed #cbd5e1;border-radius:10px;padding:14px;color:#94a3b8;font-size:12px;text-align:center}
.gc-exfollow-note-muted{font-size:11.5px;color:#94a3b8;font-style:italic;padding:2px 0}
.gc-exfollow-signals{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.gc-exfollow-signal{display:inline-flex;align-items:center;font-size:11.5px;font-weight:650;color:#9a3412;background:#fff7ed;border:1px solid #fed7aa;border-radius:999px;padding:5px 10px}
.gc-exfollow-quote{margin-top:10px;border:1px solid #e2e8f0;background:#f8fafc;border-radius:10px;padding:10px 12px;font-size:12.5px;color:#334155;white-space:pre-wrap}
.gc-exfollow-quote b{display:block;font-size:11px;color:#64748b;margin-bottom:3px;font-weight:650}
.gc-exfollow-meta{display:flex;flex-wrap:wrap;gap:14px;margin-top:12px;font-size:11.5px;color:#64748b}

/* 3 cartões de ação — identidade visual própria por cartão. */
.gc-exfollow-mini-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:10px}
.gc-exfollow-mini-card{border:1px solid #e2e8f0;background:#fff;border-radius:12px;padding:13px 14px}
.gc-exfollow-mini-icon{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:8px;font-size:14px;margin-bottom:7px}
.gc-exfollow-mini-card h3{font-size:12.5px;margin:0 0 3px}
.gc-exfollow-mini-card p{font-size:11px;color:#64748b;margin:0 0 8px;line-height:1.4}
.gc-exfollow-mini-link{font-size:11px;font-weight:650}
.gc-exfollow-mini-card--green .gc-exfollow-mini-icon{background:#ecfdf5;color:#047857}
.gc-exfollow-mini-card--green h3,.gc-exfollow-mini-card--green .gc-exfollow-mini-link{color:#047857}
.gc-exfollow-mini-card--orange .gc-exfollow-mini-icon{background:#fff7ed;color:#c2410c}
.gc-exfollow-mini-card--orange h3,.gc-exfollow-mini-card--orange .gc-exfollow-mini-link{color:#c2410c}
.gc-exfollow-mini-card--purple .gc-exfollow-mini-icon{background:#f5f3ff;color:#7c3aed}
.gc-exfollow-mini-card--purple h3,.gc-exfollow-mini-card--purple .gc-exfollow-mini-link{color:#7c3aed}
.gc-exfollow-mini-link[data-open-evolucao]{border:0;background:none;padding:0;font-family:inherit;cursor:pointer}

/* Evolução clínica global — vista interna do cartão verde. Mesma
   linguagem visual do resto do módulo: cartões brancos, densidade alta,
   linha lateral de cor só quando útil. */
.gc-exclinic{display:flex;flex-direction:column;gap:12px}
.gc-exclinic-back{align-self:flex-start;border:1px solid #cbd5e1;background:#fff;color:#0f2d52;border-radius:9px;padding:7px 11px;font:650 12px inherit;cursor:pointer}
.gc-exclinic-head h2{margin:0 0 3px;font-size:17px;color:#0f2d52}
.gc-exclinic-head p{margin:0;font-size:12px;color:#64748b}
.gc-exclinic-filter{display:flex;gap:8px}
.gc-exclinic-filter-btn{border:1px solid #cbd5e1;background:#fff;color:#475569;border-radius:8px;padding:6px 12px;font:650 11.5px inherit;cursor:pointer}
.gc-exclinic-filter-btn.is-active{border-color:#0f2d52;background:#0f2d52;color:#fff}
.gc-exclinic-stats{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
.gc-exclinic-stats-2{grid-template-columns:repeat(2,1fr)}
.gc-exclinic-stat{background:#fff;border:1px solid #e2e8f0;border-radius:11px;padding:9px 12px}
.gc-exclinic-stat b{display:block;font-size:9.5px;font-weight:650;color:#64748b;text-transform:uppercase;letter-spacing:.02em;margin-bottom:3px}
.gc-exclinic-stat strong{display:block;font-size:18px;color:#0f172a;font-weight:750}
.gc-exclinic-stat-ok{border-left:3px solid #10b981}
.gc-exclinic-stat-warn{border-left:3px solid #94a3b8}
.gc-exclinic-stat-attention{border-left:3px solid #f59e0b}
.gc-exclinic-stat-neutral{border-left:3px solid #3b82f6}
.gc-exclinic-stat-muted{border-left:3px solid #cbd5e1}
.gc-exclinic-table-wrap{overflow-x:auto;margin-top:6px}
.gc-exclinic-table{width:100%;border-collapse:collapse;font-size:12px}
.gc-exclinic-table th{text-align:left;font-size:9.5px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.02em;padding:6px 10px;border-bottom:1px solid #e2e8f0;white-space:nowrap}
.gc-exclinic-table td{padding:7px 10px;border-bottom:1px solid #f1f5f9;color:#0f172a;white-space:nowrap}
.gc-exclinic-table tbody tr:last-child td{border-bottom:none}
.gc-exclinic-status-dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:5px;vertical-align:middle}
.gc-exclinic-notes{display:flex;flex-direction:column;gap:8px}
.gc-exclinic-note{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:9px 11px}
.gc-exclinic-note-meta{font-size:10px;font-weight:650;color:#64748b;margin-bottom:4px}
.gc-exclinic-note p{margin:0;font-size:12.5px;color:#0f172a;white-space:pre-wrap;line-height:1.4}
.gc-exclinic-chart-legend{display:flex;flex-wrap:wrap;gap:12px;font-size:10.5px;color:#64748b;margin:8px 0 4px}
.gc-exclinic-chart-legend span{display:inline-flex;align-items:center;gap:5px}
.gc-exclinic-chart-legend-dot{width:8px;height:8px;border-radius:50%;display:inline-block}
.gc-exclinic-chart-wrap{overflow-x:auto;padding-bottom:2px}
.gc-exclinic-chart-svg{display:block}
.gc-exclinic-chart-grid{stroke:#f1f5f9;stroke-width:1}
.gc-exclinic-chart-tick{font-size:8px;fill:#94a3b8}
.gc-exclinic-chart-line{stroke-width:1.6}
.gc-exclinic-chart-line-feeling{stroke:#3b82f6}
.gc-exclinic-chart-line-feel{stroke:#10b981}
.gc-exclinic-chart-line-rpe{stroke:#f59e0b}
.gc-exclinic-chart-dot{stroke:#fff;stroke-width:1.2}
.gc-exclinic-chart-dot-feeling{fill:#3b82f6}
.gc-exclinic-chart-dot-feel{fill:#10b981}
.gc-exclinic-chart-dot-rpe{fill:#f59e0b}
@media(max-width:800px){.gc-exclinic-stats{grid-template-columns:repeat(2,1fr)}}

/* Linha temporal — lista compacta tipo tabela, uma linha por sessão. */
.gc-exfollow-timeline{border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;background:#fff;margin-top:10px}
.gc-exfollow-tl-item{padding:10px 14px;border-bottom:1px solid #eef2f6}
.gc-exfollow-tl-item:last-child{border-bottom:none}
.gc-exfollow-tl-item.gc-exfollow-tl-flagged{border-left:3px solid #f59e0b;padding-left:11px}
.gc-exfollow-row{display:flex;align-items:center;gap:14px}
.gc-exfollow-row-date{display:flex;align-items:center;gap:8px;flex:0 0 auto;min-width:110px}
.gc-exfollow-row-icon{width:22px;height:22px;border-radius:50%;flex:0 0 auto;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff;background:#cbd5e1}
.gc-exfollow-tl-date{font-size:14.5px;font-weight:750;color:#0f172a;line-height:1.25}
.gc-exfollow-tl-badge{display:inline-block;font-size:10px;font-weight:650;border-radius:999px;padding:2px 8px;white-space:nowrap;margin-top:2px}
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

/* Campos da linha (RPE / Bem-estar / Sintomas / Comentário / Resposta),
   separados por um traço vertical discreto — nunca uma tabela dura. */
.gc-exfollow-row-fields{display:flex;flex-wrap:wrap;align-items:center;gap:0;flex:1 1 auto;min-width:0;row-gap:6px}
.gc-exfollow-field{display:flex;align-items:flex-start;gap:5px;padding:0 12px;min-width:0}
.gc-exfollow-field:first-child{padding-left:0}
.gc-exfollow-field:not(:first-child){border-left:1px solid #e2e8f0}
.gc-exfollow-field-icon{flex:0 0 auto;font-size:11px;line-height:1.5;margin-top:1px;color:#94a3b8}
.gc-exfollow-field-text{display:flex;flex-direction:column;gap:0;min-width:0}
.gc-exfollow-field-label{font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.03em}
.gc-exfollow-field-value{font-size:12.5px;font-weight:700;color:#0f172a;line-height:1.35}
.gc-exfollow-field-caption{font-size:9.5px;color:#94a3b8}
.gc-exfollow-field-wellbeing .gc-exfollow-field-icon,.gc-exfollow-field-wellbeing .gc-exfollow-field-value{color:#047857}
.gc-exfollow-field-symptom .gc-exfollow-field-icon{color:#be185d}
.gc-exfollow-field-symptom .gc-exfollow-field-value{color:#be185d;font-size:10.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:170px}
.gc-exfollow-field-comment .gc-exfollow-field-icon{color:#c2410c}
.gc-exfollow-field-comment .gc-exfollow-field-value{color:#c2410c;font-size:10.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:190px}
.gc-exfollow-field-reply .gc-exfollow-field-icon,.gc-exfollow-field-reply .gc-exfollow-field-value{color:#047857}

.gc-exfollow-tl-toggle{flex:0 0 auto;margin-left:auto;border:1px solid #cbd5e1;background:#fff;color:#0f2d52;border-radius:8px;padding:5px 11px;font:650 11.5px inherit;cursor:pointer;white-space:nowrap}
.gc-exfollow-tl-toggle:hover{border-color:#93c5fd;background:#f8fbff}

/* Painel expandido — blocos empilhados, dentro da mesma sessão. */
.gc-exfollow-detail{margin-top:11px;padding-top:11px;border-top:1px solid #e2e8f0;display:flex;flex-direction:column;gap:11px}
.gc-exfollow-block{display:flex;flex-direction:column;gap:7px}
.gc-exfollow-block>b{display:block;font-size:10.5px;font-weight:750;text-transform:uppercase;letter-spacing:.04em;color:#64748b}
.gc-exfollow-treino-modalidade{font-size:11px;font-weight:750;text-transform:uppercase;letter-spacing:.04em;color:#64748b;margin-bottom:8px}

/* Respostas reais do doente — Antes do treino / Depois do treino, um
   cartão compacto por pergunta, grelha de 3 por linha em desktop. Linha
   lateral fina (mesmo princípio dos cartões de clínica do GC: cartão
   quase branco, só uma linha de cor para identificar a categoria — nunca
   fundo saturado nem borda à volta de todos os lados). */
.gc-exfollow-answers{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.gc-exfollow-answer{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:8px 11px 8px 9px;min-width:0}
.gc-exfollow-answer b{display:block;font-size:9.5px;font-weight:650;color:#64748b;text-transform:uppercase;letter-spacing:.02em;margin-bottom:3px}
.gc-exfollow-answer strong{display:block;font-size:12.5px;font-weight:700;color:#0f172a;line-height:1.35;white-space:pre-wrap;word-break:break-word}
.gc-exfollow-answer-neutral{grid-column:1 / -1;background:#f1f5f9;padding-left:11px}
.gc-exfollow-answer-neutral strong{color:#64748b;font-weight:650}
.gc-exfollow-block-before>b{color:#1d4ed8}
.gc-exfollow-answer-before{border-left:3px solid #3b82f6}
.gc-exfollow-block-after>b{color:#047857}
.gc-exfollow-answer-after{border-left:3px solid #10b981}
.gc-exfollow-answer-symptom{border-left:3px solid #db2777}
.gc-exfollow-answer-note{border-left:3px solid #f97316}
.gc-exfollow-block-reply>b{color:#047857}
@media(max-width:640px){.gc-exfollow-answers{grid-template-columns:1fr}}

/* Exercícios — faixa horizontal baixa, imagem à esquerda, texto à direita. */
.gc-exfollow-ex-row{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px}
.gc-exfollow-ex-card{position:relative;flex:0 0 auto;display:flex;align-items:center;gap:8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:6px 14px 6px 6px;min-width:150px}
.gc-exfollow-ex-photo{width:38px;height:38px;flex:0 0 auto;object-fit:cover;border-radius:7px;background:#e2e8f0;display:block}
.gc-exfollow-ex-photo-empty{display:flex;align-items:center;justify-content:center}
.gc-exfollow-ex-text{display:flex;flex-direction:column;gap:1px;min-width:0}
.gc-exfollow-ex-name{font-weight:700;color:#0f172a;font-size:11.5px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px}
.gc-exfollow-ex-meta{font-size:10.5px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px}
.gc-exfollow-ex-dot{position:absolute;top:6px;right:6px;width:7px;height:7px;border-radius:50%}
.gc-exfollow-ex-dot-alt{background:#f59e0b}
.gc-exfollow-ex-dot-skip{background:#ef4444}

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
.gc-exfollow-reply-message{border:1px solid #e2e8f0;border-left-width:3px;border-left-color:#10b981;background:#fff;border-radius:8px;padding:8px 10px 8px 8px}
.gc-exfollow-reply-message p{margin:0;font-size:12px;color:#0f172a;white-space:pre-wrap}
.gc-exfollow-reply-message-meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:5px;font-size:10px;color:#64748b}
.gc-exfollow-reply{display:flex;flex-direction:column;gap:2px}
.gc-exfollow-reply-textarea{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:9px;padding:8px 10px;font:400 12.5px inherit;color:#0f172a;resize:vertical}
.gc-exfollow-reply-actions{display:flex;gap:8px;margin-top:8px}
.gc-exfollow-reply-save{border:1px solid #0f2d52;background:#0f2d52;color:#fff;border-radius:8px;padding:7px 12px;font:650 12px inherit;cursor:pointer}
.gc-exfollow-reply-save:disabled{opacity:.6;cursor:default}
.gc-exfollow-reply-cancel{border:1px solid #cbd5e1;background:#fff;color:#0f2d52;border-radius:8px;padding:7px 12px;font:650 12px inherit;cursor:pointer}
.gc-exfollow-reply-cancel:disabled{opacity:.6;cursor:default}
.gc-exfollow-reply-open{border:1px solid #cbd5e1;background:#fff;color:#0f2d52;border-radius:8px;padding:6px 12px;font:650 11.5px inherit;cursor:pointer}
.gc-exfollow-reply-error{margin-top:8px;font-size:11.5px;color:#b91c1c}
.gc-exfollow-reply-success{margin-bottom:8px;font-size:11.5px;color:#047857;font-weight:650}

.gc-exfollow-error{border:1px solid #fecaca;background:#fef2f2;color:#991b1b;border-radius:10px;padding:12px 14px;font-size:12px}
@media(max-width:800px){
  .gc-exfollow-grid,.gc-exfollow-mini-grid{grid-template-columns:1fr}
  .gc-exfollow-row{flex-wrap:wrap;row-gap:8px}
  .gc-exfollow-tl-toggle{margin-left:0}
}
`;
}

/* renderAttentionBlock — Bloco 1 ("Porque precisa da minha atenção agora?").
   Usa EXATAMENTE os mesmos sinais objetivos já usados no Home
   (loadHomeAcompanhamentoExercicio em boot.js): readiness mais recente
   (has_symptoms) e último log (rpe>=8, note, sets[].status). Sem
   interpretação clínica, sem IA, sem query a wo_exercises — sets[]
   alterados/não realizados aparecem só como contagem. Inalterado nesta
   passagem. */
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

/* STATUS_ICON_GLYPH — símbolo dentro do círculo de estado, por classe de
   cor (css) já usada em TIMELINE_STATUS_META. Só apresentação. */
const STATUS_ICON_GLYPH = {
  ok: "✓",
  today: "",
  warn: "",
  removed: "⊘",
  attention: "!",
  neutral: "",
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

/* renderListItemCard — cartão baixo por exercício: foto pequena à esquerda,
   nome + "séries × reps · carga" à direita. photo_url já vem embutido no
   snapshot (sem query a wo_exercises). Sem foto: placeholder discreto,
   nunca imagem partida. Alteração/não realização (só quando o log tiver
   esse exercise_id) aparece só como um ponto discreto — nunca um badge de
   texto em todos os cartões. */
function renderListItemCard(item, log) {
  const photo = item?.photo_url;
  const name = item?.name || "Exercício";
  const prescrito = describeItemPrescribed(item);
  const carga = describeItemLoad(item);
  const metaText = [prescrito, carga].filter(Boolean).join(" · ");
  const logEntry = findLogEntryForExercise(log, item?.exercise_id);
  const rawStatus = logEntry?.status || null;
  const dotClass = rawStatus === "skipped" ? "gc-exfollow-ex-dot-skip" : (rawStatus && rawStatus !== "as_prescribed") ? "gc-exfollow-ex-dot-alt" : null;
  const dotTitle = rawStatus === "skipped" ? "Não realizado" : "Alterado";

  return `
    <div class="gc-exfollow-ex-card">
      ${dotClass ? `<span class="gc-exfollow-ex-dot ${dotClass}" title="${esc(dotTitle)}" aria-hidden="true"></span>` : ""}
      ${photo ? `<img class="gc-exfollow-ex-photo" src="${esc(photo)}" alt="">` : `<div class="gc-exfollow-ex-photo gc-exfollow-ex-photo-empty"></div>`}
      <div class="gc-exfollow-ex-text">
        <div class="gc-exfollow-ex-name">${esc(name)}</div>
        ${metaText ? `<div class="gc-exfollow-ex-meta">${esc(metaText)}</div>` : ""}
      </div>
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

/* READINESS_FEELING_LABELS — texto real das 5 opções da pergunta de
   readiness ("Como se sente hoje?"), tal como apresentadas ao doente.
   Nunca usado para o valor pós-treino (log.feel), que não tem estas
   palavras associadas no questionário final. */
const READINESS_FEELING_LABELS = { 1: "Muito mal", 2: "Mal", 3: "Razoável", 4: "Bem", 5: "Muito bem" };

/* renderAvaliacaoDoente — respostas REAIS do doente aos dois
   questionários do link de treino, em cartões curtos e diretamente
   legíveis (sem escalas gráficas 1-5 nesta passagem).

   ANTES DO TREINO (a partir de wo_session_readiness, quando a linha
   existir): "Como se sente hoje?" (readiness.feeling, com o texto real
   da opção 1-5), "Tem sintomas ou dor?" (readiness.has_symptoms, SIM/NÃO/
   Não respondido conforme o valor for true/false/null) e "Sintoma / dor"
   (readiness.symptom_note) — este último só aparece quando existir texto
   real, nunca "Sem sintomas" por inferência.

   Quando NÃO existe linha de readiness mas existe log (a sessão foi
   registada): o modelo de dados atual não tem nenhum campo que distinga
   de forma inequívoca "o doente iniciou o treino sem responder ao
   questionário pré-treino" de "não há registo de readiness por outro
   motivo" — a única informação disponível é a ausência da linha, que por
   si só não prova a causa. Por isso usa-se sempre a mensagem neutra e
   conservadora "Avaliação pré-treino não disponível.", nunca a afirmação
   mais específica de "iniciou sem responder".

   DEPOIS DO TREINO (a partir de wo_session_logs, quando a linha existir):
   "Esforço percebido" (log.rpe), "Bem-estar" (log.feel — nunca chamado
   "recuperação") e "Nota após o treino" (log.note, só quando existir
   texto real). RPE/Bem-estar mostram "Não respondido" quando o log
   existe mas o campo específico é null — nunca convertido para 0 ou
   qualquer outro valor. */
function renderAvaliacaoDoente(readiness, log) {
  const hasReadiness = !!readiness;
  const hasLog = !!log;

  let antesHtml = "";
  if (hasReadiness) {
    const feelingNum = readiness.feeling != null ? Number(readiness.feeling) : null;
    const feelingLabel = Number.isFinite(feelingNum) ? READINESS_FEELING_LABELS[feelingNum] : null;
    const antesCards = [
      { label: "Como se sente hoje?", value: feelingLabel || "Não respondido", cls: "gc-exfollow-answer-before" },
      { label: "Tem sintomas ou dor?", value: readiness.has_symptoms === true ? "SIM" : readiness.has_symptoms === false ? "NÃO" : "Não respondido", cls: "gc-exfollow-answer-before" },
    ];
    const symptomNote = String(readiness.symptom_note || "").trim();
    if (symptomNote) antesCards.push({ label: "Sintoma / dor", value: symptomNote, cls: "gc-exfollow-answer-symptom" });

    const antesItemsHtml = antesCards.map((c) => `<div class="gc-exfollow-answer ${c.cls}"><b>${esc(c.label)}</b><strong>${esc(c.value)}</strong></div>`).join("");
    antesHtml = `<div class="gc-exfollow-block gc-exfollow-block-before"><b>Antes do treino</b><div class="gc-exfollow-answers">${antesItemsHtml}</div></div>`;
  } else if (hasLog) {
    antesHtml = `<div class="gc-exfollow-block gc-exfollow-block-before"><b>Antes do treino</b><div class="gc-exfollow-answers"><div class="gc-exfollow-answer gc-exfollow-answer-neutral"><b>Avaliação pré-treino</b><strong>Não disponível</strong></div></div></div>`;
  }

  let depoisHtml = "";
  if (hasLog) {
    const depoisCards = [
      { label: "Esforço percebido", value: log.rpe != null && log.rpe !== "" ? `${log.rpe}/10` : "Não respondido", cls: "gc-exfollow-answer-after" },
      { label: "Bem-estar", value: log.feel != null && log.feel !== "" ? `${log.feel}/5` : "Não respondido", cls: "gc-exfollow-answer-after" },
    ];
    const noteText = String(log.note || "").trim();
    if (noteText) depoisCards.push({ label: "Nota após o treino", value: noteText, cls: "gc-exfollow-answer-note" });

    const depoisItemsHtml = depoisCards.map((c) => `<div class="gc-exfollow-answer ${c.cls}"><b>${esc(c.label)}</b><strong>${esc(c.value)}</strong></div>`).join("");
    depoisHtml = `<div class="gc-exfollow-block gc-exfollow-block-after"><b>Depois do treino</b><div class="gc-exfollow-answers">${depoisItemsHtml}</div></div>`;
  }

  return `${antesHtml}${depoisHtml}`;
}

/* renderRespostaMedicaBlock — "A minha resposta": mensagens já enviadas
   para esta sessão (renderSessionMessages, inalterada). Mantida separada
   e exatamente como estava antes desta passagem; só deixou de partilhar
   bloco com sintomas/comentário (agora cobertos por renderAvaliacaoDoente). */
function renderRespostaMedicaBlock(messages) {
  const respostaHtml = renderSessionMessages(messages);
  if (!respostaHtml) return "";
  return `<div class="gc-exfollow-block gc-exfollow-block-reply"><b>A minha resposta</b>${respostaHtml}</div>`;
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
   mostra id/author_user_id/prescription_id/session_id. Inalterado nesta
   passagem. */
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

/* renderResponderAction — botão pequeno "💬 Responder ao doente"/
   "💬 Responder novamente" e, quando aberto, o formulário. Lógica RPC e
   estado (replyState) inalterados nesta passagem — só o texto do botão
   ganhou o ícone do mockup e deixou de ter largura total. */
function renderResponderAction(entry, replyState, messages) {
  const openLabel = messages && messages.length ? "💬 Responder novamente" : "💬 Responder ao doente";

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
   mesma sessão. Ordem: A) "Treino realizado"/"Treino prescrito" (rótulo
   dinâmico consoante a sessão já tenha log) com o visual do treino,
   B) Antes do treino / Depois do treino — respostas reais do doente,
   C) "A minha resposta" (mensagens médicas, inalterada), D) ação de
   responder. O visual do treino depende só do kind efetivo (entry.kind
   ou, na ausência dele — sessão removida do array atual —,
   snapshot.snapshot.kind). */
function renderTimelineDetailPanel(entry, status, replyState, messagesBySessionId) {
  const effectiveKind = entry.kind || entry.snapshot?.snapshot?.kind || null;

  let treinoHtml = "";
  if (effectiveKind === "card") {
    treinoHtml = renderCardTreinoVisual(entry);
  } else if (effectiveKind === "list") {
    treinoHtml = renderListTreinoVisual(entry);
  }
  const treinoLabel = status === "REALIZADA" ? "Treino realizado" : "Treino prescrito";
  const treinoBlockHtml = treinoHtml ? `<div class="gc-exfollow-block"><b>${esc(treinoLabel)}</b>${treinoHtml}</div>` : "";

  const respostasHtml = renderAvaliacaoDoente(entry.readiness, entry.log);

  const messages = messagesBySessionId ? (messagesBySessionId.get(entry.sessionId) || []) : [];
  const respostaMedicaHtml = renderRespostaMedicaBlock(messages);
  const responderHtml = `<div class="gc-exfollow-block">${renderResponderAction(entry, replyState, messages)}</div>`;

  const blocks = [treinoBlockHtml, respostasHtml, respostaMedicaHtml, responderHtml].filter(Boolean);
  return `<div class="gc-exfollow-detail">${blocks.join("")}</div>`;
}

/* renderRowField — um campo compacto da linha fechada da sessão (ícone +
   label + valor + legenda opcional), separado dos vizinhos por um traço
   vertical (CSS, via :not(:first-child)). Só apresentação. */
function renderRowField(cls, icon, label, value, caption) {
  return `<div class="gc-exfollow-field${cls ? ` ${cls}` : ""}">
    ${icon ? `<span class="gc-exfollow-field-icon" aria-hidden="true">${icon}</span>` : ""}
    <div class="gc-exfollow-field-text">
      <span class="gc-exfollow-field-label">${esc(label)}</span>
      <span class="gc-exfollow-field-value">${esc(value)}</span>
      ${caption ? `<span class="gc-exfollow-field-caption">${esc(caption)}</span>` : ""}
    </div>
  </div>`;
}

/* renderTimelineItem — uma linha compacta por sessão (lista tipo tabela).
   Fechada por defeito: círculo de estado + data + badge, campos com traço
   vertical só quando EXISTIREM (RPE, bem-estar pós-treino, sintomas/
   comentário com trecho curto, "respondido") e o botão à direita. Sessões
   que já eram objetivamente classificadas como merecendo atenção (mesmos
   sinais do Bloco 1: RPE≥8, sintomas, comentário, exercícios alterados/
   não realizados, ou estado NAO_REALIZADA) recebem só um indicador
   lateral discreto — nunca uma moldura à volta de todo o cartão. */
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
    fields.push(renderRowField("", "", "RPE", `${entry.log.rpe}/10`, "Esforço"));
  }
  if (entry.log?.feel != null && entry.log?.feel !== "") {
    fields.push(renderRowField("gc-exfollow-field-wellbeing", "✓", "Bem-estar", `${entry.log.feel}/5`, "Pós-treino"));
  }
  if (hasSymptoms) {
    const preview = truncateText(entry.readiness?.symptom_note, 40) || "Reportados";
    fields.push(renderRowField("gc-exfollow-field-symptom", "⚠", "Sintomas", preview, null));
  }
  if (hasComment) {
    fields.push(renderRowField("gc-exfollow-field-comment", "💬", "Comentário", truncateText(entry.log?.note, 56), null));
  }
  if (hasReply) {
    fields.push(renderRowField("gc-exfollow-field-reply", "✓", "A minha resposta", "Respondido", null));
  }

  const rpeNum = Number(entry.log?.rpe);
  const { altered, skipped } = computeSetsCounts(entry.log);
  const precisaAtencao = status === "NAO_REALIZADA" || hasSymptoms || hasComment
    || (Number.isFinite(rpeNum) && rpeNum >= 8) || altered > 0 || skipped > 0;

  const itemClass = `gc-exfollow-tl-item gc-exfollow-tl-${meta.css}${precisaAtencao ? " gc-exfollow-tl-flagged" : ""}`;
  const iconGlyph = STATUS_ICON_GLYPH[meta.css] || "";

  return `
    <div class="${itemClass}">
      <div class="gc-exfollow-row">
        <div class="gc-exfollow-row-date">
          <span class="gc-exfollow-row-icon" aria-hidden="true">${iconGlyph}</span>
          <div>
            <div class="gc-exfollow-tl-date">${esc(sessionDateLabel)}</div>
            <span class="gc-exfollow-tl-badge">${esc(meta.label)}</span>
          </div>
        </div>
        <div class="gc-exfollow-row-fields">${fields.join("")}</div>
        <button type="button" class="gc-exfollow-tl-toggle" data-toggle-session="${esc(entry.sessionId)}">${isExpanded ? "Fechar treino" : "Ver treino"}</button>
      </div>
      ${isExpanded ? renderTimelineDetailPanel(entry, status, replyState, messagesBySessionId) : ""}
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

/* ==================== Evolução clínica global ==================== */

/* sessionModalityLabel — rótulo do tipo de treino por sessão, a partir
   EXCLUSIVAMENTE de entry.kind/snapshot.snapshot.kind (campo técnico já
   real, já usado em todo o ficheiro) e snapshot.snapshot.modality (texto
   real já usado em renderCardTreinoVisual). "Ginásio"/"Cardio" são
   rótulos fixos do vocabulário de `kind` (mesma categoria de coisa que
   TIMELINE_STATUS_META/READINESS_FEELING_LABELS — mapear um código real
   para uma palavra, nunca inferir por sessão/exercício/data). Sem kind
   conhecido (nem no array atual, nem no snapshot) → "—". */
function sessionModalityLabel(entry) {
  const effectiveKind = entry.kind || entry.snapshot?.snapshot?.kind || null;
  if (effectiveKind === "list") return "Ginásio";
  if (effectiveKind === "card") return entry.snapshot?.snapshot?.modality || "Cardio";
  return "—";
}

/* addDaysISO — soma/subtrai dias a uma data "yyyy-mm-dd", devolvendo
   "yyyy-mm-dd". Só usado pelo filtro "Últimos 14 dias". */
function addDaysISO(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00`);
  d.setDate(d.getDate() + days);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/* computeEvolucaoClinica — todas as agregações objetivas da Evolução
   clínica global, calculadas sobre o MESMO array deduplicado (uma
   entrada por session_id) que buildTimelineSessions já produz para a
   Linha temporal — sem query nova, sem reagrupar por data.

   Adesão: denominador = REALIZADA + NAO_REALIZADA + INICIADA_SEM_REGISTO
   (dentro do período); numerador = REALIZADA. HOJE ainda não realizada,
   PREVISTA, REMOVIDA_ANTES, REMOVIDA_DEPOIS e INDETERMINADO nunca entram
   no denominador — uma sessão de hoje ainda por realizar não reduz a
   adesão antes do dia terminar, e uma sessão removida não conta como
   exigível. Sem risco de dupla contagem: cada session_id contribui para
   exatamente um estado, percorrido uma única vez. */
function computeEvolucaoClinica(prescription, snapshots, readinessRows, logRows, todayISO, filter) {
  const entries = buildTimelineSessions(prescription, snapshots, readinessRows, logRows);
  const windowStart = filter === "14d" ? addDaysISO(todayISO, -13) : null;

  const classified = entries.map((entry) => ({
    entry,
    status: classifySession(entry, todayISO),
    date: resolveSessionDate(entry),
  }));

  const inPeriod = classified.filter(({ date }) => {
    if (filter !== "14d") return true;
    if (!date) return false;
    return date >= windowStart && date <= todayISO;
  });

  let realizadas = 0;
  let naoRealizadas = 0;
  let iniciadasSemRegisto = 0;
  let alteradosTotal = 0;
  let naoRealizadosExTotal = 0;
  const tabelaRows = [];
  const notas = [];

  inPeriod.forEach(({ entry, status, date }) => {
    if (status === "REALIZADA") realizadas++;
    else if (status === "NAO_REALIZADA") naoRealizadas++;
    else if (status === "INICIADA_SEM_REGISTO") iniciadasSemRegisto++;

    if (entry.log) {
      const { altered, skipped } = computeSetsCounts(entry.log);
      alteradosTotal += altered;
      naoRealizadosExTotal += skipped;
    }

    if (status === "REALIZADA" || status === "NAO_REALIZADA" || status === "INICIADA_SEM_REGISTO" || status === "HOJE") {
      tabelaRows.push({ entry, status, date });
    }

    const symptomNote = String(entry.readiness?.symptom_note || "").trim();
    if (symptomNote) {
      notas.push({ entry, date, label: "Sintoma / dor", text: symptomNote, sortKey: entry.readiness?.answered_at || date || "" });
    }
    const noteText = String(entry.log?.note || "").trim();
    if (noteText) {
      notas.push({ entry, date, label: "Nota após o treino", text: noteText, sortKey: entry.log?.logged_at || date || "" });
    }
  });

  const adesaoDenominador = realizadas + naoRealizadas + iniciadasSemRegisto;
  const adesaoPct = adesaoDenominador > 0 ? Math.round((realizadas / adesaoDenominador) * 100) : null;

  tabelaRows.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
  });

  notas.sort((a, b) => new Date(b.sortKey) - new Date(a.sortKey));

  return {
    totalAnalisadas: inPeriod.length,
    realizadas,
    naoRealizadas,
    iniciadasSemRegisto,
    adesaoDenominador,
    adesaoPct,
    alteradosTotal,
    naoRealizadosExTotal,
    tabelaRows,
    notas,
  };
}

function renderEvolucaoStatCard(cls, label, value) {
  return `<div class="gc-exclinic-stat ${cls}"><b>${esc(label)}</b><strong>${esc(value)}</strong></div>`;
}

/* renderEvolucaoTableRow — uma linha por sessão exigível (REALIZADA/
   NAO_REALIZADA/INICIADA_SEM_REGISTO/HOJE). Suporta múltiplas sessões no
   mesmo dia sem qualquer mistura: cada linha vem de um `entry` já
   individual (por session_id) devolvido por buildTimelineSessions —
   nunca se agrupa nem associa por data. */
function renderEvolucaoTableRow({ entry, status, date }) {
  const meta = TIMELINE_STATUS_META[status] || TIMELINE_STATUS_META.INDETERMINADO;
  const dateLabel = fmtSessionDate(date) || "—";
  const modality = sessionModalityLabel(entry);

  const feelingNum = entry.readiness?.feeling != null ? Number(entry.readiness.feeling) : null;
  const feelingLabel = Number.isFinite(feelingNum) ? READINESS_FEELING_LABELS[feelingNum] : null;
  const comoSeSente = feelingLabel ? `${feelingLabel} (${feelingNum}/5)` : "—";

  const sintomas = entry.readiness?.has_symptoms === true ? "Sim" : entry.readiness?.has_symptoms === false ? "Não" : "—";
  const rpe = entry.log?.rpe != null && entry.log?.rpe !== "" ? `${entry.log.rpe}/10` : "—";
  const bemEstar = entry.log?.feel != null && entry.log?.feel !== "" ? `${entry.log.feel}/5` : "—";

  return `
    <tr>
      <td>${esc(dateLabel)}</td>
      <td>${esc(modality)}</td>
      <td><span class="gc-exclinic-status-dot gc-exfollow-legend-dot-${esc(meta.css)}"></span>${esc(meta.label)}</td>
      <td>${esc(comoSeSente)}</td>
      <td>${esc(sintomas)}</td>
      <td>${esc(rpe)}</td>
      <td>${esc(bemEstar)}</td>
    </tr>`;
}

/* renderEvolucaoNote — nota real do doente (symptom_note ou log.note),
   texto integral, com data + tipo de treino + origem — a coluna "treino"
   garante que duas notas do mesmo dia (sessões diferentes) nunca se
   confundem. */
function renderEvolucaoNote(n) {
  const dateLabel = fmtSessionDate(n.date) || "—";
  const modality = sessionModalityLabel(n.entry);
  return `
    <div class="gc-exclinic-note">
      <div class="gc-exclinic-note-meta">${esc(dateLabel)} · ${esc(modality)} · ${esc(n.label)}</div>
      <p>${esc(n.text)}</p>
    </div>`;
}

/* buildAxisTicks — valores inteiros a marcar no eixo de um gráfico. Só
   apresentação (nunca influencia que pontos existem). */
function buildAxisTicks(min, max) {
  const span = max - min;
  if (span <= 5) {
    const ticks = [];
    for (let v = min; v <= max; v++) ticks.push(v);
    return ticks;
  }
  const step = Math.ceil(span / 4);
  const ticks = [];
  for (let v = min; v <= max; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] !== max) ticks.push(max);
  return ticks;
}

/* buildChartPoints — um ponto por session_id com valor real (nunca
   inventa/zera valores ausentes: sem valor, sem ponto). `rows` é sempre
   tabelaRows já calculado por computeEvolucaoClinica (mesma ordem
   cronológica, uma entrada por sessão), nunca reagrupado por data — a
   posição `index` é a posição sequencial nesse array, por isso duas
   sessões no mesmo dia ocupam índices (posições) distintos. */
function buildChartPoints(rows, valueFn) {
  return rows
    .map((row, index) => {
      const raw = valueFn(row.entry);
      const value = raw != null && raw !== "" ? Number(raw) : NaN;
      if (!Number.isFinite(value)) return null;
      return { index, value, row };
    })
    .filter(Boolean);
}

/* renderChartSvg — gráfico de linha em SVG puro (sem biblioteca), uma ou
   mais séries sobre o MESMO eixo X sequencial (`rows` = tabelaRows). Cada
   ponto tem um <title> nativo com data + modalidade (sessionModalityLabel,
   já garante sessões do mesmo dia distinguíveis) + valor real. Linha só
   liga pontos que realmente existem — nunca interpola nem inventa um
   valor no índice em falta. */
function renderChartSvg({ rows, series, valueMin, valueMax, height }) {
  if (!rows.length) {
    return `<div class="gc-exfollow-note-muted">Sem sessões com dados neste período.</div>`;
  }

  const paddingX = 18;
  const paddingY = 14;
  const pointSpacing = 34;
  const plotHeight = height - paddingY * 2;
  const chartWidth = Math.max(80, paddingX * 2 + Math.max(rows.length - 1, 0) * pointSpacing);

  const xFor = (index) => paddingX + index * pointSpacing;
  const yFor = (value) => paddingY + (1 - (value - valueMin) / (valueMax - valueMin)) * plotHeight;

  const ticks = buildAxisTicks(valueMin, valueMax);
  const gridHtml = ticks.map((t) => {
    const y = yFor(t);
    return `<line x1="14" y1="${y}" x2="${chartWidth - 6}" y2="${y}" class="gc-exclinic-chart-grid" /><text x="0" y="${y + 3}" class="gc-exclinic-chart-tick">${esc(t)}</text>`;
  }).join("");

  const seriesHtml = series.map((s) => {
    const pts = buildChartPoints(rows, s.valueFn);
    if (!pts.length) return "";
    const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"}${xFor(p.index)},${yFor(p.value)}`).join(" ");
    const dotsHtml = pts.map((p) => {
      const dateLabel = fmtSessionDate(p.row.date) || "Data desconhecida";
      const modality = sessionModalityLabel(p.row.entry);
      const valueLabel = s.formatValue ? s.formatValue(p.value) : String(p.value);
      const tooltip = `${dateLabel} · ${modality} · ${s.label}: ${valueLabel}`;
      return `<circle cx="${xFor(p.index)}" cy="${yFor(p.value)}" r="3.5" class="gc-exclinic-chart-dot gc-exclinic-chart-dot-${s.cls}"><title>${esc(tooltip)}</title></circle>`;
    }).join("");
    return `<path d="${pathD}" class="gc-exclinic-chart-line gc-exclinic-chart-line-${s.cls}" fill="none" />${dotsHtml}`;
  }).join("");

  return `
    <div class="gc-exclinic-chart-wrap">
      <svg class="gc-exclinic-chart-svg" viewBox="0 0 ${chartWidth} ${height}" width="${chartWidth}" height="${height}">
        ${gridHtml}
        ${seriesHtml}
      </svg>
    </div>`;
}

/* renderEvolucaoCharts — os dois gráficos longitudinais. Fonte EXCLUSIVA:
   tabelaRows já calculado por computeEvolucaoClinica (mesmo array usado
   pela tabela "Evolução por sessão" — já filtrado pelo período, já
   ordenado cronologicamente, uma entrada por session_id). Sem query
   nova, sem tocar em buildTimelineSessions/classifySession/
   resolveSessionDate. Gráfico 1: readiness.feeling ("Como se sente
   hoje?") + log.feel ("Bem-estar pós-treino"), escala 1-5. Gráfico 2:
   log.rpe ("Esforço percebido"), escala 1-10. Nunca deriva/rotula
   "fadiga" ou "cansaço" — só os valores reais das duas perguntas. */
function renderEvolucaoCharts(tabelaRows) {
  const bemEstarHtml = renderChartSvg({
    rows: tabelaRows,
    valueMin: 1,
    valueMax: 5,
    height: 110,
    series: [
      {
        cls: "feeling",
        label: "Como se sente hoje?",
        valueFn: (entry) => entry.readiness?.feeling,
        formatValue: (v) => {
          const label = READINESS_FEELING_LABELS[v];
          return label ? `${label} (${v}/5)` : `${v}/5`;
        },
      },
      {
        cls: "feel",
        label: "Bem-estar pós-treino",
        valueFn: (entry) => entry.log?.feel,
        formatValue: (v) => `${v}/5`,
      },
    ],
  });

  const rpeHtml = renderChartSvg({
    rows: tabelaRows,
    valueMin: 1,
    valueMax: 10,
    height: 100,
    series: [
      {
        cls: "rpe",
        label: "RPE",
        valueFn: (entry) => entry.log?.rpe,
        formatValue: (v) => `${v}/10`,
      },
    ],
  });

  return `
    <div class="gc-exfollow-section">
      <h2>Evolução do bem-estar</h2>
      <p>Como se sente hoje (antes do treino) e bem-estar pós-treino — um ponto por sessão.</p>
      <div class="gc-exclinic-chart-legend">
        <span><i class="gc-exclinic-chart-legend-dot gc-exclinic-chart-dot-feeling"></i>Como se sente hoje?</span>
        <span><i class="gc-exclinic-chart-legend-dot gc-exclinic-chart-dot-feel"></i>Bem-estar pós-treino</span>
      </div>
      ${bemEstarHtml}
    </div>

    <div class="gc-exfollow-section">
      <h2>Esforço percebido</h2>
      <p>RPE por sessão.</p>
      <div class="gc-exclinic-chart-legend">
        <span><i class="gc-exclinic-chart-legend-dot gc-exclinic-chart-dot-rpe"></i>RPE</span>
      </div>
      ${rpeHtml}
    </div>`;
}

/* renderEvolucaoClinicaView — vista interna do cartão "Evolução clínica
   global". Usa exclusivamente prescription/snapshots/readinessRows/
   logRows já carregados e buildTimelineSessions/classifySession/
   resolveSessionDate/computeSetsCounts já validados — zero query nova,
   zero interpretação clínica, zero score. */
function renderEvolucaoClinicaView(prescription, snapshots, readinessRows, logRows, evolutionFilter) {
  const todayISO = todayISODate();
  const data = computeEvolucaoClinica(prescription, snapshots, readinessRows, logRows, todayISO, evolutionFilter);

  const statsHtml = `
    <div class="gc-exclinic-stats">
      ${renderEvolucaoStatCard("gc-exclinic-stat-ok", "Realizadas", String(data.realizadas))}
      ${renderEvolucaoStatCard("gc-exclinic-stat-warn", "Não realizadas", String(data.naoRealizadas))}
      ${renderEvolucaoStatCard("gc-exclinic-stat-attention", "Iniciadas sem concluir", String(data.iniciadasSemRegisto))}
      ${renderEvolucaoStatCard("gc-exclinic-stat-neutral", "Adesão", data.adesaoPct == null ? "—" : `${data.adesaoPct}%`)}
      ${renderEvolucaoStatCard("gc-exclinic-stat-muted", "Sessões analisadas", String(data.totalAnalisadas))}
    </div>`;

  const exerciciosHtml = `
    <div class="gc-exclinic-stats gc-exclinic-stats-2">
      ${renderEvolucaoStatCard("gc-exclinic-stat-attention", "Exercícios alterados", String(data.alteradosTotal))}
      ${renderEvolucaoStatCard("gc-exclinic-stat-warn", "Exercícios não realizados", String(data.naoRealizadosExTotal))}
    </div>`;

  const tabelaHtml = data.tabelaRows.length
    ? `<div class="gc-exclinic-table-wrap"><table class="gc-exclinic-table">
        <thead><tr><th>Data</th><th>Treino</th><th>Estado</th><th>Como se sente hoje?</th><th>Sintomas</th><th>RPE</th><th>Bem-estar</th></tr></thead>
        <tbody>${data.tabelaRows.map((row) => renderEvolucaoTableRow(row)).join("")}</tbody>
      </table></div>`
    : `<div class="gc-exfollow-empty">Não existem sessões com dados neste período.</div>`;

  const notasHtml = data.notas.length
    ? `<div class="gc-exclinic-notes">${data.notas.map((n) => renderEvolucaoNote(n)).join("")}</div>`
    : `<div class="gc-exfollow-note-muted">Sem notas do doente neste período.</div>`;

  return `
    <div class="gc-exclinic">
      <button type="button" class="gc-exclinic-back" data-close-evolucao>← Voltar à Linha Temporal</button>

      <div class="gc-exclinic-head">
        <h2>Evolução clínica global</h2>
        <p>Sinais objetivos ao longo do plano — sem interpretação clínica.</p>
      </div>

      <div class="gc-exclinic-filter">
        <button type="button" class="gc-exclinic-filter-btn${evolutionFilter === "14d" ? " is-active" : ""}" data-evolution-filter="14d">Últimos 14 dias</button>
        <button type="button" class="gc-exclinic-filter-btn${evolutionFilter === "completo" ? " is-active" : ""}" data-evolution-filter="completo">Plano completo</button>
      </div>

      ${statsHtml}

      ${renderEvolucaoCharts(data.tabelaRows)}

      <div class="gc-exfollow-section">
        <h2>Exercícios</h2>
        ${exerciciosHtml}
      </div>

      <div class="gc-exfollow-section">
        <h2>Evolução por sessão</h2>
        ${tabelaHtml}
      </div>

      <div class="gc-exfollow-section">
        <h2>Notas do doente</h2>
        ${notasHtml}
      </div>
    </div>`;
}

/* renderShell — topo compacto (voltar + rótulo, depois nome/plano, depois
   os 3 cartões pequenos), Bloco 1 ("Porque precisa da minha atenção
   agora?") mantém a posição atual. "Evolução clínica global" / "Evolução
   por exercício" / "Decisão / Ação médica" em 3 cartões de ação com
   identidade de cor própria (verde/laranja/roxo), antes da linha
   temporal, que passou a ter legenda de estados no cabeçalho da secção. */
function renderShell(root, patient, prescription, readiness, log, snapshots, readinessRows, logRows, expandedSessionId, replyState, messagesBySessionId, activeView, evolutionFilter) {
  const remaining = daysUntil(prescription?.expires_at);
  const endLabel = remaining === null
    ? "—"
    : remaining < 0
      ? "Terminado"
      : remaining === 0
        ? "Termina hoje"
        : `Termina em ${remaining} dia${remaining === 1 ? "" : "s"}`;

  const mainContentHtml = activeView === "evolucao-clinica"
    ? renderEvolucaoClinicaView(prescription, snapshots, readinessRows, logRows, evolutionFilter)
    : `
      <div class="gc-exfollow-section">
        <h2>Porque precisa da minha atenção agora?</h2>
        <p>Sinais objetivos do registo mais recente — sem interpretação clínica.</p>
        ${renderAttentionBlock(readiness, log)}
      </div>

      <div class="gc-exfollow-mini-grid">
        <div class="gc-exfollow-mini-card gc-exfollow-mini-card--green">
          <div class="gc-exfollow-mini-icon" aria-hidden="true">↗</div>
          <h3>Evolução clínica global</h3>
          <p>Sintomas, RPE, sensação pós-treino, adesão e alterações.</p>
          <button type="button" class="gc-exfollow-mini-link" data-open-evolucao>Ver evolução →</button>
        </div>
        <div class="gc-exfollow-mini-card gc-exfollow-mini-card--orange">
          <div class="gc-exfollow-mini-icon" aria-hidden="true">▦</div>
          <h3>Evolução por exercício</h3>
          <p>Prescrito versus realizado e progressão ao longo das sessões.</p>
          <span class="gc-exfollow-mini-link">Ver evolução →</span>
        </div>
        <div class="gc-exfollow-mini-card gc-exfollow-mini-card--purple">
          <div class="gc-exfollow-mini-icon" aria-hidden="true">✎</div>
          <h3>Decisão / Ação médica</h3>
          <p>Área preparada para fechar o circuito de acompanhamento.</p>
          <span class="gc-exfollow-mini-link">Ver decisões / ações →</span>
        </div>
      </div>

      <div class="gc-exfollow-section">
        <div class="gc-exfollow-section-head">
          <div>
            <h2>Linha temporal do plano</h2>
            <p>Sessões realizadas, previstas, não realizadas e removidas.</p>
          </div>
          <div class="gc-exfollow-legend">
            <span><i class="gc-exfollow-legend-dot gc-exfollow-legend-dot-ok"></i>Realizada</span>
            <span><i class="gc-exfollow-legend-dot gc-exfollow-legend-dot-today"></i>Prevista</span>
            <span><i class="gc-exfollow-legend-dot gc-exfollow-legend-dot-warn"></i>Não realizada</span>
            <span><i class="gc-exfollow-legend-dot gc-exfollow-legend-dot-removed"></i>Removida</span>
          </div>
        </div>
        ${renderTimelineBlock(prescription, snapshots, readinessRows, logRows, expandedSessionId, replyState, messagesBySessionId)}
      </div>`;

  root.innerHTML = `
    <style>${styles()}</style>
    <section class="gc-exfollow">
      <div class="gc-exfollow-topbar">
        <button type="button" class="gc-exfollow-back" id="gcExFollowBack">← Voltar ao Início</button>
        <span class="gc-exfollow-topbar-label">Acompanhamento de exercício</span>
      </div>

      <div class="gc-exfollow-titlecard">
        <h1 class="gc-exfollow-title">${esc(patient?.full_name || "Doente")}</h1>
        <p class="gc-exfollow-sub">Plano ${fmtDate(prescription?.created_at)} → ${fmtDate(prescription?.expires_at)}</p>
      </div>

      <div class="gc-exfollow-grid">
        <div class="gc-exfollow-card"><b>Estado do plano</b><strong>${esc(prescription?.status || "—")}</strong></div>
        <div class="gc-exfollow-card"><b>Fim do plano</b><strong>${esc(endLabel)}</strong></div>
        <div class="gc-exfollow-card"><b>Primeira abertura</b><strong>${fmtDate(prescription?.first_opened_at)}</strong></div>
      </div>

      ${mainContentHtml}
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

  /* Estado local (não G) da Evolução clínica global: qual vista está
     ativa ("timeline" ou "evolucao-clinica") e o filtro temporal
     selecionado. Sem query nova ao mudar — repinta com os mesmos arrays
     já carregados acima. */
  let activeView = "timeline";
  let evolutionFilter = "14d";

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
    renderShell(root, patientRes.data, prescriptionRes.data, latestReadiness, latestLog, snapshots, readinessRows, logRows, expandedSessionId, replyState, messagesBySessionId, activeView, evolutionFilter);

    document.getElementById("gcExFollowBack")?.addEventListener("click", () => {
      if (typeof onBack === "function") onBack();
    });

    root.querySelectorAll("[data-open-evolucao]").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeView = "evolucao-clinica";
        paint();
      });
    });

    root.querySelectorAll("[data-close-evolucao]").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeView = "timeline";
        expandedSessionId = null;
        resetReplyState();
        paint();
      });
    });

    root.querySelectorAll("[data-evolution-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const val = btn.getAttribute("data-evolution-filter");
        if (val) evolutionFilter = val;
        paint();
      });
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
