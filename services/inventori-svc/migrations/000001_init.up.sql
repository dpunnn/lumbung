CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS stok_item (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    koperasi_id UUID NOT NULL,
    komoditas   VARCHAR(50) NOT NULL,
    nama        VARCHAR(200) NOT NULL,
    satuan      VARCHAR(20) NOT NULL,
    jumlah      NUMERIC(15,3) NOT NULL DEFAULT 0,
    mutu        VARCHAR(5),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS intake_batch (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    koperasi_id  UUID NOT NULL,
    anggota_id   UUID NOT NULL,
    komoditas    VARCHAR(50) NOT NULL,
    jumlah       NUMERIC(15,3) NOT NULL,
    mutu         VARCHAR(5),
    skor         NUMERIC(5,2),
    foto_url     TEXT,
    receipt_hash VARCHAR(64),
    ai_mode      VARCHAR(20) NOT NULL DEFAULT 'server',
    status       VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pengadaan (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    koperasi_id UUID NOT NULL,
    komoditas   VARCHAR(50) NOT NULL,
    jumlah      NUMERIC(15,3) NOT NULL,
    satuan      VARCHAR(20) NOT NULL,
    harga       NUMERIC(15,2) NOT NULL,
    supplier    VARCHAR(200),
    status      VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS processed_events (
    event_id      VARCHAR(36) PRIMARY KEY,
    consumer_name VARCHAR(100) NOT NULL,
    processed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stok_koperasi ON stok_item(koperasi_id);
CREATE INDEX IF NOT EXISTS idx_intake_koperasi ON intake_batch(koperasi_id);
CREATE INDEX IF NOT EXISTS idx_pengadaan_koperasi ON pengadaan(koperasi_id);

-- RLS
ALTER TABLE stok_item ENABLE ROW LEVEL SECURITY;
CREATE POLICY stok_tenant ON stok_item USING (koperasi_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE intake_batch ENABLE ROW LEVEL SECURITY;
CREATE POLICY intake_tenant ON intake_batch USING (koperasi_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE pengadaan ENABLE ROW LEVEL SECURITY;
CREATE POLICY pengadaan_tenant ON pengadaan USING (koperasi_id = current_setting('app.current_tenant', true)::uuid);
