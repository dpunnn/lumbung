CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS produk (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    koperasi_id UUID NOT NULL,
    slug        VARCHAR(200) NOT NULL,
    nama        VARCHAR(300) NOT NULL,
    deskripsi   TEXT,
    harga       NUMERIC(15,2) NOT NULL,
    stok        INT NOT NULL DEFAULT 0,
    kategori    VARCHAR(50) NOT NULL DEFAULT 'ternak',
    foto_url    TEXT,
    aktif       BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS orders (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    koperasi_id    UUID NOT NULL,
    pembeli_nama   VARCHAR(200) NOT NULL,
    pembeli_email  VARCHAR(200),
    total          NUMERIC(15,2) NOT NULL,
    status         VARCHAR(30) NOT NULL DEFAULT 'pending',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_item (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id   UUID NOT NULL REFERENCES orders(id),
    produk_id  UUID NOT NULL,
    qty        INT NOT NULL,
    harga      NUMERIC(15,2) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_produk_slug ON produk(slug) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_produk_koperasi ON produk(koperasi_id, aktif) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_orders_koperasi ON orders(koperasi_id);
CREATE INDEX IF NOT EXISTS idx_order_item_order ON order_item(order_id);

-- RLS: produk punya dua mode akses:
--  - Publik (catalog): app.current_tenant kosong -> policy lolos (lihat semua).
--  - Admin CRUD: app.current_tenant terisi -> hanya produk koperasi sendiri.
ALTER TABLE produk ENABLE ROW LEVEL SECURITY;
CREATE POLICY produk_tenant ON produk
    USING (koperasi_id = current_setting('app.current_tenant', true)::uuid
           OR current_setting('app.current_tenant', true) = '');

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY orders_tenant ON orders
    USING (koperasi_id = current_setting('app.current_tenant', true)::uuid);

-- order_item mengikuti tenant order induknya.
ALTER TABLE order_item ENABLE ROW LEVEL SECURITY;
CREATE POLICY order_item_tenant ON order_item
    USING (order_id IN (SELECT id FROM orders
                        WHERE koperasi_id = current_setting('app.current_tenant', true)::uuid)
           OR current_setting('app.current_tenant', true) = '');
