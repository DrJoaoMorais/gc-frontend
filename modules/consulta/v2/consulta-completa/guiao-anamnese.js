// guiao-anamnese.js
// Guião de anamnese — aide-mémoire, não grava nada na BD.
// Exporta: buildGuiaoHTML(), initGuiao(quill)

const SECCOES = [
  {
    icon: 'ti-clock', cor: '#93c5fd', label: 'Início',
    chips: ['Súbito', 'Gradual', 'Insidioso', '< 6 sem', '6sem–3m', '> 6m', 'Desportivo', 'Laboral', 'Doméstico', 'Sem causa'],
  },
  {
    icon: 'ti-trending-up', cor: '#93c5fd', label: 'Evolução',
    chips: ['Piora', 'Estável', 'Melhora', 'Flutuante', 'Noturno', 'Matinal', 'Fisioterapia', 'AINE', 'Infiltração', 'Sem trat. prévio'],
  },
  {
    icon: 'ti-bolt', cor: '#fbbf24', label: 'Agrav. / Aliv.',
    chips: ['Movimento', 'Carga', 'Posição', 'Esforço', 'Noite', 'Repouso', 'Calor', 'AINE', 'AVD', 'Trabalho', 'Sono'],
  },
  {
    icon: 'ti-activity', cor: '#93c5fd', label: 'Neuro / Irrad.',
    chips: ['Irrad. MS', 'Irrad. MI', 'Nádega', 'Sem irradiação', 'Formigueiro', 'Dormência', 'Ardor', 'Défice motor', 'Alt. marcha'],
  },
  {
    icon: 'ti-heart-rate-monitor', cor: '#93c5fd', label: 'Ant. Pessoais',
    chips: ['DM', 'HTA', 'Neoplasia', 'Cirurgia prévia', 'Osteoporose', 'Imunossupressão', 'Sem relevantes'],
  },
  {
    icon: 'ti-pill', cor: '#93c5fd', label: 'Medicação',
    chips: ['AINE', 'Anticoagulante', 'Corticoide', 'Imunossupressor', 'Analgésico', 'Nenhuma relevante'],
  },
];

const ESTRUTURA = [
  ['Início', ''],
  ['Evolução', ''],
  ['Factores agravantes', ''],
  ['Factores aliviantes', ''],
  ['Irradiação', ''],
  ['Sintomas neurológicos', ''],
  ['Ant. pessoais relevantes', ''],
  ['Medicação habitual', ''],
  ['Impacto funcional', ''],
];

export function buildGuiaoHTML() {
  const secsHTML = SECCOES.map(s => `
    <div class="fc-guiao-sec">
      <div class="fc-guiao-sec-lbl" style="color:${s.cor}">
        <i class="ti ${s.icon}" aria-hidden="true"></i> ${s.label}
      </div>
      <div class="fc-guiao-chips">
        ${s.chips.map(c => `<span class="fc-guiao-chip">${c}</span>`).join('')}
      </div>
    </div>`).join('');

  return `
    <div class="fc-guiao-head">
      <div class="fc-guiao-htitle">
        <i class="ti ti-checklist" aria-hidden="true"></i> Guião
      </div>
      <span class="fc-guiao-aide">aide-mémoire</span>
    </div>
    <div class="fc-guiao-body">
      ${secsHTML}
      <div class="fc-guiao-redflag">
        <i class="ti ti-alert-triangle" aria-hidden="true"></i>
        Lembra-te das <strong>red flags</strong>
      </div>
    </div>
    <div class="fc-guiao-footer">
      <button class="fc-guiao-btn-ins" id="btn-inserir-estrutura" type="button">
        <i class="ti ti-plus" aria-hidden="true"></i> Inserir estrutura
      </button>
    </div>`;
}

export function initGuiao(quill) {
  const btn = document.getElementById('btn-inserir-estrutura');
  if (!btn || !quill) return;

  btn.addEventListener('click', () => {
    const temConteudo = quill.getText().trim().length > 0;
    if (temConteudo && !confirm('O HDA já tem conteúdo. Inserir estrutura mesmo assim?')) return;

    quill.setContents([]);
    let idx = 0;
    ESTRUTURA.forEach(([chave]) => {
      quill.insertText(idx, chave + ':', { bold: true });
      idx += chave.length + 1;
      quill.insertText(idx, ' \n', { bold: false });
      idx += 2;
    });
    quill.setSelection(ESTRUTURA[0][0].length + 2, 0);

    btn.innerHTML = '<i class="ti ti-check" aria-hidden="true"></i> Inserida';
    btn.disabled = true;
    setTimeout(() => {
      btn.innerHTML = '<i class="ti ti-plus" aria-hidden="true"></i> Inserir estrutura';
      btn.disabled = false;
    }, 2500);
  });
}
