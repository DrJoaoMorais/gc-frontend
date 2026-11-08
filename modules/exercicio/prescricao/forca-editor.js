import { cadenciaForca, tempoForca } from './forca-blocos.js?v=2026-11-08-modelos-ajustes';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const duration = seconds => Math.floor(seconds / 60) + ' min ' + Math.round(seconds % 60) + ' s';
const numberInput = (value, attr, label, minimum = 0, step = '0.5', disabled = false) =>
  '<label class="gcwo-field"><span>' + esc(label) + '</span><input type="number" min="' + minimum + '" step="' + step + '" ' + attr + ' value="' + esc(value ?? '') + '" ' + (disabled ? 'disabled' : '') + '></label>';

function selector(value, attr, values, label) {
  return '<div class="gcwo-strength-selector"><span>' + label + '</span><div class="gcwo-chips">' +
    values.map(n => '<button type="button" class="gcwo-chip' + (n === value ? ' on' : '') + '" ' + attr + ' data-value="' + n + '" aria-pressed="' + (n === value) + '">' + n + '</button>').join('') +
    '<input type="number" min="' + (label === 'Voltas' ? 1 : 0) + '" ' + attr.replace('data-preset', 'data-config') + ' value="' + esc(value ?? '') + '" aria-label="' + label + '"></div></div>';
}

function quickValue(value, attr, presets, label, unit = '', extraClass = '') {
  return '<div class="gcwo-strength-quick' + (unit ? ' gcwo-strength-quick-rest' : '') + (extraClass ? ' ' + extraClass : '') + '"><div class="gcwo-chips">' + presets.map(n =>
    '<button type="button" class="gcwo-chip' + (value === n ? ' on' : '') + '" data-quick-value="' + n + '" aria-pressed="' + (value === n) + '" aria-label="' + esc(label + ': ' + n + unit) + '">' + n + unit + '</button>').join('') +
    '</div><input ' + attr + ' value="' + esc(value ?? '') + '" aria-label="' + esc(label + ' — valor personalizado') + '"></div>';
}
function restInput(value, field, label) {
  return '<div class="gcwo-strength-selector"><span>' + esc(label) + '</span>' + quickValue(value, 'type="number" min="0" step="0.5" data-field="' + field + '"', [30,45,60], label, ' s') + '</div>';
}
function machineInput(item, key, label, placeholder) {
  return '<label class="gcwo-field"><span>' + label + '</span><input type="text" maxlength="250" data-field="' + key + '" value="' + esc(item[key] || '') + '" placeholder="' + placeholder + '"></label>';
}

