package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"qcdsp/backend/internal/models"

	"github.com/google/uuid"
)

var (
	ErrStatusFinal  = errors.New("status akhir tidak dapat diubah")
	ErrMergeInvalid = errors.New("penggabungan tidak valid")
)

type PRActor struct {
	ID   *uuid.UUID
	Name string
	Role string
}

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
	Create(ctx context.Context, pr *models.PurchaseRequest, items []models.PurchaseRequestItem, attachments []models.Attachment, actor PRActor) error
	List(ctx context.Context, filter PRFilter) ([]models.PurchaseRequest, int, error)
	FindByID(ctx context.Context, id uuid.UUID) (*models.PurchaseRequest, error)
	FindByReference(ctx context.Context, reference string) (*models.PurchaseRequest, error)
	UpdateStatus(ctx context.Context, id uuid.UUID, status, notes string, actor PRActor) error
	UpdateNotes(ctx context.Context, id uuid.UUID, notes string, actor PRActor) error
	UpdatePOInfo(ctx context.Context, id uuid.UUID, info models.POManualInput, actor PRActor) error
	ResetPOOverride(ctx context.Context, id uuid.UUID, actor PRActor) error
	Merge(ctx context.Context, masterID uuid.UUID, memberIDs []uuid.UUID, actor PRActor) error
	Unmerge(ctx context.Context, masterID uuid.UUID, memberIDs []uuid.UUID, actor PRActor) error
	SoftDelete(ctx context.Context, id uuid.UUID, actor PRActor) error
	ListAudit(ctx context.Context, id uuid.UUID) ([]models.PRAuditLog, error)
	CountByStatus(ctx context.Context) (map[string]int, error)
	MonthlyCounts(ctx context.Context, months int) ([]models.MonthlyCount, error)
	OrderTypeCounts(ctx context.Context) ([]models.TypeCount, error)
	Recent(ctx context.Context, limit int) ([]models.PurchaseRequest, error)
	PRMetrics(ctx context.Context) (models.PRMetrics, error)
}

type purchaseRequestRepository struct {
	db *sql.DB
}

func NewPurchaseRequestRepository(db *sql.DB) PurchaseRequestRepository {
	return &purchaseRequestRepository{db: db}
}

const prSelectColumns = `
	p.id, p.reference_number, p.description, p.order_type, p.custom_order_type,
	p.requester_name, p.reason, p.status, p.internal_notes,
	p.po_number, p.po_date, p.po_value, p.delivery_estimate_date, p.oracle_synced_at,
	p.po_list, p.po_source, p.po_manual_override, p.oracle_sync_status, p.oracle_last_sync_at,
	p.master_pr_id, p.merged_at, p.deleted_at, p.created_at, p.updated_at,
	(SELECT mp.reference_number FROM purchase_requests mp WHERE mp.id = p.master_pr_id) AS master_reference,
	(SELECT COUNT(*) FROM purchase_requests c WHERE c.master_pr_id = p.id AND c.deleted_at IS NULL) AS member_count`

const prFrom = ` FROM purchase_requests p`

