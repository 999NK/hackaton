import app from '../server/index.js'
import { handleLogin, handleMe, handleRegister } from './_auth.js'

export default async function handler(req, res) {
  const pathname = new URL(req.url || '/', 'http://localhost').pathname

  if (pathname === '/api/auth/login' || pathname === '/auth/login') {
    return handleLogin(req, res)
  }
  if (pathname === '/api/login' || pathname === '/login') {
    return handleLogin(req, res)
  }
  if (pathname === '/api/auth/register' || pathname === '/auth/register') {
    return handleRegister(req, res)
  }
  if (pathname === '/api/register' || pathname === '/register') {
    return handleRegister(req, res)
  }
  if (pathname === '/api/auth/me' || pathname === '/auth/me') {
    return handleMe(req, res)
  }
  if (pathname === '/api/me' || pathname === '/me') {
    return handleMe(req, res)
  }

  if (req.url?.startsWith('/api/backend/')) {
    req.url = req.url.replace('/api/backend/', '/backend/')
  }

  return app(req, res)
}
