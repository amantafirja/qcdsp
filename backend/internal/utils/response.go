package utils

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

type APIResponse struct {
	Success bool        `json:"success"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
	Errors  interface{} `json:"errors,omitempty"`
	Meta    interface{} `json:"meta,omitempty"`
}

func OK(c *gin.Context, message string, data interface{}) {
	c.JSON(http.StatusOK, APIResponse{Success: true, Message: message, Data: data})
}

func OKWithMeta(c *gin.Context, message string, data, meta interface{}) {
	c.JSON(http.StatusOK, APIResponse{Success: true, Message: message, Data: data, Meta: meta})
}

func Created(c *gin.Context, message string, data interface{}) {
	c.JSON(http.StatusCreated, APIResponse{Success: true, Message: message, Data: data})
}

func Fail(c *gin.Context, status int, message string, errs interface{}) {
	c.AbortWithStatusJSON(status, APIResponse{Success: false, Message: message, Errors: errs})
}

func BadRequest(c *gin.Context, message string, errs interface{}) {
	Fail(c, http.StatusBadRequest, message, errs)
}

func Unauthorized(c *gin.Context, message string) {
	Fail(c, http.StatusUnauthorized, message, nil)
}

func Forbidden(c *gin.Context, message string) {
	Fail(c, http.StatusForbidden, message, nil)
}

func NotFound(c *gin.Context, message string) {
	Fail(c, http.StatusNotFound, message, nil)
}

func ServerError(c *gin.Context, err error) {
	Fail(c, http.StatusInternalServerError, "Terjadi kesalahan pada server", nil)
	_ = err
}

func HashPassword(password string) (string, error) {
	if len(password) < 8 {
		return "", errors.New("password minimal 8 karakter")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

func CheckPassword(hash, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

func RandomToken(bytes int) (string, error) {
	buffer := make([]byte, bytes)
	if _, err := rand.Read(buffer); err != nil {
		return "", err
	}
	return hex.EncodeToString(buffer), nil
}

func ParseIntDefault(value string, fallback int) int {
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func SanitizeFilename(name string) string {
	name = strings.ReplaceAll(name, "\\", "/")
	parts := strings.Split(name, "/")
	base := parts[len(parts)-1]
	base = strings.ReplaceAll(base, "\x00", "")
	if base == "" {
		return "file"
	}
	return base
}
