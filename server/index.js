import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import express from 'express'
import jwt from 'jsonwebtoken'
import { migrate, pool, rowEntity, rowProject, rowRelationship, rowScan } from './db.js'

dotenv.config({ quiet: true })

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const app = express()
const isVercel = Boolean(process.env.VERCEL)
const isProduction = process.env.NODE_ENV === 'production' || process.argv.includes('--production')
const port = Number(process.env.PORT || 8090)
const jwtSecret = process.env.JWT_SECRET || 'change-me-before-production'
const validEntityTypes = ['ROUTE', 'COMPONENT', 'API', 'FLOW', 'BUSINESS_RULE']
const validRelTypes = ['CONTAINS', 'CONSUMES', 'TRIGGERS', 'REDIRECTS', 'VALIDATES']

app.use(express.json({ limit: '10mb' }))

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':')
  if (!salt || !hash) return false
  const candidate = crypto.scryptSync(password, salt, 64)
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), candidate)
}

function signUser(row) {
  return jwt.sign({ sub: row.id, email: row.email }, jwtSecret, { expiresIn: '7d' })
}

function userPayload(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name || '',
    avatar: row.avatar || '',
    created: row.created,
    updated: row.updated,
  }
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return res.status(401).json({ error: 'auth required' })
  try {
    const payload = jwt.verify(token, jwtSecret)
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [payload.sub])
    if (!result.rowCount) return res.status(401).json({ error: 'auth required' })
    req.user = result.rows[0]
    next()
  } catch {
    return res.status(401).json({ error: 'auth required' })
  }
}

function projectCors(project, req, res, methods) {
  let corsOrigin = '*'
  const origin = req.headers.origin || ''
  if (project) {
    const baseUrl = project.base_url || ''
    if (baseUrl && origin && !baseUrl.includes(origin)) corsOrigin = ''
    else if (origin) corsOrigin = origin
  }
  if (corsOrigin) {
    res.setHeader('Access-Control-Allow-Origin', corsOrigin)
    res.setHeader('Access-Control-Allow-Methods', `${methods}, OPTIONS`)
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  }
}

async function findProjectByToken(token) {
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

async function ensureProjectAccess(projectId, userId) {
  const result = await pool.query('SELECT * FROM projects WHERE id = $1 AND owner_id = $2', [
    projectId,
    userId,
  ])
  return result.rows[0] || null
}

app.get('/api/health', async (_req, res) => {
  await pool.query('SELECT 1')
  res.json({ ok: true })
})

app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body || {}
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' })
  try {
    const result = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING *',
      [String(email).toLowerCase(), hashPassword(password)],
    )
    const user = result.rows[0]
    res.status(201).json({ token: signUser(user), user: userPayload(user) })
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'email already registered' })
    throw error
  }
})

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {}
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [
    String(email || '').toLowerCase(),
  ])
  const user = result.rows[0]
  if (!user || !verifyPassword(password || '', user.password_hash)) {
    return res.status(401).json({ error: 'invalid credentials' })
  }
  res.json({ token: signUser(user), user: userPayload(user) })
})

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: userPayload(req.user) })
})

app.get('/api/projects', requireAuth, async (req, res) => {
  const result = await pool.query('SELECT * FROM projects WHERE owner_id = $1 ORDER BY created DESC', [
    req.user.id,
  ])
  res.json(result.rows.map(rowProject))
})

