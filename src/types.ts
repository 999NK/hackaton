export type Severity = 'critical' | 'serious' | 'moderate' | 'minor'
export type WcagLevel = 'A' | 'AA' | 'AAA'

export interface WcagViolation {
  id: string
  rule: string
  level: WcagLevel
  severity: Severity
  impact?: string
  title: string
  description: string
  screen: string
  filePath: string
  selector: string
  fix: string
  wcagUrl: string
}

export interface WcagReport {
  score: number
  level: WcagLevel
  violations: WcagViolation[]
  summary: Record<Severity, number>
  auditedAt: string
  rulesVersion: string
}

export interface GuidedFlowStep {
  screen: string
  action: string
  label: string
  navigatesTo?: string | null
}

export interface GuidedFlow {
  name: string
  description?: string
  steps: GuidedFlowStep[]
}

export interface HistoryEntry {
  scannedAt: string
  score: number
  violations: number
  critical?: number
  serious?: number
  moderate?: number
  minor?: number
}

export interface ScanReport {
  navigationMap?: {
    screens?: Array<{ id: string; title: string; route: string; actions?: unknown[] }>
    navigationGraph?: Array<{ from: string; to: string; label?: string }>
  }
  briefing?: string
  wcag?: WcagReport
  guidedFlows?: GuidedFlow[]
  history?: HistoryEntry[]
  [key: string]: unknown
}
