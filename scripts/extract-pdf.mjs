#!/usr/bin/env node
/**
 * extract-pdf.mjs
 *
 * Baixa PDF do diário oficial cacheado em S3 (gazettes-cache-prod) e
 * extrai texto usando pdf-parse. Salva em golden-set/pdfs/{cityId}/{date}-{idx}.txt
 *
 * Idempotente: se o .txt já existe, pula.
 *
 * Uso:
 *   node scripts/extract-pdf.mjs --url=<url-do-querido-diario>
 *   node scripts/extract-pdf.mjs --all   # processa todas as samples sem texto extraído
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const PDFS_DIR = path.join(REPO_ROOT, 'golden-set/pdfs')
const SAMPLES_PATH = path.join(REPO_ROOT, 'golden-set/samples.json')

// Convenção do cache S3 (mesmo do engine):
// PDF original em https://data.queridodiario.ok.org.br/{cityId}/{date}/{hash}.pdf
// Cached em s3://fiscal-digital-gazettes-cache-prod/{cityId}/{date}/{hash}.pdf
// CDN em https://gazettes.fiscaldigital.org/{cityId}/{date}/{hash}.pdf

function pathFromQDUrl(url) {
  // https://data.queridodiario.ok.org.br/{cityId}/{date}/{hash}.pdf
  const m = url.match(/queridodiario\.ok\.org\.br\/(\d+\/\d{4}-\d{2}-\d{2}\/[a-f0-9]+\.pdf)/)
  return m ? m[1] : null
}

function txtPath(qdPath) {
  // 4305108/2026-04-15/abc123.pdf -> golden-set/pdfs/4305108/2026-04-15-abc123.txt
  const parts = qdPath.replace('.pdf', '').split('/')
  const cityId = parts[0]
  const date = parts[1]
  const hash = parts[2]
  return path.join(PDFS_DIR, cityId, `${date}-${hash}.txt`)
}

async function downloadPdf(qdPath, localPath, originalUrl) {
  // 1. Tentar S3 cache primeiro (PDFs recentes, ~2026-05+)
  try {
    const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3')
    const s3 = new S3Client({ region: 'us-east-1' })
    const r = await s3.send(new GetObjectCommand({
      Bucket: 'fiscal-digital-gazettes-cache-prod',
      Key: qdPath,
    }))
    const chunks = []
    for await (const chunk of r.Body) chunks.push(chunk)
    fs.mkdirSync(path.dirname(localPath), { recursive: true })
    fs.writeFileSync(localPath.replace('.txt', '.pdf'), Buffer.concat(chunks))
    return { source: 's3-cache' }
  } catch (err) {
    if (!(err.name === 'NoSuchKey' || err.message?.includes('does not exist'))) throw err
  }

  // 2. Fallback: baixar direto do Querido Diário (PDFs históricos pré-cache)
  const r = await fetch(originalUrl, {
    headers: { 'User-Agent': 'fiscal-digital-evaluations/0.1 (+https://fiscaldigital.org)' },
  })
  if (!r.ok) throw new Error(`QD HTTP ${r.status}`)
  const buffer = Buffer.from(await r.arrayBuffer())
  fs.mkdirSync(path.dirname(localPath), { recursive: true })
  fs.writeFileSync(localPath.replace('.txt', '.pdf'), buffer)
  return { source: 'qd-direct' }
}

async function extractTextFromPdf(pdfPath, txtFilePath) {
  // pdf-parse v1.x export default; usar require dinâmico via createRequire
  // para evitar problemas de ESM/CJS.
  const { createRequire } = await import('node:module')
  const require = createRequire(import.meta.url)
  const pdfParse = require('pdf-parse')

  const buffer = fs.readFileSync(pdfPath)
  const data = await pdfParse(buffer)
  fs.writeFileSync(txtFilePath, data.text)

  // Remove o .pdf binário (não entra no repo, está no .gitignore)
  return { pages: data.numpages, chars: data.text.length }
}

async function processUrl(url) {
  const qdPath = pathFromQDUrl(url)
  if (!qdPath) {
    console.error(`URL inválida: ${url}`)
    return null
  }

  const txtFilePath = txtPath(qdPath)
  const pdfFilePath = txtFilePath.replace('.txt', '.pdf')

  if (fs.existsSync(txtFilePath)) {
    return { url, txtPath: txtFilePath, cached: true }
  }

  fs.mkdirSync(path.dirname(txtFilePath), { recursive: true })

  console.log(`▶ ${qdPath}`)
  const dl = await downloadPdf(qdPath, txtFilePath, url)
  const stats = await extractTextFromPdf(pdfFilePath, txtFilePath)
  console.log(`  ${stats.pages} páginas, ${stats.chars} chars (${dl.source})`)

  return { url, txtPath: txtFilePath, ...stats }
}

async function main() {
  const args = process.argv.slice(2)
  const urlArg = args.find(a => a.startsWith('--url='))?.replace('--url=', '')
  const all = args.includes('--all')

  if (urlArg) {
    await processUrl(urlArg)
    return
  }

  if (all) {
    if (!fs.existsSync(SAMPLES_PATH)) {
      console.error(`samples.json não existe: ${SAMPLES_PATH}`)
      process.exit(1)
    }
    const ds = JSON.parse(fs.readFileSync(SAMPLES_PATH, 'utf8'))
    let processed = 0
    let cached = 0
    let errors = 0
    for (const sample of ds.samples) {
      const url = sample.evidence?.[0]?.source
      if (!url) continue
      try {
        const r = await processUrl(url)
        if (r?.cached) cached++
        else if (r) processed++
      } catch (err) {
        errors++
        console.warn(`  ⚠ erro em ${url}: ${err.message}`)
      }
    }
    console.log(`\n✓ ${processed} novos, ${cached} cached, ${errors} erros.`)
    return
  }

  console.error('Uso: --url=<qd-url> | --all')
  process.exit(1)
}

main().catch(err => {
  console.error('✗ Erro fatal:', err)
  process.exit(1)
})
