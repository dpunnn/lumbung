-- Seed stok awal dev
INSERT INTO stok_item (id, koperasi_id, komoditas, nama, satuan, jumlah, mutu) VALUES
('eeee0001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'ternak', 'Sapi Bali', 'ekor', 25, 'A'),
('eeee0001-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'ternak', 'Kambing Jawa', 'ekor', 40, 'B'),
('eeee0002-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'beras', 'Beras IR64', 'sak', 150, 'A'),
('eeee0002-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'beras', 'Beras Pandan Wangi', 'sak', 80, 'A')
ON CONFLICT (id) DO NOTHING;
