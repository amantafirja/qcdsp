import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { ChevronDown, ClipboardList, FileSearch, Menu, Search, ShieldCheck, X } from 'lucide-react'
import { BrandMark } from '@/components/shared/brand-mark'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const navItems = [
  { label: 'Beranda', to: '/' },
  { label: 'Knowledge Center', to: '/knowledge' },
  { label: 'Pengajuan PR', to: '/purchase-request' },
  { label: 'Tracking PR', to: '/tracking' },
]

export function PublicHeader() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 8)
    handler()
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b bg-white/95 backdrop-blur transition-shadow',
        scrolled ? 'border-navy-100 shadow-sm' : 'border-transparent',
      )}
    >
      <div className="page-shell flex h-16 items-center justify-between gap-4">
        <BrandMark />

        <nav className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'rounded-lg px-3.5 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary-50 text-primary-800'
                    : 'text-navy-600 hover:bg-navy-50 hover:text-navy-900',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/knowledge">
              <Search className="h-4 w-4" />
              Cari dokumen
            </Link>
          </Button>
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link to="/admin/login">
              <ShieldCheck className="h-4 w-4" />
              Admin
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label="Buka menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-navy-100 bg-white lg:hidden">
          <nav className="page-shell flex flex-col gap-1 py-3">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'rounded-lg px-3 py-2.5 text-sm font-medium',
                    isActive ? 'bg-primary-50 text-primary-800' : 'text-navy-700 hover:bg-navy-50',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
            <Link
              to="/admin/login"
              className="mt-1 flex items-center gap-2 rounded-lg bg-navy-900 px-3 py-2.5 text-sm font-semibold text-white"
            >
              <ShieldCheck className="h-4 w-4" />
              Admin Panel
            </Link>
          </nav>
        </div>
      )}
    </header>
  )
}

export function PublicFooter() {
  return (
    <footer className="mt-16 border-t border-navy-100 bg-white">
      <div className="page-shell grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3 sm:col-span-2 lg:col-span-1">
          <BrandMark />
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            Pusat layanan digital laboratorium QC untuk dokumentasi internal dan pengajuan Purchase Request.
          </p>
        </div>

        <div>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-navy-400">
            Knowledge Center
          </h4>
          <ul className="space-y-2 text-sm text-navy-600">
            <li><Link to="/knowledge" className="hover:text-primary-700">Semua Dokumen</Link></li>
            <li><Link to="/knowledge?category=faq" className="hover:text-primary-700">FAQ</Link></li>
            <li><Link to="/knowledge?category=sop" className="hover:text-primary-700">SOP</Link></li>
            <li><Link to="/knowledge?category=troubleshooting" className="hover:text-primary-700">Troubleshooting</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-navy-400">
            Administration Center
          </h4>
          <ul className="space-y-2 text-sm text-navy-600">
            <li><Link to="/purchase-request" className="hover:text-primary-700">Buat Purchase Request</Link></li>
            <li><Link to="/tracking" className="hover:text-primary-700">Tracking Status</Link></li>
            <li><Link to="/admin/login" className="hover:text-primary-700">Admin Login</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-navy-400">Bantuan</h4>
          <ul className="space-y-2 text-sm text-navy-600">
            <li className="flex items-center gap-2"><FileSearch className="h-3.5 w-3.5 text-navy-400" /> Gunakan pencarian global</li>
            <li className="flex items-center gap-2"><ClipboardList className="h-3.5 w-3.5 text-navy-400" /> Simpan nomor referensi PR</li>
            <li className="flex items-center gap-2"><ChevronDown className="h-3.5 w-3.5 text-navy-400" /> Hubungi tim QC untuk kendala</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-navy-100">
        <div className="page-shell flex flex-col items-center justify-between gap-2 py-5 text-xs text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} QC Digital Service Portal. Internal use only.</p>
          <p>Laboratorium Quality Control · Versi 1.0</p>
        </div>
      </div>
    </footer>
  )
}
