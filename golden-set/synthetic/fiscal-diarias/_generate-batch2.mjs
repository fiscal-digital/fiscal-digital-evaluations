// Gerador one-shot do batch2 (189 amostras) para FiscalDiárias.
// Script local; não é versionado em produção. Roda uma vez para emitir o JSON
// e não é referenciado por testes — testes consomem só `synthetic-samples-batch2.json`.
//
// Distribuição:
//   35 TP textbook (12 valor>R$800 + 10 FDS + 8 feriado + 5 sem agenda)
//   120 FP réplica (25 hospedagem + 20 INPC locação + 20 decreto suplementar
//                   + 20 advérbio + 15 topônimo + 10 Divisão Diárias + 10 multa/jornada)
//    34 FP edge case (10 internacional + 10 feriado c/ justificativa
//                     + 7 R$800-850 c/ agenda + 7 calamidade)
//
// Base legal: Lei 8.112/90 Art. 58. Cidades reais (CLAUDE.md / IBGE).

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ----------------------------------------------------------------------------
// POOLS

// IBGE id, nome, UF — 50 cidades reais
const CITIES = [
  ['4305108', 'Caxias do Sul', 'RS'],
  ['4314902', 'Porto Alegre', 'RS'],
  ['3550308', 'São Paulo', 'SP'],
  ['3509502', 'Campinas', 'SP'],
  ['4205407', 'Florianópolis', 'SC'],
  ['4106902', 'Curitiba', 'PR'],
  ['3304557', 'Rio de Janeiro', 'RJ'],
  ['5300108', 'Brasília', 'DF'],
  ['2304400', 'Fortaleza', 'CE'],
  ['2927408', 'Salvador', 'BA'],
  ['3106200', 'Belo Horizonte', 'MG'],
  ['1302603', 'Manaus', 'AM'],
  ['2611606', 'Recife', 'PE'],
  ['5208707', 'Goiânia', 'GO'],
  ['1501402', 'Belém', 'PA'],
  ['3518800', 'Guarulhos', 'SP'],
  ['2111300', 'São Luís', 'MA'],
  ['2704302', 'Maceió', 'AL'],
  ['5002704', 'Campo Grande', 'MS'],
  ['3304904', 'São Gonçalo', 'RJ'],
  ['2211001', 'Teresina', 'PI'],
  ['2507507', 'João Pessoa', 'PB'],
  ['3548708', 'São Bernardo do Campo', 'SP'],
  ['3301702', 'Duque de Caxias', 'RJ'],
  ['3303500', 'Nova Iguaçu', 'RJ'],
  ['2408102', 'Natal', 'RN'],
  ['3547809', 'Santo André', 'SP'],
  ['3534401', 'Osasco', 'SP'],
  ['3552205', 'Sorocaba', 'SP'],
  ['3170206', 'Uberlândia', 'MG'],
  ['3543402', 'Ribeirão Preto', 'SP'],
  ['3549904', 'São José dos Campos', 'SP'],
  ['5103403', 'Cuiabá', 'MT'],
  ['2607901', 'Jaboatão dos Guararapes', 'PE'],
  ['3118601', 'Contagem', 'MG'],
  ['4209102', 'Joinville', 'SC'],
  ['2910800', 'Feira de Santana', 'BA'],
  ['2800308', 'Aracaju', 'SE'],
  ['4113700', 'Londrina', 'PR'],
  ['3136702', 'Juiz de Fora', 'MG'],
  ['5201405', 'Aparecida de Goiânia', 'GO'],
  ['3205002', 'Serra', 'ES'],
  ['3301009', 'Campos dos Goytacazes', 'RJ'],
  ['3300456', 'Belford Roxo', 'RJ'],
  ['3303302', 'Niterói', 'RJ'],
  ['3549805', 'São José do Rio Preto', 'SP'],
  ['1500800', 'Ananindeua', 'PA'],
  ['3205200', 'Vila Velha', 'ES'],
  ['1100205', 'Porto Velho', 'RO'],
  ['3530607', 'Mogi das Cruzes', 'SP'],
]

// Servidores sintéticos — nomes comuns + cargos típicos no executivo municipal
const SERVIDORES = [
  ['ANTONIO CARLOS PEREIRA DA SILVA', 'Auditor Fiscal de Tributos Municipais', '14523-1'],
  ['MARIA APARECIDA DOS SANTOS', 'Procuradora Municipal', '20184-2'],
  ['JOSÉ ROBERTO DE OLIVEIRA', 'Engenheiro Civil', '18762-3'],
  ['ANA LÚCIA RODRIGUES MARTINS', 'Fiscal de Obras', '15904-1'],
  ['CARLOS EDUARDO FERREIRA LIMA', 'Médico Plantonista', '22561-4'],
  ['FERNANDA CRISTINA ALVES SOUZA', 'Assistente Social', '17320-2'],
  ['RICARDO HENRIQUE MOREIRA', 'Diretor de Departamento', '11098-1'],
  ['JULIANA DE ALMEIDA COSTA', 'Coordenadora de Programa', '19475-3'],
  ['PAULO SÉRGIO CAVALCANTI', 'Auditor de Controle Interno', '13682-1'],
  ['MARCIA REGINA TEIXEIRA', 'Bióloga - Vigilância Sanitária', '21034-2'],
  ['EDUARDO LUIZ NASCIMENTO', 'Arquiteto Urbanista', '16258-1'],
  ['CLAUDIA HELENA RIBEIRO', 'Procuradora Adjunta', '20617-1'],
  ['LUIZ ANTONIO BARBOSA', 'Fiscal Sanitário', '14893-3'],
  ['BEATRIZ AMARAL FONSECA', 'Gerente de Planejamento', '18445-1'],
  ['ROBERTO MIGUEL DA CONCEIÇÃO', 'Médico Veterinário', '12760-2'],
  ['SANDRA MARIA FIGUEIREDO', 'Assessora Jurídica', '19982-1'],
  ['MARCOS VINÍCIUS PAES', 'Secretário Adjunto', '10254-1'],
  ['PATRÍCIA HELENA MENDES', 'Coordenadora de Convênios', '17651-2'],
  ['DANIEL FELIPE GONÇALVES', 'Engenheiro Eletricista', '21209-3'],
  ['VANESSA APARECIDA RAMOS', 'Pedagoga', '15376-1'],
]

// Secretarias com nomes típicos
const SECRETARIAS = [
  'Secretaria Municipal de Administração',
  'Secretaria Municipal de Saúde',
  'Secretaria Municipal de Educação',
  'Secretaria Municipal de Obras',
  'Secretaria Municipal de Fazenda',
  'Procuradoria Geral do Município',
  'Secretaria Municipal de Assistência Social',
  'Controladoria Geral do Município',
  'Secretaria Municipal de Cultura',
  'Secretaria Municipal de Meio Ambiente',
  'Secretaria Municipal de Planejamento',
  'Secretaria Municipal de Esportes',
]

// Destinos para missões (capitais e cidades-pólo)
const DESTINOS = [
  ['Brasília', 'DF'],
  ['São Paulo', 'SP'],
  ['Rio de Janeiro', 'RJ'],
  ['Belo Horizonte', 'MG'],
  ['Porto Alegre', 'RS'],
  ['Curitiba', 'PR'],
  ['Recife', 'PE'],
  ['Salvador', 'BA'],
  ['Fortaleza', 'CE'],
  ['Florianópolis', 'SC'],
  ['Vitória', 'ES'],
  ['Goiânia', 'GO'],
  ['Manaus', 'AM'],
  ['Belém', 'PA'],
  ['Campo Grande', 'MS'],
  ['Cuiabá', 'MT'],
]

