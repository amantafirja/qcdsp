package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"qcdsp/backend/internal/models"

	"github.com/google/uuid"
)

type OracleRepository interface {
	ReplaceDataset(ctx context.Context, importRecord *models.OracleImport, rows []models.OraclePurchaseOrder) error
	LastImport(ctx context.Context) (*models.OracleImport, error)
	ListImports(ctx context.Context, limit int) ([]models.OracleImport, error)
	ListRows(ctx context.Context) ([]models.OraclePurchaseOrder, error)
	CountMatchingPRs(ctx context.Context, prNumbers []string) (int, error)
	SyncToPurchaseRequests(ctx context.Context, actor PRActor) (*models.OracleSyncResult, error)
	LogSync(ctx context.Context, log *models.OracleSyncLog) error
	ListSyncLogs(ctx context.Context, limit int) ([]models.OracleSyncLog, error)
	SyncLog(ctx context.Context, id uuid.UUID) (*models.OracleSyncLog, error)
	UpdateImportStats(ctx context.Context, importID uuid.UUID, stats models.OracleImport) error
	Clear(ctx context.Context, actor PRActor) error
}

type oracleRepository struct {
	db *sql.DB
}

func NewOracleRepository(db *sql.DB) OracleRepository {
	return &oracleRepository{db: db}
}

func (r *oracleRepository) ReplaceDataset(ctx context.Context, importRecord *models.OracleImport, rows []models.OraclePurchaseOrder) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	if err := tx.QueryRowContext(ctx, `
		INSERT INTO oracle_imports (
			id, file_name, uploaded_by, uploaded_by_name, total_rows, total_pr, matched_count,
			status, notes, file_size, duplicate_rows, multi_line_prs, multi_po_prs, needs_review_prs
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		RETURNING created_at`,
		importRecord.ID, importRecord.FileName, importRecord.UploadedBy, importRecord.UploadedByName,
		importRecord.TotalRows, importRecord.TotalPR, importRecord.MatchedCount, importRecord.Status,
		importRecord.Notes, importRecord.FileSize, importRecord.DuplicateRows, importRecord.MultiLinePRs,
		importRecord.MultiPOPRs, importRecord.NeedsReviewPRs,
	).Scan(&importRecord.CreatedAt); err != nil {
		return err
	}

	// Dataset Oracle hanya menyimpan hasil upload terakhir.
	if _, err := tx.ExecContext(ctx, "DELETE FROM oracle_purchase_orders"); err != nil {
		return err
	}

	for i := range rows {
		rows[i].ImportID = importRecord.ID
		var raw interface{}
		if len(rows[i].RawData) > 0 {
			raw = []byte(rows[i].RawData)
		}
		if err := tx.QueryRowContext(ctx, `
			INSERT INTO oracle_purchase_orders (
				import_id, pr_number, po_number, po_date, total_value, delivery_date,
				line_count, qty_total, item_summary, raw_data, po_list,
				duplicate_lines, multi_line, multi_po, needs_review, sync_status
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
			RETURNING id, created_at`,
			rows[i].ImportID, rows[i].PRNumber, rows[i].PONumber, rows[i].PODate, rows[i].TotalValue,
			rows[i].DeliveryDate, rows[i].LineCount, rows[i].QtyTotal, rows[i].ItemSummary, raw,
			nullableJSON(rows[i].POList), rows[i].DuplicateLines, rows[i].MultiLine, rows[i].MultiPO,
			rows[i].NeedsReview, rows[i].SyncStatus,
		).Scan(&rows[i].ID, &rows[i].CreatedAt); err != nil {
			return err
		}
	}

	return tx.Commit()
}

const oracleImportColumns = `
	id, file_name, uploaded_by, uploaded_by_name, total_rows, total_pr,
	matched_count, synced_count, status, notes, created_at, synced_at,
	duplicate_rows, multi_line_prs, multi_po_prs, needs_review_prs,
	not_found_prs, updated_prs, file_size, sync_count`

