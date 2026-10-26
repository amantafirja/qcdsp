package main

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
)

type pdfDocument struct {
	Title    string
	Subtitle string
	Lines    []string
}

func buildPDF(doc pdfDocument) []byte {
	content := buildContentStream(doc)
	objects := []string{
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
		"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>",
		fmt.Sprintf("<< /Length %d >>\nstream\n%s\nendstream", len(content), content),
		"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
		"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
	}

	var buffer bytes.Buffer
	buffer.WriteString("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n")

	offsets := make([]int, len(objects)+1)
	for index, body := range objects {
		offsets[index+1] = buffer.Len()
		buffer.WriteString(fmt.Sprintf("%d 0 obj\n%s\nendobj\n", index+1, body))
	}

	xrefOffset := buffer.Len()
	buffer.WriteString(fmt.Sprintf("xref\n0 %d\n", len(objects)+1))
	buffer.WriteString("0000000000 65535 f \n")
	for index := 1; index <= len(objects); index++ {
		buffer.WriteString(fmt.Sprintf("%010d 00000 n \n", offsets[index]))
	}
	buffer.WriteString(fmt.Sprintf("trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n", len(objects)+1, xrefOffset))

	return buffer.Bytes()
}

func buildContentStream(doc pdfDocument) string {
	var stream strings.Builder

	stream.WriteString("0.06 0.15 0.28 rg\n")
	stream.WriteString("0 762 595 80 re f\n")
	stream.WriteString("BT /F2 20 Tf 1 1 1 rg 56 800 Td (")
	stream.WriteString(escapePDFText("QC Digital Service Portal"))
	stream.WriteString(") Tj ET\n")
	stream.WriteString("BT /F1 9 Tf 0.75 0.82 0.9 rg 56 778 Td (")
	stream.WriteString(escapePDFText("Knowledge Center - Dokumen Internal Laboratorium QC"))
	stream.WriteString(") Tj ET\n")

	y := 716
	for _, line := range wrapText(doc.Title, 44) {
		stream.WriteString("BT /F2 17 Tf 0.06 0.15 0.28 rg 56 ")
		stream.WriteString(fmt.Sprintf("%d Td (", y))
		stream.WriteString(escapePDFText(line))
		stream.WriteString(") Tj ET\n")
		y -= 22
	}

	if doc.Subtitle != "" {
		y -= 2
		for _, line := range wrapText(doc.Subtitle, 74) {
			stream.WriteString("BT /F1 10 Tf 0.35 0.42 0.52 rg 56 ")
			stream.WriteString(fmt.Sprintf("%d Td (", y))
			stream.WriteString(escapePDFText(line))
			stream.WriteString(") Tj ET\n")
			y -= 14
		}
	}

	y -= 6
	stream.WriteString(fmt.Sprintf("0.85 0.89 0.94 RG 0.8 w 56 %d m 539 %d l S\n", y, y))
	y -= 24

	for _, line := range doc.Lines {
		if y < 80 {
			break
		}
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			y -= 9
			continue
		}

		indent := len(line) - len(strings.TrimLeft(line, " "))
		available := 78 - indent
		if available < 20 {
			available = 20
		}
		isHeading := indent == 0 && len(trimmed) < 60 && (strings.HasSuffix(trimmed, ":") || isNumberedHeading(trimmed))

		for index, wrapped := range wrapText(line, available) {
			if y < 80 {
				break
			}
			font := "F1"
			if isHeading && index == 0 {
				font = "F2"
			}
			stream.WriteString(fmt.Sprintf("BT /%s 10 Tf 0.18 0.24 0.33 rg 56 %d Td (", font, y))
			stream.WriteString(escapePDFText(wrapped))
			stream.WriteString(") Tj ET\n")
			y -= 15
		}
		y -= 2
	}

	stream.WriteString("BT /F1 8 Tf 0.55 0.6 0.68 rg 56 56 Td (")
	stream.WriteString(escapePDFText("Dokumen contoh untuk keperluan demo. Internal use only."))
	stream.WriteString(") Tj ET\n")

	return stream.String()
}