function itemHTML(item, index, block, blockIndex, blocks) {
  const last = index === block.items.length - 1;
  const doseLabel = item.dose_unit === 'time' ? 'Segundos' : 'Repetições';
  const rest = !last ? restInput(item.rest_next, 'rest_next', 'Descanso entre exercícios (s)')
    : blockIndex < blocks.length - 1 ? restInput(item.rest_next, 'rest_next', 'Descanso antes do próximo bloco (s)')
    : '<p class="gcwo-muted">' + (block.type === 'circuit' ? 'No fim da volta aplica-se o descanso entre voltas do bloco.' : 'Último exercício: sem descanso final.') + '</p>';
  const seconds = cadenciaForca(item);
  return '<article class="gcwo-strength-item" data-strength-item="' + esc(item.item_id) + '">' +
    '<div class="gcwo-strength-identity"><b class="gcwo-strength-order">' + (index + 1) + '</b>' +
    (item.photo_url ? '<button type="button" class="gcwo-strength-image" data-zoom><img src="' + esc(item.photo_url) + '" alt="' + esc(item.name || 'Exercício') + '"></button>' : '<div class="gcwo-strength-no-image">Sem imagem</div>') +
    '<strong>' + esc(item.name) + '</strong></div><div class="gcwo-strength-prescription"><div class="gcwo-strength-item-head"><div class="gcwo-chips gcwo-strength-mode">' +
    [['reps','Repetições'],['time','Segundos']].map(([mode,label]) => '<button type="button" class="gcwo-chip' + (item.dose_unit === mode ? ' on' : '') + '" data-dose-unit="' + mode + '">' + label + '</button>').join('') +
    '</div><div class="gcwo-strength-series-toolbar"><strong>Prescrição por série</strong><button type="button" class="gcBtnGhost gcBtnSm" data-add-set>+ Série</button></div><div class="gcwo-strength-item-actions"><button type="button" class="gcBtnGhost gcBtnSm" data-move="-1" ' + (index === 0 ? 'disabled' : '') + ' aria-label="Subir exercício">↑</button><button type="button" class="gcBtnGhost gcBtnSm" data-move="1" ' + (last ? 'disabled' : '') + ' aria-label="Descer exercício">↓</button><button type="button" class="gcBtnGhost gcBtnSm" data-remove-item aria-label="Remover exercício">×</button></div></div>' +
    '<div class="gcwo-strength-series"><div class="gcwo-strength-series-row gcwo-strength-series-head"><span>Série</span><span>' + doseLabel + '</span><span>Carga (kg)</span><span>Descanso entre séries</span><span aria-hidden="true"></span></div>' +
    item.strength_series.map((set,i) => {
      const value = set.value ?? (set.reps_min != null ? set.reps_min + '–' + set.reps_max : '');
      const attr = (item.dose_unit === 'time' ? 'type="number" min="0.5" step="0.5"' : 'type="text" inputmode="numeric" placeholder="N.º / intervalo"') + ' data-set="' + i + '" data-set-field="value"';
      const dose = item.dose_unit === 'reps' ? quickValue(value, attr, [8,10,12,15], doseLabel + ' da série ' + (i+1)) : quickValue(value, attr, [20,30,45,60], doseLabel + ' da série ' + (i+1), ' s', 'gcwo-strength-quick-time');
      const restSet = i < item.strength_series.length - 1 ? quickValue(Object.hasOwn(set, 'rest_after_s') ? set.rest_after_s : item.rest_set, 'type="number" min="0" step="0.5" data-set="' + i + '" data-set-field="rest_after_s"', [30,45,60], 'Descanso após a série ' + (i+1), ' s') : '<span class="gcwo-strength-no-rest" aria-label="Sem descanso entre séries após a última série">—</span>';
      return '<div class="gcwo-strength-series-row"><b class="gcwo-strength-set-number">' + (i+1) + '</b>' + dose +
        '<label class="gcwo-strength-load"><span>Carga (kg)</span><input type="number" min="0" step="0.5" data-set="' + i + '" data-set-field="load" value="' + esc(set.load ?? '') + '" aria-label="Carga da série ' + (i+1) + '"></label>' + restSet +
        '<button type="button" class="gcBtnGhost gcBtnSm" data-delete-set="' + i + '" ' + (item.strength_series.length === 1 ? 'disabled' : '') + ' aria-label="Remover série ' + (i+1) + '">×</button></div>';
    }).join('') +
    '</div><div class="gcwo-strength-rests">' + rest + '</div>' +
    '<details class="gcwo-strength-details" data-details><summary>Instruções, cadência e ajustes da máquina' + (item.dose_unit === 'reps' ? seconds == null ? ' · tempo por definir' : ' · ' + seconds + ' s por repetição' : '') + '</summary><label class="gcwo-field"><span>Instrução para o doente</span><input data-field="prescription_note" value="' + esc(item.prescription_note || '') + '"></label>' +
    '<div class="gcwo-row2">' + numberInput(item.tempo_concentrico_s, 'data-field="tempo_concentrico_s"', 'Concêntrico (s)') + numberInput(item.tempo_excentrico_s, 'data-field="tempo_excentrico_s"', 'Excêntrico (s)') +
    numberInput(item.pausa_superior_s, 'data-field="pausa_superior_s"', 'Pausa superior (s)') + numberInput(item.pausa_inferior_s, 'data-field="pausa_inferior_s"', 'Pausa inferior (s)') + '</div>' +
    (item.dose_unit === 'reps' && seconds == null ? '<p class="gcwo-muted">Sem cadência definida, o doente conclui as repetições manualmente. O tempo de execução fica por calcular.</p>' : '') + '<fieldset class="gcwo-strength-machine"><legend>Ajustes da máquina · opcional</legend><div>' + machineInput(item, 'machine_position', 'Posição da máquina', 'N.º / referência') + machineInput(item, 'machine_seat_height', 'Altura do banco', 'N.º / altura') + machineInput(item, 'machine_other', 'Outras regulações', 'Encosto, apoios, amplitude…') + '</div><p class="gcwo-muted">Preencher apenas quando aplicável. Os ajustes ficam associados à prescrição do doente.</p></fieldset></details></div></article>';
}

