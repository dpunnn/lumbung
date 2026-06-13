import type { Analyzer, Signal, InsightInput } from "./types";

const round = (n: number) => Math.round(n * 100) / 100;

export interface AnomalyResult {
  isAnomaly: boolean;
  index: number;
  value: number;
  mean: number;
  std: number;
  z: number;
}

export function detectAnomali(series: number[], threshold = 2): AnomalyResult {
  const empty: AnomalyResult = { isAnomaly: false, index: -1, value: 0, mean: 0, std: 0, z: 0 };
  const n = series.length;
  if (n < 3) return empty;

  const mean = series.reduce((s, x) => s + x, 0) / n;
  const std = Math.sqrt(series.reduce((s, x) => s + (x - mean) ** 2, 0) / n);
  if (std === 0) return { ...empty, mean };

  let best = empty;
  series.forEach((x, i) => {
    const z = Math.abs(x - mean) / std;
    if (z > best.z) best = { isAnomaly: z > threshold, index: i, value: x, mean, std, z };
  });
  return best;
}

/** Hitung jumlah transaksi per bulan dari array dengan field ts (timestamp) */
function countPerBulan(items: { ts: string }[], bulanBack = 6): number[] {
  const now = new Date();
  return Array.from({ length: bulanBack }, (_, i) => {
    const target = new Date(now.getFullYear(), now.getMonth() - (bulanBack - 1 - i), 1);
    const next   = new Date(target.getFullYear(), target.getMonth() + 1, 1);
    return items.filter(x => {
      const d = new Date(x.ts);
      return d >= target && d < next;
    }).length;
  });
}

