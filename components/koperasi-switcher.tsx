"use client";

import { useTenant } from "@/lib/tenant-context";

export function KoperasiSwitcher() {
  const { koperasi, all, setKoperasiId } = useTenant();
  return (
    <select
      value={koperasi.id}
      onChange={(e) => setKoperasiId(e.target.value)}
      className="bg-white border border-gray-200 text-gray-700 text-sm font-medium px-3 py-1.5 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 cursor-pointer"
    >
      {all.map((k) => (
        <option key={k.id} value={k.id}>
          {k.nama}
        </option>
      ))}
    </select>
  );
}
