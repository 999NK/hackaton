import { handleLogin } from '../_auth.js'

export default async function handler(req, res) {
  try {
    return await handleLogin(req, res)
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: 'internal server error' })
  }
}
