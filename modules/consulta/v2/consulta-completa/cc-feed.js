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

/* ============================================================
   RENDER DEDICADO DO OMBRO
   Conhece o recheio do exame de ombro. Calcula Δ, % do normal e
   assimetria E/D, escolhe cores semânticas e monta o HTML com as
   classes cc-omb-*. Só é chamado quando assessment_type==='ombro';
   o resto cai no render genérico acima.
   ============================================================ */

/* Amplitudes normais do ombro (graus). Confirmadas com a origem
   dos dados (resumo do ombro.html). */
const OMB_ROM_NORMAL = { flex: 180, ext: 60, abd: 180, re: 90, ri: 90 };
const OMB_ROM_ORDEM = [
  { ch: 'flex', rot: 'Flexão' },
  { ch: 'ext',  rot: 'Extensão' },
  { ch: 'abd',  rot: 'Abdução' },
  { ch: 're',   rot: 'Rotação externa' },
  { ch: 'ri',   rot: 'Rotação interna' },
];

/* MRC: mapa chave→movimento confirmado no ombro.html (linha 188).
   ATENÇÃO: del=Rotação externa, inf=Abdução (não trocar). */
const OMB_MRC_ORDEM = [
  { ch: 'sup', rot: 'Flexão' },
  { ch: 'inf', rot: 'Abdução' },
  { ch: 'sub', rot: 'Rotação interna' },
  { ch: 'del', rot: 'Rotação externa' },
  { ch: 'ext', rot: 'Extensão' },
];

/* Palpação: chave→estrutura anatómica. */
const OMB_PALP_ORDEM = [
  { ch: 'ac',  rot: 'Articulação AC' },
  { ch: 'tb',  rot: 'Tubérculo maior' },
  { ch: 'bic', rot: 'Sulco bicipital' },
  { ch: 'bur', rot: 'Bursa subacromial' },
  { ch: 'sup', rot: 'Supra-espinhoso' },
];

/* Funcional: chave→actividade. */
const OMB_FUNC_ORDEM = [
  { ch: 'elev', rot: 'Elevação acima da cabeça' },
  { ch: 'cos',  rot: 'Alcançar costas' },
  { ch: 'vest', rot: 'Vestir camisola' },
  { ch: 'prof', rot: 'Actividade profissional' },
  { ch: 'desp', rot: 'Actividade desportiva' },
  { ch: 'cond', rot: 'Conduzir' },
];

/* Testes especiais: chave→nome do teste. */
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

/* Movimentos da dinamometria: chave→rótulo (só aparecem os com dados). */
const OMB_DYN_ORDEM = [
  { ch: 'flex', rot: 'Flexão' },
  { ch: 'ext',  rot: 'Extensão' },
  { ch: 'abd',  rot: 'Abdução' },
  { ch: 'adu',  rot: 'Adução' },
  { ch: 're',   rot: 'Rotação externa' },
  { ch: 'ri',   rot: 'Rotação interna' },
];

/* Tem valor? (0 é valor válido; null/''/undefined não.) */
function ombTem(v) { return v != null && v !== ''; }

/* Cor pela % do normal: verde ≥90, âmbar 70–89, vermelho <70. */
function ombCorPct(pct) {
  if (pct >= 90) return 'cc-v-verde';
  if (pct >= 70) return 'cc-v-ambar';
  return 'cc-v-vermelho';
}

/* Cor do MRC: 5/5 verde, 4/5 âmbar, ≤3/5 vermelho. */
function ombCorMRC(valor) {
  const n = parseInt(String(valor), 10);
  if (isNaN(n)) return '';
  if (n >= 5) return 'cc-v-verde';
  if (n >= 4) return 'cc-v-ambar';
  return 'cc-v-vermelho';
}

/* Cor de achado dor/sem dor / com dor/dificuldade/normal. */
function ombCorAchado(valor) {
  const s = String(valor).toLowerCase();
  if (s.includes('sem dor') || s === 'normal' || s === 'sem dificuldade') return 'cc-v-verde';
  if (s.includes('dificuldade')) return 'cc-v-ambar';
  if (s.includes('dor')) return 'cc-v-vermelho';
  return '';
}

