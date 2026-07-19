// =================================================================
// prp.js  ·  Pedido de comparticipação — PRP / Viscossuplementação
// =================================================================
// Modal com formulário (esquerda) + preview live (direita).
// Gera PDF via Cloudflare Worker, guarda em documents/.
// Construído de raiz na linha v2 (padrão de atestado.js):
//   · overlay próprio (createElement + appendChild(body))
//   · CSS todo escopado .gcv2- (sem regras globais body/html)
//   · SEM Quill, SEM iframe (ao contrário do legacy prp-visco.js)
//   · depende só de window.sb + helpers __gc_ que o feed já define
//
// Conteúdo clínico (6 textos) + 9 referências: congelados e
// aprovados por Morais em 2026-07-19, com evidência verificada.
// A força probatória das afirmações é responsabilidade clínica
// do médico. As referências são texto revisto, NÃO geradas.
// =================================================================

import { buildShellV2, loadClinicById, loadCurrentDoctor, getVinhetaDataUrl } from '../_shell/shell-v2.js';
import { buildPatientCard } from '../_components/patient-card.js';

const escAttr = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));
const escHtml = escAttr;

const MIN_PDF_BYTES = 5000; // mesmo limiar de "provável em branco" que pedidos-v2.js usa

/**
 * generateDocNumber
 * Mesma fórmula que pedidos-v2.js/relatorio-consulta.js já usam (não há
 * sequência canónica na BD — doc_number é texto livre, sem tabela de
 * numeração). JM-{ano 2 díg.}-{5 díg. de segundos}-A.
 */
function generateDocNumber() {
  const y = new Date().getFullYear().toString().slice(-2);
  const s = String(Math.floor(Date.now() / 1000) % 100000).padStart(5, "0");
  return `JM-${y}-${s}-A`;
}

// -----------------------------------------------------------------
// Opções por indicação (reaproveitado do legacy prp-visco.js OPTS)
// -----------------------------------------------------------------
const OPTS = {
  localizacao: {
    osteoartrose:    ['Joelho', 'Anca', 'Outra'],
    tendinopatia:    ['Supraespinhoso / Coifa', 'Epicôndilo', 'Rotuliano', 'Aquiles', 'Outro'],
    rotura_tendao:   ['Supraespinhoso', 'Bicipital', 'Rotuliano', 'Aquiles', 'Outro'],
    rotura_muscular: ['Isquiotibiais', 'Quadricípite', 'Gémeos / Sóleo', 'Adutor', 'Outro'],
  },
  grau: {
    osteoartrose:    ['KL I', 'KL II', 'KL III'],
    tendinopatia:    ['Degenerativo leve', 'Degenerativo moderado', 'Degenerativo grave (sem rotura)'],
    rotura_tendao:   ['< 50% espessura', '≥ 50% espessura'],
    rotura_muscular: ['Grau I', 'Grau II', 'Grau III parcial'],
  },
  tratamentos: {
    osteoartrose:    ['Programa de reabilitação estruturado', 'AINEs / analgésicos', 'Corticosteroide prévio', 'Viscossuplementação prévia', 'Órteses / suportes', 'Controlo ponderal'],
    tendinopatia:    ['Programa de reabilitação estruturado', 'Exercício excêntrico supervisionado', 'AINEs', 'Ondas de choque', 'Corticosteroide', 'Ortótese', 'Repouso relativo'],
    rotura_tendao:   ['Programa de reabilitação estruturado', 'Imobilização relativa', 'AINEs', 'Corticosteroide'],
    rotura_muscular: ['Programa de reabilitação estruturado', 'Repouso relativo', 'Crioterapia', 'AINEs'],
  },
};

const IND_LABELS = {
  osteoartrose:    'Osteoartrose',
  tendinopatia:    'Tendinopatia',
  rotura_tendao:   'Rotura parcial de tendão',
  rotura_muscular: 'Rotura muscular',
};

// Procedimentos permitidos por indicação.
// PRP em todas; viscossuplementação (AH) sobretudo na artrose.
const PROC_POR_IND = {
  osteoartrose:    ['prp', 'visco'],
  tendinopatia:    ['prp'],
  rotura_tendao:   ['prp'],
  rotura_muscular: ['prp'],
};

