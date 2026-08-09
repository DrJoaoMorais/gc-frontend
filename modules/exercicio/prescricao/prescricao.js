/* =================================================================
   PRESCRICAO.JS — Prescrição de exercício físico (Vertente 1)
   -----------------------------------------------------------------
   Pesquisa/seleciona doente, constrói o plano semanal (sessões de
   ginásio ou modalidade — corrida, natação, etc., como sequência
   de tarefas), organizado por dia sugerido (Seg–Dom) + secção
   "sem dia atribuído". Edição de sessão num painel lateral.
   Grava snapshot em wo_prescriptions.data, gera token e mostra o
   link de acesso do doente (treino.joaomorais.pt/t/{token}).
   ================================================================= */

import { G } from '../../state.js';
import { initCatalogo } from '../catalogo/catalogo.js';

const escAttr = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));
const escHtml = escAttr;

const TREINO_BASE_URL = 'https://treino.joaomorais.pt/t/';

// Sobe este número sempre que prescricao.css mudar de forma visível. Sem isto, o
// <link> é injectado sempre com o mesmo URL e o browser (ou o CDN) pode continuar a
// servir a folha de estilo antiga depois de um deploy — foi o que aconteceu a 9 ago
// 2026 com o ecrã de 2 modos: HTML novo, CSS velho, tudo sem estilo nenhum.
const PRESCRICAO_CSS_VERSION = '2026-08-09-14';

const DIAS_SEMANA = [
  { value: 'seg', label: 'Seg', full: 'Segunda-feira' },
  { value: 'ter', label: 'Ter', full: 'Terça-feira' },
  { value: 'qua', label: 'Qua', full: 'Quarta-feira' },
  { value: 'qui', label: 'Qui', full: 'Quinta-feira' },
  { value: 'sex', label: 'Sex', full: 'Sexta-feira' },
  { value: 'sab', label: 'Sáb', full: 'Sábado' },
  { value: 'dom', label: 'Dom', full: 'Domingo' },
];

const RESTRICOES_PREDEFINIDAS = [
  'Sem impacto',
  'Sem carga axial',
  'Sem carga no membro superior direito',
  'Sem carga no membro superior esquerdo',
  'Sem carga no membro inferior direito',
  'Sem carga no membro inferior esquerdo',
  'Amplitude articular limitada',
  'Sem material de resistência',
];

/* ── Ícones — traço, currentColor, estilo do rail real (shell.js) ── */
const ICON_GINASIO = `<svg viewBox="0 0 20 20" fill="none"><rect x="1.5" y="7" width="3" height="6" rx="1" stroke="currentColor" stroke-width="1.6"/><rect x="15.5" y="7" width="3" height="6" rx="1" stroke="currentColor" stroke-width="1.6"/><path d="M4.5 10h11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M6.5 8v4M13.5 8v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
const ICON_CORRIDA = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="13" cy="3.6" r="1.4" fill="currentColor" stroke="none"/><path d="M9 6.5l2.3 2 .7 3-2 4.5M11.3 8.5L8 9.7l-2 3.3M11.3 8.5l3 .8 2 2.7M6 18l2-3.3"/></svg>`;
const ICON_NATACAO = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8.5c1.4 1.6 4 2 5.5 0S11 6.9 12.5 8.5s4.1 1.6 5.5 0"/><path d="M2 13c1.4 1.6 4 2 5.5 0s3.5-1.6 5-0 4.1 1.6 5.5 0"/><path d="M6 6l2.2-3 3 1.4-1 2.3"/></svg>`;
const ICON_CICLISMO = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="14.5" r="3"/><circle cx="15" cy="14.5" r="3"/><path d="M5 14.5l3.5-7h4L15 14.5M8.5 7.5H7M11 4h2.5l1.5 3.5"/></svg>`;
const ICON_REMO = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l9 9M9.5 5.5l-6 6M14.5 10.5l-6 6"/><path d="M13 3l4 4M14 12.5c1.8 1.6 2 3.3 1 4.5-1.2 1-2.9.8-4.5-1"/></svg>`;
const ICON_OUTRO = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="7.2"/><path d="M10 6.3v3.7l2.4 1.4"/></svg>`;
// Cruz preenchida (não traçada) — testada com renderização real (cairosvg) fora do
// browser depois de o Morais reportar "nota-se mas não se vê": um traço fino de
// 1.6px sobre fundo claro é demasiado subtil para se ver com confiança num ecrã
// real; barras preenchidas + fundo/ícone a alto contraste resolvem isso de vez.
const ICON_MAIS = `<svg viewBox="0 0 20 20"><rect x="8.6" y="4.5" width="2.8" height="11" rx="1.2" fill="currentColor"/><rect x="4.5" y="8.6" width="11" height="2.8" rx="1.2" fill="currentColor"/></svg>`;
const ICON_PENCIL = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12.5 3.5l4 4L6 18H2v-4L12.5 3.5z"/></svg>`;
const ICON_TRASH = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h12M8 6V4.5A1.5 1.5 0 019.5 3h1A1.5 1.5 0 0112 4.5V6m-6.5 0L6 16.5A1.5 1.5 0 007.5 18h5a1.5 1.5 0 001.5-1.5L14.5 6"/></svg>`;
const ICON_CLOSE = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 5l10 10M15 5L5 15"/></svg>`;
const ICON_FLAG = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17V3.8c2.6-1.2 4.6-1.2 7 0s4.4 1.2 5.6.5V11c-2.6 1.2-4.6 1.2-7 0s-4.4-1.2-5.6-.5"/></svg>`;
const ICON_CLOCK = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="7.2"/><path d="M10 6v4l2.6 1.6"/></svg>`;
const ICON_RULER = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 13l4-4 10 10-4 4-10-10z"/><path d="M8 9l1.5 1.5M10.5 6.5L12 8M13 4l1.5 1.5"/></svg>`;
const ICON_CAMINHADA = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11.5" cy="3.6" r="1.4" fill="currentColor" stroke="none"/><path d="M9 6l3 2-1 3 3 3M11 8l-3 1-2 4M8 11l-2.5 1.5"/></svg>`;
const ICON_CIRCUITO = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8a6 6 0 0110-4.5M16 12a6 6 0 01-10 4.5"/><path d="M13 2l1.5 1.5L13 5M7 18l-1.5-1.5L7 15"/></svg>`;
const ICON_DIAMOND = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M10 2.5l7.5 7.5-7.5 7.5-7.5-7.5z"/></svg>`;
// Menu de acções por sessão no calendário (⋮): Mover/Duplicar (9 ago 2026).
const ICON_DOTS = `<svg viewBox="0 0 20 20" fill="currentColor"><circle cx="10" cy="4" r="2.3"/><circle cx="10" cy="10" r="2.3"/><circle cx="10" cy="16" r="2.3"/></svg>`;
const ICON_MOVE = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10h14M3 10l3.5-3.5M3 10l3.5 3.5M17 10l-3.5-3.5M17 10l-3.5 3.5"/></svg>`;
const ICON_COPY = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="7" y="7" width="10" height="10" rx="2"/><path d="M13 7V5a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2"/></svg>`;
// Pega de arrastar da sessão no calendário — seis pontos em 2 colunas x 3 linhas,
// elemento à parte do menu ⋮ (redesenho do calendário, 9 ago 2026).
const ICON_GRIP = `<svg viewBox="0 0 20 20" fill="currentColor"><circle cx="7" cy="5" r="1.3"/><circle cx="13" cy="5" r="1.3"/><circle cx="7" cy="10" r="1.3"/><circle cx="13" cy="10" r="1.3"/><circle cx="7" cy="15" r="1.3"/><circle cx="13" cy="15" r="1.3"/></svg>`;

// kind por sessão: só 'list' (ginásio) está activo — 'card'/'walk'/'circuit' ficam para os Passos 4/5 (secção 5 do briefing).
const SESSAO_MODALIDADES = [
  { modality: 'Ginásio',   kind: 'list',    enabled: true },
  { modality: 'Corrida',   kind: 'card',    enabled: true },
  { modality: 'Ciclismo',  kind: 'card',    enabled: true },
  { modality: 'Natação',   kind: 'card',    enabled: true },
  { modality: 'Caminhada', kind: 'walk',    enabled: true },
  { modality: 'Circuito',  kind: 'circuit', enabled: true },
];
const LOCAIS_SESSAO = ['Ginásio', 'Casa', 'Clínica', 'Exterior', 'Piscina'];
// Chips de momento do dia — inclui as "rotinas curtas" (pós-almoço/pós-jantar) como
// valores do mesmo campo, em vez de um conceito à parte (9 ago 2026). Simplificação
// consciente: por agora são etiquetas fixas, não uma hora exacta (HH:MM) — fica para
// mais tarde se vier a fazer falta.
const MOMENTOS_SESSAO = [
  { value: 'manha', label: 'Manhã' },
  { value: 'almoco', label: 'Almoço' },
  { value: 'tarde', label: 'Tarde' },
  { value: 'noite', label: 'Noite' },
  { value: 'pos_almoco', label: 'Pós-almoço' },
  { value: 'pos_jantar', label: 'Pós-jantar' },
];
const TIPO_BLOCO_LABELS_PT = { continuous: 'Contínuo', series: 'Séries', closing: 'Fecho' };
const ZONAS = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Z6', 'Z7'];
const CLOSING_MODES = [
  { value: 'rest', label: 'Descanso' },
  { value: 'cooldown', label: 'Arrefecimento' },
  { value: 'walk', label: 'Caminhada' },
  { value: 'easy', label: 'Fácil' },
];
// Zona só se aplica a corrida e ciclismo (briefing secção 3) — natação usa só valor absoluto/RPE.
function modalidadeTemZona(modality) {
  return modality === 'Corrida' || modality === 'Ciclismo';
}

const TIPO_META = {
  ginasio:   { label: 'Ginásio',   icon: ICON_GINASIO,   fg: '#7c3aed', bg: '#f3e8ff' },
  corrida:   { label: 'Corrida',   icon: ICON_CORRIDA,   fg: '#c2410c', bg: '#ffedd5' },
  natacao:   { label: 'Natação',   icon: ICON_NATACAO,   fg: '#1a56db', bg: '#eaf0fd' },
  ciclismo:  { label: 'Ciclismo',  icon: ICON_CICLISMO,  fg: '#0f8a74', bg: '#e3f6f2' },
  caminhada: { label: 'Caminhada', icon: ICON_CAMINHADA, fg: '#15803d', bg: '#dcfce7' },
  circuito:  { label: 'Circuito',  icon: ICON_CIRCUITO,  fg: '#be185d', bg: '#fce7f3' },
};
// Sessões novas usam { kind, modality, local } (secção 5). tipoKey mapeia a modalidade para a chave de TIPO_META.
function tipoKey(s) {
  const m = (s.modality || '').toLowerCase();
  if (m === 'corrida') return 'corrida';
  if (m === 'natação' || m === 'natacao') return 'natacao';
  if (m === 'ciclismo') return 'ciclismo';
  if (m === 'caminhada') return 'caminhada';
  if (m === 'circuito') return 'circuito';
  return 'ginasio';
}

function uuid() { return crypto.randomUUID(); }

// Contagem de conteúdo por kind — usada onde antes só se olhava para `s.items`
// (lista do dia, histórico, botão "Gerar", validação ao guardar).
function sessaoContagem(s) {
  if (s.kind === 'walk') {
    const n = (s.walks || []).length + (s.stairs_flights != null ? 1 : 0);
    return { n, label: n === 1 ? 'item' : 'itens' };
  }
  if (s.kind === 'card' || s.kind === 'circuit') {
    const n = (s.blocks || []).length;
    return { n, label: n === 1 ? 'bloco' : 'blocos' };
  }
  const n = (s.items || []).length;
  return { n, label: n === 1 ? 'exercício' : 'exercícios' };
}
function sessaoTemConteudo(s) {
  return sessaoContagem(s).n > 0;
}

/* ── Ações do topo (Biblioteca/Modelos inertes; Catálogo funcional) ── */
function topActionsHtml(extraButtonsHtml = '') {
  return `
    <div class="gcwo-headeractions">
      <button type="button" class="gcBtnGhost" disabled title="Em breve">Biblioteca de sessões</button>
      <button type="button" class="gcBtnGhost" disabled title="Em breve">Modelos</button>
      <button type="button" class="gcBtnOutline" id="gcwoBtnCatalogo">Catálogo</button>
      ${extraButtonsHtml}
    </div>`;
}
function wireTopActions() {
  document.getElementById('gcwoBtnCatalogo')?.addEventListener('click', () => {
    initCatalogo({ onVoltar: voltarDaCatalogo });
  });
}
function voltarDaCatalogo() {
  loadExercisesCatalog();
  renderCurrentStep();
}
function renderCurrentStep() {
  if (_state.savedLink) renderStep3();
  else if (_state.patient) renderStep2();
  else renderStep1();
}

function ensurePrescricaoCss() {
  const existente = document.querySelector('link[data-gcwo-prescricao]');
  const url = new URL('./prescricao.css', import.meta.url);
  url.searchParams.set('v', PRESCRICAO_CSS_VERSION);
  if (existente) {
    // Já existe uma tag de uma sessão anterior desta mesma página (SPA) — se a versão
    // mudou entretanto, força a recarga da folha de estilo em vez de confiar na antiga.
    if (existente.href !== url.href) existente.href = url.href;
    return;
  }
  const lnk = document.createElement('link');
  lnk.rel = 'stylesheet';
  lnk.href = url.href;
  lnk.dataset.gcwoPrescricao = '1';
  document.head.appendChild(lnk);
}

/* ── Estado local do módulo ─────────────────────────────── */
// Modelo de datas (9 ago 2026, Fase A): cada sessão tem `date` real (ISO "yyyy-mm-dd"),
// não `week`+`day` relativos. O plano tem `startDate`/`endDate` reais em vez de uma
// "duração em semanas" — o calendário passa a ser uma janela rolante (pelo menos 4
// semanas, estica até endDate se o plano for mais comprido), nunca um bloco fixo de N
// semanas. dataRevisao é uma data à parte, só para o Morais se lembrar de reavaliar —
// não tem efeito no link do doente nem no aviso automático (esse continua ligado a
// endDate). duracaoSessaoPadrao/diasPorSemanaHabitual ficam já no modelo de dados;
// o ecrã para os editar fica para a Fase B — por agora só vão com valores por omissão.
function freshState() {
  const inicio = isoAmanha();
  return {
    clinicId: null,
    patient: null,
    exercisesCatalog: [],
    catalogLoaded: false,
    sessions: [],
    restricoesPredefinidas: [],
    restricoesTexto: '',
    restricoesEditing: false,
    startDate: inicio,
    endDate: addDiasIso(inicio, 27), // 4 semanas por omissão — ajustável nos campos de data
    dataRevisao: null,
    duracaoSessaoPadrao: 30,
    diasPorSemanaHabitual: null,
    savedLink: null,
    savedExpiresAt: null,
    // Plano activo carregado para edição directa (9 ago 2026) — ver carregarPlanoActivoSeExistir().
    // activePrescriptionId != null ⇒ gravar actualiza esta linha tal como está no ecrã, sem
    // fundir por chave — essa fusão só faz sentido quando o ecrã nunca mostrou o que já existia.
    activePrescriptionId: null,
    // Snapshot (JSON) das sessões tal como estavam da última vez que "Gerar prescrição
    // e link" gravou com sucesso — null enquanto nada foi gravado ainda. Usado para
    // avisar antes de sair da página com sessões só locais, nunca escritas na base de
    // dados (bug reportado 9 ago 2026: sessões "desaparecem" ao actualizar a página
    // porque só existiam em memória — nunca se tinha carregado em "Gerar prescrição e link").
    __ultimoSnapshotGravado: null,
  };
}
let _state = freshState();
let _loadingPlanoActivo = false;        // a verificar/carregar o plano activo do doente escolhido (9 ago 2026)
let _expandedCardIds = new Set();       // sessões expandidas na lista principal (leitura)
let _panelExpandedTarefaId = null;      // dentro do painel, tarefa expandida (só uma)
let _panelDraft = null;                 // clone de trabalho da sessão em edição — null = painel fechado
let _panelIsNovo = false;
let _panelCatalogFiltro = 'favoritos';  // filtro do catálogo dentro do painel de ginásio
let _panelCatalogBusca = '';
let _panelEquipFiltro = new Set();      // filtro de equipamento (multi-selecção) dentro do painel de ginásio
let _pendingSlot = null;                // {date} — dia escolhido na grelha, modalidade por escolher (ecrã de 2 modos, 9 ago 2026)
let _calMenuDocClickWired = false;      // menu ⋮ por sessão no calendário — fecha ao clicar fora (9 ago 2026)
let _beforeUnloadWired = false;         // aviso ao sair com sessões só locais, nunca gravadas (9 ago 2026)
let _dayPicker = null;                  // {sessionId, mode:'mover'|'duplicar', selecionados:Set(iso)} — modal de escolha de dia(s) (9 ago 2026)
let _historyOpen = false;               // modal "Ver planos anteriores" aberto/fechado
let _historyLoading = false;
let _historyError = '';
let _historyList = [];                  // prescrições deste doente (activas, expiradas ou revogadas)
let _historyDetail = null;              // prescrição seleccionada na lista — null = a mostrar a lista

const CATALOG_FILTROS = [
  { value: 'favoritos', label: 'Favoritos' },
  { value: 'todos', label: 'Todos' },
  { value: 'Membro Inferior', label: 'Membro Inferior' },
  { value: 'Core', label: 'Core' },
  { value: 'Membro Superior', label: 'Membro Superior' },
];
// Mesmos valores de wo_exercises.equipamento (catalogo.js, EQUIPAMENTO_OPCOES) — tem de bater certo com o que lá é gravado.
const EQUIPAMENTO_FILTROS = ['Máquina', 'TRX', 'Elásticos', 'Halteres', 'Peso Corporal'];

function fmtNum(n) {
  if (n == null) return '';
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}
function fmtDistanciaTotal(m) {
  const km = m / 1000;
  const kmTxt = m >= 1000 ? ` (${km.toLocaleString('pt-PT', { maximumFractionDigits: 2 })} km)` : '';
  return `${Math.round(m).toLocaleString('pt-PT')} m${kmTxt}`;
}
function fmtDuracaoTotal(totalS) {
  const totalMin = Math.round(totalS / 60);
  const h = Math.floor(totalMin / 60), mm = totalMin % 60;
  return h > 0 ? `${h}h${String(mm).padStart(2, '0')}` : `${totalMin} min`;
}
// Ritmo — sempre min:seg no ecrã, nunca decimal, nunca guardado como texto livre
// (unidade interna é segundos por quilómetro, secção 3 do briefing).
function fmtPaceEditavel(sec) {
  if (sec == null) return '';
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
function parsePaceParaSegundos(txt) {
  const m = String(txt || '').trim().match(/^(\d+):(\d{1,2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function calcIdade(dob) {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - d.getFullYear();
  const aindaNaoFezAnos = (hoje.getMonth() < d.getMonth()) || (hoje.getMonth() === d.getMonth() && hoje.getDate() < d.getDate());
  if (aindaNaoFezAnos) idade--;
  return idade;
}

// Intervalo de bpm sugerido para a zona escolhida (secção 3 do briefing, 8 ago 2026).
// Prioridade: hr_zones_bpm manual do doente (prova de esforço) > fórmula (Tanaka/Fox) + idade.
// Só há dados de FC para Z1–Z5 — Z6/Z7 do select genérico ficam sem sugestão.
function calcFcMaxFormula(formula, idade) {
  if (idade == null) return null;
  return formula === 'fox' ? Math.round(220 - idade) : Math.round(208 - 0.7 * idade);
}
function bpmRangeParaZona(zona) {
  const p = _state.patient;
  if (!p || !zona) return '';
  const idx = Number(String(zona).replace('Z', ''));
  if (!(idx >= 1 && idx <= 5)) return '';
  const key = 'z' + idx;
  const manual = p.hr_zones_bpm && p.hr_zones_bpm[key];
  if (manual && (manual.min != null || manual.max != null)) {
    return `${manual.min ?? '?'}–${manual.max ?? '?'} bpm`;
  }
  const fcmax = calcFcMaxFormula(p.hr_zone_formula || 'tanaka', calcIdade(p.dob));
  if (fcmax == null) return '';
  const pct = [0, .60, .70, .80, .90, 1];
  const min = Math.round(fcmax * pct[idx - 1]);
  const max = Math.round(fcmax * pct[idx]);
  return `${min}–${max} bpm`;
}

function restricoesAtuais() {
  const lista = [..._state.restricoesPredefinidas];
  const texto = (_state.restricoesTexto || '').trim();
  if (texto) lista.push(texto);
  return lista;
}

const MESES_PT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/* ================================================================
   Datas — modelo por ISO "yyyy-mm-dd" (Fase A, 9 ago 2026)
   Cada sessão grava a data real em que acontece (não week+day relativos). Todas as
   strings de data neste módulo são "yyyy-mm-dd" — comparáveis e ordenáveis como texto
   sem ambiguidade de fuso, e só passam por um Date (sempre UTC-meia-noite) quando é
   preciso somar/subtrair dias ou ler o dia da semana.
   ================================================================ */
function isoDeData(d) {
  const y = d.getUTCFullYear(), m = String(d.getUTCMonth() + 1).padStart(2, '0'), dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
function dataDeIso(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function addDiasIso(iso, n) {
  const d = dataDeIso(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return isoDeData(d);
}
function isoHoje() {
  const h = hojeEmLisboa();
  return isoDeData(new Date(Date.UTC(h.year, h.month - 1, h.day)));
}
function isoAmanha() {
  return addDiasIso(isoHoje(), 1);
}
// Segunda-feira (ISO) da semana em que a data cai — base para desenhar a grelha em
// colunas Seg..Dom verdadeiras, mesmo quando startDate/endDate caem a meio da semana.
function segundaFeiraDeIso(iso) {
  const d = dataDeIso(iso);
  const dow = d.getUTCDay(); // 0=Dom..6=Sáb
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + diff);
  return isoDeData(d);
}
function diaSemanaDeIso(iso) {
  const dow = dataDeIso(iso).getUTCDay(); // 0=Dom..6=Sáb
  return DIAS_SEMANA[dow === 0 ? 6 : dow - 1]; // reindexa para a ordem Seg..Dom de DIAS_SEMANA
}
function fmtDiaMesCurtoIso(iso) {
  const d = dataDeIso(iso);
  return `${d.getUTCDate()} ${MESES_ABREV[d.getUTCMonth()]}.`;
}
function fmtDataPtIso(iso) {
  const d = dataDeIso(iso);
  return `${d.getUTCDate()} de ${MESES_PT[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}
function fmtIntervaloIso(inicioIso, fimIso) {
  const i = dataDeIso(inicioIso), f = dataDeIso(fimIso);
  const mesmoMes = i.getUTCMonth() === f.getUTCMonth() && i.getUTCFullYear() === f.getUTCFullYear();
  if (mesmoMes) return `${i.getUTCDate()}–${f.getUTCDate()} ${MESES_PT[f.getUTCMonth()]}`;
  return `${i.getUTCDate()} ${MESES_ABREV[i.getUTCMonth()]}. – ${f.getUTCDate()} ${MESES_ABREV[f.getUTCMonth()]}.`;
}
// Pré-visualização "N dias · válido de X a Y · aviso a partir de Z" a partir das datas
// reais do plano — substitui o antigo fmtJanelaPlano(semanas), que assumia sempre
// "a começar hoje" e não sabia nada de planos com datas próprias.
function fmtJanelaPlanoIso(startIso, endIso) {
  const dias = Math.round((dataDeIso(endIso) - dataDeIso(startIso)) / 86400000) + 1;
  const avisoIso = addDiasIso(endIso, -4);
  return `${dias} dias · válido de ${fmtDataPtIso(startIso)} a ${fmtDataPtIso(endIso)} · aviso a partir de ${fmtDataPtIso(avisoIso)}`;
}

// Datas reais do ecrã inicial (landing) — created_at/expires_at já são timestamps exactos
// gravados em wo_prescriptions (secção "Gravação"); estes dois usam Date reais (não ISO
// de calendário) porque vêm directamente de colunas timestamptz, não de `sessions[].date`.
function fmtIntervaloPlano(inicio, fim) {
  const mesmoMes = inicio.getMonth() === fim.getMonth() && inicio.getFullYear() === fim.getFullYear();
  if (mesmoMes) return `${inicio.getDate()}–${fim.getDate()} ${MESES_PT[fim.getMonth()]}`;
  return `${inicio.getDate()} ${MESES_ABREV[inicio.getMonth()]}. – ${fim.getDate()} ${MESES_ABREV[fim.getMonth()]}.`;
}
function fmtRelativo(data) {
  if (!data) return '—';
  const dias = Math.floor((Date.now() - data.getTime()) / 86400000);
  if (dias <= 0) return 'Hoje';
  if (dias === 1) return 'Ontem';
  if (dias < 7) return `Há ${dias} dias`;
  return `${data.getDate()} ${MESES_ABREV[data.getMonth()]}.`;
}

// Sessão nova: session_id/date/order/kind/modality/local/momento + o contentor próprio
// de cada kind — items (ginásio), blocks (cardio/circuito) ou walks+stairs_flights
// (caminhada). `date` é ISO "yyyy-mm-dd" real (Fase A, 9 ago 2026) — já não há week/day.
function novaSessaoSkeleton(modality, kind, date) {
  const sessoesNoDia = _state.sessions.filter(s => s.date === date);
  const base = {
    session_id: uuid(),
    date,
    order: sessoesNoDia.length,
    kind,
    modality,
    local: null,
    momento: null,
  };
  if (kind === 'walk') return { ...base, walks: [], stairs_flights: null };
  if (kind === 'card' && modality === 'Natação') return { ...base, blocks: [], pool_length_m: 25, stroke: 'crol' };
  if (kind === 'card' || kind === 'circuit') return { ...base, blocks: [] };
  return { ...base, items: [] };
}
function cloneSession(s) {
  return structuredClone(s);
}

// Ao escolher um doente (landing ou pesquisa), verifica se já tem um plano activo e, se
// tiver, carrega-o tal como está — sessões reais nas datas reais, prontas a editar (9 ago
// 2026). Antes disto o ecrã começava sempre vazio e só se fundia com o plano activo ao
// gravar (mesclarSessoes/chaveSessao) — com o calendário sempre visível isso passou a
// parecer avariado (o doente via "não tenho nada", mesmo já tendo um plano a decorrer).
// Desde a Fase A (datas reais em vez de week+day), startDate/endDate/etc. vêm gravados
// tal e qual em `data` — já não é preciso derivar nada de created_at.
async function carregarPlanoActivoSeExistir() {
  _state.activePrescriptionId = null;
  if (!_state.patient) return;

  const { data, error } = await window.sb
    .from('wo_prescriptions')
    .select('id,data')
    .eq('patient_id', _state.patient.id)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    // Falhar a verificação não deve impedir a prescrição — fica como plano novo (o
    // comportamento de sempre); é mais seguro do que bloquear o médico a meio de uma consulta.
    console.error('[prescricao] falha a verificar plano activo:', error);
    return;
  }
  if (!data) return; // sem plano activo — quadro em branco, como sempre foi para doentes novos

  _state.activePrescriptionId = data.id;
  _state.startDate = data.data?.startDate || _state.startDate;
  _state.endDate = data.data?.endDate || _state.endDate;
  _state.dataRevisao = data.data?.dataRevisao || null;
  _state.duracaoSessaoPadrao = data.data?.duracaoSessaoPadrao || 30;
  _state.diasPorSemanaHabitual = data.data?.diasPorSemanaHabitual ?? null;
  _state.sessions = structuredClone(data.data?.sessions || []);
  // Isto veio da base de dados — não é trabalho por gravar. Sem isto, o aviso de "vais
  // perder sessões" apareceria logo ao abrir um plano já existente, mesmo sem tocar em nada.
  _state.__ultimoSnapshotGravado = JSON.stringify(_state.sessions);
}

