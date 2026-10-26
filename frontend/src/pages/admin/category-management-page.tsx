import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Edit, FolderTree, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from '@/hooks/use-api'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { EmptyState, ErrorState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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
import { formatDate } from '@/lib/format'
import type { CategoryWithCount } from '@/types'

const schema = z.object({
  name: z.string().trim().min(1, 'Nama kategori wajib diisi').max(120, 'Maksimal 120 karakter'),
  slug: z
    .string()
    .trim()
    .max(150, 'Maksimal 150 karakter')
    .regex(/^[a-z0-9-]*$/, 'Slug hanya boleh huruf kecil, angka, dan tanda hubung')
    .optional(),
  description: z.string().trim().max(500, 'Deskripsi maksimal 500 karakter').optional(),
})

type FormValues = z.infer<typeof schema>

export function CategoryManagementPage() {
  useDocumentTitle('Category Management')
  const { data: categories, isLoading, isError, refetch } = useCategories('admin')
  const createMutation = useCreateCategory()
  const updateMutation = useUpdateCategory()
  const deleteMutation = useDeleteCategory()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CategoryWithCount | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CategoryWithCount | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', slug: '', description: '' },
  })

  const openCreate = () => {
    setEditing(null)
    reset({ name: '', slug: '', description: '' })
    setDialogOpen(true)
  }

  const openEdit = (category: CategoryWithCount) => {
    setEditing(category)
    reset({ name: category.name, slug: category.slug, description: category.description ?? '' })
    setDialogOpen(true)
  }

  const onSubmit = async (values: FormValues) => {
    try {
      if (editing) {
        await updateMutation.mutateAsync({
          id: editing.id,
          name: values.name,
          slug: values.slug || undefined,
          description: values.description ?? '',
        })
        toast.success('Kategori berhasil diperbarui')
      } else {
        await createMutation.mutateAsync({
          name: values.name,
          slug: values.slug || undefined,
          description: values.description ?? '',
        })
        toast.success('Kategori berhasil dibuat')
      }
      setDialogOpen(false)
      reset()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menyimpan kategori')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteMutation.mutateAsync(deleteTarget.id)
      toast.success('Kategori berhasil dihapus')
      setDeleteTarget(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menghapus kategori')
    }
  }

  const saving = createMutation.isPending || updateMutation.isPending

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-navy-900">Category Management</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Kelola kategori yang digunakan untuk mengelompokkan dokumen Knowledge Center.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Tambah Kategori
        </Button>
      </div>

      <div className="surface-card overflow-hidden">
        {isError ? (
          <div className="p-4">
            <ErrorState message="Gagal memuat kategori." onRetry={() => void refetch()} />
          </div>
        ) : isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="skeleton h-14 w-full" />
            ))}
          </div>
        ) : (categories ?? []).length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="Belum ada kategori"
              description="Tambahkan kategori pertama untuk mengelompokkan dokumen."
              icon={<FolderTree className="h-6 w-6" />}
              action={
                <Button size="sm" onClick={openCreate}>
                  <Plus className="h-3.5 w-3.5" />
                  Tambah Kategori
                </Button>
              }
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[180px]">Nama Kategori</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead className="hidden md:table-cell">Deskripsi</TableHead>
                <TableHead className="text-center">Dokumen</TableHead>
                <TableHead className="hidden sm:table-cell">Dibuat</TableHead>
                <TableHead className="w-24 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(categories ?? []).map((category) => (
                <TableRow key={category.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-700">
                        <FolderTree className="h-4 w-4" />
                      </span>
                      <span className="text-sm font-medium text-navy-900">{category.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="rounded bg-navy-50 px-1.5 py-0.5 font-mono text-[11px] text-navy-600">
                      {category.slug}
                    </code>
                  </TableCell>
                  <TableCell className="hidden max-w-[280px] md:table-cell">
                    <p className="line-clamp-2 text-xs text-muted-foreground">{category.description || '-'}</p>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={category.document_count > 0 ? 'default' : 'secondary'}>
                      {category.document_count}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap text-xs text-navy-500 sm:table-cell">
                    {formatDate(category.created_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(category)} aria-label="Edit">
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDeleteTarget(category)}
                        aria-label="Hapus"
                        className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Kategori' : 'Tambah Kategori'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Perbarui nama, slug, atau deskripsi kategori.'
                : 'Buat kategori baru untuk mengelompokkan dokumen.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">
                Nama Kategori <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Contoh: Work Instruction"
                maxLength={120}
                aria-invalid={Boolean(errors.name)}
                {...register('name')}
              />
              {errors.name && <p className="field-error">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="slug">Slug (opsional)</Label>
              <Input
                id="slug"
                placeholder="work-instruction"
                maxLength={150}
                aria-invalid={Boolean(errors.slug)}
                {...register('slug')}
              />
              {errors.slug ? (
                <p className="field-error">{errors.slug.message}</p>
              ) : (
                <p className="field-hint">Kosongkan untuk dibuat otomatis dari nama kategori.</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Deskripsi</Label>
              <Textarea
                id="description"
                placeholder="Deskripsi singkat kategori..."
                rows={3}
                maxLength={500}
                aria-invalid={Boolean(errors.description)}
                {...register('description')}
              />
              {errors.description && <p className="field-error">{errors.description.message}</p>}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Batal
              </Button>
              <Button type="submit" loading={saving}>
                {editing ? 'Simpan Perubahan' : 'Simpan Kategori'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus kategori?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && deleteTarget.document_count > 0 ? (
                <>
                  Kategori <span className="font-semibold text-navy-800">{deleteTarget.name}</span> masih
                  memiliki {deleteTarget.document_count} dokumen. Pindahkan atau hapus dokumen terlebih dahulu.
                </>
              ) : (
                <>
                  Kategori <span className="font-semibold text-navy-800">{deleteTarget?.name}</span> akan
                  dihapus permanen.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void handleDelete()
              }}
              disabled={deleteMutation.isPending || Boolean(deleteTarget && deleteTarget.document_count > 0)}
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
