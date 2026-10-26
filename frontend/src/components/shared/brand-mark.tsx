import { Link } from 'react-router-dom'
import { ClipboardList, FileText, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

export function BrandMark({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <Link to="/" className={cn('group flex items-center gap-2.5', className)}>
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-700 text-white shadow-sm ring-1 ring-primary-900/10">
        <FileText className="h-[18px] w-[18px]" />
        <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white">
          <Search className="h-2 w-2 text-white" />
        </span>
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block text-[15px] font-bold tracking-tight text-navy-900">QC Digital</span>
          <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-navy-400">
            Service Portal
          </span>
        </span>
      )}
    </Link>
  )
}

export function BrandMarkLight({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn('flex items-center gap-2.5', className)}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white ring-1 ring-white/20">
        <ClipboardList className="h-[18px] w-[18px]" />
      </span>
      <span className="leading-tight">
        <span className="block text-[15px] font-bold tracking-tight text-white">QC Digital</span>
        <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-navy-300">
          Service Portal
        </span>
      </span>
    </Link>
  )
}
