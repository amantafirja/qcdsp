--
-- PostgreSQL database dump
--

\restrict w13BrSY1lNqkPDb6O4a5L8EDqLhZXuakxFNKn63g0vddX1gxsDOO143sEfGmpaP

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    username character varying(80) NOT NULL,
    password_hash text NOT NULL,
    name character varying(150) NOT NULL,
    role character varying(30) DEFAULT 'admin'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT admin_users_role_check CHECK (((role)::text = ANY (ARRAY[('super_admin'::character varying)::text, ('admin'::character varying)::text])))
);


--
-- Name: attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    purchase_request_id uuid NOT NULL,
    attachment_type character varying(30) NOT NULL,
    original_name character varying(255) NOT NULL,
    stored_name character varying(255) NOT NULL,
    mime_type character varying(150) NOT NULL,
    size_bytes bigint NOT NULL,
    file_path text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT attachments_attachment_type_check CHECK (((attachment_type)::text = ANY (ARRAY[('spv_approval'::character varying)::text, ('quotation'::character varying)::text])))
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(120) NOT NULL,
    slug character varying(150) NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: knowledge_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(255) NOT NULL,
    slug character varying(300) NOT NULL,
    category_id uuid NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    content_type character varying(20) NOT NULL,
    pdf_file_path text,
    pdf_original_name character varying(255),
    pdf_size_bytes bigint,
    article_content text,
    is_published boolean DEFAULT false NOT NULL,
    view_count integer DEFAULT 0 NOT NULL,
    created_by uuid,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    search_vector tsvector GENERATED ALWAYS AS (to_tsvector('simple'::regconfig, (((COALESCE(title, ''::character varying))::text || ' '::text) || COALESCE(description, ''::text)))) STORED,
    CONSTRAINT chk_knowledge_article_content CHECK ((((content_type)::text <> 'article'::text) OR ((article_content IS NOT NULL) AND (length(article_content) > 0)))),
    CONSTRAINT chk_knowledge_pdf_file CHECK ((((content_type)::text <> 'pdf'::text) OR ((pdf_file_path IS NOT NULL) AND (length(pdf_file_path) > 0)))),
    CONSTRAINT chk_knowledge_pdf_size CHECK (((pdf_size_bytes IS NULL) OR (pdf_size_bytes <= 10485760))),
    CONSTRAINT knowledge_documents_content_type_check CHECK (((content_type)::text = ANY (ARRAY[('pdf'::character varying)::text, ('article'::character varying)::text])))
);


--
-- Name: purchase_request_status_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_request_status_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    purchase_request_id uuid NOT NULL,
    status character varying(30) NOT NULL,
    notes text,
    changed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT purchase_request_status_history_status_check CHECK (((status)::text = ANY (ARRAY[('Submitted'::character varying)::text, ('Review'::character varying)::text, ('Approved'::character varying)::text, ('Rejected'::character varying)::text, ('Ordered'::character varying)::text, ('Received'::character varying)::text, ('Closed'::character varying)::text])))
);


--
-- Name: purchase_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reference_number character varying(40) NOT NULL,
    description text NOT NULL,
    order_type character varying(50) NOT NULL,
    custom_order_type character varying(120),
    brand_catalog character varying(255) NOT NULL,
    quantity integer NOT NULL,
    requester_name character varying(150) NOT NULL,
    reason text NOT NULL,
    status character varying(30) DEFAULT 'Submitted'::character varying NOT NULL,
    internal_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_pr_custom_order_type CHECK ((((order_type)::text <> 'Lain-Lain'::text) OR ((custom_order_type IS NOT NULL) AND (length(btrim((custom_order_type)::text)) > 0)))),
    CONSTRAINT purchase_requests_order_type_check CHECK (((order_type)::text = ANY (ARRAY[('Reagen'::character varying)::text, ('Tools'::character varying)::text, ('Expense Item'::character varying)::text, ('Reagen Mikro'::character varying)::text, ('Tools Mikro'::character varying)::text, ('RS/Reference Standard'::character varying)::text, ('Gas'::character varying)::text, ('Analisa External'::character varying)::text, ('Lain-Lain'::character varying)::text]))),
    CONSTRAINT purchase_requests_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT purchase_requests_status_check CHECK (((status)::text = ANY (ARRAY[('Submitted'::character varying)::text, ('Review'::character varying)::text, ('Approved'::character varying)::text, ('Rejected'::character varying)::text, ('Ordered'::character varying)::text, ('Received'::character varying)::text, ('Closed'::character varying)::text])))
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version character varying(255) NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Data for Name: admin_users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.admin_users (id, username, password_hash, name, role, is_active, last_login_at, created_at, updated_at) FROM stdin;
fa7fd5ee-2859-4c17-8fd1-a3e2cb7cc84c	admin	$2a$10$u9a5kscYnpiU4KZ.J3XLe..CsBOz4a7VQ/i0VUlXOQS3d0jwylbrC	Administrator QC	super_admin	t	2026-10-27 10:03:41.901104+07	2026-10-26 10:03:56.800239+07	2026-10-27 10:03:41.901104+07
\.


