/* =================================================================
   CATALOGO.JS — Gestão do catálogo de exercícios (wo_exercises)
   -----------------------------------------------------------------
   Catálogo global ao sistema (não por clínica). Listar, criar,
   editar (incl. foto), desativar/reativar (nunca DELETE — não
   partir prescrições antigas que referenciem o exercício).
   Foto vai para o bucket wo-exercises (público), URL público
   gravado em photo_url.
   ================================================================= */

import { G } from '../../state.js';

const escAttr = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));
const escHtml = escAttr;

const MIME_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

const CATEGORIA_OPCOES = ['Membro Superior', 'Membro Inferior', 'Core'];
const LOCAIS_OPCOES = ['Casa', 'Ginásio', 'Clínica'];
const EQUIPAMENTO_OPCOES = ['Máquina', 'TRX', 'Elásticos', 'Halteres', 'Peso Corporal'];

function ensureCatalogoCss() {
  if (document.querySelector('link[data-gcwo-catalogo]')) return;
  const lnk = document.createElement('link');
  lnk.rel = 'stylesheet';
  lnk.href = new URL('./catalogo.css', import.meta.url).href;
  lnk.dataset.gcwoCatalogo = '1';
  document.head.appendChild(lnk);
}

/* ── Estado local do módulo ─────────────────────────────── */
let _state = null;
let _onVoltar = null;

function freshState() {
  return {
    tab: 'ativos',
    exercicios: [],
    loaded: false,
    panelExercicio: null,   // null = painel fechado; objeto = a criar/editar
    panelFotoFile: null,    // File novo escolhido, ainda não gravado
    panelFotoPreviewUrl: null,
    panelFotoRemovida: false,
    panelErro: '',
    panelSaving: false,
  };
}

function novoExercicioVazio() {
  return { id: null, name: '', categoria: [], locais: [], equipamento: [], tempo_concentrico_s: null, tempo_excentrico_s: null, ajustes_maquina: [], photo_url: null, is_active: true, is_favorite: false, incremento_default: null };
}

/* ── Entry point ─────────────────────────────────────────── */
export async function initCatalogo({ onVoltar } = {}) {
  const root = document.getElementById('gcwoPrescricaoRoot');
  if (!root) return;

  ensureCatalogoCss();
  _state = freshState();
  _onVoltar = typeof onVoltar === 'function' ? onVoltar : null;

  renderShell();
  await loadExercicios();
}

/* ── Leitura ─────────────────────────────────────────────── */
async function loadExercicios() {
  const { data, error } = await window.sb
    .from('wo_exercises')
    .select('id,name,categoria,locais,equipamento,tempo_concentrico_s,tempo_excentrico_s,ajustes_maquina,photo_url,is_active,is_favorite,incremento_default')
    .order('name');

  if (error) {
    console.error('[catalogo] falha a carregar wo_exercises:', error);
    _state.exercicios = [];
  } else {
    _state.exercicios = data || [];
  }
  _state.loaded = true;
  renderGrid();
}

/* ================================================================
   Shell — topbar + separadores + grelha + painel
   ================================================================ */
