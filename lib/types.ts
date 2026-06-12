export type ModuleId =
  | "simpan_pinjam"
  | "inventori"
  | "ternak"
  | "air"
  | "ritel";

export type LiterasiLevel = "rendah" | "menengah" | "tinggi";

export interface Koperasi {
  id: string;
  nama: string;
  fokusUsaha: string;
  modules: ModuleId[];
  literasi: LiterasiLevel;
  lokasi: string;
}

export interface Anggota {
  id: string;
  tenantId: string;
  nama: string;
  bergabung: string; // ISO date
}

export interface Transaksi {
  id: string;
  tenantId: string;
  tipe: "simpanan" | "pinjaman" | "angsuran" | "penjualan" | "pembelian";
  anggotaId?: string;
  jumlah: number;
  ts: string; // ISO datetime
  catatan?: string;
}

export interface StokItem {
  id: string;
  tenantId: string;
  nama: string;
  qty: number;
  satuan: string;
  kondisi?: "baik" | "layu" | "rusak";
  suhuC?: number; // untuk cold storage (Melati Jaya)
}

export interface Ternak {
  id: string;
  tenantId: string;
  tag: string;
  jenis: string;
  umurBulan: number;
  bobotKg: number;
  vaksin: string[];
  status: "sehat" | "perlu_vaksin" | "sakit" | "mati";
}
