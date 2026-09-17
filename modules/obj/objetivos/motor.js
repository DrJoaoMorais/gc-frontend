/* modules/obj/objetivos/motor.js — motor do módulo Objetivos (por diagnóstico).
   Config em ./config.js. Não confundir com ../motor.js (motor do Exame
   Objectivo por região — domínio diferente, não tocado por este ficheiro).

   Contrato de dados (consultation_diagnoses, colunas novas — ver migração):
     generates_objectives boolean default true
     is_new_episode        boolean default false
     objectives             jsonb  default '{}'
       { estados: { <catId>: 'cumprido'|'parcial'|'nao' },
         dependencia: { nivel, alternanciaDecubito, elevacaoCabeceira,
                         sedestacao, reacoes, marchaDistancia,
                         marchaAuxiliar, marchaAssist },
         dor: { evaAtual, metaEva },
         forca: { articulacao, movimento, escala, valor, meta },
         adm: { articulacao, movimento, graus },
         equilibrio: { escala, basal, meta },
         avd: { basal, meta },
         retorno: { basal, meta },   // basal/meta = índice em RETORNO_FASES
         tonus: { atual, meta },
         livre: { meta } } */
import {
  CATEGORIAS, ADM_TREE, ADM_ARTICULACOES, RETORNO_FASES, FORCA_ESCALAS, EQUILIBRIO_ESCALAS,
  DEPENDENCIA_DIAGNOSIS_CODES, DEPENDENCIA_NIVEIS, DEPENDENCIA_SEDESTACAO_OPCOES,
  DEPENDENCIA_REACOES_OPCOES, DEPENDENCIA_MARCHA_AUXILIAR_OPCOES, DEPENDENCIA_MARCHA_ASSIST_OPCOES,
  FORCA_GRAU_OPCOES, ASHWORTH_OPCOES, ESTADO_OPCOES, MOTOR_NIVEIS, MOTOR_TAGS,
} from './config.js';

let root = null;
const state = {
  loading: true,
  error: null,
  ctx: { patientId: null, clinicId: null, consultationId: null, diagnosisId: null, patientName: null },
  diagRow: null,
  anteriorRow: null,
  open: {},
  draft: {},
  estados: {},
  dependencia: {},
  generatesObjectives: true,
  isNewEpisode: false,
  saving: false,
  savedOk: false,
};

(async function () {
  root = document.getElementById('obj-root');
  const qp = new URLSearchParams(location.search);
  state.ctx = {
    patientId: qp.get('p') || null,
    clinicId: qp.get('c') || null,
    consultationId: qp.get('s') || null,
    diagnosisId: qp.get('d') || null,
    patientName: qp.get('n') || null,
  };
  if (!state.ctx.consultationId || !state.ctx.diagnosisId || !state.ctx.patientId) {
    state.loading = false;
    state.error = 'Faltam parâmetros na URL (p, c, s, d).';
    render();
    return;
  }
  root.addEventListener('click', onRootClick);
  root.addEventListener('input', onRootInput);
  await carregar();
})();

async function carregar() {
  const sb = window.sb;
  if (!sb) { state.loading = false; state.error = 'Supabase não inicializado.'; render(); return; }
  try {
    const { data: diagRow, error: errDiag } = await sb.from('consultation_diagnoses')
      .select('id, consultation_id, diagnosis_id, generates_objectives, is_new_episode, objectives, diagnoses_catalog(code, label)')
      .eq('consultation_id', state.ctx.consultationId)
      .eq('diagnosis_id', state.ctx.diagnosisId)
      .single();
    if (errDiag) throw errDiag;
    if (!diagRow) throw new Error('Diagnóstico não encontrado nesta consulta.');
    state.diagRow = diagRow;
    state.generatesObjectives = diagRow.generates_objectives !== false; // default true
    state.isNewEpisode = !!diagRow.is_new_episode;
    hidratarDraft(diagRow.objectives || {});

    if (!state.isNewEpisode) {
      state.anteriorRow = await carregarAnterior(sb, state.ctx.patientId, state.ctx.diagnosisId, state.ctx.consultationId);
    }
    CATEGORIAS.forEach(function (cat) { if (!(cat.id in state.open)) state.open[cat.id] = false; });
  } catch (e) {
    state.error = (e && e.message) || String(e);
  } finally {
    state.loading = false;
    render();
  }
}

