-- QC Digital Service Portal - initial schema
-- PostgreSQL 14+

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(80) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name VARCHAR(150) NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users (LOWER(username));

DROP TRIGGER IF EXISTS trg_admin_users_updated_at ON admin_users;
CREATE TRIGGER trg_admin_users_updated_at
    BEFORE UPDATE ON admin_users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL UNIQUE,
    slug VARCHAR(150) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories (slug);

DROP TRIGGER IF EXISTS trg_categories_updated_at ON categories;
CREATE TRIGGER trg_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS knowledge_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(300) NOT NULL UNIQUE,
    category_id UUID NOT NULL REFERENCES categories (id) ON DELETE RESTRICT,
    description TEXT NOT NULL DEFAULT '',
    content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('pdf', 'article')),
    pdf_file_path TEXT,
    pdf_original_name VARCHAR(255),
    pdf_size_bytes BIGINT,
    article_content TEXT,
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    view_count INTEGER NOT NULL DEFAULT 0,
    created_by UUID REFERENCES admin_users (id) ON DELETE SET NULL,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    search_vector TSVECTOR GENERATED ALWAYS AS (
        to_tsvector('simple', COALESCE(title, '') || ' ' || COALESCE(description, ''))
    ) STORED,
    CONSTRAINT chk_knowledge_pdf_file CHECK (
        content_type <> 'pdf' OR (pdf_file_path IS NOT NULL AND LENGTH(pdf_file_path) > 0)
    ),
    CONSTRAINT chk_knowledge_article_content CHECK (
        content_type <> 'article' OR (article_content IS NOT NULL AND LENGTH(article_content) > 0)
    ),
    CONSTRAINT chk_knowledge_pdf_size CHECK (
        pdf_size_bytes IS NULL OR pdf_size_bytes <= 10485760
    )
);

CREATE INDEX IF NOT EXISTS idx_knowledge_category_id ON knowledge_documents (category_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_published_created ON knowledge_documents (is_published, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_content_type ON knowledge_documents (content_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_search ON knowledge_documents USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_knowledge_created_by ON knowledge_documents (created_by);

DROP TRIGGER IF EXISTS trg_knowledge_updated_at ON knowledge_documents;
CREATE TRIGGER trg_knowledge_updated_at
    BEFORE UPDATE ON knowledge_documents
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS purchase_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_number VARCHAR(40) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    order_type VARCHAR(50) NOT NULL CHECK (order_type IN (
        'Reagen', 'Tools', 'Expense Item', 'Reagen Mikro', 'Tools Mikro',
        'RS/Reference Standard', 'Gas', 'Analisa External', 'Lain-Lain'
    )),
    custom_order_type VARCHAR(120),
    brand_catalog VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    requester_name VARCHAR(150) NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'Submitted' CHECK (status IN (
        'Submitted', 'Review', 'Approved', 'Rejected', 'Ordered', 'Received', 'Closed'
    )),
    internal_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_pr_custom_order_type CHECK (
        order_type <> 'Lain-Lain' OR (
            custom_order_type IS NOT NULL AND LENGTH(BTRIM(custom_order_type)) > 0
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_purchase_requests_reference ON purchase_requests (reference_number);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_status ON purchase_requests (status);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_created_at ON purchase_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_order_type ON purchase_requests (order_type);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_requester ON purchase_requests (LOWER(requester_name));

DROP TRIGGER IF EXISTS trg_purchase_requests_updated_at ON purchase_requests;
CREATE TRIGGER trg_purchase_requests_updated_at
    BEFORE UPDATE ON purchase_requests
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_request_id UUID NOT NULL REFERENCES purchase_requests (id) ON DELETE CASCADE,
    attachment_type VARCHAR(30) NOT NULL CHECK (attachment_type IN ('spv_approval', 'quotation')),
    original_name VARCHAR(255) NOT NULL,
    stored_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(150) NOT NULL,
    size_bytes BIGINT NOT NULL,
    file_path TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attachments_purchase_request_id ON attachments (purchase_request_id);
CREATE INDEX IF NOT EXISTS idx_attachments_type ON attachments (attachment_type);

CREATE TABLE IF NOT EXISTS purchase_request_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_request_id UUID NOT NULL REFERENCES purchase_requests (id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL CHECK (status IN (
        'Submitted', 'Review', 'Approved', 'Rejected', 'Ordered', 'Received', 'Closed'
    )),
    notes TEXT,
    changed_by UUID REFERENCES admin_users (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pr_history_request_id ON purchase_request_status_history (purchase_request_id, created_at DESC);
