package service

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"math"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/xuri/excelize/v2"
	"golang.org/x/net/html"
)

// OraclePO merepresentasikan satu PO pada file Oracle.
type OraclePO struct {
	PONumber     string   `json:"po_number"`
	PODate       *time.Time `json:"po_date"`
	DeliveryDate *time.Time `json:"delivery_date"`
	TotalValue   *float64 `json:"total_value"`
	LineCount    int      `json:"line_count"`
	Items        []string `json:"items"`
}

// OracleRow adalah hasil agregasi satu PR dari file export Oracle.
type OracleRow struct {
	PRNumber       string
	POs            []OraclePO
	PONumber       string
	PODate         *time.Time
	DeliveryDate   *time.Time
	TotalValue     *float64
	LineCount      int
	QtyTotal       float64
	ItemSummary    string
	DuplicateLines int
	MultiLine      bool
	MultiPO        bool
	NeedsReview    bool
}

type OracleParseResult struct {
	Rows            []OracleRow
	TotalLines      int
	DuplicateLines  int
	MultiLinePRs    int
	MultiPOPRs      int
	NeedsReviewPRs  int
	SheetName       string
	SourceFormat    string
	Columns         map[string]int
}

var oracleHeaderAliases = map[string][]string{
	"pr_number":     {"prno", "nopr", "nomorpr", "prnumber"},
	"po_number":     {"pono", "nopo", "nomorpo", "ponumber"},
	"po_date":       {"date2", "podate", "tglpo", "tanggalpo"},
	"total_value":   {"totalvaluepo", "totalvalue", "nilaitotalpo", "hargapo"},
	"delivery_date": {"deliverydate", "tanggalestimasi", "estimasidatang"},
	"line":          {"line"},
	"item":          {"item"},
	"item_desc":     {"itemdesc", "itemdescription", "deskripsiitem"},
	"qty":           {"qty", "quantity"},
	"date":          {"date"},
	"top":           {"top"},
}

// ParseOracleWorkbook membaca file Excel (.xlsx) maupun export HTML berekstensi .xls.
func ParseOracleWorkbook(reader io.Reader) (*OracleParseResult, error) {
	data, err := io.ReadAll(reader)
	if err != nil {
		return nil, fmt.Errorf("gagal membaca file: %w", err)
	}
	if len(data) == 0 {
		return nil, errors.New("file kosong")
	}

	if isHTMLWorkbook(data) {
		grid, sheetName, err := readHTMLGrid(data)
		if err != nil {
			return nil, err
		}
		result, err := parseOracleGrid(grid)
		if err != nil {
			return nil, err
		}
		result.SheetName = sheetName
		result.SourceFormat = "html"
		return result, nil
	}

	file, err := excelize.OpenReader(bytes.NewReader(data))
	if err != nil {
		return nil, errors.New("file bukan Excel (.xlsx) atau export Oracle (.xls) yang valid")
	}
	defer file.Close()

	sheets := file.GetSheetList()
	if len(sheets) == 0 {
		return nil, errors.New("file Excel tidak memiliki sheet")
	}

	var lastErr error
	for _, sheet := range sheets {
		rows, err := file.GetRows(sheet, excelize.Options{RawCellValue: true})
		if err != nil {
			lastErr = err
			continue
		}
		result, err := parseOracleGrid(rows)
		if err != nil {
			lastErr = err
			continue
		}
		result.SheetName = sheet
		result.SourceFormat = "xlsx"
		return result, nil
	}

	if lastErr != nil {
		return nil, lastErr
	}
	return nil, errors.New("kolom 'PR No.' tidak ditemukan pada file Oracle")
}

func isHTMLWorkbook(data []byte) bool {
	head := data
	if len(head) > 2048 {
		head = head[:2048]
	}
	lower := strings.ToLower(string(head))
	trimmed := strings.TrimSpace(lower)
	return strings.HasPrefix(trimmed, "<html") ||
		strings.HasPrefix(trimmed, "<!doctype html") ||
		strings.HasPrefix(trimmed, "<table") ||
		strings.Contains(lower, "<html") ||
		strings.Contains(lower, "oracle bi publisher")
}

