import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Copy,
  FileText,
  Info,
  Loader2,
  Package,
  Search,
  ShieldCheck,
  User,
} from 'lucide-react'
import { toast } from 'sonner'
import { createPurchaseRequest } from '@/hooks/use-api'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FileUpload } from '@/components/shared/file-upload'
import { ORDER_TYPES, ALLOWED_DOCUMENT_EXTENSIONS, ALLOWED_SPV_EXTENSIONS } from '@/lib/constants'
import { formatDateTime } from '@/lib/format'
import type { PurchaseRequest } from '@/types'

const schema = z
  .object({
    description: z
      .string()
      .trim()
      .min(10, 'Deskripsi pemesanan minimal 10 karakter')
      .max(2000, 'Deskripsi pemesanan maksimal 2000 karakter'),
    order_type: z.string().min(1, 'Jenis pemesanan wajib dipilih'),
    custom_order_type: z.string().optional(),
    brand_catalog: z
      .string()
      .trim()
      .min(1, 'Brand (merk) dan nomor katalog wajib diisi')
      .max(255, 'Maksimal 255 karakter'),
    quantity: z
      .number({ invalid_type_error: 'Jumlah wajib berupa angka' })
      .int('Jumlah harus bilangan bulat')
      .min(1, 'Jumlah minimal 1')
      .max(1_000_000, 'Jumlah tidak wajar'),
    requester_name: z
      .string()
      .trim()
      .min(1, 'Nama pemesan wajib diisi')
      .max(150, 'Maksimal 150 karakter'),
    reason: z
      .string()
      .trim()
      .min(10, 'Alasan pemesanan minimal 10 karakter')
      .max(2000, 'Alasan pemesanan maksimal 2000 karakter'),
  })
  .superRefine((values, ctx) => {
    if (values.order_type === 'Lain-Lain' && !values.custom_order_type?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['custom_order_type'],
        message: 'Jenis pemesanan lain-lain wajib diisi',
      })
    }
  })

type FormValues = z.infer<typeof schema>

const steps = [
  { key: 'deskripsi', label: 'Deskripsi' },
  { key: 'jenis', label: 'Jenis & Produk' },
  { key: 'pemesan', label: 'Pemesan' },
  { key: 'lampiran', label: 'Lampiran' },
]

