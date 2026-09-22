# Candidatos (não rotulados)

Arquivos neste diretório têm o **mesmo schema de `../samples.json`**, mas com
`label: null`. São achados produzidos por um canário (experimento controlado
no repo `fiscal-digital`) que ainda **não passaram por revisão humana** — e por
isso **não entram** na precisão medida nem no gate de CI (`npm run validate`
só olha `samples.json`).

Cada arquivo traz `provenance` na raiz: script, versão do filtro, cidade,
período, gate de publicação e as contagens dos dois braços do experimento.
Cada amostra traz `canary` com o diário de origem (`gazetteId`, `rawS3Key`) e
se aquela data também foi vista pelo braço de produção (`dateSeenByA`).

`narrative` é `null` por desenho: o canário é dry-run estrito e nunca chama o
modelo de narrativa. O revisor rotula pela evidência (`evidence[].excerpt`).

## Como rotular

```bash
npm run label -- --file=golden-set/candidates/fase1-caxias-2025.json
```

Mesma CLI, mesmos comandos (`T`/`F`/`B`/`S`/`Q`). O arquivo é salvo no lugar.

## Como promover para `samples.json`

Só depois de rotulado, e por PR:

1. Copiar as amostras rotuladas para `samples.json`, renumerando `id` como
   `GS-NNN` (continuando a sequência) e removendo o bloco `canary`.
2. Atualizar as contagens na `description` de `samples.json` — o gate
   `validate-golden-set.mjs` confere texto contra dado.
3. `npm run validate` verde.
4. Registrar a precisão medida no ADR do fiscal correspondente em `analyses/`.

## Arquivos

| Arquivo | Origem | Pergunta que responde |
|---|---|---|
| `fase1-caxias-2025.json` | `fiscal-digital/scripts/canary-fase1.mjs --dump` (#166 / #179) | os achados que só aparecem lendo o **texto integral** do diário (em vez dos excerpts de 300 chars) são verdadeiros? A Fase 2 (ligar as janelas no analyzer) espera esta resposta. |
