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

const MODALIDADES = ['Corrida', 'Ciclismo', 'Natação', 'Remo', 'Caminhada', 'Elíptica', 'Escadas', 'Trail', 'Ski', 'Outro'];

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
const ICON_MAIS = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M10 4v12M4 10h12"/></svg>`;
const ICON_PENCIL = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12.5 3.5l4 4L6 18H2v-4L12.5 3.5z"/></svg>`;
const ICON_TRASH = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h12M8 6V4.5A1.5 1.5 0 019.5 3h1A1.5 1.5 0 0112 4.5V6m-6.5 0L6 16.5A1.5 1.5 0 007.5 18h5a1.5 1.5 0 001.5-1.5L14.5 6"/></svg>`;
const ICON_CLOSE = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 5l10 10M15 5L5 15"/></svg>`;
const ICON_FLAG = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17V3.8c2.6-1.2 4.6-1.2 7 0s4.4 1.2 5.6.5V11c-2.6 1.2-4.6 1.2-7 0s-4.4-1.2-5.6-.5"/></svg>`;
const ICON_CLOCK = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="7.2"/><path d="M10 6v4l2.6 1.6"/></svg>`;
const ICON_RULER = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 13l4-4 10 10-4 4-10-10z"/><path d="M8 9l1.5 1.5M10.5 6.5L12 8M13 4l1.5 1.5"/></svg>`;
const ICON_CAMINHADA = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11.5" cy="3.6" r="1.4" fill="currentColor" stroke="none"/><path d="M9 6l3 2-1 3 3 3M11 8l-3 1-2 4M8 11l-2.5 1.5"/></svg>`;
const ICON_CIRCUITO = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8a6 6 0 0110-4.5M16 12a6 6 0 01-10 4.5"/><path d="M13 2l1.5 1.5L13 5M7 18l-1.5-1.5L7 15"/></svg>`;

// kind por sessão: só 'list' (ginásio) está activo — 'card'/'walk'/'circuit' ficam para os Passos 4/5 (secção 5 do briefing).
const SESSAO_MODALIDADES = [
  { modality: 'Ginásio',   kind: 'list',    enabled: true },
  { modality: 'Corrida',   kind: 'card',    enabled: true },
  { modality: 'Ciclismo',  kind: 'card',    enabled: true },
  { modality: 'Natação',   kind: 'card',    enabled: true },
  { modality: 'Caminhada', kind: 'walk',    enabled: true },
  { modality: 'Circuito',  kind: 'circuit', enabled: true },
];
const LOCAIS_SESSAO = ['Ginásio', 'Casa', 'Clínica'];
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
  if (document.querySelector('link[data-gcwo-prescricao]')) return;
  const lnk = document.createElement('link');
  lnk.rel = 'stylesheet';
  lnk.href = new URL('./prescricao.css', import.meta.url).href;
  lnk.dataset.gcwoPrescricao = '1';
  document.head.appendChild(lnk);
}

/* ── Estado local do módulo ─────────────────────────────── */
function freshState() {
  return {
    clinicId: null,
    patient: null,
    exercisesCatalog: [],
    catalogLoaded: false,
    sessions: [],
    selectedWeek: 1,
    selectedDay: 'seg',
    restricoesPredefinidas: [],
    restricoesTexto: '',
    restricoesEditing: false,
    planWeeks: null,
    savedLink: null,
    savedExpiresAt: null,
  };
}
let _state = freshState();
let _expandedCardIds = new Set();       // sessões expandidas na lista principal (leitura)
let _panelExpandedTarefaId = null;      // dentro do painel, tarefa expandida (só uma)
let _panelDraft = null;                 // clone de trabalho da sessão em edição — null = painel fechado
let _panelIsNovo = false;
let _panelCatalogFiltro = 'favoritos';  // filtro do catálogo dentro do painel de ginásio
let _panelCatalogBusca = '';
let _copyWeekOpen = false;              // "Copiar semana N para as outras" — painel aberto/fechado
let _copyWeekSelected = new Set();      // semanas de destino marcadas no painel de cópia
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

function restricoesAtuais() {
  const lista = [..._state.restricoesPredefinidas];
  const texto = (_state.restricoesTexto || '').trim();
  if (texto) lista.push(texto);
  return lista;
}

const MESES_PT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
function fmtDataPt(d) {
  return `${d.getDate()} de ${MESES_PT[d.getMonth()]} de ${d.getFullYear()}`;
}
// Janela de datas do plano — só pré-visualização; expires_at real é calculado no momento de gerar o link (Passo 1g).
function fmtJanelaPlano(semanas) {
  const dias = semanas * 7;
  const inicio = new Date(); inicio.setHours(0, 0, 0, 0);
  const fim = new Date(inicio); fim.setDate(fim.getDate() + dias - 1);
  const aviso = new Date(fim); aviso.setDate(aviso.getDate() - 4);
  return `${dias} dias · válido de ${fmtDataPt(inicio)} a ${fmtDataPt(fim)} · aviso a partir de ${fmtDataPt(aviso)}`;
}

function tarefaSummaryText(t) {
  const parts = [];
  if (t.medida === 'distancia' && t.distancia_m != null) {
    parts.push(t.series > 1 ? `${t.series}×${t.distancia_m}m` : `${t.distancia_m}m`);
  } else if (t.medida === 'tempo' && t.duracao_min != null) {
    const dLabel = `${fmtNum(t.duracao_min)}'`;
    parts.push(t.series > 1 ? `${t.series}×${dLabel}` : dLabel);
  }
  if (t.zona) parts.push(t.zona);
  if (t.intensidade.ritmo) parts.push(t.intensidade.ritmo);
  if (t.intensidade.fc_bpm != null) parts.push(`FC ${t.intensidade.fc_bpm}bpm`);
  if (t.descanso) parts.push(t.descanso);
  if (t.nota) parts.push(t.nota);
  return parts.join(' · ');
}
function tarefaVolumeLabelReadonly(t) {
  if (t.medida === 'distancia' && t.distancia_m != null) {
    return t.series > 1 ? `${t.series} x ${t.distancia_m} m` : `${t.distancia_m} m`;
  }
  if (t.medida === 'tempo' && t.duracao_min != null) {
    const lbl = `${fmtNum(t.duracao_min)}'`;
    return t.series > 1 ? `${t.series} x ${lbl}` : lbl;
  }
  return '—';
}

function calcTotaisModalidade(m) {
  let totalDistM = 0, hasDist = false;
  let totalTempoS = 0, hasTempo = false;
  m.tarefas.forEach(t => {
    const series = t.series || 1;
    if (t.medida === 'distancia' && t.distancia_m != null) { totalDistM += series * t.distancia_m; hasDist = true; }
    if (t.medida === 'tempo' && t.duracao_min != null) { totalTempoS += series * t.duracao_min * 60; hasTempo = true; }
  });
  return { totalDistM, hasDist, totalTempoS, hasTempo };
}

function sessionResumoTexto(s) {
  if (s.tipo === 'ginasio') {
    const nEx = s.ginasio.exercicios.length;
    const nSeries = s.ginasio.exercicios.reduce((a, e) => a + e.series.length, 0);
    return `${nEx} exercício${nEx === 1 ? '' : 's'} · ${nSeries} série${nSeries === 1 ? '' : 's'}`;
  }
  const { totalDistM, hasDist, totalTempoS, hasTempo } = calcTotaisModalidade(s.modalidade);
  const parts = [];
  if (hasTempo) parts.push(fmtDuracaoTotal(totalTempoS));
  if (hasDist) parts.push(fmtDistanciaTotal(totalDistM).replace(/ \(.*\)/, '')); // versão curta no resumo do cartão
  return parts.join(' · ') || 'Sem tarefas';
}

function novaTarefa() {
  return {
    id: uuid(),
    series: 1,
    medida: 'distancia',       // "distancia" | "tempo"
    distancia_m: null,
    duracao_min: null,          // convertido para duracao_s (segundos) só na gravação
    zona: '',                   // texto livre — "Z3", "Z1-Z2", "Z1→Z4"
    intensidade: { ritmo: '', fc_bpm: null, potencia_w: null, cadencia_rpm: null, rpe: null },
    descanso: '',                // texto livre — "3'", "Z3 a 5:30"
    nota: '',
  };
}
function novoModalidadeDefault() {
  return {
    modalidade: 'Corrida',
    modalidadeOutro: '',
    tarefas: [],
  };
}
function novaSessao(tipo) {
  return {
    id: uuid(),
    nome: '',
    tipo,                       // "ginasio" | "modalidade"
    frequencia_semanal: tipo === 'ginasio' ? 2 : 3,
    dia_sugerido: null,         // opcional — sugestão visível, não bloqueia o doente
    nota_geral: '',
    ginasio: { exercicios: [] },
    modalidade: novoModalidadeDefault(),
  };
}
// Sessão nova (secção 5): session_id/week/day/order/kind/modality/local + o contentor
// próprio de cada kind — items (ginásio), blocks (cardio/circuito) ou walks+stairs_flights (caminhada).
function novaSessaoSkeleton(modality, kind, week, day) {
  const sessoesNoDia = _state.sessions.filter(s => s.week === week && s.day === day);
  const base = {
    session_id: uuid(),
    week,
    day,
    order: sessoesNoDia.length,
    kind,
    modality,
    local: null,
  };
  if (kind === 'walk') return { ...base, walks: [], stairs_flights: null };
  if (kind === 'card' || kind === 'circuit') return { ...base, blocks: [] };
  return { ...base, items: [] };
}
function novoExercicioGinasio() {
  return {
    id: uuid(),
    exercicio_id: null,
    nome: '',
    categoria: '',
    foto_url: null,
    tempo_concentrico_s: null,
    tempo_excentrico_s: null,
    ajustes_maquina: [],
    series: [{ serie: 1, reps: null, peso_kg: null }],
    descanso_s: 60,
    nota: '',
  };
}
function cloneSession(s) {
  return structuredClone(s);
}

