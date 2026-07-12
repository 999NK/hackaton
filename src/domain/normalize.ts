// ============================================================
// src/domain/normalize.ts
// Normaliza payloads legados (v1) e v2 para NormalizedReport.
// Responsável por: deduplicação, fingerprint, score ponderado,
// preenchimento de suggestions e marcação de dados ausentes.
// ============================================================

import type {
  NormalizedReport,
  AccessibilityFinding,
  AuditCheckStats,
  AuditStats,
  BySeverityStats,
  MissingDataItem,
  ScanInputStatus,
  ScanScore,
  SemanticMap,
  Severity,
} from './types'
import { normalizeSeverity, SEVERITY_ORDER, SEVERITY_WEIGHTS } from './types'
import { getRuleDefinition, getGenericSuggestion } from './rule-catalog'

// --------------- Fingerprint ---------------

function simpleHash(str: string): string {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i)
    h |= 0 // force 32-bit
  }
  return Math.abs(h).toString(36)
}

export function computeFingerprint(
  ruleId: string,
  filePath: string,
  line?: number,
  column?: number,
  selector?: string,
  componentName?: string,
): string {
  const normPath = (filePath || '').replace(/\\/g, '/').toLowerCase()
  const key = [ruleId, normPath, line ?? '', column ?? '', selector ?? '', componentName ?? ''].join('|')
  return simpleHash(key)
}

// --------------- Score ---------------

export function computeWeightedScore(checks: AuditCheckStats, bySeverity: AuditStats['bySeverity']): ScanScore {
  const applicableCompleted = checks.passed + checks.failed
  if (applicableCompleted === 0) {
    return {
      value: undefined,
      status: 'unavailable',
      explanation: 'Score indisponível: o scanner não informou verificações aprovadas ou reprovadas.',
    }
  }

  // weighted failures = sum of (weight × unique_failures per severity)
  let weightedTotal = 0
  let weightedFailures = 0

  for (const sev of SEVERITY_ORDER) {
    const stats = bySeverity[sev]
    if (!stats) continue
    const w = SEVERITY_WEIGHTS[sev]
    weightedTotal += w * (stats.occurrences || 0)
    weightedFailures += w * (stats.uniqueFindings || 0)
  }

  // fallback: use checks.passed + checks.failed if bySeverity sums are 0
  if (weightedTotal === 0) {
    const w = 1
    weightedTotal = w * applicableCompleted
    weightedFailures = w * checks.failed
  }

  const raw = Math.round(100 * (1 - weightedFailures / weightedTotal))
  const value = Math.min(100, Math.max(0, raw))
  const coverage = checks.total > 0 ? Math.round((applicableCompleted / checks.total) * 100) : undefined

  return {
    value,
    status: 'available',
    coverage,
    explanation: `Score calculado com base em ${applicableCompleted} verificações concluídas. Pesos: critical=4, serious=3, moderate=2, minor/unknown=1.`,
  }
}

function estimateLegacyScore(violations: LegacyViolation[]): ScanScore {
  if (!violations.length) {
    return { value: 100, status: 'estimated', explanation: 'Estimativa: nenhuma violação encontrada.' }
  }
  const PENALTIES: Record<Severity, number> = { critical: 15, serious: 10, moderate: 5, minor: 2, unknown: 3 }
  let penalty = 0
  for (const v of violations) {
    const sev = normalizeSeverity(v.severity)
    penalty += PENALTIES[sev] ?? 3
  }
  const value = Math.min(100, Math.max(0, 100 - penalty))
  return {
    value,
    status: 'estimated',
    explanation:
      'Estimativa legada — o scanner não informou verificações aprovadas. Score baseado em penalidades por violação.',
  }
}

// --------------- Suggestion ---------------

function buildSuggestion(
  ruleId: string,
  severity: Severity,
  affectedFiles: string[],
  affectedScreens: string[],
): AccessibilityFinding['suggestion'] {
  const def = getRuleDefinition(ruleId) ?? getGenericSuggestion(ruleId, severity)
  const fileList = affectedFiles.map((f) => `- ${f}`).join('\n') || '- (arquivo não informado)'
  const prompt = def.promptTemplate
    .replace('{{FILES}}', fileList)
    .replace('{{SEVERITY}}', severity)
    .replace('{{SCREENS}}', String(affectedScreens.length))
  return {
    whyItMatters: def.whyItMatters,
    howToFix: def.howToFix,
    before: def.examples?.before,
    after: def.examples?.after,
    generatedPrompt: prompt,
  }
}

// --------------- Legacy types (what we receive from old scanner) ---------------

