# Baseline v1.5.0 — Fiscal Digital Engine

**Data da avaliação:** 2026-05-10
**Engine version:** v1.5.0
**Avaliador:** claude-opus-4-7 (40 amostras manuais) + 7 sub-agents claude-opus-4-7 paralelos (61 amostras)
**Amostras avaliadas:** 101/101 (100% do golden set)
**Cobertura de Fiscais com amostras reais:** 7 de 10 (Nepotismo, Fornecedores, Geral sem amostras — ver [`GAP_REPORT.md`](GAP_REPORT.md))

---

## Quadro de precisão por Fiscal

| Fiscal | TP | FP | Borderline | Total | Precisão (TP/(TP+FP)) | Status |
|---|---:|---:|---:|---:|---:|---|
| **FiscalPessoal** | 18 | 6 | 1 | 25 | **75,0%** | OK — bug de subnotificação |
| **FiscalLicitações** | 16 | 2 | 2 | 20 | **88,9%** | OK — refino fino |
| **FiscalContratos** | 6 | 12 | 2 | 20 | **33,3%** | CRÍTICO — depende de EVO-002 |
| **FiscalDiárias** | 0 | 10 | 0 | 10 | **0,0%** | CRÍTICO — overmatch sistemático |
| **FiscalLocação** | 0 | 10 | 0 | 10 | **0,0%** | CRÍTICO — sem filtro de tipo de ato |
| **FiscalConvênios** | 0 | 10 | 0 | 10 | **0,0%** | CRÍTICO — confunde Repasse federal |
| **FiscalPublicidade** | 0 | 6 | 0 | 6 | **0,0%** | CRÍTICO — keyword polissêmica |
| **TOTAL** | **40** | **56** | **5** | **101** | **41,7%** | — |

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
