/* ========================================================
   escalas.js — Escalas Funcionais MFR
   Abre numa janela blob (padrão exames objectivos)
   --------------------------------------------------------
   Exporta: openEscalaFuncional()
   ======================================================== */

function _abrirBlob(htmlStr) {
  const blob = new Blob([htmlStr], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  window.open(url, "_blank", "width=1060,height=860,scrollbars=yes");
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function openEscalaFuncional() {
  _abrirBlob(_escalasBlobHtml());
}

function _escalasBlobHtml() {
  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Escalas Funcionais — MFR</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;background:#f8fafc;color:#1a1a1a;padding:1rem 1rem 80px}
h1{font-size:17px;font-weight:700;color:#0f172a;margin-bottom:1.25rem;padding-bottom:0.75rem;border-bottom:1px solid #e2e8f0}
.patient-row{display:flex;gap:10px;margin-bottom:1.25rem;flex-wrap:wrap}
.patient-row .field{display:flex;flex-direction:column;gap:3px}
.patient-row label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:#64748b}
.patient-row input{flex:1;min-width:140px;font-size:13px;padding:6px 10px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;color:#1a1a1a}
.tabs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:1.25rem}
.tab{padding:6px 14px;font-size:13px;border:1px solid #e2e8f0;border-radius:8px;cursor:pointer;background:#fff;color:#555;transition:all 0.15s;font-family:inherit}
.tab.active{background:#e8f0fb;color:#1a56c4;border-color:#1a56c4;font-weight:600}
.tab:hover:not(.active){background:#f1f5f9}
.scale-panel{display:none}
.scale-panel.active{display:block}
.scale-title{font-size:15px;font-weight:600;color:#0f172a;margin-bottom:3px}
.scale-desc{font-size:12px;color:#64748b;margin-bottom:1rem}
.question{background:#f8fafc;border:1px solid #f1f5f9;border-radius:8px;padding:12px 14px;margin-bottom:8px}
.question.answered{background:#eff6ff;border-color:#dbeafe}
.q-text{font-size:13px;color:#1a1a1a;margin-bottom:8px;line-height:1.5}
.options{display:flex;flex-direction:column;gap:5px}
.opt{display:flex;align-items:flex-start;gap:8px;cursor:pointer}
.opt input[type=radio]{margin-top:2px;cursor:pointer;accent-color:#1a56db}
.opt-label{font-size:13px;color:#374151;line-height:1.4;cursor:pointer}
.result-bar{background:#f1f5f9;border-radius:10px;padding:12px 16px;margin-top:1rem;border:1px solid #e2e8f0}
.result-score{font-size:26px;font-weight:600;color:#0f172a}
.result-interp{font-size:13px;margin-top:5px;font-weight:600}
.result-interp.good{color:#16a34a}
.result-interp.moderate{color:#d97706}
.result-interp.severe{color:#dc2626}
.progress{height:5px;background:#e2e8f0;border-radius:3px;margin-top:8px;overflow:hidden}
.progress-fill{height:100%;border-radius:3px;transition:width 0.3s}
.btn-row{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
.btn{font-size:12px;padding:6px 14px;border:1px solid #e2e8f0;border-radius:7px;background:#fff;cursor:pointer;color:#374151;font-family:inherit}
.btn:hover{background:#f1f5f9}
.btn-copy{border-color:#1a56db;color:#1a56db;background:#eff6ff}
.btn-copy:hover{opacity:0.85}
.btn-copy.ok{border-color:#16a34a;color:#16a34a;background:#f0fdf4}
.answered-count{font-size:11px;color:#94a3b8;margin-top:6px}
.section-sep{font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;margin:1rem 0 5px}

/* Barra de ações fixa em baixo */
.bar-acoes{
  position:fixed;bottom:0;left:0;right:0;
  background:#fff;border-top:1px solid #e2e8f0;
  padding:10px 20px;display:flex;align-items:center;justify-content:space-between;gap:10px;
  box-shadow:0 -4px 16px rgba(0,0,0,0.06);z-index:100;
}
.bar-acoes .bar-left{font-size:13px;color:#64748b}
.bar-acoes .bar-left span{font-weight:600;color:#0f172a}
.btn-pdf{font-size:13px;padding:8px 18px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;cursor:pointer;color:#374151;font-family:inherit}
.btn-pdf:hover{background:#f1f5f9}
.btn-copy-all{font-size:13px;padding:8px 20px;border:1px solid #1a56db;border-radius:8px;background:#1a56db;cursor:pointer;color:#fff;font-weight:600;font-family:inherit}
.btn-copy-all:hover{opacity:0.9}
.btn-copy-all.ok{background:#16a34a;border-color:#16a34a}

/* Print */
@media print {
  .bar-acoes,.tabs,.btn-row{display:none!important}
  body{background:#fff;padding:0}
  .scale-panel{display:block!important}
  .scale-panel:not(.active){margin-top:2rem;padding-top:1rem;border-top:2px solid #e2e8f0}
  .question{break-inside:avoid}
}
</style>
</head>
<body>

<h1>Escalas Funcionais — Medicina Física e de Reabilitação</h1>

<div class="patient-row">
  <div class="field"><label>Nome do doente</label><input id="pt-name" placeholder="Nome completo" /></div>
  <div class="field"><label>Nº processo</label><input id="pt-proc" placeholder="Nº processo" style="max-width:140px"/></div>
  <div class="field"><label>Data de avaliação</label><input id="pt-date" type="date" style="max-width:160px"/></div>
</div>

<div class="tabs" id="tabs"></div>
<div id="panels"></div>

<div class="bar-acoes">
  <div class="bar-left">Escalas preenchidas: <span id="bar-summary">—</span></div>
  <div style="display:flex;gap:8px">
    <button class="btn-pdf" id="btnPdf">Imprimir / PDF</button>
    <button class="btn-copy-all" id="btnCopyAll">Copiar para consulta</button>
  </div>
</div>

<script>
// ── Auto-preencher dados do doente a partir da janela pai ──
(function(){
  try {
    const op = window.opener;
    if (!op) return;
    const G = op.G || op.__gc_G;
    const p = G && (G.currentPatient || G.doente || G.patient);
    if (p) {
      const nome = p.name || p.nome || p.full_name || '';
      const proc = p.process_number || p.numero_processo || p.id || '';
      if (nome) document.getElementById('pt-name').value = nome;
      if (proc) document.getElementById('pt-proc').value = String(proc);
    }
  } catch(e) {}
  document.getElementById('pt-date').value = new Date().toISOString().split('T')[0];
})();

// ── Dados das escalas ──
const scales=[
  {id:"dash",name:"DASH",full:"DASH — Disabilities of the Arm, Shoulder and Hand",region:"Membro superior",items:30,maxScore:100,higherWorse:true,
    interpret:s=>s<=20?["Incapacidade ligeira","good"]:s<=40?["Incapacidade moderada","moderate"]:s<=60?["Incapacidade moderada-grave","moderate"]:["Incapacidade grave","severe"],
    questions:[
      {text:"Abrir um frasco novo ou com tampa apertada",opts:["Sem dificuldade","Dificuldade ligeira","Dificuldade moderada","Dificuldade grave","Incapaz"]},
      {text:"Escrever",opts:["Sem dificuldade","Dificuldade ligeira","Dificuldade moderada","Dificuldade grave","Incapaz"]},
      {text:"Rodar uma chave",opts:["Sem dificuldade","Dificuldade ligeira","Dificuldade moderada","Dificuldade grave","Incapaz"]},
      {text:"Preparar uma refeição",opts:["Sem dificuldade","Dificuldade ligeira","Dificuldade moderada","Dificuldade grave","Incapaz"]},
      {text:"Empurrar ou abrir uma porta pesada",opts:["Sem dificuldade","Dificuldade ligeira","Dificuldade moderada","Dificuldade grave","Incapaz"]},
      {text:"Colocar um objeto numa prateleira acima da cabeça",opts:["Sem dificuldade","Dificuldade ligeira","Dificuldade moderada","Dificuldade grave","Incapaz"]},
      {text:"Tarefas domésticas pesadas",opts:["Sem dificuldade","Dificuldade ligeira","Dificuldade moderada","Dificuldade grave","Incapaz"]},
      {text:"Jardinagem ou trabalho no jardim",opts:["Sem dificuldade","Dificuldade ligeira","Dificuldade moderada","Dificuldade grave","Incapaz"]},
      {text:"Fazer a cama",opts:["Sem dificuldade","Dificuldade ligeira","Dificuldade moderada","Dificuldade grave","Incapaz"]},
      {text:"Carregar um saco de compras ou uma pasta",opts:["Sem dificuldade","Dificuldade ligeira","Dificuldade moderada","Dificuldade grave","Incapaz"]},
      {text:"Carregar um objeto pesado (mais de 5 kg)",opts:["Sem dificuldade","Dificuldade ligeira","Dificuldade moderada","Dificuldade grave","Incapaz"]},
      {text:"Mudar uma lâmpada acima da cabeça",opts:["Sem dificuldade","Dificuldade ligeira","Dificuldade moderada","Dificuldade grave","Incapaz"]},
      {text:"Lavar ou secar o cabelo",opts:["Sem dificuldade","Dificuldade ligeira","Dificuldade moderada","Dificuldade grave","Incapaz"]},
      {text:"Lavar as costas",opts:["Sem dificuldade","Dificuldade ligeira","Dificuldade moderada","Dificuldade grave","Incapaz"]},
      {text:"Vestir um casaco",opts:["Sem dificuldade","Dificuldade ligeira","Dificuldade moderada","Dificuldade grave","Incapaz"]},
      {text:"Usar uma faca para cortar alimentos",opts:["Sem dificuldade","Dificuldade ligeira","Dificuldade moderada","Dificuldade grave","Incapaz"]},
      {text:"Atividades de lazer com pouco esforço (jogar cartas)",opts:["Sem dificuldade","Dificuldade ligeira","Dificuldade moderada","Dificuldade grave","Incapaz"]},
      {text:"Atividades de lazer com esforço moderado (golf, ténis)",opts:["Sem dificuldade","Dificuldade ligeira","Dificuldade moderada","Dificuldade grave","Incapaz"]},
      {text:"Atividades de lazer com movimento livre do braço (natação)",opts:["Sem dificuldade","Dificuldade ligeira","Dificuldade moderada","Dificuldade grave","Incapaz"]},
      {text:"Usar transportes públicos",opts:["Sem dificuldade","Dificuldade ligeira","Dificuldade moderada","Dificuldade grave","Incapaz"]},
      {text:"Atividade sexual (se aplicável)",opts:["Sem dificuldade","Dificuldade ligeira","Dificuldade moderada","Dificuldade grave","Incapaz"]},
      {text:"Interferência nas atividades sociais normais",opts:["Nada","Ligeiramente","Moderadamente","Bastante","Extremamente"]},
      {text:"Limitação no trabalho ou atividades diárias",opts:["Nada limitado","Ligeiramente limitado","Moderadamente limitado","Muito limitado","Incapaz"]},
      {text:"Dor no braço/ombro/mão",opts:["Nenhuma","Ligeira","Moderada","Grave","Muito grave"]},
      {text:"Dor ao realizar atividade específica",opts:["Nenhuma","Ligeira","Moderada","Grave","Muito grave"]},
      {text:"Formigueiro no braço/ombro/mão",opts:["Nenhum","Ligeiro","Moderado","Grave","Muito grave"]},
      {text:"Fraqueza no braço/ombro/mão",opts:["Nenhuma","Ligeira","Moderada","Grave","Muito grave"]},
      {text:"Rigidez no braço/ombro/mão",opts:["Nenhuma","Ligeira","Moderada","Grave","Muito grave"]},
      {text:"Dificuldade em dormir por causa da dor",opts:["Nenhuma","Ligeira","Moderada","Grave","Tão grave que não conseguiu dormir"]},
      {text:"Sente-se menos capaz por causa do problema",opts:["Discordo totalmente","Discordo","Nem concordo nem discordo","Concordo","Concordo totalmente"]},
    ],
    calc:vals=>{const n=vals.filter(v=>v!==null).length;if(n<27)return null;const sum=vals.filter(v=>v!==null).reduce((a,b)=>a+b+1,0);return((sum/n-1)/4*100).toFixed(1)}
  },
  {id:"constant",name:"Constant-Murley",full:"Constant-Murley Score — Ombro",region:"Ombro",items:4,maxScore:100,higherWorse:false,
    note:"Nota: força (0-25 pts) requer dinamómetro — não incluída nesta versão.",
    interpret:s=>s>=80?["Excelente","good"]:s>=70?["Bom","good"]:s>=55?["Moderado","moderate"]:["Mau","severe"],
    questions:[
      {text:"Dor (0 = dor máxima, 15 = sem dor)",opts:["0 — dor máxima","5","10","15 — sem dor"],vals:[0,5,10,15]},
      {text:"Atividades de vida diária — nível de atividade",opts:["0 — muito comprometido","2","4","6","8","10 — normal"],vals:[0,2,4,6,8,10]},
      {text:"Posicionamento da mão — alcance funcional",opts:["Até à cintura (2)","Até ao xifóide (4)","Até ao pescoço (6)","Até ao topo da cabeça (8)","Acima da cabeça (10)"],vals:[2,4,6,8,10]},
      {text:"Amplitude de movimento — abdução",opts:["< 30° (0)","31–60° (2)","61–90° (4)","91–120° (6)","121–150° (8)","> 150° (10)"],vals:[0,2,4,6,8,10]},
    ],
    calc:vals=>{const f=vals.filter(v=>v!==null);if(f.length<4)return null;return Math.min(100,f.reduce((a,b)=>a+b,0)).toFixed(0)}
  },
  {id:"oks",name:"Oxford Knee",full:"Oxford Knee Score — Joelho",region:"Joelho",items:12,maxScore:48,higherWorse:false,
    interpret:s=>s>=41?["Excelente","good"]:s>=34?["Bom","good"]:s>=27?["Moderado","moderate"]:["Mau / grave","severe"],
    questions:[
      {text:"Dor no joelho em geral",opts:["Sem dor (4)","Muito ligeira (3)","Ligeira (2)","Moderada (1)","Grave (0)"],vals:[4,3,2,1,0]},
      {text:"Dificuldade em lavar e secar",opts:["Nenhuma (4)","Muito pouca (3)","Moderada (2)","Grande (1)","Impossível (0)"],vals:[4,3,2,1,0]},
      {text:"Dificuldade em entrar/sair de carro",opts:["Nenhuma (4)","Muito pouca (3)","Moderada (2)","Grande (1)","Impossível (0)"],vals:[4,3,2,1,0]},
      {text:"Tempo de marcha antes de dor grave",opts:["> 30 min (4)","16–30 min (3)","5–15 min (2)","< 5 min (1)","Apenas dentro de casa (0)"],vals:[4,3,2,1,0]},
      {text:"Dor ao levantar após estar sentado",opts:["Nenhuma (4)","Muito ligeira (3)","Moderada (2)","Bastante (1)","Insuportável (0)"],vals:[4,3,2,1,0]},
      {text:"Claudicação após caminhar",opts:["Raramente/nunca (4)","Às vezes (3)","Frequentemente (2)","A maioria das vezes (1)","Sempre (0)"],vals:[4,3,2,1,0]},
      {text:"Dor à noite na cama",opts:["Sem dor (4)","Apenas 1-2 noites (3)","Algumas noites (2)","A maioria das noites (1)","Todas as noites (0)"],vals:[4,3,2,1,0]},
      {text:"Interferência com trabalho/AVD",opts:["Não (4)","Pouco (3)","Moderadamente (2)","Bastante (1)","Completamente (0)"],vals:[4,3,2,1,0]},
      {text:"Sensação de falta de apoio no joelho",opts:["Nunca (4)","Raramente (3)","Às vezes (2)","Frequentemente (1)","Sempre (0)"],vals:[4,3,2,1,0]},
      {text:"Capacidade de fazer compras",opts:["Sim, facilmente (4)","Com pouca dificuldade (3)","Com dificuldade moderada (2)","Com grande dificuldade (1)","Não (0)"],vals:[4,3,2,1,0]},
      {text:"Subir um lance de escadas",opts:["Sim, facilmente (4)","Com pouca dificuldade (3)","Com dificuldade moderada (2)","Com grande dificuldade (1)","Não (0)"],vals:[4,3,2,1,0]},
      {text:"Dor após caminhar",opts:["Sem dor (4)","Muito ligeira (3)","Ligeira (2)","Moderada (1)","Grave (0)"],vals:[4,3,2,1,0]},
    ],
    calc:vals=>{const f=vals.filter(v=>v!==null);if(f.length<12)return null;return f.reduce((a,b)=>a+b,0).toFixed(0)}
  },
  {id:"womac",name:"WOMAC",full:"WOMAC — Anca / Joelho",region:"Anca / Joelho",items:24,maxScore:100,higherWorse:true,
    interpret:s=>s<=20?["Incapacidade ligeira","good"]:s<=40?["Incapacidade moderada","moderate"]:["Incapacidade grave","severe"],
    questions:[
      {text:"[Dor] Ao caminhar em superfície plana",opts:["Nenhuma (0)","Ligeira (1)","Moderada (2)","Intensa (3)","Muito intensa (4)"]},
      {text:"[Dor] Ao subir ou descer escadas",opts:["Nenhuma (0)","Ligeira (1)","Moderada (2)","Intensa (3)","Muito intensa (4)"]},
      {text:"[Dor] À noite na cama",opts:["Nenhuma (0)","Ligeira (1)","Moderada (2)","Intensa (3)","Muito intensa (4)"]},
      {text:"[Dor] Ao sentar ou deitar",opts:["Nenhuma (0)","Ligeira (1)","Moderada (2)","Intensa (3)","Muito intensa (4)"]},
      {text:"[Dor] Ao ficar de pé",opts:["Nenhuma (0)","Ligeira (1)","Moderada (2)","Intensa (3)","Muito intensa (4)"]},
      {text:"[Rigidez] Matinal",opts:["Nenhuma (0)","Ligeira (1)","Moderada (2)","Intensa (3)","Muito intensa (4)"]},
      {text:"[Rigidez] Ao longo do dia após repouso",opts:["Nenhuma (0)","Ligeira (1)","Moderada (2)","Intensa (3)","Muito intensa (4)"]},
      {text:"[Função] Descer escadas",opts:["Nenhuma (0)","Ligeira (1)","Moderada (2)","Intensa (3)","Muito intensa (4)"]},
      {text:"[Função] Subir escadas",opts:["Nenhuma (0)","Ligeira (1)","Moderada (2)","Intensa (3)","Muito intensa (4)"]},
      {text:"[Função] Levantar da posição sentada",opts:["Nenhuma (0)","Ligeira (1)","Moderada (2)","Intensa (3)","Muito intensa (4)"]},
      {text:"[Função] Ficar de pé",opts:["Nenhuma (0)","Ligeira (1)","Moderada (2)","Intensa (3)","Muito intensa (4)"]},
      {text:"[Função] Curvar-se para o chão",opts:["Nenhuma (0)","Ligeira (1)","Moderada (2)","Intensa (3)","Muito intensa (4)"]},
      {text:"[Função] Caminhar em superfície plana",opts:["Nenhuma (0)","Ligeira (1)","Moderada (2)","Intensa (3)","Muito intensa (4)"]},
      {text:"[Função] Entrar/sair do carro",opts:["Nenhuma (0)","Ligeira (1)","Moderada (2)","Intensa (3)","Muito intensa (4)"]},
      {text:"[Função] Ir às compras",opts:["Nenhuma (0)","Ligeira (1)","Moderada (2)","Intensa (3)","Muito intensa (4)"]},
      {text:"[Função] Calçar meias",opts:["Nenhuma (0)","Ligeira (1)","Moderada (2)","Intensa (3)","Muito intensa (4)"]},
      {text:"[Função] Levantar da cama",opts:["Nenhuma (0)","Ligeira (1)","Moderada (2)","Intensa (3)","Muito intensa (4)"]},
      {text:"[Função] Tirar meias",opts:["Nenhuma (0)","Ligeira (1)","Moderada (2)","Intensa (3)","Muito intensa (4)"]},
      {text:"[Função] Deitar na cama",opts:["Nenhuma (0)","Ligeira (1)","Moderada (2)","Intensa (3)","Muito intensa (4)"]},
      {text:"[Função] Entrar/sair do banho",opts:["Nenhuma (0)","Ligeira (1)","Moderada (2)","Intensa (3)","Muito intensa (4)"]},
      {text:"[Função] Sentar",opts:["Nenhuma (0)","Ligeira (1)","Moderada (2)","Intensa (3)","Muito intensa (4)"]},
      {text:"[Função] Sentar/levantar da sanita",opts:["Nenhuma (0)","Ligeira (1)","Moderada (2)","Intensa (3)","Muito intensa (4)"]},
      {text:"[Função] Tarefas domésticas pesadas",opts:["Nenhuma (0)","Ligeira (1)","Moderada (2)","Intensa (3)","Muito intensa (4)"]},
      {text:"[Função] Tarefas domésticas leves",opts:["Nenhuma (0)","Ligeira (1)","Moderada (2)","Intensa (3)","Muito intensa (4)"]},
    ],
    calc:vals=>{const f=vals.filter(v=>v!==null);if(f.length<24)return null;return(f.reduce((a,b)=>a+b,0)/96*100).toFixed(1)}
  },
  {id:"oswestry",name:"Oswestry",full:"Oswestry Disability Index — Coluna Lombar",region:"Coluna lombar",items:10,maxScore:100,higherWorse:true,
    interpret:s=>s<=20?["Incapacidade mínima","good"]:s<=40?["Incapacidade moderada","moderate"]:s<=60?["Incapacidade grave","moderate"]:s<=80?["Incapacidade muito grave","severe"]:["Acamado / exageração","severe"],
    questions:[
      {text:"Intensidade da dor",opts:["Sem dor (0)","Muito ligeira (1)","Moderada (2)","Intensa (3)","Muito intensa (4)","Insuportável (5)"]},
      {text:"Cuidados pessoais (lavar, vestir)",opts:["Normal sem dor (0)","Normal com dor (1)","Lento e cuidadoso (2)","Com alguma ajuda (3)","Com muita ajuda (4)","Incapaz (5)"]},
      {text:"Levantar objetos",opts:["Sem dor (0)","Dor ao levantar peso do chão (1)","Levanta do chão com dor (2)","Não levanta do chão, levanta de mesa (3)","Apenas objetos leves (4)","Incapaz (5)"]},
      {text:"Caminhar",opts:["Sem limitação (0)","Dor > 1 km (1)","Dor < 500 m (2)","Dor < 100 m (3)","Com canadiana (4)","Acamado (5)"]},
      {text:"Sentado",opts:["Qualquer cadeira (0)","Cadeira confortável (1)","Até 1 hora (2)","Até 30 min (3)","Até 10 min (4)","Incapaz (5)"]},
      {text:"De pé",opts:["Sem limitação (0)","> 2 horas (1)","Até 1 hora (2)","Até 30 min (3)","Até 10 min (4)","Incapaz (5)"]},
      {text:"Dormir",opts:["Sem perturbação (0)","Boa noite com medicação (1)","Até 6 horas (2)","Até 4 horas (3)","Até 2 horas (4)","Sem sono (5)"]},
      {text:"Vida sexual (se aplicável)",opts:["Normal sem dor (0)","Normal com alguma dor (1)","Normal com muita dor (2)","Muito limitada (3)","Quase inexistente (4)","Incapaz (5)"]},
      {text:"Vida social",opts:["Normal sem dor (0)","Normal com dor (1)","Limitada a sedentário (2)","Limitada a atividades leves (3)","Raramente (4)","Sem vida social (5)"]},
      {text:"Viajar / transportes",opts:["Sem dificuldade (0)","Desconforto ligeiro (1)","Até 2 horas (2)","Até 30 min (3)","Apenas trajetos curtos (4)","Incapaz (5)"]},
    ],
    calc:vals=>{const f=vals.filter(v=>v!==null);if(f.length<10)return null;return(f.reduce((a,b)=>a+b,0)/50*100).toFixed(1)}
  },
  {id:"ndi",name:"NDI",full:"Neck Disability Index — Coluna Cervical",region:"Coluna cervical",items:10,maxScore:100,higherWorse:true,
    interpret:s=>s<=8?["Sem incapacidade","good"]:s<=28?["Incapacidade ligeira","good"]:s<=48?["Incapacidade moderada","moderate"]:s<=64?["Incapacidade grave","severe"]:["Incapacidade completa","severe"],
    questions:[
      {text:"Intensidade da dor cervical",opts:["Sem dor (0)","Ligeira (1)","Moderada (2)","Intensa (3)","Muito intensa (4)","Insuportável (5)"]},
      {text:"Cuidados pessoais",opts:["Normal sem dor (0)","Normal com dor (1)","Lento e cuidadoso (2)","Com ajuda (3)","Muita ajuda (4)","Incapaz (5)"]},
      {text:"Levantar objetos",opts:["Sem limitação (0)","Dor ao levantar peso (1)","Levanta com dor (2)","Não levanta do chão (3)","Apenas objetos leves (4)","Incapaz (5)"]},
      {text:"Leitura",opts:["Ilimitada sem dor (0)","Ilimitada com dor ligeira (1)","Até 1 hora (2)","Até 30 min (3)","Até 10 min (4)","Incapaz (5)"]},
      {text:"Cefaleias",opts:["Sem cefaleias (0)","Ligeiras e pouco frequentes (1)","Moderadas e pouco frequentes (2)","Moderadas e frequentes (3)","Graves e frequentes (4)","Constantes (5)"]},
      {text:"Concentração",opts:["Total sem dificuldade (0)","Alguma dificuldade (1)","Dificuldade moderada (2)","Muita dificuldade (3)","Muita dificuldade + dor (4)","Incapaz (5)"]},
      {text:"Trabalho",opts:["Trabalho completo (0)","Trabalho habitual com dor (1)","Trabalho reduzido (2)","Trabalho ligeiro apenas (3)","Quase incapaz (4)","Incapaz (5)"]},
      {text:"Conduzir",opts:["Sem dificuldade (0)","Sem dificuldade com dor (1)","Dor intensa (2)","Não conduz > 30 min (3)","Não conduz > 10 min (4)","Não conduz (5)"]},
      {text:"Dormir",opts:["Sem perturbação (0)","Perturbação ligeira (1)","Até 6 horas (2)","Até 4 horas (3)","Até 2 horas (4)","Sem sono (5)"]},
      {text:"Lazer",opts:["Todas as atividades (0)","Todas com dor ligeira (1)","Atividades com menos esforço (2)","Apenas atividades leves (3)","Dificilmente qualquer atividade (4)","Sem lazer (5)"]},
    ],
    calc:vals=>{const f=vals.filter(v=>v!==null);if(f.length<10)return null;return(f.reduce((a,b)=>a+b,0)/50*100).toFixed(1)}
  },
  {id:"fim",name:"FIM",full:"Functional Independence Measure",region:"Independência funcional",items:18,maxScore:126,higherWorse:false,
    interpret:s=>s>=108?["Independência completa","good"]:s>=90?["Independência modificada","good"]:s>=72?["Supervisão / assistência mínima","moderate"]:s>=36?["Assistência moderada a máxima","moderate"]:["Dependência total","severe"],
    sections:["Autocuidados","Controlo de esfíncteres","Transferências","Locomoção","Comunicação","Cognição social"],
    questions:[
      {text:"Alimentação",sec:0},{text:"Higiene pessoal",sec:0},{text:"Banho",sec:0},{text:"Vestir metade superior",sec:0},{text:"Vestir metade inferior",sec:0},{text:"Utilização da sanita",sec:0},
      {text:"Controlo vesical",sec:1},{text:"Controlo intestinal",sec:1},
      {text:"Transferência cama/cadeira",sec:2},{text:"Transferência sanita",sec:2},{text:"Transferência banheira/duche",sec:2},
      {text:"Marcha / cadeira de rodas",sec:3},{text:"Escadas",sec:3},
      {text:"Compreensão",sec:4},{text:"Expressão",sec:4},
      {text:"Interação social",sec:5},{text:"Resolução de problemas",sec:5},{text:"Memória",sec:5},
    ].map(q=>({...q,opts:["1 — Ajuda total (< 25%)","2 — Ajuda máxima (25–49%)","3 — Ajuda moderada (50–74%)","4 — Ajuda mínima (75–99%)","5 — Supervisão","6 — Independência modificada","7 — Independência completa"],vals:[1,2,3,4,5,6,7]})),
    calc:vals=>{const f=vals.filter(v=>v!==null);if(f.length<18)return null;return f.reduce((a,b)=>a+b,0).toFixed(0)}
  },
  {id:"barthel",name:"Barthel",full:"Índice de Barthel — AVD",region:"Atividades de vida diária",items:10,maxScore:100,higherWorse:false,
    interpret:s=>s===100?["Independente","good"]:s>=60?["Dependência ligeira","good"]:s>=40?["Dependência moderada","moderate"]:s>=20?["Dependência grave","severe"]:["Dependência total","severe"],
    questions:[
      {text:"Alimentação",opts:["Incapaz (0)","Necessita de ajuda (5)","Independente (10)"],vals:[0,5,10]},
      {text:"Banho",opts:["Dependente (0)","Independente (5)"],vals:[0,5]},
      {text:"Higiene pessoal",opts:["Necessita de ajuda (0)","Independente (5)"],vals:[0,5]},
      {text:"Vestir",opts:["Dependente (0)","Necessita de ajuda, faz metade (5)","Independente (10)"],vals:[0,5,10]},
      {text:"Controlo intestinal",opts:["Incontinente (0)","Acidentes ocasionais (5)","Continente (10)"],vals:[0,5,10]},
      {text:"Controlo vesical",opts:["Incontinente (0)","Acidentes ocasionais (5)","Continente (10)"],vals:[0,5,10]},
      {text:"Utilização da sanita",opts:["Dependente (0)","Necessita de ajuda (5)","Independente (10)"],vals:[0,5,10]},
      {text:"Transferência cama-cadeira",opts:["Incapaz (0)","Ajuda máxima (5)","Ajuda mínima (10)","Independente (15)"],vals:[0,5,10,15]},
      {text:"Marcha / mobilidade",opts:["Imóvel (0)","Cadeira de rodas independente (5)","Marcha com ajuda (10)","Independente (15)"],vals:[0,5,10,15]},
      {text:"Escadas",opts:["Incapaz (0)","Necessita de ajuda (5)","Independente (10)"],vals:[0,5,10]},
    ],
    calc:vals=>{const f=vals.filter(v=>v!==null);if(f.length<10)return null;return f.reduce((a,b)=>a+b,0).toFixed(0)}
  }
];

// ── Estado ──
const state={};
scales.forEach(s=>{ state[s.id]=new Array(s.questions.length).fill(null); });

// ── Helpers ──
function getProgressColor(score,max,higherWorse){
  const p=score/max;
  if(higherWorse) return p<0.3?'#22c55e':p<0.6?'#f59e0b':'#ef4444';
  return p>0.7?'#22c55e':p>0.4?'#f59e0b':'#ef4444';
}

function renderResult(scale){
  const el=document.getElementById('result-'+scale.id); if(!el) return;
  const score=scale.calc(state[scale.id]);
  const total=state[scale.id].filter(v=>v!==null).length;
  document.getElementById('answered-'+scale.id).textContent=total+' / '+scale.questions.length+' perguntas respondidas';
  if(score===null){
    el.innerHTML='<div style="font-size:12px;color:#64748b">Pontuação</div><div class="result-score">—</div>';
    updateBarSummary(); return;
  }
  const n=parseFloat(score);
  const interp=scale.interpret(n);
  const pct=Math.min(100,n/scale.maxScore*100);
  const color=getProgressColor(n,scale.maxScore,scale.higherWorse);
  el.innerHTML='<div style="font-size:12px;color:#64748b">'+(scale.higherWorse?'Pontuação (maior = mais incapacidade)':'Pontuação (maior = melhor função)')+'</div>'
    +'<div style="display:flex;align-items:baseline;gap:8px"><div class="result-score">'+score+'</div><div style="font-size:13px;color:#64748b">/ '+scale.maxScore+'</div></div>'
    +'<div class="result-interp '+interp[1]+'">'+interp[0]+'</div>'
    +'<div class="progress"><div class="progress-fill" style="width:'+pct.toFixed(0)+'%;background:'+color+'"></div></div>';
  updateBarSummary();
}

function updateBarSummary(){
  const filled=scales.filter(s=>s.calc(state[s.id])!==null);
  const el=document.getElementById('bar-summary');
  if(!el) return;
  el.textContent=filled.length===0?'nenhuma':filled.map(s=>s.name+' ('+s.calc(state[s.id])+')').join(' · ');
}

function pick(scaleId,qIdx,val){
  state[scaleId][qIdx]=val;
  const scale=scales.find(s=>s.id===scaleId);
  const qEl=document.getElementById('q-'+scaleId+'-'+qIdx);
  if(qEl) qEl.classList.add('answered');
  renderResult(scale);
}

function resetScale(scaleId){
  state[scaleId]=new Array(state[scaleId].length).fill(null);
  const scale=scales.find(s=>s.id===scaleId);
  document.querySelectorAll('input[name^="'+scaleId+'-q"]').forEach(el=>el.checked=false);
  scale.questions.forEach((_,i)=>{
    const qEl=document.getElementById('q-'+scaleId+'-'+i);
    if(qEl) qEl.classList.remove('answered');
  });
  renderResult(scale);
}

function copyScale(scaleId,btn){
  const scale=scales.find(s=>s.id===scaleId);
  const score=scale.calc(state[scaleId]);
  if(score===null){
    btn.textContent='Preenche primeiro';
    setTimeout(()=>{btn.textContent='Copiar esta escala';btn.classList.remove('ok');},2000);
    return;
  }
  const name=document.getElementById('pt-name').value.trim()||'(não indicado)';
  const proc=document.getElementById('pt-proc').value.trim()||'—';
  const dateVal=document.getElementById('pt-date').value;
  const date=dateVal?new Date(dateVal).toLocaleDateString('pt-PT',{day:'2-digit',month:'2-digit',year:'numeric'}):new Date().toLocaleDateString('pt-PT',{day:'2-digit',month:'2-digit',year:'numeric'});
  const n=parseFloat(score);
  const interp=scale.interpret(n);
  const total=state[scaleId].filter(v=>v!==null).length;
  const sep='─'.repeat(50);
  const lines=[
    '── '+scale.full.toUpperCase()+' ──',
    'Doente: '+name+'  |  Nº processo: '+proc+'  |  Data: '+date,
    sep,
    'Região: '+scale.region,
    'Itens respondidos: '+total+' / '+scale.items,
    'Pontuação: '+score+' / '+scale.maxScore+(scale.higherWorse?' (maior = mais incapacidade)':' (maior = melhor função)'),
    'Interpretação: '+interp[0],
    scale.note?'Nota: '+scale.note:'',
    sep,
  ].filter(Boolean).join('\n');
  _copyText(lines);
  btn.textContent='Copiado!'; btn.classList.add('ok');
  setTimeout(()=>{btn.textContent='Copiar esta escala';btn.classList.remove('ok');},2500);
}

function buildFormattedText(){
  const name=document.getElementById('pt-name').value.trim()||'(não indicado)';
  const proc=document.getElementById('pt-proc').value.trim()||'—';
  const dateVal=document.getElementById('pt-date').value;
  const date=dateVal?new Date(dateVal).toLocaleDateString('pt-PT',{day:'2-digit',month:'2-digit',year:'numeric'}):new Date().toLocaleDateString('pt-PT',{day:'2-digit',month:'2-digit',year:'numeric'});
  const filled=scales.filter(s=>s.calc(state[s.id])!==null);
  if(filled.length===0) return null;
  const sep55='─'.repeat(55);
  const lines=[
    '── AVALIAÇÃO FUNCIONAL — MEDICINA FÍSICA E DE REABILITAÇÃO ──',
    'Doente: '+name+'  |  Nº processo: '+proc+'  |  Data: '+date,
    sep55,'',
  ];
  filled.forEach(s=>{
    const score=s.calc(state[s.id]);
    const n=parseFloat(score);
    const interp=s.interpret(n);
    const total=state[s.id].filter(v=>v!==null).length;
    lines.push(s.full.toUpperCase());
    lines.push('Região: '+s.region+'  |  Itens: '+total+' / '+s.items);
    lines.push('Pontuação: '+score+' / '+s.maxScore+(s.higherWorse?' (maior = mais incapacidade)':' (maior = melhor função)'));
    lines.push('Interpretação: '+interp[0]);
    if(s.note) lines.push('Nota: '+s.note);
    lines.push(sep55,'');
  });
  return lines.join('\n');
}

function _copyText(txt){
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(txt).catch(function(){_fallbackCopy(txt);});
  } else { _fallbackCopy(txt); }
}
function _fallbackCopy(txt){
  var ta=document.createElement('textarea');
  ta.value=txt;ta.style.position='fixed';ta.style.opacity='0';
  document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);
}

// ── Build panels ──
function buildPanel(scale){
  const div=document.createElement('div');
  div.className='scale-panel'; div.id='panel-'+scale.id;
  let html='<div class="scale-title">'+scale.full+'</div>';
  html+='<div class="scale-desc">Região: '+scale.region+' &nbsp;·&nbsp; '+scale.items+' itens &nbsp;·&nbsp; Máx: '+scale.maxScore+'</div>';
  if(scale.note) html+='<div class="scale-desc" style="font-style:italic">'+scale.note+'</div>';
  let lastSec=-1;
  scale.questions.forEach(function(q,i){
    if(scale.sections&&q.sec!==lastSec){
      html+='<div class="section-sep">'+scale.sections[q.sec]+'</div>';
      lastSec=q.sec;
    }
    const opts=q.opts, vals=q.vals||opts.map(function(_,j){return j;});
    html+='<div class="question" id="q-'+scale.id+'-'+i+'">';
    html+='<div class="q-text">'+(i+1)+'. '+q.text+'</div>';
    html+='<div class="options">';
    opts.forEach(function(opt,j){
      html+='<label class="opt"><input type="radio" name="'+scale.id+'-q'+i+'" value="'+vals[j]+'" onchange="pick(\''+scale.id+'\','+i+','+vals[j]+')"><span class="opt-label">'+opt+'</span></label>';
    });
    html+='</div></div>';
  });
  html+='<div class="result-bar" id="result-'+scale.id+'"><div style="font-size:12px;color:#64748b">Pontuação</div><div class="result-score">—</div></div>';
  html+='<div class="answered-count" id="answered-'+scale.id+'">0 / '+scale.questions.length+' perguntas respondidas</div>';
  html+='<div class="btn-row"><button class="btn" onclick="resetScale(\''+scale.id+'\')">Limpar</button><button class="btn btn-copy" onclick="copyScale(\''+scale.id+'\',this)">Copiar esta escala</button></div>';
  div.innerHTML=html; return div;
}

const tabsEl=document.getElementById('tabs');
const panelsEl=document.getElementById('panels');
scales.forEach(function(scale,idx){
  const tab=document.createElement('button');
  tab.className='tab'+(idx===0?' active':'');
  tab.textContent=scale.name; tab.title=scale.region;
  tab.onclick=function(){
    document.querySelectorAll('.tab').forEach(function(t){t.classList.remove('active');});
    document.querySelectorAll('.scale-panel').forEach(function(p){p.classList.remove('active');});
    tab.classList.add('active');
    document.getElementById('panel-'+scale.id).classList.add('active');
  };
  tabsEl.appendChild(tab);
  const panel=buildPanel(scale);
  if(idx===0) panel.classList.add('active');
  panelsEl.appendChild(panel);
});

// ── Barra de ações ──
document.getElementById('btnPdf').addEventListener('click', function(){ window.print(); });
document.getElementById('btnCopyAll').addEventListener('click', function(){
  const btn=this;
  const text=buildFormattedText();
  if(!text){
    btn.textContent='Sem escalas preenchidas';
    setTimeout(function(){btn.textContent='Copiar para consulta';btn.classList.remove('ok');},2200);
    return;
  }
  _copyText(text);
  btn.textContent='Copiado!'; btn.classList.add('ok');
  setTimeout(function(){btn.textContent='Copiar para consulta';btn.classList.remove('ok');},2500);
});
</script>
</body>
</html>`;
}
