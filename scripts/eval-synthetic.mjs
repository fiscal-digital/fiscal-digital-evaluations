#!/usr/bin/env node
/**
 * eval-synthetic.mjs — Roda os Fiscais sobre o dataset SINTETICO.
 *
 * Para cada sample sintetico:
 *   1. Monta gazette { id, territory_id, date, url, excerpts: [excerpt] }
 *   2. Roda o Fiscal correspondente (fiscalId)
 *   3. Compara emitted vs expectedOutcome
 *   4. Calcula metricas: TP_real / FP_real / TN_real / FN_real
 *
 * Output: reports/synthetic-eval-{YYYY-MM-DD}.json
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const SYNTH_DIR = path.join(REPO_ROOT, 'golden-set/synthetic')
const REPORTS_DIR = path.join(REPO_ROOT, 'reports')

const engine = await import('@fiscal-digital/engine')

const FISCAIS_BY_ID = {
  'fiscal-licitacoes': engine.fiscalLicitacoes,
  'fiscal-contratos': engine.fiscalContratos,
  'fiscal-fornecedores': engine.fiscalFornecedores,
  'fiscal-pessoal': engine.fiscalPessoal,
  'fiscal-convenios': engine.fiscalConvenios,
  'fiscal-nepotismo': engine.fiscalNepotismo,
  'fiscal-publicidade': engine.fiscalPublicidade,
  'fiscal-locacao': engine.fiscalLocacao,
  'fiscal-diarias': engine.fiscalDiarias,
}

function makeOfflineContext(now = new Date()) {
  return {
    now: () => now,
    extractEntities: async () => ({
      data: { type: 'unknown', subtype: null, value: null, cnpj: null, secretaria: null },
      source: 'offline-mock',
      confidence: 0,
    }),
    queryAlertsByCnpj: async () => [],
    generateNarrative: async () => '',
    saveMemory: { execute: async () => ({ data: undefined, source: 'no-op', confidence: 1 }) },
    validateCNPJ: async () => ({
      data: { cnpj: '', situacao: 'ATIVA', dataAbertura: '2020-01-01' },
      source: 'offline-mock',
      confidence: 0,
    }),
    checkSanctions: async () => ({
      data: { sancionado: false, sancoes: [] },
      source: 'offline-mock',
      confidence: 1,
    }),
  }
}

async function runOne(sample) {
  const fiscal = FISCAIS_BY_ID[sample.fiscalId]
  if (!fiscal) return { ok: false, error: `Fiscal nao encontrado: ${sample.fiscalId}` }

  const g = sample.syntheticGazette
  const gazette = {
    id: `${g.cityId}#${g.date}#synth`,
    territory_id: g.cityId,
    date: g.date,
    url: `synthetic://${sample.id}`,
    excerpts: [g.excerpt],
  }
  const context = makeOfflineContext(new Date(g.date + 'T12:00:00Z'))

  try {
    const findings = await fiscal.analisar({ gazette, cityId: g.cityId, context })
    return { ok: true, findings }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

async function main() {
  const fiscalDirs = fs.readdirSync(SYNTH_DIR).filter(d => d.startsWith('fiscal-'))
  const allResults = []
  const matrix = {}

  for (const fdir of fiscalDirs) {
    const samplesPath = path.join(SYNTH_DIR, fdir, 'synthetic-samples.json')
    if (!fs.existsSync(samplesPath)) continue
    const samples = JSON.parse(fs.readFileSync(samplesPath, 'utf8'))

    matrix[fdir] = { tp_real: 0, fp_real: 0, tn_real: 0, fn_real: 0, errors: 0, total: 0 }

    for (const s of samples) {
      const r = await runOne(s)
      const expected = s.expectedOutcome
      const emitted = r.ok && r.findings.length > 0
      const verdict = !r.ok ? 'error' :
        expected === 'TP' && emitted ? 'tp_real' :
        expected === 'TP' && !emitted ? 'fn_real' :
        expected === 'no_finding' && emitted ? 'fp_real' :
        'tn_real'

      matrix[fdir][verdict]++
      matrix[fdir].total++

      allResults.push({
        id: s.id,
        fiscalId: s.fiscalId,
        category: s.category,
        expected,
        emitted,
        emittedCount: r.ok ? r.findings.length : 0,
        verdict,
        firstFinding: r.ok && r.findings[0] ? {
          type: r.findings[0].type,
          riskScore: r.findings[0].riskScore,
          confidence: r.findings[0].confidence,
        } : null,
        error: r.error ?? null,
      })
    }
  }

  fs.mkdirSync(REPORTS_DIR, { recursive: true })
  const today = new Date().toISOString().split('T')[0]
  const outPath = path.join(REPORTS_DIR, `synthetic-eval-${today}.json`)
  fs.writeFileSync(outPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    engine: 'fiscal-digital@v1.5.0',
    totalSamples: allResults.length,
    matrix,
    results: allResults,
  }, null, 2))

  console.log('\n┌──────────────────┬─────────┬─────────┬─────────┬─────────┬─────────┐')
  console.log('│ Fiscal           │ TP_real │ FP_real │ TN_real │ FN_real │ errors  │')
  console.log('├──────────────────┼─────────┼─────────┼─────────┼─────────┼─────────┤')
  for (const [f, m] of Object.entries(matrix)) {
    console.log(`│ ${f.padEnd(16)} │ ${String(m.tp_real).padStart(7)} │ ${String(m.fp_real).padStart(7)} │ ${String(m.tn_real).padStart(7)} │ ${String(m.fn_real).padStart(7)} │ ${String(m.errors).padStart(7)} │`)
  }
  console.log('└──────────────────┴─────────┴─────────┴─────────┴─────────┴─────────┘')

  console.log('\n## Interpretacao')
  console.log('  TP_real = sintetico TP que o engine detectou (correto, deve continuar)')
  console.log('  FP_real = sintetico no_finding que o engine disparou (FP confirmado, patch deve barrar)')
  console.log('  TN_real = sintetico no_finding que o engine NAO disparou (correto, ja filtrado)')
  console.log('  FN_real = sintetico TP que o engine NAO detectou (gap de cobertura)')
  console.log(`\n✓ Output: reports/synthetic-eval-${today}.json`)
}

main().catch(err => { console.error('\n✗ Erro fatal:', err); process.exit(1) })
