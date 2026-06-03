# Arsitektur LUMBUNG

Dokumen ini menjabarkan rancangan teknis LUMBUNG tanpa masuk ke detail implementasi baris-per-baris.

## Prinsip Desain

Empat asumsi kondisi lapangan menentukan seluruh keputusan teknis:

| Asumsi lapangan | Konsekuensi desain |
|---|---|
| Perangkat pengurus lemah (Android kelas bawah) | Klien ringan, mobile-first (PWA) |
| Sinyal intermittent / sering putus | **Offline-first**, sinkronisasi oportunistik |
| Literasi digital pengurus rendah | Antarmuka & laporan adaptif |
| Mitra pembiayaan beragam | Standar data terbuka (Lumbung Open Schema) |

## 1. Lumbung Core — Multi-Tenant

- Setiap koperasi = **tenant terisolasi** (Row-Level Security; opsi schema-per-tenant untuk koperasi besar).
- **Commodity Adapter**: modul yang dapat diaktifkan per koperasi (simpan-pinjam, inventori perishable + cold-chain, ritel, utilitas air, peternakan). Satu basis kode untuk banyak karakter koperasi.

## 2. Lumbung Sync — Offline-First

- **Local-first**: replika penuh di perangkat; semua operasi jalan tanpa internet.
- **CRDT** (Conflict-free Replicated Data Type): merge otomatis bebas konflik saat kembali online.
- **Delta sync** hemat bandwidth + store-and-forward; fallback gerbang SMS untuk konfirmasi kritis.
- **Append-only event log**: sumber tunggal untuk sinkronisasi *dan* verifikasi (lihat Lumbung Pass).

## 3. Lumbung Pass — Paspor Data (Hero)

Lima pengaman saat berbagi data ke mitra pembiayaan:

1. **Terikat tujuan** (purpose-bound) — mitra deklarasikan tujuan → sistem petakan ke set data minimum.
2. **Diminimalkan & diagregasi** — bagikan indikator kesehatan, bukan baris per anggota; PII ditokenisasi.
3. **Atas persetujuan** (consent-gated) — granular; dapat didelegasikan via Rapat Anggota.
4. **Terverifikasi** — hash tahan-rusak + tanda tangan koperasi (bersumber dari append-only log).
5. **Terbatas waktu & teraudit** — paspor kedaluwarsa; setiap akses tercatat.

**Lumbung Open Schema**: format paspor distandarkan agar dapat dibaca semua mitra → efek jaringan.

## 4. Lumbung Lens — Laporan Adaptif

- Adaptif peran & literasi: mode visual sederhana / mode rinci / ekspor terstandar.
- Narasi bahasa awam otomatis (NLP) — ubah angka menjadi kalimat.

## 5. Lumbung Insight — Lapisan Kecerdasan (AI)

AI bersifat **suportif & explainable**, manusia tetap pemutus akhir (memenuhi aturan dilarang 100% AI).

| Kapabilitas | Teknik | Nilai |
|---|---|---|
| Ternak Asset Intelligence | Gradient boosting + aturan domain | Indeks kesehatan & valuasi agunan → isi Lumbung Pass |
| Credit-Readiness Scoring | Model interpretable | Nilai koperasi unbanked |
| Vision Livestock Verification | CV ringan / TinyML on-device | Anti-agunan fiktif (ghost cattle), jalan offline |
| Peringatan Dini Prediktif | Deret waktu + musim | Cegah kerugian (mortalitas/spoilage) |
| Deteksi Anomali Stok | Isolation forest / z-score | Tangkap stok hilang/rusak |
| Narasi Bahasa Awam | NLP | Menenagai Lumbung Lens |

## 6. Lumbung Atlas — Konsolidasi Kabupaten (Federated)

- Pemerintah memperoleh **indikator agregat** lintas koperasi untuk perencanaan.
- Data mentah & identitas anggota **tetap di tenant masing-masing** (privacy-preserving / federated analytics).

## 7. Embedded Financing

Karena portofolio aset & kesehatan koperasi sudah tepercaya (via Lumbung Pass), mitra dapat menawarkan produk kredit langsung di platform — kredit modal kerja, pembiayaan berbasis inventaris, atau pinjaman beragunan ternak — dengan penilaian risiko berbasis data nyata.

## Keamanan & Kepatuhan

Privacy by design: minimisasi data, persetujuan granular, jejak audit, tokenisasi identitas, pembatasan tujuan — memetakan langsung ke UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi.
