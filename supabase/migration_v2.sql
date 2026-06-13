
ALTER TABLE anggota ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS idx_anggota_user_id ON anggota(user_id);

ALTER TABLE pinjaman DROP CONSTRAINT IF EXISTS pinjaman_status_check;
ALTER TABLE pinjaman ADD CONSTRAINT pinjaman_status_check
  CHECK (status IN ('diajukan','aktif','lunas','macet','ditolak'));

ALTER TABLE koperasi ADD COLUMN IF NOT EXISTS modules jsonb DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS inventori (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  koperasi_id   uuid NOT NULL REFERENCES koperasi(id) ON DELETE CASCADE,
  nama          text NOT NULL,
  kategori      text DEFAULT 'umum',
  stok          numeric DEFAULT 0,
  satuan        text DEFAULT 'pcs',
  harga_beli    bigint DEFAULT 0,
  harga_jual    bigint DEFAULT 0,
  batas_minimum numeric DEFAULT 0,
  kadaluwarsa   date,                  
  lokasi        text,                  
  keterangan    text,
  updated_at    timestamptz DEFAULT now(),
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE inventori ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inventori_tenant" ON inventori;
CREATE POLICY "inventori_tenant" ON inventori FOR ALL USING (koperasi_id = get_koperasi_id() OR is_superadmin());

CREATE TRIGGER trg_audit_inventori
  AFTER INSERT OR UPDATE OR DELETE ON inventori
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TABLE IF NOT EXISTS meteran_air (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  koperasi_id   uuid NOT NULL REFERENCES koperasi(id) ON DELETE CASCADE,
  anggota_id    uuid REFERENCES anggota(id),
  nama_pelanggan text NOT NULL,
  nomor_meteran text NOT NULL,
  alamat        text,
  tarif_per_m3  bigint DEFAULT 1500,
  aktif         boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tagihan_air (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  koperasi_id     uuid NOT NULL REFERENCES koperasi(id) ON DELETE CASCADE,
  meteran_id      uuid NOT NULL REFERENCES meteran_air(id) ON DELETE CASCADE,
  bulan           text NOT NULL,         
  meter_awal      numeric DEFAULT 0,
  meter_akhir     numeric DEFAULT 0,
  pemakaian       numeric GENERATED ALWAYS AS (meter_akhir - meter_awal) STORED,
  jumlah_tagihan  bigint DEFAULT 0,
  status          text DEFAULT 'belum_bayar'
                  CHECK (status IN ('belum_bayar','lunas')),
  tanggal_bayar   date,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE meteran_air ENABLE ROW LEVEL SECURITY;
ALTER TABLE tagihan_air ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "meteran_air_tenant" ON meteran_air;
CREATE POLICY "meteran_air_tenant" ON meteran_air FOR ALL USING (koperasi_id = get_koperasi_id() OR is_superadmin());
DROP POLICY IF EXISTS "tagihan_air_tenant" ON tagihan_air;
CREATE POLICY "tagihan_air_tenant" ON tagihan_air FOR ALL USING (koperasi_id = get_koperasi_id() OR is_superadmin());

CREATE OR REPLACE FUNCTION fn_anggota_risk_cross(p_anggota_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_macet   int;
  v_aktif   int;
  v_total   int;
BEGIN
  SELECT user_id INTO v_user_id FROM anggota WHERE id = p_anggota_id;

  IF v_user_id IS NULL THEN
    
    SELECT
      COUNT(*) FILTER (WHERE p.status = 'macet'),
      COUNT(*) FILTER (WHERE p.status = 'aktif'),
      COUNT(*)
    INTO v_macet, v_aktif, v_total
    FROM pinjaman p WHERE p.anggota_id = p_anggota_id;

    RETURN jsonb_build_object(
      'user_linked', false,
      'macet', v_macet,
      'aktif', v_aktif,
      'total', v_total,
      'cross_koperasi', false
    );
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE p.status = 'macet'),
    COUNT(*) FILTER (WHERE p.status = 'aktif'),
    COUNT(*)
  INTO v_macet, v_aktif, v_total
  FROM pinjaman p
  JOIN anggota a ON a.id = p.anggota_id
  WHERE a.user_id = v_user_id;

  RETURN jsonb_build_object(
    'user_linked', true,
    'macet', v_macet,
    'aktif', v_aktif,
    'total', v_total,
    'cross_koperasi', true
  );
END;
$$;

CREATE OR REPLACE FUNCTION fn_generate_angsuran(p_pinjaman_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pinjaman pinjaman%ROWTYPE;
  i int;
  v_jatuh_tempo date;
BEGIN
  SELECT * INTO v_pinjaman FROM pinjaman WHERE id = p_pinjaman_id;
  FOR i IN 1..v_pinjaman.tenor_bulan LOOP
    v_jatuh_tempo := v_pinjaman.tanggal_mulai + (i || ' months')::interval;
    INSERT INTO angsuran (pinjaman_id, bulan_ke, tanggal_jatuh_tempo, status)
    VALUES (p_pinjaman_id, i, v_jatuh_tempo, 'pending')
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

UPDATE koperasi SET modules = '["simpan_pinjam","inventori","pass","insight","lens","guard","pasar"]'::jsonb
  WHERE nama = 'Padiwangi';

UPDATE koperasi SET modules = '["inventori","pass","insight","lens","guard","pasar"]'::jsonb
  WHERE nama = 'Melati Jaya';

UPDATE koperasi SET modules = '["inventori","simpan_pinjam","pass","insight","lens","guard","pasar"]'::jsonb
  WHERE nama = 'Sumber Makmur';

UPDATE koperasi SET modules = '["air","simpan_pinjam","pass","insight","lens","guard"]'::jsonb
  WHERE nama = 'Tirta Bersama';

UPDATE koperasi SET modules = '["ternak","pakan","simpan_pinjam","pass","insight","lens","guard","pasar"]'::jsonb
  WHERE nama = 'Harapan Baru';
