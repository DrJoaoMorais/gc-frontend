/* motor.js — motor genérico exame objectivo. Config de ./configs/<r>.js */

const REGIOES = ['cotovelo'];

let _motorCfg = null;
let _romState = {};
let _romConfig = null;

/* ════════ ENTRY ════════ */
(async function () {
  const qp = new URLSearchParams(location.search);
  const r = qp.get('r') || '';
  if (!REGIOES.includes(r)) {
    document.body.innerHTML = '<p style="padding:20px;color:#dc2626;font-weight:600">Região inválida: ' + r + '</p>';
    return;
  }
  const config = (await import('./configs/' + r + '.js')).default;
  window._examCtx = { patientId: qp.get('p') || null, clinicId: qp.get('c') || null, consultationId: qp.get('s') || null };
  _motorCfg = config;
  _renderPage(config);
})();

/* ════════ RENDER ════════ */
function _renderPage(cfg) {
  const hdr = document.getElementById('hdr');
  if (hdr) hdr.innerHTML =
    '<h1>' + (cfg.emoji ? cfg.emoji + ' ' : '') + cfg.titulo + '</h1>' +
    '<div class="subtitle">' + cfg.subtitle + '</div>';

  if (cfg.lado) {
    const slot = document.getElementById('lado-bar-slot');
    if (slot) slot.innerHTML =
      '<div class="lado-bar">' +
        '<span class="lado-bar-lbl">' + cfg.lado.label + '</span>' +
        '<div class="opts sg" id="lado">' +
          '<div class="opt" data-v="Direito">D</div>' +
          '<div class="opt" data-v="Esquerdo">E</div>' +
          '<div class="opt" data-v="Bilateral">Bilateral</div>' +
        '</div>' +
      '</div>';
  }

  const tabsSlot = document.getElementById('tabs-slot');
  if (tabsSlot) {
    let h = '<div class="ob-tabs"><button class="ob-tab active" data-tab="exame">🦴 Exame Objectivo</button>';
    if (cfg.tabs && cfg.tabs.dinamometria) h += '<button class="ob-tab" data-tab="dinamometria">📈 Dinamometria</button>';
    if (cfg.tabs && cfg.tabs.escalas) h += '<button class="ob-tab" data-tab="escalas">📊 Escalas Funcionais</button>';
    tabsSlot.innerHTML = h + '</div>';
  }

  const tabExame = document.getElementById('tab-exame');
  if (tabExame) {
    let leftH = '', rightH = '';
    let sNum = 0;
    cfg.seccoes.forEach(function (sec) {
      sNum++;
      const h = _renderSec(sec, sNum);
      if (sec.tipo === 'rom' || sec.tipo === 'testes') rightH += h;
      else leftH += h;
    });
    tabExame.innerHTML = '<div class="two-col"><div class="col-scroll">' + leftH + '</div><div class="col-scroll">' + rightH + '</div></div>';
  }

  if (cfg.tabs && cfg.tabs.dinamometria) {
    const el = document.getElementById('tab-dinamometria');
    if (el) el.innerHTML = _renderDin(cfg.dinamometria);
  }
  if (cfg.tabs && cfg.tabs.escalas) {
    const el = document.getElementById('tab-escalas');
    if (el) el.innerHTML = _renderEscalas(cfg.escalas);
  }

  _wireHandlers(cfg);
}

/* ── SECTION DISPATCH ── */
function _renderSec(sec, n) {
  switch (sec.tipo) {
    case 'dor':    return _renderDor(sec, n);
    case 'params': return _renderParams(sec, n);
    case 'mrc':    return _renderMrc(sec, n);
    case 'func':   return _renderFunc(sec, n);
    case 'rom':    return _renderRom(sec, n);
    case 'testes': return _renderTestes(sec, n);
    default: return '';
  }
}