func isNumberedHeading(value string) bool {
	parts := strings.SplitN(value, ".", 2)
	if len(parts) != 2 {
		return false
	}
	for _, r := range parts[0] {
		if r < '0' || r > '9' {
			return false
		}
	}
	return len(parts[0]) > 0 && len(parts[0]) <= 2 && len(strings.TrimSpace(parts[1])) > 0
}

func wrapText(value string, limit int) []string {
	clean := strings.TrimRight(value, " \t")
	if clean == "" {
		return []string{""}
	}

	indent := len(clean) - len(strings.TrimLeft(clean, " "))
	prefix := clean[:indent]
	words := strings.Fields(clean)
	if len(words) == 0 {
		return []string{""}
	}

	lines := make([]string, 0, 4)
	current := prefix + words[0]
	for _, word := range words[1:] {
		if len([]rune(current))+1+len([]rune(word)) > limit {
			lines = append(lines, current)
			current = prefix + word
			continue
		}
		current += " " + word
	}
	lines = append(lines, current)
	return lines
}

func escapePDFText(value string) string {
	replacer := strings.NewReplacer(
		"\\", "\\\\",
		"(", "\\(",
		")", "\\)",
		"µ", "u",
		"±", "+/-",
		"—", "-",
		"–", "-",
		"“", "\"",
		"”", "\"",
		"’", "'",
		"→", "->",
	)
	cleaned := replacer.Replace(value)
	var builder strings.Builder
	for _, r := range cleaned {
		if r >= 32 && r < 127 {
			builder.WriteRune(r)
		} else if r == '\n' {
			builder.WriteRune(' ')
		}
	}
	return builder.String()
}

func writeSamplePDF(uploadDir, title, subtitle string, lines []string) (string, int64, error) {
	relativeDir := filepath.Join("knowledge", time.Now().Format("2006/01"))
	absoluteDir := filepath.Join(uploadDir, relativeDir)
	if err := os.MkdirAll(absoluteDir, 0o755); err != nil {
		return "", 0, err
	}

	storedName := fmt.Sprintf("%s.pdf", uuid.NewString())
	absolute := filepath.Join(absoluteDir, storedName)

	data := buildPDF(pdfDocument{Title: title, Subtitle: subtitle, Lines: lines})
	if err := os.WriteFile(absolute, data, 0o644); err != nil {
		return "", 0, err
	}

	info, err := os.Stat(absolute)
	if err != nil {
		return "", 0, err
	}

	return filepath.ToSlash(filepath.Join(relativeDir, storedName)), info.Size(), nil
}

func writeApprovalPDF(uploadDir, reference, requester string) (string, string, int64, error) {
	relativeDir := filepath.Join("purchase-requests", time.Now().Format("2006/01"))
	absoluteDir := filepath.Join(uploadDir, relativeDir)
	if err := os.MkdirAll(absoluteDir, 0o755); err != nil {
		return "", "", 0, err
	}

	storedName := fmt.Sprintf("spv-approval-%s.pdf", reference)
	absolute := filepath.Join(absoluteDir, storedName)

	data := buildPDF(pdfDocument{
		Title:    "Bukti SPV Approval Pemesanan",
		Subtitle: reference,
		Lines: []string{
			"Dokumen ini merupakan bukti persetujuan Supervisi (SPV)",
			"atas pengajuan Purchase Request berikut:",
			"",
			"Nomor Referensi  : " + reference,
			"Pemesan          : " + requester,
			"Status Approval  : Disetujui",
			"",
			"Disetujui oleh   : Supervisi Laboratorium QC",
			"Tanggal          : " + time.Now().Format("02 January 2006"),
			"",
			"Catatan: Dokumen contoh yang dihasilkan otomatis oleh seeder",
			"untuk keperluan demonstrasi aplikasi.",
		},
	})
	if err := os.WriteFile(absolute, data, 0o644); err != nil {
		return "", "", 0, err
	}

	info, err := os.Stat(absolute)
	if err != nil {
		return "", "", 0, err
	}

	return filepath.ToSlash(filepath.Join(relativeDir, storedName)), storedName, info.Size(), nil
}
