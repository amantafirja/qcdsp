package models

type Pagination struct {
	Page     int `json:"page"`
	PageSize int `json:"page_size"`
	Total    int `json:"total"`
	TotalPages int `json:"total_pages"`
}

func NewPagination(page, pageSize, total int) Pagination {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 9
	}
	if pageSize > 100 {
		pageSize = 100
	}
	totalPages := 0
	if total > 0 {
		totalPages = (total + pageSize - 1) / pageSize
	}
	return Pagination{Page: page, PageSize: pageSize, Total: total, TotalPages: totalPages}
}

func (p Pagination) Offset() int {
	return (p.Page - 1) * p.PageSize
}
