/**
 * prp-visco.js — Relatório PRP / Viscossuplementação
 * Painel iframe+Blob isolado, sem interferência com o DOM principal.
 * Padrão idêntico ao Relatório Neurológico (doente.js L6461+).
 */

import { buildReportShell } from "./_shared/report-shell.js";

export function closePrpViscoPanel() {
  document.getElementById("gcPrpViscoModal")?.remove();
}

export async function openPrpViscoPanel({ patient, clinic, onClose }) {
  closePrpViscoPanel();

  /* ── estado ── */
  const state = {
    procedimento: "prp",
    indicacao:    "osteoartrose",
    localizacao:  "",
    grau:         "",
    tratamentos:  [],
    infiltracoes: "1",
    hda:          "",
    observacoes:  "",
  };

  const OPTS = {
    localizacao: {
      osteoartrose:    ["Joelho","Anca","Outra"],
      tendinopatia:    ["Supraespinhoso / Coifa","Epicôndilo","Rotuliano","Aquiles","Outro"],
      rotura_tendao:   ["Supraespinhoso","Bicipital","Rotuliano","Aquiles","Outro"],
      rotura_muscular: ["Isquiotibiais","Quadricípite","Gémeos / Sóleo","Adutor","Outro"],
    },
    grau: {
      osteoartrose:    ["KL I","KL II","KL III"],
      tendinopatia:    ["Degenerativo leve","Degenerativo moderado","Degenerativo grave (sem rotura)"],
      rotura_tendao:   ["< 50% espessura","≥ 50% espessura"],
      rotura_muscular: ["Grau I","Grau II","Grau III parcial"],
    },
    tratamentos: {
      osteoartrose:    ["Programa de reabilitação","AINEs / analgésicos","Corticosteroide prévio","Viscossuplementação prévia","Órteses / suportes","Controlo ponderal"],
      tendinopatia:    ["Programa de reabilitação","Exercício excêntrico supervisionado","AINEs","Ondas de choque","Corticosteroide","Ortótese","Repouso relativo"],
      rotura_tendao:   ["Programa de reabilitação","Imobilização relativa","AINEs","Corticosteroide"],
      rotura_muscular: ["Programa de reabilitação","Repouso relativo","Crioterapia","AINEs"],
    },
  };

  const indLabels = {
    osteoartrose:    "Osteoartrose",
    tendinopatia:    "Tendinopatia",
    rotura_tendao:   "Rotura Parcial de Tendão",
    rotura_muscular: "Rotura Muscular",
  };

  /* ── HDA da última consulta ── */
  let lastHda = "";
  try {
    const { data } = await window.sb
      .from("consultations")
      .select("hda")
      .eq("patient_id", patient.id)
      .order("created_at", { ascending: false })
      .limit(1);
    lastHda = (data && data.length && data[0].hda) ? String(data[0].hda).trim() : "";
  } catch (_) {}

  /* ── calcular idade ── */
  const age = patient.dob
    ? Math.floor((Date.now() - new Date(patient.dob).getTime()) / (1000*60*60*24*365.25))
    : null;

  /* ── HTML do iframe ── */
  const htmlContent = `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="utf-8">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:14px;color:#111;background:#f8fafc;height:100vh;display:flex;flex-direction:column}
.wrap{flex:1;overflow-y:auto;padding:20px 24px;display:flex;flex-direction:column;gap:16px}
.footer{padding:14px 24px;border-top:1px solid #e5e7eb;background:#fff;flex-shrink:0}
.doente-bar{background:#e8f0fe;border-left:3px solid #1a56db;border-radius:0 6px 6px 0;padding:8px 14px;font-size:13px;display:flex;gap:20px;flex-wrap:wrap}
.doente-bar strong{color:#0f2d52}
.slabel{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#64748b;margin-bottom:7px}
.chips{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:2px}
.chip{padding:7px 15px;border-radius:999px;border:1.5px solid #cbd5e1;font-size:13px;cursor:pointer;background:#fff;color:#374151;user-select:none;transition:all .12s}
.chip.on-dark{background:#0f2d52;border-color:#0f2d52;color:#fff}
.chip.on-blue{background:#1a56db;border-color:#1a56db;color:#fff}
.hr{height:1px;background:#e5e7eb}
.checks{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.ck{display:flex;align-items:flex-start;gap:9px;padding:9px 11px;border-radius:7px;border:1.5px solid #e5e7eb;cursor:pointer;font-size:13px;line-height:1.4;background:#fff;user-select:none;transition:all .12s}
.ck.on{border-color:#1a56db;background:#eff6ff}
.ck-box{width:17px;height:17px;min-width:17px;border-radius:4px;border:1.5px solid #cbd5e1;background:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;margin-top:1px;transition:all .12s}
.ck.on .ck-box{background:#1a56db;border-color:#1a56db}
.justif{background:#fff;border-left:3px solid #94a3b8;border-radius:0 6px 6px 0;padding:10px 14px;font-size:12.5px;line-height:1.65;color:#1e3a8a}
textarea{width:100%;border:1.5px solid #e5e7eb;border-radius:7px;padding:9px 12px;font-size:13px;line-height:1.55;resize:vertical;color:#111;font-family:inherit;background:#fff}
textarea:focus{outline:none;border-color:#1a56db}
.copy-btn{background:none;border:1.5px solid #cbd5e1;border-radius:6px;padding:4px 11px;font-size:12px;color:#1a56db;cursor:pointer;margin-bottom:7px}
.copy-btn:hover{background:#eff6ff}
.btn-gen{width:100%;background:#1a56db;color:#fff;border:none;border-radius:8px;padding:12px;font-size:15px;font-weight:600;cursor:pointer;transition:opacity .15s}
.btn-gen:disabled{opacity:.5;cursor:not-allowed}
.btn-gen:hover:not(:disabled){opacity:.88}
</style>
</head>
<body>
<div class="wrap" id="wrap">

  <div class="doente-bar">
    <strong>${patient.full_name || "—"}</strong>
    ${patient.sns ? `<span>SNS ${patient.sns}</span>` : ""}
    ${age !== null ? `<span>${age} anos</span>` : ""}
  </div>

  <!-- PROCEDIMENTO -->
  <div>
    <div class="slabel">Procedimento</div>
    <div class="chips" id="chips-procedimento">
      <span class="chip on-dark" data-grupo="procedimento" data-val="prp">PRP</span>
      <span class="chip" data-grupo="procedimento" data-val="visco">Viscossuplementação</span>
    </div>
  </div>

  <div class="hr"></div>

  <!-- INDICAÇÃO -->
  <div>
    <div class="slabel">Indicação clínica</div>
    <div class="chips" id="chips-indicacao">
      <span class="chip on-blue" data-grupo="indicacao" data-val="osteoartrose">Osteoartrose</span>
      <span class="chip" data-grupo="indicacao" data-val="tendinopatia">Tendinopatia</span>
      <span class="chip" data-grupo="indicacao" data-val="rotura_tendao">Rotura parcial tendão</span>
      <span class="chip" data-grupo="indicacao" data-val="rotura_muscular">Rotura muscular</span>
    </div>
  </div>

  <!-- LOCALIZAÇÃO -->
  <div>
    <div class="slabel">Localização</div>
    <div class="chips" id="chips-localizacao"></div>
  </div>

  <!-- GRAU -->
  <div>
    <div class="slabel">Grau imagiológico</div>
    <div class="chips" id="chips-grau"></div>
  </div>

  <div class="hr"></div>

  <!-- TRATAMENTOS -->
  <div>
    <div class="slabel">Tratamentos conservadores já realizados</div>
    <div class="checks" id="checks-tratamentos"></div>
  </div>

  <!-- INFILTRAÇÕES -->
  <div>
    <div class="slabel">Nº de infiltrações previstas</div>
    <div class="chips" id="chips-infiltracoes">
      <span class="chip on-blue" data-grupo="infiltracoes" data-val="1">1</span>
      <span class="chip" data-grupo="infiltracoes" data-val="2">2</span>
      <span class="chip" data-grupo="infiltracoes" data-val="3">3</span>
    </div>
  </div>

  <div class="hr"></div>

  <!-- HDA -->
  <div>
    <div class="slabel">HDA / Exame objectivo</div>
    <button class="copy-btn" id="btnCopyHda">↓ Copiar da última consulta</button>
    <textarea id="taHda" rows="5" placeholder="Descreva a história clínica e achados relevantes para o pedido ao seguro…"></textarea>
  </div>

  <!-- OBSERVAÇÕES -->
  <div>
    <div class="slabel">Observações adicionais <span style="font-size:10px;color:#94a3b8;font-weight:400;text-transform:none">(opcional)</span></div>
    <textarea id="taObs" rows="3" placeholder="Notas adicionais para o seguro…"></textarea>
  </div>

  <div class="hr"></div>

  <!-- JUSTIFICAÇÃO -->
  <div>
    <div class="slabel">Justificação gerada automaticamente</div>
    <div class="justif" id="justif"></div>
  </div>

</div>
<div class="footer">
  <button class="btn-gen" id="btnGerar">Gerar PDF para seguro</button>
</div>

<script>
const OPTS = ${JSON.stringify(OPTS)};
const lastHda = ${JSON.stringify(lastHda)};

const state = {
  procedimento: "prp",
  indicacao:    "osteoartrose",
  localizacao:  "",
  grau:         "",
  tratamentos:  [],
  infiltracoes: "1",
  hda:          "",
  observacoes:  "",
};

function buildJustificacao() {
  const proc = state.procedimento === "prp" ? "PRP" : "ácido hialurónico";
  const tratsStr = state.tratamentos.length ? state.tratamentos.join(", ").toLowerCase() : "tratamento conservador";
  const loc  = state.localizacao ? " de " + state.localizacao.toLowerCase() : "";
  const grau = state.grau ? " (" + state.grau + ")" : "";
  const textos = {
    osteoartrose:    "Face à osteoartrose" + loc + grau + " com falha de " + tratsStr + " optimizado, propõe-se infiltração intra-articular com " + proc + " — terapêutica biológica autóloga com efeito condroprotector, anti-inflamatório e modulador articular (TGF-β, IGF-1, PDGF, FGF). LP-PRP demonstrou superioridade sobre ácido hialurónico e corticosteróides na dor e função a 6 e 12 meses em OA KL I–III.",
    tendinopatia:    "Face à tendinopatia" + loc + grau + " refratária a " + tratsStr + ", propõe-se infiltração com " + proc + " — terapêutica regenerativa com efeito angiogénico, anti-inflamatório e modulador da matriz tendinosa (TGF-β, PDGF, VEGF). A evidência suporta o uso de PRP em tendinopatias crónicas com falha de tratamento conservador optimizado.",
    rotura_tendao:   "Face à rotura parcial" + loc + grau + " sem indicação cirúrgica imediata e com falha de " + tratsStr + ", propõe-se infiltração com " + proc + " — terapêutica biológica com efeito regenerativo e modulador do processo cicatricial tendinoso (TGF-β, PDGF, IGF-1).",
    rotura_muscular: "Face à rotura muscular" + loc + grau + " com falha de " + tratsStr + ", propõe-se infiltração com " + proc + " — terapêutica regenerativa com efeito miogénico e anti-inflamatório (IGF-1, HGF, FGF). A evidência apoia o uso de PRP em roturas musculares de grau I–II para aceleração da recuperação.",
  };
  return textos[state.indicacao] || "";
}

function renderChips(id, lista, valorActivo, grupo, estilo) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = lista.map(v =>
    '<span class="chip ' + (v === valorActivo ? estilo : "") + '" data-grupo="' + grupo + '" data-val="' + v + '">' + v + '</span>'
  ).join("");
}

function renderChecks() {
  const el = document.getElementById("checks-tratamentos");
  if (!el) return;
  const lista = OPTS.tratamentos[state.indicacao] || [];
  el.innerHTML = lista.map(v => {
    const on = state.tratamentos.includes(v);
    return '<div class="ck ' + (on ? "on" : "") + '" data-trat="' + v + '"><div class="ck-box">' + (on ? "✓" : "") + '</div><span>' + v + '</span></div>';
  }).join("");
}

function updateJustif() {
  const el = document.getElementById("justif");
  if (el) el.textContent = buildJustificacao();
}

function fullRender() {
  renderChips("chips-localizacao", OPTS.localizacao[state.indicacao] || [], state.localizacao, "localizacao", "on-blue");
  renderChips("chips-grau", OPTS.grau[state.indicacao] || [], state.grau, "grau", "on-blue");
  renderChecks();
  updateJustif();
}

/* ── eventos ── */
document.body.addEventListener("click", e => {
  /* chip */
  const chip = e.target.closest(".chip[data-grupo]");
  if (chip) {
    const grupo = chip.dataset.grupo;
    const val   = chip.dataset.val;
    /* limpar activo no grupo */
    document.querySelectorAll(".chip[data-grupo='" + grupo + "']").forEach(c => {
      c.classList.remove("on-dark", "on-blue");
    });
    const estilo = (grupo === "procedimento") ? "on-dark" : "on-blue";
    chip.classList.add(estilo);
    if (grupo === "indicacao") {
      state.indicacao   = val;
      state.localizacao = "";
      state.grau        = "";
      state.tratamentos = [];
      fullRender();
    } else {
      state[grupo] = val;
      updateJustif();
    }
    return;
  }

  /* checkbox */
  const ck = e.target.closest(".ck[data-trat]");
  if (ck) {
    const v = ck.dataset.trat;
    const idx = state.tratamentos.indexOf(v);
    if (idx >= 0) state.tratamentos.splice(idx, 1);
    else state.tratamentos.push(v);
    ck.classList.toggle("on");
    ck.querySelector(".ck-box").textContent = state.tratamentos.includes(v) ? "✓" : "";
    updateJustif();
    return;
  }
});

/* copiar HDA */
document.getElementById("btnCopyHda")?.addEventListener("click", () => {
  const ta = document.getElementById("taHda");
  if (lastHda && ta) {
    ta.value = lastHda;
    state.hda = lastHda;
  }
});

/* textareas */
document.getElementById("taHda")?.addEventListener("input", e => { state.hda = e.target.value; updateJustif(); });
document.getElementById("taObs")?.addEventListener("input", e => { state.observacoes = e.target.value; });

/* gerar PDF */
document.getElementById("btnGerar")?.addEventListener("click", () => {
  const btn = document.getElementById("btnGerar");
  btn.disabled = true;
  btn.textContent = "A gerar…";
  window.parent.__gc_prpViscoGerar(JSON.parse(JSON.stringify(state)), buildJustificacao())
    .finally(() => { btn.disabled = false; btn.textContent = "Gerar PDF para seguro"; });
});

/* render inicial */
fullRender();
</script>
</body>
</html>`;

  /* ── função de geração PDF exposta ao iframe ── */
  window.__gc_prpViscoGerar = async (state, justificacao) => {
    const renderProxy = window.__gc_renderPdfViaProxy;
    const uploadPdf   = window.__gc_uploadPdfToStorage;
    const insertDoc   = window.__gc_insertDocumentRow;
    if (!renderProxy || !uploadPdf || !insertDoc) {
      alert("Funções de PDF não disponíveis. Refresca a página.");
      return;
    }

    const shell = await buildReportShell({ patient, clinic });
    const { sharedStyles, header, patientBlock, footer } = shell;
    const proc     = state.procedimento === "prp" ? "PRP" : "Ácido Hialurónico";
    const indLabel = { osteoartrose:"Osteoartrose", tendinopatia:"Tendinopatia", rotura_tendao:"Rotura Parcial de Tendão", rotura_muscular:"Rotura Muscular" }[state.indicacao] || "";
    const trats    = state.tratamentos || [];

    const htmlPdf = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
${sharedStyles}
.sl{font-size:9px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#1a56db;margin:14px 0 4px 0}
.sv{font-size:13px;color:#111;margin-bottom:2px}
.trats{display:flex;flex-wrap:wrap;gap:6px 18px;margin-top:3px}
.trat{display:flex;align-items:center;gap:5px;font-size:12px;color:#333}
.tcb{width:10px;height:10px;border:1px solid #1a56db;border-radius:2px;background:#e8f0fe;display:flex;align-items:center;justify-content:center;font-size:8px;color:#1a56db;font-weight:700;flex-shrink:0}
.justif{font-size:12px;line-height:1.65;color:#222;border-left:2px solid #94a3b8;padding:8px 12px;background:#f8f9fa;border-radius:0 4px 4px 0;margin-top:4px}
.conclusao{font-size:12.5px;line-height:1.65;color:#111;border:1px solid #0f2d52;border-radius:4px;padding:10px 14px;margin-top:4px}
.hda{background:#fafafa;border:0.5px solid #ddd;border-radius:4px;padding:8px 12px;font-size:12.5px;line-height:1.6;color:#222;white-space:pre-wrap}
</style></head><body><div class="a4">
${header}
<div class="title">Pedido de Comparticipação — ${proc}</div>
${patientBlock}
<div class="sl">Procedimento</div><div class="sv">${proc}</div>
<div class="sl">Indicação clínica</div>
<div class="sv">${indLabel}${state.localizacao ? " — " + state.localizacao : ""}${state.grau ? " (" + state.grau + ")" : ""}</div>
${state.hda ? `<div class="sl">HDA / Exame objectivo</div><div class="hda">${state.hda.replace(/</g,"&lt;").replace(/>/g,"&gt;")}</div>` : ""}
<div class="sl">Tratamentos conservadores realizados</div>
<div class="trats">${trats.length ? trats.map(t => `<div class="trat"><div class="tcb">✓</div>${t}</div>`).join("") : "<div>Não especificado</div>"}</div>
<div class="sl">Nº de infiltrações previstas</div><div class="sv">${state.infiltracoes}</div>
<div class="sl">Justificação terapêutica</div><div class="justif">${justificacao}</div>
<div class="sl">Conclusão / Pedido de autorização</div>
<div class="conclusao">Solicita-se autorização para realização de <b>${state.infiltracoes}</b> infiltração(ões) com <b>${proc}</b>${state.localizacao ? " em <b>" + state.localizacao.toLowerCase() + "</b>" : ""}, no contexto de <b>${indLabel.toLowerCase()}</b>${state.grau ? " grau <b>" + state.grau + "</b>" : ""}, refratária a tratamento conservador optimizado.${state.observacoes ? "<br><br>" + state.observacoes.replace(/</g,"&lt;").replace(/>/g,"&gt;") : ""}</div>
${footer}
</div></body></html>`;

    let blob;
    try { blob = await renderProxy(htmlPdf); }
    catch (e) { alert("Falha ao gerar PDF.\n" + String(e?.message || e)); return; }
    if (!blob || blob.size < 5000) { alert("PDF inválido."); return; }

    const ymd    = new Date().toISOString().slice(0,10);
    const hms    = new Date().toISOString().slice(11,19).replaceAll(":","-");
    const path   = `clinic_${clinic?.id || "x"}/patient_${patient.id}/prp_visco_${ymd}_${hms}.pdf`;
    const up     = await uploadPdf({ blob, path });
    if (!up.ok) { alert("Falhou o upload.\n" + String(up.error?.message || up.error || "")); return; }

    const title  = `PRP-Visco_${indLabel}_${(state.localizacao||"").replace(/\s/g,"_")}_${ymd}`.replace(/[^a-zA-Z0-9_\-]/g,"");
    const ins    = await insertDoc({ clinic_id: clinic?.id, patient_id: patient.id, consultation_id: null, title, html: "", version: 1, storage_path: path, category: "PRP" });
    if (!ins.ok) { alert("PDF guardado mas falhou o registo.\n" + String(ins.error?.message || ins.error || "")); return; }

    alert("PDF criado e guardado com sucesso.");
    closePrpViscoPanel();
    if (typeof onClose === "function") onClose();
  };

  /* ── montar modal ── */
  const blob    = new Blob([htmlContent], { type: "text/html" });
  const blobUrl = URL.createObjectURL(blob);

  const overlay = document.createElement("div");
  overlay.id = "gcPrpViscoModal";
  Object.assign(overlay.style, {
    position: "fixed", inset: "0", background: "rgba(0,0,0,0.55)",
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    padding: "12px", zIndex: "3100",
    fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif"
  });

  const bar = document.createElement("div");
  Object.assign(bar.style, {
    width: "min(680px,100%)", background: "#fff",
    borderRadius: "12px 12px 0 0", borderBottom: "1px solid #e2e8f0",
    padding: "12px 18px", display: "flex",
    justifyContent: "space-between", alignItems: "center", flexShrink: "0"
  });
  bar.innerHTML = `<div style="font-weight:700;font-size:15px;color:#0f2d52;">💉 PRP / Viscossuplementação — Pedido ao Seguro</div>
    <button id="gcPrpViscoClose" style="background:none;border:1px solid #e2e8f0;border-radius:6px;padding:5px 12px;cursor:pointer;font-size:13px;color:#64748b;">✕ Fechar</button>`;

  const frame = document.createElement("iframe");
  frame.src = blobUrl;
  Object.assign(frame.style, {
    width: "min(680px,100%)",
    height: "calc(88vh - 52px)",
    border: "none", background: "#fff",
    borderRadius: "0 0 12px 12px", flexShrink: "0"
  });

  function closeModal() {
    URL.revokeObjectURL(blobUrl);
    overlay.remove();
    delete window.__gc_prpViscoGerar;
  }

  overlay.appendChild(bar);
  overlay.appendChild(frame);
  document.body.appendChild(overlay);

  document.getElementById("gcPrpViscoClose")?.addEventListener("click", closeModal);
  overlay.addEventListener("click", e => { if (e.target === overlay) closeModal(); });
}
