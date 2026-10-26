# Biblioteca de protocolos — alteração local

Base: origin/main 64234c9. Sem publicação nem alterações de dados em produção.

- O cartão Patologias/Protocolos abre diretamente a grelha existente, sem doente.
- A biblioteca mantém pesquisa, filtros, fases e conteúdo clínico.
- O botão «Editar esta fase do protocolo-base» edita nome e período da fase, notas, objetivos, permitido/evitar, programa domiciliário, trabalho na clínica, critérios de progressão e os textos/valores dos critérios detalhados existentes.
- Permite adicionar/remover exercícios e editar contexto, caráter opcional, nota clínica e doses principais. Outros campos de dose e metadados existentes são preservados.
- Novos critérios detalhados são qualitativos. Não há criação automática de limiares clínicos.
- Cada gravação cria uma cópia completa do protocolo, com todas as fases e associações; só a fase editada muda. A versão anterior sai do catálogo ativo e mantém os IDs para consultas históricas. A função é transacional, SECURITY INVOKER, usa as políticas existentes e exige o titular.
- Não altera wo_prescriptions, consultation_protocols nem as fases da versão anterior.
- A aplicação ao doente continua no fluxo de prescrição. Na biblioteca não existe criação de planos.

## Verificação concluída

- Validação de sintaxe dos módulos e revisão de diferenças.
- Testes PostgreSQL em memória: autorização, rollback em erro, versão nova, preservação de metadados, referências históricas e planos; rejeição de versão desatualizada.
- Testes do editor: preservação de campos/IDs, critérios numéricos, intervalos.
- Navegador com dados fictícios: cartão → grelha → fase → editor → alterar nome e adicionar exercício → guardar → versão 2.
- Inspeção visual do formulário em janela estreita.

## Limites e ativação

Não se testou gravação numa sessão real do Supabase, nem a interface de edição de particularidades cirúrgicas, que não integra esta alteração. A biblioteca não cria protocolos nem fases novas.

Publicação pendente de autorização: aplicar a migração 20261026115041_protocol_library_versioning.sql, publicar os quatro ficheiros de interface e confirmar o acesso com sessão autorizada. Não é necessário alterar qualquer conteúdo clínico real para ativar a funcionalidade.
