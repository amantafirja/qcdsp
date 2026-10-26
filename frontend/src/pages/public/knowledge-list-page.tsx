import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowUpRight, FileText, Filter, Layers, SlidersHorizontal } from 'lucide-react'
import { useCategories, useKnowledgeList } from '@/hooks/use-api'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { SearchInput } from '@/components/shared/search-input'
import { PaginationBar } from '@/components/shared/pagination-bar'
import { EmptyState, ErrorState, LoadingCards } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { CONTENT_TYPE_META } from '@/lib/constants'
import { formatDate, stripHtml, truncate } from '@/lib/format'
import { cn } from '@/lib/utils'

export function KnowledgeListPage() {
  useDocumentTitle('Knowledge Center')
  const [searchParams, setSearchParams] = useSearchParams()

  const search = searchParams.get('search') ?? ''
  const category = searchParams.get('category') ?? 'all'
  const contentType = searchParams.get('content_type') ?? 'all'
  const sort = searchParams.get('sort') ?? 'newest'
  const page = Number(searchParams.get('page') ?? 1)

  const { data: categories } = useCategories('public')
  const { data, isLoading, isError, refetch, isFetching } = useKnowledgeList('public', {
    search,
    category: category === 'all' ? undefined : category,
    content_type: contentType === 'all' ? undefined : (contentType as 'pdf' | 'article'),
    sort,
    page,
    page_size: 9,
  })

  const activeCategory = useMemo(
    () => categories?.find((item) => item.slug === category),
    [categories, category],
  )

  const updateParam = (key: string, value?: string) => {
    const params = new URLSearchParams(searchParams)
    if (value && value !== 'all') params.set(key, value)
    else params.delete(key)
    if (key !== 'page') params.delete('page')
    setSearchParams(params, { replace: true })
  }

  const documents = data?.documents ?? []

  return (
    <div>
      <section className="border-b border-navy-100 bg-white">
        <div className="page-shell py-8 sm:py-10">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <Badge variant="info" className="mb-3">
                <Layers className="h-3 w-3" />
                Knowledge Center
              </Badge>
              <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
                {activeCategory ? activeCategory.name : 'Pusat Dokumen Internal QC'}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {activeCategory?.description ||
                  'Telusuri FAQ, SOP, work instruction, manual, troubleshooting, artikel, dan dokumen PDF laboratorium.'}
              </p>
            </div>

            <div className="w-full lg:max-w-md">
              <SearchInput
                placeholder="Cari judul, deskripsi, atau kategori..."
                syncUrlParam="search"
                defaultValue={search}
                isLoading={isFetching}
              />
              <p className="mt-2 text-[11px] text-navy-400">
                Pencarian global · {data?.pagination?.total ?? 0} dokumen ditemukan
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="page-shell py-6 sm:py-8">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => updateParam('category', 'all')}
              className={cn(
                'whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors',
                category === 'all'
                  ? 'border-primary-700 bg-primary-700 text-white'
                  : 'border-navy-200 bg-white text-navy-600 hover:border-navy-300 hover:bg-navy-50',
              )}
            >
              Semua
            </button>
            {(categories ?? []).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => updateParam('category', item.slug)}
                className={cn(
                  'whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors',
                  category === item.slug
                    ? 'border-primary-700 bg-primary-700 text-white'
                    : 'border-navy-200 bg-white text-navy-600 hover:border-navy-300 hover:bg-navy-50',
                )}
              >
                {item.name}
              </button>
            ))}
          </div>

          <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
            <Select value={contentType} onValueChange={(value) => updateParam('content_type', value)}>
              <SelectTrigger className="h-9 flex-1 text-xs sm:w-[130px] sm:flex-none">
                <Filter className="mr-1 h-3.5 w-3.5 text-navy-400" />
                <SelectValue placeholder="Tipe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua tipe</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="article">Artikel</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sort} onValueChange={(value) => updateParam('sort', value)}>
              <SelectTrigger className="h-9 flex-1 text-xs sm:w-[150px] sm:flex-none">
                <SlidersHorizontal className="mr-1 h-3.5 w-3.5 text-navy-400" />
                <SelectValue placeholder="Urutkan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Terbaru</SelectItem>
                <SelectItem value="oldest">Terlama</SelectItem>
                <SelectItem value="title">Judul A-Z</SelectItem>
                <SelectItem value="popular">Paling dilihat</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isError ? (
          <ErrorState message="Gagal memuat dokumen Knowledge Center." onRetry={() => void refetch()} />
        ) : isLoading ? (
          <LoadingCards count={6} />
        ) : documents.length === 0 ? (
          <EmptyState
            title="Dokumen tidak ditemukan"
            description={
              search
                ? `Tidak ada hasil untuk "${search}". Coba kata kunci lain atau reset filter.`
                : 'Belum ada dokumen yang dipublikasikan pada kategori ini.'
            }
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchParams({}, { replace: true })
                }}
              >
                Reset filter
              </Button>
            }
          />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {documents.map((document) => {
                const meta = CONTENT_TYPE_META[document.content_type]
                const preview =
                  document.content_type === 'article'
                    ? stripHtml(document.article_content ?? '')
                    : document.description
                return (
                  <Link
                    key={document.id}
                    to={`/knowledge/${document.id}`}
                    className="group surface-card flex flex-col overflow-hidden transition-all hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-elevated"
                  >
                    <div className="relative flex h-32 items-center justify-center overflow-hidden border-b border-navy-100 bg-gradient-to-br from-navy-50 to-primary-50/50">
                      <FileText className="h-10 w-10 text-navy-300 transition-transform group-hover:scale-110" />
                      <span className={`absolute left-3 top-3 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.badge}`}>
                        {meta.label}
                      </span>
                    </div>

                    <div className="flex flex-1 flex-col p-4">
                      <div className="flex items-center gap-1.5 text-[11px] font-medium text-navy-400">
                        <span className="truncate">{document.category?.name}</span>
                        <span>·</span>
                        <span className="whitespace-nowrap">{formatDate(document.created_at)}</span>
                      </div>
                      <h2 className="mt-1.5 line-clamp-2 text-sm font-semibold leading-snug text-navy-900 group-hover:text-primary-800">
                        {document.title}
                      </h2>
                      <p className="mt-1.5 line-clamp-3 flex-1 text-xs leading-relaxed text-muted-foreground">
                        {truncate(preview || document.description, 160)}
                      </p>
                      <div className="mt-3 flex items-center justify-between border-t border-navy-100 pt-3">
                        <span className="text-[11px] text-navy-400">{document.view_count} dilihat</span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary-700">
                          Lihat detail
                          <ArrowUpRight className="h-3 w-3" />
                        </span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>

            <PaginationBar
              pagination={data?.pagination}
              itemLabel="dokumen"
              className="mt-8"
              onPageChange={(nextPage) => {
                updateParam('page', String(nextPage))
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
            />
          </>
        )}
      </section>
    </div>
  )
}