function renderShell() {
  const root = document.getElementById('gcwoPrescricaoRoot');
  root.innerHTML = `
    <div class="gc-page-header">
      <div><div class="gc-page-title">Catálogo de Exercícios</div><div class="gc-page-sub">Global a todas as clínicas</div></div>
      <div class="gcwo-headeractions">
        <button type="button" class="gcBtnGhost" id="gcwoBtnVoltarPrescricao">‹ Voltar à prescrição</button>
        <button type="button" class="gcBtnPrimary" id="gcwoCatNovo">+ Novo exercício</button>
      </div>
    </div>

    <div class="gcwo-cat-body">
      <main class="gcwo-cat-main">
        <div class="gcwo-cat-tabs">
          <button type="button" class="gcwo-cat-tab" data-tab="ativos">Ativos <span class="n" id="gcwoCatCountAtivos"></span></button>
          <button type="button" class="gcwo-cat-tab" data-tab="inativos">Desativados <span class="n" id="gcwoCatCountInativos"></span></button>
        </div>
        <div class="gcwo-cat-grid" id="gcwoCatGrid"></div>
      </main>
      <aside class="gcwo-cat-panel empty" id="gcwoCatPanel">Seleciona "Editar" num exercício, ou "+ Novo exercício".</aside>
    </div>
  `;

  document.getElementById('gcwoBtnVoltarPrescricao').addEventListener('click', () => {
    if (typeof _onVoltar === 'function') _onVoltar();
  });
  document.getElementById('gcwoCatNovo').addEventListener('click', () => openPanel(null));
  document.querySelectorAll('.gcwo-cat-tab').forEach(btn => {
    btn.addEventListener('click', () => { _state.tab = btn.getAttribute('data-tab'); renderGrid(); });
  });
}

/* ================================================================
   Grelha
   ================================================================ */
function photoTileHtml(ex) {
  if (ex.photo_url) {
    return `<div class="gcwo-cat-photo"><div class="frame"><img src="${escAttr(ex.photo_url)}" alt=""></div></div>`;
  }
  return `<div class="gcwo-cat-photo empty"><div class="frame">${ICON_PHOTO}</div><span class="semfoto">Sem foto</span></div>`;
}

const ICON_PHOTO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M21 15l-5-5-4 4-2-2-4 4"/></svg>`;
const ICON_CLOCK = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="7.2"/><path d="M10 6v4l2.6 1.6"/></svg>`;
const ICON_WRENCH = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 3.5a3.8 3.8 0 00-5 4.6L3 13.5 6.5 17l5.4-5.5a3.8 3.8 0 004.6-5l-3 3-2-2 3-3z"/></svg>`;
const ICON_UPLOAD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3"/></svg>`;
const ICON_PLUS = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M10 4v12M4 10h12"/></svg>`;
const ICON_TRASH = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h12M8 6V4.5A1.5 1.5 0 019.5 3h1A1.5 1.5 0 0112 4.5V6m-6.5 0L6 16.5A1.5 1.5 0 007.5 18h5a1.5 1.5 0 001.5-1.5L14.5 6"/></svg>`;
const ICON_CLOSE = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 5l10 10M15 5L5 15"/></svg>`;
const ICON_STAR = `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 2.5l2.35 4.76 5.25.76-3.8 3.7.9 5.23L10 14.5l-4.7 2.45.9-5.23-3.8-3.7 5.25-.76z"/></svg>`;

