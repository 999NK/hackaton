import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import express from 'express'
import jwt from 'jsonwebtoken'
import { migrate, pool, rowArtifact, rowEntity, rowFinding, rowProject, rowRelationship, rowScan } from './db.js'
import {
  getScannerToken,
  normalizeUpload,
  parseScannerUpload,
  receiveScannerUpload,
} from './scanner-upload.js'
import { classifyIntent, interpret } from './widget-nlu.js'

dotenv.config({ quiet: true })

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const app = express()
const isVercel = Boolean(process.env.VERCEL)
const isEntrypoint = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
const isProduction = process.env.NODE_ENV === 'production' || process.argv.includes('--production')
const port = Number(process.env.PORT || 8090)
const jwtSecret = process.env.JWT_SECRET || 'change-me-before-production'
const validEntityTypes = ['ROUTE', 'COMPONENT', 'API', 'FLOW', 'BUSINESS_RULE']
const validRelTypes = ['CONTAINS', 'CONSUMES', 'TRIGGERS', 'REDIRECTS', 'VALIDATES']
const MAX_SCANNER_CHUNK_BYTES = Math.floor(4.5 * 1024 * 1024)

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

function projectCors(_project, _req, res, methods) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', `${methods}, OPTIONS`)
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

async function findProjectByToken(token) {
  if (!token) return null
  try {
    const result = await pool.query(
      `SELECT p.* FROM projects p
     WHERE p.token = $1
        OR EXISTS (
          SELECT 1 FROM project_token_aliases a
          WHERE a.project_id = p.id AND a.token = $1 AND a.revoked_at IS NULL
        )
     LIMIT 1`,
      [token],
    )
    return result.rows[0] || null
  } catch (error) {
    const fallbackTokens = String(process.env.WIDGET_FALLBACK_TOKENS || '').split(',').map((value) => value.trim()).filter(Boolean)
    if (fallbackTokens.includes(token)) return { id: 'widget-fallback', name: 'Skip Widget', token, fallback: true }
    throw error
  }
}

function liveEntitiesFromRequest(body) {
  return (Array.isArray(body?.actions) ? body.actions : []).slice(0, 100).filter((item) => item?.id && item?.name).map((item) => ({
    id: String(item.id), type: String(item.type || 'COMPONENT'), name: String(item.name).slice(0, 120),
    path: String(item.path || ''), metadata: item.metadata && typeof item.metadata === 'object' ? item.metadata : {},
    semanticLabels: [], description: String(item.description || ''),
  }))
}

async function interpretWidgetCommandWithAI({ transcript, path, entities }) {
  if (!process.env.OPENAI_API_KEY || !entities.length) return null
  const choices = entities.slice(0, 100).map((entity) => ({ id: entity.id, name: entity.name, type: entity.type, path: entity.path || entity.metadata?.targetRoute || '', kind: entity.metadata?.kind || '' }))
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: process.env.OPENAI_WIDGET_MODEL || 'gpt-4o-mini', temperature: 0, response_format: { type: 'json_object' }, messages: [
      { role: 'system', content: 'Interprete comandos de acessibilidade em portugues. Escolha somente um id da lista. Nunca invente ids, seletores ou URLs. Responda JSON com action (NAVIGATE, CLICK, FILL, READ, HIGHLIGHT ou SETTINGS), targetId (ou string vazia), confidence de 0 a 1 e reason curta.' },
      { role: 'user', content: JSON.stringify({ command: transcript, currentPath: path, choices }) },
    ] }),
  })
  if (!response.ok) throw new Error(`OpenAI HTTP ${response.status}`)
  const payload = await response.json()
  const parsed = JSON.parse(payload.choices?.[0]?.message?.content || '{}')
  const match = entities.find((entity) => entity.id === parsed.targetId)
  const standalone = ['READ', 'HIGHLIGHT', 'SETTINGS'].includes(parsed.action)
  if (!match && !standalone) return null
  return { action: parsed.action || 'NAVIGATE', matches: match ? [{ ...match, confidence: Number(parsed.confidence || 0.8) }] : [], steps: match ? [{ action: parsed.action === 'FILL' ? 'WAIT_INPUT' : parsed.action, match, label: match.name, reason: parsed.reason || '' }] : [], suggestions: [], fillValue: '', interpretedBy: 'openai' }
}

