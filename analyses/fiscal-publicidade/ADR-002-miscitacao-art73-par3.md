<!-- legal-verified -->
# ADR-002 — Mis-citação do Art. 73 §3º no golden set de fiscal-publicidade (exceção real é o inciso VI "b")

**Status:** Aplicado (2026-07-23 — repo `fiscal-digital-evaluations`, sem patch de engine)
**Data:** 2026-07-23
**Escopo:** dados/documentação apenas — 20 amostras sintéticas de `fiscal-publicidade`. Engine já corrigido em `fiscal-digital` (BUG-FSC-005 / PR #124).
**Relacionado:** ADR-001 (keywords overmatch), BUG-FSC-005 (informar-não-suprimir), BUG-FSC-003 (janela vedada).

> Fonte legal lida nesta sessão: `fiscal-digital/packages/engine/src/legal-corpus/lei-9504-1997/art-73.md`
> (sync planalto 2026-05-24). Nenhuma jurisprudência foi citada por falta de fonte lida — ver "Fora de escopo".

---

## Contexto

Vinte amostras sintéticas de `fiscal-publicidade` rotulavam contratos de publicidade
emergencial/calamidade e educativa/saúde, celebrados **dentro da janela vedada**, como
`expectedOutcome: no_finding`, com `rationale`/`filterRule` invocando **"Art. 73 §3º da
Lei 9.504/97"** como base de uma exceção automática de saúde/calamidade que mandaria o
Fiscal **suprimir** o alerta.

**A citação era factualmente errada**, em dois pontos:

1. **§3º não cria exceção de saúde/calamidade.** O texto do §3º (art-73.md, linhas 130-133):
   *"As vedações do inciso VI do caput, alíneas b e c, aplicam-se apenas aos agentes
   públicos das esferas administrativas cujos cargos estejam em disputa na eleição."*
   Ou seja, o §3º trata de **qual esfera administrativa** está sujeita à vedação (a que
   está em disputa no pleito) — não abre exceção material para publicidade de saúde ou
   calamidade.

2. **A exceção real está no inciso VI, alínea "b"** (art-73.md, linhas 69-74): a vedação de
   autorizar publicidade institucional nos três meses que antecedem o pleito vale
   *"salvo em caso de grave e urgente necessidade pública, **assim reconhecida pela Justiça
   Eleitoral**"*. A exceção portanto **exige reconhecimento judicial** — a mera alegação de
   calamidade/utilidade pública no contrato (ainda que com decreto municipal) **não** afasta
   a vedação por si só.

Além do erro de direito, os rótulos ficaram **inconsistentes com o engine**. O BUG-FSC-005
implementou "informar, não suprimir" em `packages/engine/src/fiscais/publicidade.ts`: quando
o documento **alega** exceção (calamidade/emergência ou campanha educativa de saúde), o Fiscal
**não suprime** — gera o finding mesmo assim, mas fixa a confiança logo **abaixo do gate de
publicação** (`const confidence = excecao ? 0.69 : confidenceBase`; gate é
`confidence >= 0.70 + riskScore >= 60`). O finding é gerado mas não publicado — a decisão fica
para revisão humana, evitando o falso-negativo de uma "violação disfarçada" de exceção.

Sob o rótulo antigo (`no_finding`), o harness `eval-synthetic.mjs` classificaria um finding
emitido pelo engine corrigido como `fp_real` ("FP confirmado, patch deve barrar") — o oposto do
comportamento correto.

---

## Padrões

| fpPattern | Amostras | Alegação no documento |
|---|---|---|
| `excecao_legal_calamidade` | `SYN-PUB-FP-007`, `SYN-PUB-FP-139`–`148` (11) | contrato emergencial de mídia citando decreto municipal de calamidade |
| `excecao_legal_campanha_educativa_saude` | `SYN-PUB-FP-008`, `SYN-PUB-FP-149`–`156` (9) | campanha educativa de saúde (vacinação, Outubro Rosa, dengue, etc.) |

Total: **20 amostras** (2 em `synthetic-samples.json`; 18 em `synthetic-samples-batch2.json`).

Em todas, a data está dentro da janela vedada e o objeto é publicidade institucional — logo,
o núcleo da vedação do inciso VI "b" está presente. O que os rótulos antigos faziam de errado
era tratar a **alegação** de exceção como exceção **comprovada**, mandando suprimir.

---

## Decisão

Correção **de dados** (sem patch de engine — o engine já está correto):

1. **`rationale`** reescrito nas 20 amostras: remove a afirmação de que o §3º cria exceção de
   saúde/calamidade; explica que a exceção é do **inciso VI "b"** e exige **reconhecimento pela
   Justiça Eleitoral**, pelo que a alegação no contrato não afasta automaticamente a vedação.

2. **`filterRule`** reescrito: remove a instrução de "suprimir" e a âncora `Art.\s*73\s*§\s*3`.
   Passa a descrever o comportamento correto — não suprimir; emitir finding com `confidence < 0.70`
   (abaixo do gate); exceção só se comprovado o reconhecimento pela Justiça Eleitoral.

3. **`expectedOutcome`** → `TP` (o Fiscal deve emitir o finding). O harness só entende
   `TP`/`no_finding`; com `TP`, um finding emitido conta como `tp_real` (correto). `no_finding`
   marcaria o finding correto como `fp_real`.

4. **`shouldTriggerAfterPatch`** → `true`. "Após o patch" refere-se ao **BUG-FSC-005** (já em
   prod): o Fiscal deve disparar.

5. **Novo campo `expectedConfidenceBelowGate: true`** (documental): preserva a nuance
   "gera finding, mas não publicável" mesmo que o harness ainda não a asserte automaticamente.

O texto dos `syntheticGazette.excerpt` foi **deixado intacto**: o contrato sintético continua
citando erroneamente "Art. 73 §3º", pois isso reflete o que documentos reais frequentemente
alegam — é justamente o input que o Fiscal precisa tratar como alegação não comprovada.

---

## Regression tests

- **JSON válido + contagens inalteradas:** `synthetic-samples.json` = 11 amostras;
  `synthetic-samples-batch2.json` = 189 amostras.
- **Rótulos:** as 20 amostras têm `expectedOutcome: "TP"`, `shouldTriggerAfterPatch: true`,
  `expectedConfidenceBelowGate: true`.
- **Sem mis-citação residual:** grep por `§ *3` em `rationale`/`filterRule` das 20 amostras
  retorna 0; cada `rationale` cita o inciso VI "b" e o requisito de reconhecimento pela Justiça
  Eleitoral.
- **Harness (`scripts/eval-synthetic.mjs`):** cobre `FP-007`/`FP-008` (em `synthetic-samples.json`).
  Esperado: saem de `fp_real` → `tp_real` (engine BUG-FSC-005 emite finding; rótulo agora `TP`).

### Limitação de cobertura (follow-up, fora deste PR)

`eval-synthetic.mjs` (linha ~202) só carrega `synthetic-samples.json` — **não lê
`synthetic-samples-batch2.json`**. Logo, 18 das 20 amostras (`FP-139`–`156`) **não são
avaliadas por nenhum harness hoje**. Além disso, o harness mede `emitted` como
`findings.length > 0` e **não checa o gate/confiança**, então não asserta o
`expectedConfidenceBelowGate`. Habilitar batch2 + asserção `confidence < 0.70` é um slice
futuro do harness — registrado aqui como follow-up, não implementado neste PR (card Tamanho S / Tipo DOC).

---

## Métrica

- 20/20 amostras com `rationale`/`filterRule` juridicamente corretos (VI "b" + reconhecimento
  judicial), 0 citações residuais do §3º como exceção.
- Consistência engine↔golden restabelecida: `FP-007`/`FP-008` passam de `fp_real` → `tp_real`
  no harness sintético.
- Este ADR é o ponto de verdade da decisão: se o engine algum dia voltar a suprimir a exceção
  alegada, o golden set precisa acompanhar.

---

## Fora de escopo (achados laterais)

- **`SYN-CONV-FP-EDGE-042`** (`fiscal-convenios`) também referencia "§3" da Lei 9.504/97, mas é
  outro Fiscal e outro contexto legal. **Não editado aqui** — abrir card próprio se procede.
- **Jurisprudência TSE de campanhas de saúde:** não há fonte lida nesta sessão que sustente uma
  exceção jurisprudencial específica. Não citada (Princípio "Sempre citar a fonte" +
  `check-legal-citation.js`). Se o mantenedor quiser ancorar em acórdão TSE, abrir sub-tarefa com
  WebFetch da fonte oficial e marcador `[legal-verified]`.
