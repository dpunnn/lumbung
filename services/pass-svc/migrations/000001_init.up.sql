CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS pass (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    koperasi_id     UUID NOT NULL,
    token           VARCHAR(64) NOT NULL UNIQUE,
    consent         TEXT[] NOT NULL DEFAULT '{}',
    fields          JSONB NOT NULL DEFAULT '{}',
    hash            VARCHAR(64) NOT NULL,
    tujuan          VARCHAR(200),
    mitra           VARCHAR(200),
    berlaku_sampai  TIMESTAMPTZ NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'aktif',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS receipt (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    koperasi_id UUID NOT NULL,
    tx_type     VARCHAR(30) NOT NULL,
    tx_id       UUID NOT NULL,
    amount      NUMERIC(15,2) NOT NULL,
    approver_id UUID,
    witness_id  UUID,
    prev_hash   VARCHAR(64) NOT NULL DEFAULT '',
    hash        VARCHAR(64) NOT NULL,
    signature   VARCHAR(64) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS processed_events (
    event_id      VARCHAR(36) PRIMARY KEY,
    consumer_name VARCHAR(100) NOT NULL,
    processed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pass_koperasi ON pass(koperasi_id);
CREATE INDEX IF NOT EXISTS idx_pass_token ON pass(token);
CREATE INDEX IF NOT EXISTS idx_receipt_koperasi ON receipt(koperasi_id);
CREATE INDEX IF NOT EXISTS idx_receipt_tx ON receipt(tx_type, tx_id);

-- RLS
ALTER TABLE pass ENABLE ROW LEVEL SECURITY;
CREATE POLICY pass_tenant ON pass USING (koperasi_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE receipt ENABLE ROW LEVEL SECURITY;
CREATE POLICY receipt_tenant ON receipt USING (koperasi_id = current_setting('app.current_tenant', true)::uuid);
