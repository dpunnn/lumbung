
CREATE TABLE koperasi (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama        text NOT NULL,
  fokus_usaha text,
  lokasi      text,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  koperasi_id uuid REFERENCES koperasi(id),
  role        text NOT NULL CHECK (role IN ('pengurus','kasir','pemodal','pemkab','pengawas')),
  nama        text NOT NULL,
  created_at  timestamptz DEFAULT now()
);


CREATE OR REPLACE FUNCTION get_koperasi_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT koperasi_id FROM profiles WHERE id = auth.uid()
$$;


-- ============================================================
-- TABEL OPERASIONAL (semua punya koperasi_id = multi-tenant)
-- ============================================================

CREATE TABLE anggota (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  koperasi_id      uuid NOT NULL REFERENCES koperasi(id),
  nama             text NOT NULL,
  no_hp            text,
  -- Profil Awal: pengganti slip gaji untuk first-time borrower
  ktp_hash         text,               -- SHA-256 dari NIK, bukan foto asli
  id_penjamin      uuid,               -- anggota lain yang menjamin
  nama_penjamin    text,
  -- Limit kredit bertahap (Level 1-4)
  limit_level      int DEFAULT 1,
  limit_rupiah     bigint DEFAULT 1000000,
  bergabung_at     timestamptz DEFAULT now()
);

CREATE TABLE ternak (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  koperasi_id           uuid NOT NULL REFERENCES koperasi(id),
  kode                  text NOT NULL,
  jenis                 text NOT NULL,   -- sapi, kambing, ayam, dll
  umur_bulan            int,
  status                text DEFAULT 'sehat'
                        CHECK (status IN ('sehat','pantau','sakit','mati')),
  vaksin_terakhir       date,
  nilai_estimasi        bigint DEFAULT 0,
  foto_url              text,
  -- Verifikasi COCO-SSD (anti-agunan fiktif)
  jumlah_klaim          int DEFAULT 1,
  jumlah_terverifikasi  int DEFAULT 0,
  terverifikasi         boolean DEFAULT false,
  -- Handle ternak mati
  tanggal_mati          date,
  dicatat_mati_oleh     uuid REFERENCES profiles(id),
  created_at            timestamptz DEFAULT now()
);

-- Aset jaminan non-ternak: lahan & alat produksi
CREATE TABLE aset_jaminan (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  koperasi_id        uuid NOT NULL REFERENCES koperasi(id),
  anggota_id         uuid NOT NULL REFERENCES anggota(id),
  jenis              text NOT NULL CHECK (jenis IN ('lahan','alat')),
  foto_url           text,
  deskripsi          text,           -- "Sawah 500m2" / "Traktor Kubota"
  nilai_estimasi     bigint DEFAULT 0,
  status_kepemilikan text,           -- milik / garap (untuk lahan)
  kondisi            text,           -- baik / cukup / rusak (untuk alat)
  created_at         timestamptz DEFAULT now()
);

CREATE TABLE pakan (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  koperasi_id   uuid NOT NULL REFERENCES koperasi(id),
  nama          text NOT NULL,
  stok          numeric DEFAULT 0,
  satuan        text DEFAULT 'kg',
  batas_minimum numeric DEFAULT 0,
  updated_at    timestamptz DEFAULT now()
);

CREATE TABLE simpanan (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  koperasi_id uuid NOT NULL REFERENCES koperasi(id),
  anggota_id  uuid NOT NULL REFERENCES anggota(id),
  jumlah      bigint NOT NULL,
  tanggal     date DEFAULT current_date,
  keterangan  text
);

CREATE TABLE pinjaman (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  koperasi_id        uuid NOT NULL REFERENCES koperasi(id),
  anggota_id         uuid NOT NULL REFERENCES anggota(id),
  jumlah_pokok       bigint NOT NULL,
  tenor_bulan        int NOT NULL,
  tanggal_mulai      date DEFAULT current_date,
  angsuran_per_bulan bigint NOT NULL,  -- dihitung di app: jumlah_pokok / tenor_bulan
  status             text DEFAULT 'aktif'
                     CHECK (status IN ('aktif','lunas','macet')),
  created_at         timestamptz DEFAULT now()
);

