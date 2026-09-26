// Botão/estados de gravação da consulta — gravação REAL via MediaRecorder,
// transcrição REAL via a Edge Function transcribe-consultation. Vive fora da
// toolbar do editor e fora da HDA (é montado num slot próprio, ao lado de
// "Antecedentes"). Expõe mountRecordingBar(container, { onImprove, sb, functionName }).
//
// ====================================================================
// PRINCÍPIOS QUE ESTE MÓDULO TEM DE RESPEITAR SEMPRE
// ====================================================================
//   1. A gravação é SEMPRE manual e opcional — só começa quando o médico
//      clica "🎙 Gravar consulta". Nunca em background, nunca automática
//      ao abrir a consulta ou ao montar este módulo.
//   2. A transcrição é exclusivamente derivada do áudio captado — o texto
//      devolvido pela função vem sempre do endpoint de transcrição da
//      OpenAI, nunca gerado/completado por este módulo.
//   3. "Melhorar história clínica" é uma operação POSTERIOR e SEPARADA da
//      transcrição — nunca a mesma chamada, nunca o mesmo texto. A
//      transcrição é matéria-prima; este módulo só a entrega via
//      onImprove(), nunca decide o que fazer com ela (isso é o
//      assistant-panel.js, que este módulo nunca constrói directamente).
//   4. O áudio nunca é guardado em BD/Storage — só existe em memória do
//      browser (Blob) e em trânsito para a função de transcrição.
//   5. Nunca perde um segmento gravado: em caso de falha na transcrição,
//      o Blob é mantido e o médico pode "Tentar novamente"; só é libertado
//      depois de uma transcrição bem sucedida.
// ====================================================================

