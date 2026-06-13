import type { Analyzer, Signal, InsightInput, Severity, ExplainItem } from "./types";
import type { ModuleId } from "@/lib/types";

function mkRisk(
  tenantId: string, modul: ModuleId, severity: Severity,
  judul: string, narasi: string, explain: ExplainItem[],
): Signal {
  return { id: `risk-${tenantId}-${modul}-${judul}`, tenantId, modul, kind: "risk", severity, judul, narasi, explain };
}

export const riskAnalyzer: Analyzer = (input) => {
  const { koperasi } = input;
  const signals: Signal[] = [];

  if (koperasi.modules.includes("ternak") && input.ternak.length) {
    const mati = input.ternak.filter((t) => t.status === "mati").length;
    const rasio = mati / input.ternak.length;
    if (rasio >= 0.1) {
      signals.push(mkRisk(koperasi.id, "ternak", rasio >= 0.2 ? "critical" : "warning",
        `${mati} dari ${input.ternak.length} ternak mati`,
        `Mortalitas ${Math.round(rasio * 100)}% bulan ini — di atas ambang aman 10%. Periksa kesehatan & pakan segera.`,
        [{ faktor: "Ternak mati", bobot: 1, nilai: mati }, { faktor: "Total ternak", bobot: 0, nilai: input.ternak.length }]));
    }
    const perluVaksin = input.ternak.filter((t) => t.status === "perlu_vaksin").length;
    if (perluVaksin) {
      signals.push(mkRisk(koperasi.id, "ternak", "warning",
        `${perluVaksin} ekor perlu vaksin`,
        `${perluVaksin} ekor belum divaksin — risiko penyakit menular meningkat.`,
        [{ faktor: "Perlu vaksin", bobot: 1, nilai: perluVaksin }]));
    }
  }

  if (koperasi.modules.includes("inventori")) {
    for (const s of input.stok.filter((x) => x.kondisi && x.kondisi !== "baik")) {
      signals.push(mkRisk(koperasi.id, "inventori", s.kondisi === "rusak" ? "critical" : "warning",
        `${s.nama} kondisi ${s.kondisi}`,
        `${s.nama} dalam kondisi ${s.kondisi}${s.suhuC != null ? ` (suhu ${s.suhuC}°C)` : ""} — segera jual/olah untuk cegah kerugian.`,
        [{ faktor: "Qty", bobot: 0, nilai: s.qty }]));
    }
    for (const s of input.stok.filter((x) => x.qty <= 50 && (x.kondisi ?? "baik") === "baik")) {
      signals.push(mkRisk(koperasi.id, "inventori", "info",
        `Stok ${s.nama} menipis`,
        `Stok ${s.nama} tinggal ${s.qty} ${s.satuan}. Pertimbangkan pengadaan ulang.`,
        [{ faktor: "Sisa", bobot: 0, nilai: s.qty }]));
    }
  }

  return signals;
};
