import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiDelete, apiGet, apiPost, apiPut } from '@/lib/api'
import type {
  ApiResponse,
  Category,
  CategoryWithCount,
  DashboardData,
  KnowledgeDocument,
  LoginResult,
  PaginationMeta,
  PRQuery,
  PurchaseRequest,
  KnowledgeQuery,
  AdminUser,
  AdminAccountInput,
  PRAuditLog,
  OracleStatus,
  OracleSyncResult,
  OracleSyncLog,
} from '@/types'

export const queryKeys = {
  categories: (scope: 'public' | 'admin') => ['categories', scope] as const,
  knowledge: (scope: 'public' | 'admin', query?: KnowledgeQuery) =>
    ['knowledge', scope, query ?? {}] as const,
  knowledgeDetail: (scope: 'public' | 'admin', id?: string) =>
    ['knowledge-detail', scope, id] as const,
  dashboard: ['dashboard'] as const,
  purchaseRequests: (query?: PRQuery) => ['purchase-requests', query ?? {}] as const,
  purchaseRequest: (id?: string) => ['purchase-request', id] as const,
  profile: ['admin-profile'] as const,
  adminAccounts: ['admin-accounts'] as const,
  prAudit: (id?: string) => ['pr-audit', id] as const,
  oracle: ['oracle-status'] as const,
}

export function useCategories(scope: 'public' | 'admin' = 'public') {
  return useQuery({
    queryKey: queryKeys.categories(scope),
    queryFn: async () => {
      const url = scope === 'public' ? '/categories' : '/admin/categories'
      const response = await apiGet<CategoryWithCount[]>(url)
      return response.data ?? []
    },
    staleTime: 60_000,
  })
}

export function useCreateCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { name: string; slug?: string; description?: string }) => {
      const response = await apiPost<Category>('/admin/categories', payload)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
  })
}

export function useUpdateCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: {
      id: string
      name: string
      slug?: string
      description?: string
    }) => {
      const response = await apiPut<Category>(`/admin/categories/${id}`, payload)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      queryClient.invalidateQueries({ queryKey: ['knowledge'] })
    },
  })
}

