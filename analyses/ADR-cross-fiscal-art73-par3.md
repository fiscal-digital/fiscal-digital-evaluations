<!-- legal-verified -->
# ADR cross-fiscal — Varredura de miscitação do Art. 73 §3º (Lei 9.504/97) em todos os fiscais

**Status:** Aplicado (2026-07-23 — repo `fiscal-digital-evaluations`, sem patch de engine)
**Data:** 2026-07-23
**Escopo:** documentação/verificação apenas (EVAL-002). Close-out formal da varredura iniciada no EVAL-001.
**Relacionado:** ADR-002 (miscitação em fiscal-publicidade, Aplicado 2026-07-23), BUG-FSC-005 (informar-não-suprimir).

> Fonte legal canônica lida nesta sessão:
> `fiscal-digital/packages/engine/src/legal-corpus/lei-9504-1997/art-73.md` (sync planalto 2026-05-24).

---

## Contexto

O EVAL-001 corrigiu a única miscitação real do **Art. 73 §3º da Lei 9.504/97** — 20 amostras
sintéticas de `fiscal-publicidade` que invocavam o §3º como base de uma exceção automática de
saúde/calamidade (documentado no ADR-002). Este slice (EVAL-002) é o **close-out formal**:
confirmar, de forma reprodutível e auditável, que **nenhum outro fiscal** (golden-sets + regras/engine)
reutiliza o §3º fora do contexto correto, e corrigir uma nota factualmente errada do ADR-002.

## Fundamento legal (fonte canônica `art-73.md`)

- **§3º (linhas 130-133):** *"As vedações do inciso VI do caput, alíneas b e c, aplicam-se apenas aos
  agentes públicos das esferas administrativas cujos cargos estejam em disputa na eleição."* — o §3º
  trata de **qual esfera administrativa** está sujeita à vedação; **não** cria exceção material de
  saúde ou calamidade.
- **Inciso VI, alínea "b" (linhas 69-74):** a vedação de autorizar publicidade institucional nos três
  meses que antecedem o pleito vale *"salvo em caso de grave e urgente necessidade pública, **assim
  reconhecida pela Justiça Eleitoral**"* — a exceção real **exige reconhecimento judicial**; a mera
  alegação de calamidade/utilidade pública no contrato não a afasta por si só.

## Método (varredura reprodutível)

Executado a partir de `origin/main` (`621211b`), no repo `fiscal-digital-evaluations` e no engine
`fiscal-digital`:

```bash
# 1) Universo de menções a Lei 9.504 / Art. 73 (golden-set + analyses)
grep -rniE "9\.?504|art\.?\s*73" golden-set analyses --include=*.json --include=*.md

# 2) Marcadores de "parágrafo 3" no golden-set
grep -rnoE "§ *3|par[aá]grafo *3|3º" golden-set --include=*.json

# 3) CHAVE — §3º atrelado à Lei 9.504 fora de excerpt (base de exceção indevida)
grep -rnE "9\.?504" golden-set analyses --include=*.json --include=*.md \
  | grep -iE "§ *3" | grep -viE "\"excerpt\"|ADR-002"

# 4) Classificação das citações de Art. 73 em campos de RÓTULO
grep -rhoE "Art\.?\s*73[,º]?\s*(§\s*[0-9]|[IVX]+)" golden-set --include=*.json | sort | uniq -c

# 5) Engine — §3º atrelado a Art. 73 em código (não-comentário)
grep -rnE "Art\.?\s*73\s*§\s*3" fiscal-digital/packages/engine/src/fiscais --include=*.ts | grep -v "//"
```

## Resultado — 0 correções residuais

| Verificação | Saída |
|---|---|
| §3º atrelado à Lei 9.504 **fora de excerpt** (grep 3) | **0** ocorrências |
| Citações de Art. 73 em `rationale`/`filterRule`/`legalBasis` (grep 4) | só `V` (fiscal-pessoal, 1008), `VI` (fiscal-publicidade, 100), `VII` (1), `§1º` (1); **nenhuma `§3º`** |
| `Art. 73 §3º` no golden-set (todas as 20 ocorrências) | **100% em campo `excerpt`** — input sintético proposital, deixado intacto |
| Engine `pessoal.ts` / `publicidade.ts` (grep 5) | cita `Art. 73, V` e `Art. 73, VI` corretamente; `§3º` aparece **só em comentário** de alerta contra a miscitação — **0** usos como exceção |

