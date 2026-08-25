/* ========================================================
   CONSENTIMENTOS_HUB.JS — Hub de consentimentos (procedimentos)
   --------------------------------------------------------
   Ecrã único para PRP / Ácido Hialurónico / Corticosteróide:
   estado actual (último episódio), QR / LINK / PAPEL com o
   mesmo peso visual, e histórico por procedimento.

   O RGPD NÃO passa por aqui — mantém o fluxo antigo
   (openQrGuarded/openQrModal em doente.js e feed-doente.html).

   01 — Helpers e constantes
   02 — openConsentHub  (exportada)
   ======================================================== */

import { openConsentModal, getConsentEpisodes, latestConsentOfType, confirmPaperSigned } from "./consentimentos.js";
import { createConsentToken, watchConsentTokenSigned, buildSignUrl, buildQrImgUrl } from "./consentimentos_qr.js";

/* ======================================================== */
/*  01 — Helpers                                            */
/* ======================================================== */

const DOC_TYPE_BY_UI = { ah: "acido_hialuronico" };
const TYPE_LABELS    = { prp: "PRP", ah: "Ácido Hialurónico", corticoide: "Corticosteróide" };

const STATUS_LABELS_PT = {
  signed:       "Assinado (digital)",
  paper_signed: "Assinado (papel)",
  printed:      "PDF gerado — por assinar",
  paper_sent:   "PDF gerado — por assinar",
  pending:      "Pendente",
  expired:      "Expirado",
};