export const anomalyAnalyzer: Analyzer = (input) => {
  const { koperasi, transaksi, ternak, stok } = input;
  const signals: Signal[] = [];
  const tid = koperasi.id;

  // ── 1. Simpanan: lonjakan / penurunan tiba-tiba ──────────────────────────
  if (koperasi.modules.includes("simpan_pinjam")) {
    const simpananTx = transaksi.filter(t => t.tipe === "simpanan");
    const series = countPerBulan(simpananTx.map(t => ({ ts: t.ts })));
    const r = detectAnomali(series, 2);
    if (r.isAnomaly && r.value !== 0) {
      const bulanIdx = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
      const now = new Date();
      const bulanLabel = bulanIdx[(now.getMonth() - (5 - r.index) + 12) % 12];
      const isSpike = r.value > r.mean;

      signals.push({
        id: `anomaly-simpanan-${tid}`,
        tenantId: tid,
        modul: "simpan_pinjam",
        kind: "anomaly",
        severity: r.z > 3 ? "critical" : "warning",
        judul: isSpike
          ? `Transaksi simpanan melonjak di ${bulanLabel} (${r.value}x)`
          : `Transaksi simpanan turun drastis di ${bulanLabel} (${r.value}x)`,
        narasi: isSpike
          ? `Jumlah transaksi simpanan di ${bulanLabel} jauh di atas normal (${round(r.mean)} rata-rata). Lonjakan ${round(r.z)}× simpangan baku. Bisa jadi gelombang setoran bersama atau anomali pencatatan — perlu konfirmasi.`
          : `Transaksi simpanan di ${bulanLabel} sangat rendah (${round(r.mean)} rata-rata, turun ke ${r.value}). Indikasi penurunan partisipasi anggota atau masalah operasional.`,
        nilai: r.value,
        explain: [
          { faktor: "Bulan anomali", bobot: 1, nilai: r.value },
          { faktor: "Rata-rata bulanan", bobot: 0, nilai: round(r.mean) },
          { faktor: "Z-score", bobot: 0, nilai: round(r.z) },
        ],
      });
    }
  }

  // ── 2. Pinjaman: angsuran macet terkonsentrasi ────────────────────────────
  if (koperasi.modules.includes("simpan_pinjam")) {
    const pinjamanTx = transaksi.filter(t => t.tipe === "pinjaman");
    const series = countPerBulan(pinjamanTx.map(t => ({ ts: t.ts })));
    const r = detectAnomali(series, 2.5);
    if (r.isAnomaly && r.value > r.mean * 2) {
      signals.push({
        id: `anomaly-pinjaman-${tid}`,
        tenantId: tid,
        modul: "simpan_pinjam",
        kind: "anomaly",
        severity: "warning",
        judul: `Pemberian pinjaman melonjak (${r.value}× normal di bulan itu)`,
        narasi: `Jumlah pinjaman baru di satu bulan mencapai ${r.value} pencairan — ${round(r.z)}× di atas normal (${round(r.mean)}). Risiko konsentrasi kredit meningkat, pastikan kapasitas bayar anggota mencukupi.`,
        nilai: r.value,
        explain: [
          { faktor: "Pinjaman bulan puncak", bobot: 1, nilai: r.value },
          { faktor: "Rata-rata bulanan", bobot: 0, nilai: round(r.mean) },
          { faktor: "Z-score", bobot: 0, nilai: round(r.z) },
        ],
      });
    }
  }

  // ── 3. Ternak: lonjakan kematian ─────────────────────────────────────────
  if (koperasi.modules.includes("ternak") && ternak.length >= 3) {
    const matiCount = ternak.filter(t => t.status === "mati").length;
    const totalCount = ternak.length;
    const sehatCount = ternak.filter(t => t.status === "sehat").length;
    const rasioMati = matiCount / totalCount;

    if (rasioMati >= 0.05 && matiCount >= 2) {
      signals.push({
        id: `anomaly-ternak-mati-${tid}`,
        tenantId: tid,
        modul: "ternak",
        kind: "anomaly",
        severity: rasioMati >= 0.15 ? "critical" : "warning",
        judul: `Kematian ternak di atas normal (${matiCount} ekor, ${Math.round(rasioMati * 100)}%)`,
        narasi: `${matiCount} dari ${totalCount} ternak berstatus mati — rasio ${Math.round(rasioMati * 100)}% melampaui ambang aman 5%. Periksa pola penyakit, kualitas pakan, dan ventilasi kandang.`,
        nilai: matiCount,
        explain: [
          { faktor: "Ternak mati", bobot: 1, nilai: matiCount },
          { faktor: "Total ternak", bobot: 0, nilai: totalCount },
          { faktor: "Rasio (%)", bobot: 0, nilai: round(rasioMati * 100) },
        ],
      });
    }

    const now = Date.now();
    const perluVaksin = ternak.filter(t => {
      if (t.status === "mati") return false;
      if (!t.vaksin || t.vaksin.length === 0) return true;
      const last = new Date(t.vaksin[t.vaksin.length - 1]).getTime();
      return (now - last) > 90 * 24 * 60 * 60 * 1000;
    });
    if (perluVaksin.length >= 3) {
      signals.push({
        id: `anomaly-vaksin-${tid}`,
        tenantId: tid,
        modul: "ternak",
        kind: "anomaly",
        severity: "warning",
        judul: `${perluVaksin.length} ekor belum divaksin > 90 hari`,
        narasi: `${perluVaksin.length} ekor ternak tidak memiliki catatan vaksin dalam 90 hari terakhir. Risiko penyakit menular meningkat — jadwalkan vaksinasi segera.`,
        nilai: perluVaksin.length,
        explain: [
          { faktor: "Belum vaksin (90h+)", bobot: 1, nilai: perluVaksin.length },
          { faktor: "Ternak sehat total", bobot: 0, nilai: sehatCount },
        ],
      });
    }
  }

  // ── 4. Inventori: stok menipis ≥ 2 item sekaligus (cluster alert) ─────────
  if (koperasi.modules.includes("inventori") || (koperasi.modules as string[]).includes("pakan")) {
    const itemMenipis = stok.filter(s => s.qty <= 50 && (s.kondisi ?? "baik") === "baik");
    if (itemMenipis.length >= 2) {
      signals.push({
        id: `anomaly-stok-cluster-${tid}`,
        tenantId: tid,
        modul: "inventori",
        kind: "anomaly",
        severity: itemMenipis.length >= 4 ? "critical" : "warning",
        judul: `${itemMenipis.length} jenis stok menipis secara bersamaan`,
        narasi: `${itemMenipis.map(s => s.nama).join(", ")} — semuanya di bawah batas aman. Kejadian bersamaan ini bisa menandakan masalah rantai pasokan atau lonjakan permintaan mendadak.`,
        nilai: itemMenipis.length,
        explain: [
          { faktor: "Item di bawah minimum", bobot: 1, nilai: itemMenipis.length },
          ...itemMenipis.slice(0, 3).map(s => ({ faktor: s.nama, bobot: 0, nilai: s.qty })),
        ],
      });
    }
  }

  return signals;
};
