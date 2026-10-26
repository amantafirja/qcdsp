package repository

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"qcdsp/backend/internal/models"

	"github.com/google/uuid"
)

var ErrNotFound = errors.New("data tidak ditemukan")
var ErrDuplicate = errors.New("data sudah ada")

type AdminRepository interface {
	FindByUsername(ctx context.Context, username string) (*models.AdminUser, error)
	FindByID(ctx context.Context, id uuid.UUID) (*models.AdminUser, error)
	UpdateLastLogin(ctx context.Context, id uuid.UUID) error
	Count(ctx context.Context) (int, error)
	Create(ctx context.Context, user *models.AdminUser) error
}

type adminRepository struct {
	db *sql.DB
}

func NewAdminRepository(db *sql.DB) AdminRepository {
	return &adminRepository{db: db}
}

func (r *adminRepository) FindByUsername(ctx context.Context, username string) (*models.AdminUser, error) {
	query := `
		SELECT id, username, password_hash, name, role, is_active, last_login_at, created_at, updated_at
		FROM admin_users
		WHERE LOWER(username) = LOWER($1)
		LIMIT 1`
	return r.scanOne(r.db.QueryRowContext(ctx, query, strings.TrimSpace(username)))
}

func (r *adminRepository) FindByID(ctx context.Context, id uuid.UUID) (*models.AdminUser, error) {
	query := `
		SELECT id, username, password_hash, name, role, is_active, last_login_at, created_at, updated_at
		FROM admin_users
		WHERE id = $1`
	return r.scanOne(r.db.QueryRowContext(ctx, query, id))
}

func (r *adminRepository) scanOne(row *sql.Row) (*models.AdminUser, error) {
	var user models.AdminUser
	err := row.Scan(
		&user.ID, &user.Username, &user.PasswordHash, &user.Name, &user.Role,
		&user.IsActive, &user.LastLoginAt, &user.CreatedAt, &user.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *adminRepository) UpdateLastLogin(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, "UPDATE admin_users SET last_login_at = NOW() WHERE id = $1", id)
	return err
}

func (r *adminRepository) Count(ctx context.Context) (int, error) {
	var count int
	err := r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM admin_users").Scan(&count)
	return count, err
}

func (r *adminRepository) Create(ctx context.Context, user *models.AdminUser) error {
	query := `
		INSERT INTO admin_users (id, username, password_hash, name, role, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`
	_, err := r.db.ExecContext(ctx, query, user.ID, user.Username, user.PasswordHash, user.Name, user.Role, user.IsActive)
	return err
}
