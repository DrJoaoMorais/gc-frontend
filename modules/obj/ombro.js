export function render(_mskCss, _evaOpts, _mskJs, _abrirBlob, ctx) {
    _abrirBlob(`<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8">
<title>Exame Objectivo — Ombro</title>
<style>
${_mskCss}
/* ── OMBRO OVERRIDES ── */
.page{max-width:1060px;padding:14px 18px 70px;}
h1{font-size:17px;margin-bottom:1px;}
.subtitle{margin-bottom:6px;}
.lado-bar{display:flex;align-items:center;gap:10px;background:#f0f4ff;border:1px solid #dbeafe;border-radius:12px;padding:8px 14px;margin:6px 0 10px;}
.lado-bar-lbl{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#3b5bdb;white-space:nowrap;}
.lado-bar .opts{gap:8px;}
.lado-bar .opt{padding:9px 24px;font-size:14px;font-weight:700;border-radius:22px;border:2px solid #e2e8f0;}
.lado-bar .opt.sel{background:#0f2d52;border-color:#0f2d52;color:#fff;}
.ob-tabs{display:flex;gap:4px;border-bottom:2px solid #e2e8f0;margin-bottom:8px;}
.ob-tab{padding:7px 16px;border:none;background:none;font-size:13px;font-weight:600;color:#64748b;cursor:pointer;border-bottom:3px solid transparent;margin-bottom:-2px;font-family:inherit;}
.ob-tab.active{color:#0f2d52;border-bottom-color:#0f2d52;}
.ob-tab-content{display:none;}
.ob-tab-content.active{display:block;}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.col-scroll{overflow-y:auto;max-height:calc(100vh - 195px);}
.sec{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:9px 11px;margin-bottom:8px;}
.sec:last-child{margin-bottom:0;}
.sec-title{font-size:12px;font-weight:700;color:#0f2d52;margin-bottom:7px;padding-bottom:5px;border-bottom:1px solid #f1f5f9;}
.gl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#64748b;margin-bottom:4px;margin-top:7px;}
.gl:first-child{margin-top:0;}
.eva-row{display:flex;align-items:center;gap:6px;margin-bottom:3px;}
.eva-lbl{font-size:11px;color:#64748b;width:66px;flex-shrink:0;}
.eva-btns .opt{width:25px;height:25px;min-width:0;border-radius:50%;padding:0;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;}
.opts{display:flex;gap:4px;flex-wrap:wrap;}
.opt{padding:4px 9px;border:1px solid #e2e8f0;border-radius:16px;font-size:11px;font-weight:500;cursor:pointer;background:#f8fafc;color:#475569;transition:all .15s;user-select:none;}
.opt:hover{border-color:#1a56db;color:#1a56db;}
.opt.sel{background:#1a56db;border-color:#1a56db;color:#fff;}
.opts.grade .opt.sel[data-v="Negativo"]{background:#059669;border-color:#059669;}
.opts.grade .opt.sel[data-v="+"]{background:#f59e0b;border-color:#f59e0b;}
.opts.grade .opt.sel[data-v="++"]{background:#ea580c;border-color:#ea580c;}
.opts.grade .opt.sel[data-v="+++"]{background:#dc2626;border-color:#dc2626;}
.mrc-row,.func-row,.palp-row,.teste-row{display:flex;align-items:center;gap:6px;margin-bottom:3px;}
.mrc-lbl{font-size:11px;color:#475569;width:105px;flex-shrink:0;}
.func-lbl{font-size:11px;color:#475569;width:128px;flex-shrink:0;}
.palp-lbl{font-size:11px;color:#475569;width:132px;flex-shrink:0;}
.teste-lbl{font-size:11px;color:#475569;width:108px;flex-shrink:0;}
.sub-lbl{font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin:6px 0 3px;}
.sub-lbl:first-child{margin-top:0;}
.rom-item{margin-bottom:8px;}
.rom-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;}
.rom-label{font-size:11px;font-weight:700;color:#0f172a;}
.rom-ref{font-size:10px;color:#94a3b8;}
.rom-svg{cursor:crosshair;display:block;}
.rom-inputs{display:flex;gap:8px;align-items:center;margin-top:3px;}
.rom-inp{width:50px;padding:2px 4px;border:1px solid #e2e8f0;border-radius:5px;font-size:12px;text-align:center;font-family:inherit;color:#0f172a;background:#fff;}
.rom-inp.ia{border-color:#3b82f6;}.rom-inp.ip{border-color:#10b981;}
.rom-inp-lbl{font-size:10px;color:#64748b;}
.dyn-table{width:100%;border-collapse:collapse;font-size:11px;}
.dyn-table th{font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;padding:3px 4px;text-align:center;border-bottom:1px solid #e2e8f0;}
.dyn-table th:first-child{text-align:left;}
.dyn-table td{padding:3px 4px;border-bottom:1px solid #f8fafc;text-align:center;}
.dyn-table td:first-child{text-align:left;font-weight:600;color:#0f172a;}
.dyn-inp{width:44px;padding:2px 3px;border:1px solid #e2e8f0;border-radius:4px;font-size:11px;text-align:center;font-family:inherit;background:#fff;}
.dyn-ok{color:#059669;font-weight:700;}.dyn-warn{color:#f59e0b;font-weight:700;}.dyn-bad{color:#dc2626;font-weight:700;}
.af2-paste{width:100%;border:1px solid #e2e8f0;border-radius:6px;padding:4px 6px;font-size:10px;resize:none;height:38px;background:#f8fafc;font-family:monospace;box-sizing:border-box;margin-top:5px;}
.af2-btn{padding:3px 10px;border:1px solid #1a56db;border-radius:5px;background:#fff;color:#1a56db;font-size:10px;font-weight:600;cursor:pointer;font-family:inherit;margin-top:3px;}
.scale-block{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;margin-bottom:10px;}
.scale-title{font-size:13px;font-weight:800;color:#0f2d52;margin-bottom:2px;}
.scale-desc{font-size:10px;color:#64748b;margin-bottom:8px;}
.scale-score-row{display:flex;align-items:center;gap:12px;padding:6px 10px;background:#f8fafc;border-radius:8px;margin-bottom:10px;}
.scale-score{font-size:20px;font-weight:800;color:#0f2d52;min-width:42px;}
.scale-interp{font-size:11px;color:#475569;}
.sq-row{display:flex;align-items:center;gap:6px;padding:3px 0;border-bottom:1px solid #f8fafc;}
.sq-row:last-child{border-bottom:none;}
.sq-num{font-size:10px;color:#94a3b8;width:16px;flex-shrink:0;text-align:right;}
.sq-lbl{font-size:11px;color:#374151;flex:1;line-height:1.3;}
.sq-opts{display:flex;gap:3px;}
.sq-opt{width:24px;height:21px;border:1px solid #e2e8f0;border-radius:4px;font-size:10px;font-weight:600;cursor:pointer;background:#f8fafc;color:#475569;display:inline-flex;align-items:center;justify-content:center;user-select:none;}
.sq-opt:hover{border-color:#1a56db;color:#1a56db;}
.sq-opt.sel{background:#1a56db;border-color:#1a56db;color:#fff;}
.ases-eva-row{display:flex;align-items:center;gap:8px;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #e2e8f0;}
.ases-eva-lbl{font-size:11px;color:#475569;width:80px;flex-shrink:0;}
.ases-eva-inp{width:56px;padding:4px 6px;border:1px solid #e2e8f0;border-radius:6px;font-size:14px;font-weight:700;text-align:center;font-family:inherit;color:#0f172a;}
.scale-legend{font-size:10px;color:#94a3b8;margin-bottom:6px;}
textarea{width:100%;border:1px solid #e2e8f0;border-radius:7px;padding:4px 7px;font-size:11px;resize:vertical;min-height:34px;background:#f8fafc;color:#0f172a;font-family:inherit;box-sizing:border-box;margin-top:4px;}
@media print{
  .ob-tabs{display:none!important;}
  .bar-acoes{display:none!important;}
  .lado-bar{display:none!important;}
  .ob-tab-content{display:block!important;}
  .page{padding-bottom:10px;}
}
</style></head><body>
<div class="page">

<div style="display:flex;align-items:flex-start;justify-content:space-between;">
  <div><h1>Exame Objectivo — Ombro</h1>
  <div class="subtitle">Exame completo · Escalas DASH / ASES / OSS · Guardar no final</div></div>
</div>

<div class="lado-bar">
  <span class="lado-bar-lbl">Ombro avaliado</span>
  <div class="opts sg" id="lado">
    <div class="opt" data-v="Direito">D</div>
    <div class="opt" data-v="Esquerdo">E</div>
    <div class="opt" data-v="Bilateral">Bilateral</div>
  </div>
</div>

<div class="ob-tabs">
  <button class="ob-tab active" data-tab="exame">🦴 Exame Objectivo</button>
  <button class="ob-tab" data-tab="escalas">📊 Escalas Funcionais</button>
</div>

<!-- ═══ TAB EXAME ═══ -->
<div id="tab-exame" class="ob-tab-content active">
<div class="two-col">

<div class="col-scroll">

<div class="sec">
  <div class="sec-title">1 · Caracterização da Dor</div>
  <div class="eva-row"><span class="eva-lbl">Repouso</span>${_evaOpts("eva_rep")}</div>
  <div class="eva-row"><span class="eva-lbl">Actividade</span>${_evaOpts("eva_act")}</div>
  <div class="eva-row"><span class="eva-lbl">Pico</span>${_evaOpts("eva_pic")}</div>
  <div class="gl">Localização</div>
  <div class="opts mg" id="localizacao_dor">
    <div class="opt" data-v="Anterior">Anterior</div>
    <div class="opt" data-v="Lateral">Lateral</div>
    <div class="opt" data-v="Posterior">Posterior</div>
    <div class="opt" data-v="Articulação AC">AC</div>
  </div>
  <div class="gl">Tipo</div>
  <div class="opts sg" id="tipo_dor">
    <div class="opt" data-v="Mecânica">Mecânica</div>
    <div class="opt" data-v="Inflamatória">Inflamatória</div>
    <div class="opt" data-v="Neuropática">Neuropática</div>
    <div class="opt" data-v="Mista">Mista</div>
  </div>
  <div class="gl">Irradiação</div>
  <div class="opts sg" id="irradiacao">
    <div class="opt" data-v="Sem irradiação">Sem irradiação</div>
    <div class="opt" data-v="Para o braço">Braço</div>
    <div class="opt" data-v="Para antebraço/mão">Antebraço / mão</div>
  </div>
  <div class="gl">Dor noturna</div>
  <div class="opts sg" id="d_noturna">
    <div class="opt" data-v="Não">Não</div>
    <div class="opt" data-v="Sim — deitar sobre o ombro">Sim</div>
  </div>
</div>

<div class="sec">
  <div class="sec-title">2 · Palpação</div>
  <div class="palp-row"><div class="palp-lbl">Articulação AC</div><div class="opts sg" id="palp_ac"><div class="opt" data-v="Sem dor">Sem dor</div><div class="opt" data-v="Dor">Dor</div></div></div>
  <div class="palp-row"><div class="palp-lbl">Tubérculo maior</div><div class="opts sg" id="palp_tb"><div class="opt" data-v="Sem dor">Sem dor</div><div class="opt" data-v="Dor">Dor</div></div></div>
  <div class="palp-row"><div class="palp-lbl">Sulco bicipital</div><div class="opts sg" id="palp_bic"><div class="opt" data-v="Sem dor">Sem dor</div><div class="opt" data-v="Dor">Dor</div></div></div>
  <div class="palp-row"><div class="palp-lbl">Bursa subacromial</div><div class="opts sg" id="palp_bur"><div class="opt" data-v="Sem dor">Sem dor</div><div class="opt" data-v="Dor">Dor</div></div></div>
  <div class="palp-row"><div class="palp-lbl">Supra-espinhoso</div><div class="opts sg" id="palp_sup"><div class="opt" data-v="Sem dor">Sem dor</div><div class="opt" data-v="Dor">Dor</div></div></div>
  <textarea id="notas_palp" placeholder="Notas de palpação…"></textarea>
</div>

<div class="sec">
  <div class="sec-title">3 · Força Muscular (MRC)</div>
  ${[['f_sup','Supra-espinhoso'],['f_inf','Infra-espinhoso'],['f_sub','Subescapular'],['f_del','Deltóide']].map(function(r){return '<div class="mrc-row"><div class="mrc-lbl">'+r[1]+'</div><div class="opts sg" id="'+r[0]+'">'+['5/5','4/5','3/5','2/5','1/5','0/5'].map(function(v){return '<div class="opt" data-v="'+v+'">'+v+'</div>';}).join('')+'</div></div>';}).join('')}
  <textarea id="notas_forca" placeholder="Notas sobre força…"></textarea>
</div>

<div class="sec">
  <div class="sec-title">4 · Avaliação Funcional</div>
  ${[['func_elev','Elevação acima cabeça'],['func_cos','Alcançar costas'],['func_vest','Vestir camisola'],['func_prof','Actividade profissional'],['func_desp','Actividade desportiva'],['func_cond','Conduzir']].map(function(r){return '<div class="func-row"><div class="func-lbl">'+r[1]+'</div><div class="opts sg" id="'+r[0]+'"><div class="opt" data-v="Normal">Normal</div><div class="opt" data-v="Com dor">Com dor</div><div class="opt" data-v="Dificuldade">Dificuldade</div><div class="opt" data-v="Impossível">Impossível</div></div></div>';}).join('')}
</div>

</div><!-- end left col -->

<div class="col-scroll">

<div class="sec">
  <div class="sec-title">5 · Amplitude de Movimento</div>
  <div style="font-size:10px;margin-bottom:6px;display:flex;gap:12px;">
    <span style="color:#3b82f6;font-weight:700;">● Activo (arco ext.)</span>
    <span style="color:#10b981;font-weight:700;">● Passivo (arco int.)</span>
    <span style="color:#94a3b8;">Clicar no arco · editar valores abaixo</span>
  </div>
  <div id="rom-container"></div>
  <textarea id="notas_mob" placeholder="End-feel, dor em arco, crepitação…"></textarea>
</div>

<div class="sec">
  <div class="sec-title">6 · Testes Específicos</div>
  <div class="sub-lbl">Conflito subacromial</div>
  ${[['t_neer','Neer'],['t_hawk','Hawkins']].map(function(r){return '<div class="teste-row"><div class="teste-lbl">'+r[1]+'</div><div class="opts sg grade" id="'+r[0]+'"><div class="opt" data-v="Negativo">Neg</div><div class="opt" data-v="+">+</div><div class="opt" data-v="++">++</div><div class="opt" data-v="+++">+++</div></div></div>';}).join('')}
  <div class="sub-lbl">Coifa dos rotadores</div>
  ${[['t_jobe','Jobe (supra-esp.)'],['t_patte','Patte (infra-esp.)'],['t_liftoff','Lift-off (subesc.)'],['t_belly','Belly press'],['t_drop','Drop Arm']].map(function(r){return '<div class="teste-row"><div class="teste-lbl">'+r[1]+'</div><div class="opts sg grade" id="'+r[0]+'"><div class="opt" data-v="Negativo">Neg</div><div class="opt" data-v="+">+</div><div class="opt" data-v="++">++</div><div class="opt" data-v="+++">+++</div></div></div>';}).join('')}
  <div class="sub-lbl">Bicípite</div>
  ${[['t_speed','Speed'],['t_yerg','Yergason']].map(function(r){return '<div class="teste-row"><div class="teste-lbl">'+r[1]+'</div><div class="opts sg grade" id="'+r[0]+'"><div class="opt" data-v="Negativo">Neg</div><div class="opt" data-v="+">+</div><div class="opt" data-v="++">++</div><div class="opt" data-v="+++">+++</div></div></div>';}).join('')}
  <div class="sub-lbl">Instabilidade</div>
  ${[['t_appr','Apprehension'],['t_reloc','Relocation'],['t_sulc','Sulcus sign']].map(function(r){return '<div class="teste-row"><div class="teste-lbl">'+r[1]+'</div><div class="opts sg grade" id="'+r[0]+'"><div class="opt" data-v="Negativo">Neg</div><div class="opt" data-v="+">+</div><div class="opt" data-v="++">++</div><div class="opt" data-v="+++">+++</div></div></div>';}).join('')}
  <textarea id="notas_testes" placeholder="Notas sobre testes…"></textarea>
</div>

<div class="sec">
  <div class="sec-title">7 · Dinamometria ActivForce 2</div>
  <table class="dyn-table">
    <thead><tr><th>Movimento</th><th>Afect. kg</th><th>Contral. kg</th><th>Défice</th><th>F·P</th></tr></thead>
    <tbody>
      <tr><td>Rot. Externa</td><td><input class="dyn-inp" type="number" id="dyn_re_af" min="0" max="99" step="0.1" placeholder="—"></td><td><input class="dyn-inp" type="number" id="dyn_re_cl" min="0" max="99" step="0.1" placeholder="—"></td><td id="dyn_re_def">—</td><td id="dyn_re_fp" rowspan="2" style="vertical-align:middle;font-weight:700;font-size:12px;">—</td></tr>
      <tr><td>Rot. Interna</td><td><input class="dyn-inp" type="number" id="dyn_ri_af" min="0" max="99" step="0.1" placeholder="—"></td><td><input class="dyn-inp" type="number" id="dyn_ri_cl" min="0" max="99" step="0.1" placeholder="—"></td><td id="dyn_ri_def">—</td></tr>
      <tr><td>Elev. Anterior</td><td><input class="dyn-inp" type="number" id="dyn_ea_af" min="0" max="99" step="0.1" placeholder="—"></td><td><input class="dyn-inp" type="number" id="dyn_ea_cl" min="0" max="99" step="0.1" placeholder="—"></td><td id="dyn_ea_def">—</td><td id="dyn_ea_fp">—</td></tr>
      <tr><td>Abdução</td><td><input class="dyn-inp" type="number" id="dyn_abd_af" min="0" max="99" step="0.1" placeholder="—"></td><td><input class="dyn-inp" type="number" id="dyn_abd_cl" min="0" max="99" step="0.1" placeholder="—"></td><td id="dyn_abd_def">—</td><td id="dyn_abd_fp">—</td></tr>
    </tbody>
  </table>
  <div style="font-size:10px;color:#94a3b8;margin-top:4px;">Colar dados do ActivForce 2 (Copy Data)</div>
  <textarea class="af2-paste" id="af2_paste" placeholder="Cole aqui os dados exportados pelo ActivForce 2…"></textarea>
  <button class="af2-btn" id="af2_import">Importar dados</button>
</div>

</div><!-- end right col -->
</div><!-- end two-col -->
</div><!-- end tab-exame -->

<!-- ═══ TAB ESCALAS ═══ -->
<div id="tab-escalas" class="ob-tab-content">

<div class="scale-block" id="scale-dash">
  <div class="scale-title">DASH — Disabilities of the Arm, Shoulder and Hand</div>
  <div class="scale-desc">10 itens · 1 = sem dificuldade · 5 = incapaz · Score 0–100 · 0 = sem incapacidade</div>
  <div class="scale-score-row"><div class="scale-score" id="dash_score">—</div><div class="scale-interp" id="dash_interp"></div></div>
  <div class="scale-legend">1 Sem dificuldade &nbsp;·&nbsp; 2 Ligeira &nbsp;·&nbsp; 3 Moderada &nbsp;·&nbsp; 4 Extrema &nbsp;·&nbsp; 5 Incapaz</div>
  ${[['Abrir um frasco (rosca)'],['Escrever ou digitar'],['Rodar uma chave'],['Preparar uma refeição'],['Empurrar uma porta pesada'],['Colocar objeto em prateleira acima da cabeça'],['Tarefas domésticas pesadas (lavar o chão, etc.)'],['Jardinagem ou bricolagem'],['Actividade desportiva com impacto no braço'],['Dificuldade para dormir por dor no braço/ombro']].map(function(q,i){return '<div class="sq-row"><span class="sq-num">'+(i+1)+'</span><span class="sq-lbl">'+q[0]+'</span><div class="sq-opts">'+'12345'.split('').map(function(v){return '<div class="sq-opt" data-v="'+v+'">'+v+'</div>';}).join('')+'</div></div>';}).join('')}
</div>

<div class="scale-block" id="scale-ases">
  <div class="scale-title">ASES — American Shoulder and Elbow Surgeons Score</div>
  <div class="scale-desc">EVA de dor + 10 actividades · Score 0–100 · 100 = melhor função</div>
  <div class="scale-score-row"><div class="scale-score" id="ases_score">—</div><div class="scale-interp" id="ases_interp"></div></div>
  <div class="ases-eva-row">
    <span class="ases-eva-lbl">Dor EVA 0–10</span>
    <input class="ases-eva-inp" type="number" id="ases_eva" min="0" max="10" step="0.5" placeholder="—">
    <span style="font-size:10px;color:#94a3b8;">0 = sem dor &nbsp;·&nbsp; 10 = dor máxima</span>
  </div>
  <div class="scale-legend">Actividades: 0 Incapaz &nbsp;·&nbsp; 1 Dificuldade extrema &nbsp;·&nbsp; 2 Ligeira dificuldade &nbsp;·&nbsp; 3 Normal</div>
  ${[['Colocar um casaco'],['Dormir sobre o lado afectado'],['Lavar/pentear as costas ou fechar soutien'],['Higiene pessoal com mão acima da cabeça'],['Pentear o cabelo'],['Alcançar uma prateleira alta'],['Levantar 4,5 kg acima da cabeça'],['Lançar bola ou movimento full overhead'],['Actividade profissional habitual'],['Actividade recreativa / desportiva habitual']].map(function(q,i){return '<div class="sq-row"><span class="sq-num">'+(i+1)+'</span><span class="sq-lbl">'+q[0]+'</span><div class="sq-opts">'+'0123'.split('').map(function(v){return '<div class="sq-opt" data-v="'+v+'">'+v+'</div>';}).join('')+'</div></div>';}).join('')}
</div>

<div class="scale-block" id="scale-oss">
  <div class="scale-title">OSS — Oxford Shoulder Score</div>
  <div class="scale-desc">12 itens · 0–4 por item · Score 0–48 · 48 = melhor função</div>
  <div class="scale-score-row"><div class="scale-score" id="oss_score">—</div><div class="scale-interp" id="oss_interp"></div></div>
  <div class="scale-legend">0 Pior &nbsp;·&nbsp; 4 Melhor</div>
  ${[['Dor no ombro nas últimas 4 semanas'],['Interferência nas actividades domésticas ou profissionais'],['Levantar uma caixa cheia do chão para uma mesa'],['Pentear o cabelo'],['Cortar alimentos com a mão do lado afectado'],['Comer com talheres com o membro afectado'],['Fazer compras (carregar saco)'],['Limpeza da casa ou lavar louça'],['Fazer a cama'],['Conduzir'],['Lavar o lado oposto do corpo'],['Satisfação / funcionalidade global do ombro']].map(function(q,i){return '<div class="sq-row"><span class="sq-num">'+(i+1)+'</span><span class="sq-lbl">'+q[0]+'</span><div class="sq-opts">'+'01234'.split('').map(function(v){return '<div class="sq-opt" data-v="'+v+'">'+v+'</div>';}).join('')+'</div></div>';}).join('')}
</div>

</div><!-- end tab-escalas -->

</div><!-- end .page -->
<div id="toast">&#10003; Guardado</div>
<div class="bar-acoes"><button class="btn-pdf" id="btnPdf">Imprimir / PDF</button><button class="btn-copy" id="btnCopy">Copiar &amp; Guardar</button></div>
<script>
${_mskJs}
/* ── TABS ── */
document.querySelectorAll('.ob-tab').forEach(function(btn){
  btn.addEventListener('click',function(){
    document.querySelectorAll('.ob-tab').forEach(function(b){b.classList.remove('active');});
    document.querySelectorAll('.ob-tab-content').forEach(function(c){c.classList.remove('active');});
    btn.classList.add('active');
    document.getElementById('tab-'+btn.dataset.tab).classList.add('active');
  });
});
/* ── ROM CONCENTRIC CIRCLES ── */
var ROM_DEFS=[
  {key:'flex',label:'Flexão',ref:180},
  {key:'ext',label:'Extensão',ref:60},
  {key:'abd',label:'Abdução',ref:180},
  {key:'re',label:'Rot. ext.',ref:90},
  {key:'ri',label:'Rot. int.',ref:70}
];
var ROM_CX=46,ROM_CY=46,ROM_R_OUT=38,ROM_R_IN=26,ROM_R_THRESH=32;
var rc=document.getElementById('rom-container');
ROM_DEFS.forEach(function(r){
  var maxRad=r.ref/180*Math.PI;
  var half=maxRad/2;
  var W=92,H=Math.round(ROM_CY-ROM_R_OUT*Math.cos(half)+ROM_R_OUT+10);
  H=Math.max(H,50);
  function arcPts(R){
    var x1=ROM_CX-R*Math.sin(half),y1=ROM_CY-R*Math.cos(half);
    var x2=ROM_CX+R*Math.sin(half),y2=ROM_CY-R*Math.cos(half);
    var lg=maxRad>Math.PI?1:0;
    return {x1:x1.toFixed(2),y1:y1.toFixed(2),x2:x2.toFixed(2),y2:y2.toFixed(2),lg:lg};
  }
  function makePath(R){
    var e=arcPts(R);
    return 'M '+e.x1+' '+e.y1+' A '+R+' '+R+' 0 '+e.lg+' 1 '+e.x2+' '+e.y2;
  }
  var div=document.createElement('div');
  div.className='rom-item';
  div.innerHTML='<div class="rom-hdr"><span class="rom-label">'+r.label+'</span><span class="rom-ref">ref '+r.ref+'°</span></div>'
    +'<svg id="rsvg_'+r.key+'" class="rom-svg" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" style="cursor:crosshair;display:block;">'
    +'<path d="'+makePath(ROM_R_OUT)+'" fill="none" stroke="#f0f0f0" stroke-width="7" stroke-linecap="round"/>'
    +'<path d="'+makePath(ROM_R_IN)+'" fill="none" stroke="#f0f0f0" stroke-width="5" stroke-linecap="round"/>'
    +'<path id="rarc_'+r.key+'_a" d="'+makePath(ROM_R_OUT)+'" fill="none" stroke="#1a56db" stroke-width="7" stroke-linecap="round" pathLength="100" stroke-dasharray="0 100"/>'
    +'<path id="rarc_'+r.key+'_p" d="'+makePath(ROM_R_IN)+'" fill="none" stroke="#16a34a" stroke-width="5" stroke-linecap="round" pathLength="100" stroke-dasharray="0 100"/>'
    +'</svg>'
    +'<div class="rom-inputs">'
    +'<span class="rom-inp-lbl" style="color:#1a56db;font-weight:700;">A°</span>'
    +'<input class="rom-inp ia" type="number" id="rom_'+r.key+'_a" min="0" max="'+r.ref+'" placeholder="—">'
    +'<span class="rom-inp-lbl" style="color:#16a34a;font-weight:700;">P°</span>'
    +'<input class="rom-inp ip" type="number" id="rom_'+r.key+'_p" min="0" max="'+r.ref+'" placeholder="—">'
    +'</div>';
  rc.appendChild(div);
  (function(key,ref){
    var svg=document.getElementById('rsvg_'+key);
    var ia=document.getElementById('rom_'+key+'_a');
    var ip=document.getElementById('rom_'+key+'_p');
    var aa=document.getElementById('rarc_'+key+'_a');
    var ap=document.getElementById('rarc_'+key+'_p');
    function redraw(){
      var va=Math.min(Math.max(parseFloat(ia.value)||0,0),ref);
      var vp=Math.min(Math.max(parseFloat(ip.value)||0,0),ref);
      var colA=va/ref<0.75?'#dc2626':'#1a56db';
      var colP=vp/ref<0.75?'#dc2626':'#16a34a';
      aa.setAttribute('stroke-dasharray',(va/ref*100).toFixed(2)+' 100');
      ap.setAttribute('stroke-dasharray',(vp/ref*100).toFixed(2)+' 100');
      aa.setAttribute('stroke',colA);
      ap.setAttribute('stroke',colP);
    }
    ia.addEventListener('input',redraw);
    ip.addEventListener('input',redraw);
    svg.addEventListener('click',function(e){
      var rect=svg.getBoundingClientRect();
      var mx=(e.clientX-rect.left)*(92/rect.width);
      var my=(e.clientY-rect.top)*(92/rect.height);
      var dx=mx-ROM_CX,dy=my-ROM_CY;
      var dist=Math.sqrt(dx*dx+dy*dy);
      if(dist<14||dist>ROM_R_OUT+6)return;
      var angle=Math.atan2(dx,-dy);
      var half=r.ref/180*Math.PI/2;
      if(angle<-half||angle>half)return;
      var val=Math.round((angle+half)/(half*2)*ref/5)*5;
      val=Math.max(0,Math.min(val,ref));
      if(dist>ROM_R_THRESH){ia.value=val;}else{ip.value=val;}
      redraw();
    });
  })(r.key,r.ref);
});
/* ── DINAMOMETRIA ── */
function calcDyn(){
  [['re','dyn_re'],['ri','dyn_ri'],['ea','dyn_ea'],['abd','dyn_abd']].forEach(function(p){
    var af=parseFloat(document.getElementById(p[1]+'_af').value)||null;
    var cl=parseFloat(document.getElementById(p[1]+'_cl').value)||null;
    var el=document.getElementById(p[1]+'_def');
    if(af!==null&&cl!==null&&cl>0){
      var d=Math.round((cl-af)/cl*100);
      el.textContent=d+'%';
      el.className=d<10?'dyn-ok':d<20?'dyn-warn':'dyn-bad';
    }else{el.textContent='—';el.className='';}
  });
  var reAf=parseFloat(document.getElementById('dyn_re_af').value)||null;
  var riAf=parseFloat(document.getElementById('dyn_ri_af').value)||null;
  var fpEl=document.getElementById('dyn_re_fp');
  if(reAf&&riAf&&riAf>0){var ratio=reAf/riAf;fpEl.textContent=ratio.toFixed(2);fpEl.className=ratio>=0.6?'dyn-ok':'dyn-bad';}
  else{fpEl.textContent='—';fpEl.className='';}
}
document.querySelectorAll('.dyn-inp').forEach(function(i){i.addEventListener('input',calcDyn);});
/* ── AF2 PASTE IMPORT ── */
document.getElementById('af2_import').addEventListener('click',function(){
  var txt=document.getElementById('af2_paste').value||'';
  if(!txt.trim())return;
  var lado=document.querySelector('.lado-bar .opt.sel');
  var ladoAfect=lado?lado.textContent.trim():'Esquerda';
  var ladoContral=ladoAfect==='Esquerda'?'Direita':'Esquerda';
  var map={
    'Flex':['dyn_ea_af','dyn_ea_cl'],
    'Abdu':['dyn_abd_af','dyn_abd_cl'],
    'Externa':['dyn_re_af','dyn_re_cl'],
    'Interna':['dyn_ri_af','dyn_ri_cl']
  };
  var blocks=txt.split(/====\s*(.+?)\s*====/);
  for(var i=1;i<blocks.length;i+=2){
    var title=blocks[i];
    var block=blocks[i+1]||'';
    var fields=null;
    Object.keys(map).forEach(function(k){
      if(title.indexOf(k)!==-1)fields=map[k];
    });
    if(!fields)continue;
    var fmMatch=block.match(/For\u00e7a M\u00e1xima[\s\S]*?\n([\s\S]*?)(?:\n\n|\nTempo|\nFor\u00e7a M\u00e9dia|\nRela\u00e7\u00e3o|$)/);
    if(!fmMatch)continue;
    var fmBlock=fmMatch[1];
    var isBilateral=title.indexOf('Esquerda')!==-1&&title.indexOf('Direita')!==-1;
    if(isBilateral){
      var esqM=fmBlock.match(/Esquerda:\s*([\d.]+)\s*kg/);
      var dirM=fmBlock.match(/Direita:\s*([\d.]+)\s*kg/);
      var afVal=ladoAfect==='Esquerda'?(esqM?esqM[1]:null):(dirM?dirM[1]:null);
      var clVal=ladoAfect==='Esquerda'?(dirM?dirM[1]:null):(esqM?esqM[1]:null);
      if(afVal){var ea=document.getElementById(fields[0]);if(ea)ea.value=afVal;}
      if(clVal){var ec=document.getElementById(fields[1]);if(ec)ec.value=clVal;}
    } else {
      var uniM=fmBlock.match(/(?:Esquerda|Direita):\s*([\d.]+)\s*kg/);
      if(uniM){
        var side=title.indexOf('Esquerda')!==-1?'Esquerda':'Direita';
        var fi=side===ladoAfect?0:1;
        var eu=document.getElementById(fields[fi]);
        if(eu)eu.value=uniM[1];
      }
    }
  }
  calcDyn();
});
/* ── SCALES: sq-opt click ── */
document.querySelectorAll('.sq-row').forEach(function(row){
  row.querySelectorAll('.sq-opt').forEach(function(btn){
    btn.addEventListener('click',function(){
      row.querySelectorAll('.sq-opt').forEach(function(b){b.classList.remove('sel');});
      btn.classList.add('sel');
      var block=btn.closest('.scale-block');
      if(block)block.dispatchEvent(new Event('recalc'));
    });
  });
});
/* ── DASH ── */
document.getElementById('scale-dash').addEventListener('recalc',function(){
  var vals=[];
  this.querySelectorAll('.sq-row').forEach(function(row){
    var s=row.querySelector('.sq-opt.sel');vals.push(s?parseInt(s.dataset.v):null);
  });
  var filled=vals.filter(function(v){return v!==null;});
  if(!filled.length){document.getElementById('dash_score').textContent='—';document.getElementById('dash_interp').textContent='';return;}
  var sum=filled.reduce(function(a,b){return a+b;},0);
  var n=filled.length;
  var score=Math.round((sum-n)/(n*4)*100);
  document.getElementById('dash_score').textContent=score;
  document.getElementById('dash_interp').textContent=score<=20?'Incapacidade mínima (0-20) - função praticamente normal':score<=40?'Incapacidade ligeira (21-40) - limitação em actividades exigentes':score<=60?'Incapacidade moderada (41-60) - limitação significativa nas AVD':score<=80?'Incapacidade grave (61-80) - grande dependência funcional':'Incapacidade muito grave (81-100) - incapacidade quase total';
});
/* ── ASES ── */
document.getElementById('scale-ases').addEventListener('recalc',function(){
  var evaVal=parseFloat(document.getElementById('ases_eva').value);
  var vals=[];
  this.querySelectorAll('.sq-row').forEach(function(row){
    var s=row.querySelector('.sq-opt.sel');vals.push(s?parseInt(s.dataset.v):null);
  });
  var filled=vals.filter(function(v){return v!==null;});
  var pain=!isNaN(evaVal)?50*(1-evaVal/10):null;
  var func=filled.length?50*(filled.reduce(function(a,b){return a+b;},0)/30):null;
  if(pain===null&&func===null){document.getElementById('ases_score').textContent='—';document.getElementById('ases_interp').textContent='';return;}
  var score=Math.round((pain||0)+(func||0));
  document.getElementById('ases_score').textContent=score;
  document.getElementById('ases_interp').textContent=score>=80?'Boa / Excelente - função preservada, sem limitação significativa':score>=60?'Satisfatório - limitação moderada em actividades exigentes':score>=40?'Moderado - limitação marcada, impacto nas AVD':' Fraco - incapacidade grave, limitação em actividades básicas';
});
document.getElementById('ases_eva').addEventListener('input',function(){
  document.getElementById('scale-ases').dispatchEvent(new Event('recalc'));
});
/* ── OSS ── */
document.getElementById('scale-oss').addEventListener('recalc',function(){
  var vals=[];
  this.querySelectorAll('.sq-row').forEach(function(row){
    var s=row.querySelector('.sq-opt.sel');vals.push(s?parseInt(s.dataset.v):null);
  });
  var filled=vals.filter(function(v){return v!==null;});
  if(!filled.length){document.getElementById('oss_score').textContent='—';document.getElementById('oss_interp').textContent='';return;}
  var sum=filled.reduce(function(a,b){return a+b;},0);
  document.getElementById('oss_score').textContent=sum;
  document.getElementById('oss_interp').textContent=sum>=40?'Excelente (40-48) - sem sintomas relevantes':sum>=30?'Bom (30-39) - sintomas ligeiros, função conservada':sum>=20?'Moderado (20-29) - dor e limitação funcionais significativas':'Fraco (<20) - sintomas graves, incapacidade marcada';
});
/* ── _gerarData ── */
window._gerarData=function(){
var g=window._getOpt,m=window._getMulti;
var rv=function(id){var el=document.getElementById(id);return el&&el.value!==''?parseFloat(el.value):null;};
var rs=function(id){var el=document.getElementById(id);return el?(el.value.trim()||null):null;};
var ladoEl=document.querySelector('#lado .opt.sel');
function getItems(blockId){
  var vals=[];
  document.querySelectorAll('#'+blockId+' .sq-row').forEach(function(row){var s=row.querySelector('.sq-opt.sel');vals.push(s?parseInt(s.dataset.v):null);});
  return vals;
}
return{
  lado:ladoEl?ladoEl.dataset.v:null,
  eva:{rep:g('eva_rep')||null,act:g('eva_act')||null,pic:g('eva_pic')||null},
  tipo_dor:g('tipo_dor')||null,
  localizacao_dor:m('localizacao_dor'),
  irradiacao:g('irradiacao')||null,
  d_noturna:g('d_noturna')||null,
  palp:{ac:g('palp_ac')||null,tb:g('palp_tb')||null,bic:g('palp_bic')||null,bur:g('palp_bur')||null,sup:g('palp_sup')||null},
  rom:{flex_a:rv('rom_flex_a'),flex_p:rv('rom_flex_p'),ext_a:rv('rom_ext_a'),ext_p:rv('rom_ext_p'),abd_a:rv('rom_abd_a'),abd_p:rv('rom_abd_p'),re_a:rv('rom_re_a'),re_p:rv('rom_re_p'),ri_a:rv('rom_ri_a'),ri_p:rv('rom_ri_p')},
  mrc:{sup:g('f_sup')||null,inf:g('f_inf')||null,sub:g('f_sub')||null,del:g('f_del')||null},
  testes:{neer:g('t_neer')||null,hawk:g('t_hawk')||null,jobe:g('t_jobe')||null,patte:g('t_patte')||null,liftoff:g('t_liftoff')||null,belly:g('t_belly')||null,drop:g('t_drop')||null,speed:g('t_speed')||null,yerg:g('t_yerg')||null,appr:g('t_appr')||null,reloc:g('t_reloc')||null,sulc:g('t_sulc')||null},
  dyn:{re_af:rv('dyn_re_af'),re_cl:rv('dyn_re_cl'),ri_af:rv('dyn_ri_af'),ri_cl:rv('dyn_ri_cl'),ea_af:rv('dyn_ea_af'),ea_cl:rv('dyn_ea_cl'),abd_af:rv('dyn_abd_af'),abd_cl:rv('dyn_abd_cl')},
  func:{elev:g('func_elev')||null,cos:g('func_cos')||null,vest:g('func_vest')||null,prof:g('func_prof')||null,desp:g('func_desp')||null,cond:g('func_cond')||null},
  escalas:{
    dash_score:parseInt(document.getElementById('dash_score').textContent)||null,
    dash_items:getItems('scale-dash'),
    ases_eva:rv('ases_eva'),
    ases_score:parseInt(document.getElementById('ases_score').textContent)||null,
    ases_items:getItems('scale-ases'),
    oss_score:parseInt(document.getElementById('oss_score').textContent)||null,
    oss_items:getItems('scale-oss')
  },
  notas_mob:rs('notas_mob'),notas_palp:rs('notas_palp'),notas_testes:rs('notas_testes'),notas_forca:rs('notas_forca')
};
};
/* ── CTX & SAVE ── */
window._examCtx=${JSON.stringify({patientId:ctx.patientId||null,clinicId:ctx.clinicId||null,consultationId:ctx.consultationId||null})};
window._saveExamToSupabase=async function(txt,dataObj){
  var c=window._examCtx||{};
  if(!c.consultationId)return;
  try{
    var sb=window.opener&&window.opener.sb;
    if(!sb)return;
    var userRes=await sb.auth.getUser();
    var authorId=userRes&&userRes.data&&userRes.data.user?userRes.data.user.id:null;
    var payload=Object.assign({resumo:txt},dataObj||{});
    var res=await sb.from('consultation_assessments').insert({
      consultation_id:c.consultationId,
      patient_id:c.patientId,
      clinic_id:c.clinicId,
      author_user_id:authorId,
      assessment_type:'ombro',
      assessment_date:new Date().toISOString().split('T')[0],
      data:payload
    });
    if(res.error)console.error('saveExam:',res.error);
  }catch(e){console.error('saveExam:',e);}
};
window._gerarResumo=function(){
  var linhas=[];
  var lado=document.querySelector('.lado-bar .opt.sel');
  if(lado)linhas.push('OMBRO '+lado.textContent.toUpperCase());
  var tipoDor=[...document.querySelectorAll('#tipo_dor .opt.sel')].map(function(o){return o.dataset.v;});
  if(tipoDor.length)linhas.push('Tipo de dor: '+tipoDor.join(', '));
  var locDor=[...document.querySelectorAll('#loc_dor .opt.sel')].map(function(o){return o.dataset.v;});
  if(locDor.length)linhas.push('Localizacao: '+locDor.join(', '));
  var noturna=document.querySelector('#d_noturna .opt.sel');
  if(noturna)linhas.push('Dor nocturna: '+noturna.dataset.v);
  var evaRep=document.querySelector('#eva_rep .opt.sel');
  var evaAct=document.querySelector('#eva_act .opt.sel');
  var evaPic=document.querySelector('#eva_pic .opt.sel');
  var evaStr=[];
  if(evaRep)evaStr.push('repouso '+evaRep.dataset.v);
  if(evaAct)evaStr.push('actividade '+evaAct.dataset.v);
  if(evaPic)evaStr.push('pico '+evaPic.dataset.v);
  if(evaStr.length)linhas.push('EVA: '+evaStr.join(' | '));
  linhas.push('');
  linhas.push('PALPACAO');
  document.querySelectorAll('.palp-row').forEach(function(row){
    var lbl=row.querySelector('.palp-lbl');
    var sel=row.querySelector('.opt.sel');
    if(lbl&&sel)linhas.push('  '+lbl.textContent+': '+sel.dataset.v);
  });
  var notasPalp=document.getElementById('notas_palp');
  if(notasPalp&&notasPalp.value.trim())linhas.push('  Notas: '+notasPalp.value.trim());
  linhas.push('');
  linhas.push('AMPLITUDE ARTICULAR');
  [{k:'flex',l:'Flexao',r:180},{k:'ext',l:'Extensao',r:60},{k:'abd',l:'Abducao',r:180},{k:'re',l:'Rot. ext.',r:90},{k:'ri',l:'Rot. int.',r:70}].forEach(function(m){
    var ia=document.getElementById('rom_'+m.k+'_a');
    var ip=document.getElementById('rom_'+m.k+'_p');
    var va=ia&&ia.value?ia.value:'?';
    var vp=ip&&ip.value?ip.value:'?';
    linhas.push('  '+m.l+': A '+va+'graus / P '+vp+'graus (ref '+m.r+'graus)');
  });
  var notasMob=document.getElementById('notas_mob');
  if(notasMob&&notasMob.value.trim())linhas.push('  Notas: '+notasMob.value.trim());
  linhas.push('');
  linhas.push('FORCA MRC');
  document.querySelectorAll('.mrc-row').forEach(function(row){
    var lbl=row.querySelector('.mrc-lbl');
    var sel=row.querySelector('.opt.sel');
    if(lbl&&sel)linhas.push('  '+lbl.textContent+': '+sel.dataset.v);
  });
  linhas.push('');
  linhas.push('TESTES CLINICOS ESPECIAIS');
  document.querySelectorAll('.teste-row').forEach(function(row){
    var lbl=row.querySelector('.teste-lbl');
    var sel=row.querySelector('.opt.sel');
    if(lbl&&sel&&sel.dataset.v!=='Negativo')linhas.push('  '+lbl.textContent+': '+sel.dataset.v);
  });
  var notasTestes=document.getElementById('notas_testes');
  if(notasTestes&&notasTestes.value.trim())linhas.push('  Notas: '+notasTestes.value.trim());
  linhas.push('');
  linhas.push('DINAMOMETRIA (ActivForce 2)');
  [['re','Rot. externa'],['ri','Rot. interna'],['ea','Elevacao ant.'],['abd','Abducao']].forEach(function(p){
    var af=document.getElementById('dyn_'+p[0]+'_af');
    var cl=document.getElementById('dyn_'+p[0]+'_cl');
    var def=document.getElementById('dyn_'+p[0]+'_def');
    if(af&&af.value)linhas.push('  '+p[1]+': Afect. '+af.value+'kg / Contral. '+(cl&&cl.value?cl.value:'?')+'kg'+(def&&def.textContent&&def.textContent!='?'?' Defice '+def.textContent:''));
  });
  linhas.push('');
  linhas.push('FUNCIONAL');
  document.querySelectorAll('.func-row').forEach(function(row){
    var lbl=row.querySelector('.func-lbl');
    var sel=row.querySelector('.opt.sel');
    if(lbl&&sel&&sel.dataset.v!=='Normal')linhas.push('  '+lbl.textContent+': '+sel.dataset.v);
  });
  linhas.push('');
  linhas.push('-- ESCALAS FUNCIONAIS --');
  var dashScore=document.getElementById('dash_score');
  var dashInterp=document.getElementById('dash_interp');
  if(dashScore&&dashScore.textContent&&dashScore.textContent!='?'){
    linhas.push('DASH: '+dashScore.textContent+'/100');
    if(dashInterp&&dashInterp.textContent)linhas.push('  '+dashInterp.textContent);
    document.querySelectorAll('#scale-dash .sq-row').forEach(function(row){
      var lbl=row.querySelector('.sq-lbl');
      var sel=row.querySelector('.sq-opt.sel');
      if(lbl&&sel)linhas.push('  - '+lbl.textContent.trim()+': '+sel.textContent.trim());
    });
  }
  var asesScore=document.getElementById('ases_score');
  var asesInterp=document.getElementById('ases_interp');
  if(asesScore&&asesScore.textContent&&asesScore.textContent!='?'){
    linhas.push('ASES: '+asesScore.textContent+'/100');
    if(asesInterp&&asesInterp.textContent)linhas.push('  '+asesInterp.textContent);
    document.querySelectorAll('#scale-ases .sq-row').forEach(function(row){
      var lbl=row.querySelector('.sq-lbl');
      var sel=row.querySelector('.sq-opt.sel');
      if(lbl&&sel)linhas.push('  - '+lbl.textContent.trim()+': '+sel.textContent.trim());
    });
  }
  var ossScore=document.getElementById('oss_score');
  var ossInterp=document.getElementById('oss_interp');
  if(ossScore&&ossScore.textContent&&ossScore.textContent!='?'){
    linhas.push('OSS: '+ossScore.textContent+'/48');
    if(ossInterp&&ossInterp.textContent)linhas.push('  '+ossInterp.textContent);
    document.querySelectorAll('#scale-oss .sq-row').forEach(function(row){
      var lbl=row.querySelector('.sq-lbl');
      var sel=row.querySelector('.sq-opt.sel');
      if(lbl&&sel)linhas.push('  - '+lbl.textContent.trim()+': '+sel.textContent.trim());
    });
  }
  return linhas.join(String.fromCharCode(10));
};
</script></body></html>`, "width=1100,height=820,scrollbars=yes");
    return;
}
