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
import { fmtPaceEditavel, parsePaceParaSegundos } from '../shared/pace.js';
import { abrirZonasTreino } from '../shared/zonas-treino.js?v=2026-08-12-5';

const escAttr = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));
const escHtml = escAttr;

const TREINO_BASE_URL = 'https://treino.joaomorais.pt/t/';

// Sobe este número sempre que prescricao.css mudar de forma visível. Sem isto, o
// <link> é injectado sempre com o mesmo URL e o browser (ou o CDN) pode continuar a
// servir a folha de estilo antiga depois de um deploy — foi o que aconteceu a 9 ago
// 2026 com o ecrã de 2 modos: HTML novo, CSS velho, tudo sem estilo nenhum.
const PRESCRICAO_CSS_VERSION = '2026-08-25-3';

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
  { modality: 'Outra atividade', kind: 'custom', enabled: false },
];
const LOCAIS_SESSAO = ['Ginásio', 'Casa', 'Clínica'];
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
const ZONAS_NATACAO = ['A1', 'A2', 'A3', 'SP1', 'SP2', 'SP3'];
const CLOSING_MODES = [
  { value: 'rest', label: 'Descanso' },
  { value: 'cooldown', label: 'Arrefecimento' },
  { value: 'walk', label: 'Caminhada' },
  { value: 'easy', label: 'Fácil' },
];
// Cada modalidade mantém o seu sistema: corrida Z1-Z5, ciclismo Coggan Z1-Z7
// e natação A1/A2/A3/SP1/SP2/SP3.
function modalidadeTemZona(modality) {
  return modality === 'Corrida' || modality === 'Ciclismo' || modality === 'Natação';
}

const TIPO_META = {
  ginasio:   { label: 'Ginásio',   icon: ICON_GINASIO,   fg: '#7c3aed', bg: '#f3e8ff' },
  patologia: { label: 'Exercícios por patologia', icon: '<span aria-hidden="true">🦵</span>', fg: '#b45309', bg: '#fff4d6' },
  corrida:   { label: 'Corrida',   icon: ICON_CORRIDA,   fg: '#c2410c', bg: '#ffedd5' },
  natacao:   { label: 'Natação',   icon: ICON_NATACAO,   fg: '#1a56db', bg: '#eaf0fd' },
  ciclismo:  { label: 'Ciclismo',  icon: ICON_CICLISMO,  fg: '#0f8a74', bg: '#e3f6f2' },
  caminhada: { label: 'Caminhada', icon: ICON_CAMINHADA, fg: '#15803d', bg: '#dcfce7' },
  circuito:  { label: 'Circuito',  icon: ICON_CIRCUITO,  fg: '#be185d', bg: '#fce7f3' },
  outra:     { label: 'Outra atividade', icon: ICON_MAIS, fg: '#475569', bg: '#f1f5f9' },
};
// Sessões novas usam { kind, modality, local } (secção 5). tipoKey mapeia a modalidade para a chave de TIPO_META.
function tipoKey(s) {
  if (String(s?.notes || '').startsWith('Origem:')) return 'patologia';
  const m = (s.modality || '').toLowerCase();
  if (m === 'corrida') return 'corrida';
  if (m === 'natação' || m === 'natacao') return 'natacao';
  if (m === 'ciclismo') return 'ciclismo';
  if (m === 'caminhada') return 'caminhada';
  if (m === 'circuito') return 'circuito';
  if (m === 'outra atividade') return 'outra';
  return 'ginasio';
}
function metaSessao(s) {
  if (tipoKey(s) !== 'patologia') return TIPO_META[tipoKey(s)];
  const local = String(s?.local || '').toLowerCase();
  if (local === 'casa') return { ...TIPO_META.patologia, label: 'HEP · em casa', icon: '<span aria-hidden="true">🏠</span>' };
  if (local === 'clínica' || local === 'clinica') return { ...TIPO_META.patologia, label: 'Na clínica', icon: '<span aria-hidden="true">🏥</span>' };
  return TIPO_META.patologia;
}

function modoExecucaoGinasio(s) {
  return s?.execution_mode === 'guided' ? 'guided' : 'free';
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
function topActionsHtml(extraButtonsHtml = '', mostrarCatalogo = true, mostrarFuturos = true) {
  return `
    <div class="gcwo-headeractions">
      ${mostrarFuturos ? '<button type="button" class="gcBtnGhost" disabled title="Em breve">Biblioteca de sessões</button><button type="button" class="gcBtnGhost" disabled title="Em breve">Modelos</button>' : ''}
      ${mostrarCatalogo ? '<button type="button" class="gcBtnOutline" id="gcwoBtnCatalogo">Catálogo</button>' : ''}
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
    linkExpiryMode: 'last_session',
    linkExpiryDate: null,
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
let _step1Destination = 'prescription'; // 'acompanhamento' quando a entrada deve abrir o cérebro do doente
let _loadingPlanoActivo = false;        // a verificar/carregar o plano activo do doente escolhido (9 ago 2026)
let _expandedCardIds = new Set();       // sessões expandidas na lista principal (leitura)
let _panelExpandedTarefaId = null;      // dentro do painel, tarefa expandida (só uma)
let _panelDraft = null;                 // clone de trabalho da sessão em edição — null = painel fechado
let _panelIsNovo = false;
let _panelCatalogFiltro = 'todos';  // mostra o catálogo; "Favoritos" continua a um clique
let _panelCatalogBusca = '';
let _panelEquipFiltro = new Set();      // filtro de equipamento (multi-selecção) dentro do painel de ginásio
let _pendingSlot = null;                // {date} — dia escolhido na grelha, modalidade por escolher (ecrã de 2 modos, 9 ago 2026)
let _calMenuDocClickWired = false;      // menu ⋮ por sessão no calendário — fecha ao clicar fora (9 ago 2026)
let _beforeUnloadWired = false;         // aviso ao sair com sessões só locais, nunca gravadas (9 ago 2026)
let _dayPicker = null;                  // {sessionId, mode:'mover'|'duplicar', selecionados:Set(iso)} — modal de escolha de dia(s) (9 ago 2026)
let _calendarFirstMonday = null;        // primeira das duas semanas visíveis no calendário
let _historyOpen = false;               // modal "Ver planos anteriores" aberto/fechado
let _historyLoading = false;
let _historyError = '';
let _historyList = [];                  // prescrições deste doente (activas, expiradas ou revogadas)
let _historyDetail = null;              // prescrição seleccionada na lista — null = a mostrar a lista

const CATALOG_FILTROS = [
  { value: 'favoritos', label: 'Favoritos' },
  { value: 'todos', label: 'Todos' },
  { value: 'Corpo Inteiro', label: 'Corpo Inteiro' },
  { value: 'Membro Inferior', label: 'Membro Inferior' },
  { value: 'Core', label: 'Core' },
  { value: 'Membro Superior', label: 'Membro Superior' },
];
// Taxonomia visual dos filtros de equipamento (decisão de produto, 23 ago 2026) — fechada
// nestes 6 chips; "Outros" nunca é gravado em wo_exercises.equipamento, é só uma agregação
// da UI. Um acessório novo mantém o seu valor técnico real na BD e cai em "Outros" por
// omissão — só ganha chip próprio com decisão explícita (ver EQUIPAMENTO_OUTROS_VALORES).
// "Polia" fica de fora de "Máquina": tem significado funcional próprio no treino-frontend
// (ver itemUsaMaquina) — misturar os dois mudaria o que o doente vê lá, por isso "Máquina"
// só encontra exercícios tecnicamente equipamento="Máquina".
const EQUIPAMENTO_FILTROS = ['Máquina', 'TRX', 'Elásticos', 'Halteres', 'Peso Corporal', 'Outros'];
const EQUIPAMENTO_OUTROS_VALORES = ['Bastão', 'Bola', 'Polia'];
function exercicioBateFiltroEquipamento(ex, filtroSet) {
  if (!filtroSet.size) return true;
  const equipamento = Array.isArray(ex.equipamento) ? ex.equipamento : [];
  return equipamento.some(eq => filtroSet.has(eq) || (filtroSet.has('Outros') && EQUIPAMENTO_OUTROS_VALORES.includes(eq)));
}

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
// tipoKey() espera um objecto com .modality (é o que lê de uma sessão `s`), não uma
// string em bruto — este wrapper reutiliza a mesma normalização (minúsculas, acentos)
// sem precisar de passar a sessão inteira até aqui. NUNCA comparar modality em bruto
// (ex.: "Corrida" capitalizado) com wo_zone_profiles.modality (sempre minúsculo) —
// spec-zonas-treino.md, Fase 1.
function modalidadeCanonica(modality) {
  return tipoKey({ modality });
}

// Modalidades que já têm perfis em wo_zone_profiles (Fases 1-2 do spec-zonas-treino.md).
// Ciclismo entra na Fase 2 — natação (Fase 3) continua sem perfil, cai sempre no
// comportamento antigo/genérico, como sempre foi.
const MODALIDADES_COM_PERFIL = ['corrida', 'ciclismo', 'natacao'];

// Prioridade: perfil activo em wo_zone_profiles/wo_zone_ranges (carregado uma vez por
// doente em carregarZonaPerfis(), síncrono aqui porque o render monta HTML em string) >
// hr_zones_bpm manual do doente (prova de esforço antiga, só fazia sentido para corrida)
// > fórmula (Tanaka) + idade. Modalidades sem perfil (natação) caem sempre no
// comportamento antigo, sem aviso (é o esperado, não uma falha: ainda não têm perfil
// para cair).
function bpmRangeParaZona(zona, modality) {
  const p = _state.patient;
  if (!p || !zona) return '';
  const modalidade = modalidadeCanonica(modality);
  if (modalidade === 'natacao') {
    const perfil = _state.zonaPerfis && _state.zonaPerfis.natacao && _state.zonaPerfis.natacao.heart_rate;
    if (!perfil) return '';
    const r = (perfil.wo_zone_ranges || []).find(r => r.zone_key === zona);
    return formatarRangeNumerico(r, 'bpm');
  }
  const idx = Number(String(zona).replace('Z', ''));
  if (!(idx >= 1 && idx <= 5)) return '';
  const key = 'z' + idx;
  if (MODALIDADES_COM_PERFIL.includes(modalidade)) {
    const perfil = _state.zonaPerfis && _state.zonaPerfis[modalidade] && _state.zonaPerfis[modalidade].heart_rate;
    if (perfil) {
      const r = (perfil.wo_zone_ranges || []).find(r => r.zone_key === zona);
      return formatarRangeNumerico(r, 'bpm');
    }
    // Só corrida tinha hr_zones_bpm/hr_zone_formula antes da Fase 1 — para ciclismo não
    // há fallback antigo com sentido nenhum (nunca existiu perfil de FC de ciclismo em
    // patients.*), por isso só avisamos quando é mesmo corrida a cair no antigo.
    if (modalidade === 'corrida') {
      console.warn('[prescricao] fallback a hr_zone_formula/hr_zones_bpm — sem perfil activo em wo_zone_profiles para corrida', { patientId: p.id });
    } else {
      return '';
    }
  }

  const manual = p.hr_zones_bpm && p.hr_zones_bpm[key];
  if (manual && (manual.min != null || manual.max != null)) {
    return formatarRangeNumerico({ lower_value:manual.min, upper_value:manual.max }, 'bpm');
  }
  const fcmax = calcFcMaxFormula(p.hr_zone_formula || 'tanaka', calcIdade(p.dob));
  if (fcmax == null) return '';
  const pct = [0, .60, .70, .80, .90, 1];
  const min = Math.round(fcmax * pct[idx - 1]);
  const max = Math.round(fcmax * pct[idx]);
  return formatarRangeNumerico({ lower_value:idx === 1 ? null : min, upper_value:idx === 5 ? null : max }, 'bpm');
}

// Fase 2 (ciclismo) — zonas de Coggan são Z1-Z7, nunca 5, por isso não reaproveita o
// early-return de bpmRangeParaZona (que só existe para o modelo antigo Z1-Z5). Só
// ciclismo tem perfil de potência; sem perfil activo devolve '' sem aviso (natação/
// outras modalidades nunca tiveram potência prescrita, não é uma regressão).
function potenciaRangeParaZona(zona, modality) {
  if (!zona || modalidadeCanonica(modality) !== 'ciclismo') return '';
  const perfil = _state.zonaPerfis && _state.zonaPerfis.ciclismo && _state.zonaPerfis.ciclismo.power;
  if (!perfil) return '';
  const r = (perfil.wo_zone_ranges || []).find(r => r.zone_key === zona);
  return formatarRangeNumerico(r, 'W');
}

function rangePerfilParaZona(zona, modality, metric) {
  const modalidade = modalidadeCanonica(modality);
  const perfil = _state.zonaPerfis?.[modalidade]?.[metric];
  if (!perfil || !zona) return null;
  return (perfil.wo_zone_ranges || []).find(r => r.zone_key === zona) || null;
}
function formatarRangeNumerico(r, unidade) {
  if (!r) return '';
  const inferior = r.lower_value;
  const superior = r.upper_value;
  if (inferior == null && superior == null) return '';
  if (inferior == null) return `<${superior} ${unidade}`;
  if (superior == null) return `≥${inferior} ${unidade}`;
  return `${inferior}–${superior} ${unidade}`;
}
function ritmoRangeParaZona(zona, modality) {
  const r = rangePerfilParaZona(zona, modality, 'pace');
  if (!r) return '';
  const unidade = modalidadeCanonica(modality) === 'natacao' ? '/100 m' : '/km';
  const inferior = r.lower_value;
  const superior = r.upper_value;
  if (inferior == null && superior == null) return '';
  if (inferior == null) return `<${fmtPaceEditavel(superior)}${unidade}`;
  if (superior == null) return `≥${fmtPaceEditavel(inferior)}${unidade}`;
  return `${fmtPaceEditavel(inferior)}–${fmtPaceEditavel(superior)}${unidade}`;
}
function intervalosZonaCardio(zona, modality) {
  if (!zona) return [];
  const modalidade = modalidadeCanonica(modality);
  const fc = bpmRangeParaZona(zona, modality);
  if (modalidade === 'ciclismo') return [potenciaRangeParaZona(zona, modality), fc].filter(Boolean);
  return [ritmoRangeParaZona(zona, modality), fc].filter(Boolean);
}
function alvoOuIntervaloCardio(intensidade, zona, modality) {
  const modalidade = modalidadeCanonica(modality);
  const intervaloPrincipal = modalidade === 'ciclismo'
    ? potenciaRangeParaZona(zona, modality)
    : ritmoRangeParaZona(zona, modality);
  if (modalidade === 'ciclismo' && Number(intensidade?.power_w) > 0) return `Alvo ${intensidade.power_w} W${intervaloPrincipal ? ` · ${intervaloPrincipal}` : ''}`;
  if (modalidade === 'natacao' && Number(intensidade?.pace_sec_per_100m) > 0) return `Alvo ${fmtPaceEditavel(intensidade.pace_sec_per_100m)}/100 m${intervaloPrincipal ? ` · ${intervaloPrincipal}` : ''}`;
  if (modalidade === 'corrida' && Number(intensidade?.pace_sec_per_km) > 0) return `Alvo ${fmtPaceEditavel(intensidade.pace_sec_per_km)}/km · ${ritmoParaKmh(intensidade.pace_sec_per_km)} km/h${intervaloPrincipal ? ` · ${intervaloPrincipal}` : ''}`;
  return intervaloPrincipal;
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
function diasEntreInclusivo(startIso, endIso) {
  if (!startIso || !endIso) return 0;
  return Math.round((dataDeIso(endIso) - dataDeIso(startIso)) / 86400000) + 1;
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
    notes: '',
    execution_mode: kind === 'list' ? 'free' : null,
  };
  if (kind === 'walk') return { ...base, walks: [], stairs_flights: null };
  if (kind === 'card' && modality === 'Natação') return { ...base, blocks: [], pool_length_m: 25, stroke: 'crol' };
  if (kind === 'card' || kind === 'circuit') return { ...base, blocks: [] };
  return { ...base, items: [] };
}
function cloneSession(s) {
  return structuredClone(s);
}

// Fases 1-2 (corrida + ciclismo) do spec-zonas-treino.md — todos os perfis activos em
// wo_zone_profiles/wo_zone_ranges para o doente escolhido, de qualquer modalidade (um
// plano pode ter sessões de corrida e de ciclismo em simultâneo). Carregado uma vez aqui
// (não a cada render) porque bpmRangeParaZona()/potenciaRangeParaZona() são chamadas a
// meio de uma construção de HTML em string — não podem ser assíncronas. Guardado em
// _state.zonaPerfis = { corrida: {heart_rate, pace}, ciclismo: {heart_rate, power} },
// cada entrada null ou a linha de wo_zone_profiles com wo_zone_ranges embutido.
function zonaPerfisVazio() {
  return { corrida: { heart_rate: null, pace: null }, ciclismo: { heart_rate: null, power: null } };
}

async function carregarZonaPerfis() {
  _state.zonaPerfis = zonaPerfisVazio();
  if (!_state.patient) return;

  const { data, error } = await window.sb
    .from('wo_zone_profiles')
    .select('*, wo_zone_ranges(*)')
    .eq('patient_id', _state.patient.id)
    .eq('is_active', true);

  if (error) {
    console.error('[prescricao] falha a carregar wo_zone_profiles:', error);
    return;
  }
  (data || []).forEach(row => {
    if (!_state.zonaPerfis[row.modality]) _state.zonaPerfis[row.modality] = {};
    _state.zonaPerfis[row.modality][row.metric] = row;
  });
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
  _patientHasFeedback = false;
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
  const { data: feedback } = await window.sb
    .from('wo_session_logs')
    .select('session_id')
    .eq('prescription_id', data.id)
    .limit(1);
  _patientHasFeedback = !!feedback?.length;
  refreshPatientFeedbackDot();
  _state.startDate = data.data?.startDate || _state.startDate;
  _state.endDate = data.data?.endDate || _state.endDate;
  _state.linkExpiryMode = data.data?.linkExpiryMode || 'selected_date';
  _state.linkExpiryDate = data.data?.linkExpiryDate || data.data?.endDate || null;
  _state.dataRevisao = data.data?.dataRevisao || null;
  _state.duracaoSessaoPadrao = data.data?.duracaoSessaoPadrao || 30;
  _state.diasPorSemanaHabitual = data.data?.diasPorSemanaHabitual ?? null;
  const restricoesGuardadas = Array.isArray(data.data?.restricoes) ? data.data.restricoes : [];
  _state.restricoesPredefinidas = restricoesGuardadas.filter(r => RESTRICOES_PREDEFINIDAS.includes(r));
  _state.restricoesTexto = restricoesGuardadas.filter(r => !RESTRICOES_PREDEFINIDAS.includes(r)).join('; ');
  _state.sessions = structuredClone(data.data?.sessions || []);
  // Isto veio da base de dados — não é trabalho por gravar. Sem isto, o aviso de "vais
  // perder sessões" apareceria logo ao abrir um plano já existente, mesmo sem tocar em nada.
  _state.__ultimoSnapshotGravado = JSON.stringify(_state.sessions);
}

/* ── Entry point ─────────────────────────────────────────── */
export async function initPrescricao(options = {}) {
  const root = document.getElementById('gcwoPrescricaoRoot');
  if (!root) return;

  ensurePrescricaoCss();
  _state = freshState();
  _landing = null;
  _expandedCardIds = new Set();
  _panelExpandedTarefaId = null;
  _panelDraft = null;
  _panelIsNovo = false;
  _step1Destination = 'prescription';
  _historyOpen = false;
  _historyDetail = null;
  document.getElementById('gcwoHistoryOverlay')?.remove();
  _dayPicker = null;
  document.getElementById('gcwoDayPickerOverlay')?.remove();
  _patologia = null;
  _patologiaPendente = null;
  _returnToAcompanhamento = options.returnToAcompanhamento || null;

  const clinicas = G.clinics || [];
  if (clinicas.length === 1) _state.clinicId = clinicas[0].id;

  loadExercisesCatalog(); // não bloqueia o primeiro render
  wireAvisoSairSemGravar();

  const patientId = options.patientId || null;
  const clinicId = options.clinicId || null;
  if (!patientId) {
    renderLanding();
    return;
  }

  _state.clinicId = clinicId || _state.clinicId;
  const { data: patient, error } = await window.sb
    .from('patients')
    .select('id,full_name,dob,phone,hr_zone_formula,hr_zones_bpm')
    .eq('id', patientId)
    .maybeSingle();
  if (error || !patient) {
    console.error('[prescricao] falha a abrir doente pré-seleccionado:', error);
    renderStep1();
    return;
  }
  _state.patient = patient;
  _loadingPlanoActivo = true;
  await Promise.all([carregarPlanoActivoSeExistir(), carregarZonaPerfis()]);
  _loadingPlanoActivo = false;
  if (options.mode === 'pathology') abrirPatologia();
  else if (options.mode === 'previous') { renderStep2(); openHistoryModal(); }
  else if (options.mode === 'catalog') initCatalogo({ onVoltar: voltarDaCatalogo });
  else renderStep2();
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
  const camposBase = 'id,name,categoria,equipamento,photo_url,tempo_concentrico_s,tempo_excentrico_s,tempo_exercicio_s,ajustes_maquina,is_favorite,incremento_default,video_url,tecnica_notas';
  let { data, error } = await window.sb
    .from('wo_exercises')
    .select(`${camposBase},tecnica_info`)
    .eq('is_active', true)
    .order('categoria')
    .order('name');

  if (error && (error.code === '42703' || error.code === 'PGRST204')) {
    ({ data, error } = await window.sb.from('wo_exercises').select(camposBase).eq('is_active', true).order('categoria').order('name'));
  }

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
let _patientFollowupTab = 'readiness';
let _patientMainTab = 'prescription';
let _patientHasFeedback = false;

function freshLanding() {
  return {
    clinicFilter: null, search: '', tab: 'todos', rows: [], attention: [],
    loading: true, attentionLoading: true, error: '', attentionError: ''
  };
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
  // Voltar à landing sem ter escolhido doente abandona qualquer selecção de "Exercícios
  // por patologia" por gravar — nunca deixa ficar pendente para se colar sem querer à
  // próxima prescrição (doente diferente, fluxo diferente).
  _patologia = null;
  _patologiaPendente = null;
  // Só reinicia tudo (incl. filtro de clínica) na primeira entrada no ecrã. Escolher
  // uma clínica chama renderLanding() outra vez para redesenhar — se isto fizesse
  // sempre freshLanding(), o filtro escolhido era apagado no mesmo instante em que
  // era escolhido.
  if (!_landing) _landing = freshLanding();
  else {
    _landing.loading = true; _landing.attentionLoading = true;
    _landing.rows = []; _landing.attention = []; _landing.error = ''; _landing.attentionError = '';
  }

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

    <section class="gcwo-landing-group" aria-labelledby="gcwoPrescricaoTitle">
      <div class="gcwo-landing-group-head">
        <div><span class="gcwo-landing-kicker">Área de trabalho</span><h2 id="gcwoPrescricaoTitle">Prescrição de exercício</h2></div>
        <p>Criar, rever e preparar os planos dos doentes.</p>
      </div>
      <div class="gcwo-landing-cards">
      <button type="button" class="gcwo-landing-card primary" id="gcwoCardPrescrever">
        <span class="gcwo-landing-card-icon">${ICON_MAIS}</span>
        <span class="gcwo-landing-card-title">Prescrever exercício</span>
        <span class="gcwo-landing-card-sub">Escolher um doente e abrir o respetivo acompanhamento digital.</span>
        <span class="gcwo-landing-card-cta">Procurar doente →</span>
      </button>
      <button type="button" class="gcwo-landing-card" id="gcwoCardPatologia">
        <span class="gcwo-landing-card-icon doc">${ICON_FLAG}</span>
        <span class="gcwo-landing-card-title">Exercícios por patologia</span>
        <span class="gcwo-landing-card-sub">Escolher um doente e preparar o programa por patologia no seu acompanhamento.</span>
        <span class="gcwo-landing-card-cta">Procurar doente →</span>
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
    </section>

    <section class="gcwo-attention" aria-labelledby="gcwoAttentionTitle">
      <div class="gcwo-landing-tablehead">
        <h2 class="gcwo-section-title" id="gcwoAttentionTitle">Precisa da minha atenção <span class="count" id="gcwoAttentionCount"></span></h2>
        <p>Exercício, diário e questionários numa fila clínica única.</p>
      </div>
      <div id="gcwoAttentionHost"><div class="gcwo-muted" style="padding:14px 2px;">A carregar…</div></div>
    </section>

    <section class="gcwo-landing-tablesec" id="gcwoLandingTableSec">
      <div class="gcwo-landing-tablehead">
        <h2 class="gcwo-section-title" id="gcwoLandingTableTitle">Doentes em acompanhamento <span class="count" id="gcwoLandingCount"></span></h2>
      </div>
      <div class="gcwo-landing-toolbar">
        <div class="gc-search-bar">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5.5" stroke="#94a3b8" stroke-width="1.4"/><path d="M11 11l3 3" stroke="#94a3b8" stroke-width="1.4" stroke-linecap="round"/></svg>
          <input id="gcwoLandingSearch" type="search" class="gc-search-input" placeholder="Pesquisar doente…" autocomplete="off" spellcheck="false">
        </div>
        <div class="gcwo-landing-tabs" id="gcwoLandingTabs">
          <button type="button" class="on" data-tab="todos">Todos</button>
          <button type="button" data-tab="aterminar">A terminar</button>
          <button type="button" data-tab="feedback">Com atividade nova</button>
        </div>
      </div>
      <div id="gcwoLandingTableHost"></div>
    </section>
  `;

  document.getElementById('gcwoCardPrescrever').addEventListener('click', () => {
    _step1Destination = 'acompanhamento';
    renderStep1();
  });
  document.getElementById('gcwoCardCatalogo').addEventListener('click', () => {
    initCatalogo({ onVoltar: () => { loadExercisesCatalog(); renderLanding(); } });
  });
  document.getElementById('gcwoCardPatologia').addEventListener('click', () => {
    _step1Destination = 'acompanhamento';
    renderStep1();
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
    searchTimer = setTimeout(() => { renderLandingTableHost(); renderLandingAttention(); }, 150);
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

function podeLerDiarioClinico() {
  if (window.__GC_IS_SUPERADMIN__) return true;
  if (String(G.role || '').toLowerCase() === 'medico') return true;
  return Object.values(G.myClinicRoles || {}).some(role => ['medico', 'super_admin'].includes(String(role || '').toLowerCase()));
}

function fmtDataHoraClinica(value) {
  if (!value) return '—';
  try { return new Date(value).toLocaleString('pt-PT', { dateStyle: 'medium', timeStyle: 'short' }); }
  catch (_) { return String(value); }
}

function tipoAtencaoMeta(tipo) {
  const mapa = {
    exercise_readiness: { rotulo: 'Exercício · Antes de começar', cls: 'exercise' },
    exercise_session: { rotulo: 'Exercício · Treino', cls: 'exercise' },
    diary_entry: { rotulo: 'Diário clínico', cls: 'diary' },
    intake_completed: { rotulo: 'Questionário concluído', cls: 'intake' },
  };
  return mapa[tipo] || { rotulo: tipo, cls: 'other' };
}

function renderLandingAttention() {
  const host = document.getElementById('gcwoAttentionHost');
  const count = document.getElementById('gcwoAttentionCount');
  if (!host || !_landing) return;
  if (_landing.attentionLoading) { host.innerHTML = '<div class="gcwo-muted" style="padding:14px 2px;">A carregar…</div>'; return; }
  if (_landing.attentionError) { host.innerHTML = `<div class="gcwo-muted" style="padding:14px 2px;">${escHtml(_landing.attentionError)}</div>`; return; }
  const termo = _landing.search.trim().toLowerCase();
  const items = _landing.attention.filter(item => !termo || (item.patientName || '').toLowerCase().includes(termo));
  if (count) count.textContent = `${items.length} registo${items.length === 1 ? '' : 's'}`;
  if (!items.length) { host.innerHTML = '<div class="gcwo-attention-empty">Sem novos registos clínicos para mostrar.</div>'; return; }
  host.innerHTML = `<div class="gcwo-attention-list">${items.map(item => {
    const meta = tipoAtencaoMeta(item.type);
    return `<article class="gcwo-attention-item">
      <span class="gcwo-attention-dot ${meta.cls}"></span>
      <div class="gcwo-attention-main"><strong>${escHtml(item.patientName)}</strong><span>${escHtml(meta.rotulo)} · ${escHtml(fmtDataHoraClinica(item.at))}</span><small>${escHtml(item.summary || '')}</small></div>
      <span class="gcwo-attention-new">NOVO</span>
      <button type="button" class="gcBtnOutline gcBtnSm" data-attention-open="${escAttr(item.key)}">Ver</button>
    </article>`;
  }).join('')}</div>`;
  host.querySelectorAll('[data-attention-open]').forEach(btn => btn.addEventListener('click', () => {
    const item = _landing.attention.find(row => row.key === btn.getAttribute('data-attention-open'));
    if (item) abrirAtencao(item);
  }));
}

function abrirFeedDoente(patientId, clinicId) {
  const params = new URLSearchParams({ patientId: patientId || '', sessionClinicId: clinicId || '' });
  window.open(`/modules/consulta/v2/consulta-completa/feed-doente.html?${params.toString()}`, '_blank', 'noopener');
}

function fecharModalClinico() { document.getElementById('gcwoClinicalViewer')?.remove(); }

function imprimirModalClinico() {
  const modal = document.getElementById('gcwoClinicalViewer');
  const titulo = modal?.querySelector('.gcwo-modal-head h3')?.textContent || 'Registo clínico';
  const subtitulo = modal?.querySelector('.gcwo-modal-head small')?.textContent || '';
  const corpo = modal?.querySelector('#gcwoClinicalBody')?.innerHTML || '';
  if (!modal || !corpo) return;
  const pagina = `<!doctype html><html lang="pt-PT"><head><meta charset="utf-8"><title>${escHtml(titulo)}</title><style>
    @page{size:A4;margin:16mm}*{box-sizing:border-box}body{margin:0;color:#0f172a;font:12px/1.45 Arial,sans-serif}.printbar{position:sticky;top:0;z-index:2;display:flex;justify-content:flex-end;padding:10px 16px;background:#0f2d52}.printbar button{padding:9px 16px;border:0;border-radius:7px;background:#fff;color:#0f2d52;font-weight:700;cursor:pointer}.page{max-width:900px;margin:0 auto;padding:22px}h1{margin:0;color:#0f2d52;font-size:20px}header{padding-bottom:12px;border-bottom:2px solid #0f2d52;margin-bottom:14px}header p{margin:4px 0 0;color:#64748b}.gcwo-readonly-note{display:none}.gcwo-answer-section{break-inside:avoid;margin:0 0 14px}.gcwo-answer-section h4{margin:0;padding:7px 9px;border-radius:5px;background:#edf2f7;color:#0f2d52;font-size:13px}.gcwo-answer-row{display:grid;grid-template-columns:42% 58%;gap:12px;padding:7px 9px;border-bottom:1px solid #e2e8f0;break-inside:avoid}.gcwo-answer-row span{color:#64748b}.gcwo-answer-row strong{font-weight:600;white-space:pre-wrap}.gcwo-diary-timeline{display:block}.gcwo-diary-timeline article{break-inside:avoid;margin-bottom:9px;padding:9px 11px;border:1px solid #e2e8f0;border-left:3px solid #0f8a74;border-radius:6px}.gcwo-diary-timeline time{color:#64748b;font-size:10px;font-weight:700}.gcwo-diary-timeline p{margin:5px 0 0;white-space:pre-wrap}.gcwo-diary-images{display:flex;gap:7px;flex-wrap:wrap;margin-top:7px}.gcwo-diary-images span{display:none}.gcwo-diary-images img{width:110px;height:82px;border-radius:5px;object-fit:cover}.muted{color:#94a3b8}@media print{.printbar{display:none}.page{max-width:none;margin:0;padding:0}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style></head><body><div class="printbar"><button type="button" onclick="window.print()">Imprimir esta página</button></div><main class="page"><header><h1>${escHtml(titulo)}</h1><p>${escHtml(subtitulo)}</p></header>${corpo}</main></body></html>`;
  const url = URL.createObjectURL(new Blob([pagina], { type: 'text/html;charset=utf-8' }));
  const janela = window.open(url, '_blank');
  if (!janela) { URL.revokeObjectURL(url); alert('O navegador bloqueou a janela de impressão. Autorize janelas pop-up para este endereço.'); return; }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function criarModalClinico(titulo, subtitulo) {
  fecharModalClinico();
  const overlay = document.createElement('div');
  overlay.id = 'gcwoClinicalViewer'; overlay.className = 'gcwo-modal-overlay';
  overlay.innerHTML = `<div class="gcwo-modal gcwo-clinical-modal"><div class="gcwo-modal-head"><div><h3>${escHtml(titulo)}</h3><small>${escHtml(subtitulo || '')}</small></div><button type="button" class="gcwo-print-btn" id="gcwoClinicalPrint">Imprimir</button><button type="button" id="gcwoClinicalClose" title="Fechar">${ICON_CLOSE}</button></div><div class="gcwo-modal-body" id="gcwoClinicalBody"><div class="gcwo-muted">A carregar…</div></div></div>`;
  overlay.addEventListener('click', event => { if (event.target === overlay) fecharModalClinico(); });
  document.body.appendChild(overlay);
  document.getElementById('gcwoClinicalClose')?.addEventListener('click', fecharModalClinico);
  document.getElementById('gcwoClinicalPrint')?.addEventListener('click', imprimirModalClinico);
  return document.getElementById('gcwoClinicalBody');
}

function respostaClinicaHtml(value) {
  if (value == null || value === '') return '<span class="muted">Sem resposta</span>';
  if (Array.isArray(value)) return escHtml(value.join(', '));
  if (typeof value === 'object') {
    if ('v' in value) {
      const principal = Array.isArray(value.v) ? value.v.join(', ') : value.v;
      return escHtml([principal, value.outro_texto].filter(Boolean).join(' · '));
    }
    return escHtml(Object.entries(value).map(([k, v]) => `${k}: ${v}`).join(' · '));
  }
  return escHtml(String(value));
}

async function abrirQuestionarioLeitura(item) {
  const body = criarModalClinico(`Questionário — ${item.patientName}`, `Concluído em ${fmtDataHoraClinica(item.at)} · apenas leitura`);
  try {
    const [{ data: respostas, error }, configModule] = await Promise.all([
      window.sb.from('intake_responses').select('question_id,answer,updated_at').eq('token_id', item.sourceId),
      import(`../../intake/configs/${item.questionnaireType}.js`),
    ]);
    if (error) throw error;
    const cfg = configModule.default;
    const porId = new Map((respostas || []).map(r => [r.question_id, r.answer]));
    body.innerHTML = `<div class="gcwo-readonly-note">Histórico protegido: este ecrã não altera nem elimina respostas.</div>${(cfg.seccoes || []).map(sec => {
      const perguntas = (sec.perguntas || []).filter(p => porId.has(p.id));
      if (!perguntas.length) return '';
      return `<section class="gcwo-answer-section"><h4>${escHtml(sec.titulo)}</h4>${perguntas.map(p => `<div class="gcwo-answer-row"><span>${escHtml(p.label)}</span><strong>${respostaClinicaHtml(porId.get(p.id))}</strong></div>`).join('')}</section>`;
    }).join('')}`;
  } catch (error) {
    console.error('[prescricao] falha a ler questionário:', error);
    body.innerHTML = '<div class="gcwo-muted">Não foi possível abrir as respostas deste questionário.</div>';
  }
}

async function abrirDiarioLeitura(item) {
  if (!podeLerDiarioClinico()) return;
  const body = criarModalClinico(`Diário clínico — ${item.patientName}`, 'Registos cronológicos · apenas leitura');
  const { data, error } = await window.sb.from('patient_diary_entries')
    .select('id,entered_at,raw_text,images').eq('patient_id', item.patientId).order('entered_at', { ascending: false }).limit(200);
  if (error) { console.error('[prescricao] falha a ler diário:', error); body.innerHTML = '<div class="gcwo-muted">Não foi possível abrir o diário clínico.</div>'; return; }
  body.innerHTML = `<div class="gcwo-readonly-note">Registos do doente. Este ecrã não permite editar ou apagar.</div><div class="gcwo-diary-timeline">${(data || []).map(row => `<article><time>${escHtml(fmtDataHoraClinica(row.entered_at))}</time><p>${escHtml(row.raw_text || 'Registo com imagem')}</p>${Array.isArray(row.images) && row.images.length ? `<div class="gcwo-diary-images">${row.images.map((path, index) => `<span data-diary-image="${escAttr(path)}">Imagem ${index + 1} a carregar…</span>`).join('')}</div>` : ''}</article>`).join('') || '<div class="gcwo-muted">Sem registos no diário.</div>'}</div>`;
  await Promise.all(Array.from(body.querySelectorAll('[data-diary-image]')).map(async host => {
    const path = host.getAttribute('data-diary-image');
    const { data: signed, error: signedError } = await window.sb.storage.from('patient-diary').createSignedUrl(path, 300);
    if (signedError || !signed?.signedUrl) { host.textContent = 'Imagem indisponível'; return; }
    host.innerHTML = `<a href="${escAttr(signed.signedUrl)}" target="_blank" rel="noopener"><img src="${escAttr(signed.signedUrl)}" alt="Imagem enviada pelo doente"></a>`;
  }));
}

function abrirAtencao(item) {
  if (item.type === 'intake_completed') { abrirQuestionarioLeitura(item); return; }
  if (item.type === 'diary_entry') { abrirDiarioLeitura(item); return; }
  const row = _landing.rows.find(r => r.patient?.id === item.patientId && r.id === item.prescriptionId);
  if (item.type === 'exercise_session' && row?.lastLog) { abrirFeedbackModal(row); return; }
  abrirFeedDoente(item.patientId, item.clinicId);
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
  if (countEl) countEl.textContent = `${linhas.length} doente${linhas.length === 1 ? '' : 's'}`;

  if (!linhas.length) {
    host.innerHTML = `<div class="gcwo-muted" style="padding:14px 2px;">Sem doentes para mostrar aqui.</div>`;
    return;
  }

  host.innerHTML = `
    <div class="gcwo-tablewrap">
      <table class="gcwo-readtable gcwo-landing-table">
        <thead><tr>
          <th>Doente</th><th>Plano</th><th>Exercício</th><th>Diário</th><th>Questionário</th><th>Última atividade</th><th>Situação</th>
        </tr></thead>
        <tbody>
          ${linhas.map(r => `
            <tr data-rid="${escAttr(r.id)}" class="gcwo-landing-row">
              <td><strong>${escHtml(r.patient?.full_name || '—')}</strong></td>
              <td class="muted">${escHtml(fmtIntervaloPlano(r.startDate, r.expiresAt))}</td>
              <td>${r.lastLog ? `<button type="button" class="gcwo-feedback-btn" data-feedback-rid="${escAttr(r.id)}">Ver treino</button>` : '<span class="muted">Sem treino</span>'}</td>
              <td>${podeLerDiarioClinico() ? (r.lastDiary ? `<button type="button" class="gcwo-clinical-link" data-diary-rid="${escAttr(r.id)}">${escHtml(fmtRelativo(new Date(r.lastDiary.entered_at)))}</button>` : '<span class="muted">Sem registo</span>') : '<span class="muted">Restrito</span>'}</td>
              <td>${r.lastIntake ? `<button type="button" class="gcwo-clinical-link" data-intake-rid="${escAttr(r.id)}">Respondido</button>` : '<span class="muted">—</span>'}</td>
              <td class="muted">${escHtml(fmtRelativo(r.lastActivityAt))}</td>
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
      Promise.all([carregarPlanoActivoSeExistir(), carregarZonaPerfis()]).finally(() => {
        _loadingPlanoActivo = false;
        renderStep2Body();
      });
    });
  });
  host.querySelectorAll('[data-feedback-rid]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const row = _landing.rows.find(x => x.id === btn.getAttribute('data-feedback-rid'));
      if (row?.lastLog) abrirFeedbackModal(row);
    });
  });
  host.querySelectorAll('[data-diary-rid]').forEach(btn => btn.addEventListener('click', event => {
    event.stopPropagation();
    const row = _landing.rows.find(x => x.id === btn.getAttribute('data-diary-rid'));
    if (row?.lastDiary) abrirDiarioLeitura({ patientId: row.patient.id, patientName: row.patient.full_name, at: row.lastDiary.entered_at });
  }));
  host.querySelectorAll('[data-intake-rid]').forEach(btn => btn.addEventListener('click', event => {
    event.stopPropagation();
    const row = _landing.rows.find(x => x.id === btn.getAttribute('data-intake-rid'));
    if (row?.lastIntake) abrirQuestionarioLeitura({ patientName: row.patient.full_name, at: row.lastIntake.completed_at || row.lastIntake.created_at, sourceId: row.lastIntake.id, questionnaireType: row.lastIntake.questionnaire_type });
  }));
}

