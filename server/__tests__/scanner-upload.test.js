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

async function postMultipart(path, token, { scanId, fields = {}, entries }) {
  const form = new FormData()
  form.set('scanId', scanId)
  form.set('schemaVersion', '1.0.0')
  form.set('bundleVersion', '1.0.0')
  for (const [key, value] of Object.entries(fields)) form.set(key, String(value))
  for (const item of entries) {
    form.append('artifacts[]', new Blob([item.raw], { type: 'application/json' }), item.filename)
    // Mirror the real @skip-ai/scanner sidecar fields per artifact.
    if (item.artifactType) form.append(`${item.filename}:artifactType`, item.artifactType)
    if (item.sha256) form.append(`${item.filename}:sha256`, item.sha256)
    if (item.sizeBytes != null) form.append(`${item.filename}:sizeBytes`, String(item.sizeBytes))
  }
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
}

function artifactEntry(filename, content, overrides = {}) {
  const raw = typeof content === 'string' ? content : JSON.stringify(content)
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
              : filename === 'upload-manifest.json'
                ? 'upload-manifest'
                : 'validation',
    sizeBytes: textBytes(raw),
    sha256: hash(raw),
    schemaVersion: '1.0.0',
    required: true,
    ...overrides,
  }
}

// Builds the canonical 6-artifact bundle for a scanId. The upload-manifest is
// always rebuilt from the authoritative file entries, so any content/field
// override produces a self-consistent bundle.
//   buildSixArtifactBundle(scanId, {
//     contentOverrides: { '.skip-sam.json': { entities: [], relationships: [] } },
//     entryOverrides:   { '.skip-report.json': { sha256: '0'.repeat(64) } },
//   })
function buildSixArtifactBundle(scanId, { contentOverrides = {}, entryOverrides = {} } = {}) {
  const defaultContents = {
    '.skip-report.json': {
      scanId,
      schemaVersion: '1.0.0',
      scannerVersion: '0.7.0',
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
      relationships: [{ source: 'route-home', target: 'button-submit', type: 'CONTAINS' }],
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
    'scan-validation.json': { scanId, valid: true, checks: [{ name: 'sam', valid: true }] },
  }

  const fileEntries = []
  for (const [filename, defaultContent] of Object.entries(defaultContents)) {
    const content = filename in contentOverrides ? contentOverrides[filename] : defaultContent
    fileEntries.push(artifactEntry(filename, content, entryOverrides[filename]))
  }

  // upload-manifest references the final (possibly overridden) file metadata,
  // so a content override does not trigger a spurious hash/size mismatch.
  const manifestContent = {
    scanId,
    schemaVersion: '1.0.0',
    bundleVersion: '1.0.0',
    expectedFileCount: fileEntries.length + 1,
    files: [
      ...fileEntries.map(({ raw, ...meta }) => meta),
      { filename: 'upload-manifest.json', artifactType: 'upload-manifest', schemaVersion: '1.0.0', required: true },
    ],
  }
  const manifestEntry = artifactEntry('upload-manifest.json', manifestContent)
  return [...fileEntries, manifestEntry]
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
    [`Scanner Contract Test ${crypto.randomUUID().slice(0, 8)}`, token, 'http://localhost.test', 'vite-react', 'TypeScript', userId],
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

describe('scanner upload edge cases', () => {
  it('response envelope matches the full detailed contract shape', async () => {
    const scanId = 'shape-envelope'
    const response = await postMultipart('/backend/v1/api/scanner', project.token, {
      scanId,
      entries: buildSixArtifactBundle(scanId),
    })
    assert.equal(response.status, 202)
    const body = await response.json()
    // Top-level fields (spec #16 / #30)
    for (const key of [
      'scanId',
      'externalScanId',
      'accepted',
      'status',
      'expectedArtifacts',
      'receivedArtifacts',
      'validArtifacts',
      'persistedArtifacts',
      'artifacts',
      'missingArtifacts',
      'invalidArtifacts',
      'hashMismatches',
      'warnings',
    ]) {
      assert.ok(key in body, `missing top-level field ${key}`)
    }
    assert.equal(body.accepted, true)
    assert.equal(body.status, 'complete')
    assert.equal(body.expectedArtifacts, 6)
    assert.equal(body.persistedArtifacts, 6)
    assert.deepEqual(body.missingArtifacts, [])
    assert.deepEqual(body.invalidArtifacts, [])
    // Per-artifact fields
    for (const artifact of body.artifacts) {
      for (const key of ['artifactType', 'filename', 'received', 'valid', 'persisted', 'processed', 'sizeBytes', 'sha256']) {
        assert.ok(key in artifact, `artifact ${artifact.filename} missing ${key}`)
      }
      assert.equal(artifact.received, true)
      assert.equal(artifact.valid, true)
      assert.equal(artifact.persisted, true)
      assert.equal(artifact.processed, true)
      assert.ok(artifact.sha256.length === 64)
    }
  })

  it('flags a hash mismatch when the manifest sha256 disagrees with the file', async () => {
    const scanId = 'hash-mismatch'
    const entries = buildSixArtifactBundle(scanId, {
      entryOverrides: {
        // Declare a wrong manifest-side hash for the report. The upload-manifest
        // is regenerated below referencing this wrong hash.
        '.skip-report.json': { sha256: '0'.repeat(64) },
      },
    })
    // Rebuild the upload-manifest with the overridden report sha256 so the
    // validator sees the divergence.
    const reportEntry = entries.find((e) => e.filename === '.skip-report.json')
    const manifestContent = {
      scanId,
      schemaVersion: '1.0.0',
      bundleVersion: '1.0.0',
      expectedFileCount: 6,
      files: entries
        .filter((e) => e.filename !== 'upload-manifest.json')
        .map(({ raw, ...m }) => (m.filename === '.skip-report.json' ? { ...m, sha256: '0'.repeat(64) } : m)),
    }
    const manifestEntry = artifactEntry('upload-manifest.json', manifestContent)
    const finalEntries = [...entries.filter((e) => e.filename !== 'upload-manifest.json'), manifestEntry]

    const response = await postMultipart('/backend/v1/api/scanner', project.token, {
      scanId,
      entries: finalEntries,
    })
    assert.equal(response.status, 202)
    const body = await response.json()
    assert.equal(body.status, 'failed')
    assert.ok(body.hashMismatches.some((m) => m.includes('.skip-report.json')))
    assert.ok(body.invalidArtifacts.includes('upload-manifest.json'))
  })

  it('flags a size mismatch when the manifest sizeBytes disagrees with the file', async () => {
    const scanId = 'size-mismatch'
    const entries = buildSixArtifactBundle(scanId, {
      entryOverrides: { '.skip-report.json': { sizeBytes: 99999 } },
    })
    const manifestContent = {
      scanId,
      schemaVersion: '1.0.0',
      bundleVersion: '1.0.0',
      expectedFileCount: 6,
      files: entries
        .filter((e) => e.filename !== 'upload-manifest.json')
        .map(({ raw, ...m }) => (m.filename === '.skip-report.json' ? { ...m, sizeBytes: 99999 } : m)),
    }
    const manifestEntry = artifactEntry('upload-manifest.json', manifestContent)
    const finalEntries = [...entries.filter((e) => e.filename !== 'upload-manifest.json'), manifestEntry]

    const response = await postMultipart('/backend/v1/api/scanner', project.token, {
      scanId,
      entries: finalEntries,
    })
    const body = await response.json()
    assert.equal(body.status, 'failed')
    assert.ok(body.invalidArtifacts.includes('upload-manifest.json'))
  })

  it('rejects a SAM whose scanId diverges from the upload scanId', async () => {
    const scanId = 'scanid-divergent'
    const entries = buildSixArtifactBundle(scanId, {
      entryOverrides: {
        '.skip-sam.json': null,
      },
    })
    const samContent = {
      scanId: 'some-other-scan',
      schemaVersion: '1.0.0',
      entities: [{ id: 'route-home', type: 'ROUTE', name: 'Home', path: '/' }],
      relationships: [],
    }
    const samEntry = artifactEntry('.skip-sam.json', samContent)
    const idx = entries.findIndex((e) => e.filename === '.skip-sam.json')
    entries[idx] = samEntry

    const response = await postMultipart('/backend/v1/api/scanner', project.token, { scanId, entries })
    const body = await response.json()
    assert.equal(body.status, 'failed')
    const samResult = body.artifacts.find((a) => a.filename === '.skip-sam.json')
    assert.equal(samResult.valid, false)
    assert.ok(samResult.errors.some((e) => e.toLowerCase().includes('scanid')))
  })

  it('is idempotent on retry: same scanId + hashes does not duplicate artifacts', async () => {
    const scanId = 'idempotent-retry'
    const entries = buildSixArtifactBundle(scanId)
    const first = await postMultipart('/backend/v1/api/scanner', project.token, { scanId, entries })
    const firstBody = await first.json()
    assert.equal(firstBody.status, 'complete')

    const second = await postMultipart('/backend/v1/api/scanner', project.token, { scanId, entries })
    const secondBody = await second.json()
    assert.equal(secondBody.scanId, firstBody.scanId)
    assert.equal(secondBody.status, 'complete')

    const artifacts = await pool.query('SELECT count(*)::int AS n FROM scan_artifacts WHERE scan_id = $1', [
      firstBody.scanId,
    ])
    assert.equal(artifacts.rows[0].n, 6)
    const scans = await pool.query('SELECT count(*)::int AS n FROM scans WHERE external_scan_id = $1', [scanId])
    assert.equal(scans.rows[0].n, 1)
  })

  it('marks wcagStatus partial when the audit is only a sample', async () => {
    const scanId = 'sampled-audit'
    const entries = buildSixArtifactBundle(scanId, {
      contentOverrides: {
        '.skip-wcag-audit.json': {
          scanId,
          total: 1127,
          violationsSampled: 200,
          violations: [{ id: 'x', rule: 'r', severity: 'serious', filePath: 'a.tsx' }],
        },
      },
    })

    const response = await postMultipart('/backend/v1/api/scanner', project.token, { scanId, entries })
    const body = await response.json()
    assert.equal(body.status, 'complete')
    const saved = await pool.query('SELECT report FROM scans WHERE id = $1', [body.scanId])
    assert.equal(saved.rows[0].report.upload.wcagStatus, 'partial')
  })

  it('persists .skip-wcag-audit.cjs as data and never executes it', async () => {
    const scanId = 'cjs-as-data'
    const cjsContent = 'module.exports = { __proof__: "should-not-run" }'
    // Send the 6 required artifacts plus the .cjs as a 7th optional file.
    const entries = [
      ...buildSixArtifactBundle(scanId),
      artifactEntry('.skip-wcag-audit.cjs', cjsContent, {
        artifactType: 'debug-source',
        required: false,
      }),
    ]
    const response = await postMultipart('/backend/v1/api/scanner', project.token, { scanId, entries })
    assert.equal(response.status, 202)
    const body = await response.json()
    const cjsResult = body.artifacts.find((a) => a.filename === '.skip-wcag-audit.cjs')
    assert.equal(cjsResult.received, true)
    assert.equal(cjsResult.valid, true)
    assert.ok(cjsResult.warnings.some((w) => w.toLowerCase().includes('nao foi executado')))
    // The proof value is never materialized anywhere — confirms no require/import.
    assert.equal(globalThis.__SHOULD_NOT_RUN_PROOF__, undefined)
  })

  it('rejects an empty SAM (no entities and no relationships)', async () => {
    const scanId = 'empty-sam'
    const entries = buildSixArtifactBundle(scanId, {
      contentOverrides: {
        '.skip-sam.json': { scanId, entities: [], relationships: [] },
      },
    })
    const response = await postMultipart('/backend/v1/api/scanner', project.token, { scanId, entries })
    const body = await response.json()
    assert.equal(body.status, 'failed')
    const samResult = body.artifacts.find((a) => a.filename === '.skip-sam.json')
    assert.equal(samResult.valid, false)
    assert.ok(samResult.errors.some((e) => e.toLowerCase().includes('vazio')))
  })

  it('rejects a SAM whose relationship references a missing entity', async () => {
    const scanId = 'invalid-relationship'
    const entries = buildSixArtifactBundle(scanId, {
      contentOverrides: {
        '.skip-sam.json': {
          scanId,
          entities: [{ id: 'route-home', type: 'ROUTE', name: 'Home', path: '/' }],
          relationships: [{ source: 'route-home', target: 'ghost-button', type: 'CONTAINS' }],
        },
      },
    })
    const response = await postMultipart('/backend/v1/api/scanner', project.token, { scanId, entries })
    const body = await response.json()
    assert.equal(body.status, 'failed')
    const samResult = body.artifacts.find((a) => a.filename === '.skip-sam.json')
    assert.equal(samResult.valid, false)
    assert.ok(samResult.errors.some((e) => e.toLowerCase().includes('destino inexistente')))
  })

  it('accepts scanner 0.7 SAM relationships using sourceId and targetId', async () => {
    const scanId = 'sam-sourceid-targetid'
    const entries = buildSixArtifactBundle(scanId, {
      contentOverrides: {
        '.skip-sam.json': {
          scanId,
          entities: [
            { id: 'route-home', type: 'ROUTE', name: 'Home', path: '/' },
            { id: 'screen-home', type: 'SCREEN', name: 'Home screen', path: '/' },
          ],
          relationships: [{ sourceId: 'route-home', targetId: 'screen-home', type: 'CONTAINS' }],
        },
      },
    })
    const response = await postMultipart('/backend/v1/api/scanner', project.token, { scanId, entries })
    const body = await response.json()
    assert.equal(body.status, 'complete')
    const relationships = await pool.query('SELECT count(*)::int AS n FROM relationships WHERE scan_id = $1', [
      body.scanId,
    ])
    assert.equal(relationships.rows[0].n, 1)
  })

  it('does not self-validate upload-manifest hash and size', async () => {
    const scanId = 'manifest-self-reference'
    const entries = buildSixArtifactBundle(scanId)
    const originalManifest = JSON.parse(entries.find((e) => e.filename === 'upload-manifest.json').raw)
    originalManifest.files = originalManifest.files.map((file) =>
      file.filename === 'upload-manifest.json'
        ? { ...file, sizeBytes: 1, sha256: '0'.repeat(64) }
        : file,
    )
    originalManifest.artifacts = originalManifest.files
    const manifestEntry = artifactEntry('upload-manifest.json', originalManifest)
    const finalEntries = [...entries.filter((e) => e.filename !== 'upload-manifest.json'), manifestEntry]

    const response = await postMultipart('/backend/v1/api/scanner', project.token, {
      scanId,
      entries: finalEntries,
    })
    const body = await response.json()
    assert.equal(body.status, 'complete')
    assert.deepEqual(body.hashMismatches, [])
  })
})

describe('scanner read endpoints', () => {
  let setup

  async function uploadComplete() {
    const scanId = `read-${crypto.randomUUID()}`
    const entries = buildSixArtifactBundle(scanId)
    const response = await postMultipart('/backend/v1/api/scanner', project.token, { scanId, entries })
    const body = await response.json()
    assert.equal(body.status, 'complete')
    return body
  }

  before(async () => {
    setup = await uploadComplete()
  })

  it('GET scan returns the scan via JWT (dashboard path) and via project token (backend path)', async () => {
    const jwtRes = await fetch(`${baseUrl}/api/scans/${setup.scanId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
    assert.equal(jwtRes.status, 200)
    assert.equal((await jwtRes.json()).id, setup.scanId)

    const tokenRes = await fetch(`${baseUrl}/backend/v1/scans/${setup.scanId}`, {
      headers: { Authorization: `Bearer ${project.token}` },
    })
    assert.equal(tokenRes.status, 200)
    assert.equal((await tokenRes.json()).externalScanId, setup.externalScanId)
  })

  it('rejects scan reads without auth and for unknown scans', async () => {
    const noAuth = await fetch(`${baseUrl}/api/scans/${setup.scanId}`)
    assert.equal(noAuth.status, 401)

    const wrongToken = await fetch(`${baseUrl}/api/scans/${setup.scanId}`, {
      headers: { Authorization: 'Bearer not-a-real-token' },
    })
    assert.equal(wrongToken.status, 401)

    const unknown = await fetch(`${baseUrl}/api/scans/does-not-exist`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
    assert.equal(unknown.status, 404)
  })

  it('GET artifacts lists all six required artifacts', async () => {
    const res = await fetch(`${baseUrl}/api/scans/${setup.scanId}/artifacts`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.artifacts.length, 6)
    assert.deepEqual(
      body.artifacts.map((a) => a.filename).sort(),
      [
        '.skip-report.json',
        '.skip-sam.json',
        '.skip-wcag-audit.json',
        'scan-file-manifest.json',
        'upload-manifest.json',
        'scan-validation.json',
      ].sort(),
    )
  })

  it('GET artifacts/semantic-map returns .skip-sam.json with processed entities', async () => {
    const res = await fetch(`${baseUrl}/backend/v1/scans/${setup.scanId}/artifacts/semantic-map`, {
      headers: { Authorization: `Bearer ${project.token}` },
    })
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.filename, '.skip-sam.json')
    assert.equal(body.artifactType, 'semantic-map')
    assert.ok(Array.isArray(body.content.entities))
    assert.equal(body.content.entities.length, 2)

    // The SAM is also materialized into the semantic_entities table (dashboard source).
    const entities = await pool.query('SELECT count(*)::int AS n FROM semantic_entities WHERE scan_id = $1', [
      setup.scanId,
    ])
    assert.equal(entities.rows[0].n, 2)
  })

  it('GET artifacts/wcag-audit returns the audit content', async () => {
    const res = await fetch(`${baseUrl}/api/scans/${setup.scanId}/artifacts/wcag-audit`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.artifactType, 'wcag-audit')
    assert.ok(Array.isArray(body.content.violations))
  })

  it('GET issues returns paginated findings from the dedicated table', async () => {
    const res = await fetch(`${baseUrl}/api/scans/${setup.scanId}/issues`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.items.length, 2)
    assert.equal(body.pagination.totalItems, 2)
    assert.equal(body.pagination.page, 1)
    assert.ok(body.pagination.totalPages >= 1)
    // default severity sort puts serious before unknown
    assert.equal(body.items[0].severity, 'serious')
    assert.equal(body.items[1].severity, 'unknown')
  })

  it('GET issues filters by severity and by ruleId path param', async () => {
    const bySev = await fetch(`${baseUrl}/api/scans/${setup.scanId}/issues?severity=serious`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
    const sevBody = await bySev.json()
    assert.equal(sevBody.items.length, 1)
    assert.equal(sevBody.items[0].severity, 'serious')

    const byRule = await fetch(
      `${baseUrl}/api/scans/${setup.scanId}/issues/${encodeURIComponent('1.4.3 Contrast')}`,
      { headers: { Authorization: `Bearer ${authToken}` } },
    )
    const ruleBody = await byRule.json()
    assert.equal(ruleBody.pagination.totalItems, 1)
    assert.equal(ruleBody.items[0].selector, '.muted')
  })

  it('GET issues paginates with pageSize', async () => {
    const res = await fetch(`${baseUrl}/api/scans/${setup.scanId}/issues?pageSize=1`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
    const body = await res.json()
    assert.equal(body.items.length, 1)
    assert.equal(body.pagination.pageSize, 1)
    assert.equal(body.pagination.totalItems, 2)
    assert.equal(body.pagination.totalPages, 2)
  })
})
