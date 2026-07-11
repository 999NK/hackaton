import app from '../server/index.js'

export default async function handler(req, res) {
  const gatewayPath = req.query?.gatewayPath
  const catchAllPath = req.query?.path
  if (gatewayPath || catchAllPath) {
    const rawPath = gatewayPath || catchAllPath
    const segments = Array.isArray(rawPath) ? rawPath : String(rawPath).split('/')
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries(req.query || {})) {
      if (key === 'path' || key === 'gatewayPath' || value == null) continue
      for (const item of Array.isArray(value) ? value : [value]) search.append(key, String(item))
    }
    const prefix = gatewayPath ? '/' : '/api/'
    req.url = `${prefix}${segments.map(encodeURIComponent).join('/')}${search.size ? `?${search}` : ''}`
  }

  if (req.url?.startsWith('/api/backend/')) {
    req.url = req.url.replace('/api/backend/', '/backend/')
  }

  return app(req, res)
}
