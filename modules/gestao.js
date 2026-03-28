/* ========================================================
   GESTAO.JS — Gestão clínica (profissionais, espaços, preços)
   --------------------------------------------------------
   GA — Queries Supabase
      GA.1  loadProfissionais()
      GA.2  loadEspacos(clinicId)
      GA.3  loadHorarios(clinicMemberId)
      GA.4  loadPrecos(clinicId)
      GA.5  loadProcedureTypes()

   GB — Helpers
      GB.1  escapeHtml(s)
      GB.2  roleLabel(role)
      GB.3  especialidadeLabel(esp)
      GB.4  iniciais(nome)

   GC — Render principal
      GC.1  renderGestao()

   GD — Secção Profissionais
      GD.1  renderSeccaoProfissionais(container, clinicId)
      GD.2  openModalProfissional(memberId)
      GD.3  openModalConvidar()

   GE — Secção Espaços
      GE.1  renderSeccaoEspacos(container, clinicId)
      GE.2  openModalEspaco(espacoId, clinicId)

   GF — Secção Preços
      GF.1  renderSeccaoPrecos(container, clinicId)
      GF.2  openModalPreco(precoId, clinicId)

   GG — Boot
      GG.1  initGestao()
   ======================================================== */

import { G } from "./state.js";

/* ==== GA — Queries Supabase ==== */