function _renderDor(sec, n) {
  let h = '<div class="sec"><div class="sec-title">' + n + ' · ' + sec.titulo + '</div>';
  sec.eva.forEach(function (e) {
    h += '<div class="eva-row"><span class="eva-lbl">' + e.label + '</span><div class="eva-btns opts sg" id="' + e.id + '">';
    for (let v = 0; v <= 10; v++) h += '<div class="opt" data-v="' + v + '">' + v + '</div>';
    h += '</div></div>';
  });
  sec.grupos.forEach(function (g) {
    h += '<div class="gl">' + g.label + '</div>';
    h += '<div class="opts ' + (g.multi ? 'mg' : 'sg') + '" id="' + g.id + '">';
    g.opts.forEach(function (o) {
      const v = typeof o === 'string' ? o : o.v;
      const lbl = typeof o === 'string' ? o : o.lbl;
      h += '<div class="opt" data-v="' + v + '">' + lbl + '</div>';
    });
    h += '</div>';
  });
  return h + '</div>';
}

function _renderParams(sec, n) {
  let h = '<div class="sec"><div class="sec-title">' + n + ' · ' + sec.titulo + '</div>';
  sec.rows.forEach(function (row) {
    h += '<div class="palp-row"><div class="palp-lbl">' + row.label + '</div><div class="opts sg" id="' + row.id + '">';
    row.opts.forEach(function (o) {
      const v = typeof o === 'string' ? o : o.v;
      const lbl = typeof o === 'string' ? o : o.lbl;
      h += '<div class="opt" data-v="' + v + '">' + lbl + '</div>';
    });
    h += '</div></div>';
  });
  if (sec.notas) h += '<textarea id="' + sec.notas + '" placeholder="Notas…"></textarea>';
  return h + '</div>';
}

function _renderMrc(sec, n) {
  let h = '<div class="sec"><div class="sec-title">' + n + ' · ' + sec.titulo + '</div>';
  sec.rows.forEach(function (row) {
    h += '<div class="mrc-row"><div class="mrc-lbl">' + row.label + '</div><div class="opts sg" id="' + row.id + '">' +
         ['0/5','1/5','2/5','3/5','4/5','5/5'].map(function(v){return '<div class="opt" data-v="'+v+'">'+v+'</div>';}).join('') +
         '</div></div>';
  });
  if (sec.notas) h += '<textarea id="' + sec.notas + '" placeholder="Notas sobre força…"></textarea>';
  return h + '</div>';
}

function _renderFunc(sec, n) {
  let h = '<div class="sec"><div class="sec-title">' + n + ' · ' + sec.titulo + '</div>';
  sec.rows.forEach(function (row) {
    h += '<div class="func-row"><div class="func-lbl">' + row.label + '</div><div class="opts sg" id="' + row.id + '">';
    sec.opts.forEach(function (o) { h += '<div class="opt" data-v="' + o + '">' + o + '</div>'; });
    h += '</div></div>';
  });
  return h + '</div>';
}

function _renderRom(sec, n) {
  sec.movimentos.forEach(function (m) { _romState[m.key] = { a: null, p: null }; });
  _romConfig = sec;
  let h = '<div class="sec">';
  h += '<div class="sec-title" style="display:flex;justify-content:space-between;align-items:center">' +
       n + ' · ' + sec.titulo +
       '<button onclick="window._romFillNormal()" style="font-size:10px;padding:3px 9px;border:1px solid #1a56db;border-radius:5px;background:#fff;color:#1a56db;cursor:pointer;font-weight:600;">Amplitudes normais</button>' +
       '</div>';
  h += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">' +
       '<thead style="background:#0f2d52"><tr>' +
       '<th style="color:white;padding:8px;text-align:left;font-weight:500;font-size:11px">Movimento</th>' +
       '<th style="color:#93c5fd;padding:8px;font-weight:500;font-size:11px">Activo °</th>' +
       '<th style="color:#86efac;padding:8px;font-weight:500;font-size:11px">Passivo °</th>' +
       '<th style="color:white;padding:8px;font-weight:500;font-size:11px">Dif A–P</th>' +
       '<th style="color:white;padding:8px;font-weight:500;font-size:11px">Normal °</th>' +
       '<th style="color:white;padding:8px;font-weight:500;font-size:11px">% Normal</th>' +
       '<th style="color:white;padding:8px;font-weight:500;font-size:11px">Défice activo</th>' +
       '<th style="color:white;padding:8px;font-weight:500;font-size:11px">Défice passivo</th>' +
       '</tr></thead><tbody id="rom-tbody"></tbody></table></div>';
  if (sec.notas) h += '<textarea id="' + sec.notas + '" placeholder="End-feel, dor em arco, crepitação…"></textarea>';
  return h + '</div>';
}

