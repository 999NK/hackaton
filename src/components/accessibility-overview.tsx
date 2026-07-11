import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  FileCode2,
  Route,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { ScanReport, WcagSeverity, WcagViolation } from '@/services/scans'

const severityMeta: Record<WcagSeverity, { label: string; color: string; dot: string }> = {
  critical: { label: 'Críticas', color: 'text-red-700 bg-red-50 border-red-200', dot: 'bg-red-500' },
  serious: { label: 'Sérias', color: 'text-orange-700 bg-orange-50 border-orange-200', dot: 'bg-orange-500' },
  moderate: { label: 'Moderadas', color: 'text-amber-700 bg-amber-50 border-amber-200', dot: 'bg-amber-500' },
  minor: { label: 'Menores', color: 'text-sky-700 bg-sky-50 border-sky-200', dot: 'bg-sky-500' },
}

function scoreTone(score: number) {
  if (score >= 90) return { text: 'Excelente', color: '#16a34a', soft: 'bg-emerald-50 text-emerald-700' }
  if (score >= 75) return { text: 'Bom', color: '#2563eb', soft: 'bg-blue-50 text-blue-700' }
  if (score >= 50) return { text: 'Precisa de atenção', color: '#d97706', soft: 'bg-amber-50 text-amber-700' }
  return { text: 'Crítico', color: '#dc2626', soft: 'bg-red-50 text-red-700' }
}

export function AccessibilityOverview({ report }: { report: ScanReport | undefined }) {
  const wcag = report?.wcag
  const violations = wcag?.violations || []
  const flows = report?.guidedFlows || []
  const screens = report?.navigationMap?.screens || []
  const history = report?.history || []
  const tone = scoreTone(wcag?.score ?? 0)

  if (!wcag) {
    return (
      <div className="surface-card flex min-h-[360px] flex-col items-center justify-center p-10 text-center">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <ShieldCheck size={28} />
        </div>
        <h3 className="text-xl font-semibold text-slate-950">Aguardando auditoria WCAG</h3>
        <p className="mt-2 max-w-lg text-sm leading-6 text-slate-500">
          Este scan usa o formato anterior. Execute a nova versão do scanner para receber score,
          violações estruturadas, fluxos guiados e histórico de evolução.
        </p>
      </div>
    )
  }

  const counts = wcag.summary || { critical: 0, serious: 0, moderate: 0, minor: 0 }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.15fr_1.85fr]">
        <section className="surface-card p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Saúde de acessibilidade</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Score WCAG</h2>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone.soft}`}>{tone.text}</span>
          </div>
          <div className="mt-8 flex items-center gap-7">
            <div
              className="relative grid h-36 w-36 shrink-0 place-items-center rounded-full"
              style={{ background: `conic-gradient(${tone.color} ${wcag.score * 3.6}deg, #e8edf4 0deg)` }}
            >
              <div className="grid h-[112px] w-[112px] place-items-center rounded-full bg-white shadow-inner">
                <div className="text-center">
                  <strong className="block text-4xl font-semibold tracking-tight text-slate-950">{wcag.score}</strong>
                  <span className="text-xs font-medium text-slate-400">de 100</span>
                </div>
              </div>
            </div>
            <div className="min-w-0 space-y-3">
              <div><span className="text-xs text-slate-400">Nível alcançado</span><p className="text-lg font-semibold text-slate-900">WCAG {wcag.level}</p></div>
              <div><span className="text-xs text-slate-400">Regras</span><p className="text-sm font-medium text-slate-700">Versão {wcag.rulesVersion}</p></div>
              <div><span className="text-xs text-slate-400">Auditado em</span><p className="text-sm font-medium text-slate-700">{new Date(wcag.auditedAt).toLocaleString('pt-BR')}</p></div>
            </div>
          </div>
        </section>

        <section className="surface-card p-6 sm:p-8">
          <p className="eyebrow">Diagnóstico</p>
          <div className="mt-2 flex items-end justify-between gap-4">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">{violations.length} problemas encontrados</h2>
            <span className="text-sm text-slate-400">Priorize do mais grave</span>
          </div>
          <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {(Object.keys(severityMeta) as WcagSeverity[]).map((severity) => (
              <div key={severity} className={`rounded-2xl border p-4 ${severityMeta[severity].color}`}>
                <div className="flex items-center gap-2 text-xs font-semibold"><span className={`h-2 w-2 rounded-full ${severityMeta[severity].dot}`} />{severityMeta[severity].label}</div>
                <strong className="mt-3 block text-3xl font-semibold">{counts[severity] || 0}</strong>
              </div>
            ))}
          </div>
          <div className="mt-6 grid grid-cols-3 gap-3 border-t border-slate-100 pt-5 text-center">
            <Metric value={screens.length} label="Telas" />
            <Metric value={report?.navigationMap?.navigationGraph?.length || 0} label="Caminhos" />
            <Metric value={flows.length} label="Fluxos guiados" />
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <ViolationsList violations={violations} />
        <div className="space-y-6">
          <GuidedFlows flows={flows} />
          <ScoreHistory history={history} currentScore={wcag.score} />
        </div>
      </div>
    </div>
  )
}

