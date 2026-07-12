import crypto from 'node:crypto'

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

export const REQUIRED_ARTIFACTS = [
  '.skip-report.json',
  '.skip-sam.json',
  '.skip-wcag-audit.json',
  'scan-file-manifest.json',
  'upload-manifest.json',
  'scan-validation.json',
]

const ARTIFACT_TYPES_BY_FILENAME = {
  '.skip-report.json': 'report',
  '.skip-sam.json': 'semantic-map',
  '.skip-wcag-audit.json': 'wcag-audit',
  'scan-file-manifest.json': 'file-manifest',
  'upload-manifest.json': 'upload-manifest',
  'scan-validation.json': 'validation',
  'scan-source-files.json': 'source-files',
  'scanner-diagnostics.json': 'diagnostics',
  'scanner.log': 'scanner-log',
  '.skip-wcag-audit.cjs': 'debug-source',
}

const VALID_SEVERITIES = new Set(['critical', 'serious', 'moderate', 'minor', 'unknown'])

function safeJson(value, fallback = {}) {
  if (value == null || value === '') return fallback
  if (typeof value === 'object') return value
  try {
    return JSON.parse(String(value))
  } catch {
    return fallback
  }
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

function maskToken(token) {
  if (!token) return ''
  const value = String(token)
  if (value.length <= 8) return '****'
  return `${value.slice(0, 4)}...${value.slice(-4)}`
}

function normalizeFilename(filename = '') {
  return String(filename).replaceAll('\\', '/').split('/').pop()
}

export function getScannerToken(req, parsedBody = {}) {
  const header = req.headers.authorization || ''
  if (header.startsWith('Bearer ')) return header.slice(7).trim()
  return (
    req.headers['x-skip-token'] ||
    req.query?.token ||
    parsedBody.token ||
    parsedBody.fields?.token ||
    ''
  )
}

function parseContentDisposition(value = '') {
  const out = {}
  for (const part of String(value).split(';')) {
    const [rawKey, ...rawRest] = part.trim().split('=')
    if (!rawRest.length) continue
    out[rawKey.toLowerCase()] = rawRest.join('=').replace(/^"|"$/g, '')
  }
  return out
}

async function readRequestBuffer(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_UPLOAD_BYTES) {
      const error = new Error('Payload grande demais')
      error.status = 413
      throw error
    }
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

function parseMultipart(buffer, contentType) {
  const boundary = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType)?.[1] || /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType)?.[2]
  if (!boundary) {
    const error = new Error('Boundary multipart ausente')
    error.status = 400
    throw error
  }

  const binary = buffer.toString('latin1')
  const delimiter = `--${boundary}`
  const fields = {}
  const files = []

  for (const rawPart of binary.split(delimiter)) {
    if (!rawPart || rawPart === '--\r\n' || rawPart === '--') continue
    const part = rawPart.replace(/^\r\n/, '').replace(/\r\n--$/, '')
    const headerEnd = part.indexOf('\r\n\r\n')
    if (headerEnd < 0) continue
    const rawHeaders = part.slice(0, headerEnd)
    let body = part.slice(headerEnd + 4)
    if (body.endsWith('\r\n')) body = body.slice(0, -2)

    const headers = {}
    for (const line of rawHeaders.split('\r\n')) {
      const index = line.indexOf(':')
      if (index > 0) headers[line.slice(0, index).toLowerCase()] = line.slice(index + 1).trim()
    }
    const disposition = parseContentDisposition(headers['content-disposition'])
    const name = disposition.name
    const filename = normalizeFilename(disposition.filename)
    if (!name) continue

    if (filename) {
      const content = Buffer.from(body, 'latin1')
      files.push({
        fieldname: name,
        filename,
        contentType: headers['content-type'] || 'application/octet-stream',
        buffer: content,
        sizeBytes: content.length,
        sha256: sha256(content),
      })
    } else {
      const text = Buffer.from(body, 'latin1').toString('utf8')
      if (fields[name] == null) fields[name] = text
      else if (Array.isArray(fields[name])) fields[name].push(text)
      else fields[name] = [fields[name], text]
    }
  }

  return { kind: 'multipart', fields, files }
}

