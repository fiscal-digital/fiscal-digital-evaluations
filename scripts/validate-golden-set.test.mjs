// Testes da logica pura do gate de schema do golden set (issue #12).
// node --test scripts/validate-golden-set.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validar, contagensDeclaradas, contarLabels, LABELS_VALIDOS } from './validate-golden-set.mjs'

const amostra = (over = {}) => ({
  id: 'FINDING#x#1#y#2026-01-01#abc',
  fiscalId: 'fiscal-licitacoes',
  cityId: '4305108',
  type: 'dispensa_irregular',
  riskScore: 65,
  confidence: 0.8,
  label: 'TP',
  ...over,
})

const doc = (over = {}) => ({
  schemaVersion: 1,
  generatedAt: '2026-05-10T00:00:00.000Z',
  description: 'Golden set de teste.',
  samples: [amostra()],
  ...over,
})

test('documento valido nao acusa erro', () => {
  assert.deepEqual(validar(doc()), [])
})

test('raiz: tipos errados sao acusados', () => {
  assert.ok(validar(doc({ schemaVersion: '1' })).some(e => e.includes('schemaVersion')))
  assert.ok(validar(doc({ generatedAt: 'ontem' })).some(e => e.includes('generatedAt')))
  assert.ok(validar(doc({ description: '  ' })).some(e => e.includes('description')))
  assert.ok(validar(doc({ samples: [] })).some(e => e.includes('samples')))
  assert.deepEqual(validar([]), ['raiz: esperado objeto'])
})

test('campo obrigatorio ausente e acusado com a posicao', () => {
  const erros = validar(doc({ samples: [amostra({ cityId: undefined })] }))
  assert.equal(erros.length, 1)
  assert.match(erros[0], /samples\[0\].*cityId/)
})

test('label fora do enum e acusado', () => {
  const erros = validar(doc({ samples: [amostra({ label: 'talvez' })] }))
  assert.ok(erros.some(e => e.includes('talvez')))
  assert.deepEqual([...LABELS_VALIDOS].sort(), ['FP', 'TP', 'borderline'])
})

test('faixas de riskScore e confidence', () => {
  assert.ok(validar(doc({ samples: [amostra({ riskScore: 101 })] })).some(e => e.includes('0..100')))
  assert.ok(validar(doc({ samples: [amostra({ riskScore: -1 })] })).some(e => e.includes('0..100')))
  assert.ok(validar(doc({ samples: [amostra({ confidence: 1.5 })] })).some(e => e.includes('0..1')))
  assert.deepEqual(validar(doc({ samples: [amostra({ riskScore: 0, confidence: 0 })] })), [])
  assert.deepEqual(validar(doc({ samples: [amostra({ riskScore: 100, confidence: 1 })] })), [])
})

test('id duplicado e acusado', () => {
  const erros = validar(doc({ samples: [amostra(), amostra()] }))
  assert.ok(erros.some(e => e.includes('id duplicado')))
})

test('amostra sintetica nao pode entrar no set real', () => {
  assert.ok(validar(doc({ samples: [amostra({ source: 'synthetic' })] })).some(e => e.includes('sintetica')))
  assert.ok(validar(doc({ samples: [amostra({ synthetic: true })] })).some(e => e.includes('sintetica')))
})

// Regressao do PR #8: a description afirmava um total que nao batia com o
// conteudo e ninguem percebeu, porque nada comparava os dois.
test('contagensDeclaradas extrai total e distribuicao', () => {
  const d = '1695 amostras reais rotuladas (1202 FP / 348 TP / 145 borderline), Ciclos 1-4.1'
  assert.deepEqual(contagensDeclaradas(d), { total: 1695, FP: 1202, TP: 348, borderline: 145 })
})

test('contagensDeclaradas retorna null quando a descricao nao segue o formato', () => {
  assert.equal(contagensDeclaradas('Golden set qualquer.'), null)
  assert.equal(contagensDeclaradas(undefined), null)
})

test('divergencia entre description e conteudo e acusada', () => {
  const d = doc({
    description: '3 amostras reais rotuladas (1 FP / 2 TP / 0 borderline)',
    samples: [amostra({ id: 'a' }), amostra({ id: 'b' })],
  })
  const erros = validar(d)
  assert.ok(erros.some(e => e.includes('declara 3 amostras')))
  assert.ok(erros.some(e => e.includes('declara 1 FP')))
})

test('description sem contagens nao gera erro', () => {
  assert.deepEqual(validar(doc({ description: 'Sem numeros aqui.' })), [])
})

test('contarLabels soma por rotulo e ignora desconhecidos', () => {
  const s = [amostra({ label: 'TP' }), amostra({ label: 'FP' }), amostra({ label: 'zzz' })]
  assert.deepEqual(contarLabels(s), { TP: 1, FP: 1, borderline: 0 })
})
