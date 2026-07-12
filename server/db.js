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
  return {
    id: row.id,
    scan: row.scan_id,
    type: row.type,
    name: row.name,
    slug: row.slug ?? '',
    path: row.path ?? '',
    pageTitle: row.page_title ?? '',
    semanticLabels: row.semantic_labels ?? [],
    description: row.description ?? '',
    accessibilityHint: row.accessibility_hint ?? '',
    confidence: Number(row.confidence ?? 0),
    evidence: row.evidence ?? [],
    metadata: row.metadata ?? {},
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