export async function parseScannerUpload(req) {
  const contentType = String(req.headers['content-type'] || '')
  if (contentType.includes('multipart/form-data')) {
    const buffer = await readRequestBuffer(req)
    return parseMultipart(buffer, contentType)
  }
  return { kind: 'json', body: req.body || {} }
}

export function detectArtifactType(artifact = {}) {
  const filename = normalizeFilename(artifact.filename || artifact.name)
  if (artifact.artifactType) return artifact.artifactType
  if (artifact.type) return artifact.type
  if (filename.startsWith('scan-source-files.part-')) return 'source-files'
  return ARTIFACT_TYPES_BY_FILENAME[filename] || 'unknown'
}

function artifactFromJson(item, fallback = {}) {
  const filename = normalizeFilename(item.filename || item.name || fallback.filename || '.skip-report.json')
  const content = item.content ?? item.payload ?? item.report ?? item.data ?? item
  const jsonBuffer = Buffer.from(JSON.stringify(content))
  return {
    artifactId: item.artifactId || detectArtifactType({ ...item, filename }),
    artifactType: detectArtifactType({ ...item, filename }),
    filename,
    contentType: item.contentType || 'application/json',
    content,
    rawText: JSON.stringify(content),
    sizeBytes: Number(item.sizeBytes || jsonBuffer.length),
    sha256: item.sha256 || sha256(jsonBuffer),
    schemaVersion: item.schemaVersion || fallback.schemaVersion || '',
    required: item.required,
  }
}

function artifactFromMultipart(file, manifestByName, fields) {
  const manifestEntry = manifestByName.get(file.filename) || {}
  const rawText = file.buffer.toString('utf8')
  const content = file.contentType.includes('json') || file.filename.endsWith('.json') ? safeJson(rawText, null) : rawText
  return {
    artifactId: manifestEntry.artifactId || detectArtifactType({ ...manifestEntry, filename: file.filename }),
    artifactType: detectArtifactType({ ...manifestEntry, filename: file.filename }),
    filename: file.filename,
    contentType: file.contentType,
    content,
    rawText,
    sizeBytes: file.sizeBytes,
    sha256: file.sha256,
    schemaVersion: manifestEntry.schemaVersion || fields.schemaVersion || '',
    required: manifestEntry.required,
  }
}

export function normalizeUpload(parsed) {
  if (parsed.kind === 'multipart') {
    const fields = parsed.fields || {}
    const manifest = safeJson(fields.manifest, {})
    const embeddedUploadManifest = parsed.files.find((file) => file.filename === 'upload-manifest.json')
    const uploadManifest = embeddedUploadManifest ? safeJson(embeddedUploadManifest.buffer.toString('utf8'), manifest) : manifest
    const manifestFiles = uploadManifest.files || uploadManifest.artifacts || manifest.files || manifest.artifacts || []
    const manifestByName = new Map(manifestFiles.map((item) => [normalizeFilename(item.filename || item.name), item]))
    return {
      scanId: fields.scanId || uploadManifest.scanId || manifest.scanId || '',
      schemaVersion: fields.schemaVersion || uploadManifest.schemaVersion || manifest.schemaVersion || '',
      bundleVersion: fields.bundleVersion || uploadManifest.bundleVersion || manifest.bundleVersion || '',
      manifest: uploadManifest,
      artifacts: parsed.files.map((file) => artifactFromMultipart(file, manifestByName, fields)),
      observed: {
        method: 'POST',
        contentType: 'multipart/form-data',
        fieldNames: Object.keys(fields),
        fileNames: parsed.files.map((file) => file.filename),
        fileCount: parsed.files.length,
      },
    }
  }

  const body = parsed.body || {}
  const artifacts = []
  if (Array.isArray(body.artifacts)) {
    for (const item of body.artifacts) artifacts.push(artifactFromJson(item, body))
  } else if (body.artifactType || body.filename || body.payload) {
    artifacts.push(artifactFromJson(body, body))
  } else {
    const report = body.report || body
    artifacts.push(artifactFromJson({ filename: '.skip-report.json', artifactType: 'report', content: report }, body))
  }

  return {
    scanId: body.scanId || body.externalScanId || '',
    schemaVersion: body.schemaVersion || '',
    bundleVersion: body.bundleVersion || '',
    manifest: body.manifest || {},
    artifacts,
    observed: {
      method: 'POST',
      contentType: 'application/json',
      fieldNames: Object.keys(body),
      fileNames: artifacts.map((item) => item.filename),
      fileCount: artifacts.length,
    },
  }
}

