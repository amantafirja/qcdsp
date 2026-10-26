package handler

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"qcdsp/backend/internal/service"
	"qcdsp/backend/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type FileHandler struct {
	knowledge      service.KnowledgeService
	uploadDir      string
	maxUploadBytes int64
}

func NewFileHandler(knowledge service.KnowledgeService, uploadDir string, maxUploadBytes int64) *FileHandler {
	return &FileHandler{knowledge: knowledge, uploadDir: uploadDir, maxUploadBytes: maxUploadBytes}
}

func (h *FileHandler) ServeKnowledgePDF(c *gin.Context) {
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
	if document.PDFFilePath == nil {
		utils.NotFound(c, "Dokumen tidak memiliki file PDF")
		return
	}

	absolute := filepath.Join(h.uploadDir, filepath.FromSlash(*document.PDFFilePath))
	if _, err := os.Stat(absolute); err != nil {
		utils.NotFound(c, "File PDF tidak tersedia")
		return
	}

	disposition := "inline"
	if c.Query("download") == "1" || c.Query("download") == "true" {
		disposition = "attachment"
	}
	filename := "dokumen.pdf"
	if document.PDFOriginalName != nil && *document.PDFOriginalName != "" {
		filename = *document.PDFOriginalName
	}
	filename = strings.ReplaceAll(strings.ReplaceAll(filename, `"`, ""), "\n", "")

	c.Header("Content-Disposition", fmt.Sprintf(`%s; filename="%s"`, disposition, filename))
	c.Header("Content-Type", "application/pdf")
	c.Header("Cache-Control", "private, max-age=300")
	c.File(absolute)
}

func (h *FileHandler) ServePublicFile(c *gin.Context) {
	requested := strings.TrimPrefix(c.Param("path"), "/")
	clean := filepath.Clean(filepath.FromSlash(requested))

	if strings.HasPrefix(clean, "..") || filepath.IsAbs(clean) {
		utils.NotFound(c, "File tidak ditemukan")
		return
	}

	normalized := filepath.ToSlash(clean)
	if !strings.HasPrefix(normalized, "knowledge/") && !strings.HasPrefix(normalized, "knowledge-images/") {
		utils.NotFound(c, "File tidak ditemukan")
		return
	}

	absolute := filepath.Join(h.uploadDir, clean)
	info, err := os.Stat(absolute)
	if err != nil || info.IsDir() {
		utils.NotFound(c, "File tidak ditemukan")
		return
	}

	c.Header("Cache-Control", "public, max-age=3600")
	c.File(absolute)
}

func (h *FileHandler) UploadImage(c *gin.Context) {
	fileHeader, err := c.FormFile("image")
	if err != nil {
		fileHeader, err = c.FormFile("file")
	}
	if err != nil || fileHeader == nil {
		utils.BadRequest(c, "File gambar wajib diunggah", gin.H{"image": "File gambar wajib diunggah"})
		return
	}

	uploaded, uploadErr := utils.SaveUpload(
		fileHeader, h.uploadDir, "knowledge-images",
		utils.AllowedImageTypes(), h.maxUploadBytes,
	)
	if uploadErr != nil {
		utils.BadRequest(c, "Upload gagal", gin.H{"image": uploadErr.Error()})
		return
	}

	utils.Created(c, "Gambar berhasil diunggah", gin.H{
		"url":  "/api/files/" + uploaded.RelativePath,
		"name": uploaded.OriginalName,
		"size": uploaded.Size,
	})
}
