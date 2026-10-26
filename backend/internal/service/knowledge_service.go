package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"qcdsp/backend/internal/models"
	"qcdsp/backend/internal/repository"
	"qcdsp/backend/internal/utils"

	"github.com/google/uuid"
)

type KnowledgeInput struct {
	Title          string
	CategoryID     uuid.UUID
	Description    string
	ContentType    string
	ArticleContent string
	IsPublished    bool
	PDF            *utils.UploadedFile
	KeepPDF        bool
}

type KnowledgeQuery struct {
	Search       string
	CategoryID   *uuid.UUID
	CategorySlug string
	ContentType  string
	Sort         string
	Page         int
	PageSize     int
}

type KnowledgeService interface {
	List(ctx context.Context, query KnowledgeQuery, publicOnly bool) ([]models.KnowledgeDocument, models.Pagination, error)
	Get(ctx context.Context, id uuid.UUID, publicOnly bool) (*models.KnowledgeDocument, error)
	Create(ctx context.Context, input KnowledgeInput, adminID uuid.UUID) (*models.KnowledgeDocument, error)
	Update(ctx context.Context, id uuid.UUID, input KnowledgeInput) (*models.KnowledgeDocument, error)
	Delete(ctx context.Context, id uuid.UUID) (*models.KnowledgeDocument, error)
	TogglePublish(ctx context.Context, id uuid.UUID, published bool) (*models.KnowledgeDocument, error)
}

type knowledgeService struct {
	documents  repository.KnowledgeRepository
	categories repository.CategoryRepository
	uploadDir  string
}

func NewKnowledgeService(documents repository.KnowledgeRepository, categories repository.CategoryRepository, uploadDir string) KnowledgeService {
	return &knowledgeService{documents: documents, categories: categories, uploadDir: uploadDir}
}

func (s *knowledgeService) List(ctx context.Context, query KnowledgeQuery, publicOnly bool) ([]models.KnowledgeDocument, models.Pagination, error) {
	filter := repository.KnowledgeFilter{
		Search:       query.Search,
		CategoryID:   query.CategoryID,
		CategorySlug: query.CategorySlug,
		ContentType:  query.ContentType,
		Sort:         query.Sort,
		Page:         query.Page,
		PageSize:     query.PageSize,
	}
	if publicOnly {
		published := true
		filter.Published = &published
	}

	documents, total, err := s.documents.List(ctx, filter)
	if err != nil {
		return nil, models.Pagination{}, err
	}
	return documents, models.NewPagination(query.Page, query.PageSize, total), nil
}

func (s *knowledgeService) Get(ctx context.Context, id uuid.UUID, publicOnly bool) (*models.KnowledgeDocument, error) {
	document, err := s.documents.FindByID(ctx, id)
	if errors.Is(err, repository.ErrNotFound) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if publicOnly {
		if !document.IsPublished {
			return nil, ErrNotFound
		}
		_ = s.documents.IncrementView(ctx, id)
		document.ViewCount++
	}
	return document, nil
}

func (s *knowledgeService) Create(ctx context.Context, input KnowledgeInput, adminID uuid.UUID) (*models.KnowledgeDocument, error) {
	validation := newValidation()
	input.Title = strings.TrimSpace(input.Title)
	input.Description = strings.TrimSpace(input.Description)
	input.ArticleContent = strings.TrimSpace(input.ArticleContent)
	input.ContentType = strings.ToLower(strings.TrimSpace(input.ContentType))

	if input.Title == "" {
		validation.add("title", "Judul wajib diisi")
	} else if len(input.Title) > 255 {
		validation.add("title", "Judul maksimal 255 karakter")
	}
	if input.CategoryID == uuid.Nil {
		validation.add("category_id", "Kategori wajib dipilih")
	}
	if !models.IsValidContentType(input.ContentType) {
		validation.add("content_type", "Tipe konten harus pdf atau article")
	}
	if input.ContentType == "pdf" && input.PDF == nil {
		validation.add("pdf", "File PDF wajib diunggah untuk tipe konten PDF")
	}
	if input.ContentType == "article" && input.ArticleContent == "" {
		validation.add("article_content", "Isi artikel wajib diisi")
	}
	if validation.hasErrors() {
		return nil, validation
	}

	category, err := s.categories.FindByID(ctx, input.CategoryID)
	if errors.Is(err, repository.ErrNotFound) {
		return nil, ValidationErrors{"category_id": "Kategori tidak ditemukan"}
	}
	if err != nil {
		return nil, err
	}

	slug, err := s.uniqueSlug(ctx, input.Title, nil)
	if err != nil {
		return nil, err
	}

	document := &models.KnowledgeDocument{
		ID:           uuid.New(),
		Title:        input.Title,
		Slug:         slug,
		CategoryID:   input.CategoryID,
		Category:     category,
		Description:  input.Description,
		ContentType:  input.ContentType,
		IsPublished:  input.IsPublished,
		CreatedBy:    &adminID,
	}
	if input.IsPublished {
		now := time.Now()
		document.PublishedAt = &now
	}

	if input.ContentType == "pdf" && input.PDF != nil {
		document.PDFFilePath = stringPtr(input.PDF.RelativePath)
		document.PDFOriginalName = stringPtr(input.PDF.OriginalName)
		document.PDFSizeBytes = &input.PDF.Size
	}
	if input.ContentType == "article" {
		document.ArticleContent = &input.ArticleContent
	}

	if err := s.documents.Create(ctx, document); err != nil {
		return nil, err
	}
	return s.documents.FindByID(ctx, document.ID)
}

