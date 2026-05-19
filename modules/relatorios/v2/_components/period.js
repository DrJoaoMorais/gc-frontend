// =================================================================
// period.js  ·  Componente universal v2
// Selector de período para atestados e relatórios
// =================================================================
// Função pura: recebe estado, devolve HTML + helpers de formatação.
// Suporta dois modos alternativos:
//   - 'duration': N dias/semanas/meses
//   - 'interval': desde DATA até DATA
//
// Uso típico:
//   const html = buildPeriodEditor({ state: periodState, idPrefix: 'gcv2per' });
//   // ... inserir html no DOM ...
//   // ler depois com readPeriodState(idPrefix)
//   // formatar para texto final com formatPeriodPt(state)
// =================================================================

const escAttr = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Estado por defeito do período.
 */
export function defaultPeriodState() {
  return {
    mode: 'interval',      // 'duration' | 'interval'
    duration: { n: 7, unit: 'dias' },   // unit: 'dias' | 'semanas' | 'meses'
    interval: { from: todayISO(), to: todayISO() },
  };
}

/**
 * Renderiza o editor de período como bloco HTML.
 * @param {object} opts
 * @param {object} [opts.state] - estado actual (usa default se omitido)
 * @param {string} [opts.idPrefix='gcv2per'] - prefixo para IDs (permite múltiplos no mesmo ecrã)
 */
export function buildPeriodEditor({ state, idPrefix = 'gcv2per' } = {}) {
  const s = state || defaultPeriodState();
  const p = escAttr(idPrefix);

  const isDuration = s.mode === 'duration';

  return `
    <div class="gcv2-period-editor" data-gcv2-period="${p}">
      <div class="gcv2-period-modes">
        <label class="gcv2-period-mode">
          <input type="radio" name="${p}-mode" value="duration" ${isDuration ? 'checked' : ''}>
          <span>Por duração</span>
        </label>
        <label class="gcv2-period-mode">
          <input type="radio" name="${p}-mode" value="interval" ${!isDuration ? 'checked' : ''}>
          <span>Por intervalo de datas</span>
        </label>
      </div>

      <div class="gcv2-period-fields gcv2-period-duration" ${isDuration ? '' : 'hidden'}>
        <input type="number" id="${p}-n" min="1" step="1"
               value="${escAttr(s.duration?.n ?? 7)}"
               class="gcv2-input gcv2-input-num">
        <select id="${p}-unit" class="gcv2-input">
          <option value="dias"    ${s.duration?.unit === 'dias'    ? 'selected' : ''}>dias</option>
          <option value="semanas" ${s.duration?.unit === 'semanas' ? 'selected' : ''}>semanas</option>
          <option value="meses"   ${s.duration?.unit === 'meses'   ? 'selected' : ''}>meses</option>
        </select>
      </div>

      <div class="gcv2-period-fields gcv2-period-interval" ${!isDuration ? '' : 'hidden'}>
        <label class="gcv2-period-label">
          <span>De</span>
          <input type="date" id="${p}-from"
                 value="${escAttr(s.interval?.from || todayISO())}"
                 class="gcv2-input gcv2-input-date">
        </label>
        <label class="gcv2-period-label">
          <span>até</span>
          <input type="date" id="${p}-to"
                 value="${escAttr(s.interval?.to || todayISO())}"
                 class="gcv2-input gcv2-input-date">
        </label>
      </div>
    </div>
  `.trim();
}

/**
 * Liga handlers de mudança de modo (mostrar/esconder secções).
 * Deve ser chamado após o HTML estar no DOM.
 */
export function bindPeriodEditor({ idPrefix = 'gcv2per', onChange } = {}) {
  const root = document.querySelector(`[data-gcv2-period="${idPrefix}"]`);
  if (!root) return;

  const dur = root.querySelector('.gcv2-period-duration');
  const itv = root.querySelector('.gcv2-period-interval');

  root.querySelectorAll(`input[name="${idPrefix}-mode"]`).forEach(r => {
    r.addEventListener('change', () => {
      const isDur = r.value === 'duration' && r.checked;
      if (r.checked) {
        if (r.value === 'duration') { dur.hidden = false; itv.hidden = true; }
        else                        { dur.hidden = true;  itv.hidden = false; }
        if (typeof onChange === 'function') onChange(readPeriodState(idPrefix));
      }
    });
  });

  ['change', 'input'].forEach(ev => {
    root.querySelectorAll('input, select').forEach(el => {
      el.addEventListener(ev, () => {
        if (typeof onChange === 'function') onChange(readPeriodState(idPrefix));
      });
    });
  });
}

/**
 * Lê o estado actual do DOM.
 */
export function readPeriodState(idPrefix = 'gcv2per') {
  const root = document.querySelector(`[data-gcv2-period="${idPrefix}"]`);
  if (!root) return defaultPeriodState();

  const mode = root.querySelector(`input[name="${idPrefix}-mode"]:checked`)?.value || 'interval';
  const n    = parseInt(root.querySelector(`#${idPrefix}-n`)?.value, 10);
  const unit = root.querySelector(`#${idPrefix}-unit`)?.value || 'dias';
  const from = root.querySelector(`#${idPrefix}-from`)?.value || todayISO();
  const to   = root.querySelector(`#${idPrefix}-to`)?.value || todayISO();

  return {
    mode,
    duration: { n: Number.isFinite(n) ? n : 7, unit },
    interval: { from, to },
  };
}

/**
 * Formata o período em texto português para inserir na frase do atestado.
 * Exemplos:
 *   - "durante um período de 7 dias"
 *   - "desde 19 de Maio de 2026 até 26 de Maio de 2026"
 */
export function formatPeriodPt(state) {
  const s = state || defaultPeriodState();

  if (s.mode === 'duration') {
    const n = s.duration?.n ?? 7;
    const unit = s.duration?.unit || 'dias';
    return `durante um período de ${n} ${unit}`;
  }

  const fmt = (iso) => {
    const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
  };

  const from = fmt(s.interval?.from);
  const to   = fmt(s.interval?.to);
  if (!from || !to) return '';
  return `desde ${from} até ${to}`;
}

// Expor globalmente
if (typeof window !== 'undefined') {
  window.__gcv2_buildPeriodEditor  = buildPeriodEditor;
  window.__gcv2_bindPeriodEditor   = bindPeriodEditor;
  window.__gcv2_readPeriodState    = readPeriodState;
  window.__gcv2_formatPeriodPt     = formatPeriodPt;
  window.__gcv2_defaultPeriodState = defaultPeriodState;
}
