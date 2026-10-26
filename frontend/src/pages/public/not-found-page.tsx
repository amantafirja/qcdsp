import { Link } from 'react-router-dom'
import { ArrowLeft, FileQuestion } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDocumentTitle } from '@/hooks/use-document-title'

export function NotFoundPage() {
  useDocumentTitle('Halaman Tidak Ditemukan')
  return (
    <div className="page-shell flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-navy-50 text-navy-400">
        <FileQuestion className="h-8 w-8" />
      </div>
      <p className="mt-5 text-5xl font-bold tracking-tight text-navy-900">404</p>
      <h1 className="mt-2 text-lg font-semibold text-navy-800">Halaman tidak ditemukan</h1>
      <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
        Halaman yang Anda cari mungkin sudah dipindahkan atau tidak tersedia lagi.
      </p>
      <div className="mt-6 flex gap-2">
        <Button asChild>
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
            Kembali ke beranda
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/knowledge">Knowledge Center</Link>
        </Button>
      </div>
    </div>
  )
}
