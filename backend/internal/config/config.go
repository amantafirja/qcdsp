package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	AppEnv           string
	Port             string
	DatabaseURL      string
	JWTSecret        string
	JWTExpiresHours  int
	UploadDir        string
	MaxUploadMB      int
	CORSAllowedHosts []string
}

func Load() (*Config, error) {
	_ = godotenv.Load()

	cfg := &Config{
		AppEnv:          getEnv("APP_ENV", "development"),
		Port:            getEnv("PORT", "8080"),
		DatabaseURL:     getEnv("DATABASE_URL", ""),
		JWTSecret:       getEnv("JWT_SECRET", ""),
		JWTExpiresHours: getEnvInt("JWT_EXPIRES_HOURS", 24),
		UploadDir:       getEnv("UPLOAD_DIR", "./uploads"),
		MaxUploadMB:     getEnvInt("MAX_UPLOAD_MB", 10),
	}

	origins := getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
	for _, origin := range strings.Split(origins, ",") {
		origin = strings.TrimSpace(origin)
		if origin != "" {
			cfg.CORSAllowedHosts = append(cfg.CORSAllowedHosts, origin)
		}
	}

	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}
	if cfg.JWTSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET is required")
	}
	if len(cfg.JWTSecret) < 32 {
		return nil, fmt.Errorf("JWT_SECRET must be at least 32 characters")
	}
	if cfg.MaxUploadMB <= 0 {
		cfg.MaxUploadMB = 10
	}

	return cfg, nil
}

func (c *Config) MaxUploadBytes() int64 {
	return int64(c.MaxUploadMB) * 1024 * 1024
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok && strings.TrimSpace(value) != "" {
		return value
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	value := getEnv(key, "")
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}
