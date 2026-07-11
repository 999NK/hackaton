import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getProject, Project } from '@/services/projects'
import { getScans } from '@/services/scans'
import { getEntities } from '@/services/entities'
import { getRelationships } from '@/services/relationships'
import { SemanticGraph } from '@/components/SemanticGraph'
import { OnboardingChat } from '@/components/onboarding-chat'
import { TestGenerator } from '@/components/test-generator'
import { DataExport } from '@/components/data-export'
import { ManualScan } from '@/components/manual-scan'
import { IntegrationPanel } from '@/components/integration-panel'
import { ScanHistory } from '@/components/scan-history'
import { useRealtime } from '@/hooks/use-realtime'
import {
  Bot,
  Network,
  Clock,
  Code2,
  Fingerprint,
  Bug,
  FlaskConical,
  Download,
  Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'

export default function ProjectDetail() {
  const { projectId } = useParams()
  const [project, setProject] = useState<Project | null>(null)
  const [scans, setScans] = useState<any[]>([])
  const [entities, setEntities] = useState<any[]>([])
  const [relationships, setRelationships] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const loadData = async () => {
    if (!projectId) return
    setLoadError(false)
    try {
      const p = await getProject(projectId)
      setProject(p)
      const sc = await getScans(projectId)
      setScans(sc)
      if (sc.length > 0) {
        const ent = await getEntities(sc[0].id)
        const rel = await getRelationships(sc[0].id)
        setEntities(ent)
        setRelationships(rel)
      }
    } catch (error) {
      setLoadError(true)
      toast({ title: 'Erro ao carregar dados', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [projectId])

  useRealtime('scans', (e) => {
    if (e.record.project === projectId) loadData()
  })

  if (loading)
    return (
      <div className="p-8 lg:p-12 max-w-[1400px] mx-auto space-y-8 animate-pulse">
        <div className="h-20 bg-white/5 rounded-3xl" />
        <div className="h-[600px] bg-white/5 rounded-3xl" />
      </div>
    )

  if (!project)
    return (
      <div className="p-12 text-center text-xl text-muted-foreground">Projeto não encontrado</div>
    )

  const activeScan = scans[0]

  return (
    <div className="p-8 lg:p-12 max-w-[1400px] mx-auto flex flex-col h-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6">
        <div>
          <h1 className="text-4xl font-extrabold mb-3 tracking-tight">{project.name}</h1>
          <p className="text-muted-foreground text-lg">{project.baseUrl}</p>
        </div>
        <Button
          className="glass-panel gap-2 bg-primary/10 hover:bg-primary/20 text-primary border-primary/30 h-12 px-6 rounded-xl font-bold"
          onClick={() =>
            toast({ title: 'Assistente AI', description: 'Abrindo painel do agente...' })
          }
        >
          <Bot size={20} /> IA Developer Assistant
        </Button>
      </div>

      <Tabs defaultValue="overview" className="flex-1 flex flex-col">
        <TabsList className="glass-panel bg-black/20 border border-white/5 w-fit justify-start rounded-full p-1.5 h-auto mb-8 gap-1">
          <TabsTrigger
            value="overview"
            className="data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg rounded-full px-6 py-2.5 font-medium transition-all"
          >
            <Network size={16} className="mr-2 inline" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger
            value="graph"
            className="data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg rounded-full px-6 py-2.5 font-medium transition-all"
          >
            <Fingerprint size={16} className="mr-2 inline" />
            Grafo Semântico
          </TabsTrigger>
          <TabsTrigger
            value="manual-scan"
            className="data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg rounded-full px-6 py-2.5 font-medium transition-all"
          >
            <Upload size={16} className="mr-2 inline" />
            Scan Manual
          </TabsTrigger>
          <TabsTrigger
            value="scans"
            className="data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg rounded-full px-6 py-2.5 font-medium transition-all"
          >
            <Clock size={16} className="mr-2 inline" />
            Histórico de Scans
          </TabsTrigger>
          <TabsTrigger
            value="integration"
            className="data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg rounded-full px-6 py-2.5 font-medium transition-all"
          >
            <Code2 size={16} className="mr-2 inline" />
            Integração
          </TabsTrigger>
          <TabsTrigger
            value="onboarding"
            className="data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg rounded-full px-6 py-2.5 font-medium transition-all"
          >
            <Bot size={16} className="mr-2 inline" />
            Onboarding
          </TabsTrigger>
          <TabsTrigger
            value="tests"
            className="data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg rounded-full px-6 py-2.5 font-medium transition-all"
          >
            <FlaskConical size={16} className="mr-2 inline" />
            Testes BDD
          </TabsTrigger>
          <TabsTrigger
            value="export"
            className="data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg rounded-full px-6 py-2.5 font-medium transition-all"
          >
            <Download size={16} className="mr-2 inline" />
            Exportar
          </TabsTrigger>
        </TabsList>

        <div className="flex-1">
          <TabsContent value="overview" className="m-0 space-y-8 animate-fade-in-up">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                title="Total Entidades"
                value={entities.length.toString()}
                icon={<Network size={24} />}
              />
              <StatCard
                title="Confiança Média"
                value={
                  entities.length > 0
                    ? `${((entities.reduce((a, b) => a + b.confidence, 0) / entities.length) * 100).toFixed(1)}%`
                    : '0%'
                }
                icon={<Fingerprint size={24} />}
              />
              <StatCard
                title="Último Scan"
                value={activeScan ? new Date(activeScan.created).toLocaleDateString() : 'Nenhum'}
                icon={<Clock size={24} />}
              />
              <StatCard
                title="Active Issues"
                value={activeScan?.secretsFound?.toString() || '0'}
                icon={<Bug size={24} />}
                danger={activeScan?.secretsFound > 0}
              />
            </div>
          </TabsContent>

          <TabsContent value="graph" className="m-0 h-[700px] animate-fade-in-up">
            {entities.length > 0 ? (
              <SemanticGraph entities={entities} relationships={relationships} />
            ) : (
              <div className="w-full h-full glass-panel rounded-[2rem] flex flex-col items-center justify-center text-muted-foreground border-dashed border-2 border-white/10 bg-black/20">
                <Network size={48} className="mb-4 text-primary/40" />
                <p className="text-xl">Nenhum dado semântico encontrado.</p>
                <p className="text-sm mt-2">Execute o scanner local na raiz do seu projeto.</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="manual-scan" className="m-0 animate-fade-in-up">
            <ManualScan projectId={projectId!} scans={scans} onScanComplete={loadData} />
          </TabsContent>

          <TabsContent value="scans" className="m-0 animate-fade-in-up">
            {loadError ? (
              <div className="glass-panel rounded-[2rem] p-8 border-red-500/20 bg-red-500/5">
                <p className="text-red-400 font-medium">
                  Erro ao carregar os dados do projeto. Tente novamente.
                </p>
              </div>
            ) : (
              <ScanHistory scans={scans} project={project} loading={loading} onRefresh={loadData} />
            )}
          </TabsContent>

          <TabsContent value="integration" className="m-0 animate-fade-in-up">
            <IntegrationPanel project={project} />
          </TabsContent>

          <TabsContent value="onboarding" className="m-0 animate-fade-in-up">
            {projectId && <OnboardingChat projectId={projectId} />}
          </TabsContent>

          <TabsContent value="tests" className="m-0 animate-fade-in-up">
            {projectId && <TestGenerator entities={entities} projectId={projectId} />}
          </TabsContent>

          <TabsContent value="export" className="m-0 animate-fade-in-up">
            <DataExport
              project={project}
              entities={entities}
              relationships={relationships}
              scanDate={activeScan?.created}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

function StatCard({
  title,
  value,
  icon,
  danger,
}: {
  title: string
  value: string
  icon: React.ReactNode
  danger?: boolean
}) {
  return (
    <div
      className={`glass-panel p-8 rounded-[2rem] border-t border-l border-white/10 relative overflow-hidden group ${danger ? 'bg-red-500/5 border-red-500/20' : 'bg-white/[0.02]'}`}
    >
      <div className="absolute -right-6 -top-6 text-white/5 group-hover:text-white/10 group-hover:scale-110 transition-all duration-500">
        {icon}
      </div>
      <h4 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wider">
        {title}
      </h4>
      <p className={`text-4xl font-extrabold ${danger ? 'text-red-400' : 'text-white'}`}>{value}</p>
    </div>
  )
}