async function latestCompletedScan(projectId) {
  const result = await pool.query(
    "SELECT * FROM scans WHERE project_id = $1 AND status = 'COMPLETED' ORDER BY created DESC LIMIT 1",
    [projectId],
  )
  return result.rows[0] || null
}

// O widget pode operar sobre um scan parcial (ex.: SAM recebido mas WCAG ainda
// pendente). Retorna o scan mais recente que tenha entidades semanticas, mesmo
// que o status geral seja PARTIAL.
async function latestScanForWidget(projectId) {
  const result = await pool.query(
    `SELECT s.* FROM scans s
     JOIN semantic_entities e ON e.scan_id = s.id
     WHERE s.project_id = $1
     ORDER BY s.created DESC
     LIMIT 1`,
    [projectId],
  )
  return result.rows[0] || (await latestCompletedScan(projectId))
}

async function ensureProjectAccess(projectId, userId) {
  const result = await pool.query('SELECT * FROM projects WHERE id = $1 AND owner_id = $2', [
    projectId,
    userId,
  ])
  return result.rows[0] || null
}

// Dual auth for scan read endpoints: accepts either a dashboard JWT (owner-scoped)
// or a project token (scanner/tooling). Sets req.authKind and req.user|req.project.
async function requireScanAccess(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) return res.status(401).json({ error: 'auth required' })
  try {
    const payload = jwt.verify(token, jwtSecret)
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [payload.sub])
    if (!result.rows[0]) return res.status(401).json({ error: 'auth required' })
    req.user = result.rows[0]
    req.authKind = 'jwt'
    return next()
  } catch {
    // not a valid JWT — try as a project token
  }
  const project = await findProjectByToken(token)
  if (project) {
    req.project = project
    req.authKind = 'token'
    return next()
  }
  return res.status(401).json({ error: 'auth required' })
}

// Loads a scan by internal id OR external_scan_id, scoped to the caller's auth.
// JWT callers must own the project; token callers must hold the project token.
// Returns { scan, project } or null (caller responds 404 to avoid leaking existence).
async function loadOwnedScan(scanId, req) {
  const result = await pool.query(
    `SELECT s.*, p.id AS project_id, p.owner_id, p.token AS project_token
     FROM scans s
     JOIN projects p ON p.id = s.project_id
     WHERE s.id = $1 OR s.external_scan_id = $1`,
    [scanId],
  )
  const row = result.rows[0]
  if (!row) return null
  if (req.authKind === 'jwt') {
    if (row.owner_id !== req.user.id) return null
  } else {
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
    if (row.project_token !== token) return null
  }
  const { project_id, owner_id, project_token, ...scan } = row
  return { scan, project: { id: project_id, ownerId: owner_id, token: project_token } }
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
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    if (body.token && body.token !== project.token) {
      await client.query(
        `INSERT INTO project_token_aliases (token, project_id)
         VALUES ($1, $2)
         ON CONFLICT (token) DO UPDATE SET project_id = EXCLUDED.project_id, revoked_at = NULL`,
        [project.token, project.id],
      )
    }
    const result = await client.query(
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
    await client.query('COMMIT')
    res.json(rowProject(result.rows[0]))
  } catch (error) {
    await client.query('ROLLBACK')
    res.status(500).json({ error: error.message || 'project update failed' })
  } finally {
    client.release()
  }
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
    "INSERT INTO scans (project_id, status, report, token, files_scanned, metadata) VALUES ($1, 'PROCESSING', '{}'::jsonb, $2, 0, '{}'::jsonb) RETURNING *",
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

// Scan read endpoints (dual-auth: JWT or project token).
const SCAN_PATHS = [
  '/api/scans/:scanId',
  '/backend/v1/scans/:scanId',
  '/backend/v1/api/scans/:scanId',
]

function parsePagination(query) {
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 25))
  return { page, pageSize, offset: (page - 1) * pageSize }
}

