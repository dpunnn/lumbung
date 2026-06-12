"use client";

import { useTenant } from "@/lib/tenant-context";
import { KoperasiSwitcher } from "@/components/koperasi-switcher";
import { useInsight } from "@/lib/insight/use-insight";
import { InsightPanel } from "@/components/insight-panel";

const moduleLabel: Record<string, string> = {
  simpan_pinjam: "Simpan Pinjam",
  inventori: "Inventori / Stok",
  ternak: "Registri Ternak",
  air: "Utilitas Air",
  ritel: "Toko / Ritel",
};

const rupiah = (n: number) => "Rp" + n.toLocaleString("id-ID");

export default function Dashboard() {
  const { koperasi, data } = useTenant();
  const signals = useInsight();

  const totalSimpanan = data.transaksi
    .filter((t) => t.tipe === "simpanan")
    .reduce((s, t) => s + t.jumlah, 0);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{koperasi.nama}</h1>
          <p className="text-sm text-zinc-500">
            {koperasi.fokusUsaha} · {koperasi.lokasi} · literasi {koperasi.literasi}
          </p>
        </div>
        <KoperasiSwitcher />
      </header>

      {/* Ringkasan umum */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Anggota" value={String(data.anggota.length)} />
        <Stat label="Transaksi" value={String(data.transaksi.length)} />
        <Stat label="Total Simpanan" value={rupiah(totalSimpanan)} />
        <Stat label="Modul Aktif" value={String(koperasi.modules.length)} />
      </div>

      {/* Commodity adapter: hanya modul yang aktif yang muncul */}
      <h2 className="mb-3 text-sm font-semibold uppercase text-zinc-500">Modul Koperasi Ini</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {koperasi.modules.includes("simpan_pinjam") && (
          <Card title="Simpan Pinjam">{data.transaksi.length} transaksi tercatat</Card>
        )}
        {koperasi.modules.includes("inventori") && (
          <Card title="Inventori / Stok">
            {data.stok.length} jenis barang · {data.stok.filter((s) => s.kondisi !== "baik").length} perlu perhatian
          </Card>
        )}
        {koperasi.modules.includes("ternak") && (
          <Card title="Registri Ternak">
            {data.ternak.length} ekor · {data.ternak.filter((t) => t.status === "perlu_vaksin").length} perlu vaksin
          </Card>
        )}
        {koperasi.modules.includes("air") && <Card title="Utilitas Air">Pencatatan meteran & tagihan</Card>}
        {koperasi.modules.includes("ritel") && <Card title="Toko / Ritel">Penjualan gerai</Card>}
      </div>

      {/* Lumbung Insight — Lens me-render Signal[] dari mesin Insight */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase text-zinc-500">
          Lumbung Insight — Sinyal Kepercayaan
        </h2>
        <InsightPanel signals={signals} />
      </section>

      <p className="mt-8 text-xs text-zinc-400">
        Modul yang ditampilkan: {koperasi.modules.map((m) => moduleLabel[m]).join(", ")}.
        Ganti koperasi di kanan atas untuk melihat commodity adapter & Insight bekerja.
      </p>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-zinc-500">{children}</p>
    </div>
  );
}
