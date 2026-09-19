/* Exame funcional: campos opcionais, sem valores clínicos por defeito. */
const ajuda = ['Independente', 'Supervisão', 'Ajuda mínima', 'Ajuda moderada', 'Ajuda máxima', 'Dependente', 'Não realiza', 'Não testado'];
const linha = (id, label, opts) => ({ id, label, opts });
const notas = {
  condicoes: 'Nome do profissional, local e contexto da avaliação…',
  marcha: 'Distância em metros, padrão de marcha, degraus e corrimão…',
  mobilidade: 'Articulação, movimento, lado, amplitude ativa/passiva e graus. Se testada: força por grupo muscular, lado e método…',
  pele: 'Local e lado das alterações; perimetria e ponto de medição, se avaliados…',
  livre: 'Dor, outras medições, observações ou motivo para não testar…'
};
const sec = (id, titulo, rows, open = false) => ({ tipo: 'params', id, titulo, rows, notas: 'notas_' + id, notasPlaceholder: notas[id] || 'Medições, observações ou motivo para não testar…', recolhivel: true, aberto: open });
export default {
  id: 'teleconsulta', titulo: 'Teleconsulta Funcional',
  subtitle: 'Preenche apenas o que foi avaliado. Abre os blocos necessários; usa as notas para medições, lado e contexto.',
  layout: 'lista', tabs: { pedidos: true },
  pedidos: [
    { id: 'barthel', nome: 'Índice de Barthel', descricao: 'Autonomia nas atividades da vida diária.', pedido: 'Índice de Barthel — versão 0–100; devolver resultado por item e total.' },
    { id: 'tug', nome: 'TUG — Timed Up and Go', descricao: 'Mobilidade funcional cronometrada.', pedido: 'TUG — devolver tempo em segundos, auxiliar utilizado e ajuda necessária; se não realizado, indicar motivo.' },
    { id: 'sppb', nome: 'SPPB', descricao: 'Equilíbrio, velocidade da marcha e levantar da cadeira.', pedido: 'SPPB — devolver resultados das três componentes e total (0–12), indicando o protocolo utilizado.' },
    { id: 'tinetti', nome: 'Tinetti / POMA', descricao: 'Equilíbrio e marcha.', pedido: 'Tinetti / POMA — versão 0–28; devolver equilíbrio, marcha e total.' },
    { id: 'berg', nome: 'Escala de Equilíbrio de Berg', descricao: 'Avaliação do equilíbrio através de tarefas.', pedido: 'Escala de Equilíbrio de Berg — devolver resultados por item e total (0–56).' },
    { id: 'dor', nome: 'Dor — escala numérica (0–10)', descricao: 'Repouso, atividade e pico, registados separadamente.', pedido: 'Dor — escala numérica 0–10: repouso, atividade (identificar a tarefa) e pico (identificar o período de referência).' },
    { id: 'mrc', nome: 'Força muscular — MRC', descricao: 'Teste muscular por movimento e lado.', pedido: 'Força muscular — MRC (0–5): identificar movimentos/grupos musculares e lado avaliados presencialmente.' },
    { id: 'ashworth', nome: 'Ashworth modificada', descricao: 'Avaliação do tónus muscular.', pedido: 'Escala de Ashworth modificada — identificar músculos/grupos musculares, lado e grau obtido na avaliação presencial.' }
  ],
  seccoes: [
    sec('condicoes', 'Condições da avaliação', [
      linha('acompanhante', 'Acompanhante presencial', ['Fisioterapeuta', 'Enfermeiro', 'Auxiliar', 'Familiar', 'Sem acompanhante']),
      linha('fonte', 'Origem dos resultados', ['Observação por vídeo', 'Avaliação pelo profissional presente', 'Informação do cuidador', 'Mista']),
      linha('colaboracao', 'Colaboração', ['Boa', 'Parcial', 'Reduzida', 'Não colaborante', 'Não avaliada']),
      linha('ordens', 'Compreensão de ordens', ['Adequada', 'Ordens simples', 'Limitada', 'Não avaliada']),
      linha('nivel', 'Situação funcional predominante', ['Acamado', 'Cama / cadeirão', 'Realiza transferências', 'Deambula com ajuda', 'Deambula autónomo'])
    ], true),
    sec('leito', 'Mobilidade no leito', [
      linha('rol_d', 'Rolamento à direita', ajuda), linha('rol_e', 'Rolamento à esquerda', ajuda),
      linha('deitar_sentado', 'Decúbito → sentado', ajuda), linha('sentado_deitar', 'Sentado → decúbito', ajuda),
      linha('ponte', 'Ponte', ['Não realiza', 'Parcial', 'Completa', 'Não testado'])
    ]),
    sec('sedestacao', 'Sedestação e controlo do tronco', [
      linha('sentado_tempo', 'Sedestação sem apoio', ['Não consegue', 'Menos de 10 s', '10 a 29 s', '30 a 59 s', '60 s ou mais', 'Não testado']),
      linha('tronco', 'Controlo do tronco', ['Bom', 'Diminuído', 'Muito diminuído', 'Não testado']),
      linha('equilibrio_sentado', 'Equilíbrio sentado', ['Estável', 'Instável', 'Necessita apoio', 'Não testado'])
    ]),
    sec('transferencias', 'Transferências', [
      linha('sentado_pe', 'Sentado → de pé', ajuda), linha('cama_cadeira', 'Cama ↔ cadeira', ajuda),
      linha('ms_transferencia', 'Apoio dos membros superiores', ['Sem apoio', 'Unilateral', 'Bilateral', 'Não testado']),
      linha('pessoas_transferencia', 'Pessoas necessárias', ['0', '1', '2', 'Não testado'])
    ]),
    sec('ortostatismo', 'Ortostatismo', [
      linha('pe_ajuda', 'Ajuda humana', ajuda),
      linha('pe_apoio', 'Apoio dos membros superiores', ['Sem apoio', 'Unilateral', 'Bilateral', 'Não testado']),
      linha('pe_tempo', 'Tempo sem apoio', ['Não consegue', 'Menos de 10 s', '10 a 29 s', '30 s ou mais', 'Não testado'])
    ]),
    sec('marcha', 'Marcha e escadas', [
      linha('marcha_capacidade', 'Marcha', ['Realiza', 'Não realiza', 'Não testado']),
      linha('marcha_auxiliar', 'Auxiliar de marcha', ['Sem auxiliar', 'Andarilho', 'Canadianas', 'Bengala', 'Outro', 'Não testado']),
      linha('marcha_ajuda', 'Ajuda humana na marcha', ['Sem ajuda', 'Supervisão', 'Ajuda de uma pessoa', 'Ajuda de duas pessoas', 'Não testado']),
      linha('escadas', 'Escadas', ajuda)
    ]),
    sec('mobilidade', 'Mobilidade articular e força', [
      linha('amplitude', 'Mobilidade articular', ['Sem limitações relevantes', 'Limitações identificadas', 'Não testado']),
      linha('forca', 'Força — apreciação global', ['Sem défice aparente', 'Défice global', 'Défice focal / assimétrico', 'Não testado']),
      linha('teste_forca', 'Teste muscular pelo profissional presente', ['Realizado', 'Não realizado'])
    ]),
    sec('pele', 'Trofismo, edema e pele', [
      linha('trofismo', 'Trofismo', ['Preservado', 'Hipotrofia global', 'Hipotrofia segmentar', 'Não testado']),
      linha('edema', 'Edema', ['Ausente', 'Presente', 'Não testado']),
      linha('cutaneo', 'Alterações cutâneas', ['Não identificadas', 'Presentes', 'Não testado'])
    ]),
    sec('avd', 'Atividades da vida diária', [
      linha('higiene', 'Higiene pessoal', ajuda), linha('vestir', 'Vestir / despir', ajuda), linha('alimentacao', 'Alimentação', ajuda)
    ]),
    sec('livre', 'Outras observações e medições', [])
  ]
};