/* ── Entry point ─────────────────────────────────────────── */
export async function initPrescricao() {
  const root = document.getElementById('gcwoPrescricaoRoot');
  if (!root) return;

  ensurePrescricaoCss();
  _state = freshState();
  _landing = null;
  _expandedCardIds = new Set();
  _panelExpandedTarefaId = null;
  _panelDraft = null;
  _panelIsNovo = false;
  _historyOpen = false;
  _historyDetail = null;
  document.getElementById('gcwoHistoryOverlay')?.remove();
  _dayPicker = null;
  document.getElementById('gcwoDayPickerOverlay')?.remove();

  const clinicas = G.clinics || [];
  if (clinicas.length === 1) _state.clinicId = clinicas[0].id;

  loadExercisesCatalog(); // não bloqueia o primeiro render
  wireAvisoSairSemGravar();

  renderLanding();
}

// Sessões adicionadas ao calendário só existem em memória (_state.sessions) até se
// clicar em "Gerar prescrição e link" — foi isto que causou o bug reportado 9 ago 2026
// ("faço vários treinos, dou refresh, desaparecem"): os treinos apareciam no calendário
// mas nunca tinham sido gravados na base de dados, porque esse botão final nunca tinha
// sido premido. Isto avisa antes de sair/actualizar a página nessas condições — não
// resolve sozinho a confusão de "o que é que já ficou gravado", mas evita perder o
// trabalho sem aviso nenhum.
function haSessoesPorGravar() {
  if (!_state.sessions.length) return false;
  const actual = JSON.stringify(_state.sessions);
  return actual !== _state.__ultimoSnapshotGravado;
}
function wireAvisoSairSemGravar() {
  if (_beforeUnloadWired) return;
  _beforeUnloadWired = true;
  window.addEventListener('beforeunload', (e) => {
    if (!haSessoesPorGravar()) return;
    e.preventDefault();
    e.returnValue = '';
  });
}

/* ── Catálogo de exercícios (wo_exercises, global ao sistema) ── */
async function loadExercisesCatalog() {
  const { data, error } = await window.sb
    .from('wo_exercises')
    .select('id,name,categoria,equipamento,photo_url,tempo_concentrico_s,tempo_excentrico_s,tempo_exercicio_s,ajustes_maquina,is_favorite,incremento_default,video_url,tecnica_notas')
    .eq('is_active', true)
    .order('categoria')
    .order('name');

  if (error) {
    console.error('[prescricao] falha a carregar wo_exercises:', error);
    _state.exercisesCatalog = [];
  } else {
    _state.exercisesCatalog = data || [];
  }
  _state.catalogLoaded = true;

  // Se o painel de ginásio já está aberto, refresca para o select ganhar opções
  if (_panelDraft) renderPanel();
}

// "dos"/"do"/"da"/"das"/"e" nunca ajudam a identificar a clínica — ficam de fora tanto
// das iniciais do avatar como do nome curto (bug da "Liga dos Amigos do Hospital de
// Santarém" a esticar a grelha do popover, 9 ago 2026).
const STOPWORDS_CLINICA = new Set(['de', 'do', 'da', 'dos', 'das', 'e']);
function palavrasSignificativasClinica(nome) {
  return String(nome || '').trim().split(/\s+/).filter(Boolean).filter(p => !STOPWORDS_CLINICA.has(p.toLowerCase()));
}
function iniciaisClinica(nome) {
  const palavras = palavrasSignificativasClinica(nome);
  if (!palavras.length) return '?';
  return palavras.slice(0, 2).map(w => w[0]).join('').toUpperCase();
}
// Nomes compridos ficam "Primeira palavra (SIGLA)" só neste ecrã (grelha do popover
// e pill) — nunca se toca no nome real da clínica gravado na base de dados.
function nomeCurtoClinica(nome, limite = 16) {
  const texto = String(nome || '').trim();
  if (texto.length <= limite) return texto;
  const palavras = palavrasSignificativasClinica(texto);
  if (palavras.length < 2) return texto;
  const sigla = palavras.map(w => w[0].toUpperCase()).join('');
  return `${palavras[0]} (${sigla})`;
}

/* ================================================================
   PASSO 0 — ecrã inicial do módulo Exercício (landing)
   4 cartões de acesso rápido + lista de doentes com prescrição activa
   (filtrável por clínica, pesquisa e situação). "Exercícios por
   patologia" fica marcado "Em breve" — ainda não tem código nenhum,
   é só o lugar reservado no ecrã (decisão de 9 ago 2026).
   ================================================================ */
let _landing = null;
let _landingDocClickWired = false;

function freshLanding() {
  return { clinicFilter: null, search: '', tab: 'todos', rows: [], loading: true, error: '' };
}

// Fecha o popover da clínica ao clicar fora — anexado uma única vez ao document
// (nunca duplicado, mesmo re-renderizando o ecrã muitas vezes).
function wireLandingDocClickOnce() {
  if (_landingDocClickWired) return;
  _landingDocClickWired = true;
  document.addEventListener('click', (e) => {
    const menu = document.getElementById('gcwoLandingClinicMenu');
    const btn = document.getElementById('gcwoLandingClinicBtn');
    if (!menu || menu.hidden) return;
    if (btn && (btn.contains(e.target) || menu.contains(e.target))) return;
    menu.hidden = true;
  });
}

function renderLanding() {
  const root = document.getElementById('gcwoPrescricaoRoot');
  if (!root) return;
  // Só reinicia tudo (incl. filtro de clínica) na primeira entrada no ecrã. Escolher
  // uma clínica chama renderLanding() outra vez para redesenhar — se isto fizesse
  // sempre freshLanding(), o filtro escolhido era apagado no mesmo instante em que
  // era escolhido.
  if (!_landing) _landing = freshLanding();
  else { _landing.loading = true; _landing.rows = []; _landing.error = ''; }

  const clinicas = G.clinics || [];
  const multiClinica = clinicas.length > 1;
  // Filtro por clínica precisa de continuar a existir para quem tem mais do que uma
  // (super admin com 6, ou um colega em 2) — o que se corrigiu a pedido não foi a
  // função, foi o aspeto: em vez de uma lista a abrir, é uma grelha de cartões
  // clicáveis (mesmo padrão do Passo 1), sem o estado azul estranho que apareceu.
  const filtroLabel = _landing.clinicFilter
    ? nomeCurtoClinica(clinicas.find(c => c.id === _landing.clinicFilter)?.name || '—')
    : (multiClinica ? 'Todas as clínicas' : nomeCurtoClinica(clinicas[0]?.name || '—'));

  root.innerHTML = `
    <div class="gc-page-header">
      <div><div class="gc-page-title">Exercício</div><div class="gc-page-sub">Prescrição, documentos e catálogo</div></div>
      ${multiClinica ? `
      <div class="gcwo-landing-clinicpill-wrap">
        <button type="button" class="gcwo-landing-clinicpill" id="gcwoLandingClinicBtn">
          <span>A mostrar</span><strong>${escHtml(filtroLabel)}</strong>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 3.5l3 3 3-3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <div class="gcwo-landing-clinicpop" id="gcwoLandingClinicMenu" hidden>
          <button type="button" class="gcwo-landing-clinicoption${!_landing.clinicFilter ? ' on' : ''}" data-cid="">
            <span class="avatar all">${clinicas.length}</span><span class="name">Todas as clínicas</span>
          </button>
          ${clinicas.map(c => `
          <button type="button" class="gcwo-landing-clinicoption${_landing.clinicFilter === c.id ? ' on' : ''}" data-cid="${escAttr(c.id)}">
            <span class="avatar">${escHtml(iniciaisClinica(c.name || c.slug))}</span><span class="name">${escHtml(nomeCurtoClinica(c.name || c.slug || ''))}</span>
          </button>`).join('')}
        </div>
      </div>` : `
      <div class="gcwo-landing-clinicpill static"><span>Clínica</span><strong>${escHtml(filtroLabel)}</strong></div>
      `}
    </div>

    <div class="gcwo-landing-cards">
      <button type="button" class="gcwo-landing-card primary" id="gcwoCardPrescrever">
        <span class="gcwo-landing-card-icon">${ICON_MAIS}</span>
        <span class="gcwo-landing-card-title">Prescrever exercício</span>
        <span class="gcwo-landing-card-sub">Procurar um doente e criar ou atualizar o seu plano de exercício.</span>
        <span class="gcwo-landing-card-cta">Procurar doente →</span>
      </button>
      <button type="button" class="gcwo-landing-card" id="gcwoCardPatologia" disabled title="Em breve — ainda não construído">
        <span class="gcwo-landing-card-icon doc">${ICON_FLAG}</span>
        <span class="gcwo-landing-card-title">Exercícios por patologia <span class="gcwo-landing-soon">Em breve</span></span>
        <span class="gcwo-landing-card-sub">Escolher um documento em PDF para entregar ao doente.</span>
      </button>
      <button type="button" class="gcwo-landing-card" id="gcwoCardCatalogo">
        <span class="gcwo-landing-card-icon cat">${ICON_GINASIO}</span>
        <span class="gcwo-landing-card-title">Catálogo de exercícios</span>
        <span class="gcwo-landing-card-sub">Gerir exercícios, imagens, equipamento e tempos de execução.</span>
        <span class="gcwo-landing-card-cta">Abrir catálogo →</span>
      </button>
      <button type="button" class="gcwo-landing-card" id="gcwoCardModelos" disabled title="Em breve — ainda não construído">
        <span class="gcwo-landing-card-icon rev">${ICON_DIAMOND}</span>
        <span class="gcwo-landing-card-title">Modelos de treino <span class="gcwo-landing-soon">Em breve</span></span>
        <span class="gcwo-landing-card-sub">Criar sessões e planos reutilizáveis para aplicar e adaptar rapidamente.</span>
      </button>
    </div>

    <section class="gcwo-landing-tablesec" id="gcwoLandingTableSec">
      <div class="gcwo-landing-tablehead">
        <h2 class="gcwo-section-title">Doentes ativos com exercício prescrito <span class="count" id="gcwoLandingCount"></span></h2>
      </div>
      <div class="gcwo-landing-toolbar">
        <div class="gc-search-bar">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5.5" stroke="#94a3b8" stroke-width="1.4"/><path d="M11 11l3 3" stroke="#94a3b8" stroke-width="1.4" stroke-linecap="round"/></svg>
          <input id="gcwoLandingSearch" type="search" class="gc-search-input" placeholder="Pesquisar doente…" autocomplete="off" spellcheck="false">
        </div>
        <div class="gcwo-landing-tabs" id="gcwoLandingTabs">
          <button type="button" class="on" data-tab="todos">Todos</button>
          <button type="button" data-tab="aterminar">A terminar</button>
          <button type="button" data-tab="feedback">Feedback novo</button>
        </div>
      </div>
      <div id="gcwoLandingTableHost"></div>
    </section>
  `;

  document.getElementById('gcwoCardPrescrever').addEventListener('click', () => renderStep1());
  document.getElementById('gcwoCardCatalogo').addEventListener('click', () => {
    initCatalogo({ onVoltar: () => { loadExercisesCatalog(); renderLanding(); } });
  });
  if (multiClinica) {
    const btn = document.getElementById('gcwoLandingClinicBtn');
    const menu = document.getElementById('gcwoLandingClinicMenu');
    btn.addEventListener('click', () => { menu.hidden = !menu.hidden; });
    menu.querySelectorAll('[data-cid]').forEach(item => {
      item.addEventListener('click', () => {
        _landing.clinicFilter = item.getAttribute('data-cid') || null;
        renderLanding();
      });
    });
    wireLandingDocClickOnce();
  }

  let searchTimer = null;
  document.getElementById('gcwoLandingSearch').addEventListener('input', (e) => {
    _landing.search = e.target.value;
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(renderLandingTableHost, 150);
  });

  document.getElementById('gcwoLandingTabs').querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      _landing.tab = btn.getAttribute('data-tab');
      document.getElementById('gcwoLandingTabs').querySelectorAll('button').forEach(b => b.classList.toggle('on', b === btn));
      renderLandingTableHost();
    });
  });

  loadLandingRows();
}

