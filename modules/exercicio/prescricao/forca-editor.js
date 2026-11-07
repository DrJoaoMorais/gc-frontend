import { cadenciaForca, tempoForca } from './forca-blocos.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const duration = seconds => Math.floor(seconds / 60) + ' min ' + Math.round(seconds % 60) + ' s';
const numberInput = (value, attr, label, minimum = 0, step = '0.5', disabled = false) =>
  '<label class="gcwo-field"><span>' + esc(label) + '</span><input type="number" min="' + minimum + '" step="' + step + '" ' + attr + ' value="' + esc(value ?? '') + '" ' + (disabled ? 'disabled' : '') + '></label>';

function selector(value, attr, values, label) {
  return '<div class="gcwo-strength-selector"><span>' + label + '</span><div class="gcwo-chips">' +
    values.map(n => '<button type="button" class="gcwo-chip' + (n === value ? ' on' : '') + '" ' + attr + ' data-value="' + n + '" aria-pressed="' + (n === value) + '">' + n + '</button>').join('') +
    '<input type="number" min="' + (label === 'Voltas' ? 1 : 0) + '" ' + attr.replace('data-preset', 'data-config') + ' value="' + esc(value ?? '') + '" aria-label="' + label + '"></div></div>';
}

function itemHTML(item, index, block, blockIndex, blocks) {
  const last = index === block.items.length - 1;
  const doseLabel = item.dose_unit === 'time' ? 'Segundos' : 'Repetições';
  const rest = !last ? numberInput(item.rest_next, 'data-field="rest_next"', 'Descanso entre exercícios (s)')
    : blockIndex < blocks.length - 1 ? numberInput(item.rest_next, 'data-field="rest_next"', 'Descanso antes do próximo bloco (s)')
    : '<p class="gcwo-muted">' + (block.type === 'circuit' ? 'No fim da volta aplica-se o descanso entre voltas do bloco.' : 'Último exercício: sem descanso final.') + '</p>';
  const seconds = cadenciaForca(item);
  return '<article class="gcwo-strength-item" data-strength-item="' + esc(item.item_id) + '">' +
    '<div class="gcwo-strength-item-head"><b>' + (index + 1) + '</b>' +
    (item.photo_url ? '<button type="button" class="gcwo-strength-image" data-zoom><img src="' + esc(item.photo_url) + '" alt="Ampliar imagem"></button>' : '') +
    '<strong>' + esc(item.name) + '</strong><div class="gcwo-chips">' +
    [['reps','Repetições'],['time','Segundos']].map(([mode,label]) => '<button type="button" class="gcwo-chip' + (item.dose_unit === mode ? ' on' : '') + '" data-dose-unit="' + mode + '">' + label + '</button>').join('') +
    '</div><button type="button" class="gcBtnGhost gcBtnSm" data-move="-1" ' + (index === 0 ? 'disabled' : '') + ' aria-label="Subir exercício">↑</button><button type="button" class="gcBtnGhost gcBtnSm" data-move="1" ' + (last ? 'disabled' : '') + ' aria-label="Descer exercício">↓</button><button type="button" class="gcBtnGhost gcBtnSm" data-remove-item aria-label="Remover exercício">×</button></div>' +
    '<div class="gcwo-strength-series"><div class="gcwo-strength-series-row gcwo-strength-series-head"><span>Série</span><span>' + doseLabel + '</span><span>Carga (kg)</span><button type="button" class="gcBtnGhost gcBtnSm" data-add-set>+ Série</button></div>' +
    item.strength_series.map((set,i) => '<div class="gcwo-strength-series-row"><b>' + (i+1) + '</b><input ' +
      (item.dose_unit === 'time' ? 'type="number" min="0.5" step="0.5"' : 'type="text" inputmode="numeric" placeholder="10 ou 8–12"') +
      ' data-set="' + i + '" data-set-field="value" value="' + esc(set.value ?? (set.reps_min != null ? set.reps_min + '–' + set.reps_max : '')) + '" aria-label="' + doseLabel + ' da série ' + (i+1) + '">' +
      '<input type="number" min="0" step="0.5" data-set="' + i + '" data-set-field="load" value="' + esc(set.load ?? '') + '" aria-label="Carga da série ' + (i+1) + '">' +
      '<button type="button" class="gcBtnGhost gcBtnSm" data-delete-set="' + i + '" ' + (item.strength_series.length === 1 ? 'disabled' : '') + ' aria-label="Remover série ' + (i+1) + '">×</button></div>').join('') +
    '</div><div class="gcwo-strength-rests">' + numberInput(item.rest_set, 'data-field="rest_set"', 'Descanso entre séries (s)', 0, '0.5', item.strength_series.length === 1) + rest + '</div>' +
    '<details class="gcwo-strength-details" data-details><summary>Instruções e cadência' + (item.dose_unit === 'reps' ? seconds == null ? ' · tempo por definir' : ' · ' + seconds + ' s por repetição' : '') + '</summary><label class="gcwo-field"><span>Instrução para o doente</span><input data-field="prescription_note" value="' + esc(item.prescription_note || '') + '"></label>' +
    '<div class="gcwo-row2">' + numberInput(item.tempo_concentrico_s, 'data-field="tempo_concentrico_s"', 'Concêntrico (s)') + numberInput(item.tempo_excentrico_s, 'data-field="tempo_excentrico_s"', 'Excêntrico (s)') +
    numberInput(item.pausa_superior_s, 'data-field="pausa_superior_s"', 'Pausa superior (s)') + numberInput(item.pausa_inferior_s, 'data-field="pausa_inferior_s"', 'Pausa inferior (s)') + '</div>' +
    (item.dose_unit === 'reps' && seconds == null ? '<p class="gcwo-muted">Sem cadência definida, o doente conclui as repetições manualmente. O tempo de execução fica por calcular.</p>' : '') + '</details></article>';
}