/* Cor dos testes especiais por intensidade de cruzes. */
function ombCorTeste(valor) {
  const cruzes = (String(valor).match(/\+/g) || []).length;
  if (cruzes >= 3) return 'cc-v-vermelho';
  if (cruzes === 2) return 'cc-v-ambar';
  if (cruzes === 1) return 'cc-v-verde';
  return '';
}

/* Cor da assimetria pela magnitude absoluta: <10 verde, 10–20 âmbar, >20 vermelho. */
function ombCorAssim(absPct) {
  if (absPct < 10) return 'cc-v-verde';
  if (absPct <= 20) return 'cc-v-ambar';
  return 'cc-v-vermelho';
}

/* ----- secção: chips de topo ----- */
function ombChips(d) {
  const chips = [];
  if (ombTem(d.tipo_dor)) chips.push(`<span class="cc-omb-chip">Dor ${escapeTexto(String(d.tipo_dor).toLowerCase())}</span>`);
  const loc = Array.isArray(d.localizacao_dor) ? d.localizacao_dor : (ombTem(d.localizacao_dor) ? [d.localizacao_dor] : []);
  if (loc.length) chips.push(`<span class="cc-omb-chip">${loc.map(x => escapeTexto(String(x).toLowerCase())).join(' · ')}</span>`);
  if (ombTem(d.irradiacao)) chips.push(`<span class="cc-omb-chip">Irradia ${escapeTexto(String(d.irradiacao).toLowerCase())}</span>`);
  const eva = d.eva || {};
  if (ombTem(eva.rep) || ombTem(eva.act) || ombTem(eva.pic)) {
    const partes = [];
    if (ombTem(eva.rep)) partes.push(`repouso ${escapeTexto(eva.rep)}`);
    if (ombTem(eva.act)) partes.push(`actividade ${escapeTexto(eva.act)}`);
    if (ombTem(eva.pic)) partes.push(`pico ${escapeTexto(eva.pic)}`);
    chips.push(`<span class="cc-omb-chip cc-omb-chip-eva">EVA: ${partes.join(' · ')}</span>`);
  }
  if (!chips.length) return '';
  return `<div class="cc-omb-chips">${chips.join('')}</div>`;
}

/* ----- secção: chips de achados (palpação, funcional) ----- */
function ombChipsAchados(rotulo, obj, ordem) {
  if (!obj) return '';
  const itens = ordem
    .filter(o => ombTem(obj[o.ch]))
    .map(o => `<span class="cc-omb-item">${escapeTexto(o.rot)} <span class="cc-omb-item-val ${ombCorAchado(obj[o.ch])}">· ${escapeTexto(String(obj[o.ch]).toLowerCase())}</span></span>`);
  if (!itens.length) return '';
  return `
    <div class="cc-omb-seccao">
      <p class="cc-omb-rotulo">${rotulo}</p>
      <div class="cc-omb-itens">${itens.join('')}</div>
    </div>`;
}

/* ----- secção: MRC ----- */
function ombMRC(mrc) {
  if (!mrc) return '';
  const itens = OMB_MRC_ORDEM
    .filter(o => ombTem(mrc[o.ch]))
    .map(o => `<span class="cc-omb-item">${escapeTexto(o.rot)} <strong class="cc-omb-item-val ${ombCorMRC(mrc[o.ch])}">${escapeTexto(mrc[o.ch])}</strong></span>`);
  if (!itens.length) return '';
  return `
    <div class="cc-omb-seccao">
      <p class="cc-omb-rotulo">Força muscular (MRC)</p>
      <div class="cc-omb-itens">${itens.join('')}</div>
    </div>`;
}

/* ----- secção: testes especiais ----- */
function ombTestes(testes) {
  if (!testes) return '';
  const itens = OMB_TESTES_ORDEM
    .filter(o => ombTem(testes[o.ch]))
    .map(o => `<span class="cc-omb-item cc-omb-item-compacto">${escapeTexto(o.rot)} <strong class="cc-omb-item-val ${ombCorTeste(testes[o.ch])}">${escapeTexto(testes[o.ch])}</strong></span>`);
  if (!itens.length) return '';
  return `
    <div class="cc-omb-seccao">
      <p class="cc-omb-rotulo">Testes especiais</p>
      <div class="cc-omb-itens cc-omb-itens-compacto">${itens.join('')}</div>
    </div>`;
}

