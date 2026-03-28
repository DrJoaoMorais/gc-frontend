/* ========================================================
   GESTAOAGENDA.JS — Gestão de slots e bloqueios de agenda
   ======================================================== */

import { G } from "./state.js";
import { escapeHtml } from "./helpers.js";

const CLINICAS = () => (G.clinics || []).map(c => ({ id: c.id, name: c.name || c.slug || c.id }));

function pad2(n) { return String(n).padStart(2, "0"); }

function gerarSlots(horaInicio, horaFim, durMin) {
  const [h1, m1] = horaInicio.split(":").map(Number);
  const [h2, m2] = horaFim.split(":").map(Number);
  let cur = h1 * 60 + m1;
  const end = h2 * 60 + m2;
  const slots = [];
  while (cur < end) {
    slots.push(pad2(Math.floor(cur / 60)) + ":" + pad2(cur % 60));
    cur += durMin;
  }
  return slots;
}

export function initGestaoAgenda() {
  const root = document.getElementById("gcGestaoAgendaRoot");
  if (!root) return;

  const clinicas = CLINICAS();

  root.innerHTML = `
    <div style="padding:0 0 2rem;">
      <div style="margin-bottom:1.25rem;">
        <div style="font-size:18px;font-weight:700;color:#0f2d52;">Gestão de agenda</div>
        <div style="font-size:13px;color:#64748b;margin-top:2px;">${clinicas.map(c => escapeHtml(c.name)).join(" · ")}</div>
      </div>

      <div style="display:flex;gap:4px;background:#f1f5f9;border-radius:10px;padding:4px;width:fit-content;margin-bottom:1.25rem;">
        <button class="ga-tab active" data-tab="abrir" style="padding:6px 16px;font-size:13px;font-weight:600;border:none;border-radius:8px;cursor:pointer;background:#fff;color:#0f2d52;border:0.5px solid #e2e8f0;">Abrir slots</button>
        <button class="ga-tab" data-tab="bloquear" style="padding:6px 16px;font-size:13px;font-weight:600;border:none;border-radius:8px;cursor:pointer;background:transparent;color:#64748b;">Bloquear</button>
        <button class="ga-tab" data-tab="semana" style="padding:6px 16px;font-size:13px;font-weight:600;border:none;border-radius:8px;cursor:pointer;background:transparent;color:#64748b;">Vista semanal</button>
      </div>

      <div id="ga-tab-abrir">${_htmlAbrirSlots(clinicas)}</div>
      <div id="ga-tab-bloquear" style="display:none;">${_htmlBloquear(clinicas)}</div>
      <div id="ga-tab-semana" style="display:none;">${_htmlSemana()}</div>
    </div>`;

  _wireGestaoAgenda(clinicas);
}

function _card(content) {
  return `<div style="background:#fff;border:0.5px solid #e2e8f0;border-radius:12px;padding:1rem 1.25rem;margin-bottom:1rem;">${content}</div>`;
}

function _label(text) {
  return `<label style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;">${escapeHtml(text)}</label>`;
}

function _select(id, options, style = "") {
  return `<select id="${id}" class="gcSelect" style="padding:7px 10px;border-radius:8px;border:1px solid #e2e8f0;font-size:13px;font-family:inherit;color:#1e293b;${style}">${options}</select>`;
}

function _clinicaOptions(clinicas) {
  return clinicas.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join("");
}

