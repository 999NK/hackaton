import pb from '@/lib/pocketbase/client'

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
  return await pb.collection('semantic_entities').getFullList({
    filter: `scan = '${scanId}'`,
    sort: '-created',
  })
}

export const getEntityCount = async (scanId: string): Promise<number> => {
  const result = await pb.collection('semantic_entities').getList(1, 1, {
    filter: `scan = '${scanId}'`,
  })
  return result.totalItems
}
