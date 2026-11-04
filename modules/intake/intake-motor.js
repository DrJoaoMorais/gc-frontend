/* intake-motor.js — motor genérico de questionários pré-consulta. Config em ./configs/<questionnaire_type>.js
   Contrato de página: <div id="intake-root"></div> + window.sb inicializado antes deste módulo.
   Navegação por secção (uma secção por ecrã), não scroll único nem pergunta-a-pergunta.
   Formato de answer (jsonb) por tipo de pergunta:
     texto_curto     → string
     escala          → number
     dropdown        → string
     escolha_unica   → string (ou { v, outro_texto } se a pergunta tiver outro:true)
     escolha_multipla→ string[] (ou { v: string[], outro_texto } se outro:true)
     grelha          → { [linha_id]: coluna_selecionada }
*/

let _cfg = null;
let _token = null;
let _ctx = null;
let _respostas = {};
let _secaoIdx = 0;
let _maxSecaoAlcancada = 0;
let _indexAberto = false;
let _toastTimer = null;
let _root = null;

(async function () {
  const root = document.getElementById('intake-root');
  if (!root) return;
  _root = root;
  const qp = new URLSearchParams(location.search);
  _token = qp.get('t') || '';
  if (!_token) { _renderErro(root, 'invalido'); return; }
  await _carregarToken(root);
})();

/* ════════ TOKEN ════════
   Acesso público exclusivamente via funções SECURITY DEFINER (intake_get_context,
   intake_aceitar_rgpd, intake_gravar_resposta, intake_concluir). Não há SELECT/UPDATE/INSERT
   de anon nas tabelas base — cada função valida o token internamente e nunca expõe outras linhas. */
async function _carregarToken(root) {
  const sb = window.sb;
  if (!sb) { _renderErro(root, 'generico'); return; }
  root.innerHTML = '<div class="gate" id="gate-loading"><p>A abrir…</p></div>';
  let data, error;
  try {
    ({ data, error } = await sb.rpc('intake_get_context', { p_token: _token }));
  } catch (e) {
    _renderErro(root, 'generico');
    return;
  }
  if (error) { _renderErro(root, 'generico'); return; }
  const ctx = Array.isArray(data) ? data[0] : data;
  if (!ctx || ctx.status === 'invalid') { _renderErro(root, 'invalido'); return; }
  if (ctx.status === 'expired') { _renderErro(root, 'expirado'); return; }
  if (ctx.status === 'completed') { _renderConcluido(root); return; }
  _ctx = ctx;
  if (!ctx.rgpd_accepted_at) { _renderRgpd(root); return; }
  await _iniciarQuestionario(root);
}

function _renderErro(root, tipo) {
  const msgs = {
    invalido: { h: 'Este link não é válido', p: 'Confirme o link recebido ou contacte a clínica para lhe ser enviado um novo.' },
    expirado: { h: 'Este link expirou', p: 'Contacte a clínica para lhe ser enviado um novo link.' },
    generico: { h: 'Não foi possível carregar o questionário', p: 'Verifique a ligação à internet e tente novamente.' },
  };
  const m = msgs[tipo] || msgs.generico;
  root.innerHTML =
    '<div class="gate">' +
    '<h2>' + m.h + '</h2>' +
    '<p>' + m.p + '</p>' +
    (tipo === 'generico' ? '<button id="intake-retry" class="mini-btn" style="margin-top:14px;">Tentar novamente</button>' : '') +
    '</div>';
  if (tipo === 'generico') {
    const btn = document.getElementById('intake-retry');
    if (btn) btn.addEventListener('click', function () { _carregarToken(root); });
  }
}

function _renderConcluido(root) {
  root.innerHTML =
    '<div class="gate">' +
    '<h2>Questionário já concluído</h2>' +
    '<p>Obrigado — as suas respostas já foram registadas. Se precisar de alterar alguma coisa, contacte a clínica.</p>' +
    '</div>';
}

