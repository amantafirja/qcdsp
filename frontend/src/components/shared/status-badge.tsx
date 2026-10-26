import { cn } from '@/lib/utils'
import { STATUS_META, type PRStatus } from '@/lib/constants'

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const meta = STATUS_META[status as PRStatus]
  if (!meta) {
    return (
      <span className={cn('inline-flex items-center gap-1.5 rounded-full border border-navy-200 bg-navy-50 px-2.5 py-0.5 text-xs font-semibold text-navy-700', className)}>
        {status}
      </span>
    )
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        meta.badge,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </span>
  )
}

export function PublishBadge({ published }: { published: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        published
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-amber-200 bg-amber-50 text-amber-700',
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', published ? 'bg-emerald-500' : 'bg-amber-500')} />
      {published ? 'Published' : 'Draft'}
    </span>
  )
}
