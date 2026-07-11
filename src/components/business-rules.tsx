import { useMemo } from 'react'
import { AlertCircle, AlertTriangle, Info, FileCode } from 'lucide-react'

type Severity = 'CRITICAL' | 'WARNING' | 'INFO'

const SEVERITY_CONFIG: Record<
  Severity,
  { color: string; bg: string; border: string; icon: React.ReactNode }
> = {
  CRITICAL: {
    color: 'text-red-400',
    bg: 'bg-red-500/5',
    border: 'border-red-500/20',
    icon: <AlertCircle size={18} />,
  },
  WARNING: {
    color: 'text-amber-400',
    bg: 'bg-amber-500/5',
    border: 'border-amber-500/20',
    icon: <AlertTriangle size={18} />,
  },
  INFO: {
    color: 'text-blue-400',
    bg: 'bg-blue-500/5',
    border: 'border-blue-500/20',
    icon: <Info size={18} />,
  },
}

function getSeverity(entity: any): Severity {
  const labels = entity.semanticLabels
  if (Array.isArray(labels)) {
    const str = labels.join(' ').toLowerCase()
    if (str.includes('critical')) return 'CRITICAL'
    if (str.includes('warning')) return 'WARNING'
    if (str.includes('info')) return 'INFO'
  }
  const conf = entity.confidence || 0
  if (conf < 0.5) return 'CRITICAL'
  if (conf < 0.8) return 'WARNING'
  return 'INFO'
}

export function BusinessRules({ entities }: { entities: any[] }) {
  const rules = useMemo(
    () =>
      entities
        .filter((e) => e.type === 'BUSINESS_RULE')
        .map((e) => ({ ...e, severity: getSeverity(e) })),
    [entities],
  )

  const grouped = useMemo(() => {
    const g: Record<Severity, typeof rules> = { CRITICAL: [], WARNING: [], INFO: [] }
    rules.forEach((r) => g[r.severity].push(r))
    return g
  }, [rules])

  if (rules.length === 0) {
    return (
      <div className="glass-panel rounded-[2rem] flex flex-col items-center justify-center py-20 text-muted-foreground border-dashed border-2 border-white/10 bg-black/20">
        <AlertCircle size={48} className="mb-4 text-primary/40" />
        <p className="text-xl">Nenhuma regra de negócio encontrada.</p>
        <p className="text-sm mt-2">Execute o scanner para descobrir regras no seu código.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {(Object.keys(grouped) as Severity[]).map((severity) => {
        const items = grouped[severity]
        if (items.length === 0) return null
        const config = SEVERITY_CONFIG[severity]
        return (
          <div key={severity}>
            <h3
              className={`text-sm font-bold uppercase tracking-wider mb-3 flex items-center gap-2 ${config.color}`}
            >
              {config.icon} {severity} ({items.length})
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              {items.map((rule) => (
                <div
                  key={rule.id}
                  className={`glass-panel rounded-2xl p-5 ${config.bg} ${config.border} border`}
                >
                  <h4 className="font-bold mb-2">{rule.name}</h4>
                  {rule.description && (
                    <p className="text-sm text-muted-foreground mb-3">{rule.description}</p>
                  )}
                  {rule.path && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-2">
                      <FileCode size={12} /> {rule.path}
                    </p>
                  )}
                  {rule.evidence && typeof rule.evidence === 'object' && (
                    <div className="text-xs bg-black/30 rounded-lg p-2 mt-2 font-mono text-muted-foreground overflow-x-auto">
                      {JSON.stringify(rule.evidence).slice(0, 200)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
