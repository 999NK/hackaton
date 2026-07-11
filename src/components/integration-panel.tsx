import { useState } from 'react'
import { Bot, Check, Copy, ExternalLink, KeyRound, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Project } from '@/services/projects'
import { buildSkipAgentPrompt } from '@/lib/scan-prompt'
import { toast } from '@/hooks/use-toast'

export function IntegrationPanel({ project }: { project: Project }) {
  const [copied, setCopied] = useState<'prompt' | 'token' | null>(null)
  const prompt = buildSkipAgentPrompt(project)

  const copy = async (value: string, type: 'prompt' | 'token') => {
    await navigator.clipboard.writeText(value)
    setCopied(type); toast({ title: type === 'prompt' ? 'Prompt copiado para a LLM' : 'Token copiado' })
    window.setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.65fr_1fr]">
      <section className="surface-card overflow-hidden">
        <div className="border-b border-violet-100 p-6 sm:p-8"><div className="flex items-start gap-4"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-50 text-violet-600"><Bot size={23} /></div><div><p className="eyebrow">Instalação assistida</p><h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Prompt para seu agente de IA</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Cole este prompt no Codex, Claude Code, Cursor ou outro agente compatível. Ele instalará a skill, analisará o projeto e enviará o scan.</p></div></div></div>
        <div className="p-6 sm:p-8"><div className="relative rounded-2xl border border-slate-800 bg-[#171521] p-5 shadow-inner"><pre className="max-h-[420px] overflow-auto whitespace-pre-wrap pr-2 font-mono text-[13px] leading-6 text-slate-300"><code>{prompt}</code></pre></div><Button onClick={() => copy(prompt, 'prompt')} className="mt-4 h-11 w-full gap-2 rounded-full bg-violet-600 font-semibold text-white hover:bg-violet-700 sm:w-auto">{copied === 'prompt' ? <Check size={17} /> : <Copy size={17} />} {copied === 'prompt' ? 'Prompt copiado' : 'Copiar prompt completo'}</Button></div>
      </section>
      <div className="space-y-6">
        <section className="surface-card p-6"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><ShieldCheck size={19} /></div><div><p className="text-sm font-semibold text-slate-900">Privacidade local</p><p className="text-xs text-slate-400">Seu código não é enviado</p></div></div><p className="mt-4 text-sm leading-6 text-slate-500">A skill lê os arquivos localmente e envia somente o mapa, score e violações estruturadas.</p><a href="https://github.com/999NK/skip-skill" target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-violet-600 hover:underline">Ver skill no GitHub <ExternalLink size={14} /></a></section>
        <section className="surface-card p-6"><div className="flex items-center gap-2"><KeyRound size={18} className="text-slate-400" /><h3 className="font-semibold text-slate-900">Token do projeto</h3></div><code className="mt-4 block break-all rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">{project.token}</code><Button variant="outline" onClick={() => copy(project.token, 'token')} className="mt-3 h-10 gap-2 rounded-xl border-slate-200 bg-white text-slate-700">{copied === 'token' ? <Check size={15} /> : <Copy size={15} />} Copiar token</Button><p className="mt-4 text-xs leading-5 text-amber-700">Mantenha este token privado. Ele permite enviar scans para este projeto.</p></section>
      </div>
    </div>
  )
}