const PROC_LABELS = {
  prp:   'PRP',
  visco: 'Viscossuplementação (ácido hialurónico)',
};

// -----------------------------------------------------------------
// Referências bibliográficas (verificadas em fonte primária,
// 2026-07-19). Chaveadas por número de superscrito.
// -----------------------------------------------------------------
const REFS = {
  1: 'Meta-análise de ensaios aleatorizados, duplamente cegos: aos 12 meses, diferenças estatisticamente significativas no WOMAC (dor e total), com PRP superior ao ácido hialurónico na osteoartrose do joelho. Arthroscopy: The Journal of Arthroscopic and Related Surgery. 2025. DOI: 10.1016/j.arthro.2025.06.033.',
  2: 'Meta-análise comparativa de terapias intra-articulares: o PRP reduziu significativamente a dor comparado com ácido hialurónico e corticosteroide (WOMAC e VAS), com melhoria mais marcada aos 6 meses. Annals of Medicine and Surgery. 2024;86(1):361-372. DOI: 10.1097/MS9.0000000000001615.',
  3: 'Gökçeoğlu YS, Yapti M, Öncel F, Levent A, Demir S. Comparative efficacy of intra-articular platelet-rich plasma, hyaluronic acid, corticosteroids, and NSAIDs for knee osteoarthritis: A retrospective cohort study. Medicine (Baltimore). 2025;104(40):e44929.',
  4: 'Chevalier X, Sheehan B. Predictors of Clinical Benefit with Intra-articular Hyaluronic Acid in Patients with Knee Osteoarthritis — A Narrative Review. 2024. DOI: 10.2174/0115733971274662240108074038. (A gravidade radiológica é preditor fiável de resposta; benefício em subgrupos seleccionados.)',
  5: 'Umbrella review sobre ácido hialurónico intra-articular na osteoartrose (guidelines e formulações). Journal of Clinical Medicine. 2025;14(4):1272. DOI: 10.3390/jcm14041272. (Evidência não consensual; benefício em doentes seleccionados.)',
  6: 'Nadeau-Vallée M, Ellassraoui S, Brulotte V. Platelet-rich plasma injections as a second-line treatment in patients with tendinopathy-related chronic pain and failure of conservative treatment: a systematic review and meta-analysis. Pain Medicine. 2025;26(7):407-419. DOI: 10.1093/pm/pnaf022.',
  7: 'Elnewishy A, Elsenosy AM, Teama H, Symeon N, Hamada A. Platelet-Rich Plasma Versus Corticosteroid Injections for Chronic Tendinopathies: A Systematic Review and Meta-Analysis. Cureus. 2024;16(12):e76051. DOI: 10.7759/cureus.76051.',
  8: 'Revisão sistemática e meta-análise: o PRP produziu retorno ao desporto mais rápido nas lesões musculares agudas, com alívio de dor superior no subgrupo dos isquiotibiais. Sports Medicine – Open. 2026. DOI: 10.1186/s40798-026-01017-w.',
  9: 'Liu M, Zhai H, Wang R, Wang J, Xiong Y, Peng Y. Effect of Platelet-Rich Plasma Injection in Hamstring Injury: A Systematic Review and Meta-Analysis. Journal of Sport Rehabilitation. 2025;35(2):98.',
};

// -----------------------------------------------------------------
// Textos-base da justificação (congelados, aprovados 2026-07-19).
// Chave = `${indicacao}__${procedimento}`.
// Cada função devolve { paragrafos: [...], refs: [...] }.
// Os campos dinâmicos entram como placeholders resolvidos aqui.
// -----------------------------------------------------------------
function partesDinamicas(state) {
  const loc = state.localizacao ? state.localizacao.toLowerCase() : '';
  const locFrag = loc ? ` [${loc}]` : '';
  const grauFrag = state.grau ? ` [${state.grau}]` : '';
  const trats = state.tratamentos.length
    ? state.tratamentos.map(t => t.toLowerCase()).join(', ')
    : 'tratamento conservador optimizado';
  const nInf = state.infiltracoes || '1';
  return { loc, locFrag, grauFrag, trats, nInf };
}

