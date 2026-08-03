/* =================================================================
   PRESCRICAO.JS — Prescrição de exercício físico (Vertente 1)
   -----------------------------------------------------------------
   Pesquisa/seleciona doente, constrói sessões (ginásio ou
   modalidade — corrida, natação, etc., como sequência de tarefas),
   grava snapshot em wo_prescriptions.data, gera token e mostra o
   link de acesso do doente (treino.joaomorais.pt/t/{token}).
   ================================================================= */

import { G } from '../../state.js';

const escAttr = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));
const escHtml = escAttr;

const TREINO_BASE_URL = 'https://treino.joaomorais.pt/t/';

const MODALIDADES = ['Corrida', 'Ciclismo', 'Natação', 'Remo', 'Caminhada', 'Elíptica', 'Escadas', 'Trail', 'Ski', 'Outro'];

const DIAS_SEMANA = [
  { value: 'seg', label: 'Seg' },
  { value: 'ter', label: 'Ter' },
  { value: 'qua', label: 'Qua' },
  { value: 'qui', label: 'Qui' },
  { value: 'sex', label: 'Sex' },
  { value: 'sab', label: 'Sáb' },
  { value: 'dom', label: 'Dom' },
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

function uuid() { return crypto.randomUUID(); }

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
    progressao: '',
    restricoesPredefinidas: [],
    restricoesTexto: '',
    savedLink: null,
  };
}
let _state = freshState();
let _expandedTarefaId = null; // id da única tarefa expandida no momento (entre todas as sessões)

