# Auditoria de Segurança e Qualidade — gc.joaomorais.pt
**Data:** 2026-04-02  
**Auditor:** Claude Code (claude-sonnet-4-6)  
**Repositório:** gc-frontend / main

---

## Resumo Executivo

Sistema clínico multi-clínica (Supabase + ES6 modules + Cloudflare Pages) com **risco geral MÉDIO-ALTO**. Os principais vetores de risco são: isolamento multi-clínica dependente exclusivamente de RLS (sem validação adicional no frontend), race conditions em transferências de doentes, e console.logs com dados clínicos sensíveis em produção. Não foram encontrados segredos críticos (service_role key) hardcoded. A estrutura de autenticação (MFA, session timeout, onAuthStateChange) existe mas tem lacunas. Recomenda-se auditoria das RLS policies como prioridade absoluta.

---

## Tabela Principal de Problemas

| # | Problema | Ficheiro | Gravidade | Recomendação |
|---|----------|----------|-----------|--------------|
| 1 | Chave anon Supabase hardcoded no frontend público | `login.js:3-5`, `app.html:18-24` | CRÍTICO | Confirmar RLS ativo em 100% das tabelas; a anon key é esperada, mas sem RLS é fatal |
| 2 | URLs dos Workers Cloudflare expostas como constantes globais | `main.js:120`, `config.js:9`, `gestaoagenda.js:10` | CRÍTICO | Implementar autenticação Bearer token nos Workers |
| 3 | Queries sem filtro `clinic_id` — isolamento multi-clínica frágil | `db.js:78-79`, `agenda.js:1669` | CRÍTICO | Adicionar `.eq("clinic_id", clinicId)` a todas as queries; validar ownership no backend |
| 4 | RPC `search_patients_v2` aceita `clinic_id=null` devolvendo todos os doentes | `db.js:186-198` | CRÍTICO | RPC deve validar que `p_clinic_id` pertence ao utilizador autenticado |
| 5 | UPDATE de appointments sem filtro `clinic_id` — IDOR possível | `agenda.js:219-249` | CRÍTICO | RLS policy deve bloquear; adicionar `.eq("clinic_id", ...)` no frontend |
| 6 | fetchPatientById sem `clinic_id` filter | `db.js:287-299` | CRÍTICO | RLS deve bloquear; adicionar filtro defensivo |
| 7 | Storage de documentos sem clinic_id access control | `consentimentos.js:12-13` | CRÍTICO | Implementar Supabase Storage policies por `clinic_id` |
| 8 | console.log com dados de doentes em produção | `app.js:2115, 5590-5591, 5871` | IMPORTANTE | Remover ou substituir por `console.debug` com flag de dev |
| 9 | Timeout de inatividade a 30 min (demasiado longo para contexto clínico) | `auth.js:151` | IMPORTANTE | Reduzir para 10 min + aviso visual nos últimos 2 min |
| 10 | `clinic_id` passado via user input sem validação de ownership | `agenda.js:1669` | IMPORTANTE | Whitelist contra `window.__GC_MY_CLINIC_IDS__` |
| 11 | Race condition em transferência de doente entre clínicas | `db.js:204-254` | IMPORTANTE | Usar RPC transacional no backend em vez de lógica no frontend |
| 12 | `onAuthStateChange` sem `.catch()` | `boot.js:63-77` | IMPORTANTE | Adicionar handler de erro + fallback para redirect de login |
| 13 | Re-autenticação ausente antes de alterações de permissões | `gestao.js` | IMPORTANTE | Re-prompt MFA antes de alterações de roles/admin |
| 14 | Overlapping de bloqueios na agenda não verificado | `gestaoagenda.js:232-282` | IMPORTANTE | Adicionar CHECK constraint de não-sobreposição no backend |
| 15 | Trigger `trg_auto_registo_financeiro` pode gerar duplicados | `financas.js:189-211` | IMPORTANTE | Verificar/criar UNIQUE constraint em `(patient_id, appointment_id)` |
| 16 | Variáveis Mustache sem substituto geram PDFs com `{{placeholder}}` | `doente.js` (templates PDF) | IMPORTANTE | Validar 100% das variáveis antes de renderizar PDF |
| 17 | Validade de 24h dos tokens de consentimento só validada no frontend | `consentimentos.js:53-72` | IMPORTANTE | RPC deve filtrar `WHERE created_at > NOW() - INTERVAL '24 hours'` |
| 18 | `stripe_payment_intent_id` e `status` atualizados em dois UPDATEs separados | `doente.js` (exame desportivo) | IMPORTANTE | UPDATE único com `WHERE stripe_payment_intent_id = old_value` |
| 19 | Discount codes sem controlo de utilização única | presumível em exame_desportivo | IMPORTANTE | Coluna `used_by_patient_ids` + constraint `max_uses` |
| 20 | Sem validação de input em formulários clínicos antes de INSERT | `doente.js` (geral) | MELHORIA | Validação client-side + RPC server-side |
| 21 | Magic strings em toda a aplicação (`"medico"`, `"admin"`, `"scheduled"`) | global | MELHORIA | Constantes centralizadas (ou TypeScript enums a longo prazo) |
| 22 | Sem tabela de audit log | global | MELHORIA | Tabela `audit_logs(user_id, table, op, old, new, ts)` + triggers |
| 23 | `innerHTML` com dados de pacientes sem escaping consistente | `consentimentos.js:103` | MELHORIA | Usar `textContent` onde possível; garantir `escH()` em todos os pontos |
| 24 | console.log de URLs assinadas do Google Calendar / GCAL sync | `app.js:6539, 6542` | MELHORIA | Remover ou proteger atrás de flag de debug |

