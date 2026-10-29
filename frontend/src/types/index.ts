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

export interface PurchaseRequestItem {
  id: string
  purchase_request_id: string
  item_name: string
  brand_catalog: string
  quantity: number
  unit: string
  notes: string | null
  origin_pr_id: string
  origin_reference: string
  origin_is_master: boolean
  created_at: string
}

export interface PRReference {
  id: string
  reference_number: string
  status: string
  requester_name?: string
  item_count?: number
  merged_at?: string | null
}

export interface PurchaseRequest {
  id: string
  reference_number: string
  description: string
  order_type: string
  custom_order_type: string | null
  requester_name: string
  reason: string
  status: string
  status_label: string
  internal_notes: string | null
  items: PurchaseRequestItem[]
  attachments: Attachment[]
  status_history?: StatusHistoryEntry[]
  master?: PRReference | null
  members: PRReference[]
  member_count: number
  is_master: boolean
  is_merged: boolean
  merged_at: string | null
  deleted_at: string | null
  po_number: string | null
  po_date: string | null
  po_value: number | null
  delivery_estimate_date: string | null
  oracle_synced_at: string | null
  po_list: OraclePO[] | null
  po_source: string
  po_manual_override: boolean
  oracle_sync_status: string | null
  oracle_last_sync_at: string | null
  created_at: string
  updated_at: string
}

export interface OraclePO {
  po_number: string
  po_date: string | null
  delivery_date: string | null
  total_value: number | null
  line_count: number
  items: string[] | null
}

export interface OracleImport {
  id: string
  file_name: string
  uploaded_by: string | null
  uploaded_by_name: string
  total_rows: number
  total_pr: number
  matched_count: number
  synced_count: number
  status: string
  notes: string | null
  created_at: string
  synced_at: string | null
  duplicate_rows: number
  multi_line_prs: number
  multi_po_prs: number
  needs_review_prs: number
  not_found_prs: number
  updated_prs: number
  file_size: number
  sync_count: number
}

export interface OracleRow {
  id: string
  import_id: string
  pr_number: string
  po_number: string | null
  po_date: string | null
  total_value: number | null
  delivery_date: string | null
  line_count: number
  qty_total: number
  item_summary: string | null
  po_list: OraclePO[] | null
  duplicate_lines: number
  multi_line: boolean
  multi_po: boolean
  needs_review: boolean
  sync_status: string | null
  matched_pr_id: string | null
  matched_pr_reference: string | null
  pr_status: string | null
  created_at: string
}

export interface OracleSyncLog {
  id: string
  import_id: string
  file_name: string
  actor_id: string | null
  actor_name: string
  actor_role: string
  trigger: string
  total_rows: number
  total_pr: number
  matched: number
  not_found: number
  updated: number
  duplicates: number
  multi_line: number
  multi_po: number
  needs_review: number
  skipped_manual: number
  status_changed: number
  started_at: string
  finished_at: string | null
}

export interface OracleStatus {
  last_import: OracleImport | null
  total_rows: number
  total_pr: number
  matched_count: number
  unmatched_count: number
  with_po: number
  without_po: number
  duplicate_rows: number
  multi_line_prs: number
  multi_po_prs: number
  needs_review_prs: number
  total_value: number
  rows: OracleRow[]
  imports: OracleImport[]
  sync_logs: OracleSyncLog[]
}

export interface OracleSyncDetail {
  pr_number: string
  pr_reference: string | null
  po_number: string | null
  total_value: number | null
  delivery_date: string | null
  matched: boolean
  updated: boolean
  multi_po: boolean
  status: string
  message: string
}

export interface OracleSyncResult {
  import_id: string
  matched: number
  updated: number
  status_changed: number
  not_found: number
  duplicates: number
  multi_po: number
  needs_review: number
  skipped_manual: number
  skipped_terminal: number
  details: OracleSyncDetail[]
}

export interface PRAuditLog {
  id: string
  action: string
  actor_id: string | null
  actor_name: string
  actor_role: string
  notes: string | null
  before_data: unknown
  after_data: unknown
  created_at: string
}

export interface DashboardStats {
  total_documents: number
  total_articles: number
  total_pdf: number
  total_pr: number
  total_open: number
  total_pending_approval: number
  total_approved: number
  total_closed: number
  total_outstanding_delivery: number
  total_active: number
  total_merged: number
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
