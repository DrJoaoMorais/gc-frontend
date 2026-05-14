/**
 * prp-visco.js — Relatório PRP / Viscossuplementação
 * Fluxo dois passos: formulário → editor Quill → guardar PDF
 * Padrão iframe+Blob isolado (igual ao Neurológico).
 */

import { buildReportShell } from "./_shared/report-shell.js";

export function closePrpViscoPanel() {
  document.getElementById("gcPrpViscoModal")?.remove();
}

export async function openPrpViscoPanel({ patient, clinic, consultationId, onClose }) {
  closePrpViscoPanel();

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

  /* HDA da última consulta */
  let lastHda = "";
  try {
    const { data } = await window.sb
      .from("consultations")
      .select("hda")
      .eq("patient_id", patient.id)
      .order("created_at", { ascending: false })
      .limit(1);
    if (data && data.length && data[0].hda) {
      /* strip HTML tags para texto simples */
      const tmp = document.createElement("div");
      tmp.innerHTML = data[0].hda;
      lastHda = tmp.innerText || tmp.textContent || "";
    }
  } catch (_) {}

  const age = patient.dob
    ? Math.floor((Date.now() - new Date(patient.dob).getTime()) / (1000*60*60*24*365.25))
    : null;

  /* ── PASSO 1: formulário ── */
  const htmlFormulario = `<!DOCTYPE html>
<html lang="pt"><head><meta charset="utf-8">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:14px;color:#111;background:#f8fafc;height:100vh;display:flex;flex-direction:column}
.wrap{flex:1;overflow-y:auto;padding:20px 24px;display:flex;flex-direction:column;gap:16px}
.footer{padding:14px 24px;border-top:1px solid #e5e7eb;background:#fff;flex-shrink:0}
.doente-bar{background:#e8f0fe;border-left:3px solid #1a56db;border-radius:0 6px 6px 0;padding:8px 14px;font-size:13px;display:flex;gap:20px;flex-wrap:wrap}
.doente-bar strong{color:#0f2d52}
.slabel{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#64748b;margin-bottom:7px}
.chips{display:flex;flex-wrap:wrap;gap:7px}
.chip{padding:7px 15px;border-radius:999px;border:1.5px solid #cbd5e1;font-size:13px;cursor:pointer;background:#fff;color:#374151;user-select:none;transition:all .12s}
.chip.on-dark{background:#0f2d52;border-color:#0f2d52;color:#fff}
.chip.on-blue{background:#1a56db;border-color:#1a56db;color:#fff}
.hr{height:1px;background:#e5e7eb}
.checks{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.ck{display:flex;align-items:flex-start;gap:9px;padding:9px 11px;border-radius:7px;border:1.5px solid #e5e7eb;cursor:pointer;font-size:13px;line-height:1.4;background:#fff;user-select:none}
.ck.on{border-color:#1a56db;background:#eff6ff}
.ck-box{width:17px;height:17px;min-width:17px;border-radius:4px;border:1.5px solid #cbd5e1;background:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;margin-top:1px}
.ck.on .ck-box{background:#1a56db;border-color:#1a56db}
textarea{width:100%;border:1.5px solid #e5e7eb;border-radius:7px;padding:9px 12px;font-size:13px;line-height:1.55;resize:vertical;color:#111;font-family:inherit;background:#fff}
textarea:focus{outline:none;border-color:#1a56db}
.copy-btn{background:none;border:1.5px solid #cbd5e1;border-radius:6px;padding:4px 11px;font-size:12px;color:#1a56db;cursor:pointer;margin-bottom:7px}
.btn-gen{width:100%;background:#1a56db;color:#fff;border:none;border-radius:8px;padding:12px;font-size:15px;font-weight:600;cursor:pointer}
.btn-gen:hover{opacity:.88}
</style></head><body>
<div class="wrap">
  <div class="doente-bar">
    <strong>${patient.full_name || "—"}</strong>
    ${patient.sns ? `<span>SNS ${patient.sns}</span>` : ""}
    ${age !== null ? `<span>${age} anos</span>` : ""}
  </div>

  <div>
    <div class="slabel">Procedimento</div>
    <div class="chips" id="chips-procedimento">
      <span class="chip on-dark" data-grupo="procedimento" data-val="prp">PRP</span>
      <span class="chip" data-grupo="procedimento" data-val="visco">Viscossuplementação</span>
    </div>
  </div>
  <div class="hr"></div>
  <div>
    <div class="slabel">Indicação clínica</div>
    <div class="chips" id="chips-indicacao">
      <span class="chip on-blue" data-grupo="indicacao" data-val="osteoartrose">Osteoartrose</span>
      <span class="chip" data-grupo="indicacao" data-val="tendinopatia">Tendinopatia</span>
      <span class="chip" data-grupo="indicacao" data-val="rotura_tendao">Rotura parcial tendão</span>
      <span class="chip" data-grupo="indicacao" data-val="rotura_muscular">Rotura muscular</span>
    </div>
  </div>
  <div>
    <div class="slabel">Localização</div>
    <div class="chips" id="chips-localizacao"></div>
  </div>
  <div>
    <div class="slabel">Grau imagiológico</div>
    <div class="chips" id="chips-grau"></div>
  </div>
  <div class="hr"></div>
  <div>
    <div class="slabel">Tratamentos conservadores já realizados</div>
    <div class="checks" id="checks-tratamentos"></div>
  </div>
  <div>
    <div class="slabel">Nº de infiltrações previstas</div>
    <div class="chips">
      <span class="chip on-blue" data-grupo="infiltracoes" data-val="1">1</span>
      <span class="chip" data-grupo="infiltracoes" data-val="2">2</span>
      <span class="chip" data-grupo="infiltracoes" data-val="3">3</span>
    </div>
  </div>
  <div class="hr"></div>
  <div>
    <div class="slabel">HDA / Exame objectivo</div>
    <button class="copy-btn" id="btnCopyHda">↓ Copiar da última consulta</button>
    <textarea id="taHda" rows="5" placeholder="Descreva a história clínica e achados relevantes para o pedido ao seguro…"></textarea>
  </div>
  <div>
    <div class="slabel">Observações adicionais <span style="font-size:10px;color:#94a3b8;font-weight:400;text-transform:none">(opcional)</span></div>
    <textarea id="taObs" rows="3" placeholder="Notas adicionais para o seguro…"></textarea>
  </div>
</div>
<div class="footer">
  <button class="btn-gen" id="btnPreview">Pré-visualizar e editar →</button>
</div>
<script>
const OPTS = ${JSON.stringify(OPTS)};
const lastHda = ${JSON.stringify(lastHda)};
const state = {
  procedimento:"prp", indicacao:"osteoartrose",
  localizacao:"", grau:"", tratamentos:[], infiltracoes:"1", hda:"", observacoes:""
};
function buildJustificacao() {
  const proc = state.procedimento==="prp"?"PRP":"ácido hialurónico";
  const tr = state.tratamentos.length ? state.tratamentos.join(", ").toLowerCase() : "tratamento conservador";
  const loc = state.localizacao?" de "+state.localizacao.toLowerCase():"";
  const gr  = state.grau?" ("+state.grau+")":"";
  const t = {
    osteoartrose:"Face à osteoartrose"+loc+gr+" com falha de "+tr+" optimizado, propõe-se infiltração intra-articular com "+proc+" — terapêutica biológica autóloga com efeito condroprotector, anti-inflamatório e modulador articular (TGF-β, IGF-1, PDGF, FGF). LP-PRP demonstrou superioridade sobre ácido hialurónico e corticosteróides na dor e função a 6 e 12 meses em OA KL I–III.",
    tendinopatia:"Face à tendinopatia"+loc+gr+" refratária a "+tr+", propõe-se infiltração com "+proc+" — terapêutica regenerativa com efeito angiogénico, anti-inflamatório e modulador da matriz tendinosa (TGF-β, PDGF, VEGF). A evidência suporta o uso de PRP em tendinopatias crónicas com falha de tratamento conservador optimizado.",
    rotura_tendao:"Face à rotura parcial"+loc+gr+" sem indicação cirúrgica imediata e com falha de "+tr+", propõe-se infiltração com "+proc+" — terapêutica biológica com efeito regenerativo e modulador do processo cicatricial tendinoso (TGF-β, PDGF, IGF-1).",
    rotura_muscular:"Face à rotura muscular"+loc+gr+" com falha de "+tr+", propõe-se infiltração com "+proc+" — terapêutica regenerativa com efeito miogénico e anti-inflamatório (IGF-1, HGF, FGF). A evidência apoia o uso de PRP em roturas musculares de grau I–II para aceleração da recuperação.",
  };
  return t[state.indicacao]||"";
}
function esc(s){ return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function renderDynamic() {
  const ind = state.indicacao;
  document.getElementById("chips-localizacao").innerHTML = (OPTS.localizacao[ind]||[]).map(v=>
    '<span class="chip '+(v===state.localizacao?"on-blue":"")+'" data-grupo="localizacao" data-val="'+v+'">'+v+'</span>'
  ).join("");
  document.getElementById("chips-grau").innerHTML = (OPTS.grau[ind]||[]).map(v=>
    '<span class="chip '+(v===state.grau?"on-blue":"")+'" data-grupo="grau" data-val="'+v+'">'+v+'</span>'
  ).join("");
  document.getElementById("checks-tratamentos").innerHTML = (OPTS.tratamentos[ind]||[]).map(v=>{
    const on=state.tratamentos.includes(v);
    return '<div class="ck '+(on?"on":"")+'" data-trat="'+v+'"><div class="ck-box">'+(on?"✓":"")+'</div><span>'+v+'</span></div>';
  }).join("");
}
document.body.addEventListener("click", e => {
  const chip = e.target.closest(".chip[data-grupo]");
  if (chip) {
    const g=chip.dataset.grupo, v=chip.dataset.val;
    document.querySelectorAll(".chip[data-grupo='"+g+"']").forEach(c=>c.classList.remove("on-dark","on-blue"));
    chip.classList.add(g==="procedimento"?"on-dark":"on-blue");
    if (g==="indicacao"){state.indicacao=v;state.localizacao="";state.grau="";state.tratamentos=[];renderDynamic();}
    else { state[g]=v; }
    return;
  }
  const ck = e.target.closest(".ck[data-trat]");
  if (ck) {
    const v=ck.dataset.trat, idx=state.tratamentos.indexOf(v);
    if(idx>=0)state.tratamentos.splice(idx,1); else state.tratamentos.push(v);
    ck.classList.toggle("on");
    ck.querySelector(".ck-box").textContent=state.tratamentos.includes(v)?"✓":"";
    return;
  }
});
function stripHtml(s){const d=document.createElement("div");d.innerHTML=s;return d.innerText||d.textContent||"";}
document.getElementById("btnCopyHda").addEventListener("click",()=>{
  if(lastHda){const txt=stripHtml(lastHda);document.getElementById("taHda").value=txt;state.hda=txt;}
});
document.getElementById("taHda").addEventListener("input",e=>{state.hda=e.target.value;});
document.getElementById("taObs").addEventListener("input",e=>{state.observacoes=e.target.value;});
document.getElementById("btnPreview").addEventListener("click",()=>{
  state.hda = document.getElementById("taHda").value;
  state.observacoes = document.getElementById("taObs").value;
  window.parent.__gc_prpViscoPreview(JSON.parse(JSON.stringify(state)), buildJustificacao());
});
renderDynamic();
</script>
</body></html>`;

  /* ── função de pré-visualização/edição exposta ao iframe ── */
  window.__gc_prpViscoPreview = async (state, justificacao) => {
    const shell = await buildReportShell({ patient, clinic });
    const { sharedStyles, header, patientBlock, footer } = shell;
    const proc     = state.procedimento==="prp" ? "PRP" : "Ácido Hialurónico";
    const indLabel = indLabels[state.indicacao] || "";
    const trats    = state.tratamentos || [];

    /* escapar texto simples */
    function esc(s){ return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

    const htmlEditavel = `<!DOCTYPE html>
<html lang="pt"><head><meta charset="utf-8">
<link href="https://cdn.quilljs.com/1.3.7/quill.snow.css" rel="stylesheet">
<script src="https://cdn.quilljs.com/1.3.7/quill.min.js"><\/script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:14px;color:#111;background:#f1f5f9;height:100vh;display:flex;flex-direction:column}
.topbar{padding:10px 18px;background:#fff;border-bottom:1px solid #e5e7eb;display:flex;gap:10px;align-items:center;flex-shrink:0}
.topbar span{font-size:13px;color:#64748b;flex:1}
.btn{padding:8px 18px;border-radius:7px;border:none;font-size:13px;font-weight:600;cursor:pointer}
.btn-sec{background:#f1f5f9;color:#374151;border:1.5px solid #e5e7eb}
.btn-pri{background:#1a56db;color:#fff}
.btn:hover{opacity:.88}
.editor-wrap{flex:1;overflow-y:auto;padding:20px;display:flex;justify-content:center}
.page{width:210mm;background:#fff;padding:16mm;box-shadow:0 2px 16px rgba(0,0,0,.1);min-height:297mm}
.ql-container{border:none!important;font-family:inherit;font-size:14px}
.ql-toolbar{border:none!important;border-bottom:1.5px solid #e5e7eb!important;background:#fafafa;position:sticky;top:0;z-index:10}
</style>
</head><body>
<div class="topbar">
  <span>Edite o documento antes de guardar</span>
  <button class="btn btn-sec" id="btnVoltar">← Voltar</button>
  <button class="btn btn-pri" id="btnGuardar">Guardar e gerar PDF</button>
</div>
<div class="editor-wrap">
  <div class="page">
    <div id="editor"></div>
  </div>
</div>
<script>
const quill = new Quill("#editor", {
  theme: "snow",
  modules: { toolbar: [
    ["bold","italic","underline"],
    [{header:[1,2,3,false]}],
    [{list:"ordered"},{list:"bullet"}],
    ["clean"]
  ]}
});

const conteudoInicial = \`${header.replace(/`/g,"\\`")}
<h2 style="text-align:center;font-weight:900;font-size:20px;margin:2px 0 12px 0;">Pedido de Comparticipação — ${proc}</h2>
${patientBlock.replace(/`/g,"\\`")}
<p><strong>PROCEDIMENTO</strong><br>${proc}</p>
<p><strong>INDICAÇÃO CLÍNICA</strong><br>${esc(indLabel)}${state.localizacao?" — "+esc(state.localizacao):""}${state.grau?" ("+esc(state.grau)+")":""}</p>
${state.hda ? `<p><strong>HDA / EXAME OBJECTIVO</strong><br>${esc(state.hda).replace(/\n/g,"<br>")}</p>` : ""}
<p><strong>TRATAMENTOS CONSERVADORES REALIZADOS</strong><br>${trats.map(t=>"✓ "+esc(t)).join(" &nbsp; ")}</p>
<p><strong>Nº DE INFILTRAÇÕES PREVISTAS</strong><br>${esc(state.infiltracoes)}</p>
<p><strong>JUSTIFICAÇÃO TERAPÊUTICA</strong><br>${esc(justificacao)}</p>
<p><strong>CONCLUSÃO / PEDIDO DE AUTORIZAÇÃO</strong><br>
Solicita-se autorização para realização de <strong>${esc(state.infiltracoes)}</strong> infiltração(ões) com <strong>${proc}</strong>${state.localizacao?" em <strong>"+esc(state.localizacao.toLowerCase())+"</strong>":""}, no contexto de <strong>${esc(indLabel.toLowerCase())}</strong>${state.grau?" grau <strong>"+esc(state.grau)+"</strong>":""}, refratária a tratamento conservador optimizado.${state.observacoes?"<br><br>"+esc(state.observacoes):""}</p>
${footer.replace(/`/g,"\\`")}\`;

quill.clipboard.dangerouslyPasteHTML(conteudoInicial);

document.getElementById("btnVoltar").addEventListener("click",()=>{
  window.parent.__gc_prpViscoBack();
});
document.getElementById("btnGuardar").addEventListener("click",()=>{
  const html = quill.root.innerHTML;
  const btn = document.getElementById("btnGuardar");
  btn.disabled=true; btn.textContent="A guardar…";
  window.parent.__gc_prpViscoGuardar(html)
    .finally(()=>{ btn.disabled=false; btn.textContent="Guardar e gerar PDF"; });
});
<\/script>
</body></html>`;

    /* trocar iframe para o editor */
    const blobEd  = new Blob([htmlEditavel], { type:"text/html" });
    const urlEd   = URL.createObjectURL(blobEd);
    const frame   = document.querySelector("#gcPrpViscoModal iframe");
    const barTitle = document.querySelector("#gcPrpViscoModal #prpBarTitle");
    if (barTitle) barTitle.textContent = "💉 PRP / Visco — Editar documento";
    if (frame) {
      URL.revokeObjectURL(frame.src);
      frame.src = urlEd;
    }
  };

  /* ── voltar ao formulário ── */
  window.__gc_prpViscoBack = () => {
    const frame = document.querySelector("#gcPrpViscoModal iframe");
    if (frame) {
      URL.revokeObjectURL(frame.src);
      const blob2 = new Blob([htmlFormulario], { type:"text/html" });
      frame.src = URL.createObjectURL(blob2);
      const barTitle = document.querySelector("#gcPrpViscoModal #prpBarTitle");
      if (barTitle) barTitle.textContent = "💉 PRP / Viscossuplementação — Pedido ao Seguro";
    }
  };

  /* ── guardar PDF ── */
  window.__gc_prpViscoGuardar = async (htmlEditado) => {
    const renderProxy = window.__gc_renderPdfViaProxy;
    const uploadPdf   = window.__gc_uploadPdfToStorage;
    const insertDoc   = window.__gc_insertDocumentRow;
    if (!renderProxy || !uploadPdf || !insertDoc) {
      alert("Funções de PDF não disponíveis. Refresca a página.");
      return;
    }

    const shell = await buildReportShell({ patient, clinic });
    const { sharedStyles } = shell;

    const htmlPdf = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>${sharedStyles}
.ql-editor{padding:0}
</style></head><body><div class="a4">${htmlEditado}</div></body></html>`;

    let blob;
    try { blob = await renderProxy(htmlPdf); }
    catch(e) { alert("Falha ao gerar PDF.\n"+String(e?.message||e)); return; }
    if (!blob||blob.size<5000) { alert("PDF inválido."); return; }

    const ymd  = new Date().toISOString().slice(0,10);
    const hms  = new Date().toISOString().slice(11,19).replaceAll(":","-");
    const path = `clinic_${clinic?.id||"x"}/patient_${patient.id}/prp_visco_${ymd}_${hms}.pdf`;
    const up   = await uploadPdf({ blob, path });
    if (!up.ok) { alert("Falhou o upload.\n"+String(up.error?.message||up.error||"")); return; }

    const ins  = await insertDoc({
      clinic_id:       clinic?.id,
      patient_id:      patient.id,
      consultation_id: consultationId || null,
      title:           `PRP-Visco_${ymd}`,
      html:            "",
      version:         1,
      storage_path:    path,
      category:        "PRP"
    });
    if (!ins.ok) { alert("PDF guardado mas falhou o registo.\n"+String(ins.error?.message||ins.error||"")); return; }

    alert("PDF guardado com sucesso.");
    closePrpViscoPanel();
    if (typeof onClose === "function") onClose();
  };

  /* ── montar modal ── */
  const blob0   = new Blob([htmlFormulario], { type:"text/html" });
  const blobUrl = URL.createObjectURL(blob0);

  const overlay = document.createElement("div");
  overlay.id = "gcPrpViscoModal";
  Object.assign(overlay.style, {
    position:"fixed", inset:"0", background:"rgba(0,0,0,0.55)",
    display:"flex", flexDirection:"column",
    alignItems:"center", justifyContent:"center",
    padding:"12px", zIndex:"3100"
  });

  const bar = document.createElement("div");
  Object.assign(bar.style, {
    width:"min(780px,100%)", background:"#fff",
    borderRadius:"12px 12px 0 0", borderBottom:"1px solid #e2e8f0",
    padding:"12px 18px", display:"flex",
    justifyContent:"space-between", alignItems:"center", flexShrink:"0"
  });
  bar.innerHTML = `<div id="prpBarTitle" style="font-weight:700;font-size:15px;color:#0f2d52;">💉 PRP / Viscossuplementação — Pedido ao Seguro</div>
    <button id="gcPrpViscoClose" style="background:none;border:1px solid #e2e8f0;border-radius:6px;padding:5px 12px;cursor:pointer;font-size:13px;color:#64748b;">✕ Fechar</button>`;

  const frame = document.createElement("iframe");
  frame.src = blobUrl;
  Object.assign(frame.style, {
    width:"min(780px,100%)",
    height:"calc(88vh - 52px)",
    border:"none", background:"#fff",
    borderRadius:"0 0 12px 12px", flexShrink:"0"
  });

  function closeModal() {
    URL.revokeObjectURL(blobUrl);
    overlay.remove();
    delete window.__gc_prpViscoPreview;
    delete window.__gc_prpViscoBack;
    delete window.__gc_prpViscoGuardar;
  }

  overlay.appendChild(bar);
  overlay.appendChild(frame);
  document.body.appendChild(overlay);

  document.getElementById("gcPrpViscoClose")?.addEventListener("click", closeModal);
  overlay.addEventListener("click", e => { if(e.target===overlay) closeModal(); });
}
