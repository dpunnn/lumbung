import type {
  Koperasi, Anggota, Transaksi, StokItem, Ternak, ModuleId,
} from "@/lib/types";

export type SignalKind = "anomaly" | "asset" | "risk" | "score";
export type Severity = "info" | "warning" | "critical";

export interface ExplainItem {
  faktor: string;
  bobot: number; // 0..1 (kontribusi; 0 kalau cuma angka pendukung)
  nilai: number;
}

export interface Signal {
  id: string;
  tenantId: string;
  modul: ModuleId; // dari komoditas mana sinyal ini lahir
  kind: SignalKind;
  severity: Severity;
  judul: string;
  narasi: string; // bahasa awam → langsung dipakai Lens
  nilai?: number;
  explain: ExplainItem[];
}

export interface InsightInput {
  koperasi: Koperasi;
  anggota: Anggota[];
  transaksi: Transaksi[];
  stok: StokItem[];
  ternak: Ternak[];
  verifiedRatio?: number; // dari vision (jumlah_terverifikasi / jumlah_klaim)
}

export type Analyzer = (input: InsightInput) => Signal[];
