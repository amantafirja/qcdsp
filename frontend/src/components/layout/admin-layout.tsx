import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  ClipboardList,
  ExternalLink,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react'
import { BrandMarkLight } from '@/components/shared/brand-mark'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/contexts/auth-context'
import { roleLabel } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { getInitials } from '@/lib/format'
import type { AdminRole } from '@/types'

const adminNav: Array<{
  label: string
  to: string
  icon: typeof LayoutDashboard
  end?: boolean
  roles: AdminRole[]
}> = [
  { label: 'Dashboard', to: '/admin', icon: LayoutDashboard, end: true, roles: ['super_admin', 'admin'] },
  {
    label: 'Purchase Request',
    to: '/admin/purchase-requests',
    icon: Package,
    roles: ['super_admin', 'admin', 'pr_viewer'],
  },
  {
    label: 'Knowledge Management',
    to: '/admin/knowledge',
    icon: ClipboardList,
    roles: ['super_admin', 'admin'],
  },
  {
    label: 'Category Management',
    to: '/admin/categories',
    icon: FolderTree,
    roles: ['super_admin', 'admin'],
  },
  { label: 'Account Management', to: '/admin/accounts', icon: Users, roles: ['super_admin'] },
]

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  '/admin': { title: 'Dashboard', subtitle: 'Ringkasan dokumen dan Purchase Request' },
  '/admin/knowledge': { title: 'Knowledge Management', subtitle: 'Kelola dokumen dan artikel Knowledge Center' },
  '/admin/knowledge/new': { title: 'Tambah Dokumen', subtitle: 'Buat konten PDF atau artikel baru' },
  '/admin/categories': { title: 'Category Management', subtitle: 'Kelola kategori dokumen Knowledge Center' },
  '/admin/purchase-requests': { title: 'Purchase Request', subtitle: 'Kelola dan tindak lanjuti pengajuan PR' },
  '/admin/accounts': { title: 'Account Management', subtitle: 'Kelola akun admin dan hak aksesnya' },
}

export function AdminLayout() {
  const { admin, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  const current =
    pageTitles[location.pathname] ??
    (location.pathname.startsWith('/admin/knowledge/')
      ? { title: 'Edit Dokumen', subtitle: 'Perbarui konten Knowledge Center' }
      : location.pathname.startsWith('/admin/purchase-requests/')
        ? { title: 'Detail Purchase Request', subtitle: 'Tinjau data pengajuan Purchase Request' }
        : { title: 'Admin Panel', subtitle: 'QC Digital Service Portal' })

  const handleLogout = () => {
    logout()
    navigate('/admin/login', { replace: true })
  }

  const renderSidebar = (compact: boolean) => (
    <div className="flex h-full flex-col">
      <div className={cn('flex h-16 items-center border-b border-white/10 px-4', compact && 'justify-center px-2')}>
        {compact ? (
          <Link to="/admin" className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white">
            <ShieldCheck className="h-4 w-4" />
          </Link>
        ) : (
          <BrandMarkLight />
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {!compact && (
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-navy-400">
            Menu Utama
          </p>
        )}
        {adminNav
          .filter((item) => admin && item.roles.includes(admin.role))
          .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={compact ? item.label : undefined}
              className={({ isActive }) =>
                cn('sidebar-link', isActive && 'sidebar-link-active', compact && 'justify-center px-2')
              }
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              {!compact && <span className="truncate">{item.label}</span>}
            </NavLink>
          ))}

        <div className="!mt-4 border-t border-white/10 pt-4">
          {!compact && (
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-navy-400">
              Portal Publik
            </p>
          )}
          <Link
            to="/"
            title={compact ? 'Buka Portal Publik' : undefined}
            className={cn('sidebar-link', compact && 'justify-center px-2')}
          >
            <ExternalLink className="h-[18px] w-[18px] shrink-0" />
            {!compact && <span>Buka Portal Publik</span>}
          </Link>
        </div>
      </nav>

      {!compact && (
        <div className="border-t border-white/10 p-3">
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className="sidebar-link hidden w-full lg:flex"
          >
            <PanelLeftClose className="h-[18px] w-[18px]" />
            <span>Perkecil menu</span>
          </button>
        </div>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-background">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden bg-navy-900 transition-all duration-200 lg:block',
          collapsed ? 'w-[72px]' : 'w-[264px]',
        )}
      >
        {renderSidebar(collapsed)}
      </aside>

      {collapsed && (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          title="Perbesar menu"
          aria-label="Perbesar menu"
          className="fixed left-[72px] top-[72px] z-40 hidden h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-white text-navy-500 shadow-card transition-colors hover:text-primary-700 lg:flex"
        >
          <PanelLeftOpen className="h-3.5 w-3.5" />
        </button>
      )}

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[280px] animate-slide-in bg-navy-900 shadow-2xl">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 rounded-md p-1.5 text-navy-300 hover:bg-white/10 hover:text-white"
              aria-label="Tutup menu"
            >
              <X className="h-4 w-4" />
            </button>
            {renderSidebar(false)}
          </aside>
        </div>
      )}

      <div className={cn('transition-all duration-200', collapsed ? 'lg:pl-[72px]' : 'lg:pl-[264px]')}>
        <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Buka menu admin"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="min-w-0">
                <h1 className="truncate text-base font-semibold text-navy-900 sm:text-lg">{current.title}</h1>
                <p className="hidden truncate text-xs text-muted-foreground sm:block">{current.subtitle}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm" className="hidden md:inline-flex">
                <Link to="/">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Portal
                </Link>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2.5 rounded-lg border border-border bg-white py-1.5 pl-1.5 pr-3 transition-colors hover:bg-navy-50">
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-700 text-xs font-bold text-white">
                      {getInitials(admin?.name)}
                    </span>
                    <span className="hidden text-left leading-tight sm:block">
                      <span className="block text-xs font-semibold text-navy-900">{admin?.name ?? 'Admin'}</span>
                      <span className="block text-[10px] uppercase tracking-wide text-navy-400">
                        {roleLabel(admin?.role)}
                      </span>
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <p className="text-sm font-semibold text-navy-900">{admin?.name}</p>
                    <p className="text-xs text-muted-foreground">@{admin?.username}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/">
                      <ExternalLink />
                      Buka Portal Publik
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-rose-600 focus:bg-rose-50 focus:text-rose-700">
                    <LogOut />
                    Keluar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:py-8">
          <div className="mx-auto w-full max-w-[1400px]">
            <Outlet />
          </div>
        </main>

        <footer className="border-t border-border px-4 py-4 sm:px-6">
          <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-1 text-xs text-muted-foreground sm:flex-row">
            <p>QC Digital Service Portal · Admin Panel</p>
            <p className="flex items-center gap-1">
              <ChevronLeft className="h-3 w-3" />
              Internal use only
            </p>
          </div>
        </footer>
      </div>
    </div>
  )
}
