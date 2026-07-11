import { useState, useMemo } from 'react'
import { X, FileCode, Accessibility } from 'lucide-react'

const TYPE_COLORS: Record<string, string> = {
  ROUTE: '#3b82f6',
  COMPONENT: '#8b5cf6',
  API: '#22c55e',
  FLOW: '#06b6d4',
  BUSINESS_RULE: '#f97316',
}

const TYPE_LABELS: Record<string, string> = {
  ROUTE: 'Rotas',
  COMPONENT: 'Componentes',
  API: 'APIs',
  FLOW: 'Fluxos',
  BUSINESS_RULE: 'Regras',
}

export function SemanticGraph({
  entities,
  relationships,
}: {
  entities: any[]
  relationships: any[]
}) {
  const [selected, setSelected] = useState<any | null>(null)
  const width = 800
  const height = 600
  const cx = width / 2
  const cy = height / 2

  const nodes = useMemo(() => {
    const map = new Map<string, any>()
    const byType: Record<string, any[]> = {}
    entities.forEach((e) => {
      if (!byType[e.type]) byType[e.type] = []
      byType[e.type].push(e)
    })

    const ringConfigs = [
      { types: ['ROUTE'], radius: 250 },
      { types: ['COMPONENT'], radius: 180 },
      { types: ['API'], radius: 120 },
      { types: ['FLOW', 'BUSINESS_RULE'], radius: 60 },
    ]

    ringConfigs.forEach(({ types, radius }) => {
      const items = types.flatMap((t) => byType[t] || [])
      items.forEach((item, i) => {
        const angle = (i / Math.max(items.length, 1)) * 2 * Math.PI
        map.set(item.id, {
          ...item,
          x: cx + radius * Math.cos(angle),
          y: cy + radius * Math.sin(angle),
        })
      })
    })

    return map
  }, [entities])

  return (
    <div className="w-full h-full relative bg-black/20 rounded-xl overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
        {relationships.map((rel) => {
          const s = nodes.get(rel.source)
          const t = nodes.get(rel.target)
          if (!s || !t) return null
          return (
            <line
              key={rel.id}
              x1={s.x}
              y1={s.y}
              x2={t.x}
              y2={t.y}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1.5"
            />
          )
        })}
        {Array.from(nodes.values()).map((n) => (
          <g
            key={n.id}
            transform={`translate(${n.x},${n.y})`}
            className="cursor-pointer"
            onClick={() => setSelected(n)}
          >
            <circle
              r="14"
              fill={TYPE_COLORS[n.type] || '#6b7280'}
              className="transition-transform hover:scale-125"
            />
            <text y="28" fill="rgba(255,255,255,0.7)" fontSize="10" textAnchor="middle">
              {n.name.length > 15 ? n.name.slice(0, 15) + '…' : n.name}
            </text>
          </g>
        ))}
      </svg>

      <div className="absolute bottom-4 left-4 flex flex-wrap gap-3 text-xs bg-black/60 px-4 py-2 rounded-full border border-white/10 backdrop-blur-md">
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
            {TYPE_LABELS[type]}
          </div>
        ))}
      </div>

      {selected && (
        <div className="absolute top-4 right-4 w-72 glass-panel rounded-2xl p-5 animate-spotlight">
          <div className="flex justify-between items-start mb-3">
            <span
              className="text-xs px-2 py-0.5 rounded-md font-bold uppercase"
              style={{
                backgroundColor: `${TYPE_COLORS[selected.type]}20`,
                color: TYPE_COLORS[selected.type],
              }}
            >
              {selected.type}
            </span>
            <button onClick={() => setSelected(null)} className="p-1 hover:bg-white/10 rounded-lg">
              <X size={14} />
            </button>
          </div>
          <h4 className="font-bold text-lg mb-3 break-words">{selected.name}</h4>
          {selected.description && (
            <p className="text-sm text-muted-foreground mb-3">{selected.description}</p>
          )}
          {selected.path && (
            <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
              <FileCode size={12} /> {selected.path}
            </div>
          )}
          {selected.accessibilityHint && (
            <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
              <Accessibility size={12} /> {selected.accessibilityHint}
            </div>
          )}
          <div className="flex items-center gap-2 mt-3">
            <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(selected.confidence || 0) * 100}%`,
                  backgroundColor: TYPE_COLORS[selected.type],
                }}
              />
            </div>
            <span className="text-xs font-bold">
              {((selected.confidence || 0) * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
