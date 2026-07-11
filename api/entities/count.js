import { pool } from '../../server/db.js'
import { requireUser } from '../_auth.js'

export default async function handler(req, res) {
  try {
    const user = await requireUser(req)
    if (!user) return res.status(401).json({ error: 'auth required' })

    const { scanId } = req.query
    const result = await pool.query(
      `SELECT count(*)::int AS count FROM semantic_entities e
       JOIN scans s ON s.id = e.scan_id
       JOIN projects p ON p.id = s.project_id
       WHERE e.scan_id = $1 AND p.owner_id = $2`,
      [scanId, user.id],
    )
    return res.status(200).json({ count: result.rows[0]?.count || 0 })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: 'internal server error' })
  }
}