function fecharFeedbackModal() {
  document.getElementById('gcwoFeedbackOverlay')?.remove();
}

function nomeEntradaFeedback(entrada, sessao) {
  const item = (sessao?.items || []).find(it => it.exercise_id === entrada.exercise_id);
  if (item) return item.name;
  const block = (sessao?.blocks || []).find(b => b.block_id === entrada.block_id);
  if (block) return block.name || block.label || 'Bloco';
  const walk = (sessao?.walks || []).find(w => w.walk_id === entrada.walk_id);
  return walk?.label || entrada.exercise_name || 'Exercício';
}

function renderSeriesFeedback(series) {
  if (!Array.isArray(series) || !series.length) return '';
  return `<div class="gcwo-feedback-series">${series.map((s, i) => {
    if (s.skipped) return `<div><b>Série ${i + 1}</b><span class="nao">Não realizada</span></div>`;
    const partes = [];
    if (s.reps != null) partes.push(`${escHtml(String(s.reps))} repetições`);
    if (s.load != null && s.load !== '') partes.push(`${escHtml(String(s.load))} kg`);
    if (s.duration_sec != null) partes.push(`${Math.round(Number(s.duration_sec) / 60 * 10) / 10} min`);
    return `<div><b>Série ${i + 1}</b><span>${partes.join(' · ') || 'Realizada'}</span></div>`;
  }).join('')}</div>`;
}

function abrirFeedbackModal(row) {
  fecharFeedbackModal();
  const log = row.lastLog;
  const sessao = (row.prescriptionData?.sessions || []).find(s => s.session_id === log.session_id);
  const entradas = Array.isArray(log.sets) ? log.sets : [];
  const feelLabels = ['—', 'Muito mal', 'Mal', 'Normal', 'Bem', 'Muito bem'];
  const overlay = document.createElement('div');
  overlay.id = 'gcwoFeedbackOverlay';
  overlay.className = 'gcwo-modal-overlay';
  overlay.addEventListener('click', (e) => { if (e.target === overlay) fecharFeedbackModal(); });
  overlay.innerHTML = `
    <div class="gcwo-modal">
      <div class="gcwo-modal-head"><h3>Resultado do treino</h3><button type="button" id="gcwoFeedbackClose" title="Fechar">${ICON_CLOSE}</button></div>
      <div class="gcwo-modal-body">
        <div class="gcwo-feedback-who"><strong>${escHtml(row.patient?.full_name || '')}</strong><span>${escHtml(sessao?.modality || 'Sessão')} · ${escHtml(new Date(log.logged_at).toLocaleString('pt-PT', { dateStyle: 'medium', timeStyle: 'short' }))}</span></div>
        <div class="gcwo-feedback-metrics">
          <div><b>${escHtml(String(log.rpe))}/10</b><span>Esforço</span></div>
          <div><b>${escHtml(String(log.feel))}/5</b><span>${escHtml(feelLabels[log.feel] || 'Bem-estar')}</span></div>
        </div>
        <div class="gcwo-feedback-list">${entradas.map(entrada => {
          const estado = entrada.status === 'as_prescribed' ? 'Como planeado' : entrada.status === 'skipped' ? 'Não realizado' : 'Alterado';
          const cls = entrada.status === 'as_prescribed' ? 'feito' : entrada.status === 'skipped' ? 'nao' : 'alterado';
          return `<div class="gcwo-feedback-item"><div class="gcwo-feedback-item-head"><strong>${escHtml(nomeEntradaFeedback(entrada, sessao))}</strong><span class="${cls}">${estado}</span></div>${renderSeriesFeedback(entrada.series)}</div>`;
        }).join('') || '<div class="gcwo-muted">Sem detalhe de exercícios neste registo.</div>'}</div>
        ${log.note ? `<div class="gcwo-feedback-note"><b>Nota do doente</b><br>${escHtml(log.note)}</div>` : ''}
        <div class="gcwo-feedback-images" id="gcwoFeedbackImages"><span>A carregar imagens privadas…</span></div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('gcwoFeedbackClose').addEventListener('click', fecharFeedbackModal);
  carregarImagensFeedback(row.id, log.session_id);
}

async function carregarImagensFeedback(prescriptionId, sessionId) {
  const host = document.getElementById('gcwoFeedbackImages');
  if (!host) return;
  try {
    const body = new FormData();
    body.append('action', 'list');
    body.append('prescription_id', prescriptionId);
    const { data, error } = await window.sb.functions.invoke('wo-session-image', { body });
    if (error || !data?.ok) throw new Error('sem acesso');
    const images = (data.images || []).filter(image => image.session_id === sessionId && image.signed_url);
    if (!images.length) { host.innerHTML = '<span>Sem imagens associadas a este treino.</span>'; return; }
    host.innerHTML = `<b>Imagens do treino</b><div>${images.map((image, index) => `<a href="${escAttr(image.signed_url)}" target="_blank" rel="noopener"><img src="${escAttr(image.signed_url)}" alt="Imagem ${index + 1} enviada pelo doente"></a>`).join('')}</div>`;
  } catch (_) {
    host.innerHTML = '<span>Não foi possível carregar as imagens privadas.</span>';
  }
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
    .select('id,patient_id,clinic_id,created_at,expires_at,status,data,patients(id,full_name,dob,hr_zone_formula,hr_zones_bpm),clinics(name)')
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
      .select('prescription_id, session_id, logged_at, rpe, feel, sets, note')
      .in('prescription_id', ids)
      .order('logged_at', { ascending: false });
    if (logsErr) {
      console.error('[prescricao] falha a carregar wo_session_logs:', logsErr);
    } else {
      (logs || []).forEach(l => {
        if (!logsByRx.has(l.prescription_id)) logsByRx.set(l.prescription_id, l);
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
      // Início real do plano — vem de data.startDate (a data escolhida no calendário),
      // não de created_at (quando o registo foi gravado, que pode ser um dia antes de o
      // plano começar, ou continuar igual depois de o plano ser editado). Cai para
      // created_at só em registos antigos sem data.startDate gravado (9 ago 2026).
      startDate: r.data?.startDate ? dataDeIso(r.data.startDate) : new Date(r.created_at),
      expiresAt: new Date(r.expires_at),
      prescriptionData: r.data || {},
      lastLog: logsByRx.get(r.id) || null,
      lastLogAt: logsByRx.has(r.id) ? new Date(logsByRx.get(r.id).logged_at) : null,
    }));
  _landing.loading = false;
  renderLandingTableHost();
  await loadLandingAttention(clinicIds);
}

async function loadLandingAttention(clinicIds) {
  _landing.attentionLoading = true;
  renderLandingAttention();
  try {
    const prescriptionIds = _landing.rows.map(row => row.id);
    const canReadDiary = podeLerDiarioClinico();
    const [readinessRes, diaryRes, intakeRes] = await Promise.all([
      prescriptionIds.length
        ? window.sb.from('wo_session_readiness')
          .select('id,prescription_id,patient_id,clinic_id,feeling,has_symptoms,symptom_note,answered_at')
          .in('prescription_id', prescriptionIds).eq('has_symptoms', true).order('answered_at', { ascending: false }).limit(100)
        : Promise.resolve({ data: [], error: null }),
      canReadDiary
        ? window.sb.from('patient_diary_entries')
          .select('id,patient_id,clinic_id,entered_at,raw_text,images,patients(id,full_name)')
          .in('clinic_id', clinicIds).order('entered_at', { ascending: false }).limit(200)
        : Promise.resolve({ data: [], error: null }),
      window.sb.from('intake_tokens')
        .select('id,patient_id,clinic_id,questionnaire_type,status,completed_at,created_at,patients(id,full_name)')
        .in('clinic_id', clinicIds).eq('status', 'completed').order('completed_at', { ascending: false }).limit(100),
    ]);

    [readinessRes, diaryRes, intakeRes].forEach(result => {
      if (result.error) throw result.error;
    });
    const rowByPatient = new Map(_landing.rows.map(row => [row.patient?.id, row]));
    const latestDiaryByPatient = new Map();
    (diaryRes.data || []).forEach(entry => {
      if (!latestDiaryByPatient.has(entry.patient_id)) latestDiaryByPatient.set(entry.patient_id, entry);
    });
    const attention = [];
    (readinessRes.data || []).forEach(entry => {
      const row = rowByPatient.get(entry.patient_id);
      if (!row) return;
      attention.push({
        key: `readiness:${entry.id}`, type: 'exercise_readiness', sourceId: entry.id,
        prescriptionId: entry.prescription_id, patientId: entry.patient_id, clinicId: entry.clinic_id,
        patientName: row.patient.full_name, at: entry.answered_at,
        summary: entry.symptom_note || 'O doente indicou sintomas ou dor antes do treino.',
      });
    });
    _landing.rows.filter(row => row.lastLog).forEach(row => {
      const sets = Array.isArray(row.lastLog.sets) ? row.lastLog.sets : [];
      const alterado = sets.some(entry => entry.status && entry.status !== 'as_prescribed');
      if (!row.lastLog.note && !alterado && Number(row.lastLog.rpe || 0) < 8) return;
      attention.push({
        key: `session:${row.id}:${row.lastLog.session_id}`, type: 'exercise_session', sourceId: row.lastLog.session_id,
        prescriptionId: row.id, patientId: row.patient.id, clinicId: row.clinicId,
        patientName: row.patient.full_name, at: row.lastLog.logged_at,
        summary: row.lastLog.note || (alterado ? 'Treino realizado com alterações.' : `Esforço elevado: ${row.lastLog.rpe}/10.`),
      });
    });
    latestDiaryByPatient.forEach(entry => attention.push({
      key: `diary:${entry.id}`, type: 'diary_entry', sourceId: entry.id,
      patientId: entry.patient_id, clinicId: entry.clinic_id,
      patientName: entry.patients?.full_name || rowByPatient.get(entry.patient_id)?.patient?.full_name || 'Doente',
      at: entry.entered_at, summary: entry.raw_text || 'Novo registo com imagem.',
    }));
    (intakeRes.data || []).forEach(token => attention.push({
      key: `intake:${token.id}`, type: 'intake_completed', sourceId: token.id,
      patientId: token.patient_id, clinicId: token.clinic_id, questionnaireType: token.questionnaire_type,
      patientName: token.patients?.full_name || rowByPatient.get(token.patient_id)?.patient?.full_name || 'Doente',
      at: token.completed_at || token.created_at, summary: 'Respostas disponíveis para leitura clínica.',
    }));
    const latestIntakeByPatient = new Map();
    (intakeRes.data || []).forEach(token => { if (!latestIntakeByPatient.has(token.patient_id)) latestIntakeByPatient.set(token.patient_id, token); });
    _landing.rows.forEach(row => {
      row.lastDiary = latestDiaryByPatient.get(row.patient.id) || null;
      row.lastIntake = latestIntakeByPatient.get(row.patient.id) || null;
      const dates = [row.lastLogAt, row.lastDiary?.entered_at, row.lastIntake?.completed_at || row.lastIntake?.created_at].filter(Boolean).map(value => new Date(value));
      row.lastActivityAt = dates.length ? new Date(Math.max(...dates.map(value => value.getTime()))) : null;
    });
    _landing.attention = attention.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
  } catch (error) {
    console.error('[prescricao] falha a carregar fila de atenção:', error);
    _landing.attentionError = 'Não foi possível carregar todos os registos clínicos.';
  } finally {
    _landing.attentionLoading = false;
    renderLandingTableHost();
    renderLandingAttention();
  }
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
        <div class="gc-page-title">Escolher doente</div><div class="gc-page-sub">${_step1Destination === 'acompanhamento' ? 'Abrir configuração do acompanhamento' : 'Nova prescrição'}</div>
      </div>
      ${topActionsHtml()}
    </div>
    <div class="gcwo-step1-wrap">
      <div class="gcwo-step1-card">
        <p class="gcwo-step1-intro">${_step1Destination === 'acompanhamento' ? 'Selecione o doente para configurar, prescrever e gerir a sua ligação única de acompanhamento.' : 'Cria uma prescrição de exercício para um doente — sessões de ginásio ou de modalidade, com tarefas e séries — e gera um link de acesso sem login para ele seguir o plano.'}</p>

        <span class="gcwo-field-label">Procurar doente</span>
        <div class="gc-search-bar gcwo-patient-search-wrap">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5.5" stroke="#94a3b8" stroke-width="1.4"/><path d="M11 11l3 3" stroke="#94a3b8" stroke-width="1.4" stroke-linecap="round"/></svg>
          <div id="gcwoPatientQuery" class="gc-search-input gcwo-patient-searchbox" role="searchbox" aria-label="Nome, SNS, NIF ou telefone" contenteditable="plaintext-only" data-placeholder="Nome, SNS, NIF ou telefone" spellcheck="false"></div>
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
    timer = setTimeout(() => runPatientSearch(input.textContent), 250);
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
        const selectedClinicId = p.active_clinic_id || _state.clinicId;
        if (_step1Destination === 'acompanhamento') {
          if (!selectedClinicId) {
            alert('Este doente não tem uma clínica ativa identificada.');
            return;
          }
          if (typeof window.__gc_openAcompanhamentoPanel !== 'function') {
            alert('Não foi possível abrir a configuração do acompanhamento.');
            return;
          }
          window.__gc_openAcompanhamentoPanel(p.id, selectedClinicId);
          return;
        }
        _state.patient = p;
        _state.clinicId = selectedClinicId;
        _panelDraft = null; _panelIsNovo = false; _pendingSlot = null; // doente novo — nunca herdar edição do doente anterior
        _loadingPlanoActivo = true;
        renderStep2();
        Promise.all([carregarPlanoActivoSeExistir(), carregarZonaPerfis()]).finally(() => {
          _loadingPlanoActivo = false;
          // Só depois do plano activo (se existir) já ter resolvido startDate/sessions — a(s)
          // sessão(ões) vinda(s) de "Exercícios por patologia" (EX-07) caem na janela certa.
          aplicarPatologiaPendenteAoEstado();
          renderStep2Body();
        });
      });
    });
  }
}

/* ── Cabeçalho do doente — idade + restrições em chips numa linha ── */
function renderPatientBanner() {
  return `
    <div class="gcwo-patient-banner">
      <div class="gcwo-restricoes-line" id="gcwoRestricoesLine">${restricoesLineHtml()}</div>
      <button type="button" class="gcwo-restricoes-editbtn" id="gcwoRestricoesEditBtn" title="Editar restrições">${ICON_PENCIL}<span>Editar restrições</span></button>
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
  const ultimoTreino = ultimoDiaPrescrito();
  return `
    <div class="gcwo-plan-settings">
      <div class="gcwo-settings-head">
        <div><h2 class="gcwo-section-title">Configuração do plano</h2><p>Defina o período e a validade do acesso do doente.</p></div>
        <div class="gcwo-plan-summary" id="gcwoDuracaoInfo">${escHtml(fmtJanelaPlanoIso(_state.startDate, _state.endDate))}</div>
      </div>
      <div class="gcwo-settings-grid">
        <div class="gcwo-settings-group">
          <span class="gcwo-settings-label">Período do plano</span>
          <div class="gcwo-datasplano-row">
            <label class="gcwo-field"><span>Início</span><input type="date" id="gcwoDataInicio" value="${_state.startDate}"></label>
            <label class="gcwo-field"><span>Fim</span><input type="date" id="gcwoDataFim" value="${_state.endDate}" min="${_state.startDate}"></label>
            <label class="gcwo-field"><span>Revisão <small>opcional</small></span><input type="date" id="gcwoDataRevisao" value="${_state.dataRevisao || ''}"></label>
          </div>
        </div>
        <div class="gcwo-settings-group gcwo-link-settings">
          <span class="gcwo-settings-label">Acesso do doente</span>
          <div class="gcwo-datasplano-row">
            <label class="gcwo-field gcwo-link-mode"><span>Validade do link</span><select id="gcwoValidadeLink">
              <option value="last_session"${_state.linkExpiryMode === 'last_session' ? ' selected' : ''}>Até ao último treino</option>
              <option value="selected_date"${_state.linkExpiryMode === 'selected_date' ? ' selected' : ''}>Escolher outra data</option>
            </select></label>
            ${_state.linkExpiryMode === 'selected_date' ? `<label class="gcwo-field"><span>Link válido até</span><input type="date" id="gcwoDataValidadeLink" value="${_state.linkExpiryDate || _state.endDate}" min="${ultimoTreino || _state.startDate}"></label>` : ''}
          </div>
          <div class="gcwo-link-hint">${_state.linkExpiryMode === 'last_session' ? (ultimoTreino ? `Termina em ${escHtml(fmtDataPtIso(ultimoTreino))}.` : 'Será calculada ao adicionar o primeiro treino.') : 'Nunca pode terminar antes do último treino.'}</div>
        </div>
      </div>
    </div>`;
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
  document.getElementById('gcwoValidadeLink').addEventListener('change', (e) => {
    _state.linkExpiryMode = e.target.value;
    if (_state.linkExpiryMode === 'selected_date' && !_state.linkExpiryDate) _state.linkExpiryDate = _state.endDate;
    renderStep2Body();
  });
  document.getElementById('gcwoDataValidadeLink')?.addEventListener('change', (e) => {
    _state.linkExpiryDate = e.target.value || null;
  });
}

