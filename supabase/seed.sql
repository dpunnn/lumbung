
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION _seed_angsuran(
  p uuid, mulai date, tenor int, perbulan bigint,
  lunas_sampai int, terlambat_sampai int
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE b int; jt date;
BEGIN
  FOR b IN 1..tenor LOOP
    jt := (mulai + (b || ' month')::interval)::date;
    IF b <= lunas_sampai THEN
      INSERT INTO angsuran(pinjaman_id, bulan_ke, tanggal_jatuh_tempo, tanggal_bayar, jumlah_bayar, status)
      VALUES (p, b, jt, jt, perbulan, 'lunas');
    ELSIF b <= terlambat_sampai THEN
      INSERT INTO angsuran(pinjaman_id, bulan_ke, tanggal_jatuh_tempo, status)
      VALUES (p, b, jt, 'terlambat');
    ELSE
      INSERT INTO angsuran(pinjaman_id, bulan_ke, tanggal_jatuh_tempo, status)
      VALUES (p, b, jt, 'pending');
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION _seed_simpanan(kop uuid, base bigint) RETURNS void LANGUAGE plpgsql AS $$
DECLARE m int; a record; tgl date;
BEGIN
  FOR m IN 0..5 LOOP
    tgl := (date_trunc('month', current_date) - (m || ' month')::interval)::date + 4;
    FOR a IN SELECT id FROM anggota WHERE koperasi_id = kop LOOP
      INSERT INTO simpanan(koperasi_id, anggota_id, jumlah, tanggal, keterangan)
      VALUES (kop, a.id, base + (5 - m) * 25000, tgl, 'Simpanan wajib');
    END LOOP;
  END LOOP;
END $$;

DO $$
DECLARE
  k_padi uuid; k_melati uuid; k_sumber uuid; k_tirta uuid; k_harapan uuid;
  pid uuid;
  a_asep uuid; a_budi uuid; a_cucu uuid; a_dedi uuid; a_eli uuid;
  hendra_padi uuid; hendra_tirta uuid;
  prg uuid;
  v_kasir uuid;   
BEGIN
  SELECT id INTO k_padi    FROM koperasi WHERE nama = 'Padiwangi';
  SELECT id INTO k_melati  FROM koperasi WHERE nama = 'Melati Jaya';
  SELECT id INTO k_sumber  FROM koperasi WHERE nama = 'Sumber Makmur';
  SELECT id INTO k_tirta   FROM koperasi WHERE nama = 'Tirta Bersama';
  SELECT id INTO k_harapan FROM koperasi WHERE nama = 'Harapan Baru';

  DELETE FROM angsuran;
  DELETE FROM pinjaman;
  DELETE FROM simpanan;
  DELETE FROM aset_jaminan;
  DELETE FROM ternak;
  DELETE FROM pakan;
  DELETE FROM pengadaan_alokasi;
  DELETE FROM pengadaan;
  DELETE FROM anggota;
  DELETE FROM audit_log;   

  INSERT INTO anggota(koperasi_id, nama) VALUES
    (k_harapan,'Asep'),(k_harapan,'Budi'),(k_harapan,'Cucu'),(k_harapan,'Dedi'),
    (k_harapan,'Eli'),(k_harapan,'Fitri'),(k_harapan,'Gilang'),(k_harapan,'Hesti'),
    (k_harapan,'Imam'),(k_harapan,'Joko'),(k_harapan,'Kiki'),(k_harapan,'Lina');

  SELECT id INTO a_asep FROM anggota WHERE koperasi_id=k_harapan AND nama='Asep';
  SELECT id INTO a_budi FROM anggota WHERE koperasi_id=k_harapan AND nama='Budi';
  SELECT id INTO a_cucu FROM anggota WHERE koperasi_id=k_harapan AND nama='Cucu';
  SELECT id INTO a_dedi FROM anggota WHERE koperasi_id=k_harapan AND nama='Dedi';
  SELECT id INTO a_eli  FROM anggota WHERE koperasi_id=k_harapan AND nama='Eli';

  INSERT INTO ternak(koperasi_id, kode, jenis, umur_bulan, status, nilai_estimasi, jumlah_klaim, jumlah_terverifikasi, terverifikasi) VALUES
    (k_harapan,'TRN-01','Sapi',24,'sehat',15000000,1,1,true),
    (k_harapan,'TRN-02','Sapi',20,'sehat',14000000,1,1,true),
    (k_harapan,'TRN-03','Sapi',30,'sehat',16000000,1,1,true),
    (k_harapan,'TRN-04','Kambing',12,'sehat',2500000,1,1,true),
    (k_harapan,'TRN-05','Kambing',10,'sehat',2400000,1,0,false),
    (k_harapan,'TRN-06','Kambing',14,'sehat',2600000,1,0,false),
    (k_harapan,'TRN-07','Kambing',8 ,'pantau',2000000,1,0,false),
    (k_harapan,'TRN-08','Sapi',18,'sakit',12000000,1,0,false);

  INSERT INTO pakan(koperasi_id, nama, stok, satuan, batas_minimum) VALUES
    (k_harapan,'Konsentrat',40 ,'kg',50),   
    (k_harapan,'Hijauan'   ,250,'kg',100),
    (k_harapan,'Dedak'     ,90 ,'kg',60);

  INSERT INTO aset_jaminan(koperasi_id, anggota_id, jenis, deskripsi, nilai_estimasi, status_kepemilikan) VALUES
    (k_harapan, a_asep, 'lahan', 'Sawah 500 m2', 30000000, 'milik');
  INSERT INTO aset_jaminan(koperasi_id, anggota_id, jenis, deskripsi, nilai_estimasi, kondisi) VALUES
    (k_harapan, a_budi, 'alat', 'Traktor mini', 18000000, 'baik');

  INSERT INTO pinjaman(koperasi_id,anggota_id,jumlah_pokok,tenor_bulan,tanggal_mulai,angsuran_per_bulan,status)
    VALUES (k_harapan,a_asep,6000000,12,(current_date - interval '5 month')::date,500000,'aktif') RETURNING id INTO pid;
  PERFORM _seed_angsuran(pid,(current_date - interval '5 month')::date,12,500000,5,5);

  INSERT INTO pinjaman(koperasi_id,anggota_id,jumlah_pokok,tenor_bulan,tanggal_mulai,angsuran_per_bulan,status)
    VALUES (k_harapan,a_budi,4800000,12,(current_date - interval '5 month')::date,400000,'aktif') RETURNING id INTO pid;
  PERFORM _seed_angsuran(pid,(current_date - interval '5 month')::date,12,400000,5,5);

  INSERT INTO pinjaman(koperasi_id,anggota_id,jumlah_pokok,tenor_bulan,tanggal_mulai,angsuran_per_bulan,status)
    VALUES (k_harapan,a_cucu,3600000,12,(current_date - interval '3 month')::date,300000,'aktif') RETURNING id INTO pid;
  PERFORM _seed_angsuran(pid,(current_date - interval '3 month')::date,12,300000,3,3);

  INSERT INTO pinjaman(koperasi_id,anggota_id,jumlah_pokok,tenor_bulan,tanggal_mulai,angsuran_per_bulan,status)
    VALUES (k_harapan,a_dedi,2400000,12,(current_date - interval '3 month')::date,200000,'aktif') RETURNING id INTO pid;
  PERFORM _seed_angsuran(pid,(current_date - interval '3 month')::date,12,200000,3,3);

  INSERT INTO pinjaman(koperasi_id,anggota_id,jumlah_pokok,tenor_bulan,tanggal_mulai,angsuran_per_bulan,status)
    VALUES (k_harapan,a_eli,4200000,12,(current_date - interval '5 month')::date,350000,'macet') RETURNING id INTO pid;
  PERFORM _seed_angsuran(pid,(current_date - interval '5 month')::date,12,350000,2,5);

  PERFORM _seed_simpanan(k_harapan, 100000);

  INSERT INTO anggota(koperasi_id, nama) VALUES
    (k_padi,'Pak Hendra'),(k_padi,'Rina'),(k_padi,'Sari'),(k_padi,'Tono');
  SELECT id INTO hendra_padi FROM anggota WHERE koperasi_id=k_padi AND nama='Pak Hendra';

  UPDATE anggota SET limit_level = 4, limit_rupiah = 20000000
    WHERE id = hendra_padi;

  INSERT INTO pinjaman(koperasi_id,anggota_id,jumlah_pokok,tenor_bulan,tanggal_mulai,angsuran_per_bulan,status)
    VALUES (k_padi,hendra_padi,5000000,12,(current_date - interval '5 month')::date,420000,'aktif') RETURNING id INTO pid;
  PERFORM _seed_angsuran(pid,(current_date - interval '5 month')::date,12,420000,5,5); 

  PERFORM _seed_simpanan(k_padi, 150000);

  INSERT INTO anggota(koperasi_id, nama) VALUES
    (k_tirta,'Pak Hendra'),(k_tirta,'Wawan'),(k_tirta,'Yani');
  SELECT id INTO hendra_tirta FROM anggota WHERE koperasi_id=k_tirta AND nama='Pak Hendra';

  INSERT INTO pinjaman(koperasi_id,anggota_id,jumlah_pokok,tenor_bulan,tanggal_mulai,angsuran_per_bulan,status)
    VALUES (k_tirta,hendra_tirta,3000000,12,(current_date - interval '4 month')::date,250000,'aktif') RETURNING id INTO pid;
  PERFORM _seed_angsuran(pid,(current_date - interval '4 month')::date,12,250000,3,4); 

  PERFORM _seed_simpanan(k_tirta, 120000);

  UPDATE anggota SET ktp_hash = encode(digest('3273010101900001', 'sha256'), 'hex')
    WHERE id IN (hendra_padi, hendra_tirta);

  INSERT INTO anggota(koperasi_id, nama) VALUES
    (k_melati,'Nina'),(k_melati,'Oki'),(k_melati,'Pia');
  PERFORM _seed_simpanan(k_melati, 80000);

  INSERT INTO anggota(koperasi_id, nama) VALUES
    (k_sumber,'Qori'),(k_sumber,'Rudi'),(k_sumber,'Sinta');
  PERFORM _seed_simpanan(k_sumber, 90000);

  SELECT id INTO v_kasir FROM profiles LIMIT 1;
  IF v_kasir IS NOT NULL AND k_padi IS NOT NULL THEN
    INSERT INTO audit_log (koperasi_id, tabel_nama, row_id, aksi, dilakukan_oleh, dilakukan_pada) VALUES
      (k_padi, 'simpanan', gen_random_uuid(), 'DELETE', v_kasir, (current_date - 1)::timestamptz + interval '19 hours'),
      (k_padi, 'simpanan', gen_random_uuid(), 'DELETE', v_kasir, (current_date - 2)::timestamptz + interval '20 hours 15 minutes'),
      (k_padi, 'angsuran', gen_random_uuid(), 'UPDATE', v_kasir, (current_date - 3)::timestamptz + interval '21 hours'),
      (k_padi, 'angsuran', gen_random_uuid(), 'DELETE', v_kasir, (current_date - 4)::timestamptz + interval '19 hours 30 minutes'),
      (k_padi, 'simpanan', gen_random_uuid(), 'DELETE', v_kasir, (current_date - 5)::timestamptz + interval '22 hours');
  END IF;

  INSERT INTO pengadaan(judul, item, satuan, total_kebutuhan, status, dibuat_oleh_koperasi_id)
    VALUES ('Pengadaan Pupuk Urea Bersama','Pupuk Urea','sak',100,'aktif',k_padi) RETURNING id INTO prg;

  INSERT INTO pengadaan_alokasi(pengadaan_id, koperasi_id, kebutuhan, status_rekening, catatan) VALUES
    (prg, k_padi,   50, 'terhubung',       'Rekening aktif'),
    (prg, k_melati, 30, 'terhubung',       'Rekening aktif'),
    (prg, k_sumber, 20, 'belum_terhubung', 'Belum punya rekening — perlu diurus'); 
END $$;

DROP FUNCTION _seed_angsuran(uuid, date, int, bigint, int, int);
DROP FUNCTION _seed_simpanan(uuid, bigint);

SELECT nama, fokus_usaha, jumlah_anggota, total_simpanan, jumlah_ternak, pinjaman_aktif
FROM atlas_agregat ORDER BY nama;