function validateSemanticMap(artifact, uploadScanId) {
  const errors = []
  const sam = artifact.content
  if (artifact.filename !== '.skip-sam.json') errors.push('O arquivo semantic-map deve se chamar .skip-sam.json')
  if (!sam || typeof sam !== 'object' || Array.isArray(sam)) errors.push('SAM deve ser um JSON object')
  if (sam && (!Array.isArray(sam.entities) || !Array.isArray(sam.relationships))) {
    errors.push('SAM deve conter arrays entities e relationships')
  }
  if (sam && Array.isArray(sam.entities) && sam.entities.length === 0 && Array.isArray(sam.relationships) && sam.relationships.length === 0) {
    errors.push('SAM vazio')
  }
  if (uploadScanId && sam?.scanId && sam.scanId !== uploadScanId) errors.push('scanId divergente no SAM')

  const refs = new Set()
  for (const [index, entity] of (sam?.entities || []).entries()) {
    const id = entity.id || entity.entityId || entity.slug
    if (!id) errors.push(`Entidade ${index} sem id/entityId/slug`)
    if (refs.has(id)) errors.push(`Entidade duplicada: ${id}`)
    refs.add(id)
  }
  for (const [index, relationship] of (sam?.relationships || []).entries()) {
    const source = relationship.source || relationship.sourceEntityId || relationship.from || relationship.fromEntityId
    const target = relationship.target || relationship.targetEntityId || relationship.to || relationship.toEntityId
    if (!source || !target) errors.push(`Relacionamento ${index} sem origem/destino`)
    if (source && !refs.has(source)) errors.push(`Relacionamento ${index} referencia origem inexistente: ${source}`)
    if (target && !refs.has(target)) errors.push(`Relacionamento ${index} referencia destino inexistente: ${target}`)
  }
  return errors
}

function validateWcagAudit(artifact) {
  const errors = []
  const audit = artifact.content
  if (!audit || typeof audit !== 'object' || Array.isArray(audit)) errors.push('Auditoria WCAG deve ser um JSON object')
  const violations = audit?.violations || audit?.findings || []
  if (!Array.isArray(violations)) errors.push('Auditoria WCAG deve conter violations/findings como array')
  for (const [index, finding] of violations.entries()) {
    if (finding.severity && !VALID_SEVERITIES.has(String(finding.severity))) {
      errors.push(`Finding ${index} tem severidade invalida: ${finding.severity}`)
    }
  }
  return errors
}