export function renderItemsForca(block, blockIndex, blocks) {
  return block.items.map((item,index)=>itemHTML(item,index,block,blockIndex,blocks)).join('');
}
export function renderBlocosForca(blocks, target) {
  return blocks.map((block, index) => {
    if (block.type === 'legacy') return '<section class="gcwo-strength-block" data-strength-block="' + esc(block.block_id) + '"><h4>' + esc(block.name) + '</h4><p class="gcwo-muted">Sequência guardada preservada.</p><details><summary>Ver sequência</summary>' + (block.original.intervals || []).map(i=>'<p>' + esc(i.label || i.type) + ' · ' + duration(i.duration_sec || 0) + '</p>').join('') + '</details><button type="button" class="gcBtnGhost" data-delete-block>Remover bloco</button></section>';
    const timing = tempoForca([block]);
    return '<section class="gcwo-strength-block' + (block.block_id === target ? ' selected' : '') + '" data-strength-block="' + esc(block.block_id) + '">' +
      '<div class="gcwo-strength-block-head"><span class="gcwo-exercicio-order">' + String.fromCharCode(65+index) + '</span><input data-block-name value="' + esc(block.name) + '" aria-label="Nome do bloco">' +
      '<div class="gcwo-chips gcwo-strength-mode">' + [['series','Por séries'],['circuit','Em circuito']].map(([type,label])=>'<button type="button" class="gcwo-chip' + (block.type === type ? ' on' : '') + '" data-block-type="' + type + '">' + label + '</button>').join('') +
      '</div><button type="button" class="gcBtnGhost gcBtnSm" data-delete-block aria-label="Remover bloco">×</button></div>' +
      '<p class="gcwo-muted">' + (block.type === 'circuit' ? 'Percorrer a lista e repetir por voltas.' : 'Completar as séries de cada exercício antes de avançar.') + '</p>' +
      (block.type === 'circuit' ? '<div class="gcwo-strength-settings">' + selector(block.rounds,'data-preset="rounds"',[1,3,5],'Voltas') + selector(block.rest_between_rounds_s,'data-preset="rest_between_rounds_s"',[20,30,45],'Entre voltas (s)') + '</div>' : '') +
      '<div data-block-catalog></div><div data-block-items>' + renderItemsForca(block,index,blocks) + '</div>' +
      '<p class="gcwo-muted" data-block-empty ' + (block.items.length?'hidden':'') + '>Este bloco ainda não tem exercícios.</p>' +
      '<div class="gcwo-strength-block-foot"><button type="button" class="gcBtnGhost" data-target-block aria-expanded="false" aria-controls="gcwoStrengthCatalog">Adicionar exercícios</button><span data-strength-block-time>' + (timing.incomplete ? 'Tempo parcialmente por calcular' : duration(timing.seconds)) + '</span></div></section>';
  }).join('');
}

