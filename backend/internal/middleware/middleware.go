package middleware

import (
	"context"
	"strings"

	"qcdsp/backend/internal/models"
	"qcdsp/backend/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type AdminLookup interface {
	FindByID(ctx context.Context, id uuid.UUID) (*models.AdminUser, error)
}

func Auth(tokens *utils.TokenManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" {
			utils.Unauthorized(c, "Token autentikasi diperlukan")
			return
		}

		parts := strings.SplitN(header, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") || strings.TrimSpace(parts[1]) == "" {
			utils.Unauthorized(c, "Format token tidak valid")
			return
		}

		claims, err := tokens.Parse(strings.TrimSpace(parts[1]))
		if err != nil {
			utils.Unauthorized(c, "Token tidak valid atau sudah kedaluwarsa")
			return
		}

		c.Set("admin_id", claims.AdminID)
		c.Set("admin_username", claims.Username)
		c.Set("admin_name", claims.Name)
		c.Set("admin_role", claims.Role)
		c.Next()
	}
}

func LoadAdmin(admins AdminLookup) gin.HandlerFunc {
	return func(c *gin.Context) {
		value, exists := c.Get("admin_id")
		if !exists {
			utils.Unauthorized(c, "Token autentikasi diperlukan")
			return
		}
		adminID, ok := value.(uuid.UUID)
		if !ok {
			utils.Unauthorized(c, "Token tidak valid")
			return
		}

		admin, err := admins.FindByID(c.Request.Context(), adminID)
		if err != nil {
			utils.Unauthorized(c, "Akun admin tidak ditemukan")
			return
		}
		if !admin.IsActive {
			utils.Forbidden(c, "Akun admin tidak aktif")
			return
		}

		c.Set("admin_role", admin.Role)
		c.Set("admin_username", admin.Username)
		c.Set("admin_name", admin.Name)
		c.Next()
	}
}

func RequireRoles(roles ...string) gin.HandlerFunc {
	allowed := make(map[string]bool, len(roles))
	for _, role := range roles {
		allowed[role] = true
	}

	return func(c *gin.Context) {
		value, exists := c.Get("admin_role")
		role, _ := value.(string)
		if !exists || !allowed[role] {
			utils.Forbidden(c, "Anda tidak memiliki hak akses untuk aksi ini")
			return
		}
		c.Next()
	}
}

func CORS(allowedOrigins []string) gin.HandlerFunc {	allowed := make(map[string]bool, len(allowedOrigins))
	for _, origin := range allowedOrigins {
		allowed[origin] = true
	}

	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin != "" && allowed[origin] {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Access-Control-Allow-Credentials", "true")
			c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept, Origin, X-Requested-With")
			c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
			c.Header("Access-Control-Max-Age", "86400")
			c.Header("Vary", "Origin")
		}

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	}
}

func SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "SAMEORIGIN")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Next()
	}
}