// Situação da linha — prioridade: feedback novo > a terminar/terminada > em curso
// (ponto 8 do briefing de 9 ago 2026). "Feedback novo" é uma aproximação: não existe
// ainda uma coluna "revisto pelo médico" em wo_prescriptions — usa-se um registo em
// wo_session_logs nos últimos 3 dias como sinal. Fica documentado para decidir depois
// se vale a pena a migração que acrescenta o campo real.
function situacaoLinha(row, now) {
  const TRES_DIAS_MS = 3 * 24 * 3600 * 1000;
  if (row.lastLogAt && (now - row.lastLogAt) < TRES_DIAS_MS) return { cls: 'feedback', label: 'Feedback novo' };
  if (row.expiresAt < now) return { cls: 'terminada', label: 'Terminada · por rever' };
  if (row.expiresAt - now < TRES_DIAS_MS) return { cls: 'aterminar', label: 'A terminar' };
  return { cls: 'curso', label: 'Em curso' };
}

function renderLandingTableHost() {
  const host = document.getElementById('gcwoLandingTableHost');
  const countEl = document.getElementById('gcwoLandingCount');
  if (!host || !_landing) return;

  if (_landing.loading) {
    host.innerHTML = `<div class="gcwo-muted" style="padding:14px 2px;">A carregar…</div>`;
    return;
  }
  if (_landing.error) {
    host.innerHTML = `<div class="gcwo-muted" style="padding:14px 2px;">${escHtml(_landing.error)}</div>`;
    return;
  }
  if (countEl) countEl.textContent = `${_landing.rows.length} doente${_landing.rows.length === 1 ? '' : 's'}`;

  const now = new Date();
  const termo = _landing.search.trim().toLowerCase();
  const linhas = _landing.rows
    .map(r => ({ ...r, situacao: situacaoLinha(r, now) }))
    .filter(r => !termo || (r.patient?.full_name || '').toLowerCase().includes(termo))
    .filter(r => {
      if (_landing.tab === 'aterminar') return r.situacao.cls === 'aterminar' || r.situacao.cls === 'terminada';
      if (_landing.tab === 'feedback') return r.situacao.cls === 'feedback';
      return true;
    });

  if (!linhas.length) {
    host.innerHTML = `<div class="gcwo-muted" style="padding:14px 2px;">Sem doentes para mostrar aqui.</div>`;
    return;
  }

  host.innerHTML = `
    <div class="gcwo-tablewrap">
      <table class="gcwo-readtable gcwo-landing-table">
        <thead><tr>
          <th>Doente</th><th>Clínica</th><th>Plano</th><th>Último treino</th><th>Situação</th>
        </tr></thead>
        <tbody>
          ${linhas.map(r => `
            <tr data-rid="${escAttr(r.id)}" class="gcwo-landing-row">
              <td><strong>${escHtml(r.patient?.full_name || '—')}</strong></td>
              <td class="muted">${escHtml(r.clinicName)}</td>
              <td class="muted">${escHtml(fmtIntervaloPlano(r.createdAt, r.expiresAt))}</td>
              <td class="muted">${escHtml(fmtRelativo(r.lastLogAt))}</td>
              <td><span class="gcwo-situacao-dot ${r.situacao.cls}"></span>${escHtml(r.situacao.label)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;

  host.querySelectorAll('[data-rid]').forEach(tr => {
    tr.addEventListener('click', () => {
      const row = _landing.rows.find(x => x.id === tr.getAttribute('data-rid'));
      if (!row || !row.patient) return;
      _state.clinicId = row.clinicId;
      _state.patient = row.patient;
      _panelDraft = null; _panelIsNovo = false; _pendingSlot = null; // doente novo — nunca herdar edição do doente anterior
      _loadingPlanoActivo = true;
      renderStep2();
      carregarPlanoActivoSeExistir().finally(() => {
        _loadingPlanoActivo = false;
        renderStep2Body();
      });
    });
  });
}

// Lê wo_prescriptions activas (filtradas por clínica visível ou escolhida) + o último
// registo de wo_session_logs por prescrição, para a tabela do ecrã inicial.
async function loadLandingRows() {
  const clinicas = G.clinics || [];
  const clinicIds = _landing.clinicFilter ? [_landing.clinicFilter] : clinicas.map(c => c.id);

  if (!clinicIds.length) {
    _landing.rows = [];
    _landing.loading = false;
    renderLandingTableHost();
    return;
  }

  const { data, error } = await window.sb
    .from('wo_prescriptions')
    .select('id,patient_id,clinic_id,created_at,expires_at,status,patients(id,full_name,dob,hr_zone_formula,hr_zones_bpm),clinics(name)')
    .eq('status', 'active')
    .in('clinic_id', clinicIds)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error('[prescricao] falha a carregar prescrições activas:', error);
    _landing.error = 'Erro ao carregar a lista de doentes.';
    _landing.loading = false;
    renderLandingTableHost();
    return;
  }

  const rows = data || [];
  const ids = rows.map(r => r.id);
  const logsByRx = new Map();
  if (ids.length) {
    const { data: logs, error: logsErr } = await window.sb
      .from('wo_session_logs')
      .select('prescription_id, logged_at')
      .in('prescription_id', ids)
      .order('logged_at', { ascending: false });
    if (logsErr) {
      console.error('[prescricao] falha a carregar wo_session_logs:', logsErr);
    } else {
      (logs || []).forEach(l => {
        if (!logsByRx.has(l.prescription_id)) logsByRx.set(l.prescription_id, new Date(l.logged_at));
      });
    }
  }

  _landing.rows = rows
    .filter(r => r.patients) // doente inativo/apagado — não mostra linha órfã
    .map(r => ({
      id: r.id,
      patient: r.patients,
      clinicName: r.clinics?.name || '',
      clinicId: r.clinic_id,
      createdAt: new Date(r.created_at),
      expiresAt: new Date(r.expires_at),
      lastLogAt: logsByRx.get(r.id) || null,
    }));
  _landing.loading = false;
  renderLandingTableHost();
}

/* ================================================================
   PASSO 1 — clínica (cartões) + pesquisa/seleção de doente
   ================================================================ */
// A pesquisa já não pede a clínica primeiro (decisão de 9 ago 2026): a RPC
// search_patients_v2 nunca filtrou por p_clinic_id — só o usava para ordenar
// (in_target_clinic). Já procura em todas as clínicas do utilizador (a RLS de
// `patients`/`patient_clinic` é que continua a limitar quem aparece). Por isso a
// clínica de cada doente sai da própria pesquisa (active_clinic_id) e fica escrita
// ao lado do nome — só se define _state.clinicId quando se escolhe o doente.
function renderStep1() {
  const root = document.getElementById('gcwoPrescricaoRoot');
  if (!root) return;

  root.innerHTML = `
    <div class="gc-page-header">
      <div>
        <button type="button" class="gcwo-backlink" id="gcwoBackToLanding">← Exercício</button>
        <div class="gc-page-title">Prescrição de exercício</div><div class="gc-page-sub">Nova prescrição</div>
      </div>
      ${topActionsHtml()}
    </div>
    <div class="gcwo-step1-wrap">
      <div class="gcwo-step1-card">
        <p class="gcwo-step1-intro">Cria uma prescrição de exercício para um doente — sessões de ginásio ou de modalidade, com tarefas e séries — e gera um link de acesso sem login para ele seguir o plano.</p>

        <span class="gcwo-field-label">Procura o doente</span>
        <div class="gc-search-bar">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5.5" stroke="#94a3b8" stroke-width="1.4"/><path d="M11 11l3 3" stroke="#94a3b8" stroke-width="1.4" stroke-linecap="round"/></svg>
          <input id="gcwoPatientQuery" type="search" class="gc-search-input" placeholder="Nome, SNS, NIF, Telefone…" autocomplete="off" spellcheck="false">
        </div>
        <div id="gcwoPatientResults" class="gcwo-results" style="display:none;"></div>
      </div>
    </div>
  `;
  wireTopActions();
  document.getElementById('gcwoBackToLanding').addEventListener('click', () => renderLanding());

  const input = document.getElementById('gcwoPatientQuery');
  const resHost = document.getElementById('gcwoPatientResults');
  input.focus();

  let timer = null;
  input.addEventListener('input', () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => runPatientSearch(input.value), 250);
  });

  async function runPatientSearch(term) {
    term = (term || '').trim();
    if (term.length < 2) {
      resHost.style.display = 'none';
      resHost.innerHTML = '';
      return;
    }
    resHost.style.display = 'block';
    resHost.innerHTML = `<div class="gcwo-muted">A pesquisar…</div>`;

    const { data, error } = await window.sb.rpc('search_patients_v2', {
      p_clinic_id: _state.clinicId || null,
      p_term: term,
      p_limit: 15,
    });

    if (error) {
      console.error('[prescricao] search_patients_v2 falhou:', error);
      resHost.innerHTML = `<div class="gcwo-muted">Erro na pesquisa.</div>`;
      return;
    }

    const results = Array.isArray(data) ? data : [];
    if (!results.length) {
      resHost.innerHTML = `<div class="gcwo-muted">Sem resultados.</div>`;
      return;
    }

    const clinicas = G.clinics || [];
    resHost.innerHTML = results.map(p => {
      const clinicaNome = clinicas.find(c => c.id === p.active_clinic_id)?.name || '';
      return `
      <button type="button" class="gcwo-result-item" data-pid="${escAttr(p.id)}">
        <span class="gcwo-result-name">${escHtml(p.full_name)}</span>
        <span class="gcwo-result-meta">
          ${p.dob ? new Date(p.dob).toLocaleDateString('pt-PT') : '—'}${p.phone ? ' · ' + escHtml(p.phone) : ''}
          ${clinicaNome ? ` · <span class="gcwo-result-clinic">${escHtml(clinicaNome)}</span>` : ''}
        </span>
      </button>`;
    }).join('');

    resHost.querySelectorAll('[data-pid]').forEach(btn => {
      btn.addEventListener('click', () => {
        const pid = btn.getAttribute('data-pid');
        const p = results.find(r => r.id === pid);
        if (!p) return;
        _state.patient = p;
        _state.clinicId = p.active_clinic_id || _state.clinicId;
        _panelDraft = null; _panelIsNovo = false; _pendingSlot = null; // doente novo — nunca herdar edição do doente anterior
        _loadingPlanoActivo = true;
        renderStep2();
        carregarPlanoActivoSeExistir().finally(() => {
          _loadingPlanoActivo = false;
          renderStep2Body();
        });
      });
    });
  }
}

/* ── Cabeçalho do doente — idade + restrições em chips numa linha ── */
function renderPatientBanner() {
  const p = _state.patient;
  const idade = calcIdade(p.dob);
  return `
    <div class="gcwo-patient-banner">
      ${idade != null ? `<span class="gcwo-patient-age">${idade} anos</span>` : ''}
      <div class="gcwo-restricoes-line" id="gcwoRestricoesLine">${restricoesLineHtml()}</div>
      <button type="button" class="gcwo-restricoes-editbtn" id="gcwoRestricoesEditBtn" title="Editar restrições">${ICON_PENCIL}</button>
    </div>
    <div class="gcwo-restricoes-editor" id="gcwoRestricoesEditor" ${_state.restricoesEditing ? '' : 'hidden'}>
      <div class="gcwo-chips" id="gcwoRestricoesChips">
        ${RESTRICOES_PREDEFINIDAS.map(r => `
          <button type="button" class="gcwo-chip${_state.restricoesPredefinidas.includes(r) ? ' on' : ''}" data-restr="${escAttr(r)}">${escHtml(r)}</button>
        `).join('')}
      </div>
      <textarea id="gcwoRestricoesTexto" rows="2" placeholder="Outras restrições, em texto livre…">${escHtml(_state.restricoesTexto)}</textarea>
      <div class="gcwo-restricoes-editor-actions">
        <button type="button" class="gcBtnGhost gcBtnSm" id="gcwoRestricoesFechar">Concluído</button>
      </div>
    </div>`;
}
function restricoesLineHtml() {
  const restr = restricoesAtuais();
  return restr.length
    ? restr.map(r => `<span class="gcwo-restr-chip">${escHtml(r)}</span>`).join('')
    : `<span class="gcwo-muted">Sem restrições registadas.</span>`;
}
function refreshRestricoesLine() {
  const el = document.getElementById('gcwoRestricoesLine');
  if (el) el.innerHTML = restricoesLineHtml();
}
function wirePatientBanner() {
  document.getElementById('gcwoRestricoesEditBtn').addEventListener('click', () => {
    _state.restricoesEditing = !_state.restricoesEditing;
    document.getElementById('gcwoRestricoesEditor').hidden = !_state.restricoesEditing;
  });
  document.getElementById('gcwoRestricoesFechar').addEventListener('click', () => {
    _state.restricoesEditing = false;
    document.getElementById('gcwoRestricoesEditor').hidden = true;
  });
  document.getElementById('gcwoRestricoesTexto').addEventListener('input', (e) => {
    _state.restricoesTexto = e.target.value;
    refreshRestricoesLine();
  });
  document.getElementById('gcwoRestricoesChips').querySelectorAll('[data-restr]').forEach(chip => {
    chip.addEventListener('click', () => {
      const r = chip.getAttribute('data-restr');
      const idx = _state.restricoesPredefinidas.indexOf(r);
      if (idx >= 0) _state.restricoesPredefinidas.splice(idx, 1);
      else _state.restricoesPredefinidas.push(r);
      chip.classList.toggle('on');
      refreshRestricoesLine();
    });
  });
}

/* ── Datas do plano — início/fim/revisão reais (Fase A, 9 ago 2026) ──────
   Substitui as chips "2/3/4 semanas": já não há uma duração fixa, há datas reais.
   O calendário passa a mostrar-se sempre (ver renderCalendarMode) — escolher datas
   aqui só ajusta a janela, nunca é uma condição para o calendário aparecer. */
function renderDatasPlanoSection() {
  return `
    <section class="gcwo-duracao-section">
      <h2 class="gcwo-section-title">Datas do plano</h2>
      <div class="gcwo-datasplano-row">
        <label class="gcwo-field"><span>Início</span><input type="date" id="gcwoDataInicio" value="${_state.startDate}"></label>
        <label class="gcwo-field"><span>Fim</span><input type="date" id="gcwoDataFim" value="${_state.endDate}" min="${_state.startDate}"></label>
        <label class="gcwo-field"><span>Revisão (opcional)</span><input type="date" id="gcwoDataRevisao" value="${_state.dataRevisao || ''}"></label>
      </div>
      <div class="gcwo-duracao-info" id="gcwoDuracaoInfo">${escHtml(fmtJanelaPlanoIso(_state.startDate, _state.endDate))}</div>
    </section>`;
}
function wireDatasPlanoSection() {
  document.getElementById('gcwoDataInicio').addEventListener('change', (e) => {
    if (!e.target.value) return;
    _state.startDate = e.target.value;
    // Fim nunca fica antes do início — se o médico recuar o início para lá do fim
    // actual, o fim reajusta-se para 4 semanas a partir do novo início.
    if (_state.endDate < _state.startDate) _state.endDate = addDiasIso(_state.startDate, 27);
    renderStep2Body();
  });
  document.getElementById('gcwoDataFim').addEventListener('change', (e) => {
    if (!e.target.value || e.target.value < _state.startDate) { renderStep2Body(); return; }
    _state.endDate = e.target.value;
    renderStep2Body();
  });
  document.getElementById('gcwoDataRevisao').addEventListener('change', (e) => {
    _state.dataRevisao = e.target.value || null;
  });
}

/* ================================================================
   PASSO 2 — plano semanal
   ================================================================ */
function renderStep2() {
  const root = document.getElementById('gcwoPrescricaoRoot');
  if (!root) return;

  const p = _state.patient;
  // _panelDraft/_pendingSlot NÃO se reiniciam aqui — renderStep2() é chamado outra vez
  // ao voltar do Catálogo (topActionsHtml) a meio de uma edição, e essa edição tem de
  // sobreviver à viagem (o comportamento de sempre, antes dos 2 modos).

  root.innerHTML = `
    <div class="gc-page-header">
      <div><div class="gc-page-title">Prescrição de exercício</div><div class="gc-page-sub">${escHtml(p.full_name)} <button type="button" class="gcwo-linkbtn" id="gcwoVerHistorico">Ver planos anteriores</button></div></div>
      ${topActionsHtml('<button type="button" class="gcBtnGhost" id="gcwoTrocarDoente">Trocar doente</button>')}
    </div>

    ${renderPatientBanner()}

    <div id="gcwoStep2Body"></div>
  `;

  wireTopActions();
  wirePatientBanner();
  document.getElementById('gcwoVerHistorico').addEventListener('click', () => openHistoryModal());
  document.getElementById('gcwoTrocarDoente').addEventListener('click', () => {
    closeHistoryModal();
    _state.patient = null;
    _state.restricoesPredefinidas = [];
    _state.restricoesTexto = '';
    _state.restricoesEditing = false;
    _state.startDate = isoAmanha();
    _state.endDate = addDiasIso(_state.startDate, 27);
    _state.dataRevisao = null;
    _state.sessions = [];
    _state.activePrescriptionId = null;
    renderStep1();
  });

  renderStep2Body();
}

// Só isto troca entre "calendário" (modo 1) e "edição em ecrã inteiro" (modo 2) —
// cabeçalho e ficha do doente ficam sempre visíveis, por cima (decisão de 9 ago 2026).
// A condição de qual modo mostrar é _panelDraft/_pendingSlot — não há uma 3ª variável
// de "modo actual" para manter sincronizada à parte.
function step2EmEdicao() {
  return !!(_panelDraft || _pendingSlot);
}
function renderStep2Body() {
  const host = document.getElementById('gcwoStep2Body');
  if (!host) return;
  if (step2EmEdicao()) renderEditMode(host);
  else renderCalendarMode(host);
}

/* ================================================================
   MODO 1 — calendário (datas reais, todas as semanas visíveis)
   ================================================================ */
function renderCalendarMode(host) {
  if (_loadingPlanoActivo) {
    host.innerHTML = `<section class="gcwo-card"><span class="gcwo-muted">A verificar se este doente já tem um plano activo…</span></section>`;
    return;
  }

  // O calendário já não fica condicionado a "escolher a duração" — startDate/endDate
  // vêm sempre com um valor (novo plano ou carregado), por isso aparece sempre (9 ago
  // 2026). "Copiar uma semana para as outras" saiu: sem semanas numeradas fixas, deixou
  // de fazer sentido — "Duplicar para…" no menu ⋮ de cada sessão cobre o mesmo caso e
  // mais (pode duplicar para dias de semanas diferentes de uma vez).
  host.innerHTML = `
    ${renderDatasPlanoSection()}
    <section>
      <div class="gcwo-cal-head">
        <h2 class="gcwo-section-title">Calendário do plano</h2>
      </div>
      <div id="gcwoCalGrid"></div>
    </section>

    <div class="gcwo-generate">
      <button type="button" id="gcwoGerar" class="gcBtnSuccess gcBtnLg" ${hasSessionComExercicios() ? '' : 'disabled'} title="${hasSessionComExercicios() ? '' : 'Adiciona pelo menos uma sessão com conteúdo para gerar o link.'}">Gerar prescrição e link</button>
      <span id="gcwoGerarErro" class="gcwo-erro"></span>
      <span id="gcwoPorGravarAviso" class="gcwo-porgravar-aviso" style="display:${haSessoesPorGravar() ? '' : 'none'}">⚠ As sessões do calendário só ficam realmente gravadas depois de clicares aqui.</span>
    </div>
  `;

  wireDatasPlanoSection();
  renderCalGrid();
  document.getElementById('gcwoGerar').addEventListener('click', handleGerar);
}

// Segundas-feiras (ISO) das semanas a desenhar: sempre pelo menos 4, e nunca menos do
// que as necessárias para o calendário chegar a endDate — se o plano for mais comprido
// do que 4 semanas, o calendário estica para mostrar tudo (9 ago 2026). Substitui o
// antigo "N semanas fixas escolhidas no topo"; usado também pelo day-picker (mover/
// duplicar), para oferecer sempre exactamente os mesmos dias que estão à vista.
function semanasParaMostrar() {
  const segInicio = segundaFeiraDeIso(_state.startDate);
  const segFim = segundaFeiraDeIso(_state.endDate);
  const diffSemanas = Math.round((dataDeIso(segFim) - dataDeIso(segInicio)) / (7 * 86400000)) + 1;
  const n = Math.max(4, diffSemanas);
  return Array.from({ length: n }, (_, i) => addDiasIso(segInicio, i * 7));
}