func (r *purchaseRequestRepository) Create(ctx context.Context, pr *models.PurchaseRequest, items []models.PurchaseRequestItem, attachments []models.Attachment, actor PRActor) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	reference, err := nextReference(ctx, tx)
	if err != nil {
		return err
	}
	pr.ReferenceNumber = reference
	pr.Status = models.PRStatusFormCreated

	if err := tx.QueryRowContext(ctx, `
		INSERT INTO purchase_requests (
			id, reference_number, description, order_type, custom_order_type,
			requester_name, reason, status, internal_notes
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING created_at, updated_at`,
		pr.ID, pr.ReferenceNumber, pr.Description, pr.OrderType, pr.CustomOrderType,
		pr.RequesterName, pr.Reason, pr.Status, pr.InternalNotes,
	).Scan(&pr.CreatedAt, &pr.UpdatedAt); err != nil {
		return mapPgError(err)
	}

	for i := range items {
		items[i].ID = uuid.New()
		items[i].PurchaseRequestID = pr.ID
		items[i].OriginPRID = pr.ID
		items[i].OriginReference = pr.ReferenceNumber
		items[i].OriginIsMaster = true
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO purchase_request_items (
				id, purchase_request_id, item_name, brand_catalog, quantity, unit, notes, sort_order, created_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
			items[i].ID, items[i].PurchaseRequestID, items[i].ItemName, items[i].BrandCatalog,
			items[i].Quantity, items[i].Unit, items[i].Notes, i+1, pr.CreatedAt,
		); err != nil {
			return err
		}
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
		INSERT INTO purchase_request_status_history (id, purchase_request_id, status, notes, created_at)
		VALUES ($1, $2, $3, $4, $5)`,
		uuid.New(), pr.ID, pr.Status, "Purchase Request dibuat", pr.CreatedAt,
	); err != nil {
		return err
	}

	after := map[string]interface{}{
		"reference_number": pr.ReferenceNumber,
		"status":           pr.Status,
		"order_type":       pr.OrderType,
		"requester_name":   pr.RequesterName,
		"items":            items,
	}
	if err := insertAudit(ctx, tx, pr.ID, "created", actor, "Purchase Request dibuat", nil, after); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}
	pr.Items = items
	pr.Attachments = attachments
	pr.StatusLabel = models.StatusLabel(pr.Status)
	pr.Members = []models.PRReference{}
	return nil
}

func nextReference(ctx context.Context, tx *sql.Tx) (string, error) {
	var period string
	var sequence int
	err := tx.QueryRowContext(ctx, `
		INSERT INTO pr_number_counters (period, last_number)
		SELECT TO_CHAR(NOW(), 'MMYY'), 1
		ON CONFLICT (period) DO UPDATE
		SET last_number = pr_number_counters.last_number + 1,
		    updated_at = NOW()
		RETURNING period, last_number`).Scan(&period, &sequence)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("PRG/1GQ01/%s/%05d", period, sequence), nil
}

func (r *purchaseRequestRepository) List(ctx context.Context, filter PRFilter) ([]models.PurchaseRequest, int, error) {
	conditions := []string{"p.deleted_at IS NULL", "p.master_pr_id IS NULL"}
	args := []interface{}{}
	argIndex := 1

	if filter.Search != "" {
		search := "%" + strings.ToLower(strings.TrimSpace(filter.Search)) + "%"
		conditions = append(conditions, fmt.Sprintf(
			`(LOWER(p.reference_number) LIKE $%d OR LOWER(p.requester_name) LIKE $%d OR LOWER(p.description) LIKE $%d
			  OR EXISTS (SELECT 1 FROM purchase_request_items i WHERE i.purchase_request_id = p.id AND LOWER(i.item_name) LIKE $%d))`,
			argIndex, argIndex, argIndex, argIndex,
		))
		args = append(args, search)
		argIndex++
	}
	if filter.Status != "" {
		conditions = append(conditions, fmt.Sprintf("p.status = $%d", argIndex))
		args = append(args, filter.Status)
		argIndex++
	}
	if filter.OrderType != "" {
		conditions = append(conditions, fmt.Sprintf("p.order_type = $%d", argIndex))
		args = append(args, filter.OrderType)
		argIndex++
	}
	if filter.DateFrom != nil {
		conditions = append(conditions, fmt.Sprintf("p.created_at >= $%d", argIndex))
		args = append(args, *filter.DateFrom)
		argIndex++
	}
	if filter.DateTo != nil {
		conditions = append(conditions, fmt.Sprintf("p.created_at <= $%d", argIndex))
		args = append(args, *filter.DateTo)
		argIndex++
	}

	where := " WHERE " + strings.Join(conditions, " AND ")

	var total int
	if err := r.db.QueryRowContext(ctx, "SELECT COUNT(*)"+prFrom+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	orderBy := "p.created_at DESC"
	switch filter.Sort {
	case "oldest":
		orderBy = "p.created_at ASC"
	case "status":
		orderBy = "p.status ASC, p.created_at DESC"
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

	query := "SELECT" + prSelectColumns + prFrom + where + " ORDER BY " + orderBy +
		fmt.Sprintf(" LIMIT $%d OFFSET $%d", argIndex, argIndex+1)
	args = append(args, pageSize, offset)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	requests := make([]models.PurchaseRequest, 0)
	ids := make([]uuid.UUID, 0)
	for rows.Next() {
		pr, err := scanPRRow(rows)
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
		items, err := r.itemsForRequests(ctx, ids)
		if err != nil {
			return nil, 0, err
		}
		for i := range requests {
			requests[i].Attachments = attachments[requests[i].ID]
			if requests[i].Attachments == nil {
				requests[i].Attachments = []models.Attachment{}
			}
			requests[i].Items = items[requests[i].ID]
			if requests[i].Items == nil {
				requests[i].Items = []models.PurchaseRequestItem{}
			}
		}
	}

	return requests, total, nil
}

func (r *purchaseRequestRepository) FindByID(ctx context.Context, id uuid.UUID) (*models.PurchaseRequest, error) {
	row := r.db.QueryRowContext(ctx, "SELECT"+prSelectColumns+prFrom+" WHERE p.id = $1 AND p.deleted_at IS NULL", id)
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
	row := r.db.QueryRowContext(ctx,
		"SELECT"+prSelectColumns+prFrom+" WHERE UPPER(p.reference_number) = UPPER($1) AND p.deleted_at IS NULL",
		strings.TrimSpace(reference))
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

	items, err := r.itemsForRequests(ctx, []uuid.UUID{pr.ID})
	if err != nil {
		return err
	}
	pr.Items = items[pr.ID]
	if pr.Items == nil {
		pr.Items = []models.PurchaseRequestItem{}
	}

	history, err := r.historyFor(ctx, pr.ID)
	if err != nil {
		return err
	}
	pr.StatusHistory = history

	if pr.IsMerged {
		var master models.PRReference
		err := r.db.QueryRowContext(ctx, `
			SELECT mp.id, mp.reference_number, mp.status
			FROM purchase_requests mp
			WHERE mp.id = (SELECT master_pr_id FROM purchase_requests WHERE id = $1)`, pr.ID).
			Scan(&master.ID, &master.ReferenceNumber, &master.Status)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return err
		}
		if err == nil {
			pr.Master = &master
		}
	}

	members, err := r.membersFor(ctx, pr.ID)
	if err != nil {
		return err
	}
	pr.Members = members
	pr.IsMaster = len(members) > 0

	return nil
}

func (r *purchaseRequestRepository) historyFor(ctx context.Context, prID uuid.UUID) ([]models.StatusHistoryEntry, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT h.id, h.status, h.notes, h.changed_by, a.name, h.created_at
		FROM purchase_request_status_history h
		LEFT JOIN admin_users a ON a.id = h.changed_by
		WHERE h.purchase_request_id = $1
		ORDER BY h.created_at ASC`, prID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	history := make([]models.StatusHistoryEntry, 0)
	for rows.Next() {
		var entry models.StatusHistoryEntry
		if err := rows.Scan(&entry.ID, &entry.Status, &entry.Notes, &entry.ChangedBy, &entry.AdminName, &entry.CreatedAt); err != nil {
			return nil, err
		}
		history = append(history, entry)
	}
	return history, rows.Err()
}