app.post('/api/projects', requireAuth, async (req, res) => {
  const body = req.body || {}
  if (!body.name) return res.status(400).json({ error: 'name is required' })
  const result = await pool.query(
    `INSERT INTO projects (name, token, base_url, framework, language, user_id, owner_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      body.name,
      body.token || `${crypto.randomUUID()}${crypto.randomUUID()}`,
      body.baseUrl || '',
      body.framework || '',
      body.language || '',
      req.user.id,
      req.user.id,
    ],
  )
  res.status(201).json(rowProject(result.rows[0]))
})

app.get('/api/projects/:id', requireAuth, async (req, res) => {
  const project = await ensureProjectAccess(req.params.id, req.user.id)
  if (!project) return res.status(404).json({ error: 'project not found' })
  res.json(rowProject(project))
})

app.patch('/api/projects/:id', requireAuth, async (req, res) => {
  const project = await ensureProjectAccess(req.params.id, req.user.id)
  if (!project) return res.status(404).json({ error: 'project not found' })
  const body = req.body || {}
  const result = await pool.query(
    `UPDATE projects
     SET name = COALESCE($1, name),
         token = COALESCE($2, token),
         base_url = COALESCE($3, base_url),
         framework = COALESCE($4, framework),
         language = COALESCE($5, language)
     WHERE id = $6
     RETURNING *`,
    [body.name, body.token, body.baseUrl, body.framework, body.language, req.params.id],
  )
  res.json(rowProject(result.rows[0]))
})

app.delete('/api/projects/:id', requireAuth, async (req, res) => {
  const result = await pool.query('DELETE FROM projects WHERE id = $1 AND owner_id = $2', [
    req.params.id,
    req.user.id,
  ])
  if (!result.rowCount) return res.status(404).json({ error: 'project not found' })
  res.status(204).end()
})

app.get('/api/scans', requireAuth, async (req, res) => {
  const params = [req.user.id]
  let where = 'p.owner_id = $1'
  if (req.query.projectId) {
    params.push(req.query.projectId)
    where += ` AND s.project_id = $${params.length}`
  }
  const result = await pool.query(
    `SELECT s.* FROM scans s
     JOIN projects p ON p.id = s.project_id
     WHERE ${where}
     ORDER BY s.created DESC`,
    params,
  )
  res.json(result.rows.map(rowScan))
})

app.post('/api/scans/reprocess', requireAuth, async (req, res) => {
  const project = await ensureProjectAccess(req.body?.projectId, req.user.id)
  if (!project) return res.status(404).json({ error: 'project not found' })
  const result = await pool.query(
    "INSERT INTO scans (project_id, status, report, token) VALUES ($1, 'PROCESSING', '{}'::jsonb, $2) RETURNING *",
    [project.id, project.token],
  )
  res.status(201).json(rowScan(result.rows[0]))
})

app.get('/api/entities', requireAuth, async (req, res) => {
  const { scanId } = req.query
  const result = await pool.query(
    `SELECT e.* FROM semantic_entities e
     JOIN scans s ON s.id = e.scan_id
     JOIN projects p ON p.id = s.project_id
     WHERE e.scan_id = $1 AND p.owner_id = $2
     ORDER BY e.created DESC`,
    [scanId, req.user.id],
  )
  res.json(result.rows.map(rowEntity))
})

app.get('/api/entities/count', requireAuth, async (req, res) => {
  const { scanId } = req.query
  const result = await pool.query(
    `SELECT count(*)::int AS count FROM semantic_entities e
     JOIN scans s ON s.id = e.scan_id
     JOIN projects p ON p.id = s.project_id
     WHERE e.scan_id = $1 AND p.owner_id = $2`,
    [scanId, req.user.id],
  )
  res.json({ count: result.rows[0]?.count || 0 })
})

app.get('/api/relationships', requireAuth, async (req, res) => {
  const { scanId } = req.query
  const result = await pool.query(
    `SELECT r.* FROM relationships r
     JOIN scans s ON s.id = r.scan_id
     JOIN projects p ON p.id = s.project_id
     WHERE r.scan_id = $1 AND p.owner_id = $2`,
    [scanId, req.user.id],
  )
  res.json(result.rows.map(rowRelationship))
})

app.post('/backend/v1/scanner', async (req, res) => {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return res.status(401).json({ error: 'Token ausente' })
  const project = await findProjectByToken(token)
  if (!project) return res.status(401).json({ error: 'Token invalido' })

  const body = req.body || {}
  const report = body.report || body
  let entitiesCount = 0
  if (Array.isArray(report?.navigationMap?.screens)) entitiesCount = report.navigationMap.screens.length
  else if (Array.isArray(report?.routes)) entitiesCount = report.routes.length

  const result = await pool.query(
    `INSERT INTO scans
       (project_id, status, report, entities_count, token, error_message, files_count, secrets_found)
     VALUES ($1, 'COMPLETED', $2, $3, $4, '', $5, $6)
     RETURNING *`,
    [project.id, report, entitiesCount, token, body.filesCount || 0, body.secretsFound || 0],
  )
  await pool.query('UPDATE projects SET last_scanned_at = now() WHERE id = $1', [project.id])
  res.json({ scanId: result.rows[0].id })
})

app.get('/backend/v1/scanner/status/:scanId', async (req, res) => {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return res.status(401).json({ error: 'Token ausente' })
  const result = await pool.query('SELECT * FROM scans WHERE id = $1', [req.params.scanId])
  const scan = result.rows[0]
  if (!scan) return res.status(404).json({ error: 'Scan nao encontrado' })
  if (scan.token !== token) return res.status(401).json({ error: 'Token invalido' })
  res.json({
    scanId: scan.id,
    status: scan.status,
    entitiesCount: scan.entities_count || 0,
    errorMessage: scan.error_message || null,
  })
})

app.post('/backend/v1/manual-scan', requireAuth, async (req, res) => {
  const { projectId, data = {} } = req.body || {}
  const project = await ensureProjectAccess(projectId, req.user.id)
  if (!project) return res.status(404).json({ error: 'project not found' })
  if (!Array.isArray(data.entities) || data.entities.length === 0) {
    return res.status(400).json({ error: 'data.entities is required and must be a non-empty array' })
  }

  const errors = []
  for (const [i, ent] of data.entities.entries()) {
    if (!validEntityTypes.includes(ent.type)) errors.push(`Entity ${i} has invalid type`)
    if (!ent.name) errors.push(`Entity ${i} is missing name`)
  }
  for (const [i, rel] of (data.relationships || []).entries()) {
    if (!validRelTypes.includes(rel.type)) errors.push(`Relationship ${i} has invalid type`)
  }
  if (errors.length) return res.status(400).json({ error: 'Validation failed', details: errors })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const scanResult = await client.query(
      `INSERT INTO scans
         (project_id, status, phase, phase_detail, files_count, files_uploaded, secrets_found, token_budget, token_used, report, token)
       VALUES ($1, 'PROCESSING', 'Ingesting', 'Processing manually pasted semantic data', $2, 0, 0, 0, 0, '{}'::jsonb, $3)
       RETURNING *`,
      [project.id, data.entities.length, project.token],
    )
    const scan = scanResult.rows[0]
    const entityMap = new Map()
    for (const entity of data.entities) {
      const slug = entity.slug || String(entity.name).toLowerCase().replace(/\s+/g, '-')
      if (entityMap.has(slug)) continue
      const entityResult = await client.query(
        `INSERT INTO semantic_entities
           (scan_id, type, name, slug, path, page_title, semantic_labels, description, accessibility_hint, confidence, evidence, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          scan.id,
          entity.type,
          entity.name,
          slug,
          entity.path || '',
          entity.pageTitle || '',
          JSON.stringify(entity.semanticLabels || []),
          entity.description || '',
          entity.accessibilityHint || '',
          entity.confidence || 0.9,
          JSON.stringify(entity.evidence || []),
          JSON.stringify(entity.metadata || {}),
        ],
      )
      entityMap.set(slug, entityResult.rows[0].id)
    }
    let relCount = 0
    for (const relationship of data.relationships || []) {
      const sourceId = entityMap.get(relationship.sourceSlug) || relationship.source
      const targetId = entityMap.get(relationship.targetSlug) || relationship.target
      if (!sourceId || !targetId) continue
      await client.query(
        'INSERT INTO relationships (scan_id, source_id, target_id, type) VALUES ($1, $2, $3, $4)',
        [scan.id, sourceId, targetId, relationship.type],
      )
      relCount++
    }
    await client.query(
      `UPDATE scans
       SET status = 'COMPLETED', phase = 'Complete', phase_detail = $1, entities_count = $2
       WHERE id = $3`,
      [`Imported ${entityMap.size} entities and ${relCount} relationships`, entityMap.size, scan.id],
    )
    await client.query('UPDATE projects SET last_scanned_at = now() WHERE id = $1', [project.id])
    await client.query('COMMIT')
    res.status(202).json({ scanId: scan.id })
  } catch (error) {
    await client.query('ROLLBACK')
    res.status(500).json({ error: error.message || 'Ingestion failed' })
  } finally {
    client.release()
  }
})

