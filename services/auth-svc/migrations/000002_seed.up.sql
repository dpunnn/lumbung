-- Seed akun testing LUMBUNG dev
-- =============================================================================
-- PASSWORD SEMUA AKUN: lumbung123
--
-- PENTING: password_hash di bawah adalah PLACEHOLDER, BUKAN hash valid untuk
-- "lumbung123". Login dengan akun ini TIDAK akan berhasil sampai hash diganti.
--
-- Cara mengaktifkan akun seed (pilih salah satu):
--   1. Generate hash valid lalu UPDATE:
--        go run scripts/hash_password.go lumbung123
--        -> salin output, jalankan:
--        UPDATE users SET password_hash = '<output>' WHERE email LIKE '%.test';
--   2. Atau (jika ada htpasswd):
--        htpasswd -nbB user lumbung123 | cut -d: -f2
--   3. Atau cukup register akun baru via API:
--        POST http://localhost:8080/api/auth/register
--
-- CATATAN: kolom users.id bertipe UUID, jadi seed memakai UUID valid
-- (bukan string 'usr-...'). koperasi_id mengacu ke seed tenant-svc 000002.
-- =============================================================================

INSERT INTO users (id, koperasi_id, username, email, password_hash, role) VALUES
-- Harapan Baru (11111111-...) -- ternak
('a1111111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
 'pengurus_harapan', 'pengurus@harapan.test',
 '$2a$12$Mn8SXECpFKSWWAA3b6y6Wegp6oyHhbtCV3zI8hb5mF91cd2.jBe32', 'pengurus'),
('a1111111-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
 'kasir_harapan', 'kasir@harapan.test',
 '$2a$12$Mn8SXECpFKSWWAA3b6y6Wegp6oyHhbtCV3zI8hb5mF91cd2.jBe32', 'kasir'),
('a1111111-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
 'anggota_harapan', 'anggota@harapan.test',
 '$2a$12$Mn8SXECpFKSWWAA3b6y6Wegp6oyHhbtCV3zI8hb5mF91cd2.jBe32', 'anggota'),
-- Padiwangi (22222222-...) -- beras
('a2222222-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222',
 'pengurus_padiwangi', 'pengurus@padiwangi.test',
 '$2a$12$Mn8SXECpFKSWWAA3b6y6Wegp6oyHhbtCV3zI8hb5mF91cd2.jBe32', 'pengurus'),
('a2222222-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222',
 'kasir_padiwangi', 'kasir@padiwangi.test',
 '$2a$12$Mn8SXECpFKSWWAA3b6y6Wegp6oyHhbtCV3zI8hb5mF91cd2.jBe32', 'kasir'),
-- Superadmin (tanpa koperasi)
('a0000000-0000-0000-0000-000000000001', NULL,
 'superadmin', 'admin@lumbung.test',
 '$2a$12$Mn8SXECpFKSWWAA3b6y6Wegp6oyHhbtCV3zI8hb5mF91cd2.jBe32', 'super_admin')
ON CONFLICT (id) DO NOTHING;
