// Gerador one-shot do batch2 (239 amostras) para FiscalConvênios.
// Script local; não é versionado em produção. Roda uma vez para emitir o JSON
// e não é referenciado por testes — testes consomem só `synthetic-samples-batch2.json`.
//
// Estratégia: pools de variações realistas (cidades, secretarias, OSCs, valores,
// fundamentos legais) combinados em moldes textuais formais de Diário Oficial.
// Cada categoria tem moldes distintos para preservar autenticidade linguística.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ----------------------------------------------------------------------------
// POOLS

// IBGE id, nome, UF — 50 cidades reais (CLAUDE.md / cities/index.ts)
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

// Sufixos sintéticos para CNPJ — todos com prefixo padrão exigido pelo briefing
const CNPJ_SUFFIXES = ['10', '15', '22', '33', '44', '55', '66', '77', '81', '90', '04', '12', '28', '37', '49', '52', '63', '71', '85', '99', '08', '19', '26', '34', '46', '58', '67', '74', '83', '95']
const cnpj = (i) => `12.345.678/0001-${CNPJ_SUFFIXES[i % CNPJ_SUFFIXES.length]}`

// OSCs sintéticas — terceiro setor genuíno
const OSCS_TERCEIRO_SETOR = [
  'CASA DE APOIO SÃO LUCAS',
  'INSTITUTO CULTURAL ARTE PARA TODOS',
  'ASSOCIAÇÃO BENEFICENTE COMUNITÁRIA VIDA NOVA',
  'CENTRO DE ACOLHIDA HORIZONTE NOVO',
  'INSTITUTO DA CRIANÇA FELIZ',
  'ASSOCIAÇÃO DE PAIS E AMIGOS DOS EXCEPCIONAIS - APAE LOCAL',
  'INSTITUTO PROAMOR DE AÇÃO SOCIAL',
  'CENTRO DE INTEGRAÇÃO COMUNITÁRIA NOVO HORIZONTE',
  'ASSOCIAÇÃO DOS MORADORES E AMIGOS DA REGIÃO',
  'INSTITUTO SEMENTES DO FUTURO',
  'CENTRO ESPÍRITA AMOR E LUZ - OBRA SOCIAL',
  'ASSOCIAÇÃO BRASILEIRA DE LITERATURA INFANTIL',
  'INSTITUTO DE ASSISTÊNCIA À INFÂNCIA E ADOLESCÊNCIA',
  'ASSOCIAÇÃO BENEFICENTE NOSSA SENHORA APARECIDA',
  'INSTITUTO MÃOS QUE AJUDAM',
  'CENTRO COMUNITÁRIO DE PROMOÇÃO HUMANA',
  'ASSOCIAÇÃO DE APOIO AO IDOSO BEM-VIVER',
  'INSTITUTO DE PROTEÇÃO ANIMAL DA REGIÃO',
  'ASSOCIAÇÃO PRÓ-CULTURA POPULAR',
  'INSTITUTO DE ACOLHIMENTO TRANSFORMAR',
  'ASSOCIAÇÃO DESPORTIVA E SOCIAL UNIÃO',
  'INSTITUTO BRASILEIRO DE EDUCAÇÃO E CIDADANIA',
  'CASA DA CRIANÇA SANTA TERESINHA',
  'ASSOCIAÇÃO COMUNITÁRIA RAIO DE LUZ',
  'INSTITUTO ECO RESPONSÁVEL',
  'ASSOCIAÇÃO BENEFICENTE LAR DOS NECESSITADOS',
  'INSTITUTO DE PESQUISA E AÇÃO SOCIAL',
  'CENTRO DE FORMAÇÃO PROFISSIONAL JOVEM CIDADÃO',
  'ASSOCIAÇÃO DE MULHERES EMPREENDEDORAS',
  'INSTITUTO DE INCLUSÃO E DIVERSIDADE',
  'CASA DA MISERICÓRDIA - OBRA SOCIAL',
  'ASSOCIAÇÃO DOS AMIGOS DOS ANIMAIS',
  'INSTITUTO PRÓ-CRIANÇA E ADOLESCENTE',
  'ASSOCIAÇÃO BENEFICENTE SÃO VICENTE DE PAULO',
  'CENTRO DE REABILITAÇÃO SOCIAL FÊNIX',
  'INSTITUTO DA TERCEIRA IDADE FELIZ',
  'ASSOCIAÇÃO DE MORADORES DO BAIRRO ALTO',
  'INSTITUTO ESPORTE E CIDADANIA',
  'CENTRO DE CULTURA POPULAR DA REGIÃO',
  'ASSOCIAÇÃO BENEFICENTE FÉ E TRABALHO',
]

// Secretarias municipais (variação)
const SECRETARIAS = [
  'Secretaria Municipal de Assistência Social',
  'Secretaria Municipal de Cultura',
  'Secretaria Municipal de Saúde',
  'Secretaria Municipal de Educação',
  'Secretaria Municipal de Direitos Humanos e Cidadania',
  'Secretaria Municipal de Esportes e Lazer',
  'Secretaria Municipal do Meio Ambiente',
  'Secretaria Municipal de Habitação',
  'Secretaria Municipal de Desenvolvimento Social',
  'Secretaria Municipal da Mulher e Cidadania',
  'Secretaria Municipal de Políticas para Crianças e Adolescentes',
  'Secretaria Municipal de Juventude',
]

// Objetos típicos de Termo de Fomento/Colaboração com OSC
const OBJETOS_OSC = [
  'manutenção de abrigo de idosos em situação de vulnerabilidade',
  'execução de projeto de oficinas culturais nas escolas públicas do município',
  'apoio a projeto de prevenção de doenças crônicas em comunidades vulneráveis',
  'acolhimento de pessoas em situação de rua na região central',
  'desenvolvimento de programa de combate à evasão escolar em bairros periféricos',
  'execução de oficinas de capacitação profissional para jovens de baixa renda',
  'manutenção de centro de convivência para pessoas com deficiência',
  'apoio à proteção de animais em situação de risco',
  'realização de atividades culturais de fomento à leitura em comunidades',
  'execução de ações de combate à violência doméstica',
  'manutenção de casa de passagem para mulheres em situação de violência',
  'apoio a projeto socioeducativo para crianças em vulnerabilidade',
  'execução de programa de promoção da saúde mental comunitária',
  'manutenção de creche comunitária conveniada',
  'apoio à prática esportiva para jovens em comunidades de baixa renda',
  'execução de programa de educação ambiental nas escolas',
  'realização de oficinas de inclusão digital para idosos',
  'manutenção de banco de alimentos para famílias em insegurança alimentar',
  'execução de projeto de combate à violência contra a pessoa idosa',
  'apoio a projeto de fortalecimento de vínculos familiares',
]

// Federal — siglas/ministérios e objetos para Contrato de Repasse
const REPASSES_FEDERAIS = [
  // [sigla, ministério, objetos]
  ['MTUR', 'MINISTÉRIO DO TURISMO', [
    'construção de centro de eventos turísticos no município',
    'reforma e adequação de mirante turístico municipal',
    'revitalização de atrativo turístico de patrimônio histórico',
    'ampliação de infraestrutura turística no centro histórico',
    'construção de portal turístico de acesso ao município',
  ]],
  ['MDR', 'MINISTÉRIO DO DESENVOLVIMENTO REGIONAL', [
    'implantação de sistema de drenagem urbana no bairro',
    'pavimentação e recapeamento asfáltico de vias urbanas',
    'construção de unidades habitacionais de interesse social',
    'execução de obras de contenção de encostas',
    'implantação de sistema de abastecimento de água em zona rural',
  ]],
  ['MAPA', 'MINISTÉRIO DA AGRICULTURA, PECUÁRIA E ABASTECIMENTO', [
    'aquisição de equipamentos para fortalecimento da agricultura familiar e patrulha agrícola mecanizada',
    'aquisição de implementos agrícolas para apoio aos pequenos produtores',
    'estruturação de feira do produtor rural municipal',
  ]],
  ['MEC', 'MINISTÉRIO DA EDUCAÇÃO', [
    'construção de unidade escolar de educação infantil',
    'reforma e ampliação de escola municipal de ensino fundamental',
    'aquisição de equipamentos de informática para escolas da rede municipal',
  ]],
  ['MS', 'MINISTÉRIO DA SAÚDE', [
    'construção de Unidade Básica de Saúde no bairro',
    'aquisição de equipamentos médico-hospitalares para a rede de atenção primária',
    'reforma de Unidade de Pronto Atendimento (UPA) municipal',
  ]],
  ['MJ', 'MINISTÉRIO DA JUSTIÇA E SEGURANÇA PÚBLICA', [
    'aquisição de viaturas e equipamentos para a Guarda Civil Municipal',
    'implantação de sistema de videomonitoramento urbano',
    'estruturação de Centro Integrado de Segurança Pública municipal',
  ]],
  ['MTE', 'MINISTÉRIO DO TRABALHO E EMPREGO', [
    'estruturação de Centro Público de Apoio ao Trabalhador',
    'aquisição de equipamentos para qualificação profissional municipal',
    'implantação de programa de inclusão produtiva para população em vulnerabilidade',
  ]],
  ['MCID', 'MINISTÉRIO DAS CIDADES', [
    'implantação de calçadas acessíveis e ciclovias em corredor urbano',
    'urbanização integrada de assentamento precário',
    'requalificação urbana de praça pública central',
  ]],
]

