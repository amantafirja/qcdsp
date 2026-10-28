package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"qcdsp/backend/internal/config"
	"qcdsp/backend/internal/database"
	"qcdsp/backend/migrations"
	"qcdsp/backend/internal/utils"

	"github.com/google/uuid"
)

type seedCategory struct {
	Name        string
	Slug        string
	Description string
}

type seedDocument struct {
	Title          string
	CategorySlug   string
	Description    string
	ContentType    string
	ArticleContent string
	IsPublished    bool
	DaysAgo        int
	ViewCount      int
}

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("konfigurasi tidak valid: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
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

	adminID, err := seedAdmin(ctx, db, cfg)
	if err != nil {
		log.Fatalf("seed admin gagal: %v", err)
	}

	if err := seedViewer(ctx, db); err != nil {
		log.Fatalf("seed viewer gagal: %v", err)
	}

	categoryIDs, err := seedCategories(ctx, db)
	if err != nil {
		log.Fatalf("seed kategori gagal: %v", err)
	}

	if err := seedKnowledge(ctx, db, cfg.UploadDir, adminID, categoryIDs); err != nil {
		log.Fatalf("seed knowledge gagal: %v", err)
	}

	if err := seedPurchaseRequests(ctx, db, cfg.UploadDir); err != nil {
		log.Fatalf("seed purchase request gagal: %v", err)
	}

	log.Println("seeder selesai")
}

func seedAdmin(ctx context.Context, db *sql.DB, cfg *config.Config) (uuid.UUID, error) {
	var existingID uuid.UUID
	err := db.QueryRowContext(ctx, "SELECT id FROM admin_users WHERE LOWER(username) = 'admin'").Scan(&existingID)
	if err == nil {
		log.Println("admin 'admin' sudah ada, melewati pembuatan admin")
		return existingID, nil
	}
	if err != sql.ErrNoRows {
		return uuid.Nil, err
	}

	password := "Admin123!"
	hash, err := utils.HashPassword(password)
	if err != nil {
		return uuid.Nil, err
	}

	id := uuid.New()
	_, err = db.ExecContext(ctx, `
		INSERT INTO admin_users (id, username, password_hash, name, role, is_active)
		VALUES ($1, 'admin', $2, 'Administrator QC', 'super_admin', TRUE)`, id, hash)
	if err != nil {
		return uuid.Nil, err
	}

	log.Printf("admin dibuat: username=admin password=%s", password)
	return id, nil
}

func seedViewer(ctx context.Context, db *sql.DB) error {
	var existingID uuid.UUID
	err := db.QueryRowContext(ctx, "SELECT id FROM admin_users WHERE LOWER(username) = 'viewer'").Scan(&existingID)
	if err == nil {
		log.Println("admin 'viewer' sudah ada, melewati pembuatan viewer")
		return nil
	}
	if err != sql.ErrNoRows {
		return err
	}

	password := "Viewer123!"
	hash, err := utils.HashPassword(password)
	if err != nil {
		return err
	}

	_, err = db.ExecContext(ctx, `
		INSERT INTO admin_users (id, username, password_hash, name, role, is_active)
		VALUES ($1, 'viewer', $2, 'PR Viewer', 'pr_viewer', TRUE)`, uuid.New(), hash)
	if err != nil {
		return err
	}

	log.Printf("admin dibuat: username=viewer password=%s (role=pr_viewer)", password)
	return nil
}