function renderGrid() {
  const ativos = _state.exercicios.filter(e => e.is_active);
  const inativos = _state.exercicios.filter(e => !e.is_active);

  const countAtivosEl = document.getElementById('gcwoCatCountAtivos');
  const countInativosEl = document.getElementById('gcwoCatCountInativos');
  if (countAtivosEl) countAtivosEl.textContent = `(${ativos.length})`;
  if (countInativosEl) countInativosEl.textContent = `(${inativos.length})`;

  document.querySelectorAll('.gcwo-cat-tab').forEach(t => t.classList.toggle('active', t.getAttribute('data-tab') === _state.tab));

  const list = _state.tab === 'ativos' ? ativos : inativos;
  const grid = document.getElementById('gcwoCatGrid');
  if (!grid) return;

  if (!_state.loaded) {
    grid.innerHTML = `<div class="gcwo-cat-empty">A carregar…</div>`;
    return;
  }
  if (!list.length) {
    grid.innerHTML = `<div class="gcwo-cat-empty">${_state.tab === 'ativos' ? 'Nenhum exercício ativo ainda.' : 'Nenhum exercício desativado.'}</div>`;
    return;
  }

  grid.innerHTML = list.map(ex => `
    <div class="gcwo-cat-card${ex.is_active ? '' : ' inactive'}">
      ${photoTileHtml(ex)}
      ${ex.is_favorite ? `<span class="gcwo-cat-favbadge" title="Favorito">${ICON_STAR}</span>` : ''}
      <div class="gcwo-cat-info">
        <div class="gcwo-cat-name">${escHtml(ex.name)}</div>
        <div class="gcwo-cat-cats">${(ex.categoria || []).map(c => `<span class="gcwo-cat-cat">${escHtml(c)}</span>`).join('')}</div>
        <div class="gcwo-cat-meta">
          ${ex.tempo_concentrico_s || ex.tempo_excentrico_s ? `<span>${ICON_CLOCK}${ex.tempo_concentrico_s ?? '—'}s / ${ex.tempo_excentrico_s ?? '—'}s</span>` : ''}
          ${ex.ajustes_maquina?.length ? `<span>${ICON_WRENCH}${ex.ajustes_maquina.length} ajuste${ex.ajustes_maquina.length === 1 ? '' : 's'}</span>` : ''}
        </div>
      </div>
      <div class="gcwo-cat-cardactions">
        ${ex.is_active
          ? `<button type="button" class="gcBtnGhost" data-editar="${ex.id}">Editar</button><button type="button" class="gcwo-cat-btn-desativar" data-desativar="${ex.id}">Desativar</button>`
          : `<button type="button" class="gcBtnPrimary" data-reativar="${ex.id}">Reativar</button>`}
      </div>
    </div>`).join('');

  grid.querySelectorAll('[data-editar]').forEach(b => b.addEventListener('click', () => {
    const ex = _state.exercicios.find(e => e.id === b.getAttribute('data-editar'));
    if (ex) openPanel(ex);
  }));
  grid.querySelectorAll('[data-desativar]').forEach(b => b.addEventListener('click', () => handleAtivar(b.getAttribute('data-desativar'), false)));
  grid.querySelectorAll('[data-reativar]').forEach(b => b.addEventListener('click', () => handleAtivar(b.getAttribute('data-reativar'), true)));
}

async function handleAtivar(id, ativo) {
  try {
    const { error } = await window.sb.from('wo_exercises').update({ is_active: ativo }).eq('id', id);
    if (error) throw new Error(`Falha ao ${ativo ? 'reativar' : 'desativar'} exercício: ${error.message || error}`);
    await loadExercicios();
  } catch (err) {
    console.error('[catalogo] erro a ativar/desativar:', err);
    alert(err?.message || String(err));
  }
}

/* ================================================================
   Painel — criar / editar
   ================================================================ */
function openPanel(ex) {
  _state.panelExercicio = ex ? {
    ...ex,
    categoria: [...(ex.categoria || [])],
    locais: [...(ex.locais || [])],
    equipamento: [...(ex.equipamento || [])],
    ajustes_maquina: (ex.ajustes_maquina || []).map(a => ({ ...a })),
  } : novoExercicioVazio();
  _state.panelFotoFile = null;
  _state.panelFotoPreviewUrl = null;
  _state.panelFotoRemovida = false;
  _state.panelErro = '';
  renderPanel();
}

function closePanel() {
  _state.panelExercicio = null;
  renderPanel();
}