interface LegacyViolation {
  id?: string
  rule?: string
  ruleId?: string
  level?: string
  severity?: string
  impact?: string
  title?: string
  description?: string
  screen?: string
  filePath?: string
  file?: string
  selector?: string
  fix?: string
  wcagUrl?: string
}

interface LegacyWcagReport {
  score?: number
  level?: string
  violations?: LegacyViolation[]
  summary?: Record<string, number>
  auditedAt?: string
  rulesVersion?: string
}

interface LegacyReport {
  wcag?: LegacyWcagReport
  briefing?: string
  guidedFlows?: unknown[]
  history?: Array<{ scannedAt: string; score: number; violations: number }>
  navigationMap?: {
    screens?: Array<{ id: string; title?: string; route?: string }>
    navigationGraph?: unknown[]
  }
  [key: string]: unknown
}

// --------------- Semantic Map fallback ---------------

const EMPTY_SEMANTIC_MAP: SemanticMap = {
  version: '0.0',
  status: 'missing',
  project: {},
  routes: [],
  screens: [],
  sharedComponents: [],
  warnings: [{ code: 'no-map', message: 'Mapa semântico não recebido ou não gerado.' }],
  missingData: [{ field: 'semanticMap', reason: 'Scanner não enviou o mapa semântico.' }],
  stats: {
    routesDetected: 0,
    screensMapped: 0,
    sharedComponentsMapped: 0,
    actionsMapped: 0,
    formsMapped: 0,
    inputsMapped: 0,
    linksMapped: 0,
    headingsMapped: 0,
    landmarksMapped: 0,
  },
}

// --------------- Input Status ---------------

function buildInputStatus(
  violations: LegacyViolation[],
  legacy: LegacyReport,
): ScanInputStatus {
  const received: string[] = []
  const missing: string[] = []
  const warnings: string[] = []

  if (violations.length) received.push('violations')
  else missing.push('violations')

  if (legacy.wcag?.score != null) received.push('score')
  else missing.push('score')

  if (legacy.navigationMap?.screens?.length) received.push('screens')
  else missing.push('screens')

  if (legacy.guidedFlows?.length) received.push('guidedFlows')
  else warnings.push('Nenhum fluxo guiado identificado.')

  if (legacy.wcag?.auditedAt) received.push('auditedAt')

  const hasFilePaths = violations.some((v) => v.filePath || v.file)
  if (hasFilePaths) received.push('filePaths')
  else missing.push('filePaths — a maioria das violações não possui localização no código')

  const missingItems: MissingDataItem[] = missing.map((m) => ({
    field: m.split(' — ')[0],
    reason: m.includes(' — ') ? m.split(' — ')[1] : 'Não recebido pelo scanner.',
  }))

  const allReceived = received.length
  const allMissing = missing.length
  const status: ScanInputStatus['status'] =
    allMissing === 0 ? 'complete' : allReceived === 0 ? 'invalid' : 'partial'

  return { status, received, generated: [], missing: missing.map((m) => m.split(' — ')[0]), invalid: [], warnings, ...(missingItems.length ? {} : {}) }
}

// --------------- Core normalizer ---------------

function deduplicate(violations: LegacyViolation[]): Map<string, { violation: LegacyViolation; screens: Set<string> }> {
  const map = new Map<string, { violation: LegacyViolation; screens: Set<string> }>()
  for (const v of violations) {
    const ruleId = v.ruleId || v.rule || 'unknown'
    const filePath = v.filePath || v.file || ''
    const fp = computeFingerprint(ruleId, filePath, undefined, undefined, v.selector)
    const existing = map.get(fp)
    if (existing) {
      if (v.screen) existing.screens.add(v.screen)
    } else {
      map.set(fp, { violation: v, screens: new Set(v.screen ? [v.screen] : []) })
    }
  }
  return map
}

