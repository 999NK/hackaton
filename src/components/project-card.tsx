import { Link } from 'react-router-dom'
import { ArrowUpRight, Clock3, Globe2, ShieldCheck, Trash2 } from 'lucide-react'
import { Project } from '@/services/projects'
import { Scan } from '@/services/scans'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Props { project: Project; latestScan?: Scan; entityCount: number; onDelete: (id: string) => void }

export function ProjectCard({ project, latestScan, entityCount, onDelete }: Props) {
  const score = latestScan?.report?.wcag?.score
  return (
    <article className="surface-card group flex min-h-[280px] flex-col p-6 transition duration-300 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-200/50">
      <div className="flex items-start justify-between gap-4">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-50 text-violet-600"><ShieldCheck size={21} /></div>
        <button aria-label={`Excluir ${project.name}`} onClick={() => onDelete(project.id)} className="rounded-xl p-2 text-slate-300 transition hover:bg-red-50 hover:text-red-600"><Trash2 size={17} /></button>
      </div>
      <div className="mt-5"><h3 className="truncate text-xl font-semibold tracking-tight text-slate-950">{project.name}</h3><p className="mt-1 flex items-center gap-1.5 truncate text-sm text-slate-400"><Globe2 size={13} />{project.baseUrl || 'URL não informada'}</p></div>
      <div className="mt-5 grid grid-cols-3 divide-x divide-slate-100 rounded-2xl bg-slate-50 py-3 text-center">
        <Metric value={score ?? '—'} label="Score" accent={typeof score === 'number'} />
        <Metric value={entityCount} label="Telas" />
        <Metric value={latestScan?.report?.wcag?.violations?.length ?? '—'} label="Problemas" />
      </div>
      <div className="mt-auto flex items-center justify-between pt-5"><p className="flex items-center gap-1.5 text-xs text-slate-400"><Clock3 size={13} />{project.lastScannedAt ? formatDistanceToNow(new Date(project.lastScannedAt), { addSuffix: true, locale: ptBR }) : 'Ainda não analisado'}</p><Link to={`/dashboard/${project.id}`} aria-label={`Abrir ${project.name}`} className="grid h-9 w-9 place-items-center rounded-xl bg-[#171521] text-white transition group-hover:bg-violet-600"><ArrowUpRight size={16} /></Link></div>
    </article>
  )
}

function Metric({ value, label, accent }: { value: number | string; label: string; accent?: boolean }) { return <div><strong className={`block text-lg font-semibold ${accent ? 'text-violet-600' : 'text-slate-800'}`}>{value}</strong><span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{label}</span></div> }
