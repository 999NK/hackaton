import { pool, rowEntity } from '../server/db.js'
import { semanticVectorSearch } from './_vectors.js'
import crypto from 'node:crypto'

function setCors(_req, res, _project, methods) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', `${methods}, OPTIONS`)
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

async function projectByToken(token) {
  const result = await pool.query('SELECT * FROM projects WHERE token = $1', [token])
  return result.rows[0] || null
}

async function latestCompletedScan(projectId) {
  const result = await pool.query(
    "SELECT * FROM scans WHERE project_id = $1 AND status = 'COMPLETED' ORDER BY created DESC LIMIT 1",
    [projectId],
  )
  return result.rows[0] || null
}

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}')
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : {}
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value ?? null)
}

function hashPayload(value) {
  return crypto.createHash('sha256').update(stableStringify(value)).digest('hex')
}

async function readAiCache(projectId, endpoint, cacheKey) {
  const result = await pool.query(
    'SELECT response FROM ai_action_cache WHERE project_id = $1 AND endpoint = $2 AND cache_key = $3 LIMIT 1',
    [projectId, endpoint, cacheKey],
  )
  if (!result.rows[0]) return null
  await pool
    .query('UPDATE ai_action_cache SET hits = hits + 1 WHERE project_id = $1 AND endpoint = $2 AND cache_key = $3', [
      projectId,
      endpoint,
      cacheKey,
    ])
    .catch(() => null)
  return result.rows[0].response
}

async function writeAiCache(projectId, scanId, endpoint, cacheKey, request, response) {
  await pool
    .query(
      `INSERT INTO ai_action_cache (project_id, scan_id, endpoint, cache_key, request, response, hits)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, 0)
       ON CONFLICT (project_id, endpoint, cache_key)
       DO UPDATE SET scan_id = EXCLUDED.scan_id, request = EXCLUDED.request, response = EXCLUDED.response, updated = now()`,
      [projectId, scanId, endpoint, cacheKey, JSON.stringify(request), JSON.stringify(response)],
    )
    .catch(() => null)
}

function normalizeCommandText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(abrir|abra|ir|va|navegar|navegue|acessar|acesse|clicar|clique|em|para|no|na|o|a|os|as|um|uma)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function scoreEntity(transcript, entity, currentPath = '') {
  const text = normalizeCommandText(transcript)
  const labels = [entity.name, entity.slug, entity.description, entity.accessibilityHint, ...(entity.semanticLabels || [])]
  const haystack = normalizeCommandText(labels.join(' '))
  const targetRoute = entity.metadata?.targetRoute || entity.path || ''
  let score = 0
  if (text && labels.some((label) => normalizeCommandText(label) === text)) score += 1
  if (text && haystack.includes(text)) score += 0.75
  for (const token of text.split(' ').filter(Boolean)) {
    if (haystack.includes(token)) score += 0.12
  }
  if (currentPath && (entity.path === currentPath || targetRoute === currentPath)) score += 0.2
  if (entity.type === 'COMPONENT' && entity.metadata?.targetRoute) score += 0.08
  if (entity.type === 'ROUTE') score += 0.04
  return Math.min(score, 1)
}

function simpleMatch(transcript, entities, currentPath = '') {
  return entities
    .map((entity) => {
      const confidence = scoreEntity(transcript, entity, currentPath)
      return { ...entity, confidence }
    })
    .filter((entity) => entity.confidence > 0)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3)
}

function isFillEntity(entity) {
  const meta = entity.metadata || {}
  const selector = meta.cssSelector || ''
  return (
    meta.kind === 'fill' ||
    meta.inputName ||
    meta.inputType ||
    /\b(input|textarea|select)\b/i.test(selector) ||
    /\b(e-?mail|senha|cnpj|cpf|nome|telefone|busca|pesquisa|valor|campo)\b/i.test(
      [entity.name, entity.slug, entity.description, ...(entity.semanticLabels || [])].join(' '),
    )
  )
}

