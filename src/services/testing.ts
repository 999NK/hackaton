import pb from '@/lib/pocketbase/client'

export interface TestResult {
  gherkin: string
  playwright: string
}

export const generateTests = async (projectId: string, flowId: string): Promise<TestResult> => {
  return pb.send('/backend/v1/testing/generate', {
    method: 'POST',
    body: JSON.stringify({ projectId, flowId }),
    headers: { 'Content-Type': 'application/json' },
  })
}
