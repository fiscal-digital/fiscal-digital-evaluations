# Baseline v1.5.0 — Fiscal Digital Engine

**Data da avaliação:** 2026-05-10
**Engine version:** v1.5.0
**Status:** Ciclo 3 PARCIAL — 1.514/1.695 amostras rotuladas (181 pendentes)

> **Conclusão do Ciclo 3 parcial (2026-05-10):** Ciclo 3 ampliou o golden set de 1.016 para 1.695 amostras reais (esgota universo amostral). 498 das 679 novas foram rotuladas por sub-agents Opus em paralelo; 181 pendentes (Pessoal shard1=136, Contratos=24, Licitações=21) devido ao limite de cota Anthropic. **Ciclo 3 confirma o resultado do Ciclo 2: nenhum Fiscal atinge 85%**. Pessoal cai de 67,6% → 36,9% com escala (n=300 → n=572): as 269 novas amostras de Pessoal rotuladas vieram 0 TP / 269 FP, sugerindo que o shard amostral capturou os padrões originais novos de FP descobertos no C2 (vaga decorrente substituição, comunicado convocação, transição mandato, texto normativo).
>
> **Conclusão do Ciclo 2 (2026-05-10):** Ciclo 2 ampliou o golden set de 101 para 1.016 amostras reais. **Resultado revelou viés amostral severo no Ciclo 1**: Licitações caiu de 88,9% (n=20) para 37,4% (n=150). Conclusão: golden set < 50 amostras por Fiscal tem risco alto de mascarar bugs. Recomenda-se sempre validar com n ≥ 100 antes de declarar Fiscal "pronto". **Nenhum dos 7 Fiscais com amostragem completa atinge o piso de 85% de precisão** — todos requerem patches.

**Avaliadores:**
- Ciclo 1 (101 amostras): claude-opus-4-7 manual (40) + 7 sub-agents paralelos (61)
- Ciclo 2 (915 novas): 14 sub-agents claude-opus-4-7 em paralelo (rodadas em 2 ondas devido ao limite de cota)
- Ciclo 3 (498 novas rotuladas até 2026-05-10): 4 sub-agents claude-opus-4-7 paralelos (Locação shard 1/2, Pessoal shard 2/3). Demais shards (pessoal-1, contratos-1, licitações-1 = 181 amostras) preparadas como `.tmp-pending-*.json` na raiz do repo, aguardando próxima janela de cota.

**Cobertura de Fiscais com amostras reais:** 8 de 10 (Nepotismo e Fornecedores ainda sem amostras — ver [`GAP_REPORT.md`](GAP_REPORT.md))

---

## Quadro de precisão por Fiscal

### Ciclo 1 (n=101) — baseline inicial

| Fiscal | TP | FP | Borderline | Total | Precisão (TP/(TP+FP)) | Status |
|---|---:|---:|---:|---:|---:|---|
| **FiscalPessoal** | 18 | 6 | 1 | 25 | **75,0%** | abaixo do piso 85% |
| **FiscalLicitações** | 16 | 2 | 2 | 20 | **88,9%** | ~~OK~~ enviesamento amostral |
| **FiscalContratos** | 6 | 12 | 2 | 20 | **33,3%** | CRÍTICO — depende de EVO-002 |
| **FiscalDiárias** | 0 | 10 | 0 | 10 | **0,0%** | CRÍTICO — overmatch sistemático |
| **FiscalLocação** | 0 | 10 | 0 | 10 | **0,0%** | CRÍTICO — sem filtro de tipo de ato |
| **FiscalConvênios** | 0 | 10 | 0 | 10 | **0,0%** | CRÍTICO — confunde Repasse federal |
| **FiscalPublicidade** | 0 | 6 | 0 | 6 | **0,0%** | CRÍTICO — keyword polissêmica |
| **TOTAL** | **40** | **56** | **5** | **101** | **41,7%** | — |

### Ciclo 2 (n=1.016) — baseline definitivo

