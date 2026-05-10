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
    eval-2026-05.md       — ADR completo com diagnóstico
    adjustments.md        — patches sugeridos (diff-style)
    regression-tests.md   — casos que validam fixes
  fiscal-licitacoes/
  fiscal-contratos/
  ...

reports/
  v1.5.0-baseline.md      — snapshot por release do engine

scripts/
  label-cli.mjs           — CLI para rotular novas amostras
  eval-fiscal.mjs         — roda Fiscal contra golden set, mede precisão
  extract-pdf.mjs         — baixa PDF do S3 e extrai texto
```

---

## Como o dataset é construído

1. **Importação:** findings reais de `alerts-prod` são amostrados (`scripts/label-cli.mjs --import`)
2. **Extração de PDF:** texto integral do diário oficial baixado do cache S3 (`scripts/extract-pdf.mjs`)
3. **Rotulagem:** análise comparativa entre o que o Fiscal alegou e o conteúdo real do diário
4. **Consolidação:** padrões de FP recorrentes viram ADRs por Fiscal
5. **Patches:** propostas técnicas geradas, revisadas, e aplicadas em PR no [`fiscal-digital`](https://github.com/fiscal-digital/fiscal-digital)

A análise inicial usa **Claude Opus 4.7** como auxiliar — declarado em cada ADR. Toda decisão final passa por revisão humana antes de virar patch.

---

## Como contribuir

Contribuições de juristas, jornalistas, pesquisadores e cidadãos interessados em fiscalização pública são bem-vindas. Ver [`CONTRIBUTING.md`](CONTRIBUTING.md).

Para metodologia detalhada, ver [`METHODOLOGY.md`](METHODOLOGY.md).

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
