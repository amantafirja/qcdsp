import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ClipboardList,
  FileText,
  FolderTree,
  LifeBuoy,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useCategories, useKnowledgeList } from '@/hooks/use-api'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { CONTENT_TYPE_META } from '@/lib/constants'
import { formatDate, stripHtml, truncate } from '@/lib/format'

const categoryIcons: Record<string, typeof FileText> = {
  faq: LifeBuoy,
  sop: ClipboardList,
  'work-instruction': BookOpen,
  manual: FileText,
  troubleshooting: ShieldCheck,
  artikel: Sparkles,
  'dokumen-pdf': FolderTree,
}

export function GatewayPage() {
  useDocumentTitle('Beranda')
  const { data: categories, isLoading: categoriesLoading } = useCategories('public')
  const { data: latest, isLoading: latestLoading } = useKnowledgeList('public', {
    page: 1,
    page_size: 4,
    sort: 'newest',
  })

  const topCategories = useMemo(() => (categories ?? []).slice(0, 7), [categories])

  return (
    <div>
      <section className="relative overflow-hidden bg-navy-900">
        <div className="absolute inset-0 grid-pattern opacity-40" />
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary-600/20 blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 h-80 w-80 rounded-full bg-sky-500/10 blur-3xl" />

        <div className="page-shell relative py-14 sm:py-20 lg:py-24">
          <div className="max-w-3xl animate-fade-in">
            <Badge className="border-white/15 bg-white/10 text-white backdrop-blur">
              <Sparkles className="h-3 w-3" />
              Internal Quality Control Portal
            </Badge>

            <h1 className="mt-5 text-3xl font-bold leading-tight tracking-tight text-white text-balance sm:text-4xl lg:text-5xl">
              Satu portal untuk dokumentasi QC dan pengajuan Purchase Request
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-navy-200 sm:text-base">
              Temukan SOP, work instruction, manual, dan artikel teknis dalam Knowledge Center. Ajukan
              Purchase Request tanpa login dan pantau statusnya secara real-time.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-white text-navy-900 hover:bg-navy-100">
                <Link to="/knowledge">
                  <Search className="h-4 w-4" />
                  Jelajahi Knowledge Center
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <Link to="/purchase-request">
                  <ClipboardList className="h-4 w-4" />
                  Buat Purchase Request
                </Link>
              </Button>
            </div>

            <div className="mt-10 grid max-w-xl grid-cols-3 gap-4 border-t border-white/10 pt-6">
              <div>
                <p className="text-2xl font-bold text-white">{latest?.pagination?.total ?? '—'}</p>
                <p className="mt-0.5 text-xs text-navy-300">Dokumen tersedia</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{categories?.length ?? '—'}</p>
                <p className="mt-0.5 text-xs text-navy-300">Kategori konten</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">7</p>
                <p className="mt-0.5 text-xs text-navy-300">Tahap status PR</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="page-shell -mt-8 relative z-10">
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            to="/knowledge"
            className="group surface-card overflow-hidden p-5 transition-all hover:-translate-y-0.5 hover:shadow-elevated sm:p-6"
          >
            <div className="flex items-start justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-50 text-primary-700 ring-1 ring-primary-100">
                <BookOpen className="h-5 w-5" />
              </span>
              <ArrowUpRight className="h-5 w-5 text-navy-300 transition-colors group-hover:text-primary-600" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-navy-900">Knowledge Center</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              Pusat dokumen internal: FAQ, SOP, work instruction, manual, troubleshooting, artikel, dan
              dokumen PDF dengan pencarian global.
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {['FAQ', 'SOP', 'Manual', 'Troubleshooting', 'Artikel'].map((tag) => (
                <span key={tag} className="rounded-md bg-navy-50 px-2 py-1 text-[11px] font-medium text-navy-600">
                  {tag}
                </span>
              ))}
            </div>
          </Link>

          <Link
            to="/purchase-request"
            className="group surface-card overflow-hidden p-5 transition-all hover:-translate-y-0.5 hover:shadow-elevated sm:p-6"
          >
            <div className="flex items-start justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                <ClipboardList className="h-5 w-5" />
              </span>
              <ArrowUpRight className="h-5 w-5 text-navy-300 transition-colors group-hover:text-emerald-600" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-navy-900">Administration Center</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              Ajukan Purchase Request tanpa login, unggah bukti SPV approval, dan dapatkan nomor referensi
              untuk tracking status pengajuan.
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {['Tanpa login', 'Upload bukti SPV', 'Tracking status'].map((tag) => (
                <span key={tag} className="rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">
                  {tag}
                </span>
              ))}
            </div>
          </Link>
        </div>
      </section>

      <section className="page-shell mt-14">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-navy-900 sm:text-2xl">Jelajahi kategori</h2>
            <p className="mt-1 text-sm text-muted-foreground">Pilih kategori untuk mempersempit pencarian dokumen.</p>
          </div>
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/knowledge">
              Lihat semua
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {categoriesLoading
            ? Array.from({ length: 7 }).map((_, index) => (
                <div key={index} className="surface-card p-4">
                  <Skeleton className="h-9 w-9 rounded-lg" />
                  <Skeleton className="mt-3 h-4 w-2/3" />
                  <Skeleton className="mt-2 h-3 w-full" />
                </div>
              ))
            : topCategories.map((category) => {
                const Icon = categoryIcons[category.slug] ?? FolderTree
                return (
                  <Link
                    key={category.id}
                    to={`/knowledge?category=${category.slug}`}
                    className="group surface-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-elevated"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-50 text-navy-600 transition-colors group-hover:bg-primary-50 group-hover:text-primary-700">
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <h3 className="mt-3 truncate text-sm font-semibold text-navy-900">{category.name}</h3>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {category.description || 'Kumpulan dokumen kategori ini.'}
                    </p>
                    <p className="mt-3 text-[11px] font-medium text-primary-700">
                      {category.document_count} dokumen
                    </p>
                  </Link>
                )
              })}
        </div>
      </section>

      <section className="page-shell mt-14">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-navy-900 sm:text-2xl">Dokumen terbaru</h2>
            <p className="mt-1 text-sm text-muted-foreground">Konten yang baru dipublikasikan oleh tim QC.</p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/knowledge">
              Semua dokumen
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {latestLoading
            ? Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="surface-card p-5">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="mt-3 h-5 w-4/5" />
                  <Skeleton className="mt-2 h-3 w-full" />
                  <Skeleton className="mt-2 h-3 w-3/4" />
                </div>
              ))
            : (latest?.documents ?? []).map((document) => {
                const meta = CONTENT_TYPE_META[document.content_type]
                const preview = document.content_type === 'article' ? stripHtml(document.article_content ?? '') : document.description
                return (
                  <Link
                    key={document.id}
                    to={`/knowledge/${document.id}`}
                    className="group surface-card flex gap-4 p-4 transition-all hover:border-primary-200 hover:shadow-elevated sm:p-5"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-500 transition-colors group-hover:bg-primary-50 group-hover:text-primary-700">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.badge}`}>
                          {meta.label}
                        </span>
                        <span className="text-[11px] font-medium text-navy-400">{document.category?.name}</span>
                        <span className="text-[11px] text-navy-300">·</span>
                        <span className="text-[11px] text-navy-400">{formatDate(document.created_at)}</span>
                      </div>
                      <h3 className="mt-1.5 line-clamp-1 text-sm font-semibold text-navy-900 group-hover:text-primary-800">
                        {document.title}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {truncate(preview || document.description, 150)}
                      </p>
                    </div>
                  </Link>
                )
              })}
        </div>
      </section>

      <section className="page-shell mt-14">
        <div className="overflow-hidden rounded-xl border border-navy-100 bg-gradient-to-br from-navy-900 to-navy-800 p-6 sm:p-8">
          <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
            <div className="max-w-xl">
              <h2 className="text-xl font-bold text-white sm:text-2xl">Sudah pernah mengajukan Purchase Request?</h2>
              <p className="mt-2 text-sm leading-relaxed text-navy-200">
                Masukkan nomor referensi pengajuan Anda untuk melihat status terkini, riwayat proses, dan
                lampiran yang tersimpan.
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
              <Button asChild size="lg" className="bg-white text-navy-900 hover:bg-navy-100">
                <Link to="/tracking">
                  <Search className="h-4 w-4" />
                  Tracking PR
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <Link to="/admin/login">
                  <ShieldCheck className="h-4 w-4" />
                  Login Admin
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