// Missões oficiais típicas
const MISSOES = [
  'participar de reunião com técnicos do Ministério da Saúde',
  'participar do XVII Congresso Brasileiro de Gestores Públicos',
  'representar o Município em audiência na Confederação Nacional dos Municípios',
  'participar de capacitação técnica promovida pela Escola Nacional de Administração Pública - ENAP',
  'participar de reunião de alinhamento sobre execução de convênio federal',
  'participar do Seminário Nacional de Controle Interno',
  'representar o Município em assembleia da Frente Nacional de Prefeitos',
  'realizar tratativas com o Ministério da Educação acerca de programa federal',
  'participar do Encontro Nacional de Procuradores Municipais',
  'acompanhar a tramitação de processos administrativos junto ao Tribunal de Contas',
  'participar de oficina técnica do Ministério das Cidades',
  'representar o Município em reunião do Consórcio Intermunicipal de Saúde',
]

// Feriados nacionais (2024-2026 — datas conhecidas via BrasilAPI)
const FERIADOS = [
  ['2024-01-01', 'Confraternização Universal'],
  ['2024-02-12', 'Carnaval'],
  ['2024-03-29', 'Sexta-feira Santa'],
  ['2024-04-21', 'Tiradentes'],
  ['2024-05-01', 'Dia do Trabalho'],
  ['2024-09-07', 'Independência do Brasil'],
  ['2024-10-12', 'Nossa Senhora Aparecida'],
  ['2024-11-02', 'Finados'],
  ['2024-11-15', 'Proclamação da República'],
  ['2024-12-25', 'Natal'],
  ['2025-04-18', 'Sexta-feira Santa'],
  ['2025-05-01', 'Dia do Trabalho'],
  ['2025-09-07', 'Independência do Brasil'],
  ['2025-11-15', 'Proclamação da República'],
  ['2026-04-03', 'Sexta-feira Santa'],
  ['2026-09-07', 'Independência do Brasil'],
]

// Datas que caem em sábado/domingo (selecionadas)
const FDS_DATAS = [
  ['2024-06-15', 'sábado'],
  ['2024-06-16', 'domingo'],
  ['2024-08-10', 'sábado'],
  ['2024-08-11', 'domingo'],
  ['2024-09-21', 'sábado'],
  ['2024-09-22', 'domingo'],
  ['2024-10-26', 'sábado'],
  ['2024-10-27', 'domingo'],
  ['2025-03-08', 'sábado'],
  ['2025-03-09', 'domingo'],
  ['2025-05-17', 'sábado'],
  ['2025-05-18', 'domingo'],
  ['2025-07-12', 'sábado'],
  ['2025-07-13', 'domingo'],
  ['2025-09-13', 'sábado'],
  ['2025-09-14', 'domingo'],
  ['2026-02-07', 'sábado'],
  ['2026-02-08', 'domingo'],
]

// CNPJ helper
const CNPJ_SUFFIXES = ['10', '15', '22', '33', '44', '55', '66', '77', '81', '90', '04', '12', '28', '37', '49', '52', '63', '71', '85', '99']
const cnpj = (i) => `12.345.678/0001-${CNPJ_SUFFIXES[i % CNPJ_SUFFIXES.length]}`

// Hotéis para FP de hospedagem
const HOTEIS = [
  'HOTEL EXECUTIVO LTDA',
  'POUSADA RECANTO DAS MONTANHAS LTDA-ME',
  'GRAND HOTEL CENTRO LTDA',
  'HOTEL PRESIDENTE EIRELI',
  'BLUE TREE HOTÉIS E EMPREENDIMENTOS LTDA',
  'IBIS HOTELARIA E SERVIÇOS LTDA',
  'HOTEL NACIONAL S/A',
  'HOTEL PARAÍSO TROPICAL LTDA',
  'POUSADA SOL E MAR LTDA-ME',
  'HOTEL CONFORTO E NEGÓCIOS LTDA',
]

// Empresas locação veículo
const LOCADORAS = [
  'LOCALIZA RENT A CAR S/A',
  'MOVIDA LOCAÇÃO DE VEÍCULOS S/A',
  'UNIDAS LOCADORA S/A',
  'LOCAR VEÍCULOS LTDA',
  'AUTO LOCAÇÃO REGIONAL LTDA-ME',
  'TRANSPORTE E LOCAÇÃO MUNICIPAL LTDA',
]

// ----------------------------------------------------------------------------
// HELPERS

function pick(arr, i) { return arr[i % arr.length] }

function fmtBRL(n) {
  const inteiro = Math.floor(n)
  const cent = String(Math.round((n - inteiro) * 100)).padStart(2, '0')
  const s = inteiro.toString()
  const partes = []
  for (let i = s.length; i > 0; i -= 3) partes.unshift(s.slice(Math.max(0, i - 3), i))
  return `R$ ${partes.join('.')},${cent}`
}

function dataBR(yyyy, mm, dd) {
  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
  const ddS = String(dd).padStart(2, '0')
  const mmS = String(mm).padStart(2, '0')
  return { iso: `${yyyy}-${mmS}-${ddS}`, br: `${ddS}/${mmS}/${yyyy}`, ext: `${ddS} de ${meses[mm - 1]} de ${yyyy}` }
}

function syntheticDate(seed) {
  const ano = 2024 + (seed % 3)
  const mes = 1 + ((seed * 13) % 12)
  const dia = 1 + ((seed * 7) % 28)
  return dataBR(ano, mes, dia)
}

function isoToBR(iso) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function isoToExt(iso) {
  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
  const [y, m, d] = iso.split('-')
  return `${d} de ${meses[parseInt(m, 10) - 1]} de ${y}`
}

function valorDiaria(seed, faixa) {
  // 'alto' (R$850-3500) | 'limite' (R$800-850) | 'normal' (R$300-700) | 'internacional' (US$ equiv R$2000-4500)
  const r = (seed * 9301 + 49297) % 233280
  const norm = r / 233280
  let valor
  switch (faixa) {
    case 'alto':           valor = 850 + Math.floor(norm * 2650); break
    case 'limite':         valor = 800 + Math.floor(norm * 50); break
    case 'normal':         valor = 300 + Math.floor(norm * 400); break
    case 'internacional':  valor = 2000 + Math.floor(norm * 2500); break
    default:               valor = 500
  }
  return Math.round(valor / 10) * 10
}

// ----------------------------------------------------------------------------
// GERADORES POR CATEGORIA

const samples = []
let counterTP = 0
let counterFP = 0
let counterEdge = 0
let synSeed = 100

// ============================================================================
// 1) 35 TP textbook
// ============================================================================