function validateUploadManifest(artifact, artifacts) {
  const errors = []
  const manifest = artifact.content
  const files = manifest?.files || manifest?.artifacts || []
  if (!Array.isArray(files)) errors.push('upload-manifest deve conter files/artifacts como array')
  if (manifest?.expectedFileCount != null && Number(manifest.expectedFileCount) !== files.length) {
    errors.push('expectedFileCount divergente de files.length')
  }
  const receivedByName = new Map(artifacts.map((item) => [item.filename, item]))
  for (const file of files) {
    const name = normalizeFilename(file.filename || file.name)
    const received = receivedByName.get(name)
    if (!received) continue
    if (file.sha256 && received.sha256 !== file.sha256) errors.push(`Hash divergente: ${name}`)
    if (file.sizeBytes != null && Number(file.sizeBytes) !== Number(received.sizeBytes)) errors.push(`Tamanho divergente: ${name}`)
  }
  return errors
}

function validateArtifact(artifact, upload, artifacts) {
  if (artifact.filename === '.skip-wcag-audit.cjs') {
    return { valid: true, warnings: ['Arquivo de codigo recebido como diagnostico; nao foi executado.'], errors: [] }
  }
  const errors = []
  const warnings = []
  if (!artifact.filename) errors.push('filename ausente')
  if (artifact.content == null && artifact.artifactType !== 'scanner-log') errors.push('conteudo ausente')
  if (artifact.contentType.includes('json') || artifact.filename.endsWith('.json')) {
    if (artifact.content == null) errors.push(`JSON invalido em ${artifact.filename}`)
  }
  if (artifact.artifactType === 'semantic-map') errors.push(...validateSemanticMap(artifact, upload.scanId))
  if (artifact.artifactType === 'wcag-audit') errors.push(...validateWcagAudit(artifact))
  if (artifact.artifactType === 'upload-manifest') errors.push(...validateUploadManifest(artifact, artifacts))
  return { valid: errors.length === 0, errors, warnings }
}

function severitySummary(findings) {
  return findings.reduce(
    (acc, item) => {
      const severity = VALID_SEVERITIES.has(item.severity) ? item.severity : 'unknown'
      acc[severity] += 1
      return acc
    },
    { critical: 0, serious: 0, moderate: 0, minor: 0, unknown: 0 },
  )
}

function normalizeFindings(audit) {
  const raw = audit?.violations || audit?.findings || []
  return raw.map((item, index) => ({
    fingerprint: item.fingerprint || item.id || crypto.createHash('sha1').update(JSON.stringify(item)).digest('hex'),
    ruleId: item.ruleId || item.rule || item.wcag || 'unknown',
    severity: VALID_SEVERITIES.has(String(item.severity)) ? String(item.severity) : 'unknown',
    filePath: item.filePath || item.source?.filePath || '',
    line: Number(item.line || item.source?.line || 0),
    column: Number(item.column || item.source?.column || 0),
    selector: item.selector || '',
    occurrenceCount: Number(item.occurrenceCount || 1),
    suggestion: item.fix || item.suggestion || '',
    affectedScreens: item.affectedScreens || (item.screen ? [item.screen] : []),
    payload: item,
  }))
}

function wcagStatus(audit) {
  const sampled = audit?.violationsSampled || audit?.sample?.violationsSampled
  const total = audit?.total || audit?.sample?.total
  return sampled && total && Number(sampled) < Number(total) ? 'partial' : 'complete'
}

function toEntityType(type = '') {
  const value = String(type).toUpperCase()
  if (['ROUTE', 'PAGE', 'SCREEN'].includes(value)) return 'ROUTE'
  if (['API'].includes(value)) return 'API'
  if (['FLOW'].includes(value)) return 'FLOW'
  if (['BUSINESS_RULE', 'RULE'].includes(value)) return 'BUSINESS_RULE'
  return 'COMPONENT'
}

function toRelationshipType(type = '') {
  const value = String(type).toUpperCase()
  if (['CONTAINS', 'CONSUMES', 'TRIGGERS', 'REDIRECTS', 'VALIDATES'].includes(value)) return value
  return 'CONTAINS'
}