func scanOracleImport(row rowScanner) (*models.OracleImport, error) {
	var record models.OracleImport
	if err := row.Scan(
		&record.ID, &record.FileName, &record.UploadedBy, &record.UploadedByName,
		&record.TotalRows, &record.TotalPR, &record.MatchedCount, &record.SyncedCount,
		&record.Status, &record.Notes, &record.CreatedAt, &record.SyncedAt,
		&record.DuplicateRows, &record.MultiLinePRs, &record.MultiPOPRs, &record.NeedsReviewPRs,
		&record.NotFoundPRs, &record.UpdatedPRs, &record.FileSize, &record.SyncCount,
	); err != nil {
		return nil, err
	}
	return &record, nil
}

func (r *oracleRepository) LastImport(ctx context.Context) (*models.OracleImport, error) {
	record, err := scanOracleImport(r.db.QueryRowContext(ctx,
		"SELECT"+oracleImportColumns+" FROM oracle_imports ORDER BY created_at DESC LIMIT 1"))
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return record, err
}

func (r *oracleRepository) ListImports(ctx context.Context, limit int) ([]models.OracleImport, error) {
	if limit < 1 || limit > 50 {
		limit = 10
	}
	rows, err := r.db.QueryContext(ctx,
		"SELECT"+oracleImportColumns+" FROM oracle_imports ORDER BY created_at DESC LIMIT $1", limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records := make([]models.OracleImport, 0)
	for rows.Next() {
		record, err := scanOracleImport(rows)
		if err != nil {
			return nil, err
		}
		records = append(records, *record)
	}
	return records, rows.Err()
}

func (r *oracleRepository) ListRows(ctx context.Context) ([]models.OraclePurchaseOrder, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT o.id, o.import_id, o.pr_number, o.po_number, o.po_date, o.total_value,
		       o.delivery_date, o.line_count, o.qty_total, o.item_summary, o.created_at,
		       o.po_list, o.duplicate_lines, o.multi_line, o.multi_po, o.needs_review, o.sync_status,
		       p.id, p.reference_number, p.status
		FROM oracle_purchase_orders o
		LEFT JOIN purchase_requests p
		       ON UPPER(BTRIM(p.reference_number)) = UPPER(BTRIM(o.pr_number)) AND p.deleted_at IS NULL
		ORDER BY o.pr_number ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	results := make([]models.OraclePurchaseOrder, 0)
	for rows.Next() {
		var item models.OraclePurchaseOrder
		var poList []byte
		var syncStatus *string
		if err := rows.Scan(
			&item.ID, &item.ImportID, &item.PRNumber, &item.PONumber, &item.PODate, &item.TotalValue,
			&item.DeliveryDate, &item.LineCount, &item.QtyTotal, &item.ItemSummary, &item.CreatedAt,
			&poList, &item.DuplicateLines, &item.MultiLine, &item.MultiPO, &item.NeedsReview, &syncStatus,
			&item.MatchedPRID, &item.MatchedPRRef, &item.PRStatus,
		); err != nil {
			return nil, err
		}
		if len(poList) > 0 {
			item.POList = json.RawMessage(poList)
		}
		item.SyncStatus = syncStatus
		results = append(results, item)
	}
	return results, rows.Err()
}

func (r *oracleRepository) CountMatchingPRs(ctx context.Context, prNumbers []string) (int, error) {
	if len(prNumbers) == 0 {
		return 0, nil
	}
	normalized := make([]string, 0, len(prNumbers))
	for _, number := range prNumbers {
		normalized = append(normalized, strings.ToUpper(strings.TrimSpace(number)))
	}

	var count int
	err := r.db.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM purchase_requests
		WHERE deleted_at IS NULL AND UPPER(BTRIM(reference_number)) = ANY($1)`, normalized).Scan(&count)
	return count, err
}

func (r *oracleRepository) UpdateImportStats(ctx context.Context, importID uuid.UUID, stats models.OracleImport) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE oracle_imports
		SET status = $2, matched_count = $3, synced_count = $4, not_found_prs = $5,
		    updated_prs = $6, duplicate_rows = $7, multi_line_prs = $8, multi_po_prs = $9,
		    needs_review_prs = $10, sync_count = sync_count + 1, synced_at = NOW()
		WHERE id = $1`,
		importID, stats.Status, stats.MatchedCount, stats.SyncedCount, stats.NotFoundPRs,
		stats.UpdatedPRs, stats.DuplicateRows, stats.MultiLinePRs, stats.MultiPOPRs, stats.NeedsReviewPRs)
	return err
}

