# QC Digital Service Portal

Portal layanan digital internal laboratorium Quality Control. Menyediakan **Knowledge Center** (pusat dokumen & artikel) dan **Administration Center** (pengajuan Purchase Request + admin panel).

Stack: **React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui** · **Go (Gin)** · **PostgreSQL** · REST API · Clean Architecture · tanpa Docker.

---

## 1. Fitur

### Gateway Page
- Dua menu utama: **Knowledge Center** dan **Administration Center**.
- Ringkasan statistik dokumen, kategori, dan alur status PR.

### Knowledge Center (publik)
- Daftar dokumen dengan **global search**, **filter kategori**, **filter tipe konten**, dan **sort** (terbaru, terlama, judul A-Z, paling dilihat).
- **View detail** dokumen.
- **PDF preview** inline + layar penuh + **download PDF**.
- **Artikel** mendukung rich text (heading, bullet/numbered list, tabel, gambar, tautan, kutipan).
- Pagination responsif.

### Administration Center — Purchase Request (tanpa login)
- Form lengkap: deskripsi, jenis pemesanan (dropdown 9 opsi, field tambahan untuk **Lain-Lain**), brand/merk + nomor katalog, jumlah, pemesan, alasan (wajib), bukti SPV approve (wajib), penawaran (opsional).
- Validasi frontend (Zod + React Hook Form) dan backend (service layer).
- Upload maksimal **10 MB** per file; SPV: PDF/JPG/JPEG/PNG; penawaran: PDF/XLSX/JPG/JPEG/PNG.
- Setelah submit: data langsung tersimpan dan user menerima **nomor referensi** (`PR-YYYYMMDD-XXXX`).
- **Tracking status** tanpa login + riwayat status + unduh lampiran.

### Admin Panel (JWT)
- **Login** username/password, token JWT, proteksi route.
- **Dashboard**: total dokumen/artikel/PDF, total per status PR, chart PR per bulan, distribusi jenis pemesanan, distribusi status, PR terbaru.
- **Knowledge Management**: CRUD dokumen, upload PDF, upload gambar artikel, publish/unpublish.
- **Category Management**: CRUD kategori dengan proteksi kategori yang masih dipakai.
- **Purchase Request Management**: tabel PR, pencarian, filter status/jenis/rentang tanggal, detail PR, ubah status, catatan internal, unduh lampiran, **export Excel**.

### Status PR
`Submitted → Review → Approved → Ordered → Received → Closed` (plus `Rejected`).

---

## 2. Struktur Project

```
qcdsp/
├── backend/
│   ├── cmd/
│   │   ├── server/main.go          # entrypoint API
│   │   └── seed/main.go            # seeder data dummy
│   ├── internal/
│   │   ├── config/                 # loader .env
│   │   ├── database/               # koneksi + runner migrasi
│   │   ├── handler/                # HTTP layer (Gin)
│   │   ├── middleware/             # JWT auth, CORS, security headers
│   │   ├── models/                 # entity & konstanta
│   │   ├── repository/             # akses PostgreSQL (SQL murni)
│   │   ├── router/                 # definisi route
│   │   ├── service/                # business logic + validasi
│   │   └── utils/                  # JWT, response, upload, password
│   ├── migrations/
│   │   ├── embed.go
│   │   └── 001_init.sql            # schema PostgreSQL
│   ├── uploads/                    # file upload (runtime)
│   ├── .env.example
│   ├── go.mod
│   └── go.sum
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/                 # komponen shadcn/ui
│   │   │   ├── shared/             # search, pagination, upload, badge, dll
│   │   │   ├── layout/             # public & admin layout
│   │   │   └── admin/              # rich text editor
│   │   ├── contexts/               # auth context
│   │   ├── hooks/                  # React Query hooks
│   │   ├── lib/                    # api client, format, constants, export
│   │   ├── pages/
│   │   │   ├── public/             # gateway, knowledge, PR, tracking, login
│   │   │   └── admin/              # dashboard, knowledge, category, PR
│   │   ├── types/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── .env.example
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts
├── database/
│   ├── qcdsp_dump.sql              # dump schema + data
│   └── qcdsp_schema.sql            # dump schema saja
└── README.md
```

Arsitektur backend mengikuti **Clean Architecture**:

```
HTTP (handler) → Service (business rules & validasi) → Repository (SQL) → PostgreSQL
                        ↑
                    Model / DTO
```

Handler tidak menyentuh SQL; repository tidak menyentuh HTTP.

---

## 3. Prasyarat

