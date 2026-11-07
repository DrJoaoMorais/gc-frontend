// Modelo único de força. Os intervalos compilados são a sequência do leitor do doente.
import { editarBlocosCircuito } from './circuito-tempo.js';

const copy = value => structuredClone(value);
const finite = (value, minimum = 0) => typeof value === 'number' && Number.isFinite(value) && value >= minimum;
const cadenceKeys = ['tempo_concentrico_s', 'pausa_superior_s', 'tempo_excentrico_s', 'pausa_inferior_s'];

export function cadenciaForca(item) {
  const values = cadenceKeys.map(key => item[key]);
  return values.some(value => finite(value, 0) && value > 0)
    ? values.reduce((sum, value) => sum + (finite(value) ? value : 0), 0) : finite(item.tempo_exercicio_s, Number.MIN_VALUE) ? item.tempo_exercicio_s : null;
}

export function novoBlocoForca(id, type = 'series') {
  return { block_id: id(), type, name: type === 'circuit' ? 'Circuito' : 'Exercícios por séries', rounds: 1, rest_between_rounds_s: 0, items: [] };
}

export function itemForca(source, id) {
  const item = { ...copy(source), item_id: source.item_id || id() };
  const timed = source.measure === 'time' || source.duration_sec > 0 || source.duration_series?.length > 0;
  item.dose_unit = timed ? 'time' : 'reps';
  if (timed) {
    item.strength_series = source.strength_series ? copy(source.strength_series)
      : (source.duration_series?.length ? source.duration_series : Array.from({ length: source.sets || 1 }, () => ({ duration_sec: source.duration_sec ?? source.value ?? null })))
        .map(set => ({ ...set, value: set.duration_sec, load: set.load ?? source.load ?? null }));
  } else {
    item.strength_series = source.strength_series ? copy(source.strength_series)
      : (source.series?.length ? source.series : Array.from({ length: source.sets || 1 }, () => ({ reps: source.reps_fixed ?? source.value ?? null, reps_min: source.reps_min, reps_max: source.reps_max, load: source.load ?? null })))
        .map(set => ({ ...set, value: set.reps ?? null, load: set.load ?? source.load ?? null }));
  }
  item.strength_series.forEach(set=>{ delete set.reps; delete set.duration_sec; });
  ['series','duration_series','duration_sec','sets','reps_fixed','reps_min','reps_max','load','value','measure','rest_after_s'].forEach(key=>delete item[key]);
  item.rest_set = source.rest_set ?? (item.strength_series.length === 1 ? 0 : null);
  item.rest_next = source.rest_next ?? source.rest_after_s ?? null;
  return item;
}

export function prepararForca(session, catalog, id) {
  if (Array.isArray(session.strength_blocks)) return session.strength_blocks;
  const blocks = [];
  if (session.kind === 'list') {
    const block = novoBlocoForca(id);
    block.items = (session.items || []).map(item => itemForca(item, id));
    blocks.push(block);
  } else {
    const converted = editarBlocosCircuito(session.blocks || [], id);
    converted.forEach(block => {
      if (Array.isArray(block.intervals) || block.tipo === 'fixed') {
        blocks.push({ block_id: block.block_id || id(), type: 'legacy', name: block.name || 'Bloco guardado', original: copy(block._originalBlock || (block.tipo === 'fixed'
          ? { block_id: block.block_id, name: block.name, intervals: [{ type: 'mobilizacao', label: block.name, duration_sec: block.duration_sec }] } : block)) });
        return;
      }
      const convertedBlock = {
        block_id: block.block_id || id(), type: 'circuit', name: block.name || 'Circuito',
        rounds: block.rounds, rest_between_rounds_s: block.rest_between_rounds_s ?? 0,
        items: (block.exercicios || []).map(ex => {
          const cat = catalog.find(item => item.id === ex.exercise_id) || {};
          return itemForca({ ...cat, ...ex, exercise_id: ex.exercise_id, name: ex.name,
            tempo_concentrico_s: cat.tempo_concentrico_s ?? null, tempo_excentrico_s: cat.tempo_excentrico_s ?? null,
            rest_next: ex.rest_after_s, sets: 1 }, id);
        }),
      };
      if (block._originalBlock) {
        convertedBlock.original = copy(block._originalBlock);
        convertedBlock.original_signature = signature(convertedBlock);
      }
      blocks.push(convertedBlock);
    });
  }
  if (!blocks.length) blocks.push(novoBlocoForca(id));
  session.strength_blocks = blocks;
  return blocks;
}

function signature(block) {
  const { original, original_signature, ...editable } = block;
  return JSON.stringify(editable);
}