function Metric({ value, label }: { value: number; label: string }) {
  return <div><strong className="block text-xl font-semibold text-slate-900">{value}</strong><span className="text-xs text-slate-400">{label}</span></div>
}

function ViolationsList({ violations }: { violations: WcagViolation[] }) {
  const [filter, setFilter] = useState<WcagSeverity | 'all'>('all')
  const [expanded, setExpanded] = useState<string | null>(violations[0] ? `${violations[0].id}-0` : null)
  const filtered = useMemo(() => filter === 'all' ? violations : violations.filter((v) => v.severity === filter), [filter, violations])

  return (
    <section className="surface-card overflow-hidden">
      <div className="border-b border-slate-100 p-6 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><p className="eyebrow">Plano de correção</p><h2 className="mt-1 text-xl font-semibold text-slate-950">Violações detectadas</h2></div>
          <select value={filter} onChange={(e) => setFilter(e.target.value as WcagSeverity | 'all')} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400">
            <option value="all">Todas as severidades</option>
            <option value="critical">Críticas</option><option value="serious">Sérias</option><option value="moderate">Moderadas</option><option value="minor">Menores</option>
          </select>
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {filtered.length === 0 ? <div className="p-10 text-center text-sm text-slate-500"><CheckCircle2 className="mx-auto mb-3 text-emerald-500" />Nenhuma violação nesta categoria.</div> : filtered.map((item, index) => {
          const key = `${item.id}-${index}`
          const open = expanded === key
          const meta = severityMeta[item.severity]
          return (
            <article key={key}>
              <button onClick={() => setExpanded(open ? null : key)} className="flex w-full items-start gap-4 p-5 text-left transition hover:bg-slate-50/80 sm:p-6">
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${meta.dot}`} />
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-900">{item.title}</h3><span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">{item.rule}</span></div><p className="mt-1 truncate text-sm text-slate-500">{item.screen} · {item.filePath}</p></div>
                <ChevronDown size={18} className={`mt-1 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
              </button>
              {open && <div className="bg-slate-50/80 px-6 pb-6 pt-1 sm:pl-12"><p className="text-sm leading-6 text-slate-600">{item.description}</p><div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/70 p-4"><div className="flex gap-3"><Sparkles size={17} className="mt-0.5 shrink-0 text-blue-600" /><div><p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Como corrigir</p><p className="mt-1 text-sm leading-6 text-blue-900">{item.fix}</p></div></div></div><div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500"><span className="inline-flex items-center gap-1"><FileCode2 size={14} /> {item.selector || 'Seletor não informado'}</span>{item.wcagUrl && <a href={item.wcagUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline">Referência WCAG <ExternalLink size={12} /></a>}</div></div>}
            </article>
          )
        })}
      </div>
    </section>
  )
}

function GuidedFlows({ flows }: { flows: NonNullable<ScanReport['guidedFlows']> }) {
  return <section className="surface-card p-6"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-600"><Route size={20} /></div><div><p className="eyebrow">Modo guiado</p><h2 className="text-lg font-semibold text-slate-950">Fluxos detectados</h2></div></div><div className="mt-5 space-y-3">{flows.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Nenhum fluxo guiado identificado.</p> : flows.slice(0, 4).map((flow, i) => <div key={`${flow.name}-${i}`} className="rounded-2xl border border-slate-100 p-4"><div className="flex items-center justify-between gap-3"><p className="font-semibold text-slate-800">{flow.name}</p><span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">{flow.steps.length} passos</span></div><div className="mt-3 flex items-center gap-1 overflow-hidden text-xs text-slate-400">{flow.steps.slice(0, 3).map((step, j) => <span key={`${step.label}-${j}`} className="contents"><span className="truncate">{step.label}</span>{j < Math.min(flow.steps.length, 3) - 1 && <ArrowRight size={12} className="shrink-0" />}</span>)}</div></div>)}</div></section>
}

function ScoreHistory({ history, currentScore }: { history: NonNullable<ScanReport['history']>; currentScore: number }) {
  const points = history.length ? history.slice(-7) : [{ scannedAt: new Date().toISOString(), score: currentScore, violations: 0 }]
  return <section className="surface-card p-6"><div className="flex items-center justify-between"><div><p className="eyebrow">Evolução</p><h2 className="mt-1 text-lg font-semibold text-slate-950">Histórico do score</h2></div><AlertTriangle size={19} className="text-slate-300" /></div><div className="mt-6 flex h-28 items-end gap-2">{points.map((entry, i) => <div key={`${entry.scannedAt}-${i}`} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-2"><span className="text-[10px] font-semibold text-slate-500 opacity-0 transition group-hover:opacity-100">{entry.score}</span><div className="w-full rounded-t-lg bg-blue-500/80 transition hover:bg-blue-600" style={{ height: `${Math.max(entry.score, 8)}%` }} /><span className="text-[9px] text-slate-400">{new Date(entry.scannedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span></div>)}</div></section>
}
