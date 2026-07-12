// ============================================================
// server/widget-nlu.js
// Motor deterministico de interpretacao de comandos em portugues
// para o widget de acessibilidade. Sem dependencia de LLM externa.
//
// O endpoint /backend/v1/widget/command carrega entidades e
// relacionamentos do SAM e compoe estas funcoes puras para classificar
// a intencao do usuario, casar o alvo contra o mapa semantico e montar
// um plano de passos navegavel.
// ============================================================

const STOPWORDS = new Set([
  // artigos / preposicoes / conjuncoes
  'a', 'o', 'as', 'os', 'de', 'da', 'do', 'das', 'dos', 'e', 'ou', 'em', 'no', 'na', 'nos', 'nas',
  'para', 'pra', 'pro', 'pras', 'que', 'com', 'sem', 'por', 'pelo', 'pela', 'aos', 'ao', 'aos',
  'um', 'uma', 'uns', 'umas', 'meu', 'minha', 'meus', 'minhas', 'seu', 'sua', 'seus', 'suas',
  'este', 'esse', 'aquele', 'esta', 'essa', 'aquela', 'isto', 'isso', 'aquilo',
  'the', 'of', 'to', 'in', 'on', 'at', 'and', 'or', 'for', 'with', 'a', 'an',
])

// Substantivos/qualificadores genericos que nao ajudam a casar o alvo.
const FILLER_NOUNS = new Set([
  'tela', 'pag', 'pagina', 'page', 'screen', 'menu', 'parte', 'area', 'lugar', 'coisa', 'item',
])

// Verbo -> intencao. Palavras curtas sao casadas como token exato para evitar
// falsos positivos (ex.: "ir" nao pode casar dentro de "acao").
const INTENT_VERBS = {
  NAVIGATE: [
    'ir', 'va', 'vai', 'vá', 'vas', 'ir', 'chegar', 'levar', 'leve',
    'abrir', 'abre', 'abra', 'entra', 'entrar', 'entre', 'acesse', 'acessar',
    'mostrar', 'mostra', 'mostre', 'ver', 'veja', 'quero', 'desejo', 'preciso',
    'go', 'open', 'show', 'take', 'navigate', 'visit',
  ],
  CLICK: [
    'clicar', 'clica', 'clique', 'apertar', 'aperta', 'aperte', 'pressionar', 'pressione',
    'confirmar', 'confirme', 'acionar', 'ative', 'selecionar', 'selecione', 'tocar', 'tocar',
    'click', 'press', 'tap', 'select', 'hit',
  ],
  FILL: [
    'preencher', 'preenche', 'preencha', 'digitar', 'digita', 'digite', 'escrever', 'escreva',
    'inserir', 'insira', 'colocar', 'coloque', 'informar', 'informe', 'set', 'enter', 'type',
  ],
  HIGHLIGHT: ['destacar', 'destaca', 'destaque', 'realcar', 'realce', 'evidenciar', 'marcar', 'highlight', 'focus', 'focar'],
  READ: ['ler', 'leia', 'le', 'narrar', 'narra', 'narre', 'falar', 'fale', 'leitura', 'read', 'speak', 'narrate'],
}

// Intencoes de configuracao disparadas por substantivos-alvo.
const SETTINGS_KEYWORDS = new Set([
  'contraste', 'contrast', 'fonte', 'font', 'tamanho', 'size', 'texto', 'text',
  'movimento', 'motion', 'animacao', 'voz', 'voice', 'microfone', 'mic',
])

// Faz a correspondencia de intencao com prioridade: comandos de leitura e
// configuracao vencem sobre navegar (ex.: "ler a pagina" nao e navegar para "ler").
const INTENT_PRIORITY = ['READ', 'SETTINGS', 'HIGHLIGHT', 'FILL', 'CLICK', 'NAVIGATE']

