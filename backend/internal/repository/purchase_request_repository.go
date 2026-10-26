package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"qcdsp/backend/internal/models"

	"github.com/google/uuid"
)

type PRFilter struct {
	Search    string
	Status    string
	OrderType string
	DateFrom  *time.Time
	DateTo    *time.Time
	Sort      string
	Page      int
	PageSize  int
}

type PurchaseRequestRepository interface {
	CreateWithAttachments(ctx context.Context, pr *models.PurchaseRequest, attachments []models.Attachment) error
	List(ctx context.Context, filter PRFilter) ([]models.PurchaseRequest, int, error)
	FindByID(ctx context.Context, id uuid.UUID) (*models.PurchaseRequest, error)
	FindByReference(ctx context.Context, reference string) (*models.PurchaseRequest, error)
	UpdateStatus(ctx context.Context, id uuid.UUID, status, notes string, adminID *uuid.UUID) error
	UpdateNotes(ctx context.Context, id uuid.UUID, notes string) error
	ExistsReference(ctx context.Context, reference string) (bool, error)
	CountByStatus(ctx context.Context) (map[string]int, error)
	MonthlyCounts(ctx context.Context, months int) ([]models.MonthlyCount, error)
	OrderTypeCounts(ctx context.Context) ([]models.TypeCount, error)
	Recent(ctx context.Context, limit int) ([]models.PurchaseRequest, error)
	Total(ctx context.Context) (int, error)
}

type purchaseRequestRepository struct {
	db *sql.DB
}

func NewPurchaseRequestRepository(db *sql.DB) PurchaseRequestRepository {
	return &purchaseRequestRepository{db: db}
}

