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
        { id: "pfp",       label: "😐 Paresia Facial Periférica",         ready: true },
        { id: "incont",    label: "🫧 Pavimento Pélvico / Incontinência", ready: true },
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
        { id: "cervical", label: "🫀 Coluna Cervical", ready: true },
        { id: "lombar",   label: "🫁 Coluna Lombar",   ready: true },
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
  if (formId === "pfp") {
    const pfpHtml = `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="utf-8">
<title>Paresia Facial Periférica — Exame Objectivo</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:14px;color:#0f172a;background:#f8fafc;padding:0}
.page{max-width:960px;margin:0 auto;padding:16px 20px 80px}
h1{font-size:18px;font-weight:700;margin-bottom:2px}
.subtitle{font-size:12px;color:#64748b;margin-bottom:20px}
.sec{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:12px}
.sec-title{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #f1f5f9}
.num{width:22px;height:22px;border-radius:50%;background:#1a56db;color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.gl{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;margin-bottom:6px;margin-top:12px}
.gl:first-child{margin-top:0}
/* Botões de escolha rápida */
.opts{display:flex;gap:6px;flex-wrap:wrap}
.opt{padding:5px 12px;border:1px solid #e2e8f0;border-radius:20px;font-size:12px;font-weight:500;cursor:pointer;background:#f8fafc;color:#475569;transition:all .15s;user-select:none}
.opt:hover{border-color:#1a56db;color:#1a56db}
.opt.sel{background:#1a56db;border-color:#1a56db;color:#fff}
.opt.sel-red{background:#dc2626;border-color:#dc2626;color:#fff}
.opt.sel-amber{background:#d97706;border-color:#d97706;color:#fff}
/* Grid de parâmetros */
.param-grid{display:grid;grid-template-columns:1fr;gap:8px}
.param-row{display:grid;grid-template-columns:200px 1fr;gap:12px;align-items:start;padding:6px 0;border-bottom:1px solid #f8fafc}
.param-row:last-child{border-bottom:none}
.param-label{font-size:13px;font-weight:500;color:#374151;padding-top:4px}
.cols2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.cols3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
input[type=text],input[type=date],textarea{width:100%;padding:7px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;color:#0f172a;background:#fff}
textarea{resize:vertical;min-height:60px;line-height:1.5}
/* House-Brackmann */
.hb-item{display:flex;align-items:center;gap:10px;padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;cursor:pointer;margin-bottom:6px;transition:all .15s}
.hb-item:hover{border-color:#1a56db}
.hb-item.sel{border-color:#1a56db;background:#eff6ff}
.hb-grade{width:28px;height:28px;border-radius:50%;background:#e2e8f0;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;flex-shrink:0}
.hb-item.sel .hb-grade{background:#1a56db;color:#fff}
/* Barra acções */
.bar-acoes{position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid #e2e8f0;padding:10px 20px;display:flex;gap:10px;justify-content:flex-end;z-index:100}
.btn-copy{padding:9px 22px;border:none;border-radius:8px;background:#1a56db;color:#fff;font-size:13px;font-weight:600;cursor:pointer}
.btn-pdf{padding:9px 22px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;color:#475569;font-size:13px;cursor:pointer}
#toast{position:fixed;bottom:70px;left:50%;transform:translateX(-50%);background:#0f6e56;color:#fff;padding:9px 20px;border-radius:8px;font-size:13px;opacity:0;transition:opacity .3s;pointer-events:none;z-index:200}
#toast.show{opacity:1}
@media print{.bar-acoes,#toast{display:none!important}.page{padding-bottom:16px}}
.sub-title{font-size:12px;font-weight:700;color:#1a56db;margin:14px 0 6px;text-transform:uppercase;letter-spacing:0.04em}
.rf-row{display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid #f8fafc;}
.rf-row:last-child{border-bottom:none;}
.rf-cb{width:16px;height:16px;cursor:pointer;accent-color:#dc2626;flex-shrink:0;}
.rf-lbl{font-size:13px;color:#374151;cursor:pointer;}
.rf-tip{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;background:#f1f5f9;color:#94a3b8;font-size:10px;font-weight:700;cursor:help;position:relative;}
.rf-tip:hover::after{content:attr(data-tip);position:absolute;left:20px;top:50%;transform:translateY(-50%);background:#0f172a;color:#fff;font-size:11px;padding:4px 8px;border-radius:6px;white-space:nowrap;z-index:100;font-weight:400;}
.rf-warn{display:none;margin-top:8px;padding:8px 12px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;color:#dc2626;font-size:12px;font-weight:600;}
.rf-warn.show{display:block;}
</style>
</head>
<body>
<div class="page">
<h1>Exame Objectivo — Paresia Facial Periférica</h1>
<div class="subtitle">Clique nas opções · Copie para a consulta no final</div>

<!-- 1. AVALIAÇÃO INICIAL -->
<div class="sec">
  <div class="sec-title"><div class="num">1</div>Avaliação Inicial</div>
  <div class="cols2">
    <div>
      <div class="gl">Paresia facial desde</div>
      <input type="date" id="pfp_inicio">
    </div>
    <div>
      <div class="gl">Lateralidade</div>
      <div class="opts" id="pfp_lado">
        <div class="opt" data-v="Direita">Direita</div>
        <div class="opt" data-v="Esquerda">Esquerda</div>
      </div>
    </div>
  </div>
  <div class="cols3" style="margin-top:14px">
    <div>
      <div class="gl">Recorreu ao SU</div>
      <div class="opts" id="pfp_su">
        <div class="opt" data-v="Sim">Sim</div>
        <div class="opt" data-v="Não">Não</div>
      </div>
    </div>
    <div>
      <div class="gl">Aciclovir</div>
      <div class="opts" id="pfp_aciclo">
        <div class="opt" data-v="Sim">Sim</div>
        <div class="opt" data-v="Não">Não</div>
      </div>
    </div>
    <div>
      <div class="gl">Corticoterapia</div>
      <div class="opts" id="pfp_cortico">
        <div class="opt" data-v="Sim">Sim</div>
        <div class="opt" data-v="Não">Não</div>
      </div>
    </div>
  </div>
  <div style="margin-top:12px">
    <div class="gl">Medicação actual</div>
    <input type="text" id="pfp_med" placeholder="ex: Prednisolona 60mg, Aciclovir 800mg 5x/dia...">
  </div>
  <div style="margin-top:10px">
    <div class="gl">Evolução até hoje</div>
    <textarea id="pfp_evol" placeholder="Descreva a evolução desde o início..."></textarea>
  </div>
</div>

<!-- 2. INSPEÇÃO EM REPOUSO -->
<div class="sec">
  <div class="sec-title"><div class="num">2</div>Inspeção Facial em Repouso</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">Simetria facial</div><div class="opts sg" id="r_sim"><div class="opt" data-v="Simétrica">Simétrica</div><div class="opt" data-v="Assimetria facial">Assimétrica</div></div></div>
    <div class="param-row"><div class="param-label">Sulco nasolabial</div><div class="opts sg" id="r_snl"><div class="opt" data-v="Preservado">Preservado</div><div class="opt" data-v="Apagado">Apagado</div></div></div>
    <div class="param-row"><div class="param-label">Comissura labial</div><div class="opts sg" id="r_com"><div class="opt" data-v="Simétrica">Simétrica</div><div class="opt" data-v="Desvio contralateral">Desvio contralateral</div></div></div>
    <div class="param-row"><div class="param-label">Sobrancelha</div><div class="opts sg" id="r_sob"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Queda">Queda</div></div></div>
    <div class="param-row"><div class="param-label">Fenda palpebral</div><div class="opts sg" id="r_fp"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Aumentada">Aumentada</div></div></div>
    <div class="param-row"><div class="param-label">Lagoftalmo repouso</div><div class="opts sg" id="r_lag"><div class="opt" data-v="Ausente">Ausente</div><div class="opt" data-v="Presente">Presente</div></div></div>
    <div class="param-row"><div class="param-label">Tónus facial</div><div class="opts sg" id="r_ton"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Hipotonia">Hipotonia</div></div></div>
    <div class="param-row"><div class="param-label">Movimentos involuntários</div><div class="opts sg" id="r_mov"><div class="opt" data-v="Ausentes">Ausentes</div><div class="opt" data-v="Sincinesias">Sincinesias</div><div class="opt" data-v="Espasmos">Espasmos</div></div></div>
  </div>
</div>

<!-- 3. AVALIAÇÃO MOTORA -->
<div class="sec">
  <div class="sec-title"><div class="num">3</div>Avaliação Motora — VII Par</div>

  <div class="sub-title">Região Frontal</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">Elevação sobrancelhas</div><div class="opts sg" id="m_esob"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Diminuída">Diminuída</div><div class="opt" data-v="Ausente">Ausente</div></div></div>
    <div class="param-row"><div class="param-label">Rugas frontais</div><div class="opts sg" id="m_rug"><div class="opt" data-v="Presentes">Presentes</div><div class="opt" data-v="Reduzidas">Reduzidas</div><div class="opt" data-v="Ausentes">Ausentes</div></div></div>
    <div class="param-row"><div class="param-label">Simetria frontal</div><div class="opts sg" id="m_sfr"><div class="opt" data-v="Simétrica">Simétrica</div><div class="opt" data-v="Assimétrica">Assimétrica</div></div></div>
  </div>

  <div class="sub-title">Região Ocular</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">Fecho palpebral suave</div><div class="opts sg" id="m_fps"><div class="opt" data-v="Completo">Completo</div><div class="opt" data-v="Incompleto">Incompleto</div></div></div>
    <div class="param-row"><div class="param-label">Fecho palpebral forçado</div><div class="opts sg" id="m_fpf"><div class="opt" data-v="Completo">Completo</div><div class="opt" data-v="Incompleto">Incompleto</div></div></div>
    <div class="param-row"><div class="param-label">Lagoftalmo</div><div class="opts sg" id="m_lag"><div class="opt" data-v="Ausente">Ausente</div><div class="opt" data-v="Presente">Presente</div></div></div>
    <div class="param-row"><div class="param-label">Sinal de Bell</div><div class="opts sg" id="m_bell"><div class="opt" data-v="Ausente">Ausente</div><div class="opt" data-v="Presente">Presente</div></div></div>
    <div class="param-row"><div class="param-label">Piscar espontâneo</div><div class="opts sg" id="m_pisc"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Diminuído">Diminuído</div></div></div>
  </div>

  <div class="sub-title">Região Nasal</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">Dilatação narinas</div><div class="opts sg" id="m_nar"><div class="opt" data-v="Simétrica">Simétrica</div><div class="opt" data-v="Diminuída">Diminuída</div></div></div>
  </div>

  <div class="sub-title">Região Oral</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">Mostrar dentes</div><div class="opts sg" id="m_dent"><div class="opt" data-v="Simétrico">Simétrico</div><div class="opt" data-v="Assimétrico">Assimétrico</div></div></div>
    <div class="param-row"><div class="param-label">Sorriso</div><div class="opts sg" id="m_sorr"><div class="opt" data-v="Simétrico">Simétrico</div><div class="opt" data-v="Assimétrico">Assimétrico</div></div></div>
    <div class="param-row"><div class="param-label">Assobiar</div><div class="opts sg" id="m_ass"><div class="opt" data-v="Preservado">Preservado</div><div class="opt" data-v="Incapaz">Incapaz</div></div></div>
    <div class="param-row"><div class="param-label">Insuflar bochechas</div><div class="opts sg" id="m_boc"><div class="opt" data-v="Mantém ar">Mantém ar</div><div class="opt" data-v="Escape de ar">Escape de ar</div></div></div>
  </div>
</div>

<!-- 4. FUNÇÃO OROFACIAL -->
<div class="sec">
  <div class="sec-title"><div class="num">4</div>Função Orofacial</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">Articulação da fala</div><div class="opts sg" id="o_fala"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Disartria ligeira">Disartria ligeira</div><div class="opt" data-v="Disartria moderada">Disartria moderada</div></div></div>
    <div class="param-row"><div class="param-label">Mobilidade labial</div><div class="opts sg" id="o_lab"><div class="opt" data-v="Preservada">Preservada</div><div class="opt" data-v="Diminuída">Diminuída</div></div></div>
    <div class="param-row"><div class="param-label">Retenção de saliva</div><div class="opts sg" id="o_sal"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Sialorreia">Sialorreia</div></div></div>
    <div class="param-row"><div class="param-label">Controlo oral líquidos</div><div class="opts sg" id="o_liq"><div class="opt" data-v="Preservado">Preservado</div><div class="opt" data-v="Escape">Escape</div></div></div>
  </div>
</div>

<!-- 5. AVALIAÇÃO OCULAR -->
<div class="sec">
  <div class="sec-title"><div class="num">5</div>Avaliação Ocular</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">Fecho ocular</div><div class="opts sg" id="oc_fecho"><div class="opt" data-v="Completo">Completo</div><div class="opt" data-v="Incompleto">Incompleto</div></div></div>
    <div class="param-row"><div class="param-label">Lacrimejo</div><div class="opts sg" id="oc_lac"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Diminuído">Diminuído</div><div class="opt" data-v="Aumentado">Aumentado</div></div></div>
    <div class="param-row"><div class="param-label">Hiperemia conjuntival</div><div class="opts sg" id="oc_hip"><div class="opt" data-v="Ausente">Ausente</div><div class="opt" data-v="Presente">Presente</div></div></div>
    <div class="param-row"><div class="param-label">Risco de queratite</div><div class="opts sg" id="oc_qer"><div class="opt" data-v="Não">Não</div><div class="opt" data-v="Sim — referenciar">Sim</div></div></div>
  </div>
</div>

<!-- 6. SINCINESIAS -->
<div class="sec">
  <div class="sec-title"><div class="num">6</div>Sincinesias e Contraturas</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">Sincinesia olho→boca</div><div class="opts sg" id="s_ob"><div class="opt" data-v="Não">Não</div><div class="opt" data-v="Sim">Sim</div></div></div>
    <div class="param-row"><div class="param-label">Sincinesia boca→olho</div><div class="opts sg" id="s_bo"><div class="opt" data-v="Não">Não</div><div class="opt" data-v="Sim">Sim</div></div></div>
    <div class="param-row"><div class="param-label">Espasmo hemifacial</div><div class="opts sg" id="s_esp"><div class="opt" data-v="Não">Não</div><div class="opt" data-v="Sim">Sim</div></div></div>
    <div class="param-row"><div class="param-label">Contratura facial</div><div class="opts sg" id="s_con"><div class="opt" data-v="Não">Não</div><div class="opt" data-v="Sim">Sim</div></div></div>
    <div class="param-row"><div class="param-label">Lágrimas de crocodilo</div><div class="opts sg" id="s_croc"><div class="opt" data-v="Não">Não</div><div class="opt" data-v="Sim">Sim</div></div></div>
  </div>
</div>

<!-- 7. HOUSE-BRACKMANN -->
<div class="sec">
  <div class="sec-title"><div class="num">7</div>House-Brackmann</div>
  <div id="hb_grp">
    <div class="hb-item" data-hb="I"><div class="hb-grade">I</div><div><strong>Grau I</strong> — Função normal</div></div>
    <div class="hb-item" data-hb="II"><div class="hb-grade">II</div><div><strong>Grau II</strong> — Disfunção ligeira · assimetria mínima · fecho ocular completo com esforço mínimo</div></div>
    <div class="hb-item" data-hb="III"><div class="hb-grade">III</div><div><strong>Grau III</strong> — Disfunção moderada · assimetria evidente · fecho ocular completo com esforço</div></div>
    <div class="hb-item" data-hb="IV"><div class="hb-grade">IV</div><div><strong>Grau IV</strong> — Disfunção moderadamente grave · fecho ocular incompleto</div></div>
    <div class="hb-item" data-hb="V"><div class="hb-grade">V</div><div><strong>Grau V</strong> — Disfunção grave · movimento mínimo</div></div>
    <div class="hb-item" data-hb="VI"><div class="hb-grade">VI</div><div><strong>Grau VI</strong> — Paralisia completa</div></div>
  </div>
</div>

<!-- 8. OBSERVAÇÕES -->
<div class="sec">
  <div class="sec-title"><div class="num">8</div>Observações Adicionais</div>
  <div class="opts" id="obs_flags" style="margin-bottom:12px">
    <div class="opt" data-v="dor retroauricular">Dor retroauricular</div>
    <div class="opt" data-v="hiperacusia">Hiperacusia</div>
    <div class="opt" data-v="infecção viral recente">Infecção viral recente</div>
    <div class="opt" data-v="Ramsay Hunt">Ramsay Hunt</div>
    <div class="opt" data-v="traumatismo prévio">Traumatismo prévio</div>
    <div class="opt" data-v="episódio prévio">Episódio prévio</div>
    <div class="opt" data-v="investigar causa central">Investigar causa central</div>
  </div>
  <div class="gl">Notas</div>
  <textarea id="pfp_notas" placeholder="Outras observações..."></textarea>
</div>

</div>

<div id="toast">✓ Copiado — cole na consulta (Ctrl+V)</div>

<div class="bar-acoes">
<button type="button" class="btn-pdf" id="btnPdf">Exportar PDF</button>
<button type="button" class="btn-copy" id="btnCopy">Copiar resumo para consulta</button>
</div>

<script>
(function(){
// Botões de escolha única por grupo
document.querySelectorAll('.opts.sg, #pfp_lado, #pfp_su, #pfp_aciclo, #pfp_cortico').forEach(function(grp){
  grp.querySelectorAll('.opt').forEach(function(btn){
    btn.addEventListener('click', function(){
      grp.querySelectorAll('.opt').forEach(function(b){ b.classList.remove('sel'); });
      btn.classList.add('sel');
    });
  });
});

// Botões múltipla selecção (obs_flags)
document.querySelectorAll('#obs_flags .opt').forEach(function(btn){
  btn.addEventListener('click', function(){ btn.classList.toggle('sel'); });
});

// House-Brackmann
document.querySelectorAll('#hb_grp .hb-item').forEach(function(item){
  item.addEventListener('click', function(){
    document.querySelectorAll('#hb_grp .hb-item').forEach(function(i){ i.classList.remove('sel'); });
    item.classList.add('sel');
  });
});

function getOpt(id){
  var el = document.getElementById(id);
  if(!el) return '';
  var sel = el.querySelector('.opt.sel');
  return sel ? sel.dataset.v : '';
}
function getMulti(id){
  var el = document.getElementById(id);
  if(!el) return [];
  return Array.from(el.querySelectorAll('.opt.sel')).map(function(b){ return b.dataset.v; });
}
function getHB(){
  var sel = document.querySelector('#hb_grp .hb-item.sel');
  return sel ? sel.dataset.hb : '';
}

function gerarResumo(){
  var L = [];
  L.push('── PARESIA FACIAL PERIFÉRICA — EXAME OBJECTIVO ──');
  L.push('');

  // 1. Inicial
  var ini   = document.getElementById('pfp_inicio').value;
  var lado  = getOpt('pfp_lado');
  var su    = getOpt('pfp_su');
  var acicl = getOpt('pfp_aciclo');
  var cort  = getOpt('pfp_cortico');
  var med   = document.getElementById('pfp_med').value.trim();
  var evol  = document.getElementById('pfp_evol').value.trim();
  if(ini) L.push('Início: '+ini);
  if(lado) L.push('Lado: '+lado);
  if(su)   L.push('Serviço de Urgência: '+su);
  if(acicl) L.push('Aciclovir: '+acicl);
  if(cort)  L.push('Corticoterapia: '+cort);
  if(med)   L.push('Medicação: '+med);
  if(evol)  L.push('Evolução: '+evol);

  // Secções
  var params = [
    ['Inspeção em Repouso', [
      ['Simetria','r_sim'],['Sulco nasolabial','r_snl'],['Comissura','r_com'],
      ['Sobrancelha','r_sob'],['Fenda palpebral','r_fp'],['Lagoftalmo repouso','r_lag'],
      ['Tónus','r_ton'],['Movimentos involuntários','r_mov']
    ]],
    ['Motora — Frontal', [
      ['Elevação sobrancelhas','m_esob'],['Rugas frontais','m_rug'],['Simetria frontal','m_sfr']
    ]],
    ['Motora — Ocular', [
      ['Fecho suave','m_fps'],['Fecho forçado','m_fpf'],['Lagoftalmo','m_lag'],
      ['Sinal de Bell','m_bell'],['Piscar','m_pisc']
    ]],
    ['Motora — Nasal', [['Narinas','m_nar']]],
    ['Motora — Oral', [
      ['Mostrar dentes','m_dent'],['Sorriso','m_sorr'],['Assobiar','m_ass'],['Bochechas','m_boc']
    ]],
    ['Função Orofacial', [
      ['Fala','o_fala'],['Lábios','o_lab'],['Saliva','o_sal'],['Líquidos','o_liq']
    ]],
    ['Avaliação Ocular', [
      ['Fecho','oc_fecho'],['Lacrimejo','oc_lac'],['Hiperemia','oc_hip'],['Queratite','oc_qer']
    ]],
    ['Sincinesias', [
      ['Olho→boca','s_ob'],['Boca→olho','s_bo'],['Espasmo','s_esp'],['Contratura','s_con'],['Lágrimas crocodilo','s_croc']
    ]],
  ];

  params.forEach(function(sec){
    var nome = sec[0]; var items = sec[1];
    var rows = items.map(function(i){ var v = getOpt(i[1]); return v ? '  • '+i[0]+': '+v : ''; }).filter(Boolean);
    if(rows.length){ L.push(''); L.push(nome+':'); rows.forEach(function(r){ L.push(r); }); }
  });

  // HB
  var hb = getHB();
  if(hb) { L.push(''); L.push('House-Brackmann: Grau '+hb); }

  // Obs
  var obs = getMulti('obs_flags');
  var notas = document.getElementById('pfp_notas').value.trim();
  if(obs.length){ L.push(''); L.push('Obs: '+obs.join(', ')); }
  if(notas){ L.push('Notas: '+notas); }

  L.push('');
  L.push('──────────────────────────────────────────────────');
  return L.join(String.fromCharCode(10));
}

document.getElementById('btnCopy').addEventListener('click', function(){
  var txt = gerarResumo();
  var showToast = function(){
    var t = document.getElementById('toast');
    t.classList.add('show');
    setTimeout(function(){ t.classList.remove('show'); }, 2800);
  };
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(txt).then(showToast).catch(function(){
      fallbackCopy(txt); showToast();
    });
  } else { fallbackCopy(txt); showToast(); }
});

function fallbackCopy(txt){
  var ta = document.createElement('textarea');
  ta.value = txt; ta.style.position='fixed'; ta.style.opacity='0';
  document.body.appendChild(ta); ta.select(); document.execCommand('copy');
  document.body.removeChild(ta);
}

document.getElementById('btnPdf').addEventListener('click', function(){ window.print(); });
})();
</script>
</body>
</html>
`;
    const blob = new Blob([pfpHtml], { type: "text/html" });
    const url  = URL.createObjectURL(blob);
    const win  = window.open(url, "_blank", "width=1000,height=800,scrollbars=yes");
    // Libertar Blob URL depois de abrir
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return;
  }
  // ── helpers partilhados por todos os formulários músculo-esqueléticos ──
  const _mskCss = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:14px;color:#0f172a;background:#f8fafc;padding:0}