/* ── Entry point ─────────────────────────────────────────── */
export async function initPrescricao() {
  const root = document.getElementById('gcwoPrescricaoRoot');
  if (!root) return;

  ensurePrescricaoCss();
  _state = freshState();
  _expandedCardIds = new Set();
  _panelExpandedTarefaId = null;
  _panelDraft = null;
  _panelIsNovo = false;
  _historyOpen = false;
  _historyDetail = null;
  document.getElementById('gcwoHistoryOverlay')?.remove();

  const clinicas = G.clinics || [];
  if (clinicas.length === 1) _state.clinicId = clinicas[0].id;

  loadExercisesCatalog(); // não bloqueia o primeiro render

  renderStep1();
}

/* ── Catálogo de exercícios (wo_exercises, global ao sistema) ── */
async function loadExercisesCatalog() {
  const { data, error } = await window.sb
    .from('wo_exercises')
    .select('id,name,categoria,photo_url,tempo_concentrico_s,tempo_excentrico_s,tempo_exercicio_s,ajustes_maquina,is_favorite,incremento_default,video_url,tecnica_notas')
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

function iniciaisClinica(nome) {
  return String(nome || '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

/* ================================================================
   PASSO 1 — clínica (cartões) + pesquisa/seleção de doente
   ================================================================ */
function renderStep1() {
  const root = document.getElementById('gcwoPrescricaoRoot');
  if (!root) return;

  const clinicas = G.clinics || [];
  const clinicaEscolhida = clinicas.find(c => c.id === _state.clinicId) || null;

  const clinicCardsHtml = clinicas.map(c => `
    <button type="button" class="gcwo-clinic-card" data-id="${escAttr(c.id)}">
      <span class="avatar">${escHtml(iniciaisClinica(c.name || c.slug))}</span>
      <span class="name">${escHtml(c.name || c.slug || c.id)}</span>
    </button>
  `).join('');

  root.innerHTML = `
    <div class="gc-page-header">
      <div><div class="gc-page-title">Prescrição de exercício</div><div class="gc-page-sub">Nova prescrição</div></div>
      ${topActionsHtml()}
    </div>
    <div class="gcwo-step1-wrap">
      <div class="gcwo-step1-card">
        <p class="gcwo-step1-intro">Cria uma prescrição de exercício para um doente — sessões de ginásio ou de modalidade, com tarefas e séries — e gera um link de acesso sem login para ele seguir o plano.</p>

        <div id="gcwoClinicStage" ${clinicaEscolhida ? 'hidden' : ''}>
          <span class="gcwo-field-label">Escolhe a clínica</span>
          <div class="gcwo-clinicgrid" id="gcwoClinicGrid">${clinicCardsHtml}</div>
        </div>

        <div id="gcwoPatientStage" ${clinicaEscolhida ? '' : 'hidden'}>
          <div class="gcwo-step1-selectedclinic">
            <span>Clínica: <strong id="gcwoSelectedClinicName">${clinicaEscolhida ? escHtml(clinicaEscolhida.name || clinicaEscolhida.slug || '') : ''}</strong></span>
            <button type="button" class="gcwo-linkbtn" id="gcwoBtnTrocarClinica">Trocar</button>
          </div>
          <span class="gcwo-field-label">Procura o doente</span>
          <div class="gc-search-bar">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5.5" stroke="#94a3b8" stroke-width="1.4"/><path d="M11 11l3 3" stroke="#94a3b8" stroke-width="1.4" stroke-linecap="round"/></svg>
            <input id="gcwoPatientQuery" type="search" class="gc-search-input" placeholder="Nome, SNS, NIF, Telefone…" autocomplete="off" spellcheck="false">
          </div>
          <div id="gcwoPatientResults" class="gcwo-results" style="display:none;"></div>
        </div>
      </div>
    </div>
  `;
  wireTopActions();

  document.getElementById('gcwoClinicGrid').querySelectorAll('[data-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      _state.clinicId = btn.getAttribute('data-id');
      const c = clinicas.find(x => x.id === _state.clinicId);
      document.getElementById('gcwoSelectedClinicName').textContent = c?.name || c?.slug || '';
      document.getElementById('gcwoClinicStage').hidden = true;
      document.getElementById('gcwoPatientStage').hidden = false;
      document.getElementById('gcwoPatientQuery').focus();
    });
  });

  document.getElementById('gcwoBtnTrocarClinica').addEventListener('click', () => {
    _state.clinicId = null;
    document.getElementById('gcwoPatientStage').hidden = true;
    document.getElementById('gcwoClinicStage').hidden = false;
    const rh = document.getElementById('gcwoPatientResults');
    rh.style.display = 'none';
    rh.innerHTML = '';
    document.getElementById('gcwoPatientQuery').value = '';
  });

  const input = document.getElementById('gcwoPatientQuery');
  const resHost = document.getElementById('gcwoPatientResults');

  let timer = null;
  input.addEventListener('input', () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => runPatientSearch(input.value), 250);
  });

  async function runPatientSearch(term) {
    term = (term || '').trim();
    if (!_state.clinicId || term.length < 2) {
      resHost.style.display = 'none';
      resHost.innerHTML = '';
      return;
    }
    resHost.style.display = 'block';
    resHost.innerHTML = `<div class="gcwo-muted">A pesquisar…</div>`;

    const { data, error } = await window.sb.rpc('search_patients_v2', {
      p_clinic_id: _state.clinicId,
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

    resHost.innerHTML = results.map(p => `
      <button type="button" class="gcwo-result-item" data-pid="${escAttr(p.id)}">
        <span class="gcwo-result-name">${escHtml(p.full_name)}</span>
        <span class="gcwo-result-meta">${p.dob ? new Date(p.dob).toLocaleDateString('pt-PT') : '—'}${p.phone ? ' · ' + escHtml(p.phone) : ''}</span>
      </button>
    `).join('');

    resHost.querySelectorAll('[data-pid]').forEach(btn => {
      btn.addEventListener('click', () => {
        const pid = btn.getAttribute('data-pid');
        const p = results.find(r => r.id === pid);
        if (!p) return;
        _state.patient = p;
        renderStep2();
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

/* ── Duração do plano — chips 2/3/4 semanas ──────────────── */
function renderDuracaoSection() {
  const semanas = _state.planWeeks;
  const chipsHtml = [2, 3, 4].map(n => `
    <button type="button" class="gcwo-chip${semanas === n ? ' on' : ''}" data-semanas="${n}">${n} semanas</button>
  `).join('');
  return `
    <section class="gcwo-duracao-section">
      <h2 class="gcwo-section-title">Duração do plano</h2>
      <div class="gcwo-chips" id="gcwoDuracaoChips">${chipsHtml}</div>
      <div class="gcwo-duracao-info" id="gcwoDuracaoInfo">${semanas ? escHtml(fmtJanelaPlano(semanas)) : 'Escolhe a duração do plano.'}</div>
    </section>`;
}
function wireDuracaoSection() {
  document.querySelectorAll('#gcwoDuracaoChips [data-semanas]').forEach(chip => {
    chip.addEventListener('click', () => {
      _state.planWeeks = Number(chip.getAttribute('data-semanas'));
      _state.selectedWeek = 1; // muda a duração pode reduzir o nº de semanas — volta sempre à 1ª
      renderStep2(); // revela (ou reconstrói) o esqueleto de semanas/dias
    });
  });
}

/* ================================================================
   PASSO 2 — plano semanal
   ================================================================ */
function renderStep2() {
  const root = document.getElementById('gcwoPrescricaoRoot');
  if (!root) return;

  const p = _state.patient;
  const semanasEscolhidas = !!_state.planWeeks;
  _copyWeekOpen = false;
  _copyWeekSelected = new Set();
  root.innerHTML = `
    <div class="gc-page-header">
      <div><div class="gc-page-title">Prescrição de exercício</div><div class="gc-page-sub">${escHtml(p.full_name)} <button type="button" class="gcwo-linkbtn" id="gcwoVerHistorico">Ver planos anteriores</button></div></div>
      ${topActionsHtml('<button type="button" class="gcBtnGhost" id="gcwoTrocarDoente">Trocar doente</button>')}
    </div>

    ${renderPatientBanner()}

    <div class="gcwo-plano-body">
      <main class="gcwo-plano-main">
        ${renderDuracaoSection()}

        ${semanasEscolhidas ? `
        <section>
          <h2 class="gcwo-section-title">Semanas e dias</h2>
          <div class="gcwo-weektabs" id="gcwoWeekTabs"></div>
          <div class="gcwo-daystrip" id="gcwoDaystrip"></div>
          ${_state.planWeeks > 1 ? `
          <div class="gcwo-copyweek-trigger">
            <button type="button" class="gcBtnGhost gcBtnSm" id="gcwoBtnCopiarSemana">Copiar semana <span id="gcwoCopiarSemanaNum">${_state.selectedWeek}</span> para as outras</button>
          </div>
          <div class="gcwo-copyweek" id="gcwoCopyWeekPanel" hidden></div>
          ` : ''}
        </section>

        <section>
          <div class="gcwo-daydetail-head">
            <h2 class="gcwo-section-title" id="gcwoDayTitle">—</h2>
            <button type="button" class="gcBtnPrimary" id="gcwoAddSessao">+ Adicionar sessão</button>
          </div>
          <div class="gcwo-sessions" id="gcwoDaySessions"></div>
          <div class="gcwo-addpicker" id="gcwoAddPicker" hidden>
            <span class="gcwo-field-label">Escolher tipo de sessão</span>
            <div class="gcwo-typegrid" id="gcwoTypegrid"></div>
          </div>
        </section>
        ` : `
        <section class="gcwo-card">
          <span class="gcwo-muted">Escolhe a duração do plano, acima, para começares a construir as semanas.</span>
        </section>
        `}

        <div class="gcwo-generate">
          <button type="button" id="gcwoGerar" class="gcBtnSuccess gcBtnLg" ${hasSessionComExercicios() ? '' : 'disabled'} title="${hasSessionComExercicios() ? '' : 'Adiciona pelo menos uma sessão com conteúdo para gerar o link.'}">Gerar prescrição e link</button>
          <span id="gcwoGerarErro" class="gcwo-erro"></span>
        </div>
      </main>

      <aside class="gcwo-panel empty" id="gcwoPanel">Seleciona o lápis numa sessão para editar, ou "+ Adicionar sessão".</aside>
    </div>
  `;

  wireTopActions();
  wirePatientBanner();
  wireDuracaoSection();
  document.getElementById('gcwoVerHistorico').addEventListener('click', () => openHistoryModal());
  document.getElementById('gcwoTrocarDoente').addEventListener('click', () => {
    closeHistoryModal();
    _state.patient = null;
    _state.restricoesPredefinidas = [];
    _state.restricoesTexto = '';
    _state.restricoesEditing = false;
    _state.planWeeks = null;
    _state.sessions = [];
    _state.selectedWeek = 1;
    renderStep1();
  });

  if (semanasEscolhidas) {
    renderTypegrid();
    document.getElementById('gcwoAddSessao').addEventListener('click', () => {
      const picker = document.getElementById('gcwoAddPicker');
      picker.hidden = !picker.hidden;
    });
    renderWeekTabs();
    renderDaystrip();
    renderDayDetail();
    updateGerarButtonState();
    document.getElementById('gcwoBtnCopiarSemana')?.addEventListener('click', () => {
      _copyWeekOpen = !_copyWeekOpen;
      _copyWeekSelected = new Set();
      renderCopyWeekPanel();
    });
  }

  document.getElementById('gcwoGerar').addEventListener('click', handleGerar);

  renderPanel();
}

/* ── Separadores de semana ────────────────────────────────── */
function weekHasSessions(week) {
  return _state.sessions.some(s => s.week === week);
}

function renderWeekTabs() {
  const host = document.getElementById('gcwoWeekTabs');
  if (!host) return;
  const n = _state.planWeeks || 1;
  host.innerHTML = Array.from({ length: n }, (_, i) => i + 1).map(w => `
    <button type="button" class="gcwo-weektab${w === _state.selectedWeek ? ' selected' : ''}" data-week="${w}">Semana ${w}${weekHasSessions(w) ? '<span class="gcwo-weektab-dot" title="Semana alterada"></span>' : ''}</button>
  `).join('');
  host.querySelectorAll('[data-week]').forEach(btn => {
    btn.addEventListener('click', () => {
      _state.selectedWeek = Number(btn.getAttribute('data-week'));
      const picker = document.getElementById('gcwoAddPicker');
      if (picker) picker.hidden = true;
      _copyWeekOpen = false;
      _copyWeekSelected = new Set();
      const copyNum = document.getElementById('gcwoCopiarSemanaNum');
      if (copyNum) copyNum.textContent = _state.selectedWeek;
      const copyPanel = document.getElementById('gcwoCopyWeekPanel');
      if (copyPanel) copyPanel.hidden = true;
      renderWeekTabs();
      renderDaystrip();
      renderDayDetail();
    });
  });
}

/* ── "Copiar semana N para as outras" ────────────────────── */
function renderCopyWeekPanel() {
  const panel = document.getElementById('gcwoCopyWeekPanel');
  if (!panel) return;
  panel.hidden = !_copyWeekOpen;
  if (!_copyWeekOpen) return;

  const source = _state.selectedWeek;
  const destinos = Array.from({ length: _state.planWeeks }, (_, i) => i + 1).filter(w => w !== source);

  panel.innerHTML = `
    <span class="gcwo-field-label">Copiar para</span>
    <div class="gcwo-copyweek-list">
      ${destinos.map(w => {
        const altered = weekHasSessions(w);
        const checked = _copyWeekSelected.has(w);
        return `
          <label class="gcwo-copyweek-item">
            <input type="checkbox" data-week="${w}" ${checked ? 'checked' : ''}>
            <span class="gcwo-copyweek-name">Semana ${w}</span>
            <span class="gcwo-copyweek-status${altered ? ' altered' : ''}">${altered ? 'já tem sessões — marcar substitui só os dias em comum' : 'vazia'}</span>
          </label>`;
      }).join('')}
    </div>
    <div class="gcwo-copyweek-actions">
      <button type="button" class="gcBtnGhost gcBtnSm" id="gcwoCopyWeekTodas">Seleccionar todas</button>
      <span style="flex:1"></span>
      <button type="button" class="gcBtnGhost" id="gcwoCopyWeekCancelar">Cancelar</button>
      <button type="button" class="gcBtnSuccess" id="gcwoCopyWeekConfirmar">Copiar</button>
    </div>
  `;

  panel.querySelectorAll('[data-week]').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const w = Number(cb.getAttribute('data-week'));
      if (e.target.checked) _copyWeekSelected.add(w);
      else _copyWeekSelected.delete(w);
    });
  });
  document.getElementById('gcwoCopyWeekTodas').addEventListener('click', () => {
    const allSelected = destinos.every(w => _copyWeekSelected.has(w));
    _copyWeekSelected = allSelected ? new Set() : new Set(destinos);
    renderCopyWeekPanel();
  });
  document.getElementById('gcwoCopyWeekCancelar').addEventListener('click', () => {
    _copyWeekOpen = false;
    _copyWeekSelected = new Set();
    renderCopyWeekPanel();
  });
  document.getElementById('gcwoCopyWeekConfirmar').addEventListener('click', handleCopiarSemana);
}

// Só copia, por dia, o que a semana de origem tem — dias sem nada na origem ficam
// intocados no destino, mesmo que esse destino já tenha sessões próprias aí.
function copyWeekDayLevel(sourceWeek, destWeek) {
  DIAS_SEMANA.forEach(d => {
    const origem = _state.sessions
      .filter(s => s.week === sourceWeek && s.day === d.value)
      .sort((a, b) => a.order - b.order);
    if (!origem.length) return;

    _state.sessions = _state.sessions.filter(s => !(s.week === destWeek && s.day === d.value));
    origem.forEach((s, idx) => {
      const copy = structuredClone(s);
      copy.session_id = uuid();
      copy.week = destWeek;
      copy.order = idx;
      _state.sessions.push(copy);
    });
  });
}

function handleCopiarSemana() {
  const source = _state.selectedWeek;
  const destinos = [..._copyWeekSelected];
  destinos.forEach(destWeek => copyWeekDayLevel(source, destWeek));

  _copyWeekOpen = false;
  _copyWeekSelected = new Set();
  renderWeekTabs();
  renderDaystrip();
  renderDayDetail();
  updateGerarButtonState();
  const panel = document.getElementById('gcwoCopyWeekPanel');
  if (panel) panel.hidden = true;
}

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
          <p class="gcwo-muted" style="margin-top:0;">A copiar para: Semana ${_state.selectedWeek} do plano actual.</p>
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
    const nSemanas = p.data?.weeks || 0;
    const nSessoes = (p.data?.sessions || []).length;
    const dataTxt = new Date(p.created_at).toLocaleDateString('pt-PT');
    return `
      <button type="button" class="gcwo-history-item" data-id="${escAttr(p.id)}">
        <span class="gcwo-history-date">${dataTxt}</span>
        <span class="gcwo-history-meta">${nSemanas} semana${nSemanas === 1 ? '' : 's'} · ${nSessoes} sessõ${nSessoes === 1 ? 'ão' : 'es'}</span>
        <span class="gcwo-history-status ${info.cls}">${info.label}</span>
      </button>`;
  }).join('');
}