function _renderTestes(sec, n) {
  let h = '<div class="sec"><div class="sec-title">' + n + ' · ' + sec.titulo + '</div>';
  sec.grupos.forEach(function (g) {
    h += '<div class="sub-lbl">' + g.sub + '</div>';
    g.testes.forEach(function (t) {
      h += '<div class="teste-row"><div class="teste-lbl">' + t.label + '</div><div class="opts sg grade" id="' + t.id + '">';
      sec.grade.forEach(function (gv) {
        h += '<div class="opt" data-v="' + gv + '">' + (gv === 'Negativo' ? 'Neg' : gv) + '</div>';
      });
      h += '</div></div>';
    });
  });
  if (sec.notas) h += '<textarea id="' + sec.notas + '" placeholder="Notas sobre testes…"></textarea>';
  return h + '</div>';
}

/* ── ROM ── */
function _romRenderTable() {
  const tb = document.getElementById('rom-tbody');
  if (!tb || !_romConfig) return;
  tb.innerHTML = _romConfig.movimentos.map(function (m) {
    const s = _romState[m.key] || { a: null, p: null };
    const aC = (s.a !== null && m.normal > 0 && s.a / m.normal < 0.85) ? '#e53e3e' : '#1a56db';
    const dAP = (s.a !== null && s.p !== null) ? s.a - s.p : null;
    const dAPStr = dAP !== null ? (dAP > 0 ? '+' + dAP + '°' : dAP + '°') : '—';
    const dAPColor = dAP === null ? '#94a3b8' : Math.abs(dAP) < 2 ? '#64748b' : dAP < 0 ? '#e53e3e' : '#805ad5';
    const pct = (s.a !== null && m.normal > 0) ? Math.round(s.a / m.normal * 100) : null;
    const pctCell = pct === null ? '<td style="text-align:center;color:#94a3b8">—</td>' :
      pct < 85 ? '<td style="text-align:center;color:#e53e3e;font-weight:600">' + pct + '%</td>' :
      pct < 95 ? '<td style="text-align:center;color:#d97706;font-weight:500">' + pct + '%</td>' :
                 '<td style="text-align:center;color:#38a169;font-weight:500">' + pct + '%</td>';
    const dA = (s.a !== null && m.normal > 0) ? m.normal - s.a : null;
    const dP = (s.p !== null && m.normal > 0) ? m.normal - s.p : null;
    function fD(v) {
      if (v === null) return '<td style="color:#94a3b8;text-align:center">—</td>';
      if (v <= 0) return '<td style="color:#38a169;font-weight:500;text-align:center">' + v + '°</td>';
      return '<td style="color:#e53e3e;font-weight:500;text-align:center">+' + v + '°</td>';
    }
    return '<tr>' +
      '<td style="font-weight:500">' + m.label + (m.nota ? ' <span style="font-size:9px;color:#94a3b8">(' + m.nota + ')</span>' : '') + '</td>' +
      '<td style="text-align:center"><input type="number" min="' + m.min + '" max="' + m.max + '" step="1"' +
        ' value="' + (s.a !== null ? s.a : '') + '" placeholder="—"' +
        ' style="width:52px;text-align:center;font-size:12px;font-weight:600;color:' + aC + ';border:0.5px solid ' + aC + '44;border-radius:4px;padding:2px 4px;background:transparent"' +
        ' data-key="' + m.key + '" data-field="a"' +
        ' onchange="window.romSv(this.dataset.key,this.dataset.field,this.value===\'\'?null:+this.value)"></td>' +
      '<td style="text-align:center"><input type="number" min="' + m.min + '" max="' + m.max + '" step="1"' +
        ' value="' + (s.p !== null ? s.p : '') + '" placeholder="—"' +
        ' style="width:52px;text-align:center;font-size:12px;font-weight:600;color:#38a169;border:0.5px solid #38a16944;border-radius:4px;padding:2px 4px;background:transparent"' +
        ' data-key="' + m.key + '" data-field="p"' +
        ' onchange="window.romSv(this.dataset.key,this.dataset.field,this.value===\'\'?null:+this.value)"></td>' +
      '<td style="color:' + dAPColor + ';font-weight:500;text-align:center">' + dAPStr + '</td>' +
      '<td style="text-align:center;color:#64748b">' + (m.normal > 0 ? m.normal + '°' : '0°') + '</td>' +
      (m.normal > 0 ? pctCell : '<td style="text-align:center;color:#94a3b8">—</td>') +
      fD(dA) + fD(dP) +
      '</tr>';
  }).join('');
}

