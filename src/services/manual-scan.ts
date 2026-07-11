import pb from '@/lib/pocketbase/client'

export interface ManualScanData {
  entities: any[]
  relationships?: any[]
}

export interface ManualScanResponse {
  scanId: string
}

export const submitManualScan = async (
  projectId: string,
  data: ManualScanData,
): Promise<ManualScanResponse> => {
  return await pb.send('/backend/v1/manual-scan', {
    method: 'POST',
    body: JSON.stringify({ projectId, data }),
    headers: { 'Content-Type': 'application/json' },
  })
}
