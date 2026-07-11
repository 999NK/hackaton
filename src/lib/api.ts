const API_BASE_URL = import.meta.env.VITE_API_URL || ''
const TOKEN_KEY = 'skip_auth_token'

export class ApiError extends Error {
  status: number
  data: any

  constructor(message: string, status: number, data: any) {
    super(message)
    this.status = status
    this.data = data
  }
}

export const authToken = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = authToken.get()
  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type') && options.body) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ApiError(data?.error || `HTTP ${res.status}`, res.status, data)
  }
  return data as T
}

export function apiUrl(path: string) {
  return `${API_BASE_URL}${path}`
}
