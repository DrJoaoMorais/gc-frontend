/* ============================================================
   Consulta Completa (V2) — cc-feed.js (ficheiro 2)
   Preenche os blocos do feed com os dados lidos. Modo leitura.
   ============================================================ */

/* HDA do Quill vem como HTML. Sanitização mínima: manter tags
   de formatação seguras, remover scripts. (Render, não edição.) */
function sanitizarHTML(html) {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  div.querySelectorAll('script, style, iframe, object, embed').forEach(n => n.remove());
  div.querySelectorAll('*').forEach(el => {
    [...el.attributes].forEach(a => {
      if (/^on/i.test(a.name) || (a.name === 'href' && /^javascript:/i.test(a.value))) {
        el.removeAttribute(a.name);
      }
    });
  });
  return div.innerHTML;
}

function escapeTexto(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
}

/* Etiqueta do sistema de codificação. "local"/vazio → ICD-9 por defeito. */
function etiquetaSistema(system) {
  const s = (system || '').toLowerCase();
  if (s.includes('10')) return 'ICD-10';
  if (s.includes('9')) return 'ICD-9';
  return 'ICD-9';
}

/* ---------- BLOCO HDA ---------- */
export function preencherHDA(el, consulta) {
  const hda = sanitizarHTML(consulta?.hda);
  el.innerHTML = hda
    ? `<div class="cc-hda">${hda}</div>`
    : `<p class="cc-vazio">Sem HDA registada.</p>`;
}

/* ---------- BLOCO DIAGNÓSTICO ---------- */
export function preencherDiagnostico(el, diagnosticos) {
  if (!diagnosticos?.length) {
    el.innerHTML = `<p class="cc-vazio">Sem diagnósticos.</p>`;
    return;
  }
  el.innerHTML = diagnosticos.map(d => `
    <div class="cc-diag-chip">
      <span class="cc-diag-sis">${etiquetaSistema(d.system)}</span>
      <span class="cc-diag-code">${escapeTexto(d.code)}</span>
      <span class="cc-diag-label">${escapeTexto(d.label)}</span>
    </div>`).join('');
}

/* ---------- BLOCO TRATAMENTO ---------- */
export function preencherTratamento(el, tratamentos) {
  if (!tratamentos?.length) {
    el.innerHTML = `<p class="cc-vazio">Sem tratamentos prescritos.</p>`;
    return;
  }
  const linhas = tratamentos.map(t => `
    <tr>
      <td class="cc-trat-code">${escapeTexto(t.code)}</td>
      <td>${escapeTexto(t.label)}</td>
      <td class="cc-trat-qty">${escapeTexto(t.qty)}</td>
    </tr>`).join('');
  el.innerHTML = `
    <table class="cc-tabela">
      <thead><tr><th>Código</th><th>Tratamento</th><th>Qtd.</th></tr></thead>
      <tbody>${linhas}</tbody>
    </table>`;
}

/* ---------- BLOCO EXAME OBJECTIVO (render genérico do jsonb) ---------- */
/* Conhece o ESQUELETO (secções), não o recheio. Mostra pares
   rótulo→valor que existirem; secção vazia não aparece. */
const SECCOES = [
  { chave: 'tipo_dor',        titulo: 'Tipo de dor' },
  { chave: 'localizacao_dor', titulo: 'Localização da dor' },
  { chave: 'irradiacao',      titulo: 'Irradiação' },
  { chave: 'd_noturna',       titulo: 'Dor nocturna' },
  { chave: 'eva',             titulo: 'EVA' },
  { chave: 'palp',            titulo: 'Palpação' },
  { chave: 'notas_palp',      titulo: 'Notas — palpação' },
  { chave: 'rom',             titulo: 'Amplitude articular' },
  { chave: 'notas_mob',       titulo: 'Notas — mobilidade' },
  { chave: 'mrc',             titulo: 'Força (MRC)' },
  { chave: 'notas_forca',     titulo: 'Notas — força' },
  { chave: 'dyn',             titulo: 'Dinamometria' },
  { chave: 'testes',          titulo: 'Testes especiais' },
  { chave: 'notas_testes',    titulo: 'Notas — testes' },
  { chave: 'func',            titulo: 'Funcional' },
  { chave: 'escalas',         titulo: 'Escalas funcionais' },
];

function formatarData(d) {
  if (!d) return '';
  const [a, m, dia] = String(d).split('-');
  return dia ? `${dia}/${m}/${a}` : d;
}

/* Mostra qualquer valor jsonb de forma legível, sem conhecer o recheio. */
function valorLegivel(v) {
  if (v == null || v === '') return null;
  if (Array.isArray(v)) {
    const itens = v.map(valorLegivel).filter(Boolean);
    return itens.length ? itens.join(' · ') : null;
  }
  if (typeof v === 'object') {
    const pares = Object.entries(v)
      .map(([k, val]) => {
        const lv = valorLegivel(val);
        return lv ? `${escapeTexto(k)}: ${lv}` : null;
      })
      .filter(Boolean);
    return pares.length ? pares.join(' · ') : null;
  }
  return escapeTexto(v);
}

function renderSeccao(titulo, conteudo) {
  const txt = valorLegivel(conteudo);
  if (!txt) return ''; // secção vazia não aparece
  return `
    <div class="cc-exame-seccao">
      <p class="cc-exame-rotulo">${titulo.toUpperCase()}</p>
      <div class="cc-exame-valor">${txt}</div>
    </div>`;
}

export function preencherExame(el, exames) {
  if (!exames?.length) {
    el.innerHTML = `<p class="cc-vazio">Sem exame objectivo registado.</p>`;
    return;
  }

  el.innerHTML = exames.map((ex, idx) => {
    const tipo = escapeTexto(ex.assessment_type || 'Exame');
    const lado = ex.assessment_side ? ` ${escapeTexto(ex.assessment_side)}` : '';
    const data = formatarData(ex.assessment_date);
    const dados = ex.data || {};

    let corpo = SECCOES.map(s => renderSeccao(s.titulo, dados[s.chave])).join('');
    // secções que existam no jsonb mas não estejam no esqueleto conhecido
    // (excluímos 'resumo' — texto duplicado — e 'lado' — já vai no cabeçalho)
    const IGNORAR = ['resumo', 'lado'];
    const extra = Object.keys(dados)
      .filter(k => !SECCOES.some(s => s.chave === k) && !IGNORAR.includes(k))
      .map(k => renderSeccao(k, dados[k])).join('');
    corpo += extra;

    if (!corpo.trim()) {
      corpo = `<p class="cc-vazio">Exame sem campos preenchidos.</p>`;
    }

    return `
      <div class="cc-exame-registo">
        <div class="cc-exame-cabec">
          <span class="cc-exame-tipo">${tipo}${lado}</span>
          <span class="cc-exame-data">${data}</span>
          ${idx > 0 ? '<span class="cc-exame-nota">registo anterior</span>' : ''}
        </div>
        ${corpo}
      </div>`;
  }).join('');
}