app.post('/backend/v1/onboarding/chat', requireAuth, async (_req, res) => {
  res.json({
    content:
      'Onboarding conectado ao PostgreSQL. Configure um provedor de IA no servidor para respostas arquiteturais completas.',
  })
})

app.post('/backend/v1/testing/generate', requireAuth, async (_req, res) => {
  res.status(503).json({ error: 'AI temporariamente indisponivel' })
})

app.options('/backend/v1/widget/:endpoint', async (req, res) => {
  const project = await findProjectByToken(req.query.token || '')
  projectCors(project, req, res, req.params.endpoint === 'command' ? 'POST' : 'GET')
  res.status(204).end()
})

app.get('/backend/v1/widget/config', async (req, res) => {
  const project = await findProjectByToken(req.query.token || '')
  projectCors(project, req, res, 'GET')
  if (!project) return res.status(401).json({ error: 'Token invalido' })
  const scan = await latestCompletedScan(project.id)
  if (!scan) {
    return res.json({ project: { name: project.name, baseUrl: project.base_url }, entities: [] })
  }
  const result = await pool.query('SELECT * FROM semantic_entities WHERE scan_id = $1 LIMIT 1000', [
    scan.id,
  ])
  res.json({
    project: { name: project.name, baseUrl: project.base_url },
    entities: result.rows.map(rowEntity),
  })
})

