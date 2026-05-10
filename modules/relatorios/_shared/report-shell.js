/**
 * report-shell.js — Cabeçalho, bloco de dados do doente e rodapé partilhados
 *
 * Extraído de modules/doente.js linhas 4499-4584 (2026-05-10).
 * Motivo: centralizar a construção de header/footer num único ponto reutilizável
 * por todos os templates de relatório do módulo modules/relatorios/.
 * Referência de rollback: git tag pre-prp-refactor-2026-05-09
 *
 * ATENÇÃO: não alterar o comportamento sem comparar com o código original
 * em doente.js — qualquer divergência gera PDFs diferentes dos actuais.
 */

/**
 * Constrói o cabeçalho, bloco do doente, rodapé e estilos partilhados
 * para todos os templates de relatório médico.
 *
 * @param {Object} params
 * @param {Object} params.patient — objecto doente (full_name, sns, nif, dob)
 * @param {Object} params.clinic  — objecto clínica (city, website, phone);
 *                                  já obtido pelo caller via fetchClinicForPdf()
 * @returns {Promise<{
 *   sharedStyles: string,
 *   header:       string,
 *   patientBlock: string,
 *   footer:       string,
 *   vinhetaUrl:   string,
 *   vinhetaTag:   string,
 *   localityDate: string,
 *   name:         string,
 *   sns:          string,
 *   nif:          string,
 *   dobPt:        string,
 *   patientLine2: string,
 *   websiteHtml:  string,
 *   phoneHtml:    string,
 * }>}
 */
export async function buildReportShell({ patient, clinic }) {
  const escAttr   = window.__gc_escAttr;
  const fmtDobPt  = window.__gc_fmtDobPt;
  const signedUrl = window.__gc_storageSignedUrl;
  const toDataUrl = window.__gc_urlToDataUrl;
  const BUCKET    = window.__gc_VINHETA_BUCKET;
  const PATH      = window.__gc_VINHETA_PATH;

  const locality     = String(clinic?.city || "").trim();
  const todayPt      = new Date()
    .toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" })
    .replace(/\//g, "-");
  const localityDate = [locality, todayPt].filter(Boolean).join(", ");

  const name  = escAttr(String(patient?.full_name || "").trim() || "—");
  const sns   = escAttr(String(patient?.sns || "").trim());
  const nif   = escAttr(String(patient?.nif || "").trim());
  const dobPt = patient?.dob ? escAttr(fmtDobPt(patient.dob)) : "";

  const lineParts = [];
  if (sns)   lineParts.push(`<b>Nº Utente:</b> ${sns}`);
  if (dobPt) lineParts.push(`<b>DN:</b> ${dobPt}`);
  if (nif)   lineParts.push(`<b>NIF:</b> ${nif}`);
  const patientLine2 = lineParts.join("&nbsp;&nbsp;&nbsp;");

  const websiteHtml = escAttr(clinic?.website || "www.JoaoMorais.pt");
  const phoneHtml   = escAttr(clinic?.phone   || "");

  // Vinheta: falha silenciosa — vinhetaUrl fica "" se storage inacessível
  let vinhetaUrl = "";
  try {
    const u = await signedUrl(BUCKET, PATH, 3600);
    if (u) vinhetaUrl = await toDataUrl(u, "image/png");
  } catch (_) {}

  const vinhetaTag = vinhetaUrl
    ? `<img style="width:4cm;height:2.5cm;object-fit:contain;display:block;margin-top:8px;" src="${vinhetaUrl}" />`
    : "";

  const sharedStyles = `
        body { margin:0; background:#fff; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif; color:#111; font-size:14px; line-height:1.5; }
        * { box-sizing:border-box; }
        @page { size:A4; margin:16mm; }
        .a4 { width:210mm; background:#fff; }
        .top { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
        .topLeft { font-size:13.5px; line-height:1.4; }
        .hr { height:1px; background:#111; margin:10px 0 14px 0; }
        .title { text-align:center; font-weight:900; font-size:20px; margin:2px 0 12px 0; }
        .row { margin-top:6px; font-size:13.5px; }
        .section { margin-top:18px; }
        .stitle { font-weight:900; font-size:15px; margin-bottom:6px; }
        .field { background:#f8fafc; border:1.5px dashed #94a3b8; border-radius:6px; padding:6px 10px; margin:6px 0; color:#1e40af; font-style:italic; display:inline-block; min-width:180px; }
        .footerBlock { margin-top:28px; }
        .hr2 { height:1px; background:#111; margin:16px 0 10px 0; }
        .footRow { display:flex; justify-content:space-between; align-items:flex-start; gap:10px; }
        .web { font-size:14px; font-weight:700; }
        .locDate { text-align:right; font-size:14px; margin-top:14px; }
        .sig { margin-top:40px; display:flex; justify-content:flex-end; }
        .sigBox { width:360px; text-align:center; }
        .sigLine { border-top:1px solid #111; padding-top:10px; }
        .sigName { font-weight:900; font-size:17px; margin-top:6px; }
        .sigRole { font-size:13px; margin-top:2px; }
      `;

  const header = `
        <div class="top">
          <div class="topLeft">
            <div>${websiteHtml}</div>
            <div>${phoneHtml}</div>
          </div>
        </div>
        <div class="hr"></div>
      `;

  const patientBlock = `
        <div class="row"><b>Nome:</b> ${name}</div>
        ${patientLine2 ? `<div class="row">${patientLine2}</div>` : ""}
        <div class="hr" style="margin-top:14px;opacity:0.5;"></div>
      `;

  const footer = `
        <div class="footerBlock">
          <div class="hr2"></div>
          <div class="footRow">
            <div>
              <div class="web">${websiteHtml}</div>
              ${vinhetaTag}
            </div>
            <div style="flex:1;">
              <div class="locDate">${escAttr(localityDate)}</div>
              <div class="sig">
                <div class="sigBox">
                  <div class="sigLine"></div>
                  <div class="sigName">Dr. João Morais</div>
                  <div class="sigRole">Médico Fisiatra</div>
                  <div class="sigRole">Sports Medicine &amp; Rehabilitation</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

  return {
    sharedStyles, header, patientBlock, footer,
    vinhetaUrl, vinhetaTag,
    localityDate, name, sns, nif, dobPt, patientLine2,
    websiteHtml, phoneHtml,
  };
}
