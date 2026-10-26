package handler

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"qcdsp/backend/internal/service"
	"qcdsp/backend/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type PurchaseRequestHandler struct {
	requests       service.PurchaseRequestService
	uploadDir      string
	maxUploadBytes int64
}

func NewPurchaseRequestHandler(requests service.PurchaseRequestService, uploadDir string, maxUploadBytes int64) *PurchaseRequestHandler {
	return &PurchaseRequestHandler{requests: requests, uploadDir: uploadDir, maxUploadBytes: maxUploadBytes}
}

func (h *PurchaseRequestHandler) Create(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, (h.maxUploadBytes*2)+(2*1024*1024))
	if err := c.Request.ParseMultipartForm(h.maxUploadBytes); err != nil {
		utils.BadRequest(c, "Formulir tidak valid atau ukuran file terlalu besar (maksimal 10 MB per file)", nil)
		return
	}

	quantity := utils.ParseIntDefault(c.PostForm("quantity"), 0)
	input := service.PRInput{
		Description:     c.PostForm("description"),
		OrderType:       c.PostForm("order_type"),
		CustomOrderType: c.PostForm("custom_order_type"),
		BrandCatalog:    c.PostForm("brand_catalog"),
		Quantity:        quantity,
		RequesterName:   c.PostForm("requester_name"),
		Reason:          c.PostForm("reason"),
	}

	validation := service.ValidationErrors{}

	spvHeader, err := c.FormFile("spv_approval")
	if err == nil && spvHeader != nil {
		uploaded, uploadErr := utils.SaveUpload(
			spvHeader, h.uploadDir, "purchase-requests",
			utils.AllowedSPVTypes(), h.maxUploadBytes,
		)
		if uploadErr != nil {
			validation["spv_approval"] = uploadErr.Error()
		} else {
			input.SPVAttachment = uploaded
		}
	}

	quotationHeader, err := c.FormFile("quotation")
	if err == nil && quotationHeader != nil {
		uploaded, uploadErr := utils.SaveUpload(
			quotationHeader, h.uploadDir, "purchase-requests",
			utils.AllowedDocumentTypes(), h.maxUploadBytes,
		)
		if uploadErr != nil {
			validation["quotation"] = uploadErr.Error()
		} else {
			input.QuotationAttachment = uploaded
		}
	}

	if len(validation) > 0 {
		if input.SPVAttachment != nil {
			_ = utils.RemoveFile(h.uploadDir, input.SPVAttachment.RelativePath)
		}
		if input.QuotationAttachment != nil {
			_ = utils.RemoveFile(h.uploadDir, input.QuotationAttachment.RelativePath)
		}
		utils.BadRequest(c, "Validasi gagal", validation)
		return
	}

	pr, err := h.requests.Create(c.Request.Context(), input)
	if err != nil {
		if input.SPVAttachment != nil {
			_ = utils.RemoveFile(h.uploadDir, input.SPVAttachment.RelativePath)
		}
		if input.QuotationAttachment != nil {
			_ = utils.RemoveFile(h.uploadDir, input.QuotationAttachment.RelativePath)
		}
		handleError(c, err)
		return
	}

	utils.Created(c, "Purchase Request berhasil dibuat", pr)
}

func (h *PurchaseRequestHandler) Track(c *gin.Context) {
	reference := c.Param("id")
	pr, err := h.requests.Track(c.Request.Context(), reference)
	if err != nil {
		handleError(c, err)
		return
	}
	utils.OK(c, "Status Purchase Request", pr)
}

func (h *PurchaseRequestHandler) AdminList(c *gin.Context) {
	query := service.PRQuery{
		Search:    c.Query("search"),
		Status:    c.Query("status"),
		OrderType: c.Query("order_type"),
		Sort:      c.Query("sort"),
		Page:      utils.ParseIntDefault(c.Query("page"), 1),
		PageSize:  utils.ParseIntDefault(c.Query("page_size"), 10),
	}

	if raw := strings.TrimSpace(c.Query("date_from")); raw != "" {
		parsed, err := time.Parse("2006-01-02", raw)
		if err != nil {
			utils.BadRequest(c, "date_from tidak valid", nil)
			return
		}
		query.DateFrom = &parsed
	}
	if raw := strings.TrimSpace(c.Query("date_to")); raw != "" {
		parsed, err := time.Parse("2006-01-02", raw)
		if err != nil {
			utils.BadRequest(c, "date_to tidak valid", nil)
			return
		}
		end := parsed.Add(24*time.Hour - time.Second)
		query.DateTo = &end
	}

	requests, pagination, err := h.requests.List(c.Request.Context(), query)
	if err != nil {
		handleError(c, err)
		return
	}
	utils.OKWithMeta(c, "Daftar Purchase Request", requests, gin.H{"pagination": pagination})
}