function _htmlAbrirSlots(clinicas) {
  return _card(`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
      <div style="display:flex;flex-direction:column;gap:4px;">${_label("Clínica")}${_select("gaClinica", _clinicaOptions(clinicas))}</div>
      <div style="display:flex;flex-direction:column;gap:4px;">${_label("Data")}<input id="gaData" type="date" style="padding:7px 10px;border-radius:8px;border:1px solid #e2e8f0;font-size:13px;font-family:inherit;" /></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
      <div style="display:flex;flex-direction:column;gap:4px;">${_label("Hora início")}<input id="gaHoraInicio" type="time" value="09:00" style="padding:7px 10px;border-radius:8px;border:1px solid #e2e8f0;font-size:13px;font-family:inherit;" /></div>
      <div style="display:flex;flex-direction:column;gap:4px;">${_label("Hora fim")}<input id="gaHoraFim" type="time" value="13:00" style="padding:7px 10px;border-radius:8px;border:1px solid #e2e8f0;font-size:13px;font-family:inherit;" /></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
      <div style="display:flex;flex-direction:column;gap:4px;">${_label("Duração do slot")}${_select("gaDuracao", `<option value="15">15 min</option><option value="20" selected>20 min</option>`)}</div>
      <div style="display:flex;flex-direction:column;gap:4px;">${_label("Repetir")}${_select("gaRepetir", `<option value="none">Sem repetição</option><option value="weekly">Semanalmente</option><option value="monthly">Mensalmente</option>`)}</div>
    </div>
    <div id="gaPreview" style="display:flex;flex-wrap:wrap;gap:6px;padding-top:12px;border-top:0.5px solid #e2e8f0;min-height:32px;"></div>
    <div style="font-size:11px;color:#94a3b8;margin-top:8px;">A administrativa pode forçar uma marcação em slot ocupado — verá um aviso de confirmação.</div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
      <button id="gaBtnCancelarSlots" class="gcBtnGhost" style="font-size:12px;padding:7px 14px;border-radius:8px;">Cancelar</button>
      <button id="gaBtnCriarSlots" class="gcBtnSuccess" style="font-size:12px;padding:7px 18px;border-radius:8px;font-weight:600;">Criar slots</button>
    </div>`);
}

function _htmlBloquear(clinicas) {
  const checks = clinicas.map(c => `
    <label style="display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:8px;cursor:pointer;border:0.5px solid #e2e8f0;font-size:13px;color:#1e293b;">
      <input type="checkbox" data-cid="${escapeHtml(c.id)}" style="accent-color:#1a56db;width:15px;height:15px;" />
      ${escapeHtml(c.name)}
    </label>`).join("");

  return _card(`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
      <div style="display:flex;flex-direction:column;gap:4px;">
        ${_label("Clínicas a bloquear")}
        <div style="display:flex;gap:6px;margin-bottom:6px;">
          <button id="gaModoSel" style="padding:4px 12px;font-size:12px;border-radius:999px;border:0.5px solid #1a56db;background:#eff6ff;color:#1a56db;cursor:pointer;">Seleccionar</button>
          <button id="gaModoExc" style="padding:4px 12px;font-size:12px;border-radius:999px;border:0.5px solid #e2e8f0;background:transparent;color:#64748b;cursor:pointer;">Todas excepto...</button>
        </div>
        <div id="gaClinicasChecks" style="display:flex;flex-direction:column;gap:6px;">${checks}</div>
        <div id="gaClinicasLabel" style="font-size:12px;color:#64748b;margin-top:4px;"></div>
      </div>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div style="display:flex;flex-direction:column;gap:4px;">${_label("Motivo")}${_select("gaMotivo", `<option>Férias</option><option>FPF</option><option>Congresso</option><option>Outro</option>`)}</div>
        <div style="display:flex;flex-direction:column;gap:4px;">
          ${_label("Tipo de bloqueio")}
          <div style="display:flex;gap:6px;">
            <button id="gaTipoDia" style="padding:5px 14px;font-size:12px;border-radius:999px;border:0.5px solid #1a56db;background:#eff6ff;color:#1a56db;cursor:pointer;">Dia inteiro</button>
            <button id="gaTipoHoras" style="padding:5px 14px;font-size:12px;border-radius:999px;border:0.5px solid #e2e8f0;background:transparent;color:#64748b;cursor:pointer;">Período de horas</button>
          </div>
        </div>
      </div>
    </div>

    <div id="gaBloqDia" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
      <div style="display:flex;flex-direction:column;gap:4px;">${_label("Data início")}<input id="gaBloqDataInicio" type="date" style="padding:7px 10px;border-radius:8px;border:1px solid #e2e8f0;font-size:13px;" /></div>
      <div style="display:flex;flex-direction:column;gap:4px;">${_label("Data fim")}<input id="gaBloqDataFim" type="date" style="padding:7px 10px;border-radius:8px;border:1px solid #e2e8f0;font-size:13px;" /></div>
    </div>

    <div id="gaBloqHoras" style="display:none;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px;">
      <div style="display:flex;flex-direction:column;gap:4px;">${_label("Data")}<input id="gaBloqData" type="date" style="padding:7px 10px;border-radius:8px;border:1px solid #e2e8f0;font-size:13px;" /></div>
      <div style="display:flex;flex-direction:column;gap:4px;">${_label("Das")}<input id="gaBloqHoraIni" type="time" value="16:40" style="padding:7px 10px;border-radius:8px;border:1px solid #e2e8f0;font-size:13px;" /></div>
      <div style="display:flex;flex-direction:column;gap:4px;">${_label("Às")}<input id="gaBloqHoraFim" type="time" value="17:00" style="padding:7px 10px;border-radius:8px;border:1px solid #e2e8f0;font-size:13px;" /></div>
    </div>

    <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:12px;">
      ${_label("Nota interna (opcional)")}
      <input id="gaBloqNota" type="text" placeholder="Ex: FPF — estágio seleção" style="padding:7px 10px;border-radius:8px;border:1px solid #e2e8f0;font-size:13px;font-family:inherit;" />
    </div>

    <div style="padding:10px 14px;background:#fffbeb;border:0.5px solid #fcd34d;border-radius:8px;font-size:12px;color:#92400e;margin-bottom:12px;">
      Quando um slot está bloqueado e se tenta forçar uma marcação, a administrativa verá: <strong>"Este horário está indisponível. Por favor contacte o Dr. João Morais para confirmação."</strong>
    </div>

    <div style="display:flex;gap:8px;justify-content:flex-end;">
      <button id="gaBtnCancelarBloq" class="gcBtnGhost" style="font-size:12px;padding:7px 14px;border-radius:8px;">Cancelar</button>
      <button id="gaBtnBloquear" class="gcBtnDanger" style="font-size:12px;padding:7px 18px;border-radius:8px;font-weight:600;">Bloquear</button>
    </div>`) +

    `<div style="font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.04em;margin:1.5rem 0 0.75rem;">Bloqueios activos</div>
    <div id="gaBloqueiosActivos">` + _card(`<div style="font-size:13px;color:#94a3b8;text-align:center;padding:16px 0;">Sem bloqueios activos.</div>`) + `</div>`;
}

