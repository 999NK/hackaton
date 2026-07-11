import { apiFetch } from '@/lib/api'

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
  report: any
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
