import api from './api'

export type AnomalyKasir = {
  user_id: string
  nama: string
  jumlah_flag: number
  jenis: 'simpanan_dispute' | 'simpanan_claim' | 'hapus_finansial' | 'ubah_nominal' | 'pembatalan_luar_jam'
  deskripsi: string
  kejadian: { waktu: string; tabel: string; aksi: string; detail?: string }[]
  simpanan_disputed?: number
  simpanan_claimed?: number
  luar_jam_count?: number
  total_aksi?: number
  rasio_luar_jam?: number
  status_investigasi: 'belum_ditinjau' | 'sedang_ditinjau' | 'selesai'
}

// Analisis anomali kasir kini dilakukan di guard-svc (sebelumnya dihitung di client dari audit_log Supabase).
// Endpoint mengembalikan daftar AnomalyKasir yang sudah jadi.
export async function getAnomalyKasir(): Promise<AnomalyKasir[]> {
  try {
    const data = await api.get<AnomalyKasir[]>('/api/anomali')
    return (data ?? []).sort((a, b) => b.jumlah_flag - a.jumlah_flag)
  } catch {
    // TODO: guard-svc /api/anomali belum tersedia — kembalikan kosong agar UI tidak crash.
    return []
  }
}
