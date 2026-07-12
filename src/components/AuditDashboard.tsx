// ============================================================
// src/components/AuditDashboard.tsx
// Dashboard principal de auditoria: score, resumo, findings.
// Recebe um NormalizedReport e é completamente agnóstico ao
// formato do payload original.
// ============================================================

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Info,
  ShieldCheck,
} from 'lucide-react'
import type { NormalizedReport, Severity } from '@/domain/types'
import { SEVERITY_ORDER } from '@/domain/types'
import { FindingsTable } from './FindingsTable'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

// ─── Score display helpers ────────────────────────────────────

function scoreTone(score: number) {
  if (score >= 90) return { text: 'Excelente', color: '#16a34a', ring: 'ring-emerald-400', soft: 'bg-emerald-50 text-emerald-700' }
  if (score >= 75) return { text: 'Bom', color: '#2563eb', ring: 'ring-blue-400', soft: 'bg-blue-50 text-blue-700' }
  if (score >= 50) return { text: 'Atenção', color: '#d97706', ring: 'ring-amber-400', soft: 'bg-amber-50 text-amber-700' }
  return { text: 'Crítico', color: '#dc2626', ring: 'ring-red-400', soft: 'bg-red-50 text-red-700' }
}

const SEVERITY_META: Record<Severity, { label: string; color: string; dot: string }> = {
  critical: { label: 'Críticos', color: 'text-red-700 bg-red-50 border-red-200', dot: 'bg-red-500' },
  serious:  { label: 'Sérios',   color: 'text-orange-700 bg-orange-50 border-orange-200', dot: 'bg-orange-500' },
  moderate: { label: 'Moderados', color: 'text-amber-700 bg-amber-50 border-amber-200', dot: 'bg-amber-500' },
  minor:    { label: 'Menores',  color: 'text-sky-700 bg-sky-50 border-sky-200', dot: 'bg-sky-400' },
  unknown:  { label: 'Sem sev.', color: 'text-slate-600 bg-slate-100 border-slate-200', dot: 'bg-slate-400' },
}

// ─── Sub-components ──────────────────────────────────────────

function ScoreGauge({ score, coverage }: { score?: number; coverage?: number }) {
  if (score == null) {
    return (
      <div className="flex min-h-36 items-center justify-center rounded-full">
        <p className="text-center text-sm text-slate-400">Score<br />indisponível</p>
      </div>
    )
  }
  const tone = scoreTone(score)
  return (
    <div className="relative flex h-36 w-36 shrink-0 items-center justify-center">
      <svg className="absolute inset-0" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e8edf4" strokeWidth="3.2" />
        <circle
          cx="18" cy="18" r="15.9"
          fill="none"
          stroke={tone.color}
          strokeWidth="3.2"
          strokeDasharray={`${score} ${100 - score}`}
          strokeDashoffset="25"
          strokeLinecap="round"
          transform="rotate(-90 18 18)"
        />
      </svg>
      <div className="text-center">
        <strong className="block text-4xl font-semibold tracking-tight text-slate-950">{score}</strong>
        <span className="text-xs text-slate-400">de 100</span>
        {coverage != null && (
          <p className="mt-0.5 text-[10px] text-slate-400">{coverage}% cobertura</p>
        )}
      </div>
    </div>
  )
}

