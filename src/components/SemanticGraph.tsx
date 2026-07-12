import { useMemo, useRef, useState } from 'react'
import { Accessibility, FileCode, Maximize2, Minus, MousePointer2, Network, Plus, RotateCcw, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'

const TYPE_COLORS: Record<string, string> = {
  ROUTE: '#2563eb',
  COMPONENT: '#8b5cf6',
  API: '#16a34a',
  FLOW: '#0891b2',
  BUSINESS_RULE: '#ea580c',
}

const TYPE_LABELS: Record<string, string> = {
  ROUTE: 'Telas',
  COMPONENT: 'Elementos',
  API: 'APIs',
  FLOW: 'Fluxos',
  BUSINESS_RULE: 'Regras',
}

const RELATION_LABELS: Record<string, string> = {
  CONTAINS: 'contém',
  CONSUMES: 'consome',
  TRIGGERS: 'aciona',
  REDIRECTS: 'abre',
  VALIDATES: 'valida',
}

const CANVAS = { width: 2200, height: 1500 }
const ROUTE_SIZE = { width: 250, height: 92 }
const NODE_SIZE = { width: 180, height: 58 }

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
  const display = labelFor(entity)
  if (entity?.path && entity.path !== display) return entity.path
  if (entity?.slug && entity.slug !== display) return entity.slug
  if (isPlaceholder(entity?.name)) return 'Chave i18n não resolvida'
  return entity?.description || TYPE_LABELS[entity?.type] || entity?.type || ''
}

function relationSource(rel: any) {
  return rel?.source || rel?.sourceId || rel?.source_id || rel?.from || rel?.fromEntityId
}

function relationTarget(rel: any) {
  return rel?.target || rel?.targetId || rel?.target_id || rel?.to || rel?.toEntityId
}

function shorten(value: string, max = 30) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

function edgeColor(type?: string) {
  if (type === 'REDIRECTS') return '#2563eb'
  if (type === 'TRIGGERS') return '#7c3aed'
  if (type === 'CONSUMES') return '#16a34a'
  if (type === 'VALIDATES') return '#ea580c'
  return '#94a3b8'
}

function getNodeSize(node: any) {
  return node.type === 'ROUTE' ? ROUTE_SIZE : NODE_SIZE
}