function hidratarDraft(obj) {
  state.estados = Object.assign({}, obj.estados || {});
  state.dependencia = Object.assign({}, obj.dependencia || {});
  CATEGORIAS.forEach(function (cat) { state.draft[cat.id] = Object.assign({}, obj[cat.id] || {}); });
}

/* Consulta anterior do MESMO doente com o MESMO diagnóstico — mesma lógica
   de "encontrar a consulta anterior" usada em cc-copia-anterior.js
   (report_date desempatado por created_at), mas filtrada ao diagnóstico. */
async function carregarAnterior(sb, patientId, diagnosisId, consultationId) {
  const { data: destino, error: errDestino } = await sb.from('consultations')
    .select('id, patient_id, report_date, created_at')
    .eq('id', consultationId).eq('patient_id', patientId).single();
  if (errDestino) throw errDestino;
  if (!destino) throw new Error('Consulta inválida.');

  const { data: rows, error: errAnt } = await sb.from('consultation_diagnoses')
    .select('id, objectives, consultations!inner(report_date, created_at, patient_id)')
    .eq('diagnosis_id', diagnosisId)
    .eq('consultations.patient_id', patientId)
    .neq('consultation_id', consultationId)
    .order('report_date', { referencedTable: 'consultations', ascending: false })
    .order('created_at', { referencedTable: 'consultations', ascending: false })
    .limit(10);
  if (errAnt) throw errAnt;

  const anteriores = (rows || []).filter(function (r) {
    const rd = r.consultations.report_date, rc = r.consultations.created_at;
    return rd < destino.report_date || (rd === destino.report_date && rc < destino.created_at);
  });
  return anteriores[0] || null;
}

/* ════════ RENDER ════════ */
function render() {
  if (!root) return;
  if (state.loading) { root.innerHTML = '<div class="obj-msg">A carregar…</div>'; return; }
  if (state.error) { root.innerHTML = '<div class="obj-msg obj-msg-err">⚠ ' + escHtml(state.error) + '</div>'; return; }

  const diag = state.diagRow.diagnoses_catalog || {};
  const mostrarDependencia = DEPENDENCIA_DIAGNOSIS_CODES.includes(diag.code);

  let h = '';
  h += renderDiagCard(diag);
  if (mostrarDependencia) h += renderDependenciaCard();
  h += '<div class="obj-cats">' + CATEGORIAS.map(renderCategoriaCard).join('') + '</div>';
  h += renderSaveBar();
  root.innerHTML = h;
}

function renderDiagCard(diag) {
  return (
    '<div class="obj-card obj-diag-card">' +
      '<div class="obj-kicker">Diagnóstico da consulta</div>' +
      '<div class="obj-diag-row">' +
        '<span class="obj-diag-chip"><span class="obj-diag-code">' + escHtml(diag.code || '—') + '</span>' + escHtml(diag.label || '') + '</span>' +
        '<label class="obj-toggle-wrap">' +
          '<button type="button" class="obj-toggle' + (state.generatesObjectives ? ' on' : '') + '" data-act="toggle-gera"><span class="obj-toggle-dot"></span></button>' +
          '<span class="obj-toggle-lbl">Gera objetivos</span>' +
        '</label>' +
        '<label class="obj-toggle-wrap">' +
          '<button type="button" class="obj-toggle' + (state.isNewEpisode ? ' on warn' : '') + '" data-act="toggle-episodio"><span class="obj-toggle-dot"></span></button>' +
          '<span class="obj-toggle-lbl">Marcar como episódio novo' + (state.anteriorRow && !state.isNewEpisode ? ' <span class="obj-tenue">(há consulta anterior com este diagnóstico)</span>' : '') + '</span>' +
        '</label>' +
      '</div>' +
    '</div>'
  );
}

