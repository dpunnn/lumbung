import type { Analyzer, Signal, InsightInput, ExplainItem } from "./types";

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const sumTipe = (tx: InsightInput["transaksi"], tipe: string) =>
  tx.filter((t) => t.tipe === tipe).reduce((s, t) => s + t.jumlah, 0);

/* ---------- (b) Skor KOPERASI → untuk Pass/Atlas ---------- */
export interface SkorKoperasi { skor: number; level: string; explain: ExplainItem[] }

export function hitungSkorKoperasi(input: InsightInput): SkorKoperasi {
  const { transaksi, stok, ternak } = input;
  const simpanan = sumTipe(transaksi, "simpanan");
  const pinjaman = sumTipe(transaksi, "pinjaman");
  const angsuran = sumTipe(transaksi, "angsuran");

  const likuiditas = pinjaman === 0 ? 1 : clamp01(simpanan / pinjaman);
  const kepatuhan = pinjaman === 0 ? 1 : clamp01(angsuran / pinjaman);
  const totalFisik = stok.length + ternak.length;
  const sehat =
    stok.filter((s) => (s.kondisi ?? "baik") === "baik").length +
    ternak.filter((t) => t.status === "sehat").length;
  const kesehatanAset = totalFisik === 0 ? 1 : sehat / totalFisik;

  const skor = Math.round((0.35 * likuiditas + 0.3 * kepatuhan + 0.35 * kesehatanAset) * 100);
  const level = skor >= 75 ? "Sehat" : skor >= 50 ? "Cukup" : "Perlu Perhatian";
  return {
    skor, level,
    explain: [
      { faktor: "Likuiditas (simpanan/pinjaman)", bobot: 0.35, nilai: Math.round(likuiditas * 100) },
      { faktor: "Kepatuhan angsuran", bobot: 0.3, nilai: Math.round(kepatuhan * 100) },
      { faktor: "Kesehatan aset fisik", bobot: 0.35, nilai: Math.round(kesehatanAset * 100) },
    ],
  };
}

export const scoreAnalyzer: Analyzer = (input) => {
  const r = hitungSkorKoperasi(input);
  return [{
    id: `score-${input.koperasi.id}`,
    tenantId: input.koperasi.id,
    modul: input.koperasi.modules[0],
    kind: "score",
    severity: r.skor >= 50 ? "info" : "warning",
    judul: `Skor kesehatan koperasi: ${r.skor}/100 (${r.level})`,
    narasi: `Dihitung dari likuiditas, kepatuhan angsuran, dan kesehatan aset. Skor inilah yang dibungkus Lumbung Pass untuk pemodal.`,
    nilai: r.skor,
    explain: r.explain,
  }];
};

/* ---------- (a) Skor ANGGOTA → limit bertahap, dipakai Core ---------- */
export interface SkorAnggota {
  anggotaId: string; nama: string; level: 1 | 2 | 3 | 4;
  limit: [number, number]; saran: string; explain: ExplainItem[];
}

export function hitungSkorAnggota(anggotaId: string, input: InsightInput): SkorAnggota {
  const a = input.anggota.find((x) => x.id === anggotaId);
  if (!a) throw new Error("Anggota tidak ditemukan: " + anggotaId);

  const durasiBulan = Math.floor((Date.now() - new Date(a.bergabung).getTime()) / (30 * 86_400_000));
  const tx = input.transaksi.filter((t) => t.anggotaId === anggotaId);
  const simpananRutin = tx.filter((t) => t.tipe === "simpanan").length >= 1;
  const pinjaman = sumTipe(tx, "pinjaman");
  const angsuran = sumTipe(tx, "angsuran");
  const adaPinjamanLunas = pinjaman > 0 && angsuran >= pinjaman;

  let level: 1 | 2 | 3 | 4 = 1;
  if (durasiBulan >= 24) level = 4;
  else if (adaPinjamanLunas) level = 3;
  else if (durasiBulan >= 3 && simpananRutin) level = 2;

  const limit: Record<number, [number, number]> = {
    1: [1_000_000, 3_000_000], 2: [3_000_000, 7_000_000],
    3: [7_000_000, 20_000_000], 4: [20_000_000, 50_000_000],
  };
  const saran: Record<number, string> = {
    1: "Simpan rutin minimal 3 bulan untuk naik ke Level 2.",
    2: "Ambil & lunasi 1 pinjaman kecil untuk naik ke Level 3.",
    3: "Pertahankan track record; keanggotaan 2+ tahun membuka Level 4.",
    4: "Limit tertinggi. Pertahankan kedisiplinan pembayaran.",
  };
  return {
    anggotaId, nama: a.nama, level, limit: limit[level], saran: saran[level],
    explain: [
      { faktor: "Durasi keanggotaan (bulan)", bobot: 0, nilai: durasiBulan },
      { faktor: "Simpanan rutin", bobot: 0, nilai: simpananRutin ? 1 : 0 },
      { faktor: "Pinjaman lunas", bobot: 0, nilai: adaPinjamanLunas ? 1 : 0 },
    ],
  };
}