CREATE TABLE angsuran (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pinjaman_id         uuid NOT NULL REFERENCES pinjaman(id) ON DELETE CASCADE,
  bulan_ke            int NOT NULL,
  tanggal_jatuh_tempo date NOT NULL,
  tanggal_bayar       date,
  jumlah_bayar        bigint,
  status              text DEFAULT 'pending'
                      CHECK (status IN ('pending','lunas','terlambat'))
);


-- ============================================================
-- LUMBUNG PASS
-- ============================================================

CREATE TABLE lumbung_pass (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  koperasi_id    uuid NOT NULL REFERENCES koperasi(id),
  tujuan         text NOT NULL,
  mitra          text NOT NULL,
  fields         jsonb NOT NULL,   -- data agregat yang dibagikan
  hash           text NOT NULL,    -- SHA-256(fields) — bukti tidak diubah
  consent        jsonb NOT NULL,   -- { simpanan: true, ternak: true, ... }
  berlaku_sampai date NOT NULL,
  status         text DEFAULT 'aktif'
                 CHECK (status IN ('aktif','kedaluwarsa','dicabut')),
  created_at     timestamptz DEFAULT now()
);

CREATE TABLE pass_access_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pass_id     uuid NOT NULL REFERENCES lumbung_pass(id),
  mitra       text,
  accessed_at timestamptz DEFAULT now(),
  ip          text
);

-- ============================================================
-- CASE A — Cek riwayat kredit LINTAS KOPERASI (mini BI-Checking)
-- SECURITY DEFINER: berjalan di atas RLS sehingga bisa membaca
-- jejak pinjaman di semua koperasi, TAPI hanya mengembalikan
-- sinyal agregat. Tidak ada nama, nominal, atau identitas
-- koperasi lain yang bocor -> privasi anggota lain terjaga.
-- Pencocokan via ktp_hash (SHA-256 NIK), bukan NIK mentah.
-- ============================================================
CREATE OR REPLACE FUNCTION cek_riwayat_kredit(p_ktp_hash text)
RETURNS TABLE (
  jumlah_koperasi    int,
  total_pinjaman     int,
  pinjaman_lancar    int,
  pinjaman_macet     int,
  angsuran_tepat     int,
  angsuran_terlambat int,
  ada_tunggakan      boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ang AS (
    SELECT id AS anggota_id, koperasi_id
    FROM anggota WHERE ktp_hash = p_ktp_hash AND p_ktp_hash IS NOT NULL
  ),
  pj AS (
    SELECT p.* FROM pinjaman p JOIN ang ON ang.anggota_id = p.anggota_id
  ),
  ag AS (
    SELECT s.* FROM angsuran s JOIN pj ON pj.id = s.pinjaman_id
  )
  SELECT
    (SELECT COUNT(DISTINCT koperasi_id) FROM ang)::int,
    (SELECT COUNT(*) FROM pj)::int,
    (SELECT COUNT(*) FROM pj WHERE status IN ('aktif','lunas'))::int,
    (SELECT COUNT(*) FROM pj WHERE status = 'macet')::int,
    (SELECT COUNT(*) FROM ag WHERE status = 'lunas')::int,
    (SELECT COUNT(*) FROM ag WHERE status = 'terlambat')::int,
    (SELECT EXISTS(SELECT 1 FROM ag WHERE status = 'terlambat')
         OR EXISTS(SELECT 1 FROM pj WHERE status = 'macet'));
$$;

-- Boleh dipanggil dari klien (anon/authenticated) — outputnya sudah aman
GRANT EXECUTE ON FUNCTION cek_riwayat_kredit(text) TO anon, authenticated;


-- ============================================================
-- LUMBUNG GUARD — audit trail otomatis
-- ============================================================

CREATE TABLE audit_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  koperasi_id    uuid,
  tabel_nama     text NOT NULL,
  row_id         uuid,
  aksi           text NOT NULL CHECK (aksi IN ('INSERT','UPDATE','DELETE','CANCEL')),
  kolom_diubah   text,
  nilai_lama     jsonb,
  nilai_baru     jsonb,
  dilakukan_oleh uuid REFERENCES profiles(id),
  dilakukan_pada timestamptz DEFAULT now()
);