/* ---- GA.1 — loadProfissionais ---- */
async function loadProfissionais(clinicId) {
  let q = window.sb
    .from("clinic_members")
    .select(`
      id, clinic_id, user_id, role, display_name, is_active, created_at,
      profiles ( nome_completo, telemovel, especialidade, especialidade_detail, numero_ordem, avatar_url, role )
    `)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (clinicId) q = q.eq("clinic_id", clinicId);

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/* ---- GA.2 — loadEspacos ---- */
async function loadEspacos(clinicId) {
  let q = window.sb
    .from("clinic_spaces")
    .select("*")
    .order("nome", { ascending: true });

  if (clinicId) q = q.eq("clinic_id", clinicId);

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/* ---- GA.3 — loadHorarios ---- */
async function loadHorarios(clinicMemberId) {
  const { data, error } = await window.sb
    .from("provider_schedules")
    .select(`*, clinic_spaces ( nome )`)
    .eq("clinic_member_id", clinicMemberId)
    .eq("is_active", true)
    .order("dia_semana", { ascending: true });
  if (error) throw error;
  return data || [];
}

/* ---- GA.4 — loadPrecos ---- */
async function loadPrecos(clinicId) {
  let q = window.sb
    .from("clinic_prices")
    .select("*")
    .order("procedure_type", { ascending: true });

  if (clinicId) q = q.eq("clinic_id", clinicId);

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/* ---- GA.5 — loadProcedureTypes ---- */
async function loadProcedureTypes() {
  const { data, error } = await window.sb
    .from("procedure_types")
    .select("id, name")
    .eq("active", true)
    .order("id", { ascending: true });
  if (error) throw error;
  return data || [];
}


/* ==== GB — Helpers ==== */

/* ---- GB.1 — escapeHtml ---- */
function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ---- GB.2 — roleLabel ---- */
function roleLabel(role) {
  const map = {
    super_admin:    "Superadmin",
    admin:          "Admin",
    medico:         "Médico",
    tecnico:        "Técnico",
    administrativo: "Administrativo",
    fisioterapeuta: "Fisioterapeuta",
  };
  return map[role] || role || "—";
}

/* ---- GB.3 — especialidadeLabel ---- */
function especialidadeLabel(esp, espDetail) {
  if (!esp && !espDetail) return "—";
  if (esp && espDetail) return `${esp} · ${espDetail}`;
  return esp || espDetail || "—";
}

/* ---- GB.4 — iniciais ---- */
function iniciais(nome) {
  if (!nome) return "?";
  const parts = String(nome).trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* ---- GB.5 — diaSemanaLabel ---- */
function diaSemanaLabel(n) {
  return ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"][n] || "?";
}

/* ---- GB.6 — avatarCircle ---- */
function avatarCircle(nome, role) {
  const colors = {
    medico:         { bg: "#E6F1FB", fg: "#185FA5" },
    tecnico:        { bg: "#E1F5EE", fg: "#0F6E56" },
    administrativo: { bg: "#FAEEDA", fg: "#854F0B" },
    super_admin:    { bg: "#EEEDFE", fg: "#3C3489" },
    fisioterapeuta: { bg: "#E1F5EE", fg: "#0F6E56" },
  };
  const c = colors[role] || { bg: "#f1f5f9", fg: "#475569" };
  return `<div style="width:34px;height:34px;border-radius:50%;background:${c.bg};color:${c.fg};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;flex-shrink:0;">${escapeHtml(iniciais(nome))}</div>`;
}


/* ==== GC — Render principal ==== */

/* ---- GC.1 — renderGestao ---- */
export async function renderGestao() {
  const content = document.querySelector(".gc-content");
  if (!content) return;

  const isSuperAdmin = String(G.role || "").toLowerCase() === "super_admin";

  content.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:200px;color:#94a3b8;font-size:13px;">A carregar...</div>`;

  /* Estado da vista */
  let clinicaFiltro = (G.clinics && G.clinics.length === 1) ? G.clinics[0].id : "";
  let seccaoActiva  = "profissionais"; /* profissionais | espacos | precos */

  async function render() {
    let profissionais = [], espacos = [], precos = [], procedureTypes = [];
    try {
      [profissionais, espacos, precos, procedureTypes] = await Promise.all([
        loadProfissionais(clinicaFiltro || null),
        loadEspacos(clinicaFiltro || null),
        loadPrecos(clinicaFiltro || null),
        loadProcedureTypes(),
      ]);
    } catch (e) {
      content.innerHTML = `<div style="color:#b00020;padding:20px;font-size:13px;">Erro ao carregar: ${escapeHtml(e.message)}</div>`;
      return;
    }

    /* Agrupar profissionais por clínica */
    const clinicasVisiveis = G.clinics || [];

    content.innerHTML = `
<style>
.gest-tabs{display:flex;gap:0;border-bottom:0.5px solid #e2e8f0;margin-bottom:18px;}
.gest-tab{padding:9px 18px;font-size:13px;font-weight:500;cursor:pointer;color:#64748b;border:0.5px solid transparent;background:transparent;border-radius:8px 8px 0 0;font-family:inherit;transition:all .12s;}
.gest-tab:hover{color:#0f172a;background:#f8fafc;}
.gest-tab.on{color:#1a56db;background:#eff6ff;border-color:#bfdbfe #bfdbfe #eff6ff;font-weight:600;}
.gest-card{background:#fff;border:0.5px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:12px;}
.gest-card-head{padding:11px 16px;border-bottom:0.5px solid #e2e8f0;display:flex;align-items:center;gap:10px;}
.gest-card-title{font-size:13px;font-weight:700;color:#0f172a;flex:1;}
.gest-row{display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:0.5px solid #f1f5f9;transition:background .1s;}
.gest-row:last-child{border-bottom:none;}
.gest-row:hover{background:#f8faff;}
.gest-badge{font-size:10px;padding:2px 7px;border-radius:4px;font-weight:500;white-space:nowrap;}
.gest-btn-sm{padding:5px 12px;border-radius:7px;border:0.5px solid #e2e8f0;background:#fff;font-size:12px;cursor:pointer;color:#0f172a;font-family:inherit;}
.gest-btn-sm:hover{background:#f8fafc;}
.gest-add-row{display:flex;align-items:center;justify-content:center;padding:10px 16px;cursor:pointer;color:#94a3b8;font-size:12px;border-top:0.5px dashed #e2e8f0;transition:background .1s;}
.gest-add-row:hover{background:#f8faff;color:#1a56db;}
.gest-empty{padding:24px;text-align:center;color:#94a3b8;font-size:12px;}
</style>

<!-- TOPO -->
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
  <div>
    <div style="font-size:19px;font-weight:800;color:#0f2d52;">Gestão</div>
    <div style="font-size:12px;color:#94a3b8;margin-top:2px;">Profissionais, espaços e preços</div>
  </div>
  <div style="display:flex;gap:8px;align-items:center;">
    <select id="gestSelClinica" style="padding:6px 10px;border:0.5px solid #e2e8f0;border-radius:8px;background:#fff;font-size:12px;color:#0f172a;font-family:inherit;">
      <option value="">Todas as clínicas</option>
      ${clinicasVisiveis.map(c => `<option value="${escapeHtml(c.id)}" ${clinicaFiltro === c.id ? "selected" : ""}>${escapeHtml(c.name || c.slug)}</option>`).join("")}
    </select>
  </div>
</div>

<!-- STATS -->
<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:18px;">
  <div style="background:#f8fafc;border-radius:10px;padding:12px 16px;">
    <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;font-weight:500;">Profissionais</div>
    <div style="font-size:22px;font-weight:700;color:#0f172a;">${profissionais.length}</div>
    <div style="font-size:11px;color:#94a3b8;margin-top:3px;">${[...new Set(profissionais.map(p => p.role))].map(roleLabel).join(" · ") || "—"}</div>
  </div>
  <div style="background:#f8fafc;border-radius:10px;padding:12px 16px;">
    <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;font-weight:500;">Espaços</div>
    <div style="font-size:22px;font-weight:700;color:#0f172a;">${espacos.length}</div>
    <div style="font-size:11px;color:#94a3b8;margin-top:3px;">${espacos.length ? espacos.slice(0,3).map(e => escapeHtml(e.nome)).join(" · ") : "Nenhum definido"}</div>
  </div>
  <div style="background:#f8fafc;border-radius:10px;padding:12px 16px;">
    <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;font-weight:500;">Tabela de preços</div>
    <div style="font-size:22px;font-weight:700;color:#0f172a;">${precos.length}</div>
    <div style="font-size:11px;color:#94a3b8;margin-top:3px;">${clinicaFiltro ? (G.clinicsById[clinicaFiltro]?.name || "—") : "todas as clínicas"}</div>
  </div>
</div>

<!-- TABS -->
<div class="gest-tabs">
  <button class="gest-tab${seccaoActiva === "profissionais" ? " on" : ""}" data-tab="profissionais">Profissionais</button>
  <button class="gest-tab${seccaoActiva === "espacos" ? " on" : ""}" data-tab="espacos">Espaços e gabinetes</button>
  <button class="gest-tab${seccaoActiva === "precos" ? " on" : ""}" data-tab="precos">Tabela de preços</button>
</div>

<!-- CONTEÚDO DAS TABS -->
<div id="gestTabContent"></div>
    `;

    /* Wire selector de clínica */
    content.querySelector("#gestSelClinica")?.addEventListener("change", (e) => {
      clinicaFiltro = e.target.value;
      render();
    });

    /* Wire tabs */
    content.querySelectorAll(".gest-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        seccaoActiva = btn.getAttribute("data-tab");
        content.querySelectorAll(".gest-tab").forEach(b => b.classList.toggle("on", b === btn));
        renderTab();
      });
    });

    function renderTab() {
      const tabContent = content.querySelector("#gestTabContent");
      if (!tabContent) return;
      if (seccaoActiva === "profissionais") renderSeccaoProfissionais(tabContent, profissionais, espacos, clinicaFiltro);
      else if (seccaoActiva === "espacos")  renderSeccaoEspacos(tabContent, espacos, clinicaFiltro);
      else if (seccaoActiva === "precos")   renderSeccaoPrecos(tabContent, precos, procedureTypes, clinicaFiltro);
    }

    renderTab();
  }

  await render();
}


/* ==== GD — Secção Profissionais ==== */

/* ---- GD.1 — renderSeccaoProfissionais ---- */
function renderSeccaoProfissionais(container, profissionais, espacos, clinicaFiltro) {
  /* Agrupar por clínica */
  const clinicas = G.clinics || [];
  const clinicasParaMostrar = clinicaFiltro
    ? clinicas.filter(c => c.id === clinicaFiltro)
    : clinicas;

  /* Agrupar membros por role */
  const grupos = [
    { role: "medico",         label: "Médicos",          icon: "🩺" },
    { role: "tecnico",        label: "Técnicos",          icon: "🏃" },
    { role: "fisioterapeuta", label: "Fisioterapeutas",   icon: "🏃" },
    { role: "administrativo", label: "Administrativos",   icon: "📋" },
    { role: "super_admin",    label: "Administração",     icon: "⚙️" },
  ];

  /* Filtrar profissionais pela clínica seleccionada */
  const membros = clinicaFiltro
    ? profissionais.filter(p => p.clinic_id === clinicaFiltro)
    : profissionais;

  /* Agrupar por user_id para mostrar uma linha por pessoa com todas as clínicas */
  const porUser = {};
  for (const m of membros) {
    if (!porUser[m.user_id]) porUser[m.user_id] = { ...m, clinicIds: [] };
    porUser[m.user_id].clinicIds.push(m.clinic_id);
  }
  const membrosUnicos = Object.values(porUser);

  let html = "";

  for (const grupo of grupos) {
    const lista = membrosUnicos.filter(m => m.role === grupo.role);
    if (!lista.length) continue;

    html += `
<div class="gest-card" style="margin-bottom:14px;">
  <div class="gest-card-head">
    <span style="font-size:15px;">${grupo.icon}</span>
    <span class="gest-card-title">${grupo.label}</span>
    <span style="font-size:11px;color:#94a3b8;">${lista.length} activo${lista.length !== 1 ? "s" : ""}</span>
  </div>
  ${lista.map(m => {
    const nome = m.profiles?.nome_completo || m.display_name || m.user_id;
    const esp  = especialidadeLabel(m.profiles?.especialidade, m.profiles?.especialidade_detail);
    const clinicasNomes = (m.clinicIds || [])
      .map(cid => G.clinicsById?.[cid]?.name || cid)
      .join(", ");
    return `
  <div class="gest-row" data-member-id="${escapeHtml(m.id)}">
    ${avatarCircle(nome, m.role)}
    <div style="flex:1;min-width:0;">
      <div style="font-size:13px;font-weight:700;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(nome)}</div>
      <div style="font-size:11px;color:#64748b;margin-top:1px;">${escapeHtml(esp)}${clinicaFiltro ? "" : ` · ${escapeHtml(clinicasNomes)}`}</div>
    </div>
    ${m.profiles?.numero_ordem ? `<span style="font-size:11px;color:#94a3b8;">Ord. ${escapeHtml(m.profiles.numero_ordem)}</span>` : ""}
    <button class="gest-btn-sm btn-editar-prof" data-member-id="${escapeHtml(m.id)}" data-user-id="${escapeHtml(m.user_id)}">Editar</button>
    <button class="gest-btn-sm btn-horario-prof" data-member-id="${escapeHtml(m.id)}" data-nome="${escapeHtml(nome)}">Horário</button>
  </div>`;
  }).join("")}
  <div class="gest-add-row btn-convidar" data-role="${grupo.role}">＋ Adicionar ${grupo.label.toLowerCase().slice(0, -1)}</div>
</div>`;
  }

  if (!membrosUnicos.length) {
    html = `<div class="gest-empty">Nenhum profissional${clinicaFiltro ? " nesta clínica" : ""}.</div>`;
  }

  /* Botão convidar geral */
  html += `
<button id="btnConvidarProfissional" style="display:flex;align-items:center;gap:6px;padding:9px 16px;border-radius:10px;border:0.5px dashed #1a56db;background:#eff6ff;color:#1a56db;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;width:100%;justify-content:center;">
  ＋ Convidar novo profissional
</button>`;

  container.innerHTML = html;

  /* Wire botões editar */
  container.querySelectorAll(".btn-editar-prof").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openModalEditarProfissional(btn.dataset.memberId, btn.dataset.userId);
    });
  });

  /* Wire botões horário */
  container.querySelectorAll(".btn-horario-prof").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openModalHorario(btn.dataset.memberId, btn.dataset.nome);
    });
  });

  /* Wire botões convidar por grupo */
  container.querySelectorAll(".btn-convidar").forEach(btn => {
    btn.addEventListener("click", () => openModalConvidar(btn.dataset.role, clinicaFiltro));
  });

  container.querySelector("#btnConvidarProfissional")?.addEventListener("click", () => {
    openModalConvidar(null, clinicaFiltro);
  });
}


