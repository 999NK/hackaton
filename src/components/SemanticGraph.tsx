import { useMemo, useState } from 'react'
import { Accessibility, FileCode, Network, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'

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

const TYPE_ORDER = ['ROUTE', 'FLOW', 'COMPONENT', 'BUSINESS_RULE', 'API']
const RELATION_LABELS: Record<string, string> = {
  CONTAINS: 'contém',
  CONSUMES: 'consome',
  TRIGGERS: 'aciona',
  REDIRECTS: 'navega',
  VALIDATES: 'valida',
}

function isPlaceholder(value?: string) {
  return Boolean(value && /^\{[^}]+\}$/.test(value.trim()))
}

function labelFor(entity: any) {
  const candidates = [entity?.pageTitle, entity?.name, entity?.path, entity?.slug, entity?.id]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
  return candidates.find((value) => !isPlaceholder(value)) || candidates[0] || 'Entidade'
}

function subtitleFor(entity: any) {
  if (entity?.path && entity.path !== labelFor(entity)) return entity.path
  if (entity?.slug && entity.slug !== labelFor(entity)) return entity.slug
  if (isPlaceholder(entity?.name)) return 'Chave i18n não resolvida pelo scanner'
  return entity?.description || ''
}

function relationSource(rel: any) {
  return rel?.source || rel?.sourceId || rel?.source_id || rel?.from || rel?.fromEntityId
}

function relationTarget(rel: any) {
  return rel?.target || rel?.targetId || rel?.target_id || rel?.to || rel?.toEntityId
}

function shorten(value: string, max = 28) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

