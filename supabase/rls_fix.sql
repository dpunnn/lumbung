-- ============================================================
-- RLS FIX: Support anggota multi-koperasi + superadmin
-- Jalankan 1x di Supabase SQL Editor
-- ============================================================

-- Helper 1: Cek apakah user (anggota) sudah join koperasi target
CREATE OR REPLACE FUNCTION is_joined_koperasi(target_koperasi_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM anggota_koperasi
    WHERE anggota_id = auth.uid()
    AND koperasi_id = target_koperasi_id
  )
$$;

-- Helper 2: Cek apakah user adalah superadmin
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin'
  )
$$;

-- ============================================================
-- profiles: superadmin bisa baca semua, write tetap hanya diri sendiri
-- ============================================================
DROP POLICY IF EXISTS "profiles_self" ON profiles;
CREATE POLICY "profiles_read" ON profiles
  FOR SELECT USING (id = auth.uid() OR is_superadmin());
CREATE POLICY "profiles_write" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- ============================================================
-- koperasi: superadmin bisa update (toggle modules)
-- ============================================================
CREATE POLICY "koperasi_admin_update" ON koperasi
  FOR UPDATE USING (is_superadmin());

-- ============================================================
-- anggota: pengurus koperasi sendiri + anggota yg join + superadmin
-- ============================================================
DROP POLICY IF EXISTS "anggota_tenant" ON anggota;
CREATE POLICY "anggota_tenant" ON anggota
  FOR ALL USING (
    koperasi_id = get_koperasi_id()
    OR is_joined_koperasi(koperasi_id)
    OR is_superadmin()
  );

-- ============================================================
-- simpanan: pengurus koperasi sendiri + anggota yg join
-- ============================================================
DROP POLICY IF EXISTS "simpanan_tenant" ON simpanan;
CREATE POLICY "simpanan_tenant" ON simpanan
  FOR ALL USING (
    koperasi_id = get_koperasi_id()
    OR is_joined_koperasi(koperasi_id)
  );

-- ============================================================
-- pinjaman: pengurus koperasi sendiri + anggota yg join
-- ============================================================
DROP POLICY IF EXISTS "pinjaman_tenant" ON pinjaman;
CREATE POLICY "pinjaman_tenant" ON pinjaman
  FOR ALL USING (
    koperasi_id = get_koperasi_id()
    OR is_joined_koperasi(koperasi_id)
  );

-- ============================================================
-- lumbung_pass: pengurus kelola milik sendiri + anggota bisa baca
-- ============================================================
DROP POLICY IF EXISTS "pass_tenant" ON lumbung_pass;
CREATE POLICY "pass_tenant_pengurus" ON lumbung_pass
  FOR ALL USING (koperasi_id = get_koperasi_id());
CREATE POLICY "pass_tenant_anggota_read" ON lumbung_pass
  FOR SELECT USING (is_joined_koperasi(koperasi_id));

-- ============================================================
-- anggota_koperasi: user bisa insert diri sendiri + baca sendiri
-- (Pastikan tabel ini sudah ada dengan kolom: id, anggota_id, koperasi_id)
-- ============================================================
ALTER TABLE anggota_koperasi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ak_self" ON anggota_koperasi;
CREATE POLICY "ak_self" ON anggota_koperasi
  FOR ALL USING (anggota_id = auth.uid());