/* ---- GD.2 — openModalEditarProfissional ---- */
async function openModalEditarProfissional(memberId, userId) {
  /* Carregar dados actuais */
  let profile = null;
  let membros = [];
  try {
    const [profRes, memRes] = await Promise.all([
      window.sb.from("profiles").select("*").eq("id", userId).single(),
      window.sb.from("clinic_members").select("*, clinics(name)").eq("user_id", userId).eq("is_active", true),
    ]);
    profile = profRes.data;
    membros = memRes.data || [];
  } catch (e) {
    alert("Erro ao carregar perfil: " + e.message);
    return;
  }

  const ROLES = ["medico", "tecnico", "administrativo", "super_admin"];
  const ESPECIALIDADES_MEDICO = ["Fisiatria", "Ortopedia", "Medicina Desportiva", "Medicina Geral", "Cardiologia", "Neurologia", "Outra"];
  const ESPECIALIDADES_TECNICO = ["Fisioterapia", "Fisiologia do Exercício", "Nutrição", "Enfermagem", "Outra"];

  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(15,45,82,0.35);z-index:2000;display:flex;align-items:center;justify-content:center;padding:16px;";

  const nome = profile?.nome_completo || "";
  const roleActual = membros[0]?.role || "medico";

  overlay.innerHTML = `
<div style="background:#fff;border-radius:16px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto;display:flex;flex-direction:column;">
  <div style="padding:16px 20px;border-bottom:0.5px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;">
    <div style="font-size:15px;font-weight:700;color:#0f172a;">Editar profissional</div>
    <button id="gEditClose" style="border:none;background:none;font-size:18px;cursor:pointer;color:#94a3b8;padding:0;">✕</button>
  </div>

  <div style="padding:18px 20px;display:flex;flex-direction:column;gap:14px;">

    <!-- Nome -->
    <div>
      <label style="display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:5px;">Nome completo</label>
      <input id="gEditNome" type="text" value="${escapeHtml(nome)}" style="width:100%;border:1px solid #D1D5DB;border-radius:8px;padding:8px 12px;font-size:13px;font-family:inherit;box-sizing:border-box;">
    </div>

    <!-- Telefone -->
    <div>
      <label style="display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:5px;">Telemóvel</label>
      <input id="gEditTel" type="text" value="${escapeHtml(profile?.telemovel || "")}" style="width:100%;border:1px solid #D1D5DB;border-radius:8px;padding:8px 12px;font-size:13px;font-family:inherit;box-sizing:border-box;">
    </div>

    <!-- Role -->
    <div>
      <label style="display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:5px;">Função</label>
      <select id="gEditRole" style="width:100%;border:1px solid #D1D5DB;border-radius:8px;padding:8px 12px;font-size:13px;font-family:inherit;box-sizing:border-box;">
        ${ROLES.map(r => `<option value="${r}" ${roleActual === r ? "selected" : ""}>${roleLabel(r)}</option>`).join("")}
      </select>
    </div>

    <!-- Especialidade -->
    <div id="gEditEspWrap">
      <label style="display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:5px;">Especialidade</label>
      <select id="gEditEsp" style="width:100%;border:1px solid #D1D5DB;border-radius:8px;padding:8px 12px;font-size:13px;font-family:inherit;box-sizing:border-box;">
        <option value="">— Seleccionar —</option>
        ${(roleActual === "medico" ? ESPECIALIDADES_MEDICO : ESPECIALIDADES_TECNICO)
          .map(e => `<option value="${e}" ${profile?.especialidade === e ? "selected" : ""}>${e}</option>`).join("")}
      </select>
    </div>

    <!-- Especialidade detalhe (médico) -->
    <div id="gEditEspDetailWrap" style="${roleActual !== "medico" ? "display:none;" : ""}">
      <label style="display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:5px;">Sub-especialidade / detalhe</label>
      <input id="gEditEspDetail" type="text" placeholder="ex: Medicina Desportiva" value="${escapeHtml(profile?.especialidade_detail || "")}" style="width:100%;border:1px solid #D1D5DB;border-radius:8px;padding:8px 12px;font-size:13px;font-family:inherit;box-sizing:border-box;">
    </div>

    <!-- Número de ordem -->
    <div>
      <label style="display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:5px;">Nº Ordem profissional</label>
      <input id="gEditOrdem" type="text" value="${escapeHtml(profile?.numero_ordem || "")}" style="width:100%;border:1px solid #D1D5DB;border-radius:8px;padding:8px 12px;font-size:13px;font-family:inherit;box-sizing:border-box;">
    </div>

    <!-- Clínicas associadas -->
    <div>
      <label style="display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:8px;">Clínicas associadas</label>
      <div style="display:flex;flex-direction:column;gap:6px;">
        ${(G.clinics || []).map(c => {
          const isAssoc = membros.some(m => m.clinic_id === c.id);
          return `<label style="display:flex;align-items:center;gap:8px;font-size:13px;color:#374151;cursor:pointer;">
            <input type="checkbox" data-clinic-id="${escapeHtml(c.id)}" ${isAssoc ? "checked" : ""} style="width:14px;height:14px;">
            ${escapeHtml(c.name || c.slug)}
          </label>`;
        }).join("")}
      </div>
    </div>

    <div id="gEditMsg" style="font-size:12px;color:#b00020;min-height:14px;"></div>
  </div>

  <div style="padding:14px 20px 18px;border-top:0.5px solid #e2e8f0;display:flex;gap:8px;flex-shrink:0;">
    <button id="gEditSave" style="flex:1;background:#1a56db;color:#fff;border:none;border-radius:10px;padding:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">Guardar</button>
    <button id="gEditCancel" style="padding:10px 16px;border:0.5px solid #e2e8f0;border-radius:10px;background:#fff;font-size:13px;cursor:pointer;font-family:inherit;">Cancelar</button>
  </div>
</div>`;

  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector("#gEditClose").addEventListener("click", close);
  overlay.querySelector("#gEditCancel").addEventListener("click", close);
  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });

  /* Actualizar especialidades quando muda o role */
  overlay.querySelector("#gEditRole").addEventListener("change", (e) => {
    const r = e.target.value;
    const espSel = overlay.querySelector("#gEditEsp");
    const detailWrap = overlay.querySelector("#gEditEspDetailWrap");
    const esps = r === "medico" ? ESPECIALIDADES_MEDICO : ESPECIALIDADES_TECNICO;
    espSel.innerHTML = `<option value="">— Seleccionar —</option>` +
      esps.map(es => `<option value="${es}">${es}</option>`).join("");
    detailWrap.style.display = r === "medico" ? "" : "none";
    overlay.querySelector("#gEditEspWrap").style.display = r === "administrativo" ? "none" : "";
  });

  /* Guardar */
  overlay.querySelector("#gEditSave").addEventListener("click", async () => {
    const btn = overlay.querySelector("#gEditSave");
    const msg = overlay.querySelector("#gEditMsg");
    btn.disabled = true;
    btn.textContent = "A guardar…";
    msg.textContent = "";

    try {
      const nomeVal     = overlay.querySelector("#gEditNome").value.trim();
      const telVal      = overlay.querySelector("#gEditTel").value.trim();
      const roleVal     = overlay.querySelector("#gEditRole").value;
      const espVal      = overlay.querySelector("#gEditEsp").value;
      const espDetVal   = overlay.querySelector("#gEditEspDetail")?.value.trim() || "";
      const ordemVal    = overlay.querySelector("#gEditOrdem").value.trim();

      if (!nomeVal) throw new Error("Nome obrigatório.");

      /* Actualizar profile */
      const { error: profErr } = await window.sb
        .from("profiles")
        .update({
          nome_completo:        nomeVal,
          telemovel:            telVal || null,
          especialidade:        espVal || null,
          especialidade_detail: espDetVal || null,
          numero_ordem:         ordemVal || null,
          role:                 roleVal,
          updated_at:           new Date().toISOString(),
        })
        .eq("id", userId);
      if (profErr) throw profErr;

      /* Actualizar role em todos os clinic_members deste user */
      const { error: memErr } = await window.sb
        .from("clinic_members")
        .update({ role: roleVal })
        .eq("user_id", userId);
      if (memErr) throw memErr;

      /* Gerir associação a clínicas */
      const checkboxes = overlay.querySelectorAll("[data-clinic-id]");
      for (const cb of checkboxes) {
        const cid     = cb.dataset.clinicId;
        const checked = cb.checked;
        const existe  = membros.find(m => m.clinic_id === cid);
        if (checked && !existe) {
          /* Associar à clínica */
          await window.sb.from("clinic_members").insert({
            clinic_id:    cid,
            user_id:      userId,
            role:         roleVal,
            display_name: nomeVal,
            is_active:    true,
          });
        } else if (!checked && existe) {
          /* Desassociar */
          await window.sb.from("clinic_members").update({ is_active: false }).eq("id", existe.id);
        } else if (checked && existe) {
          /* Actualizar display_name */
          await window.sb.from("clinic_members").update({ display_name: nomeVal, role: roleVal }).eq("id", existe.id);
        }
      }

      close();
      renderGestao();
    } catch (e) {
      msg.textContent = e.message || "Erro ao guardar.";
      btn.disabled = false;
      btn.textContent = "Guardar";
    }
  });
}


