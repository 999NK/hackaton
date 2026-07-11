import { useState, useEffect, useMemo } from 'react'
import { Search, Network } from 'lucide-react'
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
      const [projs, allScans] = await Promise.all([getProjects(), getAllScans()])
      const sMap = new Map<string, Scan>()
      for (const s of allScans) {
        const existing = sMap.get(s.project)
        if (!existing || new Date(s.created) > new Date(existing.created)) {
          sMap.set(s.project, s)
        }
      }
      const eCounts = new Map<string, number>()
      await Promise.all(
        projs.map(async (p) => {
          const scan = sMap.get(p.id)
          eCounts.set(p.id, scan ? await getEntityCount(scan.id).catch(() => 0) : 0)
        }),
      )
      setProjects(projs)
      setScansMap(sMap)
      setEntityCounts(eCounts)
    } catch {
      toast({ title: 'Erro ao carregar projetos', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useRealtime('scans', () => {
    loadData()
  })

  const handleCreate = async (data: { name: string }) => {
    const token = crypto.randomUUID() + crypto.randomUUID()
    const project = await createProject({ ...data, token, user: user.id, owner: user.id })
    return project
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteProject(id)
      setProjects((prev) => prev.filter((p) => p.id !== id))
      toast({ title: 'Projeto excluído' })
    } catch {
      toast({ title: 'Erro ao excluir', variant: 'destructive' })
    }
  }

  const filtered = useMemo(
    () => projects.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())),
    [projects, search],
  )

  return (
    <div className="p-6 lg:p-10 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold mb-1 tracking-tight">Projetos</h1>
          <p className="text-muted-foreground">Gerencie seus mapas semânticos e integrações.</p>
        </div>
        <NewProjectDialog onCreate={handleCreate} />
      </div>

      <div className="relative mb-6">
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
          size={16}
        />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar projetos..."
          className="pl-12 bg-black/20 border-white/10 h-12 rounded-xl max-w-md"
        />
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-56 rounded-3xl bg-white/5" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 glass-panel rounded-3xl border-dashed border-2 border-white/10 bg-black/20">
          <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-primary border border-primary/30">
            <Network size={28} />
          </div>
          <h3 className="text-xl font-bold mb-2">
            {search ? 'Nenhum resultado' : 'Nenhum projeto encontrado'}
          </h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            {search
              ? 'Tente buscar por outro termo.'
              : 'Crie seu primeiro projeto para começar a mapear semanticamente sua aplicação.'}
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              latestScan={scansMap.get(p.id)}
              entityCount={entityCounts.get(p.id) || 0}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}
