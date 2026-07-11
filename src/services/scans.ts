import pb from '@/lib/pocketbase/client'

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
  return await pb.collection('scans').getFullList({
    filter: `project = '${projectId}'`,
    sort: '-created',
  })
}

export const getAllScans = async (): Promise<Scan[]> => {
  return await pb.collection('scans').getFullList({ sort: '-created' })
}

export const reprocessScan = async (projectId: string): Promise<Scan> => {
  return await pb.collection('scans').create({
    project: projectId,
    status: 'PROCESSING',
  })
}
