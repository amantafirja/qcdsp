import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  ArrowLeft,
  FileText,
  Info,
  Loader2,
  Save,
  Send,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useCategories, useKnowledgeDetail, useSaveKnowledge } from '@/hooks/use-api'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { RichTextEditor } from '@/components/admin/rich-text-editor'
import { FileUpload } from '@/components/shared/file-upload'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const schema = z
  .object({
    title: z.string().trim().min(1, 'Judul wajib diisi').max(255, 'Maksimal 255 karakter'),
    category_id: z.string().min(1, 'Kategori wajib dipilih'),
    description: z.string().trim().max(1000, 'Deskripsi maksimal 1000 karakter'),
    content_type: z.enum(['pdf', 'article']),
    article_content: z.string().optional(),
    is_published: z.boolean(),
  })
  .superRefine((values, ctx) => {
    if (values.content_type === 'article' && !values.article_content?.replace(/<[^>]*>/g, '').trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['article_content'],
        message: 'Isi artikel wajib diisi',
      })
    }
  })

type FormValues = z.infer<typeof schema>

export function KnowledgeEditorPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pdfError, setPdfError] = useState<string | null>(null)

  const { data: categories, isLoading: categoriesLoading } = useCategories('admin')
  const { data: document, isLoading: documentLoading } = useKnowledgeDetail('admin', id)
  const saveMutation = useSaveKnowledge()

  useDocumentTitle(isEdit ? 'Edit Dokumen' : 'Tambah Dokumen')

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      category_id: '',
      description: '',
      content_type: 'article',
      article_content: '',
      is_published: false,
    },
  })

  useEffect(() => {
    if (document) {
      reset({
        title: document.title,
        category_id: document.category_id,
        description: document.description,
        content_type: document.content_type,
        article_content: document.article_content ?? '',
        is_published: document.is_published,
      })
    }
  }, [document, reset])

  const contentType = watch('content_type')
  const isPublished = watch('is_published')

  const onSubmit = async (values: FormValues) => {
    if (values.content_type === 'pdf' && !pdfFile && !document?.pdf_original_name) {
      setPdfError('File PDF wajib diunggah untuk tipe konten PDF')
      toast.error('Unggah file PDF terlebih dahulu')
      return
    }

    const formData = new FormData()
    formData.append('title', values.title)
    formData.append('category_id', values.category_id)
    formData.append('description', values.description)
    formData.append('content_type', values.content_type)
    formData.append('is_published', String(values.is_published))
    if (values.content_type === 'article') {
      formData.append('article_content', values.article_content ?? '')
    }
    if (values.content_type === 'pdf') {
      if (pdfFile) formData.append('pdf', pdfFile)
      else formData.append('keep_pdf', 'true')
    }

    try {
      await saveMutation.mutateAsync({ id, formData })
      toast.success(isEdit ? 'Dokumen berhasil diperbarui' : 'Dokumen berhasil dibuat')
      setPdfFile(null)
      setPdfError(null)
      navigate('/admin/knowledge')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menyimpan dokumen'
      toast.error(message)
    }
  }

  if (isEdit && documentLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1">
            <Link to="/admin/knowledge">
              <ArrowLeft className="h-3.5 w-3.5" />
              Kembali
            </Link>
          </Button>
          <h2 className="text-xl font-bold tracking-tight text-navy-900">
            {isEdit ? 'Edit Dokumen' : 'Tambah Dokumen Baru'}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {isEdit
              ? 'Perbarui konten, kategori, atau status publikasi dokumen.'
              : 'Buat dokumen PDF atau artikel rich text untuk Knowledge Center.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/admin/knowledge')}
            disabled={saveMutation.isPending}
          >
            Batal
          </Button>
          <Button
            type="submit"
            form="knowledge-form"
            loading={saveMutation.isPending}
          >
            {!saveMutation.isPending && <Save className="h-4 w-4" />}
            {isEdit ? 'Simpan Perubahan' : 'Simpan Dokumen'}
          </Button>
        </div>
      </div>

      {isEdit && !isDirty && (
        <Alert variant="info">
          <Info className="h-4 w-4" />
          <AlertDescription>
            Terakhir diperbarui: {document?.updated_at ? new Date(document.updated_at).toLocaleString('id-ID') : '-'}
            {document && ` · ${document.view_count} kali dilihat`}
          </AlertDescription>
        </Alert>
      )}

      <form id="knowledge-form" onSubmit={handleSubmit(onSubmit)} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <section className="surface-card p-5">
            <h3 className="text-sm font-semibold text-navy-900">Informasi Dokumen</h3>
            <div className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="title">
                  Judul <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title"
                  placeholder="Contoh: SOP Penerimaan Sampel dan Reagen"
                  maxLength={255}
                  aria-invalid={Boolean(errors.title)}
                  {...register('title')}
                />
                {errors.title && <p className="field-error">{errors.title.message}</p>}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="category_id">
                    Kategori <span className="text-destructive">*</span>
                  </Label>
                  <Controller
                    control={control}
                    name="category_id"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange} disabled={categoriesLoading}>
                        <SelectTrigger id="category_id" aria-invalid={Boolean(errors.category_id)}>
                          <SelectValue placeholder={categoriesLoading ? 'Memuat...' : 'Pilih kategori'} />
                        </SelectTrigger>
                        <SelectContent>
                          {(categories ?? []).map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.category_id && <p className="field-error">{errors.category_id.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="content_type">
                    Tipe Konten <span className="text-destructive">*</span>
                  </Label>
                  <Controller
                    control={control}
                    name="content_type"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="content_type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="article">Artikel (Rich Text)</SelectItem>
                          <SelectItem value="pdf">Dokumen PDF</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description">Deskripsi Singkat</Label>
                <Textarea
                  id="description"
                  placeholder="Ringkasan singkat yang tampil pada kartu dokumen..."
                  rows={3}
                  maxLength={1000}
                  aria-invalid={Boolean(errors.description)}
                  {...register('description')}
                />
                <div className="flex items-center justify-between">
                  {errors.description ? (
                    <p className="field-error">{errors.description.message}</p>
                  ) : (
                    <p className="field-hint">Opsional, membantu pencarian dan tampilan kartu</p>
                  )}
                  <p className="field-hint">{watch('description')?.length ?? 0}/1000</p>
                </div>
              </div>
            </div>
          </section>

          <section className="surface-card p-5">
            <Tabs value={contentType} onValueChange={(value) => setValue('content_type', value as 'pdf' | 'article')}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-navy-900">Konten</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {contentType === 'article'
                      ? 'Tulis artikel dengan rich text editor.'
                      : 'Unggah file PDF untuk preview dan download.'}
                  </p>
                </div>
                <TabsList>
                  <TabsTrigger value="article">
                    <FileText className="mr-1.5 h-3.5 w-3.5" />
                    Artikel
                  </TabsTrigger>
                  <TabsTrigger value="pdf">
                    <Send className="mr-1.5 h-3.5 w-3.5" />
                    PDF
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="article" className="mt-4">
                <Controller
                  control={control}
                  name="article_content"
                  render={({ field }) => (
                    <RichTextEditor
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      error={errors.article_content?.message}
                    />
                  )}
                />
              </TabsContent>

              <TabsContent value="pdf" className="mt-4">
                <FileUpload
                  id="pdf"
                  label="File PDF"
                  required
                  accept={['.pdf']}
                  value={pdfFile}
                  existingName={document?.pdf_original_name}
                  onChange={(file) => {
                    setPdfFile(file)
                    setPdfError(null)
                  }}
                  error={pdfError ?? undefined}
                  hint="Hanya file PDF, maksimal 10 MB"
                />
                {isEdit && document?.pdf_original_name && !pdfFile && (
                  <Alert variant="warning" className="mt-3">
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      File saat ini akan dipertahankan jika Anda tidak mengunggah file baru.
                    </AlertDescription>
                  </Alert>
                )}
              </TabsContent>
            </Tabs>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="surface-card p-5">
            <h3 className="text-sm font-semibold text-navy-900">Publikasi</h3>
            <div className="mt-4 flex items-start justify-between gap-3 rounded-lg border border-navy-100 bg-navy-50/50 p-3">
              <div>
                <p className="text-xs font-semibold text-navy-900">
                  {isPublished ? 'Published' : 'Draft'}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                  {isPublished
                    ? 'Dokumen tampil di Knowledge Center publik.'
                    : 'Dokumen hanya terlihat oleh admin.'}
                </p>
              </div>
              <Controller
                control={control}
                name="is_published"
                render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Status publikasi" />
                )}
              />
            </div>

            <div className="mt-4 space-y-2 text-xs text-navy-500">
              <div className="flex items-center justify-between">
                <span>Tipe konten</span>
                <span className="font-medium text-navy-800">
                  {contentType === 'article' ? 'Artikel' : 'PDF'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Kategori</span>
                <span className="max-w-[55%] truncate font-medium text-navy-800">
                  {categories?.find((item) => item.id === watch('category_id'))?.name ?? '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Status</span>
                <span className="font-medium text-navy-800">{isPublished ? 'Published' : 'Draft'}</span>
              </div>
            </div>

            <Button type="submit" className="mt-4 w-full" loading={saveMutation.isPending}>
              {!saveMutation.isPending && <Save className="h-4 w-4" />}
              {isEdit ? 'Simpan Perubahan' : 'Simpan Dokumen'}
            </Button>
          </div>

          <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4">
            <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-800">
              <Trash2 className="h-3.5 w-3.5" />
              Catatan
            </h4>
            <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-amber-900/80">
              <li>• Dokumen draft tidak tampil di portal publik.</li>
              <li>• PDF maksimal 10 MB dan hanya format .pdf.</li>
              <li>• Gambar artikel maksimal 10 MB (JPG/PNG).</li>
              <li>• Judul akan otomatis menghasilkan slug unik.</li>
            </ul>
          </div>

          {isEdit && document && (
            <Button asChild variant="outline" className="w-full">
              <Link to={`/knowledge/${document.id}`} target="_blank" rel="noreferrer">
                <FileText className="h-4 w-4" />
                Lihat halaman publik
              </Link>
            </Button>
          )}
        </aside>
      </form>

      {saveMutation.isPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/30 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-lg bg-white px-5 py-3.5 shadow-elevated">
            <Loader2 className="h-5 w-5 animate-spin text-primary-600" />
            <p className="text-sm font-medium text-navy-800">Menyimpan dokumen...</p>
          </div>
        </div>
      )}
    </div>
  )
}
