# Gate de Calibração do Rotulador — 2026-07-23

## ⚠️ O que este número é (e o que não é)

Os rótulos do golden set **não são humanos**. `labeledBy` das 1695 amostras: `claude-sonnet-4-6` (40), `claude-opus-4-7-via-subagent` (1655).

Portanto o κ abaixo mede **concordância IA-vs-IA**: quanto uma re-rotulagem rigorosa e cega (juiz) reproduz o rótulo-IA anterior (baseline). Isso é uma medida de **confiabilidade do processo e de quanto o baseline mudaria** sob re-rotulagem — **não** é acurácia contra verdade humana. Não existe âncora humana neste conjunto: κ alto significa processo estável, não significa rótulo correto. Dois modelos podem concordar e ambos estarem errados.

## Mecanismo

| Item | Valor |
|---|---|
| Juiz | `us.anthropic.claude-opus-4-6-v1` via Bedrock Converse (us-east-1) |
| Baseline rotulado por | claude-sonnet-4-6, claude-opus-4-7-via-subagent |
| Cegueira | juiz nunca recebe `label`/`rationale`/`rootCause`/`labeledBy` |
| Temperatura | 0 |
| Grounding | digest do PDF real + corpus legal canônico (`legal-corpus/`) + `*.legal.md` |
| Amostra | 60 julgadas de 60 selecionadas (alvo 60) |
| Seed | 20260723 (amostragem determinística) |
| Falhas do juiz | 0 |

## Amostragem estratificada (transparência total)

| Fiscal | Disponível | Selecionadas | Deixadas de fora | Labels disponíveis | Labels selecionados |
|---|---:|---:|---:|---|---|
| fiscal-contratos | 204 | 7 | 197 | FP:180 TP:20 borderline:4 | FP:5 TP:1 borderline:1 |
| fiscal-convenios | 75 | 3 | 72 | FP:68 borderline:7 | FP:2 borderline:1 |
| fiscal-diarias | 37 | 2 | 35 | FP:37 | FP:2 |
| fiscal-geral | 1 | 1 | 0 | TP:1 | TP:1 |
| fiscal-licitacoes | 171 | 6 | 165 | FP:99 TP:59 borderline:13 | FP:3 TP:2 borderline:1 |
| fiscal-locacao | 476 | 17 | 459 | FP:378 TP:72 borderline:26 | FP:14 TP:2 borderline:1 |
| fiscal-pessoal | 707 | 22 | 685 | FP:418 TP:194 borderline:95 | FP:14 TP:6 borderline:2 |
| fiscal-publicidade | 23 | 2 | 21 | FP:21 TP:2 | FP:1 TP:1 |
| **total** | **1694** | **60** | **1634** | | |

> 1 amostra(s) excluída(s) do universo elegível por não ter PDF extraído localmente.

> Amostragem estratificada por Fiscal (proporcional, com piso) **e por label dentro do Fiscal**. Estratificar por label é necessário porque ~71% do golden set é FP — sem isso a matriz de confusão teria células TP/borderline vazias. Isso **não** vaza o rótulo para o juiz: a estratificação ocorre na seleção, e o payload enviado ao juiz é higienizado. **Consequência estatística:** a amostra é deliberadamente enriquecida em TP/borderline, então κ e concordância aqui **não** são estimativas da população — são medidas por célula.

## Resultado global

- **N julgado:** 60
- **Concordância bruta (p₀):** 70.0%
- **κ de Cohen:** 0.236 (fraca)
- **PABAK (κ ajustado por prevalência/viés):** 0.550
- **Divergências:** 18 de 60

### Diagnóstico de marginais (por que κ ≪ p₀)

| Categoria | Baseline | Juiz | Deslocamento |
|---|---:|---:|---:|
| TP | 13 | 1 | -20.0 p.p. |
| FP | 41 | 52 | 18.3 p.p. |
| borderline | 6 | 7 | 1.7 p.p. |

deslocamento de prevalência ALTO: o juiz e o baseline usam as categorias em proporções muito diferentes. κ está sendo penalizado por marginais assimétricas (paradoxo do κ) — leia p₀ e PABAK junto com κ, e trate a diferença de prevalência como a principal descoberta.

Esta é a descoberta central do gate e precisa ser lida com cuidado: o juiz cego é **sistematicamente mais cético** que o baseline. Com marginais assimétricas, κ é penalizado mesmo quando a concordância bruta é razoável. **Os dados deste gate não permitem decidir quem está certo** — se o baseline super-rotula TP ou se o juiz é excessivamente conservador. Ambos são IA. É exatamente aqui que uma âncora humana deixa de ser desejável e passa a ser indispensável.

### Matriz de confusão (linha = baseline existente, coluna = juiz cego)

| baseline ↓ / juiz → | TP | FP | borderline | total |
|---|---:|---:|---:|---:|
| **TP** | 1 | 9 | 3 | 13 |
| **FP** | 0 | 39 | 2 | 41 |
| **borderline** | 0 | 4 | 2 | 6 |
| **total** | 1 | 52 | 7 | 60 |

## κ por Fiscal