export function renderBlocosForca(blocks, target) {
  return blocks.map((block, index) => {
    if (block.type === 'legacy') return '<section class="gcwo-strength-block" data-strength-block="' + esc(block.block_id) + '"><h4>' + esc(block.name) + '</h4><p class="gcwo-muted">Sequência guardada preservada.</p><details><summary>Ver sequência</summary>' + (block.original.intervals || []).map(i=>'<p>' + esc(i.label || i.type) + ' · ' + duration(i.duration_sec || 0) + '</p>').join('') + '</details><button type="button" class="gcBtnGhost" data-delete-block>Remover bloco</button></section>';
    const timing = tempoForca([block]);
    return '<section class="gcwo-strength-block' + (block.block_id === target ? ' selected' : '') + '" data-strength-block="' + esc(block.block_id) + '">' +
      '<div class="gcwo-strength-block-head"><span class="gcwo-exercicio-order">' + String.fromCharCode(65+index) + '</span><input data-block-name value="' + esc(block.name) + '" aria-label="Nome do bloco">' +
      '<div class="gcwo-chips">' + [['series','Por séries'],['circuit','Em circuito']].map(([type,label])=>'<button type="button" class="gcwo-chip' + (block.type === type ? ' on' : '') + '" data-block-type="' + type + '">' + label + '</button>').join('') +
      '</div><button type="button" class="gcBtnGhost gcBtnSm" data-delete-block aria-label="Remover bloco">×</button></div>' +
      '<p class="gcwo-muted">' + (block.type === 'circuit' ? 'Percorrer a lista e repetir por voltas.' : 'Completar as séries de cada exercício antes de avançar.') + '</p>' +
      (block.type === 'circuit' ? '<div class="gcwo-strength-settings">' + selector(block.rounds,'data-preset="rounds"',[1,3,5],'Voltas') + selector(block.rest_between_rounds_s,'data-preset="rest_between_rounds_s"',[20,30,45],'Entre voltas (s)') + '</div>' : '') +
      block.items.map((item,i)=>itemHTML(item,i,block,index,blocks)).join('') +
      (!block.items.length ? '<p class="gcwo-circ-empty">Adicione exercícios do catálogo a este bloco.</p>' : '') +
      '<div class="gcwo-strength-block-foot"><button type="button" class="gcBtnGhost" data-target-block>Adicionar exercícios a este bloco</button><span data-strength-block-time>' + (timing.incomplete ? 'Tempo parcialmente por calcular' : duration(timing.seconds)) + '</span></div></section>';
  }).join('');
}

export function wireBlocosForca(root, blocks, options) {
  root.querySelectorAll('[data-strength-block]').forEach(card => {
    const block = blocks.find(b=>b.block_id === card.dataset.strengthBlock);
    card.querySelector('[data-delete-block]').onclick = () => { blocks.splice(blocks.indexOf(block),1); options.render(); };
    if (block.type === 'legacy') return;
    card.querySelector('[data-block-name]').oninput = event => { block.name = event.target.value; options.change(); };
    card.querySelectorAll('[data-block-type]').forEach(button => button.onclick = () => { block.type = button.dataset.blockType; options.render(); });
    card.querySelector('[data-target-block]').onclick = () => options.target(block.block_id);
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
        options.change();
      });
      row.querySelectorAll('[data-field]').forEach(input=>input.oninput=()=>{
        const key=input.dataset.field;
        item[key]=key==='prescription_note'?input.value:input.value===''?null:Number(input.value);
        options.change();
      });
    });
  });
}
function copySet(set) { return structuredClone(set); }