| Tool | Versi minimum |
|------|---------------|
| Node.js | 20 LTS (disarankan 20/22) |
| npm | 10 |
| Go | 1.25 |
| PostgreSQL | 14 |

Tidak memerlukan Docker.

---

## 4. Instalasi

### 4.1 Database

```sql
CREATE DATABASE qcdsp;
```

Skema dibuat otomatis oleh backend saat start (migrasi embedded, idempotent, tercatat di tabel `schema_migrations`).

### 4.2 Backend

```powershell
cd backend
Copy-Item .env.example .env
# sesuaikan DATABASE_URL dan JWT_SECRET (minimal 32 karakter)
go mod download
go run ./cmd/seed      # membuat admin, kategori, dokumen, dan PR dummy
go run ./cmd/server    # API di http://localhost:8080
```

Health check: `GET http://localhost:8080/health`

**Akun admin dari seeder:**

| Username | Password |
|----------|----------|
| `admin` | `Admin123!` |

> Seeder bersifat idempotent: jika data sudah ada, seed akan dilewati. Ganti password default sebelum digunakan di produksi.

### 4.3 Frontend

```powershell
cd frontend
Copy-Item .env.example .env
npm install
npm run dev            # http://localhost:5173
```

Development memakai proxy Vite: `/api` → `http://localhost:8080`, jadi `VITE_API_BASE_URL` boleh dikosongkan.

Jika memakai registry yang lambat, gunakan mirror:

```powershell
npm install --registry=https://registry.npmmirror.com
```

### 4.4 Setup di PC Lain (hasil clone)

Beberapa hal **tidak ikut** ke repository dan harus disiapkan manual di PC tujuan:

| Tidak ikut git | Alasan | Yang harus dilakukan |
|----------------|--------|----------------------|
| `backend/.env`, `frontend/.env` | masuk `.gitignore` | salin dari `.env.example` lalu sesuaikan |
| `frontend/node_modules` | di-ignore | `npm ci` |
| `backend/uploads/*` | di-ignore | copy dari PC lama, atau regenerate lewat seeder |
| Data PostgreSQL | ada di server DB | jalankan seeder atau restore dump |

**1. Prasyarat** — Git, Node.js 20/22 LTS + npm 10, Go 1.25+, PostgreSQL 14+ (disarankan 18).

**2. Clone dan environment**

```powershell
git clone <repo-url> qcdsp
cd qcdsp

Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
```

Sesuaikan `backend/.env` (`DATABASE_URL`, `JWT_SECRET`). **Jangan pakai ulang `JWT_SECRET` PC lama** — generate baru:

```powershell
$b = New-Object byte[] 48; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)
```

**3. Database — pilih salah satu**

*Opsi A — database baru + data dummy (paling praktis, file upload ikut dibuat):*

```powershell
$env:PGPASSWORD='<password>'
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h localhost -c "CREATE DATABASE qcdsp;"

cd backend
go mod download
go run ./cmd/seed      # schema + admin/kategori/dokumen/PR + PDF contoh
go run ./cmd/server
```

*Opsi B — restore data dari `database/qcdsp_dump.sql`:*

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h localhost -c "CREATE DATABASE qcdsp;"
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h localhost -d qcdsp -f database\qcdsp_dump.sql
cd backend
go run ./cmd/server
```

> Restore memakai `psql` 18 (dump dibuat `pg_dump 18.6` dan memuat direktif `\restrict`).

**4. Frontend**

```powershell
cd frontend
npm ci
npm run dev            # http://localhost:5173
```

**5. Penting untuk Opsi B — file upload tidak ada di dump**

Dump hanya berisi data; file PDF/lampiran berada di `backend/uploads`. Jika folder itu tidak dicopy, dokumen tetap tampil di daftar tetapi preview/download PDF akan 404. Perlu diketahui juga: seeder **melewati** seeding jika tabel sudah terisi, jadi `go run ./cmd/seed` tidak akan membuat ulang file untuk data hasil restore. Pilihannya:

- copy folder `backend/uploads` dari PC lama ke PC baru, **atau**
- pakai Opsi A (database kosong + seeder) bila data lama tidak diperlukan.

**6. Verifikasi**

| Cek | Ekspektasi |
|-----|-----------|
| `GET http://localhost:8080/health` | `200 OK` |
| `http://localhost:5173` | halaman gateway tampil |
| Login admin | sesuai password yang berlaku (lihat catatan di bawah) |
| Buka salah satu dokumen PDF | preview tampil (bukan 404) |

