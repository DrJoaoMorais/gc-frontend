/* =================================================================
   ZONAS-TREINO.JS — Perfis de zonas de treino (corrida + ciclismo, Fases 1-2)
   -----------------------------------------------------------------
   spec-zonas-treino.md — perfis por modalidade+métrica em wo_zone_profiles/
   wo_zone_ranges, activados via RPC activate_wo_zone_profile.
   Módulo autossuficiente do subprojecto "exercício": não importa nada de
   doente.js nem de outros módulos de consulta — só de ./pace.js (irmão,
   também de exercício) e de window.sb (cliente Supabase global). Chamado
   via abrirZonasTreino(patientId), que monta e abre o modal sozinho,
   incluindo a resolução da clínica activa do doente.
   Catálogo de zonas depende só da MÉTRICA (não da modalidade): FC e ritmo
   partilham o modelo tradicional de 5 zonas; potência usa sempre o modelo
   de Coggan de 7 zonas — uma bicicleta e uma corrida têm a mesma
   fisiologia de FC, por isso não duplicamos o catálogo de 5 zonas por
   modalidade.
   ================================================================= */

import { fmtPaceEditavel, parsePaceParaSegundos } from './pace.js';

function escAttr(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

const ZONAS_5 = [
  { key: "Z1", order: 1, label: "Recuperação" },
  { key: "Z2", order: 2, label: "Endurance" },
  { key: "Z3", order: 3, label: "Tempo / Limiar aeróbico" },
  { key: "Z4", order: 4, label: "Limiar anaeróbico / Lactato" },
  { key: "Z5", order: 5, label: "VO₂ Max / Cap. anaeróbica" },
];

const ZONAS_POTENCIA = [
  { key: "Z1", order: 1, label: "Recuperação activa (<55% FTP)" },
  { key: "Z2", order: 2, label: "Resistência aeróbica / Endurance (55–75% FTP)" },
  { key: "Z3", order: 3, label: "Tempo (76–90% FTP)" },
  { key: "Z4", order: 4, label: "Limiar de lactato / FTP (91–105% FTP)" },
  { key: "Z5", order: 5, label: "Capacidade aeróbica / VO₂ Max (106–120% FTP)" },
  { key: "Z6", order: 6, label: "Capacidade anaeróbica (121–150% FTP)" },
  { key: "Z7", order: 7, label: "Potência neuromuscular / Sprint (>150% FTP)" },
];

const ZONAS_NATACAO = [
  { key: "A1", order: 1, label: "Recuperação / técnica" },
  { key: "A2", order: 2, label: "Resistência aeróbica" },
  { key: "A3", order: 3, label: "Limiar aeróbico" },
  { key: "SP1", order: 4, label: "Potência aeróbica" },
  { key: "SP2", order: 5, label: "Tolerância láctica" },
  { key: "SP3", order: 6, label: "Velocidade / potência neuromuscular" },
];

function catalogoZonas(metric, modalidade = zonasTreinoModalidade) {
  if (modalidade === "natacao") return ZONAS_NATACAO;
  return metric === "power" ? ZONAS_POTENCIA : ZONAS_5;
}

// Que abas de métrica aparecem por modalidade — Velocidade NÃO entra aqui: não tem
// zonas próprias no spec (só a tabela de Coggan tem fronteiras), fica ao nível de
// Cadência/RPE, campo por bloco em prescricao.js.
const ABAS_POR_MODALIDADE = {
  corrida: [
    { metric: "heart_rate", label: "Frequência cardíaca" },
    { metric: "pace", label: "Ritmo" },
  ],
  ciclismo: [
    { metric: "heart_rate", label: "Frequência cardíaca" },
    { metric: "power", label: "Potência" },
  ],
  natacao: [
    { metric: "pace", label: "Ritmo / 100 m" },
    { metric: "heart_rate", label: "Frequência cardíaca" },
  ],
};

let _patientId = null;
let _clinicId = null;

let zonasTreinoOpen = false;
let zonasTreinoLoading = false;
let zonasTreinoSaving = false;
let zonasTreinoErro = "";
let zonasTreinoModalidade = "corrida"; // 'corrida' | 'ciclismo' | 'natacao'
let zonasTreinoMetrica = "heart_rate"; // aba activa: 'heart_rate' | 'pace' | 'power'
let zonasTreinoAtivos = { heart_rate: null, pace: null, power: null };
let zonasTreinoDraft = null;
let _onSaved = null;

function novoZonaDraft(metric, modalidade = zonasTreinoModalidade) {
  const zonas = Object.fromEntries(catalogoZonas(metric, modalidade).map((z) => [
    z.key,
    metric === "pace" ? { lento: "", rapido: "" } : { min: "", max: "" },
  ]));
  return {
    method: metric === "heart_rate" ? "estimado" : (metric === "power" ? "medido" : "manual"),
    formula: metric === "heart_rate" ? "tanaka" : "",
    resting_hr_bpm: "", max_hr_bpm: "", ftp_w: "",
    test_used: "", test_date: "", reassessment_recommended_at: "",
    zonas,
  };
}

function novoZonasTreinoDraft(modalidade = zonasTreinoModalidade) {
  return { heart_rate: novoZonaDraft("heart_rate", modalidade), pace: novoZonaDraft("pace", modalidade), power: novoZonaDraft("power", modalidade) };
}

async function fetchClinicIdDoPaciente(patientId) {
  const { data, error } = await window.sb
    .from("patient_clinic")
    .select("clinic_id")
    .eq("patient_id", patientId)
    .eq("is_active", true)
    .limit(1);
  if (error) {
    console.error("[zonas-treino] falha a obter clínica activa do doente:", error);
    return null;
  }
  return data && data.length ? data[0].clinic_id : null;
}

async function fetchZonasTreinoAtivos(patientId, modalidade) {
  const { data, error } = await window.sb
    .from("wo_zone_profiles")
    .select("*, wo_zone_ranges(*)")
    .eq("patient_id", patientId)
    .eq("modality", modalidade)
    .eq("is_active", true);
  if (error) {
    console.error("[zonas-treino] falha a carregar wo_zone_profiles:", error);
    return { heart_rate: null, pace: null, power: null };
  }
  const out = { heart_rate: null, pace: null, power: null };
  (data || []).forEach((row) => { out[row.metric] = row; });
  return out;
}

function draftFromPerfilAtivo(perfil, metric, modalidade = zonasTreinoModalidade) {
  const base = novoZonaDraft(metric, modalidade);
  if (!perfil) return base;
  const ranges = {};
  (perfil.wo_zone_ranges || []).forEach((r) => { ranges[r.zone_key] = r; });
  const zonas = {};
  catalogoZonas(metric, modalidade).forEach((z) => {
    const r = ranges[z.key];
    if (metric === "pace") {
      // lower_value = mais rápido (nº menor), upper_value = mais lento (nº maior) —
      // nunca mostramos "lower/upper" ao médico, só "mais lento"/"mais rápido" (secção 3).
      zonas[z.key] = {
        rapido: r && r.lower_value != null ? fmtPaceEditavel(r.lower_value) : "",
        lento: r && r.upper_value != null ? fmtPaceEditavel(r.upper_value) : "",
      };
    } else {
      zonas[z.key] = {
        min: r && r.lower_value != null ? String(r.lower_value) : "",
        max: r && r.upper_value != null ? String(r.upper_value) : "",
      };
    }
  });
  return {
    method: perfil.method,
    formula: perfil.formula || (metric === "heart_rate" ? "tanaka" : ""),
    resting_hr_bpm: perfil.resting_hr_bpm != null ? String(perfil.resting_hr_bpm) : "",
    max_hr_bpm: perfil.max_hr_bpm != null ? String(perfil.max_hr_bpm) : "",
    ftp_w: perfil.ftp_w != null ? String(perfil.ftp_w) : "",
    test_used: perfil.test_used || "",
    test_date: perfil.test_date || "",
    reassessment_recommended_at: perfil.reassessment_recommended_at || "",
    zonas,
  };
}

function ensureHost() {
  let host = document.getElementById("zonasTreinoModalHost");
  if (!host) {
    host = document.createElement("div");
    host.id = "zonasTreinoModalHost";
    document.body.appendChild(host);
  }
  return host;
}

function render() {
  const host = ensureHost();
  host.innerHTML = zonasTreinoOpen ? renderZonasTreinoModal() : "";
  bindZonasTreinoEvents();
}

async function carregarAtivosDaModalidade() {
  zonasTreinoLoading = true;
  render();

  zonasTreinoAtivos = await fetchZonasTreinoAtivos(_patientId, zonasTreinoModalidade);
  zonasTreinoDraft = {
    heart_rate: draftFromPerfilAtivo(zonasTreinoAtivos.heart_rate, "heart_rate", zonasTreinoModalidade),
    pace: draftFromPerfilAtivo(zonasTreinoAtivos.pace, "pace", zonasTreinoModalidade),
    power: draftFromPerfilAtivo(zonasTreinoAtivos.power, "power", zonasTreinoModalidade),
  };
  zonasTreinoLoading = false;
  render();
}

// Ponto de entrada do módulo — monta e abre o modal para o doente indicado. Resolve a
// clínica activa sozinho (patient_clinic), não depende de nenhum estado já carregado
// pelo chamador.
export async function abrirZonasTreino(patientId, { onSaved } = {}) {
  _patientId = patientId;
  _clinicId = null;
  _onSaved = typeof onSaved === "function" ? onSaved : null;
  zonasTreinoOpen = true;
  zonasTreinoLoading = true;
  zonasTreinoErro = "";
  zonasTreinoModalidade = "corrida";
  zonasTreinoMetrica = "heart_rate";
  zonasTreinoDraft = novoZonasTreinoDraft("corrida");
  render();

  _clinicId = await fetchClinicIdDoPaciente(patientId);
  await carregarAtivosDaModalidade();
}

function trocarModalidadeZonasTreino(modalidade) {
  if (modalidade === zonasTreinoModalidade) return;
  zonasTreinoModalidade = modalidade;
  zonasTreinoMetrica = ABAS_POR_MODALIDADE[modalidade][0].metric;
  zonasTreinoErro = "";
  carregarAtivosDaModalidade();
}

function closeZonasTreino() {
  zonasTreinoOpen = false;
  zonasTreinoDraft = null;
  zonasTreinoErro = "";
  render();
}

// Continuidade (spec-zonas-treino.md): zonas ordenadas por intensidade crescente (Z1→
// última); a fronteira "mais intensa" de uma zona tem de ser igual à fronteira "menos
// intensa" da seguinte — sem lacuna, sem sobreposição. Para FC e potência, número maior
// = mais intenso; para ritmo é o inverso (número menor = mais rápido = mais intenso) —
// por isso comparamos sempre pelo lado semântico ("mais intenso"), nunca por min/max cru.
// Genérico ao catálogo (5 zonas ou 7 de Coggan) — não assume nenhum comprimento fixo.
function validarContinuidadeZonas(pares, higherIsMoreIntense, zonaCatalogo) {
  for (let i = 0; i < pares.length; i++) {
    const { lower, upper } = pares[i];
    if (lower != null && upper != null && !(lower < upper)) {
      return `${zonaCatalogo[i].key}: o limite inferior tem de ser menor que o superior.`;
    }
    const ladoMenosIntenso = higherIsMoreIntense ? lower : upper;
    const ladoMaisIntenso = higherIsMoreIntense ? upper : lower;
    if (ladoMenosIntenso == null && i !== 0) {
      return `${zonaCatalogo[i].key}: falta o limite do lado menos intenso.`;
    }
    if (ladoMaisIntenso == null && i !== pares.length - 1) {
      return `${zonaCatalogo[i].key}: falta o limite do lado mais intenso.`;
    }
    if (i > 0) {
      const anterior = pares[i - 1];
      const anteriorMaisIntenso = higherIsMoreIntense ? anterior.upper : anterior.lower;
      if (anteriorMaisIntenso == null || ladoMenosIntenso == null || anteriorMaisIntenso !== ladoMenosIntenso) {
        return `${zonaCatalogo[i - 1].key}/${zonaCatalogo[i].key}: a fronteira tem de coincidir (sem lacuna nem sobreposição).`;
      }
    }
  }
  return null;
}

function unidadeDaMetrica(metric, modalidade) {
  if (metric === "pace") return modalidade === "natacao" ? "sec_per_100m" : "sec_per_km";
  if (metric === "power") return "watt";
  return "bpm";
}

function calcularZonasFcPorPercentagem() {
  const draft = zonasTreinoDraft?.heart_rate;
  if (zonasTreinoModalidade === "natacao") return;
  const fcMax = Number(draft?.max_hr_bpm);
  if (!Number.isFinite(fcMax) || fcMax <= 0) {
    zonasTreinoErro = "Indica primeiro uma FC máxima válida.";
    render();
    return;
  }
  const limites = [0.60, 0.70, 0.80, 0.90];
  const fronteiras = limites.map(p => Math.round(fcMax * p));
  const catalogo = catalogoZonas("heart_rate", zonasTreinoModalidade);
  catalogo.forEach((zona, index) => {
    draft.zonas[zona.key] = {
      min: index === 0 ? "" : String(fronteiras[index - 1]),
      max: index === catalogo.length - 1 ? "" : String(fronteiras[index]),
    };
  });
  zonasTreinoErro = "";
  render();
}

async function salvarZonasTreino(metric) {
  const draft = zonasTreinoDraft[metric];
  const zonaCatalogo = catalogoZonas(metric, zonasTreinoModalidade);
  if (!draft.method) { zonasTreinoErro = "Escolhe o método."; render(); return; }
  if (metric === "heart_rate" && draft.method === "estimado" && !draft.formula) {
    zonasTreinoErro = "Escolhe a fórmula (Tanaka ou Gulati).";
    render();
    return;
  }

  const pares = zonaCatalogo.map((z) => {
    const zv = draft.zonas[z.key];
    if (metric === "pace") {
      return {
        lower: parsePaceParaSegundos(zv.rapido), // mais rápido = nº menor
        upper: parsePaceParaSegundos(zv.lento),  // mais lento = nº maior
      };
    }
    return {
      lower: zv.min === "" ? null : Number(zv.min),
      upper: zv.max === "" ? null : Number(zv.max),
    };
  });

  const higherIsMoreIntense = metric !== "pace"; // FC e potência: número maior = mais intenso
  const erro = validarContinuidadeZonas(pares, higherIsMoreIntense, zonaCatalogo);
  if (erro) { zonasTreinoErro = erro; render(); return; }

  zonasTreinoSaving = true;
  zonasTreinoErro = "";
  render();

  const ranges = zonaCatalogo.map((z, i) => ({
    zone_key: z.key,
    zone_order: z.order,
    zone_label: z.label,
    lower_value: pares[i].lower,
    upper_value: pares[i].upper,
  }));

  try {
    const { error } = await window.sb.rpc("activate_wo_zone_profile", {
      p_patient_id: _patientId,
      p_clinic_id: _clinicId || null,
      p_modality: zonasTreinoModalidade,
      p_metric: metric,
      p_method: draft.method,
      p_formula: metric === "heart_rate" && draft.method === "estimado" ? draft.formula : null,
      p_resting_hr_bpm: metric === "heart_rate" && draft.resting_hr_bpm !== "" ? Number(draft.resting_hr_bpm) : null,
      p_max_hr_bpm: metric === "heart_rate" && draft.max_hr_bpm !== "" ? Number(draft.max_hr_bpm) : null,
      p_test_used: draft.test_used ? draft.test_used.trim() : null,
      p_test_date: draft.test_date || null,
      p_reassessment_recommended_at: draft.reassessment_recommended_at || null,
      p_unit: unidadeDaMetrica(metric, zonasTreinoModalidade),
      p_ranges: ranges,
      p_ftp_w: metric === "power" && draft.ftp_w !== "" ? Number(draft.ftp_w) : null,
    });

    if (error) {
      console.error("[zonas-treino] falha a activar perfil de zonas:", error);
      zonasTreinoErro = "Erro a gravar o perfil.";
      zonasTreinoSaving = false;
      render();
      return;
    }

    await carregarAtivosDaModalidade();
    zonasTreinoSaving = false;
    render();
    await _onSaved?.();
  } catch (e) {
    console.error(e);
    zonasTreinoErro = "Erro a gravar o perfil.";
    zonasTreinoSaving = false;
    render();
  }
}

function renderZonasTreinoModal() {
  const modalidade = zonasTreinoModalidade;
  const abas = ABAS_POR_MODALIDADE[modalidade];
  const d = zonasTreinoDraft || novoZonasTreinoDraft(modalidade);
  const tab = zonasTreinoMetrica;
  const draft = d[tab];
  const zonaCatalogo = catalogoZonas(tab, modalidade);
  const primeiraZona = zonaCatalogo[0].key, ultimaZona = zonaCatalogo[zonaCatalogo.length - 1].key;

  function campoZona(z) {
    const zv = draft.zonas[z.key];
    if (tab === "pace") {
      return `
        <div class="zt-zone-item zt-zone-${z.order}">
          <div class="zt-zone-title"><b>${z.key}</b><span>${escAttr(z.label)}</span></div>
          <div class="zt-zone-inputs">
            <label><span>Mais lento</span><input type="text" inputmode="numeric" class="zt-lento" data-zone="${z.key}" placeholder="m:ss" value="${escAttr(zv.lento)}" style="width:100%; padding:7px; border:1px solid #ddd; border-radius:8px; font-size:12px;"></label>
            <label><span>Mais rápido</span><input type="text" inputmode="numeric" class="zt-rapido" data-zone="${z.key}" placeholder="m:ss" value="${escAttr(zv.rapido)}" style="width:100%; padding:7px; border:1px solid #ddd; border-radius:8px; font-size:12px;"></label>
          </div>
        </div>`;
    }
    return `
      <div class="zt-zone-item zt-zone-${z.order}">
        <div class="zt-zone-title"><b>${z.key}</b><span>${escAttr(z.label)}</span></div>
        <div class="zt-zone-inputs">
          <label><span>Mínimo</span><input type="number" min="0" class="zt-min" data-zone="${z.key}" placeholder="sem limite" value="${escAttr(zv.min)}" style="width:100%; padding:7px; border:1px solid #ddd; border-radius:8px; font-size:12px;"></label>
          <label><span>Máximo</span><input type="number" min="0" class="zt-max" data-zone="${z.key}" placeholder="sem limite" value="${escAttr(zv.max)}" style="width:100%; padding:7px; border:1px solid #ddd; border-radius:8px; font-size:12px;"></label>
        </div>
      </div>`;
  }

  const unidadeTexto = tab === "pace" ? (modalidade === "natacao" ? "ritmo min:seg/100 m" : "ritmo min:seg/km") : (tab === "power" ? "W" : "bpm");

  return `
    <div id="zonasTreinoOverlay" class="zt-overlay"
         style="position:fixed; inset:0; background:rgba(0,0,0,0.35);
                display:flex; align-items:center; justify-content:center; padding:12px; z-index:2000;">
      <div class="zt-modal-shell" style="background:#fff; width:min(1080px,96vw); max-height:92vh; overflow:auto;
                  border-radius:14px; border:1px solid #e5e5e5; padding:16px;">

        <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
          <div><div class="zt-eyebrow">Zonas do doente</div><div style="font-weight:900; font-size:19px;">Definir zonas de treino</div><div class="zt-subtitle">Escolha a modalidade e a forma de medir a intensidade.</div></div>
          <button id="btnZonasTreinoClose" class="gcBtnGhost">Fechar</button>
        </div>

        <div class="zt-modalidades" style="margin-top:12px; display:flex; gap:8px;">
          <button data-modalidade="corrida" class="zt-modalidade ${modalidade === "corrida" ? "gcBtnPrimary" : "gcBtnGhost"}" style="font-weight:800;"><span>🏃</span> Corrida</button>
          <button data-modalidade="ciclismo" class="zt-modalidade ${modalidade === "ciclismo" ? "gcBtnPrimary" : "gcBtnGhost"}" style="font-weight:800;"><span>🚲</span> Ciclismo</button>
          <button data-modalidade="natacao" class="zt-modalidade ${modalidade === "natacao" ? "gcBtnPrimary" : "gcBtnGhost"}" style="font-weight:800;"><span>🏊</span> Natação <small>A1–SP3</small></button>
        </div>

        <div class="zt-metricas" style="margin-top:8px; display:flex; gap:8px;">
          ${abas.map((a) => `<button data-metric="${a.metric}" class="zt-tab ${tab === a.metric ? "gcBtnPrimary" : "gcBtnGhost"}" style="font-weight:800;">${a.metric === 'heart_rate' ? '♥' : (a.metric === 'power' ? '⚡' : '◷')} ${escAttr(a.label)}</button>`).join("")}
        </div>

        ${zonasTreinoLoading ? `<div style="margin-top:16px; color:#64748b;">A carregar…</div>` : `

        <div class="zt-editor-layout" style="margin-top:12px;">
          <section class="zt-config-panel">
            <div class="zt-panel-heading">Dados do perfil</div>

          <div class="zt-form-grid zt-method-row">
            <div>
              <label>Método</label>
              <div class="zt-choice-group" id="zt_method">
                <button type="button" data-value="medido" class="${draft.method === "medido" ? "on" : ""}">Medido</button>
                ${tab === "heart_rate" ? `<button type="button" data-value="estimado" class="${draft.method === "estimado" ? "on" : ""}">Estimado</button>` : ""}
                <button type="button" data-value="manual" class="${draft.method === "manual" ? "on" : ""}">Manual</button>
              </div>
            </div>
            ${tab === "heart_rate" && draft.method === "estimado" ? `
            <div>
              <label>Fórmula</label>
              <div class="zt-formula-group" id="zt_formula">
                <button type="button" data-value="tanaka" class="${draft.formula === "tanaka" ? "on" : ""}"><b>Tanaka</b><span>208 − 0,7 × idade</span></button>
                <button type="button" data-value="gulati" class="${draft.formula === "gulati" ? "on" : ""}"><b>Gulati</b><span>206 − 0,88 × idade</span></button>
              </div>
            </div>` : ""}
            ${tab === "power" ? `
            <div>
              <label>FTP de referência (W)</label>
              <input type="number" min="0" id="zt_ftp_w" value="${escAttr(draft.ftp_w)}" placeholder="ex.: 250" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:10px;">
            </div>` : ""}
          </div>

          <div class="zt-form-grid zt-test-row">
            <div>
              <label>Teste utilizado</label>
              <input type="text" id="zt_test_used" value="${escAttr(draft.test_used)}" placeholder="${modalidade === 'natacao' ? 'ex.: teste de 400 m / 200 m' : (tab === "power" ? "ex.: FTP 20min ou cicloergómetro" : (modalidade === "ciclismo" ? "ex.: prova de esforço em cicloergómetro" : "ex.: prova de esforço em tapete"))}" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:10px;">
            </div>
          </div>

          ${tab === "heart_rate" ? `
          <div class="zt-form-grid zt-fc-row">
            <div>
              <label>FC de repouso (bpm)</label>
              <input type="number" min="0" id="zt_resting_hr" value="${escAttr(draft.resting_hr_bpm)}" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:10px;">
            </div>
            <div class="zt-fcmax-field">
              <label>FC máxima utilizada (bpm)</label>
              <input type="number" min="0" id="zt_max_hr" value="${escAttr(draft.max_hr_bpm)}" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:10px;">
            </div>
            ${modalidade === "natacao" ? "" : `<button type="button" id="btnZtCalcularFc" class="gcBtnGhost gcBtnSm zt-calc-button">Calcular zonas por % da FC máxima</button>`}
          </div>` : ""}

          </section>

          <section class="zt-zones-panel">
            <div class="zt-date-row">
            <div>
              <label>Data do teste</label>
              <input type="date" id="zt_test_date" value="${escAttr(draft.test_date)}" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:10px;">
            </div>
            <div>
              <label>Reavaliação recomendada</label>
              <input type="date" id="zt_reassessment" value="${escAttr(draft.reassessment_recommended_at)}" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:10px;">
            </div>
          </div>

          <div class="zt-ranges-section">
            <label style="font-weight:700; font-size:12px; color:#374151;">
              ${escAttr(primeiraZona)}–${escAttr(ultimaZona)} (${unidadeTexto} — deixa em branco ${tab === "pace" ? `"mais lento" da ${escAttr(primeiraZona)} ou "mais rápido" da ${escAttr(ultimaZona)}` : `o mínimo da ${escAttr(primeiraZona)} ou o máximo da ${escAttr(ultimaZona)}`} se não houver limite)
            </label>
            <div class="zt-zone-columns" aria-hidden="true"><span>Zona e objetivo</span><span>${tab === "pace" ? "Mais lento" : "Mínimo"}</span><span>${tab === "pace" ? "Mais rápido" : "Máximo"}</span></div>
            <div class="zt-zone-grid" style="display:grid; grid-template-columns:1fr; gap:6px; margin-top:5px;">
              ${zonaCatalogo.map(campoZona).join("")}
            </div>
          </div>
          </section>
        </div>

        <div class="zt-footer" style="margin-top:12px; display:flex; justify-content:space-between; align-items:center; gap:10px;">
          <div style="color:#dc2626; font-size:13px;">${escAttr(zonasTreinoErro)}</div>
          <button id="btnZtSave" class="gcBtnSuccess" style="font-weight:900;" ${zonasTreinoSaving ? "disabled" : ""}>
            ${zonasTreinoSaving ? "A gravar…" : "Gravar perfil"}
          </button>
        </div>
        `}
      </div>
    </div>
  `;
}

function bindZonasTreinoEvents() {
  const host = document.getElementById("zonasTreinoModalHost");
  if (!host) return;

  const closeBtn = host.querySelector("#btnZonasTreinoClose");
  if (closeBtn) closeBtn.onclick = () => closeZonasTreino();

  if (!zonasTreinoOpen) return;

  host.querySelectorAll(".zt-modalidade").forEach((el) => {
    el.onclick = () => trocarModalidadeZonasTreino(el.dataset.modalidade);
  });

  if (zonasTreinoLoading || !zonasTreinoDraft) return;

  host.querySelectorAll(".zt-tab").forEach((el) => {
    el.onclick = () => { zonasTreinoMetrica = el.dataset.metric; zonasTreinoErro = ""; render(); };
  });

  const draft = zonasTreinoDraft[zonasTreinoMetrica];

  host.querySelectorAll("#zt_method [data-value]").forEach((el) => {
    el.onclick = () => { draft.method = el.dataset.value; render(); };
  });

  host.querySelectorAll("#zt_formula [data-value]").forEach((el) => {
    el.onclick = () => { draft.formula = el.dataset.value; render(); };
  });

  const ftpEl = host.querySelector("#zt_ftp_w");
  if (ftpEl) ftpEl.oninput = (e) => { draft.ftp_w = e.target.value; };

  const restingEl = host.querySelector("#zt_resting_hr");
  if (restingEl) restingEl.oninput = (e) => { draft.resting_hr_bpm = e.target.value; };

  const maxHrEl = host.querySelector("#zt_max_hr");
  if (maxHrEl) maxHrEl.oninput = (e) => { draft.max_hr_bpm = e.target.value; };

  const calcularFcBtn = host.querySelector("#btnZtCalcularFc");
  if (calcularFcBtn) calcularFcBtn.onclick = () => calcularZonasFcPorPercentagem();

  const testUsedEl = host.querySelector("#zt_test_used");
  if (testUsedEl) testUsedEl.oninput = (e) => { draft.test_used = e.target.value; };

  const testDateEl = host.querySelector("#zt_test_date");
  if (testDateEl) testDateEl.oninput = (e) => { draft.test_date = e.target.value; };

  const reassessEl = host.querySelector("#zt_reassessment");
  if (reassessEl) reassessEl.oninput = (e) => { draft.reassessment_recommended_at = e.target.value; };

  host.querySelectorAll(".zt-min").forEach((el) => {
    el.oninput = (e) => { draft.zonas[e.target.dataset.zone].min = e.target.value; };
  });
  host.querySelectorAll(".zt-max").forEach((el) => {
    el.oninput = (e) => { draft.zonas[e.target.dataset.zone].max = e.target.value; };
  });
  host.querySelectorAll(".zt-lento").forEach((el) => {
    el.oninput = (e) => { draft.zonas[e.target.dataset.zone].lento = e.target.value; };
  });
  host.querySelectorAll(".zt-rapido").forEach((el) => {
    el.oninput = (e) => { draft.zonas[e.target.dataset.zone].rapido = e.target.value; };
  });

  const saveBtn = host.querySelector("#btnZtSave");
  if (saveBtn) saveBtn.onclick = () => salvarZonasTreino(zonasTreinoMetrica);
}
