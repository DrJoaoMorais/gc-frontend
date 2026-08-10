# Especificação — Perfis de zonas de treino por modalidade

Documento de trabalho para a próxima sessão de implementação. Não é código — é o guião a seguir, fase a fase. Cada fase deve ser tratada como uma funcionalidade própria (esquema de dados + formulário + validação + compatibilidade), não como uma tarefa de tarde.

Data deste documento: 10 de agosto de 2026.

## Contexto — porque isto muda

Hoje o perfil de frequência cardíaca de um doente é um único conjunto plano de campos:

- `patient.hr_zones_bpm` — zonas Z1–Z5 em bpm, sem modalidade associada.
- `patient.hr_zone_formula` — `'tanaka'` (208 − 0,7×idade) ou `'fox'` (220 − idade), usada em `calcFcMaxFormula()` e `bpmRangeParaZona()` (`prescricao.js`).

Isto não chega para prescrever corrida, ciclismo e natação com rigor: a FC, os limiares e as zonas diferem por modalidade, e cada modalidade tem métodos de referência diferentes (FC, ritmo, potência, manual). A fórmula "Fox" (220−idade) é, além disso, a fórmula mais antiga e menos precisa disponível — foi precisamente para a substituir que Tanaka publicou a sua fórmula em 2001. Sai da lista de opções.

Regra transversal a todas as fases: em doentes medicados com betabloqueante, com incompetência cronotrópica, arritmia ou pacemaker, nenhuma fórmula de FC máxima é uma base segura — prevalece sempre teste medido, RPE e sintomas.

## Fase 0 — Auditoria e modelo de dados

Antes de qualquer alteração de esquema:

1. **Localizar todos os usos** de `hr_zones_bpm` e `hr_zone_formula` — já confirmados em `prescricao.js`: `calcFcMaxFormula()`, `bpmRangeParaZona()`, e o campo `p.hr_zone_formula || 'tanaka'` lido em `carregarPlanoActivoSeExistir()`-adjacent code. Falta rever o resto do sistema (ficha do doente, formulários fora desta pasta) — não auditado nesta sessão, fica para o início da Fase 0.
2. **Confirmar por query real à base de dados** — não por inspecção visual — se algum doente tem `hr_zones_bpm` ou `hr_zone_formula` com dados reais preenchidos. Exemplo de ponto de partida:
   ```sql
   select id, full_name, hr_zone_formula, hr_zones_bpm
   from patients
   where hr_zone_formula is not null or hr_zones_bpm is not null;
   ```
   Este é o único ponto de todo o plano com risco real de perda de dados clínicos — todas as fases seguintes são aditivas (campos novos). Corre isto antes de decidir fosse o que for sobre os campos antigos.
3. **Rever tabelas, formulários, funções e a página do doente** que toquem nestes campos.
4. **Remover a fórmula "Fox"** das opções — fica só Tanaka (ambos os sexos) e Gulati (mulheres assintomáticas, ver Fase 1).
5. **Não eliminar os campos antigos imediatamente**, mesmo que a auditoria confirme que estão vazios — deixá-los por usar durante algumas semanas antes de os apagar de vez (custo zero, evita surpresas tardias).
6. **Criar perfis separados por modalidade e método** — a nova estrutura de dados central desta fase.
7. **Garantir que os planos de exercício existentes continuam a abrir** — a compatibilidade que importa é com `wo_prescriptions.data` (sessões já gravadas), não com zonas de FC, que ainda não têm uso clínico confirmado.

## Fase 1 — Corrida

**Métodos disponíveis:** FC medida, FC estimada, ritmo, manual.

**FC — teste preferencial:** prova de esforço cardiorrespiratória em tapete, com análise de gases. O relatório deve fornecer FC de repouso, FC máxima medida, VT1, VT2, ritmo/velocidade em VT1 e VT2, VO₂pico, e limitações clínicas relevantes. Prescrição por VT1/VT2 é mais fisiológica do que percentagem fixa da FC máxima.

**FC — sem teste (estimativa):**
- Tanaka, ambos os sexos: `FCmáx = 208 − 0,7 × idade`
- Gulati, mulheres assintomáticas: `FCmáx = 206 − 0,88 × idade`
- Identificar sempre como "zona estimada", nunca como "zona medida".
- Reserva de FC (Karvonen): `FC de reserva = FCmáx − FC de repouso`; `FC-alvo = FC de repouso + percentagem × FC de reserva`.