function scanStatusFromArtifacts(results) {
  const byName = new Map(results.map((item) => [item.filename, item]))
  const missingArtifacts = REQUIRED_ARTIFACTS.filter((name) => !byName.has(name))
  const invalidArtifacts = results.filter((item) => !item.valid).map((item) => item.filename)
  if (invalidArtifacts.length) return { status: 'FAILED', missingArtifacts, invalidArtifacts }
  if (missingArtifacts.length) return { status: 'PARTIAL', missingArtifacts, invalidArtifacts }
  return { status: 'COMPLETED', missingArtifacts, invalidArtifacts }
}

async function upsertArtifact(client, scanId, artifact, result) {
  const rawContent =
    artifact.content == null
      ? { text: artifact.rawText || '' }
      : artifact.contentType.includes('json') || artifact.filename.endsWith('.json')
        ? artifact.content
        : { text: artifact.rawText }
  await client.query(
    `INSERT INTO scan_artifacts
       (scan_id, artifact_type, filename, content_type, raw_content, size_bytes, sha256, required, validation_status, processing_status, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (scan_id, artifact_type, filename, sha256)
     DO UPDATE SET raw_content = EXCLUDED.raw_content,
                   size_bytes = EXCLUDED.size_bytes,
                   validation_status = EXCLUDED.validation_status,
                   processing_status = EXCLUDED.processing_status,
                   metadata = EXCLUDED.metadata,
                   updated = now()`,
    [
      scanId,
      artifact.artifactType,
      artifact.filename,
      artifact.contentType,
      rawContent,
      artifact.sizeBytes,
      artifact.sha256,
      artifact.required ?? REQUIRED_ARTIFACTS.includes(artifact.filename),
      result.valid ? 'complete' : 'invalid',
      result.valid ? 'complete' : 'failed',
      { artifactId: artifact.artifactId, schemaVersion: artifact.schemaVersion, warnings: result.warnings, errors: result.errors },
    ],
  )
}

