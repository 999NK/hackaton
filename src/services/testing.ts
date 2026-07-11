import { apiFetch } from '@/lib/api'

export interface TestResult {
  gherkin: string
  playwright: string
}

export const generateTests = async (projectId: string, flowId: string): Promise<TestResult> => {
  return apiFetch<TestResult>('/backend/v1/testing/generate', {
    method: 'POST',
    body: JSON.stringify({ projectId, flowId }),
  })
}
