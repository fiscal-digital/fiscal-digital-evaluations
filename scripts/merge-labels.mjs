#!/usr/bin/env node
/**
 * merge-labels.mjs — Aplica .tmp-labels-{fiscal}.json em golden-set/samples.json.
 * Cada label vem com label, rationale, rootCause, adjustment.
 * Adiciona evaluatedBy/evaluatedAt automaticamente.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const SAMPLES_PATH = path.join(REPO_ROOT, 'golden-set/samples.json')

const ds = JSON.parse(fs.readFileSync(SAMPLES_PATH, 'utf8'))
const byId = new Map(ds.samples.map(s => [s.id, s]))

const tmpFiles = fs.readdirSync(REPO_ROOT).filter(f => f.startsWith('.tmp-labels-') && f.endsWith('.json'))

const now = new Date().toISOString()
const stats = {}

for (const file of tmpFiles) {
  const fiscal = file.replace('.tmp-labels-', '').replace('.json', '')
  const labels = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, file), 'utf8'))
  stats[fiscal] = { tp: 0, fp: 0, borderline: 0, missing: 0, applied: 0 }

  for (const lab of labels) {
    const sample = byId.get(lab.id)
    if (!sample) {
      console.warn(`  ✗ ${lab.id}: amostra não encontrada`)
      stats[fiscal].missing++
      continue
    }
    sample.label = lab.label
    sample.rationale = lab.rationale
    sample.rootCause = lab.rootCause ?? null
    sample.adjustment = lab.adjustment ?? null
    sample.regressionTest = lab.regressionTest ?? null
    sample.labeledBy = 'claude-opus-4-7-via-subagent'
    sample.labeledAt = now
    sample.evaluatedBy = 'claude-opus-4-7-via-subagent'
    sample.evaluatedAt = now

    stats[fiscal][lab.label.toLowerCase() === 'tp' ? 'tp' : lab.label.toLowerCase() === 'fp' ? 'fp' : 'borderline']++
    stats[fiscal].applied++
  }
}

fs.writeFileSync(SAMPLES_PATH, JSON.stringify(ds, null, 2) + '\n')

console.log('\n┌──────────────────┬─────┬─────┬─────────────┬─────────┐')
console.log('│ Fiscal           │  TP │  FP │ borderline  │ applied │')
console.log('├──────────────────┼─────┼─────┼─────────────┼─────────┤')
let totalTP = 0, totalFP = 0, totalB = 0, totalA = 0
for (const [f, s] of Object.entries(stats)) {
  console.log(`│ ${f.padEnd(16)} │ ${String(s.tp).padStart(3)} │ ${String(s.fp).padStart(3)} │ ${String(s.borderline).padStart(11)} │ ${String(s.applied).padStart(7)} │`)
  totalTP += s.tp
  totalFP += s.fp
  totalB += s.borderline
  totalA += s.applied
}
console.log('├──────────────────┼─────┼─────┼─────────────┼─────────┤')
console.log(`│ TOTAL            │ ${String(totalTP).padStart(3)} │ ${String(totalFP).padStart(3)} │ ${String(totalB).padStart(11)} │ ${String(totalA).padStart(7)} │`)
console.log('└──────────────────┴─────┴─────┴─────────────┴─────────┘')

const totalLabeled = ds.samples.filter(s => s.label).length
console.log(`\n✓ Golden set: ${totalLabeled}/${ds.samples.length} amostras rotuladas`)
