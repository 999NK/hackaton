import { useState } from 'react'
import { RefreshCw, FileSearch, Terminal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ScanStatusBadge } from '@/components/scan-status-badge'
import { ScanDetailSheet } from '@/components/scan-detail-sheet'
import { Scan } from '@/services/scans'
import { Project } from '@/services/projects'

interface Props {
  scans: Scan[]
  project: Project
  loading?: boolean
  onRefresh: () => void
}

export function ScanHistory({ scans, project, loading, onRefresh }: Props) {
  const [selectedScan, setSelectedScan] = useState<Scan | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = () => {
    setRefreshing(true)
    onRefresh()
    setTimeout(() => setRefreshing(false), 1000)
  }

  const handleViewDetails = (scan: Scan) => {
    setSelectedScan(scan)
    setSheetOpen(true)
  }

  const npxCommand = `npx @skip-ai/scanner --token=${project.token} --url=${window.location.origin}/backend/v1`

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Skeleton className="h-10 w-32 rounded-xl bg-white/5" />
        </div>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 rounded-2xl bg-white/5" />
        ))}
      </div>
    )
  }

  if (scans.length === 0) {
    return (
      <div className="glass-panel rounded-[2rem] border-dashed border-2 border-white/10 bg-black/20 p-10 flex flex-col items-center text-center">
        <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mb-4 text-primary border border-primary/30">
          <Terminal size={28} />
        </div>
        <h3 className="text-xl font-bold mb-2">Nenhum scan registrado</h3>
        <p className="text-muted-foreground mb-6 max-w-md">
          Rode o scanner no seu projeto para ver o resultado aqui
        </p>
        <div className="w-full max-w-2xl">
          <pre className="bg-[#09090b] p-4 rounded-xl text-sm text-emerald-400 border border-white/10 font-mono overflow-x-auto">
            <code>{npxCommand}</code>
          </pre>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          variant="secondary"
          onClick={handleRefresh}
          disabled={refreshing}
          className="gap-2 bg-white/10 hover:bg-white/20 rounded-xl h-10 px-4"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          Atualizar
        </Button>
      </div>

      <div className="glass-panel rounded-[2rem] overflow-hidden border-white/5 bg-black/20 overflow-x-auto">
        <table className="w-full text-left text-sm md:text-base">
          <thead className="bg-white/5 border-b border-white/10">
            <tr>
              <th className="p-5 font-semibold text-white/80">Data/Hora</th>
              <th className="p-5 font-semibold text-white/80">Status</th>
              <th className="p-5 font-semibold text-white/80">Telas mapeadas</th>
              <th className="p-5 font-semibold text-white/80">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {scans.map((s) => (
              <tr key={s.id} className="hover:bg-white/[0.03] transition-colors">
                <td className="p-5 text-muted-foreground">
                  {new Date(s.created).toLocaleString('pt-BR')}
                </td>
                <td className="p-5">
                  <ScanStatusBadge status={s.status} />
                </td>
                <td className="p-5 font-medium">{s.entitiesCount ?? 0}</td>
                <td className="p-5">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleViewDetails(s)}
                    className="gap-1.5 bg-white/10 hover:bg-white/20 rounded-lg h-8 text-xs"
                  >
                    <FileSearch size={12} /> Ver detalhes
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ScanDetailSheet scan={selectedScan} open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  )
}
