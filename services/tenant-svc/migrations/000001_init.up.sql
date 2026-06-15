CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS koperasi (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama       VARCHAR(200) NOT NULL,
    jenis      VARCHAR(50) NOT NULL DEFAULT 'ternak', -- ternak|sayur|beras|pupuk|air
    komoditas  VARCHAR(100),
    modules    TEXT[] NOT NULL DEFAULT '{}',           -- modul aktif
    wilayah    VARCHAR(200),
    alamat     TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_koperasi_jenis ON koperasi(jenis) WHERE deleted_at IS NULL;
