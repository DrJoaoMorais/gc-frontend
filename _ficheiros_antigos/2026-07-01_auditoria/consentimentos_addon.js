
/* ======================================================== */
/*  07 — openQrModal  (QR code + polling)                  */
/* ======================================================== */

// Mapeia tipos internos → enum da BD consent_tokens
const QR_TYPE_MAP = {
  rgpd:       "rgpd",
  prp:        "prp",
  corticoide: "corticoide",
  ah:         "acido_hialuronico",
};

const QR_TYPE_LABELS = {
  rgpd:       "RGPD",
  prp:        "PRP",
  corticoide: "Corticóide",
  ah:         "Ác. Hialurónico",
};

const QR_TYPE_SUB = {
  rgpd:       "Dados pessoais",
  prp:        "Plasma Rico",
  corticoide: "Infiltração",
  ah:         "Viscossuplem.",
};

const QR_SIGN_BASE = "https://gc.joaomorais.pt/consent-sign.html";
const QR_POLL_MS   = 5000;

export function openQrModal({ type: initialType = null, patient, clinicId, clinic, onSigned }) {
  document.getElementById("gcQrOverlay")?.remove();

  let selectedType = initialType;
  let tokenId      = null;
  let signingUrl   = null;
  let pollInterval = null;

  const overlay = document.createElement("div");
  overlay.id = "gcQrOverlay";
  Object.assign(overlay.style, {
    position: "fixed", inset: "0", zIndex: "4100",
    background: "rgba(15,23,42,0.65)",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: "16px",
  });
  document.body.appendChild(overlay);

  function close() {
    if (pollInterval) clearInterval(pollInterval);
    overlay.remove();
  }

  /* ── Render principal ──────────────────────────────── */
  function render() {
    overlay.innerHTML = `
      <style>@keyframes gcQrSpin { to { transform:rotate(360deg); } }</style>
      <div style="
        background:#fff; width:min(440px,96vw);
        border-radius:16px; overflow:hidden;
        box-shadow:0 24px 64px rgba(0,0,0,0.35);
      ">
        <!-- Cabeçalho -->
        <div style="
          background:#0f2d52; color:#fff; padding:14px 20px;
          display:flex; justify-content:space-between; align-items:center;
        ">
          <div>
            <div style="font-weight:700; font-size:15px;">Novo consentimento</div>
            <div style="font-size:11px; opacity:0.7; margin-top:2px;">
              ${escH(patient?.full_name || "")} · ${escH(clinic?.name || "")}
            </div>
          </div>
          <button id="gcQrClose" style="
            background:none; border:none; color:#fff; font-size:20px;
            cursor:pointer; padding:4px 10px; border-radius:6px; line-height:1;
          ">✕</button>
        </div>

        <div style="padding:20px;">

          <!-- Seletor de tipo -->
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:20px;">
            ${["rgpd","prp","corticoide","ah"].map(t => `
              <button class="gcQrTypeBtn" data-type="${t}" style="
                border:${selectedType === t ? "2px solid #1a56db" : "1.5px solid #e5e7eb"};
                background:${selectedType === t ? "#e8f0fe" : "#fff"};
                border-radius:10px; padding:10px 12px; cursor:pointer;
                text-align:left; font-family:inherit;
              ">
                <div style="font-size:12px; font-weight:600; color:${selectedType === t ? "#1748c5" : "#374151"};">
                  ${escH(QR_TYPE_LABELS[t])}
                </div>
                <div style="font-size:11px; color:#9ca3af; margin-top:2px;">
                  ${escH(QR_TYPE_SUB[t])}
                </div>
              </button>
            `).join("")}
          </div>

          <!-- Área QR (estado inicial / spinner / qr) -->
          <div id="gcQrArea" style="
            min-height:210px; display:flex; align-items:center; justify-content:center;
          ">
            ${selectedType
              ? `<div style="text-align:center;">
                  <div style="font-size:13px; color:#6b7280; margin-bottom:14px;">A gerar link…</div>
                  <div style="
                    width:32px; height:32px; margin:0 auto;
                    border:3px solid #e5e7eb; border-top-color:#1a56db;
                    border-radius:50%; animation:gcQrSpin 0.8s linear infinite;
                  "></div>
                </div>`
              : `<div style="text-align:center; color:#9ca3af; font-size:13px; padding:20px;">
                  Seleccione o tipo de consentimento acima
                </div>`
            }
          </div>

          <!-- Link + estado (oculto até haver token) -->
          <div id="gcQrBottom" style="display:none; margin-top:16px;">
            <div style="
              display:flex; align-items:center; gap:8px;
              background:#f3f4f6; border-radius:8px; padding:8px 12px;
              border:1px solid #e5e7eb; margin-bottom:10px;
            ">
              <span id="gcQrLinkText" style="
                font-size:11px; color:#6b7280; flex:1;
                overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
                font-family:monospace;
              "></span>
              <button id="gcQrCopy" style="
                font-size:12px; font-weight:500; color:#1a56db;
                background:none; border:1px solid #1a56db; border-radius:6px;
                padding:4px 10px; cursor:pointer; white-space:nowrap; font-family:inherit;
              ">Copiar link</button>
            </div>
            <div id="gcQrStatus" style="
              display:flex; align-items:center; gap:8px; padding:8px 12px;
              background:#faeeda; border-radius:8px; border:1px solid #FAC775;
            ">
              <div style="width:8px; height:8px; border-radius:50%; background:#BA7517; flex-shrink:0;"></div>
              <span style="font-size:12px; color:#854F0B; font-weight:500;">Aguarda assinatura</span>
            </div>
          </div>

        </div>
      </div>
    `;

    // Eventos base
    document.getElementById("gcQrClose")?.addEventListener("click", close);
    overlay.addEventListener("click", e => { if (e.target === overlay) close(); });

    // Seletor de tipo
    overlay.querySelectorAll(".gcQrTypeBtn").forEach(btn => {
      btn.addEventListener("click", () => {
        if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
        tokenId = null; signingUrl = null;
        selectedType = btn.dataset.type;
        render();
        // generateToken é chamado dentro de render() se selectedType !== null
      });
    });

    if (selectedType) generateToken();
  }

  /* ── Gerar / recuperar token ───────────────────────── */
  async function generateToken() {
    const dbType = QR_TYPE_MAP[selectedType];

    try {
      // Reutilizar token válido existente (evita duplicados)
      const { data: existing } = await window.sb
        .from("consent_tokens")
        .select("id, token, status")
        .eq("patient_id", patient.id)
        .eq("clinic_id", clinicId)
        .eq("document_type", dbType)
        .eq("status", "pending")
        .gte("expires_at", new Date().toISOString())
        .maybeSingle();

      let row = existing;

      if (!row) {
        const userRes = await window.sb.auth.getUser();
        const expires = new Date();
        expires.setHours(expires.getHours() + 24);

        const { data: newRow, error } = await window.sb
          .from("consent_tokens")
          .insert({
            patient_id:    patient.id,
            clinic_id:     clinicId,
            document_type: dbType,
            document_data: {
              patient_name: patient.full_name || null,
              clinic_name:  clinic?.name || null,
            },
            status:     "pending",
            expires_at: expires.toISOString(),
            created_by: userRes?.data?.user?.id || null,
          })
          .select("id, token, status")
          .single();

        if (error) throw error;
        row = newRow;
      }

      tokenId    = row.id;
      signingUrl = `${QR_SIGN_BASE}?token=${row.token}`;

      renderQrCode(signingUrl);
      startPolling();

    } catch (err) {
      console.error("openQrModal generateToken:", err);
      const area = document.getElementById("gcQrArea");
      if (area) area.innerHTML = `
        <div style="text-align:center; color:#dc2626; font-size:13px; padding:20px;">
          Erro ao gerar link.<br>
          <button onclick="location.reload()" style="
            margin-top:10px; padding:6px 14px; border-radius:6px;
            border:1px solid #dc2626; background:none; color:#dc2626;
            cursor:pointer; font-family:inherit; font-size:12px;
          ">Tentar de novo</button>
        </div>`;
    }
  }

  /* ── Mostrar QR ────────────────────────────────────── */
  function renderQrCode(url) {
    const area = document.getElementById("gcQrArea");
    if (!area) return;

    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}&color=000000&bgcolor=ffffff&margin=2`;

    area.innerHTML = `
      <div style="text-align:center;">
        <div style="
          display:inline-block; position:relative;
          border:2.5px solid #1a56db; border-radius:12px; padding:4px;
        ">
          <img src="${escH(qrSrc)}" width="170" height="170" alt="QR Code"
            style="display:block; border-radius:6px;"
            onerror="this.parentElement.innerHTML='<div style=padding:20px;font-size:12px;color:#dc2626>Erro ao carregar QR</div>'"
          />
          <!-- Badge JM -->
          <div style="
            position:absolute; top:50%; left:50%;
            transform:translate(-50%,-50%);
            width:36px; height:36px; border-radius:50%;
            background:#1a56db; border:2.5px solid #fff;
            display:flex; align-items:center; justify-content:center;
            font-size:11px; font-weight:700; color:#fff; letter-spacing:0.05em;
          ">JM</div>
        </div>
        <div style="font-size:12px; color:#6b7280; margin-top:10px;">
          Doente aponta a câmara para este código
        </div>
        <div style="font-size:11px; color:#9ca3af; margin-top:3px;">
          Válido 24 h · expira ${_expiryLabel()}
        </div>
      </div>
    `;

    // Mostrar secção link + estado
    const bottom = document.getElementById("gcQrBottom");
    const linkEl = document.getElementById("gcQrLinkText");
    if (bottom) bottom.style.display = "block";
    if (linkEl) linkEl.textContent = url;

    document.getElementById("gcQrCopy")?.addEventListener("click", async (e) => {
      try { await navigator.clipboard.writeText(url); } catch {}
      e.target.textContent = "✓ Copiado";
      setTimeout(() => { e.target.textContent = "Copiar link"; }, 2000);
    });
  }

  /* ── Polling ───────────────────────────────────────── */
  function startPolling() {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(async () => {
      if (!tokenId) return;
      try {
        const { data } = await window.sb
          .from("consent_tokens")
          .select("status, signed_at")
          .eq("id", tokenId)
          .single();

        if (data?.status === "signed") {
          clearInterval(pollInterval);
          pollInterval = null;
          _renderSignedStatus(data.signed_at);
          if (typeof onSigned === "function") onSigned(selectedType);
        }
      } catch { /* erro pontual — polling continua */ }
    }, QR_POLL_MS);
  }

  /* ── Estado assinado (status bar → verde) ──────────── */
  function _renderSignedStatus(signedAt) {
    const el = document.getElementById("gcQrStatus");
    if (!el) return;
    const t = signedAt
      ? new Date(signedAt).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })
      : "";
    el.style.background  = "#d1fae5";
    el.style.borderColor = "#6ee7b7";
    el.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="flex-shrink:0;">
        <circle cx="8" cy="8" r="8" fill="#059669"/>
        <path d="M4 8l3 3 5-5" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span style="font-size:12px; color:#065f46; font-weight:600;">
        Assinado${t ? " às " + t : ""} · documento guardado
      </span>
    `;
  }

  /* ── Helper data expiração ─────────────────────────── */
  function _expiryLabel() {
    const d = new Date();
    d.setHours(d.getHours() + 24);
    return d.toLocaleString("pt-PT", {
      day: "2-digit", month: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  }

  render();
}
