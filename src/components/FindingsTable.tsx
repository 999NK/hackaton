// ============================================================
// src/components/FindingsTable.tsx
// Tabela paginada de findings com filtros e URL sync.
// Substitui ViolationsTable sem regressão visual.
// ============================================================

import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  HelpCircle,
  Search,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from '@/hooks/use-toast'
import type { AccessibilityFinding, Severity } from '@/domain/types'
import { SEVERITY_ORDER } from '@/domain/types'

// ─── Constants ───────────────────────────────────────────────

const PAGE_SIZES = [10, 25, 50, 100] as const
const DEFAULT_PAGE_SIZE = 25

const SEVERITY_META: Record<
  Severity,
  { label: string; badge: string; dot: string; tooltip: string }
> = {
  critical: {
    label: 'Crítica',
    badge: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-50',
    dot: 'bg-red-500',
    tooltip: 'Bloqueia acesso para usuários com deficiência. Correção imediata.',
  },
  serious: {
    label: 'Séria',
    badge: 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-50',
    dot: 'bg-orange-500',
    tooltip: 'Impacto grave. Correção de alta prioridade.',
  },
  moderate: {
    label: 'Moderada',
    badge: 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50',
    dot: 'bg-amber-500',
    tooltip: 'Impacto médio. Planejar correção.',
  },
  minor: {
    label: 'Menor',
    badge: 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-50',
    dot: 'bg-sky-400',
    tooltip: 'Impacto reduzido. Corrigir quando possível.',
  },
  unknown: {
    label: 'Desconhecida',
    badge: 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-100',
    dot: 'bg-slate-400',
    tooltip: 'Severidade não informada pelo scanner.',
  },
}

// ─── Props ───────────────────────────────────────────────────

interface FindingsTableProps {
  findings: AccessibilityFinding[]
  /** When provided, filters and page are synced to the URL */
  useUrlSync?: boolean
  /** Called when "Ver regra" is clicked */
  onRuleClick?: (ruleId: string) => void
}

// ─── Filters hook ─────────────────────────────────────────────

function useFilters(useUrlSync: boolean) {
  const [params, setParams] = useSearchParams()
  const [localSeverity, setLocalSeverity] = useState<Severity | 'all'>('all')
  const [localSearch, setLocalSearch] = useState('')
  const [localPage, setLocalPage] = useState(1)
  const [localPageSize, setLocalPageSize] = useState<number>(DEFAULT_PAGE_SIZE)

  const severity: Severity | 'all' = useUrlSync
    ? ((params.get('severity') as Severity | 'all') ?? 'all')
    : localSeverity

  const search = useUrlSync ? (params.get('q') ?? '') : localSearch
  const page = useUrlSync ? Number(params.get('page') ?? 1) : localPage
  const pageSize = useUrlSync ? Number(params.get('pageSize') ?? DEFAULT_PAGE_SIZE) : localPageSize

  const setSeverity = useCallback(
    (v: Severity | 'all') => {
      if (useUrlSync) {
        setParams((p) => { const n = new URLSearchParams(p); n.set('severity', v); n.set('page', '1'); return n })
      } else {
        setLocalSeverity(v); setLocalPage(1)
      }
    },
    [useUrlSync, setParams],
  )

  const setSearch = useCallback(
    (v: string) => {
      if (useUrlSync) {
        setParams((p) => { const n = new URLSearchParams(p); n.set('q', v); n.set('page', '1'); return n })
      } else {
        setLocalSearch(v); setLocalPage(1)
      }
    },
    [useUrlSync, setParams],
  )

  const setPage = useCallback(
    (v: number) => {
      if (useUrlSync) {
        setParams((p) => { const n = new URLSearchParams(p); n.set('page', String(v)); return n })
      } else {
        setLocalPage(v)
      }
    },
    [useUrlSync, setParams],
  )

  const setPageSize = useCallback(
    (v: number) => {
      if (useUrlSync) {
        setParams((p) => { const n = new URLSearchParams(p); n.set('pageSize', String(v)); n.set('page', '1'); return n })
      } else {
        setLocalPageSize(v); setLocalPage(1)
      }
    },
    [useUrlSync, setParams],
  )

  return { severity, search, page, pageSize, setSeverity, setSearch, setPage, setPageSize }
}

// ─── Component ───────────────────────────────────────────────

