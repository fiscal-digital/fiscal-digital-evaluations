# Ciclos de Treinamento e Avaliação dos Fiscais

Este documento registra publicamente cada ciclo de avaliação dos 10 Fiscais do Fiscal Digital. Cada ciclo amplia o golden set rotulado, mede precisão por Fiscal, identifica padrões de falso positivo e propõe patches técnicos via [ADR](analyses/).

A meta de qualidade do treinamento é **≥ 85% de precisão por Fiscal sobre o golden set rotulado**. Abaixo desse piso, o ciclo de patch + revalidação continua. Não confundir com decisão operacional de publicação em prod (essa é separada e cabe ao mantenedor humano).

---

## Visão geral dos ciclos

| Ciclo | Data | Engine | Amostras totais | Sintéticos | Fiscais ≥ 85% |
|---:|---|---|---:|---:|---:|
| 1 | 2026-05-10 | v1.5.0 | 101 reais | 0 | 1 de 7 (mas era viés amostral) |
| 2 | 2026-05-10 | v1.5.0 | 1.016 reais | 55 | **0 de 7** (com n suficiente) |
| 3 | (próximo) | v1.6.0 | 1.016 reais | 55 | meta: 7 de 7 |

---

## Fluxo de cada ciclo

```
┌──────────────────────────┐
│ 1. Importação            │   findings reais de alerts-prod
│    bulk-import.mjs       │   amostragem aleatória + dedup
└────────────┬─────────────┘
             ↓
┌──────────────────────────┐
│ 2. Extração de PDFs      │   texto do diário oficial
│    extract-pdf.mjs       │   cache S3 + fallback Querido Diário
└────────────┬─────────────┘
             ↓
┌──────────────────────────┐
│ 3. Rotulagem             │   TP / FP / FN / borderline
│    label-cli.mjs         │   humano OU sub-agents Opus paralelos
│    + Opus orquestrador   │
└────────────┬─────────────┘
             ↓
┌──────────────────────────┐
│ 4. Análise por Fiscal    │   5 dimensões: precisão, recall,
│    (5 dimensões)         │   calibração, evidência, defensibilidade
└────────────┬─────────────┘
             ↓
┌──────────────────────────┐
│ 5. ADR consolidado       │   padrões recorrentes de FP
│    analyses/{fiscal}/    │   root cause + adjustment técnico
└────────────┬─────────────┘
             ↓
┌──────────────────────────┐
│ 6. Sintéticos controlados│   3 TP textbook + 5 FP réplica + 3 edge
│    golden-set/synthetic/ │   regression test do patch antes de PR
└────────────┬─────────────┘
             ↓
┌──────────────────────────┐
│ 7. Patch no engine       │   PR no fiscal-digital com:
│    fiscal-digital repo   │   - referência legal
│                          │   - exemplo TP que segue disparando
│                          │   - exemplo FP que para de disparar
└────────────┬─────────────┘
             ↓
┌──────────────────────────┐
│ 8. Re-avaliação          │   próximo ciclo: rerodar eval contra
│                          │   golden set ampliado, medir delta
└──────────────────────────┘
```

---

## Ciclo 1 — Baseline inicial (101 amostras reais)

**Data:** 2026-05-10 (manhã)
**Engine:** v1.5.0
**Amostras:** 101 reais (importadas via `label-cli.mjs --import`)
**Avaliador:** Claude Opus 4.7 (40 amostras manuais) + 7 sub-agents paralelos (61 amostras)

### Resultado

| Fiscal | TP | FP | borderline | Total | Precisão |
|---|---:|---:|---:|---:|---:|
| Pessoal | 18 | 6 | 1 | 25 | **75,0%** |
| Licitações | 16 | 2 | 2 | 20 | **88,9%** ✅ |
| Contratos | 6 | 12 | 2 | 20 | 33,3% |
| Diárias | 0 | 10 | 0 | 10 | 0,0% |
| Locação | 0 | 10 | 0 | 10 | 0,0% |
| Convênios | 0 | 10 | 0 | 10 | 0,0% |
| Publicidade | 0 | 6 | 0 | 6 | 0,0% |
| **Total** | **40** | **56** | **5** | **101** | **41,7%** |

✅ **Apenas 1 de 7 Fiscais atingiu o piso de 85%** (Licitações com 88,9%).

### Achados principais

- 4 Fiscais com 0% precisão: bug estrutural de overmatch (sem word boundary, sem filtro de tipo de ato)
- 1 Fiscal (Convênios) confunde Contrato de Repasse federal (Lei 8.666) com Termo de Fomento (Lei 13.019)
- 1 Fiscal (Contratos) calcula % de aditivo sem valor original (depende de EVO-002 já em prod)
- 1 Fiscal (Pessoal) tem subnotificação severa por regex `/nome[ao]/` não pegar verbos conjugados ("NOMEIA", "EXONERA")

