#!/usr/bin/env node
/**
 * calibrate-labeler.mjs — Gate de calibração do rotulador do golden set.
 *
 * ⚠️  O QUE ESTE GATE MEDE (e o que NÃO mede)
 * ------------------------------------------------------------------
 * Os rótulos atuais das amostras NÃO são humanos: `labeledBy` ∈
 * {claude-sonnet-4-6, claude-opus-4-7-via-subagent}. Portanto este script mede
 * a CONCORDÂNCIA entre uma re-rotulagem rigorosa e cega (o "juiz") e um
 * rótulo-IA anterior (o "baseline").
 *
 *   ✅ mede: confiabilidade/reprodutibilidade do processo de rotulagem e
 *            quanto o baseline atual mudaria sob re-rotulagem rigorosa.
 *   ❌ NÃO mede: acurácia contra verdade humana. Não existe âncora humana
 *            nestas 1.695 amostras. κ alto = processo estável, NÃO = correto.
 *
 * O juiz é CEGO: recebe apenas o finding (sem `label`, `rationale`,
 * `rootCause`, `adjustment`, `labeledBy`), um digest do PDF do diário e o
 * corpus legal canônico. Nunca vê o rótulo existente.
 *
 * Read-only sobre os dados: NUNCA escreve em golden-set/samples.json.
 *
 * Uso:
 *   node scripts/calibrate-labeler.mjs                    # piloto padrão (~60 amostras)
 *   node scripts/calibrate-labeler.mjs --target=70
 *   node scripts/calibrate-labeler.mjs --limit=5          # smoke test
 *   node scripts/calibrate-labeler.mjs --dry-run          # só amostragem, sem chamar modelo
 *   node scripts/calibrate-labeler.mjs --model=us.anthropic.claude-opus-4-6-v1
 *   node scripts/calibrate-labeler.mjs --engine=../fiscal-digital
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const SAMPLES_PATH = path.join(REPO_ROOT, 'golden-set/samples.json')
const PDFS_DIR = path.join(REPO_ROOT, 'golden-set/pdfs')
const REPORTS_DIR = path.join(REPO_ROOT, 'reports')

// ── CLI ──────────────────────────────────────────────────────────────────────

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/)
    return m ? [m[1], m[2] ?? true] : [a, true]
  }),
)

const TARGET_N = Number(args.target ?? 60)
const FLOOR_PER_FISCAL = Number(args.floor ?? 2)
const SEED = Number(args.seed ?? 20260723)
const LIMIT = args.limit ? Number(args.limit) : null
const DRY_RUN = Boolean(args['dry-run'])
const CONCURRENCY = Number(args.concurrency ?? 4)
const JUDGE_MODEL = String(args.model ?? 'us.anthropic.claude-opus-4-6-v1')
const AWS_REGION = String(args.region ?? 'us-east-1')

const ENGINE_ROOT = path.resolve(
  REPO_ROOT,
  String(args.engine ?? process.env.FISCAL_DIGITAL_ENGINE ?? '../fiscal-digital'),
)
const CORPUS_DIR = path.join(ENGINE_ROOT, 'packages/engine/src/legal-corpus')
const FISCAIS_DIR = path.join(ENGINE_ROOT, 'packages/engine/src/fiscais')

// Orçamento de contexto por amostra (chars) — mantém custo previsível.
const PDF_DIGEST_BUDGET = 14000
const LEGAL_BUDGET = 11000

const LABELS = ['TP', 'FP', 'borderline']

// ── util ─────────────────────────────────────────────────────────────────────

const log = (...a) => console.log(...a)

/** PRNG determinístico (mulberry32) — amostragem reprodutível. */
function mulberry32(seed) {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function shuffled(arr, rnd) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function countBy(arr, fn) {
  const m = {}
  for (const x of arr) {
    const k = fn(x)
    m[k] = (m[k] || 0) + 1
  }
  return m
}

// ── PDF: localizar e digerir ─────────────────────────────────────────────────

/** evidence[0].source (URL do Querido Diário) -> caminho do .txt extraído. */
function txtPathFromSource(url) {
  const m = String(url || '').match(
    /queridodiario\.ok\.org\.br\/(\d+)\/(\d{4}-\d{2}-\d{2})\/([a-f0-9]+)\.pdf/,
  )
  if (!m) return null
  return path.join(PDFS_DIR, m[1], `${m[2]}-${m[3]}.txt`)
}

function normalizeForSearch(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

/**
 * Termos que sinalizam justificativa/fundamento em OUTRA parte do diário.
 * Crítico para detectar FP: o Fiscal pode ter disparado sem ver a justificativa.
 */
const JUSTIFICATION_TERMS = [
  'justificativa',
  'fundamenta',
  'razao da escolha',
  'emergencia',
  'calamidade',
  'inexigibilidade',
  'ratifico',
  'parecer juridico',
  'fornecedor exclusivo',
  'notoria especializacao',
  'chamamento publico',
  'dispensa de licitacao',
  'termo de fomento',
  'vacancia',
  'a pedido',
]

/**
 * Monta um digest do PDF: cabeçalho + janelas em volta de cada excerpt de
 * evidência + janelas em volta de termos de justificativa. PDFs têm ~230KB em
 * média; mandar inteiro estouraria contexto e custo sem ganho de sinal.
 */
function buildPdfDigest(rawText, sample) {
  const text = rawText
  const norm = normalizeForSearch(text)
  const windows = []

  const pushWindow = (center, radius, tag) => {
    const start = Math.max(0, center - radius)
    const end = Math.min(text.length, center + radius)
    windows.push({ start, end, tag })
  }

  // 1. Cabeçalho / índice do diário (identifica município, data, sumário).
  pushWindow(1200, 1200, 'cabecalho')

  // 2. Âncoras: fragmentos de cada excerpt da evidência.
  for (const ev of sample.evidence || []) {
    const chunks = String(ev.excerpt || '')
      .split(/\n---\n/)
      .map((c) => c.trim())
      .filter(Boolean)
    for (const chunk of chunks) {
      // usa um fragmento distintivo do meio do chunk como chave de busca
      const probe = normalizeForSearch(chunk).slice(0, 60)
      if (probe.length < 15) continue
      const idx = norm.indexOf(probe)
      if (idx >= 0) pushWindow(idx + probe.length / 2, 1600, 'evidencia')
    }
  }

  // 3. Termos de justificativa (até 2 ocorrências por termo).
  for (const term of JUSTIFICATION_TERMS) {
    let from = 0
    for (let hit = 0; hit < 2; hit++) {
      const idx = norm.indexOf(term, from)
      if (idx < 0) break
      pushWindow(idx, 700, `justificativa:${term}`)
      from = idx + term.length
    }
  }

  // Merge de janelas sobrepostas, respeitando o orçamento.
  windows.sort((a, b) => a.start - b.start)
  const merged = []
  for (const w of windows) {
    const last = merged[merged.length - 1]
    if (last && w.start <= last.end + 200) {
      last.end = Math.max(last.end, w.end)
      if (!last.tags.includes(w.tag)) last.tags.push(w.tag)
    } else {
      merged.push({ start: w.start, end: w.end, tags: [w.tag] })
    }
  }

  let budget = PDF_DIGEST_BUDGET
  const parts = []
  for (const w of merged) {
    if (budget <= 0) break
    const slice = text.slice(w.start, Math.min(w.end, w.start + budget))
    budget -= slice.length
    parts.push(`[…trecho @${w.start}-${w.start + slice.length} | ${w.tags.join(', ')}…]\n${slice}`)
  }

  return {
    digest: parts.join('\n\n'),
    totalChars: text.length,
    digestChars: PDF_DIGEST_BUDGET - budget,
    windows: merged.length,
    truncated: budget <= 0,
  }
}

// ── Corpus legal canônico ────────────────────────────────────────────────────

/** Normaliza "Lei 14.133/2021" -> "lei-14133-2021"; "CF, Art. 37" -> "cf-1988". */
function normaIdFromCitation(citation) {
  const c = String(citation || '')
  const ids = new Set()

  const leiRe = /lei\s*(?:complementar\s*)?n?º?\s*([\d.]+)\s*\/\s*(\d{2,4})/gi
  let m
  while ((m = leiRe.exec(c))) {
    const num = m[1].replace(/\./g, '')
    let year = m[2]
    if (year.length === 2) year = Number(year) > 50 ? `19${year}` : `20${year}`
    ids.add(`lei-${num}-${year}`)
  }

  const decRe = /decreto\s*n?º?\s*([\d.]+)\s*\/?\s*(?:de\s*)?(\d{4})?/gi
  while ((m = decRe.exec(c))) {
    const num = m[1].replace(/\./g, '')
    if (m[2]) ids.add(`decreto-${num}-${m[2]}`)
  }

  if (/\bCF\b|constitui[çc][ãa]o|constitucional/i.test(c)) ids.add('cf-1988')
  if (/s[úu]mula\s*vinculante\s*(n?º?\s*)?13|sv[- ]?13/i.test(c)) ids.add('stf-sv-13')

  return [...ids]
}

function articlesFromCitation(citation) {
  const arts = new Set()
  const re = /art(?:igo)?\.?\s*(\d+)/gi
  let m
  while ((m = re.exec(String(citation || '')))) arts.add(m[1])
  return [...arts]
}

let corpusIndexCache = null
function corpusIndex() {
  if (corpusIndexCache) return corpusIndexCache
  const idx = {}
  if (!fs.existsSync(CORPUS_DIR)) return (corpusIndexCache = idx)
  for (const dir of fs.readdirSync(CORPUS_DIR)) {
    const full = path.join(CORPUS_DIR, dir)
    if (!fs.statSync(full).isDirectory()) continue
    const artigos = {}
    for (const f of fs.readdirSync(full)) {
      const am = f.match(/^art-(\d+)\.md$/)
      if (am) artigos[am[1]] = path.join(full, f)
    }
    idx[dir] = { dir: full, artigos }
  }
  return (corpusIndexCache = idx)
}

/** Resolve uma citação contra o corpus canônico. */
function resolveCitation(citation) {
  const idx = corpusIndex()
  const normas = normaIdFromCitation(citation)
  const arts = articlesFromCitation(citation)
  const resolved = []
  const unresolved = []

  for (const norma of normas) {
    const entry = idx[norma]
    if (!entry) {
      unresolved.push({ norma, artigo: null, reason: 'norma-fora-do-corpus' })
      continue
    }
    if (arts.length === 0) {
      resolved.push({ norma, artigo: null, file: null, text: null })
      continue
    }
    for (const artigo of arts) {
      const file = entry.artigos[artigo]
      if (file) {
        resolved.push({
          norma,
          artigo,
          file: path.relative(ENGINE_ROOT, file).replace(/\\/g, '/'),
          text: fs.readFileSync(file, 'utf8'),
        })
      } else {
        unresolved.push({ norma, artigo, reason: 'artigo-nao-sincronizado-no-corpus' })
      }
    }
  }
  return { resolved, unresolved, normas, artigos: arts }
}

const FISCAL_LEGAL_MD = {
  'fiscal-pessoal': 'pessoal.legal.md',
  'fiscal-licitacoes': 'licitacoes.legal.md',
  'fiscal-contratos': 'contratos.legal.md',
  'fiscal-fornecedores': 'fornecedores.legal.md',
  'fiscal-convenios': 'convenios.legal.md',
  'fiscal-nepotismo': 'nepotismo.legal.md',
  'fiscal-publicidade': 'publicidade.legal.md',
  'fiscal-locacao': 'locacao.legal.md',
  'fiscal-diarias': 'diarias.legal.md',
  'fiscal-geral': 'geral.legal.md',
}

function buildLegalGrounding(sample) {
  const parts = []
  let budget = LEGAL_BUDGET

  const mdName = FISCAL_LEGAL_MD[sample.fiscalId]
  const mdPath = mdName ? path.join(FISCAIS_DIR, mdName) : null
  if (mdPath && fs.existsSync(mdPath)) {
    const md = fs.readFileSync(mdPath, 'utf8').slice(0, 7000)
    budget -= md.length
    parts.push(`### Base legal do ${sample.fiscalId} (fonte: packages/engine/src/fiscais/${mdName})\n\n${md}`)
  }

  const cit = resolveCitation(sample.legalBasis)
  for (const r of cit.resolved) {
    if (!r.text || budget <= 0) continue
    const t = r.text.slice(0, Math.min(4000, budget))
    budget -= t.length
    parts.push(`### Texto canônico — ${r.norma} Art. ${r.artigo} (fonte: ${r.file})\n\n${t}`)
  }

  return { text: parts.join('\n\n---\n\n'), citation: cit }
}

// ── Amostragem estratificada ─────────────────────────────────────────────────

/**
 * Alocação proporcional por fiscalId com piso, e — dentro de cada Fiscal —
 * distribuição proporcional entre os rótulos existentes.
 *
 * NOTA: usar o label existente para estratificar NÃO vaza o rótulo para o juiz.
 * A estratificação acontece na seleção; o juiz recebe o payload já higienizado.
 * Estratificar por label garante que a matriz de confusão tenha células
 * povoadas em TP/FP/borderline (sem isso, ~71% da amostra seria FP).
 */
function stratifiedSample(eligible, { target, floor, seed }) {
  const rnd = mulberry32(seed)
  const byFiscal = {}
  for (const s of eligible) (byFiscal[s.fiscalId] ||= []).push(s)

  const fiscais = Object.keys(byFiscal).sort()
  const total = eligible.length

  // 1. quota proporcional com piso, limitada pelo disponível
  const quota = {}
  for (const f of fiscais) {
    const avail = byFiscal[f].length
    const prop = (avail / total) * target
    quota[f] = Math.min(avail, Math.max(Math.min(floor, avail), Math.round(prop)))
  }

  // 2. ajuste fino para aproximar do alvo (respeitando disponibilidade)
  const sumQ = () => Object.values(quota).reduce((a, b) => a + b, 0)
  let guard = 0
  while (sumQ() > target && guard++ < 1000) {
    // remove do Fiscal com maior excedente acima do piso
    const cand = fiscais
      .filter((f) => quota[f] > Math.min(floor, byFiscal[f].length))
      .sort((a, b) => quota[b] - quota[a])[0]
    if (!cand) break
    quota[cand]--
  }
  guard = 0
  while (sumQ() < target && guard++ < 1000) {
    const cand = fiscais
      .filter((f) => quota[f] < byFiscal[f].length)
      .sort((a, b) => byFiscal[b].length - byFiscal[a].length)[0]
    if (!cand) break
    quota[cand]++
  }

  // 3. dentro do Fiscal, reparte a quota entre os rótulos presentes
  const selected = []
  const allocation = []
  for (const f of fiscais) {
    const pool = byFiscal[f]
    const byLabel = {}
    for (const s of pool) (byLabel[s.label] ||= []).push(s)
    const labelsPresent = Object.keys(byLabel).sort()

    const q = quota[f]
    const labelQuota = {}
    let assigned = 0
    for (const l of labelsPresent) {
      const prop = (byLabel[l].length / pool.length) * q
      labelQuota[l] = Math.min(byLabel[l].length, Math.max(q >= labelsPresent.length ? 1 : 0, Math.floor(prop)))
      assigned += labelQuota[l]
    }
    // distribui o resto para os rótulos mais frequentes
    const order = labelsPresent.slice().sort((a, b) => byLabel[b].length - byLabel[a].length)
    // o piso de 1 por label pode estourar a quota do Fiscal — apara do maior grupo
    let ti = 0
    while (assigned > q && ti++ < 1000) {
      let moved = false
      for (const l of order) {
        if (assigned <= q) break
        if (labelQuota[l] > 1) {
          labelQuota[l]--
          assigned--
          moved = true
        }
      }
      if (!moved) break
    }
    let gi = 0
    while (assigned < q && gi++ < 1000) {
      let moved = false
      for (const l of order) {
        if (assigned >= q) break
        if (labelQuota[l] < byLabel[l].length) {
          labelQuota[l]++
          assigned++
          moved = true
        }
      }
      if (!moved) break
    }

    const picked = []
    for (const l of labelsPresent) {
      const take = shuffled(byLabel[l], rnd).slice(0, labelQuota[l])
      picked.push(...take)
    }
    selected.push(...picked)

    allocation.push({
      fiscalId: f,
      disponivel: pool.length,
      selecionadas: picked.length,
      deixadasDeFora: pool.length - picked.length,
      porLabelDisponivel: countBy(pool, (s) => s.label),
      porLabelSelecionado: countBy(picked, (s) => s.label),
    })
  }

  selected.sort((a, b) => a.id.localeCompare(b.id))
  return { selected, allocation, quota }
}

// ── Juiz (Bedrock) ───────────────────────────────────────────────────────────

const JUDGE_SYSTEM = `Você é um auditor jurídico sênior de contas públicas municipais brasileiras.
Sua tarefa: julgar, de forma RIGOROSA e INDEPENDENTE, se um alerta automatizado
("finding") emitido por um Fiscal digital sobre um Diário Oficial municipal é
procedente.

Você receberá:
1. O FINDING (tipo, score, narrativa, base legal alegada, trechos de evidência).
2. Um DIGEST DO DIÁRIO OFICIAL (texto real extraído do PDF — cabeçalho, trechos
   ao redor da evidência e trechos com possíveis justificativas em outras partes
   do documento).
3. O CORPUS LEGAL CANÔNICO aplicável (texto oficial dos artigos, sincronizado do
   Planalto) e os critérios de avaliação do Fiscal.

Você NÃO recebe nenhum rótulo prévio. Julgue apenas com base nas evidências acima.

RÓTULOS POSSÍVEIS:
- "TP" (verdadeiro positivo): o diário CONFIRMA a irregularidade alegada. Há
  indício real do tipo detectado, e a base legal se aplica ao fato.
- "FP" (falso positivo): o diário NÃO sustenta a alegação. Caso normal, legalmente
  justificado, erro de regex/heurística (ex.: "dispensa de pagamento" tratada como
  "dispensa de licitação"), contagem inflada, ou base legal inaplicável.
- "borderline": genuinamente ambíguo. O digest não traz dados suficientes para
  decidir, a justificativa pode estar em documento não publicado, ou há dúvida
  jurídica real. Use com parcimônia — não é um escape para dúvida preguiçosa.

CAMPO "derivability" — classifique COMO você chegou ao rótulo:
- "fact-derivable": o rótulo decorre de fato objetivo e verificável no documento —
  aritmética (valor vs. teto legal), contagem de atos, datas (janela eleitoral,
  fim de semana), presença/ausência literal de um termo exigido por lei.
- "judgment": o rótulo depende de juízo subjetivo — razoabilidade da justificativa,
  suficiência de fundamentação, interpretação de conceito jurídico aberto,
  presunção sobre o que não está no documento.

Responda APENAS com um objeto JSON válido, sem markdown e sem texto fora do JSON:
{
  "judgeLabel": "TP" | "FP" | "borderline",
  "rationale": "2-5 frases. DEVE citar um trecho literal do diário entre aspas que sustente a decisão.",
  "pdfQuote": "trecho literal copiado do digest do diário que embasa a decisão",
  "legalCitation": "artigo verificado, ex: 'Lei 14.133/2021, Art. 75, II' — ou 'n/a' se nenhum se aplica",
  "legalCitationCorrect": true | false,
  "legalCitationNote": "a base legal alegada pelo finding está correta? se não, qual seria",
  "derivability": "fact-derivable" | "judgment",
  "judgeConfidence": 0.0-1.0
}`

function buildJudgeUserMessage(sample, pdf, legal) {
  // ⚠️ payload HIGIENIZADO: nunca inclui label/rationale/rootCause/labeledBy.
  const finding = {
    id: sample.id,
    fiscalId: sample.fiscalId,
    cityId: sample.cityId,
    type: sample.type,
    riskScore: sample.riskScore,
    confidence: sample.confidence,
    narrative: sample.narrative,
    legalBasisAlegada: sample.legalBasis,
    evidence: (sample.evidence || []).map((e) => ({
      excerpt: e.excerpt,
      date: e.date,
      source: e.source,
    })),
  }

  return `## 1. FINDING EMITIDO PELO FISCAL

\`\`\`json
${JSON.stringify(finding, null, 2)}
\`\`\`

## 2. DIGEST DO DIÁRIO OFICIAL (texto real do PDF)

Documento completo tem ${pdf.totalChars} caracteres; abaixo ${pdf.digestChars} caracteres
selecionados em ${pdf.windows} janelas (cabeçalho + entorno da evidência + termos de justificativa).
Trechos omitidos estão marcados por [...trecho @offset...].

\`\`\`
${pdf.digest}
\`\`\`

## 3. CORPUS LEGAL CANÔNICO E CRITÉRIOS DO FISCAL

${legal.text || '(sem corpus resolvido para esta citação)'}

---

Julgue o finding. Responda apenas o JSON especificado.`
}

let bedrockMod = null
async function loadBedrock() {
  if (bedrockMod) return bedrockMod
  const candidates = [
    path.join(ENGINE_ROOT, 'packages/engine/package.json'),
    path.join(ENGINE_ROOT, 'package.json'),
    path.join(REPO_ROOT, 'package.json'),
  ]
  let lastErr = null
  for (const c of candidates) {
    try {
      if (!fs.existsSync(c)) continue
      const req = createRequire(c)
      const p = req.resolve('@aws-sdk/client-bedrock-runtime')
      bedrockMod = await import(pathToFileURL(p).href)
      return bedrockMod
    } catch (e) {
      lastErr = e
    }
  }
  throw new Error(
    `Não foi possível resolver @aws-sdk/client-bedrock-runtime. Instale no repo ou aponte --engine para o repo fiscal-digital. Causa: ${lastErr?.message}`,
  )
}

function parseJudgeJson(raw) {
  let t = String(raw || '').trim()
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  try {
    return JSON.parse(t)
  } catch {
    const start = t.indexOf('{')
    const end = t.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(t.slice(start, end + 1))
      } catch {
        /* cai fora */
      }
    }
  }
  return null
}

