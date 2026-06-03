# LUMBUNG — Satu Lumbung, Banyak Koperasi

**Sistem Operasi Koperasi Desa: Multi-Tenant, Offline-First, dengan Paspor Data Berbasis Persetujuan untuk Membuka Akses Pembiayaan.**

Hackathon TechnoScape 9.0 (BNCC × AD-INS) — Tim **FraudHunter**
Studi Kasus: Perancangan Sistem Digitalisasi Program Koperasi — *Koperasi Harapan Baru (Ternak & Pakan)*

> Status: **tahap proposal / babak penyisihan.** Repositori ini memuat dokumen perancangan, arsitektur, dan rencana implementasi. Pembangunan MVP dilakukan pada babak final.

---

## Masalah

Setahun setelah MVP pencatatan digital satu koperasi (Koperasi Viva) berhasil, pemerintah kabupaten ingin mereplikasinya ke banyak koperasi desa. Sistem lama gagal naik kelas karena dirancang untuk **satu** koperasi:

1. **Data bercampur** ketika koperasi kedua bergabung (tidak ada isolasi tenant).
2. **Pengurus tidak memahami laporan** (tidak adaptif terhadap literasi).
3. **Bingung berbagi data ke mitra pembiayaan** — tidak tahu apa yang boleh dibagikan & seberapa banyak.

Akar masalah: sistem dibangun sebagai **aplikasi tunggal**, bukan **platform**.

## Solusi — LUMBUNG

Sebuah *Sistem Operasi Koperasi* yang dirancang sejak awal untuk **banyak koperasi sekaligus**, berdiri di atas empat lapis + mesin kecerdasan:

| Lapis | Komponen | Fungsi |
|---|---|---|
| Fondasi | **Lumbung Core** | Multi-tenant + *commodity adapter* — 1 platform untuk beras/sayur/pupuk/air/ternak tanpa data tercampur |
| Konektivitas | **Lumbung Sync** | *Offline-first* (CRDT) — tetap jalan tanpa internet, sinkron bebas konflik saat online |
| **Hero** | **Lumbung Pass** | Paspor data: berbagi ke pemodal secara **minim, atas izin, terverifikasi, teraudit** |
| Akses | **Lumbung Lens** | Laporan adaptif literasi pengurus (visual / bahasa sederhana / narasi) |
| Mesin AI | **Lumbung Insight** | Valuasi aset ternak, credit scoring, verifikasi ternak via foto (anti-agunan fiktif), peringatan dini, anomali stok, NLP |
| Govtech | **Lumbung Atlas** | Konsolidasi kabupaten *privacy-preserving* (federated) — agregat tanpa menyedot data mentah |

Dan **Embedded Financing**: data terverifikasi → kredit mengalir langsung ke koperasi desa yang selama ini *unbankable*.

## Mengapa Harapan Baru (Ternak)?

- Lokasi terjauh, sinyal sulit → menuntut **offline-first** (tantangan teknis paling membedakan).
- Ternak adalah **aset hidup** → bisa menjadi **agunan**; pencatatan rapi + terverifikasi membuka akses modal.
- Segmen paling sulit mengakses modal formal → dampak inklusi keuangan terbesar.

## Arsitektur (ringkas)

```
Pengurus (PWA, offline)  ──CRDT delta sync──►  Lumbung Core (multi-tenant, RLS)
        │                                              │
        │ append-only event log                        ▼
        ▼                                      Lumbung Insight (AI)
  Lumbung Lens (laporan)                               │
                                                       ▼
  Mitra Pembiayaan  ◄──Lumbung Pass (minim, consent, verified)──┤
  Pemerintah Kab.   ◄──Lumbung Atlas (agregat, privacy-preserving)
```

Detail lengkap: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Tech Stack (rencana)

| Lapisan | Teknologi |
|---|---|
| Klien | Progressive Web App (mobile-first), SQLite + CRDT lokal |
| Sinkronisasi | Delta sync + store-and-forward, fallback SMS |
| Backend | Event-sourced services (Docker), PostgreSQL + Row-Level Security |
| Lumbung Pass | Snapshot bertanda tangan + hash-chained audit log |
| AI | Gradient boosting (valuasi/skor), CV ringan/TinyML (verifikasi foto), isolation forest (anomali), NLP |
| Keamanan | Enkripsi at-rest & in-transit, kepatuhan UU PDP No. 27/2022 |

## Dokumen

- [Proposal (PDF)](docs/FraudHunter_Proposal_Hackathon_TechnoScape_2026.pdf)
- [Arsitektur](docs/ARCHITECTURE.md)

## Roadmap

- [x] Perancangan & proposal (babak penyisihan)
- [ ] MVP: Lumbung Core (multi-tenant) + modul ternak + Lumbung Sync dasar + Lumbung Lens (babak final)
- [ ] Lumbung Pass v1 + onboarding 1–2 mitra pembiayaan
- [ ] Pilot 1 kabupaten (5 koperasi), uji offline-first lapangan
- [ ] Skala nasional — selaras program Koperasi Desa Merah Putih (Inpres 9/2025)

## Tim FraudHunter

- **Dhafin Ahamad Athalla** (BINUS University) — Project Lead & System Architect
- **Farhan Kamalhadi Elevana** (Universitas Padjadjaran) — Data & Product Engineer

---

*TechnoScape 9.0 Hackathon · BNCC × AD-INS · 2026*
