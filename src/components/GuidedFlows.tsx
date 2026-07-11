import { useState } from 'react'
import { ChevronDown, ExternalLink, FormInput, MousePointerClick, Navigation, Send } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { GuidedFlow } from '@/types'

const actionIcon: Record<string, React.ReactNode> = { fill: <FormInput size={15} />, submit: <Send size={15} />, navigation: <Navigation size={15} />, navigate: <Navigation size={15} />, click: <MousePointerClick size={15} /> }

export function GuidedFlows({ flows = [] }: { flows?: GuidedFlow[] }) {
  if (!flows.length) return null
  return <section className="surface-card p-6 sm:p-8"><div className="mb-5"><p className="eyebrow">Modo guiado</p><h2 className="mt-1 text-lg font-semibold text-slate-950">Fluxos detectados</h2></div><div className="space-y-3">{flows.map((flow, index) => <FlowItem key={`${flow.name}-${index}`} flow={flow} defaultOpen={index === 0} />)}</div></section>
}

function FlowItem({ flow, defaultOpen }: { flow: GuidedFlow; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return <Collapsible open={open} onOpenChange={setOpen} className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><CollapsibleTrigger className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-slate-50"><div className="grid h-9 w-9 place-items-center rounded-xl bg-violet-50 text-violet-600"><Navigation size={17} /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{flow.name}</p>{flow.description && <p className="mt-0.5 truncate text-xs text-slate-400">{flow.description}</p>}</div><Badge variant="secondary" className="rounded-full bg-slate-100 text-slate-600">{flow.steps.length} passos</Badge><ChevronDown size={16} className={`text-slate-400 transition ${open ? 'rotate-180' : ''}`} /></CollapsibleTrigger><CollapsibleContent><ol className="border-t border-slate-100 bg-slate-50/60 px-4 py-3">{flow.steps.map((step, index) => <li key={`${step.screen}-${step.label}-${index}`} className="flex gap-3 py-2.5"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-[10px] font-bold text-slate-500 shadow-sm">{index + 1}</span><span className="mt-0.5 text-blue-600">{actionIcon[step.action] || <MousePointerClick size={15} />}</span><p className="min-w-0 text-xs leading-5 text-slate-600"><code className="font-semibold text-slate-800">{step.screen}</code> · <span className="font-medium">{step.action}</span>: {step.label}{step.navigatesTo && <span className="ml-1 inline-flex items-center gap-1 text-blue-600">→ {step.navigatesTo} <ExternalLink size={10} /></span>}</p></li>)}</ol></CollapsibleContent></Collapsible> }
