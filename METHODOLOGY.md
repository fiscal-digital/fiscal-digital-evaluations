# Metodologia de Avaliação dos Fiscais

## Princípio

Os 10 Fiscais do Fiscal Digital são autônomos e operam em escala diária sobre diários oficiais municipais. **Calibração ad-hoc é insuficiente** para um sistema de fiscalização pública: precisamos de baseline numérico mensurável.

Este repositório aplica metodologia de avaliação rigorosa e pública.

---

## 5 dimensões de avaliação

| Dimensão | O que mede | Como medir |
|---|---|---|
| **Precisão** | % de findings publicados que são TP | Amostragem manual sobre `alerts-prod` |
| **Recall** | % de irregularidades reais detectadas | Amostragem de gazettes históricas com casos conhecidos |
| **Calibração de score** | `riskScore` reflete probabilidade real | Histograma de findings por bucket de score |
| **Robustez de evidência** | Citação correta da fonte, sem misattribution | Auditoria de `evidence[0].source` vs conteúdo do excerpt |
| **Defensibilidade legal** | Base jurídica sólida, artigo correto | Revisão de `legalBasis` vs lei real |

---

## Distribuição alvo do golden set

**Princípio inegociável: só amostras reais.** Findings que dispararam em prod, com diários oficiais reais. Sem casos sintéticos ou hipotéticos — para evitar viés de criador.

Distribuição alvo de 100 amostras, ponderadas por risco reputacional:

| Fiscal | Alvo | Prioridade | Disponível em prod | Status |
|---|---|---|---|---|
| Pessoal | 16 | P0 | ~215 findings | ✅ pode atingir alvo |
| Nepotismo | 16 | P0 | **0 findings** | ⚠️ gap de detecção (ver `GAP_REPORT.md`) |
| Licitações | 12 | P1 | ~199 findings | ✅ pode atingir alvo |
| Contratos | 12 | P1 | ~297 findings | ✅ pode atingir alvo |
| Fornecedores | 12 | P1 | **0 findings** | ⚠️ gap de detecção |
| Geral | 8 | P1 | ~1 finding | ⚠️ gap de detecção |
| Diárias | 6 | P2 | ~32 findings | ✅ pode atingir alvo |
| Publicidade | 6 | P2 | ~3 findings | ⚠️ próximo do limite |
| Convênios | 6 | P2 | ~117 findings | ✅ pode atingir alvo |
| Locação | 6 | P2 | ~271 findings | ✅ pode atingir alvo |
| **Total esperado** | ~70 amostras reais | (Nepotismo/Fornecedores/Geral fora) | | |

**Nepotismo, Fornecedores e Geral não têm amostras** porque não disparam em prod (thresholds conservadores ou skills externas pendentes). Documentamos isso como **gap de recall** em [`GAP_REPORT.md`](GAP_REPORT.md), não como FN sintéticos. Reavaliação quando findings reais aparecerem.

---

## Critério de rotulagem por label

| Label | Significado | Quando usar |
|---|---|---|
| **TP** (True Positive) | Fiscal acertou. O excerpt + PDF do diário confirmam o que ele alegou | Há indício real do tipo de irregularidade detectada |
| **FP** (False Positive) | Fiscal errou. O excerpt + PDF não suportam a alegação | Caso normal, justificado, ou regex/heurística falsa |
| **FN** (False Negative) | Fiscal não detectou um caso real | Análise de gazette com irregularidade conhecida onde Fiscal não disparou |
| **borderline** | Caso ambíguo, faltam dados para decidir | Excerpt insuficiente, justificativa em outro doc, dúvida legal |

---

## Critérios práticos por Fiscal

### FiscalLicitações — `dispensa_irregular`, `fracionamento`
- **TP típico:** dispensa > teto Lei 14.133 Art. 75 (R$ 100k obras / R$ 50k serviços) sem justificativa
- **FP típico:** dispensa por motivo legítimo (emergência declarada, fornecedor único, valor abaixo após detalhe), ou regex confundiu "dispensa de pagamento" com "dispensa de licitação"

### FiscalContratos — `aditivo_abusivo`, `prorrogacao_excessiva`
- **TP típico:** aditivo > 25% (50% reformas) sem fundamento Art. 124, ou prorrogação > 10 anos
- **FP típico:** aditivo legal por reforma classificada como obra normal, ou alteração unilateral justificada

### FiscalFornecedores — `cnpj_jovem`, `concentracao_fornecedor`, `cnpj_situacao_irregular`, `fornecedor_sancionado`
- **TP típico:** CNPJ < 12 meses no momento do contrato, ou empresa em CEIS/CNEP
- **FP típico:** CNPJ jovem mas legal (concorrência aberta), erro na data de abertura via BrasilAPI

