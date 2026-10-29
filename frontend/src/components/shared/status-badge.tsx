import { cn } from '@/lib/utils'
import { STATUS_META, STATUS_FLOW, type PRStatus } from '@/lib/constants'

export function StatusBadge({
  status,
  className,
  compact = false,
}: {
  status: string
  className?: string
  compact?: boolean
}) {
  const meta = STATUS_META[status as PRStatus]
  if (!meta) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-navy-200 bg-navy-50 px-2.5 py-0.5 text-sm font-semibold text-navy-700',
          className,
        )}
      >
        {status}
      </span>
    )
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-sm font-semibold leading-6',
        meta.badge,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', meta.dot)} />
      {compact ? meta.short : meta.label}
    </span>
  )
}

export function ProgressBadge({ status, className }: { status: string; className?: string }) {
  const meta = STATUS_META[status as PRStatus]
  if (!meta) {
    return <StatusBadge status={status} className={className} compact />
  }

  const flowIndex = STATUS_FLOW.indexOf(status as PRStatus)
  const terminal = flowIndex === -1
  const progress = terminal
    ? 100
    : Math.round(((flowIndex + 1) / STATUS_FLOW.length) * 100)

  return (
    <div className={cn('min-w-[150px]', className)}>
      <StatusBadge status={status} compact />
      <div className="mt-2 flex items-center gap-2">
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-navy-100">
          <span
            className={cn(
              'block h-full rounded-full transition-all',
              terminal && status === 'done'
                ? 'bg-emerald-500'
                : terminal
                  ? 'bg-rose-500'
                  : 'bg-primary-500',
            )}
            style={{ width: `${progress}%` }}
          />
        </span>
        <span className="w-9 shrink-0 text-right text-sm font-medium tabular-nums text-navy-400">
          {terminal ? '—' : `${flowIndex + 1}/${STATUS_FLOW.length}`}
        </span>
      </div>
    </div>
  )
}

export function PublishBadge({ published }: { published: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-sm font-semibold',
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
