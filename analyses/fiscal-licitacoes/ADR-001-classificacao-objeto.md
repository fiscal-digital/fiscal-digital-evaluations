# ADR-001 — FiscalLicitações confunde locação de imóvel e designação de fiscal com dispensa por valor

**Status:** Aceito (refino — P2)
**Data:** 2026-05-10
**Precisão atual:** 88,9% (16 TP / 2 FP em 20 amostras, 2 borderline)
**Severidade:** P2 — Fiscal funciona bem mas tem vazamento de escopo

---

## Contexto

FiscalLicitações detecta dispensas/inexigibilidades acima do teto da Lei 14.133 Art. 75 (R$ 100k obras / R$ 50k serviços e compras) sem fundamentação adequada.

Avaliação contra 20 amostras: precisão **88,9%** — melhor Fiscal do golden set. Os 2 FPs são vazamento de escopo (atos que pertencem a outros Fiscais).

---

## Padrões de FP encontrados

### Padrão 1 — Locação de imóvel tratada como dispensa por valor (2 casos)

| ID | Detalhe |
|---|---|
| GS-077 | OMC IMOBILIÁRIA R$ 264.000 — locação da sede da SEMMA + termo aditivo |
| GS-081 | HELEN MARIANA R$ 300.929 — locação de imóvel para Escola Darcy Ribeiro (Art. 24 X — sem teto); ato é só designação de fiscal |

Ambos deveriam ser tratados pelo **FiscalLocação**, não FiscalLicitações. Locação de imóvel pela administração é hipótese específica (Art. 74 III Lei 14.133 / Art. 24 X Lei 8.666) com teto não aplicável.

### Padrão borderline — confusão obras vs serviços/compras (1 caso)

| ID | Detalhe |
|---|---|
| GS-074 | MAX CIRURGICA R$ 68.100 — agulhas de punção intraóssea, fundamento Art. 75 VIII (emergência sanitária — sem teto). Engine aplicou teto R$ 50k errado. |

---

## Decisão

### Patch técnico

1. **Filtro de tipo de instrumento — exclusão obrigatória:**
   ```regex
   /(LOCAÇÃO|locação)\s+DE\s+IMÓVEL/i      → roteia para FiscalLocação
   /Termo\s+Aditivo|prorrogação/i          → roteia para FiscalContratos
   /DESIGNAR.*(Gestor|Fiscal)\s+de\s+Contrato/i  → exclui (não é nova contratação)
   ```

2. **Classificação correta de objeto antes de aplicar teto:**
   - Vocabulário OBRA/REFORMA/ENGENHARIA: `obra|reforma|construção|edificação|pavimentação|engenharia\s+civil|drenagem|terraplenagem|recuperação\s+estrutural` → teto **R$ 100k** (Art. 75 I).
   - Tudo o mais → teto **R$ 50k** (Art. 75 II).
   - Default conservador: se ambíguo, marcar `borderline` (não emitir TP).

3. **Detector de hipóteses sem teto (Art. 75 III, IV, VIII):**
   - III (a) fornecedor exclusivo declarado: validar se há `inexigibilidade.*art\.\s*74\s*I|fornecedor\s+exclusivo|única\s+fornecedora` no texto.
   - IV emergência ou calamidade: aceitar `emergência|calamidade|urgência\s+(declarada|sanitária)|estado\s+de\s+(emergência|calamidade)\s+pública`.
   - VIII insumos saúde: validar `medicamento|insumo\s+(médico|hospitalar|farmacêutico)|órtese|prótese`.
   - Se o ato cita uma dessas hipóteses E o objeto faz sentido (ex: agulhas + emergência sanitária), marcar como `legal_dispensa` (skip).

### Operacional

- Manter publicação ativa (precisão 88,9% aceitável). Patch reduz vazamento sem deteriorar cobertura.

---

## Regression tests obrigatórios

### TPs (devem continuar disparando)

GS-075 (LIZ TUR — fracionamento transporte escolar), GS-076 (SLOMP — concreto, Art. 75 III "a" mal aplicado), GS-078 (CODECA — coleta resíduos, Art. 75 IX), GS-079 (VIAÇÃO GIRATUR — emergência inadequada), GS-080 (BRAGÉ — fracionamento) e os 11 TPs do batch anterior.

### FPs (devem parar de disparar)

GS-077, GS-081 — devem retornar `no_finding` (roteamento para FiscalLocação).

### Borderline (deve ser reclassificado como legal_dispensa)

GS-074 — após patch do detector de Art. 75 VIII, deve retornar `no_finding`.

---

## Métrica de sucesso

- Precisão pós-patch: ≥ 95%.
- 0 FPs do golden set v1.5.0 disparando.
- Cobertura preservada: todos os 16 TPs atuais continuam.
