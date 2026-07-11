import app from '../server/index.js'

export default function handler(req, res) {
  if (req.url?.startsWith('/api/backend/')) {
    req.url = req.url.replace('/api/backend/', '/backend/')
  }
  return app(req, res)
}