function parseFillCommand(transcript, entities, currentPath = '') {
  const text = String(transcript || '').trim()
  const match = text.match(
    /(?:preencha|preencher|digite|diga|escreva|coloque|insira|informar|informe)\s+(?:o\s+|a\s+|no\s+|na\s+)?(?:campo\s+)?(.+?)\s+(?:com|como|valor|igual\s+a|=)\s+(.+)$/i,
  )
  if (!match) return null
  const field = match[1].trim()
  const fillValue = match[2].trim()
  if (!field || !fillValue) return null

  const candidates = entities
    .filter(isFillEntity)
    .map((entity) => ({ entity, score: scoreEntity(field, entity, currentPath) }))
    .sort((a, b) => b.score - a.score)
  const best = candidates[0]
  if (!best || best.score <= 0) return null
  return { action: 'FILL', matches: [{ slug: best.entity.slug, confidence: Math.max(best.score, 0.75) }], fillValue }
}

function routePatternMatches(pattern, path) {
  if (!pattern || !path) return false
  if (pattern === path) return true
  const escaped = pattern
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/:([a-zA-Z0-9_]+)/g, '[^/]+')
  return new RegExp(`^${escaped}$`).test(path)
}

async function routeForPath(scanId, currentPath) {
  if (!currentPath) return null
  const exact = await pool.query(
    "SELECT * FROM semantic_entities WHERE scan_id = $1 AND type = 'ROUTE' AND path = $2 LIMIT 1",
    [scanId, currentPath],
  )
  if (exact.rowCount) return exact.rows[0]

  const routes = await pool.query("SELECT * FROM semantic_entities WHERE scan_id = $1 AND type = 'ROUTE'", [
    scanId,
  ])
  const pattern = routes.rows.find((route) => routePatternMatches(route.path, currentPath))
  if (pattern) return pattern

  const currentLast = String(currentPath).split('/').filter(Boolean).pop()
  if (currentLast) {
    const suffix = routes.rows
      .filter((route) => String(route.path || '').split('/').filter(Boolean).pop() === currentLast)
      .sort((a, b) => String(a.path || '').length - String(b.path || '').length)[0]
    if (suffix) return suffix
  }

  return null
}

async function actionsForRoute(scanId, currentPath) {
  const route = await routeForPath(scanId, currentPath)
  if (!route) return []
  const result = await pool.query(
    `SELECT c.* FROM relationships rel
     JOIN semantic_entities c ON c.id = rel.target_id
     WHERE rel.scan_id = $1 AND rel.source_id = $2 AND rel.type = 'CONTAINS'
     ORDER BY c.name`,
    [scanId, route.id],
  )
  return result.rows.map(rowEntity)
}