// Universidades / Fundações públicas / Hospitais filantrópicos — contrapartes não-OSC
const CONTRAPARTES_NAO_OSC = [
  ['UNIVERSIDADE FEDERAL', 'Universidade Federal', 'autarquia federal de regime especial vinculada ao MEC'],
  ['UNIVERSIDADE ESTADUAL', 'Universidade Estadual', 'autarquia estadual em regime especial'],
  ['FUNDAÇÃO MUNICIPAL DO HOSPITAL DO SERVIDOR PÚBLICO', 'Fundação Municipal', 'fundação pública integrante da Administração Indireta do Município'],
  ['FUNDAÇÃO MUNICIPAL DE EDUCAÇÃO E CULTURA', 'Fundação Municipal', 'fundação pública integrante da Administração Indireta do Município'],
  ['HOSPITAL UNIVERSITÁRIO', 'Hospital Universitário', 'hospital de ensino vinculado a universidade federal'],
  ['SANTA CASA DE MISERICÓRDIA', 'Santa Casa', 'entidade filantrópica beneficente de assistência social na área de saúde'],
  ['IRMANDADE PIO SODALÍCIO DA NOSSA SENHORA', 'Pio Sodalício', 'entidade religiosa filantrópica de longa data'],
  ['BENEFICÊNCIA HOSPITALAR DE CESÁRIO LANGE', 'Beneficência Hospitalar', 'entidade hospitalar filantrópica'],
]

// ----------------------------------------------------------------------------
// HELPERS

function pick(arr, i) { return arr[i % arr.length] }
function fmtBRL(n) {
  // formato R$ X.XXX.XXX,00 / R$ XXX.XXX,00
  const inteiro = Math.floor(n)
  const s = inteiro.toString()
  const partes = []
  for (let i = s.length; i > 0; i -= 3) partes.unshift(s.slice(Math.max(0, i - 3), i))
  return `R$ ${partes.join('.')},00`
}
function dataBR(yyyy, mm, dd) {
  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
  const ddS = String(dd).padStart(2, '0')
  const mmS = String(mm).padStart(2, '0')
  return { iso: `${yyyy}-${mmS}-${ddS}`, br: `${ddS}/${mmS}/${yyyy}`, ext: `${ddS} de ${meses[mm - 1]} de ${yyyy}` }
}

// Spread temporal 2021-2026 com seed determinístico
function syntheticDate(seed) {
  const ano = 2021 + (seed % 6)
  const mes = 1 + ((seed * 13) % 12)
  const dia = 1 + ((seed * 7) % 28)
  return dataBR(ano, mes, dia)
}

// Valor "natural" — mistura de faixas comuns
function syntheticValor(seed, faixa) {
  // faixa: 'oscMicro' (30k-150k) | 'oscMedio' (150k-700k) | 'oscGrande' (700k-2M)
  // | 'repasseMedio' (500k-2M) | 'repasseGrande' (2M-8M)
  // | 'decretoSupl' (1M-15M) | 'aditivoBase' (50k-1M)
  const r = (seed * 9301 + 49297) % 233280
  const norm = r / 233280
  let valor
  switch (faixa) {
    case 'oscMicro':       valor = 30000 + Math.floor(norm * 120000); break
    case 'oscMedio':       valor = 150000 + Math.floor(norm * 550000); break
    case 'oscGrande':      valor = 700000 + Math.floor(norm * 1300000); break
    case 'repasseMedio':   valor = 500000 + Math.floor(norm * 1500000); break
    case 'repasseGrande':  valor = 2000000 + Math.floor(norm * 6000000); break
    case 'decretoSupl':    valor = 1000000 + Math.floor(norm * 14000000); break
    case 'aditivoBase':    valor = 50000 + Math.floor(norm * 950000); break
    default:               valor = 100000
  }
  // arredonda para múltiplo de 500 para "naturalidade"
  return Math.round(valor / 500) * 500
}

// ----------------------------------------------------------------------------
// GERADORES POR CATEGORIA

const samples = []
let counterTP = 3   // já existem TP-001..003
let counterFP = 5   // já existem FP-001..005
let counterEdge = 3 // já existem EDGE-001..003
let synSeed = 100

// ============================================================================
// 1) 40 TP textbook
// ============================================================================
function genTPTextbook(n) {
  const tipos = [
    { instrumento: 'TERMO DE FOMENTO', verbo: 'celebra' },
    { instrumento: 'TERMO DE COLABORAÇÃO', verbo: 'celebra' },
  ]
  for (let i = 0; i < n; i++) {
    const seed = synSeed++
    const [cityId, cityName] = pick(CITIES, seed)
    const tipo = pick(tipos, seed + 1)
    const sec = pick(SECRETARIAS, seed + 2)
    const osc = pick(OSCS_TERCEIRO_SETOR, seed + 3)
    const objeto = pick(OBJETOS_OSC, seed + 4)
    const c = cnpj(seed + 5)
    const data = syntheticDate(seed)
    // Faixas variadas: micro (30k–150k), médio (150k–700k), grande (700k–2M)
    const faixaSeed = seed % 3
    const faixa = faixaSeed === 0 ? 'oscMicro' : faixaSeed === 1 ? 'oscMedio' : 'oscGrande'
    const valor = syntheticValor(seed, faixa)
    const vigencia = pick([6, 8, 10, 12, 18, 24], seed + 7)
    const nro = String(1 + (seed % 80)).padStart(3, '0')
    const ano = data.iso.slice(0, 4)
    const sei = `${1000 + (seed % 9000)}.${ano}/000${1000 + (seed % 9000)}-${seed % 10}`

    counterTP++
    const id = `SYN-CONV-TP-${String(counterTP).padStart(3, '0')}`

    const excerpt = `EXTRATO DO ${tipo.instrumento} Nº ${nro}/${ano}\n` +
      `Processo SEI nº ${sei}.\n` +
      `PARTES: MUNICÍPIO DE ${cityName.toUpperCase()}, por meio da ${sec}, e a ${osc}, CNPJ ${c}, qualificada como Organização da Sociedade Civil nos termos da Lei nº 13.019/2014.\n` +
      `OBJETO: ${objeto}.\n` +
      `VALOR: ${fmtBRL(valor)}.\n` +
      `VIGÊNCIA: ${vigencia} meses, contados da data de publicação.\n` +
      `FUNDAMENTO LEGAL: Lei Federal nº 13.019/2014.\n` +
      `DOTAÇÃO ORÇAMENTÁRIA: ${pick(['08.244', '13.392', '10.301', '12.361', '04.122'], seed + 8)}.${pick(['0050', '0034', '0301', '0125', '0012'], seed + 9)}.${1000 + (seed % 9000)} - Manutenção das Atividades Finalísticas.\n` +
      `DATA DE ASSINATURA: ${data.br}.`

    const fullPageContext = `DIÁRIO OFICIAL DO MUNICÍPIO DE ${cityName.toUpperCase()} - ${sec.toUpperCase()} - EXTRATOS. O Secretário Municipal torna público o extrato. [excerpt]. Plano de Trabalho parte integrante do termo, arquivado no processo SEI. ${cityName}, ${data.ext}.`

    samples.push({
      id,
      fiscalId: 'fiscal-convenios',
      category: 'tp_textbook',
      type: 'convenio_sem_chamamento',
      expectedOutcome: 'TP',
      expectedRiskScore: '>= 70',
      expectedConfidence: '>= 0.75',
      source: 'synthetic',
      syntheticGazette: { cityId, cityName, date: data.iso, excerpt, fullPageContext },
      rationale: `${tipo.instrumento} Município-OSC (${osc}). Fundamento Lei 13.019/2014 expresso. Valor ${fmtBRL(valor)}. Documento NÃO menciona chamamento público em nenhuma parte nem invoca dispensa Art. 30. Padrão textbook: instrumento típico Lei 13.019, contraparte é OSC do terceiro setor (CNPJ não-governamental), há repasse financeiro positivo, ausência total de fundamentação para dispensa.`,
      shouldTriggerAfterPatch: true,
    })
  }
}

// ============================================================================
// 2) 30 FP — Contrato de Repasse federal (5 MTUR + 5 MDR + 5 MAPA + 3 MEC + 3 MS + 3 MJ + 3 MTE + 3 MCID)
// ============================================================================
function genFPRepasses() {
  const distrib = [
    ['MTUR', 5], ['MDR', 5], ['MAPA', 5], ['MEC', 3], ['MS', 3], ['MJ', 3], ['MTE', 3], ['MCID', 3],
  ]
  for (const [sigla, qtd] of distrib) {
    const meta = REPASSES_FEDERAIS.find(([s]) => s === sigla)
    const [, ministerio, objetos] = meta
    for (let i = 0; i < qtd; i++) {
      const seed = synSeed++
      const [cityId, cityName] = pick(CITIES, seed)
      const objeto = pick(objetos, seed + 1)
      const data = syntheticDate(seed)
      const ano = data.iso.slice(0, 4)
      const valorRep = syntheticValor(seed, seed % 3 === 0 ? 'repasseGrande' : 'repasseMedio')
      const contrap = Math.round(valorRep * 0.05 / 500) * 500 // 5% contrapartida típica
      const total = valorRep + contrap
      const nro = `0${800000 + (seed % 100000)}-${seed % 100}`
      const vigencia = pick([12, 18, 24, 36], seed + 4)

      counterFP++
      const id = `SYN-CONV-FP-${String(counterFP).padStart(3, '0')}`

      const excerpt = `EXTRATO DO CONTRATO DE REPASSE Nº ${nro}/${ano}/${sigla}/CAIXA\n` +
        `CONCEDENTE: UNIÃO FEDERAL, por intermédio do ${ministerio}.\n` +
        `MANDATÁRIA: CAIXA ECONÔMICA FEDERAL.\n` +
        `CONVENENTE: MUNICÍPIO DE ${cityName.toUpperCase()}.\n` +
        `OBJETO: ${objeto}.\n` +
        `VALOR DE REPASSE FEDERAL: ${fmtBRL(valorRep)}.\n` +
        `CONTRAPARTIDA MUNICIPAL: ${fmtBRL(contrap)}.\n` +
        `VALOR TOTAL: ${fmtBRL(total)}.\n` +
        `VIGÊNCIA: ${vigencia} meses.\n` +
        `FUNDAMENTO LEGAL: Lei nº 8.666/93, Decreto nº 6.170/2007, Portaria Interministerial nº 424/2016 e Instrução Normativa STN nº 01/97.`

      const fullPageContext = `DIÁRIO OFICIAL DE ${cityName.toUpperCase()} - SECRETARIA MUNICIPAL DE OBRAS - EXTRATO DE CONTRATO DE REPASSE. Publicação por força do Art. 61, parágrafo único, da Lei 8.666/93. [excerpt]. ${cityName}, ${data.ext}.`

      samples.push({
        id,
        fiscalId: 'fiscal-convenios',
        category: 'fp_replica',
        fpPattern: `contrato_repasse_federal_${sigla.toLowerCase()}`,
        type: 'convenio_sem_chamamento',
        expectedOutcome: 'no_finding',
        source: 'synthetic',
        syntheticGazette: { cityId, cityName, date: data.iso, excerpt, fullPageContext },
        rationale: `Transferência voluntária União → Município intermediada pela CAIXA (mandatária do ${sigla}), regida por Lei 8.666/93, Decreto 6.170/2007 e IN STN 01/97 — NÃO pela Lei 13.019/2014. Não há OSC envolvida; partes são entes federativos. Réplica do padrão GS-056..097 do golden set real.`,
        shouldTriggerAfterPatch: false,
        filterRule: `ADR-001 patch 1 — Whitelist de siglas federais: regex \`CONTRATO\\s+DE\\s+REPASSE.*N[º°]\\s*\\d+.*\\/(${sigla})\\/CAIXA?\\b\` deve excluir.`,
      })
    }
  }
}

