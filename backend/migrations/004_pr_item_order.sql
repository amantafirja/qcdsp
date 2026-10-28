-- QC Digital Service Portal - urutan item PR

ALTER TABLE purchase_request_items
    ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

WITH ordered AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY purchase_request_id
               ORDER BY created_at, item_name, id
           ) AS position
    FROM purchase_request_items
)
UPDATE purchase_request_items i
SET sort_order = ordered.position
FROM ordered
WHERE i.id = ordered.id
  AND i.sort_order = 0;

CREATE INDEX IF NOT EXISTS idx_pr_items_order ON purchase_request_items (purchase_request_id, sort_order);
