import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { sendOnboardingMessage, type ChatMessage } from '@/services/onboarding'
import { renderMarkdown } from '@/lib/markdown'

const QUICK_SUGGESTIONS = [
  'Quais rotas existem?',
  'Onde fica a validação de CNPJ?',
  'Como funciona a emissão de NF-e?',
]
const MAX_MSGS = 20

function truncate(msgs: ChatMessage[]): ChatMessage[] {
  return msgs.length <= MAX_MSGS ? msgs : [...msgs.slice(0, 2), ...msgs.slice(-(MAX_MSGS - 2))]
}

export function OnboardingChat({ projectId }: { projectId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  const handleSend = async (text?: string) => {
    const msg = (text || input).trim()
    if (!msg || loading) return
    setInput('')
    const history = messages
    setMessages((prev) => truncate([...prev, { role: 'user', content: msg }]))
    setLoading(true)
    try {
      const res = await sendOnboardingMessage(projectId, msg, history)
      setMessages((prev) => truncate([...prev, { role: 'assistant', content: res.content }]))
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Erro ao processar a mensagem. Tente novamente.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[700px] glass-panel rounded-[2rem] overflow-hidden border-white/5">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-6">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
              <Bot size={32} className="text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-bold mb-2">Senior Technical Architect</h3>
              <p className="text-muted-foreground">Tire dúvidas sobre a arquitetura do sistema</p>
            </div>
            <div className="flex flex-wrap gap-3 justify-center max-w-lg">
              {QUICK_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="px-4 py-2 rounded-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-sm font-medium transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${m.role === 'user' ? 'bg-blue-500/20' : 'bg-primary/20'}`}
            >
              {m.role === 'user' ? (
                <User size={16} className="text-blue-400" />
              ) : (
                <Bot size={16} className="text-primary" />
              )}
            </div>
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${m.role === 'user' ? 'bg-blue-500/20' : 'glass-panel'}`}
            >
              <div dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} />
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Bot size={16} className="text-primary animate-pulse" />
            </div>
            <div className="glass-panel rounded-2xl px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-primary/50 animate-pulse" />
                <span
                  className="w-2 h-2 rounded-full bg-primary/50 animate-pulse"
                  style={{ animationDelay: '150ms' }}
                />
                <span
                  className="w-2 h-2 rounded-full bg-primary/50 animate-pulse"
                  style={{ animationDelay: '300ms' }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="border-t border-white/10 p-4">
        <div className="flex gap-3">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Pergunte sobre a arquitetura do sistema..."
            className="bg-black/30 border-white/10 h-12 rounded-xl flex-1"
            disabled={loading}
          />
          <Button
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            className="h-12 px-6 rounded-xl"
          >
            <Send size={18} />
          </Button>
        </div>
      </div>
    </div>
  )
}
