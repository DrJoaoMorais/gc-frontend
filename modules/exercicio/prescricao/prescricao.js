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

const TIPO_META = {
  ginasio:  { label: 'Ginásio',    icon: ICON_GINASIO,  fg: '#7c3aed', bg: '#f3e8ff' },
  corrida:  { label: 'Corrida',    icon: ICON_CORRIDA,  fg: '#c2410c', bg: '#ffedd5' },
  natacao:  { label: 'Natação',    icon: ICON_NATACAO,  fg: '#1a56db', bg: '#eaf0fd' },
  ciclismo: { label: 'Ciclismo',   icon: ICON_CICLISMO, fg: '#0f8a74', bg: '#e3f6f2' },
  remo:     { label: 'Remo',       icon: ICON_REMO,     fg: '#be185d', bg: '#fce7f3' },
  outro:    { label: 'Modalidade', icon: ICON_OUTRO,    fg: '#475569', bg: '#eef2f6' },
};
function tipoKey(s) {
  if (s.tipo === 'ginasio') return 'ginasio';
  const m = (s.modalidade?.modalidade || '').toLowerCase();
  if (m === 'corrida') return 'corrida';
  if (m === 'natação' || m === 'natacao') return 'natacao';
  if (m === 'ciclismo') return 'ciclismo';
  if (m === 'remo') return 'remo';
  return 'outro';
}

function uuid() { return crypto.randomUUID(); }

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
    selectedDay: 'seg',
    progressao: '',
    restricoesPredefinidas: [],
    restricoesTexto: '',
    savedLink: null,
  };
}
let _state = freshState();
let _expandedCardIds = new Set();       // sessões expandidas na lista principal (leitura)
let _panelExpandedTarefaId = null;      // dentro do painel, tarefa expandida (só uma)
let _panelDraft = null;                 // clone de trabalho da sessão em edição — null = painel fechado
let _panelIsNovo = false;

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
  return {
    ...s,
    ginasio: {
      exercicios: (s.ginasio?.exercicios || []).map(ex => ({
        ...ex,
        ajustes_maquina: ex.ajustes_maquina.map(a => ({ ...a })),
        series: ex.series.map(sr => ({ ...sr })),
      })),
    },
    modalidade: {
      ...(s.modalidade || novoModalidadeDefault()),
      tarefas: (s.modalidade?.tarefas || []).map(t => ({ ...t, intensidade: { ...t.intensidade } })),
    },
  };
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

  const clinicas = G.clinics || [];
  if (clinicas.length === 1) _state.clinicId = clinicas[0].id;

  loadExercisesCatalog(); // não bloqueia o primeiro render

  renderStep1();
}