.page{max-width:980px;margin:0 auto;padding:16px 20px 80px}
h1{font-size:18px;font-weight:700;margin-bottom:2px}
.subtitle{font-size:12px;color:#64748b;margin-bottom:16px}
.sec{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:10px}
.sec-title{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #f1f5f9}
.num{width:22px;height:22px;border-radius:50%;background:#1a56db;color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.gl{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;margin-bottom:6px;margin-top:12px}
.gl:first-child{margin-top:0}
.sub-title{font-size:12px;font-weight:700;color:#1a56db;margin:14px 0 6px;text-transform:uppercase;letter-spacing:0.04em}
.opts{display:flex;gap:6px;flex-wrap:wrap}
.opt{padding:5px 12px;border:1px solid #e2e8f0;border-radius:20px;font-size:12px;font-weight:500;cursor:pointer;background:#f8fafc;color:#475569;transition:all .15s;user-select:none}
.opt:hover{border-color:#1a56db;color:#1a56db}
.opt.sel{background:#1a56db;border-color:#1a56db;color:#fff}
.param-grid{display:grid;grid-template-columns:1fr;gap:0}
.param-row{display:grid;grid-template-columns:210px 1fr;gap:12px;align-items:start;padding:6px 0;border-bottom:1px solid #f8fafc}
.param-row:last-child{border-bottom:none}
.param-label{font-size:13px;font-weight:500;color:#374151;padding-top:4px}
.cols2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.cols3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
.cols4{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px}
input[type=text],input[type=date],input[type=number],textarea{width:100%;padding:7px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;color:#0f172a;background:#fff}
textarea{resize:vertical;min-height:56px;line-height:1.5}
.bar-acoes{position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid #e2e8f0;padding:10px 20px;display:flex;gap:10px;justify-content:flex-end;z-index:100}
.btn-copy{padding:9px 22px;border:none;border-radius:8px;background:#1a56db;color:#fff;font-size:13px;font-weight:600;cursor:pointer}
.btn-pdf{padding:9px 22px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;color:#475569;font-size:13px;cursor:pointer}
#toast{position:fixed;bottom:70px;left:50%;transform:translateX(-50%);background:#0f6e56;color:#fff;padding:9px 20px;border-radius:8px;font-size:13px;opacity:0;transition:opacity .3s;pointer-events:none;z-index:200}
#toast.show{opacity:1}
@media print{.bar-acoes,#toast{display:none!important}.page{padding-bottom:16px}}
.eva-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.eva-lbl{font-size:12px;color:#64748b;min-width:130px}
.eva-btns{display:flex;gap:4px}
.eva-btns .opt{min-width:32px;text-align:center;padding:4px 8px}
`;

  const _mskJs = `
(function(){
// escolha única por grupo com classe .sg
document.querySelectorAll('.opts.sg').forEach(function(grp){
  grp.querySelectorAll('.opt').forEach(function(btn){
    btn.addEventListener('click',function(){
      grp.querySelectorAll('.opt').forEach(function(b){b.classList.remove('sel');});
      btn.classList.add('sel');
    });
  });
});
// escolha múltipla (sem .sg)
document.querySelectorAll('.opts.mg').forEach(function(grp){
  grp.querySelectorAll('.opt').forEach(function(btn){
    btn.addEventListener('click',function(){btn.classList.toggle('sel');});
  });
});

function getOpt(id){
  var el=document.getElementById(id); if(!el) return '';
  var s=el.querySelector('.opt.sel'); return s?s.dataset.v:'';
}
function getMulti(id){
  var el=document.getElementById(id); if(!el) return [];
  return Array.from(el.querySelectorAll('.opt.sel')).map(function(b){return b.dataset.v;});
}
function getVal(id){var el=document.getElementById(id);return el?(el.value||'').trim():'';}
function evaRow(id){
  // EVA: devolve texto "X/10" ou vazio
  var el=document.getElementById(id); if(!el) return '';
  var s=el.querySelector('.opt.sel'); return s?s.dataset.v+'/10':'';
}

function linha(label,val){ return val?'  • '+label+': '+val:''; }
function secao(titulo,linhas){
  var rows=linhas.filter(Boolean);
  if(!rows.length) return '';
  return '\\n'+titulo+':\\n'+rows.join('\\n');
}

window._getOpt=getOpt;
window._getMulti=getMulti;
window._getVal=getVal;
window._evaRow=evaRow;
window._linha=linha;
window._secao=secao;

function copiar(txt){
  function showToast(){var t=document.getElementById('toast');t.classList.add('show');setTimeout(function(){t.classList.remove('show');},2800);}
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(txt).then(showToast).catch(function(){fallback(txt);showToast();});
  } else {fallback(txt);showToast();}
}
function fallback(txt){var ta=document.createElement('textarea');ta.value=txt;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);}

document.getElementById('btnPdf').addEventListener('click',function(){window.print();});
document.getElementById('btnCopy').addEventListener('click',function(){
  if(typeof window._gerarResumo==='function') copiar(window._gerarResumo());
});

// Red Flags checkboxes
document.querySelectorAll('.rf-cb').forEach(function(cb){
  cb.addEventListener('change',function(){
    var par=cb.closest('[id$="_warn"],[id$="warn"]');
    // find nearest rf-warn sibling
    var sec=cb.closest('.sec,.sec-reds');
    var w=sec?sec.querySelector('.rf-warn'):null;
    if(!w) w=document.getElementById('rf_warn');
    if(!w) w=document.getElementById('reds_warn');
    if(w){
      var any=sec?sec.querySelectorAll('.rf-cb:checked').length>0:false;
      if(any)w.classList.add('show');else w.classList.remove('show');
    }
  });
});
function getRF(){return Array.from(document.querySelectorAll('.rf-cb:checked')).map(function(c){return c.dataset.rf;});}
window.getRF=getRF;
})();
`;

  // ── helper: abrir Blob URL ──
  function _abrirBlob(htmlStr, winOpts) {
    const blob = new Blob([htmlStr], { type: "text/html" });
    const url  = URL.createObjectURL(blob);
    window.open(url, "_blank", winOpts || "width=1020,height=840,scrollbars=yes");
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  // helper: EVA buttons 0-10
  function _evaOpts(id) {
    let s = `<div class="eva-btns opts sg" id="${id}">`;
    for (let i=0;i<=10;i++) s+=`<div class="opt" data-v="${i}">${i}</div>`;
    s += `</div>`;
    return s;
  }


  /* ══════════════════════════════════════════════════════════════
     OMBRO
  ══════════════════════════════════════════════════════════════ */
  if (formId === "ombro") {
    const m = await import('./obj/ombro.js');
    m.render(_mskCss, _evaOpts, _mskJs, _abrirBlob);
    return;
  }

  /* ══════════════════════════════════════════════════════════════
     COTOVELO
  ══════════════════════════════════════════════════════════════ */
  if (formId === "cotovelo") {
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
  if (formId === "anca") {
    _abrirBlob(`<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8">
<title>Exame Objectivo — Anca</title><style>${_mskCss}</style></head><body>
<div class="page">
<h1>Exame Objectivo — Anca</h1>
<div class="subtitle">Clique nas opções · Copie para a consulta no final</div>

<div class="sec">
  <div class="sec-title"><div class="num">1</div>Lateralidade &amp; Dor</div>
  <div class="cols2">
    <div><div class="gl">Anca avaliada</div><div class="opts sg" id="lado"><div class="opt" data-v="Direita">Direita</div><div class="opt" data-v="Esquerda">Esquerda</div><div class="opt" data-v="Bilateral">Bilateral</div></div></div>
    <div><div class="gl">Tipo de dor</div><div class="opts sg" id="tipo_dor"><div class="opt" data-v="Mecânica">Mecânica</div><div class="opt" data-v="Inflamatória">Inflamatória</div><div class="opt" data-v="Neuropática">Neuropática</div></div></div>
  </div>
  <div class="sub-title" style="margin-top:14px">EVA</div>
  <div style="display:flex;flex-direction:column;gap:8px;margin-top:6px">
    <div class="eva-row"><span class="eva-lbl">Repouso</span>${_evaOpts("eva_rep")}</div>
    <div class="eva-row"><span class="eva-lbl">Actividade</span>${_evaOpts("eva_act")}</div>
    <div class="eva-row"><span class="eva-lbl">Pico máximo</span>${_evaOpts("eva_pic")}</div>
  </div>
  <div style="margin-top:12px"><div class="gl">Localização da dor</div>
    <div class="opts mg" id="local_dor"><div class="opt" data-v="Virilha">Virilha</div><div class="opt" data-v="Face lateral — grande trocânter">Trocânter</div><div class="opt" data-v="Face posterior — glúteo">Glúteo</div><div class="opt" data-v="Irradiação coxa">Irradiação coxa</div></div>
  </div>
</div>

<div class="sec">
  <div class="sec-title"><div class="num">2</div>Inspeção &amp; Marcha</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">Marcha</div><div class="opts sg" id="marcha"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Claudicação álgica">Claudicação álgica</div><div class="opt" data-v="Trendelenburg">Trendelenburg</div><div class="opt" data-v="Antálgica">Antálgica</div></div></div>
    <div class="param-row"><div class="param-label">Sinal de Trendelenburg</div><div class="opts sg" id="trend"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo">Pos.</div></div></div>
    <div class="param-row"><div class="param-label">Discrepância membros</div><div class="opts sg" id="discr"><div class="opt" data-v="Sem discrepância">Sem discrepância</div><div class="opt" data-v="Encurtamento aparente">Encurtamento aparente</div><div class="opt" data-v="Encurtamento real">Encurtamento real</div></div></div>
  </div>
</div>

<div class="sec">
  <div class="sec-title"><div class="num">3</div>Mobilidade</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">Flexão (ref: 120°)</div><div class="opts sg" id="mob_flex"><div class="opt" data-v="Completa">Completa</div><div class="opt" data-v="Limitada c/ dor">Limitada c/ dor</div><div class="opt" data-v="Limitada s/ dor">Limitada s/ dor</div></div></div>
    <div class="param-row"><div class="param-label">Extensão (ref: 20°)</div><div class="opts sg" id="mob_ext"><div class="opt" data-v="Completa">Completa</div><div class="opt" data-v="Limitada c/ dor">Limitada c/ dor</div><div class="opt" data-v="Limitada s/ dor">Limitada s/ dor</div></div></div>
    <div class="param-row"><div class="param-label">Abdução (ref: 45°)</div><div class="opts sg" id="mob_abd"><div class="opt" data-v="Completa">Completa</div><div class="opt" data-v="Limitada c/ dor">Limitada c/ dor</div><div class="opt" data-v="Limitada s/ dor">Limitada s/ dor</div></div></div>
    <div class="param-row"><div class="param-label">Adução (ref: 30°)</div><div class="opts sg" id="mob_adu"><div class="opt" data-v="Completa">Completa</div><div class="opt" data-v="Limitada c/ dor">Limitada c/ dor</div></div></div>
    <div class="param-row"><div class="param-label">Rotação interna (ref: 45°)</div><div class="opts sg" id="mob_ri"><div class="opt" data-v="Completa">Completa</div><div class="opt" data-v="Limitada c/ dor">Limitada c/ dor</div><div class="opt" data-v="Limitada s/ dor">Limitada s/ dor</div></div></div>
    <div class="param-row"><div class="param-label">Rotação externa (ref: 45°)</div><div class="opts sg" id="mob_re"><div class="opt" data-v="Completa">Completa</div><div class="opt" data-v="Limitada c/ dor">Limitada c/ dor</div><div class="opt" data-v="Limitada s/ dor">Limitada s/ dor</div></div></div>
  </div>
</div>

<div class="sec">
  <div class="sec-title"><div class="num">4</div>Testes Específicos</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">FABER (Patrick)</div><div class="opts sg" id="t_faber"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo — dor virilha">Pos. virilha</div><div class="opt" data-v="Positivo — dor sacroilíaca">Pos. SI</div></div></div>
    <div class="param-row"><div class="param-label">FADIR</div><div class="opts sg" id="t_fadir"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo — conflito FAI">Pos. FAI</div></div></div>
    <div class="param-row"><div class="param-label">Ober (banda iliotibial)</div><div class="opts sg" id="t_ober"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo">Pos.</div></div></div>
    <div class="param-row"><div class="param-label">Thomas (flexores anca)</div><div class="opts sg" id="t_thomas"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo — encurtamento ilipsoas">Pos.</div></div></div>
  </div>
</div>

<div class="sec">
  <div class="sec-title"><div class="num">5</div>Força &amp; Observações</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">Abdutores anca</div><div class="opts sg" id="f_abd"><div class="opt" data-v="5/5">5/5</div><div class="opt" data-v="4/5">4/5</div><div class="opt" data-v="3/5">3/5</div><div class="opt" data-v="2/5">2/5</div></div></div>
    <div class="param-row"><div class="param-label">Glúteo médio</div><div class="opts sg" id="f_glmed"><div class="opt" data-v="5/5">5/5</div><div class="opt" data-v="4/5">4/5</div><div class="opt" data-v="3/5">3/5</div><div class="opt" data-v="2/5">2/5</div></div></div>
  </div>
  <div style="margin-top:12px"><div class="gl">Notas / Conclusão</div><textarea id="notas" placeholder="Conclusão clínica, plano..."></textarea></div>
</div>
</div>
<div id="toast">✓ Copiado — cole na consulta (Ctrl+V)</div>
<div class="bar-acoes"><button class="btn-pdf" id="btnPdf">Imprimir / PDF</button><button class="btn-copy" id="btnCopy">Copiar resumo para consulta</button></div>
<script>
${_mskJs}
window._gerarResumo = function(){
var g=window._getOpt,m=window._getMulti,v=window._getVal,e=window._evaRow;
var L=['── ANCA — EXAME OBJECTIVO ──'];
var lado=g('lado'); if(lado) L.push('Anca '+lado);
var evStr=[e('eva_rep')?'repouso '+e('eva_rep'):'',e('eva_act')?'actividade '+e('eva_act'):'',e('eva_pic')?'pico '+e('eva_pic'):''].filter(Boolean).join(' | ');
if(evStr) L.push('EVA: '+evStr);
var td=g('tipo_dor'); if(td) L.push('Dor: '+td);
var ld=m('local_dor'); if(ld.length) L.push('Localização: '+ld.join(', '));
L.push('');L.push('Marcha:');
[['Padrão',g('marcha')],['Trendelenburg',g('trend')],['Discrepância',g('discr')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
L.push('');L.push('Mobilidade:');
[['Flexão',g('mob_flex')],['Extensão',g('mob_ext')],['Abdução',g('mob_abd')],['Adução',g('mob_adu')],['Rot. interna',g('mob_ri')],['Rot. externa',g('mob_re')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
L.push('');L.push('Testes:');
[['FABER',g('t_faber')],['FADIR',g('t_fadir')],['Ober',g('t_ober')],['Thomas',g('t_thomas')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
L.push('');L.push('Força:');
[['Abdutores',g('f_abd')],['Glúteo médio',g('f_glmed')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
var n=v('notas'); if(n){L.push('');L.push('Notas: '+n);}
L.push('');L.push('──────────────────────────────────────────────────');
return L.join('\\n');
};
</script></body></html>`);
    return;
  }

  /* ══════════════════════════════════════════════════════════════
     JOELHO
  ══════════════════════════════════════════════════════════════ */
  if (formId === "joelho") {
    _abrirBlob(`<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8">
<title>Exame Objectivo — Joelho</title><style>${_mskCss}</style></head><body>
<div class="page">
<h1>Exame Objectivo — Joelho</h1>
<div class="subtitle">Clique nas opções · Copie para a consulta no final</div>

<div class="sec">
  <div class="sec-title"><div class="num">1</div>Lateralidade &amp; Dor</div>
  <div class="cols2">
    <div><div class="gl">Joelho avaliado</div><div class="opts sg" id="lado"><div class="opt" data-v="Direito">Direito</div><div class="opt" data-v="Esquerdo">Esquerdo</div><div class="opt" data-v="Bilateral">Bilateral</div></div></div>
    <div><div class="gl">Tipo de dor</div><div class="opts sg" id="tipo_dor"><div class="opt" data-v="Mecânica">Mecânica</div><div class="opt" data-v="Inflamatória">Inflamatória</div><div class="opt" data-v="Neuropática">Neuropática</div></div></div>
  </div>
  <div class="sub-title" style="margin-top:14px">EVA</div>
  <div style="display:flex;flex-direction:column;gap:8px;margin-top:6px">
    <div class="eva-row"><span class="eva-lbl">Repouso</span>${_evaOpts("eva_rep")}</div>
    <div class="eva-row"><span class="eva-lbl">Actividade</span>${_evaOpts("eva_act")}</div>
    <div class="eva-row"><span class="eva-lbl">Pico máximo</span>${_evaOpts("eva_pic")}</div>
  </div>
  <div style="margin-top:12px"><div class="gl">Localização da dor</div>
    <div class="opts mg" id="local_dor"><div class="opt" data-v="Compartimento medial">Medial</div><div class="opt" data-v="Compartimento lateral">Lateral</div><div class="opt" data-v="Região patelofemoral">Patelofemoral</div><div class="opt" data-v="Tendão rotuliano">Tend. rotuliano</div><div class="opt" data-v="Poplíteo">Poplíteo</div></div>
  </div>
</div>

<div class="sec">
  <div class="sec-title"><div class="num">2</div>Inspeção &amp; Palpação</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">Eixo joelho</div><div class="opts sg" id="insp_eixo"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Varo">Varo</div><div class="opt" data-v="Valgo">Valgo</div></div></div>
    <div class="param-row"><div class="param-label">Edema articular</div><div class="opts sg" id="insp_edema"><div class="opt" data-v="Ausente">Ausente</div><div class="opt" data-v="Ligeiro">Ligeiro</div><div class="opt" data-v="Moderado — derrame articular">Moderado</div><div class="opt" data-v="Volumoso — derrame abundante">Volumoso</div></div></div>
    <div class="param-row"><div class="param-label">Choque rotuliano</div><div class="opts sg" id="choque_rot"><div class="opt" data-v="Ausente">Ausente</div><div class="opt" data-v="Presente">Presente</div></div></div>
    <div class="param-row"><div class="param-label">Interlinha medial</div><div class="opts sg" id="palp_med"><div class="opt" data-v="Indolor">Indolor</div><div class="opt" data-v="Dolorosa">Dolorosa</div></div></div>
    <div class="param-row"><div class="param-label">Interlinha lateral</div><div class="opts sg" id="palp_lat"><div class="opt" data-v="Indolor">Indolor</div><div class="opt" data-v="Dolorosa">Dolorosa</div></div></div>
    <div class="param-row"><div class="param-label">Tendão rotuliano</div><div class="opts sg" id="palp_rot"><div class="opt" data-v="Indolor">Indolor</div><div class="opt" data-v="Doloroso">Doloroso</div></div></div>
    <div class="param-row"><div class="param-label">Tuberosidade tibial anterior</div><div class="opts sg" id="palp_tta"><div class="opt" data-v="Indolor">Indolor</div><div class="opt" data-v="Dolorosa — Osgood-Schlatter?">Dolorosa</div></div></div>
  </div>
</div>

<div class="sec">
  <div class="sec-title"><div class="num">3</div>Mobilidade</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">Flexão (ref: 140°)</div><div class="opts sg" id="mob_flex"><div class="opt" data-v="Completa">Completa</div><div class="opt" data-v="Limitada c/ dor">Limitada c/ dor</div><div class="opt" data-v="Limitada s/ dor">Limitada s/ dor</div></div></div>
    <div class="param-row"><div class="param-label">Extensão (ref: 0°)</div><div class="opts sg" id="mob_ext"><div class="opt" data-v="Completa">Completa</div><div class="opt" data-v="Défice extensão c/ dor">Défice c/ dor</div><div class="opt" data-v="Défice extensão s/ dor">Défice s/ dor</div><div class="opt" data-v="Recurvatum">Recurvatum</div></div></div>
    <div class="param-row"><div class="param-label">Crepitação</div><div class="opts sg" id="mob_crep"><div class="opt" data-v="Ausente">Ausente</div><div class="opt" data-v="Femoropatelar">Femoropatelar</div><div class="opt" data-v="Femorotibial">Femorotibial</div></div></div>
  </div>
</div>

<div class="sec">
  <div class="sec-title"><div class="num">4</div>Testes Específicos</div>
  <div class="sub-title">Ligamentos</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">Lachman (LCA)</div><div class="opts sg" id="t_lach"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo — instabilidade anterior">Pos.</div></div></div>
    <div class="param-row"><div class="param-label">Pivot shift (LCA)</div><div class="opts sg" id="t_pivot"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo">Pos.</div></div></div>
    <div class="param-row"><div class="param-label">Gaveta posterior (LCP)</div><div class="opts sg" id="t_gav"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo — instabilidade posterior">Pos.</div></div></div>
    <div class="param-row"><div class="param-label">Valgo stress (LCM)</div><div class="opts sg" id="t_valgo"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo">Pos.</div></div></div>
    <div class="param-row"><div class="param-label">Varo stress (LCL)</div><div class="opts sg" id="t_varo"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo">Pos.</div></div></div>
  </div>
  <div class="sub-title">Meniscos</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">McMurray</div><div class="opts sg" id="t_mcmur"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo medial">Pos. medial</div><div class="opt" data-v="Positivo lateral">Pos. lateral</div></div></div>
    <div class="param-row"><div class="param-label">Thessaly</div><div class="opts sg" id="t_thess"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo">Pos.</div></div></div>
  </div>
  <div class="sub-title">Patela</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">Clarke (chondromalacia)</div><div class="opts sg" id="t_clark"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo">Pos.</div></div></div>
    <div class="param-row"><div class="param-label">Apprehension patelar</div><div class="opts sg" id="t_appr"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo">Pos.</div></div></div>
  </div>
</div>

<div class="sec">
  <div class="sec-title"><div class="num">5</div>Força &amp; Observações</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">Quadricípite</div><div class="opts sg" id="f_quad"><div class="opt" data-v="5/5">5/5</div><div class="opt" data-v="4/5">4/5</div><div class="opt" data-v="3/5">3/5</div><div class="opt" data-v="2/5">2/5</div></div></div>
    <div class="param-row"><div class="param-label">Isquiotibiais</div><div class="opts sg" id="f_isq"><div class="opt" data-v="5/5">5/5</div><div class="opt" data-v="4/5">4/5</div><div class="opt" data-v="3/5">3/5</div><div class="opt" data-v="2/5">2/5</div></div></div>
  </div>
  <div style="margin-top:12px"><div class="gl">Notas / Conclusão</div><textarea id="notas" placeholder="Conclusão clínica, plano..."></textarea></div>
</div>
</div>
<div id="toast">✓ Copiado — cole na consulta (Ctrl+V)</div>
<div class="bar-acoes"><button class="btn-pdf" id="btnPdf">Imprimir / PDF</button><button class="btn-copy" id="btnCopy">Copiar resumo para consulta</button></div>
<script>
${_mskJs}
window._gerarResumo = function(){
var g=window._getOpt,m=window._getMulti,v=window._getVal,e=window._evaRow;
var L=['── JOELHO — EXAME OBJECTIVO ──'];
var lado=g('lado'); if(lado) L.push('Joelho '+lado);
var evStr=[e('eva_rep')?'repouso '+e('eva_rep'):'',e('eva_act')?'actividade '+e('eva_act'):'',e('eva_pic')?'pico '+e('eva_pic'):''].filter(Boolean).join(' | ');
if(evStr) L.push('EVA: '+evStr);
var td=g('tipo_dor'); if(td) L.push('Dor: '+td);
var ld=m('local_dor'); if(ld.length) L.push('Localização: '+ld.join(', '));
L.push('');L.push('Inspeção/Palpação:');
[['Eixo',g('insp_eixo')],['Edema',g('insp_edema')],['Choque rotuliano',g('choque_rot')],['Interlinha medial',g('palp_med')],['Interlinha lateral',g('palp_lat')],['Tendão rotuliano',g('palp_rot')],['Tuberosidade tibial',g('palp_tta')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
L.push('');L.push('Mobilidade:');
[['Flexão',g('mob_flex')],['Extensão',g('mob_ext')],['Crepitação',g('mob_crep')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
L.push('');L.push('Testes:');
[['Lachman',g('t_lach')],['Pivot shift',g('t_pivot')],['Gaveta posterior',g('t_gav')],['Valgo stress',g('t_valgo')],['Varo stress',g('t_varo')],['McMurray',g('t_mcmur')],['Thessaly',g('t_thess')],['Clarke',g('t_clark')],['Apprehension patelar',g('t_appr')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
L.push('');L.push('Força:');
[['Quadricípite',g('f_quad')],['Isquiotibiais',g('f_isq')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
var n=v('notas'); if(n){L.push('');L.push('Notas: '+n);}
L.push('');L.push('──────────────────────────────────────────────────');
return L.join('\\n');
};
</script></body></html>`);
    return;
  }

  /* ══════════════════════════════════════════════════════════════
     TIBIOTÁRSICA / PÉ
  ══════════════════════════════════════════════════════════════ */
  if (formId === "tibio") {
    _abrirBlob(`<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8">
<title>Exame Objectivo — Tibiotársica / Pé</title><style>${_mskCss}</style></head><body>
<div class="page">
<h1>Exame Objectivo — Tibiotársica / Pé</h1>
<div class="subtitle">Clique nas opções · Copie para a consulta no final</div>

<div class="sec">
  <div class="sec-title"><div class="num">1</div>Lateralidade &amp; Dor</div>
  <div class="cols2">
    <div><div class="gl">Tibiotársica/pé avaliado</div><div class="opts sg" id="lado"><div class="opt" data-v="Direito">Direito</div><div class="opt" data-v="Esquerdo">Esquerdo</div><div class="opt" data-v="Bilateral">Bilateral</div></div></div>
    <div><div class="gl">Tipo de dor</div><div class="opts sg" id="tipo_dor"><div class="opt" data-v="Mecânica">Mecânica</div><div class="opt" data-v="Inflamatória">Inflamatória</div><div class="opt" data-v="Neuropática">Neuropática</div></div></div>
  </div>
  <div class="sub-title" style="margin-top:14px">EVA</div>
  <div style="display:flex;flex-direction:column;gap:8px;margin-top:6px">
    <div class="eva-row"><span class="eva-lbl">Repouso</span>${_evaOpts("eva_rep")}</div>
    <div class="eva-row"><span class="eva-lbl">Actividade</span>${_evaOpts("eva_act")}</div>
    <div class="eva-row"><span class="eva-lbl">Pico máximo</span>${_evaOpts("eva_pic")}</div>
  </div>
  <div style="margin-top:12px"><div class="gl">Localização da dor</div>
    <div class="opts mg" id="local_dor"><div class="opt" data-v="Face anterior tibiotársica">Anterior</div><div class="opt" data-v="Maléolo medial">Maléolo medial</div><div class="opt" data-v="Maléolo lateral">Maléolo lateral</div><div class="opt" data-v="Calcâneo — inserção aquiliana">Calcâneo/aquileu</div><div class="opt" data-v="Plantar — fascia plantar">Fascia plantar</div><div class="opt" data-v="Antepé — metatarsos">Antepé</div></div>
  </div>
</div>

<div class="sec">
  <div class="sec-title"><div class="num">2</div>Inspeção &amp; Palpação</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">Morfologia do arco plantar</div><div class="opts sg" id="insp_arco"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Pé plano">Pé plano</div><div class="opt" data-v="Pé cavo">Pé cavo</div></div></div>
    <div class="param-row"><div class="param-label">Edema</div><div class="opts sg" id="insp_edema"><div class="opt" data-v="Ausente">Ausente</div><div class="opt" data-v="Pré-maleolar">Pré-maleolar</div><div class="opt" data-v="Difuso">Difuso</div></div></div>
    <div class="param-row"><div class="param-label">Tendão aquiliano</div><div class="opts sg" id="palp_aq"><div class="opt" data-v="Indolor">Indolor</div><div class="opt" data-v="Doloroso — corpo tendão">Corpo tendão</div><div class="opt" data-v="Doloroso — inserção">Inserção</div></div></div>
    <div class="param-row"><div class="param-label">Fascia plantar — inserção</div><div class="opts sg" id="palp_fasc"><div class="opt" data-v="Indolor">Indolor</div><div class="opt" data-v="Dolorosa à palpação">Dolorosa</div></div></div>
    <div class="param-row"><div class="param-label">Peroné/maléolo lateral</div><div class="opts sg" id="palp_lat"><div class="opt" data-v="Indolor">Indolor</div><div class="opt" data-v="Doloroso">Doloroso</div></div></div>
  </div>
</div>

<div class="sec">
  <div class="sec-title"><div class="num">3</div>Mobilidade</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">Dorsiflexão (ref: 20°)</div><div class="opts sg" id="mob_dors"><div class="opt" data-v="Completa">Completa</div><div class="opt" data-v="Limitada c/ dor">Limitada c/ dor</div><div class="opt" data-v="Limitada s/ dor">Limitada s/ dor</div></div></div>
    <div class="param-row"><div class="param-label">Flexão plantar (ref: 50°)</div><div class="opts sg" id="mob_plan"><div class="opt" data-v="Completa">Completa</div><div class="opt" data-v="Limitada c/ dor">Limitada c/ dor</div><div class="opt" data-v="Limitada s/ dor">Limitada s/ dor</div></div></div>
    <div class="param-row"><div class="param-label">Inversão / Eversão</div><div class="opts sg" id="mob_inv"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Inversão dolorosa">Inversão dolorosa</div><div class="opt" data-v="Eversão dolorosa">Eversão dolorosa</div><div class="opt" data-v="Ambas dolorosas">Ambas dolorosas</div></div></div>
  </div>
</div>

<div class="sec">
  <div class="sec-title"><div class="num">4</div>Testes Específicos &amp; Força</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">Squeeze test fíbula</div><div class="opts sg" id="t_squeeze"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo — suspeita fractura">Pos.</div></div></div>
    <div class="param-row"><div class="param-label">Thompson (aquileu)</div><div class="opts sg" id="t_thomp"><div class="opt" data-v="Negativo — aquileu íntegro">Neg.</div><div class="opt" data-v="Positivo — suspeita rotura">Pos.</div></div></div>
    <div class="param-row"><div class="param-label">Drawer anterior tíbio-peroneio</div><div class="opts sg" id="t_draw"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo — lesão LPF">Pos.</div></div></div>
    <div class="param-row"><div class="param-label">Stress em inversão (LPF)</div><div class="opts sg" id="t_stress"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo">Pos.</div></div></div>
  </div>
  <div class="sub-title">Força (marcha funcional)</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">Marcha em pontas (S1)</div><div class="opts sg" id="f_pont"><div class="opt" data-v="Normal bilateral">Normal</div><div class="opt" data-v="Dificuldade unilateral">Dificuldade</div><div class="opt" data-v="Incapaz">Incapaz</div></div></div>
    <div class="param-row"><div class="param-label">Marcha em calcanhares (L4–L5)</div><div class="opts sg" id="f_calc"><div class="opt" data-v="Normal bilateral">Normal</div><div class="opt" data-v="Dificuldade unilateral">Dificuldade</div><div class="opt" data-v="Incapaz">Incapaz</div></div></div>
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
var L=['── TIBIOTÁRSICA / PÉ — EXAME OBJECTIVO ──'];
var lado=g('lado'); if(lado) L.push('Tibiotársica/pé '+lado);
var evStr=[e('eva_rep')?'repouso '+e('eva_rep'):'',e('eva_act')?'actividade '+e('eva_act'):'',e('eva_pic')?'pico '+e('eva_pic'):''].filter(Boolean).join(' | ');
if(evStr) L.push('EVA: '+evStr);
var td=g('tipo_dor'); if(td) L.push('Dor: '+td);
var ld=m('local_dor'); if(ld.length) L.push('Localização: '+ld.join(', '));
L.push('');L.push('Inspeção/Palpação:');
[['Arco plantar',g('insp_arco')],['Edema',g('insp_edema')],['Aquileu',g('palp_aq')],['Fascia plantar',g('palp_fasc')],['Maléolo lateral',g('palp_lat')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
L.push('');L.push('Mobilidade:');
[['Dorsiflexão',g('mob_dors')],['Flexão plantar',g('mob_plan')],['Inversão/Eversão',g('mob_inv')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
L.push('');L.push('Testes:');
[['Squeeze fíbula',g('t_squeeze')],['Thompson',g('t_thomp')],['Drawer anterior',g('t_draw')],['Stress inversão',g('t_stress')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
L.push('');L.push('Força:');
[['Pontas (S1)',g('f_pont')],['Calcanhares (L4-L5)',g('f_calc')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
var n=v('notas'); if(n){L.push('');L.push('Notas: '+n);}
L.push('');L.push('──────────────────────────────────────────────────');
return L.join('\\n');
};
</script></body></html>`);
    return;
  }

  /* ══════════════════════════════════════════════════════════════
     COLUNA CERVICAL
  ══════════════════════════════════════════════════════════════ */
  if (formId === "cervical") {
    _abrirBlob(`<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8">
<title>Exame Objectivo — Coluna Cervical</title><style>${_mskCss}</style></head><body>
<div class="page">
<h1>Exame Objectivo — Coluna Cervical</h1>
<div class="subtitle">Clique nas opções · Copie para a consulta no final</div>

<div class="sec">
  <div class="sec-title"><div class="num">1</div>Localização da Dor &amp; Irradiação</div>
  <div class="cols2">
    <div><div class="gl">Localização predominante</div><div class="opts sg" id="local_pred"><div class="opt" data-v="Central">Central</div><div class="opt" data-v="Direita">Direita</div><div class="opt" data-v="Esquerda">Esquerda</div><div class="opt" data-v="Bilateral">Bilateral</div></div></div>
    <div><div class="gl">Tipo de dor</div><div class="opts sg" id="tipo_dor"><div class="opt" data-v="Mecânica">Mecânica</div><div class="opt" data-v="Inflamatória">Inflamatória</div><div class="opt" data-v="Neuropática">Neuropática</div></div></div>
  </div>
  <div class="sub-title" style="margin-top:14px">EVA</div>
  <div style="display:flex;flex-direction:column;gap:8px;margin-top:6px">
    <div class="eva-row"><span class="eva-lbl">Repouso</span>${_evaOpts("eva_rep")}</div>
    <div class="eva-row"><span class="eva-lbl">Actividade</span>${_evaOpts("eva_act")}</div>
    <div class="eva-row"><span class="eva-lbl">Pico máximo</span>${_evaOpts("eva_pic")}</div>
  </div>
  <div style="margin-top:12px"><div class="gl">Irradiação</div>
    <div class="opts mg" id="irrad"><div class="opt" data-v="Sem irradiação">Sem irradiação</div><div class="opt" data-v="Ombro">Ombro</div><div class="opt" data-v="Braço">Braço</div><div class="opt" data-v="Antebraço">Antebraço</div><div class="opt" data-v="Mão / dedos">Mão/dedos</div></div>
  </div>
  <div style="margin-top:10px"><div class="gl">Sintomas neurológicos</div>
    <div class="opts mg" id="sint_neuro"><div class="opt" data-v="Sem sintomas neurológicos">Sem sint. neuro.</div><div class="opt" data-v="Parestesias">Parestesias</div><div class="opt" data-v="Dormência">Dormência</div><div class="opt" data-v="Fraqueza membro">Fraqueza</div><div class="opt" data-v="Cefaleias">Cefaleias</div></div>
  </div>
</div>

<div class="sec">
  <div class="sec-title"><div class="num">2</div>Inspeção &amp; Palpação</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">Postura cabeça</div><div class="opts sg" id="insp_post"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Cabeça anteriorizada">Anteriorizada</div></div></div>
    <div class="param-row"><div class="param-label">Hipercifose dorsal assoc.</div><div class="opts sg" id="insp_cif"><div class="opt" data-v="Sem hipercifose">Sem</div><div class="opt" data-v="Hipercifose dorsal associada">Hipercifose</div></div></div>
    <div class="param-row"><div class="param-label">Musculatura paravertebral cerv.</div><div class="opts sg" id="palp_par"><div class="opt" data-v="Sem dor">Sem dor</div><div class="opt" data-v="Contratura bilateral">Contratura bilateral</div><div class="opt" data-v="Contratura direita">Contratura D</div><div class="opt" data-v="Contratura esquerda">Contratura E</div></div></div>
    <div class="param-row"><div class="param-label">Trapézio superior</div><div class="opts sg" id="palp_trap"><div class="opt" data-v="Indolor">Indolor</div><div class="opt" data-v="Doloroso bilateral">Bilateral</div><div class="opt" data-v="Doloroso direito">D</div><div class="opt" data-v="Doloroso esquerdo">E</div></div></div>
    <div class="param-row"><div class="param-label">Articulações facetárias</div><div class="opts sg" id="palp_fac"><div class="opt" data-v="Indolor">Indolor</div><div class="opt" data-v="Dolorosas">Dolorosas</div></div></div>
  </div>
</div>

<div class="sec">
  <div class="sec-title"><div class="num">3</div>Mobilidade Cervical</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">Flexão (ref: 45°)</div><div class="opts sg" id="mob_flex"><div class="opt" data-v="Completa">Completa</div><div class="opt" data-v="Limitada c/ dor">Limitada c/ dor</div><div class="opt" data-v="Limitada s/ dor">Limitada s/ dor</div></div></div>
    <div class="param-row"><div class="param-label">Extensão (ref: 60°)</div><div class="opts sg" id="mob_ext"><div class="opt" data-v="Completa">Completa</div><div class="opt" data-v="Limitada c/ dor">Limitada c/ dor</div><div class="opt" data-v="Limitada s/ dor">Limitada s/ dor</div></div></div>
    <div class="param-row"><div class="param-label">Rotação D (ref: 80°)</div><div class="opts sg" id="mob_rotd"><div class="opt" data-v="Completa">Completa</div><div class="opt" data-v="Limitada c/ dor">Limitada c/ dor</div><div class="opt" data-v="Limitada s/ dor">Limitada s/ dor</div></div></div>
    <div class="param-row"><div class="param-label">Rotação E (ref: 80°)</div><div class="opts sg" id="mob_rote"><div class="opt" data-v="Completa">Completa</div><div class="opt" data-v="Limitada c/ dor">Limitada c/ dor</div><div class="opt" data-v="Limitada s/ dor">Limitada s/ dor</div></div></div>
    <div class="param-row"><div class="param-label">Inclinação lateral D (ref: 45°)</div><div class="opts sg" id="mob_incd"><div class="opt" data-v="Completa">Completa</div><div class="opt" data-v="Limitada c/ dor">Limitada c/ dor</div></div></div>
    <div class="param-row"><div class="param-label">Inclinação lateral E (ref: 45°)</div><div class="opts sg" id="mob_ince"><div class="opt" data-v="Completa">Completa</div><div class="opt" data-v="Limitada c/ dor">Limitada c/ dor</div></div></div>
  </div>
</div>

<div class="sec">
  <div class="sec-title"><div class="num">4</div>Avaliação Neurológica</div>
  <div class="sub-title">Força (Miotomos)</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">C5 — abdução ombro</div><div class="opts sg" id="f_c5"><div class="opt" data-v="5/5">5/5</div><div class="opt" data-v="4/5">4/5</div><div class="opt" data-v="3/5">3/5</div><div class="opt" data-v="2/5">2/5</div></div></div>
    <div class="param-row"><div class="param-label">C6 — flexão cotovelo</div><div class="opts sg" id="f_c6"><div class="opt" data-v="5/5">5/5</div><div class="opt" data-v="4/5">4/5</div><div class="opt" data-v="3/5">3/5</div><div class="opt" data-v="2/5">2/5</div></div></div>
    <div class="param-row"><div class="param-label">C7 — extensão cotovelo</div><div class="opts sg" id="f_c7"><div class="opt" data-v="5/5">5/5</div><div class="opt" data-v="4/5">4/5</div><div class="opt" data-v="3/5">3/5</div><div class="opt" data-v="2/5">2/5</div></div></div>
    <div class="param-row"><div class="param-label">C8 — flexão dedos</div><div class="opts sg" id="f_c8"><div class="opt" data-v="5/5">5/5</div><div class="opt" data-v="4/5">4/5</div><div class="opt" data-v="3/5">3/5</div><div class="opt" data-v="2/5">2/5</div></div></div>
    <div class="param-row"><div class="param-label">T1 — interósseos</div><div class="opts sg" id="f_t1"><div class="opt" data-v="5/5">5/5</div><div class="opt" data-v="4/5">4/5</div><div class="opt" data-v="3/5">3/5</div><div class="opt" data-v="2/5">2/5</div></div></div>
  </div>
  <div class="sub-title">Sensibilidade (Dermátomos)</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">C5 — face lateral braço</div><div class="opts sg" id="s_c5"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Diminuída">Diminuída</div><div class="opt" data-v="Ausente">Ausente</div></div></div>
    <div class="param-row"><div class="param-label">C6 — polegar</div><div class="opts sg" id="s_c6"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Diminuída">Diminuída</div><div class="opt" data-v="Ausente">Ausente</div></div></div>
    <div class="param-row"><div class="param-label">C7 — dedo médio</div><div class="opts sg" id="s_c7"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Diminuída">Diminuída</div><div class="opt" data-v="Ausente">Ausente</div></div></div>
    <div class="param-row"><div class="param-label">C8 — 5º dedo</div><div class="opts sg" id="s_c8"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Diminuída">Diminuída</div><div class="opt" data-v="Ausente">Ausente</div></div></div>
  </div>
</div>


<!-- RED FLAGS -->
<div class="sec" style="border:1px solid #fecaca;background:#fff;">
  <div class="sec-title" style="color:#dc2626;border-color:#fecaca;"><div class="num" style="background:#dc2626;">!</div>Red Flags — Alerta Clínico</div>
  <div id="cerv_rf_warn" class="rf-warn">⚠️ Red flag presente — investigar / referenciar urgente</div>
  <div class="param-grid">
    <div class="rf-row"><input type="checkbox" class="rf-cb" data-rf="Febre" id="crf1"><label class="rf-lbl" for="crf1">Febre</label><span class="rf-tip" data-tip="Suspeita infecção vertebral / neoplasia">i</span></div>
    <div class="rf-row"><input type="checkbox" class="rf-cb" data-rf="Perda ponderal inexplicada" id="crf2"><label class="rf-lbl" for="crf2">Perda ponderal inexplicada</label><span class="rf-tip" data-tip="Neoplasia — investigar">i</span></div>
    <div class="rf-row"><input type="checkbox" class="rf-cb" data-rf="História de neoplasia" id="crf3"><label class="rf-lbl" for="crf3">História de neoplasia</label><span class="rf-tip" data-tip="Métastases vertebrais">i</span></div>
    <div class="rf-row"><input type="checkbox" class="rf-cb" data-rf="Trauma significativo" id="crf4"><label class="rf-lbl" for="crf4">Trauma significativo</label><span class="rf-tip" data-tip="Fractura vertebral — Rx urgente">i</span></div>
    <div class="rf-row"><input type="checkbox" class="rf-cb" data-rf="Dor noturna persistente" id="crf5"><label class="rf-lbl" for="crf5">Dor noturna persistente</label><span class="rf-tip" data-tip="Neoplasia / espondilodiscite">i</span></div>
    <div class="rf-row"><input type="checkbox" class="rf-cb" data-rf="Défice neurológico progressivo" id="crf6"><label class="rf-lbl" for="crf6">Défice neurológico progressivo</label><span class="rf-tip" data-tip="Compressão medular — urgente">i</span></div>
    <div class="rf-row"><input type="checkbox" class="rf-cb" data-rf="Incontinência urinária ou fecal" id="crf7"><label class="rf-lbl" for="crf7">Incontinência urinária / fecal</label><span class="rf-tip" data-tip="Síndrome cauda equina — emergência">i</span></div>
    <div class="rf-row"><input type="checkbox" class="rf-cb" data-rf="Anestesia em sela" id="crf8"><label class="rf-lbl" for="crf8">Anestesia em sela</label><span class="rf-tip" data-tip="Síndrome cauda equina — emergência">i</span></div>
    <div class="rf-row"><input type="checkbox" class="rf-cb" data-rf="Suspeita de infecção vertebral" id="crf9"><label class="rf-lbl" for="crf9">Suspeita de infecção vertebral</label><span class="rf-tip" data-tip="Espondilodiscite — antibioterapia / cirurgia">i</span></div>
  </div>
</div>
<div class="sec">
  <div class="sec-title"><div class="num">5</div>Testes Específicos &amp; Observações</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">Spurling</div><div class="opts sg" id="t_spur"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo D">Pos. D</div><div class="opt" data-v="Positivo E">Pos. E</div></div></div>
    <div class="param-row"><div class="param-label">Distração cervical</div><div class="opts sg" id="t_distr"><div class="opt" data-v="Sem alívio">Sem alívio</div><div class="opt" data-v="Alívio com distracção">Alívio c/ distracção</div></div></div>
    <div class="param-row"><div class="param-label">Compressão foraminal</div><div class="opts sg" id="t_foram"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo — reproduz irradiação">Pos.</div></div></div>
  </div>
  <div style="margin-top:12px"><div class="gl">Notas / Conclusão</div><textarea id="notas" placeholder="Ex: radiculopatia C6 direita, síndrome cervical miofascial..."></textarea></div>
</div>
</div>
<div id="toast">✓ Copiado — cole na consulta (Ctrl+V)</div>
<div class="bar-acoes"><button class="btn-pdf" id="btnPdf">Imprimir / PDF</button><button class="btn-copy" id="btnCopy">Copiar resumo para consulta</button></div>
<script>
${_mskJs}
window._gerarResumo = function(){
var g=window._getOpt,m=window._getMulti,v=window._getVal,e=window._evaRow;
var L=['── COLUNA CERVICAL — EXAME OBJECTIVO ──'];
var lp=g('local_pred'); if(lp) L.push('Localização: '+lp);
var evStr=[e('eva_rep')?'repouso '+e('eva_rep'):'',e('eva_act')?'actividade '+e('eva_act'):'',e('eva_pic')?'pico '+e('eva_pic'):''].filter(Boolean).join(' | ');
if(evStr) L.push('EVA: '+evStr);
var td=g('tipo_dor'); if(td) L.push('Dor: '+td);
var ir=m('irrad'); if(ir.length) L.push('Irradiação: '+ir.join(', '));
var sn=m('sint_neuro'); if(sn.length) L.push('Sint. neurológicos: '+sn.join(', '));
var rf=(typeof window.getRF==='function'?window.getRF():[]).filter(function(x){return x;}); if(rf.length){L.push('');L.push('RED FLAGS: '+rf.join(', '));}
L.push('');L.push('Inspeção/Palpação:');
[['Postura',g('insp_post')],['Hipercifose',g('insp_cif')],['Paravertebral cerv.',g('palp_par')],['Trapézio',g('palp_trap')],['Facetárias',g('palp_fac')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
L.push('');L.push('Mobilidade:');
[['Flexão',g('mob_flex')],['Extensão',g('mob_ext')],['Rotação D',g('mob_rotd')],['Rotação E',g('mob_rote')],['Inclinação D',g('mob_incd')],['Inclinação E',g('mob_ince')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
L.push('');L.push('Força (miotomos):');
[['C5 (abd. ombro)',g('f_c5')],['C6 (flex. cotov.)',g('f_c6')],['C7 (ext. cotov.)',g('f_c7')],['C8 (flex. dedos)',g('f_c8')],['T1 (interósseos)',g('f_t1')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
L.push('');L.push('Sensibilidade (dermátomos):');
[['C5',g('s_c5')],['C6',g('s_c6')],['C7',g('s_c7')],['C8',g('s_c8')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
L.push('');L.push('Testes:');
[['Spurling',g('t_spur')],['Distracção',g('t_distr')],['Compressão foraminal',g('t_foram')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
var n=v('notas'); if(n){L.push('');L.push('Conclusão: '+n);}
L.push('');L.push('──────────────────────────────────────────────────');
return L.join('\\n');
};
</script></body></html>`);
    return;
  }

  /* ══════════════════════════════════════════════════════════════
     COLUNA LOMBAR
  ══════════════════════════════════════════════════════════════ */
  if (formId === "lombar") {
    _abrirBlob(`<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8">
<title>Exame Objectivo — Coluna Lombar</title><style>${_mskCss}</style></head><body>
<div class="page">
<h1>Exame Objectivo — Coluna Lombar</h1>
<div class="subtitle">Clique nas opções · Copie para a consulta no final</div>

<div class="sec">
  <div class="sec-title"><div class="num">1</div>Localização da Dor &amp; Irradiação</div>
  <div class="cols2">
    <div><div class="gl">Localização</div><div class="opts sg" id="local_pred"><div class="opt" data-v="Central">Central</div><div class="opt" data-v="Lombar direita">Lombar D</div><div class="opt" data-v="Lombar esquerda">Lombar E</div><div class="opt" data-v="Bilateral">Bilateral</div></div></div>
    <div><div class="gl">Tipo de dor</div><div class="opts sg" id="tipo_dor"><div class="opt" data-v="Mecânica">Mecânica</div><div class="opt" data-v="Inflamatória">Inflamatória</div><div class="opt" data-v="Neuropática">Neuropática</div></div></div>
  </div>
  <div class="sub-title" style="margin-top:14px">EVA</div>
  <div style="display:flex;flex-direction:column;gap:8px;margin-top:6px">
    <div class="eva-row"><span class="eva-lbl">Repouso</span>${_evaOpts("eva_rep")}</div>
    <div class="eva-row"><span class="eva-lbl">Actividade</span>${_evaOpts("eva_act")}</div>
    <div class="eva-row"><span class="eva-lbl">Pico máximo</span>${_evaOpts("eva_pic")}</div>
  </div>
  <div style="margin-top:12px"><div class="gl">Irradiação</div>
    <div class="opts mg" id="irrad"><div class="opt" data-v="Sem irradiação">Sem irradiação</div><div class="opt" data-v="Glúteo">Glúteo</div><div class="opt" data-v="Coxa">Coxa</div><div class="opt" data-v="Perna">Perna</div><div class="opt" data-v="Pé">Pé</div></div>
  </div>
  <div style="margin-top:10px"><div class="gl">Sintomas neurológicos</div>
    <div class="opts mg" id="sint_neuro"><div class="opt" data-v="Sem sintomas neurológicos">Sem sint. neuro.</div><div class="opt" data-v="Parestesias">Parestesias</div><div class="opt" data-v="Dormência">Dormência</div><div class="opt" data-v="Fraqueza membro inferior">Fraqueza MI</div><div class="opt" data-v="Disfunção esfincteriana — urgente">Disfunção esfinc.</div></div>
  </div>
</div>

<div class="sec">
  <div class="sec-title"><div class="num">2</div>Inspeção &amp; Palpação</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">Coluna sagital</div><div class="opts mg" id="insp_sag"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Hiperlordose lombar">Hiperlordose</div><div class="opt" data-v="Rectificação lombar">Rectificação</div><div class="opt" data-v="Cifose lombar">Cifose</div></div></div>
    <div class="param-row"><div class="param-label">Escoliose</div><div class="opts sg" id="insp_escol"><div class="opt" data-v="Sem escoliose">Sem</div><div class="opt" data-v="Escoliose postural">Postural</div><div class="opt" data-v="Escoliose estrutural">Estrutural</div></div></div>
    <div class="param-row"><div class="param-label">Postura antálgica</div><div class="opts sg" id="insp_antal"><div class="opt" data-v="Ausente">Ausente</div><div class="opt" data-v="Presente — inclinação lateral">Inclinação lateral</div></div></div>
    <div class="param-row"><div class="param-label">Espinhosas lombares</div><div class="opts sg" id="palp_esp"><div class="opt" data-v="Indolores">Indolores</div><div class="opt" data-v="Dolorosas">Dolorosas</div></div></div>
    <div class="param-row"><div class="param-label">Paravertebral lombar</div><div class="opts sg" id="palp_par"><div class="opt" data-v="Sem dor">Sem dor</div><div class="opt" data-v="Contratura bilateral">Contratura bilateral</div><div class="opt" data-v="Contratura direita">Contratura D</div><div class="opt" data-v="Contratura esquerda">Contratura E</div></div></div>
    <div class="param-row"><div class="param-label">Sacroilíacas</div><div class="opts sg" id="palp_si"><div class="opt" data-v="Indolores">Indolores</div><div class="opt" data-v="Dolorosa direita">Dolorosa D</div><div class="opt" data-v="Dolorosa esquerda">Dolorosa E</div><div class="opt" data-v="Bilateral">Bilateral</div></div></div>
  </div>
</div>

<div class="sec">
  <div class="sec-title"><div class="num">3</div>Mobilidade Lombar</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">Flexão — Schober</div><div class="opts sg" id="mob_flex"><div class="opt" data-v="Normal (&gt;5cm)">Normal (&gt;5cm)</div><div class="opt" data-v="Ligeiramente limitada (3-5cm)">Ligeira (3-5cm)</div><div class="opt" data-v="Moderadamente limitada (1-3cm)">Moderada (1-3cm)</div><div class="opt" data-v="Muito limitada (&lt;1cm)">Muito limitada</div></div></div>
    <div class="param-row"><div class="param-label">Extensão</div><div class="opts sg" id="mob_ext"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Limitada c/ dor">Limitada c/ dor</div><div class="opt" data-v="Limitada s/ dor">Limitada s/ dor</div></div></div>
    <div class="param-row"><div class="param-label">Inclinação lateral D</div><div class="opts sg" id="mob_incd"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Limitada c/ dor">Limitada c/ dor</div></div></div>
    <div class="param-row"><div class="param-label">Inclinação lateral E</div><div class="opts sg" id="mob_ince"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Limitada c/ dor">Limitada c/ dor</div></div></div>
  </div>
</div>

<div class="sec">
  <div class="sec-title"><div class="num">4</div>Avaliação Neurológica</div>
  <div class="sub-title">Força (Miotomos)</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">L2 — flexão anca</div><div class="opts sg" id="f_l2"><div class="opt" data-v="5/5">5/5</div><div class="opt" data-v="4/5">4/5</div><div class="opt" data-v="3/5">3/5</div><div class="opt" data-v="2/5">2/5</div></div></div>
    <div class="param-row"><div class="param-label">L3 — extensão joelho</div><div class="opts sg" id="f_l3"><div class="opt" data-v="5/5">5/5</div><div class="opt" data-v="4/5">4/5</div><div class="opt" data-v="3/5">3/5</div><div class="opt" data-v="2/5">2/5</div></div></div>
    <div class="param-row"><div class="param-label">L4 — dorsiflexão pé</div><div class="opts sg" id="f_l4"><div class="opt" data-v="5/5">5/5</div><div class="opt" data-v="4/5">4/5</div><div class="opt" data-v="3/5">3/5</div><div class="opt" data-v="2/5">2/5</div></div></div>
    <div class="param-row"><div class="param-label">L5 — extensão hálux</div><div class="opts sg" id="f_l5"><div class="opt" data-v="5/5">5/5</div><div class="opt" data-v="4/5">4/5</div><div class="opt" data-v="3/5">3/5</div><div class="opt" data-v="2/5">2/5</div></div></div>
    <div class="param-row"><div class="param-label">S1 — flexão plantar</div><div class="opts sg" id="f_s1"><div class="opt" data-v="5/5">5/5</div><div class="opt" data-v="4/5">4/5</div><div class="opt" data-v="3/5">3/5</div><div class="opt" data-v="2/5">2/5</div></div></div>
  </div>
  <div class="sub-title">Sensibilidade (Dermátomos)</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">L3 — joelho medial</div><div class="opts sg" id="s_l3"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Diminuída">Diminuída</div><div class="opt" data-v="Ausente">Ausente</div></div></div>
    <div class="param-row"><div class="param-label">L4 — face medial perna</div><div class="opts sg" id="s_l4"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Diminuída">Diminuída</div><div class="opt" data-v="Ausente">Ausente</div></div></div>
    <div class="param-row"><div class="param-label">L5 — dorso do pé</div><div class="opts sg" id="s_l5"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Diminuída">Diminuída</div><div class="opt" data-v="Ausente">Ausente</div></div></div>
    <div class="param-row"><div class="param-label">S1 — face lateral pé</div><div class="opts sg" id="s_s1"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Diminuída">Diminuída</div><div class="opt" data-v="Ausente">Ausente</div></div></div>
  </div>
  <div class="sub-title">Marcha Neurológica</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">Marcha em pontas (S1)</div><div class="opts sg" id="marcha_pont"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Dificuldade">Dificuldade</div><div class="opt" data-v="Incapaz">Incapaz</div></div></div>
    <div class="param-row"><div class="param-label">Marcha em calcanhares (L4–L5)</div><div class="opts sg" id="marcha_calc"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Dificuldade">Dificuldade</div><div class="opt" data-v="Incapaz">Incapaz</div></div></div>
  </div>
</div>


<!-- RED FLAGS -->
<div class="sec" style="border:1px solid #fecaca;background:#fff;">
  <div class="sec-title" style="color:#dc2626;border-color:#fecaca;"><div class="num" style="background:#dc2626;">!</div>Red Flags — Alerta Clínico</div>
  <div id="lomb_rf_warn" class="rf-warn">⚠️ Red flag presente — investigar / referenciar urgente</div>
  <div class="param-grid">
    <div class="rf-row"><input type="checkbox" class="rf-cb" data-rf="Febre" id="lrf1"><label class="rf-lbl" for="lrf1">Febre</label><span class="rf-tip" data-tip="Suspeita infecção vertebral / neoplasia">i</span></div>
    <div class="rf-row"><input type="checkbox" class="rf-cb" data-rf="Perda ponderal inexplicada" id="lrf2"><label class="rf-lbl" for="lrf2">Perda ponderal inexplicada</label><span class="rf-tip" data-tip="Neoplasia — investigar">i</span></div>
    <div class="rf-row"><input type="checkbox" class="rf-cb" data-rf="História de neoplasia" id="lrf3"><label class="rf-lbl" for="lrf3">História de neoplasia</label><span class="rf-tip" data-tip="Métastases vertebrais">i</span></div>
    <div class="rf-row"><input type="checkbox" class="rf-cb" data-rf="Trauma significativo" id="lrf4"><label class="rf-lbl" for="lrf4">Trauma significativo</label><span class="rf-tip" data-tip="Fractura vertebral — Rx urgente">i</span></div>
    <div class="rf-row"><input type="checkbox" class="rf-cb" data-rf="Dor noturna persistente" id="lrf5"><label class="rf-lbl" for="lrf5">Dor noturna persistente</label><span class="rf-tip" data-tip="Neoplasia / espondilodiscite">i</span></div>
    <div class="rf-row"><input type="checkbox" class="rf-cb" data-rf="Défice neurológico progressivo" id="lrf6"><label class="rf-lbl" for="lrf6">Défice neurológico progressivo</label><span class="rf-tip" data-tip="Compressão medular — urgente">i</span></div>
    <div class="rf-row"><input type="checkbox" class="rf-cb" data-rf="Incontinência urinária ou fecal" id="lrf7"><label class="rf-lbl" for="lrf7">Incontinência urinária / fecal</label><span class="rf-tip" data-tip="Síndrome cauda equina — emergência">i</span></div>
    <div class="rf-row"><input type="checkbox" class="rf-cb" data-rf="Anestesia em sela" id="lrf8"><label class="rf-lbl" for="lrf8">Anestesia em sela</label><span class="rf-tip" data-tip="Síndrome cauda equina — emergência">i</span></div>
    <div class="rf-row"><input type="checkbox" class="rf-cb" data-rf="Suspeita de infecção vertebral" id="lrf9"><label class="rf-lbl" for="lrf9">Suspeita de infecção vertebral</label><span class="rf-tip" data-tip="Espondilodiscite — antibioterapia / cirurgia">i</span></div>
  </div>
</div>
<div class="sec">
  <div class="sec-title"><div class="num">5</div>Testes Específicos &amp; Observações</div>
  <div class="param-grid">
    <div class="param-row"><div class="param-label">Lasègue D (elevação perna)</div><div class="opts sg" id="t_las_d"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo &lt;30°">Pos. &lt;30°</div><div class="opt" data-v="Positivo 30°–60°">Pos. 30-60°</div><div class="opt" data-v="Positivo &gt;60°">Pos. &gt;60°</div></div></div>
    <div class="param-row"><div class="param-label">Lasègue E (elevação perna)</div><div class="opts sg" id="t_las_e"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo &lt;30°">Pos. &lt;30°</div><div class="opt" data-v="Positivo 30°–60°">Pos. 30-60°</div><div class="opt" data-v="Positivo &gt;60°">Pos. &gt;60°</div></div></div>
    <div class="param-row"><div class="param-label">Slump test</div><div class="opts sg" id="t_slump"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo">Pos.</div></div></div>
    <div class="param-row"><div class="param-label">FABER (articulação sacroilíaca)</div><div class="opts sg" id="t_faber"><div class="opt" data-v="Negativo">Neg.</div><div class="opt" data-v="Positivo — dor SI">Pos.</div></div></div>
  </div>
  <div style="margin-top:12px"><div class="gl">Notas / Conclusão</div><textarea id="notas" placeholder="Ex: radiculopatia L5 direita, lombalgia mecânica inespecífica, espondiloartrose L4-L5..."></textarea></div>
</div>
</div>
<div id="toast">✓ Copiado — cole na consulta (Ctrl+V)</div>
<div class="bar-acoes"><button class="btn-pdf" id="btnPdf">Imprimir / PDF</button><button class="btn-copy" id="btnCopy">Copiar resumo para consulta</button></div>
<script>
${_mskJs}
window._gerarResumo = function(){
var g=window._getOpt,m=window._getMulti,v=window._getVal,e=window._evaRow;
var L=['── COLUNA LOMBAR — EXAME OBJECTIVO ──'];
var lp=g('local_pred'); if(lp) L.push('Localização: '+lp);
var evStr=[e('eva_rep')?'repouso '+e('eva_rep'):'',e('eva_act')?'actividade '+e('eva_act'):'',e('eva_pic')?'pico '+e('eva_pic'):''].filter(Boolean).join(' | ');
if(evStr) L.push('EVA: '+evStr);
var td=g('tipo_dor'); if(td) L.push('Dor: '+td);
var ir=m('irrad'); if(ir.length) L.push('Irradiação: '+ir.join(', '));
var sn=m('sint_neuro'); if(sn.length) L.push('Sint. neurológicos: '+sn.join(', '));
var rf=(typeof window.getRF==='function'?window.getRF():[]).filter(function(x){return x;}); if(rf.length){L.push('');L.push('RED FLAGS: '+rf.join(', '));}
L.push('');L.push('Inspeção/Palpação:');
[['Coluna sagital',m('insp_sag').join(', ')],['Escoliose',g('insp_escol')],['Postura antálgica',g('insp_antal')],['Espinhosas',g('palp_esp')],['Paravertebral',g('palp_par')],['Sacroilíacas',g('palp_si')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
L.push('');L.push('Mobilidade:');
[['Flexão — Schober',g('mob_flex')],['Extensão',g('mob_ext')],['Inclinação D',g('mob_incd')],['Inclinação E',g('mob_ince')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
L.push('');L.push('Força (miotomos):');
[['L2 (flex. anca)',g('f_l2')],['L3 (ext. joelho)',g('f_l3')],['L4 (dorsiflexão)',g('f_l4')],['L5 (ext. hálux)',g('f_l5')],['S1 (flex. plantar)',g('f_s1')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
L.push('');L.push('Sensibilidade (dermátomos):');
[['L3',g('s_l3')],['L4',g('s_l4')],['L5',g('s_l5')],['S1',g('s_s1')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
L.push('');L.push('Marcha:');
[['Pontas (S1)',g('marcha_pont')],['Calcanhares (L4-L5)',g('marcha_calc')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
L.push('');L.push('Testes:');
[['Lasègue D',g('t_las_d')],['Lasègue E',g('t_las_e')],['Slump',g('t_slump')],['FABER',g('t_faber')]].forEach(function(p){if(p[1])L.push('  • '+p[0]+': '+p[1]);});
var n=v('notas'); if(n){L.push('');L.push('Conclusão: '+n);}
L.push('');L.push('──────────────────────────────────────────────────');
return L.join('\\n');
};
</script></body></html>`);
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
