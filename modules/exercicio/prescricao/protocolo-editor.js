import { requireExerciseAccess } from '../permissoes.js';
import { normalizarRecomendacoes } from './recomendacoes.js?v=2026-10-27-2';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LISTAS = { permitido:'Permitido', contraindicacoes:'Evitar', hep:'Programa domiciliário', clinica:'Trabalho na clínica' };
const OBJETOS = { objetivos:['Objetivos','label'], criterios_progressao:['Critérios para avançar','texto'], objetivos_serie:['Critérios detalhados','texto'] };
const DOSES = { sets:'Séries', reps_fixed:'Repetições fixas', reps_min:'Repetições mínimas', reps_max:'Repetições máximas', duration_sec:'Duração (segundos)', rest_set:'Repouso entre séries (segundos)', rest_next:'Repouso entre exercícios (segundos)', load:'Carga' };

// Constrói uma nova fase sem eliminar campos clínicos que o formulário não edita.
export function construirFaseEditada(fase, form) {
  const data = structuredClone(fase.data || {});
  for (const key of ['nota_ancora','principio_clinico']) {
    const value = form.get(key);
    if (value !== null) data[key] = String(value).trim();
  }
  for (const key of Object.keys(LISTAS)) {
    data[key] = String(form.get(key) || '').split('\n').map(x => x.trim()).filter(Boolean);
  }
  for (const [key, [, prop]] of Object.entries(OBJETOS)) {
    const old = data[key] || [];
    data[key] = form.getAll(key).map((value, i) => {
      const item = { ...(old[i] || {}), [prop]:String(value).trim() };
      if (!item[prop]) return item;
      if (!item.id) item.id = crypto.randomUUID();
      if (key === 'objetivos_serie') {
        if (!old[i]) { item.tipo = 'qualitativo'; item.escala = 'binario'; }
        if (form.has(`criterio_valor_${i}`)) {
          const raw = form.get(`criterio_valor_${i}`);
          if (raw === '' || !Number.isFinite(Number(raw))) throw new Error('Indique um valor válido para o critério mensurável.');
          item.valor = Number(raw); item.op = form.get(`criterio_op_${i}`);
        }
        if (form.has(`criterio_nota_${i}`)) item.nota = String(form.get(`criterio_nota_${i}`)).trim();
      }
      return item;
    }).filter(x => x[prop]);
  }
  if (form.has('recomendacoes_presentes')) {
    const titulos = form.getAll('recomendacao_titulo');
    data.recomendacoes = normalizarRecomendacoes(form.getAll('recomendacao_texto').map((text,i) => ({ title:titulos[i], text })));
  }
  const number = key => form.get(key) === '' ? null : Number(form.get(key));
  const from = number('anchor_from'), to = number('anchor_to');
  if ((from !== null && (!Number.isInteger(from) || from < 0)) || (to !== null && (!Number.isInteger(to) || to < 0)) || (from !== null && to !== null && to <= from)) throw new Error('O fim do período deve ser posterior ao início.');
  const name = String(form.get('name') || '').trim();
  if (!name) throw new Error('Indique o nome da fase.');
  return { name, anchor_kind:form.get('anchor_kind'), anchor_from:from, anchor_to:to, data };
}