function issueOrderBy(sortBy, sortOrder) {
  const dir = String(sortOrder).toLowerCase() === 'desc' ? 'DESC' : 'ASC'
  const column =
    sortBy === 'ruleId'
      ? 'rule_id'
      : sortBy === 'filePath'
        ? 'file_path'
        : sortBy === 'occurrenceCount'
          ? 'occurrence_count'
          : null
  if (column) return `${column} ${dir}`
  // default: severity rank (critical first), then rule_id as tiebreaker
  const dirSecondary = sortBy == null && dir === 'DESC' ? 'DESC' : 'ASC'
  return `CASE severity
      WHEN 'critical' THEN 1 WHEN 'serious' THEN 2 WHEN 'moderate' THEN 3
      WHEN 'minor' THEN 4 WHEN 'unknown' THEN 5 ELSE 6 END ${dir}, rule_id ${dirSecondary}`
}

app.get(SCAN_PATHS, requireScanAccess, async (req, res) => {
  const loaded = await loadOwnedScan(req.params.scanId, req)
  if (!loaded) return res.status(404).json({ error: 'scan not found' })
  res.json(rowScan(loaded.scan))
})

app.get(
  [...SCAN_PATHS.map((p) => `${p}/artifacts`)],
  requireScanAccess,
  async (req, res) => {
    const loaded = await loadOwnedScan(req.params.scanId, req)
    if (!loaded) return res.status(404).json({ error: 'scan not found' })
    const result = await pool.query(
      'SELECT * FROM scan_artifacts WHERE scan_id = $1 ORDER BY created',
      [loaded.scan.id],
    )
    res.json({ scanId: loaded.scan.id, artifacts: result.rows.map(rowArtifact) })
  },
)

async function respondArtifactByType(req, res, artifactType, label) {
  const loaded = await loadOwnedScan(req.params.scanId, req)
  if (!loaded) return res.status(404).json({ error: 'scan not found' })
  const result = await pool.query(
    'SELECT * FROM scan_artifacts WHERE scan_id = $1 AND artifact_type = $2 ORDER BY created LIMIT 1',
    [loaded.scan.id, artifactType],
  )
  if (!result.rows[0]) {
    return res.status(404).json({ error: `artefato ${label} nao encontrado` })
  }
  const artifact = rowArtifact(result.rows[0])
  res.json({
    scanId: loaded.scan.id,
    artifactType: artifact.artifactType,
    filename: artifact.filename,
    artifact,
    content: artifact.rawContent,
  })
}

app.get(
  [...SCAN_PATHS.map((p) => `${p}/artifacts/semantic-map`)],
  requireScanAccess,
  async (req, res) => respondArtifactByType(req, res, 'semantic-map', 'semantic-map'),
)

app.get(
  [...SCAN_PATHS.map((p) => `${p}/artifacts/wcag-audit`)],
  requireScanAccess,
  async (req, res) => respondArtifactByType(req, res, 'wcag-audit', 'wcag-audit'),
)