| Fiscal | N | p₀ | κ | PABAK | Interpretação | Divergências |
|---|---:|---:|---:|---:|---|---|
| fiscal-contratos | 7 | 71.4% | 0.364 | 0.571 | fraca | 2 |
| fiscal-convenios | 3 | 100.0% | 1.000 | 1.000 | quase perfeita | 0 |
| fiscal-diarias | 2 | 100.0% | n/d | 1.000 | pe=1 (ambos usaram uma única categoria) — κ indefinido; use p₀/PABAK | 0 |
| fiscal-geral | 1 | 0.0% | n/d | -0.500 | n<2, κ indefinido | 1 |
| fiscal-licitacoes | 6 | 50.0% | 0.000 | 0.250 | desprezível | 3 |
| fiscal-locacao | 17 | 76.5% | 0.244 | 0.647 | fraca | 4 |
| fiscal-pessoal | 22 | 63.6% | 0.000 | 0.455 | desprezível | 8 |
| fiscal-publicidade | 2 | 100.0% | 1.000 | 1.000 | quase perfeita | 0 |

> **Não superinterprete linhas com N pequeno.** Com N < 10 o intervalo de confiança de κ cobre praticamente todo o intervalo útil; essas linhas servem para dizer *onde olhar*, não para decidir política de rotulagem.

## Derivabilidade: fato objetivo vs. julgamento

Classificação feita pelo próprio juiz sobre **como** chegou ao rótulo. É o sinal mais acionável do gate: onde o rótulo sai de aritmética/data/limite legal, automação é defensável; onde sai de juízo subjetivo, a concordância IA-vs-IA é fraca evidência de qualquer coisa.

| Grupo | N | % da amostra | p₀ | κ | Interpretação |
|---|---:|---:|---:|---:|---|
| fact-derivable | 55 | 91.7% | 72.7% | 0.109 | desprezível |
| judgment | 5 | 8.3% | 40.0% | 0.000 | desprezível |

## Grounding legal

- Citações do juiz resolvidas contra o corpus canônico: **58/60**
- Casos em que o juiz considerou a base legal alegada pelo finding **incorreta**: **56**

| Amostra | Base alegada | Juiz aponta | Nota |
|---|---|---|---|
| GS-033 | Lei 14.133/2021, Art. 75, II | Lei 8.666/93, Art. 24, VIII (equivalente ao Art. 75, IX da Lei 14.133/2021) | O finding alega violação do Art. 75, II da Lei 14.133/2021 (limite por valor para compras/serviços), mas a dispensa é fundamentada no Art. 24, VIII da Lei 8.666 |
| GS-048 | Lei 8.112/90, Art. 58 | Lei 8.112/90, Art. 58 | A Lei 8.112/90, Art. 58 trata de diárias a servidores por deslocamento. Aqui trata-se de Ata de Registro de Preços para contratação de serviço hoteleiro via pre |
| GS-088 | Lei 14.133/2021, Art. 125, §1º, I | Lei 14.133/2021, Art. 125, caput | O finding cita 'Art. 125, §1º, I', mas o Art. 125 não possui §1º com incisos — é artigo de caput único. A referência correta seria 'Art. 125, caput'. Além disso |
| GS-1016 | Lei 14.133/2021 (múltiplos artigos — ver findings relacionados) | Lei 8.666/93, Art. 24, IV | O finding alega Lei 14.133/2021, mas as dispensas publicadas no diário são fundamentadas na Lei 8.666/93, Art. 24, IV (emergência). Além disso, o meta-finding ' |
| GS-1023 | Lei 9.504/97, Art. 73, V; CF, Art. 37, V | Lei 9.504/97, Art. 73, V | A Lei 9.504/97, Art. 73, V é inaplicável: (1) abril de 2021 está fora de qualquer janela eleitoral; (2) o próprio Art. 73, V, alínea 'a' ressalva expressamente  |
| GS-1041 | Lei 9.504/97, Art. 73, V; CF, Art. 37, V | Lei 9.504/97, Art. 73, V, alínea 'a' | O finding cita Art. 73, V como vedação, mas omite a alínea 'a' que expressamente ressalva nomeação/exoneração de cargos em comissão e funções de confiança da pr |
| GS-1058 | Lei 9.504/97, Art. 73, V; CF, Art. 37, V | Lei 9.504/97, Art. 73, V, alínea 'a' | O finding cita Lei 9.504/97, Art. 73, V como vedação a nomeações de cargos em comissão no período eleitoral, mas o próprio dispositivo, em sua alínea 'a', expre |
| GS-1061 | Lei 9.504/97, Art. 73, V; CF, Art. 37, V | Lei 9.504/97, Art. 73, V | A Lei 9.504/97, Art. 73, V não se aplica porque: (1) a data 02/08/2025 está fora de qualquer janela eleitoral (próxima eleição municipal seria 2028); (2) mesmo  |
| GS-1070 | Lei 9.504/97, Art. 73, V; CF, Art. 37, V | Lei 9.504/97, Art. 73, V | A data da publicação (03/12/2024) está fora da janela eleitoral (01/07/2024–06/10/2024), portanto o Art. 73, V da Lei 9.504/97 não se aplica. O CF Art. 37, V ap |
| GS-108 | Lei 9.504/97, Art. 73, V; CF, Art. 37, V | Lei 9.504/97, Art. 73, V, alínea 'a' | O finding cita Art. 73, V como vedação, mas omite a alínea 'a' que expressamente ressalva a nomeação ou exoneração de cargos em comissão e designação ou dispens |
| GS-1098 | Lei 9.504/97, Art. 73, V; CF, Art. 37, V | Lei 9.504/97, Art. 73, V, alínea 'a' | O finding alega violação do Art. 73, V, mas ignora que a alínea 'a' ressalva cargos em comissão, e mais importante, os atos identificados sequer são de cargos c |
| GS-1238 | Lei 9.504/97, Art. 73, V; CF, Art. 37, V | Lei 9.504/97, Art. 73, V | A data (14/05/2022) está fora da janela eleitoral de 2022 (que seria jul-out). Além disso, o Art. 73, V, 'a' ressalva expressamente nomeação/exoneração de cargo |
| GS-1249 | Lei 9.504/97, Art. 73, V; CF, Art. 37, V | Lei 9.504/97, Art. 73, V | A Lei 9.504/97, Art. 73, V aplica-se apenas em período eleitoral (3 meses antes do pleito até a posse). A gazette é de 06/05/2021, fora de qualquer janela eleit |
| GS-1259 | Lei 9.504/97, Art. 73, V; CF, Art. 37, V | Lei 9.504/97, Art. 73, V | A Lei 9.504/97, Art. 73, V aplica-se apenas durante a janela eleitoral (3 meses antes do pleito até a posse). Em 07/02/2023, fora de período eleitoral, a norma  |
| GS-1366 | Lei 9.504/97, Art. 73, V; CF, Art. 37, V | Lei 9.504/97, Art. 73, V; CF, Art. 37, V | A base legal é inaplicável: a data está fora de janela eleitoral, os atos são majoritariamente de concurso público (não cargos comissionados), e o threshold par |
| GS-1371 | Lei 9.504/97, Art. 73, V; CF, Art. 37, V | Lei 9.504/97, Art. 73, V, alínea 'a' | O finding cita Art. 73, V como vedação, mas omite a alínea 'a' que expressamente ressalva nomeação e exoneração de cargos em comissão da vedação eleitoral. A pr |
| GS-1375 | Lei 9.504/97, Art. 73, V; CF, Art. 37, V | Lei 9.504/97, Art. 73, V | A Lei 9.504/97, Art. 73, V aplica-se apenas em janela eleitoral (3 meses antes do pleito até posse dos eleitos). Em 13/08/2025 não há janela eleitoral vigente.  |
| GS-1388 | Lei 9.504/97, Art. 73, V; CF, Art. 37, V | Lei 9.504/97, Art. 73, V | A Lei 9.504/97, Art. 73, V aplica-se apenas em período eleitoral (3 meses antes do pleito até a posse). A data 17/11/2025 está fora de qualquer janela eleitoral |
| GS-1417 | Lei 9.504/97, Art. 73, V; CF, Art. 37, V | Lei 9.504/97, Art. 73, V | A Lei 9.504/97, Art. 73, V aplica-se apenas durante janela eleitoral (3 meses antes do pleito até posse dos eleitos). A data é 27/02/2025, fora de qualquer jane |
| GS-1423 | Lei 9.504/97, Art. 73, V; CF, Art. 37, V | Lei 9.504/97, Art. 73, V, alínea 'a' | O finding alega violação do Art. 73, V, mas ignora a alínea 'a' do mesmo inciso, que expressamente ressalva da vedação a nomeação/exoneração de cargos em comiss |

