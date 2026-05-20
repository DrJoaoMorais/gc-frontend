// Componente: Hidratação de tabelas de dinamometria (ActivForce 2)
// Procura .gcv2-ombro-dyn-mount e substitui pelo HTML da tabela.

(function () {

  // ── Helpers ───────────────────────────────────────────────────────────────

  function fmt(v) {
    if (v === null || v === undefined || (typeof v === 'number' && isNaN(v))) return '—';
    return Number(v).toFixed(1) + ' kg';
  }

  function isValid(v) {
    return v !== null && v !== undefined && typeof v === 'number' && !isNaN(v);
  }

  function asymmetry(e, d) {
    const max = Math.max(e, d);
    if (max === 0) return { pct: 0, lado: '' };
    const pct = Math.round(Math.abs(e - d) / max * 100);
    const lado = e > d ? 'E' : d > e ? 'D' : '';
    return { pct, lado };
  }

  function asymClass(pct) {
    if (pct >= 25) return 'gcv2-dyn-alert';
    if (pct >= 10) return 'gcv2-dyn-warn';
    return '';
  }

  // ── Render de uma linha ───────────────────────────────────────────────────

  function renderRow(label, e, d) {
    const eOk = isValid(e);
    const dOk = isValid(d);

    if (!eOk && !dOk) return '';

    const eTd = `<td>${eOk ? fmt(e) : '—'}</td>`;
    const dTd = `<td>${dOk ? fmt(d) : '—'}</td>`;

    let asymTd;
    if (!eOk || !dOk) {
      asymTd = '<td><span class="gcv2-dyn-unilateral">unilateral</span></td>';
    } else {
      const { pct, lado } = asymmetry(e, d);
      const cls = asymClass(pct);
      const texto = lado ? `${pct}% ${lado}` : `${pct}%`;
      asymTd = cls
        ? `<td class="${cls}">${texto}</td>`
        : `<td>${texto}</td>`;
    }

    return `<tr><td>${label}</td>${eTd}${dTd}${asymTd}</tr>`;
  }

  // ── Render da tabela completa ─────────────────────────────────────────────

  const MOVIMENTOS = [
    { key: 'flex', label: 'Flexão'          },
    { key: 'abd',  label: 'Abdução'         },
    { key: 'ext',  label: 'Extensão'        },
    { key: 're',   label: 'Rotação Externa' },
    { key: 'ri',   label: 'Rotação Interna' },
  ];

  function renderTable(dyn) {
    let rows = '';
    for (const m of MOVIMENTOS) {
      const mv = dyn[m.key] || {};
      const e = (mv.e !== undefined && mv.e !== null) ? Number(mv.e) : null;
      const d = (mv.d !== undefined && mv.d !== null) ? Number(mv.d) : null;
      rows += renderRow(m.label, e, d);
    }

    if (!rows) {
      return '<p class="gcv2-dyn-empty">Sem dados de dinamometria registados.</p>';
    }

    return `<table class="gcv2-dyn-table">
<thead>
<tr><th>Movimento</th><th>Esquerda</th><th>Direita</th><th>Assimetria</th></tr>
</thead>
<tbody>
${rows}
</tbody>
</table>`;
  }

  // ── Desescapar HTML entities do atributo data-dyn-json ────────────────────

  function unescAttr(s) {
    return s
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  // ── Função principal ──────────────────────────────────────────────────────

  function hydrate(root) {
    const container = root || document;
    const mounts = container.querySelectorAll('.gcv2-ombro-dyn-mount');

    mounts.forEach(function (el) {
      if (el.dataset.dynRendered === '1') return;

      const raw = el.getAttribute('data-dyn-json') || '';
      let dyn;
      try {
        dyn = JSON.parse(unescAttr(raw));
      } catch (err) {
        console.warn('[gcv2-dyn] JSON inválido:', err);
        el.innerHTML = '';
        return;
      }

      el.innerHTML = renderTable(dyn);
      el.dataset.dynRendered = '1';
    });
  }

  window.gcv2HydrateDynTables = hydrate;

})();
