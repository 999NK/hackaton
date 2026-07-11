import { pool, rowProject } from '../../server/db.js'
import { readJson, requireUser } from '../_auth.js'

async function getProject(id, userId) {
  const result = await pool.query('SELECT * FROM projects WHERE id = $1 AND owner_id = $2', [
    id,
    userId,
  ])
  return result.rows[0] || null
}

export default async function handler(req, res) {
  try {
    const user = await requireUser(req)
    if (!user) return res.status(401).json({ error: 'auth required' })

    const { id } = req.query

    if (req.method === 'GET') {
      const project = await getProject(id, user.id)
      if (!project) return res.status(404).json({ error: 'project not found' })
      return res.status(200).json(rowProject(project))
    }

    if (req.method === 'PATCH') {
      const project = await getProject(id, user.id)
      if (!project) return res.status(404).json({ error: 'project not found' })

      const body = await readJson(req)
      const result = await pool.query(
        `UPDATE projects
         SET name = COALESCE($1, name),
             token = COALESCE($2, token),
             base_url = COALESCE($3, base_url),
             framework = COALESCE($4, framework),
             language = COALESCE($5, language)
         WHERE id = $6
         RETURNING *`,
        [body.name, body.token, body.baseUrl, body.framework, body.language, id],
      )
      return res.status(200).json(rowProject(result.rows[0]))
    }

    if (req.method === 'DELETE') {
      const result = await pool.query('DELETE FROM projects WHERE id = $1 AND owner_id = $2', [
        id,
        user.id,
      ])
      if (!result.rowCount) return res.status(404).json({ error: 'project not found' })
      return res.status(204).end()
    }

    res.setHeader('Allow', 'GET, PATCH, DELETE')
    return res.status(405).json({ error: 'method not allowed' })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: 'internal server error' })
  }
}
