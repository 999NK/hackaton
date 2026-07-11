import { handleMe } from './_auth.js'

export default async function handler(req, res) {
  try {
    return await handleMe(req, res)
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: 'internal server error' })
  }
}
