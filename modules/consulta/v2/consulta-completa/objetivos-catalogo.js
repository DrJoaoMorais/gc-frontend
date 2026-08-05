/* =================================================================
   OBJETIVOS-CATALOGO.JS — Catálogo de 8 objetivos de consulta
   -----------------------------------------------------------------
   Componente autónomo. Sem gravação, sem leitura de `consultations`.
   Estado só em memória. Passo 2 do plano — só para revisão visual.

   Saída: array de {chave, valor, unidade}, entregue via onChange a
   cada alteração. É isto que o Passo 3 vai gravar em objectives_data
   e usar para gerar a frase automática em `objectives`.

   Pills reutilizam exactamente as classes .opts/.opt/.opt.sel e
   .eva-btns já em produção em modules/obj/regiao.html (Exame
   Objectivo) — mesmo nome de classe, mesma regra .sg (seleção
   única, clicar 2x desmarca) / .mg (seleção múltipla independente)
   usada em modules/obj/motor.js (_wireHandlers).
   ================================================================= */

const ADM_TREE = {
  'Ombro':        { movimentos: ['Flexão', 'Extensão', 'Abdução', 'Rotação externa', 'Rotação interna'] },
  'Cotovelo':     { movimentos: ['Flexão', 'Extensão', 'Pronação', 'Supinação'] },
  'Punho-mão':    { subregioes: {
                      'Punho':      ['Flexão palmar', 'Extensão', 'Desvio radial', 'Desvio cubital', 'Pronação', 'Supinação'],
                      'Mão global': ['Ponta-palma (cm)'],
                    } },
  'Anca':         { movimentos: ['Flexão', 'Extensão', 'Abdução', 'Adução', 'Rotação interna', 'Rotação externa'] },
  'Joelho':       { movimentos: ['Flexão', 'Extensão'] },
  'Tibiotársica': { movimentos: ['Dorsiflexão', 'Flexão plantar', 'Inversão', 'Eversão'] },
  'Cervical':     { movimentos: ['Flexão', 'Extensão', 'Inclinação lateral D', 'Inclinação lateral E', 'Rotação D', 'Rotação E'] },
  'Lombar':       { movimentos: ['Flexão anterior tronco', 'Extensão', 'Inclinação lateral D', 'Inclinação lateral E', 'Rotação D', 'Rotação E'] },
};
const ADM_ARTICULACOES = Object.keys(ADM_TREE);

const RETORNO_FASES = [
  { v: 1, lbl: '1 · Repouso' },
  { v: 2, lbl: '2 · Treino leve' },
  { v: 3, lbl: '3 · Treino específico' },
  { v: 4, lbl: '4 · Treino completo' },
  { v: 5, lbl: '5 · Competição' },
];

const MOTOR_NIVEIS = ['Ausente', 'Inicial', 'Parcial', 'Funcional'];
const MOTOR_TAGS = ['Padrão de marcha', 'Coordenação', 'Propriocepção', 'Estabilização core', 'Sincronização muscular'];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const DIACRITICOS_RE = new RegExp('[̀-ͯ]', 'g');
const slug = (s) => String(s).toLowerCase()
  .normalize('NFD').replace(DIACRITICOS_RE, '')
  .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

