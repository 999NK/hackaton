import { apiFetch } from '@/lib/api'

export type WcagSeverity = 'critical' | 'serious' | 'moderate' | 'minor'

export interface WcagViolation {
  id: string
  rule: string
  level: 'A' | 'AA' | 'AAA'
  severity: WcagSeverity
  impact: string
  title: string
  description: string
  screen: string
  filePath: string
  selector?: string
  fix: string
  wcagUrl?: string
}

export interface WcagReport {
  score: number
  level: 'A' | 'AA' | 'AAA'
  violations: WcagViolation[]
  summary: Record<WcagSeverity, number>
  auditedAt: string
  rulesVersion: string
}

export interface GuidedFlowStep {
  screen: string
  action: string
  label: string
  navigatesTo?: string
}

export interface GuidedFlow {
  name: string
  steps: GuidedFlowStep[]
}

export interface ScoreHistoryEntry {
  scannedAt: string
  score: number
  violations: number
}

export interface ScanReport {
  navigationMap?: {
    screens?: Array<{ id: string; title: string; route: string; actions?: unknown[] }>
    navigationGraph?: Array<{ from: string; to: string; label?: string }>
  }
  briefing?: string
  wcag?: WcagReport
  guidedFlows?: GuidedFlow[]
  history?: ScoreHistoryEntry[]
  [key: string]: unknown
}

export interface Scan {
  id: string
  project: string
  status: 'PROCESSING' | 'ENRICHING' | 'COMPLETED' | 'FAILED'
  filesCount: number
  secretsFound: number
  errorMessage: string
  phase?: string
  phaseDetail?: string
  tokenUsed?: number
  tokenBudget?: number
  filesUploaded?: number
  report: ScanReport
  entitiesCount: number
  token: string
  created: string
  updated: string
}

export const getScans = async (projectId: string): Promise<Scan[]> => {
  return await apiFetch<Scan[]>(`/api/scans?projectId=${encodeURIComponent(projectId)}`)
}

export const getAllScans = async (): Promise<Scan[]> => {
  return await apiFetch<Scan[]>('/api/scans')
}

export const reprocessScan = async (projectId: string): Promise<Scan> => {
  return await apiFetch<Scan>('/api/scans/reprocess', {
    method: 'POST',
    body: JSON.stringify({ projectId }),
  })
}