export function FindingsTable({ findings, useUrlSync = false, onRuleClick }: FindingsTableProps) {
  const { severity, search, page, pageSize, setSeverity, setSearch, setPage, setPageSize } = useFilters(useUrlSync)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Filter
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return findings.filter((f) => {
      if (severity !== 'all' && f.severity !== severity) return false
      if (!q) return true
      return (
        f.ruleId.toLowerCase().includes(q) ||
        f.title.toLowerCase().includes(q) ||
        (f.description ?? '').toLowerCase().includes(q) ||
        (f.selector ?? '').toLowerCase().includes(q) ||
        f.source.filePath.toLowerCase().includes(q) ||
        f.wcag.some((w) => w.toLowerCase().includes(q)) ||
        f.affectedScreens.some((s) => s.route.toLowerCase().includes(q))
      )
    })
  }, [findings, severity, search])

  // Sort by severity order (already pre-sorted from normalizer, but keep for safety)
  const sorted = useMemo(
    () => [...filtered].sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)),
    [filtered],
  )

  // Paginate (client-side; no DOM of hidden rows)
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return sorted.slice(start, start + pageSize)
  }, [sorted, safePage, pageSize])

  const totalOccurrences = useMemo(() => findings.reduce((s, f) => s + f.occurrenceCount, 0), [findings])

  const copyPrompt = async (f: AccessibilityFinding) => {
    await navigator.clipboard.writeText(f.suggestion.generatedPrompt)
    toast({ title: 'Prompt copiado!', description: `Regra: ${f.ruleId}` })
  }

  return (
    <section className="surface-card overflow-hidden">
      {/* Header */}
      <div className="border-b border-slate-100 p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Plano de correção</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">
              {findings.length === 0
                ? 'Nenhuma violação encontrada'
                : `${findings.length} problema${findings.length !== 1 ? 's' : ''} único${findings.length !== 1 ? 's' : ''}`}
            </h2>
            {totalOccurrences > findings.length && (
              <p className="mt-1 text-xs text-slate-400">
                {totalOccurrences} ocorrências no total (mesmos problemas em telas diferentes foram consolidados)
              </p>
            )}
          </div>
          {/* Severity summary badges */}
          <div className="flex flex-wrap gap-2">
            {SEVERITY_ORDER.filter((s) => s !== 'unknown').map((sev) => {
              const count = findings.filter((f) => f.severity === sev).length
              if (!count) return null
              const meta = SEVERITY_META[sev]
              return (
                <button
                  key={sev}
                  onClick={() => setSeverity(severity === sev ? 'all' : sev)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${meta.badge} ${severity === sev ? 'ring-2 ring-offset-1' : ''}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                  {meta.label}: {count}
                </button>
              )
            })}
          </div>
        </div>

        {/* Filters row */}
        <div className="mt-5 flex flex-wrap gap-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por regra, arquivo, seletor, WCAG..."
              className="h-9 rounded-xl border-slate-200 pl-9 text-sm"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            )}
          </div>
          <Select value={severity} onValueChange={(v) => setSeverity(v as Severity | 'all')}>
            <SelectTrigger className="h-9 w-[165px] rounded-xl border-slate-200 text-sm">
              <SelectValue placeholder="Severidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as severidades</SelectItem>
              {SEVERITY_ORDER.map((sev) => (
                <SelectItem key={sev} value={sev}>{SEVERITY_META[sev].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results info */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between border-b border-slate-50 bg-slate-50/50 px-6 py-2 text-xs text-slate-500">
          <span>
            {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)} de {filtered.length} problema{filtered.length !== 1 ? 's' : ''}
            {search || severity !== 'all' ? ` (filtrado de ${findings.length})` : ''}
          </span>
          <div className="flex items-center gap-2">
            <span>Por página:</span>
            <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
              <SelectTrigger className="h-7 w-[70px] rounded-lg border-slate-200 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Findings list — only pageItems are rendered, never the full array */}
      <div className="divide-y divide-slate-100">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center p-10 text-center text-sm text-slate-500">
            <CheckCircle2 className="mb-3 text-emerald-500" size={28} />
            {search || severity !== 'all'
              ? 'Nenhum problema corresponde aos filtros.'
              : 'Nenhuma violação encontrada.'}
          </div>
        ) : (
          pageItems.map((finding) => {
            const meta = SEVERITY_META[finding.severity]
            const isExpanded = expandedId === finding.id
            return (
              <article key={finding.id}>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : finding.id)}
                  className="flex w-full items-start gap-4 p-5 text-left transition hover:bg-slate-50/80 sm:p-6"
                  aria-expanded={isExpanded}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${meta.dot}`} />
                    </TooltipTrigger>
                    <TooltipContent><p>{meta.tooltip}</p></TooltipContent>
                  </Tooltip>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-900">{finding.title}</h3>
                      <Badge variant="outline" className={`text-[11px] ${meta.badge}`}>
                        {meta.label}
                      </Badge>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                        {finding.ruleId}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm text-slate-500">
                      {finding.source.filePath || 'Arquivo não informado'}
                      {finding.affectedScreens.length > 0 && (
                        <> · <span className="text-slate-400">{finding.affectedScreens.length} tela{finding.affectedScreens.length !== 1 ? 's' : ''} afetada{finding.affectedScreens.length !== 1 ? 's' : ''}</span></>
                      )}
                      {finding.occurrenceCount > 1 && (
                        <> · <span className="text-slate-400">{finding.occurrenceCount} ocorrências</span></>
                      )}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {onRuleClick && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onRuleClick(finding.ruleId) }}
                        className="hidden rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 sm:block"
                      >
                        Ver regra
                      </button>
                    )}
                    <Badge variant="outline" className={`shrink-0 text-xs ${finding.confidence === 'confirmed' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : finding.confidence === 'needs-review' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                      {finding.confidence === 'confirmed' ? 'confirmado' : finding.confidence === 'needs-review' ? 'revisar' : 'provável'}
                    </Badge>
                    <ChevronDown size={18} className={`text-slate-400 transition ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {isExpanded && (
                  <div className="bg-slate-50/60 px-6 pb-6 pt-2 sm:pl-12">
                    {/* Description */}
                    {finding.description && (
                      <p className="text-sm leading-6 text-slate-600">{finding.description}</p>
                    )}

                    {/* Why it matters */}
                    <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/70 p-4">
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-blue-700">Por que é um problema</p>
                      <p className="text-sm leading-6 text-blue-900">{finding.suggestion.whyItMatters}</p>
                    </div>

                    {/* How to fix */}
                    <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-700">Como corrigir</p>
                      <ol className="space-y-1">
                        {finding.suggestion.howToFix.map((step, i) => (
                          <li key={i} className="flex gap-2 text-sm leading-6 text-emerald-900">
                            <span className="shrink-0 font-bold">{i + 1}.</span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    {/* Before/After */}
                    {(finding.suggestion.before || finding.suggestion.after) && (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {finding.suggestion.before && (
                          <div>
                            <p className="mb-1 text-xs font-semibold text-red-600">Antes (incorreto)</p>
                            <pre className="overflow-x-auto rounded-lg bg-red-50 p-3 text-xs text-red-800">{finding.suggestion.before}</pre>
                          </div>
                        )}
                        {finding.suggestion.after && (
                          <div>
                            <p className="mb-1 text-xs font-semibold text-emerald-600">Depois (correto)</p>
                            <pre className="overflow-x-auto rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">{finding.suggestion.after}</pre>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                      {finding.selector && <span>Seletor: <code className="rounded bg-slate-200 px-1">{finding.selector}</code></span>}
                      {finding.source.filePath && <span>Arquivo: <code className="rounded bg-slate-200 px-1">{finding.source.filePath}</code></span>}
                      {finding.source.line && <span>Linha {finding.source.line}</span>}
                      <Badge variant="outline" className="flex items-center gap-1 text-[10px]">
                        <HelpCircle size={10} />
                        {finding.analysisSource === 'static' ? 'análise estática' : finding.analysisSource}
                      </Badge>
                    </div>

                    {/* Affected screens */}
                    {finding.affectedScreens.length > 0 && (
                      <div className="mt-3">
                        <p className="mb-1.5 text-xs font-semibold text-slate-500">Telas afetadas ({finding.affectedScreens.length})</p>
                        <div className="flex flex-wrap gap-1.5">
                          {finding.affectedScreens.map((s) => (
                            <code key={s.route} className="rounded-md bg-slate-200 px-2 py-0.5 text-xs text-slate-700">{s.route}</code>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* WCAG links */}
                    {finding.wcag.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {finding.wcag.map((w) => (
                          <a key={w} href={w.startsWith('http') ? w : `https://www.w3.org/TR/WCAG21/#${w.toLowerCase()}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline">
                            WCAG {w} <ExternalLink size={11} />
                          </a>
                        ))}
                      </div>
                    )}

                    {/* Copy prompt */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-4 h-8 gap-1.5 rounded-lg border-slate-200 text-xs"
                      onClick={() => copyPrompt(finding)}
                    >
                      <Copy size={13} />
                      Copiar prompt de correção
                    </Button>
                  </div>
                )}
              </article>
            )
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
          <p className="text-xs text-slate-500">
            Página {safePage} de {totalPages}
          </p>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" className="h-8 w-8 p-0" disabled={safePage === 1} onClick={() => setPage(1)}>
              <ChevronFirst size={14} />
            </Button>
            <Button size="sm" variant="outline" className="h-8 w-8 p-0" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>
              <ChevronLeft size={14} />
            </Button>
            <Button size="sm" variant="outline" className="h-8 w-8 p-0" disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)}>
              <ChevronRight size={14} />
            </Button>
            <Button size="sm" variant="outline" className="h-8 w-8 p-0" disabled={safePage === totalPages} onClick={() => setPage(totalPages)}>
              <ChevronLast size={14} />
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
