"use client";

import { useTenant } from "@/lib/tenant-context";

export function KoperasiSwitcher() {
  const { koperasi, all, setKoperasiId } = useTenant();
  return (
    <select
      value={koperasi.id}
      onChange={(e) => setKoperasiId(e.target.value)}
      className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium dark:border-zinc-700 dark:bg-zinc-900"
    >
      {all.map((k) => (
        <option key={k.id} value={k.id}>
          {k.nama}
        </option>
      ))}
    </select>
  );
}
