/**
 * GC · Shell Visual v2 · Relatórios
 * Construído sobre window.sb (cliente global Supabase).
 * Reutiliza helpers globais: window.__gc_storageSignedUrl, window.__gc_urlToDataUrl, window.__gc_escAttr
 *
 * NÃO depende de imports ESM externos. Carrega via <script type="module"> ou <script> regular.
 * Compatível com a página de teste e com integração futura no doente.js.
 */

const VINHETA_BUCKET_DEFAULT = 'clinic-private';
const VINHETA_PATH_DEFAULT = 'vinheta/vinheta_web.png';

const MESES_PT = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
];

export function formatDatePT(isoDate) {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return '';
  return `${d.getDate()} de ${MESES_PT[d.getMonth()]} de ${d.getFullYear()}`;
}

export async function loadActiveClinic() {
  try {
    const { data, error } = await window.sb
      .from('clinics')
      .select('id, name, display_name, logo_url, website, phone, city')
      .eq('is_active', true)
      .order('name')
      .limit(1);
    if (error) { console.error('[shell-v2] loadActiveClinic erro:', error); return null; }
    return data?.[0] || null;
  } catch (e) {
    console.error('[shell-v2] loadActiveClinic excepção:', e);
    return null;
  }
}

export async function loadClinicById(clinicId) {
  if (!clinicId) return null;
  try {
    const { data, error } = await window.sb
      .from('clinics')
      .select('id, name, display_name, logo_url, website, phone, city')
      .eq('id', clinicId)
      .single();
    if (error) { console.error('[shell-v2] loadClinicById erro:', error); return null; }
    return data;
  } catch (e) {
    console.error('[shell-v2] loadClinicById excepção:', e);
    return null;
  }
}

export async function loadCurrentDoctor() {
  try {
    const { data: { user } } = await window.sb.auth.getUser();
    if (!user) return null;
    const { data, error } = await window.sb
      .from('profiles')
      .select('id, nome_completo, numero_ordem, especialidade, especialidade_detail')
      .eq('id', user.id)
      .single();
    if (error) { console.error('[shell-v2] loadCurrentDoctor erro:', error); return null; }
    return data;
  } catch (e) {
    console.error('[shell-v2] loadCurrentDoctor excepção:', e);
    return null;
  }
}

export async function getVinhetaDataUrl() {
  try {
    const bucket = window.__gc_VINHETA_BUCKET || VINHETA_BUCKET_DEFAULT;
    const path = window.__gc_VINHETA_PATH || VINHETA_PATH_DEFAULT;
    if (typeof window.__gc_storageSignedUrl === 'function') {
      const signed = await window.__gc_storageSignedUrl(bucket, path, 60 * 10);
      if (typeof window.__gc_urlToDataUrl === 'function') {
        return await window.__gc_urlToDataUrl(signed);
      }
      return signed;
    }
    const { data, error } = await window.sb.storage.from(bucket).createSignedUrl(path, 60 * 10);
    if (error) { console.error('[shell-v2] vinheta signed url erro:', error); return null; }
    return data?.signedUrl || null;
  } catch (e) {
    console.error('[shell-v2] getVinhetaDataUrl excepção:', e);
    return null;
  }
}

function escAttr(s) {
  if (typeof window.__gc_escAttr === 'function') return window.__gc_escAttr(s);
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' }[c])
  );
}

