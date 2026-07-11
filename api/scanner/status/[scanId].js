import { handleScannerStatus } from '../../_scanner.js'

export default async function handler(req, res) {
  try {
    return await handleScannerStatus(req, res)
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: 'internal server error' })
  }
}
