"use client";

import { useState } from "react";
import type { Signal } from "@/lib/insight/types";

const CARD: Record<Signal["severity"], string> = {
  critical: "bg-red-50 border-red-200 border-l-4 border-l-red-500",
  warning:  "bg-amber-50 border-amber-200 border-l-4 border-l-amber-400",
  info:     "bg-white border-gray-200",
};
const BADGE: Record<Signal["severity"], string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  warning:  "bg-amber-100 text-amber-700 border-amber-200",
  info:     "bg-blue-50 text-blue-600 border-blue-200",
};
const TITLE: Record<Signal["severity"], string> = {
  critical: "text-red-800",
  warning:  "text-amber-800",
  info:     "text-gray-800",
};
const NARASI: Record<Signal["severity"], string> = {
  critical: "text-red-700",
  warning:  "text-amber-700",
  info:     "text-gray-500",
};

export function InsightPanel({ signals }: { signals: Signal[] }) {
  if (!signals.length) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
        <p className="text-3xl mb-2">✓</p>
        <p className="text-green-700 font-semibold text-sm">Semua dalam batas normal</p>
        <p className="text-gray-400 text-xs mt-1">Tidak ada sinyal peringatan terdeteksi</p>
      </div>
    );
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
    <div className={`rounded-xl border shadow-sm p-4 ${CARD[s.severity]}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className={`text-xs font-semibold uppercase tracking-wide border px-2 py-0.5 rounded-full ${BADGE[s.severity]}`}>
          {s.kind} · {s.severity}
        </span>
        <button
          onClick={() => setOpen(o => !o)}
          className="text-gray-400 hover:text-gray-600 text-xs transition-colors shrink-0">
          {open ? "Tutup ↑" : "Lihat alasan ↓"}
        </button>
      </div>
      <p className={`font-semibold text-sm mb-1 ${TITLE[s.severity]}`}>{s.judul}</p>
      <p className={`text-xs leading-relaxed ${NARASI[s.severity]}`}>{s.narasi}</p>
      {open && (
        <div className="mt-3 pt-3 border-t border-current/10 space-y-1.5">
          {s.explain.map((e, i) => (
            <div key={i} className="flex justify-between text-xs">
              <span className="text-gray-500">{e.faktor}</span>
              <span className="text-gray-700 font-mono">{e.nilai.toLocaleString("id-ID")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
