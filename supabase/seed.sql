-- ============================================================
-- LUMBUNG SEED DATA — Demo TechnoScape 9.0
-- Jalankan di Supabase SQL Editor
-- PERHATIAN: Jalankan hanya sekali. Kalau mau ulang, truncate dulu.
-- ============================================================

DO $$
DECLARE
  -- Koperasi
  v_harapan   uuid;
  v_padiwangi uuid;
  v_melati    uuid;
  v_sumber    uuid;
  v_tirta     uuid;

  -- Anggota Harapan Baru
  v_joko  uuid := gen_random_uuid();
  v_marni uuid := gen_random_uuid();
  v_budi  uuid := gen_random_uuid();
  v_siti  uuid := gen_random_uuid();
  v_andi  uuid := gen_random_uuid();
  v_rini  uuid := gen_random_uuid();

  -- Anggota Padiwangi
  v_hendra uuid := gen_random_uuid();
  v_wati   uuid := gen_random_uuid();

  -- Pinjaman
  v_pin1 uuid := gen_random_uuid();
  v_pin2 uuid := gen_random_uuid();
  v_pin3 uuid := gen_random_uuid();
  v_pin4 uuid := gen_random_uuid();
  v_pin5 uuid := gen_random_uuid();

  -- Pengadaan
  v_pgd  uuid := gen_random_uuid();

  -- Kasir untuk anomali (ambil profile pertama yang ada)
  v_kasir uuid;