// ============================================================================
// 3) 25 FP — Decreto orçamentário (suplementação + crédito adicional + Lei 4.320)
// ============================================================================
function genFPDecretosOrcamentarios(n) {
  const tipos = [
    'CRÉDITO ADICIONAL SUPLEMENTAR',
    'CRÉDITO ADICIONAL ESPECIAL',
    'SUPLEMENTAÇÃO DE DOTAÇÃO ORÇAMENTÁRIA',
    'ABERTURA DE CRÉDITO ADICIONAL',
  ]
  const destinos = [
    'execução de convênio com a Universidade Federal',
    'cobertura de convênio com Hospital Filantrópico',
    'execução de convênio com a Fundação Municipal de Cultura',
    'reforço da fonte 0124 - Convênios Federais',
    'manutenção de transferências voluntárias da União',
    'execução de convênio com a Universidade Estadual',
    'reforço de dotações para repasse a entidades conveniadas',
    'cobertura da fonte 0142 - Convênios Estaduais',
  ]
  for (let i = 0; i < n; i++) {
    const seed = synSeed++
    const [cityId, cityName] = pick(CITIES, seed)
    const tipo = pick(tipos, seed + 1)
    const destino = pick(destinos, seed + 2)
    const data = syntheticDate(seed)
    const valor = syntheticValor(seed, 'decretoSupl')
    const ano = data.iso.slice(0, 4)
    const nroDec = `${10000 + (seed % 90000)}`
    const leiAutoriz = `${7000 + (seed % 2000)}/${ano}`

    counterFP++
    const id = `SYN-CONV-FP-${String(counterFP).padStart(3, '0')}`

    const excerpt = `DECRETO Nº ${nroDec}, DE ${data.ext.toUpperCase()}.\n` +
      `Abre ${tipo} no valor de ${fmtBRL(valor)} em favor de diversas Unidades Orçamentárias da Administração Direta para reforço de dotações destinadas a ${destino}, fonte de recursos ${pick(['0100', '0124', '0142', '0190'], seed)}, conforme Plano Plurianual.\n` +
      `O PREFEITO MUNICIPAL DE ${cityName.toUpperCase()}, no uso das atribuições que lhe são conferidas pela Lei Orgânica e tendo em vista o disposto no Art. 43 da Lei nº 4.320/64, na Lei nº 9.452/97 e na Lei Municipal nº ${leiAutoriz} (Lei Orçamentária Anual),\n` +
      `DECRETA:\n` +
      `Art. 1º Fica aberto crédito adicional ${tipo.toLowerCase().includes('especial') ? 'especial' : 'suplementar'} no valor de ${fmtBRL(valor)}.\n` +
      `Art. 2º Os recursos necessários à abertura do crédito decorrem do superávit financeiro apurado no balanço patrimonial do exercício anterior.`

    const fullPageContext = `DIÁRIO OFICIAL DO MUNICÍPIO DE ${cityName.toUpperCase()} - PODER EXECUTIVO - SECRETARIA MUNICIPAL DA CASA CIVIL. ATOS DO PREFEITO. [excerpt]. Anexo I - Detalhamento das fontes e aplicações. ${cityName}, ${data.ext}.`

    samples.push({
      id,
      fiscalId: 'fiscal-convenios',
      category: 'fp_replica',
      fpPattern: 'decreto_orcamentario_credito_adicional',
      type: 'convenio_sem_chamamento',
      expectedOutcome: 'no_finding',
      source: 'synthetic',
      syntheticGazette: { cityId, cityName, date: data.iso, excerpt, fullPageContext },
      rationale: `Ato é DECRETO ORÇAMENTÁRIO de abertura de ${tipo.toLowerCase()} (Art. 43 Lei 4.320/64, Lei 9.452/97), não instrumento de transferência voluntária. A palavra 'convênio' aparece apenas como referência ao destino orçamentário, não como instrumento celebrado. Réplica do padrão GS-017/094 do golden set real.`,
      shouldTriggerAfterPatch: false,
      filterRule: `ADR-001 patch 7 — Exclusão de decreto orçamentário: regex \`CRÉDITO\\s+(ADICIONAL\\s+)?(SUPLEMENTAR|ESPECIAL)|abertura\\s+de\\s+crédito|Lei\\s+4\\.320|Lei\\s+9\\.452\\b\` deve excluir.`,
    })
  }
}

// ============================================================================
// 4) 25 FP — Aditivo a TC vigente
// ============================================================================
function genFPAditivosTC(n) {
  const ordinais = ['PRIMEIRO', 'SEGUNDO', 'TERCEIRO']
  for (let i = 0; i < n; i++) {
    const seed = synSeed++
    const [cityId, cityName] = pick(CITIES, seed)
    const ordinal = pick(ordinais, seed + 1) // distribui entre 1º, 2º, 3º
    const sec = pick(SECRETARIAS, seed + 2)
    const osc = pick(OSCS_TERCEIRO_SETOR, seed + 3)
    const c = cnpj(seed + 4)
    const data = syntheticDate(seed)
    const ano = data.iso.slice(0, 4)
    const anoOrigem = String(parseInt(ano) - 1 - (seed % 2))
    const nroOrigem = String(1 + (seed % 80)).padStart(3, '0')
    const valorAcr = syntheticValor(seed, 'aditivoBase')
    const cpNro = String(1 + (seed % 30)).padStart(3, '0')
    const objetivo = pick([
      'prorrogação da vigência por mais 12 meses',
      'acréscimo do valor original em 20% (vinte por cento), conforme Plano de Trabalho aditivado',
      'reajuste pelo IPCA acumulado no período',
      'prorrogação da vigência por 6 meses e acréscimo de 15% no valor',
      'inclusão de novas metas no Plano de Trabalho original',
    ], seed + 5)
    const tipoOrigem = pick(['TERMO DE COLABORAÇÃO', 'TERMO DE FOMENTO'], seed + 6)

    counterFP++
    const id = `SYN-CONV-FP-${String(counterFP).padStart(3, '0')}`

    const excerpt = `EXTRATO DO ${ordinal} TERMO ADITIVO AO ${tipoOrigem} Nº ${nroOrigem}/${anoOrigem}\n` +
      `PARTES: MUNICÍPIO DE ${cityName.toUpperCase()}, por meio da ${sec}, e a ${osc}, CNPJ ${c}.\n` +
      `OBJETO DO ADITIVO: ${objetivo}.\n` +
      `${valorAcr ? `VALOR DO ACRÉSCIMO: ${fmtBRL(valorAcr)}.` : ''}\n` +
      `FUNDAMENTO LEGAL: Lei nº 13.019/2014, Art. 57, com redação dada pela Lei nº 13.204/2015.\n` +
      `O ${tipoOrigem.toLowerCase()} original foi celebrado mediante o procedimento de chamamento público nº ${cpNro}/${anoOrigem}, homologado em sua publicação originária. As condições não modificadas pelo presente aditivo permanecem em pleno vigor.\n` +
      `DATA DE ASSINATURA: ${data.br}.`

    const fullPageContext = `DIÁRIO OFICIAL DO MUNICÍPIO DE ${cityName.toUpperCase()} - ${sec.toUpperCase()} - EXTRATOS DE ADITIVOS. [excerpt]. ${cityName}, ${data.ext}.`

    samples.push({
      id,
      fiscalId: 'fiscal-convenios',
      category: 'fp_replica',
      fpPattern: 'aditivo_termo_colaboracao_origem_chamamento',
      type: 'convenio_sem_chamamento',
      expectedOutcome: 'no_finding',
      source: 'synthetic',
      syntheticGazette: { cityId, cityName, date: data.iso, excerpt, fullPageContext },
      rationale: `${ordinal} Termo Aditivo a ${tipoOrigem} VIGENTE, cujo chamamento público (nº ${cpNro}/${anoOrigem}) ocorreu na origem. Aditivo é regido pelo Art. 57 da Lei 13.019/2014 — não exige novo chamamento. O documento referencia explicitamente o chamamento de origem. Não há irregularidade.`,
      shouldTriggerAfterPatch: false,
      filterRule: `ADR-001 patch 6 — Detector de chamamento referenciado: 'chamamento público nº' aparece no documento. Adicionalmente: detector de aditivo (regex \`TERMO\\s+ADITIVO\\s+AO\\s+(TERMO\\s+DE\\s+(FOMENTO|COLABORAÇÃO))\`) deve neutralizar — aditivo herda a regularidade do principal.`,
    })
  }
}

