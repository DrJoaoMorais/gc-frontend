# Organização do catálogo aplicada no prescritor

Publicação autorizada pelo utilizador em 31/10/2026. Revisão dos 173 registos ativos obtidos em 31/10/2026 e das regras reais que geravam os seis modelos automáticos.

## O que mudou

- A seleção de exercícios abre diretamente o catálogo pesquisável. Os seis modelos automáticos deixam de aparecer; não são usados para preencher uma duração.
- Duas vistas sobrepostas, «Exercício terapêutico» e «Treino e condição física», mais Todos. Reutilizam as etiquetas atuais Reabilitação/Treino: 150 e 51 registos, com 28 em ambas. Não se inventaram novas indicações clínicas ou fases pós-operatórias.
- Todos os locais como ponto de partida. Os 173 exercícios ficam acessíveis; Casa passa a ser um filtro explícito.
- Organização anatómica mais específica. Correções explícitas de nomes ambíguos evitam classificar «alavanca» ou «bancada» como anca ou «leg press» como ombro. O local de apoio não é automaticamente a região-alvo.
- Controlo motor/estabilidade separado de equilíbrio nos casos identificados; marcha funcional separada da etiqueta cardiovascular.
- Material obrigatório corrigido nas novas seleções de variantes conhecidas: halteres, toalha, rolo de espuma, canadianas e bola giroscópica. A variante com perturbações aplicadas pelo profissional fica na Clínica.
- Modo por tempo em marcha/caminhada/transporte/isométricos; por repetições em ponte unipodal, step-down e outros movimentos dinâmicos antes mal classificados. O prescritor mantém a escolha do modo.
- Novas seleções não recebem 3 × 12 ou outra dose automaticamente. O editor abre uma linha vazia para definir repetições/segundos e permite acrescentar séries. Ambos os descansos precisam de valor explícito, incluindo 0. Uma dose incompleta bloqueia a confirmação da sessão, com os nomes dos exercícios por completar.
- Duração aparece como «por calcular» enquanto a dose não está definida. Não se força uma seleção para ocupar os minutos disponíveis.

## Preservação

Sem alterações à base de dados. A organização é uma camada do prescritor identificada pelos IDs existentes. Não foram fundidos exercícios, mudados IDs ou renomeados registos clínicos. Planos e doses já carregados não recebem a marca de dose por definir. As funções de protocolo e respetivas doses específicas mantêm-se.

As etiquetas de contexto lidas do catálogo têm prioridade sobre a revisão local, para respeitar futuras edições de contexto. Exercícios novos continuam disponíveis em Todos; podem exigir definição manual do modo e da região até serem classificados.

Circuito e HIIT mantêm-se como formatos futuros de sessão, não grupos exclusivos de exercícios.

## Verificação

48 testes locais passaram, incluindo os 173 IDs, sobreposição das vistas, novos registos, correções de anatomia/material/modo, ausência de doses fabricadas, validação pelos controlos reais, pesquisa, filtros e preservação de escolhas, IDs, datas e outros dias. Também passaram as regressões de caminhada, corrida, ciclismo, natação, disponibilidade do questionário e navegação.

Os testes usam código real e dados de catálogo sem dados de doentes, em DOM isolado. Não são uma gravação autenticada, nem validação dos vídeos/imagens ou de todas as indicações clínicas. Não se atribuiu uma indicação clínica individual a partir de uma etiqueta de navegação.
