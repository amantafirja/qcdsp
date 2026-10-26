import { Outlet } from 'react-router-dom'
import { PublicFooter, PublicHeader } from '@/components/layout/public-layout'

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  )
}
