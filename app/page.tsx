"use client";

import { useTenant } from "@/lib/tenant-context";
import { KoperasiSwitcher } from "@/components/koperasi-switcher";
import { useInsight } from "@/lib/insight/use-insight";
import { InsightPanel } from "@/components/insight-panel";
import Link from "next/link";

const moduleIcon: Record<string, string> = {
  simpan_pinjam: "💰",
  inventori: "📦",
  ternak: "🐄",
  air: "💧",
  ritel: "🛒",
};
const moduleLabel: Record<string, string> = {
  simpan_pinjam: "Simpan Pinjam",
  inventori: "Inventori & Stok",
  ternak: "Registri Ternak",
  air: "Utilitas Air",
  ritel: "Toko Ritel",
};

const rupiah = (n: number) =>
  "Rp " + n.toLocaleString("id-ID");

export default function Dashboard() {
  const { koperasi, data } = useTenant();
  const signals = useInsight();

  const totalSimpanan = data.transaksi
    .filter((t) => t.tipe === "simpanan")
    .reduce((s, t) => s + t.jumlah, 0);

  const critical = signals.filter(s => s.severity === "critical");
  const warning  = signals.filter(s => s.severity === "warning");

  return (
    <div className="min-h-screen bg-gray-50 font-sans">

      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-green-600 flex items-center justify-center shadow-sm">
              <span className="text-white text-xs font-black">L</span>
            </div>
            <span className="font-bold text-green-700 text-base tracking-tight">LUMBUNG</span>
            <span className="hidden sm:inline text-gray-300 text-sm">·</span>
            <span className="hidden sm:inline text-gray-400 text-sm">Insight Engine Demo</span>
          </div>
          <div className="flex items-center gap-2">
            <KoperasiSwitcher />
            <Link
              href="/login"
              className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors shadow-sm">
              Masuk →
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {/* Koperasi identity + alert pills */}
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-gray-900 text-2xl font-bold">{koperasi.nama}</h1>
              <p className="text-gray-500 text-sm mt-0.5">
                {koperasi.fokusUsaha} &middot; {koperasi.lokasi}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {critical.length > 0 && (
                <span className="inline-flex items-center gap-1.5 bg-red-50 text-red-700 border border-red-200 text-xs font-semibold px-3 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  {critical.length} kritis
                </span>
              )}
              {warning.length > 0 && (
                <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold px-3 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  {warning.length} peringatan
                </span>
              )}
              {signals.length === 0 && (
                <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 border border-green-200 text-xs font-semibold px-3 py-1 rounded-full">
                  ✓ Normal
                </span>
              )}
            </div>
          </div>
        </div>

        {/* KPI row — varied sizing */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 col-span-1">
            <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">Anggota</p>
            <p className="text-gray-900 text-4xl font-black mt-2 leading-none">{data.anggota.length}</p>
            <p className="text-gray-400 text-xs mt-2">orang terdaftar</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 col-span-1">
            <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">Transaksi</p>
            <p className="text-blue-600 text-4xl font-black mt-2 leading-none">{data.transaksi.length}</p>
            <p className="text-gray-400 text-xs mt-2">total tercatat</p>
          </div>
          <div className="bg-green-600 rounded-2xl shadow-sm p-5 col-span-1">
            <p className="text-green-200 text-xs font-medium uppercase tracking-wider">Simpanan</p>
            <p className="text-white text-2xl font-black mt-2 leading-tight">{rupiah(totalSimpanan)}</p>
            <p className="text-green-300 text-xs mt-2">total terhimpun</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 col-span-1">
            <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">Modul</p>
            <p className="text-amber-500 text-4xl font-black mt-2 leading-none">{koperasi.modules.length}</p>
            <p className="text-gray-400 text-xs mt-2">dari 5 aktif</p>
          </div>
        </div>

        {/* Two-column section: Modul + Insight */}
        <div className="grid lg:grid-cols-5 gap-6">

          {/* Modul — narrower */}
          <div className="lg:col-span-2 space-y-3">
            <div>
              <p className="text-gray-700 text-sm font-semibold">Modul Koperasi</p>
              <p className="text-gray-400 text-xs mt-0.5">Commodity adapter aktif</p>
            </div>
            {koperasi.modules.map(m => (
              <div key={m} className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 flex items-center gap-3 hover:border-green-300 transition-colors">
                <span className="text-xl">{moduleIcon[m] ?? "📌"}</span>
                <div>
                  <p className="text-gray-800 text-sm font-medium">{moduleLabel[m] ?? m}</p>
                  {m === "simpan_pinjam" && <p className="text-gray-400 text-xs">{data.transaksi.length} transaksi</p>}
                  {m === "inventori" && <p className="text-gray-400 text-xs">{data.stok.length} item · {data.stok.filter(s => s.kondisi !== "baik").length} perlu perhatian</p>}
                  {m === "ternak" && <p className="text-gray-400 text-xs">{data.ternak.length} ekor · {data.ternak.filter(t => t.status === "perlu_vaksin").length} perlu vaksin</p>}
                  {m === "air" && <p className="text-gray-400 text-xs">Meteran & tagihan</p>}
                  {m === "ritel" && <p className="text-gray-400 text-xs">Penjualan gerai</p>}
                </div>
              </div>
            ))}
            {koperasi.modules.length === 0 && (
              <p className="text-gray-400 text-sm">Tidak ada modul aktif.</p>
            )}
          </div>

          {/* Insight — wider */}
          <div className="lg:col-span-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-700 text-sm font-semibold">Lumbung Insight</p>
                <p className="text-gray-400 text-xs mt-0.5">Sinyal AI — anomaly & risk scoring</p>
              </div>
              {signals.length > 0 && (
                <span className="text-gray-400 text-xs">{signals.length} sinyal</span>
              )}
            </div>
            <InsightPanel signals={signals} />
          </div>
        </div>

        {/* Footer */}
        <p className="text-gray-400 text-xs text-center border-t border-gray-200 pt-6">
          Demo mode · data mock · ganti koperasi di atas untuk melihat commodity adapter berbeda
        </p>
      </main>
    </div>
  );
}