## Divergências (18)

Cada linha é um caso onde a re-rotulagem rigorosa discordou do baseline.

### GS-033 — fiscal-licitacoes / dispensa_irregular

- **baseline:** `TP` (por `claude-sonnet-4-6`)
- **juiz:** `FP` (confiança 0.95, fact-derivable)
- **citação legal do juiz:** Lei 8.666/93, Art. 24, VIII (equivalente ao Art. 75, IX da Lei 14.133/2021)
- **rationale do juiz:** A contratação é fundamentada no Art. 24, inciso VIII da Lei 8.666/93, que trata de contratação de pessoa jurídica de direito público interno (COMURG é empresa pública municipal). Essa hipótese de dispensa não possui teto de valor — é análoga ao Art. 75, IX da Lei 14.133/2021 (contratação entre entes da administração). O fiscal aplicou incorretamente o Art. 75, II (limite por valor para 'outros serviços e compras'), quando a fundamentação real é dispensa por natureza do contratado (órgão/entidade da administração pública). Conforme os próprios critérios do fiscal, hipóteses sem teto (como Art. 75 IX) não devem gerar alerta de dispensa_irregular.
- **trecho do diário:** "Contratação por Dispensa de Licitação da Companhia de Urbanização – COMURG, inc. VIII, artigo 24 da Lei 8.666/93 para a prestação dos serviços de engenharia para URBANIZAÇÃO, IMPLANTAÇÃO E REVITALIZAÇÃO DE PRAÇAS, CANTEIROS ORNAMENTAIS E OUTROS EQUIPAMENTOS PÚBLICOS"

### GS-1016 — fiscal-geral / padrao_recorrente

