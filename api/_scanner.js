import { pool } from '../server/db.js'
import { readJson } from './_auth.js'
import { extractSamPayload, replaceSemanticMap } from './_sam.js'

export async function handleScanner(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method not allowed' })
  }

  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return res.status(401).json({ error: 'Token ausente' })

  const projectResult = await pool.query('SELECT * FROM projects WHERE token = $1', [token])
  const project = projectResult.rows[0]
  if (!project) return res.status(401).json({ error: 'Token invalido' })

  const body = await readJson(req)
  const report = body.report || body
  const { entities } = extractSamPayload(report)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await client.query(
      `INSERT INTO scans
         (project_id, status, report, entities_count, token, error_message, files_count, files_scanned, secrets_found, metadata)
       VALUES ($1, 'COMPLETED', $2, $3, $4, '', $5, $5, $6, $2)
       RETURNING *`,
      [
        project.id,
        report,
        entities.length,
        token,
        body.filesCount || entities.length || 0,
        body.secretsFound || 0,
      ],
    )
    if (entities.length > 0) {
      await replaceSemanticMap(client, result.rows[0].id, report)
    }
    await client.query('UPDATE projects SET last_scanned_at = now() WHERE id = $1', [project.id])
    await client.query('COMMIT')
    return res.status(200).json({ scanId: result.rows[0].id })
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function handleScannerStatus(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'method not allowed' })
  }

  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return res.status(401).json({ error: 'Token ausente' })

  const scanId = req.query.scanId
  const result = await pool.query('SELECT * FROM scans WHERE id = $1', [scanId])
  const scan = result.rows[0]
  if (!scan) return res.status(404).json({ error: 'Scan nao encontrado' })
  if (scan.token !== token) return res.status(401).json({ error: 'Token invalido' })

  return res.status(200).json({
    scanId: scan.id,
    status: scan.status,
    entitiesCount: scan.entities_count || 0,
    errorMessage: scan.error_message || null,
  })
}