function renderPanel() {
  const panel = document.getElementById('gcwoCatPanel');
  if (!panel) return;

  if (!_state.panelExercicio) {
    panel.className = 'gcwo-cat-panel empty';
    panel.textContent = 'Seleciona "Editar" num exercício, ou "+ Novo exercício".';
    return;
  }

  panel.className = 'gcwo-cat-panel';
  const ex = _state.panelExercicio;
  const isNovo = !ex.id;
  const ritmoInicial = ex.tempo_concentrico_s != null || ex.tempo_excentrico_s != null;

  let fotoBodyHtml;
  if (_state.panelFotoPreviewUrl) {
    fotoBodyHtml = `<img src="${_state.panelFotoPreviewUrl}" alt="pré-visualização">`;
  } else if (ex.photo_url && !_state.panelFotoRemovida) {
    fotoBodyHtml = `<img src="${escAttr(ex.photo_url)}" alt="">`;
  } else {
    fotoBodyHtml = `<div class="hint">${ICON_UPLOAD}<span>Clica para escolher uma foto</span></div>`;
  }

  panel.innerHTML = `
    <div class="gcwo-cat-panel-head">
      <h3>${isNovo ? 'Novo exercício' : 'Editar exercício'}</h3>
      <button type="button" id="gcwoCatFechar" title="Fechar">${ICON_CLOSE}</button>
    </div>
    <div class="gcwo-cat-panel-body">
      <div class="gcwo-photo-drop" id="gcwoCatFotoDrop">
        ${fotoBodyHtml}
        <input type="file" id="gcwoCatFotoInput" accept="image/png,image/jpeg,image/webp" style="display:none">
      </div>
      <div class="gcwo-photo-actions">
        <button type="button" class="gcBtnGhost" id="gcwoCatTrocarFoto">Trocar foto</button>
        <button type="button" class="gcBtnGhost" id="gcwoCatRemoverFoto">Remover foto</button>
      </div>

      <label class="gcwo-cat-field"><span>Nome</span><input type="text" id="gcwoCatNome" value="${escAttr(ex.name)}" placeholder="Ex: Leg press"></label>

      <div class="gcwo-cat-togglerow">
        <span class="gcwo-cat-togglelabel">Favorito — aparece primeiro na prescrição</span>
        <label class="gcwo-cat-switch">
          <input type="checkbox" id="gcwoCatFavorito" ${ex.is_favorite ? 'checked' : ''}>
          <span class="gcwo-cat-track"></span><span class="gcwo-cat-thumb"></span>
        </label>
      </div>
      <label class="gcwo-cat-field"><span>Incremento por omissão (kg) — opcional</span><input type="number" min="0" step="0.5" id="gcwoCatIncremento" value="${ex.incremento_default ?? ''}" placeholder="Ex: 2.5"></label>

      <div class="gcwo-cat-field"><span>Categoria</span>${chipGroupHtml('gcwoCatCategoria', CATEGORIA_OPCOES, ex.categoria)}</div>
      <div class="gcwo-cat-field"><span>Locais</span>${chipGroupHtml('gcwoCatLocais', LOCAIS_OPCOES, ex.locais)}</div>
      <div class="gcwo-cat-field"><span>Equipamento</span>${chipGroupHtml('gcwoCatEquipamento', EQUIPAMENTO_OPCOES, ex.equipamento)}</div>

      <div class="gcwo-cat-togglerow">
        <span class="gcwo-cat-togglelabel">Definir ritmo desta série</span>
        <label class="gcwo-cat-switch">
          <input type="checkbox" id="gcwoCatRitmoToggle" ${ritmoInicial ? 'checked' : ''}>
          <span class="gcwo-cat-track"></span><span class="gcwo-cat-thumb"></span>
        </label>
      </div>
      <div class="gcwo-cat-row2" id="gcwoCatRitmoFields" style="display:${ritmoInicial ? '' : 'none'}">
        <label class="gcwo-cat-field"><span>Concêntrica (s)</span><input type="number" min="0" id="gcwoCatConc" value="${ex.tempo_concentrico_s ?? ''}"></label>
        <label class="gcwo-cat-field"><span>Excêntrica (s)</span><input type="number" min="0" id="gcwoCatExc" value="${ex.tempo_excentrico_s ?? ''}"></label>
      </div>

      <div class="gcwo-cat-section">
        <h4>Ajustes de máquina</h4>
        <button type="button" class="gcBtnGhost gcBtnSm" id="gcwoCatAddAjuste">${ICON_PLUS} Ajuste</button>
      </div>
      <div class="gcwo-ajustelist" id="gcwoCatAjustes"></div>

      <span class="gcwo-cat-erro" id="gcwoCatErro">${escHtml(_state.panelErro)}</span>
    </div>
    <div class="gcwo-cat-panel-footer">
      <button type="button" class="gcBtnGhost" id="gcwoCatCancelar">Cancelar</button>
      <button type="button" class="gcBtnPrimary" id="gcwoCatGuardar">Guardar exercício</button>
    </div>
  `;

  renderAjustes();

  document.getElementById('gcwoCatFechar').addEventListener('click', closePanel);
  document.getElementById('gcwoCatCancelar').addEventListener('click', closePanel);
  document.getElementById('gcwoCatGuardar').addEventListener('click', handleGuardar);

  document.getElementById('gcwoCatNome').addEventListener('input', e => { ex.name = e.target.value; });
  document.getElementById('gcwoCatFavorito').addEventListener('change', e => { ex.is_favorite = e.target.checked; });
  document.getElementById('gcwoCatIncremento').addEventListener('input', e => { ex.incremento_default = e.target.value === '' ? null : Number(e.target.value); });
  wireChipGroup('gcwoCatCategoria', ex.categoria);
  wireChipGroup('gcwoCatLocais', ex.locais);
  wireChipGroup('gcwoCatEquipamento', ex.equipamento);

  document.getElementById('gcwoCatRitmoToggle').addEventListener('change', e => {
    document.getElementById('gcwoCatRitmoFields').style.display = e.target.checked ? '' : 'none';
  });
  document.getElementById('gcwoCatConc').addEventListener('input', e => { ex.tempo_concentrico_s = e.target.value === '' ? null : Number(e.target.value); });
  document.getElementById('gcwoCatExc').addEventListener('input', e => { ex.tempo_excentrico_s = e.target.value === '' ? null : Number(e.target.value); });

  const drop = document.getElementById('gcwoCatFotoDrop');
  const input = document.getElementById('gcwoCatFotoInput');
  drop.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    _state.panelFotoFile = file;
    _state.panelFotoRemovida = false;
    _state.panelFotoPreviewUrl = URL.createObjectURL(file);
    renderPanel();
  });
  document.getElementById('gcwoCatTrocarFoto').addEventListener('click', (e) => { e.stopPropagation(); input.click(); });
  document.getElementById('gcwoCatRemoverFoto').addEventListener('click', (e) => {
    e.stopPropagation();
    _state.panelFotoFile = null;
    _state.panelFotoPreviewUrl = null;
    _state.panelFotoRemovida = true;
    renderPanel();
  });

  document.getElementById('gcwoCatAddAjuste').addEventListener('click', () => {
    ex.ajustes_maquina.push({ etiqueta: '', valor: '' });
    renderAjustes();
  });
}

