# CLAUDE.md — Gestão Clínica (gc.joaomorais.pt)

## Regras obrigatórias

### URLs de teste
**NUNCA dar URLs `file://` para testar páginas.** O projecto usa módulos ES6
(`<script type="module">`) que só funcionam servidos por HTTP(S).

O URL de teste válido para qualquer página do projecto é sempre:
```
https://gc.joaomorais.pt/<caminho relativo à raiz do projecto>
```

Exemplo canónico:
```
https://gc.joaomorais.pt/modules/consulta/v2/nova-consulta/nova-consulta.test.html
```

### Relatório de commit
No fim de cada passo, o relatório deve começar por: hash do commit + mensagem
+ confirmação de push — antes de qualquer outra informação.