function buildJustificacao(state) {
  const { locFrag, grauFrag, trats, nInf } = partesDinamicas(state);
  const key = `${state.indicacao}__${state.procedimento}`;

  const T = {
    // 1 · Osteoartrose — PRP (LP-PRP)
    'osteoartrose__prp': {
      refs: [1, 2, 3],
      paragrafos: [
        `Solicita-se autorização para tratamento com <strong>plasma rico em plaquetas leucodepletado (LP-PRP)</strong>, por via intra-articular, no contexto de <strong>osteoartrose${locFrag}${grauFrag}</strong>.`,
        `Trata-se de terapêutica biológica autóloga em que o objectivo principal se baseia na libertação de factores de crescimento plaquetários (PDGF, TGF-β, IGF-1, VEGF), com efeito condroprotector, anti-inflamatório e modulador do ambiente sinovial. A evidência actual demonstra superioridade do LP-PRP sobre o ácido hialurónico e sobre o corticosteróide no controlo da dor e na melhoria funcional, com benefício sustentado até 6 a 12 meses, sobretudo em graus ligeiros a moderados (KL I–III) sem indicação cirúrgica.<sup>1,2,3</sup>`,
        `O doente cumpre os critérios de indicação: dor persistente e incapacitante, refractária a ${trats} devidamente cumpridos, com impacto funcional relevante nas actividades de vida diária. Esgotadas as opções conservadoras, o PRP constitui o passo terapêutico seguinte antes de considerar abordagem cirúrgica.`,
        `Prevê(em)-se <strong>${nInf}</strong> infiltração(ões), com intervalo de 4 semanas, integradas em programa de reabilitação.`,
      ],
    },
    // 2 · Osteoartrose — Viscossuplementação (AH)
    'osteoartrose__visco': {
      refs: [4, 5],
      paragrafos: [
        `Solicita-se autorização para <strong>viscossuplementação com ácido hialurónico intra-articular</strong>, no contexto de <strong>osteoartrose${locFrag}${grauFrag}</strong>.`,
        `O objectivo da viscossuplementação assenta na reposição das propriedades viscoelásticas do líquido sinovial, degradadas na osteoartrose, restaurando a lubrificação e o amortecimento articular, com efeito analgésico e anti-inflamatório local. A evidência aponta para benefício sintomático em subgrupos seleccionados de osteoartrose ligeira a moderada, sendo a resposta condicionada pelo grau radiológico (KL II–III) e pelo perfil do doente.<sup>4,5</sup> Constitui alternativa ao uso continuado de anti-inflamatórios sistémicos, contribuindo para adiar a abordagem cirúrgica.`,
        `O doente cumpre os critérios de indicação: dor articular persistente, refractária a ${trats}, com impacto funcional relevante nas actividades de vida diária.`,
        `Prevê(em)-se <strong>${nInf}</strong> infiltração(ões) em esquema semanal, integradas em programa de reabilitação.`,
      ],
    },
    // 3 · Tendinopatia — PRP
    'tendinopatia__prp': {
      refs: [6, 7],
      paragrafos: [
        `Solicita-se autorização para tratamento com <strong>plasma rico em plaquetas (PRP)</strong>, por via peritendinosa/intralesional guiada por ecografia, no contexto de <strong>tendinopatia${locFrag}${grauFrag}</strong>.`,
        `Trata-se de terapêutica biológica autóloga em que o objectivo principal se baseia na libertação de factores de crescimento plaquetários (PDGF, TGF-β, IGF-1, VEGF), que estimulam a reparação do tecido tendinoso degenerado e hipovascular, promovendo neovascularização e reorganização das fibras de colagénio. A evidência sugere benefício do PRP na tendinopatia crónica refractária, com resultados dependentes da preparação utilizada e da técnica de aplicação ecoguiada.<sup>6,7</sup> Ao contrário do corticosteróide — cujo uso repetido compromete a integridade do tendão — o PRP promove um processo reparativo, sem efeito deletério sobre a estrutura tendinosa.<sup>7</sup>`,
        `O doente cumpre os critérios de indicação: dor persistente e incapacitante, refractária a ${trats} devidamente cumpridos, com impacto funcional relevante. Esgotadas as opções conservadoras, o PRP constitui o passo terapêutico seguinte antes de considerar abordagem cirúrgica.`,
        `Prevê(em)-se <strong>${nInf}</strong> infiltração(ões), com intervalo de 4 semanas, integradas em programa de reabilitação.`,
      ],
    },
    // 4 · Rotura tendinosa parcial — PRP
    'rotura_tendao__prp': {
      refs: [6],
      paragrafos: [
        `Solicita-se autorização para tratamento com <strong>plasma rico em plaquetas (PRP)</strong>, por via intralesional guiada por ecografia, no contexto de <strong>rotura parcial${locFrag}${grauFrag}</strong>, sem indicação cirúrgica.`,
        `Trata-se de terapêutica biológica autóloga em que o objectivo principal se baseia na libertação de factores de crescimento plaquetários (PDGF, TGF-β, IGF-1, VEGF), que promovem a cicatrização da lesão tendinosa parcial, estimulando a síntese de colagénio e a reorganização estrutural do tendão. Nas roturas parciais sem critério cirúrgico, o PRP é proposto como opção de reparação biológica, favorecendo o adiamento — ou dispensa — da intervenção cirúrgica.<sup>6</sup> O corticosteróide está aqui contraindicado, por comprometer a cicatrização e agravar o risco de progressão da rotura.`,
        `O doente cumpre os critérios de indicação: lesão parcial documentada imagiologicamente, dor e défice funcional refractários a ${trats}, sem indicação para reparação cirúrgica no momento actual.`,
        `Prevê(em)-se <strong>${nInf}</strong> infiltração(ões), com intervalo de 4 semanas, integradas em programa de reabilitação.`,
      ],
    },
    // 5 · Rotura muscular — PRP
    'rotura_muscular__prp': {
      refs: [8, 9],
      paragrafos: [
        `Solicita-se autorização para tratamento com <strong>plasma rico em plaquetas (PRP)</strong>, por via intralesional guiada por ecografia, no contexto de <strong>rotura muscular${locFrag}${grauFrag}</strong>.`,
        `Trata-se de terapêutica biológica autóloga em que o objectivo principal se baseia na libertação de factores de crescimento plaquetários (PDGF, TGF-β, IGF-1, VEGF), que favorecem a reparação do tecido muscular lesado e a regeneração das fibras. A evidência sugere que o PRP, associado a reabilitação e aplicado por via ecoguiada, pode acelerar o retorno à actividade nas lesões musculares agudas, com possível redução do tempo de inactividade, sobretudo nas lesões dos isquiotibiais.<sup>8,9</sup> Os resultados quanto à recidiva são inconsistentes entre estudos.<sup>9</sup>`,
        `O doente cumpre os critérios de indicação: lesão muscular documentada, com dor e limitação funcional que condicionam a reabilitação e o retorno à actividade, sob ${trats}.`,
        `Prevê-se <strong>${nInf}</strong> infiltração, integrada em programa de reabilitação progressiva.`,
      ],
    },
  };

  return T[key] || null;
}

