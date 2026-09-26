// Assistente IA — painel único em conversa contínua, na coluna direita da
// consulta. Fechado = aba discreta; aberto = painel, na mesma posição.
// 3 atalhos (História / Analisar / Plano-Reabilitação) + texto livre, tudo
// na mesma thread — nunca ecrãs/formulários separados.
//
// Este módulo NUNCA decide se a resposta é real ou fictícia: recebe uma
// função `respond(kind, userText)` injectada de fora, que devolve uma
// Promise com as secções a mostrar. Nesta ronda, o chamador (feed-doente.html)
// injecta um `respond` com dados fictícios — zero pedidos de rede aqui.
// Numa ronda futura, troca-se só o `respond` por uma chamada real ao
// ai-proxy; este ficheiro não muda.
//
// Toda a resposta é sempre inserida via textContent — nunca via innerHTML —
// mesmo vindo de dados "de confiança", para manter o mesmo princípio de
// segurança usado em todo o resto do editor clínico.

let stylesInjected = false;
function ensureAssistantPanelStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    /* Layout de duas colunas: reaproveita o nome de classe "clinical-ai-layout" só para
       activar a regra .fd-page:has(.clinical-ai-layout) já existente em feed-doente.html;
       toda a restante estilização vive em .gcai-layout, própria deste módulo. */
    .gcai-layout{display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start}
    .gcai-layout>.ql-container{flex:1 1 520px;min-width:520px}
    @media (max-width:1080px){
      .gcai-layout>.ql-container{min-width:0;flex-basis:auto}
      .gcai-panel{flex:1 1 auto;width:100%!important;max-width:none!important}
    }

    .gcai-rail{flex:0 0 auto;align-self:flex-start;position:sticky;top:16px}
    .gcai-tab{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 14px;border-radius:8px;border:1px solid #a9c8f5;background:#eaf1ff;color:#1a56db;font-weight:700;font-size:12.5px;cursor:pointer;white-space:nowrap;font-family:inherit}
    .gcai-tab:hover{background:#dbe9ff}
    .gcai-tab[hidden]{display:none}
    .gcai-panel{width:min(420px,32vw);min-width:360px;background:#fff;border:1px solid #e7ecf3;border-radius:10px;display:flex;flex-direction:column;height:calc(100vh - 40px);font-family:inherit}
    .gcai-panel[hidden]{display:none}
    .gcai-header{padding:13px 14px;border-bottom:1px solid #e7ecf3;display:flex;align-items:center;gap:8px}
    .gcai-header b{font-size:14px;color:#0f172a}
    .gcai-close{margin-left:auto;width:26px;height:26px;border-radius:7px;border:0;background:transparent;color:#64748b;cursor:pointer;font-size:14px}
    .gcai-close:hover{background:#f1f5f9}
    .gcai-thread{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px}
    .gcai-msg{max-width:88%;font-size:13px;line-height:1.55;padding:9px 11px;border-radius:10px}
    .gcai-msg-assistant{align-self:flex-start;background:#f1f5f9;color:#0f172a;border-bottom-left-radius:3px}
    .gcai-msg-user{align-self:flex-end;background:#1a56db;color:#fff;border-bottom-right-radius:3px}
    .gcai-msg h4{margin:0 0 4px;font-size:12.5px;font-weight:800}
    .gcai-msg ul{margin:4px 0;padding-left:16px}
    .gcai-msg li{margin-bottom:3px}
    .gcai-msg p{margin:4px 0}
    .gcai-shortcuts{display:flex;gap:6px;flex-wrap:wrap;padding:0 14px 10px}
    .gcai-shortcut-btn{flex:1 1 auto;min-width:104px;height:30px;border-radius:7px;border:1px solid #e7ecf3;background:#fff;color:#334155;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit}
    .gcai-shortcut-btn:hover{background:#f8fafc;border-color:#a9c8f5}
    .gcai-composer{border-top:1px solid #e7ecf3;padding:10px;display:flex;gap:8px}
    .gcai-composer textarea{flex:1;resize:none;height:38px;border:1px solid #e7ecf3;border-radius:8px;padding:8px 10px;font:inherit;font-size:12.5px}
    .gcai-composer textarea:focus{outline:2px solid #1a56db;outline-offset:1px;border-color:#1a56db}
    .gcai-send{width:38px;height:38px;border-radius:8px;border:1px solid #1a56db;background:#1a56db;color:#fff;font-size:15px;cursor:pointer}
    .gcai-send:hover{background:#1547b8}
    .gcai-typing{align-self:flex-start;font-size:12px;color:#64748b;padding:0 2px}
    .gcai-hda-proposal{border:1px solid #99ded6;background:#f0fbfa}
    .gcai-hda-compare{margin-top:8px;padding-top:8px;border-top:1px dashed #cbd5e1}
    .gcai-hda-compare-label{font-size:11.5px;font-weight:700;color:#64748b;margin-bottom:2px}
    .gcai-hda-actions{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}
    .gcai-hda-apply-btn,.gcai-hda-compare-btn,.gcai-hda-discard-btn{height:28px;padding:0 11px;border-radius:6px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit}
    .gcai-hda-apply-btn{border:1px solid #0d9488;background:#0d9488;color:#fff}
    .gcai-hda-apply-btn:hover{background:#0b7d73}
    .gcai-hda-compare-btn{border:1px solid #cbd5e1;background:#fff;color:#334155}
    .gcai-hda-compare-btn:hover{background:#f8fafc}
    .gcai-hda-discard-btn{border:1px solid #e7ecf3;background:#fff;color:#94a3b8}
    .gcai-hda-discard-btn:hover{background:#f8fafc;color:#64748b}
    .gcai-hda-applied-note{margin-top:8px;font-size:12px;font-weight:700;color:#0d9488}
  `;
  document.head.appendChild(style);
}

const SHORTCUT_LABELS_INITIAL = { melhorar: 'Melhorar HDA', analisar: 'Analisar caso', plano: 'Plano / Reabilitação' };

// Campos de patient() considerados "claramente anamnésticos" — a única
// informação de identificação do doente que pode entrar no contexto de
// Melhorar HDA. Tudo o resto (nome, contactos, morada, seguro, notas
// administrativas, etc.) fica de fora de propósito: Melhorar HDA só pode
// usar dados que sejam inequivocamente anamnese, nunca dados que possam
// ser confundidos com algo dito nesta consulta.
const ANAMNESTIC_PATIENT_FIELDS = ['dob'];
function anamnesticPatientContext(patient) {
  if (!patient || typeof patient !== 'object') return {};
  const out = {};
  for (const key of ANAMNESTIC_PATIENT_FIELDS) {
    if (patient[key] != null && patient[key] !== '') out[key] = patient[key];
  }
  return out;
}

export function mountAssistantPanel(quill, { patient = () => null, respond, getConsultationContext = () => ({}) } = {}) {
  ensureAssistantPanelStyles();
  if (typeof respond !== 'function') throw new Error('mountAssistantPanel: respond é obrigatório.');

  let layout = quill.__gcaiLayout;
  if (!layout) {
    layout = document.createElement('div');
    layout.className = 'clinical-ai-layout gcai-layout';
    quill.container.replaceWith(layout);
    layout.append(quill.container);
    quill.__gcaiLayout = layout;
  }

  const rail = document.createElement('div');
  rail.className = 'gcai-rail';
  rail.innerHTML = '<button type="button" class="gcai-tab" data-action="open">✦ Assistente IA</button>' +
    '<aside class="gcai-panel" hidden aria-label="Assistente IA">' +
    '<div class="gcai-header"><b>Assistente IA</b><button type="button" class="gcai-close" data-action="close" aria-label="Fechar">✕</button></div>' +
    '<div class="gcai-thread" data-thread></div>' +
    '<div class="gcai-shortcuts">' +
    '<button type="button" class="gcai-shortcut-btn" data-shortcut="melhorar">Melhorar HDA</button>' +
    '<button type="button" class="gcai-shortcut-btn" data-shortcut="analisar">Analisar caso</button>' +
    '<button type="button" class="gcai-shortcut-btn" data-shortcut="plano">Plano / Reabilitação</button>' +
    '</div>' +
    '<form class="gcai-composer" data-composer>' +
    '<textarea data-input placeholder="Escreve aqui o que precisas…"></textarea>' +
    '<button type="submit" class="gcai-send" aria-label="Enviar">➤</button>' +
    '</form>' +
    '</aside>';
  layout.append(rail);

  const tabBtn = rail.querySelector('[data-action="open"]');
  const panel = rail.querySelector('.gcai-panel');
  const closeBtn = rail.querySelector('[data-action="close"]');
  const thread = rail.querySelector('[data-thread]');
  const composer = rail.querySelector('[data-composer]');
  const input = rail.querySelector('[data-input]');

  let opened = false;
  // Rótulos por atalho — mutáveis por instância (nunca partilhados entre painéis).
  // "analisar" muda de "Analisar caso" para "Actualizar análise" depois da 1ª análise
  // bem sucedida, para deixar claro que já existe uma análise a actualizar.
  const labels = { ...SHORTCUT_LABELS_INITIAL };
  const analiseBtn = rail.querySelector('[data-shortcut="analisar"]');
  // A bolha da última análise (kind 'analisar') — guardada para ser SUBSTITUÍDA,
  // nunca acumulada, quando o médico pede uma nova análise sobre o estado actual.
  let analiseMsgEl = null;
  // O cartão da última proposta de HDA AINDA POR DECIDIR (nem Aplicada nem
  // Descartada) — guardado só para ser substituído por uma proposta mais
  // recente ainda pendente; uma proposta já Aplicada ou Descartada deixa de
  // ser "pendente" e não é tocada por pedidos seguintes.
  let hdaProposalEl = null;

  function open() {
    panel.hidden = false;
    tabBtn.hidden = true;
    if (!opened) {
      opened = true;
      addAssistant([{ text: 'Tenho o contexto desta consulta. Em que posso ajudar?' }]);
    }
  }
  function close() { panel.hidden = true; tabBtn.hidden = false; }
  tabBtn.onclick = open;
  closeBtn.onclick = close;

  function scrollThread() { thread.scrollTop = thread.scrollHeight; }

  function addUser(text) {
    const div = document.createElement('div');
    div.className = 'gcai-msg gcai-msg-user';
    div.textContent = text;
    thread.append(div);
    scrollThread();
  }
  // 'sections' é sempre uma estrutura de dados simples (nunca HTML/DOM vindo de fora);
  // este é o único sítio que a transforma em elementos, sempre via textContent.
  // isAnalysis=true → a bolha da análise anterior é removida primeiro: a nova
  // análise SUBSTITUI a anterior na conversa, nunca fica acumulada ao lado dela.
  function addAssistant(sections, { isAnalysis = false } = {}) {
    if (isAnalysis && analiseMsgEl?.isConnected) analiseMsgEl.remove();
    const div = document.createElement('div');
    div.className = 'gcai-msg gcai-msg-assistant';
    for (const s of sections) {
      if (s.heading) { const h = document.createElement('h4'); h.textContent = s.heading; div.append(h); }
      if (s.text) { const p = document.createElement('p'); p.textContent = s.text; div.append(p); }
      if (s.items) {
        const ul = document.createElement('ul');
        s.items.forEach(t => { const li = document.createElement('li'); li.textContent = t; ul.append(li); });
        div.append(ul);
      }
    }
    thread.append(div);
    if (isAnalysis) analiseMsgEl = div;
    scrollThread();
  }
  function addTyping() {
    const div = document.createElement('div');
    div.className = 'gcai-typing';
    div.textContent = 'Assistente IA a escrever…';
    thread.append(div);
    scrollThread();
    return () => div.remove();
  }

  // Cartão de proposta de HDA melhorada — visualmente distinto de uma bolha
  // normal (nunca usa addAssistant/sections[]). "Aplicar" é o ÚNICO sítio de
  // todo este módulo que altera o Quill; a persistência em BD continua a
  // acontecer só pelo mecanismo normal de gravação da consulta (este módulo
  // nunca escreve directamente na BD nem duplica essa lógica).
  function addHdaProposal(proposedText, originalText) {
    if (hdaProposalEl?.isConnected) hdaProposalEl.remove();
    const div = document.createElement('div');
    div.className = 'gcai-msg gcai-msg-assistant gcai-hda-proposal';

    const label = document.createElement('h4');
    label.textContent = 'Proposta de HDA melhorada';
    div.append(label);

    const p = document.createElement('p');
    p.textContent = proposedText;
    div.append(p);

    const compareBox = document.createElement('div');
    compareBox.className = 'gcai-hda-compare';
    compareBox.hidden = true;
    const compareLabel = document.createElement('div');
    compareLabel.className = 'gcai-hda-compare-label';
    compareLabel.textContent = 'HDA actual (antes):';
    const compareText = document.createElement('p');
    compareText.textContent = originalText || '(vazia)';
    compareBox.append(compareLabel, compareText);
    div.append(compareBox);

    const actions = document.createElement('div');
    actions.className = 'gcai-hda-actions';
    const applyBtn = document.createElement('button');
    applyBtn.type = 'button';
    applyBtn.className = 'gcai-hda-apply-btn';
    applyBtn.textContent = 'Aplicar';
    const compareBtn = document.createElement('button');
    compareBtn.type = 'button';
    compareBtn.className = 'gcai-hda-compare-btn';
    compareBtn.textContent = 'Comparar';
    const discardBtn = document.createElement('button');
    discardBtn.type = 'button';
    discardBtn.className = 'gcai-hda-discard-btn';
    discardBtn.textContent = 'Descartar';
    actions.append(applyBtn, compareBtn, discardBtn);
    div.append(actions);

    compareBtn.onclick = () => {
      compareBox.hidden = !compareBox.hidden;
      compareBtn.textContent = compareBox.hidden ? 'Comparar' : 'Ocultar comparação';
    };
    // Único ponto de escrita na HDA em todo este fluxo: passa pelo próprio
    // Quill (setText), o mesmo editor que o médico usa — sem writes directos
    // à BD e sem qualquer lógica de gravação paralela. A persistência real
    // continua a acontecer depois, pelo botão/fluxo normal de guardar a
    // consulta, tal como qualquer outra edição manual da HDA.
    applyBtn.onclick = () => {
      quill.setText(proposedText);
      actions.remove();
      compareBox.remove();
      const applied = document.createElement('p');
      applied.className = 'gcai-hda-applied-note';
      applied.textContent = '✓ Aplicado à história actual.';
      div.append(applied);
      if (hdaProposalEl === div) hdaProposalEl = null;
    };
    discardBtn.onclick = () => {
      div.remove();
      if (hdaProposalEl === div) hdaProposalEl = null;
    };

    thread.append(div);
    hdaProposalEl = div;
    scrollThread();
  }

  // Melhorar HDA — caminho totalmente à parte de ask()/Analisar caso: contrato
  // de resposta próprio ({ hdaMelhorada }, nunca sections[]), contexto restrito
  // à anamnese (HDA actual + transcrição + só dados de patient() claramente
  // anamnésticos) e SEM EO — o EO nunca deve poder influenciar/entrar na HDA.
  async function proposeHdaImprovement(transcript) {
    open();
    addUser(transcript ? 'Melhorar HDA (a partir da transcrição)' : 'Melhorar HDA');
    const stopTyping = addTyping();
    try {
      const hdaAtual = quill.getText().trim();
      const context = {
        hdaAtual,
        transcript: transcript || '',
        patient: anamnesticPatientContext(patient())
      };
      const result = await respond('melhorar_hda', transcript || '', context);
      stopTyping();
      if (result?.hdaMelhorada) {
        addHdaProposal(result.hdaMelhorada, hdaAtual);
      } else {
        addAssistant([{ text: 'Não foi possível gerar uma proposta de HDA.' }]);
      }
    } catch {
      stopTyping();
      addAssistant([{ text: 'Não foi possível obter resposta.' }]);
    }
  }

  async function ask(kind, label, userText) {
    open();
    addUser(label);
    const stopTyping = addTyping();
    const isAnalysis = kind === 'analisar';
    try {
      // Contexto SEMPRE lido de novo no momento do pedido — nunca preso ao
      // que existia quando a conversa abriu ou à transcrição inicial. O EO
      // é dado objectivo do médico: entra no contexto tal como está agora,
      // mas nunca é copiado para a HDA (isso continua a ser feito só por
      // "Melhorar história clínica", noutro fluxo).
      const context = {
        patient: patient(),
        hda: quill.getText().trim(),
        ...getConsultationContext()
      };
      const sections = await respond(kind, userText, context);
      stopTyping();
      addAssistant(sections && sections.length ? sections : [{ text: 'Sem resposta.' }], { isAnalysis });
      if (isAnalysis) {
        labels.analisar = 'Actualizar análise';
        if (analiseBtn) analiseBtn.textContent = labels.analisar;
      }
    } catch {
      stopTyping();
      addAssistant([{ text: 'Não foi possível obter resposta.' }], { isAnalysis });
    }
  }

  rail.querySelectorAll('[data-shortcut]').forEach(btn => {
    btn.onclick = () => {
      const kind = btn.dataset.shortcut;
      if (kind === 'melhorar') { proposeHdaImprovement(); return; }
      ask(kind, labels[kind]);
    };
  });

  composer.addEventListener('submit', e => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    ask(null, text, text);
  });

  return {
    open,
    close,
    // Ligado pelo botão "Melhorar história clínica" da barra de gravação —
    // recebe a transcrição do segmento e usa o MESMO caminho do atalho
    // "Melhorar HDA" (proposeHdaImprovement), nunca ask()/sections[].
    improveFromTranscript(transcript) { proposeHdaImprovement(transcript); }
  };
}
