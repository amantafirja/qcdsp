import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Calendar,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileText,
  GitMerge,
  History,
  Layers,
  Loader2,
  Mail,
  Package,
  Save,
  Send,
  ShieldAlert,
  StickyNote,
  Trash2,
  Unlink,
  User,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  useDeletePurchaseRequest,
  useMergePurchaseRequests,
  usePRAudit,
  usePurchaseRequestDetail,
  usePurchaseRequests,
  useUnmergePurchaseRequests,
  useUpdatePRNotes,
  useUpdatePRStatus,
} from '@/hooks/use-api'
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
  PR_STATUSES,
  STATUS_META,
  isTerminalStatus,
  statusLabel,
  type PRStatus,
} from '@/lib/constants'
import { buildPRCopyText, copyText } from '@/lib/copy-pr'
import { formatDateTime, formatFileSize } from '@/lib/format'
import { downloadProtectedFile, openProtectedFile } from '@/lib/api'
import { cn } from '@/lib/utils'

const AUDIT_LABELS: Record<string, string> = {
  created: 'Purchase Request dibuat',
  status_changed: 'Perubahan progress',
  merged: 'Penggabungan PR',
  merged_into: 'PR digabungkan ke PR lain',
  unmerge: 'Pembatalan penggabungan',
  unmerged: 'PR dikeluarkan dari PR Utama',
  deleted: 'Purchase Request dihapus',
  notes_updated: 'Catatan internal diubah',
}