export function SemanticGraph({
  entities,
  relationships,
}: {
  entities: any[]
  relationships: any[]
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const width = 1180
  const height = 720
  const nodeWidth = 190
  const nodeHeight = 58

  const graph = useMemo(() => {
    const safeEntities = Array.isArray(entities) ? entities : []
    const safeRelationships = Array.isArray(relationships) ? relationships : []
    const byId = new Map<string, any>()
    safeEntities.forEach((entity) => {
      if (entity?.id) byId.set(entity.id, entity)
    })

    const validRelationships = safeRelationships
      .map((rel) => ({ ...rel, source: relationSource(rel), target: relationTarget(rel) }))
      .filter((rel) => rel.source && rel.target && byId.has(rel.source) && byId.has(rel.target))

    const degree = new Map<string, number>()
    validRelationships.forEach((rel) => {
      degree.set(rel.source, (degree.get(rel.source) || 0) + 1)
      degree.set(rel.target, (degree.get(rel.target) || 0) + 1)
    })

    const query = search.trim().toLowerCase()
    const filteredEntities = safeEntities.filter((entity) => {
      if (typeFilter !== 'ALL' && entity.type !== typeFilter) return false
      if (!query) return true
      const haystack = [entity.name, entity.pageTitle, entity.path, entity.slug, entity.description]
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })

    const visibleIds = new Set(filteredEntities.map((entity) => entity.id))
    const visibleRelationships = validRelationships.filter((rel) => visibleIds.has(rel.source) && visibleIds.has(rel.target))

    const columns = TYPE_ORDER.map((type) => ({
      type,
      items: filteredEntities
        .filter((entity) => entity.type === type)
        .sort((a, b) => (degree.get(b.id) || 0) - (degree.get(a.id) || 0) || labelFor(a).localeCompare(labelFor(b))),
    })).filter((column) => column.items.length)

    const xByType = new Map<string, number>()
    columns.forEach((column, index) => {
      const x = columns.length === 1 ? width / 2 : 90 + index * ((width - 180) / Math.max(1, columns.length - 1))
      xByType.set(column.type, x)
    })

    const nodes = new Map<string, any>()
    columns.forEach((column) => {
      const availableHeight = height - 150
      const gap = Math.max(76, Math.min(112, availableHeight / Math.max(1, column.items.length)))
      const total = (column.items.length - 1) * gap
      const startY = Math.max(92, height / 2 - total / 2)
      column.items.forEach((entity, index) => {
        nodes.set(entity.id, {
          ...entity,
          displayName: labelFor(entity),
          subtitle: subtitleFor(entity),
          degree: degree.get(entity.id) || 0,
          x: xByType.get(column.type) || width / 2,
          y: startY + index * gap,
        })
      })
    })

    return {
      nodes,
      relationships: visibleRelationships,
      totalRelationships: validRelationships.length,
      columns,
      hiddenEntities: safeEntities.length - filteredEntities.length,
      unresolvedPlaceholders: filteredEntities.filter((entity) => isPlaceholder(entity?.name)).length,
    }
  }, [entities, relationships, search, typeFilter])

  const selected = selectedId ? graph.nodes.get(selectedId) : null
  const related = selected
    ? graph.relationships.filter((rel) => rel.source === selected.id || rel.target === selected.id)
    : []

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded-3xl bg-[#f7f8fc]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-white/85 px-4 py-3 backdrop-blur-xl">
        <div>
          <p className="eyebrow">Mapa semântico</p>
          <h3 className="text-sm font-semibold text-slate-950">
            {graph.nodes.size} entidades visíveis · {graph.relationships.length} conexões reais
          </h3>
        </div>
        <div className="flex flex-1 flex-wrap justify-end gap-2">
          <div className="relative min-w-[220px] max-w-sm flex-1 sm:flex-none">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar rota, componente, path..."
              className="h-9 rounded-full border-slate-200 bg-white pl-9 text-xs"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 outline-none"
          >
            <option value="ALL">Todos</option>
            {TYPE_ORDER.map((type) => (
              <option key={type} value={type}>{TYPE_LABELS[type]}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-auto">
        {graph.nodes.size === 0 ? (
          <div className="grid h-full place-items-center p-8 text-center">
            <div>
              <Network size={30} className="mx-auto mb-3 text-slate-300" />
              <p className="font-semibold text-slate-800">Nenhuma entidade para exibir</p>
              <p className="mt-1 text-sm text-slate-500">Ajuste os filtros ou execute um scan com `.skip-sam.json` completo.</p>
            </div>
          </div>
        ) : (
          <svg viewBox={`0 0 ${width} ${height}`} className="min-h-[680px] min-w-[1120px]">
            <defs>
              <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0 L0,6 L9,3 z" fill="#94a3b8" />
              </marker>
            </defs>

            {graph.relationships.map((rel, index) => {
              const source = graph.nodes.get(rel.source)
              const target = graph.nodes.get(rel.target)
              if (!source || !target) return null
              const selectedEdge = selected && (rel.source === selected.id || rel.target === selected.id)
              const dx = Math.max(40, Math.abs(target.x - source.x) * 0.42)
              const startX = source.x + (target.x >= source.x ? nodeWidth / 2 : -nodeWidth / 2)
              const endX = target.x + (target.x >= source.x ? -nodeWidth / 2 : nodeWidth / 2)
              const path = `M ${startX} ${source.y} C ${startX + (target.x >= source.x ? dx : -dx)} ${source.y}, ${endX - (target.x >= source.x ? dx : -dx)} ${target.y}, ${endX} ${target.y}`
              return (
                <g key={rel.id || `${rel.source}-${rel.target}-${index}`}>
                  <path
                    d={path}
                    fill="none"
                    stroke={selectedEdge ? '#2563eb' : '#cbd5e1'}
                    strokeWidth={selectedEdge ? 2.4 : 1.4}
                    markerEnd="url(#arrow)"
                    opacity={selected && !selectedEdge ? 0.18 : 0.82}
                  />
                  {selectedEdge && (
                    <text x={(source.x + target.x) / 2} y={(source.y + target.y) / 2 - 6} textAnchor="middle" fontSize="10" fill="#2563eb" fontWeight="700">
                      {RELATION_LABELS[rel.type] || rel.type || 'relaciona'}
                    </text>
                  )}
                </g>
              )
            })}

            {Array.from(graph.nodes.values()).map((node) => {
              const color = TYPE_COLORS[node.type] || '#64748b'
              const selectedNode = selected?.id === node.id
              const dimmed = selected && !selectedNode && !related.some((rel) => rel.source === node.id || rel.target === node.id)
              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x - nodeWidth / 2},${node.y - nodeHeight / 2})`}
                  className="cursor-pointer"
                  onClick={() => setSelectedId(node.id)}
                  opacity={dimmed ? 0.28 : 1}
                >
                  <rect
                    width={nodeWidth}
                    height={nodeHeight}
                    rx="18"
                    fill="white"
                    stroke={selectedNode ? color : '#e2e8f0'}
                    strokeWidth={selectedNode ? 2.5 : 1}
                    filter="drop-shadow(0 10px 20px rgba(15,23,42,.08))"
                  />
                  <circle cx="22" cy="21" r="7" fill={color} />
                  <text x="38" y="19" fill="#0f172a" fontSize="12" fontWeight="700">
                    {shorten(node.displayName)}
                  </text>
                  <text x="38" y="36" fill={isPlaceholder(node.name) ? '#d97706' : '#64748b'} fontSize="10">
                    {shorten(node.subtitle || TYPE_LABELS[node.type] || node.type, 32)}
                  </text>
                  <text x={nodeWidth - 12} y="22" fill="#94a3b8" fontSize="10" textAnchor="end" fontWeight="700">
                    {node.degree}
                  </text>
                  <rect x="14" y="44" width={nodeWidth - 28} height="4" rx="2" fill="#eef2ff" />
                  <rect x="14" y="44" width={(nodeWidth - 28) * Math.max(0.08, Math.min(1, Number(node.confidence || 0.7)))} height="4" rx="2" fill={color} />
                </g>
              )
            })}
          </svg>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-200/80 bg-white/85 px-4 py-3 text-xs text-slate-600 backdrop-blur-xl">
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <button
            key={type}
            onClick={() => setTypeFilter(typeFilter === type ? 'ALL' : type)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 transition ${typeFilter === type ? 'bg-slate-900 text-white' : 'bg-slate-100 hover:bg-slate-200'}`}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
            {TYPE_LABELS[type]}
          </button>
        ))}
        {graph.unresolvedPlaceholders > 0 && (
          <span className="ml-auto rounded-full bg-amber-50 px-3 py-1.5 font-semibold text-amber-700">
            {graph.unresolvedPlaceholders} chave{graph.unresolvedPlaceholders !== 1 ? 's' : ''} i18n sem resolver
          </span>
        )}
      </div>

      {selected && (
        <aside className="surface-card absolute right-4 top-20 z-10 max-h-[calc(100%-9rem)] w-[min(360px,calc(100%-32px))] overflow-auto p-5 shadow-2xl">
          <div className="mb-3 flex items-start justify-between gap-3">
            <span
              className="rounded-md px-2 py-0.5 text-xs font-bold uppercase"
              style={{
                backgroundColor: `${TYPE_COLORS[selected.type] || '#64748b'}20`,
                color: TYPE_COLORS[selected.type] || '#64748b',
              }}
            >
              {selected.type}
            </span>
            <button onClick={() => setSelectedId(null)} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100">
              <X size={14} />
            </button>
          </div>
          <h4 className="mb-1 break-words text-lg font-bold text-slate-950">{selected.displayName}</h4>
          {isPlaceholder(selected.name) && (
            <p className="mb-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">
              Nome recebido como chave i18n: <code>{selected.name}</code>. O scanner precisa resolver a tradução ou enviar um label renderizado.
            </p>
          )}
          {selected.description && <p className="mb-3 text-sm leading-6 text-slate-600">{selected.description}</p>}
          {selected.path && (
            <div className="mb-2 flex items-center gap-1.5 text-xs text-slate-500">
              <FileCode size={12} /> <span className="break-all">{selected.path}</span>
            </div>
          )}
          {selected.accessibilityHint && (
            <div className="mb-2 flex items-center gap-1.5 text-xs text-slate-500">
              <Accessibility size={12} /> {selected.accessibilityHint}
            </div>
          )}
          <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Conexões ({related.length})
            </p>
            {related.length ? (
              <div className="space-y-2">
                {related.map((rel, index) => {
                  const otherId = rel.source === selected.id ? rel.target : rel.source
                  const other = graph.nodes.get(otherId)
                  return (
                    <button
                      key={rel.id || index}
                      onClick={() => other && setSelectedId(other.id)}
                      className="block w-full rounded-xl bg-white p-3 text-left text-xs text-slate-600 shadow-sm hover:bg-blue-50"
                    >
                      <span className="font-semibold text-slate-900">{rel.source === selected.id ? '→' : '←'} {other?.displayName || otherId}</span>
                      <span className="ml-2 text-slate-400">{RELATION_LABELS[rel.type] || rel.type}</span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs leading-5 text-slate-500">Sem relacionamento persistido para esta entidade.</p>
            )}
          </div>
        </aside>
      )}
    </div>
  )
}
