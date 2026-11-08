// Modelos pessoais: apenas estrutura, sem doses nem dados do doente.
export function estruturaModeloForca(block, name = block.name) {
  if (!block || block.type === 'legacy' || !block.items?.length) throw new Error('Adicione exercícios antes de guardar o modelo.');
  return { version: 1, name: String(name).trim(), type: block.type === 'circuit' ? 'circuit' : 'series',
    items: block.items.map(item => ({ exercise_id: item.exercise_id, sets: item.strength_series.length })) };
}
export function aplicarModeloForca(model, catalog, id, createItem) {
  if (!model?.items?.length) throw new Error('Este modelo não tem exercícios.');
  const items = model.items.map(entry => {
    const exercise = catalog.find(ex => ex.id === entry.exercise_id);
    if (!exercise || exercise.is_active === false) throw new Error('O modelo tem exercícios indisponíveis no catálogo.');
    if (!Number.isInteger(entry.sets) || entry.sets < 1 || entry.sets > 1000) throw new Error('Número de séries inválido no modelo.');
    return createItem({ exercise_id: exercise.id, name: exercise.name, photo_url: exercise.photo_url, video_url: exercise.video_url,
      tecnica_info: exercise.tecnica_info, tecnica_notas: exercise.tecnica_notas,
      sets: entry.sets, rest_set: entry.sets === 1 ? 0 : null, rest_next: null }, id);
  });
  return { block_id: id(), type: model.type === 'circuit' ? 'circuit' : 'series', name: model.name,
    rounds: 1, rest_between_rounds_s: null, items };
}
async function userId(client) {
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user?.id) throw new Error('Inicie sessão para aceder aos seus modelos.');
  return data.user.id;
}
export async function listarModelosForca(client) {
  const owner = await userId(client);
  const { data, error } = await client.from('wo_strength_templates').select('id,name,data').eq('user_id', owner).order('created_at', { ascending: false });
  if (error) throw new Error('Não foi possível carregar os modelos. Tente novamente.');
  return { owner, models: data || [] };
}
export async function guardarModeloForca(client, block, name) {
  const data = estruturaModeloForca(block, name);
  if (!data.name || data.name.length > 120) throw new Error('Indique um nome com até 120 caracteres.');
  const owner = await userId(client);
  const { data: saved, error } = await client.from('wo_strength_templates').insert({ user_id: owner, name: data.name, data }).select('id,name,data').single();
  if (error || !saved) throw new Error('Não foi possível guardar o modelo. O bloco continua disponível no treino.');
  return saved;
}
