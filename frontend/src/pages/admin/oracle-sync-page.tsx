import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CloudUpload,
  Database,
  Download,
  FileSpreadsheet,
  History,
  Info,
  Layers,
  ListChecks,
  Loader2,
  RefreshCw,
  Trash2,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  useClearOracle,
  useOracleStatus,
  useSyncOracle,
  useUploadOracle,
} from '@/hooks/use-api'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useAuth } from '@/contexts/auth-context'
import { canManagePurchaseRequest } from '@/lib/permissions'
import { downloadProtectedFile } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { EmptyState, ErrorState } from '@/components/shared/empty-state'
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
import { formatDateTime, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { OraclePO, OracleRow, OracleSyncResult } from '@/types'

const SYNC_STATUS_META: Record<string, { label: string; className: string }> = {
  belum_po: { label: 'Belum PO', className: 'border-slate-200 bg-slate-100 text-slate-700' },
  sudah_po: { label: 'Sudah PO', className: 'border-sky-200 bg-sky-50 text-sky-700' },
  sync_berhasil: { label: 'Sync Berhasil', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  tidak_ditemukan: { label: 'Tidak Ditemukan', className: 'border-rose-200 bg-rose-50 text-rose-700' },
  perlu_ditinjau: { label: 'Perlu Ditinjau', className: 'border-amber-200 bg-amber-50 text-amber-700' },
}

type FilterKey = 'all' | 'matched' | 'not_found' | 'duplicate' | 'review'

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'Semua' },
  { key: 'matched', label: 'Ditemukan' },
  { key: 'not_found', label: 'Tidak Ditemukan' },
  { key: 'duplicate', label: 'Duplikat' },
  { key: 'review', label: 'Perlu Ditinjau' },
]

