# ADR-001 — FiscalDiárias dispara em qualquer ocorrência da raiz "diári-"

**Status:** Aplicado (2026-05-10 — `fiscal-digital` PR a ser aberto)
**Data:** 2026-05-10
**Precisão pré-patch:** 0,0% Ciclo 1 (n=10) → 0,0% Ciclo 2 (n=37, universo esgotado)
**Precisão pós-patch:** a medir contra os mesmos 37 rotulados após merge
**Severidade:** P0 — patch incorpora 19 stopwords + verbo de autorização + trigger restrito (removido `viagem`/`deslocamento` que causavam overmatch em proper nouns)

---

## Contexto

FiscalDiárias deve detectar pagamento de diária a servidor em condição irregular: sábado/domingo/feriado sem justificativa, valor > R$ 800/dia, ou autorização sem agenda formal (Lei 8.112/90 Art. 58).

Avaliação contra 10 amostras reais de prod: **precisão 0%**. O Fiscal está disparando indiscriminadamente em qualquer ocorrência da raiz "diári-" (sem word boundary nem contexto).

---

## Padrões de FP encontrados

| Padrão | Casos | Detalhe |
|---|---|---|
| Match sem palavra-chave (regex acoplou em "Boa Viagem", "Despesas de Viagem") | 4 | GS-014, GS-091, GS-046, GS-092 |
| "Diária" como unidade de hospedagem em ata de RP | 3 | GS-015, GS-048, GS-049 |
| Aditivo de valor de "diária" em locação de veículo | 1 | GS-047 |
| Advérbio "diariamente" / adjetivo "alimentação diária" | 1 | GS-090 |
| Dotação orçamentária `3.3.90.14 — DIÁRIAS - PESSOAL CIVIL` em decreto | 1 | GS-093 |

**Falha agravante:** GS-014↔GS-091 e GS-015↔GS-048 são pares duplicados — engine emitiu finding redundante para mesma `(cityId, gazetteId, excerpt)`.

---

## Decisão

### Patch técnico

1. **Word boundary obrigatório:** `\b(diária|diárias)\b` — descartar `diariamente`, `diariedade`.
2. **Co-ocorrência mandatória em janela de 150 chars:**
   - Verbo de pagamento: `(pagamento|concessão|autorizar?|conceder|conced[oe]|paga(r|mento)?)\b`
   - Valor monetário: `R\$\s*[\d.,]+`
   - Identificador de pessoa física: matrícula `mat[.\s]?\s*\d+|matr[ií]cula\s*\d+` OU CPF `\d{3}\.\d{3}\.\d{3}-\d{2}`.
3. **Lista de exclusão (skip imediato se presente no ato):**
   - `ATA\s+DE\s+REGISTRO\s+DE\s+PREÇOS|ARP\s+N[º°]`
   - `PREGÃO\s+(ELETRÔNICO\s+)?N[º°]`
   - `(SERVIÇO|PRESTAÇÃO).*HOSPEDAGEM|HOTEL|APARTAMENTO`
   - `LOCAÇÃO\s+DE\s+VEÍCULO|aluguel\s+de\s+veículo`
   - `Unid\.\s*/\s*diária|m²\s*/\s*Diária` (unidade de medida)
   - `3\.3\.90\.14` (dotação orçamentária — autorização, não pagamento)
   - `CRÉDITO\s+SUPLEMENTAR|Dotação\s+Orçamentária`
4. **Deduplicação:** consultar `(cityId, gazetteId, hash(excerpt[0:200]))` no DDB antes de emitir; skip se já existe.

### Operacional

- **Desligar publicação automática** via SSM `fiscal-digital/fiscalDiarias/enabled = false` até deploy.
- **Retratação dos 10 findings** publicados.

---

## Regression tests obrigatórios

### TP sintético (criar enquanto não há TP real)

```
Excerpt: "Autoriza-se o pagamento de diárias no valor de R$ 1.200,00 ao servidor JOÃO DA SILVA, matrícula 12345, para missão em Brasília nos dias 12 a 15/05/2026."
Esperado: finding gerado, riskScore ≥ 60 (valor > R$ 800), confidence ≥ 0,7.
```

### FPs que devem parar de disparar (10 casos do golden set)

- GS-014, GS-046, GS-047, GS-048, GS-049, GS-090, GS-091, GS-092, GS-093, GS-015 — todos devem retornar `no_finding`.

---

## Métrica de sucesso

- Precisão pós-patch sintética: ≥ 90%.
- 0 FPs do golden set v1.5.0 disparando.
- Reativar publicação após 30 dias de operação real com ≥ 5 TPs e ≤ 1 FP.
