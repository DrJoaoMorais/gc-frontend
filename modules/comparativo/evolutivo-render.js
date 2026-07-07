/* =================================================================
   evolutivo-render.js · Render HTML do Quadro Evolutivo
   -----------------------------------------------------------------
   - Extraído de feed-doente.html (função local renderEvoTabelas)
     em 2026-07-07, para ser partilhado entre o feed do doente e o
     Relatório da Consulta v2.
   - Função pura: recebe (estrutura, datas), devolve string HTML.
   - Consome directamente a saída de construirEvolutivo()
     (modules/comparativo/evolutivo-motor.js).
   - Não alterar a lógica de cores/selos/deltas sem sincronizar
     visualmente com o feed do doente (mesmo componente visual).
   ================================================================= */

export function renderEvoTabelas(estrutura, datas) {
  const isLatest = (d) => d === datas[datas.length - 1];
  const fmtD = (d) => {
    if (!d) return '';
    const [y, m, dia] = d.split('-');
    const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    return `${parseInt(dia)} ${meses[parseInt(m)-1]}`;
  };
  const sealHtml = (val) => {
    const v = String(val).trim();
    if (!v || v === 'neg') return `<span class="evo-seal neg">neg</span>`;
    if (v === '+')   return `<span class="evo-seal pos1">+</span>`;
    if (v === '++')  return `<span class="evo-seal pos2">++</span>`;
    if (v === '+++') return `<span class="evo-seal pos2">+++</span>`;
    return `<span class="evo-seal pos1">${v}</span>`;
  };
  let html = '';
  for (const regiao of estrutura) {
    html += `<div class="evo-regiao-wrap">`;
    html += `<div class="evo-regiao-label">${regiao.regiaoLabel}</div>`;
    html += `<table class="evo-table"><thead><tr>`;
    html += `<th class="evo-col-param">Parâmetro</th>`;
    for (const d of regiao.datas) {
      const cls = isLatest(d) ? ' evo-col-latest' : '';
      const star = isLatest(d) ? ' ★' : '';
      html += `<th class="${cls}">${fmtD(d)}${star}</th>`;
    }
    html += `</tr></thead><tbody>`;
    for (const [grupo, linhas] of Object.entries(regiao.grupos)) {
      html += `<tr class="evo-grupo-row"><td colspan="${regiao.datas.length + 1}">${grupo}</td></tr>`;
      for (const linha of linhas) {
        html += `<tr>`;
        const unit = linha.unidade ? ` <span class="evo-unit">${linha.unidade}</span>` : '';
        html += `<td class="evo-col-param">${linha.label}${unit}</td>`;
        linha.valores.forEach((val, i) => {
          const cls = isLatest(regiao.datas[i]) ? ' evo-col-latest' : '';
          const delta = linha.deltas[i];
          let celula = '';
          if (val == null) {
            celula = `<span class="evo-empty">—</span>`;
          } else if (linha.tipo === 'teste') {
            celula = sealHtml(val);
          } else if (linha.tipo === 'mrc') {
            celula = `${val}/5`;
          } else if (linha.tipo === 'func') {
            celula = `<span style="font-size:11px">${val}</span>`;
          } else {
            celula = String(val);
          }
          if (delta) {
            const sinal = delta.valor > 0 ? '+' : '';
            celula += `<span class="evo-delta ${delta.classe}">${delta.seta || ''}${sinal}${delta.valor}</span>`;
          }
          html += `<td class="${cls}">${celula}</td>`;
        });
        html += `</tr>`;
      }
    }
    html += `</tbody></table></div>`;
  }
  return html;
}
