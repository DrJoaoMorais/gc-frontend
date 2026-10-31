# Disponibilidade do questionário no prescritor

Dois novos campos opcionais nos questionários Pré-Consulta e Pré-Consulta V2: minutos por dia útil e minutos por dia do fim de semana. Valores inteiros de 0 a 1440. Zero é ausência de disponibilidade; branco é desconhecido. Mantêm-se todas as perguntas e identificadores anteriores.

O prescritor lê apenas as respostas relevantes do questionário concluído mais recente, filtrado pelo mesmo doente e clínica, através do cliente autenticado e das políticas existentes. A leitura não altera respostas nem cria sessões. A origem e a data são apresentadas no calendário de criação de treino.

Os valores iniciam a disponibilidade de segunda a sexta e sábado/domingo. Cada dia é editável em minutos exatos. Ajustes já guardados no plano têm prioridade, incluindo exceções por data. A disponibilidade é incluída em `wo_prescriptions.data.disponibilidadeTreino` ao adicionar os treinos à prescrição e ao guardar o plano pelo fluxo existente. Não existe alteração de esquema ou migração.

Questionários antigos com intervalos de tempo não são convertidos em minutos exatos nem distribuídos automaticamente por dias. O prescritor mostra o intervalo como informação. Sem respostas diárias, os valores iniciais do editor são explicitamente assinalados como valores a confirmar; não são atribuídos ao doente.

Verificações: 17 testes nativos (9 novos e 8 da navegação), teste adicional dos módulos reais com DOM simulado (20/60, edição direta para 25, exceção de 90, reabertura, zero, desconhecido e validação do formulário), sintaxe e diff. Foram consultados apenas metadados, políticas e a definição da função de gravação na base de dados, sem consultar ou modificar respostas de doentes.

Pendente: validação visual e percurso autenticado completo com envio de um questionário novo e gravação de um plano. Os testes de interface usam dados fictícios e não validam uma gravação real na base de dados.

Publicação autorizada pelo utilizador para esta integração. Não inclui migração, envio de questionários, preenchimento retroativo de respostas ou alteração de dados clínicos.
