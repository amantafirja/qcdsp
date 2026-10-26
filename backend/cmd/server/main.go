package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"qcdsp/backend/internal/config"
	"qcdsp/backend/internal/database"
	"qcdsp/backend/internal/handler"
	"qcdsp/backend/migrations"
	"qcdsp/backend/internal/repository"
	"qcdsp/backend/internal/router"
	"qcdsp/backend/internal/service"
	"qcdsp/backend/internal/utils"

	"github.com/gin-gonic/gin"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("konfigurasi tidak valid: %v", err)
	}

	if cfg.AppEnv == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	db, err := database.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("gagal terhubung ke database: %v", err)
	}
	defer db.Close()

	if err := database.RunMigrations(ctx, db, migrations.FS); err != nil {
		log.Fatalf("migrasi gagal: %v", err)
	}

	if err := os.MkdirAll(cfg.UploadDir, 0o755); err != nil {
		log.Fatalf("gagal membuat direktori upload: %v", err)
	}

	tokens := utils.NewTokenManager(cfg.JWTSecret, cfg.JWTExpiresHours)

	adminRepo := repository.NewAdminRepository(db)
	categoryRepo := repository.NewCategoryRepository(db)
	knowledgeRepo := repository.NewKnowledgeRepository(db)
	prRepo := repository.NewPurchaseRequestRepository(db)

	authService := service.NewAuthService(adminRepo, tokens)
	categoryService := service.NewCategoryService(categoryRepo)
	knowledgeService := service.NewKnowledgeService(knowledgeRepo, categoryRepo, cfg.UploadDir)
	prService := service.NewPurchaseRequestService(prRepo, knowledgeRepo, cfg.UploadDir)

	handlers := router.Handlers{
		Auth:            handler.NewAuthHandler(authService),
		Category:        handler.NewCategoryHandler(categoryService),
		Knowledge:       handler.NewKnowledgeHandler(knowledgeService, cfg.UploadDir, cfg.MaxUploadBytes()),
		PurchaseRequest: handler.NewPurchaseRequestHandler(prService, cfg.UploadDir, cfg.MaxUploadBytes()),
		File:            handler.NewFileHandler(knowledgeService, cfg.UploadDir, cfg.MaxUploadBytes()),
	}

	engine := router.New(handlers, tokens, cfg.CORSAllowedHosts, cfg.MaxUploadBytes())

	server := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           engine,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       60 * time.Second,
		WriteTimeout:      120 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	go func() {
		log.Printf("QC Digital Service Portal API berjalan di http://localhost:%s (env=%s)", cfg.Port, cfg.AppEnv)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("mematikan server...")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer shutdownCancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("shutdown error: %v", err)
	}
	log.Println("server berhenti")
}
