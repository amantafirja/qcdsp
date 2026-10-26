package handler

import (
	"errors"

	"qcdsp/backend/internal/service"
	"qcdsp/backend/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type AuthHandler struct {
	auth service.AuthService
}

func NewAuthHandler(auth service.AuthService) *AuthHandler {
	return &AuthHandler{auth: auth}
}

type loginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

func (h *AuthHandler) Login(c *gin.Context) {
	var request loginRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		utils.BadRequest(c, "Username dan password wajib diisi", gin.H{
			"username": "Username wajib diisi",
			"password": "Password wajib diisi",
		})
		return
	}

	admin, token, expiresAt, err := h.auth.Login(c.Request.Context(), request.Username, request.Password)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidCredentials):
			utils.Unauthorized(c, "Username atau password salah")
		case errors.Is(err, service.ErrAccountInactive):
			utils.Forbidden(c, "Akun admin tidak aktif")
		default:
			utils.ServerError(c, err)
		}
		return
	}

	utils.OK(c, "Login berhasil", gin.H{
		"token":      token,
		"expires_at": expiresAt,
		"admin":      admin,
	})
}

func (h *AuthHandler) Profile(c *gin.Context) {
	adminID, ok := c.Get("admin_id")
	if !ok {
		utils.Unauthorized(c, "Token autentikasi diperlukan")
		return
	}

	admin, err := h.auth.Profile(c.Request.Context(), adminID.(uuid.UUID))
	if err != nil {
		handleError(c, err)
		return
	}
	utils.OK(c, "Profil admin", admin)
}