/* ----- secção: amplitude articular (ROM) ----- */
function ombROM(rom) {
  if (!rom) return '';
  const linhas = OMB_ROM_ORDEM.map(o => {
    const a = rom[`${o.ch}_a`];
    const p = rom[`${o.ch}_p`];
    if (!ombTem(a) && !ombTem(p)) return null;
    const norm = OMB_ROM_NORMAL[o.ch];
    const delta = (ombTem(a) && ombTem(p)) ? (Number(p) - Number(a)) : null;
    const pct = (ombTem(a) && norm) ? Math.round((Number(a) / norm) * 100) : null;
    const corA = pct != null ? ombCorPct(pct) : '';
    return `
      <tr>
        <td>${escapeTexto(o.rot)}</td>
        <td class="cc-omb-td-forte ${corA}">${ombTem(a) ? escapeTexto(a) + '°' : '—'}</td>
        <td>${ombTem(p) ? escapeTexto(p) + '°' : '—'}</td>
        <td class="cc-omb-td-tenue">${delta != null ? delta + '°' : '—'}</td>
        <td class="cc-omb-td-tenue">${norm}°</td>
        <td class="cc-omb-td-forte ${corA}">${pct != null ? pct + '%' : '—'}</td>
      </tr>`;
  }).filter(Boolean);
  if (!linhas.length) return '';
  return `
    <div class="cc-omb-seccao">
      <p class="cc-omb-rotulo">Amplitude articular</p>
      <table class="cc-omb-tabela">
        <thead><tr>
          <th>Movimento</th><th>Activo</th><th>Passivo</th><th>Δ</th><th>Normal</th><th>% normal</th>
        </tr></thead>
        <tbody>${linhas.join('')}</tbody>
      </table>
    </div>`;
}

/* ----- secção: dinamometria ----- */
function ombDyn(dyn) {
  if (!dyn) return '';
  const linhas = OMB_DYN_ORDEM.map(o => {
    const m = dyn[o.ch];
    if (!m || (!ombTem(m.e) && !ombTem(m.d))) return null;
    let assim = '—', corAssim = '';
    if (ombTem(m.e) && ombTem(m.d) && Number(m.e) !== 0) {
      const pct = ((Number(m.d) - Number(m.e)) / Number(m.e)) * 100;
      const abs = Math.abs(pct);
      const ladoFraco = pct < 0 ? 'D' : (pct > 0 ? 'E' : null);
      corAssim = ombCorAssim(abs);
      assim = ladoFraco
        ? `${Math.round(abs)}% · ${ladoFraco} mais fraco`
        : 'simétrico';
    }
    return `
      <tr>
        <td>${escapeTexto(o.rot)}</td>
        <td>${ombTem(m.e) ? escapeTexto(m.e) : '—'}</td>
        <td>${ombTem(m.d) ? escapeTexto(m.d) : '—'}</td>
        <td class="cc-omb-td-forte ${corAssim}">${assim}</td>
      </tr>`;
  }).filter(Boolean);
  if (!linhas.length) return '';
  return `
    <div class="cc-omb-seccao">
      <p class="cc-omb-rotulo">Dinamometria <span class="cc-omb-rotulo-norm">(ActivForce 2)</span></p>
      <table class="cc-omb-tabela">
        <thead><tr>
          <th>Movimento</th><th>Esq. (kg)</th><th>Dir. (kg)</th><th>Assimetria</th>
        </tr></thead>
        <tbody>${linhas.join('')}</tbody>
      </table>
    </div>`;
}

