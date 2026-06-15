CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS anggota (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    koperasi_id UUID NOT NULL,
    nama        VARCHAR(200) NOT NULL,
    nik_hash    VARCHAR(64),          -- SHA-256 hex NIK
    alamat      TEXT,
    telepon     VARCHAR(20),
    status      VARCHAR(20) NOT NULL DEFAULT 'aktif',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_anggota_koperasi ON anggota(koperasi_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_anggota_nik_koperasi ON anggota(nik_hash, koperasi_id) WHERE nik_hash IS NOT NULL AND deleted_at IS NULL;

-- RLS: isolasi per tenant
ALTER TABLE anggota ENABLE ROW LEVEL SECURITY;
CREATE POLICY anggota_tenant_isolation ON anggota
    USING (koperasi_id = current_setting('app.current_tenant', true)::uuid);