- **baseline:** `TP` (por `claude-opus-4-7-via-subagent`)
- **juiz:** `borderline` (confiança 0.62, fact-derivable)
- **citação legal do juiz:** Lei 8.666/93, Art. 24, IV
- **rationale do juiz:** O finding alega 4 ocorrências distintas, mas o diário mostra apenas 2 dispensas reais para o CNPJ 02.080.759/0001-57 (Dispensa 029/2022 e Dispensa 030/2022). As 4 evidências são duplicatas dessas 2 dispensas. O meta-finding 'padrao_recorrente' exige 3+ findings distintos para o mesmo CNPJ, mas aqui há apenas 2 contratações. Contudo, as dispensas com fundamento no Art. 24, IV (emergência) para transporte escolar com o mesmo fornecedor em processos separados no mesmo dia podem indicar fracionamento, embora transporte escolar emergencial no início do ano letivo seja situação comum. A contagem inflada (4 em vez de 2) enfraquece o finding, mas a questão substantiva de possível fracionamento permanece ambígua sem informações adicionais sobre o contexto.
- **trecho do diário:** "SMED – Contratado: VIAÇÃO GIRATUR LTDA - CNPJ: 02.080.759/0001-57. Objeto: Dispensa de licitação celebrada com a empresa VIAÇÃO GIRATUR LTDA, para prestação de serviço de transporte escolar - Roteiros 159, 160 e 161. Valor R$ 86.625,00. Dispensa nº 029/2022. Processo nº 2022/3549. Fundamento legal: Art. 24, inciso IV, da Lei n.º 8.666/93."

### GS-1058 — fiscal-pessoal / pico_nomeacoes

- **baseline:** `borderline` (por `claude-opus-4-7-via-subagent`)
- **juiz:** `FP` (confiança 0.97, fact-derivable)
- **citação legal do juiz:** Lei 9.504/97, Art. 73, V, alínea 'a'
- **rationale do juiz:** A Lei 9.504/97, Art. 73, V, alínea 'a', expressamente ressalva 'a nomeação ou exoneração de cargos em comissão e designação ou dispensa de funções de confiança' da vedação do período eleitoral. Todos os atos identificados no diário são exonerações e nomeações de cargos em comissão (DAS-8, DAS-2), portanto enquadram-se na exceção legal. O próprio texto legal citado pelo finding contém a ressalva que torna os atos lícitos. Além disso, a narrativa do finding afirma que 'Lei 9.504/97, Art. 73, V, veda nomeações para cargos em comissão no período eleitoral', o que é uma leitura incorreta do dispositivo, que expressamente exclui cargos em comissão da vedação.
- **trecho do diário:** "Nomear, a contar desta data, com fundamento do disposto no inciso V, do art. 87, da Lei Orgânica Municipal, JÚLIO CÉSAR SCHULTZ SOUZA, para exercer o cargo em comissão de Assessor de Gabinete, Símbolo DAS-8, na Secretária Municipal de Governo."

### GS-108 — fiscal-pessoal / pico_nomeacoes

- **baseline:** `TP` (por `claude-opus-4-7-via-subagent`)
- **juiz:** `FP` (confiança 0.95, fact-derivable)
- **citação legal do juiz:** Lei 9.504/97, Art. 73, V, alínea 'a'
- **rationale do juiz:** Todos os 4 atos identificados na evidência são exonerações 'a pedido' de cargos em comissão. A Lei 9.504/97, Art. 73, V, alínea 'a', expressamente ressalva 'a nomeação ou exoneração de cargos em comissão e designação ou dispensa de funções de confiança' da vedação do período eleitoral. Além disso, os próprios critérios do Fiscal listam 'Exoneração individual a pedido' como filtro de exclusão (categoria FP sistemático). Os trechos mostram claramente: 'EXONERAR, A PEDIDO, TIAGO MEURER DA SILVA do Cargo em Comissão', 'EXONERAR, A PEDIDO, ANA PAULA FELIPE do Cargo em Comissão', etc. Embora haja também uma designação (Decreto 26.710) e uma nomeação (Decreto 26.720 - Marcelo Silveira Formiga), estas também se enquadram na ressalva da alínea 'a' do Art. 73, V, que permite nomeação/exoneração de cargos em comissão no período eleitoral.
- **trecho do diário:** "RESOLVE: EXONERAR, A PEDIDO, TIAGO MEURER DA SILVA do Cargo em Comissão de Superintendente Regional do Centro (ASE-02) da Secretaria Municipal De Limpeza E Manutenção"

### GS-1098 — fiscal-pessoal / pico_nomeacoes

- **baseline:** `borderline` (por `claude-opus-4-7-via-subagent`)
- **juiz:** `FP` (confiança 0.95, fact-derivable)
- **citação legal do juiz:** Lei 9.504/97, Art. 73, V, alínea 'a'
- **rationale do juiz:** A Lei 9.504/97, Art. 73, V, alínea 'a', expressamente ressalva da vedação 'a nomeação ou exoneração de cargos em comissão e designação ou dispensa de funções de confiança'. Além disso, os atos identificados no diário não são de cargos comissionados: o Decreto 61.384 nomeia 'Professor de Séries Iniciais' (cargo efetivo, conforme LC 266/2008, art. 16); os Decretos 61.379 a 61.382 são exonerações 'a pedido' de servidores efetivos (Fisioterapeuta, etc.) com base na LC 230/2007; e o Decreto 61.386 decreta vacância por posse em cargo inacumulável. Nenhum dos 5 atos envolve cargo em comissão. O próprio filtro de exclusão do fiscal prevê que 'exoneração individual a pedido' não deve ser contada.
- **trecho do diário:** "EXONERA a pedido, no Hospital Municipal São José, a partir de 05 de agosto de 2024: Tais Licio Macedo, matrícula 99392, do cargo de Fisioterapeuta, com base no artigo 10, inciso II, da citada Lei."

