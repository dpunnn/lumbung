import type { Analyzer, Signal, InsightInput, ExplainItem } from "./types";

// Harga referensi (dummy, gampang diganti).
const HARGA_TERNAK_PER_KG: Record<string, number> = { Sapi: 65_000, Kambing: 90_000 };
const FAKTOR_SEHAT: Record<string, number> = { sehat: 1, perlu_vaksin: 0.85, sakit: 0.6, mati: 0 };
const HARGA_STOK: Record<string, number> = {
  Beras: 12_000, Cabai: 35_000, Tomat: 9_000, "Pupuk Urea": 130_000, "Pakan konsentrat": 8_000,
};
const SUSUT: Record<string, number> = { baik: 0, layu: 0.4, rusak: 1 };

const rupiah = (n: number) => "Rp" + Math.round(n).toLocaleString("id-ID");

export const assetAnalyzer: Analyzer = (input) => {
  const { koperasi } = input;
  const explain: ExplainItem[] = [];
  let total = 0;

  // Ternak (Harapan Baru) — dikalikan rasio verifikasi dari vision (default 1 = manual).
  if (koperasi.modules.includes("ternak")) {
    const nilaiTernak = input.ternak.reduce((sum, t) => {
      const harga = HARGA_TERNAK_PER_KG[t.jenis] ?? 50_000;
      return sum + t.bobotKg * harga * (FAKTOR_SEHAT[t.status] ?? 0.8);
    }, 0);
    const verif = input.verifiedRatio ?? 1;
    const nilai = nilaiTernak * verif;
    total += nilai;
    explain.push({
      faktor: `Ternak ${input.ternak.length} ekor (verifikasi ${Math.round(verif * 100)}%)`,
      bobot: 0, nilai: Math.round(nilai),
    });
  }

  // Stok/inventori (Melati, Sumber, Padiwangi, Harapan-pakan)
  if (koperasi.modules.includes("inventori") || koperasi.modules.includes("ritel")) {
    const nilaiStok = input.stok.reduce((sum, s) => {
      const harga = HARGA_STOK[s.nama] ?? 10_000;
      return sum + s.qty * harga * (1 - (SUSUT[s.kondisi ?? "baik"] ?? 0));
    }, 0);
    if (nilaiStok > 0) {
      total += nilaiStok;
      explain.push({ faktor: "Stok (setelah penyusutan)", bobot: 0, nilai: Math.round(nilaiStok) });
    }
  }

  // Portofolio pinjaman sehat (Padiwangi, Tirta)
  if (koperasi.modules.includes("simpan_pinjam")) {
    const pinjaman = input.transaksi.filter((t) => t.tipe === "pinjaman").reduce((s, t) => s + t.jumlah, 0);
    const angsuran = input.transaksi.filter((t) => t.tipe === "angsuran").reduce((s, t) => s + t.jumlah, 0);
    const rasioMacet = pinjaman > 0 ? Math.max(0, 1 - angsuran / pinjaman) * 0.2 : 0; // proxy dummy
    const nilai = pinjaman * (1 - rasioMacet);
    if (nilai > 0) {
      total += nilai;
      explain.push({ faktor: "Portofolio pinjaman sehat", bobot: 0, nilai: Math.round(nilai) });
    }
  }

  if (total <= 0) return [];
  return [{
    id: `asset-${koperasi.id}`,
    tenantId: koperasi.id,
    modul: koperasi.modules[0],
    kind: "asset",
    severity: "info",
    judul: `Estimasi nilai aset/agunan: ${rupiah(total)}`,
    narasi: `Total aset koperasi ini bernilai sekitar ${rupiah(total)}, siap menjadi dasar penilaian pembiayaan (mengisi Lumbung Pass).`,
    nilai: Math.round(total),
    explain,
  }];
};