--
-- Data for Name: attachments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.attachments (id, purchase_request_id, attachment_type, original_name, stored_name, mime_type, size_bytes, file_path, created_at) FROM stdin;
86c52850-dc30-4f42-8d0a-39729668f73d	b3519b83-7821-47d1-9d4f-222b732a93a7	spv_approval	SPV-Approval-PR-20260601-0001.pdf	spv-approval-PR-20260601-0001.pdf	application/pdf	2000	purchase-requests/2026/10/spv-approval-PR-20260601-0001.pdf	2026-06-01 10:03:57.157441+07
c0cbff78-5570-4c25-9b10-0fb248cd58d9	7ff86f22-3895-4a4d-a277-6b9dc3d9ba15	spv_approval	SPV-Approval-PR-20260612-0002.pdf	spv-approval-PR-20260612-0002.pdf	application/pdf	1998	purchase-requests/2026/10/spv-approval-PR-20260612-0002.pdf	2026-06-12 10:03:57.223031+07
48bcc79f-e721-4c18-a653-384e25b0f4f7	dff2462b-289d-4bb0-930a-5cd7299a320a	spv_approval	SPV-Approval-PR-20260625-0003.pdf	spv-approval-PR-20260625-0003.pdf	application/pdf	1998	purchase-requests/2026/10/spv-approval-PR-20260625-0003.pdf	2026-06-25 10:03:57.240431+07
e34d9beb-2bb6-420b-80e6-60d173216e06	e9bbbe6f-5369-45b0-b23b-cf98cffece3e	spv_approval	SPV-Approval-PR-20260708-0004.pdf	spv-approval-PR-20260708-0004.pdf	application/pdf	2000	purchase-requests/2026/10/spv-approval-PR-20260708-0004.pdf	2026-07-08 10:03:57.274287+07
8549180d-fc86-4de1-bac7-732b863e2569	be1c3abf-e8a2-4951-ba76-808f7778e100	spv_approval	SPV-Approval-PR-20260719-0005.pdf	spv-approval-PR-20260719-0005.pdf	application/pdf	1998	purchase-requests/2026/10/spv-approval-PR-20260719-0005.pdf	2026-07-19 10:03:57.287276+07
04927f04-18e3-4069-85b0-4cb343190017	8ad19771-37ec-43d9-b8d2-8098e202ea37	spv_approval	SPV-Approval-PR-20260802-0006.pdf	spv-approval-PR-20260802-0006.pdf	application/pdf	1999	purchase-requests/2026/10/spv-approval-PR-20260802-0006.pdf	2026-08-02 10:03:57.300141+07
a7e76131-0625-493f-a15a-58dd27999f2a	41c78252-8d04-42ca-88ad-4256b7e0541f	spv_approval	SPV-Approval-PR-20260815-0007.pdf	spv-approval-PR-20260815-0007.pdf	application/pdf	2000	purchase-requests/2026/10/spv-approval-PR-20260815-0007.pdf	2026-08-15 10:03:57.306614+07
d40da7b2-6dda-48b6-8457-472e30ff4532	0d5b77dc-5e92-4f6c-a59c-75ab4f76097d	spv_approval	SPV-Approval-PR-20260828-0008.pdf	spv-approval-PR-20260828-0008.pdf	application/pdf	1998	purchase-requests/2026/10/spv-approval-PR-20260828-0008.pdf	2026-08-28 10:03:57.317524+07
f0bf7caf-ae74-40ca-ac8e-dd638ece01e3	b2072158-6ffb-4adc-836f-0a40538d77d5	spv_approval	SPV-Approval-PR-20260910-0009.pdf	spv-approval-PR-20260910-0009.pdf	application/pdf	1998	purchase-requests/2026/10/spv-approval-PR-20260910-0009.pdf	2026-09-10 10:03:57.340513+07
8221c9bb-b389-4c24-b2dc-6a7ecfeea5db	056cd8bd-a8bc-4a48-aa65-e11a12b02cea	spv_approval	SPV-Approval-PR-20260922-0010.pdf	spv-approval-PR-20260922-0010.pdf	application/pdf	2000	purchase-requests/2026/10/spv-approval-PR-20260922-0010.pdf	2026-09-22 10:03:57.354598+07
3bc58dfd-6a83-4105-a35b-515c2ec106e0	d7a7ec9d-d9a0-4f19-b71d-ba60a14786ce	spv_approval	SPV-Approval-PR-20261001-0011.pdf	spv-approval-PR-20261001-0011.pdf	application/pdf	1998	purchase-requests/2026/10/spv-approval-PR-20261001-0011.pdf	2026-10-01 10:03:57.359791+07
630d8426-d379-494f-b06c-b21abacf2ff2	f27a13b1-c267-481b-b1da-ed1774fc76f0	spv_approval	SPV-Approval-PR-20261012-0012.pdf	spv-approval-PR-20261012-0012.pdf	application/pdf	1999	purchase-requests/2026/10/spv-approval-PR-20261012-0012.pdf	2026-10-12 10:03:57.401942+07
149a6971-424a-40de-bf69-8b81bc0ab8f9	2f592b6a-412a-458b-9ab9-fa3ed08d581a	spv_approval	SPV-Approval-PR-20261020-0013.pdf	spv-approval-PR-20261020-0013.pdf	application/pdf	2000	purchase-requests/2026/10/spv-approval-PR-20261020-0013.pdf	2026-10-20 10:03:57.428653+07
a9cd76be-a072-4049-a7ae-d30d43060e61	88dfd617-33b6-494d-9ebb-0a206d7efb42	spv_approval	SPV-Approval-PR-20261024-0014.pdf	spv-approval-PR-20261024-0014.pdf	application/pdf	1998	purchase-requests/2026/10/spv-approval-PR-20261024-0014.pdf	2026-10-24 10:03:57.444269+07
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.categories (id, name, slug, description, created_at, updated_at) FROM stdin;
64fcede3-7fd1-421e-b761-33e2229aa3cd	FAQ	faq	Pertanyaan yang sering diajukan seputar operasional laboratorium dan layanan QC.	2026-10-26 10:03:56.868405+07	2026-10-26 10:03:56.868405+07
ab776f04-6bbe-4e51-ab51-f16bfbe3d5f4	SOP	sop	Standard Operating Procedure untuk seluruh proses kerja laboratorium.	2026-10-26 10:03:56.872542+07	2026-10-26 10:03:56.872542+07
7c392c29-5a37-4e4d-808e-a0cd16439782	Work Instruction	work-instruction	Instruksi kerja teknis dan langkah operasional peralatan.	2026-10-26 10:03:56.881007+07	2026-10-26 10:03:56.881007+07
86ea8046-13bb-4848-95ce-ce9a439bbfe1	Manual	manual	Buku manual dan panduan penggunaan instrumen laboratorium.	2026-10-26 10:03:56.886052+07	2026-10-26 10:03:56.886052+07
ec3d5b1f-f8f4-4ff6-9157-5971bc36626b	Troubleshooting	troubleshooting	Panduan penanganan masalah dan error pada instrumen maupun proses.	2026-10-26 10:03:56.887444+07	2026-10-26 10:03:56.887444+07
998ec288-f3de-4447-86a3-5b3552a0b860	Artikel	artikel	Artikel teknis, referensi, dan pengetahuan internal tim QC.	2026-10-26 10:03:56.890097+07	2026-10-26 10:03:56.890097+07
a82f9321-daa5-4571-aed5-0ee3a72492f1	Dokumen PDF	dokumen-pdf	Kumpulan dokumen PDF resmi yang dapat diunduh.	2026-10-26 10:03:56.899229+07	2026-10-26 10:03:56.899229+07
\.