BEGIN
  -- Ambil ID koperasi
  SELECT id INTO v_harapan   FROM koperasi WHERE nama ILIKE '%Harapan Baru%'    LIMIT 1;
  SELECT id INTO v_padiwangi FROM koperasi WHERE nama ILIKE '%Padiwangi%'        LIMIT 1;
  SELECT id INTO v_melati    FROM koperasi WHERE nama ILIKE '%Melati%'           LIMIT 1;
  SELECT id INTO v_sumber    FROM koperasi WHERE nama ILIKE '%Sumber Makmur%'    LIMIT 1;
  SELECT id INTO v_tirta     FROM koperasi WHERE nama ILIKE '%Tirta%'            LIMIT 1;

  -- Ambil satu profile yang ada (untuk kasir anomali demo)
  SELECT id INTO v_kasir FROM profiles LIMIT 1;

  -- ============================================================
  -- ANGGOTA
  -- ============================================================
  INSERT INTO anggota (id, koperasi_id, nama, bergabung_at, limit_level, limit_rupiah) VALUES
    (v_joko,  v_harapan, 'Pak Joko Santoso',  now() - interval '400 days', 3, 7000000),
    (v_marni, v_harapan, 'Bu Marni',           now() - interval '350 days', 2, 3000000),
    (v_budi,  v_harapan, 'Pak Budi',           now() - interval '300 days', 2, 5000000),
    (v_siti,  v_harapan, 'Bu Siti Rahayu',     now() - interval '250 days', 1, 2000000),
    (v_andi,  v_harapan, 'Pak Andi',           now() - interval '200 days', 1, 1500000),
    (v_rini,  v_harapan, 'Bu Rini',            now() - interval '180 days', 1, 1000000),
    (gen_random_uuid(), v_harapan, 'Pak Surya',     now() - interval '150 days', 1, 1000000),
    (gen_random_uuid(), v_harapan, 'Bu Dewi',       now() - interval '120 days', 1, 1000000),
    (gen_random_uuid(), v_harapan, 'Pak Agus',      now() - interval  '90 days', 1, 1000000),
    (gen_random_uuid(), v_harapan, 'Bu Nani',       now() - interval  '60 days', 1, 1000000),
    (gen_random_uuid(), v_harapan, 'Pak Wahyu',     now() - interval  '45 days', 1, 1000000),
    (gen_random_uuid(), v_harapan, 'Bu Lastri',     now() - interval  '30 days', 1, 1000000);

  -- Anggota Padiwangi (Pak Hendra = cross-koperasi hero Case A)
  INSERT INTO anggota (id, koperasi_id, nama, bergabung_at, limit_level, limit_rupiah) VALUES
    (v_hendra, v_padiwangi, 'Pak Hendra Kurniawan', now() - interval '500 days', 4, 20000000),
    (v_wati,   v_padiwangi, 'Bu Wati',               now() - interval '280 days', 2,  5000000);

  -- Pak Hendra juga di Tirta Bersama (ada tunggakan — Case A bisa demo cross-koperasi)
  INSERT INTO anggota (koperasi_id, nama, bergabung_at, limit_level, limit_rupiah) VALUES
    (v_tirta, 'Pak Hendra Kurniawan', now() - interval '300 days', 2, 3000000),
    (v_tirta, 'Bu Wati',              now() - interval '150 days', 1, 1000000);

  -- Anggota Melati Jaya
  INSERT INTO anggota (koperasi_id, nama, bergabung_at) VALUES
    (v_melati, 'Pak Darto', now() - interval '200 days'),
    (v_melati, 'Bu Ayu',    now() - interval '100 days');

  -- Anggota Sumber Makmur
  INSERT INTO anggota (koperasi_id, nama, bergabung_at) VALUES
    (v_sumber, 'Pak Slamet', now() - interval '180 days'),
    (v_sumber, 'Bu Ika',     now() - interval  '90 days');

  -- ============================================================
  -- TERNAK Harapan Baru (8 ekor: 6 sehat, 1 pantau, 1 sakit)
  -- ============================================================
  INSERT INTO ternak (koperasi_id, kode, jenis, umur_bulan, status, vaksin_terakhir, nilai_estimasi, jumlah_klaim, jumlah_terverifikasi, terverifikasi) VALUES
    (v_harapan, 'SAPI-001', 'Sapi',    36, 'sehat',  '2026-03-15', 15000000, 1, 1, true),
    (v_harapan, 'SAPI-002', 'Sapi',    28, 'sehat',  '2026-04-01', 14000000, 1, 1, true),
    (v_harapan, 'SAPI-003', 'Sapi',    20, 'sehat',  '2026-05-10', 12000000, 1, 1, true),
    (v_harapan, 'SAPI-004', 'Sapi',    18, 'sehat',  '2026-05-10', 11000000, 1, 1, true),
    (v_harapan, 'KMBG-001', 'Kambing', 14, 'sehat',  '2026-04-20',  3500000, 1, 1, true),
    (v_harapan, 'KMBG-002', 'Kambing', 10, 'sehat',  '2026-04-20',  3000000, 1, 0, false),
    (v_harapan, 'SAPI-005', 'Sapi',    24, 'pantau', '2026-01-15', 13000000, 1, 1, true),
    (v_harapan, 'KMBG-003', 'Kambing',  8, 'sakit',   NULL,          2500000, 1, 0, false);

  -- ============================================================
  -- PAKAN (3 item, 1 di bawah minimum → alert beranda)
  -- ============================================================
  INSERT INTO pakan (koperasi_id, nama, stok, satuan, batas_minimum) VALUES
    (v_harapan, 'Pakan Konsentrat', 15, 'sak', 20),   -- BAWAH MINIMUM
    (v_harapan, 'Jerami Kering',    80, 'ikat', 30),
    (v_harapan, 'Dedak Padi',       45, 'kg',   25);

  -- ============================================================
  -- SIMPANAN
  -- ============================================================
  INSERT INTO simpanan (koperasi_id, anggota_id, jumlah, tanggal) VALUES
    (v_harapan, v_joko,  1500000, current_date - 60),
    (v_harapan, v_joko,   500000, current_date - 30),
    (v_harapan, v_marni,  800000, current_date - 45),
    (v_harapan, v_budi,  1200000, current_date - 30),
    (v_harapan, v_siti,   300000, current_date - 20),
    (v_harapan, v_andi,   250000, current_date - 15),
    (v_harapan, v_rini,   200000, current_date - 10),
    (v_padiwangi, v_hendra, 5000000, current_date - 90),
    (v_padiwangi, v_hendra, 2000000, current_date - 30),
    (v_padiwangi, v_wati,   1500000, current_date - 20);

  -- ============================================================
  -- PINJAMAN (5 aktif di Harapan Baru: 4 lancar, 1 macet)
  -- Pin1 & Pin2 sudah berjalan 5 bulan → demo input angsuran ke-6
  -- ============================================================
  INSERT INTO pinjaman (id, koperasi_id, anggota_id, jumlah_pokok, tenor_bulan, tanggal_mulai, angsuran_per_bulan, status) VALUES
    (v_pin1, v_harapan, v_joko,  7000000, 12, current_date - 150, 583333, 'aktif'),
    (v_pin2, v_harapan, v_marni, 3000000, 12, current_date - 150, 250000, 'aktif'),
    (v_pin3, v_harapan, v_budi,  5000000, 12, current_date -  90, 416666, 'aktif'),
    (v_pin4, v_harapan, v_siti,  2000000, 12, current_date -  60, 166666, 'aktif'),
    (v_pin5, v_harapan, v_andi,  1500000,  6, current_date - 120, 250000, 'macet');

  -- Pinjaman Padiwangi (Pak Hendra lancar)
  INSERT INTO pinjaman (koperasi_id, anggota_id, jumlah_pokok, tenor_bulan, tanggal_mulai, angsuran_per_bulan, status) VALUES
    (v_padiwangi, v_hendra, 10000000, 12, current_date - 200, 833333, 'aktif');

  -- ============================================================
  -- ANGSURAN — pin1 & pin2 lunas bulan 1-5, bulan ke-6 pending
  -- ============================================================
  INSERT INTO angsuran (pinjaman_id, bulan_ke, tanggal_jatuh_tempo, tanggal_bayar, jumlah_bayar, status) VALUES
    (v_pin1, 1, current_date - 120, current_date - 122, 583333, 'lunas'),
    (v_pin1, 2, current_date -  90, current_date -  92, 583333, 'lunas'),
    (v_pin1, 3, current_date -  60, current_date -  61, 583333, 'lunas'),
    (v_pin1, 4, current_date -  30, current_date -  31, 583333, 'lunas'),
    (v_pin1, 5, current_date,       current_date -   2, 583333, 'lunas'),
    (v_pin1, 6, current_date +  30, NULL,               NULL,   'pending'),

    (v_pin2, 1, current_date - 120, current_date - 121, 250000, 'lunas'),
    (v_pin2, 2, current_date -  90, current_date -  90, 250000, 'lunas'),
    (v_pin2, 3, current_date -  60, current_date -  59, 250000, 'lunas'),
    (v_pin2, 4, current_date -  30, current_date -  28, 250000, 'lunas'),
    (v_pin2, 5, current_date,       current_date -   1, 250000, 'lunas'),
    (v_pin2, 6, current_date +  30, NULL,               NULL,   'pending'),

    -- Pin3 berjalan 3 bulan
    (v_pin3, 1, current_date -  60, current_date -  62, 416666, 'lunas'),
    (v_pin3, 2, current_date -  30, current_date -  31, 416666, 'lunas'),
    (v_pin3, 3, current_date,       NULL,               NULL,   'pending');

  -- ============================================================
  -- AUDIT LOG — Kasir Padiwangi 5x cancel/delete setelah jam 18
  -- (Demo Case D: Guard anomali)
  -- ============================================================
  IF v_kasir IS NOT NULL AND v_padiwangi IS NOT NULL THEN
    INSERT INTO audit_log (koperasi_id, tabel_nama, row_id, aksi, dilakukan_oleh, dilakukan_pada) VALUES
      (v_padiwangi, 'simpanan', gen_random_uuid(), 'DELETE', v_kasir, (current_date - 1)::timestamptz + interval '19 hours'),
      (v_padiwangi, 'simpanan', gen_random_uuid(), 'DELETE', v_kasir, (current_date - 2)::timestamptz + interval '20 hours 15 minutes'),
      (v_padiwangi, 'angsuran', gen_random_uuid(), 'UPDATE', v_kasir, (current_date - 3)::timestamptz + interval '21 hours'),
      (v_padiwangi, 'angsuran', gen_random_uuid(), 'DELETE', v_kasir, (current_date - 4)::timestamptz + interval '19 hours 30 minutes'),
      (v_padiwangi, 'simpanan', gen_random_uuid(), 'DELETE', v_kasir, (current_date - 5)::timestamptz + interval '22 hours');
  END IF;

  -- ============================================================
  -- PENGADAAN BERSAMA (Case B: pupuk, 3 koperasi)
  -- Padiwangi + Melati Jaya rekening terhubung
  -- Sumber Makmur belum punya rekening → badge merah
  -- ============================================================
  IF v_padiwangi IS NOT NULL THEN
    INSERT INTO pengadaan (id, judul, item, satuan, total_kebutuhan, status, dibuat_oleh_koperasi_id) VALUES
      (v_pgd, 'Pengadaan Pupuk Urea Juni 2026', 'Pupuk Urea', 'sak', 100, 'aktif', v_padiwangi);

    INSERT INTO pengadaan_alokasi (pengadaan_id, koperasi_id, kebutuhan, status_rekening) VALUES
      (v_pgd, v_padiwangi, 50, 'terhubung'),
      (v_pgd, v_melati,    30, 'terhubung'),
      (v_pgd, v_sumber,    20, 'belum_terhubung');
  END IF;

END $$;
