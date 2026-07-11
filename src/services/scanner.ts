const BASE_URL = import.meta.env.VITE_POCKETBASE_URL

export interface ScanPayload {
  projectName: string
  routes?: Array<{ path: string; name: string }>
  components?: Array<{ name: string; type: string; selector?: string }>
  apis?: Array<{ method: string; endpoint: string }>
  flows?: Array<Record<string, unknown>>
  filesCount?: number
  secretsFound?: number
}

export interface ScanStatus {
  status: string
  entitiesCount: number
  errorMessage: string | null
}

export const submitScan = async (
  token: string,
  payload: ScanPayload,
): Promise<{ scanId: string }> => {
  const res = await fetch(`${BASE_URL}/backend/v1/scanner`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(data.error || `HTTP ${res.status}`)
  }

  return res.json()
}

export const getScanStatus = async (token: string, scanId: string): Promise<ScanStatus> => {
  const res = await fetch(`${BASE_URL}/backend/v1/scanner/status/${scanId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(data.error || `HTTP ${res.status}`)
  }

  return res.json()
}

export const pollScanStatus = async (
  token: string,
  scanId: string,
  intervalMs: number = 2000,
  maxAttempts: number = 60,
): Promise<ScanStatus> => {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await getScanStatus(token, scanId)
    if (status.status === 'COMPLETED' || status.status === 'FAILED') {
      return status
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  throw new Error('Scan polling timed out')
}
