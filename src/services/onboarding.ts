import pb from '@/lib/pocketbase/client'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface OnboardingResponse {
  content: string
}

export const sendOnboardingMessage = async (
  projectId: string,
  message: string,
  conversationHistory: ChatMessage[],
): Promise<OnboardingResponse> => {
  return pb.send('/backend/v1/onboarding/chat', {
    method: 'POST',
    body: JSON.stringify({ projectId, message, conversationHistory }),
    headers: { 'Content-Type': 'application/json' },
  })
}