function edgeEndpoint(from: any, to: any) {
  const fromSize = getNodeSize(from)
  const toSize = getNodeSize(to)
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (Math.abs(dx) > Math.abs(dy)) {
    return {
      x1: from.x + Math.sign(dx || 1) * fromSize.width / 2,
      y1: from.y,
      x2: to.x - Math.sign(dx || 1) * toSize.width / 2,
      y2: to.y,
    }
  }
  return {
    x1: from.x,
    y1: from.y + Math.sign(dy || 1) * fromSize.height / 2,
    x2: to.x,
    y2: to.y - Math.sign(dy || 1) * toSize.height / 2,
  }
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
  const [zoom, setZoom] = useState(0.62)
  const [pan, setPan] = useState({ x: 40, y: 28 })
  const drag = useRef<{ x: number; y: number; panX: number; panY: number; moved: boolean } | null>(null)

  const graph = useMemo(() => {
    const safeEntities = Array.isArray(entities) ? entities : []
    const safeRelationships = Array.isArray(relationships) ? relationships : []
    const byId = new Map<string, any>()
    safeEntities.forEach((entity) => {
      if (entity?.id) byId.set(entity.id, entity)
    })

    const validRelationships = safeRelationships
      .map((rel) => ({ ...rel, source: relationSource(rel), target: relationTarget(rel), type: rel?.type || rel?.relationshipType }))
      .filter((rel) => rel.source && rel.target && byId.has(rel.source) && byId.has(rel.target))

    const childrenByRoute = new Map<string, any[]>()
    const parentByChild = new Map<string, string>()
    validRelationships
      .filter((rel) => rel.type === 'CONTAINS' && byId.get(rel.source)?.type === 'ROUTE')
      .forEach((rel) => {
        const child = byId.get(rel.target)
        if (!child || child.type === 'ROUTE') return
        if (!childrenByRoute.has(rel.source)) childrenByRoute.set(rel.source, [])
        childrenByRoute.get(rel.source)!.push(child)
        parentByChild.set(child.id, rel.source)
      })

    const degree = new Map<string, number>()
    validRelationships.forEach((rel) => {
      degree.set(rel.source, (degree.get(rel.source) || 0) + 1)
      degree.set(rel.target, (degree.get(rel.target) || 0) + 1)
    })

    const query = search.trim().toLowerCase()
    const matchesSearch = (entity: any) => {
      if (!query) return true
      const haystack = [entity.name, entity.pageTitle, entity.path, entity.slug, entity.description]
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    }

    const routes = safeEntities
      .filter((entity) => entity.type === 'ROUTE')
      .sort((a, b) => (degree.get(b.id) || 0) - (degree.get(a.id) || 0) || labelFor(a).localeCompare(labelFor(b)))

    const nodes = new Map<string, any>()
    const routeCount = Math.max(routes.length, 1)
    const columns = Math.ceil(Math.sqrt(routeCount))
    const routeGapX = 620
    const routeGapY = 390
    const startX = Math.max(260, CANVAS.width / 2 - ((Math.min(columns, routeCount) - 1) * routeGapX) / 2)
    const startY = 200

    routes.forEach((route, index) => {
      const col = index % columns
      const row = Math.floor(index / columns)
      nodes.set(route.id, {
        ...route,
        displayName: labelFor(route),
        subtitle: subtitleFor(route),
        degree: degree.get(route.id) || 0,
        x: startX + col * routeGapX,
        y: startY + row * routeGapY,
      })
    })

    routes.forEach((route) => {
      const routeNode = nodes.get(route.id)
      if (!routeNode) return
      const children = (childrenByRoute.get(route.id) || [])
        .filter((child, index, arr) => arr.findIndex((item) => item.id === child.id) === index)
        .sort((a, b) => (degree.get(b.id) || 0) - (degree.get(a.id) || 0) || labelFor(a).localeCompare(labelFor(b)))

      const maxPerRow = 3
      children.forEach((child, index) => {
        const row = Math.floor(index / maxPerRow)
        const col = index % maxPerRow
        const rowItems = Math.min(maxPerRow, children.length - row * maxPerRow)
        const spread = 210
        const x = routeNode.x + (col - (rowItems - 1) / 2) * spread
        const y = routeNode.y + 130 + row * 88
        nodes.set(child.id, {
          ...child,
          displayName: labelFor(child),
          subtitle: subtitleFor(child),
          degree: degree.get(child.id) || 0,
          parentRouteId: route.id,
          x,
          y,
        })
      })
    })

    const orphanNodes = safeEntities
      .filter((entity) => entity.type !== 'ROUTE' && !nodes.has(entity.id))
      .sort((a, b) => (degree.get(b.id) || 0) - (degree.get(a.id) || 0) || labelFor(a).localeCompare(labelFor(b)))

    orphanNodes.forEach((entity, index) => {
      const x = 250 + (index % 5) * 260
      const y = CANVAS.height - 260 + Math.floor(index / 5) * 90
      nodes.set(entity.id, {
        ...entity,
        displayName: labelFor(entity),
        subtitle: subtitleFor(entity),
        degree: degree.get(entity.id) || 0,
        orphan: true,
        x,
        y,
      })
    })

    const visibleIds = new Set<string>()
    nodes.forEach((node) => {
      const typeOk = typeFilter === 'ALL' || node.type === typeFilter
      if (typeOk && matchesSearch(node)) visibleIds.add(node.id)
    })

    if (query || typeFilter !== 'ALL') {
      validRelationships.forEach((rel) => {
        if (visibleIds.has(rel.source)) visibleIds.add(rel.target)
        if (visibleIds.has(rel.target)) visibleIds.add(rel.source)
      })
    }

    const visibleNodes = new Map<string, any>()
    nodes.forEach((node, id) => {
      if (visibleIds.has(id)) visibleNodes.set(id, node)
    })

    const visibleRelationships = validRelationships.filter((rel) => visibleNodes.has(rel.source) && visibleNodes.has(rel.target))
    const navigationRelationships = visibleRelationships.filter((rel) => rel.type === 'REDIRECTS' || rel.type === 'TRIGGERS')

    return {
      nodes: visibleNodes,
      relationships: visibleRelationships,
      navigationRelationships,
      totalRelationships: validRelationships.length,
      totalEntities: safeEntities.length,
      unresolvedPlaceholders: Array.from(visibleNodes.values()).filter((entity) => isPlaceholder(entity?.name)).length,
      parentByChild,
    }
  }, [entities, relationships, search, typeFilter])

  const selected = selectedId ? graph.nodes.get(selectedId) : null
  const related = selected
    ? graph.relationships.filter((rel) => rel.source === selected.id || rel.target === selected.id)
    : []

  const setZoomSafe = (next: number) => setZoom(Math.max(0.24, Math.min(1.8, next)))
  const resetView = () => {
    setZoom(0.62)
    setPan({ x: 40, y: 28 })
    setSelectedId(null)
  }
  const fitView = () => {
    setZoom(0.42)
    setPan({ x: 20, y: 22 })
  }

  const onWheel = (event: React.WheelEvent) => {
    event.preventDefault()
    const nextZoom = zoom * (event.deltaY > 0 ? 0.9 : 1.1)
    setZoomSafe(nextZoom)
  }

  const onPointerDown = (event: React.PointerEvent) => {
    if ((event.target as Element).closest('[data-node],button,input,select')) return
    drag.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y, moved: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: React.PointerEvent) => {
    if (!drag.current) return
    const dx = event.clientX - drag.current.x
    const dy = event.clientY - drag.current.y
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.current.moved = true
    setPan({ x: drag.current.panX + dx, y: drag.current.panY + dy })
  }

  const onPointerUp = (event: React.PointerEvent) => {
    event.currentTarget.releasePointerCapture(event.pointerId)
    drag.current = null
  }

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded-3xl bg-[#f7f8fc]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur-xl">
        <div>
          <p className="eyebrow">Mapa semântico</p>
          <h3 className="text-sm font-semibold text-slate-950">
            {graph.nodes.size}/{graph.totalEntities} entidades · {graph.relationships.length} conexões · {graph.navigationRelationships.length} navegações
          </h3>
        </div>
        <div className="flex flex-1 flex-wrap justify-end gap-2">
          <div className="relative min-w-[230px] max-w-sm flex-1 sm:flex-none">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar tela, botão, path..."
              className="h-9 rounded-full border-slate-200 bg-white pl-9 text-xs"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 outline-none"
          >
            <option value="ALL">Todos</option>
            {Object.entries(TYPE_LABELS).map(([type, label]) => (
              <option key={type} value={type}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      <div
        className="relative min-h-0 flex-1 cursor-grab overflow-hidden active:cursor-grabbing"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <div className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 p-1 shadow-lg backdrop-blur-xl">
          <button onClick={() => setZoomSafe(zoom - 0.1)} className="grid h-8 w-8 place-items-center rounded-full text-slate-600 hover:bg-slate-100" aria-label="Diminuir zoom">
            <Minus size={15} />
          </button>
          <span className="w-12 text-center text-xs font-bold text-slate-600">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoomSafe(zoom + 0.1)} className="grid h-8 w-8 place-items-center rounded-full text-slate-600 hover:bg-slate-100" aria-label="Aumentar zoom">
            <Plus size={15} />
          </button>
          <button onClick={fitView} className="grid h-8 w-8 place-items-center rounded-full text-slate-600 hover:bg-slate-100" aria-label="Ver grafo completo">
            <Maximize2 size={15} />
          </button>
          <button onClick={resetView} className="grid h-8 w-8 place-items-center rounded-full text-slate-600 hover:bg-slate-100" aria-label="Restaurar visão">
            <RotateCcw size={15} />
          </button>
        </div>

        {graph.nodes.size === 0 ? (
          <div className="grid h-full place-items-center p-8 text-center">
            <div>
              <Network size={30} className="mx-auto mb-3 text-slate-300" />
              <p className="font-semibold text-slate-800">Nenhuma entidade para exibir</p>
              <p className="mt-1 text-sm text-slate-500">Ajuste os filtros ou execute um scan com `.skip-sam.json` completo.</p>
            </div>
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${CANVAS.width} ${CANVAS.height}`}
            width={CANVAS.width}
            height={CANVAS.height}
            className="absolute left-0 top-0 select-none"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}
          >
            <defs>
              {['CONTAINS', 'CONSUMES', 'TRIGGERS', 'REDIRECTS', 'VALIDATES', 'default'].map((type) => (
                <marker key={type} id={`arrow-${type}`} markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                  <path d="M0,0 L0,6 L9,3 z" fill={edgeColor(type === 'default' ? undefined : type)} />
                </marker>
              ))}
              <filter id="nodeShadow" x="-20%" y="-30%" width="140%" height="160%">
                <feDropShadow dx="0" dy="10" stdDeviation="10" floodColor="#0f172a" floodOpacity=".10" />
              </filter>
            </defs>

            <rect width={CANVAS.width} height={CANVAS.height} fill="#f7f8fc" />

            {graph.relationships.map((rel, index) => {
              const source = graph.nodes.get(rel.source)
              const target = graph.nodes.get(rel.target)
              if (!source || !target) return null
              const selectedEdge = selected && (rel.source === selected.id || rel.target === selected.id)
              const { x1, y1, x2, y2 } = edgeEndpoint(source, target)
              const curve = Math.min(180, Math.max(50, Math.abs(x2 - x1) * 0.34))
              const path = `M ${x1} ${y1} C ${x1 + curve} ${y1}, ${x2 - curve} ${y2}, ${x2} ${y2}`
              const color = edgeColor(rel.type)
              const isNavigation = rel.type === 'REDIRECTS' || rel.type === 'TRIGGERS'
              return (
                <g key={rel.id || `${rel.source}-${rel.target}-${index}`} opacity={selected && !selectedEdge ? 0.14 : 1}>
                  <path
                    d={path}
                    fill="none"
                    stroke={color}
                    strokeWidth={selectedEdge ? 3 : isNavigation ? 2.2 : 1.35}
                    strokeDasharray={rel.type === 'CONTAINS' ? '4 7' : undefined}
                    markerEnd={`url(#arrow-${rel.type || 'default'})`}
                    opacity={rel.type === 'CONTAINS' ? 0.48 : 0.86}
                  />
                  {(selectedEdge || isNavigation) && (
                    <text
                      x={(x1 + x2) / 2}
                      y={(y1 + y2) / 2 - 8}
                      textAnchor="middle"
                      fontSize="12"
                      fill={color}
                      fontWeight="800"
                      paintOrder="stroke"
                      stroke="#f7f8fc"
                      strokeWidth="5"
                    >
                      {RELATION_LABELS[rel.type] || rel.type || 'relaciona'}
                    </text>
                  )}
                </g>
              )
            })}

            {Array.from(graph.nodes.values()).map((node) => {
              const color = TYPE_COLORS[node.type] || '#64748b'
              const size = getNodeSize(node)
              const selectedNode = selected?.id === node.id
              const dimmed = selected && !selectedNode && !related.some((rel) => rel.source === node.id || rel.target === node.id)
              const routeNode = node.type === 'ROUTE'
              return (
                <g
                  key={node.id}
                  data-node
                  transform={`translate(${node.x - size.width / 2},${node.y - size.height / 2})`}
                  className="cursor-pointer"
                  opacity={dimmed ? 0.28 : 1}
                  onClick={() => setSelectedId(node.id)}
                >
                  <rect
                    width={size.width}
                    height={size.height}
                    rx={routeNode ? 24 : 18}
                    fill={routeNode ? '#ffffff' : '#ffffff'}
                    stroke={selectedNode ? color : routeNode ? `${color}55` : '#e2e8f0'}
                    strokeWidth={selectedNode ? 3 : routeNode ? 1.8 : 1}
                    filter="url(#nodeShadow)"
                  />
                  <rect x="0" y="0" width="7" height={size.height} rx="3.5" fill={color} />
                  <circle cx="25" cy={routeNode ? 29 : 21} r={routeNode ? 9 : 7} fill={color} />
                  {routeNode && <MousePointer2 x={18} y={52} size={13} color="#94a3b8" />}
                  <text x="42" y={routeNode ? 27 : 20} fill="#0f172a" fontSize={routeNode ? 14 : 12} fontWeight="800">
                    {shorten(node.displayName, routeNode ? 28 : 25)}
                  </text>
                  <text x="42" y={routeNode ? 47 : 37} fill={isPlaceholder(node.name) ? '#d97706' : '#64748b'} fontSize="10">
                    {shorten(node.subtitle || TYPE_LABELS[node.type] || node.type, routeNode ? 34 : 27)}
                  </text>
                  <text x={size.width - 14} y={routeNode ? 27 : 22} fill="#94a3b8" fontSize="11" textAnchor="end" fontWeight="800">
                    {node.degree}
                  </text>
                  {routeNode && (
                    <text x={size.width - 14} y="52" fill="#64748b" fontSize="10" textAnchor="end" fontWeight="700">
                      tela
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-200/80 bg-white/90 px-4 py-3 text-xs text-slate-600 backdrop-blur-xl">
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
        <span className="rounded-full bg-blue-50 px-3 py-1.5 font-semibold text-blue-700">seta azul/roxa = ação abre outra tela</span>
        <span className="rounded-full bg-slate-100 px-3 py-1.5 font-semibold text-slate-600">linha tracejada = item dentro da tela</span>
        {graph.unresolvedPlaceholders > 0 && (
          <span className="ml-auto rounded-full bg-amber-50 px-3 py-1.5 font-semibold text-amber-700">
            {graph.unresolvedPlaceholders} chave{graph.unresolvedPlaceholders !== 1 ? 's' : ''} i18n sem resolver
          </span>
        )}
      </div>

      {selected && (
        <aside className="surface-card absolute right-4 top-20 z-30 max-h-[calc(100%-9rem)] w-[min(380px,calc(100%-32px))] overflow-auto p-5 shadow-2xl">
          <div className="mb-3 flex items-start justify-between gap-3">
            <span
              className="rounded-md px-2 py-0.5 text-xs font-bold uppercase"
              style={{
                backgroundColor: `${TYPE_COLORS[selected.type] || '#64748b'}20`,
                color: TYPE_COLORS[selected.type] || '#64748b',
              }}
            >
              {TYPE_LABELS[selected.type] || selected.type}
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