// readHTMLGrid mengubah tabel HTML (export Oracle BI Publisher) menjadi grid teks.
func readHTMLGrid(data []byte) ([][]string, string, error) {
	doc, err := html.Parse(bytes.NewReader(data))
	if err != nil {
		return nil, "", errors.New("gagal membaca file HTML Oracle")
	}

	headerTable := findHeaderTable(doc)
	if headerTable == nil {
		return nil, "", errors.New("tabel data dengan kolom 'PR No.' tidak ditemukan pada file Oracle")
	}

	grid := buildHTMLGrid(headerTable)
	if len(grid) == 0 {
		return nil, "", errors.New("tabel data kosong pada file Oracle")
	}
	return grid, "Oracle Export", nil
}

// findHeaderTable mencari tabel yang memuat header "PR No." dan mengabaikan tabel lain.
func findHeaderTable(root *html.Node) *html.Node {
	var found *html.Node

	var walk func(*html.Node)
	walk = func(node *html.Node) {
		if found != nil {
			return
		}
		if node.Type == html.ElementNode && (node.Data == "td" || node.Data == "th") {
			if normalizeHeader(htmlText(node)) == "prno" {
				for parent := node.Parent; parent != nil; parent = parent.Parent {
					if parent.Type == html.ElementNode && parent.Data == "table" {
						found = parent
						return
					}
				}
			}
		}
		for child := node.FirstChild; child != nil; child = child.NextSibling {
			walk(child)
		}
	}
	walk(root)
	return found
}

func buildHTMLGrid(table *html.Node) [][]string {
	grid := make([][]string, 0, 256)
	pending := make(map[int]spanCell)

	var walkRows func(*html.Node)
	walkRows = func(node *html.Node) {
		for child := node.FirstChild; child != nil; child = child.NextSibling {
			if child.Type != html.ElementNode {
				continue
			}
			if child.Data == "tr" {
				row, ok := buildHTMLRow(child, pending)
				if ok {
					grid = append(grid, row)
				}
				continue
			}
			if child.Data == "thead" || child.Data == "tbody" || child.Data == "tfoot" {
				walkRows(child)
			}
		}
	}
	walkRows(table)
	return grid
}

type spanCell struct {
	text     string
	rowsLeft int
}

func buildHTMLRow(tr *html.Node, pending map[int]spanCell) ([]string, bool) {
	cells := make(map[int]string)
	col := 0
	count := 0

	fillPending := func() {
		for {
			span, ok := pending[col]
			if !ok || span.rowsLeft <= 0 {
				return
			}
			cells[col] = span.text
			span.rowsLeft--
			pending[col] = span
			col++
		}
	}

	for cell := tr.FirstChild; cell != nil; cell = cell.NextSibling {
		if cell.Type != html.ElementNode || (cell.Data != "td" && cell.Data != "th") {
			continue
		}
		fillPending()

		text := strings.TrimSpace(htmlText(cell))
		colspan := attrInt(cell, "colspan")
		rowspan := attrInt(cell, "rowspan")
		if colspan < 1 {
			colspan = 1
		}
		if rowspan < 1 {
			rowspan = 1
		}
		for i := 0; i < colspan; i++ {
			cells[col] = text
			if rowspan > 1 {
				pending[col] = spanCell{text: text, rowsLeft: rowspan - 1}
			}
			col++
			count++
		}
	}

	fillPending()

	for index, span := range pending {
		if span.rowsLeft <= 0 {
			delete(pending, index)
		}
	}

	if count == 0 && len(cells) == 0 {
		return nil, false
	}

	width := 0
	for index := range cells {
		if index+1 > width {
			width = index + 1
		}
	}
	row := make([]string, width)
	for index, value := range cells {
		row[index] = value
	}
	return row, true
}