| Fiscal | TP | FP | Borderline | Total | Precisão | Δ vs C1 | Gap p/ 85% |
|---|---:|---:|---:|---:|---:|---:|---:|
| **FiscalPessoal** | 194 | 93 | 13 | 300 | **67,6%** | −7,4pp | −17,4pp |
| **FiscalLicitações** | 52 | 87 | 11 | 150 | **37,4%** | **−51,5pp** ⚠️ | −47,6pp |
| **FiscalLocação** | 44 | 180 | 26 | 250 | **19,6%** | +19,6pp | −65,4pp |
| **FiscalContratos** | 20 | 157 | 3 | 180 | **11,3%** | **−22,0pp** ⚠️ | −73,7pp |
| **FiscalPublicidade** | 2 | 21 | 0 | 23 | **8,7%** | +8,7pp | −76,3pp |
| **FiscalConvênios** | 0 | 68 | 7 | 75 | **0,0%** | 0pp | −85,0pp |
| **FiscalDiárias** | 0 | 37 | 0 | 37 | **0,0%** | 0pp | −85,0pp |
| **FiscalGeral** | 1 | 0 | 0 | 1 | **100,0%** | n/a | n/a |
| **TOTAL** | **313** | **643** | **60** | **1.016** | **32,7%** | — | — |

### Ciclo 3 parcial (n=1.514 rotuladas de 1.695) — esgotamento amostral em curso

| Fiscal | TP | FP | Borderline | Pendentes | Total | Precisão (rotulados) | Δ vs C2 |
|---|---:|---:|---:|---:|---:|---:|---:|
| **FiscalPessoal** | 194 | 332 | 46 | 136 | 708 | **36,9%** | **−30,7pp** ⚠️ |
| **FiscalLocação** | 72 | 378 | 26 | 0 | 476 | **16,0%** | −3,6pp |
| **FiscalContratos** | 20 | 157 | 3 | 24 | 204 | **11,3%** | 0 |
| **FiscalLicitações** | 52 | 87 | 11 | 21 | 171 | **37,4%** | 0 |
| **FiscalConvênios** | 0 | 68 | 7 | 0 | 75 | **0,0%** | 0 |
| **FiscalDiárias** | 0 | 37 | 0 | 0 | 37 | **0,0%** | 0 |
| **FiscalPublicidade** | 2 | 21 | 0 | 0 | 23 | **8,7%** | 0 |
| **FiscalGeral** | 1 | 0 | 0 | 0 | 1 | **100,0%** | 0 |
| **TOTAL** | **341** | **1.080** | **93** | **181** | **1.695** | **24,0%** | — |

> ⚠️ **Pessoal queda atípica (67,6% → 36,9%):** 269 novas amostras rotuladas (shards 2 e 3) vieram 0 TP / 269 FP. A distribuição é estatisticamente anômala vs C2 (que tinha 64,7% TP em 300). Hipóteses: (a) escala revelou massa de FPs novos descobertos no C2 (comunicado_convocacao_nao_e_nomeacao, vaga_decorrente_substituicao_individual, texto_normativo_mencao_palavra_nomeacao); (b) viés do sub-agent para classificar conservadoramente como FP quando excerpt é ambíguo. Ambas hipóteses são consistentes com os ADRs do C2 que apontam a regex de Pessoal como majoritariamente overmatch. Para o Ciclo 4 (pós-patch P2 Pessoal), confirmar via re-eval do patch contra esses 526 rotulados.

⚠️ **Achados críticos:**
1. **Nenhum Fiscal atinge o piso de 85%** — todos requerem patches.
2. **Viés amostral confirmado:** Licitações 88,9% (Ciclo 1, n=20) → 37,4% (Ciclo 2, n=150). Golden set < 50 amostras mascara bugs.
3. **Bug central de Contratos é mais grave que estimado:** Ciclo 1 mostrou 33,3% sobre 20 amostras; Ciclo 2 confirma 11,3% sobre 180. Aditivos sem cross-reference (suppliers-prod GSI) geram 89% de FP.
4. **TPs reais aparecem com escala:** Locação salta de 0% (n=10) para 19,6% (n=250) — bug não é total, há detecção real misturada com overmatch.
5. **FiscalPessoal mais próximo do piso:** 67,6% — patch de regex + filtros de transição/ratificação retroativa pode chegar perto de 85%.

**Leitura:** dos 96 findings classificados como TP+FP, apenas 41,7% são verdadeiros achados de irregularidade. Os 4 Fiscais com 0% precisão geraram **42 FPs publicados ou publicáveis em prod** (a métrica deteriora se incluirmos os 5 borderline como FP).