function renderHistoryDetailHtml(p) {
  const nSemanas = p.data?.weeks || 0;
  const sessions = p.data?.sessions || [];
  if (!nSemanas) return `<div class="gcwo-muted">Este plano não tem semanas.</div>`;

  return Array.from({ length: nSemanas }, (_, i) => i + 1).map(w => {
    const semanaSessoes = sessions.filter(s => s.week === w);
    const corpo = semanaSessoes.length
      ? `<ul class="gcwo-plano-itemlist">${semanaSessoes.map(s => {
          const dia = DIAS_SEMANA.find(d => d.value === s.day);
          const cont = sessaoContagem(s);
          return `<li>${dia ? dia.full : s.day} — ${escHtml(s.modality)}${s.local ? ' · ' + escHtml(s.local) : ''} · ${cont.n} ${cont.label}</li>`;
        }).join('')}</ul>`
      : `<div class="gcwo-muted">Sem sessões nesta semana.</div>`;
    return `
      <div class="gcwo-history-week">
        <div class="gcwo-history-week-head">
          <strong>Semana ${w}</strong>
          <button type="button" class="gcBtnGhost gcBtnSm" data-copiar-semana="${w}" ${semanaSessoes.length ? '' : 'disabled'}>Copiar para aqui</button>
        </div>
        ${corpo}
      </div>`;
  }).join('');
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
  document.querySelectorAll('#gcwoHistoryOverlay [data-copiar-semana]').forEach(btn => {
    btn.addEventListener('click', () => {
      const w = Number(btn.getAttribute('data-copiar-semana'));
      copiarSemanaDoHistorico(_historyDetail, w);
    });
  });
}