function chipGroupHtml(id, opcoes, selecionados) {
  return `<div class="gcwo-cat-chipgroup" id="${id}">${opcoes.map(o => `<span class="gcwo-cat-chip${selecionados.includes(o) ? ' on' : ''}" data-value="${escAttr(o)}">${escHtml(o)}</span>`).join('')}</div>`;
}

function wireChipGroup(id, arr) {
  document.getElementById(id).querySelectorAll('.gcwo-cat-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const v = chip.getAttribute('data-value');
      const i = arr.indexOf(v);
      if (i === -1) arr.push(v); else arr.splice(i, 1);
      chip.classList.toggle('on');
    });
  });
}

function renderAjustes() {
  const ex = _state.panelExercicio;
  const host = document.getElementById('gcwoCatAjustes');
  if (!host) return;
  if (!ex.ajustes_maquina.length) {
    host.innerHTML = `<div class="gcwo-cat-empty" style="padding:2px;">Sem ajustes definidos.</div>`;
    return;
  }
  host.innerHTML = ex.ajustes_maquina.map((a, i) => `
    <div class="gcwo-ajusterow" data-i="${i}">
      <input type="text" class="aEtiqueta" placeholder="Etiqueta — ex: Altura do banco" value="${escAttr(a.etiqueta)}">
      <input type="text" class="aValor" placeholder="Valor — ex: 3" value="${escAttr(a.valor)}">
      <button type="button" title="Remover ajuste">${ICON_TRASH}</button>
    </div>`).join('');
  host.querySelectorAll('.gcwo-ajusterow').forEach(row => {
    const i = Number(row.getAttribute('data-i'));
    row.querySelector('.aEtiqueta').addEventListener('input', e => { ex.ajustes_maquina[i].etiqueta = e.target.value; });
    row.querySelector('.aValor').addEventListener('input', e => { ex.ajustes_maquina[i].valor = e.target.value; });
    row.querySelector('button').addEventListener('click', () => { ex.ajustes_maquina.splice(i, 1); renderAjustes(); });
  });
}

