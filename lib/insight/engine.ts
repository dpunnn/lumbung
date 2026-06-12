import type { InsightInput, Signal, Analyzer } from "./types";
import { anomalyAnalyzer } from "./anomaly";
import { assetAnalyzer } from "./asset";
import { riskAnalyzer } from "./risk";
import { scoreAnalyzer } from "./scoring";

// Tambah analyzer baru = cukup daftarkan di sini. Lens/Core tak perlu diubah.
const analyzers: Analyzer[] = [
  anomalyAnalyzer,
  riskAnalyzer,
  assetAnalyzer,
  scoreAnalyzer,
];

export function runInsight(input: InsightInput): Signal[] {
  const out: Signal[] = [];
  for (const a of analyzers) {
    try {
      out.push(...a(input));
    } catch (e) {
      console.error("Analyzer gagal:", e);
    }
  }
  const rank: Record<Signal["severity"], number> = { critical: 0, warning: 1, info: 2 };
  return out.sort((x, y) => rank[x.severity] - rank[y.severity]);
}
