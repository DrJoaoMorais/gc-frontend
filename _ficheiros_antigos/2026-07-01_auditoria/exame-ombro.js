/**
 * exame-ombro.js · Módulo ES6 autónomo
 * Renderiza o exame objectivo do ombro como string HTML.
 * Sem dependências externas — funciona em qualquer contexto de módulo.
 */

const OMB_ROM_NORMAL = { flex: 180, ext: 60, abd: 180, re: 90, ri: 90 };
const OMB_ROM_ORDEM = [
  { ch: 'flex', rot: 'Flexão' },
  { ch: 'ext',  rot: 'Extensão' },
  { ch: 'abd',  rot: 'Abdução' },
  { ch: 're',   rot: 'Rotação externa' },
  { ch: 'ri',   rot: 'Rotação interna' },
];
const OMB_MRC_ORDEM = [
  { ch: 'sup', rot: 'Flexão' },
  { ch: 'inf', rot: 'Abdução' },
  { ch: 'sub', rot: 'Rotação interna' },
  { ch: 'del', rot: 'Rotação externa' },
  { ch: 'ext', rot: 'Extensão' },
];
const OMB_PALP_ORDEM = [
  { ch: 'ac',  rot: 'Articulação AC' },
  { ch: 'tb',  rot: 'Tubérculo maior' },
  { ch: 'bic', rot: 'Sulco bicipital' },
  { ch: 'bur', rot: 'Bursa subacromial' },
  { ch: 'sup', rot: 'Supra-espinhoso' },
];
const OMB_FUNC_ORDEM = [
  { ch: 'elev', rot: 'Elevação acima da cabeça' },
  { ch: 'cos',  rot: 'Alcançar costas' },
  { ch: 'vest', rot: 'Vestir camisola' },
  { ch: 'prof', rot: 'Actividade profissional' },
  { ch: 'desp', rot: 'Actividade desportiva' },
  { ch: 'cond', rot: 'Conduzir' },
];
const OMB_TESTES_ORDEM = [
  { ch: 'neer',    rot: 'Neer' },
  { ch: 'hawk',    rot: 'Hawkins' },
  { ch: 'jobe',    rot: 'Jobe' },
  { ch: 'patte',   rot: 'Patte' },
  { ch: 'liftoff', rot: 'Lift-off' },
  { ch: 'belly',   rot: 'Belly press' },
  { ch: 'drop',    rot: 'Drop arm' },
  { ch: 'speed',   rot: 'Speed' },
  { ch: 'yerg',    rot: 'Yergason' },
  { ch: 'appr',    rot: 'Apprehension' },
  { ch: 'reloc',   rot: 'Relocation' },
  { ch: 'sulc',    rot: 'Sulcus' },
];
const OMB_DYN_ORDEM = [
  { ch: 'flex', rot: 'Flexão' },
  { ch: 'ext',  rot: 'Extensão' },
  { ch: 'abd',  rot: 'Abdução' },
  { ch: 'adu',  rot: 'Adução' },
  { ch: 're',   rot: 'Rotação externa' },
  { ch: 'ri',   rot: 'Rotação interna' },
];

