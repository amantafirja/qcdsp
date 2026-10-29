package service

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"strings"
	"time"

	"qcdsp/backend/internal/models"
	"qcdsp/backend/internal/repository"

	"github.com/google/uuid"
)

type OracleUploadInput struct {
	FileName string
	FileSize int64
	Reader   io.Reader
	Actor    PRActorInput
}

type OracleService interface {
	Upload(ctx context.Context, input OracleUploadInput) (*models.OracleStatus, error)
	Status(ctx context.Context) (*models.OracleStatus, error)
	Sync(ctx context.Context, actor PRActorInput, trigger string) (*models.OracleSyncResult, error)
	SyncLogs(ctx context.Context, limit int) ([]models.OracleSyncLog, error)
	SyncLog(ctx context.Context, id uuid.UUID) (*models.OracleSyncLog, error)
	Clear(ctx context.Context, actor PRActorInput) error
}

type oracleService struct {
	oracle repository.OracleRepository
}

func NewOracleService(oracle repository.OracleRepository) OracleService {
	return &oracleService{oracle: oracle}
}

func (s *oracleService) Upload(ctx context.Context, input OracleUploadInput) (*models.OracleStatus, error) {
	parsed, err := ParseOracleWorkbook(input.Reader)
	if err != nil {
		return nil, ValidationErrors{"file": err.Error()}
	}

	rows := make([]models.OraclePurchaseOrder, 0, len(parsed.Rows))
	prNumbers := make([]string, 0, len(parsed.Rows))

	for _, row := range parsed.Rows {
		prNumbers = append(prNumbers, row.PRNumber)

		var poNumber *string
		if strings.TrimSpace(row.PONumber) != "" {
			value := strings.TrimSpace(row.PONumber)
			poNumber = &value
		}
		var itemSummary *string
		if row.ItemSummary != "" {
			value := row.ItemSummary
			itemSummary = &value
		}

		poList, _ := json.Marshal(row.POs)
		raw, _ := json.Marshal(map[string]interface{}{
			"pr_number":     row.PRNumber,
			"po_number":     row.PONumber,
			"po_date":       formatDatePtr(row.PODate),
			"total_value":   row.TotalValue,
			"delivery_date": formatDatePtr(row.DeliveryDate),
			"line_count":    row.LineCount,
			"qty_total":     row.QtyTotal,
			"multi_po":      row.MultiPO,
		})

		rows = append(rows, models.OraclePurchaseOrder{
			ID:             uuid.New(),
			PRNumber:       row.PRNumber,
			PONumber:       poNumber,
			PODate:         row.PODate,
			TotalValue:     row.TotalValue,
			DeliveryDate:   row.DeliveryDate,
			LineCount:      row.LineCount,
			QtyTotal:       row.QtyTotal,
			ItemSummary:    itemSummary,
			RawData:        raw,
			POList:         poList,
			DuplicateLines: row.DuplicateLines,
			MultiLine:      row.MultiLine,
			MultiPO:        row.MultiPO,
			NeedsReview:    row.NeedsReview,
		})
	}

	matched, err := s.oracle.CountMatchingPRs(ctx, prNumbers)
	if err != nil {
		return nil, err
	}

	actorID := input.Actor.ID
	record := &models.OracleImport{
		ID:             uuid.New(),
		FileName:       input.FileName,
		UploadedByName: input.Actor.Name,
		TotalRows:      parsed.TotalLines,
		TotalPR:        len(rows),
		MatchedCount:   matched,
		Status:         "uploaded",
		DuplicateRows:  parsed.DuplicateLines,
		MultiLinePRs:   parsed.MultiLinePRs,
		MultiPOPRs:     parsed.MultiPOPRs,
		NeedsReviewPRs: parsed.NeedsReviewPRs,
		NotFoundPRs:    len(rows) - matched,
		FileSize:       input.FileSize,
	}
	if actorID != uuid.Nil {
		record.UploadedBy = &actorID
	}

	if err := s.oracle.ReplaceDataset(ctx, record, rows); err != nil {
		return nil, err
	}

	return s.Status(ctx)
}