// Posiciona o menu ⋮ como position:fixed calculado a partir do botão que o abriu.
// Bug reportado 9 ago 2026: o menu "ia para baixo" e ficava cortado — a causa era
// o overflow-x:auto de .gcwo-calrow, que em CSS também recorta a vertical. Fixed
// escapa a esse corte (não depende do overflow de nenhum antepassado) e, se não
// houver espaço por baixo do botão, abre para cima em vez de ficar escondido.
function posicionarMenuFlutuante(btn, menu) {
  const r = btn.getBoundingClientRect();
  const menuW = 172;
  const menuHEstimado = 200;
  let left = r.right - menuW;
  if (left < 8) left = 8;
  if (left + menuW > window.innerWidth - 8) left = window.innerWidth - menuW - 8;
  let top = r.bottom + 4;
  if (top + menuHEstimado > window.innerHeight - 8) top = Math.max(8, r.top - menuHEstimado - 4);
  menu.style.position = 'fixed';
  menu.style.left = left + 'px';
  menu.style.top = top + 'px';
}

function renderCalGrid() {
  const host = document.getElementById('gcwoCalGrid');
  if (!host) return;
  const semanas = semanasParaMostrar();

  // Cabeçalho dos dias da semana (SEG..DOM) uma única vez no topo — antes cada
  // linha de semana repetia isto por baixo do intervalo de datas, o que o Morais
  // achou poluído. Agora é só isto, sem nenhuma etiqueta de semana a separar as linhas.
  const cabecalho = `
    <div class="gcwo-calweekday-header">
      ${DIAS_SEMANA.map(d => `<span>${d.label}</span>`).join('')}
    </div>`;

  host.innerHTML = cabecalho + semanas.map((segIso, wi) => `
    <div class="gcwo-calweek">
      <div class="gcwo-calrow">
        ${DIAS_SEMANA.map((d, di) => {
          const iso = addDiasIso(segIso, di);
          // "before-start" cobre agora os dois lados fora do plano — antes de startDate
          // ou depois de endDate — reaproveitando o mesmo estilo esbatido dos dois casos.
          const fora = iso < _state.startDate || iso > _state.endDate;
          const sessions = _state.sessions.filter(s => s.date === iso).sort((a, b) => a.order - b.order);
          return `
          <div class="gcwo-calday${fora ? ' before-start' : ''}"${fora ? '' : ` data-day="${iso}"`}>
            <div class="gcwo-calday-top">
              <span class="num">${escHtml(fmtDiaMesCurtoIso(iso))}</span>
              ${!fora ? `<button type="button" class="gcwo-calday-add" data-add-date="${iso}" title="Adicionar sessão">${ICON_MAIS}</button>` : ''}
            </div>
            <div class="gcwo-calsessions">
              ${sessions.map(s => {
                const meta = TIPO_META[tipoKey(s)];
                const momentoLabel = MOMENTOS_SESSAO.find(m => m.value === s.momento)?.label;
                return `
                <div class="gcwo-calsession-row" data-sid="${s.session_id}">
                  <span class="gcwo-calsession-handle" data-drag-sid="${s.session_id}" title="Arrastar para mover">${ICON_GRIP}</span>
                  <button type="button" class="gcwo-calsession-body" data-edit-session="${s.session_id}">
                    <span class="gcwo-calsession-icon" style="background:${meta.bg};color:${meta.fg}">${meta.icon}</span>
                    <span class="gcwo-calsession-name">${escHtml(meta.label)}${momentoLabel ? ' · ' + escHtml(momentoLabel) : ''}</span>
                  </button>
                  <button type="button" class="gcwo-calsession-menubtn" data-menu-session="${s.session_id}" title="Mais ações">${ICON_DOTS}</button>
                  <div class="gcwo-calsession-menu" id="gcwoCalMenu-${s.session_id}" hidden>
                    <button type="button" data-menu-action="editar" data-sid="${s.session_id}">${ICON_PENCIL}<span>Editar</span></button>
                    <button type="button" data-menu-action="mover" data-sid="${s.session_id}">${ICON_MOVE}<span>Mover para…</span></button>
                    <button type="button" data-menu-action="duplicar" data-sid="${s.session_id}">${ICON_COPY}<span>Duplicar para…</span></button>
                    <button type="button" class="danger" data-menu-action="apagar" data-sid="${s.session_id}">${ICON_TRASH}<span>Apagar</span></button>
                  </div>
                </div>`;
              }).join('')}
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>
  `).join('');

  host.querySelectorAll('[data-add-date]').forEach(btn => {
    btn.addEventListener('click', () => {
      _pendingSlot = { date: btn.getAttribute('data-add-date') };
      renderStep2Body();
    });
  });
  host.querySelectorAll('[data-edit-session]').forEach(btn => {
    btn.addEventListener('click', () => openPanelEditar(btn.getAttribute('data-edit-session')));
  });

  // ⋮ por sessão — só um menu aberto de cada vez; fecha os outros antes de abrir o clicado.
  host.querySelectorAll('[data-menu-session]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const sid = btn.getAttribute('data-menu-session');
      const menu = document.getElementById('gcwoCalMenu-' + sid);
      const abrir = menu.hidden;
      host.querySelectorAll('.gcwo-calsession-menu').forEach(m => { m.hidden = true; });
      if (abrir) posicionarMenuFlutuante(btn, menu);
      menu.hidden = !abrir;
    });
  });
  host.querySelectorAll('[data-menu-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (btn.disabled) return;
      const sid = btn.getAttribute('data-sid');
      const action = btn.getAttribute('data-menu-action');
      document.getElementById('gcwoCalMenu-' + sid).hidden = true;
      if (action === 'editar') openPanelEditar(sid);
      else if (action === 'apagar') apagarSessaoNoCalendario(sid);
      else if (action === 'mover') abrirDayPicker(sid, 'mover');
      else if (action === 'duplicar') abrirDayPicker(sid, 'duplicar');
    });
  });
  wireCalMenuDocClickOnce();
  wireCalDragAndDrop(host);
}

// Arrastar pela pega de 6 pontos (⠿) — elemento à parte do corpo da sessão e do menu ⋮
// (redesenho do calendário, 9 ago 2026). Só a pega é `draggable`, por isso arrastar só
// começa a partir dela; o resto da sessão continua a abrir a edição normalmente. Larga
// sobre um dia e reaproveita moverSessaoParaDia() tal e qual — mesma função do menu
// "Mover para…", mantém sempre o session_id.
function wireCalDragAndDrop(host) {
  host.querySelectorAll('.gcwo-calsession-handle').forEach(handle => {
    handle.setAttribute('draggable', 'true');
    handle.addEventListener('dragstart', (e) => {
      const sid = handle.getAttribute('data-drag-sid');
      e.dataTransfer.setData('text/plain', sid);
      e.dataTransfer.effectAllowed = 'move';
      handle.closest('.gcwo-calsession-row')?.classList.add('dragging');
    });
    handle.addEventListener('dragend', () => {
      handle.closest('.gcwo-calsession-row')?.classList.remove('dragging');
      host.querySelectorAll('.gcwo-calday.drop-target').forEach(d => d.classList.remove('drop-target'));
    });
  });

  host.querySelectorAll('.gcwo-calday[data-day]').forEach(day => {
    day.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      day.classList.add('drop-target');
    });
    day.addEventListener('dragleave', () => day.classList.remove('drop-target'));
    day.addEventListener('drop', (e) => {
      e.preventDefault();
      day.classList.remove('drop-target');
      const sid = e.dataTransfer.getData('text/plain');
      const destino = day.getAttribute('data-day');
      if (sid && destino) moverSessaoParaDia(sid, destino);
    });
  });
}

// Apagar directamente do chip do calendário, sem passar pelo painel — acção mais rápida
// do que abrir para editar só para apagar. Pede confirmação por ser irreversível a partir
// daqui (o painel de edição não pede porque lá já é um passo deliberado a mais).
function apagarSessaoNoCalendario(sessionId) {
  const s = _state.sessions.find(x => x.session_id === sessionId);
  if (!s) return;
  const meta = TIPO_META[tipoKey(s)];
  if (!window.confirm(`Apagar a sessão "${meta.label}"? Não é possível desfazer.`)) return;
  _state.sessions = _state.sessions.filter(x => x.session_id !== sessionId);
  if (_panelDraft && _panelDraft.session_id === sessionId) fecharPanel();
  else renderCalGrid();
  updateGerarButtonState();
}

// Fecha qualquer menu ⋮ aberto ao clicar fora dele — mesmo padrão do popover de
// clínicas do ecrã inicial (wireLandingDocClickOnce), ligado uma única vez ao document.
function wireCalMenuDocClickOnce() {
  if (_calMenuDocClickWired) return;
  _calMenuDocClickWired = true;
  document.addEventListener('click', (e) => {
    document.querySelectorAll('.gcwo-calsession-menu').forEach(menu => {
      if (menu.hidden) return;
      if (menu.contains(e.target)) return;
      const wrap = menu.closest('.gcwo-calsession-row');
      if (wrap && wrap.contains(e.target)) return;
      menu.hidden = true;
    });
  });
}

/* ================================================================
   "Mover para…" / "Duplicar para…" — modal de escolha de dia(s)
   Mover: 1 clique num dia executa logo (muda `date`, mantém session_id).
   Duplicar: escolhe vários dias (podem ser de semanas diferentes) e
   confirma — cada cópia recebe um session_id novo. Em ambos: se o dia
   de destino já tiver outras sessões, a sessão junta-se-lhes — nunca
   substitui (decisão de 9 ago 2026). Oferece sempre os mesmos dias que
   estão visíveis no calendário (semanasParaMostrar()).
   ================================================================ */
function abrirDayPicker(sessionId, mode) {
  _dayPicker = { sessionId, mode, selecionados: new Set() };
  renderDayPicker();
}
function fecharDayPicker() {
  _dayPicker = null;
  document.getElementById('gcwoDayPickerOverlay')?.remove();
}

function renderDayPicker() {
  let overlay = document.getElementById('gcwoDayPickerOverlay');
  if (!_dayPicker) { overlay?.remove(); return; }

  const s = _state.sessions.find(x => x.session_id === _dayPicker.sessionId);
  if (!s) { fecharDayPicker(); return; }

  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'gcwoDayPickerOverlay';
    overlay.className = 'gcwo-modal-overlay';
    overlay.addEventListener('click', (e) => { if (e.target === overlay) fecharDayPicker(); });
    document.body.appendChild(overlay);
  }

  const meta = TIPO_META[tipoKey(s)];
  const semanas = semanasParaMostrar();
  const mover = _dayPicker.mode === 'mover';
  const nSel = _dayPicker.selecionados.size;

  overlay.innerHTML = `
    <div class="gcwo-modal gcwo-daypicker-modal">
      <div class="gcwo-modal-head">
        <span class="gcwo-panel-icon" style="background:${meta.bg};color:${meta.fg}">${meta.icon}</span>
        <h3>${mover ? 'Mover sessão para…' : 'Duplicar sessão para…'}</h3>
        <button type="button" id="gcwoDayPickerClose" title="Fechar">${ICON_CLOSE}</button>
      </div>
      <div class="gcwo-modal-body">
        <p class="gcwo-daypicker-hint">${mover ? 'Clica no dia de destino.' : 'Escolhe um ou vários dias e confirma. Cada dia recebe uma cópia independente.'}</p>
        ${semanas.map((segIso, wi) => `
          <div class="gcwo-daypicker-week">
            <div class="gcwo-calweek-label">${escHtml(fmtIntervaloIso(segIso, addDiasIso(segIso, 6)))}</div>
            <div class="gcwo-daypicker-row">
              ${DIAS_SEMANA.map((d, di) => {
                const iso = addDiasIso(segIso, di);
                const isSource = s.date === iso;
                const temSessoes = _state.sessions.some(x => x.date === iso && x.session_id !== s.session_id);
                const selecionado = _dayPicker.selecionados.has(iso);
                return `
                <button type="button" class="gcwo-daypicker-cell${isSource ? ' source' : ''}${selecionado ? ' on' : ''}" data-date="${iso}" ${isSource ? 'disabled' : ''}>
                  <span class="dname">${d.label}</span>
                  <span class="num">${escHtml(fmtDiaMesCurtoIso(iso))}</span>
                  ${isSource ? '<span class="tag">actual</span>' : (temSessoes ? '<span class="dot" title="Já tem sessões — esta junta-se"></span>' : '')}
                </button>`;
              }).join('')}
            </div>
          </div>`).join('')}
      </div>
      ${mover ? '' : `
      <div class="gcwo-panel-footer">
        <button type="button" class="gcBtnGhost" id="gcwoDayPickerCancelar">Cancelar</button>
        <button type="button" class="gcBtnSuccess" id="gcwoDayPickerConfirmar" ${nSel ? '' : 'disabled'}>Duplicar para ${nSel} dia${nSel === 1 ? '' : 's'}</button>
      </div>`}
    </div>
  `;
  wireDayPicker();
}

function wireDayPicker() {
  document.getElementById('gcwoDayPickerClose').addEventListener('click', fecharDayPicker);
  document.getElementById('gcwoDayPickerCancelar')?.addEventListener('click', fecharDayPicker);

  document.querySelectorAll('#gcwoDayPickerOverlay [data-date]').forEach(cell => {
    cell.addEventListener('click', () => {
      const iso = cell.getAttribute('data-date');
      if (_dayPicker.mode === 'mover') {
        moverSessaoParaDia(_dayPicker.sessionId, iso);
        return;
      }
      if (_dayPicker.selecionados.has(iso)) _dayPicker.selecionados.delete(iso);
      else _dayPicker.selecionados.add(iso);
      renderDayPicker();
    });
  });

  document.getElementById('gcwoDayPickerConfirmar')?.addEventListener('click', () => {
    duplicarSessaoParaDias(_dayPicker.sessionId, [..._dayPicker.selecionados]);
  });
}

// Muda a data da própria sessão — mantém session_id (é a mesma sessão, só de dia
// diferente). Se o destino já tiver sessões, a movida entra a seguir às existentes.
function moverSessaoParaDia(sessionId, date) {
  const s = _state.sessions.find(x => x.session_id === sessionId);
  if (!s) return;
  if (s.date === date) { fecharDayPicker(); return; }
  s.date = date;
  s.order = _state.sessions.filter(x => x.date === date && x.session_id !== sessionId).length;
  fecharDayPicker();
  renderCalGrid();
  updateGerarButtonState();
}

// Cria uma cópia com session_id novo por cada dia escolhido — nunca reaproveita o
// session_id de origem, para não misturar registos que o doente já tenha feito numa
// sessão com os de outra.
function duplicarSessaoParaDias(sessionId, datas) {
  const s = _state.sessions.find(x => x.session_id === sessionId);
  if (!s || !datas.length) return;
  datas.forEach(date => {
    const copy = structuredClone(s);
    copy.session_id = uuid();
    copy.date = date;
    copy.order = _state.sessions.filter(x => x.date === date).length;
    _state.sessions.push(copy);
  });
  fecharDayPicker();
  renderCalGrid();
  updateGerarButtonState();
}

// "Copiar semana N para as outras" foi removido nesta fase (9 ago 2026): sem semanas
// numeradas fixas, "semana" deixou de ser uma unidade estável para copiar. "Duplicar
// para…" no menu ⋮ de cada sessão cobre o mesmo caso (e mais — dias de semanas
// diferentes numa só acção).

/* ================================================================
   Histórico do doente — "Ver planos anteriores"
   Lê wo_prescriptions filtrado por patient_id (activas, expiradas
   ou revogadas — nunca só "active"). O filtro tem de ir no pedido
   ao servidor (.eq no query builder → WHERE no PostgREST), nunca
   "buscar tudo e filtrar no browser".
   ================================================================ */
function prescricaoStatusInfo(p) {
  if (p.status !== 'active') return { label: 'Revogado', cls: 'revoked' };
  if (p.expires_at && new Date(p.expires_at) <= new Date()) return { label: 'Expirado', cls: 'expired' };
  return { label: 'Activo', cls: 'active' };
}

async function openHistoryModal() {
  _historyOpen = true;
  _historyLoading = true;
  _historyError = '';
  _historyList = [];
  _historyDetail = null;
  renderHistoryModal();

  const { data, error } = await window.sb
    .from('wo_prescriptions')
    .select('id,token,status,expires_at,created_at,data')
    .eq('patient_id', _state.patient.id)
    .order('created_at', { ascending: false });

  _historyLoading = false;
  if (error) {
    console.error('[prescricao] falha a carregar histórico do doente:', error);
    _historyError = 'Erro ao carregar planos anteriores.';
  } else {
    _historyList = data || [];
  }
  renderHistoryModal();
}

function closeHistoryModal() {
  _historyOpen = false;
  _historyDetail = null;
  document.getElementById('gcwoHistoryOverlay')?.remove();
}

function renderHistoryModal() {
  let overlay = document.getElementById('gcwoHistoryOverlay');
  if (!_historyOpen) {
    overlay?.remove();
    return;
  }
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'gcwoHistoryOverlay';
    overlay.className = 'gcwo-modal-overlay';
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeHistoryModal(); });
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = _historyDetail
    ? `
      <div class="gcwo-modal">
        <div class="gcwo-modal-head">
          <button type="button" class="gcwo-linkbtn" id="gcwoHistBack">‹ Planos anteriores</button>
          <button type="button" id="gcwoHistClose" title="Fechar">${ICON_CLOSE}</button>
        </div>
        <div class="gcwo-modal-body">
          <div style="margin-bottom:12px;">
            <button type="button" class="gcBtnGhost gcBtnSm" id="gcwoHistAplicar" ${(_historyDetail.data?.sessions || []).length && _historyDetail.data?.startDate ? '' : 'disabled'}>Aplicar este plano ao actual, a partir de ${escHtml(fmtDataPtIso(_state.startDate))}</button>
          </div>
          ${renderHistoryDetailHtml(_historyDetail)}
        </div>
      </div>`
    : `
      <div class="gcwo-modal">
        <div class="gcwo-modal-head">
          <h3>Planos anteriores</h3>
          <button type="button" id="gcwoHistClose" title="Fechar">${ICON_CLOSE}</button>
        </div>
        <div class="gcwo-modal-body">${renderHistoryListHtml()}</div>
      </div>`;

  wireHistoryModal();
}

function renderHistoryListHtml() {
  if (_historyLoading) return `<div class="gcwo-muted">A carregar…</div>`;
  if (_historyError) return `<div class="gcwo-erro">${escHtml(_historyError)}</div>`;
  if (!_historyList.length) return `<div class="gcwo-muted">Sem planos anteriores para este doente.</div>`;

  return _historyList.map(p => {
    const info = prescricaoStatusInfo(p);
    const nSessoes = (p.data?.sessions || []).length;
    const periodo = (p.data?.startDate && p.data?.endDate)
      ? fmtIntervaloIso(p.data.startDate, p.data.endDate)
      : new Date(p.created_at).toLocaleDateString('pt-PT');
    return `
      <button type="button" class="gcwo-history-item" data-id="${escAttr(p.id)}">
        <span class="gcwo-history-date">${escHtml(periodo)}</span>
        <span class="gcwo-history-meta">${nSessoes} sessõ${nSessoes === 1 ? 'ão' : 'es'}</span>
        <span class="gcwo-history-status ${info.cls}">${info.label}</span>
      </button>`;
  }).join('');
}

// Lista simples ordenada por data real — já não há "semanas" para agrupar (Fase A, 9 ago 2026).
function renderHistoryDetailHtml(p) {
  const sessions = [...(p.data?.sessions || [])].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  if (!sessions.length) return `<div class="gcwo-muted">Este plano não tem sessões.</div>`;
  return `<ul class="gcwo-plano-itemlist">${sessions.map(s => {
    const cont = sessaoContagem(s);
    const dataTxt = s.date ? `${diaSemanaDeIso(s.date).full}, ${fmtDiaMesCurtoIso(s.date)}` : '(sem data)';
    return `<li>${escHtml(dataTxt)} — ${escHtml(s.modality)}${s.local ? ' · ' + escHtml(s.local) : ''} · ${cont.n} ${cont.label}</li>`;
  }).join('')}</ul>`;
}

function wireHistoryModal() {
  document.getElementById('gcwoHistClose').addEventListener('click', closeHistoryModal);
  document.getElementById('gcwoHistBack')?.addEventListener('click', () => {
    _historyDetail = null;
    renderHistoryModal();
  });
  document.querySelectorAll('#gcwoHistoryOverlay [data-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = _historyList.find(x => x.id === btn.getAttribute('data-id'));
      if (!p) return;
      _historyDetail = p;
      renderHistoryModal();
    });
  });
  document.getElementById('gcwoHistAplicar')?.addEventListener('click', () => aplicarPrescricaoDoHistorico(_historyDetail));
}

// Aplica um plano antigo ao plano actual, deslocando as datas pela diferença entre o
// início do plano antigo e o início do plano actual — sempre com session_id novos,
// nunca reaproveitados do plano de origem (mesmo que já expirado). Acrescenta, nunca
// substitui (mesma regra do mover/duplicar de 9 ago 2026) — se um dia de destino já
// tiver sessões, a sessão aplicada junta-se-lhes.
function aplicarPrescricaoDoHistorico(prescricao) {
  const origem = prescricao?.data?.sessions || [];
  const inicioAntigo = prescricao?.data?.startDate;
  if (!origem.length || !inicioAntigo) return;

  const deslocamentoDias = Math.round((dataDeIso(_state.startDate) - dataDeIso(inicioAntigo)) / 86400000);
  const datasDestino = origem.map(s => addDiasIso(s.date, deslocamentoDias));
  const diasComConflito = [...new Set(datasDestino)].filter(iso => _state.sessions.some(s => s.date === iso));
  if (diasComConflito.length) {
    const ok = window.confirm(`Isto acrescenta sessões a ${diasComConflito.length} dia${diasComConflito.length === 1 ? '' : 's'} que já ${diasComConflito.length === 1 ? 'tem' : 'têm'} conteúdo no plano actual — nada é substituído, só se junta. Continuar?`);
    if (!ok) return;
  }

  origem.forEach(s => {
    const novaData = addDiasIso(s.date, deslocamentoDias);
    const copy = structuredClone(s);
    copy.session_id = uuid();
    copy.date = novaData;
    copy.order = _state.sessions.filter(x => x.date === novaData).length;
    _state.sessions.push(copy);
  });

  closeHistoryModal();
  renderStep2Body();
  updateGerarButtonState();
}

/* ================================================================
   MODO 2 — edição em ecrã inteiro (barra compacta + editor)
   Substitui a fila de dias + lista do dia + painel lateral (9 ago 2026):
   o calendário recolhe para uma linha, o editor ocupa o resto do ecrã.
   ================================================================ */
function renderEditMode(host) {
  const date = _panelDraft ? _panelDraft.date : _pendingSlot.date;
  const dia = diaSemanaDeIso(date);
  const modalidadeLabel = _panelDraft ? TIPO_META[tipoKey(_panelDraft)].label : 'Escolher tipo de sessão';

  host.innerHTML = `
    <div class="gcwo-editbar">
      <button type="button" class="gcwo-editbar-back" id="gcwoEditBack">← Calendário</button>
      <span class="gcwo-editbar-sep">|</span>
      <span class="gcwo-editbar-day">${dia.full}, ${escHtml(fmtDiaMesCurtoIso(date))}</span>
      <span class="gcwo-editbar-sep">|</span>
      <span class="gcwo-editbar-modalidade">${escHtml(modalidadeLabel)}</span>
    </div>
    <div id="gcwoEditArea"></div>
  `;

  document.getElementById('gcwoEditBack').addEventListener('click', fecharPanel);

  const area = document.getElementById('gcwoEditArea');
  if (_panelDraft) {
    area.innerHTML = `<div class="gcwo-panel" id="gcwoPanel"></div>`;
    renderPanel();
  } else {
    area.innerHTML = `
      <div class="gcwo-card">
        <span class="gcwo-field-label">Escolher tipo de sessão</span>
        <div class="gcwo-typegrid gcwo-typegrid-lg" id="gcwoTypegrid"></div>
      </div>`;
    renderTypegrid();
  }
}

/* ── "Escolher tipo de sessão" (dentro do modo de edição) ── */
function renderTypegrid() {
  const host = document.getElementById('gcwoTypegrid');
  if (!host) return;

  host.innerHTML = SESSAO_MODALIDADES.map(t => {
    const meta = TIPO_META[tipoKey({ modality: t.modality })];
    return `
      <button type="button" class="gcwo-typecard" data-modality="${escAttr(t.modality)}" data-kind="${t.kind}"
        ${t.enabled ? '' : 'disabled title="Disponível numa próxima etapa"'}>
        <span class="ticon" style="background:${meta.bg};color:${meta.fg}">${meta.icon}</span>
        <span class="tname">${escHtml(t.modality)}</span>
      </button>`;
  }).join('');

  host.querySelectorAll('[data-modality]:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => {
      openPanelNovo(btn.getAttribute('data-modality'), btn.getAttribute('data-kind'));
    });
  });
}

/* ================================================================
   Painel — criar/editar sessão (mesma lógica de sempre; só muda de
   moldura — deixou de ser uma aside estreita e passa a ocupar o
   ecrã inteiro dentro do modo de edição)
   ================================================================ */
function openPanelNovo(modality, kind) {
  if (!_pendingSlot) return;
  _panelDraft = novaSessaoSkeleton(modality, kind, _pendingSlot.date);
  _panelIsNovo = true;
  _panelCatalogFiltro = 'favoritos';
  _panelCatalogBusca = '';
  _panelEquipFiltro = new Set();
  _pendingSlot = null;
  renderStep2Body();
}
function openPanelEditar(sessionId) {
  const s = _state.sessions.find(x => x.session_id === sessionId);
  if (!s) return;
  _panelCatalogFiltro = 'favoritos';
  _panelCatalogBusca = '';
  _panelEquipFiltro = new Set();
  _panelDraft = cloneSession(s);
  _panelIsNovo = false;
  _pendingSlot = null;
  renderStep2Body();
}
function fecharPanel() {
  _panelDraft = null;
  _panelIsNovo = false;
  _pendingSlot = null;
  renderStep2Body();
}

function renderPanel() {
  const panel = document.getElementById('gcwoPanel');
  if (!panel || !_panelDraft) return;

  const s = _panelDraft;
  const meta = TIPO_META[tipoKey(s)];
  const dia = diaSemanaDeIso(s.date);

  panel.innerHTML = `
    <div class="gcwo-panel-head">
      <span class="gcwo-panel-icon" style="background:${meta.bg};color:${meta.fg}">${meta.icon}</span>
      <span class="gcwo-panel-titles"><h3>${meta.label}</h3><span class="sub">${dia.full}, ${escHtml(fmtDiaMesCurtoIso(s.date))}</span></span>
      ${!_panelIsNovo ? `<button type="button" class="gcwo-panel-headbtn" id="gcwoPanelApagar" title="Apagar sessão">${ICON_TRASH}</button>` : ''}
      <button type="button" class="gcwo-panel-headbtn close" id="gcwoPanelFechar" title="Fechar">${ICON_CLOSE}</button>
    </div>
    <div class="gcwo-panel-body">
      <span class="gcwo-field-label">Local</span>
      <div class="gcwo-chips" id="gcwoPLocalChips">
        ${LOCAIS_SESSAO.map(l => `<button type="button" class="gcwo-chip${s.local === l ? ' on' : ''}" data-local="${escAttr(l)}">${escHtml(l)}</button>`).join('')}
      </div>

      <span class="gcwo-field-label" style="margin-top:10px;">Momento do dia (opcional)</span>
      <div class="gcwo-chips" id="gcwoPMomentoChips">
        <button type="button" class="gcwo-chip${!s.momento ? ' on' : ''}" data-momento="">Sem indicar</button>
        ${MOMENTOS_SESSAO.map(m => `<button type="button" class="gcwo-chip${s.momento === m.value ? ' on' : ''}" data-momento="${m.value}">${escHtml(m.label)}</button>`).join('')}
      </div>

      ${s.kind === 'list' ? renderCatalogPickerSection(s) : ''}
      ${s.kind === 'walk' ? renderPanelCaminhada(s) : ''}
      ${s.kind === 'card' ? renderPanelCardio(s) : ''}
      ${s.kind === 'circuit' ? renderPanelCircuito(s) : ''}

      <span class="gcwo-erro" id="gcwoPErro"></span>
    </div>
    <div class="gcwo-panel-footer">
      <button type="button" class="gcBtnGhost" id="gcwoPCancelar">Cancelar</button>
      <button type="button" class="gcBtnSuccess" id="gcwoPGuardar">Guardar sessão</button>
    </div>
  `;

  wirePanel();
}


/* ── Painel — wiring ─────────────────────────────────────── */
function wirePanel() {
  const s = _panelDraft;

  document.getElementById('gcwoPanelFechar').addEventListener('click', fecharPanel);
  document.getElementById('gcwoPCancelar').addEventListener('click', fecharPanel);
  document.getElementById('gcwoPanelApagar')?.addEventListener('click', () => {
    _state.sessions = _state.sessions.filter(x => x.session_id !== s.session_id);
    fecharPanel();
    updateGerarButtonState();
  });
  document.getElementById('gcwoPGuardar').addEventListener('click', handleGuardarSessao);

  document.getElementById('gcwoPLocalChips').querySelectorAll('[data-local]').forEach(chip => {
    chip.addEventListener('click', () => {
      s.local = chip.getAttribute('data-local');
      document.querySelectorAll('#gcwoPLocalChips .gcwo-chip').forEach(c => c.classList.toggle('on', c === chip));
    });
  });

  document.getElementById('gcwoPMomentoChips').querySelectorAll('[data-momento]').forEach(chip => {
    chip.addEventListener('click', () => {
      s.momento = chip.getAttribute('data-momento') || null;
      document.querySelectorAll('#gcwoPMomentoChips .gcwo-chip').forEach(c => c.classList.toggle('on', c === chip));
    });
  });

  if (s.kind === 'list') wireCatalogPicker(s);
  if (s.kind === 'walk') wirePanelCaminhada(s);
  if (s.kind === 'card') wirePanelCardio(s);
  if (s.kind === 'circuit') wirePanelCircuito(s);
}

/* ── Painel — catálogo de exercícios (grelha, favoritos por omissão) ── */
function renderCatalogPickerSection(s) {
  return `
    <span class="gcwo-field-label" style="margin-top:14px;">Exercícios</span>
    <div class="gcwo-chips" id="gcwoPCatFiltro">
      ${CATALOG_FILTROS.map(f => `<button type="button" class="gcwo-chip${_panelCatalogFiltro === f.value ? ' on' : ''}" data-filtro="${escAttr(f.value)}">${escHtml(f.label)}</button>`).join('')}
    </div>
    <span class="gcwo-field-label" style="margin-top:8px;">Equipamento</span>
    <div class="gcwo-chips" id="gcwoPEquipFiltro">
      ${EQUIPAMENTO_FILTROS.map(eq => `<button type="button" class="gcwo-chip${_panelEquipFiltro.has(eq) ? ' on' : ''}" data-equip="${escAttr(eq)}">${escHtml(eq)}</button>`).join('')}
    </div>
    <div class="gc-search-bar" style="margin-top:8px;">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5.5" stroke="#94a3b8" stroke-width="1.4"/><path d="M11 11l3 3" stroke="#94a3b8" stroke-width="1.4" stroke-linecap="round"/></svg>
      <input id="gcwoPCatBusca" type="search" class="gc-search-input" placeholder="Pesquisar exercício…" autocomplete="off" spellcheck="false" value="${escAttr(_panelCatalogBusca)}">
    </div>
    <div class="gcwo-catpick-grid" id="gcwoPCatGrid">${renderCatalogPickerGrid(s)}</div>

    <span class="gcwo-field-label" style="margin-top:14px;">Seleccionados</span>
    <div class="gcwo-exercicios" id="gcwoPPickedList">${renderPickedListInner(s)}</div>

    <div class="gcwo-progressao-nota">Sobe para o topo do intervalo em todas as séries → sugere incremento no treino seguinte.</div>
  `;
}

function filteredCatalogForPanel() {
  const busca = (_panelCatalogBusca || '').trim().toLowerCase();
  let list = _state.exercisesCatalog;
  if (_panelCatalogFiltro === 'favoritos') list = list.filter(e => e.is_favorite);
  else if (_panelCatalogFiltro !== 'todos') list = list.filter(e => Array.isArray(e.categoria) && e.categoria.includes(_panelCatalogFiltro));
  if (_panelEquipFiltro.size) list = list.filter(e => Array.isArray(e.equipamento) && e.equipamento.some(eq => _panelEquipFiltro.has(eq)));
  if (busca) list = list.filter(e => (e.name || '').toLowerCase().includes(busca));
  return list;
}

function renderCatalogPickerGrid(s) {
  if (!_state.catalogLoaded) return `<div class="gcwo-muted">A carregar catálogo…</div>`;
  const list = filteredCatalogForPanel();
  if (!list.length) {
    if (_panelCatalogFiltro === 'favoritos' && !_panelCatalogBusca) {
      return `<div class="gcwo-muted">Sem favoritos ainda — muda para "Todos", ou marca favoritos no Catálogo.</div>`;
    }
    return `<div class="gcwo-muted">Nenhum exercício encontrado.</div>`;
  }
  return list.map(ex => {
    const added = s.items.some(it => it.exercise_id === ex.id);
    return `
      <button type="button" class="gcwo-catpick-card${added ? ' added' : ''}" data-exid="${escAttr(ex.id)}" title="${added ? 'Remover da sessão' : 'Adicionar à sessão'}">
        ${ex.photo_url ? `<span class="gcwo-catpick-photo"><img src="${escAttr(ex.photo_url)}" alt=""></span>` : `<span class="gcwo-catpick-photo empty"></span>`}
        <span class="gcwo-catpick-name">${escHtml(ex.name)}</span>
        ${added ? `<span class="gcwo-catpick-check">✓</span>` : ''}
      </button>`;
  }).join('');
}

// Sem reps_fixed definido → intervalo (o modo por omissão de qualquer exercício novo).
function itemRepsMode(it) {
  return it.reps_fixed != null ? 'fixo' : 'intervalo';
}

// Variante "por duração" (decisão de 8 de agosto de 2026, briefing secção 3): um item de
// ginásio tem `duration_sec` OU sets/reps/carga/incremento/rest_set, nunca os dois. `rest_next`
// aplica-se sempre, independentemente do modo.
function itemDuracaoMode(it) {
  return it.duration_sec != null ? 'duracao' : 'series';
}

function renderPickedListInner(s) {
  if (!s.items.length) return `<div class="gcwo-muted">Nenhum exercício seleccionado ainda.</div>`;
  return s.items.map(renderItemCard).join('');
}

function renderItemCard(it) {
  const modoDuracao = itemDuracaoMode(it);
  const duracaoRadioName = `gcwo-duracaomode-${it.exercise_id}`;
  return `
    <div class="gcwo-exercicio" data-exid="${escAttr(it.exercise_id)}">
      <div class="gcwo-exercicio-head">
        ${it.photo_url ? `<img class="gcwo-exercicio-foto" src="${escAttr(it.photo_url)}" alt="">` : ''}
        <strong>${escHtml(it.name)}</strong>
        <button type="button" class="gcwo-exercicio-remove" data-remove-exid="${escAttr(it.exercise_id)}" title="Remover exercício">✕</button>
      </div>
      <div class="gcwo-field" style="margin-top:8px;">
        <span>Modo</span>
        <div class="gcwo-modo">
          <label><input type="radio" name="${duracaoRadioName}" value="series" ${modoDuracao === 'series' ? 'checked' : ''}> Séries/repetições</label>
          <label><input type="radio" name="${duracaoRadioName}" value="duracao" ${modoDuracao === 'duracao' ? 'checked' : ''}> Duração</label>
        </div>
      </div>
      ${modoDuracao === 'duracao' ? `
      <label class="gcwo-field" style="margin-top:8px;"><span>Duração (min)</span><input type="number" min="0" step="0.5" class="gcwo-it-duracaomin" value="${it.duration_sec != null ? it.duration_sec / 60 : ''}"></label>
      ` : renderItemCardSeriesFields(it)}
      <label class="gcwo-field gcwo-field-sm" style="margin-top:8px;"><span>Descanso p/ próximo (s)</span><input type="number" min="0" class="gcwo-it-restnext" value="${it.rest_next ?? ''}"></label>
    </div>`;
}

function renderItemCardSeriesFields(it) {
  const mode = itemRepsMode(it);
  const radioName = `gcwo-repsmode-${it.exercise_id}`;
  return `
      <label class="gcwo-field gcwo-field-sm" style="margin-top:8px;"><span>Séries</span><input type="number" min="1" class="gcwo-it-sets" value="${it.sets ?? ''}"></label>
      <div class="gcwo-field" style="margin-top:8px;">
        <span>Repetições</span>
        <div class="gcwo-modo">
          <label><input type="radio" name="${radioName}" value="intervalo" ${mode === 'intervalo' ? 'checked' : ''}> Intervalo</label>
          <label><input type="radio" name="${radioName}" value="fixo" ${mode === 'fixo' ? 'checked' : ''}> Fixo</label>
        </div>
      </div>
      ${mode === 'intervalo' ? `
      <div class="gcwo-row2">
        <label class="gcwo-field gcwo-field-sm"><span>Reps mín.</span><input type="number" min="0" class="gcwo-it-repsmin" value="${it.reps_min ?? ''}"></label>
        <label class="gcwo-field gcwo-field-sm"><span>Reps máx.</span><input type="number" min="0" class="gcwo-it-repsmax" value="${it.reps_max ?? ''}"></label>
      </div>` : `
      <label class="gcwo-field"><span>Repetições (número fixo)</span><input type="number" min="0" class="gcwo-it-repsfixed" value="${it.reps_fixed ?? ''}"></label>
      `}
      <div class="gcwo-row2">
        <label class="gcwo-field gcwo-field-sm"><span>Carga (kg)</span><input type="number" min="0" step="0.5" class="gcwo-it-carga" value="${it.load ?? ''}"></label>
        <label class="gcwo-field gcwo-field-sm"><span>Incremento (kg)</span><input type="number" min="0" step="0.5" class="gcwo-it-incremento" value="${it.incremento ?? ''}"></label>
      </div>
      <label class="gcwo-field gcwo-field-sm"><span>Descanso entre séries (s)</span><input type="number" min="0" class="gcwo-it-restset" value="${it.rest_set ?? ''}"></label>`;
}

function toggleExercicioNaSessao(s, exId) {
  const idx = s.items.findIndex(it => it.exercise_id === exId);
  if (idx >= 0) {
    s.items.splice(idx, 1);
  } else {
    const ex = _state.exercisesCatalog.find(e => e.id === exId);
    if (!ex) return;
    s.items.push({
      exercise_id: ex.id,
      name: ex.name,
      photo_url: ex.photo_url || null,
      categoria: ex.categoria || [],
      sets: 3,
      reps_min: 8,
      reps_max: 12,
      reps_fixed: null,
      load: null,
      incremento: ex.incremento_default ?? null,
      rest_set: 60,
      rest_next: 90,
    });
  }
  refreshCatalogPickerDom(s);
}

// Grelha + seleccionados mudam ambos (a grelha ganha/perde o "✓") — reconstrói e reata os dois.
function refreshCatalogPickerDom(s) {
  const grid = document.getElementById('gcwoPCatGrid');
  if (grid) grid.innerHTML = renderCatalogPickerGrid(s);
  const picked = document.getElementById('gcwoPPickedList');
  if (picked) picked.innerHTML = renderPickedListInner(s);
  wireGridCardClicks(s);
  wireRemoveButtons(s);
  wirePickedItems(s);
}

// Só o cartão do exercício muda de forma (intervalo↔fixo) — a grelha fica intacta, não se reata.
function refreshPickedListDom(s) {
  const picked = document.getElementById('gcwoPPickedList');
  if (picked) picked.innerHTML = renderPickedListInner(s);
  wireRemoveButtons(s);
  wirePickedItems(s);
}

function wireGridCardClicks(s) {
  document.querySelectorAll('#gcwoPCatGrid [data-exid]').forEach(btn => {
    btn.addEventListener('click', () => toggleExercicioNaSessao(s, btn.getAttribute('data-exid')));
  });
}

function wireRemoveButtons(s) {
  document.querySelectorAll('#gcwoPPickedList [data-remove-exid]').forEach(btn => {
    btn.addEventListener('click', () => toggleExercicioNaSessao(s, btn.getAttribute('data-remove-exid')));
  });
}

// Campos numéricos só actualizam o estado — nunca voltam a desenhar (perderiam o foco a meio de digitar).
// Só o toggle intervalo/fixo reconstrói o cartão, porque muda que campos aparecem.
function wirePickedItems(s) {
  document.querySelectorAll('#gcwoPPickedList .gcwo-exercicio').forEach(card => {
    const exId = card.getAttribute('data-exid');
    const it = s.items.find(i => i.exercise_id === exId);
    if (!it) return;

    const bindNum = (selector, field) => {
      const el = card.querySelector(selector);
      if (el) el.addEventListener('input', (e) => { it[field] = e.target.value === '' ? null : Number(e.target.value); });
    };
    bindNum('.gcwo-it-sets', 'sets');
    bindNum('.gcwo-it-repsmin', 'reps_min');
    bindNum('.gcwo-it-repsmax', 'reps_max');
    bindNum('.gcwo-it-repsfixed', 'reps_fixed');
    bindNum('.gcwo-it-carga', 'load');
    bindNum('.gcwo-it-incremento', 'incremento');
    bindNum('.gcwo-it-restset', 'rest_set');
    bindNum('.gcwo-it-restnext', 'rest_next');

    const duracaoEl = card.querySelector('.gcwo-it-duracaomin');
    if (duracaoEl) duracaoEl.addEventListener('input', (e) => {
      it.duration_sec = e.target.value === '' ? null : Math.round(Number(e.target.value) * 60);
    });

    card.querySelectorAll(`input[name="gcwo-repsmode-${CSS.escape(exId)}"]`).forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (!e.target.checked) return;
        if (e.target.value === 'intervalo') {
          it.reps_fixed = null;
          if (it.reps_min == null) it.reps_min = 8;
          if (it.reps_max == null) it.reps_max = 12;
        } else {
          it.reps_min = null;
          it.reps_max = null;
          if (it.reps_fixed == null) it.reps_fixed = 12;
        }
        refreshPickedListDom(s);
      });
    });

    card.querySelectorAll(`input[name="gcwo-duracaomode-${CSS.escape(exId)}"]`).forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (!e.target.checked) return;
        if (e.target.value === 'duracao') {
          it.sets = null;
          it.reps_min = null;
          it.reps_max = null;
          it.reps_fixed = null;
          it.load = null;
          it.incremento = null;
          it.rest_set = null;
          if (it.duration_sec == null) it.duration_sec = 600;
        } else {
          it.duration_sec = null;
          if (it.sets == null) it.sets = 3;
          if (it.reps_min == null && it.reps_fixed == null) { it.reps_min = 8; it.reps_max = 12; }
          if (it.rest_set == null) it.rest_set = 60;
        }
        refreshPickedListDom(s);
      });
    });
  });
}

function wireCatalogPicker(s) {
  document.querySelectorAll('#gcwoPCatFiltro [data-filtro]').forEach(chip => {
    chip.addEventListener('click', () => {
      _panelCatalogFiltro = chip.getAttribute('data-filtro');
      document.querySelectorAll('#gcwoPCatFiltro .gcwo-chip').forEach(c => c.classList.toggle('on', c === chip));
      const grid = document.getElementById('gcwoPCatGrid');
      if (grid) grid.innerHTML = renderCatalogPickerGrid(s);
      wireGridCardClicks(s);
    });
  });
  document.querySelectorAll('#gcwoPEquipFiltro [data-equip]').forEach(chip => {
    chip.addEventListener('click', () => {
      const eq = chip.getAttribute('data-equip');
      if (_panelEquipFiltro.has(eq)) _panelEquipFiltro.delete(eq); else _panelEquipFiltro.add(eq);
      chip.classList.toggle('on');
      const grid = document.getElementById('gcwoPCatGrid');
      if (grid) grid.innerHTML = renderCatalogPickerGrid(s);
      wireGridCardClicks(s);
    });
  });
  document.getElementById('gcwoPCatBusca').addEventListener('input', (e) => {
    _panelCatalogBusca = e.target.value;
    const grid = document.getElementById('gcwoPCatGrid');
    if (grid) grid.innerHTML = renderCatalogPickerGrid(s);
    wireGridCardClicks(s);
  });
  wireGridCardClicks(s);
  wireRemoveButtons(s);
  wirePickedItems(s);
}

/* ── Painel — Caminhada (secção 3/5 do briefing: sem blocos, caminhadas + escadas) ── */
const PACE_OPCOES = [
  { value: 'lento', label: 'Lento' },
  { value: 'moderado', label: 'Moderado' },
  { value: 'rapido', label: 'Rápido' },
];
function novaCaminhada() {
  return { walk_id: uuid(), label: '', duration_sec: null, pace: 'moderado', rpe_local: null };
}

function renderPanelCaminhada(s) {
  return `
    <span class="gcwo-field-label" style="margin-top:14px;">Caminhadas</span>
    <div class="gcwo-exercicios" id="gcwoPWalksList">${renderWalksListInner(s)}</div>
    <button type="button" class="gcwo-add-exercicio gcBtnGhost" id="gcwoPAddWalk">+ Caminhada</button>

    <span class="gcwo-field-label" style="margin-top:14px;">Escadas (opcional)</span>
    <label class="gcwo-field gcwo-field-sm"><span>Lanços de escadas</span><input type="number" min="0" id="gcwoPStairs" value="${s.stairs_flights ?? ''}"></label>
  `;
}

function renderWalksListInner(s) {
  if (!s.walks.length) return `<div class="gcwo-muted">Nenhuma caminhada adicionada ainda.</div>`;
  return s.walks.map(renderWalkCard).join('');
}

function renderWalkCard(w) {
  return `
    <div class="gcwo-exercicio" data-wid="${escAttr(w.walk_id)}">
      <div class="gcwo-exercicio-head">
        <input type="text" class="gcwo-walk-label" placeholder="Etiqueta (ex.: após almoço)" value="${escAttr(w.label)}" style="flex:1;">
        <button type="button" class="gcwo-exercicio-remove" data-remove-wid="${escAttr(w.walk_id)}" title="Remover caminhada">✕</button>
      </div>
      <div class="gcwo-row2">
        ${campoDuracaoMMSS('gcwo-walk-duracaomin', w.duration_sec, 'Duração')}
        <label class="gcwo-field gcwo-field-sm"><span>Passo</span>
          <select class="gcwo-walk-pace">${PACE_OPCOES.map(p => `<option value="${p.value}" ${w.pace === p.value ? 'selected' : ''}>${p.label}</option>`).join('')}</select>
        </label>
      </div>
      <label class="gcwo-field gcwo-field-sm"><span>RPE local (opcional)</span><input type="number" min="1" max="10" class="gcwo-walk-rpe" value="${w.rpe_local ?? ''}"></label>
    </div>`;
}

function refreshWalksListDom(s) {
  const host = document.getElementById('gcwoPWalksList');
  if (host) host.innerHTML = renderWalksListInner(s);
  wireWalksListItems(s);
}

function wireWalksListItems(s) {
  document.querySelectorAll('#gcwoPWalksList [data-remove-wid]').forEach(btn => {
    btn.addEventListener('click', () => {
      const wid = btn.getAttribute('data-remove-wid');
      s.walks = s.walks.filter(w => w.walk_id !== wid);
      refreshWalksListDom(s);
    });
  });
  document.querySelectorAll('#gcwoPWalksList .gcwo-exercicio').forEach(card => {
    const wid = card.getAttribute('data-wid');
    const w = s.walks.find(x => x.walk_id === wid);
    if (!w) return;
    card.querySelector('.gcwo-walk-label').addEventListener('input', (e) => { w.label = e.target.value; });
    wireDuracaoMMSS(card, 'gcwo-walk-duracaomin', (sec) => { w.duration_sec = sec; });
    card.querySelector('.gcwo-walk-pace').addEventListener('change', (e) => { w.pace = e.target.value; });
    card.querySelector('.gcwo-walk-rpe').addEventListener('input', (e) => { w.rpe_local = e.target.value === '' ? null : Number(e.target.value); });
  });
}

function wirePanelCaminhada(s) {
  document.getElementById('gcwoPAddWalk').addEventListener('click', () => {
    s.walks.push(novaCaminhada());
    refreshWalksListDom(s);
  });
  document.getElementById('gcwoPStairs').addEventListener('input', (e) => {
    s.stairs_flights = e.target.value === '' ? null : Number(e.target.value);
  });
  wireWalksListItems(s);
}

/* ── Painel — Corrida/Ciclismo/Natação (secção 3/5 do briefing: blocos contínuo/séries/fecho) ── */
function novaIntensidade() {
  return { zone: null, pace_sec_per_km: null, pace_sec_per_100m: null, heart_rate_bpm: null, power_w: null, cadence_rpm: null, rpe: null };
}
function novoBlocoContinuo() {
  return { block_id: uuid(), type: 'continuous', duration_sec: null, intensity: novaIntensidade() };
}
function novoBlocoSeries() {
  return { block_id: uuid(), type: 'series', count: 4, work: { measure: 'distance', value: null, unit: 'm', intensity: novaIntensidade() }, recovery: { duration_sec: null, intensity: novaIntensidade() } };
}
function novoBlocoFecho() {
  return { block_id: uuid(), type: 'closing', mode: 'rest', duration_sec: null, intensity: novaIntensidade() };
}

// Soma minutos por zona a partir dos blocos com duração conhecida (nunca converte
// distância em tempo estimado — um bloco de séries por distância fica fora do cálculo,
// mesmo princípio do indicador descrito na secção 3). É um espelho, não uma previsão.
function calcularCargaPorZona(s) {
  const minutosPorZona = {};
  let totalComZona = 0, totalGeral = 0;
  (s.blocks || []).forEach(b => {
    let segundos = 0, zone = null;
    if (b.type === 'continuous' || b.type === 'closing') {
      segundos = b.duration_sec || 0;
      zone = b.intensity && b.intensity.zone;
    } else if (b.type === 'series' && b.work && b.work.measure === 'time' && b.work.value != null) {
      const recDur = b.recovery ? (b.recovery.duration_sec || 0) : 0;
      segundos = (b.count || 0) * (b.work.value + recDur);
      zone = b.work.intensity && b.work.intensity.zone;
    }
    if (!segundos) return;
    totalGeral += segundos;
    if (zone) { minutosPorZona[zone] = (minutosPorZona[zone] || 0) + segundos; totalComZona += segundos; }
  });
  return { minutosPorZona, totalComZona, totalGeral };
}
function renderIndicadorZonaHtml(s) {
  const { minutosPorZona, totalComZona } = calcularCargaPorZona(s);
  if (!totalComZona) return '';
  const z3mais = Object.entries(minutosPorZona)
    .filter(([z]) => Number(z.replace('Z', '')) >= 3)
    .reduce((a, [, v]) => a + v, 0);
  const pct = Math.round((z3mais / totalComZona) * 100);
  return `<div class="gcwo-progressao-nota">Z3+: ${fmtDuracaoTotal(z3mais)} de ${fmtDuracaoTotal(totalComZona)} · ${pct}% acima da base</div>`;
}
function refreshZonaResumo(s) {
  const host = document.getElementById('gcwoPZonaResumo');
  if (host) host.innerHTML = renderIndicadorZonaHtml(s);
}

function renderIntensidadeCampos(intensity, mostrarZona, modality) {
  const isNatacao = modality === 'Natação';
  return `
    <div class="gcwo-row3">
      ${mostrarZona ? `
      <label class="gcwo-field"><span>Zona</span>
        <select class="gcwo-int-zone">
          <option value="">—</option>
          ${ZONAS.map(z => `<option value="${z}" ${intensity.zone === z ? 'selected' : ''}>${z}</option>`).join('')}
        </select>
        <span class="gcwo-int-zone-hint">${bpmRangeParaZona(intensity.zone) ? `${intensity.zone} · ${bpmRangeParaZona(intensity.zone)}` : ''}</span>
      </label>` : ''}
      ${isNatacao
        ? `<label class="gcwo-field"><span>Ritmo (min:seg/100m)</span><input type="text" inputmode="numeric" placeholder="1:35" class="gcwo-int-pace100" value="${escAttr(fmtPaceEditavel(intensity.pace_sec_per_100m))}"></label>`
        : `<label class="gcwo-field"><span>Ritmo (min/km)</span><input type="text" inputmode="numeric" placeholder="5:00" class="gcwo-int-pace" value="${escAttr(fmtPaceEditavel(intensity.pace_sec_per_km))}"></label>`
      }
      <label class="gcwo-field"><span>FC (bpm)</span><input type="number" min="0" class="gcwo-int-fc" value="${intensity.heart_rate_bpm ?? ''}"></label>
      <label class="gcwo-field"><span>Potência (W)</span><input type="number" min="0" class="gcwo-int-power" value="${intensity.power_w ?? ''}"></label>
      <label class="gcwo-field"><span>Cadência (rpm)</span><input type="number" min="0" class="gcwo-int-cadence" value="${intensity.cadence_rpm ?? ''}"></label>
      <label class="gcwo-field"><span>RPE</span><input type="number" min="1" max="10" class="gcwo-int-rpe" value="${intensity.rpe ?? ''}"></label>
    </div>`;
}
function wrapIntensidade(bid, scope, intensity, mostrarZona, modality) {
  return `<div class="gcwo-intensidade" data-bid="${escAttr(bid)}" data-scope="${scope}">${renderIntensidadeCampos(intensity, mostrarZona, modality)}</div>`;
}
function intensidadeDoScope(b, scope) {
  if (scope === 'work') return b.work.intensity;
  if (scope === 'recovery') return b.recovery.intensity;
  return b.intensity;
}

// Campo de duração em minutos+segundos (bug #3 — minutos inteiros não chegam para 20"/30").
// Guarda sempre em segundos; renderiza sempre como dois inputs pequenos, min e seg.
function campoDuracaoMMSS(baseClass, totalSec, label) {
  const min = totalSec != null ? Math.floor(totalSec / 60) : '';
  const seg = totalSec != null ? totalSec % 60 : '';
  return `
    <div class="gcwo-field gcwo-field-sm">
      <span>${escHtml(label)}</span>
      <div class="gcwo-mmss">
        <input type="number" min="0" class="${baseClass}-min" placeholder="min" value="${min}">
        <span class="gcwo-mmss-sep">:</span>
        <input type="number" min="0" max="59" class="${baseClass}-seg" placeholder="seg" value="${seg}">
      </div>
    </div>`;
}
function wireDuracaoMMSS(container, baseClass, onChange) {
  const minEl = container.querySelector(`.${baseClass}-min`);
  const segEl = container.querySelector(`.${baseClass}-seg`);
  if (!minEl || !segEl) return;
  const emit = () => {
    const temValor = minEl.value !== '' || segEl.value !== '';
    if (!temValor) { onChange(null); return; }
    const min = minEl.value === '' ? 0 : Number(minEl.value);
    const seg = segEl.value === '' ? 0 : Number(segEl.value);
    onChange(min * 60 + seg);
  };
  minEl.addEventListener('input', emit);
  segEl.addEventListener('input', emit);
}

function renderBlocoContinuo(b, temZona, modality) {
  return `
    <div class="gcwo-exercicio" data-bid="${escAttr(b.block_id)}">
      <div class="gcwo-exercicio-head">
        <strong>Contínuo</strong>
        <button type="button" class="gcwo-exercicio-remove" data-remove-bid="${escAttr(b.block_id)}" title="Remover bloco">✕</button>
      </div>
      <div style="margin-top:8px;">${campoDuracaoMMSS('gcwo-bloco-duracaomin', b.duration_sec, 'Duração')}</div>
      <span class="gcwo-field-label" style="margin-top:10px;">Intensidade</span>
      ${wrapIntensidade(b.block_id, 'main', b.intensity, temZona, modality)}
    </div>`;
}
function renderBlocoFecho(b, temZona, modality) {
  const modos = modality === 'Natação' ? CLOSING_MODES.filter(m => m.value !== 'walk') : CLOSING_MODES;
  return `
    <div class="gcwo-exercicio" data-bid="${escAttr(b.block_id)}">
      <div class="gcwo-exercicio-head">
        <strong>Fecho</strong>
        <button type="button" class="gcwo-exercicio-remove" data-remove-bid="${escAttr(b.block_id)}" title="Remover bloco">✕</button>
      </div>
      <div class="gcwo-row2" style="margin-top:8px;">
        <label class="gcwo-field gcwo-field-sm"><span>Modo</span>
          <select class="gcwo-bloco-mode">${modos.map(m => `<option value="${m.value}" ${b.mode === m.value ? 'selected' : ''}>${m.label}</option>`).join('')}</select>
        </label>
        ${campoDuracaoMMSS('gcwo-bloco-duracaomin', b.duration_sec, 'Duração')}
      </div>
      <span class="gcwo-field-label" style="margin-top:10px;">Intensidade</span>
      ${wrapIntensidade(b.block_id, 'main', b.intensity, temZona, modality)}
    </div>`;
}
function renderBlocoSeries(b, temZona, soDistancia, modality) {
  const medida = b.work.measure;
  return `
    <div class="gcwo-exercicio" data-bid="${escAttr(b.block_id)}">
      <div class="gcwo-exercicio-head">
        <strong>Séries</strong>
        <button type="button" class="gcwo-exercicio-remove" data-remove-bid="${escAttr(b.block_id)}" title="Remover bloco">✕</button>
      </div>
      <label class="gcwo-field gcwo-field-sm" style="margin-top:8px;"><span>Nº de séries</span><input type="number" min="1" class="gcwo-bloco-count" value="${b.count ?? ''}"></label>
      ${soDistancia ? '' : `
      <div class="gcwo-field" style="margin-top:8px;">
        <span>Trabalho — medida</span>
        <div class="gcwo-modo">
          <label><input type="radio" name="gcwo-medida-${b.block_id}" value="distance" ${medida === 'distance' ? 'checked' : ''}> Distância</label>
          <label><input type="radio" name="gcwo-medida-${b.block_id}" value="time" ${medida === 'time' ? 'checked' : ''}> Tempo</label>
        </div>
      </div>`}
      ${medida === 'distance'
        ? `<label class="gcwo-field gcwo-field-sm"><span>Distância (m)</span><input type="number" min="0" class="gcwo-bloco-workvalue" value="${b.work.value ?? ''}"></label>`
        : campoDuracaoMMSS('gcwo-bloco-workvalue', b.work.value, 'Duração do trabalho')
      }
      <span class="gcwo-field-label" style="margin-top:10px;">Intensidade do trabalho</span>
      ${wrapIntensidade(b.block_id, 'work', b.work.intensity, temZona, modality)}
      <div style="margin-top:10px;">${campoDuracaoMMSS('gcwo-bloco-recdur', b.recovery.duration_sec, 'Recuperação')}</div>
      <span class="gcwo-field-label" style="margin-top:10px;">Intensidade da recuperação</span>
      ${wrapIntensidade(b.block_id, 'recovery', b.recovery.intensity, temZona, modality)}
    </div>`;
}
function renderBlocoCardio(b, s) {
  const temZona = modalidadeTemZona(s.modality);
  if (b.type === 'series') {
    const soDistancia = s.modality === 'Natação';
    if (soDistancia) b.work.measure = 'distance';
    return renderBlocoSeries(b, temZona, soDistancia, s.modality);
  }
  if (b.type === 'closing') return renderBlocoFecho(b, temZona, s.modality);
  return renderBlocoContinuo(b, temZona, s.modality);
}
function renderBlocosListInner(s) {
  if (!s.blocks.length) return `<div class="gcwo-muted">Nenhum bloco adicionado ainda.</div>`;
  return s.blocks.map(b => renderBlocoCardio(b, s)).join('');
}

const ESTILOS_NATACAO = [
  { value: 'crol', label: 'Crol' },
  { value: 'costas', label: 'Costas' },
  { value: 'bruços', label: 'Bruços' },
  { value: 'mariposa', label: 'Mariposa' },
];
function renderPainelNatacaoTopo(s) {
  const pool = s.pool_length_m ?? 25;
  const stroke = s.stroke ?? 'crol';
  return `
    <span class="gcwo-field-label">Piscina</span>
    <div class="gcwo-chips" id="gcwoPPiscina">
      <button type="button" class="gcwo-chip${pool === 25 ? ' on' : ''}" data-pool="25">25 m</button>
      <button type="button" class="gcwo-chip${pool === 50 ? ' on' : ''}" data-pool="50">50 m</button>
    </div>
    <label class="gcwo-field gcwo-field-sm" style="margin-top:10px;"><span>Estilo</span>
      <select id="gcwoPEstilo">${ESTILOS_NATACAO.map(e => `<option value="${e.value}" ${stroke === e.value ? 'selected' : ''}>${e.label}</option>`).join('')}</select>
    </label>
  `;
}
function renderPanelCardio(s) {
  return `
    ${s.modality === 'Natação' ? renderPainelNatacaoTopo(s) : ''}
    ${modalidadeTemZona(s.modality) ? `<div id="gcwoPZonaResumo">${renderIndicadorZonaHtml(s)}</div>` : ''}
    <span class="gcwo-field-label" style="margin-top:14px;">Blocos</span>
    <div class="gcwo-exercicios" id="gcwoPBlocosList">${renderBlocosListInner(s)}</div>
    <div class="gcwo-exercicio-add">
      <button type="button" class="gcBtnGhost gcBtnSm" id="gcwoPAddContinuo">+ Contínuo</button>
      <button type="button" class="gcBtnGhost gcBtnSm" id="gcwoPAddSeries">+ Séries</button>
      <button type="button" class="gcBtnGhost gcBtnSm" id="gcwoPAddFecho">+ Fecho</button>
    </div>
  `;
}

function wireIntensidadeForms(s) {
  document.querySelectorAll('#gcwoPBlocosList .gcwo-intensidade').forEach(box => {
    const bid = box.getAttribute('data-bid');
    const scope = box.getAttribute('data-scope');
    const b = s.blocks.find(x => x.block_id === bid);
    if (!b) return;
    const intensity = intensidadeDoScope(b, scope);

    const zoneEl = box.querySelector('.gcwo-int-zone');
    if (zoneEl) zoneEl.addEventListener('change', (e) => {
      intensity.zone = e.target.value || null;
      const hintEl = box.querySelector('.gcwo-int-zone-hint');
      if (hintEl) {
        const range = bpmRangeParaZona(intensity.zone);
        hintEl.textContent = range ? `${intensity.zone} · ${range}` : '';
      }
      refreshZonaResumo(s);
    });
    const paceEl = box.querySelector('.gcwo-int-pace');
    if (paceEl) paceEl.addEventListener('input', (e) => { intensity.pace_sec_per_km = parsePaceParaSegundos(e.target.value); });
    const pace100El = box.querySelector('.gcwo-int-pace100');
    if (pace100El) pace100El.addEventListener('input', (e) => { intensity.pace_sec_per_100m = parsePaceParaSegundos(e.target.value); });
    box.querySelector('.gcwo-int-fc').addEventListener('input', (e) => { intensity.heart_rate_bpm = e.target.value === '' ? null : Number(e.target.value); });
    box.querySelector('.gcwo-int-power').addEventListener('input', (e) => { intensity.power_w = e.target.value === '' ? null : Number(e.target.value); });
    box.querySelector('.gcwo-int-cadence').addEventListener('input', (e) => { intensity.cadence_rpm = e.target.value === '' ? null : Number(e.target.value); });
    box.querySelector('.gcwo-int-rpe').addEventListener('input', (e) => { intensity.rpe = e.target.value === '' ? null : Number(e.target.value); });
  });
}

function refreshBlocosListDom(s) {
  const host = document.getElementById('gcwoPBlocosList');
  if (host) host.innerHTML = renderBlocosListInner(s);
  wireBlocosList(s);
  refreshZonaResumo(s);
}

function wireBlocosList(s) {
  document.querySelectorAll('#gcwoPBlocosList [data-remove-bid]').forEach(btn => {
    btn.addEventListener('click', () => {
      const bid = btn.getAttribute('data-remove-bid');
      s.blocks = s.blocks.filter(b => b.block_id !== bid);
      refreshBlocosListDom(s);
    });
  });
  document.querySelectorAll('#gcwoPBlocosList .gcwo-exercicio').forEach(card => {
    const bid = card.getAttribute('data-bid');
    const b = s.blocks.find(x => x.block_id === bid);
    if (!b) return;

    wireDuracaoMMSS(card, 'gcwo-bloco-duracaomin', (sec) => { b.duration_sec = sec; refreshZonaResumo(s); });

    const modeEl = card.querySelector('.gcwo-bloco-mode');
    if (modeEl) modeEl.addEventListener('change', (e) => { b.mode = e.target.value; });

    const countEl = card.querySelector('.gcwo-bloco-count');
    if (countEl) countEl.addEventListener('input', (e) => {
      b.count = e.target.value === '' ? null : Number(e.target.value);
      refreshZonaResumo(s);
    });

    if (b.work && b.work.measure === 'distance') {
      const workValEl = card.querySelector('.gcwo-bloco-workvalue');
      if (workValEl) workValEl.addEventListener('input', (e) => {
        b.work.value = e.target.value === '' ? null : Number(e.target.value);
        refreshZonaResumo(s);
      });
    } else if (b.work) {
      wireDuracaoMMSS(card, 'gcwo-bloco-workvalue', (sec) => { b.work.value = sec; refreshZonaResumo(s); });
    }

    if (b.recovery) {
      wireDuracaoMMSS(card, 'gcwo-bloco-recdur', (sec) => { b.recovery.duration_sec = sec; refreshZonaResumo(s); });
    }

    card.querySelectorAll(`input[name="gcwo-medida-${CSS.escape(bid)}"]`).forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (!e.target.checked) return;
        b.work.measure = e.target.value;
        b.work.unit = e.target.value === 'distance' ? 'm' : 's';
        b.work.value = null;
        refreshBlocosListDom(s);
      });
    });
  });
  wireIntensidadeForms(s);
}

function wirePanelCardio(s) {
  document.getElementById('gcwoPAddContinuo').addEventListener('click', () => { s.blocks.push(novoBlocoContinuo()); refreshBlocosListDom(s); });
  document.getElementById('gcwoPAddSeries').addEventListener('click', () => { s.blocks.push(novoBlocoSeries()); refreshBlocosListDom(s); });
  document.getElementById('gcwoPAddFecho').addEventListener('click', () => { s.blocks.push(novoBlocoFecho()); refreshBlocosListDom(s); });
  wireBlocosList(s);
  refreshZonaResumo(s);

  const piscina = document.getElementById('gcwoPPiscina');
  if (piscina) piscina.querySelectorAll('[data-pool]').forEach(btn => {
    btn.addEventListener('click', () => {
      s.pool_length_m = Number(btn.getAttribute('data-pool'));
      piscina.querySelectorAll('.gcwo-chip').forEach(c => c.classList.toggle('on', c === btn));
    });
  });
  document.getElementById('gcwoPEstilo')?.addEventListener('change', (e) => { s.stroke = e.target.value; });
}

/* ── Painel — Circuito (secção 3/5 do briefing) ──────────────────────
   O ecrã edita blocos como "voltas" (rounds/exercícios) ou duração fixa
   — mas grava sempre em `intervals` já expandido (decisão de 8 de agosto
   de 2026): rounds/exercicios é só o modelo do ecrã, nunca o que fica em
   wo_prescriptions.data. flattenBlocosCircuitoParaGravar() faz a conversão. ── */
function novoBlocoCircuitoVoltas() {
  return { block_id: uuid(), tipo: 'voltas', name: '', rounds: 3, rest_between_rounds_s: null, exercicios: [] };
}
function novoBlocoCircuitoFixo() {
  return { block_id: uuid(), tipo: 'fixed', name: '', duration_sec: null };
}
function novoExercicioCircuito() {
  return { id: uuid(), exercise_id: null, name: '', measure: 'reps', value: null, rest_after_s: null };
}

// tempo_por_repeticao (secção 3): tempo_exercicio_s → concêntrico+excêntrico → fallback 2s+2s aproximado.
function tempoPorRepeticaoCatalogo(catEx) {
  if (!catEx) return { segundos: 4, aproximado: true };
  if (catEx.tempo_exercicio_s != null) return { segundos: catEx.tempo_exercicio_s, aproximado: false };
  if (catEx.tempo_concentrico_s != null && catEx.tempo_excentrico_s != null) {
    return { segundos: catEx.tempo_concentrico_s + catEx.tempo_excentrico_s, aproximado: false };
  }
  return { segundos: 4, aproximado: true };
}
function duracaoTrabalhoExercicioCircuito(ex) {
  if (ex.measure === 'time') return { segundos: ex.value || 0, aproximado: false };
  const catEx = _state.exercisesCatalog.find(c => c.id === ex.exercise_id);
  const { segundos: tempoRep, aproximado } = tempoPorRepeticaoCatalogo(catEx);
  return { segundos: (ex.value || 0) * tempoRep, aproximado };
}

function calcularTempoTotalCircuito(s) {
  let total = 0, aproximado = false;
  (s.blocks || []).forEach(b => {
    if (b.tipo === 'fixed') { total += b.duration_sec || 0; return; }
    const R = b.rounds || 1;
    const exs = b.exercicios || [];
    for (let r = 1; r <= R; r++) {
      exs.forEach(ex => {
        const { segundos, aproximado: aprox } = duracaoTrabalhoExercicioCircuito(ex);
        total += segundos;
        if (aprox) aproximado = true;
        if (ex.rest_after_s) total += ex.rest_after_s;
      });
      if (r < R && b.rest_between_rounds_s) total += b.rest_between_rounds_s;
    }
  });
  return { total, aproximado };
}
function renderTempoTotalCircuitoHtml(s) {
  const { total, aproximado } = calcularTempoTotalCircuito(s);
  const excedeu = s._limiteMin != null && total > s._limiteMin * 60;
  return `
    <div class="gcwo-progressao-nota"${excedeu ? ' style="background:#fef2f2;color:#b91c1c;"' : ''}>Tempo total previsto: ${fmtDuracaoTotal(total)}${aproximado ? ' *' : ''}${excedeu ? ' — acima do limite definido' : ''}</div>
    ${aproximado ? `<div class="gcwo-muted">* algum exercício sem tempo de execução no catálogo — usa 2s+2s aproximado</div>` : ''}
  `;
}
function refreshTempoTotalCircuito(s) {
  const host = document.getElementById('gcwoPTempoTotal');
  if (host) host.innerHTML = renderTempoTotalCircuitoHtml(s);
}

// Grelha de fotos para escolher o exercício do circuito (bug #4 — era dropdown de texto).
// Mesmo padrão visual do picker de Ginásio (gcwo-catpick-*), mas selecção única por linha.
function renderCircExGridHtml(filtro) {
  if (!_state.catalogLoaded) return `<div class="gcwo-muted">A carregar catálogo…</div>`;
  const q = (filtro || '').trim().toLowerCase();
  const list = q ? _state.exercisesCatalog.filter(c => (c.name || '').toLowerCase().includes(q)) : _state.exercisesCatalog;
  if (!list.length) return `<div class="gcwo-muted">Nenhum exercício encontrado.</div>`;
  return list.map(c => `
    <button type="button" class="gcwo-catpick-card" data-pick-exercise="${escAttr(c.id)}">
      ${c.photo_url ? `<span class="gcwo-catpick-photo"><img src="${escAttr(c.photo_url)}" alt=""></span>` : `<span class="gcwo-catpick-photo empty"></span>`}
      <span class="gcwo-catpick-name">${escHtml(c.name)}</span>
    </button>`).join('');
}
function renderCircExercicioRow(ex) {
  const catEx = _state.exercisesCatalog.find(c => c.id === ex.exercise_id);
  return `
    <div class="gcwo-circ-exrow" data-exid="${escAttr(ex.id)}" style="border-top:0.5px solid #e2e8f0;padding-top:8px;margin-top:8px;">
      <div class="gcwo-circ-ex-picked">
        ${catEx?.photo_url ? `<img class="gcwo-circ-ex-thumb" src="${escAttr(catEx.photo_url)}" alt="">` : `<span class="gcwo-circ-ex-thumb empty"></span>`}
        <span class="gcwo-circ-ex-name">${escHtml(ex.name || 'Escolher exercício…')}</span>
        <button type="button" class="gcBtnGhost gcBtnSm gcwo-circ-ex-trocar">${ex.exercise_id ? 'Trocar' : 'Escolher'}</button>
        <button type="button" class="gcwo-exercicio-remove" data-remove-exid="${escAttr(ex.id)}" title="Remover exercício">✕</button>
      </div>
      <div class="gcwo-circ-ex-picker" hidden>
        <input type="text" class="gcwo-circ-ex-search" placeholder="Pesquisar exercício…" autocomplete="off">
        <div class="gcwo-catpick-grid gcwo-circ-ex-grid">${renderCircExGridHtml('')}</div>
      </div>
      <div class="gcwo-row3" style="margin-top:8px;">
        <label class="gcwo-field"><span>Modo</span>
          <select class="gcwo-circ-ex-measure">
            <option value="reps" ${ex.measure === 'reps' ? 'selected' : ''}>Reps</option>
            <option value="time" ${ex.measure === 'time' ? 'selected' : ''}>Tempo (s)</option>
          </select>
        </label>
        <label class="gcwo-field"><span>${ex.measure === 'time' ? 'Segundos' : 'Repetições'}</span><input type="number" min="0" class="gcwo-circ-ex-value" value="${ex.value ?? ''}"></label>
        <label class="gcwo-field"><span>Descanso após (s)</span><input type="number" min="0" class="gcwo-circ-ex-rest" value="${ex.rest_after_s ?? ''}"></label>
      </div>
    </div>`;
}
function renderCircBlocoVoltas(b) {
  return `
    <div class="gcwo-exercicio" data-bid="${escAttr(b.block_id)}">
      <div class="gcwo-exercicio-head">
        <input type="text" class="gcwo-circ-nome" placeholder="Nome do bloco (ex.: Burpees)" value="${escAttr(b.name)}" style="flex:1;">
        <button type="button" class="gcwo-exercicio-remove" data-remove-cbid="${escAttr(b.block_id)}" title="Remover bloco">✕</button>
      </div>
      <div class="gcwo-row2" style="margin-top:8px;">
        <label class="gcwo-field gcwo-field-sm"><span>Voltas</span><input type="number" min="1" class="gcwo-circ-rounds" value="${b.rounds ?? ''}"></label>
        <label class="gcwo-field gcwo-field-sm"><span>Descanso entre voltas (s)</span><input type="number" min="0" class="gcwo-circ-restrounds" value="${b.rest_between_rounds_s ?? ''}"></label>
      </div>
      <span class="gcwo-field-label" style="margin-top:10px;">Exercícios</span>
      <div class="gcwo-circ-exlist">${(b.exercicios || []).map(renderCircExercicioRow).join('') || '<div class="gcwo-muted">Nenhum exercício ainda.</div>'}</div>
      <button type="button" class="gcwo-add-exercicio gcBtnGhost gcBtnSm" data-add-ex-cbid="${escAttr(b.block_id)}">+ Exercício</button>
    </div>`;
}
function renderCircBlocoFixo(b) {
  return `
    <div class="gcwo-exercicio" data-bid="${escAttr(b.block_id)}">
      <div class="gcwo-exercicio-head">
        <input type="text" class="gcwo-circ-nome" placeholder="Nome do bloco (ex.: Mobilização geral)" value="${escAttr(b.name)}" style="flex:1;">
        <button type="button" class="gcwo-exercicio-remove" data-remove-cbid="${escAttr(b.block_id)}" title="Remover bloco">✕</button>
      </div>
      <div style="margin-top:8px;">${campoDuracaoMMSS('gcwo-circ-fixodur', b.duration_sec, 'Duração')}</div>
    </div>`;
}
function renderCircBloco(b) {
  return b.tipo === 'fixed' ? renderCircBlocoFixo(b) : renderCircBlocoVoltas(b);
}
function renderCircBlocosListInner(s) {
  if (!s.blocks.length) return `<div class="gcwo-muted">Nenhum bloco adicionado ainda.</div>`;
  return s.blocks.map(renderCircBloco).join('');
}

function renderPanelCircuito(s) {
  return `
    <label class="gcwo-field gcwo-field-sm"><span>Limite de tempo (min, opcional)</span><input type="number" min="0" id="gcwoPCircLimite" value="${s._limiteMin ?? ''}"></label>
    <div id="gcwoPTempoTotal">${renderTempoTotalCircuitoHtml(s)}</div>
    <span class="gcwo-field-label" style="margin-top:14px;">Blocos</span>
    <div class="gcwo-exercicios" id="gcwoPCircBlocosList">${renderCircBlocosListInner(s)}</div>
    <div class="gcwo-exercicio-add">
      <button type="button" class="gcBtnGhost gcBtnSm" id="gcwoPAddBlocoVoltas">+ Bloco de voltas</button>
      <button type="button" class="gcBtnGhost gcBtnSm" id="gcwoPAddBlocoFixo">+ Bloco de duração fixa</button>
    </div>
  `;
}

function refreshCircBlocosListDom(s) {
  const host = document.getElementById('gcwoPCircBlocosList');
  if (host) host.innerHTML = renderCircBlocosListInner(s);
  wireCircBlocosList(s);
  refreshTempoTotalCircuito(s);
}

function wireCircBlocosList(s) {
  document.querySelectorAll('#gcwoPCircBlocosList [data-remove-cbid]').forEach(btn => {
    btn.addEventListener('click', () => {
      const bid = btn.getAttribute('data-remove-cbid');
      s.blocks = s.blocks.filter(b => b.block_id !== bid);
      refreshCircBlocosListDom(s);
    });
  });
  document.querySelectorAll('#gcwoPCircBlocosList [data-add-ex-cbid]').forEach(btn => {
    btn.addEventListener('click', () => {
      const bid = btn.getAttribute('data-add-ex-cbid');
      const b = s.blocks.find(x => x.block_id === bid);
      if (!b) return;
      b.exercicios.push(novoExercicioCircuito());
      refreshCircBlocosListDom(s);
    });
  });
  document.querySelectorAll('#gcwoPCircBlocosList .gcwo-exercicio').forEach(card => {
    const bid = card.getAttribute('data-bid');
    const b = s.blocks.find(x => x.block_id === bid);
    if (!b) return;

    card.querySelector('.gcwo-circ-nome').addEventListener('input', (e) => { b.name = e.target.value; });

    const roundsEl = card.querySelector('.gcwo-circ-rounds');
    if (roundsEl) roundsEl.addEventListener('input', (e) => { b.rounds = e.target.value === '' ? null : Number(e.target.value); refreshTempoTotalCircuito(s); });

    const restRoundsEl = card.querySelector('.gcwo-circ-restrounds');
    if (restRoundsEl) restRoundsEl.addEventListener('input', (e) => { b.rest_between_rounds_s = e.target.value === '' ? null : Number(e.target.value); refreshTempoTotalCircuito(s); });

    wireDuracaoMMSS(card, 'gcwo-circ-fixodur', (sec) => { b.duration_sec = sec; refreshTempoTotalCircuito(s); });

    card.querySelectorAll('.gcwo-circ-exrow').forEach(row => {
      const exid = row.getAttribute('data-exid');
      const ex = (b.exercicios || []).find(x => x.id === exid);
      if (!ex) return;

      row.querySelector('[data-remove-exid]')?.addEventListener('click', () => {
        b.exercicios = b.exercicios.filter(x => x.id !== exid);
        refreshCircBlocosListDom(s);
      });

      const picker = row.querySelector('.gcwo-circ-ex-picker');
      const grid = row.querySelector('.gcwo-circ-ex-grid');
      const search = row.querySelector('.gcwo-circ-ex-search');
      const wireGridCards = () => {
        grid.querySelectorAll('[data-pick-exercise]').forEach(btn => {
          btn.addEventListener('click', () => {
            const catEx = _state.exercisesCatalog.find(c => c.id === btn.getAttribute('data-pick-exercise'));
            ex.exercise_id = catEx ? catEx.id : null;
            ex.name = catEx ? catEx.name : '';
            refreshCircBlocosListDom(s);
          });
        });
      };
      row.querySelector('.gcwo-circ-ex-trocar').addEventListener('click', () => {
        picker.hidden = !picker.hidden;
      });
      search.addEventListener('input', (e) => {
        grid.innerHTML = renderCircExGridHtml(e.target.value);
        wireGridCards();
      });
      wireGridCards();

      row.querySelector('.gcwo-circ-ex-measure').addEventListener('change', (e) => {
        ex.measure = e.target.value;
        ex.value = null;
        refreshCircBlocosListDom(s);
      });
      row.querySelector('.gcwo-circ-ex-value').addEventListener('input', (e) => {
        ex.value = e.target.value === '' ? null : Number(e.target.value);
        refreshTempoTotalCircuito(s);
      });
      row.querySelector('.gcwo-circ-ex-rest').addEventListener('input', (e) => {
        ex.rest_after_s = e.target.value === '' ? null : Number(e.target.value);
        refreshTempoTotalCircuito(s);
      });
    });
  });
}

function wirePanelCircuito(s) {
  document.getElementById('gcwoPAddBlocoVoltas').addEventListener('click', () => { s.blocks.push(novoBlocoCircuitoVoltas()); refreshCircBlocosListDom(s); });
  document.getElementById('gcwoPAddBlocoFixo').addEventListener('click', () => { s.blocks.push(novoBlocoCircuitoFixo()); refreshCircBlocosListDom(s); });
  document.getElementById('gcwoPCircLimite').addEventListener('input', (e) => {
    s._limiteMin = e.target.value === '' ? null : Number(e.target.value);
    refreshTempoTotalCircuito(s);
  });
  wireCircBlocosList(s);
  refreshTempoTotalCircuito(s);
}

// Converte o modelo de edição (rounds/exercícios) em `intervals` já expandido — o que
// fica gravado em wo_prescriptions.data. Nunca o inverso: rounds/exercicios nunca é
// persistido (decisão de 8 de agosto de 2026). Um descanso nunca fica sem contexto —
// carrega sempre o exercício associado (o que acabou de fazer, ou o que vem a seguir
// no caso do descanso entre voltas), para o cronómetro do doente nunca mostrar
// "Descanso" sozinho.
function flattenBlocosCircuitoParaGravar(blocks) {
  return (blocks || []).map(b => {
    if (b.tipo === 'fixed') {
      return {
        block_id: b.block_id,
        name: b.name,
        intervals: [{
          type: 'mobilizacao', label: b.name, duration_sec: b.duration_sec,
          exercise_id: null, exercise_name: null, photo_url: null, video_url: null, tecnica_notas: null,
          exercise_index: null, exercise_total: null, round_index: null, round_total: null,
        }],
      };
    }
    const intervals = [];
    const R = b.rounds || 1;
    const exs = b.exercicios || [];
    for (let r = 1; r <= R; r++) {
      exs.forEach((ex, ei) => {
        const catEx = _state.exercisesCatalog.find(c => c.id === ex.exercise_id);
        const { segundos } = duracaoTrabalhoExercicioCircuito(ex);
        intervals.push({
          type: 'trabalho', label: ex.name, duration_sec: Math.round(segundos),
          exercise_id: ex.exercise_id, exercise_name: ex.name,
          photo_url: catEx?.photo_url || null, video_url: catEx?.video_url || null, tecnica_notas: catEx?.tecnica_notas || null,
          exercise_index: ei + 1, exercise_total: exs.length, round_index: r, round_total: R,
        });
        if (ex.rest_after_s) {
          intervals.push({
            type: 'descanso', label: ex.name, duration_sec: ex.rest_after_s,
            exercise_id: ex.exercise_id, exercise_name: ex.name,
            photo_url: catEx?.photo_url || null, video_url: catEx?.video_url || null, tecnica_notas: catEx?.tecnica_notas || null,
            exercise_index: ei + 1, exercise_total: exs.length, round_index: r, round_total: R,
          });
        }
      });
      if (r < R && b.rest_between_rounds_s) {
        const proximo = exs[0] || null;
        const catProx = proximo ? _state.exercisesCatalog.find(c => c.id === proximo.exercise_id) : null;
        intervals.push({
          type: 'descanso', label: proximo ? proximo.name : b.name, duration_sec: b.rest_between_rounds_s,
          exercise_id: proximo ? proximo.exercise_id : null, exercise_name: proximo ? proximo.name : null,
          photo_url: catProx?.photo_url || null, video_url: catProx?.video_url || null, tecnica_notas: catProx?.tecnica_notas || null,
          exercise_index: proximo ? 1 : null, exercise_total: exs.length || null, round_index: r + 1, round_total: R,
        });
      }
    }
    return { block_id: b.block_id, name: b.name, intervals };
  });
}

function showPanelErro(msg) {
  const el = document.getElementById('gcwoPErro');
  if (el) el.textContent = msg;
}

function handleGuardarSessao() {
  const s = _panelDraft;
  showPanelErro('');

  if (!s.local) { showPanelErro('Falta escolher o local desta sessão.'); return; }
  if (s.kind === 'list' && !s.items.length) { showPanelErro('Adiciona pelo menos um exercício.'); return; }
  if (s.kind === 'walk' && !sessaoTemConteudo(s)) { showPanelErro('Adiciona pelo menos uma caminhada ou lanços de escadas.'); return; }
  if ((s.kind === 'card' || s.kind === 'circuit') && !s.blocks.length) { showPanelErro('Adiciona pelo menos um bloco.'); return; }

  if (_panelIsNovo) {
    _state.sessions.push(s);
  } else {
    const idx = _state.sessions.findIndex(x => x.session_id === s.session_id);
    if (idx >= 0) _state.sessions[idx] = s;
  }

  fecharPanel();
  updateGerarButtonState();
}

/* ── "Gerar prescrição e link" — só activo com pelo menos uma sessão com exercícios ── */
function hasSessionComExercicios() {
  return _state.sessions.some(sessaoTemConteudo);
}
function updateGerarButtonState() {
  const btn = document.getElementById('gcwoGerar');
  if (!btn) return;
  const ok = hasSessionComExercicios();
  btn.disabled = !ok;
  btn.title = ok ? '' : 'Adiciona pelo menos uma sessão com conteúdo para gerar o link.';
  // Usa style.display em vez do atributo "hidden" de propósito — já tivemos um bug em
  // que um CSS com a mesma especificidade do que [hidden] anulava o "hidden" (9 ago
  // 2026, menu ⋮). style.display inline ganha sempre, sem essa armadilha.
  const aviso = document.getElementById('gcwoPorGravarAviso');
  if (aviso) aviso.style.display = haSessoesPorGravar() ? '' : 'none';
}

/* ── Fim do plano às 23:59:59 em Europe/Lisbon — independente do fuso do browser ── */
function lisbonOffsetMinutesAt(utcDate) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Lisbon', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(utcDate).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  const asUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUTC - utcDate.getTime()) / 60000);
}
function hojeEmLisboa() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date()).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  return { year: +parts.year, month: +parts.month, day: +parts.day };
}
// expires_at real = endDate às 23:59:59 em Europe/Lisbon (Fase A, 9 ago 2026) — já não
// se deriva de "N semanas a partir de hoje": startDate/endDate são datas reais e não
// mudam consoante o dia em que o Morais grava, por isso substitui computeExpiresAt(weeks).
function expiresAtDeIso(iso) {
  const d = dataDeIso(iso);
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1, dd = d.getUTCDate();
  const offsetMin = lisbonOffsetMinutesAt(new Date(Date.UTC(y, m - 1, dd, 12, 0, 0))); // meio-dia UTC só para apurar o offset desse dia (evita bordas de DST à meia-noite)
  return new Date(Date.UTC(y, m - 1, dd, 23, 59, 59) - offsetMin * 60000);
}
function fmtDataPtLisboa(date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(date).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  return `${+parts.day} de ${MESES_PT[+parts.month - 1]} de ${parts.year}`;
}

/* ================================================================
   Gravação — monta o snapshot e grava em wo_prescriptions
   ================================================================ */
// Forma da Fase A (9 ago 2026): startDate/endDate/dataRevisao/duracaoSessaoPadrao/
// diasPorSemanaHabitual/restricoes/sessions (session_id/date/order/kind/modality/local/
// momento + contentor próprio do kind — já não há week/day). Circuito grava sempre
// `intervals` já expandido — o `rounds`/`exercicios` é só o modelo do ecrã de edição,
// nunca o que fica na base de dados (decisão de 8 de agosto de 2026).
function sessaoParaGravar(s) {
  const base = { session_id: s.session_id, date: s.date, order: s.order, kind: s.kind, modality: s.modality, local: s.local, momento: s.momento || null };
  if (s.kind === 'walk') return { ...base, walks: s.walks, stairs_flights: s.stairs_flights };
  if (s.kind === 'circuit') return { ...base, blocks: flattenBlocosCircuitoParaGravar(s.blocks) };
  if (s.kind === 'card' && s.modality === 'Natação') {
    return { ...base, blocks: s.blocks, pool_length_m: s.pool_length_m ?? 25, stroke: s.stroke ?? 'crol' };
  }
  if (s.kind === 'card') return { ...base, blocks: s.blocks };
  return { ...base, items: s.items };
}
function buildFinalData() {
  return {
    startDate: _state.startDate,
    endDate: _state.endDate,
    dataRevisao: _state.dataRevisao,
    duracaoSessaoPadrao: _state.duracaoSessaoPadrao,
    diasPorSemanaHabitual: _state.diasPorSemanaHabitual,
    restricoes: restricoesAtuais(),
    sessions: _state.sessions.map(sessaoParaGravar),
  };
}

// Chave de "slot" para casar sessões novas com as já existentes na prescrição activa —
// só entra em jogo quando o ecrã NÃO carregou o plano activo para edição directa (ver
// carregarPlanoActivoSeExistir(), 9 ago 2026: doente novo, ou o plano activo mudou de id
// a meio da edição). Nesse cenário date+order é a única correspondência disponível —
// fiável quando há uma sessão por dia, mas pode falhar se um dia tiver várias sessões
// numa ordem diferente da versão anterior. Nesse caso a sessão fica tratada como nova
// (session_id próprio).
function chaveSessao(s) {
  return `${s.date}|${s.order}`;
}

// Fusão "às cegas" (secção 5 do briefing) — só usada quando o ecrã não carregou o plano
// activo (ver editandoPlanoCarregado em handleGerar): preserva session_id das sessões que
// correspondem a um slot já existente (para os registos do doente continuarem ligados
// à sessão certa) e nunca apaga em silêncio uma sessão antiga que não voltou a aparecer
// nesta gravação. Quando o plano activo FOI carregado para edição, esta função deixa de
// ser chamada — o ecrã já mostra tudo, por isso apagar no calendário deve mesmo apagar.
function mesclarSessoes(existentes, novas) {
  const porChave = new Map();
  (existentes || []).forEach(s => porChave.set(chaveSessao(s), s));

  const chavesUsadas = new Set();
  const resultado = novas.map(nova => {
    const chave = chaveSessao(nova);
    const existente = porChave.get(chave);
    chavesUsadas.add(chave);
    return existente ? { ...nova, session_id: existente.session_id } : nova;
  });

  (existentes || []).forEach(s => {
    if (!chavesUsadas.has(chaveSessao(s))) resultado.push(s);
  });

  return resultado;
}

function validarPrescricao() {
  if (!_state.clinicId) return 'Falta selecionar a clínica.';
  if (!_state.patient) return 'Falta selecionar o doente.';
  if (!_state.startDate || !_state.endDate) return 'Falta escolher as datas do plano.';
  if (_state.endDate < _state.startDate) return 'A data de fim não pode ser antes da data de início.';
  if (!_state.sessions.length) return 'Adiciona pelo menos uma sessão.';
  for (const s of _state.sessions) {
    if (!s.local) return 'Há uma sessão sem local escolhido.';
  }
  return null;
}

async function handleGerar() {
  const btn = document.getElementById('gcwoGerar');
  const erroEl = document.getElementById('gcwoGerarErro');
  erroEl.textContent = '';

  const problema = validarPrescricao();
  if (problema) { erroEl.textContent = problema; return; }

  btn.disabled = true;
  btn.textContent = 'A gravar…';

  // Guarda todos os tokens que passem a ser conhecidos durante a gravação (o candidato
  // novo e, se existir, o da prescrição activa encontrada) para o catch conseguir sempre
  // escrubá-los da mensagem de erro — nunca aparecem em logs.
  const tokensAEscrubar = [];
  try {
    const tokenCandidato = uuid(); // aleatório (crypto.randomUUID), não sequencial
    tokensAEscrubar.push(tokenCandidato);

    // Edição de plano activo (secção 5 do briefing): havendo já uma prescrição activa
    // (não expirada, não revogada) para este doente, actualiza essa linha em vez de criar
    // outra — o link que o doente já tem continua a funcionar. Só cria linha nova quando
    // não há nenhuma activa, ou depois de o Morais revogar a anterior explicitamente.
    const { data: activaExistente, error: erroActiva } = await window.sb
      .from('wo_prescriptions')
      .select('id, token, data, expires_at')
      .eq('patient_id', _state.patient.id)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (erroActiva) throw new Error(`Falha ao verificar prescrição activa: ${erroActiva.message || erroActiva}`);

    const novaData = buildFinalData();
    const expiresAtNovo = expiresAtDeIso(_state.endDate);
    let token, linkExpiresAt;

    if (activaExistente) {
      tokensAEscrubar.push(activaExistente.token);

      // Se este ecrã carregou este MESMO plano activo para edição directa (9 ago 2026),
      // o que está em _state.sessions já É a lista completa e verdadeira — incluindo o
      // que o Morais tenha apagado no calendário. Gravar sobrepõe tal e qual, sem fundir
      // por chave data+ordem: essa fusão só existe para proteger o caso em que o
      // ecrã NUNCA mostrou o que já lá estava, o que deixou de acontecer aqui.
      const editandoPlanoCarregado = _state.activePrescriptionId === activaExistente.id;

      const sessoesFinais = editandoPlanoCarregado
        ? novaData.sessions
        : mesclarSessoes(activaExistente.data?.sessions, novaData.sessions);
      const expiresAtExistente = new Date(activaExistente.expires_at);
      const expiresAtFinal = editandoPlanoCarregado
        ? expiresAtNovo
        : (expiresAtNovo > expiresAtExistente ? expiresAtNovo : expiresAtExistente);
      // Fora do caso "plano carregado": o ecrã nunca viu os campos reais deste plano
      // (startDate/dataRevisao/etc.), por isso preserva os que já lá estavam em vez de
      // gravar por cima os valores por omissão de um "plano novo" que nunca foi este.
      const dataFinal = editandoPlanoCarregado
        ? novaData
        : {
            ...novaData,
            startDate: activaExistente.data?.startDate || novaData.startDate,
            dataRevisao: activaExistente.data?.dataRevisao ?? novaData.dataRevisao,
            duracaoSessaoPadrao: activaExistente.data?.duracaoSessaoPadrao ?? novaData.duracaoSessaoPadrao,
            diasPorSemanaHabitual: activaExistente.data?.diasPorSemanaHabitual ?? novaData.diasPorSemanaHabitual,
            sessions: sessoesFinais,
          };

      const { error } = await window.sb.from('wo_prescriptions')
        .update({
          clinic_id: _state.clinicId,
          created_by: G.sessionUser.id,
          expires_at: expiresAtFinal.toISOString(),
          data: dataFinal,
        })
        .eq('id', activaExistente.id);
      if (error) throw new Error(`Falha ao actualizar prescrição: ${error.message || error}`);

      token = activaExistente.token;
      linkExpiresAt = expiresAtFinal;
    } else {
      token = tokenCandidato;
      const { error } = await window.sb.from('wo_prescriptions').insert({
        token,
        patient_id: _state.patient.id,
        clinic_id: _state.clinicId,
        created_by: G.sessionUser.id,
        expires_at: expiresAtNovo.toISOString(),
        data: novaData,
      });
      if (error) throw new Error(`Falha ao gravar prescrição: ${error.message || error}`);
      linkExpiresAt = expiresAtNovo;
    }

    _state.savedLink = TREINO_BASE_URL + token;
    _state.savedExpiresAt = linkExpiresAt;
    _state.__ultimoSnapshotGravado = JSON.stringify(_state.sessions);
    renderStep3();
  } catch (err) {
    // Nenhum token aparece em logs nem em mensagens de erro — mesmo na (muitíssimo improvável)
    // colisão do índice único de token, a mensagem do Postgres viria com o valor lá dentro.
    let safeMsg = err?.message || String(err);
    tokensAEscrubar.forEach((t) => { safeMsg = safeMsg.split(t).join('«token»'); });
    console.error('[prescricao] erro a gravar prescrição:', safeMsg);
    erroEl.textContent = 'Erro ao gravar: ' + safeMsg;
    btn.disabled = false;
    btn.textContent = 'Gerar prescrição e link';
  }
}

/* ================================================================
   PASSO 3 — link gerado
   ================================================================ */
function renderStep3() {
  const root = document.getElementById('gcwoPrescricaoRoot');
  if (!root) return;

  const validadeTxt = _state.savedExpiresAt
    ? `Link válido até às 23:59 de ${fmtDataPtLisboa(_state.savedExpiresAt)} (Europe/Lisbon).`
    : '';

  root.innerHTML = `
    <div class="gc-page-header">
      <div><div class="gc-page-title">Prescrição de exercício</div><div class="gc-page-sub">${escHtml(_state.patient?.full_name || '')} — prescrição gravada</div></div>
      ${topActionsHtml()}
    </div>
    <div class="gcwo-card gcwo-success">
      <p>${escHtml(validadeTxt)}</p>
      <div class="gcwo-linkbox">
        <input type="text" id="gcwoLink" readonly value="${escAttr(_state.savedLink)}">
        <button type="button" id="gcwoCopiar" class="gcBtnPrimary">Copiar</button>
        <button type="button" id="gcwoWhatsapp" class="gcBtnOutline">WhatsApp</button>
      </div>
      <span id="gcwoCopiadoMsg" class="gcwo-copiado"></span>
    </div>
    <div class="gcwo-generate">
      <button type="button" id="gcwoNova" class="gcBtnOutline">Nova prescrição</button>
    </div>
  `;
  wireTopActions();

  document.getElementById('gcwoCopiar').addEventListener('click', async () => {
    const inp = document.getElementById('gcwoLink');
    try {
      await navigator.clipboard.writeText(_state.savedLink);
      const msg = document.getElementById('gcwoCopiadoMsg');
      msg.textContent = 'Copiado ✓';
      setTimeout(() => { msg.textContent = ''; }, 2000);
    } catch (err) {
      console.error('[prescricao] falha a copiar link.'); // nunca regista o link (contém o token)
      inp.select();
    }
  });

  // Mensagem neutra — sem nome, diagnóstico ou restrições clínicas (o link chega ao telemóvel do doente).
  // Sem número de destino, como o resto da app (wa.me/?text=…) — abre o WhatsApp para o Morais escolher o contacto.
  document.getElementById('gcwoWhatsapp').addEventListener('click', () => {
    const msg = encodeURIComponent(`O seu plano de exercício está disponível aqui: ${_state.savedLink}`);
    const w = window.open(`https://wa.me/?text=${msg}`, '_blank');
    if (!w) prompt('O browser bloqueou a janela do WhatsApp. Copia o link e envia à mão:', _state.savedLink);
  });

  document.getElementById('gcwoNova').addEventListener('click', () => {
    initPrescricao();
  });
}
