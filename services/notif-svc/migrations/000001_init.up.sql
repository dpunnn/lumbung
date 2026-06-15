CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS notifikasi (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    koperasi_id UUID NOT NULL,
    user_id     UUID,
    tipe        VARCHAR(30) NOT NULL,
    judul       VARCHAR(200) NOT NULL,
    pesan       TEXT NOT NULL,
    dibaca      BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS processed_events (
    event_id      VARCHAR(36) PRIMARY KEY,
    consumer_name VARCHAR(100) NOT NULL,
    processed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_koperasi ON notifikasi(koperasi_id, dibaca, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifikasi(user_id) WHERE user_id IS NOT NULL;

ALTER TABLE notifikasi ENABLE ROW LEVEL SECURITY;
CREATE POLICY notif_tenant ON notifikasi
    USING (koperasi_id = current_setting('app.current_tenant', true)::uuid);