export function OracleSyncPage() {
  useDocumentTitle('Oracle Sync')
  const { admin } = useAuth()
  const canManage = canManagePurchaseRequest(admin?.role)
  const { data, isLoading, isError, refetch, isFetching } = useOracleStatus()
  const uploadMutation = useUploadOracle()
  const syncMutation = useSyncOracle()
  const clearMutation = useClearOracle()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [search, setSearch] = useState('')
  const [result, setResult] = useState<OracleSyncResult | null>(null)
  const [resultOpen, setResultOpen] = useState(false)
  const [poDetail, setPODetail] = useState<OracleRow | null>(null)
  const [clearOpen, setClearOpen] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)

  const rows = data?.rows ?? []

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (keyword) {
        const haystack = `${row.pr_number} ${row.po_number ?? ''} ${row.item_summary ?? ''}`.toLowerCase()
        if (!haystack.includes(keyword)) return false
      }
      switch (filter) {
        case 'matched':
          return row.matched_pr_id !== null
        case 'not_found':
          return row.matched_pr_id === null
        case 'duplicate':
          return row.duplicate_lines > 0
        case 'review':
          return row.needs_review
        default:
          return true
      }
    })
  }, [rows, filter, search])

  const handleUpload = async (sync: boolean) => {
    if (!selectedFile) {
      toast.error('Pilih file Oracle terlebih dahulu')
      return
    }
    try {
      const output = await uploadMutation.mutateAsync({ file: selectedFile, sync })
      if (sync) {
        const syncResult = output as OracleSyncResult
        setResult(syncResult)
        setResultOpen(true)
        toast.success(
          `Upload & sync selesai: ${syncResult.updated} PR diperbarui, ${syncResult.not_found} tidak ditemukan`,
        )
      } else {
        toast.success('File Oracle berhasil diunggah. Klik "Sync Ulang" untuk memperbarui data PR.')
      }
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal mengunggah file Oracle')
    }
  }

  const handleSync = async () => {
    try {
      const syncResult = await syncMutation.mutateAsync()
      setResult(syncResult)
      setResultOpen(true)
      toast.success(`Sinkronisasi selesai: ${syncResult.updated} PR diperbarui`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal sinkronisasi Oracle')
    }
  }

  const handleDownload = async (logId: string) => {
    setDownloading(logId)
    try {
      await downloadProtectedFile(`/api/admin/oracle/logs/${logId}/download`)
      toast.success('Hasil sinkronisasi berhasil diunduh')
    } catch {
      toast.error('Gagal mengunduh hasil sinkronisasi')
    } finally {
      setDownloading(null)
    }
  }

  const handleClear = async () => {
    try {
      await clearMutation.mutateAsync()
      toast.success('Data Oracle berhasil dihapus')
      setClearOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menghapus data Oracle')
    }
  }

  const lastImport = data?.last_import

  const statCards = [
    { label: 'Total Baris Oracle', value: data?.total_rows ?? 0, icon: FileSpreadsheet, tone: 'bg-primary-50 text-primary-700' },
    { label: 'Total No PR Unik', value: data?.total_pr ?? 0, icon: ListChecks, tone: 'bg-sky-50 text-sky-700' },
    { label: 'PR Ditemukan', value: data?.matched_count ?? 0, icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-700' },
    { label: 'Tidak Ditemukan', value: data?.unmatched_count ?? 0, icon: XCircle, tone: 'bg-rose-50 text-rose-700' },
    { label: 'Duplikat Diabaikan', value: data?.duplicate_rows ?? 0, icon: Layers, tone: 'bg-violet-50 text-violet-700' },
    { label: 'Multi Line', value: data?.multi_line_prs ?? 0, icon: Database, tone: 'bg-teal-50 text-teal-700' },
    { label: 'Multi PO', value: data?.multi_po_prs ?? 0, icon: Layers, tone: 'bg-indigo-50 text-indigo-700' },
    { label: 'Perlu Ditinjau', value: data?.needs_review_prs ?? 0, icon: AlertTriangle, tone: 'bg-amber-50 text-amber-700' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-navy-900">Oracle Sync</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Unggah hasil export Oracle untuk melengkapi Tanggal PO, No PO, Harga, dan Tanggal Estimasi Datang
            pada Purchase Request yang sudah ada.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
            Muat ulang
          </Button>
          <Button onClick={() => void handleSync()} loading={syncMutation.isPending} disabled={!canManage || !lastImport}>
            {!syncMutation.isPending && <RefreshCw className="h-4 w-4" />}
            Sync Ulang
          </Button>
        </div>
      </div>

      {isError && <ErrorState message="Gagal memuat data Oracle." onRetry={() => void refetch()} />}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="surface-card p-5 sm:p-6">
          <h3 className="section-title">Upload File Oracle</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Format didukung: <span className="font-medium text-navy-700">.xlsx</span> dan{' '}
            <span className="font-medium text-navy-700">.xls</span> (hasil export Oracle BI Publisher).
            Maksimal 25 MB.
          </p>

          <div className="mt-4 space-y-1.5">
            <Label htmlFor="oracle-file">File Oracle</Label>
            <Input
              id="oracle-file"
              ref={fileInputRef}
              type="file"
              accept=".xls,.xlsx,.xlsm"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              className="cursor-pointer file:mr-3 file:rounded-md file:border-0 file:bg-primary-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-700"
            />
            {selectedFile && (
              <p className="text-sm text-navy-600">
                Dipilih: <span className="font-medium">{selectedFile.name}</span>{' '}
                ({formatNumber(Math.round(selectedFile.size / 1024))} KB)
              </p>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={() => void handleUpload(true)}
              loading={uploadMutation.isPending}
              disabled={!canManage || !selectedFile}
              className="sm:flex-1"
            >
              {!uploadMutation.isPending && <CloudUpload className="h-4 w-4" />}
              Upload &amp; Sync
            </Button>
            <Button
              variant="outline"
              onClick={() => void handleUpload(false)}
              loading={uploadMutation.isPending}
              disabled={!canManage || !selectedFile}
              className="sm:flex-1"
            >
              Upload Saja
            </Button>
            {lastImport && (
              <Button variant="ghost" onClick={() => setClearOpen(true)} className="text-rose-600">
                <Trash2 className="h-4 w-4" />
                Hapus Data
              </Button>
            )}
          </div>

          {lastImport && (
            <div className="mt-5 rounded-xl bg-navy-50/60 p-4">
              <p className="text-sm font-semibold text-navy-900">Upload terakhir</p>
              <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-navy-400">Nama file</dt>
                  <dd className="break-all font-medium text-navy-800">{lastImport.file_name}</dd>
                </div>
                <div>
                  <dt className="text-navy-400">Waktu upload</dt>
                  <dd className="font-medium text-navy-800">{formatDateTime(lastImport.created_at)}</dd>
                </div>
                <div>
                  <dt className="text-navy-400">Diunggah oleh</dt>
                  <dd className="font-medium text-navy-800">{lastImport.uploaded_by_name || '-'}</dd>
                </div>
                <div>
                  <dt className="text-navy-400">Sinkronisasi terakhir</dt>
                  <dd className="font-medium text-navy-800">
                    {lastImport.synced_at ? formatDateTime(lastImport.synced_at) : 'Belum pernah'}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          <Alert variant="info" className="mt-4">
            <Info className="h-4 w-4" />
            <AlertTitle>Aturan sinkronisasi</AlertTitle>
            <AlertDescription>
              Pencocokan hanya memakai <strong>No PR</strong> (dinormalisasi: spasi, tanda petik, karakter
              tersembunyi, dan huruf besar/kecil). Sistem tidak membuat PR baru dan tidak menghapus PR yang ada.
              No PO kosong → status Pending PO; No PO terisi → PO Approve.
            </AlertDescription>
          </Alert>
        </section>

        <aside className="space-y-5">
          <div className="surface-card p-5">
            <h3 className="section-title">Ringkasan</h3>
            <dl className="mt-3 space-y-2.5 text-sm">
              <SummaryRow label="PR dengan PO" value={formatNumber(data?.with_po ?? 0)} />
              <SummaryRow label="PR tanpa PO" value={formatNumber(data?.without_po ?? 0)} />
              <SummaryRow label="Total nilai PO" value={`Rp ${formatNumber(data?.total_value ?? 0)}`} />
              <SummaryRow label="Jumlah sync" value={formatNumber(lastImport?.sync_count ?? 0)} />
            </dl>
          </div>

          <div className="surface-card p-5">
            <h3 className="section-title flex items-center gap-2">
              <History className="h-4 w-4 text-navy-400" />
              Riwayat Sinkronisasi
            </h3>
            <div className="mt-3 space-y-2">
              {(data?.sync_logs ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">Belum ada riwayat sinkronisasi.</p>
              )}
              {(data?.sync_logs ?? []).slice(0, 6).map((log) => (
                <div key={log.id} className="rounded-lg border border-navy-100 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-navy-900">{log.file_name}</p>
                      <p className="text-sm text-navy-500">{formatDateTime(log.started_at)}</p>
                      <p className="text-sm text-navy-500">
                        {log.matched} ditemukan · {log.updated} diperbarui · {log.not_found} tidak ditemukan
                      </p>
                      <p className="text-sm text-navy-400">oleh {log.actor_name || 'Sistem'}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => void handleDownload(log.id)}
                      disabled={downloading === log.id}
                      aria-label="Unduh hasil sinkronisasi"
                    >
                      {downloading === log.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <div key={card.label} className="surface-card flex items-center gap-3 p-4">
            <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', card.tone)}>
              <card.icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-navy-500">{card.label}</p>
              <p className="text-xl font-bold tabular-nums text-navy-900">{formatNumber(card.value)}</p>
            </div>
          </div>
        ))}
      </div>

      <section className="surface-card">
        <div className="space-y-3 border-b border-border/70 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="section-title">Data Oracle</h3>
            <div className="w-full sm:max-w-xs">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari No PR, No PO, atau item..."
                className="h-10"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((item) => {
              const count =
                item.key === 'all'
                  ? rows.length
                  : item.key === 'matched'
                    ? rows.filter((row) => row.matched_pr_id !== null).length
                    : item.key === 'not_found'
                      ? rows.filter((row) => row.matched_pr_id === null).length
                      : item.key === 'duplicate'
                        ? rows.filter((row) => row.duplicate_lines > 0).length
                        : rows.filter((row) => row.needs_review).length
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setFilter(item.key)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                    filter === item.key
                      ? 'border-primary-200 bg-primary-50 text-primary-800'
                      : 'border-navy-200 bg-white text-navy-600 hover:bg-navy-50',
                  )}
                >
                  {item.label} ({count})
                </button>
              )
            })}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="skeleton h-16 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="Belum ada data Oracle"
              description="Unggah file hasil export Oracle untuk mulai sinkronisasi data purchasing."
              icon={<FileSpreadsheet className="h-6 w-6" />}
            />
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="p-4">
            <EmptyState title="Tidak ada data" description="Tidak ada baris yang sesuai filter." />
          </div>
        ) : (
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[190px]">PR No (Oracle)</TableHead>
                <TableHead className="min-w-[190px]">No PO</TableHead>
                <TableHead>Tanggal PO</TableHead>
                <TableHead className="text-right">Harga</TableHead>
                <TableHead>Est. Datang</TableHead>
                <TableHead className="text-center">Baris</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">PR Web</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.slice(0, 200).map((row) => {
                const meta = SYNC_STATUS_META[row.sync_status ?? 'belum_po'] ?? SYNC_STATUS_META.belum_po
                const poList = (row.po_list ?? []) as OraclePO[]
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-sm font-semibold text-navy-900">{row.pr_number}</TableCell>
                    <TableCell>
                      {row.po_number ? (
                        <button
                          type="button"
                          onClick={() => setPODetail(row)}
                          className="text-left font-mono text-sm font-medium text-primary-700 hover:underline"
                        >
                          {row.po_number}
                          {poList.length > 1 && (
                            <span className="ml-1 text-navy-500">(+{poList.length - 1} PO lainnya)</span>
                          )}
                        </button>
                      ) : (
                        <span className="text-sm text-navy-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-navy-700">
                      {row.po_date ? row.po_date.slice(0, 10) : '-'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right text-sm tabular-nums text-navy-800">
                      {row.total_value != null ? formatNumber(row.total_value) : '-'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-navy-700">
                      {row.delivery_date ? row.delivery_date.slice(0, 10) : '-'}
                    </TableCell>
                    <TableCell className="text-center text-sm text-navy-600">{row.line_count}</TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full border px-2.5 py-0.5 text-sm font-semibold',
                          meta.className,
                        )}
                      >
                        {meta.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {row.matched_pr_id ? (
                        <Link
                          to={`/admin/purchase-requests/${row.matched_pr_id}`}
                          className="inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline"
                        >
                          Buka PR
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      ) : (
                        <span className="text-sm text-navy-400">Tidak ada</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </section>

      <Dialog open={resultOpen} onOpenChange={setResultOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Hasil Sinkronisasi</DialogTitle>
            <DialogDescription>
              {lastImport?.file_name ? `File: ${lastImport.file_name}` : 'Ringkasan proses sinkronisasi Oracle.'}
            </DialogDescription>
          </DialogHeader>
          {result && (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <ResultItem label="PR ditemukan" value={result.matched} tone="text-emerald-700" />
              <ResultItem label="PR diperbarui" value={result.updated} tone="text-emerald-700" />
              <ResultItem label="Tidak ditemukan" value={result.not_found} tone="text-rose-700" />
              <ResultItem label="Status berubah" value={result.status_changed} tone="text-primary-700" />
              <ResultItem label="Multi PO" value={result.multi_po} tone="text-indigo-700" />
              <ResultItem label="Perlu ditinjau" value={result.needs_review} tone="text-amber-700" />
              <ResultItem label="Dilewati (manual)" value={result.skipped_manual} tone="text-navy-700" />
              <ResultItem label="Dilewati (final)" value={result.skipped_terminal} tone="text-navy-700" />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setResultOpen(false)}>
              Tutup
            </Button>
            <Button
              onClick={() => {
                const log = data?.sync_logs?.[0]
                if (log) void handleDownload(log.id)
              }}
              disabled={!data?.sync_logs?.length}
            >
              <Download className="h-4 w-4" />
              Download Hasil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(poDetail)} onOpenChange={(open) => !open && setPODetail(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Daftar PO - {poDetail?.pr_number}</DialogTitle>
            <DialogDescription>
              Satu PR dapat memiliki beberapa PO. Harga total dihitung dari seluruh PO valid.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {((poDetail?.po_list ?? []) as OraclePO[]).map((po) => (
              <div key={po.po_number || 'tanpa-po'} className="rounded-lg border border-navy-100 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-sm font-semibold text-navy-900">{po.po_number || '(tanpa PO)'}</p>
                  <Badge variant="secondary">{po.line_count} baris</Badge>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-1.5 text-sm">
                  <div>
                    <dt className="text-navy-400">Tanggal PO</dt>
                    <dd className="text-navy-800">{po.po_date ? po.po_date.slice(0, 10) : '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-navy-400">Est. datang</dt>
                    <dd className="text-navy-800">{po.delivery_date ? po.delivery_date.slice(0, 10) : '-'}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-navy-400">Harga</dt>
                    <dd className="font-medium text-navy-900">
                      {po.total_value != null ? `Rp ${formatNumber(po.total_value)}` : '-'}
                    </dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPODetail(null)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus data Oracle?</AlertDialogTitle>
            <AlertDialogDescription>
              Dataset Oracle hasil upload terakhir akan dihapus. Data Purchase Request yang sudah tersinkronisasi
              tidak dihapus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearMutation.isPending}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void handleClear()
              }}
              disabled={clearMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {clearMutation.isPending ? 'Menghapus...' : 'Hapus'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-navy-500">{label}</dt>
      <dd className="font-semibold text-navy-900">{value}</dd>
    </div>
  )
}

function ResultItem({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg bg-navy-50/60 p-2.5">
      <p className="text-navy-500">{label}</p>
      <p className={cn('text-lg font-bold tabular-nums', tone)}>{formatNumber(value)}</p>
    </div>
  )
}