func (r *purchaseRequestRepository) membersFor(ctx context.Context, masterID uuid.UUID) ([]models.PRReference, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT c.id, c.reference_number, c.status, c.requester_name, c.merged_at,
		       (SELECT COUNT(*) FROM purchase_request_items i WHERE i.purchase_request_id = c.id)
		FROM purchase_requests c
		WHERE c.master_pr_id = $1 AND c.deleted_at IS NULL
		ORDER BY c.merged_at ASC NULLS LAST, c.created_at ASC`, masterID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	members := make([]models.PRReference, 0)
	for rows.Next() {
		var member models.PRReference
		if err := rows.Scan(&member.ID, &member.ReferenceNumber, &member.Status,
			&member.RequesterName, &member.MergedAt, &member.ItemCount); err != nil {
			return nil, err
		}
		members = append(members, member)
	}
	return members, rows.Err()
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

// itemsForRequests mengembalikan item milik PR itu sendiri ditambah item dari PR anggota
// ketika ID yang diminta adalah Master PR. Origin item selalu PR asal.
func (r *purchaseRequestRepository) itemsForRequests(ctx context.Context, ids []uuid.UUID) (map[uuid.UUID][]models.PurchaseRequestItem, error) {
	result := make(map[uuid.UUID][]models.PurchaseRequestItem)
	if len(ids) == 0 {
		return result, nil
	}

	placeholders := make([]string, len(ids))
	args := make([]interface{}, len(ids))
	direct := make(map[uuid.UUID]bool, len(ids))
	for i, id := range ids {
		placeholders[i] = fmt.Sprintf("$%d", i+1)
		args[i] = id
		direct[id] = true
	}

	query := fmt.Sprintf(`
		SELECT i.id, i.purchase_request_id, i.item_name, i.brand_catalog, i.quantity, i.unit,
		       i.notes, i.created_at, o.reference_number, o.master_pr_id
		FROM purchase_request_items i
		JOIN purchase_requests o ON o.id = i.purchase_request_id
		WHERE i.purchase_request_id IN (%s)
		   OR o.master_pr_id IN (%s)
		ORDER BY i.created_at ASC, i.sort_order ASC, i.item_name ASC`,
		strings.Join(placeholders, ", "), strings.Join(placeholders, ", "))

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var item models.PurchaseRequestItem
		var ownerMaster *uuid.UUID
		if err := rows.Scan(
			&item.ID, &item.PurchaseRequestID, &item.ItemName, &item.BrandCatalog,
			&item.Quantity, &item.Unit, &item.Notes, &item.CreatedAt,
			&item.OriginReference, &ownerMaster,
		); err != nil {
			return nil, err
		}
		item.OriginPRID = item.PurchaseRequestID

		if direct[item.PurchaseRequestID] {
			item.OriginIsMaster = true
			result[item.PurchaseRequestID] = append(result[item.PurchaseRequestID], item)
			continue
		}
		if ownerMaster != nil && direct[*ownerMaster] {
			item.OriginIsMaster = false
			result[*ownerMaster] = append(result[*ownerMaster], item)
		}
	}

	for key := range result {
		items := result[key]
		sort.SliceStable(items, func(i, j int) bool {
			if items[i].OriginIsMaster != items[j].OriginIsMaster {
				return items[i].OriginIsMaster
			}
			return items[i].CreatedAt.Before(items[j].CreatedAt)
		})
		result[key] = items
	}
	return result, rows.Err()
}

func (r *purchaseRequestRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status, notes string, actor PRActor) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	var current string
	if err := tx.QueryRowContext(ctx,
		"SELECT status FROM purchase_requests WHERE id = $1 AND deleted_at IS NULL FOR UPDATE", id).
		Scan(&current); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}
	if models.IsTerminalStatus(current) {
		return ErrStatusFinal
	}

	if _, err := tx.ExecContext(ctx,
		"UPDATE purchase_requests SET status = $2, updated_at = NOW() WHERE id = $1", id, status); err != nil {
		return err
	}

	var note interface{}
	if strings.TrimSpace(notes) != "" {
		note = strings.TrimSpace(notes)
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO purchase_request_status_history (id, purchase_request_id, status, notes, changed_by)
		VALUES ($1, $2, $3, $4, $5)`, uuid.New(), id, status, note, actor.ID,
	); err != nil {
		return err
	}

	if err := insertAudit(ctx, tx, id, "status_changed", actor, strings.TrimSpace(notes),
		map[string]interface{}{"status": current},
		map[string]interface{}{"status": status}); err != nil {
		return err
	}

	return tx.Commit()
}