export function useDeleteCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiDelete(`/admin/categories/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
  })
}

export function useKnowledgeList(
  scope: 'public' | 'admin',
  query: KnowledgeQuery,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.knowledge(scope, query),
    queryFn: async () => {
      const params = new URLSearchParams()
      if (query.search) params.set('search', query.search)
      if (query.category) params.set('category', query.category)
      if (query.category_id) params.set('category_id', query.category_id)
      if (query.content_type) params.set('content_type', query.content_type)
      if (query.sort) params.set('sort', query.sort)
      params.set('page', String(query.page ?? 1))
      params.set('page_size', String(query.page_size ?? 9))

      const url = `${scope === 'public' ? '/knowledge' : '/admin/knowledge'}?${params.toString()}`
      const response = await apiGet<KnowledgeDocument[]>(url)
      return {
        documents: response.data ?? [],
        pagination: (response.meta as PaginationMeta | undefined)?.pagination,
      }
    },
    enabled: options?.enabled ?? true,
    placeholderData: (previous) => previous,
  })
}

export function useKnowledgeDetail(scope: 'public' | 'admin', id?: string) {
  return useQuery({
    queryKey: queryKeys.knowledgeDetail(scope, id),
    queryFn: async () => {
      const url = `${scope === 'public' ? '/knowledge' : '/admin/knowledge'}/${id}`
      const response = await apiGet<KnowledgeDocument>(url)
      return response.data as KnowledgeDocument
    },
    enabled: Boolean(id),
  })
}

export function useSaveKnowledge() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, formData }: { id?: string; formData: FormData }) => {
      const response = id
        ? await apiPut<KnowledgeDocument>(`/admin/knowledge/${id}`, formData)
        : await apiPost<KnowledgeDocument>('/admin/knowledge', formData)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge'] })
      queryClient.invalidateQueries({ queryKey: ['knowledge-detail'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useDeleteKnowledge() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiDelete(`/admin/knowledge/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useTogglePublish() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, isPublished }: { id: string; isPublished: boolean }) => {
      const response = await apiPut<KnowledgeDocument>(`/admin/knowledge/${id}/publish`, {
        is_published: isPublished,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge'] })
      queryClient.invalidateQueries({ queryKey: ['knowledge-detail'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useLogin() {
  return useMutation({
    mutationFn: async (payload: { username: string; password: string }) => {
      const response = await apiPost<LoginResult>('/admin/login', payload)
      return response.data as LoginResult
    },
  })
}

export function useProfile(enabled = true) {
  return useQuery({
    queryKey: queryKeys.profile,
    queryFn: async () => {
      const response = await apiGet<AdminUser>('/admin/me')
      return response.data as AdminUser
    },
    enabled,
    retry: false,
    staleTime: 5 * 60_000,
  })
}

export function useDashboard(enabled = true) {
  return useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: async () => {
      const response = await apiGet<DashboardData>('/admin/dashboard')
      return response.data as DashboardData
    },
    enabled,
    staleTime: 30_000,
  })
}

export function usePurchaseRequests(query: PRQuery, enabled = true) {
  return useQuery({
    queryKey: queryKeys.purchaseRequests(query),
    queryFn: async () => {
      const params = new URLSearchParams()
      if (query.search) params.set('search', query.search)
      if (query.status) params.set('status', query.status)
      if (query.order_type) params.set('order_type', query.order_type)
      if (query.date_from) params.set('date_from', query.date_from)
      if (query.date_to) params.set('date_to', query.date_to)
      if (query.sort) params.set('sort', query.sort)
      params.set('page', String(query.page ?? 1))
      params.set('page_size', String(query.page_size ?? 10))

      const response = await apiGet<PurchaseRequest[]>(`/admin/purchase-requests?${params.toString()}`)
      return {
        requests: response.data ?? [],
        pagination: (response.meta as PaginationMeta | undefined)?.pagination,
      }
    },
    enabled,
    placeholderData: (previous) => previous,
  })
}

export function usePurchaseRequestDetail(id?: string) {
  return useQuery({
    queryKey: queryKeys.purchaseRequest(id),
    queryFn: async () => {
      const response = await apiGet<PurchaseRequest>(`/admin/purchase-requests/${id}`)
      return response.data as PurchaseRequest
    },
    enabled: Boolean(id),
  })
}

export function useUpdatePRStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const response = await apiPut<PurchaseRequest>(`/admin/purchase-requests/${id}/status`, {
        status,
        notes,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requests'] })
      queryClient.invalidateQueries({ queryKey: ['purchase-request'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdatePRNotes() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, internal_notes }: { id: string; internal_notes: string }) => {
      const response = await apiPut<PurchaseRequest>(`/admin/purchase-requests/${id}`, {
        internal_notes,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requests'] })
      queryClient.invalidateQueries({ queryKey: ['purchase-request'] })
    },
  })
}

export async function createPurchaseRequest(formData: FormData): Promise<PurchaseRequest> {
  const response = await apiPost<PurchaseRequest>('/purchase-requests', formData)
  return response.data as PurchaseRequest
}

export async function trackPurchaseRequest(reference: string): Promise<PurchaseRequest> {
  const response: ApiResponse<PurchaseRequest> = await apiGet<PurchaseRequest>(
    `/purchase-requests/track?reference=${encodeURIComponent(reference)}`,
  )
  return response.data as PurchaseRequest
}

export function useAdminAccounts(enabled = true) {
  return useQuery({
    queryKey: queryKeys.adminAccounts,
    queryFn: async () => {
      const response = await apiGet<AdminUser[]>('/admin/accounts')
      return response.data ?? []
    },
    enabled,
  })
}

export function useCreateAdminAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: AdminAccountInput) => {
      const response = await apiPost<AdminUser>('/admin/accounts', payload)
      return response.data as AdminUser
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminAccounts })
    },
  })
}

export function useUpdateAdminAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: AdminAccountInput & { id: string }) => {
      const response = await apiPut<AdminUser>(`/admin/accounts/${id}`, payload)
      return response.data as AdminUser
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminAccounts })
      queryClient.invalidateQueries({ queryKey: queryKeys.profile })
    },
  })
}

