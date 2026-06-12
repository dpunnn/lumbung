"use client";

import { useState } from "react";
import type { Signal } from "@/lib/insight/types";

const gaya: Record<Signal["severity"], string> = {
  critical: "border-red-300 bg-red-50 text-red-800",
  warning: "border-amber-300 bg-amber-50 text-amber-800",
  info: "border-zinc-200 bg-zinc-50 text-zinc-700",
};

export function InsightPanel({ signals }: { signals: Signal[] }) {
  if (!signals.length) {
    return <p className="text-sm text-zinc-400">Tidak ada sinyal. Semua dalam batas normal.</p>;
  }
  return (
    <div className="space-y-3">
      {signals.map((s) => <SignalCard key={s.id} s={s} />)}
    </div>
  );
}

function SignalCard({ s }: { s: Signal }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-lg border p-3 ${gaya[s.severity]}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide">
          {s.kind} · {s.severity}
        </span>
        <button onClick={() => setOpen((o) => !o)} className="text-xs underline">
          {open ? "Tutup" : "Lihat alasan"}
        </button>
      </div>
      <p className="mt-1 font-medium">{s.judul}</p>
      <p className="text-sm">{s.narasi}</p>
      {open && (
        <ul className="mt-2 space-y-1 border-t border-current/20 pt-2 text-xs">
          {s.explain.map((e, i) => (
            <li key={i} className="flex justify-between gap-4">
              <span>{e.faktor}</span>
              <span className="font-mono">{e.nilai.toLocaleString("id-ID")}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
