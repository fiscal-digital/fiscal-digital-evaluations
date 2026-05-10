# Como contribuir

Contribuições para a metodologia de avaliação dos Fiscais são bem-vindas. Este repositório é particularmente útil para:

- **Juristas:** revisar `legalBasis` por Fiscal, identificar interpretações questionáveis
- **Jornalistas:** identificar padrões de falso positivo em coberturas reais
- **Pesquisadores:** propor novas dimensões de avaliação ou métricas
- **Cidadãos:** rotular amostras adicionais para fortalecer o golden set

---

## Tipos de contribuição

### 1. Rotular novas amostras

Adicionar amostras ao `golden-set/samples.json`:

```bash
git clone https://github.com/fiscal-digital/fiscal-digital-evaluations
cd fiscal-digital-evaluations
npm install
npm run label
```

A CLI guia: importa candidatos de prod, exibe finding + excerpt, pede classificação.

### 2. Contestar uma análise existente

Abrir Issue com:
- ID da amostra (ex: `GS-042`)
- Label atual vs label que você sugere
- Evidência: trecho do PDF do diário oficial que suporta sua análise

Se aprovado em discussão pública, label é atualizado e mudança é registrada em `golden-set/changelog.md`.

### 3. Propor patch para um Fiscal

Análises em `analyses/{fiscal-id}/` contêm patches sugeridos. Se você acha que um patch está errado ou tem ideia melhor:

- Comente no PR correspondente em [`fiscal-digital`](https://github.com/fiscal-digital/fiscal-digital)
- Ou abra Issue aqui se ainda não há PR aberto

### 4. Documentar gap de detecção (FN)

Encontrou irregularidade real em diário oficial que algum Fiscal **não** detectou? Adicione amostra com `label: "FN"`:

- Identifique a gazette em `queridodiario.ok.org.br`
- Documente o trecho relevante (excerpt + URL)
- Indique qual Fiscal deveria ter detectado e por quê (citar lei + artigo)

---

## Política de qualidade

- **Toda mudança de label** exige rationale escrito citando o PDF do diário
- **Toda mudança de patch** exige regression test (entrada + saída esperada)
- **Toda análise por LLM** declara modelo + versão (`claude-opus-4-7`, etc.)

---

## Código de Conduta

Seguimos o [Código de Conduta do `fiscal-digital`](https://github.com/fiscal-digital/fiscal-digital/blob/main/CODE_OF_CONDUCT.md).

Resumo: discussão técnica baseada em evidência, sem ataques pessoais, foco em melhorar a precisão do sistema para o benefício da sociedade.

---

## Contato

- **Issues:** discussões públicas de metodologia, contestações de label, propostas de patches
- **Email:** lineu@fiscaldigital.org (assuntos sensíveis ou ainda não públicos)