function ultimoDiaPrescrito() {
  return (_state.sessions || []).map(s => s.date).filter(Boolean).sort().at(-1) || null;
}

/* ================================================================
   PASSO 2 — plano semanal
   ================================================================ */
function renderStep2() {
  const root = document.getElementById('gcwoPrescricaoRoot');
  if (!root) return;

  const p = _state.patient;
  const idade = calcIdade(p.dob);
  // _panelDraft/_pendingSlot NÃO se reiniciam aqui — renderStep2() é chamado outra vez
  // ao voltar do Catálogo (topActionsHtml) a meio de uma edição, e essa edição tem de
  // sobreviver à viagem (o comportamento de sempre, antes dos 2 modos).

  root.innerHTML = `
    <div class="gcwo-step2-shell">
    <div class="gc-page-header gcwo-patient-header">
      <div class="gcwo-patient-main">${_returnToAcompanhamento ? '<button type="button" class="gcwo-backlink acompanhamento" id="gcwoStep2BackToAcompanhamento">← Voltar ao acompanhamento do doente</button>' : ''}<div class="gc-page-eyebrow">Prescrição de exercício</div><div class="gcwo-patient-name-row"><div class="gc-page-title">${escHtml(p.full_name)}</div><span class="gcwo-patient-age">${idade != null ? `${idade} anos` : 'Idade não indicada'}</span><button type="button" class="gcwo-linkbtn" id="gcwoVerHistorico">Planos anteriores</button>${renderPatientBanner()}</div></div>
      ${topActionsHtml(`
        <button type="button" class="gcBtnGhost" id="gcwoTrocarDoente">Escolher doente</button>
      `, false, false)}
    </div>

    <div class="gcwo-patient-main-tabs" role="tablist" aria-label="Áreas da ficha de exercício">
      <button type="button" role="tab" data-patient-main-tab="prescription" class="${_patientMainTab === 'prescription' ? 'on' : ''}">Prescrição</button>
      <button type="button" role="tab" data-patient-main-tab="followup" class="${_patientMainTab === 'followup' ? 'on' : ''}">Acompanhamento<span class="gcwo-main-tab-dot" title="Existem resultados de treino" ${_patientHasFeedback ? '' : 'hidden'}></span></button>
    </div>
    <div id="gcwoStep2Body"></div>
    </div>
  `;

  wireTopActions();
  wirePatientBanner();
  wirePatientMainTabs();
  document.getElementById('gcwoStep2BackToAcompanhamento')?.addEventListener('click', () => {
    if (haSessoesPorGravar() && !window.confirm('Há sessões no calendário que ainda não foram gravadas — se saíres agora, perdem-se.\n\nSair mesmo assim?')) return;
    window.__gc_openAcompanhamentoPanel(_returnToAcompanhamento.patientId, _returnToAcompanhamento.clinicId);
  });
  document.getElementById('gcwoVerHistorico').addEventListener('click', () => openHistoryModal());
  document.getElementById('gcwoTrocarDoente').addEventListener('click', () => {
    closeHistoryModal();
    _returnToAcompanhamento = null; // doente escolhido à mão deixa de ter ligação ao acompanhamento de que se partiu
    _state.patient = null;
    _state.zonaPerfis = zonaPerfisVazio();
    _state.restricoesPredefinidas = [];
    _state.restricoesTexto = '';
    _state.restricoesEditing = false;
    _state.startDate = isoAmanha();
    _state.endDate = addDiasIso(_state.startDate, 27);
    _state.dataRevisao = null;
    _state.sessions = [];
    _state.activePrescriptionId = null;
    _patientHasFeedback = false;
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
  if (step2EmEdicao()) {
    _patientMainTab = 'prescription';
    refreshPatientMainTabs();
    renderEditMode(host);
  } else if (_patientMainTab === 'followup') {
    host.innerHTML = renderPatientFollowupSection();
    wirePatientFollowupSection();
  } else renderCalendarMode(host);
}

function refreshPatientMainTabs() {
  document.querySelectorAll('[data-patient-main-tab]').forEach(btn => btn.classList.toggle('on', btn.getAttribute('data-patient-main-tab') === _patientMainTab));
}

function refreshPatientFeedbackDot() {
  const dot = document.querySelector('.gcwo-main-tab-dot');
  if (dot) dot.hidden = !_patientHasFeedback;
}

function wirePatientMainTabs() {
  document.querySelectorAll('[data-patient-main-tab]').forEach(btn => btn.addEventListener('click', () => {
    if (step2EmEdicao() && btn.getAttribute('data-patient-main-tab') !== 'prescription') return;
    _patientMainTab = btn.getAttribute('data-patient-main-tab');
    refreshPatientMainTabs();
    renderStep2Body();
  }));
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
    <section class="gcwo-prescription-card">
      <div class="gcwo-prescription-head"><div><h2>Prescrição de exercício</h2><p>Definição do plano e calendário.</p></div><span>${escHtml(diasEntreInclusivo(_state.startDate, _state.endDate))} dias</span></div>
      ${renderDatasPlanoSection()}
    <div class="gcwo-calendar-card">
      <div class="gcwo-cal-head">
        <div><h2 class="gcwo-section-title">Calendário do plano</h2><p>Adicione um treino no dia pretendido.</p></div>
        <div class="gcwo-cal-nav">
          <button type="button" class="gcBtnGhost gcBtnSm" id="gcwoCalAnterior">‹ Duas anteriores</button>
          <span id="gcwoCalIntervalo" class="gcwo-cal-nav-label"></span>
          <button type="button" class="gcBtnGhost gcBtnSm" id="gcwoCalSeguinte">Duas seguintes ›</button>
        </div>
      </div>
      <div id="gcwoCalGrid"></div>
    </div>

    <div class="gcwo-generate">
      <div class="gcwo-generate-copy"><strong>${_returnToAcompanhamento ? 'Pronto para guardar?' : (_state.activePrescriptionId ? 'Plano em curso' : 'Plano pronto?')}</strong><span>${_returnToAcompanhamento ? 'O plano ficará disponível na ligação geral do doente.' : (_state.activePrescriptionId ? 'Guarde as alterações ou termine o plano quando deixar de ser necessário.' : 'O link só fica disponível depois de guardar a prescrição.')}</span></div>
      <span id="gcwoGerarErro" class="gcwo-erro"></span>
      <span id="gcwoPorGravarAviso" class="gcwo-porgravar-aviso" style="display:${haSessoesPorGravar() ? '' : 'none'}">⚠ As sessões do calendário só ficam realmente gravadas depois de clicares aqui.</span>
      <div class="gcwo-generate-actions">
        ${_state.activePrescriptionId ? '<button type="button" id="gcwoTerminarPlano" class="gcBtnDanger gcBtnLg">Terminar plano</button>' : ''}
        <button type="button" id="gcwoGerar" class="gcBtnSuccess gcBtnLg" ${hasSessionComExercicios() ? '' : 'disabled'} title="${hasSessionComExercicios() ? '' : 'Adiciona pelo menos uma sessão com conteúdo para criar o plano.'}">${labelBotaoGerar()}</button>
      </div>
    </div>
    </section>
  `;

  wireDatasPlanoSection();
  renderCalGrid();
  document.getElementById('gcwoCalAnterior').addEventListener('click', () => navegarCalendario(-14));
  document.getElementById('gcwoCalSeguinte').addEventListener('click', () => navegarCalendario(14));
  document.getElementById('gcwoGerar').addEventListener('click', handleGerar);
  document.getElementById('gcwoTerminarPlano')?.addEventListener('click', (e) => terminarPlanoActivo(_state.activePrescriptionId, e.currentTarget));
}

function renderPatientFollowupSection() {
  return `<section class="gcwo-patient-followup gcwo-patient-followup-tab">
    <div class="gcwo-followup-title"><div><h2>Acompanhamento</h2><span>Dados recolhidos antes e depois do treino.</span></div></div>
    <div class="gcwo-followup-tabs" role="tablist">
      <button type="button" role="tab" data-followup-tab="readiness" class="${_patientFollowupTab === 'readiness' ? 'on' : ''}">Prontidão de hoje</button>
      <button type="button" role="tab" data-followup-tab="sessions" class="${_patientFollowupTab === 'sessions' ? 'on' : ''}">Treinos realizados</button>
    </div>
    <div class="gcwo-followup-content" id="gcwoPatientFollowupContent">${_patientFollowupTab === 'readiness' ? `
      <div class="gcwo-readiness-empty"><span class="dot"></span><div><b>Sem dados de prontidão para hoje</b><p>Ainda não existe avaliação pré-treino nem ligação a VRC, sono ou energia. Não são usados dados inventados.</p></div></div>
      <div class="gcwo-planned-session">${sessaoHojeResumoHtml()}</div>` : '<div class="gcwo-muted">A carregar os treinos registados…</div>'}</div>
  </section>`;
}

function sessaoHojeResumoHtml() {
  const sessoes = (_state.sessions || []).filter(s => s.date === isoHoje());
  if (!sessoes.length) return '<span>Sem sessão prevista para hoje.</span>';
  return `<div><b>Sessão prevista</b><span>${sessoes.map(s => TIPO_META[tipoKey(s)]?.label || s.modality || 'Sessão').join(' · ')}</span></div>`;
}

function wirePatientFollowupSection() {
  document.querySelectorAll('[data-followup-tab]').forEach(btn => btn.addEventListener('click', () => {
    _patientFollowupTab = btn.getAttribute('data-followup-tab');
    const current = document.querySelector('.gcwo-patient-followup');
    const wrap = document.createElement('div'); wrap.innerHTML = renderPatientFollowupSection();
    current?.replaceWith(wrap.firstElementChild); wirePatientFollowupSection();
  }));
  if (_patientFollowupTab === 'sessions') carregarLeituraTreinosDoDoente();
}

async function carregarLeituraTreinosDoDoente() {
  const host = document.getElementById('gcwoPatientFollowupContent');
  if (!host) return;
  if (!_state.activePrescriptionId) { host.innerHTML = '<div class="gcwo-readiness-empty"><div><b>Ainda não há plano activo</b><p>Os resultados surgirão depois da primeira prescrição e do primeiro treino registado.</p></div></div>'; return; }
  const { data, error } = await window.sb.from('wo_session_logs').select('session_id,logged_at,rpe,feel,note').eq('prescription_id', _state.activePrescriptionId).order('logged_at', { ascending:false }).limit(30);
  if (error) { host.innerHTML = '<div class="gcwo-muted">Não foi possível carregar os treinos.</div>'; return; }
  if (!data?.length) { host.innerHTML = '<div class="gcwo-readiness-empty"><div><b>Sem treinos registados</b><p>O feedback aparecerá aqui ligado à sessão correspondente.</p></div></div>'; return; }
  const { data: readinessData, error: readinessError } = await window.sb.from('wo_session_readiness').select('session_id,feeling,has_symptoms,symptom_note,answered_at').eq('prescription_id', _state.activePrescriptionId);
  const readinessPorSessao = new Map((readinessError ? [] : readinessData || []).map(registo => [registo.session_id, registo]));
  const nomesSentir = [null, 'Muito mal', 'Mal', 'Razoável', 'Bem', 'Muito bem'];
  host.innerHTML = `<div class="gcwo-followup-context"><strong>Treino realizado pelo doente</strong><span>Compara como o doente estava antes da sessão com a resposta registada no final. Uma resposta isolada não condiciona automaticamente o treino.</span></div><div class="gcwo-training-reading">${data.map(log => {
    const sessao = (_state.sessions || []).find(s => s.session_id === log.session_id);
    const readiness = readinessPorSessao.get(log.session_id);
    const antes = readiness ? `<div class="gcwo-training-before"><b>Antes do treino</b><span>Como se sentia: <strong>${escHtml(nomesSentir[readiness.feeling] || '—')}</strong></span><span>Sintomas ou dor: <strong>${readiness.has_symptoms ? 'Sim' : 'Não'}</strong></span>${readiness.symptom_note ? `<p>${escHtml(readiness.symptom_note)}</p>` : ''}</div>` : '<div class="gcwo-training-before empty"><b>Antes do treino</b><span>Prontidão não avaliada.</span></div>';
    return `<article><div><b>${escHtml(TIPO_META[tipoKey(sessao || {})]?.label || sessao?.modality || 'Treino')}</b><span>Realizado em ${escHtml(new Date(log.logged_at).toLocaleString('pt-PT', { dateStyle:'medium', timeStyle:'short' }))}</span></div>${antes}<div class="metrics"><span>Esforço final <b>${escHtml(log.rpe ?? '—')}/10</b></span><span>Bem-estar final <b>${escHtml(log.feel ?? '—')}/5</b></span></div>${log.note ? `<p>${escHtml(log.note)}</p>` : ''}</article>`;
  }).join('')}</div>`;
}

// Segundas-feiras (ISO) das semanas a desenhar: sempre pelo menos 4, e nunca menos do
// que as necessárias para o calendário chegar a endDate — se o plano for mais comprido
// do que 4 semanas, o calendário estica para mostrar tudo (9 ago 2026). Substitui o
// antigo "N semanas fixas escolhidas no topo"; usado também pelo day-picker (mover/
// duplicar), para oferecer sempre exactamente os mesmos dias que estão à vista.
function semanasParaMostrar() {
  const segInicio = segundaFeiraDeIso(_state.startDate);
  const segFim = segundaFeiraDeIso(_state.endDate);
  if (!_calendarFirstMonday || _calendarFirstMonday < segInicio || _calendarFirstMonday > segFim) {
    _calendarFirstMonday = segInicio;
  }
  return [_calendarFirstMonday, addDiasIso(_calendarFirstMonday, 7)];
}

function navegarCalendario(dias) {
  _calendarFirstMonday = addDiasIso(_calendarFirstMonday || segundaFeiraDeIso(_state.startDate), dias);
  renderCalGrid();
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
  const primeiroDia = semanas[0];
  const ultimoDia = addDiasIso(semanas[1], 6);
  const intervalo = document.getElementById('gcwoCalIntervalo');
  if (intervalo) intervalo.textContent = `${fmtDiaMesCurtoIso(primeiroDia)} – ${fmtDiaMesCurtoIso(ultimoDia)}`;
  const anterior = document.getElementById('gcwoCalAnterior');
  const seguinte = document.getElementById('gcwoCalSeguinte');
  if (anterior) anterior.disabled = addDiasIso(primeiroDia, -1) < segundaFeiraDeIso(_state.startDate);
  if (seguinte) seguinte.disabled = addDiasIso(ultimoDia, 1) > addDiasIso(segundaFeiraDeIso(_state.endDate), 6);

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
                const meta = metaSessao(s);
                const momentoLabel = MOMENTOS_SESSAO.find(m => m.value === s.momento)?.label;
                const modoLabel = s.kind === 'list' && modoExecucaoGinasio(s) === 'guided' ? 'Guiado' : null;
                return `
                <div class="gcwo-calsession-row" data-sid="${s.session_id}">
                  <span class="gcwo-calsession-handle" data-drag-sid="${s.session_id}" title="Arrastar para mover">${ICON_GRIP}</span>
                  <button type="button" class="gcwo-calsession-body" data-edit-session="${s.session_id}">
                    <span class="gcwo-calsession-icon" style="background:${meta.bg};color:${meta.fg}">${meta.icon}</span>
                    <span class="gcwo-calsession-name">${escHtml(nomeCurtoSessao(s))}</span>
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

function nomeCurtoSessao(s) {
  if (tipoKey(s) === 'patologia') return metaSessao(s).label;
  const nomes = { list:'Gin.', ginasio:'Gin.', corrida:'Corrida', ciclismo:'Cicl.', natacao:'Natação', caminhada:'Caminh.', walk:'Caminh.', circuito:'Circuito', circuit:'Circuito' };
  return nomes[tipoKey(s)] || TIPO_META[tipoKey(s)]?.label || 'Treino';
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

function prescricaoEstaActiva(p) {
  return p?.status === 'active' && (!p.expires_at || new Date(p.expires_at) > new Date());
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
            ${prescricaoEstaActiva(_historyDetail) ? '<button type="button" class="gcBtnDanger gcBtnSm" id="gcwoHistTerminar">Terminar este plano</button>' : ''}
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
  document.getElementById('gcwoHistTerminar')?.addEventListener('click', (e) => terminarPlanoActivo(_historyDetail?.id, e.currentTarget));
}

async function terminarPlanoActivo(prescriptionId, btn) {
  if (!prescriptionId || !_state.patient) return;
  const nome = _state.patient.full_name || 'este doente';
  const regressoAcompanhamento = _returnToAcompanhamento
    ? { ..._returnToAcompanhamento }
    : null;
  const confirmou = window.confirm(
    `Terminar o plano de ${nome}?\n\nO link deixa imediatamente de funcionar. Os treinos realizados e o histórico ficam guardados.`
  );
  if (!confirmou) return;

  const textoAnterior = btn?.textContent || 'Terminar plano';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'A terminar…';
  }

  const { data, error } = await window.sb
    .from('wo_prescriptions')
    .update({ status: 'revoked' })
    .eq('id', prescriptionId)
    .eq('patient_id', _state.patient.id)
    .eq('status', 'active')
    .select('id')
    .maybeSingle();

  if (error || !data) {
    console.error('[prescricao] falha ao terminar plano:', error?.message || 'plano já não estava activo');
    window.alert('Não foi possível terminar o plano. Actualize a página e tente novamente.');
    if (btn) {
      btn.disabled = false;
      btn.textContent = textoAnterior;
    }
    return;
  }

  closeHistoryModal();
  _state.activePrescriptionId = null;
  _state.patient = null;
  _state.sessions = [];
  _state.__ultimoSnapshotGravado = null;
  if (regressoAcompanhamento && typeof window.__gc_openAcompanhamentoPanel === 'function') {
    window.alert('Plano terminado. Os exercícios foram retirados do calendário e o histórico foi preservado.');
    window.__gc_openAcompanhamentoPanel(regressoAcompanhamento.patientId, regressoAcompanhamento.clinicId);
    return;
  }
  window.alert('Plano terminado. O link deixou de funcionar e o histórico foi preservado.');
  renderLanding();
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
        <span class="tdesc">${escHtml({
          'Ginásio': 'Máquinas, TRX, bandas e peso corporal',
          'Corrida': 'Tempo, distância, ritmo e zonas Z1–Z5',
          'Ciclismo': 'Tempo, distância, potência e Coggan Z1–Z7',
          'Natação': 'Distância, ritmo/100 m e zonas A1–SP3',
          'Caminhada': 'Tempo, distância e intensidade',
          'Circuito': 'Exercícios organizados por voltas',
          'Outra atividade': 'Nome e instruções personalizadas',
        }[t.modality] || '')}</span>
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
  _panelCatalogFiltro = 'todos';
  _panelCatalogBusca = '';
  _panelEquipFiltro = new Set();
  _pendingSlot = null;
  renderStep2Body();
}
function openPanelEditar(sessionId) {
  const s = _state.sessions.find(x => x.session_id === sessionId);
  if (!s) return;
  _panelCatalogFiltro = 'todos';
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
  const cabecalhoCardio = s.kind === 'card' ? `
      <div class="gcwo-cardio-head-local">
        <span class="gcwo-field-label">Local</span>
        <div class="gcwo-chips" id="gcwoPLocalChips">
          ${LOCAIS_SESSAO.map(l => `<button type="button" class="gcwo-chip${s.local === l ? ' on' : ''}" data-local="${escAttr(l)}">${escHtml(l)}</button>`).join('')}
        </div>
      </div>
      <button type="button" class="gcBtnGhost gcwo-session-zones" id="gcwoBtnZonasTreino">♥ ⚡ Zonas</button>` : '';

  panel.innerHTML = `
    <div class="gcwo-panel-head${s.kind === 'card' ? ' gcwo-cardio-panel-head' : ''}">
      <span class="gcwo-panel-icon" style="background:${meta.bg};color:${meta.fg}">${meta.icon}</span>
      <span class="gcwo-panel-titles"><h3>${meta.label}</h3><span class="sub">${dia.full}, ${escHtml(fmtDiaMesCurtoIso(s.date))}</span></span>
      ${cabecalhoCardio}
      ${!_panelIsNovo ? `<button type="button" class="gcwo-panel-headbtn" id="gcwoPanelApagar" title="Apagar sessão">${ICON_TRASH}</button>` : ''}
      <button type="button" class="gcwo-panel-headbtn close" id="gcwoPanelFechar" title="Fechar">${ICON_CLOSE}</button>
    </div>
    <div class="gcwo-panel-body">
      ${s.kind === 'card' ? '' : `<div class="gcwo-session-setup-row${s.kind === 'list' ? '' : ' no-objective'}">
        <div class="gcwo-session-local-top">
          <span class="gcwo-field-label">Local</span>
          <div class="gcwo-chips" id="gcwoPLocalChips">
            ${LOCAIS_SESSAO.map(l => `<button type="button" class="gcwo-chip${s.local === l ? ' on' : ''}" data-local="${escAttr(l)}">${escHtml(l)}</button>`).join('')}
          </div>
        </div>
        ${s.kind === 'list' ? renderObjectiveControls() : ''}
        <button type="button" class="gcBtnGhost gcwo-session-zones" id="gcwoBtnZonasTreino">♥ ⚡ Zonas</button>
      </div>`}

      ${s.kind === 'list' ? renderCatalogPickerSection(s) : ''}
      ${s.kind === 'walk' ? renderPanelCaminhada(s) : ''}
      ${s.kind === 'card' ? renderPanelCardio(s) : ''}
      ${s.kind === 'circuit' ? renderPanelCircuito(s) : ''}

      <details class="gcwo-session-details">
        <summary>Horário, modo de realização e anotações</summary>
        <div class="gcwo-session-details-body">
          <span class="gcwo-field-label">Momento do dia (opcional)</span>
          <div class="gcwo-chips" id="gcwoPMomentoChips">
            <button type="button" class="gcwo-chip${!s.momento ? ' on' : ''}" data-momento="">Sem indicar</button>
            ${MOMENTOS_SESSAO.map(m => `<button type="button" class="gcwo-chip${s.momento === m.value ? ' on' : ''}" data-momento="${m.value}">${escHtml(m.label)}</button>`).join('')}
          </div>
          ${s.kind === 'list' ? `
            <span class="gcwo-field-label">Como o doente realizará o treino</span>
            <div class="gcwo-mode-choice" id="gcwoPExecutionMode">
              <button type="button" class="gcwo-mode-card${modoExecucaoGinasio(s) === 'free' ? ' on' : ''}" data-execution-mode="free"><strong>Sem Tempo</strong><span>Regista séries, repetições e cargas ao seu ritmo.</span></button>
              <button type="button" class="gcwo-mode-card${modoExecucaoGinasio(s) === 'guided' ? ' on' : ''}" data-execution-mode="guided"><strong>Guiado</strong><span>O telefone conduz a sequência e os descansos.</span></button>
            </div>` : ''}
          <label class="gcwo-field gcwo-session-notes"><span>Anotações para esta sessão (opcional)</span><textarea id="gcwoPNotes" rows="2" placeholder="Atividades programadas, alternativas ou instruções específicas…">${escHtml(s.notes || '')}</textarea></label>
        </div>
      </details>

      <div class="gcwo-review-strip">
        <div><strong>Rever antes de colocar no calendário</strong><span id="gcwoPReviewCount">${sessaoContagem(s).n} ${sessaoContagem(s).label} · ${escHtml(meta.label)}</span></div>
        <span class="gcwo-review-safe">Nada é gravado antes da confirmação</span>
      </div>

      <span class="gcwo-erro" id="gcwoPErro"></span>
    </div>
    <div class="gcwo-panel-footer">
      <button type="button" class="gcBtnGhost" id="gcwoPCancelar">Cancelar</button>
      <button type="button" class="gcBtnSuccess" id="gcwoPGuardar">Colocar no calendário</button>
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
  document.getElementById('gcwoBtnZonasTreino')?.addEventListener('click', () => {
    abrirZonasTreino(_state.patient.id, { onSaved: carregarZonaPerfis });
  });

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
  document.getElementById('gcwoPNotes').addEventListener('input', (e) => { s.notes = e.target.value; });
  document.getElementById('gcwoPExecutionMode')?.querySelectorAll('[data-execution-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      s.execution_mode = btn.getAttribute('data-execution-mode');
      document.querySelectorAll('#gcwoPExecutionMode .gcwo-mode-card').forEach(card => card.classList.toggle('on', card === btn));
    });
  });

  if (s.kind === 'list') wireCatalogPicker(s);
  if (s.kind === 'walk') wirePanelCaminhada(s);
  if (s.kind === 'card') wirePanelCardio(s);
  if (s.kind === 'circuit') wirePanelCircuito(s);
}

function refreshReviewCount(s) {
  const el = document.getElementById('gcwoPReviewCount');
  if (!el) return;
  const contagem = sessaoContagem(s);
  el.textContent = `${contagem.n} ${contagem.label} · ${TIPO_META[tipoKey(s)].label}`;
}

/* ── Painel — catálogo de exercícios (grelha, favoritos por omissão) ── */
function renderCatalogPickerSection(s) {
  return `
    <div class="gcwo-gym-workspace">
      <section class="gcwo-gym-catalog">
        <div class="gcwo-workspace-title"><strong>1. Escolher exercícios</strong><span id="gcwoPPickedCount">${s.items.length} escolhido${s.items.length === 1 ? '' : 's'}</span></div>
        <div class="gcwo-filter-line"><span class="gcwo-filter-label">Mostrar</span><div class="gcwo-chips" id="gcwoPCatFiltro">
          ${CATALOG_FILTROS.map(f => `<button type="button" class="gcwo-chip${_panelCatalogFiltro === f.value ? ' on' : ''}" data-filtro="${escAttr(f.value)}">${escHtml(f.label)}</button>`).join('')}
        </div></div>
        <div class="gcwo-filter-line"><span class="gcwo-filter-label">Material</span><div class="gcwo-chips gcwo-equip-chips" id="gcwoPEquipFiltro">
          ${EQUIPAMENTO_FILTROS.map(eq => `<button type="button" class="gcwo-chip${_panelEquipFiltro.has(eq) ? ' on' : ''}" data-equip="${escAttr(eq)}">${escHtml(eq)}</button>`).join('')}
        </div></div>
        <div class="gc-search-bar">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5.5" stroke="#94a3b8" stroke-width="1.4"/><path d="M11 11l3 3" stroke="#94a3b8" stroke-width="1.4" stroke-linecap="round"/></svg>
          <input id="gcwoPCatBusca" type="search" class="gc-search-input" placeholder="Pesquisar exercício…" autocomplete="off" spellcheck="false" value="${escAttr(_panelCatalogBusca)}">
        </div>
        <div class="gcwo-catpick-grid" id="gcwoPCatGrid">${renderCatalogPickerGrid(s)}</div>
      </section>

      <section class="gcwo-gym-plan">
        <div class="gcwo-workspace-title"><strong>2. Plano de treino</strong><span id="gcwoPDuration">${escHtml(fmtDuracaoEstimadaSessao(s))}</span></div>
        <div class="gcwo-exercicios" id="gcwoPPickedList">${renderPickedListInner(s)}</div>
        <div class="gcwo-progressao-nota">A prescrição por série permite cargas e repetições diferentes no mesmo exercício.</div>
      </section>
    </div>
  `;
}

function renderObjectiveControls() {
  return `<div class="gcwo-objective-row">
      <span class="gcwo-field-label">Objectivo</span>
      <div class="gcwo-presets" id="gcwoPPresets">
        <button type="button" data-preset="perda">Perda de gordura</button>
        <button type="button" data-preset="hipertrofia">Hipertrofia</button>
        <button type="button" data-preset="forca">Força</button>
        <button type="button" data-preset="personalizado">Personalizado</button>
      </div>
    </div>`;
}

function filteredCatalogForPanel() {
  const busca = (_panelCatalogBusca || '').trim().toLowerCase();
  let list = _state.exercisesCatalog;
  if (_panelCatalogFiltro === 'favoritos') list = list.filter(e => e.is_favorite);
  else if (_panelCatalogFiltro !== 'todos') list = list.filter(e => Array.isArray(e.categoria) && e.categoria.includes(_panelCatalogFiltro));
  list = list.filter(e => exercicioBateFiltroEquipamento(e, _panelEquipFiltro));
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
    const addedIndex = s.items.findIndex(it => it.exercise_id === ex.id);
    const added = addedIndex >= 0;
    return `
      <div class="gcwo-catpick-card${added ? ' added' : ''}" data-exid="${escAttr(ex.id)}" role="button" tabindex="0" title="${added ? 'Remover da sessão' : 'Adicionar à sessão'}">
        <button type="button" class="gcwo-catpick-star${ex.is_favorite ? ' on' : ''}" data-favorite-exid="${escAttr(ex.id)}" aria-label="${ex.is_favorite ? 'Retirar dos favoritos' : 'Adicionar aos favoritos'}">${ex.is_favorite ? '★' : '☆'}</button>
        ${ex.photo_url ? `<span class="gcwo-catpick-photo"><img src="${escAttr(ex.photo_url)}" alt=""></span>` : `<span class="gcwo-catpick-photo empty"></span>`}
        <span class="gcwo-catpick-name">${escHtml(ex.name)}</span>
        ${added ? `<span class="gcwo-catpick-check" title="Ordem no plano">${addedIndex + 1}</span>` : ''}
      </div>`;
  }).join('');
}

async function alternarFavoritoCatalogo(exId, s) {
  const ex = _state.exercisesCatalog.find(e => e.id === exId);
  if (!ex) return;
  const anterior = Boolean(ex.is_favorite);
  ex.is_favorite = !anterior;
  const grid = document.getElementById('gcwoPCatGrid');
  if (grid) grid.innerHTML = renderCatalogPickerGrid(s);
  wireGridCardClicks(s);
  const { error } = await window.sb.from('wo_exercises').update({ is_favorite: ex.is_favorite }).eq('id', exId);
  if (error) {
    ex.is_favorite = anterior;
    console.error('[prescricao] falha a actualizar favorito:', error);
    if (grid) grid.innerHTML = renderCatalogPickerGrid(s);
    wireGridCardClicks(s);
  }
}

// Sem reps_fixed definido → intervalo (o modo por omissão de qualquer exercício novo).
function itemRepsMode(it) {
  return it.reps_fixed != null ? 'fixo' : 'intervalo';
}

// Variante "por duração" (decisão de 8 de agosto de 2026, briefing secção 3): um item de
// ginásio tem `duration_sec` OU sets/reps/incremento/rest_set, nunca os dois. `rest_next`
// aplica-se sempre, independentemente do modo. Excepção (decisão de 23 de agosto de 2026):
// `load` deixa de ser sempre nulo em modo duração quando o exercício usa equipamento
// externo — ver itemUsaEquipamentoExterno.
function itemDuracaoMode(it) {
  return it.duration_sec != null || (Array.isArray(it.duration_series) && it.duration_series.length) ? 'duracao' : 'series';
}

// Exercícios só de peso corporal (equipamento vazio ou só "Peso Corporal") nunca mostram/gravam
// carga em modo Duração. Qualquer outra etiqueta (Halteres, Máquina, TRX, Elásticos) — mesmo
// combinada com "Peso Corporal", caso do Hip Thrust com Halteres — conta como equipamento externo.
function itemUsaEquipamentoExterno(it) {
  return (it.equipamento || []).some(eq => eq && eq !== 'Peso Corporal');
}

function seriesDuracaoPrescritasItem(it) {
  if (Array.isArray(it.duration_series) && it.duration_series.length) return it.duration_series;
  return [{ duration_sec: it.duration_sec ?? 30 }];
}

function sincronizarResumoDuracao(it) {
  const series = seriesDuracaoPrescritasItem(it);
  it.duration_series = series;
  it.duration_sec = series.length === 1 ? series[0].duration_sec : null;
  it.sets = series.length;
}

function exercicioUsaTempoPorDefeito(ex) {
  const nome = (ex?.name || '').toLowerCase();
  return ['bicicleta', 'prancha', 'plank', 'wall sit', 'cadeira na parede', 'isométric'].some(termo => nome.includes(termo));
}

function seriesPrescritasItem(it) {
  if (Array.isArray(it.series) && it.series.length) return it.series;
  const total = Math.max(1, Number(it.sets) || 3);
  const reps = it.reps_fixed != null ? it.reps_fixed : (it.reps_max ?? 12);
  return Array.from({ length: total }, () => ({ reps, load: it.load ?? null }));
}

function sincronizarResumoSeries(it) {
  const series = seriesPrescritasItem(it);
  it.series = series;
  it.sets = series.length;
  const reps = series.map(s => s.reps).filter(v => v != null && v !== '');
  const cargas = series.map(s => s.load).filter(v => v != null && v !== '');
  if (reps.length === series.length && reps.every(v => Number(v) === Number(reps[0]))) {
    it.reps_fixed = Number(reps[0]); it.reps_min = null; it.reps_max = null;
  } else {
    it.reps_fixed = null;
    it.reps_min = reps.length ? Math.min(...reps.map(Number)) : null;
    it.reps_max = reps.length ? Math.max(...reps.map(Number)) : null;
  }
  it.load = cargas.length === series.length && cargas.every(v => Number(v) === Number(cargas[0])) ? Number(cargas[0]) : null;
}

function duracaoEstimadaItem(it) {
  const descansoFinal = Math.max(0, Number(it.rest_next) || 0);
  if (itemDuracaoMode(it) === 'duracao') {
    const series = seriesDuracaoPrescritasItem(it);
    const trabalho = series.reduce((total, serie) => total + Math.max(0, Number(serie.duration_sec) || 0), 0);
    const pausas = Math.max(0, series.length - 1) * Math.max(0, Number(it.rest_set) || 0);
    return trabalho + pausas + descansoFinal;
  }
  const series = seriesPrescritasItem(it);
  const segundosPorRepeticao = Math.max(1,
    (Number(it.tempo_excentrico_s) || 0) + (Number(it.pausa_inferior_s) || 0) +
    (Number(it.tempo_concentrico_s) || 0) + (Number(it.pausa_superior_s) || 0));
  const trabalho = series.reduce((total, serie) => total + Math.max(0, Number(serie.reps) || 0) * segundosPorRepeticao, 0);
  const pausas = Math.max(0, series.length - 1) * Math.max(0, Number(it.rest_set) || 0);
  return trabalho + pausas + descansoFinal;
}

function duracaoEstimadaSessao(s) {
  return (s.items || []).reduce((total, item) => total + duracaoEstimadaItem(item), 0);
}

function fmtDuracaoEstimadaSessao(s) {
  if (!(s.items || []).length) return 'Tempo estimado: —';
  const segundos = duracaoEstimadaSessao(s);
  const minutos = Math.max(1, Math.round(segundos / 60));
  return `Tempo estimado: ≈ ${minutos} min`;
}

function refreshDuracaoEstimada(s) {
  const el = document.getElementById('gcwoPDuration');
  if (el) el.textContent = fmtDuracaoEstimadaSessao(s);
}

function renderPickedListInner(s) {
  if (!s.items.length) return `<div class="gcwo-muted">Nenhum exercício seleccionado ainda.</div>`;
  return s.items.map((item, index) => renderItemCard(item, index)).join('');
}

function renderItemCard(it, index) {
  const modoDuracao = itemDuracaoMode(it);
  const duracaoRadioName = `gcwo-duracaomode-${it.exercise_id}`;
  const series = modoDuracao === 'series' ? seriesPrescritasItem(it) : [];
  const seriesDuracao = modoDuracao === 'duracao' ? seriesDuracaoPrescritasItem(it) : [];
  return `
    <div class="gcwo-exercicio" data-exid="${escAttr(it.exercise_id)}">
      <div class="gcwo-exercicio-head">
        <span class="gcwo-exercicio-drag" title="Arrastar para ordenar">${ICON_GRIP}</span>
        <span class="gcwo-exercicio-order" title="Ordem no plano">${index + 1}</span>
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
      <label class="gcwo-exercicio-nota-clinica">
        <span>Instrução específica para este doente</span>
        <textarea class="gcwo-it-prescription-note" rows="2" placeholder="Ex.: Executar apenas entre 0–45°. Não completar até 90°.">${escHtml(it.prescription_note || '')}</textarea>
      </label>
      ${modoDuracao === 'duracao' ? `
        <div class="gcwo-series-table">
          <div class="gcwo-series-head gcwo-duration-head"><span>Série</span><span>Tempo (s)</span><span></span></div>
          ${seriesDuracao.map((serie, index) => `<div class="gcwo-series-row gcwo-duration-row" data-duration-series-index="${index}">
            <b>${index + 1}</b>
            <input type="number" min="1" class="gcwo-serie-duration" value="${serie.duration_sec ?? ''}" aria-label="Tempo da série ${index + 1} em segundos">
            <button type="button" class="gcwo-duration-delete" title="Remover série" ${seriesDuracao.length <= 1 ? 'disabled' : ''}>✕</button>
          </div>`).join('')}
          <button type="button" class="gcwo-add-duration-serie">+ Série</button>
        </div>
        ${itemUsaEquipamentoExterno(it) ? `
        <label class="gcwo-field gcwo-field-sm" style="margin-top:8px;"><span>Carga (kg)</span><input type="number" min="0" step="0.5" class="gcwo-it-carga" value="${it.load ?? ''}" aria-label="Carga (kg)"></label>
        ` : ''}
      ` : `
        <div class="gcwo-series-table">
          <div class="gcwo-series-head"><span>Série</span><span>Repetições</span><span>Carga (kg)</span><span></span></div>
          ${series.map((serie, index) => `<div class="gcwo-series-row" data-series-index="${index}">
            <b>${index + 1}</b>
            <input type="number" min="0" class="gcwo-serie-reps" value="${serie.reps ?? ''}" aria-label="Repetições da série ${index + 1}">
            <input type="number" min="0" step="0.5" class="gcwo-serie-load" value="${serie.load ?? ''}" aria-label="Carga da série ${index + 1}">
            <button type="button" class="gcwo-serie-delete" title="Remover série" ${series.length <= 1 ? 'disabled' : ''}>✕</button>
          </div>`).join('')}
          <button type="button" class="gcwo-add-serie">+ Série</button>
        </div>
      `}
      <details class="gcwo-exercicio-mais">
        <summary>＋ Opções personalizadas</summary>
        <div class="gcwo-exercicio-mais-grid">
          <label class="gcwo-field gcwo-field-sm"><span>Descanso entre séries (s)</span><input type="number" min="0" class="gcwo-it-restset" value="${it.rest_set ?? ''}"></label>
          <label class="gcwo-field gcwo-field-sm"><span>Antes do próximo (s)</span><input type="number" min="0" class="gcwo-it-restnext" value="${it.rest_next ?? ''}"></label>
          <label class="gcwo-field gcwo-field-sm"><span>Incremento (kg)</span><input type="number" min="0" step="0.5" class="gcwo-it-incremento" value="${it.incremento ?? ''}"></label>
          <label class="gcwo-field gcwo-field-sm"><span>Excêntrico (s)</span><input type="number" min="0" step="0.5" class="gcwo-it-tempoexc" value="${it.tempo_excentrico_s ?? ''}"></label>
          <label class="gcwo-field gcwo-field-sm"><span>Pausa em baixo (s)</span><input type="number" min="0" step="0.5" class="gcwo-it-pausainf" value="${it.pausa_inferior_s ?? 0}"></label>
          <label class="gcwo-field gcwo-field-sm"><span>Concêntrico (s)</span><input type="number" min="0" step="0.5" class="gcwo-it-tempocon" value="${it.tempo_concentrico_s ?? ''}"></label>
          <label class="gcwo-field gcwo-field-sm"><span>Pausa em cima (s)</span><input type="number" min="0" step="0.5" class="gcwo-it-pausasup" value="${it.pausa_superior_s ?? 0}"></label>
        </div>
      </details>
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
      <label class="gcwo-field gcwo-field-sm"><span>Descanso entre séries (s)</span><input type="number" min="0" class="gcwo-it-restset" value="${it.rest_set ?? ''}"></label>
      <div class="gcwo-tempo-grid">
        <label class="gcwo-field gcwo-field-sm"><span>Descer (s)</span><input type="number" min="0" step="0.5" class="gcwo-it-tempoexc" value="${it.tempo_excentrico_s ?? ''}"></label>
        <label class="gcwo-field gcwo-field-sm"><span>Pausa em baixo (s)</span><input type="number" min="0" step="0.5" class="gcwo-it-pausainf" value="${it.pausa_inferior_s ?? 0}"></label>
        <label class="gcwo-field gcwo-field-sm"><span>Subir (s)</span><input type="number" min="0" step="0.5" class="gcwo-it-tempocon" value="${it.tempo_concentrico_s ?? ''}"></label>
        <label class="gcwo-field gcwo-field-sm"><span>Pausa em cima (s)</span><input type="number" min="0" step="0.5" class="gcwo-it-pausasup" value="${it.pausa_superior_s ?? 0}"></label>
      </div>`;
}

function toggleExercicioNaSessao(s, exId) {
  const idx = s.items.findIndex(it => it.exercise_id === exId);
  if (idx >= 0) {
    s.items.splice(idx, 1);
  } else {
    const ex = _state.exercisesCatalog.find(e => e.id === exId);
    if (!ex) return;
    const usaTempo = exercicioUsaTempoPorDefeito(ex);
    s.items.push({
      exercise_id: ex.id,
      name: ex.name,
      photo_url: ex.photo_url || null,
      video_url: ex.video_url || null,
      tecnica_notas: ex.tecnica_notas || null,
      tecnica_info: ex.tecnica_info || null,
      equipamento: ex.equipamento || [],
      machine_adjustment_suggestions: Array.isArray(ex.ajustes_maquina)
        ? ex.ajustes_maquina.map(a => a?.etiqueta).filter(Boolean)
        : [],
      prescription_note: null,
      categoria: ex.categoria || [],
      sets: usaTempo ? (ex.name.toLowerCase().includes('bicicleta') ? 1 : 3) : 3,
      reps_min: usaTempo ? null : 8,
      reps_max: usaTempo ? null : 12,
      reps_fixed: null,
      load: null,
      incremento: ex.incremento_default ?? null,
      rest_set: usaTempo ? 15 : 60,
      rest_next: 90,
      tempo_excentrico_s: ex.tempo_excentrico_s ?? 2,
      pausa_inferior_s: 0,
      tempo_concentrico_s: ex.tempo_concentrico_s ?? 1,
      pausa_superior_s: 0,
      duration_sec: usaTempo && ex.name.toLowerCase().includes('bicicleta') ? 600 : null,
      duration_series: usaTempo ? (ex.name.toLowerCase().includes('bicicleta') ? [{ duration_sec: 600 }] : [{ duration_sec: 30 }, { duration_sec: 30 }, { duration_sec: 30 }]) : null,
      series: usaTempo ? null : [
        { reps: 12, load: null },
        { reps: 12, load: null },
        { reps: 12, load: null },
      ],
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
  const count = document.getElementById('gcwoPPickedCount');
  if (count) count.textContent = `${s.items.length} escolhido${s.items.length === 1 ? '' : 's'}`;
  wireGridCardClicks(s);
  wireRemoveButtons(s);
  wirePickedItems(s);
  refreshReviewCount(s);
  refreshDuracaoEstimada(s);
}

// Só o cartão do exercício muda de forma (intervalo↔fixo) — a grelha fica intacta, não se reata.
function refreshPickedListDom(s) {
  const picked = document.getElementById('gcwoPPickedList');
  if (picked) picked.innerHTML = renderPickedListInner(s);
  wireRemoveButtons(s);
  wirePickedItems(s);
  refreshDuracaoEstimada(s);
}

function wireGridCardClicks(s) {
  document.querySelectorAll('#gcwoPCatGrid [data-exid]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (e.target.closest('[data-favorite-exid]')) return;
      toggleExercicioNaSessao(s, btn.getAttribute('data-exid'));
    });
    btn.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      toggleExercicioNaSessao(s, btn.getAttribute('data-exid'));
    });
  });
  document.querySelectorAll('#gcwoPCatGrid [data-favorite-exid]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      alternarFavoritoCatalogo(btn.getAttribute('data-favorite-exid'), s);
    });
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

    card.setAttribute('draggable', 'true');
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', exId);
      e.dataTransfer.effectAllowed = 'move';
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
    card.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
    card.addEventListener('drop', (e) => {
      e.preventDefault();
      const origemId = e.dataTransfer.getData('text/plain');
      if (!origemId || origemId === exId) return;
      const origem = s.items.findIndex(x => x.exercise_id === origemId);
      const destino = s.items.findIndex(x => x.exercise_id === exId);
      if (origem < 0 || destino < 0) return;
      const [movido] = s.items.splice(origem, 1);
      s.items.splice(destino, 0, movido);
      refreshCatalogPickerDom(s);
    });

    const bindNum = (selector, field) => {
      const el = card.querySelector(selector);
      if (el) el.addEventListener('input', (e) => { it[field] = e.target.value === '' ? null : Number(e.target.value); refreshDuracaoEstimada(s); });
    };
    bindNum('.gcwo-it-sets', 'sets');
    bindNum('.gcwo-it-repsmin', 'reps_min');
    bindNum('.gcwo-it-repsmax', 'reps_max');
    bindNum('.gcwo-it-repsfixed', 'reps_fixed');
    bindNum('.gcwo-it-carga', 'load');
    bindNum('.gcwo-it-incremento', 'incremento');
    bindNum('.gcwo-it-restset', 'rest_set');
    bindNum('.gcwo-it-restnext', 'rest_next');
    bindNum('.gcwo-it-tempoexc', 'tempo_excentrico_s');
    bindNum('.gcwo-it-pausainf', 'pausa_inferior_s');
    bindNum('.gcwo-it-tempocon', 'tempo_concentrico_s');
    bindNum('.gcwo-it-pausasup', 'pausa_superior_s');
    card.querySelector('.gcwo-it-prescription-note')?.addEventListener('input', (e) => {
      it.prescription_note = e.target.value;
    });

    card.querySelectorAll('.gcwo-series-row').forEach(row => {
      const index = Number(row.getAttribute('data-series-index'));
      const series = seriesPrescritasItem(it);
      row.querySelector('.gcwo-serie-reps')?.addEventListener('input', (e) => {
        series[index].reps = e.target.value === '' ? null : Number(e.target.value);
        sincronizarResumoSeries(it);
        refreshDuracaoEstimada(s);
      });
      row.querySelector('.gcwo-serie-load')?.addEventListener('input', (e) => {
        series[index].load = e.target.value === '' ? null : Number(e.target.value);
        sincronizarResumoSeries(it);
        refreshDuracaoEstimada(s);
      });
      row.querySelector('.gcwo-serie-delete')?.addEventListener('click', () => {
        if (series.length <= 1) return;
        series.splice(index, 1);
        sincronizarResumoSeries(it);
        refreshPickedListDom(s);
      });
    });
    card.querySelector('.gcwo-add-serie')?.addEventListener('click', () => {
      const series = seriesPrescritasItem(it);
      const anterior = series.at(-1) || { reps: 12, load: null };
      series.push({ reps: anterior.reps ?? 12, load: anterior.load ?? null });
      sincronizarResumoSeries(it);
      refreshPickedListDom(s);
    });

    card.querySelectorAll('.gcwo-duration-row').forEach(row => {
      const index = Number(row.getAttribute('data-duration-series-index'));
      const series = seriesDuracaoPrescritasItem(it);
      row.querySelector('.gcwo-serie-duration')?.addEventListener('input', (e) => {
        series[index].duration_sec = e.target.value === '' ? null : Number(e.target.value);
        sincronizarResumoDuracao(it);
        refreshDuracaoEstimada(s);
      });
      row.querySelector('.gcwo-duration-delete')?.addEventListener('click', () => {
        if (series.length <= 1) return;
        series.splice(index, 1);
        sincronizarResumoDuracao(it);
        refreshPickedListDom(s);
      });
    });
    card.querySelector('.gcwo-add-duration-serie')?.addEventListener('click', () => {
      const series = seriesDuracaoPrescritasItem(it);
      const anterior = series.at(-1) || { duration_sec: 30 };
      series.push({ duration_sec: anterior.duration_sec ?? 30 });
      sincronizarResumoDuracao(it);
      refreshPickedListDom(s);
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
          if (!itemUsaEquipamentoExterno(it)) it.load = null;
          it.incremento = null;
          it.rest_set = null;
          it.series = null;
          if (!Array.isArray(it.duration_series) || !it.duration_series.length) it.duration_series = [{ duration_sec: it.duration_sec ?? 30 }];
          sincronizarResumoDuracao(it);
        } else {
          it.duration_sec = null;
          it.duration_series = null;
          if (it.sets == null) it.sets = 3;
          if (it.reps_min == null && it.reps_fixed == null) { it.reps_min = 8; it.reps_max = 12; }
          if (it.rest_set == null) it.rest_set = 60;
          if (!Array.isArray(it.series) || !it.series.length) it.series = Array.from({ length: it.sets || 3 }, () => ({ reps: it.reps_fixed ?? it.reps_max ?? 12, load: it.load ?? null }));
        }
        refreshPickedListDom(s);
      });
    });
  });
}

function wireCatalogPicker(s) {
  document.querySelectorAll('#gcwoPPresets [data-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modelos = {
        perda: { reps: [15, 15, 15], rest_set: 60, rest_next: 60, tempo_excentrico_s: 2, tempo_concentrico_s: 1 },
        hipertrofia: { reps: [10, 12, 12], rest_set: 90, rest_next: 120, tempo_excentrico_s: 3, tempo_concentrico_s: 1 },
        forca: { reps: [8, 8, 8], rest_set: 150, rest_next: 150, tempo_excentrico_s: 2, tempo_concentrico_s: 1 },
        personalizado: null,
      };
      const modelo = modelos[btn.getAttribute('data-preset')];
      if (modelo) {
        s.items.forEach(it => {
          it.duration_sec = null;
          it.series = modelo.reps.map(reps => ({ reps, load: it.load ?? null }));
          it.rest_set = modelo.rest_set;
          it.rest_next = modelo.rest_next;
          it.tempo_excentrico_s = modelo.tempo_excentrico_s;
          it.tempo_concentrico_s = modelo.tempo_concentrico_s;
          it.pausa_inferior_s = 0;
          it.pausa_superior_s = 0;
          sincronizarResumoSeries(it);
        });
        refreshPickedListDom(s);
      }
      document.querySelectorAll('#gcwoPPresets [data-preset]').forEach(x => x.classList.toggle('on', x === btn));
    });
  });
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
  refreshReviewCount(s);
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
  return { zone: null, pace_sec_per_km: null, pace_sec_per_100m: null, speed_kmh: null, heart_rate_bpm: null, power_w: null, cadence_rpm: null, rpe: null };
}
function novoBlocoContinuo() {
  return { block_id: uuid(), type: 'continuous', measure: 'time', duration_sec: null, distance_m: null, intensity: novaIntensidade() };
}
function novoBlocoSeries() {
  return { block_id: uuid(), type: 'series', count: 4, work: { measure: 'distance', value: null, distance_m: null, duration_sec: null, unit: 'm', intensity: novaIntensidade() }, recovery: { measure: 'time', duration_sec: null, distance_m: null, intensity: novaIntensidade() } };
}
function novoBlocoFecho() {
  return { block_id: uuid(), type: 'closing', mode: 'rest', duration_sec: null, intensity: novaIntensidade() };
}

function calcularCargaPorZona(s) {
  const minutosPorZona = {};
  let totalComZona = 0, totalGeral = 0;
  const somar = (segundos, zone) => {
    if (!segundos) return;
    totalGeral += segundos;
    if (zone) { minutosPorZona[zone] = (minutosPorZona[zone] || 0) + segundos; totalComZona += segundos; }
  };
  (s.blocks || []).forEach(b => {
    if (b.type === 'continuous' || b.type === 'closing') {
      somar(tempoBlocoContinuo(b, s.modality), b.intensity?.zone);
    } else if (b.type === 'series') {
      if (serieTemDistanciaSemTempo(b, s.modality)) return;
      const repeticoes = Math.max(0, Number(b.count) || 0);
      somar(repeticoes * tempoParteSeries(b.work, s.modality), b.work?.intensity?.zone);
      somar(repeticoes * tempoParteSeries(b.recovery, s.modality), b.recovery?.intensity?.zone);
    }
  });
  return { minutosPorZona, totalComZona, totalGeral };
}
function renderIndicadorZonaHtml(s) {
  const { minutosPorZona, totalComZona } = calcularCargaPorZona(s);
  if (!totalComZona) return '';
  const zonasAltasNatacao = new Set(['A3', 'SP1', 'SP2', 'SP3']);
  const z3mais = Object.entries(minutosPorZona)
    .filter(([z]) => modalidadeCanonica(s.modality) === 'natacao' ? zonasAltasNatacao.has(z) : Number(z.replace('Z', '')) >= 3)
    .reduce((a, [, v]) => a + v, 0);
  const pct = Math.round((z3mais / totalComZona) * 100);
  const etiqueta = modalidadeCanonica(s.modality) === 'natacao' ? 'A3/SP' : 'Z3+';
  return `<div class="gcwo-progressao-nota">${etiqueta}: ${fmtDuracaoTotal(z3mais)} de ${fmtDuracaoTotal(totalComZona)} · ${pct}% acima da base</div>`;
}

// Análise local da sessão prescrita. Não decide se o treino é "seguro" e não cria
// limiares clínicos: resume o que está prescrito, assinala dados incompletos e compara
// apenas com a sessão anterior da mesma modalidade quando ela existe.
function distanciaTotalCardio(s) {
  let total = 0;
  (s.blocks || []).forEach(b => {
    if (b.type === 'series') {
      const repeticoes = Math.max(0, Number(b.count) || 0);
      if (medidaParteSeries(b.work, s.modality) === 'distance') total += repeticoes * distanciaParteSeries(b.work);
      if (medidaParteSeries(b.recovery, s.modality) === 'distance') total += repeticoes * distanciaParteSeries(b.recovery);
      return;
    }
    if (medidaContinua(b, s.modality) === 'distance') total += Number(b.distance_m) || 0;
  });
  return total;
}

function zonaElevadaParaAnalise(zona, modality) {
  if (!zona) return false;
  const canonica = modalidadeCanonica(modality);
  if (canonica === 'natacao') return ['A3', 'SP1', 'SP2', 'SP3'].includes(zona);
  return Number(String(zona).replace('Z', '')) >= 3;
}

function cargaElevadaCardio(s) {
  const { minutosPorZona } = calcularCargaPorZona(s);
  return Object.entries(minutosPorZona)
    .filter(([zona]) => zonaElevadaParaAnalise(zona, s.modality))
    .reduce((total, [, segundos]) => total + segundos, 0);
}

function sessaoAnteriorComparavel(s) {
  return (_state.sessions || [])
    .filter(outra => outra.session_id !== s.session_id && outra.kind === 'card' && modalidadeCanonica(outra.modality) === modalidadeCanonica(s.modality) && outra.date && s.date && outra.date < s.date)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0] || null;
}

function analisarSessaoCardio(s) {
  const carga = calcularCargaPorZona(s);
  const distancia = distanciaTotalCardio(s);
  const elevada = cargaElevadaCardio(s);
  const anterior = sessaoAnteriorComparavel(s);
  const cargaAnterior = anterior ? calcularCargaPorZona(anterior) : null;
  const distanciaAnterior = anterior ? distanciaTotalCardio(anterior) : 0;
  const elevadaAnterior = anterior ? cargaElevadaCardio(anterior) : 0;
  const avisos = [];
  const dadosEmFalta = [];

  (s.blocks || []).forEach((b, indice) => {
    const intensidade = b.type === 'series' ? b.work?.intensity : b.intensity;
    if (!intensidade?.zone) dadosEmFalta.push(`Bloco ${indice + 1} sem zona definida.`);
    if (b.type === 'series') {
      if (!(Number(b.count) > 0)) dadosEmFalta.push(`Bloco ${indice + 1} sem número de séries.`);
      if (!(tempoParteSeries(b.recovery, s.modality) > 0) && !(distanciaParteSeries(b.recovery) > 0)) dadosEmFalta.push(`Bloco ${indice + 1} sem recuperação definida.`);
    }
  });

  if (restricoesAtuais().includes('Sem impacto') && modalidadeCanonica(s.modality) === 'corrida') {
    avisos.push('A modalidade corrida não é compatível com a restrição registada “Sem impacto”.');
  }
  if (anterior && elevada > elevadaAnterior) {
    avisos.push(`O tempo em zonas moderadas/altas aumentou de ${fmtDuracaoTotal(elevadaAnterior)} para ${fmtDuracaoTotal(elevada)}.`);
  }

  let estado = 'Coerente com os dados disponíveis';
  let classe = 'ok';
  if (dadosEmFalta.length || avisos.length) { estado = 'Rever antes de guardar'; classe = 'review'; }
  else if (!anterior) { estado = 'Sem sessão anterior para comparar'; classe = 'limited'; }

  return { carga, distancia, elevada, anterior, cargaAnterior, distanciaAnterior, elevadaAnterior, avisos, dadosEmFalta, estado, classe };
}

function diferencaAnalise(actual, anterior, formatar) {
  if (!anterior) return '—';
  const delta = actual - anterior;
  if (!delta) return 'Sem alteração';
  return `${delta > 0 ? '+' : '−'}${formatar(Math.abs(delta))}`;
}

function renderAnaliseSessaoCardioResultado(s) {
  const a = analisarSessaoCardio(s);
  const etiquetaElevada = modalidadeCanonica(s.modality) === 'natacao' ? 'A3/SP' : 'Z3+';
  const totalAnterior = a.cargaAnterior?.totalGeral || 0;
  const mensagens = [...a.dadosEmFalta, ...a.avisos];
  return `<section class="gcwo-training-analysis-result ${a.classe}" aria-live="polite">
    <div class="gcwo-training-analysis-head"><div><strong>Validação da prescrição</strong><span>Verifica a estrutura planeada antes de colocar a sessão no calendário. Não analisa o treino realizado.</span></div><em>${escHtml(a.estado)}</em></div>
    <div class="gcwo-training-analysis-grid">
      <div class="gcwo-training-analysis-metrics">
        <div><span>Duração calculável</span><strong>${fmtDuracaoTotal(a.carga.totalGeral)}</strong><small>${a.anterior ? `Anterior: ${fmtDuracaoTotal(totalAnterior)} · ${diferencaAnalise(a.carga.totalGeral, totalAnterior, fmtDuracaoTotal)}` : 'Sem comparação anterior'}</small></div>
        <div><span>Distância prescrita</span><strong>${a.distancia ? fmtDistanciaTotal(a.distancia) : '—'}</strong><small>${a.anterior && a.distanciaAnterior ? `Anterior: ${fmtDistanciaTotal(a.distanciaAnterior)} · ${diferencaAnalise(a.distancia, a.distanciaAnterior, fmtDistanciaTotal)}` : 'Sem comparação disponível'}</small></div>
        <div><span>${etiquetaElevada}</span><strong>${fmtDuracaoTotal(a.elevada)}</strong><small>${a.anterior ? `Anterior: ${fmtDuracaoTotal(a.elevadaAnterior)}` : 'Primeira referência desta modalidade'}</small></div>
      </div>
      <div class="gcwo-training-analysis-messages">${mensagens.length ? mensagens.map(texto => `<div>${escHtml(texto)}</div>`).join('') : '<div class="ok">Não foram encontrados dados incompletos nem incompatibilidades automáticas.</div>'}</div>
    </div>
  </section>`;
}

function renderAnaliseSessaoCardioHtml(s) {
  return `<div class="gcwo-training-analysis-actions"><button type="button" class="gcBtnPrimary" id="gcwoPAnalisarTreino">${s._analysisOpen ? 'Fechar validação' : 'Validar prescrição'}</button></div>${s._analysisOpen ? renderAnaliseSessaoCardioResultado(s) : ''}`;
}

function refreshAnaliseSessaoCardio(s) {
  const host = document.getElementById('gcwoPAnaliseTreino');
  if (!host) return;
  host.innerHTML = renderAnaliseSessaoCardioHtml(s);
  document.getElementById('gcwoPAnalisarTreino')?.addEventListener('click', () => {
    s._analysisOpen = !s._analysisOpen;
    refreshAnaliseSessaoCardio(s);
  });
}
const CARDIO_ZONE_META = {
  Z1: { cor:'#aebdca', nome:'Recuperação' }, Z2: { cor:'#20a7db', nome:'Endurance' },
  Z3: { cor:'#35b978', nome:'Tempo' }, Z4: { cor:'#ffb20d', nome:'Limiar' },
  Z5: { cor:'#ff542e', nome:'VO₂ Max' }, Z6: { cor:'#e51b23', nome:'Anaeróbica' },
  Z7: { cor:'#9f1239', nome:'Sprint' },
  A1: { cor:'#aebdca', nome:'Aeróbio ligeiro' }, A2: { cor:'#20a7db', nome:'Aeróbio médio' },
  A3: { cor:'#35b978', nome:'Aeróbio intenso' }, SP1: { cor:'#ffb20d', nome:'Limiar' },
  SP2: { cor:'#ff542e', nome:'VO₂ máx.' }, SP3: { cor:'#e51b23', nome:'Velocidade' },
};
function cardioZoneMeta(zona) { return CARDIO_ZONE_META[zona] || { cor:'#cbd5e1', nome:'' }; }
const CARDIO_ZONE_DEFAULT_SECONDS = {
  corrida: { Z1:600, Z2:1200, Z3:600, Z4:300, Z5:60 },
  ciclismo: { Z1:900, Z2:1800, Z3:900, Z4:480, Z5:180, Z6:60, Z7:15 },
};
const CARDIO_ZONE_DEFAULT_DISTANCE = {
  natacao: { A1:500, A2:400, A3:200, SP1:100, SP2:50, SP3:25 },
};
function zonasDisponiveisCardio(modality) {
  const canonica = modalidadeCanonica(modality);
  return canonica === 'natacao' ? ZONAS_NATACAO : (canonica === 'ciclismo' ? ZONAS : ZONAS.slice(0, 5));
}
function duracaoInicialZona(modality, zona) {
  return CARDIO_ZONE_DEFAULT_SECONDS[modalidadeCanonica(modality)]?.[zona] || 300;
}
function distanciaInicialZona(modality, zona) {
  return CARDIO_ZONE_DEFAULT_DISTANCE[modalidadeCanonica(modality)]?.[zona] || 100;
}
function ritmoParaKmh(segundosPorKm) {
  const segundos = Number(segundosPorKm);
  return Number.isFinite(segundos) && segundos > 0 ? (3600 / segundos).toFixed(1) : '';
}
function cardioPermiteDistancia(modality) {
  return modalidadeCanonica(modality) !== 'ciclismo';
}
function medidaContinua(b, modality) {
  return cardioPermiteDistancia(modality) && b?.measure === 'distance' ? 'distance' : 'time';
}
function medidaParteSeries(parte, modality) {
  return cardioPermiteDistancia(modality) && parte?.measure === 'distance' ? 'distance' : 'time';
}
function distanciaParteSeries(parte) {
  return Number(parte?.distance_m ?? (parte?.measure === 'distance' ? parte?.value : null)) || 0;
}
function duracaoParteSeries(parte) {
  return Number(parte?.duration_sec ?? (parte?.measure !== 'distance' ? parte?.value : null)) || 0;
}
function ritmoParaCalculo(intensidade, zona, modality) {
  const canonica = modalidadeCanonica(modality);
  const exacto = canonica === 'natacao' ? Number(intensidade?.pace_sec_per_100m) : Number(intensidade?.pace_sec_per_km);
  if (exacto > 0) return { min:exacto, max:exacto, exacto:true };
  const range = rangePerfilParaZona(zona, modality, 'pace');
  const min = Number(range?.lower_value), max = Number(range?.upper_value);
  return min > 0 && max > 0 ? { min, max, exacto:false } : null;
}
function calcularTempoPorDistancia(distanciaM, intensidade, modality) {
  const distancia = Number(distanciaM);
  if (!(distancia > 0) || !cardioPermiteDistancia(modality)) return null;
  const ritmo = ritmoParaCalculo(intensidade, intensidade?.zone, modality);
  if (!ritmo) return null;
  const factor = modalidadeCanonica(modality) === 'natacao' ? distancia / 100 : distancia / 1000;
  const min = Math.round(factor * ritmo.min), max = Math.round(factor * ritmo.max);
  return { min, max, estimado:Math.round((min + max) / 2), exacto:ritmo.exacto || min === max };
}
function fmtTempoCalculado(segundos) {
  const total = Math.max(0, Math.round(Number(segundos) || 0));
  const h = Math.floor(total / 3600), min = Math.floor((total % 3600) / 60), seg = total % 60;
  return h ? `${h}:${String(min).padStart(2, '0')}:${String(seg).padStart(2, '0')}` : `${min}:${String(seg).padStart(2, '0')}`;
}
function textoTempoDistancia(distanciaM, intensidade, modality) {
  const calculo = calcularTempoPorDistancia(distanciaM, intensidade, modality);
  if (!calculo) return 'Tempo por calcular';
  return calculo.exacto ? `Tempo calculado: ${fmtTempoCalculado(calculo.estimado)}` : `Tempo estimado: ${fmtTempoCalculado(calculo.min)}–${fmtTempoCalculado(calculo.max)}`;
}
function tempoBlocoContinuo(b, modality) {
  if (medidaContinua(b, modality) === 'distance') return calcularTempoPorDistancia(b.distance_m, b.intensity, modality)?.estimado || 0;
  return Number(b.duration_sec) || 0;
}
function tempoParteSeries(parte, modality) {
  if (medidaParteSeries(parte, modality) === 'distance') return calcularTempoPorDistancia(distanciaParteSeries(parte), parte?.intensity, modality)?.estimado || 0;
  return duracaoParteSeries(parte);
}
function serieTemDistanciaSemTempo(b, modality) {
  return [b?.work, b?.recovery].some(parte => medidaParteSeries(parte, modality) === 'distance' && !calcularTempoPorDistancia(distanciaParteSeries(parte), parte?.intensity, modality));
}
function selectorMedidaCardio(nome, medida, modality) {
  if (!cardioPermiteDistancia(modality)) return '';
  return `<div class="gcwo-modo gcwo-cardio-measure"><label><input type="radio" name="${escAttr(nome)}" value="time" ${medida === 'time' ? 'checked' : ''}> Tempo</label><label><input type="radio" name="${escAttr(nome)}" value="distance" ${medida === 'distance' ? 'checked' : ''}> Distância</label></div>`;
}
function campoDistanciaCardio(classe, valor, intensidade, modality, label='Distância') {
  return `<label class="gcwo-field gcwo-distance-field"><span>${escHtml(label)} (m)</span><input type="number" min="0" step="10" class="${classe}" value="${valor || ''}"><small class="gcwo-derived-time">${escHtml(textoTempoDistancia(valor, intensidade, modality))}</small></label>`;
}
function centroRange(r) {
  if (r?.lower_value == null || r?.upper_value == null) return null;
  const inferior = Number(r.lower_value), superior = Number(r.upper_value);
  if (Number.isFinite(inferior) && Number.isFinite(superior)) return (inferior + superior) / 2;
  return null;
}
function valorVerticalCardio(intensidade, zona, modality) {
  const canonica = modalidadeCanonica(modality);
  if (canonica === 'ciclismo') {
    const watts = Number(intensidade?.power_w);
    if (watts > 0) return watts;
    const centroWatts = centroRange(rangePerfilParaZona(zona, modality, 'power'));
    if (centroWatts != null) return centroWatts;
    return ({ Z1:100, Z2:150, Z3:210, Z4:260, Z5:320, Z6:400, Z7:500 })[zona] || 100;
  }
  if (canonica === 'natacao') {
    const pace100 = Number(intensidade?.pace_sec_per_100m);
    if (pace100 > 0) return 1000 / pace100;
    const centroPace100 = centroRange(rangePerfilParaZona(zona, modality, 'pace'));
    if (centroPace100 != null) return 1000 / centroPace100;
    return ({ A1:5.5, A2:6.5, A3:7.5, SP1:9, SP2:10.5, SP3:12 })[zona] || 5.5;
  }
  const paceKm = Number(intensidade?.pace_sec_per_km);
  if (paceKm > 0) return 3600 / paceKm;
  const centroPaceKm = centroRange(rangePerfilParaZona(zona, modality, 'pace'));
  if (centroPaceKm != null) return 3600 / centroPaceKm;
  return ({ Z1:8.5, Z2:10, Z3:12, Z4:14, Z5:16 })[zona] || 8.5;
}
function adicionarBlocoZona(s, zona) {
  if (!zonasDisponiveisCardio(s.modality).includes(zona)) return;
  const bloco = novoBlocoContinuo();
  if (modalidadeCanonica(s.modality) === 'natacao') {
    bloco.measure = 'distance';
    bloco.distance_m = distanciaInicialZona(s.modality, zona);
    bloco.duration_sec = null;
  } else {
    bloco.duration_sec = duracaoInicialZona(s.modality, zona);
  }
  bloco.intensity.zone = zona;
  s.blocks.push(bloco);
  s._selectedBlockId = bloco.block_id;
  refreshBlocosListDom(s);
}
function criarSeriesPreformatadas(modality) {
  const bloco = novoBlocoSeries();
  if (modalidadeCanonica(modality) === 'natacao') {
    bloco.count = 4;
    bloco.work.measure = 'distance';
    bloco.work.unit = 'm';
    bloco.work.value = 100;
    bloco.work.distance_m = 100;
    bloco.work.duration_sec = null;
    bloco.work.intensity.zone = 'SP1';
    bloco.recovery.measure = 'time';
    bloco.recovery.duration_sec = 30;
    bloco.recovery.distance_m = null;
    bloco.recovery.intensity.zone = null;
  } else {
    bloco.count = 3;
    bloco.work.measure = 'time';
    bloco.work.unit = 's';
    bloco.work.value = 180;
    bloco.recovery.duration_sec = 90;
  }
  return bloco;
}
function adicionarSeriesPreformatadas(s) {
  const bloco = criarSeriesPreformatadas(s.modality);
  s.blocks.push(bloco);
  s._selectedBlockId = bloco.block_id;
  refreshBlocosListDom(s);
}
function blocoSelecionadoCardio(s) {
  return (s.blocks || []).find(b => b.block_id === s._selectedBlockId) || (s.blocks || [])[0] || null;
}
function renderEditorRapidoCardio(s) {
  const bloco = blocoSelecionadoCardio(s);
  if (!bloco) return `<div class="gcwo-cardio-quick-empty"><strong>Seleccione uma zona</strong><span>O bloco aparece aqui pronto a editar.</span></div>`;
  if (bloco.type !== 'continuous') return `<div class="gcwo-cardio-quick-empty"><strong>${bloco.type === 'series' ? 'Séries seleccionadas' : 'Fecho seleccionado'}</strong><span>Os detalhes deste bloco aparecem abaixo do gráfico.</span></div>`;
  const numero = s.blocks.indexOf(bloco) + 1;
  const isNatacao = modalidadeCanonica(s.modality) === 'natacao';
  if (isNatacao) bloco.measure = 'distance';
  const medida = medidaContinua(bloco, s.modality);
  const campoMedida = medida === 'distance'
    ? campoDistanciaCardio('gcwo-bloco-distance', bloco.distance_m, bloco.intensity, s.modality)
    : campoDuracaoMMSS('gcwo-bloco-duracaomin', bloco.duration_sec, 'Duração');
  return `<div class="gcwo-cardio-quick-card gcwo-exercicio" data-bid="${escAttr(bloco.block_id)}">
    <div class="gcwo-cardio-quick-head"><strong>Bloco ${numero} · ${escHtml(bloco.intensity?.zone || 'Sem zona')}</strong>${isNatacao ? '' : selectorMedidaCardio(`gcwo-cont-medida-${bloco.block_id}`, medida, s.modality)}${campoMedida}<button type="button" class="gcwo-exercicio-remove" data-remove-bid="${escAttr(bloco.block_id)}" title="Remover bloco">✕</button></div>
    ${wrapIntensidade(bloco.block_id, 'main', bloco.intensity, false, s.modality)}
    <span class="gcwo-cardio-quick-range">${escHtml(intervalosZonaCardio(bloco.intensity?.zone, s.modality).join(' · '))}</span>
  </div>`;
}
function renderPaletaCardio(s) {
  const seleccionado = blocoSelecionadoCardio(s);
  const zonaSeleccionada = seleccionado?.type === 'series' ? seleccionado.work?.intensity?.zone : seleccionado?.intensity?.zone;
  return `<section class="gcwo-cardio-builder" aria-label="Adicionar bloco por zona">
    <div class="gcwo-cardio-compact-workspace">
      <div class="gcwo-cardio-zone-tray">
        ${zonasDisponiveisCardio(s.modality).map(z => { const meta = cardioZoneMeta(z); const predefinido = modalidadeCanonica(s.modality) === 'natacao' ? `${distanciaInicialZona(s.modality, z)} m` : fmtDuracaoTotal(duracaoInicialZona(s.modality, z)); return `<button type="button" class="gcwo-cardio-zone${zonaSeleccionada === z ? ' is-current' : ''}" data-add-zone="${z}" style="--zone-color:${meta.cor}" title="Adicionar ${z}"><strong>${z}</strong><span>${escHtml(meta.nome)}</span><small>${predefinido}</small></button>`; }).join('')}
        <button type="button" class="gcwo-cardio-zone gcwo-cardio-series${seleccionado?.type === 'series' ? ' is-current' : ''}" data-add-series="true" title="Adicionar séries com descanso"><strong>${modalidadeCanonica(s.modality) === 'natacao' ? '4×' : '3×'}</strong><span>Séries</span><small>${modalidadeCanonica(s.modality) === 'natacao' ? '100 m · 30 s' : '3 min · 1:30'}</small></button>
      </div>
      <div id="gcwoPCardioQuickEdit">${renderEditorRapidoCardio(s)}</div>
    </div>
  </section>`;
}
function renderResumoVisualCardio(s) {
  const blocos = (s.blocks || []).map((b) => {
    const zona = b.type === 'series' ? b.work?.intensity?.zone : b.intensity?.zone;
    let segundos = b.type === 'closing' ? (Number(b.duration_sec) || 0) : tempoBlocoContinuo(b, s.modality);
    const porCalcular = b.type === 'series'
      ? serieTemDistanciaSemTempo(b, s.modality)
      : medidaContinua(b, s.modality) === 'distance' && !tempoBlocoContinuo(b, s.modality);
    if (b.type === 'series') segundos = (Number(b.count) || 0) * (tempoParteSeries(b.work, s.modality) + tempoParteSeries(b.recovery, s.modality));
    const intensidade = b.type === 'series' ? b.work?.intensity : b.intensity;
    const metrica = alvoOuIntervaloCardio(intensidade, zona, s.modality);
    const zonaRecuperacao = b.type === 'series' ? b.recovery?.intensity?.zone : null;
    const valorRecuperacao = b.type === 'series' ? (modalidadeCanonica(s.modality) === 'natacao' ? 0 : valorVerticalCardio(b.recovery?.intensity, zonaRecuperacao, s.modality)) : null;
    return { bloco:b, zona, zonaRecuperacao, segundos, porCalcular, metrica, valorVertical:valorVerticalCardio(intensidade, zona, s.modality), valorRecuperacao, label: b.type === 'series' ? `${b.count || 0}× Séries` : (b.type === 'closing' ? 'Fecho' : 'Contínuo') };
  }).filter(x => x.segundos > 0 || x.porCalcular);
  if (!blocos.length) return `<div class="gcwo-cardio-empty" data-zone-drop="true"><strong>Arraste uma zona para aqui</strong><span>ou clique numa zona acima</span></div>`;
  const total = blocos.reduce((n, b) => n + b.segundos, 0);
  const temTempoPorCalcular = blocos.some(b => b.porCalcular);
  const divisorLargura = total || 1;
  const valoresVerticais = blocos.flatMap(b => [b.valorVertical, b.valorRecuperacao]).filter(Number.isFinite);
  const valorMin = Math.min(...valoresVerticais), valorMax = Math.max(...valoresVerticais);
  const alturaParaValor = valor => valorMax > valorMin ? Math.round(44 + ((valor - valorMin) / (valorMax - valorMin)) * 56) : 72;
  const totalTexto = temTempoPorCalcular ? (total > 0 ? `${fmtTempoCalculado(total)} + por calcular` : 'Por calcular') : fmtTempoCalculado(total);
  return `<div class="gcwo-cardio-overview" data-zone-drop="true"><div class="gcwo-cardio-total"><span>Duração total</span><strong>${totalTexto}</strong></div><div class="gcwo-cardio-chart"><div class="gcwo-cardio-axis"><span>Mais rápido</span><span>Mais lento</span></div><div class="gcwo-cardio-timeline">${blocos.map(b => {
    const isSeries = b.bloco.type === 'series';
    const largura = Math.max(isSeries ? 220 : 128, Math.min(isSeries ? 520 : 360, Math.round((b.segundos / divisorLargura) * 1080)));
    const altura = alturaParaValor(b.valorVertical);
    const activa = s._selectedBlockId === b.bloco.block_id;
    if (isSeries) {
      const repeticoes = Math.max(1, Number(b.bloco.count) || 1);
      const trabalhoSec = tempoParteSeries(b.bloco.work, s.modality);
      const recuperacaoSec = tempoParteSeries(b.bloco.recovery, s.modality);
      const alturaRec = alturaParaValor(b.valorRecuperacao);
      const zonaRec = b.zonaRecuperacao || 'REC';
      const intervaloTrabalho = alvoOuIntervaloCardio(b.bloco.work?.intensity, b.zona, s.modality);
      const intervaloRecuperacao = alvoOuIntervaloCardio(b.bloco.recovery?.intensity, b.zonaRecuperacao, s.modality);
      const trabalhoFlex = trabalhoSec || 60;
      const recuperacaoFlex = recuperacaoSec || 30;
      const padrao = Array.from({ length:repeticoes }, () => `<i class="gcwo-series-effort" title="${escAttr(intervaloTrabalho)}" style="--series-flex:${trabalhoFlex};--series-height:${altura}%;background:${cardioZoneMeta(b.zona).cor}"><em>${escHtml(b.zona || 'TR')}</em></i><i class="gcwo-series-recovery" title="${escAttr(intervaloRecuperacao)}" style="--series-flex:${recuperacaoFlex};--series-height:${alturaRec}%;background:${cardioZoneMeta(b.zonaRecuperacao).cor}"><em>${escHtml(zonaRec)}</em></i>`).join('');
      const trabalhoTexto = medidaParteSeries(b.bloco.work, s.modality) === 'distance' ? `${distanciaParteSeries(b.bloco.work)} m` : fmtTempoCalculado(trabalhoSec);
      const recuperacaoTexto = medidaParteSeries(b.bloco.recovery, s.modality) === 'distance' ? `${distanciaParteSeries(b.bloco.recovery)} m` : fmtTempoCalculado(recuperacaoSec);
      return `<div class="gcwo-timeline-block gcwo-timeline-series-group${activa ? ' is-selected' : ''}" data-timeline-bid="${escAttr(b.bloco.block_id)}" title="${repeticoes} séries: trabalho e recuperação" style="--block-width:${largura}px"><button type="button" class="gcwo-timeline-select gcwo-timeline-series" data-select-bid="${escAttr(b.bloco.block_id)}"><span class="gcwo-series-pattern">${padrao}</span><strong class="gcwo-series-count">${repeticoes}×</strong><small class="gcwo-series-caption">${trabalhoTexto} + ${recuperacaoTexto}</small></button></div>`;
    }
    const duracaoTexto = b.porCalcular ? `${Number(b.bloco.distance_m) || 0} m` : fmtDuracaoTotal(b.segundos);
    return `<div class="gcwo-timeline-block${activa ? ' is-selected' : ''}" data-timeline-bid="${escAttr(b.bloco.block_id)}" title="Arraste para mudar a ordem" style="--block-width:${largura}px;--block-height:${altura}%;background:${cardioZoneMeta(b.zona).cor}"><button type="button" class="gcwo-timeline-select" data-select-bid="${escAttr(b.bloco.block_id)}"><strong>${escHtml(b.zona || b.label)}</strong><span>${duracaoTexto}</span><small>${escHtml(b.metrica || b.label)}</small></button></div>`;
  }).join('')}</div></div><div class="gcwo-timeline-help">Largura = duração · Altura = velocidade/intensidade · Arraste para ordenar · Clique para editar</div></div>`;
}
function refreshZonaResumo(s) {
  const host = document.getElementById('gcwoPZonaResumo');
  if (host) host.innerHTML = renderIndicadorZonaHtml(s);
  const overview = document.getElementById('gcwoPCardioOverview');
  if (overview) {
    overview.innerHTML = renderResumoVisualCardio(s);
    wireTimelineCardio(s);
  }
  if (s._analysisOpen) refreshAnaliseSessaoCardio(s);
}

function renderIntensidadeCampos(intensity, mostrarZona, modality) {
  const isNatacao = modalidadeCanonica(modality) === 'natacao';
  // Ciclismo (Fase 2, spec-zonas-treino.md): ritmo min/km "desaparece" — substituído por
  // velocidade (km/h), campo opcional/secundário, sem zonas próprias (só Cadência/RPE ao
  // lado). A "Zona" passa a apontar para a tabela de Coggan (potência), não FC.
  const isCiclismo = modalidadeCanonica(modality) === 'ciclismo';
  const zonaHint = intervalosZonaCardio(intensity.zone, modality).join(' · ');
  // Z6/Z7 só existem no modelo de potência de Coggan (ciclismo) — as restantes
  // modalidades (corrida, natação, ginásio, caminhada, circuito) usam o modelo
  // tradicional de 5 zonas, mesmo quando mostram este dropdown genérico.
  const zonasDisponiveis = zonasDisponiveisCardio(modality);

  const campoZona = mostrarZona ? `
      <div class="gcwo-field gcwo-zone-field"><span>Zona prescrita</span>
        <div class="gcwo-zone-palette">
          ${zonasDisponiveis.map(z => { const meta = cardioZoneMeta(z); return `<button type="button" class="gcwo-int-zone${intensity.zone === z ? ' on' : ''}" data-zone="${z}" style="--zone-color:${meta.cor}" title="${escAttr(meta.nome)}"><strong>${z}</strong><small>${escHtml(meta.nome)}</small></button>`; }).join('')}
        </div>
        <span class="gcwo-int-zone-hint">${zonaHint ? `${intensity.zone} · ${zonaHint}` : 'Seleccione a zona clínica deste passo.'}</span>
      </div>` : '';
  const campoRitmo = isNatacao
    ? `<label class="gcwo-field"><span>Alvo de ritmo (opcional)</span><input type="text" inputmode="numeric" placeholder="1:35" class="gcwo-int-pace100" value="${escAttr(fmtPaceEditavel(intensity.pace_sec_per_100m))}"><small>min:seg/100 m</small></label>`
    : `<label class="gcwo-field gcwo-pace-field"><span>Alvo de ritmo (opcional)</span><div class="gcwo-pace-pair"><div><input type="text" inputmode="numeric" placeholder="5:00" class="gcwo-int-pace" value="${escAttr(fmtPaceEditavel(intensity.pace_sec_per_km))}"><small>min/km</small></div><output class="gcwo-pace-kmh">${ritmoParaKmh(intensity.pace_sec_per_km) || '—'}</output><small>km/h</small></div></label>`;
  const campoVelocidade = `<label class="gcwo-field"><span>Velocidade (km/h, opcional)</span><input type="number" min="0" step="0.1" class="gcwo-int-speed" value="${intensity.speed_kmh ?? ''}"></label>`;
  const campoFc = `<label class="gcwo-field"><span class="gcwo-metric-label"><b class="heart">♥</b> Alvo de FC (opcional)</span><input type="number" min="0" placeholder="bpm" class="gcwo-int-fc" value="${intensity.heart_rate_bpm ?? ''}"></label>`;
  const campoPotencia = `<label class="gcwo-field"><span class="gcwo-metric-label"><b class="power">⚡</b> Alvo de potência (opcional)</span><input type="number" min="0" placeholder="W" class="gcwo-int-power" value="${intensity.power_w ?? ''}"></label>`;
  const campoCadencia = `<label class="gcwo-field"><span>Cadência (rpm)</span><input type="number" min="0" class="gcwo-int-cadence" value="${intensity.cadence_rpm ?? ''}"></label>`;
  const campoRpe = `<label class="gcwo-field"><span>RPE</span><input type="number" min="1" max="10" class="gcwo-int-rpe" value="${intensity.rpe ?? ''}"></label>`;

  // Ordem no ecrã (spec-zonas-treino.md): Corrida/Natação mantêm Ritmo→FC→Potência→
  // Cadência→RPE; Ciclismo passa a Potência→FC→Cadência→Velocidade→RPE (Zona → Potência
  // → FC → Cadência → Velocidade → RPE).
  const camposOrdenados = isCiclismo
    ? [campoZona, campoPotencia, campoFc, campoCadencia, campoVelocidade, campoRpe]
    : [campoZona, campoRitmo, campoFc, campoPotencia, campoCadencia, campoRpe];

  return `
    <div class="gcwo-row3">
      ${camposOrdenados.join('')}
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
  const medida = medidaContinua(b, modality);
  return `
    <div class="gcwo-exercicio" data-bid="${escAttr(b.block_id)}">
      <div class="gcwo-exercicio-head">
        <strong>Contínuo</strong>
        <button type="button" class="gcwo-exercicio-remove" data-remove-bid="${escAttr(b.block_id)}" title="Remover bloco">✕</button>
      </div>
      <div class="gcwo-series-general">${selectorMedidaCardio(`gcwo-cont-medida-${b.block_id}`, medida, modality)}${medida === 'distance' ? campoDistanciaCardio('gcwo-bloco-distance', b.distance_m, b.intensity, modality) : campoDuracaoMMSS('gcwo-bloco-duracaomin', b.duration_sec, 'Duração')}</div>
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
  const isNatacao = modalidadeCanonica(modality) === 'natacao';
  const medida = medidaParteSeries(b.work, modality);
  const medidaRecuperacao = medidaParteSeries(b.recovery, modality);
  return `
    <div class="gcwo-exercicio gcwo-cardio-series-editor" data-bid="${escAttr(b.block_id)}">
      <div class="gcwo-exercicio-head">
        <strong>Séries</strong>
        <button type="button" class="gcwo-exercicio-remove" data-remove-bid="${escAttr(b.block_id)}" title="Remover bloco">✕</button>
      </div>
      <div class="gcwo-series-general">
        <label class="gcwo-field gcwo-field-sm"><span>Nº de séries</span><input type="number" min="1" class="gcwo-bloco-count" value="${b.count ?? ''}"></label>
      </div>
      <div class="gcwo-series-split">
        <section class="gcwo-series-side gcwo-series-work">
          <span class="gcwo-field-label">Trabalho</span>
          ${soDistancia ? '' : selectorMedidaCardio(`gcwo-medida-${b.block_id}`, medida, modality)}
          ${medida === 'distance'
            ? campoDistanciaCardio('gcwo-bloco-workdistance', distanciaParteSeries(b.work), b.work.intensity, modality)
            : campoDuracaoMMSS('gcwo-bloco-workvalue', duracaoParteSeries(b.work), 'Duração')
          }
          ${wrapIntensidade(b.block_id, 'work', b.work.intensity, temZona, modality)}
        </section>
        <section class="gcwo-series-side gcwo-series-recovery">
          <span class="gcwo-field-label">Recuperação</span>
          ${isNatacao ? '<small class="gcwo-muted">Parado</small>' : selectorMedidaCardio(`gcwo-rec-medida-${b.block_id}`, medidaRecuperacao, modality)}
          ${medidaRecuperacao === 'distance' ? campoDistanciaCardio('gcwo-bloco-recdistance', distanciaParteSeries(b.recovery), b.recovery.intensity, modality) : campoDuracaoMMSS('gcwo-bloco-recdur', duracaoParteSeries(b.recovery), 'Duração')}
          ${isNatacao ? '' : wrapIntensidade(b.block_id, 'recovery', b.recovery.intensity, temZona, modality)}
        </section>
      </div>
    </div>`;
}
function renderBlocoCardio(b, s) {
  const temZona = modalidadeTemZona(s.modality);
  if (b.type === 'series') {
    const soDistancia = s.modality === 'Natação';
    if (soDistancia) {
      b.work.measure = 'distance';
      b.recovery.measure = 'time';
      b.recovery.distance_m = null;
      b.recovery.intensity.zone = null;
    }
    return renderBlocoSeries(b, temZona, soDistancia, s.modality);
  }
  if (b.type === 'closing') return renderBlocoFecho(b, temZona, s.modality);
  return renderBlocoContinuo(b, temZona, s.modality);
}
function renderBlocosListInner(s) {
  if (!s.blocks.length) return '';
  let bloco = s.blocks.find(b => b.block_id === s._selectedBlockId);
  if (!bloco) bloco = s.blocks[0];
  s._selectedBlockId = bloco.block_id;
  if (bloco.type === 'continuous') return '';
  return `<div class="gcwo-cardio-editor"><div class="gcwo-cardio-editor-head"><strong>A editar o bloco ${s.blocks.indexOf(bloco) + 1}</strong><span>As alterações aparecem imediatamente na linha da sessão.</span></div>${renderBlocoCardio(bloco, s)}</div>`;
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
    ${modalidadeTemZona(s.modality) ? renderPaletaCardio(s) : ''}
    ${modalidadeTemZona(s.modality) ? `<div id="gcwoPCardioOverview">${renderResumoVisualCardio(s)}</div>` : ''}
    ${modalidadeTemZona(s.modality) ? `<div id="gcwoPZonaResumo">${renderIndicadorZonaHtml(s)}</div>` : ''}
    ${modalidadeTemZona(s.modality) ? `<div id="gcwoPAnaliseTreino">${renderAnaliseSessaoCardioHtml(s)}</div>` : ''}
    <div class="gcwo-exercicios" id="gcwoPBlocosList">${renderBlocosListInner(s)}</div>
  `;
}

let _ignorarCliqueCardioAte = 0;
function wireArrastoPonteiroCardio(elemento, aoLargar) {
  elemento.addEventListener('pointerdown', (inicio) => {
    if (inicio.button !== 0) return;
    const origemX = inicio.clientX, origemY = inicio.clientY;
    let arrastou = false;
    const overview = document.getElementById('gcwoPCardioOverview');
    const mover = (e) => {
      if (!arrastou && Math.hypot(e.clientX - origemX, e.clientY - origemY) < 7) return;
      arrastou = true;
      elemento.classList.add('is-pointer-dragging');
      const sobPonteiro = document.elementFromPoint(e.clientX, e.clientY);
      overview?.classList.toggle('is-dragover', !!sobPonteiro && overview.contains(sobPonteiro));
      e.preventDefault();
    };
    const terminar = (e) => {
      document.removeEventListener('pointermove', mover);
      document.removeEventListener('pointerup', terminar);
      document.removeEventListener('pointercancel', cancelar);
      elemento.classList.remove('is-pointer-dragging');
      overview?.classList.remove('is-dragover');
      if (!arrastou) return;
      _ignorarCliqueCardioAte = Date.now() + 350;
      const sobPonteiro = document.elementFromPoint(e.clientX, e.clientY);
      if (overview && sobPonteiro && overview.contains(sobPonteiro)) aoLargar(sobPonteiro);
      e.preventDefault();
    };
    const cancelar = () => {
      document.removeEventListener('pointermove', mover);
      document.removeEventListener('pointerup', terminar);
      document.removeEventListener('pointercancel', cancelar);
      elemento.classList.remove('is-pointer-dragging');
      overview?.classList.remove('is-dragover');
    };
    document.addEventListener('pointermove', mover, { passive:false });
    document.addEventListener('pointerup', terminar, { passive:false });
    document.addEventListener('pointercancel', cancelar);
  });
}

function moverBlocoCardio(s, moverBid, alvoBid=null) {
  const origem = s.blocks.findIndex(b => b.block_id === moverBid);
  if (origem < 0 || alvoBid === moverBid) return;
  const [movido] = s.blocks.splice(origem, 1);
  const destino = alvoBid ? s.blocks.findIndex(b => b.block_id === alvoBid) : s.blocks.length;
  s.blocks.splice(destino < 0 ? s.blocks.length : destino, 0, movido);
  s._selectedBlockId = moverBid;
  refreshBlocosListDom(s);
}

function wireTimelineCardio(s) {
  const overview = document.getElementById('gcwoPCardioOverview');
  if (!overview) return;
  overview.querySelectorAll('[data-select-bid]').forEach(btn => btn.addEventListener('click', (e) => {
    if (Date.now() < _ignorarCliqueCardioAte) { e.preventDefault(); return; }
    s._selectedBlockId = btn.getAttribute('data-select-bid');
    refreshBlocosListDom(s);
  }));
  overview.querySelectorAll('[data-timeline-bid]').forEach(card => {
    const bid = card.getAttribute('data-timeline-bid');
    wireArrastoPonteiroCardio(card, (sobPonteiro) => moverBlocoCardio(s, bid, sobPonteiro.closest('[data-timeline-bid]')?.getAttribute('data-timeline-bid') || null));
  });
}

function wireIntensidadeForms(s) {
  document.querySelectorAll('#gcwoPBlocosList .gcwo-intensidade, #gcwoPCardioQuickEdit .gcwo-intensidade').forEach(box => {
    const bid = box.getAttribute('data-bid');
    const scope = box.getAttribute('data-scope');
    const b = s.blocks.find(x => x.block_id === bid);
    if (!b) return;
    const intensity = intensidadeDoScope(b, scope);

    box.querySelectorAll('.gcwo-int-zone').forEach(zoneEl => zoneEl.addEventListener('click', (e) => {
      intensity.zone = e.currentTarget.getAttribute('data-zone') || null;
      box.querySelectorAll('.gcwo-int-zone').forEach(btn => btn.classList.toggle('on', btn === e.currentTarget));
      const hintEl = box.querySelector('.gcwo-int-zone-hint');
      if (hintEl) {
        const ranges = intervalosZonaCardio(intensity.zone, s.modality);
        hintEl.textContent = ranges.length ? `${intensity.zone} · ${ranges.join(' · ')}` : '';
      }
      actualizarTempoDerivadoCardio(box, intensity, s.modality);
      refreshZonaResumo(s);
    }));
    const paceEl = box.querySelector('.gcwo-int-pace');
    if (paceEl) paceEl.addEventListener('input', (e) => {
      intensity.pace_sec_per_km = parsePaceParaSegundos(e.target.value);
      const kmhEl = box.querySelector('.gcwo-pace-kmh');
      if (kmhEl) kmhEl.textContent = ritmoParaKmh(intensity.pace_sec_per_km) || '—';
      actualizarTempoDerivadoCardio(box, intensity, s.modality);
      refreshZonaResumo(s);
    });
    const pace100El = box.querySelector('.gcwo-int-pace100');
    if (pace100El) pace100El.addEventListener('input', (e) => { intensity.pace_sec_per_100m = parsePaceParaSegundos(e.target.value); actualizarTempoDerivadoCardio(box, intensity, s.modality); refreshZonaResumo(s); });
    const speedEl = box.querySelector('.gcwo-int-speed');
    if (speedEl) speedEl.addEventListener('input', (e) => { intensity.speed_kmh = e.target.value === '' ? null : Number(e.target.value); });
    box.querySelector('.gcwo-int-fc').addEventListener('input', (e) => { intensity.heart_rate_bpm = e.target.value === '' ? null : Number(e.target.value); });
    box.querySelector('.gcwo-int-power').addEventListener('input', (e) => { intensity.power_w = e.target.value === '' ? null : Number(e.target.value); refreshZonaResumo(s); });
    box.querySelector('.gcwo-int-cadence').addEventListener('input', (e) => { intensity.cadence_rpm = e.target.value === '' ? null : Number(e.target.value); });
    box.querySelector('.gcwo-int-rpe').addEventListener('input', (e) => { intensity.rpe = e.target.value === '' ? null : Number(e.target.value); });
  });
}

function actualizarTempoDerivadoCardio(box, intensity, modality) {
  const scope = box.getAttribute('data-scope');
  const card = box.closest('.gcwo-exercicio');
  const selector = scope === 'work' ? '.gcwo-bloco-workdistance' : (scope === 'recovery' ? '.gcwo-bloco-recdistance' : '.gcwo-bloco-distance');
  const input = card?.querySelector(selector);
  const output = input?.closest('.gcwo-distance-field')?.querySelector('.gcwo-derived-time');
  if (output) output.textContent = textoTempoDistancia(input.value, intensity, modality);
}

function refreshBlocosListDom(s) {
  const host = document.getElementById('gcwoPBlocosList');
  if (host) host.innerHTML = renderBlocosListInner(s);
  const quick = document.getElementById('gcwoPCardioQuickEdit');
  if (quick) quick.innerHTML = renderEditorRapidoCardio(s);
  const seleccionado = blocoSelecionadoCardio(s);
  const zonaSeleccionada = seleccionado?.type === 'series' ? seleccionado.work?.intensity?.zone : seleccionado?.intensity?.zone;
  document.querySelectorAll('.gcwo-cardio-zone[data-add-zone]').forEach(btn => btn.classList.toggle('is-current', btn.getAttribute('data-add-zone') === zonaSeleccionada));
  document.querySelector('.gcwo-cardio-series')?.classList.toggle('is-current', seleccionado?.type === 'series');
  wireBlocosList(s);
  refreshZonaResumo(s);
  const overview = document.getElementById('gcwoPCardioOverview');
  if (overview) overview.innerHTML = renderResumoVisualCardio(s);
  wireTimelineCardio(s);
  refreshReviewCount(s);
}

function wireBlocosList(s) {
  document.querySelectorAll('#gcwoPBlocosList [data-remove-bid], #gcwoPCardioQuickEdit [data-remove-bid]').forEach(btn => {
    btn.addEventListener('click', () => {
      const bid = btn.getAttribute('data-remove-bid');
      s.blocks = s.blocks.filter(b => b.block_id !== bid);
      refreshBlocosListDom(s);
    });
  });
  document.querySelectorAll('#gcwoPBlocosList .gcwo-exercicio, #gcwoPCardioQuickEdit .gcwo-exercicio').forEach(card => {
    const bid = card.getAttribute('data-bid');
    const b = s.blocks.find(x => x.block_id === bid);
    if (!b) return;

    wireDuracaoMMSS(card, 'gcwo-bloco-duracaomin', (sec) => { b.duration_sec = sec; refreshZonaResumo(s); });

    const distanceEl = card.querySelector('.gcwo-bloco-distance');
    if (distanceEl) distanceEl.addEventListener('input', (e) => {
      b.distance_m = e.target.value === '' ? null : Number(e.target.value);
      actualizarTempoDerivadoCardio(card.querySelector('[data-scope="main"]'), b.intensity, s.modality);
      refreshZonaResumo(s);
    });

    card.querySelectorAll(`input[name="gcwo-cont-medida-${CSS.escape(bid)}"]`).forEach(radio => radio.addEventListener('change', (e) => {
      if (!e.target.checked) return;
      b.measure = e.target.value;
      refreshBlocosListDom(s);
    }));

    const modeEl = card.querySelector('.gcwo-bloco-mode');
    if (modeEl) modeEl.addEventListener('change', (e) => { b.mode = e.target.value; });

    const countEl = card.querySelector('.gcwo-bloco-count');
    if (countEl) countEl.addEventListener('input', (e) => {
      b.count = e.target.value === '' ? null : Number(e.target.value);
      refreshZonaResumo(s);
    });

    if (b.work && medidaParteSeries(b.work, s.modality) === 'distance') {
      const workValEl = card.querySelector('.gcwo-bloco-workdistance');
      if (workValEl) workValEl.addEventListener('input', (e) => {
        b.work.distance_m = e.target.value === '' ? null : Number(e.target.value);
        b.work.value = b.work.distance_m;
        actualizarTempoDerivadoCardio(card.querySelector('[data-scope="work"]'), b.work.intensity, s.modality);
        refreshZonaResumo(s);
      });
    } else if (b.work) {
      wireDuracaoMMSS(card, 'gcwo-bloco-workvalue', (sec) => { b.work.duration_sec = sec; b.work.value = sec; refreshZonaResumo(s); });
    }

    if (b.recovery) {
      if (medidaParteSeries(b.recovery, s.modality) === 'distance') {
        const recDistanceEl = card.querySelector('.gcwo-bloco-recdistance');
        if (recDistanceEl) recDistanceEl.addEventListener('input', (e) => {
          b.recovery.distance_m = e.target.value === '' ? null : Number(e.target.value);
          actualizarTempoDerivadoCardio(card.querySelector('[data-scope="recovery"]'), b.recovery.intensity, s.modality);
          refreshZonaResumo(s);
        });
      } else {
        wireDuracaoMMSS(card, 'gcwo-bloco-recdur', (sec) => { b.recovery.duration_sec = sec; refreshZonaResumo(s); });
      }
    }

    card.querySelectorAll(`input[name="gcwo-medida-${CSS.escape(bid)}"]`).forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (!e.target.checked) return;
        if (b.work.measure === 'distance') b.work.distance_m = distanciaParteSeries(b.work);
        else b.work.duration_sec = duracaoParteSeries(b.work);
        b.work.measure = e.target.value;
        b.work.unit = e.target.value === 'distance' ? 'm' : 's';
        b.work.value = e.target.value === 'distance' ? b.work.distance_m : b.work.duration_sec;
        refreshBlocosListDom(s);
      });
    });
    card.querySelectorAll(`input[name="gcwo-rec-medida-${CSS.escape(bid)}"]`).forEach(radio => radio.addEventListener('change', (e) => {
      if (!e.target.checked) return;
      b.recovery.measure = e.target.value;
      refreshBlocosListDom(s);
    }));
  });
  wireIntensidadeForms(s);
}

