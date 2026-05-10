#!/usr/bin/env node
/**
 * eval-synthetic.mjs — Roda os Fiscais sobre o dataset SINTETICO.
 *
 * Mock realista: substitui Bedrock Nova Lite por regex local que infere
 * actType, subtype, supplier, secretaria, valorOriginalContrato a partir
 * de padroes textuais do excerpt sintetico. Para excerpts limpos sinteticos,
 * regex pega tudo que Bedrock pegaria (e mais consistente).
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

// ── Regex extraction (substitui Bedrock para excerpts limpos) ────────────────

const CNPJ_RE = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g
const VALUE_RE = /R\$\s*[\d.,]+/g
const CONTRACT_RE = /(?:Contrato|Convênio|Ata|Termo)\s+(?:n[°º.]\s*)?(\d+\/\d{4})/gi
const DATE_RE = /\b(\d{2})\/(\d{2})\/(\d{4})\b/g

function normalizeCNPJ(raw) {
  const d = raw.replace(/\D/g, '')
  if (d.length !== 14) return raw
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}
function parseValue(raw) {
  return parseFloat(raw.replace(/R\$\s*/, '').replace(/\./g, '').replace(',', '.'))
}
function extractCNPJs(text) {
  return [...new Set((text.match(CNPJ_RE) ?? []).map(normalizeCNPJ))]
}
function extractValues(text) {
  return (text.match(VALUE_RE) ?? []).map(parseValue).filter(v => !isNaN(v) && v > 0)
}
function extractContractNumbers(text) {
  const out = []
  const re = new RegExp(CONTRACT_RE.source, CONTRACT_RE.flags)
  let m
  while ((m = re.exec(text)) !== null) out.push(m[1])
  return [...new Set(out)]
}
function extractDates(text) {
  const out = []
  const re = new RegExp(DATE_RE.source, DATE_RE.flags)
  let m
  while ((m = re.exec(text)) !== null) {
    const [, d, mo, y] = m
    if (+d >= 1 && +d <= 31 && +mo >= 1 && +mo <= 12 && +y >= 2000 && +y <= 2035) {
      out.push(`${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`)
    }
  }
  return [...new Set(out)]
}

// Inferencia de actType (substitui parte Bedrock)
function inferActType(text) {
  const t = text.toLowerCase()
  if (/termo\s+de\s+fomento|termo\s+de\s+colabora[çc][ãa]o/.test(t)) return 'convenio'
  if (/contrato\s+de\s+repasse/.test(t)) return 'repasse_federal'
  if (/loca[çc][ãa]o\s+de\s+im[óo]vel|loca[çc][ãa]o\s+de\s+pr[ée]dio/.test(t)) return 'locacao_imovel'
  if (/loca[çc][ãa]o\s+de\s+ve[íi]culo/.test(t)) return 'locacao_veiculo'
  if (/termo\s+aditivo|aditivo\s+ao\s+contrato|aditivo\s+contratual/.test(t)) return 'aditivo'
  if (/apostilamento/.test(t)) return 'apostilamento'
  if (/inexigibilidade/.test(t)) return 'inexigibilidade'
  if (/dispensa\s+de\s+licita[çc][ãa]o/.test(t)) return 'dispensa'
  if (/preg[ãa]o\s+(eletr[ôo]nico|presencial)/.test(t)) return 'licitacao'
  if (/concorr[êe]ncia\s+p[úu]blica/.test(t)) return 'licitacao'
  if (/extrato\s+de\s+rescis[ãa]o|rescis[ãa]o\s+contratual/.test(t)) return 'rescisao'
  if (/designar.*(gestor|fiscal)\s+de\s+contrato/.test(t)) return 'designacao'
  if (/(nomear|exonerar|nomeia|exonera|designa)\b/.test(t)) return 'pessoal'
  if (/decreto\s+n[º°]?\s*\d.*cr[ée]dito\s+(adicional\s+)?suplementar/.test(t)) return 'decreto_orcamentario'
  if (/portaria\s+n[º°]/.test(t)) return 'portaria'
  return null
}

function inferSubtype(text, actType) {
  const t = text.toLowerCase()
  if (actType === 'dispensa' || actType === 'inexigibilidade' || actType === 'licitacao') {
    if (/(obra|reforma|constru[çc][ãa]o|edifica[çc][ãa]o|pavimenta[çc][ãa]o|engenharia\s+civil|drenagem|terraplenagem)/.test(t)) return 'obra_engenharia'
    if (/(consultoria|assessoria|manuten[çc][ãa]o|limpeza|tecnologia\s+da\s+informa[çc][ãa]o|servi[çc]o)/.test(t)) return 'servico'
    if (/(aquisi[çc][ãa]o|equipamento|ve[íi]culo|material|insumo|medicamento|agulha|insumos\s+farmac[êe]uticos)/.test(t)) return 'compra'
  }
  return null
}