// 1a) 12 TP — valor > R$ 800/dia
function genTPValorAlto(n) {
  for (let i = 0; i < n; i++) {
    const seed = synSeed++
    const [cityId, cityName] = pick(CITIES, seed)
    const sec = pick(SECRETARIAS, seed + 1)
    const [nome, cargo, matricula] = pick(SERVIDORES, seed + 2)
    const [destCidade, destUF] = pick(DESTINOS, seed + 3)
    const missao = pick(MISSOES, seed + 4)
    const data = syntheticDate(seed)
    const numDias = pick([2, 3, 4, 5], seed + 5)
    const valorDia = valorDiaria(seed, 'alto')
    const total = valorDia * numDias
    const port = `${100 + (seed % 900)}/${data.iso.slice(0, 4)}`
    const cpfFinal = String(seed % 100).padStart(2, '0')

    counterTP++
    const id = `SYN-DIA-TP-${String(counterTP).padStart(3, '0')}`

    const excerpt = `PORTARIA Nº ${port}\n` +
      `O Secretário Municipal, no uso de suas atribuições legais, RESOLVE:\n` +
      `Art. 1º Conceder ao(à) servidor(a) ${nome}, ${cargo}, matrícula nº ${matricula}, CPF ***.***.***-${cpfFinal}, lotado(a) na ${sec}, o pagamento de ${numDias} (${numDias === 2 ? 'duas' : numDias === 3 ? 'três' : numDias === 4 ? 'quatro' : 'cinco'}) diárias no valor unitário de ${fmtBRL(valorDia)}, totalizando ${fmtBRL(total)}, para fins de deslocamento à cidade de ${destCidade}/${destUF} no período de ${data.br} a ${isoToBR(addDays(data.iso, numDias - 1))}.\n` +
      `Art. 2º A finalidade do deslocamento consiste em ${missao}.\n` +
      `Art. 3º Esta Portaria entra em vigor na data de sua publicação.\n` +
      `${cityName}, ${data.ext}.`

    const fullPageContext = `DIÁRIO OFICIAL DO MUNICÍPIO DE ${cityName.toUpperCase()} - ATOS DO PODER EXECUTIVO - CONCESSÃO DE DIÁRIAS. [excerpt]. Publicado por força do Art. 37 da Constituição Federal.`

    samples.push({
      id,
      fiscalId: 'fiscal-diarias',
      category: 'tp_textbook',
      type: 'diaria_irregular',
      expectedOutcome: 'TP',
      expectedRiskScore: '>= 70',
      expectedConfidence: '>= 0.75',
      source: 'synthetic',
      syntheticGazette: { cityId, cityName, date: data.iso, excerpt, fullPageContext },
      rationale: `Pagamento de diária a servidor identificado (${nome}, mat. ${matricula}, ${cargo}). Valor unitário ${fmtBRL(valorDia)} excede o limite de referência de R$ 800,00/dia para deslocamento nacional (Lei 8.112/90 Art. 58 e parametrização interna do Fiscal). Total ${fmtBRL(total)} em ${numDias} dias. Sem indicação de excepcionalidade que justifique valor superior ao teto.`,
      shouldTriggerAfterPatch: true,
    })
  }
}

// 1b) 10 TP — sábado/domingo sem justificativa
function genTPFDS(n) {
  for (let i = 0; i < n; i++) {
    const seed = synSeed++
    const [cityId, cityName] = pick(CITIES, seed)
    const sec = pick(SECRETARIAS, seed + 1)
    const [nome, cargo, matricula] = pick(SERVIDORES, seed + 2)
    const [destCidade, destUF] = pick(DESTINOS, seed + 3)
    const missao = pick(MISSOES, seed + 4)
    const [fdsIso, fdsLabel] = pick(FDS_DATAS, seed + 5)
    const valorDia = valorDiaria(seed, 'normal')
    const total = valorDia
    const port = `${100 + (seed % 900)}/${fdsIso.slice(0, 4)}`
    const cpfFinal = String(seed % 100).padStart(2, '0')
    const dataPubliBR = isoToBR(fdsIso)
    const dataPubliExt = isoToExt(fdsIso)

    counterTP++
    const id = `SYN-DIA-TP-${String(counterTP).padStart(3, '0')}`

    const excerpt = `PORTARIA Nº ${port}\n` +
      `O Secretário Municipal RESOLVE conceder ao(à) servidor(a) ${nome}, ${cargo}, matrícula nº ${matricula}, CPF ***.***.***-${cpfFinal}, lotado(a) na ${sec}, o pagamento de 01 (uma) diária no valor de ${fmtBRL(valorDia)}, referente a deslocamento à ${destCidade}/${destUF} em ${dataPubliBR} (${fdsLabel}).\n` +
      `Finalidade: ${missao}.\n` +
      `${cityName}, ${dataPubliExt}.`

    const fullPageContext = `DIÁRIO OFICIAL DO MUNICÍPIO DE ${cityName.toUpperCase()} - PORTARIAS DE DIÁRIAS. [excerpt].`

    samples.push({
      id,
      fiscalId: 'fiscal-diarias',
      category: 'tp_textbook',
      type: 'diaria_irregular',
      expectedOutcome: 'TP',
      expectedRiskScore: '>= 70',
      expectedConfidence: '>= 0.70',
      source: 'synthetic',
      syntheticGazette: { cityId, cityName, date: fdsIso, excerpt, fullPageContext },
      rationale: `Diária paga para deslocamento em ${fdsLabel} (${dataPubliBR}). Portaria não traz nenhuma justificativa para a excepcionalidade do trabalho fora do dia útil. Lei 8.112/90 Art. 58 admite diária para serviço eventual fora da sede, mas pagamento em FDS sem motivação expressa configura indício de irregularidade fiscalizável.`,
      shouldTriggerAfterPatch: true,
    })
  }
}

// 1c) 8 TP — feriado sem justificativa
function genTPFeriado(n) {
  for (let i = 0; i < n; i++) {
    const seed = synSeed++
    const [cityId, cityName] = pick(CITIES, seed)
    const sec = pick(SECRETARIAS, seed + 1)
    const [nome, cargo, matricula] = pick(SERVIDORES, seed + 2)
    const [destCidade, destUF] = pick(DESTINOS, seed + 3)
    const missao = pick(MISSOES, seed + 4)
    const [feriadoIso, feriadoNome] = pick(FERIADOS, seed + 5)
    const valorDia = valorDiaria(seed, 'normal')
    const port = `${100 + (seed % 900)}/${feriadoIso.slice(0, 4)}`
    const cpfFinal = String(seed % 100).padStart(2, '0')
    const dataPubliBR = isoToBR(feriadoIso)
    const dataPubliExt = isoToExt(feriadoIso)

    counterTP++
    const id = `SYN-DIA-TP-${String(counterTP).padStart(3, '0')}`

    const excerpt = `PORTARIA Nº ${port}\n` +
      `Concedo ao(à) servidor(a) ${nome}, ${cargo}, matrícula nº ${matricula}, CPF ***.***.***-${cpfFinal}, lotado(a) na ${sec}, 01 (uma) diária no valor de ${fmtBRL(valorDia)} para deslocamento à ${destCidade}/${destUF} no dia ${dataPubliBR}.\n` +
      `Finalidade: ${missao}.\n` +
      `${cityName}, ${dataPubliExt}.`

    const fullPageContext = `DIÁRIO OFICIAL DO MUNICÍPIO DE ${cityName.toUpperCase()} - DIÁRIAS. [excerpt].`

    samples.push({
      id,
      fiscalId: 'fiscal-diarias',
      category: 'tp_textbook',
      type: 'diaria_irregular',
      expectedOutcome: 'TP',
      expectedRiskScore: '>= 70',
      expectedConfidence: '>= 0.70',
      source: 'synthetic',
      syntheticGazette: { cityId, cityName, date: feriadoIso, excerpt, fullPageContext },
      rationale: `Diária paga para deslocamento em feriado nacional (${feriadoNome}, ${dataPubliBR}). Portaria silente quanto à excepcionalidade. Cruzar contra BrasilAPI feriados com cache em memória; se não houver justificativa textual, gerar finding.`,
      shouldTriggerAfterPatch: true,
    })
  }
}