function _htmlSemana() {
  const dias = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  const hoje = new Date();
  const dow = (hoje.getDay() + 6) % 7;
  const seg = new Date(hoje); seg.setDate(hoje.getDate() - dow);

  const cols = dias.map((d, i) => {
    const dt = new Date(seg); dt.setDate(seg.getDate() + i);
    const isHoje = dt.toDateString() === hoje.toDateString();
    return `<div style="display:flex;flex-direction:column;gap:4px;">
      <div style="font-size:11px;font-weight:600;text-align:center;color:${isHoje ? "#1a56db" : "#64748b"};padding-bottom:6px;border-bottom:0.5px solid #e2e8f0;margin-bottom:4px;">${d} ${dt.getDate()}</div>
    </div>`;
  }).join("");

  const legend = [
    { bg: "#dbeafe", border: "#93c5fd", color: "#1e40af", label: "Livre" },
    { bg: "#d1fae5", border: "#6ee7b7", color: "#065f46", label: "Ocupado" },
    { bg: "#fef3c7", border: "#fcd34d", color: "#92400e", label: "Forçado" },
    { bg: "#fee2e2", border: "#fca5a5", color: "#991b1b", label: "Bloqueado" },
  ].map(l => `<div style="display:flex;align-items:center;gap:6px;font-size:12px;color:#64748b;">
    <div style="width:10px;height:10px;border-radius:2px;background:${l.bg};border:0.5px solid ${l.border};"></div>${l.label}
  </div>`).join("");

  return `<div style="display:flex;gap:16px;margin-bottom:12px;flex-wrap:wrap;">${legend}</div>` +
    _card(`<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;" id="gaSemanaCols">${cols}</div>
      <div style="margin-top:12px;padding:8px 12px;background:#f8fafc;border-radius:8px;font-size:12px;color:#64748b;display:flex;align-items:center;gap:8px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        Sincronizado com Google Calendar — agrupamento por clínica mantido.
      </div>`);
}