**Zonas (modelo tradicional, 5 zonas):**

| Zona | Nome | Descrição |
|---|---|---|
| Z1 | Recuperação | Corrida muito lenta ou caminhada activa (regeneração) |
| Z2 | Endurance / Corrida leve | Zona fundamental, ~80% do tempo de treino (base aeróbica) |
| Z3 | Tempo / Limiar aeróbico | Ritmo moderadamente duro (maratona/meia-maratona) |
| Z4 | Limiar anaeróbico / Lactato | Esforço duro, sustentável 30–60 min (ritmo de 10k) |
| Z5 | VO₂ Max / Cap. anaeróbica | Tiros curtos e intensos (200m–1000m), sprints máximos |

Correspondência aproximada em % da reserva de FC: Z1 50–59%, Z2 60–69%, Z3 70–79%, Z4 80–89%, Z5 90–100%.

**Ritmo — teste preferencial:** o mesmo teste em tapete (dá directamente velocidade/ritmo em VT1/VT2). Alternativa de campo para corredores treinados: contrarrelógio máximo de 30 minutos, registar distância/ritmo médio/FC média, confirmar depois pela resposta ao treino.

**Regra de conversão obrigatória** — percentagens aplicam-se sempre à velocidade, nunca directamente ao ritmo em min/km (ritmos mais rápidos têm números menores — aplicar a percentagem directamente ao valor inverteria a relação):
```
Velocidade (km/h) = 60 ÷ ritmo (min/km)
Ritmo (min/km) = 60 ÷ velocidade (km/h)
```

**Manual:** permitir escrever directamente intervalos por zona, ex.:
```
Z1: 7:00–6:30 min/km
Z2: 6:29–5:55 min/km
Z3: 5:54–5:20 min/km
Z4: 5:19–4:50 min/km
Z5: 4:49–3:50 min/km
```
Validação obrigatória: como ritmos mais rápidos têm números menores, o formulário tem de validar os intervalos sem os inverter acidentalmente.

**Todos os perfis de corrida guardam:** método, teste utilizado (se houver) e data, Z1–Z5 com limite inferior/superior, unidade (bpm ou min/km), data recomendada para reavaliação.

## Fase 2 — Ciclismo

Perfil completamente independente do de corrida.

**FC — teste preferencial:** prova cardiorrespiratória em **cicloergómetro** (não tapete — um teste em tapete não substitui o teste na bicicleta para prescrever potência; modos de exercício diferentes recrutam musculatura e eficiência mecânica diferentes).

**Potência — avaliação laboratorial:** prova cardiorrespiratória incremental com potência em VT1, VT2, potência máxima atingida, e opcionalmente lactato capilar por patamares. Rampa individualizada para exaustão aos 8–12 min. Se o objectivo for medir limiares de lactato especificamente, patamares de pelo menos 3 minutos (não 2), com incrementos de 20–30W adaptados ao doente — a duração do patamar influencia o limiar obtido.

**FTP como alternativa prática:** aquecimento adequado → esforço máximo controlado de 20 minutos → potência média → `FTP = 95% da potência média dos 20 min`. Prático e reprodutível, mas não é necessariamente equivalente ao limiar de lactato, potência crítica ou MLSS — assinalar isto no ecrã.

**Zonas (modelo de Coggan, 7 zonas — não 5):**

| Zona | % FTP | Nome | Propósito fisiológico |
|---|---|---|---|
| Z1 | < 55% | Recuperação activa | Circulação sanguínea, recuperação sem fadiga adicional |
| Z2 | 55–75% | Resistência aeróbica / Endurance | Base do treino — gordura como combustível, eficiência mitocondrial |
| Z3 | 76–90% | Tempo | Esforço moderado/firme, prepara ritmo de competição sustentado |
| Z4 | 91–105% | Limiar de lactato / FTP | Produção e remoção de lactato em equilíbrio no limite — subidas longas, contrarrelógio |
| Z5 | 106–120% | Capacidade aeróbica / VO₂ Max | Esforços de 3–8 min, débito máximo de oxigénio |
| Z6 | 121–150% | Capacidade anaeróbica | Esforços de 30s–2min, sem depender de oxigénio, alta fadiga neuromuscular |
| Z7 | > 150% | Potência neuromuscular / Sprint | Arrancadas <15–20s, sistema ATP-CP, força muscular pura |

