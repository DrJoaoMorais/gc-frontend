# Avaliações por link para o terapeuta

Estado: implementação local. A migration e a página pública ainda não foram publicadas.

## Funcionamento

- Teleconsulta Funcional → Escalas e testes a pedir → Ver escala.
- Seleção de uma ou mais avaliações; referência e instruções opcionais do médico.
- Criar link guarda primeiro o exame e cria um pedido com definições versionadas.
- Link válido 7 dias, com token aleatório de 256 bits no fragmento da URL (não enviado como parte do URL ao servidor web). Só o hash fica guardado na base de dados.
- O profissional identifica-se, confirma autorização e preenche uma avaliação por ecrã. Pode guardar e retomar pelo mesmo link.
- Concluir exige resposta a cada escala (ou motivo para não realização). O servidor calcula os totais; não aceita totais enviados pelo navegador.
- Respostas concluídas são imutáveis. Uma correção exige um novo pedido. A identidade do profissional é declarada, não autenticada por conta profissional.
- O médico consulta as respostas no separador. O Relatório da Consulta inclui resultados comunicados pelo terapeuta, identificados como por rever. Não substituem os achados do exame médico.

## Escalas e âmbito clínico

As folhas são **formulários de registo de resultados** para profissionais. Não constituem novas traduções portuguesas validadas nem substituem os protocolos originais, disponíveis por link em cada formulário. Barthel, Berg e Tinetti recolhem pontuações por item; SPPB recolhe as três pontuações componentes e o percurso (3 ou 4 m), sem calcular pontuações a partir de tempos. TUG recolhe tempo e condições; MRC e Ashworth permitem vários movimentos/grupos musculares, separadamente por lado. Dor separa repouso, atividade e pico. Apresenta-se uma conclusão descritiva, partilhada com o relatório. O TUG sinaliza o limiar CDC de 12 segundos apenas em idosos, protocolo habitual de 3 m e sem ajuda física declarada. Não se aplicam limiares universais à Berg ou Tinetti. Pontuação incompleta não produz conclusão. Os critérios abreviados são auxiliares; o protocolo permanece acessível.

Fontes verificadas em 18-09-2026:

- Barthel: https://www.sralab.org/rehabilitation-measures/barthel-index — estrutura dos 10 itens já existente no GC; total 0–100.
- TUG: https://www.sralab.org/rehabilitation-measures/timed-and-go
- SPPB: https://www.nia.nih.gov/research/labs/leps/short-physical-performance-battery-sppb — três componentes 0–4, total 0–12.
- Tinetti/POMA: https://www.tendertouch.com/wp-content/uploads/user_uploads/Training%20admin/1629903865_Tinettti-Test-Score-Sheet.pdf — itens/subitens, equilíbrio 0–16 e marcha 0–12; total 0–28.
- Berg: https://www.sralab.org/sites/default/files/2024-03/core-measure-berg-balance-scale-(bbs)_final-2019.pdf — 14 itens 0–4; total 0–56.
- Dor: https://www.sralab.org/rehabilitation-measures/numeric-pain-rating-scale
- MRC: https://www.ukri.org/councils/mrc/facilities-and-resources/find-an-mrc-facility-or-resource/mrc-muscle-scale/
- Ashworth: https://www.sralab.org/rehabilitation-measures/ashworth-scale-modified-ashworth-scale

## Dados e permissões

Migration `20260918173454_therapist_scale_links.sql` (gerada com a CLI, **aplicada em produção em 19/09/2026**).

Nenhuma alteração às tabelas de intake nem à fundação clínica pré-existente. Nova tabela de pedidos com RLS e sem permissões diretas de anon/authenticated. Funções públicas limitadas a contexto e resposta por token. Criação, listagem e cancelamento exigem autor autenticado e papel clínico ativo na clínica. O contexto público não divulga IDs de doente/consulta nem outros registos. Snapshots do catálogo são copiados para o pedido e mantidos após alterações futuras. Bloqueio de linha e número de revisão impedem sobrescrita concorrente. Conclusão e criação toleram repetição idêntica após falhas de rede.

## Testes locais

Dependências externas de teste: Playwright e `@electric-sql/pglite@0.5.8`. Não são dependências do site publicado. Usar `NODE_PATH` para apontar para instalações existentes. Servir a raiz do GC em `http://127.0.0.1:8766` (ou indicar `BASE_URL`).

- `node modules/terapeuta/tests/database.cjs`: SQL executado em Postgres WASM descartável; autorização, isolamento, expiração, revogação, idempotência, concorrência, validação, máximos, subtotais e não realizado.
- `node modules/terapeuta/tests/browser.cjs`: formulário médico → link múltiplo → ecrã móvel → rascunho/retoma → envio → respostas na consulta, com RPCs ligadas ao Postgres local. Bloqueia toda a rede externa. `SCREENSHOT_PATH` opcional.
- `node modules/obj/tests/teleconsulta.cjs`: regressão do exame, relatório estruturado e abertura do ombro.

Limites da validação: não foi feito envio a um terapeuta real, nem teste autenticado em Supabase/produção, nem emissão de PDF público. A integração no relatório usa o mesmo apresentador de resultados testado no separador. Antes da publicação, rever texto e protocolos com o médico; aplicar a migration e publicar apenas os ficheiros deste trabalho através de uma publicação isolada; validar o circuito autenticado com dados fictícios.

Preenchimento direto: selecionar escalas e usar «Preencher agora». Reutiliza o pedido com token e a identificação obrigatória do profissional (nome, profissão e data). O formulário abre na consulta; «Guardar e fechar» persiste o rascunho, e o link apresentado permite retomar. «Guardar avaliações na consulta» conclui a avaliação. Os resultados usam um título neutro e identificam o profissional, sem atribuir automaticamente respostas ao terapeuta.