// ============================================================================
// 5) 20 FP — Contrapartes não-OSC
// ============================================================================
function genFPContrapartesNaoOSC(n) {
  for (let i = 0; i < n; i++) {
    const seed = synSeed++
    const [cityId, cityName, uf] = pick(CITIES, seed)
    const [contraparteUC, contrParteCat, qualificador] = pick(CONTRAPARTES_NAO_OSC, seed + 1)
    const sec = pick(SECRETARIAS, seed + 2)
    const data = syntheticDate(seed)
    const ano = data.iso.slice(0, 4)
    const valor = syntheticValor(seed, 'oscGrande')
    const vigencia = pick([12, 18, 24, 36], seed + 4)
    const nro = String(1 + (seed % 60)).padStart(3, '0')

    let nomeCheio
    if (contraparteUC === 'UNIVERSIDADE FEDERAL') nomeCheio = `UNIVERSIDADE FEDERAL DO ${pick(['RIO GRANDE DO SUL - UFRGS', 'RIO DE JANEIRO - UFRJ', 'PARANÁ - UFPR', 'CEARÁ - UFC', 'PERNAMBUCO - UFPE', 'BAHIA - UFBA', 'PARÁ - UFPA', 'AMAZONAS - UFAM'], seed + 5)}`
    else if (contraparteUC === 'UNIVERSIDADE ESTADUAL') nomeCheio = `UNIVERSIDADE ESTADUAL ${pick(['DE CAMPINAS - UNICAMP', 'PAULISTA - UNESP', 'DO RIO DE JANEIRO - UERJ', 'DO CEARÁ - UECE', 'DE LONDRINA - UEL'], seed + 5)}`
    else if (contraparteUC === 'HOSPITAL UNIVERSITÁRIO') nomeCheio = `HOSPITAL UNIVERSITÁRIO ${pick(['PROFESSOR EDGARD SANTOS', 'CLEMENTINO FRAGA FILHO', 'ANTÔNIO PEDRO', 'WALTER CANTÍDIO'], seed + 5)}`
    else if (contraparteUC === 'SANTA CASA DE MISERICÓRDIA') nomeCheio = `SANTA CASA DE MISERICÓRDIA DE ${cityName.toUpperCase()}`
    else if (contraparteUC === 'IRMANDADE PIO SODALÍCIO DA NOSSA SENHORA') nomeCheio = `IRMANDADE PIO SODALÍCIO DA NOSSA SENHORA DA CONCEIÇÃO`
    else if (contraparteUC === 'BENEFICÊNCIA HOSPITALAR DE CESÁRIO LANGE') nomeCheio = `BENEFICÊNCIA HOSPITALAR DE ${cityName.toUpperCase()}`
    else nomeCheio = contraparteUC

    counterFP++
    const id = `SYN-CONV-FP-${String(counterFP).padStart(3, '0')}`

    // Escolha de instrumento: para universidades/fundações públicas, em geral CONVÊNIO simples (Art. 116 Lei 8.666 ou Art. 241 CF + Lei 11.107).
    // Para Santa Casa / filantrópicas hospitalares, frequentemente é Termo de Fomento mas com regime jurídico próprio (Lei 14.820/2024 hospitalar).
    const ehHospitalFilan = ['SANTA CASA DE MISERICÓRDIA', 'IRMANDADE PIO SODALÍCIO DA NOSSA SENHORA', 'BENEFICÊNCIA HOSPITALAR DE CESÁRIO LANGE'].includes(contraparteUC)
    const instrumento = ehHospitalFilan ? 'TERMO DE COLABORAÇÃO' : 'CONVÊNIO'
    const fundamento = ehHospitalFilan
      ? 'Lei nº 14.820/2024 (regime jurídico específico para entidades filantrópicas e beneficentes na área da saúde) c/c Lei nº 13.019/2014, com dispensa de chamamento público fundamentada na natureza singular da contraparte (entidade filantrópica certificada CEBAS)'
      : 'Art. 116 da Lei nº 8.666/93, Art. 241 da Constituição Federal, Lei nº 11.107/2005 (consórcios públicos) e legislação correlata'

    const objeto = ehHospitalFilan
      ? 'cooperação para prestação de serviços hospitalares de média e alta complexidade integrados ao SUS'
      : pick([
          'cooperação técnica para realização de pesquisa científica aplicada à gestão municipal',
          'cooperação técnica para apoio à formação continuada de servidores municipais',
          'cooperação técnica para gestão compartilhada de programa de saúde pública',
          'cooperação técnica para diagnóstico socioambiental do município',
        ], seed + 6)

    const excerpt = `EXTRATO DE ${instrumento} Nº ${nro}/${ano}\n` +
      `Processo SEI nº ${1000 + seed % 9000}.${ano}/00${seed % 100000}-${seed % 10}.\n` +
      `PARTES: MUNICÍPIO DE ${cityName.toUpperCase()}, por meio da ${sec}, e a ${nomeCheio}, ${qualificador}.\n` +
      `OBJETO: ${objeto}.\n` +
      `VALOR: ${fmtBRL(valor)}.\n` +
      `VIGÊNCIA: ${vigencia} meses.\n` +
      `FUNDAMENTO LEGAL: ${fundamento}.\n` +
      `DATA DE ASSINATURA: ${data.br}.`

    const fullPageContext = `DIÁRIO OFICIAL DO MUNICÍPIO DE ${cityName.toUpperCase()} - ${sec.toUpperCase()} - EXTRATOS. [excerpt]. ${cityName}, ${data.ext}.`

    samples.push({
      id,
      fiscalId: 'fiscal-convenios',
      category: 'fp_replica',
      fpPattern: ehHospitalFilan ? 'contraparte_hospital_filantropico_lei_14820' : 'contraparte_nao_osc_administracao_indireta',
      type: 'convenio_sem_chamamento',
      expectedOutcome: 'no_finding',
      source: 'synthetic',
      syntheticGazette: { cityId, cityName, date: data.iso, excerpt, fullPageContext },
      rationale: `Contraparte é ${nomeCheio} — ${qualificador}. ${ehHospitalFilan ? 'Hospital filantrópico/beneficente regido pela Lei nº 14.820/2024 (regime próprio), distinto do regime geral da Lei 13.019/2014 — NÃO se aplica exigência de chamamento público da Lei 13.019.' : 'Contraparte da Administração Indireta ou autarquia (universidade pública / fundação pública / hospital universitário) — Lei 13.019/2014 é restrita a OSC do terceiro setor (Art. 2º, I); cooperações entre entes públicos seguem Art. 241 CF e Lei 11.107/2005.'} Réplica do padrão GS-055/094 do golden set real.`,
      shouldTriggerAfterPatch: false,
      filterRule: ehHospitalFilan
        ? `ADR-001 patch 8 (proposto) — Detector de regime hospitalar filantrópico: regex \`Lei\\s+(n[º°]\\s*)?14\\.?820|CEBAS|Santa\\s+Casa|Pio\\s+Sodalício|Beneficência\\s+Hospitalar|filantrópic[ao]\\b\` deve excluir.`
        : `ADR-001 patch 3 — Excluir contrapartes não-OSC: regex \`universidade\\s+(federal|estadual)|UF[A-Z]{2,4}|UN[A-Z]{3,5}|fundação\\s+(municipal|estadual|federal)|hospital\\s+universitário|autarquia\\b\` deve excluir.`,
    })
  }
}

