# Prescrição com semana compacta e editor amplo

Implementação autorizada a partir do mockup «prescricao-editor-amplo», com commit e publicação pedidos em 31/10/2026.

- Atividade física abre o construtor com semana à esquerda (27%) e editor à direita. O separador Calendário mantém o calendário global do acompanhamento.
- Editores existentes de caminhada, corrida, ciclismo, natação e força reutilizados. Mantêm-se blocos, zonas, trabalho/recuperação, piscina/estilo, séries, cargas, descansos, tempos de execução, instruções, ordem, favoritos e filtros.
- A semana mostra uma projeção do rascunho durante a edição. Cancelar repõe o valor anterior. Mudar de sessão aplica primeiro o rascunho através da validação existente. Guardar plano também aplica o rascunho aberto antes da gravação existente; uma sessão vazia bloqueia essa gravação.
- Catálogo de força recolhido inicialmente, com pesquisa, filtros e páginas de 12 resultados. Os exercícios selecionados são expansíveis e mantêm os controlos completos.
- Tempo não calculável por falta de ritmo/velocidade aparece como «por calcular». Durações estimadas continuam identificadas como aproximadas.
- Circuito e HIIT identificados como em preparação. Não foram criados protocolos, intervalos HIIT ou doses novas. O editor de circuito já existente foi preservado.
- Nenhuma alteração de dados reais, tabelas ou funções de servidor. As alterações preparadas de gestão dos questionários não fazem parte desta publicação.

## Verificação

38 testes locais passaram: 21 do construtor/editores, 9 da disponibilidade do questionário e 8 da navegação. Código real em DOM isolado, dados fictícios; incluem projeção/cancelamento, mudança de sessão, gravação única com editor aberto, preservação de IDs/datas/outros dias, catálogo de 200 itens, filtros/paginação e campos de FC/potência/ritmo/piscina das modalidades.

A chamada de gravação remota é substituída para capturar o conteúdo. Não houve teste visual num navegador nem gravação numa sessão autenticada. Estes testes não constituem validação exaustiva de todas as funções.

Dependência de desenvolvimento: linkedom@0.18.14, externa aos ficheiros de produção.