/* ----- secção: escalas funcionais + interpretação ----- */
function ombEscalas(escalas) {
  if (!escalas) return '';
  const oss = escalas.oss_score, ases = escalas.ases_score, dash = escalas.dash_score;
  if (!ombTem(oss) && !ombTem(ases) && !ombTem(dash)) return '';

  const faixaOSS = (v) => {
    const n = Number(v);
    if (n >= 40) return '<span class="cc-omb-escala-faixa cc-omb-escala-faixa-verde">Excelente (40–48)</span>';
    if (n >= 30) return '<span class="cc-omb-escala-faixa">Bom (30–39)</span>';
    if (n >= 20) return '<span class="cc-omb-escala-faixa">Moderado (20–29)</span>';
    return '<span class="cc-omb-escala-faixa">Fraco (0–19)</span>';
  };

  const cartoes = [];
  if (ombTem(oss)) cartoes.push(`
    <div class="cc-omb-escala">
      <p class="cc-omb-escala-nome">OSS</p>
      <p class="cc-omb-escala-valor">${escapeTexto(oss)}<span class="cc-omb-escala-max">/48</span></p>
      ${faixaOSS(oss)}
    </div>`);
  if (ombTem(ases)) cartoes.push(`
    <div class="cc-omb-escala">
      <p class="cc-omb-escala-nome">ASES</p>
      <p class="cc-omb-escala-valor">${escapeTexto(ases)}<span class="cc-omb-escala-max">/100</span></p>
      <p class="cc-omb-escala-faixa">Normativo ~92</p>
    </div>`);
  if (ombTem(dash)) cartoes.push(`
    <div class="cc-omb-escala">
      <p class="cc-omb-escala-nome">DASH</p>
      <p class="cc-omb-escala-valor">${escapeTexto(dash)}<span class="cc-omb-escala-max">/100</span></p>
      <p class="cc-omb-escala-faixa">MCID ~10 pts</p>
    </div>`);

  return `
    <div class="cc-omb-seccao">
      <p class="cc-omb-rotulo">Escalas funcionais</p>
      <div class="cc-omb-escalas">${cartoes.join('')}</div>
      <div class="cc-omb-interp">
        <p class="cc-omb-interp-rotulo">Interpretação clínica das escalas</p>
        <p class="cc-omb-interp-texto">Caixa sempre escrita pelo médico — nunca automática.</p>
      </div>
    </div>`;
}

/* Monta o registo de ombro completo. */
function renderOmbro(ex, idx) {
  const d = ex.data || {};
  const ladoTxt = d.lado ? ` ${escapeTexto(d.lado).toLowerCase()}` : (ex.assessment_side ? ` ${escapeTexto(ex.assessment_side)}` : '');
  const data = formatarData(ex.assessment_date);

  let corpo = ''
    + ombChips(d)
    + ombChipsAchados('Palpação', d.palp, OMB_PALP_ORDEM)
    + ombROM(d.rom)
    + ombMRC(d.mrc)
    + ombDyn(d.dyn)
    + ombTestes(d.testes)
    + ombChipsAchados('Funcional', d.func, OMB_FUNC_ORDEM)
    + ombEscalas(d.escalas);

  if (!corpo.trim()) {
    corpo = `<p class="cc-vazio">Exame de ombro sem campos preenchidos.</p>`;
  }

  return `
    <div class="cc-exame-registo">
      <div class="cc-omb-cabec">
        <i class="cc-omb-icon">⚕</i>
        <span class="cc-omb-titulo">Exame objectivo — ombro${ladoTxt}</span>
        <span class="cc-omb-data">${data}</span>
        ${idx > 0 ? '<span class="cc-exame-nota">registo anterior</span>' : ''}
      </div>
      ${corpo}
    </div>`;
}

