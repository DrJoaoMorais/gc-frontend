/**
 * prp-visco.js — Painel lateral de relatório PRP / Viscossuplementação
 * para pedido de comparticipação a seguro.
 *
 * Independente de consulta — abre a partir da sidebar do doente.
 * Usa buildReportShell (report-shell.js) para cabeçalho/rodapé PDF.
 */

import { buildReportShell } from "./_shared/report-shell.js";

const PANEL_ID = "gcPrpViscoPanel";

export function closePrpViscoPanel() {
  const el = document.getElementById(PANEL_ID);
  if (el) el.remove();
}

export async function openPrpViscoPanel({ patient, clinic, onClose }) {
  const existing = document.getElementById(PANEL_ID);
  if (existing) { existing.remove(); }

  /* ── contentor host (mesmo padrão dos outros painéis) ── */
  const closeBtn = document.getElementById("btnClosePView");
  if (!closeBtn) return;
  const container = closeBtn.closest(".gc-pv-wrap") || closeBtn.parentElement;
  if (!container) return;

  /* ── buscar HDA da última consulta ── */
  async function fetchLastHda() {
    try {
      const { data } = await window.sb
        .from("consultations")
        .select("hda")
        .eq("patient_id", patient.id)
        .order("created_at", { ascending: false })
        .limit(1);
      return (data && data.length && data[0].hda) ? String(data[0].hda).trim() : "";
    } catch { return ""; }
  }

  /* ── estado do formulário ── */
  const state = {
    procedimento: "prp",          // "prp" | "visco"
    indicacao:    "osteoartrose",  // "osteoartrose" | "tendinopatia" | "rotura_tendao" | "rotura_muscular"
    localizacao:  "",
    grau:         "",
    tratamentos:  new Set(),
    infiltracoes: "1",
    hda:          "",
    observacoes:  "",
  };

  /* ── opções por indicação ── */
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

  /* ── justificação automática ── */
  function buildJustificacao() {
    const proc = state.procedimento === "prp" ? "PRP" : "ácido hialurónico";
    const trats = [...state.tratamentos];
    const tratsStr = trats.length
      ? trats.join(", ").toLowerCase()
      : "tratamento conservador";
    const loc = state.localizacao ? ` de ${state.localizacao.toLowerCase()}` : "";
    const grau = state.grau ? ` (${state.grau})` : "";

    const textos = {
      osteoartrose: `Face à osteoartrose${loc}${grau} com falha de ${tratsStr} optimizado, propõe-se infiltração intra-articular com ${proc} — terapêutica biológica autóloga com efeito condroprotector, anti-inflamatório e modulador articular (TGF-β, IGF-1, PDGF, FGF). LP-PRP demonstrou superioridade sobre ácido hialurónico e corticosteróides na dor e função a 6 e 12 meses em OA KL I–III.`,
      tendinopatia: `Face à tendinopatia${loc}${grau} refratária a ${tratsStr}, propõe-se infiltração com ${proc} — terapêutica regenerativa com efeito angiogénico, anti-inflamatório e modulador da matriz tendinosa (TGF-β, PDGF, VEGF). A evidência suporta o uso de PRP em tendinopatias crónicas com falha de tratamento conservador optimizado.`,
      rotura_tendao: `Face à rotura parcial${loc}${grau} sem indicação cirúrgica imediata e com falha de ${tratsStr}, propõe-se infiltração com ${proc} — terapêutica biológica com efeito regenerativo e modulador do processo cicatricial tendinoso (TGF-β, PDGF, IGF-1). O PRP demonstrou benefício na cicatrização e recuperação funcional em roturas parciais de tendão.`,
      rotura_muscular: `Face à rotura muscular${loc}${grau} com falha de ${tratsStr}, propõe-se infiltração com ${proc} — terapêutica regenerativa com efeito miogénico e anti-inflamatório (IGF-1, HGF, FGF). A evidência apoia o uso de PRP em roturas musculares de grau I–II para aceleração da recuperação e retorno à actividade.`,
    };
    return textos[state.indicacao] || "";
  }

  /* ── render do painel ── */
  function chipsHtml(lista, valorActivo, campo) {
    return lista.map(v =>
      `<span class="prpv-chip ${v === valorActivo ? "prpv-chip--on" : ""}" data-campo="${campo}" data-val="${v}">${v}</span>`
    ).join("");
  }

  function checkHtml(lista) {
    return lista.map(v => {
      const on = state.tratamentos.has(v);
      return `<label class="prpv-check ${on ? "prpv-check--on" : ""}">
        <span class="prpv-cb">${on ? "✓" : ""}</span>
        <span>${v}</span>
        <input type="checkbox" data-trat="${v}" ${on ? "checked" : ""} style="display:none">
      </label>`;
    }).join("");
  }

  function render() {
    const opts = OPTS;
    const ind = state.indicacao;

    panel.innerHTML = `
<style>
#${PANEL_ID}{position:fixed;top:0;right:0;width:440px;height:100vh;background:#fff;border-left:1px solid #e5e7eb;box-shadow:-8px 0 24px rgba(0,0,0,.08);z-index:9999;display:flex;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:14px;color:#111;}
.prpv-header{padding:14px 18px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
.prpv-title{font-size:15px;font-weight:700;color:#0f2d52}
.prpv-close{background:none;border:1px solid #e5e7eb;border-radius:6px;width:30px;height:30px;cursor:pointer;font-size:17px;color:#64748b;display:flex;align-items:center;justify-content:center;}
.prpv-body{padding:16px 18px;overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:16px}
.prpv-doente{background:#f0f4fb;border-left:3px solid #1a56db;border-radius:0 6px 6px 0;padding:8px 12px;font-size:12.5px;display:flex;gap:16px;flex-wrap:wrap}
.prpv-doente strong{color:#0f2d52}
.prpv-slabel{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#64748b;margin-bottom:6px}
.prpv-chips{display:flex;flex-wrap:wrap;gap:7px}
.prpv-chip{padding:6px 13px;border-radius:999px;border:1px solid #cbd5e1;font-size:13px;cursor:pointer;background:#fff;color:#374151;user-select:none}
.prpv-chip--on{background:#0f2d52;border-color:#0f2d52;color:#fff}
.prpv-chip--blue.prpv-chip--on{background:#1a56db;border-color:#1a56db;color:#fff}
.prpv-hr{height:1px;background:#f1f5f9;margin:2px 0}
.prpv-checks{display:grid;grid-template-columns:1fr 1fr;gap:7px}
.prpv-check{display:flex;align-items:flex-start;gap:8px;padding:8px 10px;border-radius:7px;border:1px solid #e5e7eb;cursor:pointer;font-size:12.5px;line-height:1.4;user-select:none;background:#fff}
.prpv-check--on{border-color:#1a56db;background:#eff6ff}
.prpv-check--on span:first-child{background:#1a56db;border-color:#1a56db;color:#fff}
.prpv-cb{width:16px;height:16px;min-width:16px;border-radius:4px;border:1px solid #cbd5e1;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;margin-top:1px;background:#fff}
.prpv-justif{background:#f8fafc;border-left:3px solid #94a3b8;border-radius:0 6px 6px 0;padding:10px 13px;font-size:12.5px;line-height:1.65;color:#1e3a8a}
.prpv-textarea{width:100%;border:1px solid #e5e7eb;border-radius:7px;padding:9px 11px;font-size:13px;line-height:1.55;resize:vertical;min-height:90px;color:#111;font-family:inherit;background:#fff}
.prpv-textarea:focus{outline:none;border-color:#1a56db}
.prpv-copy-btn{background:none;border:1px solid #cbd5e1;border-radius:6px;padding:4px 10px;font-size:12px;color:#1a56db;cursor:pointer;margin-bottom:6px}
.prpv-footer{padding:14px 18px;border-top:1px solid #e5e7eb;flex-shrink:0}
.prpv-btn-gen{width:100%;background:#1a56db;color:#fff;border:none;border-radius:8px;padding:11px;font-size:14px;font-weight:600;cursor:pointer}
.prpv-btn-gen:disabled{opacity:.5;cursor:not-allowed}
</style>

<div class="prpv-header">
  <span class="prpv-title">PRP / Viscossuplementação</span>
  <button class="prpv-close" id="prpvClose">✕</button>
</div>

<div class="prpv-body">

  <div class="prpv-doente">
    <strong>${patient.full_name || "—"}</strong>
    ${patient.sns ? `<span>SNS ${patient.sns}</span>` : ""}
    ${patient.dob ? `<span>${calcAge(patient.dob)} anos</span>` : ""}
  </div>

  <div>
    <div class="prpv-slabel">Procedimento</div>
    <div class="prpv-chips">
      ${chipsHtml(["prp","visco"],state.procedimento,"procedimento").replace(">prp<",">PRP<").replace(">visco<",">Viscossuplementação<")}
    </div>
  </div>

  <div class="prpv-hr"></div>

  <div>
    <div class="prpv-slabel">Indicação clínica</div>
    <div class="prpv-chips">
      <span class="prpv-chip prpv-chip--blue ${state.indicacao==="osteoartrose"?"prpv-chip--on":""}" data-campo="indicacao" data-val="osteoartrose">Osteoartrose</span>
      <span class="prpv-chip prpv-chip--blue ${state.indicacao==="tendinopatia"?"prpv-chip--on":""}" data-campo="indicacao" data-val="tendinopatia">Tendinopatia</span>
      <span class="prpv-chip prpv-chip--blue ${state.indicacao==="rotura_tendao"?"prpv-chip--on":""}" data-campo="indicacao" data-val="rotura_tendao">Rotura parcial tendão</span>
      <span class="prpv-chip prpv-chip--blue ${state.indicacao==="rotura_muscular"?"prpv-chip--on":""}" data-campo="indicacao" data-val="rotura_muscular">Rotura muscular</span>
    </div>
  </div>

  <div>
    <div class="prpv-slabel">Localização</div>
    <div class="prpv-chips">
      ${chipsHtml(opts.localizacao[ind], state.localizacao, "localizacao").replace(/class="prpv-chip /g,'class="prpv-chip prpv-chip--blue ')}
    </div>
  </div>

  <div>
    <div class="prpv-slabel">Grau imagiológico</div>
    <div class="prpv-chips">
      ${chipsHtml(opts.grau[ind], state.grau, "grau").replace(/class="prpv-chip /g,'class="prpv-chip prpv-chip--blue ')}
    </div>
  </div>

  <div class="prpv-hr"></div>

  <div>
    <div class="prpv-slabel">Tratamentos conservadores já realizados</div>
    <div class="prpv-checks">${checkHtml(opts.tratamentos[ind])}</div>
  </div>

  <div>
    <div class="prpv-slabel">Nº de infiltrações previstas</div>
    <div class="prpv-chips">
      ${chipsHtml(["1","2","3"], state.infiltracoes, "infiltracoes").replace(/class="prpv-chip /g,'class="prpv-chip prpv-chip--blue ')}
    </div>
  </div>

  <div class="prpv-hr"></div>

  <div>
    <div class="prpv-slabel">HDA / Exame objectivo</div>
    <button class="prpv-copy-btn" id="prpvCopyHda">↓ Copiar da última consulta</button>
    <textarea class="prpv-textarea" id="prpvHda" placeholder="Descreva a história clínica e achados do exame objectivo relevantes para o pedido ao seguro…" rows="5">${state.hda}</textarea>
  </div>

  <div>
    <div class="prpv-slabel">Observações adicionais <span style="font-size:10px;color:#94a3b8;font-weight:400;text-transform:none">(opcional)</span></div>
    <textarea class="prpv-textarea" id="prpvObs" placeholder="Notas adicionais para o seguro…" rows="3">${state.observacoes}</textarea>
  </div>

  <div class="prpv-hr"></div>

  <div>
    <div class="prpv-slabel">Justificação gerada automaticamente</div>
    <div class="prpv-justif" id="prpvJustif">${buildJustificacao()}</div>
  </div>

</div>

<div class="prpv-footer">
  <button class="prpv-btn-gen" id="prpvGenBtn">Gerar PDF para seguro</button>
</div>`;

    bindEvents();
  }

  function calcAge(dob) {
    const diff = Date.now() - new Date(dob).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
  }

  function bindEvents() {
    document.getElementById("prpvClose")?.addEventListener("click", () => {
      closePrpViscoPanel();
      if (typeof onClose === "function") onClose();
    });

    /* chips genéricos — event delegation */
    panel.addEventListener("click", e => {
      const chip = e.target.closest(".prpv-chip[data-campo]");
      if (!chip) return;
      const campo = chip.dataset.campo;
      const val   = chip.dataset.val;
      if (campo === "indicacao") {
        state.indicacao   = val;
        state.localizacao = "";
        state.grau        = "";
        state.tratamentos.clear();
      } else {
        state[campo] = val;
      }
      const scrollTop = panel.querySelector(".prpv-body")?.scrollTop || 0;
      render();
      const body = panel.querySelector(".prpv-body");
      if (body) body.scrollTop = scrollTop;
    });

    /* checkboxes tratamentos — delegado no body para evitar intercepção do <label> */
    panel.querySelector(".prpv-body")?.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      const check = e.target.closest(".prpv-check");
      if (!check) return;
      const v = check.querySelector("input[data-trat]")?.dataset.trat;
      if (!v) return;
      if (state.tratamentos.has(v)) state.tratamentos.delete(v);
      else state.tratamentos.add(v);
      const body = panel.querySelector(".prpv-body");
      const scrollTop = body?.scrollTop || 0;
      render();
      if (body) body.scrollTop = scrollTop;
    });

    /* textareas — guardar estado sem re-render */
    document.getElementById("prpvHda")?.addEventListener("input", e => {
      state.hda = e.target.value;
      document.getElementById("prpvJustif").textContent = buildJustificacao();
    });
    document.getElementById("prpvObs")?.addEventListener("input", e => {
      state.observacoes = e.target.value;
    });

    /* copiar HDA da última consulta */
    document.getElementById("prpvCopyHda")?.addEventListener("click", async () => {
      const btn = document.getElementById("prpvCopyHda");
      btn.textContent = "A carregar…";
      btn.disabled = true;
      const txt = await fetchLastHda();
      state.hda = txt || state.hda;
      const ta = document.getElementById("prpvHda");
      if (ta) ta.value = state.hda;
      btn.textContent = txt ? "✓ Copiado" : "Sem HDA disponível";
      setTimeout(() => {
        btn.textContent = "↓ Copiar da última consulta";
        btn.disabled = false;
      }, 2500);
    });

    /* gerar PDF */
    document.getElementById("prpvGenBtn")?.addEventListener("click", async () => {
      await gerarPdf();
    });
  }

  /* ── geração do PDF ── */
  async function gerarPdf() {
    const btn = document.getElementById("prpvGenBtn");
    if (btn) { btn.disabled = true; btn.textContent = "A gerar PDF…"; }

    try {
      const renderProxy = window.__gc_renderPdfViaProxy;
      const uploadPdf   = window.__gc_uploadPdfToStorage;
      const insertDoc   = window.__gc_insertDocumentRow;
      if (!renderProxy || !uploadPdf || !insertDoc) {
        alert("Funções de PDF não disponíveis. Refresca a página.");
        return;
      }

      const shell = await buildReportShell({ patient, clinic });
      const { sharedStyles, header, patientBlock, footer } = shell;

      const proc  = state.procedimento === "prp" ? "PRP" : "Ácido Hialurónico";
      const indLabels = { osteoartrose:"Osteoartrose", tendinopatia:"Tendinopatia", rotura_tendao:"Rotura Parcial de Tendão", rotura_muscular:"Rotura Muscular" };
      const indLabel  = indLabels[state.indicacao] || "";
      const trats = [...state.tratamentos];

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
${sharedStyles}
.prp-slabel{font-size:9px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#1a56db;margin:14px 0 4px 0}
.prp-value{font-size:13px;color:#111;margin-bottom:2px}
.prp-checks{display:flex;flex-wrap:wrap;gap:6px 18px;margin-top:3px}
.prp-ci{display:flex;align-items:center;gap:5px;font-size:12px;color:#333}
.prp-cb{width:10px;height:10px;border:1px solid #1a56db;border-radius:2px;background:#e8f0fe;display:flex;align-items:center;justify-content:center;font-size:8px;color:#1a56db;font-weight:700;flex-shrink:0}
.prp-justif{font-size:12px;line-height:1.65;color:#222;border-left:2px solid #94a3b8;padding:8px 12px;background:#f8f9fa;border-radius:0 4px 4px 0;margin-top:4px}
.prp-conclusao{font-size:12.5px;line-height:1.65;color:#111;border:1px solid #0f2d52;border-radius:4px;padding:10px 14px;margin-top:4px}
.prp-hda{background:#fafafa;border:0.5px solid #ddd;border-radius:4px;padding:8px 12px;font-size:12.5px;line-height:1.6;color:#222;white-space:pre-wrap}
</style>
</head><body><div class="a4">
${header}
<div class="title">Pedido de Comparticipação — ${proc}</div>
${patientBlock}

<div class="prp-slabel">Procedimento</div>
<div class="prp-value">${proc}</div>

<div class="prp-slabel">Indicação clínica</div>
<div class="prp-value">${indLabel}${state.localizacao ? " — " + state.localizacao : ""}${state.grau ? " (" + state.grau + ")" : ""}</div>

${state.hda ? `<div class="prp-slabel">HDA / Exame objectivo</div>
<div class="prp-hda">${state.hda.replace(/</g,"&lt;").replace(/>/g,"&gt;")}</div>` : ""}

<div class="prp-slabel">Tratamentos conservadores realizados</div>
<div class="prp-checks">
${trats.length ? trats.map(t => `<div class="prp-ci"><div class="prp-cb">✓</div>${t}</div>`).join("") : '<div class="prp-ci">Não especificado</div>'}
</div>

<div class="prp-slabel">Nº de infiltrações previstas</div>
<div class="prp-value">${state.infiltracoes}</div>

<div class="prp-slabel">Justificação terapêutica</div>
<div class="prp-justif">${buildJustificacao()}</div>

<div class="prp-slabel">Conclusão / Pedido de autorização</div>
<div class="prp-conclusao">
Solicita-se autorização para realização de <b>${state.infiltracoes}</b> infiltração(ões) com <b>${proc}</b>
${state.localizacao ? ` em <b>${state.localizacao.toLowerCase()}</b>` : ""},
no contexto de <b>${indLabel.toLowerCase()}</b>${state.grau ? ` grau <b>${state.grau}</b>` : ""},
refratária a tratamento conservador optimizado.${state.observacoes ? "<br><br>" + state.observacoes.replace(/</g,"&lt;").replace(/>/g,"&gt;") : ""}
</div>

${footer}
</div></body></html>`;

      let blob;
      try {
        blob = await renderProxy(html);
      } catch (e) {
        alert("Falha ao gerar PDF no servidor.\n" + String(e?.message || e));
        return;
      }

      if (!blob || blob.size < 5000) {
        alert("PDF inválido ou demasiado pequeno.");
        return;
      }

      /* path sem consultation_id */
      const ymd = new Date().toISOString().slice(0,10);
      const hms = new Date().toISOString().slice(11,19).replaceAll(":","-");
      const clinicId = clinic?.id || "desconhecida";
      const path = `clinic_${clinicId}/patient_${patient.id}/prp_visco_${ymd}_${hms}.pdf`;

      const up = await uploadPdf({ blob, path });
      if (!up.ok) {
        alert("Falhou o upload do PDF.\n" + String(up.error?.message || up.error || "erro desconhecido"));
        return;
      }

      const titleSafe = `PRP-Visco_${indLabel}_${(state.localizacao||"").replace(/\s/g,"_")}_${ymd}`.replace(/[^a-zA-Z0-9_\-]/g,"");

      const ins = await insertDoc({
        clinic_id:       clinicId,
        patient_id:      patient.id,
        consultation_id: null,
        title:           titleSafe,
        html:            "",
        parent_document_id: null,
        version:         1,
        storage_path:    path,
        category:        "PRP",
      });

      if (!ins.ok) {
        alert("PDF guardado no Storage mas falhou o registo na tabela documents.\n" + String(ins.error?.message || ins.error || ""));
        return;
      }

      alert("PDF criado e guardado com sucesso.");
      if (typeof onClose === "function") onClose();
      closePrpViscoPanel();

    } catch (e) {
      console.error("gerarPdf prp-visco:", e);
      alert("Erro inesperado: " + String(e?.message || e));
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "Gerar PDF para seguro"; }
    }
  }

  /* ── montar painel no DOM ── */
  const panel = document.createElement("div");
  panel.id = PANEL_ID;
  Object.assign(panel.style, {
    position: "absolute", top: "0", right: "0",
    width: "440px", height: "100%",
  });
  container.style.position = "relative";
  container.appendChild(panel);

  render();
}
