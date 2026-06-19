import { openEscalaFuncional } from "./escalas.js";

/* ========================================================
   EXAME OBJECTIVO — Menu selector + Formulários
   Extraído de doente.js
   Dependências externas: openEscalaFuncional (escalas.js)
   ======================================================== */

function openExameObjectivoMenu(anchorBtn, ctx = {}) {
  document.getElementById("gcExObjMenu")?.remove();

  const menu = document.createElement("div");
  menu.id = "gcExObjMenu";
  Object.assign(menu.style, {
    position: "fixed", zIndex: "3000", background: "#fff",
    border: "1px solid #e2e8f0", borderRadius: "12px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
    padding: "8px 0", minWidth: "240px",
    fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif",
    overflowY: "auto"
  });
  const rect = anchorBtn.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom - 12;
  const spaceAbove = rect.top - 12;
  const menuMaxH = Math.min(Math.max(spaceBelow, spaceAbove) - 8, 640);
  menu.style.maxHeight = menuMaxH + "px";
  if (spaceBelow >= spaceAbove || spaceBelow >= 300) {
    menu.style.top  = (rect.bottom + 6) + "px";
  } else {
    menu.style.bottom = (window.innerHeight - rect.top + 6) + "px";
  }
  // Horizontal: avoid going off-screen right
  const leftPos = Math.min(rect.left, window.innerWidth - 260);
  menu.style.left = Math.max(0, leftPos) + "px";

  const grupos = [
    {
      label: "Neurológico",
      items: [
        { id: "pfp",       label: "🥴 Paresia Facial Periférica",         ready: true },
        { id: "rpp",       label: "🩺 Pavimento Pélvico",                 ready: true },
        { id: "neuro_sum", label: "🧠 Neurológico Sumário",               ready: false },
      ]
    },
    {
      label: "Músculo-Esquelético — Membro Superior",
      items: [
        { id: "ombro",    label: "💪 Ombro",        ready: true },
        { id: "cotovelo", label: "🦾 Cotovelo",     ready: true },
        { id: "punho",    label: "✋ Punho / Mão",  ready: true },
      ]
    },
    {
      label: "Músculo-Esquelético — Membro Inferior",
      items: [
        { id: "anca",     label: "🦴 Anca",                 ready: true },
        { id: "joelho",   label: "🦵 Joelho",               ready: true },
        { id: "tibio",    label: "🦶 Tibiotársica / Pé",    ready: true },
      ]
    },
    {
      label: "Coluna",
      items: [
        { id: "cervical", label: "⬆️ Coluna Cervical", ready: true },
        { id: "lombar",   label: "⬇️ Coluna Lombar",   ready: true },
      ]
    },
    {
      label: "Atleta",
      items: [
        { id: "atleta", label: "🏃 Avaliação do Atleta", ready: true },
      ]
    },
    {
      label: "Escalas Funcionais — MFR",
      items: [
        { id: "escalas_mfr", label: "📊 Escalas Funcionais (DASH, Barthel, Oswestry…)", ready: true },
      ]
    },
  ];

  grupos.forEach((grp, gi) => {
    if (gi > 0) {
      const sep = document.createElement("div");
      Object.assign(sep.style, { height: "1px", background: "#f1f5f9", margin: "6px 0" });
      menu.appendChild(sep);
    }
    const lbl = document.createElement("div");
    lbl.textContent = grp.label;
    Object.assign(lbl.style, { padding: "4px 16px 2px", fontSize: "11px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" });
    menu.appendChild(lbl);

    grp.items.forEach(item => {
      const btn = document.createElement("button");
      btn.textContent = item.label;
      Object.assign(btn.style, {
        display: "block", width: "100%", textAlign: "left",
        background: "none", border: "none", padding: "9px 20px",
        fontSize: "14px", fontFamily: "inherit",
        color: item.ready ? "#0f172a" : "#94a3b8",
        cursor: item.ready ? "pointer" : "default",
        opacity: item.ready ? "1" : "0.6"
      });
      if (item.ready) {
        btn.onmouseenter = () => btn.style.background = "#f1f5f9";
        btn.onmouseleave = () => btn.style.background = "none";
        btn.addEventListener("click", () => {
          menu.remove();
          if (item.id === "escalas_mfr") { openEscalaFuncional(); }
          else { openExameObjectivoForm(item.id, menu._ctx || {}); }
        });
      }
      menu.appendChild(btn);
    });
  });

  menu._ctx = ctx;
  document.body.appendChild(menu);
  setTimeout(() => {
    const close = (ev) => {
      if (!menu.contains(ev.target) && ev.target !== anchorBtn) {
        menu.remove(); document.removeEventListener("click", close);
      }
    };
    document.addEventListener("click", close);
  }, 50);
}

