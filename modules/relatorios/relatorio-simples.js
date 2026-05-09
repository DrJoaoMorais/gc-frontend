export async function openRelatorioSimples({
  p, activeClinicId, lastSavedConsultId,
  sharedStyles, header, patientBlock, footer, vinhetaUrl,
  localityDate, name, sns, nif, dobPt,
  onSuccess
}) {
  if (!lastSavedConsultId) {
    alert("Grave a consulta antes de gerar um relatório.");
    return;
  }
  if (!activeClinicId) {
    alert("Sem clínica activa.");
    return;
  }

  // Calcular idade
  let ageRow = "";
  if (p?.dob) {
    const dob = new Date(p.dob);
    const today = new Date();
    let a = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) a--;
    if (isFinite(a) && a >= 0) {
      ageRow = `<div class="row"><b>Idade:</b> ${a} anos</div>`;
    }
  }

  const todayPt = new Date().toLocaleDateString("pt-PT", {
    day: "2-digit", month: "2-digit", year: "numeric"
  });
  const defaultTitle = `Relatório Médico — ${todayPt}`;

  // ── Overlay do modal ────────────────────────────────────────────────
  const overlay = document.createElement("div");
  overlay.id = "gcRelatorioSimplesOverlay";
  Object.assign(overlay.style, {
    position: "fixed", inset: "0",
    background: "rgba(0,0,0,0.45)",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: "16px", zIndex: "3100",
    fontFamily: "Outfit,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif"
  });

  overlay.innerHTML = `
    <div style="background:#fff;width:min(860px,96vw);height:88vh;display:flex;flex-direction:column;
                border-radius:14px;border:1px solid #e2e8f0;overflow:hidden;
                box-shadow:0 8px 40px rgba(0,0,0,0.22);">

      <div style="padding:14px 18px;border-bottom:1px solid #e2e8f0;flex-shrink:0;background:#f8fafc;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
          <div style="font-weight:900;font-size:15px;color:#0f2d52;">📄 Relatório Simples</div>
          <button id="gcRsBtnCancelar"
                  style="background:none;border:1px solid #e2e8f0;border-radius:8px;
                         padding:6px 14px;font-size:13px;cursor:pointer;color:#64748b;
                         font-family:inherit;">Cancelar</button>
        </div>
        <div style="margin-top:10px;">
          <label style="font-size:11px;font-weight:700;color:#64748b;
                        text-transform:uppercase;letter-spacing:.05em;">Título</label>
          <input id="gcRsTitulo" value="${defaultTitle.replace(/"/g, '&quot;')}"
                 style="width:100%;margin-top:4px;padding:9px 12px;border:1px solid #cbd5e1;
                        border-radius:8px;font-size:14px;font-family:inherit;color:#0f2d52;
                        font-weight:600;box-sizing:border-box;" />
        </div>
      </div>

      <div style="flex:1;overflow:hidden;display:flex;flex-direction:column;padding:12px 18px 0 18px;">
        <div id="gcRsQuillEditor"
             style="flex:1;overflow-y:auto;border:1px solid #cbd5e1;border-radius:8px;
                    background:#fff;font-size:13px;min-height:0;"></div>
      </div>

      <div style="padding:12px 18px;border-top:1px solid #e2e8f0;flex-shrink:0;background:#f8fafc;
                  display:flex;justify-content:flex-end;gap:10px;align-items:center;">
        <span id="gcRsErro" style="color:#dc2626;font-size:12px;flex:1;display:none;"></span>
        <button id="gcRsBtnGerarPdf"
                style="background:#1a56db;color:#fff;border:none;border-radius:8px;
                       padding:10px 22px;font-size:14px;font-weight:700;cursor:pointer;
                       font-family:inherit;">
          Gerar PDF
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Inicializar Quill
  const quill = new window.Quill("#gcRsQuillEditor", {
    theme: "snow",
    placeholder: "Escreva o conteúdo do relatório…",
    modules: {
      toolbar: [
        ["bold", "italic", "underline"],
        [{ list: "ordered" }, { list: "bullet" }],
        [{ size: ["small", false, "large", "huge"] }],
        ["clean"]
      ]
    }
  });

  function mostrarErro(msg) {
    const el = document.getElementById("gcRsErro");
    if (!el) return;
    el.textContent = msg;
    el.style.display = msg ? "block" : "none";
  }

  function fecharModal() {
    overlay.remove();
  }

  document.getElementById("gcRsBtnCancelar").addEventListener("click", fecharModal);

  document.getElementById("gcRsBtnGerarPdf").addEventListener("click", async () => {
    const titulo = (document.getElementById("gcRsTitulo")?.value || "").trim() || defaultTitle;
    const quillHtml = quill.root.innerHTML;
    mostrarErro("");

    if (!quillHtml || quillHtml === "<p><br></p>") {
      mostrarErro("Escreva o conteúdo do relatório antes de gerar o PDF.");
      return;
    }

    const btnGerar = document.getElementById("gcRsBtnGerarPdf");
    btnGerar.disabled = true;
    btnGerar.textContent = "A gerar…";

    try {
      // Montar HTML completo do documento (reutiliza sharedStyles + blocos do doente.js)
      const docHtml = `<!doctype html><html><head><meta charset="utf-8"/>
