# Gap Report — Fiscais sem amostras reais para avaliar

**Data:** 2026-05-10
**Engine version:** v1.5.0

---

## Princípio: só amostras reais

Este projeto recusa amostras sintéticas no golden set. Avaliação por casos hipotéticos introduz viés de criador. Apenas findings que **realmente dispararam em prod** entram no dataset rotulado.

A consequência é que Fiscais que não disparam em prod **não têm baseline de precisão mensurável neste momento**. Documentamos esse gap aqui, em vez de mascarar com sintéticos.

---

## Fiscais sem cobertura

### FiscalNepotismo — `nepotismo_indicio`

**Findings em `alerts-prod`:** 0
**Por que não dispara:**
- Threshold de confidence muito alto (≥ 0.95) por design — escolha conservadora justificada por risco reputacional catastrófico (FP acusa pessoa nominalmente).
- Heurística atual depende de "sobrenome incomum coincidente em cargo comissionado" — sem skill `lookup_kinship` (TSE/CPF), não há evidência forte para passar do threshold.

**Gap caracterizado:**
- **Recall desconhecido:** quantos casos reais de nepotismo o Fiscal **deveria** detectar e não detecta? Sem dataset rotulado de TPs reais, impossível medir.
- **Precisão desconhecida:** se baixarmos o threshold, quantos seriam FP? Sem dados, é palpite.

**O que destrava avaliação:**
1. Integração com TSE (consulta de parentesco via CPF) — projeto LGPD/jurídico próprio
2. OU baixar threshold para gerar findings em prod e auditar (custo: FPs públicos durante calibragem)

**Decisão atual:** manter conservador. Reavaliar quando `lookup_kinship` for integrado.

---

### FiscalFornecedores — `cnpj_jovem`, `concentracao_fornecedor`, etc.

**Findings em `alerts-prod`:** 0
**Por que não dispara:**
- Skills externas (BrasilAPI CNPJ + CGU CEIS/CNEP) são chamadas só quando finding base já está acima do gate
- Schema `suppliers-prod` cross-supplier acabou de ser implementado (EVO-002, 2026-05-09) — analisar não usa ainda

**Gap caracterizado:**
- Aguardando primeira rodada com `enable-supplier-write=true` em prod gerar dados cross-supplier
- Reavaliar quando primeiros findings reais aparecerem (estimativa: 1-2 semanas pós-flip)

**Decisão atual:** monitorar `alerts-prod` semanalmente. Quando atingir 12 findings reais, importar para golden set.

---

### FiscalGeral — `padrao_recorrente`

**Findings em `alerts-prod`:** ~1
**Por que dispara pouco:**
- Requer ≥ 3 findings do mesmo CNPJ em 12 meses (cross-gazette)
- Histórico ainda novo (50k gazettes processadas, mas distribuídas em 50 cidades)
- Sem schema cross-supplier completo, agrupamento por CNPJ é parcial

**Gap caracterizado:**
- 1 amostra é insuficiente para baseline numérico
- Aguardando volume crescer com EVO-002 e mais ciclos diários

**Decisão atual:** importar a 1 amostra disponível, marcar baseline como "insuficiente". Reavaliar mensalmente.

---

## Estratégia para preencher gap (longo prazo)

| Fiscal | Trigger para reavaliação |
|---|---|
| Nepotismo | Integração de skill `lookup_kinship` (TSE/CPF) — projeto separado |
| Fornecedores | Quando atingir 12 findings reais em `alerts-prod` (esperado em 2-4 semanas pós EVO-002) |
| Geral | Quando atingir 8 findings reais (esperado em 2-3 meses, depende de cross-supplier maduro) |

---

## Por que NÃO usamos amostras sintéticas

Considerado e rejeitado:

1. **Viés do criador:** quem cria o caso sintético tende a fazê-lo "perfeito" para o Fiscal detectar — superestima precisão.
2. **Distribuição não-realista:** amostras sintéticas raramente refletem ruído de OCR, formatação, abreviações regionais.
3. **Risco regulatório:** se publicarmos baseline baseado em sintéticos como se fossem reais, é falsa transparência.

A única forma honesta de avaliar é com dados que o sistema realmente encontrou em produção.

---

## Como contribuir para fechar gaps

Se você é jurista/jornalista e sabe de **caso real publicado em diário oficial brasileiro** que algum desses 3 Fiscais **deveria ter detectado**, abra Issue com:

- Link da gazette no [Querido Diário](https://queridodiario.ok.org.br)
- Trecho relevante (excerpt + número da página)
- Qual Fiscal deveria ter detectado e por quê (citar lei + artigo)

Casos validados pela maintainer entram no golden set como `label: "FN"` com referência à Issue.