function StatusDataSection({ report }: { report: NormalizedReport }) {
  const [open, setOpen] = useState(false)
  const { inputStatus } = report
  const color =
    inputStatus.status === 'complete' ? 'border-emerald-200 bg-emerald-50' :
    inputStatus.status === 'partial'  ? 'border-amber-200 bg-amber-50' :
    'border-red-200 bg-red-50'
  const Icon =
    inputStatus.status === 'complete' ? CheckCircle2 :
    inputStatus.status === 'partial'  ? CircleAlert :
    AlertTriangle

  return (
    <section className={`surface-card border ${color} p-5`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <Icon size={18} className={inputStatus.status === 'complete' ? 'text-emerald-600' : inputStatus.status === 'partial' ? 'text-amber-600' : 'text-red-600'} />
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Status dos dados recebidos —{' '}
              {inputStatus.status === 'complete' ? 'Completo' : inputStatus.status === 'partial' ? 'Parcial' : 'Inválido'}
            </p>
            {inputStatus.missing.length > 0 && (
              <p className="text-xs text-slate-500">{inputStatus.missing.length} campo{inputStatus.missing.length !== 1 ? 's' : ''} ausente{inputStatus.missing.length !== 1 ? 's' : ''}</p>
            )}
          </div>
        </div>
        {open ? <ChevronUp size={16} className="shrink-0 text-slate-400" /> : <ChevronDown size={16} className="shrink-0 text-slate-400" />}
      </button>

      {open && (
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {inputStatus.received.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-700">Recebido</p>
              <ul className="space-y-1">
                {inputStatus.received.map((item) => (
                  <li key={item} className="flex items-center gap-1.5 text-xs text-emerald-900">
                    <CheckCircle2 size={12} /> {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {inputStatus.missing.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-amber-700">Ausente</p>
              <ul className="space-y-1">
                {inputStatus.missing.map((item) => (
                  <li key={item} className="flex items-center gap-1.5 text-xs text-amber-900">
                    <AlertTriangle size={12} /> {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {inputStatus.warnings.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Avisos</p>
              <ul className="space-y-1">
                {inputStatus.warnings.map((w, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
                    <Info size={12} className="mt-0.5 shrink-0" /> {w}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function SemanticMapStatus({ report }: { report: NormalizedReport }) {
  const { semanticMap } = report
  if (semanticMap.status === 'complete') return null

  return (
    <section className="surface-card border border-amber-200 bg-amber-50 p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
        <div>
          <p className="text-sm font-semibold text-amber-900">
            {semanticMap.status === 'missing'
              ? 'Mapa semântico não recebido ou não gerado.'
              : semanticMap.status === 'partial'
              ? 'Mapa semântico parcial. Alguns dados não puderam ser identificados.'
              : 'Geração do mapa semântico falhou.'}
          </p>
          {semanticMap.warnings.length > 0 && (
            <ul className="mt-2 space-y-1">
              {semanticMap.warnings.map((w, i) => (
                <li key={i} className="text-xs text-amber-800">{w.message}</li>
              ))}
            </ul>
          )}
          {semanticMap.missingData.length > 0 && (
            <ul className="mt-2 space-y-1">
              {semanticMap.missingData.map((m) => (
                <li key={m.field} className="text-xs text-amber-800">
                  <strong>{m.field}:</strong> {m.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}

function AnalysisSummary({ report }: { report: NormalizedReport }) {
  const [open, setOpen] = useState(false)
  const { stats, score, scanner, project, semanticMap } = report
  const legacyWcag = (report.legacyReport as any)?.wcag

  const rows: { label: string; value: string | number }[] = [
    { label: 'Projeto', value: project.name ?? '—' },
    { label: 'Framework', value: project.framework ?? '—' },
    { label: 'Linguagem', value: project.language ?? '—' },
    { label: 'Problemas únicos', value: stats.uniqueFindings },
    { label: 'Total de ocorrências', value: stats.totalOccurrences },
    { label: 'Verificações reprovadas', value: stats.checks.failed },
    { label: 'Verificações aprovadas', value: stats.checks.passed === 0 ? 'Não disponível' : stats.checks.passed },
    { label: 'Telas mapeadas', value: semanticMap.stats.screensMapped === 0 ? '—' : semanticMap.stats.screensMapped },
    { label: 'Rotas detectadas', value: semanticMap.stats.routesDetected === 0 ? '—' : semanticMap.stats.routesDetected },
    { label: 'Mapa semântico', value: semanticMap.status === 'complete' ? 'Completo' : semanticMap.status === 'partial' ? 'Parcial' : 'Não disponível' },
    { label: 'Cobertura da análise', value: score.coverage != null ? `${score.coverage}%` : 'Não disponível' },
    { label: 'Score', value: score.value != null ? `${score.value}/100 (${score.status === 'estimated' ? 'estimado' : 'calculado'})` : 'Indisponível' },
    { label: 'Auditado em', value: legacyWcag?.auditedAt ? new Date(legacyWcag.auditedAt).toLocaleString('pt-BR') : '—' },
    { label: 'Nível WCAG', value: legacyWcag?.level ?? '—' },
    { label: 'Versão das regras', value: legacyWcag?.rulesVersion ?? '—' },
  ]

  return (
    <section className="surface-card p-6 sm:p-8">
      <div className="mb-5">
        <p className="eyebrow">Visão geral</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-950">Resumo da análise</h2>
      </div>

      <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        {rows.slice(0, open ? rows.length : 9).map(({ label, value }) => (
          <div key={label} className="flex items-baseline justify-between gap-2 border-b border-slate-100 py-2">
            <dt className="text-xs text-slate-500">{label}</dt>
            <dd className="text-right text-xs font-semibold text-slate-800">{value}</dd>
          </div>
        ))}
      </dl>

      <button
        onClick={() => setOpen((v) => !v)}
        className="mt-4 flex items-center gap-1 text-xs font-semibold text-violet-600 hover:underline"
      >
        {open ? <><ChevronUp size={13} /> Recolher</> : <><ChevronDown size={13} /> Ver mais detalhes</>}
      </button>

      {open && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Observações técnicas</p>
          <ul className="space-y-1.5 text-xs leading-5 text-slate-600">
            <li>• A análise foi realizada estaticamente a partir do código-fonte.</li>
            <li>• Alguns nomes acessíveis dependem do DOM renderizado e podem precisar de revisão manual.</li>
            <li>• Problemas presentes em múltiplas rotas com o mesmo componente foram consolidados em um único problema único.</li>
            {stats.checks.passed === 0 && (
              <li>• O scanner não informou verificações aprovadas. O score apresentado é uma estimativa.</li>
            )}
            {report.semanticMap.status !== 'complete' && (
              <li>• O mapa semântico não foi recebido. Algumas informações de rotas e telas podem estar incompletas.</li>
            )}
          </ul>
        </div>
      )}
    </section>
  )
}

// ─── Main component ──────────────────────────────────────────

interface AuditDashboardProps {
  report: NormalizedReport
  projectId?: string
}

export function AuditDashboard({ report, projectId }: AuditDashboardProps) {
  const navigate = useNavigate()
  const { score, stats } = report

  const handleRuleClick = (ruleId: string) => {
    if (projectId) {
      navigate(`/dashboard/${projectId}/rule/${ruleId}`)
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. Status dos dados recebidos */}
      <StatusDataSection report={report} />

      {/* 2. Score + severity cards */}
      <div className="grid gap-6 xl:grid-cols-[1.15fr_1.85fr]">
        <section className="surface-card p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Saúde de acessibilidade</p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">Score WCAG</h2>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="rounded-full bg-slate-100 p-1.5 text-slate-500 hover:bg-slate-200">
                  <Info size={14} />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">{score.explanation}</p>
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="mt-6 flex items-center gap-6">
            <ScoreGauge score={score.value} coverage={score.coverage} />
            <div className="min-w-0 space-y-2.5">
              <div>
                <span className="text-xs text-slate-400">Status do score</span>
                <p className={`mt-0.5 rounded-full px-2.5 py-1 text-xs font-semibold inline-block ${
                  score.status === 'available' ? 'bg-emerald-50 text-emerald-700' :
                  score.status === 'estimated' ? 'bg-amber-50 text-amber-700' :
                  'bg-slate-100 text-slate-500'
                }`}>
                  {score.status === 'available' ? 'Calculado' : score.status === 'estimated' ? 'Estimado' : 'Indisponível'}
                </p>
              </div>
              {score.coverage != null && (
                <div>
                  <span className="text-xs text-slate-400">Cobertura</span>
                  <p className="text-sm font-semibold text-slate-800">{score.coverage}%</p>
                </div>
              )}
              <div>
                <span className="text-xs text-slate-400">Problemas únicos</span>
                <p className="text-sm font-semibold text-slate-800">{stats.uniqueFindings}</p>
              </div>
              <div>
                <span className="text-xs text-slate-400">Total de ocorrências</span>
                <p className="text-sm font-semibold text-slate-800">{stats.totalOccurrences}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="surface-card p-6 sm:p-8">
          <p className="eyebrow">Diagnóstico</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">
            {stats.uniqueFindings} problema{stats.uniqueFindings !== 1 ? 's' : ''} único{stats.uniqueFindings !== 1 ? 's' : ''}
            {stats.totalOccurrences > stats.uniqueFindings && (
              <span className="ml-2 text-sm font-normal text-slate-400">({stats.totalOccurrences} ocorrências)</span>
            )}
          </h2>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-5">
            {SEVERITY_ORDER.map((sev) => {
              const count = stats.bySeverity[sev]?.uniqueFindings ?? 0
              if (count === 0 && sev === 'unknown') return null
              const meta = SEVERITY_META[sev]
              return (
                <div key={sev} className={`rounded-2xl border p-4 ${meta.color}`}>
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                    {meta.label}
                  </div>
                  <strong className="mt-3 block text-3xl font-semibold">{count}</strong>
                  {stats.bySeverity[sev]?.occurrences > count && (
                    <p className="mt-0.5 text-[10px] opacity-70">{stats.bySeverity[sev].occurrences} ocorr.</p>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      </div>

      {/* 3. Semantic map warning */}
      <SemanticMapStatus report={report} />

      {/* 4. Resumo da análise (substitui Briefing) */}
      <AnalysisSummary report={report} />

      {/* 5. Findings table with pagination */}
      <FindingsTable
        findings={report.findings}
        useUrlSync
        onRuleClick={projectId ? handleRuleClick : undefined}
      />

      {/* Score disclaimer when estimated */}
      {score.status === 'estimated' && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-800">
          <strong>Score estimado:</strong> {score.explanation}
        </p>
      )}
      {score.status === 'unavailable' && (
        <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-600">
          <strong>Score indisponível:</strong> {score.explanation}
        </p>
      )}
    </div>
  )
}