// ============================================================================
// 6) 15 FP — Polaridade negativa (rescisão / não poderá renovar)
// ============================================================================
function genFPPolaridadeNegativa(n) {
  const tiposAto = [
    {
      modelo: 'rescisao',
      template: (ctx) => `DECRETO Nº ${ctx.nroDec}, DE ${ctx.data.ext.toUpperCase()}.\n` +
        `Dispõe sobre a rescisão do ${ctx.tipoOrigem} nº ${ctx.nroOrigem}/${ctx.anoOrigem} celebrado com a OSC ${ctx.osc} e determina sua substituição por procedimento licitatório.\n` +
        `O PREFEITO MUNICIPAL DE ${ctx.cityName.toUpperCase()}, considerando o Relatório de Auditoria Interna nº ${ctx.audit}/${ctx.ano} que apontou inconsistências na prestação de contas, DECRETA:\n` +
        `Art. 1º Fica RESCINDIDO o ${ctx.tipoOrigem} nº ${ctx.nroOrigem}/${ctx.anoOrigem}.\n` +
        `Art. 2º A OSC NÃO PODERÁ ter o ${ctx.tipoOrigem} renovado nem celebrar novo instrumento congênere com este Município pelo prazo de ${pick([3, 5], ctx.seed)} (${pick(['três', 'cinco'], ctx.seed)}) anos.\n` +
        `Art. 3º O serviço será prestado, doravante, mediante processo licitatório a ser deflagrado pela ${ctx.sec} no prazo de 60 dias.`
    },
    {
      modelo: 'denuncia_unilateral',
      template: (ctx) => `EXTRATO DE TERMO DE DENÚNCIA UNILATERAL\n` +
        `${ctx.tipoOrigem} Nº ${ctx.nroOrigem}/${ctx.anoOrigem}.\n` +
        `PARTES: MUNICÍPIO DE ${ctx.cityName.toUpperCase()} e ${ctx.osc}.\n` +
        `O Município, com fundamento no Art. 42, XVI da Lei 13.019/2014 e na cláusula décima do termo, DENUNCIA UNILATERALMENTE o ajuste, encerrando-o em ${ctx.data.br}.\n` +
        `A OSC NÃO PODERÁ pleitear a continuidade do repasse, devendo apresentar a prestação de contas final no prazo de 30 dias. Não haverá renovação nem celebração de novo termo congênere.`
    },
    {
      modelo: 'nao_renovacao',
      template: (ctx) => `EXTRATO DE NOTIFICAÇÃO DE NÃO RENOVAÇÃO\n` +
        `${ctx.tipoOrigem} Nº ${ctx.nroOrigem}/${ctx.anoOrigem}.\n` +
        `O Município de ${ctx.cityName} comunica que o ${ctx.tipoOrigem} firmado com ${ctx.osc} NÃO SERÁ renovado ao término de sua vigência (${ctx.data.br}).\n` +
        `Não haverá novo chamamento público para o objeto, que passará a ser executado por equipe própria do Município. A OSC NÃO PODERÁ celebrar novo Termo de Colaboração para este objeto.`
    },
  ]
  for (let i = 0; i < n; i++) {
    const seed = synSeed++
    const [cityId, cityName] = pick(CITIES, seed)
    const tipoAto = pick(tiposAto, seed + 1)
    const osc = pick(OSCS_TERCEIRO_SETOR, seed + 2)
    const sec = pick(SECRETARIAS, seed + 3)
    const data = syntheticDate(seed)
    const ano = data.iso.slice(0, 4)
    const anoOrigem = String(parseInt(ano) - 1 - (seed % 3))
    const ctx = {
      cityName,
      osc,
      sec,
      data,
      ano,
      anoOrigem,
      tipoOrigem: pick(['Termo de Colaboração', 'Termo de Fomento'], seed + 4),
      nroOrigem: String(1 + (seed % 60)).padStart(3, '0'),
      nroDec: `${10000 + (seed % 80000)}`,
      audit: String(40 + (seed % 60)).padStart(3, '0'),
      seed,
    }

    counterFP++
    const id = `SYN-CONV-FP-${String(counterFP).padStart(3, '0')}`

    const excerpt = tipoAto.template(ctx)
    const fullPageContext = `DIÁRIO OFICIAL DO MUNICÍPIO DE ${cityName.toUpperCase()} - ATOS DO PREFEITO. [excerpt]. ${cityName}, ${data.ext}.`

    samples.push({
      id,
      fiscalId: 'fiscal-convenios',
      category: 'fp_replica',
      fpPattern: `polaridade_negativa_${tipoAto.modelo}`,
      type: 'convenio_sem_chamamento',
      expectedOutcome: 'no_finding',
      source: 'synthetic',
      syntheticGazette: { cityId, cityName, date: data.iso, excerpt, fullPageContext },
      rationale: `Ato veicula movimento FAVORÁVEL à conformidade — ${tipoAto.modelo === 'rescisao' ? 'rescinde termo existente e determina substituição por licitação' : tipoAto.modelo === 'denuncia_unilateral' ? 'denuncia unilateralmente o ajuste com fundamento legal expresso' : 'comunica não-renovação ao término da vigência'}. Polaridade negativa explícita ('NÃO PODERÁ', 'NÃO SERÁ renovado'). Réplica direta do padrão GS-096 do golden set real.`,
      shouldTriggerAfterPatch: false,
      filterRule: `ADR-001 patch 4 — Detector de polaridade negativa: 'não\\s+(poderá|será|deverá)\\b' aparece a < 100 chars do termo gatilho ('${ctx.tipoOrigem}'). Adicionalmente verbos negativos: 'rescindido|denuncia|não renovado'.`,
    })
  }
}

// ============================================================================
// 7) 15 FP — Acordo de Cooperação SEM repasse
// ============================================================================
function genFPAcordoCooperacao(n) {
  for (let i = 0; i < n; i++) {
    const seed = synSeed++
    const [cityId, cityName] = pick(CITIES, seed)
    const sec = pick(SECRETARIAS, seed + 1)
    const osc = pick(OSCS_TERCEIRO_SETOR, seed + 2)
    const c = cnpj(seed + 3)
    const data = syntheticDate(seed)
    const ano = data.iso.slice(0, 4)
    const vigencia = pick([12, 18, 24], seed + 4)
    const nro = String(1 + (seed % 50)).padStart(3, '0')
    const objeto = pick([
      'cooperação técnica para realização de oficinas de leitura voluntárias em escolas municipais',
      'cooperação para campanhas de adoção responsável de animais de companhia',
      'cooperação técnica para palestras de prevenção em escolas, sem custos para o Município',
      'apoio recíproco para realização de eventos culturais públicos sem transferência de recursos',
      'cooperação para mapeamento socioassistencial em comunidade-piloto, com cessão recíproca de pessoal',
    ], seed + 5)

    counterFP++
    const id = `SYN-CONV-FP-${String(counterFP).padStart(3, '0')}`

    const excerpt = `EXTRATO DO ACORDO DE COOPERAÇÃO TÉCNICA Nº ${nro}/${ano}\n` +
      `PARTES: MUNICÍPIO DE ${cityName.toUpperCase()}, por meio da ${sec}, e a ${osc}, CNPJ ${c}.\n` +
      `OBJETO: ${objeto}.\n` +
      `VALOR: NÃO HÁ REPASSE FINANCEIRO. Cada partícipe arca com seus próprios custos operacionais.\n` +
      `VIGÊNCIA: ${vigencia} meses.\n` +
      `FUNDAMENTO LEGAL: Art. 116 da Lei nº 8.666/93 e Lei nº 13.019/2014, Art. 2º, VIII-A (Acordo de Cooperação) c/c Art. 29 (dispensa de chamamento público por ausência de transferência de recursos).\n` +
      `DATA DE ASSINATURA: ${data.br}.`

    const fullPageContext = `DIÁRIO OFICIAL DO MUNICÍPIO DE ${cityName.toUpperCase()} - ${sec.toUpperCase()} - EXTRATOS. [excerpt]. ${cityName}, ${data.ext}.`

    samples.push({
      id,
      fiscalId: 'fiscal-convenios',
      category: 'fp_replica',
      fpPattern: 'acordo_cooperacao_sem_repasse',
      type: 'convenio_sem_chamamento',
      expectedOutcome: 'no_finding',
      source: 'synthetic',
      syntheticGazette: { cityId, cityName, date: data.iso, excerpt, fullPageContext },
      rationale: `Acordo de Cooperação Técnica entre Município e OSC, SEM transferência de recursos financeiros. Lei 13.019/2014, Art. 29, dispensa expressamente chamamento público para Acordos de Cooperação que não envolvem repasse. Categoria legalmente isenta do gatilho.`,
      shouldTriggerAfterPatch: false,
      filterRule: `ADR-001 patch 2 — Filtro de tipo de instrumento: 'Acordo de Cooperação Técnica' está na lista de exclusão. Adicionalmente: detector secundário 'NÃO HÁ REPASSE FINANCEIRO' / 'sem.*transferência.*recursos' / 'Art\\.?\\s*29' deve neutralizar.`,
    })
  }
}

// ============================================================================
// 8) 10 FP — Apostilamento (revisão por índice)
// ============================================================================
function genFPApostilamento(n) {
  for (let i = 0; i < n; i++) {
    const seed = synSeed++
    const [cityId, cityName] = pick(CITIES, seed)
    const sec = pick(SECRETARIAS, seed + 1)
    const osc = pick(OSCS_TERCEIRO_SETOR, seed + 2)
    const data = syntheticDate(seed)
    const ano = data.iso.slice(0, 4)
    const anoOrigem = String(parseInt(ano) - 1)
    const indices = ['IPCA', 'INPC', 'IGP-M']
    const indice = pick(indices, seed + 3)
    const valorAcr = syntheticValor(seed, 'aditivoBase')
    const tipoOrigem = pick(['TERMO DE COLABORAÇÃO', 'TERMO DE FOMENTO'], seed + 4)
    const nroOrigem = String(1 + (seed % 60)).padStart(3, '0')

    counterFP++
    const id = `SYN-CONV-FP-${String(counterFP).padStart(3, '0')}`

    const excerpt = `EXTRATO DE APOSTILAMENTO\n` +
      `${tipoOrigem} Nº ${nroOrigem}/${anoOrigem}.\n` +
      `PARTES: MUNICÍPIO DE ${cityName.toUpperCase()} e ${osc}.\n` +
      `OBJETO DO APOSTILAMENTO: revisão por reajuste contratual conforme variação do índice ${indice} acumulado em 12 meses (${(2.5 + (seed % 7)).toFixed(2)}%), nos termos da cláusula sexta do termo originário.\n` +
      `VALOR DO REAJUSTE: ${fmtBRL(valorAcr)}.\n` +
      `FUNDAMENTO LEGAL: Lei nº 13.019/2014, Art. 57, §8º (apostilamento — alteração que NÃO modifica o objeto, sendo registro unilateral por simples ato administrativo, dispensada celebração de termo aditivo).\n` +
      `DATA DO REGISTRO: ${data.br}.`

    const fullPageContext = `DIÁRIO OFICIAL DO MUNICÍPIO DE ${cityName.toUpperCase()} - ${sec.toUpperCase()} - APOSTILAMENTOS. [excerpt]. ${cityName}, ${data.ext}.`

    samples.push({
      id,
      fiscalId: 'fiscal-convenios',
      category: 'fp_replica',
      fpPattern: 'apostilamento_reajuste_indice',
      type: 'convenio_sem_chamamento',
      expectedOutcome: 'no_finding',
      source: 'synthetic',
      syntheticGazette: { cityId, cityName, date: data.iso, excerpt, fullPageContext },
      rationale: `Apostilamento — registro unilateral de reajuste por índice (${indice}) sobre termo originário VIGENTE. Não constitui nova celebração nem aditivo; é mero ato de execução contratual previsto na cláusula. Lei 13.019/2014, Art. 57, §8º, dispensa celebração formal. Não há sequer instrumento novo a fiscalizar.`,
      shouldTriggerAfterPatch: false,
      filterRule: `ADR-001 patch 2 + novo patch 9 (proposto) — Filtro de tipo: regex \`APOSTILAMENTO|reajuste\\s+por\\s+índice|IPCA|INPC|IGP-M\` em conjunto com referência a termo originário deve excluir.`,
    })
  }
}