func seedCategories(ctx context.Context, db *sql.DB) (map[string]uuid.UUID, error) {	categories := []seedCategory{
		{"FAQ", "faq", "Pertanyaan yang sering diajukan seputar operasional laboratorium dan layanan QC."},
		{"SOP", "sop", "Standard Operating Procedure untuk seluruh proses kerja laboratorium."},
		{"Work Instruction", "work-instruction", "Instruksi kerja teknis dan langkah operasional peralatan."},
		{"Manual", "manual", "Buku manual dan panduan penggunaan instrumen laboratorium."},
		{"Troubleshooting", "troubleshooting", "Panduan penanganan masalah dan error pada instrumen maupun proses."},
		{"Artikel", "artikel", "Artikel teknis, referensi, dan pengetahuan internal tim QC."},
		{"Dokumen PDF", "dokumen-pdf", "Kumpulan dokumen PDF resmi yang dapat diunduh."},
	}

	result := make(map[string]uuid.UUID, len(categories))
	for _, category := range categories {
		var id uuid.UUID
		err := db.QueryRowContext(ctx, "SELECT id FROM categories WHERE slug = $1", category.Slug).Scan(&id)
		if err == nil {
			result[category.Slug] = id
			continue
		}
		if err != sql.ErrNoRows {
			return nil, err
		}

		id = uuid.New()
		_, err = db.ExecContext(ctx, `
			INSERT INTO categories (id, name, slug, description)
			VALUES ($1, $2, $3, $4)`, id, category.Name, category.Slug, category.Description)
		if err != nil {
			return nil, err
		}
		result[category.Slug] = id
	}

	log.Printf("kategori siap: %d", len(result))
	return result, nil
}

