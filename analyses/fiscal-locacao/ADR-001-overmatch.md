# ADR-001 — FiscalLocação dispara em designações, aditivos, rescisões e programas sociais

**Status:** Aceito (aguardando patch)
**Data:** 2026-05-10
**Precisão atual:** 0,0% (0 TP / 10 FP em 10 amostras)
**Severidade:** P0 — desligar publicação até correção

---

## Contexto

FiscalLocação deve detectar locação de imóvel via inexigibilidade (Lei 14.133 Art. 74 III) sem fundamento técnico documentado.

Avaliação contra 10 amostras reais: **precisão 0%**. Fiscal está disparando em qualquer ato administrativo que contenha a palavra "locação", sem distinguir tipo de ato, objeto ou modalidade.

---

## Padrões de FP

| Padrão | Casos | IDs |
|---|---|---|
| Portaria de designação de Gestor/Fiscal de Contrato (não é nova contratação) | 3 | GS-062, GS-064, GS-101 |
| Termo Aditivo / Renovação contratual | 2 | GS-018, GS-100 |
| Programa social / regulamento tributário (município é regulador, não locatário) | 2 | GS-060, GS-063 |
| Extrato de Rescisão (encerramento, não contratação) | 1 | GS-061 |
| Aviso de Interesse / Chamamento Público com critérios técnicos (modalidade competitiva) | 1 | GS-098 |
| Locação de VEÍCULO via Pregão Eletrônico (objeto e modalidade fora de escopo) | 1 | GS-099 |

---

## Decisão

### Patch técnico

1. **Filtro de tipo de ato — exclusão obrigatória:**
   - `RESCISÃO|EXTRATO\s+DE\s+RESCISÃO`
   - `DESIGNAR.*(Gestor|Fiscal)\s+de\s+Contrato|Nomear.*Gestor\s+de\s+Contrato`
   - `Termo\s+Aditivo|prorrogação|RATIFICO\s+a\s+renovação`
   - `AVISO\s+DE\s+INTERESSE\s+EM\s+LOCAÇÃO|EDITAL\s+DE\s+CHAMAMENTO`
   - `Decreto.*regulamenta` (regulamento tributário)

2. **Filtro de objeto — co-ocorrência mandatória em 80 chars:**
   `\bloca[çc][ãa]o\b\s+de\s+(imóvel|imovel|prédio|edifício|sala|sede|loja|terreno|área)\b`

3. **Filtro de modalidade:** restringir a `Modalidade:?\s*(Inexigibilidade|Dispensa)`. Excluir `Pregão|Concorrência|Tomada\s+de\s+Preços` (modalidades competitivas — locação por inexigibilidade Art. 74 III tem regime próprio).

4. **Filtro de papel municipal:** município deve ser **CONTRATANTE/LOCATÁRIO**, não regulador (programa social) ou financiador (subsídio).

5. **Detector de justificativa referenciada:** se ato cita 2+ ocorrências de `doc(s)?\s*SEI\s*nº\s*\d+|à\s+vista\s+(do\s+parecer|da\s+manifestação)|aprovado\s+pelo\s+Comitê`, atenuar confidence (-0,3) ou suprimir.

### Operacional

- **Desligar publicação automática** via SSM `fiscal-digital/fiscalLocacao/enabled = false`.
- **Retratação dos 10 findings.**

---

## Regression tests obrigatórios

### TP sintético

```
Excerpt: "INEXIGIBILIDADE Nº 045/2026 — Locação de imóvel sito à Rua das Flores, 123, para uso da Secretaria de Educação, sem laudo técnico de avaliação."
Esperado: finding gerado, riskScore ≥ 60.
```

### FPs (10 do golden set)

GS-018, GS-060, GS-061, GS-062, GS-063, GS-064, GS-098, GS-099, GS-100, GS-101 — todos devem retornar `no_finding`.

---

## Métrica de sucesso

- Precisão pós-patch sintética: ≥ 85%.
- 0 FPs do golden set v1.5.0 disparando.
- Após 30 dias real: ≥ 5 TPs e ≤ 1 FP antes de reativar publicação.