func (s *oracleService) Status(ctx context.Context) (*models.OracleStatus, error) {
	lastImport, err := s.oracle.LastImport(ctx)
	if err != nil {
		return nil, err
	}

	rows, err := s.oracle.ListRows(ctx)
	if err != nil {
		return nil, err
	}

	imports, err := s.oracle.ListImports(ctx, 10)
	if err != nil {
		return nil, err
	}

	logs, err := s.oracle.ListSyncLogs(ctx, 20)
	if err != nil {
		return nil, err
	}

	status := &models.OracleStatus{
		LastImport: lastImport,
		Rows:       rows,
		Imports:    imports,
		SyncLogs:   logs,
	}
	if lastImport != nil {
		status.TotalRows = lastImport.TotalRows
		status.DuplicateRows = lastImport.DuplicateRows
		status.MultiLinePRs = lastImport.MultiLinePRs
		status.MultiPOPRs = lastImport.MultiPOPRs
		status.NeedsReviewPRs = lastImport.NeedsReviewPRs
	}

	for _, row := range rows {
		status.TotalPR++
		if row.MatchedPRID != nil {
			status.MatchedCount++
		} else {
			status.UnmatchedCount++
		}
		if row.PONumber != nil && strings.TrimSpace(*row.PONumber) != "" {
			status.WithPO++
		} else {
			status.WithoutPO++
		}
		if row.TotalValue != nil {
			status.TotalValue += *row.TotalValue
		}
	}

	return status, nil
}

func (s *oracleService) Sync(ctx context.Context, actor PRActorInput, trigger string) (*models.OracleSyncResult, error) {
	lastImport, err := s.oracle.LastImport(ctx)
	if err != nil {
		return nil, err
	}
	if lastImport == nil {
		return nil, ValidationErrors{"oracle": "Belum ada file Oracle yang diunggah"}
	}

	startedAt := time.Now()
	result, err := s.oracle.SyncToPurchaseRequests(ctx, toRepoActor(actor))
	if errors.Is(err, repository.ErrNotFound) {
		return nil, ValidationErrors{"oracle": "Belum ada file Oracle yang diunggah"}
	}
	if err != nil {
		return nil, err
	}

	if err := s.oracle.UpdateImportStats(ctx, lastImport.ID, models.OracleImport{
		Status:         "synced",
		MatchedCount:   result.Matched,
		SyncedCount:    result.Updated,
		NotFoundPRs:    result.NotFound,
		UpdatedPRs:     result.Updated,
		DuplicateRows:  lastImport.DuplicateRows,
		MultiLinePRs:   lastImport.MultiLinePRs,
		MultiPOPRs:     result.MultiPO,
		NeedsReviewPRs: result.NeedsReview,
	}); err != nil {
		return nil, err
	}

	payload, _ := json.Marshal(result.Details)
	log := &models.OracleSyncLog{
		ImportID:      lastImport.ID,
		FileName:      lastImport.FileName,
		ActorName:     actor.Name,
		ActorRole:     actor.Role,
		Trigger:       trigger,
		TotalRows:     lastImport.TotalRows,
		TotalPR:       lastImport.TotalPR,
		Matched:       result.Matched,
		NotFound:      result.NotFound,
		Updated:       result.Updated,
		Duplicates:    lastImport.DuplicateRows,
		MultiLine:     lastImport.MultiLinePRs,
		MultiPO:       result.MultiPO,
		NeedsReview:   result.NeedsReview,
		SkippedManual: result.SkippedManual,
		StatusChanged: result.StatusChanged,
		ResultData:    payload,
		StartedAt:     startedAt,
	}
	if actor.ID != uuid.Nil {
		id := actor.ID
		log.ActorID = &id
	}
	if err := s.oracle.LogSync(ctx, log); err != nil {
		return nil, err
	}

	return result, nil
}

func (s *oracleService) SyncLogs(ctx context.Context, limit int) ([]models.OracleSyncLog, error) {
	return s.oracle.ListSyncLogs(ctx, limit)
}

func (s *oracleService) SyncLog(ctx context.Context, id uuid.UUID) (*models.OracleSyncLog, error) {
	log, err := s.oracle.SyncLog(ctx, id)
	if errors.Is(err, repository.ErrNotFound) {
		return nil, ErrNotFound
	}
	return log, err
}

func (s *oracleService) Clear(ctx context.Context, actor PRActorInput) error {
	return s.oracle.Clear(ctx, toRepoActor(actor))
}

func formatDatePtr(value *time.Time) interface{} {
	if value == nil {
		return nil
	}
	return value.Format("2006-01-02")
}
