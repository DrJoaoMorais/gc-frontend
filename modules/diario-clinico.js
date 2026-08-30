const esc = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

function ensureStyles() {
  if (document.getElementById('gc-clinical-diary-styles')) return;
  const style = document.createElement('style');
  style.id = 'gc-clinical-diary-styles';
  style.textContent = `
    .gc-clinical-diary-overlay{position:fixed;inset:0;z-index:12000;background:rgba(15,31,54,.48);display:flex;align-items:center;justify-content:center;padding:24px}
    .gc-clinical-diary-modal{width:min(820px,100%);max-height:min(860px,92vh);background:#fff;border-radius:18px;box-shadow:0 24px 70px rgba(10,30,55,.24);display:flex;flex-direction:column;overflow:hidden;color:#17365d}
    .gc-clinical-diary-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding:22px 24px;border-bottom:1px solid #e3eaf3}
    .gc-clinical-diary-head h2{font-size:21px;margin:0 0 4px}.gc-clinical-diary-head p{font-size:13px;color:#71819a;margin:0}
    .gc-clinical-diary-close{border:1px solid #d7e0eb;background:#fff;border-radius:9px;padding:8px 12px;font-weight:700;color:#17365d;cursor:pointer}
    .gc-clinical-diary-body{overflow:auto;padding:20px 24px 26px}
    .gc-clinical-diary-note{background:#edf4ff;border-radius:10px;padding:11px 13px;color:#47617f;font-size:13px;margin-bottom:16px}
    .gc-clinical-diary-entry{border-left:3px solid #2463df;padding:2px 0 18px 16px;margin-left:4px}.gc-clinical-diary-entry:last-child{padding-bottom:2px}
    .gc-clinical-diary-entry time{display:block;color:#71819a;font-size:12px;font-weight:700;margin-bottom:6px}.gc-clinical-diary-entry p{white-space:pre-wrap;margin:0;line-height:1.5;color:#243b5a}
    .gc-clinical-diary-images{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px}.gc-clinical-diary-images img{display:block;width:120px;height:90px;object-fit:cover;border-radius:9px;border:1px solid #dce5ef}
    .gc-clinical-diary-muted{padding:28px 8px;text-align:center;color:#71819a}
  `;
  document.head.appendChild(style);
}

function formatDate(value) {
  if (!value) return 'Data não disponível';
  return new Date(value).toLocaleString('pt-PT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export async function openClinicalDiary({ patientId, clinicId, patientName = 'Doente' }) {
  if (!patientId || !clinicId || !window.sb) return;
  ensureStyles();
  document.getElementById('gc-clinical-diary-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'gc-clinical-diary-overlay';
  overlay.className = 'gc-clinical-diary-overlay';
  overlay.innerHTML = `
    <section class="gc-clinical-diary-modal" role="dialog" aria-modal="true" aria-labelledby="gc-clinical-diary-title">
      <header class="gc-clinical-diary-head">
        <div><h2 id="gc-clinical-diary-title">Diário clínico — ${esc(patientName)}</h2><p>Registos enviados pelo doente · apenas leitura</p></div>
        <button class="gc-clinical-diary-close" type="button">Fechar</button>
      </header>
      <div class="gc-clinical-diary-body"><div class="gc-clinical-diary-muted">A carregar registos…</div></div>
    </section>`;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector('.gc-clinical-diary-close').onclick = close;
  overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
  const onKey = (event) => { if (event.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } };
  document.addEventListener('keydown', onKey);

  const body = overlay.querySelector('.gc-clinical-diary-body');
  const { data, error } = await window.sb
    .from('patient_diary_entries')
    .select('id,entered_at,raw_text,images')
    .eq('patient_id', patientId)
    .eq('clinic_id', clinicId)
    .order('entered_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error('[diario-clinico] falha a ler registos:', error);
    body.innerHTML = '<div class="gc-clinical-diary-muted">Não foi possível abrir os registos do Diário.</div>';
    return;
  }

  body.innerHTML = `
    <div class="gc-clinical-diary-note">Este ecrã não permite alterar nem eliminar os registos do doente.</div>
    ${(data || []).map((row) => `
      <article class="gc-clinical-diary-entry">
        <time>${esc(formatDate(row.entered_at))}</time>
        <p>${esc(row.raw_text || 'Registo com imagem')}</p>
        ${Array.isArray(row.images) && row.images.length ? `<div class="gc-clinical-diary-images">${row.images.map((path, index) => `<span data-diary-image="${esc(path)}">Imagem ${index + 1} a carregar…</span>`).join('')}</div>` : ''}
      </article>`).join('') || '<div class="gc-clinical-diary-muted">Este doente ainda não enviou registos.</div>'}`;

  await Promise.all(Array.from(body.querySelectorAll('[data-diary-image]')).map(async (host) => {
    const path = host.getAttribute('data-diary-image');
    const { data: signed, error: signedError } = await window.sb.storage.from('patient-diary').createSignedUrl(path, 300);
    if (signedError || !signed?.signedUrl) { host.textContent = 'Imagem indisponível'; return; }
    host.innerHTML = `<a href="${esc(signed.signedUrl)}" target="_blank" rel="noopener"><img src="${esc(signed.signedUrl)}" alt="Imagem enviada pelo doente"></a>`;
  }));
}