window.romSv = function (key, field, val) {
  if (!_romState[key]) _romState[key] = { a: null, p: null };
  _romState[key][field] = val;
  _romRenderTable();
};
window.romGetState = function (key) { return _romState[key] || null; };
window._romFillNormal = function () {
  if (!_romConfig) return;
  _romConfig.movimentos.forEach(function (m) { _romState[m.key] = { a: m.normal, p: m.normal }; });
  _romRenderTable();
};

/* ── DINAMOMETRIA ── */
function _renderDin(dynCfg) {
  let h = '<div class="sec"><div class="sec-title">Dinamometria Manual</div>';
  h += '<table class="dyn-table"><thead><tr>' +
       '<th>Movimento</th><th>Afetado</th><th>Contralateral</th><th>Défice E/D</th>' +
       '</tr></thead><tbody>';
  dynCfg.movimentos.forEach(function (m) {
    h += '<tr><td>' + m.label + '</td>' +
         '<td><input class="dyn-inp" type="number" min="0" max="999" step="0.1" id="dyn_' + m.key + '_af" placeholder="—" oninput="window._dynRecalc(\'' + m.key + '\')"></td>' +
         '<td><input class="dyn-inp" type="number" min="0" max="999" step="0.1" id="dyn_' + m.key + '_cl" placeholder="—" oninput="window._dynRecalc(\'' + m.key + '\')"></td>' +
         '<td id="dyn_' + m.key + '_def">—</td></tr>';
  });
  h += '</tbody></table>';
  if (dynCfg.racios && dynCfg.racios.length) {
    h += '<div style="margin-top:14px"><div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Rácios</div>';
    h += '<table class="dyn-table"><thead><tr><th>Rácio</th><th>Afetado</th><th>Contralateral</th><th>Referência</th></tr></thead><tbody>';
    dynCfg.racios.forEach(function (rc) {
      h += '<tr><td>' + rc.label + '</td>' +
           '<td id="ratio_' + rc.num + '_' + rc.den + '_af">—</td>' +
           '<td id="ratio_' + rc.num + '_' + rc.den + '_cl">—</td>' +
           '<td>' + (rc.ref === null ? '<span style="color:#94a3b8;font-size:10px">referência por definir</span>' : rc.ref) + '</td></tr>';
    });
    h += '</tbody></table></div>';
  }
  return h + '</div>';
}

window._dynRecalc = function (key) {
  const afEl = document.getElementById('dyn_' + key + '_af');
  const clEl = document.getElementById('dyn_' + key + '_cl');
  const defEl = document.getElementById('dyn_' + key + '_def');
  if (!defEl) return;
  const af = afEl && afEl.value !== '' ? parseFloat(afEl.value) : null;
  const cl = clEl && clEl.value !== '' ? parseFloat(clEl.value) : null;
  defEl.innerHTML = (af !== null && cl !== null && cl !== 0) ? _defTag((cl - af) / cl * 100) : '—';
  if (!_motorCfg || !_motorCfg.dinamometria) return;
  _motorCfg.dinamometria.racios.forEach(function (rc) {
    function getRatioVal(side) {
      const nEl = document.getElementById('dyn_' + rc.num + '_' + side);
      const dEl = document.getElementById('dyn_' + rc.den + '_' + side);
      const nv = nEl && nEl.value !== '' ? parseFloat(nEl.value) : null;
      const dv = dEl && dEl.value !== '' ? parseFloat(dEl.value) : null;
      return (nv !== null && dv !== null && dv !== 0) ? nv / dv * 100 : null;
    }
    const elAf = document.getElementById('ratio_' + rc.num + '_' + rc.den + '_af');
    const elCl = document.getElementById('ratio_' + rc.num + '_' + rc.den + '_cl');
    if (elAf) elAf.innerHTML = _ratioTag(getRatioVal('af'), rc.ref);
    if (elCl) elCl.innerHTML = _ratioTag(getRatioVal('cl'), rc.ref);
  });
};