/* ---- GD.3 — openModalHorario ---- */
async function openModalHorario(memberId, nomeProf) {
  let horarios = [], espacos = [];
  try {
    [horarios, espacos] = await Promise.all([
      loadHorarios(memberId),
      loadEspacos(null),
    ]);
  } catch (e) {
    alert("Erro ao carregar horários: " + e.message);
    return;
  }

  const DIAS = ["Segunda","Terça","Quarta","Quinta","Sexta","Sábado","Domingo"];

  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(15,45,82,0.35);z-index:2000;display:flex;align-items:center;justify-content:center;padding:16px;";

  function buildHorarioHtml() {
    if (!horarios.length) return `<div style="padding:20px;text-align:center;color:#94a3b8;font-size:12px;">Sem horários definidos.</div>`;
    return horarios.map(h => `
<div style="display:flex;align-items:center;gap:10px;padding:8px 16px;border-bottom:0.5px solid #f1f5f9;" data-hid="${escapeHtml(h.id)}">
  <span style="font-size:12px;font-weight:600;color:#0f172a;width:30px;">${diaSemanaLabel(h.dia_semana)}</span>
  <span style="font-size:12px;color:#374151;">${escapeHtml(String(h.hora_inicio || "").slice(0,5))} – ${escapeHtml(String(h.hora_fim || "").slice(0,5))}</span>
  <span style="font-size:11px;color:#94a3b8;">${h.duracao_slot_min ? `${h.duracao_slot_min} min` : ""}</span>
  ${h.clinic_spaces?.nome ? `<span style="font-size:11px;background:#f1f5f9;color:#475569;padding:1px 6px;border-radius:4px;">${escapeHtml(h.clinic_spaces.nome)}</span>` : ""}
  <div style="flex:1;"></div>
  <button class="btn-rm-horario" data-hid="${escapeHtml(h.id)}" style="border:none;background:none;color:#94a3b8;cursor:pointer;font-size:13px;padding:2px 6px;" title="Remover">✕</button>
</div>`).join("");
  }

  overlay.innerHTML = `
<div style="background:#fff;border-radius:16px;width:100%;max-width:460px;max-height:90vh;overflow-y:auto;display:flex;flex-direction:column;">
  <div style="padding:14px 20px;border-bottom:0.5px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;">
    <div style="font-size:15px;font-weight:700;color:#0f172a;">Horário · ${escapeHtml(nomeProf)}</div>
    <button id="gHorClose" style="border:none;background:none;font-size:18px;cursor:pointer;color:#94a3b8;">✕</button>
  </div>

  <!-- Lista de horários actuais -->
  <div id="gHorLista" style="flex:1;">${buildHorarioHtml()}</div>

  <!-- Formulário adicionar -->
  <div style="padding:14px 20px;border-top:0.5px solid #e2e8f0;background:#f8fafc;">
    <div style="font-size:12px;font-weight:600;color:#374151;margin-bottom:10px;">Adicionar período</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
      <div>
        <label style="font-size:11px;color:#6B7280;display:block;margin-bottom:3px;">Dia da semana</label>
        <select id="gHorDia" style="width:100%;border:1px solid #D1D5DB;border-radius:7px;padding:7px 10px;font-size:12px;font-family:inherit;">
          ${DIAS.map((d, i) => `<option value="${i}">${d}</option>`).join("")}
        </select>
      </div>
      <div>
        <label style="font-size:11px;color:#6B7280;display:block;margin-bottom:3px;">Espaço / gabinete</label>
        <select id="gHorEspaco" style="width:100%;border:1px solid #D1D5DB;border-radius:7px;padding:7px 10px;font-size:12px;font-family:inherit;">
          <option value="">— Nenhum —</option>
          ${espacos.map(e => `<option value="${escapeHtml(e.id)}">${escapeHtml(e.nome)}</option>`).join("")}
        </select>
      </div>
      <div>
        <label style="font-size:11px;color:#6B7280;display:block;margin-bottom:3px;">Das</label>
        <input id="gHorIni" type="time" value="09:00" style="width:100%;border:1px solid #D1D5DB;border-radius:7px;padding:7px 10px;font-size:12px;font-family:inherit;">
      </div>
      <div>
        <label style="font-size:11px;color:#6B7280;display:block;margin-bottom:3px;">Às</label>
        <input id="gHorFim" type="time" value="13:00" style="width:100%;border:1px solid #D1D5DB;border-radius:7px;padding:7px 10px;font-size:12px;font-family:inherit;">
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
      <label style="font-size:11px;color:#6B7280;">Duração de cada slot (min)</label>
      <select id="gHorSlot" style="border:1px solid #D1D5DB;border-radius:7px;padding:6px 10px;font-size:12px;font-family:inherit;">
        <option value="">Livre</option>
        <option value="15">15 min</option>
        <option value="20">20 min</option>
        <option value="30">30 min</option>
        <option value="45">45 min</option>
        <option value="60">60 min</option>
      </select>
    </div>
    <div id="gHorMsg" style="font-size:12px;color:#b00020;min-height:14px;margin-bottom:8px;"></div>
    <button id="gHorAdd" style="width:100%;background:#1a56db;color:#fff;border:none;border-radius:9px;padding:9px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">＋ Adicionar período</button>
  </div>
</div>`;

  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector("#gHorClose").addEventListener("click", close);
  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });

  function rewireRemove() {
    overlay.querySelectorAll(".btn-rm-horario").forEach(btn => {
      btn.addEventListener("click", async () => {
        const hid = btn.dataset.hid;
        try {
          await window.sb.from("provider_schedules").update({ is_active: false }).eq("id", hid);
          horarios = horarios.filter(h => h.id !== hid);
          overlay.querySelector("#gHorLista").innerHTML = buildHorarioHtml();
          rewireRemove();
        } catch (e) { alert("Erro: " + e.message); }
      });
    });
  }
  rewireRemove();

  overlay.querySelector("#gHorAdd").addEventListener("click", async () => {
    const btn = overlay.querySelector("#gHorAdd");
    const msg = overlay.querySelector("#gHorMsg");
    msg.textContent = "";
    const dia   = parseInt(overlay.querySelector("#gHorDia").value, 10);
    const ini   = overlay.querySelector("#gHorIni").value;
    const fim   = overlay.querySelector("#gHorFim").value;
    const slot  = overlay.querySelector("#gHorSlot").value;
    const espId = overlay.querySelector("#gHorEspaco").value || null;

    if (!ini || !fim) { msg.textContent = "Preenche as horas."; return; }
    if (ini >= fim)   { msg.textContent = "A hora de início tem de ser antes do fim."; return; }

    btn.disabled = true;
    btn.textContent = "A guardar…";
    try {
      const payload = {
        clinic_member_id: memberId,
        dia_semana:       dia,
        hora_inicio:      ini,
        hora_fim:         fim,
        duracao_slot_min: slot ? parseInt(slot, 10) : null,
        space_id:         espId,
        is_active:        true,
      };
      const { data, error } = await window.sb
        .from("provider_schedules").insert(payload).select("*, clinic_spaces(nome)").single();
      if (error) throw error;
      horarios.push(data);
      overlay.querySelector("#gHorLista").innerHTML = buildHorarioHtml();
      rewireRemove();
    } catch (e) {
      msg.textContent = e.message || "Erro ao guardar.";
    } finally {
      btn.disabled = false;
      btn.textContent = "＋ Adicionar período";
    }
  });
}