### GS-144 — fiscal-pessoal / pico_nomeacoes

- **baseline:** `TP` (por `claude-opus-4-7-via-subagent`)
- **juiz:** `FP` (confiança 0.95, fact-derivable)
- **citação legal do juiz:** Lei 9.504/97, Art. 73, V
- **rationale do juiz:** São Luís (cityId 2111300) tem população superior a 1 milhão de habitantes, classificando-se como 'large'. Para cidades large fora da janela eleitoral, o threshold é de ≥ 20 atos. A data da gazette (16/12/2022) está fora da janela eleitoral municipal de 2024 (01/07/2024 – 06/10/2024). O finding detectou apenas 10 atos, abaixo do limiar de 20 aplicável. Além disso, vários atos são exonerações seguidas de nomeações das mesmas pessoas (ex.: 'EXONERAÇÃO DE DIEGO RAFAEL RODRIGUES PEREIRA' seguida de 'NOMEAÇÃO DE DIEGO RAFAEL RODRIGUES PEREIRA'), indicando mera movimentação/remanejamento de cargos comissionados, prática normal de fim de ano administrativo.
- **trecho do diário:** "EXONERAÇÃO DE DIEGO RAFAEL RODRIGUES PEREIRA 13 ................................................................................................................................ EXONERAÇÃO DE MARIA DOS REIS ARAUJO SOUZA 13"

### GS-1537 — fiscal-locacao / locacao_sem_justificativa

- **baseline:** `FP` (por `claude-opus-4-7-via-subagent`)
- **juiz:** `borderline` (confiança 0.5, judgment)
- **citação legal do juiz:** Lei 14.133/2021, Art. 74, V e §5º
- **rationale do juiz:** O finding alega locação sem justificativa com base no Art. 74, III, mas o fundamento correto para locação de imóvel é o Art. 74, V (e seu §5º). O digest mostra apenas um 'RESUMO DO TERMO DE CONTRATO' com dados básicos (locatário, locadora, objeto, finalidade: 'EPG Tom Jobim'), sem mencionar laudo de avaliação, justificativa de singularidade ou certificação de inexistência de imóveis públicos vagos. Contudo, trata-se de publicação de acompanhamento de contrato existente, não necessariamente de nova contratação, e a justificativa pode constar do processo administrativo não publicado no diário. A base legal citada pelo fiscal (Art. 74, III) está incorreta — o correto seria Art. 74, V e §5º.
- **trecho do diário:** "ACOMPANHAMENTO DE CONTRATOS DE LOCAÇÃO DE IMÓVEIS E COMODATOS  RESUMO DO TERMO DE CONTRATO Locatário: MUNICÍPIO DE GUARULHOS Locadora: ARTA ADMINISTRADORA DE BENS LTDA Objeto: Contrato de Locação do imóvel situado na Rua Particular n.º 90 (antigo 100B) - Cidade Seródio - Guarulhos/SP. Finalidade: EPG Tom Jobim,"

### GS-299 — fiscal-pessoal / pico_nomeacoes

- **baseline:** `TP` (por `claude-opus-4-7-via-subagent`)
- **juiz:** `FP` (confiança 0.97, fact-derivable)
- **citação legal do juiz:** Lei 9.504/97, Art. 73, V
- **rationale do juiz:** O texto identificado pelo fiscal não são atos de nomeação de cargos comissionados, mas sim uma LEI (Lei nº 9197/2024) que altera as diretrizes orçamentárias (LDO), definindo o quadro de vagas para nomeações por concurso público (Lei Complementar nº 409/2012). O trecho diz: 'Dá nova redação ao inciso II do art. 29 da Lei n° 8.983, de 29 de setembro de 2023, que dispõe sobre as diretrizes orçamentárias para o exercício financeiro de 2024'. Trata-se de texto normativo fixando limites de vagas para cargos efetivos, não de portarias de nomeação efetiva de pessoas para cargos comissionados. Isso se enquadra no filtro de exclusão 'Lei Complementar criando quadro' e 'Texto normativo' dos critérios do próprio fiscal.
- **trecho do diário:** "Dá nova redação ao inciso II do art. 29 da Lei n° 8.983, de 29 de setembro de 2023, que dispõe sobre as diretrizes orçamentárias para o exercício financeiro de 2024 e dá outras providências."

### GS-310 — fiscal-pessoal / pico_nomeacoes