// Cola os exercícios de uma semana de um plano antigo na semana actual — sempre com
// session_id novos, nunca reaproveitados do plano de origem (mesmo que já expirado).
// Mistura ao nível do dia, como no "copiar semana para as outras": só os dias que a
// semana de origem tem são substituídos; o resto da semana actual fica intocado.
function copiarSemanaDoHistorico(prescricao, sourceWeek) {
  const origem = (prescricao?.data?.sessions || []).filter(s => s.week === sourceWeek);
  if (!origem.length) return;

  const destWeek = _state.selectedWeek;
  const diasTocados = [...new Set(origem.map(s => s.day))];
  const diasComConflito = diasTocados.filter(d => _state.sessions.some(s => s.week === destWeek && s.day === d));
  if (diasComConflito.length) {
    const nomes = diasComConflito.map(d => DIAS_SEMANA.find(x => x.value === d)?.full || d).join(', ');
    const ok = window.confirm(`A semana ${destWeek} já tem sessões em: ${nomes}. Vais substituí-las por estas. Continuar?`);
    if (!ok) return;
  }

  DIAS_SEMANA.forEach(d => {
    const doDia = origem.filter(s => s.day === d.value).sort((a, b) => a.order - b.order);
    if (!doDia.length) return;
    _state.sessions = _state.sessions.filter(s => !(s.week === destWeek && s.day === d.value));
    doDia.forEach((s, idx) => {
      const copy = structuredClone(s);
      copy.session_id = uuid();
      copy.week = destWeek;
      copy.order = idx;
      _state.sessions.push(copy);
    });
  });

  closeHistoryModal();
  renderWeekTabs();
  renderDaystrip();
  renderDayDetail();
  updateGerarButtonState();
}

/* ── Fila de dias, dentro da semana seleccionada ─────────── */
function renderDaystrip() {
  const host = document.getElementById('gcwoDaystrip');
  if (!host) return;

  host.innerHTML = DIAS_SEMANA.map(d => {
    const sessions = _state.sessions.filter(s => s.week === _state.selectedWeek && s.day === d.value);
    const icons = sessions.map(s => {
      const meta = TIPO_META[tipoKey(s)];
      return `<span style="background:${meta.bg};color:${meta.fg}">${meta.icon}</span>`;
    }).join('');
    return `
      <button type="button" class="gcwo-daycard${d.value === _state.selectedDay ? ' selected' : ''}" data-day="${d.value}">
        <span class="dname">${d.label}</span>
        <span class="dcount">${sessions.length === 1 ? '1 sessão' : sessions.length + ' sessões'}</span>
        <span class="dicons">${icons}</span>
      </button>`;
  }).join('');

  host.querySelectorAll('[data-day]').forEach(btn => {
    btn.addEventListener('click', () => {
      _state.selectedDay = btn.getAttribute('data-day');
      const picker = document.getElementById('gcwoAddPicker');
      if (picker) picker.hidden = true;
      renderDaystrip();
      renderDayDetail();
    });
  });
}

/* ── Dia seleccionado, dentro da semana seleccionada ─────── */
function renderDayDetail() {
  const dia = DIAS_SEMANA.find(d => d.value === _state.selectedDay) || DIAS_SEMANA[0];
  const titleEl = document.getElementById('gcwoDayTitle');
  if (titleEl) titleEl.textContent = `${dia.full} · Semana ${_state.selectedWeek}`;

  const sessions = _state.sessions
    .filter(s => s.week === _state.selectedWeek && s.day === dia.value)
    .sort((a, b) => a.order - b.order);
  const host = document.getElementById('gcwoDaySessions');
  if (!host) return;
  host.innerHTML = sessions.length
    ? sessions.map(renderSessaoCardHtml).join('')
    : `<div class="gcwo-muted">Sem sessões atribuídas a ${dia.full.toLowerCase()}.</div>`;
  wireSessaoCards(host);
}

// Linhas curtas para a lista expandida do cartão — uma por item/bloco/caminhada.
function sessaoPreviewLinhas(s) {
  if (s.kind === 'walk') {
    const linhas = (s.walks || []).map(w => `${w.label || 'Caminhada'} — ${w.duration_sec ? fmtDuracaoTotal(w.duration_sec) : '—'}`);
    if (s.stairs_flights != null) linhas.push(`Escadas — ${s.stairs_flights} lanços`);
    return linhas;
  }
  if (s.kind === 'card' || s.kind === 'circuit') {
    return (s.blocks || []).map(b => b.name || TIPO_BLOCO_LABELS_PT[b.type] || 'Bloco');
  }
  return (s.items || []).map(it => it.name);
}

/* ── Cartão de sessão — leitura, colapsável ──────────────── */
function renderSessaoCardHtml(s) {
  const meta = TIPO_META[tipoKey(s)];
  const expanded = _expandedCardIds.has(s.session_id);
  const cont = sessaoContagem(s);
  const resumo = `${s.local ? escHtml(s.local) + ' · ' : ''}${cont.n ? cont.n + ' ' + cont.label : 'Sem conteúdo ainda.'}`;

  const linhas = sessaoPreviewLinhas(s);
  const bodyHtml = expanded
    ? `<div class="gcwo-plano-session-body">${linhas.length
        ? `<ul class="gcwo-plano-itemlist">${linhas.map(l => `<li>${escHtml(l)}</li>`).join('')}</ul>`
        : `<div class="gcwo-muted">Sem conteúdo ainda.</div>`}</div>`
    : '';

  return `
    <div class="gcwo-plano-session" data-id="${s.session_id}">
      <div class="gcwo-plano-session-bar">
        <div class="accent" style="background:${meta.fg}"></div>
        <div class="main">
          <button type="button" class="gcwo-plano-session-head" data-toggle="${s.session_id}">
            <span class="icon" style="background:${meta.bg};color:${meta.fg}">${meta.icon}</span>
            <span class="titles"><span class="nome">${meta.label}</span><span class="resumo">${resumo}</span></span>
            <span class="chevron">${expanded ? '▾' : '▸'}</span>
          </button>
          ${bodyHtml}
        </div>
        <button type="button" class="gcwo-plano-session-edit" data-edit="${s.session_id}" title="Editar sessão">${ICON_PENCIL}</button>
      </div>
    </div>`;
}

function wireSessaoCards(container) {
  container.querySelectorAll('[data-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-toggle');
      if (_expandedCardIds.has(id)) _expandedCardIds.delete(id); else _expandedCardIds.add(id);
      renderDayDetail();
    });
  });
  container.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openPanelEditar(btn.getAttribute('data-edit'));
    });
  });
}

