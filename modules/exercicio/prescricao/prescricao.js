/* =================================================================
   PRESCRICAO.JS — Prescrição de exercício físico (Vertente 1)
   -----------------------------------------------------------------
   Pesquisa/seleciona doente, constrói sessões (cardio/ginásio),
   grava snapshot em wo_prescriptions.data, gera token e mostra o
   link de acesso do doente (treino.joaomorais.pt/t/{token}).
   ================================================================= */

import { G } from '../../state.js';

const escAttr = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));
const escHtml = escAttr;

const TREINO_BASE_URL = 'https://treino.joaomorais.pt/t/';

const CARDIO_ATIVIDADES = ['Corrida', 'Bicicleta', 'Elíptica', 'Remo', 'Nadar', 'Caminhada', 'Outro'];

const INTENSIDADE_TIPOS = [
  { value: 'fc',         label: 'FC alvo (bpm)' },
  { value: 'pace',       label: 'Pace (min/km)' },
  { value: 'potencia',   label: 'Potência (W)' },
  { value: 'tempo_100m', label: 'Tempo aos 100m (s)' },
  { value: 'zona',       label: 'Zona' },
];

const ZONAS = ['leve', 'moderada', 'vigorosa'];
const ZONA_LABELS = { leve: 'Leve', moderada: 'Moderada', vigorosa: 'Vigorosa' };

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