/* ════════ RGPD ════════ */
function _renderRgpd(root) {
  const dataConsulta = _ctx.appointment_date;
  const limite = _ctx.expires_at ? _formatarData(_ctx.expires_at) : null;

  root.innerHTML =
    '<div class="gate gate-rgpd">' +
    '<h2>Proteção de Dados</h2>' +
    '<p>Antes de preencher este questionário, é necessário o seu consentimento para o tratamento dos dados de saúde que vai fornecer, nos termos do RGPD.</p>' +
    '<p>Os dados destinam-se exclusivamente à preparação da sua consulta e ficam associados ao seu processo clínico.</p>' +
    '<div class="rgpd-info">' +
    (dataConsulta ? '<div class="rgpd-info-row"><span>Consulta</span><strong>' + _formatarData(dataConsulta) + '</strong></div>' : '') +
    (limite ? '<div class="rgpd-info-row"><span>Prazo para responder</span><strong>' + limite + '</strong></div>' : '') +
    '</div>' +
    '<label class="rgpd-check"><input type="checkbox" id="intake-rgpd-aceite"> Li e aceito os termos de tratamento de dados.</label>' +
    '<button id="intake-rgpd-btn" class="mini-btn" disabled>Continuar</button>' +
    '</div>';
  const chk = document.getElementById('intake-rgpd-aceite');
  const btn = document.getElementById('intake-rgpd-btn');
  chk.addEventListener('change', function () { btn.disabled = !chk.checked; });
  btn.addEventListener('click', async function () {
    btn.disabled = true;
    btn.textContent = 'A gravar…';
    const sb = window.sb;
    let data, error;
    try {
      ({ data, error } = await sb.rpc('intake_aceitar_rgpd', { p_token: _token, p_user_agent: navigator.userAgent }));
    } catch (e) { error = e; }
    const ctx = Array.isArray(data) ? data[0] : data;
    if (error || !ctx || ctx.status !== 'ok') {
      btn.disabled = false;
      btn.textContent = 'Continuar';
      return;
    }
    _ctx = ctx;
    await _iniciarQuestionario(root);
  });
}