/* ── "+ Adicionar sessão" — escolha do tipo ──────────────── */
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
   Painel lateral — criar/editar sessão
   ================================================================ */
function openPanelNovo(modality, kind) {
  _panelDraft = novaSessaoSkeleton(modality, kind, _state.selectedWeek, _state.selectedDay);
  _panelIsNovo = true;
  _panelCatalogFiltro = 'favoritos';
  _panelCatalogBusca = '';
  const picker = document.getElementById('gcwoAddPicker');
  if (picker) picker.hidden = true;
  renderPanel();
}
function openPanelEditar(sessionId) {
  const s = _state.sessions.find(x => x.session_id === sessionId);
  if (!s) return;
  _panelCatalogFiltro = 'favoritos';
  _panelCatalogBusca = '';
  _panelDraft = cloneSession(s);
  _panelIsNovo = false;
  renderPanel();
}
function fecharPanel() {
  _panelDraft = null;
  _panelIsNovo = false;
  renderPanel();
}

function renderPanel() {
  const panel = document.getElementById('gcwoPanel');
  if (!panel) return;

  if (!_panelDraft) {
    panel.className = 'gcwo-panel empty';
    panel.textContent = 'Seleciona o lápis numa sessão para editar, ou "+ Adicionar sessão".';
    return;
  }

  panel.className = 'gcwo-panel';
  const s = _panelDraft;
  const meta = TIPO_META[tipoKey(s)];
  const dia = DIAS_SEMANA.find(d => d.value === s.day);

  panel.innerHTML = `
    <div class="gcwo-panel-head">
      <span class="gcwo-panel-icon" style="background:${meta.bg};color:${meta.fg}">${meta.icon}</span>
      <span class="gcwo-panel-titles"><h3>${meta.label}</h3><span class="sub">${dia ? dia.full : ''} · Semana ${s.week}</span></span>
      ${!_panelIsNovo ? `<button type="button" class="gcwo-panel-headbtn" id="gcwoPanelApagar" title="Apagar sessão">${ICON_TRASH}</button>` : ''}
      <button type="button" class="gcwo-panel-headbtn close" id="gcwoPanelFechar" title="Fechar">${ICON_CLOSE}</button>
    </div>
    <div class="gcwo-panel-body">
      <span class="gcwo-field-label">Local</span>
      <div class="gcwo-chips" id="gcwoPLocalChips">
        ${LOCAIS_SESSAO.map(l => `<button type="button" class="gcwo-chip${s.local === l ? ' on' : ''}" data-local="${escAttr(l)}">${escHtml(l)}</button>`).join('')}
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

function renderResumoSessao(s) {
  if (s.tipo === 'ginasio') {
    const nEx = s.ginasio.exercicios.length;
    const nSeries = s.ginasio.exercicios.reduce((a, e) => a + e.series.length, 0);
    return `
      <div class="gcwo-stat">${ICON_RULER}<div><b>${nEx}</b><small>Exercícios</small></div></div>
      <div class="gcwo-stat">${ICON_CLOCK}<div><b>${nSeries}</b><small>Séries no total</small></div></div>`;
  }
  const { totalDistM, hasDist, totalTempoS, hasTempo } = calcTotaisModalidade(s.modalidade);
  const zonas = [...new Set(s.modalidade.tarefas.flatMap(t => t.zona ? t.zona.split(/[→-]/).map(z => z.trim()).filter(Boolean) : []))];
  const parts = [];
  if (hasDist) parts.push(`<div class="gcwo-stat">${ICON_RULER}<div><b>${fmtDistanciaTotal(totalDistM)}</b><small>Distância total</small></div></div>`);
  if (hasTempo) parts.push(`<div class="gcwo-stat">${ICON_CLOCK}<div><b>${fmtDuracaoTotal(totalTempoS)}</b><small>Duração prevista</small></div></div>`);
  if (zonas.length) parts.push(`<div class="gcwo-stat">${ICON_FLAG}<div><b>${escHtml(zonas.join('–'))}</b><small>Zonas utilizadas</small></div></div>`);
  return parts.join('') || '<span class="gcwo-muted">Sem tarefas ainda.</span>';
}
function updateResumoDom() {
  const host = document.getElementById('gcwoPResumo');
  if (host && _panelDraft) host.innerHTML = renderResumoSessao(_panelDraft);
}

/* ── Painel — corpo Ginásio ──────────────────────────────── */
function renderPanelGinasio(s) {
  const catalogOpts = _state.exercisesCatalog.map(ex =>
    `<option value="${escAttr(ex.id)}">${escHtml(ex.name)}${ex.categoria ? ' — ' + escHtml(ex.categoria) : ''}</option>`
  ).join('');
  const placeholderOpt = !_state.catalogLoaded
    ? 'A carregar catálogo…'
    : (_state.exercisesCatalog.length ? 'Escolher exercício do catálogo…' : 'Catálogo vazio — insira exercícios primeiro');

  return `
    <span class="gcwo-field-label">Exercícios</span>
    <div class="gcwo-exercicios">
      ${s.ginasio.exercicios.map((ex, ei) => renderExercicioCard(ex, ei)).join('') || '<div class="gcwo-muted">Sem exercícios ainda.</div>'}
    </div>
    <div class="gcwo-exercicio-add">
      <select class="gcwo-catalog-select" id="gcwoPCatalogSelect" ${_state.catalogLoaded && !_state.exercisesCatalog.length ? 'disabled' : ''}>
        <option value="">${placeholderOpt}</option>
        ${catalogOpts}
      </select>
      <button type="button" class="gcwo-add-exercicio gcBtnGhost" id="gcwoPAddExercicio">+ Exercício</button>
    </div>`;
}

function renderExercicioCard(ex, ei) {
  return `
    <div class="gcwo-exercicio" data-ei="${ei}">
      <div class="gcwo-exercicio-head">
        ${ex.foto_url ? `<img class="gcwo-exercicio-foto" src="${escAttr(ex.foto_url)}" alt="">` : ''}
        <strong>${escHtml(ex.nome || '(exercício)')}</strong>
        ${ex.categoria ? `<span class="gcwo-muted">${escHtml(ex.categoria)}</span>` : ''}
        <button type="button" class="gcwo-exercicio-remove" title="Remover exercício">✕</button>
      </div>
      ${ex.ajustes_maquina.length ? `
        <div class="gcwo-ajustes">
          ${ex.ajustes_maquina.map((a, ai) => `
            <label class="gcwo-ajuste">
              <span>${escHtml(a.etiqueta)}</span>
              <input type="text" data-ajuste-i="${ai}" value="${escAttr(a.valor)}">
            </label>
          `).join('')}
        </div>
      ` : ''}
      <div class="gcwo-series">
        <table>
          <thead><tr><th>Série</th><th>Reps</th><th>Peso (kg)</th><th></th></tr></thead>
          <tbody>
            ${ex.series.map((sr, sri) => `
              <tr data-sri="${sri}">
                <td>${sr.serie}</td>
                <td><input type="number" min="0" class="gcwo-reps" value="${sr.reps ?? ''}"></td>
                <td><input type="number" min="0" step="0.5" class="gcwo-peso" value="${sr.peso_kg ?? ''}"></td>
                <td><button type="button" class="gcwo-serie-remove" title="Remover série">✕</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <button type="button" class="gcwo-add-serie gcBtnGhost gcBtnSm">+ Série</button>
      </div>
      <div class="gcwo-exercicio-extra">
        <label class="gcwo-field">
          <span>Descanso entre séries (s)</span>
          <input type="number" min="0" class="gcwo-descanso" value="${ex.descanso_s ?? ''}">
        </label>
        <label class="gcwo-field">
          <span>Nota</span>
          <input type="text" class="gcwo-exercicio-nota" value="${escAttr(ex.nota)}">
        </label>
      </div>
    </div>
  `;
}

/* ── Painel — corpo Modalidade (sequência de tarefas) ────── */
function renderPanelModalidade(s) {
  const m = s.modalidade;
  const modOpts = MODALIDADES.map(md =>
    `<option value="${escAttr(md)}" ${md === m.modalidade ? 'selected' : ''}>${escHtml(md)}</option>`
  ).join('');

  return `
    <div class="gcwo-modalidade">
      <label class="gcwo-field">
        <span>Modalidade</span>
        <select id="gcwoPModalidade">${modOpts}</select>
      </label>
      ${m.modalidade === 'Outro' ? `
        <label class="gcwo-field">
          <span>Especificar</span>
          <input type="text" id="gcwoPModalidadeOutro" value="${escAttr(m.modalidadeOutro)}">
        </label>
      ` : ''}
    </div>
    <span class="gcwo-field-label">Tarefas</span>
    <div class="gcwo-tarefas" id="gcwoPTarefas">
      ${m.tarefas.map((t, ti) => renderTarefaCard(t, ti)).join('') || '<div class="gcwo-muted">Sem tarefas ainda.</div>'}
    </div>
    <button type="button" class="gcwo-add-tarefa gcBtnGhost" id="gcwoPAddTarefa">+ Tarefa</button>`;
}

function renderTarefaCard(t, ti) {
  const expanded = t.id === _panelExpandedTarefaId;
  const summary = tarefaSummaryText(t);
  return `
    <div class="gcwo-tarefa${expanded ? ' expanded' : ''}" data-ti="${ti}">
      <div class="gcwo-tarefa-header">
        <button type="button" class="gcwo-tarefa-toggle">
          <span class="gcwo-tarefa-chevron">${expanded ? '▾' : '▸'}</span>
          <span class="gcwo-tarefa-summary">${expanded ? 'A editar…' : (summary ? escHtml(summary) : '(tarefa vazia)')}</span>
        </button>
        <button type="button" class="gcwo-tarefa-remove" title="Remover tarefa">✕</button>
      </div>
      ${expanded ? renderTarefaFields(t, ti) : ''}
    </div>
  `;
}

function renderTarefaFields(t, ti) {
  const hasExtra = t.intensidade.potencia_w != null || t.intensidade.cadencia_rpm != null || t.intensidade.rpe != null;
  return `
    <div class="gcwo-tarefa-body">
      <div class="gcwo-tarefa-row">
        <label class="gcwo-field gcwo-field-sm"><span>Séries</span><input type="number" min="1" class="gcwo-t-series" value="${t.series ?? 1}"></label>
        <div class="gcwo-field gcwo-field-sm">
          <span>Medida</span>
          <div class="gcwo-modo">
            <label><input type="radio" name="gcwo-medida-${ti}" value="distancia" ${t.medida === 'distancia' ? 'checked' : ''}> Distância</label>
            <label><input type="radio" name="gcwo-medida-${ti}" value="tempo" ${t.medida === 'tempo' ? 'checked' : ''}> Tempo</label>
          </div>
        </div>
        ${t.medida === 'distancia'
          ? `<label class="gcwo-field gcwo-field-sm"><span>Distância (m)</span><input type="number" min="0" class="gcwo-t-distancia" value="${t.distancia_m ?? ''}"></label>`
          : `<label class="gcwo-field gcwo-field-sm"><span>Duração (min)</span><input type="number" min="0" step="0.5" class="gcwo-t-duracao" value="${t.duracao_min ?? ''}"></label>`
        }
        <label class="gcwo-field gcwo-field-sm"><span>Zona</span><input type="text" class="gcwo-t-zona" placeholder="Z3, Z1→Z4…" value="${escAttr(t.zona)}"></label>
      </div>
      <div class="gcwo-tarefa-row gcwo-intens-row">
        <label class="gcwo-field gcwo-field-sm"><span>Ritmo</span><input type="text" class="gcwo-t-ritmo" placeholder="4:15/km, 1:35/100m…" value="${escAttr(t.intensidade.ritmo)}"></label>
        <label class="gcwo-field gcwo-field-sm"><span>FC (bpm)</span><input type="number" min="0" class="gcwo-t-fc" value="${t.intensidade.fc_bpm ?? ''}"></label>
        <button type="button" class="gcwo-mais-intensidade-toggle gcBtnGhost gcBtnSm">${hasExtra ? '– menos intensidade' : '+ mais intensidade'}</button>
      </div>
      <div class="gcwo-tarefa-row gcwo-intens-extra" ${hasExtra ? '' : 'hidden'}>
        <label class="gcwo-field gcwo-field-sm"><span>Potência (W)</span><input type="number" min="0" class="gcwo-t-potencia" value="${t.intensidade.potencia_w ?? ''}"></label>
        <label class="gcwo-field gcwo-field-sm"><span>Cadência (rpm)</span><input type="number" min="0" class="gcwo-t-cadencia" value="${t.intensidade.cadencia_rpm ?? ''}"></label>
        <label class="gcwo-field gcwo-field-sm"><span>RPE</span><input type="number" min="0" max="10" class="gcwo-t-rpe" value="${t.intensidade.rpe ?? ''}"></label>
      </div>
      <div class="gcwo-tarefa-row">
        <label class="gcwo-field"><span>Descanso</span><input type="text" class="gcwo-t-descanso" placeholder="3', Z3 a 5:30…" value="${escAttr(t.descanso)}"></label>
        <label class="gcwo-field" style="flex:1;"><span>Nota</span><input type="text" class="gcwo-t-nota" value="${escAttr(t.nota)}"></label>
      </div>
    </div>
  `;
}

/* ── Painel — wiring ─────────────────────────────────────── */
function wirePanel() {
  const s = _panelDraft;

  document.getElementById('gcwoPanelFechar').addEventListener('click', fecharPanel);
  document.getElementById('gcwoPCancelar').addEventListener('click', fecharPanel);
  document.getElementById('gcwoPanelApagar')?.addEventListener('click', () => {
    _state.sessions = _state.sessions.filter(x => x.session_id !== s.session_id);
    fecharPanel();
    renderWeekTabs();
    renderDaystrip();
    renderDayDetail();
    updateGerarButtonState();
  });
  document.getElementById('gcwoPGuardar').addEventListener('click', handleGuardarSessao);

  document.getElementById('gcwoPLocalChips').querySelectorAll('[data-local]').forEach(chip => {
    chip.addEventListener('click', () => {
      s.local = chip.getAttribute('data-local');
      document.querySelectorAll('#gcwoPLocalChips .gcwo-chip').forEach(c => c.classList.toggle('on', c === chip));
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
        <label class="gcwo-field gcwo-field-sm"><span>Duração (min)</span><input type="number" min="0" class="gcwo-walk-duracaomin" value="${w.duration_sec != null ? w.duration_sec / 60 : ''}"></label>
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
    card.querySelector('.gcwo-walk-duracaomin').addEventListener('input', (e) => {
      w.duration_sec = e.target.value === '' ? null : Math.round(Number(e.target.value) * 60);
    });
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
  return { zone: null, pace_sec_per_km: null, heart_rate_bpm: null, power_w: null, cadence_rpm: null, rpe: null };
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

function renderIntensidadeCampos(intensity, mostrarZona) {
  return `
    <div class="gcwo-row3">
      ${mostrarZona ? `
      <label class="gcwo-field"><span>Zona</span>
        <select class="gcwo-int-zone">
          <option value="">—</option>
          ${ZONAS.map(z => `<option value="${z}" ${intensity.zone === z ? 'selected' : ''}>${z}</option>`).join('')}
        </select>
      </label>` : ''}
      <label class="gcwo-field"><span>Ritmo (min/km)</span><input type="text" inputmode="numeric" placeholder="5:00" class="gcwo-int-pace" value="${escAttr(fmtPaceEditavel(intensity.pace_sec_per_km))}"></label>
      <label class="gcwo-field"><span>FC (bpm)</span><input type="number" min="0" class="gcwo-int-fc" value="${intensity.heart_rate_bpm ?? ''}"></label>
      <label class="gcwo-field"><span>Potência (W)</span><input type="number" min="0" class="gcwo-int-power" value="${intensity.power_w ?? ''}"></label>
      <label class="gcwo-field"><span>Cadência (rpm)</span><input type="number" min="0" class="gcwo-int-cadence" value="${intensity.cadence_rpm ?? ''}"></label>
      <label class="gcwo-field"><span>RPE</span><input type="number" min="1" max="10" class="gcwo-int-rpe" value="${intensity.rpe ?? ''}"></label>
    </div>`;
}
function wrapIntensidade(bid, scope, intensity, mostrarZona) {
  return `<div class="gcwo-intensidade" data-bid="${escAttr(bid)}" data-scope="${scope}">${renderIntensidadeCampos(intensity, mostrarZona)}</div>`;
}
function intensidadeDoScope(b, scope) {
  if (scope === 'work') return b.work.intensity;
  if (scope === 'recovery') return b.recovery.intensity;
  return b.intensity;
}

function renderBlocoContinuo(b, temZona) {
  return `
    <div class="gcwo-exercicio" data-bid="${escAttr(b.block_id)}">
      <div class="gcwo-exercicio-head">
        <strong>Contínuo</strong>
        <button type="button" class="gcwo-exercicio-remove" data-remove-bid="${escAttr(b.block_id)}" title="Remover bloco">✕</button>
      </div>
      <label class="gcwo-field gcwo-field-sm" style="margin-top:8px;"><span>Duração (min)</span><input type="number" min="0" class="gcwo-bloco-duracaomin" value="${b.duration_sec != null ? b.duration_sec / 60 : ''}"></label>
      <span class="gcwo-field-label" style="margin-top:10px;">Intensidade</span>
      ${wrapIntensidade(b.block_id, 'main', b.intensity, temZona)}
    </div>`;
}
function renderBlocoFecho(b, temZona) {
  return `
    <div class="gcwo-exercicio" data-bid="${escAttr(b.block_id)}">
      <div class="gcwo-exercicio-head">
        <strong>Fecho</strong>
        <button type="button" class="gcwo-exercicio-remove" data-remove-bid="${escAttr(b.block_id)}" title="Remover bloco">✕</button>
      </div>
      <div class="gcwo-row2" style="margin-top:8px;">
        <label class="gcwo-field gcwo-field-sm"><span>Modo</span>
          <select class="gcwo-bloco-mode">${CLOSING_MODES.map(m => `<option value="${m.value}" ${b.mode === m.value ? 'selected' : ''}>${m.label}</option>`).join('')}</select>
        </label>
        <label class="gcwo-field gcwo-field-sm"><span>Duração (min)</span><input type="number" min="0" class="gcwo-bloco-duracaomin" value="${b.duration_sec != null ? b.duration_sec / 60 : ''}"></label>
      </div>
      <span class="gcwo-field-label" style="margin-top:10px;">Intensidade</span>
      ${wrapIntensidade(b.block_id, 'main', b.intensity, temZona)}
    </div>`;
}
function renderBlocoSeries(b, temZona, soDistancia) {
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
      <label class="gcwo-field gcwo-field-sm"><span>${medida === 'distance' ? 'Distância (m)' : 'Duração (min)'}</span>
        <input type="number" min="0" class="gcwo-bloco-workvalue" value="${b.work.value != null ? (medida === 'distance' ? b.work.value : b.work.value / 60) : ''}">
      </label>
      <span class="gcwo-field-label" style="margin-top:10px;">Intensidade do trabalho</span>
      ${wrapIntensidade(b.block_id, 'work', b.work.intensity, temZona)}
      <label class="gcwo-field gcwo-field-sm" style="margin-top:10px;"><span>Recuperação (min)</span><input type="number" min="0" class="gcwo-bloco-recdur" value="${b.recovery.duration_sec != null ? b.recovery.duration_sec / 60 : ''}"></label>
      <span class="gcwo-field-label" style="margin-top:10px;">Intensidade da recuperação</span>
      ${wrapIntensidade(b.block_id, 'recovery', b.recovery.intensity, temZona)}
    </div>`;
}
function renderBlocoCardio(b, s) {
  const temZona = modalidadeTemZona(s.modality);
  if (b.type === 'series') {
    const soDistancia = s.modality === 'Natação';
    if (soDistancia) b.work.measure = 'distance';
    return renderBlocoSeries(b, temZona, soDistancia);
  }
  if (b.type === 'closing') return renderBlocoFecho(b, temZona);
  return renderBlocoContinuo(b, temZona);
}
function renderBlocosListInner(s) {
  if (!s.blocks.length) return `<div class="gcwo-muted">Nenhum bloco adicionado ainda.</div>`;
  return s.blocks.map(b => renderBlocoCardio(b, s)).join('');
}

function renderPanelCardio(s) {
  return `
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
    if (zoneEl) zoneEl.addEventListener('change', (e) => { intensity.zone = e.target.value || null; refreshZonaResumo(s); });
    box.querySelector('.gcwo-int-pace').addEventListener('input', (e) => { intensity.pace_sec_per_km = parsePaceParaSegundos(e.target.value); });
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

    const duracaoEl = card.querySelector('.gcwo-bloco-duracaomin');
    if (duracaoEl) duracaoEl.addEventListener('input', (e) => {
      b.duration_sec = e.target.value === '' ? null : Math.round(Number(e.target.value) * 60);
      refreshZonaResumo(s);
    });

    const modeEl = card.querySelector('.gcwo-bloco-mode');
    if (modeEl) modeEl.addEventListener('change', (e) => { b.mode = e.target.value; });

    const countEl = card.querySelector('.gcwo-bloco-count');
    if (countEl) countEl.addEventListener('input', (e) => {
      b.count = e.target.value === '' ? null : Number(e.target.value);
      refreshZonaResumo(s);
    });

    const workValEl = card.querySelector('.gcwo-bloco-workvalue');
    if (workValEl) workValEl.addEventListener('input', (e) => {
      const n = e.target.value === '' ? null : Number(e.target.value);
      b.work.value = n == null ? null : (b.work.measure === 'distance' ? n : Math.round(n * 60));
      refreshZonaResumo(s);
    });

    const recDurEl = card.querySelector('.gcwo-bloco-recdur');
    if (recDurEl) recDurEl.addEventListener('input', (e) => {
      b.recovery.duration_sec = e.target.value === '' ? null : Math.round(Number(e.target.value) * 60);
      refreshZonaResumo(s);
    });

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

function renderCircExercicioRow(ex) {
  const catalogOpts = _state.exercisesCatalog.map(c => `<option value="${escAttr(c.id)}" ${ex.exercise_id === c.id ? 'selected' : ''}>${escHtml(c.name)}</option>`).join('');
  return `
    <div class="gcwo-circ-exrow" data-exid="${escAttr(ex.id)}" style="border-top:0.5px solid #e2e8f0;padding-top:8px;margin-top:8px;">
      <div style="display:flex;gap:8px;align-items:center;">
        <select class="gcwo-circ-ex-select" style="flex:1;">
          <option value="">Escolher exercício…</option>
          ${catalogOpts}
        </select>
        <button type="button" class="gcwo-exercicio-remove" data-remove-exid="${escAttr(ex.id)}" title="Remover exercício">✕</button>
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
      <label class="gcwo-field gcwo-field-sm" style="margin-top:8px;"><span>Duração (min)</span><input type="number" min="0" class="gcwo-circ-fixodur" value="${b.duration_sec != null ? b.duration_sec / 60 : ''}"></label>
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

    const fixoDurEl = card.querySelector('.gcwo-circ-fixodur');
    if (fixoDurEl) fixoDurEl.addEventListener('input', (e) => { b.duration_sec = e.target.value === '' ? null : Math.round(Number(e.target.value) * 60); refreshTempoTotalCircuito(s); });

    card.querySelectorAll('.gcwo-circ-exrow').forEach(row => {
      const exid = row.getAttribute('data-exid');
      const ex = (b.exercicios || []).find(x => x.id === exid);
      if (!ex) return;

      row.querySelector('[data-remove-exid]')?.addEventListener('click', () => {
        b.exercicios = b.exercicios.filter(x => x.id !== exid);
        refreshCircBlocosListDom(s);
      });
      row.querySelector('.gcwo-circ-ex-select').addEventListener('change', (e) => {
        const catEx = _state.exercisesCatalog.find(c => c.id === e.target.value);
        ex.exercise_id = e.target.value || null;
        ex.name = catEx ? catEx.name : '';
        refreshTempoTotalCircuito(s);
      });
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
  renderWeekTabs();
  renderDaystrip();
  renderDayDetail();
  updateGerarButtonState();
}

/* ── Painel — wiring Ginásio ─────────────────────────────── */
function wirePanelGinasio(s) {
  s.ginasio.exercicios.forEach((ex, ei) => wireExercicioCard(s, ex, ei));

  const select = document.getElementById('gcwoPCatalogSelect');
  document.getElementById('gcwoPAddExercicio').addEventListener('click', () => {
    const exId = select.value;
    const novo = novoExercicioGinasio();
    if (exId) {
      const catExer = _state.exercisesCatalog.find(c => c.id === exId);
      if (catExer) {
        novo.exercicio_id = catExer.id;
        novo.nome = catExer.name;
        novo.categoria = catExer.categoria;
        novo.foto_url = catExer.photo_url || null;
        novo.tempo_concentrico_s = catExer.tempo_concentrico_s;
        novo.tempo_excentrico_s = catExer.tempo_excentrico_s;
        novo.ajustes_maquina = Array.isArray(catExer.ajustes_maquina)
          ? catExer.ajustes_maquina.map(a => ({ etiqueta: a.etiqueta, valor: a.valor }))
          : [];
      }
    }
    s.ginasio.exercicios.push(novo);
    renderPanel();
  });
}

function wireExercicioCard(s, ex, ei) {
  const exCard = document.querySelector(`#gcwoPanel .gcwo-exercicio[data-ei="${ei}"]`);
  if (!exCard) return;

  exCard.querySelector('.gcwo-exercicio-remove').addEventListener('click', () => {
    s.ginasio.exercicios.splice(ei, 1);
    renderPanel();
  });

  exCard.querySelectorAll('[data-ajuste-i]').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const ai = Number(inp.getAttribute('data-ajuste-i'));
      if (ex.ajustes_maquina[ai]) ex.ajustes_maquina[ai].valor = e.target.value;
    });
  });

  exCard.querySelectorAll('tbody tr').forEach(tr => {
    const sri = Number(tr.getAttribute('data-sri'));
    tr.querySelector('.gcwo-reps').addEventListener('input', (e) => {
      ex.series[sri].reps = e.target.value === '' ? null : Number(e.target.value);
      updateResumoDom();
    });
    tr.querySelector('.gcwo-peso').addEventListener('input', (e) => {
      ex.series[sri].peso_kg = e.target.value === '' ? null : Number(e.target.value);
    });
    tr.querySelector('.gcwo-serie-remove').addEventListener('click', () => {
      ex.series.splice(sri, 1);
      ex.series.forEach((sr, idx) => { sr.serie = idx + 1; });
      renderPanel();
    });
  });

  exCard.querySelector('.gcwo-add-serie').addEventListener('click', () => {
    ex.series.push({ serie: ex.series.length + 1, reps: null, peso_kg: null });
    renderPanel();
  });

  exCard.querySelector('.gcwo-descanso').addEventListener('input', (e) => {
    ex.descanso_s = e.target.value === '' ? null : Number(e.target.value);
  });
  exCard.querySelector('.gcwo-exercicio-nota').addEventListener('input', (e) => { ex.nota = e.target.value; });
}

/* ── Painel — wiring Modalidade ──────────────────────────── */
function wirePanelModalidade(s) {
  const m = s.modalidade;

  document.getElementById('gcwoPModalidade').addEventListener('change', (e) => {
    m.modalidade = e.target.value;
    renderPanel();
  });
  const outroInp = document.getElementById('gcwoPModalidadeOutro');
  if (outroInp) outroInp.addEventListener('input', (e) => { m.modalidadeOutro = e.target.value; });

  m.tarefas.forEach((t, ti) => wireTarefaCard(s, t, ti));

  document.getElementById('gcwoPAddTarefa').addEventListener('click', () => {
    m.tarefas.push(novaTarefa());
    renderPanel();
  });
}

function wireTarefaCard(s, t, ti) {
  const tCard = document.querySelector(`#gcwoPanel .gcwo-tarefa[data-ti="${ti}"]`);
  if (!tCard) return;

  tCard.querySelector('.gcwo-tarefa-toggle').addEventListener('click', () => {
    _panelExpandedTarefaId = (_panelExpandedTarefaId === t.id) ? null : t.id;
    renderPanel();
  });

  tCard.querySelector('.gcwo-tarefa-remove').addEventListener('click', () => {
    if (_panelExpandedTarefaId === t.id) _panelExpandedTarefaId = null;
    s.modalidade.tarefas.splice(ti, 1);
    renderPanel();
  });

  if (t.id !== _panelExpandedTarefaId) return; // campos só existem no DOM quando a tarefa está expandida

  tCard.querySelector('.gcwo-t-series').addEventListener('input', (e) => {
    t.series = e.target.value === '' ? 1 : Number(e.target.value);
    updateResumoDom();
  });

  tCard.querySelectorAll(`input[name="gcwo-medida-${ti}"]`).forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) { t.medida = e.target.value; renderPanel(); }
    });
  });

  const distInp = tCard.querySelector('.gcwo-t-distancia');
  if (distInp) distInp.addEventListener('input', (e) => {
    t.distancia_m = e.target.value === '' ? null : Number(e.target.value);
    updateResumoDom();
  });
  const durInp = tCard.querySelector('.gcwo-t-duracao');
  if (durInp) durInp.addEventListener('input', (e) => {
    t.duracao_min = e.target.value === '' ? null : Number(e.target.value);
    updateResumoDom();
  });

  tCard.querySelector('.gcwo-t-zona').addEventListener('input', (e) => {
    t.zona = e.target.value;
    updateResumoDom();
  });

  tCard.querySelector('.gcwo-t-ritmo').addEventListener('input', (e) => { t.intensidade.ritmo = e.target.value; });
  tCard.querySelector('.gcwo-t-fc').addEventListener('input', (e) => {
    t.intensidade.fc_bpm = e.target.value === '' ? null : Number(e.target.value);
  });
  tCard.querySelector('.gcwo-t-potencia').addEventListener('input', (e) => {
    t.intensidade.potencia_w = e.target.value === '' ? null : Number(e.target.value);
  });
  tCard.querySelector('.gcwo-t-cadencia').addEventListener('input', (e) => {
    t.intensidade.cadencia_rpm = e.target.value === '' ? null : Number(e.target.value);
  });
  tCard.querySelector('.gcwo-t-rpe').addEventListener('input', (e) => {
    t.intensidade.rpe = e.target.value === '' ? null : Number(e.target.value);
  });

  tCard.querySelector('.gcwo-t-descanso').addEventListener('input', (e) => { t.descanso = e.target.value; });
  tCard.querySelector('.gcwo-t-nota').addEventListener('input', (e) => { t.nota = e.target.value; });

  const maisBtn = tCard.querySelector('.gcwo-mais-intensidade-toggle');
  const extraRow = tCard.querySelector('.gcwo-intens-extra');
  if (maisBtn && extraRow) {
    maisBtn.addEventListener('click', () => {
      const isHidden = extraRow.hasAttribute('hidden');
      if (isHidden) extraRow.removeAttribute('hidden'); else extraRow.setAttribute('hidden', '');
      maisBtn.textContent = isHidden ? '– menos intensidade' : '+ mais intensidade';
    });
  }
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
// Duração exacta do plano, sem folga — dia 1 é hoje (Lisboa), último dia às 23:59:59 (Lisboa).
function computeExpiresAt(weeks) {
  const dias = weeks * 7;
  const hoje = hojeEmLisboa();
  const fim = new Date(Date.UTC(hoje.year, hoje.month - 1, hoje.day));
  fim.setUTCDate(fim.getUTCDate() + dias - 1);
  const y = fim.getUTCFullYear(), m = fim.getUTCMonth() + 1, d = fim.getUTCDate();
  const offsetMin = lisbonOffsetMinutesAt(new Date(Date.UTC(y, m - 1, d, 12, 0, 0))); // meio-dia UTC só para apurar o offset desse dia (evita bordas de DST à meia-noite)
  return new Date(Date.UTC(y, m - 1, d, 23, 59, 59) - offsetMin * 60000);
}
function fmtDataPtLisboa(date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(date).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  return `${+parts.day} de ${MESES_PT[+parts.month - 1]} de ${parts.year}`;
}

