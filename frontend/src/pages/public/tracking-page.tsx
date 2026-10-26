import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  Check,
  Clock,
  Download,
  FileText,
  Info,
  Package,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'
import { trackPurchaseRequest } from '@/hooks/use-api'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { StatusBadge } from '@/components/shared/status-badge'
import { ErrorState } from '@/components/shared/empty-state'
import { PR_STATUSES, STATUS_FLOW, STATUS_META, type PRStatus } from '@/lib/constants'
import { formatDateTime, formatFileSize } from '@/lib/format'
import { resolveApiUrl } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { PurchaseRequest } from '@/types'

export function TrackingPage() {
  useDocumentTitle('Tracking Purchase Request')
  const [searchParams] = useSearchParams()
  const [reference, setReference] = useState(searchParams.get('ref') ?? '')
  const [result, setResult] = useState<PurchaseRequest | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inputError, setInputError] = useState<string | null>(null)

  const lookup = useCallback(async (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) {
      setInputError('Nomor referensi wajib diisi')
      return
    }
    setInputError(null)
    setLoading(true)
    setError(null)
    try {
      const data = await trackPurchaseRequest(trimmed)
      setResult(data)
    } catch (lookupError) {
      setResult(null)
      const message =
        lookupError instanceof Error ? lookupError.message : 'Nomor referensi tidak ditemukan'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const ref = searchParams.get('ref')
    if (ref) {
      setReference(ref)
      void lookup(ref)
    }
  }, [searchParams, lookup])

  return (
    <div>
      <section className="border-b border-navy-100 bg-white">
        <div className="page-shell py-8 sm:py-10">
          <Badge variant="info" className="mb-3">
            <Search className="h-3 w-3" />
            Tracking Status
          </Badge>
          <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
            Lacak Purchase Request
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Masukkan nomor referensi pengajuan (contoh: PR-20260601-0001) untuk melihat status terkini dan
            riwayat proses tanpa login.
          </p>

          <form
            onSubmit={(event) => {
              event.preventDefault()
              void lookup(reference)
            }}
            className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-start"
          >
            <div className="w-full max-w-md space-y-1.5">
              <Label htmlFor="reference" className="sr-only">
                Nomor referensi
              </Label>
              <Input
                id="reference"
                value={reference}
                onChange={(event) => {
                  setReference(event.target.value)
                  setInputError(null)
                }}
                placeholder="PR-20260601-0001"
                className="h-11 font-mono uppercase"
                aria-invalid={Boolean(inputError)}
              />
              {inputError && <p className="field-error">{inputError}</p>}
            </div>
            <Button type="submit" size="lg" loading={loading} className="sm:w-auto">
              {!loading && <Search className="h-4 w-4" />}
              Cek Status
            </Button>
            {result && (
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => void lookup(reference)}
                disabled={loading}
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            )}
          </form>
        </div>
      </section>

      <div className="page-shell py-6 sm:py-8">
        {error && (
          <div className="mx-auto max-w-2xl">
            <ErrorState
              message={error}
              onRetry={() => {
                void lookup(reference)
              }}
            />
            <div className="mt-4 text-center">
              <Button asChild variant="outline" size="sm">
                <Link to="/purchase-request">Buat Purchase Request baru</Link>
              </Button>
            </div>
          </div>
        )}

        {!error && !result && (
          <div className="mx-auto max-w-2xl">
            <div className="surface-card p-6 sm:p-8">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
                  <Info className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-navy-900">Cara tracking pengajuan</h2>
                  <ol className="mt-2 space-y-1.5 text-sm leading-relaxed text-muted-foreground">
                    <li>1. Gunakan nomor referensi yang ditampilkan setelah submit PR.</li>
                    <li>2. Nomor referensi berformat PR-YYYYMMDD-XXXX.</li>
                    <li>3. Masukkan nomor pada kolom di atas lalu klik Cek Status.</li>
                    <li>4. Hubungi tim pengadaan jika status tidak berubah lebih dari 3 hari kerja.</li>
                  </ol>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {PR_STATUSES.map((status) => (
                  <div key={status} className="rounded-lg border border-navy-100 bg-navy-50/40 p-2.5 text-center">
                    <span className={cn('mx-auto mb-1.5 block h-1.5 w-6 rounded-full', STATUS_META[status].dot)} />
                    <p className="text-[11px] font-semibold text-navy-700">{status}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {result && (
          <div className="mx-auto max-w-4xl space-y-5">
            <div className="surface-card overflow-hidden">
              <div className="flex flex-col gap-4 border-b border-navy-100 bg-navy-50/40 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-navy-400">Nomor Referensi</p>
                  <p className="mt-0.5 font-mono text-lg font-bold text-navy-900">{result.reference_number}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Diajukan {formatDateTime(result.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={result.status} className="px-3 py-1 text-sm" />
                </div>
              </div>

              <div className="p-5">
                <StatusTimeline status={result.status} />

                <dl className="mt-6 grid gap-4 border-t border-navy-100 pt-5 text-sm sm:grid-cols-2">
                  <DetailRow label="Pemesan" value={result.requester_name} />
                  <DetailRow
                    label="Jenis Pemesanan"
                    value={result.order_type === 'Lain-Lain' ? result.custom_order_type ?? 'Lain-Lain' : result.order_type}
                  />
                  <DetailRow label="Brand / Katalog" value={result.brand_catalog} />
                  <DetailRow label="Jumlah" value={String(result.quantity)} />
                  <div className="sm:col-span-2">
                    <DetailRow label="Deskripsi Pemesanan" value={result.description} />
                  </div>
                  <div className="sm:col-span-2">
                    <DetailRow label="Alasan Pemesanan" value={result.reason} />
                  </div>
                </dl>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="surface-card p-5">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-navy-900">
                  <FileText className="h-4 w-4 text-navy-400" />
                  Lampiran
                </h2>
                <div className="mt-3 space-y-2">
                  {(result.attachments ?? []).length === 0 && (
                    <p className="text-xs text-muted-foreground">Tidak ada lampiran.</p>
                  )}
                  {(result.attachments ?? []).map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-navy-100 bg-navy-50/40 p-3"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-rose-600 ring-1 ring-navy-100">
                          <FileText className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-navy-800">{attachment.original_name}</p>
                          <p className="text-[11px] text-navy-400">
                            {attachment.attachment_type === 'spv_approval' ? 'Bukti SPV' : 'Penawaran'} ·{' '}
                            {formatFileSize(attachment.size_bytes)}
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon-sm" asChild>
                        <a
                          href={resolveApiUrl(attachment.download_url)}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Unduh ${attachment.original_name}`}
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="surface-card p-5">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-navy-900">
                  <Clock className="h-4 w-4 text-navy-400" />
                  Riwayat Status
                </h2>
                <div className="mt-3 space-y-3">
                  {(result.status_history ?? []).length === 0 && (
                    <p className="text-xs text-muted-foreground">Belum ada riwayat status.</p>
                  )}
                  {(result.status_history ?? [])
                    .slice()
                    .reverse()
                    .map((entry) => (
                      <div key={entry.id} className="flex gap-3">
                        <span
                          className={cn(
                            'mt-1 h-2 w-2 shrink-0 rounded-full',
                            STATUS_META[entry.status as PRStatus]?.dot ?? 'bg-navy-300',
                          )}
                        />
                        <div className="min-w-0 flex-1 border-b border-navy-100 pb-3 last:border-0 last:pb-0">
                          <div className="flex flex-wrap items-center justify-between gap-1">
                            <p className="text-xs font-semibold text-navy-900">{entry.status}</p>
                            <p className="text-[11px] text-navy-400">{formatDateTime(entry.created_at)}</p>
                          </div>
                          {entry.notes && (
                            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{entry.notes}</p>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            {result.status === 'Rejected' && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Pengajuan ini ditolak. Silakan hubungi tim pengadaan untuk informasi lebih lanjut atau
                  ajukan Purchase Request baru dengan kelengkapan data yang sesuai.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button asChild variant="outline">
                <Link to="/purchase-request">
                  <Package className="h-4 w-4" />
                  Buat pengajuan baru
                </Link>
              </Button>
              <Button asChild variant="ghost">
                <Link to="/knowledge">Buka Knowledge Center</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-navy-400">{label}</dt>
      <dd className="mt-0.5 break-words font-medium text-navy-900">{value || '-'}</dd>
    </div>
  )
}

function StatusTimeline({ status }: { status: string }) {
  const currentStatus = status as PRStatus
  const isRejected = currentStatus === 'Rejected'
  const currentIndex = STATUS_FLOW.indexOf(currentStatus)

  if (isRejected) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-4">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-100 text-rose-600">
            <X className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-rose-800">Pengajuan Ditolak</p>
            <p className="text-xs text-rose-600">{STATUS_META.Rejected.description}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-navy-400">Progress Pengajuan</p>
      <div className="flex items-start">
        {STATUS_FLOW.map((step, index) => {
          const completed = currentIndex >= index
          const isCurrent = currentIndex === index
          return (
            <div key={step} className="flex flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                {index > 0 && (
                  <span
                    className={cn(
                      'h-0.5 flex-1',
                      currentIndex >= index ? 'bg-primary-600' : 'bg-navy-200',
                    )}
                  />
                )}
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold transition-colors',
                    completed
                      ? 'border-primary-600 bg-primary-600 text-white'
                      : 'border-navy-200 bg-white text-navy-400',
                    isCurrent && 'ring-4 ring-primary-100',
                  )}
                >
                  {completed && !isCurrent ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </span>
                {index < STATUS_FLOW.length - 1 && (
                  <span
                    className={cn(
                      'h-0.5 flex-1',
                      currentIndex > index ? 'bg-primary-600' : 'bg-navy-200',
                    )}
                  />
                )}
              </div>
              <p
                className={cn(
                  'mt-1.5 hidden text-center text-[10px] font-medium sm:block',
                  completed ? 'text-primary-800' : 'text-navy-400',
                )}
              >
                {step}
              </p>
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground sm:hidden">
        Status saat ini: <span className="font-semibold text-navy-800">{currentStatus}</span>
      </p>
    </div>
  )
}
