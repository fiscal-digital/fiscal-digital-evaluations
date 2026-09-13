#!/usr/bin/env node
// validate-golden-set.mjs — gate de schema do golden set (issue #12).
//
// O repo mergeou 10 PRs sem nenhuma verificacao automatizada, incluindo a
// correcao de mis-citacao legal (#6) e o gate de calibracao (#9). Este script
// e a primeira barreira: roda em todo PR, sem dependencia externa.
//
// Sem `npm ci` de proposito: `@fiscal-digital/engine` e declarado como
// `file:../fiscal-digital/packages/engine`, caminho que nao existe no runner.
// Tudo aqui usa apenas builtins do Node.
//
// Uso:
//   node scripts/validate-golden-set.mjs
//   node scripts/validate-golden-set.mjs --file=outro.json

import { readFileSync } from 'node:fs'

export const LABELS_VALIDOS = new Set(['TP', 'FP', 'borderline'])
export const CAMPOS_OBRIGATORIOS = ['id', 'fiscalId', 'cityId', 'type', 'riskScore', 'confidence', 'label']

/**
 * Extrai as contagens declaradas na `description`.
 *
 * O PR #8 existiu exatamente porque a descricao afirmava um total que nao
 * batia com o conteudo. Texto e dado divergirem em silencio e o modo de falha
 * que este gate fecha.
 *
 * Formato esperado: "1695 amostras reais rotuladas (1202 FP / 348 TP / 145 borderline)"
 * Retorna null quando a descricao nao segue o formato — ausencia nao e erro,
 * divergencia e.
 */
export function contagensDeclaradas(description) {
  if (typeof description !== 'string') return null
  const total = /(\d+)\s+amostras\s+reais/i.exec(description)
  const dist = /\((\d+)\s*FP\s*\/\s*(\d+)\s*TP\s*\/\s*(\d+)\s*borderline\)/i.exec(description)
  if (!total || !dist) return null
  return {
    total: Number(total[1]),
    FP: Number(dist[1]),
    TP: Number(dist[2]),
    borderline: Number(dist[3]),
  }
}

/** Conta amostras por label. */
export function contarLabels(samples) {
  const c = { TP: 0, FP: 0, borderline: 0 }
  for (const s of samples) if (s?.label in c) c[s.label]++
  return c
}

/**
 * Valida o documento inteiro. Retorna lista de erros (vazia = valido).
 * Nunca lanca: quem decide o exit code e o caller.
 */
export function validar(doc) {
  const erros = []

  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
    return ['raiz: esperado objeto']
  }
  if (typeof doc.schemaVersion !== 'number') erros.push('raiz: `schemaVersion` deve ser number')
  if (typeof doc.description !== 'string' || !doc.description.trim()) {
    erros.push('raiz: `description` deve ser string nao vazia')
  }
  if (typeof doc.generatedAt !== 'string' || Number.isNaN(Date.parse(doc.generatedAt))) {
    erros.push('raiz: `generatedAt` deve ser data ISO valida')
  }
  if (!Array.isArray(doc.samples) || doc.samples.length === 0) {
    erros.push('raiz: `samples` deve ser array nao vazio')
    return erros
  }

  const vistos = new Set()
  doc.samples.forEach((s, i) => {
    const onde = `samples[${i}]${s?.id ? ` (${s.id})` : ''}`
    if (s === null || typeof s !== 'object') {
      erros.push(`${onde}: esperado objeto`)
      return
    }
    for (const campo of CAMPOS_OBRIGATORIOS) {
      if (s[campo] === undefined || s[campo] === null || s[campo] === '') {
        erros.push(`${onde}: campo obrigatorio \`${campo}\` ausente`)
      }
    }
    if (s.label !== undefined && !LABELS_VALIDOS.has(s.label)) {
      erros.push(`${onde}: label "${s.label}" fora de {TP, FP, borderline}`)
    }
    if (typeof s.riskScore === 'number' && (s.riskScore < 0 || s.riskScore > 100)) {
      erros.push(`${onde}: riskScore ${s.riskScore} fora de 0..100`)
    }
    if (typeof s.confidence === 'number' && (s.confidence < 0 || s.confidence > 1)) {
      erros.push(`${onde}: confidence ${s.confidence} fora de 0..1`)
    }
    // O golden set e "apenas amostras reais de alerts-prod (sem sinteticos)" —
    // sintetico vive em golden-set/synthetic/ e nao pode vazar para ca.
    if (s.source === 'synthetic' || s.synthetic === true) {
      erros.push(`${onde}: amostra sintetica no set real`)
    }
    if (typeof s.id === 'string') {
      if (vistos.has(s.id)) erros.push(`${onde}: id duplicado`)
      vistos.add(s.id)
    }
  })

  const declarado = contagensDeclaradas(doc.description)
  if (declarado) {
    const real = contarLabels(doc.samples)
    if (declarado.total !== doc.samples.length) {
      erros.push(`description declara ${declarado.total} amostras, o arquivo tem ${doc.samples.length}`)
    }
    for (const k of ['TP', 'FP', 'borderline']) {
      if (declarado[k] !== real[k]) {
        erros.push(`description declara ${declarado[k]} ${k}, o arquivo tem ${real[k]}`)
      }
    }
  }

  return erros
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function main() {
  const arg = process.argv.find(a => a.startsWith('--file='))
  const caminho = arg ? arg.slice('--file='.length) : 'golden-set/samples.json'

  let doc
  try {
    doc = JSON.parse(readFileSync(caminho, 'utf-8'))
  } catch (e) {
    console.error(`✗ nao consegui ler ${caminho}: ${e.message}`)
    process.exit(1)
  }

  const erros = validar(doc)
  if (erros.length === 0) {
    console.log(`✓ ${caminho}: ${doc.samples.length} amostras, schema v${doc.schemaVersion}, contagens conferem`)
    return
  }
  console.error(`✗ ${caminho}: ${erros.length} problema(s)`)
  for (const e of erros.slice(0, 50)) console.error(`  - ${e}`)
  if (erros.length > 50) console.error(`  ... e mais ${erros.length - 50}`)
  process.exit(1)
}

if (import.meta.url === `file://${process.argv[1]}`) main()
