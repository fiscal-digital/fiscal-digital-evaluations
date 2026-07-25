<!-- legal-verified -->
# ADR-002 — Art. 73, V, "a" ressalva cargos em comissão: a tese do `pico_nomeacoes` estava invertida

**Status:** Aplicado (2026-07-25 — patch de engine em `fiscal-digital`)
**Data:** 2026-07-25
**Fiscal:** `fiscal-pessoal` (maior volume da plataforma)
**Origem:** achado do gate de calibração κ (EVAL-003, PR #9), verificado nesta sessão contra a fonte canônica
**Relacionado:** BUG-FSC-006 · ADR-001 (regex/conjugação) · BUG-FSC-005 (informar-não-suprimir) · ADR-cross-fiscal-art73-par3

> Fonte legal canônica lida nesta sessão:
> `fiscal-digital/packages/engine/src/legal-corpus/lei-9504-1997/art-73.md`, linhas 32-58 (sync planalto).

---

## Achado

O **Art. 73, V da Lei 9.504/97** encerra a vedação com `ressalvados:` e abre cinco alíneas. A **alínea "a"** (linhas 39-41) diz, literalmente:

> a) a nomeação ou exoneração de cargos em comissão e designação ou dispensa de funções de confiança;

Ou seja: **nomeação e exoneração de cargo em comissão não são condutas vedadas pelo inciso V.** São exatamente o que a lei excetua.

O `pico_nomeacoes` conta precisamente esses atos. O template de narrativa afirmava o oposto da lei:

```
Lei 9.504/97 Art. 73 V veda nomeações para cargos em comissão no período eleitoral.
```

Numa plataforma de accountability público, publicar como ilícito um ato que a própria lei ressalva é o erro mais caro que existe — e estava no Fiscal de maior volume.

### Agravante estrutural

Os filtros de exclusão do ADR-001 removem, **antes** da contagem, os casos de **concurso público regular** (h) e **nomeação em caráter efetivo** (h). Esses são justamente os atos **não** ressalvados. O efeito líquido é que o Fiscal filtrava para fora o que a lei veda e contava o que a lei ressalva.

### Colateral — `pessoal.legal.md` citava lei inexistente

O documento de base legal do Fiscal afirmava que as exceções eram *"vacância decorrente de falecimento, exoneração a pedido, aposentadoria"* e reproduzia um trecho do inciso V como citação direta. Verificação contra o texto integral da Lei 9.504/97:

| Expressão citada em `pessoal.legal.md` | Ocorrências na Lei 9.504/97 |
|---|---|
| "não se incluindo nessa vedação" | **0** |
| "ao mesmo tempo, prejudicar candidato" | **0** |
| "desde que não destinadas ao favorecimento" | **0** |
| "vacância" | **0** |
| "aposentadoria" | **0** |

