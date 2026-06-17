-- Seed 2 koperasi dev
-- ID ini HARUS sama dengan yang dipakai seed di service lain
-- (member-svc, simpanpinjam-svc, inventori-svc, marketplace-svc)
INSERT INTO koperasi (id, nama, jenis, komoditas, modules, wilayah, alamat) VALUES
(
    '11111111-1111-1111-1111-111111111111',
    'Koperasi Harapan Baru',
    'ternak',
    'Sapi Bali, Kambing Jawa',
    ARRAY['core', 'ternak', 'pakan', 'inventori', 'air', 'simpan_pinjam', 'pass', 'lens', 'guard', 'pasar', 'atlas'],
    'Kecamatan Prambanan, Sleman, DIY',
    'Jl. Peternakan Rakyat No. 12, Sleman 55572'
),
(
    '22222222-2222-2222-2222-222222222222',
    'Koperasi Padiwangi Makmur',
    'beras',
    'Beras IR64, Pandan Wangi',
    ARRAY['core', 'ternak', 'pakan', 'inventori', 'simpan_pinjam', 'pass', 'lens', 'guard', 'pasar'],
    'Kecamatan Sewon, Bantul, DIY',
    'Jl. Sawah Makmur No. 8, Bantul 55187'
)
ON CONFLICT (id) DO NOTHING;
