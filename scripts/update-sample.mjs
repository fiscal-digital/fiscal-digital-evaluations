#!/usr/bin/env node
/**
 * update-sample.mjs — Atualiza um campo da amostra com label/rationale/etc.
 *
 * Uso:
 *   node scripts/update-sample.mjs GS-001 '{"label":"TP","rationale":"...","evaluatedBy":"claude-sonnet-4-6"}'
 */

import fs from 'node:fs'
import path from 'node:path'

const JSON_PATH = path.resolve(import.meta.dirname, '..', 'golden-set/samples.json')

const id = process.argv[2]
const updates = JSON.parse(process.argv[3])

const ds = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'))
const sample = ds.samples.find(s => s.id === id)
if (!sample) {
  console.error(`Sample ${id} não encontrada`)
  process.exit(1)
}

Object.assign(sample, updates, { evaluatedAt: new Date().toISOString() })
fs.writeFileSync(JSON_PATH, JSON.stringify(ds, null, 2) + '\n')
console.log(`✓ ${id} atualizada: label=${sample.label}`)