function fmtNum(n) {
  if (n == null) return '';
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
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

function renderTotaisHtml(m) {
  const { totalDistM, hasDist, totalTempoS, hasTempo } = calcTotaisModalidade(m);
  if (!hasDist && !hasTempo) return '';
  const parts = [];
  if (hasDist) {
    const km = totalDistM / 1000;
    const kmTxt = totalDistM >= 1000 ? ` (${km.toLocaleString('pt-PT', { maximumFractionDigits: 2 })} km)` : '';
    parts.push(`Distância total: ${Math.round(totalDistM).toLocaleString('pt-PT')} m${kmTxt}`);
  }
  if (hasTempo) {
    const totalMin = Math.round(totalTempoS / 60);
    const h = Math.floor(totalMin / 60), mm = totalMin % 60;
    parts.push(`Tempo total: ${h > 0 ? `${h}h${String(mm).padStart(2, '0')}` : `${totalMin} min`}`);
  }
  return `<div class="gcwo-totais">${parts.map(p => `<span>${escHtml(p)}</span>`).join('')}</div>`;
}

function updateTotaisDom(si) {
  const s = _state.sessions[si];
  if (!s || s.tipo !== 'modalidade') return;
  const host = document.querySelector(`.gcwo-session[data-si="${si}"] .gcwo-totais-host`);
  if (host) host.innerHTML = renderTotaisHtml(s.modalidade);
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

/* ── Entry point ─────────────────────────────────────────── */
export async function initPrescricao() {
  const root = document.getElementById('gcwoPrescricaoRoot');
  if (!root) return;

  ensurePrescricaoCss();
  _state = freshState();
  _expandedTarefaId = null;

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

  // Se o formulário de sessões já está visível, refresca para os selects ganharem opções
  if (_state.patient) renderSessions();
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
   PASSO 2 — construção das sessões
   ================================================================ */
function renderStep2() {
  const root = document.getElementById('gcwoPrescricaoRoot');
  if (!root) return;

  const p = _state.patient;
  root.innerHTML = `
    <div class="gc-page-header">
      <div><div class="gc-page-title">Prescrição de exercício</div><div class="gc-page-sub">${escHtml(p.full_name)}</div></div>
      <button type="button" id="gcwoTrocarDoente" class="gcBtnGhost">Trocar doente</button>
    </div>

    <div class="gcwo-sessions" id="gcwoSessions"></div>

    <div class="gcwo-addrow">
      <button type="button" id="gcwoAddGinasio" class="gcBtnOutline">+ Sessão de ginásio</button>
      <button type="button" id="gcwoAddModalidade" class="gcBtnOutline">+ Sessão de modalidade</button>
    </div>

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
  `;

  renderSessions();

  document.getElementById('gcwoTrocarDoente').addEventListener('click', () => {
    _state.patient = null;
    renderStep1();
  });

  document.getElementById('gcwoAddGinasio').addEventListener('click', () => {
    _state.sessions.push(novaSessao('ginasio'));
    renderSessions();
  });
  document.getElementById('gcwoAddModalidade').addEventListener('click', () => {
    _state.sessions.push(novaSessao('modalidade'));
    renderSessions();
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
}

/* ── Lista de sessões ────────────────────────────────────── */
function renderSessions() {
  const host = document.getElementById('gcwoSessions');
  if (!host) return;

  if (!_state.sessions.length) {
    host.innerHTML = `<div class="gcwo-muted">Ainda sem sessões — adiciona uma abaixo.</div>`;
    return;
  }

  host.innerHTML = _state.sessions.map((s, i) => renderSessionCard(s, i)).join('');
  _state.sessions.forEach((s, i) => wireSessionCard(s, i));
}

function renderSessionCard(s, i) {
  const diaOpts = DIAS_SEMANA.map(d =>
    `<option value="${d.value}" ${d.value === s.dia_sugerido ? 'selected' : ''}>${d.label}</option>`
  ).join('');

  return `
    <div class="gcwo-session" data-si="${i}">
      <div class="gcwo-session-head">
        <span class="gcwo-session-badge">${s.tipo === 'ginasio' ? 'Ginásio' : 'Modalidade'}</span>
        <input type="text" class="gcwo-session-nome" value="${escAttr(s.nome)}" placeholder="Nome da sessão — ex: Ginásio A">
        <label class="gcwo-freq">
          <span>×/semana</span>
          <input type="number" min="0" max="14" class="gcwo-session-freq" value="${s.frequencia_semanal ?? ''}">
        </label>
        <label class="gcwo-freq">
          <span>Dia sugerido</span>
          <select class="gcwo-session-dia">
            <option value="">—</option>
            ${diaOpts}
          </select>
        </label>
        <button type="button" class="gcwo-session-remove" title="Remover sessão">✕</button>
      </div>
      ${s.tipo === 'ginasio' ? renderGinasioBody(s, i) : renderModalidadeBody(s, i)}
    </div>
  `;
}

/* ── Corpo — Ginásio ─────────────────────────────────────── */
function renderGinasioBody(s, i) {
  const catalogOpts = _state.exercisesCatalog.map(ex =>
    `<option value="${escAttr(ex.id)}">${escHtml(ex.name)}${ex.categoria ? ' — ' + escHtml(ex.categoria) : ''}</option>`
  ).join('');

  const placeholderOpt = !_state.catalogLoaded
    ? 'A carregar catálogo…'
    : (_state.exercisesCatalog.length ? 'Escolher exercício do catálogo…' : 'Catálogo vazio — insira exercícios primeiro');

  return `
    <div class="gcwo-exercicios">
      ${s.ginasio.exercicios.map((ex, ei) => renderExercicioCard(ex, i, ei)).join('') || '<div class="gcwo-muted">Sem exercícios ainda.</div>'}
    </div>
    <div class="gcwo-exercicio-add">
      <select class="gcwo-catalog-select" ${_state.catalogLoaded && !_state.exercisesCatalog.length ? 'disabled' : ''}>
        <option value="">${placeholderOpt}</option>
        ${catalogOpts}
      </select>
      <button type="button" class="gcwo-add-exercicio gcBtnGhost">+ Exercício</button>
    </div>
  `;
}

function renderExercicioCard(ex, si, ei) {
  return `
    <div class="gcwo-exercicio" data-si="${si}" data-ei="${ei}">
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

/* ── Corpo — Modalidade (sequência de tarefas) ──────────────── */
function renderModalidadeBody(s, i) {
  const m = s.modalidade;
  const modOpts = MODALIDADES.map(md =>
    `<option value="${escAttr(md)}" ${md === m.modalidade ? 'selected' : ''}>${escHtml(md)}</option>`
  ).join('');

  return `
    <div class="gcwo-modalidade">
      <label class="gcwo-field">
        <span>Modalidade</span>
        <select class="gcwo-modalidade-select">${modOpts}</select>
      </label>
      ${m.modalidade === 'Outro' ? `
        <label class="gcwo-field">
          <span>Especificar</span>
          <input type="text" class="gcwo-modalidade-outro" value="${escAttr(m.modalidadeOutro)}">
        </label>
      ` : ''}
    </div>
    <div class="gcwo-tarefas">
      ${m.tarefas.map((t, ti) => renderTarefaCard(t, i, ti)).join('') || '<div class="gcwo-muted">Sem tarefas ainda.</div>'}
    </div>
    <button type="button" class="gcwo-add-tarefa gcBtnGhost">+ Tarefa</button>
    <div class="gcwo-totais-host">${renderTotaisHtml(m)}</div>
  `;
}

function renderTarefaCard(t, si, ti) {
  const expanded = t.id === _expandedTarefaId;
  const summary = tarefaSummaryText(t);
  return `
    <div class="gcwo-tarefa${expanded ? ' expanded' : ''}" data-si="${si}" data-ti="${ti}">
      <div class="gcwo-tarefa-header">
        <button type="button" class="gcwo-tarefa-toggle">
          <span class="gcwo-tarefa-chevron">${expanded ? '▾' : '▸'}</span>
          <span class="gcwo-tarefa-summary">${expanded ? 'A editar…' : (summary ? escHtml(summary) : '(tarefa vazia)')}</span>
        </button>
        <button type="button" class="gcwo-tarefa-remove" title="Remover tarefa">✕</button>
      </div>
      ${expanded ? renderTarefaFields(t, si, ti) : ''}
    </div>
  `;
}

function renderTarefaFields(t, si, ti) {
  const hasExtra = t.intensidade.potencia_w != null || t.intensidade.cadencia_rpm != null || t.intensidade.rpe != null;
  return `
    <div class="gcwo-tarefa-body">
      <div class="gcwo-tarefa-row">
        <label class="gcwo-field gcwo-field-sm"><span>Séries</span><input type="number" min="1" class="gcwo-t-series" value="${t.series ?? 1}"></label>
        <div class="gcwo-field gcwo-field-sm">
          <span>Medida</span>
          <div class="gcwo-modo">
            <label><input type="radio" name="gcwo-medida-${si}-${ti}" value="distancia" ${t.medida === 'distancia' ? 'checked' : ''}> Distância</label>
            <label><input type="radio" name="gcwo-medida-${si}-${ti}" value="tempo" ${t.medida === 'tempo' ? 'checked' : ''}> Tempo</label>
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

/* ── Wiring — sessão ─────────────────────────────────────── */
function wireSessionCard(s, i) {
  const card = document.querySelector(`.gcwo-session[data-si="${i}"]`);
  if (!card) return;

  card.querySelector('.gcwo-session-nome').addEventListener('input', (e) => { s.nome = e.target.value; });
  card.querySelector('.gcwo-session-freq').addEventListener('input', (e) => {
    s.frequencia_semanal = e.target.value === '' ? null : Number(e.target.value);
  });
  card.querySelector('.gcwo-session-dia').addEventListener('change', (e) => {
    s.dia_sugerido = e.target.value || null;
  });
  card.querySelector('.gcwo-session-remove').addEventListener('click', () => {
    _state.sessions.splice(i, 1);
    renderSessions();
  });

  if (s.tipo === 'ginasio') wireGinasioBody(card, s, i);
  else wireModalidadeBody(card, s, i);
}

function wireGinasioBody(card, s, i) {
  s.ginasio.exercicios.forEach((ex, ei) => wireExercicioCard(card, s, i, ex, ei));

  const select = card.querySelector('.gcwo-catalog-select');
  const addBtn = card.querySelector('.gcwo-add-exercicio');
  addBtn.addEventListener('click', () => {
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
    renderSessions();
  });
}

function wireExercicioCard(card, s, i, ex, ei) {
  const exCard = card.querySelector(`.gcwo-exercicio[data-si="${i}"][data-ei="${ei}"]`);
  if (!exCard) return;

  exCard.querySelector('.gcwo-exercicio-remove').addEventListener('click', () => {
    s.ginasio.exercicios.splice(ei, 1);
    renderSessions();
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
    });
    tr.querySelector('.gcwo-peso').addEventListener('input', (e) => {
      ex.series[sri].peso_kg = e.target.value === '' ? null : Number(e.target.value);
    });
    tr.querySelector('.gcwo-serie-remove').addEventListener('click', () => {
      ex.series.splice(sri, 1);
      ex.series.forEach((sr, idx) => { sr.serie = idx + 1; });
      renderSessions();
    });
  });

  exCard.querySelector('.gcwo-add-serie').addEventListener('click', () => {
    ex.series.push({ serie: ex.series.length + 1, reps: null, peso_kg: null });
    renderSessions();
  });

  exCard.querySelector('.gcwo-descanso').addEventListener('input', (e) => {
    ex.descanso_s = e.target.value === '' ? null : Number(e.target.value);
  });
  exCard.querySelector('.gcwo-exercicio-nota').addEventListener('input', (e) => { ex.nota = e.target.value; });
}

function wireModalidadeBody(card, s, i) {
  const m = s.modalidade;

  card.querySelector('.gcwo-modalidade-select').addEventListener('change', (e) => {
    m.modalidade = e.target.value;
    renderSessions();
  });
  const outroInp = card.querySelector('.gcwo-modalidade-outro');
  if (outroInp) outroInp.addEventListener('input', (e) => { m.modalidadeOutro = e.target.value; });

  m.tarefas.forEach((t, ti) => wireTarefaCard(card, s, i, t, ti));

  card.querySelector('.gcwo-add-tarefa').addEventListener('click', () => {
    m.tarefas.push(novaTarefa());
    renderSessions();
  });
}

function wireTarefaCard(card, s, i, t, ti) {
  const tCard = card.querySelector(`.gcwo-tarefa[data-si="${i}"][data-ti="${ti}"]`);
  if (!tCard) return;

  tCard.querySelector('.gcwo-tarefa-toggle').addEventListener('click', () => {
    _expandedTarefaId = (_expandedTarefaId === t.id) ? null : t.id;
    renderSessions();
  });

  tCard.querySelector('.gcwo-tarefa-remove').addEventListener('click', () => {
    if (_expandedTarefaId === t.id) _expandedTarefaId = null;
    s.modalidade.tarefas.splice(ti, 1);
    renderSessions();
  });

  if (t.id !== _expandedTarefaId) return; // campos só existem no DOM quando a tarefa está expandida

  tCard.querySelector('.gcwo-t-series').addEventListener('input', (e) => {
    t.series = e.target.value === '' ? 1 : Number(e.target.value);
    updateTotaisDom(i);
  });

  tCard.querySelectorAll(`input[name="gcwo-medida-${i}-${ti}"]`).forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) { t.medida = e.target.value; renderSessions(); }
    });
  });

  const distInp = tCard.querySelector('.gcwo-t-distancia');
  if (distInp) distInp.addEventListener('input', (e) => {
    t.distancia_m = e.target.value === '' ? null : Number(e.target.value);
    updateTotaisDom(i);
  });
  const durInp = tCard.querySelector('.gcwo-t-duracao');
  if (durInp) durInp.addEventListener('input', (e) => {
    t.duracao_min = e.target.value === '' ? null : Number(e.target.value);
    updateTotaisDom(i);
  });

  tCard.querySelector('.gcwo-t-zona').addEventListener('input', (e) => { t.zona = e.target.value; });

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
