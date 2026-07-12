import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { after, before, describe, it } from 'node:test'
import app from '../index.js'
import { pool } from '../db.js'

let server
let baseUrl
let project
let authToken
let userId

function textBytes(value) {
  return Buffer.byteLength(value)
}

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

async function postJson(path, token, body) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
}

function makeBundle(scanId) {
  const files = {
    '.skip-report.json': {
      scanId,
      schemaVersion: '1.0.0',
      scannerVersion: '0.6.0',
      projectName: 'Scanner Contract Test',
      framework: 'vite-react',
      language: 'TypeScript',
      stats: { files: 3 },
    },
    '.skip-sam.json': {
      scanId,
      schemaVersion: '1.0.0',
      entities: [
        { id: 'route-home', type: 'ROUTE', name: 'Home', slug: 'home', path: '/' },
        { id: 'button-submit', type: 'COMPONENT', name: 'Enviar', slug: 'enviar' },
      ],
      relationships: [
        { source: 'route-home', target: 'button-submit', type: 'CONTAINS' },
      ],
    },
    '.skip-wcag-audit.json': {
      scanId,
      score: 94,
      level: 'AA',
      violations: [
        {
          id: 'button-name',
          rule: '4.1.2 Name, Role, Value',
          severity: 'serious',
          filePath: 'src/App.tsx',
          selector: 'button',
          fix: 'Adicione texto acessivel ao botao.',
          source: { filePath: 'src/App.tsx', line: 10, column: 5 },
        },
        {
          id: 'contrast-review',
          rule: '1.4.3 Contrast',
          severity: 'unknown',
          filePath: 'src/App.tsx',
          selector: '.muted',
          source: { filePath: 'src/App.tsx', line: 20, column: 7 },
        },
      ],
    },
    'scan-file-manifest.json': {
      scanId,
      files: [{ filePath: 'src/App.tsx', sizeBytes: 123, sha256: 'abc' }],
    },
    'scan-validation.json': {
      scanId,
      valid: true,
      checks: [{ name: 'sam', valid: true }],
    },
  }

  const entries = Object.entries(files).map(([filename, content]) => {
    const raw = JSON.stringify(content)
    return {
      filename,
      raw,
      artifactType:
        filename === '.skip-report.json'
          ? 'report'
          : filename === '.skip-sam.json'
            ? 'semantic-map'
            : filename === '.skip-wcag-audit.json'
              ? 'wcag-audit'
              : filename === 'scan-file-manifest.json'
                ? 'file-manifest'
                : 'validation',
      sizeBytes: textBytes(raw),
      sha256: hash(raw),
      schemaVersion: '1.0.0',
      required: true,
    }
  })

  const uploadManifest = {
    scanId,
    schemaVersion: '1.0.0',
    bundleVersion: '1.0.0',
    expectedFileCount: entries.length + 1,
    files: [
      ...entries.map(({ raw, ...item }) => item),
      {
        filename: 'upload-manifest.json',
        artifactType: 'upload-manifest',
        schemaVersion: '1.0.0',
        required: true,
      },
    ],
  }

  const uploadManifestRaw = JSON.stringify(uploadManifest)
  return [...entries, {
    filename: 'upload-manifest.json',
    artifactType: 'upload-manifest',
    raw: uploadManifestRaw,
    sizeBytes: textBytes(uploadManifestRaw),
    sha256: hash(uploadManifestRaw),
    schemaVersion: '1.0.0',
    required: true,
  }]
}

async function cleanup() {
  if (!project) return
  const scans = await pool.query('SELECT id FROM scans WHERE project_id = $1', [project.id])
  for (const scan of scans.rows) {
    await pool.query('DELETE FROM relationships WHERE scan_id = $1', [scan.id])
    await pool.query('DELETE FROM semantic_entities WHERE scan_id = $1', [scan.id])
    await pool.query('DELETE FROM wcag_findings WHERE scan_id = $1', [scan.id])
    await pool.query('DELETE FROM scan_artifacts WHERE scan_id = $1', [scan.id])
  }
  await pool.query('DELETE FROM scans WHERE project_id = $1', [project.id])
  await pool.query('DELETE FROM projects WHERE id = $1', [project.id])
  if (userId) await pool.query('DELETE FROM users WHERE id = $1', [userId])
}

before(async () => {
  server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
  const token = `test-${crypto.randomUUID()}`
  const register = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `scanner-${crypto.randomUUID()}@example.test`,
      password: 'test-password',
    }),
  })
  assert.equal(register.status, 201)
  const auth = await register.json()
  authToken = auth.token
  userId = auth.user.id
  const result = await pool.query(
    `INSERT INTO projects (name, token, base_url, framework, language, user_id, owner_id)
     VALUES ($1, $2, $3, $4, $5, $6, $6)
     RETURNING *`,
    ['Scanner Contract Test', token, 'http://localhost.test', 'vite-react', 'TypeScript', userId],
  )
  project = result.rows[0]
})

after(async () => {
  await cleanup()
  await new Promise((resolve) => server.close(resolve))
  await pool.end()
})

