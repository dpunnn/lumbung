-- Tabel ternak: data ternak per koperasi
CREATE TABLE IF NOT EXISTS ternak (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  koperasi_id          UUID NOT NULL,
  kode                 TEXT NOT NULL,
  jenis                TEXT NOT NULL,
  umur_bulan           INTEGER,
  status               TEXT NOT NULL DEFAULT 'sehat' CHECK (status IN ('sehat','pantau','sakit','mati')),
  vaksin_terakhir      DATE,
  nilai_estimasi       BIGINT DEFAULT 0,
  foto_url             TEXT,
  jumlah_klaim         INTEGER DEFAULT 1,
  jumlah_terverifikasi INTEGER DEFAULT 0,
  terverifikasi        BOOLEAN DEFAULT false,
  tanggal_mati         DATE,
  dicatat_mati_oleh    UUID,
  created_at           TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ternak_koperasi ON ternak(koperasi_id);

-- Tabel pakan: stok pakan per koperasi
CREATE TABLE IF NOT EXISTS pakan (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  koperasi_id   UUID NOT NULL,
  nama          TEXT NOT NULL,
  stok          NUMERIC(15,2) DEFAULT 0,
  satuan        TEXT NOT NULL DEFAULT 'kg',
  batas_minimum NUMERIC(15,2) DEFAULT 0,
  updated_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pakan_koperasi ON pakan(koperasi_id);
