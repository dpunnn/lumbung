-- Seed anggota untuk 2 koperasi dev
-- Koperasi Harapan Baru: 11111111-1111-1111-1111-111111111111
-- Koperasi Padiwangi:    22222222-2222-2222-2222-222222222222
-- (ID ini juga harus di-seed di tenant-svc -- noted untuk GELOMBANG 6)

INSERT INTO anggota (id, koperasi_id, nama, nik_hash, alamat, telepon, status) VALUES
-- Harapan Baru (ternak)
('aaaa0001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Budi Santoso', 'abc123hash', 'Jl. Peternakan No.1, Sleman', '08111000001', 'aktif'),
('aaaa0001-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Siti Rahayu', 'def456hash', 'Jl. Peternakan No.2, Sleman', '08111000002', 'aktif'),
('aaaa0001-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Ahmad Fauzi', 'ghi789hash', 'Jl. Peternakan No.3, Sleman', '08111000003', 'aktif'),
-- Padiwangi (beras)
('aaaa0002-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Dewi Lestari', 'jkl012hash', 'Jl. Sawah Indah No.1, Bantul', '08222000001', 'aktif'),
('aaaa0002-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Hendra Wijaya', 'mno345hash', 'Jl. Sawah Indah No.2, Bantul', '08222000002', 'aktif')
ON CONFLICT (id) DO NOTHING;