func seedKnowledge(ctx context.Context, db *sql.DB, uploadDir string, adminID uuid.UUID, categoryIDs map[string]uuid.UUID) error {
	var existing int
	if err := db.QueryRowContext(ctx, "SELECT COUNT(*) FROM knowledge_documents").Scan(&existing); err != nil {
		return err
	}
	if existing > 0 {
		log.Println("knowledge documents sudah ada, melewati seed dokumen")
		return nil
	}

	documents := []seedDocument{
		{
			Title:        "Cara Kalibrasi Harian pH Meter",
			CategorySlug: "work-instruction",
			Description:  "Langkah kerja kalibrasi harian pH meter menggunakan larutan buffer pH 4, 7, dan 10 beserta kriteria penerimaan.",
			ContentType:  "article",
			IsPublished:  true,
			DaysAgo:      3,
			ViewCount:    128,
			ArticleContent: `<h2>Tujuan</h2>
<p>Memastikan akurasi pengukuran pH meter sebelum digunakan pada pengujian sampel rutin di laboratorium QC.</p>
<h2>Alat dan Bahan</h2>
<ul>
  <li>pH meter terkalibrasi</li>
  <li>Larutan buffer pH 4,00 / 7,00 / 10,00</li>
  <li>Aquadest dan tissue lembut</li>
  <li>Beaker glass 50 mL</li>
</ul>
<h2>Langkah Kerja</h2>
<ol>
  <li>Nyalakan pH meter dan biarkan stabil selama 30 menit.</li>
  <li>Bilas elektroda dengan aquadest, lalu keringkan dengan tissue.</li>
  <li>Celupkan elektroda ke buffer pH 7,00 dan tekan tombol CAL.</li>
  <li>Ulangi untuk buffer pH 4,00 dan pH 10,00 sesuai instruksi alat.</li>
  <li>Catat slope hasil kalibrasi pada logbook instrumen.</li>
</ol>
<h2>Kriteria Penerimaan</h2>
<table>
  <thead><tr><th>Parameter</th><th>Kriteria</th></tr></thead>
  <tbody>
    <tr><td>Slope</td><td>95% - 105%</td></tr>
    <tr><td>Offset</td><td>± 30 mV</td></tr>
  </tbody>
</table>
<blockquote>Jika slope di luar rentang, lakukan pembersihan elektroda dan ulangi kalibrasi. Bila masih gagal, ajukan perbaikan ke tim metrologi.</blockquote>`,
		},
		{
			Title:        "SOP Penerimaan Sampel dan Reagen",
			CategorySlug: "sop",
			Description:  "Prosedur penerimaan, verifikasi, dan penyimpanan sampel serta reagen yang masuk ke laboratorium QC.",
			ContentType:  "article",
			IsPublished:  true,
			DaysAgo:      8,
			ViewCount:    342,
			ArticleContent: `<h2>Ruang Lingkup</h2>
<p>SOP ini berlaku untuk seluruh penerimaan sampel, reagen, dan reference standard di laboratorium QC.</p>
<h2>Prosedur</h2>
<ol>
  <li>Petugas menerima paket dan memeriksa kondisi kemasan serta suhu penyimpanan.</li>
  <li>Verifikasi dokumen pengiriman: nama produk, nomor batch, tanggal kedaluwarsa, dan COA.</li>
  <li>Catat penerimaan pada sistem inventory dan tempel label status karantina.</li>
  <li>Lakukan pemeriksaan visual terhadap warna, bentuk, dan integritas kemasan.</li>
  <li>Simpan pada suhu yang disyaratkan dan update status menjadi released setelah verifikasi QC selesai.</li>
</ol>
<h2>Dokumen Terkait</h2>
<ul>
  <li>Form Penerimaan Barang (QC-FRM-001)</li>
  <li>Logbook Suhu Penyimpanan (QC-FRM-014)</li>
</ul>`,
		},
		{
			Title:        "Troubleshooting HPLC: Baseline Noise Tinggi",
			CategorySlug: "troubleshooting",
			Description:  "Panduan identifikasi penyebab dan tindakan koreksi ketika baseline HPLC menunjukkan noise yang tinggi.",
			ContentType:  "article",
			IsPublished:  true,
			DaysAgo:      14,
			ViewCount:    201,
			ArticleContent: `<h2>Gejala</h2>
<p>Baseline kromatogram tidak stabil dengan fluktuasi sinyal melebihi 2 mAU pada kondisi isokratik.</p>
<h2>Kemungkinan Penyebab</h2>
<ul>
  <li>Gelembung udara pada jalur pelarut atau pompa.</li>
  <li>Lampu detektor mendekati batas umur pakai.</li>
  <li>Kontaminasi pada kolom atau frit.</li>
  <li>Fase gerak yang belum terdegas dengan baik.</li>
</ul>
<h2>Tindakan Koreksi</h2>
<ol>
  <li>Lakukan purging pada pompa selama 5 menit dengan laju 3 mL/menit.</li>
  <li>Degas fase gerak menggunakan ultrasonik selama 15 menit.</li>
  <li>Flush kolom dengan fase gerak baru sebanyak 20 kolom volume.</li>
  <li>Periksa jam pemakaian lampu detektor pada menu diagnostik.</li>
  <li>Jika noise masih tinggi, eskalasi ke teknisi instrumen.</li>
</ol>`,
		},
		{
			Title:        "FAQ: Bagaimana cara mengajukan Purchase Request?",
			CategorySlug: "faq",
			Description:  "Ringkasan alur pengajuan Purchase Request, persyaratan lampiran, dan cara tracking status pengajuan.",
			ContentType:  "article",
			IsPublished:  true,
			DaysAgo:      2,
			ViewCount:    412,
			ArticleContent: `<h2>Apakah saya perlu login untuk mengajukan PR?</h2>
<p>Tidak. Seluruh user internal dapat mengajukan Purchase Request tanpa login melalui menu Administration Center &rarr; Purchase Request.</p>
<h2>Dokumen apa yang wajib dilampirkan?</h2>
<p>Bukti SPV Approve Pemesanan wajib diunggah dalam format PDF, JPG, JPEG, atau PNG dengan ukuran maksimal 10 MB. Dokumen penawaran bersifat opsional.</p>
<h2>Bagaimana cara tracking status?</h2>
<p>Setelah submit, sistem menampilkan nomor referensi dengan format <strong>PR-YYYYMMDD-XXXX</strong>. Simpan nomor tersebut dan gunakan menu Tracking PR untuk melihat status terkini.</p>
<h2>Berapa lama proses persetujuan?</h2>
<p>Target proses review adalah 2 hari kerja. Status akan berubah dari Submitted menjadi Review, kemudian Approved atau Rejected.</p>`,
		},
		{
			Title:        "Manual Penggunaan Analytical Balance",
			CategorySlug: "manual",
			Description:  "Panduan operasional analytical balance 0,1 mg termasuk prosedur leveling, kalibrasi internal, dan perawatan rutin.",
			ContentType:  "pdf",
			IsPublished:  true,
			DaysAgo:      21,
			ViewCount:    95,
		},
		{
			Title:        "SOP Pengendalian Dokumen Laboratorium",
			CategorySlug: "dokumen-pdf",
			Description:  "Dokumen resmi pengendalian dokumen QC meliputi penerbitan, revisi, distribusi, dan penarikan dokumen kedaluwarsa.",
			ContentType:  "pdf",
			IsPublished:  true,
			DaysAgo:      30,
			ViewCount:    77,
		},
		{
			Title:        "Kalibrasi dan Verifikasi Pipet Mikro",
			CategorySlug: "dokumen-pdf",
			Description:  "Prosedur kalibrasi pipet mikro volume 10-1000 µL dengan metode gravimetri dan toleransi penerimaan.",
			ContentType:  "pdf",
			IsPublished:  true,
			DaysAgo:      11,
			ViewCount:    63,
		},
		{
			Title:        "Draft: Panduan Penggunaan Software LIMS",
			CategorySlug: "artikel",
			Description:  "Draf panduan internal penggunaan modul sample login dan result entry pada LIMS. Belum dipublikasikan.",
			ContentType:  "article",
			IsPublished:  false,
			DaysAgo:      1,
			ViewCount:    0,
			ArticleContent: `<h2>Status Dokumen</h2>
<p>Dokumen ini masih dalam tahap review oleh tim QC sebelum dipublikasikan ke Knowledge Center.</p>
<h2>Rencana Isi</h2>
<ul>
  <li>Pengenalan antarmuka LIMS</li>
  <li>Alur sample login</li>
  <li>Input hasil pengujian</li>
  <li>Review dan approval hasil</li>
</ul>`,
		},
	}

	for _, document := range documents {
		categoryID, ok := categoryIDs[document.CategorySlug]
		if !ok {
			return fmt.Errorf("kategori %s tidak ditemukan", document.CategorySlug)
		}

		id := uuid.New()
		slug := uniqueSlug(ctx, db, document.Title)
		createdAt := time.Now().AddDate(0, 0, -document.DaysAgo)

		var pdfPath, pdfName *string
		var pdfSize *int64
		if document.ContentType == "pdf" {
			relativePath, size, err := writeSamplePDF(uploadDir, document.Title, document.Description, pdfSampleLines(document.Title))
			if err != nil {
				return err
			}
			pdfPath = &relativePath
			pdfSize = &size
			name := slug + ".pdf"
			pdfName = &name
		}

		var articleContent *string
		if document.ContentType == "article" {
			content := document.ArticleContent
			articleContent = &content
		}

		var publishedAt *time.Time
		if document.IsPublished {
			publishedAt = &createdAt
		}

		_, err := db.ExecContext(ctx, `
			INSERT INTO knowledge_documents (
				id, title, slug, category_id, description, content_type, pdf_file_path, pdf_original_name,
				pdf_size_bytes, article_content, is_published, view_count, created_by, published_at, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15)`,
			id, document.Title, slug, categoryID, document.Description, document.ContentType,
			pdfPath, pdfName, pdfSize, articleContent, document.IsPublished, document.ViewCount,
			adminID, publishedAt, createdAt,
		)
		if err != nil {
			return err
		}
	}

	log.Printf("knowledge documents dibuat: %d", len(documents))
	return nil
}

