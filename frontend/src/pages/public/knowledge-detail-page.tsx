import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Calendar,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  Maximize2,
  Printer,
  Tag,
} from 'lucide-react'
import { useKnowledgeDetail } from '@/hooks/use-api'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/shared/empty-state'
import { CONTENT_TYPE_META } from '@/lib/constants'
import { formatDate, formatFileSize } from '@/lib/format'
import { resolveApiUrl } from '@/lib/api'

export function KnowledgeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: document, isLoading, isError, refetch } = useKnowledgeDetail('public', id)
  const [pdfLoading, setPdfLoading] = useState(true)
  const [fullscreen, setFullscreen] = useState(false)
  const viewerRef = useRef<HTMLDivElement>(null)

  useDocumentTitle(document?.title ?? 'Detail Dokumen')

  useEffect(() => {
    setPdfLoading(true)
  }, [id])

  const pdfUrl = document ? resolveApiUrl(document.pdf_url) : ''
  const downloadUrl = document ? `${resolveApiUrl(document.pdf_url)}?download=1` : ''

  if (isLoading) {
    return (
      <div className="page-shell py-8">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-6 h-8 w-3/4" />
        <Skeleton className="mt-3 h-4 w-1/2" />
        <Skeleton className="mt-8 h-[520px] w-full rounded-xl" />
      </div>
    )
  }

  if (isError || !document) {
    return (
      <div className="page-shell py-16">
        <ErrorState
          message="Dokumen tidak ditemukan atau belum dipublikasikan."
          onRetry={() => void refetch()}
        />
        <div className="mt-4 text-center">
          <Button variant="outline" onClick={() => navigate('/knowledge')}>
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Knowledge Center
          </Button>
        </div>
      </div>
    )
  }

  const meta = CONTENT_TYPE_META[document.content_type]

  return (
    <div>
      <div className="border-b border-navy-100 bg-white">
        <div className="page-shell py-5">
          <nav className="flex flex-wrap items-center gap-1.5 text-xs text-navy-400">
            <Link to="/" className="hover:text-primary-700">Beranda</Link>
            <span>/</span>
            <Link to="/knowledge" className="hover:text-primary-700">Knowledge Center</Link>
            <span>/</span>
            <Link
              to={`/knowledge?category=${document.category?.slug ?? ''}`}
              className="hover:text-primary-700"
            >
              {document.category?.name}
            </Link>
            <span>/</span>
            <span className="max-w-[220px] truncate text-navy-600">{document.title}</span>
          </nav>
        </div>
      </div>

      <div className="page-shell py-6 sm:py-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <div className="surface-card p-5 sm:p-7">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${meta.badge}`}>
                  {meta.label}
                </span>
                <Badge variant="secondary">{document.category?.name}</Badge>
                <span className="inline-flex items-center gap-1 text-xs text-navy-400">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDate(document.created_at)}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-navy-400">
                  <Eye className="h-3.5 w-3.5" />
                  {document.view_count} dilihat
                </span>
              </div>

              <h1 className="mt-3 text-xl font-bold leading-snug tracking-tight text-navy-900 sm:text-2xl lg:text-3xl">
                {document.title}
              </h1>

              {document.description && (
                <p className="mt-3 border-l-2 border-primary-200 pl-3 text-sm leading-relaxed text-navy-600">
                  {document.description}
                </p>
              )}

              <div className="mt-6">
                {document.content_type === 'article' ? (
                  <article
                    className="article-body"
                    dangerouslySetInnerHTML={{ __html: document.article_content ?? '' }}
                  />
                ) : (
                  <div>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm font-semibold text-navy-900">
                        <FileText className="h-4 w-4 text-rose-600" />
                        PDF Preview
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <a href={pdfUrl} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" />
                            Buka tab baru
                          </a>
                        </Button>
                        <Button size="sm" asChild>
                          <a href={downloadUrl}>
                            <Download className="h-3.5 w-3.5" />
                            Download PDF
                          </a>
                        </Button>
                      </div>
                    </div>

                    <div
                      ref={viewerRef}
                      className={
                        fullscreen
                          ? 'fixed inset-0 z-50 bg-navy-950 p-3'
                          : 'relative overflow-hidden rounded-lg border border-navy-200 bg-navy-100'
                      }
                    >
                      {fullscreen && (
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-sm font-medium text-white">{document.title}</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
                            onClick={() => setFullscreen(false)}
                          >
                            Tutup
                          </Button>
                        </div>
                      )}

                      {pdfLoading && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-navy-50">
                          <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
                          <p className="text-xs text-muted-foreground">Memuat preview PDF...</p>
                        </div>
                      )}

                      <iframe
                        src={`${pdfUrl}#zoom=page-width`}
                        title={`Preview PDF ${document.title}`}
                        className={fullscreen ? 'h-[calc(100vh-80px)] w-full rounded bg-white' : 'h-[560px] w-full bg-white sm:h-[680px]'}
                        onLoad={() => setPdfLoading(false)}
                      />

                      {!fullscreen && (
                        <button
                          type="button"
                          onClick={() => setFullscreen(true)}
                          className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-lg bg-navy-900/90 px-3 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur transition-colors hover:bg-navy-900"
                        >
                          <Maximize2 className="h-3.5 w-3.5" />
                          Layar penuh
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="surface-card p-5">
              <h2 className="text-sm font-semibold text-navy-900">Informasi Dokumen</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-xs text-navy-400">Kategori</dt>
                  <dd className="mt-0.5 font-medium text-navy-800">{document.category?.name}</dd>
                </div>
                <div>
                  <dt className="text-xs text-navy-400">Tipe Konten</dt>
                  <dd className="mt-0.5 font-medium text-navy-800">{meta.label}</dd>
                </div>
                <div>
                  <dt className="text-xs text-navy-400">Dipublikasikan</dt>
                  <dd className="mt-0.5 font-medium text-navy-800">
                    {formatDate(document.published_at ?? document.created_at, 'dd MMMM yyyy')}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-navy-400">Terakhir diperbarui</dt>
                  <dd className="mt-0.5 font-medium text-navy-800">{formatDate(document.updated_at)}</dd>
                </div>
                {document.content_type === 'pdf' && (
                  <>
                    <div>
                      <dt className="text-xs text-navy-400">Nama File</dt>
                      <dd className="mt-0.5 break-all font-medium text-navy-800">
                        {document.pdf_original_name ?? '-'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-navy-400">Ukuran</dt>
                      <dd className="mt-0.5 font-medium text-navy-800">
                        {formatFileSize(document.pdf_size_bytes)}
                      </dd>
                    </div>
                  </>
                )}
              </dl>

              {document.content_type === 'pdf' && (
                <div className="mt-5 space-y-2">
                  <Button className="w-full" asChild>
                    <a href={downloadUrl}>
                      <Download className="h-4 w-4" />
                      Download PDF
                    </a>
                  </Button>
                  <Button variant="outline" className="w-full" asChild>
                    <a href={pdfUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      Buka PDF
                    </a>
                  </Button>
                </div>
              )}

              {document.content_type === 'article' && (
                <Button variant="outline" className="mt-5 w-full" onClick={() => window.print()}>
                  <Printer className="h-4 w-4" />
                  Cetak Artikel
                </Button>
              )}
            </div>

            <div className="surface-card p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-navy-900">
                <Tag className="h-4 w-4 text-navy-400" />
                Kategori Lain
              </h2>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Link to="/knowledge">
                  <Badge variant="outline" className="cursor-pointer hover:bg-navy-50">
                    Semua dokumen
                  </Badge>
                </Link>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                Gunakan pencarian global di Knowledge Center untuk menemukan dokumen serupa dengan kata
                kunci yang berbeda.
              </p>
              <Button variant="ghost" size="sm" className="mt-2 w-full justify-start px-0" asChild>
                <Link to="/knowledge">
                  <ArrowLeft className="h-4 w-4" />
                  Kembali ke daftar
                </Link>
              </Button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