- **baseline:** `TP` (por `claude-opus-4-7-via-subagent`)
- **juiz:** `FP` (confiança 0.97, fact-derivable)
- **citação legal do juiz:** Lei 9.504/97, Art. 73, V
- **rationale do juiz:** O finding alega 7 atos acima do limiar de 7 (ou seja, ≥7), mas conforme os critérios do fiscal, São Luís (população >1M) é classificada como 'large', cujo threshold fora de janela eleitoral é ≥20 atos. Com apenas 7 atos (3 exonerações + 4 nomeações), o volume está muito abaixo do limiar aplicável. Além disso, janeiro de 2025 é 'janeiro de ano pós-eleição municipal', o que dobra o threshold (para 40). A própria narrativa menciona 'acima do limiar de 7 atos' aplicando incorretamente o threshold de cidade small. O diário mostra: "EXONERAÇÃO DE CRISTIANO DE SOUSA LEÃO", "EXONERAÇÃO DE ISRAEL DUARTE SILVA GUIMARÃES", "EXONERAÇÃO DE PAULA FRANSSINETTI MOTA TRINTA", "NOMEAÇÃO DE LEILANE SANTOS MENDES", "NOMEAÇÃO DE RAFAEL ROCHA DA SILVA", "NOMEAÇÃO DE SAMIA CRISTINA SOUSA SILVA", "NOMEAÇÃO RAILSON NASCIMENTO DOS SANTOS" — 7 atos em uma capital com mais de 1 milhão de habitantes, em período de transição de mandato.
- **trecho do diário:** "EXONERAÇÃO DE CRISTIANO DE SOUSA LEÃO 3 ...................................................................................................  EXONERAÇÃO DE ISRAEL DUARTE SILVA GUIMARÃES 3 ...........................................................................................  EXONERAÇÃO DE PAULA FRANSSINETTI MOTA TRINTA 3 ........................................................................."

### GS-328 — fiscal-pessoal / pico_nomeacoes

- **baseline:** `TP` (por `claude-opus-4-7-via-subagent`)
- **juiz:** `FP` (confiança 0.97, fact-derivable)
- **citação legal do juiz:** Lei 9.504/97, Art. 73, V, alínea 'a'
- **rationale do juiz:** A Lei 9.504/97, Art. 73, V, alínea 'a', expressamente ressalva da vedação eleitoral 'a nomeação ou exoneração de cargos em comissão e designação ou dispensa de funções de confiança'. Todos os atos identificados no diário são nomeações e exonerações de cargos comissionados (DAS), que se enquadram exatamente nessa exceção legal. Portanto, não há irregularidade. Além disso, Belém tem população superior a 1 milhão de habitantes, e o threshold para 'large' em janela eleitoral é ≥ 10 atos — o finding alega apenas 3 atos, abaixo do limiar correto.
- **trecho do diário:** "Nomear ALESSANDRA DOS SANTOS REGO, para o cargo comissionado de Assessor Superior DAS – 202.6 na Secretaria Municipal de Urbanismo"

### GS-374 — fiscal-pessoal / pico_nomeacoes

- **baseline:** `TP` (por `claude-opus-4-7-via-subagent`)
- **juiz:** `FP` (confiança 0.97, fact-derivable)
- **citação legal do juiz:** Lei 9.504/97, Art. 73, V, alínea 'a'
- **rationale do juiz:** A Lei 9.504/97, Art. 73, V, alínea 'a', expressamente ressalva da vedação eleitoral 'a nomeação ou exoneração de cargos em comissão e designação ou dispensa de funções de confiança'. Todos os atos identificados (Portarias 1297 a 1304) referem-se a cargos em comissão (CC-1, CC-2, CC-3, CC-5), que são livres para nomeação e exoneração mesmo no período eleitoral. Além disso, a Port. 1297 é exoneração 'a pedido' e as demais são remanejamentos internos com 'vaga decorrente da exoneração de' outro servidor, configurando substituições individuais — padrão expressamente listado nos filtros de exclusão do fiscal.
- **trecho do diário:** "Port. Nº 1297/2024- Exonera, a pedido, LUIZ INÁCIO CARVALHO DOS SANTOS do cargo de Coordenador, CC-1, da Secretaria Municipal de Fazenda."

### GS-399 — fiscal-locacao / locacao_sem_justificativa

- **baseline:** `TP` (por `claude-opus-4-7-via-subagent`)
- **juiz:** `borderline` (confiança 0.55, judgment)
- **citação legal do juiz:** Lei 14.133/2021, Art. 74, V e §5º
- **rationale do juiz:** O finding alega locação sem justificativa com base no Art. 74, III, porém o fundamento correto para locação de imóvel é o Art. 74, V da Lei 14.133/2021. O excerpt do diário mostra apenas 'RATIFICA a DISPENSA DE LICITAÇÃO PARA LOCAÇÃO DO IMÓVEL em favor da Senhora: SRA. PATRICIA DE ARAÚJO AMORIM', sem mencionar laudo de avaliação, justificativa de singularidade ou valor de mercado. Contudo, o ato menciona 'DISPENSA DE LICITAÇÃO' e não 'inexigibilidade', o que pode indicar fundamento legal diverso (Art. 75). Além disso, o processo administrativo pode conter justificativas não publicadas no diário. A base legal alegada pelo fiscal (Art. 74, III) está incorreta — deveria ser Art. 74, V (locação de imóvel) ou possivelmente Art. 75 (dispensa), já que o próprio ato fala em 'dispensa' e não 'inexigibilidade'.
- **trecho do diário:** "RATIFICA a DISPENSA DE LICITAÇÃO PARA LOCAÇÃO DO IMÓVEL em favor da Senhora: SRA. PATRICIA DE ARAÚJO AMORIM, inscrita no CPF/MF sob o nº.620.850.001-00"

### GS-464 — fiscal-locacao / locacao_sem_justificativa