Todos os hits de `§3` fora de excerpt caem em **estatutos distintos** (não são o Art. 73 §3º):
`Lei 13.019/2014 §3º Art. 84` (regime de convênios), `Lei 14.820/2024 Art. 4º §3º` (hospital
filantrópico CEBAS/SUS), ou seções de ADR (`ADR-001 §3.x`). Nenhum é miscitação do Art. 73.

### Tabela de arquivos varridos

| Arquivo | Resultado |
|---|---|
| `golden-set/samples.json` (reais) | `§3` só em excerpts crus e em `Lei 13.019 §3º Art. 84` (correto); `legalBasis`/`rationale` corretos. **Nada a fazer.** |
| `golden-set/synthetic/fiscal-publicidade/synthetic-samples.json` + `-batch2.json` | Excerpts citam `Art. 73 §3º` **de propósito** (alegação); `rationale`/`filterRule` já corrigidos no EVAL-001. **Nada a fazer.** |
| `golden-set/synthetic/fiscal-convenios/synthetic-samples-batch2.json` | `§3` só em `Art. 4º §3º da Lei 14.820/2024` (EDGE-034..052 / SYN-086..) — estatuto distinto, correto. **Nada a fazer.** |
| `golden-set/synthetic/fiscal-pessoal/*` | Art. 73 citado como inciso `V` (nomeação vedada), correto. **Nada a fazer.** |
| `golden-set/synthetic/fiscal-diarias/*` | `§3` refere-se a seções de `ADR-001 §3.x`, não a lei. **Nada a fazer.** |
| `fiscal-digital/packages/engine/src/fiscais/pessoal.ts` | `Art. 73, V` correto. |
| `fiscal-digital/packages/engine/src/fiscais/publicidade.ts` | `Art. 73, VI "b"/VII` correto; comentário alerta contra a miscitação do §3º. |

## Reclassificação do `SYN-CONV-FP-EDGE-042` (falso alarme)

O ADR-002 registrava, entre os "achados laterais", que `SYN-CONV-FP-EDGE-042` (`fiscal-convenios`)
"também referencia §3 da Lei 9.504/97". **Isso estava factualmente errado** — verificado nesta sessão
abrindo a amostra (`synthetic-samples-batch2.json`, id `SYN-CONV-FP-EDGE-042`):

- Contraparte: **Santa Casa de Misericórdia de Sorocaba**, entidade beneficente certificada CEBAS,
  integrante do SUS (Termo de Colaboração nº 029/2024, prestação de serviços hospitalares SUS).
- Fundamento legal citado no excerpt: *"conforme **Art. 4º, §3º da Lei 14.820/2024**"* (regime jurídico
  específico de entidades filantrópicas/beneficentes na saúde) c/c Lei 12.101/2009 (CEBAS) e
  Lei 8.080/90 (SUS).

Trata-se de um **estatuto completamente diferente** da Lei 9.504/97 Art. 73 (conduta vedada em ano
eleitoral). A citação está **correta no seu contexto** e **não** é a mesma classe de miscitação
tratada no ADR-002. **Reclassificado como falso alarme; nada a corrigir em `fiscal-convenios`.** A nota
do ADR-002 foi corrigida em conjunto com este ADR.

## Decisão

1. **Nenhuma correção de dados ou de engine** — a varredura confirma 0 correções residuais em todos os
   fiscais. A única miscitação real (fiscal-publicidade) já foi entregue no EVAL-001.
2. **Excerpts sintéticos preservados** — o `Art. 73 §3º` nos excerpts é input proposital que o Fiscal
   deve tratar como alegação não comprovada; não é editado.
3. **Nota do ADR-002 sobre o EDGE-042 corrigida** e o achado reclassificado como falso alarme.
4. Card EVAL-002 pode ser fechado como **"entregue (varredura confirmada, 0 correções residuais)"**.

## Critérios de aceite

- [x] Grep documentado: **0** ocorrências de §3º usado como base de exceção em
      `rationale`/`filterRule`/`legalBasis` de qualquer fiscal.
- [x] Nota do ADR-002 sobre `SYN-CONV-FP-EDGE-042` corrigida (não afirma mais miscitação da 9.504).
- [x] ADR consolidado presente, com `<!-- legal-verified -->` e citação das linhas de `art-73.md`
      (§3º: 130-133; VI "b": 69-74).
- [x] Nenhuma amostra sintética de `excerpt` alterada; contagens de amostras idênticas
      (`git diff --stat` toca só `.md`).
