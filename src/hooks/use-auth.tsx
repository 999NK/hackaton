import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { apiFetch, authToken } from '@/lib/api'

interface AuthContextType {
  user: any
  isAuthenticated: boolean
  signUp: (email: string, password: string) => Promise<{ error: any }>
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signOut: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

async function authFetch<T>(primaryPath: string, fallbackPaths: string[], body?: unknown): Promise<T> {
  try {
    return await apiFetch<T>(primaryPath, {
      method: 'POST',
      body: JSON.stringify(body),
    })
  } catch (error: any) {
    if (error?.status !== 404) throw error
    for (const path of fallbackPaths) {
      try {
        return await apiFetch<T>(path, {
          method: 'POST',
          body: JSON.stringify(body),
        })
      } catch (fallbackError: any) {
        if (fallbackError?.status !== 404) throw fallbackError
      }
    }
    throw error
  }
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<any>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authToken.get()) {
      setLoading(false)
      return
    }
    apiFetch<{ user: any }>('/api/auth/me').catch((error: any) => {
      if (error?.status === 404) return apiFetch<{ user: any }>('/api/me')
      throw error
    })
      .then(({ user }) => {
        setUser(user)
        setIsAuthenticated(true)
      })
      .catch(() => {
        authToken.clear()
        setUser(null)
        setIsAuthenticated(false)
      })
      .finally(() => setLoading(false))
  }, [])

  const signUp = async (email: string, password: string) => {
    try {
      const result = await authFetch<{ token: string; user: any }>(
        '/api/auth/register',
        ['/api/register', '/auth/register', '/register'],
        { email, password },
      )
      authToken.set(result.token)
      setUser(result.user)
      setIsAuthenticated(true)
      return { error: null }
    } catch (error) {
      return { error }
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      const result = await authFetch<{ token: string; user: any }>(
        '/api/auth/login',
        ['/api/login', '/auth/login', '/login'],
        { email, password },
      )
      authToken.set(result.token)
      setUser(result.user)
      setIsAuthenticated(true)
      return { error: null }
    } catch (error) {
      return { error }
    }
  }

  const signOut = () => {
    authToken.clear()
    setUser(null)
    setIsAuthenticated(false)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        signUp,
        signIn,
        signOut,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