function inferSupplier(text) {
  // Padrao mais comum: "PARTES: ... e XYZ LTDA" ou "CONTRATADO: XYZ LTDA"
  const m = text.match(/(?:PARTES|CONTRATAD[OA]|CONTRATADA|LOCADOR(?:A)?|CONVENENTE):.*?(?:e\s+)?([A-ZÁÉÍÓÚÇÃÕ][A-ZÁÉÍÓÚÇÃÕ\s.&-]+?(?:LTDA|EIRELI|S\.?A\.?|EPP|ME|CNPJ|MEI|EIRELI ME))/i)
  if (m) return m[1].replace(/\s*-?\s*CNPJ.*$/, '').trim()
  // Tentativa alternativa via "celebra ... com NOME"
  const m2 = text.match(/celebra(?:r|do|m)?\s+(?:Termo[^\n]+?)?\s+com\s+([A-ZÁÉÍÓÚÇÃÕ][A-ZÁÉÍÓÚÇÃÕ\s.&-]{5,80}?)\s*(?:-|,|\n|CNPJ)/)
  if (m2) return m2[1].trim()
  return null
}

function inferSecretaria(text) {
  const m = text.match(/Secretaria\s+Municipal\s+(?:de\s+|d[ao]s?\s+)?([A-ZÁÉÍÓÚÇÃÕ][A-Za-zÁÉÍÓÚÇÃÕáéíóúçãõ\s]+?)(?:\s*[,.\n]|\s+e\s+|\s+do\s+(Município|Estado))/i)
  if (m) return `Secretaria Municipal de ${m[1].trim()}`
  return null
}

function inferLegalBasis(text) {
  const m = text.match(/Lei\s+(?:Federal\s+)?n[º°]?\s*([\d.,]+\/?\d*)/i)
  if (m) return `Lei nº ${m[1]}`
  return null
}

function inferValorOriginalContrato(text) {
  // "valor original de R$ X" / "valor inicial do contrato de R$ X" / "VALOR ORIGINAL: R$ X"
  const m = text.match(/(?:valor\s+(?:original|inicial)(?:\s+do\s+contrato)?|originalmente\s+firmado\s+por|VALOR\s+ORIGINAL)[:\s]+(?:de\s+)?(R\$\s*[\d.,]+)/i)
  if (m) return parseValue(m[1])
  return null
}

function makeRealisticContext(now = new Date()) {
  return {
    now: () => now,
    extractEntities: {
      execute: async ({ text, gazetteUrl }) => {
        return {
          data: {
            cnpjs: extractCNPJs(text),
            values: extractValues(text),
            dates: extractDates(text),
            contractNumbers: extractContractNumbers(text),
            secretaria: inferSecretaria(text),
            actType: inferActType(text),
            supplier: inferSupplier(text),
            legalBasis: inferLegalBasis(text),
            subtype: inferSubtype(text, inferActType(text)),
            valorOriginalContrato: inferValorOriginalContrato(text) ?? undefined,
          },
          source: gazetteUrl ?? 'synthetic',
          confidence: 0.85,
        }
      },
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
  const context = makeRealisticContext(new Date(g.date + 'T12:00:00Z'))

  try {
    const findings = await fiscal.analisar({ gazette, cityId: g.cityId, context })
    return { ok: true, findings }
  } catch (err) {
    return { ok: false, error: err.message, findings: [] }
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
      const verdict = !r.ok ? 'errors' :
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
    extractor: 'realistic-regex-mock-v1',
    totalSamples: allResults.length,
    matrix,
    results: allResults,
  }, null, 2))

  console.log('\n┌────────────────────┬─────────┬─────────┬─────────┬─────────┬─────────┐')
  console.log('│ Fiscal             │ TP_real │ FP_real │ TN_real │ FN_real │ errors  │')
  console.log('├────────────────────┼─────────┼─────────┼─────────┼─────────┼─────────┤')
  for (const [f, m] of Object.entries(matrix)) {
    console.log(`│ ${f.padEnd(18)} │ ${String(m.tp_real).padStart(7)} │ ${String(m.fp_real).padStart(7)} │ ${String(m.tn_real).padStart(7)} │ ${String(m.fn_real).padStart(7)} │ ${String(m.errors).padStart(7)} │`)
  }
  console.log('└────────────────────┴─────────┴─────────┴─────────┴─────────┴─────────┘')

  console.log('\n## Interpretacao')
  console.log('  TP_real = sintetico TP que o engine detectou (correto, deve continuar)')
  console.log('  FP_real = sintetico no_finding que o engine disparou (FP confirmado, patch deve barrar)')
  console.log('  TN_real = sintetico no_finding que o engine NAO disparou (correto, ja filtrado)')
  console.log('  FN_real = sintetico TP que o engine NAO detectou (gap de cobertura)')
  console.log(`\n✓ Output: reports/synthetic-eval-${today}.json`)
}

main().catch(err => { console.error('\n✗ Erro fatal:', err); process.exit(1) })
