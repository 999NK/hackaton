import { apiFetch } from '@/lib/api'

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
  return apiFetch<OnboardingResponse>('/backend/v1/onboarding/chat', {
    method: 'POST',
    body: JSON.stringify({ projectId, message, conversationHistory }),
  })
}