<title>${titulo.replace(/</g, "&lt;")}</title>
<style>${sharedStyles}
.ql-editor p, .rs-body p { margin:0 0 6px 0; }
</style>
</head><body><div class="a4">
${header}
${patientBlock}
${ageRow}
<div class="section">
  <div class="stitle">${titulo.replace(/</g, "&lt;")}</div>
  <div class="rs-body" style="font-size:13.5px;line-height:1.65;margin-top:10px;">${quillHtml}</div>
</div>
${footer}
</div></body></html>`;

      // Gerar PDF via proxy (mesmo mecanismo de todos os outros relatórios)
      const blob = await window.__gc_renderPdfViaProxy(docHtml);

      if (!blob || blob.size < 2000) {
        mostrarErro("PDF inválido ou demasiado pequeno. Tente novamente.");
        btnGerar.disabled = false;
        btnGerar.textContent = "Gerar PDF";
        return;
      }

      // Calcular versão (igual a getNextDocVersionForConsult no doente.js)
      const { data: vData } = await window.sb
        .from("documents")
        .select("version")
        .eq("consultation_id", lastSavedConsultId)
        .order("version", { ascending: false })
        .limit(1);
      const version = vData && vData.length ? Number(vData[0].version || 0) + 1 : 1;

      // Path de storage (mesmo padrão do doente.js)
      const ymd = new Date().toISOString().slice(0, 10);
      const hms = new Date().toISOString().slice(11, 19).replaceAll(":", "");
      const path = `clinic_${activeClinicId}/patient_${p.id}/consult_${lastSavedConsultId}/v${version}_${ymd}_${hms}.pdf`;

      // Upload para Storage
      const up = await window.__gc_uploadPdfToStorage({ blob, path });
      if (!up.ok) {
        const msg = String(up.error?.message || up.error || "erro desconhecido");
        mostrarErro(`Falhou o upload do PDF. ${msg}`);
        btnGerar.disabled = false;
        btnGerar.textContent = "Gerar PDF";
        return;
      }

      // Registo na tabela documents (com html guardado para futura edição)
      const ins = await window.__gc_insertDocumentRow({
        clinic_id:       activeClinicId,
        patient_id:      p.id,
        consultation_id: lastSavedConsultId,
        title:           titulo,
        html:            docHtml,
        version,
        storage_path:    path,
        category:        "simples",
        template_id:     null
      });

      if (!ins.ok) {
        const msg = String(ins.error?.message || ins.error || "erro desconhecido");
        mostrarErro(`PDF enviado, mas falhou o registo na base de dados. ${msg}`);
        btnGerar.disabled = false;
        btnGerar.textContent = "Gerar PDF";
        return;
      }

      fecharModal();
      alert("Relatório criado com sucesso.");

      // Actualizar timeline (igual ao padrão dos PRP existentes)
      if (typeof onSuccess === "function") await onSuccess();

    } catch (e) {
      console.error("openRelatorioSimples erro:", e);
      mostrarErro(`Erro ao gerar o relatório: ${String(e?.message || e)}`);
      btnGerar.disabled = false;
      btnGerar.textContent = "Gerar PDF";
    }
  });
}
