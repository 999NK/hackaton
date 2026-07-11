import { handleScanner } from '../../_scanner.js'

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      return res.status(200).json({
        ok: true,
        endpoints: ['/backend/v1/scanner', '/backend/v1/scanner/status/:scanId'],
      })
    }
    return await handleScanner(req, res)
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: 'internal server error' })
  }
}
