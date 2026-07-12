import { migrate, pool } from '../../db.js'

const action = process.argv[2]
const token = process.env.TEMP_SKIP_TOKEN

await migrate()

if (action === 'create') {
  if (!token) throw new Error('TEMP_SKIP_TOKEN is required')
  const result = await pool.query(
    `INSERT INTO projects (name, token, base_url, framework, language)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, token`,
    ['NPX Real Test', token, 'http://fixture.local', 'vite-react', 'TypeScript'],
  )
  console.log(JSON.stringify(result.rows[0]))
} else if (action === 'verify') {
  if (!token) throw new Error('TEMP_SKIP_TOKEN is required')
  const result = await pool.query(
    `SELECT s.id, s.status, s.received_artifacts, s.valid_artifacts, s.report
     FROM scans s
     JOIN projects p ON p.id = s.project_id
     WHERE p.token = $1
     ORDER BY s.created DESC
     LIMIT 1`,
    [token],
  )
  const scan = result.rows[0]
  if (!scan) throw new Error('No scan persisted for token')
  const counts = await pool.query(
    `SELECT
       (SELECT count(*)::int FROM scan_artifacts WHERE scan_id = $1) AS artifacts,
       (SELECT count(*)::int FROM semantic_entities WHERE scan_id = $1) AS entities,
       (SELECT count(*)::int FROM wcag_findings WHERE scan_id = $1) AS findings`,
    [scan.id],
  )
  console.log(JSON.stringify({ ...scan, counts: counts.rows[0] }))
} else if (action === 'cleanup') {
  if (!token) throw new Error('TEMP_SKIP_TOKEN is required')
  const projects = await pool.query('SELECT id FROM projects WHERE token = $1', [token])
  for (const project of projects.rows) {
    const scans = await pool.query('SELECT id FROM scans WHERE project_id = $1', [project.id])
    for (const scan of scans.rows) {
      await pool.query('DELETE FROM relationships WHERE scan_id = $1', [scan.id])
      await pool.query('DELETE FROM semantic_entities WHERE scan_id = $1', [scan.id])
      await pool.query('DELETE FROM wcag_findings WHERE scan_id = $1', [scan.id])
      await pool.query('DELETE FROM scan_artifacts WHERE scan_id = $1', [scan.id])
    }
    await pool.query('DELETE FROM scans WHERE project_id = $1', [project.id])
    await pool.query('DELETE FROM projects WHERE id = $1', [project.id])
  }
  console.log(JSON.stringify({ cleaned: projects.rowCount }))
} else {
  throw new Error('Unknown action')
}

await pool.end()
