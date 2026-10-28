package router

import (
	"net/http"
	"time"

	"qcdsp/backend/internal/handler"
	"qcdsp/backend/internal/middleware"
	"qcdsp/backend/internal/models"
	"qcdsp/backend/internal/utils"

	"github.com/gin-gonic/gin"
)

type Handlers struct {
	Auth            *handler.AuthHandler
	Admin           *handler.AdminHandler
	Category        *handler.CategoryHandler
	Knowledge       *handler.KnowledgeHandler
	PurchaseRequest *handler.PurchaseRequestHandler
	File            *handler.FileHandler
}

func New(handlers Handlers, tokens *utils.TokenManager, admins middleware.AdminLookup, allowedOrigins []string, maxUploadBytes int64) *gin.Engine {
	engine := gin.New()
	engine.Use(gin.Logger(), gin.Recovery(), middleware.SecurityHeaders(), middleware.CORS(allowedOrigins))
	engine.MaxMultipartMemory = maxUploadBytes

	engine.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"status":  "ok",
			"time":    time.Now().Format(time.RFC3339),
		})
	})

	api := engine.Group("/api")

	public := api.Group("")
	{
		public.GET("/categories", handlers.Category.PublicList)

		public.GET("/knowledge", handlers.Knowledge.PublicList)
		public.GET("/knowledge/:id", handlers.Knowledge.PublicDetail)
		public.GET("/knowledge/:id/pdf", handlers.File.ServeKnowledgePDF)

		public.POST("/purchase-requests", handlers.PurchaseRequest.Create)
		public.GET("/purchase-requests/track", handlers.PurchaseRequest.TrackByQuery)
		public.GET("/purchase-requests/track/attachments/:attachmentId", handlers.PurchaseRequest.DownloadPublicAttachmentByQuery)
		public.GET("/purchase-requests/status/:id", handlers.PurchaseRequest.Track)
		public.GET("/purchase-requests/status/:id/attachments/:attachmentId", handlers.PurchaseRequest.DownloadPublicAttachment)

		public.GET("/files/*path", handlers.File.ServePublicFile)
	}

	admin := api.Group("/admin")
	{
		admin.POST("/login", handlers.Auth.Login)

		protected := admin.Group("")
		protected.Use(middleware.Auth(tokens), middleware.LoadAdmin(admins))
		{
			protected.GET("/me", handlers.Auth.Profile)

			// Semua akun admin (termasuk PR viewer) boleh membaca Purchase Request.
			protected.GET("/purchase-requests", handlers.PurchaseRequest.AdminList)
			protected.GET("/purchase-requests/:id", handlers.PurchaseRequest.AdminDetail)
			protected.GET("/purchase-requests/:id/attachments/:attachmentId", handlers.PurchaseRequest.DownloadAttachment)

			staff := protected.Group("")
			staff.Use(middleware.RequireRoles(models.RoleSuperAdmin, models.RoleAdmin))
			{
				staff.GET("/dashboard", handlers.PurchaseRequest.Dashboard)

				staff.GET("/categories", handlers.Category.AdminList)
				staff.POST("/categories", handlers.Category.Create)
				staff.PUT("/categories/:id", handlers.Category.Update)
				staff.DELETE("/categories/:id", handlers.Category.Delete)

				staff.GET("/knowledge", handlers.Knowledge.AdminList)
				staff.GET("/knowledge/:id", handlers.Knowledge.AdminDetail)
				staff.POST("/knowledge", handlers.Knowledge.Create)
				staff.PUT("/knowledge/:id", handlers.Knowledge.Update)
				staff.DELETE("/knowledge/:id", handlers.Knowledge.Delete)
				staff.PUT("/knowledge/:id/publish", handlers.Knowledge.Publish)

				staff.POST("/uploads/image", handlers.File.UploadImage)

				staff.PUT("/purchase-requests/:id/status", handlers.PurchaseRequest.UpdateStatus)
				staff.PUT("/purchase-requests/:id", handlers.PurchaseRequest.Update)
				staff.POST("/purchase-requests/:id/merge", handlers.PurchaseRequest.Merge)
				staff.POST("/purchase-requests/:id/unmerge", handlers.PurchaseRequest.Unmerge)
				staff.DELETE("/purchase-requests/:id", handlers.PurchaseRequest.Delete)
				staff.GET("/purchase-requests/:id/audit", handlers.PurchaseRequest.AuditTrail)
			}

			owner := protected.Group("")
			owner.Use(middleware.RequireRoles(models.RoleSuperAdmin))
			{
				owner.GET("/accounts", handlers.Admin.List)
				owner.POST("/accounts", handlers.Admin.Create)
				owner.PUT("/accounts/:id", handlers.Admin.Update)
				owner.DELETE("/accounts/:id", handlers.Admin.Delete)
			}
		}
	}

	engine.NoRoute(func(c *gin.Context) {
		utils.NotFound(c, "Endpoint tidak ditemukan")
	})

	return engine
}