func (r *purchaseRequestRepository) CreateWithAttachments(ctx context.Context, pr *models.PurchaseRequest, attachments []models.Attachment) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	query := `
		INSERT INTO purchase_requests (
			id, reference_number, description, order_type, custom_order_type, brand_catalog,
			quantity, requester_name, reason, status, internal_notes
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING created_at, updated_at`
	if err := tx.QueryRowContext(ctx, query,
		pr.ID, pr.ReferenceNumber, pr.Description, pr.OrderType, pr.CustomOrderType,
		pr.BrandCatalog, pr.Quantity, pr.RequesterName, pr.Reason, pr.Status, pr.InternalNotes,
	).Scan(&pr.CreatedAt, &pr.UpdatedAt); err != nil {
		return mapPgError(err)
	}

	for i := range attachments {
		attachments[i].PurchaseRequestID = pr.ID
		attachments[i].ID = uuid.New()
		if err := tx.QueryRowContext(ctx, `
			INSERT INTO attachments (
				id, purchase_request_id, attachment_type, original_name, stored_name, mime_type, size_bytes, file_path
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			RETURNING created_at`,
			attachments[i].ID, attachments[i].PurchaseRequestID, attachments[i].AttachmentType,
			attachments[i].OriginalName, filepath.Base(attachments[i].FilePath), attachments[i].MimeType,
			attachments[i].SizeBytes, attachments[i].FilePath,
		).Scan(&attachments[i].CreatedAt); err != nil {
			return err
		}
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO purchase_request_status_history (id, purchase_request_id, status, notes)
		VALUES ($1, $2, $3, $4)`,
		uuid.New(), pr.ID, pr.Status, "Purchase Request dibuat",
	); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}
	pr.Attachments = attachments
	return nil
}

func (r *purchaseRequestRepository) List(ctx context.Context, filter PRFilter) ([]models.PurchaseRequest, int, error) {
	conditions := []string{"1 = 1"}
	args := []interface{}{}
	argIndex := 1

	if filter.Search != "" {
		search := "%" + strings.ToLower(strings.TrimSpace(filter.Search)) + "%"
		conditions = append(conditions, fmt.Sprintf(
			"(LOWER(reference_number) LIKE $%d OR LOWER(requester_name) LIKE $%d OR LOWER(description) LIKE $%d OR LOWER(brand_catalog) LIKE $%d)",
			argIndex, argIndex, argIndex, argIndex,
		))
		args = append(args, search)
		argIndex++
	}
	if filter.Status != "" {
		conditions = append(conditions, fmt.Sprintf("status = $%d", argIndex))
		args = append(args, filter.Status)
		argIndex++
	}
	if filter.OrderType != "" {
		conditions = append(conditions, fmt.Sprintf("order_type = $%d", argIndex))
		args = append(args, filter.OrderType)
		argIndex++
	}
	if filter.DateFrom != nil {
		conditions = append(conditions, fmt.Sprintf("created_at >= $%d", argIndex))
		args = append(args, *filter.DateFrom)
		argIndex++
	}
	if filter.DateTo != nil {
		conditions = append(conditions, fmt.Sprintf("created_at <= $%d", argIndex))
		args = append(args, *filter.DateTo)
		argIndex++
	}

	where := " WHERE " + strings.Join(conditions, " AND ")

	var total int
	if err := r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM purchase_requests"+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	orderBy := "created_at DESC"
	switch filter.Sort {
	case "oldest":
		orderBy = "created_at ASC"
	case "status":
		orderBy = "status ASC, created_at DESC"
	}

	page := filter.Page
	if page < 1 {
		page = 1
	}
	pageSize := filter.PageSize
	if pageSize < 1 {
		pageSize = 10
	}
	if pageSize > 100 {
		pageSize = 100
	}
	offset := (page - 1) * pageSize

	query := prSelect + where + " ORDER BY " + orderBy + fmt.Sprintf(" LIMIT $%d OFFSET $%d", argIndex, argIndex+1)
	args = append(args, pageSize, offset)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	requests := make([]models.PurchaseRequest, 0)
	ids := make([]uuid.UUID, 0)
	for rows.Next() {
		pr, err := scanPR(rows)
		if err != nil {
			return nil, 0, err
		}
		requests = append(requests, *pr)
		ids = append(ids, pr.ID)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}

	if len(ids) > 0 {
		attachments, err := r.attachmentsForRequests(ctx, ids)
		if err != nil {
			return nil, 0, err
		}
		for i := range requests {
			requests[i].Attachments = attachments[requests[i].ID]
			if requests[i].Attachments == nil {
				requests[i].Attachments = []models.Attachment{}
			}
		}
	}

	return requests, total, nil
}

const prSelect = `
	SELECT id, reference_number, description, order_type, custom_order_type, brand_catalog,
	       quantity, requester_name, reason, status, internal_notes, created_at, updated_at
	FROM purchase_requests`

func (r *purchaseRequestRepository) FindByID(ctx context.Context, id uuid.UUID) (*models.PurchaseRequest, error) {
	row := r.db.QueryRowContext(ctx, prSelect+" WHERE id = $1", id)
	pr, err := scanPRRow(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if err := r.hydrate(ctx, pr); err != nil {
		return nil, err
	}
	return pr, nil
}

func (r *purchaseRequestRepository) FindByReference(ctx context.Context, reference string) (*models.PurchaseRequest, error) {
	row := r.db.QueryRowContext(ctx, prSelect+" WHERE UPPER(reference_number) = UPPER($1)", strings.TrimSpace(reference))
	pr, err := scanPRRow(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if err := r.hydrate(ctx, pr); err != nil {
		return nil, err
	}
	return pr, nil
}

func (r *purchaseRequestRepository) hydrate(ctx context.Context, pr *models.PurchaseRequest) error {
	attachments, err := r.attachmentsForRequests(ctx, []uuid.UUID{pr.ID})
	if err != nil {
		return err
	}
	pr.Attachments = attachments[pr.ID]
	if pr.Attachments == nil {
		pr.Attachments = []models.Attachment{}
	}

	rows, err := r.db.QueryContext(ctx, `
		SELECT h.id, h.status, h.notes, h.changed_by, a.name, h.created_at
		FROM purchase_request_status_history h
		LEFT JOIN admin_users a ON a.id = h.changed_by
		WHERE h.purchase_request_id = $1
		ORDER BY h.created_at ASC`, pr.ID)
	if err != nil {
		return err
	}
	defer rows.Close()

	history := make([]models.StatusHistoryEntry, 0)
	for rows.Next() {
		var entry models.StatusHistoryEntry
		if err := rows.Scan(&entry.ID, &entry.Status, &entry.Notes, &entry.ChangedBy, &entry.AdminName, &entry.CreatedAt); err != nil {
			return err
		}
		history = append(history, entry)
	}
	pr.StatusHistory = history
	return rows.Err()
}

func (r *purchaseRequestRepository) attachmentsForRequests(ctx context.Context, ids []uuid.UUID) (map[uuid.UUID][]models.Attachment, error) {
	result := make(map[uuid.UUID][]models.Attachment)
	if len(ids) == 0 {
		return result, nil
	}

	placeholders := make([]string, len(ids))
	args := make([]interface{}, len(ids))
	for i, id := range ids {
		placeholders[i] = fmt.Sprintf("$%d", i+1)
		args[i] = id
	}

	query := fmt.Sprintf(`
		SELECT id, purchase_request_id, attachment_type, original_name, mime_type, size_bytes, file_path, created_at
		FROM attachments
		WHERE purchase_request_id IN (%s)
		ORDER BY created_at ASC`, strings.Join(placeholders, ", "))

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var attachment models.Attachment
		var filePath string
		if err := rows.Scan(
			&attachment.ID, &attachment.PurchaseRequestID, &attachment.AttachmentType,
			&attachment.OriginalName, &attachment.MimeType, &attachment.SizeBytes, &filePath, &attachment.CreatedAt,
		); err != nil {
			return nil, err
		}
		attachment.FilePath = filePath
		attachment.DownloadURL = fmt.Sprintf("/api/admin/purchase-requests/%s/attachments/%s", attachment.PurchaseRequestID, attachment.ID)
		result[attachment.PurchaseRequestID] = append(result[attachment.PurchaseRequestID], attachment)
	}
	return result, rows.Err()
}

func (r *purchaseRequestRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status, notes string, adminID *uuid.UUID) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	result, err := tx.ExecContext(ctx, "UPDATE purchase_requests SET status = $2, updated_at = NOW() WHERE id = $1", id, status)
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

	var note interface{}
	if strings.TrimSpace(notes) != "" {
		note = strings.TrimSpace(notes)
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO purchase_request_status_history (id, purchase_request_id, status, notes, changed_by)
		VALUES ($1, $2, $3, $4, $5)`, uuid.New(), id, status, note, adminID,
	); err != nil {
		return err
	}

	return tx.Commit()
}

