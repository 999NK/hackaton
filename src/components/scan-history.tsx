import { useState } from 'react'
import { Check, Copy, FileSearch, RefreshCw, Terminal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ScanStatusBadge } from '@/components/scan-status-badge'
import { ScanDetailSheet } from '@/components/scan-detail-sheet'
import { Scan } from '@/services/scans'
import { Project } from '@/services/projects'
import { buildSkipAgentPrompt } from '@/lib/scan-prompt'
import { toast } from '@/hooks/use-toast'

interface Props { scans: Scan[]; project: Project; loading?: boolean; onRefresh: () => void; selectedScanId?: string; onSelectScan?: (id: string) => void }

export function ScanHistory({ scans, project, loading, onRefresh, selectedScanId, onSelectScan }: Props) {
  const [detailScan, setDetailScan] = useState<Scan | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [copied, setCopied] = useState(false)
  const prompt = buildSkipAgentPrompt(project)
  const refresh = async () => { setRefreshing(true); await onRefresh(); window.setTimeout(() => setRefreshing(false), 700) }
  const copyPrompt = async () => { await navigator.clipboard.writeText(prompt); setCopied(true); toast({ title: 'Prompt copiado para a LLM' }); window.setTimeout(() => setCopied(false), 2000) }

  if (loading) return <div className="space-y-3">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-16 rounded-2xl bg-slate-200" />)}</div>
  if (!scans.length) return <section className="surface-card border-dashed p-8 text-center sm:p-10"><div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-violet-50 text-violet-600"><Terminal size={25} /></div><h3 className="text-lg font-semibold text-slate-900">Nenhum scan registrado</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Use seu agente de IA para instalar a skill e executar a primeira auditoria.</p><div className="mx-auto mt-6 max-w-3xl rounded-2xl border border-slate-800 bg-[#171521] p-5 text-left"><pre className="max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs leading-5 text-slate-300">{prompt}</pre></div><Button onClick={copyPrompt} className="mt-4 h-11 gap-2 rounded-full bg-violet-600 text-white hover:bg-violet-700">{copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Prompt copiado' : 'Copiar prompt completo'}</Button></section>

  return <section className="surface-card overflow-hidden"><div className="flex items-center justify-between border-b border-violet-100 p-6"><div><p className="eyebrow">Registros</p><h2 className="mt-1 text-lg font-semibold text-slate-950">Histórico de scans</h2></div><Button variant="outline" onClick={refresh} disabled={refreshing} className="h-10 gap-2 rounded-full border-violet-100 bg-white text-slate-700"><RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} /> Atualizar</Button></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-violet-100 bg-violet-50/40 text-xs text-slate-500"><tr><th className="p-4 pl-6 font-semibold">Data e hora</th><th className="p-4 font-semibold">Status</th><th className="p-4 font-semibold">Score</th><th className="p-4 font-semibold">Telas</th><th className="p-4 pr-6 text-right font-semibold">Ações</th></tr></thead><tbody className="divide-y divide-violet-50">{scans.map((scan) => <tr key={scan.id} onClick={() => onSelectScan?.(scan.id)} className={`cursor-pointer transition hover:bg-violet-50/50 ${scan.id === selectedScanId ? 'bg-violet-50/70' : ''}`}><td className="p-4 pl-6 text-slate-600">{new Date(scan.created).toLocaleString('pt-BR')}</td><td className="p-4"><ScanStatusBadge status={scan.status} /></td><td className="p-4 font-semibold text-slate-800">{scan.report?.wcag?.score ?? '—'}</td><td className="p-4 text-slate-600">{scan.entitiesCount ?? 0}</td><td className="p-4 pr-6 text-right"><Button size="sm" variant="ghost" onClick={(event) => { event.stopPropagation(); setDetailScan(scan); setSheetOpen(true) }} className="h-8 gap-1.5 rounded-lg text-xs text-slate-600 hover:bg-white"><FileSearch size={13} /> Detalhes</Button></td></tr>)}</tbody></table></div><ScanDetailSheet scan={detailScan} open={sheetOpen} onOpenChange={setSheetOpen} /></section>
}