async function buildNavigationSteps(scanId, currentPath, targetEntity) {
  const targetRoute = targetEntity?.metadata?.targetRoute || targetEntity?.path || ''
  if (!targetRoute) return []

  const currentRoute = await routeForPath(scanId, currentPath)
  const routeRows = await pool.query("SELECT * FROM semantic_entities WHERE scan_id = $1 AND type = 'ROUTE'", [
    scanId,
  ])
  const routes = routeRows.rows
  const routeById = new Map(routes.map((route) => [route.id, route]))
  const target = routes.find((route) => routePatternMatches(route.path, targetRoute) || route.path === targetRoute)
  if (!currentRoute || !target) {
    return [
      {
        action: 'BLOCKED',
        label: targetEntity.name,
        reason: 'Nao encontrei a rota atual ou a rota de destino no mapa semantico.',
      },
    ]
  }
  if (currentRoute.id === target.id) return [{ action: 'DONE', label: target.name, reason: 'Voce ja esta nessa tela.' }]

  const edgeRows = await pool.query(
    `SELECT rel.source_id, c.*
     FROM relationships rel
     JOIN semantic_entities c ON c.id = rel.target_id
     WHERE rel.scan_id = $1 AND rel.type = 'CONTAINS' AND c.type = 'COMPONENT'`,
    [scanId],
  )
  const edges = new Map()
  for (const row of edgeRows.rows) {
    const nextPath = row.metadata?.targetRoute || ''
    if (!nextPath) continue
    const nextRoute = routes.find((route) => routePatternMatches(route.path, nextPath) || route.path === nextPath)
    if (!nextRoute) continue
    const list = edges.get(row.source_id) || []
    list.push({ to: nextRoute.id, component: rowEntity(row) })
    edges.set(row.source_id, list)
  }

  const queue = [{ routeId: currentRoute.id, steps: [] }]
  const seen = new Set([currentRoute.id])
  while (queue.length) {
    const item = queue.shift()
    for (const edge of edges.get(item.routeId) || []) {
      if (seen.has(edge.to)) continue
      const component = edge.component
      const nextRoute = routeById.get(edge.to)
      const step = {
        action: 'CLICK',
        targetRoute: component.metadata?.targetRoute || nextRoute?.path || '',
        label: component.name,
        match: component,
      }
      const steps = [...item.steps, step]
      if (edge.to === target.id) return steps
      seen.add(edge.to)
      queue.push({ routeId: edge.to, steps })
    }
  }

  if (currentRoute && /login|entrar|auth/i.test([currentRoute.name, currentRoute.path].join(' '))) {
    const loginRows = await pool.query(
      `SELECT c.*
       FROM relationships rel
       JOIN semantic_entities c ON c.id = rel.target_id
       WHERE rel.scan_id = $1 AND rel.source_id = $2 AND rel.type = 'CONTAINS' AND c.type = 'COMPONENT'
       ORDER BY c.name`,
      [scanId, currentRoute.id],
    )
    const components = loginRows.rows.map(rowEntity)
    const fields = components.filter((component) => component.metadata?.kind === 'fill').slice(0, 3)
    const submit =
      components.find((component) => /entrar|login|demonstracao/i.test(component.name || '')) ||
      components.find((component) => /submit|login/i.test(component.metadata?.kind || component.metadata?.intent || ''))
    const steps = fields.map((component) => ({
      action: 'WAIT_INPUT',
      label: component.name,
      reason: 'Preencha este campo para continuar.',
      match: component,
    }))
    if (submit) {
      steps.push({
        action: 'CLICK',
        label: submit.name,
        match: submit,
      })
    }
    if (steps.length) return steps
  }

  return [
    {
      action: 'BLOCKED',
      label: target.name,
      reason: 'Nao encontrei um caminho clicavel da tela atual ate a tela de destino. Reescaneie o app ou adicione essa acao no mapa.',
    },
  ]
}

async function openAiCommand(transcript, entities, currentPath = '') {
  if (!process.env.OPENAI_API_KEY) return null

  const compactEntities = entities
    .map((entity) => ({ entity, score: scoreEntity(transcript, entity, currentPath) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 120)
    .map(({ entity, score }) => ({
      slug: entity.slug,
      name: entity.name,
      type: entity.type,
      path: entity.path,
      semanticLabels: entity.semanticLabels || [],
      description: entity.description,
      metadata: entity.metadata || {},
      localScore: score,
    }))

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Mapeie comandos de voz em português para entidades de acessibilidade. Responda apenas JSON no formato {"action":"NAVIGATE|CLICK|FILL","matches":[{"slug":"...","confidence":0.0}],"fillValue":""}. Priorize match exato de name/semanticLabels, depois localScore, depois contexto currentPath. Se o comando pedir para abrir/ir/acessar uma tela, retorne NAVIGATE; se a entidade for COMPONENT com metadata.targetRoute, ela também pode ser usada como NAVIGATE. Retorne no máximo 3 matches.',
        },
        {
          role: 'user',
          content: JSON.stringify({ transcript, currentPath, entities: compactEntities }),
        },
      ],
    }),
  })

  if (!response.ok) return null
  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || '{}'
  return JSON.parse(content)
}