function novoCardioDefault() {
  return {
    atividade: 'Corrida',
    atividadeOutro: '',
    modo: 'duracao',
    distancia_km: null,
    duracao_min: 30,
    intensidade: { tipo: 'fc', fc_alvo_bpm: null, pace_min_km: null, potencia_w: null, tempo_100m_s: null, zona: null },
    nota: '',
  };
}
function novaSessao(tipo) {
  return {
    id: uuid(),
    nome: '',
    tipo,
    frequencia_semanal: tipo === 'ginasio' ? 2 : 3,
    ginasio: { exercicios: [] },
    cardio: novoCardioDefault(),
  };
}
function novoExercicioGinasio() {
  return {
    id: uuid(),
    exercicio_id: null,
    nome: '',
    categoria: '',
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

  const clinicas = G.clinics || [];
  if (clinicas.length === 1) _state.clinicId = clinicas[0].id;

  loadExercisesCatalog(); // não bloqueia o primeiro render

  renderStep1();
}

/* ── Catálogo de exercícios (wo_exercises, global ao sistema) ── */
async function loadExercisesCatalog() {
  const { data, error } = await window.sb
    .from('wo_exercises')
    .select('id,name,categoria,tempo_concentrico_s,tempo_excentrico_s,ajustes_maquina')
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
      <button type="button" id="gcwoAddCardio" class="gcBtnOutline">+ Sessão de cardio</button>
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
  document.getElementById('gcwoAddCardio').addEventListener('click', () => {
    _state.sessions.push(novaSessao('cardio'));
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
  return `
    <div class="gcwo-session" data-si="${i}">
      <div class="gcwo-session-head">
        <span class="gcwo-session-badge">${s.tipo === 'ginasio' ? 'Ginásio' : 'Cardio'}</span>
        <input type="text" class="gcwo-session-nome" value="${escAttr(s.nome)}" placeholder="Nome da sessão — ex: Ginásio A">
        <label class="gcwo-freq">
          <span>×/semana</span>
          <input type="number" min="0" max="14" class="gcwo-session-freq" value="${s.frequencia_semanal ?? ''}">
        </label>
        <button type="button" class="gcwo-session-remove" title="Remover sessão">✕</button>
      </div>
      ${s.tipo === 'ginasio' ? renderGinasioBody(s, i) : renderCardioBody(s, i)}
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

/* ── Corpo — Cardio ──────────────────────────────────────── */
function renderCardioBody(s, i) {
  const c = s.cardio;
  const atividadeOpts = CARDIO_ATIVIDADES.map(a =>
    `<option value="${escAttr(a)}" ${a === c.atividade ? 'selected' : ''}>${escHtml(a)}</option>`
  ).join('');

  return `
    <div class="gcwo-cardio">
      <label class="gcwo-field">
        <span>Atividade</span>
        <select class="gcwo-cardio-atividade">${atividadeOpts}</select>
      </label>
      ${c.atividade === 'Outro' ? `
        <label class="gcwo-field">
          <span>Especificar</span>
          <input type="text" class="gcwo-cardio-atividade-outro" value="${escAttr(c.atividadeOutro)}">
        </label>
      ` : ''}

      <div class="gcwo-field">
        <span>Meta</span>
        <div class="gcwo-modo">
          <label><input type="radio" name="gcwo-modo-${i}" value="duracao" ${c.modo === 'duracao' ? 'checked' : ''}> Duração</label>
          <label><input type="radio" name="gcwo-modo-${i}" value="distancia" ${c.modo === 'distancia' ? 'checked' : ''}> Distância</label>
        </div>
      </div>
      ${c.modo === 'duracao'
        ? `<label class="gcwo-field"><span>Duração (min)</span><input type="number" min="0" class="gcwo-cardio-duracao" value="${c.duracao_min ?? ''}"></label>`
        : `<label class="gcwo-field"><span>Distância (km)</span><input type="number" min="0" step="0.1" class="gcwo-cardio-distancia" value="${c.distancia_km ?? ''}"></label>`
      }

      <label class="gcwo-field">
        <span>Intensidade</span>
        <select class="gcwo-cardio-intens-tipo">
          ${INTENSIDADE_TIPOS.map(t => `<option value="${t.value}" ${t.value === c.intensidade.tipo ? 'selected' : ''}>${t.label}</option>`).join('')}
        </select>
      </label>
      ${renderIntensidadeCampo(c.intensidade)}

      <label class="gcwo-field">
        <span>Nota</span>
        <input type="text" class="gcwo-cardio-nota" value="${escAttr(c.nota)}">
      </label>
    </div>
  `;
}

function renderIntensidadeCampo(intensidade) {
  switch (intensidade.tipo) {
    case 'fc':
      return `<label class="gcwo-field"><span>FC alvo (bpm)</span><input type="number" min="0" class="gcwo-intens-valor" value="${intensidade.fc_alvo_bpm ?? ''}"></label>`;
    case 'pace':
      return `<label class="gcwo-field"><span>Pace (min/km)</span><input type="number" min="0" step="0.1" class="gcwo-intens-valor" value="${intensidade.pace_min_km ?? ''}"></label>`;
    case 'potencia':
      return `<label class="gcwo-field"><span>Potência (W)</span><input type="number" min="0" class="gcwo-intens-valor" value="${intensidade.potencia_w ?? ''}"></label>`;
    case 'tempo_100m':
      return `<label class="gcwo-field"><span>Tempo aos 100m (s)</span><input type="number" min="0" class="gcwo-intens-valor" value="${intensidade.tempo_100m_s ?? ''}"></label>`;
    case 'zona':
      return `<label class="gcwo-field"><span>Zona</span><select class="gcwo-intens-valor-select">${ZONAS.map(z => `<option value="${z}" ${z === intensidade.zona ? 'selected' : ''}>${ZONA_LABELS[z]}</option>`).join('')}</select></label>`;
    default:
      return '';
  }
}

/* ── Wiring — sessão ─────────────────────────────────────── */
function wireSessionCard(s, i) {
  const card = document.querySelector(`.gcwo-session[data-si="${i}"]`);
  if (!card) return;

  card.querySelector('.gcwo-session-nome').addEventListener('input', (e) => { s.nome = e.target.value; });
  card.querySelector('.gcwo-session-freq').addEventListener('input', (e) => {
    s.frequencia_semanal = e.target.value === '' ? null : Number(e.target.value);
  });
  card.querySelector('.gcwo-session-remove').addEventListener('click', () => {
    _state.sessions.splice(i, 1);
    renderSessions();
  });

  if (s.tipo === 'ginasio') wireGinasioBody(card, s, i);
  else wireCardioBody(card, s, i);
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

function wireCardioBody(card, s, i) {
  const c = s.cardio;

  card.querySelector('.gcwo-cardio-atividade').addEventListener('change', (e) => {
    c.atividade = e.target.value;
    renderSessions();
  });
  const outroInp = card.querySelector('.gcwo-cardio-atividade-outro');
  if (outroInp) outroInp.addEventListener('input', (e) => { c.atividadeOutro = e.target.value; });

  card.querySelectorAll(`input[name="gcwo-modo-${i}"]`).forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) { c.modo = e.target.value; renderSessions(); }
    });
  });

  const durInp = card.querySelector('.gcwo-cardio-duracao');
  if (durInp) durInp.addEventListener('input', (e) => { c.duracao_min = e.target.value === '' ? null : Number(e.target.value); });
  const distInp = card.querySelector('.gcwo-cardio-distancia');
  if (distInp) distInp.addEventListener('input', (e) => { c.distancia_km = e.target.value === '' ? null : Number(e.target.value); });

  card.querySelector('.gcwo-cardio-intens-tipo').addEventListener('change', (e) => {
    c.intensidade.tipo = e.target.value;
    renderSessions();
  });

  const intensValor = card.querySelector('.gcwo-intens-valor');
  if (intensValor) {
    intensValor.addEventListener('input', (e) => {
      const v = e.target.value === '' ? null : Number(e.target.value);
      if (c.intensidade.tipo === 'fc') c.intensidade.fc_alvo_bpm = v;
      else if (c.intensidade.tipo === 'pace') c.intensidade.pace_min_km = v;
      else if (c.intensidade.tipo === 'potencia') c.intensidade.potencia_w = v;
      else if (c.intensidade.tipo === 'tempo_100m') c.intensidade.tempo_100m_s = v;
    });
  }
  const intensSelect = card.querySelector('.gcwo-intens-valor-select');
  if (intensSelect) intensSelect.addEventListener('change', (e) => { c.intensidade.zona = e.target.value; });

  card.querySelector('.gcwo-cardio-nota').addEventListener('input', (e) => { c.nota = e.target.value; });
}

/* ================================================================
   Gravação — monta o snapshot e grava em wo_prescriptions
   ================================================================ */
function buildFinalData() {
  const sessoes = _state.sessions.map(s => {
    const base = { id: s.id, nome: s.nome.trim(), tipo: s.tipo, frequencia_semanal: s.frequencia_semanal };
    if (s.tipo === 'ginasio') {
      base.ginasio = {
        exercicios: s.ginasio.exercicios.map(ex => ({
          id: ex.id,
          exercicio_id: ex.exercicio_id,
          nome: ex.nome,
          categoria: ex.categoria,
          tempo_concentrico_s: ex.tempo_concentrico_s,
          tempo_excentrico_s: ex.tempo_excentrico_s,
          ajustes_maquina: ex.ajustes_maquina,
          series: ex.series.map(sr => ({ serie: sr.serie, reps: sr.reps, peso_kg: sr.peso_kg })),
          descanso_s: ex.descanso_s,
          nota: ex.nota,
        })),
      };
    } else {
      const c = s.cardio;
      base.cardio = {
        atividade: c.atividade === 'Outro' ? (c.atividadeOutro.trim() || 'Outro') : c.atividade,
        modo: c.modo,
        distancia_km: c.modo === 'distancia' ? c.distancia_km : null,
        duracao_min: c.modo === 'duracao' ? c.duracao_min : null,
        intensidade: c.intensidade,
        nota: c.nota,
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
