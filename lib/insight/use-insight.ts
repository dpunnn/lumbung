"use client";

import { useMemo } from "react";
import { useTenant } from "@/lib/tenant-context";
import { runInsight } from "./engine";
import type { Signal } from "./types";

export function useInsight(verifiedRatio?: number): Signal[] {
  const { koperasi, data } = useTenant();
  return useMemo(
    () => runInsight({
      koperasi,
      anggota: data.anggota,
      transaksi: data.transaksi,
      stok: data.stok,
      ternak: data.ternak,
      verifiedRatio,
    }),
    [koperasi, data, verifiedRatio],
  );
}
