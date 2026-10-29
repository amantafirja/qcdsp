-- QC Digital Service Portal - integrasi data Oracle (Purchase Order)

-- ---------------------------------------------------------------------------
-- Kolom purchasing pada Purchase Request (diisi otomatis dari file Oracle)
-- ---------------------------------------------------------------------------
ALTER TABLE purchase_requests
    ADD COLUMN IF NOT EXISTS po_number VARCHAR(80),
    ADD COLUMN IF NOT EXISTS po_date DATE,
    ADD COLUMN IF NOT EXISTS po_value NUMERIC(18, 2),
    ADD COLUMN IF NOT EXISTS delivery_estimate_date DATE,
    ADD COLUMN IF NOT EXISTS oracle_synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_pr_po_number ON purchase_requests (po_number);
CREATE INDEX IF NOT EXISTS idx_pr_po_date ON purchase_requests (po_date);

-- ---------------------------------------------------------------------------
-- Riwayat upload file Oracle
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS oracle_imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name VARCHAR(255) NOT NULL,
    uploaded_by UUID REFERENCES admin_users (id) ON DELETE SET NULL,
    uploaded_by_name VARCHAR(150) NOT NULL DEFAULT '',
    total_rows INTEGER NOT NULL DEFAULT 0,
    total_pr INTEGER NOT NULL DEFAULT 0,
    matched_count INTEGER NOT NULL DEFAULT 0,
    synced_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'uploaded',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    synced_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_oracle_imports_created ON oracle_imports (created_at DESC);

-- ---------------------------------------------------------------------------
-- Data PO hasil export Oracle (satu baris per PR, hasil agregasi per line)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS oracle_purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_id UUID NOT NULL REFERENCES oracle_imports (id) ON DELETE CASCADE,
    pr_number VARCHAR(80) NOT NULL,
    po_number VARCHAR(80),
    po_date DATE,
    total_value NUMERIC(18, 2),
    delivery_date DATE,
    line_count INTEGER NOT NULL DEFAULT 0,
    qty_total NUMERIC(18, 2) NOT NULL DEFAULT 0,
    item_summary TEXT,
    raw_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oracle_po_pr_number ON oracle_purchase_orders (pr_number);
CREATE INDEX IF NOT EXISTS idx_oracle_po_import ON oracle_purchase_orders (import_id);