--
-- Data for Name: knowledge_documents; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.knowledge_documents (id, title, slug, category_id, description, content_type, pdf_file_path, pdf_original_name, pdf_size_bytes, article_content, is_published, view_count, created_by, published_at, created_at, updated_at) FROM stdin;
fbf3653f-fd08-41e8-968c-e46b09dcf48b	Cara Kalibrasi Harian pH Meter	cara-kalibrasi-harian-ph-meter	7c392c29-5a37-4e4d-808e-a0cd16439782	Langkah kerja kalibrasi harian pH meter menggunakan larutan buffer pH 4, 7, dan 10 beserta kriteria penerimaan.	article	\N	\N	\N	<h2>Tujuan</h2>\n<p>Memastikan akurasi pengukuran pH meter sebelum digunakan pada pengujian sampel rutin di laboratorium QC.</p>\n<h2>Alat dan Bahan</h2>\n<ul>\n  <li>pH meter terkalibrasi</li>\n  <li>Larutan buffer pH 4,00 / 7,00 / 10,00</li>\n  <li>Aquadest dan tissue lembut</li>\n  <li>Beaker glass 50 mL</li>\n</ul>\n<h2>Langkah Kerja</h2>\n<ol>\n  <li>Nyalakan pH meter dan biarkan stabil selama 30 menit.</li>\n  <li>Bilas elektroda dengan aquadest, lalu keringkan dengan tissue.</li>\n  <li>Celupkan elektroda ke buffer pH 7,00 dan tekan tombol CAL.</li>\n  <li>Ulangi untuk buffer pH 4,00 dan pH 10,00 sesuai instruksi alat.</li>\n  <li>Catat slope hasil kalibrasi pada logbook instrumen.</li>\n</ol>\n<h2>Kriteria Penerimaan</h2>\n<table>\n  <thead><tr><th>Parameter</th><th>Kriteria</th></tr></thead>\n  <tbody>\n    <tr><td>Slope</td><td>95% - 105%</td></tr>\n    <tr><td>Offset</td><td>± 30 mV</td></tr>\n  </tbody>\n</table>\n<blockquote>Jika slope di luar rentang, lakukan pembersihan elektroda dan ulangi kalibrasi. Bila masih gagal, ajukan perbaikan ke tim metrologi.</blockquote>	t	128	fa7fd5ee-2859-4c17-8fd1-a3e2cb7cc84c	2026-10-23 10:03:56.940604+07	2026-10-23 10:03:56.940604+07	2026-10-23 10:03:56.940604+07
333147df-abdb-4fb5-a46f-0e1bbf3287bb	SOP Penerimaan Sampel dan Reagen	sop-penerimaan-sampel-dan-reagen	ab776f04-6bbe-4e51-ab51-f16bfbe3d5f4	Prosedur penerimaan, verifikasi, dan penyimpanan sampel serta reagen yang masuk ke laboratorium QC.	article	\N	\N	\N	<h2>Ruang Lingkup</h2>\n<p>SOP ini berlaku untuk seluruh penerimaan sampel, reagen, dan reference standard di laboratorium QC.</p>\n<h2>Prosedur</h2>\n<ol>\n  <li>Petugas menerima paket dan memeriksa kondisi kemasan serta suhu penyimpanan.</li>\n  <li>Verifikasi dokumen pengiriman: nama produk, nomor batch, tanggal kedaluwarsa, dan COA.</li>\n  <li>Catat penerimaan pada sistem inventory dan tempel label status karantina.</li>\n  <li>Lakukan pemeriksaan visual terhadap warna, bentuk, dan integritas kemasan.</li>\n  <li>Simpan pada suhu yang disyaratkan dan update status menjadi released setelah verifikasi QC selesai.</li>\n</ol>\n<h2>Dokumen Terkait</h2>\n<ul>\n  <li>Form Penerimaan Barang (QC-FRM-001)</li>\n  <li>Logbook Suhu Penyimpanan (QC-FRM-014)</li>\n</ul>	t	342	fa7fd5ee-2859-4c17-8fd1-a3e2cb7cc84c	2026-10-18 10:03:56.962312+07	2026-10-18 10:03:56.962312+07	2026-10-18 10:03:56.962312+07
3eb4070e-783d-4b26-be1a-01246bf6e387	Troubleshooting HPLC: Baseline Noise Tinggi	troubleshooting-hplc-baseline-noise-tinggi	ec3d5b1f-f8f4-4ff6-9157-5971bc36626b	Panduan identifikasi penyebab dan tindakan koreksi ketika baseline HPLC menunjukkan noise yang tinggi.	article	\N	\N	\N	<h2>Gejala</h2>\n<p>Baseline kromatogram tidak stabil dengan fluktuasi sinyal melebihi 2 mAU pada kondisi isokratik.</p>\n<h2>Kemungkinan Penyebab</h2>\n<ul>\n  <li>Gelembung udara pada jalur pelarut atau pompa.</li>\n  <li>Lampu detektor mendekati batas umur pakai.</li>\n  <li>Kontaminasi pada kolom atau frit.</li>\n  <li>Fase gerak yang belum terdegas dengan baik.</li>\n</ul>\n<h2>Tindakan Koreksi</h2>\n<ol>\n  <li>Lakukan purging pada pompa selama 5 menit dengan laju 3 mL/menit.</li>\n  <li>Degas fase gerak menggunakan ultrasonik selama 15 menit.</li>\n  <li>Flush kolom dengan fase gerak baru sebanyak 20 kolom volume.</li>\n  <li>Periksa jam pemakaian lampu detektor pada menu diagnostik.</li>\n  <li>Jika noise masih tinggi, eskalasi ke teknisi instrumen.</li>\n</ol>	t	201	fa7fd5ee-2859-4c17-8fd1-a3e2cb7cc84c	2026-10-12 10:03:56.965488+07	2026-10-12 10:03:56.965488+07	2026-10-12 10:03:56.965488+07
71fb67c3-acff-45e8-af5b-17956792b0cd	Manual Penggunaan Analytical Balance	manual-penggunaan-analytical-balance	86ea8046-13bb-4848-95ce-ce9a439bbfe1	Panduan operasional analytical balance 0,1 mg termasuk prosedur leveling, kalibrasi internal, dan perawatan rutin.	pdf	knowledge/2026/10/3954feee-0195-46b2-b364-d9638c41cb62.pdf	manual-penggunaan-analytical-balance.pdf	3372	\N	t	95	fa7fd5ee-2859-4c17-8fd1-a3e2cb7cc84c	2026-10-05 10:03:57.010238+07	2026-10-05 10:03:57.010238+07	2026-10-05 10:03:57.010238+07
22fbb11d-5c7d-4bad-b88e-a9f0a24b2030	SOP Pengendalian Dokumen Laboratorium	sop-pengendalian-dokumen-laboratorium	a82f9321-daa5-4571-aed5-0ee3a72492f1	Dokumen resmi pengendalian dokumen QC meliputi penerbitan, revisi, distribusi, dan penarikan dokumen kedaluwarsa.	pdf	knowledge/2026/10/fdc45f83-6360-4f7d-9745-a4ceadd63c61.pdf	sop-pengendalian-dokumen-laboratorium.pdf	3373	\N	t	77	fa7fd5ee-2859-4c17-8fd1-a3e2cb7cc84c	2026-09-26 10:03:57.016116+07	2026-09-26 10:03:57.016116+07	2026-09-26 10:03:57.016116+07
f3135f1c-c2ef-4a0d-a84a-d802e6d87729	Kalibrasi dan Verifikasi Pipet Mikro	kalibrasi-dan-verifikasi-pipet-mikro	a82f9321-daa5-4571-aed5-0ee3a72492f1	Prosedur kalibrasi pipet mikro volume 10-1000 µL dengan metode gravimetri dan toleransi penerimaan.	pdf	knowledge/2026/10/1ed4c367-51be-48dd-9bc7-8a85beb566bb.pdf	kalibrasi-dan-verifikasi-pipet-mikro.pdf	3357	\N	t	70	fa7fd5ee-2859-4c17-8fd1-a3e2cb7cc84c	2026-10-15 10:03:57.023588+07	2026-10-15 10:03:57.023588+07	2026-10-26 11:30:22.623039+07
fca0e6cd-f11a-429c-95c3-ef4fe176354c	Draft: Panduan Penggunaan Software LIMS	draft-panduan-penggunaan-software-lims	998ec288-f3de-4447-86a3-5b3552a0b860	Draf panduan internal penggunaan modul sample login dan result entry pada LIMS. Belum dipublikasikan.	article	\N	\N	\N	<h2>Status Dokumen</h2>\r\n<p>Dokumen ini masih dalam tahap review oleh tim QC sebelum dipublikasikan ke Knowledge Center.</p>\r\n<h2>Rencana Isi</h2>\r\n<ul>\r\n  <li>Pengenalan antarmuka LIMS</li>\r\n  <li>Alur sample login</li>\r\n  <li>Input hasil pengujian</li>\r\n  <li>Review dan approval hasil</li>\r\n</ul>	f	0	fa7fd5ee-2859-4c17-8fd1-a3e2cb7cc84c	\N	2026-10-25 10:03:57.037925+07	2026-10-26 10:14:44.811268+07
5184573e-01c7-4e5d-8e06-7bbf1bf4ad0e	FAQ: Bagaimana cara mengajukan Purchase Request?	faq-bagaimana-cara-mengajukan-purchase-request	64fcede3-7fd1-421e-b761-33e2229aa3cd	Ringkasan alur pengajuan Purchase Request, persyaratan lampiran, dan cara tracking status pengajuan.	article	\N	\N	\N	<h2>Apakah saya perlu login untuk mengajukan PR?</h2>\n<p>Tidak. Seluruh user internal dapat mengajukan Purchase Request tanpa login melalui menu Administration Center &rarr; Purchase Request.</p>\n<h2>Dokumen apa yang wajib dilampirkan?</h2>\n<p>Bukti SPV Approve Pemesanan wajib diunggah dalam format PDF, JPG, JPEG, atau PNG dengan ukuran maksimal 10 MB. Dokumen penawaran bersifat opsional.</p>\n<h2>Bagaimana cara tracking status?</h2>\n<p>Setelah submit, sistem menampilkan nomor referensi dengan format <strong>PR-YYYYMMDD-XXXX</strong>. Simpan nomor tersebut dan gunakan menu Tracking PR untuk melihat status terkini.</p>\n<h2>Berapa lama proses persetujuan?</h2>\n<p>Target proses review adalah 2 hari kerja. Status akan berubah dari Submitted menjadi Review, kemudian Approved atau Rejected.</p>	t	413	fa7fd5ee-2859-4c17-8fd1-a3e2cb7cc84c	2026-10-24 10:03:56.969569+07	2026-10-24 10:03:56.969569+07	2026-10-26 10:23:13.174528+07
38fcbad2-206a-4430-b01a-9a7b56b57c77	WI QO-QA-1063 Manajemen Akses Pengguna	wi-qo-qa-1063-manajemen-akses-pengguna	7c392c29-5a37-4e4d-808e-a0cd16439782	WI QO-QA-1063 Manajemen Akses Pengguna	pdf	knowledge/2026/10/d3361b8c-353d-4f23-b1a6-15c66fe761ae-1792993455.pdf	Uncontrolled Copy WI-QO-QA-1063.00 Manajemen Akses Pengguna.pdf	4078613	\N	t	11	fa7fd5ee-2859-4c17-8fd1-a3e2cb7cc84c	2026-10-26 12:45:13.824629+07	2026-10-26 12:44:15.644988+07	2026-10-26 13:44:28.634034+07
\.