async function respondIssues(req, res, ruleIdFilter) {
  const loaded = await loadOwnedScan(req.params.scanId, req)
  if (!loaded) return res.status(404).json({ error: 'scan not found' })

  const { page, pageSize, offset } = parsePagination(req.query)
  const where = ['scan_id = $1']
  const params = [loaded.scan.id]
  const pushParam = (value) => {
    params.push(value)
    return `$${params.length}`
  }

  if (ruleIdFilter) {
    where.push(`rule_id = ${pushParam(ruleIdFilter)}`)
  } else if (req.query.ruleId) {
    where.push(`rule_id = ${pushParam(String(req.query.ruleId))}`)
  }
  if (req.query.severity) {
    where.push(`severity = ${pushParam(String(req.query.severity).toLowerCase())}`)
  }
  if (req.query.file) {
    where.push(`file_path = ${pushParam(String(req.query.file))}`)
  }
  if (req.query.search) {
    const like = `%${String(req.query.search)}%`
    where.push(
      `(rule_id ILIKE ${pushParam(like)} OR selector ILIKE ${pushParam(like)} OR suggestion ILIKE ${pushParam(like)})`,
    )
  }

  const orderSql = issueOrderBy(req.query.sortBy, req.query.sortOrder)

  const countResult = await pool.query(
    `SELECT count(*)::int AS total FROM wcag_findings WHERE ${where.join(' AND ')}`,
    params,
  )
  const totalItems = countResult.rows[0]?.total || 0

  params.push(pageSize, offset)
  const listResult = await pool.query(
    `SELECT * FROM wcag_findings WHERE ${where.join(' AND ')} ORDER BY ${orderSql} LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  )

  res.json({
    items: listResult.rows.map(rowFinding),
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages: Math.max(0, Math.ceil(totalItems / pageSize)),
    },
  })
}

app.get(
  [...SCAN_PATHS.map((p) => `${p}/issues`)],
  requireScanAccess,
  async (req, res) => respondIssues(req, res, null),
)

app.get(
  [...SCAN_PATHS.map((p) => `${p}/issues/:ruleId`)],
  requireScanAccess,
  async (req, res) => respondIssues(req, res, decodeURIComponent(req.params.ruleId)),
)

const scannerRoutes = ['/api/scanner', '/backend/v1/scanner', '/backend/v1/api/scanner']
const scannerChunkInitRoutes = scannerRoutes.map((route) => `${route}/chunks/init`)
const scannerChunkRoutes = scannerRoutes.map((route) => `${route}/chunks/:uploadId`)
const scannerChunkCompleteRoutes = scannerRoutes.map((route) => `${route}/chunks/:uploadId/complete`)

function scannerCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Skip-Token')
}

async function scannerProject(req, body = {}) {
  const token = getScannerToken(req, body)
  if (!token) return { token: '', project: null }
  return { token, project: await findProjectByToken(token) }
}

app.options([...scannerChunkInitRoutes, ...scannerChunkRoutes, ...scannerChunkCompleteRoutes], (_req, res) => {
  scannerCors(res)
  res.status(204).end()
})

app.post(scannerChunkInitRoutes, async (req, res) => {
  scannerCors(res)
  const { token, project } = await scannerProject(req, req.body)
  if (!token) return res.status(401).json({ error: 'Token ausente' })
  if (!project) return res.status(401).json({ error: 'Token invalido' })
  const scanId = String(req.body?.scanId || '').trim()
  const artifacts = Array.isArray(req.body?.artifacts) ? req.body.artifacts : []
  if (!scanId || !artifacts.length) return res.status(400).json({ error: 'scanId e artifacts sao obrigatorios' })
  const uploadId = `upl_${crypto.randomUUID()}`
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      `INSERT INTO scanner_chunk_uploads
         (upload_id, project_id, scan_id, schema_version, bundle_version, manifest, artifacts)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [uploadId, project.id, scanId, req.body?.schemaVersion || '', req.body?.bundleVersion || '', req.body?.manifest || {}, JSON.stringify(artifacts)],
    )
    await client.query('COMMIT')
    res.status(201).json({ uploadId, scanId, accepted: true, maxChunkBytes: MAX_SCANNER_CHUNK_BYTES })
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
})