func htmlText(node *html.Node) string {
	var builder strings.Builder
	var walk func(*html.Node)
	walk = func(n *html.Node) {
		if n.Type == html.TextNode {
			builder.WriteString(n.Data)
			return
		}
		if n.Type == html.ElementNode && n.Data == "br" {
			builder.WriteString(" ")
		}
		for child := n.FirstChild; child != nil; child = child.NextSibling {
			walk(child)
		}
	}
	walk(node)
	return builder.String()
}

func attrInt(node *html.Node, name string) int {
	for _, attr := range node.Attr {
		if attr.Key == name {
			if value, err := strconv.Atoi(strings.TrimSpace(attr.Val)); err == nil {
				return value
			}
		}
	}
	return 0
}

// parseOracleGrid melakukan deteksi header, dedupe baris, dan agregasi per PR.
func parseOracleGrid(grid [][]string) (*OracleParseResult, error) {
	headerIndex, columns := findOracleHeader(grid)
	if headerIndex < 0 {
		return nil, errors.New("kolom 'PR No.' tidak ditemukan pada file Oracle")
	}
	if _, ok := columns["po_number"]; !ok {
		return nil, errors.New("kolom 'PO No.' tidak ditemukan pada file Oracle")
	}

	type lineKey struct {
		pr, po, line, item string
		qty                float64
		value              float64
		hasValue           bool
	}

	seenLines := make(map[lineKey]bool)
	byPR := make(map[string]*prAccumulator)
	order := make([]string, 0)

	totalLines := 0
	duplicateLines := 0

	for i := headerIndex + 1; i < len(grid); i++ {
		cells := grid[i]
		prNumber := normalizePRNumber(cellAt(cells, columns["pr_number"]))
		if prNumber == "" || isSummaryRow(prNumber) || strings.EqualFold(prNumber, "PRNO") {
			continue
		}

		totalLines++

		poNumber := normalizePONumber(cellAt(cells, columns["po_number"]))
		line := strings.TrimSpace(cellAt(cells, columns["line"]))
		item := cleanOracleText(cellAt(cells, columns["item_desc"]))
		if item == "" {
			item = cleanOracleText(cellAt(cells, columns["item"]))
		}
		qty, hasQty := parseOracleNumber(cellAt(cells, columns["qty"]))
		value, hasValue := parseOracleNumber(cellAt(cells, columns["total_value"]))

		key := lineKey{pr: prNumber, po: poNumber, line: line, item: item, qty: qty, value: value, hasValue: hasValue}
		if seenLines[key] {
			duplicateLines++
			continue
		}
		seenLines[key] = true

		acc, ok := byPR[prNumber]
		if !ok {
			acc = newPRAccumulator(prNumber)
			byPR[prNumber] = acc
			order = append(order, prNumber)
		}

		acc.addLine(oracleLine{
			PONumber:     poNumber,
			PODate:       parseOracleDate(cellAt(cells, columns["po_date"])),
			DeliveryDate: parseOracleDate(cellAt(cells, columns["delivery_date"])),
			Item:         item,
			Qty:          qty,
			HasQty:       hasQty,
			Value:        value,
			HasValue:     hasValue,
		})
	}

	if len(byPR) == 0 {
		return nil, errors.New("tidak ada baris data dengan PR No. pada file Oracle")
	}

	result := &OracleParseResult{
		TotalLines:     totalLines,
		DuplicateLines: duplicateLines,
		Columns:        columns,
		Rows:           make([]OracleRow, 0, len(byPR)),
	}

	for _, prNumber := range order {
		row := byPR[prNumber].finalize()
		if row.MultiLine {
			result.MultiLinePRs++
		}
		if row.MultiPO {
			result.MultiPOPRs++
		}
		if row.NeedsReview {
			result.NeedsReviewPRs++
		}
		result.Rows = append(result.Rows, row)
	}

	sort.SliceStable(result.Rows, func(i, j int) bool {
		return result.Rows[i].PRNumber < result.Rows[j].PRNumber
	})

	return result, nil
}

type oracleLine struct {
	PONumber     string
	PODate       *time.Time
	DeliveryDate *time.Time
	Item         string
	Qty          float64
	HasQty       bool
	Value        float64
	HasValue     bool
}

