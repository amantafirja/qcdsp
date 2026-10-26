package handler

import (
	"errors"

	"qcdsp/backend/internal/service"
	"qcdsp/backend/internal/utils"

	"github.com/gin-gonic/gin"
)

func handleError(c *gin.Context, err error) {
	var validation service.ValidationErrors
	if errors.As(err, &validation) {
		utils.BadRequest(c, "Validasi gagal", validation)
		return
	}
	if errors.Is(err, service.ErrNotFound) {
		utils.NotFound(c, "Data tidak ditemukan")
		return
	}
	utils.ServerError(c, err)
}
