-- Seed 6 produk untuk 2 koperasi dev.
-- Harapan Baru (ternak): 11111111-1111-1111-1111-111111111111
-- Padiwangi (beras):     22222222-2222-2222-2222-222222222222
--
-- Catatan: ID produk memakai UUID valid (hex-only). "prod" bukan hex, jadi
-- prefix diganti 'd1'/'d2' agar tetap mudah dikenali namun lolos tipe UUID.

INSERT INTO produk (id, koperasi_id, slug, nama, deskripsi, harga, stok, kategori, aktif) VALUES
-- Harapan Baru - ternak
('d1000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
 'sapi-bali-harapan-baru', 'Sapi Bali Premium', 'Sapi Bali jantan 2 tahun, BCS grade A, berat +-350kg', 18000000, 10, 'ternak', true),
('d1000001-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
 'kambing-jawa-harapan-baru', 'Kambing Jawa Siap Potong', 'Kambing Jawa betina 8 bulan, mutu B, berat +-25kg', 2800000, 20, 'ternak', true),
('d1000001-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
 'pupuk-kandang-harapan-baru', 'Pupuk Kandang Organik', 'Pupuk kandang sapi fermentasi, per karung 25kg', 35000, 200, 'pupuk', true),
-- Padiwangi - beras
('d2000002-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222',
 'beras-ir64-padiwangi', 'Beras IR64 Super', 'Beras IR64 kualitas super, putih bersih, 5kg', 75000, 500, 'beras', true),
('d2000002-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222',
 'beras-pandan-wangi-padiwangi', 'Beras Pandan Wangi Premium', 'Beras Pandan Wangi Cianjur asli, 5kg', 95000, 300, 'beras', true),
('d2000002-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222',
 'tepung-beras-padiwangi', 'Tepung Beras Halus', 'Tepung beras halus olahan koperasi, 1kg', 18000, 150, 'olahan', true)
ON CONFLICT (id) DO NOTHING;