// 1d) 5 TP — sem agenda formal
function genTPSemAgenda(n) {
  for (let i = 0; i < n; i++) {
    const seed = synSeed++
    const [cityId, cityName] = pick(CITIES, seed)
    const sec = pick(SECRETARIAS, seed + 1)
    const [nome, cargo, matricula] = pick(SERVIDORES, seed + 2)
    const [destCidade, destUF] = pick(DESTINOS, seed + 3)
    const data = syntheticDate(seed)
    const numDias = pick([2, 3, 4], seed + 4)
    const valorDia = valorDiaria(seed, 'normal')
    const total = valorDia * numDias
    const port = `${100 + (seed % 900)}/${data.iso.slice(0, 4)}`
    const cpfFinal = String(seed % 100).padStart(2, '0')

    counterTP++
    const id = `SYN-DIA-TP-${String(counterTP).padStart(3, '0')}`

    const excerpt = `PORTARIA Nº ${port}\n` +
      `Concedo ao servidor ${nome}, ${cargo}, matrícula nº ${matricula}, CPF ***.***.***-${cpfFinal}, lotado(a) na ${sec}, ${numDias} diárias no valor unitário de ${fmtBRL(valorDia)}, totalizando ${fmtBRL(total)}, para deslocamento a ${destCidade}/${destUF} de ${data.br} a ${isoToBR(addDays(data.iso, numDias - 1))}.\n` +
      `Finalidade: tratar de assuntos de interesse da Administração.\n` +
      `${cityName}, ${data.ext}.`

    const fullPageContext = `DIÁRIO OFICIAL DO MUNICÍPIO DE ${cityName.toUpperCase()} - DIÁRIAS. [excerpt].`

    samples.push({
      id,
      fiscalId: 'fiscal-diarias',
      category: 'tp_textbook',
      type: 'diaria_irregular',
      expectedOutcome: 'TP',
      expectedRiskScore: '>= 65',
      expectedConfidence: '>= 0.70',
      source: 'synthetic',
      syntheticGazette: { cityId, cityName, date: data.iso, excerpt, fullPageContext },
      rationale: `Diária concedida com finalidade genérica ("assuntos de interesse da Administração"), sem agenda formal — sem identificação de evento, órgão a ser visitado ou autoridade a ser tratada. Lei 8.112/90 Art. 58 exige indicação clara da missão. Pagamento sem agenda formalizada é indício de irregularidade.`,
      shouldTriggerAfterPatch: true,
    })
  }
}

