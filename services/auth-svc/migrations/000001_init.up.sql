-- Database lumbung_auth dipakai auth-svc saja.
-- Tabel users tidak memakai RLS per-tenant karena auth bersifat lintas koperasi
-- (super_admin tidak punya tenant). Isolasi dijaga di level endpoint/query.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    koperasi_id   UUID,
    username      VARCHAR(100) NOT NULL,
    email         VARCHAR(200) NOT NULL,
    password_hash VARCHAR(200) NOT NULL,
    role          VARCHAR(50) NOT NULL DEFAULT 'anggota',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at    TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_koperasi
    ON users(email, koperasi_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_koperasi
    ON users(username, koperasi_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_koperasi ON users(koperasi_id);
