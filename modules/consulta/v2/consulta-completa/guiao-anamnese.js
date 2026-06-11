// guiao-anamnese.js
// Guião de anamnese — aide-mémoire horizontal colapsável.
// Não grava nada na BD. Exporta: buildGuiaoHTML(), initGuiao(quill)

const LINHAS = [
  { k: 'Início e duração',      t: 'súbito (momento específico) ou gradual? Há quanto tempo? (dias → mais de 1 ano)' },
  { k: 'Evolução e frequência', t: 'piorou / igual / melhorou / variável? Contínuo ou vai e vem?' },
  { k: 'Sintomas',              t: 'dor, rigidez (matinal/início actividade), perda de força, instabilidade, parestesias/dormência, perda sensibilidade, fadiga, limitação mobilidade. Em repouso / com / após movimento?' },
  { k: 'Contexto e agravantes', t: 'surgiu em actividade (desporto/trabalho)? Agrava com flexão tronco, marcha, agachar, levantar, calçar? Irradia? Outras articulações?' },
  { k: 'Antecedentes',          t: 'pessoais, factores de risco, medicação' },
  { k: 'Red flags',             t: 'dor nocturna não mecânica, perda ponderal, febre, défice neurológico progressivo, trauma major, antecedente oncológico' },
];

export function buildGuiaoHTML() {
  const linhasHTML = LINHAS.map((l, i) => {
    const isLast = i === LINHAS.length - 1;
    const cls = isLast ? 'fc-guiao-linha fc-guiao-redflag' : 'fc-guiao-linha';
    return `<div class="${cls}"><span class="fc-guiao-k">${l.k}</span> — ${l.t}</div>`;
  }).join('');

  return `
    <div class="fc-guiao-bar" id="fc-guiao-bar">
      <i class="ti ti-checklist fc-guiao-ico" aria-hidden="true"></i>
      <div class="fc-guiao-conteudo">
        ${linhasHTML}
      </div>
      <div class="fc-guiao-fechado">
        <span>Guião de anamnese</span><span class="fc-guiao-hint">o que perguntar</span>
      </div>
      <i class="ti ti-chevron-up fc-guiao-chev" id="fc-guiao-chev" aria-hidden="true"></i>
    </div>`;
}

export function initGuiao(quill, hdaStr) {
  const bar = document.getElementById('fc-guiao-bar');
  if (!bar) return;

  // hdaStr (string original) tem precedência; fallback para quill.getText()
  const temHDA = hdaStr != null
    ? String(hdaStr).trim().length > 0
    : quill && quill.getText().trim().length > 0;
  if (temHDA) bar.classList.add('fc-guiao-collapsed');

  bar.addEventListener('click', () => {
    bar.classList.toggle('fc-guiao-collapsed');
  });
}
