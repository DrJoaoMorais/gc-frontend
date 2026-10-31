# Verificação da reorganização do acompanhamento

## Verificado antes da publicação

- Sete separadores e montagem dos elementos existentes.
- Acesso e partilha abre/fecha sem substituir os comandos de envio, validade ou segurança.
- Vinte e seis comandos existentes mantêm os elementos e as ações associadas.
- Mudança de separador mantém os campos montados e os valores de rascunho.
- Edição de treino e alterações pendentes impedem a reconstrução de uma subvista de exercício.
- Calendário mantém o botão de guardar o plano disponível; Diário, Medicação e Questionários são apresentados separadamente.
- Histórico e evolução permanecem acessíveis pelo Resumo.
- Não há alterações ao esquema, dados clínicos ou funções do servidor nesta alteração.

Testes: `node --test tests/acompanhamento-navigation.test.cjs` (8 testes). Verificação adicional da montagem com DOM simulado e dos 26 comandos existentes, sem rede ou dados clínicos. Verificação de sintaxe dos ficheiros JavaScript e `git diff --check`.

Estas verificações não substituem o percurso autenticado nem a execução real de gravações ou partilhas. Não foram enviadas mensagens nem alterados dados clínicos para testar a interface.

## Verificação manual, uma área de cada vez

1. Resumo: confirmar doente, estados atuais e abertura do histórico/resultados.
2. Exercícios por patologia: abrir protocolo e fase, consultar/editar programa e regressar sem perder rascunhos.
3. Atividade física: abrir plano existente, criar/editar treino, consultar planos anteriores e guardar quando aprovado pelo médico.
4. Medicação: consultar registos, adicionar/editar, validar programação das tomas e respetivo calendário.
5. Questionários: consultar pedidos/respostas; criar novo apenas quando clinicamente pretendido.
6. Diário: consultar datas e estado; guardar alterações apenas quando pretendido.
7. Calendário: navegar entre datas, usar filtros, abrir sessões e tomas; confirmar comando de guardar após alterações.
8. Acesso e partilha: verificar validade, cópia e canais de envio; executar alterações de dispositivos ou acessos apenas quando pretendido.
9. Navegação: confirmar regresso ao processo clínico/lista e manutenção dos avisos de alterações pendentes.