describe('scanner upload contract', () => {
  it('rejects missing and invalid scanner tokens', async () => {
    const missing = await postJson('/backend/v1/api/scanner', '', { scanId: 'missing-token' })
    assert.equal(missing.status, 401)

    const invalid = await postJson('/backend/v1/api/scanner', 'bad-token', { scanId: 'bad-token' })
    assert.equal(invalid.status, 401)
  })

  it('accepts legacy JSON report as partial without inventing SAM or WCAG', async () => {
    const response = await postJson('/backend/v1/api/scanner', project.token, {
      scanId: 'legacy-json',
      projectName: project.name,
      routes: ['/'],
    })
    assert.equal(response.status, 202)
    const body = await response.json()
    assert.equal(body.status, 'partial')
    assert.equal(body.receivedArtifacts, 1)
    assert.ok(body.missingArtifacts.includes('.skip-sam.json'))

    const saved = await pool.query('SELECT * FROM scans WHERE id = $1', [body.scanId])
    assert.equal(saved.rows[0].status, 'PARTIAL')
    assert.equal(saved.rows[0].report.semanticMap.status, 'missing')
    assert.equal(saved.rows[0].report.wcag.scoreStatus, 'unavailable')
  })

  it('accepts isolated SAM for an existing scan without requiring navigationMap, routes or wcag', async () => {
    const response = await postJson('/backend/v1/api/scanner', project.token, {
      scanId: 'isolated-sam',
      artifactType: 'semantic-map',
      filename: '.skip-sam.json',
      payload: {
        scanId: 'isolated-sam',
        entities: [{ id: 'route-settings', type: 'ROUTE', name: 'Settings', path: '/settings' }],
        relationships: [],
      },
    })
    assert.equal(response.status, 202)
    const body = await response.json()
    assert.equal(body.status, 'partial')
    assert.equal(body.artifacts[0].filename, '.skip-sam.json')
    assert.equal(body.artifacts[0].valid, true)

    const entities = await pool.query(
      `SELECT e.* FROM semantic_entities e
       JOIN scans s ON s.id = e.scan_id
       WHERE s.external_scan_id = $1`,
      ['isolated-sam'],
    )
    assert.equal(entities.rowCount, 1)
  })

  it('accepts multipart bundle, persists every required artifact, processes SAM and WCAG findings', async () => {
    const scanId = 'multipart-complete'
    const form = new FormData()
    form.set('scanId', scanId)
    form.set('schemaVersion', '1.0.0')
    form.set('bundleVersion', '1.0.0')
    for (const item of makeBundle(scanId)) {
      form.append(
        'artifacts[]',
        new Blob([item.raw], { type: 'application/json' }),
        item.filename,
      )
    }

    const response = await fetch(`${baseUrl}/backend/v1/api/scanner`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${project.token}` },
      body: form,
    })
    assert.equal(response.status, 202)
    const body = await response.json()
    assert.equal(body.status, 'complete')
    assert.equal(body.receivedArtifacts, 6)
    assert.equal(body.validArtifacts, 6)
    assert.deepEqual(body.missingArtifacts, [])

    const scan = await pool.query('SELECT * FROM scans WHERE id = $1', [body.scanId])
    assert.equal(scan.rows[0].status, 'COMPLETED')
    assert.equal(scan.rows[0].received_artifacts, 6)
    assert.equal(scan.rows[0].valid_artifacts, 6)
    assert.equal(scan.rows[0].report.wcag.summary.serious, 1)
    assert.equal(scan.rows[0].report.wcag.summary.unknown, 1)

    const artifacts = await pool.query('SELECT filename FROM scan_artifacts WHERE scan_id = $1', [body.scanId])
    assert.deepEqual(
      artifacts.rows.map((row) => row.filename).sort(),
      [
        '.skip-report.json',
        '.skip-sam.json',
        '.skip-wcag-audit.json',
        'scan-file-manifest.json',
        'scan-validation.json',
        'upload-manifest.json',
      ].sort(),
    )

    const entities = await pool.query('SELECT * FROM semantic_entities WHERE scan_id = $1', [body.scanId])
    const relationships = await pool.query('SELECT * FROM relationships WHERE scan_id = $1', [body.scanId])
    const findings = await pool.query('SELECT * FROM wcag_findings WHERE scan_id = $1', [body.scanId])
    assert.equal(entities.rowCount, 2)
    assert.equal(relationships.rowCount, 1)
    assert.equal(findings.rowCount, 2)

    const dashboardScans = await fetch(`${baseUrl}/api/scans?projectId=${project.id}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
    assert.equal(dashboardScans.status, 200)
    const scans = await dashboardScans.json()
    assert.ok(scans.some((scan) => scan.id === body.scanId && scan.report.wcag.summary.serious === 1))

    const dashboardEntities = await fetch(`${baseUrl}/api/entities?scanId=${body.scanId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
    assert.equal(dashboardEntities.status, 200)
    assert.equal((await dashboardEntities.json()).length, 2)

    const dashboardRelationships = await fetch(`${baseUrl}/api/relationships?scanId=${body.scanId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
    assert.equal(dashboardRelationships.status, 200)
    assert.equal((await dashboardRelationships.json()).length, 1)
  })
})