/* ================================================================
   Gravação — upload de foto (se aplicável) + insert/update
   ================================================================ */
async function handleGuardar() {
  const ex = _state.panelExercicio;
  const btn = document.getElementById('gcwoCatGuardar');
  const erroEl = document.getElementById('gcwoCatErro');
  erroEl.textContent = '';

  const nome = (ex.name || '').trim();
  const categoria = ex.categoria || [];
  const locais = ex.locais || [];
  const equipamento = ex.equipamento || [];
  if (!nome) { erroEl.textContent = 'Falta o nome do exercício.'; return; }
  if (!categoria.length) { erroEl.textContent = 'Falta pelo menos uma categoria.'; return; }
  if (!locais.length) { erroEl.textContent = 'Falta pelo menos um local.'; return; }
  if (!equipamento.length) { erroEl.textContent = 'Falta pelo menos um equipamento.'; return; }

  const ritmoOn = document.getElementById('gcwoCatRitmoToggle').checked;
  const tempoConcentrico = ritmoOn ? ex.tempo_concentrico_s : null;
  const tempoExcentrico = ritmoOn ? ex.tempo_excentrico_s : null;
  if (ritmoOn && (tempoConcentrico == null || tempoExcentrico == null)) {
    erroEl.textContent = 'Preenche os dois campos de ritmo, ou desliga o interruptor.';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'A gravar…';

  try {
    let photoUrl = ex.photo_url || null;

    if (_state.panelFotoFile) {
      const file = _state.panelFotoFile;
      const ext = MIME_EXT[file.type] || 'jpg';
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await window.sb.storage.from('wo-exercises').upload(path, file, { contentType: file.type });
      if (upErr) throw new Error(`Falha no upload da foto: ${upErr.message || upErr}`);
      const { data: pub } = window.sb.storage.from('wo-exercises').getPublicUrl(path);
      photoUrl = pub?.publicUrl || null;
    } else if (_state.panelFotoRemovida) {
      photoUrl = null;
    }

    const ajustesLimpos = ex.ajustes_maquina
      .map(a => ({ etiqueta: (a.etiqueta || '').trim(), valor: (a.valor || '').trim() }))
      .filter(a => a.etiqueta);

    const payload = {
      name: nome,
      categoria,
      locais,
      equipamento,
      tempo_concentrico_s: tempoConcentrico,
      tempo_excentrico_s: tempoExcentrico,
      ajustes_maquina: ajustesLimpos,
      photo_url: photoUrl,
      is_favorite: !!ex.is_favorite,
      incremento_default: ex.incremento_default,
    };

    if (!ex.id) {
      payload.created_by = G.sessionUser.id;
      const { error } = await window.sb.from('wo_exercises').insert(payload);
      if (error) throw new Error(`Falha ao criar exercício: ${error.message || error}`);
    } else {
      const { error } = await window.sb.from('wo_exercises').update(payload).eq('id', ex.id);
      if (error) throw new Error(`Falha ao atualizar exercício: ${error.message || error}`);
    }

    closePanel();
    await loadExercicios();
  } catch (err) {
    console.error('[catalogo] erro a gravar exercício:', err);
    erroEl.textContent = 'Erro ao gravar: ' + (err?.message || err);
    btn.disabled = false;
    btn.textContent = 'Guardar exercício';
  }
}