func (r *purchaseRequestRepository) UpdateNotes(ctx context.Context, id uuid.UUID, notes string) error {
	var note interface{}
	if strings.TrimSpace(notes) != "" {
		note = strings.TrimSpace(notes)
	}
	result, err := r.db.ExecContext(ctx, "UPDATE purchase_requests SET internal_notes = $2, updated_at = NOW() WHERE id = $1", id, note)
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

func (r *purchaseRequestRepository) ExistsReference(ctx context.Context, reference string) (bool, error) {
	var exists bool
	err := r.db.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM purchase_requests WHERE reference_number = $1)", reference).Scan(&exists)
	return exists, err
}

func (r *purchaseRequestRepository) CountByStatus(ctx context.Context) (map[string]int, error) {
	result := make(map[string]int)
	for _, status := range models.PRStatuses {
		result[status] = 0
	}
	rows, err := r.db.QueryContext(ctx, "SELECT status, COUNT(*) FROM purchase_requests GROUP BY status")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var status string
		var count int
		if err := rows.Scan(&status, &count); err != nil {
			return nil, err
		}
		result[status] = count
	}
	return result, rows.Err()
}

func (r *purchaseRequestRepository) MonthlyCounts(ctx context.Context, months int) ([]models.MonthlyCount, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT TO_CHAR(m.month, 'YYYY-MM') AS month, COALESCE(p.count, 0) AS count
		FROM (
			SELECT GENERATE_SERIES(
				DATE_TRUNC('month', NOW()) - (($1::int - 1) * INTERVAL '1 month'),
				DATE_TRUNC('month', NOW()),
				INTERVAL '1 month'
			) AS month
		) m
		LEFT JOIN (
			SELECT DATE_TRUNC('month', created_at) AS month, COUNT(*) AS count
			FROM purchase_requests
			WHERE created_at >= DATE_TRUNC('month', NOW()) - (($1::int - 1) * INTERVAL '1 month')
			GROUP BY DATE_TRUNC('month', created_at)
		) p ON p.month = m.month
		ORDER BY m.month ASC`, months)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	results := make([]models.MonthlyCount, 0)
	for rows.Next() {
		var item models.MonthlyCount
		if err := rows.Scan(&item.Month, &item.Count); err != nil {
			return nil, err
		}
		results = append(results, item)
	}
	return results, rows.Err()
}

func (r *purchaseRequestRepository) OrderTypeCounts(ctx context.Context) ([]models.TypeCount, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT order_type, COUNT(*) FROM purchase_requests GROUP BY order_type ORDER BY COUNT(*) DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	results := make([]models.TypeCount, 0)
	for rows.Next() {
		var item models.TypeCount
		if err := rows.Scan(&item.Label, &item.Count); err != nil {
			return nil, err
		}
		results = append(results, item)
	}
	return results, rows.Err()
}

func (r *purchaseRequestRepository) Recent(ctx context.Context, limit int) ([]models.PurchaseRequest, error) {
	rows, err := r.db.QueryContext(ctx, prSelect+" ORDER BY created_at DESC LIMIT $1", limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	results := make([]models.PurchaseRequest, 0)
	for rows.Next() {
		pr, err := scanPR(rows)
		if err != nil {
			return nil, err
		}
		results = append(results, *pr)
	}
	return results, rows.Err()
}

func (r *purchaseRequestRepository) Total(ctx context.Context) (int, error) {
	var count int
	err := r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM purchase_requests").Scan(&count)
	return count, err
}

func scanPR(rows *sql.Rows) (*models.PurchaseRequest, error) {
	return scanPRRow(rows)
}

func scanPRRow(row rowScanner) (*models.PurchaseRequest, error) {
	var pr models.PurchaseRequest
	err := row.Scan(
		&pr.ID, &pr.ReferenceNumber, &pr.Description, &pr.OrderType, &pr.CustomOrderType,
		&pr.BrandCatalog, &pr.Quantity, &pr.RequesterName, &pr.Reason, &pr.Status,
		&pr.InternalNotes, &pr.CreatedAt, &pr.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &pr, nil
}