---

## Top root causes (cross-Fiscal)

| Causa | Ocorrências | Fiscais afetados |
|---|---:|---|
| `missing_cross_contract_lookup` / `missing_original_contract_value` | 13 | Contratos |
| `regex_overmatch_unidade_medida` (raiz "diária" sem word boundary nem contexto) | 4 | Diárias |
| `regex_matches_fiscal_designation_as_new_contract` | 3 | Locação |
| `regex_false_positive_keyword` (divulgação/comunicação polissêmico) | 3 | Publicidade |
| `regex_undercount_compensated_by_other_signal` (verbo conjugado NOMEIA) | 2 | Pessoal |
| Confusão Contrato de Repasse federal (Lei 8.666) com Termo de Fomento Lei 13.019 | 6 | Convênios |
| Decreto orçamentário tratado como ato de contratação | 3 | Diárias, Convênios |
| Termo Aditivo / Renovação tratado como nova inexigibilidade | 4 | Locação, Contratos |

---

## Achados estruturais comuns aos 4 Fiscais com 0% precisão

1. **Word boundary ausente** — `/diária/`, `/locação/`, `/publicidade/`, `/convênio/` matcham substrings em advérbios, derivações e contextos não-financeiros.
2. **Filtro de tipo de ato ausente** — Fiscais não distinguem novo contrato de aditivo, designação de fiscal, rescisão, prorrogação ou regulamento tributário.
3. **Filtro de papel municipal ausente** — disparos em casos onde o município é regulador (programa social, regulamento) e não contratante.
4. **Falta de busca contextual no PDF inteiro** — engine só lê o excerpt, perdendo: justificativas em outras seções, "chamamento público" referenciado em ato anterior, valor original do contrato em capítulo distinto.
5. **Ausência de deduplicação por excerpt-hash** — pares duplicados encontrados em Diárias (GS-014↔GS-091, GS-015↔GS-048) e Convênios (GS-095=GS-056).

---

## Roadmap de correção (prioridades)

### P0 — Correções urgentes antes de manter Fiscal publicando

- **FiscalConvênios:** desligar publicação até filtrar Contrato de Repasse federal (whitelist: MTUR, MDR, MAPA, MS, MEC, MJ, MMA, MCID, MCIDADANIA). [`analyses/fiscal-convenios/ADR-001`](analyses/fiscal-convenios/ADR-001-contrato-repasse.md)
- **FiscalDiárias:** word boundary + co-ocorrência obrigatória com pagamento+R$+CPF/matrícula. Excluir ata RP de hotel, locação de veículo, dotação 3.3.90.14. [`analyses/fiscal-diarias/ADR-001`](analyses/fiscal-diarias/ADR-001-overmatch.md)
- **FiscalLocação:** filtro de tipo de ato (excluir designação de fiscal, rescisão, aditivo, programa social) + exigir co-ocorrência com `imóvel|prédio|sede`. [`analyses/fiscal-locacao/ADR-001`](analyses/fiscal-locacao/ADR-001-overmatch.md)
- **FiscalPublicidade:** restringir keyword a termos de objeto contratual estrito (não polissêmicos como "divulgação"). Excluir publicação legal e concessão patrimonial. [`analyses/fiscal-publicidade/ADR-001`](analyses/fiscal-publicidade/ADR-001-keywords-overmatch.md)

### P1 — Bug central de Contratos (depende de EVO-002 já implementado)

- **FiscalContratos:** consultar `suppliers-prod` GSI por número do contrato antes de calcular % de aditivo. Floor de R$ 5.000 para evitar aditivos triviais. Capturar `acréscimo de XX,YY%` declarado no texto. [`analyses/fiscal-contratos/ADR-001`](analyses/fiscal-contratos/ADR-001-missing-original-value.md)

### P2 — Refino de FiscalPessoal e FiscalLicitações

- **FiscalPessoal:** patch regex para verbos conjugados (NOMEIA, EXONERA, DESIGNA), pattern "Port. Nº X — Nomeia NOME", contar pessoas distintas (não atos), tratar transição de mandato. [`analyses/fiscal-pessoal/ADR-001`](analyses/fiscal-pessoal/ADR-001-regex-conjugacao.md)
- **FiscalLicitações:** filtro de tipo de instrumento (excluir locação de imóvel → FiscalLocação; excluir designação de fiscal). Confusão de tetos obras/serviços. [`analyses/fiscal-licitacoes/ADR-001`](analyses/fiscal-licitacoes/ADR-001-classificacao-objeto.md)