A aplicação calcula e guarda sempre os limites em watts — o valor de FTP fica só como referência.

**Velocidade:** substitui "ritmo min/km" (que desaparece do ciclismo). Campo opcional e secundário — inclinação, vento, piso e tipo de bicicleta alteram significativamente a relação entre velocidade e intensidade.

**Ordem dos campos no ecrã:** Zona → Potência (W) → FC (bpm) → Cadência (rpm) → Velocidade (km/h, opcional) → RPE.

## Fase 3 — Natação

Remove-se: potência, cadência em rpm, zonas de FC como método principal (a resposta de FC em natação é confundida pela posição horizontal/imersão — FC mais baixa para a mesma intensidade relativa do que em terra).

Mantém-se: comprimento da piscina, estilo, distância, duração, ritmo em min:seg/100m, recuperação, RPE.

**Teste recomendado — Critical Swim Speed (CSS):** para nadadores com técnica e capacidade suficientes. 400m máximos controlados → recuperação adequada → 200m máximos → registar tempos em segundos:
```
CSS (m/s) = (400 − 200) ÷ (tempo₄₀₀ − tempo₂₀₀)
```
Depois converter para ritmo por 100m. Para doentes pouco treinados, com limitações ou técnica instável, não exigir teste máximo — prescrição manual por distância, ritmo tolerado e RPE.

**Zonas — nomenclatura própria de natação (não Z1–Z5 genérico):**

Aeróbicas:
| Zona | Nome | Descrição |
|---|---|---|
| A1 (EN1) | Regenerativo | Ritmo muito suave — aquecimento, arrefecimento, recuperação entre séries |
| A2 (EN2) | Endurance baixa | Ritmo sustentável e confortável — base aeróbica para longas distâncias |
| A3 (EN2 limiar) | Limiar de lactato | Equivalente ao FTP do ciclismo — velocidade máxima sustentável, medida pelo CSS |

Anaeróbicas / velocidade:
| Zona | Nome | Descrição |
|---|---|---|
| SP1 | Capacidade láctica | Séries intensas (50–100m) com descanso curto — tolerância ao lactato |
| SP2 | Pico de VO₂ Max | Esforços máximos de 1–3 min |
| SP3 | Velocidade pura / Potência neuromuscular | Tiros de 12,5–25m, descanso quase total — força de braçada, recrutamento de fibras rápidas |

**Adiado para depois (não incluir agora):** frequência de braçada (ciclos/min), número de braçadas por piscina, índice de eficiência — acrescenta complexidade sem resolver o problema principal desta fase.

## Fase 4 — Biblioteca e modelos

Hierarquia de dados (já sinalizada como "Em breve" no ecrã actual — botões `gcwoBtnBiblioteca`/`gcwoCardModelos` desactivados em `prescricao.js`):

```
Catálogo
└── exercício individual — ex.: "Agachamento"

Biblioteca de sessões
└── cartão reutilizável — ex.: "Ginásio — Membro inferior A"

Modelos de plano
└── calendário reutilizável, ex.:
    segunda — Membro inferior A
    quarta — Corrida contínua
    sexta — Membro superior B
```

Os dados devem permanecer separados nestes três níveis mesmo que a interface os agrupe visualmente (proposta: um único botão "Modelos" com separadores internos "Sessões | Planos completos").

## Riscos e decisões a confirmar antes de codificar

- Fase 0, ponto 2 (query à base de dados) é bloqueante para o resto — não avançar com alterações de esquema sem esse resultado.
- Campos antigos (`hr_zones_bpm`, `hr_zone_formula`): descontinuar, não eliminar, até se confirmar que nada depende deles.
- Cada fase (1–3) é uma funcionalidade com esquema de dados, formulário e validação próprios — não é uma tarde de trabalho por fase.
- Sugestão para mais tarde (fora de âmbito agora): usar a "data recomendada para reavaliação" para gerar um aviso automático, tal como já existe para o fim do plano — um campo que ninguém vê não protege ninguém.