function _formatarData(iso) {
  try {
    return new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch (e) { return iso; }
}

/* ════════ QUESTIONÁRIO ════════ */
async function _iniciarQuestionario(root) {
  const tipo = _ctx.questionnaire_type;
  let mod;
  try {
    mod = await import('./configs/' + tipo + '.js?v=2026-11-04-semana');
  } catch (e) {
    root.innerHTML = '<div class="gate"><h2>Tipo de questionário desconhecido</h2><p>' + tipo + '</p></div>';
    return;
  }
  _cfg = mod.default;
  _respostas = _ctx.respostas || {};
  _maxSecaoAlcancada = _calcularMaxAlcancada();
  _secaoIdx = _maxSecaoAlcancada;
  _render();
}

function _calcularMaxAlcancada() {
  let max = 0;
  _cfg.seccoes.forEach(function (sec, i) {
    const temResposta = sec.perguntas.some(function (p) { return _perguntaTemAlgumaResposta(p); });
    if (temResposta) max = i;
  });
  return max;
}

/* progresso parcial — usado para saber até onde o doente já chegou (não exige a secção completa) */
function _perguntaTemAlgumaResposta(p) {
  const v = _respostas[p.id];
  if (v == null) return false;
  if (p.tipo === 'grelha') return typeof v === 'object' && Object.keys(v).length > 0;
  if (p.tipo === 'escolha_multipla') {
    if (p.outro) return (Array.isArray(v.v) && v.v.length > 0) || !!(v.outro_texto);
    return Array.isArray(v) && v.length > 0;
  }
  if (p.tipo === 'escolha_unica' && p.outro) return !!(v && (v.v || v.outro_texto));
  if (typeof v === 'string') return v.trim().length > 0;
  return true;
}

/* secção completa — usado só para o ✓ no índice de secções */
function _perguntaRespondida(p) {
  const v = _respostas[p.id];
  if (v == null) return false;
  if (p.tipo === 'grelha') return typeof v === 'object' && Object.keys(v).length >= p.linhas.length;
  if (p.tipo === 'escolha_multipla') {
    if (p.outro) return Array.isArray(v.v) && v.v.length > 0;
    return Array.isArray(v) && v.length > 0;
  }
  if (p.tipo === 'escolha_unica' && p.outro) return !!(v && v.v);
  if (typeof v === 'string') return v.trim().length > 0;
  return true;
}

/* ════════ RENDER PRINCIPAL ════════ */
function _render() {
  const root = _root;
  const total = _cfg.seccoes.length;
  const sec = _cfg.seccoes[_secaoIdx];
  const pct = Math.round(((_secaoIdx + 1) / total) * 100);
  const ultima = _secaoIdx === total - 1;

  let h = '<div class="app">';
  h += '<header class="topbar">' +
    '<button class="progress-tap" id="progressTap">' +
    '<div class="progress-bar"><div class="progress-fill" style="width:' + pct + '%"></div></div>' +
    '<div class="progress-label">Secção ' + (_secaoIdx + 1) + ' de ' + total + ' <span class="chevron">▾</span></div>' +
    '</button></header>';

  if (_secaoIdx === 0 && _cfg.intro) {
    h += '<div class="questionario-intro">' + _cfg.intro.split('\n\n').map(function(p){ return '<p>' + p + '</p>'; }).join('') + '</div>';
  }

  h += '<div class="secao-head"><div class="secao-kicker">SECÇÃO ' + (_secaoIdx + 1) + ' DE ' + total + '</div><h2>' + sec.titulo + '</h2></div>';

  h += '<div class="perguntas">';
  sec.perguntas.forEach(function (p) { h += _renderPergunta(p); });
  h += '</div>';

  h += '<div class="navbar">' +
    '<button id="btnAnterior" class="nav-btn ghost"' + (_secaoIdx === 0 ? ' disabled' : '') + '>Anterior</button>' +
    '<button id="btnSeguinte" class="nav-btn primary">' + (ultima ? 'Concluir questionário' : 'Seguinte') + '</button>' +
    '</div>';

  h += '</div>'; // .app

  h += '<div class="toast" id="toast">✓ Guardado</div>';

  h += '<div class="index-overlay" id="indexOverlay"' + (_indexAberto ? '' : ' hidden') + '>' +
    '<div class="index-sheet">' +
    '<div class="index-head"><h3>Secções</h3><button class="index-close" id="indexClose">✕</button></div>' +
    '<div class="index-list" id="indexList">' + _renderIndexList() + '</div>' +
    '</div></div>';

  root.innerHTML = h;
  _wireApp();
  sec.perguntas.forEach(function (p) { _wirePergunta(p); });
}

function _renderIndexList() {
  return _cfg.seccoes.map(function (sec, i) {
    const alcancavel = i <= _maxSecaoAlcancada;
    const completa = sec.perguntas.every(_perguntaRespondida);
    let cls = 'index-item';
    if (i === _secaoIdx) cls += ' atual';
    if (!alcancavel) cls += ' bloqueada';
    return '<button class="' + cls + '" data-idx="' + i + '"' + (alcancavel ? '' : ' disabled') + '>' +
      '<span class="index-num">' + (i + 1) + '</span>' +
      '<span class="index-titulo">' + sec.titulo + '</span>' +
      (completa ? '<span class="index-check">✓</span>' : '') +
      '</button>';
  }).join('');
}

function _wireApp() {
  const tap = document.getElementById('progressTap');
  const overlay = document.getElementById('indexOverlay');
  const close = document.getElementById('indexClose');
  if (tap) tap.addEventListener('click', function () { _indexAberto = true; _render(); });
  if (close) close.addEventListener('click', function () { _indexAberto = false; _render(); });
  if (overlay) overlay.addEventListener('click', function (e) { if (e.target === overlay) { _indexAberto = false; _render(); } });
  document.querySelectorAll('.index-item').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (btn.disabled) return;
      _secaoIdx = parseInt(btn.dataset.idx, 10);
      _indexAberto = false;
      _render();
    });
  });
  const btnAnt = document.getElementById('btnAnterior');
  const btnSeg = document.getElementById('btnSeguinte');
  if (btnAnt) btnAnt.addEventListener('click', function () {
    if (_secaoIdx > 0) { _secaoIdx--; _render(); window.scrollTo(0, 0); }
  });
  if (btnSeg) btnSeg.addEventListener('click', async function () {
    const semana = _cfg.seccoes.flatMap(sec => sec.perguntas).find(p => p.tipo === 'semana_treino');
    if (semana && (_cfg.seccoes[_secaoIdx].perguntas.includes(semana) || _secaoIdx === _cfg.seccoes.length - 1)) {
      const dias = _respostas[semana.id];
      if (!Array.isArray(dias) || dias.length !== 7 || dias.some(d => !d.estado || (d.estado === 'treino' && !d.tempo))) {
        alert('Indique a disponibilidade dos sete dias e o tempo dos dias em que quer treinar.');
        return;
      }
      btnSeg.disabled = true;
      try {
        const saved = await window.sb.rpc('intake_gravar_resposta', { p_token: _token, p_question_id: semana.id, p_answer: dias });
        if (saved.error || saved.data !== true) throw new Error('Gravação recusada');
      } catch {
        _avisarErroGravacao();
        btnSeg.disabled = false;
        return;
      }
    }
    const ultima = _secaoIdx === _cfg.seccoes.length - 1;
    if (!ultima) {
      _secaoIdx++;
      _maxSecaoAlcancada = Math.max(_maxSecaoAlcancada, _secaoIdx);
      _render();
      window.scrollTo(0, 0);
      return;
    }
    btnSeg.disabled = true;
    btnSeg.textContent = 'A concluir…';
    const sb = window.sb;
    let data, error;
    try {
      ({ data, error } = await sb.rpc('intake_concluir', { p_token: _token }));
    } catch (e) { error = e; }
    if (error || data !== true) {
      btnSeg.disabled = false;
      btnSeg.textContent = 'Concluir questionário';
      return;
    }
    _renderConcluido(_root);
  });
}