--
-- Data for Name: purchase_request_status_history; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.purchase_request_status_history (id, purchase_request_id, status, notes, changed_by, created_at) FROM stdin;
5d2c4a2e-f5d9-40d1-9551-0c65d8f1de65	b3519b83-7821-47d1-9d4f-222b732a93a7	Submitted	Purchase Request dibuat	\N	2026-06-01 10:03:57.157441+07
5955ce00-f82f-4be2-bbee-2a694d5e4d9c	b3519b83-7821-47d1-9d4f-222b732a93a7	Closed	Barang sudah diterima dan disimpan di gudang reagen.	\N	2026-06-02 10:03:57.157441+07
0ea98f45-2b15-4f52-9e8f-981941b5c396	7ff86f22-3895-4a4d-a277-6b9dc3d9ba15	Submitted	Purchase Request dibuat	\N	2026-06-12 10:03:57.223031+07
814ce4c5-a7fa-4f71-aa89-602b212174e9	7ff86f22-3895-4a4d-a277-6b9dc3d9ba15	Received	Diterima lengkap 20 box.	\N	2026-06-13 10:03:57.223031+07
74568ba3-7820-4f07-a3cb-310e2bc1331b	dff2462b-289d-4bb0-930a-5cd7299a320a	Submitted	Purchase Request dibuat	\N	2026-06-25 10:03:57.240431+07
48162ada-2f6a-4f76-a41a-f45cbad971d2	dff2462b-289d-4bb0-930a-5cd7299a320a	Ordered	PO dikirim ke vendor, estimasi tiba 5 hari kerja.	\N	2026-06-26 10:03:57.240431+07
096efbe5-5ff9-4eec-8c89-d4b5f88f8ff0	e9bbbe6f-5369-45b0-b23b-cf98cffece3e	Submitted	Purchase Request dibuat	\N	2026-07-08 10:03:57.274287+07
a8522ddd-1a7b-4f2d-bf52-1b55eccb8780	e9bbbe6f-5369-45b0-b23b-cf98cffece3e	Approved	Disetujui, menunggu proses pengadaan.	\N	2026-07-09 10:03:57.274287+07
ed5b86e7-ed45-440f-93d8-c51e2611779d	be1c3abf-e8a2-4951-ba76-808f7778e100	Submitted	Purchase Request dibuat	\N	2026-07-19 10:03:57.287276+07
d689a393-4bdc-4915-a15a-931f12843d01	be1c3abf-e8a2-4951-ba76-808f7778e100	Review	Sedang diverifikasi oleh tim QC.	\N	2026-07-20 10:03:57.287276+07
3b9b7db6-d537-4b71-9583-dcceb7b881a2	8ad19771-37ec-43d9-b8d2-8098e202ea37	Submitted	Purchase Request dibuat	\N	2026-08-02 10:03:57.300141+07
9d1880d7-93c1-4350-8405-1c4107fa0770	41c78252-8d04-42ca-88ad-4256b7e0541f	Submitted	Purchase Request dibuat	\N	2026-08-15 10:03:57.306614+07
c8e9d629-52c0-473a-a435-2793f08e2922	41c78252-8d04-42ca-88ad-4256b7e0541f	Approved	Approved oleh SPV, menunggu PO.	\N	2026-08-16 10:03:57.306614+07
1a3f6428-028e-475b-af82-b1283f0e8b24	0d5b77dc-5e92-4f6c-a59c-75ab4f76097d	Submitted	Purchase Request dibuat	\N	2026-08-28 10:03:57.317524+07
4a29cd30-808c-420c-ba7d-605eba1fb042	0d5b77dc-5e92-4f6c-a59c-75ab4f76097d	Rejected	Ditolak karena anggaran periode ini sudah terpakai.	\N	2026-08-29 10:03:57.317524+07
6f16b722-95a8-4af3-9d0a-6cb35e9b705a	b2072158-6ffb-4adc-836f-0a40538d77d5	Submitted	Purchase Request dibuat	\N	2026-09-10 10:03:57.340513+07
ced903fb-7c55-4046-9110-be6847fe343b	b2072158-6ffb-4adc-836f-0a40538d77d5	Closed	Diterima dan didistribusikan ke lab.	\N	2026-09-11 10:03:57.340513+07
699e25e5-56a7-434a-bea4-974c243d7e72	056cd8bd-a8bc-4a48-aa65-e11a12b02cea	Submitted	Purchase Request dibuat	\N	2026-09-22 10:03:57.354598+07
6fc7b984-39c0-49db-aacd-499101f60794	056cd8bd-a8bc-4a48-aa65-e11a12b02cea	Received	Diterima 15 pack.	\N	2026-09-23 10:03:57.354598+07
eb22af20-f695-460c-bef6-1e6830c6e573	d7a7ec9d-d9a0-4f19-b71d-ba60a14786ce	Submitted	Purchase Request dibuat	\N	2026-10-01 10:03:57.359791+07
35a75c17-9f36-4887-8fcc-7592f58a3ca4	d7a7ec9d-d9a0-4f19-b71d-ba60a14786ce	Ordered	PO dikirim, estimasi 7 hari.	\N	2026-10-02 10:03:57.359791+07
b6497177-d317-4ab4-a8bb-3d15eacc7a90	f27a13b1-c267-481b-b1da-ed1774fc76f0	Submitted	Purchase Request dibuat	\N	2026-10-12 10:03:57.401942+07
c363d5be-dcb8-495c-ba69-a8bc4cbb1271	f27a13b1-c267-481b-b1da-ed1774fc76f0	Review	Menunggu verifikasi spesifikasi.	\N	2026-10-13 10:03:57.401942+07
fac1ddba-34f8-4855-82ba-3d0b807fd566	2f592b6a-412a-458b-9ab9-fa3ed08d581a	Submitted	Purchase Request dibuat	\N	2026-10-20 10:03:57.428653+07
0b9ce100-3d06-4dd8-a888-4a24686003cb	88dfd617-33b6-494d-9ebb-0a206d7efb42	Submitted	Purchase Request dibuat	\N	2026-10-24 10:03:57.444269+07
\.


