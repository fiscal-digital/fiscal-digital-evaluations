# Fiscal Digital Evaluations

**Como o Fiscal Digital se autoavalia.** Golden set rotulado, ADRs por Fiscal, baselines de precisão por release.

[fiscaldigital.org](https://fiscaldigital.org) · [fiscal-digital](https://github.com/fiscal-digital/fiscal-digital) (engine) · [@FiscalDigitalBR](https://x.com/FiscalDigitalBR)

---

## Por que este repositório existe

Os princípios inegociáveis do Fiscal Digital incluem **Verificabilidade pública**: qualquer cidadão deve poder checar como o sistema chega aos alertas que publica. Isso vale também para a auto-avaliação do próprio sistema.

Este repositório é a aplicação radical desse princípio à fiscalização interna:

- **Golden set rotulado:** dataset de findings reais classificados como TP (true positive), FP (false positive), FN (false negative) ou borderline
- **ADRs por Fiscal:** análises detalhadas de padrões de erro em cada um dos 10 Fiscais
- **Baselines por release:** snapshots numéricos de precisão a cada versão do engine
- **Patches sugeridos:** propostas técnicas (regex, threshold, prompt) para reduzir falsos positivos

Tudo aqui é público, versionado e auditável. Críticas a metodologia são bem-vindas via Issues.

---

## Estrutura

```
golden-set/
  samples.json     — dataset rotulado (versionado)
  pdfs/            — texto extraído dos diários oficiais usados na avaliação
  changelog.md     — cada amostra adicionada/modificada

analyses/
  fiscal-pessoal/
    ADR-001-*.md          — análise consolidada com root cause + adjustment + regression test
  fiscal-licitacoes/
  fiscal-contratos/
  fiscal-diarias/
  fiscal-locacao/
  fiscal-convenios/
  fiscal-publicidade/

golden-set/synthetic/     — dataset sintético controlado (regression tests)
  fiscal-{X}/
    synthetic-samples.json  — 11 amostras por Fiscal (3 TP textbook + 5 FP réplica + 3 FP edge case)

reports/
  v1.5.0-baseline.md      — snapshot por release do engine

scripts/
  label-cli.mjs           — CLI interativa para rotular 1 amostra por vez
  bulk-import.mjs         — importa lote de amostras de alerts-prod (plano alvo)
  extract-pdf.mjs         — baixa PDF do S3 cache + fallback Querido Diário
  eval-fiscal.mjs         — roda Fiscais contra golden set real, mede precisão
  eval-synthetic.mjs      — roda Fiscais contra dataset sintético (regression)
  merge-labels.mjs        — agrega outputs de sub-agents paralelos em samples.json
  update-sample.mjs       — atualiza campos de uma amostra específica
```

---

## Como o dataset é construído

O processo completo de cada ciclo de avaliação está documentado em [`TRAINING_CYCLES.md`](TRAINING_CYCLES.md), incluindo histórico, distribuição alvo, e fluxo passo-a-passo.

Resumo do fluxo:

1. **Importação:** findings reais de `alerts-prod` amostrados via `scripts/bulk-import.mjs` (em lote, com plano de distribuição) ou `scripts/label-cli.mjs --import` (1 Fiscal por vez)
2. **Extração de PDF:** texto integral do diário oficial baixado do cache S3, com fallback para [Querido Diário](https://queridodiario.ok.org.br) (`scripts/extract-pdf.mjs --all`)
3. **Rotulagem:** análise comparativa TP/FP/FN/borderline entre o que o Fiscal alegou e o conteúdo real do diário (`scripts/label-cli.mjs` para humano; sub-agents Opus paralelos para escala)
4. **Consolidação:** padrões de FP recorrentes viram **ADRs por Fiscal** em `analyses/{fiscal-id}/`
5. **Sintéticos controlados:** dataset complementar em `golden-set/synthetic/{fiscal-id}/` com 3 TP textbook + 5 FP réplica + 3 FP edge case por Fiscal — usados como regression test antes de PR
6. **Patches:** propostas técnicas aplicadas em PR no [`fiscal-digital`](https://github.com/fiscal-digital/fiscal-digital), com regression test obrigatório citando amostra do golden set

A análise inicial usa **Claude Opus 4.7** como auxiliar — declarado em cada ADR. Toda decisão final passa por revisão humana antes de virar patch.

**Meta de qualidade:** ≥ 85% de precisão por Fiscal sobre o golden set rotulado. Abaixo desse piso, o ciclo de patch + revalidação continua.

---

## Documentação

| Doc | Conteúdo |
|---|---|
| [`METHODOLOGY.md`](METHODOLOGY.md) | 5 dimensões de avaliação, schema da amostra, critérios TP/FP/FN por Fiscal |
| [`TRAINING_CYCLES.md`](TRAINING_CYCLES.md) | Histórico dos ciclos, fluxo de treinamento, como reproduzir |
| [`BASELINE.md`](BASELINE.md) | Snapshot numérico da última avaliação |
| [`GAP_REPORT.md`](GAP_REPORT.md) | Fiscais sem amostra suficiente em prod (Nepotismo, Fornecedores, Geral) |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Como propor novas amostras, criticar metodologia, contribuir labels |
| [`analyses/{fiscal-id}/`](analyses/) | ADRs por Fiscal: root cause + adjustment técnico + regression test |

## Como contribuir

Contribuições de juristas, jornalistas, pesquisadores e cidadãos interessados em fiscalização pública são bem-vindas. Ver [`CONTRIBUTING.md`](CONTRIBUTING.md).

---

## Licenças

- **Código (`scripts/`):** [MIT](LICENSE)
- **Dataset e análises (`golden-set/`, `analyses/`, `reports/`):** [CC-BY 4.0](LICENSE-DATA)

Derivações livres com crédito.

---

## Inspiração

Este repositório segue o exemplo de transparência radical de:
- [Querido Diário](https://queridodiario.ok.org.br) (OKFN Brasil) — infraestrutura aberta de diários oficiais
- [Serenata de Amor](https://serenata.ai) (OKFN Brasil) — pioneira em IA cívica brasileira

Sem esses projetos, o Fiscal Digital não existiria. Este repositório é o que conseguimos retribuir em metodologia.
