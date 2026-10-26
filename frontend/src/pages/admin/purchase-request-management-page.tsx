import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowUpRight,
  CalendarDays,
  ClipboardList,
  Download,
  FileText,
  Filter,
  RefreshCw,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { usePurchaseRequests } from '@/hooks/use-api'
import { apiGet } from '@/lib/api'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { SearchInput } from '@/components/shared/search-input'
import { PaginationBar } from '@/components/shared/pagination-bar'
import { EmptyState, ErrorState } from '@/components/shared/empty-state'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ORDER_TYPES, PR_STATUSES, STATUS_META, type PRStatus } from '@/lib/constants'
import { formatDate } from '@/lib/format'
import { exportPurchaseRequestsToExcel } from '@/lib/export-excel'

export function PurchaseRequestManagementPage() {
  useDocumentTitle('Purchase Request Management')
  const [searchParams, setSearchParams] = useSearchParams()
  const [exporting, setExporting] = useState(false)

  const search = searchParams.get('search') ?? ''
  const status = searchParams.get('status') ?? 'all'
  const orderType = searchParams.get('order_type') ?? 'all'
  const dateFrom = searchParams.get('date_from') ?? ''
  const dateTo = searchParams.get('date_to') ?? ''
  const page = Number(searchParams.get('page') ?? 1)

  const query = useMemo(
    () => ({
      search,
      status: status === 'all' ? undefined : status,
      order_type: orderType === 'all' ? undefined : orderType,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      page,
      page_size: 10,
    }),
    [search, status, orderType, dateFrom, dateTo, page],
  )

  const { data, isLoading, isError, refetch, isFetching } = usePurchaseRequests(query)
  const requests = data?.requests ?? []

  const updateParam = (key: string, value?: string) => {
    const params = new URLSearchParams(searchParams)
    if (value && value !== 'all') params.set(key, value)
    else params.delete(key)
    if (key !== 'page') params.delete('page')
    setSearchParams(params, { replace: true })
  }

  const resetFilters = () => setSearchParams({}, { replace: true })

  const activeFilterCount = [search, status !== 'all' ? status : '', orderType !== 'all' ? orderType : '', dateFrom, dateTo].filter(
    Boolean,
  ).length

  const handleExport = async () => {
    if (requests.length === 0) {
      toast.error('Tidak ada data untuk diexport pada filter saat ini')
      return
    }
    setExporting(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (status !== 'all') params.set('status', status)
      if (orderType !== 'all') params.set('order_type', orderType)
      if (dateFrom) params.set('date_from', dateFrom)
      if (dateTo) params.set('date_to', dateTo)
      params.set('page', '1')
      params.set('page_size', '100')

      const response = await apiGet<typeof requests>(`/admin/purchase-requests?${params.toString()}`)
      const rows = response.data ?? requests
      exportPurchaseRequestsToExcel(rows)
      toast.success(`${rows.length} data berhasil diexport ke Excel`)
    } catch {
      toast.error('Gagal mengexport data')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-navy-900">Purchase Request Management</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Tinjau seluruh pengajuan PR, ubah status, dan unduh lampiran.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => void handleExport()} loading={exporting}>
            {!exporting && <Download className="h-4 w-4" />}
            Export Excel
          </Button>
        </div>
      </div>

      <div className="surface-card">
        <div className="space-y-3 border-b border-border p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="w-full lg:max-w-sm">
              <SearchInput
                placeholder="Cari referensi, pemesan, deskripsi, brand..."
                syncUrlParam="search"
                defaultValue={search}
                isLoading={isFetching}
              />
            </div>

            <div className="flex flex-1 flex-col gap-2 sm:flex-row">
              <Select value={status} onValueChange={(value) => updateParam('status', value)}>
                <SelectTrigger className="h-10 w-full text-xs sm:w-[150px]">
                  <Filter className="mr-1 h-3.5 w-3.5 text-navy-400" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua status</SelectItem>
                  {PR_STATUSES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={orderType} onValueChange={(value) => updateParam('order_type', value)}>
                <SelectTrigger className="h-10 w-full text-xs sm:w-[170px]">
                  <SelectValue placeholder="Jenis pemesanan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua jenis</SelectItem>
                  {ORDER_TYPES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-1.5">
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => updateParam('date_from', event.target.value)}
                  className="h-10 w-full text-xs sm:w-[140px]"
                  aria-label="Dari tanggal"
                />
                <span className="text-xs text-navy-400">—</span>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(event) => updateParam('date_to', event.target.value)}
                  className="h-10 w-full text-xs sm:w-[140px]"
                  aria-label="Sampai tanggal"
                />
              </div>
            </div>
          </div>

          {activeFilterCount > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">{activeFilterCount} filter aktif:</span>
              {search && <FilterChip label={`Pencarian: ${search}`} onRemove={() => updateParam('search')} />}
              {status !== 'all' && <FilterChip label={`Status: ${status}`} onRemove={() => updateParam('status')} />}
              {orderType !== 'all' && (
                <FilterChip label={`Jenis: ${orderType}`} onRemove={() => updateParam('order_type')} />
              )}
              {dateFrom && <FilterChip label={`Dari: ${dateFrom}`} onRemove={() => updateParam('date_from')} />}
              {dateTo && <FilterChip label={`Sampai: ${dateTo}`} onRemove={() => updateParam('date_to')} />}
              <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={resetFilters}>
                Reset semua
              </Button>
            </div>
          )}
        </div>

        {isError ? (
          <div className="p-4">
            <ErrorState message="Gagal memuat Purchase Request." onRetry={() => void refetch()} />
          </div>
        ) : isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="skeleton h-16 w-full" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="Tidak ada Purchase Request"
              description="Belum ada pengajuan yang sesuai dengan filter saat ini."
              icon={<ClipboardList className="h-6 w-6" />}
              action={
                activeFilterCount > 0 ? (
                  <Button variant="outline" size="sm" onClick={resetFilters}>
                    Reset filter
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <>
            <div className="hidden xl:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Tanggal</TableHead>
                    <TableHead>Referensi & Pemesan</TableHead>
                    <TableHead className="min-w-[240px]">Deskripsi</TableHead>
                    <TableHead>Jenis</TableHead>
                    <TableHead>Brand / Katalog</TableHead>
                    <TableHead className="text-center">Jumlah</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Lampiran</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((pr) => (
                    <TableRow key={pr.id}>
                      <TableCell className="whitespace-nowrap text-xs text-navy-600">
                        {formatDate(pr.created_at, 'dd MMM yyyy')}
                        <span className="block text-[10px] text-navy-400">
                          {formatDate(pr.created_at, 'HH:mm')}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Link
                          to={`/admin/purchase-requests/${pr.id}`}
                          className="font-mono text-[11px] font-semibold text-primary-700 hover:underline"
                        >
                          {pr.reference_number}
                        </Link>
                        <p className="mt-0.5 text-xs font-medium text-navy-900">{pr.requester_name}</p>
                      </TableCell>
                      <TableCell className="max-w-[320px]">
                        <p className="line-clamp-2 text-xs leading-relaxed text-navy-700">{pr.description}</p>
                      </TableCell>
                      <TableCell>
                        <span className="inline-block rounded-md bg-navy-50 px-2 py-0.5 text-[11px] font-medium text-navy-700">
                          {pr.order_type === 'Lain-Lain' ? pr.custom_order_type ?? pr.order_type : pr.order_type}
                        </span>
                      </TableCell>
                      <TableCell>
                        <p className="max-w-[160px] truncate text-xs text-navy-700">{pr.brand_catalog}</p>
                      </TableCell>
                      <TableCell className="text-center text-xs font-semibold tabular-nums text-navy-800">
                        {pr.quantity}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={pr.status} />
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{(pr.attachments ?? []).length}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon-sm" asChild aria-label="Buka detail">
                          <Link to={`/admin/purchase-requests/${pr.id}`}>
                            <ArrowUpRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="divide-y divide-border xl:hidden">
              {requests.map((pr) => (
                <Link
                  key={pr.id}
                  to={`/admin/purchase-requests/${pr.id}`}
                  className="block p-4 transition-colors hover:bg-navy-50/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] font-semibold text-primary-700">
                        {pr.reference_number}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-sm font-medium text-navy-900">{pr.description}</p>
                      <p className="mt-1 text-xs text-navy-400">
                        {pr.requester_name} · {formatDate(pr.created_at)}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className="rounded-md bg-navy-50 px-2 py-0.5 text-[10px] font-medium text-navy-700">
                          {pr.order_type === 'Lain-Lain' ? pr.custom_order_type ?? pr.order_type : pr.order_type}
                        </span>
                        <span className="text-[10px] text-navy-400">{pr.brand_catalog}</span>
                        <span className="text-[10px] text-navy-400">· Qty {pr.quantity}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <StatusBadge status={pr.status} />
                      <span className="inline-flex items-center gap-1 text-[10px] text-navy-400">
                        <FileText className="h-3 w-3" />
                        {(pr.attachments ?? []).length}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <div className="border-t border-border p-4">
              <PaginationBar
                pagination={data?.pagination}
                itemLabel="pengajuan"
                onPageChange={(nextPage) => updateParam('page', String(nextPage))}
              />
            </div>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-navy-100 bg-white p-3">
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-navy-500">
          <CalendarDays className="h-3.5 w-3.5 text-navy-400" />
          Keterangan status:
        </span>
        {PR_STATUSES.map((item) => (
          <span key={item} className="flex items-center gap-1 text-[11px] text-navy-500">
            <span className={`h-1.5 w-1.5 rounded-full ${STATUS_META[item as PRStatus].dot}`} />
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-navy-200 bg-navy-50 py-0.5 pl-2.5 pr-1 text-[11px] font-medium text-navy-700">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full p-0.5 text-navy-400 hover:bg-navy-200 hover:text-navy-700"
        aria-label={`Hapus filter ${label}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}
