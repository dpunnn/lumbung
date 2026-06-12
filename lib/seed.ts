import type { Koperasi, Anggota, Transaksi, StokItem, Ternak } from "./types";

export const koperasiList: Koperasi[] = [
  {
    id: "padiwangi",
    nama: "Koperasi Padiwangi",
    fokusUsaha: "Simpan pinjam + beras",
    modules: ["simpan_pinjam", "inventori"],
    literasi: "menengah",
    lokasi: "Desa Padiwangi",
  },
  {
    id: "melati-jaya",
    nama: "Koperasi Melati Jaya",
    fokusUsaha: "Sayuran & cold storage",
    modules: ["inventori"],
    literasi: "menengah",
    lokasi: "Desa Melati",
  },
  {
    id: "sumber-makmur",
    nama: "Koperasi Sumber Makmur",
    fokusUsaha: "Pupuk & toko gerai",
    modules: ["inventori", "ritel"],
    literasi: "tinggi",
    lokasi: "Desa Sumber",
  },
  {
    id: "tirta-bersama",
    nama: "Koperasi Tirta Bersama",
    fokusUsaha: "Air bersih & simpan pinjam",
    modules: ["air", "simpan_pinjam"],
    literasi: "rendah",
    lokasi: "Desa Tirta",
  },
  {
    id: "harapan-baru",
    nama: "Koperasi Harapan Baru",
    fokusUsaha: "Ternak & pakan",
    modules: ["ternak", "inventori"],
    literasi: "rendah",
    lokasi: "Desa Harapan (terpencil)",
  },
];

// --- helper kecil biar seed-nya ringkas ---
const hariLalu = (n: number) =>
  new Date(Date.now() - n * 86_400_000).toISOString();

export const anggotaList: Anggota[] = [
  { id: "a1", tenantId: "padiwangi", nama: "Hendra", bergabung: hariLalu(400) },
  { id: "a2", tenantId: "padiwangi", nama: "Siti", bergabung: hariLalu(300) },
  { id: "a3", tenantId: "padiwangi", nama: "Budi", bergabung: hariLalu(120) },
  { id: "a4", tenantId: "tirta-bersama", nama: "Hendra", bergabung: hariLalu(200) },
  { id: "a5", tenantId: "tirta-bersama", nama: "Wati", bergabung: hariLalu(90) },
  { id: "a6", tenantId: "harapan-baru", nama: "Joko", bergabung: hariLalu(150) },
  { id: "a7", tenantId: "harapan-baru", nama: "Marni", bergabung: hariLalu(60) },
];

export const transaksiList: Transaksi[] = [
  { id: "t1", tenantId: "padiwangi", tipe: "simpanan", anggotaId: "a1", jumlah: 500_000, ts: hariLalu(20) },
  { id: "t2", tenantId: "padiwangi", tipe: "pinjaman", anggotaId: "a2", jumlah: 2_000_000, ts: hariLalu(15) },
  { id: "t3", tenantId: "padiwangi", tipe: "angsuran", anggotaId: "a2", jumlah: 300_000, ts: hariLalu(5) },
  { id: "t4", tenantId: "tirta-bersama", tipe: "simpanan", anggotaId: "a5", jumlah: 150_000, ts: hariLalu(10) },
  { id: "t5", tenantId: "harapan-baru", tipe: "penjualan", jumlah: 4_500_000, ts: hariLalu(8), catatan: "Jual 2 ekor" },
  { id: "t6", tenantId: "harapan-baru", tipe: "pembelian", jumlah: 800_000, ts: hariLalu(3), catatan: "Pakan" },
];

export const stokList: StokItem[] = [
  { id: "s1", tenantId: "padiwangi", nama: "Beras", qty: 1200, satuan: "kg", kondisi: "baik" },
  { id: "s2", tenantId: "melati-jaya", nama: "Cabai", qty: 80, satuan: "kg", kondisi: "layu", suhuC: 8 },
  { id: "s3", tenantId: "melati-jaya", nama: "Tomat", qty: 150, satuan: "kg", kondisi: "baik", suhuC: 6 },
  { id: "s4", tenantId: "sumber-makmur", nama: "Pupuk Urea", qty: 300, satuan: "sak", kondisi: "baik" },
  { id: "s5", tenantId: "harapan-baru", nama: "Pakan konsentrat", qty: 45, satuan: "sak", kondisi: "baik" },
];

export const ternakList: Ternak[] = [
  { id: "k1", tenantId: "harapan-baru", tag: "SAPI-001", jenis: "Sapi", umurBulan: 24, bobotKg: 320, vaksin: ["PMK"], status: "sehat" },
  { id: "k2", tenantId: "harapan-baru", tag: "SAPI-002", jenis: "Sapi", umurBulan: 14, bobotKg: 210, vaksin: [], status: "perlu_vaksin" },
  { id: "k3", tenantId: "harapan-baru", tag: "KMBG-001", jenis: "Kambing", umurBulan: 10, bobotKg: 28, vaksin: ["PMK"], status: "sehat" },
];