function _wireGestaoAgenda(clinicas) {
  /* tabs */
  document.querySelectorAll(".ga-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-tab");
      document.querySelectorAll(".ga-tab").forEach(b => {
        const isActive = b.getAttribute("data-tab") === tab;
        b.style.background = isActive ? "#fff" : "transparent";
        b.style.color = isActive ? "#0f2d52" : "#64748b";
        b.style.border = isActive ? "0.5px solid #e2e8f0" : "none";
      });
      ["abrir", "bloquear", "semana"].forEach(t => {
        const el = document.getElementById("ga-tab-" + t);
        if (el) el.style.display = t === tab ? "block" : "none";
      });
    });
  });

  /* preview slots */
  function updatePreview() {
    const ini = document.getElementById("gaHoraInicio")?.value || "09:00";
    const fim = document.getElementById("gaHoraFim")?.value || "13:00";
    const dur = parseInt(document.getElementById("gaDuracao")?.value || "20");
    const slots = gerarSlots(ini, fim, dur);
    const preview = document.getElementById("gaPreview");
    if (!preview) return;
    preview.innerHTML = slots.length
      ? `<div style="font-size:12px;color:#94a3b8;width:100%;margin-bottom:4px;">Slots gerados (${slots.length}):</div>` +
        slots.map(s => `<span style="padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600;background:#dbeafe;color:#1e40af;border:0.5px solid #93c5fd;">${s}</span>`).join("")
      : `<div style="font-size:12px;color:#94a3b8;">Sem slots — verifica as horas.</div>`;
  }

  ["gaHoraInicio", "gaHoraFim", "gaDuracao"].forEach(id => {
    document.getElementById(id)?.addEventListener("change", updatePreview);
  });

  /* data default */
  const today = new Date();
  const iso = today.getFullYear() + "-" + pad2(today.getMonth() + 1) + "-" + pad2(today.getDate());
  const gaData = document.getElementById("gaData");
  if (gaData) gaData.value = iso;
  updatePreview();

  /* criar slots */
  document.getElementById("gaBtnCriarSlots")?.addEventListener("click", async () => {
    const clinicId = document.getElementById("gaClinica")?.value;
    const data     = document.getElementById("gaData")?.value;
    const ini      = document.getElementById("gaHoraInicio")?.value;
    const fim      = document.getElementById("gaHoraFim")?.value;
    const dur      = parseInt(document.getElementById("gaDuracao")?.value || "20");
    const repetir  = document.getElementById("gaRepetir")?.value || "none";

    if (!clinicId || !data || !ini || !fim) {
      alert("Preenche clínica, data e horas.");
      return;
    }

    const slots = gerarSlots(ini, fim, dur);
    if (!slots.length) { alert("Sem slots a criar — verifica as horas."); return; }

    const datas = [data];
    if (repetir === "weekly") {
      for (let i = 1; i <= 11; i++) {
        const d = new Date(data + "T00:00:00");
        d.setDate(d.getDate() + i * 7);
        datas.push(d.toISOString().slice(0, 10));
      }
    } else if (repetir === "monthly") {
      for (let i = 1; i <= 5; i++) {
        const d = new Date(data + "T00:00:00");
        d.setMonth(d.getMonth() + i);
        datas.push(d.toISOString().slice(0, 10));
      }
    }

    const rows = [];
    for (const dt of datas) {
      for (const slot of slots) {
        const [sh, sm] = slot.split(":").map(Number);
        const startD = new Date(dt + "T" + pad2(sh) + ":" + pad2(sm) + ":00");
        const endD   = new Date(startD.getTime() + dur * 60000);
        rows.push({
          clinic_id:      clinicId,
          patient_id:     null,
          start_at:       startD.toISOString(),
          end_at:         endD.toISOString(),
          status:         "available",
          procedure_type: null,
          title:          "SLOT",
          notes:          null,
          mode:           "slot",
        });
      }
    }

    try {
      const { error } = await window.sb.from("appointments").insert(rows);
      if (error) throw error;
      alert(`${rows.length} slot(s) criado(s) com sucesso.`);
    } catch (e) {
      console.error(e);
      alert("Erro ao criar slots: " + (e.message || e));
    }
  });

  /* bloquear — tipo dia/horas */
  let tipoBloq = "dia";
  document.getElementById("gaTipoDia")?.addEventListener("click", () => {
    tipoBloq = "dia";
    document.getElementById("gaBloqDia").style.display = "grid";
    document.getElementById("gaBloqHoras").style.display = "none";
    document.getElementById("gaTipoDia").style.background = "#eff6ff";
    document.getElementById("gaTipoDia").style.color = "#1a56db";
    document.getElementById("gaTipoDia").style.borderColor = "#1a56db";
    document.getElementById("gaTipoHoras").style.background = "transparent";
    document.getElementById("gaTipoHoras").style.color = "#64748b";
    document.getElementById("gaTipoHoras").style.borderColor = "#e2e8f0";
  });
  document.getElementById("gaTipoHoras")?.addEventListener("click", () => {
    tipoBloq = "horas";
    document.getElementById("gaBloqDia").style.display = "none";
    document.getElementById("gaBloqHoras").style.display = "grid";
    document.getElementById("gaTipoHoras").style.background = "#eff6ff";
    document.getElementById("gaTipoHoras").style.color = "#1a56db";
    document.getElementById("gaTipoHoras").style.borderColor = "#1a56db";
    document.getElementById("gaTipoDia").style.background = "transparent";
    document.getElementById("gaTipoDia").style.color = "#64748b";
    document.getElementById("gaTipoDia").style.borderColor = "#e2e8f0";
  });

  /* bloquear — modo seleccionar/excluir */
  let modoClinicas = "sel";
  function updateClinicasLabel() {
    const checks = document.querySelectorAll("#gaClinicasChecks input[type=checkbox]");
    const sel = [], nao = [];
    checks.forEach(cb => {
      const nome = cb.closest("label")?.textContent?.trim() || cb.getAttribute("data-cid");
      if (cb.checked) sel.push(nome); else nao.push(nome);
    });
    const lbl = document.getElementById("gaClinicasLabel");
    if (!lbl) return;
    if (modoClinicas === "sel") {
      lbl.textContent = sel.length === 0 ? "Nenhuma seleccionada" : sel.length === clinicas.length ? "Todas as clínicas" : "Seleccionado: " + sel.join(", ");
    } else {
      lbl.textContent = nao.length === 0 ? "Todas as clínicas bloqueadas" : "Excepto: " + nao.join(", ");
    }
  }

  document.getElementById("gaModoSel")?.addEventListener("click", () => {
    modoClinicas = "sel";
    document.getElementById("gaModoSel").style.background = "#eff6ff";
    document.getElementById("gaModoSel").style.color = "#1a56db";
    document.getElementById("gaModoSel").style.borderColor = "#1a56db";
    document.getElementById("gaModoExc").style.background = "transparent";
    document.getElementById("gaModoExc").style.color = "#64748b";
    document.getElementById("gaModoExc").style.borderColor = "#e2e8f0";
    updateClinicasLabel();
  });
  document.getElementById("gaModoExc")?.addEventListener("click", () => {
    modoClinicas = "excluir";
    document.getElementById("gaModoExc").style.background = "#eff6ff";
    document.getElementById("gaModoExc").style.color = "#1a56db";
    document.getElementById("gaModoExc").style.borderColor = "#1a56db";
    document.getElementById("gaModoSel").style.background = "transparent";
    document.getElementById("gaModoSel").style.color = "#64748b";
    document.getElementById("gaModoSel").style.borderColor = "#e2e8f0";
    updateClinicasLabel();
  });

  document.querySelectorAll("#gaClinicasChecks input[type=checkbox]").forEach(cb => {
    cb.addEventListener("change", updateClinicasLabel);
  });
  updateClinicasLabel();

  /* bloquear — guardar */
  document.getElementById("gaBtnBloquear")?.addEventListener("click", async () => {
    const motivo = document.getElementById("gaMotivo")?.value || "Outro";
    const nota   = document.getElementById("gaBloqNota")?.value?.trim() || null;

    const checks = document.querySelectorAll("#gaClinicasChecks input[type=checkbox]");
    let targetIds = [];
    if (modoClinicas === "sel") {
      checks.forEach(cb => { if (cb.checked) targetIds.push(cb.getAttribute("data-cid")); });
    } else {
      checks.forEach(cb => { if (!cb.checked) targetIds.push(cb.getAttribute("data-cid")); });
      if (targetIds.length === 0) targetIds = clinicas.map(c => c.id);
    }

    if (!targetIds.length) { alert("Selecciona pelo menos uma clínica."); return; }

    let rows = [];
    if (tipoBloq === "dia") {
      const ini = document.getElementById("gaBloqDataInicio")?.value;
      const fim = document.getElementById("gaBloqDataFim")?.value;
      if (!ini || !fim) { alert("Preenche as datas."); return; }
      const d1 = new Date(ini + "T00:00:00"), d2 = new Date(fim + "T23:59:59");
      for (const cid of targetIds) {
        rows.push({ clinic_id: cid, patient_id: null, start_at: d1.toISOString(), end_at: d2.toISOString(), status: "confirmed", procedure_type: null, title: "BLOQUEIO", notes: nota || motivo, mode: "bloqueio" });
      }
    } else {
      const dt  = document.getElementById("gaBloqData")?.value;
      const hi  = document.getElementById("gaBloqHoraIni")?.value;
      const hf  = document.getElementById("gaBloqHoraFim")?.value;
      if (!dt || !hi || !hf) { alert("Preenche data e horas."); return; }
      const d1 = new Date(dt + "T" + hi + ":00"), d2 = new Date(dt + "T" + hf + ":00");
      for (const cid of targetIds) {
        rows.push({ clinic_id: cid, patient_id: null, start_at: d1.toISOString(), end_at: d2.toISOString(), status: "confirmed", procedure_type: null, title: "BLOQUEIO", notes: nota || motivo, mode: "bloqueio" });
      }
    }

    try {
      const { error } = await window.sb.from("appointments").insert(rows);
      if (error) throw error;
      alert("Bloqueio criado com sucesso.");
      _loadBloqueiosActivos(clinicas);
    } catch (e) {
      console.error(e);
      alert("Erro ao criar bloqueio: " + (e.message || e));
    }
  });

  /* cancelar */
  document.getElementById("gaBtnCancelarSlots")?.addEventListener("click", () => {
    document.getElementById("gaHoraInicio").value = "09:00";
    document.getElementById("gaHoraFim").value = "13:00";
    updatePreview();
  });
  document.getElementById("gaBtnCancelarBloq")?.addEventListener("click", () => {
    document.getElementById("gaBloqNota").value = "";
  });

  _loadBloqueiosActivos(clinicas);
}

