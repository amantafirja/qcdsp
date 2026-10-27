import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/auth-context'
import type { AdminRole } from '@/types'

interface RequireRoleProps {
  roles: AdminRole[]
  children: React.ReactNode
  fallback?: string
}

export function RequireRole({ roles, children, fallback = '/admin' }: RequireRoleProps) {
  const { admin } = useAuth()

  if (!admin) {
    return <Navigate to="/admin/login" replace />
  }

  if (!roles.includes(admin.role)) {
    const target = admin.role === 'pr_viewer' ? '/admin/purchase-requests' : fallback
    return <Navigate to={target} replace />
  }

  return <>{children}</>
}