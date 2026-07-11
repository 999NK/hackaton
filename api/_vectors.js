import { rowEntity } from '../server/db.js'

const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'

function asArray(value) {
  return Array.isArray(value) ? value : []
}

export function entityContent(entity) {
  return [
    `Tipo: ${entity.type || ''}`,
    `Nome: ${entity.name || ''}`,
    `Slug: ${entity.slug || ''}`,
    `Rota: ${entity.path || entity.metadata?.targetRoute || ''}`,
    `Titulo: ${entity.pageTitle || entity.page_title || ''}`,
    `Labels: ${asArray(entity.semanticLabels || entity.semantic_labels).join(', ')}`,
    `Descricao: ${entity.description || ''}`,
    `Dica: ${entity.accessibilityHint || entity.accessibility_hint || ''}`,
    `Metadata: ${JSON.stringify(entity.metadata || {})}`,
  ]
    .filter((part) => !part.endsWith(': '))
    .join('\n')
}

async function embedInputs(inputs) {
  if (!process.env.OPENAI_API_KEY || inputs.length === 0) return []

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: inputs,
    }),
  })

  if (!response.ok) {
    throw new Error(`Embedding request failed with ${response.status}`)
  }

  const data = await response.json()
  return (data.data || [])
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding)
}

function vectorLiteral(vector) {
  return `[${vector.map((value) => Number(value).toFixed(8)).join(',')}]`
}

export async function upsertEntityEmbeddings(client, { projectId, scanId, entities }) {
  if (!process.env.OPENAI_API_KEY || !Array.isArray(entities) || entities.length === 0) return 0

  let resolvedProjectId = projectId
  if (!resolvedProjectId) {
    const scan = await client.query('SELECT project_id FROM scans WHERE id = $1', [scanId])
    resolvedProjectId = scan.rows[0]?.project_id || ''
  }
  if (!resolvedProjectId) return 0

  await client.query('DELETE FROM semantic_entity_embeddings WHERE scan_id = $1', [scanId])

  let written = 0
  const chunkSize = 96
  for (let start = 0; start < entities.length; start += chunkSize) {
    const chunk = entities.slice(start, start + chunkSize)
    const contents = chunk.map(entityContent)
    const embeddings = await embedInputs(contents)

    for (let index = 0; index < chunk.length; index++) {
      const entity = chunk[index]
      const embedding = embeddings[index]
      if (!embedding) continue
      await client.query(
        `INSERT INTO semantic_entity_embeddings
           (entity_id, scan_id, project_id, type, slug, name, path, content, embedding)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::vector)
         ON CONFLICT (entity_id) DO UPDATE SET
           scan_id = EXCLUDED.scan_id,
           project_id = EXCLUDED.project_id,
           type = EXCLUDED.type,
           slug = EXCLUDED.slug,
           name = EXCLUDED.name,
           path = EXCLUDED.path,
           content = EXCLUDED.content,
           embedding = EXCLUDED.embedding,
           updated = now()`,
        [
          entity.id,
          scanId,
          resolvedProjectId,
          entity.type || '',
          entity.slug || '',
          entity.name || '',
          entity.path || '',
          contents[index],
          vectorLiteral(embedding),
        ],
      )
      written++
    }
  }

  return written
}

export async function semanticVectorSearch(client, { projectId, scanId, text, limit = 80 }) {
  if (!process.env.OPENAI_API_KEY || !text) return []

  const [embedding] = await embedInputs([text])
  if (!embedding) return []

  const result = await client.query(
    `SELECT e.*, (emb.embedding <=> $3::vector) AS vector_distance
     FROM semantic_entity_embeddings emb
     JOIN semantic_entities e ON e.id = emb.entity_id
     WHERE emb.project_id = $1 AND emb.scan_id = $2
     ORDER BY emb.embedding <=> $3::vector
     LIMIT $4`,
    [projectId, scanId, vectorLiteral(embedding), limit],
  )

  return result.rows.map((row) => ({
    ...rowEntity(row),
    vectorDistance: Number(row.vector_distance ?? 0),
  }))
}