- **baseline:** `TP` (por `claude-opus-4-7-via-subagent`)
- **juiz:** `borderline` (confiança 0.45, judgment)
- **citação legal do juiz:** Lei 14.133/2021, Art. 74, V
- **rationale do juiz:** O digest mostra um extrato de contrato de locação com a empresa GALERIA PÁTIO EMPREENDIMENTOS IMOBILIÁRIOS LTDA, mas o trecho disponível não menciona inexigibilidade de licitação, nem contém termos como 'laudo de avaliação', 'valor de mercado', 'justificativa da escolha' ou 'razão da escolha do locador'. Contudo, o excerpt também não mostra o contrato completo — pode haver justificativa em partes não capturadas do documento. A base legal correta para locação de imóvel é o Art. 74, V (não III), que trata especificamente de 'aquisição ou locação de imóvel cujas características de instalações e de localização tornem necessária sua escolha'. O finding cita Art. 74, III que se refere a serviços técnicos especializados, não a locação de imóvel.
- **trecho do diário:** "GALERIA PÁTIO EMPREENDIMENTOS   IMOBILIÁRIOS LTDA, inscrita no CNPJ/MF sob o nº.   48.269.611/0001-66.    OBJETO: Constitui-se objeto do presente Contrato de Locação, o   imóvel localizado na Avenida Antônio Lisboa de Amorim, nº. 220 –   Bairro: Antares - Maceió/AL com área útil no andar superior com"

### GS-579 — fiscal-locacao / locacao_sem_justificativa

- **baseline:** `borderline` (por `claude-opus-4-7-via-subagent`)
- **juiz:** `FP` (confiança 0.88, fact-derivable)
- **citação legal do juiz:** Lei 14.133/2021, Art. 74, V e §5º
- **rationale do juiz:** O finding alega base legal no Art. 74, III (serviços técnicos especializados), mas o próprio Diário Oficial explicita que o fundamento legal é o Art. 74, inciso V ('aquisição ou locação de imóvel cujas características de instalações e de localização tornem necessária sua escolha'). O trecho do diário diz: 'Fundamento Legal: Art. 74, inciso V, da Lei nº 14.133/21.' Portanto, a base legal alegada pelo finding (Art. 74, III) está incorreta — a contratação foi fundamentada no inciso V, que é o dispositivo correto para locação de imóvel. Embora o aviso não mencione laudo de avaliação ou justificativa de singularidade (requisitos do §5º do Art. 74), o finding erra ao citar o inciso III como fundamento, comprometendo a narrativa do alerta. Quanto à ausência de menção a laudo/justificativa no aviso publicado, isso é meramente indiciário conforme os próprios critérios do fiscal, e o aviso de inexigibilidade no Diário Oficial não precisa reproduzir toda a documentação do processo administrativo.
- **trecho do diário:** "Fundamento Legal: Art. 74, inciso V, da Lei nº 14.133/21."

### GS-633 — fiscal-contratos / aditivo_abusivo

- **baseline:** `TP` (por `claude-opus-4-7-via-subagent`)
- **juiz:** `FP` (confiança 0.98, fact-derivable)
- **citação legal do juiz:** Lei 13.019/2014, Art. 57
- **rationale do juiz:** O instrumento em questão é um Termo de Colaboração firmado com base na Lei 13.019/2014 (Marco Regulatório das Organizações da Sociedade Civil), e não um contrato administrativo regido pela Lei 14.133/2021. O próprio extrato declara: 'FUNDAMENTO LEGAL: Art. 57 da Lei n. 13.019/2014 e no art. 43, inciso I, alínea "a", do Decreto Municipal n. 14.969 de 11/11/2021'. O Art. 125 da Lei 14.133/2021 aplica-se exclusivamente a alterações unilaterais de contratos administrativos, não a parcerias com organizações da sociedade civil. Além disso, os próprios critérios do fiscal listam 'Termo de Colaboração' como instrumento fora do escopo do Art. 125.
- **trecho do diário:** "FUNDAMENTO LEGAL: Art. 57 da Lei n. 13.019/2014 e no art. 43, inciso I, alínea "a", do Decreto Municipal n. 14.969 de 11/11/2021, anexos ao Processo Administrativo n. 93488/2023-80."

### GS-729 — fiscal-contratos / aditivo_abusivo

- **baseline:** `FP` (por `claude-opus-4-7-via-subagent`)
- **juiz:** `borderline` (confiança 0.7, fact-derivable)
- **citação legal do juiz:** Lei 14.133/2021, Art. 125, caput
- **rationale do juiz:** O finding alega aditivo abusivo (>25% do valor original), mas o diário oficial não informa o valor original do contrato 2022/1634, impossibilitando verificar se o aditivo de R$ 83.513,89 ultrapassa o limite do Art. 125. Além disso, o contrato foi firmado via 'Inexigibilidade nº 2022/217' para 'ajuste do valor das vagas escolares de educação infantil', o que pode configurar reajuste/reequilíbrio e não acréscimo de objeto. O próprio fundamento legal citado no diário é 'Dispositivos da Lei Federal n. 8.666/93 e alterações, Lei Federal nº 10.520/2002, Lei Federal n. 14.133/21', sem especificar Art. 125. Sem o valor original do contrato, não é possível calcular o percentual do aditivo.
- **trecho do diário:** "Objeto: Termo aditivo nº 01 ao contrato 2022/1634 para ajuste do valor das vagas escolares de educação infantil. Valor: R$ 83.513,89 (oitenta e três mil, quinhentos e treze reais e oitenta e nove centavos) Modalidade: Inexigibilidade nº 2022/217"