function buildFindings(
  deduped: Map<string, { violation: LegacyViolation; screens: Set<string> }>,
  legacyScreens: Array<{ id: string; title?: string; route?: string }>,
): AccessibilityFinding[] {
  const screensByRoute = new Map(legacyScreens.map((s) => [s.route ?? s.id, s]))
  const findings: AccessibilityFinding[] = []

  for (const [fp, { violation: v, screens }] of deduped) {
    const ruleId = v.ruleId || v.rule || 'unknown'
    const severity = normalizeSeverity(v.severity ?? v.impact)
    const filePath = v.filePath || v.file || ''

    const affectedScreens = [...screens].map((route) => {
      const screen = screensByRoute.get(route)
      return { route, screenId: screen?.id, title: screen?.title }
    })

    const suggestion = buildSuggestion(ruleId, severity, filePath ? [filePath] : [], affectedScreens.map((s) => s.route))

    findings.push({
      id: `finding-${fp}`,
      fingerprint: fp,
      ruleId,
      title: v.title || ruleId,
      description: v.description,
      severity,
      wcag: v.wcagUrl ? [v.wcagUrl] : [],
      source: { filePath, componentName: undefined },
      selector: v.selector,
      evidence: undefined,
      affectedScreens,
      occurrenceCount: Math.max(1, screens.size),
      suggestion,
      analysisSource: 'static',
      confidence: filePath ? 'probable' : 'needs-review',
    })
  }

  // Sort: critical first
  findings.sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity))
  return findings
}

function buildStats(findings: AccessibilityFinding[]): AuditStats {
  const bySeverity: AuditStats['bySeverity'] = {
    critical: { uniqueFindings: 0, occurrences: 0 },
    serious: { uniqueFindings: 0, occurrences: 0 },
    moderate: { uniqueFindings: 0, occurrences: 0 },
    minor: { uniqueFindings: 0, occurrences: 0 },
    unknown: { uniqueFindings: 0, occurrences: 0 },
  }
  const byRule: AuditStats['byRule'] = {}

  for (const f of findings) {
    bySeverity[f.severity].uniqueFindings++
    bySeverity[f.severity].occurrences += f.occurrenceCount

    if (!byRule[f.ruleId]) {
      byRule[f.ruleId] = {
        uniqueFindings: 0,
        occurrences: 0,
        checks: { total: 0, passed: 0, failed: 0, incomplete: 0, inapplicable: 0 },
      }
    }
    byRule[f.ruleId].uniqueFindings++
    byRule[f.ruleId].occurrences += f.occurrenceCount
    byRule[f.ruleId].checks.failed++
    byRule[f.ruleId].checks.total++
  }

  const totalOccurrences = findings.reduce((acc, f) => acc + f.occurrenceCount, 0)

  const checks: AuditCheckStats = {
    total: findings.length,
    passed: 0, // legacy doesn't tell us passed checks
    failed: findings.length,
    incomplete: 0,
    inapplicable: 0,
  }

  return {
    uniqueFindings: findings.length,
    totalOccurrences,
    checks,
    bySeverity,
    byRule,
  }
}

// --------------- Public API ---------------

/** Normalizes any legacy or unknown report into a NormalizedReport safe for rendering. */
export function normalizeLegacyScanResult(
  raw: unknown,
  meta: { scanId?: string; projectName?: string; framework?: string; language?: string } = {},
): NormalizedReport {
  const legacy = (raw ?? {}) as LegacyReport
  const violations: LegacyViolation[] = legacy.wcag?.violations ?? []
  const legacyScreens = legacy.navigationMap?.screens ?? []

  const deduped = deduplicate(violations)
  const findings = buildFindings(deduped, legacyScreens)
  const stats = buildStats(findings)

  // Score: prefer legacy score if available and checks are not available
  const hasChecks = stats.checks.passed > 0
  let score: ScanScore
  if (hasChecks) {
    score = computeWeightedScore(stats.checks, stats.bySeverity)
  } else if (legacy.wcag?.score != null) {
    score = {
      value: legacy.wcag.score,
      status: 'estimated',
      explanation: 'Score fornecido diretamente pelo scanner (estimativa — verificações aprovadas não disponíveis).',
    }
  } else {
    score = estimateLegacyScore(violations)
  }

  const inputStatus = buildInputStatus(violations, legacy)

  return {
    schemaVersion: '1.x (normalizado)',
    scanId: meta.scanId ?? 'unknown',
    score,
    stats,
    semanticMap: EMPTY_SEMANTIC_MAP,
    inputStatus,
    findings,
    project: {
      name: meta.projectName,
      framework: meta.framework,
      language: meta.language,
    },
    scanner: {
      warnings: [],
      errors: [],
    },
    legacyReport: legacy as Record<string, unknown>,
  }
}

/** Normalizes a NormalizedReport from v2 payload (pass-through with validation). */
export function normalizeV2ScanResult(raw: unknown, meta: { scanId?: string } = {}): NormalizedReport {
  // For now, if it looks like a v2 payload, attempt to use it, else fall back to legacy
  const r = raw as Record<string, unknown>
  if (r?.schemaVersion === '2.0' && r?.audit) {
    // TODO: validate with zod when added
    return r as unknown as NormalizedReport
  }
  return normalizeLegacyScanResult(raw, meta)
}