func (s *knowledgeService) Update(ctx context.Context, id uuid.UUID, input KnowledgeInput) (*models.KnowledgeDocument, error) {
	existing, err := s.documents.FindByID(ctx, id)
	if errors.Is(err, repository.ErrNotFound) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	validation := newValidation()
	input.Title = strings.TrimSpace(input.Title)
	input.Description = strings.TrimSpace(input.Description)
	input.ArticleContent = strings.TrimSpace(input.ArticleContent)
	input.ContentType = strings.ToLower(strings.TrimSpace(input.ContentType))

	if input.Title == "" {
		validation.add("title", "Judul wajib diisi")
	} else if len(input.Title) > 255 {
		validation.add("title", "Judul maksimal 255 karakter")
	}
	if input.CategoryID == uuid.Nil {
		validation.add("category_id", "Kategori wajib dipilih")
	}
	if !models.IsValidContentType(input.ContentType) {
		validation.add("content_type", "Tipe konten harus pdf atau article")
	}
	if input.ContentType == "pdf" && input.PDF == nil && !input.KeepPDF {
		validation.add("pdf", "File PDF wajib diunggah untuk tipe konten PDF")
	}
	if input.ContentType == "article" && input.ArticleContent == "" {
		validation.add("article_content", "Isi artikel wajib diisi")
	}
	if validation.hasErrors() {
		return nil, validation
	}

	category, err := s.categories.FindByID(ctx, input.CategoryID)
	if errors.Is(err, repository.ErrNotFound) {
		return nil, ValidationErrors{"category_id": "Kategori tidak ditemukan"}
	}
	if err != nil {
		return nil, err
	}

	if existing.Title != input.Title {
		slug, err := s.uniqueSlug(ctx, input.Title, &id)
		if err != nil {
			return nil, err
		}
		existing.Slug = slug
	}

	existing.Title = input.Title
	existing.CategoryID = input.CategoryID
	existing.Category = category
	existing.Description = input.Description
	existing.ContentType = input.ContentType

	oldPDFPath := ""
	if existing.PDFFilePath != nil {
		oldPDFPath = *existing.PDFFilePath
	}

	if input.ContentType == "article" {
		existing.ArticleContent = &input.ArticleContent
		if oldPDFPath != "" {
			_ = utils.RemoveFile(s.uploadDir, oldPDFPath)
		}
		existing.PDFFilePath = nil
		existing.PDFOriginalName = nil
		existing.PDFSizeBytes = nil
	} else {
		existing.ArticleContent = nil
		if input.PDF != nil {
			existing.PDFFilePath = stringPtr(input.PDF.RelativePath)
			existing.PDFOriginalName = stringPtr(input.PDF.OriginalName)
			existing.PDFSizeBytes = &input.PDF.Size
			if oldPDFPath != "" && oldPDFPath != input.PDF.RelativePath {
				_ = utils.RemoveFile(s.uploadDir, oldPDFPath)
			}
		}
	}

	wasPublished := existing.IsPublished
	existing.IsPublished = input.IsPublished
	if input.IsPublished && !wasPublished {
		now := time.Now()
		existing.PublishedAt = &now
	}
	if !input.IsPublished {
		existing.PublishedAt = nil
	}

	if err := s.documents.Update(ctx, existing); err != nil {
		return nil, err
	}
	return s.documents.FindByID(ctx, id)
}

func (s *knowledgeService) Delete(ctx context.Context, id uuid.UUID) (*models.KnowledgeDocument, error) {
	document, err := s.documents.FindByID(ctx, id)
	if errors.Is(err, repository.ErrNotFound) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if err := s.documents.Delete(ctx, id); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	if document.PDFFilePath != nil {
		_ = utils.RemoveFile(s.uploadDir, *document.PDFFilePath)
	}
	return document, nil
}

func (s *knowledgeService) TogglePublish(ctx context.Context, id uuid.UUID, published bool) (*models.KnowledgeDocument, error) {
	document, err := s.documents.FindByID(ctx, id)
	if errors.Is(err, repository.ErrNotFound) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	document.IsPublished = published
	if published && document.PublishedAt == nil {
		now := time.Now()
		document.PublishedAt = &now
	}
	if !published {
		document.PublishedAt = nil
	}

	if err := s.documents.Update(ctx, document); err != nil {
		return nil, err
	}
	return s.documents.FindByID(ctx, id)
}

func (s *knowledgeService) uniqueSlug(ctx context.Context, title string, excludeID *uuid.UUID) (string, error) {
	base := models.Slugify(title)
	if base == "" {
		base = "dokumen"
	}
	candidate := base
	for i := 2; i < 100; i++ {
		exists, err := s.documents.ExistsBySlug(ctx, candidate, excludeID)
		if err != nil {
			return "", err
		}
		if !exists {
			return candidate, nil
		}
		candidate = base + "-" + itoa(i)
	}
	return base + "-" + uuid.NewString()[:8], nil
}

func itoa(value int) string {
	if value == 0 {
		return "0"
	}
	digits := ""
	for value > 0 {
		digits = string(rune('0'+value%10)) + digits
		value /= 10
	}
	return digits
}

func stringPtr(value string) *string {
	return &value
}
