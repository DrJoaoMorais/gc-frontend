// Composição explícita com IDs existentes no catálogo revisto. A dose é individual.
// Não são transcrições dos vídeos do utilizador; estes continuam por confirmar.
export const BLOCOS_EXERCICIO = [
  { id: 'inferiores', nome: 'Bloco A · Membros inferiores', categorias: ['Circuitos', 'HIIT', 'Força'], ids: ['2390babe-f755-5163-9135-b0baf70d1e5d', '1424fa17-5c85-59d3-b946-182ed113461e', 'cd8e917c-de32-56e7-9bfd-7c6ba3c1b6ba', '3d52a6d4-0ed0-5d2f-b9a7-0e77c0f9dd1f'] },
  { id: 'superiores', nome: 'Bloco B · Membros superiores', categorias: ['Circuitos', 'HIIT', 'Força'], ids: ['8b4f8992-654f-46be-a4d0-98b9953d2d20', 'b8baad08-8b05-46b5-8e8e-55473ed0358d', '923f014c-3d4a-4663-8a56-0c82ab325fde'] },
  { id: 'core', nome: 'Bloco C · Core e controlo do tronco', categorias: ['Circuitos', 'HIIT', 'Força'], ids: ['b4bd0a2e-fc2c-43b6-ab15-56cd7b5bdfc9', '43eded0f-e4e4-4908-889d-21d30a01b262'] },
  { id: 'inteiro', nome: 'Bloco D · Corpo inteiro', categorias: ['Circuitos', 'HIIT', 'Força'], ids: ['2390babe-f755-5163-9135-b0baf70d1e5d', '8b4f8992-654f-46be-a4d0-98b9953d2d20', 'b8baad08-8b05-46b5-8e8e-55473ed0358d', '43eded0f-e4e4-4908-889d-21d30a01b262'] },
  { id: 'mobilidade', nome: 'Mobilidade · Cervical, escápula e tornozelo', categorias: ['Mobilidade'], ids: ['bc36ebf4-49f3-4143-9ec0-421310b6b679', 'd612b25c-09a3-4b12-90ec-a4f822ba9643', 'f1dfde4b-79f7-5cd0-8153-f415e3fcbeef'] },
];

export function resolverBloco(bloco, catalogo) {
  const porId = new Map((catalogo || []).filter(e => e.is_active !== false).map(e => [e.id, e]));
  return { exercicios: bloco.ids.map(id => porId.get(id)).filter(Boolean), emFalta: bloco.ids.filter(id => !porId.has(id)) };
}

// Inclui listas e circuitos no formato do editor e no snapshot do portal.
export function exerciciosDaSessao(sessao, catalogo = []) {
  const resultado = [], porId = new Map(catalogo.map(e => [e.id, e]));
  const adicionar = ex => {
    const id = ex.exercise_id || ex.id;
    const name = ex.exercise_name || ex.name || porId.get(id)?.name;
    if (name && !resultado.some(e => id ? e.exercise_id === id : e.name === name)) resultado.push({ ...porId.get(id), ...ex, exercise_id: id || null, name });
  };
  (sessao?.items || []).forEach(adicionar);
  (sessao?.blocks || []).forEach(b => {
    (b.exercicios || []).forEach(adicionar);
    (b.intervals || []).filter(i => i.type === 'trabalho' && i.exercise_id).forEach(adicionar);
  });
  return resultado;
}

// Número de exercícios par région, não uma percentagem de esforço ou carga.
export function distribuicaoRegional(exercicios, organizar = e => e) {
  const contagem = new Map();
  for (const ex of exercicios) {
    const regioes = organizar(ex).regioes_catalogo || ex.categoria || [];
    const grupos = new Set(regioes.map(r => /superior|ombro|escápula|cotovelo|punho|mão/i.test(r) ? 'Membros superiores' : /inferior|anca|joelho|tornozelo|pé/i.test(r) ? 'Membros inferiores' : /core|tronco|coluna|cervical|lombar/i.test(r) ? 'Core / tronco' : /inteiro/i.test(r) ? 'Corpo inteiro' : null).filter(Boolean));
    grupos.forEach(g => contagem.set(g, (contagem.get(g) || 0) + 1));
  }
  return [...contagem].sort((a, b) => b[1] - a[1]);
}
