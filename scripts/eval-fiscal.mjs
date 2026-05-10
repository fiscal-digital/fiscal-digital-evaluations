#!/usr/bin/env node
/**
 * eval-fiscal.mjs — Roda os 10 Fiscais sobre os 101 PDFs do golden set offline.
 *
 * Importa Fiscais via path-based de @fiscal-digital/engine.
 * Para cada PDF:
 *   1. Carrega texto extraido
 *   2. Monta gazette synthetic { id, territory_id, date, url, excerpts }
 *   3. Para cada Fiscal, roda fiscal.analisar({ gazette, cityId, context })
 *   4. Captura findings emitidos (ou ausencia)
 *
 * Output: reports/eval-{YYYY-MM-DD}.json
 *   - matriz Fiscal x PDF: dispara? riskScore? confidence? type?
 *   - metricas globais: precisao/recall por Fiscal (vs golden-set rotulado)
 *
 * Uso:
 *   npm run eval                # roda contra todos PDFs do golden-set
 *   npm run eval -- --fiscal=X  # apenas 1 Fiscal
 *   npm run eval -- --pdf=Y     # apenas 1 PDF (debug)
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const GOLDEN_SET = path.join(REPO_ROOT, 'golden-set/samples.json')
const PDFS_DIR = path.join(REPO_ROOT, 'golden-set/pdfs')
const REPORTS_DIR = path.join(REPO_ROOT, 'reports')

// ── Importar engine ──────────────────────────────────────────────────────────
// Importa de dist/ porque package.json do engine declara main: dist/index.js

const engine = await import('@fiscal-digital/engine')
const FISCAIS = [
  engine.fiscalLicitacoes,
  engine.fiscalContratos,
  engine.fiscalFornecedores,
  engine.fiscalPessoal,
  engine.fiscalConvenios,
  engine.fiscalNepotismo,
  engine.fiscalPublicidade,
  engine.fiscalLocacao,
  engine.fiscalDiarias,
]
// Geral eh orquestrador — usa consolidar() em cima dos outros, nao analisar()
// Vamos rodar separadamente apos os demais

// ── Context offline (sem chamar Bedrock/DDB) ─────────────────────────────────

function makeOfflineContext(now = new Date()) {
  return {
    now: () => now,
    extractEntities: async (input) => {
      // Extracao local somente regex (sem Bedrock). Retorna entities vazias.
      // Atos de pessoal usam regex local; demais Fiscais usam Bedrock por default.
      // Para offline, retornamos dummy sem dados — Fiscal vai depender do que
      // consegue extrair via regex puro do excerpt.
      return {
        data: { type: 'unknown', subtype: null, value: null, cnpj: null, secretaria: null },
        source: 'offline-mock',
        confidence: 0,
      }
    },
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

// ── Carregar golden-set ──────────────────────────────────────────────────────

const golden = JSON.parse(fs.readFileSync(GOLDEN_SET, 'utf8'))

// Mapa cityId+date → expected sample (do golden set)
const expectedByGazette = new Map()
for (const s of golden.samples) {
  const url = s.evidence?.[0]?.source ?? ''
  const m = url.match(/(\d+)\/(\d{4}-\d{2}-\d{2})\/([a-f0-9]+)/)
  if (!m) continue
  const key = `${m[1]}#${m[2]}#${m[3]}`
  if (!expectedByGazette.has(key)) expectedByGazette.set(key, [])
  expectedByGazette.get(key).push(s)
}

// ── Listar PDFs disponiveis ──────────────────────────────────────────────────

function listPdfs() {
  const all = []
  for (const cityDir of fs.readdirSync(PDFS_DIR)) {
    const cityPath = path.join(PDFS_DIR, cityDir)
    if (!fs.statSync(cityPath).isDirectory()) continue
    for (const file of fs.readdirSync(cityPath)) {
      if (!file.endsWith('.txt')) continue
      const m = file.match(/^(\d{4}-\d{2}-\d{2})-([a-f0-9]+)\.txt$/)
      if (!m) continue
      all.push({
        cityId: cityDir,
        date: m[1],
        hash: m[2],
        textPath: path.join(cityPath, file),
      })
    }
  }
  return all
}

// ── Particionar texto em excerpts ────────────────────────────────────────────
// Estrategia: split por "\n\n" (paragrafos), depois agrupar em chunks de
// ~500 chars (similar ao que QD retorna em excerpts).

function partitionExcerpts(text, chunkSize = 500) {
  const paragraphs = text.split(/\n{2,}/).filter(p => p.trim().length > 50)
  const excerpts = []
  let current = ''
  for (const p of paragraphs) {
    if (current.length + p.length > chunkSize && current.length > 0) {
      excerpts.push(current.trim())
      current = p
    } else {
      current += '\n' + p
    }
  }
  if (current.trim().length > 0) excerpts.push(current.trim())
  return excerpts
}

// ── Rodar 1 Fiscal sobre 1 gazette ───────────────────────────────────────────

async function runFiscalOnGazette(fiscal, gazette, cityId, context) {
  try {
    const findings = await fiscal.analisar({ gazette, cityId, context })
    return { ok: true, findings, error: null }
  } catch (err) {
    return { ok: false, findings: [], error: err.message }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const fiscalFilter = args.find(a => a.startsWith('--fiscal='))?.replace('--fiscal=', '')
  const pdfFilter = args.find(a => a.startsWith('--pdf='))?.replace('--pdf=', '')

  const fiscais = fiscalFilter
    ? FISCAIS.filter(f => f.id === fiscalFilter)
    : FISCAIS

  if (fiscais.length === 0) {
    console.error(`Fiscal invalido: ${fiscalFilter}`)
    console.error(`Validos: ${FISCAIS.map(f => f.id).join(', ')}`)
    process.exit(1)
  }

  let pdfs = listPdfs()
  if (pdfFilter) {
    pdfs = pdfs.filter(p => p.textPath.includes(pdfFilter))
  }

  console.log(`\n${'═'.repeat(72)}`)
  console.log(`  eval-fiscal — Fiscal Digital`)
  console.log(`  Fiscais: ${fiscais.map(f => f.id).join(', ')}`)
  console.log(`  PDFs: ${pdfs.length}`)
  console.log(`${'═'.repeat(72)}\n`)

  const results = []
  let i = 0
  for (const pdf of pdfs) {
    i++
    const text = fs.readFileSync(pdf.textPath, 'utf8')
    const excerpts = partitionExcerpts(text)
    const gazette = {
      id: `${pdf.cityId}#${pdf.date}#${pdf.hash}`,
      territory_id: pdf.cityId,
      date: pdf.date,
      url: `https://data.queridodiario.ok.org.br/${pdf.cityId}/${pdf.date}/${pdf.hash}.pdf`,
      excerpts,
    }
    const context = makeOfflineContext(new Date(pdf.date + 'T12:00:00Z'))

    const expected = expectedByGazette.get(`${pdf.cityId}#${pdf.date}#${pdf.hash}`) ?? []

    const fiscalResults = {}
    for (const fiscal of fiscais) {
      const r = await runFiscalOnGazette(fiscal, gazette, pdf.cityId, context)
      fiscalResults[fiscal.id] = {
        emitted: r.findings.length,
        findings: r.findings.map(f => ({
          type: f.type,
          riskScore: f.riskScore,
          confidence: f.confidence,
          cnpj: f.cnpj ?? null,
          value: f.value ?? null,
          secretaria: f.secretaria ?? null,
        })),
        error: r.error,
      }
    }

    results.push({
      gazetteId: gazette.id,
      cityId: pdf.cityId,
      date: pdf.date,
      pages: text.split('\n').length,
      chars: text.length,
      excerptCount: excerpts.length,
      expected: expected.map(e => ({ id: e.id, fiscalId: e.fiscalId, type: e.type, label: e.label })),
      fiscalResults,
    })

    if (i % 10 === 0) console.log(`  ... ${i}/${pdfs.length}`)
  }

  // Salvar
  fs.mkdirSync(REPORTS_DIR, { recursive: true })
  const today = new Date().toISOString().split('T')[0]
  const outPath = path.join(REPORTS_DIR, `eval-${today}.json`)
  fs.writeFileSync(outPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    engine: 'fiscal-digital@v1.5.0',
    fiscaisRun: fiscais.map(f => f.id),
    pdfsRun: pdfs.length,
    expectedCount: golden.samples.length,
    results,
  }, null, 2))

  console.log(`\n✓ ${pdfs.length} PDFs processados`)
  console.log(`✓ ${fiscais.length} Fiscais avaliados`)
  console.log(`✓ Output: reports/eval-${today}.json`)

  // Stats rapidas
  const stats = {}
  for (const fiscal of fiscais) {
    let total = 0
    for (const r of results) {
      total += r.fiscalResults[fiscal.id]?.emitted ?? 0
    }
    stats[fiscal.id] = total
  }
  console.log('\n┌─────────────────────────────┬──────────┐')
  console.log('│ Fiscal                      │ Findings │')
  console.log('├─────────────────────────────┼──────────┤')
  for (const [id, n] of Object.entries(stats)) {
    console.log(`│ ${id.padEnd(27)} │   ${String(n).padStart(4)}   │`)
  }
  console.log('└─────────────────────────────┴──────────┘')
}

main().catch(err => {
  console.error('\n✗ Erro fatal:', err)
  process.exit(1)
})
