import { Link } from 'react-router-dom'
import { ChevronRight, Globe, FileCode, Network, Bug, Clock, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScanStatusBadge } from '@/components/scan-status-badge'
import { Project } from '@/services/projects'
import { Scan } from '@/services/scans'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Props {
  project: Project
  latestScan?: Scan
  entityCount: number
  onDelete: (id: string) => void
}

export function ProjectCard({ project, latestScan, entityCount, onDelete }: Props) {
  return (
    <div className="glass-panel rounded-3xl p-6 flex flex-col group hover:border-primary/40 hover:bg-white/[0.04] transition-all duration-300 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-primary/20 transition-all" />
      <div className="flex justify-between items-start mb-3 relative z-10">
        <h3 className="text-xl font-bold truncate pr-2">{project.name}</h3>
        <button
          onClick={() => onDelete(project.id)}
          className="p-2 rounded-lg hover:bg-red-500/20 hover:text-red-400 text-muted-foreground transition-colors shrink-0"
        >
          <Trash2 size={16} />
        </button>
      </div>
      <div className="flex items-center gap-2 mb-3 relative z-10 flex-wrap">
        <span className="text-xs px-2.5 py-1 rounded-lg bg-black/40 font-semibold border border-white/10">
          {project.framework || 'N/A'} • {project.language || 'N/A'}
        </span>
        {latestScan && <ScanStatusBadge status={latestScan.status} />}
      </div>
      <div className="space-y-1.5 mb-4 relative z-10 text-sm text-muted-foreground">
        <p className="flex items-center gap-2 truncate">
          <Globe size={14} className="text-primary/70 shrink-0" /> {project.baseUrl || '—'}
        </p>
        <p className="flex items-center gap-2">
          <Clock size={14} className="text-primary/70 shrink-0" />
          {project.lastScannedAt
            ? formatDistanceToNow(new Date(project.lastScannedAt), {
                addSuffix: true,
                locale: ptBR,
              })
            : 'Nunca escaneado'}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-4 relative z-10">
        <Metric
          icon={<FileCode size={14} />}
          value={latestScan?.filesCount || 0}
          label="Arquivos"
        />
        <Metric icon={<Network size={14} />} value={entityCount} label="Entidades" />
        <Metric
          icon={<Bug size={14} />}
          value={latestScan?.secretsFound || 0}
          label="Secrets"
          danger={!!latestScan?.secretsFound}
        />
      </div>
      <Link to={`/dashboard/${project.id}`} className="mt-auto relative z-10">
        <Button className="w-full gap-2 h-11 rounded-xl group-hover:shadow-primary/30 transition-shadow">
          Ver Mapa <ChevronRight size={16} />
        </Button>
      </Link>
    </div>
  )
}

function Metric({
  icon,
  value,
  label,
  danger,
}: {
  icon: React.ReactNode
  value: number
  label: string
  danger?: boolean
}) {
  return (
    <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-black/20 border border-white/5">
      <div className={`flex items-center gap-1 ${danger ? 'text-red-400' : 'text-white'}`}>
        {icon}
        <span className="font-bold text-sm">{value}</span>
      </div>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
    </div>
  )
}