> Password admin mengikuti sumber datanya: `Admin123!` untuk database hasil seeder, sedangkan untuk restore dump gunakan password yang terakhir diubah di PC asal — dump memuat hash password terkini.

---

## 5. Konfigurasi Environment

### `backend/.env`

| Variabel | Default | Keterangan |
|----------|---------|------------|
| `APP_ENV` | `development` | `production` mengaktifkan mode release Gin |
| `PORT` | `8080` | Port API |
| `DATABASE_URL` | — | `postgres://user:pass@host:5432/qcdsp?sslmode=disable` |
| `JWT_SECRET` | — | **Wajib**, minimal 32 karakter |
| `JWT_EXPIRES_HOURS` | `24` | Masa berlaku token |
| `UPLOAD_DIR` | `./uploads` | Direktori penyimpanan file |
| `MAX_UPLOAD_MB` | `10` | Batas ukuran file |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173,...` | Origin yang diizinkan (comma separated) |

### `frontend/.env`

| Variabel | Default | Keterangan |
|----------|---------|------------|
| `VITE_API_BASE_URL` | *(kosong)* | Base URL API. Kosong = pakai proxy/relative path |
| `VITE_APP_NAME` | `QC Digital Service Portal` | Nama aplikasi |

---

## 6. Database

### Tabel

| Tabel | Keterangan |
|-------|-----------|
| `admin_users` | Admin panel (username unik, password bcrypt, role, audit fields) |
| `categories` | Kategori Knowledge Center (nama & slug unik) |
| `knowledge_documents` | Dokumen PDF/artikel, `search_vector` GIN index, publish flag, view count |
| `purchase_requests` | PR publik dengan nomor referensi unik dan status terbatas |
| `attachments` | Lampiran PR (`spv_approval`, `quotation`), FK cascade |
| `purchase_request_status_history` | Jejak perubahan status + catatan + admin |
| `schema_migrations` | Kontrol versi migrasi |

Semua tabel utama memakai **UUID primary key**, **foreign key**, **index** (termasuk index parsial & GIN full-text), serta **audit fields** `created_at` / `updated_at` dengan trigger `set_updated_at()`.

Constraint penting:
- `chk_pr_custom_order_type` — `Lain-Lain` wajib punya jenis kustom.
- `chk_knowledge_pdf_file` / `chk_knowledge_article_content` — konsistensi tipe konten.
- `chk_knowledge_pdf_size` — PDF ≤ 10 MB.
- Enum via `CHECK` untuk `order_type`, `status`, `content_type`, `attachment_type`.

### Reset data

```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
```

Lalu jalankan ulang backend + seeder.

### SQL Dump (migrasi database)

Folder `database/` berisi dump siap pakai:

| File | Isi |
|------|-----|
| `database/qcdsp_dump.sql` | Schema + **seluruh data** (admin, kategori, dokumen, PR, lampiran, riwayat status) |
| `database/qcdsp_schema.sql` | Schema saja (tabel, index, trigger, constraint) |

Restore ke server/database baru (dibuat dengan `pg_dump 18.6`, format plain SQL, `--no-owner --no-privileges`):

```powershell
$env:PGPASSWORD='<password>'
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h <host> -c "CREATE DATABASE qcdsp;"
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h <host> -d qcdsp -f database\qcdsp_dump.sql
```

Buat dump ulang (stop backend dulu supaya data konsisten):

```powershell
& "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" -U postgres -h localhost -d qcdsp --no-owner --no-privileges --encoding=UTF8 -f database\qcdsp_dump.sql
& "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" -U postgres -h localhost -d qcdsp --no-owner --no-privileges --encoding=UTF8 --schema-only -f database\qcdsp_schema.sql
```

> **Isi dump:** seluruh tabel dan baris data (`schema_migrations` ikut, jadi migrasi tidak dijalankan ulang). File upload di `backend/uploads` **tidak** termasuk — lihat [4.4 Setup di PC Lain](#44-setup-di-pc-lain-hasil-clone).
>
> **Keamanan:** dump memuat hash password admin yang berlaku saat dump dibuat — simpan di tempat terbatas. Setelah restore ke environment baru, ganti `JWT_SECRET` di `backend/.env` dan pertimbangkan mengganti password admin.
>
> **Versi:** dibuat dengan `pg_dump 18.6`; restore menggunakan `psql` 18 karena dump memuat direktif `\restrict`. Untuk server PostgreSQL versi lebih lama, buat dump baru dari server tersebut.

---

## 7. API

Base URL: `http://localhost:8080/api`
Format response: `{ "success": bool, "message": string, "data": any, "errors": any, "meta": any }`

