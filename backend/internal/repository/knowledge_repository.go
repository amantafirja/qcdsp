package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"qcdsp/backend/internal/models"

	"github.com/google/uuid"
)

type KnowledgeFilter struct {
	Search      string
	CategoryID  *uuid.UUID
	CategorySlug string
	ContentType string
	Published   *bool
	Sort        string
	Page        int
	PageSize    int
}

type KnowledgeRepository interface {
	List(ctx context.Context, filter KnowledgeFilter) ([]models.KnowledgeDocument, int, error)
	FindByID(ctx context.Context, id uuid.UUID) (*models.KnowledgeDocument, error)
	FindBySlug(ctx context.Context, slug string) (*models.KnowledgeDocument, error)
	Create(ctx context.Context, document *models.KnowledgeDocument) error
	Update(ctx context.Context, document *models.KnowledgeDocument) error
	Delete(ctx context.Context, id uuid.UUID) error
	IncrementView(ctx context.Context, id uuid.UUID) error
	ExistsBySlug(ctx context.Context, slug string, excludeID *uuid.UUID) (bool, error)
	CountByType(ctx context.Context) (total int, articles int, pdfs int, err error)
	Count(ctx context.Context) (int, error)
}

type knowledgeRepository struct {
	db *sql.DB
}

func NewKnowledgeRepository(db *sql.DB) KnowledgeRepository {
	return &knowledgeRepository{db: db}
}

const knowledgeSelect = `
	SELECT k.id, k.title, k.slug, k.category_id, COALESCE(k.description, ''), k.content_type,
	       k.pdf_file_path, k.pdf_original_name, k.pdf_size_bytes, k.article_content,
	       k.is_published, k.view_count, k.created_by, k.published_at, k.created_at, k.updated_at,
	       c.id, c.name, c.slug, COALESCE(c.description, ''), c.created_at, c.updated_at
	FROM knowledge_documents k
	JOIN categories c ON c.id = k.category_id`

