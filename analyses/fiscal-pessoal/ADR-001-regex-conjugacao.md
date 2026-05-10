# ADR-001 — FiscalPessoal subnotifica por regex sem cobertura de verbos conjugados

**Status:** Aplicado (2026-05-10 — `fiscal-digital` PR a ser aberto)
**Data:** 2026-05-10
**Precisão pré-patch:** 75,0% Ciclo 1 (n=25) → 67,6% Ciclo 2 (n=300) → 36,9% Ciclo 3 (n=572 rotuladas)
**Precisão pós-patch:** a medir contra os mesmos 572 rotulados após merge
**Severidade:** P2 — patch incorpora 14 stopwords (ADR + 9 padrões C3 novos: comunicado convocação, vaga substituição, texto normativo, ratificação retroativa, Lei Complementar quadro, "tornar sem efeito", FG/GIP, concurso público, exoneração a pedido) + exceção transição mandato (janeiro pós-eleição dobra threshold)

---

## Contexto

FiscalPessoal detecta picos de nomeação (≥ 3 atos em janela eleitoral, ≥ 7 fora) e rotatividade anormal. Avaliação contra 25 amostras: precisão **75%**. Bom em precisão, mas com bug central de **subnotificação severa**.

---

## Bug central — regex `/nome[ao]/` não pega verbo conjugado

Pattern atual captura "nomeação", "nomeado(a)" mas falha em:
- `NOMEIA` (verbo conjugado)
- `EXONERA` (idem)
- `DESIGNA` (idem)
- Pattern normativo `Port. Nº X — Nomeia NOME` usado por capitais (São Luís, Guarulhos, Niterói)

**Evidências do golden set:**
- GS-066 (Guarulhos, 17 atos via Portarias 757-773/2024): riskScore **44** (deveria ser ≥ 80)
- GS-067 (Niterói, 10 pessoas distintas): riskScore **35**
- GS-070 (São Luís, ≥29 pessoas distintas): riskScore **48**

Cidades grandes/capitais sofrem mais — usam linguagem normativa formal.

---

## Padrões de FP encontrados (3 casos)

| ID | Padrão | Detalhe |
|---|---|---|
| GS-071 | `regex_capturou_ratificacao_retroativa` | Ratificação 2005 (CUELLAR) contada como nomeação atual; ADRIANA dispensada+designada contou 2x |
| GS-072 | `fiscal_nao_considera_transicao_de_mandato_municipal` | Janeiro de início de novo mandato — volume legítimo de transição |
| GS-073 | `regex_acionou_finding_sem_atender_limiar_publicavel` | Apenas 3 pessoas distintas (limiar fora-janela = 7); riskScore 35 deveria ter bloqueado |

---

## Decisão

### Patch técnico

1. **Expandir regex para verbos conjugados:**
   ```regex
   /(NOMEAR|NOMEIA(\b|R|R-SE|REI)?|NOMEAÇ[ÃA]O|NOMEAD[OA]S?|EXONERAR?|EXONERA(\b|R-SE)?|EXONERAÇ[ÃA]O|EXONERAD[OA]S?|DESIGNAR?|DESIGNA(\b|R-SE)?|DESIGNAÇ[ÃA]O|DESIGNAD[OA]S?)\b/i
   ```

2. **Pattern normativo capital:**
   ```regex
   /Port(aria)?\.?\s+N[º°]?\s*\d+(\/\d{4})?\s*[\-—–]\s*(Nomeia|Exonera|Designa|Nomear|Exonerar|Designar)\s+(o\s+)?(senhor|senhora|sr\.?|sra\.?)?\s*([A-ZÁÉÍÓÚÇÃÕ][a-záéíóúç]+\s+){2,}/g
   ```

3. **Contar pessoas distintas, não atos:**
   - Extrair nome próprio normalizado (lowercase + sem acentos) de cada ato.
   - Set de nomes distintos no gazette.
   - `n_distinct_persons` é o numerador para limiar.
   - Eliminação automática do FP "ADRIANA dispensada+designada" (GS-071).

4. **Detector de ratificação retroativa:**
   - Skip atos com `ratific[ao]\s+(retroativ[ao]|com\s+efeito\s+retroativo|a\s+contar\s+de\s+\d+\/\d+\/\d{4})` quando data referenciada > 2 anos antes da gazette.
   - Aplicar a GS-071 que ratifica nomeação de 2005.

5. **Exceção de transição de mandato:**
   - Janeiro de ano após eleição municipal (2025, 2029) → dobrar limiar (7→14, 3→6).
   - Aplicar a GS-072 (Guarulhos jan/2025).

6. **Aplicar gate `riskScore >= 60` antes de persistir** (já existe?). GS-073 com riskScore 35 não deveria ter virado finding visível — verificar se Onda 3 está aplicado em todos os caminhos.

7. **Recalibração de score:**
   - `riskScore` linear em `n_distinct_persons` capped em 100: `min(100, n*5)` em janela eleitoral, `min(100, n*3)` fora.
   - Após patch dos itens 1-2, GS-066/067/070 chegariam corretamente ≥ 80.

### Operacional

- Manter publicação ativa (precisão 75% é aceitável). Subnotificação não causa retratação pública, apenas perda de cobertura.
- Patch + reavaliação contra golden set v1.5.0 deve subir precisão para ≥ 85% e cobertura para ≥ 95% dos casos reais.

---

## Regression tests obrigatórios

### TPs do golden set (devem continuar disparando, agora com riskScore correto)

GS-065, GS-066, GS-067, GS-068, GS-069, GS-070 — todos com riskScore esperado ≥ 80 pós-patch (vs. 35-48 atual).

### FPs (devem parar de disparar)

GS-071, GS-072, GS-073 — devem retornar `no_finding` ou `riskScore < 60`.

---

## Métrica de sucesso

- Precisão pós-patch: ≥ 85%.
- Mediana de riskScore em TPs reais: ≥ 75 (vs. ~40 atual).
- 0 disparos em janeiro de ano de transição municipal.