### GS-836 — fiscal-licitacoes / dispensa_irregular

- **baseline:** `borderline` (por `claude-opus-4-7-via-subagent`)
- **juiz:** `FP` (confiança 0.92, fact-derivable)
- **citação legal do juiz:** Lei 14.133/2021, Art. 75, II
- **rationale do juiz:** O finding atribuiu erroneamente o valor de R$ 172.800,00 à Dispensa 061/2025 (tapetes tipo capacho). Na verdade, o valor de R$ 172.800,00 pertence à Dispensa 009/2025 (Sulfato de Alumínio). A Dispensa 061/2025 (tapetes tipo capacho da KAPAZI) tem valor de R$ 2.820,00, que está muito abaixo do limite do Art. 75, II. Quanto à Dispensa 009/2025 (R$ 172.800,00), trata-se de aquisição de insumo químico para Estação de Tratamento de Efluentes, que pode se enquadrar em outras hipóteses, mas de qualquer forma o finding confundiu os objetos e valores entre duas dispensas distintas.
- **trecho do diário:** "DISPENSA DE LICITAÇÃO 061/2025 – Contratada: KAPAZI INDÚSTRIA E COMÉRCIO DE CAPACHOS LTDA. Objeto: Aquisição parcelada de tapetes tipo capacho de vinil antiderrapante, pelo período de doze meses. O prazo de vigência contratual será de 12 (doze) meses, contados da data de assinatura deste Instrumento. Vigência: 24/03/2025 a 24/03/2026. O valor total deste Contrato é R$2.820,00 (dois mil e oitocento"

### GS-850 — fiscal-licitacoes / fracionamento

- **baseline:** `TP` (por `claude-opus-4-7-via-subagent`)
- **juiz:** `FP` (confiança 0.95, fact-derivable)
- **citação legal do juiz:** Lei 14.133/2021, Art. 75, §1º
- **rationale do juiz:** As dispensas foram fundamentadas no Art. 24, inciso IV, da Lei 8.666/93 (emergência/calamidade), que é uma hipótese sem teto de valor. O fiscal aplicou indevidamente a regra de fracionamento do Art. 75, §1º da Lei 14.133/2021, mas as contratações sequer foram feitas sob a Lei 14.133/2021 — foram feitas sob a Lei 8.666/93, Art. 24, IV (situação emergencial). Além disso, o próprio critério do fiscal exclui dispensas por emergência ('Art. 24, inciso IV' / 'emergência') da contagem de fracionamento. O documento indica: 'Fundamento legal: Art. 24, inciso IV, da Lei n.º 8.666/93.'
- **trecho do diário:** "Fundamento legal: Art. 24, inciso IV, da Lei n.º 8.666/93."

## Leitura honesta do resultado

- Nenhuma das 1695 amostras tem rótulo humano — logo NÃO há medida de acurácia aqui, apenas de reprodutibilidade entre rotuladores automáticos.
- κ global 0.236 (fraca) sobre N=60, com p₀=70.0%. 18 divergência(s) — projetando sobre o golden set, uma re-rotulagem rigorosa mudaria a ordem de 30.0% dos rótulos da amostra estratificada.
- Deslocamento de prevalência: baseline emitiu 13 TP / 41 FP / 6 borderline; o juiz cego emitiu 1 TP / 52 FP / 7 borderline. PABAK=0.550 vs κ=0.236 mostra que boa parte do κ baixo vem de marginais assimétricas, não de ruído item a item. O gate NÃO decide quem está certo: os dois avaliadores são IA.
- Derivabilidade: 91.7% fact-derivable (p₀=72.7%, κ=0.109) vs 8.3% judgment (p₀=40.0%, κ=0.000).
- Fiscais com concordância fraca: fiscal-contratos (κ=0.364, N=7); fiscal-licitacoes (κ=0.000, N=6); fiscal-locacao (κ=0.244, N=17); fiscal-pessoal (κ=0.000, N=22).
- Fiscais com κ indefinido (categoria única / N muito baixo — leia p₀, não κ): fiscal-diarias (N=2, p₀=100.0%, κ indefinido); fiscal-geral (N=1, p₀=0.0%, κ indefinido).
- Todo κ por Fiscal com N < 10 é ruído: intervalo de confiança largo demais para decidir política de rotulagem.

**Veredito:** Re-rotulagem rigorosa NÃO reproduz o baseline (κ=0.236, p₀=70.0%, PABAK=0.550). O juiz cego é sistematicamente mais cético — converteu 9 dos 13 TP do baseline em FP. Isso significa que o baseline atual NÃO é um número de precisão defensável: ou ele super-rotula TP, ou o juiz é conservador demais, e nenhum dado deste gate distingue as duas hipóteses, porque ambos os avaliadores são IA. Ação: ancorar um subconjunto com rotulagem humana antes de publicar qualquer métrica de precisão derivada deste golden set.

---

Gerado por `scripts/calibrate-labeler.mjs` em 2026-07-23T23:30:00.415Z. Read-only sobre `golden-set/samples.json`.