func (h *PurchaseRequestHandler) AdminDetail(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.BadRequest(c, "ID Purchase Request tidak valid", nil)
		return
	}
	pr, err := h.requests.Get(c.Request.Context(), id)
	if err != nil {
		handleError(c, err)
		return
	}
	utils.OK(c, "Detail Purchase Request", pr)
}

type updateStatusRequest struct {
	Status string `json:"status"`
	Notes  string `json:"notes"`
}

func (h *PurchaseRequestHandler) UpdateStatus(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.BadRequest(c, "ID Purchase Request tidak valid", nil)
		return
	}
	var request updateStatusRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		utils.BadRequest(c, "Data status tidak valid", nil)
		return
	}

	adminID, ok := c.Get("admin_id")
	if !ok {
		utils.Unauthorized(c, "Token autentikasi diperlukan")
		return
	}

	pr, err := h.requests.UpdateStatus(c.Request.Context(), id, service.PRStatusInput{
		Status: request.Status,
		Notes:  request.Notes,
	}, adminID.(uuid.UUID))
	if err != nil {
		handleError(c, err)
		return
	}
	utils.OK(c, "Status Purchase Request berhasil diperbarui", pr)
}

type updatePRRequest struct {
	InternalNotes string `json:"internal_notes"`
}

func (h *PurchaseRequestHandler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.BadRequest(c, "ID Purchase Request tidak valid", nil)
		return
	}
	var request updatePRRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		utils.BadRequest(c, "Data tidak valid", nil)
		return
	}
	pr, err := h.requests.UpdateNotes(c.Request.Context(), id, request.InternalNotes)
	if err != nil {
		handleError(c, err)
		return
	}
	utils.OK(c, "Catatan internal berhasil disimpan", pr)
}

func (h *PurchaseRequestHandler) Dashboard(c *gin.Context) {
	data, err := h.requests.Dashboard(c.Request.Context())
	if err != nil {
		handleError(c, err)
		return
	}
	utils.OK(c, "Data dashboard", data)
}

func (h *PurchaseRequestHandler) DownloadAttachment(c *gin.Context) {
	prID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.BadRequest(c, "ID Purchase Request tidak valid", nil)
		return
	}
	attachmentID, err := uuid.Parse(c.Param("attachmentId"))
	if err != nil {
		utils.BadRequest(c, "ID lampiran tidak valid", nil)
		return
	}
	h.serveAttachment(c, prID, attachmentID)
}

func (h *PurchaseRequestHandler) DownloadPublicAttachment(c *gin.Context) {
	reference := c.Param("id")
	attachmentID, err := uuid.Parse(c.Param("attachmentId"))
	if err != nil {
		utils.BadRequest(c, "ID lampiran tidak valid", nil)
		return
	}

	pr, err := h.requests.Track(c.Request.Context(), reference)
	if err != nil {
		handleError(c, err)
		return
	}
	h.serveAttachment(c, pr.ID, attachmentID)
}

func (h *PurchaseRequestHandler) serveAttachment(c *gin.Context, prID, attachmentID uuid.UUID) {
	pr, err := h.requests.Get(c.Request.Context(), prID)
	if err != nil {
		handleError(c, err)
		return
	}

	for _, attachment := range pr.Attachments {
		if attachment.ID != attachmentID {
			continue
		}

		absolute := filepath.Join(h.uploadDir, filepath.FromSlash(attachment.FilePath))
		if _, err := os.Stat(absolute); err != nil {
			utils.NotFound(c, "File lampiran tidak tersedia")
			return
		}

		c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, sanitizeHeaderFilename(attachment.OriginalName)))
		c.File(absolute)
		return
	}

	utils.NotFound(c, "Lampiran tidak ditemukan")
}

func sanitizeHeaderFilename(name string) string {
	name = strings.ReplaceAll(name, `"`, "")
	name = strings.ReplaceAll(name, "\r", "")
	name = strings.ReplaceAll(name, "\n", "")
	if name == "" {
		return "lampiran"
	}
	return name
}
