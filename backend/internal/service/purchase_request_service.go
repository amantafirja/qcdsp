package service

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"strings"
	"time"

	"qcdsp/backend/internal/models"
	"qcdsp/backend/internal/repository"
	"qcdsp/backend/internal/utils"

	"github.com/google/uuid"
)

type PRInput struct {
	Description      string
	OrderType        string
	CustomOrderType  string
	BrandCatalog     string
	Quantity         int
	RequesterName    string
	Reason           string
	SPVAttachment    *utils.UploadedFile
	QuotationAttachment *utils.UploadedFile
}

type PRQuery struct {
	Search    string
	Status    string
	OrderType string
	DateFrom  *time.Time
	DateTo    *time.Time
	Sort      string
	Page      int
	PageSize  int
}

type PRStatusInput struct {
	Status string
	Notes  string
}

type PurchaseRequestService interface {
	Create(ctx context.Context, input PRInput) (*models.PurchaseRequest, error)
	Track(ctx context.Context, reference string) (*models.PurchaseRequest, error)
	List(ctx context.Context, query PRQuery) ([]models.PurchaseRequest, models.Pagination, error)
	Get(ctx context.Context, id uuid.UUID) (*models.PurchaseRequest, error)
	UpdateStatus(ctx context.Context, id uuid.UUID, input PRStatusInput, adminID uuid.UUID) (*models.PurchaseRequest, error)
	UpdateNotes(ctx context.Context, id uuid.UUID, notes string) (*models.PurchaseRequest, error)
	Dashboard(ctx context.Context) (*models.DashboardData, error)
}

type purchaseRequestService struct {
	requests  repository.PurchaseRequestRepository
	documents repository.KnowledgeRepository
	uploadDir string
}

func NewPurchaseRequestService(requests repository.PurchaseRequestRepository, documents repository.KnowledgeRepository, uploadDir string) PurchaseRequestService {
	return &purchaseRequestService{requests: requests, documents: documents, uploadDir: uploadDir}
}

func (s *purchaseRequestService) Create(ctx context.Context, input PRInput) (*models.PurchaseRequest, error) {
	validation := newValidation()

	input.Description = strings.TrimSpace(input.Description)
	input.OrderType = strings.TrimSpace(input.OrderType)
	input.CustomOrderType = strings.TrimSpace(input.CustomOrderType)
	input.BrandCatalog = strings.TrimSpace(input.BrandCatalog)
	input.RequesterName = strings.TrimSpace(input.RequesterName)
	input.Reason = strings.TrimSpace(input.Reason)

	if input.Description == "" {
		validation.add("description", "Deskripsi pemesanan wajib diisi")
	} else if len(input.Description) < 10 {
		validation.add("description", "Deskripsi pemesanan minimal 10 karakter")
	} else if len(input.Description) > 2000 {
		validation.add("description", "Deskripsi pemesanan maksimal 2000 karakter")
	}

	if input.OrderType == "" {
		validation.add("order_type", "Jenis pemesanan wajib dipilih")
	} else if !models.IsValidOrderType(input.OrderType) {
		validation.add("order_type", "Jenis pemesanan tidak valid")
	} else if input.OrderType == "Lain-Lain" {
		if input.CustomOrderType == "" {
			validation.add("custom_order_type", "Jenis pemesanan lain-lain wajib diisi")
		} else if len(input.CustomOrderType) > 120 {
			validation.add("custom_order_type", "Jenis pemesanan maksimal 120 karakter")
		}
	} else {
		input.CustomOrderType = ""
	}

	if input.BrandCatalog == "" {
		validation.add("brand_catalog", "Brand (merk) dan nomor katalog wajib diisi")
	} else if len(input.BrandCatalog) > 255 {
		validation.add("brand_catalog", "Brand/katalog maksimal 255 karakter")
	}

	if input.Quantity < 1 {
		validation.add("quantity", "Jumlah minimal 1")
	} else if input.Quantity > 1_000_000 {
		validation.add("quantity", "Jumlah tidak wajar")
	}

	if input.RequesterName == "" {
		validation.add("requester_name", "Nama pemesan wajib diisi")
	} else if len(input.RequesterName) > 150 {
		validation.add("requester_name", "Nama pemesan maksimal 150 karakter")
	}

	if input.Reason == "" {
		validation.add("reason", "Alasan pemesanan wajib diisi")
	} else if len(input.Reason) < 10 {
		validation.add("reason", "Alasan pemesanan minimal 10 karakter")
	} else if len(input.Reason) > 2000 {
		validation.add("reason", "Alasan pemesanan maksimal 2000 karakter")
	}

	if input.SPVAttachment == nil {
		validation.add("spv_approval", "Bukti SPV approve pemesanan wajib diunggah")
	}

	if validation.hasErrors() {
		return nil, validation
	}

	reference, err := s.generateReference(ctx)
	if err != nil {
		return nil, err
	}

	var customOrderType *string
	if input.OrderType == "Lain-Lain" {
		customOrderType = &input.CustomOrderType
	}

	pr := &models.PurchaseRequest{
		ID:              uuid.New(),
		ReferenceNumber: reference,
		Description:     input.Description,
		OrderType:       input.OrderType,
		CustomOrderType: customOrderType,
		BrandCatalog:    input.BrandCatalog,
		Quantity:        input.Quantity,
		RequesterName:   input.RequesterName,
		Reason:          input.Reason,
		Status:          "Submitted",
	}

	attachments := []models.Attachment{{
		AttachmentType: "spv_approval",
		OriginalName:   input.SPVAttachment.OriginalName,
		FilePath:       input.SPVAttachment.RelativePath,
		MimeType:       input.SPVAttachment.MimeType,
		SizeBytes:      input.SPVAttachment.Size,
	}}
	if input.QuotationAttachment != nil {
		attachments = append(attachments, models.Attachment{
			AttachmentType: "quotation",
			OriginalName:   input.QuotationAttachment.OriginalName,
			FilePath:       input.QuotationAttachment.RelativePath,
			MimeType:       input.QuotationAttachment.MimeType,
			SizeBytes:      input.QuotationAttachment.Size,
		})
	}

	if err := s.requests.CreateWithAttachments(ctx, pr, attachments); err != nil {
		return nil, err
	}
	return s.requests.FindByID(ctx, pr.ID)
}