--
-- Data for Name: purchase_requests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.purchase_requests (id, reference_number, description, order_type, custom_order_type, brand_catalog, quantity, requester_name, reason, status, internal_notes, created_at, updated_at) FROM stdin;
b3519b83-7821-47d1-9d4f-222b732a93a7	PR-20260601-0001	Pembelian reagen buffer pH 7,00 untuk kebutuhan pengujian harian	Reagen	\N	MERCK 1.098439.1000	6	Rina Wulandari	Stok buffer pH 7,00 tersisa 1 botol dan kebutuhan pengujian meningkat.	Closed	Barang sudah diterima dan disimpan di gudang reagen.	2026-06-01 10:03:57.157441+07	2026-06-01 10:03:57.157441+07
7ff86f22-3895-4a4d-a277-6b9dc3d9ba15	PR-20260612-0002	Pengadaan tips pipet 1000 µL steril	Tools Mikro	\N	AXYGEN T-1000-B	20	Budi Santoso	Tips pipet habis akibat penambahan beban pengujian mikrobiologi.	Received	Diterima lengkap 20 box.	2026-06-12 10:03:57.223031+07	2026-06-12 10:03:57.223031+07
dff2462b-289d-4bb0-930a-5cd7299a320a	PR-20260625-0003	Pembelian gas nitrogen untuk GC	Gas	\N	SAMATOR N2 99.999%	2	Andi Pratama	Stok gas nitrogen tersisa 1 tabung, kebutuhan analisis GC mingguan.	Ordered	PO dikirim ke vendor, estimasi tiba 5 hari kerja.	2026-06-25 10:03:57.240431+07	2026-06-25 10:03:57.240431+07
e9bbbe6f-5369-45b0-b23b-cf98cffece3e	PR-20260708-0004	Pengadaan kolom HPLC C18	Lain-Lain	Spare Part Instrumen	WATERS WAT054275	1	Siti Nurhaliza	Kolom HPLC mengalami penurunan resolusi dan perlu penggantian.	Approved	Disetujui, menunggu proses pengadaan.	2026-07-08 10:03:57.274287+07	2026-07-08 10:03:57.274287+07
be1c3abf-e8a2-4951-ba76-808f7778e100	PR-20260719-0005	Pembelian reference standard untuk uji kadar	RS/Reference Standard	\N	USP 1234567	2	Dewi Lestari	Reference standard yang ada mendekati tanggal kedaluwarsa.	Review	Sedang diverifikasi oleh tim QC.	2026-07-19 10:03:57.287276+07	2026-07-19 10:03:57.287276+07
8ad19771-37ec-43d9-b8d2-8098e202ea37	PR-20260802-0006	Pengadaan alat gelas laboratorium	Expense Item	\N	IWAKI 5000-100	12	Fajar Nugroho	Beaker glass pecah saat proses pencucian.	Submitted	\N	2026-08-02 10:03:57.300141+07	2026-08-02 10:03:57.300141+07
41c78252-8d04-42ca-88ad-4256b7e0541f	PR-20260815-0007	Pembelian media kultur mikrobiologi	Reagen Mikro	\N	MERCK 1.054426.0500	8	Rina Wulandari	Kebutuhan media untuk pengujian bioburden bulanan.	Approved	Approved oleh SPV, menunggu PO.	2026-08-15 10:03:57.306614+07	2026-08-15 10:03:57.306614+07
0d5b77dc-5e92-4f6c-a59c-75ab4f76097d	PR-20260828-0008	Analisa external logam berat sampel air	Analisa External	\N	Lab Eksternal - SUCOFINDO	5	Budi Santoso	Kapasitas internal tidak mencukupi untuk parameter logam berat.	Rejected	Ditolak karena anggaran periode ini sudah terpakai.	2026-08-28 10:03:57.317524+07	2026-08-28 10:03:57.317524+07
b2072158-6ffb-4adc-836f-0a40538d77d5	PR-20260910-0009	Pembelian sarung tangan nitrile	Expense Item	\N	ANSELL 92-600	30	Andi Pratama	Stok sarung tangan untuk analis tersisa 5 box.	Closed	Diterima dan didistribusikan ke lab.	2026-09-10 10:03:57.340513+07	2026-09-10 10:03:57.340513+07
056cd8bd-a8bc-4a48-aa65-e11a12b02cea	PR-20260922-0010	Pengadaan vial amber 20 mL	Tools	\N	SCHOTT 2180136	15	Siti Nurhaliza	Kebutuhan vial untuk penyimpanan sampel retain.	Received	Diterima 15 pack.	2026-09-22 10:03:57.354598+07	2026-09-22 10:03:57.354598+07
d7a7ec9d-d9a0-4f19-b71d-ba60a14786ce	PR-20261001-0011	Pembelian reagen untuk uji COD	Reagen	\N	HACH 2125915	4	Dewi Lestari	Reagen COD tersisa 1 set, pengujian limbah meningkat.	Ordered	PO dikirim, estimasi 7 hari.	2026-10-01 10:03:57.359791+07	2026-10-01 10:03:57.359791+07
f27a13b1-c267-481b-b1da-ed1774fc76f0	PR-20261012-0012	Pengadaan kuvet spektrofotometer	Tools	\N	HELLMA 100-10-40	20	Fajar Nugroho	Kuvet lama banyak tergores sehingga mempengaruhi absorbansi.	Review	Menunggu verifikasi spesifikasi.	2026-10-12 10:03:57.401942+07	2026-10-12 10:03:57.401942+07
2f592b6a-412a-458b-9ab9-fa3ed08d581a	PR-20261020-0013	Pembelian kertas saring Whatman	Expense Item	\N	WHATMAN 1001-125	10	Rina Wulandari	Persediaan kertas saring untuk filtrasi sampel menipis.	Submitted	\N	2026-10-20 10:03:57.428653+07	2026-10-20 10:03:57.428653+07
88dfd617-33b6-494d-9ebb-0a206d7efb42	PR-20261024-0014	Pengadaan termometer digital terkalibrasi	Tools Mikro	\N	TESTO 1089764	3	Budi Santoso	Termometer ruang penyimpanan perlu penggantian karena drift.	Submitted	\N	2026-10-24 10:03:57.444269+07	2026-10-24 10:03:57.444269+07
\.


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.schema_migrations (version, applied_at) FROM stdin;
001_init.sql	2026-10-26 09:31:55.895936+07
\.


