import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Code2, Network, Puzzle, RefreshCw, ShieldCheck } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { getProject, Project } from '@/services/projects'
import { getScans, Scan } from '@/services/scans'
import { getEntities } from '@/services/entities'
import { getRelationships } from '@/services/relationships'
import { SemanticGraph } from '@/components/SemanticGraph'
import { IntegrationPanel } from '@/components/integration-panel'
import { WidgetConfig } from '@/components/widget-config'
import { ScanHistory } from '@/components/scan-history'
import { AuditDashboard } from '@/components/AuditDashboard'
import { GuidedFlows } from '@/components/GuidedFlows'
import { useRealtime } from '@/hooks/use-realtime'
import { toast } from '@/hooks/use-toast'
import { normalizeLegacyScanResult } from '@/domain/normalize'

export default function ProjectDetail() {
  const { projectId } = useParams()
  const [project, setProject] = useState<Project | null>(null)
  const [scans, setScans] = useState<Scan[]>([])
  const [selectedScanId, setSelectedScanId] = useState<string>('')
  const [entities, setEntities] = useState<any[]>([])
  const [relationships, setRelationships] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const loadData = useCallback(async () => {
    if (!projectId) return
    setLoadError(false)
    try {
      const [currentProject, currentScans] = await Promise.all([getProject(projectId), getScans(projectId)])
      setProject(currentProject)
      setScans(currentScans)
      setSelectedScanId((current) => currentScans.some((scan) => scan.id === current) ? current : currentScans[0]?.id || '')
    } catch {
      setLoadError(true)
      toast({ title: 'Não foi possível carregar o projeto', variant: 'destructive' })
    } finally { setLoading(false) }
  }, [projectId])

  useEffect(() => { loadData() }, [loadData])
  useRealtime('scans', (event) => { if (event.record.project === projectId) loadData() })

  const selectedScan = scans.find((scan) => scan.id === selectedScanId) || scans[0]
  const latestScan = scans[0]
  const isPolling = latestScan?.status === 'PROCESSING' || latestScan?.status === 'ENRICHING'

  // Normalize the selected scan report for the new AuditDashboard
  const normalizedScan = useMemo(() => {
    if (!selectedScan?.report) return null
    return normalizeLegacyScanResult(selectedScan.report, {
      scanId: selectedScan.id,
      projectName: project?.name,
      framework: project?.framework,
      language: project?.language,
    })
  }, [selectedScan, project])

  useEffect(() => {
    if (!isPolling) return
    const timer = window.setInterval(loadData, 5000)
    return () => window.clearInterval(timer)
  }, [isPolling, loadData])

  useEffect(() => {
    if (!selectedScanId) { setEntities([]); setRelationships([]); return }
    Promise.all([getEntities(selectedScanId), getRelationships(selectedScanId)]).then(([nextEntities, nextRelationships]) => { setEntities(nextEntities); setRelationships(nextRelationships) }).catch(() => { setEntities([]); setRelationships([]) })
  }, [selectedScanId])

  if (loading) return <ProjectSkeleton />
  if (!project) return <div className="page-shell py-24 text-center text-slate-500">Projeto não encontrado.</div>

  const report = selectedScan?.report

  return (
    <div className="page-shell pb-16 pt-8">
      <Link to="/dashboard" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"><ArrowLeft size={16} /> Todos os projetos</Link>
      <header className="mb-8 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div><div className="mb-3 flex flex-wrap items-center gap-2"><span className={`status-pill ${isPolling ? 'border-amber-200 bg-amber-50 text-amber-700' : 'status-success'}`}><span className={`h-1.5 w-1.5 rounded-full ${isPolling ? 'animate-pulse bg-amber-500' : 'bg-emerald-500'}`} /> {isPolling ? 'Scan em processamento' : 'Monitoramento ativo'}</span>{report?.wcag && <span className="status-pill">WCAG {report.wcag.level}</span>}</div><h1 className="text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl">{project.name}</h1><p className="mt-2 text-sm text-slate-500">{project.baseUrl || 'URL do projeto não informada'}</p></div>
        <Button variant="outline" onClick={loadData} className="h-11 gap-2 rounded-xl border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"><RefreshCw size={16} className={isPolling ? 'animate-spin' : ''} /> Atualizar</Button>
      </header>
      {loadError && <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">Não foi possível atualizar todos os dados. Tente novamente.</div>}

      <Tabs defaultValue="accessibility" className="space-y-6">
        <div className="overflow-x-auto pb-1"><TabsList className="inline-flex h-auto min-w-max gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm"><NavTab value="accessibility" icon={<ShieldCheck size={16} />}>Acessibilidade</NavTab><NavTab value="graph" icon={<Network size={16} />}>Mapa semântico</NavTab><NavTab value="integration" icon={<Code2 size={16} />}>Integração</NavTab><NavTab value="widget" icon={<Puzzle size={16} />}>Widget</NavTab></TabsList></div>

        <TabsContent value="accessibility" className="m-0 space-y-6">
          <div className="surface-card flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center sm:px-5"><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Scan selecionado</p><p className="mt-1 text-sm font-medium text-slate-700">As seções abaixo refletem este relatório.</p></div>{scans.length ? <Select value={selectedScan?.id} onValueChange={setSelectedScanId}><SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white sm:w-[300px]"><SelectValue /></SelectTrigger><SelectContent>{scans.map((scan, index) => <SelectItem key={scan.id} value={scan.id}>{index === 0 ? 'Mais recente · ' : ''}{new Date(scan.created).toLocaleString('pt-BR')}</SelectItem>)}</SelectContent></Select> : <span className="text-sm text-slate-400">Nenhum scan disponível</span>}</div>
          {normalizedScan ? (
            <AuditDashboard report={normalizedScan} projectId={projectId} />
          ) : (
            <div className="surface-card flex min-h-[360px] flex-col items-center justify-center p-10 text-center">
              <ShieldCheck size={32} className="mb-4 text-violet-400" />
              <h3 className="text-xl font-semibold text-slate-950">Aguardando auditoria</h3>
              <p className="mt-2 max-w-md text-sm text-slate-500">Execute o scanner para ver o dashboard de acessibilidade.</p>
            </div>
          )}
          <GuidedFlows flows={report?.guidedFlows || []} />
          <ScanHistory scans={scans} project={project} loading={false} onRefresh={loadData} selectedScanId={selectedScan?.id} onSelectScan={setSelectedScanId} />
        </TabsContent>

        <TabsContent value="graph" className="m-0"><section className="surface-card h-[680px] overflow-hidden p-2">{entities.length ? <SemanticGraph entities={entities} relationships={relationships} /> : <EmptyState icon={<Network size={28} />} title="Mapa ainda não disponível" text="Execute o scanner para visualizar telas, ações e caminhos de navegação." />}</section></TabsContent>
        <TabsContent value="integration" className="m-0"><IntegrationPanel project={project} /></TabsContent>
        <TabsContent value="widget" className="m-0"><WidgetConfig project={project} onUpdate={loadData} /></TabsContent>
      </Tabs>
    </div>
  )
}

// Briefing removed — replaced by AnalysisSummary inside AuditDashboard
function NavTab({ value, icon, children }: { value: string; icon: React.ReactNode; children: React.ReactNode }) { return <TabsTrigger value={value} className="gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 transition data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-sm">{icon}{children}</TabsTrigger> }
function EmptyState({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="grid h-full place-items-center"><div className="max-w-md text-center"><div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-violet-50 text-violet-600">{icon}</div><h3 className="text-xl font-semibold text-slate-900">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{text}</p></div></div> }
function ProjectSkeleton() { return <div className="page-shell space-y-7 py-10 animate-pulse"><div className="h-4 w-32 rounded bg-slate-200" /><div className="h-20 w-2/3 rounded-2xl bg-slate-200" /><div className="h-14 w-full rounded-2xl bg-slate-200" /><div className="h-[520px] rounded-3xl bg-slate-200" /></div> }
