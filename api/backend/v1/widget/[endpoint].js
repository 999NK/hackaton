import { handleWidget } from '../../../_widget.js'

export default async function handler(req, res) {
  try {
    return await handleWidget(req, res, req.query.endpoint)
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: 'internal server error' })
  }
}