-- Trigger function: catat semua perubahan secara otomatis
CREATE OR REPLACE FUNCTION fn_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO audit_log (
    koperasi_id, tabel_nama, row_id, aksi,
    nilai_lama, nilai_baru, dilakukan_oleh
  ) VALUES (
    COALESCE(
      (NEW).koperasi_id::uuid,
      (OLD).koperasi_id::uuid
    ),
    TG_TABLE_NAME,
    COALESCE((NEW).id::uuid, (OLD).id::uuid),
    TG_OP,
    CASE WHEN TG_OP != 'INSERT' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP != 'DELETE' THEN to_jsonb(NEW) ELSE NULL END,
    auth.uid()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Pasang trigger ke semua tabel utama
CREATE TRIGGER trg_audit_ternak
  AFTER INSERT OR UPDATE OR DELETE ON ternak
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER trg_audit_pakan
  AFTER INSERT OR UPDATE OR DELETE ON pakan
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER trg_audit_pinjaman
  AFTER INSERT OR UPDATE OR DELETE ON pinjaman
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER trg_audit_angsuran
  AFTER INSERT OR UPDATE OR DELETE ON angsuran
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER trg_audit_simpanan
  AFTER INSERT OR UPDATE OR DELETE ON simpanan
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();


-- ============================================================
-- LUMBUNG PASAR — pengadaan bersama (Case B)
-- ============================================================

CREATE TABLE pengadaan (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  judul                   text NOT NULL,
  item                    text NOT NULL,
  satuan                  text DEFAULT 'kg',
  total_kebutuhan         numeric DEFAULT 0,
  status                  text DEFAULT 'draft'
                          CHECK (status IN ('draft','aktif','selesai')),
  dibuat_oleh_koperasi_id uuid REFERENCES koperasi(id),
  created_at              timestamptz DEFAULT now()
);

CREATE TABLE pengadaan_alokasi (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pengadaan_id     uuid NOT NULL REFERENCES pengadaan(id) ON DELETE CASCADE,
  koperasi_id      uuid NOT NULL REFERENCES koperasi(id),
  kebutuhan        numeric DEFAULT 0,
  alokasi_dapat    numeric DEFAULT 0,
  status_rekening  text DEFAULT 'belum_terhubung'
                   CHECK (status_rekening IN ('terhubung','belum_terhubung')),
  catatan          text
);


-- ============================================================
-- ATLAS VIEW — agregat untuk pemkab (tanpa data pribadi)
-- ============================================================

CREATE OR REPLACE VIEW atlas_agregat AS
SELECT
  k.id                                                          AS koperasi_id,
  k.nama,
  k.fokus_usaha,
  COUNT(DISTINCT a.id)                                          AS jumlah_anggota,
  COALESCE(SUM(s.jumlah), 0)                                    AS total_simpanan,
  COUNT(DISTINCT t.id) FILTER (WHERE t.status != 'mati')        AS jumlah_ternak,
  ROUND(
    COUNT(t.id) FILTER (WHERE t.status = 'sehat')::numeric
    / NULLIF(COUNT(t.id) FILTER (WHERE t.status != 'mati'), 0) * 100
  , 1)                                                          AS pct_sehat,
  COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'aktif')        AS pinjaman_aktif
FROM koperasi k
LEFT JOIN anggota  a ON a.koperasi_id = k.id
LEFT JOIN simpanan s ON s.koperasi_id = k.id
LEFT JOIN ternak   t ON t.koperasi_id = k.id
LEFT JOIN pinjaman p ON p.koperasi_id = k.id
GROUP BY k.id, k.nama, k.fokus_usaha;