export function PurchaseRequestPage() {
  useDocumentTitle('Buat Purchase Request')
  const [spvFile, setSpvFile] = useState<File | null>(null)
  const [quotationFile, setQuotationFile] = useState<File | null>(null)
  const [fileErrors, setFileErrors] = useState<{ spv?: string }>({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<PurchaseRequest | null>(null)

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      description: '',
      order_type: '',
      custom_order_type: '',
      brand_catalog: '',
      quantity: 1,
      requester_name: '',
      reason: '',
    },
  })

  const orderType = watch('order_type')
  const description = watch('description')
  const reason = watch('reason')

  const onSubmit = async (values: FormValues) => {
    const nextErrors: { spv?: string } = {}
    if (!spvFile) nextErrors.spv = 'Bukti SPV approve pemesanan wajib diunggah'
    if (Object.keys(nextErrors).length > 0) {
      setFileErrors(nextErrors)
      toast.error('Lengkapi lampiran wajib terlebih dahulu')
      return
    }

    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('description', values.description)
      formData.append('order_type', values.order_type)
      if (values.order_type === 'Lain-Lain') {
        formData.append('custom_order_type', values.custom_order_type ?? '')
      }
      formData.append('brand_catalog', values.brand_catalog)
      formData.append('quantity', String(values.quantity))
      formData.append('requester_name', values.requester_name)
      formData.append('reason', values.reason)
      if (spvFile) formData.append('spv_approval', spvFile)
      if (quotationFile) formData.append('quotation', quotationFile)

      const created = await createPurchaseRequest(formData)
      setResult(created)
      toast.success('Purchase Request berhasil dibuat')
      reset()
      setSpvFile(null)
      setQuotationFile(null)
      setFileErrors({})
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal membuat Purchase Request'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  if (result) {
    return (
      <div className="page-shell py-10 sm:py-14">
        <div className="mx-auto max-w-2xl">
          <div className="surface-card overflow-hidden">
            <div className="border-b border-emerald-100 bg-emerald-50/60 px-6 py-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h1 className="mt-4 text-xl font-bold text-navy-900 sm:text-2xl">
                Purchase Request berhasil dikirim
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Data telah tersimpan. Simpan nomor referensi berikut untuk tracking status.
              </p>
            </div>

            <div className="p-6">
              <div className="rounded-xl border-2 border-dashed border-primary-200 bg-primary-50/50 p-5 text-center">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary-700">
                  Nomor Referensi
                </p>
                <p className="mt-1.5 font-mono text-xl font-bold tracking-wide text-navy-900 sm:text-2xl">
                  {result.reference_number}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={async () => {
                    await navigator.clipboard.writeText(result.reference_number)
                    toast.success('Nomor referensi disalin')
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Salin nomor
                </Button>
              </div>

              <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-lg bg-navy-50/60 p-3">
                  <dt className="text-xs text-navy-400">Status</dt>
                  <dd className="mt-0.5 font-semibold text-navy-900">{result.status}</dd>
                </div>
                <div className="rounded-lg bg-navy-50/60 p-3">
                  <dt className="text-xs text-navy-400">Tanggal Pengajuan</dt>
                  <dd className="mt-0.5 font-semibold text-navy-900">{formatDateTime(result.created_at)}</dd>
                </div>
                <div className="rounded-lg bg-navy-50/60 p-3">
                  <dt className="text-xs text-navy-400">Pemesan</dt>
                  <dd className="mt-0.5 font-semibold text-navy-900">{result.requester_name}</dd>
                </div>
                <div className="rounded-lg bg-navy-50/60 p-3">
                  <dt className="text-xs text-navy-400">Jenis Pemesanan</dt>
                  <dd className="mt-0.5 font-semibold text-navy-900">
                    {result.order_type === 'Lain-Lain' ? result.custom_order_type : result.order_type}
                  </dd>
                </div>
              </dl>

              <Alert variant="info" className="mt-5">
                <Info className="h-4 w-4" />
                <AlertTitle>Simpan nomor referensi</AlertTitle>
                <AlertDescription>
                  Nomor referensi digunakan untuk tracking status tanpa login. Anda dapat mengaksesnya
                  kembali melalui menu Tracking PR.
                </AlertDescription>
              </Alert>

              <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                <Button asChild className="flex-1">
                  <Link to={`/tracking?ref=${result.reference_number}`}>
                    <Search className="h-4 w-4" />
                    Tracking status
                  </Link>
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => setResult(null)}>
                  <ClipboardList className="h-4 w-4" />
                  Buat pengajuan lain
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <section className="border-b border-navy-100 bg-white">
        <div className="page-shell py-8">
          <Badge variant="success" className="mb-3">
            <ClipboardList className="h-3 w-3" />
            Administration Center
          </Badge>
          <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
            Formulir Purchase Request
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Tidak perlu login. Lengkapi seluruh field wajib, unggah bukti SPV approval, lalu submit untuk
            mendapatkan nomor referensi.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            {steps.map((step, index) => (
              <div key={step.key} className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-[11px] font-bold text-primary-800">
                  {index + 1}
                </span>
                <span className="text-xs font-medium text-navy-600">{step.label}</span>
                {index < steps.length - 1 && <span className="mx-1 h-px w-6 bg-navy-200" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="page-shell py-6 sm:py-8">
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            <section className="surface-card p-5 sm:p-6">
              <SectionHeading
                icon={<FileText className="h-4 w-4" />}
                title="A. Deskripsi Pemesanan"
                description="Jelaskan kebutuhan barang atau jasa secara ringkas dan jelas."
                required
              />
              <div className="mt-4 space-y-1.5">
                <Label htmlFor="description">
                  Deskripsi <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="description"
                  placeholder="Contoh: Pembelian reagen buffer pH 7,00 untuk kebutuhan pengujian harian laboratorium QC."
                  rows={4}
                  maxLength={2000}
                  aria-invalid={Boolean(errors.description)}
                  {...register('description')}
                />
                <div className="flex items-center justify-between">
                  {errors.description ? (
                    <p className="field-error">{errors.description.message}</p>
                  ) : (
                    <p className="field-hint">Minimal 10 karakter</p>
                  )}
                  <p className="field-hint">{description?.length ?? 0}/2000</p>
                </div>
              </div>
            </section>

            <section className="surface-card p-5 sm:p-6">
              <SectionHeading
                icon={<Package className="h-4 w-4" />}
                title="B. Jenis Pemesanan & Produk"
                description="Pilih jenis pemesanan, lalu isi brand/merk beserta nomor katalog."
                required
              />

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="order_type">
                    Jenis Pemesanan <span className="text-destructive">*</span>
                  </Label>
                  <Controller
                    control={control}
                    name="order_type"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="order_type" aria-invalid={Boolean(errors.order_type)}>
                          <SelectValue placeholder="Pilih jenis pemesanan" />
                        </SelectTrigger>
                        <SelectContent>
                          {ORDER_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.order_type && <p className="field-error">{errors.order_type.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="brand_catalog">
                    Brand (Merk) & Nomor Katalog <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="brand_catalog"
                    placeholder="Contoh: MERCK 1.05XXXXXXX"
                    maxLength={255}
                    aria-invalid={Boolean(errors.brand_catalog)}
                    {...register('brand_catalog')}
                  />
                  {errors.brand_catalog ? (
                    <p className="field-error">{errors.brand_catalog.message}</p>
                  ) : (
                    <p className="field-hint">Format: BRAND NOMOR_KATALOG</p>
                  )}
                </div>

                {orderType === 'Lain-Lain' && (
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="custom_order_type">
                      Jenis Pemesanan Lain-Lain <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="custom_order_type"
                      placeholder="Contoh: Spare Part Instrumen"
                      maxLength={120}
                      aria-invalid={Boolean(errors.custom_order_type)}
                      {...register('custom_order_type')}
                    />
                    {errors.custom_order_type && (
                      <p className="field-error">{errors.custom_order_type.message}</p>
                    )}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="quantity">
                    Jumlah <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="quantity"
                    type="number"
                    min={1}
                    step={1}
                    aria-invalid={Boolean(errors.quantity)}
                    {...register('quantity', { valueAsNumber: true })}
                  />
                  {errors.quantity ? (
                    <p className="field-error">{errors.quantity.message}</p>
                  ) : (
                    <p className="field-hint">Jumlah unit yang diajukan</p>
                  )}
                </div>
              </div>
            </section>

            <section className="surface-card p-5 sm:p-6">
              <SectionHeading
                icon={<User className="h-4 w-4" />}
                title="C. Pemesan & Alasan"
                description="Isi nama pemesan dan alasan kebutuhan pengadaan."
                required
              />

              <div className="mt-4 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="requester_name">
                    Pemesan <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="requester_name"
                    placeholder="Nama lengkap pemesan"
                    maxLength={150}
                    aria-invalid={Boolean(errors.requester_name)}
                    {...register('requester_name')}
                  />
                  {errors.requester_name && <p className="field-error">{errors.requester_name.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="reason">
                    Alasan Pemesanan <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="reason"
                    placeholder="Jelaskan alasan kebutuhan, misalnya stok menipis atau penambahan beban pengujian."
                    rows={3}
                    maxLength={2000}
                    aria-invalid={Boolean(errors.reason)}
                    {...register('reason')}
                  />
                  <div className="flex items-center justify-between">
                    {errors.reason ? (
                      <p className="field-error">{errors.reason.message}</p>
                    ) : (
                      <p className="field-hint">Minimal 10 karakter</p>
                    )}
                    <p className="field-hint">{reason?.length ?? 0}/2000</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="surface-card p-5 sm:p-6">
              <SectionHeading
                icon={<ShieldCheck className="h-4 w-4" />}
                title="D. Lampiran"
                description="Bukti SPV approval wajib. Penawaran bersifat opsional."
              />

              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                <FileUpload
                  id="spv_approval"
                  label="Bukti SPV Approve Pemesanan"
                  required
                  accept={ALLOWED_SPV_EXTENSIONS}
                  value={spvFile}
                  onChange={(file) => {
                    setSpvFile(file)
                    setFileErrors((previous) => ({ ...previous, spv: undefined }))
                  }}
                  error={fileErrors.spv}
                  hint="PDF, JPG, JPEG, atau PNG · maksimal 10 MB"
                />
                <FileUpload
                  id="quotation"
                  label="Penawaran (opsional)"
                  accept={ALLOWED_DOCUMENT_EXTENSIONS}
                  value={quotationFile}
                  onChange={setQuotationFile}
                  hint="PDF, XLSX, JPG, JPEG, atau PNG · maksimal 10 MB"
                />
              </div>
            </section>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div className="surface-card p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-navy-900">
                <ClipboardCheck className="h-4 w-4 text-primary-600" />
                Ringkasan Pengajuan
              </h2>
              <dl className="mt-4 space-y-2.5 text-sm">
                <SummaryRow label="Jenis" value={orderType || '—'} />
                <SummaryRow label="Brand/Katalog" value={watch('brand_catalog') || '—'} />
                <SummaryRow label="Jumlah" value={String(watch('quantity') || '—')} />
                <SummaryRow label="Pemesan" value={watch('requester_name') || '—'} />
                <SummaryRow label="Bukti SPV" value={spvFile ? 'Terlampir' : 'Belum ada'} />
                <SummaryRow label="Penawaran" value={quotationFile ? 'Terlampir' : 'Tidak ada'} />
              </dl>

              <Button type="submit" className="mt-5 w-full" size="lg" loading={submitting}>
                {submitting ? 'Mengirim...' : 'Submit Purchase Request'}
                {!submitting && <ArrowRight className="h-4 w-4" />}
              </Button>
              <p className="mt-2 text-center text-[11px] text-navy-400">
                Nomor referensi akan ditampilkan setelah submit.
              </p>
            </div>

            <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-4">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-sky-800">
                <Info className="h-3.5 w-3.5" />
                Ketentuan
              </h3>
              <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-sky-900/80">
                <li>• Ukuran maksimal setiap file adalah 10 MB.</li>
                <li>• Bukti SPV approval wajib dilampirkan.</li>
                <li>• Field bertanda bintang wajib diisi.</li>
                <li>• Simpan nomor referensi untuk tracking.</li>
              </ul>
            </div>

            <Button asChild variant="outline" className="w-full">
              <Link to="/tracking">
                <Search className="h-4 w-4" />
                Sudah punya nomor referensi?
              </Link>
            </Button>
          </aside>
        </form>
      </div>

      {submitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/40 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-xl bg-white px-8 py-6 shadow-elevated">
            <Loader2 className="h-7 w-7 animate-spin text-primary-600" />
            <p className="text-sm font-medium text-navy-800">Menyimpan Purchase Request...</p>
          </div>
        </div>
      )}
    </div>
  )
}

function SectionHeading({
  icon,
  title,
  description,
  required,
}: {
  icon: React.ReactNode
  title: string
  description: string
  required?: boolean
}) {
  return (
    <div className="flex items-start gap-3 border-b border-navy-100 pb-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
        {icon}
      </span>
      <div>
        <h2 className="text-sm font-semibold text-navy-900">
          {title}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-xs text-navy-400">{label}</dt>
      <dd className="max-w-[60%] break-words text-right text-xs font-medium text-navy-800">{value}</dd>
    </div>
  )
}
