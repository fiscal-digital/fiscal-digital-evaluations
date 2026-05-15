# Fiscal Digital — Evaluations

## Hierarquia de contexto (lê PRIMEIRO)

Antes de qualquer trabalho aqui, **abrir e ler [`../fiscal-digital/CLAUDE.md`](../fiscal-digital/CLAUDE.md)**.

Esse é o documento mestre do projeto. Princípios inegociáveis, governança open source, contrato com brand pack, estrutura dos 10 Fiscais. **Não duplicar conteúdo aqui.**

---

## Escopo local

Este repo é a **avaliação pública dos Fiscais**. Contém:

- Golden set rotulado de findings reais (TP/FP/FN/borderline)
- ADRs por Fiscal com root cause + adjustment + regression test
- Baselines numéricos de precisão por release
- Dataset sintético complementar para regression test pré-PR

### Stack

- TypeScript / Node 24.x para scripts (`label-cli.mjs`, `bulk-import.mjs`, `eval-fiscal.mjs`, `extract-pdf.mjs`)
- AWS SDK v3 (DynamoDB, S3): apenas leitura de `alerts-prod` e `gazettes-cache-prod`
- Anthropic SDK (Claude Opus 4.7): análise inicial de FP, sempre revisada por humano

### Convenções específicas

- **Toda amostra é real**: sem casos sintéticos no `samples.json` (sintéticos vão em `golden-set/synthetic/`, marcados com `source: "synthetic"`)
- **Todo label tem rationale**: campo `rationale` cita PDF do diário oficial
- **Toda análise por LLM** declara modelo e versão (`evaluatedBy`, `evaluatedAt`)
- **Patches afetam o engine**: PR de patch vai em `fiscal-digital`, com regression test obrigatório citando amostra do golden set

### Meta de qualidade

≥ 85% de precisão por Fiscal sobre o golden set rotulado. Abaixo desse piso, ciclo de patch + revalidação continua. Não confundir com decisão operacional de publicação em prod (cabe ao mantenedor humano).

### Brand pack

Não usado neste repo (sem UI). Se algum relatório futuro incluir visualizações, usar tokens de `fiscal-digital-web/brand/colors.json`.