app.post(scannerChunkRoutes, async (req, res, next) => {
  if (req.path.endsWith('/complete')) return next()
  scannerCors(res)
  const parsed = await parseScannerUpload(req)
  if (parsed.kind !== 'multipart') return res.status(400).json({ error: 'Chunk deve usar multipart/form-data' })
  const { token, project } = await scannerProject(req, { fields: parsed.fields })
  if (!token) return res.status(401).json({ error: 'Token ausente' })
  if (!project) return res.status(401).json({ error: 'Token invalido' })
  const fields = parsed.fields || {}
  const file = parsed.files?.find((item) => item.fieldname === 'chunk') || parsed.files?.[0]
  if (!file) return res.status(400).json({ error: 'Arquivo chunk ausente' })
  if (file.buffer.length > MAX_SCANNER_CHUNK_BYTES) return res.status(413).json({ error: 'Chunk excede 4.5 MB' })
  const chunkIndex = Number(fields.chunkIndex)
  const totalChunks = Number(fields.totalChunks)
  const offset = Number(fields.offset)
  const artifactSizeBytes = Number(fields.artifactSizeBytes)
  const computedChunkHash = crypto.createHash('sha256').update(file.buffer).digest('hex')
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || !Number.isInteger(totalChunks) || totalChunks < 1 || offset < 0) {
    return res.status(400).json({ error: 'Metadados do chunk invalidos' })
  }
  if (computedChunkHash !== fields.chunkSha256) return res.status(422).json({ error: 'chunkSha256 divergente' })
  const session = await pool.query('SELECT * FROM scanner_chunk_uploads WHERE upload_id = $1 AND project_id = $2', [req.params.uploadId, project.id])
  if (!session.rowCount) return res.status(404).json({ error: 'Upload nao encontrado' })
  if (session.rows[0].scan_id !== fields.scanId) return res.status(409).json({ error: 'scanId divergente' })
  await pool.query(
    `INSERT INTO scanner_upload_chunks
       (upload_id, artifact_id, filename, chunk_index, total_chunks, byte_offset, chunk_sha256, artifact_sha256, artifact_size_bytes, content)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (upload_id, artifact_id, chunk_index)
     DO UPDATE SET filename=EXCLUDED.filename,total_chunks=EXCLUDED.total_chunks,byte_offset=EXCLUDED.byte_offset,
                   chunk_sha256=EXCLUDED.chunk_sha256,artifact_sha256=EXCLUDED.artifact_sha256,
                   artifact_size_bytes=EXCLUDED.artifact_size_bytes,content=EXCLUDED.content`,
    [req.params.uploadId, fields.artifactId, fields.filename, chunkIndex, totalChunks, offset, computedChunkHash, fields.artifactSha256, artifactSizeBytes, file.buffer],
  )
  res.json({ accepted: true, uploadId: req.params.uploadId, artifactId: fields.artifactId, chunkIndex, receivedBytes: file.buffer.length })
})

app.post(scannerChunkCompleteRoutes, async (req, res) => {
  scannerCors(res)
  const { token, project } = await scannerProject(req, req.body)
  if (!token) return res.status(401).json({ error: 'Token ausente' })
  if (!project) return res.status(401).json({ error: 'Token invalido' })
  const sessionResult = await pool.query('SELECT * FROM scanner_chunk_uploads WHERE upload_id = $1 AND project_id = $2', [req.params.uploadId, project.id])
  if (!sessionResult.rowCount) return res.status(404).json({ error: 'Upload nao encontrado' })
  const session = sessionResult.rows[0]
  if (session.scan_id !== req.body?.scanId) return res.status(409).json({ error: 'scanId divergente' })
  const declaredArtifacts = Array.isArray(req.body?.artifacts) ? req.body.artifacts : session.artifacts
  const artifacts = []
  const hashMismatches = []
  for (const declared of declaredArtifacts) {
    const chunksResult = await pool.query(
      'SELECT * FROM scanner_upload_chunks WHERE upload_id=$1 AND artifact_id=$2 ORDER BY chunk_index',
      [req.params.uploadId, declared.artifactId],
    )
    const chunks = chunksResult.rows
    const expectedTotal = chunks[0]?.total_chunks ?? 0
    if (!chunks.length || chunks.length !== expectedTotal || chunks.some((chunk, index) => chunk.chunk_index !== index)) {
      return res.status(409).json({ error: `Chunks incompletos para ${declared.filename}` })
    }
    let expectedOffset = 0
    for (const chunk of chunks) {
      if (Number(chunk.byte_offset) !== expectedOffset) return res.status(409).json({ error: `Offset invalido para ${declared.filename}` })
      expectedOffset += chunk.content.length
    }
    const buffer = Buffer.concat(chunks.map((chunk) => chunk.content))
    const artifactHash = crypto.createHash('sha256').update(buffer).digest('hex')
    const expectedHash = declared.sha256 || chunks[0].artifact_sha256
    const expectedSize = Number(declared.sizeBytes ?? chunks[0].artifact_size_bytes)
    if (buffer.length !== expectedSize || artifactHash !== expectedHash) {
      hashMismatches.push(declared.filename)
      continue
    }
    const rawText = buffer.toString('utf8')
    let content
    try { content = JSON.parse(rawText) } catch { content = rawText }
    artifacts.push({
      artifactId: declared.artifactId,
      artifactType: declared.artifactType,
      filename: declared.filename,
      contentType: declared.contentType || 'application/json',
      content,
      rawText,
      sizeBytes: buffer.length,
      sha256: artifactHash,
      schemaVersion: declared.schemaVersion || session.schema_version,
      required: declared.required,
    })
  }
  if (hashMismatches.length) return res.status(422).json({ error: 'Hash/tamanho divergente', hashMismatches })
  if (artifacts.length !== declaredArtifacts.length) return res.status(409).json({ error: 'Upload incompleto' })
  const response = await receiveScannerUpload({
    pool, project, token,
    upload: { scanId: session.scan_id, schemaVersion: session.schema_version, bundleVersion: session.bundle_version, manifest: req.body?.manifest || session.manifest, artifacts, observed: { method: 'POST', contentType: 'chunked', route: req.originalUrl, uploadId: req.params.uploadId } },
  })
  await pool.query("UPDATE scanner_chunk_uploads SET status='complete',updated=now() WHERE upload_id=$1", [req.params.uploadId])
  res.status(202).json(response)
})

