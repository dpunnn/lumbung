-- Tabel inventori item: inventaris umum koperasi (non-ternak, non-pakan)
CREATE TABLE IF NOT EXISTS inventori_item (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  koperasi_id   UUID NOT NULL,
  nama          TEXT NOT NULL,
  kategori      TEXT NOT NULL DEFAULT 'umum',
  stok          NUMERIC(15,2) DEFAULT 0,
  satuan        TEXT NOT NULL DEFAULT 'pcs',
  harga_beli    BIGINT DEFAULT 0,
  harga_jual    BIGINT DEFAULT 0,
  batas_minimum NUMERIC(15,2) DEFAULT 0,
  kadaluwarsa   DATE,
  lokasi        TEXT,
  keterangan    TEXT,
  updated_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inventori_item_koperasi ON inventori_item(koperasi_id);
