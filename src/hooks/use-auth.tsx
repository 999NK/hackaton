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
    apiFetch<{ user: any }>('/api/auth/me')
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
      const result = await apiFetch<{ token: string; user: any }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
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
      const result = await apiFetch<{ token: string; user: any }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
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
