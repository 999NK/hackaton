import crypto from 'node:crypto'
import { upsertEntityEmbeddings } from './_vectors.js'

const validEntityTypes = new Set(['ROUTE', 'COMPONENT', 'API', 'FLOW', 'BUSINESS_RULE'])
const validRelationshipTypes = new Set(['CONTAINS', 'CONSUMES', 'TRIGGERS', 'REDIRECTS', 'VALIDATES'])

function slugify(value) {
  return String(value || crypto.randomUUID())
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

export function extractSamPayload(report) {
  if (Array.isArray(report?.entities)) {
    return {
      entities: report.entities,
      relationships: Array.isArray(report.relationships) ? report.relationships : [],
    }
  }

  const screens = report?.navigationMap?.screens
  if (Array.isArray(screens)) {
    const entities = screens.map((screen) => ({
      type: 'ROUTE',
      name: screen.name || screen.title || screen.path || 'Tela',
      slug: screen.slug || slugify(screen.path || screen.route || screen.name),
      path: screen.path || screen.route || '',
      pageTitle: screen.title || screen.name || '',
      semanticLabels: screen.semanticLabels || screen.labels || [],
      description: screen.description || '',
      accessibilityHint: screen.accessibilityHint || '',
      confidence: screen.confidence || 0.8,
      evidence: screen.evidence || [],
      metadata: screen,
    }))
    const relationships = []
    for (const screen of screens) {
      const routeSlug = screen.slug || slugify(screen.path || screen.route || screen.name)
      const actions = [
        ...(Array.isArray(screen.actions) ? screen.actions : []),
        ...(Array.isArray(screen.globalActions) ? screen.globalActions : []),
      ]
      for (const [index, action] of actions.entries()) {
        const label = action.label || action.name || action.intent || action.placeholder || 'Acao'
        const actionSlug = action.slug || slugify(`${routeSlug}-${label}-${index}`)
        entities.push({
          type: 'COMPONENT',
          name: label,
          slug: actionSlug,
          path: screen.filePath || action.filePath || '',
          pageTitle: screen.title || screen.name || '',
          semanticLabels: action.semanticLabels || action.labels || [label],
          description: action.description || `Acao disponivel em ${screen.title || screen.name || screen.route || screen.path || 'tela'}.`,
          accessibilityHint: action.accessibilityHint || action.hint || `Diga ${label} para acionar.`,
          confidence: action.confidence === 'low' ? 0.45 : action.confidence === 'medium' ? 0.7 : action.confidence || 0.85,
          evidence: action.evidence || [screen.filePath, action.selector || action.cssSelector].filter(Boolean),
          metadata: {
            ...action,
            kind: action.kind || action.type || 'click',
            cssSelector: action.cssSelector || action.selector || '',
            targetRoute: action.targetRoute || action.route || action.href || '',
            required: Boolean(action.required),
            screenRoute: screen.path || screen.route || '',
          },
        })
        relationships.push({ sourceSlug: routeSlug, targetSlug: actionSlug, type: 'CONTAINS' })
        if (action.targetRoute || action.route || action.href) {
          const targetSlug = slugify(action.targetRoute || action.route || action.href)
          relationships.push({ sourceSlug: actionSlug, targetSlug, type: 'REDIRECTS' })
        }
      }
    }
    return { entities, relationships }
  }

  if (Array.isArray(report?.routes)) {
    const entities = report.routes.map((route) => ({
      type: 'ROUTE',
      name: route.name || route.path || 'Rota',
      slug: route.slug || String(route.path || route.name || crypto.randomUUID()).replace(/[^a-z0-9]+/gi, '-').toLowerCase(),
      path: route.path || '',
      pageTitle: route.pageTitle || route.name || '',
      semanticLabels: route.semanticLabels || [],
      description: route.description || '',
      accessibilityHint: route.accessibilityHint || '',
      confidence: route.confidence || 0.8,
      evidence: route.evidence || [],
      metadata: route.metadata || route,
    }))
    return { entities, relationships: [] }
  }

  return { entities: [], relationships: [] }
}

function normalizeSlug(entity) {
  return entity.slug || String(entity.name || crypto.randomUUID()).toLowerCase().replace(/\s+/g, '-')
}

export async function replaceSemanticMap(client, scanId, report) {
  const { entities, relationships } = extractSamPayload(report)

  await client.query('DELETE FROM relationships WHERE scan_id = $1', [scanId])
  await client.query('DELETE FROM semantic_entities WHERE scan_id = $1', [scanId])

  const entityMap = new Map()
  const insertedEntities = []
  for (const entity of entities) {
    if (!validEntityTypes.has(entity.type) || !entity.name) continue
    const slug = normalizeSlug(entity)
    if (entityMap.has(slug)) continue

    const result = await client.query(
      `INSERT INTO semantic_entities
         (scan_id, type, name, slug, path, page_title, semantic_labels, description, accessibility_hint, confidence, evidence, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        scanId,
        entity.type,
        entity.name,
        slug,
        entity.path || '',
        entity.pageTitle || '',
        JSON.stringify(entity.semanticLabels || []),
        entity.description || '',
        entity.accessibilityHint || '',
        entity.confidence || 0.9,
        JSON.stringify(entity.evidence || []),
        JSON.stringify(entity.metadata || {}),
      ],
    )
    entityMap.set(slug, result.rows[0].id)
    insertedEntities.push(result.rows[0])
  }

  let relationshipCount = 0
  for (const relationship of relationships) {
    if (!validRelationshipTypes.has(relationship.type)) continue
    const sourceId = entityMap.get(relationship.sourceSlug) || relationship.source
    const targetId = entityMap.get(relationship.targetSlug) || relationship.target
    if (!sourceId || !targetId) continue
    await client.query(
      'INSERT INTO relationships (scan_id, source_id, target_id, type) VALUES ($1, $2, $3, $4)',
      [scanId, sourceId, targetId, relationship.type],
    )
    relationshipCount++
  }

  await client.query(
    `UPDATE scans
     SET entities_count = $1,
         phase = 'Complete',
         phase_detail = $2,
         status = 'COMPLETED'
     WHERE id = $3`,
    [entityMap.size, `Imported ${entityMap.size} entities and ${relationshipCount} relationships`, scanId],
  )

  try {
    await upsertEntityEmbeddings(client, { scanId, entities: insertedEntities })
  } catch (error) {
    console.error('Failed to update semantic vector index', error)
  }

  return { entityCount: entityMap.size, relationshipCount }
}
