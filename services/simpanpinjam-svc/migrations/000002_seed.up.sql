-- Seed simpanan & pinjaman dev
INSERT INTO simpanan (id, koperasi_id, anggota_id, jenis, jumlah, status) VALUES
('bbbb0001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaa0001-0000-0000-0000-000000000001', 'pokok', 500000, 'confirmed'),
('bbbb0001-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'aaaa0001-0000-0000-0000-000000000001', 'wajib', 50000, 'confirmed'),
('bbbb0002-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'aaaa0002-0000-0000-0000-000000000001', 'pokok', 500000, 'confirmed')
ON CONFLICT (id) DO NOTHING;

INSERT INTO pinjaman (id, koperasi_id, anggota_id, pokok, tenor, angsuran_per_bulan, bunga_persen, status) VALUES
('cccc0001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaa0001-0000-0000-0000-000000000002', 2000000, 6, 350000, 5, 'aktif')
ON CONFLICT (id) DO NOTHING;

INSERT INTO angsuran (id, pinjaman_id, koperasi_id, bulan_ke, jumlah_bayar, status) VALUES
('dddd0001-0000-0000-0000-000000000001', 'cccc0001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 1, 350000, 'lunas'),
('dddd0001-0000-0000-0000-000000000002', 'cccc0001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 2, 350000, 'pending')
ON CONFLICT (id) DO NOTHING;

-- Seed riwayat kredit lintas-tenak (skoring kelayakan)
INSERT INTO riwayat_kredit (id, nik_hash, koperasi_id, skor, keterangan) VALUES
('ffff0001-0000-0000-0000-000000000001', 'abc123hash', '11111111-1111-1111-1111-111111111111', 88, 'angsuran lancar'),
('ffff0001-0000-0000-0000-000000000002', 'def456hash', '11111111-1111-1111-1111-111111111111', 82, 'kadang terlambat'),
('ffff0002-0000-0000-0000-000000000001', 'jkl012hash', '22222222-2222-2222-2222-222222222222', 90, 'rekam jejak baik')
ON CONFLICT (id) DO NOTHING;
