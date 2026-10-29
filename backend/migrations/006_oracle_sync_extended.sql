-- QC Digital Service Portal - Oracle Sync lanjutan (multi PO, dedupe, status, log)

-- ---------------------------------------------------------------------------
-- Kolom tambahan pada Purchase Request
-- ---------------------------------------------------------------------------
ALTER TABLE purchase_requests
    ADD COLUMN IF NOT EXISTS po_list JSONB,
    ADD COLUMN IF NOT EXISTS po_source VARCHAR(20) NOT NULL DEFAULT 'oracle',
    ADD COLUMN IF NOT EXISTS po_manual_override BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS oracle_sync_status VARCHAR(30),
    ADD COLUMN IF NOT EXISTS oracle_last_sync_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_pr_oracle_sync_status ON purchase_requests (oracle_sync_status);

-- ---------------------------------------------------------------------------
-- Ringkasan per PR pada dataset Oracle terakhir
-- ---------------------------------------------------------------------------
ALTER TABLE oracle_purchase_orders
    ADD COLUMN IF NOT EXISTS po_list JSONB,
    ADD COLUMN IF NOT EXISTS duplicate_lines INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS multi_line BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS multi_po BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS needs_review BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS sync_status VARCHAR(30);

CREATE INDEX IF NOT EXISTS idx_oracle_po_sync_status ON oracle_purchase_orders (sync_status);

-- ---------------------------------------------------------------------------
-- Statistik tambahan pada riwayat upload
-- ---------------------------------------------------------------------------
ALTER TABLE oracle_imports
    ADD COLUMN IF NOT EXISTS duplicate_rows INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS multi_line_prs INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS multi_po_prs INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS needs_review_prs INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS not_found_prs INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS updated_prs INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS file_size BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sync_count INTEGER NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- Riwayat & log sinkronisasi
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS oracle_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_id UUID NOT NULL REFERENCES oracle_imports (id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    actor_id UUID REFERENCES admin_users (id) ON DELETE SET NULL,
    actor_name VARCHAR(150) NOT NULL DEFAULT '',
    actor_role VARCHAR(30) NOT NULL DEFAULT 'admin',
    trigger VARCHAR(30) NOT NULL DEFAULT 'manual',
    total_rows INTEGER NOT NULL DEFAULT 0,
    total_pr INTEGER NOT NULL DEFAULT 0,
    matched INTEGER NOT NULL DEFAULT 0,
    not_found INTEGER NOT NULL DEFAULT 0,
    updated INTEGER NOT NULL DEFAULT 0,
    duplicates INTEGER NOT NULL DEFAULT 0,
    multi_line INTEGER NOT NULL DEFAULT 0,
    multi_po INTEGER NOT NULL DEFAULT 0,
    needs_review INTEGER NOT NULL DEFAULT 0,
    skipped_manual INTEGER NOT NULL DEFAULT 0,
    status_changed INTEGER NOT NULL DEFAULT 0,
    result_data JSONB,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_oracle_sync_logs_started ON oracle_sync_logs (started_at DESC);
