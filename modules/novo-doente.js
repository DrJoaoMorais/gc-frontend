import { UI } from "./config.js";
import { G } from "./state.js";
import { closeModalRoot } from "./agenda.js";
import { normalizeDigits } from "./helpers.js";
import { rpcCreatePatientForClinic } from "./db.js";

/* ========================================================
   NOVO DOENTE — Modal da página inicial
   Extraído de doente.js (BLOCO 07/12)
   ======================================================== */

/* ==== INÍCIO BLOCO 07/12 — Novo doente (modal página inicial) ==== */

function openNewPatientMainModal({ clinicId }) {
  const root = document.getElementById("modalRoot");
  if (!root) return;

  if (!clinicId) {
    alert("Seleciona uma clínica (não pode ser 'Todas') para criar um doente.");
    return;
  }

  root.innerHTML = `
    <div id="npMainOverlay" style="position:fixed;inset:0;background:rgba(0,0,0,0.35);display:flex;align-items:flex-start;justify-content:center;padding:24px 16px;overflow-y:auto;">
      <div style="background:#fff;border-radius:14px;border:0.5px solid #e2e8f0;width:min(720px,100%);overflow:hidden;">

        <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:0.5px solid #e2e8f0;position:sticky;top:0;background:#fff;z-index:10;">
          <div>
            <div style="font-size:16px;font-weight:500;color:#0f172a;">Novo doente</div>
            <div style="font-size:12px;color:#64748b;margin-top:3px;">Nome obrigatório. SNS/NIF (9 dígitos), CC (8 dígitos), Passaporte (4–20).</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <div id="npMsg" style="font-size:12px;color:#64748b;max-width:200px;text-align:right;"></div>
            <button id="npCreate" style="background:#1a56db;color:#fff;border:none;border-radius:8px;padding:7px 18px;font-size:13px;font-weight:500;cursor:pointer;font-family:inherit;">Gravar</button>
            <button id="npCancel" style="background:transparent;border:0.5px solid #e2e8f0;border-radius:8px;padding:7px 14px;font-size:13px;cursor:pointer;color:#0f172a;font-family:inherit;">Fechar</button>
          </div>
        </div>

        <div style="padding:16px 20px;display:flex;flex-direction:column;gap:10px;">

          <div style="display:flex;flex-direction:column;gap:4px;">
            <label style="font-size:11px;color:#64748b;">Nome completo *</label>
            <input id="npFullName" type="text" placeholder="Nome completo do doente" autocomplete="off" autocapitalize="off" spellcheck="false"
              style="width:100%;box-sizing:border-box;padding:8px 10px;border-radius:8px;border:1px solid #e2e8f0;font-size:${UI.fs13}px;font-family:inherit;" />
          </div>

          <div style="display:grid;grid-template-columns:160px 150px 1fr;gap:10px;">
            <div style="display:flex;flex-direction:column;gap:4px;">
              <label style="font-size:11px;color:#64748b;">Data de nascimento</label>
              <input id="npDob" type="date"
                style="width:100%;box-sizing:border-box;padding:8px 10px;border-radius:8px;border:1px solid #e2e8f0;font-size:${UI.fs13}px;font-family:inherit;" />
            </div>
            <div style="display:flex;flex-direction:column;gap:4px;">
              <label style="font-size:11px;color:#64748b;">Telefone</label>
              <input id="npPhone" type="tel" placeholder="+351 9XX XXX XXX" autocomplete="off" spellcheck="false"
                style="width:100%;box-sizing:border-box;padding:8px 10px;border-radius:8px;border:1px solid #e2e8f0;font-size:${UI.fs13}px;font-family:inherit;" />
            </div>
            <div style="display:flex;flex-direction:column;gap:4px;">
              <label style="font-size:11px;color:#64748b;">Email</label>
              <input id="npEmail" type="email" placeholder="email@exemplo.pt" autocomplete="off" spellcheck="false"
                style="width:100%;box-sizing:border-box;padding:8px 10px;border-radius:8px;border:1px solid #e2e8f0;font-size:${UI.fs13}px;font-family:inherit;" />
            </div>
          </div>

          <div style="border-top:0.5px solid #e2e8f0;padding-top:10px;">
            <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">Identificação</div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;">
              <div style="display:flex;flex-direction:column;gap:4px;">
                <label style="font-size:11px;color:#64748b;">SNS (9 dígitos)</label>
                <input id="npSNS" type="text" inputmode="numeric" placeholder="#########" maxlength="9" autocomplete="off"
                  style="width:100%;box-sizing:border-box;padding:8px 10px;border-radius:8px;border:1px solid #e2e8f0;font-size:${UI.fs13}px;font-family:inherit;" />
              </div>
              <div style="display:flex;flex-direction:column;gap:4px;">
                <label style="font-size:11px;color:#64748b;">NIF (9 dígitos)</label>
                <input id="npNIF" type="text" inputmode="numeric" placeholder="#########" maxlength="9" autocomplete="off"
                  style="width:100%;box-sizing:border-box;padding:8px 10px;border-radius:8px;border:1px solid #e2e8f0;font-size:${UI.fs13}px;font-family:inherit;" />
              </div>
              <div style="display:flex;flex-direction:column;gap:4px;">
                <label style="font-size:11px;color:#64748b;">Cartão de Cidadão</label>
                <input id="npCC" type="text" placeholder="########X" maxlength="9" autocomplete="off" spellcheck="false"
                  style="width:100%;box-sizing:border-box;padding:8px 10px;border-radius:8px;border:1px solid #e2e8f0;font-size:${UI.fs13}px;font-family:inherit;" />
              </div>
              <div style="display:flex;flex-direction:column;gap:4px;">
                <label style="font-size:11px;color:#64748b;">Passaporte/ID</label>
                <input id="npPassport" type="text" placeholder="AB123456" autocomplete="off" autocapitalize="off" spellcheck="false"
                  style="width:100%;box-sizing:border-box;padding:8px 10px;border-radius:8px;border:1px solid #e2e8f0;font-size:${UI.fs13}px;font-family:inherit;" />
              </div>
            </div>
          </div>

          <div style="border-top:0.5px solid #e2e8f0;padding-top:10px;">
            <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">Seguro</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
              <div style="display:flex;flex-direction:column;gap:4px;">
                <label style="font-size:11px;color:#64748b;">Seguradora</label>
                <input id="npInsuranceProvider" type="text" autocomplete="off" spellcheck="false"
                  style="width:100%;box-sizing:border-box;padding:8px 10px;border-radius:8px;border:1px solid #e2e8f0;font-size:${UI.fs13}px;font-family:inherit;" />
              </div>
              <div style="display:flex;flex-direction:column;gap:4px;">
                <label style="font-size:11px;color:#64748b;">Nº apólice</label>
                <input id="npInsurancePolicy" type="text" autocomplete="off" spellcheck="false"
                  style="width:100%;box-sizing:border-box;padding:8px 10px;border-radius:8px;border:1px solid #e2e8f0;font-size:${UI.fs13}px;font-family:inherit;" />
              </div>
            </div>
          </div>

          <div style="border-top:0.5px solid #e2e8f0;padding-top:10px;">
            <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">Morada</div>
            <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:10px;">
              <label style="font-size:11px;color:#64748b;">Morada</label>
              <input id="npAddress1" type="text" autocomplete="off" spellcheck="false"
                style="width:100%;box-sizing:border-box;padding:8px 10px;border-radius:8px;border:1px solid #e2e8f0;font-size:${UI.fs13}px;font-family:inherit;" />
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 80px;gap:10px;">
              <div style="display:flex;flex-direction:column;gap:4px;">
                <label style="font-size:11px;color:#64748b;">Cidade</label>
                <input id="npCity" type="text" autocomplete="off" spellcheck="false"
                  style="width:100%;box-sizing:border-box;padding:8px 10px;border-radius:8px;border:1px solid #e2e8f0;font-size:${UI.fs13}px;font-family:inherit;" />
              </div>
              <div style="display:flex;flex-direction:column;gap:4px;">
                <label style="font-size:11px;color:#64748b;">Código-postal</label>
                <input id="npPostal" type="text" placeholder="0000-000" autocomplete="off" spellcheck="false"
                  style="width:100%;box-sizing:border-box;padding:8px 10px;border-radius:8px;border:1px solid #e2e8f0;font-size:${UI.fs13}px;font-family:inherit;" />
              </div>
              <div style="display:flex;flex-direction:column;gap:4px;">
                <label style="font-size:11px;color:#64748b;">País</label>
                <input id="npCountry" type="text" value="PT" autocomplete="off" spellcheck="false"
                  style="width:100%;box-sizing:border-box;padding:8px 10px;border-radius:8px;border:1px solid #e2e8f0;font-size:${UI.fs13}px;font-family:inherit;" />
              </div>
            </div>
          </div>

          <div style="border-top:0.5px solid #e2e8f0;padding-top:10px;padding-bottom:4px;">
            <label style="font-size:11px;color:#64748b;display:block;margin-bottom:4px;">Notas</label>
            <textarea id="npNotes" rows="2"
              style="width:100%;box-sizing:border-box;padding:8px 10px;border-radius:8px;border:1px solid #e2e8f0;resize:vertical;font-size:${UI.fs13}px;font-family:inherit;"></textarea>
          </div>

        </div>
      </div>
    </div>
  `;

  const overlay = document.getElementById("npMainOverlay");
  const btnClose = document.getElementById("npMainClose");
  const npCancel = document.getElementById("npCancel");
  const npCreate = document.getElementById("npCreate");
  const npMsg = document.getElementById("npMsg");

  const npFullName = document.getElementById("npFullName");
  const npDob = document.getElementById("npDob");
  const npPhone = document.getElementById("npPhone");
  const npEmail = document.getElementById("npEmail");
  const npSNS = document.getElementById("npSNS");
  const npNIF = document.getElementById("npNIF");
  const npPassport = document.getElementById("npPassport");
  const npCC = document.getElementById("npCC");
  const npInsuranceProvider = document.getElementById("npInsuranceProvider");
  const npInsurancePolicy = document.getElementById("npInsurancePolicy");
  const npAddress1 = document.getElementById("npAddress1");
  const npPostal = document.getElementById("npPostal");
  const npCity = document.getElementById("npCity");
  const npCountry = document.getElementById("npCountry");
  const npNotes = document.getElementById("npNotes");

  /* ---- 07B — Estado local e fecho ---- */
  function setErr(msg) { if (npMsg) { npMsg.style.color = "#b00020"; npMsg.textContent = msg; } }
  function setInfo(msg) { if (npMsg) { npMsg.style.color = "#666"; npMsg.textContent = msg; } }
  function close() { closeModalRoot(); }

  if (btnClose) btnClose.addEventListener("click", close);
  if (npCancel) npCancel.addEventListener("click", close);
  if (overlay) overlay.addEventListener("click", (ev) => { if (ev.target && ev.target.id === "npMainOverlay") close(); });

  /* ---- 07C — Validação ---- */
  function validate() {
    const fullName = (npFullName.value || "").trim();
    if (!fullName) return { ok: false, msg: "Nome completo é obrigatório." };

    const sns = normalizeDigits(npSNS.value);
    const nif = normalizeDigits(npNIF.value);
    const pass = (npPassport.value || "").trim();
    const cc = (npCC?.value || "").trim();

    if (sns && !/^[0-9]{9}$/.test(sns)) return { ok: false, msg: "SNS inválido: tem de ter 9 dígitos." };
    if (nif && !/^[0-9]{9}$/.test(nif)) return { ok: false, msg: "NIF inválido: tem de ter 9 dígitos." };
    if (pass && !/^[A-Za-z0-9]{4,20}$/.test(pass)) return { ok: false, msg: "Passaporte/ID inválido: 4–20 alfanum." };

    if (!sns && !nif && !pass && !cc) return { ok: false, msg: "Identificação obrigatória: CC, SNS, NIF ou Passaporte/ID." };

    return {
      ok: true,
      full_name: fullName,
      dob: npDob.value ? npDob.value : null,
      phone: npPhone.value ? npPhone.value.trim() : null,
      email: npEmail.value ? npEmail.value.trim() : null,
      sns: sns || null,
      nif: nif || null,
      passport_id: pass || null,
      cc_number: cc || null,
      insurance_provider: npInsuranceProvider.value ? npInsuranceProvider.value.trim() : null,
      insurance_policy_number: npInsurancePolicy.value ? npInsurancePolicy.value.trim() : null,
      address_line1: npAddress1.value ? npAddress1.value.trim() : null,
      postal_code: npPostal.value ? npPostal.value.trim() : null,
      city: npCity.value ? npCity.value.trim() : null,
      country: npCountry.value ? npCountry.value.trim() : "PT",
      notes: npNotes.value ? npNotes.value.trim() : null,
    };
  }

  /* ---- 07D — Estado do botão ---- */
  function refreshButtonState() {
    if (npSNS) { const d = normalizeDigits(npSNS.value); if (npSNS.value !== d) npSNS.value = d; }
    if (npNIF) { const d = normalizeDigits(npNIF.value); if (npNIF.value !== d) npNIF.value = d; }

    const v = validate();
    if (!v.ok) { npCreate.disabled = true; setErr(v.msg); }
    else { npCreate.disabled = false; setInfo("OK para criar."); }
  }

  [
    npFullName, npDob, npPhone, npEmail, npSNS, npNIF, npPassport, npCC,
    npInsuranceProvider, npInsurancePolicy, npAddress1, npPostal, npCity, npCountry, npNotes
  ].forEach((el) => {
    if (!el) return;
    el.addEventListener("input", refreshButtonState);
    el.addEventListener("change", refreshButtonState);
  });

  /* ---- 07E — Criação do doente ---- */
  if (npCreate) {
    npCreate.addEventListener("click", async () => {
      const v = validate();
      if (!v.ok) { setErr(v.msg); return; }

      npCreate.disabled = true;
      setInfo("A criar…");

      try {
        const payload = {
          p_clinic_id: clinicId,
          p_full_name: v.full_name,
          p_dob: v.dob,
          p_sex: null,
          p_phone: v.phone,
          p_email: v.email,
          p_external_id: null,
          p_notes: v.notes,
          p_sns: v.sns,
          p_nif: v.nif,
          p_passport_id: v.passport_id,
          p_address_line1: v.address_line1,
          p_postal_code: v.postal_code,
          p_city: v.city,
          p_country: v.country,
          p_insurance_provider: v.insurance_provider,
          p_insurance_policy_number: v.insurance_policy_number,
        };

        const newPatientId = await rpcCreatePatientForClinic(payload);
        if (!newPatientId) {
          setErr("Criado, mas não consegui obter o ID. Pesquisa pelo nome e seleciona.");
          npCreate.disabled = false;
          return;
        }

        const minimal = {
          id: newPatientId,
          full_name: v.full_name,
          phone: v.phone,
          email: v.email,
          sns: v.sns,
          nif: v.nif,
          passport_id: v.passport_id,
        };
        G.patientQuick.selected = minimal;

        const q = document.getElementById("pQuickQuery");
        if (q) q.value = "";
        const rHost = document.getElementById("pQuickResults");
        if (rHost) { rHost.innerHTML = ""; rHost.style.display = "none"; }

        close();
      } catch (e) {
        console.error("Criar doente (main) falhou:", e);
        const msg = String(e && (e.message || e.details || e.hint) ? (e.message || e.details || e.hint) : e);

        if (msg.includes("patients_sns_unique_not_null")) setErr("SNS já existe noutro doente.");
        else if (msg.includes("patients_nif_unique_not_null")) setErr("NIF já existe noutro doente.");
        else if (msg.includes("patients_passport_unique_not_null")) setErr("Passaporte/ID já existe noutro doente.");
        else if (msg.includes("patients_sns_format_check")) setErr("SNS inválido (9 dígitos).");
        else if (msg.includes("patients_nif_format_check")) setErr("NIF inválido (9 dígitos).");
        else if (msg.includes("patients_passport_format_check")) setErr("Passaporte/ID inválido (4–20 alfanum).");
        else if (msg.includes("patients_sns_or_nif_or_passport_check")) setErr("Identificação obrigatória: SNS/NIF/Passaporte.");
        else setErr("Erro ao criar doente. Vê a consola.");

        npCreate.disabled = false;
      }
    });
  }

  npCreate.disabled = true;
  setInfo("Preenche o Nome e um identificador (SNS/NIF/Passaporte).");
  refreshButtonState();
}
/* ==== FIM BLOCO 07/12 ==== */

export { openNewPatientMainModal };