/* ---- GD.4 — openModalConvidar ---- */
function openModalConvidar(roleDefault, clinicaFiltro) {
  const ROLES = ["medico", "tecnico", "administrativo"];
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(15,45,82,0.35);z-index:2000;display:flex;align-items:center;justify-content:center;padding:16px;";

  overlay.innerHTML = `
<div style="background:#fff;border-radius:16px;width:100%;max-width:420px;display:flex;flex-direction:column;">
  <div style="padding:14px 20px;border-bottom:0.5px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">
    <div style="font-size:15px;font-weight:700;color:#0f172a;">Convidar profissional</div>
    <button id="gInvClose" style="border:none;background:none;font-size:18px;cursor:pointer;color:#94a3b8;">✕</button>
  </div>
  <div style="padding:18px 20px;display:flex;flex-direction:column;gap:12px;">
    <div style="background:#eff6ff;border:0.5px solid #bfdbfe;border-radius:10px;padding:10px 14px;font-size:12px;color:#1e40af;line-height:1.5;">
      O profissional receberá um email de convite para criar a sua conta. Depois de aceitar, associa-o às clínicas aqui.
    </div>
    <div>
      <label style="display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:5px;">Email</label>
      <input id="gInvEmail" type="email" placeholder="email@exemplo.pt" style="width:100%;border:1px solid #D1D5DB;border-radius:8px;padding:8px 12px;font-size:13px;font-family:inherit;box-sizing:border-box;">
    </div>
    <div>
      <label style="display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:5px;">Função</label>
      <select id="gInvRole" style="width:100%;border:1px solid #D1D5DB;border-radius:8px;padding:8px 12px;font-size:13px;font-family:inherit;box-sizing:border-box;">
        ${ROLES.map(r => `<option value="${r}" ${roleDefault === r ? "selected" : ""}>${roleLabel(r)}</option>`).join("")}
      </select>
    </div>
    <div>
      <label style="display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:8px;">Clínica(s)</label>
      <div style="display:flex;flex-direction:column;gap:6px;">
        ${(G.clinics || []).map(c => `
          <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:#374151;cursor:pointer;">
            <input type="checkbox" data-clinic-id="${escapeHtml(c.id)}" ${clinicaFiltro === c.id ? "checked" : ""} style="width:14px;height:14px;">
            ${escapeHtml(c.name || c.slug)}
          </label>`).join("")}
      </div>
    </div>
    <div id="gInvMsg" style="font-size:12px;color:#b00020;min-height:14px;"></div>
  </div>
  <div style="padding:14px 20px 18px;border-top:0.5px solid #e2e8f0;display:flex;gap:8px;">
    <button id="gInvSave" style="flex:1;background:#1a56db;color:#fff;border:none;border-radius:10px;padding:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">Enviar convite</button>
    <button id="gInvCancel" style="padding:10px 16px;border:0.5px solid #e2e8f0;border-radius:10px;background:#fff;font-size:13px;cursor:pointer;font-family:inherit;">Cancelar</button>
  </div>
</div>`;

  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector("#gInvClose").addEventListener("click", close);
  overlay.querySelector("#gInvCancel").addEventListener("click", close);
  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });

  overlay.querySelector("#gInvSave").addEventListener("click", async () => {
    const btn   = overlay.querySelector("#gInvSave");
    const msg   = overlay.querySelector("#gInvMsg");
    const email = overlay.querySelector("#gInvEmail").value.trim();
    const role  = overlay.querySelector("#gInvRole").value;
    const clinicIds = [...overlay.querySelectorAll("[data-clinic-id]:checked")].map(cb => cb.dataset.clinicId);

    msg.textContent = "";
    if (!email) { msg.textContent = "Email obrigatório."; return; }
    if (!clinicIds.length) { msg.textContent = "Selecciona pelo menos uma clínica."; return; }

    btn.disabled = true;
    btn.textContent = "A enviar…";
    try {
      /* Convidar via Supabase Auth */
      const { data: invData, error: invErr } = await window.sb.auth.admin?.inviteUserByEmail
        ? await window.sb.auth.admin.inviteUserByEmail(email)
        : { data: null, error: { message: "Usa o painel Supabase → Authentication → Invite user para convidar." } };

      if (invErr) throw new Error(invErr.message);

      msg.style.color = "#059669";
      msg.textContent = "Convite enviado. Associa as clínicas após o profissional aceitar.";
      setTimeout(close, 2000);
    } catch (e) {
      /* Supabase admin API não está disponível no frontend — instruir manualmente */
      msg.style.color = "#92400e";
      msg.innerHTML = `Para convidar: Supabase → Authentication → Users → <b>Invite user</b><br>Email: <b>${escapeHtml(email)}</b> · Função: <b>${roleLabel(role)}</b>`;
      btn.disabled = false;
      btn.textContent = "Enviar convite";
    }
  });
}