func (s *purchaseRequestService) Track(ctx context.Context, reference string) (*models.PurchaseRequest, error) {
	reference = strings.TrimSpace(reference)
	if reference == "" {
		return nil, ValidationErrors{"reference": "Nomor referensi wajib diisi"}
	}
	pr, err := s.requests.FindByReference(ctx, reference)
	if errors.Is(err, repository.ErrNotFound) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	for i := range pr.Attachments {
		pr.Attachments[i].DownloadURL = "/api/purchase-requests/status/" + pr.ReferenceNumber + "/attachments/" + pr.Attachments[i].ID.String()
	}
	return pr, nil
}

func (s *purchaseRequestService) List(ctx context.Context, query PRQuery) ([]models.PurchaseRequest, models.Pagination, error) {
	filter := repository.PRFilter{
		Search:    query.Search,
		Status:    query.Status,
		OrderType: query.OrderType,
		DateFrom:  query.DateFrom,
		DateTo:    query.DateTo,
		Sort:      query.Sort,
		Page:      query.Page,
		PageSize:  query.PageSize,
	}
	requests, total, err := s.requests.List(ctx, filter)
	if err != nil {
		return nil, models.Pagination{}, err
	}
	return requests, models.NewPagination(query.Page, query.PageSize, total), nil
}

func (s *purchaseRequestService) Get(ctx context.Context, id uuid.UUID) (*models.PurchaseRequest, error) {
	pr, err := s.requests.FindByID(ctx, id)
	if errors.Is(err, repository.ErrNotFound) {
		return nil, ErrNotFound
	}
	return pr, err
}

func (s *purchaseRequestService) UpdateStatus(ctx context.Context, id uuid.UUID, input PRStatusInput, adminID uuid.UUID) (*models.PurchaseRequest, error) {
	input.Status = strings.TrimSpace(input.Status)
	input.Notes = strings.TrimSpace(input.Notes)

	validation := newValidation()
	if input.Status == "" {
		validation.add("status", "Status wajib dipilih")
	} else if !models.IsValidStatus(input.Status) {
		validation.add("status", "Status tidak valid")
	}
	if len(input.Notes) > 2000 {
		validation.add("notes", "Catatan maksimal 2000 karakter")
	}
	if validation.hasErrors() {
		return nil, validation
	}

	if err := s.requests.UpdateStatus(ctx, id, input.Status, input.Notes, &adminID); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return s.requests.FindByID(ctx, id)
}

func (s *purchaseRequestService) UpdateNotes(ctx context.Context, id uuid.UUID, notes string) (*models.PurchaseRequest, error) {
	notes = strings.TrimSpace(notes)
	if len(notes) > 4000 {
		return nil, ValidationErrors{"internal_notes": "Catatan internal maksimal 4000 karakter"}
	}
	if err := s.requests.UpdateNotes(ctx, id, notes); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return s.requests.FindByID(ctx, id)
}

func (s *purchaseRequestService) Dashboard(ctx context.Context) (*models.DashboardData, error) {
	totalDocs, articles, pdfs, err := s.documents.CountByType(ctx)
	if err != nil {
		return nil, err
	}

	statusCounts, err := s.requests.CountByStatus(ctx)
	if err != nil {
		return nil, err
	}

	monthly, err := s.requests.MonthlyCounts(ctx, 12)
	if err != nil {
		return nil, err
	}

	orderTypes, err := s.requests.OrderTypeCounts(ctx)
	if err != nil {
		return nil, err
	}

	recent, err := s.requests.Recent(ctx, 5)
	if err != nil {
		return nil, err
	}

	statusDist := make([]models.TypeCount, 0, len(models.PRStatuses))
	for _, status := range models.PRStatuses {
		statusDist = append(statusDist, models.TypeCount{Label: status, Count: statusCounts[status]})
	}

	return &models.DashboardData{
		Stats: models.DashboardStats{
			TotalDocuments: totalDocs,
			TotalArticles:  articles,
			TotalPDF:       pdfs,
			TotalSubmitted: statusCounts["Submitted"],
			TotalReview:    statusCounts["Review"],
			TotalApproved:  statusCounts["Approved"],
			TotalRejected:  statusCounts["Rejected"],
			TotalOrdered:   statusCounts["Ordered"],
			TotalReceived:  statusCounts["Received"],
			TotalClosed:    statusCounts["Closed"],
		},
		MonthlyPR:     monthly,
		OrderTypeDist: orderTypes,
		StatusDist:    statusDist,
		RecentPR:      recent,
	}, nil
}

func (s *purchaseRequestService) generateReference(ctx context.Context) (string, error) {
	now := time.Now()
	for attempt := 0; attempt < 10; attempt++ {
		reference := fmt.Sprintf("PR-%s-%04d", now.Format("20060102"), rand.Intn(10000))
		exists, err := s.requests.ExistsReference(ctx, reference)
		if err != nil {
			return "", err
		}
		if !exists {
			return reference, nil
		}
	}
	return fmt.Sprintf("PR-%s-%s", now.Format("20060102"), uuid.NewString()[:6]), nil
}
