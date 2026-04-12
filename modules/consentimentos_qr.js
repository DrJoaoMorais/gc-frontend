/* ========================================================
   CONSENTIMENTOS_QR.JS — Modal QR para assinatura remota
   --------------------------------------------------------
   01 — Helpers
   02 — openQrModal  (exportada)
   ======================================================== */

const SIGN_BASE_URL = "https://gc.joaomorais.pt/consent-sign.html";
const QR_API_URL    = "https://api.qrserver.com/v1/create-qr-code/";
const POLL_INTERVAL = 5000; // ms

const DOC_LABELS = {
  rgpd:              "RGPD — Política de Privacidade",
  prp:               "Consentimento Informado — PRP",
  corticoide:        "Consentimento Informado — Corticosteróide",
  acido_hialuronico: "Consentimento Informado — Ácido Hialurónico",
};

/* ======================================================== */
/*  01 — Helpers                                            */
/* ======================================================== */

function escH(s) {
  return String(s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildQrImgUrl(tokenValue) {
  const target = `${SIGN_BASE_URL}?token=${encodeURIComponent(tokenValue)}`;
  return `${QR_API_URL}?size=200x200&data=${encodeURIComponent(target)}`;
}

function buildSignUrl(tokenValue) {
  return `${SIGN_BASE_URL}?token=${encodeURIComponent(tokenValue)}`;
}

/* ======================================================== */
/*  02 — openQrModal                                        */
/* ======================================================== */

export function openQrModal({ patient, clinicId, clinic, type, onSigned }) {
  document.getElementById("gcQrOverlay")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "gcQrOverlay";
  Object.assign(overlay.style, {
    position: "fixed", inset: "0", zIndex: "5000",
    background: "rgba(15,23,42,0.65)",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: "16px",
  });
  document.body.appendChild(overlay);

  let pollTimer      = null;
  let rowId          = null; // id da linha — usado no polling
  let signed         = false;
  let selectedType   = null;

  function close() {
    clearInterval(pollTimer);
    overlay.remove();
  }

  function shell(content) {
    return `
      <div style="
        background:#fff; width:min(440px,96vw); border-radius:16px; overflow:hidden;
        box-shadow:0 24px 64px rgba(0,0,0,0.35); display:flex; flex-direction:column;
      ">
        <div style="background:#0f2d52; color:#fff; padding:14px 20px;
                    display:flex; justify-content:space-between; align-items:center;">
          <div style="font-weight:900; font-size:15px;">Assinatura via QR</div>
          <button id="gcQrClose" style="background:none;border:none;color:#fff;font-size:20px;cursor:pointer;padding:4px 10px;line-height:1;">✕</button>
        </div>
        ${content}
      </div>
      <style>@keyframes gcQrSpin { to { transform: rotate(360deg); } }</style>
    `;
  }

  function wireClose() {
    document.getElementById("gcQrClose")?.addEventListener("click", close);
    overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
  }

  /* ── Passo 1 — selector de tipo ────────────────────── */
  function renderSelector() {
    const patName = escH(patient?.full_name || "—");

    function typeBtn(key, label) {
      return `<button class="gcQrTypeBtn" data-type="${key}" style="
        padding:10px 14px; border-radius:10px; border:1.5px solid #cbd5e1;
        background:#fff; cursor:pointer; font-size:13px; font-weight:600;
        color:#1e3a5f; text-align:left; transition:border-color .15s;
      ">${escH(label)}</button>`;
    }

    overlay.innerHTML = shell(`
      <div style="padding:24px; display:flex; flex-direction:column; gap:16px;">
        <div style="font-size:13px; color:#374151;">
          Doente: <strong>${patName}</strong><br>
          <span style="color:#64748b; font-size:12px;">Seleccione o tipo de consentimento:</span>
        </div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${typeBtn("rgpd",              DOC_LABELS.rgpd)}
          ${typeBtn("prp",               DOC_LABELS.prp)}
          ${typeBtn("corticoide",        DOC_LABELS.corticoide)}
          ${typeBtn("acido_hialuronico", DOC_LABELS.acido_hialuronico)}
        </div>
        <div style="font-size:12px; color:#94a3b8; text-align:center;">
          Seleccione o tipo de consentimento
        </div>
      </div>
    `);

    wireClose();

    overlay.querySelectorAll(".gcQrTypeBtn").forEach(btn => {
      btn.addEventListener("click", () => {
        selectedType = btn.getAttribute("data-type");
        renderLoading();
        generateToken(selectedType);
      });
    });
  }

  /* ── Passo 2 — a gerar ──────────────────────────────── */
  function renderLoading() {
    overlay.innerHTML = shell(`
      <div style="padding:40px; text-align:center; color:#64748b; font-size:14px;">
        A gerar token…
      </div>
    `);
    wireClose();
  }

  /* ── Passo 3 — QR ───────────────────────────────────── */
  function renderQr(tokenValue) {
    const label   = escH(DOC_LABELS[selectedType] || selectedType);
    const patName = escH(patient?.full_name || "—");
    const imgSrc  = buildQrImgUrl(tokenValue);
    const signUrl = buildSignUrl(tokenValue);

    overlay.innerHTML = shell(`
      <div style="padding:24px; display:flex; flex-direction:column; align-items:center; gap:16px;">

        <div style="font-size:13px; color:#374151; text-align:center;">
          <strong>${patName}</strong><br>
          <span style="color:#64748b; font-size:12px;">${label}</span>
        </div>

        <div id="gcQrStatusWrap" style="
          border:3px solid #0f2d52; border-radius:12px; padding:10px;
          display:inline-block; background:#fff;
        ">
          <img src="${escH(imgSrc)}" width="200" height="200" alt="QR code" style="display:block;" />
        </div>

        <div id="gcQrStatus" style="
          display:flex; align-items:center; gap:8px;
          font-size:13px; font-weight:600; color:#f59e0b;
        ">
          <span style="
            width:14px; height:14px; border:2px solid #f59e0b;
            border-top-color:transparent; border-radius:50%;
            display:inline-block; animation:gcQrSpin 0.8s linear infinite;
          "></span>
          A aguardar assinatura…
        </div>

        <div style="font-size:11px; color:#94a3b8; text-align:center; word-break:break-all;">
          <a href="${escH(signUrl)}" target="_blank" style="color:#3b82f6;">${escH(signUrl)}</a>
        </div>

      </div>
    `);

    wireClose();
  }

  function renderSigned() {
    const wrap   = document.getElementById("gcQrStatusWrap");
    const status = document.getElementById("gcQrStatus");
    if (wrap)   { wrap.style.borderColor = "#16a34a"; }
    if (status) {
      status.innerHTML = `
        <span style="font-size:18px;">✅</span>
        <span style="color:#16a34a;">Consentimento assinado!</span>
      `;
    }
    setTimeout(() => {
      close();
      if (typeof onSigned === "function") onSigned();
    }, 1800);
  }

  function renderError(msg) {
    overlay.innerHTML = shell(`
      <div style="padding:32px; text-align:center; color:#dc2626; font-size:13px;">
        ${escH(msg)}
      </div>
    `);
    wireClose();
  }

  /* ── Polling ────────────────────────────────────────── */
  function startPolling(id) {
    pollTimer = setInterval(async () => {
      if (signed) return;
      try {
        const { data, error } = await window.sb
          .from("consent_tokens")
          .select("status")
          .eq("id", id)
          .single();

        if (error) { console.warn("QR poll:", error); return; }
        if (data?.status === "signed") {
          signed = true;
          clearInterval(pollTimer);
          renderSigned();
        }
      } catch (e) {
        console.warn("QR poll exception:", e);
      }
    }, POLL_INTERVAL);
  }

  /* ── Gerar token ────────────────────────────────────── */
  async function generateToken(docType) {
    try {
      const userRes   = await window.sb.auth.getUser();
      const userId    = userRes?.data?.user?.id || null;
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h

      const { data: row, error } = await window.sb
        .from("consent_tokens")
        .insert({
          patient_id:    patient?.id,
          clinic_id:     clinicId,
          document_type: docType,
          token:         crypto.randomUUID(),
          status:        "pending",
          expires_at:    expiresAt,
          created_by:    userId,
        })
        .select("id, token")
        .single();

      if (error) throw error;

      rowId = row.id;
      renderQr(row.token);
      startPolling(rowId);

    } catch (e) {
      console.error("INSERT error:", JSON.stringify(e, null, 2));
      renderError("Erro ao gerar token. Tente de novo.");
    }
  }

  /* ── Arranque ───────────────────────────────────────── */
  if (type) {
    selectedType = type;
    renderLoading();
    generateToken(type);
  } else {
    renderSelector();
  }
}