type prAccumulator struct {
	prNumber string
	lines    int
	qtyTotal float64
	items    []string
	itemSeen map[string]bool
	pos      map[string]*poAccumulator
	poOrder  []string
}

type poAccumulator struct {
	number       string
	poDate       *time.Time
	deliveryDate *time.Time
	total        float64
	hasTotal     bool
	lines        int
	items        []string
	itemSeen     map[string]bool
}

func newPRAccumulator(prNumber string) *prAccumulator {
	return &prAccumulator{
		prNumber: prNumber,
		itemSeen: make(map[string]bool),
		pos:      make(map[string]*poAccumulator),
	}
}

func (a *prAccumulator) addLine(line oracleLine) {
	a.lines++
	if line.HasQty {
		a.qtyTotal += line.Qty
	}
	if line.Item != "" && !a.itemSeen[line.Item] {
		a.itemSeen[line.Item] = true
		a.items = append(a.items, line.Item)
	}

	poKey := line.PONumber
	if poKey == "" {
		poKey = "-"
	}
	acc, ok := a.pos[poKey]
	if !ok {
		acc = &poAccumulator{number: line.PONumber, itemSeen: make(map[string]bool)}
		a.pos[poKey] = acc
		a.poOrder = append(a.poOrder, poKey)
	}

	acc.lines++
	if line.HasValue {
		acc.total += line.Value
		acc.hasTotal = true
	}
	if acc.poDate == nil && line.PODate != nil {
		acc.poDate = line.PODate
	} else if line.PODate != nil && line.PODate.Before(*acc.poDate) {
		acc.poDate = line.PODate
	}
	if line.DeliveryDate != nil {
		if acc.deliveryDate == nil || line.DeliveryDate.After(*acc.deliveryDate) {
			acc.deliveryDate = line.DeliveryDate
		}
	}
	if line.Item != "" && !acc.itemSeen[line.Item] {
		acc.itemSeen[line.Item] = true
		acc.items = append(acc.items, line.Item)
	}
}

func (a *prAccumulator) finalize() OracleRow {
	row := OracleRow{
		PRNumber:  a.prNumber,
		LineCount: a.lines,
		QtyTotal:  a.qtyTotal,
	}
	row.ItemSummary = summarizeItems(a.items)
	row.MultiLine = a.lines > 1

	total := 0.0
	hasTotal := false
	poNumbers := make(map[string]bool)

	for _, key := range a.poOrder {
		acc := a.pos[key]
		po := OraclePO{
			PONumber:     acc.number,
			PODate:       acc.poDate,
			DeliveryDate: acc.deliveryDate,
			LineCount:    acc.lines,
			Items:        append([]string{}, acc.items...),
		}
		if acc.hasTotal {
			value := acc.total
			po.TotalValue = &value
			total += value
			hasTotal = true
		}
		row.POs = append(row.POs, po)

		if acc.number != "" {
			poNumbers[acc.number] = true
			if row.PONumber == "" {
				row.PONumber = acc.number
			}
		}
		if acc.poDate != nil {
			if row.PODate == nil || acc.poDate.Before(*row.PODate) {
				row.PODate = acc.poDate
			}
		}
		if acc.deliveryDate != nil {
			if row.DeliveryDate == nil || acc.deliveryDate.After(*row.DeliveryDate) {
				row.DeliveryDate = acc.deliveryDate
			}
		}
	}

	if hasTotal {
		value := total
		row.TotalValue = &value
	}

	row.MultiPO = len(poNumbers) > 1
	row.NeedsReview = row.MultiPO || a.lines > 20

	return row
}

