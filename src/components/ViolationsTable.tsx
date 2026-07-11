import { useMemo, useState } from 'react'
import { CheckCircle2, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Severity, WcagViolation } from '@/types'

const severityStyle: Record<Severity, string> = {
  critical: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-50',
  serious: 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-50',
  moderate: 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50',
  minor: 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-100',
}

const VALID_SEVERITIES = new Set<string>(['critical', 'serious', 'moderate', 'minor'])

export function ViolationsTable({ violations = [] }: { violations?: WcagViolation[] }) {
  const [filter, setFilter] = useState<Severity | 'all'>('all')

  // Sanitize violations — guard against incomplete/undefined fields from the API
  const safeViolations = violations.map((item) => ({
    ...item,
    rule: item.rule ?? '',
    severity: VALID_SEVERITIES.has(item.severity) ? item.severity : ('minor' as Severity),
  }))

  const filtered = useMemo(
    () => (filter === 'all' ? safeViolations : safeViolations.filter((item) => item.severity === filter)),
    [filter, safeViolations],
  )

  return (
    <section className="surface-card overflow-hidden">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-6 sm:flex-row sm:items-end sm:p-8">
        <div>
          <p className="eyebrow">Auditoria WCAG</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">Violações encontradas</h2>
          <p className="mt-2 text-xs text-slate-400">
            Mostrando {filtered.length} de {safeViolations.length} violações
          </p>
        </div>
        <Select value={filter} onValueChange={(value) => setFilter(value as Severity | 'all')}>
          <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white text-slate-700 sm:w-[190px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="serious">Serious</SelectItem>
            <SelectItem value="moderate">Moderate</SelectItem>
            <SelectItem value="minor">Minor</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!safeViolations.length ? (
        <div className="grid min-h-52 place-items-center p-8 text-center">
          <div>
            <CheckCircle2 size={34} className="mx-auto text-emerald-500" />
            <h3 className="mt-3 font-semibold text-slate-900">Nenhuma violação encontrada</h3>
            <p className="mt-1 text-sm text-slate-500">Acessibilidade conforme as regras auditadas. 🎉</p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="pl-6">Severidade</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Tela</TableHead>
                <TableHead>Regra WCAG</TableHead>
                <TableHead className="min-w-64">Correção sugerida</TableHead>
                <TableHead className="pr-6 text-right">Referência</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item, index) => {
                // Guard: item.rule may be undefined if API returns incomplete data
                const ruleParts = String(item.rule || '').split(' ')
                const ruleCode = ruleParts[0] || '—'
                const ruleName = ruleParts.slice(1)

                return (
                  <TableRow key={`${item.id ?? index}-${index}`} className="align-top">
                    <TableCell className="pl-6">
                      <Badge variant="outline" className={severityStyle[item.severity]}>
                        {item.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-52 font-medium text-slate-800">{item.title}</TableCell>
                    <TableCell>
                      <code className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">{item.screen}</code>
                    </TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help font-semibold text-blue-600 underline decoration-dotted underline-offset-4">
                            {ruleCode}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>{ruleName.join(' ') || item.rule || '—'}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className="line-clamp-2 max-w-md cursor-help text-xs leading-5 text-slate-500">
                            {item.fix}
                          </p>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-md">
                          <p>{item.fix}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      {item.wcagUrl ? (
                        <a
                          href={item.wcagUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
                        >
                          WCAG <ExternalLink size={12} />
                        </a>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  )
}
