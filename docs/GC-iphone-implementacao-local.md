# GC no iPhone — implementação local, 24 outubro 2026

Estado inicial: implementado e testado localmente. Publicação no GC real posteriormente autorizada pelo utilizador em 24 outubro 2026. Sem migrações ou alterações manuais a dados reais.

Base: `44c35b4`, obtida de `origin/main`. A cópia está em `/Users/joaomorais/Documents/Codex/gc-iphone-20261024`. As outras cópias locais e as respetivas alterações foram preservadas.

## Funcionalidade

- Navegação inferior Hoje, Doentes e Mais. Hoje repõe a data atual e a agenda diária. As permissões existentes controlam as opções de Mais.
- Agenda em cartões sem deslocação horizontal. Os botões de estado, edição, RGPD, fisioterapia e PDFs continuam disponíveis.
- Pesquisa de doentes por clínica, com escolha explícita da clínica para criar um doente. A pesquisa em Todas consulta as clínicas visíveis separadamente. Resultados de pesquisas anteriores são ignorados quando muda o texto, a clínica ou o ecrã.
- No telemóvel, pesquisa e criação abrem diretamente o processo clínico. O percurso do computador mantém o panorama/marcação existentes.
- Formulários de criação e marcação numa coluna, campos com tamanho adequado e painéis com altura limitada ao ecrã.
- Processo do doente numa coluna, opções secundárias expansíveis e acesso às consultas, documentos e editor existentes.
- Aviso antes de fechar ou abandonar uma consulta com alterações por guardar. O aviso abrange HDA, diagnósticos, tratamentos, objetivos e frequência/sessões. Não guarda dados clínicos no armazenamento do navegador.
- PDFs existentes do processo e da agenda abrem uma pré-visualização antes de partilhar. Os relatórios gerados que usam `openAndDownloadPdf` usam o mesmo percurso no telemóvel.
- O ficheiro é preparado em memória através do acesso autenticado existente. Um segundo toque em Partilhar chama a partilha nativa, permitindo escolher aplicação e destinatário. Cancelamentos não são apresentados como envios. Existe alternativa por descarga.
- A preparação de vários PDFs na agenda também oferece a partilha nativa quando disponível.
- Regras de ecrã: até 767 px; em dispositivos táteis, também até 1023 px para utilização horizontal. Estilos de impressão preservados.

## Validação realizada

Teste de navegador automatizado com chamadas externas bloqueadas, backend inteiramente simulado e dados fictícios:

- Agenda sem overflow horizontal a 320, 375, 390, 430 e 767 px; navegação móvel em 844 px horizontal.
- Mais abre/fecha e não apresenta Gestão a um perfil médico sem essa permissão.
- Formulário de novo doente; validação; pesquisa de duplicados; chamada real da função de criação com a clínica correta; abertura do processo.
- Pesquisa pelo módulo existente e seleção do resultado no telemóvel.
- Carregamento da página clínica real, edição no Quill, gravação do texto no pedido simulado e limpeza do aviso após guardar.
- Cancelamento da saída mantém a consulta aberta. A navegação inferior respeita o bloqueio do editor dentro do iframe.
- PDF obtido apenas após pedido explícito; partilha só após segundo toque; recusa de acesso sem descarga; alternativa quando não existe suporte para partilha.
- Navegação lateral do computador continua visível a 1440 px e navegação móvel fica oculta.
- Nenhum erro JavaScript no percurso. Recursos externos de apresentação bloqueados pelo teste podem produzir mensagens de rede na consola.

Os 36 testes existentes de lógica, acesso ao doente e pedidos de exames/análises/PDF passaram. Os dois ficheiros de testes SQL não arrancaram na primeira execução global porque dependem de instalações PGlite fora do projeto. Não foram alterados nem foram executadas operações SQL neste trabalho.

Capturas de revisão em `tests/artifacts/iphone-*.png`.

## Reprodução dos testes móveis

O teste `tests/mobile-iphone.browser.mjs` serve apenas a cópia local, usa um perfil de navegador temporário e substitui o backend por fixtures. Não deve ser confundido com um ambiente clínico de teste.

Precisa de Playwright, Google Chrome e cópias locais de Quill 2.0.3 em `/tmp/gc-iphone-quill.js` e `/tmp/gc-iphone-quill.css`. O teste não permite chamadas de rede para serviços externos. `PLAYWRIGHT_PATH` e `CHROME_PATH` permitem usar outras instalações.

Executar a partir desta cópia: `node tests/mobile-iphone.browser.mjs`.

## Validação ainda necessária antes de considerar pronto para utilização

- Safari num iPhone real: teclado, rotação, alturas dos painéis, leitura de PDF completo e escolha de Mail/WhatsApp/AirDrop/Ficheiros.
- Sessão autorizada num ambiente de teste: pesquisa, criação, gravação, emissão e acesso a PDF com permissões reais. Os testes locais não demonstram o funcionamento integrado do servidor.
- Confirmar o comportamento com clínicas e perfis distintos. As políticas, funções de servidor e permissões não foram modificadas.
- Validar os módulos secundários consoante forem utilizados. Estarem acessíveis em Mais não significa que todos tenham sido redesenhados para telemóvel.
- Qualquer publicação exige autorização expressa do utilizador e revisão da diferença para a versão que estiver então em produção.

## Pré-visualização privada autorizada — 24 outubro 2026

Foi disponibilizado um site separado, privado e com dados fictícios:
https://gc-iphone-teste-privado.dr-joao-morais.chatgpt.site

- Sites: `appgprj_6adcc837accc8191ac0eb1bb0d61a6ae`; acesso custom limitado à conta proprietária, sem visitantes externos.
- Código da pré-visualização em `/Users/joaomorais/Documents/Codex/gc-iphone-preview-20261024`.
- Commit do repositório de teste: `928d194a774fb928055d5351939a1c80693225e1`.
- Publicação privada confirmada: `appgdep_6adcc9506d74819197b827985cbeac31`, succeeded.
- Os ecrãs usam os módulos adaptados, mas a inicialização e a base de dados foram substituídas por fixtures em memória. Os dados fictícios reiniciam ao recarregar a página principal.
- PDF estático de demonstração, sem validade clínica. Serve para testar a abertura, a descarga e a partilha; não reproduz o texto escrito na consulta fictícia.
- Teste de navegador confirmou agenda, pesquisa/processo, criação, gravação fictícia e PDF sem pedidos aos serviços clínicos reais.
- Não houve publicação no GC real, push para o repositório GC nem alterações à base de dados de produção.

## Preparação da publicação no GC real

- Base `44c35b45a396ad42d87f87d87d7e206b78b0a487` novamente confirmada contra origin/main antes da publicação.
- Entradas app/main/boot e módulos principais versionados para evitar mistura com a interface antiga em cache.
- Corrigida a comparação da seleção de clínica durante pesquisas concorrentes, incluindo Todas.
- A falha dos nomes no site de teste era exclusiva das fixtures: faltava `is_active: true`. Foi corrigida na pré-visualização e foi acrescentada uma asserção dos três nomes. O filtro de doentes ativos em produção foi preservado.
- O teste móvel do GC também verifica o nome através do renderizador real da agenda.
- Apenas os ficheiros funcionais são publicados no GC. O backend fictício, os nomes de exemplo e o PDF de demonstração não integram a alteração de produção.