func (r *purchaseRequestRepository) UpdateNotes(ctx context.Context, id uuid.UUID, notes string, actor PRActor) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	var previous *string
	if err := tx.QueryRowContext(ctx,
		"SELECT internal_notes FROM purchase_requests WHERE id = $1 AND deleted_at IS NULL FOR UPDATE", id).
		Scan(&previous); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}

	var note interface{}
	if strings.TrimSpace(notes) != "" {
		note = strings.TrimSpace(notes)
	}
	if _, err := tx.ExecContext(ctx,
		"UPDATE purchase_requests SET internal_notes = $2, updated_at = NOW() WHERE id = $1", id, note); err != nil {
		return err
	}

	if err := insertAudit(ctx, tx, id, "notes_updated", actor, "",
		map[string]interface{}{"internal_notes": previous},
		map[string]interface{}{"internal_notes": note}); err != nil {
		return err
	}

	return tx.Commit()
}

func (r *purchaseRequestRepository) UpdatePOInfo(ctx context.Context, id uuid.UUID, info models.POManualInput, actor PRActor) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	var (
		oldPONumber  *string
		oldPODate    *string
		oldPOValue   *float64
		oldDelivery  *string
		currentStatus string
	)
	if err := tx.QueryRowContext(ctx, `
		SELECT po_number, po_date::text, po_value, delivery_estimate_date::text, status
		FROM purchase_requests
		WHERE id = $1 AND deleted_at IS NULL
		FOR UPDATE`, id).Scan(&oldPONumber, &oldPODate, &oldPOValue, &oldDelivery, &currentStatus); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}

	newStatus := currentStatus
	if !models.IsTerminalStatus(currentStatus) {
		if info.PONumber != nil && strings.TrimSpace(*info.PONumber) != "" {
			newStatus = models.PRStatusPOApprove
		} else {
			newStatus = models.PRStatusPendingPO
		}
	}

	syncStatus := models.OracleStatusBelumPO
	if info.PONumber != nil && strings.TrimSpace(*info.PONumber) != "" {
		syncStatus = models.OracleStatusSudahPO
	}

	if _, err := tx.ExecContext(ctx, `
		UPDATE purchase_requests
		SET po_number = $2,
		    po_date = $3::date,
		    po_value = $4,
		    delivery_estimate_date = $5::date,
		    po_source = 'manual',
		    po_manual_override = TRUE,
		    oracle_sync_status = $6,
		    status = $7,
		    updated_at = NOW()
		WHERE id = $1`,
		id, info.PONumber, info.PODate, info.POValue, info.DeliveryEstimateDate, syncStatus, newStatus,
	); err != nil {
		return err
	}

	if newStatus != currentStatus {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO purchase_request_status_history (id, purchase_request_id, status, notes, changed_by)
			VALUES ($1, $2, $3, $4, $5)`,
			uuid.New(), id, newStatus, "Perubahan status otomatis dari edit data PO manual", actor.ID,
		); err != nil {
			return err
		}
	}

	before := map[string]interface{}{
		"po_number":              oldPONumber,
		"po_date":                oldPODate,
		"po_value":               oldPOValue,
		"delivery_estimate_date": oldDelivery,
		"status":                 currentStatus,
	}
	after := map[string]interface{}{
		"po_number":              info.PONumber,
		"po_date":                info.PODate,
		"po_value":               info.POValue,
		"delivery_estimate_date": info.DeliveryEstimateDate,
		"status":                 newStatus,
		"po_source":              "manual",
	}
	if err := insertAudit(ctx, tx, id, "po_manual_updated", actor, "Data PO diubah manual", before, after); err != nil {
		return err
	}

	return tx.Commit()
}

func (r *purchaseRequestRepository) ResetPOOverride(ctx context.Context, id uuid.UUID, actor PRActor) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	result, err := tx.ExecContext(ctx, `
		UPDATE purchase_requests
		SET po_manual_override = FALSE, po_source = 'oracle', updated_at = NOW()
		WHERE id = $1 AND deleted_at IS NULL`, id)
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

	if err := insertAudit(ctx, tx, id, "po_override_reset", actor, "Manual override data PO dilepas",
		map[string]interface{}{"po_manual_override": true},
		map[string]interface{}{"po_manual_override": false}); err != nil {
		return err
	}

	return tx.Commit()
}

func (r *purchaseRequestRepository) Merge(ctx context.Context, masterID uuid.UUID, memberIDs []uuid.UUID, actor PRActor) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	var masterStatus string
	var masterDeleted *time.Time
	var masterParent *uuid.UUID
	if err := tx.QueryRowContext(ctx,
		"SELECT status, deleted_at, master_pr_id FROM purchase_requests WHERE id = $1 FOR UPDATE", masterID).
		Scan(&masterStatus, &masterDeleted, &masterParent); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}
	if masterDeleted != nil {
		return fmt.Errorf("%w: PR utama sudah dihapus", ErrMergeInvalid)
	}
	if masterParent != nil {
		return fmt.Errorf("%w: PR utama sudah menjadi anggota PR lain", ErrMergeInvalid)
	}
	if models.IsTerminalStatus(masterStatus) {
		return fmt.Errorf("%w: PR utama sudah berstatus akhir", ErrMergeInvalid)
	}

	type mergedMember struct {
		ID        uuid.UUID
		Reference string
		Status    string
	}

	merged := make([]mergedMember, 0, len(memberIDs))
	for _, memberID := range memberIDs {
		if memberID == masterID {
			return fmt.Errorf("%w: PR utama tidak boleh menjadi anggota", ErrMergeInvalid)
		}

		var status string
		var deletedAt *time.Time
		var parent *uuid.UUID
		if err := tx.QueryRowContext(ctx,
			"SELECT status, deleted_at, master_pr_id FROM purchase_requests WHERE id = $1 FOR UPDATE", memberID).
			Scan(&status, &deletedAt, &parent); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return fmt.Errorf("%w: PR anggota tidak ditemukan", ErrMergeInvalid)
			}
			return err
		}
		if deletedAt != nil {
			return fmt.Errorf("%w: PR anggota sudah dihapus", ErrMergeInvalid)
		}
		if parent != nil {
			return fmt.Errorf("%w: PR anggota sudah tergabung pada PR lain", ErrMergeInvalid)
		}
		if models.IsTerminalStatus(status) {
			return fmt.Errorf("%w: PR anggota sudah berstatus akhir", ErrMergeInvalid)
		}

		var hasMembers bool
		if err := tx.QueryRowContext(ctx,
			"SELECT EXISTS(SELECT 1 FROM purchase_requests WHERE master_pr_id = $1 AND deleted_at IS NULL)", memberID).
			Scan(&hasMembers); err != nil {
			return err
		}
		if hasMembers {
			return fmt.Errorf("%w: PR yang sudah menjadi master tidak dapat digabungkan", ErrMergeInvalid)
		}

		if _, err := tx.ExecContext(ctx,
			"UPDATE purchase_requests SET master_pr_id = $2, merged_at = NOW(), merged_by = $3, updated_at = NOW() WHERE id = $1",
			memberID, masterID, actor.ID); err != nil {
			return err
		}

		if err := insertAudit(ctx, tx, memberID, "merged_into", actor, "",
			map[string]interface{}{"master_pr_id": nil},
			map[string]interface{}{"master_pr_id": masterID}); err != nil {
			return err
		}

		var reference string
		if err := tx.QueryRowContext(ctx,
			"SELECT reference_number FROM purchase_requests WHERE id = $1", memberID).Scan(&reference); err != nil {
			return err
		}
		merged = append(merged, mergedMember{ID: memberID, Reference: reference, Status: status})
	}

	if err := insertAudit(ctx, tx, masterID, "merged", actor, "",
		map[string]interface{}{"members": []string{}},
		map[string]interface{}{"members": merged}); err != nil {
		return err
	}

	return tx.Commit()
}

func (r *purchaseRequestRepository) Unmerge(ctx context.Context, masterID uuid.UUID, memberIDs []uuid.UUID, actor PRActor) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	var masterReference string
	if err := tx.QueryRowContext(ctx,
		"SELECT reference_number FROM purchase_requests WHERE id = $1 AND deleted_at IS NULL FOR UPDATE", masterID).
		Scan(&masterReference); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}

	targets := memberIDs
	if len(targets) == 0 {
		rows, err := tx.QueryContext(ctx,
			"SELECT id FROM purchase_requests WHERE master_pr_id = $1 AND deleted_at IS NULL", masterID)
		if err != nil {
			return err
		}
		for rows.Next() {
			var id uuid.UUID
			if err := rows.Scan(&id); err != nil {
				rows.Close()
				return err
			}
			targets = append(targets, id)
		}
		rows.Close()
	}

	released := make([]uuid.UUID, 0, len(targets))
	for _, memberID := range targets {
		var parent *uuid.UUID
		if err := tx.QueryRowContext(ctx,
			"SELECT master_pr_id FROM purchase_requests WHERE id = $1 AND deleted_at IS NULL FOR UPDATE", memberID).
			Scan(&parent); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return fmt.Errorf("%w: PR anggota tidak ditemukan", ErrMergeInvalid)
			}
			return err
		}
		if parent == nil || *parent != masterID {
			return fmt.Errorf("%w: PR bukan anggota dari PR utama ini", ErrMergeInvalid)
		}

		if _, err := tx.ExecContext(ctx, `
			UPDATE purchase_requests
			SET master_pr_id = NULL, merged_at = NULL, merged_by = NULL, updated_at = NOW()
			WHERE id = $1`, memberID); err != nil {
			return err
		}

		if err := insertAudit(ctx, tx, memberID, "unmerged", actor, "",
			map[string]interface{}{"master_pr_id": masterID},
			map[string]interface{}{"master_pr_id": nil}); err != nil {
			return err
		}
		released = append(released, memberID)
	}

	if err := insertAudit(ctx, tx, masterID, "unmerge", actor, "",
		map[string]interface{}{"members": released},
		map[string]interface{}{"members": []string{}}); err != nil {
		return err
	}

	return tx.Commit()
}

func (r *purchaseRequestRepository) SoftDelete(ctx context.Context, id uuid.UUID, actor PRActor) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	var reference string
	var status string
	var deletedAt *time.Time
	if err := tx.QueryRowContext(ctx,
		"SELECT reference_number, status, deleted_at FROM purchase_requests WHERE id = $1 FOR UPDATE", id).
		Scan(&reference, &status, &deletedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}
	if deletedAt != nil {
		return ErrNotFound
	}

	if _, err := tx.ExecContext(ctx,
		"UPDATE purchase_requests SET deleted_at = NOW(), deleted_by = $2, updated_at = NOW() WHERE id = $1",
		id, actor.ID); err != nil {
		return err
	}

	if err := insertAudit(ctx, tx, id, "deleted", actor, "Purchase Request dihapus (soft delete)",
		map[string]interface{}{"reference_number": reference, "status": status, "deleted_at": nil},
		map[string]interface{}{"reference_number": reference, "status": status, "deleted_at": time.Now()}); err != nil {
		return err
	}

	return tx.Commit()
}

func (r *purchaseRequestRepository) ListAudit(ctx context.Context, id uuid.UUID) ([]models.PRAuditLog, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, action, actor_id, actor_name, actor_role, notes, before_data, after_data, created_at
		FROM purchase_request_audit_logs
		WHERE purchase_request_id = $1
		ORDER BY created_at DESC
		LIMIT 200`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	logs := make([]models.PRAuditLog, 0)
	for rows.Next() {
		var entry models.PRAuditLog
		var before, after []byte
		if err := rows.Scan(&entry.ID, &entry.Action, &entry.ActorID, &entry.ActorName,
			&entry.ActorRole, &entry.Notes, &before, &after, &entry.CreatedAt); err != nil {
			return nil, err
		}
		if len(before) > 0 {
			entry.BeforeData = json.RawMessage(before)
		}
		if len(after) > 0 {
			entry.AfterData = json.RawMessage(after)
		}
		logs = append(logs, entry)
	}
	return logs, rows.Err()
}