/* ================================================================
   Gravação — monta o snapshot e grava em wo_prescriptions
   ================================================================ */
// Forma alinhada com a secção 5 do briefing: weeks, restricoes (lista), sessions
// (session_id/week/day/order/kind/modality/local + contentor próprio do kind).
// Circuito grava sempre `intervals` já expandido — o `rounds`/`exercicios` da secção 5
// é só o modelo do ecrã de edição, nunca o que fica na base de dados (decisão de 8 de
// agosto de 2026).
function sessaoParaGravar(s) {
  const base = { session_id: s.session_id, week: s.week, day: s.day, order: s.order, kind: s.kind, modality: s.modality, local: s.local };
  if (s.kind === 'walk') return { ...base, walks: s.walks, stairs_flights: s.stairs_flights };
  if (s.kind === 'circuit') return { ...base, blocks: flattenBlocosCircuitoParaGravar(s.blocks) };
  if (s.kind === 'card') return { ...base, blocks: s.blocks };
  return { ...base, items: s.items };
}
function buildFinalData() {
  return {
    weeks: _state.planWeeks,
    restricoes: restricoesAtuais(),
    sessions: _state.sessions.map(sessaoParaGravar),
  };
}

// Chave de "slot" para casar sessões novas com as já existentes na prescrição activa.
// O builder começa sempre vazio (nunca carrega o plano activo para edição), por isso
// week+day+order é a única correspondência disponível — fiável quando há uma sessão
// por dia, mas pode falhar se um dia tiver várias sessões numa ordem diferente da
// versão anterior. Nesse caso a sessão fica tratada como nova (session_id próprio).
function chaveSessao(s) {
  return `${s.week}|${s.day}|${s.order}`;
}

// Edição de plano activo (secção 5 do briefing): preserva session_id das sessões que
// correspondem a um slot já existente (para os registos do doente continuarem ligados
// à sessão certa) e nunca apaga em silêncio uma sessão antiga que não voltou a aparecer
// nesta gravação — só desaparece quando o Morais revogar a prescrição explicitamente.
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
  if (!_state.planWeeks) return 'Falta escolher a duração do plano.';
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
    const expiresAtNovo = computeExpiresAt(_state.planWeeks);
    let token, linkExpiresAt;

    if (activaExistente) {
      tokensAEscrubar.push(activaExistente.token);

      const sessoesMescladas = mesclarSessoes(activaExistente.data?.sessions, novaData.sessions);
      // Nunca encurtar por engano a validade que o doente já tem, nem tornar semanas
      // antigas inacessíveis por a gravação actual ter escolhido uma duração menor.
      const weeksFinal = Math.max(activaExistente.data?.weeks || 0, novaData.weeks);
      const expiresAtExistente = new Date(activaExistente.expires_at);
      const expiresAtFinal = expiresAtNovo > expiresAtExistente ? expiresAtNovo : expiresAtExistente;
      const dataFinal = { ...novaData, weeks: weeksFinal, sessions: sessoesMescladas };

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
