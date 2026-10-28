package models

import (
	"fmt"
	"strings"
)

const (
	RoleSuperAdmin = "super_admin"
	RoleAdmin      = "admin"
	RolePRViewer   = "pr_viewer"
)

var AdminRoles = []string{RoleSuperAdmin, RoleAdmin, RolePRViewer}

func IsValidAdminRole(value string) bool {
	for _, item := range AdminRoles {
		if item == value {
			return true
		}
	}
	return false
}

func CanManageContent(role string) bool {
	return role == RoleSuperAdmin || role == RoleAdmin
}

const (
	PRStatusFormCreated = "form_created"
	PRStatusOPPenawaran = "op_penawaran"
	PRStatusOPProposal  = "op_proposal"
	PRStatusOPManager   = "op_manager"
	PRStatusPendingPO   = "pending_po"
	PRStatusPOApprove   = "po_approve"
	PRStatusDone        = "done"
	PRStatusRejected    = "rejected"
	PRStatusCancelled   = "cancelled"
)

// PRStatuses adalah urutan progress Purchase Request.
var PRStatuses = []string{
	PRStatusFormCreated,
	PRStatusOPPenawaran,
	PRStatusOPProposal,
	PRStatusOPManager,
	PRStatusPendingPO,
	PRStatusPOApprove,
	PRStatusDone,
	PRStatusRejected,
	PRStatusCancelled,
}

var PRStatusLabels = map[string]string{
	PRStatusFormCreated: "Form Dibuat",
	PRStatusOPPenawaran: "OP Penawaran Purchasing",
	PRStatusOPProposal:  "OP Proposal",
	PRStatusOPManager:   "OP Manager",
	PRStatusPendingPO:   "Pending PO",
	PRStatusPOApprove:   "PO Approve",
	PRStatusDone:        "Selesai (Done)",
	PRStatusRejected:    "Selesai (Reject)",
	PRStatusCancelled:   "Selesai (Cancel)",
}

// PRStatusFlow adalah status non-final sesuai urutan progress.
var PRStatusFlow = []string{
	PRStatusFormCreated,
	PRStatusOPPenawaran,
	PRStatusOPProposal,
	PRStatusOPManager,
	PRStatusPendingPO,
	PRStatusPOApprove,
}

var PRTerminalStatuses = []string{PRStatusDone, PRStatusRejected, PRStatusCancelled}

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

func IsTerminalStatus(value string) bool {
	for _, item := range PRTerminalStatuses {
		if item == value {
			return true
		}
	}
	return false
}

func StatusLabel(value string) string {
	if label, ok := PRStatusLabels[value]; ok {
		return label
	}
	return value
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