func findOracleHeader(rows [][]string) (int, map[string]int) {
	limit := len(rows)
	if limit > 20 {
		limit = 20
	}

	for i := 0; i < limit; i++ {
		columns := make(map[string]int)
		width := len(rows[i])
		for index, cell := range rows[i] {
			key := normalizeHeader(cell)
			if key == "" {
				continue
			}
			for field, aliases := range oracleHeaderAliases {
				if _, exists := columns[field]; exists {
					continue
				}
				for _, alias := range aliases {
					if key == normalizeHeader(alias) {
						columns[field] = index
						break
					}
				}
			}
		}
		if _, ok := columns["pr_number"]; !ok {
			continue
		}

		// Kolom "Date" bisa muncul lebih dari sekali (Date PR dan Date PO).
		if _, ok := columns["po_date"]; !ok {
			poIndex, hasPO := columns["po_number"]
			candidate := -1
			for index := 0; index < width; index++ {
				if normalizeHeader(cellAt(rows[i], index)) != "date" {
					continue
				}
				if hasPO && index <= poIndex {
					continue
				}
				if candidate == -1 {
					candidate = index
				}
			}
			if candidate >= 0 {
				columns["po_date"] = candidate
			}
		}

		// Kolom "Line" kedua (setelah PO No.) bukan line PR; gunakan yang pertama.
		if lineIndex, ok := columns["line"]; ok {
			poIndex, hasPO := columns["po_number"]
			if hasPO && lineIndex > poIndex {
				for index := 0; index < poIndex; index++ {
					if normalizeHeader(cellAt(rows[i], index)) == "line" {
						columns["line"] = index
						break
					}
				}
			}
		}

		return i, columns
	}
	return -1, nil
}

func normalizeHeader(value string) string {
	lower := strings.ToLower(strings.TrimSpace(value))
	var builder strings.Builder
	for _, r := range lower {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			builder.WriteRune(r)
		}
	}
	return builder.String()
}

func cellAt(cells []string, index int) string {
	if index < 0 || index >= len(cells) {
		return ""
	}
	return cells[index]
}

// normalizePRNumber membersihkan nomor PR hasil export Oracle:
// spasi, tanda petik di awal, karakter tersembunyi, dan case.
func normalizePRNumber(value string) string {
	trimmed := strings.TrimSpace(value)
	trimmed = strings.TrimPrefix(trimmed, "'")
	trimmed = strings.TrimSpace(trimmed)

	var builder strings.Builder
	for _, r := range trimmed {
		switch {
		case r == '\u200b', r == '\u200c', r == '\u200d', r == '\u200e', r == '\u200f',
			r == '\ufeff', r == '\u00ad', r == '\u2060':
			continue
		case r == '\u00a0':
			builder.WriteRune(' ')
		default:
			builder.WriteRune(r)
		}
	}

	cleaned := strings.ToUpper(builder.String())
	cleaned = strings.Join(strings.Fields(cleaned), "")
	cleaned = strings.ReplaceAll(cleaned, "\\", "/")
	return cleaned
}

func cleanOracleText(value string) string {
	var builder strings.Builder
	for _, r := range value {
		switch {
		case r == '\u200b', r == '\u200c', r == '\u200d', r == '\u200e', r == '\u200f',
			r == '\ufeff', r == '\u00ad', r == '\u2060', r == '\u202a', r == '\u202b',
			r == '\u202c', r == '\u202d', r == '\u202e':
			continue
		case r == '\u00a0':
			builder.WriteRune(' ')
		default:
			builder.WriteRune(r)
		}
	}
	return strings.TrimSpace(strings.Join(strings.Fields(builder.String()), " "))
}

func normalizePONumber(value string) string {
	trimmed := strings.TrimSpace(value)
	trimmed = strings.TrimPrefix(trimmed, "'")
	return strings.ToUpper(strings.Join(strings.Fields(trimmed), ""))
}

func isSummaryRow(prNumber string) bool {
	upper := strings.ToUpper(prNumber)
	return strings.Contains(upper, "TOTAL") || strings.Contains(upper, "GRAND") || strings.Contains(upper, "SUBTOTAL")
}