// ============================================================================
// 9) 10 FP — Resolução de Conselho (CMDCA, COMUS — não é celebração)
// ============================================================================
function genFPResolucaoConselho(n) {
  const conselhos = [
    ['CMDCA', 'CONSELHO MUNICIPAL DOS DIREITOS DA CRIANÇA E DO ADOLESCENTE', 'política de atendimento à criança e adolescente'],
    ['COMUS', 'CONSELHO MUNICIPAL DE SAÚDE', 'política municipal de saúde'],
    ['CMAS', 'CONSELHO MUNICIPAL DE ASSISTÊNCIA SOCIAL', 'política de assistência social'],
    ['CMDM', 'CONSELHO MUNICIPAL DOS DIREITOS DA MULHER', 'política para mulheres'],
    ['COMTUR', 'CONSELHO MUNICIPAL DE TURISMO', 'política municipal de turismo'],
    ['CMI', 'CONSELHO MUNICIPAL DO IDOSO', 'política do idoso'],
    ['CMDPD', 'CONSELHO MUNICIPAL DA PESSOA COM DEFICIÊNCIA', 'política de inclusão da pessoa com deficiência'],
  ]
  for (let i = 0; i < n; i++) {
    const seed = synSeed++
    const [cityId, cityName] = pick(CITIES, seed)
    const [sigla, conselhoNome, politica] = pick(conselhos, seed + 1)
    const data = syntheticDate(seed)
    const ano = data.iso.slice(0, 4)
    const nroRes = String(1 + (seed % 50)).padStart(2, '0')

    counterFP++
    const id = `SYN-CONV-FP-${String(counterFP).padStart(3, '0')}`

    const objeto = pick([
      `aprovar diretrizes para celebração de Termos de Colaboração com OSCs voltados ao(à) ${politica}`,
      `recomendar ao Poder Executivo a abertura de chamamento público para fortalecimento da rede de proteção no(a) ${politica}`,
      `aprovar parecer favorável ao plano de ação anual relativo ao(à) ${politica}`,
      `homologar o resultado final do chamamento público nº ${pick(['001', '002', '003'], seed)}/${ano}, no(a) ${politica}`,
    ], seed + 2)

    const excerpt = `RESOLUÇÃO ${sigla} Nº ${nroRes}/${ano}\n` +
      `O ${conselhoNome} de ${cityName}, no uso de suas atribuições legais, em reunião ordinária realizada em ${data.br}, RESOLVE:\n` +
      `Art. 1º ${objeto.charAt(0).toUpperCase() + objeto.slice(1)}.\n` +
      `Art. 2º Esta Resolução entra em vigor na data de sua publicação.`

    const fullPageContext = `DIÁRIO OFICIAL DO MUNICÍPIO DE ${cityName.toUpperCase()} - ${conselhoNome}. [excerpt]. ${cityName}, ${data.ext}.`

    samples.push({
      id,
      fiscalId: 'fiscal-convenios',
      category: 'fp_replica',
      fpPattern: 'resolucao_conselho_municipal',
      type: 'convenio_sem_chamamento',
      expectedOutcome: 'no_finding',
      source: 'synthetic',
      syntheticGazette: { cityId, cityName, date: data.iso, excerpt, fullPageContext },
      rationale: `Resolução de Conselho Municipal (${sigla} - ${conselhoNome}) — ato normativo deliberativo do controle social, NÃO instrumento de transferência. Conselho não celebra termo de fomento; apenas delibera sobre política pública correspondente. Categoria documentalmente distinta do gatilho da Lei 13.019/2014.`,
      shouldTriggerAfterPatch: false,
      filterRule: `ADR-001 patch 2 — Filtro de tipo: regex \`RESOLUÇÃO\\s+(CMDCA|COMUS|CMAS|CMDM|COMTUR|CMI|CMDPD|CONSELHO\\s+MUNICIPAL)\` deve excluir. Padrão "Conselho... resolve" não é celebração.`,
    })
  }
}

// ============================================================================
// 10) Edge cases — 49 amostras
//   10 Termo Fomento COM chamamento referenciado (chamamento a 3 níveis)
//   10 OSCIP com dispensa Art. 30 fundamentada
//   10 Inexigibilidade Art. 31
//   10 Lei 14.820 hospitalar
//    9 Atos de execução
// ============================================================================

// 10.1 — 10 Termo Fomento COM chamamento referenciado (a 3 níveis no PDF)
function genEdgeChamamentoReferenciado(n) {
  for (let i = 0; i < n; i++) {
    const seed = synSeed++
    const [cityId, cityName] = pick(CITIES, seed)
    const sec = pick(SECRETARIAS, seed + 1)
    const osc = pick(OSCS_TERCEIRO_SETOR, seed + 2)
    const c = cnpj(seed + 3)
    const data = syntheticDate(seed)
    const ano = data.iso.slice(0, 4)
    const valor = syntheticValor(seed, 'oscMedio')
    const vigencia = pick([12, 18, 24], seed + 4)
    const nro = String(1 + (seed % 80)).padStart(3, '0')
    const cpNro = String(1 + (seed % 30)).padStart(3, '0')
    const cpDate = syntheticDate(seed - 200) // chamamento anterior
    const tipo = pick(['TERMO DE FOMENTO', 'TERMO DE COLABORAÇÃO'], seed + 5)

    counterEdge++
    const id = `SYN-CONV-FP-EDGE-${String(counterEdge).padStart(3, '0')}`

    // Referência ao chamamento no fim do excerpt (3º nível textual)
    const excerpt = `EXTRATO DO ${tipo} Nº ${nro}/${ano}\n` +
      `PARTES: MUNICÍPIO DE ${cityName.toUpperCase()}, por meio da ${sec}, e ${osc}, CNPJ ${c}.\n` +
      `OBJETO: ${pick(OBJETOS_OSC, seed + 6)}.\n` +
      `VALOR: ${fmtBRL(valor)}.\n` +
      `VIGÊNCIA: ${vigencia} meses.\n` +
      `FUNDAMENTO LEGAL: Lei nº 13.019/2014.\n` +
      `DOTAÇÃO ORÇAMENTÁRIA: ${pick(['08.244', '13.392', '10.301'], seed)}.0050.4321.\n` +
      `DATA DE ASSINATURA: ${data.br}.`

    const fullPageContext = `DIÁRIO OFICIAL DO MUNICÍPIO DE ${cityName.toUpperCase()} - ${sec.toUpperCase()} - EXTRATOS. ` +
      `O Secretário Municipal torna público o extrato. [excerpt]. ` +
      `O presente termo decorre do procedimento de Chamamento Público nº ${cpNro}/${parseInt(ano) - 1}, ` +
      `cujo Edital foi publicado no Diário Oficial de ${cpDate.br} e cujo resultado de habilitação e seleção foi homologado em ${cpDate.ext}, ` +
      `processo administrativo nº ${1000 + seed % 9000}.${parseInt(ano) - 1}/00${seed % 100000}-${seed % 10}. ` +
      `O Plano de Trabalho aprovado pela Comissão de Seleção é parte integrante do termo. ${cityName}, ${data.ext}.`

    samples.push({
      id,
      fiscalId: 'fiscal-convenios',
      category: 'fp_edge_case',
      fpPattern: 'termo_fomento_com_chamamento_referenciado_3_niveis',
      type: 'convenio_sem_chamamento',
      expectedOutcome: 'no_finding',
      source: 'synthetic',
      syntheticGazette: { cityId, cityName, date: data.iso, excerpt, fullPageContext },
      rationale: `Edge case: Termo de Fomento Lei 13.019 com OSC, mas a referência ao chamamento público (nº ${cpNro}/${parseInt(ano) - 1}) está APENAS no fullPageContext (não no excerpt), simulando o caso real em que o chamamento é citado a 2-3 níveis dentro do PDF (em rodapé, em página seguinte, ou após o extrato propriamente dito). Testa que o Fiscal lê o documento INTEIRO, não só o excerpt.`,
      shouldTriggerAfterPatch: false,
      filterRule: `ADR-001 patch 6 — Detector de chamamento referenciado: buscar 'chamamento' no documento INTEIRO (excerpt + fullPageContext + páginas adjacentes do PDF). Se encontrado em qualquer nível, reduzir confidence em 0,3.`,
    })
  }
}

