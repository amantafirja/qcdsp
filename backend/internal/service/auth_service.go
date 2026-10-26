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

var (
	ErrInvalidCredentials = errors.New("username atau password salah")
	ErrAccountInactive    = errors.New("akun admin tidak aktif")
	ErrValidation         = errors.New("validasi gagal")
)

type ValidationErrors map[string]string

func (v ValidationErrors) Error() string {
	parts := make([]string, 0, len(v))
	for key, value := range v {
		parts = append(parts, key+": "+value)
	}
	return strings.Join(parts, "; ")
}

func newValidation() ValidationErrors {
	return ValidationErrors{}
}

func (v ValidationErrors) add(field, message string) {
	if _, exists := v[field]; !exists {
		v[field] = message
	}
}

func (v ValidationErrors) hasErrors() bool {
	return len(v) > 0
}

type AuthService interface {
	Login(ctx context.Context, username, password string) (*models.AdminUser, string, time.Time, error)
	Profile(ctx context.Context, id uuid.UUID) (*models.AdminUser, error)
}

type authService struct {
	admins repository.AdminRepository
	tokens *utils.TokenManager
}

func NewAuthService(admins repository.AdminRepository, tokens *utils.TokenManager) AuthService {
	return &authService{admins: admins, tokens: tokens}
}

func (s *authService) Login(ctx context.Context, username, password string) (*models.AdminUser, string, time.Time, error) {
	username = strings.TrimSpace(username)
	if username == "" || strings.TrimSpace(password) == "" {
		return nil, "", time.Time{}, ErrInvalidCredentials
	}

	admin, err := s.admins.FindByUsername(ctx, username)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, "", time.Time{}, ErrInvalidCredentials
		}
		return nil, "", time.Time{}, err
	}

	if !utils.CheckPassword(admin.PasswordHash, password) {
		return nil, "", time.Time{}, ErrInvalidCredentials
	}
	if !admin.IsActive {
		return nil, "", time.Time{}, ErrAccountInactive
	}

	token, expiresAt, err := s.tokens.Generate(admin.ID, admin.Username, admin.Name, admin.Role)
	if err != nil {
		return nil, "", time.Time{}, err
	}

	_ = s.admins.UpdateLastLogin(ctx, admin.ID)
	now := time.Now()
	admin.LastLoginAt = &now

	return admin, token, expiresAt, nil
}

func (s *authService) Profile(ctx context.Context, id uuid.UUID) (*models.AdminUser, error) {
	return s.admins.FindByID(ctx, id)
}