func (r *purchaseRequestRepository) CountByStatus(ctx context.Context) (map[string]int, error) {
	result := make(map[string]int)
	for _, status := range models.PRStatuses {
		result[status] = 0
	}
	rows, err := r.db.QueryContext(ctx,
		"SELECT status, COUNT(*) FROM purchase_requests WHERE deleted_at IS NULL AND master_pr_id IS NULL GROUP BY status")
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
			WHERE deleted_at IS NULL
			  AND master_pr_id IS NULL
			  AND created_at >= DATE_TRUNC('month', NOW()) - (($1::int - 1) * INTERVAL '1 month')
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
		SELECT order_type, COUNT(*) FROM purchase_requests
		WHERE deleted_at IS NULL AND master_pr_id IS NULL
		GROUP BY order_type ORDER BY COUNT(*) DESC`)
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
	rows, err := r.db.QueryContext(ctx,
		"SELECT"+prSelectColumns+prFrom+" WHERE p.deleted_at IS NULL AND p.master_pr_id IS NULL ORDER BY p.created_at DESC LIMIT $1", limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	results := make([]models.PurchaseRequest, 0)
	ids := make([]uuid.UUID, 0)
	for rows.Next() {
		pr, err := scanPRRow(rows)
		if err != nil {
			return nil, err
		}
		results = append(results, *pr)
		ids = append(ids, pr.ID)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if len(ids) > 0 {
		items, err := r.itemsForRequests(ctx, ids)
		if err != nil {
			return nil, err
		}
		for i := range results {
			results[i].Items = items[results[i].ID]
			if results[i].Items == nil {
				results[i].Items = []models.PurchaseRequestItem{}
			}
		}
	}
	return results, nil
}

func (r *purchaseRequestRepository) PRMetrics(ctx context.Context) (models.PRMetrics, error) {
	var metrics models.PRMetrics
	err := r.db.QueryRowContext(ctx, `
		SELECT COUNT(*),
		       COUNT(*) FILTER (WHERE status IN ('form_created', 'op_penawaran', 'op_proposal', 'op_manager', 'pending_po')),
		       COUNT(*) FILTER (WHERE status = 'op_manager'),
		       COUNT(*) FILTER (WHERE status IN ('po_approve', 'done')),
		       COUNT(*) FILTER (WHERE status IN ('done', 'rejected', 'cancelled')),
		       COUNT(*) FILTER (WHERE status = 'po_approve')
		FROM purchase_requests
		WHERE deleted_at IS NULL AND master_pr_id IS NULL`).Scan(
		&metrics.Total, &metrics.Open, &metrics.PendingApproval,
		&metrics.Approved, &metrics.Closed, &metrics.OutstandingDelivery,
	)
	if err != nil {
		return metrics, err
	}

	if err := r.db.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM purchase_requests
		WHERE deleted_at IS NULL AND master_pr_id IS NOT NULL`).Scan(&metrics.Merged); err != nil {
		return metrics, err
	}

	return metrics, nil
}