func uniqueSlug(ctx context.Context, db *sql.DB, title string) string {
	base := strings.ToLower(title)
	var builder strings.Builder
	lastDash := false
	for _, r := range base {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			builder.WriteRune(r)
			lastDash = false
		} else if builder.Len() > 0 && !lastDash {
			builder.WriteRune('-')
			lastDash = true
		}
	}
	slug := strings.Trim(builder.String(), "-")
	if slug == "" {
		slug = "dokumen"
	}

	candidate := slug
	for i := 2; i < 100; i++ {
		var exists bool
		_ = db.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM knowledge_documents WHERE slug = $1)", candidate).Scan(&exists)
		if !exists {
			return candidate
		}
		candidate = fmt.Sprintf("%s-%d", slug, i)
	}
	return slug + "-" + uuid.NewString()[:6]
}

func pdfSampleLines(title string) []string {
	return []string{
		"1. Tujuan",
		"   Dokumen ini menjelaskan panduan kerja untuk: " + title,
		"   Digunakan sebagai referensi internal laboratorium Quality Control.",
		"",
		"2. Ruang Lingkup",
		"   Berlaku untuk seluruh personel QC yang menjalankan aktivitas terkait.",
		"",
		"3. Tanggung Jawab",
		"   - Analis bertanggung jawab melaksanakan prosedur sesuai dokumen ini.",
		"   - Supervisor melakukan verifikasi dan persetujuan pelaksanaan.",
		"",
		"4. Prosedur",
		"   a. Persiapkan alat, bahan, dan dokumen pendukung.",
		"   b. Lakukan pemeriksaan awal kondisi alat dan bahan.",
		"   c. Jalankan langkah kerja sesuai instruksi teknis yang berlaku.",
		"   d. Catat seluruh hasil pada logbook atau formulir terkait.",
		"   e. Laporkan penyimpangan kepada supervisor untuk ditindaklanjuti.",
		"",
		"5. Kriteria Penerimaan",
		"   Seluruh langkah dijalankan lengkap dan hasil tercatat tanpa penyimpangan.",
		"",
		"6. Dokumen Terkait",
		"   - Formulir pencatatan QC",
		"   - Logbook instrumen",
		"   - Prosedur terkait lainnya",
	}
}

