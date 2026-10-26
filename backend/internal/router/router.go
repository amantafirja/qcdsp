package router

import (
	"net/http"
	"time"

	"qcdsp/backend/internal/handler"
	"qcdsp/backend/internal/middleware"
	"qcdsp/backend/internal/utils"

	"github.com/gin-gonic/gin"
)

type Handlers struct {
	Auth            *handler.AuthHandler
	Category        *handler.CategoryHandler
	Knowledge       *handler.KnowledgeHandler
	PurchaseRequest *handler.PurchaseRequestHandler
	File            *handler.FileHandler
}

func New(handlers Handlers, tokens *utils.TokenManager, allowedOrigins []string, maxUploadBytes int64) *gin.Engine {
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
		public.GET("/purchase-requests/status/:id", handlers.PurchaseRequest.Track)
		public.GET("/purchase-requests/status/:id/attachments/:attachmentId", handlers.PurchaseRequest.DownloadPublicAttachment)

		public.GET("/files/*path", handlers.File.ServePublicFile)
	}

	admin := api.Group("/admin")
	{
		admin.POST("/login", handlers.Auth.Login)

		protected := admin.Group("")
		protected.Use(middleware.Auth(tokens))
		{
			protected.GET("/me", handlers.Auth.Profile)
			protected.GET("/dashboard", handlers.PurchaseRequest.Dashboard)

			protected.GET("/categories", handlers.Category.AdminList)
			protected.POST("/categories", handlers.Category.Create)
			protected.PUT("/categories/:id", handlers.Category.Update)
			protected.DELETE("/categories/:id", handlers.Category.Delete)

			protected.GET("/knowledge", handlers.Knowledge.AdminList)
			protected.GET("/knowledge/:id", handlers.Knowledge.AdminDetail)
			protected.POST("/knowledge", handlers.Knowledge.Create)
			protected.PUT("/knowledge/:id", handlers.Knowledge.Update)
			protected.DELETE("/knowledge/:id", handlers.Knowledge.Delete)
			protected.PUT("/knowledge/:id/publish", handlers.Knowledge.Publish)

			protected.POST("/uploads/image", handlers.File.UploadImage)

			protected.GET("/purchase-requests", handlers.PurchaseRequest.AdminList)
			protected.GET("/purchase-requests/:id", handlers.PurchaseRequest.AdminDetail)
			protected.PUT("/purchase-requests/:id/status", handlers.PurchaseRequest.UpdateStatus)
			protected.PUT("/purchase-requests/:id", handlers.PurchaseRequest.Update)
			protected.GET("/purchase-requests/:id/attachments/:attachmentId", handlers.PurchaseRequest.DownloadAttachment)
		}
	}

	engine.NoRoute(func(c *gin.Context) {
		utils.NotFound(c, "Endpoint tidak ditemukan")
	})

	return engine
}
