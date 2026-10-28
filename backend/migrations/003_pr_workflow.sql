-- QC Digital Service Portal - PR workflow, item, consolidation, audit, soft delete

-- ---------------------------------------------------------------------------
-- Counter nomor PR: PRG/1GQ01/MMYY/XXXXX, reset setiap bulan
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pr_number_counters (
    period CHAR(4) PRIMARY KEY,
    last_number INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Item PR (satu PR dapat memiliki banyak item)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_request_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_request_id UUID NOT NULL REFERENCES purchase_requests (id) ON DELETE CASCADE,
    item_name VARCHAR(255) NOT NULL,
    brand_catalog VARCHAR(255) NOT NULL DEFAULT '',
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit VARCHAR(50) NOT NULL DEFAULT 'unit',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pr_items_request_id ON purchase_request_items (purchase_request_id);
CREATE INDEX IF NOT EXISTS idx_pr_items_created_at ON purchase_request_items (created_at);

-- ---------------------------------------------------------------------------
-- Kolom penggabungan + soft delete
-- ---------------------------------------------------------------------------
ALTER TABLE purchase_requests
    ADD COLUMN IF NOT EXISTS master_pr_id UUID REFERENCES purchase_requests (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS merged_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS merged_by UUID REFERENCES admin_users (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES admin_users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pr_master_pr_id ON purchase_requests (master_pr_id);
CREATE INDEX IF NOT EXISTS idx_pr_deleted_at ON purchase_requests (deleted_at);

-- ---------------------------------------------------------------------------
-- Audit trail
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_request_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_request_id UUID NOT NULL REFERENCES purchase_requests (id) ON DELETE CASCADE,
    action VARCHAR(40) NOT NULL,
    actor_id UUID REFERENCES admin_users (id) ON DELETE SET NULL,
    actor_name VARCHAR(150) NOT NULL DEFAULT '',
    actor_role VARCHAR(30) NOT NULL DEFAULT 'user',
    notes TEXT,
    before_data JSONB,
    after_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pr_audit_request ON purchase_request_audit_logs (purchase_request_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pr_audit_action ON purchase_request_audit_logs (action);

-- ---------------------------------------------------------------------------
-- Backfill item dari data lama (satu PR = satu item)
-- ---------------------------------------------------------------------------
INSERT INTO purchase_request_items (purchase_request_id, item_name, brand_catalog, quantity, unit, created_at)
SELECT p.id,
       COALESCE(NULLIF(BTRIM(p.description), ''), p.reference_number),
       COALESCE(p.brand_catalog, ''),
       GREATEST(p.quantity, 1),
       'unit',
       p.created_at
FROM purchase_requests p
WHERE NOT EXISTS (
    SELECT 1 FROM purchase_request_items i WHERE i.purchase_request_id = p.id
);

-- ---------------------------------------------------------------------------
-- Remap status lama ke workflow baru
-- ---------------------------------------------------------------------------
ALTER TABLE purchase_requests DROP CONSTRAINT IF EXISTS purchase_requests_status_check;
ALTER TABLE purchase_request_status_history DROP CONSTRAINT IF EXISTS purchase_request_status_history_status_check;

UPDATE purchase_requests
SET status = CASE status
    WHEN 'Submitted' THEN 'form_created'
    WHEN 'Review' THEN 'op_penawaran'
    WHEN 'Approved' THEN 'op_manager'
    WHEN 'Rejected' THEN 'rejected'
    WHEN 'Ordered' THEN 'pending_po'
    WHEN 'Received' THEN 'po_approve'
    WHEN 'Closed' THEN 'done'
    ELSE status
END
WHERE status IN ('Submitted', 'Review', 'Approved', 'Rejected', 'Ordered', 'Received', 'Closed');

UPDATE purchase_request_status_history
SET status = CASE status
    WHEN 'Submitted' THEN 'form_created'
    WHEN 'Review' THEN 'op_penawaran'
    WHEN 'Approved' THEN 'op_manager'
    WHEN 'Rejected' THEN 'rejected'
    WHEN 'Ordered' THEN 'pending_po'
    WHEN 'Received' THEN 'po_approve'
    WHEN 'Closed' THEN 'done'
    ELSE status
END
WHERE status IN ('Submitted', 'Review', 'Approved', 'Rejected', 'Ordered', 'Received', 'Closed');

ALTER TABLE purchase_requests
    ADD CONSTRAINT purchase_requests_status_check CHECK (status IN (
        'form_created', 'op_penawaran', 'op_proposal', 'op_manager',
        'pending_po', 'po_approve', 'done', 'rejected', 'cancelled'
    ));

ALTER TABLE purchase_request_status_history
    ADD CONSTRAINT purchase_request_status_history_status_check CHECK (status IN (
        'form_created', 'op_penawaran', 'op_proposal', 'op_manager',
        'pending_po', 'po_approve', 'done', 'rejected', 'cancelled'
    ));

-- ---------------------------------------------------------------------------
-- Renumber nomor PR lama ke format baru + sinkronkan counter
-- ---------------------------------------------------------------------------
WITH ranked AS (
    SELECT p.id,
           'PRG/1GQ01/' || TO_CHAR(p.created_at, 'MMYY') || '/' ||
           LPAD(ROW_NUMBER() OVER (
               PARTITION BY TO_CHAR(p.created_at, 'MMYY')
               ORDER BY p.created_at, p.id
           )::TEXT, 5, '0') AS new_reference
    FROM purchase_requests p
)
UPDATE purchase_requests p
SET reference_number = ranked.new_reference
FROM ranked
WHERE p.id = ranked.id;

INSERT INTO pr_number_counters (period, last_number)
SELECT TO_CHAR(created_at, 'MMYY'), COUNT(*)
FROM purchase_requests
GROUP BY TO_CHAR(created_at, 'MMYY')
ON CONFLICT (period) DO UPDATE
SET last_number = GREATEST(pr_number_counters.last_number, EXCLUDED.last_number),
    updated_at = NOW();

-- Selaraskan nama file lampiran SPV lama dengan nomor PR format baru
UPDATE attachments a
SET original_name = 'SPV-Approval-' || REPLACE(p.reference_number, '/', '-') || '.pdf'
FROM purchase_requests p
WHERE a.purchase_request_id = p.id
  AND a.attachment_type = 'spv_approval';

-- ---------------------------------------------------------------------------
-- Audit awal untuk data lama
-- ---------------------------------------------------------------------------
INSERT INTO purchase_request_audit_logs (
    purchase_request_id, action, actor_name, actor_role, notes, after_data, created_at
)
SELECT p.id,
       'created',
       p.requester_name,
       'user',
       'Purchase Request dibuat',
       jsonb_build_object(
           'reference_number', p.reference_number,
           'status', p.status,
           'order_type', p.order_type,
           'items', (
               SELECT jsonb_agg(jsonb_build_object(
                   'item_name', i.item_name,
                   'brand_catalog', i.brand_catalog,
                   'quantity', i.quantity,
                   'unit', i.unit
               ))
               FROM purchase_request_items i
               WHERE i.purchase_request_id = p.id
           )
       ),
       p.created_at
FROM purchase_requests p
WHERE NOT EXISTS (
    SELECT 1 FROM purchase_request_audit_logs a
    WHERE a.purchase_request_id = p.id AND a.action = 'created'
);

-- ---------------------------------------------------------------------------
-- Kolom lama tidak dipakai lagi (item sudah dipindah ke purchase_request_items)
-- ---------------------------------------------------------------------------
ALTER TABLE purchase_requests DROP COLUMN IF EXISTS brand_catalog;
ALTER TABLE purchase_requests DROP COLUMN IF EXISTS quantity;