--
-- Name: admin_users admin_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_pkey PRIMARY KEY (id);


--
-- Name: admin_users admin_users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_username_key UNIQUE (username);


--
-- Name: attachments attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_pkey PRIMARY KEY (id);


--
-- Name: categories categories_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key UNIQUE (name);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: categories categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_slug_key UNIQUE (slug);


--
-- Name: knowledge_documents knowledge_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_documents
    ADD CONSTRAINT knowledge_documents_pkey PRIMARY KEY (id);


--
-- Name: knowledge_documents knowledge_documents_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_documents
    ADD CONSTRAINT knowledge_documents_slug_key UNIQUE (slug);


--
-- Name: purchase_request_status_history purchase_request_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_request_status_history
    ADD CONSTRAINT purchase_request_status_history_pkey PRIMARY KEY (id);


--
-- Name: purchase_requests purchase_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_requests
    ADD CONSTRAINT purchase_requests_pkey PRIMARY KEY (id);


--
-- Name: purchase_requests purchase_requests_reference_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_requests
    ADD CONSTRAINT purchase_requests_reference_number_key UNIQUE (reference_number);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: idx_admin_users_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_users_username ON public.admin_users USING btree (lower((username)::text));


--
-- Name: idx_attachments_purchase_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attachments_purchase_request_id ON public.attachments USING btree (purchase_request_id);