async function judgeOne(client, cmds, sample) {
  const txt = txtPathFromSource(sample.evidence?.[0]?.source)
  if (!txt || !fs.existsSync(txt)) {
    return { ok: false, error: 'pdf-txt-ausente', sample }
  }
  const rawText = fs.readFileSync(txt, 'utf8')
  const pdf = buildPdfDigest(rawText, sample)
  const legal = buildLegalGrounding(sample)
  const userMessage = buildJudgeUserMessage(sample, pdf, legal)

  const { ConverseCommand } = cmds
  let lastErr = null
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await client.send(
        new ConverseCommand({
          modelId: JUDGE_MODEL,
          system: [{ text: JUDGE_SYSTEM }],
          messages: [{ role: 'user', content: [{ text: userMessage }] }],
          inferenceConfig: { maxTokens: 1400, temperature: 0 },
        }),
      )
      const out = r.output?.message?.content?.[0]?.text ?? ''
      const parsed = parseJudgeJson(out)
      if (!parsed || !LABELS.includes(parsed.judgeLabel)) {
        lastErr = new Error(`resposta inválida do juiz: ${String(out).slice(0, 200)}`)
        continue
      }
      // Verifica a citação do juiz contra o corpus canônico.
      const jc = resolveCitation(parsed.legalCitation)
      return {
        ok: true,
        sample,
        judge: parsed,
        judgeCitationCheck: {
          citation: parsed.legalCitation,
          resolved: jc.resolved.map((x) => ({ norma: x.norma, artigo: x.artigo, file: x.file })),
          unresolved: jc.unresolved,
          verifiedInCorpus: jc.resolved.some((x) => x.file) || /^n\/?a$/i.test(String(parsed.legalCitation || '')),
        },
        grounding: {
          pdfTxt: path.relative(REPO_ROOT, txt).replace(/\\/g, '/'),
          pdfTotalChars: pdf.totalChars,
          pdfDigestChars: pdf.digestChars,
          pdfWindows: pdf.windows,
          legalChars: legal.text.length,
          baselineCitationResolved: legal.citation.resolved.map((x) => ({
            norma: x.norma,
            artigo: x.artigo,
            file: x.file,
          })),
          baselineCitationUnresolved: legal.citation.unresolved,
        },
        usage: r.usage ?? null,
      }
    } catch (e) {
      lastErr = e
      const retryable = /Throttl|TooManyRequests|ServiceUnavailable|Timeout|ModelNotReady|500/i.test(
        `${e.name} ${e.message}`,
      )
      if (!retryable && attempt >= 1) break
      await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt))
    }
  }
  return { ok: false, error: lastErr?.message || 'falha desconhecida', sample }
}

