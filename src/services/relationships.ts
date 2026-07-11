import pb from '@/lib/pocketbase/client'

export interface Relationship {
  id: string
  scan: string
  source: string
  target: string
  type: 'CONTAINS' | 'CONSUMES' | 'TRIGGERS' | 'REDIRECTS' | 'VALIDATES'
  created: string
  updated: string
}

export const getRelationships = async (scanId: string): Promise<Relationship[]> => {
  return await pb.collection('relationships').getFullList({
    filter: `scan = '${scanId}'`,
  })
}