type seedPRItem struct {
	ItemName     string
	BrandCatalog string
	Quantity     int
	Unit         string
}

type seedPR struct {
	Description string
	OrderType   string
	CustomType  string
	Requester   string
	Reason      string
	Status      string
	Notes       string
	DaysAgo     int
	Items       []seedPRItem
}

func seedPurchaseRequests(ctx context.Context, db *sql.DB, uploadDir string) error {
	var existing int
	if err := db.QueryRowContext(ctx, "SELECT COUNT(*) FROM purchase_requests").Scan(&existing); err != nil {
		return err
	}
	if existing > 0 {
		log.Println("purchase requests sudah ada, melewati seed PR")
		return nil
	}

	requests := []seedPR{
		{"Pembelian reagen buffer pH 7,00 untuk kebutuhan pengujian harian", "Reagen", "", "Rina Wulandari", "Stok buffer pH 7,00 tersisa 1 botol dan kebutuhan pengujian meningkat.", "done", "Barang sudah diterima dan disimpan di gudang reagen.", 147,
			[]seedPRItem{{"Reagen buffer pH 7,00", "MERCK 1.098439.1000", 6, "botol"}}},
		{"Pengadaan tips pipet 1000 µL steril", "Tools Mikro", "", "Budi Santoso", "Tips pipet habis akibat penambahan beban pengujian mikrobiologi.", "po_approve", "PO disetujui, menunggu pengiriman.", 136,
			[]seedPRItem{{"Tips pipet 1000 µL steril", "AXYGEN T-1000-B", 20, "box"}}},
		{"Pembelian gas nitrogen untuk GC", "Gas", "", "Andi Pratama", "Stok gas nitrogen tersisa 1 tabung, kebutuhan analisis GC mingguan.", "pending_po", "PO dikirim ke vendor, estimasi tiba 5 hari kerja.", 123,
			[]seedPRItem{{"Gas nitrogen 99.999%", "SAMATOR N2 99.999%", 2, "tabung"}}},
		{"Pengadaan kolom HPLC C18", "Lain-Lain", "Spare Part Instrumen", "Siti Nurhaliza", "Kolom HPLC mengalami penurunan resolusi dan perlu penggantian.", "op_manager", "Disetujui, menunggu proses pengadaan.", 110,
			[]seedPRItem{{"Kolom HPLC C18", "WATERS WAT054275", 1, "unit"}}},
		{"Pembelian reference standard untuk uji kadar", "RS/Reference Standard", "", "Dewi Lestari", "Reference standard yang ada mendekati tanggal kedaluwarsa.", "op_proposal", "Sedang diverifikasi oleh tim QC.", 99,
			[]seedPRItem{{"Reference standard uji kadar", "USP 1234567", 2, "vial"}}},
		{"Pengadaan alat gelas laboratorium", "Expense Item", "", "Fajar Nugroho", "Beaker glass pecah saat proses pencucian.", "form_created", "", 85,
			[]seedPRItem{
				{"Beaker glass 500 mL", "IWAKI 5000-100", 6, "pcs"},
				{"Beaker glass 1000 mL", "IWAKI 5000-200", 6, "pcs"},
			}},
		{"Pembelian media kultur mikrobiologi", "Reagen Mikro", "", "Rina Wulandari", "Kebutuhan media untuk pengujian bioburden bulanan.", "op_manager", "Approved oleh SPV, menunggu PO.", 72,
			[]seedPRItem{{"Media kultur TSA", "MERCK 1.054426.0500", 8, "botol"}}},
		{"Analisa external logam berat sampel air", "Analisa External", "", "Budi Santoso", "Kapasitas internal tidak mencukupi untuk parameter logam berat.", "rejected", "Ditolak karena anggaran periode ini sudah terpakai.", 59,
			[]seedPRItem{{"Analisa logam berat (Pb, Cd, Hg)", "Lab Eksternal - SUCOFINDO", 5, "sampel"}}},
		{"Pembelian sarung tangan nitrile", "Expense Item", "", "Andi Pratama", "Stok sarung tangan untuk analis tersisa 5 box.", "done", "Diterima dan didistribusikan ke lab.", 46,
			[]seedPRItem{{"Sarung tangan nitrile M", "ANSELL 92-600", 30, "box"}}},
		{"Pengadaan vial amber 20 mL", "Tools", "", "Siti Nurhaliza", "Kebutuhan vial untuk penyimpanan sampel retain.", "po_approve", "Diterima 15 pack.", 34,
			[]seedPRItem{{"Vial amber 20 mL", "SCHOTT 2180136", 15, "pack"}}},
		{"Pembelian reagen untuk uji COD", "Reagen", "", "Dewi Lestari", "Reagen COD tersisa 1 set, pengujian limbah meningkat.", "pending_po", "PO dikirim, estimasi 7 hari.", 25,
			[]seedPRItem{{"Reagen COD", "HACH 2125915", 4, "set"}}},
		{"Pengadaan kuvet spektrofotometer", "Tools", "", "Fajar Nugroho", "Kuvet lama banyak tergores sehingga mempengaruhi absorbansi.", "op_penawaran", "Menunggu penawaran purchasing.", 14,
			[]seedPRItem{{"Kuvet spektrofotometer", "HELLMA 100-10-40", 20, "pcs"}}},
		{"Pembelian kertas saring Whatman", "Expense Item", "", "Rina Wulandari", "Persediaan kertas saring untuk filtrasi sampel menipis.", "form_created", "", 6,
			[]seedPRItem{{"Kertas saring Whatman", "WHATMAN 1001-125", 10, "pack"}}},
		{"Pengadaan termometer digital terkalibrasi", "Tools Mikro", "", "Budi Santoso", "Termometer ruang penyimpanan perlu penggantian karena drift.", "form_created", "", 2,
			[]seedPRItem{{"Termometer digital terkalibrasi", "TESTO 1089764", 3, "unit"}}},
	}

	attachmentsDir := filepath.Join(uploadDir, "purchase-requests", time.Now().Format("2006/01"))
	if err := os.MkdirAll(attachmentsDir, 0o755); err != nil {
		return err
	}

	counters := make(map[string]int)
	for _, item := range requests {
		id := uuid.New()
		createdAt := time.Now().AddDate(0, 0, -item.DaysAgo)

		period := createdAt.Format("0106")
		counters[period]++
		reference := fmt.Sprintf("PRG/1GQ01/%s/%05d", period, counters[period])

		var customType *string
		if item.CustomType != "" {
			customType = &item.CustomType
		}
		var notes *string
		if item.Notes != "" {
			notes = &item.Notes
		}

		_, err := db.ExecContext(ctx, `
			INSERT INTO purchase_requests (
				id, reference_number, description, order_type, custom_order_type,
				requester_name, reason, status, internal_notes, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)`,
			id, reference, item.Description, item.OrderType, customType,
			item.Requester, item.Reason, item.Status, notes, createdAt,
		)
		if err != nil {
			return err
		}

		for index, line := range item.Items {
			_, err = db.ExecContext(ctx, `
				INSERT INTO purchase_request_items (
					id, purchase_request_id, item_name, brand_catalog, quantity, unit, sort_order, created_at
				) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
				uuid.New(), id, line.ItemName, line.BrandCatalog, line.Quantity, line.Unit, index+1, createdAt)
			if err != nil {
				return err
			}
		}

		relative, spvName, pdfSize, pdfErr := writeApprovalPDF(uploadDir, reference, item.Requester)
		if pdfErr != nil {
			return pdfErr
		}

		safeReference := strings.ReplaceAll(reference, "/", "-")
		_, err = db.ExecContext(ctx, `
			INSERT INTO attachments (
				id, purchase_request_id, attachment_type, original_name, stored_name, mime_type, size_bytes, file_path, created_at
			) VALUES ($1, $2, 'spv_approval', $3, $4, 'application/pdf', $5, $6, $7)`,
			uuid.New(), id, fmt.Sprintf("SPV-Approval-%s.pdf", safeReference), spvName, pdfSize, relative, createdAt,
		)
		if err != nil {
			return err
		}

		_, err = db.ExecContext(ctx, `
			INSERT INTO purchase_request_status_history (id, purchase_request_id, status, notes, created_at)
			VALUES ($1, $2, 'form_created', 'Purchase Request dibuat', $3)`,
			uuid.New(), id, createdAt)
		if err != nil {
			return err
		}

		if item.Status != "form_created" {
			_, err = db.ExecContext(ctx, `
				INSERT INTO purchase_request_status_history (id, purchase_request_id, status, notes, created_at)
				VALUES ($1, $2, $3, $4, $5)`,
				uuid.New(), id, item.Status, item.Notes, createdAt.Add(24*time.Hour))
			if err != nil {
				return err
			}
		}

		_, err = db.ExecContext(ctx, `
			INSERT INTO purchase_request_audit_logs (
				purchase_request_id, action, actor_name, actor_role, notes, after_data, created_at
			) VALUES ($1, 'created', $2, 'user', 'Purchase Request dibuat', $3, $4)`,
			id, item.Requester,
			fmt.Sprintf(`{"reference_number":%q,"status":%q,"order_type":%q}`, reference, item.Status, item.OrderType),
			createdAt)
		if err != nil {
			return err
		}
	}

	for period, last := range counters {
		if _, err := db.ExecContext(ctx, `
			INSERT INTO pr_number_counters (period, last_number)
			VALUES ($1, $2)
			ON CONFLICT (period) DO UPDATE
			SET last_number = GREATEST(pr_number_counters.last_number, EXCLUDED.last_number),
			    updated_at = NOW()`, period, last); err != nil {
			return err
		}
	}

	log.Printf("purchase requests dibuat: %d", len(requests))
	return nil
}
