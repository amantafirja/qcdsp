import type { AxiosError } from 'axios'

export interface ApiResponse<T> {
  success: boolean
  message?: string
  data?: T
  errors?: Record<string, string> | null
  meta?: Record<string, unknown>
}

export interface Pagination {
  page: number
  page_size: number
  total: number
  total_pages: number
}

export interface PaginationMeta {
  pagination: Pagination
}

export type AdminRole = 'super_admin' | 'admin' | 'pr_viewer'

export interface AdminUser {
  id: string
  username: string
  name: string
  role: AdminRole
  is_active: boolean
  last_login_at: string | null
  created_at: string
  updated_at: string
}

export interface AdminAccountInput {
  username: string
  name: string
  password?: string
  role: AdminRole
  is_active?: boolean
}

export interface LoginResult {
  token: string
  expires_at: string
  admin: AdminUser
}

export interface Category {
  id: string
  name: string
  slug: string
  description: string
  created_at: string
  updated_at: string
}

export interface CategoryWithCount extends Category {
  document_count: number
}

export type ContentType = 'pdf' | 'article'

export interface KnowledgeDocument {
  id: string
  title: string
  slug: string
  category_id: string
  category?: Category
  description: string
  content_type: ContentType
  pdf_url?: string
  pdf_original_name: string | null
  pdf_size_bytes: number | null
  article_content: string | null
  is_published: boolean
  view_count: number
  created_by: string | null
  published_at: string | null
  created_at: string
  updated_at: string
}

export type AttachmentType = 'spv_approval' | 'quotation'

export interface Attachment {
  id: string
  purchase_request_id: string
  attachment_type: AttachmentType
  original_name: string
  mime_type: string
  size_bytes: number
  download_url: string
  created_at: string
}

export interface StatusHistoryEntry {
  id: string
  status: string
  notes: string | null
  changed_by: string | null
  admin_name?: string | null
  created_at: string
}

export interface PurchaseRequest {
  id: string
  reference_number: string
  description: string
  order_type: string
  custom_order_type: string | null
  brand_catalog: string
  quantity: number
  requester_name: string
  reason: string
  status: string
  internal_notes: string | null
  attachments: Attachment[]
  status_history?: StatusHistoryEntry[]
  created_at: string
  updated_at: string
}

export interface DashboardStats {
  total_documents: number
  total_articles: number
  total_pdf: number
  total_submitted: number
  total_review: number
  total_approved: number
  total_rejected: number
  total_ordered: number
  total_received: number
  total_closed: number
}

export interface MonthlyCount {
  month: string
  count: number
}

export interface TypeCount {
  label: string
  count: number
}

export interface DashboardData {
  stats: DashboardStats
  monthly_pr: MonthlyCount[]
  order_type_distribution: TypeCount[]
  status_distribution: TypeCount[]
  recent_purchase_requests: PurchaseRequest[]
}

export interface KnowledgeQuery {
  search?: string
  category?: string
  category_id?: string
  content_type?: ContentType | ''
  sort?: string
  page?: number
  page_size?: number
}

export interface PRQuery {
  search?: string
  status?: string
  order_type?: string
  date_from?: string
  date_to?: string
  sort?: string
  page?: number
  page_size?: number
}

export class ApiError extends Error {
  status: number
  errors: Record<string, string> | null

  constructor(message: string, status = 500, errors: Record<string, string> | null = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
  }
}

export type AppAxiosError = AxiosError<ApiResponse<unknown>>