// 10.2 — 10 OSCIP com dispensa Art. 30 fundamentada
function genEdgeOSCIPArt30(n) {
  const fundamentos30 = [
    { inciso: 'I', motivo: 'situação de urgência decorrente de calamidade pública', justifica: 'Decreto Municipal de declaração de calamidade pública' },
    { inciso: 'I', motivo: 'situação de urgência decorrente de emergência sanitária', justifica: 'Decreto Estadual de emergência em saúde pública' },
    { inciso: 'II', motivo: 'guerra, grave perturbação da ordem pública ou ameaça à paz social', justifica: 'reconhecimento formal pela autoridade competente' },
    { inciso: 'III', motivo: 'subvenção a entidade já participante anteriormente, em estrito cumprimento de programa nacional', justifica: 'previsão expressa no programa federal SUAS' },
    { inciso: 'VI', motivo: 'objeto da parceria estar inserido em programa nacional ou setorial executado em rede com a OSC já cadastrada', justifica: 'inserção formal da OSC em rede SUAS de proteção social' },
  ]
  for (let i = 0; i < n; i++) {
    const seed = synSeed++
    const [cityId, cityName] = pick(CITIES, seed)
    const sec = pick(SECRETARIAS, seed + 1)
    const osc = pick(OSCS_TERCEIRO_SETOR, seed + 2)
    const c = cnpj(seed + 3)
    const fund = pick(fundamentos30, seed + 4)
    const data = syntheticDate(seed)
    const ano = data.iso.slice(0, 4)
    const valor = syntheticValor(seed, seed % 2 === 0 ? 'oscMedio' : 'oscGrande')
    const vigencia = pick([6, 12, 18], seed + 5)
    const nro = String(1 + (seed % 60)).padStart(3, '0')
    const parecer = String(1 + (seed % 50)).padStart(3, '0')

    counterEdge++
    const id = `SYN-CONV-FP-EDGE-${String(counterEdge).padStart(3, '0')}`

    const excerpt = `EXTRATO DO TERMO DE COLABORAÇÃO Nº ${nro}/${ano}\n` +
      `PARTES: MUNICÍPIO DE ${cityName.toUpperCase()}, por meio da ${sec}, e a ${osc} - OSCIP, CNPJ ${c}, qualificada como Organização da Sociedade Civil de Interesse Público nos termos da Lei nº 9.790/99 e pela Lei nº 13.019/2014.\n` +
      `OBJETO: ${pick(OBJETOS_OSC, seed + 6)}.\n` +
      `VALOR: ${fmtBRL(valor)}.\n` +
      `VIGÊNCIA: ${vigencia} meses.\n` +
      `FUNDAMENTO LEGAL: Lei nº 13.019/2014, com DISPENSA DE CHAMAMENTO PÚBLICO nos termos do Art. 30, inciso ${fund.inciso} (${fund.motivo}), conforme Parecer Jurídico PGM nº ${parecer}/${ano} e ${fund.justifica}.\n` +
      `DATA DE ASSINATURA: ${data.br}.`

    const fullPageContext = `DIÁRIO OFICIAL DO MUNICÍPIO DE ${cityName.toUpperCase()} - ${sec.toUpperCase()} - EXTRATOS COM DISPENSA. [excerpt]. ${cityName}, ${data.ext}.`

    samples.push({
      id,
      fiscalId: 'fiscal-convenios',
      category: 'fp_edge_case',
      fpPattern: 'oscip_dispensa_art_30_fundamentada',
      type: 'convenio_sem_chamamento',
      expectedOutcome: 'no_finding',
      source: 'synthetic',
      syntheticGazette: { cityId, cityName, date: data.iso, excerpt, fullPageContext },
      rationale: `Edge case: Termo de Colaboração com OSCIP genuína, MAS dispensa de chamamento expressamente fundamentada no Art. 30, inciso ${fund.inciso} da Lei 13.019/2014 (${fund.motivo}), com Parecer Jurídico PGM nº ${parecer}/${ano} e ${fund.justifica}. Dispensa legal e devidamente motivada — não há irregularidade.`,
      shouldTriggerAfterPatch: false,
      filterRule: `Patch 8 (proposto): Detector de fundamento Art. 30 — se documento contém regex \`Art\\.?\\s*30\\b.*Lei\\s+(n[º°]\\s*)?13\\.?019|dispensa\\s+de\\s+chamamento\\s+público.*Art\\.?\\s*30\` reduzir riskScore em 40 pontos. Detectar inciso e fundamento de fato (Parecer PGM citado).`,
    })
  }
}

// 10.3 — 10 Inexigibilidade Art. 31
function genEdgeInexigibilidade(n) {
  const naturezas = [
    'a OSC é a única apta a atingir o objeto da parceria, em razão de seu caráter singular',
    'as metas só podem ser atingidas pela OSC específica, ante sua especialização técnica notória na área',
    'a entidade detém capacidade técnica e operacional notoriamente diferenciada para o objeto pactuado',
  ]
  const objetos = [
    'manutenção de UPA pediátrica especializada em oncologia infantil',
    'prestação de cuidados paliativos a pacientes com doenças raras',
    'manutenção de programa de cultura tradicional de matriz africana',
    'prestação de atendimento especializado a pessoas em sofrimento mental grave',
    'manutenção de programa cultural histórico-tradicional reconhecido pelo IPHAN',
  ]
  for (let i = 0; i < n; i++) {
    const seed = synSeed++
    const [cityId, cityName] = pick(CITIES, seed)
    const sec = pick(SECRETARIAS, seed + 1)
    const osc = pick(OSCS_TERCEIRO_SETOR, seed + 2)
    const c = cnpj(seed + 3)
    const natureza = pick(naturezas, seed + 4)
    const objeto = pick(objetos, seed + 5)
    const data = syntheticDate(seed)
    const ano = data.iso.slice(0, 4)
    const valor = syntheticValor(seed, 'oscGrande')
    const vigencia = pick([12, 24, 36], seed + 6)
    const nro = String(1 + (seed % 60)).padStart(3, '0')
    const parecer = String(1 + (seed % 50)).padStart(3, '0')

    counterEdge++
    const id = `SYN-CONV-FP-EDGE-${String(counterEdge).padStart(3, '0')}`

    const excerpt = `EXTRATO DO TERMO DE COLABORAÇÃO Nº ${nro}/${ano}\n` +
      `PARTES: MUNICÍPIO DE ${cityName.toUpperCase()}, por meio da ${sec}, e a ${osc}, CNPJ ${c}.\n` +
      `OBJETO: ${objeto}.\n` +
      `VALOR: ${fmtBRL(valor)}.\n` +
      `VIGÊNCIA: ${vigencia} meses.\n` +
      `FUNDAMENTO LEGAL: Lei nº 13.019/2014, com INEXIGIBILIDADE de chamamento público nos termos do Art. 31, considerando-se que ${natureza}. Parecer Jurídico PGM nº ${parecer}/${ano} ratifica a inviabilidade de competição. Justificativa pública publicada no Diário Oficial de ${data.br} e arquivada no processo administrativo de origem.\n` +
      `DATA DE ASSINATURA: ${data.br}.`

    const fullPageContext = `DIÁRIO OFICIAL DO MUNICÍPIO DE ${cityName.toUpperCase()} - ${sec.toUpperCase()} - EXTRATOS DE INEXIGIBILIDADE. [excerpt]. ${cityName}, ${data.ext}.`

    samples.push({
      id,
      fiscalId: 'fiscal-convenios',
      category: 'fp_edge_case',
      fpPattern: 'inexigibilidade_art_31',
      type: 'convenio_sem_chamamento',
      expectedOutcome: 'no_finding',
      source: 'synthetic',
      syntheticGazette: { cityId, cityName, date: data.iso, excerpt, fullPageContext },
      rationale: `Edge case: Termo de Colaboração com OSC, mas com inexigibilidade de chamamento público fundamentada no Art. 31 da Lei 13.019/2014 — caráter singular do objeto / especialização técnica notória. Justificativa publicada no DO + Parecer PGM. Hipótese legal expressa, distinta da dispensa do Art. 30.`,
      shouldTriggerAfterPatch: false,
      filterRule: `Patch 8 (proposto, ampliado): Detector de fundamento Art. 31 — se documento contém regex \`Art\\.?\\s*31\\b.*Lei\\s+(n[º°]\\s*)?13\\.?019|inexigibilidade\\s+de\\s+chamamento\` deve neutralizar finding ou reduzir riskScore em 50 pontos.`,
    })
  }
}

