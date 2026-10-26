# Testes da biblioteca de protocolos

Sem acesso à produção. O teste SQL usa PostgreSQL em memória (PGlite).

1. Instalar `@electric-sql/pglite` num diretório de teste externo.
2. Executar `versioning.test.mjs` nesse ambiente, passando o caminho absoluto da migração inicial como primeiro argumento e da migração de correção como segundo argumento.
3. Executar `editor.test.mjs`, passando o caminho absoluto de `protocolo-editor.js`.

Cobertura: autorização, rollback integral, clonagem de fases, preservação de metadados, consultas e prescrições antigas, versões desatualizadas, critérios mensuráveis, IDs e intervalos temporais.