export function buildShellV2({ clinic, doctor, config = {}, contentHtml = '' }) {
  const date = config.date || new Date().toISOString().slice(0, 10);
  const dateStr = formatDatePT(date);
  const kicker = config.kicker || 'Medicina Física & Reabilitação';
  const title = config.title || 'Documento Médico';
  const vinhetaUrl = config.vinhetaUrl || null;
  const doctorLogoUrl = config.doctorLogoUrl || null;
  const authVinheta = config.authVinheta || null;

  const clinicLogoHtml = clinic?.logo_url
    ? `<img class="gcv2-clinic-logo" src="${escAttr(clinic.logo_url)}" alt="${escAttr(clinic.display_name || clinic.name || 'Clínica')}">`
    : '';

  const doctorLogoHtml = doctorLogoUrl
    ? `<img class="gcv2-doctor-logo" src="${escAttr(doctorLogoUrl)}" alt="${escAttr(doctor?.nome_completo || '')}">`
    : '';

  const vinhetaHtml = vinhetaUrl
    ? `<img class="gcv2-vinheta" src="${escAttr(vinhetaUrl)}" alt="Vinheta">`
    : `<div class="gcv2-vinheta-placeholder">[ Vinheta · OM ${escAttr(doctor?.numero_ordem || '')} ]</div>`;

  const clinicName = clinic?.display_name || clinic?.name || '';
  const clinicContact = [
    clinic?.website || '',
    [clinic?.phone, clinic?.city].filter(Boolean).join(' · ')
  ].filter(Boolean).join('<br>');

  const doctorName = doctor?.nome_completo || 'Dr. João Morais';
  const doctorOM = doctor?.numero_ordem ? ` · OM ${escAttr(doctor.numero_ordem)}` : '';
  const doctorRole = doctor?.especialidade || 'Médico Fisiatra';
  const doctorRoleDetail = doctor?.especialidade_detail || 'Sports Medicine & Rehabilitation';

  return `
<div class="gcv2-root">
  <div class="gcv2-page gcv2-test-page">
    <div class="gcv2-header">
      <div class="gcv2-header-grid">
        <div class="gcv2-header-left">
          ${clinicLogoHtml}
          <div>
            <div class="gcv2-clinic-name">${escAttr(clinicName)}</div>
            <div class="gcv2-clinic-contact">${clinicContact}</div>
          </div>
        </div>
        <div class="gcv2-header-sep"></div>
        <div class="gcv2-header-right">
          <div class="gcv2-doctor-info">
            <div class="gcv2-doctor-name">${escAttr(doctorName)}</div>
            <div class="gcv2-doctor-contact">
              www.joaomorais.pt<br>
              (+351) 916 390 074${doctorOM}
            </div>
          </div>
          ${doctorLogoHtml}
        </div>
      </div>
    </div>
    <div class="gcv2-accent-line"></div>

    <div class="gcv2-doc-title">
      <div class="gcv2-doc-kicker">${escAttr(kicker)}</div>
      <h1>${escAttr(title)}</h1>
    </div>

    <div class="gcv2-container">
      ${contentHtml}
    </div>

    <div class="gcv2-footer">
      <div>
        ${authVinheta
          ? `${authVinheta}${vinhetaHtml}`
          : `<div class="gcv2-footer-place">${escAttr(clinic?.city || '')}</div>
        <div class="gcv2-footer-info">Documento gerado em www.joaomorais.pt</div>`
        }
      </div>
      <div class="gcv2-footer-sig">
        ${authVinheta ? `<div class="gcv2-footer-place" style="text-align:center;">${escAttr(clinic?.city || '')}</div>` : ''}
        <div class="gcv2-footer-date">${dateStr}</div>
        ${authVinheta ? '' : vinhetaHtml}
        <div class="gcv2-sig-line">
          <div class="gcv2-doctor-sig">${escAttr(doctorName)}</div>
          <div class="gcv2-doctor-role">${escAttr(doctorRole)}</div>
          <div class="gcv2-doctor-role">${escAttr(doctorRoleDetail)}</div>
        </div>
      </div>
    </div>

  </div>
</div>
  `.trim();
}

// Expor globalmente (consistente com padrão actual)
window.__gcv2_buildShell = buildShellV2;
window.__gcv2_loadActiveClinic = loadActiveClinic;
window.__gcv2_loadClinicById = loadClinicById;
window.__gcv2_loadCurrentDoctor = loadCurrentDoctor;
window.__gcv2_getVinhetaDataUrl = getVinhetaDataUrl;
window.__gcv2_formatDatePT = formatDatePT;
