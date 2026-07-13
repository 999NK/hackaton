import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import pg from 'pg'

const { Pool } = pg
const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true })

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required')
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

export async function migrate() {
  const schemaPath = path.resolve(__dirname, '../db/schema.sql')
  const sql = await fs.readFile(schemaPath, 'utf8')
  await pool.query(sql)
}

export function rowProject(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    token: row.token,
    baseUrl: row.base_url ?? '',
    framework: row.framework ?? '',
    language: row.language ?? '',
    user: row.user_id,
    owner: row.owner_id,
    lastScannedAt: row.last_scanned_at,
    created: row.created,
    updated: row.updated,
  }
}

export function rowScan(row) {
  if (!row) return null
  return {
    id: row.id,
    externalScanId: row.external_scan_id ?? '',
    project: row.project_id,
    status: row.status,
    filesCount: row.files_count ?? 0,
    secretsFound: row.secrets_found ?? 0,
    errorMessage: row.error_message ?? '',
    phase: row.phase ?? '',
    phaseDetail: row.phase_detail ?? '',
    tokenUsed: row.token_used ?? 0,
    tokenBudget: row.token_budget ?? 0,
    filesUploaded: row.files_uploaded ?? 0,
    report: row.report ?? {},
    entitiesCount: row.entities_count ?? 0,
    expectedArtifacts: row.expected_artifacts ?? 0,
    receivedArtifacts: row.received_artifacts ?? 0,
    validArtifacts: row.valid_artifacts ?? 0,
    scannerVersion: row.scanner_version ?? '',
    schemaVersion: row.schema_version ?? '',
    bundleVersion: row.bundle_version ?? '',
    completedAt: row.completed_at,
    token: row.token ?? '',
    created: row.created,
    updated: row.updated,
  }
}

export function rowEntity(row) {
  if (!row) return null
  const metadata = row.metadata ?? {}
  const inferredPath =
    row.path ||
    metadata.route ||
    metadata.targetRoute ||
    (row.type === 'ROUTE' && /^\//.test(String(row.name || '')) ? row.name : '')
  return {
    id: row.id,
    scan: row.scan_id,
    type: row.type,
    name: row.name,
    slug: row.slug ?? '',
    path: inferredPath,
    pageTitle: row.page_title ?? '',
    semanticLabels: row.semantic_labels ?? [],
    description: row.description ?? '',
    accessibilityHint: row.accessibility_hint ?? '',
    confidence: Number(row.confidence ?? 0),
    evidence: row.evidence ?? [],
    metadata,
    created: row.created,
    updated: row.updated,
  }
}

export function rowRelationship(row) {
  if (!row) return null
  return {
    id: row.id,
    scan: row.scan_id,
    source: row.source_id,
    target: row.target_id,
    type: row.type,
    created: row.created,
    updated: row.updated,
  }
}

export function rowArtifact(row) {
  if (!row) return null
  return {
    id: row.id,
    scan: row.scan_id,
    artifactType: row.artifact_type,
    filename: row.filename,
    contentType: row.content_type ?? '',
    rawContent: row.raw_content,
    sizeBytes: row.size_bytes ?? 0,
    sha256: row.sha256 ?? '',
    required: Boolean(row.required),
    validationStatus: row.validation_status ?? 'not_started',
    processingStatus: row.processing_status ?? 'not_started',
    metadata: row.metadata ?? {},
    created: row.created,
    updated: row.updated,
  }
}

export function rowFinding(row) {
  if (!row) return null
  return {
    id: row.id,
    scan: row.scan_id,
    fingerprint: row.fingerprint ?? '',
    ruleId: row.rule_id ?? '',
    severity: row.severity ?? 'unknown',
    filePath: row.file_path ?? '',
    line: row.line ?? 0,
    column: row.column_number ?? 0,
    selector: row.selector ?? '',
    occurrenceCount: row.occurrence_count ?? 1,
    suggestion: row.suggestion ?? '',
    affectedScreens: row.affected_screens ?? [],
    payload: row.payload ?? {},
    created: row.created,
    updated: row.updated,
  }
}
