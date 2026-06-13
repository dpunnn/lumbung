import type {
  Koperasi, Anggota, Transaksi, StokItem, Ternak, ModuleId,
} from "@/lib/types";

export type SignalKind = "anomaly" | "asset" | "risk" | "score";
export type Severity = "info" | "warning" | "critical";

export interface ExplainItem {
  faktor: string;
  bobot: number;
  nilai: number;
}

export interface Signal {
  id: string;
  tenantId: string;
  modul: ModuleId;
  kind: SignalKind;
  severity: Severity;
  judul: string;
  narasi: string;
  nilai?: number;
  explain: ExplainItem[];
}

export interface InsightInput {
  koperasi: Koperasi;
  anggota: Anggota[];
  transaksi: Transaksi[];
  stok: StokItem[];
  ternak: Ternak[];
  verifiedRatio?: number;
}

export type Analyzer = (input: InsightInput) => Signal[];
