package models

import (
	"fmt"
	"strings"
)

var OrderTypes = []string{
	"Reagen",
	"Tools",
	"Expense Item",
	"Reagen Mikro",
	"Tools Mikro",
	"RS/Reference Standard",
	"Gas",
	"Analisa External",
	"Lain-Lain",
}

var PRStatuses = []string{
	"Submitted",
	"Review",
	"Approved",
	"Rejected",
	"Ordered",
	"Received",
	"Closed",
}

func IsValidOrderType(value string) bool {
	for _, item := range OrderTypes {
		if item == value {
			return true
		}
	}
	return false
}

func IsValidStatus(value string) bool {
	for _, item := range PRStatuses {
		if item == value {
			return true
		}
	}
	return false
}

func IsValidContentType(value string) bool {
	return value == "pdf" || value == "article"
}

func Slugify(value string) string {
	lower := strings.ToLower(strings.TrimSpace(value))
	var builder strings.Builder
	lastDash := false
	for _, r := range lower {
		switch {
		case (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9'):
			builder.WriteRune(r)
			lastDash = false
		case r == ' ' || r == '-' || r == '_' || r == '/' || r == '.':
			if builder.Len() > 0 && !lastDash {
				builder.WriteRune('-')
				lastDash = true
			}
		}
	}
	result := strings.Trim(builder.String(), "-")
	if result == "" {
		result = fmt.Sprintf("item-%d", len(value))
	}
	return result
}