--
-- Name: idx_attachments_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attachments_type ON public.attachments USING btree (attachment_type);


--
-- Name: idx_categories_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_slug ON public.categories USING btree (slug);


--
-- Name: idx_knowledge_category_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_category_id ON public.knowledge_documents USING btree (category_id);


--
-- Name: idx_knowledge_content_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_content_type ON public.knowledge_documents USING btree (content_type);


--
-- Name: idx_knowledge_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_created_by ON public.knowledge_documents USING btree (created_by);


--
-- Name: idx_knowledge_published_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_published_created ON public.knowledge_documents USING btree (is_published, created_at DESC);


--
-- Name: idx_knowledge_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_search ON public.knowledge_documents USING gin (search_vector);


--
-- Name: idx_pr_history_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pr_history_request_id ON public.purchase_request_status_history USING btree (purchase_request_id, created_at DESC);


--
-- Name: idx_purchase_requests_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_requests_created_at ON public.purchase_requests USING btree (created_at DESC);


--
-- Name: idx_purchase_requests_order_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_requests_order_type ON public.purchase_requests USING btree (order_type);


--
-- Name: idx_purchase_requests_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_requests_reference ON public.purchase_requests USING btree (reference_number);


--
-- Name: idx_purchase_requests_requester; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_requests_requester ON public.purchase_requests USING btree (lower((requester_name)::text));