func (r *oracleRepository) SyncToPurchaseRequests(ctx context.Context, actor PRActor) (*models.OracleSyncResult, error) {
	result := &models.OracleSyncResult{}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback() }()

	var importID uuid.UUID
	if err := tx.QueryRowContext(ctx,
		"SELECT id FROM oracle_imports ORDER BY created_at DESC LIMIT 1").Scan(&importID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	type oracleEntry struct {
		ID           uuid.UUID
		PRNumber     string
		PONumber     *string
		PODate       *string
		TotalValue   *float64
		DeliveryDate *string
		POList       []byte
		MultiPO      bool
		NeedsReview  bool
		Duplicate    int
	}

	rows, err := tx.QueryContext(ctx, `
		SELECT id, pr_number, po_number, po_date::text, total_value, delivery_date::text,
		       po_list, multi_po, needs_review, duplicate_lines
		FROM oracle_purchase_orders
		WHERE import_id = $1
		ORDER BY pr_number ASC`, importID)
	if err != nil {
		return nil, err
	}

	entries := make([]oracleEntry, 0)
	for rows.Next() {
		var entry oracleEntry
		if err := rows.Scan(&entry.ID, &entry.PRNumber, &entry.PONumber, &entry.PODate, &entry.TotalValue,
			&entry.DeliveryDate, &entry.POList, &entry.MultiPO, &entry.NeedsReview, &entry.Duplicate); err != nil {
			rows.Close()
			return nil, err
		}
		entries = append(entries, entry)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	result.Details = make([]models.OracleSyncDetail, 0, len(entries))

	for _, entry := range entries {
		detail := models.OracleSyncDetail{
			PRNumber: entry.PRNumber,
			PONumber: entry.PONumber,
			MultiPO:  entry.MultiPO,
		}
		if entry.TotalValue != nil {
			detail.TotalValue = entry.TotalValue
		}
		if entry.DeliveryDate != nil {
			if parsed, err := time.Parse("2006-01-02", *entry.DeliveryDate); err == nil {
				detail.DeliveryDate = &parsed
			}
		}

		var (
			prID          uuid.UUID
			reference     string
			status        string
			manualOverride bool
			oldPONumber   *string
			oldPODate     *string
			oldPOValue    *float64
			oldDelivery   *string
		)

		err := tx.QueryRowContext(ctx, `
			SELECT id, reference_number, status, po_manual_override,
			       po_number, po_date::text, po_value, delivery_estimate_date::text
			FROM purchase_requests
			WHERE UPPER(BTRIM(reference_number)) = UPPER(BTRIM($1)) AND deleted_at IS NULL
			FOR UPDATE`, entry.PRNumber).Scan(
			&prID, &reference, &status, &manualOverride, &oldPONumber, &oldPODate, &oldPOValue, &oldDelivery,
		)
		if errors.Is(err, sql.ErrNoRows) {
			result.NotFound++
			detail.Status = models.OracleStatusNotFound
			detail.Message = "No PR tidak ditemukan pada Purchase Management"
			result.Details = append(result.Details, detail)
			if _, err := tx.ExecContext(ctx,
				"UPDATE oracle_purchase_orders SET sync_status = $2 WHERE id = $1",
				entry.ID, models.OracleStatusNotFound); err != nil {
				return nil, err
			}
			continue
		}
		if err != nil {
			return nil, err
		}

		result.Matched++
		detail.Matched = true
		detail.PRReference = &reference

		if entry.Duplicate > 0 {
			result.Duplicates++
		}
		if entry.MultiPO {
			result.MultiPO++
		}
		if entry.NeedsReview {
			result.NeedsReview++
		}

		if manualOverride {
			result.SkippedManual++
			detail.Status = models.OracleStatusSudahPO
			detail.Message = "Dilewati: data PO diubah manual oleh admin"
			result.Details = append(result.Details, detail)
			if _, err := tx.ExecContext(ctx,
				"UPDATE oracle_purchase_orders SET sync_status = $2 WHERE id = $1",
				entry.ID, models.OracleStatusSudahPO); err != nil {
				return nil, err
			}
			continue
		}

		if models.IsTerminalStatus(status) {
			result.SkippedTerminal++
			detail.Status = models.OracleStatusSudahPO
			detail.Message = "Dilewati: PR sudah berstatus akhir"
			result.Details = append(result.Details, detail)
			if _, err := tx.ExecContext(ctx,
				"UPDATE oracle_purchase_orders SET sync_status = $2 WHERE id = $1",
				entry.ID, models.OracleStatusSudahPO); err != nil {
				return nil, err
			}
			continue
		}

		newStatus := models.PRStatusPOApprove
		if entry.PONumber == nil || strings.TrimSpace(*entry.PONumber) == "" {
			newStatus = models.PRStatusPendingPO
		}

		if _, err := tx.ExecContext(ctx, `
			UPDATE purchase_requests
			SET po_number = $2,
			    po_date = $3::date,
			    po_value = $4,
			    delivery_estimate_date = $5::date,
			    po_list = $6,
			    po_source = 'oracle',
			    oracle_synced_at = NOW(),
			    oracle_last_sync_at = NOW(),
			    oracle_sync_status = $7,
			    status = $8,
			    updated_at = NOW()
			WHERE id = $1`,
			prID, entry.PONumber, entry.PODate, entry.TotalValue, entry.DeliveryDate,
			nullableJSON(entry.POList), syncStatusFor(entry.NeedsReview, entry.PONumber), newStatus,
		); err != nil {
			return nil, err
		}

		result.Updated++
		detail.Updated = true
		detail.Status = syncStatusFor(entry.NeedsReview, entry.PONumber)

		if newStatus != status {
			result.StatusChanged++
			if _, err := tx.ExecContext(ctx, `
				INSERT INTO purchase_request_status_history (id, purchase_request_id, status, notes, changed_by)
				VALUES ($1, $2, $3, $4, $5)`,
				uuid.New(), prID, newStatus, "Sinkronisasi otomatis dari data Oracle", actor.ID,
			); err != nil {
				return nil, err
			}
		}

		before := map[string]interface{}{
			"status":                 status,
			"po_number":              oldPONumber,
			"po_date":                oldPODate,
			"po_value":               oldPOValue,
			"delivery_estimate_date": oldDelivery,
		}
		after := map[string]interface{}{
			"status":                 newStatus,
			"po_number":              entry.PONumber,
			"po_date":                entry.PODate,
			"po_value":               entry.TotalValue,
			"delivery_estimate_date": entry.DeliveryDate,
		}
		if err := insertAudit(ctx, tx, prID, "oracle_synced", actor, "Data purchasing disinkronkan dari Oracle", before, after); err != nil {
			return nil, err
		}

		result.Details = append(result.Details, detail)

		if _, err := tx.ExecContext(ctx,
			"UPDATE oracle_purchase_orders SET sync_status = $2 WHERE id = $1",
			entry.ID, detail.Status); err != nil {
			return nil, err
		}
	}

	result.ImportID = importID
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return result, nil
}

func syncStatusFor(needsReview bool, poNumber *string) string {
	if needsReview {
		return models.OracleStatusPerluDitinjau
	}
	if poNumber == nil || strings.TrimSpace(*poNumber) == "" {
		return models.OracleStatusBelumPO
	}
	return models.OracleStatusSyncBerhasil
}

func (r *oracleRepository) LogSync(ctx context.Context, log *models.OracleSyncLog) error {
	var payload interface{}
	if len(log.ResultData) > 0 {
		payload = []byte(log.ResultData)
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	return r.db.QueryRowContext(ctx, `
		INSERT INTO oracle_sync_logs (
			import_id, file_name, actor_id, actor_name, actor_role, trigger,
			total_rows, total_pr, matched, not_found, updated, duplicates,
			multi_line, multi_po, needs_review, skipped_manual, status_changed,
			result_data, started_at, finished_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW(), NOW())
		RETURNING id, started_at, finished_at`,
		log.ImportID, log.FileName, log.ActorID, log.ActorName, log.ActorRole, log.Trigger,
		log.TotalRows, log.TotalPR, log.Matched, log.NotFound, log.Updated, log.Duplicates,
		log.MultiLine, log.MultiPO, log.NeedsReview, log.SkippedManual, log.StatusChanged, payload,
	).Scan(&log.ID, &log.StartedAt, &log.FinishedAt)
}

func (r *oracleRepository) ListSyncLogs(ctx context.Context, limit int) ([]models.OracleSyncLog, error) {
	if limit < 1 || limit > 100 {
		limit = 20
	}
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, import_id, file_name, actor_id, actor_name, actor_role, trigger,
		       total_rows, total_pr, matched, not_found, updated, duplicates,
		       multi_line, multi_po, needs_review, skipped_manual, status_changed,
		       started_at, finished_at
		FROM oracle_sync_logs
		ORDER BY started_at DESC
		LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	results := make([]models.OracleSyncLog, 0)
	for rows.Next() {
		var log models.OracleSyncLog
		if err := rows.Scan(&log.ID, &log.ImportID, &log.FileName, &log.ActorID, &log.ActorName,
			&log.ActorRole, &log.Trigger, &log.TotalRows, &log.TotalPR, &log.Matched, &log.NotFound,
			&log.Updated, &log.Duplicates, &log.MultiLine, &log.MultiPO, &log.NeedsReview,
			&log.SkippedManual, &log.StatusChanged, &log.StartedAt, &log.FinishedAt); err != nil {
			return nil, err
		}
		results = append(results, log)
	}
	return results, rows.Err()
}

func (r *oracleRepository) SyncLog(ctx context.Context, id uuid.UUID) (*models.OracleSyncLog, error) {
	var log models.OracleSyncLog
	var payload []byte
	err := r.db.QueryRowContext(ctx, `
		SELECT id, import_id, file_name, actor_id, actor_name, actor_role, trigger,
		       total_rows, total_pr, matched, not_found, updated, duplicates,
		       multi_line, multi_po, needs_review, skipped_manual, status_changed,
		       result_data, started_at, finished_at
		FROM oracle_sync_logs WHERE id = $1`, id).Scan(
		&log.ID, &log.ImportID, &log.FileName, &log.ActorID, &log.ActorName, &log.ActorRole,
		&log.Trigger, &log.TotalRows, &log.TotalPR, &log.Matched, &log.NotFound, &log.Updated,
		&log.Duplicates, &log.MultiLine, &log.MultiPO, &log.NeedsReview, &log.SkippedManual,
		&log.StatusChanged, &payload, &log.StartedAt, &log.FinishedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if len(payload) > 0 {
		log.ResultData = json.RawMessage(payload)
	}
	return &log, nil
}

func (r *oracleRepository) Clear(ctx context.Context, actor PRActor) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	var importID uuid.UUID
	if err := tx.QueryRowContext(ctx,
		"SELECT id FROM oracle_imports ORDER BY created_at DESC LIMIT 1").Scan(&importID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil
		}
		return err
	}

	if _, err := tx.ExecContext(ctx, "DELETE FROM oracle_purchase_orders WHERE import_id = $1", importID); err != nil {
		return err
	}

	if _, err := tx.ExecContext(ctx,
		"UPDATE oracle_imports SET status = 'cleared' WHERE id = $1", importID); err != nil {
		return err
	}

	return tx.Commit()
}