export function PurchaseRequestDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { admin } = useAuth()
  const { data: pr, isLoading, isError, refetch } = usePurchaseRequestDetail(id)
  const updateStatusMutation = useUpdatePRStatus()
  const updateNotesMutation = useUpdatePRNotes()
  const mergeMutation = useMergePurchaseRequests()
  const unmergeMutation = useUnmergePurchaseRequests()
  const deleteMutation = useDeletePurchaseRequest()

  const canEdit = canManagePurchaseRequest(admin?.role)

  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [nextStatus, setNextStatus] = useState<string>('')
  const [statusNotes, setStatusNotes] = useState('')
  const [internalNotes, setInternalNotes] = useState('')
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false)
  const [memberIds, setMemberIds] = useState<string[]>([])
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { data: auditLogs, isLoading: auditLoading } = usePRAudit(id, canEdit)

  const mergeCandidatesQuery = usePurchaseRequests({ page: 1, page_size: 100 }, mergeDialogOpen)
  const mergeCandidates = useMemo(
    () =>
      (mergeCandidatesQuery.data?.requests ?? []).filter(
        (item) =>
          item.id !== pr?.id &&
          !item.is_merged &&
          !item.is_master &&
          !isTerminalStatus(item.status),
      ),
    [mergeCandidatesQuery.data, pr?.id],
  )

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
  const terminal = isTerminalStatus(pr.status)
  const spv = (pr.attachments ?? []).find((item) => item.attachment_type === 'spv_approval')
  const quotation = (pr.attachments ?? []).find((item) => item.attachment_type === 'quotation')
  const canBecomeMaster = canEdit && !pr.is_merged && !pr.is_master && !terminal

  const handleCopy = async () => {
    const ok = await copyText(buildPRCopyText(pr))
    if (ok) toast.success('Data PR berhasil disalin.')
    else toast.error('Gagal menyalin data PR')
  }

  const handleStatusUpdate = async () => {
    if (!nextStatus) {
      toast.error('Pilih status terlebih dahulu')
      return
    }
    try {
      await updateStatusMutation.mutateAsync({ id: pr.id, status: nextStatus, notes: statusNotes })
      toast.success('Progress Purchase Request berhasil diperbarui')
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

  const handleMerge = async () => {
    if (memberIds.length === 0) {
      toast.error('Pilih minimal satu PR untuk digabungkan')
      return
    }
    try {
      await mergeMutation.mutateAsync({ masterId: pr.id, memberIds })
      toast.success('Purchase Request berhasil digabungkan')
      setMergeDialogOpen(false)
      setMemberIds([])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menggabungkan PR')
    }
  }

  const handleUnmerge = async (memberId?: string) => {
    try {
      await unmergeMutation.mutateAsync({
        masterId: pr.id,
        memberIds: memberId ? [memberId] : undefined,
      })
      toast.success('Penggabungan Purchase Request dibatalkan')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal membatalkan penggabungan')
    }
  }

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(pr.id)
      toast.success('Purchase Request berhasil dihapus')
      navigate('/admin/purchase-requests', { replace: true })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menghapus PR')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1">
            <Link to="/admin/purchase-requests">
              <ArrowLeft className="h-3.5 w-3.5" />
              Kembali ke daftar
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="break-all font-mono text-lg font-bold tracking-tight text-navy-900 sm:text-xl">
              {pr.reference_number}
            </h2>
            <StatusBadge status={pr.status} />
            {pr.is_master && <Badge variant="default">PR Utama</Badge>}
            {pr.is_merged && <Badge variant="info">PR Anggota</Badge>}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Diajukan {formatDateTime(pr.created_at)} · Diperbarui {formatDateTime(pr.updated_at)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void handleCopy()}>
            <Copy className="h-4 w-4" />
            Salin Data PR
          </Button>
          {canEdit && !terminal && (
            <Button
              variant="outline"
              onClick={() => {
                setNextStatus(pr.status)
                setStatusNotes('')
                setStatusDialogOpen(true)
              }}
            >
              <Send className="h-4 w-4" />
              Ubah Progress
            </Button>
          )}
          {canBecomeMaster && (
            <Button
              variant="outline"
              onClick={() => {
                setMemberIds([])
                setMergeDialogOpen(true)
              }}
            >
              <GitMerge className="h-4 w-4" />
              Gabungkan
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
          {canEdit && (
            <Button variant="ghost" onClick={() => setDeleteOpen(true)} className="text-rose-600 hover:bg-rose-50">
              <Trash2 className="h-4 w-4" />
              Hapus
            </Button>
          )}
        </div>
      </div>

      {(pr.is_merged || pr.is_master) && (
        <Alert variant="info">
          <Layers className="h-4 w-4" />
          <AlertTitle>Status Penggabungan</AlertTitle>
          <AlertDescription>
            {pr.is_merged && pr.master ? (
              <span>
                PR ini adalah <strong>PR Asal</strong> yang tergabung ke PR Utama{' '}
                <Link
                  to={`/admin/purchase-requests/${pr.master.id}`}
                  className="font-mono font-semibold underline"
                >
                  {pr.master.reference_number}
                </Link>
                . Item PR ini tetap tampil pada PR Utama.
              </span>
            ) : (
              <span>
                PR ini adalah <strong>PR Utama</strong> dengan {pr.members.length} PR asal:{' '}
                <span className="font-mono">
                  {pr.members.map((member) => member.reference_number).join(', ')}
                </span>
                .
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="rounded-xl border border-navy-100 bg-white p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-navy-400">Progress saat ini</p>
        <div className="mt-1.5 flex items-start gap-2.5">
          <span className={cn('mt-1 h-2 w-2 shrink-0 rounded-full', statusMeta?.dot ?? 'bg-navy-300')} />
          <div>
            <p className="text-sm font-semibold text-navy-900">{statusLabel(pr.status)}</p>
            <p className="text-xs text-muted-foreground">{statusMeta?.description}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <section className="surface-card p-5">
            <h3 className="section-title flex items-center gap-2">
              <FileText className="h-4 w-4 text-navy-400" />
              Data Pengajuan
            </h3>

            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <InfoField label="Pemesan" value={pr.requester_name} icon={<User className="h-3.5 w-3.5" />} />
              <InfoField
                label="Jenis Pemesanan"
                value={pr.order_type === 'Lain-Lain' ? `Lain-Lain - ${pr.custom_order_type ?? ''}` : pr.order_type}
                icon={<Package className="h-3.5 w-3.5" />}
              />
              <InfoField
                label="Tanggal Pengajuan"
                value={formatDateTime(pr.created_at)}
                icon={<Calendar className="h-3.5 w-3.5" />}
              />
              <InfoField label="Jumlah Item" value={`${pr.items.length} item`} />
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
            <div className="flex items-center justify-between gap-2">
              <h3 className="section-title flex items-center gap-2">
                <Package className="h-4 w-4 text-navy-400" />
                Daftar Item ({pr.items.length})
              </h3>
            </div>
            <div className="mt-3 overflow-x-auto rounded-lg border border-navy-100">
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead className="bg-navy-50/60 text-[11px] uppercase tracking-wide text-navy-500">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Item</th>
                    <th className="px-3 py-2 font-semibold">Brand / Katalog</th>
                    <th className="px-3 py-2 text-right font-semibold">Qty</th>
                    <th className="px-3 py-2 font-semibold">Asal PR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-100">
                  {pr.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2 font-medium text-navy-900">
                        {item.item_name}
                        {item.notes && <span className="block text-[11px] text-navy-400">{item.notes}</span>}
                      </td>
                      <td className="px-3 py-2 text-navy-600">{item.brand_catalog || '-'}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-navy-800">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="px-3 py-2">
                        {item.origin_is_master ? (
                          <span className="font-mono text-[10px] text-navy-600">{item.origin_reference}</span>
                        ) : (
                          <Link
                            to={`/admin/purchase-requests/${item.origin_pr_id}`}
                            className="font-mono text-[10px] font-semibold text-primary-700 hover:underline"
                          >
                            {item.origin_reference}
                          </Link>
                        )}
                        {!item.origin_is_master && (
                          <Badge variant="info" className="ml-1.5">
                            Gabungan
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {pr.is_master && (
            <section className="surface-card p-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="section-title flex items-center gap-2">
                  <Layers className="h-4 w-4 text-navy-400" />
                  PR Asal yang Digabungkan ({pr.members.length})
                </h3>
                {canEdit && pr.members.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleUnmerge()}
                    loading={unmergeMutation.isPending}
                  >
                    <Unlink className="h-3.5 w-3.5" />
                    Batalkan semua
                  </Button>
                )}
              </div>
              <div className="mt-3 space-y-2">
                {pr.members.length === 0 && (
                  <p className="text-xs text-muted-foreground">Belum ada PR yang digabungkan.</p>
                )}
                {pr.members.map((member) => (
                  <div
                    key={member.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-navy-100 bg-navy-50/40 p-3"
                  >
                    <div className="min-w-0">
                      <Link
                        to={`/admin/purchase-requests/${member.id}`}
                        className="font-mono text-[11px] font-semibold text-primary-700 hover:underline"
                      >
                        {member.reference_number}
                      </Link>
                      <p className="text-xs text-navy-600">
                        {member.requester_name} · {member.item_count ?? 0} item
                      </p>
                      <p className="text-[10px] text-navy-400">
                        Digabungkan {member.merged_at ? formatDateTime(member.merged_at) : '-'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={member.status} />
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleUnmerge(member.id)}
                          loading={unmergeMutation.isPending}
                        >
                          <Unlink className="h-3.5 w-3.5" />
                          Keluarkan
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="surface-card p-5">
            <h3 className="section-title flex items-center gap-2">
              <Download className="h-4 w-4 text-navy-400" />
              Lampiran
            </h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <AttachmentCard title="Bukti SPV Approval" required attachment={spv} />
              <AttachmentCard title="Penawaran" attachment={quotation} />
            </div>
          </section>

          <section className="surface-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="section-title flex items-center gap-2">
                  <StickyNote className="h-4 w-4 text-navy-400" />
                  Catatan Internal
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Catatan ini hanya terlihat oleh admin, tidak ditampilkan ke user.
                </p>
              </div>
              {canEdit && (
                <Button
                  size="sm"
                  onClick={() => void handleSaveNotes()}
                  loading={updateNotesMutation.isPending}
                  disabled={internalNotes === (pr.internal_notes ?? '')}
                >
                  {!updateNotesMutation.isPending && <Save className="h-3.5 w-3.5" />}
                  Simpan
                </Button>
              )}
            </div>
            {canEdit ? (
              <>
                <Textarea
                  value={internalNotes}
                  onChange={(event) => setInternalNotes(event.target.value)}
                  placeholder="Tambahkan catatan proses pengadaan, nomor PO, atau informasi vendor..."
                  rows={5}
                  maxLength={4000}
                  className="mt-3"
                />
                <p className="mt-1 text-right text-[11px] text-navy-400">{internalNotes.length}/4000</p>
              </>
            ) : (
              <p className="mt-3 whitespace-pre-wrap rounded-lg bg-navy-50/60 p-3 text-sm leading-relaxed text-navy-800">
                {pr.internal_notes || 'Belum ada catatan internal.'}
              </p>
            )}
          </section>

          {canEdit && (
            <section className="surface-card p-5">
              <h3 className="section-title flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-navy-400" />
                Audit Trail
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Riwayat aktivitas PR beserta data sebelum dan sesudah perubahan.
              </p>
              <div className="mt-3 space-y-2">
                {auditLoading && <p className="text-xs text-muted-foreground">Memuat audit trail...</p>}
                {!auditLoading && (auditLogs ?? []).length === 0 && (
                  <p className="text-xs text-muted-foreground">Belum ada aktivitas tercatat.</p>
                )}
                {(auditLogs ?? []).map((entry) => (
                  <div key={entry.id} className="rounded-lg border border-navy-100 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <p className="text-xs font-semibold text-navy-900">
                        {AUDIT_LABELS[entry.action] ?? entry.action}
                      </p>
                      <p className="text-[10px] text-navy-400">{formatDateTime(entry.created_at)}</p>
                    </div>
                    <p className="mt-0.5 text-[11px] text-navy-500">
                      oleh {entry.actor_name || 'Sistem'}
                      {entry.actor_role ? ` (${entry.actor_role})` : ''}
                    </p>
                    {entry.notes && <p className="mt-1 text-[11px] text-navy-600">{entry.notes}</p>}
                    {Boolean(entry.before_data || entry.after_data) && (
                      <details className="mt-1.5">
                        <summary className="cursor-pointer text-[10px] font-medium text-primary-700">
                          Lihat data sebelum / sesudah
                        </summary>
                        <pre className="mt-1 max-h-40 overflow-auto rounded bg-navy-50 p-2 text-[10px] leading-relaxed text-navy-700">
{JSON.stringify({ before: entry.before_data, after: entry.after_data }, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-5">
          <section className="surface-card p-5">
            <h3 className="section-title flex items-center gap-2">
              <History className="h-4 w-4 text-navy-400" />
              Riwayat Progress
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
                        <p className="text-xs font-semibold text-navy-900">{statusLabel(entry.status)}</p>
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

          {canEdit && !terminal && (
            <section className="surface-card p-5">
              <h3 className="section-title">Ubah Progress Cepat</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Progress hanya dapat diubah manual oleh admin.
              </p>
              <div className="mt-3 space-y-1.5">
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
                      'flex w-full items-center gap-1.5 rounded-md border px-2 py-1.5 text-left text-[11px] font-medium transition-colors',
                      status === pr.status
                        ? 'cursor-default border-primary-200 bg-primary-50 text-primary-800'
                        : 'border-navy-200 bg-white text-navy-600 hover:border-primary-300 hover:bg-navy-50',
                    )}
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_META[status].dot)} />
                    {STATUS_META[status].label}
                    {status === pr.status && <Check className="ml-auto h-3 w-3" />}
                  </button>
                ))}
              </div>
            </section>
          )}

          {terminal && (
            <Alert variant="info">
              <Mail className="h-4 w-4" />
              <AlertDescription>
                PR berstatus akhir (<strong>{statusLabel(pr.status)}</strong>) dan tidak dapat diubah lagi.
                Nomor PR tetap tersimpan sebagai histori.
              </AlertDescription>
            </Alert>
          )}
        </aside>
      </div>

      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ubah Progress Purchase Request</DialogTitle>
            <DialogDescription>
              Progress saat ini: <strong>{statusLabel(pr.status)}</strong>. Perubahan akan tercatat pada
              riwayat dan audit trail.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Progress Baru</Label>
              <Select value={nextStatus} onValueChange={setNextStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih progress" />
                </SelectTrigger>
                <SelectContent>
                  {PR_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {STATUS_META[status].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="status-notes">Catatan (opsional)</Label>
              <Textarea
                id="status-notes"
                value={statusNotes}
                onChange={(event) => setStatusNotes(event.target.value)}
                placeholder="Contoh: PO dikirim ke vendor, estimasi tiba 5 hari kerja."
                rows={3}
                maxLength={2000}
              />
              <p className="field-hint">
                Wajib diisi untuk status Selesai (Reject) dan Selesai (Cancel).
              </p>
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
              Simpan Progress
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Gabungkan PR ke {pr.reference_number}</DialogTitle>
            <DialogDescription>
              PR ini menjadi PR Utama. Item dari PR yang dipilih akan tampil pada PR ini, dan PR asal tetap
              tersimpan sebagai histori.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-lg border border-navy-100 p-2">
            {mergeCandidatesQuery.isLoading && <p className="p-2 text-xs text-muted-foreground">Memuat...</p>}
            {!mergeCandidatesQuery.isLoading && mergeCandidates.length === 0 && (
              <p className="p-2 text-xs text-muted-foreground">
                Tidak ada PR yang dapat digabungkan saat ini.
              </p>
            )}
            {mergeCandidates.map((candidate) => (
              <label
                key={candidate.id}
                className="flex cursor-pointer items-start gap-2 rounded-md p-2 hover:bg-navy-50"
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-navy-300 text-primary-600"
                  checked={memberIds.includes(candidate.id)}
                  onChange={() =>
                    setMemberIds((current) =>
                      current.includes(candidate.id)
                        ? current.filter((id) => id !== candidate.id)
                        : [...current, candidate.id],
                    )
                  }
                />
                <span className="min-w-0">
                  <span className="block font-mono text-[11px] font-semibold text-navy-800">
                    {candidate.reference_number}
                  </span>
                  <span className="block truncate text-xs text-navy-600">
                    {candidate.items.map((item) => item.item_name).join(', ') || candidate.description}
                  </span>
                </span>
              </label>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeDialogOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={() => void handleMerge()}
              loading={mergeMutation.isPending}
              disabled={memberIds.length === 0}
            >
              Gabungkan {memberIds.length > 0 ? `(${memberIds.length})` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Purchase Request?</AlertDialogTitle>
            <AlertDialogDescription>
              PR <span className="font-mono font-semibold">{pr.reference_number}</span> akan dihapus secara
              soft delete. Nomor PR tidak digunakan kembali dan histori tetap tersimpan pada audit trail.
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

      {updateStatusMutation.isPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/30 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-lg bg-white px-5 py-3.5 shadow-elevated">
            <Loader2 className="h-5 w-5 animate-spin text-primary-600" />
            <p className="text-sm font-medium text-navy-800">Memperbarui progress...</p>
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
