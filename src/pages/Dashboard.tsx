import { useEffect, useMemo, useState } from 'react'
import { FolderPlus, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ProjectCard } from '@/components/project-card'
import { NewProjectDialog } from '@/components/new-project-dialog'
import { getProjects, createProject, deleteProject, Project } from '@/services/projects'
import { getAllScans, Scan } from '@/services/scans'
import { getEntityCount } from '@/services/entities'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { toast } from '@/hooks/use-toast'

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([])
  const [scansMap, setScansMap] = useState<Map<string, Scan>>(new Map())
  const [entityCounts, setEntityCounts] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const { user } = useAuth()

  const loadData = async () => {
    try {
      const [nextProjects, allScans] = await Promise.all([getProjects(), getAllScans()])
      const nextScans = new Map<string, Scan>()
      for (const scan of allScans) {
        const current = nextScans.get(scan.project)
        if (!current || new Date(scan.created) > new Date(current.created)) nextScans.set(scan.project, scan)
      }
      const nextCounts = new Map<string, number>()
      await Promise.all(nextProjects.map(async (project) => {
        const scan = nextScans.get(project.id)
        nextCounts.set(project.id, scan ? await getEntityCount(scan.id).catch(() => 0) : 0)
      }))
      setProjects(nextProjects); setScansMap(nextScans); setEntityCounts(nextCounts)
    } catch { toast({ title: 'Não foi possível carregar os projetos', variant: 'destructive' }) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadData() }, [])
  useRealtime('scans', loadData)

  const handleCreate = async (data: { name: string }) => createProject({ ...data, token: crypto.randomUUID() + crypto.randomUUID(), user: user.id, owner: user.id })
  const handleDelete = async (id: string) => { try { await deleteProject(id); setProjects((items) => items.filter((item) => item.id !== id)); toast({ title: 'Projeto excluído' }) } catch { toast({ title: 'Erro ao excluir', variant: 'destructive' }) } }
  const filtered = useMemo(() => projects.filter((project) => project.name.toLowerCase().includes(search.toLowerCase())), [projects, search])

  return (
    <div className="page-shell py-8 sm:py-10">
      <div className="mb-8 flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
        <div><p className="eyebrow mb-2">Workspace</p><h1 className="text-3xl font-semibold tracking-[-0.03em] text-slate-950">Seus projetos</h1><p className="mt-2 text-sm text-slate-500">Acompanhe acessibilidade, mapas semânticos e integrações.</p></div>
        <NewProjectDialog onCreate={handleCreate} />
      </div>
      <div className="relative mb-7 max-w-md"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar projetos..." className="h-12 rounded-xl border-slate-200 bg-white pl-12 text-slate-800 shadow-sm placeholder:text-slate-400 focus-visible:ring-blue-100" /></div>
      {loading ? <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-[280px] rounded-3xl bg-slate-200" />)}</div> : filtered.length === 0 ? <div className="surface-card border-dashed py-20 text-center"><div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><FolderPlus size={28} /></div><h3 className="text-xl font-semibold text-slate-900">{search ? 'Nenhum resultado' : 'Seu primeiro projeto começa aqui'}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{search ? 'Tente buscar por outro termo.' : 'Crie um projeto para auditar WCAG, mapear a navegação e acompanhar a evolução do score.'}</p></div> : <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">{filtered.map((project) => <ProjectCard key={project.id} project={project} latestScan={scansMap.get(project.id)} entityCount={entityCounts.get(project.id) || 0} onDelete={handleDelete} />)}</div>}
    </div>
  )
}