function _defTag(pct) {
  const abs = Math.abs(pct);
  const col = abs < 10 ? '#3b6d11' : abs <= 15 ? '#854f0b' : '#a32d2d';
  const bg  = abs < 10 ? '#eaf3de' : abs <= 15 ? '#faeeda' : '#fcebeb';
  return '<span style="display:inline-block;padding:2px 7px;border-radius:4px;font-size:11px;font-weight:500;background:' + bg + ';color:' + col + ';">' + (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%</span>';
}

function _ratioTag(val, ref) {
  if (val === null) return '<span style="color:#94a3b8">—</span>';
  const str = val.toFixed(0) + '%';
  if (ref === null) return '<span style="color:#94a3b8;font-size:11px">' + str + ' <em style="font-size:10px">(ref. por definir)</em></span>';
  return '<span style="font-size:11px">' + str + '</span>';
}

/* ── ESCALAS ── */
function _renderEscalas(escalas) {
  return escalas.map(function (esc) {
    let h = '<div class="scale-block" id="scale-' + esc.id + '">';
    h += '<div class="scale-title">' + esc.titulo + '</div>';
    h += '<div class="scale-score-row"><div class="scale-score" id="' + esc.id + '_score">—</div></div>';
    h += '<div class="scale-legend">' + esc.legend + '</div>';
    esc.itens.forEach(function (item, i) {
      h += '<div class="sq-row"><span class="sq-num">' + (i + 1) + '</span><span class="sq-lbl">' + item + '</span><div class="sq-opts">';
      for (let v = esc.optMin; v <= esc.optMax; v++) h += '<div class="sq-opt" data-v="' + v + '">' + v + '</div>';
      h += '</div></div>';
    });
    return h + '</div>';
  }).join('');
}

function _wireEscalas(escalas) {
  document.querySelectorAll('.sq-row').forEach(function (row) {
    row.querySelectorAll('.sq-opt').forEach(function (btn) {
      btn.addEventListener('click', function () {
        row.querySelectorAll('.sq-opt').forEach(function (b) { b.classList.remove('sel'); });
        btn.classList.add('sel');
        const block = btn.closest('.scale-block');
        if (block) block.dispatchEvent(new Event('recalc'));
      });
    });
  });
  escalas.forEach(function (esc) {
    const el = document.getElementById('scale-' + esc.id);
    if (!el) return;
    el.addEventListener('recalc', function () {
      const vals = [];
      this.querySelectorAll('.sq-row').forEach(function (row) {
        const s = row.querySelector('.sq-opt.sel');
        vals.push(s ? parseInt(s.dataset.v) : null);
      });
      const filled = vals.filter(function (v) { return v !== null; });
      const scoreEl = document.getElementById(esc.id + '_score');
      if (!scoreEl) return;
      if (!filled.length) { scoreEl.textContent = '—'; return; }
      let score;
      if (esc.score === 'dash') {
        const sum = filled.reduce(function (a, b) { return a + b; }, 0);
        score = Math.round((sum - filled.length) / (filled.length * 4) * 100);
      } else {
        score = filled.reduce(function (a, b) { return a + b; }, 0);
      }
      scoreEl.textContent = score;
    });
  });
}

/* ── WIRE HANDLERS ── */
function _wireHandlers(cfg) {
  document.querySelectorAll('.ob-tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.ob-tab').forEach(function (b) { b.classList.remove('active'); });
      document.querySelectorAll('.ob-tab-content').forEach(function (c) { c.classList.remove('active'); });
      btn.classList.add('active');
      const t = document.getElementById('tab-' + btn.dataset.tab);
      if (t) t.classList.add('active');
    });
  });
  document.querySelectorAll('.opts.sg').forEach(function (grp) {
    grp.querySelectorAll('.opt').forEach(function (btn) {
      btn.addEventListener('click', function () {
        grp.querySelectorAll('.opt').forEach(function (b) { b.classList.remove('sel'); });
        btn.classList.add('sel');
      });
    });
  });
  document.querySelectorAll('.opts.mg').forEach(function (grp) {
    grp.querySelectorAll('.opt').forEach(function (btn) {
      btn.addEventListener('click', function () { btn.classList.toggle('sel'); });
    });
  });
  if (cfg.seccoes.find(function (s) { return s.tipo === 'rom'; })) _romRenderTable();
  if (cfg.tabs && cfg.tabs.escalas) _wireEscalas(cfg.escalas);

  const btnPdf = document.getElementById('btnPdf');
  if (btnPdf) btnPdf.addEventListener('click', function () { window.print(); });
  const btnCopy = document.getElementById('btnCopy');
  if (btnCopy) btnCopy.addEventListener('click', async function () {
    const btn = this;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'A guardar…';
    const txt = typeof window._gerarResumo === 'function' ? window._gerarResumo() : '';
    const toast = document.getElementById('toast');
    try { await navigator.clipboard.writeText(txt); } catch (e) {}
    const dataObj = typeof window._gerarData === 'function' ? window._gerarData() : {};
    if (window._saveExamToSupabase) await window._saveExamToSupabase(txt, dataObj);
    btn.disabled = false;
    btn.textContent = originalText;
    if (toast) { toast.classList.add('show'); setTimeout(function () { toast.classList.remove('show'); }, 2200); }
  });
}