/* ==== GE — Secção Espaços ==== */

/* ---- GE.1 — renderSeccaoEspacos ---- */
function renderSeccaoEspacos(container, espacos, clinicaFiltro) {
  const TIPOS = { gabinete: "Gabinete", ginasio: "Ginásio", sala: "Sala", outro: "Outro" };
  const clinicasVisiveis = clinicaFiltro
    ? (G.clinics || []).filter(c => c.id === clinicaFiltro)
    : (G.clinics || []);

  let html = "";

  for (const clinica of clinicasVisiveis) {
    const lista = espacos.filter(e => e.clinic_id === clinica.id);
    html += `
<div class="gest-card" style="margin-bottom:12px;">
  <div class="gest-card-head">
    <span class="gest-card-title">${escapeHtml(clinica.name || clinica.slug)}</span>
    <span style="font-size:11px;color:#94a3b8;">${lista.length} espaço${lista.length !== 1 ? "s" : ""}</span>
  </div>
  ${lista.length ? lista.map(e => `
  <div class="gest-row">
    <div style="width:28px;height:28px;border-radius:6px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:14px;">
      ${e.tipo === "ginasio" ? "🏋️" : e.tipo === "sala" ? "🪑" : "🚪"}
    </div>
    <div style="flex:1;">
      <div style="font-size:13px;font-weight:600;color:#0f172a;">${escapeHtml(e.nome)}</div>
      <div style="font-size:11px;color:#94a3b8;">${TIPOS[e.tipo] || e.tipo || "—"}</div>
    </div>
    <button class="gest-btn-sm btn-editar-espaco" data-espaco-id="${escapeHtml(e.id)}" data-clinic-id="${escapeHtml(e.clinic_id)}">Editar</button>
  </div>`).join("") : `<div class="gest-empty">Sem espaços definidos.</div>`}
  <div class="gest-add-row btn-novo-espaco" data-clinic-id="${escapeHtml(clinica.id)}">＋ Adicionar espaço</div>
</div>`;
  }

  if (!html) html = `<div class="gest-empty">Selecciona uma clínica para ver os espaços.</div>`;
  container.innerHTML = html;

  container.querySelectorAll(".btn-editar-espaco").forEach(btn => {
    btn.addEventListener("click", () => openModalEspaco(btn.dataset.espacoId, btn.dataset.clinicId));
  });
  container.querySelectorAll(".btn-novo-espaco").forEach(btn => {
    btn.addEventListener("click", () => openModalEspaco(null, btn.dataset.clinicId));
  });
}

