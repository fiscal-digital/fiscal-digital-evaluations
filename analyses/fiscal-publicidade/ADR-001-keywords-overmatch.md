# ADR-001 — FiscalPublicidade dispara em "divulgação", concessões e publicações legais

**Status:** Aplicado (2026-05-10 — `fiscal-digital` PR a ser aberto)
**Data:** 2026-05-10
**Precisão pré-patch:** 0,0% Ciclo 1 (n=6) → 8,7% Ciclo 2 (n=23, universo esgotado em prod)
**Precisão pós-patch:** a medir contra os mesmos 23 rotulados após merge
**Severidade:** P0 — patch incorpora 18 stopwords (header DO + designação fiscal + publicação legal + concessão patrimonial + atribuição funcional)

---

## Contexto

FiscalPublicidade deve detectar contratação publicitária na janela vedada (3 meses antes da eleição até 31/12 do ano eleitoral — Lei 9.504/97 Art. 73 VI "b" + VII).

Avaliação contra 6 amostras reais: **precisão 0%**. Gate temporal (data dentro de janela eleitoral 2024) está correto em todas as 6, mas as keywords gatilho são polissêmicas e não validam o tipo do contrato.

---

## Padrões de FP

| Padrão | Casos | Detalhe |
|---|---|---|
| Termo polissêmico ("divulgação", "Fiscal", "comunicação") | 3 | GS-050 designação fiscal TI; GS-051 atribuições funcionais Família Acolhedora; GS-054 fiscais de impressão outsourcing |
| Excerpt selecionado desconectado do termo gatilho | 1 | GS-016 — excerpt sobre transporte escolar, gazette tem prestação de contas trimestral (transparência, não nova contratação) |
| Falta de exceção legal — "publicação legal" vs "publicidade institucional" | 1 | GS-052 — pregão para "inserções em Diários Oficiais para divulgação de anúncios de caráter legal" (publicação obrigatória, fora da vedação) |
| Concessão patrimonial confundida com contratação | 1 | GS-053 — aditivo de concessão de outdoors (BRASIL OUTDOOR paga outorga ao Município, operação inversa) |

---

## Decisão

### Patch técnico

1. **Restringir keywords a termos de objeto contratual estrito:**
   - Aceitar: `publicidade\s+institucional|propaganda|serviços\s+de\s+mídia|campanha\s+publicitária|agência\s+de\s+publicidade|inserções?\s+em\s+(rádio|TV|jornal|revista)|anúncios?\s+publicitários?`
   - Rejeitar (overmatch): `divulgação` (polissêmico), `comunicação` (escopo amplo), `Fiscal` (designação), `Órgão\s+de\s+divulgação` (cabeçalho do DO).

2. **Lista de exclusão:**
   - `prestação\s+de\s+contas\s+trimestral|relatório\s+trimestral` (Lei Orgânica Art. 62 — transparência, não contratação)
   - `Designar.*Fiscal\s+de\s+Contrato|Nomear.*Fiscal`
   - `anúncios\s+de\s+caráter\s+legal|publicação\s+(de\s+)?editais|publicação\s+legal`
   - `concessão.*outdoor|outorga.*mobiliário\s+urbano`

3. **Detector de polaridade da operação:** se o ato é **CONCESSÃO** com Contratada pagando outorga ao Município (receita patrimonial), suprimir.

4. **Validação de coerência excerpt ↔ termo gatilho:** o excerpt selecionado deve conter o termo que disparou o finding, em proximidade ≤ 3 linhas.

5. **Validação adicional de janela eleitoral** (já correta na amostra atual, manter): apenas disparar se `gazette.date` ∈ [06/jul, 31/dez] de ano eleitoral (2020, 2022, 2024, 2026).

### Operacional

- **Desligar publicação automática** via SSM `fiscal-digital/fiscalPublicidade/enabled = false`.
- **Retratação dos 6 findings publicados** — risco jurídico médio (defesa fácil pela contraparte em FP de janela eleitoral).

---

## Regression tests obrigatórios

### TP sintético

```
Excerpt: "Contrato de prestação de serviços de publicidade institucional com a agência X — campanha 'Cidade Limpa' — R$ 850.000 — 15/08/2024 (dentro de janela eleitoral 2024)"
Esperado: finding gerado, riskScore ≥ 60.
```

### FPs (6 do golden set)

GS-016, GS-050, GS-051, GS-052, GS-053, GS-054 — todos devem retornar `no_finding`.

---

## Métrica de sucesso

- Precisão pós-patch sintética: ≥ 85%.
- 0 FPs do golden set v1.5.0 disparando.
- Reativar após 30 dias real com ≥ 3 TPs e ≤ 1 FP.
