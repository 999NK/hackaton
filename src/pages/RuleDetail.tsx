// ============================================================
// src/pages/RuleDetail.tsx
// Página de detalhes de uma regra específica.
// Rota: /dashboard/:projectId/rule/:ruleId
// ============================================================

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Copy, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FindingsTable } from '@/components/FindingsTable'
import { getScans } from '@/services/scans'
import { getProject, Project } from '@/services/projects'
import { normalizeLegacyScanResult } from '@/domain/normalize'
import { getRuleDefinition, getGenericSuggestion } from '@/domain/rule-catalog'
import type { NormalizedReport, AccessibilityFinding, Severity } from '@/domain/types'
import { toast } from '@/hooks/use-toast'

const SEVERITY_META: Record<Severity, { label: string; badge: string }> = {
  critical: { label: 'Crítica',    badge: 'border-red-200 bg-red-50 text-red-700' },
  serious:  { label: 'Séria',      badge: 'border-orange-200 bg-orange-50 text-orange-700' },
  moderate: { label: 'Moderada',   badge: 'border-amber-200 bg-amber-50 text-amber-700' },
  minor:    { label: 'Menor',      badge: 'border-sky-200 bg-sky-50 text-sky-700' },
  unknown:  { label: 'Desconhec.', badge: 'border-slate-200 bg-slate-100 text-slate-600' },
}