/* ---- GE.2 — openModalEspaco ---- */
async function openModalEspaco(espacoId, clinicId) {
  let espaco = null;
  if (espacoId) {
    const { data } = await window.sb.from("clinic_spaces").select("*").eq("id", espacoId).single();
    espaco = data;
  }
  const isEdit = !!espaco;
  const clinicaNome = G.clinicsById?.[clinicId]?.name || clinicId;

  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(15,45,82,0.35);z-index:2000;display:flex;align-items:center;justify-content:center;padding:16px;";

  overlay.innerHTML = `
<div style="background:#fff;border-radius:16px;width:100%;max-width:380px;display:flex;flex-direction:column;">
  <div style="padding:14px 20px;border-bottom:0.5px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">
    <div style="font-size:15px;font-weight:700;color:#0f172a;">${isEdit ? "Editar" : "Novo"} espaço · ${escapeHtml(clinicaNome)}</div>
    <button id="gEspClose" style="border:none;background:none;font-size:18px;cursor:pointer;color:#94a3b8;">✕</button>
  </div>
  <div style="padding:18px 20px;display:flex;flex-direction:column;gap:12px;">
    <div>
      <label style="display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:5px;">Nome <span style="color:#ef4444;">*</span></label>
      <input id="gEspNome" type="text" placeholder="ex: Gabinete 1, Ginásio, Sala de Fisio" value="${escapeHtml(espaco?.nome || "")}" style="width:100%;border:1px solid #D1D5DB;border-radius:8px;padding:8px 12px;font-size:13px;font-family:inherit;box-sizing:border-box;">
    </div>
    <div>
      <label style="display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:5px;">Tipo</label>
      <select id="gEspTipo" style="width:100%;border:1px solid #D1D5DB;border-radius:8px;padding:8px 12px;font-size:13px;font-family:inherit;box-sizing:border-box;">
        <option value="gabinete" ${espaco?.tipo === "gabinete" || !espaco ? "selected" : ""}>Gabinete</option>
        <option value="ginasio"  ${espaco?.tipo === "ginasio"  ? "selected" : ""}>Ginásio</option>
        <option value="sala"     ${espaco?.tipo === "sala"     ? "selected" : ""}>Sala</option>
        <option value="outro"    ${espaco?.tipo === "outro"    ? "selected" : ""}>Outro</option>
      </select>
    </div>
    <div id="gEspMsg" style="font-size:12px;color:#b00020;min-height:14px;"></div>
  </div>
  <div style="padding:14px 20px 18px;border-top:0.5px solid #e2e8f0;display:flex;gap:8px;">
    <button id="gEspSave" style="flex:1;background:#1a56db;color:#fff;border:none;border-radius:10px;padding:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">Guardar</button>
    ${isEdit ? `<button id="gEspDelete" style="padding:10px 14px;border:0.5px solid #fecaca;border-radius:10px;background:#fff;color:#b91c1c;font-size:13px;cursor:pointer;font-family:inherit;">Remover</button>` : ""}
    <button id="gEspCancel" style="padding:10px 16px;border:0.5px solid #e2e8f0;border-radius:10px;background:#fff;font-size:13px;cursor:pointer;font-family:inherit;">Cancelar</button>
  </div>
</div>`;

  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector("#gEspClose").addEventListener("click", close);
  overlay.querySelector("#gEspCancel").addEventListener("click", close);
  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });

  overlay.querySelector("#gEspSave").addEventListener("click", async () => {
    const btn  = overlay.querySelector("#gEspSave");
    const msg  = overlay.querySelector("#gEspMsg");
    const nome = overlay.querySelector("#gEspNome").value.trim();
    const tipo = overlay.querySelector("#gEspTipo").value;
    msg.textContent = "";
    if (!nome) { msg.textContent = "Nome obrigatório."; return; }
    btn.disabled = true; btn.textContent = "A guardar…";
    try {
      if (isEdit) {
        const { error } = await window.sb.from("clinic_spaces").update({ nome, tipo }).eq("id", espacoId);
        if (error) throw error;
      } else {
        const { error } = await window.sb.from("clinic_spaces").insert({ clinic_id: clinicId, nome, tipo, is_active: true });
        if (error) throw error;
      }
      close();
      renderGestao();
    } catch (e) {
      msg.textContent = e.message;
      btn.disabled = false; btn.textContent = "Guardar";
    }
  });

  overlay.querySelector("#gEspDelete")?.addEventListener("click", async () => {
    if (!confirm(`Remover "${espaco?.nome}"?`)) return;
    try {
      await window.sb.from("clinic_spaces").update({ is_active: false }).eq("id", espacoId);
      close();
      renderGestao();
    } catch (e) { alert("Erro: " + e.message); }
  });
}


/* ==== GF — Secção Preços ==== */

/* ---- GF.1 — renderSeccaoPrecos ---- */
function renderSeccaoPrecos(container, precos, procedureTypes, clinicaFiltro) {
  const clinicasVisiveis = clinicaFiltro
    ? (G.clinics || []).filter(c => c.id === clinicaFiltro)
    : (G.clinics || []);

  let html = "";

  for (const clinica of clinicasVisiveis) {
    const lista = precos.filter(p => p.clinic_id === clinica.id);
    html += `
<div class="gest-card" style="margin-bottom:12px;">
  <div class="gest-card-head">
    <span class="gest-card-title">${escapeHtml(clinica.name || clinica.slug)}</span>
    <span style="font-size:11px;color:#94a3b8;">${lista.length} procedimento${lista.length !== 1 ? "s" : ""}</span>
  </div>
  ${lista.length ? `
  <table style="width:100%;border-collapse:collapse;font-size:12px;">
    <thead>
      <tr style="background:#f8fafc;border-bottom:0.5px solid #e2e8f0;">
        <th style="padding:7px 16px;text-align:left;font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;">Procedimento</th>
        <th style="padding:7px 16px;text-align:right;font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;">Preço</th>
        <th style="padding:7px 16px;text-align:right;font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;">Duração</th>
        <th style="padding:7px 8px;width:40px;"></th>
      </tr>
    </thead>
    <tbody>
      ${lista.map(p => `
      <tr style="border-bottom:0.5px solid #f1f5f9;" class="gest-row-tr">
        <td style="padding:8px 16px;font-weight:500;color:#0f172a;">${escapeHtml(p.procedure_type)}</td>
        <td style="padding:8px 16px;text-align:right;color:#059669;font-weight:600;">${Number(p.price || 0).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}</td>
        <td style="padding:8px 16px;text-align:right;color:#94a3b8;">${p.duracao_min ? `${p.duracao_min} min` : "—"}</td>
        <td style="padding:8px 8px;text-align:right;">
          <button class="gest-btn-sm btn-editar-preco" data-preco-id="${escapeHtml(p.id)}" data-clinic-id="${escapeHtml(clinica.id)}" style="padding:4px 10px;font-size:11px;">Editar</button>
        </td>
      </tr>`).join("")}
    </tbody>
  </table>` : `<div class="gest-empty">Sem preços definidos.</div>`}
  <div class="gest-add-row btn-novo-preco" data-clinic-id="${escapeHtml(clinica.id)}">＋ Adicionar procedimento</div>
</div>`;
  }

  if (!html) html = `<div class="gest-empty">Selecciona uma clínica para ver os preços.</div>`;
  container.innerHTML = html;

  container.querySelectorAll(".btn-editar-preco").forEach(btn => {
    btn.addEventListener("click", () => openModalPreco(btn.dataset.precoId, btn.dataset.clinicId, procedureTypes));
  });
  container.querySelectorAll(".btn-novo-preco").forEach(btn => {
    btn.addEventListener("click", () => openModalPreco(null, btn.dataset.clinicId, procedureTypes));
  });
}

