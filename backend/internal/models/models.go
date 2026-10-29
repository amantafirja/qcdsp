package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type AdminUser struct {
	ID           uuid.UUID  `json:"id"`
	Username     string     `json:"username"`
	PasswordHash string     `json:"-"`
	Name         string     `json:"name"`
	Role         string     `json:"role"`
	IsActive     bool       `json:"is_active"`
	LastLoginAt  *time.Time `json:"last_login_at"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

type Category struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	Slug        string    `json:"slug"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type CategoryWithCount struct {
	Category
	DocumentCount int `json:"document_count"`
}

type KnowledgeDocument struct {
	ID              uuid.UUID  `json:"id"`
	Title           string     `json:"title"`
	Slug            string     `json:"slug"`
	CategoryID      uuid.UUID  `json:"category_id"`
	Category        *Category  `json:"category,omitempty"`
	Description     string     `json:"description"`
	ContentType     string     `json:"content_type"`
	PDFFilePath     *string    `json:"-"`
	PDFURL          string     `json:"pdf_url,omitempty"`
	PDFOriginalName *string    `json:"pdf_original_name"`
	PDFSizeBytes    *int64     `json:"pdf_size_bytes"`
	ArticleContent  *string    `json:"article_content"`
	IsPublished     bool       `json:"is_published"`
	ViewCount       int        `json:"view_count"`
	CreatedBy       *uuid.UUID `json:"created_by"`
	PublishedAt     *time.Time `json:"published_at"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

type PurchaseRequestItem struct {
	ID                uuid.UUID `json:"id"`
	PurchaseRequestID uuid.UUID `json:"purchase_request_id"`
	ItemName          string    `json:"item_name"`
	BrandCatalog      string    `json:"brand_catalog"`
	Quantity          int       `json:"quantity"`
	Unit              string    `json:"unit"`
	Notes             *string   `json:"notes"`
	OriginPRID        uuid.UUID `json:"origin_pr_id"`
	OriginReference   string    `json:"origin_reference"`
	OriginIsMaster    bool      `json:"origin_is_master"`
	CreatedAt         time.Time `json:"created_at"`
}

type PRReference struct {
	ID              uuid.UUID `json:"id"`
	ReferenceNumber string    `json:"reference_number"`
	Status          string    `json:"status"`
	RequesterName   string    `json:"requester_name,omitempty"`
	ItemCount       int       `json:"item_count,omitempty"`
	MergedAt        *time.Time `json:"merged_at,omitempty"`
}

type PurchaseRequest struct {
	ID              uuid.UUID             `json:"id"`
	ReferenceNumber string                `json:"reference_number"`
	Description     string                `json:"description"`
	OrderType       string                `json:"order_type"`
	CustomOrderType *string               `json:"custom_order_type"`
	RequesterName   string                `json:"requester_name"`
	Reason          string                `json:"reason"`
	Status          string                `json:"status"`
	StatusLabel     string                `json:"status_label"`
	InternalNotes   *string               `json:"internal_notes"`
	Items           []PurchaseRequestItem `json:"items"`
	Attachments     []Attachment          `json:"attachments"`
	StatusHistory   []StatusHistoryEntry  `json:"status_history,omitempty"`
	Master          *PRReference          `json:"master,omitempty"`
	Members         []PRReference         `json:"members"`
	MemberCount     int                   `json:"member_count"`
	IsMaster        bool                  `json:"is_master"`
	IsMerged        bool                  `json:"is_merged"`
	MergedAt        *time.Time            `json:"merged_at"`
	DeletedAt       *time.Time            `json:"deleted_at"`

	PONumber             *string         `json:"po_number"`
	PODate               *time.Time      `json:"po_date"`
	POValue              *float64        `json:"po_value"`
	DeliveryEstimateDate *time.Time      `json:"delivery_estimate_date"`
	OracleSyncedAt       *time.Time      `json:"oracle_synced_at"`
	POList               json.RawMessage `json:"po_list"`
	POSource             string          `json:"po_source"`
	POManualOverride     bool            `json:"po_manual_override"`
	OracleSyncStatus     *string         `json:"oracle_sync_status"`
	OracleLastSyncAt     *time.Time      `json:"oracle_last_sync_at"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type POManualInput struct {
	PONumber             *string    `json:"po_number"`
	PODate               *time.Time `json:"po_date"`
	POValue              *float64   `json:"po_value"`
	DeliveryEstimateDate *time.Time `json:"delivery_estimate_date"`
}

type OracleImport struct {
	ID             uuid.UUID  `json:"id"`
	FileName       string     `json:"file_name"`
	UploadedBy     *uuid.UUID `json:"uploaded_by"`
	UploadedByName string     `json:"uploaded_by_name"`
	TotalRows      int        `json:"total_rows"`
	TotalPR        int        `json:"total_pr"`
	MatchedCount   int        `json:"matched_count"`
	SyncedCount    int        `json:"synced_count"`
	Status         string     `json:"status"`
	Notes          *string    `json:"notes"`
	CreatedAt      time.Time  `json:"created_at"`
	SyncedAt       *time.Time `json:"synced_at"`

	DuplicateRows  int `json:"duplicate_rows"`
	MultiLinePRs   int `json:"multi_line_prs"`
	MultiPOPRs     int `json:"multi_po_prs"`
	NeedsReviewPRs int `json:"needs_review_prs"`
	NotFoundPRs    int `json:"not_found_prs"`
	UpdatedPRs     int `json:"updated_prs"`
	FileSize       int64 `json:"file_size"`
	SyncCount      int `json:"sync_count"`
}

type OraclePurchaseOrder struct {
	ID            uuid.UUID       `json:"id"`
	ImportID      uuid.UUID       `json:"import_id"`
	PRNumber      string          `json:"pr_number"`
	PONumber      *string         `json:"po_number"`
	PODate        *time.Time      `json:"po_date"`
	TotalValue    *float64        `json:"total_value"`
	DeliveryDate  *time.Time      `json:"delivery_date"`
	LineCount     int             `json:"line_count"`
	QtyTotal      float64         `json:"qty_total"`
	ItemSummary   *string         `json:"item_summary"`
	RawData       json.RawMessage `json:"-"`
	POList        json.RawMessage `json:"po_list"`
	DuplicateLines int            `json:"duplicate_lines"`
	MultiLine     bool            `json:"multi_line"`
	MultiPO       bool            `json:"multi_po"`
	NeedsReview   bool            `json:"needs_review"`
	SyncStatus    *string         `json:"sync_status"`
	MatchedPRID   *uuid.UUID      `json:"matched_pr_id"`
	MatchedPRRef  *string         `json:"matched_pr_reference"`
	PRStatus      *string         `json:"pr_status"`
	CreatedAt     time.Time       `json:"created_at"`
}

type OracleStatus struct {
	LastImport      *OracleImport         `json:"last_import"`
	TotalRows       int                   `json:"total_rows"`
	TotalPR         int                   `json:"total_pr"`
	MatchedCount    int                   `json:"matched_count"`
	UnmatchedCount  int                   `json:"unmatched_count"`
	WithPO          int                   `json:"with_po"`
	WithoutPO       int                   `json:"without_po"`
	DuplicateRows   int                   `json:"duplicate_rows"`
	MultiLinePRs    int                   `json:"multi_line_prs"`
	MultiPOPRs      int                   `json:"multi_po_prs"`
	NeedsReviewPRs  int                   `json:"needs_review_prs"`
	TotalValue      float64               `json:"total_value"`
	Rows            []OraclePurchaseOrder `json:"rows"`
	Imports         []OracleImport        `json:"imports"`
	SyncLogs        []OracleSyncLog       `json:"sync_logs"`
}

type OracleSyncDetail struct {
	PRNumber     string     `json:"pr_number"`
	PRReference  *string    `json:"pr_reference"`
	PONumber     *string    `json:"po_number"`
	TotalValue   *float64   `json:"total_value"`
	DeliveryDate *time.Time `json:"delivery_date"`
	Matched      bool       `json:"matched"`
	Updated      bool       `json:"updated"`
	MultiPO      bool       `json:"multi_po"`
	Status       string     `json:"status"`
	Message      string     `json:"message"`
}

type OracleSyncResult struct {
	ImportID        uuid.UUID          `json:"import_id"`
	Matched         int                `json:"matched"`
	Updated         int                `json:"updated"`
	StatusChanged   int                `json:"status_changed"`
	NotFound        int                `json:"not_found"`
	Duplicates      int                `json:"duplicates"`
	MultiPO         int                `json:"multi_po"`
	NeedsReview     int                `json:"needs_review"`
	SkippedManual   int                `json:"skipped_manual"`
	SkippedTerminal int                `json:"skipped_terminal"`
	Details         []OracleSyncDetail `json:"details"`
}

type OracleSyncLog struct {
	ID            uuid.UUID       `json:"id"`
	ImportID      uuid.UUID       `json:"import_id"`
	FileName      string          `json:"file_name"`
	ActorID       *uuid.UUID      `json:"actor_id"`
	ActorName     string          `json:"actor_name"`
	ActorRole     string          `json:"actor_role"`
	Trigger       string          `json:"trigger"`
	TotalRows     int             `json:"total_rows"`
	TotalPR       int             `json:"total_pr"`
	Matched       int             `json:"matched"`
	NotFound      int             `json:"not_found"`
	Updated       int             `json:"updated"`
	Duplicates    int             `json:"duplicates"`
	MultiLine     int             `json:"multi_line"`
	MultiPO       int             `json:"multi_po"`
	NeedsReview   int             `json:"needs_review"`
	SkippedManual int             `json:"skipped_manual"`
	StatusChanged int             `json:"status_changed"`
	ResultData    json.RawMessage `json:"result_data"`
	StartedAt     time.Time       `json:"started_at"`
	FinishedAt    *time.Time      `json:"finished_at"`
}

const (
	OracleStatusBelumPO       = "belum_po"
	OracleStatusSudahPO       = "sudah_po"
	OracleStatusSyncBerhasil  = "sync_berhasil"
	OracleStatusNotFound      = "tidak_ditemukan"
	OracleStatusPerluDitinjau = "perlu_ditinjau"
)

type Attachment struct {
	ID                uuid.UUID `json:"id"`
	PurchaseRequestID uuid.UUID `json:"purchase_request_id"`
	AttachmentType    string    `json:"attachment_type"`
	OriginalName      string    `json:"original_name"`
	MimeType          string    `json:"mime_type"`
	SizeBytes         int64     `json:"size_bytes"`
	FilePath          string    `json:"-"`
	DownloadURL       string    `json:"download_url"`
	CreatedAt         time.Time `json:"created_at"`
}

type StatusHistoryEntry struct {
	ID        uuid.UUID  `json:"id"`
	Status    string     `json:"status"`
	Notes     *string    `json:"notes"`
	ChangedBy *uuid.UUID `json:"changed_by"`
	AdminName *string    `json:"admin_name,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
}

type PRAuditLog struct {
	ID              uuid.UUID       `json:"id"`
	Action          string          `json:"action"`
	ActorID         *uuid.UUID      `json:"actor_id"`
	ActorName       string          `json:"actor_name"`
	ActorRole       string          `json:"actor_role"`
	Notes           *string         `json:"notes"`
	BeforeData      json.RawMessage `json:"before_data"`
	AfterData       json.RawMessage `json:"after_data"`
	CreatedAt       time.Time       `json:"created_at"`
}

type DashboardStats struct {
	TotalDocuments int `json:"total_documents"`
	TotalArticles  int `json:"total_articles"`
	TotalPDF       int `json:"total_pdf"`

	TotalPR                 int `json:"total_pr"`
	TotalOpen               int `json:"total_open"`
	TotalPendingApproval    int `json:"total_pending_approval"`
	TotalApproved           int `json:"total_approved"`
	TotalClosed             int `json:"total_closed"`
	TotalOutstandingDelivery int `json:"total_outstanding_delivery"`
	TotalActive             int `json:"total_active"`
	TotalMerged             int `json:"total_merged"`
}

type PRMetrics struct {
	Total               int
	Open                int
	PendingApproval     int
	Approved            int
	Closed              int
	OutstandingDelivery int
	Merged              int
}

type MonthlyCount struct {
	Month string `json:"month"`
	Count int    `json:"count"`
}

type TypeCount struct {
	Label string `json:"label"`
	Count int    `json:"count"`
}

type DashboardData struct {
	Stats         DashboardStats     `json:"stats"`
	MonthlyPR     []MonthlyCount     `json:"monthly_pr"`
	OrderTypeDist []TypeCount        `json:"order_type_distribution"`
	StatusDist    []TypeCount        `json:"status_distribution"`
	RecentPR      []PurchaseRequest  `json:"recent_purchase_requests"`
}