function _esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])
  );
}
function _tem(v) { return v != null && v !== ''; }
function _formatData(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${dt.getDate()} ${meses[dt.getMonth()]} ${dt.getFullYear()}`;
}

function _corMRC(v) {
  const n = parseInt(String(v), 10);
  if (isNaN(n)) return '';
  if (n >= 5) return 'cc-v-verde';
  if (n >= 4) return 'cc-v-ambar';
  return 'cc-v-vermelho';
}
function _corAchado(v) {
  const s = String(v).toLowerCase();
  if (s.includes('sem dor') || s === 'normal') return 'cc-v-verde';
  if (s.includes('dificuldade')) return 'cc-v-ambar';
  if (s.includes('dor') || s === 'impossível') return 'cc-v-vermelho';
  return '';
}
function _corTeste(v) {
  const n = (String(v).match(/\+/g) || []).length;
  if (n >= 3) return 'cc-v-vermelho';
  if (n === 2) return 'cc-v-ambar';
  if (n === 1) return 'cc-v-verde';
  return '';
}
function _corAssim(abs) {
  if (abs < 10) return 'cc-v-verde';
  if (abs <= 20) return 'cc-v-ambar';
  return 'cc-v-vermelho';
}
function _defCor(def, norm) {
  if (def <= 0) return 'cc-v-verde';
  const pct = norm ? (def / norm) * 100 : 100;
  return pct < 30 ? 'cc-v-ambar' : 'cc-v-vermelho';
}
function _barCor(pct) {
  return pct >= 75 ? '#166534' : pct >= 50 ? '#92400e' : '#991b1b';
}

function _chips(d) {
  const chips = [];
  if (_tem(d.tipo_dor)) chips.push(`<span class="cc-omb-chip">Dor ${_esc(String(d.tipo_dor).toLowerCase())}</span>`);
  const loc = Array.isArray(d.localizacao_dor) ? d.localizacao_dor : (_tem(d.localizacao_dor) ? [d.localizacao_dor] : []);
  if (loc.length) chips.push(`<span class="cc-omb-chip">${loc.map(x => _esc(String(x).toLowerCase())).join(' · ')}</span>`);
  if (_tem(d.irradiacao)) chips.push(`<span class="cc-omb-chip">Irradia ${_esc(String(d.irradiacao).toLowerCase())}</span>`);
  const eva = d.eva || {};
  if (_tem(eva.rep) || _tem(eva.act) || _tem(eva.pic)) {
    const p = [];
    if (_tem(eva.rep)) p.push(`repouso ${_esc(eva.rep)}`);
    if (_tem(eva.act)) p.push(`actividade ${_esc(eva.act)}`);
    if (_tem(eva.pic)) p.push(`pico ${_esc(eva.pic)}`);
    chips.push(`<span class="cc-omb-chip cc-omb-chip-eva">EVA: ${p.join(' · ')}</span>`);
  }
  if (!chips.length) return '';
  return `<div class="cc-omb-chips">${chips.join('')}</div>`;
}

function _chipsAchados(rotulo, obj, ordem) {
  if (!obj) return '';
  const itens = ordem
    .filter(o => _tem(obj[o.ch]))
    .map(o => `<span class="cc-omb-item">${_esc(o.rot)} <span class="cc-omb-item-val ${_corAchado(obj[o.ch])}">· ${_esc(String(obj[o.ch]).toLowerCase())}</span></span>`);
  if (!itens.length) return '';
  return `<div class="cc-omb-seccao"><p class="cc-omb-rotulo">${rotulo}</p><div class="cc-omb-itens">${itens.join('')}</div></div>`;
}

function _mrc(mrc) {
  if (!mrc) return '';
  const itens = OMB_MRC_ORDEM
    .filter(o => _tem(mrc[o.ch]))
    .map(o => `<span class="cc-omb-item">${_esc(o.rot)} <strong class="cc-omb-item-val ${_corMRC(mrc[o.ch])}">${_esc(mrc[o.ch])}</strong></span>`);
  if (!itens.length) return '';
  return `<div class="cc-omb-seccao"><p class="cc-omb-rotulo">Força muscular (MRC)</p><div class="cc-omb-itens">${itens.join('')}</div></div>`;
}

function _rom(rom) {
  if (!rom) return '';
  const linhas = OMB_ROM_ORDEM.map(o => {
    const a = rom[`${o.ch}_a`];
    const p = rom[`${o.ch}_p`];
    if (!_tem(a) && !_tem(p)) return null;
    const norm = OMB_ROM_NORMAL[o.ch];
    const nA = _tem(a) ? Number(a) : null;
    const nP = _tem(p) ? Number(p) : null;
    const deltaAP = (nA != null && nP != null) ? (nA - nP) : null;
    const defice  = (nP != null && norm) ? (norm - nP) : null;
    const corDef  = defice != null ? _defCor(defice, norm) : '';
    const deltaStr = deltaAP != null
      ? (deltaAP === 0 ? '0°' : (deltaAP > 0 ? '+' + deltaAP + '°' : deltaAP + '°'))
      : '—';
    return `<tr>
      <td>${_esc(o.rot)}</td>
      <td class="cc-omb-td-forte">${nA != null ? nA + '°' : '—'}</td>
      <td class="cc-omb-td-tenue">${nP != null ? nP + '°' : '—'}</td>
      <td class="cc-omb-td-tenue">${deltaStr}</td>
      <td class="cc-omb-td-tenue">${norm}°</td>
      <td class="cc-omb-td-forte ${corDef}">${defice != null ? (defice <= 0 ? '0°' : '−' + defice + '°') : '—'}</td>
    </tr>`;
  }).filter(Boolean);
  if (!linhas.length) return '';
  return `<div class="cc-omb-seccao"><p class="cc-omb-rotulo">Amplitude articular</p>
    <table class="cc-omb-tabela">
      <thead><tr><th>Movimento</th><th>Activa</th><th>Passiva</th><th>Δ A−P</th><th>Ref.</th><th>Défice s/ ref.</th></tr></thead>
      <tbody>${linhas.join('')}</tbody>
    </table></div>`;
}

function _testes(testes) {
  if (!testes) return '';
  const GRUPOS = [
    { sub: 'Conflito', chs: ['neer','hawk'] },
    { sub: 'Coifa',    chs: ['jobe','patte','liftoff','belly','drop'] },
    { sub: 'Bicípite', chs: ['speed','yerg'] },
    { sub: 'Instab.',  chs: ['appr','reloc','sulc'] },
  ];
  const ROT = Object.fromEntries(OMB_TESTES_ORDEM.map(o => [o.ch, o.rot]));
  const grupos = GRUPOS.map(g => {
    const tags = g.chs
      .filter(ch => _tem(testes[ch]))
      .map(ch => {
        const val = testes[ch];
        return `<span class="cc-omb-tag ${_corTeste(val)}">${_esc(ROT[ch] || ch)} <strong>${_esc(val)}</strong></span>`;
      });
    if (!tags.length) return '';
    return `<div class="cc-omb-teste-grupo"><span class="cc-omb-teste-sub">${g.sub}</span>${tags.join('')}</div>`;
  }).filter(Boolean);
  if (!grupos.length) return '';
  return `<div class="cc-omb-seccao"><p class="cc-omb-rotulo">Testes especiais</p><div class="cc-omb-testes-grid">${grupos.join('')}</div></div>`;
}

function _dyn(dyn) {
  if (!dyn) return '';
  const linhas = OMB_DYN_ORDEM.map(o => {
    const m = dyn[o.ch];
    if (!m || (!_tem(m.e) && !_tem(m.d))) return null;
    let assim = '—', corAssim = '';
    if (_tem(m.e) && _tem(m.d) && Number(m.e) !== 0) {
      const pct = ((Number(m.d) - Number(m.e)) / Number(m.e)) * 100;
      const abs = Math.abs(pct);
      const ladoFraco = pct < 0 ? 'D' : (pct > 0 ? 'E' : null);
      corAssim = _corAssim(abs);
      assim = ladoFraco ? `${Math.round(abs)}% · ${ladoFraco} mais fraco` : 'simétrico';
    }
    return `<tr>
      <td>${_esc(o.rot)}</td>
      <td>${_tem(m.e) ? _esc(m.e) : '—'}</td>
      <td>${_tem(m.d) ? _esc(m.d) : '—'}</td>
      <td class="cc-omb-td-forte ${corAssim}">${assim}</td>
    </tr>`;
  }).filter(Boolean);
  if (!linhas.length) return '';
  return `<div class="cc-omb-seccao"><p class="cc-omb-rotulo">Dinamometria <span class="cc-omb-rotulo-norm">(ActivForce 2)</span></p>
    <table class="cc-omb-tabela">
      <thead><tr><th>Movimento</th><th>Esq. (kg)</th><th>Dir. (kg)</th><th>Assimetria</th></tr></thead>
      <tbody>${linhas.join('')}</tbody>
    </table></div>`;
}

function _escalas(escalas) {
  if (!escalas) return '';
  const oss = escalas.oss_score, ases = escalas.ases_score, dash = escalas.dash_score;
  if (!_tem(oss) && !_tem(ases) && !_tem(dash)) return '';
  const _faixaOSS = (n) => {
    if (n >= 40) return 'Excelente (40–48)';
    if (n >= 30) return 'Bom (30–39)';
    if (n >= 20) return 'Moderado (20–29)';
    return 'Fraco (<20)';
  };
  const cartoes = [];
  if (_tem(dash)) {
    const n = Number(dash);
    cartoes.push(`<div class="cc-omb-escala-card">
      <div class="cc-omb-escala-head"><span class="cc-omb-escala-nome">QuickDASH</span><span class="cc-omb-escala-valor">${n}<span class="cc-omb-escala-max">/100</span></span></div>
      <div class="cc-omb-escala-bar-wrap"><div class="cc-omb-escala-bar" style="width:${Math.round(n)}%;background:#991b1b;"></div></div>
      <div class="cc-omb-escala-faixa">MCID ~10 pts · 0 = sem incapacidade</div>
    </div>`);
  }
  if (_tem(ases)) {
    const n = Number(ases);
    cartoes.push(`<div class="cc-omb-escala-card">
      <div class="cc-omb-escala-head"><span class="cc-omb-escala-nome">ASES</span><span class="cc-omb-escala-valor">${n}<span class="cc-omb-escala-max">/100</span></span></div>
      <div class="cc-omb-escala-bar-wrap"><div class="cc-omb-escala-bar" style="width:${Math.round(n)}%;background:${_barCor(n)};"></div></div>
      <div class="cc-omb-escala-faixa">Normativo ~92 · 100 = função total</div>
    </div>`);
  }
  if (_tem(oss)) {
    const n = Number(oss), pct = Math.round((n / 48) * 100);
    cartoes.push(`<div class="cc-omb-escala-card">
      <div class="cc-omb-escala-head"><span class="cc-omb-escala-nome">OSS</span><span class="cc-omb-escala-valor">${n}<span class="cc-omb-escala-max">/48</span></span></div>
      <div class="cc-omb-escala-bar-wrap"><div class="cc-omb-escala-bar" style="width:${pct}%;background:${_barCor(pct)};"></div></div>
      <div class="cc-omb-escala-faixa">${_faixaOSS(n)}</div>
    </div>`);
  }
  return `<div class="cc-omb-seccao"><p class="cc-omb-rotulo">Escalas funcionais</p><div class="cc-omb-escalas-grid">${cartoes.join('')}</div></div>`;
}

export function renderOmbro(ex, idx = 0) {
  const d = ex.data || {};
  const ladoTxt = d.lado ? ` ${_esc(d.lado).toLowerCase()}` : (ex.assessment_side ? ` ${_esc(ex.assessment_side)}` : '');
  const data = _formatData(ex.assessment_date);

  let corpo = ''
    + _chips(d)
    + _chipsAchados('Palpação', d.palp, OMB_PALP_ORDEM)
    + _rom(d.rom)
    + _mrc(d.mrc)
    + _dyn(d.dyn)
    + _testes(d.testes)
    + _chipsAchados('Funcional', d.func, OMB_FUNC_ORDEM)
    + _escalas(d.escalas);

  if (!corpo.trim()) corpo = `<p class="cc-vazio">Exame de ombro sem campos preenchidos.</p>`;

  return `<div class="cc-exame-registo">
    <div class="cc-omb-cabec">
      <span class="cc-omb-titulo">Exame objectivo — ombro${ladoTxt}</span>
      <span class="cc-omb-data">${data}</span>
      ${idx > 0 ? '<span class="cc-exame-nota">registo anterior</span>' : ''}
    </div>
    ${corpo}
  </div>`;
}