// -----------------------------------------------------------------
// Corpo do documento (preview + PDF)
// -----------------------------------------------------------------
function buildPrpBody({ patient, state, hda }) {
  // Sem clinic — igual a relatorio-consulta.js. A clínica já vai no
  // cabeçalho/rodapé do documento via buildShellV2, não se repete aqui.
  const patientCard = buildPatientCard({ patient, mode: 'full' });
  const jus = buildJustificacao(state);

  if (!jus) {
    return `${patientCard}<div class="gcv2-prp-warn">Seleccione uma combinação válida de indicação e procedimento.</div>`;
  }

  const indLabel = IND_LABELS[state.indicacao] || '';
  const procLabel = PROC_LABELS[state.procedimento] || '';
  const locStr = state.localizacao ? ` — ${escHtml(state.localizacao)}` : '';
  const grauStr = state.grau ? ` (${escHtml(state.grau)})` : '';

  const cabecalho = `
    <div class="gcv2-prp-meta">
      <div><span class="gcv2-prp-k">Procedimento</span> ${escHtml(procLabel)}</div>
      <div><span class="gcv2-prp-k">Indicação clínica</span> ${escHtml(indLabel)}${locStr}${grauStr}</div>
    </div>`;

  const hdaBlock = hda && hda.trim()
    ? `<div class="gcv2-prp-sec">
         <div class="gcv2-prp-slabel">História da doença actual / exame objectivo</div>
         <div class="gcv2-prp-hda">${escHtml(hda).replace(/\n/g, '<br>')}</div>
       </div>`
    : '';

  const paras = jus.paragrafos.map(p => `<p class="gcv2-prp-p">${p}</p>`).join('');

  const obsBlock = state.observacoes && state.observacoes.trim()
    ? `<div class="gcv2-prp-sec">
         <div class="gcv2-prp-slabel">Observações adicionais</div>
         <div class="gcv2-prp-obs">${escHtml(state.observacoes).replace(/\n/g, '<br>')}</div>
       </div>`
    : '';

  const refsList = (jus.refs || [])
    .map(n => `<li><sup>${n}</sup> ${escHtml(REFS[n] || '')}</li>`)
    .join('');
  const refsBlock = refsList
    ? `<div class="gcv2-prp-refs">
         <div class="gcv2-prp-slabel">Referências</div>
         <ol class="gcv2-prp-refs-list">${refsList}</ol>
       </div>`
    : '';

  return `
    ${patientCard}
    ${cabecalho}
    ${hdaBlock}
    <div class="gcv2-prp-sec">
      <div class="gcv2-prp-slabel">Justificação clínica e pedido de autorização</div>
      ${paras}
    </div>
    ${obsBlock}
    ${refsBlock}
  `;
}