### Public

| Method | Endpoint | Keterangan |
|--------|----------|-----------|
| GET | `/categories` | Kategori yang memiliki dokumen published |
| GET | `/knowledge` | Daftar dokumen published |
| GET | `/knowledge/:id` | Detail dokumen (menambah view count) |
| GET | `/knowledge/:id/pdf` | Preview/download PDF (`?download=1`) |
| POST | `/purchase-requests` | Buat PR (multipart/form-data) |
| GET | `/purchase-requests/status/:reference` | Tracking PR by nomor referensi |
| GET | `/purchase-requests/status/:reference/attachments/:attachmentId` | Unduh lampiran PR |
| GET | `/files/*path` | File gambar artikel |

Query `GET /knowledge`: `search`, `category` (slug), `category_id`, `content_type` (`pdf|article`), `sort` (`newest|oldest|title|popular|updated`), `page`, `page_size`.

Body `POST /purchase-requests` (multipart):

```
description, order_type, custom_order_type, brand_catalog, quantity,
requester_name, reason, spv_approval (file, wajib), quotation (file, opsional)
```

### Admin

| Method | Endpoint | Keterangan |
|--------|----------|-----------|
| POST | `/admin/login` | Login, mengembalikan JWT |
| GET | `/admin/me` | Profil admin |
| GET | `/admin/dashboard` | Statistik + chart + PR terbaru |
| GET | `/admin/categories` | Semua kategori + jumlah dokumen |
| POST | `/admin/categories` | Buat kategori |
| PUT | `/admin/categories/:id` | Update kategori |
| DELETE | `/admin/categories/:id` | Hapus kategori (ditolak jika masih dipakai) |
| GET | `/admin/knowledge` | Semua dokumen (draft + published) |
| GET | `/admin/knowledge/:id` | Detail dokumen |
| POST | `/admin/knowledge` | Buat dokumen (multipart) |
| PUT | `/admin/knowledge/:id` | Update dokumen (multipart) |
| PUT | `/admin/knowledge/:id/publish` | Publish/unpublish |
| DELETE | `/admin/knowledge/:id` | Hapus dokumen + file |
| POST | `/admin/uploads/image` | Upload gambar artikel |
| GET | `/admin/purchase-requests` | Daftar PR + filter |
| GET | `/admin/purchase-requests/:id` | Detail PR + riwayat |
| PUT | `/admin/purchase-requests/:id/status` | Ubah status + catatan |
| PUT | `/admin/purchase-requests/:id` | Simpan catatan internal |
| GET | `/admin/purchase-requests/:id/attachments/:attachmentId` | Unduh lampiran |

Semua endpoint `/admin/*` (kecuali login) memerlukan header:

```
Authorization: Bearer <token>
```

Query `GET /admin/purchase-requests`: `search`, `status`, `order_type`, `date_from`, `date_to`, `sort`, `page`, `page_size`.

### Contoh cURL

```bash
# Login
curl -X POST http://localhost:8080/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin123!"}'

# Buat PR
curl -X POST http://localhost:8080/api/purchase-requests \
  -F "description=Pembelian reagen buffer pH 7,00" \
  -F "order_type=Reagen" \
  -F "brand_catalog=MERCK 1.098439.1000" \
  -F "quantity=6" \
  -F "requester_name=Rina Wulandari" \
  -F "reason=Stok menipis untuk pengujian harian" \
  -F "spv_approval=@bukti-spv.pdf"

# Tracking
curl http://localhost:8080/api/purchase-requests/status/PR-20260601-0001
```

---

## 8. Validasi & Keamanan

- **Frontend**: Zod schema + React Hook Form, validasi tipe/ukuran file sebelum upload, feedback per field.
- **Backend**: validasi wajib di service layer (panjang, enum, kuantitas, konsistensi tipe konten, syarat `Lain-Lain`), validasi ekstensi & ukuran file, serta constraint database sebagai lapisan terakhir.
- **Password**: bcrypt (cost default).
- **JWT**: HS256, secret minimal 32 karakter, expiry terkonfigurasi, penolakan signing method non-HMAC.
- **Upload**: nama file di-generate UUID (mencegah path traversal & overwrite), ekstensi di-whitelist, limit body via `http.MaxBytesReader`, file dihapus jika validasi gagal.
- **CORS**: whitelist origin dari env, bukan `*`.
- **SQL**: seluruh query memakai parameter binding (`$1`, `$2`, ...).
- **XSS**: konten artikel berupa HTML dari admin terautentikasi; render melalui `dangerouslySetInnerHTML` hanya pada halaman artikel. Untuk produksi dengan banyak admin, disarankan menambahkan sanitizer (mis. `bluemonday`) di backend.

