# Acesso e partilha — 13 novembro 2026

Página clínica com quatro blocos: período geral, navegador autorizado, conteúdos e envio. Os nomes dos conteúdos abrem os editores no mesmo doente/clínica, com regresso e proteção dos rascunhos. Datas clínicas são mostradas separadamente, com aviso quando excedem o acesso. Prolongar acesso não cria sessões nem prolonga tratamentos. Ligações sem data histórica não são alteradas automaticamente; um novo envio exige guardar uma data.

WhatsApp usa telefone confirmado da ficha e mensagem editável; não exige contacto guardado. O GC indica mensagem preparada, sem inferir envio/entrega. Email usa o destinatário confirmado; copiar inclui a mensagem e a ligação. Alterações dos contactos nesta área aplicam-se só ao envio. A pré-visualização é local e não activa o navegador da clínica.

## Controlo do acesso

Associação explícita da prescrição e questionário ao portal, com validação do contexto do doente/clínica. Os registos existentes são associados ao portal mais recente do mesmo contexto; nenhum prazo clínico é reescrito. Novo episódio não reactiva códigos anteriores. Substituir ligação renova também os códigos de exercício, diário e questionário e mantém os registos. Revogar e expirar bloqueia os conteúdos associados. Pedidos históricos sem portal mantêm a validade autónoma; não se afirma que constituam acompanhamento associado.

Segredo do navegador em cabeçalho dos pedidos de conteúdo. No leitor de exercício, transita no fragmento da URL (não na query), é removido de imediato e guardado na sessão do navegador. Leituras directas sem autorização encaminham para activação do portal. Escritas nunca são repetidas automaticamente. Filtragem de sessões no servidor respeita actividade/patologia. Acesso de equipa autorizada da clínica e serviço preservado. Não se alteram RLS, prescrições clínicas, respostas ou doses.

## Validação e publicação

Testes isolados com dados fictícios: cinco destinos clínicos e regresso, rascunhos, inclusão, prazos e fuso de Lisboa no verão/inverno, mensagem e contacto, ligação WhatsApp e larguras 1280/768/390/320. Cliente de autorização testado com biblioteca Supabase real e resposta simulada; CORS do cabeçalho confirmado. SQL testado dentro de transacção terminada por ROLLBACK, incluindo expiração, revogação, dispositivo, filtragem, episódio novo e substituição real de credenciais em registos transitórios.

Ordem: migração aditiva de associação; publicar GC e treino; verificar ficheiros públicos; activar migração dos guardas. Não foram enviadas mensagens reais. Validação autenticada na sessão clínica e Safari/iPhone real continua necessária. Segurança global do sistema não se considera integralmente auditada por esta alteração.

## Estado de revisão — publicação suspensa

A revisão automática rejeitou a primeira migração por associar em bloco os registos históricos ao portal mais recente sem autorização específica para esse alcance. Nenhuma das duas migrações foi aplicada. A versão de produção não foi substituída.

Contagem agregada, sem dados identificáveis: 29 prescrições (14 com um portal, 11 com vários, 4 sem portal) e 23 questionários (14 com um portal, 9 com vários). A correspondência dos 20 registos com vários portais deve ser validada antes da migração; não se deve assumir silenciosamente o portal mais recente. O SQL de associação neste ramo é uma proposta pendente de revisão, não uma autorização para execução nem uma migração aplicada.

Commits e ramo de preparação preservam o trabalho para revisão. Publicação da página dependente e activação da proteção aguardam resolução desta associação histórica.