/* ════════ gerarData ════════ */
window._gerarData = function () {
  const cfg = _motorCfg;
  if (!cfg) return {};
  function g(id) { const el = document.getElementById(id); if (!el) return null; const s = el.querySelector('.opt.sel'); return s ? s.dataset.v : null; }
  function mg(id) { const el = document.getElementById(id); if (!el) return []; return Array.from(el.querySelectorAll('.opt.sel')).map(function (b) { return b.dataset.v; }); }
  function rs(id) { const el = document.getElementById(id); return el ? (el.value.trim() || null) : null; }
  function rv(id) { const el = document.getElementById(id); return el && el.value !== '' ? parseFloat(el.value) : null; }

  const ladoEl = document.querySelector('#lado .opt.sel');
  const data = { lado: ladoEl ? ladoEl.dataset.v : null };

  cfg.seccoes.forEach(function (sec) {
    switch (sec.tipo) {
      case 'dor':
        data.eva = {};
        sec.eva.forEach(function (e) { data.eva[e.id.replace('eva_', '')] = g(e.id); });
        sec.grupos.forEach(function (gr) { data[gr.id] = gr.multi ? mg(gr.id) : g(gr.id); });
        break;
      case 'params':
      case 'mrc':
      case 'func': {
        const obj = {};
        sec.rows.forEach(function (row) { obj[row.id] = g(row.id); });
        data[sec.id] = obj;
        if (sec.notas) data[sec.notas] = rs(sec.notas);
        break;
      }
      case 'rom': {
        const romObj = {};
        sec.movimentos.forEach(function (m) {
          const s = window.romGetState(m.key);
          romObj[m.key + '_a'] = s ? s.a : null;
          romObj[m.key + '_p'] = s ? s.p : null;
        });
        data.rom = romObj;
        if (sec.notas) data[sec.notas] = rs(sec.notas);
        break;
      }
      case 'testes': {
        const tObj = {};
        sec.grupos.forEach(function (grp) {
          grp.testes.forEach(function (t) { tObj[t.id] = g(t.id); });
        });
        data.testes = tObj;
        if (sec.notas) data[sec.notas] = rs(sec.notas);
        break;
      }
    }
  });

  if (cfg.dinamometria) {
    const dyn = {};
    cfg.dinamometria.movimentos.forEach(function (m) {
      dyn[m.key] = { af: rv('dyn_' + m.key + '_af'), cl: rv('dyn_' + m.key + '_cl') };
    });
    data.dyn = dyn;
  }

  if (cfg.escalas) {
    const esc = {};
    cfg.escalas.forEach(function (e) {
      const scoreEl = document.getElementById(e.id + '_score');
      const raw = scoreEl ? scoreEl.textContent : '—';
      esc[e.id + '_score'] = raw !== '—' ? parseInt(raw) : null;
      const items = [];
      const block = document.getElementById('scale-' + e.id);
      if (block) block.querySelectorAll('.sq-row').forEach(function (row) {
        const s = row.querySelector('.sq-opt.sel'); items.push(s ? parseInt(s.dataset.v) : null);
      });
      esc[e.id + '_items'] = items;
    });
    data.escalas = esc;
  }
  return data;
};

