import { cn } from '@/lib/utils'

export function ScanStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    COMPLETED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    PROCESSING: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30 animate-pulse',
    ENRICHING: 'bg-blue-500/20 text-blue-400 border-blue-500/30 animate-pulse',
    FAILED: 'bg-red-500/20 text-red-400 border-red-500/30',
  }
  return (
    <span
      className={cn(
        'px-2.5 py-1 rounded-lg text-xs font-bold tracking-wide uppercase border',
        styles[status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      )}
    >
      {status}
    </span>
  )
}