export function erroForca(blocks) {
  if (!blocks?.length) return 'Adicione pelo menos um bloco.';
  for (const [blockIndex, block] of blocks.entries()) {
    if (block.type === 'legacy') continue;
    if (!block.items.length) return 'Adicione exercícios ao bloco ' + block.name + '.';
    if (block.type === 'circuit' && (!Number.isInteger(block.rounds) || block.rounds < 1 || block.rounds > 1000 || !finite(block.rest_between_rounds_s))) return 'Defina as voltas e o descanso entre voltas.';
    for (const [itemIndex, item] of block.items.entries()) {
      const label = item.name || 'Exercício';
      if (!item.exercise_id || !item.strength_series.length) return 'Escolha o exercício e pelo menos uma série.';
      for (const set of item.strength_series) {
        const range = item.dose_unit === 'reps' && Number.isInteger(set.reps_min) && Number.isInteger(set.reps_max) && set.reps_min > 0 && set.reps_max >= set.reps_min;
        if (!finite(set.value, Number.MIN_VALUE) && !range) return label + ' — preencha a dose em todas as séries.';
        if (item.dose_unit === 'reps' && !range && !Number.isInteger(set.value)) return label + ' — use repetições inteiras.';
        if (set.load != null && !finite(set.load)) return label + ' — confirme a carga.';
      }
      if (item.strength_series.length > 1 && !finite(item.rest_set)) return label + ' — defina o descanso entre séries (0 para sem descanso).';
      if ((itemIndex < block.items.length - 1 || blockIndex < blocks.length - 1) && !finite(item.rest_next)) return label + ' — defina o descanso entre exercícios (0 para sem descanso).';
      if (cadenceKeys.some(key => item[key] != null && !finite(item[key]))) return label + ' — confirme a cadência.';
    }
  }
  return '';
}

export function compilarForca(blocks) {
  const result = [];
  blocks.forEach((block, blockIndex) => {
    if (block.type === 'legacy' || (block.original && block.original_signature === signature(block))) {
      result.push(copy(block.original));
      return;
    }
    const intervals = [];
    const rounds = block.type === 'circuit' ? block.rounds : 1;
    const addRest = (seconds, label, context, restKind) => {
      if (seconds > 0) intervals.push({ ...context, type: 'descanso', label, duration_sec: seconds, rest_kind: restKind });
    };
    for (let round = 1; round <= rounds; round++) {
      block.items.forEach((item, exerciseIndex) => {
        const common = {
          exercise_id: item.exercise_id, exercise_name: item.name,
          photo_url: item.photo_url || null, video_url: item.video_url || null,
          tecnica_info: copy(item.tecnica_info || null), tecnica_notas: item.tecnica_notas || null,
          prescription_note: item.prescription_note || null,
          exercise_index: exerciseIndex + 1, exercise_total: block.items.length,
          round_index: round, round_total: rounds,
        };
        item.strength_series.forEach((set, setIndex) => {
          const repSeconds = cadenciaForca(item);
          const reps = set.value ?? set.reps_max;
          const seconds = item.dose_unit === 'time' ? set.value : repSeconds == null ? 0 : reps * repSeconds;
          const context = { ...common, set_index: setIndex + 1, set_total: item.strength_series.length };
          intervals.push({
            ...context, type: 'trabalho', label: item.name, duration_sec: seconds,
            prescribed_measure: item.dose_unit, prescribed_value: set.value ?? null,
            prescribed_reps_min: set.reps_min ?? null, prescribed_reps_max: set.reps_max ?? null,
            load: set.load ?? null,
            cadence: Object.fromEntries(cadenceKeys.map(key => [key, item[key] ?? 0])),
            manual_reps: item.dose_unit === 'reps' && (repSeconds == null || set.value == null),
          });
          if (setIndex < item.strength_series.length - 1) addRest(item.rest_set, 'Descanso entre séries', context, 'set');
        });
        if (exerciseIndex < block.items.length - 1) addRest(item.rest_next, 'Descanso entre exercícios', common, 'exercise');
      });
      if (round < rounds) addRest(block.rest_between_rounds_s, 'Descanso entre voltas', { round_index: round, round_total: rounds }, 'round');
    }
    const last = block.items.at(-1);
    if (last && blockIndex < blocks.length - 1) addRest(last.rest_next, 'Descanso entre blocos', {}, 'block');
    result.push({ block_id: block.block_id, name: block.name, intervals });
  });
  return result;
}

export function tempoForca(blocks) {
  const intervals = compilarForca(blocks).flatMap(block => block.intervals || []);
  return {
    seconds: intervals.reduce((sum, interval) => sum + (Number(interval.duration_sec) || 0), 0),
    incomplete: intervals.some(interval => interval.manual_reps || (interval.prescribed_reps_min != null && interval.prescribed_reps_min !== interval.prescribed_reps_max)),
  };
}

export function sessaoForcaGuardada(session) {
  return {
    ...session, kind: 'circuit', modality: 'Ginásio', execution_mode: 'guided',
    strength_version: 1, strength_blocks: copy(session.strength_blocks),
    blocks: compilarForca(session.strength_blocks),
  };
}