function addDays(iso, days) {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

// ============================================================================
// 2) 120 FP réplica
// ============================================================================

// 2a) 25 FP — Ata RP de hospedagem (DIÁRIA EM HOTEL/APARTAMENTO)
function genFPHospedagem(n) {
  for (let i = 0; i < n; i++) {
    const seed = synSeed++
    const [cityId, cityName] = pick(CITIES, seed)
    const sec = pick(SECRETARIAS, seed + 1)
    const hotel = pick(HOTEIS, seed + 2)
    const c = cnpj(seed + 3)
    const data = syntheticDate(seed)
    const ano = data.iso.slice(0, 4)
    const nro = `${String(1 + (seed % 200)).padStart(3, '0')}/${ano}`
    const valorDiaria = pick([180, 220, 280, 350, 420, 480, 550], seed + 4)
    const valorEstim = valorDiaria * 360
    const ctxTipos = [
      'apartamento single com café da manhã',
      'apartamento duplo padrão executivo',
      'apartamento standard com café da manhã',
      'suíte executiva com cama de casal',
    ]
    const ctxTipo = pick(ctxTipos, seed + 5)

    counterFP++
    const id = `SYN-DIA-FP-${String(counterFP).padStart(3, '0')}`

    const excerpt = `EXTRATO DA ATA DE REGISTRO DE PREÇOS Nº ${nro}\n` +
      `ÓRGÃO GERENCIADOR: ${sec}.\n` +
      `OBJETO: registro de preços para futura e eventual contratação de serviços de hospedagem em estabelecimento hoteleiro, na modalidade DIÁRIA EM APARTAMENTO HOTELEIRO (${ctxTipo}), para atender necessidades dos servidores municipais em deslocamento.\n` +
      `FORNECEDOR: ${hotel}, CNPJ ${c}.\n` +
      `VALOR UNITÁRIO DA DIÁRIA: ${fmtBRL(valorDiaria)}.\n` +
      `VALOR ESTIMADO TOTAL: ${fmtBRL(valorEstim)}.\n` +
      `MODALIDADE: PREGÃO ELETRÔNICO Nº ${String(seed % 200).padStart(3, '0')}/${ano}.\n` +
      `VIGÊNCIA: 12 meses.\n` +
      `${cityName}, ${data.ext}.`

    const fullPageContext = `DIÁRIO OFICIAL DO MUNICÍPIO DE ${cityName.toUpperCase()} - EXTRATOS DE ATAS DE REGISTRO DE PREÇOS. [excerpt].`

    samples.push({
      id,
      fiscalId: 'fiscal-diarias',
      category: 'fp_replica',
      fpPattern: 'ata_rp_hospedagem',
      type: 'diaria_irregular',
      expectedOutcome: 'no_finding',
      source: 'synthetic',
      syntheticGazette: { cityId, cityName, date: data.iso, excerpt, fullPageContext },
      rationale: `Ata de Registro de Preços para hospedagem hoteleira. "DIÁRIA" aqui refere-se a unidade de medida comercial do hotel (diária de apartamento), NÃO a diária de servidor da Lei 8.112/90 Art. 58. Contraparte é PJ hoteleira (CNPJ), não servidor (sem matrícula/CPF de pessoa física).`,
      shouldTriggerAfterPatch: false,
      filterRule: `ADR-DIA-001 — Excluir excerpts em que "DIÁRIA(S)" co-ocorra com (HOTEL|HOTELARIA|APARTAMENTO|HOSPEDAGEM|POUSADA|SUÍTE) E exista CNPJ de PJ E NÃO exista padrão "matrícula nº \\d+" — claramente é Ata RP de hospedagem.`,
    })
  }
}

// 2b) 20 FP — Aditivo INPC locação veículo (cláusula "diária")
function genFPInpcLocacao(n) {
  for (let i = 0; i < n; i++) {
    const seed = synSeed++
    const [cityId, cityName] = pick(CITIES, seed)
    const sec = pick(SECRETARIAS, seed + 1)
    const locadora = pick(LOCADORAS, seed + 2)
    const c = cnpj(seed + 3)
    const data = syntheticDate(seed)
    const ano = data.iso.slice(0, 4)
    const nro = `${String(seed % 200).padStart(3, '0')}/${ano - 1}`
    const valorMens = pick([18000, 24000, 32000, 45000, 58000, 72000], seed + 4)
    const inpc = (3.5 + (seed % 50) / 10).toFixed(2)
    const reaj = Math.round(valorMens * (1 + parseFloat(inpc) / 100))

    counterFP++
    const id = `SYN-DIA-FP-${String(counterFP).padStart(3, '0')}`

    const excerpt = `EXTRATO DO 1º TERMO ADITIVO AO CONTRATO Nº ${nro}\n` +
      `CONTRATANTE: MUNICÍPIO DE ${cityName.toUpperCase()}, por intermédio da ${sec}.\n` +
      `CONTRATADA: ${locadora}, CNPJ ${c}.\n` +
      `OBJETO: locação de veículos automotores para uso institucional, em conformidade com o Termo de Referência. Mantém-se a cláusula contratual de utilização DIÁRIA da frota disponibilizada, observada a quilometragem livre prevista no edital.\n` +
      `FINALIDADE: reajuste anual pelo INPC/IBGE acumulado de 12 meses (${inpc}%).\n` +
      `VALOR MENSAL ATUALIZADO: de ${fmtBRL(valorMens)} para ${fmtBRL(reaj)}.\n` +
      `FUNDAMENTO LEGAL: Art. 124 da Lei 14.133/2021 e cláusula de reajuste pactuada.\n` +
      `${cityName}, ${data.ext}.`

    const fullPageContext = `DIÁRIO OFICIAL DO MUNICÍPIO DE ${cityName.toUpperCase()} - EXTRATOS DE TERMOS ADITIVOS. [excerpt].`

    samples.push({
      id,
      fiscalId: 'fiscal-diarias',
      category: 'fp_replica',
      fpPattern: 'aditivo_inpc_locacao_veiculo',
      type: 'diaria_irregular',
      expectedOutcome: 'no_finding',
      source: 'synthetic',
      syntheticGazette: { cityId, cityName, date: data.iso, excerpt, fullPageContext },
      rationale: `Termo aditivo de reajuste INPC em contrato de locação de veículos. Termo "DIÁRIA" aparece como qualificador da utilização dos veículos (uso diário da frota), não como pagamento a servidor. Padrão recorrente no golden set real.`,
      shouldTriggerAfterPatch: false,
      filterRule: `ADR-DIA-002 — Excluir excerpts em que "DIÁRIA" co-ocorra com (LOCAÇÃO|LOCADORA|FROTA|VEÍCULO|AUTOMOTOR|REAJUSTE|INPC|IPCA|IGPM) e contraparte seja PJ.`,
    })
  }
}

// 2c) 20 FP — Decreto suplementar dotação 3.3.90.14
function genFPDecretoSupl(n) {
  for (let i = 0; i < n; i++) {
    const seed = synSeed++
    const [cityId, cityName] = pick(CITIES, seed)
    const sec = pick(SECRETARIAS, seed + 1)
    const data = syntheticDate(seed)
    const ano = data.iso.slice(0, 4)
    const nro = `${String(1000 + (seed % 4000))}`
    const valor = pick([85000, 120000, 180000, 250000, 380000, 450000, 620000], seed + 2)

    counterFP++
    const id = `SYN-DIA-FP-${String(counterFP).padStart(3, '0')}`

    const excerpt = `DECRETO Nº ${nro}, DE ${data.br}\n` +
      `Abre Crédito Adicional Suplementar e dá outras providências.\n` +
      `O PREFEITO MUNICIPAL DE ${cityName.toUpperCase()}, no uso das atribuições que lhe confere a Lei Orgânica e com fundamento na Lei nº 4.320/64 e na Lei Orçamentária Anual nº ${String(8000 + (seed % 500))}/${ano - 1}, DECRETA:\n` +
      `Art. 1º Fica aberto crédito adicional suplementar no valor de ${fmtBRL(valor)} à dotação da ${sec}, na natureza de despesa 3.3.90.14 - DIÁRIAS - PESSOAL CIVIL, fonte de recurso 1500 - Recursos Ordinários.\n` +
      `Art. 2º Os recursos para abertura do presente crédito decorrem de superávit financeiro apurado no balanço patrimonial do exercício anterior.\n` +
      `${cityName}, ${data.ext}.`

    const fullPageContext = `DIÁRIO OFICIAL DO MUNICÍPIO DE ${cityName.toUpperCase()} - DECRETOS DO PODER EXECUTIVO. [excerpt].`

    samples.push({
      id,
      fiscalId: 'fiscal-diarias',
      category: 'fp_replica',
      fpPattern: 'decreto_suplementar_dotacao_339014',
      type: 'diaria_irregular',
      expectedOutcome: 'no_finding',
      source: 'synthetic',
      syntheticGazette: { cityId, cityName, date: data.iso, excerpt, fullPageContext },
      rationale: `Decreto de abertura de crédito adicional suplementar à dotação 3.3.90.14 (DIÁRIAS - PESSOAL CIVIL). Trata-se de mero remanejamento orçamentário (Lei 4.320/64); não há pagamento individualizado a servidor identificado. Padrão recorrente em decretos orçamentários.`,
      shouldTriggerAfterPatch: false,
      filterRule: `ADR-DIA-003 — Excluir excerpts em que "DIÁRIAS" co-ocorra com (3\\.3\\.90\\.14|CRÉDITO\\s+ADICIONAL|SUPLEMENTAR|DOTAÇÃO|LEI\\s+4\\.320|LOA|REMANEJAMENTO).`,
    })
  }
}

// 2d) 20 FP — Advérbio "diariamente" / adjetivo
function genFPAdverbio(n) {
  const moldes = [
    (city, sec, data) => `RESOLUÇÃO Nº ${100 + (data.seed % 400)}\n${sec} torna público o cronograma de funcionamento dos postos de atendimento, que operarão diariamente das 8h às 17h, de segunda a sexta-feira, exceto em feriados nacionais e municipais. ${city}, ${data.ext}.`,
    (city, sec, data) => `EDITAL DE CHAMAMENTO\n${sec} convoca os interessados a comparecerem diariamente à sede administrativa para apresentação de documentação. Horário de atendimento: 9h às 16h. ${city}, ${data.ext}.`,
    (city, sec, data) => `INSTRUÇÃO NORMATIVA Nº ${100 + (data.seed % 400)}\nEstabelece que o relatório operacional deverá ser preenchido diariamente pelos responsáveis dos setores e enviado à Diretoria de Controle. ${city}, ${data.ext}.`,
    (city, sec, data) => `COMUNICADO\n${sec} informa que a equipe técnica realizará vistorias diárias nos pontos de fiscalização, com plantão de 24 horas em casos emergenciais. ${city}, ${data.ext}.`,
    (city, sec, data) => `PORTARIA Nº ${100 + (data.seed % 400)}\nDispõe sobre a rotina diária de manutenção preventiva dos equipamentos da rede municipal de saúde, a ser executada pela equipe de engenharia clínica. ${city}, ${data.ext}.`,
  ]
  for (let i = 0; i < n; i++) {
    const seed = synSeed++
    const [cityId, cityName] = pick(CITIES, seed)
    const sec = pick(SECRETARIAS, seed + 1)
    const data = syntheticDate(seed)
    const molde = pick(moldes, seed + 2)
    const excerpt = molde(cityName, sec, { ...data, seed })

    counterFP++
    const id = `SYN-DIA-FP-${String(counterFP).padStart(3, '0')}`

    samples.push({
      id,
      fiscalId: 'fiscal-diarias',
      category: 'fp_replica',
      fpPattern: 'adverbio_diariamente_adjetivo',
      type: 'diaria_irregular',
      expectedOutcome: 'no_finding',
      source: 'synthetic',
      syntheticGazette: { cityId, cityName, date: data.iso, excerpt, fullPageContext: `DIÁRIO OFICIAL DO MUNICÍPIO DE ${cityName.toUpperCase()}. [excerpt].` },
      rationale: `Termo "diariamente" (advérbio) ou "diária(s)" como adjetivo de rotina/frequência operacional. Não há pagamento de diária a servidor. Padrão linguístico ambíguo capturado por regex frouxa.`,
      shouldTriggerAfterPatch: false,
      filterRule: `ADR-DIA-004 — Exigir contexto de pagamento (R$\\s*\\d+|valor\\s+(unit[áa]rio|de\\s+R\\$)|PORTARIA.*concede.*di[áa]ria|conceder?\\s+\\d+\\s*\\(?\\w*\\)?\\s*di[áa]ria) — sem isso, descartar.`,
    })
  }
}

// 2e) 15 FP — Substring topônimos: "Boa Viagem", "Despesas de Viagem"
function genFPToponimos(n) {
  const moldes = [
    (city, sec, data) => `EXTRATO DE CONTRATO\n${sec} torna público a contratação de serviços de pavimentação asfáltica do trecho compreendido entre a Avenida Boa Viagem e a Rua Conselheiro Aguiar, no bairro de Boa Viagem, conforme projeto técnico. ${city}, ${data.ext}.`,
    (city, sec, data) => `EDITAL DE LICITAÇÃO\nObjeto: reforma e adequação de unidade básica de saúde localizada no bairro de Boa Viagem. ${city}, ${data.ext}.`,
    (city, sec, data) => `BALANCETE FINANCEIRO\nDespesas de Viagem do exercício de ${data.iso.slice(0, 4)}: total empenhado ${fmtBRL(125000 + (data.seed % 500000))}, total liquidado ${fmtBRL(98000 + (data.seed % 400000))}. ${city}, ${data.ext}.`,
    (city, sec, data) => `RELATÓRIO DE EXECUÇÃO ORÇAMENTÁRIA\nGrupo de Despesas de Viagem (passagens e diárias): execução de 47% do previsto na LOA. ${city}, ${data.ext}.`,
    (city, sec, data) => `EXTRATO\nContratação de serviços de transporte rodoviário para trecho Boa Viagem - Centro, Município de Recife. Empresa contratada: AUTOVIAÇÃO REGIONAL LTDA. ${city}, ${data.ext}.`,
  ]
  for (let i = 0; i < n; i++) {
    const seed = synSeed++
    const [cityId, cityName] = pick(CITIES, seed)
    const sec = pick(SECRETARIAS, seed + 1)
    const data = syntheticDate(seed)
    const molde = pick(moldes, seed + 2)
    const excerpt = molde(cityName, sec, { ...data, seed })

    counterFP++
    const id = `SYN-DIA-FP-${String(counterFP).padStart(3, '0')}`

    samples.push({
      id,
      fiscalId: 'fiscal-diarias',
      category: 'fp_replica',
      fpPattern: 'toponimo_boa_viagem_despesas_viagem',
      type: 'diaria_irregular',
      expectedOutcome: 'no_finding',
      source: 'synthetic',
      syntheticGazette: { cityId, cityName, date: data.iso, excerpt, fullPageContext: `DIÁRIO OFICIAL DO MUNICÍPIO DE ${cityName.toUpperCase()}. [excerpt].` },
      rationale: `Substring "Viagem" aparece como topônimo (bairro Boa Viagem em Recife/PE) ou em rubrica orçamentária agregada ("Despesas de Viagem"). Não há pagamento de diária a servidor identificado.`,
      shouldTriggerAfterPatch: false,
      filterRule: `ADR-DIA-005 — Tokenizar "Boa Viagem" como NER topônimo (lookup em lista de bairros conhecidos); tratar "Despesas de Viagem" como rubrica orçamentária quando em contexto de balancete/LOA.`,
    })
  }
}

// 2f) 10 FP — "Divisão de Diárias e Passagens"
function genFPDivisao(n) {
  const moldes = [
    (city, sec, data) => `ATO DE DESIGNAÇÃO\nFica designado o servidor JOÃO CARLOS DA SILVA para responder pela Divisão de Diárias e Passagens da ${sec}, com efeitos a partir de ${data.br}. ${city}, ${data.ext}.`,
    (city, sec, data) => `ESTRUTURA ADMINISTRATIVA\nA Divisão de Diárias e Passagens, vinculada ao Departamento de Recursos Humanos, é responsável por processar pedidos de viagem oficial. ${city}, ${data.ext}.`,
    (city, sec, data) => `PORTARIA Nº ${100 + (data.seed % 400)}\nDispõe sobre o regimento interno da Divisão de Diárias e Passagens, fixando suas competências. ${city}, ${data.ext}.`,
    (city, sec, data) => `MEMORANDO CIRCULAR\nA Divisão de Diárias e Passagens comunica novo procedimento de solicitação para o exercício ${data.iso.slice(0, 4)}. ${city}, ${data.ext}.`,
  ]
  for (let i = 0; i < n; i++) {
    const seed = synSeed++
    const [cityId, cityName] = pick(CITIES, seed)
    const sec = pick(SECRETARIAS, seed + 1)
    const data = syntheticDate(seed)
    const molde = pick(moldes, seed + 2)
    const excerpt = molde(cityName, sec, { ...data, seed })

    counterFP++
    const id = `SYN-DIA-FP-${String(counterFP).padStart(3, '0')}`

    samples.push({
      id,
      fiscalId: 'fiscal-diarias',
      category: 'fp_replica',
      fpPattern: 'divisao_diarias_passagens',
      type: 'diaria_irregular',
      expectedOutcome: 'no_finding',
      source: 'synthetic',
      syntheticGazette: { cityId, cityName, date: data.iso, excerpt, fullPageContext: `DIÁRIO OFICIAL DO MUNICÍPIO DE ${cityName.toUpperCase()}. [excerpt].` },
      rationale: `Citação do nome de unidade administrativa "Divisão de Diárias e Passagens" — meta-referência ao setor que processa diárias, sem pagamento individualizado.`,
      shouldTriggerAfterPatch: false,
      filterRule: `ADR-DIA-006 — Excluir excerpts em que "Diárias" apareça apenas em nome próprio de unidade ("Divisão de Diárias e Passagens", "Setor de Diárias", "Coordenadoria de Diárias") sem co-ocorrência de servidor + valor.`,
    })
  }
}

// 2g) 10 FP — "Multa diária" / "jornada diária" / "circulação diária"
function genFPMultaJornada(n) {
  const moldes = [
    (city, sec, data) => `EDITAL DE LICITAÇÃO PE Nº ${100 + (data.seed % 400)}/${data.iso.slice(0, 4)}\nClausula 12 - Sanções: O atraso na execução acarretará multa diária de 0,33% sobre o valor do contrato, limitada a 10%. ${city}, ${data.ext}.`,
    (city, sec, data) => `EXTRATO DE CONTRATO Nº ${100 + (data.seed % 400)}/${data.iso.slice(0, 4)}\nMulta diária por atraso: ${fmtBRL(150 + (data.seed % 500))} por dia útil de mora, conforme cláusula penal. ${city}, ${data.ext}.`,
    (city, sec, data) => `EDITAL DE CONCURSO PÚBLICO\nJornada diária de trabalho: 6 horas, distribuídas em escala de 30h semanais. Vencimento inicial: ${fmtBRL(3500 + (data.seed % 2000))}. ${city}, ${data.ext}.`,
    (city, sec, data) => `DECRETO\nFixa a circulação diária de veículos pesados nas vias do centro histórico, das 22h às 5h, exceto carga e descarga. ${city}, ${data.ext}.`,
  ]
  for (let i = 0; i < n; i++) {
    const seed = synSeed++
    const [cityId, cityName] = pick(CITIES, seed)
    const sec = pick(SECRETARIAS, seed + 1)
    const data = syntheticDate(seed)
    const molde = pick(moldes, seed + 2)
    const excerpt = molde(cityName, sec, { ...data, seed })

    counterFP++
    const id = `SYN-DIA-FP-${String(counterFP).padStart(3, '0')}`

    samples.push({
      id,
      fiscalId: 'fiscal-diarias',
      category: 'fp_replica',
      fpPattern: 'multa_jornada_circulacao_diaria',
      type: 'diaria_irregular',
      expectedOutcome: 'no_finding',
      source: 'synthetic',
      syntheticGazette: { cityId, cityName, date: data.iso, excerpt, fullPageContext: `DIÁRIO OFICIAL DO MUNICÍPIO DE ${cityName.toUpperCase()}. [excerpt].` },
      rationale: `"Diária" como adjetivo modificador (multa diária / jornada diária / circulação diária). Não há pagamento de diária a servidor.`,
      shouldTriggerAfterPatch: false,
      filterRule: `ADR-DIA-007 — Excluir matches em que "diária" venha precedida de (multa|jornada|circulação|escala|carga|frequência|rotina|atividade).`,
    })
  }
}

// ============================================================================
// 3) 34 FP edge case
// ============================================================================

// 3a) 10 — Diária internacional Decreto 71.733/73 + portaria designação
function genEdgeInternacional(n) {
  const destinosIntl = [
    ['Lisboa', 'Portugal'],
    ['Madrid', 'Espanha'],
    ['Paris', 'França'],
    ['Buenos Aires', 'Argentina'],
    ['Bogotá', 'Colômbia'],
    ['Cidade do México', 'México'],
    ['Washington', 'Estados Unidos'],
    ['Berlim', 'Alemanha'],
  ]
  const eventosIntl = [
    'XXIII Congresso Ibero-Americano de Municípios',
    'Cúpula Mundial de Cidades Sustentáveis',
    'Cooperação Técnica em Mobilidade Urbana - Cooperação Internacional',
    'Reunião Bilateral de Geminação de Cidades',
    'Fórum Internacional de Gestão Pública',
  ]
  for (let i = 0; i < n; i++) {
    const seed = synSeed++
    const [cityId, cityName] = pick(CITIES, seed)
    const sec = pick(SECRETARIAS, seed + 1)
    const [nome, cargo, matricula] = pick(SERVIDORES, seed + 2)
    const [destCidade, destPais] = pick(destinosIntl, seed + 3)
    const evento = pick(eventosIntl, seed + 4)
    const data = syntheticDate(seed)
    const numDias = pick([3, 4, 5, 6, 7], seed + 5)
    const valorDia = valorDiaria(seed, 'internacional')
    const total = valorDia * numDias
    const port = `${100 + (seed % 900)}/${data.iso.slice(0, 4)}`
    const cpfFinal = String(seed % 100).padStart(2, '0')

    counterEdge++
    const id = `SYN-DIA-EDGE-${String(counterEdge).padStart(3, '0')}`

    const excerpt = `PORTARIA CONJUNTA Nº ${port}\n` +
      `O Prefeito Municipal e o Secretário Municipal RESOLVEM:\n` +
      `Art. 1º Designar o(a) servidor(a) ${nome}, ${cargo}, matrícula nº ${matricula}, CPF ***.***.***-${cpfFinal}, lotado(a) na ${sec}, para representar oficialmente o Município no(a) ${evento}, a realizar-se em ${destCidade}, ${destPais}, no período de ${data.br} a ${isoToBR(addDays(data.iso, numDias - 1))}.\n` +
      `Art. 2º Fica autorizado o pagamento de ${numDias} diárias internacionais no valor unitário de ${fmtBRL(valorDia)}, totalizando ${fmtBRL(total)}, com fundamento no Decreto Federal nº 71.733/73 e demais normas aplicáveis.\n` +
      `Art. 3º A despesa correrá à conta da dotação orçamentária da Secretaria Municipal indicada.\n` +
      `${cityName}, ${data.ext}.`

    const fullPageContext = `DIÁRIO OFICIAL DO MUNICÍPIO DE ${cityName.toUpperCase()} - ATOS DE DESIGNAÇÃO INTERNACIONAL. [excerpt].`

    samples.push({
      id,
      fiscalId: 'fiscal-diarias',
      category: 'fp_edge_case',
      fpPattern: 'diaria_internacional_decreto_71733',
      type: 'diaria_irregular',
      expectedOutcome: 'no_finding',
      source: 'synthetic',
      syntheticGazette: { cityId, cityName, date: data.iso, excerpt, fullPageContext },
      rationale: `Diária internacional regida por Decreto 71.733/73 — valores referenciados em moeda estrangeira convertida, com tabela própria distinta da Lei 8.112/90 Art. 58. Servidor identificado com matrícula, missão oficial documentada (evento + país). Edge case: valor excede teto nacional, mas é regular pelo regime internacional aplicável.`,
      shouldTriggerAfterPatch: false,
      filterRule: `ADR-DIA-008 — Quando portaria invocar "Decreto 71.733/73" OU mencionar país estrangeiro como destino, aplicar regime internacional (não comparar contra teto R$ 800/dia nacional).`,
    })
  }
}

// 3b) 10 — Feriado COM justificativa explícita ("audiência judicial")
function genEdgeFeriadoJustificado(n) {
  const justificativas = [
    'audiência judicial improrrogável marcada para a referida data por determinação do Tribunal de Justiça',
    'sustentação oral em sessão extraordinária de julgamento no Tribunal Regional Federal',
    'mutirão emergencial de atendimento humanitário decorrente de situação calamitosa',
    'plantão de procurador em ação de execução fiscal com prazo decadencial',
    'reunião emergencial convocada pela Defesa Civil estadual em razão de evento meteorológico extremo',
    'audiência de custódia em regime de plantão judicial - Lei nº 12.403/2011',
    'representação do Município em sessão solene do Senado Federal previamente agendada',
    'depoimento como testemunha técnica em CPI da Câmara dos Deputados em data fixada por convocação',
  ]
  for (let i = 0; i < n; i++) {
    const seed = synSeed++
    const [cityId, cityName] = pick(CITIES, seed)
    const sec = pick(SECRETARIAS, seed + 1)
    const [nome, cargo, matricula] = pick(SERVIDORES, seed + 2)
    const [destCidade, destUF] = pick(DESTINOS, seed + 3)
    const [feriadoIso, feriadoNome] = pick(FERIADOS, seed + 4)
    const just = pick(justificativas, seed + 5)
    const valorDia = valorDiaria(seed, 'normal')
    const port = `${100 + (seed % 900)}/${feriadoIso.slice(0, 4)}`
    const cpfFinal = String(seed % 100).padStart(2, '0')
    const dataPubliBR = isoToBR(feriadoIso)
    const dataPubliExt = isoToExt(feriadoIso)

    counterEdge++
    const id = `SYN-DIA-EDGE-${String(counterEdge).padStart(3, '0')}`

    const excerpt = `PORTARIA Nº ${port}\n` +
      `O Secretário Municipal, considerando ${just}, RESOLVE:\n` +
      `Art. 1º Conceder ao(à) servidor(a) ${nome}, ${cargo}, matrícula nº ${matricula}, CPF ***.***.***-${cpfFinal}, lotado(a) na ${sec}, 01 (uma) diária no valor de ${fmtBRL(valorDia)} para deslocamento à ${destCidade}/${destUF} no dia ${dataPubliBR}, em regime de excepcionalidade por se tratar de feriado nacional (${feriadoNome}).\n` +
      `Art. 2º Justifica-se o deslocamento em dia não útil em razão da imprescindibilidade do ato funcional descrito no caput, conforme documentação anexa ao processo.\n` +
      `${cityName}, ${dataPubliExt}.`

    const fullPageContext = `DIÁRIO OFICIAL DO MUNICÍPIO DE ${cityName.toUpperCase()} - DIÁRIAS EM REGIME EXCEPCIONAL. [excerpt].`

    samples.push({
      id,
      fiscalId: 'fiscal-diarias',
      category: 'fp_edge_case',
      fpPattern: 'feriado_com_justificativa_explicita',
      type: 'diaria_irregular',
      expectedOutcome: 'no_finding',
      source: 'synthetic',
      syntheticGazette: { cityId, cityName, date: feriadoIso, excerpt, fullPageContext },
      rationale: `Pagamento de diária em feriado nacional, mas portaria contém justificativa expressa para a excepcionalidade (audiência judicial / plantão / Defesa Civil etc.) e cita o feriado nominalmente. Lei 8.112/90 Art. 58 admite serviço fora do dia útil quando justificado. Fiscal NÃO deve disparar.`,
      shouldTriggerAfterPatch: false,
      filterRule: `ADR-DIA-009 — Quando data de deslocamento cair em feriado/FDS E excerpt contiver justificativa expressa (audiência|plantão|emergência|sustentação|defesa civil|calamidade|mutirão|sessão extraordinária), suprimir finding.`,
    })
  }
}

// 3c) 7 — R$ 800-850 com agenda anexada
function genEdgeLimiteComAgenda(n) {
  for (let i = 0; i < n; i++) {
    const seed = synSeed++
    const [cityId, cityName] = pick(CITIES, seed)
    const sec = pick(SECRETARIAS, seed + 1)
    const [nome, cargo, matricula] = pick(SERVIDORES, seed + 2)
    const [destCidade, destUF] = pick(DESTINOS, seed + 3)
    const data = syntheticDate(seed)
    const valorDia = valorDiaria(seed, 'limite')
    const numDias = pick([2, 3], seed + 4)
    const total = valorDia * numDias
    const port = `${100 + (seed % 900)}/${data.iso.slice(0, 4)}`
    const cpfFinal = String(seed % 100).padStart(2, '0')
    const eventos = [
      'XII Encontro Nacional de Auditores Fiscais (programa oficial anexo)',
      'Reunião do Conselho Nacional de Procuradores Municipais (agenda completa anexa ao processo SEI)',
      'Capacitação ENAP em Gestão de Contratos Públicos (cronograma de aulas anexo)',
      '8º Seminário de Compliance no Setor Público (programação detalhada anexa)',
      'Comitê Técnico do Consórcio Intermunicipal de Saúde (pauta da reunião anexa)',
      'Reunião de Pactuação Tripartite - SUS (pauta oficial anexa)',
      'Audiência Pública na Câmara Federal sobre marco regulatório (cronograma confirmado)',
    ]
    const evento = pick(eventos, seed + 5)

    counterEdge++
    const id = `SYN-DIA-EDGE-${String(counterEdge).padStart(3, '0')}`

    const excerpt = `PORTARIA Nº ${port}\n` +
      `Concede ao(à) servidor(a) ${nome}, ${cargo}, matrícula nº ${matricula}, CPF ***.***.***-${cpfFinal}, lotado(a) na ${sec}, ${numDias} (${numDias === 2 ? 'duas' : 'três'}) diárias no valor unitário de ${fmtBRL(valorDia)}, totalizando ${fmtBRL(total)}, para participar do(a) ${evento}, em ${destCidade}/${destUF}, no período de ${data.br} a ${isoToBR(addDays(data.iso, numDias - 1))}.\n` +
      `O servidor deverá apresentar relatório de viagem e certificado de participação no prazo de 5 dias úteis após o retorno, conforme Instrução Normativa Municipal.\n` +
      `${cityName}, ${data.ext}.`

    const fullPageContext = `DIÁRIO OFICIAL DO MUNICÍPIO DE ${cityName.toUpperCase()} - DIÁRIAS COM AGENDA OFICIAL. [excerpt].`

    samples.push({
      id,
      fiscalId: 'fiscal-diarias',
      category: 'fp_edge_case',
      fpPattern: 'limite_800_850_com_agenda_anexa',
      type: 'diaria_irregular',
      expectedOutcome: 'no_finding',
      source: 'synthetic',
      syntheticGazette: { cityId, cityName, date: data.iso, excerpt, fullPageContext },
      rationale: `Valor unitário ${fmtBRL(valorDia)} apenas marginalmente acima do teto de referência (R$ 800), porém com agenda oficial anexada (programa/cronograma/pauta) e exigência de relatório de viagem. Conjunto de evidências que descaracteriza irregularidade. Edge case para evitar FP por excesso de zelo no threshold.`,
      shouldTriggerAfterPatch: false,
      filterRule: `ADR-DIA-010 — Quando valor estiver na faixa R$ 800-850 (margem 10% acima do teto) e excerpt contiver indicadores de agenda formal (programa anexo|cronograma|pauta|certificado|relatório de viagem), reduzir riskScore abaixo do threshold (não publicar).`,
    })
  }
}

// 3d) 7 — Calamidade pública declarada
function genEdgeCalamidade(n) {
  const calamidades = [
    'Decreto Municipal nº 8.412/2024 que declarou Estado de Calamidade Pública em razão das enchentes',
    'Decreto Estadual nº 57.892/2024 e Portaria MIDR nº 2.841 que reconheceram situação de emergência por evento climático extremo',
    'Decreto Municipal nº 9.105/2025 declarando emergência sanitária por surto epidemiológico',
    'reconhecimento federal de Estado de Calamidade Pública via Portaria MIDR-SEDEC nº 1.452/2024',
  ]
  for (let i = 0; i < n; i++) {
    const seed = synSeed++
    const [cityId, cityName] = pick(CITIES, seed)
    const sec = pick(SECRETARIAS, seed + 1)
    const [nome, cargo, matricula] = pick(SERVIDORES, seed + 2)
    const [destCidade, destUF] = pick(DESTINOS, seed + 3)
    const data = syntheticDate(seed)
    const valorDia = valorDiaria(seed, 'normal')
    const numDias = pick([3, 4, 5], seed + 4)
    const total = valorDia * numDias
    const port = `${100 + (seed % 900)}/${data.iso.slice(0, 4)}`
    const calam = pick(calamidades, seed + 5)
    const cpfFinal = String(seed % 100).padStart(2, '0')
    const fdsLabel = pick(['sábado', 'domingo'], seed + 6)

    counterEdge++
    const id = `SYN-DIA-EDGE-${String(counterEdge).padStart(3, '0')}`

    const excerpt = `PORTARIA EMERGENCIAL Nº ${port}\n` +
      `Considerando o ${calam}, e a necessidade de mobilização imediata de equipe técnica para atendimento da população afetada, o Secretário Municipal RESOLVE:\n` +
      `Art. 1º Conceder ao(à) servidor(a) ${nome}, ${cargo}, matrícula nº ${matricula}, CPF ***.***.***-${cpfFinal}, lotado(a) na ${sec}, ${numDias} diárias no valor unitário de ${fmtBRL(valorDia)}, totalizando ${fmtBRL(total)}, para deslocamento à ${destCidade}/${destUF}, com início em ${data.br} (${fdsLabel}), em regime de emergência humanitária.\n` +
      `Art. 2º Em razão da urgência, fica dispensada a observância do prazo prévio de solicitação, com fundamento na excepcionalidade prevista no Art. 24, IV da Lei 14.133/2021 c/c o ato declaratório de calamidade.\n` +
      `${cityName}, ${data.ext}.`

    const fullPageContext = `DIÁRIO OFICIAL DO MUNICÍPIO DE ${cityName.toUpperCase()} - PORTARIAS EMERGENCIAIS. [excerpt].`

    samples.push({
      id,
      fiscalId: 'fiscal-diarias',
      category: 'fp_edge_case',
      fpPattern: 'calamidade_publica_declarada',
      type: 'diaria_irregular',
      expectedOutcome: 'no_finding',
      source: 'synthetic',
      syntheticGazette: { cityId, cityName, date: data.iso, excerpt, fullPageContext },
      rationale: `Diária paga em FDS/contexto excepcional, mas portaria fundamenta-se em decreto declaratório de calamidade pública / estado de emergência expressamente citado. Edge case: combinação que individualmente disparaiam (FDS sem justificativa) é descaracterizada pelo ato emergencial referenciado.`,
      shouldTriggerAfterPatch: false,
      filterRule: `ADR-DIA-011 — Quando excerpt contiver referência a "calamidade pública|estado de emergência|portaria MIDR|decreto.*emergência|atendimento humanitário" + decreto/portaria com número, suprimir finding mesmo em FDS/feriado.`,
    })
  }
}

// ----------------------------------------------------------------------------
// EXECUÇÃO

// 1) TP textbook (35)
genTPValorAlto(12)
genTPFDS(10)
genTPFeriado(8)
genTPSemAgenda(5)

// 2) FP réplica (120)
genFPHospedagem(25)
genFPInpcLocacao(20)
genFPDecretoSupl(20)
genFPAdverbio(20)
genFPToponimos(15)
genFPDivisao(10)
genFPMultaJornada(10)

// 3) FP edge case (34)
genEdgeInternacional(10)
genEdgeFeriadoJustificado(10)
genEdgeLimiteComAgenda(7)
genEdgeCalamidade(7)

// ----------------------------------------------------------------------------
// EMIT

const outPath = path.join(__dirname, 'synthetic-samples-batch2.json')
fs.writeFileSync(outPath, JSON.stringify(samples, null, 2), 'utf8')

const counts = samples.reduce((acc, s) => {
  acc[s.category] = (acc[s.category] || 0) + 1
  return acc
}, {})

console.log(`\n=== FiscalDiárias batch2 gerado ===`)
console.log(`Total: ${samples.length} amostras`)
console.log(`  tp_textbook  : ${counts.tp_textbook || 0}`)
console.log(`  fp_replica   : ${counts.fp_replica || 0}`)
console.log(`  fp_edge_case : ${counts.fp_edge_case || 0}`)
console.log(`Arquivo: ${outPath}`)