7 ADRs publicados em [`analyses/{fiscal}/ADR-001-*.md`](analyses/) com root cause + adjustment técnico + regression test.

---

## Ciclo 2 — Baseline ampliado (1.016 amostras reais + 55 sintéticas)

**Data:** 2026-05-10 (tarde)
**Engine:** v1.5.0 (mesma do Ciclo 1, sem patch ainda)
**Amostras:** 1.016 reais (importadas via `bulk-import.mjs`) + 55 sintéticas (5 Fiscais × 11)
**Avaliador:** sub-agents Opus paralelos orquestrados (estimativa: 8-10 agents simultâneos)

### Por que ampliar?

Com 25 amostras, o intervalo de confiança em torno de 75% de precisão é ±10pp. Com 200+ amostras, o intervalo cai para ±5pp. Para Fiscais com 0% precisão no Ciclo 1, ampliar é essencial para diagnóstico estatisticamente robusto antes de iterar patches.

### Distribuição alvo (aprovada 2026-05-10)

| Fiscal | Disp em prod | Ciclo 1 | Ciclo 2 alvo | % do disp |
|---|---:|---:|---:|---:|
| Pessoal | 708 | 25 | **300** | 42% |
| Locação | 476 | 10 | **250** | 53% |
| Contratos | 204 | 20 | **180** | 88% |
| Licitações | 171 | 20 | **150** | 88% |
| Convênios | 75 | 10 | **75** | 100% (esgota) |
| Diárias | 37 | 10 | **37** | 100% (esgota) |
| Publicidade | 23 | 6 | **23** | 100% (esgota) |
| Geral | 1 | 0 | **1** | 100% (esgota) |
| **Total** | **1.695** | **101** | **1.016** | — |

Critério: **esgotar o universo amostral** dos Fiscais com pouco volume (Convênios, Diárias, Publicidade, Geral) para diagnóstico definitivo, e **maximizar baseline estatístico** dos Fiscais com volume (Pessoal, Locação).

### Sintéticos (Fase 2 do GAP_REPORT)

55 amostras sintéticas controladas (11 por Fiscal: 3 TP textbook + 5 FP réplica + 3 FP edge case). Marcadas com `source: "synthetic"` para nunca contaminarem métricas reais. Função: regression tests do patch antes de PR.

### Resultado final (1.016/1.016 rotuladas, 100%)

| Fiscal | TP | FP | Bo | Total | Precisão | Δ vs C1 | Gap p/ 85% |
|---|---:|---:|---:|---:|---:|---:|---:|
| Pessoal | 194 | 93 | 13 | 300 | **67,6%** | −7,4pp | −17,4pp |
| Licitações | 52 | 87 | 11 | 150 | **37,4%** | **−51,5pp** ⚠️ | −47,6pp |
| Locação | 44 | 180 | 26 | 250 | **19,6%** | +19,6pp | −65,4pp |
| Contratos | 20 | 157 | 3 | 180 | **11,3%** | **−22,0pp** ⚠️ | −73,7pp |
| Publicidade | 2 | 21 | 0 | 23 | **8,7%** | +8,7pp | −76,3pp |
| Convênios | 0 | 68 | 7 | 75 | **0,0%** | 0pp | −85,0pp |
| Diárias | 0 | 37 | 0 | 37 | **0,0%** | 0pp | −85,0pp |
| Geral | 1 | 0 | 0 | 1 | **100,0%** | n/a | n/a |
| **Total** | **313** | **643** | **60** | **1.016** | **32,7%** | — | — |

### Achados críticos do Ciclo 2

**1. Nenhum Fiscal atinge piso de 85%.** Todos os 7 Fiscais com amostragem suficiente (≥ 23) ficam abaixo. Patches são obrigatórios antes de declarar qualquer Fiscal "pronto".

**2. Viés amostral severo no Ciclo 1.** Licitações com 88,9% precisão sobre 20 amostras revelou-se 37,4% sobre 150. **Lição metodológica:** golden set < 50 amostras por Fiscal tem risco alto de mascarar bugs. Sempre validar com n ≥ 100 antes de declarar Fiscal "pronto".

**3. Bug central de Contratos é mais grave que o estimado.** Ciclo 1 mostrou 33,3% sobre 20; Ciclo 2 confirmou 11,3% sobre 180. 89% dos aditivos viram FP por falta de cross-reference (suppliers-prod GSI ainda não consultado).

