import { AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { WcagReport, Severity } from '@/types'

const severityStyle: Record<Severity, string> = {
  critical: 'border-red-200 bg-red-50 text-red-700',
  serious: 'border-orange-200 bg-orange-50 text-orange-700',
  moderate: 'border-amber-200 bg-amber-50 text-amber-700',
  minor: 'border-slate-200 bg-slate-50 text-slate-600',
}

function scoreStyle(score: number) {
  if (score >= 90) return 'bg-green-50 text-green-600'
  if (score >= 70) return 'bg-yellow-50 text-yellow-600'
  if (score >= 50) return 'bg-purple-50 text-purple-600'
  return 'bg-red-50 text-red-600'
}

export function ScoreCard({ wcag }: { wcag?: WcagReport }) {
  if (!wcag) return <section className="surface-card flex min-h-56 items-center justify-center p-8 text-center"><div><div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-400"><ShieldCheck size={26} /></div><h2 className="text-lg font-semibold text-slate-900">Nenhum scan ainda</h2><p className="mt-2 text-sm text-slate-500">Rode o scanner para ver o score.</p></div></section>
  return (
    <section className="surface-card overflow-hidden p-6 sm:p-8">
      <div className="mb-6 flex items-center gap-2"><ShieldCheck size={19} className="text-violet-600" /><h2 className="text-lg font-semibold text-slate-950">Score de acessibilidade</h2></div>
      <div className="flex flex-col justify-between gap-7 lg:flex-row lg:items-center">
        <div className="flex items-center gap-5"><div className={`flex items-end rounded-[24px] px-6 py-5 ${scoreStyle(wcag.score)}`}><strong className="text-6xl font-semibold tracking-[-0.06em]">{wcag.score}</strong><span className="mb-1.5 ml-1 text-lg font-semibold opacity-60">/100</span></div><div><p className="text-sm text-slate-400">Conformidade alcançada</p><Badge className="mt-2 border-violet-200 bg-violet-50 px-3 py-1 text-violet-700 hover:bg-violet-50">Nível {wcag.level}</Badge><p className="mt-3 text-xs text-slate-400">Regras {wcag.rulesVersion}</p></div></div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{(Object.keys(severityStyle) as Severity[]).map((severity) => <div key={severity} className={`min-w-28 rounded-2xl border p-4 ${severityStyle[severity]}`}><div className="flex items-center gap-1.5">{severity === 'critical' ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}<span className="text-[10px] font-bold uppercase tracking-wider">{severity}</span></div><strong className="mt-2 block text-2xl font-semibold">{wcag.summary?.[severity] || 0}</strong></div>)}</div>
      </div>
    </section>
  )
}
