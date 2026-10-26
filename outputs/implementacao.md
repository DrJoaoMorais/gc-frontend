# Biblioteca de protocolos — alteração local

Base: origin/main 64234c9. Interface publicada em 8f30752, em 26/10/2026. Migrações de gravação e correção aplicadas.

- O cartão Patologias/Protocolos abre diretamente a grelha existente, sem doente.
- A biblioteca mantém pesquisa, filtros, fases e conteúdo clínico.
- O botão «Editar esta fase do protocolo-base» edita nome e período da fase, notas, objetivos, permitido/evitar, programa domiciliário, trabalho na clínica, critérios de progressão e os textos/valores dos critérios detalhados existentes.
- Permite adicionar/remover exercícios e editar contexto, caráter opcional, nota clínica e doses principais. Outros campos de dose e metadados existentes são preservados.
- Novos critérios detalhados são qualitativos. Não há criação automática de limiares clínicos.
- Cada gravação cria uma cópia completa do protocolo, com todas as fases e associações; só a fase editada muda. A versão anterior sai do catálogo ativo e mantém os IDs para consultas históricas. A função é transacional, SECURITY DEFINER com search_path fixo e nomes de tabelas qualificados; exige explicitamente o titular. As tabelas mantêm o bloqueio de escrita direta.
- Não altera wo_prescriptions, consultation_protocols nem as fases da versão anterior.
- A aplicação ao doente continua no fluxo de prescrição. Na biblioteca não existe criação de planos.

## Verificação concluída

- Validação de sintaxe dos módulos e revisão de diferenças.
- Testes PostgreSQL em memória: autorização, rollback em erro, versão nova, preservação de metadados, referências históricas e planos; rejeição de versão desatualizada.
- Testes do editor: preservação de campos/IDs, critérios numéricos, intervalos.
- Navegador com dados fictícios: cartão → grelha → fase → editor → alterar nome e adicionar exercício → guardar → versão 2.
- Inspeção visual do formulário em janela estreita.

## Limites e ativação

A gravação foi validada no servidor com o papel authenticated e identidade do titular, dentro de uma transação integralmente anulada. As particularidades cirúrgicas não integram este editor. A biblioteca não cria protocolos nem fases novas.

Publicação autorizada pelo utilizador. Aplicadas as migrações protocol_library_versioning e protocol_library_guarded_save. A segunda corrige o bloqueio detetado no teste com as políticas reais: a política restritiva do titular não concedia escrita por si só. O teste local foi reforçado para incluir RLS e escrita direta bloqueada.

Verificação após ativação: as contagens e checksums dos 6 protocolos, 24 fases e 174 associações mantêm-se iguais aos valores anteriores. Nenhum conteúdo clínico foi modificado.
