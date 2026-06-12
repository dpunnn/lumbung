import type { Analyzer, Signal, InsightInput } from "./types";
import type { ModuleId } from "@/lib/types";

const round = (n: number) => Math.round(n * 100) / 100;

export interface AnomalyResult {
  isAnomaly: boolean;
  index: number;
  value: number;
  mean: number;
  std: number;
  z: number;
}

/** Deteksi titik paling menyimpang via z-score. Generik, dipakai semua koperasi. */
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

interface StreamDef {
  modul: ModuleId;
  series: number[];
  judul: (r: AnomalyResult) => string;
  narasi: (r: AnomalyResult) => string;
}

/**
 * Deret per koperasi. Sebagian DUMMY (menutupi gap) sampai data CRUD nyata mengalir.
 * Engine-nya sama; hanya kolom/datanya yang beda → bukti commodity adapter di lapis AI.
 */
function streamsFor(input: InsightInput): StreamDef[] {
  switch (input.koperasi.id) {
    case "padiwangi":
      return [{
        modul: "simpan_pinjam",
        series: [1, 0, 2, 1, 1, 0, 1, 2, 1, 0, 1, 2, 9], // dummy: pembatalan kasir per jam, spike jam tutup
        judul: (r) => `Pembatalan kasir melonjak (${r.value}x) di luar jam normal`,
        narasi: (r) =>
          `Terjadi ${r.value} pembatalan transaksi pada satu jam — ${round(r.z)}× simpangan di atas rata-rata (${round(r.mean)}). Sebagian besar setelah jam tutup. Perlu ditinjau pengawas tanpa langsung menuduh.`,
      }];
    case "melati-jaya":
      return [
        {
          modul: "inventori",
          series: [6, 6, 7, 6, 8, 7, 15, 7], // dummy: suhu cold storage (°C)
          judul: (r) => `Suhu cold storage menyentuh ${r.value}°C`,
          narasi: (r) =>
            `Suhu sempat ${r.value}°C, jauh di atas ambang aman (~${round(r.mean)}°C). Risiko sayur cepat rusak — periksa unit pendingin.`,
        },
        {
          modul: "inventori",
          series: [0, 1, 0, 1, 0, 4], // dummy: stok rusak per pemeriksaan
          judul: (r) => `Stok rusak melonjak (${r.value} item)`,
          narasi: (r) =>
            `Jumlah stok rusak naik tajam ke ${r.value} item. Indikasi penanganan rantai dingin atau pencatatan stok yang hilang.`,
        },
      ];
    case "sumber-makmur":
      return [{
        modul: "inventori",
        series: [120, 118, 121, 119, 150, 120], // dummy: harga beli pupuk (ribu/sak)
        judul: (r) => `Harga beli pupuk menyimpang (Rp${r.value}rb/sak)`,
        narasi: (r) =>
          `Satu pembelian seharga Rp${r.value}rb/sak, jauh di atas harga biasa (~Rp${round(r.mean)}rb). Cek apakah beda volume atau perlu negosiasi ulang supplier.`,
      }];
    case "tirta-bersama":
      return [{
        modul: "simpan_pinjam",
        series: [2, 3, 2, 4, 3, 9], // dummy: jumlah tunggakan per bulan
        judul: (r) => `Tunggakan melonjak (${r.value} kasus)`,
        narasi: (r) =>
          `Tunggakan naik ke ${r.value} kasus bulan ini, ${round(r.z)}× di atas normal. Perlu tindak lanjut penagihan.`,
      }];
    case "harapan-baru":
      return [{
        modul: "ternak",
        series: [0, 1, 0, 1, 0, 3], // dummy: kematian ternak per bulan
        judul: (r) => `Kematian ternak melonjak (${r.value} ekor)`,
        narasi: (r) =>
          `Kematian ternak naik ke ${r.value} ekor bulan ini. Periksa pakan, kandang, dan jadwal vaksin segera.`,
      }];
    default:
      return [];
  }
}

export const anomalyAnalyzer: Analyzer = (input) => {
  const signals: Signal[] = [];
  streamsFor(input).forEach((s, idx) => {
    const r = detectAnomali(s.series);
    if (!r.isAnomaly) return;
    signals.push({
      id: `anomaly-${input.koperasi.id}-${s.modul}-${idx}`,
      tenantId: input.koperasi.id,
      modul: s.modul,
      kind: "anomaly",
      severity: r.z > 3 ? "critical" : "warning",
      judul: s.judul(r),
      narasi: s.narasi(r),
      nilai: r.value,
      explain: [
        { faktor: "Nilai teramati", bobot: 1, nilai: round(r.value) },
        { faktor: "Rata-rata normal", bobot: 0, nilai: round(r.mean) },
        { faktor: "Simpangan (z-score)", bobot: 0, nilai: round(r.z) },
      ],
    });
  });
  return signals;
};