export function wireBlocosForca(root, blocks, options, onlyBlockId = null) {
  root.querySelectorAll('[data-strength-block]').forEach(card => {
    if(onlyBlockId&&card.dataset.strengthBlock!==onlyBlockId)return;
    const block = blocks.find(b=>b.block_id === card.dataset.strengthBlock);
    card.querySelector('[data-delete-block]').onclick = () => { blocks.splice(blocks.indexOf(block),1); options.render(); };
    if (block.type === 'legacy') return;
    card.querySelector('[data-block-name]').oninput = event => { block.name = event.target.value; options.change(); };
    card.querySelectorAll('[data-block-type]').forEach(button => button.onclick = () => { block.type = button.dataset.blockType; options.render(); });
    card.querySelectorAll('[data-target-block]').forEach(button=>button.onclick = () => options.target(block.block_id));
    card.querySelectorAll('[data-preset]').forEach(button => button.onclick = () => { block[button.dataset.preset] = Number(button.dataset.value); options.render(); });
    card.querySelectorAll('[data-config]').forEach(input => input.oninput = () => {
      const key = input.dataset.config;
      block[key] = input.value === '' ? null : Number(input.value);
      card.querySelectorAll('[data-preset="' + key + '"]').forEach(button=>button.classList.toggle('on',Number(button.dataset.value) === block[key]));
      options.change();
    });
    card.querySelectorAll('[data-strength-item]').forEach(row => {
      const item = block.items.find(i=>i.item_id === row.dataset.strengthItem);
      row.querySelector('[data-zoom]')?.addEventListener('click',()=>options.zoom(item));
      const details = row.querySelector('[data-details]');
      if (options.openDetails.has(item.item_id)) details.open = true;
      details.addEventListener('toggle',()=>{ details.open ? options.openDetails.add(item.item_id) : options.openDetails.delete(item.item_id); });
      row.querySelector('[data-remove-item]').onclick = () => { block.items.splice(block.items.indexOf(item),1); options.render(); };
      row.querySelectorAll('[data-move]').forEach(button=>button.onclick=()=>{
        const from=block.items.indexOf(item),to=from+Number(button.dataset.move);
        if(to<0||to>=block.items.length)return;
        [block.items[from],block.items[to]]=[block.items[to],block.items[from]];options.render();
      });
      row.querySelectorAll('[data-dose-unit]').forEach(button=>button.onclick=()=>{
        item.dose_unit=button.dataset.doseUnit;
        item.strength_series.forEach(set=>{set.value=null;delete set.reps_min;delete set.reps_max;});
        options.render();
      });
      row.querySelector('[data-add-set]').onclick=()=>{
        item.strength_series.push(copySet(item.strength_series.at(-1)));
        options.render();
      };
      row.querySelectorAll('[data-delete-set]').forEach(button=>button.onclick=()=>{
        if(item.strength_series.length>1)item.strength_series.splice(Number(button.dataset.deleteSet),1);
        options.render();
      });
      row.querySelectorAll('[data-set]').forEach(input=>input.oninput=()=>{
        const set=item.strength_series[Number(input.dataset.set)],key=input.dataset.setField;
        if(key==='value'&&item.dose_unit==='reps'){
          const range=input.value.trim().match(/^(\d+)\s*[-–]\s*(\d+)$/);
          set.value=range?null:input.value.trim()===''?null:Number(input.value);
          set.reps_min=range?Number(range[1]):null;set.reps_max=range?Number(range[2]):null;
        }else set[key]=input.value===''?null:Number(input.value);
        syncQuick(input);
        options.change();
      });
      row.querySelectorAll('[data-field]').forEach(input=>input.oninput=()=>{
        const key=input.dataset.field;
        item[key]=['prescription_note','machine_position','machine_seat_height','machine_other'].includes(key)?input.value:input.value===''?null:Number(input.value);
        syncQuick(input);
        options.change();
      });
      row.querySelectorAll('[data-quick-value]').forEach(button=>button.onclick=()=>{
        const input=button.closest('.gcwo-strength-quick').querySelector('input');
        input.value=button.dataset.quickValue;input.oninput();
      });
    });
  });
}
function copySet(set) { return structuredClone(set); }

function syncQuick(input) {
  input.closest('.gcwo-strength-quick')?.querySelectorAll('[data-quick-value]').forEach(button=>{
    const selected=input.value.trim()!=='' && Number(input.value)===Number(button.dataset.quickValue);
    button.classList.toggle('on',selected);button.setAttribute('aria-pressed',String(selected));
  });
}