app.options(scannerRoutes, (_req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Skip-Token')
  res.status(204).end()
})

app.post(scannerRoutes, async (req, res) => {
  const parsed = await parseScannerUpload(req)
  const upload = normalizeUpload(parsed)
  upload.observed.route = req.originalUrl || req.url
  const token = getScannerToken(req, parsed.kind === 'multipart' ? { fields: parsed.fields } : parsed.body)
  if (!token) return res.status(401).json({ error: 'Token ausente' })
  const project = await findProjectByToken(token)
  if (!project) return res.status(401).json({ error: 'Token invalido' })

  const response = await receiveScannerUpload({ pool, project, token, upload })
  res.status(202).json(response)
})

app.get(
  [
    '/api/scanner/status/:scanId',
    '/backend/v1/scanner/status/:scanId',
    '/backend/v1/api/scanner/status/:scanId',
  ],
  async (req, res) => {
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : ''
    if (!token) return res.status(401).json({ error: 'Token ausente' })
    const result = await pool.query(
      `SELECT s.*, p.token AS project_token
       FROM scans s
       JOIN projects p ON p.id = s.project_id
       WHERE s.id = $1 OR s.external_scan_id = $1`,
      [req.params.scanId],
    )
    const scan = result.rows[0]
    if (!scan) return res.status(404).json({ error: 'Scan nao encontrado' })
    if (scan.project_token !== token && scan.token !== token) return res.status(401).json({ error: 'Token invalido' })
    res.json({
      scanId: scan.id,
      externalScanId: scan.external_scan_id || '',
      status: scan.status,
      entitiesCount: scan.entities_count || 0,
      expectedArtifacts: scan.expected_artifacts || 0,
      receivedArtifacts: scan.received_artifacts || 0,
      validArtifacts: scan.valid_artifacts || 0,
      errorMessage: scan.error_message || null,
    })
  },
)

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
         (project_id, status, phase, phase_detail, files_count, files_scanned, files_uploaded, secrets_found, token_budget, token_used, report, token, metadata)
       VALUES ($1, 'PROCESSING', 'Ingesting', 'Processing manually pasted semantic data', $2, $2, 0, 0, 0, 0, '{}'::jsonb, $3, '{}'::jsonb)
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
  projectCors(null, req, res, ['command', 'tts', 'screen'].includes(req.params.endpoint) ? 'POST' : 'GET')
  res.status(204).end()
})

