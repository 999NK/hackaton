import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { migrate, pool } from '../server/db.js'

const jwtSecret = process.env.JWT_SECRET || 'change-me-before-production'
let migrationPromise

function ensureMigrated() {
  migrationPromise ||= migrate()
  return migrationPromise
}

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':')
  if (!salt || !hash) return false
  const candidate = crypto.scryptSync(password, salt, 64)
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), candidate)
}

export function signUser(row) {
  return jwt.sign({ sub: row.id, email: row.email }, jwtSecret, { expiresIn: '7d' })
}

export function userPayload(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name || '',
    avatar: row.avatar || '',
    created: row.created,
    updated: row.updated,
  }
}

export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}')

  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : {}
}

export async function requireUser(req) {
  await ensureMigrated()
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return null

  try {
    const payload = jwt.verify(token, jwtSecret)
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [payload.sub])
    return result.rows[0] || null
  } catch {
    return null
  }
}

export async function handleRegister(req, res) {
  await ensureMigrated()
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method not allowed' })
  }

  const { email, password } = await readJson(req)
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' })
  }

  try {
    const result = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING *',
      [String(email).toLowerCase(), hashPassword(password)],
    )
    const user = result.rows[0]
    return res.status(201).json({ token: signUser(user), user: userPayload(user) })
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'email already registered' })
    throw error
  }
}

export async function handleLogin(req, res) {
  await ensureMigrated()
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method not allowed' })
  }

  const { email, password } = await readJson(req)
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [
    String(email || '').toLowerCase(),
  ])
  const user = result.rows[0]
  if (!user || !verifyPassword(password || '', user.password_hash)) {
    return res.status(401).json({ error: 'invalid credentials' })
  }
  return res.status(200).json({ token: signUser(user), user: userPayload(user) })
}

export async function handleMe(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'method not allowed' })
  }
  const user = await requireUser(req)
  if (!user) return res.status(401).json({ error: 'auth required' })
  return res.status(200).json({ user: userPayload(user) })
}
