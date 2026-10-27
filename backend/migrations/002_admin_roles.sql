-- QC Digital Service Portal - role tambahan untuk akun view-only Purchase Request

ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS admin_users_role_check;

ALTER TABLE admin_users
    ADD CONSTRAINT admin_users_role_check
    CHECK (role IN ('super_admin', 'admin', 'pr_viewer'));

CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users (role);
