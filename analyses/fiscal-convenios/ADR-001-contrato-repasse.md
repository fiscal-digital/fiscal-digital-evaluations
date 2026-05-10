# ADR-001 — FiscalConvênios confunde Contrato de Repasse federal com Termo de Fomento Lei 13.019

**Status:** Aplicado (2026-05-10 — `fiscal-digital` PR a ser aberto)
**Data:** 2026-05-10
**Autor:** Avaliação automatizada via golden set v1.5.0
**Precisão pré-patch:** 0,0% Ciclo 1 (n=10) → 0,0% Ciclo 2 (n=75, universo esgotado em prod)
**Precisão pós-patch:** a medir contra os mesmos 75 rotulados após merge
**Severidade:** P0 — patch incorpora 4 filtros de exclusão (siglas federais MTUR/MDR/MAPA/MS/MEC/MJ/MMA/MCID + 18 outras; contrapartes não-OSC; decreto orçamentário; polaridade negativa)

---

## Contexto

FiscalConvênios deve detectar termos de fomento ou colaboração celebrados pelo Município com OSC sem chamamento público (vedado pela Lei 13.019/2014, salvo dispensa fundamentada Art. 30).

A avaliação contra 10 amostras reais de prod mostra **precisão 0%**: todos os findings são falso-positivo. O Fiscal está aplicando a hipótese da Lei 13.019 a instrumentos jurídicos que não estão sob seu escopo.

---

## Padrões de FP encontrados

### Padrão 1 — Contrato de Repasse federal (6 de 10 amostras)

Instrumentos como `CONTRATO DE REPASSE Nº 0XXXXXX/MTUR/CAIXA` são transferências da União ao Município, regidos por Lei 8.666 e Instrução Normativa STN. Não exigem chamamento público municipal.

| ID | Sigla federal | Município | Valor |
|---|---|---|---|
| GS-056 / GS-095 (duplicata) | MTUR | múltiplos | — |
| GS-057 | MDR | — | — |
| GS-058 | MAPA | — | — |
| GS-059 | MCIDADANIA / MS | — | — |
| GS-097 | MEC / MJ | — | — |

### Padrão 2 — Decreto orçamentário com palavra "convênio" (3 amostras)

GS-017, GS-055, GS-094 disparam em decretos de suplementação de crédito que apenas mencionam "convênio com PUCC" (universidade, não OSC), "fonte 0124 de convênio" (fonte de recurso), ou repasse para Hospital Odilon Behrens (fundação pública municipal — administração indireta, não terceiro setor).

### Padrão 3 — Polaridade negativa não detectada (1 amostra)

GS-096: trecho diz "OSC que NÃO PODERÁ ter o Termo de Colaboração renovado" — Fiscal disparou apesar de o decreto estar SUBSTITUINDO convênio por licitação (movimento favorável à conformidade).

---

## Decisão

### Patch técnico

1. **Whitelist de siglas federais** — excluir do gatilho qualquer ato contendo `CONTRATO\s+DE\s+REPASSE.*N[º°]\s*\d+.*\/(MTUR|MDR|MAPA|MS|MEC|MJ|MMA|MCID|MCIDADANIA|MIDR|MCTI|MEL|MINC)\/CAIXA?\b`.
2. **Filtro de tipo de instrumento** — disparar apenas em `Termo\s+de\s+(Fomento|Colaboração)\b` precedido de `(celebra|firmar|celebração|extrato|publica)`. Excluir `CONTRATO\s+DE\s+REPASSE`, `Convênio\s+de\s+Cooperação`, `Acordo\s+de\s+Cooperação\s+Técnica`.
3. **Excluir contrapartes não-OSC** — whitelist de termos: `universidade|UFMG|USP|PUC|UFR[A-Z]|fundação\s+(municipal|estadual|federal)|hospital\s+\w+(público|metropolitano)|autarquia|sociedade\s+de\s+economia\s+mista`.
4. **Detector de polaridade negativa** — antes de emitir finding, verificar se `não\s+(poderá|será|deverá)\b` aparece a < 100 chars do termo gatilho.
5. **Deduplicação** — antes de emitir, consultar `(cityId, gazetteId, hash(excerpt))` no DDB; skip se já existe.
6. **Detector de chamamento referenciado** — buscar `chamamento` no PDF inteiro (não só no excerpt). Se encontrado em qualquer página, reduzir confidence em 0,3.
7. **Exclusão de decreto orçamentário** — skip se ato contém `CRÉDITO\s+(ADICIONAL\s+)?SUPLEMENTAR|abertura\s+de\s+crédito|Lei\s+9452/97`.

### Operacional

- **Desligar publicação automática de FiscalConvênios** via flag SSM (`fiscal-digital/fiscalConvenios/enabled = false`) até deploy do patch.
- **Retratação pública obrigatória** dos 10 findings publicados — política da CLAUDE.md exige correção no mesmo canal.

---

## Regression tests obrigatórios para o PR

### TP que deve continuar disparando

Quando houver: aguardar primeiro TP real chegar em prod após o patch (já que nenhuma das 10 amostras atuais é TP). Provisoriamente, criar caso sintético em `golden-set/synthetic/convenios-tp-001.json` com termo de fomento explícito sem chamamento.

### FP que deve parar de disparar

Cada uma das 10 amostras (GS-017, GS-055, GS-056, GS-057, GS-058, GS-059, GS-094, GS-095, GS-096, GS-097) deve, após patch, retornar `no_finding`.

---

## Métrica de sucesso

- Precisão pós-patch: ≥ 80% em sintéticos controlados (Fase 2 do GAP_REPORT).
- Reavaliação real contra `alerts-prod` em janela de 30 dias após deploy: ≥ 5 TPs reais com 0 FPs aprovados antes de reativar publicação automática.

---

## Risco residual

A Lei 13.019/2014 tem exceções complexas (Art. 30 — emergência, paz, vulnerabilidade extrema). O patch acima é restritivo: pode subnotificar casos onde o termo "Termo de Fomento" aparece em contexto não-padronizado. Aceito como trade-off temporário até revisão jurídica acompanhada.
