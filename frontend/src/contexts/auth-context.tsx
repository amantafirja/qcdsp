import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { tokenStorage } from '@/lib/api'
import { useProfile } from '@/hooks/use-api'
import type { AdminUser, LoginResult } from '@/types'

interface AuthContextValue {
  admin: AdminUser | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (result: LoginResult) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => tokenStorage.get())
  const [admin, setAdmin] = useState<AdminUser | null>(() => tokenStorage.getAdmin<AdminUser>())

  const profileQuery = useProfile(Boolean(token))

  useEffect(() => {
    if (profileQuery.data) {
      setAdmin(profileQuery.data)
      tokenStorage.setAdmin(profileQuery.data)
    }
  }, [profileQuery.data])

  const login = useCallback((result: LoginResult) => {
    tokenStorage.set(result.token)
    tokenStorage.setAdmin(result.admin)
    setToken(result.token)
    setAdmin(result.admin)
  }, [])

  const logout = useCallback(() => {
    tokenStorage.clear()
    setToken(null)
    setAdmin(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      admin,
      token,
      isAuthenticated: Boolean(token),
      isLoading: Boolean(token) && profileQuery.isLoading,
      login,
      logout,
    }),
    [admin, token, profileQuery.isLoading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth harus digunakan di dalam AuthProvider')
  }
  return context
}
