import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Calendar,
  Check,
  Download,
  ExternalLink,
  FileText,
  History,
  Loader2,
  Mail,
  Package,
  Save,
  Send,
  StickyNote,
  User,
} from 'lucide-react'
import { toast } from 'sonner'
import { usePurchaseRequestDetail, useUpdatePRNotes, useUpdatePRStatus } from '@/hooks/use-api'
import { useAuth } from '@/contexts/auth-context'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { canManagePurchaseRequest } from '@/lib/permissions'
import { StatusBadge } from '@/components/shared/status-badge'
import { ErrorState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PR_STATUSES, STATUS_META, type PRStatus } from '@/lib/constants'
import { formatDateTime, formatFileSize } from '@/lib/format'
import { downloadProtectedFile, openProtectedFile } from '@/lib/api'
import { cn } from '@/lib/utils'

export function PurchaseRequestDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { admin } = useAuth()
  const { data: pr, isLoading, isError, refetch } = usePurchaseRequestDetail(id)
  const updateStatusMutation = useUpdatePRStatus()
  const updateNotesMutation = useUpdatePRNotes()
  const canEdit = canManagePurchaseRequest(admin?.role)

  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [nextStatus, setNextStatus] = useState<string>('')
  const [statusNotes, setStatusNotes] = useState('')
  const [internalNotes, setInternalNotes] = useState('')

  useDocumentTitle(pr ? `PR ${pr.reference_number}` : 'Detail Purchase Request')

  useEffect(() => {
    if (pr) {
      setInternalNotes(pr.internal_notes ?? '')
      setNextStatus(pr.status)
    }
  }, [pr])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-80 w-full rounded-xl lg:col-span-2" />
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  if (isError || !pr) {
    return (
      <div className="space-y-4">
        <ErrorState message="Purchase Request tidak ditemukan." onRetry={() => void refetch()} />
        <Button variant="outline" onClick={() => navigate('/admin/purchase-requests')}>
          <ArrowLeft className="h-4 w-4" />
          Kembali ke daftar
        </Button>
      </div>
    )
  }

  const statusMeta = STATUS_META[pr.status as PRStatus]
  const spv = (pr.attachments ?? []).find((item) => item.attachment_type === 'spv_approval')
  const quotation = (pr.attachments ?? []).find((item) => item.attachment_type === 'quotation')

  const handleStatusUpdate = async () => {
    if (!nextStatus) {
      toast.error('Pilih status terlebih dahulu')
      return
    }
    try {
      await updateStatusMutation.mutateAsync({ id: pr.id, status: nextStatus, notes: statusNotes })
      toast.success('Status Purchase Request berhasil diperbarui')
      setStatusDialogOpen(false)
      setStatusNotes('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal memperbarui status')
    }
  }

  const handleSaveNotes = async () => {
    try {
      await updateNotesMutation.mutateAsync({ id: pr.id, internal_notes: internalNotes })
      toast.success('Catatan internal disimpan')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menyimpan catatan')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1">
            <Link to="/admin/purchase-requests">
              <ArrowLeft className="h-3.5 w-3.5" />
              Kembali ke daftar
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-mono text-lg font-bold tracking-tight text-navy-900 sm:text-xl">
              {pr.reference_number}
            </h2>
            <StatusBadge status={pr.status} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Diajukan {formatDateTime(pr.created_at)} · Diperbarui {formatDateTime(pr.updated_at)}
          </p>
        </div>

        <div className="flex gap-2">
          {canEdit && (
            <Button
              variant="outline"
              onClick={() => {
                setNextStatus('')
                setStatusNotes('')
                setStatusDialogOpen(true)
              }}
            >
              <Send className="h-4 w-4" />
              Ubah Status
            </Button>
          )}
          {spv && (
            <Button
              onClick={() => {
                void downloadProtectedFile(spv.download_url, spv.original_name).catch(() => {
                  toast.error('Gagal mengunduh lampiran')
                })
              }}
            >
              <Download className="h-4 w-4" />
              Unduh Lampiran
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-navy-100 bg-white p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-navy-400">Status saat ini</p>
        <div className="mt-1.5 flex items-start gap-2.5">
          <span className={cn('mt-1 h-2 w-2 shrink-0 rounded-full', statusMeta?.dot ?? 'bg-navy-300')} />
          <div>
            <p className="text-sm font-semibold text-navy-900">{pr.status}</p>
            <p className="text-xs text-muted-foreground">{statusMeta?.description}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <section className="surface-card p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-navy-900">
              <FileText className="h-4 w-4 text-navy-400" />
              Data Pengajuan
            </h3>

            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <InfoField label="Pemesan" value={pr.requester_name} icon={<User className="h-3.5 w-3.5" />} />
              <InfoField
                label="Jenis Pemesanan"
                value={pr.order_type === 'Lain-Lain' ? `Lain-Lain — ${pr.custom_order_type ?? ''}` : pr.order_type}
                icon={<Package className="h-3.5 w-3.5" />}
              />
              <InfoField label="Brand / Nomor Katalog" value={pr.brand_catalog} />
              <InfoField label="Jumlah" value={String(pr.quantity)} />
              <InfoField
                label="Tanggal Pengajuan"
                value={formatDateTime(pr.created_at)}
                icon={<Calendar className="h-3.5 w-3.5" />}
              />
              <InfoField label="Status" value={pr.status} />
            </dl>

            <Separator className="my-4" />

            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-navy-400">Deskripsi Pemesanan</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-navy-800">{pr.description}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-navy-400">Alasan Pemesanan</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-navy-800">{pr.reason}</p>
              </div>
            </div>
          </section>

          <section className="surface-card p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-navy-900">
              <Download className="h-4 w-4 text-navy-400" />
              Lampiran
            </h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <AttachmentCard
                title="Bukti SPV Approval"
                required
                attachment={spv}
              />
              <AttachmentCard title="Penawaran" attachment={quotation} />
            </div>
          </section>

          <section className="surface-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-navy-900">
                  <StickyNote className="h-4 w-4 text-navy-400" />
                  Catatan Internal
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Catatan ini hanya terlihat oleh admin, tidak ditampilkan ke user.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => void handleSaveNotes()}
                loading={updateNotesMutation.isPending}
                disabled={internalNotes === (pr.internal_notes ?? '')}
              >
                {!updateNotesMutation.isPending && <Save className="h-3.5 w-3.5" />}
                Simpan
              </Button>
            </div>
            <Textarea
              value={internalNotes}
              onChange={(event) => setInternalNotes(event.target.value)}
              placeholder="Tambahkan catatan proses pengadaan, nomor PO, atau informasi vendor..."
              rows={5}
              maxLength={4000}
              className="mt-3"
            />
            <p className="mt-1 text-right text-[11px] text-navy-400">{internalNotes.length}/4000</p>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="surface-card p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-navy-900">
              <History className="h-4 w-4 text-navy-400" />
              Riwayat Status
            </h3>
            <div className="mt-4 space-y-0">
              {(pr.status_history ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">Belum ada riwayat.</p>
              )}
              {(pr.status_history ?? [])
                .slice()
                .reverse()
                .map((entry, index, array) => (
                  <div key={entry.id} className="relative flex gap-3 pb-4 last:pb-0">
                    {index < array.length - 1 && (
                      <span className="absolute left-[5px] top-4 h-full w-px bg-navy-200" />
                    )}
                    <span
                      className={cn(
                        'mt-1 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white',
                        STATUS_META[entry.status as PRStatus]?.dot ?? 'bg-navy-300',
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <p className="text-xs font-semibold text-navy-900">{entry.status}</p>
                        <p className="text-[10px] text-navy-400">{formatDateTime(entry.created_at)}</p>
                      </div>
                      {entry.notes && (
                        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{entry.notes}</p>
                      )}
                      {entry.admin_name && (
                        <p className="mt-0.5 text-[10px] text-navy-400">oleh {entry.admin_name}</p>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </section>

          {canEdit && (
            <section className="surface-card p-5">
              <h3 className="text-sm font-semibold text-navy-900">Ubah Status Cepat</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">Pilih status baru untuk pengajuan ini.</p>
              <div className="mt-3 grid grid-cols-2 gap-1.5">
                {PR_STATUSES.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => {
                      setNextStatus(status)
                      setStatusDialogOpen(true)
                    }}
                    disabled={status === pr.status}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors',
                      status === pr.status
                        ? 'cursor-default border-primary-200 bg-primary-50 text-primary-800'
                        : 'border-navy-200 bg-white text-navy-600 hover:border-primary-300 hover:bg-navy-50',
                    )}
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_META[status].dot)} />
                    {status}
                    {status === pr.status && <Check className="ml-auto h-3 w-3" />}
                  </button>
                ))}
              </div>
            </section>
          )}

          <Alert variant="info">
            <Mail className="h-4 w-4" />
            <AlertDescription>
              Status <strong>Rejected</strong> menandakan pengajuan ditolak. Sertakan alasan pada catatan
              status agar pemesan memahami tindak lanjutnya.
            </AlertDescription>
          </Alert>
        </aside>
      </div>

      {canEdit && (
        <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ubah Status Purchase Request</DialogTitle>
              <DialogDescription>
                Status saat ini: <strong>{pr.status}</strong>. Perubahan akan tercatat pada riwayat.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Status Baru</Label>
                <Select value={nextStatus} onValueChange={setNextStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih status" />
                  </SelectTrigger>
                  <SelectContent>
                    {PR_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="status-notes">Catatan Status (opsional)</Label>
                <Textarea
                  id="status-notes"
                  value={statusNotes}
                  onChange={(event) => setStatusNotes(event.target.value)}
                  placeholder="Contoh: PO dikirim ke vendor, estimasi tiba 5 hari kerja."
                  rows={3}
                  maxLength={2000}
                />
                <p className="field-hint">Catatan akan tampil pada riwayat status.</p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>
                Batal
              </Button>
              <Button
                onClick={() => void handleStatusUpdate()}
                loading={updateStatusMutation.isPending}
                disabled={!nextStatus || nextStatus === pr.status}
              >
                Simpan Status
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {updateStatusMutation.isPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/30 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-lg bg-white px-5 py-3.5 shadow-elevated">
            <Loader2 className="h-5 w-5 animate-spin text-primary-600" />
            <p className="text-sm font-medium text-navy-800">Memperbarui status...</p>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoField({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon?: React.ReactNode
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs text-navy-400">
        {icon}
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-sm font-medium text-navy-900">{value || '-'}</dd>
    </div>
  )
}

function AttachmentCard({
  title,
  attachment,
  required,
}: {
  title: string
  attachment?: {
    id: string
    original_name: string
    mime_type: string
    size_bytes: number
    download_url: string
    created_at: string
  }
  required?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-lg border p-3.5',
        attachment ? 'border-navy-100 bg-white' : 'border-dashed border-navy-200 bg-navy-50/40',
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-navy-800">
          {title}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </p>
        <Badge variant={attachment ? 'success' : 'secondary'}>
          {attachment ? 'Tersedia' : 'Tidak ada'}
        </Badge>
      </div>

      {attachment ? (
        <>
          <div className="mt-2.5 flex items-start gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-rose-50 text-rose-600">
              <FileText className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-navy-900">{attachment.original_name}</p>
              <p className="text-[11px] text-navy-400">
                {formatFileSize(attachment.size_bytes)} · {formatDateTime(attachment.created_at)}
              </p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => {
                void openProtectedFile(attachment.download_url).catch(() => {
                  toast.error('Gagal membuka lampiran')
                })
              }}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Buka
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => {
                void downloadProtectedFile(attachment.download_url, attachment.original_name).catch(() => {
                  toast.error('Gagal mengunduh lampiran')
                })
              }}
            >
              <Download className="h-3.5 w-3.5" />
              Unduh
            </Button>
          </div>
        </>
      ) : (
        <p className="mt-2 text-[11px] text-muted-foreground">
          {required ? 'Lampiran wajib belum tersedia.' : 'Tidak ada dokumen penawaran yang diunggah.'}
        </p>
      )}
    </div>
  )
}