export function preencherExame(el, exames) {
  if (!exames?.length) {
    el.innerHTML = `<p class="cc-vazio">Sem exame objectivo registado.</p>`;
    return;
  }

  el.innerHTML = exames.map((ex, idx) => {
    // Render dedicado por região (rede de segurança: o resto cai no genérico).
    if ((ex.assessment_type || '').toLowerCase() === 'ombro') {
      return renderOmbro(ex, idx);
    }

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

/* ---------- BLOCO PROTOCOLO E OBJECTIVOS ---------- */
/* Render de leitura. Objectivos = ALVOS da fase; o valor de hoje
   vem do exame (bloco acima). 3 colunas: objectivos · contra · HEP. */
function protItens(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map(x => (x && typeof x === 'object') ? (x.label || '') : x)
    .filter(s => s != null && String(s).trim() !== '');
}

function protColuna(rotulo, itens, classeItem) {
  const li = protItens(itens);
  if (!li.length) return ''; // coluna vazia não aparece
  const linhas = li.map(t => `<li class="${classeItem}">${escapeTexto(t)}</li>`).join('');
  return `
    <div class="cc-prot-col">
      <p class="cc-prot-col-rotulo">${escapeTexto(rotulo)}</p>
      <ul class="cc-prot-lista">${linhas}</ul>
    </div>`;
}

/* ---------- OBJECTIVOS DA PRÓXIMA SÉRIE (camada de escrita) ---------- */
/* Semeados pela fase (objetivos_serie), sempre editáveis. F1: só mostra,
   ainda NÃO grava. Mensuráveis ligam a um parâmetro do exame. */
const SERIE_PARAM_ROTULO = {
  'rom.flex_a': 'Flexão activa',  'rom.flex_p': 'Flexão passiva',
  'rom.abd_a':  'Abdução activa', 'rom.abd_p':  'Abdução passiva',
  'rom.ext_a':  'Extensão activa','rom.ext_p':  'Extensão passiva',
  'rom.re_a':   'Rotação externa activa', 'rom.re_p': 'Rotação externa passiva',
  'rom.ri_a':   'Rotação interna activa', 'rom.ri_p': 'Rotação interna passiva',
  'eva.rep': 'Dor em repouso (EVA)', 'eva.act': 'Dor em actividade (EVA)',
  'eva.pic': 'Dor de pico (EVA)',
};

/* Unidade implícita pelo parâmetro: ROM em graus, EVA em /10. */
function serieParamUnidade(p) {
  if (!p) return '';
  if (p.startsWith('eva.')) return '/10';
  if (p.startsWith('rom.')) return '°';
  return '';
}

/* <option>s do parâmetro, agrupados (mobilidade / dor), com o actual escolhido. */
function serieParamOpcoes(sel) {
  const grupos = [
    ['Mobilidade', ['rom.flex_a','rom.flex_p','rom.abd_a','rom.abd_p','rom.ext_a','rom.ext_p','rom.re_a','rom.re_p','rom.ri_a','rom.ri_p']],
    ['Dor', ['eva.rep','eva.act','eva.pic']],
  ];
  let html = `<option value=""${!sel ? ' selected' : ''}>— escolher parâmetro —</option>`;
  for (const [g, chaves] of grupos) {
    html += `<optgroup label="${g}">`;
    for (const ch of chaves) {
      html += `<option value="${ch}"${sel === ch ? ' selected' : ''}>${escapeTexto(SERIE_PARAM_ROTULO[ch] || ch)}</option>`;
    }
    html += `</optgroup>`;
  }
  return html;
}

function serieLinha(o, marcado = true) {
  const tipo = o.tipo === 'qualitativo' ? 'qualitativo' : 'mensuravel';
  const manual = o.origem === 'manual';
  const badge = tipo === 'mensuravel'
    ? '<span class="cc-serie-tag cc-serie-tag-mens">Mensurável</span>'
    : '<span class="cc-serie-tag cc-serie-tag-qual">Qualitativo</span>';

  let alvo = '';
  if (tipo === 'mensuravel') {
    const op = o.op || '>=';
    const opSel = [['>=','≥'],['<=','≤'],['=','=']].map(([v, sym]) =>
      `<option value="${v}"${op === v ? ' selected' : ''}>${sym}</option>`).join('');
    const unid = o.unidade || serieParamUnidade(o.param);
    alvo = `
      <div class="cc-serie-alvo">
        <select class="cc-serie-param">${serieParamOpcoes(o.param)}</select>
        <select class="cc-serie-op">${opSel}</select>
        <input class="cc-serie-valor" type="text" value="${escapeTexto(o.valor)}" />
        <span class="cc-serie-unid">${escapeTexto(unid)}</span>
        <span class="cc-serie-auto">real automático do exame seguinte</span>
      </div>`;
  } else if (o.escala === 'graduado') {
    alvo = `<div class="cc-serie-alvo"><span class="cc-serie-nota">graduado + / ++ / +++ — marca-se na próxima consulta${o.alvo ? ' · alvo: ' + escapeTexto(o.alvo) : ''}</span></div>`;
  } else {
    alvo = `<div class="cc-serie-alvo"><span class="cc-serie-nota">cumprido / não — marca-se na próxima consulta</span></div>`;
  }

  const nota = o.nota ? `<p class="cc-serie-obs">${escapeTexto(o.nota)}</p>` : '';

  const attrs = [
    `data-id="${escapeTexto(o.id || '')}"`,
    `data-tipo="${tipo}"`,
    `data-origem="${escapeTexto(o.origem || 'fase')}"`,
    (tipo === 'qualitativo') ? `data-escala="${escapeTexto(o.escala || 'binario')}"` : '',
    (tipo === 'qualitativo' && o.alvo) ? `data-alvo="${escapeTexto(o.alvo)}"` : '',
    o.nota ? `data-nota="${escapeTexto(o.nota)}"` : '',
  ].filter(Boolean).join(' ');

  const origemTag = manual
    ? `<span class="cc-serie-origem cc-serie-origem-seu">seu</span>`
    : '';
  const remover = manual
    ? `<button type="button" class="cc-serie-remover" aria-label="remover" title="remover">✕</button>`
    : '';

  return `
    <div class="cc-serie-linha cc-serie-linha-compacta${manual ? ' cc-serie-linha-manual' : ''}${marcado ? '' : ' cc-serie-linha-fora'}" ${attrs}>
      <input class="cc-serie-check" type="checkbox" ${marcado ? 'checked' : ''} />
      ${badge}
      <input class="cc-serie-texto" type="text" value="${escapeTexto(o.texto || '')}" ${manual ? 'placeholder="o seu objectivo…"' : ''} />
      ${alvo}
      ${manual ? `<span class="cc-serie-origem-fim">${origemTag}${remover}</span>` : ''}
      ${nota}
    </div>`;
}

function protSerie(lista) {
  if (!Array.isArray(lista) || !lista.length) return '';
  const linhas = lista.map(x => serieLinha(x.o, x.marcado)).join('');
  return `
    <div class="cc-serie">
      <p class="cc-serie-titulo">Objectivos da próxima série</p>
      <p class="cc-serie-ajuda">A lista da fase aparece sempre. Sem visto = fica de fora, mas continua à vista. Acrescente os seus em baixo.</p>
      <div class="cc-serie-linhas">${linhas}</div>
      <div class="cc-serie-rodape">
        <button type="button" class="cc-serie-add" data-tipo="mensuravel">+ Mensurável</button>
        <button type="button" class="cc-serie-add" data-tipo="qualitativo">+ Qualitativo</button>
        <button type="button" class="cc-serie-guardar">Guardar objectivos</button>
        <span class="cc-serie-estado" aria-live="polite"></span>
      </div>
    </div>`;
}

/* Lê as linhas com visto e reconstrói os objectivos a gravar.
   Linhas sem texto são ignoradas (ex. uma acrescentada e deixada em branco). */
function lerSerieLinhas(scope) {
  return [...scope.querySelectorAll('.cc-serie-linha')]
    .filter(l => l.querySelector('.cc-serie-check')?.checked)
    .map(l => {
      const tipo = l.dataset.tipo === 'qualitativo' ? 'qualitativo' : 'mensuravel';
      const o = {
        id: l.dataset.id || '',
        tipo,
        texto: (l.querySelector('.cc-serie-texto')?.value || '').trim(),
        origem: l.dataset.origem || 'fase',
      };
      if (tipo === 'mensuravel') {
        const param = l.querySelector('.cc-serie-param')?.value || '';
        o.param = param;
        o.op = l.querySelector('.cc-serie-op')?.value || '>=';
        const v = (l.querySelector('.cc-serie-valor')?.value || '').trim();
        o.valor = v === '' ? null : (isNaN(Number(v)) ? v : Number(v));
        o.unidade = serieParamUnidade(param);
      } else {
        o.escala = l.dataset.escala || 'binario';
        if (l.dataset.alvo) o.alvo = l.dataset.alvo;
      }
      if (l.dataset.nota) o.nota = l.dataset.nota;
      return o;
    })
    .filter(o => o.texto);
}

/* Grava os objectivos escolhidos em consultation_protocols.data.objectivos.
   Só toca na chave 'objectivos'; o resto da fase mantém-se via merge na query. */
async function guardarSerie(scope, protocoloId, estadoEl) {
  const sb = window.sb;
  const diz = (txt, cls) => { if (estadoEl) { estadoEl.textContent = txt; estadoEl.className = 'cc-serie-estado ' + (cls || ''); } };
  if (!sb) { diz('Supabase não disponível.', 'cc-serie-erro'); return; }
  if (!protocoloId) { diz('Sem registo de protocolo para gravar.', 'cc-serie-erro'); return; }
  const objectivos = lerSerieLinhas(scope);
  diz('A guardar…');
  try {
    const { data: rows, error } = await sb
      .from('consultation_protocols')
      .select('data')
      .eq('id', protocoloId)
      .single();
    if (error) throw error;
    const novaData = { ...(rows?.data || {}), objectivos };
    const { data: upd, error: e2 } = await sb
      .from('consultation_protocols')
      .update({ data: novaData })
      .eq('id', protocoloId)
      .select('id');
    if (e2) throw e2;
    if (!upd || !upd.length) throw new Error('Sem permissão ou registo não encontrado (RLS).');
    diz(`Guardado ✓ (${objectivos.length})`, 'cc-serie-ok');
  } catch (e) {
    diz('Erro a guardar: ' + (e.message || e), 'cc-serie-erro');
  }
}

export function preencherProtocolo(el, protocolo) {
  if (!protocolo || !protocolo.fase) {
    el.innerHTML = `<p class="cc-vazio">Sem protocolo associado.</p>`;
    return;
  }
  const f = protocolo.fase;
  const d = f.dados || {};
  const semanas = (f.ancora_de != null && f.ancora_ate != null)
    ? `${f.ancora_de}–${f.ancora_ate} sem` : '';

  const chips = `
    <div class="cc-prot-chips">
      <span class="cc-prot-chip cc-prot-chip-nome">${escapeTexto(protocolo.nome)}</span>
      ${semanas ? `<span class="cc-prot-chip">${escapeTexto(semanas)}</span>` : ''}
      <span class="cc-prot-chip cc-prot-chip-fase">Fase ${escapeTexto(f.ordem)} — ${escapeTexto(f.nome)}</span>
    </div>`;

  const colunas = ''
    + protColuna('Objetivos da fase', d.objetivos, 'cc-prot-obj')
    + protColuna('Contraindicações absolutas', d.contraindicacoes, 'cc-prot-contra')
    + protColuna('Programa para casa (HEP)', d.hep, 'cc-prot-hep');

  const corpo = colunas.trim()
    ? `<div class="cc-prot-colunas">${colunas}</div>`
    : `<p class="cc-vazio">Fase sem conteúdo preenchido.</p>`;

  // Semente sempre visível; o guardado sobrepõe-se por id (marcado + valores);
  // os manuais (guardados fora da semente) vão para o fim.
  const seed = Array.isArray(d.objetivos_serie) ? d.objetivos_serie : [];
  const guardados = Array.isArray(d.objectivos) ? d.objectivos : null;
  let lista;
  if (!guardados) {
    lista = seed.map(o => ({ o, marcado: true }));
  } else {
    const mapa = {};
    guardados.forEach(o => { if (o.id) mapa[o.id] = o; });
    lista = seed.map(o => mapa[o.id] ? { o: mapa[o.id], marcado: true } : { o, marcado: false });
    const idsSeed = new Set(seed.map(o => o.id));
    guardados.filter(o => !idsSeed.has(o.id)).forEach(o => lista.push({ o, marcado: true }));
  }
  const serie = protSerie(lista);
  el.innerHTML = `<div class="cc-prot">${chips}${corpo}${serie}</div>`;

  const serieEl = el.querySelector('.cc-serie');
  if (serieEl) {
    const estado = serieEl.querySelector('.cc-serie-estado');
    const linhasEl = serieEl.querySelector('.cc-serie-linhas');

    serieEl.querySelector('.cc-serie-guardar')
      ?.addEventListener('click', () => guardarSerie(serieEl, protocolo.id, estado));

    serieEl.querySelectorAll('.cc-serie-add').forEach(b => {
      b.addEventListener('click', () => {
        const tipo = b.dataset.tipo === 'qualitativo' ? 'qualitativo' : 'mensuravel';
        const base = { id: 'm' + Date.now(), tipo, texto: '', origem: 'manual' };
        const novo = tipo === 'qualitativo'
          ? { ...base, escala: 'binario' }
          : { ...base, param: '', op: '>=', valor: '' };
        linhasEl.insertAdjacentHTML('beforeend', serieLinha(novo, true));
      });
    });

    serieEl.addEventListener('click', (e) => {
      const rm = e.target.closest('.cc-serie-remover');
      if (rm) rm.closest('.cc-serie-linha')?.remove();
    });

    serieEl.addEventListener('change', (e) => {
      const sel = e.target.closest('.cc-serie-param');
      if (sel) {
        const unid = sel.closest('.cc-serie-alvo')?.querySelector('.cc-serie-unid');
        if (unid) unid.textContent = serieParamUnidade(sel.value);
      }
    });
  }
}