app.get('/backend/v1/widget/sitemap', async (req, res) => {
  const project = await findProjectByToken(req.query.token || '')
  projectCors(project, req, res, 'GET')
  if (!project) return res.status(401).json({ error: 'Token invalido' })
  const scan = await latestCompletedScan(project.id)
  if (!scan) return res.json({ routes: [] })
  const result = await pool.query(
    "SELECT * FROM semantic_entities WHERE scan_id = $1 AND type = 'ROUTE' ORDER BY name LIMIT 1000",
    [scan.id],
  )
  res.json({ routes: result.rows.map(rowEntity) })
})

app.get('/backend/v1/widget/entities', async (req, res) => {
  const project = await findProjectByToken(req.query.token || '')
  projectCors(project, req, res, 'GET')
  if (!project) return res.status(401).json({ error: 'Token invalido' })
  const scan = await latestCompletedScan(project.id)
  if (!scan) return res.json({ entities: [] })
  const currentPath = req.query.path || ''
  let result
  if (currentPath) {
    result = await pool.query(
      `SELECT c.* FROM semantic_entities route
       JOIN relationships rel ON rel.source_id = route.id AND rel.type = 'CONTAINS'
       JOIN semantic_entities c ON c.id = rel.target_id
       WHERE route.scan_id = $1 AND route.type = 'ROUTE' AND route.path = $2`,
      [scan.id, currentPath],
    )
  }
  if (!result?.rowCount) {
    result = await pool.query(
      "SELECT * FROM semantic_entities WHERE scan_id = $1 AND type = 'COMPONENT' LIMIT 1000",
      [scan.id],
    )
  }
  res.json({ entities: result.rows.map(rowEntity) })
})

app.post('/backend/v1/widget/command', async (req, res) => {
  const project = await findProjectByToken(req.query.token || '')
  projectCors(project, req, res, 'POST')
  if (!project) return res.status(401).json({ error: 'Token invalido' })
  const transcript = String(req.body?.transcript || '').trim().toLowerCase()
  if (!transcript) return res.status(400).json({ error: 'transcript obrigatorio' })
  const scan = await latestCompletedScan(project.id)
  if (!scan) return res.status(404).json({ error: 'Nenhum scan completado encontrado' })
  const result = await pool.query('SELECT * FROM semantic_entities WHERE scan_id = $1 LIMIT 1000', [
    scan.id,
  ])
  const matches = result.rows
    .map(rowEntity)
    .map((entity) => {
      const haystack = [entity.name, entity.slug, entity.description, ...(entity.semanticLabels || [])]
        .join(' ')
        .toLowerCase()
      const confidence = haystack.includes(transcript) ? 0.9 : transcript.includes(entity.name.toLowerCase()) ? 0.75 : 0
      return { ...entity, confidence }
    })
    .filter((entity) => entity.confidence > 0)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3)
  res.json({ action: 'NAVIGATE', matches, fillValue: '' })
})

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'internal server error' })
})

await migrate()

if (!isVercel) {
  if (isProduction) {
    app.use(express.static(path.join(rootDir, 'dist')))
    app.get(/.*/, (_req, res) => res.sendFile(path.join(rootDir, 'dist', 'index.html')))
  } else {
    const { createServer } = await import('vite')
    const vite = await createServer({
      server: { middlewareMode: true, hmr: { port: Number(process.env.HMR_PORT || 24679) } },
      appType: 'spa',
      root: rootDir,
    })
    app.use(vite.middlewares)
  }

  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`)
  })
}

export default app