function renderDependenciaCard() {
  const dep = state.dependencia;
  const nivel = dep.nivel;
  let h = '<div class="obj-card">';
  h += '<div class="obj-kicker">Nível de dependência <span class="obj-tenue">(imobilidade/fragilidade)</span></div>';
  h += '<div class="obj-chips">' + DEPENDENCIA_NIVEIS.map(function (lv) {
    return chip('dep-nivel', String(lv.key), lv.label, nivel === lv.key);
  }).join('') + '</div>';

  if (nivel === 0) {
    h += '<div class="obj-subrow">' +
      campoTexto('dep-alternancia', 'Alternância de decúbito', dep.alternanciaDecubito, 'ex. 2/2h') +
      campoTexto('dep-elevacao', 'Elevação da cabeceira (objetivo: sentar)', dep.elevacaoCabeceira, 'ex. 30° progressivo') +
      '</div>';
  } else if (nivel === 1) {
    h += '<div class="obj-subrow">' +
      '<div class="obj-field"><label>Sedestação sem apoio</label><div class="obj-chips">' +
        DEPENDENCIA_SEDESTACAO_OPCOES.map(function (o) { return chip('dep-sedestacao', o, o, dep.sedestacao === o); }).join('') +
      '</div></div>' +
      '<div class="obj-field"><label>Reações de equilíbrio</label><div class="obj-chips">' +
        DEPENDENCIA_REACOES_OPCOES.map(function (o) { return chip('dep-reacoes', o, o, dep.reacoes === o); }).join('') +
      '</div></div>' +
      '</div>';
  } else if (nivel === 2 || nivel === 3) {
    h += '<div class="obj-subrow">' +
      campoNumero('dep-marcha-dist', 'Distância (m)', dep.marchaDistancia, 'ex. 50') +
      '<div class="obj-field"><label>Auxiliar</label><div class="obj-chips">' +
        DEPENDENCIA_MARCHA_AUXILIAR_OPCOES.map(function (o) { return chip('dep-marcha-aux', o, o, dep.marchaAuxiliar === o); }).join('') +
      '</div></div>' +
      '<div class="obj-field"><label>Assistência</label><div class="obj-chips">' +
        DEPENDENCIA_MARCHA_ASSIST_OPCOES.map(function (o) { return chip('dep-marcha-assist', o, o, dep.marchaAssist === o); }).join('') +
      '</div></div>' +
      '</div>';
  }
  return h + '</div>';
}

function renderCategoriaCard(cat) {
  const aberto = !!state.open[cat.id];
  const anterior = state.anteriorRow ? (state.anteriorRow.objectives || {})[cat.id] : null;
  const temAnterior = !!(anterior && Object.keys(anterior).length && cat.tipo !== 'adm');
  const badge = badgeFor(cat, temAnterior);
  let h = '<div class="obj-card obj-cat-card">';
  h += '<button type="button" class="obj-cat-head" data-act="toggle-cat" data-cat="' + cat.id + '">' +
    '<span class="obj-cat-title"><span class="obj-cat-n">' + cat.n + '</span>' + escHtml(cat.nome) + '</span>' +
    '<span class="obj-cat-right"><span class="' + badge.cls + '">' + escHtml(badge.text) + '</span><span class="obj-chevron">' + (aberto ? '▾' : '▸') + '</span></span>' +
    '</button>';
  if (aberto) {
    h += '<div class="obj-cat-body">';
    h += '<div class="obj-col obj-col-anterior">' + renderColunaAnterior(cat, anterior, temAnterior) + '</div>';
    h += '<div class="obj-col obj-col-hoje">' + renderColunaHoje(cat) + '</div>';
    h += '</div>';
  }
  return h + '</div>';
}

function badgeFor(cat, temAnterior) {
  if (!temAnterior) return { text: cat.id === 'livre' ? 'Texto livre' : '—', cls: 'obj-badge obj-badge-grey' };
  const est = state.estados[cat.id];
  if (!est) return { text: 'Por rever', cls: 'obj-badge obj-badge-blue' };
  const info = ESTADO_OPCOES.find(function (o) { return o.key === est; });
  return { text: info ? info.label : est, cls: 'obj-badge obj-badge-' + est };
}

function renderColunaAnterior(cat, anterior, temAnterior) {
  if (!temAnterior) return '<div class="obj-sem-anterior">Categoria nova — sem anterior</div>';
  const dataConsulta = state.anteriorRow.consultations ? fmtData(state.anteriorRow.consultations.report_date) : '';
  let h = '<div class="obj-anterior-label">Anterior' + (dataConsulta ? ' · ' + dataConsulta : '') + '</div>';
  h += '<div class="obj-anterior-resumo">' + resumoAnterior(cat, anterior) + '</div>';
  h += '<div class="obj-field"><label>Estado</label><div class="obj-chips">' +
    ESTADO_OPCOES.map(function (o) { return chip('estado-' + cat.id, o.key, o.label, state.estados[cat.id] === o.key, 'obj-chip-estado obj-chip-estado-' + o.key); }).join('') +
    '</div></div>';
  return h;
}

