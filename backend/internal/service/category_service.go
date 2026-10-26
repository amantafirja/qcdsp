package service

import (
	"context"
	"errors"
	"strings"

	"qcdsp/backend/internal/models"
	"qcdsp/backend/internal/repository"

	"github.com/google/uuid"
)

type CategoryInput struct {
	Name        string `json:"name" form:"name"`
	Slug        string `json:"slug" form:"slug"`
	Description string `json:"description" form:"description"`
}

type CategoryService interface {
	List(ctx context.Context, publicOnly bool) ([]models.CategoryWithCount, error)
	Get(ctx context.Context, id uuid.UUID) (*models.Category, error)
	Create(ctx context.Context, input CategoryInput) (*models.Category, error)
	Update(ctx context.Context, id uuid.UUID, input CategoryInput) (*models.Category, error)
	Delete(ctx context.Context, id uuid.UUID) error
}

type categoryService struct {
	categories repository.CategoryRepository
}

func NewCategoryService(categories repository.CategoryRepository) CategoryService {
	return &categoryService{categories: categories}
}

func (s *categoryService) List(ctx context.Context, publicOnly bool) ([]models.CategoryWithCount, error) {
	if publicOnly {
		return s.categories.ListPublic(ctx)
	}
	return s.categories.List(ctx)
}

func (s *categoryService) Get(ctx context.Context, id uuid.UUID) (*models.Category, error) {
	category, err := s.categories.FindByID(ctx, id)
	if errors.Is(err, repository.ErrNotFound) {
		return nil, ErrNotFound
	}
	return category, err
}

func (s *categoryService) Create(ctx context.Context, input CategoryInput) (*models.Category, error) {
	input.Name = strings.TrimSpace(input.Name)
	input.Description = strings.TrimSpace(input.Description)

	validation := newValidation()
	if input.Name == "" {
		validation.add("name", "Nama kategori wajib diisi")
	} else if len(input.Name) > 120 {
		validation.add("name", "Nama kategori maksimal 120 karakter")
	}
	if validation.hasErrors() {
		return nil, validation
	}

	slug := models.Slugify(input.Slug)
	if strings.TrimSpace(input.Slug) == "" {
		slug = models.Slugify(input.Name)
	}

	exists, err := s.categories.ExistsByName(ctx, input.Name, nil)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, ValidationErrors{"name": "Nama kategori sudah digunakan"}
	}

	exists, err = s.categories.ExistsBySlug(ctx, slug, nil)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, ValidationErrors{"slug": "Slug kategori sudah digunakan"}
	}

	category := &models.Category{
		ID:          uuid.New(),
		Name:        input.Name,
		Slug:        slug,
		Description: input.Description,
	}
	if err := s.categories.Create(ctx, category); err != nil {
		if errors.Is(err, repository.ErrDuplicate) {
			return nil, ValidationErrors{"name": "Nama atau slug kategori sudah digunakan"}
		}
		return nil, err
	}
	return category, nil
}

func (s *categoryService) Update(ctx context.Context, id uuid.UUID, input CategoryInput) (*models.Category, error) {
	category, err := s.categories.FindByID(ctx, id)
	if errors.Is(err, repository.ErrNotFound) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	input.Name = strings.TrimSpace(input.Name)
	input.Description = strings.TrimSpace(input.Description)

	validation := newValidation()
	if input.Name == "" {
		validation.add("name", "Nama kategori wajib diisi")
	} else if len(input.Name) > 120 {
		validation.add("name", "Nama kategori maksimal 120 karakter")
	}
	if validation.hasErrors() {
		return nil, validation
	}

	slug := models.Slugify(input.Slug)
	if strings.TrimSpace(input.Slug) == "" {
		slug = models.Slugify(input.Name)
	}

	exists, err := s.categories.ExistsByName(ctx, input.Name, &id)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, ValidationErrors{"name": "Nama kategori sudah digunakan"}
	}

	exists, err = s.categories.ExistsBySlug(ctx, slug, &id)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, ValidationErrors{"slug": "Slug kategori sudah digunakan"}
	}

	category.Name = input.Name
	category.Slug = slug
	category.Description = input.Description
	if err := s.categories.Update(ctx, category); err != nil {
		if errors.Is(err, repository.ErrDuplicate) {
			return nil, ValidationErrors{"name": "Nama atau slug kategori sudah digunakan"}
		}
		return nil, err
	}
	return category, nil
}

func (s *categoryService) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := s.categories.FindByID(ctx, id)
	if errors.Is(err, repository.ErrNotFound) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}

	count, err := s.categories.CountDocuments(ctx, id)
	if err != nil {
		return err
	}
	if count > 0 {
		return ValidationErrors{"category": "Kategori masih memiliki dokumen dan tidak dapat dihapus"}
	}

	if err := s.categories.Delete(ctx, id); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return ErrNotFound
		}
		return err
	}
	return nil
}