async function _loadBloqueiosActivos(clinicas) {
  const container = document.getElementById("gaBloqueiosActivos");
  if (!container) return;

  try {
    const { data, error } = await window.sb
      .from("appointments")
      .select("id, clinic_id, start_at, end_at, notes, mode")
      .eq("mode", "bloqueio")
      .gte("end_at", new Date().toISOString())
      .order("start_at", { ascending: true })
      .limit(20);

    if (error) throw error;
    const rows = data || [];

    if (!rows.length) {
      container.innerHTML = `<div style="background:#fff;border:0.5px solid #e2e8f0;border-radius:12px;padding:1rem 1.25rem;"><div style="font-size:13px;color:#94a3b8;text-align:center;padding:16px 0;">Sem bloqueios activos.</div></div>`;
      return;
    }

    const clinicMap = {};
    clinicas.forEach(c => { clinicMap[c.id] = c.name; });

    container.innerHTML = rows.map(r => {
      const clinNome = clinicMap[r.clinic_id] || "Global";
      const ini = new Date(r.start_at).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
      const fim = new Date(r.end_at).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
      return `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#fef2f2;border:0.5px solid #fca5a5;border-radius:10px;margin-bottom:8px;">
        <div>
          <div style="font-size:13px;font-weight:700;color:#991b1b;">${escapeHtml(r.notes || "Bloqueio")} — ${escapeHtml(clinNome)}</div>
          <div style="font-size:12px;color:#991b1b;opacity:0.8;">${ini} → ${fim}</div>
        </div>
        <button data-bid="${escapeHtml(r.id)}" style="font-size:12px;padding:4px 10px;border-radius:6px;border:0.5px solid #fca5a5;background:transparent;color:#991b1b;cursor:pointer;">Remover</button>
      </div>`;
    }).join("");

    container.querySelectorAll("[data-bid]").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!confirm("Remover este bloqueio?")) return;
        try {
          const { error } = await window.sb.from("appointments").delete().eq("id", btn.getAttribute("data-bid"));
          if (error) throw error;
          _loadBloqueiosActivos(clinicas);
        } catch (e) { alert("Erro ao remover: " + (e.message || e)); }
      });
    });

  } catch (e) {
    console.error(e);
    container.innerHTML = `<div style="color:#b00020;font-size:13px;padding:12px;">Erro ao carregar bloqueios.</div>`;
  }
}