Nem a lista de exceções nem o bloco citado existiam na lei. A citação era confabulada — mesma classe do incidente que motivou o hook `check-legal-citation` (Issue #42, 2026-05-24).

## Quantificação do impacto em `alerts-prod`

Scan de `fiscal-digital-alerts-prod` (us-east-1) filtrando `type = pico_nomeacoes`, em 2026-07-25:

| Métrica | Valor |
|---|---|
| Total de findings `pico_nomeacoes` | **124** |
| Citam `Art. 73` no `legalBasis` | 124 (100%) |
| Gazette dentro de janela eleitoral | 124 (100%) |
| Mencionam cargo em comissão / função de confiança | **63 (50,8%)** |
| **Atingidos pela ressalva "a"** | **63 (50,8%)** |
| Acima do gate de publicação (`riskScore ≥ 60` **e** `confidence ≥ 0.70`) | 7 |
| **Destes, atingidos pela ressalva** | **7 de 7 (100%)** |

**Todo finding de `pico_nomeacoes` atualmente publicável em prod está atingido pela ressalva.**

A `confidence` é bimodal por construção (`pessoal.ts`: `0.82` quando há pessoas únicas, `0.65` no fallback de contagem), o que explica os 7 de 124 acima do gate. `riskScore` variou de 74 a 83 — todos acima de 60.

Distribuição por cidade dos 63 atingidos:

| Cidade | Findings |
|---|---|
| Aparecida de Goiânia/GO | 30 |
| Belford Roxo/RJ | 17 |
| Guarulhos/SP | 5 |
| Duque de Caxias/RJ | 4 |
| Nova Iguaçu/RJ | 3 |
| Natal/RN | 2 |
| João Pessoa/PB | 1 |
| Vila Velha/ES | 1 |

> Publicação está parada desde 2026-05-31 (avaliação Ciclo 4), então a exposição externa efetiva é limitada. Isso reduz o dano, não o defeito.

## Decisão — informar, não suprimir

Mesma linha do **BUG-FSC-005**. O achado continua existindo: volume atípico de movimentação de cargos comissionados às vésperas do pleito é informação de interesse público legítima. O que não se sustenta é a **tese de ilicitude sob o Art. 73, V**.

Quando os atos contados são de cargo em comissão ou função de confiança:

1. **Base legal corrigida** — passa a citar a alínea "a" *como ressalva*, não como fundamento de ilicitude:
   `Lei 9.504/97, Art. 73, V, "a" (ressalva expressa — ato não vedado); CF, Art. 37, caput`
2. **Narrativa explicita a ressalva** — tanto o system prompt do Haiku quanto o template de fallback passam a afirmar que a lei **ressalva** esses atos e proíbem afirmar ou insinuar vedação.
3. **Confiança rebaixada para `0.55`** — abaixo do gate de publicação (0.70). O achado permanece consultável na API; deixa de ser publicado automaticamente.
4. **`rotatividade_anormal`** deixa de citar `Lei 9.504/97, Art. 73, V`. Esse achado é, por construção, sobre cargo comissionado — citar o inciso V insinuava vedação eleitoral que a lei afasta. Fundamento remanescente: `CF, Art. 37, V`.
5. **`pessoal.legal.md` reescrito** com o texto verificado das cinco alíneas e nota de histórico do erro.

### Limitação assumida (explícita)

A detecção da ressalva é **textual**: depende de a gazette dizer "cargo em comissão", "comissionado" ou "função de confiança". Quando a gazette **não declara a natureza do cargo**, o Fiscal mantém a base legal cheia do inciso V.

Isso ainda pode superestimar: um ato ressalvado cuja gazette não usa esses termos seguirá com a base legal cheia. Mitigação parcial — a narrativa desse ramo passa a dizer explicitamente *"com as ressalvas das alíneas 'a' a 'e'"*, em vez de afirmar vedação absoluta. Fechar essa lacuna de vez exige classificar a natureza do cargo (efetivo × comissionado × temporário) na extração, o que fica como item separado.

## Regression tests

`fiscal-digital/packages/engine/src/fiscais/__tests__/pessoal.test.ts` — 3 casos novos, todos **falham** contra o código anterior ao patch e **passam** depois (verificado por swap do arquivo contra `HEAD`):

| Teste | Assere |
|---|---|
| `atos de cargo em comissão em janela eleitoral: NÃO afirma vedação` | narrativa não afirma vedação, explicita a ressalva, `legalBasis` cita a alínea "a", `confidence === 0.55` |
| `atos sem indicação de cargo em comissão: mantém base legal cheia do inciso V` | `legalBasis` inalterado, `confidence ≥ 0.70`, narrativa menciona as ressalvas |
| `rotatividade_anormal não cita Art. 73 V` | `legalBasis === 'CF, Art. 37, V'` |

Fixtures novas: `gazetteRessalvaCargoComissao`, `gazetteSemRessalvaJanelaEleitoral`.

Suíte completa do engine: **356 passed**, 9 skipped, 0 falhas. Lint: 0 erros.

## Critérios de aceite

- [x] Texto legal citado linha a linha da fonte canônica (`art-73.md`, linhas 32-58)
- [x] Quantificação do impacto em `alerts-prod` (124 findings; 63 atingidos; 7 de 7 publicáveis)
- [x] `pessoal.legal.md` corrigido — exceções reais e citação verificada
- [x] ADR publicado com marcador `<!-- legal-verified -->`
- [x] Testes de regressão cobrindo o caso ressalvado, com falha demonstrada pré-fix

## Follow-ups (fora deste ADR)

1. **Reanálise dos 63 findings atingidos** em `alerts-prod` — o patch corrige a produção futura; os registros existentes seguem com a base legal antiga até replay (`replay-fiscal.mjs`, sequencial — nunca `reanalyze.mjs` via SQS).
2. **Classificação da natureza do cargo** na extração (efetivo × comissionado × temporário), para fechar a lacuna da detecção textual.
3. **Revisão do golden set** de `fiscal-pessoal` (707 amostras, ~194 TP): rótulos que trataram nomeação de comissionado em janela eleitoral como TP precisam ser reavaliados à luz da ressalva.