export function useDeleteAdminAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiDelete(`/admin/accounts/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminAccounts })
    },
  })
}

export function useMergePurchaseRequests() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ masterId, memberIds }: { masterId: string; memberIds: string[] }) => {
      const response = await apiPost<PurchaseRequest>(`/admin/purchase-requests/${masterId}/merge`, {
        member_ids: memberIds,
      })
      return response.data as PurchaseRequest
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requests'] })
      queryClient.invalidateQueries({ queryKey: ['purchase-request'] })
      queryClient.invalidateQueries({ queryKey: ['pr-audit'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUnmergePurchaseRequests() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ masterId, memberIds }: { masterId: string; memberIds?: string[] }) => {
      const response = await apiPost<PurchaseRequest>(`/admin/purchase-requests/${masterId}/unmerge`, {
        member_ids: memberIds ?? [],
      })
      return response.data as PurchaseRequest
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requests'] })
      queryClient.invalidateQueries({ queryKey: ['purchase-request'] })
      queryClient.invalidateQueries({ queryKey: ['pr-audit'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useDeletePurchaseRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiDelete(`/admin/purchase-requests/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requests'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function usePRAudit(id?: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.prAudit(id),
    queryFn: async () => {
      const response = await apiGet<PRAuditLog[]>(`/admin/purchase-requests/${id}/audit`)
      return response.data ?? []
    },
    enabled: Boolean(id) && enabled,
  })
}

export function useOracleStatus() {
  return useQuery({
    queryKey: queryKeys.oracle,
    queryFn: async () => {
      const response = await apiGet<OracleStatus>('/admin/oracle')
      return response.data as OracleStatus
    },
  })
}

export function useUploadOracle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ file, sync }: { file: File; sync: boolean }) => {
      const formData = new FormData()
      formData.append('file', file)
      const endpoint = sync ? '/admin/oracle/upload-sync' : '/admin/oracle/upload'
      if (sync) {
        const response = await apiPost<OracleSyncResult>(endpoint, formData)
        return response.data as OracleSyncResult
      }
      const response = await apiPost<OracleStatus>(endpoint, formData)
      return response.data as OracleStatus
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.oracle })
      queryClient.invalidateQueries({ queryKey: ['purchase-requests'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useSyncOracle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const response = await apiPost<OracleSyncResult>('/admin/oracle/sync')
      return response.data as OracleSyncResult
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.oracle })
      queryClient.invalidateQueries({ queryKey: ['purchase-requests'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useClearOracle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await apiDelete('/admin/oracle')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.oracle })
    },
  })
}

export function useOracleSyncLogs(limit = 20) {
  return useQuery({
    queryKey: ['oracle-logs', limit],
    queryFn: async () => {
      const response = await apiGet<OracleSyncLog[]>(`/admin/oracle/logs?limit=${limit}`)
      return response.data ?? []
    },
  })
}

export function useUpdatePurchaseRequestPO() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: {
      id: string
      po_number?: string | null
      po_date?: string | null
      po_value?: number | null
      delivery_estimate_date?: string | null
    }) => {
      const response = await apiPut<PurchaseRequest>(`/admin/purchase-requests/${id}/po`, payload)
      return response.data as PurchaseRequest
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requests'] })
      queryClient.invalidateQueries({ queryKey: ['purchase-request'] })
      queryClient.invalidateQueries({ queryKey: ['pr-audit'] })
    },
  })
}

export function useResetPurchaseRequestPO() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiPost<PurchaseRequest>(`/admin/purchase-requests/${id}/po/reset`)
      return response.data as PurchaseRequest
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requests'] })
      queryClient.invalidateQueries({ queryKey: ['purchase-request'] })
      queryClient.invalidateQueries({ queryKey: ['pr-audit'] })
    },
  })
}

export async function uploadArticleImage(file: File): Promise<string> {  const formData = new FormData()
  formData.append('image', file)
  const response = await apiPost<{ url: string }>('/admin/uploads/image', formData)
  return response.data?.url ?? ''
}