/* ════════ RENDER PERGUNTAS ════════ */
function _renderPergunta(p) {
  switch (p.tipo) {
    case 'texto_curto':      return _renderTextoCurto(p);
    case 'semana_treino':     return _renderSemanaTreino(p);
    case 'numero':           return _renderNumero(p);
    case 'escolha_unica':    return _renderEscolha(p, false);
    case 'escolha_multipla': return _renderEscolha(p, true);
    case 'escala':           return _renderEscala(p);
    case 'dropdown':         return _renderDropdown(p);
    case 'grelha':           return _renderGrelha(p);
    default: return '';
  }
}

function _valorAtual(id) { return Object.prototype.hasOwnProperty.call(_respostas, id) ? _respostas[id] : null; }
function _esc(s) { return String(s == null ? '' : s).replace(/"/g, '&quot;'); }
function _renderApoio(p) { return p.apoio ? '<div class="q-apoio">' + p.apoio + '</div>' : ''; }

function _renderTextoCurto(p) {
  const val = _valorAtual(p.id);
  if (p.multilinha) {
    return '<div class="q" data-id="' + p.id + '">' +
      '<label class="q-lbl" for="q_' + p.id + '">' + p.label + (p.obrigatorio ? ' *' : '') + '</label>' +
      _renderApoio(p) +
      '<textarea id="q_' + p.id + '" class="q-textarea">' + _esc(val || '') + '</textarea>' +
      '</div>';
  }
  return '<div class="q" data-id="' + p.id + '">' +
    '<label class="q-lbl" for="q_' + p.id + '">' + p.label + (p.obrigatorio ? ' *' : '') + '</label>' +
    _renderApoio(p) +
    '<input type="text" id="q_' + p.id + '" class="q-input" value="' + _esc(val) + '">' +
    '</div>';
}

function _renderNumero(p) {
  const val = _valorAtual(p.id);
  return '<div class="q" data-id="' + p.id + '">' +
    '<label class="q-lbl" for="q_' + p.id + '">' + p.label + (p.obrigatorio ? ' *' : '') + '</label>' +
    _renderApoio(p) +
    '<input type="number" inputmode="decimal" id="q_' + p.id + '" class="q-input"' +
    (p.min != null ? ' min="' + p.min + '"' : '') +
    (p.max != null ? ' max="' + p.max + '"' : '') +
    (p.inteiro ? ' step="1"' : '') +
    ' value="' + (val != null ? val : '') + '">' +
    '</div>';
}

function _renderEscolha(p, multi) {
  const val = _valorAtual(p.id);
  const selecionados = p.outro
    ? (val && Array.isArray(val.v) ? val.v : val && typeof val.v === 'string' ? [val.v] : [])
    : (multi ? (Array.isArray(val) ? val : []) : (val != null ? [val] : []));
  const outroTexto = p.outro && val && typeof val === 'object' ? (val.outro_texto || '') : '';
  const markCls = multi ? 'check' : 'radio';

  let h = '<div class="q" data-id="' + p.id + '" data-multi="' + (multi ? '1' : '0') + '">' +
    '<div class="q-lbl">' + p.label + (p.obrigatorio ? ' *' : '') + '</div>' +
    '<div class="choice-list">';
  p.opcoes.forEach(function (o) {
    const sel = selecionados.indexOf(o) > -1;
    h += '<button type="button" class="choice-item' + (sel ? ' sel' : '') + '" data-v="' + _esc(o) + '">' +
      '<span class="choice-mark ' + markCls + '"></span><span class="choice-label">' + o + '</span></button>';
  });
  if (p.outro) {
    const sel = selecionados.indexOf('Outro') > -1;
    h += '<button type="button" class="choice-item outro-toggle' + (sel ? ' sel' : '') + '" data-v="Outro">' +
      '<span class="choice-mark ' + markCls + '"></span><span class="choice-label">Outro</span></button>';
  }
  h += '</div>';
  if (p.outro) {
    const mostraOutro = selecionados.indexOf('Outro') > -1;
    h += '<input type="text" class="q-input q-outro" placeholder="Especifique…" value="' + _esc(outroTexto) + '" style="' + (mostraOutro ? '' : 'display:none;') + '">';
  }
  if (p.max) h += '<div class="q-nota">Escolha até ' + p.max + '</div>';
  return h + '</div>';
}

function _renderEscala(p) {
  const val = _valorAtual(p.id);
  let h = '<div class="q" data-id="' + p.id + '">' +
    '<div class="q-lbl">' + p.label + '</div>' +
    _renderApoio(p) +
    '<div class="escala-top"><span class="escala-val">' + (val != null ? val : '—') + '</span></div>' +
    '<div class="bar escala-bar">';
  for (let v = p.min; v <= p.max; v++) {
    h += '<div class="seg' + (val != null && v <= val ? ' on' : '') + '" data-v="' + v + '"></div>';
  }
  return h + '</div><div class="escala-minmax"><span>' + p.min + '</span><span>' + p.max + '</span></div></div>';
}

function _renderDropdown(p) {
  const val = _valorAtual(p.id);
  let h = '<div class="q" data-id="' + p.id + '">' +
    '<label class="q-lbl" for="q_' + p.id + '">' + p.label + '</label>' +
    '<select id="q_' + p.id + '" class="q-select"><option value="">—</option>';
  p.opcoes.forEach(function (o) {
    h += '<option value="' + _esc(o) + '"' + (val === o ? ' selected' : '') + '>' + o + '</option>';
  });
  return h + '</select></div>';
}

function _renderGrelha(p) {
  const val = _valorAtual(p.id) || {};
  let h = '<div class="q q-grelha" data-id="' + p.id + '">';
  if (p.titulo) h += '<div class="q-lbl">' + p.titulo + '</div>';
  h += '<div class="grelha-header"><span></span>' + p.colunas.map(function (c) { return '<span>' + c + '</span>'; }).join('') + '</div>';
  p.linhas.forEach(function (linha) {
    h += '<div class="grelha-linha" data-linha="' + linha.id + '">' +
      '<span class="grelha-lbl">' + linha.label + '</span>';
    p.colunas.forEach(function (c) {
      const sel = val[linha.id] === c;
      h += '<button type="button" class="grelha-cell' + (sel ? ' sel' : '') + '" data-v="' + _esc(c) + '"><span class="choice-mark radio"></span></button>';
    });
    h += '</div>';
  });
  return h + '</div>';
}

const DIAS_TREINO = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];
const ESTADOS_TREINO = { treino: 'Quero treinar', descanso: 'Prefiro descansar', indisponivel: 'Não posso treinar' };
const TEMPOS_TREINO = { curto: 'Menos de 20 min', 30: '30 min', 45: '45 min', 60: '60 min' };
const MODALIDADES_TREINO = ['Corrida', 'Ciclismo', 'Natação', 'Ginásio', 'Exercício em casa', 'Sem preferência'];

function _renderSemanaTreino(p) {
  const dias = _respostas[p.id] || [];
  const opcoes = (values, name, checked, type = 'radio') => values.map(([value, label]) =>
    `<label class="choice-item"><input type="${type}" name="${name}" value="${value}" ${checked.includes(value) ? 'checked' : ''}> <span>${label}</span></label>`).join('');
  return `<div class="q" data-id="${p.id}"><div class="q-lbl">${p.label}</div>
    <p>Indique o tempo total disponível em cada dia. Pode escolher várias modalidades.</p>
    <button type="button" data-todos>Quero treinar todos os dias</button>
    ${DIAS_TREINO.map((nome, i) => {
      const d = dias[i] || {};
      return `<fieldset data-dia><legend>${nome}</legend><div class="choice-list">${opcoes(Object.entries(ESTADOS_TREINO), 'estado-' + i, [d.estado])}</div>
        <div data-treino ${d.estado === 'treino' ? '' : 'hidden'}><p>Tempo total disponível</p>
        <div class="choice-list">${opcoes(['curto','30','45','60'].map(t => [t, TEMPOS_TREINO[t]]), 'tempo-' + i, [d.tempo])}</div>
        <p>Modalidades preferidas</p><div class="choice-list">${opcoes(MODALIDADES_TREINO.map(m => [m,m]), 'modalidade-' + i, d.modalidades || [], 'checkbox')}</div></div></fieldset>`;
    }).join('')}</div>`;
}

function _wireSemanaTreino(el, id) {
  const dias = [...el.querySelectorAll('[data-dia]')];
  function atualizar() {
    _respostas[id] = dias.map(d => {
      const estado = d.querySelector('[name^="estado-"]:checked')?.value || null;
      d.querySelector('[data-treino]').hidden = estado !== 'treino';
      if (estado !== 'treino') return { estado };
      return { estado, tempo: d.querySelector('[name^="tempo-"]:checked')?.value || null,
        modalidades: [...d.querySelectorAll('input[type="checkbox"]:checked')].map(m => m.value) };
    });
  }
  el.addEventListener('change', e => {
    if (e.target.type === 'checkbox' && e.target.checked) {
      for (const input of e.target.closest('[data-dia]').querySelectorAll('input[type="checkbox"]:checked')) {
        if (input !== e.target && [input.value, e.target.value].includes('Sem preferência')) input.checked = false;
      }
    }
    atualizar();
  });
  el.querySelector('[data-todos]').onclick = () => {
    dias.forEach(d => { d.querySelector('input[value="treino"]').checked = true; });
    atualizar();
  };
}

/* ════════ WIRING PERGUNTAS + GRAVAÇÃO ════════ */
function _wirePergunta(p) {
  const el = document.querySelector('.q[data-id="' + p.id + '"]');
  if (!el) return;
  if (p.tipo === 'semana_treino') return _wireSemanaTreino(el, p.id);

  if (p.tipo === 'texto_curto') {
    const input = el.querySelector('.q-input, .q-textarea');
    input.addEventListener('blur', function () { _gravarResposta(p.id, input.value); });
    return;
  }

  if (p.tipo === 'numero') {
    const input = el.querySelector('.q-input');
    input.addEventListener('blur', function () {
      if (p.inteiro) {
        input.setCustomValidity('');
        const n = Number(input.value);
        if (input.validity.badInput || (input.value !== '' && (!Number.isInteger(n) || (p.min != null && n < p.min) || (p.max != null && n > p.max)))) {
          input.setCustomValidity('Indique um número inteiro de minutos entre ' + p.min + ' e ' + p.max + ', ou deixe em branco.');
          input.reportValidity();
          return;
        }
      }
      _gravarResposta(p.id, input.value === '' ? null : parseFloat(input.value));
    });
    return;
  }

  if (p.tipo === 'dropdown') {
    const sel = el.querySelector('select');
    sel.addEventListener('change', function () { _gravarResposta(p.id, sel.value || null); });
    return;
  }

  if (p.tipo === 'escala') {
    el.querySelectorAll('.seg').forEach(function (seg) {
      seg.addEventListener('click', function () {
        const v = parseInt(seg.dataset.v, 10);
        el.querySelectorAll('.seg').forEach(function (s) { s.classList.toggle('on', parseInt(s.dataset.v, 10) <= v); });
        el.querySelector('.escala-val').textContent = v;
        _gravarResposta(p.id, v);
      });
    });
    return;
  }

  if (p.tipo === 'grelha') {
    el.querySelectorAll('.grelha-linha').forEach(function (linhaEl) {
      const linhaId = linhaEl.dataset.linha;
      linhaEl.querySelectorAll('.grelha-cell').forEach(function (btn) {
        btn.addEventListener('click', function () {
          linhaEl.querySelectorAll('.grelha-cell').forEach(function (b) { b.classList.remove('sel'); });
          btn.classList.add('sel');
          const atual = Object.assign({}, _valorAtual(p.id) || {});
          atual[linhaId] = btn.dataset.v;
          _gravarResposta(p.id, atual);
        });
      });
    });
    return;
  }

  if (p.tipo === 'escolha_unica' || p.tipo === 'escolha_multipla') {
    const multi = p.tipo === 'escolha_multipla';
    const outroInput = el.querySelector('.q-outro');

    function coletar() {
      const sel = Array.from(el.querySelectorAll('.choice-item.sel')).map(function (b) { return b.dataset.v; });
      if (p.outro) {
        const outroTexto = outroInput ? outroInput.value : '';
        return { v: multi ? sel : (sel[0] || null), outro_texto: outroTexto || null };
      }
      return multi ? sel : (sel[0] || null);
    }

    el.querySelectorAll('.choice-item').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const isOutro = btn.classList.contains('outro-toggle');
        if (multi) {
          btn.classList.toggle('sel');
          if (p.max) {
            const selCount = el.querySelectorAll('.choice-item.sel').length;
            if (selCount > p.max) btn.classList.remove('sel');
          }
        } else {
          const was = btn.classList.contains('sel');
          el.querySelectorAll('.choice-item').forEach(function (b) { b.classList.remove('sel'); });
          if (!was) btn.classList.add('sel');
        }
        if (outroInput) {
          const outroSel = !!el.querySelector('.outro-toggle.sel');
          outroInput.style.display = outroSel ? '' : 'none';
        }
        _gravarResposta(p.id, coletar());
      });
    });
    if (outroInput) outroInput.addEventListener('blur', function () { _gravarResposta(p.id, coletar()); });
    return;
  }
}

function _gravarResposta(questionId, valor) {
  _respostas[questionId] = valor;
  const sb = window.sb;
  if (!sb || !_token) return;
  sb.rpc('intake_gravar_resposta', { p_token: _token, p_question_id: questionId, p_answer: valor })
    .then(function (res) {
      if (!res || res.error || res.data !== true) { _avisarErroGravacao(); return; }
      _mostrarToast();
    });
}

function _mostrarToast() {
  const t = document.getElementById('toast');
  if (!t) return;
  t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(function () { t.classList.remove('show'); }, 1600);
}

function _avisarErroGravacao() {
  const el = document.getElementById('intake-erro-gravacao');
  if (el) { el.classList.add('show'); return; }
  const div = document.createElement('div');
  div.id = 'intake-erro-gravacao';
  div.className = 'alerta-falha show';
  div.textContent = '⚠ Não foi possível gravar esta resposta. Verifique a ligação e tente novamente.';
  document.body.appendChild(div);
  setTimeout(function () { div.classList.remove('show'); }, 3500);
}
