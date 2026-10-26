package handler

import (
	"qcdsp/backend/internal/service"
	"qcdsp/backend/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type CategoryHandler struct {
	categories service.CategoryService
}

func NewCategoryHandler(categories service.CategoryService) *CategoryHandler {
	return &CategoryHandler{categories: categories}
}

func (h *CategoryHandler) PublicList(c *gin.Context) {
	categories, err := h.categories.List(c.Request.Context(), true)
	if err != nil {
		handleError(c, err)
		return
	}
	utils.OK(c, "Daftar kategori", categories)
}

func (h *CategoryHandler) AdminList(c *gin.Context) {
	categories, err := h.categories.List(c.Request.Context(), false)
	if err != nil {
		handleError(c, err)
		return
	}
	utils.OK(c, "Daftar kategori", categories)
}

func (h *CategoryHandler) Create(c *gin.Context) {
	var input service.CategoryInput
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.BadRequest(c, "Data kategori tidak valid", nil)
		return
	}
	category, err := h.categories.Create(c.Request.Context(), input)
	if err != nil {
		handleError(c, err)
		return
	}
	utils.Created(c, "Kategori berhasil dibuat", category)
}

func (h *CategoryHandler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.BadRequest(c, "ID kategori tidak valid", nil)
		return
	}
	var input service.CategoryInput
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.BadRequest(c, "Data kategori tidak valid", nil)
		return
	}
	category, err := h.categories.Update(c.Request.Context(), id, input)
	if err != nil {
		handleError(c, err)
		return
	}
	utils.OK(c, "Kategori berhasil diperbarui", category)
}

func (h *CategoryHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.BadRequest(c, "ID kategori tidak valid", nil)
		return
	}
	if err := h.categories.Delete(c.Request.Context(), id); err != nil {
		handleError(c, err)
		return
	}
	utils.OK(c, "Kategori berhasil dihapus", nil)
}
