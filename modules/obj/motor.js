/* motor.js — motor genérico exame objectivo. Config de ./configs/<r>.js */

const REGIOES = ['cotovelo', 'ombro'];

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
  const config = (await import('./configs/' + r + '.js?v=1')).default;
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
      if (sec.col === 'dir' || sec.tipo === 'rom' || sec.tipo === 'testes') rightH += h;
      else leftH += h;
    });
    tabExame.innerHTML = '<div class="two-col"><div class="col-scroll">' + leftH + '</div><div class="col-scroll">' + rightH + '</div></div>';
  }

  if (cfg.tabs && cfg.tabs.dinamometria) {
    const el = document.getElementById('tab-dinamometria');
    if (el) el.innerHTML = cfg.dinamometria.af2 ? _renderDinAF2(cfg.dinamometria) : _renderDin(cfg.dinamometria);
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
    case 'grupos': return _renderGrupos(sec, n);
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

function _renderGrupos(sec, n) {
  let h = '<div class="sec" id="sec-' + sec.id + '"><div class="sec-title">' + n + ' · ' + sec.label + '</div>';
  sec.grupos.forEach(function (g) {
    h += '<div class="gl">' + g.label + '</div>';
    h += '<div class="opts ' + (g.tipo === 'sg' ? 'sg' : 'mg') + '" data-key="' + g.key + '">';
    g.opcoes.forEach(function (op) {
      h += '<div class="opt" data-v="' + op + '">' + op + '</div>';
    });
    h += '</div>';
  });
  if (sec.perimetria) {
    h += '<div style="overflow-x:auto;margin-top:10px"><table style="width:100%;border-collapse:collapse;font-size:12px">' +
         '<thead style="background:#0f2d52"><tr>' +
         '<th style="color:white;padding:6px 8px;text-align:left;font-weight:500;font-size:11px">Nível</th>' +
         '<th style="color:#93c5fd;padding:6px 8px;font-weight:500;font-size:11px">D (cm)</th>' +
         '<th style="color:#86efac;padding:6px 8px;font-weight:500;font-size:11px">E (cm)</th>' +
         '<th style="color:white;padding:6px 8px;font-weight:500;font-size:11px">Δ</th>' +
         '</tr></thead><tbody>';
    sec.perimetria.niveis.forEach(function (nv) {
      h += '<tr>' +
           '<td style="font-weight:500;padding:4px 8px">' + nv.label + '</td>' +
           '<td style="text-align:center;padding:4px 6px"><input type="number" step="0.5" min="0" max="99" placeholder="—"' +
           ' style="width:56px;text-align:center;font-size:12px;border:0.5px solid #93c5fd44;border-radius:4px;padding:2px 4px;background:transparent"' +
           ' id="perim_' + sec.id + '_' + nv.key + '_d" onchange="window._perimCalc(\'' + sec.id + '\',\'' + nv.key + '\')"></td>' +
           '<td style="text-align:center;padding:4px 6px"><input type="number" step="0.5" min="0" max="99" placeholder="—"' +
           ' style="width:56px;text-align:center;font-size:12px;border:0.5px solid #86efac44;border-radius:4px;padding:2px 4px;background:transparent"' +
           ' id="perim_' + sec.id + '_' + nv.key + '_e" onchange="window._perimCalc(\'' + sec.id + '\',\'' + nv.key + '\')"></td>' +
           '<td style="text-align:center;padding:4px 6px;color:#64748b" id="perim_' + sec.id + '_' + nv.key + '_delta">—</td>' +
           '</tr>';
    });
    h += '</tbody></table></div>';
  }
  if (sec.notasKey) h += '<textarea id="' + sec.notasKey + '" placeholder="' + (sec.notasPlaceholder || '') + '"></textarea>';
  return h + '</div>';
}

window._perimCalc = function (secId, key) {
  const dEl = document.getElementById('perim_' + secId + '_' + key + '_d');
  const eEl = document.getElementById('perim_' + secId + '_' + key + '_e');
  const deltaEl = document.getElementById('perim_' + secId + '_' + key + '_delta');
  if (!deltaEl) return;
  const d = dEl && dEl.value !== '' ? parseFloat(dEl.value) : null;
  const e = eEl && eEl.value !== '' ? parseFloat(eEl.value) : null;
  deltaEl.textContent = (d !== null && e !== null) ? (d - e).toFixed(1) : '—';
};

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
function _interpScore(esc, score) {
  if (!esc.interp || !esc.interp.length) return '';
  if (esc.score === 'dash') {
    for (var i = 0; i < esc.interp.length; i++) {
      if (score <= esc.interp[i].threshold) return esc.interp[i].txt;
    }
  } else {
    for (var i = 0; i < esc.interp.length; i++) {
      if (score >= esc.interp[i].threshold) return esc.interp[i].txt;
    }
  }
  return '';
}

function _renderEscalas(escalas) {
  return escalas.map(function (esc) {
    let h = '<div class="scale-block" id="scale-' + esc.id + '">';
    h += '<div class="scale-title">' + esc.titulo + '</div>';
    if (esc.desc) h += '<div class="scale-desc">' + esc.desc + '</div>';
    h += '<div class="scale-score-row">' +
         '<div class="scale-score" id="' + esc.id + '_score">—</div>' +
         '<div class="scale-interp" id="' + esc.id + '_interp"></div>' +
         '</div>';
    if (esc.evaInput) {
      h += '<div class="ases-eva-row">' +
           '<span class="ases-eva-lbl">' + esc.evaInput.label + '</span>' +
           '<input class="ases-eva-inp" type="number" id="' + esc.evaInput.id + '"' +
           ' min="' + esc.evaInput.min + '" max="' + esc.evaInput.max + '"' +
           ' step="' + esc.evaInput.step + '" placeholder="—">' +
           '<span style="font-size:10px;color:#94a3b8;">0 = sem dor &nbsp;·&nbsp; 10 = dor máxima</span>' +
           '</div>';
    }
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
    if (esc.evaInput) {
      const evaEl = document.getElementById(esc.evaInput.id);
      if (evaEl) evaEl.addEventListener('input', function () {
        const block = document.getElementById('scale-' + esc.id);
        if (block) block.dispatchEvent(new Event('recalc'));
      });
    }
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
      const interpEl = document.getElementById(esc.id + '_interp');
      if (!scoreEl) return;

      if (esc.score === 'ases') {
        const evaEl = esc.evaInput ? document.getElementById(esc.evaInput.id) : null;
        const evaVal = evaEl && evaEl.value !== '' ? parseFloat(evaEl.value) : null;
        if (evaVal === null || isNaN(evaVal)) {
          scoreEl.textContent = '—';
          if (interpEl) interpEl.textContent = 'componente de dor em falta';
          return;
        }
        const pain = (10 - evaVal) * 5;
        const func = filled.length ? (filled.reduce(function (a, b) { return a + b; }, 0) / 30) * 50 : 0;
        const score = Math.round(pain + func);
        scoreEl.textContent = score + '/100';
        if (interpEl) interpEl.textContent = '';
        return;
      }

      if (!filled.length) {
        scoreEl.textContent = '—';
        if (interpEl) interpEl.textContent = '';
        return;
      }
      const sum = filled.reduce(function (a, b) { return a + b; }, 0);
      let score;
      if (esc.score === 'dash') {
        score = Math.round((sum - filled.length) / (filled.length * 4) * 100);
      } else {
        score = sum;
      }
      scoreEl.textContent = score;
      if (interpEl) interpEl.textContent = _interpScore(esc, score);
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
  if (cfg.dinamometria && cfg.dinamometria.af2) _wireDinAF2(cfg.dinamometria);

  const btnPdf = document.getElementById('btnPdf');
  if (btnPdf) btnPdf.addEventListener('click', function () { window.print(); });
  const btnCopy = document.getElementById('btnCopy');
  if (btnCopy) btnCopy.addEventListener('click', async function () {
    const btn = this;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'A guardar…';
    if (_motorCfg && _motorCfg.lado && !document.querySelector('#lado .opt.sel')) {
      const av = document.getElementById('aviso-lateral');
      if (av) av.style.display = 'flex';
    }
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
      case 'grupos': {
        const bloco = {};
        sec.grupos.forEach(function (g) {
          const wrap = document.querySelector('#sec-' + sec.id + ' [data-key="' + g.key + '"]');
          if (!wrap) return;
          if (g.tipo === 'sg') {
            const sel = wrap.querySelector('.opt.sel');
            bloco[g.key] = sel ? sel.dataset.v : null;
          } else {
            bloco[g.key] = Array.from(wrap.querySelectorAll('.opt.sel')).map(function (c) { return c.dataset.v; });
          }
        });
        if (sec.perimetria) {
          const perimObj = {};
          sec.perimetria.niveis.forEach(function (nv) {
            const dEl = document.getElementById('perim_' + sec.id + '_' + nv.key + '_d');
            const eEl = document.getElementById('perim_' + sec.id + '_' + nv.key + '_e');
            const d = dEl && dEl.value !== '' ? parseFloat(dEl.value) : null;
            const e = eEl && eEl.value !== '' ? parseFloat(eEl.value) : null;
            if (d !== null || e !== null) perimObj[nv.key] = { d: d, e: e };
          });
          if (Object.keys(perimObj).length) bloco.perimetria = perimObj;
        }
        const notasEl = sec.notasKey ? document.getElementById(sec.notasKey) : null;
        const notasVal = notasEl ? notasEl.value.trim() : '';
        if (notasVal) data[sec.notasKey] = notasVal;
        const temDados = Object.values(bloco).some(function (v) {
          return v !== null && !(Array.isArray(v) && v.length === 0);
        });
        if (temDados) data[sec.id] = bloco;
        break;
      }
    }
  });

  if (cfg.dinamometria && cfg.dinamometria.af2) {
    data.dyn = window._dynData || {};
  } else if (cfg.dinamometria) {
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
      case 'grupos': {
        const notasEl = sec.notasKey ? document.getElementById(sec.notasKey) : null;
        const notas = notasEl ? notasEl.value.trim() : '';
        const temAlgo = sec.grupos.some(function (g) {
          return document.querySelector('#sec-' + sec.id + ' [data-key="' + g.key + '"] .opt.sel');
        });
        const temPerim = sec.perimetria && sec.perimetria.niveis.some(function (nv) {
          const dEl = document.getElementById('perim_' + sec.id + '_' + nv.key + '_d');
          const eEl = document.getElementById('perim_' + sec.id + '_' + nv.key + '_e');
          return (dEl && dEl.value !== '') || (eEl && eEl.value !== '');
        });
        if (!temAlgo && !temPerim && !notas) break;
        linhas.push('\n' + sec.label.toUpperCase());
        sec.grupos.forEach(function (g) {
          const wrap = document.querySelector('#sec-' + sec.id + ' [data-key="' + g.key + '"]');
          if (!wrap) return;
          if (g.tipo === 'sg') {
            const sel = wrap.querySelector('.opt.sel');
            if (sel) linhas.push('  ' + g.label + ': ' + sel.dataset.v);
          } else {
            const vals = Array.from(wrap.querySelectorAll('.opt.sel')).map(function (c) { return c.dataset.v; });
            if (vals.length) linhas.push('  ' + g.label + ': ' + vals.join(', '));
          }
        });
        if (sec.perimetria) {
          sec.perimetria.niveis.forEach(function (nv) {
            const dEl = document.getElementById('perim_' + sec.id + '_' + nv.key + '_d');
            const eEl = document.getElementById('perim_' + sec.id + '_' + nv.key + '_e');
            const d = dEl && dEl.value !== '' ? parseFloat(dEl.value) : null;
            const e = eEl && eEl.value !== '' ? parseFloat(eEl.value) : null;
            if (d === null && e === null) return;
            let parte = '  ' + nv.label + ':';
            if (d !== null) parte += ' D ' + d.toFixed(1) + ' cm';
            if (e !== null) parte += ' / E ' + e.toFixed(1) + ' cm';
            if (d !== null && e !== null) parte += ' (Δ ' + (d - e).toFixed(1) + ' cm)';
            linhas.push(parte);
          });
        }
        if (notas) linhas.push('  Notas: ' + notas);
        break;
      }
    }
  });

  if (cfg.dinamometria && cfg.dinamometria.af2) {
    linhas.push('');
    linhas.push('DINAMOMETRIA (ActivForce 2)');
    const _dyn = window._dynData || {};
    cfg.dinamometria.movimentos.forEach(function (m) {
      const d = _dyn[m.key];
      if (!d) return;
      const vals = [];
      if (d.e !== null && d.e !== undefined) vals.push('E ' + d.e.toFixed(1) + ' kg');
      if (d.d !== null && d.d !== undefined) vals.push('D ' + d.d.toFixed(1) + ' kg');
      if (!vals.length) return;
      let linha = '  ' + m.label + ': ' + vals.join(' / ');
      if (d.e !== null && d.d !== null && d.d !== 0) {
        const def = (d.e - d.d) / d.d * 100;
        linha += ' (défice ' + (def >= 0 ? '+' : '') + def.toFixed(1) + '%)';
      }
      if (d.fpe !== null && d.fpe !== undefined && d.fpd !== null && d.fpd !== undefined) {
        linha += ' · F/P E ' + d.fpe.toFixed(1) + '% / D ' + d.fpd.toFixed(1) + '%';
      } else if (d.fpe !== null && d.fpe !== undefined) {
        linha += ' · F/P E ' + d.fpe.toFixed(1) + '%';
      } else if (d.fpd !== null && d.fpd !== undefined) {
        linha += ' · F/P D ' + d.fpd.toFixed(1) + '%';
      }
      linhas.push(linha);
    });
    cfg.dinamometria.racios.forEach(function (rc) {
      const nd = _dyn[rc.num] ? _dyn[rc.num].d : null;
      const dd = _dyn[rc.den] ? _dyn[rc.den].d : null;
      const rD = (nd !== null && dd !== null && dd !== 0) ? nd / dd * 100 : null;
      const ne = _dyn[rc.num] ? _dyn[rc.num].e : null;
      const de = _dyn[rc.den] ? _dyn[rc.den].e : null;
      const rE = (ne !== null && de !== null && de !== 0) ? ne / de * 100 : null;
      const refStr = rc.refMin !== null ? ' (ref ≥ ' + rc.refMin + '%)' : '';
      if (rD !== null) linhas.push('  Ratio ' + rc.label + ' (D): ' + rD.toFixed(0) + '%' + refStr);
      if (rE !== null) linhas.push('  Ratio ' + rc.label + ' (E): ' + rE.toFixed(0) + '%' + refStr);
    });
  } else if (cfg.dinamometria) {
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

/* ════════ AF2 dinamometria ════════ */
function _renderDinAF2(dynCfg) {
  let h = '<div class="sec"><div class="sec-title">Importar dados ActivForce 2</div>';
  h += '<div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:12px;">' +
       '<textarea id="af2_raw" placeholder="Colar texto exportado do ActivForce 2 (Copy Data)…"' +
       ' style="flex:1;min-width:0;height:72px;font-size:12px;padding:8px;border:1px solid #e2e8f0;border-radius:6px;resize:vertical;box-sizing:border-box;"></textarea>' +
       '<button id="btn_af2_import"' +
       ' style="padding:8px 14px;background:#1a56db;color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer;white-space:nowrap;font-weight:500;">Importar AF2</button>' +
       '</div>';
  h += '<div id="dyn_doente_bar" style="display:none;padding:9px 12px;background:#f8fafc;border:0.5px solid #e2e8f0;border-radius:8px;font-size:12px;color:#64748b;margin-bottom:12px;"></div>';
  h += '</div>';

  h += '<div class="sec" id="dyn_results_sec" style="display:none;">';

  // Metric cards
  const rc0 = dynCfg.racios && dynCfg.racios.length ? dynCfg.racios[0] : null;
  const rc0Ref = rc0 && rc0.refMin !== null ? '≥ ' + rc0.refMin + '%' : '';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-bottom:14px;">';
  h += '<div style="background:#f8fafc;border-radius:8px;padding:11px 13px;"><div style="font-size:11px;color:#64748b;margin-bottom:3px;">Maior força</div>' +
       '<div id="dyn_m1_val" style="font-size:14px;font-weight:500;color:#0f172a;">—</div></div>';
  h += '<div style="background:#f8fafc;border-radius:8px;padding:11px 13px;"><div style="font-size:11px;color:#64748b;margin-bottom:3px;">Maior défice</div>' +
       '<div id="dyn_m2_val" style="font-size:14px;font-weight:500;color:#0f172a;">—</div>' +
       '<div id="dyn_m2_sub" style="font-size:11px;color:#64748b;margin-top:2px;">—</div></div>';
  h += '<div style="background:#f8fafc;border-radius:8px;padding:11px 13px;"><div style="font-size:11px;color:#64748b;margin-bottom:3px;">Ratio ' + (rc0 ? rc0.label : '') + '</div>' +
       '<div id="dyn_m3_val" style="font-size:14px;font-weight:500;color:#0f172a;">—</div>' +
       '<div style="font-size:11px;color:#64748b;margin-top:2px;">Ref ' + rc0Ref + '</div>' +
       '<div style="height:4px;border-radius:2px;background:#e2e8f0;margin-top:5px;overflow:hidden;">' +
       '<div id="dyn_m3_bar" style="height:100%;border-radius:2px;background:#1a56db;width:0%;"></div></div></div>';
  h += '<div style="background:#f8fafc;border-radius:8px;padding:11px 13px;"><div style="font-size:11px;color:#64748b;margin-bottom:3px;">Assimetria global</div>' +
       '<div id="dyn_m4_val" style="font-size:14px;font-weight:500;color:#0f172a;">—</div>' +
       '<div style="font-size:11px;color:#64748b;margin-top:2px;">média bilateral</div>' +
       '<div style="height:4px;border-radius:2px;background:#e2e8f0;margin-top:5px;overflow:hidden;">' +
       '<div id="dyn_m4_bar" style="height:100%;border-radius:2px;background:#1a56db;width:0%;"></div></div></div>';
  h += '</div>';

  function fmaxTable() {
    let t = '<div style="background:#fff;border:0.5px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:10px;">' +
            '<div style="padding:9px 14px;background:#f8fafc;border-bottom:0.5px solid #e2e8f0;font-size:11px;font-weight:500;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">Força máxima (kg)</div>' +
            '<table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr>' +
            '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:500;color:#64748b;border-bottom:0.5px solid #e2e8f0;background:#f8fafc;width:22%;">Movimento</th>' +
            '<th style="padding:8px 10px;text-align:right;font-size:11px;font-weight:500;color:#1a56db;border-bottom:0.5px solid #e2e8f0;background:#f8fafc;">Esq. kg</th>' +
            '<th style="padding:8px 10px;text-align:right;font-size:11px;font-weight:500;color:#0f2d52;border-bottom:0.5px solid #e2e8f0;background:#f8fafc;">Dir. kg</th>' +
            '<th style="padding:8px 10px;text-align:right;font-size:11px;font-weight:500;color:#64748b;border-bottom:0.5px solid #e2e8f0;background:#f8fafc;">Défice</th>' +
            '<th style="padding:8px 10px;text-align:right;font-size:11px;font-weight:500;color:#64748b;border-bottom:0.5px solid #e2e8f0;background:#f8fafc;">F/P Esq</th>' +
            '<th style="padding:8px 10px;text-align:right;font-size:11px;font-weight:500;color:#64748b;border-bottom:0.5px solid #e2e8f0;background:#f8fafc;">F/P Dir</th>' +
            '</tr></thead><tbody>';
    dynCfg.movimentos.forEach(function (m, i) {
      const cs = 'padding:8px 10px;' + (i < dynCfg.movimentos.length - 1 ? 'border-bottom:0.5px solid #e2e8f0;' : '');
      t += '<tr>' +
           '<td style="' + cs + 'font-weight:500;">' + m.label + '</td>' +
           '<td style="' + cs + 'text-align:right;color:#1a56db;font-weight:500;" id="dm_' + m.key + '_e">—</td>' +
           '<td style="' + cs + 'text-align:right;color:#0f2d52;font-weight:500;" id="dm_' + m.key + '_d">—</td>' +
           '<td style="' + cs + 'text-align:right;" id="dm_' + m.key + '_def">—</td>' +
           '<td style="' + cs + 'text-align:right;font-size:11px;color:#64748b;" id="dm_' + m.key + '_fpe">—</td>' +
           '<td style="' + cs + 'text-align:right;font-size:11px;color:#64748b;" id="dm_' + m.key + '_fpd">—</td>' +
           '</tr>';
    });
    return t + '</tbody></table></div>';
  }

  function fmedTable() {
    let t = '<div style="background:#fff;border:0.5px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:10px;">' +
            '<div style="padding:9px 14px;background:#f8fafc;border-bottom:0.5px solid #e2e8f0;font-size:11px;font-weight:500;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">Força média (kg) · indicador de fadiga</div>' +
            '<table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr>' +
            '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:500;color:#64748b;border-bottom:0.5px solid #e2e8f0;background:#f8fafc;width:22%;">Movimento</th>' +
            '<th style="padding:8px 10px;text-align:right;font-size:11px;font-weight:500;color:#1a56db;border-bottom:0.5px solid #e2e8f0;background:#f8fafc;">Esq. kg</th>' +
            '<th style="padding:8px 10px;text-align:right;font-size:11px;font-weight:500;color:#0f2d52;border-bottom:0.5px solid #e2e8f0;background:#f8fafc;">Dir. kg</th>' +
            '<th style="padding:8px 10px;text-align:right;font-size:11px;font-weight:500;color:#64748b;border-bottom:0.5px solid #e2e8f0;background:#f8fafc;">Δ Máx→Méd Esq</th>' +
            '<th style="padding:8px 10px;text-align:right;font-size:11px;font-weight:500;color:#64748b;border-bottom:0.5px solid #e2e8f0;background:#f8fafc;">Δ Máx→Méd Dir</th>' +
            '</tr></thead><tbody>';
    dynCfg.movimentos.forEach(function (m, i) {
      const cs = 'padding:8px 10px;' + (i < dynCfg.movimentos.length - 1 ? 'border-bottom:0.5px solid #e2e8f0;' : '');
      t += '<tr>' +
           '<td style="' + cs + 'font-weight:500;">' + m.label + '</td>' +
           '<td style="' + cs + 'text-align:right;color:#1a56db;font-weight:500;" id="dm_' + m.key + '_me">—</td>' +
           '<td style="' + cs + 'text-align:right;color:#0f2d52;font-weight:500;" id="dm_' + m.key + '_md">—</td>' +
           '<td style="' + cs + 'text-align:right;font-size:11px;color:#64748b;" id="dm_' + m.key + '_dme">—</td>' +
           '<td style="' + cs + 'text-align:right;font-size:11px;color:#64748b;" id="dm_' + m.key + '_dmd">—</td>' +
           '</tr>';
    });
    return t + '</tbody></table></div>';
  }

  function raciosTable() {
    if (!dynCfg.racios || !dynCfg.racios.length) return '';
    let t = '<div style="background:#fff;border:0.5px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:10px;">' +
            '<div style="padding:9px 14px;background:#f8fafc;border-bottom:0.5px solid #e2e8f0;font-size:11px;font-weight:500;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">Ratios funcionais</div>' +
            '<table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr>' +
            '<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:500;color:#64748b;border-bottom:0.5px solid #e2e8f0;background:#f8fafc;width:28%;">Ratio</th>' +
            '<th style="padding:8px 10px;text-align:right;font-size:11px;font-weight:500;color:#64748b;border-bottom:0.5px solid #e2e8f0;background:#f8fafc;">Esquerda</th>' +
            '<th style="padding:8px 10px;text-align:right;font-size:11px;font-weight:500;color:#64748b;border-bottom:0.5px solid #e2e8f0;background:#f8fafc;">Direita</th>' +
            '<th style="padding:8px 10px;text-align:right;font-size:11px;font-weight:500;color:#64748b;border-bottom:0.5px solid #e2e8f0;background:#f8fafc;">Referência</th>' +
            '<th style="padding:8px 10px;text-align:right;font-size:11px;font-weight:500;color:#64748b;border-bottom:0.5px solid #e2e8f0;background:#f8fafc;">Interpretação</th>' +
            '</tr></thead><tbody>';
    dynCfg.racios.forEach(function (rc, i) {
      const cs = 'padding:8px 10px;' + (i < dynCfg.racios.length - 1 ? 'border-bottom:0.5px solid #e2e8f0;' : '');
      const refStr = rc.refMin !== null && rc.refMax !== null ? rc.refMin + '–' + rc.refMax + '%' :
                     rc.refMin !== null ? '≥ ' + rc.refMin + '%' : '—';
      t += '<tr>' +
           '<td style="' + cs + 'font-weight:500;">' + rc.label + '</td>' +
           '<td style="' + cs + 'text-align:right;" id="dm_ratio_' + rc.num + '_' + rc.den + '_e">—</td>' +
           '<td style="' + cs + 'text-align:right;" id="dm_ratio_' + rc.num + '_' + rc.den + '_d">—</td>' +
           '<td style="' + cs + 'text-align:right;font-size:11px;color:#64748b;">' + refStr + '</td>' +
           '<td style="' + cs + 'text-align:right;" id="dm_ratio_' + rc.num + '_' + rc.den + '_int">—</td>' +
           '</tr>';
    });
    return t + '</tbody></table></div>';
  }

  h += fmaxTable() + fmedTable() + raciosTable();
  h += '<div style="font-size:11px;color:#94a3b8;padding:4px 2px;display:flex;gap:14px;flex-wrap:wrap;">' +
       '<span>🟢 &lt;10% simétrico</span><span>🟡 10–20% ligeiro</span><span>🔴 &gt;20% significativo</span>' +
       (rc0 && rc0.refMin !== null ? '<span>Ratio ' + rc0.label + ' ref. ≥ ' + rc0.refMin + '%</span>' : '') +
       '</div>';
  h += '</div>';
  return h;
}

function _wireDinAF2(dynCfg) {
  const btn = document.getElementById('btn_af2_import');
  if (!btn) return;
  btn.addEventListener('click', function () {
    const raw = document.getElementById('af2_raw').value.trim();
    if (!raw) return;

    const data = {};
    dynCfg.movimentos.forEach(function (m) {
      data[m.key] = { e: null, d: null, me: null, md: null, fpe: null, fpd: null };
    });

    let nome = '', peso = null, idade = null, genero = '', dominante = '', dataExame = '';
    const lnome = raw.match(/^(.+)\n/); if (lnome) nome = lnome[1].trim();
    const lpeso = raw.match(/Peso:\s*([\d.]+)/); if (lpeso) peso = parseFloat(lpeso[1]);
    const lidade = raw.match(/Idade:\s*(\d+)/); if (lidade) idade = parseInt(lidade[1]);
    const lgen = raw.match(/G[eê]nero:\s*(\w+)/); if (lgen) genero = lgen[1];
    const ldom = raw.match(/Lado dominante:\s*(\w+)/); if (ldom) dominante = ldom[1];
    const ldata = raw.match(/(segunda|terça|quarta|quinta|sexta|sábado|domingo)[^,\n]*,\s*([^\n]+)/i);
    if (ldata) dataExame = ldata[2].trim();

    const barEl = document.getElementById('dyn_doente_bar');
    if (barEl) {
      const sep = '<span style="color:#cbd5e1;">·</span>';
      const bits = [];
      if (nome) bits.push('<strong style="color:#0f172a;">' + nome + '</strong>');
      if (genero) bits.push('<span>' + genero + '</span>');
      if (idade) bits.push('<span>' + idade + ' anos</span>');
      if (peso !== null && !isNaN(peso)) bits.push('<span>' + peso + ' kg</span>');
      if (dominante) bits.push('<span>Dominante: ' + dominante + ' ⭐</span>');
      barEl.style.display = 'flex'; barEl.style.gap = '8px'; barEl.style.flexWrap = 'wrap';
      barEl.innerHTML = bits.join(sep) + (dataExame ? '<span style="margin-left:auto;font-size:11px;color:#185fa5;">' + dataExame + '</span>' : '');
    }

    function normStr(s) {
      return s.toLowerCase()
        .replace(/[áàâã]/g, 'a').replace(/[éèê]/g, 'e').replace(/[íì]/g, 'i')
        .replace(/[óòôõ]/g, 'o').replace(/[úùû]/g, 'u').replace(/ç/g, 'c');
    }
    function getLineVal(block, label) {
      const ls = block.split('\n');
      for (let i = 0; i < ls.length; i++) {
        const l = ls[i].trim();
        if (l.indexOf(label + ':') === 0) { const n = parseFloat(l.slice(label.length + 1).trim()); return isNaN(n) ? null : n; }
      }
      return null;
    }

    const sections = raw.split(/====([^=]+)====/);
    const bilDone = {};
    for (let i = 1; i < sections.length; i += 2) {
      const title = sections[i].trim();
      const body = sections[i + 1] || '';
      if (title.indexOf('Esquerda') === -1 || title.indexOf('Direita') === -1) continue;
      let key = null;
      const normT = normStr(title);
      for (const kw of Object.keys(dynCfg.af2Map)) {
        if (normT.indexOf(normStr(kw)) !== -1) { key = dynCfg.af2Map[kw]; break; }
      }
      if (!key || bilDone[key]) continue;

      let fmIdx = body.indexOf('Força Máxima'); if (fmIdx < 0) fmIdx = body.indexOf('Forca Maxima');
      if (fmIdx >= 0) {
        let blk = body.slice(fmIdx);
        const nx = blk.indexOf('Tempo'); if (nx > 0) blk = blk.slice(0, nx);
        data[key].e = getLineVal(blk, 'Esquerda'); data[key].d = getLineVal(blk, 'Direita');
      }
      let medIdx = body.indexOf('Força Média'); if (medIdx < 0) medIdx = body.indexOf('Forca Media');
      if (medIdx >= 0) {
        let blk = body.slice(medIdx);
        const nx = blk.indexOf('Relação'); if (nx > 0) blk = blk.slice(0, nx);
        data[key].me = getLineVal(blk, 'Esquerda'); data[key].md = getLineVal(blk, 'Direita');
      }
      let fpIdx = body.indexOf('Relação Força-Peso'); if (fpIdx < 0) fpIdx = body.indexOf('Relacao Forca-Peso');
      if (fpIdx >= 0) {
        let blk = body.slice(fpIdx);
        const nx = blk.indexOf('===='); if (nx > 0) blk = blk.slice(0, nx);
        data[key].fpe = getLineVal(blk, 'Esquerda'); data[key].fpd = getLineVal(blk, 'Direita');
      }
      bilDone[key] = true;
    }

    window._dynData = data;
    _calcDynAF2(data, dynCfg);
    const sec = document.getElementById('dyn_results_sec');
    if (sec) sec.style.display = 'block';
  });
}

function _calcDynAF2(data, dynCfg) {
  function setCell(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val !== null ? val : '—';
  }
  function defTag(pct, lado) {
    if (pct === null) return '—';
    const abs = Math.abs(pct);
    const col = abs < 10 ? '#3b6d11' : abs <= 20 ? '#854f0b' : '#a32d2d';
    const bg  = abs < 10 ? '#eaf3de' : abs <= 20 ? '#faeeda' : '#fcebeb';
    const sinal = pct > 0 ? (lado === 'E' ? 'E' : 'D') + ' +' : pct < 0 ? (lado === 'E' ? 'E' : 'D') + ' ' : '';
    return '<span style="display:inline-block;padding:2px 7px;border-radius:4px;font-size:11px;font-weight:500;background:' + bg + ';color:' + col + ';">' + sinal + abs.toFixed(1) + '%</span>';
  }
  function ratioTag(val, refMin, refMax) {
    if (val === null) return '<span style="font-size:11px;color:#94a3b8;">—</span>';
    const pct = val.toFixed(0) + '%';
    if (refMin === null && refMax === null) return '<span style="font-size:11px;color:#94a3b8;">' + pct + ' <em style="font-size:10px">(informativo)</em></span>';
    if (refMax === null) {
      const ok = val >= refMin;
      return '<span style="display:inline-block;padding:2px 7px;border-radius:4px;font-size:11px;font-weight:500;background:' + (ok ? '#eaf3de' : '#fcebeb') + ';color:' + (ok ? '#3b6d11' : '#a32d2d') + ';">' + pct + '</span>';
    }
    const ok2 = val >= refMin && val <= refMax;
    return '<span style="display:inline-block;padding:2px 7px;border-radius:4px;font-size:11px;font-weight:500;background:' + (ok2 ? '#eaf3de' : '#faeeda') + ';color:' + (ok2 ? '#3b6d11' : '#854f0b') + ';">' + pct + '</span>';
  }

  dynCfg.movimentos.forEach(function (m) {
    const d = data[m.key] || {};
    const e = d.e !== undefined ? d.e : null;
    const di = d.d !== undefined ? d.d : null;
    const me = d.me !== undefined ? d.me : null;
    const md = d.md !== undefined ? d.md : null;
    const fpe = d.fpe !== undefined ? d.fpe : null;
    const fpd = d.fpd !== undefined ? d.fpd : null;

    setCell('dm_' + m.key + '_e', e !== null ? e.toFixed(1) : null);
    setCell('dm_' + m.key + '_d', di !== null ? di.toFixed(1) : null);

    let defPct = null;
    if (e !== null && di !== null) {
      const stronger = Math.max(e, di);
      defPct = stronger > 0 ? (Math.min(e, di) - stronger) / stronger * 100 : 0;
      defPct = Math.abs(defPct);
      defPct = e < di ? defPct : -defPct;
    }
    const defEl = document.getElementById('dm_' + m.key + '_def');
    if (defEl) {
      defEl.innerHTML = (e === null || di === null) ? '<span style="font-size:11px;color:#94a3b8;">unilateral</span>' : defTag(defPct, e < di ? 'D' : 'E');
    }

    setCell('dm_' + m.key + '_fpe', fpe !== null ? fpe.toFixed(1) + '%' : null);
    setCell('dm_' + m.key + '_fpd', fpd !== null ? fpd.toFixed(1) + '%' : null);
    setCell('dm_' + m.key + '_me', me !== null ? me.toFixed(1) : null);
    setCell('dm_' + m.key + '_md', md !== null ? md.toFixed(1) : null);
    const dme = (e !== null && me !== null && e !== 0) ? (me - e) / e * 100 : null;
    const dmd = (di !== null && md !== null && di !== 0) ? (md - di) / di * 100 : null;
    setCell('dm_' + m.key + '_dme', dme !== null ? dme.toFixed(0) + '%' : null);
    setCell('dm_' + m.key + '_dmd', dmd !== null ? dmd.toFixed(0) + '%' : null);
  });

  dynCfg.racios.forEach(function (rc) {
    function getR(lado) {
      const nv = data[rc.num] ? data[rc.num][lado] : null;
      const dv = data[rc.den] ? data[rc.den][lado] : null;
      return (nv !== null && dv !== null && dv !== 0) ? nv / dv * 100 : null;
    }
    const rE = getR('e'), rD = getR('d');
    const eEl = document.getElementById('dm_ratio_' + rc.num + '_' + rc.den + '_e');
    const dEl = document.getElementById('dm_ratio_' + rc.num + '_' + rc.den + '_d');
    const intEl = document.getElementById('dm_ratio_' + rc.num + '_' + rc.den + '_int');
    if (eEl) eEl.innerHTML = ratioTag(rE, rc.refMin, rc.refMax);
    if (dEl) dEl.innerHTML = ratioTag(rD, rc.refMin, rc.refMax);
    if (intEl) intEl.innerHTML = rc.refMin === null ? '<span style="font-size:11px;color:#94a3b8;">Informativo</span>' : ratioTag(rD !== null ? rD : rE, rc.refMin, rc.refMax);
  });

  // Metric 1: maior força
  let bestLabel = '—', bestVal = -1;
  dynCfg.movimentos.forEach(function (m) {
    const d = data[m.key]; if (!d) return;
    ['e', 'd'].forEach(function (lado) {
      const v = d[lado];
      if (v === null || v === undefined) return;
      if (v > bestVal) { bestVal = v; bestLabel = m.label + ' ' + (lado === 'e' ? 'E' : 'D') + ' · ' + v.toFixed(1) + ' kg'; }
    });
  });
  setCell('dyn_m1_val', bestLabel);

  // Metric 2: maior défice
  let worstPct = 0, worstLabel = '—', worstSub = '—';
  dynCfg.movimentos.forEach(function (m) {
    const d = data[m.key];
    if (!d || d.e === null || d.d === null || d.d === 0) return;
    const pct = Math.abs((d.e - d.d) / d.d * 100);
    if (pct > worstPct) {
      worstPct = pct;
      worstLabel = m.label + ' +' + pct.toFixed(0) + '%';
      worstSub = 'E ' + (d.e !== null ? d.e.toFixed(1) : '?') + ' vs D ' + (d.d !== null ? d.d.toFixed(1) : '?') + ' kg';
    }
  });
  const elM2 = document.getElementById('dyn_m2_val');
  if (elM2) { elM2.textContent = worstLabel; elM2.style.color = worstPct > 20 ? '#a32d2d' : worstPct > 10 ? '#854f0b' : '#3b6d11'; }
  setCell('dyn_m2_sub', worstSub);

  // Metric 3: rácio 0
  const rc0 = dynCfg.racios && dynCfg.racios.length ? dynCfg.racios[0] : null;
  if (rc0) {
    const nd = data[rc0.num], dd2 = data[rc0.den];
    const r0D = (nd && nd.d !== null && dd2 && dd2.d !== null && dd2.d !== 0) ? nd.d / dd2.d * 100 : null;
    const r0E = (nd && nd.e !== null && dd2 && dd2.e !== null && dd2.e !== 0) ? nd.e / dd2.e * 100 : null;
    const r0Val = r0D !== null ? r0D : r0E;
    const elM3 = document.getElementById('dyn_m3_val');
    if (elM3) { elM3.textContent = r0Val !== null ? r0Val.toFixed(0) + '%' : '—'; elM3.style.color = (r0Val !== null && rc0.refMin !== null && r0Val >= rc0.refMin) ? '#3b6d11' : '#a32d2d'; }
    const elM3b = document.getElementById('dyn_m3_bar');
    if (elM3b && r0Val !== null) elM3b.style.width = Math.min(r0Val, 100) + '%';
  }

  // Metric 4: assimetria global
  const defs = [];
  dynCfg.movimentos.forEach(function (m) {
    const d = data[m.key];
    if (!d || d.e === null || d.d === null || d.d === 0) return;
    defs.push(Math.abs((d.e - d.d) / d.d * 100));
  });
  const glob = defs.length ? defs.reduce(function (a, b) { return a + b; }, 0) / defs.length : null;
  const elM4 = document.getElementById('dyn_m4_val');
  if (elM4) { elM4.textContent = glob !== null ? glob.toFixed(1) + '%' : '—'; elM4.style.color = glob !== null && glob > 20 ? '#a32d2d' : glob !== null && glob > 10 ? '#854f0b' : '#3b6d11'; }
  const elM4b = document.getElementById('dyn_m4_bar');
  if (elM4b && glob !== null) elM4b.style.width = Math.min(glob, 30) / 30 * 100 + '%';
}

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
