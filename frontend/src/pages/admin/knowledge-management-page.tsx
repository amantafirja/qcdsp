import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  AlertCircle,
  Copy,
  Edit,
  Eye,
  EyeOff,
  FileText,
  Filter,
  MoreHorizontal,
  Plus,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  useCategories,
  useDeleteKnowledge,
  useKnowledgeList,
  useTogglePublish,
} from '@/hooks/use-api'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { SearchInput } from '@/components/shared/search-input'
import { PaginationBar } from '@/components/shared/pagination-bar'
import { EmptyState, ErrorState } from '@/components/shared/empty-state'
import { PublishBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { CONTENT_TYPE_META } from '@/lib/constants'
import { formatDate } from '@/lib/format'
import type { KnowledgeDocument } from '@/types'

export function KnowledgeManagementPage() {
  useDocumentTitle('Knowledge Management')
  const [searchParams, setSearchParams] = useSearchParams()
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeDocument | null>(null)

  const search = searchParams.get('search') ?? ''
  const categoryId = searchParams.get('category_id') ?? 'all'
  const contentType = searchParams.get('content_type') ?? 'all'
  const page = Number(searchParams.get('page') ?? 1)

  const { data: categories } = useCategories('admin')
  const { data, isLoading, isError, refetch, isFetching } = useKnowledgeList('admin', {
    search,
    category_id: categoryId === 'all' ? undefined : categoryId,
    content_type: contentType === 'all' ? undefined : (contentType as 'pdf' | 'article'),
    page,
    page_size: 10,
  })

  const deleteMutation = useDeleteKnowledge()
  const toggleMutation = useTogglePublish()

  const updateParam = (key: string, value?: string) => {
    const params = new URLSearchParams(searchParams)
    if (value && value !== 'all') params.set(key, value)
    else params.delete(key)
    if (key !== 'page') params.delete('page')
    setSearchParams(params, { replace: true })
  }

  const documents = data?.documents ?? []

  const stats = useMemo(() => {
    const total = data?.pagination?.total ?? 0
    const published = documents.filter((item) => item.is_published).length
    const pdfs = documents.filter((item) => item.content_type === 'pdf').length
    const articles = documents.filter((item) => item.content_type === 'article').length
    return { total, published, pdfs, articles }
  }, [data?.pagination?.total, documents])

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteMutation.mutateAsync(deleteTarget.id)
      toast.success('Dokumen berhasil dihapus')
      setDeleteTarget(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menghapus dokumen')
    }
  }

  const handleTogglePublish = async (document: KnowledgeDocument) => {
    try {
      await toggleMutation.mutateAsync({ id: document.id, isPublished: !document.is_published })
      toast.success(document.is_published ? 'Dokumen di-unpublish' : 'Dokumen dipublish')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal mengubah status publish')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-navy-900">Knowledge Management</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Kelola dokumen PDF dan artikel yang tampil di Knowledge Center.
          </p>
        </div>
        <Button asChild>
          <Link to="/admin/knowledge/new">
            <Plus className="h-4 w-4" />
            Tambah Dokumen
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat label="Total dokumen" value={stats.total} />
        <MiniStat label="Published (halaman ini)" value={stats.published} />
        <MiniStat label="PDF (halaman ini)" value={stats.pdfs} />
        <MiniStat label="Artikel (halaman ini)" value={stats.articles} />
      </div>

      <div className="surface-card">
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="w-full lg:max-w-sm">
            <SearchInput
              placeholder="Cari judul atau deskripsi dokumen..."
              syncUrlParam="search"
              defaultValue={search}
              isLoading={isFetching}
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={categoryId} onValueChange={(value) => updateParam('category_id', value)}>
              <SelectTrigger className="h-10 w-full text-xs sm:w-[180px]">
                <Filter className="mr-1 h-3.5 w-3.5 text-navy-400" />
                <SelectValue placeholder="Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua kategori</SelectItem>
                {(categories ?? []).map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={contentType} onValueChange={(value) => updateParam('content_type', value)}>
              <SelectTrigger className="h-10 w-full text-xs sm:w-[150px]">
                <SelectValue placeholder="Tipe konten" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua tipe</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="article">Artikel</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isError ? (
          <div className="p-4">
            <ErrorState message="Gagal memuat dokumen." onRetry={() => void refetch()} />
          </div>
        ) : isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="skeleton h-14 w-full" />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="Belum ada dokumen"
              description="Tambahkan dokumen PDF atau artikel pertama untuk Knowledge Center."
              action={
                <Button asChild size="sm">
                  <Link to="/admin/knowledge/new">
                    <Plus className="h-3.5 w-3.5" />
                    Tambah Dokumen
                  </Link>
                </Button>
              }
            />
          </div>
        ) : (
          <>
            <div className="hidden lg:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[280px]">Judul</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Dilihat</TableHead>
                    <TableHead>Diperbarui</TableHead>
                    <TableHead className="w-12 text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((document) => {
                    const meta = CONTENT_TYPE_META[document.content_type]
                    return (
                      <TableRow key={document.id}>
                        <TableCell>
                          <div className="flex items-start gap-2.5">
                            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-navy-50 text-navy-500">
                              <FileText className="h-4 w-4" />
                            </span>
                            <div className="min-w-0">
                              <Link
                                to={`/admin/knowledge/${document.id}/edit`}
                                className="line-clamp-1 text-sm font-medium text-navy-900 hover:text-primary-700"
                              >
                                {document.title}
                              </Link>
                              <p className="line-clamp-1 text-xs text-navy-400">{document.description}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{document.category?.name}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${meta.badge}`}>
                            {meta.label}
                          </span>
                        </TableCell>
                        <TableCell>
                          <PublishBadge published={document.is_published} />
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums text-navy-600">
                          {document.view_count}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-navy-500">
                          {formatDate(document.updated_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <RowActions
                            document={document}
                            onDelete={() => setDeleteTarget(document)}
                            onToggle={() => void handleTogglePublish(document)}
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="divide-y divide-border lg:hidden">
              {documents.map((document) => {
                const meta = CONTENT_TYPE_META[document.content_type]
                return (
                  <div key={document.id} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${meta.badge}`}>
                            {meta.label}
                          </span>
                          <PublishBadge published={document.is_published} />
                        </div>
                        <Link
                          to={`/admin/knowledge/${document.id}/edit`}
                          className="mt-1.5 line-clamp-2 text-sm font-semibold text-navy-900"
                        >
                          {document.title}
                        </Link>
                        <p className="mt-0.5 text-xs text-navy-400">
                          {document.category?.name} · {formatDate(document.updated_at)}
                        </p>
                      </div>
                      <RowActions
                        document={document}
                        onDelete={() => setDeleteTarget(document)}
                        onToggle={() => void handleTogglePublish(document)}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="border-t border-border p-4">
              <PaginationBar
                pagination={data?.pagination}
                itemLabel="dokumen"
                onPageChange={(nextPage) => updateParam('page', String(nextPage))}
              />
            </div>
          </>
        )}
      </div>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus dokumen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dokumen <span className="font-semibold text-navy-800">{deleteTarget?.title}</span> akan dihapus
              permanen beserta file PDF-nya. Tindakan ini tidak dapat dibatalkan.
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

function RowActions({
  document,
  onDelete,
  onToggle,
}: {
  document: KnowledgeDocument
  onDelete: () => void
  onToggle: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Aksi dokumen">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Aksi</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link to={`/knowledge/${document.id}`} target="_blank" rel="noreferrer">
            <Eye />
            Lihat publik
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={`/admin/knowledge/${document.id}/edit`}>
            <Edit />
            Edit dokumen
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onToggle}>
          {document.is_published ? <EyeOff /> : <Eye />}
          {document.is_published ? 'Unpublish' : 'Publish'}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={async () => {
            await navigator.clipboard.writeText(`${window.location.origin}/knowledge/${document.id}`)
            toast.success('Tautan dokumen disalin')
          }}
        >
          <Copy />
          Salin tautan
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDelete} className="text-rose-600 focus:bg-rose-50 focus:text-rose-700">
          <Trash2 />
          Hapus
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="surface-card flex items-center justify-between p-3.5">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-navy-400">{label}</p>
        <p className="mt-0.5 text-xl font-bold tabular-nums text-navy-900">{value}</p>
      </div>
      <AlertCircle className="h-4 w-4 text-navy-200" />
    </div>
  )
}