async function runPool(items, worker, concurrency) {
  const results = new Array(items.length)
  let next = 0
  let done = 0
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    for (;;) {
      const i = next++
      if (i >= items.length) return
      results[i] = await worker(items[i], i)
      done++
      process.stdout.write(`\r  julgadas ${done}/${items.length}   `)
    }
  })
  await Promise.all(runners)
  process.stdout.write('\n')
  return results
}

// ── Métricas: κ de Cohen ─────────────────────────────────────────────────────

/**
 * κ de Cohen para categorias nominais (TP/FP/borderline).
 * κ = (po - pe) / (1 - pe)
 * Retorna null quando indefinido (n<2 ou pe=1, ex.: uma única categoria usada
 * por ambos os avaliadores — nesse caso κ é degenerado e reportar 0 seria mentira).
 */
function cohenKappa(pairs, categories = LABELS) {
  const n = pairs.length
  if (n === 0) return { kappa: null, n: 0, po: null, pe: null, note: 'sem pares' }

  const cats = categories.filter(
    (c) => pairs.some((p) => p.a === c) || pairs.some((p) => p.b === c),
  )
  let agree = 0
  const aCount = {}
  const bCount = {}
  for (const p of pairs) {
    if (p.a === p.b) agree++
    aCount[p.a] = (aCount[p.a] || 0) + 1
    bCount[p.b] = (bCount[p.b] || 0) + 1
  }
  const po = agree / n
  let pe = 0
  for (const c of cats) pe += ((aCount[c] || 0) / n) * ((bCount[c] || 0) / n)

  // PABAK: κ ajustado por prevalência e viés. Com marginais muito assimétricas
  // (ex.: um avaliador quase só emite FP), κ despenca mesmo com p₀ alto — o
  // "paradoxo do κ". PABAK isola a concordância bruta do efeito de prevalência.
  const kCats = Math.max(2, categories.length)
  const pabak = (kCats * po - 1) / (kCats - 1)

  if (n < 2) return { kappa: null, n, po, pe, pabak, note: 'n<2, κ indefinido' }
  if (Math.abs(1 - pe) < 1e-12) {
    return {
      kappa: null,
      n,
      po,
      pe,
      pabak,
      note: 'pe=1 (ambos usaram uma única categoria) — κ indefinido; use p₀/PABAK',
    }
  }
  return { kappa: (po - pe) / (1 - pe), n, po, pe, pabak, note: null }
}

