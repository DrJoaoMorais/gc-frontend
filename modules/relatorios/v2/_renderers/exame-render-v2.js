/* =================================================================
   exame-render-v2.js · Renderer estático do Exame Objectivo (PDF)
   -----------------------------------------------------------------
   - Consome o MESMO par (cfg, data) do exame-render.js original.
   - Emite HTML auto-contido: <style> embebido, zero hidratação.
   - Grelha mista de 6 colunas: cartões declaram a sua largura.
   - Dinamometria estática: 4 mini-cartões + tabela (fórmulas
     copiadas textualmente de modules/obj/motor.js — não alterar).
   - Kapandji: SEM case — entra só após correcção da persistência
     em motor.js (sessão dedicada).
   - Expõe window.gcv2RenderExameObjectivoV2 (IIFE, não ES6 module).
   ================================================================= */
(function () {

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function num(v) { return (v !== null && v !== undefined && v !== '') ? Number(v) : null; }
  function hasVal(v) { return v !== null && v !== undefined && v !== ''; }
  function fmt1(v) { return (Math.round(v * 10) / 10).toString().replace('.', ','); }

  /* ---------- CSS embebido (viaja com o HTML para o Worker) ---------- */
  var CSS = '<style>' +
    '.gx2{font-family:"Outfit",Arial,sans-serif;font-variant-numeric:tabular-nums;color:#1e293b;}' +
    '.gx2-h2{font-family:"Outfit",Arial,sans-serif;font-size:9.5pt;font-weight:600;color:#0f2d52;' +
      'text-transform:uppercase;letter-spacing:.04em;margin:10pt 0 5pt 0;' +
      'border-bottom:1.5pt solid #0f2d52;padding-bottom:2.5pt;' +
      'display:flex;justify-content:space-between;align-items:baseline;}' +
    '.gx2-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:6pt;}' +
    '.gx2-card{border:.5pt solid #e2e8f0;border-radius:4.5pt;padding:5pt 6.5pt;' +
      'break-inside:avoid;page-break-inside:avoid;}' +
    '.gx2-s2{grid-column:span 2;}.gx2-s3{grid-column:span 3;}' +
    '.gx2-s4{grid-column:span 4;}.gx2-s6{grid-column:span 6;}' +
    '.gx2-ct{font-size:6.5pt;font-weight:600;letter-spacing:.07em;color:#0f2d52;' +
      'text-transform:uppercase;margin-bottom:3pt;}' +
    '.gx2-t{width:100%;border-collapse:collapse;font-size:8pt;color:#334155;}' +
    '.gx2-t td{padding:1pt 0;vertical-align:top;}' +
    '.gx2-t td+td{text-align:right;padding-left:4pt;}' +
    '.gx2-t .gx2-th td{color:#64748b;font-size:7pt;border-bottom:.5pt solid #e2e8f0;}' +
    '.gx2-alert{color:#991b1b;font-weight:600;}' +
    '.gx2-warn{color:#92400e;font-weight:600;}' +
    '.gx2-ok{color:#3b6d11;}' +
    '.gx2-mut{color:#64748b;}' +
    '.gx2-ref{color:#94a3b8;}' +
    '.gx2-nota{font-size:7pt;color:#64748b;font-style:italic;margin:2.5pt 0 0 0;}' +
    '.gx2-pills{display:flex;flex-wrap:wrap;gap:2pt 9pt;font-size:8pt;color:#334155;}' +
    '.gx2-esc-flex{display:flex;flex-wrap:wrap;gap:6pt;}' +
    '.gx2-esc-card{border:.5pt solid #e2e8f0;border-radius:4.5pt;padding:5pt 9pt;' +
      'text-align:center;min-width:58pt;break-inside:avoid;}' +
    '.gx2-esc-nome{font-size:6.5pt;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.05em;}' +
    '.gx2-esc-score{font-size:13pt;font-weight:600;color:#0f2d52;line-height:1.25;}' +
    '.gx2-esc-sub{font-size:6.5pt;color:#64748b;}' +
    '.gx2-esc-int{font-size:6.5pt;color:#475569;}' +
    '.gx2-dyn-mini{display:grid;grid-template-columns:repeat(4,1fr);gap:4.5pt;margin-bottom:4.5pt;}' +
    '.gx2-dm{background:#f8fafc;border-radius:3pt;padding:3.5pt 4.5pt;text-align:center;}' +
    '.gx2-dm-l{font-size:5.5pt;color:#64748b;text-transform:uppercase;letter-spacing:.05em;}' +
    '.gx2-dm-v{font-size:8pt;font-weight:600;color:#0f2d52;line-height:1.3;}' +
    '.gx2-dm-s{font-size:6.5pt;color:#64748b;}' +
    '.gx2-dm-bad{background:#fcebeb;}.gx2-dm-bad .gx2-dm-l{color:#a32d2d;}' +
    '.gx2-dm-bad .gx2-dm-v{color:#791f1f;}.gx2-dm-bad .gx2-dm-s{color:#a32d2d;}' +
    '</style>';

  /* ---------- helpers de cartão ---------- */
  function card(titulo, inner, span) {
    return '<div class="gx2-card gx2-s' + span + '">' +
      '<div class="gx2-ct">' + esc(titulo) + '</div>' + inner + '</div>';
  }
  function nota(sec, data, key) {
    var k = key || sec.notas || sec.notasKey;
    return (k && hasVal(data[k]))
      ? '<p class="gx2-nota">' + esc(data[k]) + '</p>' : '';
  }

  /* ---------- cabeçalho ---------- */
  function blocoHeader(cfg, data) {
    var lado = data.lado || data.assessment_side || '';
    var sufixo = '';
    if (lado === 'Direito' || lado === 'D') sufixo = ' — direito';
    else if (lado === 'Esquerdo' || lado === 'E') sufixo = ' — esquerdo';
    else if (lado === 'Bilateral' || lado === 'B') sufixo = ' — bilateral';
    return '<div class="gx2-h2"><span>Exame objectivo — ' +
      esc(cfg.titulo) + esc(sufixo) + '</span></div>';
  }

  /* ---------- Dor (1/3) ---------- */
  function blocoDor(sec, data) {
    var eva = data.eva || {};
    var rows = '';
    (sec.eva || []).forEach(function (e) {
      var key = e.id.replace('eva_', '');
      if (!hasVal(eva[key])) return;
      var v = num(eva[key]);
      var cls = v !== null && v >= 8 ? ' class="gx2-alert"' : v !== null && v >= 5 ? ' class="gx2-warn"' : '';
      rows += '<tr><td>' + esc(e.label) + '</td><td' + cls + '>' + esc(eva[key]) + '/10</td></tr>';
    });
    (sec.grupos || []).forEach(function (gr) {
      var val = data[gr.id];
      if (!hasVal(val) && !Array.isArray(val)) return;
      if (Array.isArray(val) && !val.length) return;
      var txt = Array.isArray(val) ? val.join(', ') : val;
      rows += '<tr><td class="gx2-mut" colspan="2">' + esc(gr.label) + ': ' + esc(txt) + '</td></tr>';
    });
    if (!rows) return '';
    return card('Dor', '<table class="gx2-t">' + rows + '</table>', 2);
  }

  /* ---------- Params / MRC / Funcional (1/3) ---------- */
  function blocoParams(sec, data) {
    var obj = data[sec.id] || {};
    var filled = (sec.rows || []).filter(function (r) { return hasVal(obj[r.id]); });
    if (!filled.length) return '';
    var isDor = function (v) { return v === 'Dor' || v === 'Com dor' || v === 'Não consegue' || v === 'Impossível'; };
    var isMrcAlert = function (v) { var n = parseInt(v); return !isNaN(n) && n <= 3; };
    var isMrc = sec.tipo === 'mrc';
    var rows = filled.map(function (r) {
      var val = obj[r.id];
      var cell;
      if (isMrc) {
        cell = isMrcAlert(val) ? '<span class="gx2-alert">' + esc(val) + '</span>' : esc(val);
      } else {
        cell = isDor(val) ? '<span class="gx2-alert">' + esc(val) + '</span>' : esc(val);
      }
      return '<tr><td>' + esc(r.label) + '</td><td>' + cell + '</td></tr>';
    }).join('');
    return card(sec.titulo, '<table class="gx2-t">' + rows + '</table>' + nota(sec, data), 2);
  }

  /* ---------- ROM (1/2 ou total, decide o conteúdo) ---------- */
  function blocoRom(sec, data) {
    var obj = data[sec.id] || {};
    var movs = sec.movimentos || [];
    var rows = '';
    var maxLbl = 0;
    var count = 0;
    movs.forEach(function (m) {
      var va = num(obj[m.key + '_a']);
      var vp = num(obj[m.key + '_p']);
      if (va === null && vp === null) return;
      count++;
      if (m.label.length > maxLbl) maxLbl = m.label.length;
      var ref = m.normal || 0;
      var defCell = '<td>—</td>';
      if (va !== null && ref) {
        var def = ref - va;
        var p = Math.round((def / ref) * 100);
        var cls = p >= 25 ? 'gx2-alert' : p >= 10 ? 'gx2-warn' : '';
        defCell = '<td' + (cls ? ' class="' + cls + '"' : '') + '>' + p + '%</td>';
      }
      var dAP = (va !== null && vp !== null) ? (vp - va) + '°' : '—';
      rows += '<tr><td>' + esc(m.label) + '</td>' +
        '<td>' + (va !== null ? va + '°' : '—') + '</td>' +
        '<td class="gx2-mut">' + (vp !== null ? vp + '°' : '—') + '</td>' +
        '<td class="gx2-mut">' + dAP + '</td>' +
        '<td class="gx2-ref">' + (ref ? ref + '°' : '—') + '</td>' +
        defCell + '</tr>';
    });
    if (!rows) return '';
    var head = '<tr class="gx2-th"><td></td><td>Act.</td><td>Pass.</td>' +
      '<td>Δ A−P</td><td>Ref.</td><td>Déf.</td></tr>';
    var span = (count > 5 || maxLbl > 16) ? 6 : 3;
    return card(sec.titulo, '<table class="gx2-t">' + head + rows + '</table>' + nota(sec, data), span);
  }

  /* ---------- Testes clínicos (2/3, pastilhas) ---------- */
  function blocoTestes(sec, data) {
    var obj = data.testes || {};
    var posCls = { '+': 'gx2-warn', '++': 'gx2-warn', '+++': 'gx2-alert' };
    var items = '';
    (sec.grupos || []).forEach(function (grp) {
      (grp.testes || []).forEach(function (t) {
        var val = obj[t.id];
        if (!val || val === 'Negativo' || val === '-' || !hasVal(val)) return;
        var cls = posCls[val] || '';
        items += '<span>' + esc(t.label) + ' ' +
          (cls ? '<b class="' + cls + '">' + esc(val) + '</b>' : esc(val)) + '</span>';
      });
    });
    if (!items) return '';
    return card('Testes clínicos', '<div class="gx2-pills">' + items + '</div>' + nota(sec, data), 4);
  }

  /* ---------- Grupos: Cicatriz / Atrofia + Perimetria (1/2) ---------- */
  function blocoGrupos(sec, data) {
    var bloco = data[sec.id] || {};
    var rows = '';
    (sec.grupos || []).forEach(function (gr) {
      var val = bloco[gr.key];
      if (!hasVal(val) && !Array.isArray(val)) return;
      if (Array.isArray(val) && !val.length) return;
      var txt = Array.isArray(val) ? val.join(', ') : val;
      rows += '<tr><td>' + esc(gr.label) + '</td><td>' + esc(txt) + '</td></tr>';
    });
    var prows = '';
    if (sec.perimetria && bloco.perimetria) {
      (sec.perimetria.niveis || []).forEach(function (nv) {
        var p = bloco.perimetria[nv.key];
        if (!p || (p.d == null && p.e == null)) return;
        var delta = (p.d != null && p.e != null) ? fmt1(p.d - p.e) : '—';
        prows += '<tr><td>' + esc(nv.label) + '</td>' +
          '<td>' + (p.d != null ? fmt1(p.d) : '—') + '</td>' +
          '<td>' + (p.e != null ? fmt1(p.e) : '—') + '</td>' +
          '<td class="gx2-mut">' + delta + '</td></tr>';
      });
      if (prows) {
        prows = '<tr class="gx2-th"><td>Nível (cm)</td><td>D</td><td>E</td><td>Δ</td></tr>' + prows;
      }
    }
    if (!rows && !prows) return '';
    return card(sec.label, '<table class="gx2-t">' + rows + prows + '</table>' + nota(sec, data, sec.notasKey), 3);
  }

  /* ---------- Grading (Sunnybrook / HB) ---------- */
  function blocoGrading(sec, data) {
    var cards = '';
    (sec.escalas || []).forEach(function (e) {
      var raw = data[e.id + '_score'];
      if (!hasVal(raw) || raw === '—') return;
      var interpTxt = data[e.id + '_interp'];
      cards += '<div class="gx2-esc-card">' +
        '<div class="gx2-esc-nome">' + esc(e.titulo) + '</div>' +
        '<div class="gx2-esc-score">' + esc(raw) + '</div>' +
        (hasVal(interpTxt) ? '<div class="gx2-esc-int">' + esc(interpTxt) + '</div>' : '') +
        '</div>';
    });
    if (!cards) return '';
    return card(sec.titulo, '<div class="gx2-esc-flex">' + cards + '</div>', 6);
  }

  /* ---------- Escalas funcionais (DASH / ASES / OSS…) ---------- */
  function interpEscala(escCfg, score) {
    if (!escCfg.interp || !escCfg.interp.length) return '';
    var dir = escCfg.interpDir || 'asc';
    var sorted = escCfg.interp.slice().sort(function (a, b) {
      return dir === 'asc' ? b.threshold - a.threshold : a.threshold - b.threshold;
    });
    var match = sorted.find(function (band) {
      return dir === 'asc' ? score >= band.threshold : score <= band.threshold;
    });
    return match ? match.txt : '';
  }
  function blocoEscalas(cfg, data) {
    var escData = data.escalas || {};
    var cards = '';
    (cfg.escalas || []).forEach(function (e) {
      var s = num(escData[e.id + '_score']);
      if (s === null) return;
      var maxScore = e.score === 'soma' ? (e.optMax * (e.itens ? e.itens.length : 1)) : 100;
      var interpTxt = interpEscala(e, s);
      var evaLine = e.evaInput && hasVal(escData[e.evaInput.id])
        ? '<div class="gx2-esc-sub">EVA: ' + esc(escData[e.evaInput.id]) + '</div>' : '';
      cards += '<div class="gx2-esc-card">' +
        '<div class="gx2-esc-nome">' + esc(e.id.toUpperCase()) + '</div>' +
        '<div class="gx2-esc-score">' + s + '/' + maxScore + '</div>' +
        evaLine +
        (interpTxt ? '<div class="gx2-esc-int">' + esc(interpTxt) + '</div>' : '') +
        '</div>';
    });
    if (!cards) return '';
    return card('Escalas funcionais', '<div class="gx2-esc-flex">' + cards + '</div>', 6);
  }

  /* ---------- Dinamometria estática (largura total) ----------
     Fórmulas copiadas de modules/obj/motor.js (_calcDyn*):
     défice = |E−D| / D × 100 · assimetria global = média dos défices.
     Não alterar sem alterar também o motor — ecrã e PDF têm de bater. */
  function blocoDyn(cfg, data) {
    var dynCfg = cfg.dinamometria;
    if (!dynCfg || !dynCfg.movimentos) return '';
    var dyn = data.dyn;
    if (!dyn || typeof dyn !== 'object') return '';
    var temDados = Object.values(dyn).some(function (m) {
      return m && typeof m === 'object' && Object.values(m).some(function (v) { return v !== null && v !== undefined; });
    });
    if (!temDados) return '';

    /* métrica 1 — maior força */
    var bestLabel = '—', bestSub = '', bestVal = -1;
    dynCfg.movimentos.forEach(function (m) {
      var d = dyn[m.key]; if (!d) return;
      ['e', 'd'].forEach(function (lado) {
        var v = d[lado];
        if (v === null || v === undefined) return;
        if (v > bestVal) {
          bestVal = v;
          bestLabel = m.label + ' ' + (lado === 'e' ? 'E' : 'D');
          bestSub = fmt1(v) + ' kg';
        }
      });
    });

    /* métrica 2 — maior défice */
    var worstPct = 0, worstLabel = '—', worstSub = '—';
    dynCfg.movimentos.forEach(function (m) {
      var d = dyn[m.key];
      if (!d || d.e === null || d.e === undefined || d.d === null || d.d === undefined || d.d === 0) return;
      var pct = Math.abs((d.e - d.d) / d.d * 100);
      if (pct > worstPct) {
        worstPct = pct;
        worstLabel = m.label;
        worstSub = 'E ' + fmt1(d.e) + ' vs D ' + fmt1(d.d) + ' kg (' + Math.round(pct) + '%)';
      }
    });

    /* métrica 3 — rácio 0 */
    var rc0 = dynCfg.racios && dynCfg.racios.length ? dynCfg.racios[0] : null;
    var r0Val = null, r0Ok = null, r0Lbl = '';
    if (rc0) {
      r0Lbl = rc0.label;
      var nd = dyn[rc0.num], dd2 = dyn[rc0.den];
      var r0D = (nd && nd.d != null && dd2 && dd2.d != null && dd2.d !== 0) ? nd.d / dd2.d * 100 : null;
      var r0E = (nd && nd.e != null && dd2 && dd2.e != null && dd2.e !== 0) ? nd.e / dd2.e * 100 : null;
      r0Val = r0D !== null ? r0D : r0E;
      if (r0Val !== null && rc0.refMin !== null) r0Ok = r0Val >= rc0.refMin;
    }

    /* métrica 4 — assimetria global */
    var defs = [];
    dynCfg.movimentos.forEach(function (m) {
      var d = dyn[m.key];
      if (!d || d.e === null || d.e === undefined || d.d === null || d.d === undefined || d.d === 0) return;
      defs.push(Math.abs((d.e - d.d) / d.d * 100));
    });
    var glob = defs.length ? defs.reduce(function (a, b) { return a + b; }, 0) / defs.length : null;

    var miniCls2 = worstPct > 20 ? ' gx2-dm-bad' : '';
    var miniCls4 = (glob !== null && glob > 20) ? ' gx2-dm-bad' : '';
    var minis = '<div class="gx2-dyn-mini">' +
      '<div class="gx2-dm"><div class="gx2-dm-l">Maior força</div>' +
        '<div class="gx2-dm-v">' + esc(bestLabel) + '</div>' +
        '<div class="gx2-dm-s">' + esc(bestSub) + '</div></div>' +
      '<div class="gx2-dm' + miniCls2 + '"><div class="gx2-dm-l">Maior défice</div>' +
        '<div class="gx2-dm-v">' + esc(worstLabel) + '</div>' +
        '<div class="gx2-dm-s">' + esc(worstSub) + '</div></div>' +
      '<div class="gx2-dm"><div class="gx2-dm-l">Ratio ' + esc(r0Lbl) + '</div>' +
        '<div class="gx2-dm-v' + (r0Ok === false ? ' gx2-alert' : '') + '">' +
          (r0Val !== null ? Math.round(r0Val) + '%' : '—') + '</div>' +
        '<div class="gx2-dm-s">' + (rc0 && rc0.refMin !== null ? 'ref ≥ ' + rc0.refMin + '%' : 'informativo') + '</div></div>' +
      '<div class="gx2-dm' + miniCls4 + '"><div class="gx2-dm-l">Assimetria global</div>' +
        '<div class="gx2-dm-v">' + (glob !== null ? fmt1(glob) + '%' : '—') + '</div>' +
        '<div class="gx2-dm-s">média bilateral</div></div>' +
      '</div>';

    var trows = '';
    dynCfg.movimentos.forEach(function (m) {
      var d = dyn[m.key]; if (!d) return;
      var e = (d.e !== null && d.e !== undefined) ? d.e : null;
      var dd = (d.d !== null && d.d !== undefined) ? d.d : null;
      if (e === null && dd === null) return;
      var pctCell = '<td>—</td>';
      if (e !== null && dd !== null && dd !== 0) {
        var pct = Math.abs((e - dd) / dd * 100);
        var cls = pct > 20 ? 'gx2-alert' : pct > 10 ? 'gx2-warn' : 'gx2-ok';
        pctCell = '<td class="' + cls + '">' + Math.round(pct) + '%</td>';
      }
      trows += '<tr><td>' + esc(m.label) + '</td>' +
        '<td>' + (e !== null ? fmt1(e) : '—') + '</td>' +
        '<td>' + (dd !== null ? fmt1(dd) : '—') + '</td>' +
        pctCell + '</tr>';
    });
    var tabela = trows
      ? '<table class="gx2-t"><tr class="gx2-th"><td>Movimento</td><td>E (kg)</td><td>D (kg)</td><td>Δ</td></tr>' + trows + '</table>'
      : '';

    return card('Dinamometria — ActivForce 2', minis + tabela, 6);
  }

  /* ---------- Dispatch (mesma ordem de secções do config) ---------- */
  function renderExameObjectivoV2(cfg, data) {
    if (!cfg || !data) return '';
    var cards = [];
    (cfg.seccoes || []).forEach(function (sec) {
      switch (sec.tipo) {
        case 'dor':     cards.push(blocoDor(sec, data)); break;
        case 'params':  cards.push(blocoParams(sec, data)); break;
        case 'mrc':     cards.push(blocoParams(sec, data)); break;
        case 'func':    cards.push(blocoParams(sec, data)); break;
        case 'rom':     cards.push(blocoRom(sec, data)); break;
        case 'testes':  cards.push(blocoTestes(sec, data)); break;
        case 'grupos':  cards.push(blocoGrupos(sec, data)); break;
        case 'grading': cards.push(blocoGrading(sec, data)); break;
        /* 'kapandji': deliberadamente ausente — ver cabeçalho */
      }
    });
    cards.push(blocoDyn(cfg, data));
    cards.push(blocoEscalas(cfg, data));
    /* Notas de secção saem dentro do respectivo cartão via nota() —
       não existe bloco "Notas clínicas" separado nesta versão. */
    var html = cards.filter(Boolean).join('');
    if (!html) return '';
    return '<div class="gx2">' + CSS + blocoHeader(cfg, data) +
      '<div class="gx2-grid">' + html + '</div></div>';
  }

  window.gcv2RenderExameObjectivoV2 = renderExameObjectivoV2;

})();
