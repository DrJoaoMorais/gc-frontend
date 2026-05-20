# Pendências — Passo 3 (Refactor Relatórios v2)

Registo de descobertas e melhorias adiadas durante o Passo 3,
para não bloquear o avanço.

---

## ⚠️ Dinamometria AF2 — campos não capturados pelo parser actual

### Pendência 1 — Tempo até à Força Máxima

**Estado:** o parser AF2 (linha 805 de `modules/obj/ombro.html`) **não extrai** o "Tempo até a Força Máxima", apesar de essa informação existir no texto bruto exportado pelo dinamómetro.

**Formato no texto bruto AF2:**

    Tempo até a Força Máxima
      Esquerda: 2.22 s
      Direita: 2.09 s
      Diferença de tempo: R -0.13 s

**Significado clínico:**
- Tempo de pico / Rate of Force Development implícito
- Indicador de explosividade muscular
- Útil em Medicina Desportiva e reabilitação pós-cirúrgica
- Tempos longos (>2s) podem sugerir fadiga, inibição neuromuscular ou défice de activação rápida

**Acção futura:**
1. Estender o parser AF2 para capturar tempos
2. Adicionar campos `te` (tempo esquerda) e `td` (tempo direita) à estrutura `data.dyn.{movimento}`
3. Adicionar coluna(s) à tabela renderizada por `dinamometria-table.js`

---

### Pendência 2 — Relação Força-Peso

**Estado:** o parser AF2 **já tem** os campos `fpe` (força-peso esquerda) e `fpd` (força-peso direita) na estrutura `data.dyn`, mas **não os estamos a usar** no relatório.

**Formato no texto bruto AF2:**

    Relação Força-Peso
      Esquerda: XX.X %
      Direita: YY.Y %

**Significado clínico:**
- Normalização da força pelo peso corporal
- Permite comparação entre doentes
- Permite comparação com normativos populacionais e dados de atletas
- Particularmente útil em Medicina Desportiva

**Acção futura:**
1. Verificar quando o AF2 fornece esta linha (depende do peso estar registado no perfil do doente no AF2)
2. Adicionar coluna "F/Peso %" à tabela de dinamometria
3. Considerar interpretação por escalões

---

## ⚠️ Parser AF2 — generalização

### Pendência 3 — Extrair parser para módulo partilhado

**Estado:** o parser AF2 está embutido em `modules/obj/ombro.html` (linha 805). Só conhece "Ombro" e seus movimentos.

**Descoberta confirmada 2026-05-20 (teste em anca):**
- O software AF2 usa **português brasileiro** (PT-BR)
- A anca é referida como **"Quadril"** no texto exportado
- O parser actual rejeita estes blocos por não reconhecer "Quadril"

**Mapeamento PT-BR → PT-PT confirmado até agora:**

| AF2 (PT-BR) | Relatório (PT-PT) | Estado |
|---|---|---|
| Ombro | Ombro | ✅ implementado |
| Quadril | Anca | confirmado 2026-05-20 |

**Acção futura (quando construirmos o segundo `obj/*.html`):**
1. Extrair o parser AF2 para `modules/relatorios/v2/_utils/parse-af2.js`
2. Aceitar parâmetro `regiao` para mapear PT-BR → PT-PT
3. Confirmar nomenclatura à medida que cada região é implementada (uma de cada vez)

---

## 📝 Notas clínicas sobre dinamometria por região

### Coluna Lombar
Dr. João Morais decidiu **não fazer dinamometria** lombar.
Razão: dificuldade técnica + interpretação clínica ambígua (défice de força pode reflectir dor protectora, não fraqueza real).

### Coluna Cervical
Decisão pendente — **provavelmente evitar**.
Tecnicamente possível, mas interpretação clínica complexa. A decidir caso a caso quando o módulo for construído.

---

## 📅 Registo

Documento criado durante o Passo 3, micro-passo 3.4 → 3.5
(2026-05-20).

Filosofia do projecto reafirmada:
**"Uma região de cada vez. Cada uma tem a sua particularidade.
 Mesmo modelo arquitectural, particularidades clínicas próprias."**