export function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // tira acentos
    .replace(/[^\w\s\-]/g, ' ') // tira pontuacao, mantem palavras e hifens internos
    .replace(/(\w)-(?=\w)/g, '$1') // junta hifens internos: "e-mail" -> "email"
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function tokenize(normalized) {
  return normalize(normalized)
    .split(' ')
    .filter((t) => t && !STOPWORDS.has(t) && t.length > 1)
}

// Levenshtein enxuto para similaridade entre tokens curtos.
function levenshtein(a, b) {
  const m = a.length
  const n = b.length
  if (!m) return n
  if (!n) return m
  const prev = new Array(n + 1)
  const curr = new Array(n + 1)
  for (let j = 0; j <= n; j++) prev[j] = j
  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j]
  }
  return prev[n]
}

export function tokenSimilarity(a, b) {
  if (!a || !b) return 0
  if (a === b) return 1
  const longer = a.length >= b.length ? a : b
  const dist = levenshtein(a, b)
  return Math.max(0, 1 - dist / longer.length)
}

export function classifyIntent(raw) {
  const text = normalize(raw)
  const tokens = tokenize(text)

  // SETTINGS: presenca de palavras-chave de configuracao.
  for (const tok of tokens) {
    if (SETTINGS_KEYWORDS.has(tok)) {
      const verb = tokens.find((t) => ['aumentar', 'aumente', 'maior', 'diminuir', 'diminua', 'menor', 'ativar', 'ligar', 'desligar'].includes(t))
      return { intent: 'SETTINGS', verb, target: tok, tokens }
    }
  }

  for (const intent of INTENT_PRIORITY) {
    if (intent === 'SETTINGS') continue
    const verbs = INTENT_VERBS[intent]
    for (const verb of verbs) {
      // verbo exato em tokens OU expressao multi-palavra no texto normalizado.
      if (verb.includes(' ')) {
        if (text.includes(verb)) return { intent, verb, tokens }
      } else if (tokens.includes(verb)) {
        return { intent, verb, tokens }
      }
    }
  }

  // Sem verbo reconhecido: se sobram substantivos, assume intencao de navegacao
  // (o usuario provavelmente disse apenas o nome de uma tela).
  const meaningful = tokens.filter((t) => !FILLER_NOUNS.has(t))
  if (meaningful.length) return { intent: 'NAVIGATE', verb: null, tokens }
  return { intent: 'UNKNOWN', verb: null, tokens }
}

// Remove verbos reconhecidos e substantivos genericos, devolvendo o alvo limpo.
export function extractTarget(classified) {
  const { tokens = [], intent } = classified
  const dropVerbs = new Set(INTENT_VERBS[intent] || [])
  const targetTokens = tokens.filter((t) => !dropVerbs.has(t) && !FILLER_NOUNS.has(t) && !SETTINGS_KEYWORDS.has(t))
  return targetTokens.join(' ').trim()
}

// Campos pesquisaveis de uma entidade do SAM (linha rowEntity), separados em
// campos primarios (name/slug/path/pageTitle) e secundarios (labels/aliases).
function searchableFields(entity) {
  const meta = entity.metadata || {}
  const labels = Array.isArray(entity.semanticLabels) ? entity.semanticLabels : []
  const aliases = Array.isArray(meta.aliases) ? meta.aliases : []
  const accessibleName = meta.accessibleName || ''
  const primary = [entity.name, entity.slug, entity.path, entity.pageTitle]
    .map((s) => normalize(s))
    .filter(Boolean)
  const secondary = [entity.description, accessibleName, ...labels, ...aliases]
    .map((s) => normalize(s))
    .filter(Boolean)
  return { primary, secondary }
}

