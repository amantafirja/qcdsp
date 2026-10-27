import type { AdminRole } from '@/types'

export const ADMIN_ROLES: AdminRole[] = ['super_admin', 'admin', 'pr_viewer']

export const ROLE_META: Record<AdminRole, { label: string; description: string; badge: string }> = {
  super_admin: {
    label: 'Super Admin',
    description: 'Akses penuh ke seluruh menu dan manajemen akun.',
    badge: 'border-primary-200 bg-primary-50 text-primary-800',
  },
  admin: {
    label: 'Admin',
    description: 'Akses operasional (dashboard, knowledge, kategori, PR) tanpa manajemen akun.',
    badge: 'border-sky-200 bg-sky-50 text-sky-700',
  },
  pr_viewer: {
    label: 'PR Viewer',
    description: 'Hanya dapat melihat daftar dan detail Purchase Request (read-only).',
    badge: 'border-slate-200 bg-slate-100 text-slate-700',
  },
}

export function roleLabel(role?: string): string {
  if (role && role in ROLE_META) {
    return ROLE_META[role as AdminRole].label
  }
  return 'Admin'
}

export function canManageContent(role?: string): boolean {
  return role === 'super_admin' || role === 'admin'
}

export function canManagePurchaseRequest(role?: string): boolean {
  return role === 'super_admin' || role === 'admin'
}

export function canManageAccounts(role?: string): boolean {
  return role === 'super_admin'
}
