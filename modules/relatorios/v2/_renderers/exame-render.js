(function () {

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function num(v) { return (v !== null && v !== undefined && v !== '') ? Number(v) : null; }
  function hasVal(v) { return v !== null && v !== undefined && v !== ''; }

  function blocoHeader(cfg, data) {
    const lado = data.lado || data.assessment_side || '';
    let sufixo = '';
    if (lado === 'Direito' || lado === 'D') sufixo = ' DIREITO';
    else if (lado === 'Esquerdo' || lado === 'E') sufixo = ' ESQUERDO';
    else if (lado === 'Bilateral' || lado === 'B') sufixo = ' — BILATERAL';
    return `<h2 class="gcv2-ombro-h">EXAME OBJECTIVO — ${esc(cfg.titulo.toUpperCase())}${esc(sufixo)}</h2>`;
  }

  function blocoSeccaoDor(sec, data) {
    const eva = data.eva || {};
    let rows = '';
    if (sec.eva) {
      sec.eva.forEach(function (e) {
        const key = e.id.replace('eva_', '');
        if (hasVal(eva[key])) rows += `<tr><td>EVA ${esc(e.label)}</td><td>${esc(eva[key])}/10</td></tr>`;
      });
    }
    if (sec.grupos) {
      sec.grupos.forEach(function (gr) {
        const val = data[gr.id];
        if (!hasVal(val) && !Array.isArray(val)) return;
        if (Array.isArray(val) && !val.length) return;
        const txt = Array.isArray(val) ? val.join(', ') : val;
        rows += `<tr><td>${esc(gr.label)}</td><td>${esc(txt)}</td></tr>`;
      });
    }
    if (!rows) return '';
    return `<h3>Caracterização da Dor</h3><table class="gcv2-ombro-table">${rows}</table>`;
  }

  function blocoSeccaoParams(sec, data) {
    const obj = data[sec.id] || {};
    const allRows = sec.rows || [];
    const filled = allRows.filter(function (r) { return hasVal(obj[r.id]); });
    if (!filled.length) return '';

    const isDor = function (v) { return v === 'Dor' || v === 'Com dor' || v === 'Não consegue' || v === 'Impossível'; };
    const isMrcAlert = function (v) { const n = parseInt(v); return !isNaN(n) && n <= 3; };
    const isMrc = sec.tipo === 'mrc';

    const rows = filled.map(function (r) {
      const val = obj[r.id];
      let cellHtml;
      if (isMrc) {
        cellHtml = isMrcAlert(val) ? `<span class="gcv2-ombro-alert">${esc(val)}</span>` : esc(val);
      } else {
        cellHtml = isDor(val) ? `<span class="gcv2-ombro-dor">${esc(val)}</span>` : esc(val);
      }
      return `<tr><td>${esc(r.label)}</td><td>${cellHtml}</td></tr>`;
    }).join('');

    const nota = sec.notas && data[sec.notas] ? `<p class="gcv2-ombro-nota"><em>${esc(data[sec.notas])}</em></p>` : '';
    return `<h3>${esc(sec.titulo)}</h3><table class="gcv2-ombro-table">${rows}</table>${nota}`;
  }

  function blocoSeccaoRom(sec, data) {
    const obj = data[sec.id] || {};
    const movs = sec.movimentos || [];
    let rows = '';
    movs.forEach(function (m) {
      const va = num(obj[m.key + '_a']);
      const vp = num(obj[m.key + '_p']);
      if (va === null && vp === null) return;
      const ref = m.normal || 0;
      let deficeCell = '<td>—</td>';
      if (va !== null && ref) {
        const def = ref - va;
        const p = Math.round((def / ref) * 100);
        const cls = p >= 25 ? 'gcv2-ombro-alert' : p >= 10 ? 'gcv2-ombro-warn' : '';
        deficeCell = cls ? `<td class="${cls}">${def}° (${p}%)</td>` : `<td>${def}° (${p}%)</td>`;
      }
      rows += `<tr><td>${esc(m.label)}</td><td>${va !== null ? va + '°' : '—'}</td><td>${vp !== null ? vp + '°' : '—'}</td><td>${ref ? ref + '°' : '—'}</td>${deficeCell}</tr>`;
    });
    if (!rows) return '';
    const nota = sec.notas && data[sec.notas] ? `<p class="gcv2-ombro-nota"><em>${esc(data[sec.notas])}</em></p>` : '';
    return `<h3>${esc(sec.titulo)}</h3>
<table class="gcv2-ombro-table">
<thead><tr><th>Movimento</th><th>Activo</th><th>Passivo</th><th>Referência</th><th>Défice activo</th></tr></thead>
<tbody>${rows}</tbody></table>${nota}`;
  }

  function blocoSeccaoTestes(sec, data) {
    const obj = data.testes || {};
    const posClasses = { '+': 'gcv2-ombro-pos1', '++': 'gcv2-ombro-pos2', '+++': 'gcv2-ombro-pos3' };
    const grupos = sec.grupos || [];
    let items = '';
    grupos.forEach(function (grp) {
      (grp.testes || []).forEach(function (t) {
        const val = obj[t.id];
        if (!val || val === 'Negativo' || val === '-' || !hasVal(val)) return;
        const cls = posClasses[val] || '';
        const valHtml = cls ? `<span class="${cls}">${esc(val)}</span>` : esc(val);
        items += `<div class="gcv2-ombro-teste-item"><span class="gcv2-ombro-teste-lbl">${esc(t.label)}</span> ${valHtml}</div>`;
      });
    });
    if (!items) return '';
    const nota = sec.notas && data[sec.notas] ? `<p class="gcv2-ombro-nota"><em>${esc(data[sec.notas])}</em></p>` : '';
    return `<h3>Testes Clínicos Especiais</h3><div class="gcv2-ombro-testes-grid">${items}</div>${nota}`;
  }

  function blocoSeccaoDyn(cfg, data) {
    if (!cfg.dinamometria) return '';
    const dyn = data.dyn;
    if (!dyn || typeof dyn !== 'object') return '';
    if (!Object.values(dyn).some(function (m) {
      return m && typeof m === 'object' && Object.values(m).some(function (v) { return v !== null && v !== undefined; });
    })) return '';
    const jsonEsc = esc(JSON.stringify(dyn));
    return `<h3>Dinamometria — ActivForce 2</h3><div class="gcv2-ombro-dyn-mount" data-dyn-json='${jsonEsc}'></div>`;
  }

  function interpEscala(escCfg, score) {
    if (!escCfg.interp || !escCfg.interp.length) return '';
    const dir = escCfg.interpDir || 'asc';
    const sorted = escCfg.interp.slice().sort(function (a, b) {
      return dir === 'asc' ? b.threshold - a.threshold : a.threshold - b.threshold;
    });
    const match = sorted.find(function (band) {
      return dir === 'asc' ? score >= band.threshold : score <= band.threshold;
    });
    return match ? match.txt : '';
  }

  function blocoSeccaoEscalas(cfg, data) {
    const escalas = cfg.escalas || [];
    const escData = data.escalas || {};
    let cards = '';
    escalas.forEach(function (e) {
      const scoreKey = e.id + '_score';
      const s = num(escData[scoreKey]);
      if (s === null) return;
      const maxScore = e.score === 'soma' ? (e.optMax * (e.itens ? e.itens.length : 1)) : 100;
      const interpTxt = interpEscala(e, s);
      const evaLine = e.evaInput && hasVal(escData[e.evaInput.id])
        ? `<div class="gcv2-ombro-escala-sub">EVA: ${esc(escData[e.evaInput.id])}</div>` : '';
      cards += `<div class="gcv2-ombro-escala-card">
  <div class="gcv2-ombro-escala-nome">${esc(e.id.toUpperCase())}</div>
  <div class="gcv2-ombro-escala-score">${s}/${maxScore}</div>
  ${evaLine}
  ${interpTxt ? `<div class="gcv2-ombro-escala-int">${esc(interpTxt)}</div>` : ''}
</div>`;
    });
    if (!cards) return '';
    return `<h3>Escalas Funcionais</h3><div class="gcv2-ombro-escalas-flex">${cards}</div>`;
  }

  function blocoNotas(cfg, data) {
    const keys = new Set();
    (cfg.seccoes || []).forEach(function (sec) {
      if (sec.notas) keys.add(sec.notas);
      if (sec.notasKey) keys.add(sec.notasKey);
    });
    const rows = [];
    keys.forEach(function (k) {
      if (!hasVal(data[k])) return;
      const label = k.replace('notas_', '').replace(/_/g, ' ');
      const labelCap = label.charAt(0).toUpperCase() + label.slice(1);
      rows.push(`<tr><td><strong>${esc(labelCap)}</strong></td><td>${esc(data[k])}</td></tr>`);
    });
    if (!rows.length) return '';
    return `<h3>Notas Clínicas</h3><table class="gcv2-ombro-table">${rows.join('')}</table>`;
  }

  function renderExameObjectivo(cfg, data) {
    if (!cfg || !data) return '';
    const parts = [blocoHeader(cfg, data)];

    (cfg.seccoes || []).forEach(function (sec) {
      switch (sec.tipo) {
        case 'dor':    parts.push(blocoSeccaoDor(sec, data)); break;
        case 'params': parts.push(blocoSeccaoParams(sec, data)); break;
        case 'mrc':    parts.push(blocoSeccaoParams(sec, data)); break;
        case 'func':   parts.push(blocoSeccaoParams(sec, data)); break;
        case 'rom':    parts.push(blocoSeccaoRom(sec, data)); break;
        case 'testes': parts.push(blocoSeccaoTestes(sec, data)); break;
      }
    });

    parts.push(blocoSeccaoDyn(cfg, data));
    parts.push(blocoSeccaoEscalas(cfg, data));
    parts.push(blocoNotas(cfg, data));

    return parts.filter(Boolean).join('\n');
  }

  window.gcv2RenderExameObjectivo = renderExameObjectivo;

})();