// Peso por tipo de entidade dado a intencao. Rotas sao mais relevantes para
// navegar; campos (kind=fill) para preencher; links/botoes para clicar.
function typeBoost(entity, intent) {
  const meta = entity.metadata || {}
  const kind = String(meta.kind || '').toLowerCase()
  const type = String(entity.type || '').toUpperCase()
  if (intent === 'NAVIGATE') {
    if (type === 'ROUTE') return 1.0
    if (kind === 'navigation' || meta.targetRoute) return 0.85
    return 0.5
  }
  if (intent === 'FILL') {
    if (kind === 'fill' || ['INPUT', 'TEXTAREA', 'SELECT'].includes(type)) return 1.0
    return 0.4
  }
  if (intent === 'CLICK') {
    if (['LINK', 'BUTTON'].includes(type) || kind === 'click' || kind === 'submit') return 1.0
    return 0.5
  }
  if (intent === 'HIGHLIGHT') {
    if (['LINK', 'BUTTON', 'COMPONENT', 'INPUT'].includes(type)) return 0.9
    return 0.5
  }
  return 0.7
}

function rawFieldScore(target, targetTokens, field) {
  if (!field) return 0
  if (field === target) return 1
  if (target.length >= 3 && field.includes(target)) return 0.92
  if (field.length >= 3 && target.includes(field)) return 0.88
  const fieldTokens = tokenize(field)
  let overlap = 0
  for (const t of targetTokens) {
    let bestTok = 0
    for (const ft of fieldTokens) bestTok = Math.max(bestTok, tokenSimilarity(t, ft))
    if (bestTok >= 0.8) overlap++
  }
  const tokenScore = fieldTokens.length ? overlap / targetTokens.length : 0
  const globalSim = tokenSimilarity(target, field)
  return Math.max(tokenScore, globalSim) * 0.8
}

// Pontua uma entidade contra o alvo (tokens). Campos primarios valem mais que
// secundarios (labels/aliases), evitando que um alias roube a Correspondencia
// da entidade cujo nome e exatamente o alvo.
export function scoreEntity(entity, targetTokens, intent) {
  if (!targetTokens.length) return 0
  const target = targetTokens.join(' ')
  const { primary, secondary } = searchableFields(entity)
  let primaryBest = 0
  for (const field of primary) primaryBest = Math.max(primaryBest, rawFieldScore(target, targetTokens, field))
  let secondaryBest = 0
  for (const field of secondary) secondaryBest = Math.max(secondaryBest, rawFieldScore(target, targetTokens, field) * 0.8)
  const best = Math.max(primaryBest, secondaryBest)
  return Math.round(best * typeBoost(entity, intent) * 100) / 100
}

// Ranqueia entidades por relevancia para o alvo + intencao.
export function matchEntities(entities, target, intent, limit = 5) {
  const targetTokens = Array.isArray(target) ? target : tokenize(target)
  if (!targetTokens.length) return []
  return entities
    .map((entity) => ({ entity, score: scoreEntity(entity, targetTokens, intent) }))
    .filter((r) => r.score > 0.25)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => ({ ...r.entity, confidence: r.score }))
}

// BFS sobre o grafo de relacionamentos (NAVIGATES_TO, CONTAINS) da rota atual
// ate a entidade-alvo, montando passos clicaveis.
export function planPath({ entities, relationships, startPath, target, intent }) {
  const byId = new Map(entities.map((e) => [e.id, e]))
  const adj = new Map()
  for (const e of entities) adj.set(e.id, [])
  for (const rel of relationships) {
    const type = String(rel.type || '').toUpperCase()
    if (!['NAVIGATES_TO', 'CONTAINS'].includes(type)) continue
    if (!adj.has(rel.source)) adj.set(rel.source, [])
    adj.get(rel.source).push({ to: rel.target, type })
  }

  // Acha a rota atual.
  const normalizedStart = normalize(startPath)
  const start = entities.find((e) => e.type === 'ROUTE' && normalize(e.path) === normalizedStart) || entities.find((e) => e.type === 'ROUTE')

  const targetEntity = target && target.id ? target : matchEntities(entities, target, intent, 1)[0]
  if (!targetEntity) return { steps: [], found: false }

  // Mesma rota/tela atual -> acao direta sobre o alvo.
  if (start && targetEntity.id === start.id) {
    return { steps: [{ action: 'DONE', match: targetEntity, label: targetEntity.name, reason: 'Voce ja esta nesta tela.' }], found: true }
  }

  // BFS
  const queue = [{ id: start ? start.id : targetEntity.id, path: [] }]
  const seen = new Set([start ? start.id : targetEntity.id])
  while (queue.length) {
    const { id, path } = queue.shift()
    if (id === targetEntity.id && path.length) {
      return { steps: pathToSteps(path, byId), found: true }
    }
    for (const edge of adj.get(id) || []) {
      if (seen.has(edge.to)) continue
      seen.add(edge.to)
      queue.push({ id: edge.to, path: [...path, { from: id, to: edge.to, type: edge.type }] })
    }
  }

  // Sem caminho no grafo: se o alvo tem targetRoute/cssSelector, gera um passo unico.
  const meta = targetEntity.metadata || {}
  if (meta.targetRoute || meta.cssSelector || meta.kind) {
    return { steps: [singleStep(targetEntity, intent)], found: true }
  }
  return { steps: [], found: false }
}

