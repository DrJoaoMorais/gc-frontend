/**
 * pedidos-v2.js
 * Modal "Pedidos" (Análises + Exames) — esqueleto visual, Passo 4a.
 *
 * Baseado no mockup aprovado (mockup-pedidos-feed.html). Sem dados reais,
 * sem PDF, sem ligação a ANALISES_CATALOG/ANALISES_GRUPOS (fica para 4b).
 * Todo o conteúdo dos grupos/chips/pills é estático, de exemplo.
 *
 * Uso (dentro de #fdModalRoot do feed, que já tem all:initial + box-sizing
 * aplicado a si e a todos os descendentes — ver feed-doente.html):
 *
 *   import { mount, unmount } from './pedidos-v2.js';
 *   mount(container, { patientName, patientMeta, onClose });
 *   ...
 *   unmount(container);
 *
 * options:
 *   patientName  {string} — nome do doente (texto simples, escapado)
 *   patientMeta  {string} — linha de meta-dados (DN, NIF, seguro…), texto simples
 *   onClose      {Function} — chamado quando o utilizador clica "Fechar"
 *                (depois de o módulo já ter feito o seu próprio unmount)
 */

const STYLE_ID = "pdv2-styles";

function escHtml(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

function removeStyles() {
  document.getElementById(STYLE_ID)?.remove();
}

/**
 * mount
 * Constrói o esqueleto visual do modal de Pedidos dentro de `container`.
 */
export function mount(container, options = {}) {
  if (!container) return;

  const patientName = escHtml(options.patientName || "Doente de exemplo");
  const patientMeta = escHtml(options.patientMeta || "DN — · NIF — · Seguro —");

  ensureStyles();

  container.innerHTML = `
    <div class="pdv2-overlay">
      <div class="pdv2-modal">

        <div class="pdv2-head">
          <div class="pdv2-titulo">Pedidos</div>
          <div class="pdv2-doente">
            <span><b>${patientName}</b></span>
            <span>${patientMeta}</span>
          </div>
          <button class="pdv2-fechar" data-pdv2="fechar">Fechar</button>
        </div>

        <div class="pdv2-tabs">
          <div class="pdv2-tab pdv2-tab--on" data-pdv2-tab="analises">Análises <span class="pdv2-n">4</span></div>
          <div class="pdv2-tab" data-pdv2-tab="exames">Exames <span class="pdv2-n">5</span></div>
        </div>

        <!-- ============ SEPARADOR ANÁLISES ============ -->
        <div class="pdv2-tabpanel pdv2-tabpanel--on" data-pdv2-panel="analises">
          <div class="pdv2-quick">
            <span class="pdv2-lbl">Perfis rápidos</span>
            <button class="pdv2-chip">Rotina Fisiatria</button>
            <button class="pdv2-chip">Pré-PRP / Pré-infiltração</button>
            <button class="pdv2-chip">Reumatológico</button>
            <div class="pdv2-chipWrap" data-pdv2="chipwrap">
              <button class="pdv2-chip">Med. Desportiva ▾</button>
              <div class="pdv2-chipMenu">
                <button class="pdv2-op">Pré-época</button>
                <button class="pdv2-op">Atleta &gt; 40 anos</button>
                <button class="pdv2-op">Atleta mulher</button>
                <button class="pdv2-op">Fractura de stress / RED-S</button>
                <button class="pdv2-op">Overtraining</button>
              </div>
            </div>
            <div class="pdv2-chipWrap" data-pdv2="chipwrap">
              <button class="pdv2-chip">Mais ▾</button>
              <div class="pdv2-chipMenu">
                <button class="pdv2-op">Infecciologia / Pré-biológico</button>
                <button class="pdv2-op">Neurológico</button>
                <button class="pdv2-op">Longevidade</button>
              </div>
            </div>
            <input class="pdv2-search" type="text" placeholder="Pesquisar análise… (ferritina, PCR, TSH)">
          </div>

          <div class="pdv2-body">
            <div class="pdv2-colEsq">

              <div class="pdv2-grp pdv2-grp--open">
                <div class="pdv2-grpHead"><span class="pdv2-nome">🩸 Hematologia / Coagulação <span class="pdv2-badge">2 sel.</span></span><span class="pdv2-chev">▲</span></div>
                <div class="pdv2-grpItems">
                  <label class="pdv2-item"><input type="checkbox" checked><span>Hemograma completo<span class="pdv2-info">Anemia, infecção, avaliação global</span></span></label>
                  <label class="pdv2-item"><input type="checkbox" checked><span>Velocidade de sedimentação (VS)<span class="pdv2-info">Marcador de inflamação inespecífico</span></span></label>
                  <label class="pdv2-item"><input type="checkbox"><span>INR<span class="pdv2-info">Anticoagulação, função hepática</span></span></label>
                  <label class="pdv2-item"><input type="checkbox"><span>Dímeros-D<span class="pdv2-info">Exclusão TEP e TVP</span></span></label>
                </div>
              </div>

              <div class="pdv2-grp pdv2-grp--open">
                <div class="pdv2-grpHead"><span class="pdv2-nome">🧪 Bioquímica <span class="pdv2-badge">2 sel.</span></span><span class="pdv2-chev">▲</span></div>
                <div class="pdv2-grpItems">
                  <label class="pdv2-item"><input type="checkbox" checked><span>Glicose em jejum<span class="pdv2-info">Diabetes, pré-diabetes</span></span></label>
                  <label class="pdv2-item"><input type="checkbox" checked><span>Creatinina<span class="pdv2-info">Função renal</span></span></label>
                  <label class="pdv2-item"><input type="checkbox"><span>Ácido úrico<span class="pdv2-info">Gota, síndrome metabólico</span></span></label>
                  <label class="pdv2-item"><input type="checkbox"><span>AST / ALT<span class="pdv2-info">Lesão hepática e muscular</span></span></label>
                </div>
              </div>

              <div class="pdv2-grp">
                <div class="pdv2-grpHead"><span class="pdv2-nome">🦴 Metabolismo Ósseo</span><span class="pdv2-chev">▼</span></div>
                <div class="pdv2-grpItems">
                  <label class="pdv2-item"><input type="checkbox"><span>Cálcio total<span class="pdv2-info">Hiperparatiroidismo, osteoporose</span></span></label>
                  <label class="pdv2-item"><input type="checkbox"><span>Fósforo<span class="pdv2-info">Metabolismo ósseo</span></span></label>
                </div>
              </div>
              <div class="pdv2-grp">
                <div class="pdv2-grpHead"><span class="pdv2-nome">🔥 Inflamação / Autoimunidade</span><span class="pdv2-chev">▼</span></div>
                <div class="pdv2-grpItems">
                  <label class="pdv2-item"><input type="checkbox"><span>Proteína C reativa (PCR)<span class="pdv2-info">Inflamação, infecção</span></span></label>
                  <label class="pdv2-item"><input type="checkbox"><span>Anticorpos antinucleares (ANA)<span class="pdv2-info">Screening autoimunidade sistémica</span></span></label>
                </div>
              </div>

            </div>

            <div class="pdv2-colDir">
              <h3>Pedido actual</h3>

              <div class="pdv2-idCard">
                <span class="pdv2-v2tag">Cabeçalho V2</span>
                <div class="pdv2-idnome">${patientName}</div>
                <div class="pdv2-idmeta">${patientMeta}</div>
              </div>

              <div class="pdv2-pills">
                <div class="pdv2-pillGrp">Hematologia</div>
                <div class="pdv2-pill"><span class="pdv2-miolo">Hemograma completo</span><span class="pdv2-x">×</span></div>
                <div class="pdv2-pill"><span class="pdv2-miolo">Velocidade de sedimentação (VS)</span><span class="pdv2-x">×</span></div>
                <div class="pdv2-pillGrp">Bioquímica</div>
                <div class="pdv2-pill"><span class="pdv2-miolo">Glicose em jejum</span><span class="pdv2-x">×</span></div>
                <div class="pdv2-pill"><span class="pdv2-miolo">Creatinina</span><span class="pdv2-x">×</span></div>
              </div>

              <div class="pdv2-miniDoc">
                <div class="pdv2-mh"><div class="pdv2-logo"></div><div class="pdv2-tit">Pedido de Análises</div></div>
                <div class="pdv2-corpo"></div>
                <div class="pdv2-mf"><span>Dr. João Morais · OM 44380</span><span>Vinheta</span></div>
                <div class="pdv2-cap">Pré-visualização — sai com cabeçalho e rodapé do Relatório V2</div>
              </div>

              <div class="pdv2-rodape">
                <div class="pdv2-linha">
                  <input type="text" placeholder="Informação clínica (opcional)…">
                  <input type="date">
                </div>
                <button class="pdv2-btnPdf" disabled>Gerar PDF · 4 análises</button>
                <div class="pdv2-notaPdf">Um único PDF com todas as análises seleccionadas</div>
              </div>
            </div>
          </div>
        </div>

        <!-- ============ SEPARADOR EXAMES ============ -->
        <div class="pdv2-tabpanel" data-pdv2-panel="exames" style="display:none;">
          <div class="pdv2-quick">
            <span class="pdv2-lbl">Perfis</span>
            <button class="pdv2-chip">Cardiologia</button>
            <button class="pdv2-chip">Pneumologia</button>
            <span class="pdv2-lbl" style="margin-left:10px;">Região</span>
            <button class="pdv2-chip">Ombro</button>
            <button class="pdv2-chip">Joelho</button>
            <button class="pdv2-chip">Coluna lombar</button>
            <button class="pdv2-chip">Anca</button>
            <input class="pdv2-search" type="text" placeholder="Pesquisar exame… (RM ombro, eco, RX)">
          </div>

          <div class="pdv2-body">
            <div class="pdv2-colEsq">

              <div class="pdv2-grp pdv2-grp--open">
                <div class="pdv2-grpHead"><span class="pdv2-nome">🫀 Cardiologia <span class="pdv2-badge">3 sel.</span></span><span class="pdv2-chev">▲</span></div>
                <div class="pdv2-grpItems">
                  <label class="pdv2-item"><input type="checkbox" checked><span>Electrocardiograma (ECG) de repouso</span></label>
                  <label class="pdv2-item"><input type="checkbox" checked><span>Ecocardiograma transtorácico</span></label>
                  <label class="pdv2-item"><input type="checkbox" checked><span>Prova de esforço</span></label>
                  <label class="pdv2-item"><input type="checkbox"><span>Holter 24h</span></label>
                </div>
              </div>

              <div class="pdv2-grp">
                <div class="pdv2-grpHead"><span class="pdv2-nome">🫁 Provas Funcionais Respiratórias</span><span class="pdv2-chev">▼</span></div>
                <div class="pdv2-grpItems">
                  <label class="pdv2-item"><input type="checkbox"><span>Espirometria com prova de broncodilatação</span></label>
                  <label class="pdv2-item"><input type="checkbox"><span>Provas de função respiratória completas (com DLCO)</span></label>
                </div>
              </div>
              <div class="pdv2-grp">
                <div class="pdv2-grpHead"><span class="pdv2-nome">🧲 Ressonância Magnética</span><span class="pdv2-chev">▼</span></div>
                <div class="pdv2-grpItems">
                  <label class="pdv2-item"><input type="checkbox"><span>RM do ombro direito</span></label>
                  <label class="pdv2-item"><input type="checkbox"><span>RM do joelho esquerdo</span></label>
                </div>
              </div>
              <div class="pdv2-grp">
                <div class="pdv2-grpHead"><span class="pdv2-nome">📡 Ecografia Osteoarticular</span><span class="pdv2-chev">▼</span></div>
                <div class="pdv2-grpItems">
                  <label class="pdv2-item"><input type="checkbox"><span>Ecografia do ombro direito</span></label>
                  <label class="pdv2-item"><input type="checkbox"><span>Ecografia do joelho</span></label>
                </div>
              </div>
              <div class="pdv2-grp">
                <div class="pdv2-grpHead"><span class="pdv2-nome">☢️ Radiografia</span><span class="pdv2-chev">▼</span></div>
                <div class="pdv2-grpItems">
                  <label class="pdv2-item"><input type="checkbox"><span>Radiografia do ombro — 2 incidências</span></label>
                  <label class="pdv2-item"><input type="checkbox"><span>Radiografia da anca — 1 incidência</span></label>
                </div>
              </div>

            </div>

            <div class="pdv2-colDir">
              <h3>Pedido actual</h3>

              <div class="pdv2-idCard">
                <span class="pdv2-v2tag">Cabeçalho V2</span>
                <div class="pdv2-idnome">${patientName}</div>
                <div class="pdv2-idmeta">${patientMeta}</div>
              </div>

              <div class="pdv2-pills">
                <div class="pdv2-pillGrp">Cardiologia · 1 PDF</div>
                <div class="pdv2-pill"><span class="pdv2-miolo">ECG de repouso</span><span class="pdv2-x">×</span></div>
                <div class="pdv2-pill"><span class="pdv2-miolo">Ecocardiograma transtorácico</span><span class="pdv2-x">×</span></div>
                <div class="pdv2-pill"><span class="pdv2-miolo">Prova de esforço</span><span class="pdv2-x">×</span></div>
              </div>

              <div class="pdv2-miniDoc">
                <div class="pdv2-mh"><div class="pdv2-logo"></div><div class="pdv2-tit">Pedido de Exame</div></div>
                <div class="pdv2-corpo"></div>
                <div class="pdv2-mf"><span>Dr. João Morais · OM 44380</span><span>Vinheta</span></div>
                <div class="pdv2-cap">Pré-visualização — cabeçalho e rodapé do Relatório V2</div>
              </div>

              <div class="pdv2-rodape">
                <div class="pdv2-linha">
                  <input type="date" style="flex:1;">
                </div>
                <button class="pdv2-btnPdf" disabled>Gerar 1 PDF · 3 exames</button>
                <div class="pdv2-notaPdf">Um PDF por modalidade</div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  `;

  /* ---- interacção mínima (só UI, sem lógica de negócio) ---- */

  const tabs  = container.querySelectorAll("[data-pdv2-tab]");
  const onTabClick = (e) => {
    const alvo = e.currentTarget.dataset.pdv2Tab;
    tabs.forEach((t) => t.classList.toggle("pdv2-tab--on", t === e.currentTarget));
    container.querySelectorAll("[data-pdv2-panel]").forEach((p) => {
      const isAlvo = p.dataset.pdv2Panel === alvo;
      p.style.display = isAlvo ? "flex" : "none";
      p.classList.toggle("pdv2-tabpanel--on", isAlvo);
    });
  };
  tabs.forEach((t) => t.addEventListener("click", onTabClick));

  const chipWraps = container.querySelectorAll('[data-pdv2="chipwrap"]');
  const onChipToggle = (e) => {
    e.stopPropagation();
    const wrap = e.currentTarget.parentElement;
    const estava = wrap.classList.contains("pdv2-chipWrap--open");
    chipWraps.forEach((w) => w.classList.remove("pdv2-chipWrap--open"));
    if (!estava) wrap.classList.add("pdv2-chipWrap--open");
  };
  chipWraps.forEach((w) => w.querySelector(":scope > .pdv2-chip")?.addEventListener("click", onChipToggle));

  const onDocClick = () => chipWraps.forEach((w) => w.classList.remove("pdv2-chipWrap--open"));
  document.addEventListener("click", onDocClick);

  const grpHeads = container.querySelectorAll(".pdv2-grpHead");
  const onGrpToggle = (e) => {
    const grp = e.currentTarget.closest(".pdv2-grp");
    if (!grp) return;
    const abreAgora = grp.classList.toggle("pdv2-grp--open");
    const chev = e.currentTarget.querySelector(".pdv2-chev");
    if (chev) chev.textContent = abreAgora ? "▲" : "▼";
  };
  grpHeads.forEach((h) => h.addEventListener("click", onGrpToggle));

  const onFechar = () => {
    unmount(container);
    if (typeof options.onClose === "function") options.onClose();
  };
  container.querySelector('[data-pdv2="fechar"]')?.addEventListener("click", onFechar);

  /* Guarda referências para o unmount limpar sem resíduo */
  container.__pdv2State = { onDocClick };
}

/**
 * unmount
 * Remove tudo o que mount() criou em `container` (DOM, listeners, style).
 */
export function unmount(container) {
  if (!container) return;
  const state = container.__pdv2State;
  if (state?.onDocClick) document.removeEventListener("click", state.onDocClick);
  container.__pdv2State = null;
  container.innerHTML = "";
  removeStyles();
}

/* ====================================================================
   CSS — variáveis de cor definidas localmente em .pdv2-overlay (não
   depende de variáveis globais da página; container tem all:initial).
   ==================================================================== */
const CSS = `
.pdv2-overlay{
  --navy:#0f2d52; --blue:#1a56db; --blue-soft:#eff4ff;
  --ink:#0f172a; --mut:#64748b; --line:#e5e7eb; --bg:#f8fafc;
  --ok:#1d9e75; --ok-soft:#e8f8f3;
  position:fixed; inset:0; background:rgba(15,45,82,.45);
  display:flex; align-items:center; justify-content:center; z-index:100; padding:20px;
  font-family:'Outfit', system-ui, -apple-system, sans-serif;
  box-sizing:border-box;
}
.pdv2-overlay *{ box-sizing:border-box; }
.pdv2-modal{width:min(1120px,100%);height:min(760px,94vh);background:#fff;border-radius:16px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 64px rgba(15,45,82,.35);color:var(--ink);}

.pdv2-head{background:var(--navy);color:#fff;padding:14px 20px;display:flex;align-items:center;gap:18px;flex-shrink:0;}
.pdv2-titulo{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:700;letter-spacing:.3px;}
.pdv2-doente{font-size:12.5px;opacity:.85;display:flex;gap:14px;flex-wrap:wrap;}
.pdv2-doente b{font-weight:600;opacity:1;}
.pdv2-fechar{margin-left:auto;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.3);color:#fff;font-family:inherit;font-size:12px;font-weight:600;padding:7px 16px;border-radius:8px;cursor:pointer;}
.pdv2-fechar:hover{background:rgba(255,255,255,.22);}

.pdv2-tabs{display:flex;border-bottom:1px solid var(--line);flex-shrink:0;background:#fff;padding:0 20px;}
.pdv2-tab{font-size:14px;font-weight:600;color:var(--mut);padding:13px 22px;cursor:pointer;border-bottom:3px solid transparent;user-select:none;}
.pdv2-tab:hover{color:var(--ink);}
.pdv2-tab--on{color:var(--blue);border-bottom-color:var(--blue);}
.pdv2-n{display:inline-block;min-width:18px;text-align:center;font-size:11px;font-weight:700;background:#cbd5e1;color:#fff;border-radius:100px;padding:1px 6px;margin-left:7px;vertical-align:1px;}
.pdv2-tab--on .pdv2-n{background:var(--blue);}

.pdv2-tabpanel{display:none;flex-direction:column;flex:1;overflow:hidden;}
.pdv2-tabpanel--on{display:flex;}

.pdv2-quick{display:flex;align-items:center;gap:8px;padding:12px 20px;border-bottom:1px solid var(--line);flex-shrink:0;flex-wrap:wrap;background:var(--bg);}
.pdv2-lbl{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--mut);margin-right:2px;}
.pdv2-chip{font-size:12px;font-weight:600;color:var(--navy);background:#fff;border:1px solid #c7d5ea;border-radius:100px;padding:6px 14px;cursor:pointer;font-family:inherit;transition:all .12s;}
.pdv2-chip:hover{border-color:var(--blue);color:var(--blue);background:var(--blue-soft);}
.pdv2-chipWrap{position:relative;display:inline-block;}
.pdv2-chipMenu{display:none;position:absolute;top:calc(100% + 4px);left:0;background:#fff;border:1px solid #c7d5ea;border-radius:10px;box-shadow:0 10px 28px rgba(15,45,82,.18);z-index:20;min-width:230px;padding:5px;}
.pdv2-chipWrap--open .pdv2-chipMenu{display:block;}
.pdv2-op{display:block;width:100%;text-align:left;font-size:12px;font-weight:500;color:var(--ink);background:none;border:none;border-radius:7px;padding:7px 10px;cursor:pointer;font-family:inherit;}
.pdv2-op:hover{background:var(--blue-soft);color:var(--blue);}
.pdv2-search{margin-left:auto;width:280px;padding:8px 12px;font-size:13px;border:1px solid #cbd5e1;border-radius:8px;font-family:inherit;outline:none;background:#fff;}
.pdv2-search:focus{border-color:var(--blue);}

.pdv2-body{display:grid;grid-template-columns:1fr 330px;flex:1;overflow:hidden;}
.pdv2-colEsq{overflow-y:auto;padding:16px 20px;}

.pdv2-grp{border:1px solid var(--line);border-radius:10px;margin-bottom:8px;overflow:hidden;background:#fff;}
.pdv2-grp--open{border-color:var(--blue);}
.pdv2-grpHead{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;cursor:pointer;background:var(--bg);user-select:none;}
.pdv2-grp--open .pdv2-grpHead{background:var(--blue-soft);}
.pdv2-grpHead:hover{background:#eef2f8;}
.pdv2-nome{font-size:13px;font-weight:600;display:flex;align-items:center;gap:9px;}
.pdv2-badge{font-size:10px;font-weight:700;background:var(--blue);color:#fff;padding:2px 8px;border-radius:100px;}
.pdv2-chev{font-size:10px;color:var(--mut);}
.pdv2-grpItems{display:none;grid-template-columns:1fr 1fr;gap:2px 14px;padding:10px 14px 12px;border-top:1px solid var(--line);}
.pdv2-grp--open .pdv2-grpItems{display:grid;}
.pdv2-item{display:flex;align-items:flex-start;gap:8px;font-size:12px;color:#374151;padding:4px 6px;border-radius:6px;cursor:pointer;line-height:1.35;}
.pdv2-item:hover{background:var(--bg);}
.pdv2-item input{width:15px;height:15px;accent-color:var(--blue);flex-shrink:0;margin-top:1px;cursor:pointer;}
.pdv2-info{display:block;font-size:10px;color:var(--mut);margin-top:1px;}

.pdv2-colDir{border-left:1px solid var(--line);background:var(--bg);display:flex;flex-direction:column;overflow:hidden;}
.pdv2-colDir h3{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--mut);margin:0;padding:14px 16px 8px;}

.pdv2-idCard{margin:0 16px 10px;background:#fff;border:1px solid var(--line);border-left:3px solid var(--navy);border-radius:8px;padding:10px 12px;}
.pdv2-idnome{font-family:'Cormorant Garamond',serif;font-size:17px;font-weight:700;color:var(--navy);line-height:1.2;}
.pdv2-idmeta{font-size:11px;color:var(--mut);margin-top:3px;line-height:1.5;}
.pdv2-v2tag{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--blue);background:var(--blue-soft);border-radius:5px;padding:2px 7px;float:right;}

.pdv2-pills{flex:1;overflow-y:auto;padding:2px 16px 10px;}
.pdv2-pillGrp{font-size:10px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.05em;margin:8px 0 4px;}
.pdv2-pill{font-size:12px;background:#fff;border:1px solid #cbd5e1;border-radius:7px;padding:6px 10px;display:flex;align-items:flex-start;gap:8px;margin-bottom:5px;line-height:1.3;}
.pdv2-x{margin-left:auto;color:#94a3b8;cursor:pointer;font-size:15px;line-height:1;padding:0 2px;flex-shrink:0;}
.pdv2-x:hover{color:#dc2626;}
.pdv2-miolo{flex:1;}

.pdv2-rodape{border-top:1px solid var(--line);padding:12px 16px;background:#fff;flex-shrink:0;}
.pdv2-linha{display:flex;gap:8px;margin-bottom:9px;}
.pdv2-linha input[type=text]{flex:1;padding:8px 10px;font-size:12px;border:1px solid #cbd5e1;border-radius:7px;font-family:inherit;outline:none;}
.pdv2-linha input[type=date]{padding:7px 8px;font-size:12px;border:1px solid #cbd5e1;border-radius:7px;font-family:inherit;color:var(--ink);}
.pdv2-btnPdf{width:100%;padding:11px;border:none;border-radius:9px;background:var(--blue);color:#fff;font-family:inherit;font-size:13.5px;font-weight:700;cursor:pointer;}
.pdv2-btnPdf:disabled{background:#cbd5e1;color:#94a3b8;cursor:not-allowed;}
.pdv2-notaPdf{font-size:10.5px;color:var(--mut);text-align:center;margin-top:7px;line-height:1.4;}

.pdv2-miniDoc{margin:0 16px 10px;background:#fff;border:1px solid var(--line);border-radius:8px;padding:9px 11px;font-size:9px;color:var(--mut);}
.pdv2-mh{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid var(--navy);padding-bottom:4px;margin-bottom:4px;}
.pdv2-logo{width:34px;height:11px;background:var(--navy);border-radius:2px;}
.pdv2-tit{font-family:'Cormorant Garamond',serif;font-size:11px;font-weight:700;color:var(--navy);}
.pdv2-corpo{height:26px;background:repeating-linear-gradient(#fff,#fff 4px,var(--bg) 4px,var(--bg) 6px);border-radius:3px;margin:4px 0;}
.pdv2-mf{border-top:1px solid var(--line);padding-top:3px;display:flex;justify-content:space-between;font-size:8px;}
.pdv2-cap{font-size:9px;text-align:center;margin-top:5px;color:#94a3b8;}
`;