/**
 * Diagnóstico de marginais: κ baixo pode significar (a) rotulagem instável ou
 * (b) simples deslocamento de prevalência entre avaliadores. Distinguir os dois
 * é essencial para não vender "processo instável" quando o que houve foi um juiz
 * sistematicamente mais cético.
 */
function marginalDiagnostics(pairs, categories = LABELS) {
  const n = pairs.length
  const baseline = {}
  const judge = {}
  for (const c of categories) {
    baseline[c] = pairs.filter((p) => p.a === c).length
    judge[c] = pairs.filter((p) => p.b === c).length
  }
  const shift = {}
  for (const c of categories) shift[c] = (judge[c] - baseline[c]) / Math.max(1, n)
  const maxAbsShift = Math.max(...categories.map((c) => Math.abs(shift[c])))
  return {
    n,
    baselineCounts: baseline,
    judgeCounts: judge,
    prevalenceShift: shift,
    maxAbsPrevalenceShift: maxAbsShift,
    interpretation:
      maxAbsShift >= 0.15
        ? 'deslocamento de prevalência ALTO: o juiz e o baseline usam as categorias em proporções muito diferentes. κ está sendo penalizado por marginais assimétricas (paradoxo do κ) — leia p₀ e PABAK junto com κ, e trate a diferença de prevalência como a principal descoberta.'
        : 'deslocamento de prevalência baixo: κ reflete majoritariamente (des)acordo item a item, não diferença de calibração global.',
  }
}