/* ── Catálogo de exercícios (wo_exercises, global ao sistema) ── */
async function loadExercisesCatalog() {
  const { data, error } = await window.sb
    .from('wo_exercises')
    .select('id,name,categoria,photo_url,tempo_concentrico_s,tempo_excentrico_s,ajustes_maquina')
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

/* ================================================================
   PASSO 1 — clínica + pesquisa/seleção de doente
   ================================================================ */
function renderStep1() {
  const root = document.getElementById('gcwoPrescricaoRoot');
  if (!root) return;

  const clinicas = G.clinics || [];
  const clinicOpts = clinicas.map(c =>
    `<option value="${escAttr(c.id)}" ${c.id === _state.clinicId ? 'selected' : ''}>${escHtml(c.name || c.slug || c.id)}</option>`
  ).join('');

  root.innerHTML = `
    <div class="gc-page-header">
      <div><div class="gc-page-title">Prescrição de exercício</div><div class="gc-page-sub">Selecione a clínica e o doente</div></div>
      ${topActionsHtml()}
    </div>
    <div class="gcwo-step1">
      <select id="gcwoSelClinic" class="gc-select" style="min-width:220px;">
        <option value="">Escolha a clínica…</option>
        ${clinicOpts}
      </select>
      <div class="gc-search-bar" style="flex:1;min-width:220px;max-width:420px;">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5.5" stroke="#94a3b8" stroke-width="1.4"/><path d="M11 11l3 3" stroke="#94a3b8" stroke-width="1.4" stroke-linecap="round"/></svg>
        <input id="gcwoPatientQuery" type="search" class="gc-search-input" placeholder="Nome, SNS, NIF, Telefone…" autocomplete="off" spellcheck="false" ${_state.clinicId ? '' : 'disabled'}>
      </div>
    </div>
    <div id="gcwoPatientResults" class="gcwo-results" style="display:none;"></div>
  `;
  wireTopActions();

  const selClinic = document.getElementById('gcwoSelClinic');
  const input = document.getElementById('gcwoPatientQuery');
  const resHost = document.getElementById('gcwoPatientResults');

  selClinic.addEventListener('change', () => {
    _state.clinicId = selClinic.value || null;
    resHost.style.display = 'none';
    resHost.innerHTML = '';
    input.disabled = !_state.clinicId;
    input.value = '';
  });

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

/* ================================================================
   PASSO 2 — plano semanal
   ================================================================ */
function renderStep2() {
  const root = document.getElementById('gcwoPrescricaoRoot');
  if (!root) return;

  const p = _state.patient;
  root.innerHTML = `
    <div class="gc-page-header">
      <div><div class="gc-page-title">Prescrição de exercício</div><div class="gc-page-sub">${escHtml(p.full_name)}</div></div>
      ${topActionsHtml('<button type="button" class="gcBtnGhost" id="gcwoTrocarDoente">Trocar doente</button>')}
    </div>

    <div class="gcwo-plano-body">
      <main class="gcwo-plano-main">
        <section>
          <h2 class="gcwo-section-title">Plano semanal</h2>
          <div class="gcwo-daystrip" id="gcwoDaystrip"></div>
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

        <section class="gcwo-unassigned">
          <h3 id="gcwoUnassignedTitle"></h3>
          <div class="gcwo-sessions" id="gcwoUnassignedSessions"></div>
        </section>

        <div class="gcwo-card">
          <label class="gcwo-field">
            <span>Progressão</span>
            <textarea id="gcwoProgressao" rows="3" placeholder="Como evoluir ao longo do plano…">${escHtml(_state.progressao)}</textarea>
          </label>
        </div>

        <div class="gcwo-card">
          <span class="gcwo-field-label">Restrições</span>
          <div class="gcwo-chips" id="gcwoRestricoesChips">
            ${RESTRICOES_PREDEFINIDAS.map(r => `
              <button type="button" class="gcwo-chip${_state.restricoesPredefinidas.includes(r) ? ' on' : ''}" data-restr="${escAttr(r)}">${escHtml(r)}</button>
            `).join('')}
          </div>
          <textarea id="gcwoRestricoesTexto" rows="2" placeholder="Outras restrições, em texto livre…" style="margin-top:8px;">${escHtml(_state.restricoesTexto)}</textarea>
        </div>

        <div class="gcwo-generate">
          <button type="button" id="gcwoGerar" class="gcBtnSuccess gcBtnLg">Gerar prescrição e link</button>
          <span id="gcwoGerarErro" class="gcwo-erro"></span>
        </div>
      </main>

      <aside class="gcwo-panel empty" id="gcwoPanel">Seleciona o lápis numa sessão para editar, ou "+ Adicionar sessão".</aside>
    </div>
  `;

  wireTopActions();
  document.getElementById('gcwoTrocarDoente').addEventListener('click', () => {
    _state.patient = null;
    renderStep1();
  });

  renderTypegrid();
  document.getElementById('gcwoAddSessao').addEventListener('click', () => {
    const picker = document.getElementById('gcwoAddPicker');
    picker.hidden = !picker.hidden;
  });

  document.getElementById('gcwoProgressao').addEventListener('input', (e) => { _state.progressao = e.target.value; });
  document.getElementById('gcwoRestricoesTexto').addEventListener('input', (e) => { _state.restricoesTexto = e.target.value; });
  document.getElementById('gcwoRestricoesChips').querySelectorAll('[data-restr]').forEach(chip => {
    chip.addEventListener('click', () => {
      const r = chip.getAttribute('data-restr');
      const idx = _state.restricoesPredefinidas.indexOf(r);
      if (idx >= 0) _state.restricoesPredefinidas.splice(idx, 1);
      else _state.restricoesPredefinidas.push(r);
      chip.classList.toggle('on');
    });
  });
  document.getElementById('gcwoGerar').addEventListener('click', handleGerar);

  renderDaystrip();
  renderDayDetail();
  renderUnassigned();
  renderPanel();
}

/* ── Plano semanal — fila de dias ────────────────────────── */
function renderDaystrip() {
  const host = document.getElementById('gcwoDaystrip');
  if (!host) return;

  host.innerHTML = DIAS_SEMANA.map(d => {
    const sessions = _state.sessions.filter(s => s.dia_sugerido === d.value);
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
  }).join('') + `<button type="button" class="gcwo-daycard-add" disabled title="Em breve">${ICON_MAIS}<span>Dia</span></button>`;

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

/* ── Dia selecionado ─────────────────────────────────────── */
function renderDayDetail() {
  const dia = DIAS_SEMANA.find(d => d.value === _state.selectedDay) || DIAS_SEMANA[0];
  const titleEl = document.getElementById('gcwoDayTitle');
  if (titleEl) titleEl.textContent = dia.full;

  const sessions = _state.sessions.filter(s => s.dia_sugerido === dia.value);
  const host = document.getElementById('gcwoDaySessions');
  if (!host) return;
  host.innerHTML = sessions.length
    ? sessions.map(renderSessaoCardHtml).join('')
    : `<div class="gcwo-muted">Sem sessões atribuídas a ${dia.full.toLowerCase()}.</div>`;
  wireSessaoCards(host);
}

/* ── Sem dia atribuído — sempre visível ──────────────────── */
function renderUnassigned() {
  const sessions = _state.sessions.filter(s => !s.dia_sugerido);
  const titleEl = document.getElementById('gcwoUnassignedTitle');
  if (titleEl) titleEl.innerHTML = `${ICON_FLAG} Sessões sem dia atribuído <span class="count">— ${sessions.length}</span>`;
  const host = document.getElementById('gcwoUnassignedSessions');
  if (!host) return;
  host.innerHTML = sessions.length
    ? sessions.map(renderSessaoCardHtml).join('')
    : `<div class="gcwo-muted">Todas as sessões têm dia atribuído.</div>`;
  wireSessaoCards(host);
}

/* ── Cartão de sessão — leitura, colapsável ──────────────── */
function renderSessaoCardHtml(s) {
  const meta = TIPO_META[tipoKey(s)];
  const expanded = _expandedCardIds.has(s.id);
  const resumo = sessionResumoTexto(s);
  const tipoLabel = s.tipo === 'ginasio' ? 'Ginásio' : meta.label;

  let bodyHtml = '';
  if (expanded) {
    if (s.tipo === 'ginasio') {
      bodyHtml = `
        <div class="gcwo-plano-session-body"><div class="gcwo-tablewrap"><table class="gcwo-readtable">
          <thead><tr><th>Exercício</th><th>Séries</th><th>Descanso</th><th>Nota</th></tr></thead>
          <tbody>
            ${s.ginasio.exercicios.map(ex => `
              <tr>
                <td>${escHtml(ex.nome)}</td>
                <td class="num">${ex.series.map(sr => sr.peso_kg != null ? `${sr.reps}×${sr.peso_kg}kg` : `${sr.reps}×`).join(', ')}</td>
                <td class="muted num">${ex.descanso_s ? ex.descanso_s + 's' : '—'}</td>
                <td class="muted">${escHtml(ex.nota) || '—'}</td>
              </tr>`).join('')}
          </tbody>
        </table></div></div>`;
    } else {
      const { totalDistM, hasDist, totalTempoS, hasTempo } = calcTotaisModalidade(s.modalidade);
      bodyHtml = `
        <div class="gcwo-plano-session-body"><div class="gcwo-tablewrap"><table class="gcwo-readtable">
          <thead><tr><th>#</th><th>Tarefa</th><th>Distância</th><th>Zona</th><th>Ritmo</th><th>Nota</th><th>Descanso</th></tr></thead>
          <tbody>
            ${s.modalidade.tarefas.map((t, i) => `
              <tr>
                <td class="muted num">${i + 1}</td>
                <td><strong>${tarefaVolumeLabelReadonly(t)}</strong></td>
                <td class="num">${t.medida === 'distancia' && t.distancia_m != null ? fmtDistanciaTotal((t.series || 1) * t.distancia_m) : '—'}</td>
                <td>${t.zona ? `<span class="gcwo-zonapill">${escHtml(t.zona)}</span>` : '<span class="muted">—</span>'}</td>
                <td class="muted">${escHtml(t.intensidade?.ritmo) || '—'}</td>
                <td class="muted">${escHtml(t.nota) || '—'}</td>
                <td class="muted">${escHtml(t.descanso) || '—'}</td>
              </tr>`).join('')}
            <tr class="total">
              <td colspan="2">TOTAL</td>
              <td class="num">${hasDist ? fmtDistanciaTotal(totalDistM) : ''}</td>
              <td colspan="4" class="muted">${hasTempo ? '≈ ' + fmtDuracaoTotal(totalTempoS) : ''}</td>
            </tr>
          </tbody>
        </table></div></div>`;
    }
  }

  return `
    <div class="gcwo-plano-session" data-id="${s.id}">
      <div class="gcwo-plano-session-bar">
        <div class="accent" style="background:${meta.fg}"></div>
        <div class="main">
          <button type="button" class="gcwo-plano-session-head" data-toggle="${s.id}">
            <span class="icon" style="background:${meta.bg};color:${meta.fg}">${meta.icon}</span>
            <span class="titles"><span class="nome">${escHtml(s.nome || '(sem nome)')}</span><span class="resumo">${escHtml(resumo)}</span></span>
            <span class="tag" style="background:${meta.bg};color:${meta.fg}">${tipoLabel}</span>
            <span class="chevron">${expanded ? '▾' : '▸'}</span>
          </button>
          ${bodyHtml}
        </div>
        <button type="button" class="gcwo-plano-session-edit" data-edit="${s.id}" title="Editar sessão">${ICON_PENCIL}</button>
      </div>
    </div>`;
}

function wireSessaoCards(container) {
  container.querySelectorAll('[data-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-toggle');
      if (_expandedCardIds.has(id)) _expandedCardIds.delete(id); else _expandedCardIds.add(id);
      renderDayDetail();
      renderUnassigned();
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

  const tipos = [
    { key: 'ginasio',  tipo: 'ginasio',    modalidade: null },
    { key: 'corrida',  tipo: 'modalidade', modalidade: 'Corrida' },
    { key: 'natacao',  tipo: 'modalidade', modalidade: 'Natação' },
    { key: 'ciclismo', tipo: 'modalidade', modalidade: 'Ciclismo' },
    { key: 'remo',     tipo: 'modalidade', modalidade: 'Remo' },
  ];
  host.innerHTML = tipos.map(t => {
    const meta = TIPO_META[t.key];
    return `
      <button type="button" class="gcwo-typecard" data-tipo="${t.tipo}" data-modalidade="${t.modalidade || ''}">
        <span class="ticon" style="background:${meta.bg};color:${meta.fg}">${meta.icon}</span>
        <span class="tname">${meta.label}</span>
      </button>`;
  }).join('') + `
    <button type="button" class="gcwo-typecard" data-tipo="modalidade" data-modalidade="">
      <span class="ticon" style="background:${TIPO_META.outro.bg};color:${TIPO_META.outro.fg}">${ICON_MAIS}</span>
      <span class="tname">Mais</span>
    </button>`;

  host.querySelectorAll('[data-tipo]').forEach(btn => {
    btn.addEventListener('click', () => {
      openPanelNovo(btn.getAttribute('data-tipo'), btn.getAttribute('data-modalidade') || null);
    });
  });
}

/* ================================================================
   Painel lateral — criar/editar sessão
   ================================================================ */
function openPanelNovo(tipo, modalidadePreset) {
  const s = novaSessao(tipo);
  s.dia_sugerido = _state.selectedDay;
  if (tipo === 'modalidade' && modalidadePreset) {
    s.modalidade.modalidade = modalidadePreset;
    s.nome = modalidadePreset;
  }
  _panelDraft = s;
  _panelIsNovo = true;
  _panelExpandedTarefaId = null;
  const picker = document.getElementById('gcwoAddPicker');
  if (picker) picker.hidden = true;
  renderPanel();
}
function openPanelEditar(sessaoId) {
  const s = _state.sessions.find(x => x.id === sessaoId);
  if (!s) return;
  _panelDraft = cloneSession(s);
  _panelIsNovo = false;
  _panelExpandedTarefaId = null;
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
  const diaOpts = DIAS_SEMANA.map(d => `<option value="${d.value}" ${d.value === s.dia_sugerido ? 'selected' : ''}>${d.full}</option>`).join('');

  panel.innerHTML = `
    <div class="gcwo-panel-head">
      <span class="gcwo-panel-icon" style="background:${meta.bg};color:${meta.fg}">${meta.icon}</span>
      <span class="gcwo-panel-titles"><h3>${_panelIsNovo ? 'Nova sessão' : 'Editar sessão'}</h3><span class="sub">${meta.label}</span></span>
      ${!_panelIsNovo ? `<button type="button" class="gcwo-panel-headbtn" id="gcwoPanelApagar" title="Apagar sessão">${ICON_TRASH}</button>` : ''}
      <button type="button" class="gcwo-panel-headbtn close" id="gcwoPanelFechar" title="Fechar">${ICON_CLOSE}</button>
    </div>
    <div class="gcwo-panel-body">
      <label class="gcwo-field"><span>Nome da sessão</span><input type="text" id="gcwoPNome" value="${escAttr(s.nome)}" placeholder="Ex: Ginásio A"></label>

      <div class="gcwo-row2">
        <label class="gcwo-field"><span>Frequência semanal</span><input type="number" min="0" max="14" id="gcwoPFreq" value="${s.frequencia_semanal ?? ''}"></label>
        <label class="gcwo-field"><span>Dia sugerido</span><select id="gcwoPDia"><option value="">—</option>${diaOpts}</select></label>
      </div>

      ${s.tipo === 'ginasio' ? renderPanelGinasio(s) : renderPanelModalidade(s)}

      <label class="gcwo-field"><span>Notas gerais</span><textarea id="gcwoPNotaGeral" rows="3" placeholder="Instruções ou observações para esta sessão…">${escHtml(s.nota_geral || '')}</textarea></label>

      <div>
        <span class="gcwo-field-label">Resumo da sessão</span>
        <div class="gcwo-resumo" id="gcwoPResumo">${renderResumoSessao(s)}</div>
      </div>

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
    _state.sessions = _state.sessions.filter(x => x.id !== s.id);
    fecharPanel();
    renderDaystrip();
    renderDayDetail();
    renderUnassigned();
  });
  document.getElementById('gcwoPGuardar').addEventListener('click', handleGuardarSessao);

  document.getElementById('gcwoPNome').addEventListener('input', (e) => { s.nome = e.target.value; });
  document.getElementById('gcwoPFreq').addEventListener('input', (e) => { s.frequencia_semanal = e.target.value === '' ? null : Number(e.target.value); });
  document.getElementById('gcwoPDia').addEventListener('change', (e) => { s.dia_sugerido = e.target.value || null; });
  document.getElementById('gcwoPNotaGeral').addEventListener('input', (e) => { s.nota_geral = e.target.value; });

  if (s.tipo === 'ginasio') wirePanelGinasio(s);
  else wirePanelModalidade(s);
}

function showPanelErro(msg) {
  const el = document.getElementById('gcwoPErro');
  if (el) el.textContent = msg;
}

function handleGuardarSessao() {
  const s = _panelDraft;
  showPanelErro('');

  if (!s.nome || !s.nome.trim()) { showPanelErro('Falta o nome da sessão.'); return; }
  if (s.tipo === 'ginasio' && !s.ginasio.exercicios.length) { showPanelErro('Adiciona pelo menos um exercício.'); return; }
  if (s.tipo === 'modalidade' && !s.modalidade.tarefas.length) { showPanelErro('Adiciona pelo menos uma tarefa.'); return; }

  if (_panelIsNovo) {
    _state.sessions.push(s);
  } else {
    const idx = _state.sessions.findIndex(x => x.id === s.id);
    if (idx >= 0) _state.sessions[idx] = s;
  }

  fecharPanel();
  renderDaystrip();
  renderDayDetail();
  renderUnassigned();
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

/* ================================================================
   Gravação — monta o snapshot e grava em wo_prescriptions
   ================================================================ */
function buildFinalData() {
  const sessoes = _state.sessions.map(s => {
    const base = {
      id: s.id,
      nome: s.nome.trim(),
      tipo: s.tipo,
      frequencia_semanal: s.frequencia_semanal,
      dia_sugerido: s.dia_sugerido || null,
      nota_geral: (s.nota_geral || '').trim() || null,
    };
    if (s.tipo === 'ginasio') {
      base.ginasio = {
        exercicios: s.ginasio.exercicios.map(ex => ({
          id: ex.id,
          exercicio_id: ex.exercicio_id,
          nome: ex.nome,
          categoria: ex.categoria,
          foto_url: ex.foto_url,
          tempo_concentrico_s: ex.tempo_concentrico_s,
          tempo_excentrico_s: ex.tempo_excentrico_s,
          ajustes_maquina: ex.ajustes_maquina,
          series: ex.series.map(sr => ({ serie: sr.serie, reps: sr.reps, peso_kg: sr.peso_kg })),
          descanso_s: ex.descanso_s,
          nota: ex.nota,
        })),
      };
    } else {
      const m = s.modalidade;
      base.modalidade = {
        modalidade: m.modalidade === 'Outro' ? (m.modalidadeOutro.trim() || 'Outro') : m.modalidade,
        tarefas: m.tarefas.map(t => ({
          id: t.id,
          series: t.series || 1,
          medida: t.medida,
          distancia_m: t.medida === 'distancia' ? t.distancia_m : null,
          duracao_s: t.medida === 'tempo' && t.duracao_min != null ? Math.round(t.duracao_min * 60) : null,
          zona: t.zona && t.zona.trim() ? t.zona.trim() : null,
          intensidade: {
            ritmo: t.intensidade.ritmo && t.intensidade.ritmo.trim() ? t.intensidade.ritmo.trim() : null,
            fc_bpm: t.intensidade.fc_bpm,
            potencia_w: t.intensidade.potencia_w,
            cadencia_rpm: t.intensidade.cadencia_rpm,
            rpe: t.intensidade.rpe,
          },
          descanso: t.descanso && t.descanso.trim() ? t.descanso.trim() : null,
          nota: t.nota,
        })),
      };
    }
    return base;
  });

  return {
    versao: 1,
    sessoes,
    progressao: _state.progressao,
    restricoes: {
      predefinidas: _state.restricoesPredefinidas,
      texto: _state.restricoesTexto,
    },
  };
}

function validarPrescricao() {
  if (!_state.clinicId) return 'Falta selecionar a clínica.';
  if (!_state.patient) return 'Falta selecionar o doente.';
  if (!_state.sessions.length) return 'Adiciona pelo menos uma sessão.';
  for (const s of _state.sessions) {
    if (!s.nome || !s.nome.trim()) return 'Todas as sessões precisam de nome.';
    if (s.tipo === 'ginasio' && !s.ginasio.exercicios.length) return `A sessão "${s.nome}" não tem exercícios.`;
    if (s.tipo === 'modalidade' && !s.modalidade.tarefas.length) return `A sessão "${s.nome}" não tem tarefas.`;
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

  try {
    const token = uuid();
    const data = buildFinalData();

    const { error } = await window.sb.from('wo_prescriptions').insert({
      token,
      patient_id: _state.patient.id,
      clinic_id: _state.clinicId,
      created_by: G.sessionUser.id,
      data,
    });
    if (error) throw new Error(`Falha ao gravar prescrição: ${error.message || error}`);

    _state.savedLink = TREINO_BASE_URL + token;
    renderStep3();
  } catch (err) {
    console.error('[prescricao] erro a gravar prescrição:', err);
    erroEl.textContent = 'Erro ao gravar: ' + (err?.message || err);
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

  root.innerHTML = `
    <div class="gc-page-header">
      <div><div class="gc-page-title">Prescrição de exercício</div><div class="gc-page-sub">${escHtml(_state.patient?.full_name || '')} — prescrição gravada</div></div>
      ${topActionsHtml()}
    </div>
    <div class="gcwo-card gcwo-success">
      <p>Link do doente (válido 15 dias):</p>
      <div class="gcwo-linkbox">
        <input type="text" id="gcwoLink" readonly value="${escAttr(_state.savedLink)}">
        <button type="button" id="gcwoCopiar" class="gcBtnPrimary">Copiar</button>
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
      console.error('[prescricao] falha a copiar link:', err);
      inp.select();
    }
  });

  document.getElementById('gcwoNova').addEventListener('click', () => {
    initPrescricao();
  });
}