--
-- Name: idx_purchase_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_requests_status ON public.purchase_requests USING btree (status);


--
-- Name: admin_users trg_admin_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_admin_users_updated_at BEFORE UPDATE ON public.admin_users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: categories trg_categories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: knowledge_documents trg_knowledge_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_knowledge_updated_at BEFORE UPDATE ON public.knowledge_documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: purchase_requests trg_purchase_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_purchase_requests_updated_at BEFORE UPDATE ON public.purchase_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: attachments attachments_purchase_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_purchase_request_id_fkey FOREIGN KEY (purchase_request_id) REFERENCES public.purchase_requests(id) ON DELETE CASCADE;


--
-- Name: knowledge_documents knowledge_documents_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_documents
    ADD CONSTRAINT knowledge_documents_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE RESTRICT;


--
-- Name: knowledge_documents knowledge_documents_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_documents
    ADD CONSTRAINT knowledge_documents_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.admin_users(id) ON DELETE SET NULL;


--
-- Name: purchase_request_status_history purchase_request_status_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_request_status_history
    ADD CONSTRAINT purchase_request_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.admin_users(id) ON DELETE SET NULL;


--
-- Name: purchase_request_status_history purchase_request_status_history_purchase_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_request_status_history
    ADD CONSTRAINT purchase_request_status_history_purchase_request_id_fkey FOREIGN KEY (purchase_request_id) REFERENCES public.purchase_requests(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict w13BrSY1lNqkPDb6O4a5L8EDqLhZXuakxFNKn63g0vddX1gxsDOO143sEfGmpaP

