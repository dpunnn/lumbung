
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

CREATE TABLE anggota (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  koperasi_id      uuid NOT NULL REFERENCES koperasi(id),
  nama             text NOT NULL,
  no_hp            text,
  
  ktp_hash         text,               
  id_penjamin      uuid,               
  nama_penjamin    text,
  
  limit_level      int DEFAULT 1,
  limit_rupiah     bigint DEFAULT 1000000,
  bergabung_at     timestamptz DEFAULT now()
);

CREATE TABLE ternak (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  koperasi_id           uuid NOT NULL REFERENCES koperasi(id),
  kode                  text NOT NULL,
  jenis                 text NOT NULL,   
  umur_bulan            int,
  status                text DEFAULT 'sehat'
                        CHECK (status IN ('sehat','pantau','sakit','mati')),
  vaksin_terakhir       date,
  nilai_estimasi        bigint DEFAULT 0,
  foto_url              text,
  
  jumlah_klaim          int DEFAULT 1,
  jumlah_terverifikasi  int DEFAULT 0,
  terverifikasi         boolean DEFAULT false,
  
  tanggal_mati          date,
  dicatat_mati_oleh     uuid REFERENCES profiles(id),
  created_at            timestamptz DEFAULT now()
);

CREATE TABLE aset_jaminan (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  koperasi_id        uuid NOT NULL REFERENCES koperasi(id),
  anggota_id         uuid NOT NULL REFERENCES anggota(id),
  jenis              text NOT NULL CHECK (jenis IN ('lahan','alat')),
  foto_url           text,
  deskripsi          text,           
  nilai_estimasi     bigint DEFAULT 0,
  status_kepemilikan text,           
  kondisi            text,           
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
  angsuran_per_bulan bigint NOT NULL,  
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

CREATE TABLE lumbung_pass (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  koperasi_id    uuid NOT NULL REFERENCES koperasi(id),
  tujuan         text NOT NULL,
  mitra          text NOT NULL,
  fields         jsonb NOT NULL,   
  hash           text NOT NULL,    
  consent        jsonb NOT NULL,   
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

GRANT EXECUTE ON FUNCTION cek_riwayat_kredit(text) TO anon, authenticated;

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

CREATE POLICY "koperasi_read" ON koperasi
  FOR SELECT USING (true);

CREATE POLICY "profiles_self" ON profiles
  FOR ALL USING (id = auth.uid());

CREATE POLICY "anggota_tenant"      ON anggota      FOR ALL USING (koperasi_id = get_koperasi_id());
CREATE POLICY "ternak_tenant"       ON ternak       FOR ALL USING (koperasi_id = get_koperasi_id());
CREATE POLICY "aset_jaminan_tenant" ON aset_jaminan FOR ALL USING (koperasi_id = get_koperasi_id());
CREATE POLICY "pakan_tenant"        ON pakan        FOR ALL USING (koperasi_id = get_koperasi_id());
CREATE POLICY "simpanan_tenant"     ON simpanan     FOR ALL USING (koperasi_id = get_koperasi_id());
CREATE POLICY "pinjaman_tenant"     ON pinjaman     FOR ALL USING (koperasi_id = get_koperasi_id());

CREATE POLICY "angsuran_tenant" ON angsuran
  FOR ALL USING (
    pinjaman_id IN (
      SELECT id FROM pinjaman WHERE koperasi_id = get_koperasi_id()
    )
  );

CREATE POLICY "pass_tenant" ON lumbung_pass
  FOR ALL USING (koperasi_id = get_koperasi_id());

CREATE POLICY "pass_public_read" ON lumbung_pass
  FOR SELECT USING (status = 'aktif' AND berlaku_sampai >= current_date);

CREATE POLICY "pass_log_insert" ON pass_access_log
  FOR INSERT WITH CHECK (true);

CREATE POLICY "audit_log_read" ON audit_log
  FOR SELECT USING (koperasi_id = get_koperasi_id());

CREATE POLICY "audit_log_insert" ON audit_log
  FOR INSERT WITH CHECK (true);

CREATE POLICY "pengadaan_select" ON pengadaan
  FOR SELECT USING (true);
CREATE POLICY "pengadaan_insert" ON pengadaan
  FOR INSERT WITH CHECK (dibuat_oleh_koperasi_id = get_koperasi_id());

CREATE POLICY "alokasi_tenant" ON pengadaan_alokasi
  FOR ALL USING (koperasi_id = get_koperasi_id());

INSERT INTO koperasi (nama, fokus_usaha, lokasi) VALUES
  ('Padiwangi',     'Simpan pinjam + beras',    'Desa Padiwangi, Kab. Sukabumi'),
  ('Melati Jaya',   'Sayuran & cold storage',   'Desa Melati, Kab. Bandung'),
  ('Sumber Makmur', 'Pupuk & toko gerai',        'Desa Sumber, Kab. Garut'),
  ('Tirta Bersama', 'Air bersih & simpan pinjam','Desa Tirta, Kab. Cianjur'),
  ('Harapan Baru',  'Ternak & pakan',            'Desa Harapan, Kab. Tasikmalaya');
