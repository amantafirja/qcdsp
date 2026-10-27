package handler

import (
	"qcdsp/backend/internal/service"
	"qcdsp/backend/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type AdminHandler struct {
	admins service.AdminService
}

func NewAdminHandler(admins service.AdminService) *AdminHandler {
	return &AdminHandler{admins: admins}
}

func (h *AdminHandler) List(c *gin.Context) {
	users, err := h.admins.List(c.Request.Context())
	if err != nil {
		handleError(c, err)
		return
	}
	utils.OK(c, "Daftar akun admin", users)
}

func (h *AdminHandler) Create(c *gin.Context) {
	var input service.AdminAccountInput
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.BadRequest(c, "Data akun tidak valid", nil)
		return
	}

	user, err := h.admins.Create(c.Request.Context(), input)
	if err != nil {
		handleError(c, err)
		return
	}
	utils.Created(c, "Akun admin berhasil dibuat", user)
}

func (h *AdminHandler) Update(c *gin.Context) {
	targetID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.BadRequest(c, "ID akun tidak valid", nil)
		return
	}

	var input service.AdminAccountInput
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.BadRequest(c, "Data akun tidak valid", nil)
		return
	}

	user, err := h.admins.Update(c.Request.Context(), currentAdminID(c), targetID, input)
	if err != nil {
		handleError(c, err)
		return
	}
	utils.OK(c, "Akun admin berhasil diperbarui", user)
}

func (h *AdminHandler) Delete(c *gin.Context) {
	targetID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.BadRequest(c, "ID akun tidak valid", nil)
		return
	}

	if err := h.admins.Delete(c.Request.Context(), currentAdminID(c), targetID); err != nil {
		handleError(c, err)
		return
	}
	utils.OK(c, "Akun admin berhasil dihapus", nil)
}

func currentAdminID(c *gin.Context) uuid.UUID {
	value, ok := c.Get("admin_id")
	if !ok {
		return uuid.Nil
	}
	id, _ := value.(uuid.UUID)
	return id
}