func scanPRRow(row rowScanner) (*models.PurchaseRequest, error) {
	var pr models.PurchaseRequest
	var masterID *uuid.UUID
	var masterRef sql.NullString
	var memberCount int
	var poList []byte
	var oracleSyncStatus sql.NullString
	err := row.Scan(
		&pr.ID, &pr.ReferenceNumber, &pr.Description, &pr.OrderType, &pr.CustomOrderType,
		&pr.RequesterName, &pr.Reason, &pr.Status, &pr.InternalNotes,
		&pr.PONumber, &pr.PODate, &pr.POValue, &pr.DeliveryEstimateDate, &pr.OracleSyncedAt,
		&poList, &pr.POSource, &pr.POManualOverride, &oracleSyncStatus, &pr.OracleLastSyncAt,
		&masterID, &pr.MergedAt, &pr.DeletedAt, &pr.CreatedAt, &pr.UpdatedAt,
		&masterRef, &memberCount,
	)
	if err != nil {
		return nil, err
	}
	if len(poList) > 0 {
		pr.POList = json.RawMessage(poList)
	}
	if oracleSyncStatus.Valid {
		value := oracleSyncStatus.String
		pr.OracleSyncStatus = &value
	}
	pr.StatusLabel = models.StatusLabel(pr.Status)
	pr.IsMerged = masterID != nil
	pr.MemberCount = memberCount
	pr.IsMaster = memberCount > 0
	pr.Members = []models.PRReference{}
	if masterID != nil {
		pr.Master = &models.PRReference{ID: *masterID}
		if masterRef.Valid {
			pr.Master.ReferenceNumber = masterRef.String
		}
	}
	return &pr, nil
}

func insertAudit(ctx context.Context, tx *sql.Tx, prID uuid.UUID, action string, actor PRActor, notes string, before, after interface{}) error {
	var beforeJSON, afterJSON []byte
	var err error
	if before != nil {
		beforeJSON, err = json.Marshal(before)
		if err != nil {
			return err
		}
	}
	if after != nil {
		afterJSON, err = json.Marshal(after)
		if err != nil {
			return err
		}
	}

	var note interface{}
	if strings.TrimSpace(notes) != "" {
		note = strings.TrimSpace(notes)
	}

	_, err = tx.ExecContext(ctx, `
		INSERT INTO purchase_request_audit_logs (
			purchase_request_id, action, actor_id, actor_name, actor_role, notes, before_data, after_data
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		prID, action, actor.ID, actor.Name, actor.Role, note, nullableJSON(beforeJSON), nullableJSON(afterJSON))
	return err
}

func nullableJSON(value []byte) interface{} {
	if len(value) == 0 {
		return nil
	}
	return value
}