function wirePanelCardio(s) {
  document.querySelectorAll('[data-add-zone]').forEach(btn => {
    const zona = btn.getAttribute('data-add-zone');
    btn.addEventListener('click', (e) => {
      if (Date.now() < _ignorarCliqueCardioAte) { e.preventDefault(); return; }
      adicionarBlocoZona(s, zona);
    });
    wireArrastoPonteiroCardio(btn, () => adicionarBlocoZona(s, zona));
  });
  document.querySelectorAll('[data-add-series]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (Date.now() < _ignorarCliqueCardioAte) { e.preventDefault(); return; }
      adicionarSeriesPreformatadas(s);
    });
    wireArrastoPonteiroCardio(btn, () => adicionarSeriesPreformatadas(s));
  });
  wireBlocosList(s);
  wireTimelineCardio(s);
  refreshZonaResumo(s);
  refreshAnaliseSessaoCardio(s);

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
          exercise_id: null, exercise_name: null, photo_url: null, video_url: null, tecnica_notas: null, tecnica_info: null,
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
          photo_url: catEx?.photo_url || null, video_url: catEx?.video_url || null, tecnica_notas: catEx?.tecnica_notas || null, tecnica_info: catEx?.tecnica_info || null,
          exercise_index: ei + 1, exercise_total: exs.length, round_index: r, round_total: R,
        });
        if (ex.rest_after_s) {
          intervals.push({
            type: 'descanso', label: ex.name, duration_sec: ex.rest_after_s,
            exercise_id: ex.exercise_id, exercise_name: ex.name,
            photo_url: catEx?.photo_url || null, video_url: catEx?.video_url || null, tecnica_notas: catEx?.tecnica_notas || null, tecnica_info: catEx?.tecnica_info || null,
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
          photo_url: catProx?.photo_url || null, video_url: catProx?.video_url || null, tecnica_notas: catProx?.tecnica_notas || null, tecnica_info: catProx?.tecnica_info || null,
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
  // Um plano novo precisa de conteúdo. Um plano já existente pode ser gravado
  // sem sessões para permitir retirar toda a programação sem apagar o histórico.
  return Boolean(_state.activePrescriptionId) || _state.sessions.some(sessaoTemConteudo);
}
// Texto do botão único de gravar — diz a verdade sobre o que vai acontecer em vez de
// dizer sempre "Gerar…": para um doente com plano activo já carregado neste ecrã
// (activePrescriptionId != null), gravar actualiza esse registo e mantém o link que o
// doente já tem; só cria prescrição+link novos quando não há nenhum plano activo. Não
// muda o comportamento (já era assim), só o rótulo (9 ago 2026).
function labelBotaoGerar() {
  if (_returnToAcompanhamento) return 'Guardar e voltar ao acompanhamento';
  return _state.activePrescriptionId ? 'Atualizar plano' : 'Gerar prescrição e link';
}
function updateGerarButtonState() {
  const btn = document.getElementById('gcwoGerar');
  if (!btn) return;
  const ok = hasSessionComExercicios();
  btn.disabled = !ok;
  btn.textContent = labelBotaoGerar();
  btn.title = ok ? '' : 'Adiciona pelo menos uma sessão com conteúdo para criar o plano.';
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
  const base = {
    session_id: s.session_id,
    date: s.date,
    order: s.order,
    kind: s.kind,
    modality: s.modality,
    local: s.local,
    momento: s.momento || null,
    notes: (s.notes || '').trim() || null,
    execution_mode: s.kind === 'list' ? modoExecucaoGinasio(s) : null,
  };
  if (s.kind === 'walk') return { ...base, walks: s.walks, stairs_flights: s.stairs_flights };
  if (s.kind === 'circuit') return { ...base, blocks: flattenBlocosCircuitoParaGravar(s.blocks) };
  if (s.kind === 'card' && s.modality === 'Natação') {
    return { ...base, blocks: s.blocks, pool_length_m: s.pool_length_m ?? 25, stroke: s.stroke ?? 'crol' };
  }
  if (s.kind === 'card') return { ...base, blocks: s.blocks };
  return { ...base, items: s.items };
}
// Fotografia das zonas em vigor no momento de gravar (spec-zonas-treino.md) — zero
// alteração a wo_prescriptions: `data` já é jsonb, isto é só mais uma chave nova. Planos
// antigos não a têm e continuam a abrir sem ela (ver leitura em renderStep3/histórico,
// que trata zone_snapshots como opcional). Guarda o perfil como estava no momento da
// gravação, não só a zona usada num bloco — se a fórmula ou os intervalos mudarem
// depois, este plano continua interpretável tal como foi prescrito. Percorre todas as
// modalidades/métricas activas do doente (Fase 2: corrida + ciclismo em simultâneo),
// não só as de corrida.
function buildZoneSnapshots() {
  const perfis = _state.zonaPerfis;
  if (!perfis) return [];
  return Object.values(perfis)
    .flatMap(porModalidade => Object.values(porModalidade || {}))
    .filter(Boolean)
    .map(perfil => ({
      profile_id: perfil.id,
      modality: perfil.modality,
      metric: perfil.metric,
      unit: perfil.unit,
      method: perfil.method,
      ftp_w: perfil.ftp_w ?? null,
      ranges: (perfil.wo_zone_ranges || [])
        .slice()
        .sort((a, b) => a.zone_order - b.zone_order)
        .map(r => ({
          zone_key: r.zone_key,
          zone_order: r.zone_order,
          lower_value: r.lower_value,
          upper_value: r.upper_value,
        })),
    }));
}

function buildFinalData() {
  return {
    startDate: _state.startDate,
    endDate: _state.endDate,
    linkExpiryMode: _state.linkExpiryMode,
    linkExpiryDate: _state.linkExpiryMode === 'selected_date' ? _state.linkExpiryDate : null,
    dataRevisao: _state.dataRevisao,
    duracaoSessaoPadrao: _state.duracaoSessaoPadrao,
    diasPorSemanaHabitual: _state.diasPorSemanaHabitual,
    restricoes: restricoesAtuais(),
    sessions: _state.sessions.map(sessaoParaGravar),
    zone_snapshots: buildZoneSnapshots(),
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
  if (!_state.sessions.length && !_state.activePrescriptionId) return 'Adiciona pelo menos uma sessão.';
  const ultimoTreino = ultimoDiaPrescrito();
  if (_state.linkExpiryMode === 'selected_date' && !_state.linkExpiryDate) return 'Falta escolher a validade do link.';
  if (_state.linkExpiryMode === 'selected_date' && ultimoTreino && _state.linkExpiryDate < ultimoTreino) return 'A validade do link não pode terminar antes do último treino.';
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

  if (_state.activePrescriptionId && !_state.sessions.length) {
    const confirmou = window.confirm(
      'Guardar o plano sem sessões?\n\nO doente deixará de ter exercícios programados. O acompanhamento e o histórico mantêm-se.'
    );
    if (!confirmou) return;
  }

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
    const ultimoTreino = ultimoDiaPrescrito();
    const dataValidade = _state.linkExpiryMode === 'selected_date' ? _state.linkExpiryDate : (ultimoTreino || _state.endDate);
    const expiresAtNovo = expiresAtDeIso(dataValidade);
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
    // Quando a prescrição nasceu no acompanhamento digital, o endereço que se
    // envia ao doente é a ligação geral. O token próprio do motor de treino fica
    // interno e regressamos ao menu, que recarrega o estado acabado de gravar.
    if (_returnToAcompanhamento && typeof window.__gc_openAcompanhamentoPanel === 'function') {
      window.__gc_openAcompanhamentoPanel(_returnToAcompanhamento.patientId, _returnToAcompanhamento.clinicId);
      return;
    }
    renderStep3();
  } catch (err) {
    // Nenhum token aparece em logs nem em mensagens de erro — mesmo na (muitíssimo improvável)
    // colisão do índice único de token, a mensagem do Postgres viria com o valor lá dentro.
    let safeMsg = err?.message || String(err);
    tokensAEscrubar.forEach((t) => { safeMsg = safeMsg.split(t).join('«token»'); });
    console.error('[prescricao] erro a gravar prescrição:', safeMsg);
    erroEl.textContent = 'Erro ao gravar: ' + safeMsg;
    btn.disabled = false;
    btn.textContent = labelBotaoGerar();
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

/* ================================================================
   EXERCÍCIOS POR PATOLOGIA (EX-07)
   -----------------------------------------------------------------
   Ponto de entrada a partir do cartão "Exercícios por patologia" na
   landing do módulo. Fluxo: Região → Tipo → Protocolo → Fase →
   Exercícios → "Avançar para prescrição". 100% data-driven a partir
   de protocols_catalog/protocol_phases/protocol_phase_exercises — sem
   nomes de protocolo/fase/exercício hardcoded no JS.
   NÃO é um segundo motor de prescrição: o resultado final é sempre
   sessão(ões) no mesmo formato de _state.sessions/renderItemCard, só
   pré-preenchidas — a partir daí seguem o editor actual sem alteração.
   ================================================================= */
let _patologia = null;         // null fora do fluxo; objecto de trabalho quando activo
let _patologiaPendente = null; // selecção já confirmada, à espera de doente (ver renderStep1)
let _returnToAcompanhamento = null; // {patientId,clinicId} quando lançado a partir de acompanhamento-clinico.html — ver initPrescricao()

const TIPO_PATOLOGIA_LABELS = { cirurgico: 'Cirúrgico', conservador: 'Conservador / Não cirúrgico' };
function rotuloTipoPatologia(k) {
  return TIPO_PATOLOGIA_LABELS[k] || (k ? k.charAt(0).toUpperCase() + k.slice(1) : '');
}
function rotuloRegiaoPatologia(r) {
  return r ? r.charAt(0).toUpperCase() + r.slice(1) : '';
}

function freshPatologia() {
  return {
    regiao: null, tipo: null, protocoloId: null, faseId: null,
    protocolos: [], fases: [], faseExerciciosCount: {}, exercicios: [],
    dataCirurgia: '', // estado só local da UI — nunca gravado (ponto 4 do pedido)
    selecionados: new Map(), // exercise_id -> { origem:'protocolo'|'catalogo', context, is_optional, prescription_defaults, clinical_note }
    adicionadosCatalogo: [], // exercise_ids acrescentados por "+ Adicionar exercício" (para distinguir da lista do protocolo)
    catalogAberto: false, catalogFiltro: 'todos', catalogBusca: '', catalogEquip: new Set(),
    loading: false, erro: '',
    // Particularidades cirúrgicas (adenda EX-07, generalizado a qualquer protocolo) — só estado
    // local do fluxo, nunca gravado em protocol_phase_exercises/protocol_phases nem em nova
    // tabela. Chaves dinâmicas: vêm de protocols_catalog.data.modificadores do protocolo activo.
    surgicalModifiers: {},     // key -> boolean (checkbox marcado)
    surgicalModifiersText: {}, // key -> string (só para modificadores type:'text')
  };
}

// Particularidades cirúrgicas (adenda EX-07, generalizado): a lista de modificadores, os seus
// rótulos e o texto-fallback vêm de protocols_catalog.data.modificadores do protocolo activo.
// Protocolo sem modificadores definidos (ainda o caso de TSA/RSA/Capsulite) → secção não aparece.
function modificadoresDoProtocoloActual() {
  const p = _patologia.protocolos.find(x => x.id === _patologia.protocoloId);
  return (p?.data?.modificadores) || [];
}

// Cada fase pode definir o seu próprio texto em data.modificadores_cuidados[key] (jsonb, sem
// schema novo) — quando a fase actual não tiver essa chave (ou não a definir para este
// modificador em particular), cai no fallback default_text definido no protocolo. A Fase 1 da
// Sutura da coifa (já aprovada) nunca define esta chave, por isso continua a usar sempre o
// fallback — os textos que já tinha, byte a byte, sem precisar de nenhuma escrita na Fase 1.
function textoCuidadoModificadorPatologia(key) {
  const fase = _patologia.fases.find(f => f.id === _patologia.faseId);
  const overrideFase = fase?.data?.modificadores_cuidados?.[key];
  if (overrideFase) return overrideFase;
  const def = modificadoresDoProtocoloActual().find(m => m.key === key);
  return def?.default_text || '';
}

// Só entram na lista os modificadores com conteúdo real a mostrar — modificadores type:'text'
// só contam quando há texto escrito (mostrar exactamente o texto, nunca uma linha vazia);
// desmarcar uma opção fá-la desaparecer daqui de imediato (ponto 5 dos testes).
function listaCuidadosEspecificosPatologia() {
  const m = _patologia.surgicalModifiers;
  const cuidados = [];
  modificadoresDoProtocoloActual().forEach(opt => {
    if (!m[opt.key]) return;
    if (opt.type === 'text') {
      const texto = (_patologia.surgicalModifiersText[opt.key] || '').trim();
      if (texto) cuidados.push({ label: opt.label, texto });
    } else {
      cuidados.push({ label: opt.label, texto: textoCuidadoModificadorPatologia(opt.key) });
    }
  });
  return cuidados;
}

function renderModificadoresCirurgicosPatologia() {
  const modificadores = modificadoresDoProtocoloActual();
  if (!modificadores.length) return '';
  const m = _patologia.surgicalModifiers;
  return `
    <div class="gcwo-field gcwo-pat-modificadores-field">
      <span class="gcwo-field-label">Particularidades cirúrgicas</span>
      <div class="gcwo-pat-modificadores-hint">Selecione apenas se aplicável</div>
      <div class="gcwo-pat-modificadores-lista">
        ${modificadores.map(opt => `
          <label class="gcwo-pat-modificador-item">
            <input type="checkbox" data-pat-modificador="${escAttr(opt.key)}" ${m[opt.key] ? 'checked' : ''}>
            <span>${escHtml(opt.label)}</span>
          </label>`).join('')}
      </div>
      ${modificadores.filter(opt => opt.type === 'text' && m[opt.key]).map(opt => `
      <label class="gcwo-field gcwo-field-sm gcwo-pat-restricao-texto">
        <span>Indicações/restrições específicas</span>
        <input type="text" data-pat-modificador-texto="${escAttr(opt.key)}" value="${escAttr(_patologia.surgicalModifiersText[opt.key] || '')}" placeholder="Ex.: sem rotação interna resistida até à 10ª semana">
      </label>`).join('')}
    </div>`;
}

function renderCuidadosEspecificosPatologia() {
  const cuidados = listaCuidadosEspecificosPatologia();
  if (!cuidados.length) return '';
  return `
    <div class="gcwo-pat-cuidados">
      <span class="gcwo-field-label">Cuidados específicos</span>
      <ul>${cuidados.map(c => `<li><b>${escHtml(c.label)}:</b> ${escHtml(c.texto)}</li>`).join('')}</ul>
    </div>`;
}
// Actualiza só o bloco "Cuidados específicos" a cada tecla no campo de texto da restrição do
// cirurgião — mesmo princípio dos campos numéricos do editor de dose: nunca volta a desenhar
// o ecrã todo, senão o campo de texto perdia o foco a meio de escrever.
function refreshCuidadosEspecificosPatologia() {
  const wrap = document.getElementById('gcwoPatCuidadosWrap');
  if (wrap) wrap.innerHTML = renderCuidadosEspecificosPatologia();
}

// Semanas decorridas desde a cirurgia (0 no próprio dia) — só orientação visual, nunca decide
// sozinho, o médico confirma sempre a fase (ponto 4 do pedido).
function semanasPosCirurgiaPatologia() {
  if (!_patologia.dataCirurgia) return null;
  const hoje = isoHoje();
  if (_patologia.dataCirurgia > hoje) return null; // data no futuro — não faz sentido calcular
  return Math.floor((diasEntreInclusivo(_patologia.dataCirurgia, hoje) - 1) / 7);
}

function abrirPatologia() {
  _patologia = freshPatologia();
  renderPatologia();
  carregarProtocolosCatalogo();
}

async function carregarProtocolosCatalogo() {
  _patologia.loading = true; _patologia.erro = ''; renderPatologiaBody();
  const { data, error } = await window.sb
    .from('protocols_catalog')
    .select('id,region,name,kind,sort_order,data')
    .eq('is_active', true)
    .order('region').order('sort_order').order('name');
  _patologia.loading = false;
  if (error) {
    console.error('[prescricao] falha a carregar protocols_catalog:', error);
    _patologia.erro = 'Não foi possível carregar os protocolos.';
  } else {
    _patologia.protocolos = data || [];
  }
  renderPatologiaBody();
}

async function carregarFasesPatologia(protocolId) {
  _patologia.protocoloId = protocolId;
  _patologia.faseId = null;
  _patologia.fases = [];
  _patologia.faseExerciciosCount = {};
  _patologia.exercicios = [];
  _patologia.selecionados = new Map();
  _patologia.adicionadosCatalogo = [];
  _patologia.surgicalModifiers = {}; _patologia.surgicalModifiersText = {}; // troca de protocolo — particularidades são só do protocolo anterior
  _patologia.loading = true; _patologia.erro = ''; renderPatologiaBody();

  const { data, error } = await window.sb
    .from('protocol_phases')
    .select('id,protocol_id,phase_order,name,anchor_kind,anchor_from,anchor_to,data')
    .eq('protocol_id', protocolId)
    .order('phase_order');
  _patologia.loading = false;
  if (error) {
    console.error('[prescricao] falha a carregar protocol_phases:', error);
    _patologia.erro = 'Não foi possível carregar as fases deste protocolo.';
  } else {
    _patologia.fases = data || [];
    carregarContagemExerciciosFasesPatologia();
  }
  renderPatologiaBody();
}

// Contagem de exercícios por fase para os cartões de fase (ponto 3) — uma query só,
// contada em memória (protocol_phase_exercises é uma tabela pequena, sem necessidade de RPC).
async function carregarContagemExerciciosFasesPatologia() {
  const ids = _patologia.fases.map(f => f.id);
  if (!ids.length) return;
  const { data, error } = await window.sb.from('protocol_phase_exercises').select('id,phase_id').in('phase_id', ids);
  if (error) { console.error('[prescricao] falha a contar exercícios por fase:', error); return; }
  const contagem = {};
  (data || []).forEach(r => { contagem[r.phase_id] = (contagem[r.phase_id] || 0) + 1; });
  _patologia.faseExerciciosCount = contagem;
  renderPatologiaBody();
}

async function carregarExerciciosFasePatologia(faseId) {
  _patologia.faseId = faseId;
  _patologia.exercicios = [];
  _patologia.selecionados = new Map();
  _patologia.adicionadosCatalogo = [];
  _patologia.loading = true; _patologia.erro = ''; renderPatologiaBody();

  const { data, error } = await window.sb
    .from('protocol_phase_exercises')
    .select('id,exercise_id,sort_order,context,is_optional,prescription_defaults,clinical_note')
    .eq('phase_id', faseId)
    .order('sort_order', { ascending: true, nullsFirst: false });
  _patologia.loading = false;
  if (error) {
    console.error('[prescricao] falha a carregar protocol_phase_exercises:', error);
    _patologia.erro = 'Não foi possível carregar os exercícios desta fase.';
    renderPatologiaBody();
    return;
  }
  _patologia.exercicios = data || [];
  // Sugestões do protocolo entram já seleccionadas — o médico desmarca o que não quiser
  // (ponto 6: "remover exercício sugerido do plano sem apagar da BD" — nunca escreve na BD aqui).
  (data || []).forEach(row => {
    if (!_state.exercisesCatalog.find(e => e.id === row.exercise_id)) return; // exercício inactivo/removido — não quebra
    _patologia.selecionados.set(row.exercise_id, {
      origem: 'protocolo', context: row.context, is_optional: row.is_optional,
      prescription_defaults: row.prescription_defaults || {}, clinical_note: row.clinical_note,
    });
  });
  renderPatologiaBody();
}

function alternarSelecaoExercicioPatologia(exId) {
  if (_patologia.selecionados.has(exId)) {
    _patologia.selecionados.delete(exId);
  } else {
    const row = _patologia.exercicios.find(r => r.exercise_id === exId);
    _patologia.selecionados.set(exId, row
      ? { origem: 'protocolo', context: row.context, is_optional: row.is_optional, prescription_defaults: row.prescription_defaults || {}, clinical_note: row.clinical_note }
      : { origem: 'catalogo', context: null, is_optional: false, prescription_defaults: {}, clinical_note: null });
  }
  renderPatologiaBody();
}

function adicionarExercicioCatalogoPatologia(exId) {
  if (_patologia.selecionados.has(exId)) return; // já está seleccionado (era sugestão do protocolo, p.ex.)
  _patologia.selecionados.set(exId, { origem: 'catalogo', context: null, is_optional: false, prescription_defaults: {}, clinical_note: null });
  if (!_patologia.adicionadosCatalogo.includes(exId)) _patologia.adicionadosCatalogo.push(exId);
  renderPatologiaBody();
}
function removerAdicionadoPatologia(exId) {
  _patologia.selecionados.delete(exId);
  _patologia.adicionadosCatalogo = _patologia.adicionadosCatalogo.filter(id => id !== exId);
  renderPatologiaBody();
}

// context='indiferente' (ou ausente) nunca força local — cai num grupo "sem local", o médico
// escolhe depois no chip do editor normal (mesma regra do EX-06). 1 sessão = 1 local: nunca
// mistura contextos diferentes na mesma sessão (ponto 7 do pedido).
function agruparSelecaoPatologiaPorLocal() {
  const grupos = new Map(); // local (string|null) -> [{ex, info}]
  _patologia.selecionados.forEach((info, exerciseId) => {
    const ex = _state.exercisesCatalog.find(e => e.id === exerciseId);
    if (!ex) return;
    const local = (info.context && info.context !== 'indiferente') ? info.context : null;
    if (!grupos.has(local)) grupos.set(local, []);
    grupos.get(local).push({ ex, info });
  });
  return grupos;
}

// Mesma forma do item que toggleExercicioNaSessao (secção "1. Escolher exercícios") já
// constrói — repetida aqui de propósito em vez de reaproveitada directamente, para não mexer
// nessa função partilhada (sem refactors grandes nesta tarefa). prescription_defaults do
// protocolo, quando presentes, sobrepõem-se aos defaults normais — só chaves de dose já
// conhecidas do editor actual, nunca inventa campos novos.
const PATOLOGIA_CHAVES_DOSE = ['sets', 'reps_min', 'reps_max', 'reps_fixed', 'load', 'incremento', 'rest_set', 'rest_next',
  'tempo_excentrico_s', 'pausa_inferior_s', 'tempo_concentrico_s', 'pausa_superior_s', 'duration_sec', 'duration_series', 'series'];
function criarItemPatologia(ex, info) {
  const usaTempo = exercicioUsaTempoPorDefeito(ex);
  const item = {
    exercise_id: ex.id,
    name: ex.name,
    photo_url: ex.photo_url || null,
    video_url: ex.video_url || null,
    tecnica_notas: ex.tecnica_notas || null,
    tecnica_info: ex.tecnica_info || null,
    equipamento: ex.equipamento || [],
    machine_adjustment_suggestions: Array.isArray(ex.ajustes_maquina) ? ex.ajustes_maquina.map(a => a?.etiqueta).filter(Boolean) : [],
    prescription_note: null,
    categoria: ex.categoria || [],
    sets: usaTempo ? (ex.name.toLowerCase().includes('bicicleta') ? 1 : 3) : 3,
    reps_min: usaTempo ? null : 8,
    reps_max: usaTempo ? null : 12,
    reps_fixed: null,
    load: null,
    incremento: ex.incremento_default ?? null,
    rest_set: usaTempo ? 15 : 60,
    rest_next: 90,
    tempo_excentrico_s: ex.tempo_excentrico_s ?? 2,
    pausa_inferior_s: 0,
    tempo_concentrico_s: ex.tempo_concentrico_s ?? 1,
    pausa_superior_s: 0,
    duration_sec: usaTempo && ex.name.toLowerCase().includes('bicicleta') ? 600 : null,
    duration_series: usaTempo ? (ex.name.toLowerCase().includes('bicicleta') ? [{ duration_sec: 600 }] : [{ duration_sec: 30 }, { duration_sec: 30 }, { duration_sec: 30 }]) : null,
    series: usaTempo ? null : [{ reps: 12, load: null }, { reps: 12, load: null }, { reps: 12, load: null }],
  };
  const defaults = (info && info.prescription_defaults) || {};
  PATOLOGIA_CHAVES_DOSE.forEach(k => { if (defaults[k] !== undefined) item[k] = defaults[k]; });
  return item;
}

// "Avançar para prescrição" — não cria sessão nenhuma ainda (só depois de saber o doente e o
// plano activo dele, ver aplicarPatologiaPendente); guarda a selecção já agrupada por local e
// segue para a procura de doente actual (ponto 11: só doente GC, fluxo já existente).
function avancarParaPrescricaoPatologia() {
  const grupos = agruparSelecaoPatologiaPorLocal();
  if (!grupos.size) return;
  const protocolo = _patologia.protocolos.find(p => p.id === _patologia.protocoloId);
  const fase = _patologia.fases.find(f => f.id === _patologia.faseId);
  const gruposArr = [];
  grupos.forEach((entradas, local) => {
    gruposArr.push({ local, items: entradas.map(({ ex, info }) => criarItemPatologia(ex, info)) });
  });
  _patologiaPendente = { protocoloNome: protocolo?.name || '', faseNome: fase?.name || '', grupos: gruposArr };
  _patologia = null;
  if (_state.patient) {
    aplicarPatologiaPendenteAoEstado();
    renderStep2();
    return;
  }
  renderStep1();
}

// Aplica a selecção pendente ao plano do doente escolhido — chamada só depois de
// carregarPlanoActivoSeExistir() já ter resolvido startDate/sessions (ver runPatientSearch em
// renderStep1), para a(s) sessão(ões) nova(s) caírem dentro da janela certa do plano.
function aplicarPatologiaPendenteAoEstado() {
  const pendente = _patologiaPendente;
  _patologiaPendente = null;
  if (!pendente || !pendente.grupos.length) return;
  const origemTxt = pendente.faseNome ? `Origem: ${pendente.protocoloNome} — ${pendente.faseNome}.` : '';
  pendente.grupos.forEach(grupo => {
    const sessao = novaSessaoSkeleton('Ginásio', 'list', _state.startDate);
    sessao.local = grupo.local; // null fica por escolher (context 'indiferente' ou ausente) — nunca força
    sessao.items = grupo.items;
    sessao.notes = origemTxt;
    _state.sessions.push(sessao);
  });
}

function renderPatologia() {
  const root = document.getElementById('gcwoPrescricaoRoot');
  if (!root) return;
  root.innerHTML = `
    <div class="gc-page-header">
      <div>
        <button type="button" class="gcwo-backlink" id="gcwoPatBackToLanding">← Exercício</button>
        <div class="gc-page-title">Exercícios por patologia</div>
        <div class="gc-page-sub">Partir de um protocolo clínico para pré-preencher a prescrição.</div>
      </div>
    </div>
    <div id="gcwoPatologiaBody"></div>
  `;
  document.getElementById('gcwoPatBackToLanding').addEventListener('click', () => {
    _patologia = null;
    if (_returnToAcompanhamento && typeof window.__gc_openAcompanhamentoPanel === 'function') {
      window.__gc_openAcompanhamentoPanel(_returnToAcompanhamento.patientId, _returnToAcompanhamento.clinicId);
      return;
    }
    renderLanding();
  });
  renderPatologiaBody();
}

function renderPatologiaBody() {
  const host = document.getElementById('gcwoPatologiaBody');
  if (!host || !_patologia) return;
  host.innerHTML = `
    ${_patologia.erro ? `<div class="gcwo-pat-erro">${escHtml(_patologia.erro)}</div>` : ''}
    ${renderSeletorProtocoloPatologia()}
    ${_patologia.protocoloId ? renderModificadoresCirurgicosPatologia() : ''}
    ${_patologia.protocoloId ? renderFasesPatologia() : ''}
    ${_patologia.faseId ? renderFaseDetalheEExerciciosPatologia() : ''}
    ${renderCatalogoPatologiaOverlay()}
  `;
  wirePatologiaBody();
}

function renderSeletorProtocoloPatologia() {
  if (_patologia.loading && !_patologia.protocolos.length) return `<div class="gcwo-muted">A carregar protocolos…</div>`;
  const regioes = [...new Set(_patologia.protocolos.map(p => p.region))];
  const tiposDaRegiao = _patologia.regiao
    ? [...new Set(_patologia.protocolos.filter(p => p.region === _patologia.regiao).map(p => p.kind))]
    : [];
  const protocolosDoTipo = (_patologia.regiao && _patologia.tipo)
    ? _patologia.protocolos.filter(p => p.region === _patologia.regiao && p.kind === _patologia.tipo)
    : [];
  return `
    <div class="gcwo-pat-selector">
      <div class="gcwo-field">
        <span class="gcwo-field-label">Região</span>
        ${regioes.length ? `<div class="gcwo-chips">${regioes.map(r => `<button type="button" class="gcwo-chip${_patologia.regiao === r ? ' on' : ''}" data-pat-regiao="${escAttr(r)}">${escHtml(rotuloRegiaoPatologia(r))}</button>`).join('')}</div>`
          : `<div class="gcwo-muted">Sem protocolos activos no catálogo.</div>`}
      </div>
      ${_patologia.regiao ? `
      <div class="gcwo-field">
        <span class="gcwo-field-label">Tipo</span>
        <div class="gcwo-chips">${tiposDaRegiao.map(t => `<button type="button" class="gcwo-chip${_patologia.tipo === t ? ' on' : ''}" data-pat-tipo="${escAttr(t)}">${escHtml(rotuloTipoPatologia(t))}</button>`).join('')}</div>
      </div>` : ''}
      ${(_patologia.regiao && _patologia.tipo) ? `
      <div class="gcwo-field">
        <span class="gcwo-field-label">Protocolo</span>
        ${protocolosDoTipo.length ? `<div class="gcwo-pat-protocol-list">${protocolosDoTipo.map(p => `
          <button type="button" class="gcwo-pat-protocol-row${_patologia.protocoloId === p.id ? ' on' : ''}" data-pat-protocolo="${escAttr(p.id)}">${escHtml(p.name)}</button>
        `).join('')}</div>` : `<div class="gcwo-muted">Sem protocolos activos para esta combinação.</div>`}
      </div>` : ''}
    </div>`;
}

function renderFasesPatologia() {
  if (_patologia.loading && !_patologia.fases.length) return `<div class="gcwo-muted">A carregar fases…</div>`;
  if (!_patologia.fases.length) return `<div class="gcwo-pat-vazio">Este protocolo ainda não tem fases definidas.</div>`;
  // "Data da cirurgia" só faz sentido em protocolos cirúrgicos — protocolos conservadores
  // (ex.: Capsulite adesiva) não têm âncora pós-operatória.
  const protocolo = _patologia.protocolos.find(p => p.id === _patologia.protocoloId);
  const ehCirurgico = protocolo?.kind === 'cirurgico';
  const semanasPos = ehCirurgico ? semanasPosCirurgiaPatologia() : null;
  return `
    ${ehCirurgico ? `<div class="gcwo-field gcwo-pat-cirurgia-field">
      <span class="gcwo-field-label">Data da cirurgia <small>(opcional)</small></span>
      <input type="date" id="gcwoPatDataCirurgia" value="${escAttr(_patologia.dataCirurgia || '')}" max="${escAttr(isoHoje())}">
      ${semanasPos != null ? `<div class="gcwo-pat-hint">${semanasPos} semana${semanasPos === 1 ? '' : 's'} pós-operatório.</div>` : ''}
    </div>` : ''}
    <div class="gcwo-field">
      <span class="gcwo-field-label">Fase</span>
      <div class="gcwo-pat-fase-grid">${_patologia.fases.map(f => renderFaseCardPatologia(f, semanasPos)).join('')}</div>
    </div>`;
}

function renderFaseCardPatologia(f, semanasPos) {
  const seleccionada = _patologia.faseId === f.id;
  const compativel = f.anchor_kind === 'semana_pos_cirurgia' && semanasPos != null
    && semanasPos >= (f.anchor_from ?? 0) && (f.anchor_to == null || semanasPos < f.anchor_to);
  const anchorTxt = f.anchor_kind === 'semana_pos_cirurgia'
    ? (f.anchor_to != null ? `Semanas ${f.anchor_from ?? 0}–${f.anchor_to}` : `A partir da semana ${f.anchor_from ?? 0}`)
    : 'Por evolução clínica';
  const nObjetivos = (f.data?.objetivos?.length || 0) + (f.data?.objetivos_serie?.length || 0);
  const nExercicios = _patologia.faseExerciciosCount[f.id];
  return `
    <button type="button" class="gcwo-pat-fase-card${seleccionada ? ' on' : ''}" data-pat-fase="${escAttr(f.id)}">
      <div class="gcwo-pat-fase-nome">${escHtml(f.phase_order)}. ${escHtml(f.name)}</div>
      ${compativel ? `<div class="gcwo-pat-fase-badge">Pelo tempo pós-operatório, esta é a fase compatível</div>` : ''}
      <div class="gcwo-pat-fase-meta">${escHtml(anchorTxt)}</div>
      <div class="gcwo-pat-fase-stats">
        <span>${nObjetivos} objetivo${nObjetivos === 1 ? '' : 's'}/critério${nObjetivos === 1 ? '' : 's'}</span>
        <span>${nExercicios == null ? '…' : nExercicios} exercício${nExercicios === 1 ? '' : 's'}</span>
      </div>
    </button>`;
}

function renderFaseDetalheEExerciciosPatologia() {
  const fase = _patologia.fases.find(f => f.id === _patologia.faseId);
  if (!fase) return '';
  const d = fase.data || {};
  const temCriteriosDetalhados = Array.isArray(d.objetivos_serie) && d.objetivos_serie.length;
  const temObjetivos = Array.isArray(d.objetivos) && d.objetivos.length;
  const temHep = Array.isArray(d.hep) && d.hep.length;
  const temPermitido = Array.isArray(d.permitido) && d.permitido.length;
  const temContra = Array.isArray(d.contraindicacoes) && d.contraindicacoes.length;
  const temCriteriosProgressao = Array.isArray(d.criterios_progressao) && d.criterios_progressao.length;
  const temPrincipioClinico = !!d.principio_clinico;
  const temCuidadosBase = temPermitido || temContra;
  const semConteudoClinico = !temCriteriosDetalhados && !temObjetivos && !temHep && !temCuidadosBase && !temCriteriosProgressao && !temPrincipioClinico && !d.nota_ancora;

  return `
    <div class="gcwo-pat-fase-detalhe">
      <h3 class="gcwo-pat-fase-titulo">${escHtml(fase.phase_order)}. ${escHtml(fase.name)}</h3>
      <div id="gcwoPatCuidadosWrap">${renderCuidadosEspecificosPatologia()}</div>
      ${d.nota_ancora ? `<p class="gcwo-pat-nota">${escHtml(d.nota_ancora)}</p>` : ''}
      ${semConteudoClinico ? `<div class="gcwo-pat-vazio">Conteúdo clínico ainda não definido.</div>` : `
        ${temPrincipioClinico ? `<p class="gcwo-pat-principio">${escHtml(d.principio_clinico)}</p>` : ''}
        ${temObjetivos ? `<div class="gcwo-pat-objetivos"><span class="gcwo-field-label">Objetivos</span><ul>${d.objetivos.map(o => `<li>${escHtml(o.label || '')}</li>`).join('')}</ul></div>` : ''}
        ${temCuidadosBase ? `<div class="gcwo-pat-cuidados-base"><span class="gcwo-field-label">Cuidados / Restrições</span>
          ${temPermitido ? `<div class="gcwo-pat-permitido"><b>Permitido</b><ul>${d.permitido.map(p => `<li>${escHtml(p)}</li>`).join('')}</ul></div>` : ''}
          ${temContra ? `<div class="gcwo-pat-contra"><b>Evitar</b><ul>${d.contraindicacoes.map(c => `<li>${escHtml(c)}</li>`).join('')}</ul></div>` : ''}
        </div>` : ''}
        ${temHep ? `<div class="gcwo-pat-hep"><span class="gcwo-field-label">Programa domiciliário (HEP)</span><ul>${d.hep.map(h => `<li>${escHtml(h)}</li>`).join('')}</ul></div>` : ''}
        ${temCriteriosDetalhados ? `<details class="gcwo-pat-criterios-detalhe"><summary>Critérios detalhados (ROM / EVA)</summary><div class="gcwo-pat-criterios"><ul>${d.objetivos_serie.map(c => `<li>${escHtml(c.texto || '')}${(c.op && c.valor != null) ? ` ${escHtml(c.op)} ${escHtml(c.valor)}${escHtml(c.unidade || '')}` : ''}${c.nota ? ` <small>(${escHtml(c.nota)})</small>` : ''}</li>`).join('')}</ul></div></details>` : ''}
        ${temCriteriosProgressao ? `<div class="gcwo-pat-criterios-avancar"><span class="gcwo-field-label">Critérios para avançar</span><ul>${d.criterios_progressao.map(c => `<li>${escHtml(c.texto || '')}</li>`).join('')}</ul></div>` : ''}
      `}
    </div>
    <div class="gcwo-pat-exercicios">
      <div class="gcwo-workspace-title"><strong>Exercícios sugeridos</strong><span>${_patologia.selecionados.size} seleccionado${_patologia.selecionados.size === 1 ? '' : 's'}</span></div>
      ${renderListaExerciciosPatologia()}
      <button type="button" class="gcBtnGhost" id="gcwoPatAdicionarExercicio">+ Adicionar exercício</button>
    </div>
    ${renderRodapePatologia()}`;
}

function algumExercicioAdicionadoPatologia() {
  return _patologia.adicionadosCatalogo.length > 0;
}

// Agrupa por context (Casa/Clínica/Ginásio, mesma ordem do resto do EX-07; sem
// context/'indiferente' cai num grupo à parte) só para leitura — não altera a selecção
// nem o agrupamento em sessões, que continua a ser feito por agruparSelecaoPatologiaPorLocal().
const ORDEM_CONTEXTO_LISTA_PATOLOGIA = ['Casa', 'Clínica', 'Ginásio'];
function renderListaExerciciosPatologia() {
  if (_patologia.loading) return `<div class="gcwo-muted">A carregar exercícios…</div>`;
  if (!_patologia.exercicios.length && !algumExercicioAdicionadoPatologia()) {
    return `<div class="gcwo-pat-vazio">0 exercícios associados a esta fase.</div>`;
  }
  const entradas = [];
  _patologia.exercicios.forEach(row => {
    const ex = _state.exercisesCatalog.find(e => e.id === row.exercise_id);
    if (ex) entradas.push({ ex, meta: row, origemTag: 'protocolo', context: row.context });
  });
  _patologia.adicionadosCatalogo.forEach(exId => {
    const ex = _state.exercisesCatalog.find(e => e.id === exId);
    if (ex) entradas.push({ ex, meta: {}, origemTag: 'catalogo', context: null });
  });

  const grupos = new Map();
  entradas.forEach(entrada => {
    const chave = (entrada.context && entrada.context !== 'indiferente') ? entrada.context : null;
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(entrada);
  });
  const chavesOrdenadas = [...grupos.keys()].sort((a, b) => {
    const ia = a ? ORDEM_CONTEXTO_LISTA_PATOLOGIA.indexOf(a) : -1;
    const ib = b ? ORDEM_CONTEXTO_LISTA_PATOLOGIA.indexOf(b) : -1;
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  const blocos = chavesOrdenadas.map(chave => {
    const linhas = grupos.get(chave).map(({ ex, meta, origemTag }) => renderLinhaExercicioPatologia(ex, meta, origemTag)).join('');
    return `<div class="gcwo-pat-exercicio-grupo"><div class="gcwo-pat-exercicio-grupo-titulo">${escHtml(chave || 'Sem contexto definido')}</div>${linhas}</div>`;
  });
  return `<div class="gcwo-pat-exercicio-lista">${blocos.join('')}</div>`;
}

function renderLinhaExercicioPatologia(ex, meta, origemTag) {
  const marcado = _patologia.selecionados.has(ex.id);
  const origemLabel = origemTag === 'protocolo' ? 'Protocolo' : 'Adicionado';
  const temDefaults = meta.prescription_defaults && Object.keys(meta.prescription_defaults).length > 0;
  return `
    <div class="gcwo-pat-exercicio-row${marcado ? ' on' : ''}">
      ${origemTag === 'protocolo'
        ? `<label class="gcwo-pat-exercicio-check-wrap"><input type="checkbox" class="gcwo-pat-exercicio-check" data-pat-exid="${escAttr(ex.id)}" ${marcado ? 'checked' : ''}></label>`
        : `<button type="button" class="gcwo-pat-remove-btn" data-pat-remover="${escAttr(ex.id)}" title="Remover">${ICON_CLOSE}</button>`}
      ${ex.photo_url ? `<img class="gcwo-pat-exercicio-foto" src="${escAttr(ex.photo_url)}" alt="">` : `<span class="gcwo-pat-exercicio-foto empty"></span>`}
      <span class="gcwo-pat-exercicio-info">
        <span class="gcwo-pat-exercicio-nome">${escHtml(ex.name)}</span>
        <span class="gcwo-pat-exercicio-meta">
          <span class="gcwo-pat-origem-tag ${origemTag}">${escHtml(origemLabel)}</span>
          ${meta.context ? `<span class="gcwo-pat-context-tag">${escHtml(meta.context)}</span>` : ''}
          ${meta.is_optional ? `<span class="gcwo-pat-optional-tag">Opcional</span>` : ''}
          ${temDefaults ? `<span class="gcwo-pat-defaults-tag">Dose sugerida</span>` : ''}
        </span>
        ${meta.clinical_note ? `<span class="gcwo-pat-clinical-note">${escHtml(meta.clinical_note)}</span>` : ''}
      </span>
    </div>`;
}

function renderRodapePatologia() {
  const grupos = agruparSelecaoPatologiaPorLocal();
  const total = _patologia.selecionados.size;
  const resumoLocais = [...grupos.entries()].map(([local, entradas]) => `${local || 'Sem local'} (${entradas.length})`).join(' · ');
  return `
    <div class="gcwo-pat-footer">
      <div class="gcwo-pat-footer-resumo">${total} exercício${total === 1 ? '' : 's'} seleccionado${total === 1 ? '' : 's'}${total ? ` — ${escHtml(resumoLocais)}` : ''}</div>
      <button type="button" class="gcBtnSuccess gcBtnLg" id="gcwoPatAvancar" ${total ? '' : 'disabled'}>Avançar para prescrição</button>
    </div>`;
}

/* ── "+ Adicionar exercício" — reaproveita filtros/pesquisa do catálogo (secção 1), com
   destino diferente (a selecção da patologia em vez de s.items) ── */
function filteredCatalogoPatologia() {
  const busca = (_patologia.catalogBusca || '').trim().toLowerCase();
  let list = _state.exercisesCatalog;
  if (_patologia.catalogFiltro === 'favoritos') list = list.filter(e => e.is_favorite);
  else if (_patologia.catalogFiltro !== 'todos') list = list.filter(e => Array.isArray(e.categoria) && e.categoria.includes(_patologia.catalogFiltro));
  list = list.filter(e => exercicioBateFiltroEquipamento(e, _patologia.catalogEquip));
  if (busca) list = list.filter(e => (e.name || '').toLowerCase().includes(busca));
  return list;
}
function renderCatalogoPatologiaOverlay() {
  if (!_patologia.catalogAberto) return '';
  const list = filteredCatalogoPatologia();
  return `
    <div class="gcwo-modal-overlay" id="gcwoPatCatalogOverlay">
      <div class="gcwo-modal gcwo-pat-catalog-modal">
        <div class="gcwo-modal-head"><h3>Adicionar exercício do catálogo</h3><button type="button" id="gcwoPatCatalogFechar" title="Fechar">${ICON_CLOSE}</button></div>
        <div class="gcwo-modal-body">
          <div class="gcwo-filter-line"><span class="gcwo-filter-label">Mostrar</span><div class="gcwo-chips">
            ${CATALOG_FILTROS.map(f => `<button type="button" class="gcwo-chip${_patologia.catalogFiltro === f.value ? ' on' : ''}" data-pat-cat-filtro="${escAttr(f.value)}">${escHtml(f.label)}</button>`).join('')}
          </div></div>
          <div class="gcwo-filter-line"><span class="gcwo-filter-label">Material</span><div class="gcwo-chips gcwo-equip-chips">
            ${EQUIPAMENTO_FILTROS.map(eq => `<button type="button" class="gcwo-chip${_patologia.catalogEquip.has(eq) ? ' on' : ''}" data-pat-cat-equip="${escAttr(eq)}">${escHtml(eq)}</button>`).join('')}
          </div></div>
          <div class="gc-search-bar">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5.5" stroke="#94a3b8" stroke-width="1.4"/><path d="M11 11l3 3" stroke="#94a3b8" stroke-width="1.4" stroke-linecap="round"/></svg>
            <input id="gcwoPatCatalogBusca" type="search" class="gc-search-input" placeholder="Pesquisar exercício…" autocomplete="off" spellcheck="false" value="${escAttr(_patologia.catalogBusca)}">
          </div>
          <div class="gcwo-catpick-grid">
            ${_state.catalogLoaded ? (list.length ? list.map(ex => `
              <div class="gcwo-catpick-card${_patologia.selecionados.has(ex.id) ? ' added' : ''}" data-pat-cat-exid="${escAttr(ex.id)}" role="button" tabindex="0">
                ${ex.photo_url ? `<span class="gcwo-catpick-photo"><img src="${escAttr(ex.photo_url)}" alt=""></span>` : `<span class="gcwo-catpick-photo empty"></span>`}
                <span class="gcwo-catpick-name">${escHtml(ex.name)}</span>
                ${_patologia.selecionados.has(ex.id) ? `<span class="gcwo-catpick-check">✓</span>` : ''}
              </div>`).join('') : `<div class="gcwo-muted">Nenhum exercício encontrado.</div>`) : `<div class="gcwo-muted">A carregar catálogo…</div>`}
          </div>
        </div>
      </div>
    </div>`;
}

function wirePatologiaBody() {
  const host = document.getElementById('gcwoPatologiaBody');
  if (!host) return;

  host.querySelectorAll('[data-pat-regiao]').forEach(btn => btn.addEventListener('click', () => {
    const r = btn.getAttribute('data-pat-regiao');
    if (_patologia.regiao === r) return;
    _patologia.regiao = r; _patologia.tipo = null; _patologia.protocoloId = null; _patologia.faseId = null;
    _patologia.fases = []; _patologia.exercicios = []; _patologia.selecionados = new Map(); _patologia.adicionadosCatalogo = [];
    _patologia.surgicalModifiers = {}; _patologia.surgicalModifiersText = {};
    renderPatologiaBody();
  }));
  host.querySelectorAll('[data-pat-tipo]').forEach(btn => btn.addEventListener('click', () => {
    const t = btn.getAttribute('data-pat-tipo');
    if (_patologia.tipo === t) return;
    _patologia.tipo = t; _patologia.protocoloId = null; _patologia.faseId = null;
    _patologia.fases = []; _patologia.exercicios = []; _patologia.selecionados = new Map(); _patologia.adicionadosCatalogo = [];
    _patologia.surgicalModifiers = {}; _patologia.surgicalModifiersText = {};
    renderPatologiaBody();
  }));
  host.querySelectorAll('[data-pat-protocolo]').forEach(btn => btn.addEventListener('click', () => {
    const id = btn.getAttribute('data-pat-protocolo');
    if (_patologia.protocoloId === id) return;
    carregarFasesPatologia(id);
  }));
  host.querySelectorAll('[data-pat-fase]').forEach(btn => btn.addEventListener('click', () => {
    const id = btn.getAttribute('data-pat-fase');
    if (_patologia.faseId === id) return;
    carregarExerciciosFasePatologia(id);
  }));
  host.querySelectorAll('[data-pat-modificador]').forEach(chk => chk.addEventListener('change', () => {
    const key = chk.getAttribute('data-pat-modificador');
    _patologia.surgicalModifiers[key] = chk.checked;
    // Desmarcar um modificador de texto livre (ex.: "Restrição específica do cirurgião") limpa
    // o texto — não fica um cuidado "fantasma" sem checkbox nenhuma a explicá-lo.
    if (!chk.checked) _patologia.surgicalModifiersText[key] = '';
    renderPatologiaBody();
  }));
  host.querySelectorAll('[data-pat-modificador-texto]').forEach(inp => inp.addEventListener('input', (e) => {
    const key = inp.getAttribute('data-pat-modificador-texto');
    _patologia.surgicalModifiersText[key] = e.target.value;
    // O bloco "Cuidados específicos" só depende da fase seleccionada, que não se altera aqui —
    // actualiza-se só o texto no estado; refreshCuidadosEspecificosPatologia evita perder o foco do campo.
    refreshCuidadosEspecificosPatologia();
  }));
  document.getElementById('gcwoPatDataCirurgia')?.addEventListener('change', (e) => {
    _patologia.dataCirurgia = e.target.value || '';
    renderPatologiaBody();
  });
  host.querySelectorAll('[data-pat-exid]').forEach(chk => chk.addEventListener('change', () => {
    alternarSelecaoExercicioPatologia(chk.getAttribute('data-pat-exid'));
  }));
  host.querySelectorAll('[data-pat-remover]').forEach(btn => btn.addEventListener('click', () => {
    removerAdicionadoPatologia(btn.getAttribute('data-pat-remover'));
  }));
  document.getElementById('gcwoPatAdicionarExercicio')?.addEventListener('click', () => {
    _patologia.catalogAberto = true;
    renderPatologiaBody();
  });
  document.getElementById('gcwoPatAvancar')?.addEventListener('click', avancarParaPrescricaoPatologia);

  document.getElementById('gcwoPatCatalogFechar')?.addEventListener('click', () => {
    _patologia.catalogAberto = false; _patologia.catalogBusca = ''; _patologia.catalogFiltro = 'todos'; _patologia.catalogEquip = new Set();
    renderPatologiaBody();
  });
  document.getElementById('gcwoPatCatalogOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'gcwoPatCatalogOverlay') document.getElementById('gcwoPatCatalogFechar')?.click();
  });
  host.querySelectorAll('[data-pat-cat-filtro]').forEach(btn => btn.addEventListener('click', () => {
    _patologia.catalogFiltro = btn.getAttribute('data-pat-cat-filtro');
    renderPatologiaBody();
  }));
  host.querySelectorAll('[data-pat-cat-equip]').forEach(btn => btn.addEventListener('click', () => {
    const eq = btn.getAttribute('data-pat-cat-equip');
    if (_patologia.catalogEquip.has(eq)) _patologia.catalogEquip.delete(eq); else _patologia.catalogEquip.add(eq);
    renderPatologiaBody();
  }));
  let patBuscaTimer = null;
  document.getElementById('gcwoPatCatalogBusca')?.addEventListener('input', (e) => {
    _patologia.catalogBusca = e.target.value;
    if (patBuscaTimer) clearTimeout(patBuscaTimer);
    patBuscaTimer = setTimeout(renderPatologiaBody, 150);
  });
  host.querySelectorAll('[data-pat-cat-exid]').forEach(card => card.addEventListener('click', () => {
    adicionarExercicioCatalogoPatologia(card.getAttribute('data-pat-cat-exid'));
  }));
}