async function openExameObjectivoForm(formId, ctx = {}) {
  if (formId === "incont") {
    _abrirBlob(`<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8"><title>Pavimento Pélvico</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:14px;color:#0f172a;background:#f8fafc}.page{max-width:900px;margin:0 auto;padding:20px}h1{font-size:18px;font-weight:700;color:#0f2d52;margin-bottom:4px}.sub{font-size:12px;color:#64748b;margin-bottom:18px}.sec{background:#fff;border:0.5px solid #e2e8f0;border-radius:12px;padding:16px 20px;margin-bottom:10px}.st{font-size:13px;font-weight:700;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;gap:8px}.num{width:22px;height:22px;border-radius:50%;background:#1a56db;color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}.gl{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#64748b;margin-bottom:6px;margin-top:12px}.gl:first-child{margin-top:0}textarea{width:100%;border:0.5px solid #e2e8f0;border-radius:8px;padding:8px 10px;font-size:13px;resize:vertical;min-height:64px;background:#f8fafc;color:#0f172a;font-family:inherit}.inp{width:100%;border:0.5px solid #e2e8f0;border-radius:8px;padding:8px 10px;font-size:13px;background:#f8fafc;color:#0f172a;font-family:inherit}.g2{display:grid;grid-template-columns:1fr 1fr;gap:12px}.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}.rg{display:flex;flex-direction:column;gap:4px;margin-top:4px}.ri{display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer}.ri input{width:14px;height:14px;accent-color:#1a56db;flex-shrink:0}.cg{display:flex;flex-direction:column;gap:4px;margin-top:4px}.ci{display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer}.ci input{width:14px;height:14px;accent-color:#1a56db;flex-shrink:0}.mt{border-collapse:collapse;width:100%;font-size:12px;margin-top:6px}.mt th{background:#f1f5f9;padding:6px 10px;border:0.5px solid #e2e8f0;font-weight:600;text-align:left}.mt td{border:0.5px solid #e2e8f0;padding:6px 10px}.mt tr:nth-child(even) td{background:#f8fafc}.icd{display:inline-block;font-size:10px;padding:2px 7px;border-radius:4px;background:#e0f2fe;color:#0369a1;font-weight:600;margin-left:6px}.act{display:flex;gap:10px;justify-content:flex-end;margin-top:16px;padding-top:14px;border-top:1px solid #e2e8f0}.bs{background:#1a56db;color:#fff;border:none;border-radius:8px;padding:9px 22px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}.bp{background:#fff;color:#0f172a;border:0.5px solid #e2e8f0;border-radius:8px;padding:9px 18px;font-size:13px;cursor:pointer;font-family:inherit}</style></head><body><div class="page">
<h1>Pavimento Pélvico / Incontinência Urinária e Fecal</h1><div class="sub">Avaliação clínica estruturada — MFR</div>
<div class="sec"><div class="st"><div class="num">1</div>Anamnese</div>
<div class="gl">Tipo de incontinência</div><div class="cg">
<label class="ci"><input type="checkbox"> Esforço (tosse, espirro, levantar peso) <span class="icd">ICD 788.32</span></label>
<label class="ci"><input type="checkbox"> Urgência <span class="icd">ICD 788.31</span></label>
<label class="ci"><input type="checkbox"> Mista <span class="icd">ICD 788.33</span></label>
<label class="ci"><input type="checkbox"> Fecal por urgência <span class="icd">ICD 787.60</span></label>
<label class="ci"><input type="checkbox"> Fecal passiva / seepage</label></div>
<div class="gl">Frequência</div><div class="g3">
<div><div class="gl">Episódios/dia</div><input class="inp" type="number" min="0" placeholder="—"></div>
<div><div class="gl">Micções diurnas</div><input class="inp" type="number" min="0" placeholder="—"></div>
<div><div class="gl">Micções noturnas</div><input class="inp" type="number" min="0" placeholder="—"></div></div>
<div class="gl">Sintomas associados</div><div class="cg">
<label class="ci"><input type="checkbox"> Urgência miccional</label>
<label class="ci"><input type="checkbox"> Enurese noturna</label>
<label class="ci"><input type="checkbox"> Infecções urinárias recorrentes</label>
<label class="ci"><input type="checkbox"> Obstipação</label>
<label class="ci"><input type="checkbox"> Sensação de prolapso retal</label></div>
<div class="gl">Factores precipitantes</div><div class="cg">
<label class="ci"><input type="checkbox"> Partos vaginais</label>
<label class="ci"><input type="checkbox"> Trauma obstétrico</label>
<label class="ci"><input type="checkbox"> Cirurgias pélvicas / anorretais</label>
<label class="ci"><input type="checkbox"> Radioterapia</label>
<label class="ci"><input type="checkbox"> Diabetes</label>
<label class="ci"><input type="checkbox"> Lesão neurológica</label>
<label class="ci"><input type="checkbox"> Menopausa / défice estrogénico</label></div>
<div class="gl">Notas de anamnese</div>
<textarea placeholder="História da queixa, duração, impacto na qualidade de vida, expectativas..."></textarea></div>

<div class="sec"><div class="st"><div class="num">2</div>Exame Objetivo</div>
<div class="gl">Neurológico perineal</div><div class="g2">
<div><div class="gl">Sensibilidade perineal/perianal</div><div class="rg">
<label class="ri"><input type="radio" name="sens"> Intacta</label>
<label class="ri"><input type="radio" name="sens"> Diminuída</label>
<label class="ri"><input type="radio" name="sens"> Ausente</label></div></div>
<div><div class="gl">Reflexo cutâneo-anal</div><div class="rg">
<label class="ri"><input type="radio" name="refAnal"> Bilateral presente</label>
<label class="ri"><input type="radio" name="refAnal"> Unilateral</label>
<label class="ri"><input type="radio" name="refAnal"> Ausente</label></div></div></div>
<div class="gl">Exame ginecológico / urogenital</div><div class="cg">
<label class="ci"><input type="checkbox"> Trofismo normal</label>
<label class="ci"><input type="checkbox"> Cistocele</label>
<label class="ci"><input type="checkbox"> Retocele</label>
<label class="ci"><input type="checkbox"> Histerocele</label>
<label class="ci"><input type="checkbox"> Próstata aumentada (homem)</label></div>
<div class="gl">Exame proctológico</div><div class="cg">
<label class="ci"><input type="checkbox"> Normal</label>
<label class="ci"><input type="checkbox"> Dermatite perianal</label>
<label class="ci"><input type="checkbox"> Fissura</label>
<label class="ci"><input type="checkbox"> Hemorroidas</label>
<label class="ci"><input type="checkbox"> Prolapso retal</label></div>
<div class="gl">Pavimento pélvico — Escala MRC</div>
<table class="mt"><thead><tr><th>Grau</th><th>Descrição</th><th style="width:60px">D</th><th style="width:60px">E</th></tr></thead><tbody>
<tr><td>0</td><td>Sem contração palpável</td><td><input type="radio" name="mrcD" value="0"></td><td><input type="radio" name="mrcE" value="0"></td></tr>
<tr><td>1</td><td>Contração mínima</td><td><input type="radio" name="mrcD" value="1"></td><td><input type="radio" name="mrcE" value="1"></td></tr>
<tr><td>2</td><td>Contração visível sem resistência</td><td><input type="radio" name="mrcD" value="2"></td><td><input type="radio" name="mrcE" value="2"></td></tr>
<tr><td>3</td><td>Contração contra gravidade</td><td><input type="radio" name="mrcD" value="3"></td><td><input type="radio" name="mrcE" value="3"></td></tr>
<tr><td>4</td><td>Contração contra resistência moderada</td><td><input type="radio" name="mrcD" value="4"></td><td><input type="radio" name="mrcE" value="4"></td></tr>
<tr><td>5</td><td>Força normal</td><td><input type="radio" name="mrcD" value="5"></td><td><input type="radio" name="mrcE" value="5"></td></tr>
</tbody></table>
<div class="gl">Endurance e repetições</div><div class="g3">
<div><div class="gl">Manutenção (seg)</div><input class="inp" type="number" min="0" max="60" placeholder="0–60s"></div>
<div><div class="gl">Repetições</div><input class="inp" type="number" min="0" placeholder="—"></div>
<div><div class="gl">Tónus anal repouso</div><select class="inp"><option value="">—</option><option>Normal</option><option>Diminuído</option><option>Aumentado</option></select></div></div>
<div class="gl">Muscular global e notas</div>
<textarea placeholder="Força abdominal, dorsais, glúteos, membros inferiores (MRC). Alterações posturais..."></textarea></div>

<div class="sec"><div class="st"><div class="num">3</div>Exames Complementares</div><div class="cg">
<label class="ci"><input type="checkbox"> Diário miccional e fecal (3–7 dias) solicitado</label>
<label class="ci"><input type="checkbox"> Uroanálise realizada</label>
<label class="ci"><input type="checkbox"> Resíduo pós-miccional avaliado</label>
<label class="ci"><input type="checkbox"> Ecografia abdominal/pélvica</label>
<label class="ci"><input type="checkbox"> Estudos urodinâmicos</label>
<label class="ci"><input type="checkbox"> Manometria anorretal</label></div>
<div class="gl">Resultados / notas</div>
<textarea placeholder="Resultados relevantes..."></textarea></div>

<div class="sec"><div class="st"><div class="num">4</div>Diagnóstico</div><div class="cg">
<label class="ci"><input type="checkbox"> Incontinência urinária de esforço <span class="icd">ICD 788.32</span></label>
<label class="ci"><input type="checkbox"> Incontinência urinária de urgência <span class="icd">ICD 788.31</span></label>
<label class="ci"><input type="checkbox"> Incontinência urinária mista <span class="icd">ICD 788.33</span></label>
<label class="ci"><input type="checkbox"> Incontinência urinária não especificada <span class="icd">ICD 788.30</span></label>
<label class="ci"><input type="checkbox"> Incontinência fecal <span class="icd">ICD 787.60</span></label>
<label class="ci"><input type="checkbox"> Laxidão do pavimento pélvico</label>
<label class="ci"><input type="checkbox"> Prolapso dos órgãos pélvicos</label></div>
<div class="gl">Notas diagnósticas</div>
<textarea placeholder="Outros diagnósticos associados..."></textarea></div>

<div class="sec"><div class="st"><div class="num">5</div>Plano Terapêutico</div><div class="cg">
<label class="ci"><input type="checkbox"> Educação e mudanças comportamentais</label>
<label class="ci"><input type="checkbox"> Exercícios de Kegel ≥12 semanas</label>
<label class="ci"><input type="checkbox"> Biofeedback electromiográfico <span class="icd">ADSE 2278</span></label>
<label class="ci"><input type="checkbox"> Estimulação eléctrica neuromuscular <span class="icd">ADSE 2264</span></label>
<label class="ci"><input type="checkbox"> Reeducação vesical — horário regular</label>
<label class="ci"><input type="checkbox"> Reeducação intestinal</label>
<label class="ci"><input type="checkbox"> Fortalecimento muscular global <span class="icd">ADSE 2340/2372</span></label>
<label class="ci"><input type="checkbox"> Treino de AVD <span class="icd">ADSE 2380</span></label>
<label class="ci"><input type="checkbox"> Encaminhamento urológico / coloproctológico</label></div>
<div class="gl">Notas do plano</div>
<textarea placeholder="Programa personalizado, frequência, cronograma..."></textarea></div>

<div class="sec"><div class="st"><div class="num">6</div>Conclusão</div>
<textarea style="min-height:110px" placeholder="Síntese clínica e orientação para reabilitação..."></textarea></div>

<div class="act">
<button class="bp" onclick="window.print()">Exportar PDF</button>
<button class="bs" onclick="window.print()">Exportar PDF</button>
</div></div></body></html>`);
  }
  /* ══════════════════════════════════════════════════════════════
     OMBRO
  ══════════════════════════════════════════════════════════════ */
  if (formId === "ombro") {
    const params = new URLSearchParams({p: ctx.patientId||'', c: ctx.clinicId||'', s: ctx.consultationId||''});
    window.open('/modules/obj/regiao.html?r=ombro&' + params.toString(), '_blank', 'width=1100,height=820,scrollbars=yes');
    return;
  }

  /* ══════════════════════════════════════════════════════════════
     COTOVELO — motor genérico
  ══════════════════════════════════════════════════════════════ */
  if (formId === "cotovelo") {
    const params = new URLSearchParams({p: ctx.patientId||'', c: ctx.clinicId||'', s: ctx.consultationId||''});
    window.open('/modules/obj/regiao.html?r=cotovelo&' + params.toString(), '_blank', 'width=1100,height=820,scrollbars=yes');
    return;
  }

  /* ══════════════════════════════════════════════════════════════
     PUNHO / MÃO — motor genérico
  ══════════════════════════════════════════════════════════════ */
  if (formId === "punho") {
    const params = new URLSearchParams({p: ctx.patientId||'', c: ctx.clinicId||'', s: ctx.consultationId||''});
    window.open('/modules/obj/regiao.html?r=punho-mao&' + params.toString(), '_blank', 'width=1100,height=820,scrollbars=yes');
    return;
  }

  /* ══════════════════════════════════════════════════════════════
     ANCA — motor genérico
  ══════════════════════════════════════════════════════════════ */
  if (formId === "anca") {
    const params = new URLSearchParams({p: ctx.patientId||'', c: ctx.clinicId||'', s: ctx.consultationId||''});
    window.open('/modules/obj/regiao.html?r=anca&' + params.toString(), '_blank', 'width=1100,height=820,scrollbars=yes');
    return;
  }

  /* ══════════════════════════════════════════════════════════════
     JOELHO — motor genérico
  ══════════════════════════════════════════════════════════════ */
  if (formId === "joelho") {
    const params = new URLSearchParams({p: ctx.patientId||'', c: ctx.clinicId||'', s: ctx.consultationId||''});
    window.open('/modules/obj/regiao.html?r=joelho&' + params.toString(), '_blank', 'width=1100,height=820,scrollbars=yes');
    return;
  }

  if (formId === "_cotovelo_old_unused") {
    _abrirBlob(`<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8">
<title>Exame Objectivo — Cotovelo</title><style>${_mskCss}</style></head><body>
<div class="page">
<h1>Exame Objectivo — Cotovelo</h1>
<div class="subtitle">Clique nas opções · Copie para a consulta no final</div>

<div class="sec">
  <div class="sec-title"><div class="num">1</div>Lateralidade &amp; Dor</div>
  <div class="cols2">
    <div><div class="gl">Cotovelo avaliado</div><div class="opts sg" id="lado"><div class="opt" data-v="Direito">Direito</div><div class="opt" data-v="Esquerdo">Esquerdo</div><div class="opt" data-v="Bilateral">Bilateral</div></div></div>
    <div><div class="gl">Tipo de dor</div><div class="opts sg" id="tipo_dor"><div class="opt" data-v="Mecânica">Mecânica</div><div class="opt" data-v="Inflamatória">Inflamatória</div><div class="opt" data-v="Neuropática">Neuropática</div></div></div>
  </div>
  <div class="sub-title" style="margin-top:14px">EVA</div>
  <div style="display:flex;flex-direction:column;gap:8px;margin-top:6px">
    <div class="eva-row"><span class="eva-lbl">Repouso</span>${_evaOpts("eva_rep")}</div>
    <div class="eva-row"><span class="eva-lbl">Actividade</span>${_evaOpts("eva_act")}</div>
    <div class="eva-row"><span class="eva-lbl">Pico máximo</span>${_evaOpts("eva_pic")}</div>
  </div>
  <div style="margin-top:12px"><div class="gl">Localização da dor</div>
    <div class="opts mg" id="local_dor"><div class="opt" data-v="Epicôndilo lateral (tendão extensores)">Epicôndilo lateral</div><div class="opt" data-v="Epicôndilo medial (tendão flexores)">Epicôndilo medial</div><div class="opt" data-v="Face posterior — olécrano">Olécrano</div><div class="opt" data-v="Face anterior">Anterior</div></div>
  </div>
</div>

<div class="sec">
  <div class="sec-title"><div class="num">2</div>Inspeção &amp; Palpação</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">Edema/tumefacção</div><div class="opts sg" id="insp_edema"><div class="opt" data-v="Ausente">Ausente</div><div class="opt" data-v="Ligeiro">Ligeiro</div><div class="opt" data-v="Moderado">Moderado</div></div></div>
    <div class="param-row"><div class="param-label">Ângulo de carregamento</div><div class="opts sg" id="insp_ang"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Varo">Varo</div><div class="opt" data-v="Valgo">Valgo</div></div></div>
    <div class="param-row"><div class="param-label">Palpação epicôndilo lateral</div><div class="opts sg" id="palp_ecl"><div class="opt" data-v="Indolor">Indolor</div><div class="opt" data-v="Doloroso">Doloroso</div></div></div>
    <div class="param-row"><div class="param-label">Palpação epicôndilo medial</div><div class="opts sg" id="palp_ecm"><div class="opt" data-v="Indolor">Indolor</div><div class="opt" data-v="Doloroso">Doloroso</div></div></div>
    <div class="param-row"><div class="param-label">Olécrano</div><div class="opts sg" id="palp_olec"><div class="opt" data-v="Indolor">Indolor</div><div class="opt" data-v="Doloroso">Doloroso</div><div class="opt" data-v="Bursite">Bursite</div></div></div>
  </div>
</div>

<div class="sec">
  <div class="sec-title"><div class="num">3</div>Mobilidade</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">Flexão (ref: 145°)</div><div class="opts sg" id="mob_flex"><div class="opt" data-v="Completa">Completa</div><div class="opt" data-v="Limitada c/ dor">Limitada c/ dor</div><div class="opt" data-v="Limitada s/ dor">Limitada s/ dor</div></div></div>
    <div class="param-row"><div class="param-label">Extensão (ref: 0°)</div><div class="opts sg" id="mob_ext"><div class="opt" data-v="Completa">Completa</div><div class="opt" data-v="Défice extensão c/ dor">Défice c/ dor</div><div class="opt" data-v="Défice extensão s/ dor">Défice s/ dor</div></div></div>
    <div class="param-row"><div class="param-label">Pronação (ref: 80°)</div><div class="opts sg" id="mob_pro"><div class="opt" data-v="Completa">Completa</div><div class="opt" data-v="Limitada c/ dor">Limitada c/ dor</div><div class="opt" data-v="Limitada s/ dor">Limitada s/ dor</div></div></div>
    <div class="param-row"><div class="param-label">Supinação (ref: 80°)</div><div class="opts sg" id="mob_sup"><div class="opt" data-v="Completa">Completa</div><div class="opt" data-v="Limitada c/ dor">Limitada c/ dor</div><div class="opt" data-v="Limitada s/ dor">Limitada s/ dor</div></div></div>
  </div>
</div>

<div class="sec">
  <div class="sec-title"><div class="num">4</div>Força &amp; Testes Específicos</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">Força extensores punho</div><div class="opts sg" id="f_ext"><div class="opt" data-v="5/5">5/5</div><div class="opt" data-v="4/5">4/5</div><div class="opt" data-v="3/5">3/5</div><div class="opt" data-v="2/5">2/5</div></div></div>
    <div class="param-row"><div class="param-label">Força flexores punho</div><div class="opts sg" id="f_flex"><div class="opt" data-v="5/5">5/5</div><div class="opt" data-v="4/5">4/5</div><div class="opt" data-v="3/5">3/5</div><div class="opt" data-v="2/5">2/5</div></div></div>
  </div>
  <div class="sub-title">Epicondilite lateral (Ténis)</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">Cozen (resistência extensão)</div><div class="opts sg" id="t_cozen"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo">Pos.</div></div></div>
    <div class="param-row"><div class="param-label">Mill's (extensão passiva)</div><div class="opts sg" id="t_mills"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo">Pos.</div></div></div>
    <div class="param-row"><div class="param-label">Chair test</div><div class="opts sg" id="t_chair"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo">Pos.</div></div></div>
  </div>
  <div class="sub-title">Epicondilite medial (Golfista)</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">Resistência flexão punho</div><div class="opts sg" id="t_golf"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo">Pos.</div></div></div>
  </div>
  <div class="sub-title">Nervo cubital</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">Sinal de Tinel (goteira cubital)</div><div class="opts sg" id="t_tinel"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo">Pos.</div></div></div>
  </div>
</div>

<div class="sec">
  <div class="sec-title"><div class="num">5</div>Observações</div>
  <textarea id="notas" placeholder="Conclusão clínica, plano..."></textarea>
</div>
</div>
<div id="toast">✓ Copiado — cole na consulta (Ctrl+V)</div>
<div class="bar-acoes"><button class="btn-pdf" id="btnPdf">Imprimir / PDF</button><button class="btn-copy" id="btnCopy">Copiar resumo para consulta</button></div>
<script>
${_mskJs}
window._gerarResumo = function(){
var g=window._getOpt,m=window._getMulti,v=window._getVal,e=window._evaRow;
var L=['── COTOVELO — EXAME OBJECTIVO ──'];
var lado=g('lado'); if(lado) L.push('Cotovelo '+lado);
var evStr=[e('eva_rep')?'repouso '+e('eva_rep'):'',e('eva_act')?'actividade '+e('eva_act'):'',e('eva_pic')?'pico '+e('eva_pic'):''].filter(Boolean).join(' | ');
if(evStr) L.push('EVA: '+evStr);
var td=g('tipo_dor'); if(td) L.push('Dor: '+td);
var ld=m('local_dor'); if(ld.length) L.push('Localização: '+ld.join(', '));
L.push('');L.push('Inspeção/Palpação:');
[['Edema',g('insp_edema')],['Ângulo carregamento',g('insp_ang')],['Epicôndilo lateral',g('palp_ecl')],['Epicôndilo medial',g('palp_ecm')],['Olécrano',g('palp_olec')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
L.push('');L.push('Mobilidade:');
[['Flexão',g('mob_flex')],['Extensão',g('mob_ext')],['Pronação',g('mob_pro')],['Supinação',g('mob_sup')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
L.push('');L.push('Força:');
[['Extensores punho',g('f_ext')],['Flexores punho',g('f_flex')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
L.push('');L.push('Testes:');
[['Cozen',g('t_cozen')],['Mills',g('t_mills')],['Chair test',g('t_chair')],['Resistência flexão (golfista)',g('t_golf')],['Tinel cubital',g('t_tinel')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
var n=v('notas'); if(n){L.push('');L.push('Notas: '+n);}
L.push('');L.push('──────────────────────────────────────────────────');
return L.join('\\n');
};
</script></body></html>`);
    return;
  }

  /* ══════════════════════════════════════════════════════════════
     PUNHO / MÃO
  ══════════════════════════════════════════════════════════════ */
  if (formId === "punho") {
    _abrirBlob(`<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8">
<title>Exame Objectivo — Punho / Mão</title><style>${_mskCss}</style></head><body>
<div class="page">
<h1>Exame Objectivo — Punho / Mão</h1>
<div class="subtitle">Clique nas opções · Copie para a consulta no final</div>

<div class="sec">
  <div class="sec-title"><div class="num">1</div>Lateralidade &amp; Dor</div>
  <div class="cols2">
    <div><div class="gl">Lado avaliado</div><div class="opts sg" id="lado"><div class="opt" data-v="Direito">Direito</div><div class="opt" data-v="Esquerdo">Esquerdo</div><div class="opt" data-v="Bilateral">Bilateral</div></div></div>
    <div><div class="gl">Membro dominante</div><div class="opts sg" id="dominant"><div class="opt" data-v="Direito">Direito</div><div class="opt" data-v="Esquerdo">Esquerdo</div></div></div>
  </div>
  <div class="sub-title" style="margin-top:14px">EVA</div>
  <div style="display:flex;flex-direction:column;gap:8px;margin-top:6px">
    <div class="eva-row"><span class="eva-lbl">Repouso</span>${_evaOpts("eva_rep")}</div>
    <div class="eva-row"><span class="eva-lbl">Actividade</span>${_evaOpts("eva_act")}</div>
    <div class="eva-row"><span class="eva-lbl">Pico máximo</span>${_evaOpts("eva_pic")}</div>
  </div>
  <div style="margin-top:12px"><div class="gl">Localização da dor</div>
    <div class="opts mg" id="local_dor"><div class="opt" data-v="Face dorsal do punho">Dorsal</div><div class="opt" data-v="Face palmar do punho">Palmar</div><div class="opt" data-v="Radial (tabaqueira anatómica)">Tabaqueira</div><div class="opt" data-v="Cubital">Cubital</div><div class="opt" data-v="Dedos">Dedos</div></div>
  </div>
</div>

<div class="sec">
  <div class="sec-title"><div class="num">2</div>Inspeção &amp; Palpação</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">Edema</div><div class="opts sg" id="insp_edema"><div class="opt" data-v="Ausente">Ausente</div><div class="opt" data-v="Ligeiro">Ligeiro</div><div class="opt" data-v="Moderado">Moderado</div></div></div>
    <div class="param-row"><div class="param-label">Deformidade</div><div class="opts mg" id="insp_def"><div class="opt" data-v="Sem deformidade">Sem deformidade</div><div class="opt" data-v="Desvio cubital dedos">Desvio cubital</div><div class="opt" data-v="Nódulos de Heberden">Heberden</div><div class="opt" data-v="Nódulos de Bouchard">Bouchard</div><div class="opt" data-v="Rizartrose polegár">Rizartrose</div></div></div>
    <div class="param-row"><div class="param-label">Tabaqueira anatómica</div><div class="opts sg" id="palp_tab"><div class="opt" data-v="Indolor">Indolor</div><div class="opt" data-v="Dolorosa — suspeita escafoide">Dolorosa</div></div></div>
    <div class="param-row"><div class="param-label">Pulso radial</div><div class="opts sg" id="palp_puls"><div class="opt" data-v="Presente e simétrico">Presente</div><div class="opt" data-v="Assimétrico">Assimétrico</div></div></div>
  </div>
</div>

<div class="sec">
  <div class="sec-title"><div class="num">3</div>Mobilidade do Punho</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">Flexão dorsal (ref: 70°)</div><div class="opts sg" id="mob_flex"><div class="opt" data-v="Completa">Completa</div><div class="opt" data-v="Limitada c/ dor">Limitada c/ dor</div><div class="opt" data-v="Limitada s/ dor">Limitada s/ dor</div></div></div>
    <div class="param-row"><div class="param-label">Flexão palmar (ref: 80°)</div><div class="opts sg" id="mob_ext"><div class="opt" data-v="Completa">Completa</div><div class="opt" data-v="Limitada c/ dor">Limitada c/ dor</div><div class="opt" data-v="Limitada s/ dor">Limitada s/ dor</div></div></div>
    <div class="param-row"><div class="param-label">Desvio radial (ref: 20°)</div><div class="opts sg" id="mob_rad"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Limitado c/ dor">Limitado c/ dor</div></div></div>
    <div class="param-row"><div class="param-label">Desvio cubital (ref: 35°)</div><div class="opts sg" id="mob_cub"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Limitado c/ dor">Limitado c/ dor</div></div></div>
  </div>
</div>

<div class="sec">
  <div class="sec-title"><div class="num">4</div>Força &amp; Testes Específicos</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">Preensão palmar (grip)</div><div class="opts sg" id="f_grip"><div class="opt" data-v="5/5 — normal">5/5</div><div class="opt" data-v="4/5 — ligeiramente diminuída">4/5</div><div class="opt" data-v="3/5 — moderadamente diminuída">3/5</div><div class="opt" data-v="2/5 — muito diminuída">2/5</div><div class="opt" data-v="1/5 — vestigial">1/5</div></div></div>
    <div class="param-row"><div class="param-label">Pinça polegar-índice</div><div class="opts sg" id="f_pinc"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Diminuída">Diminuída</div></div></div>
  </div>
  <div class="sub-title">Canal cárpico</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">Tinel (pulso)</div><div class="opts sg" id="t_tinel"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo — parestesias dedos">Pos.</div></div></div>
    <div class="param-row"><div class="param-label">Phalen</div><div class="opts sg" id="t_phalen"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo">Pos.</div></div></div>
    <div class="param-row"><div class="param-label">Durkan</div><div class="opts sg" id="t_durkan"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo">Pos.</div></div></div>
  </div>
  <div class="sub-title">De Quervain</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">Finkelstein</div><div class="opts sg" id="t_fink"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo — tenossinovite 1º compartimento">Pos.</div></div></div>
  </div>
</div>

<div class="sec">
  <div class="sec-title"><div class="num">5</div>Observações</div>
  <textarea id="notas" placeholder="Conclusão clínica, plano..."></textarea>
</div>
</div>
<div id="toast">✓ Copiado — cole na consulta (Ctrl+V)</div>
<div class="bar-acoes"><button class="btn-pdf" id="btnPdf">Imprimir / PDF</button><button class="btn-copy" id="btnCopy">Copiar resumo para consulta</button></div>
<script>
${_mskJs}
window._gerarResumo = function(){
var g=window._getOpt,m=window._getMulti,v=window._getVal,e=window._evaRow;
var L=['── PUNHO / MÃO — EXAME OBJECTIVO ──'];
var lado=g('lado'),dom=g('dominant');
if(lado) L.push('Lado '+lado+(dom?' (dominante: '+dom+')':''));
var evStr=[e('eva_rep')?'repouso '+e('eva_rep'):'',e('eva_act')?'actividade '+e('eva_act'):'',e('eva_pic')?'pico '+e('eva_pic'):''].filter(Boolean).join(' | ');
if(evStr) L.push('EVA: '+evStr);
var ld=m('local_dor'); if(ld.length) L.push('Localização: '+ld.join(', '));
L.push('');L.push('Inspeção/Palpação:');
[['Edema',g('insp_edema')],['Deformidade',m('insp_def').join(', ')],['Tabaqueira',g('palp_tab')],['Pulso radial',g('palp_puls')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
L.push('');L.push('Mobilidade punho:');
[['Flexão dorsal',g('mob_flex')],['Flexão palmar',g('mob_ext')],['Desvio radial',g('mob_rad')],['Desvio cubital',g('mob_cub')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
L.push('');L.push('Força:');
[['Grip',g('f_grip')],['Pinça',g('f_pinc')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
L.push('');L.push('Testes:');
[['Tinel',g('t_tinel')],['Phalen',g('t_phalen')],['Durkan',g('t_durkan')],['Finkelstein',g('t_fink')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
var n=v('notas'); if(n){L.push('');L.push('Notas: '+n);}
L.push('');L.push('──────────────────────────────────────────────────');
return L.join('\\n');
};
</script></body></html>`);
    return;
  }

  /* ══════════════════════════════════════════════════════════════
     ANCA
  ══════════════════════════════════════════════════════════════ */

  /* ══════════════════════════════════════════════════════════════
     TIBIOTÁRSICA / PÉ
  ══════════════════════════════════════════════════════════════ */
  if (formId === "tibio") {
    const params = new URLSearchParams({p: ctx.patientId||'', c: ctx.clinicId||'', s: ctx.consultationId||''});
    window.open('/modules/obj/regiao.html?r=tibio&' + params.toString(), '_blank', 'width=1100,height=820,scrollbars=yes');
    return;
  }

  /* ══════════════════════════════════════════════════════════════
     COLUNA CERVICAL — motor genérico
  ══════════════════════════════════════════════════════════════ */
  if (formId === "cervical") {
    const params = new URLSearchParams({p: ctx.patientId||'', c: ctx.clinicId||'', s: ctx.consultationId||''});
    window.open('/modules/obj/regiao.html?r=cervical&' + params.toString(), '_blank', 'width=1100,height=820,scrollbars=yes');
    return;
  }

  /* ══════════════════════════════════════════════════════════════
     PARESIA FACIAL PERIFÉRICA — motor genérico
  ══════════════════════════════════════════════════════════════ */
  if (formId === "pfp") {
    const params = new URLSearchParams({p: ctx.patientId||'', c: ctx.clinicId||'', s: ctx.consultationId||''});
    window.open('/modules/obj/regiao.html?r=pfp&' + params.toString(), '_blank', 'width=1100,height=820,scrollbars=yes');
    return;
  }

  /* ══════════════════════════════════════════════════════════════
     REABILITAÇÃO PAVIMENTO PÉLVICO — motor genérico
  ══════════════════════════════════════════════════════════════ */
  if (formId === "rpp") {
    const params = new URLSearchParams({p: ctx.patientId||'', c: ctx.clinicId||'', s: ctx.consultationId||''});
    window.open('/modules/obj/regiao.html?r=rpp&' + params.toString(), '_blank', 'width=1100,height=820,scrollbars=yes');
    return;
  }

  if (formId === "lombar") {
    const params = new URLSearchParams({p: ctx.patientId||'', c: ctx.clinicId||'', s: ctx.consultationId||''});
    window.open('/modules/obj/regiao.html?r=lombar&' + params.toString(), '_blank', 'width=1100,height=820,scrollbars=yes');
    return;
  }

  /* ══════════════════════════════════════════════════════════════
     ATLETA
  ══════════════════════════════════════════════════════════════ */
  if (formId === "atleta") {
    _abrirBlob(`<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8">
<title>Avalia\u00e7\u00e3o do Atleta</title><style>${_mskCss}
.sec-atleta{background:#f0f9ff;border-color:#bae6fd;}
.num-atl{background:#0284c7!important;}
.sec-reds{border-color:#fecaca;}
.num-red{background:#dc2626!important;}
</style></head><body>
<div class="page">
<h1>Avalia\u00e7\u00e3o do Atleta</h1>
<div class="subtitle">Screening m\u00fasculo-esquel\u00e9tico completo \u2022 Preencher em 3\u20135 min</div>

<!-- PERFIL DESPORTIVO -->
<div class="sec sec-atleta">
  <div class="sec-title"><div class="num num-atl">1</div>Perfil Desportivo</div>
  <div class="cols2">
    <div><div class="gl">Tipo de desporto</div><input type="text" id="at_desp" placeholder="ex: futebol, corrida, ciclismo..."></div>
    <div><div class="gl">N\u00edvel competitivo</div><div class="opts sg" id="at_nivel"><div class="opt" data-v="Recreativo">Recreativo</div><div class="opt" data-v="Amador federado">Amador fed.</div><div class="opt" data-v="Semi-profissional">Semi-prof.</div><div class="opt" data-v="Profissional">Profissional</div></div></div>
  </div>
  <div class="cols2" style="margin-top:10px;">
    <div><div class="gl">Treinos / semana</div><input type="number" id="at_trn" min="0" max="21" placeholder="n\u00ba"></div>
    <div><div class="gl">Horas de treino / semana</div><input type="number" id="at_hrs" min="0" max="60" placeholder="h"></div>
  </div>
  <div class="cols2" style="margin-top:10px;">
    <div><div class="gl">Altera\u00e7\u00e3o recente de carga</div><div class="opts sg" id="at_carga"><div class="opt" data-v="N\u00e3o">N\u00e3o</div><div class="opt" data-v="Aumento de carga">Aumento</div><div class="opt" data-v="Redu\u00e7\u00e3o de carga">Redu\u00e7\u00e3o</div></div></div>
    <div><div class="gl">Altera\u00e7\u00e3o equipamento / sapatilhas</div><div class="opts sg" id="at_equip"><div class="opt" data-v="N\u00e3o">N\u00e3o</div><div class="opt" data-v="Sim">Sim</div></div></div>
  </div>
  <div class="cols2" style="margin-top:10px;">
    <div><div class="gl">Ortóteses / ligaduras</div><div class="opts mg" id="at_orteses"><div class="opt" data-v="N\u00e3o usa">N\u00e3o usa</div><div class="opt" data-v="Ort\u00f3teses">Ort\u00f3teses</div><div class="opt" data-v="Ligaduras funcionais">Ligaduras</div></div></div>
    <div><div class="gl">Cirurgia ME pr\u00e9via</div><div class="opts sg" id="at_cir"><div class="opt" data-v="N\u00e3o">N\u00e3o</div><div class="opt" data-v="Sim">Sim</div></div></div>
  </div>
  <div style="margin-top:10px"><div class="gl">Bike fit (ciclismo)</div><div class="opts sg" id="at_bfit"><div class="opt" data-v="N/A">N/A</div><div class="opt" data-v="Realizado">Realizado</div><div class="opt" data-v="N\u00e3o realizado">N\u00e3o realizado</div></div></div>
  <div style="margin-top:10px"><div class="gl">Les\u00f5es pr\u00e9vias relevantes</div><textarea id="at_les" placeholder="Localiza\u00e7\u00e3o e tipo..."></textarea></div>
</div>

<!-- QUEIXA ACTUAL -->
<div class="sec">
  <div class="sec-title"><div class="num">2</div>Queixa Actual</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">Dor actual</div><div class="opts sg" id="at_dor"><div class="opt" data-v="N\u00e3o">N\u00e3o</div><div class="opt" data-v="Sim">Sim</div></div></div>
    <div class="param-row"><div class="param-label">Les\u00e3o \u00faltimos 12 meses</div><div class="opts sg" id="at_les12"><div class="opt" data-v="N\u00e3o">N\u00e3o</div><div class="opt" data-v="Sim">Sim</div></div></div>
    <div class="param-row"><div class="param-label">Falhou treinos / competi\u00e7\u00e3o</div><div class="opts sg" id="at_falhou"><div class="opt" data-v="N\u00e3o">N\u00e3o</div><div class="opt" data-v="Sim">Sim</div></div></div>
    <div class="param-row"><div class="param-label">Localiza\u00e7\u00e3o da dor</div><div style="flex:1;"><input type="text" id="at_local" placeholder="ex: joelho D, aq\u00fales E..."></div></div>
  </div>
</div>

<!-- RED-S -->
<div class="sec sec-reds">
  <div class="sec-title" style="color:#dc2626;border-color:#fecaca;"><div class="num num-red">!</div>RED-S \u2014 Relative Energy Deficiency in Sport</div>
  <div id="reds_warn" class="rf-warn">\u26a0\ufe0f RED-S suspeito \u2014 avaliar nutri\u00e7\u00e3o desportiva</div>
  <div class="param-grid">
    <div class="rf-row"><input type="checkbox" class="rf-cb" data-rf="Perda de peso inexplicada" id="reds1"><label class="rf-lbl" for="reds1">Perda de peso inexplicada</label><span class="rf-tip" data-tip="D\u00e9fice energ\u00e9tico cr\u00f3nico">i</span></div>
    <div class="rf-row"><input type="checkbox" class="rf-cb" data-rf="Fadiga persistente" id="reds2"><label class="rf-lbl" for="reds2">Fadiga persistente</label></div>
    <div class="rf-row"><input type="checkbox" class="rf-cb" data-rf="Diminui\u00e7\u00e3o do rendimento" id="reds3"><label class="rf-lbl" for="reds3">Diminui\u00e7\u00e3o do rendimento</label></div>
    <div class="rf-row"><input type="checkbox" class="rf-cb" data-rf="Les\u00f5es de repeti\u00e7\u00e3o" id="reds4"><label class="rf-lbl" for="reds4">Les\u00f5es de repeti\u00e7\u00e3o</label></div>
    <div class="rf-row"><input type="checkbox" class="rf-cb" data-rf="Fracturas de stress" id="reds5"><label class="rf-lbl" for="reds5">Fracturas de stress</label><span class="rf-tip" data-tip="Baixa DMO">i</span></div>
    <div class="rf-row"><input type="checkbox" class="rf-cb" data-rf="Altera\u00e7\u00f5es menstruais" id="reds6"><label class="rf-lbl" for="reds6">Altera\u00e7\u00f5es menstruais</label><span class="rf-tip" data-tip="Tr\u00edade da atleta feminina">i</span></div>
    <div class="rf-row"><input type="checkbox" class="rf-cb" data-rf="Baixa densidade mineral \u00f3ssea" id="reds7"><label class="rf-lbl" for="reds7">Baixa DMO</label></div>
    <div class="rf-row"><input type="checkbox" class="rf-cb" data-rf="Infec\u00e7\u00f5es frequentes" id="reds8"><label class="rf-lbl" for="reds8">Infec\u00e7\u00f5es frequentes</label></div>
  </div>
</div>

<!-- INSPECÇÃO POSTURAL -->
<div class="sec">
  <div class="sec-title"><div class="num">3</div>Inspe\u00e7\u00e3o Postural</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">Coluna</div><div class="opts mg" id="post_col"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Hipercifose">Hipercifose</div><div class="opt" data-v="Hiperlordose">Hiperlordose</div><div class="opt" data-v="Escoliose">Escoliose</div></div></div>
    <div class="param-row"><div class="param-label">Ombros</div><div class="opts mg" id="post_ombros"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Anteriorizados">Anteriorizados</div><div class="opt" data-v="Rot. int. \u2191">Rot. int. \u2191</div><div class="opt" data-v="Assimetria escapular">Assimetria</div><div class="opt" data-v="Esc\u00e1pula alada">Alada</div></div></div>
    <div class="param-row"><div class="param-label">Bacia</div><div class="opts mg" id="post_bac"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Obliquidade p\u00e9lvica">Obliquidade</div></div></div>
    <div class="param-row"><div class="param-label">Joelhos</div><div class="opts mg" id="post_joe"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Genu valgum">Valgum</div><div class="opt" data-v="Genu varum">Varum</div><div class="opt" data-v="Recurvatum">Recurvatum</div></div></div>
    <div class="param-row"><div class="param-label">P\u00e9</div><div class="opts mg" id="post_pe"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="P\u00e9 plano">Plano</div><div class="opt" data-v="P\u00e9 cavo">Cavo</div><div class="opt" data-v="Prona\u00e7\u00e3o \u2191">Prona\u00e7\u00e3o \u2191</div><div class="opt" data-v="Supina\u00e7\u00e3o \u2191">Supina\u00e7\u00e3o \u2191</div></div></div>
  </div>
</div>

<!-- MARCHA E MOBILIDADE GLOBAL -->
<div class="sec">
  <div class="sec-title"><div class="num">4</div>Marcha &amp; Mobilidade Global</div>
  <div class="sub-title">Marcha</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">Padr\u00e3o</div><div class="opts sg" id="mar_pad"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Assimetria">Assimetria</div><div class="opt" data-v="Claudica\u00e7\u00e3o">Claudica\u00e7\u00e3o</div><div class="opt" data-v="Rigidez lombar / p\u00e9lvica">Rigidez</div></div></div>
    <div class="param-row"><div class="param-label">Rota\u00e7\u00e3o p\u00e9s</div><div class="opts sg" id="mar_rot"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="In-toeing">In-toeing</div><div class="opt" data-v="Out-toeing">Out-toeing</div></div></div>
    <div class="param-row"><div class="param-label">Prona\u00e7\u00e3o / Supina\u00e7\u00e3o</div><div class="opts sg" id="mar_pron"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Hiperpronação D">Hiperpron. D</div><div class="opt" data-v="Hiperpronação E">Hiperpron. E</div><div class="opt" data-v="Bilateral">Bilateral</div></div></div>
    <div class="param-row"><div class="param-label">Pontas (S1)</div><div class="opts sg" id="mar_pont"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Dificuldade">Dificuldade</div><div class="opt" data-v="Incapaz">Incapaz</div></div></div>
    <div class="param-row"><div class="param-label">Calcanhares (L4\u2013L5)</div><div class="opts sg" id="mar_calc"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Dificuldade">Dificuldade</div><div class="opt" data-v="Incapaz">Incapaz</div></div></div>
  </div>
  <div class="sub-title">Mobilidade Global</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">Eleva\u00e7\u00e3o bilateral ombros</div><div class="opts sg" id="mob_ombros"><div class="opt" data-v="Sim\u00e9trica e completa">Sim\u00e9trica</div><div class="opt" data-v="Assimetria">Assimetria</div><div class="opt" data-v="Compensa\u00e7\u00e3o lombar">Compensa\u00e7\u00e3o</div></div></div>
    <div class="param-row"><div class="param-label">Flex\u00e3o ant. (isquiotibiais)</div><div class="opts sg" id="mob_flex_ant"><div class="opt" data-v="Alcança o chão">Alcança chão</div><div class="opt" data-v="Encurtamento ligeiro">Encurt. ligeiro</div><div class="opt" data-v="Encurtamento moderado">Encurt. moderado</div></div></div>
    <div class="param-row"><div class="param-label">RI anca</div><div class="opts sg" id="mob_ri_anca"><div class="opt" data-v="Normal bilateral">Normal</div><div class="opt" data-v="Limitada D">Limitada D</div><div class="opt" data-v="Limitada E">Limitada E</div><div class="opt" data-v="Bilateral limitada">Bilateral</div></div></div>
    <div class="param-row"><div class="param-label">Dorsiflexão tornozelo</div><div class="opts sg" id="mob_dors"><div class="opt" data-v="Normal bilateral">Normal</div><div class="opt" data-v="Limitada D">Limitada D</div><div class="opt" data-v="Limitada E">Limitada E</div><div class="opt" data-v="Bilateral limitada">Bilateral</div></div></div>
  </div>
</div>

<!-- FORÇA FUNCIONAL -->
<div class="sec">
  <div class="sec-title"><div class="num">5</div>For\u00e7a Funcional</div>
  <div class="sub-title">Agachamento bilateral</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">Alinhamento joelhos</div><div class="opts sg" id="sq_joe"><div class="opt" data-v="Alinhado">Alinhado</div><div class="opt" data-v="Valgismo din\u00e2mico">Valgismo</div><div class="opt" data-v="Varismo din\u00e2mico">Varismo</div></div></div>
    <div class="param-row"><div class="param-label">Controlo p\u00e9lvico</div><div class="opts sg" id="sq_pelv"><div class="opt" data-v="Mantido">Mantido</div><div class="opt" data-v="Obliquidade">Obliquidade</div></div></div>
    <div class="param-row"><div class="param-label">Inclina\u00e7\u00e3o tronco</div><div class="opts sg" id="sq_tronco"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Excessiva (mobilidade tornozelo?)">Excessiva</div></div></div>
  </div>
  <div class="sub-title">Agachamento monopodal</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">Controlo neuromuscular</div><div class="opts sg" id="sq_mono"><div class="opt" data-v="Bom">Bom</div><div class="opt" data-v="Valgismo din\u00e2mico \u2014 risco LCA">Valgismo</div><div class="opt" data-v="Trendelenburg \u2014 gl\u00fateo m\u00e9dio">Trendelenburg</div><div class="opt" data-v="Inst\u00e1vel">Inst\u00e1vel</div></div></div>
  </div>
  <div class="sub-title">Equil\u00edbrio monopodal</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">Equil\u00edbrio D</div><div class="opts sg" id="eq_d"><div class="opt" data-v="Est\u00e1vel (&gt;10s)">Est\u00e1vel</div><div class="opt" data-v="Inst\u00e1vel (&lt;10s)">Inst\u00e1vel</div></div></div>
    <div class="param-row"><div class="param-label">Equil\u00edbrio E</div><div class="opts sg" id="eq_e"><div class="opt" data-v="Est\u00e1vel (&gt;10s)">Est\u00e1vel</div><div class="opt" data-v="Inst\u00e1vel (&lt;10s)">Inst\u00e1vel</div></div></div>
  </div>
  <div class="sub-title">Ponte gl\u00fateia</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">Activa\u00e7\u00e3o gl\u00fateo</div><div class="opts sg" id="ponte"><div class="opt" data-v="Boa bilateral">Boa</div><div class="opt" data-v="D\u00e9fice D">D\u00e9fice D</div><div class="opt" data-v="D\u00e9fice E">D\u00e9fice E</div><div class="opt" data-v="D\u00e9fice bilateral">Bilateral</div></div></div>
  </div>
</div>

<!-- SCREENING NEUROLÓGICO -->
<div class="sec">
  <div class="sec-title"><div class="num">6</div>Screening Neurol\u00f3gico R\u00e1pido</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">Dorsiflexão p\u00e9 (L4)</div><div class="opts sg" id="neu_dors"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="D\u00e9fice D">D\u00e9fice D</div><div class="opt" data-v="D\u00e9fice E">D\u00e9fice E</div></div></div>
    <div class="param-row"><div class="param-label">Extens\u00e3o joelho (L3)</div><div class="opts sg" id="neu_joe"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="D\u00e9fice D">D\u00e9fice D</div><div class="opt" data-v="D\u00e9fice E">D\u00e9fice E</div></div></div>
    <div class="param-row"><div class="param-label">Eleva\u00e7\u00e3o bra\u00e7o (C5)</div><div class="opts sg" id="neu_braco"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="D\u00e9fice D">D\u00e9fice D</div><div class="opt" data-v="D\u00e9fice E">D\u00e9fice E</div></div></div>
    <div class="param-row"><div class="param-label">Sensibilidade membro inferior</div><div class="opts sg" id="neu_sens"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Alterada D">Alterada D</div><div class="opt" data-v="Alterada E">Alterada E</div></div></div>
  </div>
</div>

<!-- EQUIPAMENTO -->
<div class="sec">
  <div class="sec-title"><div class="num">7</div>Equipamento</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">Sapatilhas</div><div style="flex:1;"><input type="text" id="eq_sap" placeholder="Marca e modelo..."></div></div>
    <div class="param-row"><div class="param-label">Idade sapatilhas</div><div class="opts sg" id="eq_idade"><div class="opt" data-v="&lt;3 meses">&lt;3m</div><div class="opt" data-v="3\u20136 meses">3\u20136m</div><div class="opt" data-v="6\u201312 meses">6\u201312m</div><div class="opt" data-v="&gt;12 meses">&gt;12m</div></div></div>
    <div class="param-row"><div class="param-label">Palmilhas</div><div class="opts sg" id="eq_palm"><div class="opt" data-v="N\u00e3o usa">N\u00e3o</div><div class="opt" data-v="De s\u00e9rie">S\u00e9rie</div><div class="opt" data-v="Ortop\u00e9dicas personalizadas">Ortop\u00e9dicas</div></div></div>
  </div>
</div>

<!-- CONCLUSÃO -->
<div class="sec">
  <div class="sec-title"><div class="num">8</div>Conclusão &amp; Plano</div>
  <div><div class="gl">Principais achados</div><textarea id="at_achados" placeholder="Resumo dos achados..." style="min-height:55px;"></textarea></div>
  <div style="margin-top:10px"><div class="gl">Plano / Recomenda\u00e7\u00f5es</div><textarea id="at_plano" placeholder="Recomenda\u00e7\u00f5es, objectivos, reencaminhamentos..." style="min-height:55px;"></textarea></div>
</div>
</div>
<div id="toast">\u2713 Copiado \u2014 cole na consulta (Ctrl+V)</div>
<div class="bar-acoes"><button class="btn-pdf" id="btnPdf">Imprimir / PDF</button><button class="btn-copy" id="btnCopy">Copiar resumo para consulta</button></div>
<script>
${_mskJs}
window._gerarResumo = function(){
var g=window._getOpt,m=window._getMulti,v=window._getVal;
var L=['\u2500\u2500 ATLETA \u2014 AVALIA\u00c7\u00c3O \u2500\u2500'];
var desp=v('at_desp'); if(desp) L.push('Desporto: '+desp);
var niv=g('at_nivel'); if(niv) L.push('N\u00edvel: '+niv);
var trn=v('at_trn'),hrs=v('at_hrs');
if(trn||hrs) L.push('Carga: '+(trn?trn+'x/sem ':'' )+(hrs?hrs+'h/sem':''));
var les=v('at_les'); if(les) L.push('Les\u00f5es pr\u00e9vias: '+les);
var carga=g('at_carga'); if(carga&&carga!=='N\u00e3o') L.push('Altera\u00e7\u00e3o carga: '+carga);
var equip=g('at_equip'); if(equip==='Sim') L.push('Altera\u00e7\u00e3o equipamento: Sim');
var bfit=g('at_bfit'); if(bfit&&bfit!=='N/A') L.push('Bike fit: '+bfit);
L.push('');
var dor=g('at_dor'); if(dor) L.push('Dor actual: '+dor);
var loc=v('at_local'); if(loc) L.push('Localiza\u00e7\u00e3o: '+loc);
var les12=g('at_les12'); if(les12==='Sim') L.push('Les\u00e3o 12m: Sim');
var fal=g('at_falhou'); if(fal==='Sim') L.push('Falhou treinos: Sim');
var reds=(typeof window.getRF==='function'?window.getRF():[]).filter(function(x){return x;}); if(reds.length){L.push('');L.push('RED-S (alerta): '+reds.join(', '));}
L.push('');L.push('Postura:');
[['Coluna',m('post_col').join(', ')],['Ombros',m('post_ombros').join(', ')],['Bacia',m('post_bac').join(', ')],['Joelhos',m('post_joe').join(', ')],['P\u00e9',m('post_pe').join(', ')]].forEach(function(p){if(p[1]&&p[1].indexOf('Normal')<0)L.push('  \u2022 '+p[0]+': '+p[1]);});
L.push('');L.push('Marcha / Mobilidade:');
[['Marcha',g('mar_pad')],['Rota\u00e7\u00e3o p\u00e9s',g('mar_rot')],['Prona\u00e7\u00e3o',g('mar_pron')],['Pontas S1',g('mar_pont')],['Calcanhares L4-L5',g('mar_calc')],['Eleva\u00e7\u00e3o ombros',g('mob_ombros')],['Flex. anterior',g('mob_flex_ant')],['RI anca',g('mob_ri_anca')],['Dorsiflexão',g('mob_dors')]].forEach(function(p){if(p[1])L.push('  \u2022 '+p[0]+': '+p[1]);});
L.push('');L.push('For\u00e7a funcional:');
[['Agach. bilateral \u2014 joelhos',g('sq_joe')],['Agach. bilateral \u2014 pelvis',g('sq_pelv')],['Agach. bilateral \u2014 tronco',g('sq_tronco')],['Agach. monopodal',g('sq_mono')],['Equil\u00edbrio D',g('eq_d')],['Equil\u00edbrio E',g('eq_e')],['Ponte gl\u00fateia',g('ponte')]].forEach(function(p){if(p[1])L.push('  \u2022 '+p[0]+': '+p[1]);});
L.push('');L.push('Screening neurol\u00f3gico:');
[['Dorsiflexão L4',g('neu_dors')],['Extens\u00e3o joelho L3',g('neu_joe')],['Eleva\u00e7\u00e3o bra\u00e7o C5',g('neu_braco')],['Sensibilidade',g('neu_sens')]].forEach(function(p){if(p[1])L.push('  \u2022 '+p[0]+': '+p[1]);});
var sap=v('eq_sap'),idSap=g('eq_idade'),palm=g('eq_palm');
if(sap||palm){L.push('');if(sap)L.push('Sapatilhas: '+sap+(idSap?' ('+idSap+')':''));if(palm)L.push('Palmilhas: '+palm);}
var ach=v('at_achados'),pla=v('at_plano');
if(ach){L.push('');L.push('Achados: '+ach);}
if(pla){L.push('Plano: '+pla);}
L.push('');L.push('\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
return L.join('\\n');
};
</script></body></html>`);
    return;
  }

  if (formId) console.warn("[ExObj] formId não implementado:", formId);
}

export { openExameObjectivoMenu, openExameObjectivoForm };