### FiscalPessoal — `pico_nomeacoes`, `rotatividade_anormal`
- **TP típico:** ≥ N pessoas distintas nomeadas em uma gazette (limiar dinâmico por porte da cidade)
- **FP típico:** 1 pessoa nomeada para múltiplos cargos (cada nomeação contou), ou capital onde N nomeações é normal

### FiscalGeral — `padrao_recorrente`
- **TP típico:** ≥ 3 findings mesmo CNPJ em 12 meses, padrão consistente
- **FP típico:** múltiplos findings que individualmente eram FP

### FiscalConvênios — `convenio_sem_chamamento`, `repasse_recorrente_osc`
- **TP típico:** termo de fomento sem chamamento público (Lei 13.019)
- **FP típico:** OSCIP qualificada com dispensa legal Art. 30

### FiscalNepotismo — `nepotismo_indicio`
- **TP típico:** sobrenome incomum coincidente em cargo comissionado, threshold ≥ 0.95
- **FP típico:** sobrenome comum (Silva, Santos) tratado como incomum, ou parentesco sem nepotismo (CLT vs comissionado)

### FiscalPublicidade — `publicidade_eleitoral`
- **TP típico:** contratação publicitária na janela vedada (3 meses antes da eleição até 31/12)
- **FP típico:** publicidade institucional permitida (saúde pública, calamidade, acidente)

### FiscalLocação — `locacao_sem_justificativa`
- **TP típico:** locação inexigível citada sem fundamento Art. 74 III
- **FP típico:** justificativa em parecer técnico referenciado em outra parte do diário

### FiscalDiárias — `diaria_irregular`
- **TP típico:** pagamento sábado/domingo/feriado sem justificativa, ou valor > limite
- **FP típico:** missão internacional legítima, calamidade, agenda formal documentada

---

## Schema da amostra

```json
{
  "id": "GS-001",
  "gazetteId": "4305108#2026-04-15#1",
  "fiscalId": "fiscal-licitacoes",
  "type": "dispensa_irregular",
  "riskScore": 75,
  "confidence": 0.85,
  "evidence": [{ "source": "...", "excerpt": "...", "date": "..." }],
  "narrative": "...",
  "legalBasis": "Lei 14.133/2021, Art. 75",
  "label": "TP",
  "labeledBy": "diego",
  "labeledAt": "2026-05-10T15:30:00Z",
  "rationale": "Citando p.5 do PDF: '...' confirma dispensa R$ 120k > teto R$ 100k Art. 75 II.",
  "rootCause": null,
  "adjustment": null,
  "regressionTest": null,
  "schemaVersion": 1,
  "evaluatedBy": "claude-opus-4-7",
  "evaluatedAt": "2026-05-10T03:14:00Z"
}
```

Para amostras `FP`, campos adicionais:

```json
{
  "rootCause": {
    "type": "regex_overmatch",
    "location": "packages/engine/src/fiscais/licitacoes.ts:142",
    "failingPattern": "/dispensa.*\\$/i",
    "why": "Matcha 'dispensa de pagamento' que não é dispensa de licitação"
  },
  "adjustment": {
    "fiscalCode": {
      "diff": "- /dispensa.*\\$/i\n+ /dispensa\\s+de\\s+licitaç/i"
    },
    "haikuPrompt": null
  },
  "regressionTest": {
    "input": "Dispensa de pagamento ao servidor X — R$ 5.000",
    "expected": { "label": "no_finding" }
  }
}
```

---

## Processo de avaliação

1. **Importar amostra** de `alerts-prod` via `scripts/label-cli.mjs --import`
2. **Extrair PDF** do cache S3 (`gazettes-cache-prod`) via `scripts/extract-pdf.mjs`
3. **Análise inicial** por Claude Opus 4.7: leitura do PDF + comparação com finding + diagnóstico
4. **Revisão humana:** maintainer revisa rationale, root cause, adjustment proposto
5. **Consolidação:** padrões recorrentes de FP viram ADR em `analyses/{fiscal-id}/`
6. **Patch:** PR no [`fiscal-digital`](https://github.com/fiscal-digital/fiscal-digital) aplicando os ajustes
7. **Re-avaliação:** Fiscal modificado roda novamente contra golden set, mede delta de precisão

---

## Reproducibilidade

Toda análise registra:
- `evaluatedBy`: modelo + versão (`claude-opus-4-7`, `claude-sonnet-4-6`, etc.)
- `evaluatedAt`: timestamp ISO
- `schemaVersion`: versão do schema da amostra (mudanças quebram retrocompatibilidade)

Quando `evaluatedBy` muda (ex: Opus 4.7 → 4.8), amostras antigas mantêm validade mas podem ser re-avaliadas para comparar.