func summarizeItems(items []string) string {
	if len(items) == 0 {
		return ""
	}
	limit := len(items)
	if limit > 3 {
		limit = 3
	}
	summary := strings.Join(items[:limit], "; ")
	if len(items) > limit {
		summary += fmt.Sprintf(" (+%d item)", len(items)-limit)
	}
	if len(summary) > 300 {
		summary = summary[:297] + "..."
	}
	return summary
}

func parseOracleDate(value string) *time.Time {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" || trimmed == "-" {
		return nil
	}
	trimmed = strings.ReplaceAll(trimmed, "\u00a0", " ")

	if serial, err := strconv.ParseFloat(trimmed, 64); err == nil {
		if serial > 20000 && serial < 80000 {
			if parsed, err := excelize.ExcelDateToTime(serial, false); err == nil {
				date := time.Date(parsed.Year(), parsed.Month(), parsed.Day(), 0, 0, 0, 0, time.UTC)
				return &date
			}
		}
	}

	if index := strings.Index(trimmed, " "); index > 0 {
		candidate := strings.TrimSpace(trimmed[:index])
		if parsed := tryParseDateLayouts(candidate); parsed != nil {
			return parsed
		}
	}

	return tryParseDateLayouts(trimmed)
}

func tryParseDateLayouts(value string) *time.Time {
	layouts := []string{
		"2006-01-02",
		"2006/01/02",
		"02/01/2006",
		"2/1/2006",
		"02-01-2006",
		"2-1-2006",
		"02.01.2006",
		"02/01/06",
		"2/1/06",
		"02-Jan-2006",
		"2-Jan-2006",
		"02 Jan 2006",
		"2 Jan 2006",
		"Jan 2, 2006",
		"January 2, 2006",
	}

	for _, layout := range layouts {
		if parsed, err := time.Parse(layout, value); err == nil {
			date := time.Date(parsed.Year(), parsed.Month(), parsed.Day(), 0, 0, 0, 0, time.UTC)
			return &date
		}
	}

	return nil
}

func parseOracleNumber(value string) (float64, bool) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" || trimmed == "-" {
		return 0, false
	}

	trimmed = strings.ReplaceAll(trimmed, "\u00a0", "")
	trimmed = strings.ReplaceAll(trimmed, " ", "")
	trimmed = strings.ReplaceAll(trimmed, "Rp", "")
	trimmed = strings.ReplaceAll(trimmed, "IDR", "")
	trimmed = strings.TrimSpace(trimmed)

	negative := false
	if strings.HasPrefix(trimmed, "(") && strings.HasSuffix(trimmed, ")") {
		negative = true
		trimmed = strings.Trim(trimmed, "()")
	}
	if strings.HasPrefix(trimmed, "-") {
		negative = true
		trimmed = strings.TrimPrefix(trimmed, "-")
	}

	lastDot := strings.LastIndex(trimmed, ".")
	lastComma := strings.LastIndex(trimmed, ",")

	switch {
	case lastDot >= 0 && lastComma >= 0:
		if lastDot > lastComma {
			trimmed = strings.ReplaceAll(trimmed, ",", "")
		} else {
			trimmed = strings.ReplaceAll(trimmed, ".", "")
			trimmed = strings.ReplaceAll(trimmed, ",", ".")
		}
	case lastComma >= 0:
		if strings.Count(trimmed, ",") > 1 {
			trimmed = strings.ReplaceAll(trimmed, ",", "")
		} else if len(trimmed)-lastComma-1 == 3 {
			trimmed = strings.ReplaceAll(trimmed, ",", "")
		} else {
			trimmed = strings.ReplaceAll(trimmed, ",", ".")
		}
	case lastDot >= 0:
		if strings.Count(trimmed, ".") > 1 {
			trimmed = strings.ReplaceAll(trimmed, ".", "")
		} else if len(trimmed)-lastDot-1 == 3 {
			trimmed = strings.ReplaceAll(trimmed, ".", "")
		}
	}

	parsed, err := strconv.ParseFloat(trimmed, 64)
	if err != nil || math.IsNaN(parsed) || math.IsInf(parsed, 0) {
		return 0, false
	}
	if negative {
		parsed = -parsed
	}
	return parsed, true
}