function kappaInterpretation(k) {
  if (k === null || k === undefined) return 'indefinido'
  if (k < 0) return 'pior que acaso'
  if (k < 0.2) return 'desprezível'
  if (k < 0.4) return 'fraca'
  if (k < 0.6) return 'moderada'
  if (k < 0.8) return 'substancial'
  return 'quase perfeita'
}

function confusionMatrix(pairs, categories = LABELS) {
  const m = {}
  for (const a of categories) {
    m[a] = {}
    for (const b of categories) m[a][b] = 0
  }
  for (const p of pairs) {
    if (!m[p.a]) m[p.a] = {}
    m[p.a][p.b] = (m[p.a][p.b] || 0) + 1
  }
  return m
}

// ── Relatório markdown ───────────────────────────────────────────────────────

function fmtK(k) {
  return k === null || k === undefined ? 'n/d' : k.toFixed(3)
}
function pct(x) {
  return x === null || x === undefined ? 'n/d' : `${(x * 100).toFixed(1)}%`
}

function renderMarkdown(report) {
  const L = []
  const r = report
  L.push(`# Gate de Calibração do Rotulador — ${r.runDate}`)
  L.push('')
  L.push('## ⚠️ O que este número é (e o que não é)')
  L.push('')
  L.push(
    `Os rótulos do golden set **não são humanos**. \`labeledBy\` das ${r.dataset.totalSamples} amostras: ` +
      Object.entries(r.dataset.labeledByDistribution)
        .map(([k, v]) => `\`${k}\` (${v})`)
        .join(', ') +
      '.',
  )
  L.push('')
  L.push(
    'Portanto o κ abaixo mede **concordância IA-vs-IA**: quanto uma re-rotulagem rigorosa e cega ' +
      '(juiz) reproduz o rótulo-IA anterior (baseline). Isso é uma medida de **confiabilidade do ' +
      'processo e de quanto o baseline mudaria** sob re-rotulagem — **não** é acurácia contra ' +
      'verdade humana. Não existe âncora humana neste conjunto: κ alto significa processo estável, ' +
      'não significa rótulo correto. Dois modelos podem concordar e ambos estarem errados.',
  )
  L.push('')
  L.push('## Mecanismo')
  L.push('')
  L.push(`| Item | Valor |`)
  L.push(`|---|---|`)
  L.push(`| Juiz | \`${r.judge.model}\` via Bedrock Converse (${r.judge.region}) |`)
  L.push(`| Baseline rotulado por | ${Object.keys(r.dataset.labeledByDistribution).join(', ')} |`)
  L.push(`| Cegueira | juiz nunca recebe \`label\`/\`rationale\`/\`rootCause\`/\`labeledBy\` |`)
  L.push(`| Temperatura | 0 |`)
  L.push(`| Grounding | digest do PDF real + corpus legal canônico (\`legal-corpus/\`) + \`*.legal.md\` |`)
  L.push(`| Amostra | ${r.pilot.judged} julgadas de ${r.pilot.selected} selecionadas (alvo ${r.pilot.target}) |`)
  L.push(`| Seed | ${r.pilot.seed} (amostragem determinística) |`)
  L.push(`| Falhas do juiz | ${r.pilot.failed} |`)
  L.push('')

  L.push('## Amostragem estratificada (transparência total)')
  L.push('')
  L.push('| Fiscal | Disponível | Selecionadas | Deixadas de fora | Labels disponíveis | Labels selecionados |')
  L.push('|---|---:|---:|---:|---|---|')
  for (const a of r.sampling.allocation) {
    const fmt = (o) =>
      Object.entries(o)
        .sort()
        .map(([k, v]) => `${k}:${v}`)
        .join(' ')
    L.push(
      `| ${a.fiscalId} | ${a.disponivel} | ${a.selecionadas} | ${a.deixadasDeFora} | ${fmt(a.porLabelDisponivel)} | ${fmt(a.porLabelSelecionado)} |`,
    )
  }
  L.push(
    `| **total** | **${r.dataset.eligibleSamples}** | **${r.pilot.selected}** | **${r.dataset.eligibleSamples - r.pilot.selected}** | | |`,
  )
  L.push('')
  if (r.dataset.excludedNoPdf > 0) {
    L.push(
      `> ${r.dataset.excludedNoPdf} amostra(s) excluída(s) do universo elegível por não ter PDF extraído localmente.`,
    )
    L.push('')
  }
  L.push(
    '> Amostragem estratificada por Fiscal (proporcional, com piso) **e por label dentro do Fiscal**. ' +
      'Estratificar por label é necessário porque ~71% do golden set é FP — sem isso a matriz de ' +
      'confusão teria células TP/borderline vazias. Isso **não** vaza o rótulo para o juiz: a ' +
      'estratificação ocorre na seleção, e o payload enviado ao juiz é higienizado. ' +
      '**Consequência estatística:** a amostra é deliberadamente enriquecida em TP/borderline, ' +
      'então κ e concordância aqui **não** são estimativas da população — são medidas por célula.',
  )
  L.push('')

  L.push('## Resultado global')
  L.push('')
  L.push(`- **N julgado:** ${r.metrics.overall.kappa.n}`)
  L.push(`- **Concordância bruta (p₀):** ${pct(r.metrics.overall.kappa.po)}`)
  L.push(
    `- **κ de Cohen:** ${fmtK(r.metrics.overall.kappa.kappa)} (${kappaInterpretation(r.metrics.overall.kappa.kappa)})`,
  )
  L.push(
    `- **PABAK (κ ajustado por prevalência/viés):** ${fmtK(r.metrics.overall.kappa.pabak)}`,
  )
  L.push(`- **Divergências:** ${r.metrics.overall.disagreements} de ${r.metrics.overall.kappa.n}`)
  L.push('')

  const mg = r.metrics.overall.marginals
  L.push('### Diagnóstico de marginais (por que κ ≪ p₀)')
  L.push('')
  L.push('| Categoria | Baseline | Juiz | Deslocamento |')
  L.push('|---|---:|---:|---:|')
  for (const c of LABELS) {
    L.push(
      `| ${c} | ${mg.baselineCounts[c]} | ${mg.judgeCounts[c]} | ${(mg.prevalenceShift[c] * 100).toFixed(1)} p.p. |`,
    )
  }
  L.push('')
  L.push(`${mg.interpretation}`)
  L.push('')
  L.push(
    'Esta é a descoberta central do gate e precisa ser lida com cuidado: o juiz cego é ' +
      '**sistematicamente mais cético** que o baseline. Com marginais assimétricas, κ é penalizado ' +
      'mesmo quando a concordância bruta é razoável. **Os dados deste gate não permitem decidir quem ' +
      'está certo** — se o baseline super-rotula TP ou se o juiz é excessivamente conservador. ' +
      'Ambos são IA. É exatamente aqui que uma âncora humana deixa de ser desejável e passa a ser ' +
      'indispensável.',
  )
  L.push('')

  L.push('### Matriz de confusão (linha = baseline existente, coluna = juiz cego)')
  L.push('')
  L.push(`| baseline ↓ / juiz → | ${LABELS.join(' | ')} | total |`)
  L.push(`|---|${LABELS.map(() => '---:').join('|')}|---:|`)
  for (const a of LABELS) {
    const row = LABELS.map((b) => r.metrics.overall.confusion[a][b])
    L.push(`| **${a}** | ${row.join(' | ')} | ${row.reduce((x, y) => x + y, 0)} |`)
  }
  const colTot = LABELS.map((b) => LABELS.reduce((s, a) => s + r.metrics.overall.confusion[a][b], 0))
  L.push(`| **total** | ${colTot.join(' | ')} | ${colTot.reduce((x, y) => x + y, 0)} |`)
  L.push('')

  L.push('## κ por Fiscal')
  L.push('')
  L.push('| Fiscal | N | p₀ | κ | PABAK | Interpretação | Divergências |')
  L.push('|---|---:|---:|---:|---:|---|---|')
  for (const [f, m] of Object.entries(r.metrics.byFiscal)) {
    L.push(
      `| ${f} | ${m.kappa.n} | ${pct(m.kappa.po)} | ${fmtK(m.kappa.kappa)} | ${fmtK(m.kappa.pabak)} | ${m.kappa.note ? m.kappa.note : kappaInterpretation(m.kappa.kappa)} | ${m.disagreements} |`,
    )
  }
  L.push('')
  L.push(
    '> **Não superinterprete linhas com N pequeno.** Com N < 10 o intervalo de confiança de κ ' +
      'cobre praticamente todo o intervalo útil; essas linhas servem para dizer *onde olhar*, ' +
      'não para decidir política de rotulagem.',
  )
  L.push('')

  L.push('## Derivabilidade: fato objetivo vs. julgamento')
  L.push('')
  L.push(
    'Classificação feita pelo próprio juiz sobre **como** chegou ao rótulo. É o sinal mais ' +
      'acionável do gate: onde o rótulo sai de aritmética/data/limite legal, automação é defensável; ' +
      'onde sai de juízo subjetivo, a concordância IA-vs-IA é fraca evidência de qualquer coisa.',
  )
  L.push('')
  L.push('| Grupo | N | % da amostra | p₀ | κ | Interpretação |')
  L.push('|---|---:|---:|---:|---:|---|')
  for (const [g, m] of Object.entries(r.metrics.byDerivability)) {
    L.push(
      `| ${g} | ${m.kappa.n} | ${pct(m.kappa.n / r.metrics.overall.kappa.n)} | ${pct(m.kappa.po)} | ${fmtK(m.kappa.kappa)} | ${m.kappa.note ? m.kappa.note : kappaInterpretation(m.kappa.kappa)} |`,
    )
  }
  L.push('')

  L.push('## Grounding legal')
  L.push('')
  L.push(
    `- Citações do juiz resolvidas contra o corpus canônico: **${r.metrics.legal.judgeCitationsVerified}/${r.metrics.legal.judged}**`,
  )
  L.push(
    `- Casos em que o juiz considerou a base legal alegada pelo finding **incorreta**: **${r.metrics.legal.baselineCitationDisputed}**`,
  )
  if (r.metrics.legal.disputedList.length) {
    L.push('')
    L.push('| Amostra | Base alegada | Juiz aponta | Nota |')
    L.push('|---|---|---|---|')
    for (const d of r.metrics.legal.disputedList.slice(0, 20)) {
      L.push(
        `| ${d.id} | ${d.alegada || 'n/a'} | ${d.juiz || 'n/a'} | ${String(d.nota || '').replace(/\|/g, '\\|').slice(0, 160)} |`,
      )
    }
  }
  L.push('')

  L.push(`## Divergências (${r.disagreements.length})`)
  L.push('')
  L.push('Cada linha é um caso onde a re-rotulagem rigorosa discordou do baseline.')
  L.push('')
  for (const d of r.disagreements) {
    L.push(`### ${d.id} — ${d.fiscalId} / ${d.type}`)
    L.push('')
    L.push(`- **baseline:** \`${d.baselineLabel}\` (por \`${d.baselineLabeledBy}\`)`)
    L.push(`- **juiz:** \`${d.judgeLabel}\` (confiança ${d.judgeConfidence ?? 'n/d'}, ${d.derivability})`)
    L.push(`- **citação legal do juiz:** ${d.legalCitation || 'n/a'}`)
    L.push(`- **rationale do juiz:** ${String(d.judgeRationale || '').replace(/\n/g, ' ')}`)
    if (d.pdfQuote) L.push(`- **trecho do diário:** "${String(d.pdfQuote).replace(/\n/g, ' ').slice(0, 400)}"`)
    L.push('')
  }

  L.push('## Leitura honesta do resultado')
  L.push('')
  for (const v of r.verdict.notes) L.push(`- ${v}`)
  L.push('')
  L.push(`**Veredito:** ${r.verdict.summary}`)
  L.push('')
  L.push('---')
  L.push('')
  L.push(
    `Gerado por \`scripts/calibrate-labeler.mjs\` em ${r.generatedAt}. Read-only sobre \`golden-set/samples.json\`.`,
  )
  return L.join('\n')
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  log('── Gate de calibração do rotulador ──')
  log('')
  log('PREMISSA: os rótulos do golden set são de IA (claude-sonnet-4-6 /')
  log('claude-opus-4-7-via-subagent), não humanos. Este gate mede concordância')
  log('IA-vs-IA (confiabilidade + delta do baseline), NÃO acurácia vs verdade.')
  log('')

  const rawSamples = JSON.parse(fs.readFileSync(SAMPLES_PATH, 'utf8'))
  const all = Array.isArray(rawSamples) ? rawSamples : rawSamples.samples
  log(`golden set: ${all.length} amostras`)

  const labeledByDistribution = countBy(all, (s) => s.labeledBy || '(sem labeledBy)')
  const humanLabeled = all.filter((s) => {
    const lb = String(s.labeledBy || '').toLowerCase()
    return lb && !lb.includes('claude') && !lb.includes('gpt') && !lb.includes('subagent')
  })
  log(`labeledBy: ${JSON.stringify(labeledByDistribution)}`)
  log(`amostras com rótulo humano: ${humanLabeled.length}`)

  // universo elegível: tem label válido + PDF extraído localmente
  const eligible = []
  let excludedNoPdf = 0
  let excludedNoLabel = 0
  for (const s of all) {
    if (!LABELS.includes(s.label)) {
      excludedNoLabel++
      continue
    }
    const t = txtPathFromSource(s.evidence?.[0]?.source)
    if (!t || !fs.existsSync(t)) {
      excludedNoPdf++
      continue
    }
    eligible.push(s)
  }
  log(`elegíveis (label válido + PDF local): ${eligible.length}`)
  log(`  excluídas por falta de PDF: ${excludedNoPdf}; por label fora de {TP,FP,borderline}: ${excludedNoLabel}`)
  log('')

  const { selected, allocation, quota } = stratifiedSample(eligible, {
    target: TARGET_N,
    floor: FLOOR_PER_FISCAL,
    seed: SEED,
  })

  log('Alocação estratificada (por Fiscal):')
  for (const a of allocation) {
    log(
      `  ${a.fiscalId.padEnd(20)} disp=${String(a.disponivel).padStart(4)}  sel=${String(a.selecionadas).padStart(3)}  fora=${String(a.deixadasDeFora).padStart(4)}  sel-labels=${JSON.stringify(a.porLabelSelecionado)}`,
    )
  }
  log(`  TOTAL selecionadas: ${selected.length} (alvo ${TARGET_N}), deixadas de fora: ${eligible.length - selected.length}`)
  log('')

  const toJudge = LIMIT ? selected.slice(0, LIMIT) : selected
  if (LIMIT) log(`--limit=${LIMIT}: julgando apenas ${toJudge.length} amostras`)

  if (DRY_RUN) {
    log('--dry-run: encerrando sem chamar o modelo.')
    return
  }

  const bedrock = await loadBedrock()
  const client = new bedrock.BedrockRuntimeClient({ region: AWS_REGION })
  log(`Juiz: ${JUDGE_MODEL} (Bedrock Converse, ${AWS_REGION}), temperature=0, CEGO ao label existente`)
  log('')

  const results = await runPool(
    toJudge,
    (s) => judgeOne(client, { ConverseCommand: bedrock.ConverseCommand }, s),
    CONCURRENCY,
  )

  const ok = results.filter((r) => r && r.ok)
  const failed = results.filter((r) => !r || !r.ok)
  log(`julgadas com sucesso: ${ok.length}; falhas: ${failed.length}`)
  for (const f of failed) log(`  FALHA ${f?.sample?.id}: ${f?.error}`)
  log('')

  // ── métricas ──
  const pairs = ok.map((r) => ({
    a: r.sample.label,
    b: r.judge.judgeLabel,
    id: r.sample.id,
    fiscalId: r.sample.fiscalId,
    derivability: r.judge.derivability,
  }))

  const overallKappa = cohenKappa(pairs)
  const overallConfusion = confusionMatrix(pairs)
  const disagreementsCount = pairs.filter((p) => p.a !== p.b).length
  const marginals = marginalDiagnostics(pairs)

  const byFiscal = {}
  for (const f of [...new Set(pairs.map((p) => p.fiscalId))].sort()) {
    const sub = pairs.filter((p) => p.fiscalId === f)
    byFiscal[f] = {
      kappa: cohenKappa(sub),
      confusion: confusionMatrix(sub),
      disagreements: sub.filter((p) => p.a !== p.b).length,
    }
  }

  const byDerivability = {}
  for (const g of ['fact-derivable', 'judgment']) {
    const sub = pairs.filter((p) => p.derivability === g)
    byDerivability[g] = {
      kappa: cohenKappa(sub),
      confusion: confusionMatrix(sub),
      disagreements: sub.filter((p) => p.a !== p.b).length,
    }
  }
  const unclassified = pairs.filter((p) => !['fact-derivable', 'judgment'].includes(p.derivability))
  if (unclassified.length) {
    byDerivability['(não classificado)'] = {
      kappa: cohenKappa(unclassified),
      confusion: confusionMatrix(unclassified),
      disagreements: unclassified.filter((p) => p.a !== p.b).length,
    }
  }

  const disputedList = ok
    .filter((r) => r.judge.legalCitationCorrect === false)
    .map((r) => ({
      id: r.sample.id,
      alegada: r.sample.legalBasis,
      juiz: r.judge.legalCitation,
      nota: r.judge.legalCitationNote,
    }))

  const legal = {
    judged: ok.length,
    judgeCitationsVerified: ok.filter((r) => r.judgeCitationCheck.verifiedInCorpus).length,
    baselineCitationDisputed: disputedList.length,
    disputedList,
  }

  const disagreements = ok
    .filter((r) => r.sample.label !== r.judge.judgeLabel)
    .map((r) => ({
      id: r.sample.id,
      fiscalId: r.sample.fiscalId,
      type: r.sample.type,
      cityId: r.sample.cityId,
      baselineLabel: r.sample.label,
      baselineLabeledBy: r.sample.labeledBy,
      baselineRationale: r.sample.rationale,
      judgeLabel: r.judge.judgeLabel,
      judgeRationale: r.judge.rationale,
      pdfQuote: r.judge.pdfQuote,
      legalCitation: r.judge.legalCitation,
      derivability: r.judge.derivability,
      judgeConfidence: r.judge.judgeConfidence,
      pdfTxt: r.grounding.pdfTxt,
    }))

  // ── veredito ──
  const notes = []
  notes.push(
    `Nenhuma das ${all.length} amostras tem rótulo humano — logo NÃO há medida de acurácia aqui, ` +
      `apenas de reprodutibilidade entre rotuladores automáticos.`,
  )
  const k = overallKappa.kappa
  notes.push(
    `κ global ${fmtK(k)} (${kappaInterpretation(k)}) sobre N=${overallKappa.n}, com p₀=${pct(overallKappa.po)}. ` +
      `${disagreementsCount} divergência(s) — projetando sobre o golden set, uma re-rotulagem rigorosa ` +
      `mudaria a ordem de ${pct(disagreementsCount / Math.max(1, overallKappa.n))} dos rótulos da amostra estratificada.`,
  )
  notes.push(
    `Deslocamento de prevalência: baseline emitiu ${marginals.baselineCounts.TP} TP / ${marginals.baselineCounts.FP} FP / ${marginals.baselineCounts.borderline} borderline; ` +
      `o juiz cego emitiu ${marginals.judgeCounts.TP} TP / ${marginals.judgeCounts.FP} FP / ${marginals.judgeCounts.borderline} borderline. ` +
      `PABAK=${fmtK(overallKappa.pabak)} vs κ=${fmtK(overallKappa.kappa)} mostra que boa parte do κ baixo vem de marginais assimétricas, não de ruído item a item. ` +
      `O gate NÃO decide quem está certo: os dois avaliadores são IA.`,
  )

  const fd = byDerivability['fact-derivable']
  const jg = byDerivability['judgment']
  if (fd && jg && fd.kappa.n && jg.kappa.n) {
    notes.push(
      `Derivabilidade: ${pct(fd.kappa.n / overallKappa.n)} fact-derivable (p₀=${pct(fd.kappa.po)}, κ=${fmtK(fd.kappa.kappa)}) ` +
        `vs ${pct(jg.kappa.n / overallKappa.n)} judgment (p₀=${pct(jg.kappa.po)}, κ=${fmtK(jg.kappa.kappa)}).`,
    )
  }
  const weak = Object.entries(byFiscal)
    .filter(([, m]) => m.kappa.kappa !== null && m.kappa.kappa < 0.4)
    .map(([f, m]) => `${f} (κ=${fmtK(m.kappa.kappa)}, N=${m.kappa.n})`)
  const degenerate = Object.entries(byFiscal)
    .filter(([, m]) => m.kappa.kappa === null)
    .map(([f, m]) => `${f} (N=${m.kappa.n}, p₀=${pct(m.kappa.po)}, κ indefinido)`)
  if (weak.length) notes.push(`Fiscais com concordância fraca: ${weak.join('; ')}.`)
  if (degenerate.length)
    notes.push(
      `Fiscais com κ indefinido (categoria única / N muito baixo — leia p₀, não κ): ${degenerate.join('; ')}.`,
    )
  notes.push(
    `Todo κ por Fiscal com N < 10 é ruído: intervalo de confiança largo demais para decidir política de rotulagem.`,
  )

  let summary
  if (k === null) {
    summary =
      'κ global indefinido nesta amostra — resultado inconclusivo; aumente N antes de qualquer decisão.'
  } else if (k >= 0.6) {
    summary =
      `Re-rotulagem rigorosa é REPRODUTÍVEL (κ=${fmtK(k)}): dois rotuladores automáticos independentes convergem na maioria dos casos. ` +
      `Isso viabiliza usar re-rotulagem como gate de regressão. NÃO substitui âncora humana: sem ela, nada aqui prova que o rótulo está certo.`
  } else if (k >= 0.4) {
    summary =
      `Re-rotulagem rigorosa é PARCIALMENTE reprodutível (κ=${fmtK(k)}): concordância moderada. ` +
      `Utilizável como sinal de triagem, mas o baseline mudaria de forma relevante sob re-rotulagem — âncora humana é necessária nos Fiscais fracos.`
  } else {
    summary =
      `Re-rotulagem rigorosa NÃO reproduz o baseline (κ=${fmtK(k)}, p₀=${pct(overallKappa.po)}, PABAK=${fmtK(overallKappa.pabak)}). ` +
      `O juiz cego é sistematicamente mais cético — converteu ${overallConfusion.TP.FP} dos ${marginals.baselineCounts.TP} TP do baseline em FP. ` +
      `Isso significa que o baseline atual NÃO é um número de precisão defensável: ou ele super-rotula TP, ou o juiz é conservador demais, ` +
      `e nenhum dado deste gate distingue as duas hipóteses, porque ambos os avaliadores são IA. ` +
      `Ação: ancorar um subconjunto com rotulagem humana antes de publicar qualquer métrica de precisão derivada deste golden set.`
  }

  const runDate = new Date().toISOString().slice(0, 10)
  const report = {
    schemaVersion: 1,
    kind: 'labeler-calibration-gate',
    generatedAt: new Date().toISOString(),
    runDate,
    caveat: {
      headline:
        'Este gate mede concordância entre uma re-rotulagem rigorosa por IA e um rótulo-IA anterior. NÃO mede acurácia contra verdade humana.',
      noHumanGroundTruth: true,
      humanLabeledSamples: humanLabeled.length,
      labeledByDistribution,
      implication:
        'κ alto = processo de rotulagem reprodutível. Não implica rótulo correto: os dois rotuladores podem compartilhar o mesmo viés. Uma âncora humana mínima continua indispensável para converter isto em medida de acurácia.',
    },
    judge: {
      model: JUDGE_MODEL,
      mechanism: 'bedrock-converse',
      region: AWS_REGION,
      temperature: 0,
      blind: true,
      blindnessImplementation:
        'payload do juiz é montado campo a campo em buildJudgeUserMessage(); label, rationale, rootCause, adjustment, labeledBy e evaluatedBy nunca são incluídos',
      groundingPerSample: {
        pdfDigestBudgetChars: PDF_DIGEST_BUDGET,
        legalBudgetChars: LEGAL_BUDGET,
        corpusDir: path.relative(ENGINE_ROOT, CORPUS_DIR).replace(/\\/g, '/'),
      },
    },
    dataset: {
      samplesPath: 'golden-set/samples.json',
      totalSamples: all.length,
      eligibleSamples: eligible.length,
      excludedNoPdf,
      excludedNoLabel,
      labeledByDistribution,
      labelDistribution: countBy(all, (s) => s.label),
      fiscalDistribution: countBy(all, (s) => s.fiscalId),
    },
    pilot: {
      target: TARGET_N,
      floorPerFiscal: FLOOR_PER_FISCAL,
      seed: SEED,
      selected: selected.length,
      judged: ok.length,
      failed: failed.length,
      limitApplied: LIMIT,
      concurrency: CONCURRENCY,
    },
    sampling: { allocation, quota },
    metrics: {
      overall: {
        kappa: overallKappa,
        confusion: overallConfusion,
        disagreements: disagreementsCount,
        marginals,
      },
      byFiscal,
      byDerivability,
      legal,
    },
    disagreements,
    judgements: ok.map((r) => ({
      id: r.sample.id,
      fiscalId: r.sample.fiscalId,
      type: r.sample.type,
      cityId: r.sample.cityId,
      baselineLabel: r.sample.label,
      baselineLabeledBy: r.sample.labeledBy,
      judgeLabel: r.judge.judgeLabel,
      agree: r.sample.label === r.judge.judgeLabel,
      derivability: r.judge.derivability,
      judgeConfidence: r.judge.judgeConfidence,
      judgeRationale: r.judge.rationale,
      pdfQuote: r.judge.pdfQuote,
      legalCitation: r.judge.legalCitation,
      legalCitationCorrect: r.judge.legalCitationCorrect,
      legalCitationNote: r.judge.legalCitationNote,
      judgeCitationCheck: r.judgeCitationCheck,
      grounding: r.grounding,
      usage: r.usage,
    })),
    failures: failed.map((f) => ({ id: f?.sample?.id, error: f?.error })),
    verdict: { summary, notes },
  }

  fs.mkdirSync(REPORTS_DIR, { recursive: true })
  const jsonPath = path.join(REPORTS_DIR, `calibration-${runDate}.json`)
  const mdPath = path.join(REPORTS_DIR, `calibration-${runDate}.md`)
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2) + '\n')
  fs.writeFileSync(mdPath, renderMarkdown(report) + '\n')

  log('── Resultado ──')
  log(`κ global: ${fmtK(overallKappa.kappa)} (${kappaInterpretation(overallKappa.kappa)}), p₀=${pct(overallKappa.po)}, N=${overallKappa.n}`)
  for (const [f, m] of Object.entries(byFiscal)) {
    log(`  ${f.padEnd(20)} N=${String(m.kappa.n).padStart(3)}  p₀=${pct(m.kappa.po).padStart(6)}  κ=${fmtK(m.kappa.kappa)}`)
  }
  log('')
  log(`relatório JSON: ${path.relative(REPO_ROOT, jsonPath)}`)
  log(`relatório MD:   ${path.relative(REPO_ROOT, mdPath)}`)
  log('')
  log(`VEREDITO: ${summary}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
