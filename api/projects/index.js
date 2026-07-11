import crypto from 'node:crypto'
import { pool, rowProject } from '../../server/db.js'
import { readJson, requireUser } from '../_auth.js'

export default async function handler(req, res) {
  try {
    const user = await requireUser(req)
    if (!user) return res.status(401).json({ error: 'auth required' })

    if (req.method === 'GET') {
      const result = await pool.query(
        'SELECT * FROM projects WHERE owner_id = $1 ORDER BY created DESC',
        [user.id],
      )
      return res.status(200).json(result.rows.map(rowProject))
    }

    if (req.method === 'POST') {
      const body = await readJson(req)
      if (!body.name) return res.status(400).json({ error: 'name is required' })
      const result = await pool.query(
        `INSERT INTO projects (name, token, base_url, framework, language, user_id, owner_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          body.name,
          body.token || `${crypto.randomUUID()}${crypto.randomUUID()}`,
          body.baseUrl || '',
          body.framework || '',
          body.language || '',
          user.id,
          user.id,
        ],
      )
      return res.status(201).json(rowProject(result.rows[0]))
    }

    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'method not allowed' })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: 'internal server error' })
  }
}
