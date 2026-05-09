# Bugs descobertos durante refactor PRP — 2026-05-09

## BUG-001: Tabela patient_documents não existe

**Descoberto em:** captura âncora do Relatório Neurológico (PASSO I.3 do
refactor PRP)

**Sintoma:** Ao gerar Relatório Neurológico, consola mostra:
- POST .../patient_documents?on_conflict=patient_id,doc_type 404 Not Found
- Mensagem: "Could not find the table 'public.patient_documents'"
- Erro logado em doente.js:6556 "Erro ao guardar relatório neurológico"

**Localização do código:** doente.js, função `onNeuroMessage` (~linha 6545–6560).
A função é um listener de `window.postMessage` que recebe dados do iframe do
Relatório Neurológico (tipo `gc_neuro_save`) e tenta fazer upsert em
`patient_documents`. É chamada APENAS pelo Neurológico — nenhum outro relatório
usa esta tabela.

**Código problemático (doente.js ~linha 6548):**
```js
const { error } = await window.sb
  .from("patient_documents")
  .upsert({
    patient_id: p?.id,
    doc_type: "relatorio_neurologico",
    content: JSON.stringify(payload.data),
    updated_at: payload.ts
  }, { onConflict: "patient_id,doc_type" });
```

**Investigação via MCP Supabase (2026-05-09):**

Tabela `patient_documents` — **NÃO EXISTE** no schema public.

Tabelas com prefixo `patient_*` que existem:
- `patient_clinic`
- `patient_feed`
- `patient_uploads`
- `patients`

Registos acidentalmente criados hoje (09-05-2026) no perfil de teste
(João Miguel Guerreiro de Morais, id: 163fe5dc-...):
- `documents`: **zero registos** — nada foi gravado por engano.
- `consultations`: **zero registos** — nada foi gravado por engano.

**Impacto:** O Relatório Neurológico funciona visualmente (iframe abre,
dados preenchidos, PDF exportável localmente), mas o conteúdo NÃO é
persistido na base de dados. Cada vez que o utilizador abre o relatório,
começa do zero.

**Estado:** A investigar. NÃO corrigir agora — refactor PRP em curso.
Documentar e voltar a este bug depois do refactor estar validado em produção.

**Opções de resolução a avaliar (futura sessão):**
1. Criar tabela `patient_documents` com colunas (patient_id, doc_type, content,
   updated_at) — mantém a lógica actual
2. Reutilizar a tabela `documents` (já existente, com html + category) —
   mais consistente com a arquitectura do módulo Relatórios
3. Avaliar se a tabela `patient_uploads` pode ser reutilizada
