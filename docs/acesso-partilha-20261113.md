# Acesso e partilha — 13 novembro 2026

Página clínica com quatro blocos: período geral, navegador autorizado, conteúdos e envio. Os nomes dos conteúdos abrem os editores no mesmo doente/clínica, com regresso e proteção dos rascunhos. Datas clínicas são mostradas separadamente, com aviso quando excedem o acesso. Prolongar acesso não cria sessões nem prolonga tratamentos. Ligações sem data histórica não são alteradas automaticamente; um novo envio exige guardar uma data.

WhatsApp usa telefone confirmado da ficha e mensagem editável; não exige contacto guardado. O GC indica mensagem preparada, sem inferir envio/entrega. Email usa o destinatário confirmado; copiar inclui a mensagem e a ligação. Alterações dos contactos nesta área aplicam-se só ao envio. A pré-visualização é local e não activa o navegador da clínica.

## Controlo do acesso

Associação explícita da prescrição e questionário ao portal, com validação do contexto do doente/clínica. Os registos existentes são associados pelo intervalo de criação e pelas substituições exactas da ligação; nenhum prazo clínico é reescrito. Novo episódio não reactiva códigos anteriores. Substituir ligação renova também os códigos de exercício, diário e questionário e mantém os registos. Revogar e expirar bloqueia os conteúdos associados. Pedidos históricos sem portal mantêm a validade autónoma; não se afirma que constituam acompanhamento associado.

Segredo do navegador em cabeçalho dos pedidos de conteúdo. No leitor de exercício, transita no fragmento da URL (não na query), é removido de imediato e guardado na sessão do navegador. Leituras directas sem autorização encaminham para activação do portal. Escritas nunca são repetidas automaticamente. Filtragem de sessões no servidor respeita actividade/patologia. Acesso de equipa autorizada da clínica e serviço preservado. Não se alteram RLS, prescrições clínicas, respostas ou doses.

## Validação e publicação

Testes isolados com dados fictícios: cinco destinos clínicos e regresso, rascunhos, inclusão, prazos e fuso de Lisboa no verão/inverno, mensagem e contacto, ligação WhatsApp e larguras 1280/768/390/320. Cliente de autorização testado com biblioteca Supabase real e resposta simulada; CORS do cabeçalho confirmado. SQL testado dentro de transacção terminada por ROLLBACK, incluindo expiração, revogação, dispositivo, filtragem, episódio novo e substituição real de credenciais em registos transitórios.

Ordem: migração aditiva de associação; publicar GC e treino; verificar ficheiros públicos; activar migração dos guardas. Não foram enviadas mensagens reais. Validação autenticada na sessão clínica e Safari/iPhone real continua necessária. Segurança global do sistema não se considera integralmente auditada por esta alteração.

## Correspondência histórica validada após autorização expressa

O utilizador autorizou a migração e a publicação. A associação deixou de escolher o portal mais recente. Usa o intervalo da criação do registo; os registos anteriores ao primeiro portal são associados a esse primeiro. Só acompanha substituições com criação exactamente igual à revogação do predecessor; reinícios posteriores não são confundidos com substituições. A migração aborta perante intervalos ambíguos ou sem correspondência.

Verificação agregada: 25 prescrições com portal e 23 questionários encontram correspondência; 4 prescrições sem portal mantêm o acesso autónomo histórico. Inclui os 20 registos inicialmente ambíguos. Nenhum registo actualmente activo e dentro da validade passa a portal revogado. Prescrições e respostas históricas permanecem intactas.

## Publicado e verificado

Página GC e leitor de exercício publicados em main. As duas migrações foram aplicadas, após autorização expressa do utilizador para validar e migrar os acessos históricos. Conferidos os ficheiros públicos por comparação integral. A protecção está instalada em 20 funções de conteúdo. Os 15 testes de servidor passaram depois da activação, em transacção anulada no final. Não houve mensagens reais nem alteração das doses, respostas ou datas clínicas.
