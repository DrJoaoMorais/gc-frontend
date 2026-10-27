const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function normalizarRecomendacoes(items) {
  if (!Array.isArray(items)) return [];
  return items.map(item => typeof item === 'string' ? { title:'', text:item.trim() } : {
    title:typeof item?.title === 'string' ? item.title.trim() : '',
    text:typeof item?.text === 'string' ? item.text.trim() : '',
  }).filter(item => item.text);
}

// Copiar apenas a orientação do doente; as notas clínicas ficam no protocolo.
export function recomendacoesParaSessao(fase) {
  const items = normalizarRecomendacoes(fase?.data?.recomendacoes);
  return items.length ? 'Recomendações\n' + items.map(item => `${item.title ? item.title + ': ' : ''}${item.text}`).join('\n\n') : '';
}

export function renderRecomendacoesFase(fase) {
  const data = fase?.data || {};
  const items = normalizarRecomendacoes(data.recomendacoes);
  const clinicas = normalizarRecomendacoes(data.recomendacoes_clinicas);
  if (!items.length && !clinicas.length) return '';
  const imagem = typeof data.recomendacoes_imagem === 'string' && /^(https:\/\/|\/assets\/)/.test(data.recomendacoes_imagem) ? data.recomendacoes_imagem : '';
  const renderItems = rows => rows.map(item => `<div class="gcwo-recomendacao">${item.title ? `<h4>${esc(item.title)}</h4>` : ''}<p>${esc(item.text)}</p></div>`).join('');
  return `<section class="gcwo-pat-recomendacoes" aria-label="Recomendações">
    <h3>Recomendações</h3>
    <p class="gcwo-muted">Rever antes de selecionar os exercícios. A orientação para o doente acompanha as novas sessões deste protocolo.</p>
    ${imagem ? `<img class="gcwo-recomendacoes-imagem" src="${esc(imagem)}" alt="${esc(data.recomendacoes_imagem_alt || 'Exemplo de ortótese; ajuste individual pelo profissional')}" loading="lazy">` : ''}
    ${renderItems(items)}
    ${clinicas.length ? `<details><summary>Notas para o médico</summary>${renderItems(clinicas)}</details>` : ''}
  </section>`;
}
