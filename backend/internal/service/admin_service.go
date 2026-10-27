package service

import (
	"context"
	"errors"
	"regexp"
	"strings"

	"qcdsp/backend/internal/models"
	"qcdsp/backend/internal/repository"
	"qcdsp/backend/internal/utils"

	"github.com/google/uuid"
)

var usernamePattern = regexp.MustCompile(`^[a-zA-Z0-9._-]+$`)

type AdminAccountInput struct {
	Username string `json:"username"`
	Name     string `json:"name"`
	Password string `json:"password"`
	Role     string `json:"role"`
	IsActive *bool  `json:"is_active"`
}

type AdminService interface {
	List(ctx context.Context) ([]models.AdminUser, error)
	Create(ctx context.Context, input AdminAccountInput) (*models.AdminUser, error)
	Update(ctx context.Context, actorID, targetID uuid.UUID, input AdminAccountInput) (*models.AdminUser, error)
	Delete(ctx context.Context, actorID, targetID uuid.UUID) error
}

type adminService struct {
	admins repository.AdminRepository
}

func NewAdminService(admins repository.AdminRepository) AdminService {
	return &adminService{admins: admins}
}

func (s *adminService) List(ctx context.Context) ([]models.AdminUser, error) {
	return s.admins.List(ctx)
}

func (s *adminService) Create(ctx context.Context, input AdminAccountInput) (*models.AdminUser, error) {
	input = normalizeAdminInput(input)

	validation := validateAdminInput(input, true)
	if validation.hasErrors() {
		return nil, validation
	}

	exists, err := s.admins.ExistsByUsername(ctx, input.Username, nil)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, ValidationErrors{"username": "Username sudah digunakan"}
	}

	hash, err := utils.HashPassword(input.Password)
	if err != nil {
		return nil, ValidationErrors{"password": "Password minimal 8 karakter"}
	}

	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}

	admin := &models.AdminUser{
		ID:           uuid.New(),
		Username:     input.Username,
		PasswordHash: hash,
		Name:         input.Name,
		Role:         input.Role,
		IsActive:     isActive,
	}
	if err := s.admins.Create(ctx, admin); err != nil {
		if errors.Is(err, repository.ErrDuplicate) {
			return nil, ValidationErrors{"username": "Username sudah digunakan"}
		}
		return nil, err
	}
	return s.admins.FindByID(ctx, admin.ID)
}

func (s *adminService) Update(ctx context.Context, actorID, targetID uuid.UUID, input AdminAccountInput) (*models.AdminUser, error) {
	input = normalizeAdminInput(input)

	target, err := s.admins.FindByID(ctx, targetID)
	if errors.Is(err, repository.ErrNotFound) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	validation := validateAdminInput(input, false)
	if validation.hasErrors() {
		return nil, validation
	}

	exists, err := s.admins.ExistsByUsername(ctx, input.Username, &targetID)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, ValidationErrors{"username": "Username sudah digunakan"}
	}

	newActive := target.IsActive
	if input.IsActive != nil {
		newActive = *input.IsActive
	}
	if actorID == targetID && !newActive {
		return nil, ValidationErrors{"is_active": "Tidak dapat menonaktifkan akun sendiri"}
	}

	stillSuperAdmin := target.Role == models.RoleSuperAdmin && target.IsActive
	removingSuperAdmin := input.Role != models.RoleSuperAdmin || !newActive
	if stillSuperAdmin && removingSuperAdmin {
		count, err := s.admins.CountActiveByRole(ctx, models.RoleSuperAdmin)
		if err != nil {
			return nil, err
		}
		if count <= 1 {
			return nil, ValidationErrors{"role": "Minimal harus ada satu akun Super Admin yang aktif"}
		}
	}

	var passwordHash *string
	if input.Password != "" {
		hash, err := utils.HashPassword(input.Password)
		if err != nil {
			return nil, ValidationErrors{"password": "Password minimal 8 karakter"}
		}
		passwordHash = &hash
	}

	target.Username = input.Username
	target.Name = input.Name
	target.Role = input.Role
	target.IsActive = newActive
	if err := s.admins.Update(ctx, target, passwordHash); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, ErrNotFound
		}
		if errors.Is(err, repository.ErrDuplicate) {
			return nil, ValidationErrors{"username": "Username sudah digunakan"}
		}
		return nil, err
	}
	return s.admins.FindByID(ctx, targetID)
}

func (s *adminService) Delete(ctx context.Context, actorID, targetID uuid.UUID) error {
	if actorID == targetID {
		return ValidationErrors{"account": "Tidak dapat menghapus akun sendiri"}
	}

	target, err := s.admins.FindByID(ctx, targetID)
	if errors.Is(err, repository.ErrNotFound) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}

	if target.Role == models.RoleSuperAdmin && target.IsActive {
		count, err := s.admins.CountActiveByRole(ctx, models.RoleSuperAdmin)
		if err != nil {
			return err
		}
		if count <= 1 {
			return ValidationErrors{"account": "Minimal harus ada satu akun Super Admin yang aktif"}
		}
	}

	if err := s.admins.Delete(ctx, targetID); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return ErrNotFound
		}
		return err
	}
	return nil
}

func normalizeAdminInput(input AdminAccountInput) AdminAccountInput {
	input.Username = strings.TrimSpace(input.Username)
	input.Name = strings.TrimSpace(input.Name)
	input.Role = strings.TrimSpace(input.Role)
	if input.Role == "" {
		input.Role = models.RoleAdmin
	}
	return input
}

func validateAdminInput(input AdminAccountInput, requirePassword bool) ValidationErrors {
	validation := newValidation()

	if input.Name == "" {
		validation.add("name", "Nama wajib diisi")
	} else if len(input.Name) > 150 {
		validation.add("name", "Nama maksimal 150 karakter")
	}

	if input.Username == "" {
		validation.add("username", "Username wajib diisi")
	} else if len(input.Username) < 3 || len(input.Username) > 80 {
		validation.add("username", "Username harus 3-80 karakter")
	} else if !usernamePattern.MatchString(input.Username) {
		validation.add("username", "Username hanya boleh huruf, angka, titik, garis bawah, dan tanda hubung")
	}

	if !models.IsValidAdminRole(input.Role) {
		validation.add("role", "Role tidak valid")
	}

	if requirePassword && input.Password == "" {
		validation.add("password", "Password wajib diisi")
	} else if input.Password != "" && len(input.Password) < 8 {
		validation.add("password", "Password minimal 8 karakter")
	}

	return validation
}