let stylesInjected = false;
function ensureRecordingBarStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    /* Identidade visual própria da gravação (teal/vermelho discreto) — nunca a mesma do Assistente IA. */
    .gcai-rec-btn{display:inline-flex;align-items:center;gap:7px;padding:8px 16px;border-radius:20px;border:1px solid #99ded6;background:#e6f7f5;color:#0d9488;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit}
    .gcai-rec-btn:hover{background:#d7f2ef}
    .gcai-rec-btn:disabled{opacity:.5;cursor:not-allowed}
    .gcai-rec-mic{font-size:14px;line-height:1}
    .gcai-rec-active{display:inline-flex;align-items:center;gap:9px}
    .gcai-rec-dot{width:8px;height:8px;border-radius:50%;background:#b91c1c}
    .gcai-rec-dot.gcai-pulse{animation:gcaiPulse 1.1s infinite}
    @keyframes gcaiPulse{0%,100%{opacity:1}50%{opacity:.25}}
    .gcai-rec-dot.gcai-paused{background:#d97706;animation:none}
    .gcai-rec-time{font-variant-numeric:tabular-nums;font-size:13px;color:#b91c1c;font-weight:700}
    .gcai-rec-time.gcai-paused{color:#b45309}
    .gcai-rec-status-text{font-size:12.5px;color:#64748b}
    .gcai-rec-stop,.gcai-rec-resume{padding:5px 10px;border-radius:14px;border:0;background:transparent;color:#b91c1c;font-weight:700;font-size:12.5px;cursor:pointer;font-family:inherit}
    .gcai-rec-stop:hover,.gcai-rec-resume:hover{background:#fef2f2}
    .gcai-rec-resume{color:#b45309}
    .gcai-rec-resume:hover{background:#fffbeb}
    .gcai-rec-terminate{padding:5px 8px;border-radius:14px;border:0;background:transparent;color:#64748b;font-weight:600;font-size:11.5px;cursor:pointer;font-family:inherit;text-decoration:underline;text-underline-offset:2px}
    .gcai-rec-terminate:hover{color:#334155}
    .gcai-rec-done{display:inline-flex;align-items:center;gap:10px;flex-wrap:wrap}
    .gcai-rec-done-label{font-size:12.5px;color:#0f172a;font-weight:600}
    .gcai-rec-ghost-btn{height:30px;padding:0 11px;border-radius:6px;border:1px solid #e7ecf3;background:#fff;color:#334155;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit}
    .gcai-rec-ghost-btn:hover{background:#f8fafc}
    .gcai-rec-primary-btn{height:30px;padding:0 11px;border-radius:6px;border:1px solid #1a56db;background:#1a56db;color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit}
    .gcai-rec-primary-btn:hover{background:#1547b8}
    .gcai-rec-add-btn{height:30px;padding:0 11px;border-radius:6px;border:1px dashed #99ded6;background:#fff;color:#0d9488;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit}
    .gcai-rec-add-btn:hover{background:#e6f7f5}
    .gcai-rec-error{display:inline-flex;align-items:center;gap:10px;flex-wrap:wrap}
    .gcai-rec-error-text{font-size:12.5px;color:#b91c1c}
    .gcai-rec-retry-btn{height:30px;padding:0 11px;border-radius:6px;border:1px solid #b91c1c;background:#fff;color:#b91c1c;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit}
    .gcai-rec-retry-btn:hover{background:#fef2f2}
    .gcai-rec-transcript{display:none;margin:10px 0 16px;background:#f8fafc;border:1px solid #e7ecf3;border-radius:8px;padding:10px 12px;font-size:12.5px;line-height:1.55;color:#334155;white-space:pre-wrap}
  `;
  document.head.appendChild(style);
}

function fmtTime(s) {
  const m = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${m}:${ss}`;
}

function extFromMime(mime) {
  if (mime && mime.includes('ogg')) return 'ogg';
  if (mime && mime.includes('mp4')) return 'm4a';
  return 'webm';
}

export function mountRecordingBar(container, { onImprove, sb, functionName = 'transcribe-consultation' } = {}) {
  ensureRecordingBarStyles();

  const transcriptEl = document.createElement('div');
  transcriptEl.className = 'gcai-rec-transcript';
  container.insertAdjacentElement('afterend', transcriptEl);

  let mediaStream = null;
  let mediaRecorder = null;
  let chunks = [];
  let timer = null;
  let sessionSeconds = 0; // tempo do segmento actual — persiste entre pausa/retoma, nunca reinicia ao retomar
  let pendingBlob = null; // Blob do segmento actual, só libertado depois de transcrito com sucesso
  const segments = []; // { seconds, text } — um por cada "Gravar"→"Terminar" bem sucedido

  const totalSeconds = () => segments.reduce((sum, s) => sum + s.seconds, 0) + sessionSeconds;
  const fullTranscript = () => segments.map(s => s.text).join('\n\n');

  function updateTranscriptPreview() {
    transcriptEl.replaceChildren();
    const text = document.createElement('div');
    text.textContent = fullTranscript();
    transcriptEl.append(text);
  }

  function stopStream() {
    mediaStream?.getTracks().forEach(t => t.stop());
    mediaStream = null;
  }

  function renderIdle() {
    container.innerHTML = `<button type="button" class="gcai-rec-btn" data-action="start"><span class="gcai-rec-mic">🎙</span> Gravar consulta</button>`;
    container.querySelector('[data-action="start"]').onclick = startSegment;
  }
  function renderMicError(message) {
    container.innerHTML = `<span class="gcai-rec-error-text"></span>`;
    container.querySelector('.gcai-rec-error-text').textContent = message;
    setTimeout(renderIdle, 3000);
  }
  function renderRecording() {
    container.innerHTML = `
      <span class="gcai-rec-active">
        <span class="gcai-rec-dot gcai-pulse"></span>
        <span class="gcai-rec-time" data-time>${fmtTime(sessionSeconds)}</span>
        <button type="button" class="gcai-rec-stop" data-action="pause">Pausar</button>
        <button type="button" class="gcai-rec-terminate" data-action="terminate">Terminar</button>
      </span>`;
    container.querySelector('[data-action="pause"]').onclick = pauseSegment;
    container.querySelector('[data-action="terminate"]').onclick = terminateSession;
  }
  function renderPaused() {
    container.innerHTML = `
      <span class="gcai-rec-active">
        <span class="gcai-rec-dot gcai-paused"></span>
        <span class="gcai-rec-time gcai-paused" data-time>${fmtTime(sessionSeconds)}</span>
        <button type="button" class="gcai-rec-resume" data-action="resume">⏸ Retomar gravação</button>
        <button type="button" class="gcai-rec-terminate" data-action="terminate">Terminar</button>
      </span>`;
    container.querySelector('[data-action="resume"]').onclick = resumeSegment;
    container.querySelector('[data-action="terminate"]').onclick = terminateSession;
  }
  function renderTranscribing() {
    container.innerHTML = `<span class="gcai-rec-status-text">A transcrever segmento… (${fmtTime(sessionSeconds)} de áudio)</span>`;
  }
  function renderDone() {
    container.innerHTML = `
      <span class="gcai-rec-done">
        <span class="gcai-rec-done-label">Transcrição concluída · ${fmtTime(totalSeconds())}</span>
        <button type="button" class="gcai-rec-ghost-btn" data-action="view">Ver transcrição</button>
        <button type="button" class="gcai-rec-primary-btn" data-action="improve">Melhorar história clínica</button>
        <button type="button" class="gcai-rec-add-btn" data-action="add">+ Adicionar gravação</button>
      </span>`;
    container.querySelector('[data-action="view"]').onclick = () => {
      transcriptEl.style.display = transcriptEl.style.display === 'block' ? 'none' : 'block';
    };
    // "Melhorar história clínica" é sempre uma operação separada — recebe o texto
    // transcrito (matéria-prima) e é o assistant-panel.js, não este módulo, quem
    // decide o que fazer com ele. Este módulo nunca gera nem mistura essa resposta.
    container.querySelector('[data-action="improve"]').onclick = () => {
      onImprove?.(fullTranscript());
    };
    container.querySelector('[data-action="add"]').onclick = startSegment;
  }
  // Falha na transcrição: o Blob (pendingBlob) é mantido — "Tentar novamente"
  // reenvia o MESMO Blob, nunca perde o áudio já gravado.
  function renderFailed(message) {
    container.innerHTML = `
      <span class="gcai-rec-error">
        <span class="gcai-rec-error-text"></span>
        <button type="button" class="gcai-rec-retry-btn" data-action="retry">Tentar novamente</button>
      </span>`;
    container.querySelector('.gcai-rec-error-text').textContent = message;
    container.querySelector('[data-action="retry"]').onclick = () => {
      renderTranscribing();
      uploadSegment(pendingBlob);
    };
  }

  function startTimer() {
    timer = setInterval(() => {
      sessionSeconds++;
      const el = container.querySelector('[data-time]');
      if (el) el.textContent = fmtTime(sessionSeconds);
    }, 1000);
  }

  // 1. A gravação é SEMPRE manual: esta função só corre quando o médico clica
  // "Gravar consulta" ou "+ Adicionar gravação" — nunca é chamada sozinha.
  async function startSegment() {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      renderMicError('Não foi possível aceder ao microfone.');
      return;
    }
    mediaStream = stream;
    chunks = [];
    sessionSeconds = 0;
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.addEventListener('dataavailable', e => { if (e.data && e.data.size) chunks.push(e.data); });
    mediaRecorder.start();
    renderRecording();
    startTimer();
  }
  function pauseSegment() {
    clearInterval(timer);
    mediaRecorder.pause();
    renderPaused();
  }
  function resumeSegment() {
    // Retoma a MESMA sessão — sessionSeconds não é reiniciado, o tempo continua acumulado.
    mediaRecorder.resume();
    renderRecording();
    startTimer();
  }
  function terminateSession() {
    clearInterval(timer);
    renderTranscribing();
    mediaRecorder.addEventListener('stop', () => {
      const blob = new Blob(chunks, { type: mediaRecorder.mimeType || 'audio/webm' });
      chunks = [];
      stopStream();
      uploadSegment(blob);
    }, { once: true });
    mediaRecorder.stop();
  }

  // Transcrição real de um segmento — nunca guarda o áudio; só o reencaminha
  // para a função e usa o texto literal devolvido. Em falha, mantém o Blob
  // (pendingBlob) para permitir "Tentar novamente" sem regravar.
  async function uploadSegment(blob) {
    pendingBlob = blob;
    try {
      if (!sb?.functions?.invoke) throw new Error('Ligação indisponível.');
      const form = new FormData();
      form.set('audio', blob, `segment-${segments.length + 1}.${extFromMime(blob.type)}`);
      const { data, error } = await sb.functions.invoke(functionName, { body: form });
      if (error) throw new Error(data?.error || 'Não foi possível transcrever este segmento.');
      const text = typeof data?.text === 'string' ? data.text.trim() : '';
      if (!text) throw new Error('A transcrição devolvida está vazia.');
      segments.push({ seconds: sessionSeconds, text });
      pendingBlob = null; // 6. sucesso → liberta o Blob
      sessionSeconds = 0;
      updateTranscriptPreview();
      renderDone();
    } catch (err) {
      // 5. falha → mantém pendingBlob, mostra "Tentar novamente"
      renderFailed(err.message || 'Não foi possível transcrever este segmento.');
    }
  }

  renderIdle();
}
