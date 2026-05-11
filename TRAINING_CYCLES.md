# Ciclos de Treinamento e Avaliação dos Fiscais

Este documento registra publicamente cada ciclo de avaliação dos 10 Fiscais do Fiscal Digital. Cada ciclo amplia o golden set rotulado, mede precisão por Fiscal, identifica padrões de falso positivo e propõe patches técnicos via [ADR](analyses/).

A meta de qualidade do treinamento é **≥ 85% de precisão por Fiscal sobre o golden set rotulado**. Abaixo desse piso, o ciclo de patch + revalidação continua. Não confundir com decisão operacional de publicação em prod (essa é separada e cabe ao mantenedor humano).

---

## Visão geral dos ciclos

| Ciclo | Data | Engine | Amostras totais | Sintéticos | Fiscais ≥ 85% |
|---:|---|---|---:|---:|---:|
| 1 | 2026-05-10 | v1.5.0 | 101 reais | 0 | 1 de 7 (mas era viés amostral) |
| 2 | 2026-05-10 | v1.5.0 | 1.016 reais | 55 | **0 de 7** (com n suficiente) |
| 3 | 2026-05-10 | v1.5.0 | **1.695** reais (universo esgotado) | 55 | **0 de 7** (7 PRs patch abertos: #16-22) |
| 4 | 2026-05-11 | **v1.6.0** | 1.695 reais | 55 | em observação (7 PRs MERGED em prod, aguarda 30d) |

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

**Ciclo 3** começa após primeiro patch P0 mergeado em `fiscal-digital`, validado contra os mesmos 1.016 amostras (mais novas amostras). Ordem de prioridade dos patches por proximidade ao piso de 85%:

1. **FiscalPessoal** (67,6%, gap −17,4pp): patch regex conjugados (NOMEIA/EXONERA) + filtros de transição/ratificação retroativa/concurso
2. **FiscalLicitações** (37,4%, gap −47,6pp): patch tipo de instrumento (excluir locação imóvel/designação fiscal) + classificação obra vs serviço
3. **FiscalLocação** (19,6%, gap −65,4pp): patch 6 padrões originais + cross-block matching + Lei 13.303
4. **FiscalContratos** (11,3%, gap −73,7pp): patch suppliers-prod cross-reference (depende de EVO-002 ativo) + filtros de instrumento/repactuação
5. **FiscalDiárias** (0%, gap −85pp): patch word boundary + co-ocorrência + 12 stopwords
6. **FiscalConvênios** (0%, gap −85pp): patch whitelist siglas federais + decreto orçamentário + contraparte OSC
7. **FiscalPublicidade** (8,7%, gap −76,3pp): patch keywords estritas + "Fiscal de Contrato" blocklist

---

## Ciclo 3 (parcial) — Esgotamento amostral (1.514 rotuladas de 1.695)

**Data:** 2026-05-10 (noite)
**Engine:** v1.5.0 (mesma do Ciclo 1 e 2)
**Amostras importadas:** 1.695 reais (esgota o universo amostral de `alerts-prod`)
**Amostras rotuladas:** 1.514 (498 novas além das 1.016 do Ciclo 2)
**Amostras pendentes:** 181 (Pessoal shard 1 = 136, Contratos shard 1 = 24, Licitações shard 1 = 21)
**Avaliador:** 4 sub-agents claude-opus-4-7 paralelos completaram (Locação shard 1/2, Pessoal shard 2/3); 3 outros agents pararam no limite de cota Anthropic.

### Por que parcial?

A janela de cota Anthropic esgotou antes de todos os 7 sub-agents finalizarem. Os 3 shards pendentes (`.tmp-pending-fiscal-{pessoal,contratos,licitacoes}-c3-shard*.json`) ficam preparados na raiz do repo para a próxima rodada de rotulagem. **Não fazer rotulagem por heurística de excerpt** — introduziria ruído no baseline. A precisão por Fiscal é calculada apenas sobre rotulados.

### Distribuição

| Fiscal | Ciclo 2 | C3 novas rotuladas | C3 pendentes | C3 total | % esgotado |
|---|---:|---:|---:|---:|---:|
| Pessoal | 300 | 272 | 136 | 708 | 81% |
| Locação | 250 | 226 | 0 | 476 | **100%** |
| Contratos | 180 | 0 | 24 | 204 | 88% |
| Licitações | 150 | 0 | 21 | 171 | 88% |
| Convênios | 75 | 0 | 0 | 75 | **100%** |
| Diárias | 37 | 0 | 0 | 37 | **100%** |
| Publicidade | 23 | 0 | 0 | 23 | **100%** |
| Geral | 1 | 0 | 0 | 1 | **100%** |
| **Total** | **1.016** | **498** | **181** | **1.695** | **89%** |

### Resultado parcial (1.514 rotuladas, 89%)

| Fiscal | TP | FP | Bo | Pend | Total | Precisão | Δ vs C2 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Pessoal | 194 | 332 | 46 | 136 | 708 | **36,9%** | **−30,7pp** ⚠️ |
| Locação | 72 | 378 | 26 | 0 | 476 | **16,0%** | −3,6pp |
| Licitações | 52 | 87 | 11 | 21 | 171 | **37,4%** | 0 (pendente) |
| Contratos | 20 | 157 | 3 | 24 | 204 | **11,3%** | 0 (pendente) |
| Publicidade | 2 | 21 | 0 | 0 | 23 | **8,7%** | 0 |
| Convênios | 0 | 68 | 7 | 0 | 75 | **0,0%** | 0 |
| Diárias | 0 | 37 | 0 | 0 | 37 | **0,0%** | 0 |
| Geral | 1 | 0 | 0 | 0 | 1 | **100,0%** | 0 |
| **Total** | **341** | **1.080** | **93** | **181** | **1.695** | **24,0%** | — |

### Achados do Ciclo 3 (parcial)

**1. Pessoal queda atípica para 36,9%.** Dois shards (n=272) vieram 0 TP / 269 FP. Padrões dominantes nos rationales: `comunicado_convocacao_nao_e_nomeacao`, `vaga_decorrente_substituicao_individual`, `texto_normativo_mencao_palavra_nomeacao`, `transicao_mandato_pos_eleicao`, `lei_complementar_quadro_funcional`. Confirma que **os patches P2 de Pessoal precisam endereçar não só conjugação verbal mas também filtros semânticos de tipo de ato**. A precisão real do Fiscal está provavelmente entre 36,9% (limite inferior, sub-agents foram conservadores) e 67,6% (Ciclo 2). Re-eval pós-patch vai resolver.

**2. Locação se mantém em ~16% com escala 4x maior (n=476).** Confirma diagnóstico C2 — padrões de FP dominantes seguem os mesmos 6 originais (cross-block matching, designação fiscal, menção documental, aviso procura/cotação, Lei 13.303 estatais, Termo Fomento Lei 13.019). Patch P0 Locação tem o conjunto completo.

**3. Universos amostrais esgotados:** Locação (476), Convênios (75), Diárias (37), Publicidade (23), Geral (1). Para esses Fiscais, **toda análise futura roda contra o mesmo dataset**. Próxima ampliação possível: ondas de coleta com novas gazettes.

**4. Pessoal, Contratos, Licitações ainda têm pendentes:** 181 amostras dos shards 7 que não rodaram. Não bloqueia decisão de patches — todos os ADRs já têm root cause + adjustment definidos.

### Próximo passo

**Ciclo 4** começa após primeiro patch P0 (Convênios ou Diárias — mais fáceis) mergeado em `fiscal-digital`. Antes do C4:

1. **Completar rotulagem dos 181 pendentes** numa próxima janela de cota (sub-agents Opus continuam pré-configurados em `.tmp-pending-*.json`).
2. **Decidir prioridade de patch P0:** Diego escolhe entre Convênios (whitelist siglas federais) ou Diárias (word boundary + co-ocorrência) — ambos têm 0% e estão completamente diagnosticados.
3. **Re-rodar engine v1.5.0 contra os 1.514 rotulados atuais** para confirmar baseline antes do patch (regression test).

---

## Ciclo 4 — Engine v1.6.0 em prod (observação)

**Data início:** 2026-05-11
**Engine version:** v1.6.0 (com 7 patches mergeados em main de `fiscal-digital`)
**Amostras de referência:** 1.695 rotuladas no Ciclo 3 (universo amostral esgotado em prod)
**Status:** em observação por 30 dias

### O que mudou (v1.5.0 → v1.6.0)

7 PRs P0/P1/P2 mergeados sequencialmente em 2026-05-11 (após validação local com octopus merge + suite 226/233 passing + eval:synthetic com FPs caindo 21→7 = −66%):

| PR | Fiscal | Tier | Pre-patch | Filtros aplicados |
|---|---|---|---:|---|
| [#16](https://github.com/fiscal-digital/fiscal-digital/pull/16) | Locação | P0 | 16,0% | 12 stopwords (designação fiscal, Termo Aditivo, RESCISÃO, AVISO, Decreto, ANEXO, SÚMULA, Lei 13.303, Termo Fomento, rol documental, cláusulas, Pregão) |
| [#17](https://github.com/fiscal-digital/fiscal-digital/pull/17) | Diárias | P0 | 0,0% | Trigger restrito + 19 stopwords (ARP/Pregão/hotel, locação veículo, dotação 3.3.90.14, polissemia) + verbo autorização |
| [#18](https://github.com/fiscal-digital/fiscal-digital/pull/18) | Convênios | P0 | 0,0% | 4 filtros (Contrato Repasse federal MTUR/MDR/MAPA, contraparte não-OSC, decreto orçamentário, polaridade negativa) |
| [#19](https://github.com/fiscal-digital/fiscal-digital/pull/19) | Publicidade | P0 | 8,7% | 18 stopwords (cabeçalho DO, designação fiscal, publicação legal, concessão outdoor, atribuição funcional, polissemia Fiscal) |
| [#20](https://github.com/fiscal-digital/fiscal-digital/pull/20) | Pessoal | P2 | 31,6% | 14 stopwords (comunicado convocação, vaga substituição, texto normativo, ratificação retroativa, Lei Complementar, "tornar sem efeito", FG/GIP, concurso público) + exceção transição mandato |
| [#21](https://github.com/fiscal-digital/fiscal-digital/pull/21) | Licitações | P2 | 37,3% | 3 filtros vazamento escopo + 5 hipóteses sem teto (Art. 75 III/IV/VIII/IX/XV) |
| [#22](https://github.com/fiscal-digital/fiscal-digital/pull/22) | Contratos | P1 | 10,0% | 4 defensivos (floor R$ 5k, % declarado, instrumento fora escopo, reajuste legal Art. 124); cross-ref `suppliers-prod` formal como follow-up |

Tests engine: **226/233 passing** (+25 vs baseline 201/208, zero regressões).
Eval sintético pós-patch: **FPs caíram 21→7 (−66%)** com 0 TPs perdidos.

### Plano de observação (30 dias — até 2026-06-10)

1. **Coleta diária via fluxo normal** (collector → analyzer → publisher) com engine v1.6.0 em todas as 50 cidades cobertas. Nenhum smoke test sintético.
2. **Monitorar findings publicados em [fiscaldigital.org/alertas](https://fiscaldigital.org/alertas)** — meta: ≥ 5 TPs reais e ≤ 1 FP por Fiscal antes de declarar pronto.
3. **Threshold de reativação SSM** (decisão operacional do Diego, separada do treshold de avaliação 85%): para cada Fiscal hoje publicando, manter; para Fiscais que não publicam (Locação/Diárias/Convênios/Publicidade ainda em P0), aguardar primeiro TP real validado por humano + 0 FPs em 7 dias antes de reativar SSM.
4. **Issue de feedback público** em https://github.com/fiscal-digital/fiscal-digital-evaluations/issues — convidar juristas, jornalistas e cidadãos a reportar FPs ou FNs durante a janela de 30 dias.

### Métricas de sucesso esperadas (Ciclo 5 — 2026-06-10)

- ≥ 5 dos 7 Fiscais com precisão ≥ 85% após patch (vs 0 dos 7 em C3).
- Contratos abaixo de 85% se cross-ref suppliers-prod ainda não foi implementado (depende de skill follow-up — TODO).
- Diárias e Convênios em observação prolongada se ainda não houver TPs reais coletados (universo de 37 e 75 amostras respectivamente é pequeno; novos casos chegam lentamente).

### Como reproduzir o Ciclo 4

```bash
# 1. Pull do engine pós-patch
cd ../fiscal-digital && git checkout main && git pull

# 2. Build engine v1.6.0
npm run build -w packages/engine

# 3. Rodar eval contra golden set (mock LLM — comparação descritiva)
cd ../fiscal-digital-evaluations && npm run eval

# 4. Rodar eval sintético (regression real)
npm run eval:synthetic

# 5. Observar findings reais publicados em prod
curl https://api.fiscaldigital.org/alerts | jq '.[] | {fiscalId, riskScore, narrative}'
```

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