-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE koperasi          ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE anggota           ENABLE ROW LEVEL SECURITY;
ALTER TABLE ternak            ENABLE ROW LEVEL SECURITY;
ALTER TABLE aset_jaminan      ENABLE ROW LEVEL SECURITY;
ALTER TABLE pakan             ENABLE ROW LEVEL SECURITY;
ALTER TABLE simpanan          ENABLE ROW LEVEL SECURITY;
ALTER TABLE pinjaman          ENABLE ROW LEVEL SECURITY;
ALTER TABLE angsuran          ENABLE ROW LEVEL SECURITY;
ALTER TABLE lumbung_pass      ENABLE ROW LEVEL SECURITY;
ALTER TABLE pass_access_log   ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log         ENABLE ROW LEVEL SECURITY;
ALTER TABLE pengadaan         ENABLE ROW LEVEL SECURITY;
ALTER TABLE pengadaan_alokasi ENABLE ROW LEVEL SECURITY;

-- koperasi: semua role bisa baca (untuk dropdown & referensi)
CREATE POLICY "koperasi_read" ON koperasi
  FOR SELECT USING (true);

-- profiles: user hanya akses profil sendiri
CREATE POLICY "profiles_self" ON profiles
  FOR ALL USING (id = auth.uid());

-- Tabel tenant: hanya akses data koperasi sendiri
CREATE POLICY "anggota_tenant"      ON anggota      FOR ALL USING (koperasi_id = get_koperasi_id());
CREATE POLICY "ternak_tenant"       ON ternak       FOR ALL USING (koperasi_id = get_koperasi_id());
CREATE POLICY "aset_jaminan_tenant" ON aset_jaminan FOR ALL USING (koperasi_id = get_koperasi_id());
CREATE POLICY "pakan_tenant"        ON pakan        FOR ALL USING (koperasi_id = get_koperasi_id());
CREATE POLICY "simpanan_tenant"     ON simpanan     FOR ALL USING (koperasi_id = get_koperasi_id());
CREATE POLICY "pinjaman_tenant"     ON pinjaman     FOR ALL USING (koperasi_id = get_koperasi_id());

-- angsuran: akses via pinjaman milik koperasi sendiri
CREATE POLICY "angsuran_tenant" ON angsuran
  FOR ALL USING (
    pinjaman_id IN (
      SELECT id FROM pinjaman WHERE koperasi_id = get_koperasi_id()
    )
  );

-- Pass: koperasi kelola pass miliknya
CREATE POLICY "pass_tenant" ON lumbung_pass
  FOR ALL USING (koperasi_id = get_koperasi_id());

-- Pass: pemodal baca pass aktif via token (tanpa login)
CREATE POLICY "pass_public_read" ON lumbung_pass
  FOR SELECT USING (status = 'aktif' AND berlaku_sampai >= current_date);

-- pass_access_log: siapapun bisa insert (catat akses pemodal)
CREATE POLICY "pass_log_insert" ON pass_access_log
  FOR INSERT WITH CHECK (true);

-- audit_log: pengawas & pengurus baca log koperasinya
CREATE POLICY "audit_log_read" ON audit_log
  FOR SELECT USING (koperasi_id = get_koperasi_id());

-- audit_log: trigger system bisa insert
CREATE POLICY "audit_log_insert" ON audit_log
  FOR INSERT WITH CHECK (true);

-- pengadaan: semua koperasi bisa lihat & buat
CREATE POLICY "pengadaan_select" ON pengadaan
  FOR SELECT USING (true);
CREATE POLICY "pengadaan_insert" ON pengadaan
  FOR INSERT WITH CHECK (dibuat_oleh_koperasi_id = get_koperasi_id());

-- pengadaan_alokasi: koperasi kelola alokasi miliknya
CREATE POLICY "alokasi_tenant" ON pengadaan_alokasi
  FOR ALL USING (koperasi_id = get_koperasi_id());


-- ============================================================
-- SEED: 5 koperasi awal
-- ============================================================

INSERT INTO koperasi (nama, fokus_usaha, lokasi) VALUES
  ('Padiwangi',     'Simpan pinjam + beras',    'Desa Padiwangi, Kab. Sukabumi'),
  ('Melati Jaya',   'Sayuran & cold storage',   'Desa Melati, Kab. Bandung'),
  ('Sumber Makmur', 'Pupuk & toko gerai',        'Desa Sumber, Kab. Garut'),
  ('Tirta Bersama', 'Air bersih & simpan pinjam','Desa Tirta, Kab. Cianjur'),
  ('Harapan Baru',  'Ternak & pakan',            'Desa Harapan, Kab. Tasikmalaya');
