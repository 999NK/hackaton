import { pool, rowScan } from '../../server/db.js'
import { readJson, requireUser } from '../_auth.js'

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST')
      return res.status(405).json({ error: 'method not allowed' })
    }

    const user = await requireUser(req)
    if (!user) return res.status(401).json({ error: 'auth required' })

    const body = await readJson(req)
    const project = await pool.query('SELECT * FROM projects WHERE id = $1 AND owner_id = $2', [
      body.projectId,
      user.id,
    ])
    if (!project.rowCount) return res.status(404).json({ error: 'project not found' })

    const result = await pool.query(
      "INSERT INTO scans (project_id, status, report, token, files_scanned, metadata) VALUES ($1, 'PROCESSING', '{}'::jsonb, $2, 0, '{}'::jsonb) RETURNING *",
      [project.rows[0].id, project.rows[0].token],
    )
    return res.status(201).json(rowScan(result.rows[0]))
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: 'internal server error' })
  }
}