---

## Segurança

### CRÍTICO

**C1 — Isolamento multi-clínica dependente apenas de RLS**  
O frontend faz queries com `clinic_id` passado como parâmetro mas não valida que esse ID pertence ao utilizador autenticado. Se uma RLS policy estiver em falta ou mal configurada, um utilizador consegue aceder a dados de qualquer clínica. Verificar imediatamente as policies de `appointments`, `patients`, `patient_clinic`, `financial_records` e `consent_tokens`.

**C2 — RPC `search_patients_v2` aceita `null` como clinic_id**  
`db.js:186`: `p_clinic_id: clinicId || null` — Se `clinicId` não estiver definido, a RPC pode devolver todos os doentes do sistema. A RPC deve rejeitar `null` ou validar contra os clinics do utilizador autenticado.

**C3 — Workers Cloudflare sem autenticação documentada**  
Os endpoints `gc-gcal` e `gc-pdf-proxy` estão expostos como constantes. Se não tiverem autenticação Bearer robusta, permitem geração de PDFs clínicos arbitrários.

### IMPORTANTE

**S1 — onAuthStateChange sem tratamento de erro (`boot.js:63`)**  
Se o listener falhar silenciosamente, a app continua com sessão inválida sem redirecionar para login.

**S2 — Timeout de 30 minutos em ambiente clínico**  
Uma sessão aberta no consultório durante 30 minutos sem interação é risco de exposição de dados a terceiros. Reduzir para 10 min com aviso nos últimos 2 min.

**S3 — Re-autenticação em operações críticas**  
Alterações de roles e adição de administradores não requerem re-prompt de password/MFA.

---

## Bugs Funcionais

**B1 — Race condition em transferência de doentes (`db.js:204-254`)**  
A lógica de transferência usa múltiplas operações assíncronas no frontend. Se a ligação cair a meio, o doente pode ficar ativo em duas clínicas simultaneamente. Solução: mover para uma RPC com transação SQL.

**B2 — Overlapping de bloqueios de agenda (`gestaoagenda.js:232`)**  
Não existe verificação de sobreposição antes de inserir um bloqueio. Dois bloqueios com horários sobrepostos podem ser criados simultaneamente.

**B3 — Duplicados em registos financeiros (`financas.js:189`)**  
O trigger de auto-registo pode disparar mais de uma vez sem UNIQUE constraint. Confirmar que `(patient_id, appointment_id)` tem constraint única.

**B4 — PDFs com placeholders não substituídos (`doente.js`)**  
Templates Mustache sem validação prévia das variáveis podem gerar documentos clínicos assinados com campos em branco ou com `{{variavel}}` visível.

