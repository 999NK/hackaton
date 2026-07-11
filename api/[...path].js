import app from '../server/index.js'

export default async function handler(req, res) {
  if (req.url?.startsWith('/api/backend/')) {
    req.url = req.url.replace('/api/backend/', '/backend/')
  }

  return app(req, res)
}
