CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS simpanan (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    koperasi_id UUID NOT NULL,
    anggota_id  UUID NOT NULL,
    jenis       VARCHAR(20) NOT NULL DEFAULT 'pokok',
    jumlah      NUMERIC(15,2) NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'pending',
    approver_id UUID,
    witness_id  UUID,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pinjaman (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    koperasi_id         UUID NOT NULL,
    anggota_id          UUID NOT NULL,
    pokok               NUMERIC(15,2) NOT NULL,
    tenor               INT NOT NULL,
    angsuran_per_bulan  NUMERIC(15,2) NOT NULL,
    bunga_persen        NUMERIC(5,2) NOT NULL DEFAULT 0,
    status              VARCHAR(20) NOT NULL DEFAULT 'aktif',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS angsuran (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pinjaman_id   UUID NOT NULL REFERENCES pinjaman(id),
    koperasi_id   UUID NOT NULL,
    bulan_ke      INT NOT NULL,
    jumlah_bayar  NUMERIC(15,2) NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'pending',
    tanggal_bayar TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_simpanan_koperasi_anggota ON simpanan(koperasi_id, anggota_id);
CREATE INDEX IF NOT EXISTS idx_pinjaman_koperasi_anggota ON pinjaman(koperasi_id, anggota_id);
CREATE INDEX IF NOT EXISTS idx_angsuran_pinjaman ON angsuran(pinjaman_id);

-- RLS
ALTER TABLE simpanan ENABLE ROW LEVEL SECURITY;
CREATE POLICY simpanan_tenant ON simpanan USING (koperasi_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE pinjaman ENABLE ROW LEVEL SECURITY;
CREATE POLICY pinjaman_tenant ON pinjaman USING (koperasi_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE angsuran ENABLE ROW LEVEL SECURITY;
CREATE POLICY angsuran_tenant ON angsuran USING (koperasi_id = current_setting('app.current_tenant', true)::uuid);

-- Tabel kelayakan kredit lintas-tenant (TIDAK RLS): hanya simpan nik_hash + skor
CREATE TABLE IF NOT EXISTS riwayat_kredit (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nik_hash    VARCHAR(64) NOT NULL,
    koperasi_id UUID NOT NULL,       -- dari koperasi mana
    skor        INT NOT NULL,        -- 0-100
    keterangan  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_riwayat_kredit_nik ON riwayat_kredit(nik_hash);
