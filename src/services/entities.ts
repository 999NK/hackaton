import { apiFetch } from '@/lib/api'

export interface SemanticEntity {
  id: string
  scan: string
  type: 'ROUTE' | 'COMPONENT' | 'API' | 'FLOW' | 'BUSINESS_RULE'
  name: string
  slug: string
  path: string
  pageTitle: string
  semanticLabels: any
  description: string
  accessibilityHint: string
  confidence: number
  evidence: any
  metadata: any
  created: string
  updated: string
}

export const getEntities = async (scanId: string): Promise<SemanticEntity[]> => {
  return await apiFetch<SemanticEntity[]>(`/api/entities?scanId=${encodeURIComponent(scanId)}`)
}

export const getEntityCount = async (scanId: string): Promise<number> => {
  const result = await apiFetch<{ count: number }>(
    `/api/entities/count?scanId=${encodeURIComponent(scanId)}`,
  )
  return result.count
}