async function openAiScreenAnalysis({ image, question, currentPath, currentUrl, domText, entities, routes }) {
  if (!process.env.OPENAI_API_KEY) return null

  const context = {
    question,
    currentPath,
    currentUrl,
    domText: String(domText || '').slice(0, 6000),
    currentPageActions: entities.map((entity) => ({
      name: entity.name,
      type: entity.type,
      path: entity.path,
      semanticLabels: entity.semanticLabels || [],
      description: entity.description,
      metadata: entity.metadata || {},
    })),
    knownRoutes: routes.slice(0, 120).map((route) => ({
      name: route.name,
      path: route.path,
      pageTitle: route.pageTitle,
      description: route.description,
    })),
  }

  const content = [
    {
      type: 'text',
      text:
        'Analise a tela atual do usuario usando a imagem e o contexto semantico salvo. Responda em portugues, de forma curta e util. Explique o que aparece na tela, responda a pergunta do usuario se houver, e cite quais acoes parecem disponiveis. Se houver risco de incerteza visual, diga isso claramente.\n\nContexto:\n' +
        JSON.stringify(context),
    },
  ]
  if (image) {
    content.push({ type: 'image_url', image_url: { url: image, detail: 'low' } })
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      max_tokens: 700,
      messages: [
        {
          role: 'system',
          content:
            'Voce e um agente de acessibilidade que ajuda usuarios a entender e controlar interfaces web. Use imagem e dados semanticos; nao invente elementos que nao aparecam. Responda apenas JSON com o formato {"summary":"...","answer":"...","visibleText":["..."],"actions":["..."],"fields":["..."],"possibleQuestions":["..."],"warnings":["..."]}.',
        },
        { role: 'user', content },
      ],
    }),
  })

  if (!response.ok) return null
  const data = await response.json()
  const raw = data.choices?.[0]?.message?.content || '{}'
  return JSON.parse(raw)
}

async function openAiTtsText({ text, label, role, currentPath }) {
  if (!process.env.OPENAI_API_KEY) return null
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      max_tokens: 180,
      messages: [
        {
          role: 'system',
          content:
            'Transforme o texto de um elemento de interface em uma fala curta, clara e acessivel em portugues do Brasil. Responda apenas JSON {"speech":"..."}. Se for botao/link/campo, diga tambem a funcao provavel.',
        },
        {
          role: 'user',
          content: JSON.stringify({ text, label, role, currentPath }),
        },
      ],
    }),
  })
  if (!response.ok) return null
  const data = await response.json()
  return JSON.parse(data.choices?.[0]?.message?.content || '{}')?.speech || null
}

