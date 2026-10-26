package utils

import (
	"errors"
	"fmt"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
)

type UploadedFile struct {
	OriginalName string
	StoredName   string
	RelativePath string
	MimeType     string
	Size         int64
}

func (f *UploadedFile) URL() string {
	return "/" + strings.TrimPrefix(strings.ReplaceAll(f.RelativePath, "\\", "/"), "/")
}

var imageExtensions = map[string]string{
	".jpg":  "image/jpeg",
	".jpeg": "image/jpeg",
	".png":  "image/png",
}

var documentExtensions = map[string]string{
	".pdf":  "application/pdf",
	".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	".xls":  "application/vnd.ms-excel",
	".jpg":  "image/jpeg",
	".jpeg": "image/jpeg",
	".png":  "image/png",
}

func SaveUpload(file *multipart.FileHeader, uploadDir, subDir string, allowed map[string]string, maxBytes int64) (*UploadedFile, error) {
	if file == nil {
		return nil, errors.New("file tidak ditemukan")
	}
	if file.Size > maxBytes {
		return nil, fmt.Errorf("ukuran file melebihi batas %d MB", maxBytes/(1024*1024))
	}

	originalName := SanitizeFilename(file.Filename)
	ext := strings.ToLower(filepath.Ext(originalName))
	mimeType, ok := allowed[ext]
	if !ok {
		return nil, fmt.Errorf("tipe file %s tidak diizinkan", ext)
	}

	storedName := fmt.Sprintf("%s-%d%s", uuid.NewString(), time.Now().Unix(), ext)
	relativeDir := filepath.Join(subDir, time.Now().Format("2006/01"))
	absoluteDir := filepath.Join(uploadDir, relativeDir)
	if err := os.MkdirAll(absoluteDir, 0o755); err != nil {
		return nil, fmt.Errorf("gagal membuat direktori upload: %w", err)
	}

	src, err := file.Open()
	if err != nil {
		return nil, fmt.Errorf("gagal membuka file: %w", err)
	}
	defer src.Close()

	destination := filepath.Join(absoluteDir, storedName)
	dst, err := os.Create(destination)
	if err != nil {
		return nil, fmt.Errorf("gagal menyimpan file: %w", err)
	}

	written, copyErr := dst.ReadFrom(src)
	closeErr := dst.Close()
	if copyErr != nil {
		_ = os.Remove(destination)
		return nil, fmt.Errorf("gagal menulis file: %w", copyErr)
	}
	if closeErr != nil {
		_ = os.Remove(destination)
		return nil, fmt.Errorf("gagal menutup file: %w", closeErr)
	}
	if written > maxBytes {
		_ = os.Remove(destination)
		return nil, fmt.Errorf("ukuran file melebihi batas %d MB", maxBytes/(1024*1024))
	}

	if err := verifyFileSignature(destination, mimeType); err != nil {
		_ = os.Remove(destination)
		return nil, err
	}

	return &UploadedFile{
		OriginalName: originalName,
		StoredName:   storedName,
		RelativePath: filepath.ToSlash(filepath.Join(relativeDir, storedName)),
		MimeType:     mimeType,
		Size:         written,
	}, nil
}

func verifyFileSignature(path, mimeType string) error {
	file, err := os.Open(path)
	if err != nil {
		return fmt.Errorf("gagal memverifikasi file: %w", err)
	}
	defer file.Close()

	header := make([]byte, 8)
	read, err := file.Read(header)
	if err != nil && read == 0 {
		return errors.New("file tidak valid atau kosong")
	}
	header = header[:read]

	switch mimeType {
	case "application/pdf":
		if len(header) < 4 || string(header[:4]) != "%PDF" {
			return errors.New("isi file bukan PDF yang valid")
		}
	case "image/jpeg":
		if len(header) < 3 || header[0] != 0xFF || header[1] != 0xD8 || header[2] != 0xFF {
			return errors.New("isi file bukan JPEG yang valid")
		}
	case "image/png":
		signature := []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}
		if len(header) < 8 || string(header[:8]) != string(signature) {
			return errors.New("isi file bukan PNG yang valid")
		}
	case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
		if len(header) < 4 || header[0] != 0x50 || header[1] != 0x4B {
			return errors.New("isi file bukan XLSX yang valid")
		}
	case "application/vnd.ms-excel":
		signature := []byte{0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1}
		if len(header) < 8 || string(header[:8]) != string(signature) {
			return errors.New("isi file bukan XLS yang valid")
		}
	}
	return nil
}

func AllowedImageTypes() map[string]string {
	return imageExtensions
}

func AllowedDocumentTypes() map[string]string {
	return documentExtensions
}

func AllowedSPVTypes() map[string]string {
	return map[string]string{
		".pdf":  "application/pdf",
		".jpg":  "image/jpeg",
		".jpeg": "image/jpeg",
		".png":  "image/png",
	}
}

func AllowedPDFOnly() map[string]string {
	return map[string]string{".pdf": "application/pdf"}
}

func RemoveFile(uploadDir, relativePath string) error {
	if relativePath == "" {
		return nil
	}
	clean := filepath.Clean(strings.ReplaceAll(relativePath, "\\", "/"))
	absolute := filepath.Join(uploadDir, clean)
	base, err := filepath.Abs(uploadDir)
	if err != nil {
		return err
	}
	target, err := filepath.Abs(absolute)
	if err != nil {
		return err
	}
	if !strings.HasPrefix(target, base+string(os.PathSeparator)) {
		return errors.New("path file tidak valid")
	}
	if err := os.Remove(target); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}
