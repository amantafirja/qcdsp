package handler

import (
	"errors"
	"net/http"
	"strings"

	"qcdsp/backend/internal/service"
	"qcdsp/backend/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type KnowledgeHandler struct {
	knowledge      service.KnowledgeService
	uploadDir      string
	maxUploadBytes int64
}

func NewKnowledgeHandler(knowledge service.KnowledgeService, uploadDir string, maxUploadBytes int64) *KnowledgeHandler {
	return &KnowledgeHandler{knowledge: knowledge, uploadDir: uploadDir, maxUploadBytes: maxUploadBytes}
}

func (h *KnowledgeHandler) PublicList(c *gin.Context) {
	query := service.KnowledgeQuery{
		Search:      c.Query("search"),
		ContentType: strings.ToLower(c.Query("content_type")),
		Sort:        c.Query("sort"),
		Page:        utils.ParseIntDefault(c.Query("page"), 1),
		PageSize:    utils.ParseIntDefault(c.Query("page_size"), 9),
	}
	if slug := strings.TrimSpace(c.Query("category")); slug != "" {
		query.CategorySlug = slug
	}
	if raw := strings.TrimSpace(c.Query("category_id")); raw != "" {
		id, err := uuid.Parse(raw)
		if err != nil {
			utils.BadRequest(c, "category_id tidak valid", nil)
			return
		}
		query.CategoryID = &id
	}

	documents, pagination, err := h.knowledge.List(c.Request.Context(), query, true)
	if err != nil {
		handleError(c, err)
		return
	}
	utils.OKWithMeta(c, "Daftar dokumen", documents, gin.H{
		"pagination": pagination,
	})
}

func (h *KnowledgeHandler) PublicDetail(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.BadRequest(c, "ID dokumen tidak valid", nil)
		return
	}
	document, err := h.knowledge.Get(c.Request.Context(), id, true)
	if err != nil {
		handleError(c, err)
		return
	}
	utils.OK(c, "Detail dokumen", document)
}

func (h *KnowledgeHandler) AdminList(c *gin.Context) {
	query := service.KnowledgeQuery{
		Search:      c.Query("search"),
		ContentType: strings.ToLower(c.Query("content_type")),
		Sort:        c.Query("sort"),
		Page:        utils.ParseIntDefault(c.Query("page"), 1),
		PageSize:    utils.ParseIntDefault(c.Query("page_size"), 10),
	}
	if raw := strings.TrimSpace(c.Query("category_id")); raw != "" {
		id, err := uuid.Parse(raw)
		if err != nil {
			utils.BadRequest(c, "category_id tidak valid", nil)
			return
		}
		query.CategoryID = &id
	}

	documents, pagination, err := h.knowledge.List(c.Request.Context(), query, false)
	if err != nil {
		handleError(c, err)
		return
	}
	utils.OKWithMeta(c, "Daftar dokumen", documents, gin.H{"pagination": pagination})
}

func (h *KnowledgeHandler) AdminDetail(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.BadRequest(c, "ID dokumen tidak valid", nil)
		return
	}
	document, err := h.knowledge.Get(c.Request.Context(), id, false)
	if err != nil {
		handleError(c, err)
		return
	}
	utils.OK(c, "Detail dokumen", document)
}

func (h *KnowledgeHandler) parseForm(c *gin.Context) (service.KnowledgeInput, error) {
	var input service.KnowledgeInput

	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, h.maxUploadBytes+(2*1024*1024))
	if err := c.Request.ParseMultipartForm(h.maxUploadBytes); err != nil && !errors.Is(err, http.ErrNotMultipart) {
		return input, service.ValidationErrors{"form": "Formulir tidak valid atau ukuran file terlalu besar (maksimal 10 MB)"}
	}

	input.Title = c.PostForm("title")
	input.Description = c.PostForm("description")
	input.ContentType = c.PostForm("content_type")
	input.ArticleContent = c.PostForm("article_content")
	input.IsPublished = c.PostForm("is_published") == "true" || c.PostForm("is_published") == "1"
	input.KeepPDF = c.PostForm("keep_pdf") == "true" || c.PostForm("keep_pdf") == "1"

	if raw := strings.TrimSpace(c.PostForm("category_id")); raw != "" {
		id, err := uuid.Parse(raw)
		if err != nil {
			return input, service.ValidationErrors{"category_id": "Kategori tidak valid"}
		}
		input.CategoryID = id
	}

	fileHeader, err := c.FormFile("pdf")
	if err == nil && fileHeader != nil {
		uploaded, uploadErr := utils.SaveUpload(
			fileHeader, h.uploadDir, "knowledge",
			utils.AllowedPDFOnly(), h.maxUploadBytes,
		)
		if uploadErr != nil {
			return input, service.ValidationErrors{"pdf": uploadErr.Error()}
		}
		input.PDF = uploaded
	}

	return input, nil
}

func (h *KnowledgeHandler) Create(c *gin.Context) {
	input, err := h.parseForm(c)
	if err != nil {
		handleError(c, err)
		return
	}

	adminID, ok := c.Get("admin_id")
	if !ok {
		utils.Unauthorized(c, "Token autentikasi diperlukan")
		return
	}

	document, err := h.knowledge.Create(c.Request.Context(), input, adminID.(uuid.UUID))
	if err != nil {
		if input.PDF != nil {
			_ = utils.RemoveFile(h.uploadDir, input.PDF.RelativePath)
		}
		handleError(c, err)
		return
	}
	utils.Created(c, "Dokumen berhasil dibuat", document)
}

func (h *KnowledgeHandler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.BadRequest(c, "ID dokumen tidak valid", nil)
		return
	}

	input, err := h.parseForm(c)
	if err != nil {
		handleError(c, err)
		return
	}

	document, err := h.knowledge.Update(c.Request.Context(), id, input)
	if err != nil {
		if input.PDF != nil {
			_ = utils.RemoveFile(h.uploadDir, input.PDF.RelativePath)
		}
		handleError(c, err)
		return
	}
	utils.OK(c, "Dokumen berhasil diperbarui", document)
}

func (h *KnowledgeHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.BadRequest(c, "ID dokumen tidak valid", nil)
		return
	}
	if _, err := h.knowledge.Delete(c.Request.Context(), id); err != nil {
		handleError(c, err)
		return
	}
	utils.OK(c, "Dokumen berhasil dihapus", nil)
}

type publishRequest struct {
	IsPublished bool `json:"is_published"`
}

func (h *KnowledgeHandler) Publish(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.BadRequest(c, "ID dokumen tidak valid", nil)
		return
	}
	var request publishRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		utils.BadRequest(c, "Status publish tidak valid", nil)
		return
	}
	document, err := h.knowledge.TogglePublish(c.Request.Context(), id, request.IsPublished)
	if err != nil {
		handleError(c, err)
		return
	}
	message := "Dokumen berhasil di-unpublish"
	if request.IsPublished {
		message = "Dokumen berhasil dipublish"
	}
	utils.OK(c, message, document)
}
