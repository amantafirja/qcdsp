import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/contexts/auth-context'
import { ProtectedRoute } from '@/components/shared/protected-route'
import { PublicLayout } from '@/components/layout/public-layout-wrapper'
import { AdminLayout } from '@/components/layout/admin-layout'
import { GatewayPage } from '@/pages/public/gateway-page'
import { KnowledgeListPage } from '@/pages/public/knowledge-list-page'
import { KnowledgeDetailPage } from '@/pages/public/knowledge-detail-page'
import { PurchaseRequestPage } from '@/pages/public/purchase-request-page'
import { TrackingPage } from '@/pages/public/tracking-page'
import { LoginPage } from '@/pages/public/login-page'
import { NotFoundPage } from '@/pages/public/not-found-page'
import { DashboardPage } from '@/pages/admin/dashboard-page'
import { KnowledgeManagementPage } from '@/pages/admin/knowledge-management-page'
import { KnowledgeEditorPage } from '@/pages/admin/knowledge-editor-page'
import { CategoryManagementPage } from '@/pages/admin/category-management-page'
import { PurchaseRequestManagementPage } from '@/pages/admin/purchase-request-management-page'
import { PurchaseRequestDetailPage } from '@/pages/admin/purchase-request-detail-page'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30_000,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route path="/" element={<GatewayPage />} />
              <Route path="/knowledge" element={<KnowledgeListPage />} />
              <Route path="/knowledge/:id" element={<KnowledgeDetailPage />} />
              <Route path="/purchase-request" element={<PurchaseRequestPage />} />
              <Route path="/tracking" element={<TrackingPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>

            <Route path="/admin/login" element={<LoginPage />} />

            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="knowledge" element={<KnowledgeManagementPage />} />
              <Route path="knowledge/new" element={<KnowledgeEditorPage />} />
              <Route path="knowledge/:id/edit" element={<KnowledgeEditorPage />} />
              <Route path="categories" element={<CategoryManagementPage />} />
              <Route path="purchase-requests" element={<PurchaseRequestManagementPage />} />
              <Route path="purchase-requests/:id" element={<PurchaseRequestDetailPage />} />
            </Route>

            <Route path="/admin/*" element={<Navigate to="/admin" replace />} />
          </Routes>
          <Toaster
            position="top-right"
            richColors
            closeButton
            toastOptions={{
              className: 'text-sm',
            }}
          />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