function pathToSteps(path, byId) {
  const steps = []
  for (const edge of path) {
    const node = byId.get(edge.to)
    if (!node) continue
    const meta = node.metadata || {}
    if (meta.kind === 'fill') {
      steps.push({ action: 'WAIT_INPUT', match: node, label: node.name, reason: 'Preencha o campo destacado.' })
    } else {
      steps.push({ action: 'CLICK', match: node, label: node.name, reason: 'Clique para continuar.' })
    }
  }
  return steps
}

function singleStep(entity, intent) {
  const meta = entity.metadata || {}
  if (intent === 'FILL' || meta.kind === 'fill') {
    return { action: 'WAIT_INPUT', match: entity, label: entity.name, reason: 'Preencha o campo destacado.' }
  }
  if (meta.targetRoute || meta.kind === 'navigation') {
    return { action: 'NAVIGATE', match: entity, label: entity.name, reason: 'Navegando para ' + entity.name + '.' }
  }
  return { action: 'CLICK', match: entity, label: entity.name, reason: 'Clique em ' + entity.name + '.' }
}

// Monta a resposta final consumida pelo widget.
export function buildResponse({ intent, matches = [], steps = [], fillValue = '', suggestions = [] }) {
  const actionMap = {
    NAVIGATE: 'NAVIGATE',
    CLICK: 'CLICK',
    FILL: 'FILL',
    TOGGLE: 'TOGGLE',
    HIGHLIGHT: 'HIGHLIGHT',
    READ: 'READ',
    SETTINGS: 'SETTINGS',
    UNKNOWN: 'NAVIGATE',
  }
  return {
    action: actionMap[intent] || 'NAVIGATE',
    matches: matches.slice(0, 3),
    fillValue: fillValue || '',
    steps: steps || [],
    suggestions: suggestions.slice(0, 3),
  }
}

// Funcao de conveniencia que o endpoint chama de ponta a ponta.
export function interpret({ transcript, path = '', entities = [], relationships = [] }) {
  const classified = classifyIntent(transcript)
  const target = extractTarget(classified)
  const matches = matchEntities(entities, target, classified.intent, 5)

  // READ / SETTINGS / HIGHLIGHT nao dependem de casar entidade do SAM.
  if (classified.intent === 'READ' || classified.intent === 'SETTINGS' || classified.intent === 'HIGHLIGHT') {
    return buildResponse({
      intent: classified.intent,
      matches,
      steps: [],
      fillValue: '',
      suggestions: [],
    })
  }

  const top = matches[0]
  if (!top) {
    // Sem casamento: sugere os nomes mais proximos em vez de "nao entendi".
    const suggestions = entities
      .filter((e) => ['ROUTE', 'LINK', 'BUTTON'].includes(String(e.type).toUpperCase()))
      .map((e) => ({ name: e.name, path: e.path }))
      .slice(0, 3)
    return buildResponse({ intent: 'UNKNOWN', matches: [], steps: [], suggestions })
  }

  const plan = planPath({ entities, relationships, startPath: path, target: top, intent: classified.intent })
  const fillValue = ''
  return buildResponse({ intent: classified.intent, matches, steps: plan.steps, fillValue })
}
