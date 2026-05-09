# Plano de Implementação — Módulo Relatórios

**Data:** 2026-05-09
**Estado:** Fase 1 CONCLUÍDA ✅

---

## Decisões tomadas

1. Novo módulo modules/relatorios/ separado do doente.js
2. 6 tipos de relatório: PRP (3 indicações), Viscossuplementação, Junta Médica, Atestado Ed. Física, Atestado Doença, Relatório Simples
3. Caminho híbrido para templates:
   - Simples (PRP, Visco, Atestados, Simples) → tabela document_templates
   - Complexos (Junta Médica) → código JS
4. Persistência: guardar PDF + metadados em documents (Opção B)
5. Schema:
   - document_templates ganhou coluna `category` (text, nullable)
   - documents ganhou coluna `template_id` (uuid, FK opcional)
   - documents ganhou coluna `category` (text, nullable) — adicionada DURANTE Fase 1 quando descobrimos que faltava
6. Junta Médica lê de exame_objectivo, consultations, etc. — não duplica dados
7. Exame Neurológico fica protegido no sítio onde está (não é tocado)

## Estado actual descoberto

- PRP hardcoded em modules/doente.js linhas 4404-6818 (~400 linhas)
- Tabela document_templates existe mas está VAZIA
- Tabela documents está em uso (versioning, storage_path)
- PDF gerado por Cloudflare Worker (gc-pdf-proxy.dr-joao-morais.workers.dev) com Puppeteer
- Worker requer Bearer token (PDF_TOKEN) e tem CORS restrito a gc.joaomorais.pt (não permite localhost)

## Plano de fases

- Fase 0: Preparação ✅ (concluída 2026-05-09)
- Fase 1: Esqueleto modules/relatorios/ + Relatório Simples ✅ (concluída 2026-05-09)
- Fase 2: Migrar PRP existente para o novo módulo
- Fase 3: Migrar Atestados existentes
- Fase 4: Viscossuplementação (novo)
- Fase 5: Junta Médica (novo, mais complexo)
- Fase 6: Limpeza do doente.js

## Fase 1 — o que foi feito

### Edições cirúrgicas em modules/doente.js (3)
- Linha ~2100: insertDocumentRow aceita category e template_id (defaults null)
- Linha ~4420: novo grupo "Outros" com "📄 Relatório Simples" no array groups
- Linha ~4597: intercept para relatorio_simples antes dos blocos PRP, com callback onSuccess que faz loadDocuments() + render()

### Ficheiros novos criados
- modules/relatorios/relatorios.js (ponto de entrada)
- modules/relatorios/relatorio-simples.js (Quill em branco + cabeçalho/rodapé clínico, gera PDF, guarda em documents com category='simples')

### main.js
- Adicionado import "./modules/relatorios/relatorios.js"

### SQL aditivo (Supabase)
- ALTER TABLE document_templates ADD COLUMN category text
- ALTER TABLE documents ADD COLUMN template_id uuid REFERENCES document_templates(id)
- ALTER TABLE documents ADD COLUMN category text (esta foi adicionada DURANTE a Fase 1, não estava no plano original)

### Commit
- 828d2b2: feat(relatorios): Fase 1 — esqueleto + Relatório Simples
- 5 ficheiros, 287 inserções, 1 remoção
- Push para origin/main feito, deploy Cloudflare Pages a correr

### Validação em produção
- ✅ Sistema base funciona (PRP, Atestados, Neurológico intactos)
- ✅ Menu Relatórios mostra novo grupo "Outros" com "Relatório Simples"
- ✅ Modal abre com título auto-preenchido + Quill em branco
- ✅ Editor permite escrita e formatação (B, I, U, listas, tamanho)
- ✅ Botão "Gerar PDF" funciona
- ✅ PDF é gerado pelo Worker e guardado no Storage
- ✅ Documento aparece na timeline da consulta como "Relatório Médico (vN)"
- ✅ Categoria 'simples' guardada em documents.category

## Princípios invioláveis (manter em todas as fases)

- Núcleo do doente.js (HDA Quill, Diagnóstico, Plano Terapêutico — linhas ~413, 1064, 1209, 1408, 1691, 1762-1808, 2413-2575) NUNCA é tocado
- Edições cirúrgicas, nunca rescrita
- Mockup antes de mudança visual
- SQL um bloco de cada vez com confirmação
- Coexistência durante migração (não apagar antigo até novo validado)
- Exame Neurológico é PROTEGIDO (trabalho de dias, fica onde está)

## Pendências / Lixo a limpar

- PDF órfão no Storage do Supabase (gerado em ~2026-05-09 11:46, primeiro teste antes de adicionar coluna category) — apagar manualmente do bucket documents quando houver oportunidade
- Erro pré-existente no console: GET consent_tokens 400 Bad Request — não é da Fase 1, investigar noutra sessão
- Considerar mover Exame Neurológico de Relatórios → Exame Objectivo (sessão futura, baixa prioridade)

## Próxima sessão — Fase 2

Migrar os 3 templates PRP (Tendinopatia, Osteoartrose, Rotura Muscular) das linhas 4404-6818 do doente.js para:
- Inserir HTML como registos em document_templates (com category respectivo)
- Criar modules/relatorios/prp/tendinopatia.js, osteoartrose.js, rotura-muscular.js
- Validar que o resultado é igual ao actual antes de remover do doente.js
- Coexistência: código antigo não é apagado até o novo estar validado em produção