function resumoAnterior(cat, a) {
  switch (cat.tipo) {
    case 'dor': return 'EVA ' + (a.evaAtual != null ? a.evaAtual : '—') + '/10 · Meta ' + (a.metaEva != null ? a.metaEva : '—') + '/10';
    case 'forca': return escHtml([a.articulacao, a.movimento].filter(Boolean).join(' · ')) + ': ' + escHtml(String(a.meta || a.valor || '—'));
    case 'ashworth': return 'Ashworth ' + (a.atual || '—') + ' · Meta ' + (a.meta || '—');
    case 'motor': return escHtml([a.nivel, (a.foco || []).length ? (a.foco || []).join(', ') : null].filter(Boolean).join(' · ') || '—');
    default: return escHtml(String(a.meta || a.basal || '—'));
  }
}

function renderColunaHoje(cat) {
  const d = state.draft[cat.id] || {};
  let h = '<div class="obj-hoje-label">Hoje</div>';
  switch (cat.tipo) {
    case 'dor':
      h += campoChips(cat.id, 'evaAtual', 'EVA atual (0-10)', Array.from({ length: 11 }, function (_, i) { return String(i); }), d.evaAtual);
      h += campoChips(cat.id, 'metaEva', 'Meta EVA (0-10)', Array.from({ length: 11 }, function (_, i) { return String(i); }), d.metaEva);
      break;
    case 'forca': {
      const movs = movimentosDe(d.articulacao);
      h += '<div class="obj-field"><label>Articulação</label><div class="obj-chips">' +
        ADM_ARTICULACOES.map(function (a) { return chip('draft-' + cat.id + '-articulacao', a, a, d.articulacao === a); }).join('') + '</div></div>';
      h += '<div class="obj-field"><label>Movimento</label><div class="obj-chips">' +
        movs.map(function (m) { return chip('draft-' + cat.id + '-movimento', m, m, d.movimento === m); }).join('') + '</div></div>';
      h += '<div class="obj-field"><label>Escala</label><div class="obj-chips">' +
        FORCA_ESCALAS.map(function (e) { return chip('draft-' + cat.id + '-escala', e.v, e.lbl, d.escala === e.v); }).join('') + '</div></div>';
      if (d.escala === 'kg') h += campoNumero('draft-' + cat.id + '-valor', 'Valor (kg)', d.valor, 'kg');
      else h += '<div class="obj-field"><label>Valor (grau)</label><div class="obj-chips">' +
        FORCA_GRAU_OPCOES.map(function (g) { return chip('draft-' + cat.id + '-valor', String(g), String(g), String(d.valor) === String(g)); }).join('') + '</div></div>';
      h += campoTexto('draft-' + cat.id + '-meta', 'Meta próxima consulta', d.meta);
      break;
    }
    case 'adm': {
      const movs = movimentosDe(d.articulacao);
      h += '<div class="obj-field"><label>Articulação</label><div class="obj-chips">' +
        ADM_ARTICULACOES.map(function (a) { return chip('draft-' + cat.id + '-articulacao', a, a, d.articulacao === a); }).join('') + '</div></div>';
      h += '<div class="obj-field"><label>Movimento</label><div class="obj-chips">' +
        movs.map(function (m) { return chip('draft-' + cat.id + '-movimento', m, m, d.movimento === m); }).join('') + '</div></div>';
      h += campoNumero('draft-' + cat.id + '-graus', 'Graus', d.graus, '°');
      break;
    }
    case 'motor':
      h += '<div class="obj-field"><label>Nível</label><div class="obj-chips">' +
        MOTOR_NIVEIS.map(function (o) { return chip('draft-' + cat.id + '-nivel', o, o, d.nivel === o); }).join('') + '</div></div>';
      h += '<div class="obj-field"><label>Foco (vários)</label><div class="obj-chips">' +
        MOTOR_TAGS.map(function (o) { return chip('draft-' + cat.id + '-foco', o, o, Array.isArray(d.foco) && d.foco.indexOf(o) !== -1); }).join('') + '</div></div>';
      break;
    case 'ashworth':
      h += '<div class="obj-field"><label>Ashworth atual</label><div class="obj-chips">' +
        ASHWORTH_OPCOES.map(function (o) { return chip('draft-' + cat.id + '-atual', o, o, d.atual === o); }).join('') + '</div></div>';
      h += '<div class="obj-field"><label>Meta (Ashworth)</label><div class="obj-chips">' +
        ASHWORTH_OPCOES.map(function (o) { return chip('draft-' + cat.id + '-meta', o, o, d.meta === o); }).join('') + '</div></div>';
      break;
    case 'texto':
      if (cat.fases) {
        h += '<div class="obj-field"><label>' + escHtml(cat.basalLabel || 'Basal') + '</label><div class="obj-chips">' +
          cat.fases.map(function (f) { return chip('draft-' + cat.id + '-basal', String(f.v), f.lbl, String(d.basal) === String(f.v)); }).join('') + '</div></div>';
        h += '<div class="obj-field"><label>' + escHtml(cat.metaLabel) + '</label><div class="obj-chips">' +
          cat.fases.map(function (f) { return chip('draft-' + cat.id + '-meta', String(f.v), f.lbl, String(d.meta) === String(f.v)); }).join('') + '</div></div>';
      } else {
        if (cat.escalas) h += '<div class="obj-field"><label>Escala</label><div class="obj-chips">' +
          cat.escalas.map(function (e) { return chip('draft-' + cat.id + '-escala', e.v, e.lbl, d.escala === e.v); }).join('') + '</div></div>';
        h += campoTexto('draft-' + cat.id + '-basal', escHtml(cat.basalLabel || 'Basal'), d.basal);
        h += campoTexto('draft-' + cat.id + '-meta', escHtml(cat.metaLabel || 'Meta próxima consulta'), d.meta);
      }
      break;
    case 'livre':
      h += campoTexto('draft-' + cat.id + '-meta', escHtml(cat.metaLabel || 'Objetivo (texto livre)'), d.meta);
      break;
  }
  return h;
}