function escH(s) {
  return String(s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtDatePt(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" });
}

async function resolvePdfUrl(row) {
  try {
    if (row.source === "consent_tokens" && row.id) {
      const { data: sig } = await window.sb
        .from("consent_signatures")
        .select("pdf_url")
        .eq("token_id", row.id)
        .not("pdf_url", "is", null)
        .limit(1);
      return sig?.[0]?.pdf_url || null;
    }
    if (row.source === "consents" && row.storage_path) {
      const { data } = await window.sb.storage.from("documents").createSignedUrl(row.storage_path, 3600);
      return data?.signedUrl || null;
    }
  } catch (e) {
    console.warn("consentimentos_hub — resolvePdfUrl:", e);
  }
  return null;
}

/* ======================================================== */
/*  02 — openConsentHub                                     */
/* ======================================================== */

export function openConsentHub({ type, patient, clinicId, clinic, onChanged }) {
  document.getElementById("gcHubOverlay")?.remove();

  const docType = DOC_TYPE_BY_UI[type] || type;
  const label   = TYPE_LABELS[type] || type;

  const overlay = document.createElement("div");
  overlay.id = "gcHubOverlay";
  Object.assign(overlay.style, {
    position: "fixed", inset: "0", zIndex: "5500",
    background: "rgba(15,23,42,0.65)",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: "16px",
  });
  document.body.appendChild(overlay);

  let activeToken = null; // { id, token } — partilhado entre QR e LINK nesta sessão do hub
  let stopPolling = null;

  function close() {
    if (stopPolling) stopPolling();
    overlay.remove();
  }

  function shell(content) {
    return `
      <div style="
        background:#fff; width:min(460px,96vw); max-height:92vh; overflow-y:auto;
        border-radius:16px; box-shadow:0 24px 64px rgba(0,0,0,0.35);
        display:flex; flex-direction:column;
      ">
        <div style="background:#0f2d52; color:#fff; padding:14px 20px;
                    display:flex; justify-content:space-between; align-items:center; flex-shrink:0;">
          <div style="font-weight:900; font-size:15px;">Consentimento — ${escH(label)}</div>
          <button id="gcHubClose" style="background:none;border:none;color:#fff;font-size:20px;cursor:pointer;padding:4px 10px;line-height:1;">✕</button>
        </div>
        ${content}
      </div>
      <style>@keyframes gcHubSpin { to { transform: rotate(360deg); } }</style>
    `;
  }

  function wireClose() {
    document.getElementById("gcHubClose")?.addEventListener("click", close);
    overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
  }

  function hubOptionButton(id, icon, title, sub) {
    return `
      <button id="${id}" style="
        display:flex;flex-direction:column;align-items:center;gap:4px;
        padding:16px 8px;border-radius:12px;border:1.5px solid #cbd5e1;
        background:#fff;cursor:pointer;text-align:center;
      ">
        <span style="font-size:22px;">${icon}</span>
        <span style="font-weight:800;font-size:12px;color:#0f2d52;">${escH(title)}</span>
        <span style="font-size:10px;color:#64748b;">${escH(sub)}</span>
      </button>`;
  }

  async function loadState() {
    const rows   = await getConsentEpisodes(patient?.id, clinicId);
    const typeRows = rows.filter(r => r.type === type);
    const latest = latestConsentOfType(rows, type);
    return { typeRows, latest };
  }

  /* ── Ecrã principal ─────────────────────────────────── */
  async function renderMain() {
    overlay.innerHTML = shell(`<div style="padding:40px;text-align:center;color:#64748b;font-size:13px;">A carregar…</div>`);
    wireClose();

    const { typeRows, latest } = await loadState();

    const isSigned        = !!latest && (latest.status === "signed" || latest.status === "paper_signed");
    const isPaperPending   = !!latest && (latest.status === "printed" || latest.status === "paper_sent");

    let statusHtml;
    if (isSigned) {
      statusHtml = `
        <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:12px 14px;">
          <div style="font-weight:700;color:#065f46;font-size:13px;">✓ Último consentimento assinado</div>
          <div style="font-size:12px;color:#047857;margin-top:2px;">${escH(fmtDatePt(latest.signed_at || latest.created_at) || "—")}</div>
        </div>`;
    } else if (isPaperPending) {
      statusHtml = `
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px 14px;">
          <div style="font-weight:700;color:#92400e;font-size:13px;">🖨 PDF gerado — por assinar em papel</div>
          <div style="font-size:12px;color:#b45309;margin-top:2px;">${escH(fmtDatePt(latest.created_at) || "—")}</div>
        </div>`;
    } else {
      statusHtml = `
        <div style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;">
          <div style="font-weight:700;color:#475569;font-size:13px;">Sem consentimento assinado</div>
        </div>`;
    }

    overlay.innerHTML = shell(`
      <div style="padding:24px;display:flex;flex-direction:column;gap:18px;">
        <div>
          <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:6px;">Estado actual</div>
          ${statusHtml}
        </div>

        <div>
          <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:8px;">Novo procedimento</div>
          <div style="font-size:12px;color:#64748b;margin-bottom:10px;">Como pretende obter o consentimento?</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
            ${hubOptionButton("gcHubQr",    "📷", "QR CODE", "Mostrar ao doente")}
            ${hubOptionButton("gcHubLink",  "🔗", "LINK",    "Copiar e enviar")}
            ${hubOptionButton("gcHubPaper", "📄", "PAPEL",   isPaperPending ? "Confirmar assinatura" : "Imprimir e assinar")}
          </div>
        </div>

        <button id="gcHubHistoryToggle" style="
          background:none;border:none;text-align:left;cursor:pointer;
          font-size:13px;font-weight:600;color:#0f2d52;padding:8px 0;
          border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;
        ">
          <span>Histórico de consentimentos</span><span id="gcHubHistoryArrow">›</span>
        </button>
        <div id="gcHubHistoryBody" style="display:none;"></div>
      </div>
    `);

    wireClose();

    document.getElementById("gcHubQr")?.addEventListener("click", () => renderQrOrLink("qr"));
    document.getElementById("gcHubLink")?.addEventListener("click", () => renderQrOrLink("link"));
    document.getElementById("gcHubPaper")?.addEventListener("click", () => {
      if (isPaperPending) {
        renderPaperConfirm(latest);
      } else {
        close();
        openConsentModal({
          type, patient, clinicId, clinic,
          onSaved: () => {
            if (typeof onChanged === "function") onChanged();
            openConsentHub({ type, patient, clinicId, clinic, onChanged });
          },
        });
      }
    });

    document.getElementById("gcHubHistoryToggle")?.addEventListener("click", async () => {
      const body  = document.getElementById("gcHubHistoryBody");
      const arrow = document.getElementById("gcHubHistoryArrow");
      const isOpen = body.style.display !== "none";
      if (isOpen) { body.style.display = "none"; arrow.textContent = "›"; return; }
      arrow.textContent = "⌄";
      body.style.display = "block";
      body.innerHTML = `<div style="padding:10px 0;color:#94a3b8;font-size:12px;">A carregar histórico…</div>`;
      body.innerHTML = await renderHistoryHtml(typeRows);
    });
  }

  /* ── QR / LINK — mesmo token nesta sessão do hub ────── */
  async function renderQrOrLink(mode) {
    overlay.innerHTML = shell(`<div style="padding:40px;text-align:center;color:#64748b;font-size:13px;">A gerar…</div>`);
    wireClose();

    if (!activeToken) {
      try {
        activeToken = await createConsentToken({ patient, clinicId, docType });
        stopPolling = watchConsentTokenSigned(activeToken.id, () => {
          renderSignedSuccess();
        });
      } catch (e) {
        console.error("openConsentHub — createConsentToken:", e);
        overlay.innerHTML = shell(`<div style="padding:32px;text-align:center;color:#dc2626;font-size:13px;">Erro ao gerar token. Tente de novo.</div>`);
        wireClose();
        return;
      }
    }

    const signUrl = buildSignUrl(activeToken.token);

    overlay.innerHTML = shell(`
      <div style="padding:24px;display:flex;flex-direction:column;align-items:center;gap:14px;">
        <div style="display:flex;gap:8px;">
          <button id="gcHubModeQr"   style="padding:6px 14px;border-radius:20px;border:1.5px solid ${mode === "qr" ? "#0f2d52" : "#e2e8f0"};background:${mode === "qr" ? "#0f2d52" : "#fff"};color:${mode === "qr" ? "#fff" : "#64748b"};font-size:12px;font-weight:700;cursor:pointer;">QR CODE</button>
          <button id="gcHubModeLink" style="padding:6px 14px;border-radius:20px;border:1.5px solid ${mode === "link" ? "#0f2d52" : "#e2e8f0"};background:${mode === "link" ? "#0f2d52" : "#fff"};color:${mode === "link" ? "#fff" : "#64748b"};font-size:12px;font-weight:700;cursor:pointer;">LINK</button>
        </div>

        ${mode === "qr" ? `
          <img src="${escH(buildQrImgUrl(activeToken.token))}" width="200" height="200" alt="QR code" style="border:3px solid #0f2d52;border-radius:12px;" />
        ` : `
          <div style="width:100%;border:1.5px solid #e2e8f0;border-radius:10px;padding:12px;font-size:12px;color:#334155;word-break:break-all;text-align:center;">
            ${escH(signUrl)}
          </div>
          <button id="gcHubCopyLink" style="padding:10px 18px;border-radius:10px;border:none;background:#0f2d52;color:#fff;font-weight:700;font-size:13px;cursor:pointer;">📋 Copiar link</button>
        `}

        <div style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:#f59e0b;">
          <span style="width:12px;height:12px;border:2px solid #f59e0b;border-top-color:transparent;border-radius:50%;display:inline-block;animation:gcHubSpin 0.8s linear infinite;"></span>
          A aguardar assinatura…
        </div>

        <button id="gcHubBack" style="background:none;border:none;color:#64748b;font-size:12px;cursor:pointer;">‹ Voltar</button>
      </div>
    `);

    wireClose();
    document.getElementById("gcHubModeQr")?.addEventListener("click", () => renderQrOrLink("qr"));
    document.getElementById("gcHubModeLink")?.addEventListener("click", () => renderQrOrLink("link"));
    document.getElementById("gcHubBack")?.addEventListener("click", renderMain);
    document.getElementById("gcHubCopyLink")?.addEventListener("click", async (e) => {
      try {
        await navigator.clipboard.writeText(signUrl);
        e.target.textContent = "✓ Copiado";
        setTimeout(() => { e.target.textContent = "📋 Copiar link"; }, 1500);
      } catch (err) {
        console.warn("consentimentos_hub — clipboard:", err);
      }
    });
  }

  function renderSignedSuccess() {
    if (typeof onChanged === "function") onChanged();
    overlay.innerHTML = shell(`
      <div style="padding:40px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:10px;">
        <span style="font-size:32px;">✅</span>
        <div style="color:#16a34a;font-weight:700;font-size:14px;">Consentimento assinado!</div>
      </div>
    `);
    wireClose();
    setTimeout(() => { close(); }, 1600);
  }

  /* ── PAPEL — confirmar assinatura e arquivo ─────────── */
  function renderPaperConfirm(latest) {
    // Guarda obrigatória: só se pode confirmar UM episódio identificado.
    // Sem isto, um UPDATE por patient/clinic/type/status afectaria todos
    // os registos printed/paper_sent históricos do mesmo tipo.
    const canConfirm = !!latest
      && latest.source === "consents"
      && latest.id != null
      && (latest.status === "printed" || latest.status === "paper_sent");

    if (!canConfirm) {
      overlay.innerHTML = shell(`
        <div style="padding:32px;text-align:center;color:#dc2626;font-size:13px;">
          Não foi possível identificar de forma inequívoca o episódio em papel a confirmar.
          Feche e tente novamente a partir do Feed do doente.
        </div>
      `);
      wireClose();
      return;
    }

    overlay.innerHTML = shell(`
      <div style="padding:24px;display:flex;flex-direction:column;gap:16px;">
        <div style="font-size:13px;color:#475569;">
          PDF gerado em <strong>${escH(fmtDatePt(latest.created_at) || "—")}</strong>.
        </div>
        <label style="display:flex;gap:10px;align-items:flex-start;font-size:13px;color:#1e3a5f;cursor:pointer;">
          <input type="checkbox" id="gcHubPaperCheck" style="margin-top:3px;">
          <span>Confirmo que o consentimento foi assinado pelo doente e arquivado fisicamente na clínica.</span>
        </label>
        <button id="gcHubPaperConfirm" disabled style="
          padding:11px;border-radius:10px;border:none;background:#94a3b8;color:#fff;
          font-weight:700;font-size:14px;cursor:not-allowed;
        ">Confirmar assinatura e arquivo</button>
        <div id="gcHubPaperError" style="display:none;color:#dc2626;font-size:12px;"></div>
        <button id="gcHubPaperBack" style="background:none;border:none;color:#64748b;font-size:12px;cursor:pointer;">‹ Voltar</button>
      </div>
    `);
    wireClose();

    const check  = document.getElementById("gcHubPaperCheck");
    const btn    = document.getElementById("gcHubPaperConfirm");
    const errBox = document.getElementById("gcHubPaperError");
    check?.addEventListener("change", () => {
      btn.disabled = !check.checked;
      btn.style.background = check.checked ? "#0f2d52" : "#94a3b8";
      btn.style.cursor = check.checked ? "pointer" : "not-allowed";
    });
    btn?.addEventListener("click", async () => {
      if (!canConfirm) return; // segurança extra — nunca deveria acontecer aqui
      btn.disabled = true;
      btn.textContent = "A confirmar…";
      errBox.style.display = "none";
      try {
        await confirmPaperSigned(patient?.id, clinicId, type, latest.id);
        renderSignedSuccess();
      } catch (e) {
        console.error("consentimentos_hub — confirmPaperSigned:", e);
        btn.disabled = false;
        btn.textContent = "Confirmar assinatura e arquivo";
        errBox.textContent = "Não foi possível confirmar (0 registos afectados ou erro de rede). Nada foi alterado — tente novamente.";
        errBox.style.display = "block";
      }
    });
    document.getElementById("gcHubPaperBack")?.addEventListener("click", renderMain);
  }

  /* ── Histórico ──────────────────────────────────────── */
  async function renderHistoryHtml(typeRows) {
    if (!typeRows.length) {
      return `<div style="padding:10px 0;color:#94a3b8;font-size:12px;">Sem registos anteriores.</div>`;
    }

    const sorted = typeRows.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const items = await Promise.all(sorted.map(async (row) => {
      const data     = fmtDatePt(row.created_at) || "—";
      const origem   = row.source === "consent_tokens" ? "Digital" : "Papel";
      const estado   = STATUS_LABELS_PT[row.status] || row.status;
      const pdfUrl   = await resolvePdfUrl(row);

      return `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:12px;gap:8px;">
          <div>
            <div style="font-weight:600;color:#1e293b;">${escH(data)}</div>
            <div style="color:#94a3b8;">${escH(origem)} · ${escH(estado)}</div>
          </div>
          ${pdfUrl ? `<a href="${escH(pdfUrl)}" target="_blank" style="color:#3b82f6;font-weight:600;flex-shrink:0;">Ver PDF</a>` : ""}
        </div>`;
    }));

    return items.join("");
  }

  renderMain();
}
