CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS audit_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    koperasi_id UUID NOT NULL,
    aksi        VARCHAR(20) NOT NULL,
    tabel       VARCHAR(50) NOT NULL,
    record_id   UUID NOT NULL,
    field_diff  JSONB NOT NULL DEFAULT '{}',
    actor_id    UUID,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS anomaly (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    koperasi_id UUID NOT NULL,
    pola        VARCHAR(50) NOT NULL,
    record_id   UUID NOT NULL,
    tabel       VARCHAR(50) NOT NULL,
    keterangan  TEXT NOT NULL,
    severity    VARCHAR(10) NOT NULL DEFAULT 'medium',
    status      VARCHAR(20) NOT NULL DEFAULT 'open',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS processed_events (
    event_id      VARCHAR(36) PRIMARY KEY,
    consumer_name VARCHAR(100) NOT NULL,
    processed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_koperasi ON audit_log(koperasi_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_tabel ON audit_log(tabel, record_id);
CREATE INDEX IF NOT EXISTS idx_anomaly_koperasi ON anomaly(koperasi_id, status);

-- RLS
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_tenant ON audit_log USING (koperasi_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE anomaly ENABLE ROW LEVEL SECURITY;
CREATE POLICY anomaly_tenant ON anomaly USING (koperasi_id = current_setting('app.current_tenant', true)::uuid);
