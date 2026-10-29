package handler

import (
	"encoding/json"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"

	"qcdsp/backend/internal/service"
	"qcdsp/backend/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const maxOracleUploadBytes = 25 * 1024 * 1024

type OracleHandler struct {
	oracle service.OracleService
}

func NewOracleHandler(oracle service.OracleService) *OracleHandler {
	return &OracleHandler{oracle: oracle}
}

func (h *OracleHandler) Upload(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxOracleUploadBytes)

	header, err := c.FormFile("file")
	if err != nil || header == nil {
		utils.BadRequest(c, "File Oracle wajib diunggah", gin.H{"file": "File Oracle wajib diunggah"})
		return
	}
	if header.Size > maxOracleUploadBytes {
		utils.BadRequest(c, "Ukuran file maksimal 25 MB", gin.H{"file": "Ukuran file maksimal 25 MB"})
		return
	}

	name := utils.SanitizeFilename(header.Filename)
	switch strings.ToLower(filepath.Ext(name)) {
	case ".xlsx", ".xlsm", ".xls":
	default:
		utils.BadRequest(c, "Format file harus Excel (.xls/.xlsx)", gin.H{"file": "Format file harus Excel (.xls/.xlsx)"})
		return
	}

	file, err := header.Open()
	if err != nil {
		utils.BadRequest(c, "Gagal membaca file yang diunggah", nil)
		return
	}
	defer file.Close()

	status, err := h.oracle.Upload(c.Request.Context(), service.OracleUploadInput{
		FileName: name,
		FileSize: header.Size,
		Reader:   file,
		Actor:    currentActor(c),
	})
	if err != nil {
		handleError(c, err)
		return
	}

	utils.Created(c, "File Oracle berhasil diunggah", status)
}

// UploadAndSync melakukan upload lalu langsung menjalankan sinkronisasi.
func (h *OracleHandler) UploadAndSync(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxOracleUploadBytes)

	header, err := c.FormFile("file")
	if err != nil || header == nil {
		utils.BadRequest(c, "File Oracle wajib diunggah", gin.H{"file": "File Oracle wajib diunggah"})
		return
	}
	if header.Size > maxOracleUploadBytes {
		utils.BadRequest(c, "Ukuran file maksimal 25 MB", gin.H{"file": "Ukuran file maksimal 25 MB"})
		return
	}

	name := utils.SanitizeFilename(header.Filename)
	switch strings.ToLower(filepath.Ext(name)) {
	case ".xlsx", ".xlsm", ".xls":
	default:
		utils.BadRequest(c, "Format file harus Excel (.xls/.xlsx)", gin.H{"file": "Format file harus Excel (.xls/.xlsx)"})
		return
	}

	file, err := header.Open()
	if err != nil {
		utils.BadRequest(c, "Gagal membaca file yang diunggah", nil)
		return
	}
	defer file.Close()

	actor := currentActor(c)
	if _, err := h.oracle.Upload(c.Request.Context(), service.OracleUploadInput{
		FileName: name,
		FileSize: header.Size,
		Reader:   file,
		Actor:    actor,
	}); err != nil {
		handleError(c, err)
		return
	}

	result, err := h.oracle.Sync(c.Request.Context(), actor, "upload")
	if err != nil {
		handleError(c, err)
		return
	}

	utils.Created(c, "Upload dan sinkronisasi Oracle selesai", result)
}

func (h *OracleHandler) Status(c *gin.Context) {
	status, err := h.oracle.Status(c.Request.Context())
	if err != nil {
		handleError(c, err)
		return
	}
	utils.OK(c, "Status data Oracle", status)
}

func (h *OracleHandler) Sync(c *gin.Context) {
	trigger := strings.TrimSpace(c.Query("trigger"))
	if trigger == "" {
		trigger = "manual"
	}
	result, err := h.oracle.Sync(c.Request.Context(), currentActor(c), trigger)
	if err != nil {
		handleError(c, err)
		return
	}
	utils.OK(c, "Sinkronisasi Oracle selesai", result)
}

func (h *OracleHandler) SyncLogs(c *gin.Context) {
	logs, err := h.oracle.SyncLogs(c.Request.Context(), 20)
	if err != nil {
		handleError(c, err)
		return
	}
	utils.OK(c, "Riwayat sinkronisasi Oracle", logs)
}

func (h *OracleHandler) SyncLog(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.BadRequest(c, "ID log tidak valid", nil)
		return
	}
	log, err := h.oracle.SyncLog(c.Request.Context(), id)
	if err != nil {
		handleError(c, err)
		return
	}
	utils.OK(c, "Detail log sinkronisasi", log)
}

// DownloadResult mengirim hasil sinkronisasi dalam bentuk CSV.
func (h *OracleHandler) DownloadResult(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.BadRequest(c, "ID log tidak valid", nil)
		return
	}
	log, err := h.oracle.SyncLog(c.Request.Context(), id)
	if err != nil {
		handleError(c, err)
		return
	}

	var details []struct {
		PRNumber     string   `json:"pr_number"`
		PRReference  *string  `json:"pr_reference"`
		PONumber     *string  `json:"po_number"`
		TotalValue   *float64 `json:"total_value"`
		DeliveryDate *string  `json:"delivery_date"`
		Matched      bool     `json:"matched"`
		Updated      bool     `json:"updated"`
		MultiPO      bool     `json:"multi_po"`
		Status       string   `json:"status"`
		Message      string   `json:"message"`
	}
	if len(log.ResultData) > 0 {
		_ = json.Unmarshal(log.ResultData, &details)
	}

	var builder strings.Builder
	builder.WriteString("PR No,PR Web,No PO,Harga,Tanggal Estimasi Datang,Ditemukan,Diperbarui,Multi PO,Status,Keterangan\n")
	for _, item := range details {
		prRef := ""
		if item.PRReference != nil {
			prRef = *item.PRReference
		}
		poNumber := ""
		if item.PONumber != nil {
			poNumber = *item.PONumber
		}
		value := ""
		if item.TotalValue != nil {
			value = strconv.FormatFloat(*item.TotalValue, 'f', 2, 64)
		}
		delivery := ""
		if item.DeliveryDate != nil {
			delivery = *item.DeliveryDate
			if len(delivery) >= 10 {
				delivery = delivery[:10]
			}
		}
		builder.WriteString(strings.Join([]string{
			csvEscape(item.PRNumber),
			csvEscape(prRef),
			csvEscape(poNumber),
			value,
			delivery,
			boolLabel(item.Matched),
			boolLabel(item.Updated),
			boolLabel(item.MultiPO),
			csvEscape(item.Status),
			csvEscape(item.Message),
		}, ","))
		builder.WriteString("\n")
	}

	filename := "oracle-sync-" + log.StartedAt.Format("20060102-150405") + ".csv"
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", `attachment; filename="`+filename+`"`)
	c.String(http.StatusOK, builder.String())
}

func csvEscape(value string) string {
	if strings.ContainsAny(value, ",\"\n") {
		return `"` + strings.ReplaceAll(value, `"`, `""`) + `"`
	}
	return value
}

func boolLabel(value bool) string {
	if value {
		return "Ya"
	}
	return "Tidak"
}

func (h *OracleHandler) Clear(c *gin.Context) {
	if err := h.oracle.Clear(c.Request.Context(), currentActor(c)); err != nil {
		handleError(c, err)
		return
	}
	utils.OK(c, "Data Oracle berhasil dihapus", nil)
}
