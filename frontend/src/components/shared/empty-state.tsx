import { AlertCircle, FileQuestion, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  title: string
  description?: string
  action?: React.ReactNode
  icon?: React.ReactNode
  className?: string
}

export function EmptyState({ title, description, action, icon, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-navy-200 bg-white/60 px-6 py-14 text-center',
        className,
      )}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-navy-50 text-navy-400">
        {icon ?? <FileQuestion className="h-6 w-6" />}
      </div>
      <h3 className="text-base font-semibold text-navy-900">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({
  message = 'Gagal memuat data. Silakan coba lagi.',
  onRetry,
}: {
  message?: string
  onRetry?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-rose-100 bg-rose-50/50 px-6 py-12 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-rose-100 text-rose-600">
        <AlertCircle className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium text-rose-800">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" />
          Coba lagi
        </Button>
      )}
    </div>
  )
}

export function LoadingCards({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="surface-card overflow-hidden">
          <div className="skeleton h-36 w-full rounded-none" />
          <div className="space-y-3 p-4">
            <div className="skeleton h-3 w-20" />
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-2/3" />
            <div className="skeleton h-3 w-full" />
            <div className="skeleton h-3 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  )
}