export default function RuleDetail() {
  const { projectId, ruleId } = useParams<{ projectId: string; ruleId: string }>()
  const [normalized, setNormalized] = useState<NormalizedReport | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!projectId) return
    try {
      const [proj, scans] = await Promise.all([getProject(projectId), getScans(projectId)])
      setProject(proj)
      const latestScan = scans[0]
      if (latestScan) {
        const norm = normalizeLegacyScanResult(latestScan.report ?? {}, {
          scanId: latestScan.id,
          projectName: proj.name,
          framework: proj.framework,
          language: proj.language,
        })
        setNormalized(norm)
      }
    } catch {
      toast({ title: 'Erro ao carregar os dados', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { load() }, [load])

  const ruleFindings: AccessibilityFinding[] = useMemo(
    () => (normalized?.findings ?? []).filter((f) => f.ruleId === ruleId),
    [normalized, ruleId],
  )

  const def = ruleId ? (getRuleDefinition(ruleId) ?? getGenericSuggestion(ruleId, 'unknown')) : null

  const affectedScreens = useMemo(
    () => [...new Set(ruleFindings.flatMap((f) => f.affectedScreens.map((s) => s.route)))],
    [ruleFindings],
  )
  const affectedFiles = useMemo(
    () => [...new Set(ruleFindings.map((f) => f.source.filePath).filter(Boolean))],
    [ruleFindings],
  )
  const totalOccurrences = useMemo(
    () => ruleFindings.reduce((s, f) => s + f.occurrenceCount, 0),
    [ruleFindings],
  )

  // Dominant severity: the most severe in this rule's findings
  const dominantSeverity: Severity = ruleFindings.length > 0 ? ruleFindings[0].severity : 'unknown'
  const meta = SEVERITY_META[dominantSeverity]

  const buildGroupPrompt = () => {
    if (!def) return ''
    const fileList = affectedFiles.map((f) => `- ${f}`).join('\n') || '- (arquivo não informado)'
    return def.promptTemplate
      .replace('{{FILES}}', fileList)
      .replace('{{SEVERITY}}', dominantSeverity)
      .replace('{{SCREENS}}', String(affectedScreens.length))
  }

  const copyGroupPrompt = async () => {
    const prompt = buildGroupPrompt()
    if (!prompt) return
    await navigator.clipboard.writeText(prompt)
    toast({ title: 'Prompt copiado!', description: `Regra: ${ruleId}` })
  }

  if (loading) {
    return (
      <div className="page-shell animate-pulse space-y-6 py-10">
        <div className="h-4 w-32 rounded bg-slate-200" />
        <div className="h-24 rounded-2xl bg-slate-200" />
        <div className="h-[400px] rounded-3xl bg-slate-200" />
      </div>
    )
  }

  if (!normalized || !def) {
    return (
      <div className="page-shell py-24 text-center text-slate-500">
        Regra não encontrada ou sem dados disponíveis.
      </div>
    )
  }

  return (
    <div className="page-shell pb-16 pt-8">
      <Link
        to={`/dashboard/${projectId}`}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
      >
        <ArrowLeft size={16} />
        Voltar para {project?.name ?? 'o projeto'}
      </Link>

      {/* Header */}
      <header className="mb-8 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={meta.badge}>{meta.label}</Badge>
          <code className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{ruleId}</code>
          {def.wcag.map((w) => (
            <Badge key={w} variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 text-[11px]">
              WCAG {w}
            </Badge>
          ))}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{def.title}</h1>
        <p className="max-w-2xl text-sm leading-6 text-slate-500">{def.description}</p>

        {/* Stats row */}
        <div className="flex flex-wrap gap-6 pt-2 text-sm text-slate-500">
          <div><strong className="text-slate-900">{ruleFindings.length}</strong> problema{ruleFindings.length !== 1 ? 's' : ''} único{ruleFindings.length !== 1 ? 's' : ''}</div>
          <div><strong className="text-slate-900">{totalOccurrences}</strong> ocorrências</div>
          <div><strong className="text-slate-900">{affectedScreens.length}</strong> tela{affectedScreens.length !== 1 ? 's' : ''} afetada{affectedScreens.length !== 1 ? 's' : ''}</div>
          <div><strong className="text-slate-900">{affectedFiles.length}</strong> arquivo{affectedFiles.length !== 1 ? 's' : ''} afetado{affectedFiles.length !== 1 ? 's' : ''}</div>
        </div>
      </header>

      <div className="space-y-6">
        {/* Explanation card */}
        <section className="surface-card p-6 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <p className="eyebrow">Impacto</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">Por que isso importa</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{def.whyItMatters}</p>
            </div>
            <div>
              <p className="eyebrow">Correção</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">Como corrigir</h2>
              <ol className="mt-3 space-y-1.5">
                {def.howToFix.map((step, i) => (
                  <li key={i} className="flex gap-2 text-sm leading-6 text-slate-600">
                    <span className="shrink-0 font-bold text-violet-600">{i + 1}.</span>
                    {step}
                  </li>
                ))}
              </ol>
              {def.documentation?.map((url) => (
                <a key={url} href={url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline">
                  Documentação WCAG <ExternalLink size={11} />
                </a>
              ))}
            </div>
          </div>

          {/* Before/After */}
          {(def.examples?.before || def.examples?.after) && (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {def.examples.before && (
                <div>
                  <p className="mb-2 text-xs font-semibold text-red-600">Antes (incorreto)</p>
                  <pre className="overflow-x-auto rounded-xl bg-red-50 p-4 text-xs text-red-900">{def.examples.before}</pre>
                </div>
              )}
              {def.examples.after && (
                <div>
                  <p className="mb-2 text-xs font-semibold text-emerald-600">Depois (correto)</p>
                  <pre className="overflow-x-auto rounded-xl bg-emerald-50 p-4 text-xs text-emerald-900">{def.examples.after}</pre>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Affected files/screens */}
        {(affectedFiles.length > 0 || affectedScreens.length > 0) && (
          <div className="grid gap-4 sm:grid-cols-2">
            {affectedFiles.length > 0 && (
              <section className="surface-card p-5">
                <p className="eyebrow mb-3">Arquivos afetados</p>
                <ul className="space-y-1.5">
                  {affectedFiles.map((f) => (
                    <li key={f}><code className="rounded bg-slate-100 px-2 py-0.5 text-xs">{f}</code></li>
                  ))}
                </ul>
              </section>
            )}
            {affectedScreens.length > 0 && (
              <section className="surface-card p-5">
                <p className="eyebrow mb-3">Telas afetadas</p>
                <div className="flex flex-wrap gap-1.5">
                  {affectedScreens.map((s) => (
                    <code key={s} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs">{s}</code>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* Copy prompt */}
        <section className="surface-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="eyebrow">Prompt para agente de IA</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">Corrigir todos os problemas desta regra</h2>
              <p className="mt-1 text-sm text-slate-500">O prompt inclui arquivos, telas e instruções para preservar o comportamento.</p>
            </div>
            <Button onClick={copyGroupPrompt} className="gap-2 rounded-xl bg-violet-600 text-white hover:bg-violet-700">
              <Copy size={15} />
              Copiar prompt completo
            </Button>
          </div>
          <pre className="mt-5 max-h-48 overflow-auto rounded-xl border border-slate-800 bg-[#171521] p-4 text-xs leading-5 text-slate-300">
            {buildGroupPrompt()}
          </pre>
        </section>

        {/* Findings table for this rule */}
        {ruleFindings.length > 0 ? (
          <FindingsTable findings={ruleFindings} />
        ) : (
          <div className="surface-card p-10 text-center text-slate-500">
            Nenhum problema encontrado para esta regra no scan mais recente.
          </div>
        )}
      </div>
    </div>
  )
}