---

## Calibração de score (`riskScore`)

Análise preliminar mostra que `riskScore` não correlaciona bem com TP em vários Fiscais:
- **FiscalPessoal:** TPs reais (10+ pessoas distintas) recebem riskScore **35-48** quando deveriam ser ≥ 80 (subnotificação por bug regex). Findings que passariam o gate de 60 dependem de regra adicional, não da magnitude real.
- **FiscalContratos:** aditivos de R$ 234 recebem riskScore alto sem cross-reference (não há base para calibrar enquanto valor original não está disponível).
- **FiscalDiárias:** todos os FPs receberam riskScore 60-85 (publicáveis).

**Recomendação:** após correções P0, recalibrar riskScore com regressão sobre TPs reais.

---

## Robustez de evidência

- **Excerpt selecionado mismatch:** GS-016 (Publicidade) tem excerpt sobre transporte escolar, mas finding alega "publicidade eleitoral". Engine selecionou trecho desconectado do termo gatilho.
- **Misattribution:** todos os PDFs avaliados têm `evidence[0].source` apontando corretamente para o Querido Diário. Sem casos de URL incorreta.

---

## Defensibilidade legal

- **Convênios:** referência a "Lei 13.019" em narrativas de Contratos de Repasse federal (Lei 8.666) é juridicamente errada. **Risco de retratação alto.**
- **Publicidade:** narrativa cita "Lei 9.504/97 Art. 73 VI 'b'" em contratações fora da janela eleitoral. **Risco jurídico médio** (defesa fácil pela contraparte).
- **Demais Fiscais:** base legal corretamente referenciada quando finding é TP.

---

## Validação contra dataset SINTÉTICO (Fase 2 — pré-patch)

55 amostras sintéticas (11 por Fiscal: 3 TP textbook + 5 FP réplica + 3 FP edge case) rodadas contra engine v1.5.0 com extractor regex realista (substitui Bedrock para excerpts limpos):

| Fiscal | TP detectados | FP confirmados | TN filtrados | FN (gap cobertura) |
|---|---:|---:|---:|---:|
| FiscalDiárias | 3/3 | **7/8** | 1/8 | 0 |
| FiscalLocação | 3/3 | **6/8** | 2/8 | 0 |
| FiscalPublicidade | 3/3 | **4/8** | 4/8 | 0 |
| FiscalConvênios | 0/3 | **4/8** | 4/8 | **3/3** |
| FiscalContratos | 1/3 | 0/8 | 8/8 | **2/3** |
| **Total** | 10/15 | 21/40 | 19/40 | 5/15 |

**Achados:**
- **21 FPs confirmados** em sintéticos (réplica dos padrões reais identificados nos ADRs).
- **FiscalConvênios também tem subnotificação** (3 TPs não detectados): possível threshold de valor alto demais ou regex `isAcordoCooperacaoSemRepasse` capturando TPs erradamente. Investigar antes do patch P0.
- **FiscalContratos detecta apenas 1 dos 3 TPs offline**: confirma dependência forte de `suppliers-prod` cross-reference para casos onde valor original não está no excerpt.
- **FiscalDiárias detecta 3/3 TPs textbook**: bug não é de cobertura, é exclusivamente de overmatch.

**Métrica de sucesso pós-patch:**
- Cada Fiscal deve atingir **0 FPs nos sintéticos** mantendo **3/3 TPs** detectados.
- Threshold mínimo para reativação de publicação: 100% sintético + ≥ 5 TPs em prod com ≤ 1 FP em janela de 30 dias.

---

## Próxima reavaliação

Após cada PR de correção (P0/P1/P2), rerodar:
1. `npm run eval` (golden set real v1.5.0) — medir delta de precisão real.
2. `npm run eval:synthetic` (dataset sintético) — validar regression tests.

Política: **não merge sem regression test** por amostra do golden set citada no PR.

Próximo baseline: **v1.6.0** após P0 + P1 fechados.