function movimentosDe(articulacao) {
  const no = ADM_TREE[articulacao];
  if (!no) return [];
  if (no.movimentos) return no.movimentos;
  if (no.subregioes) return Object.values(no.subregioes).flat();
  return [];
}

function renderSaveBar() {
  return '<div class="obj-savebar">' +
    (state.savedOk ? '<span class="obj-saved-ok">✓ Guardado</span>' : '') +
    '<button type="button" class="obj-btn-save" data-act="guardar"' + (state.saving ? ' disabled' : '') + '>' + (state.saving ? 'A guardar…' : 'Guardar') + '</button>' +
    '</div>';
}

/* ════════ HELPERS DE MARKUP ════════ */
function chip(grupo, valor, label, sel, extraCls) {
  return '<button type="button" class="obj-chip' + (extraCls ? ' ' + extraCls : '') + (sel ? ' sel' : '') + '" data-act="chip" data-grupo="' + escAttr(grupo) + '" data-v="' + escAttr(valor) + '">' + escHtml(label) + '</button>';
}
function campoChips(catId, campo, label, opcoes, valorAtual) {
  return '<div class="obj-field"><label>' + escHtml(label) + '</label><div class="obj-chips">' +
    opcoes.map(function (o) { return chip('draft-' + catId + '-' + campo, o, o, String(valorAtual) === String(o)); }).join('') +
    '</div></div>';
}
function campoTexto(id, label, valor, placeholder) {
  return '<div class="obj-field"><label>' + label + '</label><input type="text" class="obj-input" data-field="' + escAttr(id) + '" value="' + escAttr(valor || '') + '" placeholder="' + escAttr(placeholder || '') + '"></div>';
}
function campoNumero(id, label, valor, placeholder) {
  return '<div class="obj-field"><label>' + escHtml(label) + '</label><input type="number" class="obj-input obj-input-num" data-field="' + escAttr(id) + '" value="' + escAttr(valor != null ? valor : '') + '" placeholder="' + escAttr(placeholder || '') + '"></div>';
}
function escHtml(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function escAttr(s) { return escHtml(s); }
function fmtData(iso) {
  if (!iso) return '';
  const p = String(iso).split('-');
  return p.length === 3 ? p[2] + '/' + p[1] : iso;
}

/* ════════ EVENTOS ════════ */
function onRootClick(ev) {
  const btn = ev.target.closest('[data-act]');
  if (!btn) return;
  const act = btn.dataset.act;
  if (act === 'toggle-gera') { state.generatesObjectives = !state.generatesObjectives; render(); return; }
  if (act === 'toggle-episodio') {
    state.isNewEpisode = !state.isNewEpisode;
    if (state.isNewEpisode) { state.anteriorRow = null; render(); }
    else { carregar(); }
    return;
  }
  if (act === 'toggle-cat') { state.open[btn.dataset.cat] = !state.open[btn.dataset.cat]; render(); return; }
  if (act === 'chip') { aplicarChip(btn.dataset.grupo, btn.dataset.v); render(); return; }
  if (act === 'guardar') { guardar(); return; }
}
function onRootInput(ev) {
  const el = ev.target.closest('[data-field]');
  if (!el) return;
  aplicarCampo(el.dataset.field, el.value);
}

function aplicarChip(grupo, valor) {
  if (grupo === 'dep-nivel') { state.dependencia.nivel = Number(valor); return; }
  if (grupo === 'dep-sedestacao') { state.dependencia.sedestacao = valor; return; }
  if (grupo === 'dep-reacoes') { state.dependencia.reacoes = valor; return; }
  if (grupo === 'dep-marcha-aux') { state.dependencia.marchaAuxiliar = valor; return; }
  if (grupo === 'dep-marcha-assist') { state.dependencia.marchaAssist = valor; return; }
  if (grupo.indexOf('estado-') === 0) { state.estados[grupo.slice(7)] = valor; return; }
  if (grupo.indexOf('draft-') === 0) {
    const resto = grupo.slice(6); // "<catId>-<campo>"
    const i = resto.indexOf('-');
    const catId = resto.slice(0, i), campo = resto.slice(i + 1);
    if (!state.draft[catId]) state.draft[catId] = {};
    if (campo === 'foco') {
      // Único campo multi-select do motor — chip liga/desliga a sua presença no array.
      const atual = Array.isArray(state.draft[catId].foco) ? state.draft[catId].foco : [];
      const i = atual.indexOf(valor);
      state.draft[catId].foco = i === -1 ? atual.concat([valor]) : atual.slice(0, i).concat(atual.slice(i + 1));
      return;
    }
    // Guardado sempre como veio do chip (string) — todas as comparações no
    // render fazem String(...) dos dois lados, por isso não há coerção aqui.
    state.draft[catId][campo] = valor;
    // Ao trocar de articulação, a lista de movimentos muda — limpa o movimento anterior se deixar de fazer sentido.
    if (campo === 'articulacao') {
      const movs = movimentosDe(valor);
      if (state.draft[catId].movimento && movs.indexOf(state.draft[catId].movimento) === -1) state.draft[catId].movimento = null;
    }
  }
}

function aplicarCampo(id, valor) {
  if (id === 'dep-alternancia') { state.dependencia.alternanciaDecubito = valor; return; }
  if (id === 'dep-elevacao') { state.dependencia.elevacaoCabeceira = valor; return; }
  if (id === 'dep-marcha-dist') { state.dependencia.marchaDistancia = valor; return; }
  if (id.indexOf('draft-') === 0) {
    const resto = id.slice(6);
    const i = resto.indexOf('-');
    const catId = resto.slice(0, i), campo = resto.slice(i + 1);
    if (!state.draft[catId]) state.draft[catId] = {};
    state.draft[catId][campo] = valor;
  }
}

async function guardar() {
  const sb = window.sb;
  if (!sb || !state.diagRow) return;
  state.saving = true; state.savedOk = false; render();
  const objectives = Object.assign({}, state.draft, { estados: state.estados, dependencia: state.dependencia });
  const { error } = await sb.from('consultation_diagnoses').update({
    generates_objectives: state.generatesObjectives,
    is_new_episode: state.isNewEpisode,
    objectives: objectives,
  }).eq('id', state.diagRow.id);
  state.saving = false;
  if (error) { state.error = 'Erro ao gravar: ' + error.message; render(); return; }
  state.savedOk = true;
  render();
}
