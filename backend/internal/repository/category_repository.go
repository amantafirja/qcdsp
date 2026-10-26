package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"qcdsp/backend/internal/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
)

type CategoryRepository interface {
	List(ctx context.Context) ([]models.CategoryWithCount, error)
	ListPublic(ctx context.Context) ([]models.CategoryWithCount, error)
	FindByID(ctx context.Context, id uuid.UUID) (*models.Category, error)
	FindBySlug(ctx context.Context, slug string) (*models.Category, error)
	Create(ctx context.Context, category *models.Category) error
	Update(ctx context.Context, category *models.Category) error
	Delete(ctx context.Context, id uuid.UUID) error
	CountDocuments(ctx context.Context, id uuid.UUID) (int, error)
	Count(ctx context.Context) (int, error)
	ExistsByName(ctx context.Context, name string, excludeID *uuid.UUID) (bool, error)
	ExistsBySlug(ctx context.Context, slug string, excludeID *uuid.UUID) (bool, error)
}

type categoryRepository struct {
	db *sql.DB
}

func NewCategoryRepository(db *sql.DB) CategoryRepository {
	return &categoryRepository{db: db}
}

const categorySelect = `
	SELECT c.id, c.name, c.slug, COALESCE(c.description, ''), c.created_at, c.updated_at,
	       (SELECT COUNT(*) FROM knowledge_documents k WHERE k.category_id = c.id AND k.is_published = TRUE)
	FROM categories c`

func (r *categoryRepository) List(ctx context.Context) ([]models.CategoryWithCount, error) {
	query := categorySelect + " ORDER BY c.name ASC"
	return r.queryCategories(ctx, query)
}

func (r *categoryRepository) ListPublic(ctx context.Context) ([]models.CategoryWithCount, error) {
	query := categorySelect + " WHERE EXISTS (SELECT 1 FROM knowledge_documents k WHERE k.category_id = c.id AND k.is_published = TRUE) ORDER BY c.name ASC"
	return r.queryCategories(ctx, query)
}

func (r *categoryRepository) queryCategories(ctx context.Context, query string, args ...interface{}) ([]models.CategoryWithCount, error) {
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	categories := make([]models.CategoryWithCount, 0)
	for rows.Next() {
		var category models.CategoryWithCount
		if err := rows.Scan(
			&category.ID, &category.Name, &category.Slug, &category.Description,
			&category.CreatedAt, &category.UpdatedAt, &category.DocumentCount,
		); err != nil {
			return nil, err
		}
		categories = append(categories, category)
	}
	return categories, rows.Err()
}

func (r *categoryRepository) FindByID(ctx context.Context, id uuid.UUID) (*models.Category, error) {
	query := `SELECT id, name, slug, COALESCE(description, ''), created_at, updated_at FROM categories WHERE id = $1`
	return r.scanCategory(r.db.QueryRowContext(ctx, query, id))
}

func (r *categoryRepository) FindBySlug(ctx context.Context, slug string) (*models.Category, error) {
	query := `SELECT id, name, slug, COALESCE(description, ''), created_at, updated_at FROM categories WHERE slug = $1`
	return r.scanCategory(r.db.QueryRowContext(ctx, query, slug))
}

func (r *categoryRepository) scanCategory(row *sql.Row) (*models.Category, error) {
	var category models.Category
	err := row.Scan(&category.ID, &category.Name, &category.Slug, &category.Description, &category.CreatedAt, &category.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &category, nil
}

func (r *categoryRepository) Create(ctx context.Context, category *models.Category) error {
	query := `
		INSERT INTO categories (id, name, slug, description, created_at, updated_at)
		VALUES ($1, $2, $3, $4, NOW(), NOW())
		RETURNING created_at, updated_at`
	err := r.db.QueryRowContext(ctx, query, category.ID, category.Name, category.Slug, category.Description).
		Scan(&category.CreatedAt, &category.UpdatedAt)
	return mapPgError(err)
}

func (r *categoryRepository) Update(ctx context.Context, category *models.Category) error {
	query := `
		UPDATE categories SET name = $2, slug = $3, description = $4, updated_at = NOW()
		WHERE id = $1
		RETURNING created_at, updated_at`
	err := r.db.QueryRowContext(ctx, query, category.ID, category.Name, category.Slug, category.Description).
		Scan(&category.CreatedAt, &category.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrNotFound
	}
	return mapPgError(err)
}

func (r *categoryRepository) Delete(ctx context.Context, id uuid.UUID) error {
	result, err := r.db.ExecContext(ctx, "DELETE FROM categories WHERE id = $1", id)
	if err != nil {
		return mapPgError(err)
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

func (r *categoryRepository) CountDocuments(ctx context.Context, id uuid.UUID) (int, error) {
	var count int
	err := r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM knowledge_documents WHERE category_id = $1", id).Scan(&count)
	return count, err
}

func (r *categoryRepository) Count(ctx context.Context) (int, error) {
	var count int
	err := r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM categories").Scan(&count)
	return count, err
}

func (r *categoryRepository) ExistsByName(ctx context.Context, name string, excludeID *uuid.UUID) (bool, error) {
	query := "SELECT EXISTS(SELECT 1 FROM categories WHERE LOWER(name) = LOWER($1)"
	args := []interface{}{strings.TrimSpace(name)}
	if excludeID != nil {
		query += " AND id <> $2"
		args = append(args, *excludeID)
	}
	query += ")"
	var exists bool
	err := r.db.QueryRowContext(ctx, query, args...).Scan(&exists)
	return exists, err
}

func (r *categoryRepository) ExistsBySlug(ctx context.Context, slug string, excludeID *uuid.UUID) (bool, error) {
	query := "SELECT EXISTS(SELECT 1 FROM categories WHERE slug = $1"
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

func mapPgError(err error) error {
	if err == nil {
		return nil
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "23505":
			return ErrDuplicate
		case "23503":
			return fmt.Errorf("%w: data masih digunakan oleh data lain", ErrDuplicate)
		}
	}
	return err
}
