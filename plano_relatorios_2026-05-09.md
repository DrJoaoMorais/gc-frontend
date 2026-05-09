# Plano de Implementação — Módulo Relatórios

**Data:** 2026-05-09
**Estado:** Fase 0 concluída

## Decisões tomadas

1. Novo módulo modules/relatorios/ separado do doente.js
2. 6 tipos de relatório: PRP (3 indicações), Viscossuplementação, Junta Médica, Atestado Ed. Física, Atestado Doença, Relatório Simples
3. Caminho híbrido para templates:
   - Simples (PRP, Visco, Atestados, Simples) → tabela document_templates
   - Complexos (Junta Médica) → código JS
4. Persistência: guardar PDF + metadados em documents (Opção B)
5. Schema: adicionar coluna category em document_templates e template_id em documents
6. Junta Médica lê de exame_objectivo, consultations, etc. — não duplica dados

## Estado actual descoberto

- PRP hardcoded em modules/doente.js linhas 4404-6818 (~400 linhas)
- Tabela document_templates existe mas está VAZIA
- Tabela documents está em uso (versioning, storage_path)
- Inconsistência: Tendinopatia tem modal próprio, Osteoartrose e Rotura são inline

## Plano de fases

- Fase 0: Preparação ✅ (concluída 2026-05-09)
- Fase 1: Esqueleto modules/relatorios/ + Relatório Simples
- Fase 2: Migrar PRP existente para o novo módulo
- Fase 3: Migrar Atestados existentes
- Fase 4: Viscossuplementação (novo)
- Fase 5: Junta Médica (novo, mais complexo)
- Fase 6: Limpeza do doente.js

## Princípios invioláveis

- Núcleo do doente.js (HDA Quill, Diagnóstico, Plano Terapêutico) NUNCA é tocado
- Edições cirúrgicas, nunca rescrita
- Mockup antes de mudança visual
- SQL um bloco de cada vez com confirmação
- Coexistência durante migração (não apagar antigo até novo validado)

## Próximo passo

Iniciar Fase 1: mockup do sub-menu Relatórios + criar pasta modules/relatorios/
