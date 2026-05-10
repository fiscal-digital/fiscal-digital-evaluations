# ADR-001 — FiscalContratos calcula % de aditivo sem valor original do contrato

**Status:** Aplicado parcial (2026-05-10 — `fiscal-digital` PR a ser aberto; cross-ref suppliers-prod pendente)
**Data:** 2026-05-10
**Precisão pré-patch:** 33,3% Ciclo 1 (n=20) → 11,3% Ciclo 2 (n=180)
**Precisão pós-patch:** a medir contra os mesmos 180 rotulados após merge
**Severidade:** P1 — patch aplica filtros defensivos (4 itens do ADR sem mexer em IaC): floor R$ 5.000, percentual declarado, instrumento fora de escopo (Termo Compromisso/Cooperação/Fomento/Colaboração/Cessão Uso/Convênio/Súmula), reajuste legal Art. 124 (revisão anual/IPCA/repactuação CCT/apostilamento/supressão). Cross-ref formal com `suppliers-prod` GSI fica como follow-up (requer skill adicional via context).

---

## Contexto

FiscalContratos deve detectar aditivos abusivos (>25% do valor original, 50% para reformas) e prorrogações excessivas (>10 anos).

Avaliação contra 20 amostras: precisão **33,3%** — pior que o batch inicial isolado (segundo batch teve apenas 12,5%). Causa central: o engine calcula "% de aditivo" sem ter acesso ao valor original do contrato.

---

## Padrões de FP

| Padrão | Casos |
|---|---:|
| `missing_original_contract_value` (engine não tinha acesso ao valor original) | 13 (combinando rótulos `missing_cross_contract_lookup` e `missing_original_contract_value`) |
| `ignored_explicit_percentage_in_text` (PDF dizia "20,22%" — abaixo do limite, ignorado) | 1 (GS-084) |
| Filtro de tipo de instrumento ausente (Termo de Compromisso ≠ contrato administrativo) | 1 (GS-089) |
| Janela de extração acoplou valor de bloco adjacente | 1 (GS-082) |

**TP único (GS-087):** funcionou porque o PDF tinha tudo no excerpt (contrato R$ 6,9M → R$ 13,8M = +100%, Feira de Santana, DNA.SERVIÇOS).

---

## Decisão

### Patch técnico (em ordem de implementação)

1. **Cross-reference via `suppliers-prod` (depende de EVO-002 já em prod, schema `sk = {contractedAt}#{contractId}`):**
   ```ts
   const original = await ddb.send(new QueryCommand({
     TableName: 'fiscal-digital-suppliers-prod',
     IndexName: 'GSI1-city-date',
     KeyConditionExpression: 'gsi1pk = :city AND begins_with(gsi1sk, :date)',
     FilterExpression: 'contractId = :id',
     ExpressionAttributeValues: { ':city': pk('CITY', cityId), ':date': '2024', ':id': contractId },
   }))
   if (!original.Items?.length) return { riskScore: 0, finding: null } // skip
   ```
   Se `original` ausente → **skip** (não dá pra calcular % sem base).

2. **Floor de valor mínimo:** aditivos < R$ 5.000 são quase sempre ajustes operacionais (correção de NF, rounding). Skip antes de qualquer cálculo.

3. **Capturar percentual declarado no texto:**
   ```regex
   /(acréscimo|decréscimo|aditivo)\s+de\s+(\d+([.,]\d+)?)\s*%/i
   ```
   Se `% < 25` (ou `< 50` para reforma), suprimir finding (texto explícito é fonte primária — confiável > inferência).

4. **Filtro de tipo de instrumento:** skip se ato contém:
   - `Termo\s+de\s+(Compromisso|Cooperação|Fomento|Colaboração|Cessão\s+de\s+Uso)` (não são contratos administrativos sob Lei 14.133 Art. 125).
   - `revisão\s+anual|reajuste\s+por\s+índice|repactuação` (são reajuste legal Art. 124, não acréscimo abusivo).

5. **Detector de prorrogação simples vs prorrogação excessiva:**
   - Capturar vigência total acumulada no PDF (somando aditivos anteriores citados).
   - Disparar `prorrogacao_excessiva` apenas se `vigênciaTotal > 10 anos`.

6. **Janela de extração de valor:** restringir busca de valor a ≤ 50 chars do número do contrato no texto. GS-082 acoplou valor R$ 2,7M de bloco adjacente (Termo de Colaboração FUCS) ao aditivo subsequente.

### Operacional

- **Desligar disparos de `aditivo_abusivo`** via SSM `fiscal-digital/fiscalContratos/aditivoEnabled = false` até integração com `suppliers-prod`.
- **Manter `prorrogacao_excessiva` ativo** (não depende de cross-reference, lógica é local).
- **Retratação dos 12 FPs** publicados.

---

## Regression tests obrigatórios

### TPs do golden set (devem continuar disparando)

GS-087 (Feira de Santana, contrato R$ 6,9M → R$ 13,8M, +100%) — único TP confirmado.

### FPs do golden set (devem parar de disparar)

GS-082, GS-083, GS-084, GS-085, GS-086, GS-088, GS-089 (8 FPs do batch +8) + 5 FPs do batch anterior = 12 casos.

### TP sintético (até + amostras reais aparecerem)

```
suppliers-prod já tem: contractId=123/2024, valorOriginal=R$ 100k, dataContrato=2024-03-01
Aditivo: contractId=123/2024, valorAditivo=R$ 30k, dataAditivo=2024-08-15
Cálculo: 30/100 = 30% > 25% → finding TP, riskScore ≥ 60.
```

---

## Métrica de sucesso

- Precisão pós-patch contra golden set v1.5.0: ≥ 75%.
- Após reativação de `aditivo_abusivo`, monitoramento por 30 dias: ≥ 5 TPs reais com cross-reference funcionando, ≤ 1 FP.

---

## Risco residual

`suppliers-prod` foi populado a partir de 2026-05-09. Contratos anteriores não têm registro lá — durante janela de transição (~12 meses), muitos aditivos cairão no caminho "skip por falta de valor original". Aceito: melhor falso negativo do que falso positivo público.
