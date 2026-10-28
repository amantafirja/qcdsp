import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowUpRight,
  CalendarDays,
  ClipboardList,
  Copy,
  Download,
  Filter,
  GitMerge,
  Layers,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  useDeletePurchaseRequest,
  useMergePurchaseRequests,
  usePurchaseRequests,
} from '@/hooks/use-api'
import { apiGet } from '@/lib/api'
import { useAuth } from '@/contexts/auth-context'
import { canManagePurchaseRequest } from '@/lib/permissions'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { SearchInput } from '@/components/shared/search-input'
import { PaginationBar } from '@/components/shared/pagination-bar'
import { EmptyState, ErrorState } from '@/components/shared/empty-state'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ORDER_TYPES, PR_STATUSES, STATUS_META, isTerminalStatus, type PRStatus } from '@/lib/constants'
import { buildBulkCopyText, buildPRCopyText, copyText } from '@/lib/copy-pr'
import { formatDate } from '@/lib/format'
import { exportPurchaseRequestsToExcel } from '@/lib/export-excel'
import type { PurchaseRequest } from '@/types'

export function PurchaseRequestManagementPage() {
  useDocumentTitle('Purchase Request Management')
  const { admin } = useAuth()
  const canEdit = canManagePurchaseRequest(admin?.role)
  const [searchParams, setSearchParams] = useSearchParams()
  const [exporting, setExporting] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [mergeOpen, setMergeOpen] = useState(false)
  const [masterId, setMasterId] = useState('')
  const [memberIds, setMemberIds] = useState<string[]>([])
  const [deleteTarget, setDeleteTarget] = useState<PurchaseRequest | null>(null)

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

  const mergeMutation = useMergePurchaseRequests()
  const deleteMutation = useDeletePurchaseRequest()

  const mergeCandidatesQuery = usePurchaseRequests({ page: 1, page_size: 100 }, mergeOpen)
  const eligibleForMerge = (mergeCandidatesQuery.data?.requests ?? []).filter(
    (pr) => !pr.is_merged && !pr.is_master && !isTerminalStatus(pr.status),
  )

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

  const toggleSelected = (id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }

  const toggleAll = () => {
    setSelected((current) =>
      current.length === requests.length ? [] : requests.map((pr) => pr.id),
    )
  }

  const handleCopy = async (pr: PurchaseRequest) => {
    const ok = await copyText(buildPRCopyText(pr))
    if (ok) toast.success('Data PR berhasil disalin.')
    else toast.error('Gagal menyalin data PR')
  }

  const handleBulkCopy = async () => {
    const chosen = requests.filter((pr) => selected.includes(pr.id))
    if (chosen.length === 0) {
      toast.error('Pilih minimal satu PR terlebih dahulu')
      return
    }
    const ok = await copyText(buildBulkCopyText(chosen))
    if (ok) toast.success(`${chosen.length} data PR berhasil disalin.`)
    else toast.error('Gagal menyalin data PR')
  }

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

  const openMergeDialog = () => {
    setMasterId('')
    setMemberIds([])
    setMergeOpen(true)
  }

  const handleMerge = async () => {
    if (!masterId) {
      toast.error('Pilih PR Utama terlebih dahulu')
      return
    }
    if (memberIds.length === 0) {
      toast.error('Pilih minimal satu PR untuk digabungkan')
      return
    }
    try {
      await mergeMutation.mutateAsync({ masterId, memberIds })
      toast.success('Purchase Request berhasil digabungkan')
      setMergeOpen(false)
      setMasterId('')
      setMemberIds([])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menggabungkan PR')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteMutation.mutateAsync(deleteTarget.id)
      toast.success('Purchase Request berhasil dihapus')
      setDeleteTarget(null)
      setSelected((current) => current.filter((id) => id !== deleteTarget.id))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menghapus PR')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-navy-900">Purchase Request Management</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {canEdit
              ? 'Tinjau seluruh pengajuan PR, ubah progress, gabungkan PR, dan unduh lampiran.'
              : 'Lihat seluruh pengajuan PR dan unduh lampiran (mode read-only).'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {canEdit && (
            <Button variant="outline" onClick={openMergeDialog}>
              <GitMerge className="h-4 w-4" />
              Gabungkan PR
            </Button>
          )}
          <Button variant="outline" onClick={() => void handleBulkCopy()} disabled={selected.length === 0}>
            <Copy className="h-4 w-4" />
            Copy Selected {selected.length > 0 ? `(${selected.length})` : ''}
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
                placeholder="Cari nomor PR, pemesan, deskripsi, atau item..."
                syncUrlParam="search"
                defaultValue={search}
                isLoading={isFetching}
              />
            </div>

            <div className="flex flex-1 flex-col gap-2 sm:flex-row">
              <Select value={status} onValueChange={(value) => updateParam('status', value)}>
                <SelectTrigger className="h-10 w-full text-xs sm:w-[210px]">
                  <Filter className="mr-1 h-3.5 w-3.5 text-navy-400" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua status</SelectItem>
                  {PR_STATUSES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {STATUS_META[item].label}
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
                <span className="text-xs text-navy-400">-</span>
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
              {status !== 'all' && (
                <FilterChip
                  label={`Status: ${STATUS_META[status as PRStatus]?.label ?? status}`}
                  onRemove={() => updateParam('status')}
                />
              )}
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
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-navy-300 text-primary-600"
                        checked={selected.length === requests.length && requests.length > 0}
                        onChange={toggleAll}
                        aria-label="Pilih semua PR"
                      />
                    </TableHead>
                    <TableHead className="w-[130px]">Tanggal</TableHead>
                    <TableHead>Referensi & Pemesan</TableHead>
                    <TableHead className="min-w-[220px]">Item</TableHead>
                    <TableHead>Jenis</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Relasi PR</TableHead>
                    <TableHead className="w-28 text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((pr) => (
                    <TableRow key={pr.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-navy-300 text-primary-600"
                          checked={selected.includes(pr.id)}
                          onChange={() => toggleSelected(pr.id)}
                          aria-label={`Pilih ${pr.reference_number}`}
                        />
                      </TableCell>
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
                        <p className="line-clamp-2 text-xs leading-relaxed text-navy-700">
                          {pr.items.length > 0
                            ? pr.items.map((item) => item.item_name).join(', ')
                            : pr.description}
                        </p>
                        <p className="mt-0.5 text-[10px] text-navy-400">
                          {pr.items.length} item
                          {pr.items.length > 0 &&
                            ` · total ${pr.items.reduce((sum, item) => sum + item.quantity, 0)}`}
                        </p>
                      </TableCell>
                      <TableCell>
                        <span className="inline-block rounded-md bg-navy-50 px-2 py-0.5 text-[11px] font-medium text-navy-700">
                          {pr.order_type === 'Lain-Lain' ? pr.custom_order_type ?? pr.order_type : pr.order_type}
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={pr.status} />
                      </TableCell>
                      <TableCell className="text-center">
                        {pr.is_master ? (
                          <Badge variant="default">Utama ({pr.members.length})</Badge>
                        ) : pr.is_merged && pr.master ? (
                          <span className="font-mono text-[10px] text-navy-500">
                            {pr.master.reference_number}
                          </span>
                        ) : (
                          <span className="text-[10px] text-navy-300">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => void handleCopy(pr)}
                            aria-label={`Salin ${pr.reference_number}`}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon-sm" asChild aria-label="Buka detail">
                            <Link to={`/admin/purchase-requests/${pr.id}`}>
                              <ArrowUpRight className="h-4 w-4" />
                            </Link>
                          </Button>
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setDeleteTarget(pr)}
                              aria-label={`Hapus ${pr.reference_number}`}
                              className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="divide-y divide-border xl:hidden">
              {requests.map((pr) => (
                <div key={pr.id} className="p-4 transition-colors hover:bg-navy-50/40">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-navy-300 text-primary-600"
                      checked={selected.includes(pr.id)}
                      onChange={() => toggleSelected(pr.id)}
                      aria-label={`Pilih ${pr.reference_number}`}
                    />
                    <div className="min-w-0 flex-1">
                      <Link to={`/admin/purchase-requests/${pr.id}`} className="block">
                        <p className="font-mono text-[11px] font-semibold text-primary-700">
                          {pr.reference_number}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-sm font-medium text-navy-900">
                          {pr.items.length > 0
                            ? pr.items.map((item) => item.item_name).join(', ')
                            : pr.description}
                        </p>
                        <p className="mt-1 text-xs text-navy-400">
                          {pr.requester_name} · {formatDate(pr.created_at)}
                        </p>
                      </Link>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <StatusBadge status={pr.status} />
                        <span className="rounded-md bg-navy-50 px-2 py-0.5 text-[10px] font-medium text-navy-700">
                          {pr.order_type === 'Lain-Lain' ? pr.custom_order_type ?? pr.order_type : pr.order_type}
                        </span>
                        <span className="text-[10px] text-navy-400">{pr.items.length} item</span>
                        {pr.is_master && <Badge variant="default">PR Utama</Badge>}
                        {pr.is_merged && pr.master && (
                          <span className="font-mono text-[10px] text-navy-500">
                            ke {pr.master.reference_number}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex gap-1">
                        <Button variant="outline" size="sm" onClick={() => void handleCopy(pr)}>
                          <Copy className="h-3.5 w-3.5" />
                          Copy
                        </Button>
                        {canEdit && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeleteTarget(pr)}
                            className="text-rose-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Hapus
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
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
            <span className={`h-1.5 w-1.5 rounded-full ${STATUS_META[item].dot}`} />
            {STATUS_META[item].label}
          </span>
        ))}
      </div>

      <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Gabungkan Purchase Request</DialogTitle>
            <DialogDescription>
              Pilih satu PR Utama, lalu pilih PR lain yang akan digabungkan. Nomor PR Utama yang dipakai,
              dan PR anggota tetap tersimpan sebagai histori.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>PR Utama (Master)</Label>
              <Select
                value={masterId}
                onValueChange={(value) => {
                  setMasterId(value)
                  setMemberIds((current) => current.filter((id) => id !== value))
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih PR utama" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleForMerge.map((pr) => (
                    <SelectItem key={pr.id} value={pr.id}>
                      {pr.reference_number} - {pr.requester_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {mergeCandidatesQuery.isLoading && (
                <p className="field-hint">Memuat daftar PR...</p>
              )}
              {!mergeCandidatesQuery.isLoading && eligibleForMerge.length === 0 && (
                <p className="field-hint">
                  Tidak ada PR yang dapat digabungkan (sudah tergabung, menjadi master, atau berstatus akhir).
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>PR Anggota</Label>
              <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-lg border border-navy-100 p-2">
                {eligibleForMerge.filter((pr) => pr.id !== masterId).length === 0 && (
                  <p className="p-2 text-xs text-muted-foreground">Belum ada PR anggota yang tersedia.</p>
                )}
                {eligibleForMerge
                  .filter((pr) => pr.id !== masterId)
                  .map((pr) => (
                    <label
                      key={pr.id}
                      className="flex cursor-pointer items-start gap-2 rounded-md p-2 hover:bg-navy-50"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 rounded border-navy-300 text-primary-600"
                        checked={memberIds.includes(pr.id)}
                        onChange={() =>
                          setMemberIds((current) =>
                            current.includes(pr.id)
                              ? current.filter((id) => id !== pr.id)
                              : [...current, pr.id],
                          )
                        }
                      />
                      <span className="min-w-0">
                        <span className="block font-mono text-[11px] font-semibold text-navy-800">
                          {pr.reference_number}
                        </span>
                        <span className="block truncate text-xs text-navy-600">
                          {pr.items.map((item) => item.item_name).join(', ') || pr.description}
                        </span>
                      </span>
                    </label>
                  ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={() => void handleMerge()}
              loading={mergeMutation.isPending}
              disabled={!masterId || memberIds.length === 0}
            >
              <Layers className="h-4 w-4" />
              Gabungkan {memberIds.length > 0 ? `(${memberIds.length})` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Purchase Request?</AlertDialogTitle>
            <AlertDialogDescription>
              PR <span className="font-mono font-semibold">{deleteTarget?.reference_number}</span> akan
              dihapus secara soft delete. Nomor PR tidak digunakan kembali dan seluruh histori tetap
              tersimpan pada audit trail.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void handleDelete()
              }}
              disabled={deleteMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Menghapus...' : 'Hapus'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
