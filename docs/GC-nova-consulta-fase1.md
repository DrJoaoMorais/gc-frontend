# Nova Consulta — Fase 1: Fundações BD (2026-06-11)

## Decisões canónicas
- **Três datas, três campos:**
  - `consultation_assessments.assessment_date` = data em que o exame foi medido
  - `consultations.report_date` = data da consulta (automática = hoje; retroactiva = data passada)
  - `consultations.issued_date` (NOVA, nullable) = data de emissão do PDF; NULL → usa report_date
- **Consulta retroactiva** = registo normal em `consultations` com `report_date` no passado
  e `appointment_id = NULL`. Badge "retroactiva" no feed (derivado, sem coluna nova).
- **Caso Cintramedica**: doente É criado em `patients`; o que não existe é agenda/agendamento.
- **ICD-10**: sem schema novo — inserir linhas em `diagnoses_catalog` com `system = 'icd10'`.
  Catálogo actual: 126 entradas com `system = 'local'`.
- **Comparativo/Evolução**: nunca gravado em duplicado — calculado no render pelo cc-feed.js
  a partir de `consultation_assessments` ordenados por `assessment_date`.

## Migrações aplicadas
1. `add_issued_date_to_consultations` — coluna `issued_date date NULL` + comments de semântica
2. `fix_consultation_diagnoses_insert_policy` — INSERT fechado com `has_clinic_role`
   (estava `with_check = true`, aberto a qualquer autenticado)

## Verificado, sem alterações
- RLS não depende de `appointment_id` → retroactivas passam (78/296 consultas já sem agenda)
- `consultation_treatments` sem policy UPDATE → padrão delete+insert (decidir no Bloco 6)
- `consultation_protocols.protocol_date` e `consultation_id` nullable → protocolos retroactivos prontos

## Pendente de teste manual
- Gravar 1 diagnóstico no fluxo actual do doente.js (confirmar que o fix RLS não partiu nada)

Depois do `git add docs/GC-nova-consulta-fase1.md && git commit -m "docs: decisões Fase 1 Nova Consulta" && git push`, a Fase 1 está fechada.

---

## Fase 2 — fechada 2026-06-11

### Entregues
- **Test page** `modules/consulta/v2/nova-consulta/nova-consulta.test.html` criada e funcional
  em produção (ES6 modules; URL: `https://gc.joaomorais.pt/…/nova-consulta.test.html`).
- **`nc-queries.js`** — `carregarFeedDoente(patientId)`: 6 queries em 2 rounds de `Promise.all`
  (~2 RTTs); devolve `{ consultas, examesAvulsos }` onde `examesAvulsos` é `Map<assessment_date, []>`
  para assessments com `consultation_id = NULL`.
- **Feed do histórico** com:
  - `truncarHDA`: corta exibição no marcador `"EXAME OBJECTIVO ──"` do fluxo antigo; link toggle
    "ver texto original completo" — dados na BD intactos.
  - Protocolo em leitura compacta: chips + lista de objectivos da fase; sem editor (checkboxes /
    inputs / "Guardar objectivos").
  - Botão "▾ colapsar" por card; colapsado mostra chips de resumo (EVA, fase, dx, nº tratamentos).
  - Contentor alargado para `max-width: 1500px`.
  - Tabelas (dinamometria, ROM) limitadas a `max-width: 750px`; pills/chips mantêm largura total.

### Pendentes (Fase 3+)
- Render dos `examesAvulsos` (assessments retroactivos sem consulta associada).
- Tabelas do exame em 2 níveis: compacto (linha por movimento) vs. item-a-item — **verificar
  se o JSON em `consultation_assessments.data` guarda respostas por item ou só totais**.
- Render bonito do ombro (substituir o render genérico actual por layout visual).
- Botão "Iniciar Consulta" em `doente.js` que abre a nova-consulta — **fica para o FIM do projecto**
  (integração só depois de todos os blocos de escrita estarem validados).
