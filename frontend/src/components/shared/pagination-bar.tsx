import { useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Pagination } from '@/types'

interface PaginationBarProps {
  pagination?: Pagination
  onPageChange: (page: number) => void
  className?: string
  itemLabel?: string
}

export function PaginationBar({
  pagination,
  onPageChange,
  className,
  itemLabel = 'data',
}: PaginationBarProps) {
  const pages = useMemo(() => {
    if (!pagination) return []
    const total = pagination.total_pages
    const current = pagination.page
    if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)

    const items: (number | 'ellipsis')[] = [1]
    const start = Math.max(2, current - 1)
    const end = Math.min(total - 1, current + 1)
    if (start > 2) items.push('ellipsis')
    for (let page = start; page <= end; page += 1) items.push(page)
    if (end < total - 1) items.push('ellipsis')
    items.push(total)
    return items
  }, [pagination])

  if (!pagination || pagination.total === 0) return null

  const from = (pagination.page - 1) * pagination.page_size + 1
  const to = Math.min(pagination.page * pagination.page_size, pagination.total)

  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between', className)}>
      <p className="text-xs text-muted-foreground sm:text-sm">
        Menampilkan <span className="font-semibold text-navy-800">{from}</span>–
        <span className="font-semibold text-navy-800">{to}</span> dari{' '}
        <span className="font-semibold text-navy-800">{pagination.total}</span> {itemLabel}
      </p>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange(pagination.page - 1)}
          disabled={pagination.page <= 1}
          aria-label="Halaman sebelumnya"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {pages.map((page, index) =>
          page === 'ellipsis' ? (
            <span key={`ellipsis-${index}`} className="px-1.5 text-sm text-navy-400">
              …
            </span>
          ) : (
            <Button
              key={page}
              variant={page === pagination.page ? 'default' : 'ghost'}
              size="icon-sm"
              onClick={() => onPageChange(page)}
              aria-current={page === pagination.page ? 'page' : undefined}
              className="min-w-8 tabular-nums"
            >
              {page}
            </Button>
          ),
        )}

        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange(pagination.page + 1)}
          disabled={pagination.page >= pagination.total_pages}
          aria-label="Halaman berikutnya"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