/* ════════ gerarResumo ════════ */
window._gerarResumo = function () {
  const cfg = _motorCfg;
  if (!cfg) return '';
  const linhas = [];
  const ladoEl = document.querySelector('#lado .opt.sel');
  const ladoTxt = ladoEl ? ladoEl.dataset.v.toUpperCase() : '';
  linhas.push('── ' + cfg.titulo.toUpperCase() + ' ' + ladoTxt + ' — EXAME OBJECTIVO ──');

  cfg.seccoes.forEach(function (sec) {
    switch (sec.tipo) {
      case 'dor': {
        const evaStr = [];
        sec.eva.forEach(function (e) {
          const el = document.querySelector('#' + e.id + ' .opt.sel');
          if (el) evaStr.push(e.label + ' ' + el.dataset.v);
        });
        if (evaStr.length) linhas.push('EVA: ' + evaStr.join(' | '));
        sec.grupos.forEach(function (gr) {
          if (gr.multi) {
            const vals = Array.from(document.querySelectorAll('#' + gr.id + ' .opt.sel')).map(function (b) { return b.dataset.v; });
            if (vals.length) linhas.push(gr.label + ': ' + vals.join(', '));
          } else {
            const el = document.querySelector('#' + gr.id + ' .opt.sel');
            if (el) linhas.push(gr.label + ': ' + el.dataset.v);
          }
        });
        break;
      }
      case 'params': {
        linhas.push('');
        linhas.push(sec.titulo.toUpperCase());
        sec.rows.forEach(function (row) {
          const el = document.querySelector('#' + row.id + ' .opt.sel');
          if (el) linhas.push('  ' + row.label + ': ' + el.dataset.v);
        });
        const nota = sec.notas ? document.getElementById(sec.notas) : null;
        if (nota && nota.value.trim()) linhas.push('  Notas: ' + nota.value.trim());
        break;
      }
      case 'mrc': {
        linhas.push('');
        linhas.push('FORÇA MRC');
        sec.rows.forEach(function (row) {
          const el = document.querySelector('#' + row.id + ' .opt.sel');
          if (el) linhas.push('  ' + row.label + ': ' + el.dataset.v);
        });
        const notaF = sec.notas ? document.getElementById(sec.notas) : null;
        if (notaF && notaF.value.trim()) linhas.push('  Notas: ' + notaF.value.trim());
        break;
      }
      case 'func': {
        linhas.push('');
        linhas.push('FUNCIONAL');
        sec.rows.forEach(function (row) {
          const el = document.querySelector('#' + row.id + ' .opt.sel');
          if (el && el.dataset.v !== 'Normal') linhas.push('  ' + row.label + ': ' + el.dataset.v);
        });
        break;
      }
      case 'rom': {
        linhas.push('');
        linhas.push('AMPLITUDE ARTICULAR');
        sec.movimentos.forEach(function (m) {
          const s = window.romGetState(m.key);
          if (!s || (s.a === null && s.p === null)) return;
          const va = s.a !== null ? s.a + '°' : '—';
          const vp = s.p !== null ? s.p + '°' : '—';
          linhas.push('  ' + m.label + ': A ' + va + ' / P ' + vp + (m.normal > 0 ? ' (ref ' + m.normal + '°)' : ''));
        });
        const notaM = sec.notas ? document.getElementById(sec.notas) : null;
        if (notaM && notaM.value.trim()) linhas.push('  Notas: ' + notaM.value.trim());
        break;
      }
      case 'testes': {
        linhas.push('');
        linhas.push('TESTES CLÍNICOS ESPECIAIS');
        sec.grupos.forEach(function (grp) {
          grp.testes.forEach(function (t) {
            const el = document.querySelector('#' + t.id + ' .opt.sel');
            if (el && el.dataset.v !== 'Negativo') linhas.push('  ' + t.label + ': ' + el.dataset.v);
          });
        });
        const notaT = sec.notas ? document.getElementById(sec.notas) : null;
        if (notaT && notaT.value.trim()) linhas.push('  Notas: ' + notaT.value.trim());
        break;
      }
    }
  });

  if (cfg.dinamometria) {
    linhas.push('');
    linhas.push('DINAMOMETRIA');
    cfg.dinamometria.movimentos.forEach(function (m) {
      const afEl = document.getElementById('dyn_' + m.key + '_af');
      const clEl = document.getElementById('dyn_' + m.key + '_cl');
      const af = afEl && afEl.value !== '' ? parseFloat(afEl.value) : null;
      const cl = clEl && clEl.value !== '' ? parseFloat(clEl.value) : null;
      if (af === null && cl === null) return;
      let linha = '  ' + m.label + ':';
      if (af !== null) linha += ' AF ' + af.toFixed(1) + ' kg';
      if (cl !== null) linha += ' / CL ' + cl.toFixed(1) + ' kg';
      if (af !== null && cl !== null && cl !== 0) linha += ' (défice ' + ((cl - af) / cl * 100).toFixed(1) + '%)';
      linhas.push(linha);
    });
  }

  if (cfg.escalas) {
    linhas.push('');
    linhas.push('-- ESCALAS FUNCIONAIS --');
    cfg.escalas.forEach(function (esc) {
      const scoreEl = document.getElementById(esc.id + '_score');
      if (!scoreEl || scoreEl.textContent === '—') return;
      const maxStr = esc.score === 'dash' ? '/100' : '/' + (esc.optMax * esc.itens.length);
      linhas.push(esc.titulo + ': ' + scoreEl.textContent + maxStr);
      const block = document.getElementById('scale-' + esc.id);
      if (block) block.querySelectorAll('.sq-row').forEach(function (row) {
        const lbl = row.querySelector('.sq-lbl');
        const sel = row.querySelector('.sq-opt.sel');
        if (lbl && sel) linhas.push('  - ' + lbl.textContent.trim() + ': ' + sel.textContent.trim());
      });
    });
  }

  linhas.push('────────────────────────────────────────');
  return linhas.join('\n');
};

/* ════════ saveExam ════════ */
window._saveExamToSupabase = async function (txt, dataObj) {
  const c = window._examCtx || {};
  if (!c.consultationId) return;
  try {
    const sb = window.opener && window.opener.sb;
    if (!sb) return;
    const userRes = await sb.auth.getUser();
    const authorId = userRes && userRes.data && userRes.data.user ? userRes.data.user.id : null;
    const payload = Object.assign({ resumo: txt }, dataObj || {});
    const lado = dataObj && dataObj.lado ? dataObj.lado : null;
    const res = await sb.from('consultation_assessments').insert({
      consultation_id: c.consultationId,
      patient_id: c.patientId,
      clinic_id: c.clinicId,
      author_user_id: authorId,
      assessment_type: _motorCfg ? _motorCfg.id : 'unknown',
      assessment_side: lado,
      assessment_date: new Date().toISOString().split('T')[0],
      data: payload
    });
    if (res.error) console.error('saveExam:', res.error);
  } catch (e) {
    console.error('saveExam:', e);
  }
};
