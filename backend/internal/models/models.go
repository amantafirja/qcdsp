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
	IsMaster        bool                  `json:"is_master"`
	IsMerged        bool                  `json:"is_merged"`
	MergedAt        *time.Time            `json:"merged_at"`
	DeletedAt       *time.Time            `json:"deleted_at"`
	CreatedAt       time.Time             `json:"created_at"`
	UpdatedAt       time.Time             `json:"updated_at"`
}

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

	TotalPR     int `json:"total_pr"`
	TotalActive int `json:"total_active"`
	TotalMerged int `json:"total_merged"`
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