// -----------------------------------------------------------------
// Helpers de CSS (padrão atestado.js)
// -----------------------------------------------------------------
function ensureShellCss() {
  if (document.querySelector('link[data-gcv2-shell]')) return;
  const lnk = document.createElement('link');
  lnk.rel = 'stylesheet';
  lnk.href = new URL('../_shell/shell-v2.css', import.meta.url).href;
  lnk.dataset.gcv2Shell = '1';
  document.head.appendChild(lnk);
}

function ensurePrpCss() {
  if (document.querySelector('link[data-gcv2-prp]')) return;
  const lnk = document.createElement('link');
  lnk.rel = 'stylesheet';
  lnk.href = new URL('./prp.css', import.meta.url).href;
  lnk.dataset.gcv2Prp = '1';
  document.head.appendChild(lnk);
}

function ensureAtestadoCss() {
  // .gcv2-btn/.gcv2-btn-primary/.gcv2-btn-secondary (Cancelar/Gerar PDF) e
  // .gcv2-patient-card/.gcv2-pc-* (cartão de identificação) só têm estilo em
  // atestado.css — reutilizado como CSS partilhado do design system v2, mesmo
  // padrão que pedidos-v2.js usa (PATIENT_CARD_CSS_URL) e que o próprio
  // atestado.js usa para si mesmo. Mesmo atributo data-gcv2-atestado que
  // atestado.js já usa — se ambos os módulos carregarem na mesma página, só
  // injecta uma vez.
  if (document.querySelector('link[data-gcv2-atestado]')) return;
  const lnk = document.createElement('link');
  lnk.rel = 'stylesheet';
  lnk.href = new URL('../atestados/atestado.css', import.meta.url).href;
  lnk.dataset.gcv2Atestado = '1';
  document.head.appendChild(lnk);
}

async function loadLastConsult(patientId) {
  const { data, error } = await window.sb
    .from('consultations')
    .select('id, clinic_id, hda, report_date, created_at')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) { console.error('[prp] loadLastConsult erro:', error); return null; }
  return (data && data[0]) || null;
}