app.get('/backend/v1/widget/config', async (req, res) => {
  const project = await findProjectByToken(req.query.token || '')
  projectCors(project, req, res, 'GET')
  if (!project) return res.status(401).json({ error: 'Token invalido' })
  const scan = await latestScanForWidget(project.id)
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
  const scan = await latestScanForWidget(project.id)
  if (!scan) return res.json({ routes: [] })
  const result = await pool.query(
    "SELECT * FROM semantic_entities WHERE scan_id = $1 AND type = 'ROUTE' ORDER BY name LIMIT 1000",
    [scan.id],
  )
  const seenPaths = new Set()
  const routes = result.rows
    .map(rowEntity)
    .filter((route) => route.path && !seenPaths.has(route.path) && seenPaths.add(route.path))
  res.json({ routes })
})

app.get('/backend/v1/widget/entities', async (req, res) => {
  const project = await findProjectByToken(req.query.token || '')
  projectCors(project, req, res, 'GET')
  if (!project) return res.status(401).json({ error: 'Token invalido' })
  const scan = await latestScanForWidget(project.id)
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

async function loadScanContext(projectId) {
  const scan = await latestScanForWidget(projectId)
  if (!scan) return null
  const [entResult, relResult] = await Promise.all([
    pool.query('SELECT * FROM semantic_entities WHERE scan_id = $1 LIMIT 1000', [scan.id]),
    pool.query('SELECT * FROM relationships WHERE scan_id = $1', [scan.id]),
  ])
  return {
    scan,
    entities: entResult.rows.map(rowEntity),
    relationships: relResult.rows.map(rowRelationship),
  }
}

app.post('/backend/v1/widget/command', async (req, res) => {
  const project = await findProjectByToken(req.query.token || '')
  projectCors(project, req, res, 'POST')
  if (!project) return res.status(401).json({ error: 'Token invalido' })
  const transcript = String(req.body?.transcript || '').trim()
  if (!transcript) return res.status(400).json({ error: 'transcript obrigatorio' })
  const liveEntities = liveEntitiesFromRequest(req.body)
  let ctx = null
  if (!project.fallback) {
    try { ctx = await loadScanContext(project.id) } catch { ctx = null }
  }
  const entities = [...(ctx?.entities || []), ...liveEntities]
  if (!entities.length) return res.status(503).json({ error: 'Mapa temporariamente indisponivel', fallback: true })
  try {
    const aiResponse = await interpretWidgetCommandWithAI({ transcript, path: String(req.body?.path || ''), entities })
    if (aiResponse) return res.json(aiResponse)
  } catch (error) {
    console.error('widget AI fallback:', error.message)
  }
  res.json(interpret({ transcript, path: String(req.body?.path || ''), entities, relationships: ctx?.relationships || [] }))
})

// Normaliza um rotulo cru (ex.: "btn-submit", "input#email") em uma frase
// falada em portugues, prefixando o papel do elemento. Deterministico, sem IA.
app.post('/backend/v1/widget/tts', async (req, res) => {
  const project = await findProjectByToken(req.query.token || '')
  projectCors(project, req, res, 'POST')
  if (!project) return res.status(401).json({ error: 'Token invalido' })
  const text = String(req.body?.text || req.body?.label || '').replace(/\s+/g, ' ').trim()
  const role = String(req.body?.role || '').toLowerCase()
  if (!text) return res.json({ speech: '' })
  const cleaned = text
    .replace(/[.#:()>[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const prefix =
    {
      button: 'Botão: ',
      a: 'Link: ',
      link: 'Link: ',
      input: 'Campo: ',
      textarea: 'Campo: ',
      select: 'Lista: ',
      label: 'Rótulo: ',
      h1: 'Título: ',
      h2: 'Título: ',
      h3: 'Título: ',
      img: 'Imagem: ',
    }[role] || ''
  res.json({ speech: (prefix + cleaned).trim() })
})

// Analise deterministica de tela a partir do DOM coletado pelo widget + SAM.
// Sem provedor de IA: resume textos visiveis, lista campos/acoes e responde a
// perguntas por extracao de palavras-chave contra o conteudo visivel.
app.post('/backend/v1/widget/screen', async (req, res) => {
  const project = await findProjectByToken(req.query.token || '')
  projectCors(project, req, res, 'POST')
  if (!project) return res.status(401).json({ error: 'Token invalido' })
  const domText = String(req.body?.domText || '')
  const question = String(req.body?.question || '').trim().toLowerCase()
  const path = String(req.body?.path || '')

  const lines = domText.split('\n').map((l) => l.trim()).filter(Boolean)
  const visibleText = []
  const fields = []
  const actions = []
  for (const line of lines) {
    const idx = line.indexOf(':')
    if (idx < 0) {
      if (line.length < 400) visibleText.push(line)
      continue
    }
    const tag = line.slice(0, idx).toLowerCase()
    const value = line.slice(idx + 1).trim()
    if (!value) continue
    if (['button', 'a'].includes(tag)) actions.push(value)
    else if (['input', 'textarea', 'select', 'label'].includes(tag)) fields.push(value)
    else if (value.length < 400) visibleText.push(value)
  }

  // Enriquece com acoes/rotas do SAM para a rota atual quando disponivel.
  const ctx = await loadScanContext(project.id)
  if (ctx) {
    for (const e of ctx.entities) {
      if (e.path && path && e.path === path) visibleText.push(e.name)
      if (['LINK', 'BUTTON'].includes(e.type) && !actions.includes(e.name)) actions.push(e.name)
    }
  }

  // Resposta por correspondencia de palavras-chave da pergunta nos textos.
  let answer = ''
  if (question) {
    const qTokens = question.split(/\s+/).filter((t) => t.length > 2)
    const scored = visibleText
      .map((t) => ({ t, hits: qTokens.filter((q) => t.toLowerCase().includes(q)).length }))
      .filter((x) => x.hits > 0)
      .sort((a, b) => b.hits - a.hits)
    if (scored.length) answer = scored.slice(0, 3).map((x) => x.t).join('. ')
  }

  const possibleQuestions = []
  if (fields.length) possibleQuestions.push('Quais campos preciso preencher?')
  if (actions.length) possibleQuestions.push('O que posso clicar nesta tela?')
  if (visibleText.length) possibleQuestions.push('O que esta tela faz?')

  res.json({
    analysis: {
      summary: visibleText.slice(0, 3).join(' ') || 'Tela sem conteúdo textual identificável.',
      visibleText: visibleText.slice(0, 12),
      fields: dedupe(fields).slice(0, 12),
      actions: dedupe(actions).slice(0, 12),
      possibleQuestions,
      warnings: [],
    },
    answer,
  })
})

function dedupe(arr) {
  return Array.from(new Set(arr.map((v) => String(v).trim()).filter(Boolean)))
}

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'internal server error' })
})

await migrate()

if (!isVercel && isEntrypoint) {
  const skipVite = process.env.SKIP_VITE === 'true'

  if (isProduction) {
    // Serve the built frontend in production
    app.use(express.static(path.join(rootDir, 'dist')))
    app.get(/.*/, (_req, res) => res.sendFile(path.join(rootDir, 'dist', 'index.html')))
  } else if (!skipVite) {
    // Embedded Vite middleware mode (legacy single-port mode)
    const { createServer } = await import('vite')
    const vite = await createServer({
      server: { middlewareMode: true, hmr: { port: Number(process.env.HMR_PORT || 24679) } },
      appType: 'spa',
      root: rootDir,
    })
    app.use(vite.middlewares)
  }
  // When SKIP_VITE=true: only the API is served — Vite runs separately on port 8080
  // and proxies /api/* and /backend/* requests here (port 8090)

  app.listen(port, () => {
    if (skipVite || isProduction) {
      console.log(`API server running at http://localhost:${port}`)
    } else {
      console.log(`Server running at http://localhost:${port}`)
    }
  })
}

export default app
