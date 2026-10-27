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
	CountActiveByRole(ctx context.Context, role string) (int, error)
	ExistsByUsername(ctx context.Context, username string, excludeID *uuid.UUID) (bool, error)
	Create(ctx context.Context, user *models.AdminUser) error
	Update(ctx context.Context, user *models.AdminUser, passwordHash *string) error
	Delete(ctx context.Context, id uuid.UUID) error
	List(ctx context.Context) ([]models.AdminUser, error)
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

func (r *adminRepository) CountActiveByRole(ctx context.Context, role string) (int, error) {
	var count int
	err := r.db.QueryRowContext(ctx,
		"SELECT COUNT(*) FROM admin_users WHERE role = $1 AND is_active = TRUE", role).Scan(&count)
	return count, err
}

func (r *adminRepository) ExistsByUsername(ctx context.Context, username string, excludeID *uuid.UUID) (bool, error) {
	query := "SELECT EXISTS(SELECT 1 FROM admin_users WHERE LOWER(username) = LOWER($1)"
	args := []interface{}{strings.TrimSpace(username)}
	if excludeID != nil {
		query += " AND id <> $2"
		args = append(args, *excludeID)
	}
	query += ")"
	var exists bool
	err := r.db.QueryRowContext(ctx, query, args...).Scan(&exists)
	return exists, err
}

func (r *adminRepository) Create(ctx context.Context, user *models.AdminUser) error {
	query := `
		INSERT INTO admin_users (id, username, password_hash, name, role, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`
	_, err := r.db.ExecContext(ctx, query, user.ID, user.Username, user.PasswordHash, user.Name, user.Role, user.IsActive)
	return mapPgError(err)
}

func (r *adminRepository) Update(ctx context.Context, user *models.AdminUser, passwordHash *string) error {
	var result sql.Result
	var err error
	if passwordHash != nil {
		result, err = r.db.ExecContext(ctx, `
			UPDATE admin_users
			SET username = $2, name = $3, role = $4, is_active = $5, password_hash = $6, updated_at = NOW()
			WHERE id = $1`,
			user.ID, user.Username, user.Name, user.Role, user.IsActive, *passwordHash)
	} else {
		result, err = r.db.ExecContext(ctx, `
			UPDATE admin_users
			SET username = $2, name = $3, role = $4, is_active = $5, updated_at = NOW()
			WHERE id = $1`,
			user.ID, user.Username, user.Name, user.Role, user.IsActive)
	}
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

func (r *adminRepository) Delete(ctx context.Context, id uuid.UUID) error {
	result, err := r.db.ExecContext(ctx, "DELETE FROM admin_users WHERE id = $1", id)
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

func (r *adminRepository) List(ctx context.Context) ([]models.AdminUser, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, username, password_hash, name, role, is_active, last_login_at, created_at, updated_at
		FROM admin_users
		ORDER BY created_at ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	users := make([]models.AdminUser, 0)
	for rows.Next() {
		var user models.AdminUser
		if err := rows.Scan(
			&user.ID, &user.Username, &user.PasswordHash, &user.Name, &user.Role,
			&user.IsActive, &user.LastLoginAt, &user.CreatedAt, &user.UpdatedAt,
		); err != nil {
			return nil, err
		}
		users = append(users, user)
	}
	return users, rows.Err()
}