export function initObjetivosCatalogo({ root, onChange } = {}) {
  if (!root) return;

  const state = {
    aberto: new Set(['dor']),
    dor: null,
    forca: { tipo: null, valor: null },
    admCascata: { articulacao: null, subregiao: null, movimento: null, valor: '' },
    admLista: [],
    equilibrio: { escala: null, valor: null },
    avd: null,
    desporto: null,
    motor: { nivel: null, tags: [] },
    hipertrofia: null,
  };

  /* ── Saída {chave, valor, unidade}[] ─────────────────────── */
  function gerarSaida() {
    const out = [];
    if (state.dor != null) out.push({ chave: 'dor', valor: state.dor, unidade: 'EVA 0-10' });

    if (state.forca.valor != null) {
      out.push({ chave: 'forca', valor: state.forca.valor, unidade: state.forca.tipo === 'grau' ? 'grau (1-5)' : 'kg' });
    }

    state.admLista.forEach((item) => {
      const chave = ['adm', slug(item.articulacao), item.subregiao ? slug(item.subregiao) : null, slug(item.movimento)]
        .filter(Boolean).join('.');
      out.push({ chave, valor: item.valor, unidade: /\(cm\)/.test(item.movimento) ? 'cm' : '°' });
    });

    if (state.equilibrio.escala === 'tug' || state.equilibrio.escala === 'berg') {
      out.push({
        chave: 'equilibrio',
        valor: state.equilibrio.valor,
        unidade: state.equilibrio.escala === 'tug' ? 'segundos (TUG)' : 'pontos (Berg)',
      });
    } else if (state.equilibrio.escala === 'sem') {
      out.push({ chave: 'equilibrio', valor: null, unidade: 'sem escala' });
    }

    if (state.avd) out.push({ chave: 'avd', valor: state.avd, unidade: null });
    if (state.desporto != null) out.push({ chave: 'retorno_desporto', valor: state.desporto, unidade: 'fase (1-5)' });
    if (state.motor.nivel) out.push({ chave: 'controlo_motor_nivel', valor: state.motor.nivel, unidade: null });
    if (state.motor.tags.length) out.push({ chave: 'controlo_motor_foco', valor: [...state.motor.tags], unidade: null });
    if (state.hipertrofia != null) out.push({ chave: 'hipertrofia', valor: state.hipertrofia, unidade: 'cm perímetro' });

    return out;
  }

  function notificar() {
    if (typeof onChange === 'function') onChange(gerarSaida());
  }

  /* ── Resumos (mostrados no cabeçalho do card fechado) ────── */
  function resumo(id) {
    switch (id) {
      case 'dor': return state.dor != null ? `EVA ${state.dor}` : '—';
      case 'forca': return state.forca.valor != null
        ? `${state.forca.valor} ${state.forca.tipo === 'grau' ? '(grau)' : 'kg'}` : '—';
      case 'adm': return state.admLista.length ? `${state.admLista.length} movimento${state.admLista.length === 1 ? '' : 's'}` : '—';
      case 'equilibrio':
        if (state.equilibrio.escala === 'sem') return 'Sem escala';
        if (state.equilibrio.escala && state.equilibrio.valor != null) {
          return `${state.equilibrio.valor} ${state.equilibrio.escala === 'tug' ? 's (TUG)' : 'pts (Berg)'}`;
        }
        return '—';
      case 'avd': return state.avd || '—';
      case 'desporto': {
        const f = RETORNO_FASES.find((x) => x.v === state.desporto);
        return f ? f.lbl : '—';
      }
      case 'motor': {
        const partes = [];
        if (state.motor.nivel) partes.push(state.motor.nivel);
        if (state.motor.tags.length) partes.push(`${state.motor.tags.length} foco${state.motor.tags.length === 1 ? '' : 's'}`);
        return partes.length ? partes.join(' · ') : '—';
      }
      case 'hipertrofia': return state.hipertrofia != null ? `${state.hipertrofia} cm` : '—';
      default: return '—';
    }
  }

  /* ── Helpers de pills ─────────────────────────────────────── */
  function pillsHtml(grupo, opcoes, selecionados, { circular = false } = {}) {
    return opcoes.map((o) => {
      const v = typeof o === 'object' ? o.v : o;
      const lbl = typeof o === 'object' ? o.lbl : o;
      const sel = selecionados.includes(v);
      return `<div class="opt${sel ? ' sel' : ''}" data-grupo="${esc(grupo)}" data-v="${esc(v)}">${esc(lbl)}</div>`;
    }).join('');
  }

  /* ── Cascata ADM ativa ────────────────────────────────────── */
  function admCascataHtml() {
    const c = state.admCascata;
    let h = `<div class="gl">Articulação</div>
      <div class="opts sg" id="grp-adm-articulacao">${pillsHtml('adm-articulacao', ADM_ARTICULACOES, c.articulacao ? [c.articulacao] : [])}</div>`;

    if (!c.articulacao) return h;

    const no = ADM_TREE[c.articulacao];
    let movimentos = null;

    if (no.subregioes) {
      const subs = Object.keys(no.subregioes);
      h += `<div class="gl">Subregião — ${esc(c.articulacao)}</div>
        <div class="opts sg" id="grp-adm-subregiao">${pillsHtml('adm-subregiao', subs, c.subregiao ? [c.subregiao] : [])}</div>`;
      if (c.subregiao) movimentos = no.subregioes[c.subregiao];
    } else {
      movimentos = no.movimentos;
    }

    if (movimentos) {
      h += `<div class="gl">Movimento</div>
        <div class="opts sg" id="grp-adm-movimento">${pillsHtml('adm-movimento', movimentos, c.movimento ? [c.movimento] : [])}</div>`;
    }

    if (c.movimento) {
      const cm = /\(cm\)/.test(c.movimento);
      h += `<div class="goc-valor-row">
        <input type="number" class="goc-inp" data-campo="adm-valor" value="${esc(c.valor)}" placeholder="${cm ? 'cm' : '°'}" min="0">
        <span class="goc-unidade">${cm ? 'cm' : 'graus'}</span>
        <button type="button" class="goc-btn-add" data-accao="adm-add">+ Adicionar objetivo</button>
      </div>`;
    }

    return h;
  }

  function admListaHtml() {
    if (!state.admLista.length) return '';
    return `<div class="goc-chiplist">${state.admLista.map((item, i) => {
      const cm = /\(cm\)/.test(item.movimento);
      const caminho = [item.articulacao, item.subregiao, item.movimento].filter(Boolean).join(' · ');
      return `<span class="goc-chip">${esc(caminho)} — ${esc(item.valor)}${cm ? ' cm' : '°'}
        <button type="button" class="goc-chip-x" data-accao="adm-remover" data-i="${i}" title="Remover">✕</button></span>`;
    }).join('')}</div>`;
  }

  /* ── Render de um card ────────────────────────────────────── */
  function cardHtml(n, id, titulo, corpoHtml) {
    const aberto = state.aberto.has(id);
    return `
      <div class="sec goc-card">
        <div class="sec-title goc-card-head" data-toggle="${id}">
          <div class="num">${n}</div>
          <span class="goc-card-titulo">${esc(titulo)}</span>
          <span class="goc-resumo">${esc(resumo(id))}</span>
          <span class="goc-chev${aberto ? ' aberto' : ''}">›</span>
        </div>
        <div class="goc-body${aberto ? '' : ' fechado'}">${corpoHtml}</div>
      </div>`;
  }

  /* ── Render geral ─────────────────────────────────────────── */
  function render() {
    root.innerHTML = `
      <div class="goc-wrap">
        ${cardHtml(1, 'dor', 'Dor', `
          <div class="gl">Meta de dor (EVA 0–10)</div>
          <div class="eva-btns opts sg">${pillsHtml('dor', Array.from({ length: 11 }, (_, i) => i), state.dor != null ? [state.dor] : [])}</div>
        `)}

        ${cardHtml(2, 'forca', 'Força', `
          <div class="gl">Escala</div>
          <div class="opts sg">${pillsHtml('forca-tipo', [{ v: 'grau', lbl: 'Grau (1–5)' }, { v: 'kg', lbl: 'Dinamómetro (kg)' }], state.forca.tipo ? [state.forca.tipo] : [])}</div>
          ${state.forca.tipo === 'grau' ? `
            <div class="gl">Valor</div>
            <div class="opts sg">${pillsHtml('forca-grau', [1, 2, 3, 4, 5], state.forca.valor != null ? [state.forca.valor] : [])}</div>
          ` : ''}
          ${state.forca.tipo === 'kg' ? `
            <div class="gl">Valor (kg)</div>
            <input type="number" class="goc-inp" data-campo="forca-kg" value="${esc(state.forca.valor ?? '')}" placeholder="kg" min="0" step="0.5">
          ` : ''}
        `)}

        ${cardHtml(3, 'adm', 'ADM ativa', `
          ${admCascataHtml()}
          ${admListaHtml()}
        `)}

        ${cardHtml(4, 'equilibrio', 'Equilíbrio', `
          <div class="gl">Escala</div>
          <div class="opts sg">${pillsHtml('equilibrio-escala', [{ v: 'sem', lbl: 'Sem escala' }, { v: 'tug', lbl: 'TUG (segundos)' }, { v: 'berg', lbl: 'Berg (pontos)' }], state.equilibrio.escala ? [state.equilibrio.escala] : [])}</div>
          ${state.equilibrio.escala === 'tug' ? `
            <div class="gl">Valor (segundos)</div>
            <input type="number" class="goc-inp" data-campo="equilibrio-valor" value="${esc(state.equilibrio.valor ?? '')}" placeholder="s" min="0" step="0.1">
          ` : ''}
          ${state.equilibrio.escala === 'berg' ? `
            <div class="gl">Valor (pontos, 0–56)</div>
            <input type="number" class="goc-inp" data-campo="equilibrio-valor" value="${esc(state.equilibrio.valor ?? '')}" placeholder="pts" min="0" max="56">
          ` : ''}
        `)}

        ${cardHtml(5, 'avd', "Autonomia AVD's", `
          <div class="gl">Nível</div>
          <div class="opts sg">${pillsHtml('avd', ['Independente', 'Ajuda parcial', 'Dependente'], state.avd ? [state.avd] : [])}</div>
        `)}

        ${cardHtml(6, 'desporto', 'Retorno ao desporto', `
          <div class="gl">Fase</div>
          <div class="opts sg">${pillsHtml('desporto', RETORNO_FASES, state.desporto != null ? [state.desporto] : [])}</div>
        `)}

        ${cardHtml(7, 'motor', 'Controlo motor', `
          <div class="gl">Nível</div>
          <div class="opts sg">${pillsHtml('motor-nivel', MOTOR_NIVEIS, state.motor.nivel ? [state.motor.nivel] : [])}</div>
          <div class="gl">Foco (vários)</div>
          <div class="opts mg">${pillsHtml('motor-tags', MOTOR_TAGS, state.motor.tags)}</div>
        `)}

        ${cardHtml(8, 'hipertrofia', 'Hipertrofia', `
          <div class="gl">Perímetro alvo (cm)</div>
          <input type="number" class="goc-inp" data-campo="hipertrofia" value="${esc(state.hipertrofia ?? '')}" placeholder="cm" min="0" step="0.1">
        `)}
      </div>
    `;
    notificar();
  }

  /* ── Interação — pills (sg / mg) ──────────────────────────── */
  function handleOptClick(optEl) {
    const grupo = optEl.getAttribute('data-grupo');
    const raw = optEl.getAttribute('data-v');
    const opts = optEl.closest('.opts');
    const isMulti = opts.classList.contains('mg');

    switch (grupo) {
      case 'dor': {
        const v = Number(raw);
        state.dor = state.dor === v ? null : v;
        break;
      }
      case 'forca-tipo':
        state.forca.tipo = state.forca.tipo === raw ? null : raw;
        state.forca.valor = null;
        break;
      case 'forca-grau': {
        const v = Number(raw);
        state.forca.valor = state.forca.valor === v ? null : v;
        break;
      }
      case 'adm-articulacao':
        state.admCascata = state.admCascata.articulacao === raw
          ? { articulacao: null, subregiao: null, movimento: null, valor: '' }
          : { articulacao: raw, subregiao: null, movimento: null, valor: '' };
        break;
      case 'adm-subregiao':
        state.admCascata.subregiao = state.admCascata.subregiao === raw ? null : raw;
        state.admCascata.movimento = null;
        state.admCascata.valor = '';
        break;
      case 'adm-movimento':
        state.admCascata.movimento = state.admCascata.movimento === raw ? null : raw;
        state.admCascata.valor = '';
        break;
      case 'equilibrio-escala':
        state.equilibrio.escala = state.equilibrio.escala === raw ? null : raw;
        state.equilibrio.valor = null;
        break;
      case 'avd':
        state.avd = state.avd === raw ? null : raw;
        break;
      case 'desporto': {
        const v = Number(raw);
        state.desporto = state.desporto === v ? null : v;
        break;
      }
      case 'motor-nivel':
        state.motor.nivel = state.motor.nivel === raw ? null : raw;
        break;
      case 'motor-tags': {
        const i = state.motor.tags.indexOf(raw);
        if (i === -1) state.motor.tags.push(raw); else state.motor.tags.splice(i, 1);
        break;
      }
      default:
        if (isMulti) { /* grupo mg desconhecido — sem efeito */ }
    }
    render();
  }

  /* ── Interação — inputs numéricos (commit em change/blur) ── */
  function handleCampoChange(inp) {
    const campo = inp.getAttribute('data-campo');
    const v = inp.value === '' ? null : Number(inp.value);
    switch (campo) {
      case 'forca-kg': state.forca.valor = v; break;
      case 'adm-valor': state.admCascata.valor = inp.value; break;
      case 'equilibrio-valor': state.equilibrio.valor = v; break;
      case 'hipertrofia': state.hipertrofia = v; break;
      default: break;
    }
    if (campo !== 'adm-valor') render(); else notificar();
  }

  /* ── Interação — botões de ação ───────────────────────────── */
  function handleAccao(accao, btnEl) {
    if (accao === 'adm-add') {
      const c = state.admCascata;
      const inp = root.querySelector('[data-campo="adm-valor"]');
      const valor = inp ? inp.value : c.valor;
      if (!c.articulacao || !c.movimento || valor === '' || valor == null) return;
      state.admLista.push({
        articulacao: c.articulacao,
        subregiao: c.subregiao,
        movimento: c.movimento,
        valor: Number(valor),
      });
      state.admCascata.movimento = null;
      state.admCascata.valor = '';
      render();
    } else if (accao === 'adm-remover') {
      const i = Number(btnEl.getAttribute('data-i'));
      state.admLista.splice(i, 1);
      render();
    }
  }

  /* ── Delegação de eventos (raiz fixa, sobrevive a re-render) ── */
  root.addEventListener('click', (e) => {
    const toggleEl = e.target.closest('[data-toggle]');
    if (toggleEl) {
      const id = toggleEl.getAttribute('data-toggle');
      if (state.aberto.has(id)) state.aberto.delete(id); else state.aberto.add(id);
      render();
      return;
    }
    const optEl = e.target.closest('.opt[data-v]');
    if (optEl) { handleOptClick(optEl); return; }
    const accaoEl = e.target.closest('[data-accao]');
    if (accaoEl) { handleAccao(accaoEl.getAttribute('data-accao'), accaoEl); }
  });

  root.addEventListener('change', (e) => {
    const inp = e.target.closest('input[data-campo]');
    if (inp) handleCampoChange(inp);
  });

  render();

  return { getObjetivos: gerarSaida };
}
