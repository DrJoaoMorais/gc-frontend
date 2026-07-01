// Renderer: Exame Objectivo do Ombro → HTML para Relatório de Consulta v2
// Input: data (objeto JSON de consultation_assessments.data)
// Output: string HTML com classes gcv2-ombro-*

(function () {

  // ── Helpers ──────────────────────────────────────────────────────────────

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function num(v) { return (v !== null && v !== undefined && v !== '') ? Number(v) : null; }

  function pct(deficit, ref) {
    if (!ref) return 0;
    return Math.round((deficit / ref) * 100);
  }

  function deficeClass(p) {
    if (p >= 25) return 'gcv2-ombro-alert';
    if (p >= 10) return 'gcv2-ombro-warn';
    return '';
  }

  function hasValue(v) { return v !== null && v !== undefined && v !== ''; }

  function dynHasData(dyn) {
    if (!dyn || typeof dyn !== 'object') return false;
    return Object.values(dyn).some(m =>
      m && typeof m === 'object' &&
      Object.values(m).some(v => v !== null && v !== undefined)
    );
  }

  // ── Bloco 1: Cabeçalho ───────────────────────────────────────────────────

  function blocoHeader(data) {
    const lado = data.lado;
    let sufixo = '';
    if (lado === 'Direito') sufixo = ' DIREITO';
    else if (lado === 'Esquerdo') sufixo = ' ESQUERDO';
    else if (lado === 'Bilateral') return '<h2 class="gcv2-ombro-h">EXAME OBJECTIVO — OMBROS — BILATERAL</h2>';
    return `<h2 class="gcv2-ombro-h">EXAME OBJECTIVO — OMBRO${esc(sufixo)}</h2>`;
  }

  // ── Bloco 2: Caracterização da Dor ───────────────────────────────────────

  function blocoDor(data) {
    const eva = data.eva || {};
    const evaRep = hasValue(eva.rep) ? `<tr><td>EVA Repouso</td><td>${esc(eva.rep)}/10</td></tr>` : '';
    const evaAct = hasValue(eva.act) ? `<tr><td>EVA Actividade</td><td>${esc(eva.act)}/10</td></tr>` : '';
    const evaPic = hasValue(eva.pic) ? `<tr><td>EVA Pico</td><td>${esc(eva.pic)}/10</td></tr>` : '';
    const tipo = hasValue(data.tipo_dor) ? `<tr><td>Tipo de dor</td><td>${esc(data.tipo_dor)}</td></tr>` : '';
    const loc = Array.isArray(data.localizacao_dor) && data.localizacao_dor.length
      ? `<tr><td>Localização</td><td>${esc(data.localizacao_dor.join(', '))}</td></tr>` : '';
    const irrad = hasValue(data.irradiacao) ? `<tr><td>Irradiação</td><td>${esc(data.irradiacao)}</td></tr>` : '';
    const noct = hasValue(data.d_noturna) ? `<tr><td>Dor nocturna</td><td>${esc(data.d_noturna)}</td></tr>` : '';

    const rows = evaRep + evaAct + evaPic + tipo + loc + irrad + noct;
    if (!rows) return '';

    return `<h3>Caracterização da Dor</h3>
<table class="gcv2-ombro-table">${rows}</table>`;
  }

  // ── Bloco 3: Palpação ────────────────────────────────────────────────────

  function blocoAlgPalp(data) {
    const palp = data.palp || {};
    const labels = { ac: 'Articulação AC', tb: 'Tubérculo maior', bic: 'Sulco bicipital', bur: 'Bursa subacromial', sup: 'Supra-espinhoso' };
    const keys = Object.keys(labels);

    const filled = keys.filter(k => hasValue(palp[k]));
    if (!filled.length) return '';

    const allNormal = filled.every(k => palp[k] === 'Sem dor');
    if (allNormal) return '<h3>Palpação</h3><p>Palpação sem alterações.</p>';

    const rows = keys
      .filter(k => hasValue(palp[k]))
      .map(k => {
        const isDor = palp[k] === 'Dor';
        const cls = isDor ? ' class="gcv2-ombro-dor"' : '';
        return `<tr><td>${esc(labels[k])}</td><td${cls}>${esc(palp[k])}</td></tr>`;
      }).join('');

    return `<h3>Palpação</h3>
<table class="gcv2-ombro-table">${rows}</table>`;
  }

  // ── Bloco 4: Amplitude Articular ─────────────────────────────────────────

  function blocoRom(data) {
    const rom = data.rom || {};
    const movimentos = [
      { label: 'Flexão',            a: 'flex_a', p: 'flex_p', ref: 180 },
      { label: 'Extensão',          a: 'ext_a',  p: 'ext_p',  ref: 60  },
      { label: 'Abdução',           a: 'abd_a',  p: 'abd_p',  ref: 180 },
      { label: 'Rotação Externa',   a: 're_a',   p: 're_p',   ref: 90  },
      { label: 'Rotação Interna',   a: 'ri_a',   p: 'ri_p',   ref: 90  },
    ];

    let rows = '';
    for (const m of movimentos) {
      const va = num(rom[m.a]);
      const vp = num(rom[m.p]);
      if (va === null && vp === null) continue;

      let deficeCell = '<td>—</td>';
      if (va !== null) {
        const def = m.ref - va;
        const p = pct(def, m.ref);
        const cls = deficeClass(p);
        deficeCell = cls
          ? `<td class="${cls}">${def}° (${p}%)</td>`
          : `<td>${def}° (${p}%)</td>`;
      }

      rows += `<tr>
  <td>${esc(m.label)}</td>
  <td>${va !== null ? va + '°' : '—'}</td>
  <td>${vp !== null ? vp + '°' : '—'}</td>
  <td>${m.ref}°</td>
  ${deficeCell}
</tr>`;
    }

    if (!rows) return '';

    return `<h3>Amplitude Articular</h3>
<table class="gcv2-ombro-table">
<thead><tr><th>Movimento</th><th>Activo</th><th>Passivo</th><th>Referência</th><th>Défice activo</th></tr></thead>
<tbody>${rows}</tbody>
</table>`;
  }

  // ── Bloco 5: Força Muscular ───────────────────────────────────────────────

  function blocoMrc(data) {
    const mrc = data.mrc || {};
    const labels = { sup: 'Supra-esp.', inf: 'Infra-esp.', sub: 'Subescapular', del: 'Deltóide', ext: 'Extensores' };

    const parts = Object.entries(labels)
      .filter(([k]) => hasValue(mrc[k]))
      .map(([k, label]) => {
        const val = mrc[k];
        const grau = parseInt(val);
        const isAlert = !isNaN(grau) && grau <= 3;
        const cell = isAlert
          ? `<span class="gcv2-ombro-alert">${esc(val)}</span>`
          : esc(val);
        return `${esc(label)} ${cell}`;
      });

    if (!parts.length) return '';

    return `<h3>Força Muscular (MRC 0-5)</h3>
<p class="gcv2-ombro-mrc">${parts.join(' · ')}</p>`;
  }

  // ── Bloco 6: Testes Clínicos ──────────────────────────────────────────────

  function blocoTestes(data) {
    const testes = data.testes || {};
    const labels = {
      neer: 'Neer', hawk: 'Hawkins', jobe: 'Jobe (supra-esp.)', patte: 'Patte (infra-esp.)',
      liftoff: 'Lift-off (subesc.)', belly: 'Belly press', drop: 'Drop Arm',
      speed: 'Speed', yerg: 'Yergason', appr: 'Apprehension', reloc: 'Relocation', sulc: 'Sulcus sign',
    };
    const posClasses = { '+': 'gcv2-ombro-pos1', '++': 'gcv2-ombro-pos2', '+++': 'gcv2-ombro-pos3' };

    const positivos = Object.entries(labels)
      .filter(([k]) => testes[k] && testes[k] !== '-' && hasValue(testes[k]))
      .map(([k, label]) => {
        const val = testes[k];
        const cls = posClasses[val] || '';
        const valHtml = cls ? `<span class="${cls}">${esc(val)}</span>` : esc(val);
        return `<div class="gcv2-ombro-teste-item"><span class="gcv2-ombro-teste-lbl">${esc(label)}</span> ${valHtml}</div>`;
      });

    if (!positivos.length) return '';

    return `<h3>Testes Clínicos Especiais</h3>
<div class="gcv2-ombro-testes-grid">${positivos.join('')}</div>`;
  }

  // ── Bloco 7: Dinamometria ─────────────────────────────────────────────────

  function blocoDyn(data) {
    if (!dynHasData(data.dyn)) return '';
    const jsonEsc = esc(JSON.stringify(data.dyn));
    return `<h3>Dinamometria — ActivForce 2</h3>
<div class="gcv2-ombro-dyn-mount" data-dyn-json='${jsonEsc}'></div>`;
  }

  // ── Bloco 8: Avaliação Funcional ──────────────────────────────────────────

  function blocoFunc(data) {
    const func = data.func || {};
    const labels = {
      elev: 'Elevação acima da cabeça',
      cos: 'Pentear/lavar cabeça',
      vest: 'Vestir camisola',
      prof: 'Actividade profissional',
      desp: 'Actividade desportiva',
      cond: 'Conduzir',
    };

    const rows = Object.entries(labels)
      .filter(([k]) => hasValue(func[k]))
      .map(([k, label]) => {
        const val = func[k];
        const isDor = val === 'Com dor' || val === 'Não consegue';
        const cls = isDor ? ' class="gcv2-ombro-dor"' : '';
        return `<tr><td>${esc(label)}</td><td${cls}>${esc(val)}</td></tr>`;
      }).join('');

    if (!rows) return '';

    return `<h3>Avaliação Funcional</h3>
<table class="gcv2-ombro-table">${rows}</table>`;
  }

  // ── Bloco 9: Escalas Funcionais ───────────────────────────────────────────

  function interpretDash(s) {
    if (s <= 20) return 'Incapacidade mínima';
    if (s <= 40) return 'Incapacidade ligeira';
    if (s <= 60) return 'Incapacidade moderada';
    if (s <= 80) return 'Incapacidade grave';
    return 'Incapacidade extrema';
  }

  function interpretAses(s) {
    if (s >= 80) return 'Excelente';
    if (s >= 60) return 'Bom';
    if (s >= 40) return 'Moderado — limitação marcada';
    return 'Mau — limitação severa';
  }

  function interpretOss(s) {
    if (s >= 40) return 'Excelente — sem sintomas relevantes';
    if (s >= 33) return 'Bom';
    if (s >= 25) return 'Moderado';
    return 'Mau';
  }

  function blocoEscalas(data) {
    const esc_ = data.escalas || {};
    let cards = '';

    const dash = num(esc_.dash_score);
    if (dash !== null) {
      cards += `<div class="gcv2-ombro-escala-card">
  <div class="gcv2-ombro-escala-nome">DASH</div>
  <div class="gcv2-ombro-escala-score">${dash}/100</div>
  <div class="gcv2-ombro-escala-int">${esc(interpretDash(dash))}</div>
</div>`;
    }

    const ases = num(esc_.ases_score);
    if (ases !== null) {
      const evaLine = hasValue(esc_.ases_eva) ? `<div class="gcv2-ombro-escala-sub">EVA: ${esc(esc_.ases_eva)}</div>` : '';
      cards += `<div class="gcv2-ombro-escala-card">
  <div class="gcv2-ombro-escala-nome">ASES</div>
  <div class="gcv2-ombro-escala-score">${ases}/100</div>
  ${evaLine}
  <div class="gcv2-ombro-escala-int">${esc(interpretAses(ases))}</div>
</div>`;
    }

    const oss = num(esc_.oss_score);
    if (oss !== null) {
      cards += `<div class="gcv2-ombro-escala-card">
  <div class="gcv2-ombro-escala-nome">OSS</div>
  <div class="gcv2-ombro-escala-score">${oss}/48</div>
  <div class="gcv2-ombro-escala-int">${esc(interpretOss(oss))}</div>
</div>`;
    }

    if (!cards) return '';

    return `<h3>Escalas Funcionais</h3>
<div class="gcv2-ombro-escalas-flex">${cards}</div>`;
  }

  // ── Bloco 10: Notas Clínicas ──────────────────────────────────────────────

  function blocoNotas(data) {
    const campos = [
      { key: 'notas_mob',    label: 'Mobilidade' },
      { key: 'notas_palp',   label: 'Palpação'   },
      { key: 'notas_forca',  label: 'Força'      },
      { key: 'notas_testes', label: 'Testes'     },
    ];

    const rows = campos
      .filter(c => hasValue(data[c.key]))
      .map(c => `<tr><td><strong>${esc(c.label)}</strong></td><td>${esc(data[c.key])}</td></tr>`)
      .join('');

    if (!rows) return '';

    return `<h3>Notas Clínicas</h3>
<table class="gcv2-ombro-table">${rows}</table>`;
  }

  // ── Função principal ──────────────────────────────────────────────────────

  function renderOmbroExame(data) {
    if (!data || typeof data !== 'object') return '';

    return [
      blocoHeader(data),
      blocoDor(data),
      blocoAlgPalp(data),
      blocoRom(data),
      blocoMrc(data),
      blocoTestes(data),
      blocoDyn(data),
      blocoFunc(data),
      blocoEscalas(data),
      blocoNotas(data),
    ].filter(Boolean).join('\n');
  }

  window.gcv2RenderOmbroExame = renderOmbroExame;

})();