func (r *knowledgeRepository) List(ctx context.Context, filter KnowledgeFilter) ([]models.KnowledgeDocument, int, error) {
	conditions := []string{"1 = 1"}
	args := []interface{}{}
	argIndex := 1

	if filter.Search != "" {
		search := "%" + strings.ToLower(strings.TrimSpace(filter.Search)) + "%"
		conditions = append(conditions, fmt.Sprintf(
			"(LOWER(k.title) LIKE $%d OR LOWER(k.description) LIKE $%d OR LOWER(c.name) LIKE $%d)",
			argIndex, argIndex, argIndex,
		))
		args = append(args, search)
		argIndex++
	}
	if filter.CategoryID != nil {
		conditions = append(conditions, fmt.Sprintf("k.category_id = $%d", argIndex))
		args = append(args, *filter.CategoryID)
		argIndex++
	}
	if filter.CategorySlug != "" {
		conditions = append(conditions, fmt.Sprintf("c.slug = $%d", argIndex))
		args = append(args, filter.CategorySlug)
		argIndex++
	}
	if filter.ContentType != "" {
		conditions = append(conditions, fmt.Sprintf("k.content_type = $%d", argIndex))
		args = append(args, filter.ContentType)
		argIndex++
	}
	if filter.Published != nil {
		conditions = append(conditions, fmt.Sprintf("k.is_published = $%d", argIndex))
		args = append(args, *filter.Published)
		argIndex++
	}

	where := " WHERE " + strings.Join(conditions, " AND ")

	var total int
	if err := r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM knowledge_documents k JOIN categories c ON c.id = k.category_id"+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	orderBy := "k.created_at DESC"
	switch filter.Sort {
	case "oldest":
		orderBy = "k.created_at ASC"
	case "title":
		orderBy = "k.title ASC"
	case "popular":
		orderBy = "k.view_count DESC, k.created_at DESC"
	case "updated":
		orderBy = "k.updated_at DESC"
	}

	page := filter.Page
	if page < 1 {
		page = 1
	}
	pageSize := filter.PageSize
	if pageSize < 1 {
		pageSize = 9
	}
	if pageSize > 100 {
		pageSize = 100
	}
	offset := (page - 1) * pageSize

	query := knowledgeSelect + where + " ORDER BY " + orderBy + fmt.Sprintf(" LIMIT $%d OFFSET $%d", argIndex, argIndex+1)
	args = append(args, pageSize, offset)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	documents := make([]models.KnowledgeDocument, 0)
	for rows.Next() {
		document, err := scanKnowledge(rows)
		if err != nil {
			return nil, 0, err
		}
		documents = append(documents, *document)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	return documents, total, nil
}

func (r *knowledgeRepository) FindByID(ctx context.Context, id uuid.UUID) (*models.KnowledgeDocument, error) {
	row := r.db.QueryRowContext(ctx, knowledgeSelect+" WHERE k.id = $1", id)
	document, err := scanKnowledgeRow(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return document, err
}

func (r *knowledgeRepository) FindBySlug(ctx context.Context, slug string) (*models.KnowledgeDocument, error) {
	row := r.db.QueryRowContext(ctx, knowledgeSelect+" WHERE k.slug = $1", slug)
	document, err := scanKnowledgeRow(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return document, err
}

func (r *knowledgeRepository) Create(ctx context.Context, document *models.KnowledgeDocument) error {
	query := `
		INSERT INTO knowledge_documents (
			id, title, slug, category_id, description, content_type, pdf_file_path,
			pdf_original_name, pdf_size_bytes, article_content, is_published, created_by, published_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		RETURNING created_at, updated_at`
	err := r.db.QueryRowContext(ctx, query,
		document.ID, document.Title, document.Slug, document.CategoryID, document.Description,
		document.ContentType, document.PDFFilePath, document.PDFOriginalName, document.PDFSizeBytes,
		document.ArticleContent, document.IsPublished, document.CreatedBy, document.PublishedAt,
	).Scan(&document.CreatedAt, &document.UpdatedAt)
	return mapPgError(err)
}

func (r *knowledgeRepository) Update(ctx context.Context, document *models.KnowledgeDocument) error {
	query := `
		UPDATE knowledge_documents SET
			title = $2, slug = $3, category_id = $4, description = $5, content_type = $6,
			pdf_file_path = $7, pdf_original_name = $8, pdf_size_bytes = $9, article_content = $10,
			is_published = $11, published_at = $12, updated_at = NOW()
		WHERE id = $1
		RETURNING created_at, updated_at`
	err := r.db.QueryRowContext(ctx, query,
		document.ID, document.Title, document.Slug, document.CategoryID, document.Description,
		document.ContentType, document.PDFFilePath, document.PDFOriginalName, document.PDFSizeBytes,
		document.ArticleContent, document.IsPublished, document.PublishedAt,
	).Scan(&document.CreatedAt, &document.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrNotFound
	}
	return mapPgError(err)
}

func (r *knowledgeRepository) Delete(ctx context.Context, id uuid.UUID) error {
	result, err := r.db.ExecContext(ctx, "DELETE FROM knowledge_documents WHERE id = $1", id)
	if err != nil {
		return err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *knowledgeRepository) IncrementView(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, "UPDATE knowledge_documents SET view_count = view_count + 1 WHERE id = $1", id)
	return err
}

func (r *knowledgeRepository) ExistsBySlug(ctx context.Context, slug string, excludeID *uuid.UUID) (bool, error) {
	query := "SELECT EXISTS(SELECT 1 FROM knowledge_documents WHERE slug = $1"
	args := []interface{}{slug}
	if excludeID != nil {
		query += " AND id <> $2"
		args = append(args, *excludeID)
	}
	query += ")"
	var exists bool
	err := r.db.QueryRowContext(ctx, query, args...).Scan(&exists)
	return exists, err
}

func (r *knowledgeRepository) CountByType(ctx context.Context) (int, int, int, error) {
	var total, articles, pdfs int
	err := r.db.QueryRowContext(ctx, `
		SELECT COUNT(*),
		       COUNT(*) FILTER (WHERE content_type = 'article'),
		       COUNT(*) FILTER (WHERE content_type = 'pdf')
		FROM knowledge_documents`).Scan(&total, &articles, &pdfs)
	return total, articles, pdfs, err
}

func (r *knowledgeRepository) Count(ctx context.Context) (int, error) {
	var count int
	err := r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM knowledge_documents").Scan(&count)
	return count, err
}

type rowScanner interface {
	Scan(dest ...interface{}) error
}

func scanKnowledge(rows *sql.Rows) (*models.KnowledgeDocument, error) {
	return scanKnowledgeRow(rows)
}

func scanKnowledgeRow(row rowScanner) (*models.KnowledgeDocument, error) {
	var (
		document models.KnowledgeDocument
		category models.Category
	)
	err := row.Scan(
		&document.ID, &document.Title, &document.Slug, &document.CategoryID, &document.Description,
		&document.ContentType, &document.PDFFilePath, &document.PDFOriginalName, &document.PDFSizeBytes,
		&document.ArticleContent, &document.IsPublished, &document.ViewCount, &document.CreatedBy,
		&document.PublishedAt, &document.CreatedAt, &document.UpdatedAt,
		&category.ID, &category.Name, &category.Slug, &category.Description, &category.CreatedAt, &category.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	document.Category = &category
	if document.PDFFilePath != nil {
		document.PDFURL = "/api/knowledge/" + document.ID.String() + "/pdf"
	}
	return &document, nil
}
