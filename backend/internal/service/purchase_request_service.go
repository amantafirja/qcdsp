package service

import (
	"context"
	"errors"
	"net/url"
	"strconv"
	"strings"
	"time"

	"qcdsp/backend/internal/models"
	"qcdsp/backend/internal/repository"
	"qcdsp/backend/internal/utils"

	"github.com/google/uuid"
)

type PRItemInput struct {
	ItemName     string
	BrandCatalog string
	Quantity     int
	Unit         string
	Notes        string
}

type PRInput struct {
	Description         string
	OrderType           string
	CustomOrderType     string
	RequesterName       string
	Reason              string
	Items               []PRItemInput
	SPVAttachment       *utils.UploadedFile
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

type PRActorInput struct {
	ID   uuid.UUID
	Name string
	Role string
}

type PRMergeInput struct {
	MemberIDs []uuid.UUID
}

type PurchaseRequestService interface {
	Create(ctx context.Context, input PRInput) (*models.PurchaseRequest, error)
	Track(ctx context.Context, reference string) (*models.PurchaseRequest, error)
	List(ctx context.Context, query PRQuery) ([]models.PurchaseRequest, models.Pagination, error)
	Get(ctx context.Context, id uuid.UUID) (*models.PurchaseRequest, error)
	UpdateStatus(ctx context.Context, id uuid.UUID, input PRStatusInput, actor PRActorInput) (*models.PurchaseRequest, error)
	UpdateNotes(ctx context.Context, id uuid.UUID, notes string, actor PRActorInput) (*models.PurchaseRequest, error)
	Merge(ctx context.Context, masterID uuid.UUID, input PRMergeInput, actor PRActorInput) (*models.PurchaseRequest, error)
	Unmerge(ctx context.Context, masterID uuid.UUID, input PRMergeInput, actor PRActorInput) (*models.PurchaseRequest, error)
	Delete(ctx context.Context, id uuid.UUID, actor PRActorInput) error
	AuditTrail(ctx context.Context, id uuid.UUID) ([]models.PRAuditLog, error)
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

	if len(input.Items) == 0 {
		validation.add("items", "Minimal satu item pemesanan wajib diisi")
	} else if len(input.Items) > 50 {
		validation.add("items", "Maksimal 50 item per Purchase Request")
	}

	items := make([]models.PurchaseRequestItem, 0, len(input.Items))
	for index, item := range input.Items {
		item.ItemName = strings.TrimSpace(item.ItemName)
		item.BrandCatalog = strings.TrimSpace(item.BrandCatalog)
		item.Unit = strings.TrimSpace(item.Unit)
		item.Notes = strings.TrimSpace(item.Notes)
		if item.Unit == "" {
			item.Unit = "unit"
		}

		if item.ItemName == "" {
			validation.add(itemField(index, "item_name"), "Nama item wajib diisi")
		} else if len(item.ItemName) > 255 {
			validation.add(itemField(index, "item_name"), "Nama item maksimal 255 karakter")
		}
		if len(item.BrandCatalog) > 255 {
			validation.add(itemField(index, "brand_catalog"), "Brand/katalog maksimal 255 karakter")
		}
		if item.Quantity < 1 {
			validation.add(itemField(index, "quantity"), "Jumlah minimal 1")
		} else if item.Quantity > 1_000_000 {
			validation.add(itemField(index, "quantity"), "Jumlah tidak wajar")
		}
		if len(item.Unit) > 50 {
			validation.add(itemField(index, "unit"), "Satuan maksimal 50 karakter")
		}
		if len(item.Notes) > 500 {
			validation.add(itemField(index, "notes"), "Catatan item maksimal 500 karakter")
		}

		var notes *string
		if item.Notes != "" {
			notes = &item.Notes
		}
		items = append(items, models.PurchaseRequestItem{
			ItemName:     item.ItemName,
			BrandCatalog: item.BrandCatalog,
			Quantity:     item.Quantity,
			Unit:         item.Unit,
			Notes:        notes,
		})
	}

	if validation.hasErrors() {
		return nil, validation
	}

	var customOrderType *string
	if input.OrderType == "Lain-Lain" {
		customOrderType = &input.CustomOrderType
	}

	pr := &models.PurchaseRequest{
		ID:              uuid.New(),
		Description:     input.Description,
		OrderType:       input.OrderType,
		CustomOrderType: customOrderType,
		RequesterName:   input.RequesterName,
		Reason:          input.Reason,
		Status:          models.PRStatusFormCreated,
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

	actor := repository.PRActor{Name: input.RequesterName, Role: "user"}
	if err := s.requests.Create(ctx, pr, items, attachments, actor); err != nil {
		return nil, err
	}
	return s.requests.FindByID(ctx, pr.ID)
}

func itemField(index int, field string) string {
	return "items[" + strconv.Itoa(index) + "]." + field
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
		pr.Attachments[i].DownloadURL = "/api/purchase-requests/track/attachments/" +
			pr.Attachments[i].ID.String() + "?reference=" + url.QueryEscape(pr.ReferenceNumber)
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

func (s *purchaseRequestService) UpdateStatus(ctx context.Context, id uuid.UUID, input PRStatusInput, actor PRActorInput) (*models.PurchaseRequest, error) {
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

	current, err := s.Get(ctx, id)
	if err != nil {
		return nil, err
	}
	if models.IsTerminalStatus(current.Status) {
		return nil, ValidationErrors{"status": "Status akhir tidak dapat diubah"}
	}
	if input.Status == current.Status {
		return nil, ValidationErrors{"status": "Status baru sama dengan status saat ini"}
	}
	if (input.Status == models.PRStatusRejected || input.Status == models.PRStatusCancelled) && input.Notes == "" {
		return nil, ValidationErrors{"notes": "Catatan wajib diisi untuk status Selesai (Reject) atau Selesai (Cancel)"}
	}

	if err := s.requests.UpdateStatus(ctx, id, input.Status, input.Notes, toRepoActor(actor)); err != nil {
		switch {
		case errors.Is(err, repository.ErrNotFound):
			return nil, ErrNotFound
		case errors.Is(err, repository.ErrStatusFinal):
			return nil, ValidationErrors{"status": "Status akhir tidak dapat diubah"}
		}
		return nil, err
	}
	return s.requests.FindByID(ctx, id)
}

func (s *purchaseRequestService) UpdateNotes(ctx context.Context, id uuid.UUID, notes string, actor PRActorInput) (*models.PurchaseRequest, error) {
	notes = strings.TrimSpace(notes)
	if len(notes) > 4000 {
		return nil, ValidationErrors{"internal_notes": "Catatan internal maksimal 4000 karakter"}
	}
	if err := s.requests.UpdateNotes(ctx, id, notes, toRepoActor(actor)); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return s.requests.FindByID(ctx, id)
}

func (s *purchaseRequestService) Merge(ctx context.Context, masterID uuid.UUID, input PRMergeInput, actor PRActorInput) (*models.PurchaseRequest, error) {
	memberIDs := uniqueIDs(input.MemberIDs)
	if len(memberIDs) == 0 {
		return nil, ValidationErrors{"member_ids": "Pilih minimal satu PR untuk digabungkan"}
	}
	for _, memberID := range memberIDs {
		if memberID == masterID {
			return nil, ValidationErrors{"member_ids": "PR utama tidak boleh menjadi anggota"}
		}
	}

	if err := s.requests.Merge(ctx, masterID, memberIDs, toRepoActor(actor)); err != nil {
		switch {
		case errors.Is(err, repository.ErrNotFound):
			return nil, ErrNotFound
		case errors.Is(err, repository.ErrMergeInvalid):
			return nil, ValidationErrors{"member_ids": strings.TrimPrefix(err.Error(), repository.ErrMergeInvalid.Error()+": ")}
		}
		return nil, err
	}
	return s.requests.FindByID(ctx, masterID)
}

func (s *purchaseRequestService) Unmerge(ctx context.Context, masterID uuid.UUID, input PRMergeInput, actor PRActorInput) (*models.PurchaseRequest, error) {
	if err := s.requests.Unmerge(ctx, masterID, uniqueIDs(input.MemberIDs), toRepoActor(actor)); err != nil {
		switch {
		case errors.Is(err, repository.ErrNotFound):
			return nil, ErrNotFound
		case errors.Is(err, repository.ErrMergeInvalid):
			return nil, ValidationErrors{"member_ids": strings.TrimPrefix(err.Error(), repository.ErrMergeInvalid.Error()+": ")}
		}
		return nil, err
	}
	return s.requests.FindByID(ctx, masterID)
}

func (s *purchaseRequestService) Delete(ctx context.Context, id uuid.UUID, actor PRActorInput) error {
	if err := s.requests.SoftDelete(ctx, id, toRepoActor(actor)); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return ErrNotFound
		}
		return err
	}
	return nil
}

func (s *purchaseRequestService) AuditTrail(ctx context.Context, id uuid.UUID) ([]models.PRAuditLog, error) {
	if _, err := s.Get(ctx, id); err != nil {
		return nil, err
	}
	return s.requests.ListAudit(ctx, id)
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

	total, active, merged, err := s.requests.PRSummary(ctx)
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
			TotalPR:        total,
			TotalActive:    active,
			TotalMerged:    merged,
		},
		MonthlyPR:     monthly,
		OrderTypeDist: orderTypes,
		StatusDist:    statusDist,
		RecentPR:      recent,
	}, nil
}

func toRepoActor(actor PRActorInput) repository.PRActor {
	id := actor.ID
	return repository.PRActor{ID: &id, Name: actor.Name, Role: actor.Role}
}

func uniqueIDs(ids []uuid.UUID) []uuid.UUID {
	seen := make(map[uuid.UUID]bool, len(ids))
	result := make([]uuid.UUID, 0, len(ids))
	for _, id := range ids {
		if id == uuid.Nil || seen[id] {
			continue
		}
		seen[id] = true
		result = append(result, id)
	}
	return result
}
