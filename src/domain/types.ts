// ============================================================
// src/domain/types.ts
// Tipos canônicos do domínio de auditoria de acessibilidade.
// NUNCA use "minor" como fallback de severity — use "unknown".
// ============================================================

// --------------- Severity ---------------

export type Severity = 'critical' | 'serious' | 'moderate' | 'minor' | 'unknown'

export const SEVERITY_ORDER: Severity[] = ['critical', 'serious', 'moderate', 'minor', 'unknown']
export const SEVERITY_WEIGHTS: Record<Severity, number> = {
  critical: 4,
  serious: 3,
  moderate: 2,
  minor: 1,
  unknown: 1,
}

/** Normaliza um valor raw de severity para o tipo canônico. Nunca retorna minor como fallback. */
export function normalizeSeverity(raw: unknown): Severity {
  if (typeof raw !== 'string') return 'unknown'
  const lower = raw.toLowerCase().trim()
  const valid: Severity[] = ['critical', 'serious', 'moderate', 'minor']
  return valid.includes(lower as Severity) ? (lower as Severity) : 'unknown'
}

// --------------- Audit Check Stats ---------------

export interface AuditCheckStats {
  total: number
  passed: number
  failed: number
  incomplete: number
  inapplicable: number
}

// --------------- Score ---------------

export interface ScanScore {
  /** Numeric 0–100, or undefined when unavailable */
  value?: number
  /** available = calculated from real checks; estimated = heuristic fallback; unavailable = no data */
  status: 'available' | 'estimated' | 'unavailable'
  /** percentage of expected checks that were actually evaluated */
  coverage?: number
  explanation: string
}

// --------------- Finding ---------------

export interface FindingSource {
  filePath: string
  line?: number
  column?: number
  componentName?: string
}

export interface AffectedScreen {
  screenId?: string
  route: string
  title?: string
}

export interface FindingSuggestion {
  whyItMatters: string
  howToFix: string[]
  before?: string
  after?: string
  /** Prompt ready to paste into an AI agent to fix this issue */
  generatedPrompt: string
}

export type FindingAnalysisSource = 'static' | 'runtime' | 'manual' | 'combined'
export type FindingConfidence = 'confirmed' | 'probable' | 'needs-review'

export interface AccessibilityFinding {
  id: string
  /** Hash used for deduplication across routes that share the same component */
  fingerprint: string

  ruleId: string
  title: string
  description?: string
  severity: Severity
  wcag: string[]

  source: FindingSource
  selector?: string
  evidence?: string

  affectedScreens: AffectedScreen[]
  occurrenceCount: number

  suggestion: FindingSuggestion

  analysisSource: FindingAnalysisSource
  confidence: FindingConfidence
}

// --------------- Semantic Map ---------------

export interface SemanticElement {
  id: string
  tagName?: string
  role?: string
  accessibleName?: string
  selector?: string
  source?: { filePath?: string; line?: number; column?: number }
}

export interface SemanticForm {
  id: string
  selector?: string
  inputs: SemanticElement[]
  submitButton?: SemanticElement
}

export type ActionKind = 'navigation' | 'click' | 'submit' | 'fill' | 'search' | 'toggle' | 'unknown'

export interface SemanticAction {
  id: string
  label?: string
  kind: ActionKind
  intent?: string
  targetRoute?: string
  selector?: string
  anchorId?: string
  accessibleName?: string
  confidence: 'high' | 'medium' | 'low'
  warnings: string[]
}

export interface SemanticScreen {
  id: string
  title?: string
  route: string
  filePath?: string
  componentName?: string
  landmarks: SemanticElement[]
  headings: SemanticElement[]
  forms: SemanticForm[]
  inputs: SemanticElement[]
  buttons: SemanticElement[]
  links: SemanticElement[]
  actions: SemanticAction[]
  confidence: 'high' | 'medium' | 'low'
  warnings: string[]
}

export interface SemanticRoute {
  path: string
  componentName?: string
  filePath?: string
  screenId?: string
}

export interface SemanticWarning {
  code: string
  message: string
  field?: string
}

export interface MissingDataItem {
  field: string
  reason: string
}

export interface SemanticMapStats {
  routesDetected: number
  screensMapped: number
  sharedComponentsMapped: number
  actionsMapped: number
  formsMapped: number
  inputsMapped: number
  linksMapped: number
  headingsMapped: number
  landmarksMapped: number
}

export interface SemanticMap {
  version: string
  status: 'complete' | 'partial' | 'missing' | 'failed'
  generatedAt?: string
  project: { name?: string; framework?: string; language?: string; rootPath?: string }
  routes: SemanticRoute[]
  screens: SemanticScreen[]
  sharedComponents: SemanticElement[]
  warnings: SemanticWarning[]
  missingData: MissingDataItem[]
  stats: SemanticMapStats
}

// --------------- Input Status ---------------

export interface ScanInputStatus {
  status: 'complete' | 'partial' | 'invalid'
  received: string[]
  generated: string[]
  missing: string[]
  invalid: { field: string; reason: string }[]
  warnings: string[]
}

// --------------- Scan Stats ---------------

export interface BySeverityStats {
  uniqueFindings: number
  occurrences: number
}

export interface ByRuleStats {
  uniqueFindings: number
  occurrences: number
  checks: AuditCheckStats
  score?: number
}

export interface AuditStats {
  uniqueFindings: number
  totalOccurrences: number
  checks: AuditCheckStats
  bySeverity: Record<Severity, BySeverityStats>
  byRule: Record<string, ByRuleStats>
}

// --------------- Scan Result (Schema v2) ---------------

export type ScanStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'completed_with_warnings'
  | 'failed'

export interface ScanResult {
  schemaVersion: '2.0'
  scanId: string
  status: ScanStatus
  project: { name?: string; framework?: string; language?: string }
  inputStatus: ScanInputStatus
  semanticMap: SemanticMap
  audit: {
    findings: AccessibilityFinding[]
    stats: AuditStats
    score?: ScanScore
  }
  scanner: {
    startedAt?: string
    finishedAt?: string
    durationMs?: number
    version?: string
    filesReceived?: number
    filesScanned?: number
    warnings: string[]
    errors: string[]
  }
}

// --------------- Rule Definition (Catalog) ---------------

export interface RuleDefinition {
  ruleId: string
  title: string
  description: string
  wcag: string[]
  defaultSeverity: Severity
  whyItMatters: string
  howToFix: string[]
  documentation?: string[]
  examples?: { before?: string; after?: string }
  promptTemplate: string
}

// --------------- Normalized Report (used by UI) ---------------

/** The result of running a legacy or v2 report through the normalizer. Always safe to render. */
export interface NormalizedReport {
  schemaVersion: string
  scanId: string
  score: ScanScore
  stats: AuditStats
  semanticMap: SemanticMap
  inputStatus: ScanInputStatus
  findings: AccessibilityFinding[]
  project: { name?: string; framework?: string; language?: string }
  scanner: ScanResult['scanner']
  /** Raw report kept for reference (briefing, history, etc.) */
  legacyReport?: Record<string, unknown>
}
