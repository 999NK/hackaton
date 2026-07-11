import app from '../server/index.js'

export default async function handler(req, res) {
  const catchAllPath = req.query?.path
  if (catchAllPath) {
    const segments = Array.isArray(catchAllPath) ? catchAllPath : String(catchAllPath).split('/')
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries(req.query || {})) {
      if (key === 'path' || value == null) continue
      for (const item of Array.isArray(value) ? value : [value]) search.append(key, String(item))
    }
    req.url = `/api/${segments.map(encodeURIComponent).join('/')}${search.size ? `?${search}` : ''}`
  }

  if (req.url?.startsWith('/api/backend/')) {
    req.url = req.url.replace('/api/backend/', '/backend/')
  }

  return app(req, res)
}