---

## Performance e Consistência

**P1 — `app.js` com 10.008 linhas (monolítico legado)**  
Dificulta manutenção e aumenta tempo de parse no browser. Migração para módulos ES6 em curso — continuar.

**P2 — Sem paginação visível em listas de doentes**  
`search_patients_v2` tem `p_limit` mas sem cursor/offset para paginação eficiente em bases com muitos doentes.

**P3 — Tokens de consentimento expirados não são limpos**  
Sem evidência de job de limpeza de `consent_tokens` com `created_at < NOW() - INTERVAL '24 hours'`. Acumulação indefinida.

---

## Quick Wins (menos de 30 minutos cada)

- [ ] **Remover console.logs sensíveis** — `app.js:2115, 5590-5591, 5871` (15 min)
- [ ] **Reduzir IDLE_MS de 30 para 10 minutos** — `auth.js:151` (5 min)
- [ ] **Adicionar `.catch()` ao onAuthStateChange** — `boot.js:63` (10 min)
- [ ] **Confirmar RLS ativo** — Verificar no Supabase dashboard todas as tabelas com dados clínicos (20 min)
- [ ] **Centralizar magic strings** em `modules/constants.js` — roles, statuses, modes (25 min)
- [ ] **Adicionar `clinic_id` filter em `fetchPatientById`** — `db.js:287` (10 min)
- [ ] **Rejeitar `p_clinic_id = null` na RPC `search_patients_v2`** — uma linha de SQL (10 min)
- [ ] **Adicionar validação de Mustache antes de renderizar PDF** — `doente.js` (20 min)

---

## Itens que Requerem Alterações de Schema Supabase

| Tabela | Alteração Necessária | Motivo |
|--------|----------------------|--------|
| `appointments` | CHECK CONSTRAINT de não-sobreposição de bloqueios | Bug B2 |
| `financial_records` | UNIQUE (patient_id, appointment_id) | Bug B3 |
| `consent_tokens` | Cron job ou trigger de limpeza (TTL 24h) | Performance P3 |
| `discount_codes` | Coluna `max_uses INT`, `used_count INT`, UNIQUE por `(code, patient_id)` | Item 19 |
| `audit_logs` | Nova tabela: `(id, user_id, table_name, operation, old_value JSONB, new_value JSONB, created_at)` | Item 22 |
| `exames_desportivos` | Merge UPDATE de `stripe_payment_intent_id` + `status` numa única operação atómica | Item 18 |
| `consent_tokens` | Validação de expiração na RPC (não só no frontend) | Item 17 |

---

## Inventário de Ficheiros

| Ficheiro | Linhas | Função |
|----------|--------|--------|
| `app.js` | 10.008 | Monolítico legado |
| `modules/doente.js` | 8.797 | Gestão de doentes e PDFs |
| `modules/agenda.js` | 2.831 | Calendário e marcações |
| `modules/financas.js` | 1.864 | Gestão financeira |
| `modules/gestaoagenda.js` | 1.267 | Timeline de slots |
| `modules/gestao.js` | 1.131 | Utilizadores/clínicas |
| `modules/analises.js` | 853 | Catálogo de análises |
| `modules/exames.js` | 815 | Catálogo de exames |
| `modules/consentimentos.js` | 815 | Assinaturas digitais |
| `modules/auth.js` | 726 | Autenticação e MFA |
| `modules/session.js` | 468 | Gestão de sessão |
| `modules/db.js` | 333 | Queries Supabase |
| `modules/shell.js` | 311 | Render HTML |
| `modules/boot.js` | 310 | Bootstrap |
| `modules/pesquisa.js` | 213 | Pesquisa rápida |
| `modules/helpers.js` | 170 | Utilitários |
| `modules/state.js` | 78 | Estado global |
| `modules/ui.js` | 54 | Constantes UI |
| `modules/config.js` | 18 | Configuração |
| `main.js` | 220 | Entry point ES6 |

---

*Gerado automaticamente por Claude Code — auditoria estática sem acesso ao Supabase dashboard ou às RLS policies reais. Recomenda-se validação manual das policies no Supabase.*