---

## 9. Build & Deployment

### Backend

```powershell
cd backend
go build -o bin/qcdsp-server.exe ./cmd/server
go build -o bin/qcdsp-seed.exe ./cmd/seed
```

Jalankan sebagai service (mis. NSSM / Task Scheduler) dengan env produksi:

```
APP_ENV=production
DATABASE_URL=postgres://user:pass@db-host:5432/qcdsp?sslmode=require
JWT_SECRET=<random 64 karakter>
UPLOAD_DIR=D:\qcdsp-data\uploads
CORS_ALLOWED_ORIGINS=https://qcdsp.internal
```

### Frontend

```powershell
cd frontend
$env:VITE_API_BASE_URL="https://api.qcdsp.internal"
npm run build
```

Hasil build ada di `frontend/dist`. Sajikan dengan Nginx/IIS dan arahkan:

- `/` → `dist/index.html` (SPA fallback: semua route ke `index.html`)
- `/api/*` → reverse proxy ke backend `:8080`
- `/uploads/*` tidak perlu diekspos karena file diakses via endpoint API

Contoh Nginx:

```nginx
server {
    listen 80;
    server_name qcdsp.internal;

    root /var/www/qcdsp;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 12m;
    }
}
```

Catatan produksi:
1. Ganti password admin default dan `JWT_SECRET`.
2. Backup direktori `UPLOAD_DIR` dan database secara berkala.
3. Aktifkan HTTPS.
4. Batasi akses admin panel via VPN/jaringan internal bila perlu.
5. `client_max_body_size` pada reverse proxy harus ≥ 10 MB.

---

## 10. Seeder Data Dummy

`go run ./cmd/seed` membuat:

- 1 admin (`admin` / `Admin123!`)
- 7 kategori: FAQ, SOP, Work Instruction, Manual, Troubleshooting, Artikel, Dokumen PDF
- 8 dokumen (7 published + 1 draft artikel); 3 di antaranya PDF contoh yang di-generate otomatis lengkap dengan xref sehingga preview di browser berjalan normal
- 14 Purchase Request dengan distribusi status dan rentang 12 bulan terakhir, lengkap dengan lampiran SPV contoh (PDF valid) dan riwayat status

---

## 11. Scripts

### Frontend

| Perintah | Fungsi |
|----------|--------|
| `npm run dev` | Development server (port 5173) |
| `npm run build` | Typecheck + production build (chunk splitting: react, charts, forms, query) |
| `npm run preview` | Preview hasil build |
| `npm run typecheck` | TypeScript check |

### Backend

| Perintah | Fungsi |
|----------|--------|
| `go run ./cmd/server` | Jalankan API + migrasi |
| `go run ./cmd/seed` | Seed data dummy |
| `go build ./...` | Build semua package |
| `go vet ./...` | Static analysis |

---

## 12. Troubleshooting

| Masalah | Solusi |
|---------|--------|
| `DATABASE_URL is required` | Salin `.env.example` → `.env` di folder `backend` |
| `JWT_SECRET must be at least 32 characters` | Gunakan secret lebih panjang |
| `ping database` gagal | Pastikan PostgreSQL berjalan, database `qcdsp` sudah dibuat, kredensial benar |
| Frontend 404 setelah refresh | Konfigurasi SPA fallback (`try_files ... /index.html`) |
| Upload 413 | Naikkan `client_max_body_size` di reverse proxy |
| Login gagal | Jalankan seeder; cek username/password |
| `npm install` lambat/ECONNRESET | Gunakan `--registry=https://registry.npmmirror.com` |
| `Failed to resolve entry for package ...` / modul tidak ditemukan | `node_modules` ter-ekstrak tidak lengkap (install terputus). Stop dev server, hapus `node_modules` + `node_modules/.vite`, lalu `npm ci` |
| Preview/download PDF 404 | File tidak ada di `backend/uploads` (tidak ikut git). Copy folder uploads dari PC asal, atau pakai database baru + seeder |
| `\restrict: invalid command` saat restore dump | Restore memakai `psql` 18 (dump dibuat `pg_dump 18.6`) |
| `go: go.mod requires go >= 1.25.0` | Upgrade Go ke 1.25+ |