/* ---- GF.2 — openModalPreco ---- */
async function openModalPreco(precoId, clinicId, procedureTypes) {
  let preco = null;
  if (precoId) {
    const { data } = await window.sb.from("clinic_prices").select("*").eq("id", precoId).single();
    preco = data;
  }
  const isEdit = !!preco;
  const clinicaNome = G.clinicsById?.[clinicId]?.name || clinicId;

  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(15,45,82,0.35);z-index:2000;display:flex;align-items:center;justify-content:center;padding:16px;";

  overlay.innerHTML = `
<div style="background:#fff;border-radius:16px;width:100%;max-width:380px;display:flex;flex-direction:column;">
  <div style="padding:14px 20px;border-bottom:0.5px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">
    <div style="font-size:15px;font-weight:700;color:#0f172a;">${isEdit ? "Editar" : "Novo"} preço · ${escapeHtml(clinicaNome)}</div>
    <button id="gPrcClose" style="border:none;background:none;font-size:18px;cursor:pointer;color:#94a3b8;">✕</button>
  </div>
  <div style="padding:18px 20px;display:flex;flex-direction:column;gap:12px;">
    <div>
      <label style="display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:5px;">Procedimento <span style="color:#ef4444;">*</span></label>
      ${isEdit
        ? `<input type="text" value="${escapeHtml(preco.procedure_type)}" disabled style="width:100%;border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;font-size:13px;font-family:inherit;box-sizing:border-box;background:#f8fafc;color:#64748b;">`
        : `<select id="gPrcProc" style="width:100%;border:1px solid #D1D5DB;border-radius:8px;padding:8px 12px;font-size:13px;font-family:inherit;box-sizing:border-box;">
            <option value="">— Seleccionar —</option>
            ${(procedureTypes || []).map(pt => `<option value="${escapeHtml(pt.name)}">${escapeHtml(pt.name)}</option>`).join("")}
            <option value="__outro">Outro (escrever)</option>
          </select>
          <input id="gPrcProcOutro" type="text" placeholder="Nome do procedimento" style="display:none;width:100%;border:1px solid #D1D5DB;border-radius:8px;padding:8px 12px;font-size:13px;font-family:inherit;box-sizing:border-box;margin-top:6px;">`
      }
    </div>
    <div>
      <label style="display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:5px;">Preço (€) <span style="color:#ef4444;">*</span></label>
      <input id="gPrcPreco" type="number" min="0" step="0.01" value="${preco ? Number(preco.price || 0).toFixed(2) : ""}" placeholder="0.00" style="width:100%;border:1px solid #D1D5DB;border-radius:8px;padding:8px 12px;font-size:13px;font-family:inherit;box-sizing:border-box;">
    </div>
    <div>
      <label style="display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:5px;">Duração padrão (min)</label>
      <select id="gPrcDur" style="width:100%;border:1px solid #D1D5DB;border-radius:8px;padding:8px 12px;font-size:13px;font-family:inherit;box-sizing:border-box;">
        <option value="">— Sem duração padrão —</option>
        ${[15,20,30,45,60,90].map(d => `<option value="${d}" ${preco?.duracao_min === d ? "selected" : ""}>${d} min</option>`).join("")}
      </select>
    </div>
    <div id="gPrcMsg" style="font-size:12px;color:#b00020;min-height:14px;"></div>
  </div>
  <div style="padding:14px 20px 18px;border-top:0.5px solid #e2e8f0;display:flex;gap:8px;">
    <button id="gPrcSave" style="flex:1;background:#1a56db;color:#fff;border:none;border-radius:10px;padding:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">Guardar</button>
    ${isEdit ? `<button id="gPrcDelete" style="padding:10px 14px;border:0.5px solid #fecaca;border-radius:10px;background:#fff;color:#b91c1c;font-size:13px;cursor:pointer;font-family:inherit;">Remover</button>` : ""}
    <button id="gPrcCancel" style="padding:10px 16px;border:0.5px solid #e2e8f0;border-radius:10px;background:#fff;font-size:13px;cursor:pointer;font-family:inherit;">Cancelar</button>
  </div>
</div>`;

  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector("#gPrcClose").addEventListener("click", close);
  overlay.querySelector("#gPrcCancel").addEventListener("click", close);
  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });

  /* Mostrar campo "outro" */
  overlay.querySelector("#gPrcProc")?.addEventListener("change", (e) => {
    const outro = overlay.querySelector("#gPrcProcOutro");
    if (outro) outro.style.display = e.target.value === "__outro" ? "" : "none";
  });

  overlay.querySelector("#gPrcSave").addEventListener("click", async () => {
    const btn = overlay.querySelector("#gPrcSave");
    const msg = overlay.querySelector("#gPrcMsg");
    msg.textContent = "";

    const precoVal = parseFloat(overlay.querySelector("#gPrcPreco").value);
    const durVal   = overlay.querySelector("#gPrcDur").value;
    let procVal    = preco?.procedure_type || "";

    if (!isEdit) {
      const sel = overlay.querySelector("#gPrcProc")?.value;
      procVal = sel === "__outro"
        ? (overlay.querySelector("#gPrcProcOutro")?.value.trim() || "")
        : sel;
    }

    if (!procVal) { msg.textContent = "Selecciona o procedimento."; return; }
    if (isNaN(precoVal)) { msg.textContent = "Preço inválido."; return; }

    btn.disabled = true; btn.textContent = "A guardar…";
    try {
      const payload = {
        procedure_type: procVal,
        price:          precoVal,
        duracao_min:    durVal ? parseInt(durVal, 10) : null,
        clinic_id:      clinicId,
      };
      if (isEdit) {
        const { error } = await window.sb.from("clinic_prices").update(payload).eq("id", precoId);
        if (error) throw error;
      } else {
        const { error } = await window.sb.from("clinic_prices").insert(payload);
        if (error) throw error;
      }
      close();
      renderGestao();
    } catch (e) {
      msg.textContent = e.message;
      btn.disabled = false; btn.textContent = "Guardar";
    }
  });

  overlay.querySelector("#gPrcDelete")?.addEventListener("click", async () => {
    if (!confirm(`Remover "${preco?.procedure_type}"?`)) return;
    try {
      await window.sb.from("clinic_prices").delete().eq("id", precoId);
      close();
      renderGestao();
    } catch (e) { alert("Erro: " + e.message); }
  });
}


/* ==== GG — Boot ==== */

/* ---- GG.1 — initGestao ---- */
export function initGestao() {
  window.__gc_renderGestao = renderGestao;
}

initGestao();