async function processSemanticMap(client, scanId, sam) {
  await client.query('DELETE FROM relationships WHERE scan_id = $1', [scanId])
  await client.query('DELETE FROM semantic_entities WHERE scan_id = $1', [scanId])
  const idMap = new Map()
  let entityCount = 0
  for (const entity of sam.entities || []) {
    const externalId = entity.id || entity.entityId || entity.slug
    const slug = entity.slug || externalId || String(entity.name || entity.path || 'entity').toLowerCase().replace(/\s+/g, '-')
    const inserted = await client.query(
      `INSERT INTO semantic_entities
         (scan_id, type, name, slug, path, page_title, semantic_labels, description, accessibility_hint, confidence, evidence, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      [
        scanId,
        toEntityType(entity.type),
        entity.name || entity.title || slug,
        slug,
        entity.path || entity.route || '',
        entity.pageTitle || entity.title || '',
        JSON.stringify(entity.semanticLabels || entity.labels || []),
        entity.description || '',
        entity.accessibilityHint || entity.hint || '',
        Number(entity.confidence ?? 0.9),
        JSON.stringify(entity.evidence || []),
        JSON.stringify({ ...entity, externalId }),
      ],
    )
    idMap.set(externalId, inserted.rows[0].id)
    idMap.set(slug, inserted.rows[0].id)
    entityCount++
  }
  let relationshipCount = 0
  for (const relationship of sam.relationships || []) {
    const sourceKey = relationship.source || relationship.sourceEntityId || relationship.from || relationship.fromEntityId
    const targetKey = relationship.target || relationship.targetEntityId || relationship.to || relationship.toEntityId
    const sourceId = idMap.get(sourceKey)
    const targetId = idMap.get(targetKey)
    if (!sourceId || !targetId) continue
    await client.query(
      'INSERT INTO relationships (scan_id, source_id, target_id, type) VALUES ($1, $2, $3, $4)',
      [scanId, sourceId, targetId, toRelationshipType(relationship.type || relationship.relationshipType)],
    )
    relationshipCount++
  }
  return { entityCount, relationshipCount }
}

async function processWcagAudit(client, scanId, audit) {
  await client.query('DELETE FROM wcag_findings WHERE scan_id = $1', [scanId])
  const findings = normalizeFindings(audit)
  for (const finding of findings) {
    await client.query(
      `INSERT INTO wcag_findings
         (scan_id, fingerprint, rule_id, severity, file_path, line, column_number, selector, occurrence_count, suggestion, affected_screens, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (scan_id, fingerprint)
       DO UPDATE SET payload = EXCLUDED.payload,
                     occurrence_count = EXCLUDED.occurrence_count,
                     updated = now()`,
      [
        scanId,
        finding.fingerprint,
        finding.ruleId,
        finding.severity,
        finding.filePath,
        finding.line,
        finding.column,
        finding.selector,
        finding.occurrenceCount,
        finding.suggestion,
        JSON.stringify(finding.affectedScreens),
        finding.payload,
      ],
    )
  }
  return { findings, status: wcagStatus(audit) }
}

export async function receiveScannerUpload({ pool, project, token, upload }) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const externalScanId = upload.scanId || crypto.randomUUID()
    const existing = await client.query(
      'SELECT * FROM scans WHERE project_id = $1 AND external_scan_id = $2 ORDER BY created DESC LIMIT 1',
      [project.id, externalScanId],
    )
    const scan = existing.rows[0] || (await client.query(
      `INSERT INTO scans
         (project_id, external_scan_id, status, phase, phase_detail, report, token, metadata, schema_version, bundle_version)
       VALUES ($1, $2, 'PROCESSING', 'Receiving', 'Recebendo artefatos do scanner', '{}'::jsonb, '', '{}'::jsonb, $3, $4)
       RETURNING *`,
      [project.id, externalScanId, upload.schemaVersion || '', upload.bundleVersion || ''],
    )).rows[0]

    const results = []
    let report = null
    let semanticMap = null
    let wcagAudit = null
    let wcagProcessing = null
    let samProcessing = null

    for (const artifact of upload.artifacts) {
      const validation = validateArtifact(artifact, upload, upload.artifacts)
      const result = {
        artifactType: artifact.artifactType,
        filename: artifact.filename,
        received: true,
        valid: validation.valid,
        persisted: false,
        processed: false,
        sizeBytes: artifact.sizeBytes,
        sha256: artifact.sha256,
        errors: validation.errors,
        warnings: validation.warnings,
      }
      await upsertArtifact(client, scan.id, artifact, validation)
      result.persisted = true
      if (validation.valid && artifact.artifactType === 'report') report = artifact.content
      if (validation.valid && artifact.artifactType === 'semantic-map') {
        semanticMap = artifact.content
        samProcessing = await processSemanticMap(client, scan.id, semanticMap)
        result.processed = true
      } else if (validation.valid && artifact.artifactType === 'wcag-audit') {
        wcagAudit = artifact.content
        wcagProcessing = await processWcagAudit(client, scan.id, wcagAudit)
        result.processed = true
      } else if (validation.valid) {
        result.processed = true
      }
      results.push(result)
    }

    const status = scanStatusFromArtifacts(results)
    const findings = wcagProcessing?.findings || []
    const summary = severitySummary(findings)
    const assembledReport = {
      ...(report || {}),
      scanId: externalScanId,
      projectName: report?.projectName || report?.project?.name || project.name,
      framework: report?.framework || report?.project?.framework || project.framework || '',
      language: report?.language || report?.project?.language || project.language || '',
      semanticMap: semanticMap
        ? { status: status.missingArtifacts.includes('.skip-sam.json') ? 'missing' : 'complete', ...semanticMap }
        : { status: 'missing', warnings: ['Arquivo .skip-sam.json nao recebido.'], missingData: ['.skip-sam.json'] },
      wcag: wcagAudit
        ? {
            ...(wcagAudit.wcag || wcagAudit),
            status: wcagProcessing?.status || 'complete',
            violations: wcagAudit.violations || wcagAudit.findings || [],
            summary: wcagAudit.summary || summary,
            scoreStatus: wcagAudit.score == null && wcagAudit.wcag?.score == null ? 'unavailable' : 'available',
          }
        : { status: 'missing', scoreStatus: 'unavailable', violations: [], summary },
      upload: {
        uploadStatus: status.status === 'COMPLETED' ? 'complete' : status.status === 'FAILED' ? 'failed' : 'partial',
        validationStatus: status.invalidArtifacts.length ? 'invalid' : 'complete',
        processingStatus: status.status === 'FAILED' ? 'failed' : 'complete',
        reportStatus: results.some((item) => item.filename === '.skip-report.json' && item.valid) ? 'complete' : 'partial',
        samStatus: results.some((item) => item.filename === '.skip-sam.json' && item.valid) ? 'complete' : status.invalidArtifacts.includes('.skip-sam.json') ? 'invalid' : 'partial',
        wcagStatus: wcagProcessing?.status || (wcagAudit ? 'complete' : 'partial'),
        dashboardStatus: status.status === 'COMPLETED' ? 'complete' : 'partial',
        observed: { ...upload.observed, token: maskToken(token) },
      },
      artifacts: results,
      missingArtifacts: status.missingArtifacts,
      invalidArtifacts: status.invalidArtifacts,
    }

    await client.query(
      `UPDATE scans
       SET status = $1,
           phase = $2,
           phase_detail = $3,
           report = $4,
           metadata = $4,
           files_count = $5,
           files_scanned = $5,
           files_uploaded = $6,
           entities_count = $7,
           expected_artifacts = $8,
           received_artifacts = $9,
           valid_artifacts = $10,
           scanner_version = COALESCE($11, scanner_version),
           schema_version = COALESCE($12, schema_version),
           bundle_version = COALESCE($13, bundle_version),
           completed_at = CASE WHEN $1 = 'COMPLETED' THEN now() ELSE completed_at END
       WHERE id = $14`,
      [
        status.status,
        status.status === 'COMPLETED' ? 'Complete' : status.status === 'FAILED' ? 'Failed' : 'Partial',
        status.status === 'COMPLETED'
          ? 'Todos os artefatos obrigatorios foram recebidos e processados'
          : 'Artefatos obrigatorios ausentes ou invalidos',
        assembledReport,
        report?.filesCount || report?.stats?.files || 0,
        results.length,
        samProcessing?.entityCount || 0,
        REQUIRED_ARTIFACTS.length,
        results.length,
        results.filter((item) => item.valid).length,
        report?.scannerVersion || report?.scanner?.version || '',
        upload.schemaVersion || report?.schemaVersion || '',
        upload.bundleVersion || '',
        scan.id,
      ],
    )
    await client.query('UPDATE projects SET last_scanned_at = now() WHERE id = $1', [project.id])
    await client.query('COMMIT')

    return {
      scanId: scan.id,
      externalScanId,
      accepted: true,
      status: status.status === 'COMPLETED' ? 'complete' : status.status === 'FAILED' ? 'failed' : 'partial',
      expectedArtifacts: REQUIRED_ARTIFACTS.length,
      receivedArtifacts: results.length,
      validArtifacts: results.filter((item) => item.valid).length,
      persistedArtifacts: results.filter((item) => item.persisted).length,
      artifacts: results,
      missingArtifacts: status.missingArtifacts,
      invalidArtifacts: status.invalidArtifacts,
      hashMismatches: results.flatMap((item) => item.errors.filter((error) => error.startsWith('Hash divergente'))),
      warnings: [
        ...results.flatMap((item) => item.warnings),
        ...(results.length === 1 && results[0]?.filename === '.skip-report.json' ? ['Somente o relatorio principal foi recebido.'] : []),
      ],
      observed: upload.observed,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