// 10.4 — 10 Lei 14.820 hospitalar — força data ≥ 2024-02 (Lei é de 16/01/2024)
function genEdgeLei14820(n) {
  for (let i = 0; i < n; i++) {
    const seed = synSeed++
    const [cityId, cityName] = pick(CITIES, seed)
    const sec = pick(['Secretaria Municipal de Saúde', 'Secretaria Municipal da Saúde'], seed + 1)
    const hospital = pick([
      `SANTA CASA DE MISERICÓRDIA DE ${cityName.toUpperCase()}`,
      `IRMANDADE DA SANTA CASA DE ${cityName.toUpperCase()}`,
      `HOSPITAL FILANTRÓPICO SÃO VICENTE DE PAULO`,
      `HOSPITAL BENEFICENTE NOSSA SENHORA APARECIDA`,
      `BENEFICÊNCIA HOSPITALAR PORTUGUESA`,
      `HOSPITAL FILANTRÓPICO ESPÍRITA DE ${cityName.toUpperCase()}`,
    ], seed + 2)
    const c = cnpj(seed + 3)
    // Distribui datas em 2024-02, 2024-08, 2025-Q1..Q4, 2026-Q1..Q2 para validade pós-Lei
    const anosLei = [2024, 2024, 2025, 2025, 2025, 2025, 2026, 2026, 2024, 2026]
    const mesesLei = [2, 8, 3, 6, 9, 12, 1, 4, 11, 2]
    const yearLei = anosLei[i]
    const monthLei = mesesLei[i]
    const dayLei = 1 + ((seed * 7) % 27)
    const data = dataBR(yearLei, monthLei, dayLei)
    const ano = data.iso.slice(0, 4)
    const valor = syntheticValor(seed, 'repasseGrande')
    const vigencia = pick([12, 24, 36], seed + 4)
    const nro = String(1 + (seed % 50)).padStart(3, '0')
    const cebas = `${10000 + (seed % 90000)}/${parseInt(ano) - 1}`

    counterEdge++
    const id = `SYN-CONV-FP-EDGE-${String(counterEdge).padStart(3, '0')}`

    const excerpt = `EXTRATO DO TERMO DE COLABORAÇÃO Nº ${nro}/${ano}\n` +
      `PARTES: MUNICÍPIO DE ${cityName.toUpperCase()}, por meio da ${sec}, e o ${hospital}, CNPJ ${c}, entidade beneficente de assistência social na área da saúde, certificada CEBAS nº ${cebas}, integrante do Sistema Único de Saúde (SUS).\n` +
      `OBJETO: prestação de serviços hospitalares de média e alta complexidade ambulatorial e hospitalar, integrados à rede SUS, conforme Plano de Saúde Municipal.\n` +
      `VALOR ESTIMADO ANUAL: ${fmtBRL(valor)} (com pagamento por produção, conforme Tabela SUS).\n` +
      `VIGÊNCIA: ${vigencia} meses.\n` +
      `FUNDAMENTO LEGAL: Lei nº 14.820, de 16 de janeiro de 2024 (regime jurídico específico para entidades beneficentes e filantrópicas integrantes do SUS), Lei nº 12.101/2009 (CEBAS), Lei nº 8.080/90 (SUS) e, subsidiariamente, Lei nº 13.019/2014. Dispensa de chamamento público fundamentada na natureza singular da contraparte (entidade filantrópica certificada CEBAS integrante do SUS), conforme Art. 4º, §3º da Lei 14.820/2024.\n` +
      `DATA DE ASSINATURA: ${data.br}.`

    const fullPageContext = `DIÁRIO OFICIAL DO MUNICÍPIO DE ${cityName.toUpperCase()} - ${sec.toUpperCase()} - EXTRATOS COM ENTIDADE FILANTRÓPICA DA SAÚDE. [excerpt]. ${cityName}, ${data.ext}.`

    samples.push({
      id,
      fiscalId: 'fiscal-convenios',
      category: 'fp_edge_case',
      fpPattern: 'lei_14820_hospital_filantropico_sus',
      type: 'convenio_sem_chamamento',
      expectedOutcome: 'no_finding',
      source: 'synthetic',
      syntheticGazette: { cityId, cityName, date: data.iso, excerpt, fullPageContext },
      rationale: `Edge case: Termo de Colaboração com hospital filantrópico CEBAS integrante do SUS, regido pela Lei nº 14.820/2024 — regime jurídico específico que prevalece sobre a Lei 13.019/2014 quanto à exigência de chamamento público. Lei 14.820 reconhece a singularidade das entidades CEBAS na rede SUS e autoriza dispensa fundamentada.`,
      shouldTriggerAfterPatch: false,
      filterRule: `Patch 10 (proposto): Detector de regime hospitalar filantrópico — regex \`Lei\\s+(n[º°]\\s*)?14\\.?820|CEBAS|certificad[oa]\\s+CEBAS|Santa\\s+Casa|filantrópic[ao].*SUS|beneficente.*saúde\` deve excluir ou reduzir confidence drasticamente. Lei 14.820/2024 prevalece sobre Lei 13.019.`,
    })
  }
}

// 10.5 — 9 Atos de execução (restituição, retificação, errata)
function genEdgeAtosExecucao(n) {
  const tiposAto = [
    {
      label: 'restituicao',
      template: (ctx) => `EXTRATO DE RESTITUIÇÃO\n` +
        `${ctx.tipoOrigem} Nº ${ctx.nroOrigem}/${ctx.anoOrigem}.\n` +
        `PARTES: MUNICÍPIO DE ${ctx.cityName.toUpperCase()} e ${ctx.osc}.\n` +
        `OBJETO: restituição ao erário do saldo remanescente de ${fmtBRL(ctx.valor)}, decorrente de execução parcial do Plano de Trabalho, conforme prestação de contas final aprovada com ressalvas pelo Parecer Técnico nº ${ctx.parecer}/${ctx.ano}.\n` +
        `FUNDAMENTO LEGAL: Lei nº 13.019/2014, Art. 70, §2º. Recolhimento por GRU em ${ctx.data.br}.`
    },
    {
      label: 'retificacao',
      template: (ctx) => `RETIFICAÇÃO\n` +
        `Em virtude de erro material, fica retificado o extrato do ${ctx.tipoOrigem} nº ${ctx.nroOrigem}/${ctx.anoOrigem} publicado no Diário Oficial do dia ${ctx.dataOrig.br}, na parte em que se lê: "VALOR: ${fmtBRL(ctx.valorErrado)}", leia-se: "VALOR: ${fmtBRL(ctx.valor)}".\n` +
        `Demais informações permanecem inalteradas. ${ctx.cityName}, ${ctx.data.br}.`
    },
    {
      label: 'errata',
      template: (ctx) => `ERRATA\n` +
        `Na publicação do ${ctx.tipoOrigem} nº ${ctx.nroOrigem}/${ctx.anoOrigem}, ocorrida no Diário Oficial de ${ctx.dataOrig.br}, onde se lê CNPJ ${ctx.cnpjErrado}, leia-se CNPJ ${ctx.cnpjCerto}. Demais cláusulas permanecem inalteradas.`
    },
  ]
  for (let i = 0; i < n; i++) {
    const seed = synSeed++
    const [cityId, cityName] = pick(CITIES, seed)
    const tipoAto = pick(tiposAto, seed + 1)
    const osc = pick(OSCS_TERCEIRO_SETOR, seed + 2)
    const sec = pick(SECRETARIAS, seed + 3)
    const data = syntheticDate(seed)
    const dataOrig = syntheticDate(seed - 30)
    const ano = data.iso.slice(0, 4)
    const anoOrigem = String(parseInt(ano) - 1)
    const ctx = {
      cityName,
      osc,
      sec,
      data,
      dataOrig,
      ano,
      tipoOrigem: pick(['Termo de Colaboração', 'Termo de Fomento'], seed + 4),
      nroOrigem: String(1 + (seed % 60)).padStart(3, '0'),
      anoOrigem,
      valor: syntheticValor(seed, 'oscMedio'),
      valorErrado: syntheticValor(seed + 5, 'oscMedio'),
      cnpjErrado: cnpj(seed + 8),
      cnpjCerto: cnpj(seed + 9),
      parecer: String(1 + (seed % 50)).padStart(3, '0'),
    }

    counterEdge++
    const id = `SYN-CONV-FP-EDGE-${String(counterEdge).padStart(3, '0')}`

    const excerpt = tipoAto.template(ctx)
    const fullPageContext = `DIÁRIO OFICIAL DO MUNICÍPIO DE ${cityName.toUpperCase()} - ${sec.toUpperCase()} - ${tipoAto.label === 'restituicao' ? 'RESTITUIÇÕES' : tipoAto.label === 'retificacao' ? 'RETIFICAÇÕES' : 'ERRATAS'}. [excerpt]. ${cityName}, ${data.ext}.`

    samples.push({
      id,
      fiscalId: 'fiscal-convenios',
      category: 'fp_edge_case',
      fpPattern: `ato_execucao_${tipoAto.label}`,
      type: 'convenio_sem_chamamento',
      expectedOutcome: 'no_finding',
      source: 'synthetic',
      syntheticGazette: { cityId, cityName, date: data.iso, excerpt, fullPageContext },
      rationale: `Ato de EXECUÇÃO contratual (${tipoAto.label}) sobre termo já existente — não constitui nova celebração. ${tipoAto.label === 'restituicao' ? 'Saldo remanescente recolhido ao erário, movimento favorável à conformidade (Lei 13.019, Art. 70, §2º).' : tipoAto.label === 'retificacao' ? 'Retificação de erro material em extrato anterior; não cria nem modifica obrigação.' : 'Errata de erro material; não cria nem modifica obrigação.'}`,
      shouldTriggerAfterPatch: false,
      filterRule: `Patch 9 (proposto): Detector de atos de execução — regex \`RESTITUIÇÃO|RETIFICAÇÃO|ERRATA|onde\\s+se\\s+lê\` no início do excerpt deve excluir do gatilho. Atos derivados não constituem nova celebração.`,
    })
  }
}

// ----------------------------------------------------------------------------
// EXECUÇÃO

genTPTextbook(40)                         // 40 TP
genFPRepasses()                           // 30 FP repasses (5+5+5+3+3+3+3+3 = 30)
genFPDecretosOrcamentarios(25)            // 25 FP decretos
genFPAditivosTC(25)                       // 25 FP aditivos
genFPContrapartesNaoOSC(20)               // 20 FP não-OSC
genFPPolaridadeNegativa(15)               // 15 FP polaridade
genFPAcordoCooperacao(15)                 // 15 FP acordo cooperação
genFPApostilamento(10)                    // 10 FP apostilamento
genFPResolucaoConselho(10)                // 10 FP resolução conselho
genEdgeChamamentoReferenciado(10)         // 10 edge chamamento ref
genEdgeOSCIPArt30(10)                     // 10 edge OSCIP Art 30
genEdgeInexigibilidade(10)                // 10 edge inexigibilidade Art 31
genEdgeLei14820(10)                       // 10 edge Lei 14.820
genEdgeAtosExecucao(9)                    // 9 edge atos execução
// total: 40+30+25+25+20+15+15+10+10+10+10+10+10+9 = 239

// Sanidade
const counts = samples.reduce((acc, s) => {
  acc[s.category] = (acc[s.category] || 0) + 1
  return acc
}, {})
const byPattern = samples.reduce((acc, s) => {
  const k = s.fpPattern || s.category
  acc[k] = (acc[k] || 0) + 1
  return acc
}, {})

const outPath = path.resolve(__dirname, 'synthetic-samples-batch2.json')
fs.writeFileSync(outPath, JSON.stringify(samples, null, 2), 'utf8')

console.log(`Wrote ${samples.length} samples to ${outPath}`)
console.log('Counts by category:', counts)
console.log('Counts by pattern:')
for (const [k, v] of Object.entries(byPattern).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k}: ${v}`)
}