async function loadPatient(patientId) {
  // Query idêntica a relatorio-consulta.js (loadPatient) — mesma fonte da verdade
  // para a identificação do doente em todos os documentos v2, sem excepção para o
  // PRP. Copia campos mesmo que o template PRP não os use todos (ex: sex,
  // passport_id) — a consistência do cartão vale mais que poupar colunas.
  if (!patientId) return null;
  const { data, error } = await window.sb
    .from('patients')
    .select('id, full_name, dob, sex, nif, sns, cc_number, passport_id, address_line1, postal_code, city, insurance_provider, insurance_policy_number')
    .eq('id', patientId)
    .single();
  if (error) { console.error('[prp] loadPatient erro:', error); return null; }
  return data;
}

function stripHtml(s) {
  const d = document.createElement('div');
  d.innerHTML = s || '';
  return d.innerText || d.textContent || '';
}

// -----------------------------------------------------------------
// Modal principal
// -----------------------------------------------------------------
export async function openPrpModal({ patientId, onClose } = {}) {
  if (!patientId) { console.warn('[prp] sem patientId'); return; }

  ensureShellCss();
  ensureAtestadoCss();
  ensurePrpCss();

  const lastConsult = await loadLastConsult(patientId);
  const clinicId = lastConsult?.clinic_id || null;
  const consultationId = lastConsult?.id || null;
  const lastHda = lastConsult?.hda ? stripHtml(lastConsult.hda) : '';

  const [patient, clinic, doctor, vinhetaUrl] = await Promise.all([
    loadPatient(patientId),
    clinicId ? loadClinicById(clinicId) : Promise.resolve(null),
    loadCurrentDoctor(),
    getVinhetaDataUrl(),
  ]);

  // Estado local
  const state = {
    procedimento: 'prp',
    indicacao: 'osteoartrose',
    localizacao: '',
    grau: '',
    tratamentos: [],
    infiltracoes: '1',
    hda: '',
    observacoes: '',
    signDate: new Date().toISOString().slice(0, 10),
  };

  // Overlay
  const overlay = document.createElement('div');
  overlay.className = 'gcv2-prp-overlay';
  overlay.innerHTML = `
    <div class="gcv2-prp-modal">
      <header class="gcv2-prp-head">
        <h2>Pedido de comparticipação — PRP / Viscossuplementação</h2>
        <button class="gcv2-prp-close" aria-label="Fechar">×</button>
      </header>

      <div class="gcv2-prp-split">
        <aside class="gcv2-prp-form">
          <label class="gcv2-prp-field">
            <span>Indicação clínica</span>
            <select id="gcv2-prp-ind"></select>
          </label>

          <label class="gcv2-prp-field">
            <span>Procedimento</span>
            <select id="gcv2-prp-proc"></select>
          </label>

          <label class="gcv2-prp-field">
            <span>Localização</span>
            <select id="gcv2-prp-loc"></select>
          </label>

          <label class="gcv2-prp-field">
            <span>Grau imagiológico</span>
            <select id="gcv2-prp-grau"></select>
          </label>

          <div class="gcv2-prp-field">
            <span>Tratamentos conservadores já realizados</span>
            <div id="gcv2-prp-trats" class="gcv2-prp-checks"></div>
          </div>

          <label class="gcv2-prp-field">
            <span>Nº de infiltrações previstas</span>
            <select id="gcv2-prp-inf">
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
            </select>
          </label>

          <label class="gcv2-prp-field">
            <span>HDA / exame objectivo <small>(pré-carregada da última consulta, editável)</small></span>
            <textarea id="gcv2-prp-hda" rows="4" placeholder="História clínica e achados relevantes para o pedido…"></textarea>
          </label>

          <label class="gcv2-prp-field">
            <span>Observações adicionais <small>(opcional)</small></span>
            <textarea id="gcv2-prp-obs" rows="2" placeholder="Notas adicionais…"></textarea>
          </label>

          <label class="gcv2-prp-field">
            <span>Data de assinatura</span>
            <input type="date" id="gcv2-prp-signdate" value="${state.signDate}">
          </label>

          <div class="gcv2-prp-actions">
            <button class="gcv2-btn gcv2-btn-secondary" id="gcv2-prp-cancel">Cancelar</button>
            <button class="gcv2-btn gcv2-btn-primary" id="gcv2-prp-gen">Gerar PDF</button>
          </div>
        </aside>

        <main class="gcv2-prp-preview">
          <div id="gcv2-prp-preview-host"></div>
        </main>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const selInd = overlay.querySelector('#gcv2-prp-ind');
  const selProc = overlay.querySelector('#gcv2-prp-proc');
  const selLoc = overlay.querySelector('#gcv2-prp-loc');
  const selGrau = overlay.querySelector('#gcv2-prp-grau');
  const selInf = overlay.querySelector('#gcv2-prp-inf');
  const boxTrats = overlay.querySelector('#gcv2-prp-trats');
  const taHda = overlay.querySelector('#gcv2-prp-hda');
  const taObs = overlay.querySelector('#gcv2-prp-obs');

  // ---- Preencher selects dependentes da indicação ----
  function fillIndicacoes() {
    selInd.innerHTML = Object.entries(IND_LABELS)
      .map(([v, l]) => `<option value="${v}" ${v === state.indicacao ? 'selected' : ''}>${escHtml(l)}</option>`)
      .join('');
  }

  function fillProcedimentos() {
    const permitidos = PROC_POR_IND[state.indicacao] || ['prp'];
    if (!permitidos.includes(state.procedimento)) state.procedimento = permitidos[0];
    selProc.innerHTML = permitidos
      .map(p => `<option value="${p}" ${p === state.procedimento ? 'selected' : ''}>${escHtml(PROC_LABELS[p])}</option>`)
      .join('');
    selProc.disabled = permitidos.length === 1;
  }

  function fillLocalizacoes() {
    const opts = OPTS.localizacao[state.indicacao] || [];
    selLoc.innerHTML = `<option value="">— seleccione —</option>` +
      opts.map(o => `<option value="${escAttr(o)}" ${o === state.localizacao ? 'selected' : ''}>${escHtml(o)}</option>`).join('');
    if (!opts.includes(state.localizacao)) state.localizacao = '';
  }

  function fillGraus() {
    const opts = OPTS.grau[state.indicacao] || [];
    selGrau.innerHTML = `<option value="">— seleccione —</option>` +
      opts.map(o => `<option value="${escAttr(o)}" ${o === state.grau ? 'selected' : ''}>${escHtml(o)}</option>`).join('');
    if (!opts.includes(state.grau)) state.grau = '';
  }

  function fillTratamentos() {
    const opts = OPTS.tratamentos[state.indicacao] || [];
    // Manter apenas os tratamentos válidos para a nova indicação
    state.tratamentos = state.tratamentos.filter(t => opts.includes(t));
    boxTrats.innerHTML = opts.map((o, i) => `
      <label class="gcv2-prp-ck ${state.tratamentos.includes(o) ? 'on' : ''}" data-val="${escAttr(o)}">
        <input type="checkbox" ${state.tratamentos.includes(o) ? 'checked' : ''} data-i="${i}">
        <span>${escHtml(o)}</span>
      </label>
    `).join('');
    boxTrats.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.addEventListener('change', () => {
        const val = cb.closest('.gcv2-prp-ck').dataset.val;
        if (cb.checked) {
          if (!state.tratamentos.includes(val)) state.tratamentos.push(val);
          cb.closest('.gcv2-prp-ck').classList.add('on');
        } else {
          state.tratamentos = state.tratamentos.filter(t => t !== val);
          cb.closest('.gcv2-prp-ck').classList.remove('on');
        }
        renderPreview();
      });
    });
  }

  function rebuildIndicacaoDependents() {
    fillProcedimentos();
    fillLocalizacoes();
    fillGraus();
    fillTratamentos();
  }

  // ---- Render do preview ----
  function renderPreview() {
    const body = buildPrpBody({ patient, state, hda: state.hda });
    const shellHtml = buildShellV2({
      clinic, doctor,
      config: {
        kicker: 'Medicina Física & Reabilitação',
        title: 'Pedido de comparticipação',
        date: state.signDate,
        vinhetaUrl,
      },
      contentHtml: body,
    });
    const host = overlay.querySelector('#gcv2-prp-preview-host');
    if (host) host.innerHTML = shellHtml;
  }

  // ---- Inicializar ----
  fillIndicacoes();
  rebuildIndicacaoDependents();
  state.hda = lastHda;
  taHda.value = lastHda;
  renderPreview();

  // ---- Bindings ----
  selInd.addEventListener('change', () => {
    state.indicacao = selInd.value;
    rebuildIndicacaoDependents();
    renderPreview();
  });
  selProc.addEventListener('change', () => { state.procedimento = selProc.value; renderPreview(); });
  selLoc.addEventListener('change', () => { state.localizacao = selLoc.value; renderPreview(); });
  selGrau.addEventListener('change', () => { state.grau = selGrau.value; renderPreview(); });
  selInf.addEventListener('change', () => { state.infiltracoes = selInf.value; renderPreview(); });
  taHda.addEventListener('input', () => { state.hda = taHda.value; renderPreview(); });
  taObs.addEventListener('input', () => { state.observacoes = taObs.value; renderPreview(); });
  overlay.querySelector('#gcv2-prp-signdate').addEventListener('change', (e) => {
    state.signDate = e.target.value; renderPreview();
  });

  // ---- Fechar ----
  function closeModal() {
    overlay.remove();
    if (typeof onClose === 'function') onClose();
  }
  overlay.querySelector('.gcv2-prp-close').addEventListener('click', closeModal);
  overlay.querySelector('#gcv2-prp-cancel').addEventListener('click', closeModal);

  // ---- Gerar PDF + guardar ----
  overlay.querySelector('#gcv2-prp-gen').addEventListener('click', async (e) => {
    const btn = e.currentTarget;

    if (!buildJustificacao(state)) {
      alert('Seleccione uma combinação válida de indicação e procedimento antes de gerar.');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'A gerar PDF…';

    try {
      const html = overlay.querySelector('#gcv2-prp-preview-host').innerHTML;
      const styles = Array.from(document.querySelectorAll('link[data-gcv2-shell], link[data-gcv2-atestado], link[data-gcv2-prp]'))
        .map(l => `<link rel="stylesheet" href="${l.href}">`).join('\n');
      const fullHtml = `<!doctype html><html lang="pt-PT"><head><meta charset="utf-8">${styles}</head><body>${html}</body></html>`;

      const resp = await fetch('https://gc-pdf-proxy.dr-joao-morais.workers.dev/pdf', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ html: fullHtml, media: 'print' }),
      });
      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        throw new Error(`PDF worker erro ${resp.status}: ${errText.slice(0, 200)}`);
      }
      const buf = await resp.arrayBuffer();
      const blob = new Blob([buf], { type: 'application/pdf' });
      if (!blob || blob.size < MIN_PDF_BYTES) {
        throw new Error('PDF inválido ou demasiado pequeno (provável em branco).');
      }

      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');

      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `prp_visco_${state.signDate}_${ts}.pdf`;
      const path = `clinic_${clinic?.id || 'unknown'}/patient_${patientId}/prp/${fileName}`;
      const { error: upErr } = await window.sb.storage.from('documents').upload(path, blob, {
        contentType: 'application/pdf',
        upsert: true,
      });
      if (upErr) throw new Error(`Falha no upload para Storage: ${upErr.message || upErr}`);

      const { error: insErr } = await window.sb.from('documents').insert({
        patient_id: patientId,
        clinic_id: clinic?.id || null,
        consultation_id: consultationId,
        category: 'prp_visco',
        title: `Pedido de comparticipação — ${IND_LABELS[state.indicacao]} (${PROC_LABELS[state.procedimento]})`,
        html: fullHtml,
        storage_path: path,
        doc_number: generateDocNumber(),
        version: 1,
      });
      if (insErr) throw new Error(`Falha ao registar em documents: ${insErr.message || insErr}`);

      closeModal();
    } catch (err) {
      console.error('[prp] erro a gerar PDF:', err);
      alert('Erro a gerar PDF: ' + (err?.message || err));
      btn.disabled = false;
      btn.textContent = 'Gerar PDF';
    }
  });
}

// Expor globalmente (padrão dos outros geradores v2)
if (typeof window !== 'undefined') {
  window.__gcv2_openPrpModal = openPrpModal;
}