**4. TPs reais existem na maioria dos Fiscais.** Locação salta de 0% para 19,6% com escala (44 TPs reais identificados). Bug não é total — há detecção legítima misturada com overmatch sistemático. Patches devem preservar TPs.

**5. FiscalGeral funciona.** Padrão recorrente VIAÇÃO GIRATUR (8+ atos do mesmo CNPJ em 12 meses, R$ 1,7M agregado) é TP forte. Detector cross-gazette está calibrado.

**6. Padrões NOVOS de FP descobertos com escala** (não capturados nos ADRs do Ciclo 1):
- **Pessoal:** ratificação retroativa, transição de mandato (jan pós-eleição), Lei Complementar criando quadro funcional, "tornar sem efeito em massa", designação para FG/GIP (≠ comissionado), concurso público regular
- **Locação:** menção documental ("contrato de locação" em rol de comprovantes), aviso de procura/cotação (fase pré-contratual), cross-block matching em SÚMULA DE CONTRATOS, atos sob Lei 13.303 (estatais), Termo de Fomento Lei 13.019 confundido com locação
- **Diárias:** "Divisão de Diárias e Passagens" (unidade administrativa), "publicação diária"/"circulação diária"/"jornada diária"/"sessões diárias"/"multa diária"
- **Contratos:** apostilamento, repactuação CCT, revisão anual/IPCA, prorrogação proporcional, supressão (valor R$ 0,00), instrumentos errados (Termo Compromisso, Fomento, Colaboração, Convênio)
- **Convênios:** Contratos de Repasse federal (MTUR/MDR/MAPA/MEC/MS/MJ/MTE/MCID/MESP), aditivos a TC vigente (chamamento na origem), contrapartes não-OSC (Universidade, Fundação Pública, Hospital Universitário, Santa Casa, Pio Sodalício), polaridade negativa
- **Publicidade:** "Fiscal de Contrato" polissemia (35% dos FPs), excerpt selector mismatch

### Próximo passo

**Ciclo 3** começa após primeiro patch P0 mergeado em `fiscal-digital`, validado contra os mesmos 1.016 amostras. Ordem de prioridade dos patches por proximidade ao piso de 85%:

1. **FiscalPessoal** (67,6%, gap −17,4pp): patch regex conjugados (NOMEIA/EXONERA) + filtros de transição/ratificação retroativa/concurso
2. **FiscalLicitações** (37,4%, gap −47,6pp): patch tipo de instrumento (excluir locação imóvel/designação fiscal) + classificação obra vs serviço
3. **FiscalLocação** (19,6%, gap −65,4pp): patch 6 padrões originais + cross-block matching + Lei 13.303
4. **FiscalContratos** (11,3%, gap −73,7pp): patch suppliers-prod cross-reference (depende de EVO-002 ativo) + filtros de instrumento/repactuação
5. **FiscalDiárias** (0%, gap −85pp): patch word boundary + co-ocorrência + 12 stopwords
6. **FiscalConvênios** (0%, gap −85pp): patch whitelist siglas federais + decreto orçamentário + contraparte OSC
7. **FiscalPublicidade** (8,7%, gap −76,3pp): patch keywords estritas + "Fiscal de Contrato" blocklist

---

---

## Como reproduzir cada ciclo

```bash
# 1. Importar amostras de prod (requer credenciais AWS)
node scripts/bulk-import.mjs

# 2. Extrair PDFs (S3 cache + fallback Querido Diário)
node scripts/extract-pdf.mjs

# 3. Rodar engine offline contra golden set (mock genérico)
npm run eval

# 4. Rodar engine contra dataset sintético (mock realista regex)
npm run eval:synthetic

# 5. Rotular amostras manualmente
npm run label
```

Para auditar uma amostra específica:
```bash
# Ver rationale + rootCause + adjustment de uma amostra
cat golden-set/samples.json | node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync('/dev/stdin','utf8'));console.log(d.samples.find(s=>s.id==='GS-XXX'))"
```

---

## Por que publicamos os ciclos

Tornar os ciclos de treinamento públicos é parte do princípio de **verificabilidade pública** do Fiscal Digital. Não basta que o sistema seja transparente nos alertas que publica — o método pelo qual o sistema é validado também precisa ser auditável.

Convidamos:
- **Juristas**: revisar a defensibilidade legal das classificações TP/FP
- **Jornalistas**: validar se os achados refletem irregularidades reais
- **Pesquisadores**: criticar metodologia, propor melhorias
- **Cidadãos**: contribuir com casos reais que deveriam virar TP/FN no dataset

Críticas e propostas via [Issues](https://github.com/fiscal-digital/fiscal-digital-evaluations/issues).
