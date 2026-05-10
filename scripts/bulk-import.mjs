#!/usr/bin/env node
/**
 * bulk-import.mjs — Importa amostras de alerts-prod conforme plano de distribuicao alvo.
 *
 * Diferente de label-cli.mjs --import (1 fiscal por vez), aqui:
 *   - Aceita plano com TARGET por Fiscal
 *   - Filtra duplicatas por sourceFindingId (pk do FINDING# em prod)
 *   - Importa o delta para atingir o alvo
 *
 * Uso: node scripts/bulk-import.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const SAMPLES_PATH = path.join(REPO_ROOT, 'golden-set/samples.json')

// Plano alvo aprovado em 2026-05-10 (Ciclo 3 — total 1695, esgota prod)
const TARGET = {
  'fiscal-pessoal': 708,
  'fiscal-locacao': 476,
  'fiscal-contratos': 204,
  'fiscal-licitacoes': 171,
  'fiscal-convenios': 75,
  'fiscal-diarias': 37,
  'fiscal-publicidade': 23,
  'fiscal-geral': 1,
}

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }))

function loadDataset() {
  return JSON.parse(fs.readFileSync(SAMPLES_PATH, 'utf8'))
}
function saveDataset(ds) {
  fs.writeFileSync(SAMPLES_PATH, JSON.stringify(ds, null, 2) + '\n')
}

function nextId(samples) {
  const max = samples.reduce((m, s) => {
    const n = parseInt(s.id.replace('GS-', ''), 10)
    return n > m ? n : m
  }, 0)
  return `GS-${String(max + 1).padStart(3, '0')}`
}

async function fetchAllFindingsByFiscal(fiscalId) {
  const items = []
  let ExclusiveStartKey
  do {
    const r = await ddb.send(new ScanCommand({
      TableName: 'fiscal-digital-alerts-prod',
      FilterExpression: 'fiscalId = :f AND begins_with(pk, :p)',
      ExpressionAttributeValues: { ':f': fiscalId, ':p': 'FINDING#' },
      ExclusiveStartKey,
    }))
    items.push(...(r.Items ?? []))
    ExclusiveStartKey = r.LastEvaluatedKey
  } while (ExclusiveStartKey)
  return items
}

async function main() {
  const ds = loadDataset()

  // Mapa de sourceFindingId ja presentes
  const existingIds = new Set()
  for (const s of ds.samples) {
    if (s.sourceFindingId) existingIds.add(s.sourceFindingId)
  }
  console.log(`\n${'═'.repeat(72)}`)
  console.log(`  bulk-import — Fiscal Digital evaluations`)
  console.log(`  Golden set atual: ${ds.samples.length} amostras (${existingIds.size} com sourceFindingId)`)
  console.log(`${'═'.repeat(72)}\n`)

  const summary = []

  for (const [fiscalId, target] of Object.entries(TARGET)) {
    const current = ds.samples.filter(s => s.fiscalId === fiscalId).length
    const delta = target - current

    console.log(`▶ ${fiscalId}: atual=${current}, alvo=${target}, delta=${delta}`)

    if (delta <= 0) {
      console.log(`  ✓ ja no alvo, pulando\n`)
      summary.push({ fiscalId, current, target, imported: 0, available: 'n/a' })
      continue
    }

    const all = await fetchAllFindingsByFiscal(fiscalId)
    const novos = all.filter(f => !existingIds.has(f.id ?? f.pk))
    console.log(`  encontrados em prod: ${all.length}, novos (nao no GS): ${novos.length}`)

    if (novos.length === 0) {
      console.log(`  ⚠ nenhum candidato novo\n`)
      summary.push({ fiscalId, current, target, imported: 0, available: 0 })
      continue
    }

    // Embaralhar para amostragem aleatoria + pegar delta
    const shuffled = novos.sort(() => Math.random() - 0.5).slice(0, delta)
    const importedCount = shuffled.length

    for (const f of shuffled) {
      const sample = {
        id: nextId(ds.samples),
        fiscalId: f.fiscalId,
        cityId: f.cityId,
        type: f.type,
        riskScore: f.riskScore,
        confidence: f.confidence,
        narrative: f.narrative,
        legalBasis: f.legalBasis,
        cnpj: f.cnpj ?? null,
        secretaria: f.secretaria ?? null,
        value: f.value ?? null,
        contractNumber: f.contractNumber ?? null,
        evidence: f.evidence ?? [],
        sourceFindingId: f.id ?? f.pk,
        createdAt: f.createdAt ?? null,
        date: f.gazetteDate ?? f.date ?? null,
        label: null,
        labeledBy: null,
        labeledAt: null,
        schemaVersion: 1,
      }
      ds.samples.push(sample)
      existingIds.add(sample.sourceFindingId)
    }

    summary.push({ fiscalId, current, target, imported: importedCount, available: novos.length })
    console.log(`  ✓ importadas: ${importedCount}\n`)
  }

  saveDataset(ds)

  console.log('\n┌──────────────────┬─────────┬─────────┬─────────┬───────────┐')
  console.log('│ Fiscal           │ atual   │ alvo    │ import  │ disponivel│')
  console.log('├──────────────────┼─────────┼─────────┼─────────┼───────────┤')
  for (const s of summary) {
    console.log(`│ ${s.fiscalId.padEnd(16)} │ ${String(s.current).padStart(7)} │ ${String(s.target).padStart(7)} │ ${String(s.imported).padStart(7)} │ ${String(s.available).padStart(9)} │`)
  }
  console.log('└──────────────────┴─────────┴─────────┴─────────┴───────────┘')
  console.log(`\n✓ Golden set atualizado: ${ds.samples.length} amostras totais`)
}

main().catch(err => { console.error('\n✗ Erro fatal:', err); process.exit(1) })
