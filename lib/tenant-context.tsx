"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { koperasiList, anggotaList, transaksiList, stokList, ternakList } from "./seed";

function useTenantData(tenantId: string) {
  return useMemo(
    () => ({
      anggota: anggotaList.filter((x) => x.tenantId === tenantId),
      transaksi: transaksiList.filter((x) => x.tenantId === tenantId),
      stok: stokList.filter((x) => x.tenantId === tenantId),
      ternak: ternakList.filter((x) => x.tenantId === tenantId),
    }),
    [tenantId],
  );
}

type Ctx = {
  koperasi: (typeof koperasiList)[number];
  all: typeof koperasiList;
  setKoperasiId: (id: string) => void;
  data: ReturnType<typeof useTenantData>;
};

const TenantCtx = createContext<Ctx | null>(null);

export function TenantProvider({ children }: { children: ReactNode }) {
  const [id, setKoperasiId] = useState(koperasiList[0].id);
  const koperasi = koperasiList.find((k) => k.id === id)!;
  const data = useTenantData(id);
  return (
    <TenantCtx.Provider value={{ koperasi, all: koperasiList, setKoperasiId, data }}>
      {children}
    </TenantCtx.Provider>
  );
}

export function useTenant() {
  const ctx = useContext(TenantCtx);
  if (!ctx) throw new Error("useTenant harus dipakai di dalam <TenantProvider>");
  return ctx;
}