export async function abrirEditorProtocolo({ protocolo, fase, exercicios, catalogo, onSaved }) {
  requireExerciseAccess();
  if (!fase) return;
  const overlay = document.createElement('div');
  overlay.className = 'gcwo-modal-overlay';
  const text = (name,label,value) => `<label class="gcwo-field"><span class="gcwo-field-label">${esc(label)}</span><textarea name="${esc(name)}" rows="3">${esc(value)}</textarea></label>`;
  const recommendationFields = item => text('recomendacao_titulo','Título da recomendação',item.title) + text('recomendacao_texto','Orientação para o doente (deixar vazia para remover)',item.text);
  const rows = exercicios.map(x => structuredClone(x));
  const data = fase.data || {};
  overlay.innerHTML = `<div class="gcwo-modal gcwo-protocol-editor" role="dialog" aria-modal="true" aria-labelledby="gcProtocolEditTitle">
    <form><div class="gcwo-modal-head"><h3 id="gcProtocolEditTitle">Edição do protocolo-base</h3><button type="button" data-close aria-label="Fechar">×</button></div>
    <div class="gcwo-modal-body">
    <p><strong>${esc(protocolo.name)}</strong> — ${esc(fase.name)}</p>
    <p>Guardar cria uma nova versão para futuras prescrições. Os protocolos associados a consultas e os planos já prescritos mantêm-se.</p>
    <label class="gcwo-field"><span class="gcwo-field-label">Nome da fase</span><input name="name" required value="${esc(fase.name)}"></label>
    <label class="gcwo-field"><span class="gcwo-field-label">Progressão</span><select name="anchor_kind"><option value="evolucao_clinica" ${fase.anchor_kind === 'evolucao_clinica' ? 'selected':''}>Por evolução clínica</option><option value="semana_pos_cirurgia" ${fase.anchor_kind === 'semana_pos_cirurgia' ? 'selected':''}>Semanas após cirurgia</option></select></label>
    <div class="gcwo-protocol-period"><label>Início (semana)<input name="anchor_from" type="number" min="0" step="1" value="${esc(fase.anchor_from)}"></label><label>Fim (semana, exclusivo)<input name="anchor_to" type="number" min="0" step="1" value="${esc(fase.anchor_to)}"></label></div>
    ${text('nota_ancora','Nota sobre o período',data.nota_ancora)}${text('principio_clinico','Princípio clínico',data.principio_clinico)}
    ${Object.entries(LISTAS).map(([key,label]) => text(key,`${label} (um item por linha)`,(data[key] || []).join('\n'))).join('')}
    ${Object.entries(OBJETOS).map(([key,[label,prop]]) => `<fieldset><legend>${esc(label)}</legend>${[...(data[key] || []),{}].map((item,i) => text(key,label,item[prop]) + (key === 'objetivos_serie' && item[prop] ? `
      ${item.tipo === 'mensuravel' ? `<p>Critério mensurável · ${esc(item.unidade)}</p><label>Comparação<select name="criterio_op_${i}">${['<','<=','=','>=','>'].map(op => `<option value="${esc(op)}" ${item.op === op ? 'selected':''}>${esc(op)}</option>`).join('')}</select></label><label>Valor (${esc(item.unidade)})<input name="criterio_valor_${i}" type="number" step="any" required value="${esc(item.valor)}"></label>` : ''}
      ${text(`criterio_nota_${i}`,'Nota do critério',item.nota)}` : '')).join('')}<button type="button" data-add-field="${key}">+ Acrescentar item</button></fieldset>`).join('')}
    <fieldset><legend>Recomendações antes dos exercícios</legend><input type="hidden" name="recomendacoes_presentes" value="1">
    <p>Estas orientações acompanham as novas sessões criadas a partir do protocolo. Não alteram os planos já prescritos.</p>
    ${normalizarRecomendacoes(data.recomendacoes).map(recommendationFields).join('')}
    <button type="button" data-add-recommendation>+ Adicionar recomendação</button></fieldset>
    <h4>Exercícios desta fase</h4><div data-exercises></div>
    <label class="gcwo-field"><span class="gcwo-field-label">Adicionar exercício</span><input type="search" data-search placeholder="Pesquisar no catálogo"><select data-catalog aria-label="Exercício do catálogo"></select></label><button type="button" data-add-exercise>+ Adicionar exercício à fase</button>
    <p role="alert" data-error></p>
    </div><div class="gcwo-modal-foot"><button type="button" data-close>Cancelar</button><button type="submit" class="gcBtnSuccess">Guardar nova versão</button></div></form></div>`;
  document.body.append(overlay);
  const form = overlay.querySelector('form');
  let dirty = false, saving = false;
  const previousFocus = document.activeElement;
  const unload = e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
  const close = () => {
    if (saving || (dirty && !window.confirm('Descartar as alterações ainda não guardadas?'))) return;
    window.removeEventListener('beforeunload',unload);
    overlay.remove(); previousFocus?.focus();
  };
  window.addEventListener('beforeunload',unload);
  form.addEventListener('input',() => { dirty = true; });
  form.addEventListener('change',() => { dirty = true; });
  overlay.querySelectorAll('[data-close]').forEach(button => button.onclick = close);
  overlay.addEventListener('keydown',e => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    if (e.key !== 'Tab') return;
    const controls = [...overlay.querySelectorAll('button,input,select,textarea')].filter(x => !x.disabled);
    if (e.shiftKey && document.activeElement === controls[0]) { e.preventDefault(); controls.at(-1).focus(); }
    else if (!e.shiftKey && document.activeElement === controls.at(-1)) { e.preventDefault(); controls[0].focus(); }
  });
  const renderCatalog = () => {
    const search = overlay.querySelector('[data-search]').value.toLocaleLowerCase('pt');
    overlay.querySelector('[data-catalog]').innerHTML = catalogo.filter(e => !rows.some(r => r.exercise_id === e.id) && e.name.toLocaleLowerCase('pt').includes(search)).map(e => `<option value="${esc(e.id)}">${esc(e.name)}</option>`).join('');
  };
  const renderRows = () => {
    overlay.querySelector('[data-exercises]').innerHTML = rows.map((row,i) => `<fieldset data-row="${i}"><legend>${esc(catalogo.find(e => e.id === row.exercise_id)?.name || 'Exercício associado')}</legend>
      <label>Local<select data-key="context">${['Casa','Clínica','Ginásio','indiferente'].map(c => `<option ${row.context === c ? 'selected':''}>${esc(c)}</option>`).join('')}</select></label>
      <label><input type="checkbox" data-key="is_optional" ${row.is_optional ? 'checked':''}> Opcional</label>
      <label class="gcwo-field">Nota clínica<textarea data-key="clinical_note">${esc(row.clinical_note)}</textarea></label>
      ${Object.entries(DOSES).map(([key,label]) => `<label>${label}<input type="number" min="0" step="any" data-dose="${key}" value="${esc(row.prescription_defaults?.[key])}"></label>`).join('')}
      <button type="button" data-remove="${i}">Remover da fase</button></fieldset>`).join('');
    overlay.querySelectorAll('[data-row]').forEach(field => field.addEventListener('input',e => {
      const row = rows[Number(field.dataset.row)], input = e.target;
      if (input.dataset.key) row[input.dataset.key] = input.type === 'checkbox' ? input.checked : input.value;
      if (input.dataset.dose) {
        row.prescription_defaults ||= {};
        if (input.value === '') delete row.prescription_defaults[input.dataset.dose];
        else row.prescription_defaults[input.dataset.dose] = Number(input.value);
      }
    }));
    overlay.querySelectorAll('[data-remove]').forEach(button => button.onclick = () => { rows.splice(Number(button.dataset.remove),1); dirty = true; renderRows(); renderCatalog(); });
  };
  renderRows(); renderCatalog();
  overlay.querySelector('[data-add-recommendation]').onclick = event => {
    event.currentTarget.insertAdjacentHTML('beforebegin', recommendationFields({}));
    dirty = true;
    event.currentTarget.previousElementSibling.querySelector('textarea').focus();
  };
  overlay.querySelector('[data-search]').oninput = renderCatalog;
  overlay.querySelector('[data-add-exercise]').onclick = () => {
    const id = overlay.querySelector('[data-catalog]').value;
    if (!id) return;
    rows.push({ exercise_id:id, context:'indiferente', is_optional:false, prescription_defaults:{}, clinical_note:null });
    dirty = true; renderRows(); renderCatalog();
  };
  overlay.querySelectorAll('[data-add-field]').forEach(button => button.onclick = () => {
    const key = button.dataset.addField;
    button.insertAdjacentHTML('beforebegin',text(key,OBJETOS[key][0],''));
    button.previousElementSibling.querySelector('textarea').focus();
  });
  form.onsubmit = async e => {
    e.preventDefault();
    if (saving) return;
    const errorHost = overlay.querySelector('[data-error]');
    try {
      requireExerciseAccess();
      const patch = construirFaseEditada(fase,new FormData(form));
      saving = true;
      overlay.querySelectorAll('button,input,select,textarea').forEach(b => { b.disabled = true; });
      errorHost.textContent = 'A guardar nova versão…';
      const { data:id, error } = await window.sb.rpc('gc_save_protocol_version', {
        p_protocol_id:protocolo.id, p_phase_id:fase.id, p_phase:patch,
        p_exercises:rows.map((r,i) => ({ exercise_id:r.exercise_id,sort_order:i,context:r.context,is_optional:r.is_optional,prescription_defaults:r.prescription_defaults,clinical_note:r.clinical_note }))
      });
      if (error) throw error;
      if (!id) throw new Error('A gravação não foi confirmada.');
      dirty = false; saving = false; close();
      await onSaved(id);
    } catch (error) {
      saving = false;
      overlay.querySelectorAll('button,input,select,textarea').forEach(b => { b.disabled = false; });
      errorHost.textContent = error.code === 'PGRST202' ? 'A edição ainda não foi ativada no servidor. As alterações não foram guardadas.' : (error.message || 'Não foi possível guardar. As alterações continuam no formulário.');
    }
  };
  form.querySelector('input').focus();
}