export async function handleWidget(req, res, endpoint) {
  const token = req.query.token || ''
  const project = await projectByToken(token)
  const methods = endpoint === 'command' || endpoint === 'screen' || endpoint === 'tts' ? 'POST' : 'GET'
  setCors(req, res, project, methods)

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (!token || !project) return res.status(401).json({ error: 'Token invalido' })

  const scan = await latestCompletedScan(project.id)

  if (endpoint === 'config') {
    if (!scan) return res.status(200).json({ project: { name: project.name, baseUrl: project.base_url }, entities: [] })
    const result = await pool.query('SELECT * FROM semantic_entities WHERE scan_id = $1 LIMIT 1000', [scan.id])
    return res.status(200).json({
      project: { name: project.name, baseUrl: project.base_url },
      entities: result.rows.map(rowEntity),
    })
  }

  if (endpoint === 'sitemap') {
    if (!scan) return res.status(200).json({ routes: [] })
    const result = await pool.query(
      "SELECT * FROM semantic_entities WHERE scan_id = $1 AND type = 'ROUTE' ORDER BY name LIMIT 1000",
      [scan.id],
    )
    return res.status(200).json({ routes: result.rows.map(rowEntity) })
  }

  if (endpoint === 'entities') {
    if (!scan) return res.status(200).json({ entities: [] })
    const currentPath = req.query.path || ''
    const entities = currentPath ? await actionsForRoute(scan.id, currentPath) : []
    return res.status(200).json({ entities })
  }

  if (endpoint === 'command') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' })
    if (!scan) return res.status(404).json({ error: 'Nenhum scan completado encontrado' })
    const body = await readJson(req)
    const transcript = String(body.transcript || '').trim()
    const currentPath = String(body.path || '')
    if (!transcript) return res.status(400).json({ error: 'transcript obrigatorio' })
    const commandRequest = { v: 3, scanId: scan.id, transcript, currentPath }
    const commandCacheKey = hashPayload(commandRequest)
    const cachedCommand = await readAiCache(project.id, 'command', commandCacheKey).catch(() => null)
    if (cachedCommand) return res.status(200).json({ ...cachedCommand, cached: true })
    const result = await pool.query('SELECT * FROM semantic_entities WHERE scan_id = $1 LIMIT 1000', [scan.id])
    const entities = result.rows.map(rowEntity)
    const currentActions = currentPath ? await actionsForRoute(scan.id, currentPath) : []
    const vectorEntities = await semanticVectorSearch(pool, {
      projectId: project.id,
      scanId: scan.id,
      text: `${transcript}\nRota atual: ${currentPath}`,
      limit: 120,
    }).catch(() => [])
    const candidateMap = new Map()
    for (const entity of [...currentActions, ...vectorEntities, ...entities]) {
      if (!candidateMap.has(entity.slug)) candidateMap.set(entity.slug, entity)
    }
    const candidates = [...candidateMap.values()]
    const ai = parseFillCommand(transcript, candidates, currentPath) || (await openAiCommand(transcript, candidates, currentPath).catch(() => null))
    const bySlug = new Map(entities.map((entity) => [entity.slug, entity]))
    const matches = (ai?.matches || [])
      .map((match) => {
        const entity = bySlug.get(match.slug)
        return entity ? { ...entity, confidence: match.confidence || 0.5 } : null
      })
      .filter(Boolean)
    const finalMatches = matches.length ? matches : simpleMatch(transcript, candidates, currentPath)
    const firstMatch = finalMatches[0]
    const steps =
      (ai?.action || 'NAVIGATE') === 'NAVIGATE' && firstMatch
        ? await buildNavigationSteps(scan.id, currentPath, firstMatch)
        : []
    const payload = {
      action: ai?.action || 'NAVIGATE',
      matches: finalMatches,
      steps,
      fillValue: ai?.fillValue || '',
    }
    await writeAiCache(project.id, scan.id, 'command', commandCacheKey, commandRequest, payload)
    return res.status(200).json(payload)
  }

  if (endpoint === 'screen') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' })
    if (!scan) return res.status(404).json({ error: 'Nenhum scan completado encontrado' })
    const body = await readJson(req)
    const currentPath = String(body.path || '')
    const screenRequest = {
      scanId: scan.id,
      currentPath,
      currentUrl: String(body.url || ''),
      question: String(body.question || ''),
      domTextHash: hashPayload(String(body.domText || '').slice(0, 6000)),
      imageHash: hashPayload(String(body.image || '').slice(0, 240000)),
    }
    const screenCacheKey = hashPayload(screenRequest)
    const cachedScreen = await readAiCache(project.id, 'screen', screenCacheKey).catch(() => null)
    if (cachedScreen) return res.status(200).json({ ...cachedScreen, cached: true })
    const currentActions = currentPath ? await actionsForRoute(scan.id, currentPath) : []
    const routesResult = await pool.query(
      "SELECT * FROM semantic_entities WHERE scan_id = $1 AND type = 'ROUTE' ORDER BY name LIMIT 1000",
      [scan.id],
    )
    const analysis = await openAiScreenAnalysis({
      image: body.image || '',
      question: String(body.question || ''),
      currentPath,
      currentUrl: String(body.url || ''),
      domText: body.domText || '',
      entities: currentActions,
      routes: routesResult.rows.map(rowEntity),
    }).catch(() => null)

    if (!analysis) return res.status(503).json({ error: 'Analise visual indisponivel no momento' })
    const payload = {
      analysis,
      answer: analysis.answer || analysis.summary || '',
    }
    await writeAiCache(project.id, scan.id, 'screen', screenCacheKey, screenRequest, payload)
    return res.status(200).json(payload)
  }

  if (endpoint === 'tts') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' })
    const body = await readJson(req)
    const text = String(body.text || '').trim()
    if (!text) return res.status(400).json({ error: 'text obrigatorio' })
    const ttsRequest = {
      scanId: scan?.id || '',
      text: text.slice(0, 1600),
      label: String(body.label || ''),
      role: String(body.role || ''),
      currentPath: String(body.path || ''),
    }
    const ttsCacheKey = hashPayload(ttsRequest)
    const cachedTts = await readAiCache(project.id, 'tts', ttsCacheKey).catch(() => null)
    if (cachedTts) return res.status(200).json({ ...cachedTts, cached: true })
    const speech = await openAiTtsText({
      text: text.slice(0, 1600),
      label: String(body.label || ''),
      role: String(body.role || ''),
      currentPath: String(body.path || ''),
    }).catch(() => null)
    const payload = { speech: speech || text.slice(0, 500) }
    await writeAiCache(project.id, scan?.id || null, 'tts', ttsCacheKey, ttsRequest, payload)
    return res.status(200).json(payload)
  }

  return res.status(404).json({ error: 'endpoint not found' })
}
